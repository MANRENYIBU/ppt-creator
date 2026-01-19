/**
 * DSL 内容生成器
 * 使用AI生成JSON DSL格式的幻灯片内容
 */

import { OutlineItem, ResourceData } from '@/types'
import { PresentationDSL, SlideDSL } from '@/types/slide-dsl'
import { getAIClient, ChatMessage } from './ai'
import { autoSplitSlides } from './dsl-parser'

// ============ 内容块校验 ============

/** 有效的内容块类型（共6种，不可扩展） */
const VALID_CONTENT_BLOCK_TYPES = new Set([
  'paragraph',
  'bullets',
  'numbered',
  'code',
  'table',
  'quote',
])

/**
 * 校验内容块数组中的所有类型是否有效
 */
function validateContentBlocks(blocks: unknown): boolean {
  if (!Array.isArray(blocks)) return true // 空数组或非数组视为有效

  for (const block of blocks) {
    if (typeof block !== 'object' || block === null) continue
    const blockType = (block as Record<string, unknown>).type
    if (typeof blockType === 'string' && !VALID_CONTENT_BLOCK_TYPES.has(blockType)) {
      console.warn(`[DSL Generator] Invalid content block type: "${blockType}"`)
      return false
    }
  }
  return true
}

/**
 * 校验幻灯片是否有效
 * 检查 content、leftContent、rightContent 中的内容块类型
 */
function validateSlide(slide: Record<string, unknown>): boolean {
  // 检查 content 字段
  if (!validateContentBlocks(slide.content)) {
    return false
  }
  // 检查 leftContent 字段
  if (!validateContentBlocks(slide.leftContent)) {
    return false
  }
  // 检查 rightContent 字段
  if (!validateContentBlocks(slide.rightContent)) {
    return false
  }
  return true
}

// ============ Prompt 模板 ============

// DSL Schema 规范（传递给AI）
const DSL_SCHEMA_SPEC = `
## Slide DSL Schema 规范

### 布局类型 (SlideLayout) - 幻灯片级别
type SlideLayout = 'title-content' | 'two-column' | 'comparison'

布局类型说明：
- title-content: 单栏布局，使用 content 字段放置内容块
- two-column: 双栏布局，使用 leftContent 和 rightContent 字段
- comparison: 对比布局，使用 leftContent 和 rightContent 字段，适合左右对比展示

注意：不要生成 'title-only' 或 'section' 布局，这些由系统自动生成。

### 内容块类型 (ContentBlock) - 共6种，不可扩展

⚠️ 重要：内容块类型只有以下6种，不要使用任何其他类型名称！

1. paragraph - 段落文本
{
  "type": "paragraph",
  "text": string,
  "emphasis"?: "normal" | "highlight" | "muted"
}

2. bullets - 无序列表
{
  "type": "bullets",
  "items": string[]
}

3. numbered - 有序列表
{
  "type": "numbered",
  "items": string[]
}

4. code - 代码块
{
  "type": "code",
  "language": string,      // 编程语言，如 "go", "python", "javascript"
  "lines": string[],       // 代码行数组（每行一个字符串）
  "caption"?: string
}

5. table - 表格（用于数据对比、特性对比等）
{
  "type": "table",
  "headers": string[],     // 表头数组
  "rows": string[][],      // 数据行数组
  "caption"?: string
}

6. quote - 引用
{
  "type": "quote",
  "text": string,
  "author"?: string
}

### 幻灯片结构 (SlideDSL)
{
  "layout": SlideLayout,           // 必填：title-content / two-column / comparison
  "title": string,                 // 必填：幻灯片标题
  "subtitle"?: string,
  "content"?: ContentBlock[],      // 用于 title-content 布局
  "leftContent"?: ContentBlock[],  // 用于 two-column/comparison 布局
  "rightContent"?: ContentBlock[], // 用于 two-column/comparison 布局
  "notes"?: string
}

### 使用示例

示例1: title-content 布局 + 表格对比
{
  "layout": "title-content",
  "title": "数组与切片对比",
  "content": [
    {
      "type": "table",
      "headers": ["特性", "数组", "切片"],
      "rows": [
        ["长度", "固定", "动态"],
        ["内存", "值类型", "引用类型"]
      ]
    }
  ]
}

示例2: comparison 布局（左右对比）
{
  "layout": "comparison",
  "title": "同步 vs 异步",
  "leftContent": [
    { "type": "paragraph", "text": "同步执行", "emphasis": "highlight" },
    { "type": "bullets", "items": ["阻塞调用", "顺序执行"] }
  ],
  "rightContent": [
    { "type": "paragraph", "text": "异步执行", "emphasis": "highlight" },
    { "type": "bullets", "items": ["非阻塞", "并发执行"] }
  ]
}
`

