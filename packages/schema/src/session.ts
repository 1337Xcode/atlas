import { z } from 'zod'
import { SourceSchema } from './article.ts'
import { IdSchema, NonEmptyStringSchema } from './common.ts'
import { CompiledSceneSchema } from './scene.ts'

// feat: capabilities travel with the plan so the runtime never offers a control the model lacks
export const WorldCapabilitiesSchema = z.object({
  promptCharBudget: z.number().int().positive(),
  hotSwapPrompt: z.boolean(),
  // note: lateral strafing is a second axis on lingbot-world-2, a single axis on lingbot
  move: z.object({ lateral: z.boolean() }),
  // why: camera-pose carries smooth per-latent deltas; axes are the coarse fallback
  look: z.object({ mode: z.enum(['camera-pose', 'axes']) }),
  // note: pose-driven jump and crouch only exist where camera-pose does
  vertical: z.boolean(),
  rotationSpeed: z.object({
    min: z.number(),
    max: z.number(),
    default: z.number(),
  }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
  }),
  // note: commands land on chunk boundaries, so this is the real input granularity
  chunkMs: z.number().int().positive(),
  // note: latents per chunk, the length unit of a camera-pose payload
  chunkLatents: z.number().int().positive(),
})

// feat: tuning knobs the harness or the production frontend can override per session
export const WorldControlSettingsSchema = z.object({
  // why: a fresh world materialises before it accepts input, so staging is paced
  imageSettleMs: z.number().int().nonnegative(),
  startDelayMs: z.number().int().nonnegative(),
  resetSettleMs: z.number().int().nonnegative(),
  // note: mouse pixels to radians of yaw per latent
  lookSensitivity: z.number().positive(),
  // why: rotation deltas are per-latent velocities and compound over a chunk
  maxRotationPerLatentRad: z.number().positive(),
  // note: lateral strafing is the least stable axis, so turning is offered as an alternative
  strafeMode: z.enum(['lateral', 'turn']),
  // why: long continuous holds accumulate drift, so a hold is capped and allowed to settle
  maxHoldMs: z.number().int().positive(),
  invertLookY: z.boolean(),
  // why: a held gpu is billed by the second, so an unattended world closes itself
  idleWarningMs: z.number().int().positive(),
  idleStopMs: z.number().int().positive(),
  // note: the hard ceiling on one world, counted from its first frame
  maxSessionMs: z.number().int().positive(),
})

export const WorldModelRefSchema = z.object({
  id: NonEmptyStringSchema,
  // note: the connect slug passed to the sdk, e.g. reactor/lingbot-world-2
  slug: NonEmptyStringSchema,
})

export const WorldSessionTokenSchema = z.object({
  jwt: NonEmptyStringSchema,
  // note: unix seconds, as returned by the reactor /tokens exchange
  expiresAt: z.number().int().positive(),
})

export const WorldSessionPlanSchema = z.object({
  articleId: IdSchema,
  apiUrl: z.url(),
  model: WorldModelRefSchema,
  token: WorldSessionTokenSchema,
  scene: CompiledSceneSchema,
  anchorImage: z.object({ url: NonEmptyStringSchema, caption: NonEmptyStringSchema }),
  capabilities: WorldCapabilitiesSchema,
  controls: WorldControlSettingsSchema,
  // feat: every hold key carries the source that attests it, so the reader can check the claim
  annotations: z.array(
    z.object({
      key: z.string(),
      name: NonEmptyStringSchema,
      source: SourceSchema,
    }),
  ),
})

export type WorldCapabilities = z.infer<typeof WorldCapabilitiesSchema>
export type WorldControlSettings = z.infer<typeof WorldControlSettingsSchema>
export type WorldModelRef = z.infer<typeof WorldModelRefSchema>
export type WorldSessionToken = z.infer<typeof WorldSessionTokenSchema>
export type WorldSessionPlan = z.infer<typeof WorldSessionPlanSchema>
