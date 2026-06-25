/**
 * ── PERSON UPSERT (shared) · Person-spine build · 2026-06-25 ────────────────────
 *
 * PURPOSE      The ONE shared create-or-link for the global `people` spine (§6.8 — not
 *              copied per path). Resolves a human to a single person row across every role
 *              they play (owner / member / invited worker / customer). Used by owner signup,
 *              invite accept, and customer upsert.
 * DEPENDENCIES A supabase client passed in (browser-anon under RLS for owner signup;
 *              service-key for invite/customer paths); the `people` table; normalizePhone.
 *              No DB client constructed here.
 * OUTPUTS      { personId, created } — created:true = inserted, false = matched an existing person.
 * RULE         person_id is an OVERLAY, never the auth principal — see person-spine-recon.md (R4).
 *
 * RESOLVE PRECEDENCE:
 *   1. authUserId present  → match people.auth_user_id (the auth principal is the strongest key).
 *   2. no auth account     → match by email, then phone, AMONG AUTH-LESS people only
 *                            (auth_user_id IS NULL) so a customer never collapses onto an
 *                            owner's account-person. Global (no business scope) — same human
 *                            across businesses = one person.
 *   3. no identifier       → always insert (D-9: never fabricate a key to match on).
 */

import { normalizePhone } from '../utils/normalizePhone';

export interface PersonInput {
  authUserId?: string | null; // auth.users.id when this person has an auth account
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PersonResult {
  personId: string;
  created: boolean; // true = inserted, false = matched an existing person
}

function deriveFullName(input: PersonInput): string | null {
  if (input.fullName && input.fullName.trim()) return input.fullName.trim();
  const joined = [input.firstName, input.lastName]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return joined.length > 0 ? joined : null;
}

function personRow(input: PersonInput) {
  return {
    auth_user_id: input.authUserId ?? null,
    first_name:   input.firstName?.trim() || null,
    last_name:    input.lastName?.trim() || null,
    full_name:    deriveFullName(input),
    email:        input.email?.trim() || null,
    phone:        normalizePhone(input.phone),
  };
}

export async function findOrCreatePerson(
  db: any,
  input: PersonInput,
): Promise<PersonResult> {
  // 1. Strongest key: the auth principal. A person WITH an auth account IS that account.
  if (input.authUserId) {
    const { data: existing } = await db
      .from('people')
      .select('id')
      .eq('auth_user_id', input.authUserId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('[TRACE:PERSON] resolve: matched by auth_user_id', {
        personId: existing[0].id, authUserId: input.authUserId,
      });
      return { personId: existing[0].id, created: false };
    }

    const { data: created, error } = await db
      .from('people').insert(personRow(input)).select('id').single();
    if (error) throw new Error(`Person: ${error.message}`);
    console.log('[TRACE:PERSON] create: new person (auth-linked)', {
      personId: created!.id, authUserId: input.authUserId,
    });
    return { personId: created!.id, created: true };
  }

  // 2. No auth account (customer / invited worker). Resolve by email, then phone, among
  //    auth-less people only — so a phone-only repeat does NOT double-insert and a customer
  //    never silently collapses onto an owner's account-person.
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone);

  if (email) {
    const { data } = await db
      .from('people').select('id').is('auth_user_id', null).eq('email', email).limit(1);
    if (data && data.length > 0) {
      console.log('[TRACE:PERSON] resolve: matched auth-less person by email', { personId: data[0].id });
      return { personId: data[0].id, created: false };
    }
  }
  if (phone) {
    const { data } = await db
      .from('people').select('id').is('auth_user_id', null).eq('phone', phone).limit(1);
    if (data && data.length > 0) {
      console.log('[TRACE:PERSON] resolve: matched auth-less person by phone', { personId: data[0].id });
      return { personId: data[0].id, created: false };
    }
  }

  // 3. No identifier matched → insert a fresh person.
  const { data: created, error } = await db
    .from('people').insert(personRow(input)).select('id').single();
  if (error) throw new Error(`Person: ${error.message}`);
  console.log('[TRACE:PERSON] create: new person (contact-only)', {
    personId: created!.id, hasEmail: !!email, hasPhone: !!phone,
  });
  return { personId: created!.id, created: true };
}
