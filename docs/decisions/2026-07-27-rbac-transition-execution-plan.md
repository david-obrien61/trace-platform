# RBAC TRANSITION — EXECUTION PLAN (2026-07-27)

**Status:** ⛔ **AWAITING DAVID'S APPROVAL. Nothing built.**
**AMENDED 2026-07-27 after STEP 0 ran — see §9. The grant changed 33 → 44; §2 and §7 are
superseded by §9.2 and §9.3. Read §9 first.**
**Ruled by:** David, 2026-07-27 — seven rulings taken today (below).
**Companions:** `docs/resource-action-permission-spec.md` v3 (RULED, nothing open) ·
`docs/decisions/2026-07-26-rbac-build-plan.md` (the phased plan this SUPERSEDES for sequencing) ·
`docs/decisions/2026-07-26-rbac-backfill-contract.md` (R-A/R-B/R-C/R-D) ·
`docs/standards/permission-enforcement-map.md` · CLOSE-OUT-LEDGER #154/#155.

> **What this document changes about the plan of record.** The 2026-07-26 build plan sequences
> eight phases, each independently shippable, because a piecemeal migration had to be safe for
> live members. **There are no live members** — 4 tenants, ~6 member rows, all David and family,
> no paying customer, the fourth bar (DEPLOY TO LIVE) dormant. The risk axis that justified
> phasing is gone. This plan does the same work as ONE pass. The alias layer stays as the net.

---

## 1. THE SEVEN RULINGS (2026-07-27)

| # | Question | Ruling |
|---|---|---|
| 1 | What does the existing MANAGER hold after transition? | **Seed `MANAGER_DEFAULT_BUNDLE` onto the existing role** — an explicit, recorded, ONE-TIME departure from R-A |
| 2 | Phase 3b (unit_cost field split) in this pass? | **Yes** — projection AND base-table SELECT narrowing |
| 3 | Phase 7 CONTRACT in this pass? | **Yes, if both zero-checks pass** |
| 4 | Audit-log scope | **Demo-spine mutations**, same transaction as the write |
| 5 | `orders:delete` (cancel) for MANAGER? | **Grant** |
| 6 | `order_discount:apply` for MANAGER? | **Grant, AND convert the soft-fail to a real refusal** |
| 7 | Lauren's cost visibility? | **Grant `costs:read` + `margin:read`** per spec §5 |

### 1.1 The R-A departure, recorded not silent (§6 r10)

R-A says the backfill is rename-only and **bundles are never seeded into an existing tenant**,
because doing so grants strings a member's legacy antecedent never implied. Ruling 1 departs from
that deliberately. The reason it is safe **here and only here**: R-A protects live members from a
silent grant, and there are none. The record:

- **What we are doing:** seeding `MANAGER_DEFAULT_BUNDLE` + 4 named strings onto a live role.
- **Why it is acceptable:** test data only; every affected row is David's; the funnel renders the
  blast-radius diff before writing and emits one audit row naming the actor.
- **Expiry condition:** **R-A becomes binding again the moment a tenant exists that David does not
  own.** This departure does not generalize and must not be cited as precedent.
- **Where it is written:** this section, plus an amendment to the backfill contract, plus the
  ledger row. Not a comment in a migration.

---

## 2. THE GRANT — 33 STRINGS, ENUMERATED

`MANAGER_DEFAULT_BUNDLE` (29) — `orders:read` `orders:create` `orders:update` `order_items:read`
`order_service_selections:read` `order_compliance_records:read` `customers:read` `customers:create`
`customers:update` `service_offerings:read` `inventory:read` `inventory:create` `inventory:update`
`inventory_ledger:read` `deliveries:read` `deliveries:update` `deliveries.route:read`
`deliveries.route:update` `assets:read` `assets:create` `assets:update` `pmi:read` `pmi:update`
`tax_rate:read` `tax_rate:update` `settings:read` `settings:update` `campaigns:read`
`campaigns:update`

**+ 4 named additions (rulings 5–7):** `orders:delete` · `order_discount:apply` · `costs:read` ·
`margin:read`

**= 33.** Written in ONE `save_role_permissions` call (WIPE-not-merge is correct here — 33 IS the
desired set), producing one `role.permissions_changed` audit row carrying before/after per member.

**STAFF is unchanged in shape:** `orders:create` + `inventory:read`, deliberately WITHOUT
`orders:read` (R1 / Note A). Today's STAFF row holds `view_orders`; the bundle drops it. **That is
a revocation on a live role and it is the same class of decision as ruling 1** — flagged in §7 as
the one item I have NOT been given a ruling on.

---

## 3. ⛔ STEP 0 — THE CATALOG READ. I CANNOT WRITE THE MIGRATION WITHOUT IT.

**The flip must rewrite every RLS policy that references a legacy string. I do not know what those
policies are.** I know what the migration *history* says; I do not know what the *database* says,
and **tech-debt #39 records that the live schema is not in version control** (orders / customers /
order_items columns exist live-only). Writing `ALTER POLICY` statements against a policy list
derived from migration files is exactly the "builder's memory instead of the catalog" failure the
schema-verification gate exists to prevent.

**David runs this first and pastes the output back. It is read-only.**

