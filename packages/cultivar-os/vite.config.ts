import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  // OP-15 SHA STAMP: the deployed bundle carries the commit it was built from, so
  // owner-prove GATE 0 ("is THIS SHA live?") is one glance at the DebugPanel instead
  // of a Vercel dashboard round-trip. Vercel exposes VERCEL_GIT_COMMIT_SHA at build;
  // local/dev has no such var and resolves to 'dev' — honest, never a fake SHA.
  define: {
    __COMMIT_SHA__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7),
    ),
    // Build timestamp (ISO, UTC). Answers "how OLD is what I'm looking at?" —
    // the SHA answers "which code", this answers "from when". Together they are
    // the always-visible version stamp that GATE 0 reads.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@trace/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
