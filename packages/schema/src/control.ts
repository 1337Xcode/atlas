import { z } from 'zod'

// why: these literals are the model's own wire vocabulary, declared once and reused everywhere
// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema#commands
export const LongitudinalSchema = z.enum(['idle', 'forward', 'back'])
export const LateralSchema = z.enum(['idle', 'strafe_left', 'strafe_right'])
export const LookHorizontalSchema = z.enum(['idle', 'left', 'right'])
export const LookVerticalSchema = z.enum(['idle', 'up', 'down'])
export const VerticalPoseSchema = z.enum(['stand', 'jump', 'crouch'])

// note: the reader's intent, model-agnostic — adapters translate it into commands
export const ControlIntentSchema = z.object({
  longitudinal: LongitudinalSchema,
  lateral: LateralSchema,
  lookHorizontal: LookHorizontalSchema,
  lookVertical: LookVerticalSchema,
  rotationSpeedDeg: z.number().min(0).max(30),
})

// note: the slice of intent that changes which prompt layers are composed
export const SceneInputStateSchema = z.object({
  moving: z.boolean(),
  heldEventKeys: z.array(z.string()),
  vertical: VerticalPoseSchema,
})

export const IDLE_CONTROL_INTENT: ControlIntent = {
  longitudinal: 'idle',
  lateral: 'idle',
  lookHorizontal: 'idle',
  lookVertical: 'idle',
  rotationSpeedDeg: 5,
}

export const IDLE_SCENE_INPUT_STATE: SceneInputState = {
  moving: false,
  heldEventKeys: [],
  vertical: 'stand',
}

export type Longitudinal = z.infer<typeof LongitudinalSchema>
export type Lateral = z.infer<typeof LateralSchema>
export type LookHorizontal = z.infer<typeof LookHorizontalSchema>
export type LookVertical = z.infer<typeof LookVerticalSchema>
export type VerticalPose = z.infer<typeof VerticalPoseSchema>
export type ControlIntent = z.infer<typeof ControlIntentSchema>
export type SceneInputState = z.infer<typeof SceneInputStateSchema>
