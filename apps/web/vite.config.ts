import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// note: shaders are imported with ?raw, so vite hands over the glsl source rather than a url
export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // note: the newspaper reads the archive from the backend during integration
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    // why: the world model streams 960p, so a large texture budget buys nothing
    assetsInlineLimit: 4096,
    sourcemap: true,
  },
})
