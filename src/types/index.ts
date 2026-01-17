import type { PresentationDSL } from './slide-dsl'

export interface OutlineItem {
  title: string
  points: string[]
}

// 搜索资料结果
export interface ResourceData {
  query: string
  results: {
    title: string
    url: string
    content: string // 搜索摘要
    rawContent?: string // 完整网页内容
  }[]
  collectedAt: string
}

export type GenerationStage =
  | 'idle'
  | 'collecting'
  | 'outlining'
  | 'generating'
  | 'exporting'
  | 'completed'
  | 'error'

// 会话状态
export interface GenerationSession {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  stage: GenerationStage
  error?: string
  // 中间数据
  resources?: ResourceData
  outline?: OutlineItem[]
  dslPresentation?: PresentationDSL // DSL格式内容
  // 时间戳
  createdAt: string
  updatedAt: string
}

export interface GenerationProgress {
  stage: GenerationStage
  progress: number
  message: string
}

export interface GenerateRequest {
  topic: string
  language: 'zh-CN' | 'en-US'
}
