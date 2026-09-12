import {
  createWorldSession,
  describeSessionError,
  type WorldSession,
  type SessionSnapshot,
  type SessionEndReason,
} from '@atlas/runtime'
import { WorldSessionPlanSchema, type WorldSessionPlan } from '@atlas/schema'
import type { Edition } from '../data/editions'

export type Experience = {
  edition: Edition
  plan?: WorldSessionPlan
  session?: WorldSession
  snapshot?: SessionSnapshot
  error?: string
}
type Attempt = { abort: AbortController; session?: WorldSession; off?: () => void }
type Dependencies = {
  publish: (state: Experience | undefined) => void
  ended?: (reason: SessionEndReason) => void
  load?: (id: string, signal: AbortSignal) => Promise<WorldSessionPlan>
  create?: typeof createWorldSession
}

// fn: own one explicit world attempt, including cancellation before the token returns
export function createExperienceController(deps: Dependencies) {
  let current: Attempt | undefined
  let finishing: Promise<void> = Promise.resolve()
  const close = (reason: SessionEndReason = 'user') => {
    const entry = current
    if (!entry) return finishing
    current = undefined
    entry.abort.abort()
    entry.off?.()
    finishing = entry.session?.stop(reason) ?? Promise.resolve()
    deps.publish(undefined)
    deps.ended?.(reason)
    return finishing
  }
  return {
    active: () => current !== undefined,
    close,
    open: async (edition: Edition) => {
      if (current) return
      const entry: Attempt = { abort: new AbortController() }
      current = entry
      deps.publish({ edition })
      try {
        await finishing
        if (current !== entry) return
        const plan = await (deps.load ?? loadPlan)(edition.id, entry.abort.signal)
        if (current !== entry) return
        const session = (deps.create ?? createWorldSession)({ plan })
        entry.session = session
        entry.off = session.subscribe((snapshot) => {
          if (current !== entry) return
          if (snapshot.phase === 'closed') {
            void close(snapshot.endedReason ?? 'user')
            return
          }
          deps.publish({ edition, plan, session, snapshot })
        })
        deps.publish({ edition, plan, session, snapshot: session.snapshot() })
        await session.start()
      } catch (cause) {
        if (current === entry) deps.publish({ edition, error: describeSessionError(cause) })
      }
    },
  }
}

// fix: use the same-origin API; never navigate through a second paper or expose the API key
async function loadPlan(id: string, signal: AbortSignal): Promise<WorldSessionPlan> {
  const response = await fetch(`/api/worlds/${encodeURIComponent(id)}`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'The world could not open.'
    throw Object.assign(new Error(message), { status: response.status })
  }
  return WorldSessionPlanSchema.parse(
    typeof body === 'object' && body !== null && 'plan' in body ? body.plan : undefined,
  )
}
