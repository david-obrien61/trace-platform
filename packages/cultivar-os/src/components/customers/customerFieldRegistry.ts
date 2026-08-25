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

  // 🔴 ADDED 2026-08-25 (R-19's first instance) — A REAL COLUMN THIS "ONE LIST" DID NOT LIST.
  // `marketing_opt_in` is written by `customerUpsert.ts:152` and read back through `FILLABLE`
  // (`:211`, a live `.select()` that would 42703 if the column were absent — which is why it is
  // recorded as UNGATED from CODE BEHAVIOUR rather than from a catalog claim this machine cannot
  // source). The checkout form has always HELD it (`CustomerCapture.tsx:96` / `:234`, the opt-in
  // checkbox) while it sat in NO registry-derived list — so selecting a customer who had opted OUT
  // left the box CHECKED. That is A9 (absent is not empty) on the one field where the absence is a
  // CONSENT: a stored `false` rendered as a granted `true`. Found by R-19's own coverage check.
  { key: 'marketing_opt_in', label: 'Marketing opt-in',    group: 'status',     kind: 'bool' },
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

/** 🔴 R-19 · **THE ONE LIST THE ORDER PATH READS.** Every column a search result must CARRY so that
 *  (a) the picker row can be rendered and (b) SELECTING it fills the order form COMPLETELY.
 *
 *  THE DEFECT THIS REPLACES (2026-08-25, David's measurement on `f1c26ef`): selecting `john smith`
 *  at `/checkout/customer` filled first name, last name, email and phone — and City and ZIP rendered
 *  EMPTY, because **the address columns were never in the projection to begin with.** The old list
 *  was eleven hand-written strings and held NO address at all, so `onSelectExisting` could not have
 *  copied an address however carefully it had been written. **The copy list and the column list are
 *  the same defect seen twice**, which is why they are now one list with two derivations.
 *
 *  ⚠️ **`billing_line2` IS DELIBERATELY ABSENT and that is DECLARED, not omitted** — see
 *  `CUSTOMER_ORDER_EXCLUSIONS`. The order form has no second address line, so carrying it would put
 *  a value on the wire that no surface can show or save. Every other registry field is accounted for
 *  there with its reason, and `customerFieldCoverage.test.ts` FAILS if any field is in neither. */
export const CUSTOMER_ORDER_FIELDS: readonly string[] = [
  // who they are — what the picker row prints
  'id', 'first_name', 'last_name', 'organization_name', 'display_name', 'customer_type',
  // how to reach them
  'email', 'phone',
  // 🔴 THE ADDRESS, BOTH COLUMN SETS. Canonical AND legacy are carried because the resolution is
  // BILLING-FIRST-WITH-FALLBACK (D-41) and a fallback needs both halves present to fall back TO.
  // Carrying only `billing_*` would blank the address of every customer written before the 07-13
  // migration; carrying only the legacy four would disagree with `submit.ts:271-274`.
  'billing_line1', 'billing_city', 'billing_state', 'billing_zip',
  'address_line1', 'city', 'state', 'zip',
  // what the money depends on (D-39 / D-40) — resolved for the Review preview, re-read server-side
  'price_tier', 'tax_exempt', 'tax_exempt_reason', 'tax_exempt_cert_ref',
  // the consent the form holds — see the registry note on `marketing_opt_in`
  'marketing_opt_in',
];

/** 🔴 R-19 · WHY EACH REGISTRY FIELD THE ORDER PATH DOES **NOT** CARRY IS ABSENT.
 *  A declaration, not a silence — and it ASSERTS ITSELF IN BOTH DIRECTIONS (#11's lesson): the
 *  coverage test fails on a registry field that is in neither this map nor the list above, AND on an
 *  entry here naming a field the registry no longer has. So it cannot rot into unread noise. */
