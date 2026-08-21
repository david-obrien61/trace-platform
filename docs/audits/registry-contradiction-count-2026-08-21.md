# REGISTRY CONTRADICTION COUNT — 2026-08-21

**Type:** MEASUREMENT. Count only. Nothing was fixed, nothing was ruled, nothing is recommended.
**Ordered by:** David, after finding two instances by looking at screenshots on a phone.
**Bar:** no app code, no schema, no migration, no policy change. `tileRegistry.ts` is byte-identical
to `9da6790` (proven below).
**Instrument:** `scripts/measure-registry-contradictions.mjs` — a one-off, **deliberately NOT chained
into `npm run verify`**.

---

## THE COUNTS

```
Q1  contradicting capability pairs ...................... 12
Q2  section / route disagreements ........................ 22   (of 27 routed nav nodes)
Q3  module paired to a tile nobody draws .................. 5
Q4  write paths recorded for `businesses` ................. 7   (undeclared)
```

**The class being measured, stated once:** A REGISTRY ROW CAN BE INTERNALLY VALID AND STILL BE FALSE
ABOUT THE WORLD. `verify-tile-fields` passes over every instance below, **correctly** — it asserts a
row is COMPLETE and VALID against its own schema and that catalog↔tile pairs exist in both
directions. It has no assertion comparing one row to ANOTHER ROW DESCRIBING THE SAME THING, and none
comparing a declared `section` against an actual `route`.

**Two found by accident was not the size of it.** The two David found are `discounts` /
`contractor_tiers` (1 of the 12 in Q1) and `nav_accounting` (1 of the 22 in Q2).

---

## Q1 — CONTRADICTING CAPABILITY PAIRS · **12**

Every pair of `TILE_REGISTRY` rows sharing a `required_permission` whose `status` values differ.
Permission groups with no disagreement are not listed. `—` = field ABSENT.
`renderable` = the tile is returned by `dashboardTiles()`, the only renderer that exists.

| # | permission | key | status | placement | route | module_key | renderable |
|---|---|---|---|---|---|---|---|
| 1 | `member` | `metric_installs` | live | dashboard | — | — | no |
| | | `services` | planned | TBD | — | — | no |
| 2 | `member` | `metric_plants` | live | dashboard | — | — | no |
| | | `services` | planned | TBD | — | — | no |
| 3 | `orders:read` | `leakage_alert` | live | dashboard | — | — | no |
| | | `opportunities` | planned | dashboard | — | — | **yes** |
| 4 | `pricing_recipe:update` | `contractor_tiers` | **planned** | settings | — | `contractor_tiers` | no |
| | | `discounts` | **live** | admin | `/discounts` | — | no |
| 5 | `settings:read` | `business_profile` | live | settings | `/settings` | — | no |
| | | `online_shop` | planned | settings | — | `online_shop` | no |
| 6 | `settings:read` | `business_profile` | live | settings | `/settings` | — | no |
| | | `seasonal_module` | planned | settings | — | `seasonal_module` | no |
| 7 | `settings:read` | `install_price` | live | settings | `/settings` | — | no |
| | | `online_shop` | planned | settings | — | `online_shop` | no |
| 8 | `settings:read` | `install_price` | live | settings | `/settings` | — | no |
| | | `seasonal_module` | planned | settings | — | `seasonal_module` | no |
| 9 | `settings:read` | `qb_invoicing` | live | settings | `/settings` | `qb_invoicing` | no |
| | | `online_shop` | planned | settings | — | `online_shop` | no |
| 10 | `settings:read` | `qb_invoicing` | live | settings | `/settings` | `qb_invoicing` | no |
| | | `seasonal_module` | planned | settings | — | `seasonal_module` | no |
| 11 | `settings:read` | `qb_status` | live | dashboard | — | — | no |
| | | `online_shop` | planned | settings | — | `online_shop` | no |
| 12 | `settings:read` | `qb_status` | live | dashboard | — | — | no |
| | | `seasonal_module` | planned | settings | — | `seasonal_module` | no |

