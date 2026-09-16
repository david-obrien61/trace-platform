// ============================================================
// contactWriter — THE ONE WRITE PATH FROM A CONTACT RECORD TO ROWS (platform, ledger #335)
//
// PURPOSE:      `contactRecord.ts` decides WHAT a customer's phones, emails and addresses are.
//               This file is the only thing that turns that decision into rows. Two modules
//               because one is PURE and provable at a desk, and the other touches a database —
//               mixing them would make every shape rule need a client to test.
//
// 🔴 IDEMPOTENT BY READING FIRST, WITH THE DATABASE AS THE BACKSTOP (tech-debt #306).
//    Re-importing a customer must not mint a second copy of the same number and must not raise.
//    ✏️ THIS HEADER USED TO SAY THE PARTIAL UNIQUE INDEXES DID THAT, VIA `upsert(…, {
//    ignoreDuplicates: true })`. THEY CANNOT, AND IT WAS MEASURED (PGlite, 2026-09-16):
//      · with no `onConflict`, PostgREST's conflict target is the PRIMARY KEY. The rows carry no
//        id, so that arbiter never fires, and a collision on `one_per_value` or `one_primary`
//        RAISES 23505 — `ignoreDuplicates` absorbs nothing;
//      · naming the index columns in `onConflict` is refused outright (42P10): every unique index
//        on these tables is PARTIAL, Postgres infers a partial index only when its predicate is
//        restated, and PostgREST has no way to send one;
//      · `ON CONFLICT DO NOTHING` with the target OMITTED would absorb everything — including a
//        genuinely new number planned as primary, which it would silently DROP.
//    So this module reads what the customer already holds, plans against it (`reconcileContactRows`,
//    pure), and INSERTs only what is new. ⚠️ That is a read-then-write — tech-debt #54's race —
//    and it is accepted HERE for one reason: the import is a single-operator run. The indexes
//    stay the backstop, so a lost race arrives as a loud 23505, never as a silent duplicate.
//
// ⚠️ `value_norm` IS NEVER SENT. The database trigger computes it (migration §5), so the
//    normalisation has exactly one home. Sending it from here would be a second implementation of
//    one rule, which is the STD-011 defect this whole build exists to remove.
//
// DEPENDENCIES: a supabase client passed in (never constructed here) + contactRecord (pure) +
//               contactFields (the column lists).
// OUTPUTS:      CONTACT_PHONE_COLUMNS · CONTACT_EMAIL_COLUMNS · CONTACT_ADDRESS_READ_COLUMNS ·
//               planContactRows · reconcileContactRows · writeContactRecord
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRecord } from './contactRecord';
import { addressKey, normalizeEmailValue, normalizePhoneValue } from './contactRecord';
import { CONTACT_ADDRESS_READ_COLUMNS, CONTACT_EMAIL_COLUMNS, CONTACT_PHONE_COLUMNS } from './contactFields';

// STD-003: ON by default until OWNER-PROVEN. Do not comment out (§7 standing instruction).
const TRACE_CONTACT = true;

// The column lists live in `contactFields.ts` — `verify-field-lists` counts a list declared beside
// its reader as hand-written, and an imported one as derived (the `customerAddressFields.ts` shape).
export { CONTACT_PHONE_COLUMNS, CONTACT_EMAIL_COLUMNS, CONTACT_ADDRESS_READ_COLUMNS };

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

// ── WHAT THE CUSTOMER ALREADY HOLDS, AND WHAT THE IMPORT DOES ABOUT IT ────────────────────────

export interface HeldContact {
  phones: { value_norm: unknown; is_primary: unknown }[];
  emails: { value_norm: unknown; is_primary: unknown }[];
  addresses: { id?: unknown; label?: unknown; kind?: unknown; line1?: unknown; city?: unknown; zip?: unknown; is_default?: unknown; source?: unknown }[];
}

/** An imported row that could not land, and why — reported, never silently dropped. */
export interface ContactNotTaken { table: 'customer_addresses'; label: string; reason: 'label-held' }

