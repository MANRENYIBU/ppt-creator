# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI PPT Creator - An AI-powered presentation generator that creates professional PPTX files from user-provided topics. Users input a topic and select language (Chinese/English). The AI collects research via web search, generates an outline, creates content. Before export, users can choose a theme color for the final PPTX.

## Commands

```bash
# Development
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run ESLint

# PM2 Production (requires: npm install -g pm2)
npm run pm2:start    # Start with PM2 (logs to ./logs/)
npm run pm2:stop     # Stop PM2 process
npm run pm2:restart  # Restart PM2 process
npm run pm2:logs     # View live logs
npm run pm2:status   # Check process status
```

## Tech Stack

- **Framework**: Next.js 16.1.2 (App Router), React 19.2.3
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix primitives) + tw-animate-css
- **State**: Zustand 5.x
- **AI**: OpenAI SDK + Anthropic SDK (supports OpenAI-compatible APIs via BASE_URL)
- **Web Search**: Tavily API or SerpAPI (configurable via env)
- **PPT Generation**: PptxGenJS 4.x
- **Validation**: Zod 4.x

## Project Structure

```
ppt-creator/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   ├── components/             # React components (header.tsx + ui/)
│   ├── lib/                    # Core utilities & business logic
│   ├── store/                  # Zustand state management
│   └── types/                  # TypeScript type definitions
├── docs/                       # Documentation (PRD, deployment, design-system)
├── public/                     # Static assets (SVG files)
├── .sessions/                  # Session storage (gitignored)
├── .claude/skills/             # Claude Code skills
└── Configuration files         # next.config.ts, tsconfig.json, etc.
```

## Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js config with standalone output mode |
| `tsconfig.json` | TypeScript config with `@/` path alias |
| `postcss.config.mjs` | PostCSS with `@tailwindcss/postcss` plugin (Tailwind v4) |
| `eslint.config.mjs` | ESLint configuration |
| `components.json` | shadcn/ui CLI configuration |
| `ecosystem.config.js` | PM2 process manager configuration |
| `src/app/globals.css` | Tailwind v4 imports, OKLCH color variables, dark mode support |

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
4. Frontend polls every 5s, triggers generate API when stage changes
5. On completion, redirects to result page for theme selection and export
6. Max polling duration: 60 minutes

**Polling Implementation Details:**
- `processing` flag prevents duplicate API calls during active requests
- Resource preview shows only titles and URLs (not full content)
- Uses `after()` API for post-response background processing (Vercel timeout handling)

**API Timeout Configuration:**
| Endpoint | Timeout | Purpose |
|----------|---------|---------|
| `POST /api/session/[id]/generate` | 120s | Full generation pipeline |
| `POST /api/session/[id]/content` | 120s | DSL slide generation |
| `POST /api/session/[id]/collect` | 60s | Resource collection |
| `POST /api/session/[id]/outline` | 60s | Outline generation |
| `POST /api/session/[id]/export` | 60s | PPTX export |

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

**Resource Context Building Priority** (`dsl-generator.ts:388-412`):
1. **Primary**: AI-generated summary from research phase (preferred)
2. **Fallback**: Raw search results (max 3, `rawContent` preferred over `content`)
3. **Last resort**: Empty string if no resources available

Each raw result is truncated to 800 characters when used as fallback.

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

**Note:** Code blocks use smaller font (8pt vs 16pt body), allowing more content per slide.

#### Content Block Splitting (dsl-parser.ts:434-533)

Oversized individual blocks are split before pagination:

| Block Type | Split Threshold | Split Caption |
|------------|-----------------|---------------|
| `code` | `MAX_CODE_LINES` (25) | `(1/N)` suffix |
| `bullets/numbered` | `MAX_LIST_ITEMS` (8) | None |
| `table` | `MAX_TABLE_ROWS` (8) | `(1/N)` suffix |

#### DSL Parser Error Recovery

The parser (`src/lib/dsl-parser.ts`) handles malformed AI output:
1. Removes markdown code block markers
2. Fixes trailing commas and unescaped newlines
3. Detects/truncates incomplete JSON
4. Falls back to Markdown table parsing
5. Lenient mode normalizes invalid structures

#### Lenient Mode Normalization (dsl-parser.ts:704-840)

The `normalizeContentBlock()` function handles various AI output formats:

| Block Type | Accepted Fields | Fallback Fields |
|------------|-----------------|-----------------|
| `code` | `lines[]` | `code`, `content`, `text` (split by `\n`) |
| `code.language` | `language` | `lang` |
| `table` | `headers[]`, `rows[][]` | `data[][]`, Markdown table in `text` |
| `quote` | `text` | `content` |

Auto-generates column headers if missing: `列1`, `列2`, etc.

#### Content Block Validation (dsl-generator.ts)

AI-generated slides are validated before acceptance:
- Only 6 valid content block types: `paragraph`, `bullets`, `numbered`, `code`, `table`, `quote`
- Invalid types trigger re-generation request via tool feedback
- Validates `content`, `leftContent`, `rightContent` arrays

#### Section Generation Requirements (dsl-generator.ts:317-320)

Per-section slide generation enforces:
- **Maximum 6 slides per section** (hardcoded in prompt)
- Content types should be diverse (not all bullets)
- Code blocks and tables should preferably have their own slides
- Technical topics must include complete code examples

#### Slide Structure Auto-Generated

The `generateDSLPresentation()` function creates these slides automatically:

| Slide | Layout | Content |
|-------|--------|---------|
| 1 | `title-only` | Topic title + "Professional Presentation · AI Generated" |
| 2 | `title-content` | "Contents" + numbered list of section titles |
| Per Section | `section` | Section title + "Part X of Y" |
| Per Section | (AI generated) | Content slides (max 6 per section) |
| Last | `title-only` | "Thank You" + "Questions & Discussion" |

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
| `src/lib/utils.ts` | Utility functions (`cn` for class merging) |

### Zustand Store (src/store/generation.ts)

Store 只存储会话 ID 列表，会话数据通过 API 获取：

**Store State:**
- `sessionIds: string[]` - localStorage 中存储的会话 ID 列表

**Store Actions:**
- `loadSessionIds()` - 从 localStorage 加载 ID 列表
- `addSessionId(id)` - 添加会话 ID
- `removeSessionId(id)` - 移除会话 ID
- `clearSessionIds()` - 清空所有 ID

**导出的工具函数:**
- `fetchSession(id)` - 从服务器获取单个会话
- `fetchSessions(ids)` - 批量获取会话数据

### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Header` | `components/header.tsx` | Navigation bar with logo and history link |
| `Button` | `components/ui/button.tsx` | Button with variants (default, destructive, outline, secondary, ghost, link) and sizes |
| `Input` | `components/ui/input.tsx` | Text input field |
| `Select` | `components/ui/select.tsx` | Dropdown selection (language, theme) |
| `Card` | `components/ui/card.tsx` | Card container for content grouping |
| `Progress` | `components/ui/progress.tsx` | Progress indicator for generation stages |

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

### Typography & Code Highlighting

- **Fonts**: Inter (UI), Microsoft YaHei (Chinese titles/body), Consolas (code)
- **Code Syntax Highlighting**: shiki 3.21.0 with `one-dark-pro` theme
- **Supported Languages**: 30+ languages via `LANGUAGE_MAP` (javascript, python, rust, go, etc.)

### Layout Constants (LAYOUT)

- **Slide dimensions**: 10 x 5.625 inches (16:9 aspect ratio)
- **Margins**: 0.5 inches
- **Title Y position**: 0.35 inches
- **Content area**: Y 1.3 to 5.2 inches
- **Column gap**: 0.3 inches
- **Fonts**: Microsoft YaHei (title/body), Consolas (code)

### Layout Rendering Details

**Two-Column Layout** (`dsl-renderer.ts`):
```
columnWidth = (10 - 0.5*2 - 0.3) / 2 = 4.35" per column
```

**Comparison Layout Color Scheme**:
- Left column header: `primary` color background
- Right column header: `secondary` color background
- Header bars positioned 0.05" above content area

### Fallback Slide Generation (dsl-generator.ts:417-443)

When function calling fails, generates simple slides:
- One slide per outline point
- Layout: `title-content`
- Content: Boilerplate paragraph + placeholder bullet list
- Localized for Chinese/English

## AI Integration

### Function Calling Tool Categories (src/lib/ai.ts)

