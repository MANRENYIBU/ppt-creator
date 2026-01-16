/**
 * DSL 渲染器
 * 将 DSL 格式的幻灯片数据渲染为 PPTX
 */

import PptxGenJS from 'pptxgenjs'
import type {
  PresentationDSL,
  SlideDSL,
  ContentBlock,
  SlideLayout,
  CodeBlock,
  TableBlock,
  QuoteBlock,
  ParagraphBlock,
  BulletsBlock,
  NumberedBlock,
} from '@/types/slide-dsl'

// ============ 主题配置 ============

const THEME = {
  primary: '2563EB',       // blue-600
  primaryDark: '1D4ED8',   // blue-700
  secondary: '6366F1',     // indigo-500
  text: '1F2937',          // gray-800
  textMuted: '6B7280',     // gray-500
  textLight: '9CA3AF',     // gray-400
  background: 'FFFFFF',
  backgroundAlt: 'F9FAFB', // gray-50
  backgroundCode: 'F3F4F6', // gray-100
  border: 'E5E7EB',        // gray-200
  accent: '10B981',        // emerald-500
  quote: 'F59E0B',         // amber-500
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

  constructor() {
    this.pptx = new PptxGenJS()
    this.pptx.layout = 'LAYOUT_16x9'
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
    slide.background = { color: THEME.primary }

    // 装饰圆形
    slide.addShape('ellipse', {
      x: -1, y: -1, w: 4, h: 4,
      fill: { color: THEME.primaryDark, transparency: 50 },
    })
    slide.addShape('ellipse', {
      x: 7, y: 3, w: 5, h: 5,
      fill: { color: THEME.secondary, transparency: 60 },
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
    slide.background = { color: THEME.backgroundAlt }

    // 章节标题
    if (dsl.title) {
      slide.addText(dsl.title, {
        x: LAYOUT.margin,
        y: 2,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: 1.2,
        fontSize: 44,
        bold: true,
        color: THEME.primary,
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
      fill: { color: THEME.primary },
    })

    // 副标题（如果有）
    if (dsl.subtitle) {
      slide.addText(dsl.subtitle, {
        x: LAYOUT.margin,
        y: 3.7,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: 0.6,
        fontSize: 18,
        color: THEME.textMuted,
        fontFace: FONTS.body,
        align: 'center',
      })
    }
  }

  /**
   * 标题+内容布局（最常用）
   */
  private renderTitleContent(slide: PptxGenJS.Slide, dsl: SlideDSL): void {
    slide.background = { color: THEME.background }

    // 顶部装饰条
    slide.addShape('rect', {
      x: 0, y: 0, w: 0.08, h: 1.1,
      fill: { color: THEME.primary },
    })
    slide.addShape('rect', {
      x: 0, y: 0, w: LAYOUT.width, h: 1.1,
      fill: { color: THEME.backgroundAlt },
    })
    slide.addShape('rect', {
      x: 0, y: 0, w: 0.08, h: 1.1,
      fill: { color: THEME.primary },
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
        color: THEME.text,
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
    slide.background = { color: THEME.background }

    // 标题区域
    this.renderSlideHeader(slide, dsl.title)

    const columnWidth = (LAYOUT.width - LAYOUT.margin * 2 - LAYOUT.columnGap) / 2

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
    slide.background = { color: THEME.background }

    // 标题
    this.renderSlideHeader(slide, dsl.title)

    const columnWidth = (LAYOUT.width - LAYOUT.margin * 2 - LAYOUT.columnGap) / 2

    // 左侧标签
    slide.addShape('rect', {
      x: LAYOUT.margin,
      y: LAYOUT.contentStartY - 0.05,
      w: columnWidth,
      h: 0.4,
      fill: { color: THEME.primary },
    })

    // 右侧标签
    slide.addShape('rect', {
      x: LAYOUT.margin + columnWidth + LAYOUT.columnGap,
      y: LAYOUT.contentStartY - 0.05,
      w: columnWidth,
      h: 0.4,
      fill: { color: THEME.secondary },
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
      x: 0, y: 0, w: LAYOUT.width, h: 1.1,
      fill: { color: THEME.backgroundAlt },
    })
    slide.addShape('rect', {
      x: 0, y: 0, w: 0.08, h: 1.1,
      fill: { color: THEME.primary },
    })

    if (title) {
      slide.addText(title, {
        x: LAYOUT.margin,
        y: LAYOUT.titleY,
        w: LAYOUT.width - LAYOUT.margin * 2,
        h: LAYOUT.titleHeight,
        fontSize: 26,
        bold: true,
        color: THEME.text,
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
    startPos: Position
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
    pos: Position
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
    pos: Position
  ): number {
    // 估算高度（每50字符约0.25英寸）
    const lines = Math.ceil(block.text.length / 50)
    const height = Math.max(0.4, lines * 0.25)

    let color = THEME.text
    if (block.emphasis === 'highlight') {
      color = THEME.primary
    } else if (block.emphasis === 'muted') {
      color = THEME.textMuted
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
    pos: Position
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
        fill: { color: THEME.primary },
      })

      // 文字
      slide.addText(item, {
        x: pos.x + 0.3,
        y: itemY,
        w: pos.w - 0.3,
        h: itemHeight,
        fontSize: 15,
        color: THEME.text,
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
    pos: Position
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
        color: THEME.primary,
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
        color: THEME.text,
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
    pos: Position
  ): number {
    const lineHeight = 0.22
    const padding = 0.15
    const height = block.lines.length * lineHeight + padding * 2

    // 背景
    slide.addShape('rect', {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: Math.min(height, 2.5), // 限制最大高度
      fill: { color: THEME.backgroundCode },
      line: { color: THEME.border, width: 0.5 },
    })

    // 语言标签
    if (block.language) {
      slide.addText(block.language.toUpperCase(), {
        x: pos.x + pos.w - 0.8,
        y: pos.y + 0.05,
        w: 0.7,
        h: 0.2,
        fontSize: 8,
        color: THEME.textMuted,
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
      h: Math.min(height - padding * 2, 2.2),
      fontSize: 10,
      color: THEME.text,
      fontFace: FONTS.code,
      valign: 'top',
    })

    // 标题（如果有）
    if (block.caption) {
      slide.addText(block.caption, {
        x: pos.x,
        y: pos.y + Math.min(height, 2.5) + 0.05,
        w: pos.w,
        h: 0.2,
        fontSize: 10,
        color: THEME.textMuted,
        fontFace: FONTS.body,
        align: 'center',
      })
      return Math.min(height, 2.5) + 0.3
    }

    return Math.min(height, 2.5)
  }

  /**
   * 渲染表格
   */
  private renderTable(
    slide: PptxGenJS.Slide,
    block: TableBlock,
    pos: Position
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
          fill: { color: THEME.primary },
          color: 'FFFFFF',
          fontSize: 12,
          fontFace: FONTS.body,
          align: 'center' as const,
          valign: 'middle' as const,
        },
      }))
    )

    // 数据行
    block.rows.forEach((row, rowIndex) => {
      tableData.push(
        row.map((cell) => ({
          text: cell,
          options: {
            fill: { color: rowIndex % 2 === 0 ? THEME.backgroundAlt : THEME.background },
            color: THEME.text,
            fontSize: 11,
            fontFace: FONTS.body,
            align: 'center' as const,
            valign: 'middle' as const,
          },
        }))
      )
    })

    slide.addTable(tableData, {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      rowH: rowHeight,
      border: { type: 'solid', pt: 0.5, color: THEME.border },
    })

    // 标题（如果有）
    if (block.caption) {
      slide.addText(block.caption, {
        x: pos.x,
        y: pos.y + height + 0.05,
        w: pos.w,
        h: 0.2,
        fontSize: 10,
        color: THEME.textMuted,
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
    pos: Position
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
      fill: { color: THEME.quote },
    })

    // 引用符号
    slide.addText('"', {
      x: pos.x + 0.15,
      y: pos.y - 0.1,
      w: 0.3,
      h: 0.4,
      fontSize: 32,
      color: THEME.quote,
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
      color: THEME.text,
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
        color: THEME.textMuted,
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
  topic: string
): Promise<string> {
  const renderer = new DSLRenderer()
  renderer.render(presentation, topic)
  return renderer.export()
}
