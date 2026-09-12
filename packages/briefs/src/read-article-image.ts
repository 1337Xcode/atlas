import { readFile } from 'node:fs/promises'

import type OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import type { ExtractedArticle } from './extracted-article.ts'
import { UpstreamServiceError } from './pipeline-error.ts'
import type { ModelCall } from './pipeline-config.ts'

const articleScanSchema = z.object({
  headline: z.string(),
  outlet: z.string(),
  publishedDateText: z.string(),
  byline: z.string(),
  bodyText: z.string(),
  readConfidence: z.enum(['high', 'medium', 'low']),
  unreadablePassages: z.array(z.string()),
})

const SCAN_INSTRUCTIONS = [
  'You are transcribing a photograph of a news article. Transcribe only what is printed.',
  'Copy the body text verbatim, keeping paragraph breaks. Do not summarise, correct, complete,',
  'or modernise it. Where a word or column is unreadable, write [unreadable] in place and add a',
  'short note to unreadablePassages describing what is missing. Leave a field as an empty string',
  'when the page does not state it — never guess an outlet, a date, or a byline.',
].join(' ')

export async function readArticleImage(
  openai: OpenAI,
  scan: ModelCall,
  image: { readonly absolutePath: string; readonly mediaType: string },
): Promise<ExtractedArticle> {
  const bytes = await readFile(image.absolutePath)
  const dataUrl = `data:${image.mediaType};base64,${bytes.toString('base64')}`

  const response = await openai.responses
    .parse({
      model: scan.model,
      max_output_tokens: scan.maxOutputTokens,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: SCAN_INSTRUCTIONS },
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
          ],
        },
      ],
      text: { format: zodTextFormat(articleScanSchema, 'article_scan') },
    })
    .catch((cause: unknown) => {
      throw new UpstreamServiceError('openai.responses', 'Reading the article photo failed', {
        cause,
      })
    })

  if (response.status === 'incomplete') {
    // A half-transcribed clipping reads like a complete one. Fail instead of composing from it.
    throw new UpstreamServiceError(
      'openai.responses',
      `Transcription stopped early (${response.incomplete_details?.reason ?? 'unknown reason'}) — ` +
        `the clipping needs more than SCAN_MAX_OUTPUT_TOKENS=${scan.maxOutputTokens}. ` +
        'Crop it into columns, or raise the limit if your tier allows it.',
    )
  }

  const transcription = response.output_parsed
  if (transcription === null || transcription === undefined) {
    throw new UpstreamServiceError(
      'openai.responses',
      `Model returned no transcription (status ${response.status ?? 'unknown'})`,
    )
  }
  if (transcription.bodyText.trim().length === 0) {
    throw new UpstreamServiceError('openai.responses', 'No readable body text in the photo')
  }

  return {
    headline: transcription.headline.trim(),
    outlet: transcription.outlet.trim(),
    publishedDateText: transcription.publishedDateText.trim(),
    byline: transcription.byline.trim(),
    bodyText: transcription.bodyText.trim(),
    readConfidence: transcription.readConfidence,
    unreadablePassages: transcription.unreadablePassages,
  }
}
