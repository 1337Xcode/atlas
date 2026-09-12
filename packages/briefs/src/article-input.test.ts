import { expect, it } from 'vitest'

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveArticleInput } from './article-input.ts'
import { InvalidInputError } from './pipeline-error.ts'

it('accepts an https article URL', async () => {
  const input = await resolveArticleInput('https://example.org/news/story?id=4')
  expect(input).toEqual({ kind: 'url', url: 'https://example.org/news/story?id=4' })
})

it('rejects schemes that are not http or https', async () => {
  await expect(() => resolveArticleInput('file:///etc/passwd')).rejects.toThrow(InvalidInputError)
  await expect(() => resolveArticleInput('data://text/plain,hi')).rejects.toThrow(InvalidInputError)
})

it('rejects an empty argument', async () => {
  await expect(() => resolveArticleInput('  ')).rejects.toThrow(InvalidInputError)
})

it('accepts a readable image and reports its media type', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-input-'))
  const path = join(directory, 'clipping.JPG')
  await writeFile(path, 'not really a jpeg, but the pipeline only checks type and size')

  const input = await resolveArticleInput(path)
  expect(input.kind).toBe('image')
  expect(input.kind === 'image' ? input.mediaType : '').toBe('image/jpeg')
})

it('rejects a file type it cannot send as an image', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-input-'))
  const path = join(directory, 'clipping.pdf')
  await writeFile(path, 'pdf')

  await expect(() => resolveArticleInput(path)).rejects.toThrow(InvalidInputError)
})

it('rejects a path that does not exist', async () => {
  await expect(() => resolveArticleInput('/nope/missing-clipping.png')).rejects.toThrow(
    InvalidInputError,
  )
})
