import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSessionStage } from '@/lib/session';
import { generatePPTXFromDSL } from '@/lib/dsl-renderer';
import { ThemeName } from '@/types';

// 有效的主题名称
const VALID_THEMES: ThemeName[] = ['blue', 'green', 'purple', 'orange', 'red', 'slate', 'teal', 'rose'];

export async function POST(
  request: NextRequest,
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

    // 从请求体获取主题（优先使用请求中的主题，否则使用会话中的主题）
    let theme: ThemeName | undefined = session.theme;
    try {
      const body = await request.json();
      if (body.theme && VALID_THEMES.includes(body.theme)) {
        theme = body.theme;
      }
    } catch {
      // 请求体为空或解析失败，使用会话中的主题
    }

    // 更新阶段
    await updateSessionStage(id, 'exporting');

    try {
      // 每次都重新渲染PPTX（使用请求中的主题或会话中的主题）
      const downloadUrl = await generatePPTXFromDSL(
        session.dslPresentation,
        session.topic,
        theme
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
