import { getProject, types, type ISheet, type ISheetObject } from '@theatre/core'
import type { Scenario } from '../data/types'
import { buildTracks, initialValues, valueAt } from './beats'

export interface SheetObjects {
  camera: ISheetObject<{ x: number; y: number; z: number; fov: number }>
  focus: ISheetObject<{ x: number; y: number; radius: number; softness: number }>
  post: ISheetObject<{ grain: number; vignette: number; aberration: number }>
  warmth: ISheetObject<{ t: number }>
  letterbox: ISheetObject<{ amount: number }>
  ghost: ISheetObject<{ opacity: number; scale: number }>
  world: ISheetObject<{ mix: number }>
}

export function createSheet(
  sc: Scenario,
  handKeyframes: unknown,
): { sheet: ISheet; objects: SheetObjects } {
  const project = getProject(
    'front-pages-' + sc.id,
    handKeyframes ? { state: handKeyframes as never } : undefined,
  )
  const sheet = project.sheet(sc.id)
  const n = (v: number, range: [number, number] = [-100, 100]) => types.number(v, { range })
  const objects: SheetObjects = {
    camera: sheet.object('camera', {
      x: n(sc.hubCamera.x),
      y: n(sc.hubCamera.y),
      z: n(sc.hubCamera.z, [0.01, 100]),
      fov: n(35, [10, 90]),
    }),
    focus: sheet.object('focus', {
      x: n(sc.hubCamera.x),
      y: n(sc.hubCamera.y),
      radius: n(1, [0, 1]),
      softness: n(0.15, [0, 1]),
    }),
    post: sheet.object('post', {
      grain: n(0.04, [0, 1]),
      vignette: n(0.15, [0, 1]),
      aberration: n(0, [0, 0.01]),
    }),
    warmth: sheet.object('warmth', { t: n(0, [0, 1]) }),
    letterbox: sheet.object('letterbox', { amount: n(0, [0, 1]) }),
    ghost: sheet.object('ghost', { opacity: n(0, [0, 0.35]), scale: n(1.05, [0.9, 1.1]) }),
    world: sheet.object('world', { mix: n(0, [0, 1]) }),
  }
  return { sheet, objects }
}

/** Values derived from scenario beats. Hand keyframes in the Theatre state override these when present. */
export function makeSampler(sc: Scenario) {
  const tracks = buildTracks(sc)
  const init = initialValues(sc)
  return (name: string, t: number, base?: { t: number; v: number }) =>
    valueAt(tracks, init, name, t, base)
}

export async function attachMasterAudio(sheet: ISheet, url: string) {
  await sheet.sequence.attachAudio({ source: url })
}
