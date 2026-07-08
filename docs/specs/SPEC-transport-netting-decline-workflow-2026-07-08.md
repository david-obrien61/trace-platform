# SPEC — Transport / Netting / Decline workflow (checkout add-ons)

**Status:** DECIDED (canonical). Originally designed, built, and OWNER-PROVEN in the
May-18 Cultivar "Session 3" build; **regressed by the multi-item cart rewrite (`bd02a58`,
2026-07-08)**; **restored to this spec** the same day. This document is the artifact that
stops the workflow from being re-derived — build to it, do not re-scope.

**Home in the index:** `docs/DECISIONS-INDEX.md` → §1 (workflow specs).
**Origin (recovered from git):** `0897e00` (add-ons screen + transport toggle) · `a2bd015`
(netting/addon render) · `5aeff86` (NettingPrompt + TX Transportation Code Ch.725 citation +
confirm/decline) · `8764b39` (decline cart-total) · `0041769` (transport/netting decision
persisted to order + QB).

---

## 1. The workflow (the decided behavior)

At the add-ons step (`/checkout/addons`, after the cart is built), **Transport is a
single-select radio of three mutually-exclusive branches:**

| # | Branch | Attaches | Netting math (N = total plants across the cart) |
|---|--------|----------|--------------------------------------------------|
| 1 | **Delivery + planting** | delivery (per-order, **flat**, ×1) **+** planting (per-plant, **per_unit**, ×N) | 5 trees → **1× delivery + 5× planting**. Planting MUST scale with plant count. |
| 2 | **Delivery only** | delivery (per-order, **flat**, ×1) | 5 trees → **1× delivery**, no planting line. |
| 3 | **No thank you** (customer hauls it) | no transport charge; the **netting/tarp offer** is presented | no transport charge; tarp accepted → added (per-plant ×N); tarp declined → compliance shown + **decline captured**. |

**Branch 3 detail (the Regina mechanic — the origin of the product):**
- The netting/tarp offer shows a **red-bordered (`#A32D2D`) compliance prompt** with the
  business's configurable compliance copy (for LAWNS: **Texas Transportation Code Ch.725**,
  "secure your load", $25–$500 misdemeanor).
- **Tarp ACCEPTED** → added to the order as a per-plant (×N) service line.
- **Tarp DECLINED** → the compliance message stays visible AND the decline is **captured +
  registered** (persisted), never merely displayed.

## 2. Acceptance criteria (the per-branch math)

- delivery + planting, N trees → delivery **×1** + planting **×N** (planting scales).
- delivery only, N trees → delivery **×1**, **no** planting line.
- no-thanks → **no** transport charge; tarp accepted = added (×N); tarp declined = compliance
  shown + **a decline row written**.

## 3. Data model — service_offerings (ZERO migration)

The workflow reads **delivery and planting as two correctly-ruled `service_offerings` rows**,
classified by SHAPE (not by name — `packages/cultivar-os/src/lib/transport.ts` →
`resolveTransportRoles`):

| Role | `category` | `transport_mode` | `price_type` | `price_unit` | Netted |
|------|-----------|------------------|--------------|--------------|--------|
| **self** | transport | `self` | flat | order | — (triggers netting) |
| **delivery** | transport | `staff` | **flat** | **order** | ×1 (per order) |
| **planting** | transport | `staff` | **per_unit** | **plant** | ×N (per plant) |
| **netting** | addon | (trigger `self`) | per_unit | plant | ×N (per plant) |

The per_unit-×N / flat-×1 arithmetic is the shared attach-rule engine
(`packages/cultivar-os/src/lib/netting.ts` → `nettedQuantity`); the same function drives
display (AddOns/CartReview) and charge (`api/orders/submit.ts`) so they cannot drift.

**D-9 Surface Honesty — FLAG, never mischarge:** if the two correctly-ruled rows are not both
present (e.g. only a single fused per-plant "We deliver and plant" row exists, or a delivery
service is mis-shaped as an `addon`), the workflow surfaces the problem in the UI + a
`[TRACE:CART]` flag and best-efforts on whatever exists (a fused per-plant row runs "Delivery +
planting" as one ×N line, with "Delivery only" unavailable). It **never** silently mischarges.
**Reshaping the rows is a separate task** (the Settings offerings editor) — this workflow does
not hand-migrate data. As of 2026-07-08 the LAWNS demo carries a fused row (`db24be2e`) + a
mis-shaped Delivery addon (`a7933609`); branch 1's two-line math owner-proves once those are
split into a delivery (flat/order) + a planting (per_unit/plant) row.

## 4. Persistence (the decline capture — load-bearing)

On submit (`api/orders/submit.ts`):
- **`orders.netting_declined`** (boolean) + **`orders.transport_note`** ("… netting declined,
  Texas TCC Ch.725 waiver acknowledged") — the original decline capture, preserved.
- **`order_compliance_records`** — an immutable per-offering audit row (`decision`:
  `accepted` | `declined`, with the exact `compliance_title_shown` / `compliance_body_shown`)
  for every offering carrying a compliance notice, regardless of accept/decline. This is the
  registration the Regina story requires; it survived the rewrite and is retained.
- **`order_service_selections`** — one row per attached service with its netted quantity:
  delivery (×1), planting (×N), netting (×N), other addons. The "Delivery + planting" branch
  therefore writes **two** service selection rows.
- **`transport_method`** (legacy, for delivery routing): `self` → `self`; a staff branch with
  planting attached (or a fused per-plant row) → `install`; a plain staff delivery → `delivery`.

## 5. Constraints honored

- **AC-1:** transport/netting is generic; the Ch.725 text lives in the row's
  `compliance_title`/`compliance_body`, not in code.
- **AC-3:** every read/write is `business_id`-scoped; the decline rows are business-scoped.
- **12/12 function ceiling:** ZERO new `api/` files — the order write rides the existing
  `submit.ts`.
- **TRACE:** `[TRACE:CART]` on the transport branch + per-branch netting; `[TRACE:PRICE]` on the
  netting decision / decline write. ON until OWNER-PROVEN.

## 6. Files

- `packages/cultivar-os/src/lib/transport.ts` — role resolver + three-branch model (NEW).
- `packages/cultivar-os/src/lib/netting.ts` — attach-rule math (per_unit ×N / flat ×1).
- `packages/cultivar-os/src/components/checkout/TransportToggle.tsx` — the three-branch radio.
- `packages/cultivar-os/src/components/checkout/CompliancePrompt.tsx` — the red-border netting
  prompt (configurable compliance copy).
- `packages/cultivar-os/src/pages/AddOns.tsx` — branch select + netting + planting.
- `packages/cultivar-os/src/pages/CartReview.tsx` — the interactive itemization (delivery +
  planting + netting + addons, each adjustable before submit).
- `packages/cultivar-os/src/hooks/useCart.ts` — branch-driven transport + planting state.
- `packages/cultivar-os/src/hooks/useSubmitOrder.ts` + `api/orders/submit.ts` — charge + persist.
