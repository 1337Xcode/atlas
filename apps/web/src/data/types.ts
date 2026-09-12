import { z } from 'zod'

// note: the reader's journey, in order; every beat belongs to exactly one of these
export const PhaseSchema = z.enum([
  'hub',
  'select',
  'read',
  'ghost',
  'door',
  'world',
  'return',
  'memo',
  'end',
])
export type Phase = z.infer<typeof PhaseSchema>

// why: every asset declares how it was made, so the reader can tell record from reconstruction
export const AssetLayerSchema = z.enum(['deterministic', 'generated', 'synthetic'])

export const AssetSchema = z.object({
  id: z.string(),
  path: z.string(),
  medium: z.string(),
  source: z.string(),
  source_url: z.string().optional(),
  fetched: z.string(),
  fetch_method: z.string(),
  rights: z.string(),
  processing: z.string(),
  layer: AssetLayerSchema,
})
export type Asset = z.infer<typeof AssetSchema>

export const ManifestSchema = z.object({ event: z.string(), assets: z.array(AssetSchema) })
export type Manifest = z.infer<typeof ManifestSchema>

// note: every animated value carries an optional start time and duration, in seconds
const MoveSchema = z.object({ dur: z.number().optional(), at: z.number().optional() })
const move = <T extends z.ZodRawShape>(shape: T) => MoveSchema.extend(shape)

export const PageSchema = z.object({
  src: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  label: z.string(),
  short: z.string().optional(),
  source: z.string(),
  layer: z.string(),
  words: z.string().optional(),
  lines: z.string().optional(),
  syntheticLines: z
    .object({ x: z.number(), w: z.number(), y0: z.number(), y1: z.number(), count: z.number() })
    .optional(),
  hub: z.boolean().optional(),
  selectable: z.boolean().optional(),
  placeholder: z.boolean().optional(),
  memo: z.boolean().optional(),
  slideFrom: z.number().optional(),
})
export type Page = z.infer<typeof PageSchema>

export const BeatSchema = z.object({
  t: z.number(),
  phase: PhaseSchema,
  track: z.boolean().optional(),
  drift: z.boolean().optional(),
  camera: move({ x: z.number().optional(), y: z.number().optional(), z: z.number().optional() })
    .optional(),
  focus: move({ x: z.number().optional(), y: z.number().optional(), radius: z.number().optional() })
    .optional(),
  post: move({
    grain: z.number().optional(),
    vignette: z.number().optional(),
    aberration: z.number().optional(),
  }).optional(),
  warmth: move({ v: z.number() }).optional(),
  letterbox: move({ v: z.number() }).optional(),
  desat: move({ v: z.number() }).optional(),
  bed: move({ v: z.number() }).optional(),
  ghost: move({
    opacity: z.number().optional(),
    scale: z.number().optional(),
    src: z.string().optional(),
  }).optional(),
  world: move({ mix: z.number() }).optional(),
  planes: z
    .record(z.string(), move({ o: z.number().optional(), slide: z.number().optional() }))
    .optional(),
  foley: z
    .array(z.object({ id: z.string(), at: z.number().optional(), until: z.number().optional() }))
    .optional(),
  archive: z
    .array(z.object({ id: z.string(), at: z.number().optional(), until: z.number().optional() }))
    .optional(),
  voice: z
    .object({
      id: z.string(),
      text: z.string(),
      at: z.number().optional(),
      dur: z.number().optional(),
    })
    .optional(),
  // note: null is used to clear a caption, so it is a meaningful value rather than an omission
  caption: z
    .object({ text: z.string(), kind: z.string(), dur: z.number().optional() })
    .nullable()
    .optional(),
  // note: which aligned region of the page to translate, or null to clear the panel
  translate: z.string().nullable().optional(),
  // note: a photograph on a page the camera pushes into
  photo: z
    .object({
      page: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  wire: z
    .object({ time: z.string(), agency: z.string(), text: z.string(), dur: z.number() })
    .optional(),
  objective: z.object({ at: z.number() }).optional(),
  resolved: z.boolean().optional(),
})
export type Beat = z.infer<typeof BeatSchema>

// note: a scripted pause inside the world, each one attributable to a source
export const StopSchema = z.object({
  t: z.number(),
  label: z.string(),
  audio: z.string().optional(),
  voice: z.string(),
  text: z.string(),
})
export type Stop = z.infer<typeof StopSchema>

// note: a rectangle on a page the reader can be shown, with the source that attests it
export const MarkSchema = z.object({
  page: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  label: z.string(),
  source: z.string(),
  from: z.number().optional(),
  provenanceOnly: z.boolean().optional(),
  outline: z.boolean().optional(),
})
export type Mark = z.infer<typeof MarkSchema>

// note: alignment between a page's text and its narration, keyed by region name
// note: `words` is an index range into the page's word boxes, not the words themselves
export const AlignmentSchema = z.object({
  start: z.number(),
  end: z.number().optional(),
  rate: z.number().optional(),
  words: z.tuple([z.number(), z.number()]).optional(),
  match: z.string().optional(),
  page: z.string().optional(),
})
export type Alignment = z.infer<typeof AlignmentSchema>

export const AudioCueSchema = z.object({
  src: z.string(),
  start: z.number().optional(),
  label: z.string().optional(),
  source: z.string().optional(),
})
export type AudioCue = z.infer<typeof AudioCueSchema>

export const ScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  readPage: z.string(),
  columnX: z.number(),
  lineHeight: z.number(),
  pages: z.record(z.string(), PageSchema),
  ghost: z.object({
    src: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    label: z.string(),
    source: z.string(),
    layer: z.string(),
  }),
  world: z.object({
    seed: z.string().nullable(),
    label: z.string(),
    source: z.string(),
    layer: z.string(),
    objective: z.string(),
  }),
  hubCamera: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  marks: z.array(MarkSchema),
  align: z.record(z.string(), AlignmentSchema),
  audio: z.record(z.string(), AudioCueSchema),
  stops: z.array(StopSchema),
  readLines: z.array(z.string()).optional(),
  beats: z.array(BeatSchema),
})
export type Scenario = z.infer<typeof ScenarioSchema>

// note: one historical event as the hub lists it, with the front pages that carry it
export type Cluster = {
  id: string
  label: string
  date: string
  pages: { id: string; title: string; thumb: string }[]
  eventId?: string
}

export type WordBox = {
  w: string
  x: number
  y: number
  width: number
  height: number
  conf: number
  line?: number
}

export type AlignedWord = { w: string; start: number; end: number }
