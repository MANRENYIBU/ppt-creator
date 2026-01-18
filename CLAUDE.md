# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI PPT Creator - An AI-powered presentation generator that creates professional PPTX files from user-provided topics. Users input a topic and select language (Chinese/English). The AI collects research via web search, generates an outline, creates content. Before export, users can choose a theme color for the final PPTX.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16.1.2 (App Router), React 19.2.3
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **State**: Zustand 5.x
- **AI**: OpenAI SDK (supports OpenAI-compatible APIs via BASE_URL)
- **Web Search**: Tavily API or SerpAPI (configurable via env)
- **PPT Generation**: PptxGenJS 4.x
- **Validation**: Zod 4.x

## Architecture

### Generation Pipeline

```
User Input → Create Session → AI Research (Collect + Summarize) → Generate Outline → Generate DSL Content → Render PPTX
```

The pipeline is implemented as a multi-step API workflow with session-based state persistence:

1. **Session Creation** (`POST /api/session/create`) - Creates session with topic, language
2. **Unified Generation** (`POST /api/session/[id]/generate`) - Auto-executes next stage based on current state
3. **PPTX Export** (`POST /api/session/[id]/export`) - DSLRenderer converts to PPTX with selected theme

**Legacy Individual Stage APIs** (still available but not recommended):
- `POST /api/session/[id]/collect` - Resource collection only
- `POST /api/session/[id]/outline` - Outline generation only
- `POST /api/session/[id]/content` - Content generation only

### Frontend Polling Architecture

The frontend uses a polling-based approach for reliability:

1. **Home page** creates session via `/api/session/create`
2. **Generate page** polls session status + triggers `/api/session/[id]/generate`
3. The generate API checks current stage and executes the next step:
   - `idle` → `collecting` (AI research)
   - `collecting` → `outlining` (generate outline)
   - `outlining` → `generating` (generate DSL slides)
   - `generating` → `completed`
4. Frontend polls every 2s, triggers generate API when stage changes
5. On completion, redirects to result page for theme selection and export

### AI-Driven Resource Collection

Resource collection uses AI with function calling tools to intelligently gather and summarize research materials:

**Tools Available:**
- `search_web(query)` - Search web for relevant materials (max 5 results per search)
- `fetch_url(url)` - Fetch full content of specific URLs
- `finish_research(summary)` - Complete research with comprehensive summary

**Workflow:**
1. AI analyzes topic and determines search strategy
2. AI performs 2-3 searches covering different angles (concepts, techniques, applications)
3. AI fetches detailed content from important URLs
4. AI generates comprehensive summary (500-1500 words)
5. Summary stored in `ResourceData.summary` for downstream use

**Configuration:**
- Max iterations: 20 (prevents infinite loops)
- Falls back to direct search if AI research fails

**Data Model:**
```typescript
interface ResourceResult {
  title: string
  url: string
  content: string      // Search snippet
  rawContent?: string  // Full page content
  query?: string       // Search query used
}

interface ResourceData {
  topic: string                // User's input topic
  results: ResourceResult[]    // Raw search results
  summary?: string             // AI-generated research summary (preferred)
  collectedAt: string
}
```

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
| `MAX_SUBTITLE_LENGTH` | 150 | Subtitle chars |
| `MAX_PARAGRAPH_LENGTH` | 300 | Paragraph chars |
| `MAX_LIST_ITEMS` | 8 | List items before split |
| `MAX_LIST_ITEM_LENGTH` | 100 | Single list item chars |
| `MAX_CODE_LINES` | 25 | Code lines before split |
| `MAX_CODE_LINE_LENGTH` | 80 | Code line chars |
| `MAX_TABLE_ROWS` | 8 | Table rows before split |
| `MAX_TABLE_COLUMNS` | 5 | Max columns |
| `MAX_QUOTE_LENGTH` | 200 | Quote text chars |

#### Smart Pagination (splitByContentSize)

基于渲染器实际高度的智能分页，可用内容高度 = 3.9 英寸：

