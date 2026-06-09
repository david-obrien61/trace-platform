// ── Business Creation Abuse Guards ────────────────────────────────────────────
//
// Platform business logic (shared, AC-1 clean — no vertical nouns).
// Three guards against trial-farming, rate abuse, and suspicious patterns.
// All guards ship OFF (default false). OFF = function returns immediately,
// clean base case. ON = fully enforces. No partial/half-wired state.
//
// ACTIVATION DISCIPLINE:
//   - Prove the base add-business flow with all guards OFF before activating any.
//   - Turn each guard ON one-at-a-time. Test in isolation. David says "proven" →
//     flip to true. Thunder does NOT activate guards unilaterally.
//   - HARD LAUNCH PREREQUISITE: all three guards ON-and-tested before public
//     self-serve business creation opens. While creation is private/invite-only
//     (David + family), guards may stay OFF. This is the documented launch gate.
//
// GUARD_C NOTE: requires a `status text` column on the `businesses` table (see
// GUARD_C comment below). Add via migration before activating GUARD_C.
//
// USAGE in createBusinessAndMember():
//   const guard = await runBusinessCreationGuards(userId, supabase);
//   if (!guard.allowed) { setErrorMsg(guard.error!); return null; }
//   Object.assign(bizInsert, guard.insertPatch ?? {});
//   if (guard.heldForReview) { /* log / surface to admin */ }

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Guard flags — default OFF ─────────────────────────────────────────────────
// Flip each to `true` only after the base flow is proven and the guard is
// tested in isolation. David controls activation; Thunder does not.

const GUARD_A_PER_IDENTITY_FREE_TIER    = false;
const GUARD_B_CREATION_RATE_LIMIT       = false;
const GUARD_C_SUSPICIOUS_PATTERN_REVIEW = false;

// ── Rate limit config (GUARD_B) ────────────────────────────────────────────────

const RATE_LIMIT_MAX_COUNT   = 5;  // max new businesses allowed per window
const RATE_LIMIT_WINDOW_HOURS = 24; // rolling window in hours

// ── Suspicious threshold (GUARD_C) ────────────────────────────────────────────
// NOT triggered on count=2 (normal: David + one other owner, or LAWNS + TRACE).
// Only triggers at clearly anomalous counts (trial-farming pattern).

const SUSPICIOUS_BIZ_THRESHOLD = 10; // businesses created in last 24 h that triggers review

// ── Result type ────────────────────────────────────────────────────────────────

export interface GuardResult {
  allowed: boolean;
  error?: string;                        // message for user when allowed=false
  insertPatch?: Record<string, unknown>; // fields to merge into the businesses insert row
  heldForReview?: boolean;               // GUARD_C: creation proceeds but is flagged
}

// ── Main entry point ───────────────────────────────────────────────────────────
//
// Run all guards in order: A → B → C.
// First non-allowed result short-circuits the chain.
// insertPatch from passing guards is merged and returned.

export async function runBusinessCreationGuards(
  userId: string,
  supabase: SupabaseClient,
): Promise<GuardResult> {
  const a = await checkGuardA(userId, supabase);
  if (!a.allowed) return a;

  const b = await checkGuardB(userId, supabase);
  if (!b.allowed) return b;

  const c = await checkGuardC(userId, supabase);
  if (!c.allowed) return c;

  const insertPatch: Record<string, unknown> = {
    ...(a.insertPatch ?? {}),
    ...(c.insertPatch ?? {}),
  };

  return {
    allowed:       true,
    insertPatch:   Object.keys(insertPatch).length > 0 ? insertPatch : undefined,
    heldForReview: c.heldForReview,
  };
}

// ── GUARD_A: per-identity free tier ───────────────────────────────────────────
//
// When ON: free trial attaches to the IDENTITY (Supabase auth user), not to each
// business. A second business under the same identity does NOT get a fresh trial.
//
// Enforcement: if the identity already owns ≥ 1 business, patch the new businesses
// insert with `trial_started_at: null`. Billing reads null as "no trial period for
// this business." The primary anti-trial-farming guard.
//
// When OFF: clean no-op, no queries, no patches.

