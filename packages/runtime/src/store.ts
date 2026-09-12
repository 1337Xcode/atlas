import type { LifecycleCountdown, SessionLimitReason } from './lifecycle.ts'
import type { TransportStats, TransportStatus, Unsubscribe } from './transport.ts'

// note: why a world is no longer running, so the ui can offer the right way back in
export type SessionEndReason = SessionLimitReason | 'user' | 'failed'

export type SessionPhase =
  | 'idle'
  | 'connecting'
  | 'staging'
  // note: the first seconds of a fresh world materialise the scene and drop input
  | 'warming'
  | 'live'
  | 'error'
  | 'closed'

export type SessionSnapshot = {
  phase: SessionPhase
  status: TransportStatus
  chunkIndex: number
  moving: boolean
  heldEventKeys: string[]
  prompt: string
  // note: command rejections and transport hiccups, newest last
  notices: string[]
  error: string | undefined
  stats: TransportStats | undefined
  // note: set while the world is about to close itself, for the banner
  countdown: LifecycleCountdown | null
  endedReason: SessionEndReason | undefined
  // note: set when the browser refused to play the archive sound without a fresh gesture
  audioBlocked: boolean
}

export type SessionStore = {
  snapshot: () => SessionSnapshot
  update: (patch: Partial<SessionSnapshot>) => void
  notice: (message: string) => void
  subscribe: (listener: (snapshot: SessionSnapshot) => void) => Unsubscribe
}

const MAX_NOTICES = 5

// fn: the observable state of one world, kept outside react so input never triggers a render
export function createSessionStore(status: TransportStatus): SessionStore {
  const listeners = new Set<(snapshot: SessionSnapshot) => void>()

  let snapshot: SessionSnapshot = {
    phase: 'idle',
    status,
    chunkIndex: 0,
    moving: false,
    heldEventKeys: [],
    prompt: '',
    notices: [],
    error: undefined,
    stats: undefined,
    countdown: null,
    endedReason: undefined,
    audioBlocked: false,
  }

  const update: SessionStore['update'] = (patch) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener(snapshot)
  }

  return {
    update,
    snapshot: () => snapshot,
    notice: (message) => update({ notices: [...snapshot.notices, message].slice(-MAX_NOTICES) }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
