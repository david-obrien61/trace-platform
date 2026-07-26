# resource:action RBAC — THE BUILD PLAN

**PLAN ONLY. Zero code, zero schema, zero migration, zero data. Nothing built this pass.**
**HEAD read: `d59d09b`** (branch `main`, 2026-07-26). DB reads blocked (no service key) — every live-data need is called out as a **DAVID-QUERY**.
**Target:** `docs/resource-action-permission-spec.md` **v2, 2026-07-26** (David's ruling — every resource × four verbs; defaults are a starting bundle, not a fixed shape). **The spec is fixed; this plan builds TO it.** *Plan revised against v2 on 2026-07-26; v1 deltas recorded in §1.*
**Supersedes:** `docs/decisions/2026-07-25-resource-action-rbac-migration-plan.md` (reconciled in §1 — the spec wins wherever they differ).
**Decision check:** no new D-number. Implements D-50 (funnel shape), STD-011, STD-020, AC-2/AC-3, D-9, and the alias layer already designed in the 07-25 plan.
**Build gate:** ✅ **CLEARED.** antigravity confirmed the §8 alias layer closes the ordering/dual-write window; **David ruled R1–R9 on 2026-07-26** and all nine are folded into **spec v3**. The one item outstanding is **David's approval of the §6 card list (42 cards)** — the last gate before Phase 0.

---

## §0 — SPEC FINDINGS SURFACED (read this first — seven items change the plan)

The spec is the target and I am not redesigning it. But seven things in it are contradicted by the
repo or are not reachable as written. Per STEP 0(b) they are **surfaced, not silently deviated
from**. Each names the ruling it needs.

> **✅ STATUS: ALL SEVEN FINDINGS ARE RULED (David, 2026-07-26) AND FOLDED INTO SPEC v3.**
> Read each finding below as the *reasoning* that produced the ruling; the ruling itself is in the
> rulings table at the end of this document, and the settled text is in the spec. Summary: **F1 →
> option (c)**, Rule 1 becomes *modify*-requires-read and the Note A split survives · **F2 → option
> (c) ×4**, no delete verb minted without a tombstone · **F3–F6 → the stated defaults** · **F7 →
> manifest `status: derived`.**
>
> **⚠️ WHY THESE WERE NOT IN v2: none of F1–F6 was addressed there, and F7 was new.**
> This is not a conflict — **the two reviews were parallel and non-overlapping.** antigravity
> reviewed *migration safety and model coherence* (the alias window, the discount verb, the
> margin/recipe lever) and its two corrections are folded in below. This plan reviews *the spec
> against the repository* (what the tables, policies and API layer actually do today). Neither
> review saw the other's findings. **v2's header line — "everything else unchanged from v1 and
> considered settled by both reviews" — should not have been read as settling F1–F6; they were never
> in front of either reviewer.** That gap is now closed by v3.

### F1 🔴 — RULE 1 (write-requires-read) RETIRES A DELIBERATE, RECORDED, CARD-PROVEN SPLIT

Spec §2 Rule 1 makes `orders:create` require `orders:read`. Today the opposite is **deliberate and
documented**: the `/orders` route is gated on `qr_checkout` while the order-read RLS is gated on
`view_orders`, recorded as **Note A** in the enforcement map — *"a STAFF member may TAKE an order
(`qr_checkout`) but only READS the order family with `view_orders` … create-authority ≠
read-authority."* It has two owner-test cards, including the negative (`manager-visibility` card 2:
*"a STAFF member WITHOUT `view_orders` still sees nothing on `/orders`"*).

Under Rule 1 that state becomes **unexpressible**: a seasonal staffer who runs QR checkout must now
be able to browse every order in the business. Spec §5 confirms the intent — the STAFF default is
`orders:read, orders:create`.

**This is a real product change, not a refactor.** It is also, note, the *inverse* of the bug Rule 1
cites: the order-visibility bug was a manager who could **complete** an order they could not read;
`qr_checkout` staff is the case where the split was chosen on purpose.

> **RULING OWED (David):** (a) Rule 1 wins — staff who take orders can read all orders, Note A is
> retired, card 2 is retired; or (b) `orders:create` is a named exemption to Rule 1 (the one
> create-without-read the model permits, recorded in the manifest as such). **Everything else in the
> plan is unaffected by which way this goes; Phase 1 cannot close without it.**

### F2 🔴 — "✓ soft" DELETE IS CLAIMED FOR FOUR TABLES THAT HAVE NO SOFT-DELETE

Spec §3 marks `delete` as **"✓ soft"** for `customers`, `service_offerings`, `deliveries`, and
`campaigns`. Grepped across every migration: **there is no `deleted_at`, no `is_deleted`, and no
tombstone status column on any of those four tables.** The only real tombstone in the platform is
`business_inventory` (`soft_delete_inventory` RPC → `status='deleted'`, qty 0, ledger +
audit row — 20260720:721-734).

So `customers:delete` / `service_offerings:delete` / `deliveries:delete` / `campaigns:delete` today
would be **hard DELETEs**. The spec's own caveat on the customers row — *"confirm the table
soft-deletes before granting delete"* — is the check, and it comes back negative.

