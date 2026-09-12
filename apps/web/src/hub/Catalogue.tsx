import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { localPaths } from '../data/paths'
import OptionWheel from '../ui/OptionWheel'

export interface CatalogueCluster {
  id: string
  date: string
  label: string
  country: string
  thumb?: string
  pages?: string[]
  pageCount?: number
  event?: string
}

export interface CatalogueData {
  countries: string[]
  decades: string[]
  clusters: CatalogueCluster[]
}

// note: the catalogue lists curated events beside clusters that are not yet harvested
// why: settling the wheel only highlights an event; opening one is a separate, deliberate click
export function Catalogue({
  visible,
  open,
  onOpen,
  onClose,
}: {
  visible: boolean
  open: boolean
  onOpen: (eventId: string) => void
  onClose: () => void
}) {
  const [data, setData] = useState<CatalogueData>({ countries: [], decades: [], clusters: [] })
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    // note: a catalogue that cannot be read leaves the list empty rather than failing the page
    fetch(localPaths.catalogue())
      .then((response) => response.json() as Promise<CatalogueData>)
      .then(setData, () => undefined)
  }, [])

  const needle = query.trim().toLowerCase()
  const clusters = useMemo(
    () =>
      data.clusters.filter(
        (cluster) =>
          needle === '' ||
          cluster.label.toLowerCase().includes(needle) ||
          cluster.date.includes(needle),
      ),
    [data.clusters, needle],
  )

  // note: the readable ones first, so the wheel opens on something the reader can actually enter
  const ordered = useMemo(
    () => [...clusters].sort((a, b) => Number(Boolean(b.event)) - Number(Boolean(a.event))),
    [clusters],
  )

  const labels = useMemo(() => ordered.map((cluster) => cluster.label), [ordered])
  const selected = ordered[Math.min(index, Math.max(ordered.length - 1, 0))]
  const readable = Boolean(selected?.event)

  return (
    <motion.aside
      aria-label="Catalogue"
      className="ui fixed bottom-0 left-0 top-0 z-20 flex w-[min(86vw,24rem)] flex-col gap-6 px-7 py-8 lg:w-[26rem]"
      initial={false}
      animate={{ x: open ? 0 : '-101%', opacity: visible ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.9 }}
      style={{
        pointerEvents: visible && open ? 'auto' : 'none',
        // why: a scrim rather than a panel, so the front pages stay part of the picture
        background:
          'linear-gradient(90deg, rgba(6,6,7,0.96) 0%, rgba(6,6,7,0.9) 62%, rgba(6,6,7,0) 100%)',
      }}
    >
      <header className="flex flex-col gap-2">
        <h1
          className="leading-none"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(1.6rem, 1.2rem + 1.4vw, 2.3rem)',
            letterSpacing: '0.02em',
            color: 'rgba(240,236,226,0.94)',
          }}
        >
          The Atlas
        </h1>
        <p style={{ opacity: 0.5, lineHeight: 1.5 }}>
          Front pages you can walk into. Every world is built from the page beside it.
        </p>
        <div
          aria-hidden
          style={{ height: 1, background: 'rgba(235,230,220,0.18)', marginTop: '0.35rem' }}
        />
      </header>

      <input
        aria-label="Search the catalogue"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIndex(0)
        }}
        placeholder="Search by headline or date"
        className="ui"
        style={{
          background: 'transparent',
          border: 0,
          borderBottom: '1px solid rgba(235,230,220,0.22)',
          padding: '6px 0',
          outline: 'none',
        }}
      />

      <div className="min-h-0 flex-1">
        {labels.length > 0 && (
          <OptionWheel
            items={labels}
            defaultSelected={0}
            onChange={(next) => setIndex(next)}
            side="left"
            fontSize={1.15}
            spacing={1.55}
            curve={1}
            tilt={7}
            blur={1.2}
            fade={0.22}
            minOpacity={0.08}
            smoothing={170}
            inset={4}
            loop={false}
            draggable
            soundUrl="/sounds/tick.wav"
            soundVolume={0.28}
            textColor="#8d8a84"
            activeColor="#f3efe6"
          />
        )}
        {labels.length === 0 && <p style={{ opacity: 0.45 }}>Nothing matches that search.</p>}
      </div>

      <footer className="flex flex-col gap-3">
        <p style={{ opacity: 0.55 }}>
          {selected ? `${selected.date}  ·  ${selected.country}` : '—'}
          {selected && !readable
            ? `  ·  ${String(selected.pageCount ?? 0)} pages, not yet harvested`
            : ''}
        </p>
        <button
          type="button"
          disabled={!readable}
          onClick={() => {
            if (selected?.event) onOpen(selected.event)
          }}
          className="ui text-left"
          style={{
            background: 'none',
            border: '1px solid rgba(235,230,220,0.28)',
            padding: '0.7rem 1rem',
            cursor: readable ? 'pointer' : 'default',
            opacity: readable ? 1 : 0.35,
            color: 'inherit',
          }}
        >
          {readable ? 'Read this front page' : 'Not yet harvested'}
        </button>
        <p style={{ opacity: 0.32, lineHeight: 1.6 }}>
          Scroll or drag the list. Space pauses, P shows provenance, Escape returns here.
        </p>
      </footer>

      <button
        type="button"
        aria-label="Close the catalogue"
        onClick={onClose}
        className="ui absolute right-3 top-3 lg:hidden"
        style={{ background: 'none', border: 0, color: 'inherit', opacity: 0.6, padding: '0.5rem' }}
      >
        close
      </button>
    </motion.aside>
  )
}
