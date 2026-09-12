import { memo, useMemo, type CSSProperties } from 'react'

// note: adapted from the react bits gradual blur supplied for this project, trimmed to the
// note: edges the reader actually softens: a stack of masked backdrop filters, no style injection

type Edge = 'top' | 'bottom' | 'left' | 'right'
type Curve = 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out'

export type GradualBlurProps = {
  position?: Edge
  /** how far the deepest layer blurs, in rem before scaling */
  strength?: number
  /** thickness of the band, for a top or bottom edge */
  height?: string
  /** thickness of the band, for a left or right edge */
  width?: string
  divCount?: number
  curve?: Curve
  zIndex?: number
  className?: string
}

const CURVES: Record<Curve, (progress: number) => number> = {
  linear: (progress) => progress,
  bezier: (progress) => progress * progress * (3 - 2 * progress),
  'ease-in': (progress) => progress * progress,
  'ease-out': (progress) => 1 - (1 - progress) ** 2,
  'ease-in-out': (progress) =>
    progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2,
}

export const GradualBlur = memo(function GradualBlur({
  position = 'bottom',
  strength = 2,
  height = '6rem',
  width,
  divCount = 5,
  curve = 'linear',
  zIndex = 1,
  className,
}: GradualBlurProps) {
  // why: an unbounded layer count would stack unbounded backdrop filters on the compositor
  const count = Math.max(1, Math.min(12, Math.floor(divCount)))
  const layers = useMemo(
    () =>
      Array.from({ length: count }, (_, index): CSSProperties => {
        const layer = index + 1
        const blur = 0.0625 * (CURVES[curve](layer / count) * count + 1) * Math.max(0, strength)
        const band = 100 / count
        const stops = [band * (layer - 1), band * layer, band * (layer + 1), band * (layer + 2)]
        const gradient = `linear-gradient(to ${position}, transparent ${stops[0]}%, black ${stops[1]}%${
          (stops[2] ?? 0) <= 100 ? `, black ${stops[2]}%` : ''
        }${(stops[3] ?? 0) <= 100 ? `, transparent ${stops[3]}%` : ''})`
        return {
          position: 'absolute',
          inset: 0,
          maskImage: gradient,
          WebkitMaskImage: gradient,
          backdropFilter: `blur(${blur.toFixed(3)}rem)`,
          WebkitBackdropFilter: `blur(${blur.toFixed(3)}rem)`,
        }
      }),
    [count, curve, position, strength],
  )

  const vertical = position === 'top' || position === 'bottom'
  const style: CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex,
    ...(vertical
      ? { height, width: width ?? '100%', left: 0 }
      : { width: width ?? height, height: '100%', top: 0 }),
    [position]: 0,
  }

  return (
    <div aria-hidden="true" className={className} style={style}>
      {layers.map((layer, index) => (
        <div key={index} style={layer} />
      ))}
    </div>
  )
})
