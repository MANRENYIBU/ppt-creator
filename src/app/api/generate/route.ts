import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { GenerateRequest, GenerationRecord, DURATION_TO_SLIDES } from '@/types';
import { generatePresentation } from '@/lib/generator';
import { validateConfig } from '@/lib/config';

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
    const { topic, language, duration } = body;

    // 参数验证
    if (!topic || !language || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, language, duration' },
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

    const slideCount = DURATION_TO_SLIDES[duration];
    if (!slideCount) {
      return NextResponse.json(
        { error: 'Invalid duration, must be 5, 10, 15, 20, or 30' },
        { status: 400 }
      );
    }

    // 生成PPT
    const { outline, downloadUrl } = await generatePresentation(
      topic,
      language,
      duration
    );

    const record: GenerationRecord = {
      id: uuidv4(),
      topic,
      language,
      duration,
      outline,
      createdAt: new Date().toISOString(),
      downloadUrl,
    };

    return NextResponse.json(record);
  } catch (error) {
    console.error('Generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
