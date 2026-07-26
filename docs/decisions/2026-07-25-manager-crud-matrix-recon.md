# Manager CRUD Matrix — read-not-write, write-not-read, missing permissions, and dependencies

**RECON / ANALYSIS ONLY. Zero code, schema, migration, or data changed.**
**HEAD read: `d59d09b`** (branch `main`, 2026-07-25). Builds #152 (the permission funnel) and #153 (the manager-visibility pass, STD-020 + `docs/standards/permission-enforcement-map.md`) have landed since the 2026-07-23 write-sites recon — this analysis is against CURRENT state, not that recon's `5ec4b9d`.
**DB reads are blocked (no service key).** The POLICY STRUCTURE (RLS `USING`/`WITH CHECK`, command scope, route guards, server gates, the permission vocabulary) is all in source and fully grounded here. The one thing I cannot read is a **live member's actual `permissions` array** — that is a DAVID-QUERY, called out where it changes an answer.

---

## CAN I ANSWER THIS? — YES, with one boundary

**Read-vs-write asymmetry is defined in the policy structure, and the policy structure is in code.** An RLS policy's `USING` clause governs READ (and which rows an UPDATE/DELETE may target); its `WITH CHECK` governs WRITE (INSERT/UPDATE). A `FOR SELECT` member policy with an owner-only `FOR ALL` beside it IS a "read-not-write" surface, provably, from the migration. So all three of your questions are answerable from source:

1. **Read-not-write / write-not-read surfaces (incl. tables)** — yes, from the `FOR …` command scope + `USING`/`WITH CHECK` of each member policy.
2. **Missing permissions → CRUD-by-role-by-function; is it a good model** — yes; the gaps fall out of the matrix, and the judgment is below.
3. **Permission dependencies (write-not-read, create-not-edit)** — yes, from the code (`applyFinancialDependencies`, the append-only ledger trigger, the qr_checkout/view_orders split, the import_pricing/view_costs layering).

**The one boundary:** whether a *specific live manager* can do X also depends on the exact strings in their `business_members.permissions` row, which I can't read. The matrix below is keyed on **the permission each surface REQUIRES**; whether the manager HOLDS it is flagged as a query where it is genuinely ambiguous (notably `view_customers` — see the ⚠️ in §1).

---

## §0 — WHAT A "MANAGER" IS (the held set — and a real ambiguity)

A manager's authority = the strings in their `business_members.permissions` (the funnel now writes this store authoritatively, #152). Two DECLARED manager sets exist and **they disagree** — which one a live manager carries depends on when/how the row was minted:

