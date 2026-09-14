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
    // 🔴 THE PRODUCTION STAMP — GATE 0's second half, tech-debt #280 ②.
    // The SHA answers "which code" and the timestamp "from when"; NEITHER answers
    // "is this deployment's target PRODUCTION". #280 records ② as not checkable
    // because "nothing we own reads Vercel" — but nothing has to: Vercel sets
    // these at BUILD time, so the answer is baked into the bundle and read off
    // the screen, which is where David is standing when GATE 0 fires.
    // A Preview and a Production deploy of the SAME COMMIT were indistinguishable
    // until this line; #303 was recorded complete on preview-only deploys.
    // Absent off Vercel — deployStamp() resolves that against the SHA, and an
    // unrecognised value is NEVER coerced to production.
    __DEPLOY_ENV__: JSON.stringify(process.env.VERCEL_ENV || ''),
    __DEPLOY_REF__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF || ''),
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
