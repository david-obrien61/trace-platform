# Close the audit redirect — recon before the build

**Date:** 2026-09-10 · **Type:** RECON (no build, no migration, no branch) · **Build id claimed:** #289
**Close-out ledger row claimed:** #247 · **Tech-debt ids claimed:** #237–#241 · **Decisions row:** D-56 (proposed, David rules)
**Story (§9 gate — MATCH, no new story needed):** `user_stories.md:862` *"The log that proves what happened outlives the log that proves what's on hand"* — `STATUS: needs-input`, and its `NEEDS:` line is **verbatim this recon's question**: *"confirm which discretionary acts dual-write to audit_log at split time (delete is in; override / tier-change / permission-change to confirm)."* The build that lands this flips it `needs-input` → `written` in the same commit.
**Grounded in:** D-51 (event log ≠ audit log, split by retention) · `20260623_audit_log_spine.sql` · `data/grower-scan/audit-spine-recon.md` PART 2.

---

## 0. THE 2026-06-24 PART 2 REDIRECT INVENTORY — IT EXISTS, AND IT IS NARROWER THAN THE JOB

**It exists.** `data/grower-scan/audit-spine-recon.md` §PART 2 (lines 51–90), written 2026-06-24, 190 lines. It is the document the prompt is looking for. It has NOT been redone here — what follows extends it, and every place it is superseded says so.

**What it said — a three-way classification and an ordered redirect list:**

| Class | Verdict | Content |
|---|---|---|
| **A — DEBUG** | never redirect | 28 `[TRACE:*]` areas, ~550 `console.log/warn` emits. Ephemeral. Hard line, restated in STD-003. |
| **B — AUDIT-WORTHY** | redirect | **10 writers**, each with a named target action (table at §2.1) |
| **C — OPERATIONAL** | leave alone | `business_service_log`, `pmi_service_logs`, `order_compliance_records`, receipt ledger, order-status writes |

Its ordered list (§2.3): (1) `deleteTenantRole` → `role.factory_reset` · (2) `upsertTenantRole` · (3) `updateMemberRole`/`removeMember` · (4) `cost-apply` success + refusal · (5) self-elevation trigger refusal · (6) `business_modules` enablement · (7) ownership transfer · (8) document signing.

**Where it stands today — scored against live data, not memory:**

- **1, 2, 6 — DONE.** The funnel (`save_role_permissions`) and the module RPCs write them. 19 `role.permissions_changed`, 9 `role.factory_reset`, 16 `business_module.state_changed` live.
- **3 — HALF DONE, and the missing half is a hard DELETE.** `updateMemberRole` was retired 2026-07-23 into `assign_member_role` and audits (1 row). 🔴 **`removeMember` (`packages/shared/src/auth/members.ts:30-40`) is still a direct client `.delete()` on `business_members` and has never written an audit row — `member.removed` count is 0.** So is `setMemberActive(false)` (`members.ts:56`), which revokes a person's access. Both are identity/authority acts.
- **4 — GONE, not done.** The `cost-apply` endpoint the list points at (`ingest.ts:85/96`) no longer carries that shape. `cost.applied` / `cost.apply_denied` have zero rows and no writer.
- **5 — STILL OPEN, with its original caveat unsolved.** The 2 live `permission.self_elevation_denied` rows are written by `save_role_permissions`'s own owner-check branch, **not** by the `enforce_member_authority_immutability` trigger. The trigger's `RAISE` still rolls back its own audit row. Unchanged since 2026-06-24.
- **7, 8 — not built, as stated then.**

**🔴 THE STALENESS THAT MATTERS IS NOT ANY ROW — IT IS THE SCOPE.** PART 2 inventoried **governance writers only** (role · member · cost · tile). It never looked at the ~123 ordinary business writes — inventory, customers, orders, deliveries, receipts, pricing — because in June those surfaces largely did not exist. **That is the whole gap this recon adds**, and it is why the redirect looked quarter-built rather than finished: the list was completed against its own scope, and the scope grew underneath it.

---

## 1. ① THE WRITER — the premise is wrong, and that IS the finding

