import OpenAI from 'openai'
import { getAIConfig } from './config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
}

/**
 * 安全解析工具调用参数
 * 尝试修复常见的 JSON 格式错误
 */
function safeParseToolArgs(input: string): Record<string, unknown> {
  // 先尝试直接解析
  try {
    return JSON.parse(input)
  } catch {
    // 继续尝试修复
  }

  let fixed = input

  // 1. 移除尾部多余逗号
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

  // 2. 修复未转义的换行符（在字符串值中）
  fixed = fixed.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  })

  // 3. 尝试解析修复后的 JSON
  try {
    return JSON.parse(fixed)
  } catch {
    // 继续尝试
  }

  // 4. 尝试截断到最后一个完整的属性
  const lastBrace = fixed.lastIndexOf('}')
  if (lastBrace > 0) {
    const truncated = fixed.slice(0, lastBrace + 1)
    try {
      return JSON.parse(truncated)
    } catch {
      // 继续
    }
  }

  // 5. 最后尝试：提取看起来像对象的部分
  const objMatch = fixed.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0])
    } catch {
      // 放弃
    }
  }

  // 所有尝试都失败，抛出原始错误
  throw new Error(`Failed to parse tool arguments: ${input.slice(0, 100)}...`)
}

// Slide 工具的 JSON Schema
const SLIDE_SCHEMA = {
  type: 'object',
  properties: {
    layout: {
      type: 'string',
      enum: ['title-content', 'two-column', 'comparison'],
      description: '幻灯片布局类型',
    },
    title: {
      type: 'string',
      description: '幻灯片标题',
    },
    subtitle: {
      type: 'string',
      description: '副标题（可选）',
    },
    content: {
      type: 'array',
      description: '内容块数组（用于 title-content 布局）',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['paragraph', 'bullets', 'numbered', 'code', 'table', 'quote'],
          },
          text: { type: 'string' },
          emphasis: { type: 'string', enum: ['normal', 'highlight', 'muted'] },
          items: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          lines: { type: 'array', items: { type: 'string' } },
          headers: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          author: { type: 'string' },
          caption: { type: 'string' },
        },
        required: ['type'],
      },
    },
    leftContent: {
      type: 'array',
      description: '左侧内容（用于双栏布局）',
      items: { type: 'object' },
    },
    rightContent: {
      type: 'array',
      description: '右侧内容（用于双栏布局）',
      items: { type: 'object' },
    },
  },
  required: ['layout', 'title'],
}

// OpenAI 工具定义
const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_slide',
      description: '添加一张幻灯片到演示文稿',
      parameters: SLIDE_SCHEMA,
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_generation',
      description: '完成幻灯片生成，所有内容已添加完毕',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

/**
 * AI服务客户端（OpenAI）
 */
class AIClient {
  private openai: OpenAI
  private model: string

  constructor() {
    const config = getAIConfig()
    this.model = config.model
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
      response_format: {
        type: 'json_object',
      },
    })

    return {
      content: response.choices[0]?.message?.content || '',
    }
  }

  /**
   * 使用 Function Calling 生成幻灯片
   * AI 会多次调用 add_slide 工具，直到调用 finish_generation
   *
   * @param messages 对话消息
   * @param onSlideAdded 幻灯片校验回调，返回 true 表示有效，返回 false 表示无效需要重新生成
   */
  async generateSlidesWithTools(
    messages: ChatMessage[],
    onSlideAdded?: (slide: Record<string, unknown>) => boolean
  ): Promise<Record<string, unknown>[]> {
    const slides: Record<string, unknown>[] = []
    const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

    let finished = false
    let iterations = 0
    const maxIterations = 50 // 防止无限循环

    while (!finished && iterations < maxIterations) {
      iterations++

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversationMessages,
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
      })

      const message = response.choices[0]?.message
      if (!message) break

      // 添加 assistant 消息到对话历史
      conversationMessages.push(message)

      // 检查是否有工具调用
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== 'function') continue

          const functionName = toolCall.function.name

          // 容错处理：尝试解析 JSON，失败则跳过
          let args: Record<string, unknown>
          try {
            args = safeParseToolArgs(toolCall.function.arguments || '{}')
          } catch (e) {
            console.error(`[AI] Failed to parse tool arguments for ${functionName}:`, e)
            // 添加错误的工具结果，让模型知道解析失败
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error: 'JSON parse error, please try again with valid JSON'
              }),
            })
            continue
          }

          if (functionName === 'add_slide') {
            // 调用校验回调，判断是否有效
            const isValid = onSlideAdded ? onSlideAdded(args) : true

            if (!isValid) {
              // 校验失败，要求模型重新生成
              console.warn(`[AI] Slide validation failed, requesting regeneration: ${args.title}`)
              conversationMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'Invalid content block types detected. Only use: paragraph, bullets, numbered, code, table, quote. Please regenerate this slide.'
                }),
              })
              continue
            }

            slides.push(args)
            console.log(`[AI] Added slide ${slides.length}: ${args.title}`)

            // 添加工具结果
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: true, slideIndex: slides.length }),
            })
          } else if (functionName === 'finish_generation') {
            console.log(`[AI] Generation finished, total slides: ${slides.length}`)
            finished = true
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: true }),
            })
            break
          }
        }
      } else {
        // 没有工具调用，可能是 AI 直接返回文本
        console.log('[AI] No tool calls, stopping')
        finished = true
      }
    }

    return slides
  }
}

// 单例模式
let aiClient: AIClient | null = null

export function getAIClient(): AIClient {
  if (!aiClient) {
    aiClient = new AIClient()
  }
  return aiClient
}

/**
 * 重置客户端（用于配置更改后）
 */
export function resetAIClient(): void {
  aiClient = null
}
