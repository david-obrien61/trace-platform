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
//               planContactEdit · writeContactEdit · contactEditOf · insertShipToSite ·
//               retireShipToSite · removeRunContactRows · runCustomersWithHandAddedContacts
//
// 🔴 EVERY WRITER OF A CUSTOMER'S PHONE, EMAIL OR ADDRESS COMES THROUGH THIS FILE (David, 2026-09-16).
//    `customers.phone` / `email` / `billing_*` are DERIVED by the database from the three lists, and
//    `20260915_contact_record` §5e REFUSES a direct write to them. The writers, and which entry each
//    uses: the QuickBooks import → `writeContactRecords` (tagged with its run) · OCR capture, checkout
//    and delivery ingest (all via `customerUpsert`) and the customer editor → `writeContactEdit` ·
//    the ship-to picker → `insertShipToSite` / `retireShipToSite` · the customer-import undo →
//    `removeRunContactRows`.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRecord } from './contactRecord';
import { addressKey, normalizeEmailValue, normalizePhoneValue, phonesInText, splitEmails } from './contactRecord';
import { CONTACT_ADDRESS_EDIT_COLUMNS, CONTACT_ADDRESS_READ_COLUMNS, CONTACT_EMAIL_COLUMNS, CONTACT_PHONE_COLUMNS } from './contactFields';
import type { CustomerAddress } from './customerAddresses';

// STD-003: ON by default until OWNER-PROVEN. Do not comment out (§7 standing instruction).
const TRACE_CONTACT = true;

// The column lists live in `contactFields.ts` — `verify-field-lists` counts a list declared beside
// its reader as hand-written, and an imported one as derived (the `customerAddressFields.ts` shape).
export { CONTACT_PHONE_COLUMNS, CONTACT_EMAIL_COLUMNS, CONTACT_ADDRESS_READ_COLUMNS, CONTACT_ADDRESS_EDIT_COLUMNS };

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
//     'fill'     — fill only the blank fields of the billing address on file; add one if none.
//     'replace'  — set the supplied fields on it (a cleared field clears); add one if none. An
//                  address left with nothing in it is retired.
// `undefined` = the caller did not touch the field. `null`/'' = cleared (meaningful for 'replace').

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
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';
const cleanOrNull = (v: unknown): string | null => (blank(v) ? null : String(v).trim());

/**
 * PURE. Held rows (active, oldest first) + the edit + the policy → exactly what to write.
 * Every decision below is asserted in `contactWriter.test.ts` §K without a client.
 */
