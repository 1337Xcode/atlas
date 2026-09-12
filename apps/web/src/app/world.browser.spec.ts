import { chromium, webkit, expect, test } from '@playwright/test'
import { buildWorldSessionPlan, LINGBOT_WORLD_2 } from '@atlas/world'
import { sampleArticle } from '@atlas/schema/testing'

const base = process.env.ATLAS_WEB_URL ?? 'http://localhost:5173'
const capacity = JSON.stringify({
  error: 'no available capacity: no available servers to handle the request',
})
const plan = buildWorldSessionPlan({
  article: sampleArticle({ id: 'apollo-11-first-steps' }),
  model: LINGBOT_WORLD_2,
  token: { jwt: 'test-token', expiresAt: 1_800_000_000 },
  anchorImageUrl: '/image.jpg',
}).plan

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  // test: one click opens loading in place; leaving cancels the attempt without navigating away
  test(`${name}: a world opens over the paper and one click is one attempt`, async () => {
    const browser = await engine.launch()
    let release = () => {}
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      let requests = 0
      const waiting = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/api/worlds/*', async (route) => {
        requests += 1
        await waiting
        await route
          .fulfill({ status: 429, contentType: 'application/json', body: capacity })
          .catch(() => undefined)
      })
      await page.goto(base)
      const before = page.url()
      const play = page.getByRole('button', { name: 'Explore Apollo 11 in the world viewer' })

      await play.click()
      await expect(page.getByRole('dialog', { name: 'Apollo 11 world' })).toBeVisible()
      await expect(page.getByRole('status')).toContainText('Preparing the world')
      await expect(page.locator('.world-loading-copy')).toContainText('Sea of Tranquillity')
      await expect(page.locator('.reader')).toHaveAttribute('inert', '')
      expect(page.url()).toBe(before)

      // a second and third click while one attempt is in flight must not open another session
      await page.getByRole('dialog').click({ position: { x: 400, y: 400 } })
      await page.getByRole('dialog').click({ position: { x: 400, y: 400 } })
      await expect.poll(() => requests).toBe(1)

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(play).toBeFocused()
      release()

      // and the reader can try again afterwards, with the refusal explained rather than blank
      await play.click()
      await expect(page.getByRole('alert')).toContainText('no free servers')
      await expect.poll(() => requests).toBe(2)
      await page.getByRole('button', { name: 'Exit Esc', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator('[data-reader-page]')).toHaveCount(1)
      expect(errors).toEqual([])
    } finally {
      release()
      await browser.close()
    }
  })

  // test: run the real SDK loader while refusing every provider call, so no GPU is allocated
  test(`${name}: the SDK wasm loads before a handled capacity response`, async () => {
    const browser = await engine.launch()
    try {
      const page = await browser.newPage()
      let creates = 0
      await page.route('**/api/worlds/*', (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan }) }),
      )
      await page.route('https://api.reactor.inc/**', async (route) => {
        const request = route.request()
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/sessions')
          creates += 1
        await route.fulfill({
          status: 429,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
          contentType: 'application/json',
          body: capacity,
        })
      })
      await page.goto(base)
      await page.getByRole('button', { name: 'Explore Apollo 11 in the world viewer' }).click()
      await expect(page.getByRole('alert')).toContainText('no free servers', { timeout: 15_000 })
      expect(creates).toBe(1)
      await expect(page.getByText('reactor-wasm failed to load', { exact: false })).toHaveCount(0)
      await page.getByRole('button', { name: 'Exit Esc', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } finally {
      await browser.close()
    }
  })
}
