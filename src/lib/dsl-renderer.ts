/**
 * DSL 渲染器
 * 将 DSL 格式的幻灯片数据渲染为 PPTX
 */

import PptxGenJS from 'pptxgenjs'
import type {
  PresentationDSL,
  SlideDSL,
  ContentBlock,
  CodeBlock,
  TableBlock,
  QuoteBlock,
  ParagraphBlock,
  BulletsBlock,
  NumberedBlock,
} from '@/types/slide-dsl'

// ============ 主题类型定义 ============

export type ThemeName =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'slate'
  | 'teal'
  | 'rose'

export interface ThemeColors {
  primary: string
  primaryDark: string
  secondary: string
  text: string
  textMuted: string
  textLight: string
  background: string
  backgroundAlt: string
  backgroundCode: string
  border: string
  accent: string
  quote: string
}

// ============ 主题配置 ============

const THEMES: Record<ThemeName, ThemeColors> = {
  // 蓝色主题 - 专业商务（默认）
  blue: {
    primary: '2563EB', // blue-600
    primaryDark: '1D4ED8', // blue-700
    secondary: '6366F1', // indigo-500
    text: '1F2937', // gray-800
    textMuted: '6B7280', // gray-500
    textLight: '9CA3AF', // gray-400
    background: 'FFFFFF',
    backgroundAlt: 'EFF6FF', // blue-50
    backgroundCode: 'F3F4F6', // gray-100
    border: 'DBEAFE', // blue-100
    accent: '10B981', // emerald-500
    quote: '3B82F6', // blue-500
  },
  // 绿色主题 - 自然清新
  green: {
    primary: '16A34A', // green-600
    primaryDark: '15803D', // green-700
    secondary: '22C55E', // green-500
    text: '1F2937',
    textMuted: '6B7280',
    textLight: '9CA3AF',
    background: 'FFFFFF',
    backgroundAlt: 'F0FDF4', // green-50
    backgroundCode: 'F3F4F6',
    border: 'DCFCE7', // green-100
    accent: '0D9488', // teal-600
    quote: '22C55E', // green-500
  },
  // 青色主题 - 科技现代
  teal: {
    primary: '0D9488', // teal-600
    primaryDark: '0F766E', // teal-700
    secondary: '14B8A6', // teal-500
    text: '1F2937',
    textMuted: '6B7280',
    textLight: '9CA3AF',
    background: 'FFFFFF',
    backgroundAlt: 'F0FDFA', // teal-50
    backgroundCode: 'F3F4F6',
    border: 'CCFBF1', // teal-100
    accent: '06B6D4', // cyan-500
    quote: '14B8A6', // teal-500
  },
  // 紫色主题 - 创意优雅
  purple: {
    primary: '9333EA', // purple-600
    primaryDark: '7E22CE', // purple-700
    secondary: 'A855F7', // purple-500
    text: '1F2937',
    textMuted: '6B7280',
    textLight: '9CA3AF',
    background: 'FFFFFF',
    backgroundAlt: 'FAF5FF', // purple-50
    backgroundCode: 'F3F4F6',
    border: 'F3E8FF', // purple-100
    accent: 'EC4899', // pink-500
    quote: 'A855F7', // purple-500
  },
  // 橙色主题 - 活力热情
  orange: {
    primary: 'EA580C', // orange-600
    primaryDark: 'C2410C', // orange-700
    secondary: 'F97316', // orange-500
    text: '1F2937',
    textMuted: '6B7280',
    textLight: '9CA3AF',
    background: 'FFFFFF',
    backgroundAlt: 'FFF7ED', // orange-50
    backgroundCode: 'F3F4F6',
    border: 'FFEDD5', // orange-100
    accent: 'FBBF24', // amber-400
    quote: 'F97316', // orange-500
  },
  // 红色主题 - 大胆醒目
  red: {
    primary: 'DC2626', // red-600
    primaryDark: 'B91C1C', // red-700
    secondary: 'EF4444', // red-500
    text: '1F2937',
    textMuted: '6B7280',
    textLight: '9CA3AF',
    background: 'FFFFFF',
    backgroundAlt: 'FEF2F2', // red-50
    backgroundCode: 'F3F4F6',
    border: 'FEE2E2', // red-100
    accent: 'F59E0B', // amber-500
    quote: 'EF4444', // red-500
  },
  // 玫瑰主题 - 温暖柔和
  rose: {
    primary: 'E11D48', // rose-600
    primaryDark: 'BE123C', // rose-700
    secondary: 'F43F5E', // rose-500
    text: '1F2937',
    textMuted: '6B7280',
    textLight: '9CA3AF',
    background: 'FFFFFF',
    backgroundAlt: 'FFF1F2', // rose-50
    backgroundCode: 'F3F4F6',
    border: 'FFE4E6', // rose-100
    accent: 'EC4899', // pink-500
    quote: 'F43F5E', // rose-500
  },
  // 石板主题 - 简约现代
  slate: {
    primary: '475569', // slate-600
    primaryDark: '334155', // slate-700
    secondary: '64748B', // slate-500
    text: '1E293B', // slate-800
    textMuted: '64748B', // slate-500
    textLight: '94A3B8', // slate-400
    background: 'FFFFFF',
    backgroundAlt: 'F8FAFC', // slate-50
    backgroundCode: 'F1F5F9', // slate-100
    border: 'E2E8F0', // slate-200
    accent: '0EA5E9', // sky-500
    quote: '64748B', // slate-500
  },
}

