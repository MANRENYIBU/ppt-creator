import { OutlineItem, DURATION_TO_SLIDES } from '@/types';
import { getAIClient, ChatMessage } from './ai';
import { getSearchClient, isSearchAvailable, SearchResult } from './search';
import { generatePPTX, SlideContent } from './pptx';

/**
 * 搜索相关资料
 */
export async function collectResources(
  topic: string,
  language: 'zh-CN' | 'en-US'
): Promise<SearchResult[]> {
  if (!isSearchAvailable()) {
    console.log('Search not available, skipping resource collection');
    return [];
  }

  const searchClient = getSearchClient();
  const query = language === 'zh-CN' ? `${topic} 介绍 资料` : `${topic} overview information`;

  try {
    const response = await searchClient.search(query, 5);
    return response.results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

/**
 * 生成PPT大纲
 */
export async function generateOutline(
  topic: string,
  language: 'zh-CN' | 'en-US',
  duration: number,
  resources: SearchResult[]
): Promise<OutlineItem[]> {
  const aiClient = getAIClient();
  const slideCount = DURATION_TO_SLIDES[duration];
  const targetSlides = Math.floor((slideCount.min + slideCount.max) / 2);

  const resourceContext = resources.length > 0
    ? `\n\n参考资料:\n${resources.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
    : '';

  const systemPrompt = language === 'zh-CN'
    ? `你是一个专业的演示文稿设计师。请根据用户提供的主题生成PPT大纲。
要求：
1. 生成${targetSlides}页的大纲
2. 第一页是封面，最后一页是感谢页
3. 每页包含标题和3-5个要点
4. 内容要专业、有深度
5. 必须返回JSON格式

返回格式：
{
  "outline": [
    {"title": "页面标题", "points": ["要点1", "要点2", "要点3"]}
  ]
}`
    : `You are a professional presentation designer. Generate a PPT outline based on the topic.
Requirements:
1. Generate ${targetSlides} slides
2. First slide is cover, last slide is thank you
3. Each slide has a title and 3-5 key points
4. Content should be professional and insightful
5. Return JSON format only

Format:
{
  "outline": [
    {"title": "Slide Title", "points": ["Point 1", "Point 2", "Point 3"]}
  ]
}`;

  const userPrompt = language === 'zh-CN'
    ? `主题：${topic}${resourceContext}\n\n请生成PPT大纲，返回JSON格式。`
    : `Topic: ${topic}${resourceContext}\n\nGenerate PPT outline, return JSON format.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await aiClient.chat(messages);

  // 解析JSON响应
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.outline || [];
    }
  } catch (e) {
    console.error('Failed to parse outline JSON:', e);
  }

  // 返回默认大纲
  return generateDefaultOutline(topic, language, targetSlides);
}

/**
 * 生成每页的详细内容
 */
export async function generateSlideContents(
  topic: string,
  outline: OutlineItem[],
  language: 'zh-CN' | 'en-US'
): Promise<SlideContent[]> {
  // 直接使用大纲作为内容（可以后续扩展为AI生成更详细内容）
  return outline.map((item) => ({
    title: item.title,
    points: item.points,
  }));
}

/**
 * 完整的PPT生成流程
 */
export async function generatePresentation(
  topic: string,
  language: 'zh-CN' | 'en-US',
  duration: number,
  onProgress?: (stage: string, progress: number, message: string) => void
): Promise<{ outline: OutlineItem[]; downloadUrl: string }> {
  // 阶段1: 收集资料
  onProgress?.('collecting', 10, language === 'zh-CN' ? '正在搜索相关资料...' : 'Searching resources...');
  const resources = await collectResources(topic, language);
  onProgress?.('collecting', 25, language === 'zh-CN' ? '资料收集完成' : 'Resources collected');

  // 阶段2: 生成大纲
  onProgress?.('outlining', 30, language === 'zh-CN' ? '正在规划大纲...' : 'Creating outline...');
  const outline = await generateOutline(topic, language, duration, resources);
  onProgress?.('outlining', 50, language === 'zh-CN' ? '大纲生成完成' : 'Outline created');

  // 阶段3: 生成内容
  onProgress?.('generating', 55, language === 'zh-CN' ? '正在生成内容...' : 'Generating content...');
  const slides = await generateSlideContents(topic, outline, language);
  onProgress?.('generating', 75, language === 'zh-CN' ? '内容生成完成' : 'Content generated');

  // 阶段4: 生成PPTX
  onProgress?.('completed', 80, language === 'zh-CN' ? '正在生成PPT文件...' : 'Creating PPT file...');
  const downloadUrl = await generatePPTX(topic, slides, language);
  onProgress?.('completed', 100, language === 'zh-CN' ? '生成完成！' : 'Complete!');

  return { outline, downloadUrl };
}

/**
 * 默认大纲生成
 */
function generateDefaultOutline(
  topic: string,
  language: 'zh-CN' | 'en-US',
  pageCount: number
): OutlineItem[] {
  const isZh = language === 'zh-CN';

  const outline: OutlineItem[] = [
    {
      title: isZh ? topic : topic,
      points: [],
    },
  ];

  const contentPages = pageCount - 2;
  const sections = isZh
    ? ['概述', '背景介绍', '核心内容', '详细分析', '案例展示', '未来展望', '总结']
    : ['Overview', 'Background', 'Core Content', 'Analysis', 'Case Study', 'Future', 'Summary'];

  for (let i = 0; i < contentPages && i < sections.length; i++) {
    outline.push({
      title: sections[i],
      points: isZh
        ? ['要点一', '要点二', '要点三']
        : ['Key point 1', 'Key point 2', 'Key point 3'],
    });
  }

  outline.push({
    title: isZh ? '感谢' : 'Thank You',
    points: [],
  });

  return outline;
}
