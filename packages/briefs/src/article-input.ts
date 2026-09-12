import { stat } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

import { InvalidInputError } from './pipeline-error.ts'

export type ArticleInput =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'image'; readonly absolutePath: string; readonly mediaType: string }

const IMAGE_MEDIA_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
])

/** Photos of newsprint are large. Anything past this is a mistake, not a scan. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export async function resolveArticleInput(argument: string): Promise<ArticleInput> {
  const trimmed = argument.trim()
  if (trimmed.length === 0) {
    throw new InvalidInputError('Pass an article URL or a path to a photo of the article.')
  }
  if (looksLikeUrl(trimmed)) {
    return { kind: 'url', url: parseHttpUrl(trimmed) }
  }
  return resolveImagePath(trimmed)
}

function looksLikeUrl(argument: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(argument)
}

function parseHttpUrl(argument: string): string {
  let parsed: URL
  try {
    parsed = new URL(argument)
  } catch (cause) {
    throw new InvalidInputError(`Not a usable URL: ${argument}`, { cause })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidInputError(`Only http and https URLs are accepted, got ${parsed.protocol}`)
  }
  return parsed.toString()
}

async function resolveImagePath(argument: string): Promise<ArticleInput> {
  const absolutePath = resolve(argument)
  const mediaType = IMAGE_MEDIA_TYPES.get(extname(absolutePath).toLowerCase())
  if (mediaType === undefined) {
    const accepted = [...IMAGE_MEDIA_TYPES.keys()].join(', ')
    throw new InvalidInputError(
      `Unsupported image type for ${basename(absolutePath)} — accepts ${accepted}`,
    )
  }

  const stats = await stat(absolutePath).catch((cause: unknown) => {
    throw new InvalidInputError(`Cannot read ${basename(absolutePath)}`, { cause })
  })
  if (!stats.isFile()) {
    throw new InvalidInputError(`${basename(absolutePath)} is not a file`)
  }
  if (stats.size > MAX_IMAGE_BYTES) {
    throw new InvalidInputError(
      `${basename(absolutePath)} is ${stats.size} bytes, over the ${MAX_IMAGE_BYTES} byte limit`,
    )
  }
  return { kind: 'image', absolutePath, mediaType }
}