**Structure of the number, without interpreting it:** the 12 pairs involve **7 distinct
permissions-worth of disagreement across 4 permission strings** — `settings:read` alone produces 8 of
the 12 (4 live rows × 2 planned rows), `member` produces 2, and `orders:read` and
`pricing_recipe:update` produce 1 each. Pair 4 is the one David found.

---

## Q2 — SECTION / ROUTE DISAGREEMENT · **22 of 27**

For every `NAV_IA` node carrying both a `section` and a resolved route: does the route's first path
segment match the first path segment of its own section root's route?

**How a `tileKey` node was resolved:** through the REAL `navRoute()` — inline `route` wins; else the
referenced tile's `route`; else `null`. This is the same function the nav rail and the breadcrumb
call, so resolution here cannot drift from resolution in the app. Nodes resolving to `null` (a
non-linking heading) are EXCLUDED — they make no URL claim to contradict. There are none today; all
27 nodes resolve to a route.

**Per section:**

| section | root node | root route | routed nodes | disagree |
|---|---|---|---|---|
| dashboard | `sec_dashboard` | `/dashboard` | 15 | **14** |
| settings | `sec_settings` | `/settings` | 3 | **1** |
| admin | `sec_admin` | `/admin` | 9 | **7** |

**The 5 that agree:** `sec_dashboard`, `sec_settings`, `sec_admin` (each a root compared with
itself), `nav_all_settings` (`/settings/all`), `nav_subscription` (`/admin/subscription`).

**The 22 that disagree:**

| node | section | section root route | actual route | resolved via |
|---|---|---|---|---|
| `nav_orders` | dashboard | `/dashboard` | `/orders` | tile `qr_checkout` |
| `nav_customers` | dashboard | `/dashboard` | `/customers` | tile `customers` |
| `nav_delivery` | dashboard | `/dashboard` | `/delivery-schedule` | tile `delivery` |
| `nav_delivery_route` | dashboard | `/dashboard` | `/deliveries` | inline route |
| `nav_operating_costs` | dashboard | `/dashboard` | `/operating-costs` | tile `operating_costs` |
| `nav_assets` | dashboard | `/dashboard` | `/assets` | tile `assets` |
| `nav_inventory` | dashboard | `/dashboard` | `/inventory` | inline route |
| `nav_inventory_reconcile` | dashboard | `/dashboard` | `/inventory/reconcile` | inline route |
| `nav_receipts` | dashboard | `/dashboard` | `/receipts` | tile `receipt_keeper` |
| `nav_pmi` | dashboard | `/dashboard` | `/pmi` | tile `pmi` |
| `nav_social` | dashboard | `/dashboard` | `/social/setup` | tile `social_media` |
| `nav_campaigns` | dashboard | `/dashboard` | `/campaigns` | inline route |
| `nav_campaign_detail` | dashboard | `/dashboard` | `/campaigns/:id` | inline route |
| `nav_help` | dashboard | `/dashboard` | `/help` | inline route |
| `nav_profile` | settings | `/settings` | `/profile` | inline route |
| `nav_add_business` | admin | `/admin` | `/add-business` | tile `add_business` |
| `nav_business_profile` | admin | `/admin` | `/settings/business` | inline route |
| **`nav_accounting`** | admin | `/admin` | `/settings/accounting` | inline route |
| `nav_services` | admin | `/admin` | `/settings/services` | inline route |
| `nav_team` | admin | `/admin` | `/team` | inline route |
| `nav_discounts` | admin | `/admin` | `/discounts` | tile `discounts` |
| `nav_cost_to_produce` | admin | `/admin` | `/costs` | tile `cost_to_produce` |

`nav_accounting` is the one David found.

**Fact recorded without interpretation, because the disaggregation changes what the number is
made of:** the `dashboard` section has **zero** children under `/dashboard` (14 of 15 disagree, the
15th being the root itself). The `admin` section has **two** members under `/admin` — the root and
`nav_subscription` — and seven that are not. The `settings` section has two under `/settings` and one
that is not. Whether a uniform non-prefix (dashboard) and a mixed one (admin) are the same finding is
not a question this measurement answers.

---

