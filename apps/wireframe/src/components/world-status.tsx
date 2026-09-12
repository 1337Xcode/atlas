'use client'

import type { SessionPhase } from '@atlas/runtime'

// perf: its own component, so the four-times-a-second status line does not re-render the article
export type WorldStatusProps = {
  phase: SessionPhase
  chunkIndex: number
  fps: number | undefined
  rtt: number | undefined
}

const PHASE_LABEL: Record<SessionPhase, string> = {
  idle: 'idle',
  connecting: 'connecting to a gpu',
  staging: 'sending the photograph and the prompt',
  warming: 'the world is materialising, controls unlock shortly',
  live: 'live',
  error: 'failed',
  closed: 'closed',
}

export function WorldStatus({ phase, chunkIndex, fps, rtt }: WorldStatusProps) {
  return (
    <p className="hud">
      {PHASE_LABEL[phase]}
      {phase === 'live' ? ` · chunk ${chunkIndex} · ${fps ?? '--'} fps · ${rtt ?? '--'} ms` : null}
    </p>
  )
}