async function checkGuardA(
  userId: string,
  supabase: SupabaseClient,
): Promise<GuardResult> {
  if (!GUARD_A_PER_IDENTITY_FREE_TIER) return { allowed: true };

  const { count, error } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (error) {
    // Guard query failure: fail open (don't block creation on a guard error).
    // Log so the failure is observable.
    console.log('[TRACE:GUARD_A] query error — failing open', { userId, error: error.message });
    return { allowed: true };
  }

  const priorCount = count ?? 0;
  const noNewTrial = priorCount > 0;

  console.log('[TRACE:GUARD_A] per-identity-free-tier', {
    userId,
    priorCount,
    decision: noNewTrial ? 'no-new-trial (inherit account tier)' : 'first-business (trial allowed)',
  });

  if (noNewTrial) {
    // Set trial_started_at = null so billing treats this business as outside the trial window.
    // businesses.trial_started_at already exists (migration 20260529_businesses_a_create_tables).
    return {
      allowed:     true,
      insertPatch: { trial_started_at: null },
    };
  }

  return { allowed: true };
}

// ── GUARD_B: creation rate limit ──────────────────────────────────────────────
//
// When ON: per-identity cap on businesses created per rolling time window.
// Blocks creation if the identity has created ≥ RATE_LIMIT_MAX_COUNT businesses
// in the last RATE_LIMIT_WINDOW_HOURS hours.
//
// When OFF: clean no-op.

async function checkGuardB(
  userId: string,
  supabase: SupabaseClient,
): Promise<GuardResult> {
  if (!GUARD_B_CREATION_RATE_LIMIT) return { allowed: true };

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { count, error } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('created_at', windowStart);

  if (error) {
    console.log('[TRACE:GUARD_B] query error — failing open', { userId, error: error.message });
    return { allowed: true };
  }

  const recentCount = count ?? 0;
  const blocked     = recentCount >= RATE_LIMIT_MAX_COUNT;

  console.log('[TRACE:GUARD_B] creation-rate-limit', {
    userId,
    recentCount,
    limit:       RATE_LIMIT_MAX_COUNT,
    windowHours: RATE_LIMIT_WINDOW_HOURS,
    decision:    blocked ? 'BLOCKED' : 'allowed',
  });

  if (blocked) {
    return {
      allowed: false,
      error:   'Too many businesses were created recently on this account. Please wait before adding another, or contact support.',
    };
  }

  return { allowed: true };
}

// ── GUARD_C: suspicious pattern review ────────────────────────────────────────
//
// When ON: route creation to a review-pending state when an anomaly pattern is
// detected. Current pattern: identity created ≥ SUSPICIOUS_BIZ_THRESHOLD businesses
// in the last 24 h AND all of them have trial_started_at set (trial-farming signal).
// NOT triggered at count=2 (normal: David + LAWNS). Threshold is deliberately high.
//
// Enforcement: allowed=true so creation proceeds, but heldForReview=true is set so
// the caller can surface the flag to admins. The businesses row also receives an
// insertPatch of { status: 'review_pending' } — but ONLY once the `status` column
// exists on the `businesses` table. The patch line is intentionally commented out
// below; uncomment it when you add that column via migration.
//
// REQUIRES BEFORE ACTIVATING:
//   ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
//   Then uncomment the insertPatch line below.
//
// When OFF: clean no-op.

async function checkGuardC(
  userId: string,
  supabase: SupabaseClient,
): Promise<GuardResult> {
  if (!GUARD_C_SUSPICIOUS_PATTERN_REVIEW) return { allowed: true };

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('businesses')
    .select('id, trial_started_at')
    .eq('owner_id', userId)
    .gte('created_at', windowStart);

  if (error) {
    console.log('[TRACE:GUARD_C] query error — failing open', { userId, error: error.message });
    return { allowed: true };
  }

  const recent      = data ?? [];
  const recentCount = recent.length;
  const allOnTrial  = recentCount > 0 && recent.every(b => b.trial_started_at !== null);
  const suspicious  = recentCount >= SUSPICIOUS_BIZ_THRESHOLD && allOnTrial;

  console.log('[TRACE:GUARD_C] suspicious-pattern-review', {
    userId,
    recentCount,
    allOnTrial,
    suspicious,
    threshold: SUSPICIOUS_BIZ_THRESHOLD,
    decision:  suspicious ? 'HELD_FOR_REVIEW' : 'allowed',
  });

  if (suspicious) {
    return {
      allowed:       true,
      heldForReview: true,
      // insertPatch: { status: 'review_pending' },
      // ↑ Uncomment after: ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
    };
  }

  return { allowed: true };
}
