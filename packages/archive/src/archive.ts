import { join, resolve } from 'node:path'
import type { Article, ArticleImage } from '@atlas/schema'
import { loadArchive, type ArchiveEntry, type ArchiveProblem } from './load.ts'

export type ArchiveConfig = {
  // note: repository-relative or absolute; holds articles/ and images/
  contentDir: string
  // note: url prefix the browser uses to fetch archive images
  imageBaseUrl: string
  modelId?: string
}

export type Archive = {
  entries: () => Promise<ArchiveEntry[]>
  problems: () => Promise<ArchiveProblem[]>
  // note: only articles whose scene passes every fidelity rule
  servable: () => Promise<Article[]>
  find: (id: string) => Promise<ArchiveEntry | undefined>
  imageUrl: (article: Article, image: ArticleImage) => string
  anchorImage: (article: Article) => ArticleImage
  imagesDir: string
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
  const imagesDir = join(root, 'images')
  const base = config.imageBaseUrl.replace(/\/$/, '')

  let loading: Promise<Awaited<ReturnType<typeof loadArchive>>> | undefined

  const load = () => {
    loading ??= loadArchive({
      articlesDir,
      ...(config.modelId === undefined ? {} : { modelId: config.modelId }),
    })
    return loading
  }

  return {
    imagesDir,
    reload: () => {
      loading = undefined
    },
    entries: async () => (await load()).entries,
    problems: async () => (await load()).problems,
    servable: async () =>
      (await load()).entries.filter((entry) => entry.servable).map((entry) => entry.article),
    find: async (id) => (await load()).entries.find((entry) => entry.article.id === id),
    // why: absolute sources stay untouched so archival scans can live on a cdn
    imageUrl: (_article, image) =>
      /^https?:\/\//.test(image.src) ? image.src : `${base}/${image.src}`,
    anchorImage: (article) => {
      const anchor = article.images.find((image) => image.role === 'anchor')
      if (!anchor) throw new MissingAnchorImageError(article.id)
      return anchor
    },
  }
}
