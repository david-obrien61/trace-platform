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
//               planContactRows · reconcileContactRows · writeContactRecord · writeContactRecords ·
//               planContactEdit · writeContactEdit · contactEditOf · contactResultSentence ·
//               addressLine · logContactChanges · readContactLists · makeContactMain ·
//               retireContact · editContactRow · addContactRow · insertShipToSite · retireShipToSite ·
//               removeRunContactRows ·
//               runCustomersWithHandAddedContacts
//
// 🔴 EVERY WRITER OF A CUSTOMER'S PHONE, EMAIL OR ADDRESS COMES THROUGH THIS FILE (David, 2026-09-16).
//    `customers.phone` / `email` / `billing_*` are DERIVED by the database from the three lists, and
//    `20260915_contact_record` §5e REFUSES a direct write to them. The writers, and which entry each
//    uses: the QuickBooks import → `writeContactRecords` (tagged with its run) · OCR capture, checkout
//    and delivery ingest (all via `customerUpsert`) and the customer editor → `writeContactEdit` ·
//    the ship-to picker → `insertShipToSite` / `retireShipToSite` · the customer-import undo →
//    `removeRunContactRows` · the customer page's lists → `makeContactMain` / `retireContact`.
//    The full list of capture paths, each with its end-to-end test, is `writer-registry.json`
//    (ledger #345) — and `npm run verify` fails on a path that is not in it.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRecord } from './contactRecord';
import { addressKey, normalizeEmailValue, normalizePhoneValue, phonesInText, splitEmails } from './contactRecord';
import {
  CONTACT_ADDRESS_EDIT_COLUMNS, CONTACT_ADDRESS_LIST_COLUMNS, CONTACT_ADDRESS_READ_COLUMNS, CONTACT_EMAIL_COLUMNS,
  CONTACT_PHONE_COLUMNS, CONTACT_VALUE_LIST_COLUMNS,
} from './contactFields';
import type { CustomerAddress } from './customerAddresses';

// STD-003: ON by default until OWNER-PROVEN. Do not comment out (§7 standing instruction).
const TRACE_CONTACT = true;

// The column lists live in `contactFields.ts` — `verify-field-lists` counts a list declared beside
// its reader as hand-written, and an imported one as derived (the `customerAddressFields.ts` shape).
export { CONTACT_PHONE_COLUMNS, CONTACT_EMAIL_COLUMNS, CONTACT_ADDRESS_READ_COLUMNS, CONTACT_ADDRESS_EDIT_COLUMNS, CONTACT_VALUE_LIST_COLUMNS, CONTACT_ADDRESS_LIST_COLUMNS };

export interface ContactRowPlan {
  phones: Record<string, unknown>[];
  emails: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
}

/**
 * The rows a contact record becomes, for one customer. PURE — so the whole shape of a write is
 * assertable without a client, and the test can see exactly what would land.
 *
 * `importRunId` — pass it when writing FOR an import run, and every row carries it, so the run's
 * undo removes the rows with their customer (`20260916d`). Omit it for anything a person does: an
 * untagged row on an imported customer is live, and the undo refuses rather than take it.
 */