// 默认主题
const DEFAULT_THEME: ThemeName = 'blue'

// 获取主题颜色
export function getTheme(name?: ThemeName): ThemeColors {
  return THEMES[name || DEFAULT_THEME] || THEMES[DEFAULT_THEME]
}

// 获取所有可用主题名称
export function getAvailableThemes(): ThemeName[] {
  return Object.keys(THEMES) as ThemeName[]
}

const FONTS = {
  title: 'Microsoft YaHei',
  body: 'Microsoft YaHei',
  code: 'Consolas',
}

// 布局配置（16:9，单位：英寸）
const LAYOUT = {
  width: 10,
  height: 5.625,
  margin: 0.5,
  titleY: 0.35,
  titleHeight: 0.7,
  contentStartY: 1.3,
  contentEndY: 5.2,
  columnGap: 0.3,
}

// ============ 位置类型 ============

interface Position {
  x: number
  y: number
  w: number
}

// ============ 渲染器类 ============

export class DSLRenderer {
  private pptx: PptxGenJS
  private theme: ThemeColors

  constructor(themeName?: ThemeName) {
    this.pptx = new PptxGenJS()
    this.pptx.layout = 'LAYOUT_16x9'
    this.theme = getTheme(themeName)
  }

  /**
   * 渲染完整演示文稿
   */
  render(presentation: PresentationDSL, topic: string): PptxGenJS {
    this.pptx.author = 'AI PPT Creator'
    this.pptx.title = topic
    this.pptx.subject = topic

    for (const slideDSL of presentation.slides) {
      this.renderSlide(slideDSL)
    }

    return this.pptx
  }

  /**
   * 导出为 base64 Data URL
   */
  async export(): Promise<string> {
    const base64 = (await this.pptx.write({ outputType: 'base64' })) as string
    return `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`
  }

  /**
   * 渲染单张幻灯片
   */
  private renderSlide(dsl: SlideDSL): void {
    const slide = this.pptx.addSlide()

    // 根据布局类型选择渲染方法
    switch (dsl.layout) {
      case 'title-only':
        this.renderTitleOnly(slide, dsl)
        break
      case 'section':
        this.renderSection(slide, dsl)
        break
      case 'title-content':
        this.renderTitleContent(slide, dsl)
        break
      case 'two-column':
        this.renderTwoColumn(slide, dsl)
        break
      case 'comparison':
        this.renderComparison(slide, dsl)
        break
      default:
        this.renderTitleContent(slide, dsl)
    }

    // 添加演讲者备注
    if (dsl.notes) {
      slide.addNotes(dsl.notes)
    }
  }

