# resource:action RBAC — the concrete model, the zero-window migration path, and the card lifecycle

**DESIGN / PLAN ONLY. Zero code, schema, migration, or data changed. David rules on whether to build it.**
**HEAD read: `d59d09b`** (branch `main`, 2026-07-25). Builds on the funnel (#152), the manager-visibility pass (#153), STD-020 (`docs/standards/permission-enforcement-map.md`), and the CRUD matrix (`2026-07-25-manager-crud-matrix-recon.md`).

> **The one question this plan has to answer:** how do we move a LIVE tenant from the old vocabulary to `resource:action` **without ever leaving that tenant half-migrated** — no instant where a manager loses access they should have, or gains access they shouldn't, because the policies moved but the member rows didn't (or vice-versa). The answer is §3 (the alias layer). Everything else is scaffolding around that guarantee.

---

## §1 — THE MODEL, CONCRETELY

Today: **18 flat strings**, most named `view_*` but granting full CRUD, several gating nothing (CRUD-matrix §4). The `resource:action` model replaces them with **`resource:action` pairs** — a noun (what) and a verb (which operation). Every gate — route, RLS policy, RPC — checks the same pair, so they cannot silently disagree (STD-020 becomes structural, not a checklist).

### The verbs
`read` · `create` · `update` · `delete` — plus a few **capability verbs** where the business genuinely needs a named authority beyond CRUD: `checkout`, `import_price`, `apply_tax_exempt`, `apply_discount`, `override`.

### The full mapping (legacy → resource:action)

| # | Legacy string | resource:action | Note |
|---|---|---|---|
| 1 | `view_dashboard` | `dashboard:read` | 1:1 |
| 2 | `qr_checkout` | `orders:checkout` | the CREATE-an-order authority, deliberately distinct from `orders:read` (preserves the STAFF create-not-read split — CRUD-matrix §3.2) |
| 3 | `view_orders` | `orders:read` | 1:1 |
| 4 | `manage_orders` | `orders:update` | **today theater** (gates nothing). Becomes REAL only if order edit/cancel is gated on it — else RETIRE (David's call) |
| 5 | `manage_deliveries` | `deliveries:read` + `deliveries:write` | today route-only over a membership table (N3) → the split gives the table real gates |
| 6 | `manage_customers` | `customers:create` + `customers:update` | today UNWIRED/hidden → becomes the customer WRITE that closes **N5 (Lauren edits customers)** |
| 7 | `view_customers` | `customers:read` | 1:1 |
| 8 | `manage_campaigns` | `campaigns:read` + `campaigns:write` | today route-only over owner-only tables (N1/N2) → gets member policies |
| 9 | `manage_settings` | `settings:manage` + `team:manage` | split settings from team administration |
| 10 | `view_reports` | `reports:read` | no surface today → stays DEFINED, ungated until a report surface exists |
| 11 | `view_costs` | **`inventory:read` + `inventory:write` + `costs:read`** | **the big one** — `view_costs` today = full CRUD on inventory/costs/receipts/assets. Splitting `read` from `write` makes a **read-only inventory viewer** expressible for the first time |
| 12 | `view_pricing_config` | `pricing:read_recipe` | the moat — stays owner-only |
| 13 | `view_wages` | `wages:read` | payroll wall — stays owner-only |
| 14 | `view_margin` | `margin:read` | **depends on `costs:read`** (preserved — §5) |
| 15 | `override_maintenance` | `pmi:override` | mechanism still unbuilt; string preserved |
| 16 | `apply_tax_exempt` | `orders:apply_tax_exempt` | 1:1 (server-gated, real) |
| 17 | `apply_discount` | `orders:apply_discount` | make REAL (gate the discount write on it) or RETIRE |
| 18 | `import_pricing` | `inventory:import_price` | 1:1 (server-gated by `import_write_price`, real) |

### What roles become (the templates, `role_definitions`)
Same three system roles, expressed in the new vocabulary. Example (MANAGER, illustrative — David tunes):
`dashboard:read, orders:read, orders:checkout, inventory:read, inventory:write, inventory:import_price?, costs:read, margin:read, customers:read, customers:create, customers:update, deliveries:read, deliveries:write, orders:apply_tax_exempt` — and **NOT** `pricing:read_recipe, wages:read, settings:manage, inventory:delete` (a manager works the floor but does not delete lots or see the recipe).

The point of the model: that MANAGER line is now **auditable at a glance** — every entry says exactly one operation on one resource. `view_costs` said none of that.

---

## §2 — WHAT WE HAVE vs WHAT WE BUILD

**HAVE (the migration rides these — they are why it's feasible):**
- **ONE read primitive** — `has_permission(business_id, perm)` / `has_permission_for(business_id, user, perm)` ([20260622](../../supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql), [20260723_pricing_gate](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql)). Every RLS policy and RPC checks permissions through these two functions and nowhere else.
- **ONE write funnel** — `save_role_permissions` / `assign_member_role` ([20260723_permission_funnel.sql](../../supabase/migrations/20260723_permission_funnel.sql)). The ONLY way a member's array changes; writes template + member rows + audit atomically.
- **The enforcement map** (STD-020) — the exact list of capabilities × (route, table, RPC) to re-gate.
- **The audit writer** (in the funnel) — every re-materialization is already recorded.
- **Three owner-test boards** — the behavior contracts that must still pass after the swap.

**BUILD (four phases, §4):**
- A **permission-alias layer** — the zero-window mechanism (§3).
- The **new vocabulary** as shared constants + new role templates.
- **Re-gated policies/routes/RPCs** — every enforcement-map row flipped to the new pair, plus the six N1–N6 gaps closed as part of the same pass.
- A **per-tenant backfill** through the existing funnel.
- The **contract** (drop the shim) + a **verify-universals cap** that fails the build if a route and its table check different strings (STD-020's named-not-built mechanical guard).

---

## §3 — THE ZERO-WINDOW GUARANTEE (why a tenant is never half-migrated)

**The whole risk you named lives in one fact: a policy flip and a member-row backfill are two different writes. If a gate starts demanding `inventory:read` before a member's row is rewritten to hold it, that member is locked out in the gap. The fix is to make the two writes NOT need to happen together — ever.**

The mechanism is an **implication (alias) layer** inside the one read primitive:

> `has_permission(biz, 'inventory:read')` returns true if the member holds `inventory:read` **OR holds any legacy string that IMPLIES it** (here, `view_costs`). The map lives in data — a `permission_aliases(from_perm, implies_perm)` table read by the `SECURITY DEFINER` function — so it changes without a migration.

With that layer in place, during the entire transition **old and new strings mutually satisfy every check**:

- A member still holding only `view_costs` **passes a flipped `inventory:read` policy** (the alias resolves it). → You can flip policies first, rows later.
- A member freshly re-materialized to `inventory:read` **passes an un-flipped `view_costs` policy** (add the reverse alias for the window). → You can backfill rows first, policies later.

**Because both directions resolve, no flip and no backfill ever have to be atomic, and the backfill can run tenant-by-tenant over days.** At every instant, for every member, `can(X)` returns exactly what the model intends — resolved under whichever vocabulary that member currently holds. **There is no half-migrated state to be in.** A tenant mid-backfill is fully functional; a tenant not yet started is fully functional; a tenant fully done is fully functional.

The only step that removes a safety net is **CONTRACT** (dropping the alias), and it is gated behind a query that proves the net is no longer holding anything: **zero members hold a legacy string AND zero gates reference one.** Removing an alias whose `from_perm` no member holds and whose `implies_perm` every gate already checks natively changes nothing observable.

This is the standard **expand → migrate → contract (parallel-change)** pattern; the alias layer is what makes the "expand" genuinely behavior-neutral and the "migrate" order-independent.

---

## §4 — THE PHASES (each independently shippable, reversible until CONTRACT)

### PHASE 0 — EXPAND (additive, provably behavior-neutral)
1. Ship the new vocabulary as shared constants (mirrors `financialPermissions.ts`/`actionPermissions.ts`).
2. Create `permission_aliases` (data) + upgrade `has_permission`/`has_permission_for` to resolve implications. **Proof it's neutral:** every existing check still passes identically — a `view_costs` holder still passes `has_permission(view_costs)`; new strings merely *begin* to resolve. New owner-test card: **"a member with only legacy strings passes a new-string check"** (the alias proof).
3. Re-materialize role templates (via the funnel) to carry BOTH vocabularies. Members now hold both; both resolve; nothing observable changes.
**Exit:** the new vocabulary is live and resolvable; zero behavior change. Fully reversible (drop aliases + revert templates).

### PHASE 1 — MIGRATE READS (flip gates, one capability at a time)
Walk the enforcement map row by row. For each capability, flip its route + RLS policy + RPC to the new `resource:action` string **together** (STD-020 — all layers agree). Safe in any order because of the alias. **Fold in the six gaps as you pass them:** N1/N2 (campaigns/social member policies), N3 (deliveries table gate), N4 (PMI), N5 (customer write = `customers:create`/`customers:update`), N6 (anon residual). Each capability is one reversible commit; its owner-test cards get **recreated** with the new string (§6).
**Exit:** every gate checks a `resource:action` pair; the alias still covers not-yet-backfilled members.

### PHASE 2 — BACKFILL (re-materialize member rows to new-only)
Run the funnel per tenant to rewrite each member's array to the NEW vocabulary only (drop legacy). Idempotent, resumable, per-tenant. Because it goes through `save_role_permissions`, **every rewrite is atomic and audited** — a tenant is rewritten role-by-role, never a torn array. A tenant mid-backfill still works (alias). **Verification per tenant:** `SELECT count(*) FROM business_members WHERE <holds any legacy string>` → must reach 0 before that tenant is "done."
**Exit:** zero members hold a legacy string. Still reversible (aliases still present; re-materialize back).

### PHASE 3 — CONTRACT (remove the shim — the one gated, irreversible step)
Gated behind TWO zero-checks across ALL tenants: (a) no member holds a legacy string; (b) no gate references one (grep migrations + `pg_policies`). Then: drop the legacy→new aliases, drop legacy strings from templates, delete the retired dead pills (`manage_orders` if not made real, `view_reports` until a surface exists, `override_maintenance` until built). **Also ship** the `verify-universals` cap that FAILS THE BUILD when a route and its table check different strings — so the model cannot drift back.
**Exit:** one vocabulary, no shim, drift-guarded.

---

## §5 — DEPENDENCIES

**Phase dependencies (hard order):** EXPAND → MIGRATE READS → BACKFILL → CONTRACT. MIGRATE and BACKFILL are internally order-free (alias covers both), but CONTRACT requires BOTH complete and verified. The alias layer is the prerequisite for everything after Phase 0.

**Permission dependencies (carried into the model):**
- **`margin:read` → `costs:read`** — the existing `applyFinancialDependencies` rule ([financialPermissions.ts:81-85](../../packages/shared/src/auth/financialPermissions.ts#L81-L85)); re-expressed on the new strings.
- **`inventory:import_price` → `inventory:read`** (route reachability) — today implicit (import route is `view_costs`-gated); the model makes it EXPLICIT (a declared dependency, so granting import without read is refused honestly instead of silently unreachable).
- **`inventory:write` → `inventory:read`** — you cannot write what you cannot see; declare it so a write-only grant is impossible.
- **Append-only resources have NO update/delete verb** — `business_inventory_ledger`, `audit_log` are create+read by construction (the trigger rejects U/D); the model simply never mints `ledger:update`.

**Cross-artifact dependencies:** each MIGRATE-READS commit updates the enforcement map row (its close-out gate) AND recreates the affected owner-test cards. The map is the driver; the cards are the proof.

---

## §6 — CARD LIFECYCLE — which disappear, which get recreated, which are untouched

Three boards, 20 cards today, are affected. The rule: **cards that test the MODEL'S MECHANICS are vocabulary-agnostic and SURVIVE unchanged; cards that ASSERT A SPECIFIC STRING get RECREATED (same behavior, new string); cards that test a RETIRED pill DISAPPEAR; new capabilities ADD cards.**

### SURVIVE UNCHANGED — the funnel/mechanics cards (vocabulary-agnostic)
`team-permissions` cards **1** (grant → member row changes), **2** (every grant/revoke writes audit), **3** (a removal names who loses what), **4** (owner row lit + locked), **5** (screen count == array length), **7** (self-elevation denied). These test the FUNNEL and audit, which do not change. `manager-visibility` **3** (committed count matches), **9** (pill count == lit pills).

### RECREATED — same behavior, new string (re-worded, `LAST-PROVEN` reset)
- `manager-visibility` **1/2** (`view_orders` → `orders:read`), **7/8** (`view_customers` → `customers:read`), **10** (`view_pricing_config` → `pricing:read_recipe`), **5/6** (tax-rate narrow read — string context updates).
- `csv-import` **16/17/18** (`import_pricing` → `inventory:import_price`).
- `manager-visibility` **4** (add-ons/transport — `service_offerings` membership unchanged, but re-verified under the new order strings).

### DISAPPEAR — retired pills
- `team-permissions` **6** ("the two fake pills no longer render") is **recreated and EXPANDED**: the retired set grows from 2 (`manage_customers`, `view_reports`) to include `manage_orders` (unless made real) and any other dead string — so this card is re-authored to the new retired list, not deleted. (No current card tests `manage_orders` directly, because it gates nothing — so nothing is lost, only the "fake pills gone" assertion is updated.)

### NEW — capabilities the model makes expressible (add cards)
- **Alias proof** (Phase 0): a member holding only legacy strings passes a new-string check; and the reverse.
- **Read-only inventory viewer** (`inventory:read` without `inventory:write`): can open the grid, cannot edit or delete a lot. *Impossible to test today — `view_costs` is all-or-nothing.*
- **Customer write** (N5): a manager with `customers:create`/`customers:update` adds/edits a customer (Lauren's job); without it, read-only. Closes the open ruling.
- **N1–N4 negatives**: campaigns/social/deliveries/PMI member reads gated on the right string, with a staff negative each.
- **Contract verification** (Phase 3): zero members hold a legacy string; the build fails if a route and table disagree.

**Net card count:** ~20 today → ~8 survive untouched, ~9 recreated, ~1 rewritten-and-expanded, **~7 new** ⇒ roughly **27**, and every one maps to exactly one `resource:action` behavior.

---

## §7 — RECOMMENDATION (stated; David rules)

Two shapes were on the table in the CRUD-matrix recon. This plan is the **full `resource:action` (Option A)** written out because you asked for the standard concretely. **My recommendation is still to SEQUENCE it, not swallow it whole:**

- **Do Phase 0 (EXPAND) + the N5 customer-write slice first**, because the alias layer is cheap, reversible, and unblocks the one CRUD split LAWNS actually needs today (Lauren editing customers).
- **Migrate the rest capability-by-capability (Phase 1) as each surface is touched anyway** — ride the consolidate-when-touched seam rather than a big-bang rewrite.
- **Backfill + Contract after LAWNS**, when there is no demo pressure and the zero-checks are easy to stand behind.

That gets the honest-names + real-CRUD value incrementally, keeps every step reversible until the very end, and never asks a live tenant to be half-migrated. **Full-fleet, big-bang is the wrong risk profile for a one-owner tenant; the alias layer is what lets it be incremental. David rules on scope and sequence.**

---

*Companion visual: the phased build board (artifact). Companions: `permission-enforcement-map.md` (STD-020), `2026-07-25-manager-crud-matrix-recon.md`, `2026-07-23-permission-write-sites-recon.md`.*
