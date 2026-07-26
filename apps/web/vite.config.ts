import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow phone on same Wi‑Fi: http://YOUR-LAN-IP:5173
    host: true,
    proxy: {
      // Local dev: frontend → Rust API
      '/v1': 'http://127.0.0.1:8080',
      '/media': 'http://127.0.0.1:8080',
      '/healthz': 'http://127.0.0.1:8080',
      '/readyz': 'http://127.0.0.1:8080',
    },
  },
})
