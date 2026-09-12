import { readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

export type ArchiveImageFile = {
  bytes: Uint8Array
  mimeType: string
}

export class ImageNotFoundError extends Error {
  constructor(path: string) {
    super(`no archive image at "${path}"`)
    this.name = 'ImageNotFoundError'
  }
}

// fn: read an archive image by its relative path, refusing anything outside the images directory
export async function readArchiveImage(
  imagesDir: string,
  relativePath: string,
): Promise<ArchiveImageFile> {
  const root = resolve(imagesDir)
  const target = resolve(join(root, relativePath))
  const inside = relative(root, target)
  if (inside.startsWith('..')) throw new ImageNotFoundError(relativePath)

  const mimeType = MIME_TYPES[extname(target).toLowerCase()]
  if (!mimeType) throw new ImageNotFoundError(relativePath)

  const bytes = await readFile(target).catch(() => {
    throw new ImageNotFoundError(relativePath)
  })
  return { bytes, mimeType }
}
