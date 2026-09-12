import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import type { DraftOutcome } from './ingest.ts'

// note: a draft is never servable on its own — an editor still owns the scene brief and the sourcing
const MISSING = [
  'dateline',
  'nature',
  'context',
  'anchor image with a cleared credit',
  'sources',
  'world scene brief',
]

const FETCH_TIMEOUT_MS = 10_000

// fn: fetch a news url and pull a headline and body out of it
export async function extractArticle(url: string): Promise<DraftOutcome> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'text/html' },
  }).catch((cause: unknown) => (cause instanceof Error ? cause : new Error(String(cause))))

  if (response instanceof Error) return { status: 'failed', reason: response.message }
  if (!response.ok) return { status: 'failed', reason: `fetch failed: ${response.status}` }

  const { document } = parseHTML(await response.text())
  const parsed = new Readability(document).parse()
  if (!parsed?.textContent) return { status: 'failed', reason: 'no article content found' }

  return {
    status: 'drafted',
    draft: {
      headline: parsed.title?.trim() ?? url,
      body: parsed.textContent.trim(),
      sourceUrl: url,
      missing: MISSING,
    },
  }
}
