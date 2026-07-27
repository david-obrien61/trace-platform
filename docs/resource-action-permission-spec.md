# Resource:Action Permission Specification — Cultivar OS / TRACE

Status: **v3 — RULED. Nothing left open. Build may start at Phase 0.**
Author basis: David's ruling 2026-07-26 — every resource carries all four verbs; a role holds whichever verbs the owner grants; defaults are a starting bundle, not a fixed shape.
Standard: resource:action RBAC (industry standard). Supersedes the coarse single-flag model where `view_costs` meant `FOR ALL`.

---

## Review status — v3, 2026-07-26

**v2 (antigravity review):**
- antigravity confirmed §8's alias layer CLOSES the migration-ordering / dual-write window it had flagged. **Migration gate: cleared.**
- `order_discount:apply` re-pointed to `orders:update`, with a note to confirm the checkout write verb in code.
- Margin read-judgment vs recipe write-lever made explicit (§4.1).
- `audit_log` create is system-only; `deliveries.route` is a dotted sub-resource of `deliveries`.

**v3 (Thunder's spec-vs-repository review, + David's rulings 2026-07-26).** Thunder reviewed the spec against the codebase — a pass neither prior review made — and returned seven findings. **All seven are now ruled and folded in:**

| Ruling | Finding | David's call |
|---|---|---|
| **R1** | Rule 1 (write-requires-read) would have retired the deliberate `qr_checkout` create-not-read split (Note A + owner-test card 2) | **Option (c) — Rule 1 becomes MODIFY-REQUIRES-READ.** Update + delete require read; **create never does.** Note A and card 2 STAY. A create-without-read grant is surfaced on the Roles page as a deliberate choice. §2 restated |
| **R2** | `delete` marked "✓ soft" for four tables with **no tombstone** (only `business_inventory` has one). ⚠️ **Corrected 2026-07-26 (A3):** the original phrasing "no soft-delete column" was factually wrong — `customers`, `deliveries` and `campaigns` each HAVE a `status` column. The RULING is unchanged: **a column is not a tombstone.** Their `status` is lifecycle. | **Option (c) for all four — no delete verb minted until a tombstone exists.** The four cells become dashes. `customers:delete` is a future scoped build, gated on the FK-cascade query. `campaigns:delete` likely never. §3 updated |
| **R3** | `import_pricing` (real, server-enforced, 3 owner-test cards) and `view_dashboard` had no home in the catalog | **Accepted default** — `import_pricing` → `inventory:import_price` (capability verb); `view_dashboard` folds into `is_active_member` and is retired. §3/§5/§6 |
| **R4** | `assets` and `pmi` are gated surfaces with no resource (and `maintenance:override` had no parent) | **Accepted default** — both added as operational resources. §3 |
| **R5** | The verifier cannot "read the live catalog" — the existing one is source-based with no DB access | **Accepted default** — source-based verifier; the applied-in-this-database half stays a David-query at owner-prove. §7 |
| **R6** | `maintenance:override` gates nothing — **nothing in the app blocks on an overdue PMI**, so there is no feature to override | **Accepted default** — stays `declared-unwired` and hidden until the block is built. §5 |
| **R7** | Card list | **Unblocked by R1.** Thunder produces the final card list against these rulings for David's approval **before Phase 0** |
| **R8** | v2 re-pointed the discount dependency to `orders:update`; Thunder confirmed in code that the discount is carried **entirely by the INSERT** (`handleSubmit` 196→562; `handleUpdate` accepts no tier or overrides) | **Reverted to `orders:create` — code beat paper.** The manager-act force stays where it belongs: the default bundle, where the permission is already OFF. §6 |
| **R9** | `margin:read` has no policy and no RPC — enforced client-side only, i.e. render-only | **Accepted default** — new manifest status **`derived`**. §7.1 |

**Also corrected in v3 (Thunder, from code):** `manage_orders` is **not** theater. It gates four server paths in `packages/cultivar-os/api/orders/submit.ts` (order edit 1005, status 1292, delete 1223, price override 238). Prior analyses missed it because they scanned RLS and routes but not the API layer — the third enforcement layer STD-020 names. It maps to `orders:update` + `orders:delete` and is **not** retired.