export interface ContactReconcile {
  insert: ContactRowPlan;
  /** Seeded address rows the import supersedes. RETIRED (`active = false`), never deleted — R-133. */
  retireAddressIds: string[];
  held: ContactCounts;
  notTaken: ContactNotTaken[];
}

/**
 * 🔴 A MIGRATION SEED IS A PROVISIONAL COPY; A ROW A PERSON OR AN EARLIER IMPORT WROTE IS NOT.
 * `20260915` §5b copies each customer's flat `billing_*` into a default "Billing" row. On LAWNS
 * that copy is WRONG for 464 customers (measured 2026-09-16): the old importer never read
 * `BillAddr.Line2` (tech-debt #254), so their "street" is their phone number. The import is a
 * better read of the SAME QuickBooks record, so where the two disagree for the billing role, the
 * seed is retired and the import's row takes the default. Only `migrated:` rows qualify — an owner
 * typed a hand-entered row (`source` NULL) and a `quickbooks:` row is an earlier import's; neither
 * is ever overwritten by a later run.
 */
const isSeed = (source: unknown) => typeof source === 'string' && source.startsWith('migrated:');

/**
 * Plan the write against what is already on file. PURE — every decision is assertable without a
 * client, which is the only place a rule this consequential should be proven.
 *
 *   · phones / emails: a value already held (by the trigger's normalisation) is skipped; a new one
 *     is added, and planned NON-primary if the customer already has a primary. An import never
 *     demotes what is on file.
 *   · addresses: an identical address (street + city + postcode) is skipped. A billing/both row
 *     that collides with a SEEDED row — on label, or on the default — retires the seed. A collision
 *     with any other row: a taken default is left alone (the import lands as a non-default site);
 *     a taken label means the row cannot land, and it is REPORTED in `notTaken`.
 */
export function reconcileContactRows(plan: ContactRowPlan, held: HeldContact): ContactReconcile {
  const heldCount: ContactCounts = { phones: 0, emails: 0, addresses: 0 };

  const values = (
    rows: Record<string, unknown>[], existing: HeldContact['phones'],
    norm: (v: string) => string, key: 'phones' | 'emails',
  ): Record<string, unknown>[] => {
    const seen = new Set(existing.map(r => r.value_norm).filter((v): v is string => typeof v === 'string'));
    let hasPrimary = existing.some(r => r.is_primary === true);
    const out: Record<string, unknown>[] = [];
    for (const row of rows) {
      const n = norm(String(row.value ?? ''));
      if (seen.has(n)) { heldCount[key]++; continue; }
      seen.add(n);
      const primary = row.is_primary === true && !hasPrimary;
      if (primary) hasPrimary = true;
      out.push({ ...row, is_primary: primary });
    }
    return out;
  };

  const phones = values(plan.phones, held.phones, normalizePhoneValue, 'phones');
  const emails = values(plan.emails, held.emails, normalizeEmailValue, 'emails');

  const live = held.addresses.map(a => ({ ...a }));
  const retire = new Set<string>();
  const heldKeys = new Set(live.map(a => addressKey({ line1: a.line1 as string | null, city: a.city as string | null, zip: a.zip as string | null })));
  const addresses: Record<string, unknown>[] = [];
  const notTaken: ContactNotTaken[] = [];
  const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();

  for (const row of plan.addresses) {
    const k = addressKey({ line1: row.line1 as string | null, city: row.city as string | null, zip: row.zip as string | null });
    if (heldKeys.has(k)) { heldCount.addresses++; continue; }
    const billingRole = row.kind === 'billing' || row.kind === 'both';
    const standing = live.filter(a => !retire.has(String(a.id)));

    const labelClash = standing.find(a => lower(a.label) === lower(row.label));
    if (labelClash) {
      if (billingRole && isSeed(labelClash.source)) retire.add(String(labelClash.id));
      else { notTaken.push({ table: 'customer_addresses', label: String(row.label), reason: 'label-held' }); continue; }
    }

    let next = row;
    if (row.is_default === true) {
      const def = live.find(a => a.is_default === true && !retire.has(String(a.id)));
      if (def) {
        if (billingRole && isSeed(def.source)) retire.add(String(def.id));
        else next = { ...row, is_default: false };
      }
    }
    heldKeys.add(k);
    addresses.push(next);
  }

  return {
    insert: { phones, emails, addresses },
    retireAddressIds: [...retire],
    held: heldCount,
    notTaken,
  };
}

