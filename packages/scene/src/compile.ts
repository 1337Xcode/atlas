import type { CompiledScene, SceneBrief, SceneEvent, SceneLayers } from '@atlas/schema'
import { cameraContract, fallbackMovement, pinAnchors } from './templates.ts'

export type CompileSceneOptions = {
  // note: comes from the target model's capabilities, not from the article
  promptCharBudget: number
}

// fn: turn an editorial brief into the prompt layers the runtime recomposes at runtime
export function compileScene(brief: SceneBrief, options: CompileSceneOptions): CompiledScene {
  const { viewpoint, focus } = brief
  const guards = brief.kind === 'scene' ? brief.guards : []

  const layers: SceneLayers = {
    base: compileBase(brief),
    camera: {
      static: cameraContract(viewpoint, false, focus),
      dynamic: cameraContract(viewpoint, true, focus),
    },
    // why: guards belong beside the camera contract, never in the base
    guards: joinProse(guards),
    movement:
      brief.kind === 'scene'
        ? { static: brief.idle, dynamic: brief.travel }
        : {
            static: fallbackMovement(viewpoint, false, focus),
            dynamic: fallbackMovement(viewpoint, true, focus),
          },
    events: brief.kind === 'scene' ? brief.events.map(compileEvent) : [],
  }

  return {
    viewpoint,
    layers: brief.kind === 'scene' && brief.vertical ? { ...layers, vertical: brief.vertical } : layers,
    seed: brief.seed,
    rotationSpeedDeg: brief.rotationSpeedDeg,
    promptCharBudget: options.promptCharBudget,
  }
}

// fn: the base carries world identity only — subject, pinned landmarks, environment, style
function compileBase(brief: SceneBrief): string {
  const pinned = pinAnchors(brief.anchors)
  const parts =
    brief.kind === 'scene'
      ? [brief.subject, pinned, brief.environment, brief.style]
      : [brief.prompt, pinned]
  return joinProse(parts)
}

function compileEvent(event: SceneEvent): SceneLayers['events'][number] {
  const detail = typeof event.detail === 'string' ? { static: event.detail, dynamic: event.detail } : event.detail
  return { key: event.key, name: event.name, static: detail.static, dynamic: detail.dynamic }
}

// note: authored fragments are stitched into prose, so each one is closed and capitalised
function joinProse(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(' ')
}
