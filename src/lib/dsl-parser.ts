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
 * 尝试修复被截断的JSON
 * 通过计算括号配对来找到最后一个完整的对象
 */
function tryFixTruncatedJson(input: string): string {
  // 尝试找到 slides 数组的开始
  const slidesMatch = input.match(/"slides"\s*:\s*\[/)
  if (!slidesMatch || slidesMatch.index === undefined) {
    return input
  }

  const startIndex = slidesMatch.index + slidesMatch[0].length
  let bracketCount = 1  // 已经有一个 [
  let braceCount = 0
  let lastCompleteSlideEnd = -1
  let inString = false
  let escapeNext = false

  for (let i = startIndex; i < input.length; i++) {
    const char = input[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      braceCount++
    } else if (char === '}') {
      braceCount--
      // 如果一个对象完成了，记录位置
      if (braceCount === 0 && bracketCount === 1) {
        lastCompleteSlideEnd = i
      }
    } else if (char === '[') {
      bracketCount++
    } else if (char === ']') {
      bracketCount--
    }
  }

  // 如果括号不匹配，尝试在最后一个完整对象处截断
  if (bracketCount !== 0 || braceCount !== 0) {
    if (lastCompleteSlideEnd > 0) {
      console.log(`[DSL Parser] Truncating JSON at position ${lastCompleteSlideEnd}`)
      // 截断到最后一个完整的 slide 对象，然后关闭数组和外层对象
      const truncated = input.slice(0, lastCompleteSlideEnd + 1)
      return truncated + ']}'
    }
  }

  return input
}

/**
 * 解析 Markdown 格式的表格
 * 输入示例: "| 列1 | 列2 |\n|---|---|\n| 值1 | 值2 |"
 */
function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter(line => line.trim().length > 0)

  if (lines.length < 2) return null

  // 解析表头（第一行）
  const headerLine = lines[0]
  if (!headerLine.includes('|')) return null

  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0)

  if (headers.length === 0) return null

  // 跳过分隔行（第二行，格式如 |---|---|）
  let dataStartIndex = 1
  if (lines[1] && lines[1].match(/^\|?\s*[-:]+\s*\|/)) {
    dataStartIndex = 2
  }

  // 解析数据行
  const rows: string[][] = []
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('|')) continue

    const cells = line
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)

    if (cells.length > 0) {
      rows.push(cells)
    }
  }

  if (rows.length === 0) return null

  return { headers, rows }
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
        lines: block.lines.slice(0, DSL_LIMITS.MAX_CODE_LINES).map((line) =>
          line.length > DSL_LIMITS.MAX_CODE_LINE_LENGTH
            ? line.slice(0, DSL_LIMITS.MAX_CODE_LINE_LENGTH) + '...'
            : line
        ),
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
 * 自动分页：将超出限制的内容拆分到多张幻灯片
 * 替代原来的截断方案，保留完整内容
 */
export function autoSplitSlides(presentation: PresentationDSL): PresentationDSL {
  const result: SlideDSL[] = []

  for (const slide of presentation.slides) {
    const splitSlides = splitSingleSlide(slide)
    result.push(...splitSlides)
  }

  return { slides: result }
}

/**
 * 拆分单张幻灯片
 */
function splitSingleSlide(slide: SlideDSL): SlideDSL[] {
  // 对于非内容页，直接返回
  if (slide.layout === 'title-only' || slide.layout === 'section') {
    return [slide]
  }

  // 对于双栏布局，暂不拆分（复杂度较高）
  if (slide.layout === 'two-column' || slide.layout === 'comparison') {
    return [slide]
  }

  // 处理 title-content 布局
  if (!slide.content || slide.content.length === 0) {
    return [slide]
  }

  // 首先拆分超大的内容块
  const expandedBlocks: ContentBlock[] = []
  for (const block of slide.content) {
    const splitBlocks = splitContentBlock(block)
    expandedBlocks.push(...splitBlocks)
  }

  // 基于内容块大小的智能分页
  return splitByContentSize(slide, expandedBlocks)
}

/**
 * 计算内容块的实际渲染高度（英寸）
 * 基于 dsl-renderer.ts 中的实际渲染逻辑
 */
