/**
 * DSL 内容生成器
 * 使用AI生成JSON DSL格式的幻灯片内容
 */

import { OutlineItem, ResourceData, DURATION_TO_SLIDES } from '@/types'
import { PresentationDSL, SlideDSL, DSL_LIMITS } from '@/types/slide-dsl'
import { getAIClient, ChatMessage } from './ai'
import { parseDSL, parseDSLLenient } from './dsl-parser'

// ============ Prompt 模板 ============

const SYSTEM_PROMPT_ZH = `你是专业的演示文稿设计师。根据章节大纲生成幻灯片内容。

输出格式为JSON，结构如下：
{
  "slides": [
    {
      "layout": "title-content",
      "title": "幻灯片标题",
      "content": [
        { "type": "paragraph", "text": "段落文本..." },
        { "type": "bullets", "items": ["要点1", "要点2"] },
        { "type": "code", "language": "python", "lines": ["def foo():", "    pass"] },
        { "type": "table", "headers": ["列1", "列2"], "rows": [["值1", "值2"]] },
        { "type": "quote", "text": "引用内容", "author": "作者" }
      ]
    }
  ]
}

布局类型(layout)：
- "section": 章节分隔页，只有标题，用于开启新章节
- "title-content": 标题+内容，最常用
- "two-column": 双栏布局，使用leftContent和rightContent

内容块类型：
- paragraph: 文本段落（不超过${DSL_LIMITS.MAX_PARAGRAPH_LENGTH}字）
- bullets: 无序列表（不超过${DSL_LIMITS.MAX_LIST_ITEMS}项）
- numbered: 有序列表（不超过${DSL_LIMITS.MAX_LIST_ITEMS}项）
- code: 代码块，用lines数组表示每行（不超过${DSL_LIMITS.MAX_CODE_LINES}行）
- table: 表格（不超过${DSL_LIMITS.MAX_TABLE_COLUMNS}列×${DSL_LIMITS.MAX_TABLE_ROWS}行）
- quote: 引用

要求：
1. 每张幻灯片最多${DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_SLIDE}个内容块
2. 内容类型要多样化，不要全是bullets
3. 技术主题必须包含代码示例
4. 数据对比使用表格
5. 重要观点使用引用

只输出JSON，不要其他内容。`

const SYSTEM_PROMPT_EN = `You are a professional presentation designer. Generate slide content based on section outline.

Output format is JSON with the following structure:
{
  "slides": [
    {
      "layout": "title-content",
      "title": "Slide Title",
      "content": [
        { "type": "paragraph", "text": "Paragraph text..." },
        { "type": "bullets", "items": ["Point 1", "Point 2"] },
        { "type": "code", "language": "python", "lines": ["def foo():", "    pass"] },
        { "type": "table", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"]] },
        { "type": "quote", "text": "Quote content", "author": "Author" }
      ]
    }
  ]
}

Layout types:
- "section": Section divider, title only, for starting new chapters
- "title-content": Title + content, most common
- "two-column": Two-column layout, uses leftContent and rightContent

Content block types:
- paragraph: Text paragraph (max ${DSL_LIMITS.MAX_PARAGRAPH_LENGTH} chars)
- bullets: Unordered list (max ${DSL_LIMITS.MAX_LIST_ITEMS} items)
- numbered: Ordered list (max ${DSL_LIMITS.MAX_LIST_ITEMS} items)
- code: Code block, use lines array (max ${DSL_LIMITS.MAX_CODE_LINES} lines)
- table: Table (max ${DSL_LIMITS.MAX_TABLE_COLUMNS} cols × ${DSL_LIMITS.MAX_TABLE_ROWS} rows)
- quote: Quotation

Requirements:
1. Maximum ${DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_SLIDE} content blocks per slide
2. Diversify content types, avoid all bullets
3. Technical topics must include code examples
4. Use tables for data comparison
5. Use quotes for important insights

Output only JSON, no other text.`

// ============ 主函数 ============

/**
 * 生成完整的DSL格式演示文稿
 */
