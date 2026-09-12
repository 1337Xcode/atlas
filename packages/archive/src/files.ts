import { readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

// note: one reader for every archive asset, so images and audio cannot drift apart
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
}

export type ArchiveFile = {
  bytes: Uint8Array
  mimeType: string
}

export class AssetNotFoundError extends Error {
  constructor(path: string) {
    super(`no archive asset at "${path}"`)
    this.name = 'AssetNotFoundError'
  }
}

// fn: read an archive asset by relative path, refusing anything outside its own directory
export async function readArchiveFile(root: string, relativePath: string): Promise<ArchiveFile> {
  const base = resolve(root)
  const target = resolve(join(base, relativePath))
  if (relative(base, target).startsWith('..')) throw new AssetNotFoundError(relativePath)

  const mimeType = MIME_TYPES[extname(target).toLowerCase()]
  if (!mimeType) throw new AssetNotFoundError(relativePath)

  const bytes = await readFile(target).catch(() => {
    throw new AssetNotFoundError(relativePath)
  })
  return { bytes, mimeType }
}

// fn: absolute sources are left alone, so archival scans and recordings can live on a cdn
export function assetUrl(baseUrl: string, src: string): string {
  return /^https?:\/\//.test(src) ? src : `${baseUrl.replace(/\/$/, '')}/${src}`
}