export function planContactEdit(
  held: { phones: HeldValue[]; emails: HeldValue[]; addresses: HeldAddress[] },
  edit: ContactEdit, policy: ContactEditPolicy, ids: { businessId: string; customerId: string },
): ContactEditPlan {
  const plan: ContactEditPlan = {
    retirePhones: [], demotePhones: [], promotePhones: [], respellPhone: null,
    retireEmails: [], demoteEmails: [], promoteEmails: [],
    insertPhones: [], insertEmails: [], updateAddress: null, retireAddress: null, insertAddress: null,
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
    list: HeldValue[], main: string | null | undefined, extras: { value: string; note?: string | null }[],
    mode: ContactFieldPolicy, norm: (v: string) => string,
    out: { retire: string[]; demote: string[]; promote: string[]; insert: Record<string, unknown>[] },
    label: string, extraLabel: string,
  ): { respell: { id: string; value: string } | null } => {
    const live = list.map(h => ({ ...h }));
    let respell: { id: string; value: string } | null = null;
    const primaryOf = () => live.find(h => h.is_primary) ?? null;
    const find = (v: string) => live.find(h => (h.value_norm ?? norm(h.value)) === norm(v)) ?? null;
    const demote = (h: { id: string; is_primary: boolean }) => { if (h.is_primary) { out.demote.push(h.id); h.is_primary = false; } };
    const retire = (h: { id: string }) => { out.retire.push(h.id); const i = live.findIndex(x => x.id === h.id); if (i >= 0) live.splice(i, 1); };

    if (main !== undefined) {
      const v = cleanOrNull(main);
      const current = primaryOf() ?? live[0] ?? null;
      if (v === null) {
        if (mode === 'replace' && current) retire(current);
      } else {
        const match = find(v);
        if (mode === 'add') {
          if (!match) out.insert.push({ ...base, label, value: v, is_primary: primaryOf() === null });
        } else if (match) {
          if (match === current || match.is_primary) {
            if (mode === 'replace' && match.value !== v) respell = { id: match.id, value: v };
          } else {
            // The value is on file but is not the one shown. 'replace' retires what WAS shown
            // (the primary, or — with no primary — the oldest, which is what the derivation shows);
            // 'primary' only demotes. Then the matching row is promoted.
            if (mode === 'replace') { if (current && current.id !== match.id) retire(current); }
            else { const p = primaryOf(); if (p) demote(p); }
            out.promote.push(match.id); match.is_primary = true;
          }
        } else {
          const p = primaryOf();
          if (mode === 'replace') { if (current) retire(current); }
          else if (p) demote(p);
          out.insert.push({ ...base, label, value: v, is_primary: true });
          live.push({ id: '(new)', value: v, value_norm: norm(v), is_primary: true });
        }
      }
    }
    for (const x of extras) {
      if (find(x.value) || out.insert.some(r => norm(String(r.value)) === norm(x.value))) continue;
      const row: Record<string, unknown> = { ...base, label: extraLabel, value: x.value, is_primary: primaryOf() === null && !out.insert.some(r => r.is_primary === true) };
      if (x.note !== undefined) row.note = x.note;
      out.insert.push(row);
      live.push({ id: '(new)', value: x.value, value_norm: norm(x.value), is_primary: row.is_primary === true });
    }
    return { respell };
  };

  const ph = { retire: plan.retirePhones, demote: plan.demotePhones, promote: plan.promotePhones, insert: plan.insertPhones };
  plan.respellPhone = applyValues(held.phones, edit.phone, extraPhones, policy.phone, normalizePhoneValue, ph, 'main', 'other').respell;

  if (edit.email !== undefined) {
    const parts = edit.email === null || blank(edit.email) ? [] : splitEmails(edit.email);
    const em = { retire: plan.retireEmails, demote: plan.demoteEmails, promote: plan.promoteEmails, insert: plan.insertEmails };
    applyValues(held.emails, parts[0] ?? null, parts.slice(1).map(value => ({ value })), policy.email, normalizeEmailValue, em, 'main', 'main');
  }

  // ── the billing address ──
  if (billing && Object.keys(billing).length > 0) {
    const target = held.addresses.find(a => a.kind === 'billing' || a.kind === 'both') ?? null;
    const fields = ['line1', 'line2', 'city', 'state', 'zip'] as const;
    if (target) {
      const patch: Record<string, string | null> = {};
      for (const f of fields) {
        if (!(f in billing)) continue;
        const v = cleanOrNull(billing[f]);
        if (policy.billing === 'fill') { if (v !== null && blank(target[f])) patch[f] = v; }
        else if (v !== (cleanOrNull(target[f]))) patch[f] = v;
      }
      const after = { ...target, ...patch };
      if (policy.billing === 'replace' && fields.every(f => blank(after[f]))) plan.retireAddress = target.id;
      else if (Object.keys(patch).length > 0) plan.updateAddress = { id: target.id, patch };
    } else {
      const row: Record<string, string | null> = {};
      for (const f of fields) row[f] = cleanOrNull(billing[f]);
      if (fields.some(f => row[f] !== null)) {
        const taken = new Set(held.addresses.map(a => a.label.trim().toLowerCase()));
        let label = 'Billing';
        for (let n = 2; taken.has(label.toLowerCase()); n++) label = `Billing ${n}`;
        plan.insertAddress = {
          ...base, kind: 'billing', label, ...row,
          is_default: !held.addresses.some(a => a.is_default), active: true,
        };
      }
    }
  }
  return plan;
}

