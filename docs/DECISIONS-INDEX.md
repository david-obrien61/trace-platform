# TRACE — DECISIONS INDEX (read first)

**Purpose:** ONE map of every decision-bearing doc so nobody re-derives what's already
settled. Before re-litigating a design question, look it up here → find its home → **ask
David to paste the right doc** rather than re-reasoning from scratch.

**Last updated:** 2026-07-13 (**D-42 (proposed) INVENTORY DECREMENT-ON-PAID (the Amazon model) — BUILDER-COMPLETE, migration
gated, owner-proof owed.** `qty` is decremented PER-UNIT + ATOMICALLY (via the new `adjust_inventory_qty` RPC — concurrency-safe,
guarded, cannot go negative) at ORDER-PAID/CONFIRMED (submit.ts §11), NOT at delivery; status DERIVES from qty (qty>0 → available,
qty<=0 → depleted — STD-011), replacing the coarse whole-lot flip to 'reserved' (which wrongly reserved a whole 45-lot on one sale
+ hid it from the dashboard count). Whole lifecycle coherent via ONE signed-delta RPC: create −n · edit ±(old−new) · delete/cancel
restore +n (guarded vs double-restore). Oversell surfaced (pre-flight INSUFFICIENT_STOCK + RPC guard), never a negative qty. UNBLOCKS
reconciliation (counted vs expected = last count − sold). `reorder_point` stub column added for the NEXT build (reorder threshold).
STD-011/STD-012/AC-3; ZERO new api-fn (the RPC is Postgres, not a Vercel fn — 12/12 held); verify exit 0 zero net-new. Home:
docs/decisions/2026-07-13-inventory-decrement-on-paid-D42.md. Migration `20260713_inventory_decrement_and_reorder.sql` (gated).
Ledger row #120. PRIOR: **D-41 (proposed) CUSTOMER / PARTY RECORD → standard entity-completeness — BUILDER-COMPLETE, migration
gated, owner-proof owed.** `customers` brought to the complete standard party record in ONE additive migration (15 cols:
org/display name · billing address as L1 columns [shipping is order-time on the delivery row; `customer_addresses` ship-to
book = deferred L2] · tax_id/expiry/cert-doc-slot · payment_terms/credit_limit · status/updated_at/notes) + a grouped
`CustomerPartyEditor`; roster stays lean; AC-1 (string values, no CHECK) · RLS inherits (AC-3) · STD-011/014 · BENCH-C
(tax_id/credit_limit PII value-masked in [TRACE:customers]). Closes the D-40 tax owner-prove blocker — exemption is now
UI-editable. Home: docs/decisions/2026-07-13-customer-party-record.md. Migration `20260713_customers_party_record.sql`
(gated). Ledger row #118. PRIOR: **D-40 TAX AS A SPINE CAPABILITY — APPROVED + BUILT (Level 1), owner-proof owed.** Tax is a
computed line on the shared money boundary (extends D-37): the RATE is per-tenant SUPPLIED DATA at
`business_pricing_config.config.taxRate` (via the new `resolveTaxRate` seam) — never platform-encoded jurisdiction
knowledge, never a hardcoded 8.25%; an unset rate renders a REDLINED "Tax: not identified" (never a fabricated number).
Level 1 = one origin-based rate (TX is origin-based for in-state sellers — legally correct). TAXABILITY rides the D-39
line-kind seam (per-line `taxable`, default all-taxable = prior behavior). EXEMPTION is a business-scoped PARTY attribute
on `customers` (mirrors price_tier/D-38, AC-3) invoked per-transaction + a per-order override on `orders`; zeroing tax
REQUIRES a recorded reason (+ optional cert) under the gated/logged `apply_tax_exempt` (matched-pair sibling of the new
`apply_discount`). Rounding stated ONCE (`round2(taxableSubtotal × rate)`) → Review === submit === QBO === email.
Repointed every rate reader off `businesses.tax_rate`/literals (incl. folding the off-seam handleUpdate tax back through
computeOrderPricing — closes the #107/#114 drift); killed `TAX_RATE_FALLBACK`/`TAX_RATE`; the hardcoded email "Tax
(8.25%)" DIES. TWO gated additive migrations (`customers`/`orders` exemption cols); ZERO new api-fn (12/12). Home:
docs/decisions/2026-07-13-tax-as-spine-capability-D40.md. Ledger row #117. PRIOR: D-39 REVIEW-SURFACE FIX + show-the-work display — implements D-39, NO new decision. The
Review page was computing with a 0% tier because the `orderTier` client snapshot was null on the CustomerCapture
checkout path → discount not applied → $1,646.48 vs QBO's correct $1,495.37. FIX (E1): Review now resolves the tier the
SAME way submit does — `invokedTier ?? customer.price_tier` against the fetched config (authoritative), with the
customer's `price_tier` carried on the client (attach OR a business-scoped email lookup in CustomerCapture, mirroring
submit's dedup); `orderTier` is a fast-path only. FIX (E2): submit RETURNS its authoritative per-line breakdown (no new
endpoint) and Confirmation renders THAT. Grouped display on both surfaces: retail lines → ONE discount line on the goods
subtotal → goods-after → services (not discounted) → discounted subtotal → tax → total. Industry-standard basis (§6 r16).
Ledger row #114. ZERO migration/api-fn (12/12). PRIOR: DISCOUNT LINE SCOPE recorded as D-39 + BUILT: the customer tier discount applies to
GOODS/inventory lines ONLY — service/labor lines are NEVER discounted; tax on the discounted subtotal; Review,
submit/QBO, and Confirmation all render from ONE shared `computeOrderPricing` (closes the Review-vs-QBO price
divergence) + show the work per line. Home: docs/decisions/2026-07-10-discount-line-scope.md. Ledger row #113.
Earlier same day: DISCOUNTS admin item BUILT — owner-named discount types × N tiers, per-tier basis
(retail-% | at-cost), relocated out of Cost-to-Produce to /discounts, toggle-gated AI_BI placeholder; implements
D-35/D-37/D-38 + margin-aware concept, NO new decision (see drift watch below). Earlier same day:
CONTRACTOR PRICING MODEL recorded as D-38: FLAT, owner-set tiers with MANUAL
promote/demote — no auto-progression / decay / cumulative-spend engine; the register→$4.99→earn-tier loyalty ladder
is ruled OUT (not deferred); a spend-based discount suggestion is ADVISORY-ONLY + owner-toggleable (surfaces, never
auto-applies). Home: docs/decisions/2026-07-10-contractor-pricing-model.md.
Earlier: MONEY BOUNDARY promoted to D-37: Cultivar computes charges on originated orders + grants
role-based access, never processes/collects/reconciles payment; access fees are owner-set descriptive config on the
business's own rail. Founding principle 'connect what they have, don't add a rail.' Home: docs/decisions/2026-07-10-money-boundary.md.
Earlier: DataSheet platform standards — TWO cross-cutting UI conventions in the shared `DataSheet<T>`
engine: system-managed fields display LOCKED-WITH-EXPLANATION [single canonical registry `systemManagedFields.ts`] +
horizontal scroll ALWAYS reachable [bounded box + sticky header + frozen identifier column]; recorded as CLAUDE.md §6 r13/r14,
NOT numbered D-## decisions. Earlier: Add Inventory modal — required `sell_price` [D-35 CRUD hole, nothing born unsellable] +
unit_cost editable [derives cost_confidence] + shared datasheet-add modals centered [convention A]; margin-aware signal
structure-only. Earlier: DROP `order_items.plant_id` — AC-1 de-noun of the shared order spine, D-36; the sole
line anchor is now `business_inventory_id`; closes story #231's "PLANTS (0)" bug class; gated DROP migration + 6 readers
repointed. Earlier: RECEIPT/QB-PREVIEW/LEAKAGE + tile-2.1 hardcoded SWEEP — QB preview order-backed, receipt
services by real name, real QB push dual-anchor, attributed price-override leakage [Ignition pattern + reason], all 8
tile-2.1 register items CLEARED → 2.1 restored 🟢; drift-watch added. Earlier: SETTINGS SERVICE EDITOR — expose all
service_offerings categories (+ transport) + un-conflate `price_type`/`price_unit` on create AND edit, category now editable,
category-scoped rule fields surfaced; NEW generic enum module `serviceOfferingEnums.ts`. Unblocks §4b's demo-data reshape.
Earlier: RESTORE transport/netting/decline workflow — added §4b CHECKOUT / ORDER-FLOW
WORKFLOWS with the canonical spec `docs/specs/SPEC-transport-netting-decline-workflow-2026-07-08.md`; drift-watch
updated. Earlier: PURCHASE-OFF-STOCK-LINE built — the D-34 drift row flipped from
"DECIDED (build owed)" to **BUILDER-COMPLETE (M2 GATED)**; earlier same day: D-34 "lot is the SKU"
promoted to a first-class entry; SELL-PRICE flipped OPEN→DECIDED as D-35. Created earlier same day —
DOCS-ONLY scan of `docs/decisions/*.md`, `docs/DECISIONS.md`, `MASTER_BRIEF.md`,
`DISCOVERY_MODULE_BRIEF.md`, `user_stories.md`, `docs/architecture/*`, `docs/cost-to-produce/*`,
all `*BRIEF*`/`*DECISION*`/`*FRAMING*`.)

