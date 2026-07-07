// PURPOSE:      Owner-side reads/writes of the shared member_devices spine (the device axis of
//               the agnostic member console). Lists devices per business, toggles is_active
//               (lockout), and deletes a device row. Runs with the owner's authenticated session
//               (RLS md_owner_all: business owner manages all devices in their business).
// DEPENDENCIES: member_devices (20260602_shared_members_a_create_tables.sql) — the D-31 device
//               spine (enroll + is_active lockout). Device type in ./types.
// OUTPUTS:      listDevicesByBusiness, listOwnDevices, setDeviceActive, deleteDevice. Agnostic — no
//               vertical nouns; both verticals' consoles/profiles call these with their own client.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Device } from './types';

/** All devices in a business (owner-scoped by RLS md_owner_all), newest first. */
export async function listDevicesByBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Device[]> {
  const { data, error } = await supabase
    .from('member_devices')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listDevicesByBusiness: ${error.message}`);
  return (data ?? []) as Device[];
}

/**
 * A member's OWN enrolled devices (self-service Profile surface), newest first.
 * Scoped to member_id so an owner-operator's Profile shows only their own devices — NOT the
 * whole business (md_owner_all would otherwise return every device). RLS md_self is the real
 * boundary (only the caller's own active-membership rows are visible); the member_id filter is
 * the correct scope on top of it.
 */
export async function listOwnDevices(
  supabase: SupabaseClient,
  memberId: string,
): Promise<Device[]> {
  const { data, error } = await supabase
    .from('member_devices')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listOwnDevices: ${error.message}`);
  return (data ?? []) as Device[];
}

/** Lock out / re-enable a device (is_active toggle). */
export async function setDeviceActive(
  supabase: SupabaseClient,
  deviceId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('member_devices')
    .update({ is_active: active })
    .eq('id', deviceId);
  if (error) throw new Error(`setDeviceActive: ${error.message}`);
}

/** Permanently remove a device row (a fresh enroll re-creates it on next login). */
export async function deleteDevice(
  supabase: SupabaseClient,
  deviceId: string,
): Promise<void> {
  const { error } = await supabase.from('member_devices').delete().eq('id', deviceId);
  if (error) throw new Error(`deleteDevice: ${error.message}`);
}
