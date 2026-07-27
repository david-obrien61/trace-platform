# THE BACKFILL CONTRACT — R-A / R-B / R-C / R-D

**Status:** SHIPPED as docs + funnel-side logic in **Phase 0**. **EXECUTED in Phase 6.**
**Ruled by:** David, 2026-07-26 (Phase 0 amendment, A4). **R-D added 2026-07-26** on the
alias-correction close-out.
**Companions:** `docs/resource-action-permission-spec.md` (v3 §8) · `docs/decisions/2026-07-26-rbac-build-plan.md`
(§3 Phase 6, SEQUENCE) · `supabase/migrations/20260726_permission_alias_layer.sql` (the header states the
two invariants this document is the primary home of) ·
`supabase/migrations/20260726_permission_alias_legacy_rename_only.sql` (**the correction — the legacy
side is rename-only; it is what makes invariant (ii) load-bearing, see R-D**) ·
`packages/shared/src/auth/permissionManifest.ts` (`STRIPPED_AT_BACKFILL`, `DEFAULT_BUNDLES`) ·
`docs/standards/permission-enforcement-map.md` (which layers gate a capability).

---

## WHY THIS DOCUMENT EXISTS BEFORE THE THING IT GOVERNS

**R-A is the primary safety invariant for the alias layer**, not a Phase 6 implementation detail.

The alias layer was seeded BOTH DIRECTIONS, so a holder of `inventory:read` satisfied a `view_costs`
policy — which during the migration window also admits `cost_objects` and `receipts`. That widening
was accepted deliberately because it is what makes every phase order-independent and reversible. But
it is only closed by **two invariants, and both must hold**:

> **(i) BACKFILL IS RENAME-ONLY.** No member receives a string whose legacy antecedent they did not
> already hold.
>
> **(ii) ALL CAPABILITY FLIPS (Phases 1–5) COMPLETE BEFORE BACKFILL (Phase 6)** — so no legacy policy
> survives for the reverse direction to resolve into.

### ⚠️ AMENDED 2026-07-26 — (ii) IS NOW LOAD-BEARING, NOT MERELY PRUDENT

The escalation above was **found live 2026-07-26**, closed by hand the same day, and migrated as
`supabase/migrations/20260726_permission_alias_legacy_rename_only.sql` (`2bea456`). A gate checking a
1→many SPLIT (`view_costs` → 14 shards) was satisfied by holding **any one** shard. Those 39
legacy-checked rows are DELETED and a partial unique index (`permission_aliases_legacy_is_rename_only`)
makes them unwritable. **The 7 pure RENAMES survive in both directions; the 9 SPLITS now resolve in
ONE direction only** (new-checked: holding the coarse legacy string still satisfies a fine new check).

The consequence for *this* contract is direct and it is a tightening, not a relaxation:

- **The reverse alias no longer rescues a premature backfill.** A member re-materialized to
  `orders:update` / `costs:read` and so on will **FAIL** any surviving gate that still checks
  `manage_orders` / `view_costs`. Under the old symmetric shape they would have passed.
- So invariant (ii) stopped being the thing that *closes a widening* and became the thing that
  *keeps members working*. Running Phase 6 ahead of a flip no longer widens authority — it
  **REVOKES** it, silently, for every member the rename touches.
- **Enforcement is R-D below.** Invariant (ii) previously lived only in a migration header and as a
  one-line prose step in the execution order. It is now a per-capability precondition with a query
  and a stop rule.

Invariant (i) is *this contract*. If someone runs Phase 6 as "give every MANAGER the MANAGER bundle,"
the widening stops being a window and becomes a permanent grant — silently, with an audit row that
says a legitimate save happened. **That is why this is written now, before anyone can do it by
accident, and why the same warning is stamped on `COMMENT ON TABLE permission_aliases`: the next
person to touch this reads it where they are standing.**

---

## R-A — RENAME-ONLY. NO BUNDLE SEEDING.

