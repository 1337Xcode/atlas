import { z } from 'zod'
import { NonEmptyStringSchema } from './common.ts'

// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/prompt-guide

// note: first-person centres the camera contract on a foreground anchor, third-person on a subject
export const ViewpointSchema = z.enum(['first-person', 'third-person'])

// why: landmarks must be pinned with an explicit count or the model spawns duplicates mid-sweep
export const SceneAnchorSchema = z.object({
  object: NonEmptyStringSchema,
  position: NonEmptyStringSchema,
})

// feat: hold-key events append a detail clause while held, and cite the source that attests them
export const SceneEventSchema = z.object({
  key: z.string().length(1),
  name: NonEmptyStringSchema,
  detail: z.union([
    NonEmptyStringSchema,
    z.object({ static: NonEmptyStringSchema, dynamic: NonEmptyStringSchema }),
  ]),
  sourceIndex: z.number().int().nonnegative(),
})

export const SceneVerticalSchema = z.object({
  jump: NonEmptyStringSchema,
  crouch: NonEmptyStringSchema,
  stand: NonEmptyStringSchema,
})

const SceneCommonSchema = z.object({
  viewpoint: ViewpointSchema.default('first-person'),
  focus: NonEmptyStringSchema,
  seed: z.number().int().nonnegative().default(42),
  rotationSpeedDeg: z.number().min(0).max(30).default(5),
})

// feat: authored brief, one slot per prompt layer — the high-fidelity path
export const AuthoredSceneBriefSchema = SceneCommonSchema.extend({
  kind: z.literal('scene'),
  subject: NonEmptyStringSchema,
  anchors: z.array(SceneAnchorSchema).min(2).max(4),
  environment: NonEmptyStringSchema,
  style: NonEmptyStringSchema,
  idle: NonEmptyStringSchema,
  travel: NonEmptyStringSchema,
  guards: z.array(NonEmptyStringSchema).max(4).default([]),
  events: z.array(SceneEventSchema).max(6).default([]),
  vertical: SceneVerticalSchema.optional(),
})

// feat: fallback brief for articles that only carry a free-text world prompt
export const PromptSceneBriefSchema = SceneCommonSchema.extend({
  kind: z.literal('prompt'),
  prompt: NonEmptyStringSchema,
  anchors: z.array(SceneAnchorSchema).max(4).default([]),
})

export const SceneBriefSchema = z.discriminatedUnion('kind', [
  AuthoredSceneBriefSchema,
  PromptSceneBriefSchema,
])

// note: compiled layers are what the runtime recomposes as input state flips
export const SceneLayersSchema = z.object({
  base: z.string(),
  camera: z.object({ static: z.string(), dynamic: z.string() }),
  // note: framing guards ride next to the camera contract, in both variants
  guards: z.string(),
  movement: z.object({ static: z.string(), dynamic: z.string() }),
  events: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      static: z.string(),
      dynamic: z.string(),
    }),
  ),
  vertical: SceneVerticalSchema.optional(),
})

export const CompiledSceneSchema = z.object({
  viewpoint: ViewpointSchema,
  layers: SceneLayersSchema,
  seed: z.number().int().nonnegative(),
  rotationSpeedDeg: z.number(),
  promptCharBudget: z.number().int().positive(),
})

export type Viewpoint = z.infer<typeof ViewpointSchema>
export type SceneAnchor = z.infer<typeof SceneAnchorSchema>
export type SceneEvent = z.infer<typeof SceneEventSchema>
export type SceneVertical = z.infer<typeof SceneVerticalSchema>
export type AuthoredSceneBrief = z.infer<typeof AuthoredSceneBriefSchema>
export type PromptSceneBrief = z.infer<typeof PromptSceneBriefSchema>
export type SceneBrief = z.infer<typeof SceneBriefSchema>
export type SceneLayers = z.infer<typeof SceneLayersSchema>
export type CompiledScene = z.infer<typeof CompiledSceneSchema>
export type CompiledSceneEvent = SceneLayers['events'][number]
