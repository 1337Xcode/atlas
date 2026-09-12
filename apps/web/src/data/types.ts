import { z } from 'zod';

export const Phase = z.enum(['hub', 'select', 'read', 'ghost', 'door', 'world', 'return', 'memo', 'end']);
export type Phase = z.infer<typeof Phase>;

export const Asset = z.object({
  id: z.string(), path: z.string(), medium: z.string(), source: z.string(), source_url: z.string().optional(),
  fetched: z.string(), fetch_method: z.string(), rights: z.string(), processing: z.string(),
  layer: z.enum(['deterministic', 'generated', 'synthetic']),
});
export type Asset = z.infer<typeof Asset>;
export const Manifest = z.object({ event: z.string(), assets: z.array(Asset) });
export type Manifest = z.infer<typeof Manifest>;

const Move = z.object({ dur: z.number().optional(), at: z.number().optional() });
export const Page = z.object({
  src: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), short: z.string().optional(),
  source: z.string(), layer: z.string(), words: z.string().optional(), lines: z.string().optional(),
  syntheticLines: z.object({ x: z.number(), w: z.number(), y0: z.number(), y1: z.number(), count: z.number() }).optional(),
  hub: z.boolean().optional(), selectable: z.boolean().optional(), placeholder: z.boolean().optional(), memo: z.boolean().optional(), slideFrom: z.number().optional(),
});
export type Page = z.infer<typeof Page>;

export const Beat = z.object({
  t: z.number(), phase: Phase, track: z.boolean().optional(), drift: z.boolean().optional(),
  camera: Move.extend({ x: z.number().optional(), y: z.number().optional(), z: z.number().optional() }).optional(),
  focus: Move.extend({ x: z.number().optional(), y: z.number().optional(), radius: z.number().optional() }).optional(),
  post: Move.extend({ grain: z.number().optional(), vignette: z.number().optional(), aberration: z.number().optional() }).optional(),
  warmth: Move.extend({ v: z.number() }).optional(), letterbox: Move.extend({ v: z.number() }).optional(),
  desat: Move.extend({ v: z.number() }).optional(), bed: Move.extend({ v: z.number() }).optional(),
  ghost: Move.extend({ opacity: z.number().optional(), scale: z.number().optional(), src: z.string().optional() }).optional(),
  world: Move.extend({ mix: z.number() }).optional(),
  planes: z.record(Move.extend({ o: z.number().optional(), slide: z.number().optional() })).optional(),
  foley: z.array(z.object({ id: z.string(), at: z.number().optional(), until: z.number().optional() })).optional(),
  archive: z.array(z.object({ id: z.string(), at: z.number().optional(), until: z.number().optional() })).optional(),
  voice: z.object({ id: z.string(), text: z.string(), at: z.number().optional(), dur: z.number().optional() }).optional(),
  caption: z.object({ text: z.string(), kind: z.string(), dur: z.number().optional() }).optional(),
  wire: z.object({ time: z.string(), agency: z.string(), text: z.string(), dur: z.number() }).optional(),
  objective: z.object({ at: z.number() }).optional(), resolved: z.boolean().optional(),
});
export type Beat = z.infer<typeof Beat>;

export const Stop = z.object({ t: z.number(), label: z.string(), audio: z.string().optional(), voice: z.string(), text: z.string() });
export const Mark = z.object({ page: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), source: z.string(), from: z.number().optional(), provenanceOnly: z.boolean().optional(), outline: z.boolean().optional() });

export const Scenario = z.object({
  id: z.string(), title: z.string(), date: z.string(), readPage: z.string(), columnX: z.number(), lineHeight: z.number(),
  pages: z.record(Page),
  ghost: z.object({ src: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), source: z.string(), layer: z.string() }),
  world: z.object({ seed: z.string().nullable(), label: z.string(), source: z.string(), layer: z.string(), objective: z.string() }),
  hubCamera: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  marks: z.array(Mark), align: z.record(z.any()), audio: z.record(z.string()), stops: z.array(Stop), readLines: z.array(z.string()).optional(),
  beats: z.array(Beat),
});
export type Scenario = z.infer<typeof Scenario>;

export interface Cluster { id: string; label: string; date: string; pages: { id: string; title: string; thumb: string }[]; eventId?: string }
export interface WordBox { w: string; x: number; y: number; width: number; height: number; conf: number; line?: number }
export interface AlignedWord { w: string; start: number; end: number }
