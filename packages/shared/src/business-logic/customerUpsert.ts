/**
 * ── CUSTOMER UPSERT (shared) · THUNDER Wave 2 · 2026-06-20 ──────────────────────
 *
 * PURPOSE      The ONE shared write path for find-or-create of a customer within a
 *              business. Extracted from api/orders/submit.ts (cart checkout) so it can be
 *              called WITHOUT an order — e.g. when an OCR'd invoice surfaces a customer.
 * DEPENDENCIES A supabase client passed in (service-key admin in current callers); the
 *              `customers` table (business_id, first/last_name, email, phone, address_line1,
 *              city, state, zip, marketing_opt_in, source). No DB client constructed here.
 * OUTPUTS      { customerId, created } — created:true = inserted, false = matched by email.
 * CALLERS      api/orders/submit.ts (source='qr-scan'), api/customers/create.ts ('ocr-invoice').
 */
// Customer find-or-create — the ONE shared write path for resolving a customer
// within a business. Extracted from api/orders/submit.ts (cart checkout) so it can be
// called WITHOUT an order — e.g. when an OCR'd invoice surfaces a new customer.
//
// PERSON-SPINE (2026-06-25): the dedup key is now the global PERSON, resolved at SOURCE via
// findOrCreatePerson (email → phone among auth-less people). This FIXES the email-only-dedup
// bug: a phone-only customer (null email) no longer double-inserts — the repeat matches the
// existing person by phone and resolves to the same customer row (the Marcus-Webb-dupe class).
// The customer is then deduped WITHIN the business by person_id.
//
// Graceful degradation (rule 6 — integration failure never blocks an order): if person
// resolution fails (e.g. the people table isn't applied yet, mid-migration), we fall back to
// the legacy email-only dedup with a null person_id — never worse than the prior behavior.
//
// `db` is any supabase client — the cart + OCR endpoints pass a service-key admin client
// (mirrors submit.ts). `source` records provenance ('qr-scan' for cart, 'ocr-invoice' for
// invoice capture), mirroring the existing column convention.

import { findOrCreatePerson } from './personUpsert';

export interface CustomerInput {
  first_name: string;
  last_name?: string | null;
  customer_type?: 'person' | 'organization' | null; // default 'person'; 'organization' skips the people link
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  marketing_opt_in?: boolean | null;
}

export interface CustomerUpsertResult {
  customerId: string;
  created: boolean; // true = inserted, false = matched an existing row by email
}

// Deploy-window safety: customer_type rides on the 20260702 migration. If this code is
// live before the column is applied, writing it fails (42703 / PGRST204); we strip it and
// retry so customer creation never breaks (rule 6). Remove once the migration is applied.
function isMissingCustomerTypeColumn(error: any): boolean {
  const s = `${error?.code} ${error?.message}`;
  return /42703|PGRST204/.test(s) && /customer_type/i.test(s);
}

// ORG DEDUP KEY normalization. Orgs skip the person spine (an HOA is not a person), so
// name + BILLING address is their identity. Normalize both sides so OCR variance doesn't
// split one contractor into duplicates: lowercase, strip punctuation (H.O.A. → hoa), collapse
// whitespace, trim. BILLING only — ship-to varies per job site (Dave's Tree Svs → XXX/YYY/ZZZ)
// and matching on it would re-create the very duplication this fixes.
// DEFERRED (not v1): synonym normalization (CR↔County Road, Svs↔Services) + a fuzzy
// "looks like a match?" confirm for near-misses this basic normalization can't catch.
function normalizeMatchKey(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // strip punctuation (H.O.A. → h o a; keeps word/digit boundaries)
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
}

