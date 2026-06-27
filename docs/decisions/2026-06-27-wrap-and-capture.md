# Decision — Wrap-and-Capture: sequencing + field-debug capture

**Date:** 2026-06-27
**Author:** THUNDER (recon + entry build)
**Type:** RECON + RECOMMEND, with a trivial entry-level build shipped this pass.
**Status:** Capture tool BUILDER-COMPLETE (owner-proof owed). PWA wrap + session fix = recommended sequence, NOT built.

---

## The question

Given where Cultivar OS is headed (PWA wrap for persistent-login demo + an offline-session
fix + the grower-resolve fix), what is the **best sequence**, and the **best way to get rich
[TRACE:*] field-debug data off a phone** as a file David can hand Lightning?

David's hypothesis to weigh: maybe wrapping NOW is the best path to the capture problem (a
PWA may give richer storage/file/share than a Safari tab) — wrapper as debug mechanism AND
demo app in one move. Or it muddies the resolver/session fixes ("don't fight two things").

---

## Finding #1 — How TRACE emits today (load-bearing)

**Scattered raw `console.*` calls. No central emitter, no persistence.**

- ~500 inline `console.log/info/warn/error('[TRACE:AREA] …', {…})` sites across ~80 files;
  **40 distinct area tags** (`[TRACE:COST]`, `[TRACE:NAV]`, `[TRACE:BUSINESS]`, `[TRACE:COUNT]`,
  `[TRACE:DELIVERY]`, `[TRACE:RECEIPT]`, `[TRACE:PROJECTLENS]`, …).
- No `logger.ts`/`trace.ts`/`emit.ts` anywhere — each site writes its own `console.*`.
  Representative: `packages/shared/src/context/BusinessProvider.tsx:281`
  (`console.log('[TRACE:BUSINESS] owner path', {…})`); `CountOnceSeam.ts:586`;
  `packages/cultivar-os/api/customers/create.ts:48`.
- **Emits write ONLY to the ephemeral console** — lost on refresh. Nothing in
  localStorage/sessionStorage/IndexedDB. (localStorage is used for the active-business
  selection in BusinessProvider, never for traces.)

**Consequence for capture design:** the cheapest, zero-churn tee is a **console interceptor**
installed once at boot — it taps `console.*` itself, so all ~500 sites are captured as-is with
**zero per-site edits**. Refactoring 500 sites onto a central emitter is the expensive path and
is unnecessary.

## Finding #2 — Honest wrap cost for THIS codebase

**A PWA wrap is a THIN layer. There is no native-shell anywhere and none is needed.**

Current state (cultivar-os is a Vite + React SPA on Vercel):
- ❌ No web-app manifest (no `manifest.json`, none referenced in `index.html`).
- ❌ No service worker (`serviceWorker`/`workbox`/`vite-plugin-pwa` all absent from deps).
- ❌ No apple meta tags / touch icons; `index.html` has only charset/viewport/theme-color.
- ✅ SPA routing + Vercel rewrites already correct; Vite build → `dist/`.

To make it an installable PWA = add a `manifest.webmanifest`, 2–3 icon PNGs (192/512), 4–5
apple meta tags, and a small service worker (app-shell cache) registered in `main.tsx`.
**~3–4 hours, additive, no app code changes.** No app-vs-wrapper layer is introduced — it is
the *same web app, made installable*. (A native shell — Capacitor/WebView — WOULD introduce a
real wrapper layer; it is **not** required for the install-tile + persistent-login demo and is
not recommended.)

**Correction to David's hypothesis (load-bearing):** a PWA does **not** unlock materially
richer capture than a plain mobile tab. The Web Share API (`navigator.share`, incl. file
sharing), `Blob` download, and `localStorage`/IndexedDB **all already work in mobile Safari and
Android Chrome tabs**. So capture richness is **decoupled from wrapping** — we can ship rich
capture today in the tab, and decide wrap timing purely on its own merits.

Persistent login is *also* mostly independent of wrapping: Supabase's client already defaults
to `persistSession:true` + localStorage (`packages/shared/src/supabase/client.ts:11`), so the
session survives reload **when online today**. The "going offline dumps you to onboarding" bug
is a `supabase.auth.getUser()` **network call** at `BusinessProvider.tsx:237` that fails offline
→ settles as `no_business` → Dashboard redirects to `/onboarding`. That bug exists identically
in a tab and in a PWA; wrapping neither causes nor fixes it.

## Finding #3 — Sequencing call

**Recommended order: (0) ship capture NOW → (A) fix resolver + session NAKED, prove them with
the new capture → (B) wrap as a thin PWA LAST.** This is Path A, with capture pulled in front as
its own pre-step.