/**
 * 🔴 PLANNED = LANDED + HELD + NOT-TAKEN, AND ALL OF THEM ARE RETURNED (A8 / R-12 — *a write must
 * prove it wrote*). A second import run reads `landed 0, held N` — which says WHY nothing landed,
 * where the old `0 of N` could not tell a duplicate from a refusal. A refusal is now an ERROR:
 * plain INSERTs under RLS raise 42501 rather than returning zero rows.
 */
export type ContactWriteOutcome =
  | {
    ok: true; planned: ContactCounts; landed: ContactCounts; held: ContactCounts;
    retired: number; notTaken: ContactNotTaken[];
  }
  | { ok: false; error: string };

export interface ContactCounts { phones: number; emails: number; addresses: number }

/**
 * Write one customer's contact lists.
 *
 * 🔴 A RE-IMPORT IS A NO-OP, NOT AN ERROR — what lets a nervous owner run the import twice
 * without a support call. A REAL failure (permission, a broken FK, a lost race) returns
 * `ok: false` with the message.
 *
 * ⚠️ IT DOES NOT WRITE `customers`. The flat columns are derived by the migration's trigger, so
 * this module naming that table would be a SECOND author of one fact. `contactRecord.test.ts` §G
 * asserts the set of tables any contact writer touches.
 */
