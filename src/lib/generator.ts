import { OutlineItem, ResourceData } from '@/types'
import { getAIClient, ChatMessage } from './ai'
import { getSearchClient, isSearchAvailable } from './search'
import { fetchUrlContent } from './scraper'

// ============ 阶段1: 收集资料（AI驱动） ============

/**
 * 资料收集系统提示词
 */
const RESEARCH_SYSTEM_PROMPT_ZH = `你是一个专业的资料研究员，负责为演示文稿收集高质量的参考资料。

你有以下工具可用：
1. search_web(query) - 搜索网页获取相关资料
2. fetch_url(url) - 抓取指定URL的完整内容
3. finish_research(summary) - 完成研究并提交总结

## 工作流程

1. **理解主题**：分析用户提供的主题，确定需要收集哪些方面的资料
2. **多角度搜索**：进行2-3次搜索，覆盖不同角度：
   - 主题的基础概念和定义
   - 主题的核心内容和关键技术/方法
   - 最新发展、应用案例或实践经验
3. **深入阅读**：对于重要的搜索结果，使用 fetch_url 获取完整内容
4. **总结分析**：完成收集后，调用 finish_research 提交综合总结

## 总结要求

在 finish_research 中提供的总结应该：
- 提炼关键概念和核心观点
- 包含重要的数据、案例或引用
- 按逻辑组织，便于后续PPT制作
- 长度在500-1500字之间

## 注意事项

- 每次搜索使用精确、相关的关键词
- 优先选择权威、专业的来源
- 不要重复搜索相同的内容
- 最多进行5次搜索操作`

const RESEARCH_SYSTEM_PROMPT_EN = `You are a professional research assistant responsible for collecting high-quality reference materials for presentations.

You have the following tools available:
1. search_web(query) - Search the web for relevant materials
2. fetch_url(url) - Fetch the full content of a specific URL
3. finish_research(summary) - Complete research and submit summary

## Workflow

1. **Understand the topic**: Analyze the user's topic and determine what aspects need to be researched
2. **Multi-angle search**: Conduct 2-3 searches covering different angles:
   - Basic concepts and definitions of the topic
   - Core content and key technologies/methods
   - Latest developments, application cases, or practical experiences
3. **Deep reading**: For important search results, use fetch_url to get full content
4. **Summarize**: After collection, call finish_research to submit a comprehensive summary

## Summary Requirements

The summary provided in finish_research should:
- Extract key concepts and core viewpoints
- Include important data, cases, or quotes
- Be logically organized for subsequent PPT creation
- Be 500-1500 words in length

## Notes

- Use precise, relevant keywords for each search
- Prioritize authoritative, professional sources
- Don't repeat searches for the same content
- Maximum 5 search operations`

/**
 * 使用AI驱动的方式搜索并收集相关资料
 */
export async function collectResources(
  topic: string,
  language: 'zh-CN' | 'en-US',
): Promise<ResourceData | null> {
  if (!isSearchAvailable()) {
    console.log('Search not available, skipping resource collection')
    return null
  }

  const searchClient = getSearchClient()
  const aiClient = getAIClient()
  const isZh = language === 'zh-CN'

  const systemPrompt = isZh
    ? RESEARCH_SYSTEM_PROMPT_ZH
    : RESEARCH_SYSTEM_PROMPT_EN
  const userPrompt = isZh
    ? `请为以下主题收集资料：\n\n主题：${topic}\n\n请开始搜索和收集相关资料。`
    : `Please collect materials for the following topic:\n\nTopic: ${topic}\n\nPlease start searching and collecting relevant materials.`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  try {
    console.log('[Resource Collection] Starting AI-driven research...')

    const result = await aiClient.conductResearch(
      messages,
      // 搜索回调
      async (query: string) => {
        const response = await searchClient.search(query, 5)
        return response.results.map((r) => ({
          query: query,
          title: r.title,
          url: r.url,
          content: r.content,
        }))
      },
      // 抓取回调
      async (url: string) => {
        return await fetchUrlContent(url)
      },
    )

    console.log(
      `[Resource Collection] Completed: ${result.resources.length} resources, summary: ${result.summary.length} chars`,
    )

    return {
      topic: topic,
      results: result.resources,
      summary: result.summary,
      collectedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('AI-driven resource collection failed:', error)
    // 降级到传统方式
    return await collectResourcesFallback(topic, language)
  }
}

/**
 * 降级方案：传统的资料收集方式
 */
async function collectResourcesFallback(
  topic: string,
  language: 'zh-CN' | 'en-US',
): Promise<ResourceData | null> {
  console.log('[Resource Collection] Using fallback method...')

  const searchClient = getSearchClient()
  const query =
    language === 'zh-CN'
      ? `${topic} 详细介绍 专业资料`
      : `${topic} detailed overview professional`

  try {
    const response = await searchClient.search(query, 5)

    // 抓取前3个结果的完整内容
    const enrichedResults = await Promise.all(
      response.results.slice(0, 3).map(async (r) => {
        const rawContent = await fetchUrlContent(r.url)
        return {
          ...r,
          rawContent: rawContent || undefined,
          query: query, // 记录搜索关键词
        }
      }),
    )

    return {
      topic,
      results: enrichedResults,
      collectedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Fallback resource collection failed:', error)
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
  resources: ResourceData | null,
): Promise<OutlineItem[]> {
  const aiClient = getAIClient()

  // 构建资料上下文（优先使用 AI 总结）
  let resourceContext = ''
  if (resources) {
    if (resources.summary) {
      // 使用 AI 总结
      resourceContext =
        language === 'zh-CN'
          ? `\n\n【研究总结】\n${resources.summary}`
          : `\n\n【Research Summary】\n${resources.summary}`
    } else if (resources.results.length > 0) {
      // 降级：使用原始资料
      resourceContext =
        language === 'zh-CN'
          ? `\n\n【参考资料】\n${resources.results
              .map((r, i) => {
                const content = r.rawContent || r.content
                const truncated =
                  content.length > 2000
                    ? content.slice(0, 2000) + '...'
                    : content
                return `${i + 1}. ${r.title}\n   来源: ${r.url}\n   ${truncated}`
              })
              .join('\n\n')}`
          : `\n\n【Reference Materials】\n${resources.results
              .map((r, i) => {
                const content = r.rawContent || r.content
                const truncated =
                  content.length > 2000
                    ? content.slice(0, 2000) + '...'
                    : content
                return `${i + 1}. ${r.title}\n   Source: ${r.url}\n   ${truncated}`
              })
              .join('\n\n')}`
    }
  }

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
  language: 'zh-CN' | 'en-US',
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
