# AI生成PPT内容增强技术调研报告

## 1. 背景与问题分析

### 1.1 当前方案的局限性

当前PPT生成流程采用结构化数据模式：

```
AI生成结构化JSON → PptxGenJS渲染固定模板 → 输出PPTX
```

**存在的问题：**

| 问题 | 描述 |
|------|------|
| 内容单一 | 仅支持标题+要点列表，无法展示代码、表格、图表等 |
| 布局固定 | 模板预定义，无法根据内容动态调整 |
| 样式僵化 | 所有幻灯片样式一致，缺乏视觉层次 |
| AI能力受限 | AI只能填充预设字段，无法发挥创意排版能力 |

### 1.2 期望目标

- 支持丰富内容类型：文本段落、代码块、表格、列表、引用等
- 动态布局：AI根据内容自主决定排版方式
- 视觉多样性：不同页面可有不同风格
- 充分发挥AI能力：让AI像设计师一样思考内容呈现

---

## 2. 技术方案调研

### 2.1 方案一：AI生成HTML + html-to-pptx转换

**原理：** AI直接生成HTML代码，使用工具转换为PPTX

**可用工具：**

| 工具 | 类型 | 优点 | 缺点 |
|------|------|------|------|
| [html-to-pptx](https://github.com/nicknisi/html-to-pptx) | npm包 | 简单直接 | 功能有限，已停止维护 |
| [Pandoc](https://pandoc.org/) | CLI工具 | 格式转换强大 | 需要系统安装，HTML→PPTX支持有限 |
| [LibreOffice](https://www.libreoffice.org/) | Headless服务 | 转换效果好 | 需要服务器安装，资源消耗大 |
| [CloudConvert API](https://cloudconvert.com/) | 云服务 | 效果稳定 | 收费，依赖外部服务 |

**关键问题：HTML→PPTX的转换质量普遍不理想**

HTML和PPTX是完全不同的格式：
- HTML：流式布局，响应式
- PPTX：固定画布，绝对定位

直接转换会导致：布局错乱、样式丢失、元素重叠等问题。

### 2.2 方案二：AI生成Markdown + 增强渲染

**原理：** AI生成Markdown，解析后映射到PptxGenJS元素

```
AI生成Markdown → 解析AST → 映射到PPTX元素 → 渲染输出
```

**Markdown支持的元素：**
- 标题层级（H1-H6）
- 段落文本
- 代码块（带语法高亮）
- 表格
- 有序/无序列表
- 引用块
- 粗体/斜体/链接

**优点：**
- Markdown语法简单，AI生成准确率高
- 解析库成熟（marked, remark, markdown-it）
- 可控性强，便于后处理

**缺点：**
- 布局控制有限
- 无法表达复杂样式

### 2.3 方案三：AI生成PptxGenJS指令

**原理：** 让AI直接生成PptxGenJS的JSON配置

```typescript
// AI生成的配置示例
{
  "slides": [
    {
      "elements": [
        { "type": "text", "text": "标题", "options": { "x": 0.5, "y": 0.5, "fontSize": 36 } },
        { "type": "table", "data": [...], "options": { "x": 0.5, "y": 2, "w": 9 } },
        { "type": "shape", "shape": "rect", "options": { "x": 0.5, "y": 5, "fill": "#f0f0f0" } }
      ]
    }
  ]
}
```

**优点：**
- 直接映射到PPTX，无转换损失
- 完全控制布局和样式
- AI可以像设计师一样精确定位元素

**缺点：**
- 配置复杂，AI生成错误率高
- 坐标计算容易出错
- 需要AI理解PptxGenJS API

### 2.4 方案四：JSON DSL中间格式（推荐）

**原理：** 设计一套简化的JSON领域特定语言(DSL)，平衡表达能力和生成准确性

```json
{
  "slides": [
    {
      "layout": "title-content",
      "title": "Go语言并发模型",
      "content": [
        {
          "type": "paragraph",
          "text": "Go语言通过goroutine和channel实现CSP并发模型，提供了简洁而强大的并发编程能力。"
        },
        {
          "type": "code",
          "language": "go",
          "lines": [
            "func main() {",
            "    ch := make(chan int)",
            "    go func() { ch <- 42 }()",
            "    fmt.Println(<-ch)",
            "}"
          ]
        },
        {
          "type": "table",
          "headers": ["特性", "Goroutine", "Thread"],
          "rows": [
            ["内存占用", "2KB", "1MB"],
            ["创建速度", "快", "慢"]
          ]
        },
        {
          "type": "quote",
          "text": "Don't communicate by sharing memory; share memory by communicating.",
          "author": "Rob Pike"
        }
      ]
    }
  ]
}
```

### 2.5 为什么选择JSON而非YAML

| 对比维度 | JSON | YAML |
|----------|------|------|
| AI生成准确率 | **极高**（训练数据充足） | 中（缩进易出错） |
| 缩进敏感 | ✓ 不敏感 | ✗ 致命问题 |
| 解析复杂度 | 低（`JSON.parse()`） | 高（需要额外库） |
| 格式歧义 | 无（唯一写法） | 有（多种表示方式） |
| 特殊字符处理 | 只需转义引号 | 冒号、引号易冲突 |
| Schema验证 | 生态成熟（ajv, zod） | 相对薄弱 |

**多行字符串处理方案：**

代码块使用数组表示每一行，避免转义问题：
```json
{
  "type": "code",
  "language": "python",
  "lines": [
    "def hello():",
    "    print(\"Hello, World!\")",
    "    return True"
  ]
}
```

**设计要点：**

1. **布局模板系统**
   - `title-only`: 仅标题
   - `title-content`: 标题+内容区
   - `two-column`: 双栏布局
   - `section`: 章节分隔页
   - `comparison`: 对比布局

2. **内容类型**
   - `paragraph`: 文本段落
   - `bullets`: 要点列表
   - `numbered`: 编号列表
   - `code`: 代码块
   - `table`: 表格
   - `quote`: 引用

3. **样式提示**
   - `emphasis`: 强调级别（normal/highlight/muted）

**优点：**
- AI生成准确率极高
- 解析简单稳定
- Schema验证成熟
- 易于调试和纠错

---

## 3. 推荐方案详细设计

### 3.1 整体架构

```
用户输入主题
    ↓
收集资料 (现有)
    ↓
生成大纲 (现有)
    ↓
┌─────────────────────────────────┐
│  AI生成JSON DSL内容 (新增)       │
│  - 每个章节生成多张幻灯片         │
│  - 指定布局模板和内容类型         │
│  - 包含代码、表格、引用等         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  JSON解析与验证 (新增)           │
│  - JSON.parse()                 │
│  - Schema验证 (zod/ajv)         │
│  - 错误修复尝试                  │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  增强版PptxGenJS渲染器 (改造)     │
│  - 布局模板引擎                   │
│  - 代码块渲染                     │
│  - 表格渲染                       │
│  - 智能排版                       │
└─────────────────────────────────┘
    ↓
输出PPTX
```

### 3.2 DSL Schema定义

```typescript
// src/types/slide-dsl.ts

// 布局类型
type SlideLayout =
  | 'title-only'
  | 'title-content'
  | 'two-column'
  | 'section'
  | 'comparison';

// 内容块类型
interface ParagraphBlock {
  type: 'paragraph';
  text: string;
  emphasis?: 'normal' | 'highlight' | 'muted';
}

interface BulletsBlock {
  type: 'bullets';
  items: string[];
}

interface NumberedBlock {
  type: 'numbered';
  items: string[];
}

interface CodeBlock {
  type: 'code';
  language: string;
  lines: string[];  // 使用数组避免转义
  caption?: string;
}

interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
}

interface QuoteBlock {
  type: 'quote';
  text: string;
  author?: string;
}

type ContentBlock =
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | CodeBlock
  | TableBlock
  | QuoteBlock;

// 单张幻灯片
interface SlideDSL {
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  content?: ContentBlock[];
  leftContent?: ContentBlock[];   // two-column布局
  rightContent?: ContentBlock[];  // two-column布局
  notes?: string;
}

// 完整演示文稿
interface PresentationDSL {
  slides: SlideDSL[];
}
```

### 3.3 Zod Schema验证

```typescript
// src/lib/dsl-schema.ts
import { z } from 'zod';

const paragraphSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().max(300),  // 限制长度
  emphasis: z.enum(['normal', 'highlight', 'muted']).optional(),
});

const bulletsSchema = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string().max(100)).max(6),  // 最多6条
});

const codeSchema = z.object({
  type: z.literal('code'),
  language: z.string(),
  lines: z.array(z.string()).max(15),  // 最多15行
  caption: z.string().optional(),
});

const tableSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()).max(5),  // 最多5列
  rows: z.array(z.array(z.string())).max(6),  // 最多6行
  caption: z.string().optional(),
});

const quoteSchema = z.object({
  type: z.literal('quote'),
  text: z.string().max(200),
  author: z.string().optional(),
});

const contentBlockSchema = z.discriminatedUnion('type', [
  paragraphSchema,
  bulletsSchema,
  z.object({ type: z.literal('numbered'), items: z.array(z.string()).max(6) }),
  codeSchema,
  tableSchema,
  quoteSchema,
]);

const slideSchema = z.object({
  layout: z.enum(['title-only', 'title-content', 'two-column', 'section', 'comparison']),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(150).optional(),
  content: z.array(contentBlockSchema).max(4).optional(),  // 每页最多4个内容块
  leftContent: z.array(contentBlockSchema).max(3).optional(),
  rightContent: z.array(contentBlockSchema).max(3).optional(),
  notes: z.string().optional(),
});

export const presentationSchema = z.object({
  slides: z.array(slideSchema),
});
```

### 3.4 AI Prompt设计

```typescript
const CONTENT_GENERATION_PROMPT = `
你是一位专业的演示文稿设计师。根据大纲和资料，为每个章节生成详细的幻灯片内容。

输出格式为JSON，结构如下：

{
  "slides": [
    {
      "layout": "title-content",
      "title": "幻灯片标题",
      "content": [
        {
          "type": "paragraph",
          "text": "段落文本，不超过100字..."
        },
        {
          "type": "bullets",
          "items": ["要点1", "要点2", "要点3"]
        },
        {
          "type": "code",
          "language": "python",
          "lines": [
            "def example():",
            "    return 'Hello'"
          ]
        },
        {
          "type": "table",
          "headers": ["列1", "列2"],
          "rows": [["值1", "值2"]]
        },
        {
          "type": "quote",
          "text": "引用内容",
          "author": "作者"
        }
      ]
    }
  ]
}

布局类型(layout)可选值：
- "title-only": 仅标题页
- "title-content": 标题+内容（最常用）
- "two-column": 双栏布局，使用leftContent和rightContent
- "section": 章节分隔页
- "comparison": 对比布局

内容限制：
1. 每张幻灯片最多4个内容块
2. 段落文本不超过100字
3. 列表项不超过6条
4. 代码块不超过15行
5. 表格不超过5列×6行
6. 每个章节生成3-5张幻灯片

内容多样性要求：
- 避免全是bullets，合理混用不同类型
- 技术主题必须包含代码示例
- 数据对比使用表格
- 重要观点使用引用

当前章节: {section}
参考资料: {resources}

只输出JSON，不要其他内容。
`;
```

### 3.5 渲染器实现

```typescript
// src/lib/dsl-renderer.ts
import PptxGenJS from 'pptxgenjs';
import { SlideDSL, ContentBlock } from '@/types/slide-dsl';

export class DSLRenderer {
  private pptx: PptxGenJS;

  constructor() {
    this.pptx = new PptxGenJS();
    this.pptx.layout = 'LAYOUT_16x9';
  }

  render(slides: SlideDSL[]): PptxGenJS {
    for (const slideDSL of slides) {
      this.renderSlide(slideDSL);
    }
    return this.pptx;
  }

  private renderSlide(dsl: SlideDSL) {
    const slide = this.pptx.addSlide();

    // 渲染标题
    if (dsl.title) {
      slide.addText(dsl.title, {
        x: 0.5, y: 0.4, w: 9, h: 0.8,
        fontSize: 32, bold: true, color: '363636'
      });
    }

    // 根据布局渲染内容
    switch (dsl.layout) {
      case 'title-content':
        this.renderContentBlocks(slide, dsl.content || [], { x: 0.5, y: 1.5, w: 9 });
        break;
      case 'two-column':
        this.renderContentBlocks(slide, dsl.leftContent || [], { x: 0.5, y: 1.5, w: 4.2 });
        this.renderContentBlocks(slide, dsl.rightContent || [], { x: 5.3, y: 1.5, w: 4.2 });
        break;
      // ...其他布局
    }
  }

  private renderContentBlocks(slide: PptxGenJS.Slide, blocks: ContentBlock[], pos: { x: number, y: number, w: number }) {
    let currentY = pos.y;

    for (const block of blocks) {
      const height = this.renderBlock(slide, block, { ...pos, y: currentY });
      currentY += height + 0.2;  // 间距

      if (currentY > 6.5) break;  // 防止溢出
    }
  }

  private renderBlock(slide: PptxGenJS.Slide, block: ContentBlock, pos: { x: number, y: number, w: number }): number {
    switch (block.type) {
      case 'paragraph':
        return this.renderParagraph(slide, block, pos);
      case 'bullets':
        return this.renderBullets(slide, block, pos);
      case 'code':
        return this.renderCode(slide, block, pos);
      case 'table':
        return this.renderTable(slide, block, pos);
      case 'quote':
        return this.renderQuote(slide, block, pos);
      default:
        return 0;
    }
  }

  private renderCode(slide: PptxGenJS.Slide, block: CodeBlock, pos): number {
    const code = block.lines.join('\n');
    const height = Math.min(block.lines.length * 0.25 + 0.3, 3);  // 估算高度

    slide.addText(code, {
      x: pos.x, y: pos.y, w: pos.w, h: height,
      fontFace: 'Consolas',
      fontSize: 11,
      color: '383838',
      fill: { color: 'F5F5F5' },
      valign: 'top',
    });

    return height;
  }

  private renderTable(slide: PptxGenJS.Slide, block: TableBlock, pos): number {
    const rows = [block.headers, ...block.rows];
    const height = rows.length * 0.4 + 0.2;

    slide.addTable(rows, {
      x: pos.x, y: pos.y, w: pos.w,
      fontSize: 12,
      border: { color: 'CFCFCF' },
      fill: { color: 'F9F9F9' },
    });

    return height;
  }

  // ... 其他渲染方法
}
```

---

## 4. 实现路径

### Phase 1: DSL基础设施

- [ ] 定义TypeScript类型 (`src/types/slide-dsl.ts`)
- [ ] 实现Zod Schema验证 (`src/lib/dsl-schema.ts`)
- [ ] 实现JSON解析与错误处理
- [ ] 单元测试

### Phase 2: 渲染器增强

- [ ] 实现DSLRenderer类 (`src/lib/dsl-renderer.ts`)
- [ ] 布局模板：title-content, two-column, section
- [ ] 内容块渲染：paragraph, bullets, code, table, quote
- [ ] 高度估算与溢出处理

### Phase 3: AI生成集成

- [ ] 修改content生成Prompt
- [ ] JSON输出解析与验证
- [ ] 验证失败时的重试逻辑
- [ ] 降级处理（回退到简单格式）

### Phase 4: 优化迭代

- [ ] 代码语法高亮（可选，使用highlight.js）
- [ ] 更多布局模板
- [ ] 样式主题系统

---

## 5. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| AI生成JSON格式错误 | 低 | 高 | Zod验证 + 错误重试 + 降级到bullets |
| 内容溢出页面 | 高 | 中 | Prompt限制 + 渲染时截断 + 高度检测 |
| 代码块过长 | 中 | 低 | 限制15行 + 截断显示 |
| 表格太宽 | 中 | 低 | 限制5列 + 自动列宽 |

---

## 6. 业界参考案例

| 项目 | 方案 | 导出PPTX |
|------|------|----------|
| [Marp](https://marp.app/) | Markdown DSL | ✓ 支持 |
| [Slidev](https://sli.dev/) | Markdown + Vue | ✓ 支持 |
| [reveal.js](https://revealjs.com/) | HTML/Markdown | 需插件 |
| [Quarto](https://quarto.org/) | Markdown | ✓ 支持 |

这些项目验证了DSL中间格式方案的可行性。我们使用JSON而非Markdown/YAML，是因为AI生成JSON的准确率更高。

---

## 7. 对比总结

| 方案 | 实现难度 | AI生成准确率 | 表达能力 | 渲染效果 | 推荐度 |
|------|----------|--------------|----------|----------|--------|
| HTML转换 | 高 | 高 | 极高 | 差 | ⭐⭐ |
| Markdown增强 | 低 | 极高 | 中 | 中 | ⭐⭐⭐ |
| PptxGenJS配置 | 中 | 低 | 极高 | 极好 | ⭐⭐ |
| **JSON DSL** | 中 | **极高** | 高 | 好 | ⭐⭐⭐⭐⭐ |

---

## 8. 结论与建议

**推荐采用JSON DSL中间格式方案**，理由如下：

1. **AI生成准确率极高**：JSON是AI最熟悉的格式，错误率最低
2. **解析稳定可靠**：原生`JSON.parse()`，无需额外依赖
3. **验证体系成熟**：Zod/ajv提供完善的Schema验证
4. **可控性强**：易于验证、纠错、降级
5. **扩展性佳**：后续可逐步添加更多内容类型和布局

**不推荐的方案：**
- HTML方案：转换质量差，布局模型不兼容
- YAML方案：缩进敏感，AI易出错

**下一步行动**：如果认可此方案，可开始Phase 1的实现。
