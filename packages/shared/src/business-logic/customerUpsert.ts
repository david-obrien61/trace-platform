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
// Dedup-by-email within business_id is preserved (the cart path's contract). When the
// caller has no email (an OCR'd invoice may genuinely lack one — D-9), dedup is skipped
// and a new customer is inserted; we never fabricate a key to match on.
//
// `db` is any supabase client — the cart + OCR endpoints pass a service-key admin client
// (mirrors submit.ts). `source` records provenance ('qr-scan' for cart, 'ocr-invoice' for
// invoice capture), mirroring the existing column convention.

export interface CustomerInput {
  first_name: string;
  last_name?: string | null;
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

export async function findOrCreateCustomer(
  db: any,
  businessId: string,
  customer: CustomerInput,
  source: string,
): Promise<CustomerUpsertResult> {
  // Dedup only when we actually have an email to match on. A null/blank email
  // must NOT collapse onto other email-less customers, so skip the lookup entirely.
  if (customer.email) {
    const { data: existing } = await db
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('email', customer.email)
      .limit(1);

    if (existing && existing.length > 0) {
      const customerId = existing[0].id;
      await db.from('customers').update({
        first_name:       customer.first_name,
        last_name:        customer.last_name ?? '', // customers.last_name is NOT NULL — empty string, never null
        phone:            customer.phone ?? null,
        address_line1:    customer.address_line1 ?? null,
        city:             customer.city ?? null,
        state:            customer.state ?? 'TX',
        zip:              customer.zip ?? null,
        marketing_opt_in: customer.marketing_opt_in ?? true,
      }).eq('id', customerId);
      return { customerId, created: false };
    }
  }

  const { data: newCustomer, error: custErr } = await db
    .from('customers')
    .insert({
      business_id:      businessId,
      first_name:       customer.first_name,
      last_name:        customer.last_name ?? '', // customers.last_name is NOT NULL — empty string, never null
      email:            customer.email ?? null,
      phone:            customer.phone ?? null,
      address_line1:    customer.address_line1 ?? null,
      city:             customer.city ?? null,
      state:            customer.state ?? 'TX',
      zip:              customer.zip ?? null,
      marketing_opt_in: customer.marketing_opt_in ?? true,
      source,
    })
    .select('id')
    .single();

  if (custErr) throw new Error(`Customer: ${custErr.message}`);
  return { customerId: newCustomer!.id, created: true };
}
