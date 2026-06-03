import type { SupabaseClient } from '@supabase/supabase-js';
import type { Member, Role } from './types';

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

// Pure function — no DB call.
// Pass the member's permissions array and the permission name to check.
// Verticals define what each permission string means.
export function checkPermission(permissions: string[], permissionName: string): boolean {
  return permissions.includes(permissionName);
}
