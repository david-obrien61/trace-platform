import type { SupabaseClient } from '@supabase/supabase-js';
import type { Member, Role } from './types';
import { normalizePhone } from '../utils/normalizePhone';

// All functions here run client-side with the owner's authenticated session.
// RLS policy bm_owner_all grants the owner full access to all member rows
// for businesses they own. Cross-member reads by non-owner members use the
// service key endpoint in each vertical's Vercel functions.

export async function getMembersByBusiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<Member[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getMembersByBusiness: ${error.message}`);
  return (data ?? []) as Member[];
}

export async function updateMemberRole(
  supabase: SupabaseClient,
  memberId: string,
  role: Role,
  permissions: string[]
): Promise<void> {
  const { error } = await supabase
    .from('business_members')
    .update({ role, permissions })
    .eq('id', memberId);

  if (error) throw new Error(`updateMemberRole: ${error.message}`);
}

export async function removeMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<void> {
  const { error } = await supabase
    .from('business_members')
    .delete()
    .eq('id', memberId);

  if (error) throw new Error(`removeMember: ${error.message}`);
}

// Soft deactivate / reactivate — flips business_members.active. active=false blocks the member
// at the RLS layer (is_active_member) without deleting history; active=true restores access.
// Owner-scoped by bm_owner_all. Touches only `active`, never role/permissions, so the authority
// trigger never fires. The reversible counterpart to removeMember's hard delete.
export async function setMemberActive(
  supabase: SupabaseClient,
  memberId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from('business_members')
    .update({ active })
    .eq('id', memberId);

  if (error) throw new Error(`setMemberActive: ${error.message}`);
}

// Owner sets/edits a member's PHONE (the SMS-reset target + contact number). Owner-scoped by
// bm_owner_all — the owner may write any member row on a business they own. Touches ONLY `phone`,
// never role/permissions, so the authority-immutability trigger never fires. Value is run through
// the ONE shared storage normalization (same as Profile/Settings). NOTE: email is deliberately
// NOT writable here — email is the login credential (auth.users.email) and is immutable from the app.
export async function setMemberPhone(
  supabase: SupabaseClient,
  memberId: string,
  phone: string
): Promise<void> {
  const { error } = await supabase
    .from('business_members')
    .update({ phone: normalizePhone(phone) })   // phone ONLY — never role/permissions/email
    .eq('id', memberId);

  if (error) throw new Error(`setMemberPhone: ${error.message}`);
}

// Pure function — no DB call.
// Pass the member's permissions array and the permission name to check.
// Verticals define what each permission string means.
export function checkPermission(permissions: string[], permissionName: string): boolean {
  return permissions.includes(permissionName);
}
