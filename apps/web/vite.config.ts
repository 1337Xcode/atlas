import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'reactor-wasm-assets',
      enforce: 'pre',
      // fix: let Vite include the SDK's shipped wasm loader and binary in the production graph
      transform(code, id) {
        if (!id.includes('@reactor-team/js-sdk') || !id.endsWith('/dist/index.js')) return
        return {
          code: code.replace(/\/\* @vite-ignore \*\/\s*("\.\/wasm\/reactor_wasm\.js")/, '$1'),
          map: null,
        }
      },
    },
  ],
  // fix: the SDK loads a relative wasm module that must not move into Vite's dependency cache
  optimizeDeps: {
    exclude: ['@reactor-team/js-sdk'],
    include: ['@atlas/runtime > @reactor-team/js-sdk > awaitqueue'],
  },
  server: {
    port: 5173,
    host: true,
    // demo: served to judges through an ngrok tunnel
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok-free.dev', '.ngrok.io'],
    // note: the reader mints its world token through the API app, same-origin in production
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: { sourcemap: true },
})
