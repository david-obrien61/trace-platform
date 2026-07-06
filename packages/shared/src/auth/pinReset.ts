// PURPOSE:      Agnostic PIN-reset spine (D-31) — the RESET-SCREEN path. Two owner/member actions
//               over the existing business_members.pin_hash column (NO new table, NO new column,
//               NO Vercel function): (1) armPinReset — the OWNER revokes a member's current PIN
//               (nulls pin_hash) so the member is forced to set a fresh one; (2) setOwnPin — the
//               MEMBER writes a new pin_hash for THEIR OWN membership under bm_self_update.
//               The reset is authorized by owner-arm + the member's own Supabase session (the real
//               auth boundary per the locked auth rule — PIN is a gesture ON a session), NOT a
//               stored URL bearer token. Reuses hashPin (same algorithm as authenticateMember).
// DEPENDENCIES: business_members.pin_hash (20260603_business_members_add_pin_hash.sql) · hashPin
//               (../supabase/auth). RLS: bm_owner_all (owner arms any member in their business),
//               bm_self_select/bm_self_update (member reads+writes their own row). The authority
//               trigger guards role/permissions only — pin_hash writes pass.
// OUTPUTS:      armPinReset, loadOwnMemberships, setOwnPin, changeOwnPin. Agnostic — no vertical
//               nouns; both verticals' consoles/reset-screen/profile call these with their client.
//               changeOwnPin = member self-service PIN change from Your Profile (re-auth with current
//               PIN → set new), reusing hashPin + setOwnPin over the same pin_hash column.

import type { SupabaseClient } from '@supabase/supabase-js';
import { hashPin } from '../supabase/auth';

/** A membership the signed-in user owns, as the reset screen sees it. */
export interface OwnMembership {
  id: string;
  business_id: string;
  name: string;
  business_name: string | null;
  pin_armed: boolean;   // true = owner nulled pin_hash → a reset is pending
}

/**
 * OWNER action — revoke a member's current PIN (null pin_hash). The member must then set a fresh
 * PIN via the reset screen. Runs under bm_owner_all (owner manages all members in their business).
 * Does NOT touch role/permissions, so the authority-immutability trigger never fires.
 */
export async function armPinReset(
  supabase: SupabaseClient,
  memberId: string,
): Promise<void> {
  const { error } = await supabase
    .from('business_members')
    .update({ pin_hash: null })
    .eq('id', memberId);
  if (error) throw new Error(`armPinReset: ${error.message}`);
}

/**
 * MEMBER action — the memberships the signed-in user owns (by auth.uid()). The reset screen reads
 * these to resolve which membership to reset (matched against the optional ?m=memberId hint) and
 * to show whether a reset is armed. bm_self_select scopes to the caller's own rows.
 */
export async function loadOwnMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<OwnMembership[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select('id, business_id, name, pin_hash, businesses(name)')
    .eq('user_id', userId);
  if (error) throw new Error(`loadOwnMemberships: ${error.message}`);
  return (data ?? []).map((r) => {
    const rec = r as unknown as {
      id: string; business_id: string; name: string; pin_hash: string | null;
      businesses: { name: string } | { name: string }[] | null;
    };
    const bizRaw = rec.businesses;
    const biz = Array.isArray(bizRaw) ? (bizRaw[0] ?? null) : bizRaw;
    return {
      id: rec.id,
      business_id: rec.business_id,
      name: rec.name,
      business_name: biz?.name ?? null,
      pin_armed: rec.pin_hash === null,
    };
  });
}

/**
 * MEMBER action — set a new PIN for the caller's OWN membership. Writes hashPin(businessId, pin)
 * (same salted algorithm authenticateMember verifies against) under bm_self_update. Guarded to the
 * caller's own row by id + user_id so a member can only set their own PIN.
 */
export async function setOwnPin(
  supabase: SupabaseClient,
  memberId: string,
  businessId: string,
  userId: string,
  pin: string,
): Promise<void> {
  const pinHash = await hashPin(businessId, pin);
  const { error } = await supabase
    .from('business_members')
    .update({ pin_hash: pinHash })
    .eq('id', memberId)
    .eq('user_id', userId);
  if (error) throw new Error(`setOwnPin: ${error.message}`);
}

/**
 * MEMBER action — change the caller's OWN PIN from Your Profile. The member's live Supabase session
 * is the real auth boundary (same as the reset screen); the current-PIN re-auth is a confirmation
 * gesture that stops a change on an unattended, already-unlocked session. Verifies the supplied
 * current PIN against the stored pin_hash (salted hashPin — the same value authenticateMember checks),
 * then writes the new PIN via setOwnPin. If no PIN is set yet (pin_hash null), this is a first SET and
 * the current-PIN check is skipped. Reuses hashPin + setOwnPin; NO new table/column/Vercel function.
 */
export async function changeOwnPin(
  supabase: SupabaseClient,
  memberId: string,
  businessId: string,
  userId: string,
  currentPin: string,
  newPin: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('business_members')
    .select('pin_hash')
    .eq('id', memberId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`changeOwnPin: ${error.message}`);
  const stored = (data as { pin_hash: string | null } | null)?.pin_hash ?? null;
  if (stored !== null) {
    const currentHash = await hashPin(businessId, currentPin);
    if (currentHash !== stored) throw new Error('Current PIN is incorrect.');
  }
  await setOwnPin(supabase, memberId, businessId, userId, newPin);
}
