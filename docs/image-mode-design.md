# 图片模式 PPT 生成设计文档

## 概述

新增一种 PPT 生成模式：使用对话 AI（Claude/GPT）通过工具调用来生成完整的幻灯片图片。对话 AI 负责根据大纲和资料构思每张幻灯片的绘画提示词，然后调用图像生成工具（Gemini）生成图片。

## 架构设计

### 流程对比

```
【现有 DSL 模式】
大纲 + 资料 → 对话AI → 调用 add_slide(slideDSL) → 返回成功 → 循环直到 finish_generation
                                    ↓
                              存储 SlideDSL
                                    ↓
                              DSL 渲染成 PPTX

【新增图片模式】
大纲 + 资料 → 对话AI → 调用 generate_slide_image(prompt) → 内部调用 Gemini → 返回 base64
                                    ↓
                              存储 ImageSlide
                                    ↓
                              图片组装成 PPTX
```

### 工具定义

```typescript
// 图片生成工具
{
  type: 'function',
  function: {
    name: 'generate_slide_image',
    description: '生成一张幻灯片图片。根据提供的绘画提示词生成完整的幻灯片图片，包含标题、内容、布局和装饰元素。',
    parameters: {
      type: 'object',
      properties: {
        slide_type: {
          type: 'string',
          enum: ['cover', 'toc', 'section', 'content', 'ending'],
          description: '幻灯片类型：cover=封面页, toc=目录页, section=章节页, content=内容页, ending=结束页',
        },
        prompt: {
          type: 'string',
          description: '详细的绘画提示词，描述幻灯片的视觉效果、布局、文字内容、颜色风格等',
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
}
```

### 工具执行流程

```
对话AI 调用 generate_slide_image({ slide_type: 'cover', prompt: '...' })
    ↓
工具处理函数接收参数
    ↓
调用 Gemini API 生成图片 (使用 prompt)
    ↓
获取返回的 base64 图片
    ↓
存储 ImageSlide { type, prompt, imageBase64 }
    ↓
返回给对话AI: { success: true, slideIndex: 1 }
    ↓
对话AI 继续生成下一张，直到调用 finish_generation
```

## 数据结构

### 会话扩展

```typescript
// src/types/index.ts

// 生成模式
export type GenerationMode = 'dsl' | 'image'

// 图片幻灯片类型
export type ImageSlideType = 'cover' | 'toc' | 'section' | 'content' | 'ending'

// 单张图片幻灯片
export interface ImageSlide {
  index: number                    // 幻灯片序号（从0开始）
  type: ImageSlideType             // 幻灯片类型
  prompt: string                   // 生成该幻灯片使用的提示词
  imageBase64?: string             // 生成的图片 base64（不含 data:image/xxx;base64, 前缀）
  imageFormat?: 'png' | 'jpeg'     // 图片格式
  generatedAt?: string             // 生成时间
  error?: string                   // 生成失败时的错误信息
}

// 图片演示文稿
export interface ImagePresentation {
  slides: ImageSlide[]
  generatedAt?: string
}

// 扩展 GenerationSession
export interface GenerationSession {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  mode: GenerationMode              // 新增：生成模式
  theme?: ThemeName
  stage: GenerationStage
  processing?: boolean
  error?: string
  createdAt: string
  updatedAt: string

  // 共用字段
  resources?: ResourceData
  outline?: OutlineItem[]

  // DSL 模式专用
  dslPresentation?: PresentationDSL

  // 图片模式专用
  imagePresentation?: ImagePresentation
}
```

## 文件结构

### 新增文件

```
src/lib/
├── image-generator.ts      # 图片生成核心逻辑
│   ├── generateSlideImage()           # 调用 Gemini 生成单张图片
│   ├── generateImagePresentation()    # 使用工具调用生成完整演示文稿
│   └── IMAGE_TOOLS                    # 工具定义
│
├── image-renderer.ts       # 图片 PPTX 渲染
│   └── renderImagePresentation()      # 将图片组装成 PPTX
```

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/types/index.ts` | 添加 ImageSlide、ImagePresentation、GenerationMode 类型 |
| `src/lib/config.ts` | 添加图像生成模型配置 (IMAGE_MODEL) |
| `src/app/api/session/create/route.ts` | 支持 mode 参数，默认 'dsl' |
| `src/app/api/session/[id]/generate/route.ts` | 根据 mode 分支调用不同生成器 |
| `src/app/api/session/[id]/export/route.ts` | 根据 mode 使用不同渲染器 |
| `src/app/generate/page.tsx` | 显示图片生成进度 |
| `src/app/page.tsx` | 添加模式选择 UI |

## 核心实现

### 1. 图片生成器 (image-generator.ts)

#### 1.1 工具定义

```typescript
import OpenAI from 'openai'

