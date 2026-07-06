# Cost-Wall Leak — Scope Recon (READ-ONLY)

**Date:** 2026-06-22 · **Type:** Verify-first recon, READ-ONLY (no code/schema/policy/build).
**Question:** Gate 3 is RED — a Staff session (`effectivePermissions` Array(3), no `view_costs`)
reached `/costs`, `cost_objects: 21` came back from the server, and `[TRACE:COST]` compute ran.
Scope the data-layer fix: which standardized tables need a financial-permission gate, the
`permissions` JSONB shape so `has_permission()` is built to match, the route-gate status, and
the fused wall policies to recompose.
**Off-Limits honored:** read-only; `oauth.ts` / `auth.ts` / old project untouched; `[TRACE:*]`
stays ON. No fix written.

---

## ⚠️ PREMISE CORRECTION (verify-first) — the leak is a *never-built* data gate, not a *dropped* one

The prompt says the canonical migration "standardized cost-bearing tables onto bare
`is_active_member` … **dropping the permission half** on exactly the tables that need it."
The catalog/migration history says otherwise, and it changes what the fix is:

- `cost_objects_member_all` traces back to `business_assets_member_all`
  (`20260612_business_assets_inventory_pmi_service.sql:67-83`), renamed at
  `20260615_cost_objects_rename_and_node_schema.sql:55`. It was **ALWAYS a pure membership
  `EXISTS(… active = true)` predicate — it never carried a `view_costs` check.** Same for
  `business_inventory`, `cost_object_edges`, `cost_object_assignments`, `business_service_log`,
  `receipts`.
- The canonical migration (`20260622_is_active_member_canonical_rls.sql:131-134` etc.) swapped
  `EXISTS(…active=true)` → `is_active_member(…)`. That is **behavior-EQUIVALENT** (the migration
  says so, lines 26-27, 68-70). It did **not** remove a permission filter from these tables —
  there was none to remove.
- The **data-layer wall (Phase 2, `20260621_financial_wall_phase2.sql`) only covered the two
  HARD-WALL permissions** — `view_wages` (→ `labor_resource_wages`) and `view_pricing_config`
  (→ `business_pricing_config`). **`view_costs` (the SHAPING permission) was enforced ONLY at the
  route/render layer** (`PermissionRoute`, Phase 3/4) — it has **never had a data-layer gate.**

**Net:** the cost data has been membership-readable the whole time; the canonical migration neither
caused nor fixed it. The fix is to **ADD a `view_costs` data-layer gate that was never built**, not
restore a dropped one. (This also means the wages/pricing `$` is NOT leaking — see §4: those fused
policies are deliberately left OUT of the canonical set and still gate.)

---

## 1. Per-table gate map (the 13 standardized tables)

For each table the canonical migration standardized: the columns it holds, the sensitive financial
data (if any), and which permission SHOULD gate the **member** policy. Owner policies are untouched
throughout (owner always reads).

Permission vocabulary (`packages/shared/src/auth/financialPermissions.ts:22-30`):
`view_costs` = operational unit_cost (SHAPING) · `view_wages` = HR pay (HARD WALL) ·
`view_pricing_config` = pricing recipe/moat (HARD WALL) · `view_margin` = cost-vs-sell verdict
(SHAPING, ⊆ view_costs).

### A. NEEDS a financial-permission gate added (7 tables)

