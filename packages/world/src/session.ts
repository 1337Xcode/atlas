import {
  compileScene,
  composeStagingPrompt,
  isServable,
  lintScene,
  type SceneDiagnostic,
} from '@atlas/scene'
import {
  WorldSessionPlanSchema,
  type Article,
  type WorldControlSettings,
  type WorldSessionPlan,
  type WorldSessionToken,
} from '@atlas/schema'
import { REACTOR_API_URL } from './tokens.ts'
import type { WorldModelDescriptor } from './wire.ts'

// note: paced from the reference app's launch sequence, which waits for the model between steps
// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/tutorial
export const DEFAULT_CONTROL_SETTINGS: WorldControlSettings = {
  // note: a generous ceiling, since staging waits on an event and proceeds as soon as it lands
  confirmTimeoutMs: 20_000,
  startDelayMs: 1500,
  resetSettleMs: 600,
  lookSensitivity: 0.0015,
  maxRotationPerLatentRad: 0.05,
  strafeMode: 'lateral',
  maxHoldMs: 6000,
  invertLookY: false,
  // note: 45 seconds of nothing earns a warning, 60 closes the world
  idleWarningMs: 45_000,
  idleStopMs: 60_000,
  // note: two minutes per world, so a forgotten tab cannot run up a bill
  maxSessionMs: 120_000,
}

export class SceneNotServableError extends Error {
  readonly articleId: string
  readonly diagnostics: readonly SceneDiagnostic[]

  constructor(articleId: string, diagnostics: readonly SceneDiagnostic[]) {
    const reasons = diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => `${diagnostic.rule}: ${diagnostic.message}`)
      .join('; ')
    super(`scene for "${articleId}" is not servable — ${reasons}`)
    this.name = 'SceneNotServableError'
    this.articleId = articleId
    this.diagnostics = diagnostics
  }
}

export type BuildWorldSessionPlanInput = {
  article: Article
  model: WorldModelDescriptor
  token: WorldSessionToken
  // note: a url the browser can fetch, since the seed image is uploaded client-side
  anchorImageUrl: string
  apiUrl?: string
  controls?: Partial<WorldControlSettings>
}

export type BuiltWorldSessionPlan = {
  plan: WorldSessionPlan
  diagnostics: SceneDiagnostic[]
  // note: the idle prompt staged before start, precomputed for the client
  stagingPrompt: string
}

// fn: turn a validated article into everything the browser needs to run the world
export function buildWorldSessionPlan(input: BuildWorldSessionPlanInput): BuiltWorldSessionPlan {
  const { article, model, token, anchorImageUrl, apiUrl = REACTOR_API_URL } = input
  const brief = article.world

  const scene = compileScene(brief, { promptCharBudget: model.capabilities.promptCharBudget })
  const diagnostics = lintScene({ brief, compiled: scene, sourceCount: article.sources.length })
  if (!isServable(diagnostics)) throw new SceneNotServableError(article.id, diagnostics)

  const anchor = article.images.find((image) => image.role === 'anchor')
  if (!anchor) throw new SceneNotServableError(article.id, diagnostics)

  const plan = WorldSessionPlanSchema.parse({
    articleId: article.id,
    apiUrl,
    model: { id: model.id, slug: model.slug },
    token,
    scene,
    anchorImage: { url: anchorImageUrl, caption: anchor.caption },
    capabilities: model.capabilities,
    controls: resolveControls(model, input.controls),
    annotations: annotate(article),
  })

  return { plan, diagnostics, stagingPrompt: composeStagingPrompt(scene) }
}

// why: a model without a lateral axis has to route sideways motion through turning
function resolveControls(
  model: WorldModelDescriptor,
  overrides: Partial<WorldControlSettings> = {},
): WorldControlSettings {
  return {
    ...DEFAULT_CONTROL_SETTINGS,
    strafeMode: model.capabilities.move.lateral ? DEFAULT_CONTROL_SETTINGS.strafeMode : 'turn',
    ...overrides,
  }
}

// fn: pair every hold key with the source that attests it
function annotate(article: Article): WorldSessionPlan['annotations'] {
  if (article.world.kind !== 'scene') return []
  return article.world.events.flatMap((event) => {
    const source = article.sources[event.sourceIndex]
    return source ? [{ key: event.key, name: event.name, source }] : []
  })
}
