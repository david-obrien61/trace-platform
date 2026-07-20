/// <reference types="vite/client" />

// OP-15 SHA STAMP — injected at build time by vite.config.ts `define`.
// 7-char git SHA on Vercel; the literal 'dev' when built outside Vercel.
declare const __COMMIT_SHA__: string;
