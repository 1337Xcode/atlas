import { composePrompt } from '@atlas/scene'
import { IDLE_CONTROL_INTENT, type WorldSessionPlan } from '@atlas/schema'
import { getWorldModel, planCommands, type Command, type WireState } from '@atlas/world'
import { createInputStore, type InputStore } from './input.ts'
import { createLifecycleGuard } from './lifecycle.ts'
import { describeSessionError } from './session-error.ts'
import { readModelMessage, type ModelEvent } from './messages.ts'
import { buildCameraPose } from './pose.ts'
import { stageWorld } from './staging.ts'
import { createSessionStore, type SessionEndReason, type SessionSnapshot } from './store.ts'
import { createReactorTransport, type Unsubscribe, type WorldTransport } from './transport.ts'

export type CreateWorldSessionOptions = {
  plan: WorldSessionPlan
  transport?: WorldTransport
  fetchAnchorImage?: (url: string) => Promise<Blob>
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
}

// why: video arriving is proof the world works, so the controls unlock on it even with no chunk report
// note: short, because the model only drops input for its first moments
const VIDEO_WARMUP_MS = 2_500

// why: a command the model keeps refusing must not be resent forever
const MAX_REFUSAL_RETRIES = 2

// fn: trust the model's own report of an axis, falling back to what we believed
function axis<T extends string>(reported: string | undefined, believed: T): T {
  return reported === undefined ? believed : (reported as T)
}

// why: no video at all means a gpu we are paying for that nobody can see, so it is released
const NO_VIDEO_TIMEOUT_MS = 40_000

