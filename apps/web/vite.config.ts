import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// demo: a tunnelled demo is served under a hostname vite has never heard of
const tunnelled = {
  host: true,
  allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
}
// note: the reader mints its world token through the API app, same origin in production
const proxied = { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }

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
  server: { port: 5173, ...tunnelled, ...proxied },
  preview: { port: 4173, ...tunnelled, ...proxied },
  build: { sourcemap: true },
})
