import { useState } from 'react'
import { type Edition, type ReaderPage, formatEditionDate } from '../data/editions'
import { worldUrlForArticle } from '../data/worlds'
import { HoverPlayCard } from '../components/ui/hover-play-card'

export function EditionPage({ edition, page }: { edition: Edition; page: ReaderPage }) {
  const [imageFailed, setImageFailed] = useState(false)
  if (page.kind === 'scan') {
    return (
      <article className="reader-paper reader-scan" aria-label={page.label} data-reader-page>
        <header className="scan-heading">
          <span>From the archive</span>
          <h2>{page.label}</h2>
        </header>
        {imageFailed ? (
          <p role="alert">This scan could not load. Use Previous page to return to the story.</p>
        ) : (
          <img
            src={page.url}
            alt={page.label}
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        )}
        <footer className="paper-source">
          Source: {page.source}. Original page, shown without changes.
        </footer>
      </article>
    )
  }
  return (
    <article className="reader-paper" aria-label={edition.headline} data-reader-page>
      <header className="paper-masthead">
        <span className="paper-name">The Atlas</span>
        <div className="paper-rule">
          <span>{formatEditionDate(edition.date)}</span>
          <span>Reading edition</span>
        </div>
      </header>
      <div className="paper-story">
        <div className="paper-section">
          <span>{edition.nature}</span>
        </div>
        <h1>{edition.headline}</h1>
        <p className="paper-dateline">{edition.dateline}</p>
        <figure className="paper-figure">
          {imageFailed ? (
            <p role="alert">The photograph could not load. Reload to try again.</p>
          ) : (
            <HoverPlayCard
              poster={edition.image.url}
              alt={edition.image.caption}
              href={worldUrlForArticle(edition.id)}
              label={`Explore ${edition.title} in the world viewer`}
              onImageError={() => setImageFailed(true)}
            />
          )}
          <figcaption>
            {edition.image.caption} <span>{edition.image.credit}</span>
          </figcaption>
        </figure>
        <p className="paper-summary">{edition.summary}</p>
        <details className="paper-details">
          <summary>Context &amp; sources</summary>
          <p>{edition.context}</p>
          {edition.contentNote && <p>{edition.contentNote}</p>}
          <ul>
            {edition.sources.map((source) => (
              <li key={source.title}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
              </li>
            ))}
          </ul>
          <p>
            The interactive world is an AI reconstruction, not archival footage. Details may differ
            from the historical record.
          </p>
        </details>
      </div>
      <footer className="paper-source">
        Compiled from cited sources. This reading edition is not an original newspaper scan.
      </footer>
    </article>
  )
}
