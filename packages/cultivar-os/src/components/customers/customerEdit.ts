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
import { CUSTOMER_NOT_NULL_FIELDS, CUSTOMER_SENSITIVE_FIELDS, CUSTOMER_TEXT_FIELDS, CUSTOMER_BILLING_MIRROR } from './customerFieldRegistry';

// RESIDUAL of list 5 (E6): the runtime list is now derived from `customerFields.ts`; this UNION is
// its compile-time half and is still written by hand. It collapses in phase B, when the form's
// per-field writers are replaced by one diffed Save. Keys here must match CUSTOMER_TEXT_FIELDS.
export type CustomerTextField =
  | 'first_name' | 'last_name' | 'phone' | 'email'
  | 'address_line1' | 'city' | 'state' | 'zip'
  // Party-record (2026-07-13) text fields — all nullable (blank → null via coerceCustomerField).
  | 'organization_name' | 'display_name'
  | 'billing_line1' | 'billing_line2' | 'billing_city' | 'billing_state' | 'billing_zip'
  | 'tax_id' | 'payment_terms' | 'notes'
  // The exemption certificate REFERENCE (a number the customer holds, not a document we store —
  // TRACE connects systems, it does not become the record for someone else's paperwork).
  | 'tax_exempt_cert_ref';

// E6 (Phase A): these were two hand-maintained lists. They are now DERIVED from the ONE customer
// field registry, so a field marked notNull/sensitive there is honoured here without a second edit.
const NOT_NULL_FIELDS: string[] = CUSTOMER_NOT_NULL_FIELDS;

// BENCH-C (PII) — value-MASKED in the [TRACE:customers] diagnostic: an EIN / resale number and a
// credit figure are PII and must never appear in plaintext logs. For these fields we log the field
// name + "changed", never the from/to value. ONE source both write helpers read (STD-011).
const SENSITIVE_CUSTOMER_FIELDS = new Set<string>(CUSTOMER_SENSITIVE_FIELDS);

// A8 — a write that affects ZERO ROWS is a FAILURE and says so. PostgREST returns NO ERROR when an
// UPDATE matches no rows, and under RLS "matched zero rows" is exactly what a REFUSED write looks
// like: `customers_member_update` gates on `customers:update`, and a STAFF member holding only
// `customers:read` would otherwise be told their edit saved. The message names the likely cause
// without asserting it (D-9) — the row may also have been deleted by someone else.
const NOT_SAVED = 'That change was not saved. You may not have permission to edit this customer, or it may have been removed.';

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
  const { data, error } = await supabase
    .from('customers')
    .update({ [field]: value })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id'); // A8 — the affected-row evidence; without it a refused write reports success
  if (error) { console.error('[TRACE:customers] edit error', field, error.message); return { error: error.message }; }
  if (!data?.length) {
    console.error('[TRACE:customers] edit AFFECTED ZERO ROWS — refused or missing', { customerId: id, field });
    return { error: NOT_SAVED };
  }
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
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id'); // A8 — see NOT_SAVED
  if (error) { console.error('[TRACE:customers] patch error', Object.keys(patch).join(','), error.message); return { error: error.message }; }
  if (!data?.length) {
    console.error('[TRACE:customers] patch AFFECTED ZERO ROWS — refused or missing', { customerId: id, fields: Object.keys(patch) });
    return { error: NOT_SAVED };
  }
  return { error: null };
}

/**
 * INSERT a new customer (the CREATE path — used by CustomerPartyEditor in create mode, replacing
 * the retired flat Add form). ONE insert path, owner-only RLS (business_id-scoped, no endpoint —
 * NO new api-fn). Logs `[TRACE:customers] insert` with tax_id / credit_limit VALUE-MASKED (BENCH-C,
 * the same SENSITIVE_CUSTOMER_FIELDS source as the edit helpers — STD-011). The caller passes the
 * already-built values (first_name required upstream); business_id is stamped here.
 */
