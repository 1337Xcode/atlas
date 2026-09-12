import { useEffect, useRef, useState } from 'react'
import { editions } from '../data/editions'
import { WorldOverlay } from '../world/WorldOverlay'
import { useWorldExperience } from '../world/useWorldExperience'
import { EditionList } from './EditionList'
import { EditionPage } from './EditionPage'

// feat: one wordmark, one list of events, and one paper that only ever scrolls up and down
export function Reader() {
  const { experience, notice, open: openWorld, close: closeWorld } = useWorldExperience()
  const [index, setIndex] = useState(0)
  const scroll = useRef<HTMLDivElement>(null)
  const edition = editions[index]

  // why: a new event starts at its masthead, never halfway down the previous one
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [index])

  if (!edition) {
    return (
      <div className="reader-failure" role="alert">
        <div>
          <strong>No editions are available.</strong>
          <p>Reload to try again.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="reader" inert={Boolean(experience)}>
        <a className="reader-brand" href="/" aria-label="Atlas home">
          atlas
        </a>
        <div className="reader-rail">
          <EditionList editions={editions} index={index} onSelect={setIndex} />
        </div>
        <div
          className="reader-scroll"
          ref={scroll}
          aria-label={`${edition.title}. Scroll to read.`}
        >
          <div className="reader-column">
            <EditionList editions={editions} index={index} onSelect={setIndex} asStrip />
            <EditionPage edition={edition} onPlay={() => openWorld(edition)} />
          </div>
        </div>
        {notice && (
          <p className="reader-notice" role="status">
            {notice}
          </p>
        )}
      </div>
      {experience && <WorldOverlay experience={experience} onExit={closeWorld} />}
    </>
  )
}