export const CUSTOMER_ORDER_EXCLUSIONS: Readonly<Record<string, string>> = {
  created_at:              'system-managed; the order form neither shows nor writes it (§6 r13).',
  source:                  'system-managed provenance; set by the writer, never by the cashier.',
  qb_customer_id:          'system-managed link; §6 r13 locks it, and the order path never edits it.',
  billing_line2:           'the order form has no second address line — carrying it would ship a value no surface can show or save.',
  tax_id:                  'sensitive, and NOT an order input: exemption is applied via tax_exempt* — the certificate number is the party record\'s business.',
  tax_exempt_expires:      'the exemption DECISION is re-read server-side at submit; an expiry date on the cart would be a second opinion about it.',
  payment_terms:           'a billing-arrangement attribute of the party, not a field of this sale; curated on /customers.',
  credit_limit:            'sensitive financial ceiling; nothing on the checkout path reads or enforces it today.',
  status:                  'account lifecycle, curated on /customers — a cashier does not set it while ringing a sale.',
  notes:                   'internal free text on the party record; not carried onto an order.',
};

/** The order projection as a select string. DERIVED — A4's cap counts hand-written column strings,
 *  and this replaced one. */
export const CUSTOMER_ORDER_COLS = CUSTOMER_ORDER_FIELDS.join(',');

/** The UNGATED subset — the deploy-window fallback. `billing_*`, `organization_name`,
 *  `display_name` and `tax_exempt*` arrived in the 2026-07-13 migrations, so a database that has
 *  not had them applied answers the full projection with 42703. Retrying with this subset keeps the
 *  search WORKING (narrower, honestly) instead of failing the whole customer step — which is what
 *  `ScanOrder`'s strip-and-retry did for the two exemption columns before it was retired into this
 *  component, and it would have been a regression to drop it. DERIVED from `gated`, never typed. */
