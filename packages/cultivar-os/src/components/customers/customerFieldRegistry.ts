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

/** 🔴 THE FIELDS A CUSTOMER CAN BE **FOUND BY** — the seventh parallel enumeration this file exists
 *  to kill, and the one that was still hand-written inside a JSX prop.
 *
 *  THE DEFECT (recon `f666dbb`, Part A1): the `/customers` roster passed `DataSheet` a literal
 *  eight-field array at `Customers.tsx:263` — `first_name · last_name · phone · email ·
 *  address_line1 · city · state · zip` — while its Name cell RENDERS `organization_name`
 *  (`Customers.tsx:204-207`, the `customer_type === 'organization'` branch). **So the roster
 *  searched a narrower set than it displayed: a row could print its own name and be unreachable by
 *  typing that name into the box directly above it.** Measured live — two `Diane Foster` rows,
 *  searching "foster" returned one, the other reachable only by direct URL.
 *
 *  ⚠️ **OVER-SEARCHING IS NOT THE DEFECT; UNDER-SEARCHING IS.** `phone`/`email` and the four legacy
 *  address columns are NOT rendered as roster columns and are kept anyway — a cashier looking someone
 *  up by phone is the case `CustomerSearch` was built for, and removing them would narrow a search
 *  nobody complained about. ✅ **All four legacy address columns are UNGATED** (`gated` is set only on
 *  the 2026-07-13 additions), so a consumer reading this list against a pre-migration database is no
 *  more exposed than it already was through `organization_name`/`display_name`, which ARE gated.
 *
 *  ⚠️ **`billing_*` IS DELIBERATELY NOT HERE, and the reason is recorded rather than left to be
 *  rediscovered:** the roster renders no address at all, so B1's bar ("search what it displays")
 *  does not reach it, and the D-41 mirror (`customerEdit.ts:170-172`, `customerUpsert`'s `offer`)
 *  writes `billing_city` and legacy `city` TOGETHER — so today the two are the same value and adding
 *  it would buy nothing. **It stops being equivalent on a row whose two column sets have diverged**
 *  (tech-debt #115's subject, and Diane Foster is one). Named, not taken.
 *
 *  🔴 **NO `.filter(k => CUSTOMER_FIELDS.some(…))` GUARD HERE, UNLIKE `CUSTOMER_SEARCH_COLS` ABOVE
 *  — DELIBERATELY, because that guard would reproduce the very defect this list fixes:** a mistyped
 *  or removed key would be silently dropped and the search would quietly narrow again, with nothing
 *  saying so. The integrity check lives in `customerSearchFields.test.ts` instead, where a name that
 *  is not a real registry field is a RED BUILD rather than a silent absence.
 *
 *  —— WHO READS IT — UPDATED 2026-08-25 (ledger #219), because the previous note said HALF and that
 *  half has now landed ——
 *  ✅ **TWO consumers, ONE list.** The `/customers` roster (`Customers.tsx`, client-side haystack via
 *  `customerSearchHaystack`) AND the checkout customer picker (`CustomerSearch.tsx`, a server-side
 *  PostgREST `.or()` of `<field>.ilike.<pattern>`). **Only the FIELD SET is shared — the two
 *  IMPLEMENTATIONS are deliberately NOT unified**, because one filters rows already in the browser
 *  and the other composes a filter string the database runs. The defect that forced this was the
 *  divergence, not the duplication: "cedar" returned TWO rows on the roster and ONE in checkout,
 *  the missed row matching on its CITY — a customer the owner can SEE and the cashier cannot FIND.
 *
 *  🔴 **A THIRD SEARCH STILL HAS ITS OWN LIST AND IS DELIBERATELY NOT REPOINTED HERE:**
 *  `ScanOrder.tsx`'s customer-attach strip (`runCustomerSearch`) matches on **`first_name` and
 *  `last_name` ONLY** — the narrowest of the three — and carries its own hand-written select string
 *  besides. It is **tech-debt #116**, named rather than fixed: repointing it changes a surface that
 *  was outside this build's scope bar, and its own select literal is a separate (A4/E6) fix that
 *  wants the same pass. **So the consolidation is 2 of 3, not done** — stated here so the next
 *  reader does not believe one list now governs every customer search in the app. */
export const CUSTOMER_SEARCH_FIELDS: readonly string[] = [
  // identity — every field the roster's Name cell can render, plus the name the customer sees on
  // their invoice (`display_name`), which the checkout picker has always matched on.
  'first_name', 'last_name', 'organization_name', 'display_name',
  // contact + the legacy address — over-searched on purpose (see above).
  'phone', 'email', 'address_line1', 'city', 'state', 'zip',
];

/** The roster's search haystack for ONE row — the string `DataSheet` runs `.includes()` against.
 *
 *  🔴 A9 (absent is not empty): a field that is null, undefined, blank or non-string contributes
 *  NOTHING. It must never contribute the literal `"undefined"` or `"null"`, which would make a
 *  search for "null" match every row that is MISSING a value — an absence rendered as a fact.
 *
 *  Takes `object` rather than a named row type on purpose: the roster's `CustomerRow`, the editor's
 *  `PartyCustomer` and a raw PostgREST row are three shapes of one record, and the haystack cares
 *  only about the keys. */
export function customerSearchHaystack(row: object): string {
  const r = row as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of CUSTOMER_SEARCH_FIELDS) {
    const v = r[key];
    if (typeof v === 'string' && v.trim() !== '') parts.push(v);
  }
  return parts.join(' ');
}
