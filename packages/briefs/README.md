# @atlas/briefs

Turns one newspaper article into a sourced event brief. Imported from the `data` branch of the
handoff repo and wired into this workspace.

The design worth preserving: **two schemas on purpose.** `composedBriefSchema` is what the model
is allowed to write, which is prose only, no URLs and no licences. Everything checkable, meaning
sources, images and provenance, is attached afterwards from the search results. A citation can
therefore never be invented.

## Running it

```bash
pnpm --filter @atlas/briefs brief <article url or image path>
```

Needs `OPENAI_API_KEY` and `TAVILY_API_KEY` in the root `.env`. Without them the pipeline
refuses to start rather than guessing.

## Changes made on import

- Tests converted from `node:test` to vitest, so `pnpm verify` covers them (29 tests).
- An `index.ts` public surface, so the rest of the workspace imports from one place.
- `describeCause` instead of stringifying an unknown `cause` into `[object Object]`.
- Pinned to the workspace's zod version.

## Relationship to the rest of the repo

This writes briefs. `content/articles/*.json` is what the backend actually serves, and
`@atlas/scene` compiles those into prompts and lints them for fidelity. The two are not yet
connected: a brief still has to be turned into an article by hand. That seam is deliberate, so
nothing reaches a reader without a person reading it first.
