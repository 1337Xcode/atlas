import { useState } from 'react'
import { type Edition, formatEditionDate } from '../data/editions'
import { PlayCard } from '../components/ui/play-card'

// feat: one continuous paper: the story, then whatever archival scans the event has
export function EditionPage({ edition, onPlay }: { edition: Edition; onPlay: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className="reader-paper" aria-label={edition.headline} data-reader-page>
      <header className="paper-masthead">
        <span className="paper-name">The Atlas</span>
        <div className="paper-rule">{formatEditionDate(edition.date)}</div>
      </header>

      <div className="paper-story">
        <p className="paper-kicker">{edition.nature}</p>
        <h1>{edition.headline}</h1>
        <p className="paper-dateline">{edition.dateline}</p>

        <figure className="paper-figure">
          {imageFailed ? (
            <p role="alert">The photograph could not load. Reload to try again.</p>
          ) : (
            <PlayCard
              poster={edition.image.url}
              alt={edition.image.caption}
              onPlay={onPlay}
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
          <summary>Context and sources</summary>
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

      {edition.scans.map((scan) => (
        <section className="paper-scan" key={scan.id} aria-label={scan.label}>
          <h2>{scan.label}</h2>
          <img src={scan.url} alt={scan.label} loading="lazy" draggable={false} />
          <p>Source: {scan.source}. Original page, shown without changes.</p>
        </section>
      ))}

      <footer className="paper-source">
        Compiled from the cited sources. The front page above is set by Atlas, not scanned from an
        original newspaper.
      </footer>
    </article>
  )
}
