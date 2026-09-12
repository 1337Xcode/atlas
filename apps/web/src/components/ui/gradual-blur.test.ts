import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GradualBlur, type GradualBlurProps } from './gradual-blur'

function render(props: GradualBlurProps) {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(GradualBlur, props))
  return host.firstElementChild as HTMLDivElement
}

// test: decorative blur stays bounded and cannot intercept a navigation gesture
describe('GradualBlur', () => {
  it('uses the requested layer count and leaves pointer input untouched', () => {
    const root = render({ position: 'bottom', height: '2.5rem', divCount: 3 })
    expect(root.children).toHaveLength(3)
    expect(root.style.pointerEvents).toBe('none')
    expect(root.style.bottom).toBe('0px')
    expect(root.style.height).toBe('2.5rem')
    expect(root.getAttribute('aria-hidden')).toBe('true')
  })

  it('clamps excessive layer counts instead of creating unbounded filters', () => {
    expect(render({ divCount: 100 }).children).toHaveLength(12)
    expect(render({ divCount: 0 }).children).toHaveLength(1)
  })

  it('masks along the requested edge', () => {
    const root = render({ position: 'left', width: '3rem' })
    expect(root.style.left).toBe('0px')
    expect(root.style.width).toBe('3rem')
    expect(root.firstElementChild?.getAttribute('style')).toContain('to left')
  })
})
