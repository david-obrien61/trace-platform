# Permission Write-Sites Recon — where are permissions written, and which store is the truth?

**THUNDER — RECON ONLY. Zero code, zero schema, zero migration, zero data proposed as built.**
**SHA read: `5ec4b9d0664b56f01434dfa035bbf690794da84b`** (branch `main`, 2026-07-23).
**DB reads are blocked (no service key — D-49 block).** Every live-catalog need is a **DAVID-QUERY** in the BLOCKED section.
Every claim below carries `file:line` or a migration reference. Comments were not trusted — code was read.

---

## R0 — THE ONE-SENTENCE VERDICT

**VERDICT: The /team → Roles tab writes `role_definitions` (a role-TEMPLATE store); the gate `has_permission` reads `business_members.permissions` (a per-MEMBER store); nothing carries a Roles-tab edit from the first store into the second, so the screen an owner uses to grant a permission does not grant it.** There are **two stores holding role→permission facts, bridged by exactly one code path** (`updateMemberRole`, and only when a member's role is *re-assigned* on the Users tab), plus a **third, disagreeing hardcoded copy** (`DEFAULT_PERMISSIONS`). This is STD-011 (one fact, three representations) meeting the 2026-06-21 "render-only enforcement" finding, inverted: the policy now reads the member row and the screen no longer writes it.

---

## R1 — ENUMERATE EVERY WRITE SITE

**VERDICT: There are 13 write sites across two stores. The store the GATE reads (`business_members`) has 8 writers; the store the SCREEN writes (`role_definitions`) has 3 writers; a hardcoded TS constant is a third representation feeding 4 of the first 8. Exactly ONE path bridges the screen's store to the gate's store — and only on a role *re-assignment*, never on a Roles-tab save.**

Legend — **WHICH STORE**: `BM.perms` = `business_members.permissions` (jsonb) · `BM.role` = `business_members.role` · `RD` = `role_definitions` · `const` = hardcoded TS list.

| # | Write site (file:line / migration) | What it writes | WHICH STORE | Does anything READ that store as authority? | Reachable by an owner today? |
|---|---|---|---|---|---|
| 1 | `updateMemberRole` — [members.ts:24-36](../../packages/shared/src/auth/members.ts#L24-L36) | `role` + `permissions` on one member row | **BM.role + BM.perms** | **YES — `has_permission` / `has_permission_for` / `callerHoldsPermission` read `BM.perms`; RLS reads it on 10 tables** | YES — Users tab role dropdown → `assignRole` ([MemberConsole.tsx:216-227](../../packages/shared/src/components/team/MemberConsole.tsx#L216-L227)). **THE ONLY BRIDGE from RD → BM.** |
| 2 | `createInvitation` — [invitations.ts:51-64](../../packages/shared/src/auth/invitations.ts#L51-L64) | `role` + `permissions` on a pre-created **inactive** member row | **BM.role + BM.perms** | YES (same readers, once the row goes active) | YES — Users tab "Invite" → `sendInvite` ([MemberConsole.tsx:243-258](../../packages/shared/src/components/team/MemberConsole.tsx#L243-L258)) |
| 3 | `Settings.tsx` invite path — [Settings.tsx:202](../../packages/cultivar-os/src/pages/Settings.tsx#L202) | calls `createInvitation` with `permissions: DEFAULT_PERMISSIONS[inviteRole]` | **BM.perms** (via #2) | YES | YES — a SECOND invite entry point beside the Users tab |
| 4 | `OwnerSignup` owner-row mint — [OwnerSignup.tsx:319-339](../../packages/shared/src/auth/OwnerSignup.tsx#L319-L339) (`permissions: ownerPermissions`, :325) | the FIRST owner's `role` + `permissions` | **BM.role + BM.perms** | YES | YES — the owner's own row is minted here at signup |
| 5 | `setMemberActive` — [members.ts:54-65](../../packages/shared/src/auth/members.ts#L54-L65) | `active` (true/false) | **BM.active** | YES — `is_active_member` / `has_permission` both require `active = true`; `active=false` turns EVERY grant off | YES — MemberDetail deactivate/reactivate |
| 6 | `removeMember` — [members.ts:38-48](../../packages/shared/src/auth/members.ts#L38-L48) | DELETEs the member row | **BM (whole row)** | YES — revokes all authority | YES — Danger zone "Remove member" |
| 7 | `acceptInvitation` — [acceptInvitation.ts:148-153](../../packages/shared/src/auth/acceptInvitation.ts#L148-L153) | `user_id`, `active=true`, `name`, `person_id` — **NOT role, NOT permissions** | **BM (activation only)** | Indirectly — flips the frozen invite grants ON by setting `active=true` | YES (service-key path, at invite acceptance) — **does NOT write the permission array; the invite-time values from #2 stand** |
| 8 | Direct owner SQL `UPDATE business_members SET permissions=…` | `permissions` / `role` | **BM.perms + BM.role** | YES | YES — RLS `bm_owner_all` + the authority trigger PERMIT the owner ([20260623:79-86](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L79-L86)). This is the SQL workaround **David's ruling #2 rejects as a fix**. |
| 9 | `upsertTenantRole` (INSERT) — [roleDefinitions.ts:147-155](../../packages/shared/src/auth/roleDefinitions.ts#L147-L155) | a per-tenant role row (`role_key`, `permissions`) | **RD** | **NO — `has_permission` never reads `role_definitions`.** Only app read-time `resolveRoles` renders it. | YES — Roles tab Save / Clone / Add custom |
| 10 | `upsertTenantRole` (UPDATE) — [roleDefinitions.ts:141-144](../../packages/shared/src/auth/roleDefinitions.ts#L141-L144) | `permissions` (+ label/desc) on an existing RD row | **RD** | **NO** (same) | YES — **THIS is the "Save MANAGER" David clicked** ([MemberConsole.tsx:661-672](../../packages/shared/src/components/team/MemberConsole.tsx#L661-L672)) |
| 11 | `deleteTenantRole` — [roleDefinitions.ts:164-175](../../packages/shared/src/auth/roleDefinitions.ts#L164-L175) | DELETEs a tenant RD row (factory-reset / delete custom) | **RD** | **NO** | YES — Roles tab Reset/Delete |
| 12 | Floor seed — [20260623:201-223](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L201-L223) | the 3 system floor rows (OWNER 12 / MANAGER 9 / STAFF 3) | **RD (floor)** | **NO** | NO — postgres/service only |
| 13 | `DEFAULT_PERMISSIONS` — [roles.ts:50](../../packages/cultivar-os/src/auth/roles.ts#L50) (OWNER 17 / MANAGER 14 / STAFF …) | a hardcoded TS list; the source for `defaultPermissionsFor` ([TeamConsole.tsx:69](../../packages/cultivar-os/src/pages/TeamConsole.tsx#L69)) fed into #2/#3/#4 | **const** (feeds BM at invite/signup) | Indirectly — it is what lands in BM.perms at mint time | YES — code constant, changes only what NEW mints get |

**The self-grant guard is intact and correct:** the `enforce_member_authority_immutability` trigger ([20260623:60-98](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L60-L98)) blocks a member from widening its own `role`/`permissions`; only the business owner (or a NULL-`auth.uid()` service/migration context) may change them. This is not the defect — the defect is upstream of it: the owner's Save never reaches `business_members` at all.

---

## R1b — THE SINGLE SOURCE OF TRUTH

**VERDICT: `business_members.permissions` IS the truth — it is the ONLY store any gate reads. `role_definitions` is a DEFAULTS CATALOG that reaches truth only when a role is re-assigned; `DEFAULT_PERMISSIONS` is a stale hardcoded copy of the same catalog. Two of the three stores are copies of a fact the gate never consults.**

- **Read as authority:** `business_members.permissions`, by every one of `has_permission` ([20260622:112-127](../../supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql#L112-L127)), `has_permission_for` ([20260723_pricing_gate:67-83](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql#L67-L83)), the client `can()` for members ([BusinessProvider.tsx:693-700](../../packages/shared/src/context/BusinessProvider.tsx#L693-L700)), and `callerHoldsPermission` server-side ([submit.ts:46](../../packages/cultivar-os/api/orders/submit.ts#L46)).
- **Never read as authority:** `role_definitions`. Grep confirms no gate, RPC, or RLS policy references it; it is read ONLY by `getRoleDefinitions`/`resolveRoles` to paint the Roles tab. Its own migration says so: the resolution chain ends *"→ member's own `business_members.permissions` jsonb [final per-member grant]"* ([20260623:120-124](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L120-L124); echoed [roleDefinitions.ts:11-12](../../packages/shared/src/auth/roleDefinitions.ts#L11-L12)).
- **A stale third copy:** `DEFAULT_PERMISSIONS` ([roles.ts:50](../../packages/cultivar-os/src/auth/roles.ts#L50)) lists OWNER=17 / MANAGER=14, while the RD floor lists OWNER=12 / MANAGER=9. **The same fact, three numbers.** (David's ruling #1 names exactly this: "if perms are written in more than one place we chase our tails.")

**THE FIX MUST FUNNEL (David's ruling #1 + the D-50 shape).** Today two owner-facing surfaces write two different stores; the gate reads a third path into the first. A funnel makes it *structurally impossible* to change what a person may do outside one path:

> **One store — `business_members.permissions` — and one write path into it.** The Roles-tab Save must, in the same committed action, (a) write the role template (if templates are kept) AND (b) re-materialize `business_members.permissions` for every ACTIVE member holding that role — or the template concept is dropped entirely and the Roles tab edits member rows directly. Every current writer (#1-#4, #8) routes through that single funnel function; direct `UPDATE business_members` and free-hand `upsertTenantRole`-without-propagation cease to be reachable ways to change authority. This is the analog of D-50's "6 RPCs absorb 14 emit points so a quantity cannot move without a ledger row": here, **a permission cannot change without passing the funnel that writes the one store the gate reads.** *(Described, not built — David rules on template-kept vs template-dropped in the PROPOSAL.)*

---

## R2 — PROPAGATION

**VERDICT: No propagation mechanism exists. Nothing — on save, on sign-in, on invite acceptance, on any trigger or schedule — carries a `role_definitions` grant into `business_members.permissions`.**

- Grep for any code linking the two stores returns only `roleDefinitions.ts` (which only touches RD) and doc comments — **no `UPDATE business_members` anywhere downstream of an RD write.**
- The ONLY code that copies RD → BM is `assignRole` → `updateMemberRole(… target?.permissions …)` ([MemberConsole.tsx:222](../../packages/shared/src/components/team/MemberConsole.tsx#L222)), and it fires **only when an owner re-picks a member's role in the Users tab** — not on a Roles-tab Save. Editing MANAGER's chips and clicking "Save MANAGER" updates the template and leaves every existing MANAGER member's row exactly as it was.
- No DB trigger on `role_definitions` writes member rows (the only RD trigger is `set_role_definitions_updated_at`, a timestamp stamp — [20260623:181-192](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L181-L192)). No sign-in hook re-materializes permissions (`BusinessProvider` READS `business_members.permissions` at [:474/:508](../../packages/shared/src/context/BusinessProvider.tsx#L474); it never writes). No scheduled job.

**This is the whole defect in one line: the catalog can be edited forever and no member's authority moves.**

---

## R3 — WHERE DO THE UI'S NUMBERS COME FROM?

**VERDICT: The Roles-tab pill counts (OWNER 14 / MANAGER 12 / STAFF 3) are rendered from `role_definitions` (floor + per-tenant override), NOT from any member row. The member rows independently hold 6 / 11 / 3. The screen reads one store and writes the same store — and it is a DIFFERENT store from the one the gate reads.**

- The count `{perms.length}` at [MemberConsole.tsx:736](../../packages/shared/src/components/team/MemberConsole.tsx#L736) is `draft[role_key].length`; `draft` is seeded from `resolved` ([:645-648](../../packages/shared/src/components/team/MemberConsole.tsx#L645-L648)); `resolved` = `resolveRoles(floor, tenant)` over `role_definitions` ([:93](../../packages/shared/src/components/team/MemberConsole.tsx#L93), [roleDefinitions.ts:78-113](../../packages/shared/src/auth/roleDefinitions.ts#L78-L113)). **So every number on the Roles tab is a `role_definitions` number.**
- The floor seed is OWNER 12 / MANAGER 9 / STAFF 3 ([20260623:207-218](../../supabase/migrations/20260623_role_definitions_and_self_grant_fix.sql#L207-L218)). The UI shows 14 / 12 / 3 → **OWNER and MANAGER must carry per-tenant OVERRIDE rows** for `f7ec5d67` (STAFF 3 == floor, so no STAFF override). Exact override contents are a **DAVID-QUERY** (below) — but the *source* of the numbers is settled: `role_definitions`, not the member rows.
- The member rows (6 / 11 / 3) are written by mints #1-#4 at their write-time. They are ALSO stale vs `DEFAULT_PERMISSIONS` (MANAGER row 11 ≠ the constant's 14; owner row 6 ≠ 12/17), which is the signature of "frozen at an earlier default, never re-synced" (see R4).

**The owner-row special case (David's ruling #3).** For the OWNER, the member-row array is *cosmetically irrelevant to the app's own gate*: `can()` short-circuits `true` for the owner regardless of the array ([BusinessProvider.tsx:695](../../packages/shared/src/context/BusinessProvider.tsx#L695)), and `has_permission_for` is owner-inclusive by `owner_id` ([20260723_pricing_gate:76-77](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql#L76-L77)). So rendering the owner's pills as **unlit and togglable** (they are painted from RD like any role) states something false: it implies the owner *lacks* `view_costs`/`manage_deliveries`/`view_margin` (indeed absent from his 6-entry row) when he exercises all three daily. Ruling #3 = render the owner row **every-pill-lit-and-locked**, sourced from `owner_id` authority, not from the array. **⚠️ See BLOCKED item B — the plain RLS `has_permission` (not the owner-inclusive `_for`) is NOT owner-inclusive, so whether the owner's 6-entry row actually satisfies the RLS wall on `business_inventory` etc. depends on a separate owner policy existing. Confirm.**

---

## R4 — NEWLY-MINTED PERMISSIONS

**VERDICT: There is NO mint/seed/backfill step when a new permission enters the catalog. Every new permission starts life ungrantable to any existing member — it can only reach a member row by a full role re-assignment (or hand SQL). The 2026-06-21 "mint + seed + backfill current owners" step was specified but was never built. This is a design gap, and it is by design of omission, not a one-off bug.**

- `import_pricing` was minted 2026-07-23 in code ([actionPermissions.ts:75](../../packages/shared/src/auth/actionPermissions.ts#L75)) and given a server gate ([20260723_pricing_gate](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql)). **Neither its migration nor any other touches `business_members`** — grep for `import_pricing` in migrations shows only the gate functions and a *commented* verify hint (`UPDATE business_members SET permissions = permissions || '["import_pricing"]' …` at [20260723_pricing_gate:164](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql#L164)) that is explicitly a manual verify step, not applied code.
- So a member row written on 2026-07-10 *cannot* contain a permission minted on 2026-07-23 — correctly diagnosed in the prompt. The only routes in are: re-assign the role on the Users tab (copies RD → BM via #1), or hand-SQL (#8).
- The 2026-06-21 record specified "mint + seed four permissions + backfill current owners before flipping on." **What shipped:** the permission *strings* exist (`financialPermissions.ts`, `actionPermissions.ts`), the RD floor was seeded once (#12), and the owner is covered at the *gate* by `owner_id`-inclusive checks (`can()` true; `has_permission_for` owner clause). **What did NOT ship:** any backfill that writes a newly-minted permission into existing MEMBER rows. Managers (and any non-owner) are the uncovered class — exactly the class David tried to grant to.
- **Structural consequence:** the catalog (RD floor + action/financial constants) and the member rows drift apart the instant a permission is added, and there is no reconciler. Adding a permission is therefore a **two-artifact change today (string + gate) that SILENTLY needs a third (member backfill) nobody performs.**

---

## R5 — WHICH PILLS ARE LOAD-BEARING?

**VERDICT: Of the permissions rendered on /team, most gate something real, but at least two are fake surfaces (D-9): `apply_discount` (declared, but rides `manage_orders` — its own comment admits it) and `override_maintenance` (declared, mechanism not built). `import_pricing` is load-bearing server-side but currently ungrantable (R4).**

| Permission (pill) | Consulted by? | Load-bearing? | Cite |
|---|---|---|---|
| `view_costs` | RLS on cost_objects, business_inventory, cost_object_edges, cost_object_assignments, business_service_log, receipts | **YES (6 tables)** | [20260622:141-181](../../supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql#L141-L181) |
| `view_wages` | RLS on labor_resources, labor_resource_wages | **YES (2 tables)** | [20260622:187-205](../../supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql#L187-L205) |
| `view_pricing_config` | RLS on business_pricing_config | **YES** | [20260622:207-212](../../supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql#L207-L212) |
| `view_customers` | RLS on customers (`customers_member`) + client `can()` on order-entry lookup | **YES** | [20260710:41](../../supabase/migrations/20260710_customers_member_read.sql#L41), [ScanOrder.tsx:136](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L136) |
| `apply_tax_exempt` | server token gate in checkout (`callerCanApplyTaxExempt` → `callerHoldsPermission`) + client mirror | **YES (server-authoritative)** | [submit.ts:44-46](../../packages/cultivar-os/api/orders/submit.ts#L44-L46), [CartReview.tsx:57](../../packages/cultivar-os/src/pages/CartReview.tsx#L57) |
| `import_pricing` | server gate `import_write_price` → `has_permission_for` | **YES server-side, but ungrantable to members (R4)** | [20260723_pricing_gate:123](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql#L123) |
| `view_margin` | client `can()` + `applyFinancialDependencies` (requires view_costs) | **YES (render/derive gate)** | [BusinessProvider.tsx:696](../../packages/shared/src/context/BusinessProvider.tsx#L696), [financialPermissions.ts:81-85](../../packages/shared/src/auth/financialPermissions.ts#L81-L85) |
| tile perms (`qr_checkout`, `manage_deliveries`, `manage_campaigns`, `manage_settings`, `view_orders`, `view_dashboard`, `view_reports`) | `PermissionRoute` route-entry gate | **YES (route tier)** — see R5b | [router.tsx:134-205](../../packages/cultivar-os/src/router.tsx#L134-L205) |
| `manage_orders` | the REAL gate discount/override rides | **YES** | [submit.ts](../../packages/cultivar-os/api/orders/submit.ts) manage-orders gate |
| **`apply_discount`** | **Nothing keyed on the string** — "rides MANAGE_ORDERS + the server owner/manager token gate" | **NO — FAKE SURFACE (D-9)** | its own comment, [actionPermissions.ts:48-55](../../packages/shared/src/auth/actionPermissions.ts#L48-L55); called out again [20260723_pricing_gate:15](../../supabase/migrations/20260723_inventory_import_pricing_gate.sql#L15) |
| **`override_maintenance`** | **Nothing — "the mechanism is NOT built yet; this only DECLARES the permission"** | **NO — FAKE SURFACE (D-9)** | [actionPermissions.ts:20-26](../../packages/shared/src/auth/actionPermissions.ts#L20-L26) |

---

## R5b — THE COVERAGE MAP, BOTH DIRECTIONS

**VERDICT: Enforcement is genuinely three-tier (route / data / action), but it is assembled from three unreconciled snapshots and no standing map exists. The data tier gates 10 tables on `has_permission`; every OTHER table checks membership only. Two rendered pills gate nothing. This map is a deliverable in its own right and should live in a standing doc, not be buried here.**

### Enforcement points → what checks them

| Enforcement point | What it protects | What it checks | Tier |
|---|---|---|---|
| `PermissionRoute` wrappers, [router.tsx:134-205](../../packages/cultivar-os/src/router.tsx#L134-L205) | /orders, /deliveries, /social, /campaigns, /settings, /team, /discounts, /admin, /receipts, /assets, /inventory (+import/count/reconcile), /operating-costs, /pmi | `can(permission)` — owner true, else `BM.perms` | **route** |
| `PermissionRoute permission="owner-only"`, [router.tsx:201-205](../../packages/cultivar-os/src/router.tsx#L201-L205) | /costs, /customers, /add-business | `can('owner-only')` — only the owner short-circuit passes (no member holds the literal string) | **route (owner-only)** |
| RLS `*_member_all` on the 6 cost tables | cost_objects, business_inventory, cost_object_edges, cost_object_assignments, business_service_log, receipts | `is_active_member AND has_permission(…, 'view_costs')` | **data** |
| RLS on labor_resources / labor_resource_wages | wages | `is_active_member AND has_permission(…, 'view_wages')` | **data** |
| RLS on business_pricing_config | pricing recipe | `is_active_member AND has_permission(…, 'view_pricing_config')` | **data** |
| RLS `customers_member` | customers roster/PII | `is_active_member AND has_permission(…, 'view_customers')` | **data** |
| `import_write_price` (SECURITY DEFINER) | bulk price write | `assert_movement_actor` + `has_permission_for(…, 'import_pricing')` (owner-inclusive) | **action** |
| checkout `submit.ts` tax-exempt gate | tax zeroing | Bearer-token → `callerIsBusinessOwner` OR `callerHoldsPermission(APPLY_TAX_EXEMPT)` | **action** |
| `enforce_member_authority_immutability` trigger | the permission table itself | owner-only (or NULL-uid service) may change role/permissions | **data (authority guard)** |
| audit_log immutability trigger + RLS | the trail | append-only; owner-read | **data** |

### The gaps, both directions

**A surface that writes money/stock/identity and checks NOTHING beyond membership:**
- **The D-50 inventory-movement RPCs / `adjust_inventory_manual` / `count_reconcile_inventory`** gate on `is_member_of` (membership), **not** on any `has_permission`. Any active member who can reach /inventory (via `view_costs`) can move stock and reconcile counts. *Whether that is intended is a David call* — flag, not assertion. (`business_inventory` reads are `view_costs`-gated; the RPC WRITES check membership+actor, not a distinct stock permission.)
- **`orders` / `order_items` writes** — checkout is server-authoritative on price, but order *creation* checks membership scope, not a distinct "take an order" permission beyond the `qr_checkout` route gate.
- **`business_members` authority writes (#1, #8)** are owner-gated by the trigger — good — but there is **no audit row** (R6).

**A pill rendered on /team that no enforcement point consults:**
- **`apply_discount`** — rendered, gates nothing (rides `manage_orders`). D-9 fake surface.
- **`override_maintenance`** — rendered, mechanism unbuilt. D-9 fake surface.

**Where the map should live:** a standing **`docs/standards/permission-enforcement-map.md`** (sibling of `ui-control-standards.md`), regenerated/reconciled whenever a permission or a gated surface is added — with its own close-out gate. Burying it in a dated recon repeats the CAPTURE-INDEX failure (a corpus that cannot say what it contains answers "not found" with false confidence). **Named, not built — David rules on the home.**

---

## R6 — DOES A PERMISSION CHANGE LEAVE A TRAIL?

**VERDICT: No. Not one permission change — role save, per-user grant, invite creation, invite acceptance, or a direct member-row write — emits an `audit_log` row. The spine exists and even reserves the exact vocabulary (`role.permissions_changed`, `member.role_changed`), but it has ZERO writers in the entire codebase. It is the D-50 "audit_log sat empty for 23 days" scar, unhealed, on the governance surface.**

- Grep for any `audit_log` writer across `packages/shared/src`, `packages/cultivar-os/src`, and `api/` (excluding `dist/`) returns **nothing** — no `.from('audit_log')`, no `appendAudit`, no insert of `role.permissions_changed`/`member.role_changed`.
- The table is built and immutable ([20260623_audit_log_spine](../../supabase/migrations/20260623_audit_log_spine.sql)), its controlled vocabulary explicitly lists `role.created · role.cloned · role.permissions_changed · role.factory_reset · member.role_changed · member.removed · permission.self_elevation_denied` ([:82-91](../../supabase/migrations/20260623_audit_log_spine.sql#L82-L91)) — every verb for exactly this event class. **The envelope was built; the pen was never picked up.**
- Concretely: `updateMemberRole` (#1), `upsertTenantRole` (#9/#10), `deleteTenantRole` (#11), `createInvitation` (#2), `acceptInvitation` (#7), `removeMember` (#6) all write their store and emit only a `[TRACE:MEMBERCONSOLE]`/`[TRACE:PERM]` **console** line — ephemeral debug, not a durable row. The self-grant trigger RAISEs on a blocked self-elevation but writes no `permission.self_elevation_denied` row either.

**DAVID'S REQUIREMENT (recorded): every permission change records actor · subject · permission · before · after · timestamp — part of the fix, not a follow-on.** The spine already supports this shape (`actor_user_id`, `target_type='member'|'role'`, `target_id`, `detail` jsonb for old→new, `created_at`). The missing piece is the **writer inside the funnel** (R1b): the one funnel that writes `business_members.permissions` also appends the audit row in the same action — so a grant that is not recorded is a grant that did not happen.

---

## BLOCKED — claims I could not ground, and what unblocks each

**A. Exact live contents of `role_definitions` for tenant `f7ec5d67` (confirms the 14/12/3 override theory).** *(unblocks R3)*
```sql
SELECT role_key, business_id IS NULL AS is_floor, is_system,
       jsonb_array_length(permissions) AS n, permissions
FROM role_definitions
WHERE business_id IS NULL OR business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
ORDER BY is_floor DESC, role_key;
```
Expect: 3 floor rows (12/9/3) + override rows for OWNER (→14) and MANAGER (→12), STAFF none.

**B. Does `business_inventory` (and the other `view_costs` tables) carry an OWNER-scoped RLS policy independent of `has_permission`?** If NOT, the owner's 6-entry member row lacking `view_costs` would be RLS-blocked from the very tables David reads daily — implying such an owner policy DOES exist. *(unblocks the R3 owner-render safety claim and the R5b "owner path" cell)*

> ✅ **ANSWERED 2026-07-23 (David's live policy dump).** Every gated table carries an `*_owner_all`
> policy keyed on `owner_id` — `business_inventory`, `cost_objects`, `receipts`,
> `labor_resource_wages`, `business_pricing_config`, `customers` all confirmed. The owner reaches
> them by ownership, NOT by the member-row array — so rendering the OWNER role card every-pill-lit-
> and-locked from `owner_id` (ruling #3) is safe and true. This directly grounds the owner-render
> in BUILD 3 (permission funnel, ledger row 151).
```sql
SELECT tablename, polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname IN ('business_inventory','cost_objects','receipts','labor_resource_wages','business_pricing_config','customers')
ORDER BY tablename, polname;
```
Expect: a `*_owner_all` (or owner `USING owner_id = auth.uid()`) beside each `*_member_all` — confirm it exists for every gated table.

**C. Exact `business_members.permissions` for the three roles at tenant `f7ec5d67` (confirms 6/11/3 and the drift vs DEFAULT_PERMISSIONS).** *(corroborates R3/R4)*
```sql
SELECT role, user_id, active, updated_at,
       jsonb_array_length(permissions) AS n, permissions
FROM business_members
WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
ORDER BY role;
```
Confirm the manager row `updated_at = 2026-07-10 20:11:46` and that `import_pricing` is absent.

**D. Is `audit_log` empty for governance actions (0 writers proven live)?** *(corroborates R6)*
```sql
SELECT action, count(*) FROM audit_log GROUP BY action ORDER BY 1;
```
Expect: no `role.*` / `member.*` / `permission.*` rows (likely empty entirely).

**E. Does any DB trigger on `role_definitions` write `business_members`?** (Grep says no; catalog confirms.) *(corroborates R2)*
```sql
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid = 'role_definitions'::regclass AND NOT tgisinternal;
```
Expect: only `trg_role_definitions_updated_at`.

---

## PROPOSAL — the funnel, the single store, the trail (David rules; nothing settled)

**The requirement (from David's rulings):** one store at all times (#1); permissions set where they are seen — no SQL workaround shipped (#2); the owner row renders every-pill-lit-and-locked from `owner_id`, not togglable (#3); every change audited (R6 requirement).

### The single store
`business_members.permissions` stays the truth (it is what every gate already reads — changing that is a far larger blast radius). The question David rules on is **whether `role_definitions` survives as a template that PROPAGATES, or is retired.**

### The funnel — two options spanning NEED → WANT

**Option 1 — KEEP templates, ADD propagation (closest to today; smallest schema change).**
- The Roles-tab Save becomes ONE action: write the `role_definitions` override **AND**, in the same transaction, re-materialize `business_members.permissions` for every ACTIVE member whose `role` matches — via one funnel RPC (owner-authorized, `SECURITY DEFINER`, appends the audit row).
- New permission enters catalog → a mint/backfill step (the 2026-06-21 spec, finally built) writes it into the floor AND backfills default-holding roles' member rows.
- **Cost:** one new RPC + a backfill migration; the Roles tab keeps its shape; the SQL-workaround (#8) and free-hand `upsertTenantRole` cease to be authority paths because Save now always propagates. **Risk:** two writes in one action must be atomic (one RPC taking the whole plan — the D-50 "one plpgsql transaction" shape, cf. tech-debt #69).
- **Owner render (#3):** owner role card renders all-pills-lit-locked, sourced from `owner_id`; toggles disabled.

**Option 2 — RETIRE templates, EDIT member rows directly (fewest stores; David's ruling #1 taken literally).**
- Drop `role_definitions` as an authority concept. The Roles tab edits a role's permission set → the funnel writes every active member of that role directly; there is exactly ONE store and ONE representation. `DEFAULT_PERMISSIONS` collapses to seed-only defaults used at first mint.
- **Cost:** larger refactor of the Roles tab + `roleDefinitions.ts`; must define "what is a role's permission set" when zero members hold it (a defaults constant, or a slimmed catalog kept ONLY as defaults). **Benefit:** the three-store drift (R1b) is structurally gone — the number on screen IS the number the gate reads.

### The trail (both options)
The funnel RPC appends an `audit_log` row per change: `action='role.permissions_changed'` or `'member.role_changed'`, `target_type`/`target_id` = the role or member, `detail` = `{before:[…], after:[…]}`, `actor_user_id = auth.uid()`. A blocked self-elevation writes `permission.self_elevation_denied`. This is the FIRST real writer of the spine — same milestone D-50's ledger was for movements. **Recording is inside the funnel: a grant that is not audited cannot be committed.**

### The map (both options)
Stand up `docs/standards/permission-enforcement-map.md` (R5b) with its own close-out gate, so "what does the platform actually check" is answerable without reading the tree, and retire the two fake pills (`apply_discount`, `override_maintenance`) — either wire them or stop rendering them (D-9).

**Recommendation stated, not decided:** Option 1 is the smaller step and preserves the tenant-tunable-roles capability RD was built for; Option 2 best honors ruling #1's literal "one place." Both are viable; **David rules.**

---

*Recon by THUNDER · SHA 5ec4b9d · 2026-07-23 · REPORT ONLY — no code, schema, migration, or data changed.*
