import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getArticles } from './articles/route.ts'
import { GET as getAudio } from './audio/[...path]/route.ts'
import { GET as getImage } from './images/[...path]/route.ts'
import { POST as postIngest } from './ingest/route.ts'
import { POST as postWorld } from './worlds/[id]/route.ts'

// note: the handlers are plain functions, so the api is tested without running a server
const params = <T>(value: T) => ({ params: Promise.resolve(value) })

beforeEach(() => {
  vi.stubEnv('REACTOR_API_KEY', 'rk_test')
  vi.stubEnv('ATLAS_INGEST_ENABLED', 'false')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/articles', () => {
  it('lists the servable archive with its anchor images', async () => {
    const body = (await (await getArticles()).json()) as {
      articles: { id: string; anchorImageUrl: string }[]
      problems: unknown[]
    }

    expect(body.problems).toEqual([])
    expect(body.articles.length).toBeGreaterThanOrEqual(10)
    expect(body.articles[0]?.anchorImageUrl.startsWith('/api/images/')).toBe(true)
  })
})

describe('GET /api/images', () => {
  it('serves an archive image', async () => {
    const response = await getImage(
      new Request('http://localhost/api/images'),
      params({ path: ['apollo-11-first-steps', 'aldrin-full-frame.jpg'] }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
  })

  it('refuses a path that climbs out of the images directory', async () => {
    const response = await getImage(
      new Request('http://localhost/api/images'),
      params({ path: ['..', 'articles', 'apollo-11-first-steps.json'] }),
    )

    expect(response.status).toBe(404)
  })
})

describe('GET /api/audio', () => {
  it('reports a recording the archive does not have', async () => {
    const response = await getAudio(
      new Request('http://localhost/api/audio'),
      params({ path: ['apollo-11-first-steps', 'missing.m4a'] }),
    )
    expect(response.status).toBe(404)
  })

  it('refuses a path that climbs out of the audio directory', async () => {
    const response = await getAudio(
      new Request('http://localhost/api/audio'),
      params({ path: ['..', 'articles', 'apollo-11-first-steps.json'] }),
    )
    expect(response.status).toBe(404)
  })
})

describe('POST /api/worlds/[id]', () => {
  const request = new Request('http://localhost/api/worlds', { method: 'POST' })

  it('mints a scoped token and returns a runnable plan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ jwt: 'jwt-token', expires_at: 1_800_000_000 })),
    )

    const response = await postWorld(request, params({ id: 'apollo-11-first-steps' }))
    const body = (await response.json()) as {
      plan: { model: { slug: string }; scene: unknown; soundscape: unknown }
    }

    expect(response.status).toBe(200)
    expect(body.plan.model.slug).toBe('reactor/lingbot-world-2')
    expect(body.plan.scene).toBeDefined()
    expect(body.plan.soundscape).toEqual({ cues: [] })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('does not leak the api key to the browser', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ jwt: 'jwt-token', expires_at: 1_800_000_000 })),
    )

    const response = await postWorld(request, params({ id: 'apollo-11-first-steps' }))
    expect(await response.text()).not.toContain('rk_test')
  })

  it('reports a missing article', async () => {
    const response = await postWorld(request, params({ id: 'no-such-article' }))
    expect(response.status).toBe(404)
  })

  it('says so plainly when the key is not configured', async () => {
    vi.stubEnv('REACTOR_API_KEY', '')
    const response = await postWorld(request, params({ id: 'apollo-11-first-steps' }))
    expect(response.status).toBe(503)
  })

  it('passes an upstream token failure through with its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad key', { status: 401 })))
    const response = await postWorld(request, params({ id: 'apollo-11-first-steps' }))
    expect(response.status).toBe(401)
  })
})

describe('POST /api/ingest', () => {
  it('is absent until it is switched on', async () => {
    const response = await postIngest(
      new Request('http://localhost/api/ingest', { method: 'POST', body: '{}' }),
    )
    expect(response.status).toBe(404)
  })

  it('needs the shared token once enabled', async () => {
    vi.stubEnv('ATLAS_INGEST_ENABLED', 'true')
    vi.stubEnv('ATLAS_INGEST_TOKEN', 'ingest-secret')

    const response = await postIngest(
      new Request('http://localhost/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.org' }),
      }),
    )
    expect(response.status).toBe(401)
  })
})
