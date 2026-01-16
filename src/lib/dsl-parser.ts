/**
 * DSL JSON 解析器
 * 负责解析AI生成的JSON，验证格式，处理常见错误
 */

import { presentationDSLSchema } from './dsl-schema'
import type {
  PresentationDSL,
  DSLParseResult,
  SlideDSL,
  ContentBlock,
} from '@/types/slide-dsl'
import { DSL_LIMITS } from '@/types/slide-dsl'

/**
 * 清理AI输出中的markdown代码块标记
 */
function cleanJsonString(input: string): string {
  let cleaned = input.trim()

  // 移除 ```json 和 ``` 标记
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  return cleaned.trim()
}

/**
 * 尝试修复常见的JSON错误
 */
function tryFixJson(input: string): string {
  let fixed = input

  // 移除尾部多余逗号（常见AI错误）
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

  // 修复未转义的换行符（在字符串中）
  // 这是一个简单的修复，可能不完美
  fixed = fixed.replace(/(?<!\\)\n(?=[^"]*"[^"]*$)/gm, '\\n')

  return fixed
}

/**
 * 解析DSL JSON字符串
 */
export function parseDSL(input: string): DSLParseResult {
  // Step 1: 清理输入
  const cleaned = cleanJsonString(input)

  // Step 2: 尝试解析JSON
  let jsonData: unknown
  try {
    jsonData = JSON.parse(cleaned)
  } catch (e) {
    // 尝试修复后再解析
    try {
      const fixed = tryFixJson(cleaned)
      jsonData = JSON.parse(fixed)
    } catch {
      return {
        success: false,
        error: 'JSON解析失败',
        details: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // Step 3: Zod Schema 验证
  const result = presentationDSLSchema.safeParse(jsonData)

  if (!result.success) {
    // 格式化Zod错误信息
    const errorMessages = result.error.issues.map((issue) => {
      const path = issue.path.join('.')
      return `${path}: ${issue.message}`
    })

    return {
      success: false,
      error: 'Schema验证失败',
      details: errorMessages,
    }
  }

  return {
    success: true,
    data: result.data as PresentationDSL,
  }
}

/**
 * 截断过长的内容块
 * 用于容错处理，确保即使AI生成超限内容也能渲染
 */
export function truncateContentBlock(block: ContentBlock): ContentBlock {
  switch (block.type) {
    case 'paragraph':
      return {
        ...block,
        text:
          block.text.length > DSL_LIMITS.MAX_PARAGRAPH_LENGTH
            ? block.text.slice(0, DSL_LIMITS.MAX_PARAGRAPH_LENGTH) + '...'
            : block.text,
      }

    case 'bullets':
    case 'numbered':
      return {
        ...block,
        items: block.items.slice(0, DSL_LIMITS.MAX_LIST_ITEMS).map((item) =>
          item.length > DSL_LIMITS.MAX_LIST_ITEM_LENGTH
            ? item.slice(0, DSL_LIMITS.MAX_LIST_ITEM_LENGTH) + '...'
            : item
        ),
      }

    case 'code':
      return {
        ...block,
        lines: block.lines.slice(0, DSL_LIMITS.MAX_CODE_LINES),
      }

    case 'table':
      return {
        ...block,
        headers: block.headers.slice(0, DSL_LIMITS.MAX_TABLE_COLUMNS),
        rows: block.rows
          .slice(0, DSL_LIMITS.MAX_TABLE_ROWS)
          .map((row) => row.slice(0, DSL_LIMITS.MAX_TABLE_COLUMNS)),
      }

    case 'quote':
      return {
        ...block,
        text:
          block.text.length > DSL_LIMITS.MAX_QUOTE_LENGTH
            ? block.text.slice(0, DSL_LIMITS.MAX_QUOTE_LENGTH) + '...'
            : block.text,
      }

    default:
      return block
  }
}

/**
 * 截断整个演示文稿中的过长内容
 */
export function truncatePresentation(
  presentation: PresentationDSL
): PresentationDSL {
  return {
    slides: presentation.slides.map((slide) => ({
      ...slide,
      title: slide.title?.slice(0, DSL_LIMITS.MAX_TITLE_LENGTH),
      subtitle: slide.subtitle?.slice(0, DSL_LIMITS.MAX_SUBTITLE_LENGTH),
      content: slide.content
        ?.slice(0, DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_SLIDE)
        .map(truncateContentBlock),
      leftContent: slide.leftContent
        ?.slice(0, DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_COLUMN)
        .map(truncateContentBlock),
      rightContent: slide.rightContent
        ?.slice(0, DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_COLUMN)
        .map(truncateContentBlock),
    })),
  }
}

/**
 * 宽松模式解析
 * 尽可能解析，超限内容自动截断而非报错
 */
export function parseDSLLenient(input: string): DSLParseResult {
  // 先清理输入
  const cleaned = cleanJsonString(input)

  // 尝试解析JSON
  let jsonData: unknown
  try {
    jsonData = JSON.parse(cleaned)
  } catch (e) {
    try {
      const fixed = tryFixJson(cleaned)
      jsonData = JSON.parse(fixed)
    } catch {
      return {
        success: false,
        error: 'JSON解析失败',
        details: e instanceof Error ? e.message : String(e),
      }
    }
  }

  // 检查基本结构
  if (
    typeof jsonData !== 'object' ||
    jsonData === null ||
    !('slides' in jsonData)
  ) {
    return {
      success: false,
      error: '缺少slides字段',
      details: 'JSON必须包含slides数组',
    }
  }

  const data = jsonData as { slides: unknown[] }
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    return {
      success: false,
      error: 'slides必须是非空数组',
      details: null,
    }
  }

  // 尝试严格验证
  const strictResult = presentationDSLSchema.safeParse(jsonData)
  if (strictResult.success) {
    return {
      success: true,
      data: strictResult.data as PresentationDSL,
    }
  }

  // 严格验证失败，尝试宽松解析
  // 逐个幻灯片处理，跳过无法解析的
  const validSlides: SlideDSL[] = []

  for (const slide of data.slides) {
    try {
      // 基本字段检查
      if (typeof slide !== 'object' || slide === null) continue
      const s = slide as Record<string, unknown>

      // 必须有layout
      if (
        typeof s.layout !== 'string' ||
        !['title-only', 'title-content', 'two-column', 'section', 'comparison'].includes(
          s.layout
        )
      ) {
        // 默认使用 title-content
        s.layout = 'title-content'
      }

      // 构造有效的幻灯片对象
      const validSlide: SlideDSL = {
        layout: s.layout as SlideDSL['layout'],
        title: typeof s.title === 'string' ? s.title : undefined,
        subtitle: typeof s.subtitle === 'string' ? s.subtitle : undefined,
        content: Array.isArray(s.content)
          ? (s.content.filter(isValidContentBlock) as ContentBlock[])
          : undefined,
        leftContent: Array.isArray(s.leftContent)
          ? (s.leftContent.filter(isValidContentBlock) as ContentBlock[])
          : undefined,
        rightContent: Array.isArray(s.rightContent)
          ? (s.rightContent.filter(isValidContentBlock) as ContentBlock[])
          : undefined,
        notes: typeof s.notes === 'string' ? s.notes : undefined,
      }

      validSlides.push(validSlide)
    } catch {
      // 跳过无法处理的幻灯片
      continue
    }
  }

  if (validSlides.length === 0) {
    return {
      success: false,
      error: '没有有效的幻灯片',
      details: '所有幻灯片都无法解析',
    }
  }

  // 截断过长内容
  const presentation = truncatePresentation({ slides: validSlides })

  return {
    success: true,
    data: presentation,
  }
}

/**
 * 检查是否是有效的内容块
 */
function isValidContentBlock(block: unknown): boolean {
  if (typeof block !== 'object' || block === null) return false

  const b = block as Record<string, unknown>
  if (typeof b.type !== 'string') return false

  switch (b.type) {
    case 'paragraph':
      return typeof b.text === 'string'
    case 'bullets':
    case 'numbered':
      return Array.isArray(b.items)
    case 'code':
      return typeof b.language === 'string' && Array.isArray(b.lines)
    case 'table':
      return Array.isArray(b.headers) && Array.isArray(b.rows)
    case 'quote':
      return typeof b.text === 'string'
    default:
      return false
  }
}
