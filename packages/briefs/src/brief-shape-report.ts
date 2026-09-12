import type { EventBrief } from './event-brief.ts'
import { countWords } from './extracted-article.ts'

/**
 * Length targets from brief-composition-rules.ts. Smaller models undershoot them quietly, and
 * a thin narrative is the kind of thing a reviewer only notices after building the world, so
 * the counts are printed on every run.
 */
const WORD_TARGETS = [
  { section: 'summary', minimum: 80, maximum: 110 },
  { section: 'fullArticle', minimum: 500, maximum: 800 },
  { section: 'narrative', minimum: 200, maximum: 350 },
] as const

export type SectionLength = {
  readonly section: string
  readonly words: number
  readonly withinTarget: boolean
  readonly target: string
}

export function measureBriefSections(brief: EventBrief): SectionLength[] {
  return WORD_TARGETS.map((target) => {
    const words = countWords(brief[target.section])
    return {
      section: target.section,
      words,
      withinTarget: words >= target.minimum && words <= target.maximum,
      target: `${target.minimum}-${target.maximum}`,
    }
  })
}

export function describeSectionsOutsideTarget(brief: EventBrief): string {
  const offenders = measureBriefSections(brief).filter((section) => !section.withinTarget)
  if (offenders.length === 0) {
    return ''
  }
  const detail = offenders
    .map((section) => `${section.section} ${section.words}w (want ${section.target})`)
    .join(', ')
  return `Sections outside their length target: ${detail}`
}
