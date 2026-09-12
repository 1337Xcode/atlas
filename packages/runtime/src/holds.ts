import type { InputStore } from './input.ts'

// why: keyboard and touch both hold scene events, and the drift cap belongs in one place

export type EventHoldsOptions = {
  input: InputStore
  // note: hold keys the scene declares, so an unbound key does nothing
  eventKeys: readonly string[]
  maxHoldMs: number
  onChange: () => void
}

export type EventHolds = {
  press: (key: string) => boolean
  release: (key: string) => boolean
  releaseAll: () => void
}

export function createEventHolds(options: EventHoldsOptions): EventHolds {
  const { input, eventKeys, maxHoldMs, onChange } = options
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const clear = (key: string) => {
    clearTimeout(timers.get(key))
    timers.delete(key)
  }

  return {
    press: (key) => {
      if (!eventKeys.includes(key)) return false
      input.pressEvent(key)
      // why: long continuous holds accumulate drift, so a hold releases itself and settles
      clear(key)
      timers.set(
        key,
        setTimeout(() => {
          clear(key)
          input.releaseEvent(key)
          onChange()
        }, maxHoldMs),
      )
      return true
    },
    release: (key) => {
      if (!eventKeys.includes(key)) return false
      clear(key)
      input.releaseEvent(key)
      return true
    },
    releaseAll: () => {
      for (const key of [...timers.keys()]) clear(key)
    },
  }
}