```sql
-- Every policy whose USING or WITH CHECK mentions any legacy permission string.
-- This is the authoritative flip list. Expect ~15-30 rows.
SELECT tablename, policyname, cmd, roles,
       pg_get_expr(polqual,      polrelid) AS using_clause,
       pg_get_expr(polwithcheck, polrelid) AS with_check_clause
  FROM pg_policy pol
  JOIN pg_class  c ON c.oid = pol.polrelid
  JOIN pg_policies p ON p.policyname = pol.polname AND p.tablename = c.relname
 WHERE c.relnamespace = 'public'::regnamespace
   AND (COALESCE(pg_get_expr(polqual, polrelid), '') ||
        COALESCE(pg_get_expr(polwithcheck, polrelid), '')) ~
       '(view_costs|view_orders|view_customers|view_wages|view_pricing_config|view_margin|manage_orders|manage_settings|manage_deliveries|manage_campaigns|manage_customers|qr_checkout|import_pricing|apply_tax_exempt|view_dashboard|view_reports)'
 ORDER BY tablename, policyname;
```

Source-side counts, for reconciliation against what comes back (these are migration-history
occurrences, NOT live policies — the live number is smaller because later migrations supersede
earlier ones): `view_costs` 17 · `view_customers` 5 · `view_wages` 5 · `view_orders` 4 ·
`view_pricing_config` 3 · `import_pricing` 2. **Eight legacy strings appear in NO policy at all**
(`manage_orders`, `manage_settings`, `manage_deliveries`, `manage_campaigns`, `manage_customers`,
`qr_checkout`, `view_margin`, `apply_tax_exempt`) — they are route/tile/api gates only.

**A row in that output that does not correspond to a migration file is live-only drift, and it is
the single most likely thing to break this build.** Better to find it in a SELECT than at 6pm.

---

## 4. THE SEQUENCE — AND THE WINDOW IT MUST NOT LEAVE OPEN

`PermissionRoute` gates on `can()`, which is **client-side** (`BusinessProvider`: `owner ⇒ true;
member ⇒ list`). **The alias layer does not cover it** — it only covers `has_permission` in the
database. So route gates read the member's raw array and the ordering matters:

| order | state | consequence |
|---|---|---|
| Deploy app (new strings) → then grant | app checks `orders:read`, Lauren holds `view_orders` | **Lauren locked out of every gated route** until the grant lands |
| Grant → then deploy app | Lauren holds `orders:read`, app checks `view_orders` | **Lauren locked out** the other way |

There is no ordering without a window. **David-as-OWNER is never affected** (`owner ⇒ true`, plus
20 `*_owner_all` policies), so the window costs one test account a few minutes — a direct dividend
of test-data-only.

**Chosen order:** deploy app → confirm SHA live (GATE 0 / OP-15) → apply migration + run the grant
**in one transaction** → prove. The DB half has no window at all because flip and grant commit
together.

---

## 5. THE SIX BUILDS

### BUILD 1 — THE FLIP MIGRATION *(gated; David applies)*
`supabase/migrations/20260727_rbac_resource_action_flip.sql`
- `ALTER POLICY` every policy from STEP 0's list onto its resource:verb string, **split by
  command** (a `FOR ALL` gated on `view_costs` becomes SELECT/INSERT/UPDATE/DELETE on
  `inventory:{read,create,update,delete}`).
- Re-gate `get_business_tax_rate` on `tax_rate:read`; **NEW `set_business_tax_rate`** narrow writer
  on `tax_rate:update` (writes only `config->'taxRate'` via `jsonb_set`; never the recipe).
- `service_offerings:read` gets a named string (membership-only today).
- Catalog-backed V-checks incl. **negatives** (a member without the string reads zero rows) and
  tenant isolation.
- **Risk:** medium. Mechanical, but every statement is against live policy names.

### BUILD 2 — THE APP FLIP *(one commit)*
- `router.tsx` — 9 `PermissionRoute` gates.
- `tileRegistry.ts` — 48 `required_permission` entries.
- `api` — `submit.ts` ×4 (`manage_orders` → `orders:update` at 1005/1292, `orders:delete` at 1223,
  **`order_discount:apply` at 238**), `discovery/ingest.ts` (`VIEW_COSTS` → `costs:read`),
  `apply_tax_exempt` → `tax_exempt:apply`.
- **Ruling 6:** `submit.ts:238` soft-fail → **real 403 with a surfaced reason.** A control that
  silently discards a manager's price change is a D-9 violation independent of who holds the string.
- `permissionManifest.ts` — statuses to `enforced`; **the new strings enter the Roles-page catalog**
  (this is what closes the `manage_orders` gap permanently and makes the runbook SQL unnecessary).
- **R1 UI requirement:** the Roles page surfaces a `create`-without-`read` grant as a deliberate
  choice with an inline note ("takes orders, cannot browse them").
- **Mint sites** — `SignUp.tsx:34` / `AddBusiness.tsx:23` read the resolved floor instead of the
  hardcoded 5-string literal. **Mandatory:** Contract's zero-check cannot stay green while they
  inject `manage_team` / `process_orders` / `view_reports`. Also fixes the owner's array, which has
  been fiction since signup.
- **Risk:** low-medium. Broad but shallow; `npm run verify` catches string drift.

### BUILD 3 — 3b, THE COST SPLIT *(ruling 2 — the highest-risk item)*
- NEW `list_business_inventory(p_business_id, …)` SECURITY DEFINER projection: `unit_cost` and
  `cost_confidence` return **NULL unless the caller holds `costs:read`**.