// fn: run one world — stage it, keep its inputs on the wire, and report what it is doing
export function createWorldSession(options: CreateWorldSessionOptions): WorldSession {
  const { plan } = options
  const model = getWorldModel(plan.model.id)
  const transport = options.transport ?? createReactorTransport(plan)
  const abort = new AbortController()
  const fetchAnchorImage =
    options.fetchAnchorImage ?? ((url: string) => fetchImage(url, abort.signal))
  const input = createInputStore()
  const store = createSessionStore(transport.status())
  const usePose = plan.capabilities.look.mode === 'camera-pose'

  // note: what the model knows before we tell it anything, so a diff from here sends everything
  const blankWire = (): WireState => ({
    intent: { ...IDLE_CONTROL_INTENT, rotationSpeedDeg: plan.scene.rotationSpeedDeg },
    pose: null,
    prompt: '',
  })

  let acked: WireState = blankWire()
  let heldSignature = ''
  // note: a flag rather than a mutation, so a refusal cannot be overwritten by the flush that caused it
  let resendAll = false
  const refusalCounts = new Map<string, number>()
  let flushing = false
  let pendingFlush = false
  let warmupTimer: ReturnType<typeof setTimeout> | undefined
  let stream: MediaStream | undefined
  let video: HTMLVideoElement | null = null
  let videoWarmupTimer: ReturnType<typeof setTimeout> | undefined
  const subscriptions: Unsubscribe[] = []
  let releasePromise: Promise<void> | undefined
  let controlClock: ReturnType<typeof setInterval> | undefined
  let lastChunkAt = Date.now()
  // fix: every asynchronous staging step checks whether the reader has already left
  const ensureOpen = () => abort.signal.throwIfAborted()

  // fn: send and wait for the model's own reply, used while staging where each step is confirmed
  const send = async (command: Command): Promise<ModelEvent | undefined> => {
    ensureOpen()
    const reply = await transport.sendCommand(command)
    ensureOpen()
    const event = reply ? readModelMessage(reply) : undefined
    // why: sendCommand never rejects — a refused command comes back as a command_error reply
    if (event?.kind === 'command-error') store.notice(`${event.command}: ${event.reason}`)
    return event
  }

  // perf: the input path never waits on a reply round trip, it fires and reads errors from the event stream
  // docs: a call site that never awaits sendCommand fires and moves on, and it never rejects
  const dispatch = (command: Command) => {
    void transport.sendCommand(command)
  }

  const nextWireState = (): WireState => {
    const intent = input.intent(plan.scene.rotationSpeedDeg)
    const scene = input.sceneInput()
    // note: the most pixels one chunk can turn, so the rest waits for the next chunk
    const lookBudgetPx = plan.controls.maxRotationPerLatentRad / plan.controls.lookSensitivity
    const pose = usePose
      ? buildCameraPose({
          look: input.consumeLook({ dxPx: lookBudgetPx, dyPx: lookBudgetPx }),
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
    const trigger = model.commands.triggerKvCacheReset
    return trigger ? [trigger()] : []
  }

  // perf: diff current intent once per flush without awaiting control replies
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
        // why: after a refusal the model's real state is unknown, so everything is re-diffed once
        const previous = resendAll ? blankWire() : acked
        resendAll = false
        const commands = [...planCommands(model, previous, next), ...driftGuard()]
        if (commands.length === 0) continue

        // perf: one pass, no awaits, so a keypress reaches the wire in the same tick
        for (const command of commands) dispatch(command)
        acked = next

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
    isActive: () => {
      if (store.snapshot().phase !== 'live') return true
      const intent = input.intent(plan.scene.rotationSpeedDeg)
      return (
        input.sceneInput().moving ||
        intent.lookHorizontal !== 'idle' ||
        intent.lookVertical !== 'idle' ||
        input.sceneInput().vertical !== 'stand'
      )
    },
    onCountdown: (countdown) => store.update({ countdown }),
    onExpire: (reason) => void closeSession(reason),
  })

  const goLive = () => {
    if (abort.signal.aborted || store.snapshot().phase === 'live') return
    clearTimeout(warmupTimer)
    clearTimeout(videoWarmupTimer)
    warmupTimer = undefined
    videoWarmupTimer = undefined
    store.update({ phase: 'live' })
    // why: start the interaction timeout when the controls become available
    guard.begin()
    guard.markActivity()
    // fix: late chunk notifications must not leave mouse rotation latched indefinitely
    lastChunkAt = Date.now()
    controlClock = setInterval(() => {
      if (Date.now() - lastChunkAt >= plan.capabilities.chunkMs * 2) {
        input.advanceJump(plan.capabilities.chunkLatents)
        void flush()
      }
    }, plan.capabilities.chunkMs)
  }

  // fn: stop every clock and hand the gpu back, whatever the outcome was
  const releaseGpu = () => {
    if (releasePromise) return releasePromise
    abort.abort()
    guard.dispose()
    clearTimeout(warmupTimer)
    clearTimeout(videoWarmupTimer)
    clearInterval(controlClock)
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    input.clear()
    if (video) {
      video.pause()
      video.srcObject = null
    }
    stream = undefined
    releasePromise = transport.disconnect().then(
      () => {
        store.update({ status: 'disconnected' })
      },
      (cause: unknown) => {
        store.notice(describeSessionError(cause))
      },
    )
    return releasePromise
  }

  // fn: release the gpu and say why, so the ui can offer the right way back in
  const closeSession = async (reason: SessionEndReason) => {
    if (store.snapshot().phase === 'closed') return releaseGpu()
    store.update({ phase: 'closed', endedReason: reason, countdown: null })
    await releaseGpu()
  }

  const onEvent = (event: ModelEvent) => {
    switch (event.kind) {
      case 'chunk-complete':
        lastChunkAt = Date.now()
        // note: chunk_complete is the model's own clock for everything chunk-granular
        input.advanceJump(plan.capabilities.chunkLatents)
        store.update({ chunkIndex: event.chunkIndex })
        if (store.snapshot().phase === 'warming') goLive()
        void flush()
        break
      case 'generation-reset':
        input.clear()
        acked = blankWire()
        break
      // docs: state is the authoritative snapshot, so our belief about the wire is corrected from it
      // why: a command the model never applied would otherwise desync us forever, and w would stop working
      case 'state': {
        const { inputs } = event
        acked = {
          intent: {
            longitudinal: axis(inputs.longitudinal, acked.intent.longitudinal),
            lateral: axis(inputs.lateral, acked.intent.lateral),
            lookHorizontal: axis(inputs.lookHorizontal, acked.intent.lookHorizontal),
            lookVertical: axis(inputs.lookVertical, acked.intent.lookVertical),
            rotationSpeedDeg: inputs.rotationSpeedDeg ?? acked.intent.rotationSpeedDeg,
          },
          // note: the model reports only whether a pose is active, so an active one is left alone
          pose: inputs.cameraPoseActive === false ? null : acked.pose,
          prompt: inputs.prompt ?? acked.prompt,
        }
        break
      }
      case 'command-error': {
        store.notice(`${event.command}: ${event.reason}`)
        const refused = (refusalCounts.get(event.command) ?? 0) + 1
        refusalCounts.set(event.command, refused)
        // why: re-open the diff so the next tick resends, and give up rather than loop forever
        if (refused <= MAX_REFUSAL_RETRIES) resendAll = true
        break
      }
      default:
        break
    }
  }

  // fn: resolve on confirmation, timeout or cancellation and release every listener
  const waitFor = (kind: ModelEvent['kind'], timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      if (abort.signal.aborted) {
        resolve(false)
        return
      }
      const finish = (confirmed: boolean) => {
        clearTimeout(timer)
        off()
        abort.signal.removeEventListener('abort', cancelled)
        resolve(confirmed)
      }
      const cancelled = () => finish(false)
      const timer = setTimeout(cancelled, timeoutMs)
      const off = transport.on('message', (message) => {
        if (readModelMessage(message).kind === kind) finish(true)
      })
      abort.signal.addEventListener('abort', cancelled, { once: true })
    })

  const stage = async () => {
    ensureOpen()
    store.update({ phase: 'staging', error: undefined })

    const prompt = await stageWorld({
      plan,
      model,
      input,
      send,
      waitFor,
      delay: (ms) => delay(ms, abort.signal),
      uploadAnchorImage: async () => {
        ensureOpen()
        const blob = await fetchAnchorImage(plan.anchorImage.url)
        ensureOpen()
        return transport.uploadFile(blob, `${plan.articleId}-anchor`)
      },
    })

    ensureOpen()
    acked = { ...blankWire(), prompt }
    heldSignature = input.heldEventKeys().join(',')
    store.update({ phase: 'warming', prompt })
    // why: a world with no video at all is worth nothing and still costs, so it is released
    warmupTimer = setTimeout(() => {
      if (stream) return
      store.update({ error: 'the world never sent any video, so it was closed' })
      void closeSession('failed')
    }, NO_VIDEO_TIMEOUT_MS)
    scheduleVideoWarmup()
  }

  // fix: a track may arrive during connection, before the staging phase completes
  const scheduleVideoWarmup = () => {
    if (!stream || store.snapshot().phase !== 'warming' || videoWarmupTimer) return
    videoWarmupTimer = setTimeout(() => {
      if (store.snapshot().phase !== 'warming') return
      store.notice('controls unlocked from the video stream')
      goLive()
    }, VIDEO_WARMUP_MS)
  }

  const bindVideo = () => {
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => undefined)
  }

  const attach = () => {
    subscriptions.push(
      transport.on('status', (status) => {
        store.update({ status })
        if (status === 'ready') guard.begin()
        if (status === 'disconnected' && store.snapshot().phase === 'live') {
          store.update({ error: 'The world connection ended.' })
          void closeSession('failed')
        }
      }),
      transport.on('message', (message) => onEvent(readModelMessage(message))),
      transport.on('stats', (stats) => store.update({ stats })),
      transport.on('error', (error) => store.notice(describeSessionError(error))),
      transport.on('track', (name, received) => {
        if (name !== 'main_video') return
        stream = received
        bindVideo()
        // why: some sessions stream before they report a chunk, and the reader should still walk
        scheduleVideoWarmup()
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
        if (abort.signal.aborted) {
          await transport.disconnect()
          return
        }
        await stage()
      } catch (cause) {
        // why: a failed world names the reason and releases the gpu, it never takes the page down
        if (abort.signal.aborted) return
        store.update({ phase: 'error', error: describeSessionError(cause), endedReason: 'failed' })
        await releaseGpu()
      }
    },
    restage: async () => {
      if (abort.signal.aborted || store.snapshot().phase !== 'live') return
      try {
        input.clear()
        acked = blankWire()
        await send(model.commands.lifecycle('reset'))
        await delay(plan.controls.resetSettleMs, abort.signal)
        await stage()
      } catch (cause) {
        if (abort.signal.aborted) return
        store.update({ phase: 'error', error: describeSessionError(cause) })
        await releaseGpu()
      }
    },
    stop: async (reason = 'user') => {
      await closeSession(reason)
      for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
    },
  }
}

async function fetchImage(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { cache: 'force-cache', signal })
  if (!response.ok) throw new Error(`anchor image request failed: ${response.status}`)
  return response.blob()
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}
