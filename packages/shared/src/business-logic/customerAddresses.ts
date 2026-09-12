// ============================================================
// customerAddresses — THE SHIP-TO ADDRESS BOOK. ONE MODULE, ONE WRITE PATH.
//
// PURPOSE:      D-41's L2 hook (David, 2026-07-16), taken up in ledger #303. A customer may hold
//               several LABELLED delivery sites; the order-time picker offers them so a repeat
//               ship-to is CHOSEN rather than re-typed.
//
//               🔴 WHY IT EXISTS IS DATA QUALITY, NOT CONVENIENCE. A typed-per-order address
//               drifts; a picked-from-a-list address cannot. AGAVE LD LLC carries four spellings
//               of one yard across 18 invoices — two of them a phone number in Line1. The book is
//               the STRUCTURAL fix for that; a clean-up pass is a fix that decays.
//
//               🔴 THE INVARIANT THIS MODULE MUST NEVER BREAK, AND THE REASON IT NAMES ONE TABLE:
//               THE ORDER STILL SNAPSHOTS THE CHOSEN ADDRESS ONTO THE DELIVERY ROW. A book row is
//               a SOURCE for the picker, never the record of where a load went. So editing "Job
//               site A" tomorrow cannot change where last month's invoice says the trees went —
//               and the mechanism is that THIS FILE NEVER WRITES `deliveries` AND NEVER WRITES
//               `customers`. `customerAddresses.test.ts` §E asserts that against a recording
//               client rather than trusting the reading of it.
//
//               ⚠️ AND NOTHING HERE BACKFILLS. The QuickBooks importer does not read
//               `BillAddr.Line2` (tech-debt #254), so history holds 451 routable addresses sitting
//               in the record as phone numbers. Seeding the book from those strings would promote
//               four typos to four curated sites and make the drift PERMANENT. This module reads
//               `customers` and `deliveries` for nothing at all; §F proves no migration seeds it.
//
// DEPENDENCIES: a supabase client passed in (never constructed here). Pure otherwise.
// OUTPUTS:      CustomerAddress · SiteAddress · SITE_ADDRESS_FIELDS · CUSTOMER_ADDRESS_COLUMNS ·
//               addressOf · siteLine · normalizeAddressPart · sameAddress · findSameAddress ·
//               sortSites · planSaveSite · readCustomerAddresses · saveCustomerAddress ·
//               retireCustomerAddress
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
// The field list is IMPORTED, never restated here — see `customerAddressFields.ts` for why that
// distinction is load-bearing rather than stylistic (A4 · #179 · verify-field-lists).
import { CUSTOMER_ADDRESS_COLUMNS } from './customerAddressFields';

export { CUSTOMER_ADDRESS_COLUMNS };

const TRACE_SITES = true; // [TRACE:SITES] STD-003 — ON until David owner-proves

/**
 * The four parts a DELIVERY ROW can hold, and therefore the four the picker may fill.
 *
 * 🔴 `line2` IS DELIBERATELY NOT HERE. The column exists on `customer_addresses` for tech-debt
 * #254 (the importer will need somewhere to put 453 real Line2 streets), but `deliveries` has no
 * `address_line2`, so a line2 typed into the book could not be snapshotted onto a stop — it would
 * disappear silently between the picker and the truck. No surface offers the field, so nothing can
 * type one. Tech-debt #278 carries the residual.
 */
export const SITE_ADDRESS_FIELDS = ['line1', 'city', 'state', 'zip'] as const;
export type SiteAddressField = typeof SITE_ADDRESS_FIELDS[number];
export type SiteAddress = Record<SiteAddressField, string | null>;

/**
 * THE SHIP-TO CHOSEN FOR ONE ORDER — what the picker produces and what checkout sends.
 *
 * 🔴 IT CARRIES THE ADDRESS, NOT A `customer_addresses.id`. That is the invariant in the type
 * itself: the delivery row keeps its own snapshot, so what travels to the server is TEXT. A
 * pointer would let a later edit of "Job site A" silently rewrite where a past order went, which
 * is precisely what D-41 forbids. `siteId` rides along as PROVENANCE only — it records which saved
 * site was picked, and nothing resolves it at read time.
 */
export type ShipToInput = {
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Where the text came from — for [TRACE:SITES] and for the picker's own state. */
  source: 'billing' | 'saved_site' | 'typed';
  /** Provenance only. NEVER resolved at read time. */
  siteId?: string | null;
};

export type CustomerAddress = {
  id: string;
  business_id: string;
  customer_id: string;
  label: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  is_default: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};


const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
};

/** The four parts of a site, as a delivery row would hold them. */
export function addressOf(s: Partial<CustomerAddress>): SiteAddress {
  return { line1: clean(s.line1), city: clean(s.city), state: clean(s.state), zip: clean(s.zip) };
}

/** The address as one line — what the picker shows and what the card reads. */
export function siteLine(s: Partial<CustomerAddress>): string {
  return SITE_ADDRESS_FIELDS.map(f => clean(s[f])).filter((v): v is string => v !== null).join(', ');
}

