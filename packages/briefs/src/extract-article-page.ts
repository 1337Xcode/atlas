import type { TavilyClient } from '@tavily/core'

import type { ExtractedArticle } from './extracted-article.ts'
import { UpstreamServiceError } from './pipeline-error.ts'

/**
 * Tavily does the fetching, which is the point: an operator-supplied URL never becomes an
 * outbound request from this process, so there is no server-side request forgery surface here.
 */
export async function extractArticlePage(
  tavily: TavilyClient,
  url: string,
  timeoutSeconds: number,
): Promise<ExtractedArticle> {
  const response = await tavily
    .extract([url], { extractDepth: 'advanced', format: 'markdown', timeout: timeoutSeconds })
    .catch((cause: unknown) => {
      throw new UpstreamServiceError('tavily.extract', 'Article extraction failed', { cause })
    })

  const failure = response.failedResults.at(0)
  const result = response.results.at(0)
  if (result === undefined) {
    const reason = failure === undefined ? 'no result returned' : failure.error
    throw new UpstreamServiceError('tavily.extract', `Could not read the article page — ${reason}`)
  }

  const bodyText = result.rawContent.trim()
  if (bodyText.length === 0) {
    throw new UpstreamServiceError('tavily.extract', 'Article page came back empty')
  }

  return {
    headline: result.title?.trim() ?? '',
    outlet: readHostname(result.url),
    publishedDateText: '',
    byline: '',
    bodyText,
    readConfidence: 'high',
    unreadablePassages: [],
  }
}

function readHostname(url: string): string {
  const parsed = URL.parse(url)
  return parsed === null ? '' : parsed.hostname.replace(/^www\./, '')
}