### There is no writer function.

**All 11 writers inline `INSERT INTO public.audit_log (...)` inside their own body.** Verified by parsing every audit INSERT in the migration corpus back to its enclosing `CREATE FUNCTION`:

| RPC | migration:line (latest definition) |
|---|---|
| `save_role_permissions` | `20260728c_funnel_no_op_short_circuit.sql:90,128,181` |
| `assign_member_role` | `20260723_permission_funnel.sql:331,366` |
| `set_business_tax_rate` | `20260727_rbac_resource_action_flip.sql:305,330` |
| `set_business_profile` | `20260727_rbac_flip_corrections.sql:40,64` |
| `set_business_module_state` | `20260802c_enable_starts_the_clock.sql:108,123,171` |
| `start_module_trial` | `20260801c_module_seed_and_trial_clock.sql:246,277,305` |
| `seed_business_modules` | `20260801c_module_seed_and_trial_clock.sql:411,468` |
| `soft_delete_inventory` | `20260720_inventory_movement_ledger.sql:765` |
| `create_invitation` | `20260828_owner_role_carries_authority.sql:324,345,390` |
| `reset_invitation_expiry` | `20260904b_reset_invitation_expiry.sql:132,165,181` |
| `edit_receipt_line_items` | `20260902_receipt_line_edit_and_vendor_preference.sql:329` |

Thirty-odd copies of the same eight-column INSERT. **A shared writer is not an optimisation for ~20 more call sites — it is the thing whose absence is already measurable.**

### The signature that would exist

The convention is settled by 8 of 10 of the ② RPCs and by every writer above: `(p_business_id, p_actor_user_id, ...)`, guarded by `public.assert_movement_actor(p_business_id, p_actor_user_id)` (`20260720:282`). A caller supplies **business, actor, action, target, detail, outcome**; a writer would derive **`actor_role`** (from `business_members`), **`created_at`**, and — see ⑤ — **the test flag**.

### 🔴 THE VOCABULARY IS NOT CONTROLLED, AND IT HAS ALREADY DRIFTED — MEASURED

`action` is **plain `text` with no CHECK, no enum, no lookup**. Live constraints on `audit_log` are exactly two: `audit_log_pkey`, `audit_log_business_id_fkey`. The 2026-06-23 migration made that a **stated, reasoned choice** (`:78-93`) — *"a documented convention + an index, NOT a CHECK constraint. A CHECK would force a migration every time a new action type is added"* — and homed the vocabulary in a `COMMENT ON COLUMN`.

Seventy-eight days later, **8 of the 12 live action names are not in that comment**:

| live action | rows | in ratified vocab? |
|---|---|---|
| `module_trial.started` | 28 | ✗ |
| `role.permissions_changed` | 19 | ✓ |
| `business_module.state_changed` | 16 | ✗ (vocab says `tile.activated` / `tile.revoked`) |
| `role.factory_reset` | 9 | ✓ |
| `settings.profile_changed` | 9 | ✗ |
| `inventory.delete` | 7 | ✗ |
| `business_modules.seeded` | 4 | ✗ |
| `permission.self_elevation_denied` | 2 | ✓ |
| `receipt.deleted_by_db_owner` | 1 | ✗ |
| `business_modules.trial_access_corrected` | 1 | ✗ |
| `business_modules.classification_corrected` | 1 | ✗ |
| `member.role_changed` | 1 | ✓ |

And the drift is not only off-list, it is **internally inconsistent**: `business_module.state_changed` (singular) beside `business_modules.seeded` (plural) — two spellings of one subject, which is the copy that goes stale.

