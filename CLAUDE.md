# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI PPT Creator - An AI-powered presentation generator that creates professional PPTX files from user-provided topics. Users input a topic, select language (Chinese/English), and choose presentation duration (5-30 minutes). The AI collects research via web search, generates an outline, creates content, and exports to PPTX format.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: React Context or Zustand
- **Storage**: Browser localStorage (no backend database)
- **AI**: OpenAI API / Claude API
- **Web Search**: Tavily API / SerpAPI
- **PPT Generation**: PptxGenJS

## Architecture

```
用户输入 → API收集资料 → 规划大纲 → 生成内容 → 导出PPTX
```

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Input form (topic, language, duration) |
| `/generate` | Progress display during generation |
| `/result` | Outline preview and PPTX download |
| `/history` | View past generations from localStorage |

### API Endpoint

`POST /api/generate` - Accepts topic, language, duration. Returns streaming response with stage progress (collecting → outlining → generating → completed).

## Key Data Structures

```typescript
interface GenerationRecord {
  id: string;
  topic: string;
  language: 'zh-CN' | 'en-US';
  duration: number;  // minutes
  outline: OutlineItem[];
  createdAt: string;
  downloadUrl?: string;
}

// localStorage key: 'ppt-creator-history'
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
- **Style**: Modern minimalist
- **Single template**: Clean professional design
- See `/docs/ui/design-system.md` for full specifications

## Skills Available

This project includes Claude skills in `.claude/skills/`:

- **ui-ux-pro-max**: Design intelligence for UI/UX decisions. Use `--design-system` flag for comprehensive recommendations.
- **vercel-react-best-practices**: React/Next.js performance patterns. Reference when writing components or optimizing performance.
