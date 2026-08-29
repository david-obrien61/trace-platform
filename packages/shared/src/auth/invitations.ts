import type { SupabaseClient } from '@supabase/supabase-js';
import type { Invitation } from './types';

// Client-side invitation management.
//
// 🔴 CREATION MOVED BEHIND AN RPC 2026-08-28 (ruling: the OWNER role carries full authority).
// `createInvitation` used to run TWO client INSERTs under the caller session — the `invitations`
// row, then the paired inactive `business_members` row — with the new member's PERMISSION ARRAY
// TAKEN FROM THE REQUEST BODY. Two things were wrong with that and only one of them is about
// Lauren:
//   (1) it needed `bm_owner_all`, so an OWNER-ROLE member who is not `businesses.owner_id` got
//       the invitation row created and the member row REFUSED — a half-made invite whose
//       acceptance then fails with MEMBER_ROW_NOT_FOUND;
//   (2) the permissions array arrived FROM THE BROWSER. The owner's own client resolved it
//       honestly from the role floor; nothing in the system REQUIRED that. A member INSERT policy
//       could not have constrained it either, because the authority-immutability trigger is
//       BEFORE UPDATE and does not fire on an INSERT.
// `create_invitation` (SECURITY DEFINER, 20260828) authorises on `team:create`, RESOLVES the array
// server-side from the same role floor the Roles tab renders, writes both rows in ONE transaction,
// and audits. The `permissions` input is GONE rather than ignored — a parameter that is accepted
// and discarded is a parameter someone will keep believing in.
//
// Reads and revoke stay direct: `invitations_member_select` / `invitations_member_update`
// (20260828) gate both on `team:create`.

export interface CreateInvitationInput {
  businessId: string;
  name: string;
  email?: string;        // where to send invite email; optional for QR/SMS-only
  phone?: string;        // for SMS delivery
  role: string;
  // NO `permissions` FIELD. The server resolves it from the role floor — see the header.
}

export interface CreateInvitationResult {
  invitation: Pick<Invitation, 'id' | 'token'>;
  memberId: string;      // the pre-created inactive business_members row ID
  inviteLink: string;    // ready-to-share URL
  permissions: string[]; // what the server actually seeded, so the caller can SHOW it
}

/** The RPC's row shape. Named to match the function's OUT parameters exactly. */
interface CreateInvitationRow {
  applied: boolean;
  reason: string | null;
  invitation_id: string | null;
  invite_token: string | null;
  new_member_id: string | null;
  resolved_permissions: string[] | null;
}

// Creates an invitation row + its paired inactive business_members row, in ONE transaction,
// through the invite funnel. inviteBasePath is the route within the vertical's app (e.g. '/join').
// The full link becomes: {inviteBaseUrl}{inviteBasePath}?token={token}
export async function createInvitation(
  supabase: SupabaseClient,
  input: CreateInvitationInput,
  inviteBaseUrl: string,
  inviteBasePath = '/join'
): Promise<CreateInvitationResult> {
  // The actor is resolved from the SESSION, never from a caller argument — passing an actor id in
  // would be a forgery seam, and assert_movement_actor RAISES on a mismatch anyway.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const actorId = userData?.user?.id;
  if (userErr || !actorId) throw new Error('createInvitation: no signed-in user');

  const { data, error } = await supabase.rpc('create_invitation', {
    p_business_id:   input.businessId,
    p_actor_user_id: actorId,
    p_name:          input.name,
    p_role_key:      input.role,
    p_email:         input.email ?? null,
    p_phone:         input.phone ?? null,
  });

  if (error) throw new Error(`createInvitation: ${error.message}`);

  // A9 / read honesty — a SETOF function returns an ARRAY. Zero rows is not success, and the
  // funnel's contract is exactly one row in both the applied and the refused case.
  const row = (Array.isArray(data) ? data[0] : data) as CreateInvitationRow | undefined;
  if (!row) throw new Error('createInvitation: the invite funnel returned no row');
  if (!row.applied) throw new Error(row.reason ?? 'Invitation refused');
  if (!row.invitation_id || !row.invite_token || !row.new_member_id) {
    // Applied but incomplete would mean the contract changed under us. Refuse rather than hand
    // back a link built from an undefined token.
    throw new Error('createInvitation: the invite funnel applied but returned an incomplete row');
  }

  return {
    invitation: { id: row.invitation_id, token: row.invite_token },
    memberId: row.new_member_id,
    inviteLink: `${inviteBaseUrl}${inviteBasePath}?token=${row.invite_token}`,
    permissions: row.resolved_permissions ?? [],
  };
}

// Revokes a pending invitation by marking it used. The inactive business_members row
// stays so the owner can see who was invited; owner can delete it separately.
//
// A8 — `.select('id')` asks for EVIDENCE IT LANDED. An RLS refusal on an UPDATE comes back as ZERO
// ROWS AND NO ERROR, i.e. indistinguishable from success, and the list would then refresh showing
// the invite still pending with no explanation. Added 2026-08-28 because this write is now
// governed by a NEW policy (invitations_member_update) — a write whose permission just changed is
// exactly the one that must be able to say it was refused.
export async function revokeInvitation(
  supabase: SupabaseClient,
  invitationId: string
): Promise<void> {
  const { data: hit, error } = await supabase
    .from('invitations')
    .update({ used: true })
    .eq('id', invitationId)
    .select('id');

  if (error) throw new Error(`revokeInvitation: ${error.message}`);
  if (!hit?.length) {
    throw new Error('revokeInvitation: the invitation was not withdrawn — you may not have permission to change it');
  }
}

// Lists pending (unused, unexpired) invitations for a business.
export async function getPendingInvitations(
  supabase: SupabaseClient,
  businessId: string
): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('business_id', businessId)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getPendingInvitations: ${error.message}`);
  return (data ?? []) as Invitation[];
}

// Marks expired invitations as used. Run this as a cleanup task.
// Server-side only — requires service key to update rows the owner doesn't own.
export async function expireInvitations(serviceSupabase: SupabaseClient): Promise<number> {
  const { data, error } = await serviceSupabase
    .from('invitations')
    .update({ used: true })
    .eq('used', false)
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) throw new Error(`expireInvitations: ${error.message}`);
  return (data ?? []).length;
}
