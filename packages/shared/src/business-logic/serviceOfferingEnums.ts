/**
 * ── SERVICE OFFERING ENUMS (shared, all-vertical) · THUNDER · 2026-07-08 ─────────
 *
 * PURPOSE
 *   The ONE canonical option-set for the `service_offerings` schema enums, shared by
 *   every surface that lets an owner CREATE or EDIT a service (the Settings service
 *   editor today; any future vertical editor). Sourced straight from the column CHECKs
 *   in `supabase/migrations/20260529_businesses_f_service_offerings.sql` so the picker
 *   can never offer a value the DB rejects, and can never omit one it accepts.
 *
 * WHY THIS EXISTS (AC-1)
 *   `service_offerings` is a SHARED, business-agnostic surface. The option lists are the
 *   generic schema enums; a vertical supplies its own service ROWS (data).
 *
 *   ✏️ CORRECTED 2026-09-14 (ledger #328, recon #327). THIS PARAGRAPH USED TO READ
 *   *"nothing here names a nursery, a plant, or any vertical noun … a vertical supplies its own
 *   service ROWS (data), NEVER NEW ENUM MEMBERS"* — and it was self-refuting nine lines above
 *   `{ value: 'plant', label: 'per plant' }`. Worse, the final clause was not a description of
 *   the design, it was **a statement of the defect**: saying a vertical may never add an enum
 *   member is exactly why a food bank could not express `price_unit: 'household'`.
 *   🔴 The constraint behind it has been fixed — `20260914_price_unit_shape_not_enum.sql`
 *   makes `price_unit` a SHAPE, so a vertical CAN supply its own unit as data, with no migration.
 *   ⚠️ `'plant'` REMAINS in `PRICE_UNIT_OPTIONS` below, and that is now a known, filed gap
 *   rather than a claim of cleanliness — tech-debt **#298**: the shared picker offers a grower's
 *   unit to every vertical. The REFUSAL is gone; the AFFORDANCE has not been made per-vertical.
 *   The prior Settings editor hardcoded these inline and (a) omitted 'transport' and
 *   (b) conflated price_type + price_unit into one control — this module is the fix so
 *   the two fields stay distinct and the full category set is always offered.
 *
 * OUTPUTS
 *   CATEGORY_OPTIONS · TIMING_OPTIONS · PRICE_TYPE_OPTIONS · PRICE_UNIT_OPTIONS ·
 *   TRANSPORT_MODE_OPTIONS  — each an {value,label}[] for a <select>.
 *   *_LABEL maps for display grouping.
 *
 * DEPENDENCIES: none (pure constants).
 */

export interface EnumOption {
  value: string;
  label: string;
}

/** category ∈ transport | addon | maintenance | inspection | subscription */
export const CATEGORY_OPTIONS: EnumOption[] = [
  { value: 'transport',    label: 'Transport' },
  { value: 'addon',        label: 'Add-on' },
  { value: 'maintenance',  label: 'Maintenance' },
  { value: 'inspection',   label: 'Inspection' },
  { value: 'subscription', label: 'Subscription' },
];

/** timing ∈ at_checkout | post_purchase | recurring */
export const TIMING_OPTIONS: EnumOption[] = [
  { value: 'at_checkout',   label: 'At checkout' },
  { value: 'post_purchase', label: 'After sale' },
  { value: 'recurring',     label: 'Recurring' },
];

/** price_type ∈ flat | per_unit — HOW the price is calculated (distinct from price_unit). */
export const PRICE_TYPE_OPTIONS: EnumOption[] = [
  { value: 'per_unit', label: 'Per unit' },
  { value: 'flat',     label: 'Flat fee' },
];

/**
 * price_unit — WHAT one unit is (distinct from price_type, which is HOW it is calculated).
 *
 * 🔴 THIS LIST IS THE SUGGESTIONS, NOT THE PERMITTED SET. Since
 * `20260914_price_unit_shape_not_enum.sql` the column accepts any lowercase identifier
 * (`isUsablePriceUnit` below is the one predicate that says which), so a vertical writes
 * 'household' or 'bag' without a migration and without an entry here.
 * ⚠️ Do NOT reintroduce this array as a validation gate. It was one until 2026-09-14, in
 * `serviceReview.ts` and `discovery/seed.ts`, and that is what closed the column in code after
 * the database had been opened.
 */
