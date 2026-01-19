import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getSession, updateSession } from '@/lib/session'
import { collectResources, generateOutline } from '@/lib/generator'
import { generateDSLPresentation } from '@/lib/dsl-generator'
import { generateImagePresentation } from '@/lib/image-generator'
import { GenerationStage, GenerationSession } from '@/types'

// Vercel 函数超时（秒）
export const maxDuration = 120

/**
 * 精简的响应数据，只包含前端需要的字段
 */
interface GenerateResponse {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  mode: 'dsl' | 'image'
  stage: GenerationStage
  processing?: boolean
  error?: string
  // 资料预览（只返回标题和URL，不返回完整内容）
  resources?: {
    count: number
    items: Array<{ title: string; url: string }>
  }
  // 大纲预览
  outline?: Array<{ title: string }>
  // 内容是否已生成（不返回完整 DSL 或图片）
  hasContent?: boolean
}

/**
 * 将完整 session 转换为精简响应
 */
function toResponse(session: GenerationSession): GenerateResponse {
  // 根据模式判断内容是否已生成
  const hasContent = session.mode === 'image'
    ? !!(session.imagePresentation && session.imagePresentation.slides.length > 0)
    : !!(session.dslPresentation && session.dslPresentation.slides.length > 0)

  return {
    id: session.id,
    topic: session.topic,
    language: session.language,
    mode: session.mode,
    stage: session.stage,
    processing: session.processing,
    error: session.error,
    resources: session.resources ? {
      count: session.resources.results.length,
      items: session.resources.results.slice(0, 5).map(r => ({
        title: r.title,
        url: r.url,
      })),
    } : undefined,
    outline: session.outline?.map(item => ({ title: item.title })),
    hasContent,
  }
}

/**
 * 异步生成 API
 *
 * 工作流程：
 * 1. 检查当前状态，如果正在处理中，直接返回当前状态
 * 2. 如果需要处理新阶段，设置 processing=true，立即返回
 * 3. 使用 after() 在响应后执行实际的处理逻辑
 * 4. 处理完成后更新状态和 processing=false
 *
 * 前端通过轮询此 API 获取最新状态
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await getSession(id)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 如果已完成，直接返回
    if (session.stage === 'completed') {
      return NextResponse.json(toResponse(session))
    }

    // 如果出错，重置状态以支持重试
    if (session.stage === 'error') {
      // 根据已有数据决定从哪个阶段重新开始
      let retryStage: GenerationStage = 'collecting'
      if (session.outline && session.outline.length > 0) {
        retryStage = 'generating'
      } else if (session.resources) {
        retryStage = 'outlining'
      }

      // 重置错误状态
      await updateSession(id, {
        stage: retryStage,
        error: undefined,
        processing: false,
      })

      // 重新获取 session 并继续处理
      const resetSession = await getSession(id)
      if (!resetSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      // 继续下面的正常流程
      session.stage = resetSession.stage
      session.error = resetSession.error
      session.processing = resetSession.processing
    }

    // 如果正在处理中，直接返回当前状态（避免重复处理）
    if (session.processing) {
      return NextResponse.json(toResponse(session))
    }

    // 确定下一个要执行的阶段
    const nextStage = getNextStage(session)

    if (!nextStage) {
      // 没有下一阶段需要处理
      return NextResponse.json(toResponse(session))
    }

    // 标记为处理中，立即返回
    const processingSession = await updateSession(id, {
      processing: true,
      stage: nextStage,
    })

    // 使用 after() 在响应后执行实际处理
    after(async () => {
      try {
        await executeStage(id, nextStage, session)
      } catch (error) {
        console.error(`Stage ${nextStage} failed:`, error)
        const message = error instanceof Error ? error.message : 'Processing failed'
        await updateSession(id, {
          processing: false,
          stage: 'error',
          error: message,
        })
      }
    })

    // 立即返回当前状态
    return NextResponse.json(toResponse(processingSession!))
  } catch (error) {
    console.error('Generate error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * 根据当前状态确定下一个要执行的阶段
 */
function getNextStage(session: Awaited<ReturnType<typeof getSession>>): GenerationStage | null {
  if (!session) return null

  switch (session.stage) {
    case 'idle':
      return 'collecting'
    case 'collecting':
      // 如果资源已收集完成，进入下一阶段
      if (session.resources) {
        return 'outlining'
      }
      return null // 还在收集中
    case 'outlining':
      // 如果大纲已生成，进入下一阶段
      if (session.outline && session.outline.length > 0) {
        return 'generating'
      }
      return null // 还在生成大纲
    case 'generating':
      // 根据模式判断内容是否已生成
      if (session.mode === 'image') {
        if (session.imagePresentation && session.imagePresentation.slides.length > 0) {
          return 'completed'
        }
      } else {
        if (session.dslPresentation && session.dslPresentation.slides.length > 0) {
          return 'completed'
        }
      }
      return null // 还在生成内容
    default:
      return null
  }
}

/**
 * 执行指定阶段的处理逻辑
 */
async function executeStage(
  id: string,
  stage: GenerationStage,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
  switch (stage) {
    case 'collecting': {
      const resources = await collectResources(session.topic, session.language)
      await updateSession(id, {
        resources: resources || undefined,
        processing: false,
        // 保持 collecting 状态，下次轮询会检测到 resources 并进入 outlining
      })
      break
    }

    case 'outlining': {
      const outline = await generateOutline(
        session.topic,
        session.language,
        session.resources || null,
      )
      await updateSession(id, {
        outline,
        processing: false,
        // 保持 outlining 状态，下次轮询会检测到 outline 并进入 generating
      })
      break
    }

    case 'generating': {
      // 需要先获取最新的 session（可能在之前的阶段更新过）
      const currentSession = await getSession(id)
      if (!currentSession || !currentSession.outline) {
        throw new Error('Outline not found')
      }

      // 根据模式选择不同的生成器
      if (currentSession.mode === 'image') {
        // 图片模式：使用工具调用生成图片
        const imagePresentation = await generateImagePresentation(
          currentSession.outline,
          currentSession.topic,
          currentSession.language,
          currentSession.theme || 'blue',
          currentSession.resources || undefined,
        )
        await updateSession(id, {
          imagePresentation,
          processing: false,
        })
      } else {
        // DSL 模式：现有逻辑
        const dslPresentation = await generateDSLPresentation(
          currentSession.topic,
          currentSession.outline,
          currentSession.language,
          currentSession.resources || null,
        )
        await updateSession(id, {
          dslPresentation,
          processing: false,
        })
      }
      break
    }

    case 'completed': {
      await updateSession(id, {
        stage: 'completed',
        processing: false,
      })
      break
    }

    default:
      await updateSession(id, { processing: false })
  }
}
