import type OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'

import { BRIEF_COMPOSITION_RULES } from './brief-composition-rules.ts'
import { toBriefSlug } from './brief-slug.ts'
import { composedBriefSchema, type ComposedBrief } from './event-brief.ts'
import type { ExtractedArticle } from './extracted-article.ts'
import type { Corroboration } from './find-corroborating-sources.ts'
import type { ModelCall } from './pipeline-config.ts'
import { UpstreamServiceError } from './pipeline-error.ts'

/**
 * Input budget. Groq's free tier counts input and output against one 8,000 tokens-per-minute
 * allowance, so the article body and the search snippets both get trimmed to leave room for
 * a full brief on the way back.
 */
const MAX_BODY_CHARACTERS = 6_000
const MAX_SNIPPET_CHARACTERS = 600

/**
 * Constrained decoding is meant to guarantee the schema, but a brief this wide still comes back
 * short of a field now and then — Groq answers 400 rather than retrying, and the SDK does not
 * retry 400s. Three attempts, then give up: a ceiling, not a loop.
 */
const MAX_COMPOSITION_ATTEMPTS = 3

export async function composeEventBrief(
  openai: OpenAI,
  compose: ModelCall,
  material: { readonly article: ExtractedArticle; readonly corroboration: Corroboration },
): Promise<ComposedBrief> {
  const input = buildCompositionInput(material)

  for (let attempt = 1; attempt <= MAX_COMPOSITION_ATTEMPTS; attempt += 1) {
    try {
      return await requestComposition(openai, compose, input)
    } catch (error) {
      const isLastAttempt = attempt === MAX_COMPOSITION_ATTEMPTS
      if (isLastAttempt || !isSchemaValidationFailure(error)) {
        throw error
      }
    }
  }
  throw new UpstreamServiceError(
    'openai.responses',
    `Model could not fill the brief schema in ${MAX_COMPOSITION_ATTEMPTS} attempts`,
  )
}

/** Groq reports a schema miss as a 400 whose message names the missing property. */
function isSchemaValidationFailure(error: unknown): boolean {
  if (!(error instanceof UpstreamServiceError)) {
    return false
  }
  const cause = error.cause
  if (!(cause instanceof Error)) {
    return false
  }
  return cause.message.includes('does not match the expected schema')
}

async function requestComposition(
  openai: OpenAI,
  compose: ModelCall,
  input: string,
): Promise<ComposedBrief> {
  const response = await openai.responses
    .parse({
      model: compose.model,
      max_output_tokens: compose.maxOutputTokens,
      instructions: BRIEF_COMPOSITION_RULES,
      input: [{ role: 'user', content: input }],
      text: { format: zodTextFormat(composedBriefSchema, 'event_brief') },
    })
    .catch((cause: unknown) => {
      throw new UpstreamServiceError('openai.responses', 'Composing the brief failed', { cause })
    })

  if (response.status === 'incomplete') {
    throw new UpstreamServiceError(
      'openai.responses',
      `Composition stopped early (${response.incomplete_details?.reason ?? 'unknown reason'}) — ` +
        `raise COMPOSE_MAX_OUTPUT_TOKENS above ${compose.maxOutputTokens}.`,
    )
  }

  const composed = response.output_parsed
  if (composed === null || composed === undefined) {
    throw new UpstreamServiceError(
      'openai.responses',
      `Model returned no brief (status ${response.status ?? 'unknown'})`,
    )
  }
  return { ...composed, slug: toBriefSlug(composed.slug || composed.title) }
}

function buildCompositionInput(material: {
  readonly article: ExtractedArticle
  readonly corroboration: Corroboration
}): string {
  const { article, corroboration } = material
  const payload = {
    sourceArticle: {
      headline: article.headline,
      outlet: article.outlet,
      publishedDateText: article.publishedDateText,
      byline: article.byline,
      readConfidence: article.readConfidence,
      unreadablePassages: article.unreadablePassages,
      bodyText: article.bodyText.slice(0, MAX_BODY_CHARACTERS),
      bodyTruncated: article.bodyText.length > MAX_BODY_CHARACTERS,
    },
    searchCoverageSummary: corroboration.coverageAnswer,
    corroboratingCoverage: corroboration.sources.map((source) => ({
      outletOrTitle: source.title,
      publishedDate: source.publishedDate,
      snippet: source.snippet.slice(0, MAX_SNIPPET_CHARACTERS),
    })),
  }
  return JSON.stringify(payload)
}
