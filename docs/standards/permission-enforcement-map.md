# Permission Enforcement Map

**Last updated:** 2026-07-28 (**🔴 THE MAP HAS A FOURTH COLUMN — TILE. Every row below was reconciled across THREE layers and is silently unreconciled on the fourth**; ledger #167) · created 2026-07-24 (manager-visibility build, ledger #153)
**Owner:** David O'Brien / TRACE Enterprises
**Standard:** STD-020 · Decision: David's ruling 2026-07-24 · Recon: R5b (deferred, then re-ranked on live evidence)

> This is not documentation. It is the **RECONCILIATION**. It is the artifact that would have shown
> all six manager-visibility gaps in ONE read instead of them being found one at a time by signing
> in as a manager. R5b proposed it and it was deferred as post-demo — **that deferral was the error.**
> A corpus that cannot say what it contains answers "not found" with the confidence of a correct
> answer (the CAPTURE-INDEX failure, tech-debt #63). This map earns its own close-out gate so it
> cannot rot the same way.

---

## THE PRINCIPLE (STD-020)

**ONE PERMISSION MEANS ONE CAPABILITY, AND EVERY LAYER THAT CAPABILITY TOUCHES CHECKS THAT SAME
PERMISSION.** A capability is gated in up to three independent layers:

- **ROUTE** — `<PermissionRoute permission={X} />` in `router.tsx` → `can(X)` against the member array.
- **TABLE** — an RLS policy on the tables the capability reads/writes.
- **FUNCTION** — a `SECURITY DEFINER` RPC that checks a permission itself.

Hold the permission and the whole path works. Don't hold it and the surface does not appear. The two
forbidden states:

- **🔓→🔒 open at the door, locked at the vault** — route admits on X, RLS filters every row.
- **🔒→🔓 locked at the door, vault standing open** — route gated on a string no member can hold,
  over a table that already grants the read.

A layer MAY be **membership-only** or **ungated** — a legitimate choice — but it must be **DELIBERATE
and stated here**, never the residue of whatever was convenient. **Blank = "not yet examined", NOT
"nothing there".**

---

## HOW TO READ

| Column | Meaning |
|---|---|
| **Capability** | The user-facing surface. |
| **Route gate** | The `PermissionRoute` permission (or `—` if the route is public/ungated). |
| **Table policy** | The RLS policy that governs the data the capability reads, and what it checks: a permission string, `membership` (`is_active_member` only), `owner` (owner_id only), or `service-key` (writes bypass RLS). |
| **Function gate** | A `SECURITY DEFINER` RPC that checks a permission on this path (or `—`). |
| **Tile gate** 🔴 | **ADDED 2026-07-28.** The `tileRegistry.ts` `required_permission` for the tile this capability renders as (or `—` if it has no tile). **This is a REAL gate, not a display hint:** a `NAV_IA` node carrying `tileKey` INHERITS this string, so it decides menu visibility. A tile stricter than its route makes the surface URL-reachable and menu-invisible; a tile looser than its route advertises a destination the route refuses. |
| **Agree?** | ✅ layers agree · ⚠️ disagree (recorded reason) · 🟦 deliberately membership-only/ungated. |

> **🔴 WHY THE FOURTH COLUMN EXISTS (ledger #167).** The `customers` tile held `required_permission:
> 'owner-only'` for **four days** after #153 re-gated the `/customers` route to `customers:read` and
> added the `customers_member` RLS policy — so a MANAGER holding `customers:read` could reach the
> page by URL and never see it in the menu. **Three separate passes reconciled this capability and
> all three missed it, because the standard named three layers and the map had three columns.** A
> layer nobody writes down is a layer nobody checks.
>
> **Every row below predates this column and is therefore UNVERIFIED on it.** The sweep that
> produced this amendment covered the CODE — 33 tiles, 20 carrying a route, **1 disagreement
> (`customers`, now fixed), 0 remaining** — so the code is clean today and it is the MAP that is
> behind. Filling the column per row is owed; `capR` (3) is the mechanism that keeps it true, and
> it fails the build on any tile↔route disagreement.
>
> **A tile whose route is deliberately ungated is a DIFFERENT relationship, not an agreement.** The
> six `/settings` index cards (`qb_invoicing`, `business_profile`, `tax_rate`, `cost_config`,
> `install_price`, `team_management`) are `nav_eligible: false` cards on a per-person index that
> `router.tsx:114-118` leaves ungated on purpose: their `required_permission` gates the CARD, not a
> route. They are declared in `capR`'s `TILE_ROUTE_UNGATED_OK` with that reason, rather than
> silently skipped — **silence on an unknown is not a pass.**

---

## THE MAP

### Order-read family — `view_orders` (FIXED THIS BUILD, ledger #153)

| Capability | Route gate | Table policy | Function gate | Agree? |
|---|---|---|---|---|
| View orders (`/orders`, `/orders/:id`) | `qr_checkout` (route) | `orders_business_owner` (owner) **+ `orders_member_select` (`view_orders`)** | — | ⚠️→✅ see note A |
| Order plant lines (order-detail, committed-stock derivation) | via `/orders` | `order_items_owner` (owner) **+ `order_items_member` (`view_orders`)** | — | ✅ |
| Order service/add-on lines | via `/orders` | `order_service_selections_owner` (owner) **+ `_member` (`view_orders`)** | — | ✅ |
| Order compliance/netting records | via `/orders` | `order_compliance_records_owner` (owner) **+ `_member` (`view_orders`)** | — | ✅ |
| Create an order | — (server-side) | NO insert policy — writes go through the **service key** (bypasses RLS) | `submit.ts` (owner/manager token) | 🟦 service-key by design |

> **Note A — the route/table string mismatch that remains, recorded not hidden:** the `/orders`
> ROUTE is gated on `qr_checkout` (so STAFF can run checkout) while the order-read RLS is gated on
> `view_orders`. These are DIFFERENT strings by design — a STAFF member may TAKE an order
> (`qr_checkout`) but a member only READS the order-read family with `view_orders`. This is a
> deliberate split (create-authority ≠ read-authority), not a leak: a STAFF member without
> `view_orders` passes the route and the page renders empty (they can create, not browse). It is
> recorded here so the split is a decision, not a surprise. Owner-test cards 1/2 prove both
> directions.

### Sell-side catalog — `is_active_member` (FIXED THIS BUILD)

| Capability | Route gate | Table policy | Function gate | Agree? |
|---|---|---|---|---|
| Checkout add-ons / transport / netting (`service_offerings`) | `qr_checkout` (via checkout) | `service_offerings_owner` (owner) **+ `service_offerings_member` (`membership`)** | — | 🟦 membership-only by design (see note B) |
| Recorded service selections on an order | via `/orders` | `order_service_selections_*` (see order family) | — | ✅ |

> **Note B — deliberately membership-only:** the CATALOG of what a business sells (name, category,
> price, transport mode) is printed to the customer and carries NO cost/margin column (verified in
> STEP 0). Any active member needs it to run checkout, so SELECT is gated on membership, not a
> permission. WRITES stay owner-only (`service_offerings_owner` FOR ALL). This is the recorded,
> deliberate membership-only choice STD-020 requires.

### Sales-tax rate — narrow SECURITY DEFINER read (FIXED THIS BUILD)

| Capability | Route gate | Table policy | Function gate | Agree? |
|---|---|---|---|---|
| Read the sales-tax rate at checkout | via checkout | `business_pricing_config` is `view_pricing_config` (owner-only) — the recipe wall, unchanged | **`get_business_tax_rate(uuid)` — `membership`** | 🟦 narrow read by design (see note C) |
| Read the pricing RECIPE (cost/markup/margin) | `/costs` = `owner-only`; `/inventory` etc. = `view_costs` | `business_pricing_config` (`view_pricing_config`, owner) | — | ✅ walled (owner-test card 10) |

> **Note C — why a function, not a wider grant:** the tax rate shares a table with the pricing recipe
> but is not the recipe — it is on every invoice and the customer reads it. Widening
> `view_pricing_config` to managers would hand over margin/markup/cost basis. Instead a narrow
> `SECURITY DEFINER` function returns ONLY `config->>'taxRate'`, membership-checked. The recipe stays
> owner-only (card 10 is the negative proof).

### Customers — `view_customers` (FIXED THIS BUILD)

| Capability | Route gate | Table policy | Function gate | Agree? |
|---|---|---|---|---|
| Customer roster (`/customers`, `/customers/:id`) | **`view_customers`** (was literal `owner-only`) | `customers_business_owner` (owner) + `customers_member` (`view_customers`, 20260710) | — | ✅ (route now matches the table) |
| Look up / attach a customer during checkout | via checkout | `customers_member` (`view_customers`) | — | ✅ |
| Create / edit a customer | — | `customers_business_owner` (owner FOR ALL) — member is SELECT-only | server-side | ⚠️ see the OPEN RULING below |

### Cost & inventory surfaces — `view_costs` (pre-existing, verified AGREE)

| Capability | Route gate | Table policy | Function gate | Agree? |
|---|---|---|---|---|
| Inventory grid / count / reconcile / import (`/inventory*`) | `view_costs` | `business_inventory_member_all` (`view_costs`) + owner | inventory RPCs: `assert_movement_actor` (membership); `import_write_price` (**`import_pricing`**) | ✅ |
| Receipts (`/receipts`) | `view_costs` | `receipts_member_all` (`view_costs`) + owner | `receipts/ocr.ts` | ✅ |
| Assets (`/assets*`) | `view_costs` | membership tables + `cost_objects_member_all` (`view_costs`) | — | ✅ |
| Operating costs (`/operating-costs`) | `view_costs` | `business_service_log_member_all` / `cost_objects` (`view_costs`) | — | ✅ |
| Cost-to-produce (`/costs`) | `owner-only` | `cost_objects` (`view_costs`) + `business_pricing_config` (`view_pricing_config`, owner) | — | ✅ (route stricter than table — deliberate moat, D-009) |
| Wages (labor resources) | via `/costs` / settings | `labor_resources`/`labor_resource_wages` (**`view_wages`**) | — | ✅ |

### Wages/pricing HARD WALL — `view_wages` / `view_pricing_config` (pre-existing)

Both are owner-only in Cultivar today and gate their own tables. ✅ AGREE (the moat the whole
financial wall exists to hold — 20260622).

### Team / roles / settings — `manage_settings` + the funnel

| Capability | Route gate | Table policy | Function gate | Agree? |
|---|---|---|---|---|
| Settings (`/settings/:section`), Admin (`/admin`) | `manage_settings` | `businesses_member_select` (membership read); writes owner | — | 🟦 read membership / write owner |
| Team console (`/team`), roles | `manage_settings` | `role_definitions` `rd_read` (membership); `business_members` self-update | **`save_role_permissions` / `assign_member_role` (owner, D-50 funnel)** + `audit_log` | ✅ (funnel is the ONLY authority writer) |
| Discounts (`/discounts`) | `manage_settings` | `business_pricing_config.config.discountTypes` (`view_pricing_config`, owner write) | — | ✅ (write owner; read business-scoped) |

---

## DISAGREEMENTS — THE NEXT SIX (flagged, NOT fixed this pass)

These are recorded exactly as required: a disagreement is marked even when this build does not fix it.
They are the next manager-visibility gaps, in the same shape as the six just closed.

| # | Capability | Route gate | Table policy | The mismatch |
|---|---|---|---|---|
| N1 | **Social drafts** (`/social/setup`) | `manage_campaigns` | `social_drafts_business_owner` (**owner-only**) | 🔓→🔒 **open at the door, locked at the vault** — a manager holding `manage_campaigns` passes the route and reads ZERO drafts. Same class as `/orders` was. Fix: a `social_drafts_member` SELECT on `manage_campaigns`. |
| N2 | **Campaigns** (`/campaigns`, `/campaigns/:id`) | `manage_campaigns` | `campaigns_owner` (**owner-only**) | 🔓→🔒 same as N1 — the campaigns table is owner-only under a `manage_campaigns` route. Fix with N1 as one whole-family pass (mirror the order-read family). |
| N3 | **Deliveries** (`/deliveries`, `/delivery-schedule`) | `manage_deliveries` | `deliveries_member_all` (**membership-only**) | ⚠️ route checks a permission the table does not — route is STRICTER (safe), but the strings disagree. Decide: gate the table on `manage_deliveries` too, or make the route membership-only. Recorded, not urgent. |
| N4 | **PMI schedule** (`/pmi`) | `view_costs` | `business_pmi_schedule_member_all` (**membership-only**) | ⚠️ route STRICTER than table (view_costs vs membership). A member with membership but not `view_costs` is blocked at the route while the table would allow. Safe direction; recorded. Decide whether PMI is a cost surface (gate the table) or an ops surface (loosen the route). |
| N5 | **Customer WRITE** (add/edit a customer) | `view_customers` (route) | `customers_business_owner` (**owner FOR ALL** — member SELECT-only) | ⚠️ **the OPEN RULING** — a manager can READ the roster but cannot ADD/EDIT a customer, which is Lauren's job at LAWNS. See the ruling below. |
| N6 | **tech-debt #66 residual (anon/public order view)** | public `/plant/:code` etc. | order-read family now member-gated on `view_orders` | ⚠️ the MANAGER half of #66 is FIXED this build; the anon-visitor half (a public order-status view reading `roster {count:0}`) is a separate surface — recorded, re-scoped in tech-debt #66. |

---

## OPEN RULINGS DAVID OWES (STD-020 report, 2026-07-24)

1. **`manage_customers` — make it REAL or HIDE it?** Today: a grantable pill that reaches NO
   capability (a planned tile). This build HID it (reversible default; `UNWIRED_REGISTRY_PERMISSIONS`).
   - **Make it real** = add a member WRITE policy on `customers` gated on `manage_customers`, so a
     manager can add/edit customers (Lauren's job). **Cost:** grants member WRITE access to customer
     PII; `customers_member` is SELECT-only today. This is N5.
   - **Keep hidden** = a manager reads customers but only the owner writes them. **Cost:** Lauren
     can't fix a typo in a customer record without the owner. Zero PII-write exposure.
2. **`view_reports` — hide or gate?** STEP 0 found NO live navigable surface consumes it (only a
   `nav_eligible:false`, `status:planned` tile). Per David's ruling ("no surface → hide it") this
   build HID it. If a reports surface is built later, wire it and remove from the unwired list.

---

## CLOSE-OUT GATE (binding — same force as the other reconciliation gates, §9)

**Adding a permission, a gated route, an RLS policy, or a permission-checking RPC updates THIS MAP,
or the close-out is not done.** State in the write-back which rows were added/changed and whether any
new DISAGREEMENT was introduced. A row left blank is "not yet examined" and must be filled before the
capability it covers is called done.

**NOT built this pass (recorded):** a `verify-universals` cap that FAILS THE BUILD when a route and a
table disagree. The MAP first (the human-readable reconciliation); the mechanical enforcement after
LAWNS. Until then this map is the reconciliation, maintained by this gate.
