// ============================================================
// customerEdit — the ONE customer field-edit coercion + write helper (Cultivar OS)
// PURPOSE:      The identical per-field edit rules shared by BOTH the /customers roster
//               (inline datasheet cells) and the CustomerEditModal (in-context edit from a
//               delivery card). Extracted so the two surfaces can never drift: first_name is
//               the identity (never blank), first/last are NOT NULL (blank → '' not null),
//               every other field is nullable (blank → null), unchanged → skip, and the write
//               is an owner-only RLS UPDATE scoped .eq('id').eq('business_id').
// DEPENDENCIES: supabase (customers rows, business_id-scoped). NO business context here — the
//               caller passes the resolved businessId. NO migration, NO new dep, NO endpoint.
// OUTPUTS:      coerceCustomerField → the value to persist (or skip). persistCustomerField →
//               the RLS UPDATE. `[TRACE:customers] edit` emitted verbatim (STD-003, ON by
//               default — standing owner instruction, do NOT comment out).
// ============================================================
import { supabase } from '../../lib/supabase';

export type CustomerTextField =
  | 'first_name' | 'last_name' | 'phone' | 'email'
  | 'address_line1' | 'city' | 'state' | 'zip';

// first_name / last_name are NOT NULL (last_name defaults to ''); these must never be written
// null. Everything else is nullable → blank clears to null.
const NOT_NULL_FIELDS: CustomerTextField[] = ['first_name', 'last_name'];

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
  console.log('[TRACE:customers] edit', { customerId: id, field, from, to: value });
  const { error } = await supabase
    .from('customers')
    .update({ [field]: value })
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) { console.error('[TRACE:customers] edit error', field, error.message); return { error: error.message }; }
  return { error: null };
}
