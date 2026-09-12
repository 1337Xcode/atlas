// why: a gpu is billed for every second it is held, so an unattended world has to close itself
// docs: https://docs.reactor.inc/resources/billing

export type SessionLimitReason = 'idle' | 'limit' | 'hidden'

export type LifecycleCountdown = {
  kind: 'idle' | 'limit'
  secondsLeft: number
}

export type LifecycleGuardOptions = {
  // note: when to warn that nothing has been pressed for a while
  idleWarningMs: number
  idleStopMs: number
  // note: the hard ceiling on one world, counted from the first frame
  maxSessionMs: number
  hiddenGraceMs?: number
  tickMs?: number
  onCountdown: (countdown: LifecycleCountdown | null) => void
  onExpire: (reason: SessionLimitReason) => void
}

export type LifecycleGuard = {
  // note: called once the world is actually live, since staging is not billed the same way
  begin: () => void
  markActivity: () => void
  setHidden: (hidden: boolean) => void
  dispose: () => void
}

// why: the reader gets the same warning window before a hard stop as before an idle stop
const LIMIT_WARNING_MS = 20_000

export function createLifecycleGuard(options: LifecycleGuardOptions): LifecycleGuard {
  const tickMs = options.tickMs ?? 1_000
  const hiddenGraceMs = options.hiddenGraceMs ?? 60_000

  let ticker: ReturnType<typeof setInterval> | undefined
  let liveSince: number | undefined
  let lastActivityAt = Date.now()
  let hiddenSince: number | undefined
  let shown: LifecycleCountdown | null = null
  let expired = false

  const publish = (countdown: LifecycleCountdown | null) => {
    // perf: only tell the ui when the displayed value actually changed
    if (countdown?.kind === shown?.kind && countdown?.secondsLeft === shown?.secondsLeft) return
    shown = countdown
    options.onCountdown(countdown)
  }

  const expire = (reason: SessionLimitReason) => {
    if (expired) return
    expired = true
    stopTicker()
    options.onExpire(reason)
  }

  const stopTicker = () => {
    clearInterval(ticker)
    ticker = undefined
  }

  const tick = () => {
    const now = Date.now()

    if (hiddenSince !== undefined && now - hiddenSince >= hiddenGraceMs) {
      expire('hidden')
      return
    }

    if (liveSince !== undefined) {
      const untilLimit = options.maxSessionMs - (now - liveSince)
      if (untilLimit <= 0) {
        expire('limit')
        return
      }
      // note: the hard ceiling wins the banner, because no amount of input postpones it
      if (untilLimit <= LIMIT_WARNING_MS) {
        publish({ kind: 'limit', secondsLeft: Math.ceil(untilLimit / 1_000) })
        return
      }
    }

    const idleFor = now - lastActivityAt
    if (idleFor >= options.idleStopMs) {
      expire('idle')
      return
    }
    if (idleFor >= options.idleWarningMs) {
      publish({ kind: 'idle', secondsLeft: Math.ceil((options.idleStopMs - idleFor) / 1_000) })
      return
    }

    publish(null)
  }

  return {
    begin: () => {
      if (expired || ticker) return
      liveSince = Date.now()
      lastActivityAt = Date.now()
      ticker = setInterval(tick, tickMs)
    },
    markActivity: () => {
      lastActivityAt = Date.now()
      if (shown?.kind === 'idle') publish(null)
    },
    setHidden: (hidden) => {
      hiddenSince = hidden ? Date.now() : undefined
      if (!hidden) lastActivityAt = Date.now()
    },
    dispose: () => {
      stopTicker()
      expired = true
    },
  }
}
