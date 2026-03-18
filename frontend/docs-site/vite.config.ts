import { defineConfig } from 'vite';

export default defineConfig({
  base: '/docs',
  server: {
    port: 5174,
    strictPort: true
  },
  build: {
    outDir: 'dist'
  },
  esbuild: {
    jsx: 'automatic'
  }
});

