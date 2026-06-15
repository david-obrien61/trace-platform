# Asset-Capture Tool — Transition Plan (Andrew's code → `cost_objects`)

**Date:** 2026-06-15
**Author:** Thunder (Claude Code) — RECON / planning only. No code modified.
**Status:** SPEC. Build-against contract for Andrew. Supersedes any prior plan that
referenced `business_assets` as the write target (Core-1 renamed it — see §6).

**Purpose:** Andrew's inventory/capture tool was blocked on "table named + designed."
Core-1 cleared that (2026-06-15): `business_assets` → `cost_objects`, node fields,
two confidence axes, separate status columns, a proven `/assets` write pattern. This
doc grounds the transition in Andrew's REAL on-disk code + the CURRENT schema so he
builds once, against the real contract, with no rename refactor later.

> **Read this first:** Andrew's tool and the destination are in **different languages,
> different storage models, and different trust models.** This is a **conceptual port +
> reimplementation**, not a line-for-line port. The valuable IP (the capture UX, the
> barcode-scan-prefill idea, the AI-identify-then-confirm loop) ports. Almost none of
> the Python *code* survives — and most of what it does (local Gemini call, JSON sidecar
> storage, CSV export, backup, analytics) is already replaced by platform infrastructure
> that did not exist when Andrew built. Knowing that up front is what saves the refactor.

---

## 1. SOURCE — what Andrew's code actually is (read from disk, not memory)

**Location:** `~/Desktop/current inventory code/Local website library/`
(an identical nested copy also exists at `.../Local website library/Local asset library/` —
treat the outer one as canonical; the inner is a duplicate snapshot.)

**Stack:** Python 3.14 desktop application.
- **GUI:** Tkinter — `ui.py` (`AssetDashboard`, 804 lines), `ui_tools.py`, `ui_file_ops.py`, `ui_ai.py`.
- **Local web server:** FastAPI + uvicorn on `0.0.0.0:8000` — `server.py`. Serves a
  mobile capture page and receives uploads from a phone on the same LAN.
- **AI layer:** Google Gemini (`google.genai`, model `gemini-2.5-flash`) — vision identify
  + live web-search price fetch.
- **Other libs:** `qrcode`, `PIL`/Pillow (image ops, annotation, QR label rendering).
- **Packaged:** PyInstaller (`main.spec`, `dist/main.exe`) — ships as a Windows .exe.

**What it captures** (`upload.html`, served by `server.py` `GET /`):
A phone-facing form — Folder/Category (dropdown, owner-created tree), Asset Name
(optional), Location/Bin, Notes/Description — plus two image entry points:
**📷 Take Picture** (`capture="environment"`) and **📁 Choose from Library** (multi-file).

**Barcode/scan layer:** `upload.html:87` `scanBarcodeFile()` uses **`html5-qrcode`'s
`scanFile()`** to decode a barcode/QR from a photo and drop the decoded string into the
**Asset Name** field. It is a *prefill hint only* — not wired to any lookup or stable ID.
(See §7 design fork — this is the manufacturer-barcode-read path, half-built.)

**What it writes to:** **the local filesystem — there is NO database.**
- The image is saved under `ASSET_DIR` (`RawElementAssets/<folder>/`), filename
  `{name}_{HHMMSS}_{6hex}{ext}`, with **md5 dedup** against a hash cache (`server.py:229`).
- A **sidecar JSON** `{base}_info.txt` holds the metadata + AI result (`server.py:122`):

```json
{
  "Asset_Name": "...",
  "Location": "...",
  "Notes": "...",
  "AI_Analysis": {
    "Brand": "...", "Model": "...", "Device_Type": "...",
    "Estimated_Value": "...", "Specs": "...", "Summary": "..."
  }
}
```

**AI/OCR interface** (`server.py:83` `process_ai_and_metadata`): sends the image (and the
barcode/name hint, if any) to Gemini with a prompt demanding strict JSON with keys
`Brand, Model, Device_Type, Estimated_Value, Specs, Summary`. A second call
(`server.py:137` `fetch_live_price_for_item`) uses Gemini + `google_search` to fetch a
live market price string into `Estimated_Value`.

**Dashboard side** (`ui*.py`): browse by folder, edit properties, annotate image, rotate,
**generate QR label** (`ui_tools.py:131` — QR encodes the **asset NAME**, not a stable id),
**CSV export**, **ZIP backup**, **pie-chart analytics** (sums `Estimated_Value` by folder).

