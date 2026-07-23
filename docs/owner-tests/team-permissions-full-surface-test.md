# TEAM & PERMISSIONS — FULL-SURFACE OWNER TEST

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the permission-funnel owner-tests.** It is STANDING,
> not dated — **run it after any change to /team, role_definitions, business_members.permissions, or
> the funnel RPCs.** A per-build proof is a FILTER on this board (`COVERS: #NNN`), never a second doc.

**Purpose:** prove the one thing the recon (2026-07-23) found broken — that the screen an owner uses
to grant a permission actually grants it — and that no side door, no fake pill, and no silent grant or
revocation survives. The FUNNEL (`save_role_permissions` / `assign_member_role`, permission funnel
migration 2026-07-23) is the only way a permission changes; these cards are how we know it held.

**Why this exists (the defect these cards defend against):** the /team Roles tab wrote
`role_definitions` (a template) while every gate read `business_members.permissions` (the member row),
and nothing carried an edit from the first into the second — so **"Save MANAGER" changed nothing a gate
reads.** `import_pricing` was minted and gated the same hour it became *ungrantable to any manager*. The
funnel closes that; card 1 is the live proof.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Trustworthy. Only David sets this. |
| `STATUS: owed` | 🟡 A test is written but has not been run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 The surface EXISTS and has NO test — a known hole, not an oversight. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `phone` · `desktop` · `either`. /team is a `desktop` surface (reconcile=desktop). |
| `COVERS:` | The ledger row / decision / card this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without one. |

**PASS = every card in scope is `covered` with today's date.** Thunder never sets `covered` (OP-14).

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **STEP ZERO. Before you read any screen as evidence: confirm the deploy for the SHA under test is
> live AND — for this build — the GATED migration `20260723_permission_funnel.sql` is applied and its
> V1–V8 are green.** A funnel whose migration is not applied fails at the RPC call; a stale bundle
> tests old code. Either way, everything below is fiction. (OP-15.)

- [ ] **① SHA is live** — the bottom-of-screen stamp `built <date> · <sha>` matches `git log -1 --format=%h`.
- [ ] **② migration applied** — run V1 (`save_role_permissions` / `assign_member_role` exist, DEFINER, owned by postgres) and V3 (the side-door close REFUSES a direct JWT `UPDATE business_members SET permissions`). If V3 SUCCEEDS, the funnel is not a funnel — STOP.

---

### 1. Owner grants a permission on /team → the MEMBER ROW changes → the manager's next action succeeds
STATUS: owed
DEVICE: desktop
COVERS: card 18 (the live import_pricing case), ledger #149, R4, the whole defect
LAST-PROVEN: never
SIGNAL: `[TRACE:MEMBERCONSOLE] funnel { roleKey:'MANAGER', op:'save', membersAffected }`
- **Do:** as the OWNER, /team → Roles → MANAGER → toggle **Import pricing** ON → **Save MANAGER**. Confirm the blast-radius dialog and accept.
- **PASS:** after save, sign in as the manager and run a bulk price import — **the price lands**. (Server-side proof, V4: `business_members.permissions ? 'import_pricing'` is now `true` for the manager, `updated_at` moved.)
- **FAIL:** the Roles tab shows import_pricing on MANAGER but the manager's import price is still refused *(the template moved, the member row did not — the exact pre-funnel defect)*.
- **Why:** before the funnel, this was FAILED by construction — a role save never touched the member row the gate reads.

### 2. Every grant and revoke writes an audit_log row naming actor, subject, before and after
STATUS: owed
DEVICE: desktop
COVERS: R6, audit_log spine (20260623) — its FIRST governance writer
LAST-PROVEN: never
SIGNAL: the row itself
- **Do:** after card 1's save, query (owner session) `SELECT action, target_id, detail FROM audit_log WHERE action LIKE 'role.%' ORDER BY created_at DESC LIMIT 1;`
- **PASS:** a `role.permissions_changed` row, `target_id='MANAGER'`, `detail` carries `before`, `after`, `members_affected`, and a `members` array of `{id, before, after}`. A per-member re-assignment writes `member.role_changed`.
- **FAIL:** no row *(the pen was never picked up — the spine sat empty, R6)*.