export function planContactRows(
  businessId: string, customerId: string, record: ContactRecord, importRunId?: string | null,
): ContactRowPlan {
  const base: Record<string, unknown> = { business_id: businessId, customer_id: customerId };
  if (importRunId) base.import_run_id = importRunId;
  return {
    // ⚠️ `value_norm` is absent from every payload BY DESIGN — see the header.
    phones: record.phones.map(p => ({
      ...base, label: p.label, value: p.value, note: p.note ?? null, is_primary: p.is_primary, source: p.source,
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
  importRunId?: string | null,
): Promise<ContactWriteOutcome> {
  const plan = planContactRows(businessId, customerId, record, importRunId);
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


// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE BATCHED IMPORT WRITE — one customer book, a handful of round trips (ledger #335)
// ══════════════════════════════════════════════════════════════════════════════════════════════
// `writeContactRecord` is three reads and up to four writes PER CUSTOMER. The import writes ~1,900
// customers inside one serverless call; ~10,000 requests would not finish. This does the same
// reconcile per customer, but reads and inserts in chunks. Same rules, same A8 checks.

const ID_CHUNK = 200;
const ROW_CHUNK = 500;

export async function writeContactRecords(
  db: SupabaseClient, businessId: string,
  entries: { customerId: string; record: ContactRecord }[], importRunId?: string | null,
): Promise<{ ok: true; landed: ContactCounts; held: ContactCounts; retired: number; notTaken: (ContactNotTaken & { customerId: string })[] } | { ok: false; error: string }> {
  const landed: ContactCounts = { phones: 0, emails: 0, addresses: 0 };
  const heldTotal: ContactCounts = { phones: 0, emails: 0, addresses: 0 };
  const notTaken: (ContactNotTaken & { customerId: string })[] = [];
  const inserts: ContactRowPlan = { phones: [], emails: [], addresses: [] };
  const retire: string[] = [];

  for (let i = 0; i < entries.length; i += ID_CHUNK) {
    const chunk = entries.slice(i, i + ID_CHUNK);
    const ids = chunk.map(e => e.customerId);
    const [hp, he, ha] = await Promise.all([
      db.from('customer_phones').select(CONTACT_PHONE_COLUMNS)
        .eq('business_id', businessId).in('customer_id', ids).eq('active', true),
      db.from('customer_emails').select(CONTACT_EMAIL_COLUMNS)
        .eq('business_id', businessId).in('customer_id', ids).eq('active', true),
      db.from('customer_addresses').select(`customer_id,${CONTACT_ADDRESS_READ_COLUMNS}`)
        .eq('business_id', businessId).in('customer_id', ids).eq('active', true),
    ]);
    for (const [table, res] of [['customer_phones', hp], ['customer_emails', he], ['customer_addresses', ha]] as const) {
      if (res.error) return { ok: false, error: `${table}: ${res.error.message}` };
    }
    const group = (rows: unknown[] | null) => {
      const m = new Map<string, Record<string, unknown>[]>();
      for (const r of (rows ?? []) as Record<string, unknown>[]) {
        const k = String(r.customer_id); m.set(k, [...(m.get(k) ?? []), r]);
      }
      return m;
    };
    const P = group(hp.data), E = group(he.data), A = group(ha.data);
    for (const { customerId, record } of chunk) {
      const r = reconcileContactRows(planContactRows(businessId, customerId, record, importRunId), {
        phones: (P.get(customerId) ?? []) as unknown as HeldContact['phones'],
        emails: (E.get(customerId) ?? []) as unknown as HeldContact['emails'],
        addresses: (A.get(customerId) ?? []) as unknown as HeldContact['addresses'],
      });
      inserts.phones.push(...r.insert.phones);
      inserts.emails.push(...r.insert.emails);
      inserts.addresses.push(...r.insert.addresses);
      retire.push(...r.retireAddressIds);
      heldTotal.phones += r.held.phones; heldTotal.emails += r.held.emails; heldTotal.addresses += r.held.addresses;
      notTaken.push(...r.notTaken.map(n => ({ ...n, customerId })));
    }
  }

  for (let i = 0; i < inserts.phones.length; i += ROW_CHUNK) {
    const batch = inserts.phones.slice(i, i + ROW_CHUNK);
    const { data, error } = await db.from('customer_phones').insert(batch).select('id');
    if (error) return { ok: false, error: `customer_phones: ${error.message}` };
    // A8 / R-12 — inline.
    if ((data ?? []).length !== batch.length) return { ok: false, error: `customer_phones: ${(data ?? []).length} of ${batch.length} rows came back` };
    landed.phones += batch.length;
  }
  for (let i = 0; i < inserts.emails.length; i += ROW_CHUNK) {
    const batch = inserts.emails.slice(i, i + ROW_CHUNK);
    const { data, error } = await db.from('customer_emails').insert(batch).select('id');
    if (error) return { ok: false, error: `customer_emails: ${error.message}` };
    // A8 / R-12 — inline.
    if ((data ?? []).length !== batch.length) return { ok: false, error: `customer_emails: ${(data ?? []).length} of ${batch.length} rows came back` };
    landed.emails += batch.length;
  }
  for (let i = 0; i < retire.length; i += ID_CHUNK) {
    const batch = retire.slice(i, i + ID_CHUNK);
    const { data, error } = await db.from('customer_addresses').update({ active: false, is_default: false })
      .eq('business_id', businessId).in('id', batch).select('id');
    if (error) return { ok: false, error: `customer_addresses: ${error.message}` };
    // A8 / R-12 — inline: nothing back is a refusal; fewer back than planned is one too.
    if ((data ?? []).length === 0 || (data ?? []).length !== batch.length) return { ok: false, error: `customer_addresses: retired ${(data ?? []).length} of ${batch.length} seeded rows` };
  }
  for (let i = 0; i < inserts.addresses.length; i += ROW_CHUNK) {
    const batch = inserts.addresses.slice(i, i + ROW_CHUNK);
    const { data, error } = await db.from('customer_addresses').insert(batch).select('id');
    if (error) return { ok: false, error: `customer_addresses: ${error.message}` };
    // A8 / R-12 — inline.
    if ((data ?? []).length !== batch.length) return { ok: false, error: `customer_addresses: ${(data ?? []).length} of ${batch.length} rows came back` };
    landed.addresses += batch.length;
  }
  if (TRACE_CONTACT) console.log('[TRACE:CONTACT] wrote a batch', { businessId, customers: entries.length, landed, held: heldTotal, retired: retire.length, notTaken: notTaken.length, importRunId: importRunId ?? null });
  return { ok: true, landed, held: heldTotal, retired: retire.length, notTaken };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FLAT EDITS — the writers that still think in "the phone", "the email", "the billing address"
// ══════════════════════════════════════════════════════════════════════════════════════════════
// OCR capture, checkout, delivery ingest and the customer editor each supply ONE phone / email /
// billing address. This turns that into list rows. The value is read with the SAME rule the seed
// used (`contactRecord.ts` — a phone typed into a street goes to the phone list; an email field
// with several addresses is several emails), then applied under a POLICY the caller names:
//   phone / email:
//     'add'      — keep what is held; a new value is ADDED, primary only if nothing is. (checkout
//                  and OCR phone: fill-never-clobber, but the second number is KEPT, not dropped.)
//     'primary'  — the value becomes primary; the old primary stays, demoted. (checkout email:
//                  supplied-wins, and the old address is still on file.)
//     'replace'  — the value becomes primary; the old primary is RETIRED (R-133: active=false,
//                  never deleted). A cleared field retires the primary. (the customer editor.)
//   billing:
//     'fill'     — fill the blank fields of the billing address on file; add one if none.
//                  ✏️ 2026-09-17 (ledger #345): a supplied field that DIFFERS from a stored one no
//                  longer vanishes. The typed address is KEPT as an additional billing address and
//                  the one on file stays main — the same rule as a second phone. Before this, a
//                  checkout that typed a new street for a known customer saved nothing.
//     'replace'  — set the supplied fields on it (a cleared field clears); add one if none. An
//                  address left with nothing in it is retired.
// `undefined` = the caller did not touch the field. `null`/'' = cleared (meaningful for 'replace').
//
// 🔴 NO SILENT DROP (David, 2026-09-17): every typed value comes back with an OUTCOME the screen
//    shows — kept as main · kept as additional · already on file · NOT SAVED + reason (· removed,
//    for a cleared field). A contact problem never blocks the sale or the save it rides on; it is
//    REPORTED, in red, instead. And every add, make-main and remove writes an `audit_log` row.

export type ContactFieldPolicy = 'add' | 'primary' | 'replace';
export type ContactAddressPolicy = 'fill' | 'replace';

export interface ContactEditAddress {
  line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; zip?: string | null;
}
export interface ContactEdit {
  phone?: string | null;
  email?: string | null;
  billing?: ContactEditAddress;
}
export interface ContactEditPolicy {
  phone: ContactFieldPolicy;
  email: ContactFieldPolicy;
  billing: ContactAddressPolicy;
  /** Provenance for new rows: 'checkout', 'ocr-invoice', 'manual', … */
  source: string;
  importRunId?: string | null;
  /** Who made the change, for the change log. Null = a system write (service key, no caller). */
  actorUserId?: string | null;
}

/** The three lists, by the name a person sees. */
export type ContactList = 'phones' | 'emails' | 'addresses';
export type ContactValueOutcome = 'kept_main' | 'kept_additional' | 'already_on_file' | 'removed' | 'not_saved';
export interface ContactValueResult {
  list: ContactList;
  /** The value as typed (an address is shown as one line). */
  value: string;
  outcome: ContactValueOutcome;
  /** Present when `outcome` is 'not_saved': the reason, in words a person can act on. */
  reason?: string;
}

/** The sentence a screen shows for one result. One home, so every screen says the same thing. */
export function contactResultSentence(r: ContactValueResult): string {
  const what = r.list === 'phones' ? 'Phone' : r.list === 'emails' ? 'Email' : 'Address';
  switch (r.outcome) {
    case 'kept_main': return `${what} ${r.value} — saved as the main one.`;
    case 'kept_additional': return `${what} ${r.value} — saved as an additional one; the main one is unchanged.`;
    case 'already_on_file': return `${what} ${r.value} — already on file.`;
    case 'removed': return `${what} ${r.value} — removed.`;
    case 'not_saved': return `${what} ${r.value} — NOT SAVED: ${r.reason ?? 'the save was refused'}.`;
  }
}

/** The contact keys a flat patch may carry, and how they map into a `ContactEdit`. */
export const FLAT_CONTACT_KEYS = ['phone', 'email', 'billing_line1', 'billing_line2', 'billing_city', 'billing_state', 'billing_zip'] as const;

/** Split a flat `customers` patch: the contact half becomes a `ContactEdit`, the rest stays a patch. */
export function contactEditOf(patch: Record<string, unknown>): { edit: ContactEdit; rest: Record<string, unknown>; touched: boolean } {
  const rest: Record<string, unknown> = {};
  const edit: ContactEdit = {};
  const billing: ContactEditAddress = {};
  let touched = false;
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
  for (const [k, v] of Object.entries(patch)) {
    switch (k) {
      case 'phone': edit.phone = text(v); touched = true; break;
      case 'email': edit.email = text(v); touched = true; break;
      case 'billing_line1': billing.line1 = text(v); touched = true; break;
      case 'billing_line2': billing.line2 = text(v); touched = true; break;
      case 'billing_city': billing.city = text(v); touched = true; break;
      case 'billing_state': billing.state = text(v); touched = true; break;
      case 'billing_zip': billing.zip = text(v); touched = true; break;
      default: rest[k] = v;
    }
  }
  if (Object.keys(billing).length > 0) edit.billing = billing;
  return { edit, rest, touched };
}

interface HeldValue { id: string; value: string; value_norm: string | null; is_primary: boolean }
interface HeldAddress { id: string; label: string; kind: string; line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null; is_default: boolean; source: string | null }

export interface ContactEditPlan {
  retirePhones: string[]; demotePhones: string[]; promotePhones: string[];
  respellPhone: { id: string; value: string } | null;
  retireEmails: string[]; demoteEmails: string[]; promoteEmails: string[];
  insertPhones: Record<string, unknown>[]; insertEmails: Record<string, unknown>[];
  updateAddress: { id: string; patch: Record<string, string | null> } | null;
  retireAddress: string | null;
  insertAddress: Record<string, unknown> | null;
  /** What each typed value will become once the plan is written (the writer turns a failed write into 'not_saved'). */
  results: ContactValueResult[];
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';
const cleanOrNull = (v: unknown): string | null => (blank(v) ? null : String(v).trim());
const sameText = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** One line for an address, the way a person reads it. */
export function addressLine(a: ContactEditAddress): string {
  const cityState = [cleanOrNull(a.city), cleanOrNull(a.state)].filter(Boolean).join(', ');
  const tail = [cityState, cleanOrNull(a.zip)].filter(Boolean).join(' ');
  return [cleanOrNull(a.line1), cleanOrNull(a.line2), tail].filter(Boolean).join(', ');
}

const ADDRESS_FIELDS = ['line1', 'line2', 'city', 'state', 'zip'] as const;
const freeLabel = (held: { label: string }[], stem: string) => {
  const taken = new Set(held.map(a => a.label.trim().toLowerCase()));
  let label = stem;
  for (let n = 2; taken.has(label.toLowerCase()); n++) label = `${stem} ${n}`;
  return label;
};

/**
 * PURE. Held rows (active, oldest first) + the edit + the policy → exactly what to write, and what
 * each typed value will become. Every decision below is asserted in `contactWriter.test.ts` §K.
 */
export function planContactEdit(
  held: { phones: HeldValue[]; emails: HeldValue[]; addresses: HeldAddress[] },
  edit: ContactEdit, policy: ContactEditPolicy, ids: { businessId: string; customerId: string },
): ContactEditPlan {
  const plan: ContactEditPlan = {
    retirePhones: [], demotePhones: [], promotePhones: [], respellPhone: null,
    retireEmails: [], demoteEmails: [], promoteEmails: [],
    insertPhones: [], insertEmails: [], updateAddress: null, retireAddress: null, insertAddress: null,
    results: [],
  };
  const base: Record<string, unknown> = { business_id: ids.businessId, customer_id: ids.customerId, source: policy.source };
  if (policy.importRunId) base.import_run_id = policy.importRunId;

  // Phones that arrived inside a street field join the phone edit as ADDs (the seed's rule).
  const extraPhones: { value: string; note: string | null }[] = [];
  const billing = edit.billing ? { ...edit.billing } : undefined;
  if (billing) {
    for (const key of ['line1', 'line2'] as const) {
      const found = phonesInText(billing[key]);
      if (found) {
        for (const value of found.phones) extraPhones.push({ value, note: found.note });
        billing[key] = null;
        if (policy.billing === 'fill') delete billing[key];   // a moved phone never clears a stored street
      }
    }
  }

  // ── one list (phones or emails) ──
  const applyValues = (
    listName: 'phones' | 'emails',
    list: HeldValue[], main: string | null | undefined, extras: { value: string; note?: string | null }[],
    mode: ContactFieldPolicy, norm: (v: string) => string,
    out: { retire: string[]; demote: string[]; promote: string[]; insert: Record<string, unknown>[] },
    label: string, extraLabel: string,
  ): { respell: { id: string; value: string } | null } => {
    const live = list.map(h => ({ ...h }));
    let respell: { id: string; value: string } | null = null;
    const result = (value: string, outcome: ContactValueOutcome) => plan.results.push({ list: listName, value, outcome });
    const primaryOf = () => live.find(h => h.is_primary) ?? null;
    const find = (v: string) => live.find(h => (h.value_norm ?? norm(h.value)) === norm(v)) ?? null;
    const demote = (h: { id: string; is_primary: boolean }) => { if (h.is_primary) { out.demote.push(h.id); h.is_primary = false; } };
    const retire = (h: { id: string }) => { out.retire.push(h.id); const i = live.findIndex(x => x.id === h.id); if (i >= 0) live.splice(i, 1); };

    if (main !== undefined) {
      const v = cleanOrNull(main);
      const current = primaryOf() ?? live[0] ?? null;
      if (v === null) {
        if (mode === 'replace' && current) { retire(current); result(current.value, 'removed'); }
      } else {
        const match = find(v);
        if (mode === 'add') {
          if (match) result(v, 'already_on_file');
          else {
            const primary = primaryOf() === null && live.length === 0;
            out.insert.push({ ...base, label, value: v, is_primary: primary });
            live.push({ id: '(new)', value: v, value_norm: norm(v), is_primary: primary });
            result(v, primary ? 'kept_main' : 'kept_additional');
          }
        } else if (match) {
          if (match === current || match.is_primary) {
            if (mode === 'replace' && match.value !== v) { respell = { id: match.id, value: v }; result(v, 'kept_main'); }
            else result(v, 'already_on_file');
          } else {
            // The value is on file but is not the one shown. 'replace' retires what WAS shown
            // (the primary, or — with no primary — the oldest, which is what the derivation shows);
            // 'primary' only demotes. Then the matching row is promoted.
            if (mode === 'replace') { if (current && current.id !== match.id) { retire(current); result(current.value, 'removed'); } }
            else { const p = primaryOf(); if (p) demote(p); }
            out.promote.push(match.id); match.is_primary = true;
            result(v, 'kept_main');
          }
        } else {
          const p = primaryOf();
          if (mode === 'replace') { if (current) { retire(current); result(current.value, 'removed'); } }
          else if (p) demote(p);
          out.insert.push({ ...base, label, value: v, is_primary: true });
          live.push({ id: '(new)', value: v, value_norm: norm(v), is_primary: true });
          result(v, 'kept_main');
        }
      }
    }
    for (const x of extras) {
      if (find(x.value)) { result(x.value, 'already_on_file'); continue; }
      const primary = primaryOf() === null && live.length === 0;
      const row: Record<string, unknown> = { ...base, label: extraLabel, value: x.value, is_primary: primary };
      if (x.note !== undefined) row.note = x.note;
      out.insert.push(row);
      live.push({ id: '(new)', value: x.value, value_norm: norm(x.value), is_primary: primary });
      result(x.value, primary ? 'kept_main' : 'kept_additional');
    }
    return { respell };
  };

  const ph = { retire: plan.retirePhones, demote: plan.demotePhones, promote: plan.promotePhones, insert: plan.insertPhones };
  plan.respellPhone = applyValues('phones', held.phones, edit.phone, extraPhones, policy.phone, normalizePhoneValue, ph, 'main', 'other').respell;

  if (edit.email !== undefined) {
    const parts = edit.email === null || blank(edit.email) ? [] : splitEmails(edit.email);
    const em = { retire: plan.retireEmails, demote: plan.demoteEmails, promote: plan.promoteEmails, insert: plan.insertEmails };
    applyValues('emails', held.emails, parts[0] ?? null, parts.slice(1).map(value => ({ value })), policy.email, normalizeEmailValue, em, 'main', 'main');
  }

  // ── the billing address ──
  if (billing && Object.keys(billing).length > 0) {
    const target = held.addresses.find(a => a.kind === 'billing' || a.kind === 'both') ?? null;
    const typed = addressLine(billing);
    const result = (value: string, outcome: ContactValueOutcome) => plan.results.push({ list: 'addresses', value, outcome });
    if (target) {
      // FILL: a supplied value that disagrees with a stored one is a DIFFERENT address, not a fill.
      const conflicts = policy.billing === 'fill'
        ? ADDRESS_FIELDS.filter(f => f in billing && !blank(billing[f]) && !blank(target[f]) && !sameText(billing[f], target[f]))
        : [];
      if (conflicts.length > 0) {
        // Kept as an ADDITIONAL billing address; the one on file stays main (not default, and older).
        // A different street is a different place: only what was typed is kept. The same street
        // with a corrected city/state/ZIP keeps the stored street with the typed corrections.
        const streetChanged = conflicts.includes('line1');
        const row: Record<string, string | null> = {};
        for (const f of ADDRESS_FIELDS) {
          const typedValue = f in billing ? cleanOrNull(billing[f]) : null;
          row[f] = typedValue ?? (streetChanged ? null : cleanOrNull(target[f]));
        }
        plan.insertAddress = {
          ...base, kind: 'billing', label: freeLabel(held.addresses, 'Billing'), ...row,
          is_default: false, active: true,
        };
        result(addressLine(row), 'kept_additional');
      } else {
        const patch: Record<string, string | null> = {};
        for (const f of ADDRESS_FIELDS) {
          if (!(f in billing)) continue;
          const v = cleanOrNull(billing[f]);
          if (policy.billing === 'fill') { if (v !== null && blank(target[f])) patch[f] = v; }
          else if (v !== (cleanOrNull(target[f]))) patch[f] = v;
        }
        const after = { ...target, ...patch };
        if (policy.billing === 'replace' && ADDRESS_FIELDS.every(f => blank(after[f]))) {
          plan.retireAddress = target.id;
          result(addressLine(target), 'removed');
        } else if (Object.keys(patch).length > 0) {
          plan.updateAddress = { id: target.id, patch };
          result(addressLine(after), 'kept_main');
        } else if (typed) result(typed, 'already_on_file');
      }
    } else {
      const row: Record<string, string | null> = {};
      for (const f of ADDRESS_FIELDS) row[f] = cleanOrNull(billing[f]);
      if (ADDRESS_FIELDS.some(f => row[f] !== null)) {
        plan.insertAddress = {
          ...base, kind: 'billing', label: freeLabel(held.addresses, 'Billing'), ...row,
          is_default: !held.addresses.some(a => a.is_default), active: true,
        };
        result(addressLine(row), 'kept_main');
      }
    }
  }
  return plan;
}

/**
 * 🔴 THE RUN TAG FOR A ROW TYPED DURING TESTING (ledger #348 · David, 2026-09-16, restated 09-17:
 * *"the wipe must work regardless of what users entered or changed during testing"*).
 *
 * While a business is in TEST MODE, a phone, email or address added to a customer that CAME FROM AN
 * IMPORT is stamped with that import's run id, so the import's undo takes it back with the customer
 * it belongs to. `20260917b` also makes the undo remove such rows whether or not they carry the tag —
 * the two together mean a test-mode edit can never block a wipe, and never survive one either.
 *
 * With writes ON, nothing is stamped: the row is a real customer's real contact detail, the undo
 * refuses on it, and that refusal is the protection.
 *
 * Degrades to `null` (no tag) on any read failure — a contact save must not fail over provenance.
 */
export async function testModeRunTag(
  db: SupabaseClient, businessId: string, customerId: string,
): Promise<string | null> {
  try {
    const { data, error } = await db.from('customers')
      .select('import_run_id, businesses(qbo_writes_enabled)')
      .eq('id', customerId).eq('business_id', businessId).maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as { import_run_id: string | null; businesses: { qbo_writes_enabled: boolean | null } | null };
    if (row.businesses?.qbo_writes_enabled !== false) return null;   // writes on, or unknown → no tag
    return row.import_run_id ?? null;
  } catch {
    return null;
  }
}

export type ContactEditOutcome =
  | { ok: true; wrote: number; results: ContactValueResult[]; audited: boolean; auditError?: string }
  | { ok: false; error: string; results: ContactValueResult[]; audited: boolean; auditError?: string };

// ── THE CHANGE LOG ────────────────────────────────────────────────────────────────────────────
// One `audit_log` row per add, make-main and remove (and per refused attempt): who, when, which
// customer, which list, the value, the outcome. A failed log write NEVER undoes the change it
// describes — it is reported as `audited: false`, the stopWrites.saveShipTo precedent.
const ACTION_OF: Record<ContactValueOutcome, string | null> = {
  kept_main: 'contact.make_main', kept_additional: 'contact.add', removed: 'contact.remove',
  not_saved: 'contact.refused', already_on_file: null,
};
// #349: `editContactRow` / `addContactRow` pass their own action ('contact.edit' / 'contact.add'),
// so the log says what a person did rather than what the outcome looked like.

export async function logContactChanges(
  db: SupabaseClient, businessId: string, customerId: string, results: ContactValueResult[],
  meta: { actorUserId?: string | null; source: string; action?: string },
): Promise<{ audited: boolean; auditError?: string }> {
  const rows = results
    .filter(r => ACTION_OF[r.outcome] !== null)
    .map(r => ({
      business_id: businessId,
      actor_user_id: meta.actorUserId ?? null,
      action: meta.action ?? ACTION_OF[r.outcome],
      target_type: 'customer',
      target_id: customerId,
      detail: { list: r.list, value: r.value, outcome: r.outcome, source: meta.source, ...(r.reason ? { reason: r.reason } : {}) },
      outcome: r.outcome === 'not_saved' ? 'failure' : 'success',
    }));
  if (rows.length === 0) return { audited: true };
  // 🔴 NO `.select()`: returning the rows needs a SELECT policy on `audit_log` (`audit_log:read`),
  // which a manager saving a phone need not hold — with it, every change-log write under RLS was
  // refused (measured in the path tests). The count comes back without the rows.
  let error: { message: string } | null = null;
  let count: number | null = null;
  try {
    ({ error, count } = await db.from('audit_log').insert(rows, { count: 'exact' }));
  } catch (e) {
    // A log that cannot be written never undoes, or blocks, the change it describes.
    error = { message: e instanceof Error ? e.message : String(e) };
  }
  if (error) {
    if (TRACE_CONTACT) console.log('[TRACE:CONTACT] change log NOT written', { customerId, message: error.message });
    return { audited: false, auditError: error.message };
  }
  // A8 / R-12 — inline.
  if (count !== rows.length) return { audited: false, auditError: `${count ?? 0} of ${rows.length} change-log rows were written` };
  return { audited: true };
}

/** Every result that was going to change something becomes NOT SAVED, with the reason. */
function refuseAll(results: ContactValueResult[], reason: string): ContactValueResult[] {
  return results.map(r => (r.outcome === 'already_on_file' ? r : { ...r, outcome: 'not_saved' as const, reason }));
}

/** The words a person sees for a write the database refused or could not make. */
function refusalReason(message: string): string {
  if (/row-level security|permission|42501/i.test(message)) return 'you do not have permission to change this customer\'s contact details';
  if (/rows? came back|not saved|of \d+/i.test(message)) return 'the change was refused (you may not have permission to change this customer)';
  return `the database refused it (${message})`;
}

/**
 * Apply a flat edit to one customer's lists. Reads what is held, plans, writes; every statement is
 * count-checked (A8). Returns `wrote: 0` for an edit that changes nothing — not an error. Always
 * returns `results`: a failed write marks every value it carried NOT SAVED, with the reason.
 */
export async function writeContactEdit(
  db: SupabaseClient, businessId: string, customerId: string, edit: ContactEdit, policy: ContactEditPolicy,
): Promise<ContactEditOutcome> {
  if (edit.phone === undefined && edit.email === undefined && edit.billing === undefined) return { ok: true, wrote: 0, results: [], audited: true };
  const [hp, he, ha] = await Promise.all([
    db.from('customer_phones').select(CONTACT_PHONE_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true).order('created_at', { ascending: true }),
    db.from('customer_emails').select(CONTACT_EMAIL_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true).order('created_at', { ascending: true }),
    db.from('customer_addresses').select(CONTACT_ADDRESS_EDIT_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true)
      .order('is_default', { ascending: false }).order('created_at', { ascending: true }),
  ]);
  // #348: in test mode a row typed onto an imported customer carries that import's run id.
  const runTag = policy.importRunId ?? await testModeRunTag(db, businessId, customerId);
  const plan = planContactEdit({
    phones: (hp.data ?? []) as unknown as HeldValue[],
    emails: (he.data ?? []) as unknown as HeldValue[],
    addresses: (ha.data ?? []) as unknown as HeldAddress[],
  }, edit, { ...policy, importRunId: runTag }, { businessId, customerId });
  const log = (results: ContactValueResult[]) => logContactChanges(db, businessId, customerId, results, policy);

  for (const [table, res] of [['customer_phones', hp], ['customer_emails', he], ['customer_addresses', ha]] as const) {
    if (res.error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] edit read FAILED', { table, customerId, message: res.error.message });
      const results = refuseAll(plan.results, refusalReason(res.error.message));
      return { ok: false, error: `${table}: ${res.error.message}`, results, ...(await log(results)) };
    }
  }
  let wrote = 0;
  // Each list is written on its own, so a refusal on one list does not un-report another that landed.
  const failed = new Map<ContactList, string>();
  const fail = (list: ContactList, table: string, message: string) => {
    if (TRACE_CONTACT) console.log('[TRACE:CONTACT] edit write FAILED', { table, customerId, message });
    failed.set(list, `${table}: ${message}`);
  };

  // ORDER IS FORCED by the partial unique indexes: retire and demote first, then promote/insert.
  const phoneOff = [...plan.retirePhones, ...plan.demotePhones];
  phones: {
    if (plan.retirePhones.length > 0) {
      const { data, error } = await db.from('customer_phones').update({ active: false, is_primary: false })
        .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.retirePhones).select('id');
      if (error) { fail('phones', 'customer_phones', error.message); break phones; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.retirePhones.length) { fail('phones', 'customer_phones', `retired ${(data ?? []).length} of ${plan.retirePhones.length} — not saved`); break phones; }
      wrote += plan.retirePhones.length;
    }
    if (plan.demotePhones.length > 0) {
      const { data, error } = await db.from('customer_phones').update({ is_primary: false })
        .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.demotePhones).select('id');
      if (error) { fail('phones', 'customer_phones', error.message); break phones; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.demotePhones.length) { fail('phones', 'customer_phones', `demoted ${(data ?? []).length} of ${plan.demotePhones.length} — not saved`); break phones; }
      wrote += plan.demotePhones.length;
    }
    if (plan.promotePhones.length > 0) {
      const { data, error } = await db.from('customer_phones').update({ is_primary: true })
        .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.promotePhones).select('id');
      if (error) { fail('phones', 'customer_phones', error.message); break phones; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.promotePhones.length) { fail('phones', 'customer_phones', `promoted ${(data ?? []).length} of ${plan.promotePhones.length} — not saved`); break phones; }
      wrote += plan.promotePhones.length;
    }
    if (plan.respellPhone) {
      const { data, error } = await db.from('customer_phones').update({ value: plan.respellPhone.value })
        .eq('business_id', businessId).eq('customer_id', customerId).eq('id', plan.respellPhone.id).select('id');
      if (error) { fail('phones', 'customer_phones', error.message); break phones; }
      // A8 / R-12 — inline.
      if ((data ?? []).length !== 1) { fail('phones', 'customer_phones', 'the number was not updated — not saved'); break phones; }
      wrote += 1;
    }
    if (plan.insertPhones.length > 0) {
      const { data, error } = await db.from('customer_phones').insert(plan.insertPhones).select('id');
      if (error) { fail('phones', 'customer_phones', error.message); break phones; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.insertPhones.length) { fail('phones', 'customer_phones', `${(data ?? []).length} of ${plan.insertPhones.length} rows came back — not saved`); break phones; }
      wrote += plan.insertPhones.length;
    }
  }

  emails: {
    if (plan.retireEmails.length > 0) {
      const { data, error } = await db.from('customer_emails').update({ active: false, is_primary: false })
        .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.retireEmails).select('id');
      if (error) { fail('emails', 'customer_emails', error.message); break emails; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.retireEmails.length) { fail('emails', 'customer_emails', `retired ${(data ?? []).length} of ${plan.retireEmails.length} — not saved`); break emails; }
      wrote += plan.retireEmails.length;
    }
    if (plan.demoteEmails.length > 0) {
      const { data, error } = await db.from('customer_emails').update({ is_primary: false })
        .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.demoteEmails).select('id');
      if (error) { fail('emails', 'customer_emails', error.message); break emails; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.demoteEmails.length) { fail('emails', 'customer_emails', `demoted ${(data ?? []).length} of ${plan.demoteEmails.length} — not saved`); break emails; }
      wrote += plan.demoteEmails.length;
    }
    if (plan.promoteEmails.length > 0) {
      const { data, error } = await db.from('customer_emails').update({ is_primary: true })
        .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.promoteEmails).select('id');
      if (error) { fail('emails', 'customer_emails', error.message); break emails; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.promoteEmails.length) { fail('emails', 'customer_emails', `promoted ${(data ?? []).length} of ${plan.promoteEmails.length} — not saved`); break emails; }
      wrote += plan.promoteEmails.length;
    }
    if (plan.insertEmails.length > 0) {
      const { data, error } = await db.from('customer_emails').insert(plan.insertEmails).select('id');
      if (error) { fail('emails', 'customer_emails', error.message); break emails; }
      // A8 / R-12 — inline.
      if ((data ?? []).length === 0 || (data ?? []).length !== plan.insertEmails.length) { fail('emails', 'customer_emails', `${(data ?? []).length} of ${plan.insertEmails.length} rows came back — not saved`); break emails; }
      wrote += plan.insertEmails.length;
    }
  }

  addresses: {
    if (plan.retireAddress) {
      const { data, error } = await db.from('customer_addresses').update({ active: false, is_default: false })
        .eq('business_id', businessId).eq('customer_id', customerId).eq('id', plan.retireAddress).select('id');
      if (error) { fail('addresses', 'customer_addresses', error.message); break addresses; }
      // A8 / R-12 — inline.
      if ((data ?? []).length !== 1) { fail('addresses', 'customer_addresses', 'the billing address was not cleared — not saved'); break addresses; }
      wrote += 1;
    }
    if (plan.updateAddress) {
      const { data, error } = await db.from('customer_addresses').update(plan.updateAddress.patch)
        .eq('business_id', businessId).eq('customer_id', customerId).eq('id', plan.updateAddress.id).select('id');
      if (error) { fail('addresses', 'customer_addresses', error.message); break addresses; }
      // A8 / R-12 — inline.
      if ((data ?? []).length !== 1) { fail('addresses', 'customer_addresses', 'the billing address was not updated — not saved'); break addresses; }
      wrote += 1;
    }
    if (plan.insertAddress) {
      const { data, error } = await db.from('customer_addresses').insert(plan.insertAddress).select('id');
      if (error) { fail('addresses', 'customer_addresses', error.message); break addresses; }
      // A8 / R-12 — inline.
      if ((data ?? []).length !== 1) { fail('addresses', 'customer_addresses', 'the billing address was not added — not saved'); break addresses; }
      wrote += 1;
    }
  }

  const results = plan.results.map(r => {
    const why = failed.get(r.list);
    return why && r.outcome !== 'already_on_file' ? { ...r, outcome: 'not_saved' as const, reason: refusalReason(why) } : r;
  });
  const audit = await log(results);
  if (TRACE_CONTACT) console.log('[TRACE:CONTACT] edit', { customerId, policy: { phone: policy.phone, email: policy.email, billing: policy.billing }, source: policy.source, wrote, phonesOff: phoneOff.length, outcomes: results.map(r => `${r.list}:${r.outcome}`), audited: audit.audited });
  if (failed.size > 0) return { ok: false, error: [...failed.values()].join('; '), results, ...audit };
  return { ok: true, wrote, results, ...audit };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE LISTS ON THE CUSTOMER PAGE — read, Make main, Remove (ledger #345)
// ══════════════════════════════════════════════════════════════════════════════════════════════
// Read with `customers:read`; Make main and Remove are UPDATEs, so RLS gates them on
// `customers:update` (`customer_*_member_update`). Remove RETIRES (active=false) — never a delete
// (R-133). Removing the main phone or email makes the oldest remaining one main, so the list always
// shows which number the invoices and the route use.

export interface ContactListRow { id: string; value: string; label: string | null; is_main: boolean; source: string | null; created_at: string | null }
/** `is_main` = the address the database shows as the customer's billing address. A shipping-only
 *  site is never main; `is_default` says whether it is the site the checkout picker offers first. */
export interface AddressListRow extends ContactListRow { kind: string; is_default: boolean }
export interface CustomerContactLists { phones: ContactListRow[]; emails: ContactListRow[]; addresses: AddressListRow[] }

export async function readContactLists(
  db: SupabaseClient, businessId: string, customerId: string,
): Promise<{ ok: true; lists: CustomerContactLists } | { ok: false; error: string }> {
  const [hp, he, ha] = await Promise.all([
    db.from('customer_phones').select(CONTACT_VALUE_LIST_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    db.from('customer_emails').select(CONTACT_VALUE_LIST_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    db.from('customer_addresses').select(CONTACT_ADDRESS_LIST_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true)
      .order('is_default', { ascending: false }).order('created_at', { ascending: true }),
  ]);
  for (const res of [hp, he, ha]) if (res.error) return { ok: false, error: res.error.message };
  type V = { id: string; value: string; label: string | null; is_primary: boolean; source: string | null; created_at: string | null };
  type A = { id: string; label: string; kind: string; line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null; is_default: boolean; source: string | null; created_at: string | null };
  const values = (rows: V[]): ContactListRow[] => {
    // The main one is the primary, or — with none flagged — the oldest, which is what the database
    // derives onto the customer row. The page must mark the same one the invoice uses.
    const mainId = (rows.find(r => r.is_primary) ?? rows[0])?.id;
    return rows.map(r => ({ id: r.id, value: r.value, label: r.label, is_main: r.id === mainId, source: r.source, created_at: r.created_at }));
  };
  const addrs = (ha.data ?? []) as unknown as A[];
  // Same order as `sync_customer_flat_contact`: default first, then oldest — so the first billing row
  // here IS the one on the customer row.
  const billingMain = addrs.find(a => a.kind === 'billing' || a.kind === 'both')?.id;
  return {
    ok: true,
    lists: {
      phones: values((hp.data ?? []) as unknown as V[]),
      emails: values((he.data ?? []) as unknown as V[]),
      addresses: addrs.map(a => ({
        id: a.id, value: addressLine(a), label: a.label, kind: a.kind,
        is_main: a.id === billingMain, is_default: a.is_default,
        source: a.source, created_at: a.created_at,
      })),
    },
  };
}

/** The list's table, by LITERAL name — `contactRecord.test` G6 refuses a table reached through a
 *  variable, because a variable is how a write escapes every text-based check. */
function listTable(db: SupabaseClient, list: ContactList) {
  switch (list) {
    case 'phones': return db.from('customer_phones');
    case 'emails': return db.from('customer_emails');
    case 'addresses': return db.from('customer_addresses');
  }
}
const MAIN_COLUMN: Record<ContactList, 'is_primary' | 'is_default'> = { phones: 'is_primary', emails: 'is_primary', addresses: 'is_default' };

export interface ListActionInput {
  businessId: string; customerId: string; list: ContactList; rowId: string; actorUserId?: string | null;
}
export type ListActionOutcome = { ok: boolean; result: ContactValueResult; audited: boolean; auditError?: string };

async function heldRow(db: SupabaseClient, x: ListActionInput) {
  const cols = x.list === 'addresses' ? 'id, line1, line2, city, state, zip, is_default, active' : 'id, value, is_primary, active';
  const { data, error } = await listTable(db, x.list).select(cols)
    .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq('id', x.rowId).maybeSingle();
  const row = data as unknown as ({ value?: string; active: boolean } & ContactEditAddress) | null;
  const value = row ? (x.list === 'addresses' ? addressLine(row) : String(row.value ?? '')) : '';
  return { row, value, error };
}

async function finishAction(db: SupabaseClient, x: ListActionInput, result: ContactValueResult, action: string): Promise<ListActionOutcome> {
  const audit = await logContactChanges(db, x.businessId, x.customerId, [result], { actorUserId: x.actorUserId, source: 'customer-page', action });
  if (TRACE_CONTACT) console.log('[TRACE:CONTACT] list action', { customerId: x.customerId, list: x.list, action, outcome: result.outcome, audited: audit.audited });
  return { ok: result.outcome !== 'not_saved', result, ...audit };
}

export interface ContactValuePatch { value?: string; label?: string | null }
export interface ContactAddressPatch {
  label?: string; kind?: string;
  line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; zip?: string | null;
}

/** The words for a refusal the database made on a list write, in a form a person can act on. */
function listRefusal(message: string): string {
  if (/duplicate key|23505|one_per_value/i.test(message)) return 'that one is already on this customer';
  if (/one_label|customer_addresses_one_label/i.test(message)) return 'this customer already has an address with that name';
  return refusalReason(message);
}

/**
 * EDIT one row of a list (ledger #349 · David, 2026-09-17: *"every screen needs the create/edit/update
 * pieces"*). Before this, a typo could only be REMOVED and retyped, which loses the row's history.
 * A phone or email may have its value and its label corrected; an address, every field it holds.
 * `value_norm` is recomputed by the database trigger, so a corrected number is compared as a number.
 */
export async function editContactRow(
  db: SupabaseClient, x: ListActionInput & { patch: ContactValuePatch | ContactAddressPatch },
): Promise<ListActionOutcome> {
  const { row, value: before, error } = await heldRow(db, x);
  const refuse = (reason: string, shown = before) => finishAction(db, x, { list: x.list, value: shown, outcome: 'not_saved', reason }, 'contact.refused');
  if (error) return refuse(refusalReason(error.message));
  if (!row || !row.active) return refuse('that entry is no longer on file');

  const patch: Record<string, unknown> = {};
  if (x.list === 'addresses') {
    const p = x.patch as ContactAddressPatch;
    for (const f of ['label', 'kind', ...ADDRESS_FIELDS] as const) {
      if (!(f in p)) continue;
      const v = p[f as keyof ContactAddressPatch];
      patch[f] = f === 'label' || f === 'kind' ? String(v ?? '').trim() : cleanOrNull(v);
    }
    if ('label' in patch && !patch.label) return refuse('an address needs a name, such as "Billing" or "Job site"');
    if (ADDRESS_FIELDS.every(f => blank(f in patch ? patch[f] : (row as unknown as Record<string, unknown>)[f])))
      return refuse('an address needs at least a street, a city or a ZIP — use Remove to take it off');
  } else {
    const p = x.patch as ContactValuePatch;
    if ('label' in p) patch.label = cleanOrNull(p.label) ?? 'other';
    if ('value' in p) {
      const v = cleanOrNull(p.value);
      if (v === null) return refuse('leave it as it is, or use Remove — a blank is not a change');
      patch.value = v;
    }
  }
  if (Object.keys(patch).length === 0) return finishAction(db, x, { list: x.list, value: before, outcome: 'already_on_file' }, 'contact.refused');

  const { data, error: upErr } = await listTable(db, x.list).update(patch)
    .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq('id', x.rowId).select('id');
  if (upErr) return refuse(listRefusal(upErr.message));
  // A8 / R-12 — inline: under RLS a refused UPDATE comes back as zero rows and no error.
  if ((data ?? []).length === 0 || (data ?? []).length !== 1) return refuse(refusalReason('0 rows came back'));
  const after = await heldRow(db, x);
  return finishAction(db, x, { list: x.list, value: after.value || before, outcome: row[MAIN_COLUMN[x.list] as keyof typeof row] === true ? 'kept_main' : 'kept_additional' }, 'contact.edit');
}

/**
 * ADD a row to a list (ledger #349). The first phone or email a customer has becomes their main one;
 * after that a new row is additional and the main one is untouched — the same rule checkout follows.
 * In test mode the row carries the customer's import run (#348), so a wipe takes it back.
 */
export async function addContactRow(
  db: SupabaseClient, x: Omit<ListActionInput, 'rowId'> & { patch: ContactValuePatch | ContactAddressPatch; source?: string },
): Promise<ListActionOutcome> {
  const key = { ...x, rowId: '(new)' } as ListActionInput;
  const shown = x.list === 'addresses' ? addressLine(x.patch as ContactAddressPatch) : cleanOrNull((x.patch as ContactValuePatch).value) ?? '';
  const refuse = (reason: string) => finishAction(db, key, { list: x.list, value: shown, outcome: 'not_saved', reason }, 'contact.refused');
  const source = x.source ?? 'manual';
  const runId = await testModeRunTag(db, x.businessId, x.customerId);
  const base: Record<string, unknown> = { business_id: x.businessId, customer_id: x.customerId, source, active: true };
  if (runId) base.import_run_id = runId;

  let insert: Record<string, unknown>;
  if (x.list === 'addresses') {
    const p = x.patch as ContactAddressPatch;
    const row: Record<string, string | null> = {};
    for (const f of ADDRESS_FIELDS) row[f] = cleanOrNull(p[f]);
    if (ADDRESS_FIELDS.every(f => row[f] === null)) return refuse('type at least a street, a city or a ZIP');
    const held = await db.from('customer_addresses').select('label, is_default')
      .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq('active', true);
    if (held.error) return refuse(refusalReason(held.error.message));
    const rows = (held.data ?? []) as unknown as { label: string; is_default: boolean }[];
    const kind = (p.kind ?? 'shipping').trim();
    insert = { ...base, ...row, kind,
      label: cleanOrNull(p.label) ?? freeLabel(rows, kind === 'shipping' ? 'Job site' : 'Billing'),
      is_default: !rows.some(r => r.is_default) };
  } else {
    const p = x.patch as ContactValuePatch;
    const v = cleanOrNull(p.value);
    if (v === null) return refuse(x.list === 'phones' ? 'type a number' : 'type an email address');
    const held = await listTable(db, x.list).select('id, is_primary')
      .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq('active', true);
    if (held.error) return refuse(refusalReason(held.error.message));
    const rows = (held.data ?? []) as unknown as { is_primary: boolean }[];
    insert = { ...base, value: v, label: cleanOrNull(p.label) ?? (rows.length === 0 ? 'main' : 'other'), is_primary: rows.length === 0 };
  }

  const { data, error } = await listTable(db, x.list).insert(insert).select('id');
  if (error) return refuse(listRefusal(error.message));
  // A8 / R-12 — inline.
  if ((data ?? []).length === 0 || (data ?? []).length !== 1) return refuse(refusalReason('0 rows came back'));
  const id = (data as unknown as { id: string }[])[0].id;
  const main = insert.is_primary === true || insert.is_default === true;
  return finishAction(db, { ...key, rowId: id }, { list: x.list, value: shown, outcome: main ? 'kept_main' : 'kept_additional' }, 'contact.add');
}

/** Make one row the main one. The current main is demoted first (the partial unique index forces the order). */
export async function makeContactMain(db: SupabaseClient, x: ListActionInput): Promise<ListActionOutcome> {
  const col = MAIN_COLUMN[x.list];
  const { row, value, error } = await heldRow(db, x);
  const refuse = (reason: string) => finishAction(db, x, { list: x.list, value, outcome: 'not_saved', reason }, 'contact.refused');
  if (error) return refuse(refusalReason(error.message));
  if (!row || !row.active) return refuse('that entry is no longer on file');
  const demote = await listTable(db, x.list).update({ [col]: false })
    .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq(col, true).eq('active', true).neq('id', x.rowId).select('id');
  if (demote.error) return refuse(refusalReason(demote.error.message));
  // A8 / R-12 — inline: ZERO is legitimate (nothing was main); more than one cannot happen under the
  // one-main index, so if it does the list is not what was read and the change is refused.
  if ((demote.data ?? []).length > 1) return refuse('the list changed while you were looking at it — reload and try again');
  const promote = await listTable(db, x.list).update({ [col]: true })
    .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq('id', x.rowId).select('id');
  if (promote.error) return refuse(refusalReason(promote.error.message));
  // A8 / R-12 — inline: under RLS a refused UPDATE returns zero rows and no error.
  if ((promote.data ?? []).length !== 1) return refuse(refusalReason('0 rows came back'));
  return finishAction(db, x, { list: x.list, value, outcome: 'kept_main' }, 'contact.make_main');
}

/** Remove = retire (active=false). Never a delete. The oldest remaining phone/email becomes main. */
export async function retireContact(db: SupabaseClient, x: ListActionInput): Promise<ListActionOutcome> {
  const col = MAIN_COLUMN[x.list];
  const { row, value, error } = await heldRow(db, x);
  const refuse = (reason: string) => finishAction(db, x, { list: x.list, value, outcome: 'not_saved', reason }, 'contact.refused');
  if (error) return refuse(refusalReason(error.message));
  if (!row || !row.active) return refuse('that entry is no longer on file');
  const wasMain = (row as unknown as Record<string, unknown>)[col] === true;
  const off = await listTable(db, x.list).update({ active: false, [col]: false })
    .eq('business_id', x.businessId).eq('customer_id', x.customerId).eq('id', x.rowId).select('id');
  if (off.error) return refuse(refusalReason(off.error.message));
  // A8 / R-12 — inline.
  if ((off.data ?? []).length !== 1) return refuse(refusalReason('0 rows came back'));
  if (wasMain && x.list !== 'addresses') {
    const next = await listTable(db, x.list).select('id').eq('business_id', x.businessId).eq('customer_id', x.customerId)
      .eq('active', true).order('created_at', { ascending: true }).limit(1);
    const nextId = ((next.data ?? []) as unknown as { id: string }[])[0]?.id;
    if (nextId) {
      const up = await listTable(db, x.list).update({ [col]: true }).eq('business_id', x.businessId).eq('id', nextId).select('id');
      if (TRACE_CONTACT && (up.error || (up.data ?? []).length !== 1)) console.log('[TRACE:CONTACT] next main not flagged', { customerId: x.customerId, list: x.list });
    }
  }
  return finishAction(db, x, { list: x.list, value, outcome: 'removed' }, 'contact.remove');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE SHIP-TO PICKER'S TWO STATEMENTS — moved here so every list write has one home
// ══════════════════════════════════════════════════════════════════════════════════════════════
// `customerAddresses.ts` keeps the PLAN (label required, street + city/ZIP, the twin check); the
// statements live here. Outcomes are returned raw so the caller keeps its own sentences.

export async function insertShipToSite(
  db: SupabaseClient, row: Omit<CustomerAddress, 'id'>, columns: string,
): Promise<{ rows: CustomerAddress[]; error: { code?: string; message: string } | null }> {
  // #348: a site saved during testing rides the customer's import run, so the undo takes it back.
  const tagged = { ...row } as Record<string, unknown>;
  if (tagged.import_run_id === undefined || tagged.import_run_id === null) {
    const tag = await testModeRunTag(db, row.business_id, row.customer_id);
    if (tag) tagged.import_run_id = tag;
  }
  const { data, error } = await db.from('customer_addresses').insert(tagged).select(columns);
  // A8 / R-12: the caller checks `rows.length === 1` and says so in words.
  return { rows: (data ?? []) as unknown as CustomerAddress[], error: error as { code?: string; message: string } | null };
}

export async function retireShipToSite(
  db: SupabaseClient, businessId: string, siteId: string,
): Promise<{ count: number; error: { message: string } | null }> {
  const { data, error } = await db.from('customer_addresses')
    .update({ active: false, is_default: false })
    .eq('id', siteId).eq('business_id', businessId).select('id');
  // A8 / R-12: a retirement that touched nothing is a refusal. It is traced here; the caller
  // (`retireCustomerAddress`) turns the count into a sentence for the person.
  if ((data ?? []).length !== 1 && TRACE_CONTACT) console.log('[TRACE:CONTACT] ship-to retire touched', (data ?? []).length, 'rows, not 1', { siteId });
  return { count: (data ?? []).length, error };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE CUSTOMER-IMPORT UNDO'S CONTACT HALF (mirrors 20260916d for the customers-only route)
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Run customers holding an UNTAGGED contact row — a person added it, so the undo must not take it. */
export async function runCustomersWithHandAddedContacts(
  db: SupabaseClient, businessId: string, runId: string, customerIds: string[],
): Promise<{ ok: true; counts: Map<string, number> } | { ok: false; error: string }> {
  const counts = new Map<string, number>();
  const bump = (rows: unknown) => { for (const r of (rows ?? []) as { customer_id: string }[]) counts.set(r.customer_id, (counts.get(r.customer_id) ?? 0) + 1); };
  for (let i = 0; i < customerIds.length; i += ID_CHUNK) {
    const ids = customerIds.slice(i, i + ID_CHUNK);
    const [p, e, a] = await Promise.all([
      db.from('customer_phones').select('customer_id').eq('business_id', businessId).in('customer_id', ids).or(`import_run_id.is.null,import_run_id.neq.${runId}`),
      db.from('customer_emails').select('customer_id').eq('business_id', businessId).in('customer_id', ids).or(`import_run_id.is.null,import_run_id.neq.${runId}`),
      db.from('customer_addresses').select('customer_id').eq('business_id', businessId).in('customer_id', ids).or(`import_run_id.is.null,import_run_id.neq.${runId}`),
    ]);
    for (const [table, res] of [['customer_phones', p], ['customer_emails', e], ['customer_addresses', a]] as const) {
      if (res.error) return { ok: false, error: `${table}: ${res.error.message}` };
    }
    bump(p.data); bump(e.data); bump(a.data);
  }
  return { ok: true, counts };
}

/** Delete the run's tagged contact rows for these customers — addresses first is not needed here
 *  (they are all deleted before the customers), but `customer_addresses` is RESTRICT, so this MUST
 *  run before the customer delete. */
export async function removeRunContactRows(
  db: SupabaseClient, businessId: string, runId: string, customerIds: string[],
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  let removed = 0;
  for (let i = 0; i < customerIds.length; i += ID_CHUNK) {
    const ids = customerIds.slice(i, i + ID_CHUNK);
    const p = await db.from('customer_phones').delete().eq('business_id', businessId).eq('import_run_id', runId).in('customer_id', ids).select('id');
    if (p.error) return { ok: false, error: `customer_phones: ${p.error.message}` };
    const e = await db.from('customer_emails').delete().eq('business_id', businessId).eq('import_run_id', runId).in('customer_id', ids).select('id');
    if (e.error) return { ok: false, error: `customer_emails: ${e.error.message}` };
    const a = await db.from('customer_addresses').delete().eq('business_id', businessId).eq('import_run_id', runId).in('customer_id', ids).select('id');
    if (a.error) return { ok: false, error: `customer_addresses: ${a.error.message}` };
    // A8: the caller's post-delete re-read of the customers is the authority; the count is reported.
    removed += (p.data ?? []).length + (e.data ?? []).length + (a.data ?? []).length;
  }
  return { ok: true, removed };
}