const SYSTEM_PROMPT_ZH = `你是专业的演示文稿设计师。你的任务是使用 add_slide 工具逐张添加幻灯片。

${DSL_SCHEMA_SPEC}

## 工具使用说明
- 必须使用 add_slide 工具添加每一张幻灯片
- 每次调用 add_slide 添加一张幻灯片
- 完成所有幻灯片后，调用 finish_generation 工具结束

## 重要规则
1. 只生成内容页（title-content / two-column / comparison 布局）
2. 不要生成 section 或 title-only 布局，这些由系统自动处理
3. 每张幻灯片必须有 title 字段
4. 内容块类型只能是：paragraph、bullets、numbered、code、table、quote
5. 数据对比请使用 table 内容块，不要发明新的内容块类型
6. 每个章节最多生成6张幻灯片，内容要精炼

## 排版建议
1. 代码块建议独占一张幻灯片
2. 表格建议独占一张幻灯片
3. 内容要简洁精炼，突出重点

## 内容质量要求
1. 内容类型多样化，不要全是bullets
2. 技术主题必须包含完整的代码示例
3. 数据对比使用 table 内容块
4. 每个要点要有深度内容，充分展开讲解`

const SYSTEM_PROMPT_EN = `You are a professional presentation designer. Your task is to use the add_slide tool to add slides one by one.

${DSL_SCHEMA_SPEC}

## Tool Usage Instructions
- You MUST use the add_slide tool to add each slide
- Call add_slide once for each slide
- After adding all slides, call finish_generation to complete

## Important Rules
1. Only generate content pages (title-content / two-column / comparison layouts)
2. Do NOT generate section or title-only layouts - these are handled by the system
3. Every slide MUST have a title field
4. Content block types can ONLY be: paragraph, bullets, numbered, code, table, quote
5. For data comparison, use the table content block - do not invent new content block types
6. Generate at most 6 slides per section, keep content concise

## Layout Suggestions
1. Code blocks should preferably be on their own slide
2. Tables should preferably be on their own slide
3. Keep content concise and highlight key points

## Content Quality Requirements
1. Diversify content types, avoid all bullets
2. Technical topics MUST include complete code examples
3. Use table content blocks for data comparison
4. Each point should have substantial depth with thorough explanation`

// ============ 主函数 ============

/**
 * 生成完整的DSL格式演示文稿
 */
export async function generateDSLPresentation(
  topic: string,
  outline: OutlineItem[],
  language: 'zh-CN' | 'en-US',
  resources: ResourceData | null,
): Promise<PresentationDSL> {
  const isZh = language === 'zh-CN'
  const slides: SlideDSL[] = []

  // 1. 封面页
  slides.push({
    layout: 'title-only',
    title: topic,
    subtitle: isZh
      ? '专业演示文稿 · AI生成'
      : 'Professional Presentation · AI Generated',
  })

  // 2. 目录页
  slides.push({
    layout: 'title-content',
    title: isZh ? '目录' : 'Contents',
    content: [
      {
        type: 'numbered',
        items: outline.map((item) => item.title),
      },
    ],
  })

  // 3. 构建资料上下文
  const resourceContext = buildResourceContext(resources)

  // 4. 为每个章节生成内容
  for (let i = 0; i < outline.length; i++) {
    const section = outline[i]
    const sectionSlides = await generateSectionDSL(
      topic,
      section,
      i + 1,
      outline.length,
      resourceContext,
      language,
    )
    slides.push(...sectionSlides)
  }

  // 5. 感谢页
  slides.push({
    layout: 'title-only',
    title: isZh ? '感谢聆听' : 'Thank You',
    subtitle: isZh ? '欢迎提问与交流' : 'Questions & Discussion',
  })

  return { slides }
}

/**
 * 为单个章节生成DSL内容（使用 Function Calling）
 */