Every member is re-materialized to **the decomposition of exactly what their array already holds** —
nothing more.

```
new_permissions(member) = ⋃ { replacements(s) : s ∈ member.permissions, s is mappable }
                          ∖ STRIPPED   (R-B)
```

**The MANAGER and STAFF default bundles are NOT migration targets.** They seed a **FRESH** role — a
role created after this program, with no history. They are the spec's answer to "what should a new
manager start with," which is a different question from "what does Lauren hold today."

**The concrete case that proves it matters:** `STAFF_DEFAULT_BUNDLE` contains `inventory:read`. **The
live STAFF member does not hold `view_costs`.** Seeding the bundle would grant `inventory:read` to
someone who has never had inventory access — and, through the reverse alias, would carry that member
into every `view_costs` policy still standing at that moment: `cost_objects`, `receipts`,
`business_service_log`. A role-definition refresh would have handed out the cost wall.

**Any divergence between a live array and a default bundle is a SEPARATE OWNER ACT** — performed
through the funnel, AFTER Contract, with its own audit row and its own blast-radius confirm.
**Backfill never silently means re-permission.**

---

## R-B — THREE CLASSES ARE STRIPPED, NOT ALIASED

Each strip runs **through the funnel** (`save_role_permissions` — atomic, audited, per-tenant,
WIPE-not-merge), so every removal carries an `audit_log` row naming the actor and what was lost.

| Class | Strings | Why it is stripped rather than carried |
|---|---|---|
| **retired** | `view_dashboard` · `view_reports` | R3. They map to no `resource:verb`. `view_dashboard` grants nothing a member lacks (it folds into `is_active_member`); `view_reports` has no live surface. There is nothing on the other side to alias to. |
| **unwired** | `override_maintenance` | R6. It gates nothing — **and `declared-unwired` strings are filtered out of the Roles page**, so carrying it forward creates an **INVISIBLE GRANT**: a member holds a string no screen can show and no owner can revoke. That is strictly worse than a fake pill. |
| **unmapped** | `process_orders` · `manage_team` | **A1.1.** In live member arrays, read by NOTHING — verified 2026-07-26 by grepping migrations, `router.tsx`, `tileRegistry.ts`, `packages/cultivar-os/api/**` and `packages/shared/src/**`: zero hits. Minted at `SignUp.tsx:34` and `AddBusiness.tsx:23`. They gate nothing, so they alias to nothing. |

`apply_discount` is **NOT** stripped: it is unwired *today* but becomes real in Phase 5, and it maps
to `order_discount:apply`. It is aliased and carried.

### 🔴 The mint sites re-introduce two of these, and Phase 7 cannot close until they are fixed

`packages/cultivar-os/src/pages/SignUp.tsx:34` and `AddBusiness.tsx:23` both carry the literal:

```ts
ownerPermissions: ['manage_settings', 'manage_team', 'view_orders', 'process_orders', 'view_reports']
```

Strip at Phase 6 and **the next business signup re-mints `manage_team`, `process_orders` and the
retired `view_reports`.** These two configs were not converted when #152 pointed mints at
`resolveRoleDefaults` (`Settings.tsx` and `OnboardingWizard.tsx` were). Phase 7's zero-check cannot
stay green while they stand.

**Recorded, not fixed in Phase 0 — deliberately:** changing what a new owner receives at signup is a
product decision, and owners resolve authority by `businesses.owner_id` regardless of the array, so
the literal is inert for the owner it mints. **It is a Phase 6 build input owed to David.**

---

## R-C — THE ZERO-CHECK ASSERTS AGAINST THE CENSUS, NOT AGAINST §2

Phase 7's exit condition is *"zero members hold a legacy string."* **It must be evaluated against the
set of strings members ACTUALLY hold — the CENSUS — not against build-plan §2's list of 18.**

