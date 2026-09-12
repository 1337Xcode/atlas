import { defineConfig } from 'vitest/config'

// note: projects split by the environment the code under test actually runs in
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['packages/{schema,scene,archive,world,ingest}/src/**/*.test.ts'],
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
        test: {
          name: 'wireframe',
          environment: 'node',
          include: ['apps/wireframe/src/**/*.test.ts'],
        },
      },
    ],
  },
})
