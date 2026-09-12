'use client'

import type { WorldSessionPlan } from '@atlas/schema'

// feat: thumb controls for a phone, move on the left, look on the right
export type WorldPadsProps = {
  plan: WorldSessionPlan
  bindMovePad: (element: HTMLElement | null) => void
  bindLookPad: (element: HTMLElement | null) => void
  bindButtonBar: (element: HTMLElement | null) => void
}

export function WorldPads({ plan, bindMovePad, bindLookPad, bindButtonBar }: WorldPadsProps) {
  return (
    <div className="pads">
      <div className="pad pad-move" ref={bindMovePad}>
        <span>drag to walk</span>
      </div>

      <div className="pad-buttons" ref={bindButtonBar}>
        {plan.capabilities.vertical ? (
          <>
            <button type="button" data-action="jump">
              hop
            </button>
            <button type="button" data-action="crouch">
              crouch
            </button>
          </>
        ) : null}
        {plan.annotations.map((annotation) => (
          <button type="button" key={annotation.key} data-action={`event:${annotation.key}`}>
            {annotation.name}
          </button>
        ))}
      </div>

      <div className="pad pad-look" ref={bindLookPad}>
        <span>drag to look</span>
      </div>
    </div>
  )
}