| Table | Sensitive columns (evidence) | Gate → |
|---|---|---|
| **cost_objects** | `acquisition_cost`, `recurring_amount` (`20260617`), `cost_confidence`, `cost_category` (`20260618:54`), `cost_shape`/`cadence`, `recovery_basis` (`20260619:80`). The cost spine — `/costs` reads `id,name,node_type,domain,acquisition_cost,cost_confidence,status,cost_shape,cadence,recurring_amount,cost_category,receipt_id,recovery_basis` (`CostToProduce.tsx:107-108`). This is the **exact 21-row leak** (`costObjects: 21`). | **view_costs** |
| **business_inventory** | `unit_cost numeric(10,2)` (`20260612:104`). Read on `/costs` AND ungated on the Dashboard (see §3). | **view_costs** |
| **cost_object_edges** | `use_fraction`, `basis_type`, `basis_note`, `basis_confidence` (`20260615:126-148`) — cost ALLOCATION/attribution structure; reveals how cost rolls up. | **view_costs** |
| **cost_object_assignments** | `conversion_cost numeric(10,2)` (`20260615:197`) + asset→project period allocation. A `$` cost-event value. | **view_costs** |
| **business_service_log** | `cost numeric(10,2)` (`20260612:233`) — service cost events (append-only ledger). | **view_costs** |
| **receipts** | `amount numeric(10,2)`, `ocr_cost_estimate numeric(10,6)`, `vendor`, `category`, `ocr_raw`, `image_url` (`20260612_receipts.sql:17-25`) — spend documents; the source records of what the business paid. | **view_costs** |
| **labor_resources** | Wage columns `base_wage/burden/cost_rate/bill_rate/rate/pass_through_expenses` (`20260618:90-97`) — BUT the Phase-2 wall **COPIED these into `labor_resource_wages` and UPDATE-cleared them to NULL** (`20260621:92-103`). Live `$` now lives ONLY in the gated child. The columns still EXIST (append-only; drop deferred). Residual = role/name spine (`resource_type`, `name`, `rate_basis`). | **view_wages** (HR family) — see note ↓ |

**labor_resources nuance:** today no live wage value leaks through it (the `$` moved to the
`view_wages`-gated `labor_resource_wages`, which is NOT in the canonical set — §4). BUT the six wage
columns are vestigial NULLs that are member-readable, so any future writer that repopulates them
re-opens the leak. Recommend gating the `labor_resources` member policy behind **view_wages** for
defense-in-depth AND/OR completing the planned column-drop. Strictly "membership-only is correct
today," but it is the HR spine and the safest assignment is `view_wages`.

### B. Membership-only is CORRECT — no cost/wage/margin/price data (6 tables)

| Table | Columns | Why membership-only |
|---|---|---|
| **businesses** | identity: `name`, `phone`, `address`, `email`, `website`, `tax_rate`, `business_type` (`20260529:5-22`). | No cost/wage/margin. Member-read is the Gate-3 unblock itself (`20260622:114-117`). ⚠️ **see side-finding** — it also exposes `accounting_token`/`accounting_refresh_token`. |
| **cultivar_plants** | plant identity/QR/growth. `base_price`/`install_price`/`cost_price` were **DROPPED** (`20260613_cultivar_plants_untangle.sql:65-71`). | No price/cost columns remain. (Also has `anon_select_plants` for public profiles — untouched.) |
| **business_modules** | `module_key`, `enabled`, `configured`, `config jsonb` (`20260604:21-28`). | Post-wall the `cost_to_produce` pricing blob was **moved to `business_pricing_config` and cleared to `'{}'`** (`20260621:144-151`). `config` now holds only enablement + non-pricing module config. Membership-only correct **now** (latent: a writer that puts pricing back into `config` would leak — writer was repointed, so OK). |
| **business_pmi_schedule** | `interval_days`, `tasks`, `overrides`, `last_service_at` (`20260612:163-173`). | Maintenance schedule, no `$`. (Note: `/pmi` route is `view_costs`-gated as a UI cluster decision, but the *table* carries no financial data — the cost lives in `business_service_log`.) |
| **deliveries** | `customer_id`, `delivery_date`, `address_line1`, `city/state/zip`, `status`, `source`, `notes` (`20260620:26-37`). | Logistics, no `$`. (Operationally a `manage_deliveries` concern, not a *financial* one.) |
| **business_discovery_profiles** | `source_url`, `raw_extract jsonb`, `status` (`20260621:26-41`). | Website extraction (varieties/services/identity). Catalog extraction carries **NO prices** (per WAVE-2 build). No cost/wage/margin. |

**Summary:** the member policy must become `is_active_member() AND has_permission(…)` on
**7 tables** → **6 × view_costs** (cost_objects, business_inventory, cost_object_edges,
cost_object_assignments, business_service_log, receipts) **+ 1 × view_wages** (labor_resources).
The other 6 stay membership-only.

---

## 2. The `permissions` JSONB shape (so `has_permission()` mirrors the wall)

- **Column:** `business_members.permissions jsonb NOT NULL DEFAULT '[]'::jsonb`
  (`20260602_shared_members_a_create_tables.sql:35`). It is a **JSONB ARRAY of strings.**