## Q3 — MODULE PAIRED TO A TILE NOBODY DRAWS · **5**

Every tile carrying a `module_key` that `dashboardTiles()` does NOT draw, **and** where some other
tile sharing that tile's `required_permission` either is drawn or has a route.

| # | module_key | undrawn tile | status | placement | kind | route | permission | qualifying sibling(s) |
|---|---|---|---|---|---|---|---|---|
| 1 | `qb_invoicing` | `qb_invoicing` | live | settings | destination | `/settings` | `settings:read` | `business_profile` (`/settings`), `install_price` (`/settings`) |
| 2 | `online_shop` | `online_shop` | planned | settings | destination | — | `settings:read` | `qb_invoicing`, `business_profile`, `install_price` (all `/settings`) |
| 3 | **`contractor_tiers`** | `contractor_tiers` | planned | settings | destination | — | `pricing_recipe:update` | `discounts` (live, `/discounts`) |
| 4 | `seasonal_module` | `seasonal_module` | planned | settings | destination | — | `settings:read` | `qb_invoicing`, `business_profile`, `install_price` (all `/settings`) |
| 5 | `cost_to_produce` | `cost_to_produce` | live | admin | destination | `/costs` | `owner-only` | `add_business` (live, `/add-business`) |

Instance 3 is the one David found. **No sibling in any of the five is itself drawn** — every
qualifying sibling qualifies on having a ROUTE, not on being rendered.

**A sixth undrawn module tile exists and this query excludes it, by its own sibling clause:**
`business_insights` carries `module_key: 'business_insights'`, is `kind:'readout'` (so
`dashboardTiles()` filters it out), and is the ONLY tile on `reports:read` — therefore it has no
sibling and does not meet Q3's definition. Recorded so the 5 is not read as "5 undrawn module tiles."
There are **6** undrawn tiles carrying a `module_key`; **5** of them meet Q3.

---

## Q4 — WRITE PATHS FOR `businesses` · **7, UNDECLARED**

Run separately, not part of the script: `node scripts/verify-write-paths.mjs`.

```
GOAL:FAIL  RATCHET:OK   businesses — 7 app paths (more than one write path, none declared)
   · packages/cultivar-os/api/qbo/router.ts                [update]
   · packages/cultivar-os/src/pages/OnboardingWizard.tsx   [insert,update]
   · packages/shared/src/auth/OwnerSignup.tsx              [insert]
   · packages/shared/src/discovery/DiscoveryGlimpse.tsx    [update]
   · packages/shared/src/pages/Settings.tsx                [rpc:set_business_profile]
   · packages/shared/src/quickbooks/refresh.ts             [update]
   · packages/shared/src/quickbooks/secrets.ts             [update]
 + 1 tooling path: scripts/test-member-login.mjs
```

**Is it one of the declared known failures?** No — it is **undeclared** (the cap says so in the row:
*"none declared"*). It is one of the goal-failing tables, tied with `business_members` for the most
paths of any table.

⚠️ **The cap now reports SIXTEEN goal-failing tables, not seventeen.** Its own summary line prints
both numbers in one sentence: `SUMMARY  goal: 16 table(s) with >1 undeclared path (known debt — 17
failures = 17 DECISIONS owed, not 17 builds)`. The count is computed; the `17` is prose. See
OUT-OF-SCOPE FINDINGS below.

**No `/settings/:section` fragmentation is visible in this list.** All seven paths are distinct
files; `Settings.tsx` appears once, via the `set_business_profile` RPC. Whether that answers David's
question about the section-isolated views is his call, not this document's.

---

## STD-021 — CORPUS AND METHOD

### Corpus

| file | how used |
|---|---|
| `packages/cultivar-os/src/registry/tileRegistry.ts` | **the whole corpus for Q1–Q3.** Read as text (for the independent row count and the union report) and COMPILED AND EVALUATED (for every count). |
| `scripts/verify-write-paths.mjs` + `write-paths-baseline.json` | Q4 only, run unmodified, output quoted verbatim. |
| `packages`, `scripts` (`*.ts`, `*.tsx`, `*.mjs`) | the zero-caller re-verification, below. |

