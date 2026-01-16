import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, updateSessionStage } from '@/lib/session';
import { generateDSLPresentation } from '@/lib/dsl-generator';

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

    // 如果已经有DSL内容，直接返回
    if (session.dslPresentation && session.dslPresentation.slides.length > 0) {
      return NextResponse.json(session);
    }

    // 更新阶段
    await updateSessionStage(id, 'generating');

    try {
      // 使用DSL生成器生成内容
      const dslPresentation = await generateDSLPresentation(
        session.topic,
        session.outline,
        session.language,
        session.resources || null,
        session.duration
      );

      // 保存DSL内容
      const updated = await updateSession(id, {
        dslPresentation,
        stage: 'generating',
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
