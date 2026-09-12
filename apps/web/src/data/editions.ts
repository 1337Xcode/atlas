import { ArticleSchema, type Source } from '@atlas/schema'

export type ReaderScan = {
  id: string
  label: string
  url: string
  source: string
}

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
  // note: original pages, shown under the story; most events have none yet
  scans: ReaderScan[]
}

// note: the reading order, which is also the order of the list in the margin
const events = [
  ['apollo-11-first-steps', 'Apollo 11'],
  ['berlin-wall-border-opens', 'Berlin Wall'],
  ['d-day-eve-greenham-common', 'D-Day eve'],
  ['march-on-washington-1963', 'March on Washington'],
  ['partition-of-india-midnight', 'Partition of India'],
  ['armistice-compiegne-1918', 'Armistice 1918'],
  ['san-francisco-1906-relief-camp', 'San Francisco 1906'],
  ['triangle-fire-mourning-march', 'Triangle fire memorial'],
  ['bandung-conference-1955', 'Bandung Conference'],
  ['windrush-arrival-tilbury', 'Windrush arrival'],
] as const

// note: only pages we hold a real, attributed scan of; nothing here is a placeholder
const scans: Record<string, ReaderScan[]> = {
  'apollo-11-first-steps': [
    {
      id: 'canberra-times',
      label: 'The Canberra Times, 22 July 1969',
      url: '/scans/apollo-11-canberra-times.jpg',
      source: 'Trove, National Library of Australia',
    },
    {
      id: 'washington-post',
      label: 'The Washington Post, page A1, 21 July 1969',
      url: '/scans/apollo-11-washington-post.jpg',
      source: 'Internet Archive, ProQuest scan',
    },
    {
      id: 'safire-memo',
      label: 'The Safire contingency memo, 18 July 1969',
      url: '/scans/apollo-11-safire-memo.jpg',
      source: 'US National Archives, rn100-6-1-2',
    },
  ],
  'berlin-wall-border-opens': [
    {
      id: 'neues-deutschland-10',
      label: 'Neues Deutschland, 10 November 1989',
      url: '/scans/berlin-neues-deutschland-10-nov.jpg',
      source: 'ZEFYS, Staatsbibliothek zu Berlin',
    },
    {
      id: 'neues-deutschland-11',
      label: 'Neues Deutschland, 11 November 1989',
      url: '/scans/berlin-neues-deutschland-11-nov.jpg',
      source: 'ZEFYS, Staatsbibliothek zu Berlin',
    },
  ],
}

// why: the archive is the single source of truth, so the reader is built from it at bundle time
const articles = import.meta.glob<unknown>('../../../../content/articles/*.json', {
  eager: true,
  import: 'default',
})
const images = import.meta.glob<string>('../../../../content/images/**/*.{jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const editions: Edition[] = events.map(([id, title]) => {
  const article = ArticleSchema.parse(articles[`../../../../content/articles/${id}.json`])
  const anchor = article.images.find((image) => image.role === 'anchor')
  const imageUrl = anchor && images[`../../../../content/images/${anchor.src}`]
  if (!anchor || !imageUrl || !anchor.credit)
    throw new Error(`Missing credited reference photograph for ${title}`)
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
    scans: scans[id] ?? [],
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
