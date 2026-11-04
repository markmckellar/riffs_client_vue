import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// In development the page is served by Vite (port 5175) and /api calls are passed on to the
// server (rifts_wf_server, port 9095), so the sign-in cookie is same-origin, just like in production
// where the server serves the built page itself.
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': 'http://localhost:9095',
    },
  },
})