- **The Staff member's exact value** (`data/grower-scan/staff-resolve-bug.md:16-20`, user
  `9d0d2123-3226-4d0f-a4e2-657aaa96c298`, business `45830ba7…`):
  ```json
  "permissions": ["view_dashboard", "qr_checkout", "view_orders"]
  ```
  Three strings, **none is `view_costs`** — confirms the Array(3) with no cost grant.
- **How the wall tests it today** (verbatim, `20260621_financial_wall_phase2.sql:79`):
  ```sql
  AND permissions ? 'view_wages'
  ```
  The jsonb `?` operator tests **string-element existence** in the array (migration comment
  `:74`: "tests array-element existence on the jsonb permissions array").
- **The exact expression that returns true iff a member holds view_costs:**
  ```sql
  permissions ? 'view_costs'
  ```
  So a `has_permission()` SECURITY DEFINER helper mirrors `is_active_member` but adds the
  permission element-test:
  ```sql
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND active = true
      AND permissions ? p_permission
  );
  ```
  (Same membership semantics as `is_active_member`, plus the array-element test — composable as
  `is_active_member(X) AND has_permission(X,'view_costs')`, or fused in one EXISTS.)
- **No `has_permission` / permission helper exists yet** — grep of `supabase/migrations/` returns
  nothing. This helper is net-new.

---

## 3. The `/costs` route gate (Part A) — wired, but NOT the boundary

**All five cost surfaces ARE route-gated behind `view_costs`** (`packages/cultivar-os/src/router.tsx:82-88`):
```tsx
<Route element={<PermissionRoute permission={VIEW_COSTS} />}>
  <Route path="/assets"          element={<BusinessAssets />} />
  <Route path="/inventory"       element={<BusinessInventory />} />
  <Route path="/costs"           element={<CostToProduce />} />
  <Route path="/operating-costs" element={<OperatingCosts />} />
  <Route path="/pmi"             element={<PMI />} />
</Route>
```
`PermissionRoute` (`components/layout/PermissionRoute.tsx:15-19`) redirects to `/dashboard` when
`can(VIEW_COSTS)` is false; `can()` (`BusinessProvider.tsx:346-353`) returns `true` for an owner,
else `sharedCan({permissions: effective}, id)` = `effective.includes('view_costs')`. For the Staff
member (Array(3), no `view_costs`) this resolves **false** → the page *should* redirect.

**So why did `/costs` mount and return 21 rows?** Two things, and the fix must address both:

1. **A client route gate is not a security boundary.** `PermissionRoute` is React render-layer
   only. Any active member can call the PostgREST endpoint directly with their JWT
   (`/rest/v1/cost_objects?...`) and — because the RLS is membership-only — get all 21 rows. The
   route redirect is irrelevant to a direct data call. The migration's own comment concedes this:
   PermissionRoute "is NOT the sole control" (`PermissionRoute.tsx:13`). **This alone justifies the
   data-layer gate.**
2. **The in-app mount is a separate gate-bypass to confirm (not fully provable read-only).** The
   page mounting at all means `can(VIEW_COSTS)` returned `true` for the Staff session, which (since
   Staff perms lack `view_costs`) implies `isOwnerActive === true` for that session — i.e. the
   **owner-misdetection / auto-select switcher bug already flagged in the handoff**
   ("BusinessProvider auto-select uses combined `resolved.length`"). Confirming it requires the
   member's JWT (no password here) → describe-only. **Whichever it is, it is the render layer; the
   data-layer gate is the actual boundary and is what this recon scopes.**

**Per-route gate status (all under `PrivateRoute` = authenticated):**

| Route | Gated by `view_costs`? |
|---|---|
| `/costs` | ✅ yes (`router.tsx:85`) |
| `/inventory` | ✅ yes (`:84`) |
| `/assets` | ✅ yes (`:83`) |
| `/operating-costs` | ✅ yes (`:86`) |
| `/pmi` | ✅ yes (`:87`) |
| `/dashboard` | ❌ no — and it issues an **ungated `business_inventory` SELECT** (`Dashboard.tsx:142`), which returns `unit_cost` to ANY active member (incl. Staff). A second, independent data-layer leak the route map cannot close — only the `business_inventory` RLS gate can. |

(Aside: the data-layer ground-truth recon already recorded that the placeholder permissions
"gate nothing" at the route layer historically — `data/grower-scan/role-enforcement-ground-truth.md:145`.
The five cost routes were since wrapped; the *data* layer for `view_costs` still is not.)

---

## 4. The fused wall policies (the recompose target) — verbatim

