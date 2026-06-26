# WALK-AND-COUNT INVENTORY — VERIFY-FIRST FINDINGS + BUILD DECISIONS

**Date:** 2026-06-26 · **Author:** Thunder · **Type:** verify-first recon → build (count loop only)
**Story (David):** "We're on the inventory page, walk the lot, scan a code — it removes the URL, keeps the QR — I add qty, hit 'save,' it says next and we move onto the next item. At the end we say 'complete.' Save, next, complete."
**Scope today:** the COUNT LOOP only (scan → resolve → qty → save → next → complete). Reconciliation (counted vs expected: sold/dead/missing) is **DEFERRED** — not built — but the record model leaves room for it.

> ↑ Feeder for the canonical front-page — TRACE-SESSION-BOOTSTRAP.md ⚡ ACTIVE STATUS / 📋 board (cap 2.3 walk-and-count) + 🧵 ARC MAP arc 8 (asset/inventory/PMI).
> **This doc is the HOME for the two verify-first gate answers** — the prior recon's answers got lost; they live here now.

---

## GATE 1 — QR SCAN-TO-RESOLVE: what exists today?

**Verdict: scan-to-RESOLVE does NOT exist. Today is scan-to-PROFILE-via-URL only. The in-app camera scanner that strips the URL and resolves WITHOUT navigating away is net-new (built this pass).**

- **QR generation exists, scanning does not.** `packages/shared/src/qr/generate.ts` encodes `${baseUrl}/plant/${plantId}` (a URL) into a PNG; `qr/print.ts` prints labels. The only dep is `qrcode` (generation). **No QR/barcode *decoder* anywhere** — no `jsqr`, `@zxing`, `html5-qrcode`, and no use of the native `BarcodeDetector`.
- **Today's "scan" = the phone's native camera opening the URL.** A printed plant QR holds `https://cultivar-os.vercel.app/plant/SCV-0031`. The OS camera opens that URL → React Router route `/plant/:tagId` (`router.tsx:58`) → `PlantProfile`. `usePlant(tagId)` (`hooks/usePlant.ts`) resolves the tag via `cultivar_plants` `ilike tag_id`, joining `business_inventory` through the `inventory_id` FK. This **navigates away** — exactly what the count loop must NOT do.
- **The resolve query already exists and is reusable.** `usePlant`'s `cultivar_plants … ilike(tag_id) + business_inventory(...)` join is the resolve we need; the count loop reuses that shape (without the navigation).
- **URL-strip rule:** scanned text is a URL; keep the segment after `/plant/` → that is the `tag_id`. (Built as `extractTag()`.)

**Build decision:** add a real in-app scanner. **`jsqr`** (pure-JS, ~14KB gz, registry-reachable, installed into `packages/cultivar-os`) decoding `getUserMedia` frames on a canvas, in a continuous loop. **Standard-by-value (CLAUDE.md §6 r10):** the web-standard `BarcodeDetector` is NOT supported on iOS Safari (our actual target — Lauren on a phone in the yard), so we diverge to jsqr for cross-device coverage. A **manual tag-entry fallback** is always present (camera denied/unavailable) so the loop never dead-ends.

---

## GATE 2 — INVENTORY ON-HAND: where does a count write?

**Verdict: `business_inventory.qty` IS a stored, updatable on-hand integer — a count can SET it directly. There is NO count-event / stock-adjustment / count-session / on-hand-with-date notion anywhere. Recording a durable count (for later reconciliation) needs a new table → a migration → handed to David, NOT applied here.**

- **`business_inventory` columns** (`20260612_business_assets_inventory_pmi_service.sql:97` + `..._cost_confidence.sql:55`): `id, business_id, sku, name, description, qty int NOT NULL DEFAULT 0, unit_cost, serial_number, location, status DEFAULT 'available', received_at, photo_url, notes, receipt_id, cost_confidence, created_at, updated_at`. `qty` = current on-hand; directly updatable via the existing owner_all + member_all RLS (the page already inserts/reads it).
- **No count history exists.** Grep across `supabase/migrations/` and `packages/` for `count_session | inventory_count | stock_adjustment | on_hand | adjustment` → **zero** schema. `qty` is last-write-wins with no audit trail.
- **`cultivar_plants` → `business_inventory` link:** `cultivar_plants.inventory_id` FK (`20260613_cultivar_plants_untangle.sql:55`, nullable). A scanned plant tag carries identity (`common_name`, `current_container` = size) and *may* link a lot (`inventory_id`). A plant with `inventory_id = null` has no on-hand lot to set.

**Build decision (record model — requirement B, "don't silently overwrite on-hand with no record"):** two new tables, **handed to David to apply** (`supabase/migrations/20260626_inventory_count_sessions.sql`, GATED — NOT applied by Thunder):
- `inventory_count_sessions` — id, business_id, started_at, completed_at, status (`in_progress`/`completed`/`abandoned`), counted_by, item_count.
- `inventory_counts` — id, session_id FK, business_id, inventory_id (nullable FK), plant_tag_id (nullable), item_label, counted_qty, was_unknown bool, raw_scan, counted_at. **This is the durable record reconciliation will later read** (counted qty + item + timestamp + session).

On Save→Next: **(i)** SET `business_inventory.qty = counted` for the resolved lot (when a lot is linked) AND **(ii)** insert a `inventory_counts` row. Deploy-window safety: if the count tables are absent (migration not yet applied), the qty update still succeeds and the count-record insert is skipped with a loud `[TRACE:COUNT]` warning — owner-proof happens AFTER David applies, so by the proving moment records ARE written (mirrors the deliveries `service_type` migration-window fallback, ledger #20).

---

## RELATION TO OCR-INTO-INVENTORY (cap 2.3 sibling — NOT this build)

`docs/decisions/OCR-into-inventory-reuse-verify.md` scopes "capture invoice image → OCR → write inventory rows" (INTAKE — fills the catalog). **Walk-and-count is the complement** (VERIFY physical on-hand against the catalog). Different flows; both live under cap 2.3. This pass builds walk-and-count; OCR-intake remains its own NEXT build.

---

## WHAT WAS NOT BUILT (deferred, by instruction)

Reconciliation: counted-vs-expected variance, sold/dead/missing classification, DEAD capture, depletion wiring. The record model (`inventory_counts`) is shaped so reconciliation can read it later (per-item counted qty, label, session, timestamp) — room left, nothing built.
