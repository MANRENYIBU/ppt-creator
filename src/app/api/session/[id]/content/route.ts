import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, updateSessionStage } from '@/lib/session';
import { generateSlideContents } from '@/lib/generator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 检查是否有大纲
    if (!session.outline || session.outline.length === 0) {
      return NextResponse.json(
        { error: 'Outline not generated yet. Please call /outline first.' },
        { status: 400 }
      );
    }

    // 如果已经有内容，直接返回
    if (session.slides && session.slides.length > 0) {
      return NextResponse.json(session);
    }

    // 更新阶段
    await updateSessionStage(id, 'generating');

    try {
      // 生成详细内容
      const slides = await generateSlideContents(
        session.topic,
        session.outline,
        session.language,
        session.resources || null
      );

      // 保存内容
      const updated = await updateSession(id, {
        slides,
        stage: 'generating', // 保持在generating阶段，等待用户确认
      });

      return NextResponse.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Content generation failed';
      await updateSessionStage(id, 'error', message);
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Generate content error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
