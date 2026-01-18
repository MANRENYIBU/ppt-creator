import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, updateSessionStage } from '@/lib/session'
import { collectResources } from '@/lib/generator'

// Vercel 函数超时（秒），Pro 版有效
export const maxDuration = 60

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

    // 检查阶段
    if (session.stage !== 'idle' && session.stage !== 'error') {
      // 如果已经收集过资料，直接返回
      if (session.resources) {
        return NextResponse.json(session)
      }
    }

    // 更新阶段
    await updateSessionStage(id, 'collecting')

    try {
      // 收集资料
      const resources = await collectResources(session.topic, session.language)

      // 保存资源数据
      const updated = await updateSession(id, {
        resources: resources || undefined,
        stage: 'collecting', // 保持在collecting阶段，等待用户确认
      })

      return NextResponse.json(updated)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Collection failed'
      await updateSessionStage(id, 'error', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error) {
    console.error('Collect resources error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
