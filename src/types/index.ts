import type { PresentationDSL } from './slide-dsl'

// 主题类型（从 dsl-renderer 导出）
export type ThemeName = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'slate' | 'teal' | 'rose'

export interface OutlineItem {
  title: string
  points: string[]
}

// 搜索资料结果
export interface ResourceResult {
  title: string
  url: string
  content: string // 搜索摘要
  rawContent?: string // 完整网页内容
  query?: string // 搜索时使用的查询关键词
}

export interface ResourceData {
  topic: string // 用户输入的主题
  results: ResourceResult[]
  /** AI 对收集资料的总结分析 */
  summary?: string
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
  theme?: ThemeName // PPT主题颜色
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
  theme?: ThemeName
}
