import { z } from 'zod'
import type { ModelMessage } from './transport.ts'

// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema#messages
// why: messages are the source of truth, and the wire may carry types the schema has not declared

const ImageAccepted = z.looseObject({ width: z.number(), height: z.number() })
const ChunkComplete = z.looseObject({ chunk_index: z.number() })
const CommandError = z.looseObject({
  command: z.string().optional(),
  reason: z.string().optional(),
})
// docs: state is the authoritative session snapshot, including what the inputs are actually set to
const State = z.looseObject({
  running: z.boolean(),
  started: z.boolean(),
  paused: z.boolean(),
  has_image: z.boolean(),
  has_prompt: z.boolean(),
  current_prompt: z.string().nullish(),
  move_longitudinal: z.string().optional(),
  move_lateral: z.string().optional(),
  look_horizontal: z.string().optional(),
  look_vertical: z.string().optional(),
  rotation_speed_deg: z.number().optional(),
  camera_pose_active: z.boolean().optional(),
})

export type ModelEvent =
  | { kind: 'image-accepted'; width: number; height: number }
  | { kind: 'prompt-accepted' }
  | { kind: 'conditions-ready' }
  | { kind: 'generation-started' }
  | { kind: 'chunk-complete'; chunkIndex: number }
  | { kind: 'generation-paused' }
  | { kind: 'generation-resumed' }
  | { kind: 'generation-complete' }
  | { kind: 'generation-reset' }
  | { kind: 'command-error'; command: string; reason: string }
  | {
      kind: 'state'
      running: boolean
      started: boolean
      hasImage: boolean
      hasPrompt: boolean
      // note: what the model says its inputs are, which is what the session reconciles against
      inputs: {
        prompt: string | undefined
        longitudinal: string | undefined
        lateral: string | undefined
        lookHorizontal: string | undefined
        lookVertical: string | undefined
        rotationSpeedDeg: number | undefined
        cameraPoseActive: boolean | undefined
      }
    }
  | { kind: 'unknown'; type: string }

// fn: narrow a raw model message to an event the session acts on
export function readModelMessage(message: ModelMessage): ModelEvent {
  switch (message.type) {
    case 'image_accepted': {
      const parsed = ImageAccepted.safeParse(message.data)
      return parsed.success
        ? { kind: 'image-accepted', width: parsed.data.width, height: parsed.data.height }
        : { kind: 'image-accepted', width: 0, height: 0 }
    }
    case 'prompt_accepted':
      return { kind: 'prompt-accepted' }
    case 'conditions_ready':
      return { kind: 'conditions-ready' }
    case 'generation_started':
      return { kind: 'generation-started' }
    case 'chunk_complete': {
      const parsed = ChunkComplete.safeParse(message.data)
      return { kind: 'chunk-complete', chunkIndex: parsed.success ? parsed.data.chunk_index : 0 }
    }
    case 'generation_paused':
      return { kind: 'generation-paused' }
    case 'generation_resumed':
      return { kind: 'generation-resumed' }
    case 'generation_complete':
      return { kind: 'generation-complete' }
    case 'generation_reset':
      return { kind: 'generation-reset' }
    case 'command_error': {
      const parsed = CommandError.safeParse(message.data)
      return {
        kind: 'command-error',
        command: parsed.success ? (parsed.data.command ?? '?') : '?',
        reason: parsed.success ? (parsed.data.reason ?? 'unknown error') : 'unknown error',
      }
    }
    case 'state': {
      const parsed = State.safeParse(message.data)
      if (!parsed.success) return { kind: 'unknown', type: message.type }
      return {
        kind: 'state',
        running: parsed.data.running,
        started: parsed.data.started,
        hasImage: parsed.data.has_image,
        hasPrompt: parsed.data.has_prompt,
        inputs: {
          prompt: parsed.data.current_prompt ?? undefined,
          longitudinal: parsed.data.move_longitudinal,
          lateral: parsed.data.move_lateral,
          lookHorizontal: parsed.data.look_horizontal,
          lookVertical: parsed.data.look_vertical,
          rotationSpeedDeg: parsed.data.rotation_speed_deg,
          cameraPoseActive: parsed.data.camera_pose_active,
        },
      }
    }
    default:
      return { kind: 'unknown', type: message.type }
  }
}
