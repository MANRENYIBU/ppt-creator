# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI PPT Creator - An AI-powered presentation generator that creates professional PPTX files from user-provided topics. Users input a topic, select language (Chinese/English), and choose presentation duration (5-30 minutes). The AI collects research via web search, generates an outline, creates content, and exports to PPTX format.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **State**: Zustand
- **AI**: OpenAI API or Anthropic Claude API (configurable via env)
- **Web Search**: Tavily API or SerpAPI (configurable via env)
- **PPT Generation**: PptxGenJS
- **Validation**: Zod

## Architecture

### Generation Pipeline

```
User Input → Create Session → Collect Resources → Generate Outline → Generate DSL Content → Render PPTX
```

The pipeline is implemented as a multi-step API workflow with session-based state persistence:

1. **Session Creation** (`POST /api/session/create`) - Creates session with topic, language, duration
2. **Resource Collection** (`POST /api/session/[id]/collect`) - Web search via Tavily/SerpAPI
3. **Outline Generation** (`POST /api/session/[id]/outline`) - AI generates section structure
4. **Content Generation** (`POST /api/session/[id]/content`) - AI generates DSL slides for each section
5. **PPTX Export** (`GET /api/session/[id]/export`) - DSLRenderer converts to PPTX

### Session State Machine

Sessions (`GenerationSession`) transition through stages: `idle → collecting → outlining → generating → exporting → completed` (or `error`).

Sessions are stored as JSON files in `.sessions/` directory (auto-cleaned after 24h).

### DSL System (Core Architecture)

The slide content uses a JSON-based DSL (`src/types/slide-dsl.ts`) that serves as an intermediate representation between AI output and PPTX rendering:

- **Layouts**: `title-only`, `title-content`, `two-column`, `section`, `comparison`
- **Content Blocks**: `paragraph`, `bullets`, `numbered`, `code`, `table`, `quote` (共6种，不可扩展)
- **DSL Generator** (`src/lib/dsl-generator.ts`): AI generates JSON DSL per section
- **DSL Parser** (`src/lib/dsl-parser.ts`): Validates AI output with Zod, has lenient fallback
- **DSL Renderer** (`src/lib/dsl-renderer.ts`): Converts DSL to PPTX via PptxGenJS

#### Layout vs Content Block

| 类型 | 作用域 | 说明 |
|------|--------|------|
| `comparison` | 布局类型 | 幻灯片级别，使用 leftContent/rightContent 实现左右对比 |
| `table` | 内容块类型 | 内容级别，用于表格数据对比 |

#### Content Block Types

| Type | Fields | Description |
|------|--------|-------------|
| `paragraph` | `text`, `emphasis?` (normal/highlight/muted) | Text paragraph |
| `bullets` | `items[]` | Unordered list |
| `numbered` | `items[]` | Ordered list |
| `code` | `language`, `lines[]`, `caption?` | Code block (lines as array) |
| `table` | `headers[]`, `rows[][]`, `caption?` | Data table (also for comparison) |
| `quote` | `text`, `author?` | Quotation block |

#### Content Limits (Auto-pagination)

| Limit | Value | Purpose |
|-------|-------|---------|
| `MAX_CONTENT_BLOCKS_PER_SLIDE` | 3 | Blocks before pagination (legacy) |
| `MAX_CONTENT_BLOCKS_PER_COLUMN` | 2 | Blocks per column |
| `MAX_TITLE_LENGTH` | 100 | Title chars |
| `MAX_PARAGRAPH_LENGTH` | 300 | Paragraph chars |
| `MAX_LIST_ITEMS` | 8 | List items before split |
| `MAX_CODE_LINES` | 25 | Code lines before split |
| `MAX_TABLE_ROWS` | 8 | Table rows before split |
| `MAX_TABLE_COLUMNS` | 5 | Max columns |

#### Smart Pagination (splitByContentSize)

基于渲染器实际高度的智能分页，可用内容高度 = 3.9 英寸：

| 常量 | 值 | 说明 |
|------|-----|------|
| `MAX_CONTENT_HEIGHT` | 4.2" | 可用内容区域高度（放宽后，原3.9"） |
| `MIN_CONTENT_HEIGHT` | 0.8" | 最小内容阈值（少于此值合并到前页） |
| `BLOCK_SPACING` | 0.15" | 内容块间距 |

内容块高度计算（基于 dsl-renderer.ts）：

| Block Type | Height Formula | Example |
|------------|----------------|---------|
| `paragraph` | `max(0.4, ceil(text/50) * 0.25)` | 100字 ≈ 0.65" |
| `bullets/numbered` | `items * 0.35` | 8项 = 2.8" |
| `code` | `min(lines * 0.16 + 0.24, 3.5)` | 16行 ≈ 2.8" |
| `table` | `(rows + 1) * 0.35` | 8行 = 3.15" |
| `quote` | `max(0.5, ceil(text/45) * 0.25) + 0.1~0.35` | ≈ 0.6" |

