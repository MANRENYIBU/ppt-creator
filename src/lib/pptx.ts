import PptxGenJS from 'pptxgenjs';
import { SlideContent, SlideType } from '@/types';

// ============ 模板配置 ============

// 颜色主题
const THEME = {
  primary: '2563EB',      // blue-600
  primaryDark: '1D4ED8',  // blue-700
  secondary: '6366F1',    // indigo-500
  text: '1F2937',         // gray-800
  textLight: '6B7280',    // gray-500
  background: 'FFFFFF',
  backgroundAlt: 'F3F4F6', // gray-100
  accent: '10B981',       // emerald-500
};

// 字体配置
const FONTS = {
  title: 'Microsoft YaHei',
  body: 'Microsoft YaHei',
};

// 布局配置（单位：英寸）
const LAYOUT = {
  width: 10,
  height: 5.625,  // 16:9
  margin: 0.5,
  headerHeight: 1.2,
};

// ============ 模板渲染器 ============

type SlideRenderer = (
  slide: PptxGenJS.Slide,
  content: SlideContent,
  language: 'zh-CN' | 'en-US'
) => void;

// 封面页模板
const renderCoverSlide: SlideRenderer = (slide, content, language) => {
  // 渐变背景效果（用两个矩形模拟）
  slide.background = { color: THEME.primary };

  // 装饰圆形
  slide.addShape('ellipse', {
    x: -1,
    y: -1,
    w: 4,
    h: 4,
    fill: { color: THEME.primaryDark, transparency: 50 },
  });

  slide.addShape('ellipse', {
    x: 7,
    y: 3,
    w: 5,
    h: 5,
    fill: { color: THEME.secondary, transparency: 60 },
  });

  // 主标题
  slide.addText(content.title, {
    x: LAYOUT.margin,
    y: 1.8,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 1.2,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    fontFace: FONTS.title,
    align: 'center',
    valign: 'middle',
  });

  // 副标题
  if (content.subtitle) {
    slide.addText(content.subtitle, {
      x: LAYOUT.margin,
      y: 3.2,
      w: LAYOUT.width - LAYOUT.margin * 2,
      h: 0.6,
      fontSize: 20,
      color: 'FFFFFF',
      fontFace: FONTS.body,
      align: 'center',
      valign: 'middle',
      transparency: 20,
    });
  }

  // 底部标识
  slide.addText(language === 'zh-CN' ? 'AI 智能生成' : 'AI Generated', {
    x: LAYOUT.margin,
    y: 4.8,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 0.4,
    fontSize: 12,
    color: 'FFFFFF',
    fontFace: FONTS.body,
    align: 'center',
    transparency: 40,
  });
};

// 目录页模板
const renderTocSlide: SlideRenderer = (slide, content, language) => {
  slide.background = { color: THEME.background };

  // 标题
  slide.addText(content.title, {
    x: LAYOUT.margin,
    y: 0.4,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: THEME.text,
    fontFace: FONTS.title,
  });

  // 分隔线
  slide.addShape('rect', {
    x: LAYOUT.margin,
    y: 1.3,
    w: 1.5,
    h: 0.06,
    fill: { color: THEME.primary },
  });

  // 目录项
  const points = content.points || [];
  const startY = 1.8;
  const itemHeight = 0.7;

  points.forEach((point, i) => {
    // 序号
    slide.addText(`0${i + 1}`, {
      x: LAYOUT.margin,
      y: startY + i * itemHeight,
      w: 0.6,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: THEME.primary,
      fontFace: FONTS.body,
    });

    // 内容
    slide.addText(point, {
      x: LAYOUT.margin + 0.7,
      y: startY + i * itemHeight,
      w: LAYOUT.width - LAYOUT.margin * 2 - 0.7,
      h: 0.5,
      fontSize: 18,
      color: THEME.text,
      fontFace: FONTS.body,
    });
  });
};

// 章节页模板（过渡页）
const renderSectionSlide: SlideRenderer = (slide, content) => {
  slide.background = { color: THEME.backgroundAlt };

  // 大号章节标题
  slide.addText(content.title, {
    x: LAYOUT.margin,
    y: 2,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 1.5,
    fontSize: 48,
    bold: true,
    color: THEME.primary,
    fontFace: FONTS.title,
    align: 'center',
    valign: 'middle',
  });

  // 装饰线
  slide.addShape('rect', {
    x: (LAYOUT.width - 2) / 2,
    y: 3.6,
    w: 2,
    h: 0.08,
    fill: { color: THEME.primary },
  });
};

