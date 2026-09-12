import { z } from 'zod'
import { IdSchema, NonEmptyStringSchema } from './common.ts'

// why: sound is held to the same standard as the pictures, so there are only two honest kinds
// note: `archival` is a real recording of the event; `reconstruction` is plainly labelled as made
export const SoundKindSchema = z.enum(['archival', 'reconstruction'])

export const SoundLayerSchema = z.object({
  id: IdSchema,
  // note: path relative to the archive audio root, or an absolute http(s) url
  src: NonEmptyStringSchema,
  kind: SoundKindSchema,
  caption: NonEmptyStringSchema,
  credit: NonEmptyStringSchema,
  // note: which of the article's sources attests this recording
  sourceIndex: z.number().int().nonnegative().optional(),
  // why: sound sits under the picture, it never competes with it
  gain: z.number().min(0).max(1).default(0.4),
})

// feat: one continuous bed, plus one-shots bound to hold keys the scene already declares
export const SoundscapeSchema = z.object({
  bed: SoundLayerSchema.optional(),
  cues: z.array(SoundLayerSchema.extend({ key: z.string().length(1) })).max(9).default([]),
})

// note: the resolved form that travels to the browser, with urls instead of archive paths
export const WorldSoundLayerSchema = z.object({
  url: NonEmptyStringSchema,
  gain: z.number().min(0).max(1),
  kind: SoundKindSchema,
  caption: NonEmptyStringSchema,
  credit: NonEmptyStringSchema,
})

export const WorldSoundscapeSchema = z.object({
  bed: WorldSoundLayerSchema.optional(),
  cues: z.array(WorldSoundLayerSchema.extend({ key: z.string() })),
})

export type SoundKind = z.infer<typeof SoundKindSchema>
export type SoundLayer = z.infer<typeof SoundLayerSchema>
export type Soundscape = z.infer<typeof SoundscapeSchema>
export type SoundCue = Soundscape['cues'][number]
export type WorldSoundLayer = z.infer<typeof WorldSoundLayerSchema>
export type WorldSoundscape = z.infer<typeof WorldSoundscapeSchema>