**How this file stays honest:** it is a POINTER index — it names the home + one-line
what-it-decides + status. It never re-states a decision's substance (that's the home doc's
job). If code and a home doc conflict, **the code wins and the doc gets corrected**
(audit-wins rule). Status legend: **DECIDED** (settled + recorded) · **OPEN** (not yet
decided/recorded — needs David) · **SUPERSEDED** (replaced; kept for provenance) ·
**DRIFTED** (decided, but the code diverged — a build owed).

> ✅ **Drift watch (2026-07-13 · INVENTORY DECREMENT-ON-PAID — NEW decision D-42 (proposed)):** No drift.
> Built the missing per-unit inventory decrement at order-paid (submit.ts §11) — atomic via the new `adjust_inventory_qty` RPC,
> status derives from qty (replacing the whole-lot 'reserved' flip), whole lifecycle (create/edit/delete/cancel) coherent through
> ONE signed-delta RPC, oversell surfaced never negative. NEW decision **[[D-42]]** logged (home:
> `docs/decisions/2026-07-13-inventory-decrement-on-paid-D42.md`). Abided **STD-011** (qty = ONE canonical on-hand fact; status
> derives), **STD-012** (server-authoritative, atomic — no JS read-modify-write), **AC-3** (RPC business_id-scoped, service_role-only
> EXECUTE), **§6 r11** (the RPC is a Postgres function, NOT a Vercel api-fn — 12/12 held). ONE additive gated migration (reorder_point
> stub + RPC). UNBLOCKS reconciliation (counted vs expected = last count − sold). No prior decision contradicted.
>
> ✅ **Drift watch (2026-07-13 · STD-011 UI unification — Add + Edit customer render ONE component — implements D-41 + STD-011, no new decision):** No drift.
> The "Add Customer" form was the OLD flat 8-field form while "Edit customer" was the NEW grouped `CustomerPartyEditor` (15
> fields) — two canonical representations of one entity. Unified: `CustomerPartyEditor` gained `mode:'create'|'edit'` (create =
> empty + buffered + ONE insert via new shared `insertCustomer`; edit unchanged); the old flat Add form is RETIRED. Abided
> **STD-011** (ONE customer form after this — no second full form), **STD-013/D-40** (exempt requires a reason in BOTH modes),
> **BENCH-C** (tax_id/credit_limit masked in create too), **§6 r11** (NO new api-fn — create rides a client RLS insert; 12/12).
> No new decision (implements [[D-41]] + STD-011). NO migration (D-41 cols exist). No-regression bridge: the editor mirrors
> Billing → the legacy consumed `address_*` on save (both modes) until D-41 follow-up (b) repoints readers to `billing_*`.
> Ledger #119.
>
> ✅ **Drift watch (2026-07-13 · customer/party record → standard entity-completeness — NEW decision D-41 (proposed)):** No drift.
> Brought `customers` to the complete standard party record in ONE additive migration (15 cols: org/display name, billing
> address, tax_id/expiry/cert-doc-slot, payment_terms/credit_limit, status/updated_at/notes) + a grouped `CustomerPartyEditor`.
> NEW decision **[[D-41]]** logged (home: `docs/decisions/2026-07-13-customer-party-record.md`) — implements the STD-015
> party-model line. Abided **AC-1** (payment_terms/status are string VALUES, NO CHECK — mirrors customer_type/price_tier),
> **AC-3** (new cols inherit the customers RLS — NO new policy, D-40 precedent), **STD-011** (updated_at reuses the canonical
> `set_updated_at_generic()`; ONE PII-masking source), **STD-014** (status/updated_at defaults are universal, not fabricated
> per-tenant values), **BENCH-C** (PII — David's go; tax_id/credit_limit VALUE-MASKED in [TRACE:customers]), **§6 r11** (ZERO
> new api-fn — 12/12). ADDRESS = L1 (billing columns; shipping is order-time on the delivery row; customer_addresses = deferred
> L2). Closes the D-40 owner-prove blocker (tax fields now UI-editable). ONE gated additive migration. Ledger #118.
>
> ✅ **Drift watch (2026-07-13 · cultivar notification templates de-hardcoded — pure AC-1 correction, no new decision):** No drift.
> The shared cultivar notification templates (cultivar.ts) were fully LAWNS-hardcoded on a customer-facing surface (a
> confirmation email for "Test Dave's Tree Nest" read "Your LAWNS Tree Farm order is confirmed"). Fixed by genericizing
> the whole file to a NotifyBusiness active-business token (name/address/phone/email) via a chrome() helper; the caller
> (useSubmitOrder/CartReview) threads the business_id-scoped useBusinessContext().business; omit-not-fake rendering.
> Abided **AC-1** (no tenant literal remains in the shared module — this IS the correction), **AC-3** (identity from the
> active business_id-scoped context only), **[[D-9]]** (omit-not-fake, never a placeholder/wrong name). No decision, no
> schema/migration/api change (12/12). Register H12-H17 CLEARED — notification templates now in register scope. Ledger #116.
>
> ✅ **Drift watch (2026-07-13 · D-40 TAX AS A SPINE CAPABILITY — new decision, built Level 1):** No drift. NEW decision
> **[[D-40]]** logged (extends [[D-37]] money boundary; does not contradict it — tax is a CHARGE computation, still never
> payment processing). Abided **AC-1** (rate is per-tenant data, reason codes are string values, the hardcoded 8.25%/0.0825
> literals die), **AC-3** (exemption business-scoped on `customers`; rate per-active-business; anon path can never
> self-exempt), **AC-4** (ONE `computeOrderPricing`, ONE line-kind seam read by BOTH discount and tax, ONE tax state
> emitted, every surface renders it), **[[D-9]]** (rate-unset is a LOUD redline, exempt requires a reason — never a silent
> $0/removal), **[[D-38]]** (exemption mirrors the party-attribute-invoked-per-transaction pattern), **[[D-39]]**
> (taxability reuses the goods/service seam), **§6 r11** (ZERO new api-fn — 12/12 held), **§6 r16** (industry-standard-first:
> tax as a computed line, origin-based single rate stated on the record). Two GATED additive migrations only. Ledger #117.
>
> ✅ **Drift watch (2026-07-13 · service price-override write-constraint 500 fix — no decision touched):** No drift.
> Pure bug fix: submit 500'd on a manual service price override (order_service_selections.is_manual_override NOT-NULL
> violation) because overrideCols omitted the flag on non-override rows and PostgREST batch-insert NULLed them. Fixed by
> setting is_manual_override:false on non-override rows (truthful per-row). No decision, no schema/migration/api change
> (12/12). Pre-existing latent bug (1c13d46), NOT a D-39 regression — D-39 owner-prove status (#114) unaffected. Ledger #115.
>
> ✅ **Drift watch (2026-07-13 · D-39 Review-surface fix + show-the-work — implements D-39, no new decision):** No drift.
> The D-39 owner-prove FAILED on the Review surface (Review $1,646.48, discount not applied) even though QBO/submit were
> correct ($1,495.37). ROOT CAUSE: Review's tier came from the fragile `orderTier` client snapshot, which was null when
> the customer was entered at CustomerCapture → `RETAIL_FLOOR` → 0%. FIX (E1): Review resolves the tier the SAME way
> submit does — `invokedTier ?? customer.price_tier` against the fetched pricing config (authoritative), the customer's
> `price_tier` carried on the client (ScanOrder attach OR a business-scoped email lookup in CustomerCapture); `orderTier`
> is a fast-path only. FIX (E2): submit returns its authoritative per-line breakdown (rides the existing response — no new
> endpoint); Confirmation renders THAT (receipt === QBO by construction). GROUPED display on both surfaces (retail lines →
> ONE labeled discount line on the goods subtotal → goods-after → services "not discounted" → discounted subtotal → tax →
> total). Industry-standard basis recorded (**§6 r16**: server = single pricing authority; standard invoice/receipt
> presentation). Abided **[[D-39]]** (goods-only, tax on discounted subtotal, one shared computeOrderPricing), **AC-1**
> (generic goods/service), **AC-3**, **AC-4** (one authoritative resolution, both surfaces). ZERO migration, ZERO new
> api-fn (12/12). Home: `docs/specs/discount-show-the-work-presentation.md`. Ledger row #114.
>
> ✅ **Drift watch (2026-07-10 · DISCOUNT LINE SCOPE recorded as D-39 + built):** No drift — abided by **[[D-35]]**
> (tier math = % off the stored sell_price), **[[D-37]]** / **[[D-38]]** (unchanged). Decides + builds: the customer tier
> discount applies to **GOODS/inventory lines ONLY** — service/labor lines (placement, delivery, netting, add-ons) are
> NEVER discounted (an owner override on a service is attributed leakage, not a discount); **tax computes on the
> discounted subtotal**; and **Review, submit/QBO, and Confirmation all render IDENTICAL numbers from ONE shared
> `computeOrderPricing`** (pure, reuses `applyTierPrice`), closing the Review-vs-QBO price divergence (Review showed
> $124/each vs QBO's correct $115.20). The per-line breakdown (retail → discount → net) is SHOWN. Status **DECIDED**,
> numbered **[[D-39]]**. Home: `docs/decisions/2026-07-10-discount-line-scope.md`. **AC-1** (generic goods/service line
> kinds, no vertical noun), **AC-3**, **AC-4** (settle-once — one computation, every surface); ZERO migration, ZERO new
> api-fn (12/12). Closes MUST-FIX #1/#2 from the 2026-07-10 handover. Close-out ledger row #113.
>
> ✅ **Drift watch (2026-07-10 · DISCOUNTS admin item — build, no new decision):** No drift — abided by **[[D-35]]**
> (tier math = % off stored sell_price, never re-derived from cost), **[[D-37]]** (access terms are DESCRIPTIVE config,
> never charged by the platform), **[[D-38]]** (FLAT, owner-managed, MANUAL — N tiers is structure not auto-progression;
> the AI_BI slot is a toggle-gated ADVISORY placeholder that surfaces, never auto-applies), and the margin-aware concept
> (cost-vs-price basis + graceful degradation). The build RELOCATES discount config out of Cost-to-Produce into a
> standalone `/discounts` admin item, GENERALIZES it to owner-named types × N tiers with a per-tier basis
> (`retail_minus_percent` \| `at_cost`), and wires the toggle-gated AI_BI placeholder. **New mechanism, not a new
> decision:** the `at_cost` basis is the margin-aware concept's cost-basis (owner-set, no auto-logic) — implemented,
> not re-litigated. ZERO migration/api-fn (rides `business_pricing_config.config` jsonb additively), no auth change.
> Close-out ledger row #110.
>
> ✅ **Drift watch (2026-07-10 · CONTRACTOR PRICING MODEL recorded as a numbered decision — D-38):**
> Decides: contractor pricing is FLAT, owner-set tiers with MANUAL promote/demote — no auto-progression, decay, or
> cumulative-spend engine; the register→$4.99→earn-higher-tier loyalty ladder (recon R4 / story #8) is ruled OUT, not
> deferred; a spend-based "a discount tier might fit" prompt is ADVISORY-ONLY + owner-toggleable (surfaces, never
> auto-applies — SURFACE-THE-BETWEEN + owner-authority per D-9). Status **DECIDED**, numbered **[[D-38]]**. Relates
> **[[D-35]]** (tier math) + **[[D-37]]** (money boundary). Home: `docs/decisions/2026-07-10-contractor-pricing-model.md`.
> Constraints abided: **AC-1** (generic, no vertical noun), **AC-4** (owner-managed tier value-set grows without schema),
> docs-only (no schema/migration/code/api). Pointer only — substance lives in the home doc.
>
> ✅ **Drift watch (2026-07-10 · MONEY BOUNDARY promoted to a numbered decision — D-37):**
> Decides: Cultivar computes the charge on orders it ORIGINATES and grants role-based access (incl. discounted
> contractor ordering) but never processes/collects/reconciles payment for either — access fees are owner-set
> descriptive config on the business's own rail, not a platform transaction. Status **DECIDED**, numbered **[[D-37]]**.
> Home: `docs/decisions/2026-07-10-money-boundary.md`. Constraints abided: **AC-1** (decision text is vertical-noun-free),
> **AC-3** (business-scoped by construction), docs-only (no schema/migration/code/api — 12/12 untouched). Pointer only —
> substance lives in the home doc.
>
> ✅ **Drift watch (2026-07-09 · Contractor/tier pricing Layers 1+2 — D-35 AC-4 hold CLOSED):**
> No drift — this session CLOSES the open piece of **[[D-35]]** ("`price_tier` applies at checkout" — the AC-4 hold "tier math undefined") by DEFINING the math as **percent-off-baseline, owner-set per tier, default 0%** (recorded as a D-35 addendum, `docs/decisions/2026-07-09-tier-pricing-mechanism.md`), exactly the decided-going-in line from the recon. Abided by **AC-1** (tier names are generic jsonb DATA, no vertical noun), **AC-3** (business_id-scoped), **AC-4** (the hold it closes), **§6 rule 8/reuse-not-fork** (extracted the tier arithmetic to ONE shared `tierPricing.ts`, reusing MarginEngine's `PricingTier`; DELIBERATELY separate from cost-derived `calculateRetail`), **§6 rule 11 12-fn ceiling** (rides `submit.ts`, no new api/), **FIX 5** validation on the % inputs, **§6 rule 16** (money/tier-config UI = standard form/select). NO schema/migration (rides `business_pricing_config.config` jsonb). Layer 3 (contractor program) STORIED, out of scope — not built, not claimed.
>
> ✅ **Drift watch (2026-07-09 · DataSheet frozen-column fix — reserved track + freeze line + zero-left-gutter):**
> No drift — abided by **§6 rule 16 INDUSTRY-STANDARD-FIRST** (named the frozen/pinned-column standard = reserved track, scroll region begins at its right edge; implemented the sticky "approach (b)" the prompt sanctioned) and **§6 rule 14** (grid standard — extended in place, not forked), **§6 rule 8 / reuse-not-fork** (fixed in the ONE shared `DataSheet.tsx` engine → inventory/assets/customers inherit; 3 one-line consumer `frozenWidth` edits, no per-consumer copy). Corrects the #104/#105 frozen-column overlap ("Name covers SKU"). NO schema/migration/api-fn (12/12). Horizontal-scroll reachability + sticky header + system-field lock UNCHANGED (no regression). Process/standards fix, NOT a numbered D-## decision.
>
> ✅ **Drift watch (2026-07-09 · UI Control Standards spec + rendered compliance board + modal-centering residuals):**
> No drift — abided by **§6 rule 8 / reuse-not-fork** (the modal fixes flip the shared/own-copy sheet styles in place; no new control), **standard-by-value §6 r10** (adopted industry grid/modal/field patterns that earn their value for our scope; row-virtualization explicitly DEFERRED as gold-plating at 111 rows), and **D-9 Surface Honesty** (the compliance board seeds honestly — escape-to-close M3 + focus-trap M5 shown 🔴, backdrop M4 🟡; the gaps are ON the board, not silently claimed done). NO schema/migration/api-fn. Recorded **CLAUDE.md §6 rule 15** — the umbrella binding standard (`docs/standards/ui-control-standards.md`) that r13/r14 are clauses of; this SUPERSEDES the ad-hoc modal-centering / scroll-defect findings with ONE spec + a visible board (`/ui-standards.html`). Process/standards addition, NOT a numbered D-## decision. `customers.price_tier` still flagged edit-vs-lock (not decided). Convention-A "always center" now complete across all bottom-sheets (incl. the previously-unnamed ConflictDialog).
>
> ✅ **Drift watch (2026-07-09 · DataSheet platform standards — system-managed-field lock-with-explanation + horizontal-scroll):**
> No drift — abided by **§6 rule 8 / reuse-not-fork** (both standards land in the ONE shared `DataSheet<T>` control → inventory/assets/customers inherit; the system-managed set is a SINGLE canonical registry `systemManagedFields.ts`, the sole source for the lock rule — no per-consumer duplication), **D-9 Surface Honesty** (extended to editability: a system-write-only field is locked-WITH-explanation, never a silent-grey hidden edit; `cost_confidence`/`estimated_value_confidence` deliberately left editable because they carry a real override on the reconcile grids — honest about what IS editable), **AC-3** (no tenant-scope change), and the **12-function ceiling** (ZERO new `api/` file). NO schema/migration. Established **two new platform UI conventions** recorded as CLAUDE.md §6 rules 13 (system-managed display) + 14 (DataSheet horizontal-scroll) — process/standards additions, NOT numbered D-## decisions. `price_tier` flagged for a future edit-vs-lock decision (surfaced, not decided — no new numbered decision opened).
>
> ✅ **Drift watch (2026-07-09 · Add Inventory modal — required `sell_price` [D-35 CRUD hole] + unit_cost editable + centered):**
> No drift — abided by **D-35** (sell_price is stored on the stock line, DISTINCT from unit_cost, authoritative at
> checkout; the create form now sets it so nothing is born unsellable), **D-9 Surface Honesty** (unit_cost blank →
> honest UNKNOWN, never a fabricated $0; sell_price required > $0 rather than a downstream silent $0-refusal), the
> **FIX 5 validation pattern** (§6 rule 8 — copied the shared `errBorder`/`FieldError`/RED shape, rule-of-three not yet
> hit so a second copy is sanctioned, not a fork), the **12-function ceiling** (ZERO new `api/` file) and **AC-3**
> (business-scoped write). NO schema/migration (sell_price/unit_cost/cost_confidence all exist per D-35). Centering
> adopted **convention A** for the datasheet-add camp (shared `sheetStyles.modal` → centers Inventory/Customer/Asset).
> The margin-aware signal is structure-only (empty `marginSignalStyle` slot) — NOT built (design: `docs/concepts/margin-aware-pricing-intelligence.md`). No new numbered decision.
>
> ✅ **Drift watch (2026-07-09 · FIX 5 — service-editor required-field validation + forms/modals audit):**
> No drift — abided by the **12-function ceiling** (§6 r11 — ZERO new `api/` file), **AC-1** (validation is a generic
> quality primitive, no vertical noun), **§6 rule 8** (reused the shared `RED`, no color dup; the validation helpers
> are ONE shared shape other forms copy), **D-9 Surface Honesty** (blank ≠ free — a $0 service needs `0` typed, never
> a silent coercion), and the **story-reconciliation gate** (created the platform-validation ## NEEDED story since none
> existed). NO schema, NO migration, ONE file + audit doc. This satisfies §1.6 pre-flight items 3 (validation) + 5
> (modal centering) as a reference impl + a retrofit backlog. No new numbered decision.
>
> ✅ **Drift watch (2026-07-09 · DROP `order_items.plant_id` — AC-1 de-noun of the shared order spine, D-36):**
> No drift — abided by **AC-1** (removed the Cultivar vertical noun `plant_id` from the SHARED `order_items` table;
> `business_inventory_id` is the sole line anchor), **D-34** (the LOT is the SKU — the anchor), **§6 rule 8** (reused the
> ONE `orderItemName` resolver + repointed all 6 readers, no fork), and the **social_drafts.plant_id DROP precedent**
> (same template). Money/qty/reservation/leakage untouched — name-resolution only. ONE gated additive migration
> (`20260709_drop_order_items_plant_id.sql`, deploy-window-safe: code unread BEFORE drop); ZERO new api-fn (12/12 held).
> Scope fenced to bucket-A #1+#2 only — bucket-A #3 (`price_unit`) + #5 (QR util) remain HELD per David. New decision
> D-36 recorded. Closes story #231.
>
> ✅ **Drift watch (2026-07-08 · RECEIPT/QB-PREVIEW/LEAKAGE + tile-2.1 hardcoded SWEEP):** No drift — abided by
> **AC-1** (every business literal now resolves from the `businesses` row / `service_offerings.name`, no hardcoded
> tenant/vertical), **AC-3** (business-scoped reads), **D-9** (netting `?? 10` → real price; footer omitted not faked
> under anon RLS), **D-34** (dual-anchor naming reused via `orderItemName.ts`, 3rd reuse — not forked), **MB_D-015**
> (price override honored only on a token-verified owner/manager caller; public path server-authoritative + tamper-
> defended), and **§6 rule 12** (the anti-hardcoding TEETH — all 8 flagged tile-2.1 literals were CLEARED IN THE SAME
> PASS that touched them, restoring 2.1 🟡→🟢; not aged on a gap board). Mirrored Ignition's shipped leakage pattern
> (extract-don't-invent) + added a reason field. ONE gated additive migration (`20260708_service_override_leakage.sql`);
> ZERO new api-fn (12/12 held). No decision settled/deferred/superseded that conflicts.
>
> ✅ **Drift watch (2026-07-08 · build-spec pre-flight gate + hardcoded register + amber-cap rule — DOCS/board only):**
> No drift — this session added process TEETH, wrote no app code and no migration. Landed: (1) CLAUDE.md
> **§1.6 the 10-item build-spec pre-flight gate** (binding, folds into STEP 0 — story · hardcoded-register ·
> validation · CRUD-with-permissions · UI/modals · AC-1..4 · 12-fn ceiling · reuse-don't-fork · TRACE-stays-on ·
> money-safety; "not reconciled = not ready to fire"); (2) **`docs/decisions/HARDCODED-REGISTER.md`** — a living
> checklist of hardcoded literals tagged by owning capability (11 items, cross-ref'd to the receipt/QB/leakage
> recon, NOT duplicated); (3) CLAUDE.md **§6 rule 12** + the status board (`TRACE-SESSION-BOOTSTRAP.md` legend +
> `status.html` `parseBoard`) enforce **"🟢 = done AND no open hardcoded debt; a tile with register items is
> capped at amber."** Applied now: **2.1 QR Checkout dropped 🟢→🟡** (8 open items, led by the QB stub). Gives the
> anti-hardcoding rule the teeth the as-built §6 flag lacked (flagged-never-removed = why it exists). No decision
> settled/deferred/superseded that conflicts; these are new standing rules + a register.
>
> ✅ **Drift watch (2026-07-08 · #100 follow-up — order-detail "PLANTS (0)" fix):**
> No drift — abided by **D-34** (the dedicated `order_items` fetch names every line by the LOT/specimen
> dual anchor, reusing the same `orderItemName.ts` resolver Part A added — NOT forked), **AC-3** (the
> line-item query is `order_id`-scoped only after the orders query verified `.eq('business_id')`), and
> **§6 rule 8 / rule 11** (one resolver reused; ZERO new `api/` file, ZERO migration). No decision
> settled/deferred/superseded — this is a query FIX (a PostgREST nested-embed drop decoupled into a
> top-level query) within existing decisions. Completes the #100 roster drill-in (story MAPS-TO 2.1).
>
> ✅ **Drift watch (2026-07-08 · ORDER ROSTER CRUD + "Unknown plant" fix — as-built §7 gaps):**
> No drift — abided by **D-34** (the roster/drill-in name items by the LOT/specimen dual anchor — the same
> `business_inventory_id`-vs-`plant_id` anchor `submit.ts` writes), **D-35** (edit re-reads server-authoritative
> `sell_price`, refuses $0 per line — never `unit_cost`, never a fabricated total), **AC-3** (every CRUD query
> `business_id`-scoped + verifies order ownership), **MB_D-015 write-authority ≥ read-authority** (edit/delete/status
> are token-gated server-side — owner by `owner_id` OR `manage_orders` via `has_permission` — the same write-wall
> pattern as cost-apply; staff can't edit even though the roster is `qr_checkout`-visible), and **§6 rule 11 / 12-fn
> ceiling** (ZERO new `api/` file — CRUD rides `submit.ts` via an `action` param). No prior decision settled/deferred/
> superseded. **TWO NEW open decisions logged (PART 3):** R-QBSTALE (an edited order surfaces QB-invoice staleness —
> auto re-sync vs the banner is David's call) + R-STATUS (ratify the minimal `pending→confirmed→fulfilled→cancelled`
> enum + whether cancel should auto-release inventory). Satisfies story MAPS-TO 2.1 roster sub-stories.
>
> ✅ **Drift watch (2026-07-08 · CHECKOUT FIX-PASS — search lookup + centered modal + conditional required address/phone + owner delivery-date):**
> No drift — abided by **AC-1** (the new shared `searchStockLines` names only `business_inventory`, no vertical noun —
> same agnostic resolver family as `resolveStockLine`), **AC-3** (search + all reads are `business_id`-scoped), **D-9
> Surface Honesty** (a delivery order can no longer be placed with a blank ship-to — the requirement is READ from the
> owner-set `service_offerings.requires_address` / staff shape, not hardcoded), **§6 rule 11 / 12-fn ceiling** (ZERO new
> `api/` file — the delivery-date write rides the existing `submit.ts`), and the **gated-migration discipline**
> (`orders.delivery_date` doesn't exist → GATED `20260708_orders_delivery_date.sql`, David applies as postgres; NOT
> hand-migrated; `submit.ts` deploy-window-safe fallback). No decision was settled/deferred/superseded — these are FIXES
> within existing decisions (D-34 anchor · D-35 sell_price · D-9 · AC-1/AC-3) and satisfy story MAPS-TO 2.1. NEW gap
> sub-story logged on the board (template-driven service setup, needs-input) — a surfaced NEED, not a decision.
>
> ✅ **Drift watch (2026-07-08 · SETTINGS SERVICE EDITOR — categories + un-conflate price_type/price_unit, create+edit):**
> No drift — abided by **AC-1** (the category / price_type / price_unit / transport_mode option lists are the GENERIC
> schema enums, sourced from the migration column CHECKs into ONE shared `serviceOfferingEnums.ts`; no vertical noun — a
> vertical supplies service ROWS, never enum members), **AC-3** (owner-fenced `service_offerings` RLS unchanged; writes
> scoped to the active business_id), **§8 configuration philosophy** (owner can now shape any service entirely in the UI:
> the fields are available, visible, and propagate immediately — no migration), **D-9 Surface Honesty** (prices are
> OWNER-SET and always editable; the editor invents no number, and moving a service between categories clears the rule
> fields that no longer apply so no stale/mis-charging rule lingers), **§6 rule 11 / 12-fn ceiling** (ZERO new `api/`
> file — rides the existing insert/update; ZERO migration — every column already exists). This is the "separate
> Settings-editor task" §4b/ROW #97 named — it UNBLOCKS the restored transport/netting workflow's demo-data reshape.
>
> ✅ **Drift watch (2026-07-08 · RESTORE transport/netting/decline workflow + canonical spec):** No drift — this
> RESTORES the May-18 proven workflow (recovered from git `0897e00`/`5aeff86`/`8764b39`/`0041769`) onto the current
> service_offerings model and gives it a canonical spec home (docs/specs/SPEC-transport-netting-decline-workflow) so it
> is never re-derived — a NEW retrievable decision (added §4b), not a re-litigation. Abided by **AC-1** (transport/netting
> generic; Ch.725 copy lives in the row's `compliance_title`/`compliance_body`, not code), **AC-3** (business_id-scoped
> reads + business-scoped decline rows), **D-9 Surface Honesty** (delivery+planting read as TWO correctly-ruled services;
> when the two rows aren't both present the workflow FLAGS + best-efforts, never silently mischarges — data reshape is the
> separate Settings-editor task, not hand-migrated here), **§6 rule 8** (the per-branch attach math reuses the ONE shared
> `netting.ts` engine for both display and charge), **§6 rule 11 / 12-fn ceiling** (ZERO new `api/` file — rides
> `submit.ts`; ZERO migration). The decline-capture (orders.netting_declined + immutable order_compliance_records) is
> preserved from the proven build.
>
> ✅ **Drift watch (2026-07-08 · TWO owner-prove-surfaced bug fixes — profile cost-leak + QBO-absent crash):** No drift —
> abided by the **cost wall / D-9 Surface Honesty** (the customer-facing profile now shows `sell_price`, NEVER `unit_cost`;
> `unit_cost` stays only on view_costs owner surfaces; null/0 → honest "Not set", never $0, never cost) and **D-9 fail-loud-not-
> silent** (a QBO failure degrades to an honest "invoice will follow" confirmation with `[TRACE:CHECKOUT]`, never a blank crash).
> **AC-3** (business_id-scoped reads unchanged). ZERO new `api/` file (12/12 held), ZERO schema. Surfaced R3 as a design flag for
> David (pay-at-office fires the QBO call on both pay paths) — flagged, not decided; crash-proof regardless.
>
> ✅ **Drift watch (2026-07-08 · MULTI-ITEM SCAN-LOOP CART + NETTING build):** No drift — abided by **D-34**
> (each cart line reuses the proven per-line `stock_line_id`/`plant_id` anchor branch — extended to loop N,
> not forked), **Item-1 sell_price** (D-35: cart reads `sell_price`, server-authoritative per line, $0 refused
> naming the item — no cost leak), **D-9 surface-not-silent** (the netted itemization is PROPOSED and
> owner-adjustable in CartReview before submit — Regina Principle; nothing silently applied), **AC-3**
> (every resolve/read/write business_id-scoped), **§6 rule 8** (extracted `synthesizePlant`+`anchorKey`,
> `extractTag`, and the attach-rule `nettedQuantity`/`lineSubtotal` into ONE shared definition each —
> client display + server charge import the same rule so they can't drift; QrScanner + `resolveStockLine`
> reused from walk-and-count, not rebuilt), **§6 rule 11 / 12-fn ceiling** (ZERO new `api/` files — the
> order write rides the existing `submit.ts`, generalized to loop lines). No new schema — the per-order vs
> per-plant attach-rule already lived on `service_offerings.price_type`/`price_unit` (recon R1–R5). The
> quantity-bearing-with-spec class (fertilizer "5 × 30gal each") is DEFERRED, seam left untouched, no spec
> column added.
>
> ✅ **Drift watch (2026-07-07 · PURCHASE-OFF-STOCK-LINE build):** No drift — abided by **D-34** (purchase
> anchors to the `business_inventory` stock line, `cultivar_plants` identity-only — this closes the DRIFTED
> code, does not re-decide), **AC-1** (the extracted `resolveStockLine` is agnostic — names only
> `business_inventory`, no `cultivar_` noun; the vertical `cultivar_plants` L1 lane stays in the callers),
> **AC-3** (every resolve/read/write business_id-scoped), **§6 rule 8** (ONE shared resolver + one
> `detectSizeCollision`, consumed by both InventoryCount and usePlant — not a second copy). M2 GATED (order_items
> stock-line anchor). **#72 count size-picker byte-identical (no regression); a quick re-owner-prove recommended,
> expected to hold.** Item 2 of the inventory→sale spec is BUILDER-COMPLETE. *(Prior 2026-07-07 lines preserved below.)*
> ✅ **Drift watch (2026-07-07 · SELL_PRICE build):** No drift — abided by **D-34** (price lives on
> the stock line, not per-specimen), **D-35** (built exactly: stored `sell_price` DISTINCT from
> `unit_cost`, cart reads sell_price never unit_cost, MarginEngine only suggests), **AC-1** (sell_price
> on the agnostic `business_inventory`, no `cultivar_` noun), **AC-3** (every read/write business_id-scoped),
> **Surface Honesty / D-9** ($0/null sale REFUSED server+client, never silently charged $0). Item 1 of the
> inventory→sale spec is BUILDER-COMPLETE (M1 migration GATED — David applies). **STEP 5 tier math HELD, not
> drift:** the `price_tier`→adjustment mechanism is undefined and taxonomies don't match (customers
> retail/contractor/wholesale ≠ Cost-to-Produce walk-in/friends-family/contractor), so per **AC-4** (settle-once,
> don't guess) the read is wired + TRACE-logged but NO adjustment applied — surfaced to David for a decision.
> *(Prior 2026-07-07 line — D-34/D-35 recording + spec — preserved below.)*
> ✅ **Drift watch (2026-07-07 · decisions + spec):** No drift — this session (record D-34 lot-is-the-SKU + D-35
> sell_price-on-stock-line, then write the consolidated inventory→sale build spec) stayed
> strictly within the settled decisions: D-34 promotes an already-settled 2026-06-13 decision
> to a first-class entry (no new call), D-35 resolves a genuinely-OPEN question David decided
> this pass, and the spec only sequences work FROM those decisions (no code, no schema written).
> The close-out rule (CLAUDE.md §9) updates THIS line every session: "✅ No drift — abided by …"
> or "⚠️ DRIFT — went outside #Z: [what/why]". status.html renders this line as a banner on the
> 📇 Decisions panel (green = clean, red = drift).

---

## 1. THE CANONICAL LEDGERS (start here)

| Ledger | What it holds | Path |
|---|---|---|
| **DECISIONS.md** | The living decision ledger — **D-1…D-33** (product/architecture decisions) + **OP-1…OP-12** (operating principles). The single home for anything not frozen. | [docs/DECISIONS.md](DECISIONS.md) |
| **Architecture Constants (AC-1…AC-5)** | The non-negotiable structural rules (no vertical nouns in shared schema · RLS scoped to `business_id` · absolute tenant isolation · structural design shared/tokens vary · one-integration-one-connector). | [PLATFORM_STRATEGY.md](../PLATFORM_STRATEGY.md) § Architecture Constants (summaries in [CLAUDE.md](../CLAUDE.md) §1.5) |
| **MASTER_BRIEF — MB_D-001…MB_D-015** | **FROZEN** decision log (strategy/revenue-era). Nothing new goes here; every decision since MB_D-015 lives in DECISIONS.md. | [MASTER_BRIEF.md](../MASTER_BRIEF.md) |
| **CLOSE-OUT-LEDGER.md** | Per-build completion state (BUILDER-COMPLETE vs OWNER-PROVEN, SHA, what live test closes it). Answers "is it closed?" not "was it decided?". | [docs/CLOSE-OUT-LEDGER.md](CLOSE-OUT-LEDGER.md) |
| **built-inventory.md** | Flat catalog of what's BUILT (capability ledger). Answers "was X built?". | [docs/built-inventory.md](built-inventory.md) |
| **TRACE-SESSION-BOOTSTRAP.md** | The status front-page (⚡ ACTIVE STATUS · 📋 24-board · 🧵 ARC-MAP · 📚 CAPTURE INDEX). Answers "what's the current state?". | [TRACE-SESSION-BOOTSTRAP.md](../TRACE-SESSION-BOOTSTRAP.md) |
| **HARDCODED-REGISTER.md** | Living checklist of hardcoded tenant/vertical literals that should be data (AC-1), tagged by owning capability. A tile with any OPEN item is CAPPED AT AMBER (CLAUDE.md §6 rule 12 + §1.6 gate item 2). Answers "what fake/leaked literals block this tile from green?". | [docs/decisions/HARDCODED-REGISTER.md](decisions/HARDCODED-REGISTER.md) |
| **Build-spec pre-flight gate (§1.6)** | The 10-item binding checklist every build spec reconciles (scoped to touched files) before firing: story · hardcoded-register · validation · CRUD-with-permissions · UI/modals · AC-1..4 · 12-fn ceiling · reuse-don't-fork · TRACE-stays-on · money-safety. "Not reconciled = not ready to fire." | [CLAUDE.md](../CLAUDE.md) §1.6 |

---

## 2. INVENTORY / SIZE / LOT / QR — the model most re-litigated

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **Inventory size model = B-clean** | One `business_inventory` row per **variety × size**; `size text` (grower's own value, no CHECK) + `variant_group text` (parent product slug). Migration `20260628_inventory_size_variants.sql` (applied). | [docs/decisions/2026-06-27-discovery-size-variants.md](decisions/2026-06-27-discovery-size-variants.md) (pick recorded at line 64); build state in [2026-07-07-size-variant-build-state-recon.md](decisions/2026-07-07-size-variant-build-state-recon.md) | 2026-06-27 | **DECIDED** |
| **D-34** Lot-level history, "the lot is the SKU" | LAWNS tracks **lots (qty-of-SKU)** via `business_inventory`, **not individual organisms**; history attaches to the variety/lot. `cultivar_plants` demoted to vertical-IDENTITY-only. | [docs/DECISIONS.md](DECISIONS.md) D-34 (promoted from the migration header) + [supabase/migrations/20260613_cultivar_plants_untangle.sql](../supabase/migrations/20260613_cultivar_plants_untangle.sql) (lines 4–11) + design in [docs/architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md](architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md) | 2026-06-13 (recorded as D-34 2026-07-07) | **DECIDED** |
| **D-42** Inventory decrement-on-paid (the Amazon model) | `qty` decremented per-unit + atomically at ORDER-PAID/CONFIRMED (submit.ts §11), NOT at delivery; status DERIVES from qty (available/depleted), replacing the whole-lot 'reserved' flip; one signed-delta RPC (`adjust_inventory_qty`) serves create/edit/delete/cancel; oversell surfaced never negative. Adds `reorder_point` stub (next build = reorder threshold). UNBLOCKS reconciliation. | [docs/decisions/2026-07-13-inventory-decrement-on-paid-D42.md](decisions/2026-07-13-inventory-decrement-on-paid-D42.md) + migration `20260713_inventory_decrement_and_reorder.sql` (gated) | 2026-07-13 | **PROPOSED** (builder-complete; migration gated; owner-proof owed) |
| **Three-layer inventory model (item → size class → stock line) + lifecycle-stages-as-events** | Catalog item → size class → countable stock line; lifecycle stages modeled as events on the lot. | ⚠️ **No single dedicated doc found.** Realized across the B-clean size decision (variety×size rows) + the June-13 lot=SKU untangle; lifecycle/stages-as-events design captured in [docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md](cost-to-produce/COST-TO-PRODUCE-DESIGN.md) §5.3/§5.9 (project→product lifecycle, season-end event on each lot). The "June 5" framing appears to be **chat-origin, not a repo doc** — see PART 2 flag. | June 5 (framing) / 2026-06-13–27 (realized) | **DECIDED (scattered)** |
| **QR resolves to VARIETY (bare-domain QR), size is a pick-step** | A pot's QR encodes `${baseUrl}/plant/${tag_id}` → public `/plant/:tagId` page → resolves the variety; size is chosen at count/checkout time (the count-side size-picker). | [docs/decisions/2026-06-26-grower-resolve-design.md](decisions/2026-06-26-grower-resolve-design.md) + [walk-and-count-inventory-verify-first.md](decisions/walk-and-count-inventory-verify-first.md); front-door path in [2026-07-07-qr-order-front-door-recon.md](decisions/2026-07-07-qr-order-front-door-recon.md) | 2026-06-21 / 26 | **DECIDED** |
| **Count-side size-picker (L5 NEED_CLARIFICATION seam)** | Same-name multi-size scan → size-picker → routes to the exact per-size lot (owner-proven on iPhone). | [docs/decisions/2026-06-27-discovery-size-variants.md](decisions/2026-06-27-discovery-size-variants.md) + CLOSE-OUT-LEDGER #72 | 2026-06-30 | **DECIDED (OWNER-PROVEN)** |
| **Grower-resolve L4 (name token-set equality)** | Scan-slug tokens == catalog NAME tokens (order-insensitive) → resolve; >1 → UNKNOWN, never auto-pick. | [docs/decisions/2026-06-26-grower-resolve-design.md](decisions/2026-06-26-grower-resolve-design.md) | 2026-06-26 | **DECIDED (OWNER-PROVEN)** |
| **Discovery captures WooCommerce size variants** | Deterministic `extractSizeVariants(rawHtml)` — variation-form JSON primary, `<select>` fallback; write one row per (variety×size). | [docs/decisions/2026-06-27-discovery-size-variants.md](decisions/2026-06-27-discovery-size-variants.md) | 2026-06-27/28 | **DECIDED** |
| **Local-storage vocabulary** | Clarifies inventory/count storage vocabulary. | [docs/decisions/2026-07-01-local-storage-vocabulary-clarification.md](decisions/2026-07-01-local-storage-vocabulary-clarification.md) | 2026-07-01 | **DECIDED** |
| **Schema stress-battery (business_inventory)** | Adversarial identity-model stress cases; CASE-5 dup-size hardening at populate write time. | [docs/decisions/2026-06-30-schema-stress-battery-findings.md](decisions/2026-06-30-schema-stress-battery-findings.md) | 2026-06-30 | **DECIDED** |
| **Live schema map (inventory/orders/customers)** | Authoritative per-column snapshot of the live tables (the version-control gap, tech-debt #39). | [docs/decisions/2026-07-07-live-schema-map.md](decisions/2026-07-07-live-schema-map.md) | 2026-07-07 | **RECON (reference)** |

---

## 3. COST-TO-PRODUCE / PRICING / MARGIN

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **D-1** Cost-object node model — rename-in-place (approach C) | `business_assets`→`cost_objects` unified node table. | [docs/DECISIONS.md](DECISIONS.md) D-1 (+ [docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md](cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md)) | 2026-06-15 | **DECIDED** |
| **D-4** Two edge tables | Structural (`cost_object_edges`) vs temporal (`cost_object_assignments`). | [docs/DECISIONS.md](DECISIONS.md) D-4 | 2026-06 | **DECIDED** |
| **D-5** Cost event is truth; receipt = signal + substantiation | We surface, don't reconcile. | [docs/DECISIONS.md](DECISIONS.md) D-5 | 2026-06-13 | **DECIDED** |
| **D-8** Cost usage-coupling shape | RECURRING-FIXED vs PER-OCCASION. | [docs/DECISIONS.md](DECISIONS.md) D-8 | 2026-06-13 | **DECIDED** |
| **D-9** The honesty contract | KNOW / THINK / REASON / NEED-CLARIFICATION; acceptance is the pivot. | [docs/DECISIONS.md](DECISIONS.md) D-9 | 2026-06-13 | **DECIDED** |
| **D-10** Cost-to-Produce primary lens = BY PROJECT | Not a flat business pool. | [docs/DECISIONS.md](DECISIONS.md) D-10 + [docs/DECISION-project-lens-ui-design.md](DECISION-project-lens-ui-design.md) | 2026-06-16 | **DECIDED** |
| **D-11** Cost Category dimension = Schedule C / QBO-mappable | Adopt the standard, don't invent. | [docs/DECISIONS.md](DECISIONS.md) D-11 + [docs/DECISION-cost-category-dimension.md](DECISION-cost-category-dimension.md) | 2026-06-18 | **DECIDED** |
| **D-12** Labor cost model | Robust schema now, UI depth incremental. | [docs/DECISIONS.md](DECISIONS.md) D-12 + [docs/DECISION-labor-cost-model.md](DECISION-labor-cost-model.md) | 2026-06-18 | **DECIDED** |
| **D-13** Unified margin store + history | **DEFERRED** (future cross-vertical arc). | [docs/DECISIONS.md](DECISIONS.md) D-13 + [docs/DECISION-unified-margin-store-and-history.md](DECISION-unified-margin-store-and-history.md) | 2026-06-18 | **DEFERRED** |
| **D-14** Cost attribution follows consumption | Shared cost flows by use-fraction carve-out. | [docs/DECISIONS.md](DECISIONS.md) D-14 + [docs/DECISION-cost-attribution-and-shared-cost.md](DECISION-cost-attribution-and-shared-cost.md) | 2026-06 | **DECIDED** |
| **D-15** Cost object = compressed industry-standard cost record | Adopt/deviate/add/skip, each logged. | [docs/DECISIONS.md](DECISIONS.md) D-15 + [docs/DECISION-cost-object-model-of-record.md](DECISION-cost-object-model-of-record.md) | 2026-06-18 | **DECIDED** |
| **D-16** Pricing = COST-TO-SERVE + separate payback line (Model B) | Not fully-loaded cost. | [docs/DECISIONS.md](DECISIONS.md) D-16 + [docs/DECISION-pricing-model.md](DECISION-pricing-model.md) | 2026-06-19 | **DECIDED** |
| **D-17** One pricing engine, four display surfaces, three audiences | Prospects never see owner economics. | [docs/DECISIONS.md](DECISIONS.md) D-17 + [docs/DECISION-pricing-display-surfaces.md](DECISION-pricing-display-surfaces.md) | 2026-06 | **DECIDED** |
| **D-18** Platform overhead hand-allocated across verticals | Platform = computed remainder, guarded at 100%. | [docs/DECISIONS.md](DECISIONS.md) D-18 + [docs/DECISION-platform-overhead-carveout.md](DECISION-platform-overhead-carveout.md) | 2026-06 | **DECIDED** |
| **D-19** Three cost layers; the hidden third = OPPORTUNITY COST | The cost of pulled labor. | [docs/DECISIONS.md](DECISIONS.md) D-19 | 2026-06 | **DECIDED** |
| **Unified cost model (Option 2) / small-business accounting model** | Cost-NATURE (CapEx/COGS/OpEx) × PROJECT × SHAPE tagging. | [docs/DECISION-unified-cost-model-option2.md](DECISION-unified-cost-model-option2.md) + [docs/DECISION-small-business-cost-accounting-model.md](DECISION-small-business-cost-accounting-model.md) | 2026-06-17 | **DECIDED** |
| **Nested projects + BI what-if blocker** | Future arc — build when real. | [docs/DECISION-nested-projects-and-BI-whatif-blocker.md](DECISION-nested-projects-and-BI-whatif-blocker.md) | 2026-06 | **DEFERRED** |
| **D-35** Sell price stored on the stock line | `business_inventory.sell_price` (stored, editable, authoritative) DISTINCT from `unit_cost`; MarginEngine suggests but the stored price governs; cart reads `sell_price`, refuses $0; `price_tier` applies at checkout. Industry-standard variant pricing (Shopify/Square/WooCommerce). | [docs/DECISIONS.md](DECISIONS.md) D-35 + [docs/decisions/2026-07-09-tier-pricing-mechanism.md](decisions/2026-07-09-tier-pricing-mechanism.md) (tier math addendum) + build items in [docs/decisions/2026-07-07-inventory-sale-pipeline-buildspec.md](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) item 1 | 2026-07-07 (tier math 2026-07-09) | **DECIDED** · item 1 BUILDER-COMPLETE (M1 migration GATED; datasheet column + cart repoint + $0-refusal built; **tier math CLOSED 2026-07-09 — percent-off-baseline, owner-set; `applyTierDiscount` + config Block 5 + editable customer tier; owner-proof owed**) |
| **D-41 (proposed)** Customer/party record → standard entity-completeness | Bring `customers` to the complete standard party record in ONE additive migration (identity org/display name · **billing** address as L1 columns — **shipping is order-time on the delivery row, NOT a customer attribute; `customer_addresses` saved ship-to book = deferred L2**) · tax_id/expiry/cert-doc-slot · payment_terms/credit_limit · status/updated_at/notes) + a grouped `CustomerPartyEditor`; roster stays lean; closes the D-40 tax owner-prove blocker (tax fields UI-editable). AC-1 (string values, no CHECK) · RLS inherits (AC-3) · STD-011/014 · BENCH-C (PII masked). Implements the STD-015 party-model line. | [docs/decisions/2026-07-13-customer-party-record.md](decisions/2026-07-13-customer-party-record.md) + migration `20260713_customers_party_record.sql` (APPLIED + A-F verified) | 2026-07-13 | **DECIDED · BUILDER-COMPLETE (migration APPLIED 2026-07-13; UI owner-proof owed) — confirm DECISIONS.md head then assign D-41** |

---

## 4. PLATFORM ARCHITECTURE / IDENTITY / NAV / DISCOVERY / RESIDENCE

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **D-31** Platform DB + spine-first architecture | One platform database (80/20); Ignition retires onto the shared spine. | [docs/DECISIONS.md](DECISIONS.md) D-31 | 2026-07 | **DECIDED** |
| **D-21** Screen real estate is sacred | Direct access over scroll (platform-wide design law). | [docs/DECISIONS.md](DECISIONS.md) D-21 | 2026-06 | **DECIDED** |
| **D-22** Admin = business-entity config; Settings = user-self | The nav gating axis. | [docs/DECISIONS.md](DECISIONS.md) D-22 | 2026-06 | **DECIDED** |
| **D-23** FAITHFUL vs CONNECTED | One source, two renders, default faithful. | [docs/DECISIONS.md](DECISIONS.md) D-23 | 2026-06 | **DECIDED** |
| **D-24** RIGID SPINE / FLEXIBLE EDGE | The per-field decision rule (the disciplined blob). | [docs/DECISIONS.md](DECISIONS.md) D-24 | 2026-06 | **DECIDED** |
| **D-25** Intelligence tiers | Tier 0 (world knowledge) gives day-one value pre-data. | [docs/DECISIONS.md](DECISIONS.md) D-25 | 2026-06 | **DECIDED** |
| **D-26** The dual lexicon ("Happy Hose") | Speak trade + owner language, translate between. | [docs/DECISIONS.md](DECISIONS.md) D-26 | 2026-06 | **DECIDED** |
| **D-30** Shared-device authentication | Three flavors; face-swap preferred; face-recognition do-not-build. | [docs/DECISIONS.md](DECISIONS.md) D-30 | 2026-07 | **DECIDED** |
| **D-32 / D-33** Discovery — gap vs deliberate business decision | Not every absence is an opportunity; FIX = Option A (scoped, post-demo). | [docs/DECISIONS.md](DECISIONS.md) D-32/D-33 | 2026-07-07 | **DECIDED (build deferred)** |
| **D-27 / D-28 / D-29** Residence Product ("Kitchen Loop") + API neutrality + offline gradient | Residence = residence-scoped VIEW of the one shared engine; API neutrality Green/Red/Amber; offline capture always works, parses on sync. | [docs/DECISIONS.md](DECISIONS.md) D-27–29 + [docs/residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md](residence-product/RESIDENCE-PRODUCT-MASTER-BRIEF.md) + [HOUSEHOLD-SHARING-DECISION.md](residence-product/HOUSEHOLD-SHARING-DECISION.md) | 2026-07-03 | **DECIDED** |
| **D-31 spine — member/device/role console** | Agnostic console; role-floor seed; nav-integrity guard. | CLAUDE.md HANDOFF 2026-07-06 + CLOSE-OUT-LEDGER #86–92 | 2026-07-06 | **DECIDED (OWNER-PROVEN)** |
| **Role financial permissions** | Which roles see cost/margin (the moat). | [docs/decisions/2026-06-21-role-financial-permissions.md](decisions/2026-06-21-role-financial-permissions.md) | 2026-06-21 | **DECIDED** |
| **Grower import + mobile roles** | Import path + mobile role model. | [docs/decisions/2026-06-21-grower-import-and-mobile-roles.md](decisions/2026-06-21-grower-import-and-mobile-roles.md) | 2026-06-21 | **DECIDED** |
| **Vercel 12-function ceiling** | STOP-and-surface; reuse existing endpoints before minting #13. | [docs/decisions/2026-06-20-vercel-function-ceiling-mitigation.md](decisions/2026-06-20-vercel-function-ceiling-mitigation.md) | 2026-06-20 | **DECIDED** |
| **Discovery module** | The discovery capability brief. | [DISCOVERY_MODULE_BRIEF.md](../DISCOVERY_MODULE_BRIEF.md) | — | **REFERENCE** |
| **Canonical layer definitions** | shared/vertical/platform code layers + placement authority. | [docs/architecture/LAYER-DEFINITIONS.md](architecture/LAYER-DEFINITIONS.md) | 2026-06-14 | **DECIDED** |
| **AC-1…AC-5** Architecture Constants | Non-negotiable structural rules (see §1). | [PLATFORM_STRATEGY.md](../PLATFORM_STRATEGY.md) / [CLAUDE.md](../CLAUDE.md) §1.5 | — | **DECIDED (locked)** |

---

## 4b. CHECKOUT / ORDER-FLOW WORKFLOWS

| Decision / Topic | What it decides (one line) | Doc + path | Date | Status |
|---|---|---|---|---|
| **Transport / netting / decline workflow** | Transport is a single-select 3-branch radio — (1) Delivery + planting = delivery (flat ×1) + planting (per_unit ×N); (2) Delivery only = delivery (flat ×1); (3) No thank you (self) = no charge + netting/tarp offer with red-border Ch.725 compliance prompt; a decline is CAPTURED (orders.netting_declined + order_compliance_records). Originally built + owner-proven May-18; regressed by the multi-item rewrite; restored 2026-07-08. Reads delivery + planting as TWO correctly-ruled `service_offerings` rows (FLAGs if not present; data reshape is the separate Settings-editor task). ZERO migration, ZERO new `api/` file. | [docs/specs/SPEC-transport-netting-decline-workflow-2026-07-08.md](specs/SPEC-transport-netting-decline-workflow-2026-07-08.md) | 2026-05-18 (built) / 2026-07-08 (restored) | **DECIDED** · restored BUILDER-COMPLETE (owner-proof owed) |

---

## 5. OPERATING PRINCIPLES (how we work) — OP-1…OP-12

All live in [docs/DECISIONS.md](DECISIONS.md). One-line each:

| OP | Principle |
|---|---|
| OP-1 | "Any ethical means within the covenant" |
| OP-2 | Composite working register |
| OP-3 | "This isn't working" reconsider-framework |
| OP-4 | STD-003 instrumentation-as-gate + two completion bars |
| OP-5 | Good-enough model + AI-as-equalizer (design north star) |
| OP-6 | Graceful degradation / fidelity tiers |
| OP-7 | AI infers → proposes → owner confirms |
| OP-8 | HAVE / NEED / WANT three-lens recon standard |
| OP-9 | The Regina Principle — the surfacing engine (product north star) |
| OP-10 | Structure-Last — the structure tax is paid by the MACHINE |
| OP-11 | Reconcile on both bars — OWNER-PROVEN triggers the flip |
| OP-12 | Reference-first promotion — the live boundary is crossed only by promoting a reference-proven artifact |

Plus the top-of-hierarchy framing doc: [NORTH-STAR.md](../NORTH-STAR.md).

---

## PART 2 — TWO REFERENCED-BUT-UNFOUND DOCS (located)

### 1. The June-13 "lot is the SKU" decision → **IN REPO, but not as a first-class decision**

- **Where it actually lives:** the header rationale block of the migration
  [supabase/migrations/20260613_cultivar_plants_untangle.sql](../supabase/migrations/20260613_cultivar_plants_untangle.sql)
  (lines 4–11): *"Settled model: LAWNS tracks LOTS (qty-of-SKU) via business_inventory.
  plants' only surviving value is vertical IDENTITY … Stock facts move to
  business_inventory."* Design rationale is also in
  [docs/architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md](architecture/INVENTORY-RESTRUCTURE-FEASIBILITY.md)
  (the layer-split + promotion feasibility test) and
  [docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md](cost-to-produce/COST-TO-PRODUCE-DESIGN.md).
- **Who quotes it as the yardstick:** the 2026-07-07 recon
  [docs/decisions/2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md](decisions/2026-07-07-qr-lifecycle-and-stock-line-purchase-recon.md)
  (line 14: *"June 13: 'LAWNS tracks lot-level history, not individual organisms; the lot
  is the SKU.'"*).
- **✅ RESOLVED 2026-07-07:** promoted to **[D-34 · The LOT is the SKU](DECISIONS.md)** in
  DECISIONS.md (a `[POINTER]` entry back to the migration header + feasibility doc). A
  decision lookup now finds it where it should. The migration header remains the canonical
  rationale home; D-34 is the discoverable ledger pointer.

### 2. STORIES_AND_FRAMINGS.md → **NEVER CREATED**

- **Filename search:** no match anywhere in the tree (excluding node_modules).
- **Git history (all branches, including deleted files):** no file by that name ever existed.
- **String search (any extension):** zero references to `STORIES_AND_FRAMINGS` anywhere in
  the repo.
- **Verdict: the doc was never created.** The "stories + framings" content it implies is
  currently **split** across: [user_stories.md](../user_stories.md) + [stories.html](../stories.html)
  (the Story Board system, ledger #56) for the day-in-the-life stories, and the many
  `docs/decisions/*.md` recon/framing docs indexed above for the framings.
- **🚩 FLAG:** if David wants a single consolidated STORIES_AND_FRAMINGS doc, it **needs
  authoring from scratch** — there is nothing to rename or recover.

---

## PART 3 — GENUINELY-OPEN DECISIONS (need David)

These are NOT yet decided/recorded. Lightning should surface them rather than assume a home.

| Open item | Current state | Decided anywhere? |
|---|---|---|
| ~~**SELL PRICE on the stock line**~~ | ✅ **DECIDED 2026-07-07 as [D-35](DECISIONS.md)** — stored `business_inventory.sell_price` (editable, authoritative, DISTINCT from `unit_cost`); MarginEngine suggests, stored price governs; cart reads `sell_price` and refuses $0; `price_tier` applies at checkout. | **DECIDED** — build owed (spec item 1: migration + datasheet entry UI + cart repoint + tier consumption). |
| **Lifecycle / transplant EVENT grain (cohort vs per-size)** | Events key on `plant_id`; design says lot-level. The re-anchor target (variety-cohort vs per-size row) is spec'd but the grain is the one sub-question David still picks at build time. | **PARTIALLY DECIDED** — the DRIFT is settled by [[D-34]] (re-anchor to the stock line, add cost-basis columns); spec'd as [buildspec item 5](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) and marked **POST-DEMO**. The cohort-vs-per-size grain is the residual call, made when item 5 is built. |
| **Purchase-off-stock-line vs `cultivar_plants` (the drift)** | Purchase resolution still anchored to per-specimen `cultivar_plants`. | **BUILDER-COMPLETE (M2 GATED) 2026-07-07** — [[D-34]] settles the target; [buildspec item 2](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md) BUILT: shared `packages/shared/src/inventory/stockLineResolver.ts` (agnostic ladder, consumed by both InventoryCount + usePlant) + `usePlant` fallback + `plant.stock_line_id` discriminator + `submit.ts` one-anchor write + **M2** `20260707_order_items_stock_line_anchor.sql` (`business_inventory_id` + `plant_id` nullable, GATED — David applies). `npm run verify` zero net-new; owner-proof owed. |
| **R-QBSTALE — edited order → QuickBooks invoice** | Order roster CRUD (2026-07-08, ledger #100) lets owner/manager edit a SUBMITTED order → totals recompute. The order's existing QB invoice is now out of date. Current behavior: the edit SURFACES staleness (`qbStale:true` + a UI banner "re-sync in QuickBooks") but does NOT auto re-sync. | **OPEN — needs David.** Options: (a) leave the surfaced banner (owner re-syncs manually — current), (b) auto re-issue/void+recreate the QB invoice on edit (rides `qbo/invoice/cultivar`, no new fn). Same family as the pay-at-office-also-fires-QBO flag (R3, ledger #99). |
| **R-STATUS — order status lifecycle enum** | `orders.status` is a live-only text column with NO CHECK; before #100 nothing moved it off `pending`. #100 added a minimal `pending→confirmed→fulfilled→cancelled` lifecycle (`lib/orderStatus.ts`, ONE source; server-validated) so owner/manager can transition an order; 'cancelled' currently auto-releases reserved inventory. | **OPEN — needs David.** Ratify (a) the status set (is 4 states right? any missing — e.g. `paid`, `out_for_delivery`?), (b) whether cancel should auto-release (currently yes) and whether un-cancel should auto-re-reserve (currently NO — edit to restock). A DB CHECK constraint can follow ratification. |

**Reconciliation note (updated 2026-07-07):** all three former open items are now closed as
*decisions*. SELL PRICE became **D-35**. The two lifecycle/purchase items were always
downstream of the June-13 "lot is the SKU" decision (now first-class **D-34**) — the DECISION
existed; the CODE drifted — and are now sequenced in the consolidated build spec
([2026-07-07-inventory-sale-pipeline-buildspec.md](decisions/2026-07-07-inventory-sale-pipeline-buildspec.md)).
What remains is BUILD, not DECIDE. **UPDATE 2026-07-08 (ledger #100):** two genuinely-open decisions were added below the reconciled rows — **R-QBSTALE** (edited-order QB re-sync) and **R-STATUS** (order status enum ratification) — both surfaced by the order-roster-CRUD build; neither is settled.