export const PRICE_UNIT_OPTIONS: EnumOption[] = [
  { value: 'order',   label: 'per order' },
  { value: 'plant',   label: 'per plant' },
  { value: 'vehicle', label: 'per vehicle' },
  { value: 'visit',   label: 'per visit' },
];

/** transport_mode / trigger_transport_mode ∈ self | staff (nullable in schema). */
export const TRANSPORT_MODE_OPTIONS: EnumOption[] = [
  { value: 'staff', label: 'Business provides transport (staff)' },
  { value: 'self',  label: 'Customer provides own transport (self)' },
];

const toLabelMap = (opts: EnumOption[]): Record<string, string> =>
  opts.reduce((m, o) => { m[o.value] = o.label; return m; }, {} as Record<string, string>);

export const CATEGORY_LABEL     = toLabelMap(CATEGORY_OPTIONS);
export const TIMING_LABEL       = toLabelMap(TIMING_OPTIONS);
export const PRICE_UNIT_LABEL   = toLabelMap(PRICE_UNIT_OPTIONS);
export const TRANSPORT_MODE_LABEL = toLabelMap(TRANSPORT_MODE_OPTIONS);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE ONE PRICE-UNIT PREDICATE — the same question the database asks (§6 r8)
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THIS MIRRORS A CHECK CONSTRAINT AND THE DUPLICATION IS DELIBERATE, SO IT IS NAMED.
// `service_offerings_price_unit_shape` (20260914) is the ENFORCEMENT — it is what makes a bad
// value impossible. This is the SAME rule stated in TypeScript so a caller can refuse politely,
// with a sentence, instead of surfacing a Postgres error string to an owner.
// ⚠️ Two representations of one rule is STD-011, and the mitigation is that they are written
// beside each other and asserted together: `serviceOfferingEnums.test.ts` §C parses the regex out
// of the migration file and fails if these two ever disagree. Change one, the test fails.

/** The shape a `price_unit` must take: a lowercase identifier. Mirrors the DB constraint. */
export const PRICE_UNIT_SHAPE = /^[a-z][a-z0-9_]*$/;

/** Longest `price_unit` the column accepts. Mirrors the DB constraint. */
export const PRICE_UNIT_MAX_LENGTH = 40;

/**
 * Is this a value `service_offerings.price_unit` will accept **exactly as given**?
 *
 * Form, not meaning — it cannot tell you whether 'household' makes SENSE for this business,
 * only that the column will take it. That is the whole point: judging meaning is what closed
 * the column to every vertical but the first.
 *
 * 🔴 IT REJECTS 'Household' WHILE `normalisePriceUnit` REPAIRS IT, AND THAT ASYMMETRY IS
 * DELIBERATE — stated here because a reader will otherwise assume one wraps the other.
 *   · `isUsablePriceUnit` is a GATE: *would the database take this AS IT STANDS?* Use it where a
 *     value has already been chosen and must be accepted or refused (the books review).
 *   · `normalisePriceUnit` is a REPAIRER: *what should be STORED for this?* Use it where free
 *     text arrives and case is not the author's fault (the discovery seed, an AI response).
 * A caller that repairs must repair BEFORE it gates, never after.
 */
export function isUsablePriceUnit(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const v = raw.trim();
  return v.length > 0 && v.length <= PRICE_UNIT_MAX_LENGTH && PRICE_UNIT_SHAPE.test(v);
}

/**
 * Trim-and-lowercase a price unit, or null when it cannot be one.
 *
 * 🔴 RETURNS null RATHER THAN A FALLBACK, AND THAT IS THE POINT OF THE FUNCTION. Its
 * predecessor — `toPriceUnit` in `discovery/seed.ts` — returned `'order'` for anything it did
 * not recognise, so a vertical's own unit was silently rewritten to a different, plausible,
 * WRONG one. D-9: surface uncertainty, never coerce it into a confident-looking value. A caller
 * that gets null must decide what to do and say so.
 *
 * ⚠️ It LOWERCASES, so it accepts 'Household' where `isUsablePriceUnit('Household')` is false.
 * See that function's note — one is a REPAIRER, the other a GATE, and they are not interchangeable.
 */
export function normalisePriceUnit(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return isUsablePriceUnit(v) ? v : null;
}