export const CUSTOMER_ORDER_COLS_CORE = CUSTOMER_ORDER_FIELDS
  .filter(k => !CUSTOMER_FIELDS.some(f => f.key === k && f.gated)).join(',');

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
 *  ✅ **3 OF 3 — UPDATED 2026-08-25 (R-19's first instance). THE HOLDOUT IS GONE.** `ScanOrder.tsx`'s
 *  customer-attach strip used to be a THIRD search matching `first_name`/`last_name` ONLY, with its
 *  own 14-column select literal beside it (tech-debt #116 · #117). It no longer has a search of its
 *  own: the scan door now MOUNTS `<CustomerSearch>`, so there is exactly ONE customer-search
 *  implementation on the two order doors and ONE more on the roster, and **all three read this
 *  list.** `customerFieldCoverage.test.ts` §D asserts that from SOURCE — a re-inlined `.ilike.` pair
 *  anywhere in `ScanOrder.tsx` is a RED BUILD, so the claim in this paragraph cannot rot. */
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

// ── R-19 · ONE COPY ──────────────────────────────────────────────────────────────────────────
// Putting a customer on an order used to copy a HAND-WRITTEN FOUR (`CustomerCapture.tsx:168-175`:
// first/last/email/phone) on one door and a HAND-WRITTEN TWELVE (`ScanOrder.tsx:88-104`) on the
// other — and the two disagreed about the address rule: `ScanOrder` was billing-first on
// `address_line1` and LEGACY-ONLY on city/state/zip, so a customer whose billing city differed from
// their legacy city got a line-1 from one column set and a city from the other. **One row, one
// address, assembled from two rules.** These two functions are the whole copy, for both doors.

/** The address, resolved BILLING-FIRST with a legacy fallback (D-41).
 *  🔴 THE RULE IS NOT CHOSEN HERE — IT IS THE ONE `api/orders/submit.ts:264-274` ALREADY APPLIES
 *  when it writes the delivery row, and `api/qbo/invoice/cultivar.ts:101-106` when it pushes the
 *  invoice. The form must fill from the SAME rule or the cashier confirms one address while the
 *  truck and the invoice get another. Blank/whitespace on the canonical column falls through to the
 *  legacy one; both blank yields '' — never a stale value, never an invented one (A9). */
function pickAddress(row: Record<string, unknown>, canonical: string, legacy: string): string {
  for (const key of [canonical, legacy]) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

/** Every field the checkout customer FORM holds, resolved from a chosen customer row.
 *
 *  🔴 B3 — NO STALE VALUE, EVER. Every key is ALWAYS present in the result, so a caller that spreads
 *  it over form state CANNOT leave a previous customer's value standing. A field this customer does
 *  not have comes back as '' (or the stored boolean), never as `undefined` — because `undefined` is
 *  what a `setX(hit.x)` skips, and a skipped set is exactly how customer A's ZIP survived onto
 *  customer B's order. **The absence has to be a VALUE for the clear to happen.** */
// NOT exported — nothing imports the shape, only the function that returns it, and this file's own
// header rule is that "an export with no consumer is a claim that a consolidation happened when it
// has not". Export it the day a consumer needs to name it.
interface CustomerOrderFill {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  marketing_opt_in: boolean;
  price_tier: string | null;
  tax_exempt: boolean | null;
  tax_exempt_reason: string | null;
  tax_exempt_cert_ref: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** 🔴 THE ONE COPY. Both order doors call this and nothing else. */
export function customerOrderFill(row: object): CustomerOrderFill {
  const r = row as Record<string, unknown>;
  return {
    first_name: str(r.first_name),
    last_name:  str(r.last_name),
    email:      str(r.email),
    phone:      str(r.phone),
    // billing-first, exactly as submit.ts and the invoice resolve it
    address_line1: pickAddress(r, 'billing_line1', 'address_line1'),
    city:          pickAddress(r, 'billing_city',  'city'),
    state:         pickAddress(r, 'billing_state', 'state'),
    zip:           pickAddress(r, 'billing_zip',   'zip'),
    // 🔴 CONSENT IS NOT DEFAULTED. `?? true` here would re-grant an opt-out on every selection —
    // the defect this field's registry note describes. Only a genuinely ABSENT column (a
    // pre-migration read) falls back, and it falls back to the same `true` the blank form uses.
    marketing_opt_in: typeof r.marketing_opt_in === 'boolean' ? r.marketing_opt_in : true,
    price_tier:          typeof r.price_tier === 'string' ? r.price_tier : null,
    tax_exempt:          typeof r.tax_exempt === 'boolean' ? r.tax_exempt : null,
    tax_exempt_reason:   typeof r.tax_exempt_reason === 'string' ? r.tax_exempt_reason : null,
    tax_exempt_cert_ref: typeof r.tax_exempt_cert_ref === 'string' ? r.tax_exempt_cert_ref : null,
  };
}

/** The same copy, shaped as the cart's `CustomerInput`. Structurally derived from
 *  `customerOrderFill` — NOT a second hand-written mapping — so the two doors cannot drift.
 *  `CustomerInput` treats an absent optional as "not supplied" (`customerUpsert`'s rule (a):
 *  absent ≠ empty, and an omitted field is never written as null), so a blank string is converted
 *  back to `undefined` HERE, at the one boundary where that distinction is the contract. */
export function customerOrderInput(row: object): {
  first_name: string; last_name: string; email: string;
  phone?: string; address_line1?: string; city?: string; state?: string; zip?: string;
  marketing_opt_in?: boolean; price_tier?: string | null;
  tax_exempt?: boolean | null; tax_exempt_reason?: string | null; tax_exempt_cert_ref?: string | null;
} {
  const f = customerOrderFill(row);
  const opt = (v: string) => (v === '' ? undefined : v);
  return {
    first_name: f.first_name,
    last_name:  f.last_name,
    email:      f.email,
    phone:         opt(f.phone),
    address_line1: opt(f.address_line1),
    city:          opt(f.city),
    state:         opt(f.state),
    zip:           opt(f.zip),
    marketing_opt_in:    f.marketing_opt_in,
    price_tier:          f.price_tier,
    tax_exempt:          f.tax_exempt,
    tax_exempt_reason:   f.tax_exempt_reason,
    tax_exempt_cert_ref: f.tax_exempt_cert_ref,
  };
}