#### DSL Parser Error Recovery

The parser (`src/lib/dsl-parser.ts`) handles malformed AI output:
1. Removes markdown code block markers
2. Fixes trailing commas and unescaped newlines
3. Detects/truncates incomplete JSON
4. Falls back to Markdown table parsing
5. Lenient mode normalizes invalid structures

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/session.ts` | Server-side session CRUD (file-based storage) |
| `src/lib/ai.ts` | AI client abstraction (OpenAI/Anthropic) with function calling |
| `src/lib/config.ts` | Environment variable parsing and validation |
| `src/lib/search.ts` | Web search abstraction (Tavily/SerpAPI) |
| `src/lib/scraper.ts` | Web content extraction (fetchUrlContent) |
| `src/lib/generator.ts` | Outline generation and resource enrichment |
| `src/lib/dsl-generator.ts` | Prompts AI to generate slide DSL via function calling |
| `src/lib/dsl-parser.ts` | Validates/repairs AI output with Zod |
| `src/lib/dsl-schema.ts` | Zod schemas for DSL validation |
| `src/lib/dsl-renderer.ts` | Renders DSL to PPTX via PptxGenJS |
| `src/store/generation.ts` | Zustand store for client-side state |
| `src/types/slide-dsl.ts` | DSL type definitions and content limits |
| `src/types/index.ts` | Session, outline, resource type definitions |

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Input form (topic, language, duration) |
| `/generate` | Progress display during generation |
| `/result` | Outline preview and PPTX download |
| `/history` | View past generations (IDs stored in localStorage) |

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
# AI Provider (openai or anthropic)
AI_PROVIDER=
BASE_URL=
API_KEY=
MODE=  # model name

# Web Search (choose one)
TAVILY_API_KEY=
SERP_API_KEY=
```

## Duration to Slide Count

| Duration | Slides |
|----------|--------|
| 5 min | 5-6 |
| 10 min | 8-10 |
| 15 min | 12-15 |
| 20 min | 16-20 |
| 30 min | 24-30 |

## Design System

- **Primary color**: Blue (#2563eb)
- **Theme constants**: Defined in `DSLRenderer` class (`src/lib/dsl-renderer.ts`)
- **Full specs**: `/docs/ui/design-system.md`

### Theme Colors (THEME constant)

| Name | Hex | Usage |
|------|-----|-------|
| `primary` | #2563EB | Blue-600, main accent |
| `primaryDark` | #1D4ED8 | Blue-700, hover states |
| `secondary` | #6366F1 | Indigo-500, secondary accent |
| `text` | #1F2937 | Gray-800, main text |
| `textMuted` | #6B7280 | Gray-500, secondary text |
| `background` | #FFFFFF | White, slide background |
| `backgroundAlt` | #F9FAFB | Gray-50, section backgrounds |
| `backgroundCode` | #F3F4F6 | Gray-100, code blocks |
| `border` | #E5E7EB | Gray-200, borders |
| `accent` | #10B981 | Emerald-500, success states |
| `quote` | #F59E0B | Amber-500, quote accent |

### Layout Constants (LAYOUT)

- **Slide dimensions**: 10 x 5.625 inches (16:9 aspect ratio)
- **Margins**: 0.5 inches
- **Title Y position**: 0.35 inches
- **Content area**: Y 1.3 to 5.2 inches
- **Column gap**: 0.3 inches
- **Fonts**: Microsoft YaHei (title/body), Consolas (code)

## AI Integration

### Function Calling Tools (src/lib/ai.ts)

The AI generates slides via function calling with two tools:
- **`add_slide(slide: SlideDSL)`**: Adds a slide to the presentation
- **`finish_generation()`**: Signals end of generation

Max 50 iterations to prevent infinite loops. Falls back to simple generation if function calling fails.

## Web Scraping (src/lib/scraper.ts)

- `fetchUrlContent(url, timeout=10000)` extracts plain text from URLs
- Skips binary/media files, removes scripts/styles/HTML tags
- Truncates to 5000 chars per page
- Used to enrich search results with full page context

## Error Handling Patterns

- **JSON Parsing**: Clean → Fix → Truncate → Extract → Lenient mode
- **Search Unavailable**: Skips resource collection, continues with outline
- **Function Calling Fails**: Falls back to simple slide generation
- **Outline Fails**: Uses default template
- **PPTX Rendering**: Block-by-block with height constraints to prevent overflow

## Session Storage

- Location: `.sessions/` directory (gitignored)
- Format: JSON files named by session UUID
- Cleanup: Sessions older than 24 hours auto-deleted on new session creation
- Client persistence: Session IDs stored in localStorage (`ppt-creator-session-ids`)

## Skills Available

This project includes Claude skills in `.claude/skills/`:

- **ui-ux-pro-max**: Design intelligence for UI/UX decisions
- **vercel-react-best-practices**: React/Next.js performance patterns
