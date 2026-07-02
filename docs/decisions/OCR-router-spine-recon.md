# OCR-AS-ONE-CAPABILITY — ROUTER + SPINE RECON (commonality + delta-per-destination)

**Date:** 2026-06-25 · **Author:** Thunder · **Type:** verify-first recon, READ-ONLY (built nothing this pass)
**Question:** OCR is ONE capture+extract engine feeding MANY destinations. Map what's shared (the spine) vs the per-destination delta, so the build is "extract the spine once, thin adapters per destination" — not "build OCR-into-X five times."

> ↑ Feeder for the canonical front-page — see `TRACE-SESSION-BOOTSTRAP.md` ⚡ ACTIVE STATUS / 📋 board (caps 2.3, 3.1, 3.5). Sibling to `docs/decisions/OCR-into-inventory-reuse-verify.md` (destination 3 in depth).

---

## HEADLINE

**Yes — there is a build-once SPINE worth extracting, and it already exists ~80% assembled inside `ReceiptKeeper.tsx`.** OCR is NOT five features; it is ONE engine (`api/receipts/ocr.ts`, pure extraction, shape-aware) plus ONE capture/confirm/router shell (currently welded into Receipt Keeper) plus N thin destination adapters (a mapper + a write target each).

**Two destinations are already LIVE through this exact pattern** — receipts→cost-capture (the reference) and **invoice→delivery/routing** (which the prompt expected to find "partly wired" but is in fact **fully wired and live, BUILDER-COMPLETE, owner-proof owed** — the delivery loop closed 2026-06-20). That is the proof the spine-then-adapter shape works: the SECOND destination (delivery) was added as an adapter on top of the first (receipts) without rebuilding capture or extraction.

**Recommended build shape: SPINE-THEN-ADAPTERS.** Lift capture+compress+OCR-call and the infer-then-confirm router shell out of `ReceiptKeeper.tsx` into a shared `useDocumentCapture()` hook + a confirm-router shell; then every new destination is a `lineItems/fields → table mapper` + a write call. The two net-new destinations David named (inventory, leakage) become small adapters, not projects. Audit is a cross-cutting write the spine emits once per commit. **The destinations are NOT too different to share — they already share, today, across two live paths.**

---

## (1) DESTINATION MAP — each × current state × wired vs not

| # | Destination | State | Wired | Not-wired / gap | Evidence |
|---|---|---|---|---|---|
| 1 | **RECEIPTS → cost capture** (reference impl) | 🟢 **LIVE** | capture → `ocr.ts` (shape:receipt/invoice) → confirm grid → `doSave` inserts ONE `receipts` row | nothing — this is the proven path | `ReceiptKeeper.tsx` `doSave` `:364`, receipts insert `:422`; `ocr.ts` (pure extract) |
| 2 | **INVOICE → DELIVERY / ROUTING** ("the wow") | 🟢 **LIVE — BUILDER-COMPLETE, owner-proof owed** | OCR `shape:'invoice'` extracts `ship_to`+`delivery_date`+customer → "Schedule delivery" checkbox → `POST /api/customers/create` (customer + linked `deliveries` row, one round-trip) → `DeliverySchedule.tsx` day view → `DeliveryRoute.tsx?date=` plots via existing `buildMapsUrl` | live driver-tracking / route-optimize / add-a-stop (out of scope, correctly fenced) | router checkboxes `ReceiptKeeper.tsx:972-987`; delivery body `:488-499`; `deliveries` migration `20260620_deliveries.sql` (applied); day view `DeliverySchedule.tsx`; route `DeliveryRoute.tsx?date=` |
| 3 | **INVOICE → INVENTORY** | 🟡 **SCOPED, NOT BUILT** (~70% reuse) | OCR `INVOICE_PROMPT` already extracts `line_items[]{description,sku,quantity,unit_price,amount}` ≈ 1:1 to an inventory row; `business_inventory` write shape + `receipt_id` seam exist | the `lineItems → business_inventory[]` mapper + N-row confirm grid + multi-row insert | full breakdown in `OCR-into-inventory-reuse-verify.md`; write shape `BusinessInventory.tsx:147-166` (reserves `receipt_id` `:154`) |
| 4 | **INVOICE → LEAKAGE** | 🔴 **ABSENT** (no OCR seam) | nothing | leakage is PURELY order-derived; no OCR path touches it. The "Analyze sale → sales/leakage insights" checkbox exists but is **disabled/"coming"** | `leakage_flag` SET only in `api/orders/submit.ts:108`; READ in `Dashboard.tsx:172` / `api/dashboard.ts:35`; the stub: `ReceiptKeeper.tsx:990-993` ("Analyze sale … coming") |
| 5 | **DOCUMENT → AUDIT** | 🔴 **ABSENT** (table exists, dormant) | `audit_log` table defined + append-only/immutable (RLS insert+select only, BEFORE-UPDATE/DELETE reject trigger, UPDATE/DELETE revoked) | **zero app code writes it** — no OCR/capture path emits an audit row | `20260623_audit_log_spine.sql` (table `:63-74`, immutability `:122-138`/`:163-171`); grep: no `audit_log` references in any `.ts/.tsx` |
| 6 | **CROSS-VERTICAL (Ignition)** | 🔴 **SEPARATE engine, NOT shared** | both verticals tap the `AIEngine` routing table | Cultivar uses the **direct server endpoint** `api/receipts/ocr.ts` (Gemini→Claude chain, `shape` param, raw output captured); Ignition uses a **remote fire-and-forget task** `AIEngine.auditInvoice` → Railway `ai_router.py` (`invoice_audit`, opaque, no shape/fallback/raw control). No OCR/extraction code in `packages/shared` today. | Cultivar endpoint `api/receipts/ocr.ts`; Ignition `IgnitionAudit.jsx:459` → `AIEngine.auditInvoice`; task table `AIEngine.ts:41` |