`outcome` drifted the same way and was caught: the column comment said `success | denied`; `no_change` was added by STD-023 (#74) and **26 rows carry it**. That one was corrected in `20260728c`'s footer — *"a comment that undercounts the domain is the same class of artifact this whole week has been about."* The `action` comment has had no such correction.

**Answer to "is it complete enough for ~20 more":** it is not a vocabulary, it is a comment, and the comment is already 8-for-12 wrong. **Keep the no-CHECK decision — it is right** (a CHECK forces a migration per verb). **Replace the comment with a lookup table**: `audit_action_types(action text PK, description text)` + an FK from `audit_log.action`. Adding a verb becomes one INSERT (data, no migration — the stated goal is preserved); a typo raises at write time. This is the "controlled vocabulary" David ratified 2026-06-24, actually enforced, at the cost the original decision was protecting against — nil.

### Actor passed IN: YES, and it is already the house convention

`assert_movement_actor` (`20260720:282-308`) does exactly the three things the service-key case needs:

```
IF auth.uid() IS NOT NULL AND p_actor_user_id IS DISTINCT FROM auth.uid() THEN RAISE  -- no forgery from a client
IF p_actor_user_id IS NULL THEN RETURN;                                               -- honest system write
IF NOT public.is_member_of(p_business_id, p_actor_user_id) THEN RAISE                 -- trust-but-verify by id
```

Under the service key `auth.uid()` is NULL → the forgery pin is skipped → the passed actor is verified by membership instead. **A service-key handler can already carry the real caller's uid into an audited write with no new mechanism.** This is what makes ③ cheap.

### Failure semantics: the action fails with it — today, everywhere

Every audit INSERT sits inside the same plpgsql function as its write, so it is in **one transaction**: an audit failure aborts the business write. That is the correct default for a governance record and it is worth stating aloud, because it also means **an audit-write bug can refuse a sale.** The alternative (audit row best-effort) is defensible and is NOT what is built. No change proposed — but the shared writer should not be given an `EXCEPTION WHEN OTHERS THEN NULL` handler, ever, and that should be written on it.

### 🔴 AND THE HOLE NOTHING IN THE PROMPT ASKED ABOUT: NOBODY CAN READ IT

**There is no reader. Zero.** `grep "from('audit_log')"` across `packages/` and `api/` returns **no application code** — only two maintenance scripts. No page, no route, no tile.

Worse, the two halves of the read path contradict each other:

- **`audit_log:read` is held by four members** — `David OBrian`, `David OBrien`, `TD OBrien`, and **`Lauren Bishop`** (measured off `business_members`).
- **The RLS policy `audit_owner_read` is `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())`** — `businesses.owner_id` only.

Per #288's correction, **Lauren is an OWNER-role member but is NOT `businesses.owner_id`** — David is. So the one non-David person holding `audit_log:read` **would be refused by RLS** if a surface existed. That is tech-debt **#232**'s exact class one table over: a permission that admits nobody.

**An accountability record with no reader is not accountability.** This is the single cheapest, highest-value item in the whole program and it is not on anyone's list.

---

## 2. ② THE TEN RPCs — it is NOT the cheap group, because six of them should not get an audit row at all

**D-51 already ruled this**, and the ruling is the answer to the prompt's own ⚠️: *"State events that carry no discretion (a routine sale) write ONLY the event log. A deletion touches both: the stock left (state) and someone chose to remove it (accountability)."* The event log **already carries the actor** (`emit_inventory_movement(..., p_actor_user_id, ...)`), so an audit row on a mechanical movement duplicates the ledger and dilutes the retained log — which is exactly what D-51 split the two tables to prevent.

Scored against that ruling:

| RPC | signature has actor? | app caller | already ledgered? | verdict | action name |
|---|---|---|---|---|---|
| `adjust_inventory_manual` | ✅ `p_actor_user_id` | `inventoryEdit.ts:100` · `InventoryReconcile.tsx:483` · `importWrites.ts:126` | ✅ | 🟢 **AUDIT — discretionary**: a human overrides a number with no physical event | `inventory.adjusted` |
| `import_write_price` | ✅ | `importWrites.ts:101` | ✗ | 🟢 **AUDIT — money + gated.** Its **denied** branch is the higher-value half (returns a reason, writes nothing, records nothing) | `price.imported` / `price.import_denied` |
| `discovery_rescan_clear` | 🔴 **NO** | `populate.ts:95` | ✅ | 🟢 **AUDIT — a mass delete.** ⚠️ **BLOCKED: no actor param, no permission gate.** Signature is `(p_business_id, p_sku_prefix, p_occurred_at)`. Needs a param → DROP+CREATE or an overload | `inventory.discovery_cleared` |
| `count_group_variant_sizes` | ✅ | 🔴 **none** (only `scripts/rls/count-group-variant-sizes.rls.mjs`) | ✗ | 🟡 **AUDIT eventually** — restructures the catalog, no ledger row. Unreachable today | `catalog.variants_grouped` |
| `count_promote_create_inventory` | ✅ | `importWrites.ts:162` | ✅ `opening_balance`/`count_reconcile` | 🔴 **NO — ledger already has it, with the actor** | — |
| `count_reconcile_inventory` | ✅ | `InventoryReconcile.tsx:487` | ✅ | 🔴 **NO — a count is a state event.** (An *attributed variance acceptance* would be; that is not what this RPC is) | — |
| `adjust_inventory_qty` | ✅ (defaults NULL) | `api/orders/submit.ts:119` | ✅ | 🔴 **NO — mechanical decrement driven by an order** | — |
| `record_order_event` | ✅ (defaults NULL) | `api/orders/submit.ts:155` | it **is** an event store | 🔴 **NO — this is the event log** | — |
| `discovery_create_inventory` | 🔴 no | 🔴 **none** | ✅ | 🔴 **NO — service-key catalog birth at qty 0, not reachable** | — |
| `link_vendor_preference` | 🔴 no (no business_id either) | 🔴 **none** | ✗ | 🟡 low, defer | — |

**So: 2 land now (`adjust_inventory_manual`, `import_write_price` + its denial), 1 lands with a signature change (`discovery_rescan_clear`), 1 is unreachable, and 6 should stay out by ruling.** Answering the prompt's question directly — **no, it is not the cheap group; it is mostly the group that is already done correctly by the event log.**

---

## 3. ③ THE TWO SERVICE-KEY HANDLERS — one variable, and it is already in scope

### `api/orders/submit.ts` — **zero new plumbing. The identity is already in a variable at every mutation site.**

`resolveCallerUid` (`packages/shared/src/auth/callerPermission.ts:178`) is already imported (`submit.ts:5`) and already resolved into a named actor at every write:

- `:1100` `checkoutActor` → `:1107` decrement, `:1117/:1125/:1131` order events
- `:1430` `editActor` → `:1434` · `:1441`
- `:1546` `deleteActor` → `:1554` · `:1562`
- `:1610` `statusActor` → `:1636` · `:1654` · `:1679`

**Confirmed: one variable, and it already exists.** An audit write here is a call, not a refactor.

### `api/qbo/router.ts` — one line per route, or better, one function

`refuseUnlessOwner(auth, businessId, area, res)` (`:869`) runs `callerHoldsOwnerAuthority(auth, businessId)` on the **real session** at the top of all eight ingest routes (`:883, :940, :1006, :1033, :1097, :1126, :1218, :1281`). **Confirmed as the prompt states.** It returns a boolean and discards the uid.

**Cost: change `refuseUnlessOwner` to return `string | null` (the uid) instead of `boolean`** — one function body, eight call sites, no behaviour change. That is the whole plumbing cost for both the `businesses` writes (`:293, :338, :469`) and `business_accounting_secrets` (`:115, :232`).

### 🔴 THE IMPORTS — the highest-value audit row in the whole program, and it is currently unwritable

Live, measured: `business_inventory` **647 of 1,225 rows carry `import_run_id`, 1 distinct run**; `customers` **1,936 of 1,990, 1 distinct run**. `orders` has **no `import_run_id` column at all**.

The undo routes (`items-undo`, `customers-undo`, `books-undo`) **DELETE those rows**. The `import_run_id` is a column *on the rows*, so after an undo **the only record that ~2,580 rows ever existed is gone with them.** No row anywhere says a run happened, who ran it, how many it wrote, or that it was reversed.

**`import.run_started` / `import.run_undone`, with counts and the run id in `detail`, is the single audit row whose subject is a mass mutation that erases its own evidence.** It belongs before go-live regardless of what else does.

---

## 4. ④ THE CLIENT WRITES — measured at 34 tables and ~123 sites, and the answer is B

### The real number

Not the nine surfaces the prompt names. Scanning `packages/cultivar-os/src` + `packages/shared/src` for `.from('<table>')` followed within 160 chars by `.insert|.update|.upsert|.delete` (tests excluded):

**34 distinct tables · ~123 write sites.** Biggest: `business_inventory` 14 · `cost_objects` 14 · `customers` 13 · `business_members` 8 · `businesses` 8 · `deliveries` 7 · `member_devices` 6.
(Full site-by-site list reproducible: `node scripts/…` — the scan is 20 lines and belongs in the build as the cap's corpus, see #241.)

Three of the 34 are not live tables (`business_operations_config`, `production_plans`, `production_plan_lines` — repo-only). Of the 31 that are, **28 carry `business_id`**; the three that do not are `businesses` (use `id`), `order_items` (join `orders`), and `people` (the cross-tenant person spine — genuinely has no tenant).

### 🔴 The architecture already forbids route A's naive cousin

`permissionManifest.ts:204` and `:599-609`: *"`audit_log:create` takes NO ENTRY (spec §3): audit rows are written ONLY inside the funnel/RPCs as a side effect of an audited action. No member ever holds it. It is a SYSTEM WRITER."*

So **a client writing its own audit row is already ruled out**, and the app never does it (zero `.from('audit_log').insert(` in application code — confirmed). ⚠️ **This supersedes the 2026-06-23 migration header's stated "AUTHOR MODEL: client-side INSERT (accountability-grade)"** — the author model changed by practice between June and July and the migration header still says the old thing. Recorded as tech-debt **#237**, not fixed here.

### Route A — RPC per write path

**Cost, honestly:** `save_role_permissions` and `edit_receipt_line_items` are what one of these looks like finished — each was most of a build. Nine surfaces at that grain is **weeks, not days**, and it changes every screen it touches, in demo week.

**What breaks:** every converted surface loses its optimistic PostgREST error shapes and gains an RPC return contract; `customers` and `business_inventory` each have 13–14 sites across 4–5 files, so "one RPC per table" means reconciling field lists that have drifted (`write-paths-baseline.json` already tracks 33 tables' worth of exactly this).

**What it buys:** a real verb — `inventory.price_changed`, not `row.updated`.

### Route B — a trigger per table

**Precedent is strong and local.** 31 non-internal triggers already run on `public`, including RAISE guards (`trg_business_members_authority_guard`, `vendors_preference_owner_only`) and a snapshot guard (`trg_receipts_snapshot_and_line_guard`). One generic `audit_row_change()` + one `CREATE TRIGGER` per table.

**What it costs, named honestly — the work is not the trigger, it is the WHEN clause:**

- 🔴 **A bare trigger on `businesses` fires on the hourly QuickBooks token refresh.** `packages/shared/src/quickbooks/refresh.ts:49` and `:63` UPDATE `businesses` on every refresh. Un-scoped, that is machine noise burying every real act. **Every trigger needs a column-scoped `WHEN (OLD.col IS DISTINCT FROM NEW.col OR …)` clause, and deciding which columns are accountability-relevant, per table, IS the labour.**
- **Service-key writes give a NULL actor**, because `auth.uid()` is NULL. **Fixable, with existing precedent**: the handler does `set_config('trace.actor', uid, true)` and the trigger reads `current_setting('trace.actor', true)`. The pattern is already in the corpus — `trace.authority_funnel`, set at `20260728c:135`, read at `20260723_permission_funnel.sql:152`. One line per handler, and ③ says the uid is already in scope at every one.
- **The vocabulary degrades exactly as Lightning said**: `inventory.row_updated` + a column list, not `inventory.price_changed`.
- ⚠️ **Not proven, only reasoned:** that a SECURITY DEFINER trigger owned by `postgres` writes to `audit_log` past the `REVOKE UPDATE, DELETE` and the `audit_insert` WITH CHECK. It should — DEFINER bypasses RLS and INSERT was never revoked — but per §6 r19 *a check nobody has watched work is a claim.* **First task of the build: make it fail once, deliberately.**

### 🔴 WHICH I WOULD DO, AND WHERE I DIFFER FROM LIGHTNING

**B for coverage, A for the acts that matter — agreed. But I would convert ZERO screens to RPCs before go-live**, and the measurement is why: the acts that matter are *already* RPCs (the 11), or already have the identity threaded (③'s handlers), or are the two from ②. **Route A's remaining scope before go-live is empty.**

**And on coverage, B is not merely cheaper — it is the only one of the two that covers what is actually there.** Route A covers callers who go through the RPC. The 123 direct `.from().update()` sites are, by definition, the callers who do not. B fires on a client write, a service-key write, **and a hand-run SQL edit in David's own dashboard.**

The clinching case is `business_members`:

- `removeMember` (`members.ts:35`) — a **hard DELETE** of a person's membership. Zero audit rows, ever.
- `setMemberActive(false)` (`members.ts:69`) — revokes access. Zero audit rows.
- `Profile.tsx:544`, `acceptInvitation.ts:149`, `pinReset.ts:52,107` — five more direct UPDATEs.

**Route A needs three-to-five new RPCs to cover that table. Route B needs one trigger.** And a DELETE is precisely the write A is worst at, because there is no returning row to hang a contract on.

### ⚠️ THE HAZARD, ANSWERED PLAINLY

*"A client that writes its own audit row can lie or skip it."* **True, and it is not the situation.** No client writes audit rows and the permission model forbids it.

**Does A close it?** Yes — the row lands inside a SECURITY DEFINER function in the same transaction, so a caller cannot skip the audit without skipping the write. **But only for callers who use the RPC.**

**B closes it harder**, because the trigger is on the table, not on the path — nothing that reaches the row can miss it. **The residual under B is different and should be named:** a trigger records *what* changed, not *why*, and it cannot record a **denied** attempt (a refused write produces no row to trigger on). Denied events — `price.import_denied`, `permission.self_elevation_denied`, the QBO `OWNER_ONLY` 403 — are **A-only, forever**. That, not coverage, is the real division of labour between the two routes.

---

## 5. ⑤ THE `test = true` FLAG — it rides along, and under B it is one expression

**Measured:** `detail ? 'test'` is present on **0 of 98** audit rows. Test mode is `isTestMode(qbo_writes_enabled)` (`packages/shared/src/business-logic/testMode.ts:51`) — derived from the stored per-business `businesses.qbo_writes_enabled`, *"and nothing else — not a URL parameter, not an env var, not a React state."*

**All three live businesses are `qbo_writes_enabled = false` — including LAWNS.** So every one of the 29 audit rows attributed to LAWNS Tree Farm is a test-mode act, and none of them says so.

**Cost:** in **route B, essentially zero** — one lookup inside the one generic trigger function, stamping `detail` with `NOT COALESCE(b.qbo_writes_enabled, false)`. In route A it would be an edit at every writer. **That is itself an argument for B.** In the shared `write_audit` from ①, it is likewise one expression, derived, never passed by the caller.

⚠️ **One divergence to state:** `isTestMode` reads *unknown* as test (fail-safe, because `undefined` means the row was not read). A trigger reads the column directly and can never be unknown, so the two cannot disagree — but that reasoning should be written on the function, not rediscovered.

---

## 6. 🔴 THE SEQUENCED PLAN

### BEFORE LAWNS GOES LIVE — six items, **6.5 days**

Ruthless test applied: *if LAWNS disputes something in month three, what question must be answerable?* Anything that does not serve that is below the line.

| # | Item | Days | Why it is above the line |
|---|---|---|---|
| **B1** | **`public.write_audit(...)` + `audit_action_types` lookup + FK.** One SECURITY DEFINER writer, vocabulary enforced by FK, `actor_role` and the ⑤ test flag derived. The 11 existing writers are **not** retro-fitted in this pass (they work; touching 30 INSERTs is the drift the gate exists to catch) — they convert opportunistically. | 1.0 | Without it, ~20 new call sites are ~20 new chances to drift, and the drift is already measured at 8-of-12. |
| **B2** | **The reader + the RLS fix.** An owner-gated `/audit` page reading the trail, and `audit_owner_read` widened to `owner_id = auth.uid() OR has_permission(business_id,'audit_log:read')`. | 1.0 | 🔴 **The one I would refuse to cut.** Today there is no reader at all, and the only non-David holder of `audit_log:read` would be refused by the policy. Everything else in this plan is theatre without it. |
| **B3** | **Triggers on ten tables**, each with a column-scoped `WHEN`: `business_inventory` · `customers` · `orders` · `order_items` · `deliveries` · `business_pricing_config` · `business_members` · `businesses` · `receipts` · `cost_objects`. Plus the `set_config('trace.actor', …)` read. | 2.0 | This is the coverage. `business_members` alone closes `removeMember`'s hard DELETE, open since the 2026-06-24 list. |
| **B4** | **Service-key actor + the import rows.** `refuseUnlessOwner` returns the uid (8 sites); `submit.ts` uses the variables it already has; `import.run_started` / `import.run_undone` with counts. | 1.0 | The only mass mutation that erases its own evidence. 2,580 rows today. |
| **B5** | **The ⑤ test flag**, folded into B1 and B3. | 0.25 | Free now, a second pass later, and LAWNS's 29 existing rows are all unmarked test acts. |
| **B6** | **The cap.** A `verify` check that fails the build when a table gains a client write path and has no audit trigger and no declaration — self-pruning, in `r-b2-wired-since-declarations.json`'s shape (#228). Plus the owner-test board. | 1.25 | 🔴 **This is the difference between "closed" and "closed until the next surface."** The 2026-06-24 list was complete against its scope and rotted because nothing watched the scope grow. Without B6 this recon gets written again in November. |

**Deliberately NOT before go-live, and why:** every screen→RPC conversion (changes what a customer sees in demo week, for a verb refinement); the other ~21 tables' triggers (`member_devices`, `positions`, `social_drafts`, `campaign_posts`, `service_offerings` — none answers a month-three dispute); retention and hash-chaining (D-51 says the schema is already ready, so they are additive later by design).

### AFTER — named so it is not lost

1. **A-route verbs for the acts that deserve one** — upgrade `inventory.row_updated` → `inventory.price_changed` / `customer.tier_changed`, starting with price and tier.
2. **The remaining ~21 client-written tables' triggers.**
3. **② 's three:** `adjust_inventory_manual` → `inventory.adjusted`; `import_write_price` → `price.imported` **+ `price.import_denied`**; `discovery_rescan_clear` → `inventory.discovery_cleared` (needs the signature change).
4. **Denied events — the A-only class.** `permission.self_elevation_denied` from the *trigger* rollback path is still unsolved from 2026-06-24 (the `RAISE` rolls back its own row; needs an out-of-transaction write or a client-catch POST). The QBO `OWNER_ONLY` 403. The cost-wall refusal, whose original endpoint no longer exists.
5. **Retro-fit the 11 inline writers onto `write_audit`,** and correct the `action` column comment / the migration header's stale author model (#237).
6. **`people` and the cross-tenant tables** — no `business_id`, needs a ruling on where a person-spine act is audited.
7. **`link_vendor_preference` · `count_group_variant_sizes` · `discovery_create_inventory`** — no callers; audit when wired.
8. **Retention policy + hash-chaining** (D-51 §"Retention mechanisms" — additive, schema already ready).
9. **Ownership transfer · document signing** (7 and 8 from the original list; still not built).

---

## 7. WHAT I AM NOT SURE OF — named, not buried

1. 🔴 **Whether a per-ROW trigger is right at import volume, and it changes B3's shape.** One `items-ingest` run wrote 647 `business_inventory` rows; a row trigger writes 647 audit rows against a table D-51 says is *low-volume and retained for years*. The alternatives are a statement-level trigger, or suppressing the row trigger during an import and letting B4's single `import.run_started` row carry the run. **I have not measured which David wants, and it is the biggest open shape in the plan.**
2. **The `WHEN`-clause column lists are estimated, not enumerated.** I proved the noise exists (`refresh.ts:49,63` on `businesses`) and I have not walked all ten tables deciding which columns are accountability-relevant. That enumeration *is* B3's 2 days; if it is wider than I think, B3 grows.
3. **Not proven that a DEFINER trigger writes past `REVOKE`/RLS on `audit_log`** — reasoned only. §6 r19: make it fail once first.
4. **Whether D-51's "no discretion" exclusion should also cover QBO import reconciliation UPDATEs** on `customers`/`orders` (`customerImportWriter.ts:323`, `historyOrderWriter.ts:804`). Those are machine writes with a NULL actor and would be noise under B3 — but they are also exactly the writes that changed 1,936 customer rows. **I lean toward including them and letting B4's run row give them context; David may disagree.**
5. **Day counts are builder estimates, not measured against comparable builds.** B3's 2 days is the one I trust least, for reason (2).
6. **I did not verify that all 8 `refuseUnlessOwner` call sites are the complete set of write routes in `qbo/router.ts`** — I matched on the guard, not on the writes. If a write route exists without the guard, that is a bigger finding than this recon's subject.

---

## 8. BOOKKEEPING CLAIMED (one line each — David overrides, then move on)

- **Build id #289** · **close-out ledger row #247** (ledger currently ends 246) · **§3 entry** written at close-out, archiving #286 (oldest of three).
- **Tech-debt #237** — 🟡 the audit spine's migration header states an author model ("client-side INSERT") that the permission manifest superseded in July; two records, one subject.
- **Tech-debt #238** — 🔴 `audit_log` has **no reader**: zero application code selects it, `audit_log:read` is held by four members, and `audit_owner_read` admits only `businesses.owner_id` — so Lauren holds a permission the policy refuses. #232's class, one table over.
- **Tech-debt #239** — 🟡 the `action` vocabulary drifted: 8 of 12 live action names are absent from the ratified `COMMENT ON COLUMN`, with singular/plural inconsistency (`business_module.` vs `business_modules.`). The `outcome` comment got its correction in `20260728c`; `action` never did.
- **Tech-debt #240** — 🔴 `removeMember` (a hard DELETE of a membership) and `setMemberActive(false)` (revoking access) have **never** written an audit row; `member.removed` count is 0. Item 3 on the 2026-06-24 redirect list, half-closed and recorded as closed.
- **Tech-debt #241** — 🟡 nothing counts client write paths against audit coverage; the write-path cap tracks 33 tables and says nothing about auditing. B6 is its fix.
- **Decisions row D-56 (proposed):** *"The audit redirect is closed by TRIGGERS for coverage and RPCs for denied events — a trigger cannot record a refusal."* David rules; if accepted it extends D-51.
- **Story:** `user_stories.md:862` flips `needs-input` → `written` in the build commit, with the discretionary-act list from §2 filled into its `NEEDS:`.
- **Owner-test board (new): `docs/owner-tests/audit-trail-full-surface-test.md`** — every card names **WHO** can run it and **WHICH TENANT**, per the prompt: Cards 1–4 David-on-Test-Dave's (writer, vocabulary refusal, trigger fires, test flag); Card 5 **David-on-LAWNS, read-only** (the `/audit` page renders his own real trail); Card 6 **Lauren-on-LAWNS** (she holds `audit_log:read` — does the widened policy admit her?); Card 7 **Joel-on-LAWNS** (MANAGER, holds nothing — must be refused); Card 8 David-on-Test-Dave's (`removeMember` writes `member.removed`); Card 9 David-on-Test-Dave's (import run + undo both leave a row). All `owed`; Thunder sets none `covered`.
- **Constraints respected:** no migration written or applied · no branch · `api/` untouched at **12/12** (verified `find api -name '*.ts' | wc -l` = 12; **the plan mints no function**) · LAWNS read-only throughout — every live query in this recon was `SELECT`.
