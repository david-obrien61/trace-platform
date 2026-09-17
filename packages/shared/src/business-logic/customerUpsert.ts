/**
 * ── CUSTOMER UPSERT (shared) · THUNDER Wave 2 · 2026-06-20 ──────────────────────
 *
 * PURPOSE      The ONE shared write path for find-or-create of a customer within a
 *              business. Extracted from api/orders/submit.ts (cart checkout) so it can be
 *              called WITHOUT an order — e.g. when an OCR'd invoice surfaces a customer.
 * DEPENDENCIES A supabase client passed in (service-key admin in current callers); the
 *              `customers` table (business_id, first/last_name, marketing_opt_in, source, …) and,
 *              for phone / email / billing address, `contactWriter.writeContactEdit` — those
 *              three are list rows now (ledger #335). No DB client constructed here.
 * OUTPUTS      { customerId, created, contact } — created:true = inserted, false = matched. `contact`
 *              is what became of each typed phone / email / address (kept as main · additional ·
 *              already on file · NOT SAVED + reason) — the screen shows it (ledger #345).
 *              `saveTypedContact` — the same contact rules for a customer the operator PICKED.
 * CALLERS      api/orders/submit.ts (source='qr-scan'), api/customers/create.ts ('ocr-invoice'),
 *              quickbooks/deliveryIngestWriter.ts. Every capture path: writer-registry.json.
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
import { writeContactEdit, type ContactEdit, type ContactEditPolicy, type ContactValueResult } from './contactWriter';

export interface CustomerInput {
  first_name: string;
  last_name?: string | null;
  customer_type?: 'person' | 'organization' | null; // default 'person'; 'organization' skips the people link
  email?: string | null;
  phone?: string | null;
  billing_line1?: string | null;
  billing_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  marketing_opt_in?: boolean | null;
  /**
   * The id QuickBooks itself assigned to this customer. ADDED 2026-08-31 for the ShipDate
   * delivery ingest. It is the ONLY dedup key here that is not an inference — QuickBooks
   * guarantees it, so a match on it cannot be the #53 cross-billing scar. It is therefore
   * tried FIRST, ahead of the person spine.
   */
  qb_customer_id?: string | null;
}

export interface CustomerUpsertResult {
  customerId: string;
  created: boolean; // true = inserted, false = matched an existing row by email
  /** What became of each typed contact value. Never thrown: a contact problem does not block the sale. */
  contact: ContactValueResult[];
}

/**
 * The contact rules for a TYPED capture (checkout, OCR, delivery ingest): a different phone is
 * KEPT as an additional number, a typed email becomes the one invoices go to (the old one stays on
 * file), a different billing address is kept as an additional one. One home for the policy, so the
 * new-customer path and the picked-customer path cannot drift apart.
 */
export function typedContactPolicy(source: string, actorUserId?: string | null): ContactEditPolicy {
  return { phone: 'add', email: 'primary', billing: 'fill', source, actorUserId: actorUserId ?? null };
}

/** The contact half of a `CustomerInput`, blanks omitted (absent is not empty — A9). */
export function contactEditFromInput(customer: Pick<CustomerInput, 'phone' | 'email' | 'billing_line1' | 'billing_line2' | 'billing_city' | 'billing_state' | 'billing_zip'>): ContactEdit {
  const given = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
  const edit: ContactEdit = {};
  if (given(customer.phone)) edit.phone = String(customer.phone).trim();
  if (given(customer.email)) edit.email = String(customer.email).trim();
  const billing: NonNullable<ContactEdit['billing']> = {};
  if (given(customer.billing_line1)) billing.line1 = String(customer.billing_line1).trim();
  if (given(customer.billing_line2)) billing.line2 = String(customer.billing_line2).trim();
  if (given(customer.billing_city))  billing.city  = String(customer.billing_city).trim();
  if (given(customer.billing_state)) billing.state = String(customer.billing_state).trim();
  if (given(customer.billing_zip))   billing.zip   = String(customer.billing_zip).trim();
  if (Object.keys(billing).length > 0) edit.billing = billing;
  return edit;
}

/**
 * 🔴 CLV-20260917-1769 (ledger #345). A customer PICKED at checkout used to keep exactly what was on
 * file: the order carried their id, `submit.ts` used the row as it was, and a phone typed over the
 * pre-filled one was written nowhere. This saves what was typed under the same rules as a new
 * customer. It never throws — the outcome travels back to the screen.
 */
