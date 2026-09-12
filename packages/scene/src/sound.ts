import type { SoundLayer, Soundscape } from '@atlas/schema'
import type { SceneDiagnostic } from './lint.ts'

// why: an immersive soundtrack would turn a massacre into entertainment, so sound is gated too

// note: the one thing that is never acceptable, however well made
const SCORE_WORDS = /\b(music|musical|score|soundtrack|theme|song|orchestral|cinematic|epic|piano|strings|ambient pad)\b/i

// why: sound under the picture, never over it
const LOUD_GAIN = 0.8

export type LintSoundscapeInput = {
  soundscape: Soundscape | undefined
  sourceCount: number
  // note: the hold keys the scene declares, so a cue cannot be bound to a key that never fires
  eventKeys: readonly string[]
}

// fn: check every sound layer for provenance, restraint and a key it can actually fire on
export function lintSoundscape(input: LintSoundscapeInput): SceneDiagnostic[] {
  const { soundscape } = input
  if (!soundscape) return []

  const layers: { label: string; layer: SoundLayer }[] = [
    ...(soundscape.bed ? [{ label: 'bed', layer: soundscape.bed }] : []),
    ...soundscape.cues.map((cue) => ({ label: `cue "${cue.key}"`, layer: cue })),
  ]

  const diagnostics: SceneDiagnostic[] = layers.flatMap(({ label, layer }) => [
    ...attested(label, layer, input.sourceCount),
    ...restrained(label, layer),
  ])

  for (const cue of soundscape.cues) {
    if (!input.eventKeys.includes(cue.key)) {
      diagnostics.push({
        rule: 'sound/cue-key',
        severity: 'error',
        message: `cue "${cue.key}" is bound to a key the scene does not declare`,
      })
    }
  }

  return diagnostics
}

// fn: a recording that claims to be of the event has to point at the source that says so
function attested(label: string, layer: SoundLayer, sourceCount: number): SceneDiagnostic[] {
  if (layer.kind !== 'archival') return []
  const cited = layer.sourceIndex !== undefined && layer.sourceIndex < sourceCount
  return cited
    ? []
    : [
        {
          rule: 'sound/attested',
          severity: 'error',
          message: `${label} is archival but cites no source the article carries`,
        },
      ]
}

function restrained(label: string, layer: SoundLayer): SceneDiagnostic[] {
  const diagnostics: SceneDiagnostic[] = []

  if (SCORE_WORDS.test(`${layer.caption} ${layer.credit} ${layer.src}`)) {
    diagnostics.push({
      rule: 'sound/no-score',
      severity: 'error',
      message: `${label} reads as music; a world carries the sound of the place, never a score`,
    })
  }

  if (layer.gain > LOUD_GAIN) {
    diagnostics.push({
      rule: 'sound/gain',
      severity: 'warning',
      message: `${label} plays at ${layer.gain}, loud enough to compete with the picture`,
    })
  }

  return diagnostics
}
