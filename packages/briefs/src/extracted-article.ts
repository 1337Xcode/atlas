/**
 * What both input paths reduce to before any composition happens. A photo of newsprint
 * and a live news page differ in how much they can tell us, so unknown fields carry the
 * empty string and `readConfidence` says how much to trust the rest.
 */
export type ExtractedArticle = {
  readonly headline: string
  readonly outlet: string
  readonly publishedDateText: string
  readonly byline: string
  readonly bodyText: string
  readonly readConfidence: 'high' | 'medium' | 'low'
  /** Columns the reader could not make out, so a human knows what is missing. */
  readonly unreadablePassages: readonly string[]
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g)
  return matches === null ? 0 : matches.length
}

export function buildExcerpt(text: string, maxCharacters = 400): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxCharacters) {
    return collapsed
  }
  const cut = collapsed.slice(0, maxCharacters)
  const lastSpace = cut.lastIndexOf(' ')
  const stem = lastSpace > maxCharacters / 2 ? cut.slice(0, lastSpace) : cut
  return `${stem}…`
}
