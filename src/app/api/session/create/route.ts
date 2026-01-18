import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { GenerateRequest, ThemeName } from '@/types';
import { validateConfig } from '@/lib/config';
import { createSession, cleanupOldSessions } from '@/lib/session';

// 有效的主题名称
const VALID_THEMES: ThemeName[] = ['blue', 'green', 'purple', 'orange', 'red', 'slate', 'teal', 'rose'];

export async function POST(request: NextRequest) {
  try {
    // 验证配置
    const config = validateConfig();
    if (!config.ai) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const body: GenerateRequest = await request.json();
    const { topic, language, theme } = body;

    // 参数验证
    if (!topic || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, language' },
        { status: 400 }
      );
    }

    if (topic.length > 200) {
      return NextResponse.json(
        { error: 'Topic too long, max 200 characters' },
        { status: 400 }
      );
    }

    if (!['zh-CN', 'en-US'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language, must be zh-CN or en-US' },
        { status: 400 }
      );
    }

    // 验证主题（可选）
    const validTheme = theme && VALID_THEMES.includes(theme) ? theme : undefined;

    // 清理旧会话（后台执行）
    cleanupOldSessions().catch(console.error);

    // 创建新会话
    const sessionId = uuidv4();
    const session = await createSession(sessionId, topic, language, validTheme);

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session creation error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