/**
 * Compare two written forms of the same place.
 *
 * ⚠️ THIS IS A COMPARISON RULE, NEVER A REWRITE. Nothing stored is normalised — what a person
 * typed is what is saved (R-71: normalisation is suggest-they-choose, never a vocabulary applied
 * behind their back). This function exists ONLY to answer "have you already saved this one?", so
 * the book does not accumulate `501 County Road 107` beside `501 county road 107`.
 *
 * It is deliberately CONSERVATIVE — case, surrounding and repeated whitespace, and trailing
 * punctuation. It does NOT expand `Rd`→`Road` or `107`→`107`: an over-eager match would silently
 * refuse to save a genuinely different site, which is a worse failure than one duplicate row.
 */
export function normalizeAddressPart(v: string | null): string {
  if (!v) return '';
  return v.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function sameAddress(a: Partial<CustomerAddress>, b: Partial<CustomerAddress>): boolean {
  const x = addressOf(a), y = addressOf(b);
  return SITE_ADDRESS_FIELDS.every(f => normalizeAddressPart(x[f]) === normalizeAddressPart(y[f]));
}

/** The first ACTIVE site already holding this address, if any. Retired sites do not block a save. */
export function findSameAddress(sites: CustomerAddress[], candidate: Partial<CustomerAddress>): CustomerAddress | null {
  return sites.find(s => s.active && sameAddress(s, candidate)) ?? null;
}

/** Default first, then by label — a stable order so the picker does not reshuffle between reads. */
export function sortSites(sites: CustomerAddress[]): CustomerAddress[] {
  return [...sites].sort((a, b) =>
    (a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1) ||
    a.label.localeCompare(b.label));
}

// ── THE SAVE PLAN ───────────────────────────────────────────────────────────────────────────

export type SavePlan =
  | { kind: 'refused'; reason: string }
  | { kind: 'already_saved'; site: CustomerAddress }
  | { kind: 'insert'; row: Omit<CustomerAddress, 'id'> };

/**
 * What saving this address as a site WOULD do. A VALUE, so every refusal is asserted rather than
 * rendered — the shape `planShipToEdit` established in `stopWrites.ts` (ledger #301).
 *
 * 🔴 THE LABEL IS REQUIRED AND IT IS NOT DECORATION — IT IS THE ANTI-CHORE RULE IN SCHEMA FORM.
 * David: *"DO NOT auto-save every typed address. A one-off delivery to a customer's mother is not
 * a site, and a book full of one-offs is worse than no book."* Requiring a name a person chose is
 * what makes saving an ACT rather than a side effect: nothing can call this without someone having
 * decided the place is worth naming.
 */
export function planSaveSite(x: {
  businessId: string;
  customerId: string;
  label: string;
  address: Partial<CustomerAddress>;
  existing: CustomerAddress[];
  isDefault?: boolean;
  notes?: string | null;
}): SavePlan {
  const label = clean(x.label);
  if (!label) return { kind: 'refused', reason: 'Give this place a name so it can be picked later — "Job site A", "The yard".' };

  const address = addressOf(x.address);
  // §1.6 item 3 — validated before write, in words. The same two refusals the stop's ship-to edit
  // makes, for the same reason: a street with neither a city nor a ZIP is what made two of LAWNS's
  // live routes unbuildable on 2026-09-09 (tech-debt #226/#227). Google could not place them.
  if (!address.line1) return { kind: 'refused', reason: 'A saved site needs a street.' };
  if (!address.city && !address.zip) return { kind: 'refused', reason: 'Add a city or a ZIP code — without one the map cannot find this address.' };

  // Already on file. NOT an error: the answer to "save this?" for an address already saved is
  // "it already is", and saying so beats both a duplicate row and a red refusal.
  const twin = findSameAddress(x.existing, address);
  if (twin) return { kind: 'already_saved', site: twin };

  // The label is the one thing the database will refuse (customer_addresses_one_label). Catch it
  // HERE, in words, rather than letting a unique-violation reach a person as a Postgres string.
  const labelTaken = x.existing.some(s => s.active && s.label.trim().toLowerCase() === label.toLowerCase());
  if (labelTaken) return { kind: 'refused', reason: `This customer already has a site called "${label}". Pick another name.` };

  return {
    kind: 'insert',
    row: {
      business_id: x.businessId,
      customer_id: x.customerId,
      label,
      line1: address.line1,
      // See SITE_ADDRESS_FIELDS: `line2` is a column no surface fills. Written as null, always,
      // so a future reader does not mistake an absent value for one this path could have set.
      line2: null,
      city: address.city,
      state: address.state,
      zip: address.zip,
      notes: clean(x.notes ?? null),
      // A customer's FIRST saved site is their default — there is nothing for it to compete with,
      // and a book whose only entry is not the default reads as broken. After that, explicit only.
      is_default: x.isDefault ?? x.existing.filter(s => s.active).length === 0,
      active: true,
    },
  };
}

// ── IO — THE ONE WRITE PATH TO `customer_addresses` ─────────────────────────────────────────

export type SaveOutcome =
  | { kind: 'refused'; reason: string }
  | { kind: 'already_saved'; site: CustomerAddress }
  | { kind: 'failed'; error: string }
  | { kind: 'saved'; site: CustomerAddress };

/**
 * Every ACTIVE site for one customer, ordered for the picker.
 *
 * A read the caller may not be permitted to make returns an EMPTY BOOK, not an error, and says so
 * in the outcome — a person without `customers:read` should see a picker with no saved sites and
 * free entry still working, never a broken screen (A9: absent is not empty, and a missing
 * convenience must not delete the act).
 */
export async function readCustomerAddresses(
  db: SupabaseClient, businessId: string, customerId: string,
): Promise<{ ok: true; sites: CustomerAddress[] } | { ok: false; error: string }> {
  const { data, error } = await db
    .from('customer_addresses')
    .select(CUSTOMER_ADDRESS_COLUMNS)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('active', true);

  if (error) {
    if (TRACE_SITES) console.log('[TRACE:SITES] read FAILED', { customerId, code: (error as { code?: string }).code ?? null, message: error.message });
    return { ok: false, error: error.message };
  }
  const sites = sortSites((data ?? []) as unknown as CustomerAddress[]);
  if (TRACE_SITES) console.log('[TRACE:SITES] read', { customerId, sites: sites.length, labels: sites.map(s => s.label) });
  return { ok: true, sites };
}

/**
 * Save one address as a named site.
 *
 * R-12 / A8: a PostgREST insert RLS refused returns NO ERROR and zero rows, so success is the
 * COUNT — exactly one row back — and anything else is a failure in words. The refusal a person
 * most likely meets here is REAL and worth naming: `customers:create` is in MANAGER's bundle and
 * NOT in STAFF's, so Joel can see the book and cannot add to it.
 */
export async function saveCustomerAddress(db: SupabaseClient, x: {
  businessId: string;
  customerId: string;
  label: string;
  address: Partial<CustomerAddress>;
  existing: CustomerAddress[];
  isDefault?: boolean;
  notes?: string | null;
}): Promise<SaveOutcome> {
  const plan = planSaveSite(x);
  if (plan.kind !== 'insert') return plan;

  const { data, error } = await db
    .from('customer_addresses').insert(plan.row).select(CUSTOMER_ADDRESS_COLUMNS);

  if (error) {
    if (TRACE_SITES) console.log('[TRACE:SITES] save FAILED', { customerId: x.customerId, label: plan.row.label, message: error.message });
    // 23505 = unique_violation. Only reachable in a race the plan could not see (two people saving
    // the same label at once), so it is reported as the human fact rather than the Postgres one.
    if ((error as { code?: string }).code === '23505')
      return { kind: 'refused', reason: `This customer already has a site called "${plan.row.label}". Pick another name.` };
    return { kind: 'failed', error: error.message };
  }
  const rows = (data ?? []) as unknown as CustomerAddress[];
  if (rows.length !== 1) {
    if (TRACE_SITES) console.log('[TRACE:SITES] save landed on', rows.length, 'rows, not 1', { customerId: x.customerId });
    return { kind: 'failed', error: 'That site was not saved — you may not have permission to add addresses for this customer.' };
  }
  if (TRACE_SITES) console.log('[TRACE:SITES] saved', { id: rows[0].id, label: rows[0].label, isDefault: rows[0].is_default });
  return { kind: 'saved', site: rows[0] };
}

/**
 * Retire a site. R-133: *"you can't delete, you can just mark deleted."*
 *
 * The row stays readable forever — an address on a past delivery must remain resolvable — and it
 * leaves the picker. Note the write is an UPDATE, which is why the table needs no DELETE policy at
 * all: there is no path that removes a row, so the absent policy is fail-closed by design.
 */
export async function retireCustomerAddress(
  db: SupabaseClient, businessId: string, siteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await db
    .from('customer_addresses')
    .update({ active: false, is_default: false })
    .eq('id', siteId).eq('business_id', businessId).select('id');

  if (error) {
    if (TRACE_SITES) console.log('[TRACE:SITES] retire FAILED', { siteId, message: error.message });
    return { ok: false, error: error.message };
  }
  if ((data ?? []).length !== 1) {
    if (TRACE_SITES) console.log('[TRACE:SITES] retire landed on', (data ?? []).length, 'rows, not 1', { siteId });
    return { ok: false, error: 'That site was not retired — you may not have permission, or it was already removed.' };
  }
  // `is_default` is cleared alongside `active` deliberately: the one-default partial unique index
  // is scoped `WHERE is_default AND active`, so a retired row holding is_default would not collide,
  // but restoring it later would suddenly mint a second default. Clear it at the retirement.
  if (TRACE_SITES) console.log('[TRACE:SITES] retired', { siteId });
  return { ok: true };
}
