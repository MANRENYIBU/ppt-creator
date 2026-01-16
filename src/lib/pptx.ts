import PptxGenJS from 'pptxgenjs';
import { OutlineItem } from '@/types';

export interface SlideContent {
  title: string;
  points: string[];
  notes?: string;
}

/**
 * PPT生成服务
 */
export async function generatePPTX(
  topic: string,
  slides: SlideContent[],
  language: 'zh-CN' | 'en-US'
): Promise<string> {
  const pptx = new PptxGenJS();

  // 设置PPT属性
  pptx.author = 'AI PPT Creator';
  pptx.title = topic;
  pptx.subject = topic;

  // 定义主题颜色
  const primaryColor = '2563EB'; // blue-600
  const textColor = '1F2937'; // gray-800
  const mutedColor = '6B7280'; // gray-500

  // 生成每一页
  slides.forEach((slideContent, index) => {
    const slide = pptx.addSlide();

    if (index === 0) {
      // 封面页
      renderCoverSlide(slide, topic, language, primaryColor);
    } else if (index === slides.length - 1) {
      // 结束页
      renderEndSlide(slide, language, primaryColor);
    } else {
      // 内容页
      renderContentSlide(slide, slideContent, textColor, mutedColor, primaryColor);
    }
  });

  // 导出为base64
  const base64 = await pptx.write({ outputType: 'base64' }) as string;
  return `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`;
}

function renderCoverSlide(
  slide: PptxGenJS.Slide,
  topic: string,
  language: 'zh-CN' | 'en-US',
  primaryColor: string
) {
  // 背景色
  slide.background = { color: primaryColor };

  // 标题
  slide.addText(topic, {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 1.5,
    fontSize: 36,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  });

  // 副标题
  slide.addText(language === 'zh-CN' ? 'AI 智能生成' : 'AI Generated', {
    x: 0.5,
    y: 3.5,
    w: 9,
    h: 0.5,
    fontSize: 18,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  });
}

function renderEndSlide(
  slide: PptxGenJS.Slide,
  language: 'zh-CN' | 'en-US',
  primaryColor: string
) {
  slide.background = { color: primaryColor };

  slide.addText(language === 'zh-CN' ? '感谢聆听' : 'Thank You', {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 1.5,
    fontSize: 48,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  });
}

function renderContentSlide(
  slide: PptxGenJS.Slide,
  content: SlideContent,
  textColor: string,
  mutedColor: string,
  primaryColor: string
) {
  // 标题栏背景
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 10,
    h: 1.2,
    fill: { color: 'F3F4F6' },
  });

  // 标题
  slide.addText(content.title, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: textColor,
  });

  // 左侧装饰线
  slide.addShape('rect', {
    x: 0.5,
    y: 1.5,
    w: 0.05,
    h: content.points.length * 0.8,
    fill: { color: primaryColor },
  });

  // 内容要点
  content.points.forEach((point, i) => {
    slide.addText(point, {
      x: 0.8,
      y: 1.5 + i * 0.8,
      w: 8.5,
      h: 0.7,
      fontSize: 18,
      color: textColor,
      bullet: { type: 'bullet' },
    });
  });
}
