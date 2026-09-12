import { sampleArticle } from '@atlas/schema/testing'
import { buildWorldSessionPlan, LINGBOT, LINGBOT_WORLD_2 } from '@atlas/world'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorldSession, type WorldSession } from './session.ts'
import { createFakeTransport, type FakeTransport } from './testing.ts'

const token = { jwt: 'jwt-token', expiresAt: 1_800_000_000 }

// note: enough to clear the paced launch sequence, short of the warmup fallback
const STAGING_MS = 3_000

// note: drains the pending command batch without touching any timer deadline
const settle = () => vi.advanceTimersByTimeAsync(1)

function plan(model = LINGBOT_WORLD_2) {
  return buildWorldSessionPlan({
    article: sampleArticle(),
    model,
    token,
    anchorImageUrl: '/api/images/berlin-wall-opens/crowd-at-the-wall.jpg',
  }).plan
}

let transport: FakeTransport
let session: WorldSession

function createSession(model = LINGBOT_WORLD_2, fetchAnchorImage?: () => Promise<Blob>) {
  transport = createFakeTransport()
  session = createWorldSession({
    plan: plan(model),
    transport,
    fetchAnchorImage: fetchAnchorImage ?? (async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
  })
  return session
}

async function stage(model = LINGBOT_WORLD_2) {
  const started = createSession(model).start()
  await vi.advanceTimersByTimeAsync(STAGING_MS)
  await started
}

async function startLive(model = LINGBOT_WORLD_2) {
  await stage(model)
  transport.emitChunk(0)
  await settle()
  transport.sent.length = 0
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('staging a world', () => {
  it('runs the documented launch sequence', async () => {
    await stage()

    expect(transport.uploads).toEqual(['berlin-wall-opens-anchor'])
    expect(transport.names()).toEqual([
      'set_image',
      'set_seed',
      'set_kv_cache_reset',
      'set_attn_window',
      'set_prompt',
      'start',
    ])
  })

  it('stages the idle prompt, not a moving one', async () => {
    await startLive()
    expect(session.snapshot().prompt).toContain('holds its place')
  })

  it('holds input back until the world reports its first chunk', async () => {
    await stage()
    transport.sent.length = 0

    session.input.press('forward')
    session.nudge()
    await settle()
    expect(transport.names()).toEqual([])
    expect(session.snapshot().phase).toBe('warming')

    transport.emitChunk(0)
    await settle()
    expect(session.snapshot().phase).toBe('live')
    expect(transport.names()).toContain('set_move_longitudinal')
  })

  it('surfaces a refused command instead of failing silently', async () => {
    createSession()
    transport.refuse('start', 'conditions not set')
    const started = session.start()
    await vi.advanceTimersByTimeAsync(STAGING_MS)
    await started

    expect(session.snapshot().notices).toContain('start: conditions not set')
  })

  it('reports a staging failure as an error phase, never a throw', async () => {
    const failing = createSession(LINGBOT_WORLD_2, async () => {
      throw new Error('anchor image request failed: 404')
    })
    await failing.start()
    await settle()

    expect(failing.snapshot().phase).toBe('error')
    expect(failing.snapshot().error).toMatch(/404/)
  })

  it('goes live anyway if the world never reports a chunk', async () => {
    await stage()
    expect(session.snapshot().phase).toBe('warming')

    await vi.advanceTimersByTimeAsync(20_000)
    expect(session.snapshot().phase).toBe('live')
    expect(session.snapshot().notices.at(-1)).toMatch(/first chunk/)
  })
})

describe('the live control loop', () => {
  beforeEach(async () => {
    await startLive()
  })

  it('sends nothing when nothing is pressed', async () => {
    session.nudge()
    await settle()
    expect(transport.names()).toEqual([])
  })

  it('walks forward on W and idles the axis on release', async () => {
    session.input.press('forward')
    session.nudge()
    await settle()
    expect(transport.sent.filter((command) => command.name === 'set_move_longitudinal')).toEqual([
      { name: 'set_move_longitudinal', data: { move_longitudinal: 'forward' } },
    ])

    transport.sent.length = 0
    session.input.release('forward')
    session.nudge()
    await settle()
    expect(transport.sent.filter((command) => command.name === 'set_move_longitudinal')).toEqual([
      { name: 'set_move_longitudinal', data: { move_longitudinal: 'idle' } },
    ])
  })

  it('flips the prompt to its moving variants while walking', async () => {
    session.input.press('forward')
    session.nudge()
    await settle()

    const prompt = transport.sent.find((command) => command.name === 'set_prompt')
    expect(String(prompt?.data.prompt)).toContain('presses forward along the base of the wall')
    expect(session.snapshot().moving).toBe(true)
  })

  it('resolves opposing keys the way players expect', async () => {
    session.input.press('forward')
    session.input.press('back')
    session.nudge()
    await settle()
    expect(lastMove()).toBe('back')

    session.input.release('back')
    session.nudge()
    await settle()
    expect(lastMove()).toBe('forward')
  })

  it('never sends the same state twice', async () => {
    session.input.press('forward')
    session.nudge()
    session.nudge()
    session.nudge()
    await settle()
    expect(transport.names().filter((name) => name === 'set_move_longitudinal')).toHaveLength(1)
  })

  it('coalesces a burst of presses into the final state', async () => {
    session.input.press('forward')
    session.input.press('strafe-left')
    session.input.release('strafe-left')
    session.input.press('strafe-right')
    session.nudge()
    await settle()

    expect(transport.sent.filter((command) => command.name === 'set_move_lateral')).toEqual([
      { name: 'set_move_lateral', data: { move_lateral: 'strafe_right' } },
    ])
  })

  it('turns mouse movement into a clamped camera-pose chunk', async () => {
    session.input.accumulateLook({ dxPx: 400, dyPx: 0 })
    session.nudge()
    await settle()

    const pose = transport.sent.find((command) => command.name === 'set_camera_pose')
    const deltas = pose?.data.camera_pose as number[]
    // note: three latents of six floats, yaw clamped to the per-latent ceiling
    expect(deltas).toHaveLength(18)
    expect(deltas[1]).toBeCloseTo(0.05)
    expect(deltas[7]).toBeCloseTo(0.05)
  })

  it('hands the camera back exactly once when the mouse stops', async () => {
    session.input.accumulateLook({ dxPx: 100, dyPx: 0 })
    session.nudge()
    await settle()

    transport.sent.length = 0
    transport.emitChunk(1)
    await settle()
    expect(transport.sent).toEqual([{ name: 'set_camera_pose', data: { camera_pose: [] } }])

    transport.sent.length = 0
    transport.emitChunk(2)
    await settle()
    expect(transport.names()).toEqual([])
  })

  it('raises the viewpoint on a jump, since the vertical axis is y-down', async () => {
    session.input.jump()
    session.nudge()
    await settle()

    const deltas = transport.sent.find((c) => c.name === 'set_camera_pose')?.data
      .camera_pose as number[]
    expect(deltas.filter((_, index) => index % 6 === 4)).toEqual([-1, -1, -1])
  })

  it('lands the jump arc on the chunk clock and drops the jump prompt', async () => {
    session.input.jump()
    session.nudge()
    await settle()
    expect(session.snapshot().prompt).toContain('rises sharply off the cobblestones')

    transport.emitChunk(1)
    transport.emitChunk(2)
    await settle()
    expect(session.input.isJumping()).toBe(false)
    expect(session.snapshot().prompt).not.toContain('rises sharply off the cobblestones')
  })

  it('weaves a sourced event into the prompt while its key is held', async () => {
    session.input.pressEvent('1')
    session.nudge()
    await settle()
    expect(session.snapshot().prompt).toContain('The mason hammer swings down')
    // why: an event is a hard prompt cut, so stale context is flushed
    expect(transport.names()).toContain('trigger_kv_cache_reset')

    transport.sent.length = 0
    session.input.releaseEvent('1')
    session.nudge()
    await settle()
    expect(session.snapshot().prompt).not.toContain('The mason hammer swings down')
  })

  it('clears every held input on a model reset', async () => {
    session.input.press('forward')
    session.input.pressEvent('1')
    transport.emitMessage('generation_reset', { reason: 'requested' })
    await settle()

    expect(session.input.sceneInput()).toEqual({
      moving: false,
      heldEventKeys: [],
      vertical: 'stand',
    })
  })

  it('retries a refused command on the next flush', async () => {
    transport.refuse('set_move_longitudinal', 'not ready')
    session.input.press('forward')
    session.nudge()
    await settle()
    expect(transport.names()).toContain('set_move_longitudinal')

    transport.sent.length = 0
    transport.emitChunk(1)
    await settle()
    expect(transport.names()).toContain('set_move_longitudinal')
  })

  it('keeps webrtc stats for the operator', async () => {
    transport.emitStats({ rtt: 42, framesPerSecond: 48, packetLossRatio: 0 })
    expect(session.snapshot().stats?.framesPerSecond).toBe(48)
  })
})

describe('a model without a pose channel', () => {
  it('drives the discrete look axes instead', async () => {
    await startLive(LINGBOT)

    session.input.press('turn-left')
    session.nudge()
    await settle()

    expect(transport.names()).toContain('set_look_horizontal')
    expect(transport.names()).not.toContain('set_camera_pose')
  })

  it('collapses strafing onto its single movement axis', async () => {
    await startLive(LINGBOT)

    session.input.press('strafe-right')
    session.nudge()
    await settle()

    expect(transport.sent.filter((command) => command.name === 'set_movement')).toEqual([
      { name: 'set_movement', data: { movement: 'strafe_right' } },
    ])
  })
})

function lastMove(): unknown {
  return transport.sent
    .filter((command) => command.name === 'set_move_longitudinal')
    .at(-1)?.data.move_longitudinal
}
