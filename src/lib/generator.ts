import {
  OutlineItem,
  SlideContent,
  ResourceData,
  DURATION_TO_SLIDES,
} from '@/types'
import { getAIClient, ChatMessage } from './ai'
import { getSearchClient, isSearchAvailable } from './search'
import { generatePPTX } from './pptx'
import { enrichSearchResults } from './scraper'

// ============ 阶段1: 收集资料 ============

/**
 * 搜索并保存相关资料（包含完整网页内容）
 */
export async function collectResources(
  topic: string,
  language: 'zh-CN' | 'en-US'
): Promise<ResourceData | null> {
  if (!isSearchAvailable()) {
    console.log('Search not available, skipping resource collection')
    return null
  }

  const searchClient = getSearchClient()
  const query =
    language === 'zh-CN'
      ? `${topic} 详细介绍 专业资料`
      : `${topic} detailed overview professional`

  try {
    const response = await searchClient.search(query, 5)

    // 为没有rawContent的结果抓取网页内容
    const enrichedResults = await enrichSearchResults(response.results, 3)

    return {
      query,
      results: enrichedResults,
      collectedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Search failed:', error)
    return null
  }
}

// ============ 阶段2: 生成大纲 ============

/**
 * 基于资料生成PPT大纲
 */
export async function generateOutline(
  topic: string,
  language: 'zh-CN' | 'en-US',
  duration: number,
  resources: ResourceData | null
): Promise<OutlineItem[]> {
  const aiClient = getAIClient()
  const slideCount = DURATION_TO_SLIDES[duration]
  const targetSlides = Math.floor((slideCount.min + slideCount.max) / 2)
  const contentSlides = targetSlides - 3 // 减去封面、目录、感谢页

  // 构建资料上下文（优先使用完整内容）
  const resourceContext =
    resources && resources.results.length > 0
      ? `\n\n【参考资料】\n${resources.results
          .map((r, i) => {
            const content = r.rawContent || r.content
            // 截断过长的内容
            const truncated = content.length > 2000 ? content.slice(0, 2000) + '...' : content
            return `${i + 1}. ${r.title}\n   来源: ${r.url}\n   ${truncated}`
          })
          .join('\n\n')}`
      : ''

  const systemPrompt =
    language === 'zh-CN'
      ? `你是一个专业的演示文稿设计师，擅长将复杂主题组织成清晰的PPT结构。

任务：为主题"${topic}"生成一个${contentSlides}个章节的PPT大纲。

要求：
1. 每个章节包含标题和3-4个要点
2. 内容要专业、有逻辑、有深度
3. 基于提供的参考资料（如有）确保内容准确
4. 章节之间要有逻辑递进关系

返回JSON格式：
{
  "outline": [
    {"title": "章节标题", "points": ["要点1", "要点2", "要点3"]}
  ]
}

只返回JSON，不要其他内容。`
      : `You are a professional presentation designer skilled at organizing complex topics into clear PPT structures.

Task: Generate a ${contentSlides}-section PPT outline for "${topic}".

Requirements:
1. Each section has a title and 3-4 key points
2. Content should be professional, logical, and insightful
3. Use provided reference materials (if any) for accuracy
4. Sections should have logical progression

Return JSON format:
{
  "outline": [
    {"title": "Section Title", "points": ["Point 1", "Point 2", "Point 3"]}
  ]
}

Return only JSON, no other text.`

  const userPrompt = `${resourceContext}\n\n请生成大纲。`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  try {
    const response = await aiClient.chat(messages)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.outline && Array.isArray(parsed.outline)) {
        return parsed.outline
      }
    }
  } catch (e) {
    console.error('Failed to generate outline:', e)
  }

  return generateDefaultOutline(topic, language, contentSlides)
}

// ============ 阶段3: 生成详细内容 ============

/**
 * 为每页生成详细内容
 */
