// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: The ALWAYS-VISIBLE version stamp — `built <date> · <sha>` — the one
//   home for "what am I actually looking at?" (OP-15 GATE 0, ledger #141/#142).
//
// WHY IT IS *NOT* BEHIND THE DEBUG GATE — this is the load-bearing reason:
//   GATE 0 reads this stamp to decide whether a screen is evidence at all. If it
//   lived inside the debug panel, then a BROKEN DEPLOY COULD HIDE ITS OWN TELL —
//   the failure mode would be invisible exactly when it matters. A deploy that
//   fails to ship the menu still ships this stamp. So it renders for EVERY user,
//   signed in or not, on every screen.
//
// WHY IT IS THE *ONLY* HOME (STD-011): the SHA line was removed from DebugPanel
//   in the same build that added this. Two surfaces printing one fact drift, and
//   a drifted version stamp is worse than none — it would assert a build you are
//   not running.
//
// DEPENDENCIES: the build-time defines `__COMMIT_SHA__` / `__BUILD_TIME__`
//   (packages/cultivar-os/vite.config.ts `define`; declared in src/vite-env.d.ts).
//   NO context, NO network, NO auth — it must render even when everything else
//   has failed, which is precisely when it is needed.
// OUTPUTS: a small muted line pinned bottom-center. `pointer-events: none` so it
//   can NEVER intercept a tap — it sits over the app but is not part of it.
// INSTRUMENTATION: none by design — it IS the signal; emitting a TRACE line about
//   the thing you can already read would be noise.
// ───────────────────────────────────────────────────────────────────────────

/**
 * `2026-07-20T18:04:11.000Z` → `Jul 20, 6:04p`. Short enough for a phone corner,
 * specific enough to tell two same-day deploys apart (the realistic case — you
 * push several times an hour, so a date alone would not distinguish them).
 * Falls back to the raw string rather than inventing a date it cannot parse.
 */
function formatBuiltAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = d.toLocaleString('en-US', { month: 'short' });
  const hour24 = d.getHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  const meridiem = hour24 < 12 ? 'a' : 'p';
  return `${month} ${d.getDate()}, ${hour12}:${minute}${meridiem}`;
}

export function VersionStamp() {
  return (
    <div
      // aria-hidden: this is build provenance for the operator, not page content.
      // A screen reader announcing a SHA on every page would be pure noise.
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 2,
        zIndex: 10, // BELOW the panels (99999) — it never competes with a control
        pointerEvents: 'none', // can never swallow a tap, anywhere, ever
        textAlign: 'center',
        fontSize: 10,
        lineHeight: 1.2,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'rgba(107,114,128,0.75)', // muted gray — legible, not attention-seeking
        // A hairline of contrast so the stamp stays readable on both the sage app
        // background and the dark panels/photos it may sit over.
        textShadow: '0 0 3px rgba(255,255,255,0.85)',
        userSelect: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', // clear the iOS home bar
      }}
    >
      built {formatBuiltAt(__BUILD_TIME__)} · {__COMMIT_SHA__}
    </div>
  );
}