  // ============ 布局渲染器 ============

  /**
   * 仅标题布局（适合封面页）
   */
  private renderTitleOnly(slide: PptxGenJS.Slide, dsl: SlideDSL): void {
    slide.background = { color: this.theme.primary }

    // 装饰圆形
    slide.addShape('ellipse', {
      x: -1,
      y: -1,
      w: 4,
      h: 4,
      fill: { color: this.theme.primaryDark, transparency: 50 },
    })
    slide.addShape('ellipse', {
      x: 7,
      y: 3,
      w: 5,
      h: 5,
      fill: { color: this.theme.secondary, transparency: 60 },
    })

    // 主标题
    if (dsl.title) {
      slide.addText(dsl.title, {
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
      })
    }

    // 副标题
    if (dsl.subtitle) {
      slide.addText(dsl.subtitle, {
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
      })
    }
  }

  /**
   * 章节分隔页布局
   */
  private renderSection(slide: PptxGenJS.Slide, dsl: SlideDSL): void {
    slide.background = { color: this.theme.backgroundAlt }

    // 章节标题
    if (dsl.title) {
      slide.addText(dsl.title, {
        x: LAYOUT.margin,
        y: 2,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: 1.2,
        fontSize: 44,
        bold: true,
        color: this.theme.primary,
        fontFace: FONTS.title,
        align: 'center',
        valign: 'middle',
      })
    }

    // 装饰线
    slide.addShape('rect', {
      x: (LAYOUT.width - 2) / 2,
      y: 3.4,
      w: 2,
      h: 0.08,
      fill: { color: this.theme.primary },
    })

    // 副标题（如果有）
    if (dsl.subtitle) {
      slide.addText(dsl.subtitle, {
        x: LAYOUT.margin,
        y: 3.7,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: 0.6,
        fontSize: 18,
        color: this.theme.textMuted,
        fontFace: FONTS.body,
        align: 'center',
      })
    }
  }