- **AND narrow the base-table member SELECT** — without this the split is cosmetic; a manager can
  still `select unit_cost from business_inventory` directly.
- Repoint **24 read sites across 12 files**: `api/dashboard.ts` · `api/orders/submit.ts` ·
  `components/inventory/inventoryEdit.ts` · `pages/BusinessInventory.tsx` · `pages/CostToProduce.tsx` ·
  `pages/Dashboard.tsx` · `pages/InventoryCount.tsx` · `pages/InventoryImport.tsx` ·
  `pages/InventoryReconcile.tsx` · `shared/discovery/costDiscovery.ts` · `shared/discovery/populate.ts` ·
  `shared/inventory/stockLineResolver.ts`.
- **Risk: HIGH — the plan's own words: "the largest single risk."** Narrowing the base-table SELECT
  can break any reader missed. The inventory surface is also the most owner-proven area we have
  (32/91 cards), so a regression here costs proven ground.

### BUILD 4 — AUDIT WRITES *(ruling 4)*
An audit insert in the **same transaction** as each mutation, matching the funnel's pattern:
- `submit.ts` — order create · update · **delete/cancel** · status (4 handlers)
- customer create / update (`customerUpsert`)
- settings · pricing config · **tax rate** (`set_business_tax_rate` writes its own)
- delivery schedule / route
- Inventory is **already covered** by the D-50 movement ledger (attributed) — not re-done.
- **Risk:** low per site, but ~10 sites and each needs its actor threaded from a real caller.

### BUILD 5 — THE GRANT *(David runs; funnel only)*
One `save_role_permissions` call, 33 strings, actor = owner by `owner_id`, blast-radius diff read
before commit. Runs **in the same transaction as BUILD 1**.

### BUILD 6 — CONTRACT *(ruling 3 — LAST, and only if everything above is proven)*
Two zero-checks across all tenants (no member holds a legacy string; no gate references one) →
drop the alias rows → retire the legacy strings → **capP WARN → FAIL.**
**Irreversible.** It removes the safety net, so it does not run until 1–5 are owner-proven.

---

## 6. 🔴 HONEST ASSESSMENT — WHAT ACTUALLY FITS IN 27 JUL

You said today. I can **build** a lot of this today. I do not believe all six can be **built and
owner-proven** today, and saying otherwise would be the exact failure this project's two-bar rule
exists to prevent.

| build | build time | proof burden |
|---|---|---|
| 1 + 2 + 5 (flip + grant) | ~half a day | the demo spine, ~15 cards |
| 4 (audit) | most of a day | ~10 cards |
| 3 (3b) | its own day — 24 sites, HIGH risk | the read-split negatives, plus re-proving inventory |
| 6 (Contract) | ~1 hour | gated on all of the above being proven |

**Recommended cut line for today: BUILDS 1, 2, 5 — plus BUILD 4 if it goes smoothly.** That is a
coherent stopping point: the permission model is fully migrated, Lauren holds her 33 strings, every
gate reads the new vocabulary, and the alias layer is still underneath as the net. 3b and Contract
land next, in that order, each with its own prove.

**Why not push 3b in anyway:** it is the one item that can break already-proven inventory ground,
and Contract behind it removes the ability to fall back. Doing both at the tail of a long day is
how a good migration becomes a bad night.

**Every one of the four stops is coherent** — nothing is left half-migrated at any boundary.

---

## 7. ⛔ THE ONE RULING I STILL NEED

**STAFF and `orders:read`.** Today's STAFF row holds `view_orders`. The new bundle deliberately
omits `orders:read` (R1 / Note A — take an order at the tag, cannot browse the business's order
history). Applying the bundle to the existing STAFF role is therefore a **revocation on a live
role** — the same class of decision as ruling 1, and R-A will not make it for me.

- **(a)** Apply the bundle to STAFF too — Erin's STAFF account loses order-history browsing. This
  is the model as designed, and the negative owner-test card proves it holds.
- **(b)** Grant STAFF `orders:read` on top of the bundle — preserves today's behavior, but the
  Note A split then exists only on paper and card 2 tests nothing real.

I recommend **(a)**. It is what the spec designed, the split is card-proven, and a demo where a
seasonal-hire account visibly cannot browse customer names and totals is a *feature* to show
Lauren, not a gap to explain.

---

## 8. WHAT I NEED FROM YOU TO START

1. **Approve or amend this plan.**
2. **Rule §7** (STAFF and `orders:read`).
3. **Confirm the cut line** for today (§6) — or tell me to push for all six and accept the tail risk.
4. **Run STEP 0** (§3) and paste the output. I cannot write BUILD 1 without it.

Nothing is built until 1–4 are answered.

---

# 9. AMENDMENT 1 — AFTER STEP 0 (2026-07-27)

STEP 0 ran. **It caught a 9-string revocation this plan would otherwise have shipped**, and it
resolved five assumptions. §2 (the grant) and §7 (STAFF) are superseded by §9.2 and §9.3.

## 9.1 What the catalog said

**BLOCK A — the flip list is FOURTEEN policies, not the 15-30 I guessed.** Every one corresponds to
a migration file. **No live-only policy drift.** The full list:

| table | policy | cmd | legacy string |
|---|---|---|---|
| `business_inventory` | `business_inventory_member_all` | ALL | `view_costs` |
| `business_service_log` | `business_service_log_member_all` | ALL | `view_costs` |
| `cost_objects` | `cost_objects_member_all` | ALL | `view_costs` |
| `cost_object_assignments` | `cost_object_assignments_member_all` | ALL | `view_costs` |
| `cost_object_edges` | `cost_object_edges_member_all` | ALL | `view_costs` |
| `receipts` | `receipts_member_all` | ALL | `view_costs` |
| `business_pricing_config` | `bpc_member_view_pricing` | ALL | `view_pricing_config` |
| `labor_resources` | `labor_resources_member_all` | ALL | `view_wages` |
| `labor_resource_wages` | `lrw_member_view_wages` | ALL | `view_wages` |
| `customers` | `customers_member` | SELECT | `view_customers` |
| `orders` | `orders_member_select` | SELECT | `view_orders` |
| `order_items` | `order_items_member` | SELECT | `view_orders` (via subquery on `orders`) |
| `order_service_selections` | `order_service_selections_member` | SELECT | `view_orders` (subquery) |
| `order_compliance_records` | `order_compliance_records_member` | SELECT | `view_orders` |

**BLOCK B — ONE function gate:** `import_write_price` (`import_pricing`). `get_business_tax_rate` is
membership-only, as #153 built it. Smaller than feared.

**BLOCK C — three findings that are NOT in this plan's scope but must be recorded:**
- ✅ `business_inventory_owner_all` EXISTS → **3b's narrowing cannot lock the owner out.** Cleared.
- 🔴 **`deliveries_member_all [ALL]` carries NO permission string** — every active member, including
  STAFF, can already CREATE, UPDATE and **DELETE** deliveries. This is a live authority hole, wider
  than anything this migration touches. It also means staff delivery reads work today by accident.
- 🔴 **`campaigns`, `campaign_posts`, `social_drafts`, `losses`, `opportunity_items`, `order_addons`,
  `nursery_profiles`, `invitations`, `business_voice_samples` are OWNER-ONLY — no member policy.**
  So a MANAGER holding `manage_campaigns` **cannot read a single campaign row.** N1/N2 confirmed
  live, not theoretical. `audit_log` is owner-read-only (correct, but managers cannot see the trail).

**BLOCK D1 — the floor has DRIFTED from its migration.** MANAGER is **11** (not the seeded 9) and
OWNER is **14** (not 12) — both gained `override_maintenance` + `view_customers`. **And a TENANT
OVERRIDE ROW EXISTS** for `f7ec5d67` MANAGER with **13** strings, including `view_wages`,
`view_pricing_config` and `import_pricing` that the floor MANAGER does not have. Someone (the #152
funnel, working) already granted those. **This is the finding that changes the grant.**

**BLOCK D2 — owner-masking definitively ruled out.** `is_owner = false` for MANAGER `df7723be`
(member `3dd661c3`) and STAFF `39691f0b` at `f7ec5d67` ("Test Dave's Tree Nest" — the only tenant
carrying all three roles, therefore THE standing test tenant). All three owners carry the same
6-string fiction (`manage_settings, manage_team, view_orders, process_orders, view_reports,
view_customers`) — the mint-site literal, confirmed across three tenants.

**BLOCK E — ledger #155 IS APPLIED and VERIFIED.** `total 53 · legacy 7/7 · new 46/45` (distinct 52)
= **W1 PASSES**; indexes show `permission_aliases_legacy_is_rename_only` present and
`permission_aliases_one_reverse_target` **absent** = **W3 PASSES**. W2/W4/W5/W6/W7 remain owed.

**BLOCK F —** `business_inventory` has 23 columns. The projection redacts `unit_cost` +
`cost_confidence` and returns the other 21. ⚠️ **Open question: `price_basis`** ("at-cost" vs
"retail") leaks how the price was derived. Redact it too, or not? Flagged, not decided.

## 9.2 THE GRANT IS 44, NOT 33 — and §2 would have REVOKED nine strings

§2 computed the grant as `MANAGER_DEFAULT_BUNDLE + 4`. That was wrong, and only the catalog could
have shown it: the live MANAGER at `f7ec5d67` holds **13** strings — more than the floor — because
`view_wages`, `view_pricing_config` and `import_pricing` were granted through the funnel earlier.
Seeding the bundle over that would have **destroyed nine capabilities**: `costs:create/update/delete`,
`wages:read/create/update/delete`, `pricing_recipe:read/update`, `inventory:delete`,
`inventory:import_price`. The wipe is not a merge.

**Correct computation — a UNION of three sets, not a replacement:**

```
GRANT = rename_decomposition(her 13 live strings)     36
      ∪ MANAGER_DEFAULT_BUNDLE                        +6 new
      ∪ {orders:delete, order_discount:apply}         +2 new
      = 44
```

- **36 from the rename** — `view_costs`→14 · `view_orders`→4 · `manage_deliveries`→4 ·
  `view_wages`→4 · `manage_campaigns`→2 · `manage_customers`→2 · `view_pricing_config`→2 ·
  `qr_checkout`→1 · `view_customers`→1 · `view_margin`→1 · `import_pricing`→1.
  `view_dashboard` RETIRED (R3); `override_maintenance` STRIPPED (R-B unwired).
