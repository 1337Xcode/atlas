// why: the live world runs in the harness, which already owns the reactor session, the controls
// why: and the cost guards; the newspaper hands the reader across rather than duplicating that

// note: the newspaper's event ids against the archive's article ids
const ARTICLE_BY_EVENT: Record<string, string> = {
  apollo11: 'apollo-11-first-steps',
  berlin1989: 'berlin-wall-border-opens',
}

// note: overridable so a deployed newspaper can point at a deployed world service
const WORLD_ORIGIN = import.meta.env.VITE_WORLD_ORIGIN ?? 'http://localhost:3000'

// fn: where the reader goes to stand inside this event, or nothing if no world is built for it
export function worldUrlFor(eventId: string): string | null {
  const article = ARTICLE_BY_EVENT[eventId]
  return article ? worldUrlForArticle(article) : null
}

export function worldUrlForArticle(articleId: string): string {
  return `${WORLD_ORIGIN}/articles/${encodeURIComponent(articleId)}`
}
