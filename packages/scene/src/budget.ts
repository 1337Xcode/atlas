// docs: prompt-guide length budget — the encoder truncates composed prose, events stack

export type SceneBudget = {
  base: number
  camera: number
  guards: number
  movement: number
  event: number
  composed: number
}

// note: the published per-layer targets, written for a 2000 char composed budget
const REFERENCE: SceneBudget = {
  base: 600,
  camera: 300,
  // note: guards are not a published layer; this keeps them from eating the event budget
  guards: 200,
  movement: 350,
  event: 500,
  composed: 2000,
}

// fn: scale the per-layer targets for models with a smaller prompt budget
export function sceneBudgetFor(promptCharBudget: number): SceneBudget {
  const scale = promptCharBudget / REFERENCE.composed
  return {
    base: Math.floor(REFERENCE.base * scale),
    camera: Math.floor(REFERENCE.camera * scale),
    guards: Math.floor(REFERENCE.guards * scale),
    movement: Math.floor(REFERENCE.movement * scale),
    event: Math.floor(REFERENCE.event * scale),
    composed: promptCharBudget,
  }
}