> **RULING OWED (David):** per table — (a) build the tombstone (a column + an RPC + consumer filters,
> ~1 migration each — real scope, not a gate flip), (b) ship the verb as a HARD delete and say so, or
> (c) **mint no `delete` verb for that resource** until the tombstone exists (the manifest's "absent
> verb" state, spec §3's own mechanism). **My recommendation: (c) for all four.** All four are OFF by
> default in §5 anyway, so (c) costs nothing today and refuses to ship a destructive verb the data
> layer cannot honor.

### F3 🟡 — TWO REAL, ENFORCED PERMISSIONS HAVE NO HOME IN THE SPEC CATALOG

- **`import_pricing`** — server-enforced by the `import_write_price` RPC
  (`has_permission_for(business, actor, 'import_pricing')`, 20260723_pricing_gate:123), with **three
  owner-test cards** (inventory board 16/17/18) and a live grant path. It appears **nowhere** in spec
  §3's catalog or §5's bundles. A four-verb matrix has no cell for "bulk-write prices from a file"
  — it is a blast-radius authority over an operation, exactly like the two authority acts §5 *does*
  name.
- **`view_dashboard`** — held by all three roles, gates 4 tiles + 2 IA nodes in `tileRegistry.ts`
  and is described in `router.tsx:113` as *"OPEN to every authenticated session."* No `dashboard`
  resource exists in spec §3.

> **RECOMMENDATION (David rules):** carry `import_pricing` forward as **`inventory:import_price`**
> (the 07-25 plan's name), declared in the manifest as a **capability verb** alongside
> `tax_exempt:apply` / `order_discount:apply` / `maintenance:override`, with the declared dependency
> `inventory:import_price → inventory:update` (Rule 1 in spirit: bulk-write requires single-write).
> Retiring it would delete a working, card-proven gate. For `view_dashboard`: **fold it into
> membership** (`is_active_member`) rather than mint `dashboard:read` — it grants nothing a member
> lacks, and the registry's fallback already treats it as the floor. That deletes one string instead
> of translating it.

### F4 🟡 — `assets` AND `pmi` ARE GATED SURFACES WITH NO RESOURCE IN THE CATALOG

`business_assets` and `business_pmi_schedule` are **membership-gated at the table** but
**`view_costs`-gated at the route and tile** (this is disagreement **N4**). Spec §3 has no `assets`
and no `pmi` resource, yet `maintenance:override` (§5) is explicitly a PMI authority. When
`view_costs` is retired, these two surfaces have no string to move to.

> **RECOMMENDATION:** add `assets` (4 verbs) and `pmi` (read + update) to the manifest as
> **operational** resources, defaulting ON for MANAGER — they are yard equipment and service
> schedules, not financial secrets (their tables are already membership-only; only the *route* is
> stricter, which is the N4 over-tightening). This also gives `maintenance:override` a resource to
> hang from. **David rules;** without a ruling, Phase 4 has nowhere to put them.

### F5 🟡 — THE VERIFIER CANNOT "READ THE LIVE CATALOG"

Spec §7 says the verifier is *"build-time, reads live catalog."* The existing verifier
(`scripts/verify-universals.mjs`, 801 lines, 12 caps) is **source-based**: it concatenates
`supabase/migrations/*.sql` and regex-reads `.tsx` files (`concatSql`, `effectivePolicy`,
`policyNamesOnTable`). It has **no DB connection**, and CI has no service key. A live-catalog
verifier is a different artifact with a credential requirement.

> **RECOMMENDATION:** build it **source-based** (matching capF/capG), which is sufficient for five of
> the six assertions — the manifest, the policies, the routes and the role definitions are all in
> version control. Assertion 1's *"is it actually applied in this database"* half stays a
> **DAVID-QUERY** at owner-prove (the same `pg_policies` proof the 20260724 migration already used).
> **This is honest, not a downgrade: the source is what the build can gate on; the catalog is what
> David proves.**

### F6 🟡 — ASSERTION 1 CANNOT PASS UNTIL THE LAST PHASE UNLESS THE MANIFEST CARRIES STATUS

Spec §7 assertion 1 requires every `resource:verb` in a role definition to map to a real enforced
policy/RPC. But the spec's own catalog declares verbs that **have no enforcement today** and get it
in later phases (`customers:create/update`, `campaigns:*`, `service_offerings:create/update`,
`tax_rate:update`). During Phases 1–5 the manifest legitimately contains not-yet-enforced strings.

> **PLAN REFINEMENT (mechanism, not redesign):** every manifest entry carries
> `status: 'enforced' | 'declared-unwired'` and `sensitivity: 'operational' | 'confidential' |
> 'owner-only'`. Assertion 1 becomes: *enforced strings must map to a real gate; `declared-unwired`
> strings must be filtered out of the Roles page catalog* — which is exactly what
> `UNWIRED_ACTION_PERMISSIONS` / `UNWIRED_REGISTRY_PERMISSIONS` do today, promoted from two ad-hoc
> lists into one field on one manifest (STD-011). **This is what lets §7's staging work at all.**

### F7 🟡 *(NEW — surfaced by v2 §4.1)* — `margin:read` HAS NO SERVER-SIDE GATE

v2 §4.1 promotes `margin` to a first-class confidential resource with its own read verb. In the
repository, **`margin` has no table, no RLS policy, and no RPC.** The verdict is computed, and the
only thing enforcing `view_margin` today is `applyFinancialDependencies`
(`financialPermissions.ts:81-85`) — a **pure client-side filter** that strips the string from the
effective set when `view_costs` is absent.

It is coherent *by proxy*: margin derives from `unit_cost`, which **is** server-gated, so a member
without `costs:read` cannot compute the verdict even if the client hands them the string. But as a
permission string in its own right, `margin:read` is **render-only** — and "a client-side check
alone would be render-only" is a recorded scar in this repo (the 2026-06-21 record, cited in
`actionPermissions.ts:72`). **Verifier assertion 1 will flag it** (§4, flag 16).

> **RECOMMENDATION:** give the manifest a third `status` value — **`derived`** — meaning *enforced
> transitively by its Rule-2 prerequisite, with no gate of its own*. `margin:read` is the only
> current member. That is honest (it is not `enforced`, and it is not a fake pill either), it keeps
> assertion 1 truthful, and it documents *why* the string is safe without a policy. The alternative
> — inventing a `margin` policy so the string has a gate — would be ceremony over a computed value.
> **David rules.**

**VERDICT §0:** the spec is buildable. **F1 and F2 are blocking rulings** (F1 decides Phase 1's exit
criteria; F2 decides which delete verbs exist at all). F3/F4/F5/F6/F7 have stated recommendations and
default to those recommendations if David does not rule otherwise. **v2 addressed none of F1–F6 —
see the status note at the top of this section.**

---

## §1 — RECONCILIATION WITH THE 2026-07-25 MIGRATION PLAN

| Area | 07-25 plan | Spec (2026-07-26) | Resolution |
|---|---|---|---|
| **Alias layer / zero-window** | `permission_aliases` table read by `has_permission` (§3) | §8, same mechanism | ✅ **AGREE — carried forward verbatim.** The spec cites it; this is the one piece already designed. |
| **Expand → migrate → contract phasing** | 4 phases (§4) | not specified | ✅ **AGREE — carried forward**, re-cut in §3 below to put the demo spine first. |
| **Consolidate-when-touched seam** | recommended (§7) | not specified | ✅ **AGREE — carried forward.** |
| **Verb set** | 4 CRUD + 5 capability verbs (`checkout`, `import_price`, `apply_tax_exempt`, `apply_discount`, `override`) | **exactly four verbs per resource**, uniform; authority acts named separately (`tax_exempt:apply`, `order_discount:apply`, `maintenance:override`) | ⚠️ **SPEC WINS.** The 07-25 verb zoo is retired. `orders:checkout` → `orders:create`. Capability verbs survive only as the three named authority acts (+ `inventory:import_price`, F3). |
| **Structural rules** | write→read named only as an inline dependency | **RULE 1 + RULE 2, verifier-enforced, build-failing** | ⚠️ **SPEC WINS — and it costs Note A (F1).** The 07-25 plan explicitly preserved the create-not-read split; the spec forbids it. |
| **Field-level split** | not present | **§4 inventory read split** (`unit_cost` behind `costs:read`) | ⚠️ **SPEC ADDS.** This is the single largest piece of new work in the whole build (§5 below) — the 07-25 plan under-scoped `view_costs` as a string swap. |
| **Sensitivity tier** | not present | **§4 three tiers + hard warning on confidential grant** | ⚠️ **SPEC ADDS.** New manifest field + a Roles-page dialog variant. |
| **`view_costs` mapping** | `inventory:read` + `inventory:write` + `costs:read` (3) | four verbs × 2 resources + ledger read (9) | ⚠️ **SPEC WINS** — see §2 row 11. |
| **`manage_orders`** | *"today theater (gates nothing) … else RETIRE"* | `orders:update` implied | 🔴 **BOTH PRIOR DOCS ARE WRONG — corrected here.** See the correction below. |
| **Naming** | `pricing:read_recipe`, `pmi:override`, `settings:manage`, `dashboard:read`, `reports:read` | `pricing_recipe:read`, `maintenance:override`, `settings:update`, (no dashboard, no reports) | ⚠️ **SPEC WINS** on every name. |
| **Recommendation** | Option B-ish: sequence it, Phase 0 + N5 first, rest post-LAWNS | David ruled: full model, demo runs on migrated surfaces | ⚠️ **SUPERSEDED BY DAVID'S RULING.** The plan below migrates the demo spine BEFORE LAWNS, not after. |

### SPEC v1 → v2 DELTAS (antigravity's review) — effect on this plan

| v2 change | Effect on this plan |
|---|---|
| **Alias layer CONFIRMED to close the window; migration gate cleared** | §8's fallback branch is **moot** — retained as a record, marked superseded. Phase 0's antigravity gate item is **satisfied**. The perf note in §8 still applies and is carried into Phase 0's build. |
| **`order_discount:apply` now requires `orders:update`** (was `orders:create`) | ⚠️ **Contradicted by the code, and v2 asks me to confirm it.** Answer in §7 below: the discount is carried **entirely by the INSERT** — `handleUpdate` accepts no tier or overrides. **Recommendation: keep the mechanical dependency at `orders:create` and express "discounting is a manager act" through the default bundle (where it already is — OFF by default), not as a dependency on a verb the path never exercises.** David rules. |
| **§4.1 — margin is read-only; `pricing_recipe:update` is the lever** | ✅ Matches this plan's §2 rows 12/14 exactly. **Adds** a UI constraint (the fix-a-flagged-price affordance routes to the recipe; no margin write may be implied) → **new card N-15** (§6) and a Phase 4 requirement. **Also surfaces F7** (§0). |
| **`audit_log:create` is system-only, never a user verb** | §2's new-strings table corrected: `audit_log:create` is **not a permission string at all**, so it needs no manifest entry — only the owner read does. Simplifies verifier assertion 2. |
| **`deliveries_route` → `deliveries.route`, a dotted sub-resource inheriting `deliveries:read`** | §2 row 5 renamed. **Introduces a THIRD dependency class — INHERITANCE** (beside structural Rule 1 and content Rule 2), and a manifest/verifier parse rule: **a `resource:verb` string splits on the LAST colon**, because resource names may now contain dots. Both are cheap, but neither existed in the plan and the verifier must implement them. |

### 🔴 FACTUAL CORRECTION — `manage_orders` is NOT theater

Both the CRUD matrix (§4: *"consulted by no RLS policy, no RPC, and no route … effectively
vestigial"*) and the 07-25 plan (*"today theater (gates nothing)"*) are **wrong**. `manage_orders` is
checked server-side at **four** call sites in `packages/cultivar-os/api/orders/submit.ts`:

| Line | Handler | What it gates | New string |
|---|---|---|---|
| `submit.ts:1005` | `handleUpdate` | edit an order (re-reserve inventory, recompute totals) → 403 without it | `orders:update` |
| `submit.ts:1292` | `handleStatus` | change order status → 403 without it | `orders:update` |
| `submit.ts:1223` | `handleDelete` | delete an order + children → 403 without it | `orders:delete` |
| `submit.ts:238` | `handleSubmit` | **price-tier invocation + per-service price overrides** — the discount path | **`order_discount:apply`** (§7) |

The grep that produced the "vestigial" claim searched RLS and routes, and `manage_orders` is enforced
in the **serverless API layer** — the third enforcement layer STD-020 names but the matrix's method
did not scan. **Consequence for this plan: `manage_orders` must NOT be retired; it splits into
`orders:update` + `orders:delete`, and its fourth call site is the ready-made wiring point for
`order_discount:apply` (§7).**

**VERDICT §1:** the 07-25 plan's **mechanism** (alias layer, expand/migrate/contract, ride the
consolidate-when-touched seam) survives intact and is the spine of this plan. Its **vocabulary**,
**verb set** and **scope** are superseded by the spec. Its **`manage_orders` finding is corrected**.

---

## §2 — THE COMPLETE LEGACY → resource:verb MAP (the alias table §8 depends on)

**19 entries: 18 permission strings + the `owner-only` route sentinel.** This is the exact content of
`permission_aliases`. Ignition's vocabulary (`view_hub`, `view_omni`, `view_flux`, `view_cipher`,
`view_port`, `view_kosk`, `view_crm`, `manage_users`, `manage_team` — `packages/shared/src/auth/permissions.ts`
+ frozen `packages/ignition-os/`) is **OUT OF SCOPE**: Ignition is donor-reference-only and is not
multi-tenant-RLS. The manifest is per-vertical.