Nothing else was read. No migration, no `api/`, no database, no live tenant.

### Method

**Rows are EVALUATED, not parsed.** `node_modules/.bin/esbuild` bundles the registry with
`lucide-react` aliased to an inert stub; the bundle is imported and the real `TILE_REGISTRY`,
`NAV_IA`, `MODULE_CATALOG`, `dashboardTiles()`, `navSections()` and `navRoute()` objects are read
directly. Precedent: `npm run verify:write-wall` already bundles-and-runs with esbuild.

**Why not reuse `verify-tile-fields`' proven walker (§6 r8, and it was the first choice):** its
parser is not exported — only `scan` is — and the module has no `import.meta.main` guard, so
importing it would execute its probes, its scan and its `process.exit`. Reusing it therefore requires
EDITING A LIVE CAP mid-measurement, which is outside this task's bar. Copying the walker would fork
the one piece of code whose failure mode is already documented in its own header (2026-08-01:
`indexOf('[')` matched the empty pair in `TileEntry[] = [`, read ZERO rows, returned green over a
registry it had never opened). Evaluation is a third road that forks nothing and re-implements
nothing.

### Derived vs read

| quantity | source | hardcoded? |
|---|---|---|
| tile rows, nav nodes, catalog entries | the evaluated arrays | no |
| `status` / `kind` / `placement` / `vertical` / `section` values | read off each row as data | no — **no list is typed anywhere in the script** |
| the legal union MEMBERS (reported only) | regex over `export type Tile*`/`NavSection` in the source | no — derived from the source unions |
| RENDERABLE | the real `dashboardTiles()`, called | no — not re-implemented |
| section root routes | `navSections()` → `navRoute()`, i.e. `parent === null` | no |
| a `tileKey` node's route | the real `navRoute()` | no |

A new status, a new section, a new tile or a new nav node is picked up with **no second edit**.

### The zero-caller claim, re-verified rather than inherited

Ledger #185 asserts `dashboardReadouts()` and `tilesForPlacement()` have zero callers. **Re-checked
here, not taken on trust.** `grep -rn` for each name across `packages` and `scripts`
(`*.ts`/`*.tsx`/`*.mjs`) returns, excluding the `export function` definitions themselves:

- `dashboardReadouts` — 3 hits, **all prose**: `scripts/verify-tile-fields.mjs:302` (a comment),
  `:336` (a declaration string), `:534` (a probe title); plus `Subscription.tsx:20`, a JSDoc comment.
- `tilesForPlacement` — 2 hits, **all prose**: `verify-tile-fields.mjs:302`, `:333`; plus
  `tileRegistry.ts:13` (the file header) and `Subscription.tsx:20`.

**Zero callers CONFIRMED as of `9da6790`.** `dashboardTilesForVerticals` is a vertical FILTER over
`dashboardTiles()` (`tileRegistry.ts:649`), not a second renderer. `dashboardTiles()` is therefore
the only renderer, and it draws **13** of 33 tiles.

### Proof the instrument works — 12 probes, all passing

The row-count assertion prints on every run, pass or fail:
**evaluated 33 · independent text count 33 · agree.**

| probe | what it proves |
|---|---|
| **P1** row-count | the evaluated count equals an independently obtained text count (comments stripped, anchored on `=` not `[`). A silent zero-row read — the 2026-08-01 defect — fails loudly. |
| **P2** planted-good | Q1 reports the `discounts`/`contractor_tiers` pair on `pricing_recipe:update`. |
| **P3** planted-good | Q2 reports the `nav_accounting` mismatch. |
| **P4** planted-good | Q3 reports `contractor_tiers` on an undrawn tile. |
| **P5** planted-bad | a synthetic Q1 pair is detected and NAMED by key. |
| **P6** planted-bad | a synthetic Q2 mismatch is detected and NAMED, while a correct sibling and the section root stay clean. |
| **P7** negative control | a clean fixture reports **0 / 0 / 0** — without this, P5/P6 are satisfied by a script that flags everything. |
| **P8** comments | a `//`-commented and a `/* */`-commented row are invisible to BOTH methods and mint no pair. |
| **P9** tileKey resolution | a node with no inline route resolves through its tile, and the report says which tile. |
| **P10** heading | `route: null` is excluded from the denominator rather than scored as a mismatch. |
| **P11** Q3 sibling clause | an undrawn module tile with NO sibling is **not** an instance (the clause is enforced, not decorative). |
| **P12** module cache | distinct fixtures load distinctly. Node caches ES modules by URL; a reused outfile would return the FIRST module every time, making every planted-bad probe pass while measuring the wrong file. |

