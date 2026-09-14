/// <reference types="vite/client" />

// OP-15 VERSION STAMP — injected at build time by vite.config.ts `define`.
// 7-char git SHA on Vercel; the literal 'dev' when built outside Vercel.
declare const __COMMIT_SHA__: string;
// ISO-8601 UTC timestamp of the build.
declare const __BUILD_TIME__: string;
// 🔴 THE PRODUCTION STAMP (tech-debt #280 ②). Vercel's VERCEL_ENV
// ('production' | 'preview' | 'development') and VERCEL_GIT_COMMIT_REF (the
// branch), baked at build time. Both are the EMPTY STRING off Vercel — never a
// guessed value, because a stamp that guesses "production" is the silent false
// green it exists to prevent. Interpreted by src/lib/deployStamp.ts.
declare const __DEPLOY_ENV__: string;
declare const __DEPLOY_REF__: string;
