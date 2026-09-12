import { z } from 'zod'

// why: one id format keeps archive filenames, api routes and session ids interchangeable
export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected a kebab-case slug')

export const NonEmptyStringSchema = z.string().trim().min(1)

export type Id = z.infer<typeof IdSchema>
