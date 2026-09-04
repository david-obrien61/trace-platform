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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE SEVEN-DAY CLOCK, AND THE SENTENCE THAT STATES IT
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THIS EXISTS BECAUSE A CARD READ THIS COLUMN NOWHERE. Measured 2026-09-04: `invitations
// .expires_at` had SIX readers in the whole repo — two query filters, two accept-path checks, and
// two list rows — and the INVITE — LINK & QR card, the one surface that hands somebody a link,
// was none of them. So a live invite on day 6 rendered identically to one on day 1, and at the
// moment of expiry the card DISAPPEARED with no statement at all. David: "I could have sent that
// QR this morning and he would have hit a dead end."
//
// ONE helper, consumed by both team surfaces, because two spellings of one fact is the drift
// STD-011 names and the redundant copy is the one that goes stale.
//
// ⚠️ FORMATTED WITHOUT `toLocaleDateString` ON PURPOSE. The two existing list rows use it, and a
// label built through the runner's locale is a check that can disagree for a reason that has
// nothing to do with the code. The month names are spelled out here so a probe asserts the
// SENTENCE rather than the environment.

/** The invitation TTL, in days. Mirrors `invitations.expires_at DEFAULT (now() + interval '7 days')`
 *  (20260602_shared_members_a_create_tables.sql:97) and `reset_invitation_expiry`'s own interval.
 *  ⚠️ THREE REPRESENTATIONS OF ONE NUMBER, AND THAT IS KNOWN: a column default and a plpgsql body
 *  cannot import a TypeScript constant (the same wall 20260726_permission_alias_layer.sql:264-290
 *  records). This one exists so the COPY stops carrying a hand-typed 7 in three sentences. */
export const INVITE_TTL_DAYS = 7;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

export interface InvitationValidity {
  expired: boolean;
  /** "valid until 11 September" · "expired 3 September" — a DATE, never a relative phrase. */
  label: string;
}

/**
 * What an invitation's expiry says, both directions.
 *
 * 🔴 THE BOUNDARY IS DELIBERATE AND IT MATCHES THE SERVER. `acceptInvitation.ts:68` refuses on
 * `invitation.expires_at < now`, so an invitation whose expiry is EXACTLY now is refused by the
 * accept path. A card calling that one "valid" would be the false claim, not the honest one —
 * so `expired` is `<=`, i.e. a card is never more optimistic than the door it points at.
 */
export function invitationValidity(expiresAt: string, now: Date = new Date()): InvitationValidity {
  const when = new Date(expiresAt);
  const expired = when.getTime() <= now.getTime();
  const sameYear = when.getFullYear() === now.getFullYear();
  const day = `${when.getDate()} ${MONTHS[when.getMonth()]}${sameYear ? '' : ` ${when.getFullYear()}`}`;
  return { expired, label: expired ? `expired ${day}` : `valid until ${day}` };
}

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

