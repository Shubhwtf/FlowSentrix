import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/stream': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    },
    allowedHosts: [
      'disposition-waters-replacing-wolf.trycloudflare.com' //for testing
    ]
  }
})