- **+6 the bundle adds:** `orders:update` · `service_offerings:read` · `tax_rate:read` ·
  `tax_rate:update` · `settings:read` · `settings:update`.
- **+2 named (rulings 5/6):** `orders:delete` · `order_discount:apply`.
  (`costs:read` and `margin:read` from ruling 7 are already inside the 36 — no revocation risk after
  all, but only because the union is computed rather than the bundle seeded.)

**The union is computed FROM the live row at grant time, not from this document.** A number in a
plan is a claim; the funnel's blast-radius diff is the proof.

## 9.3 STAFF — SUPERSEDES §7 (David's ruling, 2026-07-27)

§7 asked whether STAFF keeps `orders:read`. **The question was wrong** and David's answer says why:
*"staff needs to view order — how else can they fill the order?"*, and *"if a staff member cannot
read a customer's address or phone how will the staff member deliver?"*

**RULING: a staff member READS what they need to do the work, and WRITES nothing without an explicit
grant.** Read is operational; write is authority.

**STAFF = 9 strings:** `orders:create` · `orders:read` · `order_items:read` ·
`order_service_selections:read` · `order_compliance_records:read` · `customers:read` ·
`deliveries:read` · `deliveries.route:read` · `inventory:read`.

### The structural finding this exposes — ONE PATTERN, THREE PLACES

R1's Note A was not wrong about the concern; it picked the wrong instrument. Three permissions are
each carrying two different capabilities:

| string | operational meaning | confidential meaning |
|---|---|---|
| `view_costs` | see the item, its qty, its location | see what it COST |
| `orders:read` | see the order I am filling | see the totals and discounts |
| `customers:read` | see where I am delivering | see the customer's financial history |

**Every one is a FIELD-level privacy problem being solved with a TABLE-level permission, and the
cost each time is a role that cannot do its job.** The durable fix is one projection pattern applied
three times. **3b is the first instance and is therefore built as a REUSABLE SHAPE, not a one-off** —
the orders and customers projections follow it as their own builds.

Two consequences for sequencing:
1. 🔴 **Granting STAFF `inventory:read` before 3b ships means staff see `unit_cost`.** 3b is now a
   PREREQUISITE for the STAFF grant, not an independent item. Either 3b lands first, or the STAFF
   grant holds `inventory:read` back until it does.
2. Owner-test card 2 ("staff cannot see orders") is REWRITTEN to "staff cannot see order MONEY" and
   marked `needs-test` until the orders projection exists. It currently asserts a rule we are
   deliberately retiring.

## 9.4 What BUILD 1 now is, concretely

14 `ALTER POLICY` statements + 1 `CREATE OR REPLACE FUNCTION` (`import_write_price`) + the new
`set_business_tax_rate` writer. The six `FOR ALL` policies gated on `view_costs` **split by command**
into SELECT/INSERT/UPDATE/DELETE on `inventory:{read,create,update,delete}` (and `costs:*` for the
cost tables). No live-only drift to reconcile. **This is smaller than §5 estimated.**

## 9.5 Recorded, NOT in this pass

- 🔴 `deliveries_member_all` grants unrestricted member WRITE incl. DELETE, with no permission
  string. Wider than this migration; needs its own ruling.
- 🔴 The nine owner-only tables (campaigns et al.) mean `manage_campaigns` grants nothing readable.
  N1/N2 — recorded in the enforcement map, not fixed here.
- The floor drift (MANAGER 9→11, OWNER 12→14) is undocumented — no migration wrote it. Provenance
  unknown; recorded as a finding.
- `price_basis` redaction — open question for 3b.

## 9.6 THE TWO QUESTIONS ARE WITHDRAWN — AND WHY (David, 2026-07-27)

§9.5 closed with two questions. **Both were confidentiality questions, and confidentiality is not
a constraint today.** David's correction, verbatim: *"what does it matter if staff sees unit cost
since David is the only owner, manager, staff? These questions need to remember the current
situation and why we are doing the migration in this manner."*

**The premise, held rather than re-derived:** David is the only human with access. ~4 tenants,
~6 member rows, every one his. He holds OWNER, MANAGER and STAFF himself. **The absence of real
users is not a caveat to work around — it is the REASON this migration runs now instead of after
the demo.** Treating it as a risk to sequence around inverts the argument that authorized the
one-pass approach in the first place.

**THE STANDING RULE FOR THIS BUILD — two axes, only one of them constrains:**

| axis | status today | example |
|---|---|---|
| **Exposure / confidentiality** | **NOT a constraint.** Build the model correctly because it must be right before real users exist — but never sequence around who-can-see-what, and never hold a grant pending a projection. | "staff would see `unit_cost` before 3b lands" — irrelevant; it is David's test cost on David's test account |
| **Technical risk** | **Still a real constraint.** | "3b narrows a base-table SELECT across 24 read sites and can break already-proven inventory ground" — legitimate, and it still governs ordering |

**Both questions, answered — not deferred:**

1. **Does 3b land before the STAFF grant? — No constraint. STAFF gets all 9 strings immediately**,
   `inventory:read` included. 3b lands wherever it fits the build order. §9.3 consequence 1 is
   **WITHDRAWN**; the only ordering constraint on 3b is the technical one (repoint the 24 readers
   before or with the narrowing, never after).