- **RD floor MANAGER (9)** — [20260623:210-213](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L210-L213): `view_dashboard, qr_checkout, view_orders, manage_deliveries, manage_customers, manage_campaigns, view_reports, view_costs, view_margin`. **No `view_customers`.**
- **`DEFAULT_PERMISSIONS.MANAGER` (14)** — [roles.ts:50](../../packages/cultivar-os/src/auth/roles.ts#L50): the 9 above **plus** `manage_orders, view_customers, override_maintenance, apply_tax_exempt, apply_discount`.

**Neither includes** `manage_settings`, `view_wages`, `view_pricing_config`, or `import_pricing`. So the manager is a **floor-ops role**: inventory, checkout, orders, deliveries, read customers, sees cost/margin but not the pricing recipe or payroll; cannot reach team/settings/costs.

> **⚠️ DAVID-QUERY (materially changes §1):** does the live manager row hold `view_customers`? The floor omits it; `DEFAULT_PERMISSIONS` includes it. If the funnel re-materialized this manager from the RD floor, the manager reads NO customers despite the `/customers` route now being `view_customers`-gated (#153).
> ```sql
> SELECT role, jsonb_array_length(permissions) AS n, permissions
> FROM business_members WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' AND role='MANAGER';
> ```

---

## §1 — THE CRUD MATRIX (per DB table, for a MANAGER)

**C=Create R=Read U=Update D=Delete.** `✅` = permitted by the member/self policy · `—` = no member policy for that op (owner-only or absent) · `self` = own row only · `(perm)` = requires that permission in the manager's array. Command scope and gate cited from the migration.

| Table | C | R | U | D | Gate (member policy) | Class |
|---|:--:|:--:|:--:|:--:|---|---|
| `business_inventory` | ✅ | ✅ | ✅ | ✅ | `business_inventory_member_all` FOR ALL, **`view_costs`** ([20260622:149](../../supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql#L149)) | full CRUD |
| `cost_objects` / `_edges` / `_assignments` | ✅ | ✅ | ✅ | ✅ | `*_member_all` FOR ALL, **`view_costs`** | full CRUD |
| `business_service_log` | ✅ | ✅ | ✅ | ✅ | FOR ALL, **`view_costs`** | full CRUD |
| `receipts` | ✅ | ✅ | ✅ | ✅ | `receipts_member_all` FOR ALL, **`view_costs`** | full CRUD |
| `business_assets` | ✅ | ✅ | ✅ | ✅ | `business_assets_member_all` FOR ALL, **membership** ([20260612:67](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql#L67)) | full CRUD (route is `view_costs` — stricter) |
| `business_pmi_schedule` | ✅ | ✅ | ✅ | ✅ | FOR ALL, **membership** | full CRUD (route `view_costs` — N4 drift) |
| `business_modules` | ✅ | ✅ | ✅ | ✅ | `business_modules_member_access`, **membership** | full CRUD |
| `deliveries` | ✅ | ✅ | ✅ | ✅ | `deliveries_member_all` FOR ALL, **membership** ([20260620:62](../../supabase/migrations/20260620_deliveries.sql#L62)) | full CRUD (route `manage_deliveries` — N3 drift) |
| `inventory_counts` / `inventory_count_sessions` | ✅ | ✅ | ✅ | ✅ | `*_member_all` FOR ALL, **membership** ([20260626:54,95](../../supabase/migrations/20260626_inventory_count_sessions.sql#L54)) | full CRUD |
| `business_inventory_ledger` | ✅ | ✅ | ⛔ | ⛔ | FOR ALL, membership — **but UPDATE/DELETE are trigger-rejected even for postgres** ([20260720:238](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L238)) | **create+read only (append-only)** |
| `orders` | — | ✅ | — | — | `orders_member_select` FOR **SELECT**, **`view_orders`** ([20260724:65](../../supabase/migrations/20260724_manager_visibility_gaps.sql#L65)); creation is server-key | **read-not-write** |
| `order_items` | — | ✅ | — | — | `order_items_member` FOR **SELECT**, **`view_orders`** ([20260724:79](../../supabase/migrations/20260724_manager_visibility_gaps.sql#L79)) | **read-not-write** |
| `order_service_selections` | — | ✅ | — | — | `_member` FOR **SELECT**, **`view_orders`** ([20260724:101](../../supabase/migrations/20260724_manager_visibility_gaps.sql#L101)) | **read-not-write** |
| `order_compliance_records` | — | ✅ | — | — | `_member` FOR **SELECT**, **`view_orders`** ([20260724:115](../../supabase/migrations/20260724_manager_visibility_gaps.sql#L115)) | **read-not-write** |
| `service_offerings` | — | ✅ | — | — | `service_offerings_member` FOR **SELECT**, **membership** ([20260724:52](../../supabase/migrations/20260724_manager_visibility_gaps.sql#L52)) | **read-not-write** |
| `customers` | — | ✅ | — | — | `customers_member` FOR **SELECT**, **`view_customers`** ([20260710:36](../../supabase/migrations/20260710_customers_member_read.sql#L36)) | **read-not-write** (N5 open ruling) |
| `role_definitions` | — | ✅ | — | — | `rd_read` FOR SELECT, membership; write = `rd_owner_write` (owner, funnel-only) | **read-not-write** |
| `businesses` | — | ✅ | — | — | `businesses_member_select` FOR SELECT, membership; write owner | **read-not-write** |
| `audit_log` | ✅ | — | ⛔ | ⛔ | `audit_insert` FOR **INSERT**, membership+self-actor ([20260623:122](../../supabase/migrations/20260623_audit_log_spine.sql#L122)); read = `audit_owner_read` (**owner-only**) | **WRITE-NOT-READ** |
| `business_members` | — | self | self | — | `bm_self_select`/`bm_self_update` (own row; role/perms trigger-blocked) | **self-only** |
| `member_devices` | self | self | self | self | `md_self` FOR ALL, own devices | self-only |
| `member_device_handoffs` | self | self | — | — | `mdh_self_insert`/`mdh_self_select` | self-only |
| `people` | self | self | self | self | `people_self_all`, own person | self-only |
| `campaigns` / `campaign_posts` / `campaign_tone_samples` | — | — | — | — | owner-only ([20260529_campaigns](../../supabase/migrations/20260529_campaigns.sql)) — **no member policy** | **owner-only (N2 leak)** |
| `social_drafts` | — | — | — | — | `social_drafts_business_owner` owner-only | **owner-only (N1 leak)** |
| `business_pricing_config` | — | — | — | — | member policy is `view_pricing_config` (manager lacks it); tax rate via `get_business_tax_rate()` fn | owner-only + narrow fn read |
| `labor_resources` / `labor_resource_wages` | — | — | — | — | `view_wages` (manager lacks it) | owner-only (payroll wall) |
| `business_accounting_secrets` | — | — | — | — | `bas_owner_all` owner-only (QB tokens) | owner-only (correct) |
| `plants` / `plant_events` / `addons` / `opportunity_items` / `order_addons` / `nursery_profiles` / `cultivar_plants` / `pmi_*` | — | ~ | — | — | legacy owner-only or anon-SELECT policies; no member write | owner-only (legacy) |
| `invitations` | — | — | — | — | `inv_owner_all` owner-only (route also `manage_settings`, which manager lacks) | owner-only |

---

## §2 — READ-NOT-WRITE (manager can view but not change)

Provable from `FOR SELECT` member policy + owner-only write:

- **`orders`, `order_items`, `order_service_selections`, `order_compliance_records`** — read the whole order family on `view_orders`; every write is owner or server-key. (#153 gave the read; writes were never opened.)
- **`service_offerings`** — reads the sell-side catalog on membership; add/edit/delete an offering is owner-only.
- **`customers`** — reads the roster on `view_customers`; **cannot add or edit a customer** — this is **N5 / open ruling #1**: *"Lauren can't fix a typo in a customer record without the owner."* ([permission-enforcement-map.md:142,149-155](../standards/permission-enforcement-map.md#L142))
- **`role_definitions`, `businesses`** — reads role templates and the business row; writes are owner (role_definitions via the funnel only).

**At the capability level, one more:** the pricing **recipe** vs the **tax rate** — a manager reads the tax rate (narrow `get_business_tax_rate()` fn) but cannot read *or* write cost/markup/margin ([map §Sales-tax](../standards/permission-enforcement-map.md#L84)). Read-of-a-slice, not the table.

---

## §3 — WRITE-NOT-READ (manager can change but not view)

Rarer, and it exists in two genuine forms:

1. **`audit_log` — the textbook case.** Any active member may **INSERT** (append) a row attributed to themselves ([audit_insert, 20260623:122](../../supabase/migrations/20260623_audit_log_spine.sql#L122)), but **SELECT is owner-only** ([audit_owner_read:136](../../supabase/migrations/20260623_audit_log_spine.sql#L136)). A manager can write history it cannot read back — by design (accountability: you can be recorded, you can't audit yourself). *(Caveat: today the only writer is the funnel, running as the owner — but the POLICY grants members write-not-read, which is what you asked about.)*
2. **`qr_checkout` creates an order a STAFF cannot read.** Capability-level, not a table asymmetry: order creation is server-side on `qr_checkout` ([submit.ts](../../packages/cultivar-os/api/orders/submit.ts)), while reading orders needs `view_orders`. A STAFF member with `qr_checkout` but not `view_orders` **creates orders they cannot browse** — recorded deliberately as [Note A](../standards/permission-enforcement-map.md#L62) in the map ("create-authority ≠ read-authority"). This is the intended write-not-read, and it's a good one.

Beyond these, the model has **no other write-without-read** — every other member write policy is `FOR ALL` (write implies its own read via the same `USING`).

---

## §4 — MISSING PERMISSIONS → THE CRUD-BY-FUNCTION GAP

**The dominant finding: CRUD is COLLAPSED. Almost every permission is a single flag that grants full Create+Read+Update+Delete, and its NAME (`view_*`) understates what it grants.**

- **`view_costs` is not "view" — it is full CRUD** on `business_inventory`, `cost_objects*`, `business_service_log`, `receipts` (all `FOR ALL`). There is **no `edit_costs`/`manage_inventory` distinct from reading it**, so *a read-only inventory viewer role cannot be expressed today.* Same for `view_wages`, `view_pricing_config`.
- **No create/update/delete granularity anywhere.** You asked specifically about "create but not edit" — the model has **no verb dimension** except the two capability-level splits in §3. You cannot grant "add a customer but not delete one," "edit inventory but not delete a lot," "create an order but not cancel it."
- **Route-only / fake pills — permissions that gate nothing at the data layer:**
  - **`manage_orders`** — consulted by **no RLS policy, no RPC, and no route** (grep-confirmed; referenced only as the thing `apply_discount` nominally "rides"). It is in the manager/owner set and gates nothing. Effectively vestigial.
  - **`manage_deliveries`** — gates the `/deliveries` route only; the `deliveries` table is **membership-only**, so holding it vs not makes **zero difference at the data layer** (N3).
  - **`manage_customers`** — reaches no capability; **hidden** this build (open ruling #1). A planned write-pill that was never wired.
  - **`manage_campaigns`** — gates the route but the `campaigns`/`social_drafts` tables are **owner-only** (N1/N2), so a manager holding it passes the door and reads zero rows.
  - **`view_reports`** — no navigable surface; hidden (open ruling #2).
  - **`override_maintenance`** — declared, mechanism unbuilt.
  - **`apply_discount`** — declared, but the real gate is the server owner/manager token, not the string.

**So the "missing permissions," by function:**

| Function | Today | Missing / mis-modeled |
|---|---|---|
| Customers | `view_customers` (read). Write = owner-only | **a WRITE permission** (`manage_customers` exists but is unwired — N5/ruling #1) |
| Orders | `qr_checkout` (create), `view_orders` (read) | **an UPDATE/CANCEL permission** (edits/cancels are server owner/manager token, no grantable string) |
| Inventory / costs | `view_costs` = full CRUD | **a read-only variant** (no way to view without also granting write/delete) |
| Deliveries | `manage_deliveries` (route only) | **table enforcement** — the permission is theater at the data layer (N3) |
| Campaigns | `manage_campaigns` (route only) | **member table policies** — owner-only tables make the pill a dead end (N1/N2) |
| Pricing | `view_pricing_config` (recipe, owner), tax via fn | fine as-is (deliberate moat) |

---

## §5 — PERMISSION DEPENDENCIES

Real, and currently modeled in three places (plus the gaps):

1. **`view_margin` → `view_costs` (declared, enforced).** `applyFinancialDependencies` strips `view_margin` from the effective set if `view_costs` is absent ([financialPermissions.ts:81-85](../../packages/shared/src/auth/financialPermissions.ts#L81-L85)). A margin verdict is meaningless without the cost it derives from — the one explicit dependency in code.
2. **`import_pricing` (WRITE) → `view_costs` (READ/route) — an implicit prerequisite.** To bulk-import prices you must (a) reach `/inventory/import`, gated on `view_costs`, and (b) hold `import_pricing`, checked server-side by `import_write_price` ([20260723_pricing_gate:123](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql#L123)). So a **write permission depends on a read permission** to be exercisable — but this dependency is NOT declared anywhere; it is emergent from the route + RPC. A manager granted `import_pricing` but not `view_costs` holds a write they can never reach.
3. **Create-not-edit / create-not-delete, by construction:** `business_inventory_ledger` grants Create+Read but its trigger **rejects Update/Delete even for postgres** ([20260720:238](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L238)) — append-only is a hard create-without-edit. `audit_log` is the same shape (§3.1).
4. **The undeclared route↔table dependencies (STD-020's whole point):** a capability's route permission and its table permission are *supposed* to be the same string (STD-020). Where they differ and it's SAFE (route stricter — N4 PMI, deliveries-route-vs-membership) it's a silent over-grant of the table; where the route is looser than the table (the old `/orders` bug) it's the "open door / locked vault." Six such disagreements remain flagged ([map §Disagreements N1-N6](../standards/permission-enforcement-map.md#L131)).

---

## §6 — IS THIS A GOOD MODEL?

**It is a good FOUNDATION with a real structural gap. Verdict: strong on enforcement and tenancy, weak on CRUD granularity and naming honesty.**

**What is genuinely good (keep):**
- **Enforcement is real, not render-only.** RLS at the table + route gates + `SECURITY DEFINER` RPCs, tenant-scoped on `business_id` (AC-2/AC-3). This is above the bar for a small-business app.
- **The funnel (#152)** made grants actually take effect and audited — the write-sites defect is closed.
- **STD-020 + the enforcement map** is the right discipline: one permission = one capability across all layers, with disagreements *recorded* rather than hidden, and its own close-out gate.
- **The deliberate splits are correct:** create ≠ read on orders (§3.2); the narrow tax-rate read that keeps the recipe walled; owner-only QB secrets.

**What makes it fall short of a clean CRUD-by-role model:**
1. **CRUD is collapsed to a single flag on most surfaces, and the flag is named `view_*` while granting write.** This is the biggest gap for what you're asking: you cannot express "read-only X," "create-but-not-delete X," "edit-but-not-create X." A `view_costs` holder is a full inventory editor.
2. **Naming lies about authority.** `view_costs` grants CRUD; `manage_orders`/`manage_deliveries`/`manage_customers` grant little or nothing. A model where the string's name doesn't predict what it does will keep producing the exact surprises STD-020 exists to catch.
3. **Route-only permissions are theater** at the data layer (N3, manage_orders) — they look like access control but the table doesn't check them.

**Direction (industry standard, stated — David rules, nothing decided):** the textbook RBAC shape is **`resource:action`** — `orders:read`, `orders:create`, `orders:update`, `customers:read`, `customers:create`, `inventory:read`, `inventory:update`, `inventory:delete`. That gives you the verb dimension you're asking for and makes route/table/RPC checks trivially agree (they all check `resource:action`). Two viable paths:

- **Option A — full `resource:action` RBAC.** Highest fidelity, matches your CRUD-by-function question exactly. **Cost:** a permission explosion (4 verbs × N resources), a migration to rename every gate, and more than LAWNS needs today (one owner, one manager, a few staff). Over-engineering risk (§6 r10).
- **Option B — coarse permissions, honest names, add a verb only where a real role needs the split.** Rename `view_costs`→`manage_inventory` (or split into `inventory:read` + `inventory:write` *only* because a read-only viewer is plausible), wire `manage_customers` as the customer WRITE (closes N5/Lauren), retire the dead pills (`manage_orders`, `view_reports`, `override_maintenance` until built), and gate the route-only permissions at their tables (N1-N4). **Cost:** modest, targeted, keeps the model legible.

**Recommendation stated, not decided:** **Option B.** The only CRUD split LAWNS actually needs today is **customer write** (N5 — Lauren adds/edits customers) and arguably an inventory read-only viewer; the rest of the value is *honesty* (names that match grants) and *closing the six flagged disagreements*, not a full verb matrix. Full `resource:action` (Option A) is the right end-state IF the roster of roles grows (contractors, tiered staff), and the enforcement map already gives you the ledger to migrate onto it without re-discovering the surfaces. **David rules.**

---

## BLOCKED — the live-data confirmations (read-only DAVID-QUERIES)

1. **Does the live manager hold `view_customers`?** (floor omits it; DEFAULT_PERMISSIONS includes it — decides whether §2 customers-read is even reachable). Query in §0.
2. **The manager's full live array** — to convert this REQUIRES-based matrix into a live CAN-DO matrix for the actual manager:
   ```sql
   SELECT role, permissions FROM business_members
   WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' ORDER BY role;
   ```
3. **Confirm the six N1-N6 disagreements are still live** (no policy added since #153): `SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('social_drafts','campaigns','deliveries','business_pmi_schedule') ORDER BY 1;`

---

*Companion to `docs/standards/permission-enforcement-map.md` (STD-020) and `docs/decisions/2026-07-23-permission-write-sites-recon.md`. RECON ONLY — David rules on the model.*
