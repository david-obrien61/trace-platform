/// <reference types="vite/client" />

// OP-15 VERSION STAMP — injected at build time by vite.config.ts `define`.
// 7-char git SHA on Vercel; the literal 'dev' when built outside Vercel.
declare const __COMMIT_SHA__: string;
// ISO-8601 UTC timestamp of the build.
declare const __BUILD_TIME__: string;