| # | Legacy string | → resource:verb replacement(s) | Split | Fate | Enforcement today (evidence) |
|---|---|---|---|:--:|---|
| 1 | `view_dashboard` | **(none — fold into `is_active_member`)** | — | **RETIRE** (F3) | 4 tiles + 2 IA nodes, `tileRegistry.ts`; router.tsx:113 calls it the authenticated floor |
| 2 | `qr_checkout` | `orders:create` | 1:1 | rename | route `/orders*` (router.tsx:134); tile `qr_checkout`; ⚠️ **F1 ruling** |
| 3 | `view_orders` | `orders:read` **+** `order_items:read` **+** `order_service_selections:read` **+** `order_compliance_records:read` | **1→4** | split | 4 RLS SELECT policies, all checking `view_orders` (20260724:65,79,101,115) |
| 4 | `manage_orders` | `orders:update` **+** `orders:delete` | **1→2** | **KEEP (real)** | `submit.ts` 1005/1292 (update/status), 1223 (delete) — **not theater, see §1** |
| 5 | `manage_deliveries` | `deliveries:read` + `deliveries:update` **+** `deliveries.route:read` + `deliveries.route:update` *(v2: dotted sub-resource, inherits `deliveries:read`)* | **1→4** | split + **wire the table (N3)** | route only (router.tsx:141); `deliveries_member_all` is **membership-only** — the string is theater *at the data layer* |
| 6 | `manage_customers` | `customers:create` **+** `customers:update` | **1→2** | **MAKE REAL (N5)** | none — `UNWIRED_REGISTRY_PERMISSIONS`, hidden at #153. Closes David's open ruling #1 |
| 7 | `view_customers` | `customers:read` | 1:1 | rename | `customers_member` SELECT (20260710:36) + route (router.tsx:211) |
| 8 | `manage_campaigns` | `campaigns:read` + `campaigns:update` (+ `create`/`delete` OFF) | **1→2..4** | split + **wire the tables (N1/N2)** | route only (router.tsx:149); `campaigns`/`social_drafts` are **owner-only** → 🔓→🔒 |
| 9 | `manage_settings` | `settings:read` + `settings:update` **+** `team:read` + `team:update` **+** `pricing_recipe:update` *(the `/discounts` surface)* | **1→5** | split | routes `/settings`, `/admin`, `/team`, `/discounts` (router.tsx:161); 8 settings tiles + `qb_status` |
| 10 | `view_reports` | **(none)** | — | **RETIRE** | none — `UNWIRED_REGISTRY_PERMISSIONS`; one `status:'planned'`, `nav_eligible:false` tile. Closes David's open ruling #2 |
| 11 | `view_costs` | **`inventory:{read,create,update,delete}`** + **`costs:{read,create,update,delete}`** + **`inventory_ledger:read`** + *(F4: `assets:*`, `pmi:{read,update}`)* | **1→9 (+6)** | **THE BIG SPLIT** | 6 `*_member_all` FOR ALL policies (20260622:141-152 …): `business_inventory`, `cost_objects`/`_edges`/`_assignments`, `business_service_log`, `receipts`; routes `/inventory*`, `/receipts`, `/assets*`, `/operating-costs`, `/pmi`; 6 tiles |
| 12 | `view_pricing_config` | `pricing_recipe:read` + `pricing_recipe:update` | **1→2** | split, stays confidential | `business_pricing_config` member policy; the moat |
| 13 | `view_wages` | `wages:{read,create,update,delete}` | **1→4** | split, stays confidential | `labor_resources` / `labor_resource_wages` |
| 14 | `view_margin` | `margin:read` | 1:1 | rename | `applyFinancialDependencies` (financialPermissions.ts:81-85) — **Rule 2's existing implementation** |
| 15 | `override_maintenance` | `maintenance:override` | 1:1 | **rename; still unwired** — ⚠️ §7 | none. `UNWIRED_ACTION_PERMISSIONS` |
| 16 | `apply_tax_exempt` | `tax_exempt:apply` | 1:1 | rename (**already real**) | `submit.ts:298` via `callerCanApplyTaxExempt` — token-verified, tamper-defended |
| 17 | `apply_discount` | `order_discount:apply` | 1:1 | **MAKE REAL** — §7 | declared only; the discount path actually rides `manage_orders` at `submit.ts:238` |
| 18 | `import_pricing` | `inventory:import_price` (F3) | 1:1 | **KEEP** (capability verb) | `import_write_price` RPC (20260723:123) — real, server-enforced, 3 cards |
| 19 | `owner-only` *(route sentinel)* | **(not a permission)** | — | unchanged | `router.tsx:199`, 3 tiles. Resolved from `businesses.owner_id`, never from the array |

### New strings with NO legacy antecedent (they are gates that exist with no declared home)

These are **verifier assertion 2's first catch** — an enforced gate that no permission string names.
Each needs a manifest entry when its phase lands:

| New string | Enforced today by | Note |
|---|---|---|
| `service_offerings:read` | `service_offerings_member` SELECT, **membership** (20260724:52) | deliberate membership-only (map Note B) → becomes a named operational read |
| `service_offerings:{create,update}` | none (owner-only) | OFF by default (§5) |
| `inventory_ledger:read` | `*_member` FOR ALL, membership (20260720) | update/delete **structurally absent** (trigger rejects even `postgres`) |
| `tax_rate:read` | `get_business_tax_rate()`, **membership** (20260724:151) | re-gate the fn from membership → `tax_rate:read` |
| `tax_rate:update` | **nothing — does not exist** | needs a new narrow writer (§5) |
| `audit_log:read` | `audit_owner_read`, **owner-only** | never a grantable pill (spec §4) |
| ~~`audit_log:create`~~ | `audit_insert`, membership + self-actor | **v2: NOT a permission string.** System-only writer — audit rows land as a side effect inside the funnel/RPCs. No manifest entry; the policy is exempt from assertion 2 as a system writer |
| `team:read` | `rd_read` (membership) | write is funnel-only (#152) |
| `margin:read` | **nothing server-side** — client-only `applyFinancialDependencies` | ⚠️ **F7** — `status: derived`, enforced transitively via `costs:read`. Rule 2's dependency is already implemented; the *gate* is not |

**VERDICT §2:** the map is **complete and exact** — 19 legacy entries, all accounted for; 2 retired
(`view_dashboard`, `view_reports`), 1 corrected from "retire" to "keep" (`manage_orders`), 9 new
strings named for gates that exist without one. **Three cells are ruling-dependent: row 2 (F1), row 11's
F4 extension, and every `delete` verb (F2).**

---

## §3 — THE PHASES (demo spine first; alias layer first of all)

**Ordering principle:** the alias layer (Phase 0) lands first so every later phase is order-independent
and reversible. Then the **DEMO SPINE** — what LAWNS actually touches — in Phases 1–3, on the
consolidate-when-touched seam. Everything not on the demo path follows.

Every phase is **one reversible commit set** and updates, in the same commit: the manifest, the
enforcement map row (its own close-out gate), and its owner-test cards.

### PHASE 0 — EXPAND: the manifest + the alias layer 🔴 *blocked on antigravity §8*
- **Ship:** `packages/shared/src/auth/permissionManifest.ts` — ONE source: every `resource:verb`, its
  `status` (`enforced`/`declared-unwired`, F6), its `sensitivity` (operational/confidential/owner-only),
  and the §6 dependency graph. **Retires and absorbs** `financialPermissions.ts`, `actionPermissions.ts`,
  `UNWIRED_ACTION_PERMISSIONS`, `UNWIRED_REGISTRY_PERMISSIONS`, and `roles.ts` `PERMISSIONS` (STD-011:
  five representations → one).
- **Ship:** migration — `permission_aliases(from_perm, implies_perm)` + `has_permission` /
  `has_permission_for` upgraded to resolve implications **both directions**, seeded from §2.
- **Ship:** the verifier in **WARN** mode (§4).
- **Proof of neutrality:** every existing check passes identically; a `view_costs` holder still passes
  `has_permission('view_costs')` AND now passes `has_permission('inventory:read')`.
- **Gate to Phase 1:** verifier WARN output reviewed and matches the predicted list (§4); alias
  round-trip proven both directions (DAVID-QUERY); `npm run verify` zero net-new; **antigravity §8 answered.**

### PHASE 1 — DEMO SPINE A: the order family + the netting path + service_offerings + tax_rate
*The checkout David demos. Six of the ten #153 cards live here.*
- `view_orders` → the four order-read strings; `qr_checkout` → `orders:create` (**pending F1**);
  `manage_orders` → `orders:update`/`orders:delete` at the four `submit.ts` sites.
- `service_offerings:read` gets a named string (currently membership-only) — the **netting/add-on
  path** (`order_compliance_records`, the Regina anchor).
- `tax_rate:read` re-gates `get_business_tax_rate`; **NEW `set_business_tax_rate`** narrow writer
  gated on `tax_rate:update` (§5) — the demo-critical tax write.
- **Gate to Phase 2:** the six affected `manager-visibility` cards re-written and **owner-proven** by
  David (a manager takes a taxed order end-to-end); enforcement map rows updated; F1 ruled.

### PHASE 2 — DEMO SPINE B: customers (incl. the N5 write) + deliveries
- `view_customers` → `customers:read`; **`manage_customers` → `customers:create` + `customers:update`
  with a real member WRITE policy** — this is **N5**, David's open ruling #1, and Lauren's actual job.
- `deliveries` / `deliveries_route`: split the route-only string into real table gates (**N3**).
- `customers:delete` / `deliveries:delete`: **not minted** pending F2.
- **Gate to Phase 3:** Lauren-shaped proof — a manager adds a customer, fixes a typo, schedules a
  delivery; the staff negative holds.

### PHASE 3 — DEMO SPINE C: inventory (vocabulary), then the cost split
**Deliberately two sub-phases — the riskiest work is separated from the demo path.**
- **3a (vocabulary only, low risk):** `view_costs` → `inventory:{read,create,update,delete}` +
  `costs:{read,create,update,delete}` + `inventory_ledger:read` as a **string swap** on the existing
  `FOR ALL` policies, split by SQL command. `import_pricing` → `inventory:import_price`. **A read-only
  inventory viewer becomes expressible for the first time.**
- **3b (field-level split, high risk — §5):** `unit_cost` moves behind `costs:read` via a
  SECURITY DEFINER projection, **and the base-table member SELECT narrows** (without that, the split
  is cosmetic — see §5). Every direct reader of `business_inventory` is repointed.
- **Gate to Phase 4:** 3a — the inventory board's import cards (16/17/18) re-proven under the new
  string. 3b — the read-split card proves a manager sees sell price and **not** unit cost, *and* that
  the same manager cannot reach `unit_cost` by querying the table directly.

### PHASE 4 — OFF-SPINE: settings/team split, campaigns, assets/PMI
- `manage_settings` → the 5-way split (§2 row 9).
- `campaigns`/`social_drafts` member policies (**N1/N2** — the two remaining 🔓→🔒 gaps).
- `assets` / `pmi` resources per **F4**; resolves **N4**.
- **Gate to Phase 5:** all six N1–N6 disagreements closed or explicitly re-recorded; enforcement map
  shows zero unexamined rows.

### PHASE 5 — THE AUTHORITY ACTS (§7)
- `order_discount:apply` made real (re-point `submit.ts:238`) + audit row.
- `maintenance:override` — **ruling-dependent** (§7): there is no block to override today.
- `tax_exempt:apply` — rename only; already real and audited.
- **Gate to Phase 6:** each act gates its feature AND writes an `audit_log` row naming the actor,
  owner-proven.

### PHASE 6 — BACKFILL
Re-materialize every member's array to the new vocabulary **through the funnel**
(`save_role_permissions` — atomic, audited, per-tenant, resumable, WIPE-not-merge). A tenant
mid-backfill stays fully functional (alias). **Per-tenant exit:** zero members hold a legacy string
(DAVID-QUERY).

### PHASE 7 — CONTRACT + the verifier flips to FAIL
Gated behind two zero-checks across all tenants: no member holds a legacy string; no gate references
one. Then drop the aliases, drop the retired strings, and **flip the verifier to FAIL** so the model
cannot drift back. **Irreversible — the only such step.**

**VERDICT §3:** eight phases, each independently shippable and reversible until Phase 7. The demo
spine (orders + netting + tax, customers + deliveries, inventory) is **Phases 1–3**, ahead of
everything off the demo path — per David's ruling that the demo runs on migrated surfaces.
**Phases 1–3a are the pre-LAWNS scope; 3b is the judgment call** (it is the largest single piece and
it touches every inventory read).

---

## §4 — THE VERIFIER (spec §7) AS A CONCRETE verify-universals CAP

**Artifact:** one new capability `capP` in `scripts/verify-universals.mjs`, alongside the existing 12.
**Source-based** (F5): reads `permissionManifest.ts`, `concatSql(supabase/migrations)`, `router.tsx`,
`tileRegistry.ts`, and — the method fix that would have caught the `manage_orders` error —
**`packages/cultivar-os/api/**/*.ts`** (the third enforcement layer STD-020 names and no prior scan read).

| # | Assertion (spec §7) | How capP decides it, from source |
|---|---|---|
| 1 | No fake pills | every manifest entry with `status:'enforced'` matches a policy in the SQL, an RPC `has_permission*` call, or an api-layer `callerHoldsPermission` call. `declared-unwired` entries must be absent from the Roles catalog (F6). |
| 2 | No orphan gates | every `has_permission(…,'X')` in SQL/RPC/api resolves to a manifest entry. **Catches `service_offerings`, `inventory_ledger`, `tax_rate`, `audit_log` — gates with no declared home.** |
| 3 | Route == table (STD-020) | for each capability, `PermissionRoute permission=` / `required_permission` == the string on its table policy — **except an explicit `ALLOWED_DIVERGENCE` list, each entry carrying its recorded reason** (see below). |
| 4 | Dependencies (§6) | every role definition (the SQL floor + the manifest defaults) satisfies **all three classes**: structural (Rule 1 write→read), content (Rule 2 margin→costs), and **inheritance** (v2: `deliveries.route:*` → `deliveries:read`). **Parse rule: split a permission string on the LAST colon** — resource names may contain dots. |
| 5 | Verb/command agreement | no `:read` string appears in an INSERT/UPDATE/DELETE policy or a write RPC; no string grants a verb the manifest marks absent. |
| 6 | Confidential warning | every `sensitivity:'confidential'` entry is covered by the Roles-page hard-warning branch (asserted against `MemberConsole.tsx`, the way capF asserts the funnel). |

**`ALLOWED_DIVERGENCE` is required, not optional.** Assertion 3 would otherwise fail forever on two
*deliberate* designs: `/orders` route (`qr_checkout`) vs table (`view_orders`) — map Note A, pending
F1 — and `/costs` route (`owner-only`) vs table (`view_costs`) — the deliberate moat, D-009. **A
divergence list with reasons is the mechanism that makes "recorded, not hidden" enforceable.**

### What capP will flag on its FIRST run (WARN mode) — the expected output

If this list is not what appears, the verifier is wrong, not the repo. **Predicted 16 warnings:**

1. `view_costs` is coarse — one string, 6 `FOR ALL` policies, 4 routes (assertion 5).
2–7. **N1** social_drafts · **N2** campaigns · **N3** deliveries · **N4** PMI · **N5** customer write ·
   **N6** anon residual — the six recorded disagreements (assertion 3).
8. `service_offerings_member` — enforced gate, no manifest string (assertion 2).
9. `inventory_ledger` member policy — same (assertion 2).
10. `get_business_tax_rate` — membership-gated fn, no string (assertion 2).
11. `audit_log` insert/read — enforced, no declared string (assertion 2).
12. `manage_orders` — enforced at 4 api sites, **zero** RLS/route presence (assertion 1's api-layer half).
13. `apply_discount` — declared, enforced by nothing (assertion 1) → `UNWIRED`.
14. `override_maintenance` — declared, enforced by nothing (assertion 1) → `UNWIRED`.
15. `view_dashboard` / `view_reports` — declared, no resource (F3, assertion 1).
16. **`view_margin` / `margin:read` — declared and confidential, enforced by NO policy or RPC**
    (client-only). **F7** → resolves to `status: derived`, not to a new gate.

**Gate to flip WARN → FAIL (Phase 7):** all 16 closed or moved to `ALLOWED_DIVERGENCE`/`declared-unwired`
with a recorded reason, **and** zero members hold a legacy string. This is the mechanical guard the
enforcement map explicitly named-but-did-not-build (`permission-enforcement-map.md`, close-out gate:
*"NOT built this pass … the mechanical enforcement after LAWNS"*).

**VERDICT §4:** capP is buildable source-only, ships in Phase 0 as WARN, and flips to FAIL in Phase 7.
Its first-run output is **predicted above** — that prediction is itself the acceptance test.

---

## §5 — THE FIELD-LEVEL PROJECTIONS (spec §4)

### The constraint that decides the design

**Postgres RLS is row-level, not column-level, and per-member column visibility cannot be done with
column GRANTs** — every signed-in member shares the single `authenticated` role, so a
`GRANT SELECT (col…)` cannot vary by who is asking. Therefore the split **must** be a
`SECURITY DEFINER` projection, and — the load-bearing half — **the base table's member SELECT must be
narrowed at the same time.** If `inventory:read` still grants direct `SELECT *` on
`business_inventory`, a manager reads `unit_cost` with one supabase-js call and the split is
**cosmetic**. This is the real cost of spec §4 and it is why Phase 3b is separated from 3a.

### The three functions

| Function | Gate | Returns | Withholds | Status |
|---|---|---|---|---|
| **`list_business_inventory(p_business_id, …)`** *(NEW)* | `inventory:read` | `id, business_id, name, sku, size, variant_group, qty, sell_price, status, created_at, updated_at` | **`unit_cost`, `cost_confidence` → NULL unless the caller also holds `costs:read`** | to build (Phase 3b) |
| **`get_business_tax_rate(p_business_id)`** | `membership` → **re-gate to `tax_rate:read`** | `config->>'taxRate'` **only** | the entire pricing recipe | **exists** (20260724:138-158), applied + verified live 2026-07-24 |
| **`set_business_tax_rate(p_business_id, p_rate, p_actor)`** *(NEW)* | `tax_rate:update` | writes **only** `config->'taxRate'` via `jsonb_set` | must not touch `baselineMargin`, `referencePrice`, `markup`, `discountTypes` | to build (Phase 1) |

Design notes, all inherited from proven patterns:
- All three: `SECURITY DEFINER`, `SET search_path = ''`, `REVOKE ALL … FROM public`,
  `GRANT EXECUTE … TO authenticated` — the shape `get_business_tax_rate` already proves.
- `set_business_tax_rate` authorizes the **PASSED actor**, never `auth.uid()` (the D-50 scar, per
  `assert_movement_actor`), and writes an `audit_log` row. A tax-rate change is a money fact.
- The pricing recipe itself stays behind `pricing_recipe:read` on `business_pricing_config`
  (`view_pricing_config` today) — **unchanged; card 10 stays the negative proof.**

### The Phase-3b blast radius (stated honestly, not minimized)
Narrowing the base-table SELECT repoints **every direct reader of `business_inventory`**: the
inventory grid, count/walk, reconcile, import, the checkout picker, dashboard metrics, and the cost
surfaces. That is the largest client change in this plan.

> **RECOMMENDATION:** ship **3a before LAWNS, 3b after** — unless David wants the cost wall demoed.
> 3a already delivers the read-only-viewer capability and the honest vocabulary; 3b delivers
> field-level confidentiality, which no LAWNS demo scenario exercises. **David rules.**
> *Alternative considered and not recommended:* relocate `unit_cost` to a `costs:read`-gated table so
> RLS does the work with no projection function. Cleaner gates, but a data migration plus the same
> client rewrite — worse on both axes.

**VERDICT §5:** two new functions + one re-gate. The **base-table narrowing is mandatory**, or the
split does not exist. This is the plan's largest single risk and it is isolated in Phase 3b.

---

## §6 — THE CARD REBUILD (spec §9) — ✅ **FINAL LIST, R7, against David's rulings** — for approval before Phase 0

**Rule followed:** the old cards are **not edited** — the string mapping changed enough that editing
carries stale assumptions forward. Cards are **RETIRED**, **RE-WRITTEN** (same behavior, new string,
`LAST-PROVEN: never`), **SURVIVE** (vocabulary-agnostic), or **NEW**.
**Per OP-14: every card below ships `STATUS: owed`. Thunder never marks a card `covered`.**

Today: **20 permission-relevant cards** across three boards (`team-permissions` 1–7,
`manager-visibility` 1–10, `inventory` 16/17/18).

### SURVIVE UNCHANGED — 6 cards (they test the FUNNEL and the audit, which do not change)
`team-permissions` **1** (grant → member row changes) · **2** (every grant/revoke writes audit) ·
**3** (a removal names who loses what) · **4** (owner row lit + locked) · **5** (screen count == array
length) · **7** (self-elevation denied + audited).

### RE-WRITTEN — 12 cards / 11 rows (behavior survives, string changes, `LAST-PROVEN` reset)
*(the `inventory 16/17` row below is two cards, not one)*
| Old | New string | Card |
|---|---|---|
| mgr-vis 1 | `orders:read` | a MANAGER sees the orders they took — roster count non-zero |
| mgr-vis 2 | `orders:create` / `orders:read` | (NEG) 🔴 **the Note A card, PRESERVED under R1:** a STAFF member holding `orders:create` but NOT `orders:read` takes an order successfully **and still sees nothing on `/orders`** |
| mgr-vis 3 | `order_items:read` | committed count matches the owner's (132 units COMMITTED, not available) |
| mgr-vis 4 | `service_offerings:read` | a MANAGER sees add-ons, picks transport, sets a delivery date |
| mgr-vis 5 | `tax_rate:read` | a MANAGER's order applies tax at the tenant's real rate |
| mgr-vis 6 | `tax_rate:read` | (NEG) a non-member gets NO rate from the narrow read |
| mgr-vis 7 | `customers:read` | a MANAGER reaches `/customers` and sees the roster |
| mgr-vis 8 | `customers:read` | (NEG) a member without it cannot reach `/customers` |
| mgr-vis 10 | `pricing_recipe:read` | (NEG) 🔴 the pricing RECIPE is still walled from a manager |
| inventory 16/17 | `inventory:import_price` | manager without it imports quantities; the SERVER refuses the price write |
| inventory 18 | `inventory:import_price` | owner grants it on `/team`; the same file's prices land |

### RETIRED — 2 cards *(finalized under R1 — one fewer than the provisional list)*
- `team-permissions` **6** ("the two fake pills no longer render") — the retired set changes shape
  entirely (`view_dashboard`, `view_reports` retired; `manage_orders` **kept**, corrected). Replaced by
  NEW-3.
- `manager-visibility` **9** ("pill count == lit pills") — the Roles page is re-rendered **from the
  manifest**; the assertion is replaced by NEW-4 (a stronger claim).
- ✅ **`manager-visibility` 2 is NOT retired.** Under **R1 (option c)** the create-without-read split
  survives, so the negative card that proves it survives with it — re-written above against
  `orders:create` / `orders:read`. **This was the one card whose fate F1 decided.**

### NEW — 24 cards *(final, against the rulings)*
| # | Card | Covers |
|---|---|---|
| N-1 | 🔴 A role holding `orders:update` **without** `orders:read` FAILS THE BUILD, naming the missing string | Rule 1 (**modify**-requires-read) |
| **N-1b** | 🔴 **THE INVERSE — the rule must not over-reach (R1).** A role holding `orders:create` **without** `orders:read` **BUILDS FINE** — no error, no warning-as-error | R1 option (c) |
| **N-1c** | **A create-without-read grant is surfaced on the Roles page as a DELIBERATE CHOICE** — an inline note naming the state ("takes orders, cannot browse them"), not a silent asymmetry | R1 UI requirement |
| N-2 | 🔴 A role holding `margin:read` **without** `costs:read` FAILS THE BUILD | Rule 2 |
| **N-2b** | 🔴 A role holding `deliveries.route:update` **without** `deliveries:read` FAILS THE BUILD | Rule 3 (inheritance) |
| N-3 | Only manifest-`enforced` strings render as pills; `declared-unwired` and `derived` are handled per §7.1 | spec §7.1 |
| N-4 | The Roles page renders **from the manifest** — a string added to the manifest appears with no UI edit | spec §7 end-state |
| N-5 | 🔴 Granting a **confidential** permission shows the hard, specific warning ("this exposes your cost data to this person"), not the generic confirm | spec §4 |
| N-6 | 🔴 **The inventory read split:** a manager with `inventory:read` but not `costs:read` sees sell price and **NOT** unit cost | spec §4 |
| N-7 | 🔴 **…and cannot reach `unit_cost` by querying `business_inventory` directly** (the base-table narrowing — without this, N-6 is cosmetic) | §5 |
| N-8 | **A read-only inventory viewer:** `inventory:read` without `inventory:update` opens the grid, cannot edit or delete a lot | *impossible to express today* |
| N-9 | 🔴 **N5 — the customer write:** a manager with `customers:update` fixes a typo and it saves; without it, read-only | David's open ruling #1 |
| N-10 | 🔴 **`tax_rate:update` saves** through the narrow writer — and the pricing recipe is unchanged after | §5 / demo-critical |
| N-11 | 🔴 **`order_discount:apply`** gates the price override AND writes an `audit_log` row naming the actor | §7 / R8 |
| **N-11b** | **A STAFF member with `orders:create` but WITHOUT `order_discount:apply` takes an order at the BASELINE price** — the override is ignored and the tamper-defence trace fires (proves R8's dependency is the right one) | R8 |
| N-12 | ~~`maintenance:override` gates its feature AND writes an audit row~~ → ships **`STATUS: needs-test`**, reason: *"nothing in the app blocks on overdue PMI, so there is no feature to override (R6). Card becomes writable when the PMI block is built."* | R6 — **honest hole, recorded** |
| **N-12b** | 🔴 **THE UNMINTABLE DELETES (R2): `customers:delete` exists NOWHERE** — not as a pill on the Roles page, not as a policy, not as a string any gate accepts. Same for `service_offerings:delete`, `deliveries:delete`, `campaigns:delete` | R2 / verifier assertion 5 |
| **N-12c** | **`inventory:delete` DOES exist and it TOMBSTONES** — the lot survives at `status='deleted'`, qty 0, with both a ledger row and an audit row (the contrast that makes N-12b meaningful) | R2 / D-52 |
| N-13 | **The alias proof:** a member holding ONLY legacy strings passes a new-string check, and the reverse | §8 / Phase 0 |
| N-14 | **Contract:** zero members hold a legacy string; the build FAILS if a route and its table disagree | Phase 7 |
| **N-15** | ***(NEW, spec v2 §4.1)* No surface implies a margin WRITE.** A holder of `margin:read` sees the R/Y/G verdict; the "fix this price" affordance routes to the **recipe**, and no `margin:update` pill exists anywhere on the Roles page | v2 §4.1 |
| **N-16** | ***(spec §4.1)* The flag-but-can't-fix state is real and deliberate:** a member with `margin:read` + `costs:read` but WITHOUT `pricing_recipe:update` can see which items are underpriced and **cannot change them** | spec §4.1 |
| **N-17** | ***(R4)* `assets` and `pmi` are reachable on their OWN strings** — a member with `assets:read`/`pmi:read` but WITHOUT `costs:read` opens both surfaces (closes N4, where the route was `view_costs`-stricter than the table) | R4 |
| **N-18** | ***(R3)* `view_dashboard` is gone and nothing broke** — every tile and IA node that keyed on it renders for any active member | R3 |

**Net: 20 today → 42 cards.**

**Board arithmetic, both directions (it must reconcile — OP-14):**
- **Disposition of today's 20:** 6 survive + 12 re-written + 2 retired = **20** ✅
- **Resulting board:** (20 − 2 retired) = 18 carried **+ 24 new** = **42** ✅

Every card maps to exactly one `resource:verb` behavior. **All ship `STATUS: owed`** except **N-12,
which ships `needs-test` with R6 as its stated reason** — an honest hole, recorded rather than
omitted (OP-14 clause 2). Board proven-count on day one is therefore **0 of 42**; the 5 previously
`covered` cards on these boards are among the re-written, so their `LAST-PROVEN` resets (OP-14
clause 3 — a green check on a moved surface asserts a proof nobody performed).

**VERDICT §6:** ✅ **R7 SATISFIED — this is the final list, ruled.** F1's resolution changed exactly
one card's fate (mgr-vis 2 **survives**, it does not retire) and added three (N-1b, N-1c, N-11b);
R2 added two (N-12b, N-12c); R3/R4 added two (N-17, N-18); R6 converted N-12 to `needs-test`.
**Awaiting David's approval of this list before Phase 0 begins.** Thunder never marks a card
`covered` — only David's live run does.

---

## §7 — THE TWO AUTHORITY ACTS: what they gate today vs what they must gate

### `order_discount:apply` (was `apply_discount`) — **REAL IN ONE COMMIT**

**Today:** the string is declared and enforced by **nothing** (`UNWIRED_ACTION_PERMISSIONS`). But the
capability it names **is gated** — by the wrong string. `submit.ts:236-239`:

```
if (invokedTierName || hasOverrides) {
  callerManages = await callerCanManageOrders(authHeader, businessId);   // ← manage_orders
  if (callerManages) overrideBy = await resolveCallerUid(authHeader);
}
```

`invokedTierName` (a customer price tier) and `serviceOverrides` (per-service price overrides) **are
the discount**. The gate is real, token-resolved (never from the body), and already resolves the
actor's uid into `overrideBy`. It simply checks `manage_orders` instead of the discount string.

**The wiring (small, and the pattern already exists):**
1. Add `callerCanApplyDiscount()` — an exact mirror of `callerCanApplyTaxExempt` (owner OR the string).
2. Re-point line 238 to it. Order *edit/status/delete* keep `orders:update`/`orders:delete`.
3. **Add the `audit_log` row** — `order.discount_applied`, naming actor, order, baseline, override
   and leakage.
4. Remove from the unwired list **in the same commit** (the rule the list's own doc states).

> **CORRECTION to this plan's first pass:** I wrote that *"the leakage signal the spec asks for does
> not exist yet."* That is too strong. The leakage record **does** exist, durably and attributed:
> `submit.ts:562` writes `is_manual_override`, `original_price`, `price_leakage`, `override_by`,
> `override_reason` onto each `order_service_selections` row, and `submit.ts:496-509` enforces
> **STD-013 server-side** — a reasonless override is REFUSED and the baseline charged (refusal costs
> the customer more, never gives money away unrecorded). What is missing is only the **`audit_log`
> spine row**, so the override is visible on the order but not in the governance log. Step 3 above is
> the whole gap.

### 🔴 ANSWERING v2 §6's EXPLICIT ASK — which verb carries the price change?

v2 corrects the dependency to `orders:update` and asks: *"Confirm the actual checkout-write verb in
code … if the checkout path writes the discount through a create-then-price sequence, the dependency
must point at whichever verb carries the price change, not at the row insert."*

**Confirmed in code, and it is neither case.** The discount is carried **by the INSERT itself**:

- `invokedTier` and `serviceOverrides` are read, gated, priced and written **entirely inside
  `handleSubmit`** (`submit.ts` 196→562). There is no later write.
- **`handleUpdate` accepts no tier and no overrides at all.** It recomputes totals from the *stored*
  `sell_price` and the *stored* tier (`submit.ts:1041,1097`). You cannot discount an order by editing it.
- So there is no create-then-price sequence and no update step. One insert carries the price.

**Therefore v2's `orders:update` prerequisite does not describe the mechanism.** Its *intent* is
sound — discounting should be a manager act, not a seasonal-staff act. But the two are separable:

> **RECOMMENDATION:** keep the mechanical dependency at **`order_discount:apply → orders:create`**
> (the verb the path actually exercises), and express "discounting is a manager act" where it
> belongs — **the default bundle, where `order_discount:apply` is already OFF by default (§5).** A
> declared dependency on a verb the code path never touches is precisely the "declared but rides
> another gate" trap this spec exists to end; it would also mean a holder is granted `orders:update`
> (and, via Rule 1, `orders:read`) purely to satisfy a paper prerequisite — a **silent widening of
> access to satisfy a dependency**, which is the opposite of what Rule 1 is for.
>
> **If David prefers v2's force:** declare BOTH (`orders:create` mechanical + `orders:update` policy)
> as a new **policy** dependency class, explicitly labelled as not-exercised-by-the-path. That keeps
> the honesty and the force. **David rules — this is R8.**

### `maintenance:override` (was `override_maintenance`) — 🔴 **CANNOT BE MADE REAL BY WIRING**

**Today:** declared, in `UNWIRED_ACTION_PERMISSIONS`, its own doc says *"the mechanism … is NOT built
yet."* Verified: `pmiInterval.ts` computes `getPMIStatus` (overdue / due-soon / ok) and **nothing in
`packages/cultivar-os/src` blocks on an overdue PMI status** — grep for a blocking consumer returns
nothing.

**An override permission with nothing to override is not a permission — it is a name.** Spec §5 asks
for *"authorize a truck to deliver with overdue maintenance — audited as liability."* That requires,
in order: (1) a **block** — delivery scheduling refuses an asset whose PMI is overdue; (2) an
**override path** — a reason-required action gated on `maintenance:override`; (3) the **audit row**.
Steps 1–2 are a **PMI/delivery feature build**, not RBAC wiring, and PMI has no resource in the spec
catalog at all (**F4**).

> **RULING OWED (David):** (a) build the PMI block + override as part of this program (real scope: a
> feature, one new gated write path, plus F4's `pmi` resource), or (b) rename it to
> `maintenance:override` and keep it **`declared-unwired`/hidden** until the block exists.
> **My recommendation: (b).** It is off the demo spine, it is honest, and the manifest's
> `declared-unwired` status (F6) makes "named but not enforced" a first-class, visible state rather
> than a fake pill. Shipping the permission before the block would be exactly the theater the spec is
> written to end.

**VERDICT §7:** `order_discount:apply` becomes **genuinely real** in Phase 5 — the gate already exists
at `submit.ts:238` and needs a string change plus the missing audit row. `maintenance:override`
**cannot**, because the feature it would gate does not exist; it ships `declared-unwired` pending
David's ruling. **Stated, not overstated — the spec's "made real, not theater" is achievable for one
of the two acts.**

---

## §8 — ✅ RESOLVED: antigravity confirmed the alias layer

**Spec v2 review status: *"antigravity confirmed §8's alias layer CLOSES the migration-ordering /
dual-write window it had flagged; its earlier concern was raised without the alias in view.
Migration gate: cleared."*** The alias layer is the reason every phase above is order-independent and
reversible, and it now proceeds as designed.

### CONFIRMED BRANCH — the plan proceeds exactly as written
Phase 0 ships `permission_aliases` + the both-directions resolver; Phases 1–5 flip gates in any
order; Phase 6 backfills tenant-by-tenant over days; Phase 7 contracts behind the two zero-checks.

**One implementation note that still applies, and is now a Phase 0 build requirement:** `has_permission` is `LANGUAGE sql STABLE` and is
called **per row** inside RLS `USING` clauses. Replacing a `jsonb ? p_perm` containment test with an
alias join multiplies that cost across every filtered read. **Mitigation to build in from the start:**
resolve the alias set as an array expansion (`permissions ?| resolved_set`) rather than a correlated
subquery per row, keep the function `STABLE` and inlinable, and index `permission_aliases(from_perm)`.
A measurable regression on the inventory grid (thousands of rows) is the failure mode to watch.

### ~~IF antigravity FINDS A RESIDUAL WINDOW — the fallback~~ *(SUPERSEDED — retained as a record)*
**Not taken.** Kept because it is the contingency if the alias layer misbehaves in Phase 0 practice
(a perf regression, or an implementation defect found under load). It trades order-independence for a
**narrower blast radius** and requires no re-planning:

1. **Per-capability atomic cutover.** Instead of relying on the alias to decouple the two writes, each
   phase does **one capability** in **one transaction**: re-materialize the affected members' arrays
   (through the funnel — already atomic + audited) **and** flip that capability's policies in the same
   migration. The window shrinks from "the whole migration" to "one statement inside one transaction,"
   which Postgres closes for us. Cost: the ordering freedom is gone — phases must run in the stated
   sequence, and each is a single deploy rather than a rollout.
2. **Belt-and-braces for whatever residue antigravity names.** During each cutover, the flipped policy
   accepts **either** string (`has_permission(biz,'inventory:read') OR has_permission(biz,'view_costs')`)
   written **literally in the policy**, not via the alias table. Cruder and more verbose, but it has no
   moving parts and no shared resolver to reason about — the residual window antigravity identifies
   cannot exist in a disjunction evaluated inline. The literals are removed at Phase 7 CONTRACT.
3. **Single-tenant reality check.** There is exactly one live tenant (LAWNS, `f7ec5d67`) with a handful
   of members. If antigravity's residual window is narrow and the exposure is bounded, a **scheduled
   maintenance cutover** — announced, minutes long, with a proven rollback — is a legitimate and much
   simpler answer than either mechanism. **This option only exists before the first paying customer;
   it should be taken now if it is available at all.**

**What did NOT depend on the answer either way:** the manifest (§2), the phase content and ordering
(§3), the verifier (§4), the projections (§5), the cards (§6), and the authority acts (§7).
Antigravity's answer changed the migration **MECHANISM**, not the target model — by design, which is
why §8 was the only gated item.

**VERDICT §8:** ✅ **CLEARED.** The alias layer is confirmed and lands first, in Phase 0. The
per-row `has_permission` cost is now a **Phase 0 build requirement**, not just a note. The fallback
is retained as a contingency, not a branch.

---

## SEQUENCE — the ordered phase list and each phase's exit gate

| # | Phase | Demo spine? | Exit gate (must pass before the next phase starts) |
|---|---|:--:|---|
| **0** | **EXPAND** — manifest + alias layer + verifier in WARN | infra | ✅ antigravity §8 **cleared** · ✅ R1–R9 **ruled** · 🔴 **David approves the §6 card list** · alias round-trip proven both directions (DAVID-QUERY) · **no measurable regression on the inventory grid** from the per-row alias resolution (§8) · capP WARN output matches the **16** predicted flags (§4) · `npm run verify` zero net-new |
| **1** | **ORDERS + NETTING + service_offerings + tax_rate** | ✅ **YES** | 6 re-written `manager-visibility` cards + N-10 **owner-proven** by David (a manager takes a taxed order end-to-end, netting recorded) · enforcement map rows updated · `set_business_tax_rate` catalog-verified |
| **2** | **CUSTOMERS (incl. N5 write) + DELIVERIES** | ✅ **YES** | N-9 owner-proven (a manager fixes a customer typo; without the string, read-only) · N3 closed · mgr-vis 7/8 re-proven |
| **3a** | **INVENTORY — vocabulary swap** (+ `inventory:import_price`) | ✅ **YES** | N-8 owner-proven (read-only viewer — the capability that did not exist) · inventory cards 16/17/18 re-proven under the new string |
| **3b** | **INVENTORY — the field-level cost split** (§5) | ⚠️ judgment | **N-6 AND N-7 both owner-proven** — the manager sees sell price, not unit cost, **and cannot reach it by direct query.** N-7 alone is the real gate; N-6 without N-7 is cosmetic |
| **4** | **SETTINGS/TEAM split · CAMPAIGNS (N1/N2) · ASSETS/PMI (F4)** | no | all six N1–N6 closed or explicitly re-recorded · enforcement map has **zero unexamined rows** |
| **5** | **AUTHORITY ACTS** (§7) | no | N-11 owner-proven (discount gated **and** audited) · N-12 either proven or `needs-test` with David's F7 ruling recorded |
| **6** | **BACKFILL** — funnel-driven, per tenant | no | per tenant: **zero members hold a legacy string** (DAVID-QUERY) · every rewrite carries its audit row |
| **7** | **CONTRACT + verifier → FAIL** 🔴 irreversible | no | two zero-checks across ALL tenants (no member holds a legacy string; no gate references one) · N-13/N-14 proven · **capP flips WARN → FAIL and the build stays green** |

**Pre-LAWNS scope recommendation: Phases 0 → 3a.** That delivers the honest vocabulary, real CRUD
verbs, the customer write Lauren needs, the order/tax/netting spine, and a read-only inventory viewer
— on migrated, standard-compliant surfaces, as David ruled. **Phase 3b and everything after is the
post-demo half**, with 3b's timing being David's call (§5).

---

## BLOCKED — the DAVID-QUERIES this plan cannot answer itself

1. **The live member arrays** (converts the REQUIRES map into a CAN-DO map, and sizes the backfill):
   `SELECT role, permissions FROM business_members WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' ORDER BY role;`
2. **Confirm the six N1–N6 disagreements are still live** (no policy added since #153):
   `SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('social_drafts','campaigns','deliveries','business_pmi_schedule') ORDER BY 1,2;`
3. **Confirm F2** — no soft-delete column on the four tables:
   `SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('customers','service_offerings','deliveries','campaigns') AND column_name IN ('deleted_at','is_deleted','status','archived_at');`

---

## RULINGS — ✅ ALL RULED (David, 2026-07-26). Folded into spec v3.

| # | Ruling | David's call | Where it landed |
|---|---|---|---|
| **R1** | **F1** — the create-not-read split | ✅ **Option (c)** — Rule 1 becomes **MODIFY-requires-read**; `create` never requires read. Note A + card 2 **stay**. Roles page surfaces a create-without-read grant as deliberate | spec v3 §2, §5 STAFF, §6 Class 1; cards mgr-vis 2, N-1b, N-1c |
| **R2** | **F2** — the four phantom soft-deletes | ✅ **Option (c) ×4** — no delete verb minted until a tombstone exists. `customers:delete` = future scoped build, gated on the FK-cascade query. `campaigns:delete` likely never | spec v3 §3 (four dashes), §5 "not mintable"; cards N-12b, N-12c |
| **R3** | **F3** — `import_pricing`, `view_dashboard` | ✅ **Default** — `inventory:import_price` kept; `view_dashboard` folds into membership and retires | spec v3 §3, §5; card N-18 |
| **R4** | **F4** — `assets`, `pmi` | ✅ **Default** — both added as operational resources | spec v3 §3, §4, §5; card N-17 |
| **R5** | **§5** — 3b timing | ✅ **Default** — the field-level cost split ships **after LAWNS** | SEQUENCE (Phase 3b) |
| **R6** | **§7** — `maintenance:override` | ✅ **Default** — stays `declared-unwired`, hidden until the PMI block exists | spec v3 §3, §7.1; card N-12 → `needs-test` |
| **R7** | **§6** — the card list | ✅ **Unblocked by R1; final list produced** — 42 cards | §6 above — **awaiting David's approval before Phase 0** |
| **R8** | **§7** — the discount dependency | ✅ **Accepted** — stays `orders:create`; **code beat paper** | spec v3 §6 Class 2; card N-11b |
| **R9** | **F7** — `margin:read` has no gate | ✅ **Accepted** — manifest `status: derived` | spec v3 §7.1 |

**Nothing is open.** The only item still owed is **David's approval of the §6 card list** — the last
gate before Phase 0 starts.

---

*PLAN ONLY — nothing built. Companions: `docs/resource-action-permission-spec.md` (the target),
`docs/standards/permission-enforcement-map.md` (STD-020, the reconciliation),
`docs/decisions/2026-07-25-manager-crud-matrix-recon.md`, `docs/decisions/2026-07-25-resource-action-rbac-migration-plan.md` (superseded by §1).*
