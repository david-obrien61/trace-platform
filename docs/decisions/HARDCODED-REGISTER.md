# HARDCODED REGISTER — living checklist of hardcoded literals that should be data/config

**What this is:** every hardcoded tenant/vertical/business literal in the cultivar app that violates
**AC-1** (vertical identity is a VALUE, never baked into code) — names, addresses, prices, phones,
tier labels, category labels, stub/demo surfaces. Each item is tagged with its **OWNING CAPABILITY**
(the status-board tile it lives inside).

**Why it exists (the teeth):** a flag on a gap board ages; a hardcoded fake ships. The QB stub was
flagged in the as-built recon §6 and never removed — then it bit the owner-prove. This register is
the enforcement surface for the **status-board rule: any capability with an OPEN item here is CAPPED
AT AMBER** (it cannot render green until every item is CLEARED or DOCUMENTED-WITH-REASON). See
CLAUDE.md §6 rule 12 + TRACE-SESSION-BOOTSTRAP.md board legend.

**Lifecycle of an item:** `OPEN` → fix (remove the literal, read from data) → `DONE`; OR
`DOC` = documented-with-reason (a generic platform default / demo-only surface — kept deliberately,
does NOT cap its tile). Only `OPEN` items cap a tile.

**Severity:** `HIGH` = a real tenant leak or FAKE data shown in a real customer/output flow ·
`MED` = a label that stands in for real data on a receipt/output · `LOW` = a soft default / input
placeholder carrying a tenant literal.

**Cross-reference:** the receipt/QB/leakage fix paths are specified in
[2026-07-08-receipt-qb-leakage-recon.md](2026-07-08-receipt-qb-leakage-recon.md) — this register
tracks the literals; that recon tracks the builds. Do not duplicate the fix detail here.