**Build gate: CLEARED. Nothing open.** Alias layer (§8) lands first, in Phase 0.

---

## 1. The model in one paragraph

A permission is `resource:verb`. Every resource exposes exactly four verbs — `read`, `create`, `update`, `delete` — except where a verb is structurally absent (§3). A role is the set of `resource:verb` strings the owner has granted it. No resource is special-cased; the machinery is uniform. What a MANAGER "is" is not hard-coded — it is a default bundle the owner may change verb-by-verb, per resource. Enforcement is at the data layer (RLS), mirrored at the route and UI layers, and every layer reads the same permission string (STD-020). The verb a policy enforces is fixed by SQL command: `read`→SELECT, `create`→INSERT, `update`→UPDATE, `delete`→DELETE.

---

## 2. The two structural rules (these are not per-resource choices)

**RULE 1 — MODIFY REQUIRES READ.** *(Restated in v3 per David's ruling R1; was "write requires read".)*
For any resource R, holding **`R:update` or `R:delete`** requires `R:read`. You cannot change or remove what you cannot see. This is the fix for the order-visibility bug (a manager completed an order they could not read — modify-without-read, an incoherent state the old model permitted). The verifier rejects any role holding `update` or `delete` without the matching `read`.

**`R:create` NEVER requires `R:read`, and that is deliberate.** Two reasons on record:

1. **They are different shapes.** You can be dangerously blind to a record that already exists. You cannot be blind to one you are writing at that instant. Rule 1 protects against acting on what you can't see; a create acts on nothing.
2. **The database already draws the line here.** In Postgres, `UPDATE` and `DELETE` need a `USING` clause to locate the row — **RLS itself refuses to let you modify what it hides from you.** `INSERT` needs only `WITH CHECK`; there is nothing to be blind to. So for update and delete, Rule 1 restates a guarantee the engine already makes. For create, it would be a *policy* choice — and it is not the one we are making.

This preserves the deliberate **create-authority ≠ read-authority** split recorded as Note A in `docs/standards/permission-enforcement-map.md`: a STAFF member may TAKE an order (`orders:create`) without browsing the business's order history (`orders:read`). That split, and the negative owner-test card that proves it, **stay**.

> **UI REQUIREMENT (David, R1):** a grant of `R:create` without `R:read` is legitimate but unusual. The Roles page must **surface it as a deliberate choice** — an inline note on the role card naming the state ("takes orders, cannot browse them") — so it reads as chosen, never as an oversight. This is Surface Honesty applied to the grant itself: an intentional asymmetry that looks like a mistake will eventually be "fixed" by someone who doesn't know it was on purpose.

**RULE 2 — READ THE JUDGMENT REQUIRES READ THE BASIS.** Some reads are meaningless without another read. The margin health signal (red/yellow/green) cannot be acted on without the cost that makes it red. So `margin:read` requires `costs:read`. This is a content dependency, declared per-resource in §4, distinct from Rule 1's structural one. Reason on record (David, 2026-07-26): a verdict you cannot interrogate is one you cannot act on — showing a manager a red tag with the basis redacted makes them a sensor, not a manager.

**RULE 3 — A SUB-RESOURCE INHERITS ITS PARENT'S READ.** *(v2, formalized in v3 as its own class.)* A dotted sub-resource (`deliveries.route`) has no independent existence, so any `parent.child:*` grant requires `parent:read`. Declared in §6.

All three rules are enforced by the verifier at build time. A role definition that violates any of them fails the build and names the missing string.

---

## 3. The resource catalog — every resource, every offered verb

Each row: the resource, whether each verb is *reachable* (a policy/RPC can enforce it) and any note. "Server-only" means writes happen through a SECURITY DEFINER path, not a direct member policy — the verb still exists, but it is enforced in the function, not a table policy. "Append-only" means the ledger/audit immutability trigger blocks update/delete for everyone including postgres; those verbs are structurally absent by design, not by grant.

**A dash (—) means NO PERMISSION STRING EXISTS FOR THAT VERB.** It is not "denied by default" — it is unmintable. The verifier asserts the code agrees (no policy grants a verb the manifest marks absent).

| Resource | read | create | update | delete | Notes |
|---|---|---|---|---|---|
| `orders` | ✓ | ✓ server | ✓ | ✓ | create/update via checkout + fulfillment RPCs (server-authoritative pricing). `update`/`delete` are REAL and server-enforced today — `submit.ts` handleUpdate/handleStatus/handleDelete (the corrected `manage_orders` mapping) |
| `order_items` | ✓ | ✓ server | ✓ server | ✓ server | lifecycle owned by the order RPCs; read is the member-facing verb |
| `order_service_selections` | ✓ | ✓ server | ✓ server | ✓ server | the netting/add-ons on an order; same lifecycle as order_items |
| `order_compliance_records` | ✓ | ✓ server | ✓ server | — | the netting-warning record (Regina anchor); effectively write-once at sale |
| `customers` | ✓ | ✓ | ✓ | **— R2** | **NO delete verb.** **A COLUMN IS NOT A TOMBSTONE (corrected 2026-07-26, A3).** A tombstone is column + writer RPC + ledger row + audit row + read filters — what `soft_delete_inventory` is. `customers`, `deliveries` and `campaigns` each DO have a `status` column, and it carries LIFECYCLE meaning (pending/delivered, draft/ended), not deletion. A future delete build adds a SEPARATE tombstone column — **do not overload lifecycle**; one column carrying two facts is the STD-011 defect. `customers:delete` is a FUTURE SCOPED BUILD: tombstone column + RPC + read filters, **gated on first answering the FK-cascade query** (does deleting a customer with order history cascade and destroy the history, or is it refused by an FK?). Until that build lands, the verb does not exist |
| `service_offerings` | ✓ | ✓ | ✓ | **— R2** | **NO delete verb** — no tombstone, and no `status` column either (verified 2026-07-26). The sell-side menu (add-ons, delivery, netting products). Retire-by-flag is the likely eventual shape, not a delete |
| `inventory` | ✓ | ✓ | ✓ | **✓ soft** | `business_inventory`; today gated by the coarse `view_costs FOR ALL` — this is the biggest split. **The one REAL tombstone in the platform:** `soft_delete_inventory` sets `status='deleted'`, zeroes qty, and writes BOTH a ledger row and an audit row (20260720). This is the pattern the other resources must match before they earn a delete verb |
| `inventory_ledger` | ✓ | — | — | — | append-only; create is via the movement RPCs (D-50), never direct; update/delete blocked by trigger for all |
| `deliveries` | ✓ | ✓ | ✓ | **— R2** | **NO delete verb** — no tombstone (verified 2026-07-26). It HAS a `status` column; that is lifecycle (pending/delivered), not a tombstone — see the `customers` row. Today member `FOR ALL`; split into verbs |
| `deliveries.route` | ✓ | — | ✓ | — | SUB-RESOURCE of `deliveries` (dotted name signals the parent). The routing/map layer; read+update (reorder stops). **Rule 3:** any `deliveries.route:*` grant requires `deliveries:read` — a route is a view onto deliveries. Kept as a sub-resource, not a peer, because it has no independent existence — no deliveries, no route |
| `assets` | ✓ | ✓ | ✓ | **— A3** | *(NEW in v3, R4.)* `business_assets` — trucks, equipment. Operational, not financial: the table is already membership-gated; only the ROUTE is `view_costs`-stricter (disagreement N4). **`delete` DOES NOT MINT — RESOLVED 2026-07-26 (A3):** the tombstone query returned NOTHING for `business_assets` (no `deleted_at`, no `is_deleted`, no `status`, no `archived_at`). It joins the unmintable set, which is now **FIVE**, all confirmed |
| `pmi` | ✓ | — | ✓ | — | *(NEW in v3, R4.)* `business_pmi_schedule` — service cadence and due dates. read+update. Operational. This is the parent `maintenance:override` hangs from |
| `tax_rate` | ✓ | — | ✓ | — | a single value inside `business_pricing_config`; read+update only (you don't create/delete a rate). Narrow SECURITY DEFINER read/write — NEVER grant the whole pricing_config table. The read exists (`get_business_tax_rate`, applied 2026-07-24); **the WRITE does not yet exist and must be built** (`set_business_tax_rate`) |
| `pricing_recipe` | ✓ | — | ✓ | — | margin.baseline, margin.tiers, priceReference, discountTypes, denominators, locations — the confidential recipe inside `business_pricing_config`. read+update only. Owner-confidential: see §4 |
| `costs` | ✓ | ✓ | ✓ | ✓ | `cost_objects`, `receipts` — cost basis / unit cost. Confidential |
| `margin` | ✓ | — | — | — | the R/Y/G health signal. READ-ONLY as a permission — a computed judgment, not stored data. `margin:read` requires `costs:read` (Rule 2). ⚠️ THE LEVER IS ELSEWHERE: you cannot "change margin" through this resource — margin is fixed by editing the recipe. The write path is `pricing_recipe:update` (§4.1). ⚠️ **Manifest status `derived` (R9)** — it has no gate of its own; it is enforced transitively by its Rule-2 prerequisite (§7.1) |
| `wages` | ✓ | ✓ | ✓ | ✓ | `labor_resource_wages`. Confidential; Andrew's case (read without write) |
| `settings` | ✓ | — | ✓ | — | business profile (name, address, hours). read+update |
| `campaigns` | ✓ | ✓ | ✓ | **— R2** | **NO delete verb** — no tombstone (verified 2026-07-26; its `status` column is lifecycle — draft/ended — not a tombstone), and per David's ruling *likely never*: a deleted campaign destroys its own history. Marketing/growth surface |
| `team` | ✓ | ✓ | ✓ | ✓ | `business_members` + `role_definitions`. WRITE = the permission funnel ONLY (#152); direct writes blocked. Granting/revoking is itself an owner-only capability |
| `audit_log` | ✓ owner | ✓ system | — | — | read is owner-only by design (accountability). "create" is **NOT a grantable user verb** — audit rows are written ONLY inside the funnel/RPCs as a side effect of an audited action; no member ever holds `audit_log:create`, and it takes no manifest entry. update/delete structurally blocked (immutability trigger) |

**Capability verbs** — named authorities that are not CRUD on a resource. They are first-class permission strings and obey the same manifest rules:

| String | Gates | Status today |
|---|---|---|
| `inventory:import_price` | bulk price write from a CSV (blast-radius authority, distinct from single-cell edits) | **ENFORCED** — `import_write_price` RPC checks the passed actor (20260723). Kept per R3 |
| `tax_exempt:apply` | zero an order's tax via a documented exemption (D-40), reason required | **ENFORCED** — `submit.ts:298`, token-verified, tamper-defended |
| `order_discount:apply` | price-tier invoke + per-service price override at checkout | **DECLARED** — the gate exists at `submit.ts:238` but checks `manage_orders`; re-point it + add the audit row |
| `maintenance:override` | authorize an asset to be used with overdue PMI | **DECLARED-UNWIRED (R6)** — *nothing in the app blocks on overdue PMI*, so there is no feature to override. Hidden until the block is built. Parent resource is `pmi` (R4) |

**Retired strings (R3):** `view_dashboard` folds into `is_active_member` — it grants nothing a member lacks — and `view_reports` is retired outright (no surface consumes it).

---

## 4. Sensitivity — which reads are confidential

Not every read is free. Three tiers:

**Operational (read granted by default to MANAGER):** `orders`, `order_items`, `order_service_selections`, `order_compliance_records`, `customers`, `service_offerings`, `inventory` (identity/qty/sell-price only — see the split below), `deliveries`, `deliveries.route`, `assets`, `pmi`, `tax_rate`, `settings`, `campaigns`, `inventory_ledger`.

**Confidential (read is an owner GRANT, off by default):** `pricing_recipe`, `costs`, `margin`, `wages`. A manager does NOT see these unless the owner grants the read. This is the correction from David's R/Y/G question: seeing the margin basis is itself a capability (the capability to manage pricing), so it is granted, not free. Lauren gets `margin:read` + `costs:read` at LAWNS because she prices; a yard hand does not.

**Owner-only (never a grantable pill):** `audit_log:read`, and `team:*` write beyond the funnel. Owner authority comes from `businesses.owner_id`, not the array.

### The inventory read split (important)
`inventory:read` today is coarse — `view_costs FOR ALL` returns everything including `unit_cost`. Under this spec, `inventory:read` returns IDENTITY + OPERATIONAL fields (name, sku, size, qty, sell_price) — what a manager needs to run the yard. The COST field (`unit_cost`) is gated by `costs:read`, a confidential grant. This is the field-level split: table-wide RLS is too coarse, so a narrow projection returns operational columns to `inventory:read` holders and the cost column only to `costs:read` holders. Same pattern as the narrow `tax_rate` read vs the walled `pricing_recipe`.

> **⚠️ THE SPLIT IS ONLY REAL IF THE BASE TABLE NARROWS.** Postgres RLS is row-level, and every signed-in member shares the single `authenticated` role — so per-member column visibility **cannot** be done with column GRANTs. It must be a SECURITY DEFINER projection **and** the base-table member SELECT must be narrowed at the same time. If `inventory:read` still grants direct `SELECT *` on `business_inventory`, a manager reads `unit_cost` with one client call and the split is cosmetic. This is why the build separates the vocabulary swap (Phase 3a) from the field split (Phase 3b).

### 4.1 Margin is read-only; the recipe is the lever

`margin` and `pricing_recipe` are two different resources on purpose, and a person managing pricing needs both — but the split must be stated so nobody hunts for a `margin:update` that does not exist:

- `margin:read` — SEE the red/yellow/green judgment. Confidential. Requires `costs:read` (Rule 2).
- `pricing_recipe:update` — CHANGE the thing that makes a price red or green (margin.baseline, margin.tiers, priceReference, discountTypes — see the CORRECTION note below; the earlier prose named `markup`, which exists nowhere, markup). This is the ONLY write path that moves margin health.
- There is deliberately no `margin:create/update/delete`. Margin is computed, not stored; you do not edit it directly, you edit the recipe and the signal recomputes.

So a full "pricing manager" (Lauren) holds `margin:read` + `costs:read` (to see the health) AND `pricing_recipe:read` + `pricing_recipe:update` (to act on it). A person granted only `margin:read` can SEE which items are underpriced but cannot fix them — a legitimate, deliberate state (a reviewer who flags but doesn't set prices). The Roles page and any "manage pricing" affordance must not imply a margin write verb exists; the affordance to FIX a flagged price routes to the recipe.

### The sensitivity flag on the Roles page
Every confidential permission carries `sensitivity: confidential`. When an owner grants one, the Roles page shows a hard, specific warning ("this exposes your cost / margin / wage data to this person"), not the generic confirm. This is the fix for the live defect where `view_pricing_config` was offered as an ordinary pill with a bland dialog.

---

## 5. The default bundles

These are STARTING grants. The owner may add or remove any verb, per resource, afterward. They are not what a role "is" — they are what a fresh role is seeded with.

### MANAGER — on by default
```
orders:read, orders:create, orders:update
order_items:read
order_service_selections:read
order_compliance_records:read
customers:read, customers:create, customers:update
service_offerings:read
inventory:read            (identity/operational fields only)
inventory:create, inventory:update
inventory_ledger:read
deliveries:read, deliveries:update
deliveries.route:read, deliveries.route:update
assets:read, assets:create, assets:update
pmi:read, pmi:update
tax_rate:read, tax_rate:update
settings:read, settings:update
campaigns:read, campaigns:update
```

### MANAGER — off by default, owner grants per person/role as needed
```
inventory:delete           (the real tombstone; owner decides who can retire a lot)
service_offerings:create, service_offerings:update
              (editing the sell-menu — owner may grant to a trusted manager)
inventory:import_price     (bulk price write from a file — blast radius, not new price authority)
costs:read, costs:create, costs:update, costs:delete     (CONFIDENTIAL)
margin:read                (CONFIDENTIAL; requires costs:read)
pricing_recipe:read, pricing_recipe:update               (CONFIDENTIAL)
wages:read, wages:create, wages:update, wages:delete      (CONFIDENTIAL)
tax_exempt:apply           (applying a tax exemption at checkout)
order_discount:apply       (price override at checkout — audited as leakage signal)
team:read, team:create, team:update, team:delete         (OWNER-only in practice)
```

**Not mintable at all** (R2/R6 — listed so nobody looks for them). **The delete set is FIVE, and all five are now CONFIRMED (A3, 2026-07-26 — `assets` was the last one pending and its tombstone query came back empty):** `customers:delete`, `service_offerings:delete`, `deliveries:delete`, `campaigns:delete`, `assets:delete`. Also: `maintenance:override` (declared-unwired, hidden until the PMI block exists).

### STAFF — the small subset
```
orders:create             (qr_checkout — TAKE an order)
inventory:read
```

> **⚠️ STAFF DELIBERATELY DOES NOT HOLD `orders:read` (R1).** This is the Note A split, preserved: a seasonal hire can take an order at the tag and cannot browse the business's order history — customer names, totals, discounts. Rule 1 permits this because create never requires read. **The Roles page surfaces it as a deliberate choice, not an oversight** (§2 UI requirement), and the negative owner-test card proves it stays true.

### Notes
- `order_discount:apply` and `maintenance:override` are the two "authority acts" — they gate a real feature AND must write an audit_log row naming the actor (leakage signal / liability record). `order_discount:apply` becomes real by re-pointing an existing gate; `maintenance:override` **cannot** until the PMI block is built (R6).
- OWNER holds everything by virtue of `businesses.owner_id`, not by holding strings.

---

## 6. Dependencies — the complete list

**Class 1 — STRUCTURAL (Rule 1, every resource):**
```
R:update  requires  R:read
R:delete  requires  R:read

R:create  requires  NOTHING          ← v3, ruling R1
```
> `create` is deliberately unconstrained. See §2 for the two reasons (a create acts on nothing; and Postgres already couples update/delete to read via `USING`, while `INSERT` needs only `WITH CHECK`). The verifier must NOT flag `create`-without-`read` as an error — it reports it to the Roles page as a deliberate asymmetry.

**Class 2 — CONTENT (Rule 2, declared):**
```
margin:read            requires  costs:read
pricing_recipe:update  requires  pricing_recipe:read        (Class 1)
order_discount:apply   requires  orders:create              ← v3, ruling R8
inventory:import_price requires  inventory:update           (bulk write requires single write)
tax_exempt:apply       requires  orders:create
maintenance:override   requires  pmi:read                   (dormant until the block exists)
```

> **R8 — `order_discount:apply` reverted to `orders:create`; code beat paper.** v2 re-pointed this to `orders:update` on the reasoning that a discount modifies price. Thunder confirmed against the code that it does not: `invokedTier` and `serviceOverrides` are read, gated, priced and written **entirely inside `handleSubmit`** (`submit.ts` 196→562), and **`handleUpdate` accepts no tier and no overrides at all** — you cannot discount an order by editing it. One INSERT carries the price. Depending on `orders:update` would grant a holder that verb — and via Rule 1, `orders:read` — purely to satisfy a paper prerequisite, which is a silent widening of access to satisfy a dependency. **The "discounting is a manager act" force lives where it belongs: the default bundle, where `order_discount:apply` is already OFF.**

**Class 3 — INHERITANCE (Rule 3, sub-resources):**
```
deliveries.route:*     requires  deliveries:read
```

**Parse rule:** a permission string splits on the **LAST colon** — resource names may contain dots (`deliveries.route:read` → resource `deliveries.route`, verb `read`).

The verifier enforces all three classes at build. A role definition holding a dependent without its prerequisite fails the build and names the missing string.

---

## 7. What the verifier asserts

**Source-based (R5).** The verifier reads the repository — the permission manifest, `supabase/migrations/*.sql`, `router.tsx`, `tileRegistry.ts`, **and `packages/cultivar-os/api/**` (the API layer — the third enforcement layer STD-020 names, and the one whose omission let `manage_orders` be misread as theater in two prior analyses)**. It has no database connection and CI has no service key. The *"is it actually applied in this database"* half stays a **David-query at owner-prove**, using the same `pg_policies` proof the 20260724 migration already used.

1. Every `resource:verb` in any role definition maps to a real, enforced policy/RPC (no fake pills) — scoped by manifest `status` (§7.1).
2. Every enforced policy references a `resource:verb` that exists in the manifest (no orphan gates — catches a policy shipped with no declared home, e.g. the customers read that shipped without a pill). System writers (`audit_log` insert) are exempt and declared as such.
3. Route gate string == table policy string for the same capability (STD-020) — **except entries on an explicit `ALLOWED_DIVERGENCE` list, each carrying its recorded reason.** Two permanent entries: `/orders` route (`orders:create`) vs table (`orders:read`) — **Note A, now permanent under R1**; and `/costs` route (owner-only) vs table (`costs:read`) — the deliberate moat, D-009.
4. Every role satisfies all three §6 dependency classes. **`create`-without-`read` is NOT a violation** — it is reported for the Roles-page affordance.
5. No permission named `read` grants a write command, and **no permission grants a verb the manifest marks absent** (this is what makes R2's dashes real: `customers:delete` must exist nowhere in code).
6. Every `sensitivity: confidential` permission renders the hard warning on grant.

Staging: describe → warn → close the current disagreements → fail → render-the-Roles-page-from-manifest. The verifier runs in **WARN** first (it will flag the existing N1–N6 disagreements and the coarse `view_costs`), those get closed, then it flips to **FAIL**.

### 7.1 Manifest status — every string declares what enforces it (R9 + R3)

Each manifest entry carries a `status`, so assertion 1 can be truthful during a multi-phase migration instead of failing until the last phase:

| Status | Meaning | Members |
|---|---|---|
| `enforced` | a policy, RPC, or API-layer gate checks this string | the majority |
| `declared-unwired` | the string exists, nothing enforces it, and it is **filtered out of the Roles page catalog** — never rendered as a grantable pill | `maintenance:override` (R6) |
| `derived` | enforced **transitively** by its Rule-2 prerequisite; has no gate of its own | `margin:read` (R9) |

> **Why `derived` exists (R9).** `margin` has no table, no policy, and no RPC — the only thing enforcing it is a client-side filter (`applyFinancialDependencies`). That is render-only, and "render-only is not enforcement" is a recorded scar here. But margin is *computed from* `unit_cost`, which **is** server-gated, so a member without `costs:read` cannot produce the verdict regardless of what the client hands them. `derived` states that honestly: not `enforced`, not a fake pill either. The alternative — inventing a margin policy so the string has a gate — would be ceremony over a computed value.

This field also replaces the two ad-hoc lists it supersedes (`UNWIRED_ACTION_PERMISSIONS`, `UNWIRED_REGISTRY_PERMISSIONS`) — one representation of one fact (STD-011).

---

## 8. Migration safety — the alias layer ✅ CLEARED

During migration, `has_permission(biz, 'inventory:read')` returns true if the member holds the new string OR the legacy string that implies it (`view_costs`). Old and new strings mutually satisfy each other's checks, resolved both directions. Because of this, the order of the two writes (flip policies / backfill member rows) does not matter — `can(X)` returns exactly what the model intends at every instant, under whichever vocabulary that member currently holds. A tenant mid-backfill is fully functional. The only irreversible step (dropping the alias — "Contract") is gated behind a query proving zero members hold a legacy string and zero policies reference one.

**RESOLVED (antigravity, v2):** the alias layer fully closes the migration-ordering / dual-write window. **Migration gate cleared.** The alias lands first, in Phase 0.

> **Carried into Phase 0 as a build requirement (Thunder):** `has_permission` is `LANGUAGE sql STABLE` and is called **per row** inside RLS `USING` clauses. Replacing a `jsonb ? perm` containment test with an alias join multiplies that cost across every filtered read. Resolve the alias set as an array expansion (`permissions ?| resolved_set`) rather than a correlated subquery per row, keep the function `STABLE` and inlinable, and index `permission_aliases(from_perm)`. **A measurable regression on the inventory grid is a Phase 0 exit-gate failure.**

---

## 9. Owner-test card impact

The current permission cards are written against the coarse model. Under this spec:
- Cards asserting coarse behavior (e.g. "manager holds view_costs") are **RETIRED** — the string no longer exists.
- Cards asserting a *behavior* that survives (e.g. "a manager sees orders they took") are **RE-WRITTEN** against the new string (`orders:read`).
- **Cards proving Note A SURVIVE (R1)** — the STAFF create-without-read split is preserved, so the negative card that proves it is re-written against `orders:create` / `orders:read`, not retired.
- NEW cards, one per structural rule and per confidential grant:
  - **modify**-requires-read holds (grant `orders:update` without `orders:read` → build fails)
  - **create-without-read BUILDS FINE and is surfaced as deliberate** (the R1 inverse — the rule must not over-reach)
  - margin-requires-costs holds (grant `margin:read` without `costs:read` → build fails)
  - a confidential grant shows the hard warning
  - the inventory read split works (a manager with `inventory:read` but not `costs:read` sees sell price, NOT unit cost) **and cannot reach `unit_cost` by querying the table directly**
  - **the unmintable deletes (R2): `customers:delete` exists nowhere** — not as a pill, not as a policy
  - no surface implies a margin WRITE; the fix-a-flagged-price affordance routes to the recipe (§4.1)
  - each authority act gates its feature AND writes an audit row — `order_discount:apply` provable; `maintenance:override` ships `needs-test` with R6 as its stated reason
  - the two demo-critical writes: `customers:update` saves (N5), `tax_rate:update` saves

**Rebuild the card set from this spec rather than editing the old cards** — the mapping changed enough that editing risks carrying a stale assumption forward.

> **R7 — the final card list is produced by Thunder against these rulings, in `docs/decisions/2026-07-26-rbac-build-plan.md` §6, for David's approval BEFORE Phase 0.** Thunder never marks a card `covered`; only David's live run does (OP-14).

---

*v3, 2026-07-26. All nine rulings folded. Nothing open. Companions: `docs/decisions/2026-07-26-rbac-build-plan.md` (the phased build plan + the card list), `docs/standards/permission-enforcement-map.md` (STD-020).*

---

## 🔧 CORRECTION 2026-07-27 — §5's PROTECTED-FIELD NAMES WERE WRONG, 3 OF 4

Found by David on the V7-positive read of `set_business_tax_rate`. §5 named the confidential
recipe in prose as *"baseline margin, reference price, markup"*, and when that prose was turned
into key checks it became `baselineMargin` / `referencePrice` / `markup` / `discountTypes`.
**Checked against the live config and against `CostToProduceConfig`, three of the four do not
exist:**

| documented | actual | note |
|---|---|---|
| `baselineMargin` | **`margin.baseline`** | NESTED, not top-level |
| `referencePrice` | **`priceReference`** | the words are reversed |
| `markup` | **exists nowhere** | not in the type, not in a live row, not in any migration |
| `discountTypes` | `discountTypes` | correct |

**A guard that cannot fail is not a guard.** `config ? 'baselineMargin'` returned false whether or
not the recipe had been damaged. The tax writer's behaviour was proven clean anyway — by diffing
the WHOLE config against a before-image — so this was a latent trap rather than a live defect, but
the flag beside that diff was theatre.

**ROOT CAUSE — the guard was written against the shape of the ANSWER, not the shape of the thing
being protected.** `baselineMargin` *does* exist: on **`CostToProduceResult`** ([CostToProduce.ts:376](../packages/shared/src/business-logic/CostToProduce.ts#L376)),
the COMPUTED OUTPUT. So does `priceReference`. But the protected thing is **`CostToProduceConfig`**,
the STORED INPUT, where the same two facts are `margin.baseline` and `priceReference`. Two of the
four names were lifted from the wrong interface. `markup` came from neither — the only `markup` in
the repo is `packages/ignition-os/modules/IgnitionProt.jsx:266`, **a different vertical's pricing
model**.

**Same family as `verify-financial-permissions.mjs` asserting against business ids that do not
exist: an assertion written from a DOCUMENT instead of from the DATA.**

**The list was also INCOMPLETE, not merely misspelt.** `margin.tiers`, `denominators` and
`locations` — the tier overrides, the sensitivity knob and the cost structure — are every bit as
confidential and were never named. A projection built from the old list would have protected three
phantoms *and* left `margin.baseline`, the tiers and the whole cost structure exposed.

**THE LIST NOW LIVES IN CODE**, not in this document:
`packages/shared/src/business-logic/pricingRecipeFields.ts` →
`PRICING_RECIPE_PROTECTED_PATHS`. 3b's projection and every future recipe writer read it from
there; this section is the narrative, not the source.