**Net:** 2 LIVE (1, 2) · 1 scoped-not-built (3) · 3 absent (4, 5, 6). The "OCR feeds many destinations" thesis is already real — destinations 1 and 2 ship on the same engine.

---

## (2) THE COMMON SPINE — what is shared / shareable vs welded

| Spine piece | Where it lives today | Shared? | Liftable? |
|---|---|---|---|
| **EXTRACT** (provider chain Gemini→Claude, JSON-only, config-swappable, `shape:receipt\|invoice`) | `api/receipts/ocr.ts` — **pure extraction, writes NOTHING** (`:358` returns `parsed`) | cultivar-local endpoint (Ignition has a separate remote path) | ✅ **already a clean seam** — reuse as-is; a new `shape:'inventory'` is one `promptForShape` branch (`ocr.ts:110`), provider-3 slot stubbed (`:312`) |
| **CAPTURE** (mobile camera-first + desktop upload + HEIC/PDF) | `useIsMobile()` `ReceiptKeeper.tsx:45`; `<input capture="environment">`; `resizeAndCompressImage()` util `utils/imageCompression.ts:25` | compression util is standalone; capture wiring is **inline in ReceiptKeeper** | ✅ extract `handleRunOCR` (`:208`) + capture into a shared **`useDocumentCapture()`** hook (rule-of-three: 2nd consumer = inventory) |
| **DOC-TYPE INFERENCE** (the router brain) | TWO layers, both partial: (a) extraction **shape is HARDCODED** `OCR_SHAPE='invoice'` `:33`; (b) post-OCR **classify** `docType = customerName ? 'invoice-customer' : 'receipt'` `:288-289`, drives the confirm panel copy | inline in ReceiptKeeper | 🟡 **partial — exists but welded.** There is no engine that auto-picks the extraction prompt; one shape is forced + a customer-name heuristic labels the result. Liftable into a shared classifier if/when a 2nd entry point needs auto-routing |
| **CONFIRM / ROUTER SHELL** (D-9 owner-accepts-before-commit + "what do we do with it" destinations) | infer-then-confirm panel `ReceiptKeeper.tsx:944-994` (Add customer ✓ / Schedule delivery ✓ / Analyze sale ⛔coming); line-item editor = **`LineItemGrid`** component (`components/LineItemGrid.tsx`, reusable, line-items-only); customer/address/service-type sub-forms inline `:996-1083` | `LineItemGrid` is a real reusable component (cultivar-local, not in `packages/shared`); the broader confirm+router panel is **inline JSX** | 🟡 `LineItemGrid` lifts cleanly; the destination-checkbox router + field sub-forms are ReceiptKeeper-shaped and would need extraction to a shell |

