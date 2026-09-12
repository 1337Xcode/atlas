import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authoredBrief, sampleArticle } from '@atlas/schema/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { createArchive } from './archive.ts'
import { readArchiveFile } from './files.ts'

let contentDir: string

async function writeArticle(name: string, body: unknown) {
  await writeFile(join(contentDir, 'articles', `${name}.json`), JSON.stringify(body), 'utf8')
}

beforeEach(async () => {
  contentDir = await mkdtemp(join(tmpdir(), 'atlas-archive-'))
  await mkdir(join(contentDir, 'articles'), { recursive: true })
  await mkdir(join(contentDir, 'images', 'berlin-wall-opens'), { recursive: true })
})

function archive() {
  return createArchive({ contentDir, imageBaseUrl: '/api/images', audioBaseUrl: '/api/audio' })
}

describe('createArchive', () => {
  it('loads and validates the articles on disk', async () => {
    await writeArticle('berlin-wall-opens', sampleArticle())

    const servable = await archive().servable()
    expect(servable.map((article) => article.id)).toEqual(['berlin-wall-opens'])
  })

  it('skips a malformed file and reports it instead of failing the whole archive', async () => {
    await writeArticle('berlin-wall-opens', sampleArticle())
    await writeFile(join(contentDir, 'articles', 'broken.json'), '{ not json', 'utf8')

    const loaded = archive()
    expect((await loaded.servable()).length).toBe(1)
    expect((await loaded.problems())[0]?.file).toBe('broken.json')
  })

  it('rejects an article whose id does not match its filename', async () => {
    await writeArticle('wrong-name', sampleArticle())
    expect((await archive().problems())[0]?.message).toMatch(/does not match filename/)
  })

  it('withholds an article whose scene fails a fidelity rule, and says why', async () => {
    await writeArticle(
      'berlin-wall-opens',
      sampleArticle({ world: authoredBrief({ environment: 'An empty street with no traffic.' }) }),
    )

    const loaded = archive()
    expect(await loaded.servable()).toEqual([])
    expect((await loaded.entries())[0]?.servable).toBe(false)
    expect((await loaded.problems())[0]?.message).toMatch(/prose\/negation/)
  })

  it('resolves relative image sources against the image base url', async () => {
    const article = sampleArticle()
    expect(archive().imageUrl(archive().anchorImage(article))).toBe(
      '/api/images/berlin-wall-opens/crowd-at-the-wall.jpg',
    )
  })

  it('leaves absolute image sources untouched', async () => {
    const article = sampleArticle({
      images: [
        {
          id: 'remote',
          src: 'https://example.org/scan.jpg',
          caption: 'A remote scan.',
          role: 'anchor',
        },
      ],
    })
    expect(archive().imageUrl(archive().anchorImage(article))).toBe(
      'https://example.org/scan.jpg',
    )
  })

  it('finds an article by id', async () => {
    await writeArticle('berlin-wall-opens', sampleArticle())
    expect((await archive().find('berlin-wall-opens'))?.article.headline).toMatch(/Berlin Wall/)
    expect(await archive().find('missing')).toBeUndefined()
  })

  it('caches the load and reloads on demand', async () => {
    await writeArticle('berlin-wall-opens', sampleArticle())
    const loaded = archive()
    expect((await loaded.servable()).length).toBe(1)

    await writeArticle('moon-landing', sampleArticle({ id: 'moon-landing' }))
    expect((await loaded.servable()).length).toBe(1)

    loaded.reload()
    expect((await loaded.servable()).length).toBe(2)
  })
})

describe('readArchiveFile', () => {
  it('reads an image and reports its mime type', async () => {
    const path = join('berlin-wall-opens', 'crowd-at-the-wall.jpg')
    await writeFile(join(contentDir, 'images', path), 'jpeg-bytes', 'utf8')

    const file = await readArchiveFile(join(contentDir, 'images'), path)
    expect(file.mimeType).toBe('image/jpeg')
    expect(Buffer.from(file.bytes).toString()).toBe('jpeg-bytes')
  })

  it('refuses a path that escapes the images directory', async () => {
    await expect(
      readArchiveFile(join(contentDir, 'images'), '../articles/berlin-wall-opens.json'),
    ).rejects.toThrow(/no archive asset/)
  })

  it('refuses a file type that is not an image', async () => {
    await expect(readArchiveFile(join(contentDir, 'images'), 'notes.txt')).rejects.toThrow(
      /no archive asset/,
    )
  })
})
