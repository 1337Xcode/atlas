import { ArticleSchema, type Article } from '@atlas/schema'
import { compileScene, isServable, lintScene, type SceneDiagnostic } from '@atlas/scene'
import { getWorldModel } from '@atlas/world'

// why: an optional side channel — the archive pipeline never imports this, so it costs nothing when off

export type IngestConfig = {
  enabled: boolean
  // note: a shared secret is enough for a hackathon side channel
  token: string
  modelId?: string
}

export type IngestOutcome =
  | { status: 'disabled' }
  | { status: 'unauthorised' }
  | { status: 'invalid'; issues: string[] }
  | { status: 'rejected'; article: Article; diagnostics: SceneDiagnostic[] }
  | { status: 'accepted'; article: Article; diagnostics: SceneDiagnostic[] }

export type Ingest = {
  // fn: validate and fidelity-check an article another service posts to us
  submit: (input: { body: unknown; token: string }) => IngestOutcome
  // fn: turn a news url into a draft an editor finishes by hand
  draft: (input: { url: string; token: string }) => Promise<DraftOutcome>
}

export type ArticleDraft = {
  headline: string
  body: string
  sourceUrl: string
  // note: what a human still has to supply before a world can be served
  missing: string[]
}

export type DraftOutcome =
  | { status: 'disabled' }
  | { status: 'unauthorised' }
  | { status: 'failed'; reason: string }
  | { status: 'drafted'; draft: ArticleDraft }

export function createIngest(config: IngestConfig): Ingest {
  const authorised = (token: string) => config.token.length > 0 && token === config.token

  return {
    submit: ({ body, token }) => {
      if (!config.enabled) return { status: 'disabled' }
      if (!authorised(token)) return { status: 'unauthorised' }

      const parsed = ArticleSchema.safeParse(body)
      if (!parsed.success) {
        return {
          status: 'invalid',
          issues: parsed.error.issues.map(
            (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
          ),
        }
      }

      const article = parsed.data
      const model = getWorldModel(config.modelId)
      const compiled = compileScene(article.world, {
        promptCharBudget: model.capabilities.promptCharBudget,
      })
      const diagnostics = lintScene({
        brief: article.world,
        compiled,
        sourceCount: article.sources.length,
      })

      // why: the same fidelity gate as the archive — a posted article gets no shortcut
      return { status: isServable(diagnostics) ? 'accepted' : 'rejected', article, diagnostics }
    },

    draft: async ({ url, token }) => {
      if (!config.enabled) return { status: 'disabled' }
      if (!authorised(token)) return { status: 'unauthorised' }
      // perf: the readability stack is only loaded when a url is actually ingested
      const { extractArticle } = await import('./extract.ts')
      return extractArticle(url)
    },
  }
}
