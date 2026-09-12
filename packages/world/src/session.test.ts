import { sampleArticle, authoredBrief, promptBrief } from '@atlas/schema/testing'
import { describe, expect, it } from 'vitest'
import { LINGBOT } from './models/lingbot.ts'
import { LINGBOT_WORLD_2 } from './models/lingbot-world-2.ts'
import { buildWorldSessionPlan, SceneNotServableError } from './session.ts'

const token = { jwt: 'jwt-token', expiresAt: 1_800_000_000 }
const anchorImageUrl = '/api/images/berlin-wall-opens/crowd-at-the-wall.jpg'

function build(article = sampleArticle(), model = LINGBOT_WORLD_2) {
  return buildWorldSessionPlan({ article, model, token, anchorImageUrl })
}

describe('buildWorldSessionPlan', () => {
  it('hands the browser a runnable plan', () => {
    const { plan, stagingPrompt } = build()
    expect(plan.model).toEqual({ id: 'lingbot-world-2', slug: 'reactor/lingbot-world-2' })
    expect(plan.token).toEqual(token)
    expect(plan.anchorImage.url).toBe(anchorImageUrl)
    expect(plan.scene.seed).toBe(1989)
    expect(stagingPrompt).toContain(plan.scene.layers.base)
  })

  it('compiles the scene against the target model prompt budget', () => {
    expect(build().plan.scene.promptCharBudget).toBe(2000)
    expect(
      build(sampleArticle({ world: promptBrief() }), LINGBOT).plan.scene.promptCharBudget,
    ).toBe(1000)
  })

  it('routes sideways motion through turning when the model has no lateral axis', () => {
    expect(build().plan.controls.strafeMode).toBe('lateral')
    expect(build(sampleArticle({ world: promptBrief() }), LINGBOT).plan.controls.strafeMode).toBe(
      'turn',
    )
  })

  it('pairs every hold key with the source that attests it', () => {
    expect(build().plan.annotations).toEqual([
      {
        key: '1',
        name: 'Hammer strike',
        source: {
          title: 'Berlin Wall: chronology of the opening of the border',
          publisher: 'Stiftung Berliner Mauer',
        },
      },
    ])
  })

  it('refuses to serve a scene that fails a fidelity rule', () => {
    const article = sampleArticle({
      world: authoredBrief({ environment: 'An empty street with no traffic.' }),
    })
    expect(() => build(article)).toThrow(SceneNotServableError)
  })

  it('names the failing rules on refusal, so content can be fixed before a demo', () => {
    const article = sampleArticle({
      world: authoredBrief({
        events: [{ key: '1', name: 'Unsourced', detail: 'The hammer swings.', sourceIndex: 7 }],
      }),
    })
    try {
      build(article)
      expect.unreachable('expected the plan build to refuse')
    } catch (error) {
      expect(error).toBeInstanceOf(SceneNotServableError)
      expect((error as SceneNotServableError).diagnostics.map((d) => d.rule)).toContain(
        'events/attested',
      )
    }
  })

  it('reports non-blocking diagnostics instead of hiding them', () => {
    const { diagnostics } = build(sampleArticle({ world: promptBrief() }))
    expect(diagnostics.every((diagnostic) => diagnostic.severity === 'warning')).toBe(true)
    expect(diagnostics.map((diagnostic) => diagnostic.rule)).toContain('movement/generic-idle')
  })
})
