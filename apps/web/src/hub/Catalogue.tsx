import { localPaths } from '../data/paths'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

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

/** The catalogue lists curated events beside clusters that are not yet harvested. Only clusters with an event open. Escape returns here from any phase. */
export function Catalogue({
  visible,
  onOpen,
}: {
  visible: boolean
  onOpen: (eventId: string) => void
}) {
  const [data, setData] = useState<CatalogueData>({ countries: [], decades: [], clusters: [] })
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState<string | null>(null)
  const [decade, setDecade] = useState<string | null>(null)
  useEffect(() => {
    void fetch('/catalogue.json')
      .then((r) => r.json())
      .then(setData)
  }, [])
  const q = query.trim().toLowerCase()
  const clusters = useMemo(
    () =>
      data.clusters.filter(
        (k) =>
          (!country || k.country === country) &&
          (!decade || k.date.slice(0, 3) + '0s' === decade) &&
          (!q || k.label.toLowerCase().includes(q) || k.date.includes(q)),
      ),
    [data, country, decade, q],
  )
  const chip = (label: string, on: boolean, click: () => void) => (
    <button
      key={label}
      onClick={click}
      className="ui"
      style={{
        background: 'none',
        border: 0,
        borderBottom: '1px solid ' + (on ? 'rgba(235,230,220,0.7)' : 'transparent'),
        padding: '4px 0',
        cursor: 'pointer',
        opacity: on ? 1 : 0.5,
      }}
    >
      {label}
    </button>
  )
  return (
    <motion.section
      aria-label="Catalogue"
      className="ui fixed inset-0 flex flex-col justify-center gap-10 bg-black px-12"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.9 }}
      style={{ pointerEvents: visible ? 'auto' : 'none', zIndex: 20 }}
    >
      <div className="flex flex-wrap items-end gap-10">
        <input
          aria-label="Search the catalogue"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="ui"
          style={{
            width: 220,
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid rgba(235,230,220,0.25)',
            padding: '6px 0',
            outline: 'none',
          }}
        />
        <div role="group" aria-label="Country" className="flex gap-4">
          {data.countries.map((c) =>
            chip(c, country === c, () => setCountry(country === c ? null : c)),
          )}
        </div>
        <div role="group" aria-label="Decade" className="flex gap-4">
          {data.decades.map((d) => chip(d, decade === d, () => setDecade(decade === d ? null : d)))}
        </div>
        <span className="ml-auto" style={{ opacity: 0.35 }}>
          Select a page. Space pauses, p shows provenance, escape returns.
        </span>
      </div>
      <div className="flex gap-11 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {clusters.map((k) => (
          <button
            key={k.id}
            onClick={() => k.event && onOpen(k.event)}
            className="flex flex-col gap-3.5 text-left"
            style={{
              background: 'none',
              border: 0,
              flex: '0 0 auto',
              width: 236,
              cursor: k.event ? 'pointer' : 'default',
              opacity: k.event ? 1 : 0.45,
            }}
          >
            <div
              style={{
                width: 236,
                height: 'min(316px, 48vh)',
                background: '#141312',
                overflow: 'hidden',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              {k.thumb && (
                <img
                  src={localPaths.asset(k.thumb)}
                  alt=""
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                    filter: 'grayscale(1) contrast(1.05)',
                  }}
                />
              )}
            </div>
            <span style={{ lineHeight: 1.5, opacity: 0.85 }}>{k.label}</span>
            <span style={{ opacity: 0.45, marginTop: -8 }}>
              {k.event ? k.date : k.date + '  ·  ' + k.pageCount + ' pages, not yet harvested'}
            </span>
          </button>
        ))}
      </div>
    </motion.section>
  )
}
