# THE PERMISSION VOCABULARY — READ-ONLY RECON
**2026-09-10 · Thunder · READ ONLY. No code, no migration, no branch. The ruling is David's.**

Provenance marks are load-bearing.
**[MEASURED]** = read from the live database today. **[CORPUS]** = derived from `supabase/migrations/*.sql`.
**[STATED]** = asserted by a document, not verified. An unmarked claim is [CORPUS].

> ⚠️ **THE LIMIT OF [CORPUS], SAID ONCE AND MEANT THROUGHOUT.** There is no `SUPABASE_PAT`, and
> PostgREST exposes only the `public` schema — `pg_policies` returns
> `PGRST205 Could not find the table 'public.pg_policies'` [MEASURED]. **So every policy claim is
> what the migration corpus says, not what the database holds.** A policy altered by hand in the
> dashboard is invisible to me. **This is not hypothetical: see finding 2.4 — an authorisation
> function exists live that appears in no migration.**

---

## ① THE FULL VOCABULARY, AS IT ACTUALLY IS

**63 strings · 25 resources · 7 verbs.** Derived by executing `PERMISSION_MANIFEST` rather than
reading it, because it is built by `buildManifest()` and a transcription would be my summary of it.

| Verb | Count |
|---|---|
| `read` | 22 |
| `update` | 18 |
| `create` | 12 |
| `delete` | 7 |
| `apply` | 2 (`tax_exempt:apply`, `order_discount:apply`) |
| `import_price` | 1 |
| `override` | 1 (`maintenance:override`) |

**Status:** `enforced` 56 · `planned` 3 · `declared-unwired` 3 · `derived` 1.
**Sensitivity:** `operational` 44 · `confidential` 12 · `owner-only` 7.

### The resource × verb matrix

```
RESOURCE                    READ CREATE UPDATE DELETE  other
audit_log                    ✓     ·     ·     ·
campaigns                    ✓     ✓     ✓     ·
costs                        ✓     ✓     ✓     ✓
customers                    ✓     ✓     ✓     ·
deliveries                   ✓     ✓     ✓     ·
deliveries.route             ✓     ·     ✓     ·
inventory                    ✓     ✓     ✓     ✓     import_price
inventory_ledger             ✓     ·     ·     ·
maintenance                  ·     ·     ·     ·     override
margin                       ✓     ·     ·     ·
order_compliance_records     ✓     ✓     ✓     ·
order_discount               ·     ·     ·     ·     apply
order_items                  ✓     ✓     ✓     ✓
order_service_selections     ✓     ✓     ✓     ✓
orders                       ✓     ✓     ✓     ✓
pmi                          ✓     ·     ✓     ·
pricing_recipe               ✓     ·     ✓     ·
reports                      ✓     ·     ·     ·
service_offerings            ✓     ✓     ✓     ·
settings                     ✓     ·     ✓     ·
subscription                 ✓     ·     ✓     ·
tax_exempt                   ·     ·     ·     ·     apply
tax_rate                     ✓     ·     ✓     ·
team                         ✓     ✓     ✓     ✓
wages                        ✓     ✓     ✓     ✓
```

### 🔴 THE QUESTION DAVID'S EXAMPLE TURNS ON — ANSWERED PLAINLY

**THERE IS NO `inventory:reconcile`. THERE IS NO RECONCILE VERB ANYWHERE IN THE VOCABULARY.**
A scan of all 63 strings for `reconcile|count|approve|undo|send|invoice|export|void|refund|retire|adjust|transfer`
returns exactly one hit, and it is `order_discount:apply` — a substring accident, not a match.

**So the delegation David describes cannot be expressed. But the finding is worse than that, and it
is the single most important line in this document:**

🔴 **JOEL CAN ALREADY RECONCILE, AND HE COULD BEFORE ANYONE PROMOTED HIM.**

Three facts, each measured or cited, that compose into it:

