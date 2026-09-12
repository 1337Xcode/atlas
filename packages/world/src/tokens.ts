import { type WorldSessionToken, WorldSessionTokenSchema } from '@atlas/schema'
import { z } from 'zod'

// docs: https://docs.reactor.inc/authentication

export const REACTOR_API_URL = 'https://api.reactor.inc'

const TokenResponseSchema = z.object({
  jwt: z.string().min(1),
  expires_at: z.number().int().positive(),
})

export type MintSessionTokenInput = {
  apiKey: string
  // note: connect slugs the token may open sessions for; there is no wildcard
  models: readonly string[]
  apiUrl?: string
  expiresAfterSeconds?: number
  maxSessions?: number
  maxSessionDurationSeconds?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class ReactorTokenError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ReactorTokenError'
    this.status = status
  }
}

// fn: exchange the server-side api key for a short-lived, session-scoped jwt
export async function mintSessionToken(input: MintSessionTokenInput): Promise<WorldSessionToken> {
  const {
    apiKey,
    models,
    apiUrl = REACTOR_API_URL,
    expiresAfterSeconds,
    maxSessions = 5,
    maxSessionDurationSeconds,
    timeoutMs = 10_000,
    fetchImpl = fetch,
  } = input

  if (!apiKey) throw new ReactorTokenError('REACTOR_API_KEY is not configured')
  if (models.length === 0) throw new ReactorTokenError('a scoped token needs at least one model')

  // why: scoping caps the blast radius of a token that reaches the browser
  const body = {
    ...(expiresAfterSeconds === undefined ? {} : { expires_after: expiresAfterSeconds }),
    authorization_details: [
      {
        type: 'session',
        resources: { models: { match: [...models] } },
        constraints: {
          max_sessions: maxSessions,
          ...(maxSessionDurationSeconds === undefined
            ? {}
            : { max_session_duration_seconds: maxSessionDurationSeconds }),
        },
      },
    ],
  }

  const response = await fetchImpl(`${apiUrl}/tokens`, {
    method: 'POST',
    headers: { 'Reactor-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((cause: unknown) => {
    throw new ReactorTokenError(`token request failed: ${describe(cause)}`)
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ReactorTokenError(
      `token request rejected: ${response.status} ${detail}`,
      response.status,
    )
  }

  const parsed = TokenResponseSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success)
    throw new ReactorTokenError('token response did not match the documented shape')

  // note: the server clamps expiry silently, so the returned value is the one to trust
  return WorldSessionTokenSchema.parse({ jwt: parsed.data.jwt, expiresAt: parsed.data.expires_at })
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
