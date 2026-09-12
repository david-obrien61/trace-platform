/**
 * ── useDevice — the device vocabulary. FOUR AXES, NAMED APART, EACH SAYING WHAT IT KNOWS ──
 *
 * PURPOSE     The single place the platform asks anything about the device it is rendering on.
 * DEPENDENCIES `design-system/tokens` (`breakpoints` / `media` — the numbers) · `matchMedia`.
 * OUTPUTS     `useBreakpoint()` · `useInput()` · `useContainer()`. No platform detector — see below.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS: ONE BOOLEAN WAS ANSWERING FOUR QUESTIONS.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * `ReceiptKeeper.useIsMobile` mixed THREE signals — `pointer: coarse`, a 820px width test, and a
 * USER-AGENT REGEX — into one boolean, so a narrow desktop window and an iPad answered the same.
 * `OperationsCalendar.useIsNarrow` then had to be written as a SECOND detector, with a comment
 * explaining that it could not reuse the first because they ask different questions. That comment
 * was right, and it is the whole argument for this file: they are different AXES, and a boolean
 * cannot carry two of them.
 *
 *   VIEWPORT   how wide is the screen        → decides LAYOUT      → `useBreakpoint()`
 *   INPUT      touch vs pointer              → decides TARGET SIZE → `useInput()`
 *   CONTAINER  browser vs native shell       → decides CHROME      → `useContainer()`
 *   PLATFORM   phone / tablet / desktop      → decides CAPABILITY  → 🔴 NOT DETECTED. Read on.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE PLATFORM AXIS HAS NO DETECTOR HERE, DELIBERATELY, AND THIS IS THE HONEST ANSWER.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * There is NO mechanism in a browser that reliably reports "this is a phone". The only thing on
 * offer is the user-agent string, and it is a self-declared string a vendor may spoof, freeze or
 * retire: iPadOS reports itself as a Mac by default, every desktop UA still begins "Mozilla/5.0",
 * and `navigator.userAgentData` is Chromium-only. The old regex here tested for `iPad` — on a
 * current iPad that test is FALSE. So a platform detector returns a CONFIDENT WRONG ANSWER, which
 * is the one failure mode this platform has spent a fortnight finding instances of (#182: a check
 * that cannot reach its target reports the same as one that passed).
 *
 * AND THE PLATFORM HAS ALREADY RULED ON THIS AXIS, which is why no detector is owed:
 *   David, 2026-08-23 — "TILE CAPABILITY IS DECLARED, NOT ACCIDENTAL: `phone` | `desktop` |
 *   `either`… so the platform states which device a surface is for instead of leaving it to be
 *   discovered. Today DataSheet's desktop-ness is ACCIDENTAL — nothing declares it — and a table
 *   rendered on a phone is indistinguishable from a bug."
 * That ruling is OPEN (ruled, nothing built — the `TileEntry` field, its default and its cap are
 * a separate OWED build, explicitly out of scope when it was ruled, and out of scope here too).
 * Its bearing on THIS file is the direction: device INTENT is something a surface DECLARES, not
 * something a hook SNIFFS. This file does not pre-empt that build and mints none of its vocabulary.
 *
 * SO WHAT DO YOU USE INSTEAD?
 *   · "Is this worth rendering here?"     → the DECLARATION (that owed `TileEntry` field).
 *   · "Is there room for this control?"   → `useBreakpoint()`.
 *   · "Is a finger doing the tapping?"    → `useInput()`.
 *   · "Does a camera exist?"              → ASK FOR IT. `<input type="file" capture>` degrades to
 *                                           a file picker on its own; the device answers, not us.
 * NEVER use any of these to decide whether a PERMISSION applies or whether data may be shown.
 * A device check that guards authorisation and fails open is not a check (tech-debt #75).
 *
 * ⚠️ NOTHING IN THIS FILE READS `navigator.userAgent`, and `deviceDetector.test.ts` §D fails the
 * build if that ever changes.
 *
 * Run the guard: node scripts/run-tests.mjs deviceDetector
 */
import { useEffect, useState } from 'react';
import { BANDS, breakpoints, media, type Band } from '../design-system/tokens';

export type { Band };

/**
 * Which band a width falls in. PURE — this is the function the tests grade, so the boundary is
 * provable without a browser. Walks the bands widest-first and returns the first one the width
 * has reached; `compact` is 0 and therefore always the floor.
 */
export function bandFor(width: number): Band {
  for (let i = BANDS.length - 1; i >= 0; i--) {
    const b = BANDS[i];
    if (width >= breakpoints[b]) return b;
  }
  return 'compact';
}

/** SSR / Node / a test: no window. Every hook below starts from the same honest default. */
const hasWindow = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Subscribe to a media query and re-render when it flips. Returns `false` where there is no window. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => (hasWindow() ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!hasWindow()) return;
    const mq = window.matchMedia(query);
    const recompute = (): void => setMatches(mq.matches);
    recompute();                       // the query may have changed between render and effect
    mq.addEventListener('change', recompute);
    return () => mq.removeEventListener('change', recompute);
  }, [query]);
  return matches;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// VIEWPORT — the axis ~90% of callers actually want.