### 3. A role save that REMOVES a permission names who loses what BEFORE saving — and after, they lose it
STATUS: owed
DEVICE: desktop
COVERS: sub-ruling #1 (WIPE not merge; a silent revocation is the same class as a silent grant)
LAST-PROVEN: never
SIGNAL: `[TRACE:MEMBERCONSOLE] funnel { op:'save', membersAffected }`
- **Do:** /team → Roles → MANAGER → toggle **View costs** OFF → **Save MANAGER**.
- **PASS:** BEFORE the write, the confirm names **N active members** and lists **They will LOSE: view costs**. After confirming, a manager can no longer open a cost surface (V8: their member row no longer contains `view_costs`).
- **FAIL:** the save proceeds silently with no blast-radius dialog · or the manager keeps the cost surface after the save *(the wipe did not reach the member row)*.

### 4. The OWNER row renders every pill lit and locked — no owner pill can be toggled off
STATUS: owed
DEVICE: desktop
COVERS: sub-ruling #3, R3 (owner authority is owner_id, not the member array)
LAST-PROVEN: never
SIGNAL: none — visual
- **Do:** /team → Roles → look at the OWNER card.
- **PASS:** every permission chip is **ON**, each shows a 🔒 and is **not clickable**; the card says **Full access — N of N permissions … set by business ownership**; there is **no Save button** on the OWNER card.
- **FAIL:** any owner pill is unlit or togglable *(it would imply the owner LACKS a permission he exercises daily — false on the one screen an owner consults)*.

### 5. After any save, the count on screen equals the member row's array length
STATUS: owed
DEVICE: desktop
COVERS: R3 (one number, one source — the screen read RD while the gate read BM)
LAST-PROVEN: never
SIGNAL: none — visual + one query
- **Do:** after any MANAGER save, read the `N permissions` count on the MANAGER card, then query `SELECT jsonb_array_length(permissions) FROM business_members WHERE role='MANAGER' AND active` (V5).
- **PASS:** the two numbers are equal.
- **FAIL:** the card shows one number and the member row another *(the screen and the gate read different stores — the R3 defect)*.

### 6. The two fake pills no longer render
STATUS: owed
DEVICE: desktop
COVERS: sub-ruling #3, D-9, UNWIRED_ACTION_PERMISSIONS
LAST-PROVEN: never
SIGNAL: none — visual
- **Do:** /team → Roles → scan every role card's chips.
- **PASS:** **Apply discount** and **Override maintenance** appear on **no** role card. `Apply tax exempt` and `Import pricing` (both wired) still appear.
- **FAIL:** either fake pill renders *(a control that gates nothing states something false about who can do what)*.

### 7. A member cannot elevate themselves; the attempt is recorded as denied
STATUS: owed
DEVICE: desktop
COVERS: sub-ruling (self-grant), R6, the §1 self-elevation block
LAST-PROVEN: never
SIGNAL: the audit row
- **Do:** as a MANAGER session, call the funnel directly: `SELECT * FROM save_role_permissions('<BIZ>','<MGR>','MANAGER','save','x','y','["view_pricing_config"]'::jsonb);` (V7).
- **PASS:** returns `applied=false` naming owner-only, the manager's row is UNCHANGED, and `audit_log` gains a `permission.self_elevation_denied` row with `outcome='denied'`.
- **FAIL:** the call changes any permission *(self-elevation succeeded — the worst case)*.
- **Note:** a raw-SQL direct `UPDATE` (not the RPC) is REFUSED by the §1 trigger but cannot self-audit (a BEFORE-trigger RAISE rolls back the txn; Postgres has no autonomous transaction). The durable denial row is written when a non-owner CALLS the funnel — the reachable app path.
