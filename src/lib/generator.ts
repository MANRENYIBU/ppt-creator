import {
  OutlineItem,
  ResourceData,
} from '@/types'
import { getAIClient, ChatMessage } from './ai'
import { getSearchClient, isSearchAvailable } from './search'
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
  resources: ResourceData | null
): Promise<OutlineItem[]> {
  const aiClient = getAIClient()

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

任务：为主题"${topic}"生成一个完整的PPT大纲。

要求：
1. 根据主题的复杂度和深度，自主决定需要多少个章节（通常4-8个章节比较合适）
2. 每个章节包含标题和3-5个核心要点
3. 每个要点都应该是需要详细展开的内容点，不要写得太泛
4. 内容要专业、有逻辑、有深度
5. 基于提供的参考资料（如有）确保内容准确
6. 章节之间要有逻辑递进关系

返回JSON格式：
{
  "outline": [
    {"title": "章节标题", "points": ["要点1", "要点2", "要点3"]}
  ]
}

只返回JSON，不要其他内容。`
      : `You are a professional presentation designer skilled at organizing complex topics into clear PPT structures.

Task: Generate a comprehensive PPT outline for "${topic}".

Requirements:
1. Decide the number of sections based on topic complexity (typically 4-8 sections work well)
2. Each section should have a title and 3-5 core points
3. Each point should be substantive enough to require detailed expansion, avoid vague descriptions
4. Content should be professional, logical, and insightful
5. Use provided reference materials (if any) for accuracy
6. Sections should have logical progression

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

  return generateDefaultOutline(topic, language)
}

// ============ 工具函数 ============

/**
 * 默认大纲生成（降级方案）
 */
function generateDefaultOutline(
  topic: string,
  language: 'zh-CN' | 'en-US'
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

  return defaultSections
}
