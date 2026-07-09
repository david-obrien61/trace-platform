// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: SERVER-SIDE caller-authority gates for service-key API handlers. A handler
//   writes with the SERVICE KEY (which bypasses RLS), so it must independently prove the
//   CALLER's authority for the TARGET business before writing (MB_D-015 — write-authority
//   ≥ read-authority). Authority is resolved from the request AUTH CONTEXT (the Bearer
//   token), NEVER the request body — a forged businessId the caller doesn't belong to
//   returns false. Two gates: holds-a-permission (has_permission RPC) and is-the-owner
//   (businesses.owner_id). Both run under the caller's anon-key+token, so they see exactly
//   what that caller is allowed to see.
// DEPENDENCIES: @supabase/supabase-js (anon key + caller token), env (SUPABASE_URL,
//   VITE_SUPABASE_ANON_KEY | SUPABASE_ANON_KEY).
// OUTPUTS: callerHoldsPermission, callerIsBusinessOwner — each returns true only on an
//   explicit grant; refuses on a missing/blank token before any network call.
//
// SERVER-ONLY: imported by api/ handlers via a relative path — NOT re-exported from the
//   shared auth barrel (would pull createClient + env reads into the client bundle).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

function bearer(authHeader: string | undefined): string {
  return String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
}

function env(): { url: string; anon: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url, anon };
}

/**
 * Does the CALLER hold `perm` for `businessId`? Resolves the caller from the Bearer token and
 * runs the canonical SECURITY-DEFINER has_permission RPC under that token — true only for an
 * active member of that business whose permissions jsonb contains `perm`. `_rpc` is an
 * injectable test seam that replaces ONLY the network call, never the token guard (so the
 * no-token refusal is always exercised).
 */
export async function callerHoldsPermission(
  authHeader: string | undefined,
  businessId: string,
  perm: string,
  _rpc?: (token: string, businessId: string, perm: string) => Promise<boolean>,
): Promise<boolean> {
  const token = bearer(authHeader);
  if (!token) return false; // no caller token → refuse (the auth guard, before any RPC)
  if (_rpc) return _rpc(token, businessId, perm);
  const e = env();
  if (!e) return false;
  const caller = createClient(e.url, e.anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await caller.rpc('has_permission', { p_business_id: businessId, p_perm: perm });
  return !error && data === true;
}

/**
 * Is the CALLER the OWNER of `businessId`? Resolves the caller's uid from the token, then reads
 * businesses.owner_id under the caller's token (businesses_owner_select / businesses_member_select
 * both return the row's owner_id) and compares. True only when the caller IS the owner — a member
 * gets the owner's uid back and the comparison fails. `_resolve` is an injectable test seam.
 *
 * The owner path exists so an operation gated on "owner OR a manager permission" works for the
 * owner with ZERO dependency on the owner's member-row permissions jsonb (which may pre-date a
 * newly-added permission) — the owner is the owner by owner_id, always.
 */
export async function callerIsBusinessOwner(
  authHeader: string | undefined,
  businessId: string,
  _resolve?: (token: string, businessId: string) => Promise<boolean>,
): Promise<boolean> {
  const token = bearer(authHeader);
  if (!token) return false;
  if (_resolve) return _resolve(token, businessId);
  const e = env();
  if (!e) return false;
  const caller = createClient(e.url, e.anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await caller.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return false;
  const { data, error } = await caller
    .from('businesses').select('owner_id').eq('id', businessId).maybeSingle();
  return !error && (data as { owner_id?: string } | null)?.owner_id === uid;
}

/**
 * Resolve the CALLER's auth.uid() from the Bearer token (or null if no/invalid token). Used to
 * ATTRIBUTE a privileged act (e.g. a price-override give) to the acting user, server-side — never
 * a client-posted id. Only call after an authority gate (callerIsBusinessOwner / callerHoldsPermission)
 * has already confirmed the caller may perform the act.
 */
export async function resolveCallerUid(authHeader: string | undefined): Promise<string | null> {
  const token = bearer(authHeader);
  if (!token) return null;
  const e = env();
  if (!e) return null;
  const caller = createClient(e.url, e.anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await caller.auth.getUser();
  return data?.user?.id ?? null;
}
