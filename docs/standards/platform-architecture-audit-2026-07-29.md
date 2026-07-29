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
`op.table`) are named as gaps and not resolved. **A5/A6 have no mechanical check** — those columns are
a read of the code, not a measurement, and are marked `~` where inferred. **A4 was in that group when
this audit was written and is now MEASURED** (`verify:field-lists`, same day) — see §3, where the
measurement contradicted the read. §5 carries the running measured-vs-read table.

---

## 2. The table

`✅` meets · `🔴` violates · `~` inferred, not mechanically measured · `—` not applicable

| Entity | Paths | UI | Mod | Mach | A1 surface | A2 write path | A3 commit | **A4 field list ✅MEASURED** | A5 design | A6 validation |
|---|---|---|---|---|---|---|---|---|---|---|
| **`cost_objects`** | **6** | **6** | 0 | 0 | 🔴 4 editors | 🔴 **6, no module at all** | ~🔴 mixed | 🔴 **6** (1 a verbatim copy) | ~🔴 own sheets | 🔴 none shared |
| **`business_members`** | **7** | 2 | 0 | 5 | ~✅ | 🔴 7 (lifecycle) | — | 🔴 **2** | ~✅ | ~✅ funnel |
| **`businesses`** | **7** | 2 | 0 | 3 | 🔴 2 (Onboarding+Settings) | 🔴 7 | ~🔴 | 🔴 **7 — the WORST on this axis** | ~✅ | ~🔴 |
| **`business_inventory`** | **6** | 2 | 1 | 3 | ~✅ InventoryEditor | 🔴 6 | ~🔴 create vs edit | 🔴 **6** | ✅ DataSheet | ~✅ inventoryEdit |
| **`business_inventory_ledger`** | **5** | 2 | 1 | 2 | — | ✅ **declared** (1 emitter) | — | — | — | ✅ append-only |
| **`customers`** | **5** | 1 | 1 | 3 | 🔴 **3 surfaces** | 🔴 5 | 🔴 **2 models, 1 component** | 🔴 **2** (was 6; phase A credited by the cap) | 🔴 own modal | 🔴 **rule on a surface** |
| **`member_devices`** | **4** | 0 | 0 | 4 | — | 🔴 4 | — | ~🔴 | — | ~✅ |
| **`audit_log`** | **3** | 1 | 1 | 1 | — | 🔴 3 (all RPC) | — | — | — | ✅ |
| **`orders`** | **3** | 0 | 0 | 3 | — | 🔴 3 | — | ~✅ | — | ✅ submit.ts |
| `business_accounting_secrets` | 2 | 0 | 0 | 1 | — | ✅ **declared** | — | ✅ | — | ✅ |
| `business_modules` | 2 | 0 | 0 | 2 | — | 🔴 2 | — | 🔴 **2** | — | ~✅ |
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
density at audit time: `CustomerPartyEditor` 17 onBlur + 1 submit (two models in one component),
`InventoryEditor` 5 + 1 (**same create-vs-edit split**), `Settings` 3 + 0, `ProjectCostTree` 3 + 0,
`OperatingCosts` 1 + 5. There was no platform default; each surface chose.

**✅ THE PATTERN IS NOW RULED (2026-07-29) — E2 by shape, and it is ruled ONCE:** a panel where the
RECORD is the unit of work is a FORM and commits on Save; a grid where the CELL is the unit of work
auto-saves. **`CustomerPartyEditor` is converted (phase B).** `InventoryEditor` and `OperatingCosts`
are backlog rows **5b and 5c with the pattern already decided**, so each is a mechanical application
rather than another ruling — which is the whole point of ruling it once.

**A4 — ✅ NOW MEASURED (`npm run verify:field-lists`, 2026-07-29), and the measurement CORRECTED this
audit within a day of writing it.** Seven entities carry more than one hand-written column
enumeration: **`businesses` 7** · **`business_inventory` 6** · **`cost_objects` 6** ·
`business_members` 2 · `business_modules` 2 · `customers` 2 · `order_items` 2.

**🔴 The two worst are NOT `customers`.** This audit scored A4 from a read and ranked `customers`
top; the cap says `businesses` and `business_inventory` beat it. **The closing caveat in §5 — that
A4/A5/A6 marks are one pass's read, not a measurement — proved itself within twenty-four hours,
against this document's own author.** That is the argument for landing a cap per column rather than
trusting the table.

Three of the duplicates are **verbatim COPIES** rather than divergences (`businesses`,
`cost_objects`, `order_items`) — worth separating, because the fix differs: a copy is deleted, a
divergence has to be reconciled first.

**`customers` dropped 6 → 2** and the cap, not the builder, is what credits it: the roster's select
now comes from an imported derived constant, which the cap deliberately does not count as an
enumeration. The two survivors (`qbo/invoice`, `customerUpsert`) are both machine writers.

**Counts here are still a FLOOR** — the cap sees column strings, not TS interfaces, payload object
literals, or `select('*')`. `customers` genuinely had six lists; the cap can see two of them.

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
| **5b** | **`business_inventory` (InventoryEditor) — A3 only** | **The pattern is already RULED, so this is mechanical, not a ruling.** `InventoryEditor` has the IDENTICAL create-vs-edit split customers had (5 onBlur + 1 submit). | Apply E2 by shape: the record is the unit of work → it is a FORM → buffer + one Save, Cancel discards. Follow `CustomerPartyEditor` phase B verbatim, incl. a `buildInventoryPatch` diff in `inventoryEdit.ts`. |
| **5c** | **`cost_objects` (OperatingCosts) — A3 only** | Went the OPPOSITE way (1 onBlur + 5 submits) — also not the ruled shape, in the other direction. | Same ruling, applied the other way: whichever controls are per-record buffer to the existing Save; any that are genuinely per-cell move to the grid. Rides row 5's `cost_objects` work. |
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

- **Which columns are MEASURED, and which are still a read** — updated as each cap lands, per the
  promise this section made:
  | Column | State | Instrument |
  |---|---|---|
  | A2 write path | ✅ **measured** | `verify:write-paths` |
  | A4 field list | ✅ **measured** (2026-07-29) | `verify:field-lists` |
  | A8 zero-row write | ✅ **measured** (2026-07-29) | `verify:zero-row-writes` |
  | A7 gate strings | ◐ partial | `verify-universals` capP/capQ |
  | A1 surface · A3 commit · A5 design · A6 validation | ✗ **still a read** | none |
  Every `~` remaining is one pass's read. **A4 was a read until the cap landed, and the cap
  contradicted it** — treat the remaining four the same way until they are instrumented.
- **A5 has no number yet.** A first per-file count (10 of 99 `.tsx` importing `sheetStyles`) is
  recorded above, but the agreed unit is **per SURFACE, not per file**, and that unit is not yet
  defined. No per-surface figure is quoted here rather than quoting a wrong one.
- **Counts are a floor** (A2's known limits: two-hop RPC chains, `EXECUTE`, functions outside the
  migration path, 12 dynamic table expressions).
- **`trace-app` and the discovery module were scanned but are thin** — no entity above is owned there.
- **Read paths are only counted where they carry a field list.** A surface that reads an entity with
  `select('*')` is invisible to this audit entirely.
