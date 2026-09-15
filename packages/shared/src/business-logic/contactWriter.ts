// ============================================================
// contactWriter — THE ONE WRITE PATH FROM A CONTACT RECORD TO ROWS (platform, ledger #335)
//
// PURPOSE:      `contactRecord.ts` decides WHAT a customer's phones, emails and addresses are.
//               This file is the only thing that turns that decision into rows. Two modules
//               because one is PURE and provable at a desk, and the other touches a database —
//               mixing them would make every shape rule need a client to test.
//
// 🔴 IDEMPOTENT BY CONSTRUCTION, AND THE DATABASE IS WHAT MAKES IT SO. Re-importing a customer
//    must not mint a second copy of the same number. That is NOT enforced by a read-then-write
//    here — a read-then-write is a TOCTOU race, which is tech-debt #54's whole lesson — it is
//    enforced by the partial unique indexes on `(business_id, customer_id, value_norm)`, and this
//    module's job is to ask for `ignoreDuplicates` and treat a collision as SUCCESS.
//
// ⚠️ `value_norm` IS NEVER SENT. The database trigger computes it (migration §5), so the
//    normalisation has exactly one home. Sending it from here would be a second implementation of
//    one rule, which is the STD-011 defect this whole build exists to remove.
//
// DEPENDENCIES: a supabase client passed in (never constructed here) + contactRecord (pure).
// OUTPUTS:      CONTACT_PHONE_COLUMNS · CONTACT_EMAIL_COLUMNS · planContactRows ·
//               writeContactRecord
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRecord } from './contactRecord';

// STD-003: ON by default until OWNER-PROVEN. Do not comment out (§7 standing instruction).
const TRACE_CONTACT = true;

/** The columns read back after a write. Hand-written ONCE, here, and asserted against the
 *  migration by `contactRecord.test.ts` — #179's lesson: a declarative list that does not match
 *  what its migration creates is invisible to tsc, eslint, knip and every probe. */
export const CONTACT_PHONE_COLUMNS = 'id,business_id,customer_id,label,value,value_norm,is_primary,source,active';
export const CONTACT_EMAIL_COLUMNS = 'id,business_id,customer_id,label,value,value_norm,is_primary,source,active';

export interface ContactRowPlan {
  phones: Record<string, unknown>[];
  emails: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
}

/**
 * The rows a contact record becomes, for one customer. PURE — so the whole shape of a write is
 * assertable without a client, and the test can see exactly what would land.
 */
export function planContactRows(
  businessId: string, customerId: string, record: ContactRecord,
): ContactRowPlan {
  const base = { business_id: businessId, customer_id: customerId };
  return {
    // ⚠️ `value_norm` is absent from every payload BY DESIGN — see the header.
    phones: record.phones.map(p => ({
      ...base, label: p.label, value: p.value, is_primary: p.is_primary, source: p.source,
    })),
    emails: record.emails.map(e => ({
      ...base, label: e.label, value: e.value, is_primary: e.is_primary, source: e.source,
    })),
    addresses: record.addresses.map(a => ({
      ...base, kind: a.kind, label: a.label,
      line1: a.line1, line2: a.line2, city: a.city, state: a.state, zip: a.zip,
      is_default: a.is_default, source: a.source,
    })),
  };
}

/**
 * 🔴 BOTH COUNTS ARE RETURNED, AND THE PAIR IS THE POINT (A8 / R-12 — *a write must prove it wrote*).
 *
 * A PostgREST write matching ZERO rows returns SUCCESS WITH NO ERROR, and with `ignoreDuplicates`
 * an RLS REFUSAL and a DUPLICATE are the same answer: no error, nothing landed. Per customer those
 * two are genuinely indistinguishable, and pretending otherwise would be the false green this repo
 * keeps logging — so this module does not pretend. It reports what it MEANT to write and what
 * ACTUALLY landed, and the run-level report shows both.
 *
 * ⚠️ WHY THAT IS SUFFICIENT WHERE A PER-CALL VERDICT IS NOT: on a FIRST import `landed` equals
 * `planned`; on a re-import `landed` is legitimately lower. But a member without `customers:create`
 * lands ZERO across EVERY customer, and `0 of 1,513` on the import report is visible to a human in
 * a way a silent success is not. The ambiguity is real, it is bounded, and it is surfaced rather
 * than resolved by a guess.
 */
export type ContactWriteOutcome =
  | { ok: true; planned: ContactCounts; landed: ContactCounts }
  | { ok: false; error: string };

export interface ContactCounts { phones: number; emails: number; addresses: number }

/**
 * Write one customer's contact lists.
 *
 * 🔴 A DUPLICATE IS NOT A FAILURE. `ignoreDuplicates` makes a re-import a no-op for values already
 * held rather than an error the caller must interpret — which is what lets the import be run twice
 * by a nervous owner without a support call. A REAL failure (permission, a broken FK) still
 * returns `ok: false` with the message.
 *
 * ⚠️ IT DOES NOT WRITE `customers`. The flat columns are derived by the migration's trigger, so
 * this module naming that table would be a SECOND author of one fact. `contactRecord.test.ts` §G
 * asserts the set of tables any contact writer touches.
 */
