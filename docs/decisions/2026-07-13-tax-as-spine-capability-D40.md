# D-40: Tax as a platform-spine capability (rate-sourcing · taxability seam · party exemption · audited authority)

**Status:** ✅ **APPROVED + BUILT (Level 1) — BUILDER-COMPLETE, owner-proof owed** (2026-07-13). Ledger row #117.
This is the canonical D-40 detail doc (graduated from the 2026-07-13 DRAFT). The DECISIONS-INDEX + DECISIONS.md
carry the one-line + drift note.

**RESOLVED FORKS (David's calls, built to):**
- **Rate home = `config.taxRate` jsonb** (NOT the `businesses.tax_rate` column). Absence = honest "not identified";
  no migration for the rate; existing tenants (incl. LAWNS) read as unset until they re-confirm. `businesses.tax_rate`
  is deprecated (no longer read); `TAX_RATE_FALLBACK`/`TAX_RATE` literals killed.
- **Per-order audit = additive columns on `orders`** (`tax_exempt_applied`/`reason`/`cert_ref`/`by`). An immutable
  compliance-record row is NAMED as the audit-hardening follow-up, NOT built now.
- **Permissions = TWO granular siblings** — `apply_tax_exempt` AND `apply_discount`, built as a matched pair.
- **Rounding (stated) = `tax = round2(taxableSubtotal × rate)`**, ONE method, so Review/submit/QBO/email cannot
  disagree by a penny. `taxableSubtotal = Σ netTotal WHERE line.taxable` (default every line taxable = today's behavior).
- **Level 1 = origin-based single per-tenant rate** (Texas is origin-based for in-state sellers — legally correct, not a
  simplification). Level 2 (address/jurisdiction/tax-API) is HOOKED at `resolveTaxRate` + the per-line `taxable` flag,
  NOT built.

**Original proposal (retained below for the full recon + rationale):** Tax touched blind at the spine is how a silent
mischarge ships to every tenant — so: map + design, David approved, then build.

**Date:** 2026-07-13 · **Author:** Thunder (recon + spec) · **Scope:** platform spine (`packages/shared`),
vertical-agnostic. Cultivar is the first vertical to exercise it; Ignition inherits the same spine.

**Proposed D-40 one-line statement (for the index):**
> *Tax is a computed line on the shared money boundary: the rate is per-tenant SUPPLIED DATA (never
> platform-encoded jurisdiction knowledge; an unset rate renders a redlined "Tax: not identified", never a
> fabricated number); taxability is a per-line attribute riding the D-39 goods/service line-kind seam;
> exemption is a business-scoped PARTY attribute (on `customers`, mirroring `price_tier`/D-38) invoked
> per-transaction with a per-order override; and zeroing tax REQUIRES a recorded reason (+ optional
> certificate ref) under a gated, logged `apply_tax_exempt` authority (sibling of the threaded apply_discount).*

---

## RECON — current state (read-only, `file:line`)

### 1. Every tax computation site

| # | site | what it does | how 8.25% / 0.0825 enters |
|---|---|---|---|
| a | `packages/shared/src/business-logic/tierPricing.ts:302-336` `computeOrderPricing(lines, resolvedTier, taxRate)` | **THE single shared computation.** `taxableSubtotal = discountedSubtotal` (D-39); `tax = round2(taxableSubtotal × (Number(taxRate) ‖ 0))` | **rate is a PARAM** — it does not hardcode; it taxes the whole discounted subtotal at whatever rate it's handed. Already spine-resident. |
| b | `packages/cultivar-os/api/orders/submit.ts:10` | `const TAX_RATE_FALLBACK = 0.0825` | literal fallback constant |
| c | `submit.ts:177-178` (create path) | reads `businesses.tax_rate`, `taxRate = Number(row?.tax_rate ?? TAX_RATE_FALLBACK)` → passes to `computeOrderPricing` (`:397`) | fallback 0.0825 when the column is null |
| d | `submit.ts:761-763` (`handleUpdate` roster edit) | **a SECOND, separate computation:** `taxAmount = round2(subtotal × taxRate)` — does NOT go through `computeOrderPricing` | fallback 0.0825; **drift risk** — roster-edit tax is computed off-seam (inherited gap noted in ledger #107/#114 as "handleUpdate not tier/basis-aware") |
| e | `packages/cultivar-os/src/pages/CartReview.tsx:12,108,160,475` | imports `TAX_RATE`; `taxRate = business?.tax_rate ?? TAX_RATE`; feeds `computeOrderPricing`; renders `Tax (X%)` | `TAX_RATE` (constants) fallback |
| f | `packages/cultivar-os/src/pages/Confirmation.tsx:204` | renders `Tax (X%)` where **X is DERIVED** `taxAmount/subtotal` | ✅ no literal — reads the computed amount (correct pattern) |
| g | `packages/cultivar-os/api/qbo/invoice/cultivar.ts:104,285` | reads `businesses.tax_rate`; `taxPct = Math.round((business.tax_rate ?? 0.0825) × 10000)/100` | fallback 0.0825 → QBO invoice |
| h | `packages/shared/src/notifications/templates/cultivar.ts:57` | **customer-facing email:** `<span>Tax (8.25%)</span>` | **hardcoded LITERAL — the AC-1 bug on the highest-severity surface** (every non-TX tenant's customer sees a wrong tax %) |
| i | `packages/cultivar-os/src/lib/constants.ts:1` | `export const TAX_RATE = 0.0825` | the shared fallback literal (imported by CartReview) |
| j | `packages/shared/src/pages/Settings.tsx:217,230,244,531` | owner enters `tax_rate` → writes `businesses.tax_rate`; `parseFloat(form.tax_rate) ‖ 0.0825` on save | **coerces a blank/unparseable rate to 0.0825** — a silent default, the redline's root cause |
| k | `packages/cultivar-os/src/pages/Help.tsx:460` | example copy "for 8.25%, enter 0.0825" | doc text (benign) |
| — | Ignition: `IgnitionEstimate.jsx:113`, `IgnitionInvoice.jsx:51`, `CustomerApprovalPortal.jsx:122` | each hardcodes `|| 0.0825` on `shop_policy.tax_rate` | **frozen donor vertical — proves the cross-vertical universality**: every vertical independently reinvents tax-on-parts. This is why tax belongs on the spine, not in a vertical. |

### 2. Shared vs cultivar — what would MOVE to the spine

- **Already shared:** the tax ARITHMETIC (`computeOrderPricing`, `tierPricing.ts`). Nothing to move — extend it.
- **Cultivar-local (must become spine-generic):**
  - **Rate sourcing** — `businesses.tax_rate` read + `TAX_RATE_FALLBACK`/`TAX_RATE` literals live in cultivar submit/CartReview/constants. The rate ACCESSOR should be a shared helper so every vertical + surface reads it one way (and cannot fall back to a literal).
  - **The three-state tax presentation** (not-identified / taxed / exempt) — **does not exist anywhere.** Each surface (CartReview `:475`, Confirmation `:204`, QBO `:285`, email `:57`) formats tax independently. The spec makes `computeOrderPricing` emit a `taxStatus` + reason, and every surface renders from THAT one output — no surface re-derives.
  - **Exemption + redline logic** — does not exist. New spine capability.

### 3. Config home for the rate — **RECON CORRECTION of the task's premise**

The task assumed `business_pricing_config.config.taxRate` (jsonb, no migration). **Recon finds the rate already
has a home: `businesses.tax_rate`** — `numeric(5,4) **NOT NULL DEFAULT 0.0825**`
(`20260529_businesses_a_create_tables.sql:13`), read live by submit/CartReview/QBO/BusinessProvider
(`BusinessProvider.tsx:124`), written by Settings.

**This column's `NOT NULL DEFAULT 0.0825` IS the redline defect at the data layer:** there is NO "unset"
state — a tenant who never touches the rate is *silently given TX's 8.25%*, and "chose 8.25%" is
indistinguishable from "never set it." A backfill can't un-know which existing rows were defaulted.

The pricing-config accessor pattern (confirmed, `financialDataAccess.ts:171-244`):
`readPricingConfig` / `writePricingConfig` / **`mergePricingConfig`** (clobber-safe read-merge-write —
each writer patches only its keys) over `business_pricing_config.config` jsonb. **`business_pricing_config`
is `view_pricing_config`-GATED** (RLS). The discount tiers already ride this exact accessor and the Review
already reads them from it — so it's a proven path, but the gating is a consideration (see §A / RLS note).

### 4. Party model + exemption home

- `people` = global human spine, **no `business_id`** (`20260625_person_spine.sql:28`). `person_id` is an
  OVERLAY (nullable FK, `ON DELETE SET NULL`) on the role tables — `business_members`, `customers`,
  `labor_resources`, `invitations`. **There is NO `person_business_roles` table** — the "edges" ARE those
  overlay columns.
- **The customer-role edge IS the `customers` row** (`business_id` + `person_id`). It carries
  **`price_tier text NOT NULL DEFAULT 'retail', NO CHECK`** (`:106`) + `customer_type` (`20260702`). RLS =
  `customers_business_owner` (owner FOR ALL) + `customers_member` (`is_active_member AND
  has_permission('view_customers')`, `20260710`).
- **Exemption mirrors `price_tier` → attaches to `customers`.** Small additive migration, mirroring the
  `price_tier` `ADD COLUMN` (three nullable columns — §A). **AC-3 is naturally correct here:** exemption is
  business-scoped (a resale/ag cert is filed with THAT seller; a buyer exempt at one business is not
  automatically exempt at another), so it belongs on `customers` (business-scoped), NOT on `people` (global).

### 5. Line-kind seam (D-39) — taxability rides it, no new seam

`computeOrderPricing` lines carry `kind: 'goods' | 'service'` (`tierPricing.ts:258`, `PricingLineInput`).
Discount already reads this seam (goods discounted, service never). **A per-line `taxable` flag rides the
SAME seam** — no new seam, AC-4 (settle line-kind once; discount AND tax both read it). Today the function
taxes the WHOLE `discountedSubtotal` (goods + service both). The refinement: `taxableSubtotal = Σ netTotal
WHERE line.taxable`.

### 6. Permission model — exemption is the sibling of the threaded apply_discount

- **`apply_discount` does NOT exist yet** — it's a *threaded proposal*. Discount/override authority today
  rides **`manage_orders`** + the server-side token gate `callerCanManageOrders` (owner OR
  `has_permission('manage_orders')`) in `submit.ts:30-32,150,684,823,864`, with actor attribution via
  `resolveCallerUid` (`:151`) — the leakage-override path.
- **`actionPermissions.ts` is the declare-here-and-union pattern:** `override_maintenance`, `view_customers`
  are declared once, unioned into the `/roles` console chip catalog, defaulted per-role, enforced at the
  data layer via `has_permission(...)`. **Tax-exemption authority = a new `apply_tax_exempt` action
  permission declared here**, gated server-side in `submit.ts` exactly like the override, logged.
- **Per-order audit precedent:** `order_compliance_records` (`20260529_businesses_g...:29-47`) — the
  netting accept/decline immutable audit row (`order_id`, `business_id`, `decision`, `*_shown`,
  `acknowledged_by`, `created_at`). A tax-exemption-applied event is the same shape.

---

## SPEC — the proposed spine design (NOT built)

### A. WHERE EACH PIECE LIVES

| piece | home | migration? | rationale |
|---|---|---|---|
| **per-tenant tax RATE** | **`business_pricing_config.config.taxRate`** (jsonb) — via `readPricingConfig` / `mergePricingConfig`. **Deprecate `businesses.tax_rate`** (stop reading it; leave the column, kill the `TAX_RATE_FALLBACK`/`TAX_RATE` literals). | **NO migration** | Absence of the key = **"not identified"** for free — the honest state the `NOT NULL DEFAULT 0.0825` column can never express. Every existing tenant reads as unset and must confirm their rate (including LAWNS) — the correct, honest outcome. Rides the same accessor the tiers use. AC-1 clean. **Alternative considered:** make `businesses.tax_rate` nullable (migration to drop NOT NULL/DEFAULT) — REJECTED as weaker: can't un-know which existing rows were defaulted vs chosen, so the redline stays half-lying for existing rows. |
| **per-line TAXABILITY** | the D-39 line-kind seam — add `taxable?: boolean` to `PricingLineInput`; a per-tenant `config.serviceTaxable` default (jsonb) | **NO migration** | Reuses the goods/service seam (§5). **Money-safety default = today's behavior (goods `true`, service `true`)** so no tenant's totals silently shift on ship; the owner opts services out per jurisdiction. |
| **party EXEMPTION** | **`customers`** — 3 additive nullable columns: `tax_exempt boolean DEFAULT false`, `tax_exempt_reason text`, `tax_exempt_cert_ref text` (mirrors `price_tier`) | **YES — small additive** | The customer-role edge (§4). Business-scoped (AC-3). Mirrors how `price_tier`/D-38 is a persistent party attribute invoked per-transaction. |
| **per-order OVERRIDE + audit** | **`orders`** — additive nullable `tax_exempt_applied boolean`, `tax_exempt_reason text`, `tax_exempt_cert_ref text`, `tax_exempt_by uuid` (actor) — persisted so invoice/QBO/receipt/email render it; audit rides the existing `resolveCallerUid` actor-attribution | **YES — small additive** | A per-order one-off (exempt this order even if the customer isn't a standing exempt party, or override a standing exemption off). Persisted on the order so every downstream surface renders the same truth. **Alternative for the audit trail:** a dedicated `order_compliance_records`-style row (the netting precedent) instead of order columns — decision point for the build. |
| **the tax COMPUTATION** | **`computeOrderPricing` (spine, `tierPricing.ts`)** gains taxability + exemption awareness + a `taxStatus` output | code only | ONE computation, every surface renders its output — no re-derivation. |

**RLS note (verify in build, does not block design):** `business_pricing_config` is `view_pricing_config`-gated.
The Review already reads discount tiers from it (proven path), and `submit.ts` is server-authoritative
(service key) for the charged tax regardless. Confirm the display rate is readable on the Review path for a
checkout operator lacking `view_pricing_config`, and on the anon/public-scan path, during the build. If the
gate proves too tight for a non-sensitive value like a tax rate, the fallback home is a **new nullable
`businesses.tax_rate` semantics** (broadly readable) — but jsonb is preferred for the honesty story.

### B. THE THREE INVOICE STATES (worked example — one shared computation, four surfaces)

`computeOrderPricing` gains: `taxRate: number | null` (null → not identified), an optional `exemption`
input, and emits `taxStatus: 'not_identified' | 'taxed' | 'exempt'` + `taxExemptReason?` + `taxExemptCertRef?`
alongside `tax`. **Review, Confirmation, QBO, and the email all render from `{ taxStatus, tax,
taxExemptReason, taxExemptCertRef }` — never re-deriving.**

Worked order: 4 × Live Oak 30gal @ $128 (goods) + Delivery $125 (service), Contractor tier 10% on goods.
Goods retail $512 → −$51.20 → $460.80; + Delivery $125 → discounted subtotal **$585.80**.

**State 1 — rate UNSET (`config.taxRate` absent → `taxRate = null`):** `taxStatus = 'not_identified'`, `tax = 0`.
```
  Live Oak 30gal × 4        $460.80   (Contractor −10%)
  Delivery                  $125.00
  Subtotal                  $585.80
  ⚠ Tax: not identified — set your tax rate in Settings     —
  Total (tax not included)  $585.80
```
Redlined line, amber, explicit. **Never a blank gap. Never $0.00 masquerading as "no tax." Never a
fabricated 8.25%.** (D-9 omit-not-fake, but LOUD — a redline, not a silent omission.)

**State 2 — rate SET, normal (`config.taxRate = 0.0825`):** `taxStatus = 'taxed'`, tax on the taxable
discounted subtotal.
```
  Subtotal                  $585.80
  Tax (8.25%)                $48.33
  Total                     $634.13
```

**State 3 — EXEMPT party/order (customer `tax_exempt = true`, reason `agricultural`, cert `AG-TX-88213`):**
`taxStatus = 'exempt'`, `tax = 0`, reason REQUIRED.
```
  Subtotal                  $585.80
  Tax exempt — Agricultural · cert AG-TX-88213     $0.00
  Total                     $585.80
```
Show-the-work about WHY the number is what it is, in all three states. The email (`cultivar.ts:57`) renders
the same three states from the same fields — the hardcoded `Tax (8.25%)` literal dies.

### C. REASON CODES (vertical-agnostic)

Shared constant list (string VALUES, AC-1 — not vertical nouns, not TS identifiers):

| code | label |
|---|---|
| `resale` | Resale / reseller certificate |
| `nonprofit` | Nonprofit (501(c)(3)) |
| `government` | Government / public entity |
| `agricultural` | Agricultural exemption |
| `other` | Other (free-text reason REQUIRED) |

Confirmed generic: a diesel shop (Ignition) has resale-exempt fleet buyers; a nonprofit buys from any
vertical; ag exemption spans nursery + equipment. `other` forces a free-text reason so the audit is never
empty. The set lives in `packages/shared` (a `taxExemption.ts` constant), owner picks from a dropdown.

### D. CAPTURE POINTS

1. **Rate** — Settings → Business Profile (the existing `tax_rate` field, `Settings.tsx:531`), repointed to
   write `config.taxRate` via `mergePricingConfig` and to **stop coercing blank → 0.0825** (blank = unset =
   redline). Surfaced in onboarding as a required-ish "set your tax rate (or mark none)" step so a new
   tenant is prompted, never silently defaulted.
2. **Party exemption (persistent)** — on the customer, alongside `price_tier`. The `/customers` roster
   inline-edit (the same surface where `price_tier` is set, `Customers.tsx`) gains an exempt toggle + reason
   dropdown + cert-ref field. Owner/manager gated. Setting it requires a reason (can't toggle exempt with no
   reason).
3. **Per-order override (with required reason)** — at checkout Review, an owner/manager can exempt THIS
   order (or un-exempt a standing exempt customer) — required reason + optional cert. Writes the `orders`
   exemption columns + the actor. This is the D-38-sibling per-transaction override of the persistent party
   attribute.

### E. RATE-UNSET BEHAVIOR (redline, exact)

- Computation: `taxRate` null → `taxStatus = 'not_identified'`, `tax = 0`, `total = discountedSubtotal`.
- Every surface renders an explicit **"⚠ Tax: not identified — set your tax rate in Settings"** line where
  the tax number would be, and labels the total **"Total (tax not included)."**
- **Never** renders `$0.00` on the tax line (reads as "no tax due" — a lie), **never** a blank, **never** a
  fabricated rate. Omit-not-fake (D-9) made LOUD. The owner is nudged to Settings from the redline.

### F. PERMISSION — exemption as a grantable, logged authority

- **New action permission `apply_tax_exempt`** declared in `packages/shared/src/auth/actionPermissions.ts`
  (the declare-here-and-union pattern) → appears as an assignable chip in the `/roles` console, default
  **OWNER + MANAGER**, STAFF none.
- **Server-enforced** in `submit.ts` the SAME way the leakage-override is: an exemption on an order is
  honored ONLY when `callerCanManageOrders` **AND** `callerHoldsPermission(auth, businessId,
  'apply_tax_exempt')`; the anon/public path can NEVER self-exempt (server ignores + `[TRACE:TAX]` logs the
  refusal — tamper defense, mirrors the discount-override refusal).
- **Logged:** who (`resolveCallerUid` → `orders.tax_exempt_by`), when, reason, cert. No silent tax removal.
- **Reconcile with the threaded apply_discount:** both are "authority to modify the money boundary." Two
  clean options for the build — **(i)** two sibling permissions `apply_tax_exempt` + `apply_discount`
  (granular), or **(ii)** one `adjust_pricing` authority covering both. **Recommend (i)** — a tax exemption
  (a legal/compliance act needing a cert) and a discount (a commercial concession) are audited differently
  and an owner may delegate one but not the other. Flag: whoever builds apply_discount should build it
  beside this so the two land as a matched pair, not divergent one-offs.

### G. RECONCILE against the corpus

- **D-37 (money boundary):** ✅ extends it. Tax is a CHARGE computation on the invoice, still **never payment
  processing** — the platform computes what's owed, does not move money. `accessTerms`/descriptive text stay
  un-charged.
- **D-38 (tier discount = party attribute invoked per-transaction):** ✅ exemption is the exact sibling —
  a persistent party property (`customers`), invoked per-transaction, with a per-order override. Same shape,
  different money effect (zero the tax vs discount the goods).
- **D-39 (goods/service line-kind seam):** ✅ taxability REUSES the seam — no new seam. AC-4 (settle
  line-kind once; discount AND tax both read `kind`).
- **AC-1:** ✅ nothing tenant/vertical-specific in shared — rate is per-tenant data, reason codes are string
  values, `serviceTaxable` is config. The hardcoded 8.25% literals die.
- **AC-4:** ✅ ONE `computeOrderPricing`, ONE line-kind seam, ONE tax state emitted, every surface renders it.
- **Warrants a NEW decision:** **YES → D-40.** It extends D-37/38/39 but adds genuinely new model (the three
  tax states + redline honesty, exemption-as-party-attribute, taxability-on-line-kind, the `apply_tax_exempt`
  authority). One-line statement at the top of this doc.

### H. SCOPE LINE

- **Level 1 (THIS design):** owner-ENTERED per-tenant rate + the three-state redline + party/per-order
  exemption with audited reason + the `apply_tax_exempt` authority. Vertical-agnostic spine.
- **Level 2 (OUT — future connector, explicitly not this build):** address-based tax-API lookup
  (auto-resolve rate + taxability by jurisdiction from a tax service). Named here so the Level-1 shapes leave
  room; NOT designed or built now.
- **12/12 function ceiling (§6 r11) — CONFIRMED: Level 1 needs ZERO new `api/` function.** It rides:
  - the EXISTING `submit.ts` (tax is already computed there — extend, don't add);
  - the EXISTING config accessors `readPricingConfig` / `mergePricingConfig` (rate);
  - the EXISTING Settings write path (rate) + the EXISTING customers write path (`Customers.tsx` inline
    edit, like `price_tier`) for the party exemption;
  - order columns written by the EXISTING submit create/update path.
  No new endpoint. (The two additive migrations — `customers` + `orders` exemption columns — are DDL, not
  functions, and don't touch the ceiling.)

---

## What the build prompt will need (not built here)

1. Extend `computeOrderPricing` (spine): `taxRate: number | null`, per-line `taxable`, `exemption` input →
   `taxStatus` + reason/cert outputs. Unit tests for all three states + the taxable-subtotal filter.
2. Shared `taxExemption.ts` (reason codes) + a shared rate accessor reading `config.taxRate`.
3. Repoint the ~5 rate readers (submit ×2 incl. the off-seam `handleUpdate`, CartReview, QBO, email) off
   `businesses.tax_rate`/literals onto the shared accessor + the `taxStatus` output. **Fold the off-seam
   `handleUpdate` tax (`submit.ts:761-763`) back through `computeOrderPricing`** so roster-edit tax stops
   drifting.
4. Two additive migrations (customers exemption; orders per-order exemption) — GATED, David applies +
   catalog-verifies (schema-verification gate).
5. `apply_tax_exempt` in `actionPermissions.ts` + the server gate in `submit.ts` + role-console chip.
6. Settings/onboarding rate capture (stop the blank→0.0825 coercion); `/customers` exemption edit; Review
   per-order override.
7. `[TRACE:TAX]` instrumentation ON (states resolved, exemption applied/refused, actor) — stays ON until
   owner-proven.

## STOP

No code, no migration, no writes beyond this doc. Awaiting David's approval of the model (esp. the two
decision forks: **rate home = config.taxRate jsonb vs nullable column**, and **per-order audit = orders
columns vs a compliance-record row**) before any build prompt.