  /**
   * 标题+内容布局（最常用）
   */
  private renderTitleContent(slide: PptxGenJS.Slide, dsl: SlideDSL): void {
    slide.background = { color: this.theme.background }

    // 顶部装饰条
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.08,
      h: 1.1,
      fill: { color: this.theme.primary },
    })
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: LAYOUT.width,
      h: 1.1,
      fill: { color: this.theme.backgroundAlt },
    })
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.08,
      h: 1.1,
      fill: { color: this.theme.primary },
    })

    // 标题
    if (dsl.title) {
      slide.addText(dsl.title, {
        x: LAYOUT.margin,
        y: LAYOUT.titleY,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: LAYOUT.titleHeight,
        fontSize: 26,
        bold: true,
        color: this.theme.text,
        fontFace: FONTS.title,
        valign: 'middle',
      })
    }

    // 内容块
    if (dsl.content && dsl.content.length > 0) {
      const pos: Position = {
        x: LAYOUT.margin,
        y: LAYOUT.contentStartY,
        w: LAYOUT.width - LAYOUT.margin * 2,
      }
      this.renderContentBlocks(slide, dsl.content, pos)
    }
  }

  /**
   * 双栏布局
   */
  private renderTwoColumn(slide: PptxGenJS.Slide, dsl: SlideDSL): void {
    slide.background = { color: this.theme.background }

    // 标题区域
    this.renderSlideHeader(slide, dsl.title)

    const columnWidth =
      (LAYOUT.width - LAYOUT.margin * 2 - LAYOUT.columnGap) / 2

    // 左栏
    if (dsl.leftContent && dsl.leftContent.length > 0) {
      const leftPos: Position = {
        x: LAYOUT.margin,
        y: LAYOUT.contentStartY,
        w: columnWidth,
      }
      this.renderContentBlocks(slide, dsl.leftContent, leftPos)
    }

    // 右栏
    if (dsl.rightContent && dsl.rightContent.length > 0) {
      const rightPos: Position = {
        x: LAYOUT.margin + columnWidth + LAYOUT.columnGap,
        y: LAYOUT.contentStartY,
        w: columnWidth,
      }
      this.renderContentBlocks(slide, dsl.rightContent, rightPos)
    }
  }

  /**
   * 对比布局（类似双栏但有标签）
   */
  private renderComparison(slide: PptxGenJS.Slide, dsl: SlideDSL): void {
    slide.background = { color: this.theme.background }

    // 标题
    this.renderSlideHeader(slide, dsl.title)

    const columnWidth =
      (LAYOUT.width - LAYOUT.margin * 2 - LAYOUT.columnGap) / 2

    // 左侧标签
    slide.addShape('rect', {
      x: LAYOUT.margin,
      y: LAYOUT.contentStartY - 0.05,
      w: columnWidth,
      h: 0.4,
      fill: { color: this.theme.primary },
    })

    // 右侧标签
    slide.addShape('rect', {
      x: LAYOUT.margin + columnWidth + LAYOUT.columnGap,
      y: LAYOUT.contentStartY - 0.05,
      w: columnWidth,
      h: 0.4,
      fill: { color: this.theme.secondary },
    })

    // 左栏内容
    if (dsl.leftContent && dsl.leftContent.length > 0) {
      const leftPos: Position = {
        x: LAYOUT.margin,
        y: LAYOUT.contentStartY + 0.5,
        w: columnWidth,
      }
      this.renderContentBlocks(slide, dsl.leftContent, leftPos)
    }

    // 右栏内容
    if (dsl.rightContent && dsl.rightContent.length > 0) {
      const rightPos: Position = {
        x: LAYOUT.margin + columnWidth + LAYOUT.columnGap,
        y: LAYOUT.contentStartY + 0.5,
        w: columnWidth,
      }
      this.renderContentBlocks(slide, dsl.rightContent, rightPos)
    }
  }

  // ============ 通用组件 ============

  /**
   * 渲染幻灯片头部（标题区）
   */
  private renderSlideHeader(slide: PptxGenJS.Slide, title?: string): void {
    // 顶部装饰
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: LAYOUT.width,
      h: 1.1,
      fill: { color: this.theme.backgroundAlt },
    })
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.08,
      h: 1.1,
      fill: { color: this.theme.primary },
    })

    if (title) {
      slide.addText(title, {
        x: LAYOUT.margin,
        y: LAYOUT.titleY,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: LAYOUT.titleHeight,
        fontSize: 26,
        bold: true,
        color: this.theme.text,
        fontFace: FONTS.title,
        valign: 'middle',
      })
    }
  }

  // ============ 内容块渲染 ============

  /**
   * 渲染多个内容块
   */
  private renderContentBlocks(
    slide: PptxGenJS.Slide,
    blocks: ContentBlock[],
    startPos: Position,
  ): void {
    let currentY = startPos.y

    for (const block of blocks) {
      // 防止溢出
      if (currentY > LAYOUT.contentEndY) break

      const height = this.renderContentBlock(slide, block, {
        ...startPos,
        y: currentY,
      })

      currentY += height + 0.15 // 块间距
    }
  }

  /**
   * 渲染单个内容块
   */
  private renderContentBlock(
    slide: PptxGenJS.Slide,
    block: ContentBlock,
    pos: Position,
  ): number {
    switch (block.type) {
      case 'paragraph':
        return this.renderParagraph(slide, block, pos)
      case 'bullets':
        return this.renderBullets(slide, block, pos)
      case 'numbered':
        return this.renderNumbered(slide, block, pos)
      case 'code':
        return this.renderCode(slide, block, pos)
      case 'table':
        return this.renderTable(slide, block, pos)
      case 'quote':
        return this.renderQuote(slide, block, pos)
      default:
        return 0
    }
  }

  /**
   * 渲染段落
   */
  private renderParagraph(
    slide: PptxGenJS.Slide,
    block: ParagraphBlock,
    pos: Position,
  ): number {
    // 估算高度（每50字符约0.25英寸）
    const lines = Math.ceil(block.text.length / 50)
    const height = Math.max(0.4, lines * 0.25)

    let color = this.theme.text
    if (block.emphasis === 'highlight') {
      color = this.theme.primary
    } else if (block.emphasis === 'muted') {
      color = this.theme.textMuted
    }

    slide.addText(block.text, {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: height,
      fontSize: 16,
      color,
      fontFace: FONTS.body,
      valign: 'top',
    })

    return height
  }

  /**
   * 渲染无序列表
   */
  private renderBullets(
    slide: PptxGenJS.Slide,
    block: BulletsBlock,
    pos: Position,
  ): number {
    const itemHeight = 0.35
    const height = block.items.length * itemHeight

    block.items.forEach((item, i) => {
      const itemY = pos.y + i * itemHeight

      // 圆点
      slide.addShape('ellipse', {
        x: pos.x,
        y: itemY + 0.1,
        w: 0.15,
        h: 0.15,
        fill: { color: this.theme.primary },
      })

      // 文字
      slide.addText(item, {
        x: pos.x + 0.3,
        y: itemY,
        w: pos.w - 0.3,
        h: itemHeight,
        fontSize: 15,
        color: this.theme.text,
        fontFace: FONTS.body,
        valign: 'middle',
      })
    })

    return height
  }

  /**
   * 渲染有序列表
   */
  private renderNumbered(
    slide: PptxGenJS.Slide,
    block: NumberedBlock,
    pos: Position,
  ): number {
    const itemHeight = 0.35
    const height = block.items.length * itemHeight

    block.items.forEach((item, i) => {
      const itemY = pos.y + i * itemHeight

      // 序号
      slide.addText(`${i + 1}.`, {
        x: pos.x,
        y: itemY,
        w: 0.3,
        h: itemHeight,
        fontSize: 15,
        bold: true,
        color: this.theme.primary,
        fontFace: FONTS.body,
        valign: 'middle',
      })

      // 文字
      slide.addText(item, {
        x: pos.x + 0.35,
        y: itemY,
        w: pos.w - 0.35,
        h: itemHeight,
        fontSize: 15,
        color: this.theme.text,
        fontFace: FONTS.body,
        valign: 'middle',
      })
    })

    return height
  }

  /**
   * 渲染代码块
   */
  private renderCode(
    slide: PptxGenJS.Slide,
    block: CodeBlock,
    pos: Position,
  ): number {
    const lineHeight = 0.16 // 减小行高以容纳更多行
    const padding = 0.12
    const height = block.lines.length * lineHeight + padding * 2
    const maxHeight = 3.5 // 增加最大高度

    // 背景
    slide.addShape('rect', {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: Math.min(height, maxHeight),
      fill: { color: this.theme.backgroundCode },
      line: { color: this.theme.border, width: 0.5 },
    })

    // 语言标签
    if (block.language) {
      slide.addText(block.language.toUpperCase(), {
        x: pos.x + pos.w - 0.8,
        y: pos.y + 0.03,
        w: 0.7,
        h: 0.18,
        fontSize: 7,
        color: this.theme.textMuted,
        fontFace: FONTS.code,
        align: 'right',
      })
    }

    // 代码内容
    const code = block.lines.join('\n')
    slide.addText(code, {
      x: pos.x + padding,
      y: pos.y + padding,
      w: pos.w - padding * 2,
      h: Math.min(height - padding * 2, maxHeight - padding * 2),
      fontSize: 8, // 减小字体
      color: this.theme.text,
      fontFace: FONTS.code,
      valign: 'top',
    })

    // 标题（如果有）
    if (block.caption) {
      slide.addText(block.caption, {
        x: pos.x,
        y: pos.y + Math.min(height, maxHeight) + 0.05,
        w: pos.w,
        h: 0.2,
        fontSize: 9,
        color: this.theme.textMuted,
        fontFace: FONTS.body,
        align: 'center',
      })
      return Math.min(height, maxHeight) + 0.3
    }

    return Math.min(height, maxHeight)
  }

  /**
   * 渲染表格
   */
  private renderTable(
    slide: PptxGenJS.Slide,
    block: TableBlock,
    pos: Position,
  ): number {
    const rowHeight = 0.35
    const totalRows = 1 + block.rows.length // 表头 + 数据行
    const height = totalRows * rowHeight

    // 构建表格数据
    const tableData: PptxGenJS.TableRow[] = []

    // 表头
    tableData.push(
      block.headers.map((h) => ({
        text: h,
        options: {
          bold: true,
          fill: { color: this.theme.primary },
          color: 'FFFFFF',
          fontSize: 12,
          fontFace: FONTS.body,
          align: 'center' as const,
          valign: 'middle' as const,
        },
      })),
    )

    // 数据行
    block.rows.forEach((row, rowIndex) => {
      tableData.push(
        row.map((cell) => ({
          text: cell,
          options: {
            fill: {
              color:
                rowIndex % 2 === 0
                  ? this.theme.backgroundAlt
                  : this.theme.background,
            },
            color: this.theme.text,
            fontSize: 11,
            fontFace: FONTS.body,
            align: 'center' as const,
            valign: 'middle' as const,
          },
        })),
      )
    })

    slide.addTable(tableData, {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      rowH: rowHeight,
      border: { type: 'solid', pt: 0.5, color: this.theme.border },
    })

    // 标题（如果有）
    if (block.caption) {
      slide.addText(block.caption, {
        x: pos.x,
        y: pos.y + height + 0.05,
        w: pos.w,
        h: 0.2,
        fontSize: 10,
        color: this.theme.textMuted,
        fontFace: FONTS.body,
        align: 'center',
      })
      return height + 0.3
    }

    return height
  }

  /**
   * 渲染引用块
   */
  private renderQuote(
    slide: PptxGenJS.Slide,
    block: QuoteBlock,
    pos: Position,
  ): number {
    // 估算高度
    const lines = Math.ceil(block.text.length / 45)
    const textHeight = Math.max(0.5, lines * 0.25)
    const authorHeight = block.author ? 0.25 : 0
    const height = textHeight + authorHeight + 0.1

    // 左侧装饰线
    slide.addShape('rect', {
      x: pos.x,
      y: pos.y,
      w: 0.06,
      h: height,
      fill: { color: this.theme.quote },
    })

    // 引用符号
    slide.addText('"', {
      x: pos.x + 0.15,
      y: pos.y - 0.1,
      w: 0.3,
      h: 0.4,
      fontSize: 32,
      color: this.theme.quote,
      fontFace: FONTS.title,
      bold: true,
    })

    // 引用文字
    slide.addText(block.text, {
      x: pos.x + 0.2,
      y: pos.y + 0.15,
      w: pos.w - 0.3,
      h: textHeight,
      fontSize: 14,
      italic: true,
      color: this.theme.text,
      fontFace: FONTS.body,
      valign: 'top',
    })

    // 作者
    if (block.author) {
      slide.addText(`— ${block.author}`, {
        x: pos.x + 0.2,
        y: pos.y + textHeight + 0.2,
        w: pos.w - 0.3,
        h: authorHeight,
        fontSize: 12,
        color: this.theme.textMuted,
        fontFace: FONTS.body,
        align: 'right',
      })
    }

    return height
  }
}

// ============ 便捷导出函数 ============

/**
 * 从DSL生成PPTX并返回base64 Data URL
 */
export async function generatePPTXFromDSL(
  presentation: PresentationDSL,
  topic: string,
  theme?: ThemeName,
): Promise<string> {
  const renderer = new DSLRenderer(theme)
  renderer.render(presentation, topic)
  return renderer.export()
}
