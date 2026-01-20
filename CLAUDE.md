# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI PPT Creator - An AI-powered presentation generator that creates professional PPTX files from user-provided topics.

**Generation Modes:**
- **DSL Mode** (default): AI generates structured JSON DSL → PptxGenJS → PPTX
- **Image Mode**: AI generates slide images via image API (e.g., Gemini) → full-screen slides

## Commands

```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # Run ESLint
npm run pm2:start    # Start with PM2 (requires: npm install -g pm2)
```

## Tech Stack

- **Framework**: Next.js 16.1.2 (App Router), React 19.2.3
- **UI**: Tailwind CSS 4 + shadcn/ui + tw-animate-css
- **State**: Zustand 5.x
- **AI**: OpenAI SDK (supports OpenAI-compatible APIs via BASE_URL)
- **Search**: Tavily API or SerpAPI
- **PPT**: PptxGenJS 4.x
- **Validation**: Zod 4.x

## Project Structure

```
src/
├── app/           # Next.js App Router pages & API routes
├── components/    # React components (header.tsx + ui/)
├── lib/           # Core utilities & business logic
├── store/         # Zustand state management
└── types/         # TypeScript type definitions
```

## Architecture

### Generation Pipeline

```
User Input → Session → AI Research → Outline → Content Generation → PPTX Export
```

**API Workflow:**
1. `POST /api/session/create` - Create session (topic, language, mode)
2. `POST /api/session/[id]/generate` - Auto-execute next stage
3. `POST /api/session/[id]/export` - Render and download PPTX

**Session Stages:** `idle → collecting → outlining → generating → completed` (or `error`)

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai.ts` | AI client with function calling (AIClient, ImagesClient) |
| `src/lib/generator.ts` | Outline generation and resource collection |
| `src/lib/dsl-generator.ts` | DSL slide generation via function calling |
| `src/lib/dsl-parser.ts` | Validates/repairs AI output with Zod |
| `src/lib/dsl-renderer.ts` | Renders DSL to PPTX |
| `src/lib/image-generator.ts` | Image slide generation via function calling |
| `src/lib/image-renderer.ts` | Renders images to PPTX |
| `src/lib/session.ts` | Session CRUD (file-based in `.sessions/`) |
| `src/lib/search.ts` | Web search (Tavily/SerpAPI) |
| `src/lib/scraper.ts` | Web content extraction |
| `src/types/slide-dsl.ts` | DSL type definitions |
| `src/types/index.ts` | Session, resource, image mode types |

### DSL System

**Layouts:** `title-only`, `title-content`, `two-column`, `section`, `comparison`

**Content Blocks (6 types, fixed):**
| Type | Key Fields |
|------|------------|
| `paragraph` | `text`, `emphasis?` |
| `bullets` | `items[]` |
| `numbered` | `items[]` |
| `code` | `language`, `lines[]` |
| `table` | `headers[]`, `rows[][]` |
| `quote` | `text`, `author?` |

**Content Limits:** Max 8 list items, 25 code lines, 8 table rows per block. Auto-pagination when exceeded.

### Image Mode

**Slide Types:** `cover`, `toc`, `section`, `content`, `ending`

**Constraints:** 1 cover, 1 TOC, max 4 content pages per section, 1 ending. Image size: 2560x1440.

**Tools:** `generate_slide_image(slide_type, prompt)`, `finish_generation()`

## Environment Variables

```env
# AI Provider
AI_PROVIDER=openai
BASE_URL=             # Optional: OpenAI-compatible API
API_KEY=
MODEL=                # Defaults to gpt-4o

# Image Generation (for Image Mode)
IMAGE_BASE_URL=       # Optional: defaults to BASE_URL
IMAGE_API_KEY=        # Optional: defaults to API_KEY
IMAGE_MODEL=          # Defaults to gemini-2.0-flash-exp-image-generation

# Web Search (priority: Tavily > SerpAPI)
TAVILY_API_KEY=
SERP_API_KEY=
```

## Available Themes

`blue` (default), `green`, `teal`, `purple`, `orange`, `red`, `rose`, `slate`

Theme selected on `/result` page before download. Export API: `POST /api/session/[id]/export { "theme": "purple" }`

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/session/create` | POST | Create session |
| `/api/session/[id]` | GET | Get session |
| `/api/session/[id]/generate` | POST | Unified generation |
| `/api/session/[id]/export` | POST | PPTX export |

## Function Calling Tools

**Research:** `search_web(query)`, `fetch_url(url)`, `finish_research(summary)`

**DSL Generation:** `add_slide(slide)`, `finish_generation()`

**Image Generation:** `generate_slide_image(slide_type, prompt)`, `finish_generation()`

## Error Handling

- **JSON Parsing:** Multi-level repair (fix commas, newlines, truncate, extract)
- **Search Unavailable:** Skip collection, continue with outline
- **Function Calling Fails:** Fallback to simple slide generation
- **Invalid Content Blocks:** Feedback loop requests regeneration

## Deployment

- **Docker:** `docker compose up` (Dockerfile included)
- **PM2:** `npm run pm2:start` (logs in `./logs/`)
- **Vercel:** `maxDuration = 120` on generate API, sessions in `/tmp/.sessions`

## Session Storage

- Location: `.sessions/` (or `/tmp/.sessions` on serverless)
- Format: JSON files by UUID
- Cleanup: Auto-delete after 24h
- Client: IDs in localStorage (`ppt-creator-session-ids`)

## Console Logging Prefixes

`[DSL Generator]`, `[DSL Parser]`, `[AI]`, `[AI Research]`, `[Image Generator]`, `[Image Renderer]`

## Notes

- No authentication/authorization (open access)
- No rate limiting
- PPTX generated in-memory
- Theme colors use hex without `#` (PptxGenJS format)
