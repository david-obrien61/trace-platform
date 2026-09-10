# COUNT / RECONCILE SPLIT — READ-ONLY RECON
**2026-09-10 · Thunder · READ ONLY. No code, no migration, no branch. The ruling is David's.**

**[MEASURED]** = read from the live database or executed today. **[CORPUS]** = derived from
`supabase/migrations/*.sql`. **[STATED]** = asserted by a document, not verified.

> ⚠️ **THE [CORPUS] LIMIT, ONCE:** no `SUPABASE_PAT`, and PostgREST exposes only `public`, so
> `pg_policies` is unreachable. Policy claims are what the migrations say. **Finding 2.4 of the
> 2026-09-10 permission recon proved that gap is real** — `has_permission_exact` exists live and is
> in no migration.

> ✏️ **THE PROMPT'S CITATION IS STALE, AND SO IS THE AUGUST RECON'S.** `InventoryCount.tsx:438` is
> no longer the RPC call — the file has moved under both of us. **Current line numbers are used
> throughout and were re-read today**, not copied from the prior document.

---

## ① IS #67 BUILT? IS #68 BUILT?

### #67 `blind_capture_mode` — 🔴 **NOT BUILT. Not partly. Zero.**

`grep` for `blind_capture|blindCapture` across every `.ts`, `.tsx` and `.sql` in the repo:
**zero hits** [CORPUS]. It appears in **twelve markdown files** and nowhere else — `user_stories.md`,
`CLAUDE.md`, `docs/tech-debt-log.md`, `built-inventory.md`, `RULINGS.md`, two audit docs, and the
LAWNS discovery. **It has never been anything but prose.**

### #68 session-scoped reconcile — 🔴 **NOT BUILT — but one thing moved since August, and it is worth naming precisely.**

`InventoryReconcile.tsx` now **selects** `session_id` (`:142`) and carries it into the row model
(`:51`, `:160`). **It is never read again.** Three occurrences in the whole file, no filter, no
grouping, no display. **It is plumbed and not wired** — which is a different state from the August
recon's *"no session filter exists anywhere on the page"*, and a reader checking whether #68 had
moved could easily mistake the select for the feature.

### What the reconcile screen actually does, versus what its story said

**It exists and it works — per lot, across the whole catalogue.** `:122` selects every non-archived
lot; `:141-142` reads `inventory_counts`; `:165` takes the most recent per lot. There is no queue,
no session, no submit-and-review.

⚠️ **The divergence that matters for David's use case:** the walk is **never presented for review**.
The `Counted` column is an **empty input** — the phone's number does not prefill it. Lauren's
number survives only as `prior`, used to open the ledger window, **not as a proposal she can
accept.** So "the owner reviews the walk as a unit" is not merely unbuilt at the *session* level;
it is unbuilt at the *lot* level too.

### 🔴 THE PROMPT IS RIGHT THAT MORE IS BUILT THAN EITHER OF US REMEMBERS — AND HERE IT IS

**Lightning's variance-versus-absolute concern is solved, twice over, and I confirm it against code:**

- **Apply-time delta under lock.** `20260720_inventory_movement_ledger.sql:528-531` computes
  `v_delta := p_counted_qty - v_current` **after** a `SELECT … FOR UPDATE` on the lot (`:519-522`),
  with the comment stating the case exactly: *"lock the lot so a concurrent sale cannot land between
  the read and the write. This closes recon finding #1."* **The delta is never accepted from the
  client**, and `:510-513` refuses a negative count.
- **Read-side mode already exists.** `reconcileMath.ts:43` — `export type ReconcileMode = 'baseline'
  | 'delta'` — **derived**, not chosen: `:168`, `const mode = prior ? 'delta' : 'baseline'`.

**Neither is a design risk. Both shipped.**

---

## ② WHAT COUNTING DOES TODAY, EXACTLY

**Confirmed with a corrected citation.** `commitCount` opens at **`:435`**; the apply-at-capture call
is **`:513-515`**, `fn: 'count_reconcile_inventory'`. The screen makes **three** RPC calls, not one:

| Line | RPC | Purpose |
|---|---|---|
| `:463-465` | `count_group_variant_sizes` | writes `variant_group` (identity) |
| `:513-515` | `count_reconcile_inventory` | **applies the count to on-hand** |
| `:598-600` | `count_promote_create_inventory` | creates a new (variety × size) lot |

