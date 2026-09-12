import { chromium, webkit, expect, test, type Page } from '@playwright/test'

const base = process.env.ATLAS_WEB_URL ?? 'http://localhost:5173'

async function paperLoaded(page: Page) {
  await expect(page.locator('[data-reader-page]')).toHaveCount(1)
  await expect(page.locator('.paper-world img')).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('.paper-world img')
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  test(`${name}: the desktop reader is a centred paper with no navigation`, async () => {
    const info = test.info()
    const browser = await engine.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      const errors: string[] = []
      const posts: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('request', (request) => {
        if (request.method() === 'POST') posts.push(request.url())
      })
      await page.goto(base)
      await paperLoaded(page)
      await page.evaluate(() => document.fonts.ready)

      // the wordmark is the only chrome; there are no page-turn or menu controls
      await expect(page.getByRole('link', { name: 'Atlas home' })).toBeVisible()
      await expect(page.getByRole('button', { name: /page|menu|event list/i })).toHaveCount(0)
      await expect(page.locator('canvas')).toHaveCount(0)

      // the paper sits in the middle of the viewport, not in the space left over by the rail
      const offset = await page.locator('.reader-paper').evaluate((element) => {
        const box = element.getBoundingClientRect()
        return Math.abs(box.x + box.width / 2 - window.innerWidth / 2)
      })
      expect(offset).toBeLessThan(2)
      await expect(page.locator('.reader-rail')).toBeVisible()
      await expect(page.locator('.reader-strip')).toBeHidden()
      await noHorizontalOverflow(page)
      await page.screenshot({ path: info.outputPath('desktop.png') })

      // the archival scans continue the same vertical scroll instead of becoming pages
      await expect(page.locator('.paper-scan')).toHaveCount(3)
      const scroller = page.locator('.reader-scroll')
      await scroller.evaluate((element) => element.scrollTo({ top: 1200 }))
      await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

      // scrolling the list in the margin opens whatever it lands on, with no second step
      await page.locator('.option-wheel').hover()
      await page.mouse.wheel(0, 300)
      await expect(page.locator('.paper-story h1')).not.toHaveText('Men Walk On Moon')
      await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0)

      // and so does clicking one
      await page.getByRole('option', { name: 'Windrush arrival', exact: true }).click()
      await expect(page.locator('.paper-story h1')).toContainText('Tilbury')
      await paperLoaded(page)
      await noHorizontalOverflow(page)

      expect(errors).toEqual([])
      expect(posts).toEqual([])
    } finally {
      await browser.close()
    }
  })

  test(`${name}: the phone reader keeps the same single column`, async () => {
    const info = test.info()
    const browser = await engine.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(base)
      await paperLoaded(page)
      await expect(page.locator('.reader-rail')).toBeHidden()
      await expect(page.locator('.reader-strip')).toBeVisible()
      await noHorizontalOverflow(page)
      await page.screenshot({ path: info.outputPath('phone.png') })

      await page.getByRole('button', { name: 'Berlin Wall', exact: true }).click()
      await expect(page.locator('.paper-story h1')).toContainText('East Germany')
      await paperLoaded(page)

      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 800 })
        await noHorizontalOverflow(page)
      }
      expect(errors).toEqual([])
    } finally {
      await browser.close()
    }
  })
}
