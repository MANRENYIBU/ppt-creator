import OpenAI from 'openai'
import type {
  OutlineItem,
  ResourceData,
  ImageSlide,
  ImagePresentation,
  ImageSlideType,
  ThemeName,
} from '@/types'
import { getAIConfig } from './config'
import { getImageClient } from './ai'

// ============ 工具定义 ============

export const IMAGE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_slide_image',
      description:
        '生成一张幻灯片图片。根据提供的绘画提示词生成完整的幻灯片图片，包含标题、内容、布局和装饰元素。',
      parameters: {
        type: 'object',
        properties: {
          slide_type: {
            type: 'string',
            enum: ['cover', 'toc', 'section', 'content', 'ending'],
            description:
              '幻灯片类型：cover=封面页, toc=目录页, section=章节页, content=内容页, ending=结束页',
          },
          prompt: {
            type: 'string',
            description:
              '详细的绘画提示词，描述幻灯片的视觉效果、布局、文字内容、颜色风格等',
          },
        },
        required: ['slide_type', 'prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_generation',
      description: '完成幻灯片生成，所有内容已添加完毕',
      parameters: { type: 'object', properties: {} },
    },
  },
]

// ============ 构建提示词 ============

/**
 * 构建图片模式的系统提示词
 */
function buildImageSystemPrompt(
  language: 'zh-CN' | 'en-US',
  theme: ThemeName,
): string {
  const isZh = language === 'zh-CN'

  const themeDescriptions: Record<ThemeName, string> = {
    blue: isZh ? '专业蓝色商务风格' : 'Professional blue business style',
    green: isZh ? '清新绿色自然风格' : 'Fresh green natural style',
    purple: isZh ? '优雅紫色创意风格' : 'Elegant purple creative style',
    orange: isZh ? '活力橙色热情风格' : 'Vibrant orange passionate style',
    red: isZh ? '醒目红色大胆风格' : 'Bold red striking style',
    slate: isZh ? '简约灰色现代风格' : 'Minimal slate modern style',
    teal: isZh ? '科技青色现代风格' : 'Tech teal modern style',
    rose: isZh ? '温馨玫瑰柔和风格' : 'Warm rose soft style',
  }

  const themeStyle = themeDescriptions[theme] || themeDescriptions.blue

  if (isZh) {
    return `你是一个专业的演示文稿设计师，负责创建视觉精美的幻灯片图片。

## 你的任务
根据提供的大纲和资料，为每个章节生成幻灯片图片。你需要：
1. 决定每张幻灯片的内容和布局
2. 编写详细的绘画提示词
3. 调用 generate_slide_image 工具生成图片

## 幻灯片类型
- cover: 封面页 - 展示主题标题和副标题
- toc: 目录页 - 展示演示文稿的章节结构
- section: 章节页 - 章节标题页，作为章节分隔
- content: 内容页 - 展示具体内容，包含标题和要点
- ending: 结束页 - 感谢页或总结页

## 数量限制（严格遵守）
- 封面页：1张
- 目录页：1张
- 每个章节：1张 section 页 + 最多4张 content 页
- 结束页：1张
- **重要：每个章节的内容页（content）严格限制在4张以内，不得超过！**

## 设计风格
主题风格：${themeStyle}
- 使用16:9宽屏比例
- 确保文字清晰可读
- 保持视觉一致性
- 合理使用空白和布局

## 提示词编写要求
每张幻灯片的提示词应该包含：
1. 幻灯片类型和用途
2. 具体的文字内容（标题、副标题、要点等）
3. 布局描述（文字位置、对齐方式）
4. 视觉风格（颜色、背景、装饰元素）
5. 设计风格关键词

## 生成流程
1. 先生成封面页
2. 生成目录页
3. 按大纲顺序生成每个章节（每章：1张section页 + 最多4张content页）
4. 最后生成结束页
5. 完成后调用 finish_generation

## 注意事项
- 每张幻灯片调用一次 generate_slide_image
- **严格控制每章内容页数量，最多4张**
- 确保所有文字都包含在提示词中
- 图片生成失败时继续下一张`
  } else {
    return `You are a professional presentation designer responsible for creating visually stunning slide images.

## Your Task
Based on the provided outline and materials, generate slide images for each section. You need to:
1. Decide the content and layout for each slide
2. Write detailed drawing prompts
3. Call generate_slide_image tool to generate images

## Slide Types
- cover: Cover page - Display main title and subtitle
- toc: Table of Contents - Show presentation structure
- section: Section page - Section title as divider
- content: Content page - Show specific content with title and points
- ending: Ending page - Thank you or summary page

## Quantity Limits (Strictly Follow)
- Cover page: 1
- Table of Contents: 1
- Per section: 1 section page + maximum 4 content pages
- Ending page: 1
- **IMPORTANT: Each section's content pages are strictly limited to 4 maximum, do not exceed!**

## Design Style
Theme: ${themeStyle}
- Use 16:9 widescreen ratio
- Ensure text is clearly readable
- Maintain visual consistency
- Use whitespace and layout effectively

## Prompt Requirements
Each slide prompt should include:
1. Slide type and purpose
2. Specific text content (title, subtitle, points)
3. Layout description (text position, alignment)
4. Visual style (colors, background, decorative elements)
5. Design style keywords

## Generation Flow
1. Generate cover page first
2. Generate table of contents
3. Generate each section in order (per section: 1 section page + max 4 content pages)
4. Generate ending page last
5. Call finish_generation when done

## Notes
- Call generate_slide_image once per slide
- **Strictly control content pages per section, maximum 4**
- Ensure all text is included in the prompt
- Continue to next slide if image generation fails`
  }
}

