# Runbook: Erin's Social Media Measurement Prototype Scaffold
**Date:** 2026-06-03  
**Type:** Prototype scaffold (external to trace-platform repo)  
**Status:** Complete ✅

---

## What this is

A standalone React/Vite sandbox for Erin O'Brien's social media measurement learning project. Lives at `~/Desktop/erin-prototypes/social-media-measurement/` — **not inside the trace-platform repo** and not deployed to Vercel.

This is a learning prototype, not production code. Erin will use it to explore ideas, break things, and figure out what she wants to build — before any of it becomes real TRACE features.

---

## Directory layout

```
~/Desktop/erin-prototypes/
└── social-media-measurement/
    ├── package.json          ← React 18 + Vite 5 + Recharts
    ├── vite.config.js        ← standard @vitejs/plugin-react config
    ├── index.html            ← entry point
    ├── .gitignore            ← node_modules, dist, .DS_Store
    ├── README.md             ← plain-language guide for Erin
    └── src/
        ├── main.jsx          ← React root mount
        └── App.jsx           ← entire app (~590 lines, four sections)
```

---

## What the prototype includes

Four sections, all with fake (static) data:

1. **AI Content Generator** — text input for topic, mock "generate" button, displays styled post cards from a PLACEHOLDER_ADS array (5 LAWNS-specific examples covering promotional, educational, authority, and event tones)
2. **Owner's Picks** — toggle selection on generated posts (max 3), picks used to seed future generation (concept demonstration only)
3. **Performance Tracker** — sortable table by Bookings column, mock metrics (Reach, Engagements, Clicks, Bookings, Revenue), illustrates the measurement concept
4. **Monthly Review** — Recharts bar chart (fake monthly engagement data), summary stats, "what worked" and "what to try next" bullets

All styling uses inline styles with TRACE colors (`#27500A` green, `#EAF3DE` sage). No Tailwind. No className= utilities. Consistent with platform-wide policy.

Heavy educational comments throughout `App.jsx` — every section explains what it is and why it's built that way, so Erin can read the code alongside Claude Code explanations.

---

## How to run

```bash
cd ~/Desktop/erin-prototypes/social-media-measurement
npm install   # one-time setup
npm run dev   # starts dev server at http://localhost:5173
```

Press `Control+C` in Terminal to stop.

---

## Build verified

```
✓ 30 modules transformed
dist/index.html     0.35 kB
dist/assets/...js  154.52 kB
✓ built in 2.92s
```

No TypeScript errors (plain JSX). One dev warning: Vite CJS Node API deprecation — cosmetic, no action needed.

---

## Gotcha: curly apostrophes in JSX string literals

During scaffold, three string literals in `PLACEHOLDER_ADS` used curly (smart) apostrophes — `they'll`, `Don't`, `We've` — which are invalid inside single-quoted JSX string attributes. esbuild error: `Expected "}" but found "ll"`.

Fix: convert affected string literals from single-quoted `'...'` to double-quoted `"..."`. Single quotes inside double-quoted strings are fine.

**Prevention:** If Erin (or Claude Code) writes ad copy with contractions inside `'single-quoted'` strings, esbuild will fail with a confusing error. Use `"double-quoted"` strings for any copy that might contain apostrophes. Template literals (`\`...\``) also work.

---

## Why this lives outside trace-platform

Erin's prototype is a sandbox — exploratory, possibly broken, not subject to the platform's build pipeline, RLS rules, or Vercel deployment. It being outside the repo means:

- She can delete and rebuild freely without touching production
- No accidental Vercel deploys
- No shared package version conflicts
- Claude Code sessions for the prototype don't accidentally touch cultivar-os code

When (if) any concept from the prototype becomes a real TRACE feature, it gets built properly inside the monorepo from scratch — not migrated.

---

## Connection to Erin's onboarding

This prototype is Erin's first real build task. The developer setup guide (`docs/erin-onboarding-2026-06-03.md`) gets her to a working VS Code + Claude Code environment. This prototype is the first thing she opens in that environment.

David should walk Erin through `README.md` before her first session, then leave her to explore with Claude Code. The scope of her first session: understand what the four sections are, change a color or a piece of copy, run the dev server and see it update.

---

## How to replay the scaffold on a new machine

1. `mkdir -p ~/Desktop/erin-prototypes/social-media-measurement/src`
2. Copy `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `README.md`, `src/main.jsx`, `src/App.jsx` from the current machine or from this runbook's companion commit
3. `npm install`
4. `npm run dev` — should start on http://localhost:5173

No environment variables. No Supabase. No API keys. Pure static React.

---

*Per CLAUDE.md Part 9, Step 12 (runbook capture for setup operations).*
