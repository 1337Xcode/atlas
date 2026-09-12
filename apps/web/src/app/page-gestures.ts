export type PageDirection = -1 | 1

export function bindPageGestures(surface: HTMLElement, turn: (direction: PageDirection) => void) {
  let pointer: { id: number; x: number; y: number } | undefined
  let dragged = false
  let wheelDistance = 0
  let wheelLocked = false
  let wheelTimer: ReturnType<typeof setTimeout> | undefined

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    event.preventDefault()
    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(() => {
      wheelDistance = 0
      wheelLocked = false
    }, 180)
    if (wheelLocked) return
    wheelDistance += event.deltaX * (event.deltaMode === 1 ? 16 : 1)
    if (Math.abs(wheelDistance) < 60) return
    wheelLocked = true
    turn(wheelDistance > 0 ? 1 : -1)
  }

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false) {
      pointer = undefined
      return
    }
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    dragged = false
  }
  const onMove = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      pointer = undefined
      return
    }
    if (Math.abs(dx) < 12 || dragged) return
    dragged = true
    surface.setPointerCapture?.(event.pointerId)
  }
  const onUp = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    pointer = undefined
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.4) turn(dx < 0 ? 1 : -1)
  }
  const onCancel = () => {
    pointer = undefined
  }
  const onClick = (event: MouseEvent) => {
    if (!dragged) return
    event.preventDefault()
    event.stopPropagation()
    dragged = false
  }
  surface.addEventListener('wheel', onWheel, { passive: false })
  surface.addEventListener('pointerdown', onDown)
  surface.addEventListener('pointermove', onMove)
  surface.addEventListener('pointerup', onUp)
  surface.addEventListener('pointercancel', onCancel)
  surface.addEventListener('lostpointercapture', onCancel)
  surface.addEventListener('click', onClick, true)
  return () => {
    clearTimeout(wheelTimer)
    surface.removeEventListener('wheel', onWheel)
    surface.removeEventListener('pointerdown', onDown)
    surface.removeEventListener('pointermove', onMove)
    surface.removeEventListener('pointerup', onUp)
    surface.removeEventListener('pointercancel', onCancel)
    surface.removeEventListener('lostpointercapture', onCancel)
    surface.removeEventListener('click', onClick, true)
  }
}
