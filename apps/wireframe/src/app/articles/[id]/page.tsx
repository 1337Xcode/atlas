import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WorldFrame } from '@/components/world-frame.tsx'
import { getArchive } from '@/server/archive.ts'

// note: article plus the world block a reader can step into
export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const archive = getArchive()
  const entry = await archive.find(id)
  if (!entry?.servable) notFound()

  const { article } = entry
  const anchor = archive.anchorImage(article)

  return (
    <main>
      <p>
        <Link href="/">back to the front page</Link>
      </p>

      <h1>{article.headline}</h1>
      <p>
        <small>
          {article.dateline} · {article.nature}
        </small>
      </p>
      <p>
        <strong>{article.summary}</strong>
      </p>

      <WorldFrame
        articleId={article.id}
        anchorImageUrl={archive.imageUrl(article, anchor)}
        anchorCaption={anchor.caption}
      />

      {article.contentNote ? (
        <div className="problems">
          <h2>a note on this world</h2>
          <p>{article.contentNote}</p>
        </div>
      ) : null}

      {article.body.split('\n\n').map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}

      <h2>Context</h2>
      <p>{article.context}</p>

      <h2>Plates</h2>
      <ul>
        {article.images
          .filter((image) => image.role === 'plate')
          .map((image) => (
            <li key={image.id}>
              <figure>
                <img src={archive.imageUrl(article, image)} alt={image.caption} width={480} />
                <figcaption>
                  {image.caption} — {image.credit}
                </figcaption>
              </figure>
            </li>
          ))}
      </ul>

      <h2>Sources</h2>
      <ol>
        {article.sources.map((source) => (
          <li key={source.title}>
            {source.url ? <a href={source.url}>{source.title}</a> : source.title}
            {source.publisher ? ` — ${source.publisher}` : ''}
          </li>
        ))}
      </ol>
    </main>
  )
}
