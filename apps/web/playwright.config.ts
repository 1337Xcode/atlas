import { defineConfig } from '@playwright/test'

// note: the browser suite drives the real bundle, so it needs a dev server, not vitest's jsdom
// note: point ATLAS_WEB_URL at an already-running instance to reuse it instead
const external = process.env.ATLAS_WEB_URL

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.browser.spec.ts',
  fullyParallel: true,
  reporter: 'line',
  use: { baseURL: external ?? 'http://localhost:5173' },
  ...(external
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
        },
      }),
})
