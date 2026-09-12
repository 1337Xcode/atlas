import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createArchive } from './archive.ts'

// why: the archive shipped in this repo is the demo, so it is tested like code
const contentDir = fileURLToPath(new URL('../../../content', import.meta.url))
const archive = createArchive({ contentDir, imageBaseUrl: '/api/images' })

describe('the archive in this repository', () => {
  it('loads without a single problem', async () => {
    expect(await archive.problems()).toEqual([])
  })

  it('has at least two servable articles', async () => {
    expect((await archive.servable()).length).toBeGreaterThanOrEqual(2)
  })

  it('is authored as first-person worlds, so the reader is inside the event', async () => {
    for (const article of await archive.servable()) {
      expect(article.world.viewpoint).toBe('first-person')
    }
  })

  it('anchors every world on an image that exists on disk', async () => {
    for (const article of await archive.servable()) {
      const anchor = archive.anchorImage(article)
      await expect(access(join(archive.imagesDir, anchor.src))).resolves.toBeUndefined()
    }
  })

  it('cites a source for every hold-key event', async () => {
    for (const article of await archive.servable()) {
      if (article.world.kind !== 'scene') continue
      for (const event of article.world.events) {
        expect(article.sources[event.sourceIndex]).toBeDefined()
      }
    }
  })

  it('carries no fidelity warnings either', async () => {
    const warnings = (await archive.entries()).flatMap((entry) =>
      entry.diagnostics.map(
        (diagnostic) => `${entry.article.id} ${diagnostic.rule}: ${diagnostic.message}`,
      ),
    )
    expect(warnings).toEqual([])
  })
})
