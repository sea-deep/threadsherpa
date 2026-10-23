import { defineConfig } from 'astro/config';

// Static pages. The Campfire API is a separate process; no adapter is needed.
export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    server: {
      fs: {
        // The shared sandbox contract lives at the repository root.
        allow: ['..'],
      },
      // Keep browser requests same-origin in development so cookies and
      // relative /api URLs behave exactly as they do behind production's proxy.
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
      },
    },
  },
});
