'use client'

import {
  useCoarsePointer,
  useWorldControls,
  useWorldSession,
  useWorldTouchControls,
  useWorldViewport,
} from '@atlas/runtime/react'
import { WorldSessionPlanSchema, type WorldSessionPlan } from '@atlas/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
// note: extensionless, because turbopack does not resolve an explicit .tsx specifier
import { WorldPads } from './world-pads'
import { WorldStatus } from './world-status'

// note: wireframe only, the production newspaper replaces this; the hooks are the contract

export type WorldFrameProps = {
  articleId: string
  anchorImageUrl: string
  anchorCaption: string
}

export function WorldFrame({ articleId, anchorImageUrl, anchorCaption }: WorldFrameProps) {
  const [plan, setPlan] = useState<WorldSessionPlan>()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string>()
  const [expanded, setExpanded] = useState(false)
  const shell = useRef<HTMLDivElement>(null)

  const { session, snapshot } = useWorldSession(plan, { autoStart: true })
  const bindVideo = useWorldViewport(session)
  const bindSurface = useWorldControls(session, plan)
  const touch = useCoarsePointer()
  const pads = useWorldTouchControls(session, plan)

  // fn: fetch a fresh plan, which mints the token and therefore starts the clock
  const open = useCallback(async () => {
    setOpening(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/worlds/${articleId}`, { method: 'POST' })
      const body: unknown = await response.json()
      if (!response.ok) {
        setError(readError(body))
        return
      }
      const parsed = WorldSessionPlanSchema.safeParse((body as { plan: unknown }).plan)
      if (!parsed.success) {
        setError('the world plan did not match the contract')
        return
      }
      setPlan(parsed.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'could not reach the world service')
    } finally {
      setOpening(false)
    }
  }, [articleId])

  const leave = useCallback(() => {
    void session?.stop('user')
    setPlan(undefined)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [session])

  // feat: expand puts the reader inside the world with nothing else on screen
  // why: ios safari refuses fullscreen on a div, so the css fallback covers it
  const toggleExpand = useCallback(() => {
    const element = shell.current
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
      setExpanded(false)
      return
    }
    if (element && typeof element.requestFullscreen === 'function') {
      void element
        .requestFullscreen()
        .then(() => setExpanded(true))
        .catch(() => setExpanded(true))
      return
    }
    setExpanded(true)
  }, [])

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // note: a closed world leaves fullscreen, so the reader is never stuck in a black rectangle
  useEffect(() => {
    if (snapshot?.phase !== 'closed') return
    setExpanded(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }, [snapshot?.phase])

  if (!plan) {
    return (
      <figure className="world">
        <img src={anchorImageUrl} alt={anchorCaption} />
        <figcaption>{anchorCaption}</figcaption>
        <div className="actions">
          <button type="button" onClick={() => void open()} disabled={opening}>
            {opening ? 'opening the world' : 'enter the world'}
          </button>
        </div>
        <p className="legend">
          The world runs for up to two minutes, and closes itself if you stop moving.
        </p>
        {error ? <p className="error">{error}</p> : null}
      </figure>
    )
  }

  const closed = snapshot?.phase === 'closed'

  return (
    <section className="world" ref={shell} data-expanded={expanded}>
      <div className="viewport" ref={bindSurface} tabIndex={0}>
        <video ref={bindVideo} muted playsInline autoPlay poster={plan.anchorImage.url} />
        <WorldStatus
          phase={snapshot?.phase ?? 'idle'}
          chunkIndex={snapshot?.chunkIndex ?? 0}
          fps={snapshot?.stats?.framesPerSecond}
          rtt={snapshot?.stats?.rtt}
        />

        {snapshot?.countdown ? (
          <p className="countdown">
            {snapshot.countdown.kind === 'idle'
              ? `Still there? Closing in ${snapshot.countdown.secondsLeft}s to save credits. Move to stay.`
              : `Two minute limit reached, closing in ${snapshot.countdown.secondsLeft}s.`}
          </p>
        ) : null}

        {touch && !closed ? (
          <WorldPads
            plan={plan}
            bindMovePad={pads.bindMovePad}
            bindLookPad={pads.bindLookPad}
            bindButtonBar={pads.bindButtonBar}
          />
        ) : null}

        {snapshot?.audioBlocked ? (
          <button type="button" className="sound-blocked" onClick={() => session?.resumeSound()}>
            turn on the archive sound
          </button>
        ) : null}

        {closed ? (
          <div className="closed">
            <p>{endedMessage(snapshot?.endedReason)}</p>
            <button type="button" onClick={() => void open()}>
              open it again
            </button>
          </div>
        ) : null}
      </div>

      <p className="legend">
        {touch
          ? 'drag the left pad to walk, the right pad to look, and hold an event button to see what a source attests.'
          : null}
      </p>

      <p className="legend" hidden={touch}>
        click the frame, then <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> to walk, move the mouse to look around, <kbd>space</kbd> to hop, <kbd>C</kbd>{' '}
        to crouch, <kbd>esc</kbd> to release the mouse. The arrow keys also look around if you would
        rather not use the mouse.
      </p>

      {plan.soundscape.bed ? (
        <p className="legend">
          sound: {plan.soundscape.bed.caption} ({plan.soundscape.bed.kind},{' '}
          {plan.soundscape.bed.credit})
        </p>
      ) : null}

      <dl className="annotations">
        {plan.annotations.map((annotation) => (
          <div key={annotation.key}>
            <dt>
              <kbd>{annotation.key}</kbd> {annotation.name}
              {snapshot?.heldEventKeys.includes(annotation.key) ? ' (holding)' : ''}
            </dt>
            <dd>
              attested by {annotation.source.title}
              {annotation.source.publisher ? ` (${annotation.source.publisher})` : ''}
            </dd>
          </div>
        ))}
      </dl>

      <div className="actions">
        <button type="button" onClick={toggleExpand}>
          {expanded ? 'shrink' : 'expand'}
        </button>
        <button type="button" onClick={() => void session?.restage()} disabled={closed}>
          restage
        </button>
        <button type="button" onClick={leave}>
          leave
        </button>
      </div>

      {snapshot?.error ? <p className="error">{snapshot.error}</p> : null}
      {snapshot?.notices.length ? (
        <ul className="notices">
          {snapshot.notices.map((notice, index) => (
            <li key={`${index}-${notice}`}>{notice}</li>
          ))}
        </ul>
      ) : null}

      <details>
        <summary>prompt the model is being given</summary>
        <p className="prompt">{snapshot?.prompt}</p>
      </details>
    </section>
  )
}

function endedMessage(reason: string | undefined): string {
  if (reason === 'idle') return 'The world closed because nothing was pressed for a minute.'
  if (reason === 'limit') return 'The world reached its two minute limit and closed.'
  if (reason === 'hidden') return 'The world closed because this tab was left in the background.'
  if (reason === 'failed') return 'The world did not start generating, so it was closed.'
  return 'The world is closed.'
}

function readError(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) return String(body.error)
  return 'could not open the world'
}