export async function findOrCreateCustomer(
  db: any,
  businessId: string,
  customer: CustomerInput,
  source: string,
): Promise<CustomerUpsertResult> {
  // An organization is NOT a person — skip the people spine entirely (an HOA has no
  // first/last name and must never create a `people` row). Persons keep the current path.
  const isOrg = customer.customer_type === 'organization';

  // 1. Resolve the global PERSON at source (the dedup key), for PERSONS only. Graceful: a
  //    person-layer failure must never block customer creation (rule 6) — fall back to email dedup.
  let personId: string | null = null;
  if (!isOrg) {
    try {
      const person = await findOrCreatePerson(db, {
        firstName: customer.first_name,
        lastName:  customer.last_name,
        email:     customer.email,
        phone:     customer.phone,
      });
      personId = person.personId;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[TRACE:PERSON] customer person resolution failed — proceeding without person link', {
        businessId, source, error: msg,
      });
    }
  } else {
    console.log('[TRACE:PERSON] organization customer — skipping people link', { businessId, source });
  }

  // ── A9 + the machine-writer ruling (David, 2026-07-29) ──────────────────────────────────────
  // THE DEFECT THIS REPLACES: every field was coerced with `?? null`, so a counter checkout that
  // collected no address NULLED a curated one. `undefined` from the caller means "I did not ask",
  // not "there is none" — ABSENT IS NOT EMPTY (A9). And the legacy unprefixed columns were written
  // while the party editor wrote the canonical `billing_*`, so one fact had two homes and no
  // precedence rule: the invoice printed one address and the delivery route showed another.
  //
  // THREE RULES, in order:
  //   (a) NEVER NULL   — a field the caller did not supply is OMITTED from the payload entirely.
  //   (b) FILL, NEVER CLOBBER — on UPDATE a supplied value lands only where the stored one is blank.
  //       A counter checkout capturing a phone for a customer who has none SHOULD save it; that is
  //       the capture path earning its keep. Overwriting a curated value is the failure.
  //       EXCEPTION, ONE FIELD, BY NAME (2026-08-25): `email` is SUPPLIED-WINS — see SUPPLIED_WINS
  //       below. A blank email still cannot clobber, because a blank never reaches the payload.
  //   (c) CANONICAL + MIRROR — billing_* is the home; the legacy four are written alongside it,
  //       exactly as the party editor does, so the two column sets cannot diverge at the source.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const given = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

  // legacy column → its canonical billing twin (D-41). Both are written, always together.
  const CANONICAL: Record<string, string> = {
    address_line1: 'billing_line1', city: 'billing_city', state: 'billing_state', zip: 'billing_zip',
  };

  /** Only what the caller actually supplied — rule (a). Each address field carries its twin — (c). */
  const supplied: Record<string, unknown> = {};
  const offer = (col: string, v: unknown) => {
    if (!given(v)) return;                       // (a) absent ≠ empty — omit, never null
    supplied[col] = typeof v === 'string' ? v.trim() : v;
    const canon = CANONICAL[col];
    if (canon) supplied[canon] = supplied[col];  // (c) canonical + mirror, written together
  };
  offer('first_name', customer.first_name);
  offer('last_name',  customer.last_name);
  // 🔴 2026-08-25 — THE FIELD THAT WAS NEVER OFFERED. `email` was absent from this list, so it
  // never entered `supplied`, never entered `fields`, and therefore could not enter the UPDATE
  // patch below. A NEW customer got their email (the INSERT carries it as its own literal); an
  // EXISTING one never did. Measured: customer 0ee368fe (Diane Foster) — email '' after a checkout
  // that typed one and SENT the invoice to it, `updated_at` stamped the same second as the order,
  // `billing_*` filled correctly. The row was written; this one field was not in the payload.
  offer('email',      customer.email);
  offer('phone',      customer.phone);
  offer('address_line1', customer.address_line1);
  offer('city',  customer.city);
  offer('state', customer.state);
  offer('zip',   customer.zip);
  if (customer.marketing_opt_in !== undefined) supplied.marketing_opt_in = customer.marketing_opt_in;
  if (personId) supplied.person_id = personId;

  // customer_type is DERIVED from the payload shape, not supplied by the caller, so it is always known.
  const fields: Record<string, unknown> = { ...supplied, customer_type: isOrg ? 'organization' : 'person' };
  // last_name is NOT NULL in the schema; on INSERT it must be present even when blank.
  const insertDefaults: Record<string, unknown> = { last_name: '' };

  // 2. Dedup WITHIN the business.
  //    - PERSON: prefer person_id (covers the phone-only repeat, since the person was already
  //      deduped by email→phone in the spine). Fall back to email only when the spine was
  //      unavailable. A null/blank email must NOT collapse email-less customers.
  //    - ORGANIZATION: orgs skip the person spine, so name + BILLING address IS their identity.
  //      An org with no email had NO dedup key before this branch → the same contractor invoiced
  //      per job site created a new row each time (Dave's Tree Svs → 3 duplicates). Match on
  //      normalized name + billing FIRST, then email as a secondary key. Never on ship-to.
  let existingId: string | null = null;
  if (personId) {
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('person_id', personId).limit(1);
    if (data && data.length > 0) existingId = data[0].id;
  } else if (isOrg) {
    const nameKey = normalizeMatchKey(customer.first_name);       // org name lives in first_name
    const billKey = normalizeMatchKey(customer.address_line1);    // BILLING address
    if (nameKey && billKey) {
      // Business-scoped org rows only. A column-absent error (pre-20260702 deploy window) simply
      // yields no data → no match → email/create fallthrough, never a throw (rule 6).
      const { data } = await db
        .from('customers').select('id, first_name, address_line1')
        .eq('business_id', businessId).eq('customer_type', 'organization');
      const match = (data ?? []).find((r: any) =>
        normalizeMatchKey(r.first_name) === nameKey &&
        normalizeMatchKey(r.address_line1) === billKey);
      if (match) {
        existingId = match.id;
        console.log('[TRACE:PERSON] resolve: matched organization by name+billing', {
          customerId: existingId, businessId, source, nameKey, billKey,
        });
      }
    }
    // Secondary org key: an org that DID carry an email still dedups on it (prior behavior kept).
    if (!existingId && customer.email) {
      const { data } = await db
        .from('customers').select('id')
        .eq('business_id', businessId).eq('email', customer.email).limit(1);
      if (data && data.length > 0) existingId = data[0].id;
    }
  } else if (customer.email) {
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('email', customer.email).limit(1);
    if (data && data.length > 0) existingId = data[0].id;
  }

  if (existingId) {
    // (b) FILL, NEVER CLOBBER — read the stored row and keep only the fields that are blank there.
    // A customer curated on /customers is never overwritten by a later counter checkout.
    const FILLABLE = ['first_name', 'last_name', 'phone', 'address_line1', 'city', 'state', 'zip',
                      'billing_line1', 'billing_city', 'billing_state', 'billing_zip', 'marketing_opt_in'];
    // 🔴 SUPPLIED WINS — the ONE deliberate divergence from rule (b), and it is NAMED rather than
    // achieved by omission. `email` is not in FILLABLE, and under the `!FILLABLE.includes(col)`
    // fall-through it would already be written unconditionally — but that would be a behaviour
    // resting on a field's ABSENCE from a list, which the next person to extend FILLABLE would
    // silently revert. So the intent is stated here and checked FIRST.
    // WHY EMAIL AND NOT THE REST: fill-never-clobber protects a CURATED value from a hurried
    // counter capture. Email is the opposite case — the register is where a customer says "that
    // address is old, use this one", and the invoice is SENT to whatever was typed. A stored email
    // the system will not update is a customer who never receives their invoice again.
    // ⚠️ THE SAFETY THIS DEPENDS ON IS `offer()`, NOT THIS LINE: a blank/whitespace email fails
    // `given()` and never reaches `fields`, so "supplied wins" can only ever be reached by a value
    // someone actually typed. EMPTY INPUT CANNOT BLANK A STORED EMAIL — omission, not a null write.
    const SUPPLIED_WINS = ['email'];
    let stored: Record<string, unknown> = {};
    {
      const { data } = await db.from('customers').select(FILLABLE.join(',')).eq('id', existingId).maybeSingle();
      stored = (data ?? {}) as Record<string, unknown>;
    }
    const patch: Record<string, unknown> = {};
    for (const [col, v] of Object.entries(fields)) {
      if (col === 'customer_type' || col === 'person_id') { patch[col] = v; continue; } // derived/link — always current
      if (SUPPLIED_WINS.includes(col)) { patch[col] = v; continue; }                     // typed → replaces stored
      if (!FILLABLE.includes(col)) { patch[col] = v; continue; }
      if (!given(stored[col])) patch[col] = v;                                          // blank → fill
    }
    if (Object.keys(patch).length === 0) {
      console.log('[TRACE:PERSON] link: existing customer already complete — nothing to fill', { customerId: existingId, businessId, source });
      return { customerId: existingId, created: false };
    }
    const filled = Object.keys(patch).filter(k => k !== 'customer_type' && k !== 'person_id');
    if (filled.length) console.log('[TRACE:PERSON] fill: writing only fields blank on the stored row', { customerId: existingId, filled });

    // R-12 (2026-08-23) — A WRITE MUST PROVE IT WROTE, AND THE PROOF IS THE COUNT. A PostgREST
    // update matching ZERO rows returns SUCCESS WITH NO ERROR, so `!error` proves nothing. This
    // path runs under the SERVICE KEY (checkout + OCR ingest), so a zero-row result is not an RLS
    // refusal here — it means the row vanished between the dedup read and this write. Either way
    // it must not be reported as a fill that happened.
    // 🔴 ASSERTED AS `!== 1`, NOT `=== 0` — the count check is what the ruling asks for, and a
    // check that only refuses zero would report success over an update that hit more rows than the
    // single row it named. `.eq('id')` on a primary key should make that impossible; a guard that
    // is only correct while a neighbouring assumption holds is the assumption, not the guard.
    let { data: updRows, error: updErr } = await db.from('customers').update(patch).eq('id', existingId).select('id');
    if (updErr && isMissingCustomerTypeColumn(updErr)) {
      console.warn('[TRACE:PERSON] customer_type column absent — retrying update without it (apply 20260702_customers_customer_type.sql)');
      const noType = { ...patch }; delete noType.customer_type;
      ({ data: updRows, error: updErr } = await db.from('customers').update(noType).eq('id', existingId).select('id'));
      if (!updErr && updRows?.length !== 1) throw new Error(`Customer: the fill did not affect exactly one row (${existingId}, matched ${updRows?.length ?? 0}).`);
    }
    if (!updErr && updRows?.length !== 1) {
      throw new Error(`Customer: the fill did not affect exactly one row (${existingId}, matched ${updRows?.length ?? 0}).`);
    }
    console.log('[TRACE:PERSON] link: customer resolved to existing row', {
      customerId: existingId, personId, businessId, source, isOrg,
    });
    return { customerId: existingId, created: false };
  }

  const insertRow = { business_id: businessId, email: customer.email ?? null, source, ...insertDefaults, ...fields };
  let { data: newCustomer, error: custErr } = await db
    .from('customers').insert(insertRow).select('id').single();
  if (custErr && isMissingCustomerTypeColumn(custErr)) {
    console.warn('[TRACE:PERSON] customer_type column absent — retrying insert without it (apply 20260702_customers_customer_type.sql)');
    const noType = { ...insertRow }; delete (noType as { customer_type?: unknown }).customer_type;
    ({ data: newCustomer, error: custErr } = await db.from('customers').insert(noType).select('id').single());
  }

  if (custErr) throw new Error(`Customer: ${custErr.message}`);
  console.log('[TRACE:PERSON] link: new customer created', {
    customerId: newCustomer!.id, personId, businessId, source, isOrg,
  });
  return { customerId: newCustomer!.id, created: true };
}
