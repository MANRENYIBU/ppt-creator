import OpenAI from 'openai'
import { getAIConfig, getImageConfig, ImageConfig } from './config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
}

/** 收集到的资料项 */
export interface CollectedResource {
  title: string
  url: string
  content: string
  rawContent?: string
  query?: string // 搜索时使用的查询关键词
}

/** 资料收集结果 */
export interface ResearchResult {
  resources: CollectedResource[]
  summary: string
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
    return match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
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
            enum: [
              'paragraph',
              'bullets',
              'numbered',
              'code',
              'table',
              'quote',
            ],
          },
          text: { type: 'string' },
          emphasis: { type: 'string', enum: ['normal', 'highlight', 'muted'] },
          items: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          lines: { type: 'array', items: { type: 'string' } },
          headers: { type: 'array', items: { type: 'string' } },
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
          },
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

// ============ 资料收集工具定义 ============

const RESEARCH_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description:
        '搜索网页获取相关资料。每次搜索返回最多5条结果，包含标题、URL和内容摘要。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，应该精确且相关',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description:
        '抓取指定URL的完整网页内容。用于获取搜索结果中感兴趣的页面的详细内容。',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '要抓取的网页URL',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_research',
      description:
        '完成资料收集，提交研究总结。在收集到足够的资料后调用此工具。',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description:
              '对收集到的资料的综合总结，包括关键发现、重要数据、核心观点等。这个总结将用于后续的PPT生成。',
          },
        },
        required: ['summary'],
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
    onSlideAdded?: (slide: Record<string, unknown>) => boolean,
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
            console.error(
              `[AI] Failed to parse tool arguments for ${functionName}:`,
              e,
            )
            // 添加错误的工具结果，让模型知道解析失败
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error: 'JSON parse error, please try again with valid JSON',
              }),
            })
            continue
          }

          if (functionName === 'add_slide') {
            // 调用校验回调，判断是否有效
            const isValid = onSlideAdded ? onSlideAdded(args) : true

            if (!isValid) {
              // 校验失败，要求模型重新生成
              console.warn(
                `[AI] Slide validation failed, requesting regeneration: ${args.title}`,
              )
              conversationMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error:
                    'Invalid content block types detected. Only use: paragraph, bullets, numbered, code, table, quote. Please regenerate this slide.',
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
              content: JSON.stringify({
                success: true,
                slideIndex: slides.length,
              }),
            })
          } else if (functionName === 'finish_generation') {
            console.log(
              `[AI] Generation finished, total slides: ${slides.length}`,
            )
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

  /**
   * 使用 Function Calling 进行资料收集
   * AI 会调用 search_web 和 fetch_url 工具收集资料，最后调用 finish_research 提交总结
   *
   * @param messages 对话消息
   * @param onSearch 搜索回调，执行实际的搜索操作
   * @param onFetch 抓取回调，执行实际的网页抓取操作
   */
  async conductResearch(
    messages: ChatMessage[],
    onSearch: (
      query: string,
    ) => Promise<
      { query: string; title: string; url: string; content: string }[]
    >,
    onFetch: (url: string) => Promise<string | null>,
  ): Promise<ResearchResult> {
    const resources: CollectedResource[] = []
    const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

    let finished = false
    let iterations = 0
    const maxIterations = 20 // 资料收集最多20轮
    let summary = ''

    while (!finished && iterations < maxIterations) {
      iterations++

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversationMessages,
        tools: RESEARCH_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
      })

      const message = response.choices[0]?.message
      if (!message) break

      conversationMessages.push(message)

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== 'function') continue

          const functionName = toolCall.function.name
          let args: Record<string, unknown>

          try {
            args = safeParseToolArgs(toolCall.function.arguments || '{}')
          } catch (e) {
            console.error(
              `[AI Research] Failed to parse tool arguments for ${functionName}:`,
              e,
            )
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error: 'JSON parse error, please try again with valid JSON',
              }),
            })
            continue
          }

          if (functionName === 'search_web') {
            const query = args.query as string
            console.log(`[AI Research] Searching: ${query}`)

            try {
              const results = await onSearch(query)
              console.log(`[AI Research] Found ${results.length} results`)

              // 将搜索结果添加到资源列表（避免重复）
              for (const r of results) {
                if (!resources.some((existing) => existing.url === r.url)) {
                  resources.push({
                    title: r.title,
                    url: r.url,
                    content: r.content,
                    query: r.query,
                  })
                }
              }

              conversationMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: true,
                  results: results.map((r) => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.content.slice(0, 500),
                  })),
                }),
              })
            } catch (e) {
              console.error(`[AI Research] Search failed:`, e)
              conversationMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'Search failed, please try a different query',
                }),
              })
            }
          } else if (functionName === 'fetch_url') {
            const url = args.url as string
            console.log(`[AI Research] Fetching: ${url}`)

            try {
              const content = await onFetch(url)

              if (content) {
                // 更新资源的 rawContent
                const resource = resources.find((r) => r.url === url)
                if (resource) {
                  resource.rawContent = content
                } else {
                  resources.push({
                    title: url,
                    url,
                    content: content.slice(0, 500),
                    rawContent: content,
                  })
                }

                conversationMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    success: true,
                    content: content.slice(0, 3000), // 限制返回给AI的内容长度
                  }),
                })
              } else {
                conversationMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    success: false,
                    error: 'Failed to fetch URL content',
                  }),
                })
              }
            } catch (e) {
              console.error(`[AI Research] Fetch failed:`, e)
              conversationMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'Failed to fetch URL',
                }),
              })
            }
          } else if (functionName === 'finish_research') {
            summary = args.summary as string
            console.log(
              `[AI Research] Research finished, summary length: ${summary.length}`,
            )
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
        // 没有工具调用，AI可能直接返回了文本
        console.log('[AI Research] No tool calls, stopping')
        // 尝试从返回的文本中提取总结
        if (message.content) {
          summary = message.content
        }
        finished = true
      }
    }

    // 如果没有总结，生成一个默认的
    if (!summary && resources.length > 0) {
      summary = `收集了 ${resources.length} 条相关资料。`
    }

    return { resources, summary }
  }
}

