import type { Soundscape } from '@atlas/schema'
import { SoundscapeSchema } from '@atlas/schema'
import { describe, expect, it } from 'vitest'
import { lintSoundscape } from './sound.ts'

function soundscape(overrides: Record<string, unknown> = {}): Soundscape {
  return SoundscapeSchema.parse({
    bed: {
      id: 'radio-loop',
      src: 'apollo-11-first-steps/air-to-ground-loop.m4a',
      kind: 'archival',
      caption: 'Air to ground radio loop during the lunar surface activity.',
      credit: 'NASA, public domain',
      sourceIndex: 0,
      gain: 0.35,
    },
    cues: [],
    ...overrides,
  })
}

function rules(soundtrack: Soundscape, eventKeys: readonly string[] = ['1'], sourceCount = 2) {
  return lintSoundscape({ soundscape: soundtrack, sourceCount, eventKeys }).map((d) => d.rule)
}

describe('lintSoundscape', () => {
  it('accepts silence', () => {
    expect(lintSoundscape({ soundscape: undefined, sourceCount: 1, eventKeys: [] })).toEqual([])
  })

  it('accepts a sourced archival bed', () => {
    expect(rules(soundscape())).toEqual([])
  })

  it('rejects an archival recording that cites nothing', () => {
    const loose = soundscape({
      bed: { ...soundscape().bed, sourceIndex: undefined },
    })
    expect(rules(loose)).toContain('sound/attested')
  })

  it('rejects an archival recording citing a source the article lacks', () => {
    expect(rules(soundscape(), ['1'], 0)).toContain('sound/attested')
  })

  it('allows a reconstruction without a source, since it claims to be made', () => {
    const made = soundscape({
      bed: {
        id: 'quay-ambience',
        src: 'windrush-arrival-tilbury/quay.m4a',
        kind: 'reconstruction',
        caption: 'Reconstructed dockside ambience: water, ropes, distant cranes.',
        credit: 'Reconstruction by the Atlas team',
        gain: 0.3,
      },
    })
    expect(rules(made)).toEqual([])
  })

  it('rejects anything that reads as a score', () => {
    const scored = soundscape({
      bed: {
        ...soundscape().bed,
        caption: 'Sombre piano theme under the procession.',
      },
    })
    expect(rules(scored)).toContain('sound/no-score')
  })

  it('rejects a cue bound to a key the scene does not declare', () => {
    const stray = soundscape({
      cues: [
        {
          id: 'hammer',
          key: '9',
          src: 'berlin-wall-border-opens/hammer.m4a',
          kind: 'reconstruction',
          caption: 'Reconstructed hammer strike on concrete.',
          credit: 'Reconstruction by the Atlas team',
          gain: 0.4,
        },
      ],
    })
    expect(rules(stray, ['1', '2', '3'])).toContain('sound/cue-key')
  })

  it('warns when sound is loud enough to compete with the picture', () => {
    const loud = soundscape({ bed: { ...soundscape().bed, gain: 0.95 } })
    expect(rules(loud)).toContain('sound/gain')
  })
})
