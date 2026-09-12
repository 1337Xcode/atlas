import { ArticleSchema, type Source } from '@atlas/schema'
import { ScenarioSchema } from './types'

export type ReaderPage =
  | { kind: 'story'; id: 'story'; label: string }
  | { kind: 'scan'; id: string; label: string; url: string; source: string }

export type Edition = {
  id: string
  title: string
  date: string
  headline: string
  dateline: string
  nature: string
  summary: string
  context: string
  contentNote: string | undefined
  image: { url: string; caption: string; credit: string }
  sources: Source[]
  pages: ReaderPage[]
}

const events = [
  ['apollo-11-first-steps', 'Apollo 11', 'apollo11'],
  ['berlin-wall-border-opens', 'Berlin Wall', 'berlin1989'],
  ['d-day-eve-greenham-common', 'D-Day eve', ''],
  ['march-on-washington-1963', 'March on Washington', ''],
  ['partition-of-india-midnight', 'Partition of India', ''],
  ['armistice-compiegne-1918', 'Armistice 1918', ''],
  ['san-francisco-1906-relief-camp', 'San Francisco 1906', ''],
  ['triangle-fire-mourning-march', 'Triangle fire memorial', ''],
  ['bandung-conference-1955', 'Bandung Conference', ''],
  ['windrush-arrival-tilbury', 'Windrush arrival', ''],
] as const

const articles = import.meta.glob<unknown>('../../../../content/articles/*.json', {
  eager: true,
  import: 'default',
})
const images = import.meta.glob<string>('../../../../content/images/**/*.{jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const scenarios = import.meta.glob<unknown>('../../public/events/*/scenario.json', {
  eager: true,
  import: 'default',
})

export const editions: Edition[] = events.map(([id, title, scenarioId]) => {
  const article = ArticleSchema.parse(articles[`../../../../content/articles/${id}.json`])
  const anchor = article.images.find((image) => image.role === 'anchor')
  const imageUrl = anchor && images[`../../../../content/images/${anchor.src}`]
  if (!anchor || !imageUrl || !anchor.credit)
    throw new Error(`Missing credited reference photograph for ${title}`)
  const pages: ReaderPage[] = [{ kind: 'story', id: 'story', label: 'The story' }]
  if (scenarioId) {
    const scenario = ScenarioSchema.parse(
      scenarios[`../../public/events/${scenarioId}/scenario.json`],
    )
    for (const [pageId, page] of Object.entries(scenario.pages)) {
      if (page.placeholder) continue
      pages.push({
        kind: 'scan',
        id: pageId,
        label: page.label,
        url: `/${page.src}`,
        source: page.source,
      })
    }
  }
  return {
    id,
    title,
    date: article.occurredOn ?? '',
    headline: article.headline,
    dateline: article.dateline,
    nature: article.nature,
    summary: article.summary,
    context: article.context,
    contentNote: article.contentNote,
    image: { url: imageUrl, caption: anchor.caption, credit: anchor.credit },
    sources: article.sources,
    pages,
  }
})

export function formatEditionDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}
