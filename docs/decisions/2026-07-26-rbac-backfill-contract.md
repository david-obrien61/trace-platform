# THE BACKFILL CONTRACT — R-A / R-B / R-C

**Status:** SHIPPED as docs + funnel-side logic in **Phase 0**. **EXECUTED in Phase 6.**
**Ruled by:** David, 2026-07-26 (Phase 0 amendment, A4).
**Companions:** `docs/resource-action-permission-spec.md` (v3 §8) · `docs/decisions/2026-07-26-rbac-build-plan.md`
(§3 Phase 6, SEQUENCE) · `supabase/migrations/20260726_permission_alias_layer.sql` (the header states the
two invariants this document is the primary home of) · `packages/shared/src/auth/permissionManifest.ts`
(`STRIPPED_AT_BACKFILL`, `DEFAULT_BUNDLES`).

---

## WHY THIS DOCUMENT EXISTS BEFORE THE THING IT GOVERNS

**R-A is the primary safety invariant for the alias layer**, not a Phase 6 implementation detail.

The alias layer is seeded BOTH DIRECTIONS, so a holder of `inventory:read` satisfies a `view_costs`
policy — which during the migration window also admits `cost_objects` and `receipts`. That widening
is accepted deliberately because it is what makes every phase order-independent and reversible. But
it is only closed by **two invariants, and both must hold**:

> **(i) BACKFILL IS RENAME-ONLY.** No member receives a string whose legacy antecedent they did not
> already hold.
>
> **(ii) ALL CAPABILITY FLIPS (Phases 1–5) COMPLETE BEFORE BACKFILL (Phase 6)** — so no legacy policy
> survives for the reverse direction to resolve into.

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

## EXECUTION ORDER (Phase 6) — and what makes each step safe

1. **CENSUS** (V5). Enumerate every distinct string held, per tenant. Reconcile against
   `ALL_LEGACY_PERMISSIONS` in the manifest. **An unclassifiable string STOPS the backfill** — it is
   a register gap, not a rounding error.
2. **Confirm invariant (ii)**: every capability flip from Phases 1–5 has landed. If any gate still
   checks a legacy string, the reverse alias is still load-bearing and the backfill is premature.
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
- **What a fresh role should start with.** That is `DEFAULT_BUNDLES`, and it applies to roles created
  after this program.
- **The mint-site fix.** Recorded above; David's call.

---

*Phase 0 deliverable 7. The funnel-side enforcement of R-A lands with the Phase 6 execution script;
this document is the contract it implements, written first so the invariant cannot be broken by
someone who never read the plan.*