**Research Tools** (used during resource collection):
- `search_web(query)` - Search web for relevant materials (max 5 results per search)
- `fetch_url(url)` - Fetch full content of specific URLs
- `finish_research(summary)` - Complete research with comprehensive summary

**Slide Generation Tools** (used during content generation):
- `add_slide(slide: SlideDSL)` - Adds a slide to the presentation
- `finish_generation()` - Signals end of generation

**Tool Response Truncation** (`ai.ts`):
- Search results: snippets truncated to 500 chars in tool response
- Fetched content: truncated to 3000 chars in tool response
- Raw content stored in full for later use

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

### Scraper Details

- **Blocked file types**: 30+ types (PDF, Office, media, archives, etc.)
- **Content validation**: Only accepts `text/html` and `text/plain`
- **Minimum content**: 100 characters threshold
- **Batch fetching**: Configurable concurrency (default 3 concurrent requests)
- **User-Agent**: Realistic browser header for compatibility

### Search Client (src/lib/search.ts)

Dual provider support with automatic fallback:
- **Tavily** (primary): Preferred search provider, doesn't fetch raw content (delegates to scraper)
- **SerpAPI** (fallback): Extracts organic results with full parsing
- Configurable max results (default 5)
- Application continues without search if no API keys configured

## Error Handling Patterns

- **JSON Parsing**: Clean → Fix → Truncate → Extract → Lenient mode
- **Search Unavailable**: Skips resource collection, continues with outline
- **Function Calling Fails**: Falls back to simple slide generation
- **Outline Fails**: Uses default template
- **PPTX Rendering**: Block-by-block with height constraints to prevent overflow

### JSON Repair Strategy (safeParseToolArgs in ai.ts)

Multi-level fallback for malformed AI-generated JSON:

| Level | Action | Code Location |
|-------|--------|---------------|
| 1 | Direct `JSON.parse()` attempt | `ai.ts:34-37` |
| 2 | Remove trailing commas: `,(\s*[}\]])` → `$1` | `ai.ts:43` |
| 3 | Fix unescaped newlines/tabs in strings | `ai.ts:46-51` |
| 4 | Truncate to last complete `}` brace | `ai.ts:61-68` |
| 5 | Extract JSON-like pattern via regex | `ai.ts:72-78` |

### Validation Feedback Loop (Function Calling)

When AI generates invalid content block types during function calling:

1. `onSlideAdded` callback validates each slide (`dsl-generator.ts:345-354`)
2. Invalid slides receive error tool response: `"Invalid content block types detected..."` (`ai.ts:345-354`)
3. AI receives feedback and regenerates the slide
4. Process repeats until valid or max iterations (50) reached

### DSL Parser Bracket Counting Algorithm (dsl-parser.ts:55-115)