function getBlockHeight(block: ContentBlock): number {
  switch (block.type) {
    case 'paragraph':
      // fontSize: 16, 每50字符约0.25英寸
      const lines = Math.ceil(block.text.length / 50)
      return Math.max(0.4, lines * 0.25)

    case 'bullets':
    case 'numbered':
      // itemHeight = 0.35英寸/项
      return block.items.length * 0.35

    case 'table':
      // rowHeight = 0.35英寸, 表头1行 + 数据行
      const tableHeight = (block.rows.length + 1) * 0.35
      // 如果有caption再加0.3
      return block.caption ? tableHeight + 0.3 : tableHeight

    case 'code':
      // lineHeight = 0.16, padding = 0.24, 最大3.5英寸
      const codeHeight = Math.min(block.lines.length * 0.16 + 0.24, 3.5)
      return block.caption ? codeHeight + 0.3 : codeHeight

    case 'quote':
      // 引用约0.6-0.75英寸
      const quoteLines = Math.ceil(block.text.length / 45)
      return Math.max(0.5, quoteLines * 0.25) + (block.author ? 0.35 : 0.1)

    default:
      return 0.5
  }
}

/**
 * 基于实际高度的智能分页
 * 可用内容高度 = contentEndY - contentStartY = 5.2 - 1.3 = 3.9英寸
 * 实际放宽到 4.2 英寸，因为代码块字体小(8pt)，有一定弹性空间
 */
const MAX_CONTENT_HEIGHT = 4.2  // 英寸（放宽后）
const MIN_CONTENT_HEIGHT = 0.8  // 最小内容高度，少于此值尝试合并
const BLOCK_SPACING = 0.15      // 块间距

function splitByContentSize(slide: SlideDSL, blocks: ContentBlock[]): SlideDSL[] {
  // 快速路径：单个内容块直接返回
  if (blocks.length <= 1) {
    return [{ ...slide, content: blocks }]
  }

  // 第一步：按顺序分配内容块到各页
  const pages: ContentBlock[][] = []
  let currentBlocks: ContentBlock[] = []
  let currentHeight = 0

  for (const block of blocks) {
    const blockHeight = getBlockHeight(block)

    // 如果当前幻灯片为空，必须添加至少一个块
    if (currentBlocks.length === 0) {
      currentBlocks.push(block)
      currentHeight = blockHeight
      continue
    }

    // 计算添加这个块后的总高度（包括间距）
    const newHeight = currentHeight + BLOCK_SPACING + blockHeight

    // 如果超过可用高度，开始新的幻灯片
    if (newHeight > MAX_CONTENT_HEIGHT) {
      pages.push(currentBlocks)
      currentBlocks = [block]
      currentHeight = blockHeight
    } else {
      currentBlocks.push(block)
      currentHeight = newHeight
    }
  }

  // 添加最后一页
  if (currentBlocks.length > 0) {
    pages.push(currentBlocks)
  }

  // 第二步：检查最后一页是否内容太少，尝试合并
  if (pages.length > 1) {
    const lastPage = pages[pages.length - 1]
    const lastPageHeight = lastPage.reduce(
      (sum, b, i) => sum + getBlockHeight(b) + (i > 0 ? BLOCK_SPACING : 0),
      0
    )

    // 如果最后一页内容太少，合并到前一页
    if (lastPageHeight < MIN_CONTENT_HEIGHT) {
      const prevPage = pages[pages.length - 2]
      pages[pages.length - 2] = [...prevPage, ...lastPage]
      pages.pop()
      console.log(`[DSL Parser] Merged last page (${lastPageHeight.toFixed(2)}") into previous page`)
    }
  }

  // 第三步：生成幻灯片
  if (pages.length === 1) {
    return [{ ...slide, content: pages[0] }]
  }

  return pages.map((pageBlocks, i) => ({
    ...slide,
    title: `${slide.title || ''} (${i + 1}/${pages.length})`,
    content: pageBlocks,
  }))
}

/**
 * 拆分超大的内容块
 */
function splitContentBlock(block: ContentBlock): ContentBlock[] {
  switch (block.type) {
    case 'code':
      return splitCodeBlock(block)
    case 'bullets':
      return splitListBlock(block, 'bullets')
    case 'numbered':
      return splitListBlock(block, 'numbered')
    case 'table':
      return splitTableBlock(block)
    default:
      return [block]
  }
}

/**
 * 拆分超长代码块
 */
function splitCodeBlock(block: ContentBlock & { type: 'code' }): ContentBlock[] {
  if (block.lines.length <= DSL_LIMITS.MAX_CODE_LINES) {
    return [block]
  }

  const result: ContentBlock[] = []
  const totalParts = Math.ceil(block.lines.length / DSL_LIMITS.MAX_CODE_LINES)

  for (let i = 0; i < totalParts; i++) {
    const start = i * DSL_LIMITS.MAX_CODE_LINES
    const end = start + DSL_LIMITS.MAX_CODE_LINES
    const partLines = block.lines.slice(start, end)

    result.push({
      type: 'code',
      language: block.language,
      lines: partLines,
      caption: totalParts > 1
        ? `${block.caption || ''} (${i + 1}/${totalParts})`.trim()
        : block.caption,
    })
  }

  return result
}

