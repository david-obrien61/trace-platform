# Audit-Spine Recon — find the logs, measure vs standard, plan the redirect

**Mode:** READ-ONLY recon → findings only → STOP. No table, no migration, no redirect built.
**Date:** 2026-06-23 · **Author:** Thunder · **Project:** cultivar-os (bgobkjcopcxusjsetfob)
**Question:** Is there a canonical audit home? Measure reality against the industry-standard append-only event-log spine, inventory what already writes logs, plan the redirect. **Decision (envelope + redirect order) is OWED to David — not made here.**

> Ground truth = migrations + code reads, not memory. `[TRACE:*]` is DEBUG and is NOT fused with audit anywhere in this doc.

---

## PART 1 — WHAT EXISTS TODAY (ground truth)

### 1.1 Is there ANY audit/log TABLE in Cultivar?
**No audit table exists.** Swept all 50 migrations (`grep create table … audit|log|event|history|activity|trail`) and the full CREATE-TABLE name list. There is **no** `audit_log`, `event_log`, `activity_log`, `audit_trail`, or `*_history` table.

Two tables carry "log" in the name; **both are OPERATIONAL, neither is a security/accountability log:**

| Table | Source | Shape | Class |
|---|---|---|---|
| `business_service_log` | `20260612_business_assets_inventory_pmi_service.sql:226` | `business_id · asset_id · service_type · performed_by(text) · performed_at · cost · receipt_id · notes` | **Operational** — maintenance/service records for an asset. Mutable. Not who/what/when of a governance action. |
| `pmi_service_logs` | `20260529_pmi_shared.sql:28` | PMI service records | **Operational** — preventive-maintenance history. |

Adjacent governance/compliance tables found, none of which is an audit log:
- `order_compliance_records` (`20260529_businesses_g_compliance_and_customer_match.sql`) — per-order compliance capture (operational record on the order, **no writer found in app code** — declared, dormant).
- `role_definitions` (`20260623_role_definitions_and_self_grant_fix.sql`, **landed today**) — the three-tier role store (floor / override / custom). It STORES role definitions; it is not an event log of changes to them.
- `invitations`, `business_members` — identity state, not event history.

### 1.2 Existing who/what/when capture pattern?
**None at the data layer.** The only "who did what" surface is `[TRACE:*]` `console.log/warn` (PART 2) — ephemeral debug, not persisted, deletable. No table records actor + action + target + outcome for any governance action. The closest *conceptual* reference is the **receipt ledger** doctrine (MASTER_BRIEF:1030 — "the ledger shows exactly what the AI read and exactly what the human confirmed") but that is an operational/compliance-adjacent record of receipt processing, not a security event log, and is not built as one.

### 1.3 Gap report — reality vs the target envelope
Measured against the standard append-only, immutable, tenant-scoped who/what/when/target/detail/outcome log:

| Property (target) | Reality today | Gap |
|---|---|---|
| Dedicated `audit_log` table | does not exist | **MISSING — entire table** |
| `actor_user_id` (who) | not captured | MISSING |
| `actor_role` (role at time of action) | not captured | MISSING |
| `action` from a CONTROLLED vocabulary | not captured | MISSING |
| `target_type` / `target_id` | not captured | MISSING |
| `detail` (old→new) jsonb | not captured | MISSING |
| `outcome` (success/**denied**) | not captured — **failed/denied attempts are invisible** | MISSING |
| Append-only / immutable (no UPDATE/DELETE) | n/a (no table) | MISSING — the defining property is absent |
| Tenant-scoped via RLS (AC-3) | n/a | MISSING |
| Separate from debug + operational data | partially — debug (`[TRACE:*]`) and operational logs exist but are NOT audit; fine | OK conceptually; just no audit layer to keep separate yet |

**PART 1 verdict: NO audit home exists — not partial, none.** This is a greenfield spine, not a retrofit. Good news: nothing to un-fuse — debug and operational logs are already distinct from (the missing) audit.

---

## PART 2 — WHAT WRITES TO LOGS TODAY (the redirect inventory)

### 2.1 + 2.2 Inventory, classified

**A) DEBUG — `[TRACE:*]` console emits (stays as-is, NOT audit).**
28 distinct areas, ~550 emits across `packages/` + `api/` (top: STYLE 71, MARGIN 57, PROJECTLENS 49, BUSINESS 46, WORKFLOW 40, RECEIPT 34, API 31, DELIVERY 27, AUTH 27 …). **Every one is `console.log/warn`** — verified samples in `auth/businessGuards.ts`, `RoleConfig.tsx`. Ephemeral, deletable, ON-by-owner-instruction. **Class: DEBUG. Never redirect to the audit spine** (the prompt's hard line; STD-003). They may *co-locate* at the same call site as a future audit write, but the audit row is a separate persisted INSERT.

**B) AUDIT-WORTHY DB writes (governance / money / identity) — currently write NO audit row.**

| Writer | Location | What it does | Maps to `action` |
|---|---|---|---|
| `updateMemberRole` | `shared/src/auth/members.ts:23` | UPDATE `business_members.role` + `.permissions` | `member.role_changed` |
| `removeMember` | `shared/src/auth/members.ts:37` | DELETE a `business_members` row | `member.removed` |
| member INSERT (onboarding) | `cultivar-os/src/pages/OnboardingWizard.tsx:503` | INSERT first owner member | `member.added` |
| `upsertTenantRole` | `shared/src/auth/roleDefinitions.ts:122` | INSERT/UPDATE per-tenant role row | `role.created` (new key) / `role.permissions_changed` (override tune) |
| `deleteTenantRole` | `shared/src/auth/roleDefinitions.ts:164` | DELETE per-tenant role row | **`role.factory_reset`** (system key → floor re-inherits) / `role.deleted` (custom key) |
| `cost-apply` endpoint | `cultivar-os/api/discovery/ingest.ts:85` | service-key WRITE of `business_inventory.unit_cost` after a `view_costs` gate | `cost.applied` |
| `cost-apply` REFUSED | `ingest.ts:96` (`[TRACE:WRITEWALL]`) | 403 when caller lacks `view_costs` — **a denied event** | `cost.apply_denied` (outcome=denied) |
| self-elevation block | `enforce_member_authority_immutability` trigger, `20260623_…:83` RAISE | DB-layer refusal of a member self-widening role/permissions | **`permission.self_elevation_denied`** (outcome=denied) — see ⚠️ below |
| tile/module enablement | `shared/src/business-logic/financialDataAccess.ts:210,219` | UPSERT `business_modules` (enabled/config) | `tile.activated` / `tile.configured` — **becomes money-action under MB_D-011 activation authority** |
| invite consumed | `shared/src/auth/invitations.ts:68` | UPDATE `invitations.used=true` | `invite.accepted` (lower priority) |

**C) OPERATIONAL — business state history (stays operational, NOT audit).**
`business_service_log`, `pmi_service_logs`, `order_compliance_records`, the receipt ledger (MB:1030), order-status writes, `concept_aliases` upsert (Ignition `IgnitionAudit.jsx:78`). These record *business facts*, not *who-exercised-authority*. Leave them where they are.

### 2.3 The redirect list (audit-worthy writers → spine)
Ordered by readiness + need. Each is a **one-line INSERT added at the existing call site** (the writer already runs in the owner's authenticated session or a gated service-key endpoint):

1. `deleteTenantRole` → **`role.factory_reset` / `role.deleted`** ← FIRST (immediate need; doctrine MB_D-010 says reset is "audited").
2. `upsertTenantRole` → `role.created` / `role.permissions_changed`.
3. `updateMemberRole` / `removeMember` → `member.role_changed` / `member.removed`.
4. `cost-apply` success + refusal → `cost.applied` / `cost.apply_denied`.
5. self-elevation trigger refusal → `permission.self_elevation_denied` (⚠️ mechanism note below).
6. `business_modules` enablement → `tile.activated` / `tile.delegated` / `tile.revoked` (wires when MB_D-011 activation authority is built — doctrine already says "every activation AND every delegation writes an audit row").
7. ownership transfer → `ownership.transferred` (no code yet — parked doctrine; wires when built).
8. document signing → `document.signed` (see signing flag in PART 3).

⚠️ **Self-elevation (#5) mechanism caveat:** the refusal is a `RAISE EXCEPTION` inside a `BEFORE UPDATE` trigger, which **rolls back the whole transaction** — an audit INSERT in the same transaction would roll back with it. Logging this denied event needs either (a) a separate autonomous write (e.g. the client catching the `insufficient_privilege` error and POSTing a denied-event to a service-key audit endpoint), or (b) `dblink`/`pg_background` out-of-transaction insert (heavier). **Flag for the plan — denied-by-trigger is the one case that can't be a naive in-line INSERT.**

---

## PART 3 — WHAT SHOULD BE AUDITED (requirements + vocabulary)

Walked doctrine (MASTER_BRIEF MB_D-010/011/014/015) + built features. Every governance/money/security/identity action:

| Requirement | `action` (controlled vocab) | `target_type` | Doctrine / source | Built? |
|---|---|---|---|---|
| Custom role created | `role.created` | role | MB_D-010 | ✅ `upsertTenantRole` |
| System role tuned (clone-not-mutate override) | `role.permissions_changed` | role | MB_D-010 | ✅ `upsertTenantRole` |
| Factory-reset (delete override → re-inherit floor) | `role.factory_reset` | role | **MB_D-010 (MB:1140 "Role-admin-gated + audited")** | ✅ `deleteTenantRole` |
| Custom role deleted | `role.deleted` | role | MB_D-010 | ✅ `deleteTenantRole` |
| Member's role reassigned | `member.role_changed` | member | role/permission system | ✅ `updateMemberRole` |
| Member added / removed | `member.added` / `member.removed` | member | identity | ✅ |
| Self-elevation attempt refused | `permission.self_elevation_denied` | member | the `bm_self_update` trigger (MB_D-015 write-authority ≥ read-authority) | ✅ trigger live (⚠️ logging caveat) |
| Tile activated / delegated / revoked | `tile.activated` / `tile.delegated` / `tile.revoked` | tile | **MB_D-011 (MB:1148 "every activation AND every delegation writes an audit row")** | 🟡 enablement write exists; activation-authority layer not built |
| Cost written to a line (reasoned) | `cost.applied` | cost_object | cost write-wall | ✅ gated endpoint |
| Cost-apply refused (no `view_costs`) | `cost.apply_denied` | cost_object | write-wall | ✅ `[TRACE:WRITEWALL]` 403 |
| Ownership transferred | `ownership.transferred` | business | parked ownership doctrine ("owner must never lose the keys") | 🔴 no code |
| Document signed | `document.signed` | document | **MB_D-014 (MB:1172)** | 🔴 not built |

### Signing flag (the prompt's explicit question — flag, don't decide)
MASTER_BRIEF:1172 says signing's proof is **"a bound record, always captured: a content snapshot/hash of EXACTLY what was shown + the verified channel + the consent artifact, on the standard who/what/when audit."** Reading: the bound record is described as sitting **ON** the standard who/what/when spine — i.e. signing emits an `audit_log` event (`document.signed`, who/what/when) **AND** carries an extra bound payload (snapshot/hash + channel + consent artifact) that a plain audit row's `detail jsonb` may or may not be the right home for. **Open question for David:** is the signing bound-record (a) a `document.signed` audit_log row whose `detail` holds the snapshot/hash/channel/artifact, or (b) a SEPARATE `signing_records` table that *also* emits a `document.signed` audit event (audit = the index, bound-record = the evidence vault)? Doctrine leans "on the standard audit" (one spine) but signing carries compliance-grade evidence that may outgrow a `detail` blob. **Not decided here.**

---

## PROPOSED PLAN (for David to ratify — NOT built)

Per the three-lens recon gate (OP-8):

**HAVE** — no audit table; governance writers (`updateMemberRole`, `upsert/deleteTenantRole`, `cost-apply`, the self-elevation trigger) run but record nothing durable; `[TRACE:*]` debug only.
**NEED** (irreducible minimum to make factory-reset "audited" per MB_D-010) — one append-only, tenant-scoped table + a `role.factory_reset` INSERT at `deleteTenantRole`. That's it to unblock the immediate doctrine.
**WANT** (clean end-state) — the full controlled-vocabulary spine every governance/money/identity writer redirects into, denied-events captured, extensible to compliance-grade (retention, read-access controls, hash-chaining) without repainting.

### (a) Canonical `audit_log` migration shape (the envelope to ratify)
```
audit_log {
  id            uuid pk default gen_random_uuid()
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE   -- tenant scope, AC-3
  actor_user_id uuid            -- auth.uid() (nullable: service/system context)
  actor_role    text            -- role at time of action
  action        text NOT NULL   -- CONTROLLED vocab (role.* / member.* / tile.* / cost.* / permission.* / ownership.* / document.*)
  target_type   text            -- role / tile / member / business / document / cost_object
  target_id     text
  detail        jsonb           -- old→new / specifics (no casual PII)
  outcome       text NOT NULL DEFAULT 'success'   -- success / denied
  created_at    timestamptz NOT NULL DEFAULT now()
}
```
**Immutability (the defining property):**
- RLS: `audit_insert` (INSERT, authenticated, WITH CHECK tenant-scoped) + `audit_read` (SELECT, owner of the business — or `is_active_member` if members may read their tenant's trail; **David's call on read scope**). **NO UPDATE policy, NO DELETE policy** → even owners/admins cannot rewrite or erase history. Optionally also `REVOKE UPDATE, DELETE ON audit_log FROM authenticated` as belt-and-suspenders.
- **Author-trust decision to ratify:** client-side INSERT (the owner's session writes its own audit rows — owner can *append* but never *rewrite*; simplest, rides existing call sites) **vs** server-side service-key INSERT only (tamper-resistant author, but every writer must route through a Vercel fn). Recommend **client-side INSERT for accountability-grade now** (immutability is the guarantee, not write-authorship), upgrade specific high-value events (signing, ownership) to server-side later. Denied-by-trigger events (self-elevation) must be server-side or client-catch regardless (rollback caveat).
- Index: `(business_id, created_at desc)` for the per-tenant trail view.
- **Leave room, don't build now:** retention policy, read-access roles, hash-chaining (`prev_hash`/`row_hash`) for tamper-evidence — envelope above accommodates all three additively.

**Options spanning NEED→WANT:**
- **Option 1 (cheapest-meets-need):** table + RLS insert/select + wire `role.factory_reset` only. Unblocks MB_D-010. ~1 migration + 1 INSERT line.
- **Option 2 (recommended):** Option 1 + redirect all READY role/member/cost writers (#1–#4 of the redirect list) at the same time, since they're the same shape and the RoleConfig console just landed. One spine, four writers, done before drift starts.
- **Option 3 (fullest-meets-want):** Option 2 + denied-event capture (self-elevation, cost-apply-denied) + forward-declare the tile/ownership/signing vocab. Defer compliance hardening.

### (b) Redirect order
factory-reset (1) → other role.* writers (2) → member.* (3) → cost.* incl. denied (4) → tile.* when MB_D-011 builds (5) → ownership/signing when built (6–7).

### (c) First writer wired
**`deleteTenantRole` → `role.factory_reset`** — the immediate need; doctrine already calls reset "audited," and the RoleConfig console (PART B, `661dcfa`) that triggers it is live.

---

## CLOSING VERDICT (3 lines)
1. **Does an audit home exist? NO** — zero audit/event/activity tables in 50 migrations; the two "log" tables (`business_service_log`, `pmi_service_logs`) are operational, and `[TRACE:*]` is debug. Greenfield spine.
2. **How many audit-worthy writers to redirect? ~8** governance/money/identity write paths (4 role/member, 2 cost incl. denied, 1 tile-enablement, 1 self-elevation-denied) exist today and record nothing durable; 2 more (ownership, signing) are doctrine-not-yet-built.
3. **Signing bound-record — separate or part-of?** Doctrine (MB:1172) places it "on the standard who/what/when audit," so it emits a `document.signed` audit event; **OPEN** whether the snapshot/hash/channel/consent evidence lives in that row's `detail` or a separate `signing_records` vault the audit row indexes — flagged for David, not decided.

**STOP.** David ratifies the envelope + author-trust model + redirect order + the signing question; the `audit_log` migration and factory-reset wiring come after.

---

## OWNER-PROOF ADDENDUM — applied + proven 2026-06-24 (David, at postgres prompt)

The `audit_log` spine (`20260623_audit_log_spine.sql`) was applied and verified: 9/9 catalog
(A)–(I); UPDATE **and** DELETE both proven refused (42501 "append-only", inside BEGIN…ROLLBACK).
Ledger #19 = OWNER-PROVEN. Two durable lessons surfaced during the proof:

**(a) TRUNCATE bypasses BOTH RLS and FOR EACH ROW triggers.** The append-only design enforced
immutability three ways (RLS INSERT/SELECT-only, a BEFORE UPDATE OR DELETE row trigger, and
REVOKE UPDATE,DELETE) — but the grantee check found TRUNCATE held by anon/authenticated/
service_role, a live hole. The row-level immutability trigger never fires on TRUNCATE, so the
trigger alone is insufficient. **Append-only tables must REVOKE TRUNCATE from untrusted roles.**
Fixed: `REVOKE TRUNCATE ON audit_log FROM anon, authenticated, service_role;` (grantee now
postgres-only); repo record `supabase/migrations/20260624_audit_log_truncate_revoke.sql`.

**(b) ON DELETE CASCADE deletions do not trip the BEFORE ROW DELETE immutability guard.** Tested
via a throwaway business + audit row, then `DELETE FROM businesses` inside BEGIN…ROLLBACK: the
cascade DELETE SUCCEEDED — it did not abort against the DELETE-refused guard. PROPERTY PROVEN:
audit rows are immutable in place (no UPDATE/DELETE/TRUNCATE by untrusted roles) but RIDE THE
BUSINESS LIFECYCLE and clear on tenant teardown via cascade. This is INTENDED — it supports the
customer-departure policy (teardown removes identifiable data) — now proven by test, not assumed.

**BANKED, NOT BUILT (not approved):** an optional `BEFORE TRUNCATE FOR EACH STATEMENT` trigger as
belt-and-suspenders, gated on first confirming `reject_audit_log_mutation()` handles
`TG_OP='TRUNCATE'`. REVOKE is the real fix; the statement trigger is optional reinforcement only.
