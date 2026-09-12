import { describe, expect, it } from 'vitest'
import { editions } from './editions'

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
      expect(edition.pages[0]?.kind).toBe('story')
    }
  })

  it('does not offer placeholder scans or grey ghost images', () => {
    const apollo = editions[0]
    expect(apollo?.pages.map((page) => page.id)).toEqual(['story', 'A01', 'A02', 'A05'])
    expect(editions[1]?.pages.map((page) => page.id)).toEqual(['story', 'B01', 'B02'])
    expect(editions.every((edition) => !edition.image.url.includes('g01.png'))).toBe(true)
  })
})
