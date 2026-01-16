import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { GenerateRequest, GenerationRecord, OutlineItem, DURATION_TO_SLIDES } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { topic, language, duration } = body;

    if (!topic || !language || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const slideCount = DURATION_TO_SLIDES[duration];
    if (!slideCount) {
      return NextResponse.json(
        { error: 'Invalid duration' },
        { status: 400 }
      );
    }

    // TODO: 实现真实的AI生成逻辑
    // 1. 调用搜索API收集资料
    // 2. 调用AI生成大纲
    // 3. 调用AI生成每页内容
    // 4. 使用PptxGenJS生成PPTX文件

    // 模拟生成的大纲
    const outline: OutlineItem[] = generateMockOutline(topic, language, slideCount.min);

    const record: GenerationRecord = {
      id: uuidv4(),
      topic,
      language,
      duration,
      outline,
      createdAt: new Date().toISOString(),
      // downloadUrl 需要在真实实现中生成PPTX后提供
    };

    return NextResponse.json(record);
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateMockOutline(
  topic: string,
  language: 'zh-CN' | 'en-US',
  pageCount: number
): OutlineItem[] {
  const isZh = language === 'zh-CN';

  const outline: OutlineItem[] = [
    {
      title: isZh ? `封面 - ${topic}` : `Cover - ${topic}`,
      points: [],
    },
    {
      title: isZh ? '目录' : 'Table of Contents',
      points: [],
    },
  ];

  const contentPages = pageCount - 4; // 减去封面、目录、总结、致谢
  for (let i = 0; i < contentPages; i++) {
    outline.push({
      title: isZh ? `第${i + 1}部分` : `Part ${i + 1}`,
      points: [
        isZh ? '要点一' : 'Key point 1',
        isZh ? '要点二' : 'Key point 2',
        isZh ? '要点三' : 'Key point 3',
      ],
    });
  }

  outline.push({
    title: isZh ? '总结' : 'Summary',
    points: [],
  });

  outline.push({
    title: isZh ? '感谢' : 'Thank You',
    points: [],
  });

  return outline;
}