/** The RPC's row shape. Named to match the function's OUT parameters exactly. */
interface ResetInvitationRow {
  applied: boolean;
  reason: string | null;
  new_expires_at: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// RESET INVITE — extends a PENDING invitation by seven days from now. SAME TOKEN.
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SAME TOKEN, NOT A NEW ONE, AND THAT IS THE SAFETY PROPERTY RATHER THAN A CONVENIENCE. The
// paired `business_members` row links by `invite_id` and `acceptInvitation` resolves it that way
// (acceptInvitation.ts:74) — never by the token — so extending in place cannot break the linkage.
// A NEW invitation would: `create_invitation` INSERTs a member row with no dedup and
// `business_members` has no unique index, so a second invite mints a SECOND inactive row and the
// accept leaves one of them a permanent orphan that `removeMember` will not clear. Do not reach
// for "just invite them again" — see the migration header for the measurement.
//
// 🔴 AN RPC RATHER THAN A CLIENT UPDATE, and the reason is not ceremony. `invitations_member_update`
// (20260828:219-226) is COLUMN-BLIND — there is no column-level GRANT on `invitations` anywhere in
// the corpus — so the identical door that would permit `SET expires_at` also permits
// `SET role = 'OWNER'` on a pending invitation, whose role is copied onto the member row at accept
// time. And a client UPDATE would need its own audit INSERT, i.e. two writes from a browser that
// can half-land: exactly the shape `create_invitation` retired for this table eight days ago.
export async function resetInvitationExpiry(
  supabase: SupabaseClient,
  businessId: string,
  invitationId: string
): Promise<{ newExpiresAt: string }> {
  // The actor is resolved from the SESSION, never from a caller argument — passing an actor id in
  // would be a forgery seam, and assert_movement_actor RAISES on a mismatch anyway.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const actorId = userData?.user?.id;
  if (userErr || !actorId) throw new Error('resetInvitationExpiry: no signed-in user');

  const { data, error } = await supabase.rpc('reset_invitation_expiry', {
    p_business_id:   businessId,
    p_actor_user_id: actorId,
    p_invitation_id: invitationId,
  });

  if (error) throw new Error(`resetInvitationExpiry: ${error.message}`);

  // A9 / read honesty — a SETOF function returns an ARRAY. Zero rows is not success, and the
  // funnel's contract is exactly one row in both the applied and the refused case.
  const row = (Array.isArray(data) ? data[0] : data) as ResetInvitationRow | undefined;
  if (!row) throw new Error('resetInvitationExpiry: the reset funnel returned no row');
  if (!row.applied) throw new Error(row.reason ?? 'The invitation could not be reset');
  if (!row.new_expires_at) {
    // Applied but incomplete would mean the contract changed under us. Refuse rather than tell the
    // owner a date we do not have.
    throw new Error('resetInvitationExpiry: the reset funnel applied but returned no new expiry');
  }

  return { newExpiresAt: row.new_expires_at };
}

// Lists PENDING invitations for a business — unaccepted and unwithdrawn, EXPIRED OR NOT.
//
// 🔴 THE EXPIRY FILTER WAS REMOVED 2026-09-04 (ledger #274) AND ITS ABSENCE IS THE FEATURE. This
// query used to carry `.gt('expires_at', new Date().toISOString())`, and that one line is why
// Joel's invitation vanished from every screen the moment it died: both team surfaces render
// their pending list and the per-person INVITE — LINK & QR card from THIS result, so an expired
// invitation had no row anywhere to hang a date, an explanation or a Reset button on. It did not
// read as expired; it read as though it had never existed.
//
// That is the six-state ruling's own defect — "A page without access RENDERS AND SAYS SO — it
// never redirects. Withheld data ANNOUNCES its redaction" — and S1's: "Pending invites" was a
// true header only because the query hid every row that would have contradicted it.
//
// ⚠️ THE CONSEQUENCE IS DELIBERATE AND IT IS DAVID'S RULING: expired invitations now REAPPEAR on
// both team surfaces. Every consumer must therefore state validity per row (`invitationValidity`)
// — a row that says nothing now says the wrong thing.
export async function getPendingInvitations(
  supabase: SupabaseClient,
  businessId: string
): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('business_id', businessId)
    .eq('used', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getPendingInvitations: ${error.message}`);
  return (data ?? []) as Invitation[];
}

// Marks expired invitations as used. Server-side only — requires the service key to update rows
// the owner doesn't own.
//
// 🔴 DO NOT WIRE THIS WITHOUT A RULING. IT WOULD SILENTLY DESTROY THE RESET PATH. It flips every
// expired invitation to `used = true`, and `used = true` is exactly what `reset_invitation_expiry`
// refuses — so running it once would tombstone every invitation the Reset invite button exists to
// rescue, and Joel's case would become unrecoverable by any means except a new invite (which mints
// the orphan member row described in 20260904b's header). It also removes the row from
// `getPendingInvitations`, so the person would vanish from both team surfaces again — the very
// disappearance ledger #274 was built to stop.
//
// ⚠️ IT HAS ZERO CALLERS AND HAS NEVER HAD ANY — grepped across `packages/`, `api/` and `scripts/`
// on 2026-09-04; the only reference is its own export in `index.ts`. The hazard is not that it
// runs, it is that it READS LIKE HOUSEKEEPING: the next person tidying up finds a function whose
// comment used to say "Run this as a cleanup task" and does. That sentence is why this block
// exists. Expiry is now a DISPLAYED STATE, not a thing to sweep away.
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
