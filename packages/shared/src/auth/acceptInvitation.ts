import type { SupabaseClient } from '@supabase/supabase-js';
import type { AcceptInviteResult, InvitePreview } from './types';
import { findOrCreatePerson } from '../business-logic/personUpsert';

// Server-side functions. Must be called from a Vercel serverless function
// that initialises Supabase with the service role key (bypasses RLS).
// The accepting user has no session yet — they don't exist in auth.users.

// Validates a token and returns enough info to render the AcceptInvite page.
// Use this in a GET handler: GET /api/members/preview-invite?token={token}
export async function previewInvitation(
  serviceSupabase: SupabaseClient,
  token: string
): Promise<InvitePreview> {
  const now = new Date().toISOString();

  const { data, error } = await serviceSupabase
    .from('invitations')
    .select('name, role, used, expires_at, businesses(name)')
    .eq('token', token)
    .single();

  if (error || !data) return { valid: false, reason: 'invalid' };
  if (data.used) return { valid: false, reason: 'used' };
  if (data.expires_at < now) return { valid: false, reason: 'expired' };

  const biz = data.businesses as unknown as { name: string } | null;
  return {
    valid: true,
    businessName: biz?.name ?? 'Unknown Business',
    invitedName: data.name,
    role: data.role,
  };
}

export interface AcceptInvitationInput {
  token: string;
  email: string;          // the accepting user's email for Supabase auth account
  password: string;       // chosen password for the new account
  displayName?: string;   // overrides the pre-filled invited name if provided
}

// Validates token, creates Supabase auth account (or finds existing), activates member.
// Use this in a POST handler: POST /api/members/accept-invite
// Body: { token, email, password, displayName? }
//
// Error strings thrown (catch and return appropriate HTTP status):
//   INVALID_TOKEN    — token not found, already used, or expired
//   MEMBER_ROW_NOT_FOUND — invite exists but business_members row is missing (data integrity issue)
//   AUTH_CREATE_FAILED   — Supabase auth error during user creation
//   USER_LOOKUP_FAILED   — user already registered but couldn't look up their ID
//   ACTIVATE_FAILED      — business_members update failed
export async function acceptInvitation(
  serviceSupabase: SupabaseClient,
  input: AcceptInvitationInput
): Promise<AcceptInviteResult> {
  const now = new Date().toISOString();

  // 1. Validate token — single query with business name join
  const { data: invitation, error: invErr } = await serviceSupabase
    .from('invitations')
    .select('id, business_id, name, role, used, expires_at, businesses(id, name)')
    .eq('token', input.token)
    .single();

  if (invErr || !invitation) throw new Error('INVALID_TOKEN');
  if (invitation.used) throw new Error('INVALID_TOKEN');
  if (invitation.expires_at < now) throw new Error('INVALID_TOKEN');

  // 2. Find the pre-created inactive business_members row
  const { data: member, error: memErr } = await serviceSupabase
    .from('business_members')
    .select('id, permissions, role')
    .eq('invite_id', invitation.id)
    .eq('active', false)
    .single();

  if (memErr || !member) throw new Error('MEMBER_ROW_NOT_FOUND');

  // 3. Create or find Supabase auth account
  let userId: string;

  const inviteName = input.displayName ?? invitation.name;

  const { data: created, error: createErr } = await serviceSupabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    // PERSON NAME source of truth = auth.user_metadata.full_name. Seed it (NOT 'name')
    // from the invite so the bootstrap name becomes the new person's identity on account
    // creation. Keep legacy 'name' too for any older readers.
    user_metadata: { full_name: inviteName, name: inviteName },
  });

  if (createErr) {
    const alreadyExists =
      createErr.message.includes('already been registered') ||
      createErr.message.includes('already exists') ||
      createErr.message.includes('already registered');

    if (alreadyExists) {
      // User has an existing account — find their ID
      const { data: list } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users?.find(u => u.email === input.email);
      if (!existing) throw new Error('USER_LOOKUP_FAILED');
      userId = existing.id;
      // Bootstrap→person bridge: an existing user accepting an invite may have no
      // full_name yet. Seed it from the invite name ONLY if absent — never overwrite a
      // real person name the user already set (their own identity wins).
      const existingFullName = (existing.user_metadata as { full_name?: string } | null)?.full_name;
      if (!existingFullName || !existingFullName.trim()) {
        await serviceSupabase.auth.admin.updateUserById(userId, {
          user_metadata: { ...(existing.user_metadata ?? {}), full_name: inviteName },
        });
      }
    } else {
      throw new Error(`AUTH_CREATE_FAILED: ${createErr.message}`);
    }
  } else {
    userId = created.user.id;
  }

  // 3b. Person-spine: create-or-link the accepting user's global person (service key).
  //     Non-blocking overlay — a person failure must NOT block member activation.
  let personId: string | null = null;
  try {
    const person = await findOrCreatePerson(serviceSupabase, {
      authUserId: userId,
      fullName:   inviteName,
      email:      input.email,
    });
    personId = person.personId;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[TRACE:PERSON] invite-accept person link failed — proceeding without person link', {
      userId, businessId: invitation.business_id, error: msg,
    });
  }

  // 4. Activate the business_members row (link the person if resolved)
  const activatePatch: Record<string, unknown> = {
    user_id: userId,
    active: true,
    name: inviteName,            // display-fallback copy on the membership row
  };
  if (personId) activatePatch.person_id = personId;

  const { error: activateErr } = await serviceSupabase
    .from('business_members')
    .update(activatePatch)
    .eq('id', member.id);

  if (activateErr) throw new Error(`ACTIVATE_FAILED: ${activateErr.message}`);

  // 5. Mark invitation used + link the person (after activation so partial failures don't
  //    consume the token). person_id is overlay — its absence never fails the accept.
  const invitePatch: Record<string, unknown> = { used: true };
  if (personId) invitePatch.person_id = personId;
  await serviceSupabase
    .from('invitations')
    .update(invitePatch)
    .eq('id', invitation.id);

  const biz = invitation.businesses as unknown as { id: string; name: string } | null;

  return {
    businessId: invitation.business_id,
    businessName: biz?.name ?? 'Unknown Business',
    memberId: member.id,
    role: member.role as string,
    permissions: (member.permissions as string[]) ?? [],
  };
}
