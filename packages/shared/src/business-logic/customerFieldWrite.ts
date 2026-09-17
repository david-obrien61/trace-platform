// ============================================================
// customerFieldWrite — the customer EDITOR's two writes, with the client passed in (ledger #335)
// PURPOSE:      Save a party-editor patch / insert a new customer. The CONTACT half of the values
//               (phone, email, billing_*) goes to the contact lists through `writeContactEdit`
//               under the editor's policy — each touched field REPLACES what is shown (the old
//               value is retired, never deleted, R-133). Everything else is a plain `customers`
//               write, business-scoped. Extracted from `customerEdit.ts` so the PGlite writer
//               harness can drive the real code against the real schema (the app module imports a
//               browser-only client).
// DEPENDENCIES: a supabase client passed in · contactWriter.
// OUTPUTS:      EDITOR_CONTACT_POLICY · updateCustomerFields · insertCustomerFields
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { contactEditOf, writeContactEdit, type ContactEditPolicy } from './contactWriter';

// STD-003: ON by default until OWNER-PROVEN. Do not comment out (§7 standing instruction).
const TRACE_CUSTOMER_WRITE = true;

export const EDITOR_CONTACT_POLICY: ContactEditPolicy = { phone: 'replace', email: 'replace', billing: 'replace', source: 'manual' };

/**
 * UPDATE one customer. `zeroRows: true` means the customers UPDATE matched nothing — under RLS that
 * is what a refusal looks like (A8), and the caller says so in its own words.
 */
export async function updateCustomerFields(db: SupabaseClient, params: {
  id: string; businessId: string; patch: Record<string, unknown>;
}): Promise<{ error: string | null; zeroRows: boolean }> {
  const { id, businessId, patch } = params;
  const { edit, rest, touched } = contactEditOf(patch);
  if (Object.keys(rest).length > 0) {
    const { data, error } = await db.from('customers').update(rest)
      .eq('id', id).eq('business_id', businessId).select('id');
    if (error) return { error: error.message, zeroRows: false };
    // A8 / R-12 — inline: zero rows back is a refusal, not a save.
    if ((data ?? []).length === 0) return { error: null, zeroRows: true };
  }
  if (touched) {
    const out = await writeContactEdit(db, businessId, id, edit, EDITOR_CONTACT_POLICY);
    if (!out.ok) {
      if (TRACE_CUSTOMER_WRITE) console.log('[TRACE:customers] contact edit FAILED', { customerId: id, error: out.error });
      return { error: out.error, zeroRows: false };
    }
  }
  return { error: null, zeroRows: false };
}

/** INSERT a new customer, then its contact rows. */
export async function insertCustomerFields(db: SupabaseClient, params: {
  businessId: string; values: Record<string, unknown>;
}): Promise<{ error: string | null; id: string | null }> {
  const { businessId, values } = params;
  const { edit, rest, touched } = contactEditOf(values);
  const { data, error } = await db.from('customers')
    .insert({ business_id: businessId, ...rest }).select('id').single();
  if (error) return { error: error.message, id: null };
  const id = (data as { id: string }).id;
  if (touched) {
    const out = await writeContactEdit(db, businessId, id, edit, EDITOR_CONTACT_POLICY);
    // The customer exists; say plainly that its contact details did not save, so it can be re-edited.
    if (!out.ok) return { error: `The customer was added, but their contact details were not saved: ${out.error}`, id };
  }
  return { error: null, id };
}
