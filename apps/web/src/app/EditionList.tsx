import { useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { type Edition, formatEditionDate } from '../data/editions'
import OptionWheel from '../ui/OptionWheel'

export function EditionList({
  editions,
  currentId,
  onOpen,
}: {
  editions: Edition[]
  currentId: string
  onOpen: (id: string) => void
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      editions.findIndex((edition) => edition.id === currentId),
    ),
  )
  const reducedMotion = useReducedMotion()
  const labels = useMemo(() => editions.map((edition) => edition.title), [editions])
  const selected = editions[index]
  if (!selected) return null
  return (
    <aside className="edition-list" aria-label="Choose a historical event" id="edition-list">
      <header className="edition-list-heading">
        <span className="eyebrow">The collection</span>
        <h2>
          History, <br />
          one page at a time.
        </h2>
        <p>Ten events. The records behind them.</p>
      </header>
      <div
        className="edition-wheel"
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onOpen(selected.id)
        }}
      >
        <OptionWheel
          items={labels}
          defaultSelected={index}
          onChange={setIndex}
          fontSize={1.1}
          spacing={2.4}
          inset={20}
          tilt={3}
          curve={0.18}
          blur={0}
          fade={0.12}
          minOpacity={0.22}
          smoothing={reducedMotion ? 1 : 110}
          soundUrl=""
          className="edition-wheel-control"
        />
      </div>
      <footer className="edition-list-footer">
        <span className="eyebrow">
          {String(index + 1).padStart(2, '0')} / {String(editions.length).padStart(2, '0')}
        </span>
        <p>{formatEditionDate(selected.date)}</p>
        <button
          className="reader-button edition-open"
          onClick={() => onOpen(selected.id)}
          type="button"
        >
          Read this edition <span aria-hidden="true">↗</span>
        </button>
        <span className="quiet">Scroll, drag, or use ↑ ↓. Enter opens.</span>
      </footer>
    </aside>
  )
}
