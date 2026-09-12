import { describe, expect, it } from 'vitest'
import { editions, formatEditionDate } from './editions'

describe('reader editions', () => {
  it('offers the ten real events instead of unharvested placeholders', () => {
    expect(editions).toHaveLength(10)
    expect(new Set(editions.map((edition) => edition.id)).size).toBe(10)
    expect(editions[0]?.id).toBe('apollo-11-first-steps')
  })

  it('keeps the sourced summary, image credit, and nature on every edition', () => {
    for (const edition of editions) {
      expect(edition.headline).toBeTruthy()
      expect(edition.nature).toBeTruthy()
      expect(edition.summary).toBeTruthy()
      expect(edition.image.url).toBeTruthy()
      expect(edition.image.credit).toBeTruthy()
      expect(edition.sources.length).toBeGreaterThan(0)
    }
  })

  // why: a scan with no attribution cannot be published, so an unsourced one must not exist
  it('attributes every archival scan it offers', () => {
    for (const edition of editions) {
      for (const scan of edition.scans) {
        expect(scan.source).toBeTruthy()
        expect(scan.label).toBeTruthy()
        expect(scan.url.startsWith('/scans/')).toBe(true)
      }
    }
  })

  it('carries the scans it holds and no placeholders', () => {
    expect(editions[0]?.scans).toHaveLength(3)
    expect(editions[1]?.scans).toHaveLength(2)
    expect(editions.slice(2).every((edition) => edition.scans.length === 0)).toBe(true)
  })

  it('writes the date the way the masthead reads it', () => {
    expect(formatEditionDate('1969-07-20')).toBe('20 July 1969')
  })
})
