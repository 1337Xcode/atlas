# @atlas/briefs

Turns one newspaper article into a sourced event brief.

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

## Relationship to the rest of the repo

This writes briefs. `content/articles/*.json` is what the API actually serves, and
`@atlas/scene` compiles those into prompts and lints them for fidelity. The two are not
connected on purpose: a brief still has to be turned into an article by hand, so nothing reaches
a reader without a person reading it first.
