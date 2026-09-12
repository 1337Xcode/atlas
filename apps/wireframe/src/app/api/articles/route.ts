import { getArchive } from '@/server/archive.ts'

// feat: the index a newspaper front page would render
export async function GET() {
  const archive = getArchive()
  const [articles, problems] = await Promise.all([archive.servable(), archive.problems()])

  return Response.json({
    articles: articles.map((article) => ({
      id: article.id,
      headline: article.headline,
      dateline: article.dateline,
      nature: article.nature,
      summary: article.summary,
      anchorImageUrl: archive.imageUrl(archive.anchorImage(article)),
    })),
    // note: withheld articles are reported, never silently dropped
    problems,
  })
}
