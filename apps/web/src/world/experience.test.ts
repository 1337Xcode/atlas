import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorldSession } from '@atlas/runtime'
import { createFakeTransport } from '@atlas/runtime/testing'
import { buildWorldSessionPlan, LINGBOT_WORLD_2 } from '@atlas/world'
import { sampleArticle } from '@atlas/schema/testing'
import { editions } from '../data/editions'
import { createExperienceController, type Experience } from './experience'

const edition = editions[0]!
const plan = buildWorldSessionPlan({
  article: sampleArticle(),
  model: LINGBOT_WORLD_2,
  token: { jwt: 'test-token', expiresAt: 1_800_000_000 },
  anchorImageUrl: '/image.jpg',
}).plan
let cleanup = async () => {}
afterEach(async () => {
  await cleanup()
  vi.useRealTimers()
})

// test: the same-page bridge owns request, session and shutdown as one cancellable attempt
describe('experience controller', () => {
  it('does not create a session if the reader exits before the token arrives', async () => {
    let resolvePlan = (_plan: typeof plan) => {}
    const pending = new Promise<typeof plan>((resolve) => {
      resolvePlan = resolve
    })
    const create = vi.fn(createWorldSession)
    const publish = vi.fn()
    const controller = createExperienceController({ publish, load: () => pending, create })
    cleanup = () => controller.close()
    const opening = controller.open(edition)
    await controller.close()
    resolvePlan(plan)
    await opening
    expect(create).not.toHaveBeenCalled()
    expect(publish).toHaveBeenLastCalledWith(undefined)
  })
  it('collapses repeated play clicks into one request and never retries on its own', async () => {
    const load = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('no available capacity'), { status: 429 }))
    let state: Experience | undefined
    const controller = createExperienceController({
      publish: (next) => {
        state = next
      },
      load,
    })
    cleanup = () => controller.close()
    await Promise.all([controller.open(edition), controller.open(edition)])
    expect(load).toHaveBeenCalledTimes(1)
    expect(state?.error).toContain('no free servers')
    await controller.close()
    await controller.open(edition)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it.each(['idle', 'limit'] as const)(
    'closes the in-page viewer at the %s boundary',
    async (reason) => {
      vi.useFakeTimers()
      const transport = createFakeTransport()
      let state: Experience | undefined
      const ended = vi.fn()
      const controller = createExperienceController({
        publish: (next) => {
          state = next
        },
        ended,
        load: async () => plan,
        create: (options) =>
          createWorldSession({
            ...options,
            transport,
            fetchAnchorImage: async () => new Blob(['image']),
          }),
      })
      cleanup = () => controller.close()
      const opening = controller.open(edition)
      await vi.advanceTimersByTimeAsync(3_000)
      await opening
      transport.emitChunk(0)
      if (reason === 'limit') state?.session?.input.press('forward')
      await vi.advanceTimersByTimeAsync(reason === 'idle' ? 61_000 : 121_000)
      expect(ended).toHaveBeenCalledWith(reason)
      expect(state).toBeUndefined()
      expect(transport.status()).toBe('disconnected')
      expect(vi.getTimerCount()).toBe(0)
    },
  )
})