export type ContactEditOutcome = { ok: true; wrote: number } | { ok: false; error: string };

/**
 * Apply a flat edit to one customer's lists. Reads what is held, plans, writes; every statement is
 * count-checked (A8). Returns `wrote: 0` for an edit that changes nothing — not an error.
 */
export async function writeContactEdit(
  db: SupabaseClient, businessId: string, customerId: string, edit: ContactEdit, policy: ContactEditPolicy,
): Promise<ContactEditOutcome> {
  if (edit.phone === undefined && edit.email === undefined && edit.billing === undefined) return { ok: true, wrote: 0 };
  const [hp, he, ha] = await Promise.all([
    db.from('customer_phones').select(CONTACT_PHONE_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true).order('created_at', { ascending: true }),
    db.from('customer_emails').select(CONTACT_EMAIL_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true).order('created_at', { ascending: true }),
    db.from('customer_addresses').select(CONTACT_ADDRESS_EDIT_COLUMNS)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('active', true)
      .order('is_default', { ascending: false }).order('created_at', { ascending: true }),
  ]);
  for (const [table, res] of [['customer_phones', hp], ['customer_emails', he], ['customer_addresses', ha]] as const) {
    if (res.error) {
      if (TRACE_CONTACT) console.log('[TRACE:CONTACT] edit read FAILED', { table, customerId, message: res.error.message });
      return { ok: false, error: `${table}: ${res.error.message}` };
    }
  }
  const plan = planContactEdit({
    phones: (hp.data ?? []) as unknown as HeldValue[],
    emails: (he.data ?? []) as unknown as HeldValue[],
    addresses: (ha.data ?? []) as unknown as HeldAddress[],
  }, edit, policy, { businessId, customerId });
  let wrote = 0;
  const fail = (table: string, message: string): ContactEditOutcome => {
    if (TRACE_CONTACT) console.log('[TRACE:CONTACT] edit write FAILED', { table, customerId, message });
    return { ok: false, error: `${table}: ${message}` };
  };

  // ORDER IS FORCED by the partial unique indexes: retire and demote first, then promote/insert.
  const phoneOff = [...plan.retirePhones, ...plan.demotePhones];
  if (plan.retirePhones.length > 0) {
    const { data, error } = await db.from('customer_phones').update({ active: false, is_primary: false })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.retirePhones).select('id');
    if (error) return fail('customer_phones', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.retirePhones.length) return fail('customer_phones', `retired ${(data ?? []).length} of ${plan.retirePhones.length} — not saved`);
    wrote += plan.retirePhones.length;
  }
  if (plan.demotePhones.length > 0) {
    const { data, error } = await db.from('customer_phones').update({ is_primary: false })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.demotePhones).select('id');
    if (error) return fail('customer_phones', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.demotePhones.length) return fail('customer_phones', `demoted ${(data ?? []).length} of ${plan.demotePhones.length} — not saved`);
    wrote += plan.demotePhones.length;
  }
  if (plan.promotePhones.length > 0) {
    const { data, error } = await db.from('customer_phones').update({ is_primary: true })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.promotePhones).select('id');
    if (error) return fail('customer_phones', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.promotePhones.length) return fail('customer_phones', `promoted ${(data ?? []).length} of ${plan.promotePhones.length} — not saved`);
    wrote += plan.promotePhones.length;
  }
  if (plan.respellPhone) {
    const { data, error } = await db.from('customer_phones').update({ value: plan.respellPhone.value })
      .eq('business_id', businessId).eq('customer_id', customerId).eq('id', plan.respellPhone.id).select('id');
    if (error) return fail('customer_phones', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== 1) return fail('customer_phones', 'the number was not updated — not saved');
    wrote += 1;
  }
  if (plan.insertPhones.length > 0) {
    const { data, error } = await db.from('customer_phones').insert(plan.insertPhones).select('id');
    if (error) return fail('customer_phones', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.insertPhones.length) return fail('customer_phones', `${(data ?? []).length} of ${plan.insertPhones.length} rows came back — not saved`);
    wrote += plan.insertPhones.length;
  }

  if (plan.retireEmails.length > 0) {
    const { data, error } = await db.from('customer_emails').update({ active: false, is_primary: false })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.retireEmails).select('id');
    if (error) return fail('customer_emails', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.retireEmails.length) return fail('customer_emails', `retired ${(data ?? []).length} of ${plan.retireEmails.length} — not saved`);
    wrote += plan.retireEmails.length;
  }
  if (plan.demoteEmails.length > 0) {
    const { data, error } = await db.from('customer_emails').update({ is_primary: false })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.demoteEmails).select('id');
    if (error) return fail('customer_emails', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.demoteEmails.length) return fail('customer_emails', `demoted ${(data ?? []).length} of ${plan.demoteEmails.length} — not saved`);
    wrote += plan.demoteEmails.length;
  }
  if (plan.promoteEmails.length > 0) {
    const { data, error } = await db.from('customer_emails').update({ is_primary: true })
      .eq('business_id', businessId).eq('customer_id', customerId).in('id', plan.promoteEmails).select('id');
    if (error) return fail('customer_emails', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.promoteEmails.length) return fail('customer_emails', `promoted ${(data ?? []).length} of ${plan.promoteEmails.length} — not saved`);
    wrote += plan.promoteEmails.length;
  }
  if (plan.insertEmails.length > 0) {
    const { data, error } = await db.from('customer_emails').insert(plan.insertEmails).select('id');
    if (error) return fail('customer_emails', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== plan.insertEmails.length) return fail('customer_emails', `${(data ?? []).length} of ${plan.insertEmails.length} rows came back — not saved`);
    wrote += plan.insertEmails.length;
  }

  if (plan.retireAddress) {
    const { data, error } = await db.from('customer_addresses').update({ active: false, is_default: false })
      .eq('business_id', businessId).eq('customer_id', customerId).eq('id', plan.retireAddress).select('id');
    if (error) return fail('customer_addresses', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== 1) return fail('customer_addresses', 'the billing address was not cleared — not saved');
    wrote += 1;
  }
  if (plan.updateAddress) {
    const { data, error } = await db.from('customer_addresses').update(plan.updateAddress.patch)
      .eq('business_id', businessId).eq('customer_id', customerId).eq('id', plan.updateAddress.id).select('id');
    if (error) return fail('customer_addresses', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== 1) return fail('customer_addresses', 'the billing address was not updated — not saved');
    wrote += 1;
  }
  if (plan.insertAddress) {
    const { data, error } = await db.from('customer_addresses').insert(plan.insertAddress).select('id');
    if (error) return fail('customer_addresses', error.message);
    // A8 / R-12 — inline.
    if ((data ?? []).length !== 1) return fail('customer_addresses', 'the billing address was not added — not saved');
    wrote += 1;
  }
  if (TRACE_CONTACT) console.log('[TRACE:CONTACT] edit', { customerId, policy: { phone: policy.phone, email: policy.email, billing: policy.billing }, source: policy.source, wrote, phonesOff: phoneOff.length });
  return { ok: true, wrote };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE SHIP-TO PICKER'S TWO STATEMENTS — moved here so every list write has one home
// ══════════════════════════════════════════════════════════════════════════════════════════════
// `customerAddresses.ts` keeps the PLAN (label required, street + city/ZIP, the twin check); the
// statements live here. Outcomes are returned raw so the caller keeps its own sentences.

export async function insertShipToSite(
  db: SupabaseClient, row: Omit<CustomerAddress, 'id'>, columns: string,
): Promise<{ rows: CustomerAddress[]; error: { code?: string; message: string } | null }> {
  const { data, error } = await db.from('customer_addresses').insert(row).select(columns);
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
