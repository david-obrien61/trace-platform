/**
 * ── memberSession — sign a test in as a REAL member, under REAL RLS ───────────────────
 *
 * PURPOSE:      The 48 database-facing tests in the test inventory all block on one thing:
 *               a session that holds a specific permission set and issues real queries under
 *               real row-level security. This is that. `withMemberSession` mints an ephemeral
 *               principal, signs it in with the ANON key, hands the caller a scoped client,
 *               and deletes everything in a `finally`.
 * DEPENDENCIES: @supabase/supabase-js · packages/cultivar-os/.env.local (URL + SERVICE_KEY +
 *               ANON_KEY). No app code — this is test infrastructure.
 * OUTPUTS:      withMemberSession · withThrowawayCustomer · loadEnv · makeHarness · adminClient
 *
 * ════ THE RULE THIS FILE EXISTS TO OBEY ════
 * THE SERVICE KEY NEVER MAKES AN ASSERTION. It mints the principal, configures its permissions,
 * and tears it down — setup and teardown only. Every assertion runs on an ANON-key session
 * created by signInWithPassword, which is exactly what the browser does. A harness that asserts
 * with the service key bypasses RLS, and RLS is the thing under test: it would report green on a
 * platform with no policies at all.
 *
 * WHY THE SERVICE KEY IS UNAVOIDABLE FOR SETUP (not laziness — a deliberate door):
 * the permission funnel's §1 trigger (ledger #152) permits a role/permissions UPDATE on
 * business_members ONLY when `auth.uid() IS NULL` or the txn-local GUC the funnel sets. A
 * JWT-authenticated session — including the OWNER's — is refused. So a test cannot provision its
 * own member through an anon session. The service-key path is the documented open door
 * ("named, not hidden"), and this is a legitimate user of it.
 *
 * ════ EPHEMERAL, NOT REAL ════
 * This mints a THROWAWAY member, never `df7723be` or any real person. That is a deliberate
 * scope: a machine proves the POLICY is correct; a human proves a REAL MEMBER is configured
 * correctly. Only the first is automatable, and OP-14 says only David's live run marks an
 * owner-test card `covered`. This harness does not — and must never be read as — replacing a card.
 *
 * ════ MINT-AND-DELETE, NEVER CAPTURE-AND-RESTORE ════
 * `withThrowawayCustomer` creates its own row rather than editing a real customer and putting the
 * old value back. Capture-and-restore leaves damage when the process dies mid-run — and with a
 * demo close, "the phone number is wrong on a real customer and nobody knows which one" is not a
 * recoverable state. Nothing here touches a row a person made.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Read SUPABASE_URL / SERVICE_KEY / ANON_KEY from the gitignored env file. */
export function loadEnv() {
  const env = Object.fromEntries(
    readFileSync(join(REPO_ROOT, 'packages/cultivar-os/.env.local'), 'utf8')
      .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY in packages/cultivar-os/.env.local');
    process.exit(1);
  }
  return { url, serviceKey, anonKey };
}

/** The service-key client. SETUP AND TEARDOWN ONLY — never assert with this. */
export function adminClient() {
  const { url, serviceKey } = loadEnv();
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** The tiny pass/fail harness every test file in this repo uses. */
export function makeHarness() {
  const state = { passed: 0, failed: 0, failures: [] };
  const ok = (cond, msg, detail = '') => {
    if (cond) { state.passed++; console.log(`  ✅ ${msg}${detail ? ' — ' + detail : ''}`); }
    else { state.failed++; state.failures.push(msg); console.log(`  ❌ ${msg}${detail ? ' — ' + detail : ''}`); }
  };
  const done = (label) => {
    console.log(`\n=== ${label}: ${state.passed} pass / ${state.failed} fail ===`);
    if (state.failed > 0) console.error('FAILURES:\n' + state.failures.map((f) => ' - ' + f).join('\n'));
    return state.failed === 0 ? 0 : 1;
  };
  return { ok, done, state };
}

/**
 * Run `fn` as an ephemeral member of `businessId` holding exactly `permissions`.
 *
 * @param {object}   opts
 * @param {string}   opts.businessId  tenant to join
 * @param {string}   [opts.role]      business_members.role — default 'STAFF'
 * @param {string[]} opts.permissions the EXACT permission array the member holds
 * @param {string}   [opts.label]     name on the member row (shows up in audit trails)
 * @param {(ctx: {client, userId, memberId, businessId, admin, setPermissions}) => Promise<void>} fn
 *
 * `ctx.client` is the ANON-key signed-in client — assert on THIS.
 * `ctx.setPermissions(next)` re-grants mid-run; RLS re-evaluates live on the SAME session,
 * which is what proves a wall is permission-keyed rather than a blanket deny.
 */
export async function withMemberSession({ businessId, role = 'STAFF', permissions, label }, fn) {
  const { url, anonKey } = loadEnv();
  const admin = adminClient();
  const stamp = `${Date.now()}-${Math.floor(process.hrtime()[1] / 1000)}`;
  const email = `harness-${stamp}@example.com`;
  const password = `Harness!${stamp}`;
  let userId = null;
  let memberId = null;

  try {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (cErr) throw new Error(`createUser: ${cErr.message}`);
    userId = created.user.id;

    const { data: m, error: mErr } = await admin.from('business_members')
      .insert({
        business_id: businessId,
        user_id: userId,
        name: label ?? `Harness ${role}`,
        role,
        active: true,
        permissions,
      })
      .select('id').single();
    if (mErr) throw new Error(`business_members insert: ${mErr.message}`);
    memberId = m.id;

    // THE ASSERTION CLIENT — anon key, real RLS, exactly what the browser holds.
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: sErr } = await client.auth.signInWithPassword({ email, password });
    if (sErr) throw new Error(`member sign-in: ${sErr.message}`);

    const setPermissions = async (next) => {
      const { error } = await admin.from('business_members').update({ permissions: next }).eq('id', memberId);
      if (error) throw new Error(`setPermissions: ${error.message}`);
    };

    return await fn({ client, userId, memberId, businessId, admin, setPermissions });
  } finally {
    if (memberId) await admin.from('business_members').delete().eq('id', memberId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

/**
 * Mint a throwaway customer, run `fn(customer)`, delete it — always, even on throw.
 *
 * MINT-AND-DELETE by ruling (David, 2026-07-30). A test that edits a REAL customer and restores
 * the old value leaves that customer wrong if the process dies between the write and the restore.
 * There is no such window here: the row this creates has no meaning to anyone, so an abandoned
 * one is litter rather than corruption.
 */
export async function withThrowawayCustomer({ businessId, fields = {} }, fn) {
  const admin = adminClient();
  const stamp = Date.now();
  let customerId = null;
  try {
    const { data, error } = await admin.from('customers')
      .insert({
        business_id: businessId,
        first_name: 'Harness',
        last_name: `Throwaway ${stamp}`,
        phone: '(512) 555-0100',
        email: `harness-cust-${stamp}@example.com`,
        ...fields,
      })
      .select('*').single();
    if (error) throw new Error(`throwaway customer insert: ${error.message}`);
    customerId = data.id;
    return await fn(data);
  } finally {
    if (customerId) await admin.from('customers').delete().eq('id', customerId);
  }
}

/** Pick a tenant that actually has the data a test needs. Fails loudly rather than guessing. */
export async function requireBusinessId(preferred) {
  const admin = adminClient();
  if (preferred) return preferred;
  const { data } = await admin.from('businesses').select('id').limit(1);
  const id = data?.[0]?.id;
  if (!id) { console.error('No business rows — cannot run an RLS test against an empty tenant.'); process.exit(1); }
  return id;
}
