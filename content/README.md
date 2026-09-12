# The archive

One JSON file per article in `articles/`, its images in `images/<article-id>/`.
The filename must match the article `id`. `pnpm test` validates everything in
here, so a broken or unfaithful article fails the build rather than the demo.

## Article fields

| Field        | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `id`         | kebab-case slug, same as the filename                                   |
| `headline`   | as it would be set in the paper                                         |
| `dateline`   | place and date, e.g. `KILL DEVIL HILLS, 17 DECEMBER 1903`               |
| `occurredOn` | ISO date of the event (optional)                                        |
| `nature`     | editorial category, e.g. `exploration`                                  |
| `summary`    | one or two sentences                                                    |
| `body`       | the article itself                                                      |
| `context`    | background a reader needs, plus physical facts the world must respect   |
| `images[]`   | `{ id, src, caption, credit, role }`, exactly one with `role: "anchor"` |
| `sources[]`  | what attests the article; hold-key events point at these by index       |
| `world`      | the scene brief the 3D world is compiled from                           |

The `anchor` image is the seed frame the world model conditions on. Use a real
archival photograph, cropped to 1664x960 (the model's native frame).

## The scene brief

Preferred form is `kind: "scene"` — one slot per prompt layer:

| Field         | Owns                                                                  |
| ------------- | --------------------------------------------------------------------- |
| `viewpoint`   | `first-person` (the reader stands in the event)                       |
| `focus`       | short noun phrase the camera contract centres on, e.g. `gloved hands` |
| `subject`     | what the world is; introduced once, with enough detail to last        |
| `anchors[]`   | 2-4 landmarks, pinned so the model cannot duplicate them              |
| `environment` | surfaces, weather, light                                              |
| `style`       | the photographic look of the period                                   |
| `idle`        | two or three specific micro-motions while the reader stands still     |
| `travel`      | what the ground and surroundings do while the reader walks            |
| `guards[]`    | one clause per known misreading risk                                  |
| `events[]`    | hold-key details, each citing a `sourceIndex`                         |
| `vertical`    | jump / crouch / stand sentences                                       |
| `seed`        | fixed, so the same article renders the same world every time          |

`kind: "prompt"` is the fallback: a free `prompt` plus a `focus`. It works, but
the compiler has to supply generic movement prose and the linter will say so.

## Rules the linter enforces

These come from Reactor's prompt guide and from the fact that this is a history
lesson, not a film. The build fails on an error and reports warnings.

- **Describe what is present, never what is absent.** "An empty street with no
  traffic" puts traffic in the street. Say "the street ahead stays quiet".
- **No camera direction outside the camera layer.** A camera can be an object in
  the scene; it must not be told where to look.
- **No motion verbs in `subject`.** Anything described as moving keeps moving
  after the reader lets go of the key.
- **Pin your landmarks.** 2-4 anchors, each rendered as "EXACTLY ONE ... at a
  fixed position", or the model invents a second one as the reader turns.
- **Events cite a source.** An event whose `sourceIndex` does not exist is an
  error. If a detail is not attested, it does not go in the world.
- **Definite reference in events.** "The mason hammer swings down", never "A
  mason hammer" — a re-introduction spawns a duplicate.
- **No intent qualifiers.** "Make sure", "correctly" and "accurately" are
  invisible to a renderer.
- **Budgets.** The composed prompt is capped by the model (2000 characters on
  `lingbot-world-2`). Keep `subject` + anchors + `environment` + `style` under
  600 together.

## Historical fidelity

The world is generated, so it can only be as accurate as the brief. Two habits
do most of the work:

1. Put the physics in `context` and honour it in the layers. The Apollo brief
   says the sky is black in full sunlight and dust falls in clean arcs, because
   the Moon has no atmosphere.
2. Write only what a source supports, and point each event at that source. The
   reader can see the citation next to the key they are holding.

## Sound

A world may carry an optional `soundscape`. It is optional on purpose: silence is better
than sound we cannot stand behind.

```json
"soundscape": {
  "bed": {
    "id": "air-to-ground-loop",
    "src": "apollo-11-first-steps/air-to-ground-loop.m4a",
    "kind": "archival",
    "caption": "Air to ground radio loop during the lunar surface activity.",
    "credit": "NASA, public domain, stated on the source record",
    "sourceIndex": 0,
    "gain": 0.35
  },
  "cues": [
    {
      "id": "boot-in-regolith",
      "key": "1",
      "src": "apollo-11-first-steps/boot.m4a",
      "kind": "reconstruction",
      "caption": "Reconstructed boot pressing into regolith.",
      "credit": "Reconstruction by the Atlas team",
      "gain": 0.4
    }
  ]
}
```

Files live in `content/audio/<article-id>/`. Keep a bed to 30 to 60 seconds; it loops.

Rules the linter enforces:

- `kind` is `archival` or `reconstruction`. There is no third kind, because there is no
  honest third kind. Music of any sort is refused.
- An `archival` layer must cite a source the article carries. A recording that claims to be
  of the event has to point at the record that says so.
- A `cue` must use a key the scene's `events` already declare, so sound and prompt agree.
- `gain` sits around 0.3 to 0.5. Above 0.8 you get a warning: sound goes under the picture.

Sourcing, in order of preference:

1. An archival recording whose source record states a reuse condition. Check the record, not
   the collection. A file being publicly downloadable is not a licence.
2. A plain reconstruction of ordinary ambience, such as wind, water, crowd murmur or machinery,
   labelled `reconstruction` and credited to whoever made it.
3. Silence. Use it for anything involving mass death unless an archival recording of the exact
   staged moment exists. The Triangle fire and D-Day worlds are silent for this reason.
