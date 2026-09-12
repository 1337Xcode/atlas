import { parseArgs } from 'node:util'

import { tavily } from '@tavily/core'
import OpenAI from 'openai'

import { resolveArticleInput } from './article-input.ts'
import { buildEventBrief } from './build-event-brief.ts'
import { describeSectionsOutsideTarget } from './brief-shape-report.ts'
import { readPipelineConfig } from './pipeline-config.ts'
import { exitCodeFor, InvalidInputError } from './pipeline-error.ts'
import { writeEventBrief } from './write-event-brief.ts'

const USAGE = [
  'Usage: node src/cli.ts <article-url | article-photo> [--out <dir>] [--overwrite]',
  '',
  'Writes one unverified event brief as JSON. Needs OPENAI_API_KEY and TAVILY_API_KEY.',
].join('\n')

async function main(argv: readonly string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      out: { type: 'string' },
      overwrite: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  if (values.help || positionals.length === 0) {
    process.stdout.write(`${USAGE}\n`)
    return
  }
  const [target, ...extra] = positionals
  if (extra.length > 0 || target === undefined) {
    throw new InvalidInputError('Pass exactly one article URL or photo path.')
  }

  const config = readPipelineConfig(process.env)
  const input = await resolveArticleInput(target)
  const openai = new OpenAI({
    apiKey: config.llmApiKey,
    baseURL: config.llmBaseUrl,
    timeout: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
  })

  const brief = await buildEventBrief(
    { openai, tavily: tavily({ apiKey: config.tavilyApiKey }), config },
    input,
    reportProgress,
  )
  const written = await writeEventBrief(brief, {
    directory: values.out ?? config.briefsDirectory,
    overwrite: values.overwrite,
  })

  reportProgress(
    `${written.overwritten ? 'Replaced' : 'Wrote'} ${brief.slug} — ` +
      `${brief.corroboratingSources.length} sources, ` +
      `${brief.imageCandidates.length} image candidates needing rights review, ` +
      `${brief.verification.uncertainFactCount} facts to verify`,
  )
  const lengthWarning = describeSectionsOutsideTarget(brief)
  if (lengthWarning.length > 0) {
    reportProgress(lengthWarning)
  }
  process.stdout.write(`${written.path}\n`)
}

/** Progress goes to stderr so stdout stays a single machine-readable path. */
function reportProgress(step: string): void {
  process.stderr.write(`${stripControlCharacters(step)}\n`)
}

/** Extracted text and search queries are untrusted; newlines in them must not forge log lines. */
function stripControlCharacters(text: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the purpose here
  return text.replace(/[\u0000-\u001f\u007f]+/g, ' ')
}

// fn: describe a thrown cause without stringifying an object into "[object Object]"
function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  if (typeof cause === 'string') return cause
  return JSON.stringify(cause) ?? 'unknown cause'
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${stripControlCharacters(detail)}\n`)
  if (error instanceof Error && error.cause !== undefined) {
    process.stderr.write(`  cause: ${stripControlCharacters(describeCause(error.cause))}\n`)
  }
  process.exitCode = exitCodeFor(error)
}
