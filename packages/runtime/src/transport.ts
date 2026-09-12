import type { WorldSessionPlan } from '@atlas/schema'
import type { Command, FileRefLike } from '@atlas/world'
import { Reactor, type ReactorEventMap, type ReactorEventName } from '@reactor-team/js-sdk'

// docs: https://docs.reactor.inc/sdk-reference/reactor-class

export type TransportStatus = 'disconnected' | 'connecting' | 'waiting' | 'ready'

export type ModelMessage = { type: string; data: unknown }

export type TransportStats = {
  rtt: number | undefined
  framesPerSecond: number | undefined
  packetLossRatio: number | undefined
}

export type TransportEvents = {
  status: (status: TransportStatus) => void
  message: (message: ModelMessage) => void
  track: (name: string, stream: MediaStream) => void
  error: (error: Error) => void
  stats: (stats: TransportStats) => void
}

export type Unsubscribe = () => void

// why: the control loop talks to this port, so tests can drive it with a fake
export interface WorldTransport {
  status: () => TransportStatus
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendCommand: (command: Command) => Promise<ModelMessage | undefined>
  uploadFile: (file: Blob, name: string) => Promise<FileRefLike>
  on: <K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]) => Unsubscribe
}

// fn: the live transport, backed by the reactor sdk over webrtc
export function createReactorTransport(plan: WorldSessionPlan): WorldTransport {
  // why: the sdk calls this resolver before every authenticated request, not only connect, and a
  // why: session may only be operated by the token that created it — so it always returns that one
  const reactor = new Reactor({
    modelName: plan.model.slug,
    apiUrl: plan.apiUrl,
    jwt: () => plan.token.jwt,
  })

  const listen = <E extends ReactorEventName>(event: E, handler: ReactorEventMap[E]) => {
    reactor.on(event, handler)
    return () => reactor.off(event, handler)
  }

  const subscribe: { [K in keyof TransportEvents]: (handler: TransportEvents[K]) => Unsubscribe } = {
    status: (handler) => listen('statusChanged', handler),
    message: (handler) => listen('message', handler),
    error: (handler) => listen('error', handler),
    // note: the sdk resolves the track before emitting; the viewport only needs the stream
    track: (handler) => listen('trackReceived', (name, _track, stream) => handler(name, stream)),
    stats: (handler) =>
      listen('statsUpdate', ({ rtt, framesPerSecond, packetLossRatio }) =>
        handler({ rtt, framesPerSecond, packetLossRatio }),
      ),
  }

  return {
    status: () => reactor.getStatus(),
    connect: () => reactor.connect(),
    disconnect: () => reactor.disconnect(),
    sendCommand: (command) => reactor.sendCommand(command.name, command.data),
    uploadFile: (file, name) => reactor.uploadFile(file, { name }),
    on: (event, handler) => subscribe[event](handler),
  }
}
