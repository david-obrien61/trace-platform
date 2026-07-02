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

  // Fields written on both update and insert.
  const fields: Record<string, unknown> = {
    first_name:       customer.first_name,
    last_name:        customer.last_name ?? '', // customers.last_name is NOT NULL — empty string, never null
    customer_type:    isOrg ? 'organization' : 'person',
    phone:            customer.phone ?? null,
    address_line1:    customer.address_line1 ?? null,
    city:             customer.city ?? null,
    state:            customer.state ?? 'TX',
    zip:              customer.zip ?? null,
    marketing_opt_in: customer.marketing_opt_in ?? true,
  };
  if (personId) fields.person_id = personId;

  // 2. Dedup WITHIN the business. Prefer person_id (the fix — covers the phone-only repeat,
  //    since the person was already deduped by phone). Fall back to email only when the
  //    person layer was unavailable. A null/blank email must NOT collapse email-less customers.
  let existingId: string | null = null;
  if (personId) {
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('person_id', personId).limit(1);
    if (data && data.length > 0) existingId = data[0].id;
  } else if (customer.email) {
    const { data } = await db
      .from('customers').select('id')
      .eq('business_id', businessId).eq('email', customer.email).limit(1);
    if (data && data.length > 0) existingId = data[0].id;
  }

  if (existingId) {
    let { error: updErr } = await db.from('customers').update(fields).eq('id', existingId);
    if (updErr && isMissingCustomerTypeColumn(updErr)) {
      console.warn('[TRACE:PERSON] customer_type column absent — retrying update without it (apply 20260702_customers_customer_type.sql)');
      const noType = { ...fields }; delete noType.customer_type;
      ({ error: updErr } = await db.from('customers').update(noType).eq('id', existingId));
    }
    console.log('[TRACE:PERSON] link: customer resolved to existing row', {
      customerId: existingId, personId, businessId, source, isOrg,
    });
    return { customerId: existingId, created: false };
  }

  const insertRow = { business_id: businessId, email: customer.email ?? null, source, ...fields };
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
