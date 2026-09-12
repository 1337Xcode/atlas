import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ArticleSchema } from '@atlas/schema'
import { buildWorldSessionPlan, LINGBOT_WORLD_2 } from '@atlas/world'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindControls } from './controls'
import { createWorldSession, type WorldSession } from './session'
import { createFakeTransport, type FakeTransport } from './testing'

const article = ArticleSchema.parse(
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'content/articles/apollo-11-first-steps.json'), 'utf8'),
  ),
)
let surface: HTMLDivElement
let session: WorldSession
let transport: FakeTransport
let unbind: () => void

// test: exercise the real Apollo prompt and keyboard bindings together, without spending credits
beforeEach(async () => {
  vi.useFakeTimers()
  transport = createFakeTransport()
  const { plan } = buildWorldSessionPlan({
    article,
    model: LINGBOT_WORLD_2,
    token: { jwt: 'test-token', expiresAt: 1_800_000_000 },
    anchorImageUrl: '/image.jpg',
  })
  session = createWorldSession({
    plan,
    transport,
    fetchAnchorImage: async () => new Blob(['image']),
  })
  const starting = session.start()
  await vi.advanceTimersByTimeAsync(3_000)
  await starting
  transport.emitChunk(0)
  surface = document.createElement('div')
  surface.tabIndex = 0
  document.body.append(surface)
  unbind = bindControls({
    surface,
    input: session.input,
    settings: plan.controls,
    capabilities: plan.capabilities,
    eventKeys: plan.annotations.map((annotation) => annotation.key),
    onChange: session.nudge,
    onActivity: session.markActivity,
  })
  surface.focus()
  transport.sent.length = 0
})
afterEach(async () => {
  unbind()
  await session.stop()
  surface.remove()
  vi.useRealTimers()
})
function key(type: 'keydown' | 'keyup', code: string) {
  surface.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
}

describe('Apollo first-person controls', () => {
  it.each([
    ['KeyW', 'set_move_longitudinal', 'move_longitudinal', 'forward'],
    ['KeyS', 'set_move_longitudinal', 'move_longitudinal', 'back'],
    ['KeyA', 'set_move_lateral', 'move_lateral', 'strafe_left'],
    ['KeyD', 'set_move_lateral', 'move_lateral', 'strafe_right'],
  ])('%s starts its axis and releases to idle', (code, name, field, value) => {
    key('keydown', code)
    expect(transport.sent.find((command) => command.name === name)?.data[field]).toBe(value)
    key('keyup', code)
    expect(transport.sent.filter((command) => command.name === name).at(-1)?.data[field]).toBe(
      'idle',
    )
  })
  it('looks with the trackpad while continuing forward movement', async () => {
    key('keydown', 'KeyW')
    surface.dispatchEvent(
      new WheelEvent('wheel', { deltaX: 10, deltaY: 5, bubbles: true, cancelable: true }),
    )
    await vi.advanceTimersByTimeAsync(110)
    const pose = transport.sent.find((command) => command.name === 'set_camera_pose')?.data
      .camera_pose as number[]
    expect(pose[1]).toBeGreaterThan(0)
    expect(pose[3]).toBe(0)
    expect(pose[5]).toBe(0)
    expect(session.input.intent(5).longitudinal).toBe('forward')
  })
  it('supports arrow look and a sourced detail without replacing the world identity', () => {
    key('keydown', 'ArrowRight')
    expect(transport.names()).toContain('set_camera_pose')
    key('keydown', 'Digit1')
    expect(session.snapshot().prompt).toContain('regolith')
    expect(session.snapshot().heldEventKeys).toContain('1')
    key('keyup', 'Digit1')
    expect(session.snapshot().heldEventKeys).toEqual([])
  })
  it('sends no commands after the reader exits', async () => {
    await session.stop()
    transport.sent.length = 0
    key('keydown', 'KeyW')
    surface.dispatchEvent(new WheelEvent('wheel', { deltaX: 10, bubbles: true }))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(transport.names()).toEqual([])
    expect(transport.status()).toBe('disconnected')
  })
})
