import { join, resolve } from 'node:path'
import type { Article, ArticleImage, WorldSoundscape } from '@atlas/schema'
import { assetUrl } from './files.ts'
import { loadArchive, type ArchiveEntry, type ArchiveProblem } from './load.ts'

export type ArchiveConfig = {
  // note: repository-relative or absolute; holds articles/, images/ and audio/
  contentDir: string
  // note: url prefixes the browser uses to fetch archive assets
  imageBaseUrl: string
  audioBaseUrl: string
  modelId?: string
}

export type Archive = {
  entries: () => Promise<ArchiveEntry[]>
  problems: () => Promise<ArchiveProblem[]>
  // note: only articles whose scene and sound pass every fidelity rule
  servable: () => Promise<Article[]>
  find: (id: string) => Promise<ArchiveEntry | undefined>
  imageUrl: (image: ArticleImage) => string
  anchorImage: (article: Article) => ArticleImage
  // fn: the article's sound with archive paths resolved to urls the browser can fetch
  soundscape: (article: Article) => WorldSoundscape
  imagesDir: string
  audioDir: string
  reload: () => void
}

export class MissingAnchorImageError extends Error {
  constructor(articleId: string) {
    super(`article "${articleId}" has no anchor image`)
    this.name = 'MissingAnchorImageError'
  }
}

// fn: the archive as the rest of the backend sees it, loaded once and cached
export function createArchive(config: ArchiveConfig): Archive {
  const root = resolve(config.contentDir)
  const articlesDir = join(root, 'articles')

  let loading: Promise<Awaited<ReturnType<typeof loadArchive>>> | undefined

  const load = () => {
    loading ??= loadArchive({
      articlesDir,
      ...(config.modelId === undefined ? {} : { modelId: config.modelId }),
    })
    return loading
  }

  return {
    imagesDir: join(root, 'images'),
    audioDir: join(root, 'audio'),
    reload: () => {
      loading = undefined
    },
    entries: async () => (await load()).entries,
    problems: async () => (await load()).problems,
    servable: async () =>
      (await load()).entries.filter((entry) => entry.servable).map((entry) => entry.article),
    find: async (id) => (await load()).entries.find((entry) => entry.article.id === id),
    imageUrl: (image) => assetUrl(config.imageBaseUrl, image.src),
    anchorImage: (article) => {
      const anchor = article.images.find((image) => image.role === 'anchor')
      if (!anchor) throw new MissingAnchorImageError(article.id)
      return anchor
    },
    soundscape: (article) => {
      const sound = article.soundscape
      if (!sound) return { cues: [] }
      const resolve = (layer: NonNullable<typeof sound.bed>) => ({
        url: assetUrl(config.audioBaseUrl, layer.src),
        gain: layer.gain,
        kind: layer.kind,
        caption: layer.caption,
        credit: layer.credit,
      })
      return {
        ...(sound.bed ? { bed: resolve(sound.bed) } : {}),
        cues: sound.cues.map((cue) => ({ ...resolve(cue), key: cue.key })),
      }
    },
  }
}
