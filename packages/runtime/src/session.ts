import { composePrompt } from '@atlas/scene'
import type { WorldSessionPlan } from '@atlas/schema'
import { getWorldModel, planCommands, type Command, type WireState } from '@atlas/world'
import { createInputStore, type InputStore } from './input.ts'
import { createLifecycleGuard } from './lifecycle.ts'
import { readModelMessage, type ModelEvent } from './messages.ts'
import { buildCameraPose } from './pose.ts'
import { createSoundstage, type PlayableSound } from './sound.ts'
import { stageWorld } from './staging.ts'
import { createSessionStore, type SessionEndReason, type SessionSnapshot } from './store.ts'
import { createReactorTransport, type Unsubscribe, type WorldTransport } from './transport.ts'

export type CreateWorldSessionOptions = {
  plan: WorldSessionPlan
  transport?: WorldTransport
  fetchAnchorImage?: (url: string) => Promise<Blob>
  // note: injected in tests, so the control loop can be driven without an audio device
  createSound?: (url: string) => PlayableSound
}

export interface WorldSession {
  input: InputStore
  snapshot: () => SessionSnapshot
  subscribe: (listener: (snapshot: SessionSnapshot) => void) => Unsubscribe
  start: () => Promise<void>
  stop: (reason?: SessionEndReason) => Promise<void>
  // feat: re-stage from a clean frame, the documented cure for a world that has drifted
  restage: () => Promise<void>
  attachVideo: (element: HTMLVideoElement | null) => void
  // note: input bindings call this so a press lands without waiting for the chunk clock
  nudge: () => void
  // note: any input at all, including mouse movement, so the idle timer stays honest
  markActivity: () => void
  // feat: let the reader turn the archive sound on after the browser blocked it
  resumeSound: () => void
}

// why: a world that never reports a first chunk is a gpu we are paying for and nobody can see
const FIRST_CHUNK_TIMEOUT_MS = 25_000