// ══════════════════════════════════════════════════════════════════════════════════════════
/**
 * The viewport band, from `matchMedia` against the SAME numbers the CSS uses.
 *
 * WHAT IT KNOWS: exactly how wide the viewport is, right now, and it changes when the window is
 * resized or the device is rotated — a desktop window dragged narrow becomes `compact`, correctly,
 * because that is genuinely a layout question.
 * WHAT IT DOES NOT KNOW: what the device IS. A `compact` viewport is not evidence of a phone.
 *
 * Returns `wide` where there is no window (SSR/Node) — the desk is the safe default: it is the
 * layout every surface was built for, so a missing signal degrades to the known-good case.
 */
export function useBreakpoint(): Band {
  const atMedium = useMediaQuery(media.from('medium'));
  const atWide   = useMediaQuery(media.from('wide'));
  if (!hasWindow()) return 'wide';
  if (atWide) return 'wide';
  return atMedium ? 'medium' : 'compact';
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// INPUT — real, cheap, and standardised. Nothing here is a guess.
// ══════════════════════════════════════════════════════════════════════════════════════════
export interface InputAxis {
  /** The primary pointer is imprecise — a finger or a stylus rather than a mouse. */
  coarse: boolean;
  /** The primary pointer can hover. A mouse can; a finger cannot. */
  hover: boolean;
  /**
   * Touch is the PRIMARY way this device is driven: coarse AND unable to hover.
   *
   * This is the honest replacement for `isMobile` at every call site that was really asking
   * "will a finger be doing this". It is TRUE on a phone in any orientation and on a tablet —
   * with no width test and no user-agent, which is why the old 820px/UA pair can be deleted
   * rather than ported. It is FALSE on a touchscreen laptop, whose primary pointer is a mouse,
   * which is the answer that hook got wrong.
   */
  touchPrimary: boolean;
}

/** PURE — the axis derived from the two media results, so the tests can grade it without a browser. */
export function inputFrom(coarse: boolean, hover: boolean): InputAxis {
  return { coarse, hover, touchPrimary: coarse && !hover };
}

/**
 * WHAT IT KNOWS: what kind of pointer is driving this session, from the CSS Media Queries Level 4
 * `pointer` / `hover` features, which every browser we support implements.
 * WHAT IT DOES NOT KNOW: whether a touchscreen also EXISTS on a mouse-driven device (that is
 * `any-pointer`, a different question), and nothing about the device's identity or its hardware.
 */
export function useInput(): InputAxis {
  const coarse = useMediaQuery('(pointer: coarse)');
  const hover  = useMediaQuery('(hover: hover)');
  return inputFrom(coarse, hover);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// CONTAINER — the seam for the wrap that does not exist yet. Today: 'browser'.
// ══════════════════════════════════════════════════════════════════════════════════════════
/**
 * `browser`   a normal tab, with browser chrome. THE ONLY VALUE THAT CAN OCCUR TODAY.
 * `installed` an installed PWA — no browser chrome, so the page owns the safe areas.
 * `native`    inside a native shell that has identified itself (see `SHELL_HANDSHAKE`).
 */
export type Container = 'browser' | 'installed' | 'native';

/**
 * The global a native wrapper sets on `window` before the app boots. A DECLARATION BY THE
 * CONTAINER ITSELF, never a sniff: the shell is the only party that knows it is a shell, so it
 * says so, and we read what it said. This is the seam — when the wrap is built it sets this and
 * nothing in this file changes.
 */
export const SHELL_HANDSHAKE = '__TRACE_NATIVE_SHELL__' as const;

/** PURE. `standalone` is the `(display-mode: standalone)` result; `shell` is the handshake. */
export function containerFrom(shell: boolean, standalone: boolean): Container {
  if (shell) return 'native';
  if (standalone) return 'installed';
  return 'browser';
}

/**
 * WHAT IT KNOWS: whether a shell has DECLARED itself, and whether the page is running without
 * browser chrome.
 * WHAT IT DOES NOT KNOW: anything about a wrapper that has not declared itself — and it does not
 * try to find out. There is no way to detect an unannounced WebView that is not a user-agent
 * guess, which is the thing this module refuses to do.
 *
 * 🔴 TODAY THIS ALWAYS RETURNS 'browser', AND HERE IS WHY BOTH OTHER VALUES ARE UNREACHABLE:
 * `native` — the wrap does not exist, so nothing sets the handshake. `installed` — the app ships
 * NO WEB APP MANIFEST (verified 2026-09-12: no `manifest.webmanifest` and no `<link rel=manifest>`
 * in `packages/cultivar-os/index.html`), and without one a browser will not install it, so
 * `display-mode` cannot be `standalone`. Both are implemented rather than stubbed so that adding
 * a manifest, or building the wrap, needs no change here — but neither is a state this app has
 * ever been in, and no surface may claim otherwise.
 */
export function useContainer(): Container {
  const standalone = useMediaQuery('(display-mode: standalone)');
  const shell = hasWindow() && (window as unknown as Record<string, unknown>)[SHELL_HANDSHAKE] === true;
  return containerFrom(shell, standalone);
}