**Trust model:** local-first, single-machine, no auth, no tenant, no RLS. Everything lives
on Andrew's PC.

---

## 2. DESTINATION — the contract Andrew builds to

### 2.1 `cost_objects` — full field list (from the migrations, not memory)

Base table (`supabase/migrations/20260612_business_assets_inventory_pmi_service.sql:27`,
created as `business_assets`) + cost-confidence ALTER
(`20260612_business_assets_inventory_cost_confidence.sql:32`) + Core-1 node schema
(`20260615_cost_objects_rename_and_node_schema.sql`):

| Column | Type | Notes for capture |
|---|---|---|
| `id` | uuid PK, `gen_random_uuid()` | server-assigned; the stable handle (relevant to §7 QR fork) |
| `business_id` | uuid NOT NULL → businesses, CASCADE | **RLS scope. REQUIRED on every insert.** Net-new vs Andrew. |
| `node_type` | text NOT NULL DEFAULT `'ASSET'`, CHECK ASSET\|PROJECT\|PRODUCT | **Capture always sets `'ASSET'`. Reads MUST filter `node_type='ASSET'`.** (Core-1) |
| `name` | text NOT NULL | ← `Asset_Name` |
| `asset_type` | text | ← `Device_Type` (or folder) |
| `make` | text | ← AI `Brand` |
| `model` | text | ← AI `Model` |
| `serial_number` | text | ← scanned/typed serial |
| `year` | int | ← AI (if returned) or owner |
| `barcode_id` | text | ← scanned manufacturer barcode (see §7) |
| `assigned_to` | jsonb | leave NULL at capture |
| `status` | text NOT NULL DEFAULT `'ACTIVE'`, CHECK ACTIVE\|IN_REPAIR\|OFFLINE\|RETIRED\|**IDLE**\|**UNASSIGNED** | capture offers only the first four — see §6 |
| `acquisition_cost` | numeric(10,2) | ← AI `Estimated_Value` (parsed to number) or owner |
| `cost_confidence` | text, CHECK CONFIRMED\|DERIVED\|ESTIMATED\|UNKNOWN | **the amount-confidence axis — see §2.4** |
| `warranty_months` | int | leave NULL at capture |
| `photo_url` | text | ← uploaded image URL (Supabase Storage — net-new, §5) |
| `location` | text | ← `Location` |
| `notes` | text | ← `Notes` (+ AI `Specs`/`Summary`, see §3) |
| `parent_id` | uuid → cost_objects, ON DELETE SET NULL | **leave NULL at capture** (containment set later via edges UI) |
| `domain` | text | leave NULL at capture (fallback-to-domain, set later) |
| `project_status` | text, nullable | NULL for ASSET rows — ignore |
| `product_status` | text, nullable | NULL for ASSET rows — ignore |
| `is_active` | boolean NOT NULL DEFAULT true | leave default; reads filter `is_active=true` |
| `created_at` / `updated_at` | timestamptz | server-managed |

Indexes that matter: `idx_cost_objects_business_node (business_id, node_type)` — the
asset-UI hot path. RLS: `cost_objects_owner_all` + `cost_objects_member_all`, both
`business_id`-scoped via `businesses.owner_id = auth.uid()` / `business_members`.

> **⚠️ Schema is designed but NOT YET APPLIED.** The Core-1 migration is HELD by David
> (apply manually → `scripts/verify-cost-objects.mjs` catalog gate → seed). Andrew can
> build against the contract now, but the live table is still `business_assets`-shaped
> until David runs it. Coordinate the apply before any end-to-end test.

### 2.2 The proven write pattern (the contract — copy this, change the INPUT)

`packages/cultivar-os/src/pages/BusinessAssets.tsx` is the **proven `/assets` write**.
Capture is a *different input* into the *same write*. The exact shape to mirror:

- **Tenant scope:** `const { businessId } = useBusinessContext();` (`BusinessAssets.tsx:121`)
  — this is the `auth.uid()`-backed RLS scope. **Andrew's tool has no equivalent; this is
  net-new and non-negotiable.** No insert without a real Supabase session.
- **Insert** (`BusinessAssets.tsx:173-194`):
  ```ts
  const payload = {
    business_id: businessId,
    node_type: 'ASSET',        // ← constant, every insert
    name: ...,
    status: ...,               // ACTIVE|IN_REPAIR|OFFLINE|RETIRED
    cost_confidence: ...,      // ESTIMATED|DERIVED|CONFIRMED|UNKNOWN
    // optional fields only added when non-empty:
    asset_type, make, model, serial_number, year, location, notes, acquisition_cost
  };
  await supabase.from('cost_objects').insert(payload);
  ```
