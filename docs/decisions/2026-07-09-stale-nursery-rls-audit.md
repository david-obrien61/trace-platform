# Stale-nursery-model RLS audit (2026-07-09)

**Decision:** D-36 follow-up · **Story:** #231 (order display root cause)
**Trigger:** the recurring "PLANTS (0)" / empty order line-items bug traced to a
`order_items` RLS policy still filtering through the **retired `nurseries` model** while
modern orders write `business_id`.
**Scope of this audit:** every SHARED table whose LIVE RLS policy still resolves tenancy
through a retired / vertical-specific owner model (`nursery_id` → `nurseries`, or the
Ignition twin `shop_id` → `shop_members`) instead of the current `business_id` →
`businesses.owner_id` (+ `is_active_member`) model. This is the RLS-layer analogue of the
vertical-noun audit.

Method: read every `CREATE POLICY` across `supabase/migrations/`, then resolve the LIVE
policy per table (last definition wins), and check whether the join key the policy depends
on is still populated on modern rows.

---

## The bug, precisely

`order_items` carries exactly one RLS policy, `authenticated_select_order_items`
(`20260528_per_tenant_rls_isolation.sql:119-129`):

```sql
USING (
  order_id IN (
    SELECT id FROM orders
    WHERE nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid())
  )
)
```

But `orders.nursery_id` was **dropped** in `20260529_businesses_e_cleanup.sql:13`. Modern
orders carry `business_id`; `nursery_id` no longer exists on `orders`. So the inner
`WHERE nursery_id IN (...)` matches nothing for every modern order → the policy returns
**zero rows** → the authenticated owner's own order lines are silently filtered → the read
succeeds (`200`) but returns `[]` → OrderDetail renders **"PLANTS (0)"**.

