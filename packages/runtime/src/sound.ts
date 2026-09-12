import type { WorldSoundscape } from '@atlas/schema'

// why: lingbot-world-2 publishes one video track and no audio, so any sound is ours to play
// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema#tracks

// note: the slice of HTMLAudioElement the stage uses, so tests can pass a fake
export type PlayableSound = {
  loop: boolean
  volume: number
  currentTime: number
  play: () => Promise<void> | void
  pause: () => void
}

export type SoundstageOptions = {
  soundscape: WorldSoundscape
  // note: defaults to an Audio element, injected in tests
  create?: (url: string) => PlayableSound
  // note: called when the browser refuses to play until the reader asks for sound
  onBlocked?: () => void
}

export type Soundstage = {
  // fn: start the continuous bed, if the article has one
  start: () => void
  // fn: fire the one-shots for keys that have just been pressed
  setHeldKeys: (keys: readonly string[]) => void
  stop: () => void
  // fn: retry playback from a user gesture after the browser blocked it
  resume: () => void
  hasSound: () => boolean
}

export function createSoundstage(options: SoundstageOptions): Soundstage {
  const { soundscape } = options
  const create = options.create ?? defaultCreate
  const onBlocked = options.onBlocked ?? (() => undefined)

  const bed = soundscape.bed ? create(soundscape.bed.url) : undefined
  if (bed && soundscape.bed) {
    bed.loop = true
    bed.volume = soundscape.bed.gain
  }

  const cues = new Map<string, PlayableSound>(
    soundscape.cues.map((cue) => {
      const sound = create(cue.url)
      sound.volume = cue.gain
      return [cue.key, sound]
    }),
  )

  let held: string[] = []
  let playing = false

  // why: autoplay rules can refuse a sound that did not come straight from a click
  const attempt = (sound: PlayableSound) => {
    try {
      const started = sound.play()
      if (started instanceof Promise) started.catch(onBlocked)
    } catch {
      onBlocked()
    }
  }

  return {
    hasSound: () => bed !== undefined || cues.size > 0,
    start: () => {
      playing = true
      if (bed) attempt(bed)
    },
    setHeldKeys: (keys) => {
      // note: a cue fires on the press edge only, so holding a key does not stutter it
      for (const key of keys) {
        if (held.includes(key)) continue
        const cue = cues.get(key)
        if (!cue || !playing) continue
        cue.currentTime = 0
        attempt(cue)
      }
      held = [...keys]
    },
    resume: () => {
      playing = true
      if (bed) attempt(bed)
    },
    stop: () => {
      playing = false
      held = []
      bed?.pause()
      for (const cue of cues.values()) cue.pause()
    },
  }
}

function defaultCreate(url: string): PlayableSound {
  const audio = new Audio(url)
  audio.preload = 'auto'
  return audio
}
