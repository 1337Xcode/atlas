import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

// note: adapted from the react bits option wheel supplied for this project, trimmed to what
// note: the reader uses: a curved column of labels that the wheel, a drag or a click moves through

export type OptionWheelProps = {
  items: string[]
  selected: number
  onChange: (index: number) => void
  label: string
  /** rem */
  fontSize?: number
  /** row height, as a multiple of the font size */
  spacing?: number
  /** px from the left edge */
  inset?: number
  /** degrees of rotation per row; 0 lays the labels out flat */
  tilt?: number
  /** how far the curve pulls distant labels sideways, 0 to 1 */
  curve?: number
  /** opacity lost per row away from the centre */
  fade?: number
  minOpacity?: number
  /** easing time constant in ms */
  smoothing?: number
}

type Geometry = Required<Omit<OptionWheelProps, 'items' | 'selected' | 'onChange' | 'label'>> & {
  count: number
  rowHeight: number
}

const rootFontSize = () =>
  typeof window === 'undefined'
    ? 16
    : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

export function OptionWheel({
  items,
  selected,
  onChange,
  label,
  fontSize = 1.05,
  spacing = 2.4,
  inset = 48,
  tilt = 3,
  curve = 0.18,
  fade = 0.13,
  minOpacity = 0.2,
  smoothing = 90,
}: OptionWheelProps) {
  const root = useRef<HTMLDivElement>(null)
  const options = useRef<(HTMLDivElement | null)[]>([])
  const position = useRef(selected)
  const target = useRef(selected)
  const frame = useRef<number | null>(null)
  const lastFrameAt = useRef(0)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<{ y: number; from: number; id: number; moved: boolean } | null>(null)
  const announced = useRef(selected)
  const onChangeRef = useRef(onChange)
  const geometry = useRef<Geometry>({} as Geometry)
  const [dragging, setDragging] = useState(false)

  onChangeRef.current = onChange
  geometry.current = {
    count: items.length,
    rowHeight: Math.max(fontSize * spacing * rootFontSize(), 1),
    fontSize,
    spacing,
    inset,
    tilt,
    curve,
    fade,
    minOpacity,
    smoothing,
  }

  // perf: one rAF loop eases toward the target, then lays every label out along the arc
  const step = useCallback((now: number) => {
    const config = geometry.current
    const delta = Math.min((now - lastFrameAt.current) / 1000, 0.05)
    lastFrameAt.current = now
    const ease = 1 - Math.exp(-delta / (Math.max(config.smoothing, 1) / 1000))
    let next = position.current + (target.current - position.current) * ease
    const settled = Math.abs(target.current - next) < 0.001
    if (settled) next = target.current
    position.current = next

    // note: labels sit on a circle whose arc length between neighbours is one row height
    const tiltRad = (config.tilt * Math.PI) / 180
    const radius = tiltRad > 0.0005 ? config.rowHeight / tiltRad : 0
    for (let index = 0; index < config.count; index += 1) {
      const element = options.current[index]
      if (!element) continue
      const offset = index - next
      const distance = Math.abs(offset)
      let x = 0
      let y = offset * config.rowHeight
      let rotation = 0
      if (radius > 0) {
        const angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, offset * tiltRad))
        y = radius * Math.sin(angle)
        x = -radius * (1 - Math.cos(angle)) * config.curve
        rotation = (angle * 180) / Math.PI
      }
      element.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rotation.toFixed(3)}deg)`
      element.style.opacity = String(Math.max(config.minOpacity, 1 - distance * config.fade))
      element.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(distance, 1)).toFixed(4))
    }

    frame.current = settled ? null : requestAnimationFrame(step)
  }, [])

  const run = useCallback(() => {
    if (frame.current !== null) return
    lastFrameAt.current = performance.now()
    frame.current = requestAnimationFrame(step)
  }, [step])

  // fn: move the wheel, and report a landing as soon as the nearest label changes
  const moveTo = useCallback(
    (value: number, snap: boolean) => {
      const { count } = geometry.current
      if (count === 0) return
      let next = Math.min(Math.max(value, 0), count - 1)
      if (snap) next = Math.round(next)
      target.current = next
      const landed = Math.round(next)
      if (landed !== announced.current) {
        announced.current = landed
        onChangeRef.current(landed)
      }
      run()
    },
    [run],
  )

  // why: the wheel owns vertical scrolling here, so it must be registered non-passively
  useEffect(() => {
    const element = root.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const distance = event.deltaY * (event.deltaMode === 1 ? 24 : 1)
      // note: one notch of a mouse wheel is capped at one row; a trackpad still glides
      const stepped = Math.max(-1, Math.min(1, distance / geometry.current.rowHeight))
      moveTo(target.current + stepped, false)
      if (settleTimer.current) clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => moveTo(target.current, true), 140)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [moveTo])

  // why: the selection is owned by the reader, so an outside change animates the wheel too
  useEffect(() => {
    if (announced.current === selected) {
      run()
      return
    }
    announced.current = selected
    target.current = selected
    run()
  }, [selected, items, run])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    },
    [],
  )

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { y: event.clientY, from: target.current, id: event.pointerId, moved: false }
    setDragging(true)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current) return
    const dy = event.clientY - current.y
    if (!current.moved && Math.abs(dy) > 4) {
      current.moved = true
      // note: capture only once a real drag starts, so a plain click still reaches a label
      root.current?.setPointerCapture(current.id)
    }
    if (current.moved) moveTo(current.from - dy / geometry.current.rowHeight, false)
  }
  const onPointerEnd = () => {
    const current = drag.current
    if (!current) return
    drag.current = null
    setDragging(false)
    if (current.moved) moveTo(target.current, true)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (delta === 0) return
    event.preventDefault()
    moveTo(Math.round(target.current) + delta, true)
  }

  return (
    <div
      ref={root}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      className="option-wheel"
      data-dragging={dragging}
      style={
        {
          '--ow-font-size': `${fontSize}rem`,
          '--ow-inset': `${inset}px`,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <div
          key={item}
          ref={(element) => {
            options.current[index] = element
          }}
          role="option"
          aria-selected={index === selected}
          className="option-wheel-item"
          onClick={() => {
            if (drag.current?.moved) return
            moveTo(index, true)
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