/**
 * 构建图片模式的用户提示词
 */
function buildImageUserPrompt(
  topic: string,
  outline: OutlineItem[],
  resources: ResourceData | undefined,
  language: 'zh-CN' | 'en-US',
): string {
  const isZh = language === 'zh-CN'

  let prompt = isZh
    ? `# 演示文稿主题\n${topic}\n\n`
    : `# Presentation Topic\n${topic}\n\n`

  // 添加大纲
  prompt += isZh ? `# 大纲\n` : `# Outline\n`
  outline.forEach((section, idx) => {
    prompt += `${idx + 1}. ${section.title}\n`
    section.points.forEach((point) => {
      prompt += `   - ${point}\n`
    })
  })
  prompt += '\n'

  // 添加资料摘要
  if (resources?.summary) {
    prompt += isZh
      ? `# 参考资料摘要\n${resources.summary}\n\n`
      : `# Reference Summary\n${resources.summary}\n\n`
  }

  prompt += isZh
    ? `请开始生成幻灯片图片。`
    : `Please start generating slide images.`

  return prompt
}

// ============ 主生成函数 ============

/**
 * 使用工具调用生成完整的图片演示文稿
 */
export async function generateImagePresentation(
  outline: OutlineItem[],
  topic: string,
  language: 'zh-CN' | 'en-US',
  theme: ThemeName,
  resources?: ResourceData,
): Promise<ImagePresentation> {
  const aiConfig = getAIConfig()
  const imageClient = getImageClient()
  const openai = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  })

  const slides: ImageSlide[] = []

  // 构建提示词
  const systemPrompt = buildImageSystemPrompt(language, theme)
  const userPrompt = buildImageUserPrompt(topic, outline, resources, language)

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let finished = false
  let iterations = 0
  const maxIterations = 50

  console.log(`[Image Generator] Starting generation for topic: ${topic}`)

  while (!finished && iterations < maxIterations) {
    iterations++
    console.log(`[Image Generator] Iteration ${iterations}`)

    const response = await openai.chat.completions.create({
      model: aiConfig.model,
      messages,
      tools: IMAGE_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
    })

    const message = response.choices[0]?.message
    if (!message) {
      console.log(`[Image Generator] No message in response, stopping`)
      break
    }

    messages.push(message)

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        // 类型守卫：只处理 function 类型的工具调用
        if (toolCall.type !== 'function') continue

        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments || '{}')

        if (functionName === 'generate_slide_image') {
          const { slide_type, prompt } = args as {
            slide_type: ImageSlideType
            prompt: string
          }

          try {
            console.log(
              `[Image Generator] Generating slide ${slides.length + 1}: ${slide_type}`,
            )

            // 调用 Gemini 生成图片
            const imageBase64 =
              await imageClient.generateSlideImageByFetch(prompt)

            slides.push({
              index: slides.length,
              type: slide_type,
              prompt,
              imageBase64,
              imageFormat: 'png',
              generatedAt: new Date().toISOString(),
            })

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: true,
                slideIndex: slides.length,
              }),
            })

            console.log(
              `[Image Generator] Slide ${slides.length} generated successfully`,
            )
          } catch (error) {
            console.error(`[Image Generator] Failed to generate slide:`, error)

            slides.push({
              index: slides.length,
              type: slide_type,
              prompt,
              error: error instanceof Error ? error.message : String(error),
            })

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error:
                  'Image generation failed, please continue with next slide',
              }),
            })
          }
        } else if (functionName === 'finish_generation') {
          console.log(
            `[Image Generator] Generation finished, total slides: ${slides.length}`,
          )
          finished = true
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: true }),
          })
          break
        }
      }
    } else {
      // 没有工具调用，检查是否应该结束
      console.log(`[Image Generator] No tool calls in response, stopping`)
      finished = true
    }
  }

  if (iterations >= maxIterations) {
    console.warn(`[Image Generator] Reached max iterations (${maxIterations})`)
  }

  return {
    slides,
    generatedAt: new Date().toISOString(),
  }
}
