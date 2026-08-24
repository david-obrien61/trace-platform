// ============================================================
// readResult — a read either SUCCEEDED with a value, or FAILED. Those are different facts,
// and the type refuses to let a caller conflate them.
//
// PURPOSE:      R-11 (David, 2026-08-23): *"READ HONESTY IS A TYPE, NOT A DISCIPLINE."* The
//               standing draft rule — **a read whose error path returns a value must keep FAILED
//               distinguishable from EMPTY** (A9 on the read side) — is enforced by a
//               DISCRIMINATED UNION, not by convention: the compiler refuses to let a caller
//               reach `.value` without first handling `ok === false`.
// DEPENDENCIES: ./supabaseError (isConnectivityError) — the one predicate that classifies a
//               failure as a dead zone vs a real answer from the server.
// OUTPUTS:      ReadResult<T>, ReadFailure, readOk, readFailed, readFailureMessage.
//
// 🔴 WHY A TYPE AND NOT A HELPER, IN THE RULING'S OWN EVIDENCE: `readPricingConfig` ALREADY
// returns `{data, error}` correctly, and ALL SEVEN of its callers throw the error away. A shape
// that *can* be ignored *will* be. A union cannot: `.value` is unreachable without narrowing, so
// `tsc` — already in `npm run verify` — turns a discipline problem into a BUILD FAILURE at zero
// new tooling (§6 r10: the standard earns its value here).
//
// ⚠️ SCOPE, STATED SO THIS FILE IS NOT MISREAD AS THE OWED BUILD. R-11's full conversion is
// OWED and UNSCOPED — 30 sites CONFIRMED, ceiling 91, and the 7 auth reads explicitly NOT
// covered by the ruling. This module is its FIRST INSTANCE, minted here so the owed build
// INHERITS a type rather than minting a second one. Its first consumer is
// `inventory/stockLineResolver`, whose three discarded errors rendered a dead zone as
// *"Didn't recognize this — check the tag"* (recon 2026-08-23).
//
// ✏️ ONE DELIBERATE DEVIATION FROM THE RULING'S LITERAL SPELLING, recorded rather than silent:
// R-11 writes the failure branch as `{ ok: false; error: Error }`. This carries a structured
// `ReadFailure` instead, because every consumer needs the one discriminator an `Error` subclass
// would only re-encode less legibly — DEAD ZONE (retry with signal) vs THE SERVER ANSWERED NO
// (retrying is pointless). The ruled property — a failure branch that cannot be skipped — is
// unchanged.
// ============================================================

import { isConnectivityError } from './supabaseError';

/**
 * Why a read failed. `kind` is the ONLY distinction a person can act on:
 *   • 'offline' — the request never reached the server. Try again with signal.
 *   • 'error'   — the server answered, and the answer was a refusal. Signal will not fix it.
 * `message` is the raw underlying text, kept for the `[TRACE:*]` trail. It is NOT screen copy —
 * `readFailureMessage()` below is what a person reads.
 */
export interface ReadFailure {
  kind:    'offline' | 'error';
  message: string;
}

/**
 * A read's outcome. The value is reachable ONLY through `ok === true`.
 *
 * 🔴 THE WHOLE POINT: a caller that skips the failure branch does not get a wrong answer at
 * runtime — it does not COMPILE. Widening this to a nullable, or to an optional `error` field
 * beside the value, would restore exactly the ignorable shape the ruling rejects.
 */
export type ReadResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ReadFailure };

/** A read that succeeded. `value` may legitimately be empty — empty is a fact, not a failure. */
export function readOk<T>(value: T): ReadResult<T> {
  return { ok: true, value };
}

/**
 * A read that failed, classified through the ONE shared predicate (§6 r8 — never a second
 * regex). Accepts a Supabase `PostgrestError`-shaped object or a thrown value.
 */
export function readFailed<T>(err: { code?: string; message?: string } | Error | null): ReadResult<T> {
  const shaped = (err ?? {}) as { code?: string; message?: string };
  return {
    ok: false,
    error: {
      kind:    isConnectivityError(shaped) ? 'offline' : 'error',
      message: shaped.message ?? 'unknown read failure',
    },
  };
}

/**
 * THE ONE SENTENCE A PERSON READS WHEN A READ FAILS — the WHAT HAPPENED half.
 *
 * 🔴 IT NEVER MENTIONS THE THING BEING LOOKED UP. That is the entire defect this exists to end:
 * a network failure rendering as *"it didn't match a stock line. Check the tag"* sent Lauren to
 * inspect a tag that was fine. A failed read knows NOTHING about the tag, the lot, or the
 * catalog — so the copy says what actually happened and what to do about it, and nothing else.
 *
 * Each surface appends its own WHAT-YOU-CAN-STILL-DO half; the diagnosis is written once, here,
 * so three screens cannot drift three descriptions of one event (STD-011).
 */
export function readFailureMessage(failure: ReadFailure): string {
  return failure.kind === 'offline'
    ? "You're offline — we couldn't reach the server to look this up. Try again once you have a signal."
    : "We couldn't reach the server to look this up. Try again in a moment.";
}