/**
 * 拆分超长列表
 */
function splitListBlock(
  block: ContentBlock & { type: 'bullets' | 'numbered' },
  type: 'bullets' | 'numbered'
): ContentBlock[] {
  if (block.items.length <= DSL_LIMITS.MAX_LIST_ITEMS) {
    return [block]
  }

  const result: ContentBlock[] = []
  const totalParts = Math.ceil(block.items.length / DSL_LIMITS.MAX_LIST_ITEMS)

  for (let i = 0; i < totalParts; i++) {
    const start = i * DSL_LIMITS.MAX_LIST_ITEMS
    const end = start + DSL_LIMITS.MAX_LIST_ITEMS
    const partItems = block.items.slice(start, end)

    result.push({
      type,
      items: partItems,
    } as ContentBlock)
  }

  return result
}

/**
 * 拆分超大表格（按行拆分）
 */
function splitTableBlock(block: ContentBlock & { type: 'table' }): ContentBlock[] {
  if (block.rows.length <= DSL_LIMITS.MAX_TABLE_ROWS) {
    return [block]
  }

  const result: ContentBlock[] = []
  const totalParts = Math.ceil(block.rows.length / DSL_LIMITS.MAX_TABLE_ROWS)

  for (let i = 0; i < totalParts; i++) {
    const start = i * DSL_LIMITS.MAX_TABLE_ROWS
    const end = start + DSL_LIMITS.MAX_TABLE_ROWS
    const partRows = block.rows.slice(start, end)

    result.push({
      type: 'table',
      headers: block.headers,
      rows: partRows,
      caption: totalParts > 1
        ? `${block.caption || ''} (${i + 1}/${totalParts})`.trim()
        : block.caption,
    })
  }

  return result
}

/**
 * 截断整个演示文稿中的过长内容（已废弃，保留兼容）
 * @deprecated 使用 autoSplitSlides 替代
 */
export function truncatePresentation(
  presentation: PresentationDSL
): PresentationDSL {
  return autoSplitSlides(presentation)
}

/**
 * 宽松模式解析
 * 尽可能解析，超限内容自动截断而非报错
 */
