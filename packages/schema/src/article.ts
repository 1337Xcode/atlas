import { z } from 'zod'
import { IdSchema, NonEmptyStringSchema } from './common.ts'
import { SceneBriefSchema } from './scene.ts'

// note: the anchor image is the seed frame the world model conditions on, plates are page dressing
export const ImageRoleSchema = z.enum(['anchor', 'plate'])

export const ArticleImageSchema = z.object({
  id: IdSchema,
  // note: path relative to the archive image root, or an absolute http(s) url
  src: NonEmptyStringSchema,
  caption: NonEmptyStringSchema,
  credit: NonEmptyStringSchema.optional(),
  role: ImageRoleSchema.default('plate'),
})

// why: education, not entertainment — every article and every staged event cites a source
export const SourceSchema = z.object({
  title: NonEmptyStringSchema,
  publisher: NonEmptyStringSchema.optional(),
  url: z.url().optional(),
})

export const ArticleSchema = z
  .object({
    id: IdSchema,
    headline: NonEmptyStringSchema,
    dateline: NonEmptyStringSchema,
    occurredOn: z.iso.date().optional(),
    nature: NonEmptyStringSchema,
    summary: NonEmptyStringSchema,
    body: NonEmptyStringSchema,
    context: NonEmptyStringSchema,
    // why: some events need care — what the world deliberately does not stage is stated up front
    contentNote: NonEmptyStringSchema.optional(),
    images: z.array(ArticleImageSchema).min(1),
    sources: z.array(SourceSchema).min(1),
    world: SceneBriefSchema,
  })
  .refine((article) => article.images.filter((image) => image.role === 'anchor').length === 1, {
    error: 'exactly one image must carry role "anchor"',
    path: ['images'],
  })

export type ImageRole = z.infer<typeof ImageRoleSchema>
export type ArticleImage = z.infer<typeof ArticleImageSchema>
export type Source = z.infer<typeof SourceSchema>
export type Article = z.infer<typeof ArticleSchema>
