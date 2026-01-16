/**
 * Slide DSL 类型定义
 * 用于AI生成的JSON中间格式，支持丰富的内容类型
 */

// ============ 布局类型 ============

/**
 * 幻灯片布局类型
 * - title-only: 仅标题页（用于封面、章节页）
 * - title-content: 标题+内容区（最常用）
 * - two-column: 双栏布局
 * - section: 章节分隔页
 * - comparison: 对比布局
 */
export type SlideLayout =
  | 'title-only'
  | 'title-content'
  | 'two-column'
  | 'section'
  | 'comparison'

// ============ 内容块类型 ============

/**
 * 段落文本块
 */
export interface ParagraphBlock {
  type: 'paragraph'
  text: string
  emphasis?: 'normal' | 'highlight' | 'muted'
}

/**
 * 无序列表块
 */
export interface BulletsBlock {
  type: 'bullets'
  items: string[]
}

/**
 * 有序列表块
 */
export interface NumberedBlock {
  type: 'numbered'
  items: string[]
}

/**
 * 代码块
 * 使用 lines 数组表示每一行，避免JSON转义问题
 */
export interface CodeBlock {
  type: 'code'
  language: string
  lines: string[]
  caption?: string
}

/**
 * 表格块
 */
export interface TableBlock {
  type: 'table'
  headers: string[]
  rows: string[][]
  caption?: string
}

/**
 * 引用块
 */
export interface QuoteBlock {
  type: 'quote'
  text: string
  author?: string
}

/**
 * 内容块联合类型
 */
export type ContentBlock =
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | CodeBlock
  | TableBlock
  | QuoteBlock

/**
 * 内容块类型标识
 */
export type ContentBlockType = ContentBlock['type']

// ============ 幻灯片类型 ============

/**
 * 单张幻灯片DSL定义
 */
export interface SlideDSL {
  /** 布局类型 */
  layout: SlideLayout
  /** 标题 */
  title?: string
  /** 副标题 */
  subtitle?: string
  /** 内容块列表（用于 title-content, section 等单栏布局） */
  content?: ContentBlock[]
  /** 左侧内容（用于 two-column, comparison 布局） */
  leftContent?: ContentBlock[]
  /** 右侧内容（用于 two-column, comparison 布局） */
  rightContent?: ContentBlock[]
  /** 演讲者备注 */
  notes?: string
}

// ============ 演示文稿类型 ============

/**
 * 完整演示文稿DSL定义
 */
export interface PresentationDSL {
  slides: SlideDSL[]
}

// ============ 解析结果类型 ============

/**
 * DSL解析成功结果
 */
export interface DSLParseSuccess {
  success: true
  data: PresentationDSL
}

/**
 * DSL解析错误
 */
export interface DSLParseError {
  success: false
  error: string
  details?: unknown
}

/**
 * DSL解析结果
 */
export type DSLParseResult = DSLParseSuccess | DSLParseError

// ============ 内容限制常量 ============

/**
 * DSL内容限制配置
 * 用于Prompt提示和Schema验证
 */
export const DSL_LIMITS = {
  /** 每张幻灯片最多内容块数 */
  MAX_CONTENT_BLOCKS_PER_SLIDE: 4,
  /** 双栏布局每栏最多内容块数 */
  MAX_CONTENT_BLOCKS_PER_COLUMN: 3,
  /** 标题最大长度 */
  MAX_TITLE_LENGTH: 100,
  /** 副标题最大长度 */
  MAX_SUBTITLE_LENGTH: 150,
  /** 段落最大长度 */
  MAX_PARAGRAPH_LENGTH: 300,
  /** 列表项最大数量 */
  MAX_LIST_ITEMS: 6,
  /** 单个列表项最大长度 */
  MAX_LIST_ITEM_LENGTH: 100,
  /** 代码块最大行数 */
  MAX_CODE_LINES: 15,
  /** 表格最大列数 */
  MAX_TABLE_COLUMNS: 5,
  /** 表格最大行数 */
  MAX_TABLE_ROWS: 6,
  /** 引用最大长度 */
  MAX_QUOTE_LENGTH: 200,
} as const