2. **`price_basis` — REDACTED with `unit_cost` and `cost_confidence`.** Decided on design grounds,
   not risk: `price_basis` ("at-cost" vs "retail") is cost-DERIVATION metadata, and the projection's
   job is a clean cut — *everything except how this item relates to cost*. Three columns move as one
   set. Reversible in one line if it proves wrong operationally.

**What still governs the cut line in §6** is therefore unchanged but rests on the correct grounds:
3b is held for its own session because it touches 24 sites and can regress proven inventory ground,
and Contract sits behind it because Contract removes the fallback. **Neither reason is exposure.**

## 9.7 STILL NEEDED TO START

**One thing: approve the plan as amended** — the 44-string union (§9.2) and the 9-string STAFF set
(§9.3). No open questions remain.

---

# 10. AMENDMENT 2 — REVIEW RESPONSE (2026-07-27)

Four items from review. In the order they must be acted on.

## 10.1 ✅ ITEM 2 CLOSED FROM CODE — the route layer DOES bypass for the owner

The check was correctly demanded ahead of BUILD 1, and correctly demanded **from code**: what I
had quoted earlier (`owner ⇒ true; member ⇒ list`) was a **comment** at
`BusinessProvider.tsx:167`, and a comment contradicting its repo is tech-debt #61.

**The implementation, `packages/shared/src/context/BusinessProvider.tsx:694-700`:**

```ts
const can = React.useCallback((permissionId: string): boolean => {
  if (isOwnerActive) return true;          // ← line 695, the bypass, in code
  const effective = applyPermissionDependencies(activePermissions ?? []);
  return sharedCan({ permissions: effective }, permissionId);
}, [isOwnerActive, activePermissions]);
```

`isOwnerActive` = `activeResolved?.isOwner`, and `isOwner: true` is set at **line 466** for every
row returned by the **owner path** query against `businesses` — i.e. from `owner_id`, never from an
array. That same push sets `permissions: null`, so **the owner's member array is never consulted at
the UI layer at all** — which is precisely why the 6-string fiction has been invisible for months.

**Verdict: all three STD-020 layers have an owner fallthrough.** Table = 20 `*_owner_all` policies.
API = `callerIsBusinessOwner` (`submit.ts:37`). Route/UI = `BusinessProvider.tsx:695`. **The flip
cannot brick David's access, and the mint fix is safe.** Hazard closed, not assumed closed.

## 10.2 ✅ ITEM 1 ACCEPTED — two funnel calls, not one union

The review is right and the naming is load-bearing. §9.2's single 44-string call conflates two
operations under one label, and if it ships as "the backfill" then **R-A is violated in its first
application** and Phase 7's zero-check can no longer assert "no member gained authority through the
migration" — because one did, invisibly, inside a union.

**Two calls, same transaction, two audit rows:**

| call | op | permissions | what it is |
|---|---|---|---|
| **1 — RENAME** | `save_role_permissions(… 'save' …)` | `decomposition(her 13 live strings)` = **36** | The backfill. R-A compliant, mechanical, zero judgment. Before = all-legacy, after = all-new. |
| **2 — GRANT** | `save_role_permissions(… 'save' …)` | `36 ∪ 8` = **44** | New authority David decided to give. Before = the 36, after = 44. |

Identical end state; the audit log can now answer *"what did the migration do"* vs *"what did David
decide"* a year from now.

**Additional, to make that distinction explicit rather than inferred:** BUILD 1 adds an optional
`p_reason text DEFAULT NULL` to `save_role_permissions`, landing in the audit `detail`. The two
calls pass `rbac-migration:rename` and `rbac-migration:grant`. Both rows are
`role.permissions_changed`, and without a reason a reader must infer which was which from the
before/after shape. **This is tech-debt #72's lesson** (the `sale` ledger row's `reason` is NULL
while every neighbouring kind explains itself) applied before we repeat it — and it directly serves
ruling 4: an audit log should say WHY, not only WHAT. Additive default-NULL param; no caller breaks.

**Recorded as a DEPARTURE, not absorbed:** spec §5's `MANAGER_DEFAULT_BUNDLE` is deliberately
`orders:read/create/update` — **it excludes `orders:delete`**. Granting cancel is a defensible owner
call (ruling 5), *not* a bundle default, and the ledger row says so in those words. Same for
`order_discount:apply`, which is a Phase 5 authority act, not a bundle member.

## 10.3 🔴 ITEM 3 — THE AUDIT ANSWERS HALF, AND THE UNANSWERED HALF IS WORSE

The `audit_log` query came back **non-empty**, and what it shows is good:

- The **tenant** MANAGER row's entire evolution is audited — 10 `role.permissions_changed` rows,
  every one actor `95c1b2e9` (the owner), through the funnel. The 13 strings are fully explained.
