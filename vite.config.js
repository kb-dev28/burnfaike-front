import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output lands in docs/ so GitHub Pages can serve it straight off main
// without an Actions workflow. base must match the repo name, or every asset
// 404s once it is behind /burn-faike/.
export default defineConfig({
  plugins: [react()],
  base: '/burnfaike-front/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
});
