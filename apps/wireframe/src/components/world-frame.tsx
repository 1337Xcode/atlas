'use client'

import { useWorldControls, useWorldSession, useWorldViewport } from '@atlas/runtime/react'
import { WorldSessionPlanSchema, type WorldSessionPlan } from '@atlas/schema'
import { useState } from 'react'

// note: wireframe only — the production newspaper replaces this, the hooks are the contract

export type WorldFrameProps = {
  articleId: string
  anchorImageUrl: string
  anchorCaption: string
}

export function WorldFrame({ articleId, anchorImageUrl, anchorCaption }: WorldFrameProps) {
  const [plan, setPlan] = useState<WorldSessionPlan>()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string>()

  const { session, snapshot } = useWorldSession(plan, { autoStart: true })
  const bindVideo = useWorldViewport(session)
  const bindSurface = useWorldControls(session, plan)

  const open = async () => {
    setOpening(true)
    setError(undefined)
    const response = await fetch(`/api/worlds/${articleId}`, { method: 'POST' })
    const body: unknown = await response.json()
    setOpening(false)

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
  }

  if (!plan) {
    return (
      <figure className="world">
        <img src={anchorImageUrl} alt={anchorCaption} />
        <figcaption>{anchorCaption}</figcaption>
        <button type="button" onClick={() => void open()} disabled={opening}>
          {opening ? 'opening the world...' : 'enter the world'}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </figure>
    )
  }

  return (
    <section className="world">
      <div className="viewport" ref={bindSurface} tabIndex={0}>
        <video ref={bindVideo} muted playsInline autoPlay />
        <p className="hud">
          {snapshot?.phase ?? 'idle'} · chunk {snapshot?.chunkIndex ?? 0} ·{' '}
          {snapshot?.stats?.framesPerSecond ?? '--'} fps · {snapshot?.stats?.rtt ?? '--'} ms rtt
        </p>
      </div>

      <p className="legend">
        click to look · <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> walk · <kbd>arrows</kbd> look · <kbd>space</kbd> jump · <kbd>c</kbd> crouch ·{' '}
        <kbd>esc</kbd> release the mouse
      </p>

      <dl className="annotations">
        {plan.annotations.map((annotation) => (
          <div key={annotation.key}>
            <dt>
              <kbd>{annotation.key}</kbd> {annotation.name}
            </dt>
            <dd>
              attested by {annotation.source.title}
              {annotation.source.publisher ? ` (${annotation.source.publisher})` : ''}
            </dd>
          </div>
        ))}
      </dl>

      <div className="actions">
        <button type="button" onClick={() => void session?.restage()}>
          restage from a clean frame
        </button>
        <button
          type="button"
          onClick={() => {
            void session?.stop()
            setPlan(undefined)
          }}
        >
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

function readError(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) return String(body.error)
  return 'could not open the world'
}