**Read:** EXTRACT is already the shared engine (writes nothing, shape-parameterized). CAPTURE is 100% reusable logic, just inline. The CONFIRM-ROUTER is the piece most worth extracting — it's where each destination plugs in, and it's currently one long JSX block welded to Receipt Keeper. DOC-TYPE inference is the least-built spine piece (a forced shape + a heuristic label).

---

## (3) THE DELTA PER DESTINATION — net-new on top of the spine

Given the spine (capture + extract + confirm-router), each destination is small:

- **1 · Receipts** — delta = ZERO. It IS the reference. (insert one `receipts` row, `doSave`.)
- **2 · Delivery** — delta = ALREADY BUILT. `ship_to`/`delivery_date` → `customers/create` (delivery block) → day view → existing route map. Owner-proof owed, no code owed.
- **3 · Inventory** — delta ≈ **30% net-new**: `lineItems → business_inventory[]` mapper (`description→name, sku→sku, quantity→qty, unit_price→unit_cost`; D-9: missing cost → `cost_confidence='UNKNOWN'`, never 0) + an N-row confirm grid (donor: `LineItemGrid`) + multi-row insert with `receipt_id` provenance. **No migration** (table + seam exist).
- **4 · Leakage** — delta = a **rule adapter**: an extracted invoice that shows a large-container line with no protective/netting line → a leakage signal. The catch: leakage today is a column ON `orders` (`api/orders/submit.ts:108`), and OCR stops at `receipts` (no order is created). So this adapter needs a decision — either (a) OCR-invoice creates/links an `orders`-shaped record so the existing leakage rule fires, or (b) a new "document-derived leakage" surface keyed off `receipts`. This is the `Analyze sale` stub. Net-new: the rule + a write target.
- **5 · Audit** — delta = a **cross-cutting emit**, not a destination adapter. The spine emits ONE `audit_log` row per committed document (`action:'document.captured'`/`'document.committed'`, `target_type`, `detail` jsonb, `outcome`). Table + immutability already exist; nothing writes it. One shared helper, called from `doSave` and each adapter's write.
- **6 · Cross-vertical** — delta = an **architectural decision, not an adapter**. To serve Ignition from the same spine, either Ignition ports off its remote `AIEngine.auditInvoice` task onto the cultivar direct-endpoint model, or the spine is promoted to `packages/shared` with both call styles. Not required for the cultivar destinations; flag it, don't fold it in.

---

## (4) BUILD SHAPE + SIZING

**Recommendation: SPINE-THEN-ADAPTERS** (not per-destination). Justified because the pattern already carries two live destinations on one engine; the marginal cost of destination N is a mapper + a write, once the shell is shared.

**Phase A — extract the spine (do first, ~M):**
1. `useDocumentCapture()` shared hook — lift `handleRunOCR` + capture + `resizeAndCompressImage` out of ReceiptKeeper (S–M; logic is 100% reusable, cost is the extraction + making Receipt Keeper the first consumer of its own lifted code).
2. Confirm-router shell — lift the infer-then-confirm panel + `LineItemGrid` into a reusable shell that takes a list of destination adapters (M; the field sub-forms are the fiddly part).
3. (Optional, defer) shared doc-type classifier — only when a 2nd entry point needs auto-shape; today's forced `shape:'invoice'` + customer heuristic is fine (S, skip for now).

**Phase B — adapters (each thin, on top of A):**
- Inventory adapter — **S–M** (mapper + multi-row insert + N-row grid; the ~30% in the inventory reuse-verify doc). **Highest demo value, no migration, NEXT build.**
- Leakage adapter — **M** (gated on the orders-vs-receipts decision above; this is the `Analyze sale` stub).
- Audit emit — **S** (one shared helper; table ready). Worth doing alongside Phase A so every commit is audited from day one.
- Cross-vertical (Ignition) — **L / architectural** — separate decision, not part of this arc.

**Do-first call:** the spine is real and mostly assembled; the cheapest high-value move is **Phase A extraction + the inventory adapter** (cap 2.3, the scoped NEXT build), because it (a) forces the spine out of ReceiptKeeper with a real 2nd consumer and (b) ships a demo capability with no migration. Leakage and audit follow as small adapters; Ignition is its own decision.

**Built nothing this pass — this scopes the sequence; David sequences from it.**
