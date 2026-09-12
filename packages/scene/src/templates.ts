import type { Viewpoint } from '@atlas/schema'

// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/prompt-guide
// why: these contract sentences are reused verbatim — a paraphrase reads as a different instruction

type Contract = (focus: string) => string

// note: the camera layer owns the input contract, so camera motion can never run on its own
const CAMERA: Record<Viewpoint, { static: Contract; dynamic: Contract }> = {
  'third-person': {
    static: (focus) =>
      `Third-person view, the ${focus} locked at the exact centre of the frame at constant size and distance. Neither the ${focus} nor the camera moves on its own; look-input is the only source of camera motion, arcing the camera around the stationary, centred ${focus} only while held.`,
    dynamic: (focus) =>
      `Strict third-person rear view, the ${focus} locked at the exact centre of the frame as the camera holds a fixed position behind it and tracks it forward. The camera does not rotate around the ${focus}; look-input becomes the ${focus} changing heading.`,
  },
  'first-person': {
    static: (focus) =>
      `First-person view, the ${focus} held at the exact centre of the frame at constant size and distance. Neither the ${focus} nor the viewpoint moves on its own; look-input is the only source of camera motion, arcing the view around the centred ${focus} only while held.`,
    dynamic: (focus) =>
      `Strict first-person view, the ${focus} holding steady at the centre of the frame as the viewpoint advances through the scene; look-input becomes the heading changing.`,
  },
}

// note: fallback movement prose for briefs that ship a free prompt instead of authored slots
const MOVEMENT: Record<Viewpoint, { static: Contract; dynamic: Contract }> = {
  'third-person': {
    static: (focus) =>
      `The ${focus} stays settled in place, weight resting, with only the faintest shift of stance and the surrounding air stirring around it.`,
    dynamic: (focus) =>
      `The ${focus} travels directly away from the camera so it stays in strict rear view, the ground sliding past beneath it and loose dust lifting in its wake.`,
  },
  'first-person': {
    static: (focus) =>
      `The ${focus} holds steady in the foreground, weight settled, with only the surrounding air stirring faintly across the scene.`,
    dynamic: (focus) =>
      `The viewpoint advances steadily through the scene, the ground sliding past underfoot as the ${focus} stays ahead in frame.`,
  },
}

export function cameraContract(viewpoint: Viewpoint, moving: boolean, focus: string): string {
  const contract = CAMERA[viewpoint]
  return moving ? contract.dynamic(focus) : contract.static(focus)
}

export function fallbackMovement(viewpoint: Viewpoint, moving: boolean, focus: string): string {
  const prose = MOVEMENT[viewpoint]
  return moving ? prose.dynamic(focus) : prose.static(focus)
}

// fn: pin landmarks with explicit counts so a sweeping view cannot duplicate them
export function pinAnchors(anchors: readonly { object: string; position: string }[]): string {
  if (anchors.length === 0) return ''
  const clauses = anchors.map(
    (anchor) => `EXACTLY ONE ${anchor.object} ${anchor.position} at a fixed position`,
  )
  return `The world contains ${clauses.join(' AND ')}.`
}
