import { describe, expect, it, vi } from 'vitest'
import { mintSessionToken, ReactorTokenError } from './tokens.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ok = { jwt: 'jwt-token', expires_at: 1_800_000_000 }

describe('mintSessionToken', () => {
  it('scopes the token to the requested models', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(ok))

    const token = await mintSessionToken({
      apiKey: 'rk_test',
      models: ['reactor/lingbot-world-2'],
      fetchImpl,
    })

    expect(token).toEqual({ jwt: 'jwt-token', expiresAt: 1_800_000_000 })

    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://api.reactor.inc/tokens')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Reactor-API-Key')).toBe('rk_test')
    expect(JSON.parse(String(init?.body))).toEqual({
      authorization_details: [
        {
          type: 'session',
          resources: { models: { match: ['reactor/lingbot-world-2'] } },
          constraints: { max_sessions: 5 },
        },
      ],
    })
  })

  it('never puts the api key in the request body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(ok))
    await mintSessionToken({ apiKey: 'rk_test', models: ['reactor/lingbot'], fetchImpl })
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).not.toContain('rk_test')
  })

  it('passes optional constraints through when given', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(ok))
    await mintSessionToken({
      apiKey: 'rk_test',
      models: ['reactor/lingbot-world-2'],
      expiresAfterSeconds: 900,
      maxSessions: 2,
      maxSessionDurationSeconds: 600,
      fetchImpl,
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      expires_after: 900,
      authorization_details: [
        { constraints: { max_sessions: 2, max_session_duration_seconds: 600 } },
      ],
    })
  })

  it('fails clearly when the key is missing', async () => {
    await expect(mintSessionToken({ apiKey: '', models: ['reactor/lingbot'] })).rejects.toThrow(
      /REACTOR_API_KEY is not configured/,
    )
  })

  it('reports the upstream status on rejection', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('bad key', { status: 401 }))
    await expect(
      mintSessionToken({ apiKey: 'rk_bad', models: ['reactor/lingbot'], fetchImpl }),
    ).rejects.toMatchObject({ name: 'ReactorTokenError', status: 401 })
  })

  it('wraps a transport failure instead of leaking it', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('socket hang up'))
    await expect(
      mintSessionToken({ apiKey: 'rk_test', models: ['reactor/lingbot'], fetchImpl }),
    ).rejects.toBeInstanceOf(ReactorTokenError)
  })

  it('rejects a response that does not match the documented shape', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ token: 'nope' }))
    await expect(
      mintSessionToken({ apiKey: 'rk_test', models: ['reactor/lingbot'], fetchImpl }),
    ).rejects.toThrow(/documented shape/)
  })
})
