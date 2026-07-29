# Platform Architecture Audit — every entity against A1–A7

**Date: 2026-07-29 · Measurement only. Nothing was fixed.**
Scores against [`platform-architecture-standard.md`](./platform-architecture-standard.md).
The list IS the deliverable; the ordered backlog is §4.

---

## 1. Method and corpus (STD-021)

**Corpus scanned:** `packages/cultivar-os/src`, `packages/cultivar-os/api`, `packages/shared/src`,
`packages/trace-app/src`, `api/`, `scripts/`, `supabase/migrations/*.sql`.
**Excluded, deliberately:** `packages/ignition-os` (frozen donor code, CLAUDE.md §2), `dist/`,
`node_modules/`, `*.test.*`.

**How each column was derived:**
- **Write paths** — `npm run verify:write-paths` (mechanical; a path is a FILE). Includes RPC callers
  resolved from migration bodies **one hop deep**.
- **UI / module / machine split** — classified by path: `pages/`+`components/` = UI surface,
  `*Edit.ts` = write module, `api/`+`business-logic/`+`auth/`+`discovery/` = machine writer.
- **Field lists** — counted hand-written `.select('a,b,c…')` column strings plus declared row
  types/unions per entity.
- **Commit model** — `onBlur=`-commit density vs submit-button presence per surface.
- **Shared components** — `sheetStyles` / `DataSheet` import vs own-copy `const overlay`/`const dialog`.

**🔴 EVERY COUNT IS A FLOOR.** The write-path cap reads source; two-hop RPC chains, `EXECUTE` bodies,
functions created outside the migration path, and 12 dynamic table expressions (incl. `syncEngine`'s
`op.table`) are named as gaps and not resolved. A4/A5/A6 have **no mechanical check at all** — those
columns are a read of the code, not a measurement, and are marked `~` where inferred.

---

## 2. The table

`✅` meets · `🔴` violates · `~` inferred, not mechanically measured · `—` not applicable

| Entity | Paths | UI | Mod | Mach | A1 surface | A2 write path | A3 commit | A4 field list | A5 design | A6 validation |
|---|---|---|---|---|---|---|---|---|---|---|
| **`cost_objects`** | **6** | **6** | 0 | 0 | 🔴 4 editors | 🔴 **6, no module at all** | ~🔴 mixed | 🔴 4 select strings | ~🔴 own sheets | 🔴 none shared |
| **`business_members`** | **7** | 2 | 0 | 5 | ~✅ | 🔴 7 (lifecycle) | — | ~🔴 | ~✅ | ~✅ funnel |
| **`businesses`** | **7** | 2 | 0 | 3 | 🔴 2 (Onboarding+Settings) | 🔴 7 | ~🔴 | ~🔴 | ~✅ | ~🔴 |
| **`business_inventory`** | **6** | 2 | 1 | 3 | ~✅ InventoryEditor | 🔴 6 | ~🔴 create vs edit | ~🔴 | ✅ DataSheet | ~✅ inventoryEdit |
| **`business_inventory_ledger`** | **5** | 2 | 1 | 2 | — | ✅ **declared** (1 emitter) | — | — | — | ✅ append-only |
| **`customers`** | **5** | 1 | 1 | 3 | 🔴 **3 surfaces** | 🔴 5 | 🔴 **2 models, 1 component** | 🔴 **6 lists → 3** | 🔴 own modal | 🔴 **rule on a surface** |
| **`member_devices`** | **4** | 0 | 0 | 4 | — | 🔴 4 | — | ~🔴 | — | ~✅ |
| **`audit_log`** | **3** | 1 | 1 | 1 | — | 🔴 3 (all RPC) | — | — | — | ✅ |
| **`orders`** | **3** | 0 | 0 | 3 | — | 🔴 3 | — | ~✅ | — | ✅ submit.ts |
| `business_accounting_secrets` | 2 | 0 | 0 | 1 | — | ✅ **declared** | — | ✅ | — | ✅ |
| `business_modules` | 2 | 0 | 0 | 2 | — | 🔴 2 | — | ~✅ | — | ~✅ |
| `business_pricing_config` | 2 | 0 | 0 | 2 | — | 🔴 2 | — | ~✅ | — | ✅ classified |
| `campaign_posts` | 2 | 1 | 0 | 1 | ~✅ | 🔴 2 | ~✅ | ~✅ | ~✅ | ~✅ |
| **`deliveries`** | **2** | 1 | 0 | 1 | ~✅ | 🔴 2 | ~✅ | ~✅ | ~✅ | ~🔴 |
| `invitations` | 2 | 0 | 0 | 2 | — | 🔴 2 | — | ~✅ | — | ~✅ |
| `labor_resources` | 2 | 1 | 0 | 1 | ~✅ | 🔴 2 | ~🔴 | 🔴 2 selects | ~🔴 | ~✅ |
| `nursery_profiles` | 2 | 2 | 0 | 0 | 🔴 2 (Onboarding+Settings) | 🔴 2 | ~🔴 | ~🔴 | ~✅ | ~🔴 |
| `service_offerings` | 2 | 1 | 0 | 1 | ~✅ | 🔴 2 | ~✅ | ~✅ | ~✅ | ~✅ |
| `social_drafts` | 2 | 1 | 0 | 1 | ~✅ | 🔴 2 | ~✅ | ~✅ | ~✅ | ~✅ |
| `receipts` | 1 | 1 | 0 | 0 | ✅ | ✅ | ✅ buffered | ~✅ | ~✅ | ✅ |
| `people` · `order_items` · `order_service_selections` · `order_compliance_records` · `campaigns` · `business_voice_samples` · `business_pmi_schedule` · `business_service_log` · `business_discovery_profiles` · `labor_resource_wages` · `member_device_handoffs` · `cultivar_plants` · `role_definitions` | 1 each | — | — | — | — | ✅ | — | ~✅ | — | ~✅ |

