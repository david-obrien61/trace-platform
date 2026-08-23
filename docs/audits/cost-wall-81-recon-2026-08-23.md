# THE COST WALL (#81) — RECON

**Date:** 2026-08-23 · **Type:** LOOK ONLY. No app code, no schema, no migration, no policy, no cap.
**HEAD:** `c0276d8` (re-checked at write-up — unchanged, working tree clean).
**Baseline:** `npm run verify` exit 0, ZERO NET-NEW (5 / 247 / 10 / 12 / 15) · api/ **12/12**.
**GATE 0: NOT APPLICABLE** — nothing ships this session.

> **STD-021 — CATALOG NOT REACHED, STATED NOT OMITTED.** Reading
> `packages/cultivar-os/.env.local` was **denied by the sandbox** (same as 2026-08-22). Every
> RLS/policy claim below is sourced from **repo migrations**, and is therefore a **HYPOTHESIS
> about the live database**, not a catalog fact. Q8 hands David the queries unrun. This matters
> more than usual here: **`orders`, `order_items`, `customers`, `cost_objects`, `cultivar_plants`
> have no `CREATE TABLE` migration in the repo at all** (tech-debt #39), so the repo is
> structurally blind to part of its own schema.

---

## 🔴 LIVE DEFECTS FOUND OUTSIDE THE TWELVE QUESTIONS — UNFIXED, PER STEP 4

### 🔴 D-1 — `business_service_log.cost` IS THE #81 CLASS ON A SECOND TABLE, AND IT IS ON NO BOARD

`business_service_log` carries `cost numeric(10,2)` (`20260612_business_assets_inventory_pmi_service.sql:231`) —
what the business PAID for each repair. Its member SELECT policy is gated on **`pmi:read`**
(`20260727_rbac_resource_action_flip.sql:130-131`), and **`pmi:read` is in
`MANAGER_DEFAULT_BUNDLE`** (`permissionManifest.ts:1241`). The reader is
`PMI.tsx:225` — **`.select('*')`**, so the cost column is in the payload.

🔴 **The module's own header states the premise that makes this a defect and then does not act on
it.** `PMI.tsx:73-80` says: *"The ASSET LIST comes from `cost_objects`, which is CONFIDENTIAL per
spec §4 and gated on `costs:read` … So a manager can legitimately hold pmi:read and NOT
costs:read"* — and the redaction it describes is applied to **the asset list only**. The service
log's own `cost` column, on the same screen, has no gate of any kind.

**Same shape as #81 exactly: a CONFIDENTIAL COLUMN sitting on an OPERATIONAL ROW.** Not fixed, not
scoped into #83 today. Belongs in the COMPLETE scope (Q11).

### 🔴 D-2 — `usePlant.ts` IS HALF-FIXED: ONE PATH GATED, THE OTHER NOT, IN THE SAME HOOK

The 2026-07-30 pass gated the **specimen** read (`usePlant.ts:102-105`, conditional on
`canViewCosts`) and left the **stock-line fallback** ungated 33 lines below:
`usePlant.ts:138` calls `resolveStockLine(…, { columns: STOCK_LINE_COLUMNS })`, and that constant
names `unit_cost` unconditionally (`stockLineResolver.ts:62`). The cost then lands on the
synthesized plant at `stockLinePlant.ts:39`.

⚠️ **The fallback is the path LAWNS's real catalog takes** — it is the D-34 route for a lot with no
`cultivar_plants` row, i.e. every discovery-seeded and CSV-imported row.

### 🔴 D-3 — `ScanOrder.tsx` LEAKS COST TO **STAFF**, ON TWO LINES, AND WAS NEVER ON THE #81 LIST

`ScanOrder.tsx:269` (`resolveStockLine`) and `:303` (`searchStockLines`) both pass
`STOCK_LINE_COLUMNS`. The page is gated on `orders:create` (`:149`), which **STAFF hold**
(`STAFF_DEFAULT_BUNDLE`, `permissionManifest.ts:1260`). So the checkout scan loop hands the cost
basis to the narrowest role on the platform.

✅ **And it is the cheapest fix in this document: `grep -n "unit_cost\|unitCost" ScanOrder.tsx`
returns NOTHING.** The page never uses the value. It merely receives it.

---

## STEP 1 — HAVE / NEED / WANT (OP-8)

### HAVE

- **The client column-lists ARE fixed on four surfaces** — `BusinessInventory.tsx:162,171`
  (`fullCols`/`coreCols(canViewCosts)`), `Dashboard.tsx:180`, `CostToProduce.tsx:85`,
  `usePlant.ts:102-105`. All four read `can('costs:read')`.
- **And the code says, itself, that this is not the wall.** `BusinessInventory.tsx:99-102`:
  *"⚠️ THIS DOES NOT CLOSE THE LEAK, and must not be recorded as the wall. RLS is ROW-level and the
  base table still grants SELECT on every column."*
- **A failing acceptance test already exists and is deliberately RED** —
  `scripts/rls/inventory-read-model.rls.mjs`, card N-7, proven under a real member session:
  **a MANAGER with `inventory:read` and without `costs:read` read 14 unit costs in one query.**
- **The precedent is real, ours, and applied** — `20260621_financial_wall_phase2.sql` created
  `labor_resource_wages`, moved the wage columns into it, **and cleared them from the parent**.
- **Three cost-bearing tables are ALREADY correctly walled** — `cost_objects`, `receipts`
  (both `costs:read`, `20260727…:81,116`), `business_pricing_config` (`pricing_recipe:read`),
  `labor_resource_wages` (`wages:read`).

### NEED — the irreducible minimum, no preference in it

**`business_inventory.unit_cost` must stop arriving in a payload for a session without
`costs:read`.** That is one column on one table. Everything else in this document is either
already walled, or is Q11's separate class.

### WANT — the end state

One rule the platform can state and a cap can hold: **a confidential column never sits on an
operational row.** Where it must, it lives in a `costs:read`-gated child, and a build-failing
check refuses a new read that names it from an ungated site.

---

## THE TWELVE QUESTIONS

### Q1 — 🔴 HOW MANY SURFACES READ A COST COLUMN? **THE COUNT IS 25.**

Keyed `file:line`. Derived by script over `packages/cultivar-os/src`, `packages/cultivar-os/api`,
`packages/shared/src`, `api` — every `.select()` naming a cost-bearing column, plus `select('*')`
on a cost-bearing table, plus the two resolver call sites a column-string scan cannot see.

**A. `business_inventory` — CLIENT, under RLS (the #81 surface):**

| # | Site | Gated? |
|---|---|---|
| 1 | `BusinessInventory.tsx:162` | ✅ `fullCols(canViewCosts)` |
| 2 | `BusinessInventory.tsx:171` | ✅ `coreCols(canViewCosts)` |
| 3 | `Dashboard.tsx:180` | ✅ conditional |
| 4 | `CostToProduce.tsx:85` | ✅ conditional |
| 5 | `usePlant.ts:102-105` | ✅ conditional |
| 6 | `usePlant.ts:138` → `stockLineResolver.ts:62` | 🔴 **UNGATED** (D-2) |
| 7 | `ScanOrder.tsx:269` | 🔴 **UNGATED** (D-3) |
| 8 | `ScanOrder.tsx:303` | 🔴 **UNGATED** (D-3) |

⚠️ **Sites 6–8 all flow through ONE constant** (`STOCK_LINE_COLUMNS`), which feeds **three** query
points inside the resolver (`stockLineResolver.ts:181, 194, 224`). One constant, three queries,
two ungated callers.
✅ **`InventoryCount.tsx:290, 630` call `resolveStockLine` with NO `columns` option** → the default
is `STOCK_LINE_IDENTITY_COLUMNS` (`:172`), which has no cost. Clean, and worth saying.
✅ **`InventoryImport.tsx:147` uses `STOCK_LINE_IMPORT_COLUMNS`** — **no `unit_cost`.** (See Q6.)

**B. `business_inventory` — SERVER, service key (RLS-bypassing; permission-irrelevant, but each
needs a join after a move):**

| # | Site |
|---|---|
| 9 | `api/dashboard.ts:44` |
| 10 | `api/orders/submit.ts:394` |
| 11 | `api/orders/submit.ts:406` (embedded through `cultivar_plants`) |

**C. `cost_objects` / `receipts` — already row-walled on `costs:read`:**
12 `CostToProduce.tsx:116` · 13 `BusinessAssets.tsx:123` · 14 `ProjectCostTree.tsx:173` ·
15 `OperatingCosts.tsx:159` · 16 `CostToProduceSettings.tsx:226` · 17 `:467` ·
18 `PMI.tsx:179` · 19 `:327` · 20 `:403` · 21 `ReceiptKeeper.tsx:400`.

**D. `pmi:read`-gated — 🔴 the D-1 class:**
22 `PMI.tsx:225` (`business_service_log`, `select('*')`, carries `cost`) ·
23 `PMI.tsx:194` · 24 `:333` (`business_pmi_schedule`).

**E. Walled precedent:** 25 `financialDataAccess.ts:80, 88`.

🔴 **THE NUMBER THAT SIZES THE BUILD IS NOT 25 — IT IS 11.** Only group A + B touch
`business_inventory`. Group C is already correct. Group D is a different, unfiled defect.

### Q2 — WHICH TABLES CARRY A COST COLUMN, AND WHO REACHES THEM

| Table | Cost column(s) | Member SELECT gated on | Reachable by MANAGER? |
|---|---|---|---|
| `business_inventory` | `unit_cost`, `cost_confidence` | **`inventory:read`** (`20260727…:68`) | 🔴 **YES — this is #81** |
| `business_inventory` | `attributes` (jsonb) | same | 🔴 **YES — see Q11** |
| `business_service_log` | `cost` | **`pmi:read`** (`…:130`) | 🔴 **YES — D-1** |
| `cost_objects` | `acquisition_cost`, `recurring_amount`, `estimated_value` | `costs:read` (`…:81`) | ✅ no |
| `cost_object_assignments` / `_edges` | — | `costs:read` (`…:92, 103`) | ✅ no |
| `receipts` | `amount` | `costs:read` (`…:115`) | ✅ no |
| `labor_resources` | wage cols — **cleared to NULL** by `20260621:100-103` | `wages:read` | ✅ no |
| `labor_resource_wages` | `base_wage`, `burden`, `cost_rate`, `bill_rate`, `rate`, `pass_through_expenses` | `wages:read` | ✅ no |
| `business_pricing_config` | `config` jsonb (the recipe) | `pricing_recipe:read` | ✅ no |
| `business_pmi_schedule` | *(no cost column found)* | `pmi:read` | n/a |

🔴 **THE PATTERN, AND IT IS THE WHOLE DIAGNOSIS: every table where row-level RLS works is one
whose ROW is confidential. `business_inventory` and `business_service_log` are the two where a
confidential COLUMN sits on an OPERATIONAL row — and they are exactly the two that leak.** The
platform did not forget to build a wall; row-level RLS cannot express this case, and nobody
enumerated which rows were mixed.

### Q3 — THE PRECEDENT, READ PROPERLY

**Mechanism: CHILD-TABLE SPLIT.** Not a view, not a SECURITY DEFINER function.
`20260621_financial_wall_phase2.sql:44-58` creates `labor_resource_wages` (PK `resource_id`,
`business_id` **denormalised so RLS needs no join**), `:63` enables RLS, `:65-82` adds an owner
policy + a member policy, `:92-96` **copies** the values in, `:100-103` **clears the parent
columns to NULL**. The parent columns are **kept, not dropped** (append-only rule, §6 r1).

**The migration records why the alternatives lost, and the reasoning transfers directly:**
`:9-15` — *"The masking-view alternative was rejected: it needs REVOKE SELECT on the base table
from the role `authenticated`, which is ROLE-WIDE not per-user → it would also block the OWNER's
writes … and force writes onto a service-key API endpoint, colliding with the 12-function
ceiling."* 🔴 **That last clause is still true and still binding: api/ is 12/12.**

**Apply order, and it is the load-bearing operational detail** (`:26-30`): **DEPLOY THE NEW CODE
FIRST.** The reader falls back to the legacy location only when the child table is ABSENT, so it
works both before and after the migration. Then apply. No migration window.

**🔴 IS THE 6/0 GATE REUSABLE? NO — AND THIS CORRECTS AN ASSUMPTION IN THE PROMPT.**
`scripts/verify-financial-wall.mjs` is **NOT in `npm run verify`** (checked: the `verify` script at
`package.json:14` chains eleven caps; this is not one of them). It is a **one-shot post-apply
catalog gate** requiring `SUPABASE_PAT` and `.env.local`, and its six checks (A–F, listed at
`20260621:157-168`) are **specific to the wage tables by name**. It asserts *"this particular
migration landed"*, never *"no new ungated cost read has been added"*.

**So a sibling must be WRITTEN, not inherited.** The 6/0 number is a record of one successful run,
not a standing guard. Q10 develops this.

### Q4 — WHAT WOULD THE MOVE BREAK? THE SPLIT

**NEEDS the cost — a join or a server read is required:**

| Site | Why |
|---|---|
| `BusinessInventory.tsx:162,171` | renders the Unit cost column + inline edit (`:349-350`) |
| `Dashboard.tsx:180` → `:230` | computes `inventoryValue = Σ qty × unit_cost` |
| `CostToProduce.tsx:85` | this page IS the cost surface |
| `api/dashboard.ts:44` → `:55` | server-side inventory value |
| `api/orders/submit.ts:394, 406` | 🔴 **money-safety — the server-authoritative `at_cost` read.** Service key, RLS-bypassed, so permission-unaffected; needs a join only |
| `usePlant.ts:138` → `CartReview.tsx:182` | ⚠️ **conditionally — see the finding below** |

**MERELY RECEIVES IT — free to move, zero behaviour change:**

| Site | Evidence |
|---|---|
| `ScanOrder.tsx:269` | `grep unit_cost ScanOrder.tsx` → **no hits** |
| `ScanOrder.tsx:303` | same |
| `usePlant.ts:102-105` | the specimen path's consumers — `PlantHero.tsx:82`, `PlantCard.tsx:34`, `PlantProfile.tsx:80` — **all three carry a comment saying they read `sell_price`, NEVER `unit_cost`** |

#### 🔴 THE Q4 FINDING THAT CHANGES THE BUILD: WALLING COST RE-CREATES THE DIVERGENCE STD-012 EXISTS TO PREVENT

`CartReview.tsx:182` feeds `unitCost` into `computeOrderPricing`. For an **`at_cost` tier**,
`tierPricing.ts:228-233` reads: if the cost is `null` or `≤ 0`, **do not fabricate $0** — fall back
**neutral to the retail `sell_price`** and flag `degraded`.

That degradation is correct and deliberate. But combine it with a cost wall:

- **Client (member without `costs:read`):** `unitCost` is now `null` → `degraded` → **Review shows
  RETAIL.**
- **Server (`submit.ts:394`, service key, RLS bypassed):** re-reads the true `unit_cost` →
  **charges COST.**

**The Review screen and the charge disagree.** `tierPricing.ts:239-243` names this exact hazard two
lines above the function: *"Because Review (display) and submit.ts both call THIS one pure function
over the same inputs, the two surfaces cannot diverge."* **A cost wall breaks that premise by
removing an input from one caller.**

⚠️ **Scope of the hazard, stated precisely rather than alarmingly:** it fires only on an `at_cost`
tier, only for a session without `costs:read`, and it fails toward **charging the customer LESS
than Review showed** — not a money-safety breach, but a visible contradiction on a screen.
It needs a ruling (**C-A**), not a patch invented here.

### Q5 — 🔴 DOES THE OWNER'S OWN VALUE METRIC STILL WORK? **YES. VERIFIED, NOT ASSUMED.**

The #85 defect is **fixed and the fix is recorded**. `Dashboard.tsx:100` reads
`can('costs:read')` — the legacy `view_costs` is gone. `authority-grants-baseline.json:114-122`
declares the site with `"roles": ["OWNER"]` and the reason: *"FIXED 2026-07-31 (David's ruling,
ledger #174) … Was a LEGACY string admitting NOBODY INCLUDING THE OWNER."*

The owner holds `costs:read` because **OWNER holds every enforced string, computed from the
manifest** (ruling 2026-07-30). So `:180` requests `unit_cost` and `:230` computes the metric.

✅ **And the guard against the fix re-blinding him: the OWNER path must be an explicit assertion in
the new wall's RLS proof, not an inference.** `lrw_owner_all` (`20260621:66-71`) is the shape to
mirror — a separate owner policy, not reliance on the member policy resolving true.

### Q6 — THE IMPORT PATH ⚠️ **THE PROMPT'S PREMISE IS STALE. THERE IS NO LEFTOVER `unit_cost` SELECT, AND NO DEAD FLAG.**

Three checks, all negative:

1. **The select:** `InventoryImport.tsx:147` reads `STOCK_LINE_IMPORT_COLUMNS` =
   `'id, name, sku, qty, size, variant_group, status, sell_price, price_basis, attributes'`
   (`stockLineResolver.ts:68-69`). **`unit_cost` is not in it.**
2. **The flag:** `InventoryImport.tsx:78` reads `can('inventory:import_price')` — the **current**
   string. The dead `import_pricing` was replaced on 2026-07-31 and `:72-77` records it.
3. **The baseline:** `authority-grants-baseline.json:211-219` declares the site
   `"roles": ["OWNER"]`, *"FIXED 2026-07-31 … a pure 1:1 rename."* **A grep for `KNOWN-BAD` /
   `NOT ACCEPTED` across the whole baseline file returns ZERO hits.**

✏️ **Where the premise came from, because the trap is worth naming:** CLAUDE.md's tech-debt string
carries **both** `#85/#86 ✅ resolved 2026-07-31` **and** `#85/#86-original (NEW 2026-07-31 — 🟡 …
DECLARED KNOWN-BAD, NOT ACCEPTED …)`, adjacent, in one paragraph. **The superseded row reads
exactly like a live one.** This is the same class as tech-debt #22 (a row that read "David must
apply" for 74 days after the migration was applied) — **a debt log with false rows is one people
stop reading.** Recorded, not fixed: editing the debt log is outside this recon's scope bar.

### Q7 — WHAT DOES `inventory:import_price` ACTUALLY IMPORT? **ANSWERED FROM THE CODE, AND FROM THE FIXTURE.**

> **In one plain sentence: it imports the RETAIL price the nursery will CHARGE, never the vendor
> cost the nursery PAYS — so it can go to the website person as-is, and the string does not need
> splitting.**

**The proof is a closed set, not an inference.** `columnMap.ts:37` —
`type SpineField = 'sku' | 'name' | 'size' | 'qty' | 'sell_price'`. **Five fields. `unit_cost` is
not one of them, and there is no code path that writes it from an import.**

**The fixture confirms the behaviour end to end.** `test-grower-pricelist-FIXTURE.csv` has BOTH
columns: `…,Ready,Retail,Wholesale,Sun,…`

- `Retail` → L2 synonym hit (`SYNONYMS.sell_price` includes `'retail'`, `:68`) → `sell_price`.
- `Wholesale` → `sell_price` already claimed → L4 → `MONEY_HEADER` matches `wholesale` (`:82`) →
  **`target: 'attribute'`, `loadBearing: true`** (`:147-148`, whose comment reads *"🔴 the Wholesale
  case"*).

✅ **The rule is stated in the module header (`columnMap.ts:26-30`) and it is a good one:**
*"🔴 A BLOB FIELD MAY NEVER BE MONEY. … Making it a real column is a spine decision + a migration,
never something an import invents."*

🔴 **BUT THE VENDOR COST DOES NOT VANISH — IT IS WRITTEN VERBATIM TO A MEMBER-READABLE COLUMN.**
See Q11.

### Q8 — RLS TODAY ⚠️ **CATALOG NOT REACHED. QUERIES BELOW, UNRUN.**

Sandbox denied `.env.local`. From migrations, the **hypothesis** is:
`business_inventory` has `business_inventory_owner_all` (`20260612:117+`) plus four verb-split
member policies (`20260727…:67-77`), the SELECT one gated on `inventory:read`. **No column-level
`GRANT SELECT (col)` and no view on `business_inventory` appear anywhere in
`supabase/migrations/*.sql`** — a claim the 2026-07-30 sweep also made and the RLS test then
confirmed behaviourally.

**For David — run against `bgobkjcopcxusjsetfob`. Read-only.**

```sql
-- C1. Every policy on the cost-bearing tables, and what it requires.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('business_inventory','business_service_log','cost_objects',
                    'receipts','labor_resource_wages','business_pricing_config')
ORDER BY tablename, cmd, policyname;

-- C2. Is ANY column-level grant already in play? (expected: zero rows)
SELECT c.relname AS table_name, a.attname AS column_name, x.grantee, x.privilege_type
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
CROSS JOIN LATERAL aclexplode(COALESCE(a.attacl, '{}')) AS ae
JOIN LATERAL (SELECT pg_get_userbyid(ae.grantee) AS grantee,
                     ae.privilege_type::text     AS privilege_type) x ON true
WHERE c.relnamespace = 'public'::regnamespace AND a.attacl IS NOT NULL
ORDER BY 1,2;

-- C3. Table-level privileges (aclexplode, NOT information_schema — §6 r17's lesson).
SELECT c.relname, pg_get_userbyid(ae.grantee) AS grantee, ae.privilege_type
FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,'{}')) ae
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('business_inventory','business_service_log')
ORDER BY 1,2,3;

-- C4. Does the leak have anything to leak? (a wall over NULLs proves nothing — the
--     2026-07-30 wages lesson, and inventory-read-model.rls.mjs checks this precondition too)
SELECT count(*) FILTER (WHERE unit_cost IS NOT NULL) AS costed_lots,
       count(*)                                      AS all_lots
FROM business_inventory;

-- C5. Q11 — is the vendor cost already sitting in the attributes bag?
SELECT count(*) AS rows_with_money_attrs
FROM business_inventory
WHERE attributes IS NOT NULL
  AND EXISTS (SELECT 1 FROM jsonb_object_keys(attributes) k
              WHERE k ~* '(wholesale|cost|net|landed)');
```

### Q9 — WHAT A MANAGER SEES TODAY, END TO END

Member `df7723be`, role MANAGER, holding `MANAGER_DEFAULT_BUNDLE`
(`permissionManifest.ts:1231-1246`): **`inventory:read` ✅, `pmi:read` ✅, `costs:read` ✗.**

**Path 1 — the grid. CLEAN.** `/inventory` → `BusinessInventory.tsx:162` →
`.select(fullCols(false))` → `BASE_COLS` only. `unit_cost` is not requested and not returned. The
column is not drawn. **The 2026-07-30 fix works exactly as advertised on this surface.**

**Path 2 — the console. THE DEFECT.** One line in devtools:

```js
await supabase.from('business_inventory').select('id,name,unit_cost')
```

`business_inventory_member_select` (`20260727…:68-69`) admits it on `inventory:read`.
**RLS decides which ROWS; it has no opinion about which COLUMNS.** The row arrives complete.
Proven, not theorised: `inventory-read-model.rls.mjs` ran this under a real member session and got
**14 costs back**, e.g. *Alley Cat Redbud Espalier, unit_cost 6*.

**Path 3 — 🔴 NO CONSOLE REQUIRED, AND THIS ONE IS NEW.** She opens any plant whose lot has no
`cultivar_plants` row → `usePlant.ts:138` → `STOCK_LINE_COLUMNS` → **`unit_cost` is in the network
response.** Nothing is rendered, so nothing looks wrong; the value is simply there. Same for a
STAFF member scanning at checkout (`ScanOrder.tsx:269`).

⚠️ **So the honest statement of the defect is broader than #81 records it.** #81 says *"a member
with devtools can read cost."* True — and paths 6/7/8 mean **a member who merely opens the right
screen receives it without doing anything at all.**

### Q10 — IS THERE A CAP THAT WOULD HAVE CAUGHT THIS? **NO. AND THAT IS THE FINDING.**

| Cap | What it asserts | Can it see a column leak? |
|---|---|---|
| **capA** (`verify-authority-checks.mjs`) | 6 assertions. #4 baselines **the GRANT SET of each authority site — WHO PASSES** (`:221`). #5 sweeps client strings against the manifest (`:329`). | ❌ **No.** It reads the *gate*, never the *select*. |
| **capP / capQ** | manifest ↔ migration reconciliation, retired strings, bundles | ❌ No — model-layer only. |
| `verify-select-policies` | every live table has RLS + a SELECT policy or a declaration | ❌ No — asserts a policy *exists*, never what it exposes. |
| `verify-field-lists` | counts hand-written column enumerations | ⚠️ **Sees the strings — and asserts nothing about permission.** Closest thing to a hook. |
| `verify-financial-wall` | 6 catalog checks, wage tables by name | ❌ Not in `npm run verify`; one-shot, name-specific. |

🔴 **THE PROOF IS EMPIRICAL, NOT ARGUED.** `usePlant.ts::canViewCosts` **is baselined in
`authority-grants-baseline.json:20-28`** — capA sees the gate, records who passes, and is green.
**The ungated leak sits 33 lines below it in the same file** (D-2). A cap that reads gates and a
defect that lives in selects cannot meet.

**capA's own header already declares the boundary** (`:66-67`): *"it is CLIENT-SIDE (`can()` +
route `permission=` props). The api layer's `callerCan` is server authority … RLS is asserted in
SQL."* Nothing owns the join between them.

**So the wall wants a NEW cap — and its assertion is now precisely stateable:** *a select string
naming a column in the CONFIDENTIAL set must sit in a file whose resolved grant set requires the
gating string, or be declared.* Both halves already exist in the repo — `verify-field-lists`
extracts select strings; capA resolves grant sets per site. **The cap is a JOIN of two caps we
already own, not new machinery.**

### Q11 — THE OTHER MONEY COLUMNS. 🔴 **COST IS NOT THE WHOLE CLASS, AND THE MISS IS ON THE IMPORT PATH.**

**① 🔴 `business_inventory.attributes` — THE VENDOR COST, VERBATIM, ON THE MEMBER-READABLE ROW.**
Q7 established that a `Wholesale` column becomes `target:'attribute'`. `importPlan.ts:121-124`
then writes it into the bag **keyed by the grower's own header, value verbatim**, and
`:314-315` merges it onto `business_inventory.attributes` — the same row, one column over from
`unit_cost`, admitted by the same `inventory:read` policy.

🔴 **#83 as scoped moves `unit_cost` and `cost_confidence` and says nothing about `attributes`.**
Build it exactly as written and the outcome is: the cost basis goes behind `costs:read`, and
**`{"Wholesale": "$120.00"}` stays on the base row for any manager to read.**

⚠️ **This is not hypothetical and the timing is the point: the owner-test fixture IS a grower price
list with a Wholesale column, and the website person — who holds `inventory:import_price` — is the
person who will run that import next week.** The wall would be built and defeated by the same
week's work.

**② 🔴 `business_service_log.cost` on `pmi:read`** — D-1 above. The second table of the #81 class.

**③ ✅ `sell_price` — NOT confidential, and the platform is consistent about it.** It is the
customer-facing retail price; `PlantHero.tsx:82`, `PlantCard.tsx:34`, `CartReview.tsx:144` all
carry the D-35 comment. It is in `BASE_COLS` deliberately. **No change wanted.**

**④ ✅ `margin`** — no column exists. `permissionManifest.ts:461-473` already records that
`margin:read` is derived from `unit_cost` and that its own note *"unit_cost is NOT server-gated"*
**becomes false when #81 lands and must be re-corrected in the same commit.** Named in #83's
scope; repeated here because it is a one-line edit that is easy to drop.

**⑤ ✅ `business_pricing_config`** — already walled (`pricing_recipe:read`). The recipe is the moat
and it is behind a door.

### Q12 — 🔴 THE SMALLEST THING THAT CLOSES WEDNESDAY'S ACTUAL RISK

**Reframe the risk first, because it changes the answer.** Lauren is owner-level and clear.
Wednesday is clear. **The exposure begins with Joel and the website person** — and the sharpest
finding in this recon is that **the exposure for them is not the console, it is three ordinary
screens** (D-2, D-3): open a plant, or scan a tag at checkout, and the cost is in the payload
without anyone trying.

**So yes — there is a version that protects those two roles without the full build, and it is
unusually cheap:**

> **Change what `usePlant.ts:138`, `ScanOrder.tsx:269` and `ScanOrder.tsx:303` ask for.**

- `ScanOrder` **needs zero care**: it never reads `unit_cost` (Q4). A narrower constant, done.
- `usePlant` needs the same `canViewCosts` ternary already sitting **33 lines above it** at
  `:102-105`. Copied, not invented — the pattern is in the file.
- **No migration. No policy. No permission string. No RPC. No `api/` slot** (12/12 stays 12/12).
- 🔴 **And the Q4 `at_cost` hazard does not fire**, because a member without `costs:read` currently
  gets a degraded Review anyway once the column list narrows — which is precisely the ruling
  **C-A** must settle before COHERENT, and precisely why MINIMUM can ship without it.

⚠️ **WHAT IT DOES NOT DO, SAID PLAINLY: the console leak survives untouched.** A manager who opens
devtools still reads 14 costs, `inventory-read-model.rls.mjs` stays RED, and **#81 does not close.**
MINIMUM removes the accidental exposure — the one that happens to someone not trying. It does not
build the wall.

🔴 **Whether that is enough is DAVID'S CALL AND NOT A TECHNICAL ONE.** The honest framing: Joel and
the website person are people David is choosing to trust with a login. MINIMUM stops them seeing
cost by accident. Only COHERENT stops them seeing it on purpose.

---

## STEP 3 — THE ESTIMATE

Sizes in **Thunder-prompt units** (one focused build prompt ≈ 1).

### MINIMUM — ~2 prompts · 0 migrations · 0 rulings

| Piece | Touches | Migration | Ruling | Size |
|---|---|---|---|---|
| M1 — narrow the resolver's callers | `usePlant.ts:138` · `ScanOrder.tsx:269,303` · a new no-cost constant beside `stockLineResolver.ts:62` | no | no | 1 |
| M2 — owner-test cards + `[TRACE:*]` + close-out | `docs/owner-tests/inventory-*` | no | no | 1 |

**Leaves open, stated:** the console leak · N-7 stays RED · #81 does not close · D-1 untouched ·
Q11 ① untouched. **David must APPLY: nothing.**

### COHERENT — ~7–8 prompts · 1 migration · 3 rulings

The cost wall as ruled (#83), both halves, with a cap that holds it.

| Piece | Touches | Migration | Ruling | Size |
|---|---|---|---|---|
| C1 — the child table | NEW `business_inventory_costs` (PK `inventory_id`, `business_id` denormalised, `unit_cost`, `cost_confidence`); RLS mirroring `lrw_*`; copy-in; clear parent | 🔴 **YES — David applies** | — | 1.5 |
| C2 — reader/writer seam, **deployed BEFORE C1** | a `financialDataAccess`-shaped module; fallback-when-absent per `20260621:26-30` | no | — | 1.5 |
| C3 — the 4 gated client readers become joins | `BusinessInventory` · `Dashboard` · `CostToProduce` · `usePlant` | no | — | 1 |
| C4 — the 3 service-key readers | `api/dashboard.ts:44` · `submit.ts:394,406`. **No new `api/` fn** | no | — | 1 |
| C5 — 🔴 the `at_cost` divergence | `CartReview.tsx:182` / `tierPricing.ts` | no | 🔴 **C-A** | 1 |
| C6 — the NEW cap | joins `verify-field-lists`' string extraction to capA's grant resolution; RED-first; probes both directions (STD-022) | no | 🔴 **C-B** | 1.5 |
| C7 — the story | `user_stories.md:292` is `STATUS: gap` — **a story is created before the spec** (§9) | no | 🔴 **C-C** | 0.5 |
| C8 — flip N-7 green + manifest note + close-out | `inventory-read-model.rls.mjs` · `permissionManifest.ts:461-473` | no | — | 0.5 |

**David must APPLY:** C1. **David must RULE FIRST:** C-A, C-B, C-C.

### COMPLETE — ~10–11 prompts · 2 migrations · 5 rulings

COHERENT, plus what Q11 surfaced beyond `unit_cost`.

| Piece | Touches | Migration | Ruling | Size |
|---|---|---|---|---|
| P1 — 🔴 `business_service_log.cost` (D-1) | same child-split, or a `costs:read` clause on the read | 🔴 **YES** | 🔴 **C-D** | 1.5 |
| P2 — 🔴 the `attributes` money bag (Q11 ①) | `importPlan.ts:121-124, 314-315` · `columnMap.ts:147` · possibly a backfill of existing bags | ⚠️ likely (backfill) | 🔴 **C-E** | 1.5 |

**David must APPLY:** C1, P1, and P2's backfill if ruled. **RULE FIRST:** C-A…C-E.

---

## STEP 5 — CLOSE

**The Q1 count: 25 cost-read sites — but only 11 touch `business_inventory`, and only 3 of those
are ungated. That 3 is the whole of Wednesday's accidental exposure.**

**The Q4 split:** NEEDS cost — `BusinessInventory.tsx:162,171` · `Dashboard.tsx:180` ·
`CostToProduce.tsx:85` · `api/dashboard.ts:44` · `submit.ts:394,406` · `CartReview` via
`usePlant.ts:138` (conditionally, and it is the ruling C-A). MERELY RECEIVES IT —
`ScanOrder.tsx:269` · `ScanOrder.tsx:303` · the three plant renderers, all of which say so in
their own comments.

**The Q7 answer, in one plain sentence:** `inventory:import_price` imports the RETAIL price the
nursery will charge, never the vendor cost it pays — so the website person can hold it as-is and
the string does not need splitting; **but the vendor cost she uploads still lands verbatim in
`business_inventory.attributes`, which no proposed wall covers.**

**The three scopes:** MINIMUM ~2 prompts / 0 migrations / 0 rulings — closes the accidental leak,
leaves #81 open. COHERENT ~7–8 / 1 / 3 — closes #81. COMPLETE ~10–11 / 2 / 5 — closes the class.

### RULINGS OWED

| # | Question | Blocks |
|---|---|---|
| 🔴 **C-A** | **When a member without `costs:read` reviews an `at_cost` order, Review shows RETAIL and submit charges COST. Which gives?** Options: withhold the at_cost tier from an ungated session · a server preview endpoint (⚠️ 12/12) · let Review say *"priced at cost — figure withheld"* (D-9's shape, and the cheapest). | COHERENT C5 |
| 🔴 **C-B** | **Is the confidential-column cap worth building, and what is its declaration list?** ⚠️ Per #11's lesson the list must **assert itself in both directions** — a declaration for a column that no longer exists, or has since been walled, must FAIL. | COHERENT C6 |
| 🔴 **C-C** | **`user_stories.md:292` is `STATUS: gap` and its `NEEDS:` says exactly this: *"Narrate the owner/manager/staff lived need behind the wall (who sees costs, who can't, why). BUILT but un-storied."*** 🔴 **It also asserts BUILT — which #81 proves false for the cost half.** David dictates; the story is created before the spec (§9). | any build |
| 🔴 **C-D** | **Does `business_service_log.cost` get the same child-split, or does the PMI read gate on `costs:read` too?** Note the asymmetry already ruled: the asset list IS redacted for `pmi:read`-without-`costs:read` (`PMI.tsx:73-80`); the service cost is not. | COMPLETE P1 |
| 🔴 **C-E** | **What happens to a money value in the `attributes` bag?** Refuse the import · keep but wall the whole bag · a `costs:read`-gated attributes child. ⚠️ **And the retroactive half: rows already carrying `{"Wholesale": …}` need a decision too** (Q8 query C5 counts them). | COMPLETE P2 |

### METHOD NOTES

- ✅ **`git log` + `git status` re-run at write-up** per STEP 0 — HEAD still `c0276d8`, tree clean.
  Last session's stale-snapshot catch did **not** recur; checked rather than assumed.
- ⚠️ **The prompt's second-half premise (#85/#86 / the leftover import select) was FALSE against
  the current tree and is corrected in Q6 rather than built on.** Both were fixed 2026-07-31; the
  baseline says so; the import select has no `unit_cost`. The stale row sits adjacent to the
  resolved one in CLAUDE.md's debt string.
- ✅ **The `6/0` gate is a one-shot post-apply run, not a standing cap** (Q3) — reusing the
  precedent means reusing the migration shape, not inheriting a guard.
- **CLAUDE.md is 713 lines against its own ~600 budget** — the §4 residual OP-13 says N=3 alone
  does not close.
