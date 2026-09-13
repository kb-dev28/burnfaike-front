import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output lands in docs/ so GitHub Pages can serve it straight off main
// without an Actions workflow. base must match THIS fork's repo name
// (kb-dev28/burnfaike-front), or every asset 404s behind /burnfaike-front/.
export default defineConfig({
  plugins: [react()],
  base: '/burnfaike-front/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