**Planted-bad against the REAL file, in addition to the fixtures.** Three synthetic rows were
inserted into `tileRegistry.ts` — a `planned` tile on `customers:read` (a permission with no existing
disagreement), carrying `module_key: 'PLANTED_MODULE'` on a `settings` placement, plus a
`PLANTED_NAV` node in section `settings` routed to `/zzz-planted`. Result:

```
rowCount  33 → 34   (both methods moved together)
Q1        12 → 13   named: ('customers:read', 'customers', 'PLANTED_TILE')
Q2        22 → 23   named: ('PLANTED_NAV', 'settings', '/settings', '/zzz-planted')
Q3         5 →  6   named: 'PLANTED_MODULE'
```

Then restored. **`git diff -- packages/cultivar-os/src/registry/tileRegistry.ts` is EMPTY**, the file
is byte-identical to a pre-plant backup (`diff -q` → IDENTICAL), and a re-run returns
**33 / 12 / 22 / 5 / probes 12 of 12**.

### WHAT THIS MEASUREMENT CANNOT SEE

Required section. Every item below is a real blind spot, not a caveat.

1. **It cannot see a row TypeScript would reject.** Types are erased at compile. A row with an
   illegal `status`, a missing required field, or a `depends_on` pointing nowhere is invisible here.
   That is `verify-tile-fields`' job and it already does it; the two instruments are complementary
   and neither substitutes for the other.
2. **It cannot say which row of a contradicting pair is WRONG.** Q1 reports that two rows disagree.
   Nothing here knows that `/discounts` is built and `contractor_tiers` is not — that fact came from
   David's screenshots, and no static read of this file could have produced it.
3. **It never opened `router.tsx`.** Whether a route in Q2 actually EXISTS, what it renders, and what
   gate `PermissionRoute` puts on it are all outside the corpus. A node could point at a route that
   does not exist and Q2 would score it purely on its first path segment.
4. **Q2 treats `section` as a URL-prefix claim.** That is one reading. `section` is documented as
   driving *"the hamburger/nav-rail grouping"*, and the breadcrumb derives from it. Whether a
   grouping that is not a URL prefix is a DEFECT is exactly the question David has not ruled, and
   this document does not answer it. The 22 is the count under the stated rule, nothing more.
5. **It cannot see the tenant.** `business_modules` was never queried. Whether a module is enabled,
   trialling, or seeded at all is invisible; Q3 reports registry pairing only.
6. **It cannot see a capability that has NO row at all.** A built feature nobody registered produces
   no tile, no pair, and no count — the 7-of-14 blind spot one layer over. All three queries are
   defined over rows that exist.
7. **Q1's pairing is by `required_permission` only.** Two rows describing the same capability under
   DIFFERENT permission strings are not paired and are not counted. If the `discounts` and
   `contractor_tiers` rows had disagreed on their permission too, this measurement would report zero
   for the defect David actually found.
8. **`n²` pairs, not distinct capabilities.** `settings:read` contributes 8 pairs from 6 rows. The 12
   is a count of DISAGREEING PAIRS, which is the unit that was asked for; it is not a count of
   capabilities in trouble, and the two numbers are different.
9. **One SHA, one moment.** Measured at `9da6790` with a clean tree. Nothing here is a ratchet;
   nothing watches it; the number is true today and has no guard keeping it true.

---

## STEP 0.5 — THE TWO STANDING QUESTIONS

### A. `9da6790`