**§2 missed two.** Its inventory was assembled from code (policies, routes, tiles, api gates) and was
never checked against data. `process_orders` and `manage_team` are in live arrays and in no plan
document. A zero-check written against §2 would have returned "clean" while two strings sat in every
owner row — *a corpus that cannot say what it contains answers "not found" with the confidence of a
correct answer* (the CAPTURE-INDEX failure, tech-debt #63).

**The census query is DAVID-QUERY V5** in the alias migration:

```sql
SELECT bm.user_id, bm.role, bm.permissions
  FROM public.business_members bm
 WHERE bm.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' AND bm.active
 ORDER BY bm.role;
```

Its output is **the backfill's input AND the contract's baseline** — save it. Every distinct string
across every row must be classifiable as mappable (R-A), stripped (R-B), or newly surfaced (which
means the census found a third thing §2 missed, and the register gets another row).

---

## R-D — THE PHASE 6 PRECONDITION, PER CAPABILITY (added 2026-07-26)

**Ruled by:** David, 2026-07-26, on the alias-correction close-out.

> **BEFORE backfilling any member who holds capability C's legacy string, PROVE that no surviving
> gate still checks that string. ZERO rows, or C's backfill DOES NOT RUN.**

The unit is **the capability, not the tenant and not the phase**. Phases 1–5 land capability by
capability, so "all flips are done" is answerable per capability long before it is answerable
globally — and a backfill that waits for the global answer waits longer than it has to, while one
that assumes it revokes authority. C's members are backfilled the moment C's own check is clean.

**This gate is a MEASUREMENT, not a checklist tick.** It runs against the live catalog and the live
source at execution time — never against a phase-tracking doc, which records what someone *believed*
had landed.

### ① THE RLS HALF — `pg_policies`, whole-schema

Search **every** policy in `public` for C's legacy literal. Do NOT scope it to a hand-listed table
set: a stale table list is exactly how a surviving gate hides, and the point of this check is to
find the one nobody remembered.

```sql
-- C = the capability under backfill; :legacy = its legacy string, e.g. 'view_costs'.
-- EXPECT: 0 rows. ANY row → C's backfill DOES NOT RUN.
SELECT tablename, policyname, cmd,
       COALESCE(qual, '') AS using_clause,
       COALESCE(with_check, '') AS with_check_clause
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%''' || :legacy || '''%'
 ORDER BY tablename, policyname;
```

### ② THE NON-RLS HALF — REQUIRED, AND THE REASON IS `manage_orders`

**`pg_policies` alone is NOT sufficient, and there is a live case that proves it.** `manage_orders`
is enforced at **four API sites and ZERO policies** — [`submit.ts:238`](../../packages/cultivar-os/api/orders/submit.ts#L238)
(tier/override), [`:1005`](../../packages/cultivar-os/api/orders/submit.ts#L1005) (update),
[`:1223`](../../packages/cultivar-os/api/orders/submit.ts#L1223) (delete),
[`:1292`](../../packages/cultivar-os/api/orders/submit.ts#L1292) (status), all via
`callerCanManageOrders`. A `pg_policies` zero-check for `manage_orders` returns **0 rows today** —
and the gate is fully alive. Backfilling on the RLS half alone would revoke order edit / cancel /
status for every non-owner member the rename touches, and the catalog would have said it was safe.

So the precondition is **both halves**, and both must be zero:

```bash
# EXPECT: 0 hits, excluding comments and the manifest's own register entries.
grep -rn "'<legacy>'" \
  packages/cultivar-os/api packages/cultivar-os/src/router.tsx \
  packages/cultivar-os/src/registry packages/shared/src \
  --exclude-dir=node_modules --exclude-dir=dist
```

Route gates (`PermissionRoute`), tile `required_permission`, and any `callerHoldsPermission(...)`
literal count as surviving gates exactly as a policy does. `docs/standards/permission-enforcement-map.md`
is the map of which layers a capability is gated at — **read it to know what to check, then MEASURE;
do not accept it as the measurement.**

### ③ THE STOP RULE

A non-zero result on **either** half is **not a warning and not a note** — C's backfill does not run,
the remaining capabilities proceed on their own clean checks, and the surviving gate is either
flipped (finish C's Phase 1–5 work) or recorded as a deliberate exception with David's ruling. The
per-capability result — capability, both counts, timestamp, and the SHA the source half was measured
at — is written into the Phase 6 execution record. **An unrecorded pass is treated as a fail**, for
the same reason OP-15 exists: a check nobody can point at did not happen.

---

## EXECUTION ORDER (Phase 6) — and what makes each step safe

1. **CENSUS** (V5). Enumerate every distinct string held, per tenant. Reconcile against
   `ALL_LEGACY_PERMISSIONS` in the manifest. **An unclassifiable string STOPS the backfill** — it is
   a register gap, not a rounding error.
2. **Run R-D per capability** — both halves, zero rows and zero hits, recorded. A capability that
   fails is HELD; the others proceed. This replaces the former global "confirm invariant (ii)" step,
   which was prose with no mechanism and no unit. Since the alias correction (`2bea456`) a premature
   backfill REVOKES authority rather than widening it, so this step is what keeps members working —
   not merely what keeps the window closed.
3. **Per member, compute** `new_permissions` by R-A. Diff it against the current array and **render
   the diff before writing** — the funnel's existing blast-radius confirm.
4. **Write through the funnel**, one tenant at a time. WIPE-not-merge (the #152 sub-ruling): the
   array becomes the computed set, never the union with what was there.
5. **Per-tenant exit:** zero members hold a legacy string, measured by the census — and every rewrite
   carries its audit row.

A tenant mid-backfill stays fully functional throughout, because the alias resolves both directions
until Contract drops it. That is the whole point of Phase 0.

---

## WHAT THIS CONTRACT DOES **NOT** DECIDE

- **Whether Lauren should hold more than she holds today.** She currently holds no `manage_orders`,
  so she receives no `orders:update` / `orders:delete` — she still cannot edit or cancel an order
  after the backfill. **That is the pre-existing state carried forward faithfully, not a regression
  introduced by the migration**, and it is exactly what R-A requires. Granting it is a separate
  owner act.

  **A1.2, read from CODE 2026-07-26 — the OWNER is not affected, the MANAGER is.**
  `callerCanManageOrders` ([`submit.ts:36-39`](../../packages/cultivar-os/api/orders/submit.ts#L36-L39))
  is `callerIsBusinessOwner(...) OR callerHoldsPermission(..., 'manage_orders')` — it **falls through
  to `businesses.owner_id` FIRST** ([`callerPermission.ts:64-81`](../../packages/shared/src/auth/callerPermission.ts#L64-L81),
  which resolves the caller's uid from the Bearer token and compares it to the row's `owner_id`).
  It is **not** array-only. So order edit / delete / status is **live for David today** with zero
  dependency on his member array — which is why nobody has noticed. For any **non-owner**, the array
  check is the only path, `has_permission('manage_orders')` is the only test, and no MANAGER at LAWNS
  holds it: **Lauren cannot edit, cancel, or re-status an order today, and cannot invoke a tier or a
  service price override** (the same gate at `:238`, which fails soft — the override is ignored and
  logged, not refused with a 403). That is a pre-existing product gap, not an artifact of this
  program. **Since `2bea456` the alias layer does not paper over it either:** `manage_orders` is a
  legacy-checked SPLIT, so its forward rows are gone and a member holding `orders:update` still fails
  this gate until Phase 1 flips those four sites.
- **What a fresh role should start with.** That is `DEFAULT_BUNDLES`, and it applies to roles created
  after this program.
- **The mint-site fix.** Recorded above; David's call.

---

*Phase 0 deliverable 7. The funnel-side enforcement of R-A lands with the Phase 6 execution script;
this document is the contract it implements, written first so the invariant cannot be broken by
someone who never read the plan.*
