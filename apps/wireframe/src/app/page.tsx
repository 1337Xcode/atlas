import Link from 'next/link'
import { getArchive } from '@/server/archive.ts'

// note: the front page, wireframe only — enough to reach every world
export default async function HomePage() {
  const archive = getArchive()
  const [articles, problems] = await Promise.all([archive.servable(), archive.problems()])

  return (
    <main>
      <h1>Atlas — interactive newspaper</h1>
      <p>Backend harness. {articles.length} worlds in the archive.</p>

      {problems.length > 0 ? (
        <div className="problems">
          <h2>withheld articles</h2>
          <ul>
            {problems.map((problem) => (
              <li key={problem.file}>
                <strong>{problem.file}</strong>: {problem.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <hr />

      <ol>
        {articles.map((article) => (
          <li key={article.id}>
            <h2>
              <Link href={`/articles/${article.id}`}>{article.headline}</Link>
            </h2>
            <p>
              <small>
                {article.dateline} · {article.nature}
              </small>
            </p>
            <p>{article.summary}</p>
          </li>
        ))}
      </ol>
    </main>
  )
}