class ImagesClient {
  private imageConfig: ImageConfig

  constructor() {
    this.imageConfig = getImageConfig()
  }

  async generateSlideImageByFetch(
    prompt: string,
    images?: string[],
  ): Promise<string> {
    console.log(
      `[Image Generator] Calling AI with prompt length: ${prompt.length}`,
    )

    let requestBody: any = {
      model: this.imageConfig.model,
      prompt: prompt,
      size: '2560x1440',
      response_format: 'b64_json',
      watermark: false,
    }
    // 添加旧图片
    if (images && images.length > 0) {
      requestBody = {
        image: images,
        ...requestBody,
      }
    }

    const response = await fetch(this.imageConfig.baseUrl || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.imageConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000), // 1分钟
    })

    const result = await response.json()

    if (result.error) {
      throw new Error(
        `Image Generated Error ${result.error.code}:${result.error.message}`,
      )
    }

    const imageUrl: string = result.data[0]?.b64_json

    if (!imageUrl) {
      throw new Error(`No image generated ${result.data[0]}`)
    }

    console.log(`[Image Generator] base64 length:${imageUrl.length}`)

    return imageUrl
  }
}

// 单例模式
let aiClient: AIClient | null = null
let imageClient: ImagesClient | null = null

export function getAIClient(): AIClient {
  if (!aiClient) {
    aiClient = new AIClient()
  }
  return aiClient
}

export function getImageClient(): ImagesClient {
  if (!imageClient) {
    imageClient = new ImagesClient()
  }
  return imageClient
}

/**
 * 重置客户端（用于配置更改后）
 */
export function resetAIClient(): void {
  aiClient = null
}

export function resetImageClient(): void {
  imageClient = null
}