For truncated JSON repair:
- Tracks `bracketCount` (for `[]`) and `braceCount` (for `{}`)
- Handles escape characters (`\`) and string boundaries (`"`)
- Records position of last complete object when `braceCount` returns to 0
- Truncates at that position and appends `]}`

### Generator Fallback Strategy (src/lib/generator.ts)

Multi-level graceful degradation:
1. **Primary**: AI-driven research with function calling tools
2. **Fallback**: Traditional search (`collectResourcesFallback`) if AI research fails
3. **Skip**: If no search API configured, returns null and continues with outline

## Session Storage

- Location: `.sessions/` directory (gitignored)
- Format: JSON files named by session UUID
- Cleanup: Sessions older than 24 hours auto-deleted on new session creation
- Client persistence: Session IDs stored in localStorage (`ppt-creator-session-ids`)

### Session Cleanup Mechanism (session.ts:177-192)

- Triggered in `/api/session/create` route after session creation
- Uses `session.createdAt` field from JSON to determine age (not file mtime)
- Silently runs in background (uses `.catch(console.error)`)
- Does not throw errors on cleanup failure

### Console Logging Patterns

The codebase uses consistent logging prefixes:

| Prefix | Source | Purpose |
|--------|--------|---------|
| `[DSL Generator]` | `dsl-generator.ts` | Slide generation progress |
| `[DSL Parser]` | `dsl-parser.ts` | JSON repair and pagination |
| `[AI]` | `ai.ts` | Slide function calling |
| `[AI Research]` | `ai.ts` | Research function calling |

### Serverless Environment Detection

Session storage auto-adapts based on environment:

| Environment Variable | Platform |
|---------------------|----------|
| `VERCEL` | Vercel |
| `SERVERLESS`, `AWS_LAMBDA_FUNCTION_NAME` | AWS Lambda |
| `EDGE`, `EDGE_RUNTIME`, `TENCLOUD` | Edge computing |

On serverless platforms, sessions are stored in `/tmp/.sessions` instead of `.sessions/`.

## Skills Available

This project includes Claude skills in `.claude/skills/`:

- **ui-ux-pro-max**: Design intelligence for UI/UX decisions
- **vercel-react-best-practices**: React/Next.js performance patterns

## Deployment

### Docker Support

- **Dockerfile** and **docker-compose.yml** included
- Multi-stage build using `node:20-alpine`
- Non-root user (`nextjs:1001`) for security
- Session storage adapts to serverless environments (`/tmp/.sessions`)
- Health check with 30s interval
- Auto-restart policy
- Build: `docker build -t ppt-creator .`
- Run: `docker compose up`

### PM2 Deployment

PM2 provides process management with automatic restarts and log rotation.

**Setup:**
```bash
# Install PM2 globally
npm install -g pm2

# Build and start
npm run build
npm run pm2:start

# Enable log rotation (optional)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Auto-start on system reboot
pm2 startup
pm2 save
```

**Log files location:** `./logs/`
- `out.log` - stdout
- `error.log` - stderr
- `combined.log` - all logs

### Vercel Deployment

- Uses `maxDuration = 120` on generate API (requires Vercel Pro)
- Detects Vercel via `process.env.VERCEL`
- Session storage auto-adapts to `/tmp/.sessions`
- Standalone mode configured in `next.config.ts`

## Documentation

| File | Purpose |
|------|---------|
| `docs/PRD.md` | Product Requirements Document |
| `docs/deployment.md` | Comprehensive deployment guide (20+ methods) |
| `docs/ui/design-system.md` | UI/UX design specifications |

## API Routes

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/session/create` | POST | `src/app/api/session/create/route.ts` | Create new session |
| `/api/session/[id]` | GET | `src/app/api/session/[id]/route.ts` | Get session by ID |
| `/api/session/[id]/generate` | POST | `src/app/api/session/[id]/generate/route.ts` | Unified generation (recommended) |
| `/api/session/[id]/collect` | POST | `src/app/api/session/[id]/collect/route.ts` | Resource collection (legacy) |
| `/api/session/[id]/outline` | POST | `src/app/api/session/[id]/outline/route.ts` | Outline generation (legacy) |
| `/api/session/[id]/content` | POST | `src/app/api/session/[id]/content/route.ts` | Content generation (legacy) |
| `/api/session/[id]/export` | POST | `src/app/api/session/[id]/export/route.ts` | PPTX export |

### Generate API Response Format

The `/api/session/[id]/generate` endpoint returns a simplified response (not full session):
```typescript
interface GenerateResponse {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  stage: GenerationStage
  processing: boolean
  error?: string
  resources: {
    count: number
    items: Array<{ title: string; url: string }>  // First 5 only
  }
  outline: Array<{ title: string }>  // Summary only
  hasContent: boolean
}
```

## Singleton Patterns

| Module | Instance Variable | Reset Function |
|--------|-------------------|----------------|
| `ai.ts` | `aiClient` | `resetAIClient()` |
| `search.ts` | `searchClient` | `resetSearchClient()` |

## Testing

**Note**: Project currently lacks automated test suite. No jest.config, test files, or test directory present.

## Security & Performance Notes

- Session IDs stored in localStorage (no encryption)
- PPTX files generated in-memory (no disk caching)
- No rate limiting on API endpoints
- No authentication/authorization (open access)
- Theme colors use hex codes without `#` prefix (PptxGenJS format)

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.2 | React 19.2.3 compatible |
| `pptxgenjs` | 4.0.1 | PPTX generation |
| `shiki` | 3.21.0 | Code syntax highlighting |
| `openai` | 6.16.0 | OpenAI SDK |
| `@anthropic-ai/sdk` | 0.71.2 | Anthropic SDK |
| `zod` | 4.3.5 | Schema validation |
| `zustand` | 5.0.10 | State management |
| `lucide-react` | 0.562.0 | Icon library |
| `tailwindcss` | 4.x | CSS framework |
