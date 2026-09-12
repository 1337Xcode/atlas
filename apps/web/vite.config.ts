import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// note: shaders are imported as strings, so .frag files are treated as assets to inline
export default defineConfig({
  plugins: [react(), tailwind()],
  assetsInclude: ['**/*.frag'],
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
