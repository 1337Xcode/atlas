import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLifecycleGuard,
  type LifecycleCountdown,
  type SessionLimitReason,
} from './lifecycle.ts'

const settings = { idleWarningMs: 45_000, idleStopMs: 60_000, maxSessionMs: 120_000 }

let countdowns: (LifecycleCountdown | null)[]
let expired: SessionLimitReason[]

function guard(overrides: Partial<typeof settings> = {}) {
  countdowns = []
  expired = []
  return createLifecycleGuard({
    ...settings,
    ...overrides,
    onCountdown: (countdown) => countdowns.push(countdown),
    onExpire: (reason) => expired.push(reason),
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createLifecycleGuard', () => {
  it('says nothing while the reader is active', () => {
    const lifecycle = guard()
    lifecycle.begin()

    for (let second = 0; second < 40; second += 1) {
      vi.advanceTimersByTime(1_000)
      lifecycle.markActivity()
    }

    expect(expired).toEqual([])
    expect(countdowns.filter(Boolean)).toEqual([])
    lifecycle.dispose()
  })

  it('warns before closing an idle world, and counts down', () => {
    const lifecycle = guard()
    lifecycle.begin()

    vi.advanceTimersByTime(45_000)
    expect(countdowns.at(-1)).toEqual({ kind: 'idle', secondsLeft: 15 })

    vi.advanceTimersByTime(5_000)
    expect(countdowns.at(-1)).toEqual({ kind: 'idle', secondsLeft: 10 })
    expect(expired).toEqual([])

    vi.advanceTimersByTime(10_000)
    expect(expired).toEqual(['idle'])
    lifecycle.dispose()
  })

  it('clears the warning the moment the reader moves again', () => {
    const lifecycle = guard()
    lifecycle.begin()

    vi.advanceTimersByTime(46_000)
    expect(countdowns.at(-1)?.kind).toBe('idle')

    lifecycle.markActivity()
    expect(countdowns.at(-1)).toBeNull()

    vi.advanceTimersByTime(40_000)
    expect(expired).toEqual([])
    lifecycle.dispose()
  })

  it('closes at the hard limit however active the reader is', () => {
    const lifecycle = guard()
    lifecycle.begin()

    for (let second = 0; second < 119; second += 1) {
      vi.advanceTimersByTime(1_000)
      lifecycle.markActivity()
    }
    expect(expired).toEqual([])

    vi.advanceTimersByTime(2_000)
    expect(expired).toEqual(['limit'])
    lifecycle.dispose()
  })

  it('warns about the hard limit even while the reader is moving', () => {
    const lifecycle = guard()
    lifecycle.begin()

    for (let second = 0; second < 105; second += 1) {
      vi.advanceTimersByTime(1_000)
      lifecycle.markActivity()
    }

    expect(countdowns.at(-1)).toEqual({ kind: 'limit', secondsLeft: 15 })
    lifecycle.dispose()
  })

  it('closes a world left in a background tab', () => {
    const lifecycle = guard()
    lifecycle.begin()

    lifecycle.setHidden(true)
    vi.advanceTimersByTime(61_000)
    expect(expired).toEqual(['hidden'])
    lifecycle.dispose()
  })

  it('keeps a world that comes back into view', () => {
    const lifecycle = guard()
    lifecycle.begin()

    lifecycle.setHidden(true)
    vi.advanceTimersByTime(30_000)
    lifecycle.setHidden(false)
    vi.advanceTimersByTime(30_000)

    expect(expired).toEqual([])
    lifecycle.dispose()
  })

  it('expires once, never twice', () => {
    const lifecycle = guard({ idleStopMs: 5_000, idleWarningMs: 4_000 })
    lifecycle.begin()

    vi.advanceTimersByTime(30_000)
    expect(expired).toEqual(['idle'])
    lifecycle.dispose()
  })

  it('does nothing at all until the world is live', () => {
    const lifecycle = guard()
    vi.advanceTimersByTime(300_000)
    expect(expired).toEqual([])
    lifecycle.dispose()
  })
})
