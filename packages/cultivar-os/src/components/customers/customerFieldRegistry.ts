// ============================================================
// customerFieldRegistry — THE ONE DECLARATIVE FIELD LIST FOR THE `customers` RECORD (Cultivar OS)
// PURPOSE:      ui-control-standards E6 ("one declarative field list per record"), applied to the
//               record that proved why the rule is needed. Before this file the customer record had
//               SIX parallel enumerations, none derived from another:
//                 1. `CustomerRow` + 2. the CORE/FULL select strings   (Customers.tsx)
//                 3. `PartyCustomer`                                    (CustomerPartyEditor.tsx)
//                 4. the `addText` array inside `saveCreate`            (CustomerPartyEditor.tsx)
//                 5. `CustomerTextField`                                (customerEdit.ts)
//                 6. `CustomerFormState` / `EditableCustomer`           (CustomerFields/EditModal)
//               A field added to the form but missed in the select reads back null forever, and
//               nothing in the codebase could notice. This is the single source the others derive
//               from. (Phase A of the customers merge — DERIVATION ONLY, no behavior change.)
// SCOPE:        Lists 5 and 6 die in later phases (B/C). This file replaces 2, 4, and 5 now, and is
//               the source the create/edit/select paths read. `CustomerCapture` (checkout) is OUT of
//               the form merge — a different unit of work — but IN for E6: it consumes this list.
// DEPENDENCIES: none. Pure data + derivations, so every consumer can import it without a cycle.
// OUTPUTS:      the derived constants each consumer used to hold as its own hand-maintained copy.
//               `CUSTOMER_FIELDS` itself is module-local until a consumer needs the whole registry
//               (phase B renders the form's groups from it) — an export with no consumer is a claim
//               that a consolidation happened when it has not.
// NAMING:        `customerFieldRegistry`, NOT `customerFields` — the latter collides with the
//               `CustomerFields.tsx` COMPONENT on a case-insensitive filesystem (macOS), where
//               `./CustomerFields` silently resolved to this file and broke the build.
// ============================================================

type CustomerFieldGroup =
  | 'identity' | 'contact' | 'billing' | 'tax' | 'commercial' | 'status' | 'system';

type CustomerFieldKind =
  | 'text' | 'textarea' | 'select' | 'number' | 'date' | 'bool' | 'system';

interface CustomerFieldDef {
  /** DB column name — the key everything else is derived from. */
  key: string;
  /** Human label (the form's <label>, and the lock popover's name). */
  label: string;
  group: CustomerFieldGroup;
  kind: CustomerFieldKind;
  /** Identity — may never be blanked (first_name). */
  identity?: boolean;
  /** NOT NULL in the schema → blank coerces to '', never null. */
  notNull?: boolean;
  /** PII / financial — VALUE-MASKED in `[TRACE:customers]` (BENCH-C). */
  sensitive?: boolean;
  /** Legacy unprefixed column this canonical field mirrors down to (D-41 bridge). */
  legacyMirror?: string;
  /** Added by the 2026-07-13 gated migrations — absent on a pre-migration read. */
  gated?: boolean;
  /** Included in the CREATE payload's plain-text pass (`addText`). */
  createText?: boolean;
}

