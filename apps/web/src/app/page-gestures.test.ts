import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindPageGestures } from './page-gestures'

let surface: HTMLDivElement
let cleanup: () => void
const turn = vi.fn()
function wheel(x: number, y = 0, ctrl = false) {
  const event = new WheelEvent('wheel', { deltaX: x, deltaY: y, ctrlKey: ctrl, cancelable: true })
  surface.dispatchEvent(event)
  return event
}
function pointer(type: string, x: number, y = 100) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  surface.dispatchEvent(event)
}
beforeEach(() => {
  vi.useFakeTimers()
  turn.mockClear()
  surface = document.createElement('div')
  document.body.append(surface)
  cleanup = bindPageGestures(surface, turn)
})
afterEach(() => {
  cleanup()
  surface.remove()
  vi.useRealTimers()
})

describe('reader page gestures', () => {
  it('turns once per horizontal trackpad gesture, including its momentum', () => {
    for (let i = 0; i < 15; i++) wheel(18)
    expect(turn).toHaveBeenCalledExactlyOnceWith(1)
    vi.advanceTimersByTime(200)
    wheel(-90)
    expect(turn).toHaveBeenLastCalledWith(-1)
    expect(turn).toHaveBeenCalledTimes(2)
  })
  it('leaves vertical scrolling and pinch zoom to the browser', () => {
    expect(wheel(0, 100).defaultPrevented).toBe(false)
    expect(wheel(100, 0, true).defaultPrevented).toBe(false)
    expect(turn).not.toHaveBeenCalled()
  })
  it('turns when dragged horizontally and suppresses the following image click', () => {
    pointer('pointerdown', 240)
    pointer('pointermove', 110)
    pointer('pointerup', 90)
    const click = new MouseEvent('click', { cancelable: true })
    surface.dispatchEvent(click)
    expect(turn).toHaveBeenCalledExactlyOnceWith(1)
    expect(click.defaultPrevented).toBe(true)
  })
  it('does not turn on a vertical drag or small click movement', () => {
    pointer('pointerdown', 240)
    pointer('pointermove', 234, 20)
    pointer('pointerup', 80, 0)
    pointer('pointerdown', 240)
    pointer('pointerup', 238)
    expect(turn).not.toHaveBeenCalled()
  })
  it('does not navigate a cancelled gesture', () => {
    pointer('pointerdown', 240)
    pointer('pointermove', 100)
    pointer('pointercancel', 100)
    pointer('pointerup', 100)
    expect(turn).not.toHaveBeenCalled()
  })
  it('cleans up listeners and pending wheel timers', () => {
    wheel(10)
    cleanup()
    wheel(100)
    expect(turn).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
