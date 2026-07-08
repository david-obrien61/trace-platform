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
 *   `service_offerings` is a SHARED, business-agnostic surface — nothing here names a
 *   nursery, a plant, or any vertical noun. The option lists are the generic schema
 *   enums; a vertical supplies its own service ROWS (data), never new enum members.
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

/** price_unit ∈ order | plant | vehicle | visit — WHAT one unit is (distinct from price_type). */
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
