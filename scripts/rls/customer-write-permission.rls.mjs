/**
 * ── CARD 7 — a save that cannot write must NOT say it saved · RLS PROOF ───────────────
 *
 * PURPOSE:      Prove, under REAL RLS, the defect behind owner-test card 7: a member holding
 *               `customers:read` but NOT `customers:update` issues an UPDATE that matches ZERO
 *               ROWS and PostgREST returns NO ERROR. That combination — zero rows, no error —
 *               IS the defect. It is why the form reported success on a write that never landed.
 * DEPENDENCIES: ../lib/memberSession.mjs · a live tenant · .env.local. Network required.
 * OUTPUTS:      pass/fail per assertion; exit 1 on any failure.
 * COVERS:       owner-test card 7 (customer-edit board) · A8 (a zero-row write is a failure and
 *               says so) · ui-control-standards E5 · policy `customers_member_update`
 *               (20260727_rbac_resource_action_flip.sql:177).
 *
 * ⚠️ THIS DOES NOT MARK CARD 7 `covered`. OP-14: only David's live run through the real UI does
 * that, and this proves a different claim. This proves THE POLICY is correct — that
 * `customers:update` genuinely gates the write. The card proves THE SCREEN behaves correctly
 * when the policy refuses. A machine can do the first; only a human at the browser does the second.
 *
 * THE ASSERTION THAT MATTERS MOST is not "the write was refused" — it is that the refusal is
 * SILENT at the transport layer. If PostgREST returned an error here, the app could not have had
 * the bug. It returns success with an empty row set, which is why A8 has to be checked in code:
 * `.select()` after an update returns [] and the caller must treat [] as failure.
 */

import { withMemberSession, withThrowawayCustomer, requireBusinessId, makeHarness } from '../lib/memberSession.mjs';

const { ok, done } = makeHarness();
const businessId = await requireBusinessId(process.env.RLS_BUSINESS_ID);
const NEW_PHONE = '(512) 555-0199';

console.log(`\n── CARD 7 · customer write permission · tenant ${businessId.slice(0, 8)} ──\n`);

await withThrowawayCustomer({ businessId }, async (customer) => {
  const originalPhone = customer.phone;
  console.log(`Throwaway customer ${customer.id.slice(0, 8)} · phone "${originalPhone}"\n`);

  // ════ 1. THE NEGATIVE — read but not update. This is the defect, head-on. ════
  console.log('=== STAFF: customers:read, NOT customers:update — the write must NOT land ===');
  await withMemberSession(
    { businessId, role: 'STAFF', permissions: ['customers:read'], label: 'Harness STAFF (no update)' },
    async ({ client, setPermissions }) => {
      const readBack = await client.from('customers').select('id,phone').eq('id', customer.id);
      ok(!readBack.error && (readBack.data ?? []).length === 1,
        'the STAFF member CAN read the customer (customers:read is held — positive control)',
        `rows=${(readBack.data ?? []).length}`);

      const res = await client.from('customers')
        .update({ phone: NEW_PHONE }).eq('id', customer.id).select('id,phone');

      ok((res.data ?? []).length === 0,
        '🔴 THE DEFECT: the UPDATE affects ZERO ROWS (customers:update denied by RLS)',
        `affected=${(res.data ?? []).length}`);
      ok(res.error == null,
        '🔴 …AND POSTGREST RETURNS NO ERROR — silent. This is WHY the form reported success',
        `error=${res.error ? res.error.message : 'null'}`);
      ok((res.data ?? []).length === 0 && res.error == null,
        'zero-rows + no-error together: only an affected-row check (A8) can catch this');

      // The value must be untouched when read back by an authority that CAN see it.
      const after = await client.from('customers').select('phone').eq('id', customer.id).single();
      ok(after.data?.phone === originalPhone,
        'RELOAD as the same member: the OLD phone is still there — nothing was written',
        `phone="${after.data?.phone}"`);

      // ════ 2. THE POSITIVE — same session, permission granted, RLS re-evaluates live. ════
      console.log('\n=== SAME session, customers:update GRANTED — the write must land ===');
      await setPermissions(['customers:read', 'customers:update']);

      const res2 = await client.from('customers')
        .update({ phone: NEW_PHONE }).eq('id', customer.id).select('id,phone');

      ok((res2.data ?? []).length === 1,
        'the UPDATE now affects EXACTLY ONE ROW',
        `affected=${(res2.data ?? []).length}${res2.error ? ' err=' + res2.error.message : ''}`);
      ok(res2.error == null, 'no error on the permitted write');
      ok(res2.data?.[0]?.phone === NEW_PHONE,
        'the returned row carries the NEW phone',
        `phone="${res2.data?.[0]?.phone}"`);

      const after2 = await client.from('customers').select('phone').eq('id', customer.id).single();
      ok(after2.data?.phone === NEW_PHONE,
        'RELOAD: the new phone PERSISTED — the write is real, not optimistic UI',
        `phone="${after2.data?.phone}"`);

      // ════ 3. THE GATE IS THE PERMISSION, NOT MEMBERSHIP. ════
      // Revoking update while KEEPING read must close the write again on the same session.
      // Without this, "the member could write" might just mean "membership was enough" —
      // which is exactly the capQ defect: asserting shape and calling it membership.
      console.log('\n=== REVOKED again — the gate is the PERMISSION, not membership ===');
      await setPermissions(['customers:read']);
      const res3 = await client.from('customers')
        .update({ phone: '(512) 555-0000' }).eq('id', customer.id).select('id');
      ok((res3.data ?? []).length === 0 && res3.error == null,
        'revoking customers:update closes the write again on the SAME session (permission-keyed)',
        `affected=${(res3.data ?? []).length}`);
      const after3 = await client.from('customers').select('phone').eq('id', customer.id).single();
      ok(after3.data?.phone === NEW_PHONE,
        'and the value from the permitted write is still intact',
        `phone="${after3.data?.phone}"`);
    },
  );
});

process.exit(done('CARD 7 · customer write permission'));