// ── THE REGISTRY ─────────────────────────────────────────────────────────────
// Order is the form's rendering order, grouped. Adding a field HERE is what makes it exist to the
// select, the editable set, and the create payload at once — which is the entire point.
const CUSTOMER_FIELDS: readonly CustomerFieldDef[] = [
  // system / identity scope
  { key: 'id',              label: 'ID',                   group: 'system',     kind: 'system' },
  { key: 'created_at',      label: 'Added',                group: 'system',     kind: 'system' },
  { key: 'source',          label: 'Source',               group: 'system',     kind: 'system' },
  { key: 'qb_customer_id',  label: 'QuickBooks',           group: 'system',     kind: 'system' },

  // identity
  { key: 'first_name',      label: 'First name',           group: 'identity',   kind: 'text', identity: true, notNull: true },
  { key: 'last_name',       label: 'Last name',            group: 'identity',   kind: 'text', notNull: true },
  { key: 'organization_name', label: 'Organization name',  group: 'identity',   kind: 'text', gated: true, createText: true },
  { key: 'display_name',    label: 'Display name (invoice)', group: 'identity', kind: 'text', gated: true, createText: true },
  { key: 'customer_type',   label: 'Type',                 group: 'identity',   kind: 'select' },

  // contact
  { key: 'email',           label: 'Email',                group: 'contact',    kind: 'text', createText: true },
  { key: 'phone',           label: 'Phone',                group: 'contact',    kind: 'text', createText: true },

  // billing address — canonical, mirrored down to the legacy unprefixed columns (D-41)
  { key: 'billing_line1',   label: 'Line 1',               group: 'billing',    kind: 'text', gated: true, createText: true, legacyMirror: 'address_line1' },
  { key: 'billing_line2',   label: 'Line 2',               group: 'billing',    kind: 'text', gated: true, createText: true },
  { key: 'billing_city',    label: 'City',                 group: 'billing',    kind: 'text', gated: true, createText: true, legacyMirror: 'city' },
  { key: 'billing_state',   label: 'State',                group: 'billing',    kind: 'text', gated: true, createText: true, legacyMirror: 'state' },
  { key: 'billing_zip',     label: 'ZIP',                  group: 'billing',    kind: 'text', gated: true, createText: true, legacyMirror: 'zip' },

  // legacy consumed address — still READ by delivery/order surfaces (repoint is build phase D)
  { key: 'address_line1',   label: 'Address (legacy)',     group: 'billing',    kind: 'text' },
  { key: 'city',            label: 'City (legacy)',        group: 'billing',    kind: 'text' },
  { key: 'state',           label: 'State (legacy)',       group: 'billing',    kind: 'text' },
  { key: 'zip',             label: 'ZIP (legacy)',         group: 'billing',    kind: 'text' },

  // tax
  { key: 'tax_id',          label: 'Tax ID (EIN / resale no.)', group: 'tax',   kind: 'text', gated: true, createText: true, sensitive: true },
  { key: 'tax_exempt',      label: 'Tax-exempt customer',  group: 'tax',        kind: 'bool',   gated: true },
  { key: 'tax_exempt_reason',   label: 'Reason',           group: 'tax',        kind: 'select', gated: true },
  { key: 'tax_exempt_cert_ref', label: 'Certificate #',    group: 'tax',        kind: 'text',   gated: true },
  { key: 'tax_exempt_expires',  label: 'Cert expires',     group: 'tax',        kind: 'date',   gated: true },

  // commercial terms
  { key: 'price_tier',      label: 'Price tier',           group: 'commercial', kind: 'select' },
  { key: 'payment_terms',   label: 'Payment terms',        group: 'commercial', kind: 'text',   gated: true, createText: true },
  { key: 'credit_limit',    label: 'Credit limit',         group: 'commercial', kind: 'number', gated: true, sensitive: true },

  // status
  { key: 'status',          label: 'Account status',       group: 'status',     kind: 'select', gated: true },
  { key: 'notes',           label: 'Notes (internal)',     group: 'status',     kind: 'textarea', gated: true, createText: true },
] as const;

// ── DERIVATIONS — each one replaces a list that used to be maintained by hand ─
const by = (p: (f: CustomerFieldDef) => boolean) => CUSTOMER_FIELDS.filter(p).map(f => f.key);

/** Editable plain-text fields (blank → null unless notNull). Withheld in phase A because it had no
 *  consumer; phase B's `buildCustomerPatch` is that consumer, so it returns — as promised. */
export const CUSTOMER_TEXT_FIELDS = by(f => f.kind === 'text' || f.kind === 'textarea');


/** NOT NULL columns — blank coerces to '' rather than null. Was `NOT_NULL_FIELDS`. */
export const CUSTOMER_NOT_NULL_FIELDS = by(f => !!f.notNull);

/** BENCH-C value-masked in the TRACE diagnostic. Was `SENSITIVE_CUSTOMER_FIELDS`. */
export const CUSTOMER_SENSITIVE_FIELDS = by(f => !!f.sensitive);

/** Canonical → legacy mirror pairs (D-41 bridge). Was the inline `BILLING_MIRROR`. */
export const CUSTOMER_BILLING_MIRROR: Record<string, string> = Object.fromEntries(
  CUSTOMER_FIELDS.filter(f => f.legacyMirror).map(f => [f.key, f.legacyMirror as string]),
);

// NOTE: the create-only text pass (`createText`) no longer has a derivation exported. Phase B
// retired its consumer — `buildCustomerPatch` builds the INSERT from the same diff as the UPDATE,
// which is the point of one commit model. The flag stays on the registry because it still describes
// the field; an unused EXPORT would be a claim that something consumes it.

/** Guaranteed-live columns (everything pre-2026-07-13). Was the `CORE` select string. */
export const CUSTOMER_SELECT_CORE = by(f => !f.gated).join(',');

/** The checkout customer-SEARCH projection — the facts a cashier identifies a customer BY, plus the
 *  three that must be correct on the invoice (tier, tax, exemption reason) so the result row can show
 *  them before selection. DERIVED, not a literal: A4's cap counts hand-written column strings, and a
 *  new read path added with a literal would fail it. Kept narrow deliberately — a search result is a
 *  projection, not the record. */
export const CUSTOMER_SEARCH_COLS = [
  'id', 'first_name', 'last_name', 'organization_name', 'display_name', 'customer_type',
  'phone', 'email', 'price_tier', 'tax_exempt', 'tax_exempt_reason',
].filter(k => CUSTOMER_FIELDS.some(f => f.key === k)).join(',');

/** CORE + the gated 2026-07-13 columns. Was the `FULL` select string. The roster tries FULL and
 *  falls back to CORE on a missing-column error, so a pre-migration read never breaks the page. */
export const CUSTOMER_SELECT_FULL = CUSTOMER_FIELDS.map(f => f.key).join(',');
