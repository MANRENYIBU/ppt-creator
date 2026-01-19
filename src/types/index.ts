import type { PresentationDSL } from './slide-dsl'

// 主题类型（从 dsl-renderer 导出）
export type ThemeName = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'slate' | 'teal' | 'rose'

// 生成模式
export type GenerationMode = 'dsl' | 'image'

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

// ============ 图片模式类型 ============

// 图片幻灯片类型
export type ImageSlideType = 'cover' | 'toc' | 'section' | 'content' | 'ending'

// 单张图片幻灯片
export interface ImageSlide {
  index: number                    // 幻灯片序号（从0开始）
  type: ImageSlideType             // 幻灯片类型
  prompt: string                   // 生成该幻灯片使用的提示词
  imageBase64?: string             // 生成的图片 base64（不含 data:image/xxx;base64, 前缀）
  imageFormat?: 'png' | 'jpeg'     // 图片格式
  generatedAt?: string             // 生成时间
  error?: string                   // 生成失败时的错误信息
}

// 图片演示文稿
export interface ImagePresentation {
  slides: ImageSlide[]
  generatedAt?: string
}

// ============ 会话状态 ============

// 会话状态
export interface GenerationSession {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  mode: GenerationMode             // 生成模式
  theme?: ThemeName                // PPT主题颜色
  stage: GenerationStage
  processing?: boolean             // 是否正在处理中（防止重复触发）
  error?: string
  // 共用中间数据
  resources?: ResourceData
  outline?: OutlineItem[]
  // DSL 模式专用
  dslPresentation?: PresentationDSL
  // 图片模式专用
  imagePresentation?: ImagePresentation
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
  mode?: GenerationMode
  theme?: ThemeName
}
