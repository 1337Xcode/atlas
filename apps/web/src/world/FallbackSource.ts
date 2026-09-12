import type { WorldSource } from './WorldSource';
export class FallbackSource implements WorldSource {
  video: HTMLVideoElement | null = null;
  constructor(private url: string) {}
  async open() {
    const v = document.createElement('video'); v.src = this.url; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous';
    await v.play(); this.video = v; return v;
  }
  async advance() { /* the fallback is linear and ignores prompts */ }
  close() { this.video?.pause(); this.video = null; }
}