Reasoning, with evidence:
1. **Capture is the instrument, and it's independent of both forks.** It's pure client-side,
   works in the tab today, and is exactly the data you need to debug the resolver + session
   fixes. Build the instrument before doing the debugging. (Finding #1/#2.)
2. **Wrapping interacts with the very thing the session fix touches.** A service worker caches
   the app shell and changes offline/load behavior — the same surface as the
   offline-dumps-to-onboarding fix (`BusinessProvider.tsx:237`). Introducing the SW mid-fix is
   the "fighting two things at once" risk David named. Fix the session naked first; then add the
   SW knowing the offline path is already correct.
3. **Wrapping buys nothing that's blocked today.** Capture richness and persistent-login both
   work tab-side now (Finding #2). The unique thing the wrap adds is the **install-tile UX**
   (tap a texted link → home-screen tile → opens full-screen logged-in). That's a demo-polish
   step best done **last**, once the session survives offline/reopen (its prerequisite) and the
   build has stopped changing daily (SW update churn is annoying during active dev).

Net: **0 → A → B.** Wrap last, not now.

## Finding #4 — Recommended capture method + how David uses it

**Console interceptor → persisted ring buffer → on-screen panel with Share/Download/Copy.**
This is the richest option at the lowest field-friction, and it ships in a plain tab (no PWA).

Why this over the alternatives:
- *On-screen panel w/ share* ✅ chosen — richest data (full trail, not a screenshot),
  lowest friction, works iOS + Android in a tab.
- *Persisted ring buffer + export* ✅ folded in — survives reload/white-screen so **crashes are
  actually caught** (the symptom David can currently only screenshot becomes a downloadable log).
- *Screenshot-with-embedded-log* ❌ — lossy (truncates long trails), no richer than the panel.
- *Remote auto-upload* ❌ deferred — needs an endpoint + tenant-data egress review; not now.

**How David uses it (concretely):**
1. On his phone, open the app with `?debug=1` appended once (sticky thereafter via
   localStorage). A small **🐞 TRACE** button appears bottom-right. Lauren's normal link has no
   `?debug=1`, so her demo is clean.
2. Use the app until it looks wrong (e.g. the false-UNKNOWN resolver miss, or the offline
   bounce to onboarding).
3. Tap **🐞 TRACE** → the panel shows the live trail (count + last ~200 lines).
4. Tap **Share** → the OS share sheet opens → send the `.txt` to Lightning (Messages/Mail/etc.).
   If the device can't share files, it auto-falls back to **Download** a `.txt`; **Copy** is also
   there for pasting into chat.
5. Lightning now has the **cause** (the `[TRACE:*]` trail) next to David's **symptom**
   (screenshot) — as DATA, not "Dave describes what he thinks happened."

**Privacy note:** TRACE payloads include tenant identifiers (`business_id`, ids, emails). The
export is plain text for internal David→Lightning use; the panel surfaces this. Redaction is a
named step-up, not built.

### Entry version (built this pass) vs richer step-ups (deferred)
- **Built now (entry):** console interceptor + 600-entry localStorage ring buffer (survives
  reload + window.onerror/unhandledrejection crash-flush) + floating panel (Share/Download/Copy/
  Clear), gated behind `?debug=1` so demos stay clean. `[TRACE:CAPTURE]` instrumentation ON.
- **Step-ups (recommend, don't build on spec):** IndexedDB for very large logs; a redaction
  toggle (mask emails/ids); remote one-tap upload to a TRACE endpoint; per-area filter in the
  panel; auto-attach the current screenshot. Pick if/when the entry tool proves insufficient.

---

## Recommendation (summary)

- **(a) Sequencing:** ship capture now → fix resolver + session **naked** and prove with the new
  capture → **wrap as a thin PWA last**. Wrapping is cheap (~3–4h, additive) but interacts with
  the offline/session fix and buys nothing that's blocked today, so it goes last.
- **(b) Capture method:** the console-interceptor → persisted ring buffer → share/download panel,
  gated by `?debug=1`. Entry version built + proven this pass; richer step-ups named above.

## What was built this pass

Entry-level capture (small, fork-free, solves the acute pain — built per the prompt's
"build only if trivial" clause):
- `packages/shared/src/debug/captureBuffer.ts` (+ `debug/index.ts` barrel) — interceptor + ring
  buffer + `getCaptureText/clearCapture/downloadCapture/shareCapture`.
- `packages/cultivar-os/src/components/DebugPanel.tsx` — the `?debug=1`-gated 🐞 panel.
- Wires: `main.tsx` (`installCapture()` before React), `App.tsx` (`<DebugPanel/>`), shared barrel.

**Proofs:** `build:cultivar` clean (2233 modules, +2). `npm run verify` exit 0 — quality gate
zero net-new (tsc 10 / eslint 266 / knip 10·14·15 unchanged) + verify-universals all in-scope
PASS. Deterministic node smoke (stubbed browser globals): interceptor captures `[TRACE:*]`
verbatim with tenant ids, levels preserved, header carries url/ua/online, **window.onerror
crash flushes to storage immediately**, buffer **survives reload**, clear empties it. ESLint
clean on all changed files.

**Bar:** BUILDER-COMPLETE. **OWNER-PROVEN owed (David, on the phone):** open the live app with
`?debug=1` → 🐞 appears → use the app → tap 🐞 → trail shows → Share → the `.txt` lands in the
share sheet and sends to Lightning. `[TRACE:CAPTURE]` stays ON until owner-proven.

**Not built (recommend + STOP for David's pick):** the PWA wrap (forks: vite-plugin-pwa vs raw
manifest+SW; icon assets) and the session/offline + resolver fixes (separate prompts).