1. **The reconcile screen is gated on `inventory:read`.**
   `packages/cultivar-os/src/router.tsx:252-260` —
   `<Route element={<PermissionRoute permission="inventory:read" />}>` wraps `/inventory`,
   `/inventory/count` **and** `/inventory/reconcile`. The comment above it is candid about the
   choice: *"The desk RECONCILE surface — same VIEW_COSTS gate as /inventory and /inventory/count,
   deliberately: it reads and writes the same stock, so a second, looser door onto the same numbers
   would be the gap route-entry enforcement exists to close."*
   **A READ string is the door onto a WRITE surface.**

2. **The RPC behind it checks membership and nothing else.**
   `count_reconcile_inventory` (`20260720_inventory_movement_ledger.sql:489`) opens with
   `PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);` and that function
   (`:282`) contains exactly two clauses — an anti-forgery check that the actor is `auth.uid()`,
   and `IF NOT public.is_member_of(p_business_id, p_actor_user_id) THEN RAISE EXCEPTION`.
   **`is_member_of` is `owner_id = user` OR `an active business_members row`.** No permission is
   consulted. `count_reconcile_inventory` is defined in exactly one migration [CORPUS], so there is
   no later redefinition that adds one.

3. **It is `SECURITY DEFINER`, so RLS never runs.** The `business_inventory` member policies —
   which *do* check `inventory:update` — are bypassed entirely on this path.

**Therefore:** granting Joel `inventory:read` opens the reconcile screen; the reconcile itself
requires only that he be an active member. `inventory:update` and `inventory:create` are not what
lets him reconcile, and removing them would not stop him.

---

## ② WHICH STRINGS ARE REAL

Three enforcement layers exist, and they are genuinely different mechanisms:

- **POLICY** — RLS on a table. The only enforcement for anything the client touches directly,
  because `supabase-js` speaks to PostgREST with the user's JWT.
- **HANDLER** — `api/` functions writing with the service key, which bypasses RLS, so they prove
  the caller's authority independently via `callerHoldsPermission` (`callerPermission.ts`).
- **CLIENT** — `can()` in `BusinessProvider.tsx:760` and `<PermissionRoute>` in `router.tsx`.

### 2.1 The policy layer — 161 live policies across 60 tables [CORPUS]

| Gate | Policies |
|---|---|
| A permission string | **74** |
| `owner_id` only | **59** |
| Membership only | **21** |
| `USING(true)` — open | **3** |

