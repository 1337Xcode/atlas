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
  it('never stages after Exit interrupts an unfinished connection', async () => {
    const fake = createFakeTransport()
    let connected = () => {}
    const connection = new Promise<void>((resolve) => {
      connected = resolve
    })
    const closing = createWorldSession({
      plan: plan(),
      transport: { ...fake, connect: () => connection },
      fetchAnchorImage: async () => new Blob(['image']),
    })
    const started = closing.start()
    await closing.stop()
    connected()
    await vi.advanceTimersByTimeAsync(5_000)
    await started
    expect(fake.names()).toEqual([])
    expect(closing.snapshot().phase).toBe('closed')
  })

  it('counts a held movement key as activity without repeated keydown events', async () => {
    await startLive()
    session.input.press('forward')
    session.nudge()
    await vi.advanceTimersByTimeAsync(65_000)
    expect(session.snapshot().phase).toBe('live')
    await session.stop()
  })

  it('reports provider capacity without retrying or sending model commands', async () => {
    const fake = createFakeTransport()
    const connect = vi
      .fn()
      .mockRejectedValue(
        Object.assign(
          new Error('no available capacity: no available servers to handle the request'),
          { status: 429 },
        ),
      )
    const blocked = createWorldSession({ plan: plan(), transport: { ...fake, connect } })
    await blocked.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(blocked.snapshot().phase).toBe('error')
    expect(blocked.snapshot().error).toContain('no free servers')
    expect(connect).toHaveBeenCalledTimes(1)
    expect(fake.names()).toEqual([])
    expect(fake.status()).toBe('disconnected')
    await blocked.stop()
  })

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

  it('closes the world, rather than holding a gpu, if no video ever arrives', async () => {
    await stage()
    expect(session.snapshot().phase).toBe('warming')

    await vi.advanceTimersByTimeAsync(45_000)
    expect(session.snapshot().phase).toBe('closed')
    expect(session.snapshot().endedReason).toBe('failed')
    expect(session.snapshot().error).toMatch(/never sent any video/)
  })

  // why: a streaming world must never be killed just because chunk reports are late or absent
  it('unlocks the controls from the video stream when no chunk is reported', async () => {
    await stage()
    transport.emitTrack('main_video')
    await vi.advanceTimersByTimeAsync(9_000)

    expect(session.snapshot().phase).toBe('live')
    expect(session.snapshot().notices.at(-1)).toMatch(/video stream/)

    await vi.advanceTimersByTimeAsync(40_000)
    expect(session.snapshot().phase).not.toBe('closed')
  })

  it('keeps a streaming world open past the no-video deadline', async () => {
    await stage()
    transport.emitTrack('main_video')
    await vi.advanceTimersByTimeAsync(45_000)

    expect(session.snapshot().endedReason).toBeUndefined()
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
    // note: inside one chunk's turning budget, so nothing is left to spend
    session.input.accumulateLook({ dxPx: 10, dyPx: 0 })
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

  // why: clipping a fling and throwing the rest away is what made looking feel unresponsive
  it('keeps turning for a chunk or two after a fast flick, then settles', async () => {
    session.input.accumulateLook({ dxPx: 200, dyPx: 0 })
    session.nudge()
    await settle()

    transport.sent.length = 0
    transport.emitChunk(1)
    await settle()
    expect(transport.names()).toContain('set_camera_pose')

    for (let chunk = 2; chunk < 8; chunk += 1) {
      transport.emitChunk(chunk)
      await settle()
    }
    transport.sent.length = 0
    transport.emitChunk(9)
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

  // why: a dropped command used to desync us forever, which is why w stopped moving the reader
  it('resends movement when the model reports it never took effect', async () => {
    session.input.press('forward')
    session.nudge()
    await settle()
    expect(lastMove()).toBe('forward')

    transport.sent.length = 0
    transport.emitMessage('state', {
      running: true,
      started: true,
      paused: false,
      has_image: true,
      has_prompt: true,
      move_longitudinal: 'idle',
      move_lateral: 'idle',
      look_horizontal: 'idle',
      look_vertical: 'idle',
    })
    transport.emitChunk(1)
    await settle()

    expect(transport.names()).toContain('set_move_longitudinal')
    expect(lastMove()).toBe('forward')
  })

  it('sends nothing extra when the model agrees with what we believe', async () => {
    session.input.press('forward')
    session.nudge()
    await settle()

    transport.sent.length = 0
    transport.emitMessage('state', {
      running: true,
      started: true,
      paused: false,
      has_image: true,
      has_prompt: true,
      move_longitudinal: 'forward',
      move_lateral: 'idle',
      look_horizontal: 'idle',
      look_vertical: 'idle',
      current_prompt: session.snapshot().prompt,
    })
    transport.emitChunk(1)
    await settle()

    expect(transport.names()).toEqual([])
  })

  it('keeps webrtc stats for the operator', async () => {
    transport.emitStats({ rtt: 42, framesPerSecond: 48, packetLossRatio: 0, candidateType: 'host' })
    expect(session.snapshot().stats?.framesPerSecond).toBe(48)
  })
})

describe('closing the world', () => {
  beforeEach(async () => {
    await startLive()
  })

  it('warns before closing an idle world, then closes it', async () => {
    await vi.advanceTimersByTimeAsync(46_000)
    expect(session.snapshot().countdown).toMatchObject({ kind: 'idle' })
    expect(session.snapshot().phase).toBe('live')

    await vi.advanceTimersByTimeAsync(15_000)
    expect(session.snapshot().phase).toBe('closed')
    expect(session.snapshot().endedReason).toBe('idle')
  })

  it('keeps the world open while the reader is pressing keys', async () => {
    for (let second = 0; second < 70; second += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
      session.input.press('forward')
      session.nudge()
      session.input.release('forward')
    }

    expect(session.snapshot().phase).toBe('live')
    expect(session.snapshot().endedReason).toBeUndefined()
  })

  it('counts mouse movement as activity', async () => {
    for (let second = 0; second < 70; second += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
      session.input.accumulateLook({ dxPx: 2, dyPx: 0 })
      session.markActivity()
    }

    expect(session.snapshot().phase).toBe('live')
  })

  it('closes at the two minute ceiling however active the reader is', async () => {
    for (let second = 0; second < 130; second += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
      session.markActivity()
    }

    expect(session.snapshot().phase).toBe('closed')
    expect(session.snapshot().endedReason).toBe('limit')
  })

  it('stops sending commands once closed', async () => {
    await session.stop('user')
    transport.sent.length = 0

    session.input.press('forward')
    session.nudge()
    await settle()

    expect(transport.names()).toEqual([])
    expect(transport.status()).toBe('disconnected')
  })

  it('records why the world ended when the reader leaves', async () => {
    await session.stop('user')
    expect(session.snapshot().endedReason).toBe('user')
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
  return transport.sent.filter((command) => command.name === 'set_move_longitudinal').at(-1)?.data
    .move_longitudinal
}
