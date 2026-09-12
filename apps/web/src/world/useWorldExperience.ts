import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Edition } from '../data/editions'
import { createExperienceController, type Experience } from './experience'

// fn: bridge React to the session owner without opening anything from an effect
export function useWorldExperience() {
  const [experience, setExperience] = useState<Experience>()
  const [notice, setNotice] = useState('')
  const controller = useMemo(
    () =>
      createExperienceController({
        publish: setExperience,
        ended: (reason) => {
          setNotice(
            reason === 'limit'
              ? 'The world closed at its two-minute limit.'
              : reason === 'idle'
                ? 'The world closed after a minute without input.'
                : '',
          )
          if (document.pointerLockElement) document.exitPointerLock()
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>('.world-play-button')
              ?.focus({ preventScroll: true }),
          )
        },
      }),
    [],
  )
  const close = useCallback(() => {
    void controller.close()
  }, [controller])
  const open = useCallback(
    (edition: Edition) => {
      if (controller.active()) return
      setNotice('')
      void controller.open(edition)
      // feat: request fullscreen during the original play gesture, before awaiting the token
      if (
        typeof document.documentElement.requestFullscreen === 'function' &&
        !document.fullscreenElement
      ) {
        void document.documentElement
          .requestFullscreen()
          .then(() => {
            if (!controller.active()) void document.exitFullscreen().catch(() => undefined)
          })
          .catch(() => undefined)
      }
    },
    [controller],
  )
  useEffect(() => {
    window.addEventListener('pagehide', close)
    return () => {
      window.removeEventListener('pagehide', close)
      void controller.close()
    }
  }, [controller, close])
  return { experience, notice, open, close }
}