export async function generateDSLPresentation(
  topic: string,
  outline: OutlineItem[],
  language: 'zh-CN' | 'en-US',
  resources: ResourceData | null,
  duration: number = 15
): Promise<PresentationDSL> {
  const isZh = language === 'zh-CN'
  const slides: SlideDSL[] = []

  // 计算每个章节的目标幻灯片数
  const slideCount = DURATION_TO_SLIDES[duration] || { min: 12, max: 15 }
  const targetTotal = Math.floor((slideCount.min + slideCount.max) / 2)
  const fixedSlides = 3 // 封面 + 目录 + 感谢
  const contentSlidesTotal = targetTotal - fixedSlides
  const slidesPerSection = Math.max(2, Math.floor(contentSlidesTotal / outline.length))

  // 1. 封面页
  slides.push({
    layout: 'title-only',
    title: topic,
    subtitle: isZh ? '专业演示文稿 · AI生成' : 'Professional Presentation · AI Generated',
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
      slidesPerSection,
      resourceContext,
      language
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
 * 为单个章节生成DSL内容
 */
async function generateSectionDSL(
  topic: string,
  section: OutlineItem,
  sectionIndex: number,
  totalSections: number,
  targetSlideCount: number,
  resourceContext: string,
  language: 'zh-CN' | 'en-US'
): Promise<SlideDSL[]> {
  const isZh = language === 'zh-CN'
  const aiClient = getAIClient()

  // 章节分隔页
  const sectionDivider: SlideDSL = {
    layout: 'section',
    title: section.title,
    subtitle: isZh ? `第 ${sectionIndex} / ${totalSections} 部分` : `Part ${sectionIndex} of ${totalSections}`,
  }

  // 构建用户提示
  const userPrompt = isZh
    ? `主题：${topic}

当前章节（第${sectionIndex}/${totalSections}部分）：${section.title}
章节要点：
${section.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

需要生成：${targetSlideCount}张内容幻灯片（不包含章节分隔页）
${resourceContext ? `\n参考资料：\n${resourceContext}` : ''}

请生成${targetSlideCount}张幻灯片的JSON内容。确保：
- 内容丰富，每个要点都有详细展开
- 根据内容特点选择合适的内容块类型
- 如果涉及代码，必须包含可运行的代码示例
- 如果涉及对比，使用表格展示`
    : `Topic: ${topic}

Current Section (Part ${sectionIndex}/${totalSections}): ${section.title}
Section Points:
${section.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Generate: ${targetSlideCount} content slides (excluding section divider)
${resourceContext ? `\nReference Materials:\n${resourceContext}` : ''}

Generate JSON content for ${targetSlideCount} slides. Ensure:
- Rich content with detailed expansion of each point
- Choose appropriate content block types based on content
- Include runnable code examples for technical topics
- Use tables for comparisons`

  const messages: ChatMessage[] = [
    { role: 'system', content: isZh ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN },
    { role: 'user', content: userPrompt },
  ]

  try {
    const response = await aiClient.chat(messages)

    // 尝试解析JSON
    let result = parseDSL(response.content)

    // 如果严格解析失败，尝试宽松解析
    if (!result.success) {
      console.warn('Strict DSL parse failed, trying lenient mode:', result.error)
      result = parseDSLLenient(response.content)
    }

    if (result.success && result.data.slides.length > 0) {
      return [sectionDivider, ...result.data.slides]
    }
  } catch (e) {
    console.error('Failed to generate section DSL:', e)
  }

  // 降级方案
  return [sectionDivider, ...generateFallbackDSL(section, targetSlideCount, isZh)]
}

/**
 * 构建资料上下文
 */
function buildResourceContext(resources: ResourceData | null): string {
  if (!resources || resources.results.length === 0) {
    return ''
  }

  return resources.results
    .slice(0, 3) // 只取前3条
    .map((r) => {
      const content = r.rawContent || r.content
      const truncated = content.length > 800 ? content.slice(0, 800) + '...' : content
      return `【${r.title}】\n${truncated}`
    })
    .join('\n\n')
}

/**
 * 降级方案：生成基础DSL
 */
function generateFallbackDSL(
  section: OutlineItem,
  targetCount: number,
  isZh: boolean
): SlideDSL[] {
  const slides: SlideDSL[] = []

  // 为每个要点生成一张幻灯片
  for (let i = 0; i < Math.min(section.points.length, targetCount); i++) {
    slides.push({
      layout: 'title-content',
      title: section.points[i],
      content: [
        {
          type: 'paragraph',
          text: isZh
            ? `${section.points[i]}是${section.title}的重要组成部分，对理解整体概念至关重要。`
            : `${section.points[i]} is a key component of ${section.title}, essential for understanding the overall concept.`,
        },
        {
          type: 'bullets',
          items: isZh
            ? ['核心概念解析', '关键要素说明', '实践应用建议']
            : ['Core concept analysis', 'Key elements explained', 'Practical applications'],
        },
      ],
    })
  }

  // 如果还需要更多幻灯片
  while (slides.length < targetCount) {
    slides.push({
      layout: 'title-content',
      title: isZh
        ? `${section.title} - 深入分析`
        : `${section.title} - Deep Dive`,
      content: [
        {
          type: 'bullets',
          items: isZh
            ? ['详细分析', '案例研究', '关键启示', '总结要点']
            : ['Detailed analysis', 'Case study', 'Key insights', 'Summary points'],
        },
      ],
    })
  }

  return slides
}
