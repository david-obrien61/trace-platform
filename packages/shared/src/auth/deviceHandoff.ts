// PURPOSE:      Self-device-handoff via QR (D-31 device spine). An ALREADY-authenticated member
//               gets their OWN new device onto their account with no URL/email/password typing.
//               Distinct from the invite flow (createInvitation/acceptInvitation) — invite CREATES
//               a new account; handoff AUTHENTICATES an existing member onto a new device.
// DEPENDENCIES: member_device_handoffs (20260706_member_device_handoffs.sql) — the short-lived,
//               single-use, device-bound bearer-token table + its RLS (mdh_self_insert enforces
//               "issued only from an authenticated session"). member_devices — the enrollment spine.
//               Supabase admin.generateLink(magiclink) + verifyOtp(token_hash) — the passwordless
//               session-mint mechanism (generateLink only GENERATES; it does not send email, so the
//               broken-SMTP launch gate is irrelevant).
// OUTPUTS:      issueDeviceHandoff (client, authenticated session → RLS insert → token) ·
//               exchangeDeviceHandoff (SERVER, service key → validate + atomic consume + device-bind
//               + generateLink + enroll → token_hash for the new device to verifyOtp).
//               Agnostic — no vertical nouns; both verticals call these with their own clients.

import type { SupabaseClient } from '@supabase/supabase-js';

// ── ISSUE (client-side, runs with the member's authenticated session) ──────────────

export interface IssueDeviceHandoffResult {
  token: string;
  expiresAt: string;   // ISO — the issuing UI shows a short-lived note / countdown
}

/**
 * Mint a short-lived single-use handoff token for the CALLER'S OWN membership.
 * Runs under the member's session; the mdh_self_insert RLS policy is the real guard —
 * it refuses any attempt to mint a handoff for a membership the caller doesn't own.
 * Returns the token to render as a QR ({baseUrl}/device-handoff?token=…).
 */
export async function issueDeviceHandoff(
  supabase: SupabaseClient,
  businessId: string,
  memberId: string,
): Promise<IssueDeviceHandoffResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('NOT_AUTHENTICATED');

  const { data, error } = await supabase
    .from('member_device_handoffs')
    .insert({
      business_id: businessId,
      member_id: memberId,
      issued_by: user.id,   // must equal auth.uid() — RLS WITH CHECK enforces it
    })
    .select('token, expires_at')
    .single();

  if (error || !data) {
    throw new Error(`issueDeviceHandoff: ${error?.message ?? 'no data returned'}`);
  }

  console.log('[TRACE:HANDOFF] issue', { businessId, memberId, issuedBy: user.id, expiresAt: data.expires_at });
  return { token: data.token as string, expiresAt: data.expires_at as string };
}

// ── EXCHANGE (server-side, service key — the new device has no session) ─────────────

export interface ExchangeDeviceHandoffInput {
  token: string;
  deviceFingerprint: string;   // the scanning device's stable fingerprint (bound on consume)
  deviceLabel?: string;        // human label ("iPhone", "iPad") for the enrolled row
}

export interface ExchangeDeviceHandoffResult {
  tokenHash: string;   // magic-link token_hash → the new device calls verifyOtp({ token_hash })
  businessId: string;
  memberId: string;
}

// Error strings thrown (endpoint maps to HTTP status, mirrors acceptInvitation):
//   INVALID_TOKEN   — not found
//   EXPIRED         — past expires_at
//   USED            — already consumed (single-use)
//   MEMBER_NOT_FOUND / MEMBER_NO_USER — data integrity: membership gone or never activated
//   EMAIL_LOOKUP_FAILED — could not resolve the member's auth email
//   LINK_FAILED     — generateLink failed
export async function exchangeDeviceHandoff(
  serviceSupabase: SupabaseClient,
  input: ExchangeDeviceHandoffInput,
): Promise<ExchangeDeviceHandoffResult> {
  const now = new Date();

  // 1. Load + validate the handoff (service key bypasses RLS by design — no session here).
  const { data: handoff, error: hErr } = await serviceSupabase
    .from('member_device_handoffs')
    .select('id, business_id, member_id, used, expires_at')
    .eq('token', input.token)
    .maybeSingle();

  if (hErr || !handoff) throw new Error('INVALID_TOKEN');
  if (handoff.used) throw new Error('USED');
  if (new Date(handoff.expires_at as string) < now) throw new Error('EXPIRED');

  // 2. Resolve the member → auth user → email (authoritative; generateLink needs the real email).
  const { data: member, error: mErr } = await serviceSupabase
    .from('business_members')
    .select('user_id, active')
    .eq('id', handoff.member_id)
    .maybeSingle();

  if (mErr || !member) throw new Error('MEMBER_NOT_FOUND');
  if (!member.user_id) throw new Error('MEMBER_NO_USER');

  const { data: authUser, error: uErr } = await serviceSupabase.auth.admin.getUserById(
    member.user_id as string,
  );
  const email = authUser?.user?.email;
  if (uErr || !email) throw new Error('EMAIL_LOOKUP_FAILED');

  // 3. Generate the passwordless magic-link token BEFORE consuming — a failure here must not
  //    burn the token. generateLink only GENERATES (no email sent); we hand the hash to the device.
  const { data: link, error: lErr } = await serviceSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (lErr || !tokenHash) throw new Error('LINK_FAILED');

  // 4. Atomic single-use consume + device-bind: flip used=true and record the fingerprint in ONE
  //    write, guarded by used=false + not-expired. If 0 rows come back, another scan raced us —
  //    refuse (do NOT return the link). This is the single-use + device-bound guardrail, race-safe.
  const { data: consumed, error: cErr } = await serviceSupabase
    .from('member_device_handoffs')
    .update({ used: true, used_at: now.toISOString(), device_fingerprint: input.deviceFingerprint })
    .eq('id', handoff.id)
    .eq('used', false)
    .gt('expires_at', now.toISOString())
    .select('id')
    .maybeSingle();

  if (cErr || !consumed) throw new Error('USED');
  console.log('[TRACE:HANDOFF] consume', { businessId: handoff.business_id, memberId: handoff.member_id });

  // 5. Enroll the new device in the member_devices spine (best-effort — a session is being minted
  //    regardless; an enrollment hiccup must not block the login). Skip if somehow already enrolled.
  try {
    const { data: existing } = await serviceSupabase
      .from('member_devices')
      .select('id')
      .eq('member_id', handoff.member_id)
      .eq('device_fingerprint', input.deviceFingerprint)
      .maybeSingle();
    if (!existing) {
      await serviceSupabase.from('member_devices').insert({
        member_id: handoff.member_id,
        business_id: handoff.business_id,
        device_fingerprint: input.deviceFingerprint,
        device_label: input.deviceLabel ?? 'New device',
        is_active: true,
        last_seen: now.toISOString(),
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[TRACE:HANDOFF] enroll failed — proceeding (session still minted)', { error: msg });
  }

  return {
    tokenHash,
    businessId: handoff.business_id as string,
    memberId: handoff.member_id as string,
  };
}
