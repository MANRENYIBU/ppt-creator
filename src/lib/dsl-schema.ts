/**
 * Slide DSL Zod Schema
 * 用于验证AI生成的JSON格式
 */

import { z } from 'zod'
import { DSL_LIMITS } from '@/types/slide-dsl'

// ============ 内容块 Schema ============

/**
 * 段落块 Schema
 */
export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1).max(DSL_LIMITS.MAX_PARAGRAPH_LENGTH),
  emphasis: z.enum(['normal', 'highlight', 'muted']).optional(),
})

/**
 * 无序列表块 Schema
 */
export const bulletsBlockSchema = z.object({
  type: z.literal('bullets'),
  items: z
    .array(z.string().min(1).max(DSL_LIMITS.MAX_LIST_ITEM_LENGTH))
    .min(1)
    .max(DSL_LIMITS.MAX_LIST_ITEMS),
})

/**
 * 有序列表块 Schema
 */
export const numberedBlockSchema = z.object({
  type: z.literal('numbered'),
  items: z
    .array(z.string().min(1).max(DSL_LIMITS.MAX_LIST_ITEM_LENGTH))
    .min(1)
    .max(DSL_LIMITS.MAX_LIST_ITEMS),
})

/**
 * 代码块 Schema
 */
export const codeBlockSchema = z.object({
  type: z.literal('code'),
  language: z.string().min(1),
  lines: z.array(z.string()).min(1).max(DSL_LIMITS.MAX_CODE_LINES),
  caption: z.string().optional(),
})

/**
 * 表格块 Schema
 */
export const tableBlockSchema = z.object({
  type: z.literal('table'),
  headers: z
    .array(z.string())
    .min(1)
    .max(DSL_LIMITS.MAX_TABLE_COLUMNS),
  rows: z
    .array(z.array(z.string()))
    .min(1)
    .max(DSL_LIMITS.MAX_TABLE_ROWS),
  caption: z.string().optional(),
})

/**
 * 引用块 Schema
 */
export const quoteBlockSchema = z.object({
  type: z.literal('quote'),
  text: z.string().min(1).max(DSL_LIMITS.MAX_QUOTE_LENGTH),
  author: z.string().optional(),
})

/**
 * 内容块联合 Schema
 * 使用 discriminatedUnion 根据 type 字段区分
 */
export const contentBlockSchema = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  bulletsBlockSchema,
  numberedBlockSchema,
  codeBlockSchema,
  tableBlockSchema,
  quoteBlockSchema,
])

// ============ 幻灯片 Schema ============

/**
 * 布局类型 Schema
 */
export const slideLayoutSchema = z.enum([
  'title-only',
  'title-content',
  'two-column',
  'section',
  'comparison',
])

/**
 * 单张幻灯片 Schema
 */
export const slideDSLSchema = z.object({
  layout: slideLayoutSchema,
  title: z.string().max(DSL_LIMITS.MAX_TITLE_LENGTH).optional(),
  subtitle: z.string().max(DSL_LIMITS.MAX_SUBTITLE_LENGTH).optional(),
  content: z
    .array(contentBlockSchema)
    .max(DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_SLIDE)
    .optional(),
  leftContent: z
    .array(contentBlockSchema)
    .max(DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_COLUMN)
    .optional(),
  rightContent: z
    .array(contentBlockSchema)
    .max(DSL_LIMITS.MAX_CONTENT_BLOCKS_PER_COLUMN)
    .optional(),
  notes: z.string().optional(),
})

// ============ 演示文稿 Schema ============

/**
 * 完整演示文稿 Schema
 */
export const presentationDSLSchema = z.object({
  slides: z.array(slideDSLSchema).min(1),
})

// ============ 类型推导 ============

export type ParagraphBlockSchema = z.infer<typeof paragraphBlockSchema>
export type BulletsBlockSchema = z.infer<typeof bulletsBlockSchema>
export type NumberedBlockSchema = z.infer<typeof numberedBlockSchema>
export type CodeBlockSchema = z.infer<typeof codeBlockSchema>
export type TableBlockSchema = z.infer<typeof tableBlockSchema>
export type QuoteBlockSchema = z.infer<typeof quoteBlockSchema>
export type ContentBlockSchema = z.infer<typeof contentBlockSchema>
export type SlideDSLSchema = z.infer<typeof slideDSLSchema>
export type PresentationDSLSchema = z.infer<typeof presentationDSLSchema>
