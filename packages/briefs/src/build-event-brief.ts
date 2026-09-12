import { basename } from 'node:path'

import type { TavilyClient } from '@tavily/core'
import type OpenAI from 'openai'

import type { ArticleInput } from './article-input.ts'
import { composeEventBrief } from './compose-event-brief.ts'
import type { ArticleOrigin, EventBrief } from './event-brief.ts'
import { buildExcerpt, countWords, type ExtractedArticle } from './extracted-article.ts'
import { extractArticlePage } from './extract-article-page.ts'
import { buildSearchQuery, findCorroboratingSources } from './find-corroborating-sources.ts'
import type { PipelineConfig } from './pipeline-config.ts'
import { readArticleImage } from './read-article-image.ts'

export type BriefServices = {
  readonly openai: OpenAI
  readonly tavily: TavilyClient
  readonly config: PipelineConfig
}

export type BriefProgress = (step: string) => void

/**
 * Extract, corroborate, compose, then attach provenance. The composer never sees a URL and
 * never sets the verification status, so every citation in the output came from search and
 * every brief leaves here marked unverified.
 */
export async function buildEventBrief(
  services: BriefServices,
  input: ArticleInput,
  onProgress: BriefProgress,
): Promise<EventBrief> {
  const { openai, tavily, config } = services

  onProgress(input.kind === 'url' ? 'Extracting the article page' : 'Reading the article photo')
  const article = await extractArticle(services, input)
  const retrievedAtUtc = new Date().toISOString()

  const query = buildSearchQuery(article)
  onProgress(`Searching corroborating coverage for "${query}"`)
  const corroboration = await findCorroboratingSources(tavily, query, {
    maxSources: config.maxCorroboratingSources,
    timeoutSeconds: config.tavilyTimeoutSeconds,
  })

  onProgress(`Composing the brief from ${corroboration.sources.length} sources`)
  const composed = await composeEventBrief(openai, config.compose, { article, corroboration })

  return {
    ...composed,
    schemaVersion: 1,
    origin: buildOrigin(input, article, retrievedAtUtc),
    corroboratingSources: [...corroboration.sources],
    imageCandidates: [...corroboration.imageCandidates],
    verification: {
      status: 'unverified',
      generatedAtUtc: new Date().toISOString(),
      composedByModel: config.compose.model,
      uncertainFactCount: composed.uncertainFacts.length,
    },
  }
}

function extractArticle(services: BriefServices, input: ArticleInput): Promise<ExtractedArticle> {
  if (input.kind === 'url') {
    return extractArticlePage(services.tavily, input.url, services.config.tavilyTimeoutSeconds)
  }
  return readArticleImage(services.openai, services.config.scan, input)
}

function buildOrigin(
  input: ArticleInput,
  article: ExtractedArticle,
  retrievedAtUtc: string,
): ArticleOrigin {
  return {
    inputKind: input.kind,
    reference: input.kind === 'url' ? input.url : basename(input.absolutePath),
    headline: article.headline,
    outlet: article.outlet,
    publishedDateText: article.publishedDateText,
    byline: article.byline,
    excerpt: buildExcerpt(article.bodyText),
    wordCount: countWords(article.bodyText),
    retrievedAtUtc,
    readConfidence: article.readConfidence,
    unreadablePassages: [...article.unreadablePassages],
  }
}
