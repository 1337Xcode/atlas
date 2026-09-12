import { chromium, expect, test } from '@playwright/test'

// test: model-capacity failures should stay readable and retry only after another click
test('world attempts are single-flight and capacity errors are actionable', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    let requests = 0
    let release = () => {}
    const responseReady = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/worlds/*', async (route) => {
      requests++
      await responseReady
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'no available capacity: no available servers to handle the request',
        }),
      })
    })
    await page.goto('http://localhost:3000/articles/apollo-11-first-steps')
    const enter = page.getByRole('button', { name: 'enter the world', exact: true })
    await enter.click()
    await expect(page.getByRole('button', { name: 'opening the world' })).toBeDisabled()
    await page.getByRole('button', { name: 'opening the world' }).evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
    await expect.poll(() => requests).toBe(1)
    release()
    await expect(page.locator('.error')).toContainText('no free servers')
    await expect(enter).toBeEnabled()
    expect(requests).toBe(1)
    await enter.click()
    await expect.poll(() => requests).toBe(2)
    await expect(page.locator('.error')).toContainText('no free servers')
    await expect(page.locator('video')).toHaveCount(0)
  } finally {
    await browser.close()
  }
})