- **Two `permission.self_elevation_denied` rows, actor `df7723be`** (2026-07-24 14:11, 2026-07-25
  19:23) — the manager attempting to grant themselves `view_costs`/`view_pricing_config` and later a
  15-string set. **The #152 self-elevation guard fired and audited it, live.** That is candidate
  evidence for team-permissions card 7 (Thunder does not mark cards covered — David's call).

**But none of it explains the FLOOR drift, and the funnel is structurally incapable of causing it.**
`save_role_permissions` only ever touches `business_id = p_business_id`
(`20260723_permission_funnel.sql:242/247/250/256` — its own comment says *"floor (business_id NULL)
never matched"*). Every audited row above wrote the **tenant** row. **The system floor — MANAGER
9→11, OWNER 12→14, both gaining `override_maintenance` + `view_customers` — was written by
something that is neither the funnel nor a migration, and left no audit row.**

**And there is a mechanism sitting right there:** Block C shows `role_definitions` carries
`rd_owner_write [ALL]`. **The #152 §1 trigger closed the direct-write side door on
`business_members` ONLY — `role_definitions` has no equivalent guard.** So the funnel is the only
*app* path, not the only *possible* path. If `rd_owner_write` does not scope `business_id`, then
**any tenant owner can rewrite the PLATFORM floor**, which affects every tenant — an AC-3 class
cross-tenant hole, on the exact mechanism the whole backfill rides on.

**⛔ ONE QUERY NEEDED BEFORE BUILD 1:**

```sql
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'role_definitions';
```

- If `rd_owner_write` is scoped so `business_id IS NULL` can never be written by a JWT caller → the
  floor was hand-edited as `postgres` (benign, platform-owner acting as platform owner). **Record
  it and move on.**
- If it is NOT scoped → the side door is open on the funnel's own template store, and closing it is
  the same one-line trigger shape as #152 §1. **That lands in BUILD 1**, because shipping a
  migration that depends on the funnel's guarantee while the guarantee has a hole is not something
  to discover later.

## 10.4 ITEM 4 — STAFF, and what its own correctness retires

**The 9 strings, enumerated by name** (this list was given in §9.3 and in the message; the review's
count of eight missed the two delivery strings — restating so the set is approved by NAME, never by
cardinality, which is the shape we keep catching):

1. `orders:create` 2. `orders:read` 3. `order_items:read` 4. `order_service_selections:read`
5. `order_compliance_records:read` 6. `customers:read` 7. `deliveries:read`
8. `deliveries.route:read` 9. `inventory:read`

**R1's motivating example is now unoccupied — recorded so nobody "simplifies" the rule away.**
STAFF holds `orders:create` AND `orders:read`, so **no role in the platform exercises the
create-without-read split.** Rule 1 (MODIFY-requires-read; create never requires read) **stays
correct** — a rule that forbids a legitimate state is a bad rule whether or not anyone occupies that
state today — but the concrete case that justified it is gone. Anyone re-reading R1 in six months
will find an abstract rule with no live example and be tempted to collapse it back to
write-requires-read. **This paragraph is the defence against that.** Owner-test card 2 is rewritten
from *"staff cannot see orders"* to *"staff cannot see order MONEY"* and marked `needs-test` until
the orders projection exists.

**`deliveries` is FOLDED INTO THE FLIP** (a change to §9.4, +1 table). `deliveries_member_all [ALL]`
carries no permission string, so every active member — STAFF included — can already create, update
and **DELETE** deliveries. It is not on the 14-row flip list, so after the flip we would be granting
STAFF `deliveries:read` while the table hands them `ALL`. **Declaring a constraint the table does
not enforce is the exact STD-020 failure this migration exists to end**, on a demo-critical surface
(Lauren schedules deliveries). One policy becomes four verb-split member policies:
`deliveries:read` / `deliveries:update` / `deliveries.route:read` / `deliveries.route:update`, with
no delete verb (R2 — `deliveries` has no tombstone). **BUILD 1 is now 14 + 1 = 15 policy sites.**

## 10.5 STILL NEEDED TO START

1. **Approve** the two-call split (§10.2), the 9-string STAFF set by name (§10.4), the 44-string end
   state, and folding `deliveries` into the flip (§10.4).
2. **Run the one query in §10.3** — it decides whether BUILD 1 also carries a `role_definitions`
   side-door close.

---

# 11. AMENDMENT 3 — THE FLOOR DRIFT AND THE HIDDEN-PILL SAVE, BOTH RESOLVED FROM SOURCE (2026-07-27)

## 11.1 🔧 CORRECTION — the floor drift IS in version control. My §9.5 claim was wrong.

Amendment 1 §9.5 recorded *"the floor drift (MANAGER 9→11, OWNER 12→14) is undocumented — no
migration wrote it."* **That is wrong for the larger half of it, and the migration was in the repo
the whole time.**

`supabase/migrations/20260710_customers_member_read.sql:63-67`:

```sql
-- (b) shared floor catalog
UPDATE public.role_definitions
   SET permissions = COALESCE(permissions,'[]'::jsonb) || '["view_customers"]'::jsonb
 WHERE role_key IN ('OWNER', 'MANAGER')
   AND business_id IS NULL
   AND NOT (COALESCE(permissions,'[]'::jsonb) ? 'view_customers');
```

**It explains the evidence exactly.** One statement, `role_key IN ('OWNER','MANAGER')`, floor scope —
which is why both floor rows carry the *identical microsecond* `updated_at`
(`2026-07-10 19:47:00.222737+00`) and **STAFF was untouched** (STAFF was never in the WHERE, and its
`updated_at` still equals its `created_at`). A funnel call writes one `role_key` at a time and could
never produce that signature. The migration also seeds `business_members` (a) and tenant overrides
(c) in the same transaction — deliberate, documented, in its own header.

**`view_customers` is fully accounted for: +1 to OWNER and MANAGER, by a migration.**

## 11.2 `override_maintenance` is still unexplained — and `updated_at` CANNOT date it

MANAGER 9→**11**, OWNER 12→**14** is +2 each. §11.1 accounts for one. The other,
`override_maintenance`, is written by **no migration** — the only three files touching
`role_definitions` are the 20260623 seed (which does not contain it), 20260710 (`view_customers`
only), and the 20260723 funnel.

**`updated_at` cannot narrow it, because it records only the LAST write.** The 07-10 migration
stamped over whatever came before. So the window is creation → last write: **2026-07-06 16:42:59 →
2026-07-10 19:47:00**, and nothing in the catalog can tighten it. `audit_log` cannot either — its
earliest role row is 2026-07-24, and the table sat empty for 23 days before that despite a correct
schema, so absence proves nothing.

**What IS definitive: it did not go through the funnel, because the funnel did not exist.**
`20260723_permission_funnel.sql` is dated 13 days after the window closed.

Stakes are low — `override_maintenance` is `declared-unwired` and gates nothing — but it is evidence
for §11.3, which is the part that matters.

## 11.3 ⚠️ ANSWERED FROM SOURCE — `save_role_permissions` CANNOT write a floor row

The question was: does the funnel accept `p_business_id = NULL`? **No, and it fails closed.**

Its first statement is `PERFORM assert_movement_actor(p_business_id, p_actor_user_id)`, which calls
`is_member_of`, whose body opens `SELECT p_user_id IS NOT NULL AND p_business_id IS NOT NULL AND (…)`
(`20260720_inventory_movement_ledger.sql:255`). A NULL business_id returns false → `RAISE EXCEPTION
… insufficient_privilege`. Even past that, the ownership check `WHERE id = p_business_id AND
owner_id = …` cannot match a NULL id, so it would write `permission.self_elevation_denied` and
return. Both paths refuse.

**So "one write funnel" was ALWAYS scoped to tenant rows. The system floor has no funnel, no audit,
and its only sanctioned writer is a migration.** The plan treated the funnel guarantee as absolute;
it is not, and this is the scope limit stated plainly. The `rd_owner_write [ALL]` question from
§10.3 is therefore narrower than I framed it but still open: it decides whether a **tenant owner
with a JWT** can write a floor row that affects every tenant. **Still worth the one query, now
ranked as hardening rather than a blocker.**

## 11.4 ✅ THE HIDDEN-PILL SAVE — D9(b) IS A HARDENING, NOT A LIVE DEFECT

The 2026-07-24 14:30:31 save dropped `manage_customers` + `view_reports` (12→10), and
`manage_customers` returned 81 seconds later. The question — chips-only, or resolved ± deltas —
**decides it, and it is readable in the client** rather than inferable from the log.

`packages/shared/src/components/team/MemberConsole.tsx:651`:

```ts
setDraft(Object.fromEntries(resolved.map((r) => [r.role_key, [...r.permissions]])));
```

**The draft is seeded from the RESOLVED SET, not from the chip catalog.** `toggle()` adds or removes
exactly one id; `save()` submits `draft[role_key]`. So the submitted set is **resolved ± deltas**,
and **a hidden string survives a save by construction** — it is in the draft, no chip can toggle it,
and it is written back unchanged.

**Therefore the 14:30:31 drop was NOT a silent client wipe.** Those two strings could only leave by
being toggled off, which requires their chips to have been RENDERED. `1aaf99e` (#153, which hid
them) was committed **13:58:54 UTC** — 32 minutes earlier — and committed ≠ deployed. The pills were
still rendering. The 14:31:52 re-add of `manage_customers` is then exactly what it looks like: David
toggling it back on. **No defect. D9(b) — the funnel refusing a save that would drop an unseen
string — is a hardening we may or may not want, not a bug we must fix.**

### 11.4a 🔴 But the MIRROR defect is real, and it is live right now

Because the draft is resolved ± deltas and a hidden string has no chip, **a hidden string can never
be REMOVED through the UI.** It is in every draft, in every submitted set, forever. That is D-9
inverted: not a silent grant, a **silently un-revocable** one.

`override_maintenance` is sitting in the live MANAGER floor **and** the `f7ec5d67` tenant row right
now, and no owner can take it off through the Roles page. **The only thing that currently removes it
is this migration** — `override_maintenance` is in `STRIPPED_AT_BACKFILL.unwired`, so RENAME (call 1)
drops it. Recorded as a finding of its own; the general fix (a hidden-but-held string rendering as a
locked, removable row with an explanation — §6 r13's lock-with-explanation applied to permissions)
is a separate build.

## 11.5 ✅ ACCEPTED — Phase 7's zero-check extends to `role_definitions`

R-C's zero-check reads member arrays. **It must also cover `role_definitions` — the floor AND every
tenant override** — or a legacy string survives Contract inside the template that seeds new members,
and the first member minted after Contract arrives holding a string the model has retired. R-C,
extended one table sideways. Folded into BUILD 6.

## 11.6 The live-read decision is vindicated by the log

Computing the 44 from the live row at grant time rather than from this document: that array changed
**eleven times in three days**, most recently 2026-07-26 18:02 — `manage_settings` off, three
financial strings on. Any number written down was stale before it was written. The two funnel calls
read the row at execution time; this document's numbers are commentary.
