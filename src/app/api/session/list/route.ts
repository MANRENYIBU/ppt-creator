import { NextRequest, NextResponse } from 'next/server'
import { getSessionsSummary } from '@/lib/session'

/**
 * 批量获取会话摘要
 * POST /api/session/list
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'ids must be an array' },
        { status: 400 }
      )
    }

    // 限制单次查询数量
    const limitedIds = ids.slice(0, 100)
    const summaries = await getSessionsSummary(limitedIds)

    return NextResponse.json({ sessions: summaries })
  } catch (error) {
    console.error('Failed to fetch session list:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
