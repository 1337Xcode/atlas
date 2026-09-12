import type { WorldSoundscape } from '@atlas/schema'
import { describe, expect, it, vi } from 'vitest'
import { createSoundstage, type PlayableSound } from './sound.ts'

type FakeSound = PlayableSound & { url: string; plays: number; pauses: number }

function fakes() {
  const made: FakeSound[] = []
  const create = (url: string): PlayableSound => {
    const sound: FakeSound = {
      url,
      plays: 0,
      pauses: 0,
      loop: false,
      volume: 1,
      currentTime: 0,
      play: () => {
        sound.plays += 1
      },
      pause: () => {
        sound.pauses += 1
      },
    }
    made.push(sound)
    return sound
  }
  return { made, create }
}

const soundscape: WorldSoundscape = {
  bed: {
    url: '/api/audio/apollo/loop.m4a',
    gain: 0.35,
    kind: 'archival',
    caption: 'Air to ground radio loop.',
    credit: 'NASA, public domain',
  },
  cues: [
    {
      key: '1',
      url: '/api/audio/apollo/boot.m4a',
      gain: 0.4,
      kind: 'reconstruction',
      caption: 'Reconstructed boot in regolith.',
      credit: 'Reconstruction',
    },
  ],
}

describe('createSoundstage', () => {
  it('does nothing for a silent article', () => {
    const { made, create } = fakes()
    const stage = createSoundstage({ soundscape: { cues: [] }, create })

    stage.start()
    stage.setHeldKeys(['1'])

    expect(stage.hasSound()).toBe(false)
    expect(made).toEqual([])
  })

  it('loops the bed at its authored gain, once the picture is live', () => {
    const { made, create } = fakes()
    const stage = createSoundstage({ soundscape, create })

    expect(made[0]?.plays).toBe(0)
    stage.start()

    expect(made[0]?.url).toBe('/api/audio/apollo/loop.m4a')
    expect(made[0]?.loop).toBe(true)
    expect(made[0]?.volume).toBe(0.35)
    expect(made[0]?.plays).toBe(1)
  })

  it('fires a cue on the press edge only', () => {
    const { made, create } = fakes()
    const stage = createSoundstage({ soundscape, create })
    stage.start()

    stage.setHeldKeys(['1'])
    stage.setHeldKeys(['1'])
    expect(made[1]?.plays).toBe(1)

    stage.setHeldKeys([])
    stage.setHeldKeys(['1'])
    expect(made[1]?.plays).toBe(2)
  })

  it('ignores a cue for a key the article never declared', () => {
    const { made, create } = fakes()
    const stage = createSoundstage({ soundscape, create })
    stage.start()

    stage.setHeldKeys(['7'])
    expect(made[1]?.plays).toBe(0)
  })

  it('plays nothing before the world is live', () => {
    const { made, create } = fakes()
    const stage = createSoundstage({ soundscape, create })

    stage.setHeldKeys(['1'])
    expect(made[1]?.plays).toBe(0)
  })

  it('stops everything when the world closes', () => {
    const { made, create } = fakes()
    const stage = createSoundstage({ soundscape, create })
    stage.start()
    stage.setHeldKeys(['1'])
    stage.stop()

    expect(made[0]?.pauses).toBe(1)
    expect(made[1]?.pauses).toBe(1)
  })

  it('reports a browser that refuses to play, and can retry from a gesture', () => {
    const onBlocked = vi.fn()
    const stage = createSoundstage({
      soundscape,
      onBlocked,
      create: () => ({
        loop: false,
        volume: 1,
        currentTime: 0,
        play: () => Promise.reject(new Error('autoplay blocked')),
        pause: () => undefined,
      }),
    })

    stage.start()
    return Promise.resolve().then(() => {
      expect(onBlocked).toHaveBeenCalled()
      stage.resume()
    })
  })

  it('survives a player that throws outright', () => {
    const onBlocked = vi.fn()
    const stage = createSoundstage({
      soundscape,
      onBlocked,
      create: () => ({
        loop: false,
        volume: 1,
        currentTime: 0,
        play: () => {
          throw new Error('no audio device')
        },
        pause: () => undefined,
      }),
    })

    expect(() => stage.start()).not.toThrow()
    expect(onBlocked).toHaveBeenCalled()
  })
})