async function generateSectionDSL(
  topic: string,
  section: OutlineItem,
  sectionIndex: number,
  totalSections: number,
  resourceContext: string,
  language: 'zh-CN' | 'en-US',
): Promise<SlideDSL[]> {
  const isZh = language === 'zh-CN'
  const aiClient = getAIClient()

  // 章节分隔页
  const sectionDivider: SlideDSL = {
    layout: 'section',
    title: section.title,
    subtitle: isZh
      ? `第 ${sectionIndex} / ${totalSections} 部分`
      : `Part ${sectionIndex} of ${totalSections}`,
  }

  const userPrompt = isZh
    ? `主题：${topic}

当前章节（第${sectionIndex}/${totalSections}部分）：${section.title}

本章节的核心要点：
${section.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}
${resourceContext ? `\n参考资料：\n${resourceContext}` : ''}

请使用 add_slide 工具为这个章节生成幻灯片。要求：
1. 本章节最多生成6张幻灯片，内容要精炼
2. 使用多种内容类型（段落、列表、代码、表格、引用）
3. 代码块和表格建议独占一张幻灯片
4. 完成后调用 finish_generation 工具`
    : `Topic: ${topic}

Current Section (Part ${sectionIndex}/${totalSections}): ${section.title}

Core Points:
${section.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}
${resourceContext ? `\nReference Materials:\n${resourceContext}` : ''}

Use the add_slide tool to generate slides for this section. Requirements:
1. Generate at most 6 slides for this section, keep content concise
2. Use diverse content types (paragraphs, lists, code, tables, quotes)
3. Code blocks and tables should have their own slides
4. Call finish_generation tool when done`

  const messages: ChatMessage[] = [
    { role: 'system', content: isZh ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN },
    { role: 'user', content: userPrompt },
  ]

  try {
    console.log(`[DSL Generator] Section ${sectionIndex}: Starting function calling...`)

    const rawSlides = await aiClient.generateSlidesWithTools(
      messages,
      (slide) => {
        // 校验内容块类型是否有效
        const isValid = validateSlide(slide)
        if (isValid) {
          console.log(`[DSL Generator] Section ${sectionIndex}: Added slide "${slide.title}"`)
        } else {
          console.warn(`[DSL Generator] Section ${sectionIndex}: Slide "${slide.title}" has invalid content blocks, requesting regeneration`)
        }
        return isValid
      }
    )

    console.log(`[DSL Generator] Section ${sectionIndex}: Generated ${rawSlides.length} slides via function calling`)

    if (rawSlides.length > 0) {
      // 将原始数据转换为 SlideDSL 类型
      const slides: SlideDSL[] = rawSlides.map((raw) => ({
        layout: (raw.layout as SlideDSL['layout']) || 'title-content',
        title: raw.title as string,
        subtitle: raw.subtitle as string | undefined,
        content: raw.content as SlideDSL['content'],
        leftContent: raw.leftContent as SlideDSL['leftContent'],
        rightContent: raw.rightContent as SlideDSL['rightContent'],
        notes: raw.notes as string | undefined,
      }))

      // 应用自动分页
      const { slides: processedSlides } = autoSplitSlides({ slides })

      return [sectionDivider, ...processedSlides]
    }
  } catch (e) {
    console.error('Failed to generate section DSL with function calling:', e)
  }

  // 降级方案 - 每个要点生成一张幻灯片
  console.log(`[DSL Generator] Section ${sectionIndex}: Using fallback generation`)
  return [sectionDivider, ...generateFallbackDSL(section, isZh)]
}

/**
 * 构建资料上下文（优先使用 AI 总结）
 */
function buildResourceContext(resources: ResourceData | null): string {
  if (!resources) {
    return ''
  }

  // 优先使用 AI 总结
  if (resources.summary) {
    return resources.summary
  }

  // 降级：使用原始资料
  if (resources.results.length === 0) {
    return ''
  }

  return resources.results
    .slice(0, 3) // 只取前3条
    .map((r) => {
      const content = r.rawContent || r.content
      const truncated =
        content.length > 800 ? content.slice(0, 800) + '...' : content
      return `【${r.title}】\n${truncated}`
    })
    .join('\n\n')
}

/**
 * 降级方案：为每个要点生成一张幻灯片
 */
function generateFallbackDSL(section: OutlineItem, isZh: boolean): SlideDSL[] {
  const slides: SlideDSL[] = []

  // 为每个要点生成一张幻灯片
  for (const point of section.points) {
    slides.push({
      layout: 'title-content',
      title: point,
      content: [
        {
          type: 'paragraph',
          text: isZh
            ? `${point}是${section.title}的核心内容之一。`
            : `${point} is one of the core aspects of ${section.title}.`,
        },
        {
          type: 'bullets',
          items: isZh
            ? ['核心概念', '关键要点', '应用场景']
            : ['Core concept', 'Key points', 'Applications'],
        },
      ],
    })
  }

  return slides
}
