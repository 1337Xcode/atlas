export interface WorldSource {
  /** Resolves with a playing video element, or rejects if no frame arrived in time. */
  open(seedUrl: string): Promise<HTMLVideoElement>
  advance(prompt: string): Promise<void>
  close(): void
}
export const FIRST_FRAME_TIMEOUT_MS = 1500
