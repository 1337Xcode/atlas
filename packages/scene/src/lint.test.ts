import { describe, expect, it } from 'vitest'
import { compileScene } from './compile.ts'
import { isServable, lintScene, type SceneDiagnostic } from './lint.ts'
import { authoredBrief, promptBrief } from './scene.fixture.ts'
import type { AuthoredSceneBrief, SceneBrief } from '@atlas/schema'

function lint(brief: SceneBrief, sourceCount = 1): SceneDiagnostic[] {
  return lintScene({ brief, compiled: compileScene(brief, { promptCharBudget: 2000 }), sourceCount })
}

function rules(diagnostics: readonly SceneDiagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.rule)
}

describe('lintScene', () => {
  it('passes a well-formed authored brief', () => {
    const diagnostics = lint(authoredBrief())
    expect(diagnostics).toEqual([])
    expect(isServable(diagnostics)).toBe(true)
  })

  it('rejects prose that describes absence', () => {
    const brief = authoredBrief({ environment: 'An empty street with no traffic and no onlookers.' })
    expect(rules(lint(brief))).toContain('prose/negation')
    expect(isServable(lint(brief))).toBe(false)
  })

  it('rejects camera language outside the camera layer', () => {
    const brief = authoredBrief({ idle: 'The camera holds still on the crowd.' })
    expect(rules(lint(brief))).toContain('prose/camera-language')
  })

  it('rejects an event that cites a source the article does not have', () => {
    const diagnostics = lint(authoredBrief(), 0)
    expect(rules(diagnostics)).toContain('events/attested')
    expect(isServable(diagnostics)).toBe(false)
  })

  it('rejects a scene whose contracts alone overrun the model prompt budget', () => {
    const brief = authoredBrief()
    const compiled = compileScene(brief, { promptCharBudget: 400 })
    const diagnostics = lintScene({ brief, compiled, sourceCount: 1 })
    expect(rules(diagnostics)).toContain('budget/composed')
    expect(isServable(diagnostics)).toBe(false)
  })

  it('warns, but still serves, when a layer overruns its published target', () => {
    const brief = authoredBrief()
    const compiled = compileScene(brief, { promptCharBudget: 1400 })
    const diagnostics = lintScene({ brief, compiled, sourceCount: 1 })
    expect(rules(diagnostics)).toContain('budget/layer')
    expect(isServable(diagnostics)).toBe(true)
  })

  it('warns about a motion verb in the base without blocking the scene', () => {
    const brief = authoredBrief({
      subject: 'A crowd walking along a graffitied concrete wall segment on a floodlit Berlin street.',
    })
    const diagnostics = lint(brief)
    expect(rules(diagnostics)).toContain('prose/motion-verb-in-base')
    expect(isServable(diagnostics)).toBe(true)
  })

  it('warns when an event re-introduces its subject', () => {
    const brief = authoredBrief({
      events: [
        {
          key: '1',
          name: 'Hammer strike',
          detail: 'A mason hammer comes down against the top edge of the wall segment.',
          sourceIndex: 0,
        },
      ],
    } satisfies Partial<AuthoredSceneBrief>)
    expect(rules(lint(brief))).toContain('events/definite-reference')
  })

  it('warns that a free-prompt brief is lower fidelity but still serves it', () => {
    const diagnostics = lint(promptBrief())
    expect(rules(diagnostics)).toEqual(
      expect.arrayContaining(['anchors/pinned', 'movement/generic-idle']),
    )
    expect(isServable(diagnostics)).toBe(true)
  })

  it('rejects intent qualifiers', () => {
    const brief = promptBrief('Make sure the Berlin wall is rendered correctly at night.')
    expect(rules(lint(brief))).toContain('prose/intent-qualifier')
  })
})