export async function saveTypedContact(
  db: any, businessId: string, customerId: string, customer: CustomerInput, source: string, actorUserId?: string | null,
): Promise<ContactValueResult[]> {
  const out = await writeContactEdit(db, businessId, customerId, contactEditFromInput(customer), typedContactPolicy(source, actorUserId));
  if (!out.ok) console.log('[TRACE:PERSON] contact details NOT saved for the customer — reported, sale not blocked', { customerId, businessId, source, error: out.error });
  return out.results;
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

/**
 * 🔴 THE CALLER-RESOLVED ESCAPE HATCH, ADDED 2026-08-31 AND DELIBERATELY NARROW.
 *
 * The ShipDate delivery ingest resolves its customer against a key this function does not
 * know about (a UNIQUE name hit among the tenant's own rows, checked for collisions first —
 * `shipmentIngest.resolveIngestCustomer`). Without this, the ingest would have to write the
 * customer itself, and `customers` would gain a SECOND write path — the exact thing the
 * 2026-07-29 ruling fails the build over, and the thing that lets fill-never-clobber,
 * the count-checked update and the person link drift apart in a copy.
 *
 * So the caller supplies the ANSWER and this file still does all the WRITING. When
 * `resolvedCustomerId` is set the dedup search is skipped and that row is filled; everything
 * downstream — FILLABLE, SUPPLIED_WINS, the `!== 1` count assertion — is unchanged.
 * ⚠️ It is the caller's job to have proven the id belongs to `businessId`; the ingest reads
 * its candidate set business-scoped, which is where that proof comes from.
 */
export interface UpsertOptions {
  resolvedCustomerId?: string | null;
  /** Who is capturing, for the contact change log. Null/absent = a system write. */
  actorUserId?: string | null;
}

export async function findOrCreateCustomer(
  db: any,
  businessId: string,
  customer: CustomerInput,
  source: string,
  options: UpsertOptions = {},
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
  //   ✏️ (c) IS RETIRED (ledger #335). It read: *"CANONICAL + MIRROR — billing_* is the home; the
  //       legacy four are written alongside it … so the two column sets cannot diverge at the
  //       source."* There is now ONE column set. `billing_*` is derived from `customer_addresses`
  //       by a database trigger, so it cannot diverge from anything, by construction rather than
  //       by every writer remembering to write both.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const given = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

  // ✏️ THE `CANONICAL` MAP IS GONE (ledger #335), AND IT IS THE REASON THIS BUILD USED A TRIGGER.
  // It mapped each legacy column to its `billing_*` twin so both could be written together — an
  // application-level mirror, and it was the SECOND hand-maintained copy of that mapping: the
  // first was `CUSTOMER_BILLING_MIRROR` in `customerFieldRegistry.ts`, pointing the other way.
  // Two copies of one fact (STD-011), across four independent writers. The legacy columns are
  // dropped and `billing_*` is derived from the address list by a database trigger, so there is
  // one author and nothing to keep in step.

  /** Only what the caller actually supplied — rule (a). */
  const supplied: Record<string, unknown> = {};
  const offer = (col: string, v: unknown) => {
    if (!given(v)) return;                       // (a) absent ≠ empty — omit, never null
    supplied[col] = typeof v === 'string' ? v.trim() : v;
  };
  offer('first_name', customer.first_name);
  offer('last_name',  customer.last_name);
  // 🔴 2026-08-25 — THE FIELD THAT WAS NEVER OFFERED. `email` was absent from this list, so it
  // never entered `supplied`, never entered `fields`, and therefore could not enter the UPDATE
  // patch below. A NEW customer got their email (the INSERT carries it as its own literal); an
  // EXISTING one never did. Measured: customer 0ee368fe (Diane Foster) — email '' after a checkout
  // that typed one and SENT the invoice to it, `updated_at` stamped the same second as the order,
  // `billing_*` filled correctly. The row was written; this one field was not in the payload.
  // 🔴 LEDGER #335 — THE CONTACT FIELDS NO LONGER GO ON THE CUSTOMER ROW. `customers.phone`,
  // `email` and `billing_*` are DERIVED from the contact lists, and the database refuses a direct
  // write. They are gathered into `contactEdit` and written through `writeContactEdit` once the
  // customer id is known — with THIS file's two rules carried over as POLICIES:
  //   · phone and billing: FILL, NEVER CLOBBER → 'add' / 'fill'. A different phone from a counter
  //     checkout is now KEPT as a second number rather than dropped; the one on file stays primary.
  //   · email: SUPPLIED WINS → 'primary'. The typed address becomes the one invoices go to; the
  //     old one stays on file, demoted, instead of being overwritten.
  // A blank still never reaches the edit — `given()` is the same gate as before.
  // ✏️ #345: the gathering and the policy moved to `contactEditFromInput` / `typedContactPolicy`
  // (above), shared with the picked-customer path. A failed contact write no longer THROWS — it
  // used to, which turned a refused phone into a failed sale. It is reported instead.
  const writeContacts = (customerId: string) =>
    saveTypedContact(db, businessId, customerId, customer, source, options.actorUserId);
  offer('qb_customer_id', customer.qb_customer_id);
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
  let existingId: string | null = options.resolvedCustomerId ?? null;
  if (existingId) {
    console.log('[TRACE:PERSON] resolve: caller supplied the customer id — dedup skipped', {
      customerId: existingId, businessId, source,
    });
  } else if (customer.qb_customer_id) {
    // 🔴 FIRST, AND AHEAD OF THE PERSON SPINE. QuickBooks guarantees this id; the spine's keys
    // (email, then phone) are ones an external system permits to collide, and matching on a
    // collidable field is precisely what cross-billed nine real invoices to the wrong Andrew.
    // A single hit LINKS. More than one hit is a real ambiguity and must NOT resolve here —
    // it falls through to the spine rather than picking a row, and the ingest's own
    // `resolveIngestCustomer` refuses it before this function is ever reached.
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('qb_customer_id', customer.qb_customer_id).limit(2);
    if (data && data.length === 1) {
      existingId = data[0].id;
      console.log('[TRACE:PERSON] resolve: matched on qb_customer_id', {
        customerId: existingId, businessId, source, qbCustomerId: customer.qb_customer_id,
      });
    }
  }
  // Each remaining key is guarded on `!existingId` rather than nested under one `if`, so a
  // resolution above simply makes every branch false — the chain below is untouched from the
  // day it was written, which is what makes this addition reviewable as an addition.
  if (!existingId && personId) {
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('person_id', personId).limit(1);
    if (data && data.length > 0) existingId = data[0].id;
  } else if (!existingId && isOrg) {
    const nameKey = normalizeMatchKey(customer.first_name);       // org name lives in first_name
    const billKey = normalizeMatchKey(customer.billing_line1);    // BILLING address
    if (nameKey && billKey) {
      // Business-scoped org rows only. A column-absent error (pre-20260702 deploy window) simply
      // yields no data → no match → email/create fallthrough, never a throw (rule 6).
      const { data } = await db
        .from('customers').select('id, first_name, billing_line1')
        .eq('business_id', businessId).eq('customer_type', 'organization');
      const match = (data ?? []).find((r: any) =>
        normalizeMatchKey(r.first_name) === nameKey &&
        normalizeMatchKey(r.billing_line1) === billKey);
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
  } else if (!existingId && customer.email) {
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('email', customer.email).limit(1);
    if (data && data.length > 0) existingId = data[0].id;
  }

  if (existingId) {
    // (b) FILL, NEVER CLOBBER — read the stored row and keep only the fields that are blank there.
    // A customer curated on /customers is never overwritten by a later counter checkout.
    const FILLABLE = ['first_name', 'last_name', 'marketing_opt_in',
                      // FILL, NEVER CLOBBER applies to the QuickBooks link too: a customer already
                      // bound to a QBO id keeps that binding. Re-pointing an existing customer at a
                      // different QuickBooks record is how invoices start reaching the wrong person.
                      'qb_customer_id'];
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
    // ✏️ #335: email's supplied-wins now lives in the contact edit's 'primary' policy (above). The
    // list stays, empty, so the rule has a named home if a customer column ever needs it again.
    const SUPPLIED_WINS: string[] = [];
    let stored: Record<string, unknown> = {};
    {
      const { data } = await db.from('customers').select(FILLABLE.join(',')).eq('id', existingId).maybeSingle();
      stored = (data ?? {}) as Record<string, unknown>;
    }
    const patch: Record<string, unknown> = {};
    for (const [col, v] of Object.entries(fields)) {
      if (col === 'person_id') { patch[col] = v; continue; }                             // link — always current
      // ✏️ #345: an EXISTING row keeps its type unless the caller named one. The checkout form
      // always derived 'person', so a matched organization was silently re-typed as a person.
      if (col === 'customer_type') { if (customer.customer_type) patch[col] = v; continue; }
      if (SUPPLIED_WINS.includes(col)) { patch[col] = v; continue; }                     // typed → replaces stored
      if (!FILLABLE.includes(col)) { patch[col] = v; continue; }
      if (!given(stored[col])) patch[col] = v;                                          // blank → fill
    }
    if (Object.keys(patch).length === 0) {
      console.log('[TRACE:PERSON] link: existing customer already complete — nothing to fill', { customerId: existingId, businessId, source });
      return { customerId: existingId, created: false, contact: await writeContacts(existingId) };
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
    const contact = await writeContacts(existingId);
    console.log('[TRACE:PERSON] link: customer resolved to existing row', {
      customerId: existingId, personId, businessId, source, isOrg,
    });
    return { customerId: existingId, created: false, contact };
  }

  // #335: no `email` here any more — the contact lists hold it, written just below.
  const insertRow = { business_id: businessId, source, ...insertDefaults, ...fields };
  let { data: newCustomer, error: custErr } = await db
    .from('customers').insert(insertRow).select('id').single();
  if (custErr && isMissingCustomerTypeColumn(custErr)) {
    console.warn('[TRACE:PERSON] customer_type column absent — retrying insert without it (apply 20260702_customers_customer_type.sql)');
    const noType = { ...insertRow }; delete (noType as { customer_type?: unknown }).customer_type;
    ({ data: newCustomer, error: custErr } = await db.from('customers').insert(noType).select('id').single());
  }

  if (custErr) throw new Error(`Customer: ${custErr.message}`);
  const contact = await writeContacts(newCustomer!.id);
  console.log('[TRACE:PERSON] link: new customer created', {
    customerId: newCustomer!.id, personId, businessId, source, isOrg,
  });
  return { customerId: newCustomer!.id, created: true, contact };
}
