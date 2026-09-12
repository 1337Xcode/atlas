import { AuthoredSceneBriefSchema, PromptSceneBriefSchema, type AuthoredSceneBrief } from '@atlas/schema'

// note: a lint-clean reference brief, so the scene tests exercise rules against realistic prose
export function authoredBrief(overrides: Partial<AuthoredSceneBrief> = {}) {
  return AuthoredSceneBriefSchema.parse({
    kind: 'scene',
    viewpoint: 'first-person',
    focus: 'wall segment',
    subject:
      'A graffitied concrete wall segment rising chest-high across a floodlit Berlin street on the night of 9 November 1989.',
    anchors: [
      { object: 'graffitied concrete wall segment', position: 'straight ahead' },
      { object: 'steel floodlight mast', position: 'on the left' },
      { object: 'parked Trabant hatchback', position: 'on the right' },
    ],
    environment: 'Cold damp air, wet cobblestones, hand-lettered placards, television crews.',
    style: 'Documentary night photography, harsh floodlight falloff, grain, high contrast.',
    idle: 'The crowd along the wall holds its place, shoulders shifting as breath clouds in the floodlight and a placard tilts slowly in a raised hand.',
    travel:
      'The view presses forward along the base of the wall, cobblestones sliding past underfoot as the crowd parts and floodlight glare sweeps across the concrete.',
    guards: ['any tool in a raised hand visible ahead in frame'],
    events: [
      {
        key: '1',
        name: 'Hammer strike',
        detail:
          'The mason hammer swings down against the top edge of the wall segment, concrete dust bursting off the impact and a chip of painted concrete tumbling onto the cobblestones below.',
        sourceIndex: 0,
      },
    ],
    vertical: {
      jump: 'The view rises sharply off the cobblestones, clearing the heads of the crowd for a moment before dropping back down to street level.',
      crouch:
        'The camera lowers toward the ground as the viewpoint crouches down low against the base of the wall.',
      stand: 'The viewpoint straightens back up out of the crouch.',
    },
    seed: 1989,
    rotationSpeedDeg: 5,
    ...overrides,
  })
}

export function promptBrief(prompt?: string) {
  return PromptSceneBriefSchema.parse({
    kind: 'prompt',
    focus: 'wall segment',
    prompt:
      prompt ??
      'A floodlit Berlin street on the night of 9 November 1989, a graffitied concrete wall segment rising chest-high with crowds pressed along its western face, wet cobblestones, documentary night photography.',
  })
}
