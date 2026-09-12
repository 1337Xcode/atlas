import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { ArticleSchema, type Article } from '@atlas/schema'
import {
  compileScene,
  isServable,
  lintScene,
  lintSoundscape,
  type SceneDiagnostic,
} from '@atlas/scene'
import { getWorldModel } from '@atlas/world'

export type ArchiveEntry = {
  article: Article
  file: string
  diagnostics: SceneDiagnostic[]
  // note: false when a fidelity rule would let the world misrepresent the event
  servable: boolean
}

export type ArchiveProblem = {
  file: string
  message: string
}

export type LoadedArchive = {
  entries: ArchiveEntry[]
  problems: ArchiveProblem[]
}

export type LoadArchiveOptions = {
  articlesDir: string
  // note: the scene is compiled against this model's prompt budget
  modelId?: string
}

// fn: read and validate every article in the archive, reporting rather than throwing
export async function loadArchive(options: LoadArchiveOptions): Promise<LoadedArchive> {
  const model = getWorldModel(options.modelId)
  const files = await listArticleFiles(options.articlesDir)

  const entries: ArchiveEntry[] = []
  const problems: ArchiveProblem[] = []

  for (const file of files) {
    const parsed = await parseArticle(join(options.articlesDir, file))
    if (!parsed.ok) {
      problems.push({ file, message: parsed.message })
      continue
    }

    // note: ids are unique because each must match its filename
    const article = parsed.article
    const compiled = compileScene(article.world, {
      promptCharBudget: model.capabilities.promptCharBudget,
    })
    const diagnostics = [
      ...lintScene({ brief: article.world, compiled, sourceCount: article.sources.length }),
      ...lintSoundscape({
        soundscape: article.soundscape,
        sourceCount: article.sources.length,
        eventKeys: compiled.layers.events.map((event) => event.key),
      }),
    ]
    const servable = isServable(diagnostics)
    entries.push({ article, file, diagnostics, servable })

    if (!servable) {
      problems.push({ file, message: summarise(diagnostics) })
    }
  }

  return { entries, problems }
}

async function listArticleFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch((cause: unknown) => {
    throw new Error(`cannot read archive directory "${dir}": ${describe(cause)}`)
  })
  return names.filter((name) => name.endsWith('.json')).sort()
}

type ParseResult = { ok: true; article: Article } | { ok: false; message: string }

async function parseArticle(path: string): Promise<ParseResult> {
  const raw = await readFile(path, 'utf8').catch((cause: unknown) => describe(cause))
  if (typeof raw !== 'string') return { ok: false, message: raw }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (cause) {
    return { ok: false, message: `invalid json: ${describe(cause)}` }
  }

  const parsed = ArticleSchema.safeParse(json)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return { ok: false, message: issues }
  }

  // why: id and filename agree so the archive is navigable by hand
  const expected = basename(path, '.json')
  if (parsed.data.id !== expected) {
    return { ok: false, message: `article id "${parsed.data.id}" does not match filename` }
  }

  return { ok: true, article: parsed.data }
}

function summarise(diagnostics: readonly SceneDiagnostic[]): string {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => `${diagnostic.rule}: ${diagnostic.message}`)
    .join('; ')
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