export const IMAGE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_slide_image',
      description: '生成一张幻灯片图片。根据提供的绘画提示词生成完整的幻灯片图片。',
      parameters: {
        type: 'object',
        properties: {
          slide_type: {
            type: 'string',
            enum: ['cover', 'toc', 'section', 'content', 'ending'],
            description: '幻灯片类型',
          },
          prompt: {
            type: 'string',
            description: '详细的绘画提示词',
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
      description: '完成幻灯片生成',
      parameters: { type: 'object', properties: {} },
    },
  },
]
```

#### 1.2 调用 Gemini 生成图片

```typescript
export async function generateSlideImage(prompt: string): Promise<string> {
  const config = getImageConfig()

  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })

  const response = await openai.chat.completions.create({
    model: config.model,  // 'gemini-2.0-flash-exp-image-generation'
    messages: [{ role: 'user', content: prompt }],
  })

  // 解析 Gemini 响应中的图片
  const result = response as unknown as GeminiImageResponse
  const images = result.choices?.[0]?.message?.images

  if (!images || images.length === 0) {
    throw new Error('No image generated')
  }

  const imageUrl = images[0].image_url.url

  // 提取 base64
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
    if (match) return match[1]
  }

  throw new Error('Unexpected image format')
}
```

#### 1.3 使用工具调用生成演示文稿

```typescript
export async function generateImagePresentation(
  outline: OutlineItem[],
  topic: string,
  language: 'zh-CN' | 'en-US',
  theme: ThemeName,
  resources?: ResourceData,
): Promise<ImagePresentation> {
  const aiConfig = getAIConfig()
  const openai = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  })

  const slides: ImageSlide[] = []

  // 构建系统提示词
  const systemPrompt = buildImageSystemPrompt(language, theme)

  // 构建用户提示词（包含大纲和资料）
  const userPrompt = buildImageUserPrompt(topic, outline, resources, language)

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let finished = false
  let iterations = 0
  const maxIterations = 50

  while (!finished && iterations < maxIterations) {
    iterations++

    const response = await openai.chat.completions.create({
      model: aiConfig.model,
      messages,
      tools: IMAGE_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
    })

    const message = response.choices[0]?.message
    if (!message) break

    messages.push(message)

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments || '{}')

        if (functionName === 'generate_slide_image') {
          const { slide_type, prompt } = args

          try {
            console.log(`[Image Generator] Generating slide ${slides.length + 1}: ${slide_type}`)

            // 调用 Gemini 生成图片
            const imageBase64 = await generateSlideImage(prompt)

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
              content: JSON.stringify({ success: true, slideIndex: slides.length }),
            })

            console.log(`[Image Generator] Slide ${slides.length} generated successfully`)
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
                error: 'Image generation failed, please continue with next slide'
              }),
            })
          }
        } else if (functionName === 'finish_generation') {
          console.log(`[Image Generator] Generation finished, total slides: ${slides.length}`)
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
      finished = true
    }
  }

  return {
    slides,
    generatedAt: new Date().toISOString(),
  }
}
```

### 2. 图片渲染器 (image-renderer.ts)

```typescript
import PptxGenJS from 'pptxgenjs'
import type { ImagePresentation } from '@/types'

export async function renderImagePresentation(
  presentation: ImagePresentation,
  topic: string
): Promise<string> {
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'AI PPT Creator'
  pptx.title = topic

  for (const slide of presentation.slides) {
    const pptSlide = pptx.addSlide()

    if (slide.imageBase64) {
      // 图片作为全屏背景
      pptSlide.addImage({
        data: `data:image/${slide.imageFormat || 'png'};base64,${slide.imageBase64}`,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      })
    } else {
      // 生成失败的占位页
      pptSlide.background = { color: 'F5F5F5' }
      pptSlide.addText('Image Generation Failed', {
        x: 0.5, y: 2, w: 9, h: 1,
        fontSize: 24, color: 'CC0000', align: 'center',
      })
      if (slide.error) {
        pptSlide.addText(slide.error, {
          x: 0.5, y: 3, w: 9, h: 0.5,
          fontSize: 12, color: '666666', align: 'center',
        })
      }
    }
  }

  const base64 = (await pptx.write({ outputType: 'base64' })) as string
  return `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`
}
```

## API 路由修改

### generate/route.ts 分支逻辑

```typescript
if (session.mode === 'image') {
  // 图片模式：使用工具调用生成图片
  const imagePresentation = await generateImagePresentation(
    session.outline,
    session.topic,
    session.language,
    session.theme || 'blue',
    session.resources,
  )
  session.imagePresentation = imagePresentation
} else {
  // DSL 模式：现有逻辑
  const dslPresentation = await generateDSLPresentation(...)
  session.dslPresentation = dslPresentation
}
```

## 环境变量

```env
# 图像生成配置
IMAGE_BASE_URL=https://your-gemini-endpoint/v1
IMAGE_API_KEY=your-gemini-api-key
IMAGE_MODEL=gemini-2.0-flash-exp-image-generation
```

## 关键点

1. **对话 AI 负责决策**：对话 AI 根据大纲和资料决定生成多少张幻灯片、每张的内容
2. **工具负责执行**：generate_slide_image 工具接收提示词，调用 Gemini 生成图片
3. **串行生成**：每次工具调用生成一张图片，返回后 AI 继续下一张
4. **错误容忍**：单张图片失败不中断流程，记录错误继续下一张
