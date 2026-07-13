// ============================================================
// customerEdit — the ONE customer field-edit coercion + write helper (Cultivar OS)
// PURPOSE:      The identical per-field edit rules shared by the /customers roster (inline
//               datasheet cells), the CustomerEditModal (in-context edit from a delivery card),
//               AND the CustomerPartyEditor (the full grouped party-record editor). Extracted so
//               the surfaces can never drift: first_name is the identity (never blank), first/last
//               are NOT NULL (blank → '' not null), every other field is nullable (blank → null),
//               unchanged → skip, and the write is an owner-only RLS UPDATE scoped
//               .eq('id').eq('business_id').
// DEPENDENCIES: supabase (customers rows, business_id-scoped). NO business context here — the
//               caller passes the resolved businessId. NO migration, NO new dep, NO endpoint.
// OUTPUTS:      coerceCustomerField → the value to persist (or skip). persistCustomerField → a
//               single-field RLS UPDATE. persistCustomerPatch → a multi/typed-field RLS UPDATE
//               (numbers/dates/bools/selects + the atomic exemption trio). `[TRACE:customers] edit`
//               emitted verbatim (STD-003, ON by default — standing owner instruction, do NOT
//               comment out), with tax_id / credit_limit VALUE-MASKED (BENCH-C).
// ============================================================
import { supabase } from '../../lib/supabase';

export type CustomerTextField =
  | 'first_name' | 'last_name' | 'phone' | 'email'
  | 'address_line1' | 'city' | 'state' | 'zip'
  // Party-record (2026-07-13) text fields — all nullable (blank → null via coerceCustomerField).
  | 'organization_name' | 'display_name'
  | 'billing_line1' | 'billing_line2' | 'billing_city' | 'billing_state' | 'billing_zip'
  | 'tax_id' | 'payment_terms' | 'notes';

// first_name / last_name are NOT NULL (last_name defaults to ''); these must never be written
// null. Everything else is nullable → blank clears to null.
const NOT_NULL_FIELDS: CustomerTextField[] = ['first_name', 'last_name'];

// BENCH-C (PII) — value-MASKED in the [TRACE:customers] diagnostic: an EIN / resale number and a
// credit figure are PII and must never appear in plaintext logs. For these fields we log the field
// name + "changed", never the from/to value. ONE source both write helpers read (STD-011).
const SENSITIVE_CUSTOMER_FIELDS = new Set<string>(['tax_id', 'credit_limit']);

/** Log a field write with BENCH-C value-masking for the sensitive set. */
function traceEdit(customerId: string, field: string, from: unknown, to: unknown) {
  if (SENSITIVE_CUSTOMER_FIELDS.has(field)) {
    console.log('[TRACE:customers] edit', { customerId, field, change: 'changed' }); // value masked (BENCH-C)
  } else {
    console.log('[TRACE:customers] edit', { customerId, field, from, to });
  }
}

type CoerceResult =
  | { skip: true }
  | { skip: false; value: string | null };

/**
 * Coerce a raw text edit into the value to persist, applying the rules the roster and the
 * modal MUST share identically:
 *  - first_name is the identity → never blank (skip)
 *  - NOT NULL fields (first/last) → '' when cleared, never null
 *  - nullable fields → null when cleared
 *  - value unchanged from current → skip (no write)
 */
export function coerceCustomerField(
  current: Record<string, unknown>,
  field: CustomerTextField,
  raw: string | null,
): CoerceResult {
  const trimmed = (raw ?? '').trim();
  if (field === 'first_name' && trimmed === '') return { skip: true }; // identity — never blank
  const notNull = (NOT_NULL_FIELDS as string[]).includes(field);
  const value = trimmed === '' ? (notNull ? '' : null) : trimmed;
  if (value === current[field]) return { skip: true };
  return { skip: false, value };
}

/**
 * Persist ONE coerced customer field via an owner-only RLS UPDATE, scoped to the row id AND
 * the business. Emits the shared `[TRACE:customers] edit` trace verbatim.
 */
export async function persistCustomerField(params: {
  id: string;
  businessId: string;
  field: CustomerTextField;
  from: unknown;
  value: string | null;
}): Promise<{ error: string | null }> {
  const { id, businessId, field, from, value } = params;
  traceEdit(id, field, from, value);
  const { error } = await supabase
    .from('customers')
    .update({ [field]: value })
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) { console.error('[TRACE:customers] edit error', field, error.message); return { error: error.message }; }
  return { error: null };
}

/**
 * Persist a PATCH of typed customer fields (numbers, dates, booleans, select values, or the atomic
 * tax-exemption trio) via ONE owner-only RLS UPDATE scoped .eq('id').eq('business_id'). The caller
 * has already coerced each value (e.g. numeric | null, ISO date | null, bool). Emits the shared
 * `[TRACE:customers] edit` per key, value-masked for the sensitive set (BENCH-C). Used by the
 * CustomerPartyEditor for the fields that are not plain nullable text.
 */
export async function persistCustomerPatch(params: {
  id: string;
  businessId: string;
  patch: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const { id, businessId, patch } = params;
  for (const [field, to] of Object.entries(patch)) traceEdit(id, field, undefined, to);
  const { error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) { console.error('[TRACE:customers] patch error', Object.keys(patch).join(','), error.message); return { error: error.message }; }
  return { error: null };
}