```
9da6790  2026-08-02 17:53:38 -0500  david-obrien61
feat(subscription): enabling a priced add-on IS starting its trial

 CLAUDE.md                                                  |   4 +
 docs/standards/ui-control-standards.md                     |  36 +
 packages/cultivar-os/src/pages/Subscription.tsx            |  74 +-
 packages/cultivar-os/src/registry/moduleSeed.test.ts       |  26 +-
 packages/shared/src/business-logic/moduleState.ts          |  24 +-
 supabase/migrations/20260802c_enable_starts_the_clock.sql  | 267 +
 6 files changed, 417 insertions(+), 14 deletions(-)
```

`git merge-base --is-ancestor 9da6790 main` → **ANCESTOR**. It is the **tip of `main`**, which is why
every mobile screenshot taken 2026-08-21 carries it.

**Why the string appears in neither `CLOSE-OUT-LEDGER.md` nor `RULINGS.md`: NOT because it post-dates
them.** It is dated 2026-08-02, the same day as the marketplace. **It is ledger #187 — a row that was
numbered, cited three times in `RULINGS.md`, and never written.** The ledger's highest row is #186;
`grep -c "#187" docs/CLOSE-OUT-LEDGER.md` returns **0** while `grep -c "ledger #187" docs/RULINGS.md`
returns **3**.

The commit answers the RULINGS.md OWED row *"SHOULD THE MARKETPLACE'S `Enable` ALSO START THE TRIAL
CLOCK?"* — **the answer shipped and the OWED row was never flipped.** It also carries
`20260802c_enable_starts_the_clock.sql`, whose applied/unapplied state this measurement did not
check. Recorded, not fixed.

### B. `NORTH-STAR.md`

```
-rw-r--r--@ 2  11818 bytes  Jun 29 12:02   NORTH-STAR.md          (repo root)
ls: docs/NORTH-STAR.md: No such file or directory
```

**It exists, at the repo ROOT, not under `docs/`.** `git log --diff-filter=A` shows commit
**`8be1c77`** (2026-06-29 12:21:53) **created it** — status `A`, 141 insertions — and it has not been
modified since. Here, citation and existence agree.

---

## OUT-OF-SCOPE FINDINGS — NAMED, NOT FIXED

Per instruction: a defect found outside the three queries is named here and left alone.

1. **`verify-write-paths` prints two different totals in one sentence.** Its summary reads
   `goal: 16 table(s) with >1 undeclared path (known debt — 17 failures = 17 DECISIONS owed, not 17
   builds)`. The `16` is computed from the corpus; the `17` is a prose constant from the 2026-07-29
   ruling. One of them is stale. **This is the class this whole document is about, arriving in a
   cap's own output** — an internally valid line that is false about the world.

2. 🔴 **LEDGER #187 IS CITED THREE TIMES IN `RULINGS.md` AND DOES NOT EXIST IN
   `CLOSE-OUT-LEDGER.md`.** `grep -c "ledger #187" docs/RULINGS.md` → **3**;
   `grep -c "#187" docs/CLOSE-OUT-LEDGER.md` → **0**. The ledger's highest row is **#186**. That
   missing row is `9da6790`'s: the number was assigned, three rulings were written citing it, and
   the row itself was never written — which is why the SHA on every 2026-08-21 screenshot appears in
   neither file. It also flipped no RULINGS OWED line despite answering one (Step 0.5 A). **This is
   the same shape as finding 1 and as the whole class above: a citation is not existence.** This
   measurement's own row is therefore **#188**, and #187 is left as the gap it is.

3. **`business_insights` is a `module_key` on a tile no renderer draws, and Q3's sibling clause
   excludes it** (detail in Q3). It is a sixth instance of the shape by one reading and not an
   instance by the query as specified. Stated so the 5 is not mistaken for a total.

---

## REPRODUCE

```bash
node scripts/measure-registry-contradictions.mjs          # human-readable
node scripts/measure-registry-contradictions.mjs --json   # machine-readable
node scripts/verify-write-paths.mjs                       # Q4
```

The script exits 1 if any probe fails, before printing a single count. **A zero from an unproven
script is worth nothing.**

---

*MEASUREMENT ONLY. No recommendation, no proposed fix, no ruling. David rules.*
