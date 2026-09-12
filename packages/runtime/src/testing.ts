import type { Command, FileRefLike } from '@atlas/world'
import type {
  ModelMessage,
  TransportEvents,
  TransportStats,
  TransportStatus,
  Unsubscribe,
  WorldTransport,
} from './transport.ts'

// why: the control loop is the part that must not lag, so tests drive it without webrtc

export type FakeTransport = WorldTransport & {
  sent: Command[]
  uploads: string[]
  names: () => string[]
  emitStatus: (status: TransportStatus) => void
  emitMessage: (type: string, data?: unknown) => void
  emitChunk: (chunkIndex: number) => void
  emitTrack: (name: string) => void
  emitStats: (stats: TransportStats) => void
  emitError: (message: string) => void
  // note: makes the model refuse one command, the way a precondition failure arrives
  refuse: (commandName: string, reason?: string) => void
}

export type FakeTransportOptions = {
  // note: mirrors the real model, which confirms a decoded seed image with image_accepted
  autoAcceptImage?: boolean
}

export function createFakeTransport(options: FakeTransportOptions = {}): FakeTransport {
  const { autoAcceptImage = true } = options
  const sent: Command[] = []
  const uploads: string[] = []
  const refusals = new Map<string, string>()
  const handlers: { [K in keyof TransportEvents]: Set<TransportEvents[K]> } = {
    status: new Set(),
    message: new Set(),
    track: new Set(),
    error: new Set(),
    stats: new Set(),
  }

  let status: TransportStatus = 'disconnected'

  const emitStatus = (next: TransportStatus) => {
    status = next
    for (const handler of handlers.status) handler(next)
  }

  const emitMessage = (type: string, data: unknown = {}) => {
    const message: ModelMessage = { type, data }
    for (const handler of handlers.message) handler(message)
  }

  return {
    sent,
    uploads,
    names: () => sent.map((command) => command.name),
    emitStatus,
    emitMessage,
    emitChunk: (chunkIndex) => emitMessage('chunk_complete', { chunk_index: chunkIndex }),
    // note: jsdom has no MediaStream, and the session only ever passes it through
    emitTrack: (name) => {
      const stream = { id: 'fake-stream' } as unknown as MediaStream
      for (const handler of handlers.track) handler(name, stream)
    },
    emitStats: (stats) => {
      for (const handler of handlers.stats) handler(stats)
    },
    emitError: (message) => {
      for (const handler of handlers.error) handler(new Error(message))
    },
    refuse: (commandName, reason = 'refused by fake') => refusals.set(commandName, reason),
    status: () => status,
    connect: async () => emitStatus('ready'),
    disconnect: async () => emitStatus('disconnected'),
    sendCommand: async (command) => {
      sent.push(command)
      const refusal = refusals.get(command.name)
      if (refusal) {
        return { type: 'command_error', data: { command: command.name, reason: refusal } }
      }
      if (command.name === 'set_image' && autoAcceptImage) {
        emitMessage('image_accepted', { width: 1664, height: 960 })
      }
      return undefined
    },
    uploadFile: async (file, name): Promise<FileRefLike> => {
      uploads.push(name)
      return { uploadId: `upload-${uploads.length}`, name, mimeType: file.type, size: file.size }
    },
    on: <K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): Unsubscribe => {
      handlers[event].add(handler)
      return () => handlers[event].delete(handler)
    },
  }
}