export async function writeContactRecord(
  db: SupabaseClient, businessId: string, customerId: string, record: ContactRecord,
): Promise<ContactWriteOutcome> {
  const plan = planContactRows(businessId, customerId, record);

  // 🔴 THE THREE TABLE NAMES ARE LITERALS, NOT A LOOP OVER A VARIABLE, AND THAT IS DELIBERATE.
  // The first draft of this function looped over `[{table:'customer_phones'},…]` and called
  // `db.from(table)` — and `contactRecord.test.ts` §G COULD NOT SEE IT. A write path that names
  // its tables dynamically is invisible to the enumeration that is supposed to bound it, which is
  // tech-debt #182's class exactly: a probe that cannot reach its target reports the same as one
  // that passed. §G6 now fails on a dynamic `.from()` in a contact-table file.
  //
  // 🔴 AND THE AFFECTED-ROW INSPECTION IS INLINE AT EACH SITE, NOT IN A HELPER — A8 / R-12.
  // The second draft put `.length` inside a shared `run()` closure, and `verify-zero-row-writes`
  // reported all three sites NEEDS_CHECK: its window looks AFTER the statement, and the only
  // generic shared form it recognises is `writeLanded()` from `components/datasheet/rowPatch.ts`
  // — cultivar-os app code, which `shared` must not import (tech-debt #156, the package boundary).
  // So the inspection is written where the cap can see it and where a reader can too. It is three
  // straight-line statements rather than a clever loop, and that is the right trade here.
  const landed: ContactCounts = { phones: 0, emails: 0, addresses: 0 };

  /** One sentence, once, for a short count — so the NOTE is not copy-pasted three times. */
  const short = (table: string, plannedRows: number, landedRows: number) => {
    // ⚠️ ZERO LANDED IS NOT A FAILURE HERE, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT: with
    // `ignoreDuplicates` it is the CORRECT outcome of a second import run. It is TRACED so it can
    // never be invisible, and both counts are RETURNED so the run report can show `0 of N`.
    if (TRACE_CONTACT && landedRows < plannedRows) {
      console.log('[TRACE:CONTACT] some rows did not land', {
        table, customerId, planned: plannedRows, landed: landedRows,
        note: 'duplicates on a re-import, OR a refused write — indistinguishable per customer; see the run total',
      });
    }
  };

  if (plan.phones.length > 0) {
    const { data, error } = await db.from('customer_phones')
      .upsert(plan.phones, { ignoreDuplicates: true }).select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] write FAILED', { table: 'customer_phones', customerId, message: error.message });
      return { ok: false, error: `customer_phones: ${error.message}` };
    }
    const rows = data ?? [];
    landed.phones = rows.length;
    // A8 / R-12 — the affected-row inspection, INLINE and at this site. ZERO landed gets its own
    // branch because it is the REFUSAL SIGNATURE: a member without `customers:create` lands zero
    // on every customer, and that is the shape the run total makes visible.
    if (rows.length === 0) short('customer_phones', plan.phones.length, 0);
    else if (rows.length < plan.phones.length) short('customer_phones', plan.phones.length, rows.length);
  }

  if (plan.emails.length > 0) {
    const { data, error } = await db.from('customer_emails')
      .upsert(plan.emails, { ignoreDuplicates: true }).select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] write FAILED', { table: 'customer_emails', customerId, message: error.message });
      return { ok: false, error: `customer_emails: ${error.message}` };
    }
    const rows = data ?? [];
    landed.emails = rows.length;
    // A8 / R-12 — the affected-row inspection, INLINE and at this site. ZERO landed gets its own
    // branch because it is the REFUSAL SIGNATURE: a member without `customers:create` lands zero
    // on every customer, and that is the shape the run total makes visible.
    if (rows.length === 0) short('customer_emails', plan.emails.length, 0);
    else if (rows.length < plan.emails.length) short('customer_emails', plan.emails.length, rows.length);
  }

  if (plan.addresses.length > 0) {
    const { data, error } = await db.from('customer_addresses')
      .upsert(plan.addresses, { ignoreDuplicates: true }).select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] write FAILED', { table: 'customer_addresses', customerId, message: error.message });
      return { ok: false, error: `customer_addresses: ${error.message}` };
    }
    const rows = data ?? [];
    landed.addresses = rows.length;
    // A8 / R-12 — the affected-row inspection, INLINE and at this site. ZERO landed gets its own
    // branch because it is the REFUSAL SIGNATURE: a member without `customers:create` lands zero
    // on every customer, and that is the shape the run total makes visible.
    if (rows.length === 0) short('customer_addresses', plan.addresses.length, 0);
    else if (rows.length < plan.addresses.length) short('customer_addresses', plan.addresses.length, rows.length);
  }

  const planned: ContactCounts = {
    phones: plan.phones.length, emails: plan.emails.length, addresses: plan.addresses.length,
  };
  if (TRACE_CONTACT) console.log('[TRACE:CONTACT] wrote', {
    customerId, planned, landed, findings: record.findings.map(f => f.kind),
  });
  return { ok: true, planned, landed };
}
