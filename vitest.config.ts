import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// note: projects split by the environment the code under test actually runs in
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['packages/{schema,scene,archive,world,ingest,briefs}/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['packages/runtime/src/**/*.test.ts'],
        },
      },
      {
        // note: the app's own `@/` alias, so route handlers can be called directly in tests
        resolve: {
          alias: { '@': fileURLToPath(new URL('./apps/api/src', import.meta.url)) },
        },
        test: {
          name: 'api',
          environment: 'node',
          include: ['apps/api/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.ts'],
        },
      },
    ],
  },
})
