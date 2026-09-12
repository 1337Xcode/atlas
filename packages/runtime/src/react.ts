import type { WorldSessionPlan } from '@atlas/schema'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { bindControls } from './controls.ts'
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
    if (autoStart) void created.start()
    return () => {
      setSession(undefined)
      void created.stop()
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
    })
  }, [surface, session, plan])

  return setSurface
}
