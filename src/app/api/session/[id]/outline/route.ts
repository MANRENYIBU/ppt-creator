import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, updateSessionStage } from '@/lib/session'
import { generateOutline } from '@/lib/generator'

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

    // 如果已经有大纲，直接返回
    if (session.outline && session.outline.length > 0) {
      return NextResponse.json(session)
    }

    // 更新阶段
    await updateSessionStage(id, 'outlining')

    try {
      // 生成大纲
      const outline = await generateOutline(
        session.topic,
        session.language,
        session.resources || null,
      )

      // 保存大纲
      const updated = await updateSession(id, {
        outline,
        stage: 'outlining', // 保持在outlining阶段，等待用户确认
      })

      return NextResponse.json(updated)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Outline generation failed'
      await updateSessionStage(id, 'error', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error) {
    console.error('Generate outline error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
