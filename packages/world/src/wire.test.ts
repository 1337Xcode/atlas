import { IDLE_CONTROL_INTENT, type ControlIntent } from '@atlas/schema'
import { describe, expect, it } from 'vitest'
import { LINGBOT } from './models/lingbot.ts'
import { LINGBOT_WORLD_2 } from './models/lingbot-world-2.ts'
import { planCommands, stagingCommands, type WireState } from './wire.ts'

const idle: WireState = { intent: IDLE_CONTROL_INTENT, pose: null, prompt: 'idle prompt' }

function withIntent(state: WireState, intent: Partial<ControlIntent>): WireState {
  return { ...state, intent: { ...state.intent, ...intent } }
}

function names(commands: readonly { name: string }[]): string[] {
  return commands.map((command) => command.name)
}

describe('planCommands on lingbot-world-2', () => {
  it('sends nothing when nothing changed', () => {
    expect(planCommands(LINGBOT_WORLD_2, idle, idle)).toEqual([])
  })

  it('sends only the axis that changed', () => {
    const next = withIntent(idle, { longitudinal: 'forward' })
    expect(planCommands(LINGBOT_WORLD_2, idle, next)).toEqual([
      { name: 'set_move_longitudinal', data: { move_longitudinal: 'forward' } },
    ])
  })

  it('drives both axes for a diagonal', () => {
    const next = withIntent(idle, { longitudinal: 'forward', lateral: 'strafe_left' })
    expect(names(planCommands(LINGBOT_WORLD_2, idle, next))).toEqual([
      'set_move_longitudinal',
      'set_move_lateral',
    ])
  })

  it('idles an axis explicitly on release', () => {
    const moving = withIntent(idle, { longitudinal: 'forward' })
    expect(planCommands(LINGBOT_WORLD_2, moving, idle)).toEqual([
      { name: 'set_move_longitudinal', data: { move_longitudinal: 'idle' } },
    ])
  })

  it('leaves the discrete look axes alone, since look rides the pose channel', () => {
    const next = withIntent(idle, { lookHorizontal: 'left', rotationSpeedDeg: 12 })
    expect(planCommands(LINGBOT_WORLD_2, idle, next)).toEqual([])
  })

  it('resends an active pose every flush, because a pose is a per-chunk motion profile', () => {
    const posed: WireState = { ...idle, pose: [0, 0.02, 0, 0, 0, 0] }
    expect(planCommands(LINGBOT_WORLD_2, posed, posed)).toEqual([
      { name: 'set_camera_pose', data: { camera_pose: [0, 0.02, 0, 0, 0, 0] } },
    ])
  })

  it('clears a released pose exactly once', () => {
    const posed: WireState = { ...idle, pose: [0, 0.02, 0, 0, 0, 0] }
    expect(planCommands(LINGBOT_WORLD_2, posed, idle)).toEqual([
      { name: 'set_camera_pose', data: { camera_pose: [] } },
    ])
    expect(planCommands(LINGBOT_WORLD_2, idle, idle)).toEqual([])
  })

  it('resends the prompt only when the composed text changes', () => {
    const swapped: WireState = { ...idle, prompt: 'moving prompt' }
    expect(planCommands(LINGBOT_WORLD_2, idle, swapped)).toEqual([
      { name: 'set_prompt', data: { prompt: 'moving prompt' } },
    ])
    expect(planCommands(LINGBOT_WORLD_2, swapped, swapped)).toEqual([])
  })

  it('orders a prompt swap ahead of the movement that caused it', () => {
    const next = { ...withIntent(idle, { longitudinal: 'forward' }), prompt: 'moving prompt' }
    expect(names(planCommands(LINGBOT_WORLD_2, idle, next))).toEqual([
      'set_prompt',
      'set_move_longitudinal',
    ])
  })
})

describe('planCommands on lingbot', () => {
  it('collapses both movement axes onto the single axis, forward winning', () => {
    const next = withIntent(idle, { longitudinal: 'forward', lateral: 'strafe_left' })
    expect(planCommands(LINGBOT, idle, next)).toEqual([
      { name: 'set_movement', data: { movement: 'forward' } },
    ])
  })

  it('falls back to strafing when no longitudinal key is held', () => {
    const next = withIntent(idle, { lateral: 'strafe_right' })
    expect(planCommands(LINGBOT, idle, next)).toEqual([
      { name: 'set_movement', data: { movement: 'strafe_right' } },
    ])
  })

  it('uses the discrete look axes and rotation speed', () => {
    const next = withIntent(idle, { lookHorizontal: 'left', rotationSpeedDeg: 10 })
    expect(names(planCommands(LINGBOT, idle, next))).toEqual([
      'set_look_horizontal',
      'set_rotation_speed_deg',
    ])
  })

  it('ignores a pose, because the model has no pose channel', () => {
    expect(planCommands(LINGBOT, idle, { ...idle, pose: [0, 0.02, 0, 0, 0, 0] })).toEqual([])
  })
})

describe('stagingCommands', () => {
  const image = { uploadId: 'u1', name: 'seed.jpg', mimeType: 'image/jpeg', size: 1024 }

  it('stages the image, the prompt and the drift guards', () => {
    const staged = stagingCommands(LINGBOT_WORLD_2, {
      image,
      prompt: 'idle prompt',
      seed: 1989,
      rotationSpeedDeg: 5,
    })
    expect(staged.image).toEqual({ name: 'set_image', data: { image } })
    expect(staged.prompt).toEqual({ name: 'set_prompt', data: { prompt: 'idle prompt' } })
    expect(names(staged.settings)).toEqual(['set_seed', 'set_kv_cache_reset', 'set_attn_window'])
  })

  it('skips settings a model does not declare', () => {
    const staged = stagingCommands(LINGBOT, {
      image,
      prompt: 'idle prompt',
      seed: 1989,
      rotationSpeedDeg: 5,
    })
    expect(names(staged.settings)).toEqual(['set_seed', 'set_rotation_speed_deg'])
  })
})