| 常量 | 值 | 说明 |
|------|-----|------|
| `MAX_CONTENT_HEIGHT` | 4.2" | 可用内容区域高度（放宽后，原3.9"） |
| `MIN_CONTENT_HEIGHT` | 0.8" | 最小内容阈值（少于此值合并到前页） |
| `BLOCK_SPACING` | 0.15" | 内容块间距 |

**分页算法：**
1. 按顺序分配内容块，超过 `MAX_CONTENT_HEIGHT` 时新建页面
2. 最后一页若低于 `MIN_CONTENT_HEIGHT`，自动合并到前一页
3. 多页时标题添加 `(1/N)` 后缀

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

#### Content Block Validation (dsl-generator.ts)

AI-generated slides are validated before acceptance:
- Only 6 valid content block types: `paragraph`, `bullets`, `numbered`, `code`, `table`, `quote`
- Invalid types trigger re-generation request via tool feedback
- Validates `content`, `leftContent`, `rightContent` arrays

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
| `/` | Input form (topic, language) |
| `/generate` | Progress display during generation |
| `/result` | Outline preview, theme selection, and PPTX download |
| `/history` | View past generations, click download to go to result page |

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
# AI Provider (openai or anthropic)
AI_PROVIDER=openai
BASE_URL=             # Optional: for OpenAI-compatible APIs
API_KEY=
MODEL=                # or MODE, defaults to gpt-4o (openai) / claude-sonnet-4-20250514 (anthropic)

# Web Search (choose one, priority: Tavily > SerpAPI)
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

- **Theme constants**: Defined in `DSLRenderer` class (`src/lib/dsl-renderer.ts`)
- **Default theme**: Blue (professional business)
- **Full specs**: `/docs/ui/design-system.md`

### Available Themes

| Theme | Primary Color | Description |
|-------|---------------|-------------|
| `blue` | #2563EB | Professional business (default) |
| `green` | #16A34A | Natural and fresh |
| `teal` | #0D9488 | Tech and modern |
| `purple` | #9333EA | Creative and elegant |
| `orange` | #EA580C | Vibrant and passionate |
| `red` | #DC2626 | Bold and striking |
| `rose` | #E11D48 | Warm and soft |
| `slate` | #475569 | Minimal and modern |

### Theme Selection

Theme is selected on the result page (`/result`) before downloading. Users can switch themes and re-download without regenerating content.

**Frontend Flow:**
1. User completes generation and lands on `/result`
2. Theme selector shows 8 color options (default: blue)
3. User selects desired theme and clicks download
4. Export API receives theme and renders PPTX

**API Usage:**
```typescript
POST /api/session/[id]/export
{
  "theme": "purple"  // Optional, defaults to "blue"
}
```

The export API also accepts theme via session (for API-only usage):
```typescript
POST /api/session/create
{
  "topic": "AI in Healthcare",
  "language": "en-US",
  "theme": "purple"  // Optional, stored in session
}
```

If theme is provided in export request body, it overrides the session theme.

### Theme Color Properties

Each theme defines these color properties:

| Property | Usage |
|----------|-------|
| `primary` | Main accent color, titles, headers |
| `primaryDark` | Hover states, darker accent |
| `secondary` | Secondary accent color |
| `text` | Main body text |
| `textMuted` | Secondary/muted text |
| `textLight` | Light text (on dark backgrounds) |
| `background` | Slide background (white) |
| `backgroundAlt` | Section/comparison backgrounds |
| `backgroundCode` | Code block backgrounds |
| `border` | Border colors |
| `accent` | Success/highlight states |
| `quote` | Quote block accent |

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

**Configuration:**
- Temperature: 0.7
- Max iterations: 50 (prevents infinite loops)
- Falls back to simple generation if function calling fails

**Layout Restriction in Function Calling:**
During function calling, AI can only generate these layouts:
- `title-content` - Single column content
- `two-column` - Two column layout
- `comparison` - Comparison layout with colored headers

`title-only` and `section` layouts are auto-generated by the system (cover, contents, section dividers, thank you page).

**Tool Argument Parsing:**
`safeParseToolArgs()` handles malformed JSON from AI with:
1. Direct parse attempt
2. Remove trailing commas
3. Fix unescaped newlines in strings
4. Truncate to last complete object
5. Extract JSON-like pattern

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