export async function writeContactRecord(
  db: SupabaseClient, businessId: string, customerId: string, record: ContactRecord,
): Promise<ContactWriteOutcome> {
  const plan = planContactRows(businessId, customerId, record);
  const planned: ContactCounts = {
    phones: plan.phones.length, emails: plan.emails.length, addresses: plan.addresses.length,
  };
  if (planned.phones + planned.emails + planned.addresses === 0) {
    return { ok: true, planned, landed: { phones: 0, emails: 0, addresses: 0 }, held: { phones: 0, emails: 0, addresses: 0 }, retired: 0, notTaken: [] };
  }

  // ── READ WHAT IS HELD — active rows only, which is exactly what the partial indexes cover ──
  const [heldPhones, heldEmails, heldAddresses] = await Promise.all([
    db.from('customer_phones').select(CONTACT_PHONE_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true),
    db.from('customer_emails').select(CONTACT_EMAIL_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true),
    db.from('customer_addresses').select(CONTACT_ADDRESS_READ_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true),
  ]);
  for (const [table, res] of [['customer_phones', heldPhones], ['customer_emails', heldEmails], ['customer_addresses', heldAddresses]] as const) {
    if (res.error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] read FAILED', { table, customerId, message: res.error.message });
      return { ok: false, error: `${table}: ${res.error.message}` };
    }
  }

  const r = reconcileContactRows(plan, {
    phones: (heldPhones.data ?? []) as unknown as HeldContact['phones'],
    emails: (heldEmails.data ?? []) as unknown as HeldContact['emails'],
    addresses: (heldAddresses.data ?? []) as unknown as HeldContact['addresses'],
  });

  // 🔴 THE THREE TABLE NAMES ARE LITERALS, NOT A LOOP OVER A VARIABLE, AND THAT IS DELIBERATE.
  // The first draft of this function looped over `[{table:'customer_phones'},…]` and called
  // `db.from(table)` — and `contactRecord.test.ts` §G COULD NOT SEE IT. A write path that names
  // its tables dynamically is invisible to the enumeration that is supposed to bound it, which is
  // tech-debt #182's class exactly: a probe that cannot reach its target reports the same as one
  // that passed. §G6 now fails on a dynamic `.from()` in a contact-table file.
  //
  // 🔴 AND THE AFFECTED-ROW INSPECTION IS INLINE AT EACH SITE, NOT IN A HELPER — A8 / R-12.
  // `verify-zero-row-writes` looks AFTER each statement, and the only generic shared form it
  // recognises is app code `shared` must not import (tech-debt #156). So each check is written
  // where the cap can see it and where a reader can too.
  const landed: ContactCounts = { phones: 0, emails: 0, addresses: 0 };

  if (r.insert.phones.length > 0) {
    const { data, error } = await db.from('customer_phones').insert(r.insert.phones).select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] write FAILED', { table: 'customer_phones', customerId, message: error.message });
      return { ok: false, error: `customer_phones: ${error.message}` };
    }
    const rows = data ?? [];
    landed.phones = rows.length;
    // A8 / R-12 — inline. A plain INSERT lands every row or raises; fewer back means the SELECT
    // policy hid what was written, which is a refusal to be told about, not a success.
    if (rows.length < r.insert.phones.length) {
      return { ok: false, error: `customer_phones: ${rows.length} of ${r.insert.phones.length} rows came back — the write could not be confirmed` };
    }
  }

  if (r.insert.emails.length > 0) {
    const { data, error } = await db.from('customer_emails').insert(r.insert.emails).select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] write FAILED', { table: 'customer_emails', customerId, message: error.message });
      return { ok: false, error: `customer_emails: ${error.message}` };
    }
    const rows = data ?? [];
    landed.emails = rows.length;
    // A8 / R-12 — inline, same reasoning as the phones.
    if (rows.length < r.insert.emails.length) {
      return { ok: false, error: `customer_emails: ${rows.length} of ${r.insert.emails.length} rows came back — the write could not be confirmed` };
    }
  }

  // ⚠️ RETIRE BEFORE INSERT, AND THE ORDER IS FORCED: the seed holds the label and the default the
  // new row needs, and both indexes are `WHERE active`. The two statements are not one
  // transaction; if the insert then fails, the customer is left with the seed retired and the
  // error names it — reversible by setting `active` back, since nothing was deleted.
  if (r.retireAddressIds.length > 0) {
    const { data, error } = await db.from('customer_addresses')
      .update({ active: false })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', r.retireAddressIds)
      .select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] retire FAILED', { customerId, message: error.message });
      return { ok: false, error: `customer_addresses: ${error.message}` };
    }
    // A8 / R-12 — inline. A retirement that matched fewer rows than planned would send the insert
    // into the very collision it exists to clear; stop here and say so instead.
    if ((data ?? []).length !== r.retireAddressIds.length) {
      return { ok: false, error: `customer_addresses: retired ${(data ?? []).length} of ${r.retireAddressIds.length} seeded rows — nothing imported for this customer's addresses` };
    }
    if (TRACE_CONTACT) console.log('[TRACE:CONTACT] seed superseded', { customerId, retired: r.retireAddressIds });
  }

  if (r.insert.addresses.length > 0) {
    const { data, error } = await db.from('customer_addresses').insert(r.insert.addresses).select('id');
    if (error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] write FAILED', { table: 'customer_addresses', customerId, message: error.message, retiredFirst: r.retireAddressIds });
      const note = r.retireAddressIds.length > 0 ? ` (the seeded address ${r.retireAddressIds.join(', ')} was already retired — set active back to restore it)` : '';
      return { ok: false, error: `customer_addresses: ${error.message}${note}` };
    }
    const rows = data ?? [];
    landed.addresses = rows.length;
    // A8 / R-12 — inline, same reasoning as the phones.
    if (rows.length < r.insert.addresses.length) {
      return { ok: false, error: `customer_addresses: ${rows.length} of ${r.insert.addresses.length} rows came back — the write could not be confirmed` };
    }
  }

  if (TRACE_CONTACT) {
    console.log('[TRACE:CONTACT] wrote', {
      customerId, planned, landed, held: r.held, retired: r.retireAddressIds.length,
      notTaken: r.notTaken, findings: record.findings.map(f => f.kind),
    });
  }
  return { ok: true, planned, landed, held: r.held, retired: r.retireAddressIds.length, notTaken: r.notTaken };
}
