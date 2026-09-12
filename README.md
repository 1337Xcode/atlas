# Atlas

A 3D interactive newspaper for history. Each article carries an archival photograph and a
sourced scene brief; the backend compiles that into a Reactor world the reader can step
into and walk through in first person with `WASD` and the mouse.

This repository is the **backend and the real-time runtime**. The production newspaper UI
is built separately; `apps/wireframe` is a throwaway harness that proves the pipeline.

```
content/*.json  ->  scene compiler  ->  fidelity gate  ->  session plan  ->  browser runtime  ->  Reactor
```

## Running it

```bash
pnpm install
cp .env.example .env        # add your REACTOR_API_KEY (rk_...)
pnpm dev                    # http://localhost:3000
pnpm verify                 # lint, typecheck, 125 tests
```

Open an article, click **enter the world**, then click the frame once to give it the keyboard
and the mouse. A world runs for up to two minutes, warns you at 45 seconds of no input, and
closes itself rather than hold a GPU nobody is watching.

| Control               | Does                                  |
| --------------------- | ------------------------------------- |
| `W` `A` `S` `D`       | walk and strafe                       |
| mouse (click to lock) | look                                  |
| arrow keys            | look, without the mouse               |
| `space` / `C`         | jump / crouch                         |
| `1`–`9`               | hold a sourced event from the article |
| `esc`                 | release the mouse                     |
| expand                | real fullscreen, just the world       |

Keys are read by physical position, so WASD works on any keyboard layout. Pointer lock is used
when the browser grants it, and dragging looks around when it does not.

On a phone, reached by a QR code to the same page, the world shows thumb pads instead: a stick
on the left to walk, a look area on the right, and a button per sourced event. Touch is
detected with `(pointer: coarse)`, not the screen width.

## Packages

| Package          | Responsibility                                                                       |
| ---------------- | ------------------------------------------------------------------------------------ |
| `@atlas/schema`  | zod contracts for articles, scene briefs, sessions and control state                 |
| `@atlas/scene`   | compiles a brief into layered prompts, composes them, lints them for fidelity        |
| `@atlas/archive` | loads and validates the local JSON archive, withholds unservable articles            |
| `@atlas/world`   | Reactor model registry, command vocabularies, token minting, session planning        |
| `@atlas/runtime` | browser control loop: transport, input, camera pose, chunk clock, touch, React hooks |
| `@atlas/ingest`  | optional side channel: post an article, or draft one from a news URL                 |
| `apps/wireframe` | Next.js test harness (replaceable)                                                   |

## API

| Route                       | Does                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `GET /api/articles`         | the servable archive, plus any withheld files and why         |
| `POST /api/worlds/[id]`     | mints a scoped Reactor token and returns a `WorldSessionPlan` |
| `GET /api/images/[...path]` | serves archive images, including the anchor frame             |
| `POST /api/ingest`          | optional; off unless `ATLAS_INGEST_ENABLED=true`              |

Using the runtime from another frontend:

```tsx
const { session, snapshot } = useWorldSession(plan, { autoStart: true })
const bindVideo = useWorldViewport(session)
const bindSurface = useWorldControls(session, plan)

<div ref={bindSurface} tabIndex={0}>
  <video ref={bindVideo} muted playsInline autoPlay />
</div>
```

## How it stays true to history

The world is generated, so accuracy has to be engineered rather than hoped for:

- Every world is **anchored on a real archival photograph**, cropped to the model's native
  1664×960 frame, with its licence and credit preserved.
- Prompts are **compiled from structured briefs**, not hand-written strings, with landmarks
  pinned by explicit count and camera behaviour bound to reader input.
- A **fidelity linter** blocks absence phrasing, camera direction outside the camera layer,
  over-budget prompts and any hold-key event that cannot cite a source. `pnpm test` fails
  if the shipped archive produces so much as a warning.
- Sensitive events carry a **content note** stating what the world deliberately does not
  stage. The Triangle fire world is the mourning march ten days later; the D-Day world is
  the airfield the evening before.
- Seeds are fixed, so the same article renders the same world every time.

See `docs/spec.md` for scope, `docs/decisions/` for why each choice was made, `AGENTS.md`
for the coding standards, and `content/README.md` for how to author an article.