export function parseDSLLenient(input: string): DSLParseResult {
  // 先清理输入
  let cleaned = cleanJsonString(input)

  // 尝试解析JSON
  let jsonData: unknown
  try {
    jsonData = JSON.parse(cleaned)
  } catch (e) {
    // 尝试修复常见错误
    try {
      const fixed = tryFixJson(cleaned)
      jsonData = JSON.parse(fixed)
    } catch {
      // 尝试修复被截断的JSON
      try {
        const truncateFixed = tryFixTruncatedJson(cleaned)
        jsonData = JSON.parse(truncateFixed)
      } catch {
        // 最后尝试：提取 JSON 数组或对象
        const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
        if (jsonMatch) {
          try {
            // 对提取的JSON也尝试截断修复
            const extracted = tryFixTruncatedJson(jsonMatch[1])
            jsonData = JSON.parse(extracted)
          } catch {
            return {
              success: false,
              error: 'JSON解析失败',
              details: e instanceof Error ? e.message : String(e),
            }
          }
        } else {
          return {
            success: false,
            error: 'JSON解析失败',
            details: e instanceof Error ? e.message : String(e),
          }
        }
      }
    }
  }

  // 处理不同的 JSON 结构
  let slidesArray: unknown[]

  if (Array.isArray(jsonData)) {
    // 直接是数组格式
    slidesArray = jsonData
  } else if (
    typeof jsonData === 'object' &&
    jsonData !== null &&
    'slides' in jsonData
  ) {
    // 标准 { slides: [...] } 格式
    const data = jsonData as { slides: unknown }
    if (!Array.isArray(data.slides)) {
      return {
        success: false,
        error: 'slides必须是数组',
        details: null,
      }
    }
    slidesArray = data.slides
  } else {
    return {
      success: false,
      error: '无法识别的JSON结构',
      details: '需要 { slides: [...] } 或直接的数组格式',
    }
  }

  if (slidesArray.length === 0) {
    return {
      success: false,
      error: 'slides数组为空',
      details: null,
    }
  }

  // 尝试严格验证（使用标准格式）
  const strictResult = presentationDSLSchema.safeParse({ slides: slidesArray })
  if (strictResult.success) {
    return {
      success: true,
      data: strictResult.data as PresentationDSL,
    }
  }

  // 严格验证失败，尝试宽松解析
  // 逐个幻灯片处理，跳过无法解析的
  const validSlides: SlideDSL[] = []

  for (const slide of slidesArray) {
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
          ? (s.content.map(normalizeContentBlock).filter((b): b is ContentBlock => b !== null))
          : undefined,
        leftContent: Array.isArray(s.leftContent)
          ? (s.leftContent.map(normalizeContentBlock).filter((b): b is ContentBlock => b !== null))
          : undefined,
        rightContent: Array.isArray(s.rightContent)
          ? (s.rightContent.map(normalizeContentBlock).filter((b): b is ContentBlock => b !== null))
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
 * 检查并修复内容块，返回有效的内容块或 null
 */
function normalizeContentBlock(block: unknown): ContentBlock | null {
  if (typeof block !== 'object' || block === null) return null

  const b = block as Record<string, unknown>
  if (typeof b.type !== 'string') return null

  switch (b.type) {
    case 'paragraph':
      if (typeof b.text === 'string') {
        return {
          type: 'paragraph',
          text: b.text,
          emphasis: ['normal', 'highlight', 'muted'].includes(b.emphasis as string)
            ? (b.emphasis as 'normal' | 'highlight' | 'muted')
            : undefined,
        }
      }
      return null

    case 'bullets':
    case 'numbered':
      if (Array.isArray(b.items) && b.items.length > 0) {
        return {
          type: b.type,
          items: b.items.filter((item): item is string => typeof item === 'string'),
        } as ContentBlock
      }
      return null

    case 'code': {
      // 尝试多种格式
      let lines: string[] = []
      let language = 'text'

      // 优先使用 lines 数组
      if (Array.isArray(b.lines) && b.lines.length > 0) {
        lines = b.lines.filter((line): line is string => typeof line === 'string')
      }
      // 备选：使用 code 字符串（按换行分割）
      else if (typeof b.code === 'string') {
        lines = b.code.split('\n')
      }
      // 备选：使用 content 字符串
      else if (typeof b.content === 'string') {
        lines = b.content.split('\n')
      }
      // 备选：使用 text 字符串
      else if (typeof b.text === 'string') {
        lines = b.text.split('\n')
      }

      if (lines.length === 0) return null

      // 获取语言
      if (typeof b.language === 'string' && b.language.length > 0) {
        language = b.language
      } else if (typeof b.lang === 'string' && b.lang.length > 0) {
        language = b.lang
      }

      return {
        type: 'code',
        language,
        lines,
        caption: typeof b.caption === 'string' ? b.caption : undefined,
      }
    }

    case 'table': {
      let headers: string[] = []
      let rows: string[][] = []

      // 获取表头
      if (Array.isArray(b.headers) && b.headers.length > 0) {
        headers = b.headers.filter((h): h is string => typeof h === 'string')
      }

      // 获取数据行
      if (Array.isArray(b.rows)) {
        rows = b.rows
          .filter((row): row is unknown[] => Array.isArray(row))
          .map((row) => row.map((cell) => String(cell)))
      }
      // 备选：使用 data 字段
      else if (Array.isArray(b.data)) {
        rows = b.data
          .filter((row): row is unknown[] => Array.isArray(row))
          .map((row) => row.map((cell) => String(cell)))
      }

      // 备选：解析 Markdown 表格格式（AI 可能生成这种格式）
      if ((headers.length === 0 || rows.length === 0) && typeof b.text === 'string') {
        const parsed = parseMarkdownTable(b.text)
        if (parsed) {
          headers = parsed.headers
          rows = parsed.rows
        }
      }

      // 备选：从第一行数据推断表头
      if (headers.length === 0 && rows.length > 0) {
        const colCount = rows[0].length
        headers = Array.from({ length: colCount }, (_, i) => `列${i + 1}`)
      }

      if (headers.length === 0 || rows.length === 0) return null

      return {
        type: 'table',
        headers,
        rows,
        caption: typeof b.caption === 'string' ? b.caption : undefined,
      }
    }

    case 'quote':
      if (typeof b.text === 'string') {
        return {
          type: 'quote',
          text: b.text,
          author: typeof b.author === 'string' ? b.author : undefined,
        }
      }
      // 备选：使用 content 字段
      if (typeof b.content === 'string') {
        return {
          type: 'quote',
          text: b.content,
          author: typeof b.author === 'string' ? b.author : undefined,
        }
      }
      return null

    default:
      return null
  }
}

/**
 * 检查是否是有效的内容块（简单检查，用于过滤）
 */
function isValidContentBlock(block: unknown): boolean {
  return normalizeContentBlock(block) !== null
}