The three open ones are `modules.authenticated_select_modules`, `plants.anon_select_plants`,
`addons.anon_select_addons` — the first two are the public QR-scan path and are deliberate
(tech-debt #32 tracks the third).

**The 21 membership-only policies are the ones that matter to David's model**, because on those
tables *every active member has full access regardless of their array*:

```
business_assets              business_assets_member_all          (ALL)
business_inventory_ledger    business_inventory_ledger_member_all(ALL)
business_pmi_schedule        business_pmi_schedule_member_all    (ALL)
inventory_counts             inventory_counts_member_all         (ALL)
inventory_count_sessions     inventory_count_sessions_member_all (ALL)
business_discovery_profiles  business_discovery_profiles_member_all
business_display_standards   business_display_standards_member_all
vendors                      _member_insert / _member_select / _member_update
vendor_aliases               _member_insert / _member_select
business_context             business_context_member_read
business_modules             business_modules_member_select
business_operating_days      business_operating_days_member_select
business_positions           business_positions_member_read
business_position_responsib. bpr_member_read
businesses                   businesses_member_select
role_definitions             rd_read
member_devices               md_self          (self-scoped — correct)
member_device_handoffs       mdh_self_insert  (self-scoped — correct)
```

⚠️ **`vendors` uses a fourth membership idiom** — an inline
`EXISTS (SELECT 1 FROM business_members WHERE … active = true)`
(`20260902_vendor_identity_and_preference.sql:397-400`) rather than `is_active_member()`. Four
spellings of one concept is STD-011's shape in the policy layer.

### 2.2 The function layer — 40 functions, 10 check a permission [CORPUS]

**23 call sites across 16 migrations call `assert_movement_actor`, i.e. gate on membership only.**

Functions that **do** check a permission string:
`get_business_tax_rate` (`tax_rate:read`) · `set_business_tax_rate` (`tax_rate:update`) ·
`set_business_profile` (`settings:update`) · `set_business_module_state` (`settings:update`,
`subscription:update`) · `seed_business_modules` + `start_module_trial` (`subscription:update`) ·
`import_write_price` (`inventory:import_price`) · `create_invitation` + `reset_invitation_expiry`
(`team:create`).

Functions that write and check **no** permission — membership or `owner_id` only:
`count_reconcile_inventory` · `adjust_inventory_qty` · `adjust_inventory_manual` ·
`count_promote_create_inventory` · `count_group_variant_sizes` · `soft_delete_inventory` ·
`record_order_event` · `link_vendor_preference` · `assign_member_role` · `save_role_permissions`.

✅ **THREE FUNCTIONS I INITIALLY LISTED HERE ARE NOT HOLES, AND THE CHECK THAT CLEARED THEM IS
WORTH RECORDING.** `edit_receipt_line_items` is **owner-gated** by an inline
`EXISTS (SELECT 1 FROM businesses WHERE id = v_receipt.business_id AND owner_id = v_actor)` — a
fourth idiom my scanner did not match. `discovery_create_inventory` and `discovery_rescan_clear`
carry `REVOKE ALL … FROM public, anon, authenticated` and are **service-key only**, so no client
can reach them at all. **Grants matter as much as bodies, and reading one without the other is how
a scanner reports a hole that is not there — or misses one that is.**

> ✏️ **A CORRECTION TO MY OWN WORK, RECORDED RATHER THAN QUIETLY FIXED.** My first scanner reported
> that **one** function of 40 checked a permission. That was wrong — the regex required the
> permission literal to sit in a particular argument position, and every `has_permission_for(a, b,
> 'string')` call fell outside it. Re-run with a looser match plus negative controls, the answer is
> ten. **This is #182's class inside this recon** — a scanner that cannot reach the thing reports
> the same as one that found nothing. It is why the numbers above were each re-derived a second way.

### 2.3 The three layers disagree about the owner — and one still short-circuits

The 2026-07-30 ruling removed the owner branch from two of the three layers, and the comment
recording it is unusually clear (`BusinessProvider.tsx:761-773`):

> *"🔴 THE OWNER SHORT-CIRCUIT IS DELETED (ruling 2026-07-30). It read: `if (isOwnerActive) return
> true;` … the short-circuit made the client MORE permissive than the server, and the gap was
> invisible precisely because the owner never hit it."*

`has_permission_for` (`20260730c:34`) likewise: *"NO OWNER BRANCH (ruling 2026-07-30). An owner is
an active member holding the string, like everyone else."*

🔴 **THE SERVER HANDLER LAYER NEVER GOT THE RULING.** `callerPermission.ts:163-170`:

```ts
export async function callerCan(authHeader, businessId, perm) {
  if (await callerIsBusinessOwner(authHeader, businessId)) return true;
  return callerHoldsPermission(authHeader, businessId, perm);
}
```

and `api/orders/submit.ts:41-42` and `:49-50` each repeat that shape inline. **So a person who is
`businesses.owner_id` passes every handler gate without holding the string** — the exact inversion
the ruling was written to end, surviving in the layer nobody re-checked.

### 2.4 🔴 AN AUTHORISATION FUNCTION EXISTS LIVE AND IS IN NO MIGRATION

`has_permission_exact` — David applied it by hand on 2026-09-09.

- `grep -rn "has_permission_exact" supabase/migrations/ packages/ api/` → **zero hits** [CORPUS].
- `POST /rest/v1/rpc/has_permission_exact` → **HTTP 200**, returns `false` (correctly — `auth.uid()`
  is NULL under the service key) [MEASURED]. Control: the same probe against `has_permission_for`
  returns `PGRST202 … no matches were found in the schema cache` for the wrong parameter names, so
  the probe demonstrably distinguishes existence from absence.

**It is real, it is live, and nothing we own can see it.** `verify-universals.mjs` reads repo `.sql`,
not the catalog. This is tech-debt #178's shape inverted: there, types declared tables that do not
exist; here, the database holds an authorisation primitive the repo has never heard of.

### 2.5 The alias layer is inert — verified in both directions

- **No live member array holds a legacy string.** 8 member rows, 3 tenants, 57 distinct strings
  held, **zero without a colon** [MEASURED].
- **No surviving policy checks a legacy string.** Re-run with a *wide* regex that captures any
  quoted literal handed to `has_permission*`, colon or not: **0 of 161** [CORPUS]. (The narrow
  regex would have been blind to exactly this, so it was re-derived.)
- **No live handler or client gate checks one.** The three apparent counter-examples are not:
  `router.tsx:255,261`, `BusinessAssets.tsx:23` and `InventoryImport.tsx:3` mention `VIEW_COSTS`
  **only in comments** (the real gates are `costs:read` / `inventory:read`), and
  `api/orders/submit.ts:23` declares its own local `const APPLY_TAX_EXEMPT = 'tax_exempt:apply'`
  which **shadows** the legacy import.

⚠️ **One residual, small and real:** `api/discovery/ingest.ts:79-80` checks `'costs:read'` at `:77`
but returns `forbidden: ${VIEW_COSTS} required` — **a 403 that tells the user to obtain a retired
string.** Surface-Honesty defect, one line.

---

## ③ WHERE THE VOCABULARY DOES NOT MATCH THE JOB

The manifest was written against a spec (`docs/resource-action-permission-spec.md` v3, 2026-07-26),
not against a watched shift. It shows in a consistent direction: **the vocabulary is table-shaped,
and the work is operation-shaped.**

**Operations that exist in the product with NO string:**

| Operation | Where it lives | What actually gates it |
|---|---|---|
| **Reconcile a count** | `count_reconcile_inventory` | membership |
| **Promote a count into a new lot** | `count_promote_create_inventory` | membership |
| **Group variant sizes** | `count_group_variant_sizes` | membership |
| **Manual qty adjustment** | `adjust_inventory_manual` / `adjust_inventory_qty` | membership |
| **Retire / tombstone a lot** | `soft_delete_inventory` | membership + `owner_id` |
| **Write an invoice to QuickBooks** | `api/qbo/invoice/cultivar.ts` | no permission string |
| **Connect / disconnect QuickBooks** | `api/qbo/router.ts` | `callerHoldsOwnerAuthority` (role, not string) |
| **Undo an import** | — | *does not exist as an operation* |

**Strings that exist for operations nobody performs:** `campaigns:create` (`declared-unwired`, and
the manifest is explicit about why it is not `planned`: *"the next verb is obvious" is not a scoped
build*) · `team:update` / `team:delete` (`declared-unwired`; tech-debt #90 has wanted them removed
since 2026-07-31) · `reports:read`, `maintenance:override`, `deliveries.route:update` (all `planned`,
none built).

**Retire vs delete** — asked about specifically, and the answer is that the distinction is already
lost in the data, not just the vocabulary. Tech-debt #192: `soft_delete_inventory` writes
`status='deleted'`, which is not in `ALL_STATUS_VALUES`, so the tombstone state cannot be selected
in the grid filter. Tech-debt #71: one `status` column has two authors, so a deleted lot reads
`depleted`.

**Read the LIST vs read the COST on the same row** — this one is *already* the reason `costs` is a
separate resource from `inventory`, and it is a genuine architectural constraint rather than an
oversight. See ⑤'s last section: RLS is row-level, and this is a column-level question.

---

## ④ THE NON-UNIFORM CASES — DELIBERATE OR NOT

**`pricing_recipe` READ + UPDATE with no create is deliberate and recorded**, and the record is
`20260727_rbac_flip_corrections.sql:75-85`, which both states the reasoning and acts on it:

> *"Spec §3 gives `pricing_recipe` READ + UPDATE only — no create verb is mintable. The flip's §1.7
> nevertheless created an INSERT policy gated on `pricing_recipe:update`, which is capP assertion 5
> exactly: a permission named `update` granting a create. … DROPPED rather than minting
> `pricing_recipe:create`."*

**Eleven resources have `update` without `delete`. Nine carry a note explaining it; two are silent.**

Explained — a representative quote each:
- `customers` — *"R2: no delete verb — no tombstone (the `status` column is lifecycle, not a tombstone; A3)."*
- `campaigns` — *"per David's ruling LIKELY NEVER: a deleted campaign destroys…"*
- `order_compliance_records` — *"the netting-warning record (Regina anchor); write-once at sale, so no delete verb."*
- `pmi` — *"read+update (you do not create or delete a schedule slot as an authority act)."*
- also `service_offerings`, `deliveries`, `tax_rate`, `pricing_recipe`, `subscription`.

🟡 **Silent — nobody recorded a reason:** **`settings`** and **`deliveries.route`**. `settings` is
arguably self-evident (a singleton config is not created or deleted); `deliveries.route` is not —
it has `read` + a `planned` `update`, no create, no delete, and no note saying why.

**A fourth deliberate non-uniformity, recorded at the code rather than in the manifest:**
`edit_receipt_line_items` is owner-only *by ruling*, and says so — *"OWNER ONLY. Not a manager, not
staff, and not 'a member holding costs:update'."* Under David's model this is expressible as a
literal string nobody but the owner holds; today it is `owner_id`, which is the pattern ⑤.2 asks to
retire. **It is a deliberate decision sitting on a mechanism that is about to change**, so it needs
a home in the ruling rather than a rediscovery afterwards.

🔴 **AND ONE NOTE CONTRADICTS ITS OWN ENTRY.** `permissionManifest.ts:421-433`, `tax_rate`:
the status line reads `status: { read: 'enforced', update: 'enforced' }` with an inline comment
recording the flip — *"update FLIPPED declared-unwired → enforced 2026-07-27: set_business_tax_rate
gates on it"* — while the `note` immediately below still says:

> *"The WRITE does not exist yet (set_business_tax_rate, Phase 1), hence declared-unwired."*

The write does exist; `set_business_tax_rate` checks `tax_rate:update` [CORPUS]. **A comment
contradicting its own repo, on the same entry, four lines apart.** This is the class of #61, #188
and R-26 — the fifth instance I can name — and it is a comment-only fix.

---

## ⑤ MY RECOMMENDATION

### 5.0 The finding that reframes the question

**David is right that permissions became complex, and he is right that RLS became the protagonist —
but RLS is not where the complexity that hurts him lives.**

Counted: **74 of 161 policies already have exactly the shape Lightning proposes.** The RLS layer is
the *most* uniform part of this system. What is not uniform:

- **59 policies gate on `owner_id`** — a different authority concept entirely.
- **23 RPC call sites gate on membership**, and being `SECURITY DEFINER` they **bypass RLS
  altogether**, so no amount of RLS uniformity touches them.
- **The handler layer keeps an owner short-circuit** the other two layers had removed.

**So the protagonist is not RLS. It is `owner_id`, plus a `SECURITY DEFINER` layer that answers to
nobody.** That reframing is the main thing I would want David to take from this pass.

### 5.1 Testing Lightning's read

> `USING (is_active_member(business_id) AND has_permission(business_id,'<literal>'))` on every
> table and every verb **IS** his model.

**Right in direction, and it is genuinely his model — but it is necessary and not sufficient, and
shipping only this would produce a false sense of completion.**

Where it is right: it is already the majority shape; extending it over the 59 `owner_id` policies
and the 21 membership-only ones is mechanical; and it makes the sentence *"if a user has X perm then
the user can perform that task"* literally true **for every operation that is a table write**.

Where it is not enough: **reconcile is not a table write.** It is a compound operation —
`UPDATE business_inventory` + `INSERT business_inventory_ledger` — issued through a `SECURITY
DEFINER` RPC that RLS does not see. **You cannot express "Joel may edit a lot but may not reconcile"
in RLS at all**, because both are the same UPDATE on the same table. The distinction only exists at
the RPC boundary, and that boundary currently checks membership.

**So the uniform shape is the right root fix for the data layer, and the RPC gate is a separate,
equally necessary fix. Doing one and calling it done is the trap.**

### 5.2 What I would REMOVE

1. **`owner_id` as an authority gate — 59 policies, `callerCan`'s short-circuit, and the `owner_id`
   branch inside `is_member_of`.** This is the single largest source of "nothing implies anything"
   being false today. **Measured live: LAWNS has two active OWNER-role members, and one of them
   (`790b31d2…`) is NOT `businesses.owner_id` (`98f4e56b…`).** That person holds all 57 strings and
   is refused by every `owner_id`-keyed policy. **Ten tables are reachable *only* via `owner_id`** —
   `business_accounting_secrets`, `campaign_tone_samples`, `nursery_profiles`, `nursery_modules`,
   `nurseries`, `opportunity_items`, `order_addons`, `plant_events`, `pmi_assets`,
   `pmi_service_logs` — and four more (`businesses`, `order_items`, `order_service_selections`,
   `role_definitions`) are readable by members but writable only by `owner_id`. **R-22 is not a
   design question; it is a live defect with a name attached to it.**

2. **The alias layer — `permission_aliases` and the subquery inside `has_permission`.** Verified
   inert in all three directions (2.5). Removing it makes the function body literally
   `permissions ? p_perm` — **David's model, verbatim, in one line** — and removes a correlated
   subquery that currently runs inside RLS predicates on every row of every gated read.
   **What breaks:** nothing measured today. **The risk I cannot rule out:** a hand-applied policy
   checking a legacy string would be invisible to me (see the [CORPUS] limit). Before dropping,
   dump `pg_policies` once from the SQL editor and grep it — that is a five-minute check, and it is
   the one thing standing between "inert" and "proven inert."

3. **`team:update` / `team:delete`** — `declared-unwired`, wanted gone since 2026-07-31 (tech-debt
   #90), and #228 already built the self-pruning declaration that unblocked their removal.

**What I would NOT remove:** `planned` and `declared-unwired` as distinct statuses. They cost
nothing, the floor rule keeps `planned` honest (*"a named gap, a card, a slot, or a decision"*), and
collapsing them re-creates the contradiction the 2026-07-31 ruling resolved.

### 5.3 Is grant-time expansion the right root fix?

**Split the question, because the two expansions are different and deserve opposite answers.**

- **Aliases → do not expand at grant time. Delete them.** Grant-time closure is the right answer
  when you still need legacy support. Measured, we do not. Expanding at grant time would freeze a
  dead vocabulary into every stored array permanently.

- **Dependencies (`applyPermissionDependencies`) → yes, expand at grant time.** Today it runs at
  read time on the client (`BusinessProvider.tsx:781`) and **not at all on the server** — the SQL
  does a plain containment test. So client and server can disagree about a granted-update-without-read,
  which is the same inversion class as the "Tax: not identified" defect. Expanding at the funnel
  makes the stored array the closure, and then **the array in the database is exactly the answer to
  "what can this person do"** — which is David's model stated as a data structure.

  **What breaks, honestly:** (a) the Roles page must show the closure rather than what the owner
  ticked, or the screen and the truth diverge — arguably an improvement, but it is a UI change;
  (b) **revocation gets harder** — removing `costs:read` must also remove `margin:read`, and
  `createWithoutRead` / `unmetDependencies` already exist to compute that but are not wired into a
  revoke path; (c) previously-granted arrays need a backfill through the funnel, which
  `20260828_owner_role_carries_authority.sql` §5 already demonstrates is the supported route
  (*"a hand-written UPDATE … WOULD WORK, and would produce NO AUDIT ROW"*).

  ⚠️ **Measured caveat that shrinks this item:** for David's own Joel example the expansion is a
  no-op — `['inventory:read','inventory:update','inventory:create']` expands to itself, adding
  nothing. Dependencies only bite when someone grants `update` without `read`. **This is a
  correctness fix, not a complexity fix, and it should be sequenced last.**

### 5.4 Can `owner_id` stop being an authority gate?

**Yes — and most of the design work is already done.**

Keep `owner_id` for exactly three things: **who owns the tenant, who bills, and who can delete it** —
plus the **recovery path**, the one account that can restore a roster that has locked itself out.
Everything else becomes the OWNER role holding a full array.

**The obvious objection — an owner removing their own authority — is already handled.**
`save_role_permissions` (`20260730c:88`) refuses a write to the OWNER role, and the reasoning is
recorded: *"LOCKED MEANS LOCKED, INCLUDING AGAINST THE OWNER … the ability to edit it is the ability
to REMOVE one's own authority — a self-inflicted lockout with no recovery path in the UI."* It also
already draws the right seam: the refusal is scoped to tenant rows, and *"a deploy is an authored
act with a diff and a review; a click is not."*

**What I would want checked before ruling:** `save_role_permissions` itself still gates on
`businesses.owner_id = p_actor_user_id`. If `owner_id` stops being authority everywhere else, that
one check is the deliberate exception and should be **stated as such**, not left looking like the
59 others.

### 5.5 What I think we have both missed

1. 🔴 **The `SECURITY DEFINER` layer is the real hole, and neither of you named it.** 23 call sites
   bypass RLS and check membership. **Uniform RLS does not touch them.** The good news is that this
   is also the *cheapest* fix in the document: the movement RPCs already funnel through one gate, so
   adding a permission argument to `assert_movement_actor` — or a sibling that takes one — puts a
   literal string in front of reconcile, promote, adjust and retire **in one place**.

2. 🔴 **`read` is being used as a write gate**, at the route layer, deliberately and with a comment
   defending it. Under "explicit permissions," `/inventory/reconcile` gated on `inventory:read` is
   a contradiction regardless of what the data layer does.

3. 🔴 **`has_permission_exact` is live and in no migration** (2.4). Whatever is ruled, it should be
   captured in a migration first, or the next recon will re-derive a model that omits it.

4. ⚠️ **Column-level reads are the one part of David's model RLS genuinely cannot express**, and it
   will keep recurring. "Read the LIST but not the COST on the same row" is not a row-level
   question. It is already why `costs` is a separate resource, and it will come back for wages on a
   person row and for margin on an inventory row. The available answers are a **view**, a **narrow
   `SECURITY DEFINER` reader** (which is exactly what `get_business_tax_rate` is — *"returning ONLY
   `config->>'taxRate'` — NEVER the recipe"*), or a **server route**. That pattern is already
   established and working; it just is not named as the general answer.

5. ⚠️ **Two tenants' worth of live data disagree with the default bundle.** The MANAGER on *Test
   Dave's* holds 40 strings including `costs:*`, `wages:*` and `pricing_recipe:*`; Lauren on LAWNS
   holds exactly the 25 of `MANAGER_DEFAULT_BUNDLE` [MEASURED]. Not a defect — but it means "what
   can a MANAGER do" has no single answer, and any ruling phrased in terms of roles rather than
   arrays will be ambiguous.

### ⚠️ THE THING TO SAY OUT LOUD: CAN THIS BE DONE IN RLS AT ALL?

**Mostly yes — and the exceptions are specific, small, and already have a working pattern.**

- **`supabase-js` reaches PostgREST directly with the user's JWT, so for any table the client
  touches, RLS is the only enforcement point.** There is no server to route through unless one is
  built, and the `api/` directory is at **12 of 12** on Vercel Hobby, so "route it through a server"
  is not freely available (§6 r11).
- **Postgres RLS is per-command** (`FOR SELECT` / `INSERT` / `UPDATE` / `DELETE`), so
  **verb granularity is native.** David's model maps onto it cleanly for table-shaped permissions.
- **RLS cannot express an operation that spans tables** (reconcile), and it **cannot express a
  column-level read** (list vs cost). Both already have the right answer in this codebase: a narrow
  `SECURITY DEFINER` function that checks one literal string and returns exactly one thing.
  `get_business_tax_rate` is the exemplar and it works.

**So the honest answer is: his model does not require a server tier. It requires the RPC layer to
start checking permissions — which is a smaller change than the RLS sweep, and it is the half that
actually blocks the Joel example.**

---

## WHAT I AM NOT SURE OF

1. **Whether the live catalog matches the corpus.** No PAT; `pg_policies` unreachable via PostgREST.
   Every policy count is [CORPUS]. **Finding 2.4 proves this gap is not theoretical.**
2. **Whether `has_permission_exact` is called by anything**, and what its body is. It exists; that
   is all I established.
3. ✅ **CLOSED IN THIS PASS, NOT LEFT OWED.** I had flagged three RPCs as possibly ungated. Checked
   against their GRANTs: `discovery_create_inventory` and `discovery_rescan_clear` are
   `REVOKE ALL … FROM public, anon, authenticated` (service-key only) and `edit_receipt_line_items`
   is owner-gated inline. **None is a hole.** The reconcile finding stands alone.
4. **Migration apply-state.** There is an untracked `docs/audits/migration-apply-state-stage3.sql`
   in the working tree, which suggests apply-state is itself under investigation. I did not open it.
5. **Ordering of same-date migrations.** I found and corrected one real error caused by sorting on
   filename (`bpc_member_insert`); I checked for others and found seven, all self-contained within a
   single file. **A third same-date pair added later would reintroduce the risk**, and nothing
   asserts apply order.

---

## ADDENDUM — 2026-09-10, LATER THE SAME DAY: THE PAT ARRIVED AND THE [CORPUS] LIMIT IS CLOSED

David supplied a Supabase Management API token. It is stored as `SUPABASE_PAT` in the two
**gitignored** `.env.local` files (root + `packages/cultivar-os/`), never in a tracked file, and
`scripts/lib/pgQuery.mjs` reads it from the process environment. **Everything below is [MEASURED]
against `pg_catalog`, not derived from migrations.**

### 1. 🔴 THE CATALOG HOLDS 142 POLICIES. I DERIVED 161 FROM THE CORPUS.

`select count(*) from pg_policies where schemaname='public'` → **142**.
My corpus derivation said **161**. **A 19-policy gap, and it is exactly the uncertainty this
document flagged twice and could not resolve.** ⚠️ **The reconciliation is NOT done** — the gap
could be unapplied migrations, hand-applied drops, or a flaw in my drop-tracking. **Nothing in ①–⑤
should be treated as settled at the policy layer until that reconciliation runs.** It is now a
cheap, mechanical job and it is the first thing the next pass should do.

### 2. ✅ `bpc_member_insert` IS CONFIRMED ABSENT — #287 WAS RIGHT, AND SO WAS THE CORRECTION

Live on `business_pricing_config`: **`bpc_member_select` (SELECT) · `bpc_member_update` (UPDATE) ·
`bpc_owner_all` (ALL)`** — and no INSERT policy of any kind. My filename-sort error is now corrected
**against the catalog** rather than against a second reading of the corpus.

### 3. 🔴 `has_permission_exact` IS LIVE, AND IT IS DAVID'S MODEL ALREADY BUILT

Finding 2.4 said it exists and nothing could see its body. Here it is, verbatim from `pg_proc`:

```sql
CREATE OR REPLACE FUNCTION public.has_permission_exact(p_business_id uuid, p_perm text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
     WHERE bm.business_id = p_business_id
       AND bm.user_id = auth.uid()
       AND bm.active
       AND bm.permissions ? p_perm          -- literal. no implication, no aliases.
  );
$function$
```

🔴 **THIS IS THE ROOT FIX ⑤.2 RECOMMENDED, AND DAVID HAD ALREADY WRITTEN IT.** *"Delete the alias
layer … the function body becomes literally `permissions ? p_perm` — David's model, verbatim, in one
line."* **He built exactly that on 2026-09-09, by hand, and his own comment states the rule the
recommendation was arguing for.** The recommendation is therefore not a proposal — it is *"adopt the
function that already exists and retire the one it replaces."*

⚠️ **TWO THINGS OWED ON IT, AND BOTH ARE REAL:**

1. 🔴 **IT HAS NO `SET search_path = ''`.** Every other `SECURITY DEFINER` function in this corpus
   pins an empty `search_path` — `has_permission_for`, `is_member_of`, `assert_movement_actor`,
   `count_reconcile_inventory`, all of them. **A `SECURITY DEFINER` function with an unpinned
   `search_path` is the standard Postgres privilege-escalation shape.** It is mitigated here by
   every identifier being schema-qualified (`public.business_members`), so I am **not** calling it
   exploitable — but it is the one function that diverges from a convention the rest of the corpus
   keeps without exception, and it is the kind of divergence that should be deliberate.
2. **It is in no migration**, so it is invisible to `npm run verify`, to every cap, and to the next
   recon. **Capturing it in a migration is owed** — additive, `CREATE OR REPLACE`, no behaviour
   change.

⚠️ **What I did NOT check:** whether anything calls it. It had zero callers in the repo as of this
morning; whether a hand-applied policy references it is part of the 142-vs-161 reconciliation above.