export async function insertCustomer(params: {
  businessId: string;
  values: Record<string, unknown>;
}): Promise<{ error: string | null; id: string | null }> {
  const { businessId, values } = params;
  const masked = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, SENSITIVE_CUSTOMER_FIELDS.has(k) ? '(set)' : v]),
  );
  console.log('[TRACE:customers] insert', { businessId, fields: masked });
  const { data, error } = await supabase
    .from('customers')
    .insert({ business_id: businessId, ...values })
    .select('id')
    .single();
  if (error) { console.error('[TRACE:customers] insert error', error.message); return { error: error.message, id: null }; }
  return { error: null, id: (data as { id: string }).id };
}

// ─────────────────────────────────────────────────────────────────────────────
// A3 / E2 PHASE B — THE ONE DIFF. The form buffers every field and commits ONCE, so this replaces
// the per-field writers entirely. It is PURE (no supabase, no React) so the rules can be reasoned
// about and tested without a browser, and it is the single place the coercion runs — the defect it
// retires is a coercion that ran per-keystroke-blur against the wrong base.
//
// FIELD SET IS DERIVED (A4/E6): the text fields come from the registry, not from a list written here.
// ─────────────────────────────────────────────────────────────────────────────
interface TaxDraft {
  exempt: boolean; reasonCode: string; otherText: string; certRef: string; expires: string;
}

/**
 * Diff the on-screen draft against the last-persisted row and return ONLY what changed.
 * `creating` builds a full insert payload instead (same rules, one branch for the NOT NULL defaults).
 * Returns `{ error }` on a validation failure — validated ONCE here, not per field.
 */
export function buildCustomerPatch(params: {
  saved: Record<string, unknown>;
  draft: Record<string, unknown>;
  tax: TaxDraft;
  creating: boolean;
}): { values: Record<string, unknown>; error: string | null } {
  const { saved, draft, tax, creating } = params;
  const values: Record<string, unknown> = {};

  // ── identity + required ──
  const first = String(draft.first_name ?? '').trim();
  if (!first) return { values: {}, error: 'First name is required.' };

  // ── the tax invariant (D-40), checked ONCE: never exempt without a recorded reason ──
  let taxReason: string | null = null;
  if (tax.exempt) {
    taxReason = tax.reasonCode === 'other' ? tax.otherText.trim() : tax.reasonCode;
    if (!taxReason) return { values: {}, error: 'A reason is required to make a customer tax-exempt.' };
  }

  const put = (k: string, v: unknown) => { if (creating || v !== saved[k]) values[k] = v; };

  // ── text fields, from the registry ──
  for (const field of CUSTOMER_TEXT_FIELDS) {
    if (field === 'tax_exempt_cert_ref') continue;             // owned by the tax block below
    if (Object.values(CUSTOMER_BILLING_MIRROR).includes(field)) continue; // legacy mirrors are derived, never edited
    const raw = draft[field];
    if (raw === undefined) continue;
    const trimmed = String(raw ?? '').trim();
    const notNull = CUSTOMER_NOT_NULL_FIELDS.includes(field);
    const value = trimmed === '' ? (notNull ? '' : null) : trimmed;
    put(field, value);
    // D-41 bridge: a canonical billing field carries its legacy twin with it.
    const mirror = CUSTOMER_BILLING_MIRROR[field];
    if (mirror && (creating ? value != null : value !== saved[mirror])) values[mirror] = value;
  }

  // ── typed fields ──
  put('customer_type', draft.customer_type ?? 'person');
  put('price_tier',    draft.price_tier ?? 'retail');
  put('status',        draft.status ?? 'active');
  const cl = draft.credit_limit;
  if (cl !== undefined) {
    const n = cl === null || cl === '' ? null : Number(String(cl).replace(/[$,]/g, ''));
    if (n !== null && Number.isNaN(n)) return { values: {}, error: 'Credit limit must be a number.' };
    put('credit_limit', n);
  }

  // ── the tax set, written as a UNIT (it was atomic before and stays atomic) ──
  put('tax_exempt',          tax.exempt);
  put('tax_exempt_reason',   tax.exempt ? taxReason : null);
  put('tax_exempt_cert_ref', tax.exempt ? (tax.certRef.trim() || null) : null);
  put('tax_exempt_expires',  tax.exempt ? (tax.expires || null) : null);

  if (creating) {
    values.source = 'manual';
    values.first_name = first;
    values.last_name = String(draft.last_name ?? '').trim();   // NOT NULL → '' never null
  }
  return { values, error: null };
}
