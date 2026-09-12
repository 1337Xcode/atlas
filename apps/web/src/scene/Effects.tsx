import { forwardRef, useMemo } from 'react'
import { Uniform, Vector2 } from 'three'
import { Effect, BlendFunction } from 'postprocessing'
import { EffectComposer, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import warmthFrag from '../shaders/warmth.frag?raw'
import focusFrag from '../shaders/radialFocus.frag?raw'

class WarmthEffect extends Effect {
  constructor() {
    super('Warmth', warmthFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([['t', new Uniform(0)]]),
    })
  }
  set t(v: number) {
    this.uniforms.get('t')!.value = v
  }
}
class RadialFocusEffect extends Effect {
  constructor() {
    super('RadialFocus', focusFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['center', new Uniform(new Vector2(0.5, 0.5))],
        ['radius', new Uniform(1)],
        ['softness', new Uniform(0.15)],
        ['enabled', new Uniform(1)],
      ]),
    })
  }
  override update(_r: unknown, _i: unknown, _d: number) {
    /* uniforms set from the rig */
  }
  setFocus(cx: number, cy: number, radius: number, enabled: boolean) {
    ;(this.uniforms.get('center')!.value as Vector2).set(cx, cy)
    this.uniforms.get('radius')!.value = radius
    this.uniforms.get('enabled')!.value = enabled ? 1 : 0
  }
}

const Warmth = forwardRef<WarmthEffect, { t: number }>(function Warmth({ t }, ref) {
  const e = useMemo(() => new WarmthEffect(), [])
  e.t = t
  return <primitive ref={ref} object={e} />
})
const RadialFocus = forwardRef<
  RadialFocusEffect,
  { cx: number; cy: number; radius: number; enabled: boolean }
>(function RadialFocus(p, ref) {
  const e = useMemo(() => new RadialFocusEffect(), [])
  e.setFocus(p.cx, p.cy, p.radius, p.enabled)
  return <primitive ref={ref} object={e} />
})

export interface EffectsProps {
  grain: number
  vignette: number
  aberration: number
  warmth: number
  focus: { cx: number; cy: number; radius: number; enabled: boolean }
}

/** One merged pass. No bloom, no flare, no shadows. */
export function Effects({ grain, vignette, aberration, warmth, focus }: EffectsProps) {
  return (
    <EffectComposer multisampling={0}>
      <RadialFocus {...focus} />
      <Warmth t={warmth} />
      <ChromaticAberration
        offset={new Vector2(aberration, aberration)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise premultiply opacity={grain} />
      <Vignette eskil={false} offset={0.35} darkness={vignette} />
    </EffectComposer>
  )
}
