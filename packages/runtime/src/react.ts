import type { WorldSessionPlan } from '@atlas/schema'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { bindControls } from './controls.ts'
import { bindTouchControls } from './touch.ts'
import { createWorldSession, type CreateWorldSessionOptions, type WorldSession } from './session.ts'
import type { SessionSnapshot } from './store.ts'
import type { WorldTransport } from './transport.ts'

export type UseWorldSessionOptions = {
  // note: off by default, so the reader opens the world with a deliberate click
  autoStart?: boolean
  transport?: WorldTransport
}

// fn: own one world session for the lifetime of a plan
export function useWorldSession(
  plan: WorldSessionPlan | undefined,
  options: UseWorldSessionOptions = {},
): { session: WorldSession | undefined; snapshot: SessionSnapshot | undefined } {
  const [session, setSession] = useState<WorldSession>()
  const { autoStart = false, transport } = options

  useEffect(() => {
    if (!plan) return
    const created = createWorldSession({
      plan,
      ...(transport ? { transport } : {}),
    } satisfies CreateWorldSessionOptions)
    setSession(created)

    // why: strict mode mounts twice in development, and connecting twice opens two billed sessions
    const scheduled = autoStart ? setTimeout(() => void created.start(), 0) : undefined

    return () => {
      clearTimeout(scheduled)
      setSession(undefined)
      void created.stop('user')
    }
  }, [plan, autoStart, transport])

  const subscribe = useCallback(
    (listener: () => void) => session?.subscribe(listener) ?? (() => undefined),
    [session],
  )
  const snapshot = useSyncExternalStore(
    subscribe,
    () => session?.snapshot(),
    () => undefined,
  )

  return { session, snapshot }
}

// fn: bind the video element the world streams into
export function useWorldViewport(session: WorldSession | undefined) {
  return useCallback(
    (element: HTMLVideoElement | null) => {
      session?.attachVideo(element)
    },
    [session],
  )
}

// fn: bind keyboard and pointer-lock controls to the element the reader clicks into
export function useWorldControls(
  session: WorldSession | undefined,
  plan: WorldSessionPlan | undefined,
) {
  // why: the element arrives as state, so binding re-runs if react swaps the node
  const [surface, setSurface] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!surface || !session || !plan) return
    return bindControls({
      surface,
      input: session.input,
      settings: plan.controls,
      capabilities: plan.capabilities,
      eventKeys: plan.annotations.map((annotation) => annotation.key),
      onChange: session.nudge,
      onActivity: session.markActivity,
    })
  }, [surface, session, plan])

  return setSurface
}

// fn: true on a touch-first device, which is the honest signal, not the screen width
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(pointer: coarse)')
    setCoarse(query.matches)
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return coarse
}

// fn: bind the on-screen pads, a move stick on the left and a look area on the right
export function useWorldTouchControls(
  session: WorldSession | undefined,
  plan: WorldSessionPlan | undefined,
) {
  const [movePad, setMovePad] = useState<HTMLElement | null>(null)
  const [lookPad, setLookPad] = useState<HTMLElement | null>(null)
  const [buttonBar, setButtonBar] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!movePad || !lookPad || !session || !plan) return
    return bindTouchControls({
      movePad,
      lookPad,
      buttonBar: buttonBar ?? undefined,
      input: session.input,
      settings: plan.controls,
      capabilities: plan.capabilities,
      eventKeys: plan.annotations.map((annotation) => annotation.key),
      onChange: session.nudge,
      onActivity: session.markActivity,
    })
  }, [movePad, lookPad, buttonBar, session, plan])

  return { bindMovePad: setMovePad, bindLookPad: setLookPad, bindButtonBar: setButtonBar }
}
