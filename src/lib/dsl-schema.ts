/**
 * Slide DSL Zod Schema
 * 用于验证AI生成的JSON格式
 * 注意：这里不做严格的长度限制，由后处理函数自动分页
 */

import { z } from 'zod'

// ============ 内容块 Schema ============

/**
 * 段落块 Schema
 */
export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1),
  emphasis: z.enum(['normal', 'highlight', 'muted']).optional(),
})

/**
 * 无序列表块 Schema
 */
export const bulletsBlockSchema = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string().min(1)).min(1),
})

/**
 * 有序列表块 Schema
 */
export const numberedBlockSchema = z.object({
  type: z.literal('numbered'),
  items: z.array(z.string().min(1)).min(1),
})

/**
 * 代码块 Schema
 */
export const codeBlockSchema = z.object({
  type: z.literal('code'),
  language: z.string().min(1),
  lines: z.array(z.string()).min(1),
  caption: z.string().optional(),
})

/**
 * 表格块 Schema
 */
export const tableBlockSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
  caption: z.string().optional(),
})

/**
 * 引用块 Schema
 */
export const quoteBlockSchema = z.object({
  type: z.literal('quote'),
  text: z.string().min(1),
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
 * 不做严格限制，由后处理函数自动分页
 */
export const slideDSLSchema = z.object({
  layout: slideLayoutSchema,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.array(contentBlockSchema).optional(),
  leftContent: z.array(contentBlockSchema).optional(),
  rightContent: z.array(contentBlockSchema).optional(),
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