These two are deliberately **OUT of the canonical standardized set** (`20260622:275-280` records why)
and **still gate correctly** — they are the pattern `has_permission()` decomposes. The fix recomposes
the cost tables to match this shape, just with the membership half factored into `is_active_member()`.

**`lrw_member_view_wages`** on `labor_resource_wages` (`20260621_financial_wall_phase2.sql:75-83`):
```sql
CREATE POLICY lrw_member_view_wages ON labor_resource_wages
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = labor_resource_wages.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_wages'))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = labor_resource_wages.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_wages'));
```

**`bpc_member_view_pricing`** on `business_pricing_config` (`20260621_financial_wall_phase2.sql:129-137`):
```sql
CREATE POLICY bpc_member_view_pricing ON business_pricing_config
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = business_pricing_config.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_pricing_config'))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = business_pricing_config.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_pricing_config'));
```

Both are the **fused predicate** (`active = true AND permissions ? 'X'` in one EXISTS). The
decomposition `is_active_member(X) AND has_permission(X,'X')` is **behavior-equivalent** to the fused
form (same two conjuncts, same membership row) — so recomposing the cost tables onto it loses nothing.

---

## OPTIONS (NEED → WANT) — for David to choose; no fix written

- **HAVE:** cost tables (`cost_objects`, `business_inventory`, `cost_object_edges`,
  `cost_object_assignments`, `business_service_log`, `receipts`) have membership-only member RLS
  (`is_active_member`), no `view_costs` data gate; wages/pricing already gated (fused, §4); the
  five cost routes are `view_costs`-route-gated (client only); Dashboard reads `business_inventory`
  ungated; `labor_resources` wage columns cleared-but-present.
- **NEED (irreducible — close the proven 21-row leak):** add a `view_costs` data-layer gate to the
  **6 view_costs tables**. Build a SECURITY DEFINER `has_permission(p_business_id, p_permission)`
  (mirrors `is_active_member` + `permissions ? p_permission`); rewrite each member policy to
  `is_active_member(business_id) AND has_permission(business_id,'view_costs')`. This alone stops
  `cost_objects: 21` for the Staff session at the server.
- **MID:** NEED + gate `labor_resources` behind **view_wages** (close the vestigial-column re-leak
  footgun), AND gate `business_inventory` consistently so the **Dashboard ungated read** (§3) is also
  refused — i.e. the gate is on the table, so every reader (CostToProduce *and* Dashboard) is covered
  without touching Dashboard code.
- **WANT (full defense-in-depth):** MID + (a) keep but harden the render gate by fixing the
  owner-misdetection/auto-select bug so the SPA also stops mounting `/costs` for Staff; (b) complete
  the deferred **drop** of the now-NULL wage columns on `labor_resources`; (c) address the
  **out-of-scope side finding** below; (d) `view_margin` needs no table gate (it is a computed
  verdict, ⊆ view_costs — already dependency-stripped in `applyFinancialDependencies`); confirm no
  table stores a standalone margin value (none found).

### ⚠️ Out-of-scope side finding (flag, not part of the cost wall)
`businesses_member_select` (`20260622:114-117`) grants active members `SELECT` on the **whole**
`businesses` row, which includes `accounting_token` and `accounting_refresh_token`
(`20260529:16-17`) — live QuickBooks OAuth secrets — plus `accounting_company_id`. This is a
**credential exposure** broader than any cost concern (a member could exfiltrate the QB refresh
token). It is NOT a financial-permission-wall item and `oauth.ts` is Off-Limits, so it is recorded
here only. Recommend a separate, deliberate fix (column-subset view, or move tokens to a gated child
like the wage/pricing split). **Read-only — described, not touched.**

---

## CLOSE
READ-ONLY recon. No code, schema, policy, or build produced. One doc emitted
(`data/grower-scan/cost-wall-leak-scope.md`). No `built-inventory.md` change (per prompt). `[TRACE:*]`
stays ON. Deliverables: the per-table gate map (§1 — 6×view_costs + 1×view_wages need gating, 6
membership-only correct), the `permissions` JSONB shape + exact `view_costs` check (§2), route-gate
status per route + the leak reconciliation (§3), and the fused-policy verbatim recompose target (§4).
Premise corrected: the `view_costs` data gate was **never built**, not dropped. No fix authored —
David scopes the build (options NEED→WANT above).