**Totals: 33 entities · 80 write paths · 17 violate A2 · 2 declared · 14 clean at one path.**

---

## 3. Findings by rule

**A2 (enforced) — 17 of 33 entities have more than one undeclared write path.** The distribution
matters more than the count: `cost_objects` has **six paths and no write module at all** — six UI
components each calling `supabase.from('cost_objects')` directly, which is the purest instance of the
Supabase-gives-you-nothing problem in the codebase. By contrast `business_members`' seven are
lifecycle stages behind a funnel and are largely a **declaration exercise**.

**A1 — four entities have more than one edit surface:** `customers` (3), `businesses` (2),
`nursery_profiles` (2, both Onboarding *and* Settings write the profile — plus a third path through
the `set_business_profile` RPC), `cost_objects` (4 editors).

**A3 — commit models are inconsistent platform-wide, not just on customers.** Measured by onBlur
density: `CustomerPartyEditor` 17 onBlur + 1 submit (two models in one component),
`InventoryEditor` 5 + 1 (**same create-vs-edit split**), `Settings` 3 + 0, `ProjectCostTree` 3 + 0,
`OperatingCosts` 1 + 5. There is no platform default; each surface chose.

**A4 — hand-written field lists are everywhere, not only on customers.** Seven files carry multi-column
`.select()` strings; **`cost_objects` is read through four different ones** (`CostToProduce`,
`ProjectCostTree`, `CostToProduceSettings` ×2, `OperatingCosts`), each a different subset. Only
`customers` has a derived registry today (phase A).

**A5 — the shared vocabulary reaches 10 of 99 `.tsx` files.** Two components carry own-copy
`const overlay`/`const dialog` modal styles. This is the least-enforced rule and the widest gap; it is
also the one most likely to be dismissed as cosmetic, which is why it is measured here.

**A6 — the clean counter-example stands alone but is not unique.** `CustomerCapture` owns a private
10-digit phone rule and silently drops a phone that fails it. `deliveries` and `nursery_profiles` carry
surface-local rules with no shared entity module to hold them.

**A7 — partially enforced; the standing hole is #164's:** every negative assertion scans for what the
model USED TO declare, none for what it NO LONGER declares.

---

## 4. Build 3 — the ordered backlog, DEMO PATH FIRST

**Demo path = what a buyer touches: checkout · orders · customers · delivery · inventory.**
Everything else waits, however bad its numbers.

| # | Entity | Why here | Shape of the work |
|---|---|---|---|
| **1** | **`customers`** | Demo path. Worst A-score on the platform: 3 surfaces, 5 paths, 6 field lists, 2 commit models, an entity rule on a surface. Already scoped; phase A done. | Phases B (one commit model) → C (absorb `CustomerEditModal`) → D (`customerUpsert` write rules + 4 read repoints, **ungated**). Realistic floor **3 paths**, not 1. |
| **2** | **`business_inventory` + `_ledger`** | Demo path and the spine D-49/D-50 rest on. 6 paths, 5 of them RPC. | **Not a form merge** — a helper-and-RPC question. `inventoryEdit.ts` exists and is the model; the work is deciding which RPC callers route through it and which are declared. The ledger is **already declared** (one emitter, append-only). |
| **3** | **`deliveries`** | Demo path. Only 2 paths — cheap. | Likely one merge (`api/customers/create` + `DeliverySchedule`) or one declaration. Also carries the A6 gap. |
| **4** | **orders family** | Demo path. `orders` 3 paths; the three child tables are already clean at 1. | Mostly **declarations** — `submit.ts` is the real writer, `qbo/invoice` writes back an id, `populate` is seed/cleanup. |
| **5** | **`cost_objects`** | **Worst absolute violation** (6 UI paths, no module) but **NOT demo path** — the buyer does not open `/costs`. | The biggest single build: extract a `costObjectEdit.ts` module, consolidate 4 editors, unify 4 select strings. Do it after the demo path is clean. |
| **6** | `nursery_profiles` · `businesses` | 2 surfaces each, both Onboarding+Settings, plus an RPC. Touched at signup, not during a demo. | Merge the two write sites; likely one shared profile module. |
| **7** | `business_members` · `invitations` · `member_devices` | Lifecycle stages behind the funnel. | **Declaration exercises**, not merges. Cheapest rows on the board. |
| **8** | `business_modules` · `business_pricing_config` · `labor_resources` · `service_offerings` · `social_drafts` · `campaign_posts` | 2 paths each, none demo-critical. | Case-by-case: declare or merge. |
| **9** | **A5 sweep** (design system) | Cuts across every row above. | Not an entity fix. Its own build: move the two own-copy modals onto the shared control, then raise `sheetStyles` uptake deliberately rather than incidentally. |

**Sequencing note:** rows 1–4 are the demo path and total roughly the work of row 5 alone. That is the
argument for the order — the buyer-facing surfaces are cheaper *and* more valuable than the worst
number on the board.

---

## 5. What this audit does not know

Stated so the table is not read as complete:

- **A4/A5/A6 have no mechanical check.** Every `~` in those columns is a read of the code by one pass,
  not a measurement. A second reader would score some of them differently.
- **Counts are a floor** (A2's known limits: two-hop RPC chains, `EXECUTE`, functions outside the
  migration path, 12 dynamic table expressions).
- **`trace-app` and the discovery module were scanned but are thin** — no entity above is owned there.
- **Read paths are only counted where they carry a field list.** A surface that reads an entity with
  `select('*')` is invisible to this audit entirely.
