export type PlayCardProps = {
  poster: string
  alt: string
  onPlay: () => void
  label: string
  disabled?: boolean
  onImageError?: () => void
}

// feat: the photograph is the door; the only control on it is the play button at its centre
export function PlayCard({
  poster,
  alt,
  onPlay,
  label,
  disabled = false,
  onImageError,
}: PlayCardProps) {
  return (
    <div className="paper-world">
      <img src={poster} alt={alt} draggable={false} fetchPriority="high" onError={onImageError} />
      <button
        type="button"
        className="world-play-button"
        aria-label={label}
        disabled={disabled}
        onClick={onPlay}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