**Decisive evidence (services show, plants don't):** the co-read sibling
`order_service_selections` was born on the modern model —
`order_service_selections_owner` (`20260529_businesses_f_service_offerings.sql:78-84`) joins
`orders.business_id → businesses.owner_id`. Same OrderDetail read: services return rows,
`order_items` returns `[]`. That asymmetry is the fingerprint of a stale-model policy on
`order_items`, not a plant_id / missing-row problem (the roster reads `order_items` fine via
a simpler path; and D-36 already dropped `order_items.plant_id`, a different concern — the
line anchor, not the RLS gate).

Parent `orders` (`orders_business_owner`, `20260529_businesses_d_update_rls.sql:15-16`) is
already on `business_id` → that is why the order header loads for the owner; only the two
`order_*` CHILD tables were left behind on `20260528`.

---

## Tag legend

- **BROKEN-NOW** — the join key the LIVE policy depends on is NULL/absent on modern rows,
  so the policy is actively filtering real rows to zero right now.
- **LATENT** — still resolves on the retired model (the table/column still exists), but the
  model is retired and the table is pending removal; works today, a landmine tomorrow.
- **CLEAN** — LIVE policy is on the `business_id` → `businesses.owner_id` (+ optionally
  `is_active_member`) model.

---

## BROKEN-NOW — filtering silently right now

| Table | Live policy | Joins through | Why broken | Disposition |
|---|---|---|---|---|
| **order_items** | `authenticated_select_order_items` (20260528:119) | `orders.nursery_id → nurseries.owner_id` | `orders.nursery_id` dropped (20260529_e:13) → 0 rows on modern orders | **FIXED** in `20260709_order_items_business_rls.sql` → `order_items_owner` on `business_id`, mirroring the sibling |
| **order_addons** | `authenticated_select_order_addons` (20260528:137) | `orders.nursery_id → nurseries.owner_id` | identical stale join; **legacy** table (superseded by `order_service_selections` for new orders) so low live-read impact, but same broken class | **FIXED (guarded)** in the same migration → `order_addons_owner` on `business_id`; no-op if the legacy table was already dropped |

These two — both `20260528` order-child policies — are the ONLY BROKEN-NOW tables. Every
other `20260528` stale policy was superseded by a `business_id` policy in
`20260529_businesses_d_update_rls.sql` or the `plants → cultivar_plants` untangle.

---

## LATENT — retired model still standing

| Table | Live policy | Note | Disposition |
|---|---|---|---|
| **nurseries** | `authenticated_select_nurseries` (20260528:25) — `owner_id = auth.uid()` on `nurseries` itself | The retired-model ROOT — the table `order_items`' stale policy joins THROUGH. Uses `owner_id` directly (not a cross-join) so it "works" while the table exists. Pending DROP (PLATFORM_STATE IN-FLIGHT; `20260611_delete_debris_trace_enterprises_nursery.sql`). | Leave until the `nurseries` DROP; not a live isolation risk. |
| **nursery_modules** | `nursery_modules_business_owner` (20260529_d:50) — already `business_id` | POLICY is CLEAN (business_id). The TABLE is retired — superseded by `business_modules` (20260604), pending `DROP TABLE nursery_modules CASCADE` (Active Tasks §Noun Purge). | Table-level latent only; drop with the noun-purge sweep. |

---

## CLEAN — on the business_id model (verified, no action)

Migrated by `20260529_businesses_d_update_rls.sql` (nursery_id → business_id) or the
`plants → cultivar_plants` untangle, then several standardized onto `is_active_member()`
by `20260622`:

- `orders` — `orders_business_owner` (business_id, owner-only, FOR SELECT)
- `order_service_selections` — `order_service_selections_owner` (business_id, owner-only, FOR ALL) — the fix template
- `order_compliance_records` — `compliance_records_owner_select` (business_id, owner-only, FOR SELECT)
- `plants` → `cultivar_plants` — renamed; nursery_id dropped; `cultivar_plants_owner_select` / `_owner_all` (business_id OR is_active_member)
- `plant_events` — `plant_events_business_owner` (business_id)
- `addons` — `addons_business_owner` (business_id) — legacy but on the right model
- `customers` — `customers_business_owner` (business_id)
- `social_drafts` — `social_drafts_business_owner` (business_id)
- all 2026-06+ tables (`receipts`, `cost_objects`, `business_inventory`, `deliveries`,
  `business_pmi_schedule`, `business_service_log`, `labor_resources`, cost-object graph,
  `business_discovery_profiles`, `business_modules`, `inventory_count_*`, `member_*`,
  `role_definitions`, `audit_log`, `people`, `campaigns*`, `service_offerings`,
  `business_accounting_secrets`, financial-wall tables) — born on `business_id` /
  `is_active_member`.

---

## Ignition twin (`shop_id` / `shop_members`) — N/A for cultivar

No cultivar RLS policy resolves tenancy through `shop_id`/`shop_members`. The only
`shop_id` reference in these migrations is `20260521_make_shop_id_nullable.sql`
(`ALTER TABLE customers ALTER COLUMN shop_id DROP NOT NULL`) — a column relaxation, not a
policy. The `shop_id`/`shop_members` model is Ignition's, in the separate project
`ufsgqckbxdtwviqjjtos`, and is off-limits from cultivar code. Nothing to fix here.

---

## Findings summary

1. **BROKEN-NOW: 2 tables** — `order_items` (the live bug) and `order_addons` (same class,
   legacy). Both fixed in `20260709_order_items_business_rls.sql` (gated).
2. **LATENT: 2** — `nurseries` (retired root, pending DROP) and the `nursery_modules` TABLE
   (policy already clean; table pending DROP). Both fold into the existing noun-purge sweep;
   neither is a live isolation risk.
3. **No other stale-model policy** exists on any shared table. The `20260528` sweep's other
   nine tables were all migrated to `business_id` by `20260529_d` / the untangle.
4. **Owner vs member axis (finding that contradicts the prompt's premise):** the fix keeps
   `order_items` **owner-only**, mirroring its sibling. `order_service_selections` and the
   parent `orders` are BOTH owner-only (no member policy) — the whole order-read family is
   owner-only by the deliberate deferral in `20260622:268-274`. Adding member-read to
   `order_items` alone would create a NEW asymmetry (staff sees plant lines but not the
   order or the services). Member-read on the order family is a whole-family PRODUCT
   decision (a ready, DO-NOT-APPLY-IN-ISOLATION block is parked at the bottom of the
   migration, using `is_active_member` for the member axis).
5. **Write path unaffected:** `order_items` has no write policy; all order writes (incl.
   #100 CRUD) go through the service key, which bypasses RLS. The stale model only ever
   gated authenticated frontend SELECTs, so edit/delete were never blocked and cannot
   regress. This is a SELECT-visibility fix.

## Isolation gate (AC-3, mandatory for any RLS change)

The migration embeds a self-contained, rolled-back proof (impersonates David via the JWT
`sub` claim) proving: (a) the owner now SEES his own order lines — `owner_visible_lines ==
davids_business_lines`, and order `0d1e4110…` returns 2 lines (was 0); (b) he sees NONE of
another business's lines — `other_tenant_lines_visible == 0`. Visibility restored, isolation
intact.
