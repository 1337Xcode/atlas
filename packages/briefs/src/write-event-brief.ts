import { mkdir, rename, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

import { eventBriefSchema, type EventBrief } from './event-brief.ts'
import { InvalidInputError } from './pipeline-error.ts'

export type BriefWriteResult = {
  readonly path: string
  readonly overwritten: boolean
}

/**
 * One file per brief, no shared index. Two runs at once would race on an index file, and the
 * consumer can read the directory just as easily.
 */
export async function writeEventBrief(
  brief: EventBrief,
  options: { readonly directory: string; readonly overwrite: boolean },
): Promise<BriefWriteResult> {
  const validated = eventBriefSchema.parse(brief)
  const directory = resolve(options.directory)
  const path = resolveInsideDirectory(directory, `${validated.slug}.json`)
  const contents = `${JSON.stringify(validated, null, 2)}\n`

  await mkdir(directory, { recursive: true })

  if (!options.overwrite) {
    // Exclusive create, so a concurrent run cannot pass a check and then clobber the winner.
    await writeFile(path, contents, { encoding: 'utf8', flag: 'wx' }).catch((cause: unknown) => {
      if (isFileExistsError(cause)) {
        throw new InvalidInputError(
          `${validated.slug}.json already exists. Pass --overwrite to replace it, but check its verification status first.`,
          { cause },
        )
      }
      throw cause
    })
    return { path, overwritten: false }
  }

  const temporaryPath = `${path}.${process.pid}.tmp`
  await writeFile(temporaryPath, contents, 'utf8')
  await rename(temporaryPath, path)
  return { path, overwritten: true }
}

function resolveInsideDirectory(directory: string, fileName: string): string {
  const candidate = resolve(directory, fileName)
  const inside = relative(directory, candidate)
  if (inside.length === 0 || inside.startsWith('..') || inside.includes(sep)) {
    throw new InvalidInputError(`Refusing to write outside ${directory}`)
  }
  return candidate
}

function isFileExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST'
}
