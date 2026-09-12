import { describe, expect, it } from 'vitest'
import { createProjector } from './projection.ts'

const viewport = { width: 1600, height: 900 }

describe('createProjector', () => {
  it('puts whatever the camera is looking at in the middle of the screen', () => {
    const projector = createProjector(viewport, { x: 3, y: -2, z: 5 })
    expect(projector.toScreen(3, -2)).toEqual([800, 450])
  })

  it('moves a point right and down as its scene position grows', () => {
    const projector = createProjector(viewport, { x: 0, y: 0, z: 5 })
    const [x, y] = projector.toScreen(1, 1)
    expect(x).toBeGreaterThan(800)
    expect(y).toBeGreaterThan(450)
  })

  it('magnifies as the camera comes closer', () => {
    const near = createProjector(viewport, { x: 0, y: 0, z: 2 })
    const far = createProjector(viewport, { x: 0, y: 0, z: 10 })
    expect(near.scale).toBeGreaterThan(far.scale)
  })

  // why: the overlay is pixels and the shader wants 0..1 with y flipped
  it('converts screen pixels to shader units, flipping y', () => {
    const projector = createProjector(viewport, { x: 0, y: 0, z: 5 })
    expect(projector.toUnit(800, 450)).toEqual([0.5, 0.5])
    expect(projector.toUnit(0, 0)).toEqual([0, 1])
  })

  it('reflows when the viewport changes, rather than keeping the old centre', () => {
    const wide = createProjector({ width: 1600, height: 900 }, { x: 0, y: 0, z: 5 })
    const tall = createProjector({ width: 600, height: 1200 }, { x: 0, y: 0, z: 5 })
    expect(wide.toScreen(0, 0)).toEqual([800, 450])
    expect(tall.toScreen(0, 0)).toEqual([300, 600])
  })

  // why: a zero distance or a zero height would otherwise spread NaN across the whole overlay
  it('never produces NaN, however degenerate the inputs', () => {
    const degenerate = createProjector({ width: 0, height: 0 }, { x: 0, y: 0, z: 0 })
    expect(degenerate.toScreen(1, 1).every(Number.isFinite)).toBe(true)
    expect(degenerate.toUnit(1, 1).every(Number.isFinite)).toBe(true)
  })
})