export async function generateSlideContents(
  topic: string,
  outline: OutlineItem[],
  language: 'zh-CN' | 'en-US',
  resources: ResourceData | null
): Promise<SlideContent[]> {
  const aiClient = getAIClient()
  const slides: SlideContent[] = []
  const isZh = language === 'zh-CN'

  // 1. 封面页
  slides.push({
    type: 'cover',
    title: topic,
    subtitle: isZh ? '专业演示文稿' : 'Professional Presentation',
  })

  // 2. 目录页
  slides.push({
    type: 'toc',
    title: isZh ? '目录' : 'Contents',
    points: outline.map((item) => item.title),
  })

  // 3. 内容页 - 使用AI生成详细内容
  const resourceContext =
    resources && resources.results.length > 0
      ? resources.results
          .map((r) => {
            const content = r.rawContent || r.content
            const truncated = content.length > 1500 ? content.slice(0, 1500) + '...' : content
            return `- ${r.title} (${r.url}):\n  ${truncated}`
          })
          .join('\n\n')
      : ''

  for (let i = 0; i < outline.length; i++) {
    const section = outline[i]

    // 为每个章节生成详细说明
    const detailedContent = await generateSectionDetails(
      aiClient,
      topic,
      section,
      resourceContext,
      language
    )

    slides.push({
      type: 'content',
      title: section.title,
      points: detailedContent.points,
      details: detailedContent.details,
      notes: detailedContent.notes,
    })
  }

  // 4. 总结页
  const summaryPoints = await generateSummary(
    aiClient,
    topic,
    outline,
    language
  )
  slides.push({
    type: 'summary',
    title: isZh ? '总结' : 'Summary',
    points: summaryPoints,
  })

  // 5. 感谢页
  slides.push({
    type: 'thanks',
    title: isZh ? '感谢聆听' : 'Thank You',
    subtitle: isZh ? '欢迎提问交流' : 'Questions & Discussion',
  })

  return slides
}

/**
 * 生成章节详细内容
 */
async function generateSectionDetails(
  aiClient: ReturnType<typeof getAIClient>,
  topic: string,
  section: OutlineItem,
  resourceContext: string,
  language: 'zh-CN' | 'en-US'
): Promise<{ points: string[]; details: string[]; notes: string }> {
  const isZh = language === 'zh-CN'

  const systemPrompt = isZh
    ? `你是专业的内容撰写专家。为PPT章节生成详细内容。

要求：
1. 优化要点表述，使其更精炼专业
2. 为每个要点提供一句详细说明（15-25字）
3. 生成演讲备注（50-80字）

返回JSON：
{
  "points": ["优化后的要点1", "优化后的要点2", "优化后的要点3"],
  "details": ["要点1的详细说明", "要点2的详细说明", "要点3的详细说明"],
  "notes": "演讲备注内容"
}`
    : `You are a professional content writer. Generate detailed content for a PPT section.

Requirements:
1. Refine key points to be more concise and professional
2. Provide one detailed explanation for each point (10-20 words)
3. Generate speaker notes (40-60 words)

Return JSON:
{
  "points": ["Refined point 1", "Refined point 2", "Refined point 3"],
  "details": ["Detail for point 1", "Detail for point 2", "Detail for point 3"],
  "notes": "Speaker notes content"
}`

  const userPrompt = isZh
    ? `主题：${topic}
章节：${section.title}
原始要点：${section.points.join('、')}
${resourceContext ? `\n参考资料：\n${resourceContext}` : ''}

请生成详细内容。`
    : `Topic: ${topic}
Section: ${section.title}
Original points: ${section.points.join(', ')}
${resourceContext ? `\nReference:\n${resourceContext}` : ''}

Generate detailed content.`

  try {
    const response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        points: parsed.points || section.points,
        details: parsed.details || [],
        notes: parsed.notes || '',
      }
    }
  } catch (e) {
    console.error('Failed to generate section details:', e)
  }

  return {
    points: section.points,
    details: [],
    notes: '',
  }
}

/**
 * 生成总结要点
 */
async function generateSummary(
  aiClient: ReturnType<typeof getAIClient>,
  topic: string,
  outline: OutlineItem[],
  language: 'zh-CN' | 'en-US'
): Promise<string[]> {
  const isZh = language === 'zh-CN'
  const sections = outline.map((o) => o.title).join(isZh ? '、' : ', ')

  const systemPrompt = isZh
    ? `基于PPT的章节内容，生成3-4个总结要点。每个要点简洁有力，10-15字。返回JSON数组。`
    : `Based on PPT sections, generate 3-4 summary points. Each point concise and impactful, 8-12 words. Return JSON array.`

  const userPrompt = isZh
    ? `主题：${topic}\n章节：${sections}\n\n返回格式：["要点1", "要点2", "要点3"]`
    : `Topic: ${topic}\nSections: ${sections}\n\nReturn format: ["Point 1", "Point 2", "Point 3"]`

  try {
    const response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const jsonMatch = response.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Failed to generate summary:', e)
  }

  return isZh
    ? ['核心概念回顾', '关键要点总结', '未来展望']
    : ['Key concepts reviewed', 'Main points summarized', 'Future outlook']
}

