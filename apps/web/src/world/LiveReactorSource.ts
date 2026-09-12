import { FIRST_FRAME_TIMEOUT_MS, type WorldSource } from './WorldSource';
import { FallbackSource } from './FallbackSource';

/** Opens a session on the local mock server, mounts the stream, and swaps to the fallback with no visible break if no frame arrives within 1500 ms. */
export class LiveReactorSource implements WorldSource {
  video: HTMLVideoElement | null = null; sessionId: string | null = null; fallback: FallbackSource | null = null;
  async open(seedUrl: string) {
    const res = await fetch('/reactor/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seedUrl }) });
    const { sessionId, streamUrl, fallbackUrl } = (await res.json()) as { sessionId: string; streamUrl: string; fallbackUrl: string };
    this.sessionId = sessionId; this.fallback = new FallbackSource(fallbackUrl);
    const v = document.createElement('video'); v.src = streamUrl; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
    const firstFrame = new Promise<HTMLVideoElement>((resolve) => { const onFrame = () => resolve(v); if ('requestVideoFrameCallback' in v) (v as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(onFrame); else v.addEventListener('playing', onFrame, { once: true }); });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('no frame')), FIRST_FRAME_TIMEOUT_MS));
    v.play().catch(() => undefined);
    try { this.video = await Promise.race([firstFrame, timeout]); return this.video; }
    catch { v.pause(); this.video = await this.fallback.open(); return this.video; }
  }
  async advance(prompt: string) { if (!this.sessionId) return; await fetch('/reactor/session/' + this.sessionId + '/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) }); }
  close() { this.video?.pause(); this.fallback?.close(); if (this.sessionId) void fetch('/reactor/session/' + this.sessionId, { method: 'DELETE' }); this.sessionId = null; }
}
