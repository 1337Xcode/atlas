import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useCoarsePointer,
  useWorldControls,
  useWorldTouchControls,
  useWorldViewport,
} from '@atlas/runtime/react'
import type { Experience } from './experience'
import { GradualBlur } from '../components/ui/gradual-blur'

// feat: loading and live playback share one viewport over the newspaper page
export function WorldOverlay({
  experience,
  onExit,
}: {
  experience: Experience
  onExit: () => void
}) {
  const { edition, session, plan, snapshot } = experience
  const live = snapshot?.phase === 'live'
  const error = experience.error ?? snapshot?.error
  const bindVideo = useWorldViewport(session)
  const bindControls = useWorldControls(live ? session : undefined, plan)
  const pads = useWorldTouchControls(live ? session : undefined, plan)
  const touch = useCoarsePointer()
  const surface = useRef<HTMLDivElement>(null)
  const sawFullscreen = useRef(Boolean(document.fullscreenElement))
  const [armed, setArmed] = useState(false)
  const [factIndex, setFactIndex] = useState(0)
  const facts = useMemo(
    () =>
      [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(edition.summary)].map(
        (part) => part.segment.trim(),
      ),
    [edition.summary],
  )
  const attachSurface = useCallback(
    (element: HTMLDivElement | null) => {
      surface.current = element
      bindControls(element)
    },
    [bindControls],
  )

  // why: the keyboard has to be armed the moment the world opens, not after a hunt for focus
  useEffect(() => {
    const element = surface.current
    if (!element) return
    element.focus({ preventScroll: true })
    // note: an unfocused browser window defers the focus event, so the state is read back
    setArmed(document.activeElement === element)
  }, [live])
  useEffect(() => {
    if (live || error || facts.length < 2) return
    const timer = setInterval(() => setFactIndex((index) => (index + 1) % facts.length), 6_000)
    return () => clearInterval(timer)
  }, [live, error, facts])
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onExit()
      }
      if (event.key === 'Tab') {
        const dialog = surface.current?.parentElement
        const targets = [
          ...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []),
        ]
        const next = event.shiftKey ? targets.at(-1) : targets[0]
        const edge = event.shiftKey ? targets[0] : targets.at(-1)
        if (document.activeElement === edge) {
          event.preventDefault()
          next?.focus()
        }
      }
    }
    const fullscreen = () => {
      if (document.fullscreenElement) sawFullscreen.current = true
      else if (sawFullscreen.current) onExit()
    }
    const visibility = () => {
      if (document.hidden) onExit()
    }
    window.addEventListener('keydown', keyboard, true)
    document.addEventListener('fullscreenchange', fullscreen)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', keyboard, true)
      document.removeEventListener('fullscreenchange', fullscreen)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [onExit])

  return (
    <section
      className="world-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${edition.title} world`}
    >
      <div
        className="world-surface"
        ref={attachSurface}
        tabIndex={0}
        aria-label="World controls"
        data-live={live}
        onFocus={() => setArmed(true)}
        onBlur={() => setArmed(false)}
        onPointerDown={() => setArmed(true)}
      >
        <video ref={bindVideo} autoPlay muted playsInline poster={edition.image.url} />
        {!live && (
          <div className="world-loading">
            <img src={edition.image.url} alt="" />
            <div className="world-loading-copy">
              <p className="eyebrow">{edition.dateline}</p>
              <h2>{edition.title}</h2>
              {error ? (
                <p role="alert">{error}</p>
              ) : (
                <>
                  <p>{facts[factIndex]}</p>
                  <span className="world-preparing" role="status">
                    <span className="world-spinner" />
                    Preparing the world
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        {/* why: silent controls read as broken controls, so an unfocused world says so */}
        {live && !armed && !touch && (
          <p className="world-take-controls">Click the world to take the controls</p>
        )}
        <GradualBlur position="bottom" height="4rem" strength={0.8} divCount={3} curve="bezier" />
        {live && touch && (
          <div className="world-touch-pads" data-world-ui>
            <div ref={pads.bindMovePad} className="world-touch-pad">
              Move
            </div>
            <div ref={pads.bindLookPad} className="world-touch-pad">
              Look
            </div>
          </div>
        )}
      </div>
      <header className="world-overlay-header">
        <span>{edition.title}</span>
        <button type="button" className="world-exit" onClick={onExit}>
          Exit <kbd>Esc</kbd>
        </button>
      </header>
      <footer className="world-overlay-footer">
        {live && (
          <span>
            {touch
              ? 'Left pad moves. Right pad looks.'
              : 'WASD to move · mouse, trackpad or arrows to look · space to jump'}
          </span>
        )}
        {snapshot?.countdown && (
          <span role="status">
            {snapshot.countdown.kind === 'idle'
              ? 'No input detected. Closing'
              : 'Two-minute limit. Closing'}{' '}
            in {snapshot.countdown.secondsLeft}s.
          </span>
        )}
        {live && plan && plan.annotations.length > 0 && (
          <div className="world-details" aria-label="Historical details">
            {plan.annotations.map((annotation) => (
              <span key={annotation.key} title={annotation.source.title}>
                <kbd>{annotation.key}</kbd> {annotation.name}
              </span>
            ))}
          </div>
        )}
      </footer>
    </section>
  )
}
