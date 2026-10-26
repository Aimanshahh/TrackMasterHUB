import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend always calls the API on its own origin. In development and in
// local preview, Vite proxies `/api` to Express, so no CORS or absolute URLs
// are needed. Deployed builds can either sit behind the same reverse proxy or
// set VITE_API_BASE_URL.
const apiProxy = {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
});