- **Read** (`BusinessAssets.tsx:142`): `.from('cost_objects').select(...)
  .eq('business_id', businessId).eq('node_type','ASSET').eq('is_active', true)`.
- **Surface-Honesty rule already coded** (`BusinessAssets.tsx:158`): typing a cost while
  confidence is `UNKNOWN` auto-bumps it to `ESTIMATED`. Capture must preserve this honesty
  discipline (see §2.4).
- **Instrumentation:** `[TRACE:assets]` console logs on every read/insert — STD-003.
  Capture ships its own `[TRACE:capture]` ON BY DEFAULT until David owner-proves it.

### 2.3 SKU path — which table?

If a capture path targets **stock/consumables at SKU+qty grain**, it writes
**`business_inventory`**, NOT `cost_objects`. The proven inventory write is
`packages/cultivar-os/src/pages/BusinessInventory.tsx:168`
(`supabase.from('business_inventory').insert(...)`). Fields:
`sku, name, description, qty, unit_cost, serial_number, location, status, received_at,
photo_url, notes, receipt_id, cost_confidence`
(base migration `:97`; `receipt_id` + `cost_confidence` added in the cost-confidence ALTER `:55`).

**Decision rule for Andrew (which table per capture):**
- A **durable, individually-tracked thing** (tool, machine, vehicle, structure) →
  `cost_objects` `node_type='ASSET'`.
- A **countable stock item** (parts, netting rolls, fittings — "how many do we have") →
  `business_inventory`.
- Andrew's current tool is **asset-shaped** (one photo = one thing, folders as categories,
  per-item value). So **default target = `cost_objects` ASSET.** Only build an inventory
  path if/when David wants SKU+qty stock capture; it's a parallel, not a prerequisite.

### 2.4 The two confidence axes (D-5) — and the schema gap to know

Decision **D-5** (`docs/DECISIONS.md:274`) defines **two independent axes**, preserved in
the seam logic (`packages/shared/src/business-logic/CountOnceSeam.ts:22-23`):

1. **`amountConfidence`** — `CONFIRMED | DERIVED | ESTIMATED | UNKNOWN` (sure of the $ figure).
2. **`substantiation`** — `SUBSTANTIATED` (has a receipt/document) | `OWNER_ASSERTED` (typed, no proof).

**The gap Andrew must know:** the **`cost_objects` table has only ONE column —
`cost_confidence`** — which is the **amountConfidence** axis. There is **no
`substantiation` column and no `receipt_id` column on `cost_objects`** (unlike
`business_inventory`/`business_service_log`, which do have `receipt_id`). The second axis
currently lives only in the in-memory seam, not on the asset row.

**What capture writes today:**
- AI-appraised value (Gemini `Estimated_Value` / live-price) → `cost_confidence = 'DERIVED'`.
- Owner-typed value → `'ESTIMATED'`.
- Receipt-backed value → `'CONFIRMED'` (only once a receipt link exists).
- No value at all → `'UNKNOWN'`.

