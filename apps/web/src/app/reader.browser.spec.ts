import { chromium, webkit, expect, test, type Page } from '@playwright/test'

const base = process.env.ATLAS_WEB_URL ?? 'http://localhost:5173'

async function loaded(page: Page) {
  await expect(page.locator('[data-reader-page]')).toHaveCount(1)
  await expect(page.locator('[data-reader-page] img')).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('[data-reader-page] img')
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}

// test: the supplied play control must stay centered on the photograph at every viewport
async function centeredPlay(page: Page) {
  const image = await page.locator('.paper-world img').boundingBox()
  const button = await page
    .getByRole('link', { name: 'Explore Apollo 11 in the world viewer' })
    .boundingBox()
  if (!image || !button) throw new Error('The photograph or play control did not render')
  expect(Math.abs(button.x + button.width / 2 - image.x - image.width / 2)).toBeLessThan(2)
  expect(Math.abs(button.y + button.height / 2 - image.y - image.height / 2)).toBeLessThan(2)
  expect(button.width).toBeGreaterThanOrEqual(60)
  await expect(page.getByText('History, in perspective.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('The interactive history collection', { exact: true })).toHaveCount(0)
}

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  test(`${name}: desktop reader, wheel, swipe, and no overlapping layers`, async () => {
    const info = test.info()
    const browser = await engine.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
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
      await loaded(page)
      await centeredPlay(page)
      await page.locator('.paper-world').hover()
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page
          .locator('.reader-header')
          .evaluate((element) => getComputedStyle(element).fontFamily),
      ).toContain('Geist')
      await expect(page.getByRole('searchbox')).toHaveCount(0)
      await expect(page.getByPlaceholder('Search by headline or date')).toHaveCount(0)
      await expect(page.locator('canvas')).toHaveCount(0)
      const sidebar = await page.locator('.reader-sidebar').boundingBox()
      const main = await page.locator('.reader-main').boundingBox()
      expect(sidebar && main && sidebar.x + sidebar.width <= main.x + 1).toBeTruthy()
      await noHorizontalOverflow(page)
      await page.screenshot({ path: info.outputPath('desktop.png') })
      await page.getByRole('button', { name: 'Next page', exact: true }).click()
      await loaded(page)
      await expect(page.locator('.scan-heading h2')).toHaveText('Canberra Times, 22 Jul 1969')
      const surface = page.locator('.reader-surface')
      await surface.hover()
      await page.mouse.wheel(120, 0)
      await loaded(page)
      await expect(page.locator('.scan-heading h2')).toHaveText('Washington Post A1, 21 Jul 1969')
      await surface.focus()
      await page.keyboard.press('ArrowLeft')
      await expect(page.locator('.scan-heading h2')).toHaveText('Canberra Times, 22 Jul 1969')
      await page.getByRole('button', { name: 'Enlarge', exact: true }).click()
      await expect(surface).toHaveAttribute('data-zoomed', 'true')
      await page.getByRole('button', { name: 'Fit width', exact: true }).click()
      await page.getByRole('listbox').focus()
      await page.keyboard.press('ArrowDown')
      await page.getByRole('button', { name: 'Read this edition' }).click()
      await expect(page.locator('.reader-edition-title h2')).toHaveText('Berlin Wall')
      await loaded(page)
      await noHorizontalOverflow(page)
      for (let i = 2; i < 10; i++) {
        await page.getByRole('listbox').focus()
        await page.keyboard.press('ArrowDown')
        await page.getByRole('button', { name: 'Read this edition' }).click()
        await loaded(page)
        await expect(page.locator('.page-count')).toHaveText('1 / 1')
      }
      await expect(page.locator('.reader-edition-title h2')).toHaveText('Windrush arrival')
      expect(errors).toEqual([])
      expect(posts).toEqual([])
    } finally {
      await browser.close()
    }
  })

  test(`${name}: phone menu replaces paper, touch swipe and resize`, async () => {
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
      await loaded(page)
      await centeredPlay(page)
      await page.screenshot({ path: info.outputPath('phone.png') })
      await page.getByRole('button', { name: 'Events', exact: true }).click()
      await expect(page.locator('.reader-main')).toBeHidden()
      await expect(page.getByRole('listbox')).toBeVisible()
      await expect(page.getByRole('listbox')).toBeFocused()
      await noHorizontalOverflow(page)
      await page.screenshot({ path: info.outputPath('phone-menu.png') })
      await page.keyboard.press('ArrowDown')
      await page.getByRole('button', { name: 'Read this edition' }).click()
      await expect(page.locator('.reader-edition-title h2')).toHaveText('Berlin Wall')
      await expect(page.locator('.reader-sidebar')).toBeHidden()
      const surface = page.locator('.reader-surface')
      await surface.dispatchEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        clientX: 300,
        clientY: 200,
      })
      await surface.dispatchEvent('pointerup', {
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        clientX: 80,
        clientY: 200,
      })
      await expect(page.locator('.scan-heading h2')).toHaveText('Neues Deutschland, 10 Nov 1989')
      await loaded(page)
      for (const width of [320, 768, 1024]) {
        await page.setViewportSize({ width, height: 800 })
        await noHorizontalOverflow(page)
      }
      expect(errors).toEqual([])
    } finally {
      await browser.close()
    }
  })
}
