import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getAIConfig, AIProvider } from './config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
}

/**
 * AI服务客户端 - 统一接口
 */
class AIClient {
  private provider: AIProvider
  private openai: OpenAI | null = null
  private anthropic: Anthropic | null = null
  private model: string

  constructor() {
    const config = getAIConfig()
    this.provider = config.provider
    this.model = config.model

    if (config.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })
    } else {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })
    }
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    if (this.provider === 'openai' && this.openai) {
      return this.chatWithOpenAI(messages)
    } else if (this.provider === 'anthropic' && this.anthropic) {
      return this.chatWithAnthropic(messages)
    }
    throw new Error('AI client not initialized')
  }

  private async chatWithOpenAI(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await this.openai!.chat.completions.create({
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

  private async chatWithAnthropic(
    messages: ChatMessage[]
  ): Promise<AIResponse> {
    // 分离system消息
    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')

    const response = await this.anthropic!.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: chatMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const textContent = response.content.find((c) => c.type === 'text')
    return {
      content: textContent?.text || '',
    }
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
