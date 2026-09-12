import { ArticleSchema, type Article } from './article.ts'
import {
  AuthoredSceneBriefSchema,
  PromptSceneBriefSchema,
  type AuthoredSceneBrief,
} from './scene.ts'

// note: reference content that conforms to the contract, shared by every package's tests
// note: the prose is lint-clean on purpose, so fidelity rules are tested against a good baseline

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

export function sampleArticle(overrides: Partial<Article> = {}): Article {
  return ArticleSchema.parse({
    id: 'berlin-wall-opens',
    headline: 'Berlin Wall Opened After Twenty-Eight Years',
    dateline: 'BERLIN, 10 NOVEMBER 1989',
    occurredOn: '1989-11-09',
    nature: 'political-upheaval',
    summary:
      'East German authorities opened the border crossings late on 9 November 1989, and crowds gathered at the wall through the night.',
    body: 'Crossing points opened shortly before midnight after an evening announcement that private travel abroad could be applied for without preconditions. Crowds gathered on both sides, and by morning sections of the wall had been chipped away by hand.',
    context:
      'The wall had divided the city since 13 August 1961. The opening followed weeks of mass demonstrations in Leipzig and East Berlin and a press conference earlier that evening.',
    images: [
      {
        id: 'crowd-at-the-wall',
        src: 'berlin-wall-opens/crowd-at-the-wall.jpg',
        caption: 'Crowds at the Brandenburg Gate section of the wall, 10 November 1989.',
        credit: 'Public domain',
        role: 'anchor',
      },
    ],
    sources: [
      {
        title: 'Berlin Wall: chronology of the opening of the border',
        publisher: 'Stiftung Berliner Mauer',
      },
    ],
    world: authoredBrief(),
    ...overrides,
  })
}
