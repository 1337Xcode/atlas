import { useMemo } from 'react'
import type { Edition } from '../data/editions'
import { OptionWheel } from '../ui/OptionWheel'
import { GradualBlur } from '../components/ui/gradual-blur'

export type EditionListProps = {
  editions: Edition[]
  index: number
  onSelect: (index: number) => void
  // note: the same list, laid out as a row, for viewports with no margin to spare
  asStrip?: boolean
}

// feat: whatever the reader lands on opens, so there is no second step to confirm a choice
export function EditionList({ editions, index, onSelect, asStrip = false }: EditionListProps) {
  const labels = useMemo(() => editions.map((edition) => edition.title), [editions])

  if (asStrip) {
    return (
      <nav className="reader-strip" aria-label="Events">
        {editions.map((edition, position) => (
          <button
            key={edition.id}
            type="button"
            aria-current={position === index}
            onClick={() => onSelect(position)}
          >
            {edition.title}
          </button>
        ))}
      </nav>
    )
  }

  return (
    <>
      <OptionWheel
        items={labels}
        selected={index}
        onChange={onSelect}
        label="Events"
        fontSize={1.05}
        spacing={2.4}
        inset={48}
        tilt={3}
        curve={0.18}
        fade={0.13}
        minOpacity={0.2}
      />
      <GradualBlur position="top" height="4rem" strength={0.9} divCount={3} curve="bezier" />
      <GradualBlur position="bottom" height="4rem" strength={0.9} divCount={3} curve="bezier" />
    </>
  )
}
