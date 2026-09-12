import { expect, it } from 'vitest'

import type OpenAI from 'openai'

import { composeEventBrief } from './compose-event-brief.ts'
import type { ComposedBrief } from './event-brief.ts'
import type { ExtractedArticle } from './extracted-article.ts'
import type { Corroboration } from './find-corroborating-sources.ts'
import { UpstreamServiceError } from './pipeline-error.ts'

const article: ExtractedArticle = {
  headline: 'Bridge opens to traffic',
  outlet: 'example.org',
  publishedDateText: '19 March 1932',
  byline: '',
  bodyText: 'Crowds gathered at the southern approach.',
  readConfidence: 'high',
  unreadablePassages: [],
}

const corroboration: Corroboration = { sources: [], imageCandidates: [], coverageAnswer: '' }

const composed = { slug: 'harbour-bridge-opening', title: 'The Harbour Bridge Opens' }

function buildClient(behaviours: readonly ('schema-miss' | 'other-400' | 'ok')[]): OpenAI {
  let call = 0
  return {
    responses: {
      parse: () => {
        const behaviour = behaviours[call]
        call += 1
        if (behaviour === 'schema-miss') {
          return Promise.reject(new Error('400 Generated JSON does not match the expected schema.'))
        }
        if (behaviour === 'other-400') {
          return Promise.reject(new Error('400 model_not_found'))
        }
        return Promise.resolve({ output_parsed: composed, status: 'completed' })
      },
    },
  } as unknown as OpenAI
}

const compose = { model: 'test-model', maxOutputTokens: 4_000 }

it('retries a schema miss and returns the brief once it lands', async () => {
  const client = buildClient(['schema-miss', 'ok'])
  const brief = await composeEventBrief(client, compose, { article, corroboration })

  expect(brief.slug).toBe('harbour-bridge-opening')
})

it('gives up after three schema misses instead of looping', async () => {
  const client = buildClient(['schema-miss', 'schema-miss', 'schema-miss', 'ok'])

  await expect(composeEventBrief(client, compose, { article, corroboration })).rejects.toThrow(
    UpstreamServiceError,
  )
})

it('does not retry a failure that is not a schema miss', async () => {
  const client = buildClient(['other-400', 'ok'])

  await expect(composeEventBrief(client, compose, { article, corroboration })).rejects.toThrow(
    'Composing the brief failed',
  )
})

it('normalises whatever slug the model proposes', async () => {
  const parsed = { ...composed, slug: 'Harbour Bridge, 1932' }
  const client = {
    responses: { parse: () => Promise.resolve({ output_parsed: parsed, status: 'completed' }) },
  } as unknown as OpenAI

  const brief: ComposedBrief = await composeEventBrief(client, compose, { article, corroboration })

  expect(brief.slug).toBe('harbour-bridge-1932')
})
