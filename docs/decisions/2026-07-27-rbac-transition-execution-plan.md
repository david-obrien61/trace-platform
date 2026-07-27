# RBAC TRANSITION — EXECUTION PLAN (2026-07-27)

**Status:** ⛔ **AWAITING DAVID'S APPROVAL. Nothing built.**
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