// ============ 完整生成流程 ============

/**
 * 完整的PPT生成流程
 */
export async function generatePresentation(
  topic: string,
  language: 'zh-CN' | 'en-US',
  duration: number,
  onProgress?: (stage: string, progress: number, message: string) => void
): Promise<{ outline: OutlineItem[]; downloadUrl: string }> {
  const isZh = language === 'zh-CN'

  // 阶段1: 收集资料
  onProgress?.(
    'collecting',
    5,
    isZh ? '正在搜索相关资料...' : 'Searching resources...'
  )
  const resources = await collectResources(topic, language)
  onProgress?.(
    'collecting',
    20,
    isZh
      ? `已收集 ${resources?.results.length || 0} 条资料`
      : `Collected ${resources?.results.length || 0} resources`
  )

  // 阶段2: 生成大纲
  onProgress?.(
    'outlining',
    25,
    isZh ? '正在规划大纲结构...' : 'Planning outline...'
  )
  const outline = await generateOutline(topic, language, duration, resources)
  onProgress?.('outlining', 40, isZh ? '大纲生成完成' : 'Outline created')

  // 阶段3: 生成详细内容
  onProgress?.(
    'generating',
    45,
    isZh ? '正在生成详细内容...' : 'Generating content...'
  )
  const slides = await generateSlideContents(
    topic,
    outline,
    language,
    resources
  )
  onProgress?.('generating', 75, isZh ? '内容生成完成' : 'Content generated')

  // 阶段4: 生成PPTX文件
  onProgress?.('completed', 80, isZh ? '正在渲染PPT...' : 'Rendering PPT...')
  const downloadUrl = await generatePPTX(topic, slides, language)
  onProgress?.('completed', 100, isZh ? '生成完成！' : 'Complete!')

  return { outline, downloadUrl }
}

// ============ 工具函数 ============

/**
 * 默认大纲生成（降级方案）
 */
function generateDefaultOutline(
  topic: string,
  language: 'zh-CN' | 'en-US',
  sectionCount: number
): OutlineItem[] {
  const isZh = language === 'zh-CN'

  const defaultSections = isZh
    ? [
        {
          title: '概述与背景',
          points: ['基本概念介绍', '发展历程回顾', '当前现状分析'],
        },
        {
          title: '核心内容',
          points: ['核心原理阐述', '关键要素分析', '重要特征说明'],
        },
        {
          title: '深入分析',
          points: ['详细机制解读', '案例研究展示', '数据支撑论证'],
        },
        {
          title: '应用场景',
          points: ['实际应用领域', '成功案例分享', '最佳实践建议'],
        },
        {
          title: '挑战与机遇',
          points: ['面临的挑战', '发展的机遇', '应对策略建议'],
        },
        {
          title: '未来展望',
          points: ['发展趋势预测', '技术演进方向', '行业影响分析'],
        },
      ]
    : [
        {
          title: 'Overview & Background',
          points: [
            'Basic concepts',
            'Historical development',
            'Current status',
          ],
        },
        {
          title: 'Core Content',
          points: ['Core principles', 'Key elements', 'Important features'],
        },
        {
          title: 'In-depth Analysis',
          points: [
            'Detailed mechanisms',
            'Case studies',
            'Data-driven insights',
          ],
        },
        {
          title: 'Applications',
          points: ['Application areas', 'Success stories', 'Best practices'],
        },
        {
          title: 'Challenges & Opportunities',
          points: [
            'Current challenges',
            'Growth opportunities',
            'Strategic responses',
          ],
        },
        {
          title: 'Future Outlook',
          points: [
            'Trend predictions',
            'Technical evolution',
            'Industry impact',
          ],
        },
      ]

  return defaultSections.slice(0, sectionCount)
}
