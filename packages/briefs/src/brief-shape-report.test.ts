import { expect, it } from 'vitest'

import { describeSectionsOutsideTarget, measureBriefSections } from './brief-shape-report.ts'
import type { EventBrief } from './event-brief.ts'

function buildBriefWithLengths(lengths: {
  summary: number
  fullArticle: number
  narrative: number
}): EventBrief {
  const words = (count: number): string => Array.from({ length: count }, () => 'word').join(' ')
  const partial = {
    summary: words(lengths.summary),
    fullArticle: words(lengths.fullArticle),
    narrative: words(lengths.narrative),
  }
  // Only the three measured sections matter here; the report reads nothing else.
  return partial as unknown as EventBrief
}

it('reports nothing when all three sections sit inside their targets', () => {
  const brief = buildBriefWithLengths({ summary: 95, fullArticle: 640, narrative: 275 })
  expect(describeSectionsOutsideTarget(brief)).toBe('')
})

it('names each section that missed its target and by how much', () => {
  const brief = buildBriefWithLengths({ summary: 95, fullArticle: 461, narrative: 181 })
  const report = describeSectionsOutsideTarget(brief)

  expect(report).toMatch(/fullArticle 461w \(want 500-800\)/)
  expect(report).toMatch(/narrative 181w \(want 200-350\)/)
  expect(report).not.toMatch(/summary/)
})

it('treats an overlong section as out of target too', () => {
  const brief = buildBriefWithLengths({ summary: 400, fullArticle: 640, narrative: 275 })
  const measured = measureBriefSections(brief)

  expect(measured.map((section) => section.withinTarget)).toEqual([false, true, true])
})
