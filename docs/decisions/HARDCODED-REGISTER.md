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

**Last updated:** 2026-07-08 (ALL 8 tile-2.1 items CLEARED — 2.1 QR Checkout restored to GREEN; receipt/QB/leakage + sweep build).

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

## NOT debt (excluded — correct, platform-owned)

- `Terms.tsx:139` / `Privacy.tsx:107` / `Help.tsx:761,839` — `(512) 456-3632` + `david@trace-enterprises.com`: these are **TRACE Enterprises'** own legal/help contact (per CLAUDE.md Key Data), correct on the platform's own legal pages — NOT a tenant leak.
- Comments referencing LAWNS as an example (`dateParse.ts:5`, `tileRegistry.ts:207`) — documentation, not output.

---

## Summary
- **Open items:** 1 — only **H9** (1.x, doesn't drop a green tile); 2 documented-with-reason (H10, H11). All 8 tile-2.1 items are CLEARED (2026-07-08).
- **Tiles CAPPED AT AMBER by this register:** **none.** 2.1 Cart / QR checkout is restored to 🟢 (all 8 items cleared).
- **Tiles that stay green** (their items are DOC — generic defaults / demo-only, not tenant leaks): 2.2, 3.7.
- H9 (front-door signup example placeholder) remains OPEN but its owning caps 1.1–1.5 are already 🟡 for other reasons, so it drops no green tile.
