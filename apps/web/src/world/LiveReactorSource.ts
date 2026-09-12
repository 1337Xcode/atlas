import { FIRST_FRAME_TIMEOUT_MS, type WorldSource } from './WorldSource'
import { FallbackSource } from './FallbackSource'

// note: placeholder. the real world arrives over webrtc through @atlas/runtime, not an http stream
// note: kept so the journey runs end to end before the backend is wired in

type SessionResponse = { sessionId: string; streamUrl: string; fallbackUrl: string }

// fn: resolve once the element has actually painted a frame, not merely started loading
function firstFrame(video: HTMLVideoElement): Promise<HTMLVideoElement> {
  return new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => resolve(video))
      return
    }
    video.addEventListener('playing', () => resolve(video), { once: true })
  })
}

export class LiveReactorSource implements WorldSource {
  video: HTMLVideoElement | null = null
  sessionId: string | null = null
  fallback: FallbackSource | null = null

  async open(seedUrl: string) {
    const response = await fetch('/reactor/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seedUrl }),
    })
    const { sessionId, streamUrl, fallbackUrl } = (await response.json()) as SessionResponse
    this.sessionId = sessionId
    this.fallback = new FallbackSource(fallbackUrl)

    const video = document.createElement('video')
    video.src = streamUrl
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    void video.play().catch(() => undefined)

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('no first frame')), FIRST_FRAME_TIMEOUT_MS)
    })

    try {
      this.video = await Promise.race([firstFrame(video), timeout])
      return this.video
    } catch {
      // why: the reader never waits on a world that is not coming, they get the recorded pass
      video.pause()
      this.video = await this.fallback.open()
      return this.video
    }
  }

  async advance(prompt: string) {
    if (!this.sessionId) return
    await fetch(`/reactor/session/${this.sessionId}/input`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
  }

  close() {
    this.video?.pause()
    this.fallback?.close()
    if (this.sessionId) void fetch(`/reactor/session/${this.sessionId}`, { method: 'DELETE' })
    this.sessionId = null
  }
}