**Last updated:** 2026-07-13 (D-40 tax build — the 3 sales-tax-rate literals T1–T3 CLEARED; rate is now per-tenant config data. Prior same day: H12–H17 CLEARED — the shared cultivar NOTIFICATION TEMPLATES (`cultivar.ts`) were fully LAWNS-hardcoded on a customer-facing surface; genericized to a `NotifyBusiness` active-business token, omit-not-fake. Register gap closed: notification templates were missed by the #97 checkout sweep and are now IN SCOPE. Prior: 2026-07-08 — ALL 8 tile-2.1 items CLEARED; 2.1 QR Checkout restored to GREEN.).

---

## Owning capability: **2.1 / tax (D-40)** — sales-tax rate literals (✅ ALL 3 CLEARED)

The last remaining customer-facing hardcode class (flagged in the 2026-07-13 brand sweep as "borderline locale value").
D-40 makes the rate per-tenant SUPPLIED DATA (`config.taxRate`); an unset rate renders a redline, never a fabricated %.

| id | file:line | what it was | why it was debt | now | sev | status |
|---|---|---|---|---|---|---|
| T1 | [`notifications/templates/cultivar.ts:57`](../../packages/shared/src/notifications/templates/cultivar.ts#L57) | ~~customer-facing email `<span>Tax (8.25%)</span>`~~ | every non-TX tenant's customer saw a wrong tax % on their invoice email (the highest-severity surface) | renders `describeTaxLine` three states (redline / taxed(%) / exempt) from the authoritative `taxStatus` — no literal | HIGH | **✅ CLEARED** (D-40) |
| T2 | [`lib/constants.ts:1`](../../packages/cultivar-os/src/lib/constants.ts#L1) | ~~`export const TAX_RATE = 0.0825`~~ (imported by CartReview) | a tenant tax rate baked into shared cultivar code (AC-1) | constant RETIRED; CartReview reads `config.taxRate` via `resolveTaxRate` | MED | **✅ CLEARED** (D-40) |
| T3 | [`api/orders/submit.ts:10`](../../packages/cultivar-os/api/orders/submit.ts#L10) | ~~`const TAX_RATE_FALLBACK = 0.0825`~~ (create + handleUpdate) | server coerced an unset rate to TX's 8.25% — the silent-default that hid "not identified" | constant RETIRED; both paths read `resolveTaxRate(config.taxRate)`; null → "not identified" | MED | **✅ CLEARED** (D-40) |

Also cleared, not previously registered: shared `Settings.tsx` `parseFloat(form.tax_rate) || 0.0825` (blank→0.0825 coercion) — now writes `config.taxRate`, blank = unset = redline (never a fabricated default). QBO `business.tax_rate ?? 0.0825` → derives the % from amount/subtotal (no literal).

---

## Owning capability: **2.1 — Cart / QR checkout** (✅ ALL 8 CLEARED — restored to GREEN)

| id | file:line | what it is | why it's debt | should be | sev | status |
|---|---|---|---|---|---|---|
| H1 | [`pages/DemoQBInvoice.tsx`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx) | ~~QB PREVIEW rendered hardcoded lines for every order + LAWNS identity + "Layna"~~ | any order showed FAKE lines; leaked LAWNS identity + banned contact | fetch the real order → render `order_items` (dual-anchor `orderItemName.ts`) + `order_service_selections` + `customers` + real business identity | HIGH | **✅ CLEARED** — rebuilt as order-backed `QBInvoicePreview`; real lines + real businesses row; Layna/LAWNS gone (FIX 1) |
| H2 | [`pages/PlantProfile.tsx:141-149`](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L141) | ~~footer `"LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336"`~~ | a different tenant's customer saw LAWNS's name/phone | read the `businesses` row from context | HIGH | **✅ CLEARED** — footer = `{name · address · phone}` from `useBusinessContext().business`; omitted (not faked) when unresolvable under anon RLS |
| H3 | [`pages/Confirmation.tsx:115`](../../packages/cultivar-os/src/pages/Confirmation.tsx#L115) | ~~badge `title="LAWNS handling delivery/install"`~~ | tenant name baked in; stood in for the real service | business name + real service name | HIGH | **✅ CLEARED** — badge = `{businessName} — {transportName}` from nav state; services itemized by real `service_offerings.name` (FIX 2) |
| H4 | [`pages/CustomerCapture.tsx:304`](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L304) | ~~opt-in copy `"…special offers from LAWNS Tree Farm"`~~ | tenant name in consent copy | business name from context | HIGH | **✅ CLEARED** — `…special offers{business?.name ? ' from '+name : ''}` |
| H5 | [`types/order.ts:49`](../../packages/cultivar-os/src/types/order.ts#L49) | ~~`'LAWNS staff transport'` transport-method label~~ | tenant name in a data label | generic label | MED | **✅ CLEARED** — `'Staff transport'` (generic; note: this fn is currently unused — submit.ts owns the live note) |
| H6 | [`lib/transport.ts:108-112`](../../packages/cultivar-os/src/lib/transport.ts#L108-L112) `CHOICE_META` | branch labels `"Delivery + planting"` etc. | fine for the RADIO, must not stand in for the service name on a receipt/invoice | receipts read `service_offerings.name`; `CHOICE_META` stays radio-only | MED | **✅ CLEARED** — no code change needed; FIX 2 makes Confirmation + QB preview itemize by real `service_offerings.name`; `CHOICE_META` remains radio-only (verified: only `TransportToggle` consumes it) |
| H7 | [`pages/AddOns.tsx:72`](../../packages/cultivar-os/src/pages/AddOns.tsx#L72) | ~~`nettingPrice = offering.price ?? 10`~~ | $10 is LAWNS's netting price | no tenant numeric fallback | LOW | **✅ CLEARED** — `?? 0` (offering row carries the real price, NOT NULL; also fixed in `submit.ts:260`) |
| H8 | [`pages/CustomerCapture.tsx:242,261`](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L242) | ~~input placeholders `"Leander"` / `"78641"`~~ | tenant location as hint | generic placeholders | LOW | **✅ CLEARED** — `"City"` / `"ZIP"` |

---

## Owning capability: **front-door / signup** (1.x — already amber; no green tile dropped)

| id | file:line | what it is | why it's debt | should be | sev | status |
|---|---|---|---|---|---|---|
| H9 | [`pages/SignUp.tsx:40-41`](../../packages/cultivar-os/src/pages/SignUp.tsx#L40-L41) | example placeholders `'e.g. LAWNS Tree Farm'` / `'400 Honeycomb Mesa, Leander TX'` | uses the demo tenant's real name/address as the signup example | genericize the example, OR keep as an illustrative placeholder | LOW | **OPEN** (owning caps 1.1–1.5 are already 🟡) |
| H10 | [`pages/OnboardingWizard.tsx:304`](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx#L304) | demo customer `'Johnson Family'` + `'400 Honeycomb Mesa…'` | hardcoded demo data | — | LOW | **DOC** — demo-only path (the onboarding DEMO chooser), never a real-flow surface; kept deliberately |

---

## Owning capability: **3.7 — Customer management** (stays green)

| id | file:line | what it is | why it's debt | should be | sev | status |
|---|---|---|---|---|---|---|
| H11 | [`pages/Customers.tsx:142`](../../packages/cultivar-os/src/pages/Customers.tsx#L142) | `price_tier ?? 'retail'` default tier label | a hardcoded literal | — | LOW | **DOC** — `'retail'` is the generic baseline tier (a platform default, not a tenant literal); a sensible fallback for a null tier |

---

## Owning capability: **notification templates (shared — `packages/shared/src/notifications/templates/cultivar.ts`)** (✅ ALL CLEARED — whole-file AC-1 fix)

> **Register gap closed:** the #97 checkout sweep (H1–H8) covered the checkout UI SURFACES but never scoped the
> customer-facing EMAIL/SMS templates. The whole `cultivar.ts` file was LAWNS-hardcoded — every non-LAWNS tenant's
> customer received an email branded "LAWNS Tree Farm." Recon verdict (2026-07-13): classification (a) hardcode = AC-1
> (a tenant literal in a SHARED module), not an AC-3 cross-tenant read. Notification templates are now IN SCOPE for this
> register. FIX: threaded the ACTIVE business as a `NotifyBusiness` data token (name/address/phone/email), resolved from
> the business_id-scoped context (`useBusinessContext().business`) at the call site (`useSubmitOrder`/`CartReview`), with
> OMIT-NOT-FAKE rendering (a missing field renders nothing, never a placeholder/other tenant). Same pattern that cleared
> H2/H3/H4.

| id | file:line | what it is | why it's debt | should be | sev | status |
|---|---|---|---|---|---|---|
| H12 | [`templates/cultivar.ts:4-11`](../../packages/shared/src/notifications/templates/cultivar.ts) | ~~`BASE` chrome consts `logoText:'LAWNS Tree Farm'`, `footerName:'LAWNS Tree Farm, LLC — 400 Honeycomb Mesa, Leander TX 78641'`, `footerAddress:'(512) 450-3336 · info@lawnstrees.com'`~~ | every cultivar email's header logo + footer showed LAWNS's name/address/phone/email for ALL tenants | per-tenant chrome from the active business | HIGH | **✅ CLEARED** — `BASE` const removed → `chrome(d.business)` builds logo/footer from the active business; omit-not-fake (missing → base.ts platform default, never a wrong tenant) |
| H13 | [`templates/cultivar.ts` order_confirmation](../../packages/shared/src/notifications/templates/cultivar.ts) | ~~subject `"Your LAWNS Tree Farm order is confirmed"` + body `"purchase from LAWNS Tree Farm"` / `"LAWNS will contact you"` + text + phone `(512) 450-3336`~~ | THE reported defect — customer confirmation email branded with another tenant's name | active business name/phone tokens | HIGH | **✅ CLEARED** — `Your ${d.business?.name ? name+' ' : ''}order is confirmed`; body/text use `d.business?.name`; phone line renders only when `d.business?.phone` |
| H14 | [`templates/cultivar.ts` netting_waiver_reminder](../../packages/shared/src/notifications/templates/cultivar.ts) | ~~SMS `"reminder from LAWNS Tree Farm"` + `(512) 450-3336`~~ | tenant brand + phone in a customer SMS | active business tokens | HIGH | **✅ CLEARED** — `just a reminder${name ? ' from '+name : ''}`; phone only when set |
| H15 | [`templates/cultivar.ts` delivery_scheduled](../../packages/shared/src/notifications/templates/cultivar.ts) | ~~`"delivery from LAWNS"` + `(512) 450-3336` ×2~~ | tenant brand + phone in delivery email/SMS | active business tokens | HIGH | **✅ CLEARED** — `delivery${name ? ' from '+name : ''}`; reschedule/phone clauses only when phone set; `chrome(d.business)` |
| H16 | [`templates/cultivar.ts` care_tips_30d](../../packages/shared/src/notifications/templates/cultivar.ts) | ~~`"from LAWNS went in the ground"`, `"growing with LAWNS"`, `"check-in from LAWNS Tree Farm"` + `(512) 450-3336` ×2~~ | tenant brand + phone in a nurture email/SMS | active business tokens | HIGH | **✅ CLEARED** — all LAWNS → `d.business?.name`; phone only when set; `chrome(d.business)` |
| H17 | [`templates/cultivar.ts` seasonal_offer](../../packages/shared/src/notifications/templates/cultivar.ts) | ~~SMS lead `"LAWNS Tree Farm: {headline}"`~~ | tenant brand in a promo SMS | active business token | MED | **✅ CLEARED** — `${name ? name+': ' : ''}${d.offerHeadline}`; `chrome(d.business)` |

_Note: `owner_leakage_alert` (internal owner SMS — owner knows their own business, no name literal) and `silent_partner_analysis` (deliberately TRACE-branded, sent by the platform not a tenant) carry no tenant literal → not debt._

---

## NOT debt (excluded — correct, platform-owned)

- `Terms.tsx:139` / `Privacy.tsx:107` / `Help.tsx:761,839` — `(512) 456-3632` + `david@trace-enterprises.com`: these are **TRACE Enterprises'** own legal/help contact (per CLAUDE.md Key Data), correct on the platform's own legal pages — NOT a tenant leak.
- Comments referencing LAWNS as an example (`dateParse.ts:5`, `tileRegistry.ts:207`) — documentation, not output.

---

## Summary
- **Open items:** 1 — only **H9** (1.x, doesn't drop a green tile); 2 documented-with-reason (H10, H11). All 8 tile-2.1 items CLEARED (2026-07-08); the 6 notification-template items H12–H17 CLEARED (2026-07-13).
- **Tiles CAPPED AT AMBER by this register:** **none.** 2.1 Cart / QR checkout is 🟢 (all items cleared); the shared notification templates are fully genericized.
- **Tiles that stay green** (their items are DOC — generic defaults / demo-only, not tenant leaks): 2.2, 3.7.
- H9 (front-door signup example placeholder) remains OPEN but its owning caps 1.1–1.5 are already 🟡 for other reasons, so it drops no green tile.
- **Register scope note (2026-07-13):** customer-facing NOTIFICATION TEMPLATES (`packages/shared/src/notifications/templates/*`) are now tracked here — the #97 sweep only covered UI surfaces. Any future tenant literal in an email/SMS template is register debt.
