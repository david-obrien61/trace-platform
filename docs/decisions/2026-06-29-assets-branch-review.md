# `assets` Branch Review — READ-ONLY (no merge, no modify)

**Date:** 2026-06-29 · **Author:** Thunder · **Type:** review-only recon, doc-only.
**Mandate:** PROMPT 2 of 2 — fetch `assets` read-only, review Andrew's asset + camera work, map conflicts, propose a LATER integration sequence. **Do NOT merge/rebase/edit/push/delete `assets`. End on a clean main.** David drives the actual integration as a separate, approved step.

**Branch facts (read-only `git fetch origin assets`):**
- Tip: `5fc41e4` *"feat: assimilate local asset library component into shared workspace and connect to Supabase database backends"* — author `koben893 <aobrienaf@gmail.com>` (Andrew), Sun Jun 28 2026.
- Merge-base with main: `6d2e143` (the size-variant capture close-out, ledger #62).
- Ahead/behind vs `origin/main` (`50a3d11`): **1 ahead · 9 behind**. (The prompt said "behind 4" — main has advanced to **9** since Andrew branched; the extra 5 are the session-persistence fix + doc banks. Non-blocking — see Conflict Check.)
- The 1 commit ahead = `5fc41e4`: **18 files, +3937 / −1. No `.sql` files → no migrations, no DDL.**

---

## 1. What the 1-commit-ahead adds

### 1a. A standalone Python desktop/mobile capture tool — new `assets/` dir
A self-contained FastAPI + Tkinter app (the "asset + camera function"):
- `server.py` (609) — FastAPI `APIRouter` prefixed **`/api/assets`**: `upload`, `analyze` (Gemini image analysis), `fetch_price` (Gemini live price lookup), `backup`. Mounts `StaticFiles` at **`/api/assets/files`** serving raw uploaded images from **local disk** (`ASSET_DIR` / `RawElementAssets/`).
- `ui.py` (805) + `ui_ai.py` / `ui_file_ops.py` / `ui_tools.py` — Tkinter desktop UI.
- `config.py` (absolute-path resolution + `get_api_key()` — **Gemini key from local config**), `main.py`, `requirements.txt`, `install_and_run.bat`, `upload.html` (mobile photo-upload page).

### 1b. A new shared React component — `packages/shared/src/components/AssetManager.jsx` (1520 lines)
A "visual" asset-library viewer built on a **Schema Adapter Pattern** (Andrew's `assetimplement.md` documents this well):
- Props: `supabase`, `tableName`, `businessId`, `businessIdColumn`, `fieldMap`, `filterQuery`, `defaultInsertValues`, `theme` (`'light'|'dark'`), `onBack`.
- Reads/writes **any** table dynamically through `fieldMap` (a logical→column map; `null` fields are skipped so it never errors on a missing column).
- **Rich-metadata serialization:** when the target table has a `notes` column, it JSON-packs `imageUrl`/`specs`/`price`/`userNotes` into `notes` and parses them back on load (so tables lacking dedicated columns still carry the AI specs/price without a migration).
- **Camera/AI features call `${'/api/assets'}/upload|analyze|fetch_price|backup`** via `fetch` — i.e. the local Python backend, not Supabase directly.
- `API_PREFIX = '/api/assets'`; built-in light (Cultivar sage `#EAF3DE`/`#27500A`) and dark (Ignition `#020617`/`#38bdf8`) themes.

### 1c. Wiring into the two verticals
- **Cultivar** — `BusinessAssets.tsx` (+32): adds `viewMode: 'table'|'visual'` + a "Switch to Visual View / Switch to Editable Ledger" button; visual mode renders `<AssetManager>` bound to **`cost_objects`** with `filterQuery → .eq('node_type','ASSET').eq('is_active',true)`, `fieldMap` name/asset_type(make→brand)/model/serial_number/acquisition_cost(price)/notes, `defaultInsertValues { node_type:'ASSET', is_active:true, status:'ACTIVE', cost_confidence:'ESTIMATED' }`, `theme="light"`.
- **Ignition** — new `IgnitionAsset.jsx` (binds `<AssetManager>` to **`tools`**, `shop_id` via `DataBridge.getShopId()`, `theme="dark"`, `notes:null`) + `IgnitionAsset.native.js`; `CoreApp.jsx` (+9/−1) adds an `'ASSETS'`/"Asset Lib" dashboard tile + module route wrapped in `AccessGatekeeper requiredPermissions={[]}`; `vite.config.js` (+6) adds a dev proxy **`/api → http://localhost:8000`**.

### 1d. Data model touched
- **Cultivar:** existing **`cost_objects`** (node_type='ASSET'), reusing existing columns name/asset_type/make/model/serial_number/acquisition_cost/notes — **no new column**. AI specs/price ride in `notes` as JSON.
- **Ignition:** existing **`tools`** table (shop_id). *(Ignition's own Supabase project — separate vertical.)*
- **No schema migration anywhere.**

---

## 2. CRITICAL CONFLICT CHECK — collision with the size-variant / inventory work

**Verdict: NO collision — neither git-textual nor schema.**

| Check | Result |
|---|---|
| Size-variant target table | `business_inventory` (cols `size`, `variant_group` — migration `20260628_inventory_size_variants.sql`) |
| Assets target table(s) | `cost_objects` (cultivar) + `tools` (ignition) — **different tables, never `business_inventory`** |
| Schema collision | **None.** Assets adds no migration; touches a disjoint table set. |
| File overlap (main's 9 commits ∩ assets' 18 files) | **Empty set** (`comm -12` of the two changed-file lists) → **zero textual merge conflicts** |
| `20260628_inventory_size_variants.sql` divergence | **None** — it lives in the merge-base lineage (`6d2e143` carries `9f1063e` size-variant capture). The file is byte-identical-present in **both** `origin/main` and `origin/assets`; neither side re-touched it. assets is built **on top of** the size-variant work. |
| `BusinessAssets.tsx` (the one cultivar file assets edits) | main did **not** touch it in its 9 commits → only assets changed it → merges clean. |
| Session fix (`BusinessProvider.tsx`, main `9cb6d8e`) | Different file from `AssetManager.jsx` → no conflict. |

The "behind 9" is purely main-side content (the session-persistence fix in `BusinessProvider.tsx` + doc banks) that touches **none** of the 18 assets files. Bringing main into assets should be conflict-free.

---

## 3. Auth / RLS / schema flags

1. **No schema / migration / DDL.** ✅ Nothing to verify at the catalog gate from this branch.
2. **RLS is respected on the cultivar path.** `AssetManager` uses the passed anon `supabase` client + `businessId`/`filterQuery`, so writes to `cost_objects` ride the existing `cost_objects_owner_all` + `cost_objects_member_all` RLS (tenant-scoped). No service-key, no bypass. ✅
3. **⚠️ Cost-model honesty interaction (cultivar).** `defaultInsertValues` sets `cost_confidence:'ESTIMATED'` while `acquisition_cost` may be blank on insert. That is exactly the **"confidence set but no amount" incoherence** the D-9 coherence rule + the 2026-06-18 `/assets` inline editor were built to *prevent* (UNKNOWN ⟺ no amount). **Verify during integration** that a no-price visual insert lands coherently (UNKNOWN, not ESTIMATED-with-null).
4. **⚠️ `notes` JSON-packing on `cost_objects`.** The cost-to-produce engine + project-lens drill-in read `cost_objects.notes` as free text. A JSON blob (`{imageUrl,specs,price,userNotes}`) there may render oddly in those cost surfaces. **Verify** the drill-in / receipt views tolerate it (or split the AI metadata into its own column later).
5. **⚠️ Ignition route is ungated** — `AccessGatekeeper requiredPermissions={[]}` = open to every role. Likely fine for an asset library, but a conscious call (consistent with the role-machine visibility axis).
6. **🚩 Camera/AI pipeline is local-dev-only as wired (the biggest integration consideration).** `/api/assets/upload|analyze|fetch_price` resolve via the vite dev proxy to the **local Python FastAPI server on `localhost:8000`**, and captured images persist to **local disk** (`StaticFiles` at `/api/assets/files`), not Supabase Storage. In a Vercel deploy these endpoints don't exist → the photo-capture + Gemini-analyze + price-fetch features will fail, and `photo_url`/`imageUrl` references point at a localhost path. **The visual ledger + Supabase read/write WILL work in production; the capture/AI half will not, until the Python endpoints are ported to serverless + images move to Supabase Storage.** Note the **Vercel Hobby 12-function ceiling** (tech-debt #41) — `api/` is already at 12, so adding `/api/assets/*` as functions needs Vercel Pro first. Gemini key is local-config, not in Vercel env (same constraint).

---

## 4. Build / quality state of the branch as-is

- **Andrew self-reports "checks 3/3"** (`assetimplement.md` §5): Ignition compiles (Rollup/Vite), Cultivar compiles (Vite), Python syntax check passes. These cover **buildability**, not this repo's quality gate.
- **NOT yet measured against `npm run verify`** (tsc / eslint / knip / verify-universals, baseline-and-ratchet vs `quality-baseline.json`). `AssetManager.jsx` is a new **1520-line plain `.jsx`** (not `.tsx`) in `packages/shared/src/components/`. `shared` is treated as all-entry for knip (so it won't be flagged dead), but eslint (`no-unused-vars`, `react-hooks/*`) will scan it and may surface **net-new** violations above the current baseline (eslint 266). **The gate must be re-run on the branch once it's current with main, before any merge to main.**

---

## 5. PROPOSED integration sequence (RECOMMENDATION ONLY — David drives; merge/build nothing now)

Do this **on the `assets` branch**, where conflicts resolve deliberately — never by merging main's history backward through assets:

1. **Bring main INTO assets first.** On `assets`: `git merge origin/main` (resolves "behind 9"). Expected **clean** — zero file overlap (§2). Sanity-check `BusinessAssets.tsx` still compiles afterward (the one cultivar file assets edits).
2. **Run the quality gate on the updated assets branch.** `npm run verify` → confirm **zero NET-NEW** vs the current baseline. This is where `AssetManager.jsx` (large, new) surfaces in eslint/knip. Fix net-new (or `quality:baseline` if a metric legitimately drops) before going further.
3. **Decide the production story for the camera pipeline (§3.6) — a David + Andrew product/infra call, not a merge mechanic.** Either (a) ship the **visual ledger + Supabase persistence only** and gate the camera/AI capture behind a local-dev flag, or (b) port `/api/assets/*` to Vercel functions (blocked by the 12-function ceiling → Vercel Pro first, tech-debt #41) **and** move image storage to Supabase Storage so `photo_url` is cloud-served.
4. **Resolve the `cost_objects` honesty interaction (§3.3–3.4)** for the cultivar binding — no-price insert must land coherently; confirm `notes` JSON-packing doesn't break the cost-to-produce / project-lens surfaces.
5. **Decide ignition route gating (§3.5).**
6. **Only after 1–2 are green and 3–5 are decided:** merge `assets → main`, run `npm run verify` on main, then OWNER-PROVE on device.

**Specific points for David + Andrew to resolve — none are git-textual conflicts; all are semantic/infra:**
- **(A)** Camera pipeline production wiring (localhost Python + local image storage → serverless + Supabase Storage, or local-dev-gated).
- **(B)** `cost_objects` coherence: `cost_confidence='ESTIMATED'` + possibly-null `acquisition_cost`; JSON in `notes`.
- **(C)** Ignition `AccessGatekeeper requiredPermissions={[]}` gating.
- **(D)** Quality-gate net-new from `AssetManager.jsx` (re-run `npm run verify` on the updated branch).

---

## 6. This pass — confirmation

- `assets` was **fetched read-only**; inspected via `git show`/`git diff` against the merge-base and `origin/main`. **Not merged, not rebased, not edited, not pushed, not deleted.** The "behind 9" was **not** resolved (that's the David-approved later step).
- Working tree was on the feature branch with **pre-existing** dirty clutter (untracked `data/grower-scan/*` + `docs/decisions/*`, modified `AFTER-FLIP-snapshot.json`) — David approved proceeding read-only since the review touches none of it. The tree was **not** switched to main and the dirty files were left exactly as-is.
- Only write this pass: this review doc + the close-out ledger row.
