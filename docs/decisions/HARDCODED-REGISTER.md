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

**Last updated:** 2026-07-08 (seeded — 11 items; 2.1 QR Checkout capped amber).

---

## Owning capability: **2.1 — Cart / QR checkout** (currently CAPPED AMBER — 8 open)

| id | file:line | what it is | why it's debt | should be | sev | status |
|---|---|---|---|---|---|---|
| H1 | [`pages/DemoQBInvoice.tsx`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx) (whole file) | the QB invoice PREVIEW renders **hardcoded line items for every order** — Shoal Creek Vitex $400 (`:84`), netting $10 (`:90`), compost $28 (`:96`); + hardcoded LAWNS name (`:28,:58`), address (`:59-60`), phone (`:61`), bill-to "Customer" (`:65`), and the **retired "Layna" contact** (`:134`). Reads only `total`+`invoiceNumber` from the query, ignores the real order. | any order shows the same FAKE lines → demo-killer; leaks LAWNS identity + a banned contact | fetch the real order (`orderId` is already passed) → render its `order_items` (dual-anchor named via `orderItemName.ts`) + `order_service_selections` + `customers` in the QB chrome | HIGH | **OPEN** (recon §R3) |
| H2 | [`pages/PlantProfile.tsx:144`](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L144) | customer-facing footer `"LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336"` hardcoded on the public plant profile | a different tenant's customer sees LAWNS's name/phone (also a phone that disagrees with other docs) | read `businesses` (name/city/state/phone) from context | HIGH | **OPEN** (as-built §1a) |
| H3 | [`pages/Confirmation.tsx:116`](../../packages/cultivar-os/src/pages/Confirmation.tsx#L116) | hardcoded badge `title="LAWNS handling delivery/install"` on the receipt | tenant name baked in; also stands in for the real service | business name from context + the real service name(s) | HIGH | **OPEN** (recon §R4) |
| H4 | [`pages/CustomerCapture.tsx:305`](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L305) | opt-in copy `"…special offers from LAWNS Tree Farm"` | tenant name in customer-facing consent copy | business name from context | HIGH | **OPEN** |
| H5 | [`types/order.ts:49`](../../packages/cultivar-os/src/types/order.ts#L49) | `'LAWNS staff transport'` hardcoded transport-method label | tenant name in a data label | generic ("Staff transport") or business name | MED | **OPEN** |
| H6 | [`lib/transport.ts:108-112`](../../packages/cultivar-os/src/lib/transport.ts#L108-L112) `CHOICE_META` | branch labels `"Delivery + planting"` etc. | fine for the RADIO, but must not stand in for the service name on a receipt/invoice | receipts read `service_offerings.name`; `CHOICE_META` stays radio-only | MED | **OPEN** (recon §R4) |
| H7 | [`pages/AddOns.tsx:72`](../../packages/cultivar-os/src/pages/AddOns.tsx#L72) | `nettingPrice = offering.price ?? 10` — hardcoded $10 netting fallback | $10 is LAWNS's netting price; a different nursery's isn't | no numeric fallback — a null offering price is refused/flagged (D-9), not defaulted to a tenant number | LOW | **OPEN** |
| H8 | [`pages/CustomerCapture.tsx:242,261`](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L242) | input placeholders `"Leander"` / `"78641"` (LAWNS city/zip as hints) | tenant location as default hint text | generic placeholders, or derive from the business's own city/zip | LOW | **OPEN** |

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
- **Open items:** 8 (all under 2.1) + H9 (1.x, doesn't drop a green tile) = **9 open**; 2 documented-with-reason (H10, H11).
- **Tiles CAPPED AT AMBER by this register:** **2.1 Cart / QR checkout** (was 🟢 → 🟡, 8 open).
- **Tiles that stay green** (their items are DOC — generic defaults / demo-only, not tenant leaks): 2.2, 3.7.
- Clearing all 8 open 2.1 items (led by H1 the QB stub, H2 the footer, H6 the receipt label) restores 2.1 to green.