### Is there a staging table or staged state?

**`inventory_counts` exists and is structurally an observation record — but nothing treats it as
unapplied, and it carries no marker that could.**

- **It is written AFTER the movement.** `recordCount` is defined at `:765` and called at `:637`,
  **after** the RPC at `:513`. The order is apply-then-record.
- **Its schema has no applied/staged column.** `20260626_inventory_count_sessions.sql:66-78`:
  `id · session_id · business_id · inventory_id · plant_tag_id · item_label · counted_qty ·
  was_unknown · raw_scan · counted_at · created_at`. **No `applied_at`, no status, nothing.**
  ✏️ *The prompt says `captured_at` exists — the column is **`counted_at`**. There is no
  `captured_at`.*
- 🔴 **And applied-ness is not derivable from the ledger either.** The count screen passes
  `p_source_id: sessionId` (`:520`), so the ledger row points at the **session**, not at the
  `inventory_counts` row. **There is no join key from an observation to its movement.**
  [MEASURED] the gap is already visible in live data: **29 `inventory_counts` rows against 11
  `count_reconcile` ledger rows.**

**So: there is no staging state. The table that would hold it exists, and the one column that would
make it meaningful does not.**

### SyncEngine and the Option-1 ruling — ✅ **IT LANDED**

- **The `rpc` op-kind exists.** `syncEngine.ts:143` (`async rpc(args: RpcArgs)`), enqueued at `:145`
  as an `'rpc'` envelope, drained at `:238-241` (`if (op.kind === 'rpc') … supabase.rpc(r.fn, r.args)`).
- **Net-new lots are online-only with an honest refusal.** `InventoryCount.tsx:590-594` — the
  message names the constraint in plain language: *"You're offline — … is a new size we haven't
  seen, and adding one needs a connection. Counting sizes you already have still works out here."*
