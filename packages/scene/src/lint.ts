import type { CompiledScene, SceneBrief } from '@atlas/schema'
import { sceneBudgetFor } from './budget.ts'
import { composePrompt } from './compose.ts'

export type Severity = 'error' | 'warning'

export type SceneDiagnostic = {
  rule: string
  severity: Severity
  message: string
}

export type LintSceneInput = {
  brief: SceneBrief
  compiled: CompiledScene
  // note: event clauses must point at a real source on the article
  sourceCount: number
}

// why: the model renders the nouns it is given, so absence words place the thing they deny
const NEGATION = /\b(no|not|never|none|nothing|nobody|empty|without|devoid|absent|lacks?)\b/i

// why: framing and camera direction belong to the camera layer alone
// note: a camera can still be an object in the scene, so only directing verbs are flagged
const CAMERA_LANGUAGE =
  /\b(first-person|third-person|point of view|viewpoint)\b|\bcamera\s+(holds|lowers|rises|orbits|moves|tracks|pans|rotates|arcs|circles|stays|sweeps|is)\b/i

// why: anything the base describes as moving keeps moving after the reader releases the key
const MOTION_VERB = /\b(walk|walks|walking|run|runs|running|move|moves|moving|drift|drifts|fly|flies|orbit|orbits|pan|pans|zoom|zooms)\b/i

// why: intent words are invisible to a renderer
const INTENT_QUALIFIER = /\b(make sure|correctly|properly|accurately|be sure|without cutting)\b/i

const INDEFINITE_OPENER = /^\s*(a|an)\s/i

type Rule = {
  name: string
  severity: Severity
  run: (input: LintSceneInput) => string[]
}

const RULES: readonly Rule[] = [
  {
    // note: the per-layer numbers are published targets; only the composed budget is a hard limit
    name: 'budget/layer',
    severity: 'warning',
    run: ({ compiled }) => {
      const budget = sceneBudgetFor(compiled.promptCharBudget)
      const { layers } = compiled
      const over: string[] = []
      if (layers.base.length > budget.base) over.push(oversize('base', layers.base, budget.base))
      if (layers.guards.length > budget.guards) {
        over.push(oversize('guards', layers.guards, budget.guards))
      }
      for (const [variant, text] of Object.entries(layers.camera)) {
        if (text.length > budget.camera) over.push(oversize(`camera.${variant}`, text, budget.camera))
      }
      for (const [variant, text] of Object.entries(layers.movement)) {
        if (text.length > budget.movement) {
          over.push(oversize(`movement.${variant}`, text, budget.movement))
        }
      }
      for (const event of layers.events) {
        const longest = Math.max(event.static.length, event.dynamic.length)
        if (longest > budget.event) over.push(`event "${event.name}" is ${longest} chars, budget ${budget.event}`)
      }
      return over
    },
  },
  {
    name: 'budget/composed',
    severity: 'error',
    run: ({ compiled }) => {
      // note: worst case is moving, crouched, with the two largest events held
      const heaviest = [...compiled.layers.events]
        .sort((a, b) => b.dynamic.length - a.dynamic.length)
        .slice(0, 2)
        .map((event) => event.key)
      const worstCase = composePrompt(compiled, {
        moving: true,
        heldEventKeys: heaviest,
        vertical: 'crouch',
      })
      const budget = compiled.promptCharBudget
      return worstCase.length > budget
        ? [`worst-case prompt is ${worstCase.length} chars, budget ${budget}`]
        : []
    },
  },
  {
    name: 'prose/negation',
    severity: 'error',
    run: (input) => flagFragments(input, NEGATION, 'describes absence; state what is present instead'),
  },
  {
    name: 'prose/camera-language',
    severity: 'error',
    run: (input) => flagFragments(input, CAMERA_LANGUAGE, 'carries camera language outside the camera layer'),
  },
  {
    name: 'prose/motion-verb-in-base',
    severity: 'warning',
    run: ({ brief }) => {
      const base = brief.kind === 'scene' ? `${brief.subject} ${brief.environment}` : brief.prompt
      return MOTION_VERB.test(base) ? ['base layer carries a motion verb; motion runs regardless of input'] : []
    },
  },
  {
    name: 'prose/intent-qualifier',
    severity: 'warning',
    run: (input) => flagFragments(input, INTENT_QUALIFIER, 'states intent rather than the frame'),
  },
  {
    name: 'anchors/pinned',
    severity: 'warning',
    run: ({ brief }) =>
      brief.anchors.length === 0
        ? ['no pinned landmarks; the model may duplicate scenery as the reader turns']
        : [],
  },
  {
    name: 'events/attested',
    severity: 'error',
    run: ({ brief, sourceCount }) => {
      if (brief.kind !== 'scene') return []
      return brief.events
        .filter((event) => event.sourceIndex >= sourceCount)
        .map((event) => `event "${event.name}" cites source ${event.sourceIndex}, which does not exist`)
    },
  },
  {
    name: 'events/definite-reference',
    severity: 'warning',
    run: ({ brief }) => {
      if (brief.kind !== 'scene') return []
      return brief.events
        .flatMap((event) => {
          const details = typeof event.detail === 'string' ? [event.detail] : [event.detail.static, event.detail.dynamic]
          return details.some((detail) => INDEFINITE_OPENER.test(detail)) ? [event.name] : []
        })
        .map((name) => `event "${name}" re-introduces its subject; a re-description spawns a duplicate`)
    },
  },
  {
    name: 'movement/generic-idle',
    severity: 'warning',
    run: ({ brief }) =>
      brief.kind === 'prompt'
        ? ['free-prompt brief uses a generic idle; author a scene brief for a specific one']
        : [],
  },
]

// fn: run every fidelity rule over a compiled scene
export function lintScene(input: LintSceneInput): SceneDiagnostic[] {
  return RULES.flatMap((rule) =>
    rule.run(input).map((message) => ({ rule: rule.name, severity: rule.severity, message })),
  )
}

// fn: true when nothing blocks this scene from being served to a reader
export function isServable(diagnostics: readonly SceneDiagnostic[]): boolean {
  return !diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

// note: guards and the contract templates are the earned exceptions, so only author prose is scanned
function authorFragments(brief: SceneBrief): { label: string; text: string }[] {
  if (brief.kind === 'prompt') return [{ label: 'prompt', text: brief.prompt }]
  return [
    { label: 'subject', text: brief.subject },
    { label: 'environment', text: brief.environment },
    { label: 'style', text: brief.style },
    { label: 'idle', text: brief.idle },
    { label: 'travel', text: brief.travel },
    ...brief.events.flatMap((event) =>
      (typeof event.detail === 'string' ? [event.detail] : [event.detail.static, event.detail.dynamic]).map(
        (text) => ({ label: `event "${event.name}"`, text }),
      ),
    ),
  ]
}

function flagFragments({ brief }: LintSceneInput, pattern: RegExp, reason: string): string[] {
  return authorFragments(brief)
    .filter((fragment) => pattern.test(fragment.text))
    .map((fragment) => `${fragment.label} ${reason}`)
}

function oversize(label: string, text: string, budget: number): string {
  return `${label} is ${text.length} chars, budget ${budget}`
}
