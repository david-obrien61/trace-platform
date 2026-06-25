# OCR → INVENTORY — REUSE-VERIFY RECON (scopes the NEXT build)

**Date:** 2026-06-25 · **Author:** Thunder · **Type:** verify-first recon, READ-ONLY (build nothing this pass)
**Question:** Is "capture invoice/receipt image → OCR → write to `business_inventory`" 🔴 net-new or 🟡 reuse-and-wire? What lifts vs. is welded to `receipts`?

> ↑ Feeder for the canonical front-page — see TRACE-SESSION-BOOTSTRAP.md ⚡ ACTIVE STATUS / 📋 board (cap 2.3).

---

## VERDICT — 🟡 REUSE-AND-WIRE (~70% reuse). OCR-into-inventory should move UP.

The expensive, proven parts (provider chain, mobile capture, compression, invoice line-item extraction with SKU/qty/unit_price) are **already built and live**. The only genuinely net-new piece is a small **line-items → `business_inventory` mapper + an N-row confirm grid + multi-row insert**. This is NOT a from-scratch build.

---

## (a) OCR PROVIDER CHAIN — 100% reusable, writes nothing

`packages/cultivar-os/api/receipts/ocr.ts` is **pure extraction** — it returns structured JSON and **writes to no table**. Provider-agnostic (Gemini 2.5 Flash → Claude Haiku → clean error), config-swappable via `platform_config` (`ocr_primary_model`/`ocr_fallback_model`).

- It **already accepts `shape: 'receipt' | 'invoice'`** (`ocr.ts:109-112, :281-282`). The `INVOICE_PROMPT` (`ocr.ts:79-107`) extracts `line_items[]{ description, sku, quantity, unit_price, amount }` — **a near-1:1 match to an inventory row** (description→name, sku→sku, quantity→qty, unit_price→unit_cost).
- An inventory-intake path calls the **same endpoint** with `shape:'invoice'` (or add a tighter `shape:'inventory'` prompt — one `promptForShape` branch, no chain change; provider-3 slot already stubbed `ocr.ts:312`).
- **Reuse: 100%, as-is.** Evidence: `ocr.ts:309-313` (chain), `:358-368` (returns `parsed`, no DB write).

## (b) MOBILE CAPTURE + COMPRESSION — 100% reusable (needs extraction to shared)

Receipt Keeper was expanded to mobile and the capture surface is real:
- `useIsMobile()` — `ReceiptKeeper.tsx:42-57`; camera-first `<input capture="environment">` `:820-824`; file-upload fallback `:829-832`.
- `resizeAndCompressImage(file)` — standalone util `utils/imageCompression.ts:25` (handles HEIC/PDF passthrough + canvas compress; returns `{base64, sizeBytes, mimeType}`).
- The OCR call wrapper `handleRunOCR` `ReceiptKeeper.tsx:208-244` (validate → compress → POST → pre-fill from `data.parsed`).
- **Reuse: 100% of the logic.** The one cost: today it's **inline in ReceiptKeeper**, not a shared hook/component. The clean wire = extract capture+compress+OCR-call into a shared `useDocumentCapture()` hook so both Receipt Keeper and Inventory Intake consume it (rule-of-three: this would be the 2nd consumer).

## (c) EXTRACTION → STRUCTURED-JSON PIPELINE — reusable pattern; confirm-grid is receipt-shaped

The "call OCR → confirm/edit → save" pattern is reusable. `OCR_SHAPE = 'invoice'` is **already the live default** in Receipt Keeper (`ReceiptKeeper.tsx:33`), so invoice extraction with line items is already wired and exercised. The confirm UI is single-document today (one vendor/amount + a flat line list); inventory intake wants a **per-line editable grid** (each line = one inventory row to confirm/edit/drop) — the invoice confirm grid (`ReceiptKeeper.tsx:1005+`) is a close donor.

---

## WHAT IS WELDED TO RECEIPTS (the genuine net-new — small)

- **Save target.** `doSave` (`ReceiptKeeper.tsx:364`) inserts **one `receipts` row** (`:422`). That is the only receipts-welded step. Inventory intake instead maps `parsed.line_items[]` → **N `business_inventory` rows**.
- **The inventory write shape already exists** (`BusinessInventory.tsx:147-166`): `{ business_id, name, qty, unit_cost, sku, status, cost_confidence, location, ... }` — and the insert **already reserves `receipt_id`** (`:154` comment "linked by receipt flow later"). The provenance seam for OCR→inventory is pre-built in the schema.

## NEXT-BUILD SCOPE (≈30% net-new)

1. Extract capture+compress+OCR-call → shared `useDocumentCapture()` hook (from ReceiptKeeper).
2. `lineItems → business_inventory[]` mapper (description→name, sku→sku, quantity→qty, unit_price→unit_cost; D-9: missing cost → `cost_confidence='UNKNOWN'`, never 0).
3. N-row confirm/edit grid (donor: invoice confirm grid) → multi-row insert to `business_inventory` with `receipt_id` provenance.
4. (Optional) tighter `shape:'inventory'` prompt branch.

**No schema migration required** (business_inventory + receipt_id seam exist). Build nothing this pass — this scopes the next prompt.