- **And the delta timing is right for a dead zone.** The comment at `:511-512`: *"queued as an rpc
  op (ledger #143) — the dead-zone promise is kept, and the delta is computed when it DRAINS, which
  is the correct reading of a physical count."*

---

## ③ THE COLLISION — CONFIRMED, AND THE SEAM ALREADY EXISTS

### The reading is correct

**Both acts call the same RPC.** Count screen `InventoryCount.tsx:513-515`; desk reconcile
`InventoryReconcile.tsx:487`. **A permission placed in front of `count_reconcile_inventory` today
gates both, and Joel stops being able to count.** Confirmed.

### Can they be separated WITHOUT a new RPC? — ✅ **YES, and the August recon found this first**

> *"🔴 **The RPC(s): NOTHING NEW IS NEEDED — and this is the finding that shrinks the estimate.**
> Blind capture is the **ABSENCE** of the RPC call at capture, not a new one."*
> — `count-session-multi-pass-recon-2026-08-23.md`, Q7

**The two write paths are already distinct and already exist:**

| Act | Write path today | Gate today |
|---|---|---|
| **Capture** | `INSERT inventory_counts` (`:784`) | `inventory_counts_member_all` — **membership** |
| **Apply** | `count_reconcile_inventory` RPC | `assert_movement_actor` — **membership** |

**Today the phone does both. Blind capture is the phone doing only the first.** No new RPC, no
signature change — `count_reconcile_inventory` already accepts `p_source_id` described in its own
migration as *"the inventory_counts / session row"* (`20260720:496`).

⚠️ **ONE STRUCTURAL EXCEPTION, and it is not negotiable:** a brand-new variety has no lot to assert
against, so `count_promote_create_inventory` **must still fire at capture** or the count has no
`inventory_id` to link. The code already refuses that branch offline for exactly this reason
(`:590-594`). **So "capture writes nothing to `business_inventory`" is true for existing lots and
false for new ones.**

### What distinguishes the two acts today? — 🔴 **NOTHING THAT IS AN AUTHORISATION BOUNDARY**

Three near-misses, each real and each unusable as a gate:

1. **`p_source_id`** — the phone passes `sessionId` (`:520`), the desk passes **`null`**
   (`InventoryReconcile.tsx:490`). **It is client-supplied, so it is not an authorisation signal**
   (a caller can pass anything), and **it is backwards**: the authoritative desk act is the one
   that passes null.
2. **`ReconcileMode`** — `'baseline' | 'delta'`, **derived** from whether a prior count exists
   (`reconcileMath.ts:168`). Read-side only; never reaches the RPC.
3. **The step's RPC choice** — `buildWritePlan` emits `adjust_inventory_manual` steps for
   attributions (dead/loss/found) and one closing `count_reconcile_inventory` step
   (`reconcileMath.ts:286-301`). **That is a plan shape, not a permission.**

**The missing thing is one column:** an `applied_at` on the `inventory_counts` **row** — row-level,
not session-level, so a partial accept survives (#69's class). **That is a migration**, and it is
the piece the August recon named as R-C's subject.

---

## ④ THE THREE GATES, AND EVERY CALLER

### Gate 1 — the route

`router.tsx:252-260` wraps `/inventory`, `/inventory/count` **and** `/inventory/reconcile` in a
single `<PermissionRoute permission="inventory:read" />`. **A read string is the door onto a write
surface**, and the comment defends it as deliberate.

### Gate 2 — `assert_movement_actor`: **17 callers, 9 with no permission check** [CORPUS]

| Function | Also checks a permission? |
|---|---|
| `count_reconcile_inventory` | 🔴 — none — |
| `count_promote_create_inventory` | 🔴 — none — |
| `count_group_variant_sizes` | 🔴 — none — |
| `adjust_inventory_manual` | 🔴 — none — |
| `adjust_inventory_qty` | 🔴 — none — |
| `soft_delete_inventory` | 🔴 — none — (owner_id appears separately) |
| `record_order_event` | 🔴 — none — |
| `assign_member_role` | — none — *(owner_id-gated separately)* |
| `save_role_permissions` | — none — *(owner_id-gated separately)* |
| `create_invitation` | `team:create` |
| `reset_invitation_expiry` | `team:create` |
| `import_write_price` | `inventory:import_price` |
| `set_business_tax_rate` | `tax_rate:update` |
| `set_business_profile` | `settings:update` |
| `set_business_module_state` | `settings:update`, `subscription:update` |
| `seed_business_modules` | `subscription:update` |
| `start_module_trial` | `subscription:update` |

**Six are inventory-domain and each would need its own string** — and **David has ruled one.**
`count_reconcile_inventory` · `count_promote_create_inventory` · `count_group_variant_sizes` ·
`adjust_inventory_manual` · `adjust_inventory_qty` · `soft_delete_inventory`.

> ✏️ **A CORRECTION TO MY OWN PRIOR REPORT.** I wrote that `assert_movement_actor` *"fronts
> reconcile, promote, adjust and retire."* **Retire is not on that list.** The current retire path
> is `20260903_inventory_retire_lifecycle.sql:57-58` — two **nullable columns** (`retired_at`,
> `retired_reason`; `retired_by_run_id` added later by `20260906:50`) written by a **plain
> PostgREST update** (`itemImportWriter.ts:423`), so it is gated by `business_inventory`'s
> `inventory:update` RLS and never touches the RPC. `soft_delete_inventory` is the *older tombstone*
> path. **Two different retirements, two different gates**, and I had collapsed them.

### Gate 3 — the manifest

**The prompt's warning is accurate and I verified the mechanism.** `permissionManifest.ts:722-725`:

```ts
const status: PermissionStatus =
  typeof seed.status === 'string' ? seed.status
    : (seed.status?.[verb] as PermissionStatus | undefined) ?? 'enforced';
```

**A resource seed with no `status` key yields `'enforced'` for every one of its verbs, by default.**
`pricing_recipe`'s seed (`:436-452`) carries `category`, `verbs`, `sensitivity`, `exposure` and
`note` — **and no `status`** — so both its verbs assert enforcement they never declared.

⚠️ **Stated precisely, because the failure is subtler than "the claim was false":** a policy *does*
check `pricing_recipe:update` (`bpc_member_update`), so the declared status is literally true. What
#232 found is that the **write path is unreachable for a member anyway** — every writer upserts,
PostgREST issues `INSERT … ON CONFLICT`, and `bpc_member_insert` was dropped on purpose
(`20260727_rbac_flip_corrections.sql:85`). **`enforced` was true and useless.** Whatever is added
for reconcile should state its status explicitly **and** name the write path it governs.

---

## ⑤ WHAT COUNTING SHOULD BE GATED ON

### What gates counting today — **not `inventory:update`**

- **Route:** `inventory:read`.
- **All three RPCs:** membership.
- **`inventory_counts` / `inventory_count_sessions` inserts:** `*_member_all` policies — **membership**.

**So counting today requires `inventory:read` plus an active membership, and nothing else.** David's
grant of read + update + create works — but so would `inventory:read` alone.

### 🔴 TESTING LIGHTNING'S LEAN — AND THE REPO ALREADY DECIDED THIS, IN A MIGRATION, AGAINST IT

Lightning leans `inventory:update`: fewer strings, same resource, a verb David has already assigned.
**The reasoning is sound and the repo contradicts its conclusion**, in
`20260830c_count_group_variant_sizes.sql`, applied 2026-08-30. Its title is
*"COUNT GROUPING, RESOLVED SERVER-SIDE: a staff member can finish a walk"*, and its WHY says:

> *"It did that with a PLAIN UPDATE on `business_inventory`, which
> `20260727_rbac_resource_action_flip.sql:72-74` gates on `inventory:update`. **A STAFF member holds
> `inventory:read` and NOT `inventory:update`.**"*

and its next section answers the exact question being asked now:

> *"**WHY AN RPC AND NOT A WIDER POLICY** — Granting STAFF write access to `business_inventory` to
> fix a count screen would widen the first name on tech-debt #124's over-wide-policy list, and would
> hand a yard hand `price`, `qty`…"*

**A whole migration exists whose purpose is to let someone count while holding only
`inventory:read`.** `STAFF_DEFAULT_BUNDLE` confirms it: `inventory:read` and no other inventory
string [MEASURED, executed from the manifest].

**Therefore gating counting on `inventory:update` would reverse a decision already made in code, and
would re-break the exact defect `20260830c` was written to fix** — silently, because an RLS-refused
PostgREST update matches zero rows and returns no error.

### Does the repo suggest a separate `inventory:count`?

**Yes, indirectly, and it is already written down as owed.** `user_stories.md:823`:

> *"**NOT YET ON THE BOARD AND OWED — the role story itself:** a staff member counts and the manager
> reconciles, which needs blind capture (tech-debt #67) to be true at all, since the count screen
> applies itself at capture today."*

**Counting and reconciling are already understood as two roles.** Whether that needs a fourth string
or whether `inventory:read` + membership is the honest gate for capture is David's call — but
**`inventory:update` is the one option the repo has already argued against.**

### The double-count ruling — reported, not redesigned

🔴 **THE ADD BUTTON IS NOT IMPLEMENTED.** The conflict sheet has exactly two:
`:960` *"Use the new count (N)"* and `:963` *"Keep the first count (N)"*. `built-inventory.md:233`
agrees in its own words — **"Still NOTHING BUILT."**

⚠️ **And tech-debt #93 is still live on that sheet:** `:947` captions `conflict.prevQty` as
**"first count"**, while `prevQty` is set from `sessionCounts[key]` (`:425`), which every save
overwrites. **On a third pass it reads "first count 6" when 6 was the second.**

---

## ⑥ MY RECOMMENDATION — THE WORKFLOW FIRST, AND IT IS NOT CLOSE

### What breaks if `inventory:reconcile` is minted against today's code

**Joel stops counting.** One RPC serves both acts, so a string in front of
`count_reconcile_inventory` gates capture and desk alike. Granting Joel the new string to keep him
counting would hand him the reconcile authority the string exists to withhold — **the ruling would
enforce the opposite of itself.**

**And the string could not be tested honestly.** There is no staged state, so there is no act called
"reconcile" that is separable from "count". Minting a permission for an operation that does not yet
exist as a distinct operation is `planned`'s definition, not `enforced`'s.

### The order

**1 · Blind capture. 2 · `applied_at`. 3 · The desk queue. 4 · The string.**

The string is **last, and it is the cheapest step** — once capture no longer calls the RPC, one
`has_permission_for(p_business_id, p_actor_user_id, 'inventory:reconcile')` line inside
`count_reconcile_inventory` gives David exactly his ruling.

### The smallest change that delivers the ruling

**No new authority site. No `owner_id` gate. No new RPC. One migration.**

1. **Stop the phone applying** — `InventoryCount.tsx` `commitCount` drops the
   `count_reconcile_inventory` call on the `update`/`fill` branches; `recordCount` becomes the only
   write. **The `promote` branch keeps its RPC** (a new lot has no row to observe against).
   ⚠️ *This also removes the anchoring prefill at `:387-390`, `pickSizeChip`, which fills the qty box
   with current book on-hand — R-B's real subject, and it is a behaviour change David should see
   before it ships.*
2. **One migration: `inventory_counts.applied_at timestamptz` (nullable) + `applied_by uuid`.**
   Nullable, no default, no backfill — **every existing row is correctly "not applied" only if that
   is what we mean**, and it is not: the 29 rows today *were* applied. ⚠️ **So the backfill question
   is real and is David's** — stamp existing rows as applied, or accept that history reads as
   pending. I would stamp them, at their `counted_at`, and say so in the migration.
3. **The desk applier calls the RPC**, passing `p_source_id` = the `inventory_counts` row id (the
   parameter already exists, `20260720:496`), and stamps `applied_at`. **One author per field** —
   the applier must **not** write `inventory_count_sessions.status`, which answers *"did the walk
   finish"* and belongs to the phone. That is #71's precedent and R-C's question.
4. **Then the string**, declared with an explicit `status` block.

### Why this fits David's use case exactly

He counts A1–A3, A5 today → rows land with `applied_at IS NULL`. Tomorrow he counts A6–A22 →
more null rows. Yard worker 1 counts B1–B12 → more. Lauren opens the desk the day after →
**every unapplied row across every session and every counter is one queue**, and she accepts them
together. **The queue is `WHERE applied_at IS NULL`** — which is why the column is the load-bearing
piece and the session grouping is a nicety on top of it, not a prerequisite.

### What I would flag before any of it starts

**Three rulings are still open and two of them block this build**, per the August recon: **R-A**
(one ledger row per session, or one per pass), **R-B** (where blind-capture mode lives — and my read
is that the live data makes *always-blind* far more affordable than it looked: LAWNS has **one
in-progress session and three counts, ever** [MEASURED], so there is no installed workflow to
preserve), **R-C** (the applier's field — answered above as `applied_at`, but it is his).

---

## WHAT I AM NOT SURE OF

1. **Whether the migrations are applied.** Everything marked [CORPUS] is what the files say. There
   is an untracked `docs/audits/migration-apply-state-stage3.sql` in the tree that suggests
   apply-state is itself under investigation; I did not open it.
2. ✅ **CLOSED IN THIS PASS — AND LAWNS CLOSES EXACTLY.** [MEASURED] `count_reconcile` rows by
   tenant: **LAWNS 3, Test Dave's 8**. LAWNS has **3 counts and 3 movements — a perfect match**. The
   whole 29-vs-11 gap sits on the test tenant, where 3 `was_unknown` and 7 NULL-`inventory_id` rows
   cannot produce a movement. **No second finding hiding in it.**
   ⚠️ **But the same query surfaced something I did not go looking for and am NOT claiming as a
   defect: 445 `opening_balance` rows carry `source_type = 'inventory_count'`** — and an IMPORT is
   not a count. That is the catalogue retire-and-replace population (R-58/R-94's 447 rows), wearing
   a provenance label that says a person counted them. **Observed, not investigated.** It matters
   only if anything reads `source_type` to mean "a human walked this" — I did not check whether
   anything does.
3. **Whether `always-blind` forecloses something Lauren wants.** The August recon raised the
   spot-check case (walking with the book visible) and nobody has ruled on it. **I have no evidence
   either way** — three counts is not a usage pattern.
4. **The offline interaction of blind capture.** The `rpc` op-kind queues an *apply*. If capture
   becomes an `insert`, the dead-zone path changes shape, and I did not trace whether the offline
   queue's conflict handling behaves the same for a staged insert. **That is a real gap in this
   recon**, and it matters because counting is the one flow that genuinely happens in a dead zone.
5. ✅ **CLOSED IN THIS PASS — IT IS VESTIGIAL, NOT A PARKED ATTEMPT.** `git log -S"session_id"` on
   that file returns exactly one commit: **`6245f27` — *"feat(D-50 2B): the reconcile screen — a
   count becomes stamped, dated truth on the ledger"***, the screen's own original build. **The
   column has been selected and dropped on the floor since day one.** So #68 has not moved at all,
   and my "plumbed, not wired" phrasing in ① should be read as *"was always plumbed"* — nobody
   started the session queue and stopped.
