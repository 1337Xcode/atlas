import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { editions } from '../data/editions'
import { EditionList } from './EditionList'
import { EditionPage } from './EditionPage'
import { bindPageGestures, type PageDirection } from './page-gestures'

export function Reader() {
  const [editionIndex, setEditionIndex] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [direction, setDirection] = useState<PageDirection>(1)
  const [zoomed, setZoomed] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const edition = editions[editionIndex]
  const page = edition?.pages[pageIndex]
  const turn = useCallback(
    (delta: PageDirection) => {
      setDirection(delta)
      setPageIndex((current) =>
        Math.max(0, Math.min((edition?.pages.length ?? 1) - 1, current + delta)),
      )
    },
    [edition],
  )

  useEffect(() => {
    const element = surface.current
    if (!element || zoomed || menuOpen) return
    return bindPageGestures(element, turn)
  }, [turn, zoomed, menuOpen])

  useEffect(() => {
    surface.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    setZoomed(false)
  }, [editionIndex, pageIndex])

  useEffect(() => {
    if (menuOpen) document.querySelector<HTMLElement>('#edition-list [role="listbox"]')?.focus()
  }, [menuOpen])

  const closeMenu = () => {
    setMenuOpen(false)
    if (window.matchMedia('(min-width: 901px)').matches)
      surface.current?.focus({ preventScroll: true })
    else menuButton.current?.focus()
  }
  if (!edition || !page)
    return <p role="alert">This edition is unavailable. Reload to return to the collection.</p>

  return (
    <div className="reader-shell" data-menu-open={menuOpen}>
      <header className="reader-header">
        <a className="reader-brand" href="/" aria-label="Atlas home">
          ATLAS<span>History, in perspective.</span>
        </a>
        <span className="reader-header-note">The interactive history collection</span>
        <button
          ref={menuButton}
          type="button"
          className="reader-button reader-menu-button"
          aria-expanded={menuOpen}
          aria-controls="edition-list"
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          {menuOpen ? 'Back to paper' : 'Events'}
        </button>
      </header>
      <div className="reader-layout">
        <div
          className="reader-sidebar"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              closeMenu()
            }
          }}
        >
          <EditionList
            key={edition.id}
            editions={editions}
            currentId={edition.id}
            onOpen={(id) => {
              const next = editions.findIndex((item) => item.id === id)
              if (next < 0) return
              setDirection(next < editionIndex ? -1 : 1)
              setEditionIndex(next)
              setPageIndex(0)
              closeMenu()
            }}
          />
        </div>
        <main
          className="reader-main"
          aria-label="Newspaper reader"
          onKeyDown={(event) => {
            if (
              event.defaultPrevented ||
              (event.target instanceof HTMLElement &&
                event.target.closest('input,textarea,select,summary'))
            )
              return
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault()
              turn(event.key === 'ArrowRight' ? 1 : -1)
            }
          }}
        >
          <div className="reader-toolbar">
            <div className="reader-edition-title">
              <span className="eyebrow">Now reading</span>
              <h2>{edition.title}</h2>
            </div>
            <div className="reader-page-actions">
              <button
                type="button"
                className="reader-button"
                aria-pressed={zoomed}
                onClick={() => setZoomed((value) => !value)}
              >
                {zoomed ? 'Fit width' : 'Enlarge'}
              </button>
              <span className="reader-divider" />
              <button
                type="button"
                className="reader-button arrow-button"
                aria-label="Previous page"
                disabled={pageIndex === 0}
                onClick={() => turn(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className="reader-button arrow-button"
                aria-label="Next page"
                disabled={pageIndex === edition.pages.length - 1}
                onClick={() => turn(1)}
              >
                →
              </button>
            </div>
          </div>
          <div
            className="reader-surface"
            ref={surface}
            tabIndex={0}
            aria-label="Page. Swipe left or right to turn; scroll to read."
            data-zoomed={zoomed}
          >
            <div className="reader-paper-stage">
              <AnimatePresence initial={false} mode="wait" custom={direction}>
                <motion.div
                  key={`${edition.id}/${page.id}`}
                  className="reader-page-motion"
                  custom={direction}
                  variants={{
                    enter: (dir: number) => ({ opacity: 0, x: reducedMotion ? 0 : dir * 24 }),
                    exit: (dir: number) => ({ opacity: 0, x: reducedMotion ? 0 : -dir * 24 }),
                  }}
                  initial="enter"
                  animate={{ opacity: 1, x: 0 }}
                  exit="exit"
                  transition={{ duration: reducedMotion ? 0 : 0.14, ease: 'easeOut' }}
                >
                  <EditionPage edition={edition} page={page} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <footer className="reader-pagination">
            <span aria-live="polite">
              {page.label}
              <span className="page-count">
                {pageIndex + 1} / {edition.pages.length}
              </span>
            </span>
            <div aria-label="Pages" className="page-dots">
              {edition.pages.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={`Page ${index + 1}: ${item.label}`}
                  aria-current={index === pageIndex ? 'page' : undefined}
                  onClick={() => {
                    setDirection(index < pageIndex ? -1 : 1)
                    setPageIndex(index)
                  }}
                >
                  <span />
                </button>
              ))}
            </div>
            <span className="reader-swipe-hint">Swipe sideways to turn</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
