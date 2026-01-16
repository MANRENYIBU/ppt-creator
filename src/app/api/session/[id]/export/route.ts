import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, updateSessionStage } from '@/lib/session';
import { generatePPTX } from '@/lib/pptx';

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

    // 检查是否有内容
    if (!session.slides || session.slides.length === 0) {
      return NextResponse.json(
        { error: 'Content not generated yet. Please call /content first.' },
        { status: 400 }
      );
    }

    // 如果已经有下载链接，直接返回
    if (session.downloadUrl) {
      return NextResponse.json(session);
    }

    // 更新阶段
    await updateSessionStage(id, 'exporting');

    try {
      // 生成PPTX
      const downloadUrl = await generatePPTX(
        session.topic,
        session.slides,
        session.language
      );

      // 保存下载链接，标记完成
      const updated = await updateSession(id, {
        downloadUrl,
        stage: 'completed',
      });

      return NextResponse.json(updated);
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