// 内容页模板
const renderContentSlide: SlideRenderer = (slide, content) => {
  slide.background = { color: THEME.background };

  // 顶部色带
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: LAYOUT.width,
    h: LAYOUT.headerHeight,
    fill: { color: THEME.backgroundAlt },
  });

  // 左侧装饰条
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 0.08,
    h: LAYOUT.headerHeight,
    fill: { color: THEME.primary },
  });

  // 标题
  slide.addText(content.title, {
    x: LAYOUT.margin,
    y: 0.35,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 0.6,
    fontSize: 26,
    bold: true,
    color: THEME.text,
    fontFace: FONTS.title,
  });

  // 内容区域
  const points = content.points || [];
  const details = content.details || [];
  const startY = 1.5;
  const itemHeight = 0.9;

  points.forEach((point, i) => {
    // 要点标记
    slide.addShape('ellipse', {
      x: LAYOUT.margin,
      y: startY + i * itemHeight + 0.15,
      w: 0.2,
      h: 0.2,
      fill: { color: THEME.primary },
    });

    // 要点文字
    slide.addText(point, {
      x: LAYOUT.margin + 0.4,
      y: startY + i * itemHeight,
      w: LAYOUT.width - LAYOUT.margin * 2 - 0.4,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: THEME.text,
      fontFace: FONTS.body,
    });

    // 详细说明（如果有）
    if (details[i]) {
      slide.addText(details[i], {
        x: LAYOUT.margin + 0.4,
        y: startY + i * itemHeight + 0.45,
        w: LAYOUT.width - LAYOUT.margin * 2 - 0.4,
        h: 0.4,
        fontSize: 14,
        color: THEME.textLight,
        fontFace: FONTS.body,
      });
    }
  });
};

// 总结页模板
const renderSummarySlide: SlideRenderer = (slide, content) => {
  slide.background = { color: THEME.background };

  // 标题
  slide.addText(content.title, {
    x: LAYOUT.margin,
    y: 0.4,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: THEME.text,
    fontFace: FONTS.title,
  });

  // 分隔线
  slide.addShape('rect', {
    x: LAYOUT.margin,
    y: 1.3,
    w: 1.5,
    h: 0.06,
    fill: { color: THEME.accent },
  });

  // 总结要点
  const points = content.points || [];
  const startY = 1.7;
  const itemHeight = 0.7;

  points.forEach((point, i) => {
    // 勾选图标（用矩形模拟）
    slide.addShape('rect', {
      x: LAYOUT.margin,
      y: startY + i * itemHeight + 0.1,
      w: 0.25,
      h: 0.25,
      fill: { color: THEME.accent },
    });

    slide.addText(point, {
      x: LAYOUT.margin + 0.45,
      y: startY + i * itemHeight,
      w: LAYOUT.width - LAYOUT.margin * 2 - 0.45,
      h: 0.5,
      fontSize: 18,
      color: THEME.text,
      fontFace: FONTS.body,
    });
  });
};

// 感谢页模板
const renderThanksSlide: SlideRenderer = (slide, content, language) => {
  slide.background = { color: THEME.primary };

  // 装饰
  slide.addShape('ellipse', {
    x: -2,
    y: 2,
    w: 6,
    h: 6,
    fill: { color: THEME.primaryDark, transparency: 50 },
  });

  slide.addShape('ellipse', {
    x: 6,
    y: -2,
    w: 6,
    h: 6,
    fill: { color: THEME.secondary, transparency: 60 },
  });

  // 感谢文字
  slide.addText(content.title || (language === 'zh-CN' ? '感谢聆听' : 'Thank You'), {
    x: LAYOUT.margin,
    y: 2,
    w: LAYOUT.width - LAYOUT.margin * 2,
    h: 1.5,
    fontSize: 52,
    bold: true,
    color: 'FFFFFF',
    fontFace: FONTS.title,
    align: 'center',
    valign: 'middle',
  });

  // 副标题
  if (content.subtitle) {
    slide.addText(content.subtitle, {
      x: LAYOUT.margin,
      y: 3.6,
      w: LAYOUT.width - LAYOUT.margin * 2,
      h: 0.6,
      fontSize: 18,
      color: 'FFFFFF',
      fontFace: FONTS.body,
      align: 'center',
      transparency: 30,
    });
  }
};

// 渲染器映射
const RENDERERS: Record<SlideType, SlideRenderer> = {
  cover: renderCoverSlide,
  toc: renderTocSlide,
  section: renderSectionSlide,
  content: renderContentSlide,
  summary: renderSummarySlide,
  thanks: renderThanksSlide,
};

// ============ 主导出函数 ============

/**
 * 生成PPTX文件
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
  pptx.layout = 'LAYOUT_16x9';

  // 渲染每一页
  slides.forEach((slideContent) => {
    const slide = pptx.addSlide();
    const renderer = RENDERERS[slideContent.type];

    if (renderer) {
      renderer(slide, slideContent, language);
    } else {
      // 默认使用内容页模板
      renderContentSlide(slide, slideContent, language);
    }

    // 添加演讲备注
    if (slideContent.notes) {
      slide.addNotes(slideContent.notes);
    }
  });

  // 导出为base64
  const base64 = await pptx.write({ outputType: 'base64' }) as string;
  return `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`;
}