// fn: run one world — stage it, keep its inputs on the wire, and report what it is doing
export function createWorldSession(options: CreateWorldSessionOptions): WorldSession {
  const { plan } = options
  const model = getWorldModel(plan.model.id)
  const transport = options.transport ?? createReactorTransport(plan)
  const fetchAnchorImage = options.fetchAnchorImage ?? fetchImage
  const input = createInputStore()
  const store = createSessionStore(transport.status())
  const usePose = plan.capabilities.look.mode === 'camera-pose'

  const soundstage = createSoundstage({
    soundscape: plan.soundscape,
    ...(options.createSound ? { create: options.createSound } : {}),
    onBlocked: () => store.update({ audioBlocked: true }),
  })

  const idleWire = (): WireState => ({
    intent: input.intent(plan.scene.rotationSpeedDeg),
    pose: null,
    prompt: '',
  })

  let acked: WireState = idleWire()
  let heldSignature = ''
  let flushing = false
  let pendingFlush = false
  let warmupTimer: ReturnType<typeof setTimeout> | undefined
  let stream: MediaStream | undefined
  let video: HTMLVideoElement | null = null
  const subscriptions: Unsubscribe[] = []

  const send = async (command: Command): Promise<ModelEvent | undefined> => {
    const reply = await transport.sendCommand(command)
    const event = reply ? readModelMessage(reply) : undefined
    // why: sendCommand never rejects — a refused command comes back as a command_error reply
    if (event?.kind === 'command-error') store.notice(`${event.command}: ${event.reason}`)
    return event
  }

  const nextWireState = (): WireState => {
    const intent = input.intent(plan.scene.rotationSpeedDeg)
    const scene = input.sceneInput()
    const pose = usePose
      ? buildCameraPose({
          look: input.consumeLook(),
          lookHorizontal: intent.lookHorizontal,
          lookVertical: intent.lookVertical,
          jumpLatents: input.jumpLatents(plan.capabilities.chunkLatents),
          crouchDip: input.consumeCrouchDip(),
          latents: plan.capabilities.chunkLatents,
          settings: plan.controls,
        })
      : null
    return { intent, pose, prompt: composePrompt(plan.scene, scene) }
  }

  // why: engaging or releasing an event is a hard prompt cut, so stale context is flushed
  const driftGuard = (): Command[] => {
    const signature = input.heldEventKeys().join(',')
    if (signature === heldSignature) return []
    heldSignature = signature
    soundstage.setHeldKeys(input.heldEventKeys())
    const trigger = model.commands.triggerKvCacheReset
    return trigger ? [trigger()] : []
  }

  // perf: one batch in flight at a time, coalescing everything that happened meanwhile
  const flush = async () => {
    if (store.snapshot().phase !== 'live') return
    if (flushing) {
      pendingFlush = true
      return
    }

    flushing = true
    try {
      do {
        pendingFlush = false
        const next = nextWireState()
        const commands = [...planCommands(model, acked, next), ...driftGuard()]
        if (commands.length === 0) continue

        let rejected = false
        for (const command of commands) {
          if ((await send(command))?.kind === 'command-error') rejected = true
        }
        // why: leaving the acked state stale makes the next flush retry the same diff
        if (!rejected) acked = next

        store.update({
          prompt: next.prompt,
          moving: next.intent.longitudinal !== 'idle' || next.intent.lateral !== 'idle',
          heldEventKeys: input.heldEventKeys(),
        })
      } while (pendingFlush)
    } finally {
      flushing = false
    }
  }

  const guard = createLifecycleGuard({
    idleWarningMs: plan.controls.idleWarningMs,
    idleStopMs: plan.controls.idleStopMs,
    maxSessionMs: plan.controls.maxSessionMs,
    onCountdown: (countdown) => store.update({ countdown }),
    onExpire: (reason) => void closeSession(reason),
  })

  const goLive = () => {
    clearTimeout(warmupTimer)
    warmupTimer = undefined
    store.update({ phase: 'live' })
    // why: billing starts at the first frame, so the clock on an unattended world starts here too
    guard.begin()
    // note: the bed comes in with the picture, never before it
    soundstage.start()
  }

  // fn: release the gpu and say why, so the ui can offer the right way back in
  const closeSession = async (reason: SessionEndReason) => {
    if (store.snapshot().phase === 'closed') return
    guard.dispose()
    soundstage.stop()
    clearTimeout(warmupTimer)
    input.clear()
    store.update({ phase: 'closed', endedReason: reason, countdown: null })
    await transport.disconnect().catch(() => undefined)
  }

  const onEvent = (event: ModelEvent) => {
    switch (event.kind) {
      case 'chunk-complete':
        // note: chunk_complete is the model's own clock for everything chunk-granular
        input.advanceJump(plan.capabilities.chunkLatents)
        store.update({ chunkIndex: event.chunkIndex })
        if (store.snapshot().phase === 'warming') goLive()
        void flush()
        break
      case 'generation-reset':
        input.clear()
        acked = idleWire()
        break
      case 'command-error':
        store.notice(`${event.command}: ${event.reason}`)
        break
      default:
        break
    }
  }

  const waitFor = (kind: ModelEvent['kind'], timeoutMs: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        off()
        resolve()
      }, timeoutMs)
      const off = transport.on('message', (message) => {
        if (readModelMessage(message).kind !== kind) return
        clearTimeout(timer)
        off()
        resolve()
      })
    })

  const stage = async () => {
    store.update({ phase: 'staging', error: undefined })

    const prompt = await stageWorld({
      plan,
      model,
      input,
      send,
      waitFor,
      delay,
      uploadAnchorImage: async () => {
        const blob = await fetchAnchorImage(plan.anchorImage.url)
        return transport.uploadFile(blob, `${plan.articleId}-anchor`)
      },
    })

    acked = { ...idleWire(), prompt }
    heldSignature = input.heldEventKeys().join(',')
    store.update({ phase: 'warming', prompt })
    // why: rather than hold a gpu that is producing nothing, close it and let the reader retry
    warmupTimer = setTimeout(() => {
      store.update({ error: 'the world did not start generating, so it was closed' })
      void closeSession('failed')
    }, FIRST_CHUNK_TIMEOUT_MS)
  }

  const bindVideo = () => {
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => undefined)
  }

  const attach = () => {
    subscriptions.push(
      transport.on('status', (status) => store.update({ status })),
      transport.on('message', (message) => onEvent(readModelMessage(message))),
      transport.on('stats', (stats) => store.update({ stats })),
      transport.on('error', (error) => store.notice(error.message)),
      transport.on('track', (name, received) => {
        if (name !== 'main_video') return
        stream = received
        bindVideo()
      }),
      ...pageLifecycle(),
    )
  }

  // why: a closed tab or a laptop lid would otherwise leave a gpu running until the server cap
  const pageLifecycle = (): Unsubscribe[] => {
    if (typeof document === 'undefined') return []

    const onHide = () => void closeSession('user')
    const onVisibility = () => guard.setHidden(document.visibilityState === 'hidden')

    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return [
      () => window.removeEventListener('pagehide', onHide),
      () => document.removeEventListener('visibilitychange', onVisibility),
    ]
  }

  return {
    input,
    nudge: () => {
      guard.markActivity()
      void flush()
    },
    markActivity: guard.markActivity,
    resumeSound: () => {
      store.update({ audioBlocked: false })
      soundstage.resume()
    },
    snapshot: store.snapshot,
    subscribe: store.subscribe,
    attachVideo: (element) => {
      video = element
      bindVideo()
    },
    start: async () => {
      const phase = store.snapshot().phase
      // why: a second start would open a second gpu session for the same reader
      if (phase !== 'idle') return
      attach()
      try {
        store.update({ phase: 'connecting' })
        await transport.connect()
        await stage()
      } catch (cause) {
        // why: a failed world shows a reason and releases the gpu, it never takes the page down
        store.update({ phase: 'error', error: describe(cause) })
        await transport.disconnect().catch(() => undefined)
      }
    },
    restage: async () => {
      try {
        input.clear()
        acked = idleWire()
        await send(model.commands.lifecycle('reset'))
        await delay(plan.controls.resetSettleMs)
        await stage()
      } catch (cause) {
        store.update({ phase: 'error', error: describe(cause) })
      }
    },
    stop: async (reason = 'user') => {
      await closeSession(reason)
      for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    },
  }
}

async function fetchImage(url: string): Promise<Blob> {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`anchor image request failed: ${response.status}`)
  return response.blob()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