**Flag for David (not Andrew's call):** if asset capture should carry the substantiation
axis (receipt-or-not) on the row, `cost_objects` needs a `receipt_id uuid REFERENCES
receipts(id)` and/or a `substantiation` column — a one-line ALTER, NOT yet written. Until
then, asset substantiation is unrecordable on the row. Don't let Andrew invent a column.

### 2.5 Receipt Keeper OCR interface (the AI layer to reuse — with one caveat)

The platform already has a **server-side, key-safe vision endpoint**:
`packages/cultivar-os/api/receipts/ocr.ts` (`POST /api/receipts/ocr`).

- **Provider chain:** Gemini 2.5 Flash (primary) → Claude Haiku 4.5 (fallback) → clean error.
  Model names resolved from `platform_config` → env → default (a swap is a config change).
- **Request:** `{ businessId, userId, imageBase64, mimeType, fileSizeBytes }`.
- **STD-010 safety:** MIME allowlist, 10 MB cap, keys never client-side.
- **Returns:** `{ ok, provider, ocr_raw, parsed, parseError, inputTokens, outputTokens,
  ocr_cost_estimate, latencyMs }`.
- **Client usage pattern:** `ReceiptKeeper.tsx:119` (`fetch('/api/receipts/ocr', ...)`),
  with `imageCompression.ts` (`resizeAndCompressImage`) before upload.

**⚠️ Caveat — the prompt is RECEIPT-shaped, not ASSET-shaped.** `ocr.ts:53` extracts
`vendor/date/amount/line_items/...`. Andrew needs `Brand/Model/Device_Type/Estimated_Value/
Specs/Summary` (asset identification). **Reuse the STRUCTURE** (provider chain, key
handling, STD-010, config-driven model, return envelope) and add an **asset-identify
prompt** — either a new endpoint `api/assets/identify.ts` or a `mode: 'asset'` branch in
`ocr.ts`. This is net-new but small; do NOT call Gemini from the client (Andrew's tool
does — that leaks keys; §6).

---

## 3. FIELD-TO-FIELD MAP (Andrew's capture → `cost_objects`)

| Andrew's field (source) | → `cost_objects` column | Disposition |
|---|---|---|
| `Asset_Name` (form / barcode prefill) | `name` | **Ports** (rename) |
| `Location` (form) | `location` | **Ports** |
| `Notes` (form) | `notes` | **Ports** |
| Folder/Category (form dropdown tree) | `asset_type` (or future `parent_id`/`domain`) | **Remaps** — no folder tree in DB; use as `asset_type`, or model as containment later. Not 1:1. |
| AI `Brand` | `make` | **Ports** (rename) |
| AI `Model` | `model` | **Ports** |
| AI `Device_Type` | `asset_type` | **Ports** (collides w/ folder — pick `Device_Type`) |
| AI `Estimated_Value` (string e.g. "$150.00") | `acquisition_cost` (numeric) + `cost_confidence='DERIVED'` | **Ports w/ transform** — parse string→number; live-price = still DERIVED |
| AI `Specs` | `notes` (append) | **Remaps** — no dedicated column |
| AI `Summary` | `notes` (append) | **Remaps** — no dedicated column |
| Scanned barcode (`scanFile` decode) | `barcode_id` (+ optional `name` prefill) | **Ports w/ rewire** — today it only prefills name; wire to `barcode_id` (§7) |
| Serial (typed in Notes today) | `serial_number` | **New field** — promote out of free-text Notes |
| Photo file (saved to disk) | `photo_url` | **Replaced** — upload to Supabase Storage, store URL (§5) |
| Year (not captured today) | `year` | **Net-new** — capture from AI or owner |
| Status (not captured today) | `status` | **Net-new** — default `ACTIVE`; offer 4 values |
| md5 dedup (local hash cache) | — | **Replaced** — DB identity is `id`; dedup is the count-once seam's job, not file hashing |
| — (no tenant concept) | `business_id` | **Net-new, REQUIRED** — from `useBusinessContext` |
| — (no type concept) | `node_type='ASSET'` | **Net-new, REQUIRED** — constant |

### What ports directly (the IP worth keeping)
- The **capture UX flow**: photo → (barcode scan to prefill) → AI identify → owner confirms
  → save. This is the right shape; keep it.
- The **field semantics**: name/location/notes/brand/model/type/value — all have homes.
- The **mobile-first capture page** concept (`upload.html`) → already realized in React by
  `ReceiptKeeper.tsx` (camera capture, base64, compress). Reuse that, don't rebuild it.
- The **barcode-scan-to-prefill** idea (`html5-qrcode`) — keep; rewire target (§7).
- The **QR-label generation** idea (`ui_tools.py:131`) → already in shared:
  `packages/shared/src/qr/generate.ts` + `print.ts`. Reuse; switch payload to `id` (§7).

### What is REPLACED by existing platform infrastructure
- Local Gemini vision call (`server.py:83`) → `/api/receipts/ocr` structure + asset prompt (§2.5).
- JSON sidecar files (`{base}_info.txt`) → `cost_objects` rows.
- Local image storage (`RawElementAssets/`) → Supabase Storage + `photo_url` (§5).
- md5 dedup, CSV export, ZIP backup, pie analytics → DB + existing dashboards; **drop them.**
- FastAPI local server + Tkinter desktop shell → React widget in `cultivar-os` (web).

### What is NET-NEW (didn't exist in Andrew's world)
- `business_id` tenant scope + real Supabase auth session (RLS). **The single biggest add.**
- `node_type='ASSET'` on write, `node_type='ASSET'` filter on read.
- Supabase Storage upload for the photo.
- An asset-identify prompt/endpoint (vs the receipt prompt).
- `cost_confidence` mapping discipline (DERIVED vs ESTIMATED vs CONFIRMED).

---

## 4. RECON LENSES (HAVE / NEED / WANT)

**HAVE** — Andrew's local Python/Tkinter+FastAPI tool: photo capture, barcode-scan prefill,
Gemini identify + live price, local JSON sidecar storage, folder tree, QR-from-name labels,
CSV/backup/analytics. Zero DB, zero tenant, zero auth.
Destination side already built: `cost_objects` schema (designed, unapplied), proven asset
write (`BusinessAssets.tsx`), server-side OCR endpoint (`ocr.ts`), image compression, shared
QR generators, inventory write (`BusinessInventory.tsx`).

**NEED** (irreducible minimum for a capture tool that writes the real table):
1. A real Supabase session + `useBusinessContext().businessId` (RLS).
2. Photo capture → Supabase Storage → `photo_url`.
3. Insert `cost_objects` with `business_id`, `node_type='ASSET'`, `name`, `status`,
   `cost_confidence`, + mapped optionals (§3) — mirroring `BusinessAssets.tsx:173`.
4. `[TRACE:capture]` instrumentation ON by default.

**WANT** (the fuller, friction-removing end-state):
5. AI identify (asset prompt via the `ocr.ts` structure) pre-filling make/model/type/value,
   owner confirms — Andrew's core UX, done key-safe.
6. Barcode-scan prefill wired to `barcode_id` + (fork-dependent) lookup.
7. QR-label print on save (shared `qr/`), payload = `cost_objects.id` (Path A, §7).
8. The substantiation axis recorded on the row (needs the §2.4 ALTER — David's call).

**Build options spanning NEED→WANT:**
- **Min (meets NEED):** a React "Add Asset via Photo" path in `cultivar-os` — camera →
  Storage → manual/typed fields → `cost_objects` insert. No AI. Ships the write contract.
- **Mid:** add the asset-identify AI prefill (WANT-5) — Andrew's actual value-add.
- **Full:** add barcode-wire (WANT-6) + QR-label print (WANT-7) + substantiation column
  (WANT-8). This is the complete tool; sequence after the min path is owner-proven.

---

## 5. PHOTO STORAGE — the one genuinely new subsystem

Andrew writes the image to `RawElementAssets/`. The platform stores `photo_url` (text) on
the row; the bytes go to **Supabase Storage**. This is the only net-new *subsystem* (vs
net-new *field*). Confirm with David whether a Storage bucket for asset photos exists; if
not, that's a small setup step (bucket + RLS) to schedule before the photo path is wired.
The min path (§4) can ship **without** photos (text-only asset) and add `photo_url` after.

---

## 6. ⚠️ WHAT CORE-1 (AND PLATFORM RULES) INVALIDATED — do NOT build the old way

These are the traps that would force a refactor if Andrew built against the pre-Core-1
mental model or against his own local-first assumptions:

1. **Table name:** write to **`cost_objects`**, NOT `business_assets`. Any prior plan or
   note naming `business_assets` is stale (renamed 2026-06-15, Core-1).
2. **`node_type` is mandatory:** every insert sets `node_type='ASSET'`; every read filters
   `node_type='ASSET'`. A pre-Core-1 plan would omit this and silently pull PROJECT/PRODUCT
   rows into the asset list once those exist. This is the #1 refactor-avoider.
3. **`status` enum expanded — but capture does NOT offer the new values.** The enum now
   includes `IDLE` and `UNASSIGNED` (`...node_schema.sql:94`), but those are
   **system-derived** states (set by the rollup/assignment logic, §5.9). Capture offers
   only `ACTIVE|IN_REPAIR|OFFLINE|RETIRED` (mirror `BusinessAssets.tsx:17`). Do not put
   IDLE/UNASSIGNED in the capture dropdown.
4. **`parent_id` / `domain` exist but are NOT set at capture.** Containment + domain are
   assigned later via the edges UI (`cost_object_edges`). Capture leaves them NULL. Don't
   build folder→parent_id wiring into capture (Andrew's folder tree is tempting here — resist).
5. **Separate status columns:** `project_status`/`product_status` are NULL for assets —
   never written by asset capture.
6. **No client-side AI keys.** Andrew calls Gemini directly from `server.py` with a local
   key. On the platform, all vision goes **server-side** through `/api/...` (STD-010,
   `ocr.ts`). Porting the client-side Gemini call would leak keys — replace it.
7. **No file-hash dedup.** Andrew's md5 cache prevents re-saving the same photo. On the
   platform, dedup of *cost signals* is the **count-once seam's** job (`CountOnceSeam.ts`),
   keyed on the event, not the image bytes. Don't reimplement file hashing.
8. **Auth is non-negotiable** (CLAUDE.md Auth Locked Rule): writes happen under a real
   Supabase session (`auth.uid()` non-null). No PIN-only / local-only shortcut for
   multi-tenant asset data.

---

## 7. DESIGN FORK (for David — NOT resolved here)

**The question:** how does a scan resolve to an asset?

- **Path A — generate-our-own-QR labels (clean).** On save, mint a QR encoding the
  `cost_objects.id` (stable UUID), print a label (shared `qr/generate.ts` + `print.ts`
  already exist), stick it on the asset. Later scans resolve **directly** to the row.
  *Pro:* unambiguous, collision-free, works for assets with no manufacturer barcode (a
  welded bracket, a structure). *Con:* a labeling step at capture; labels can fall off.
  **Andrew's `ui_tools.py:131` is a half-built Path A** — it already renders QR labels, but
  encodes the **asset NAME**, not a stable id. Switching the payload to `id` is the change.

- **Path B — read manufacturer barcodes + lookup (harder).** Scan the existing UPC/serial
  barcode already on the item, store in `barcode_id`, and resolve future scans by
  `barcode_id` lookup. *Pro:* no labels to print/manage; uses what's already on the box.
  *Con:* needs a `barcode_id` index + lookup + collision handling; **many assets have no
  barcode** (custom/used equipment, structures); the same UPC repeats across identical
  units (two identical drills) so it identifies a *model*, not an *instance*.
  **Andrew's `upload.html:87` scan path is a half-built Path B** — it reads a manufacturer
  barcode via `html5-qrcode`, but only drops the text into the *name* field; it is not
  wired to `barcode_id` or any lookup.

**What Andrew's current code assumes:** **both, half-way, neither production-wired.** The
mobile page leans Path B (reads manufacturer barcodes as a name hint); the desktop leans
Path A (generates QR labels from names). Neither resolves to a stable `id`. David picks the
canonical path (or "A for instances, B as an optional prefill") before the scan layer is
finalized — the capture min path (§4) does not depend on this decision and can ship first.

---

## 8. RECOMMENDED SEQUENCE (so Andrew builds once)

1. **Coordinate the Core-1 migration apply** with David (table must be `cost_objects`-shaped
   before any end-to-end test; §2.1).
2. **Build the MIN path** (§4): React "Add Asset via Photo/Form" in `cultivar-os`, mirroring
   `BusinessAssets.tsx`'s write — `business_id`, `node_type='ASSET'`, mapped fields,
   `[TRACE:capture]` on. Photos optional at first (§5).
3. **Add AI identify** (WANT-5): asset prompt via the `ocr.ts` structure (server-side).
   This is Andrew's real value-add — the owner photographs, AI fills make/model/value,
   owner confirms.
4. **Owner-prove** the above through the real UI under RLS before adding scan/QR.
5. **Then** the scan/QR layer per David's §7 fork, and (if David approves) the §2.4
   substantiation ALTER.

**Do not** start at step 3/5; the write contract (step 2) is the foundation and the thing
that, if built wrong, forces the refactor this plan exists to prevent.

---

## Appendix — source references (all read from disk 2026-06-15)

- Andrew: `~/Desktop/current inventory code/Local website library/{server.py, upload.html,
  ui.py, ui_tools.py, ui_ai.py, ui_file_ops.py, config.py, main.py}`
- Schema: `supabase/migrations/20260612_business_assets_inventory_pmi_service.sql`,
  `20260612_business_assets_inventory_cost_confidence.sql`,
  `20260615_cost_objects_rename_and_node_schema.sql`
- Write pattern: `packages/cultivar-os/src/pages/BusinessAssets.tsx`,
  `packages/cultivar-os/src/pages/BusinessInventory.tsx`
- OCR: `packages/cultivar-os/api/receipts/ocr.ts`,
  `packages/cultivar-os/src/pages/ReceiptKeeper.tsx`,
  `packages/cultivar-os/src/utils/imageCompression.ts`
- Confidence axes: `docs/DECISIONS.md` D-5,
  `packages/shared/src/business-logic/CountOnceSeam.ts:22-23`
- Shared QR: `packages/shared/src/qr/generate.ts`, `print.ts`
</content>
</invoke>
