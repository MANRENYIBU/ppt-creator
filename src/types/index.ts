export interface OutlineItem {
  title: string
  points: string[]
}

// 幻灯片类型
export type SlideType =
  | 'cover'
  | 'toc'
  | 'content'
  | 'section'
  | 'summary'
  | 'thanks'

// 详细的幻灯片内容
export interface SlideContent {
  type: SlideType
  title: string
  subtitle?: string
  points?: string[]
  details?: string[] // 每个要点的详细说明
  notes?: string // 演讲备注
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

// 生成上下文（保存中间数据）
export interface GenerationContext {
  topic: string
  language: 'zh-CN' | 'en-US'
  duration: number
  resources: ResourceData | null
  outline: OutlineItem[]
  slides: SlideContent[]
}

export interface GenerationRecord {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  duration: number
  outline: OutlineItem[]
  createdAt: string
  downloadUrl?: string
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
  duration: number
  stage: GenerationStage
  error?: string
  // 中间数据
  resources?: ResourceData
  outline?: OutlineItem[]
  slides?: SlideContent[]
  downloadUrl?: string
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
  duration: number
}

export const DURATION_OPTIONS = [5, 10, 15, 20, 30] as const

export const DURATION_TO_SLIDES: Record<number, { min: number; max: number }> =
  {
    5: { min: 5, max: 6 },
    10: { min: 8, max: 10 },
    15: { min: 12, max: 15 },
    20: { min: 16, max: 20 },
    30: { min: 24, max: 30 },
  }
