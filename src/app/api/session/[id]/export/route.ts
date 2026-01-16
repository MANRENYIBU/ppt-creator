import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSessionStage } from '@/lib/session';
import { generatePPTXFromDSL } from '@/lib/dsl-renderer';

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

    // 检查是否有DSL内容
    if (!session.dslPresentation || session.dslPresentation.slides.length === 0) {
      return NextResponse.json(
        { error: 'Content not generated yet. Please call /content first.' },
        { status: 400 }
      );
    }

    // 更新阶段
    await updateSessionStage(id, 'exporting');

    try {
      // 每次都重新渲染PPTX
      const downloadUrl = await generatePPTXFromDSL(
        session.dslPresentation,
        session.topic
      );

      // 标记完成（不存储downloadUrl，每次都重新生成）
      await updateSessionStage(id, 'completed');

      // 返回带有临时downloadUrl的session
      return NextResponse.json({
        ...session,
        downloadUrl,
        stage: 'completed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      await updateSessionStage(id, 'error', message);
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Export PPTX error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
