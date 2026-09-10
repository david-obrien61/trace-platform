# THE 49 RAW `owner_id` POLICIES — THE DISPOSITION TABLE
**2026-09-10 · Thunder · #289.** The build input is
[`2026-09-10-owner-id-policy-triage.md`](2026-09-10-owner-id-policy-triage.md) (David's
ENTITY-vs-WORK test). This file is the **decision per policy**, and it is machine-read:
`scripts/verify-owner-id-repoint.mjs` parses the table below, parses
`supabase/migrations/20260910b_owner_id_policies_become_permissions.sql`, and **fails the build if
the two disagree in either direction.**

> ✅ **16 MUTANTS, 16 CAUGHT, 0 SURVIVED** — including the four that matter most here: a split policy
> recreated as `FOR ALL` (the widening restored), a split's DELETE gated on the UPDATE string,
> `deliveries` INSERT gated on `:update` instead of `:create`, and a split policy simply missing.
> **M8, M12 and M14 were re-run and PROVEN to apply** before being counted — a mutant that never
> lands reports the same as one that was caught (tech-debt #182). The cap also carries an
> **11-probe `--self-test`** that runs before it reports on the real files, so a detector that stops
> detecting fails loudly instead of going quiet (§6 r19).
>
> 🔴 **WHY THIS FILE IS THE SOURCE AND THE MIGRATION IS THE COPY — [[#179]]'s lesson.** `VENDORS_SELECT`
> named ten columns while its migration created fourteen, and **nothing we own could have caught it**:
> a declarative list that does not match what it describes is invisible to tsc, eslint, knip and
> every probe. So the list is parsed, not trusted, and the cap asserts both directions — a row here
> with no matching statement there is a failure, and a policy touched there and absent here is a
> failure too.

## THE ARITHMETIC

| Disposition | n | What it means |
|---|---|---|
| **REPOINT** | 24 | `USING (is_active_member(business_id) AND has_permission(business_id, '<string>'))`, and the same on `WITH CHECK` where the command has one. Policy name unchanged. |
| **REPOINT_SPLIT** | 2 | The `FOR ALL` policy is **dropped and replaced by one policy per verb**, each on its own string. `deliveries` and `cultivar_plants` — see below. |
| **REPOINT_PLUS_SELECT** | 1 | The repoint, **plus a new `_member_select` on the READ string** — because a read gated on a write string is the same lie as no policy at all. `nursery_profiles`, tech-debt **#236**. |
| **SPLIT_INSERT_ONLY** | 1 | `bpc_owner_all` → `bpc_owner_insert`, **narrowed to INSERT and kept on raw `owner_id`.** The instruction was explicit: do **not** quietly restore a member INSERT. |
| **DROP** | 10 | Redundant. Every command the policy spans is already gated per-verb, on the right string, by a sibling member policy. |
| **KEEP** / **KEEP_ENTITY** / **KEEP_ROUTE_A** | 8 | Raw `owner_id` stays. **A comment is the whole change**, and it is the point — every one of these read like an un-migrated leftover. |
| **UNTOUCHED** | 3 | `losses`, `nurseries` ×2 — EMPTY tables pending DROP via GATED `20260727d` (ledger #162). |
| | **49** | |

## 🔴 THE ONE DIVERGENCE FROM THE LITERAL INSTRUCTION (§6 r10 — no silent divergence)

The prompt said each of the 46 WORK policies *"becomes `USING (is_active_member … AND
has_permission …)`"*. **Ten of them cannot, and the reason is DELETE.** They are `FOR ALL` policies
on tables that already carry a complete per-verb member set — `business_inventory` has four
policies, `receipts` four, `cost_objects` four — where SELECT tests `costs:read`, INSERT tests
`costs:create`, UPDATE tests `costs:update` and DELETE tests `costs:delete`. A `FOR ALL` policy
gated on any ONE of those strings **grants every verb on that one string**, so repointing
`cost_objects_owner_all` at `costs:update` would let an update-string holder DELETE — the exact
separation those four policies exist to make.

**So on those ten the repoint is a DROP**, and each drop line in the migration names the sibling
policies that preserve the access. **Two of the ten are also `compliance_records_owner_select` and
`orders_business_owner`, which are plain duplicates** — same command, same string, as a member
policy already live.

⚠️ **The drops rest on one assumption and it is checked, not assumed: an account holder must also be
an active member of their own business.** Both create paths insert that row
(`OnboardingWizard.tsx:559`, and OwnerSignup on the modern path), and **V6** in the migration proves
it against live data before you trust the sentence.

## 🔴 FOUR POLICIES THE TRIAGE PUT IN THE WORK PILE AND THIS PASS DID NOT REPOINT

Stated here rather than buried, because each is a real disagreement with the input.

1. **`business_members.bm_owner_all`** and **`role_definitions.rd_owner_write`** — these are not
   work, they **are the authority store**. `20260828`'s own header rules on the mechanism: the
   permission trigger is *`BEFORE UPDATE` ONLY*, so INSERT is uncovered and *"a member INSERT policy
   on `business_members` would therefore be a permission-granting side door with no funnel"*. A
   repoint opens it. **And the string the triage named — `team:update` — is `declared-unwired`
   (tech-debt #90), held by nobody including the account holder, so the repoint would have admitted
   NOBODY.** Two independent reasons, either one sufficient.
2. **`invitations.inv_owner_all`** — `20260828` §2: *"THERE IS DELIBERATELY NO INSERT POLICY.
   `create_invitation` is SECURITY DEFINER … an INSERT policy here would let a client mint an
   invitation row whose paired member row it then controls."* A `FOR ALL` repoint restores that
   door. Members already read and revoke via `invitations_member_select` / `_member_update`.
3. **`service_offerings.service_offerings_owner`** — `20260828`'s **V6** asserts that a member
   DELETE policy appearing on this table means R2 was violated (*a service is retired, not
   deleted*). A `FOR ALL` repoint at `service_offerings:update` creates one. Lauren already reads,
   adds and edits services through the three member policies; only DELETE stays with the account
   holder.

## THE TABLE

| # | Table | Policy | Cmd | Disposition | String | Why (KEEP / DROP / UNTOUCHED / SPLIT only) |
|---|---|---|---|---|---|---|
| 1 | `addons` | `addons_business_owner` | ALL | **REPOINT** | `service_offerings:update` |  |
| 2 | `audit_log` | `audit_insert` | INSERT | **KEEP** | — | audit_log:write is NOT minted (David) — the log is a side effect of a permitted action, never a human authority. |
| 3 | `audit_log` | `audit_owner_read` | SELECT | **REPOINT** | `audit_log:read` |  |
| 4 | `business_accounting_secrets` | `bas_owner_all` | ALL | **REPOINT** | `accounting:connect` |  |
| 5 | `business_discovery_profiles` | `business_discovery_profiles_owner_all` | ALL | **REPOINT** | `settings:update` |  |
| 6 | `business_display_standards` | `business_display_standards_owner_all` | ALL | **REPOINT** | `settings:update` |  |
| 7 | `business_inventory` | `business_inventory_owner_all` | ALL | **DROP** | — | member_select/insert/update/delete already gate all four verbs on inventory:read/create/update/delete. |
| 8 | `business_inventory_ledger` | `business_inventory_ledger_owner_all` | ALL | **REPOINT** | `inventory_ledger:read` |  |
| 9 | `business_members` | `bm_owner_all` | ALL | **KEEP** | — | THE AUTHORITY STORE. A member INSERT policy here is a permission-granting side door (20260828 header: the authority trigger is BEFORE UPDATE only). team:update is declared-unwired (tech-debt #90) so a repoint would admit nobody. |
| 10 | `business_operating_days` | `business_operating_days_owner_all` | ALL | **DROP** | — | member_select (is_active_member) + insert/update/delete on settings:update already cover every command. |
| 11 | `business_pmi_schedule` | `business_pmi_schedule_owner_all` | ALL | **REPOINT** | `pmi:update` |  |
| 12 | `business_pricing_config` | `bpc_owner_all` | ALL | **SPLIT_INSERT_ONLY** | — | MUST NOT restore a member INSERT (capP assertion 5). Becomes bpc_owner_insert, FOR INSERT, raw owner_id; SELECT/UPDATE stay with bpc_member_select/bpc_member_update. |
| 13 | `business_service_log` | `business_service_log_owner_all` | ALL | **REPOINT** | `pmi:update` |  |
| 14 | `business_voice_samples` | `business_voice_samples_owner` | ALL | **REPOINT** | `campaigns:update` |  |
| 15 | `campaign_posts` | `campaign_posts_owner` | ALL | **REPOINT** | `campaigns:update` |  |
| 16 | `campaigns` | `campaigns_owner` | ALL | **REPOINT** | `campaigns:update` |  |
| 17 | `cost_object_assignments` | `cost_object_assignments_owner_all` | ALL | **DROP** | — | member select/insert/update/delete already gate all four verbs on costs:*. |
| 18 | `cost_object_edges` | `cost_object_edges_owner_all` | ALL | **DROP** | — | member select/insert/update/delete already gate all four verbs on costs:*. |
| 19 | `cost_objects` | `cost_objects_owner_all` | ALL | **DROP** | — | member select/insert/update/delete already gate all four verbs on costs:*. |
| 20 | `cultivar_plants` | `cultivar_plants_owner_all` | ALL | **REPOINT_SPLIT** | `INSERT=inventory:create · UPDATE=inventory:update · DELETE=inventory:delete` | same shape, worse: the table has NO member policies, so a FOR ALL repoint on inventory:update would grant DELETE to an update-string holder. inventory separates all four verbs. NOTE the old policy read `owner_id OR is_active_member`, so ANY active member could write the catalogue - including STAFF, who hold inventory:read only. That narrows here, deliberately. |
| 21 | `cultivar_plants` | `cultivar_plants_owner_select` | SELECT | **REPOINT** | `inventory:read` |  |
| 22 | `customers` | `customers_business_owner` | ALL | **REPOINT** | `customers:update` |  |
| 23 | `deliveries` | `deliveries_owner_all` | ALL | **REPOINT_SPLIT** | `INSERT=deliveries:create · DELETE=deliveries:update` | a FOR ALL repoint on deliveries:update would grant INSERT to a holder of update; deliveries has a distinct create verb and Joel (MANAGER) holds update and NOT create. Read and update are already covered by deliveries_member_select / _member_update, so only INSERT and DELETE were uncovered. |
| 24 | `inventory_count_sessions` | `inventory_count_sessions_owner_all` | ALL | **REPOINT** | `inventory:update` |  |
| 25 | `inventory_counts` | `inventory_counts_owner_all` | ALL | **REPOINT** | `inventory:update` |  |
| 26 | `invitations` | `inv_owner_all` | ALL | **KEEP** | — | THE AUTHORITY STORE. 20260828 deliberately withheld a client INSERT on invitations (create_invitation is SECURITY DEFINER); a FOR ALL repoint would restore exactly that door. |
| 27 | `labor_resource_wages` | `lrw_owner_all` | ALL | **DROP** | — | member select/insert/update/delete already gate all four verbs on wages:*. |
| 28 | `labor_resources` | `labor_resources_owner_all` | ALL | **DROP** | — | member select/insert/update/delete already gate all four verbs on wages:*. |
| 29 | `losses` | `losses_all_owner` | ALL | **UNTOUCHED** | — | table EMPTY and pending DROP via GATED 20260727d (ledger #162). Do not repoint a policy on a table we are deleting. |
| 30 | `member_device_handoffs` | `mdh_owner_all` | ALL | **REPOINT** | `devices:manage` |  |
| 31 | `member_devices` | `md_owner_all` | ALL | **REPOINT** | `devices:manage` |  |
| 32 | `nurseries` | `authenticated_select_nurseries` | SELECT | **UNTOUCHED** | — | table EMPTY and pending DROP via GATED 20260727d. |
| 33 | `nurseries` | `nurseries_update_owner` | UPDATE | **UNTOUCHED** | — | table EMPTY and pending DROP via GATED 20260727d. |
| 34 | `nursery_profiles` | `nursery_profiles_owner` | ALL | **REPOINT_PLUS_SELECT** | `settings:update` | tech-debt #236 — the ONLY policy on the table, so Lauren read zero rows (a FALSE EMPTY on the install-price field) and got the raw RLS string on save. |
| 35 | `opportunity_items` | `opportunity_items_owner` | ALL | **REPOINT** | `service_offerings:update` |  |
| 36 | `order_addons` | `order_addons_owner` | ALL | **REPOINT** | `order_items:update` |  |
| 37 | `order_compliance_records` | `compliance_records_owner_select` | SELECT | **DROP** | — | order_compliance_records_member already gates SELECT on the same string (order_compliance_records:read). |
| 38 | `order_items` | `order_items_owner` | ALL | **REPOINT** | `order_items:update` |  |
| 39 | `order_service_selections` | `order_service_selections_owner` | ALL | **REPOINT** | `order_service_selections:update` |  |
| 40 | `orders` | `orders_business_owner` | SELECT | **DROP** | — | orders_member_select already gates SELECT on the same string (orders:read). |
| 41 | `plant_events` | `plant_events_business_owner` | ALL | **REPOINT** | `inventory:update` |  |
| 42 | `receipts` | `receipts_owner_all` | ALL | **DROP** | — | member select/insert/update/delete already gate all four verbs on costs:*. |
| 43 | `role_definitions` | `rd_owner_write` | ALL | **KEEP** | — | THE AUTHORITY STORE — this table IS the permission arrays. The funnel (save_role_permissions) is the only writer. team:update is declared-unwired, so a repoint would admit nobody. |
| 44 | `service_offerings` | `service_offerings_owner` | ALL | **KEEP** | — | R2/V6 — 20260828 V6 asserts NO member DELETE policy may appear on this table. A FOR ALL repoint on service_offerings:update would create one. Lauren already has select/insert/update via the three member policies. |
| 45 | `social_drafts` | `social_drafts_business_owner` | ALL | **REPOINT** | `campaigns:update` |  |
| 46 | `vendor_preferences` | `vendor_preferences_owner_all` | ALL | **REPOINT** | `costs:update` |  |
| 47 | `businesses` | `businesses_owner_insert` | INSERT | **KEEP_ENTITY** | — | ENTITY — creating a business IS becoming its owner. |
| 48 | `businesses` | `businesses_owner_select` | SELECT | **KEEP_ENTITY** | — | ENTITY — the account holder's own read of the entity row. Near-redundant with businesses_member_select; reported, not dropped. |
| 49 | `businesses` | `businesses_owner_update` | UPDATE | **KEEP_ROUTE_A** | — | TOO COARSE — it also gates owner_id and qbo_writes_enabled. Route A: set_business_profile's column list IS the column-level policy. |

## 🔴 THE SECOND FORM OF THE SAME PROBLEM: TWO POLICIES ARE SPLIT PER VERB

The ten drops exist because a `FOR ALL` policy gated on ONE string **grants every verb on that
string**. Two more policies hit that from the other side — the table has no complete member set to
make the policy redundant, but a single-string `FOR ALL` would still hand a **live principal** a verb
the model deliberately separates. **Joel Joiner is that principal**, and his array is what made it
visible rather than theoretical.

| Table | Repointing it as one `FOR ALL` would… | What it becomes |
|---|---|---|
| `deliveries` | …grant **INSERT** on `deliveries:update`. `deliveries` has a distinct `create` verb and **Joel holds update and NOT create.** Read and update are already covered by `deliveries_member_select` / `_member_update`, so only INSERT and DELETE were ever uncovered. | `deliveries_member_insert` (`deliveries:create`) + `deliveries_member_delete` (`deliveries:update` — the resource has no delete verb, the same convention `business_operating_days_member_delete` already uses). |
| `cultivar_plants` | …grant **DELETE** on `inventory:update`, and this table has **no member policies at all**. `inventory` separates all four verbs and Joel holds create/read/update but **not delete**. | `cultivar_plants_member_insert` / `_update` / `_delete` on `inventory:create` / `:update` / `:delete`, plus the SELECT repoint on `inventory:read`. |

⚠️ **`cultivar_plants` NARROWS FOR STAFF, AND THAT IS A REAL CHANGE TO WHO CAN DO WHAT.** The old
policy read `owner_id OR is_active_member(business_id)`, so **any active member could write the
catalogue — including STAFF, who hold `inventory:read` and nothing else.** After this they cannot.
The count/promote loop writes `business_inventory`, not `cultivar_plants`, so nothing on the
walk-and-count path depends on it. **Named because it is a change, not because it is in doubt.**

## THE TWO MINTED STRINGS

`accounting:connect` (financial · `owner-only` · enforced) and `devices:manage` (admin ·
`operational` · enforced). **`audit_log:write` is NOT minted** — the system writes the log as a side
effect of a permitted action, so no human needs the string, and *a string that must never be granted
is `pricing_recipe:create` again* (David).

⚠️ **STATUS IS SPELT OUT IN THE MANIFEST, NOT LEFT TO THE DEFAULT.** `buildManifest` defaults an
unspecified verb to `'enforced'` (`permissionManifest.ts:722-725`) and that default is how a false
claim became invisible on `pricing_recipe:update`. Both entries state `status: 'enforced'`
literally.

⚠️ **AND THEY ARE BACKFILLED IN THE SAME TRANSACTION.** A minted string that reaches no permission
array grants nothing — and the three tables now gated on these two would be reachable by **nobody**,
which is a lock-out, not a tighten. `OWNER_DEFAULT_BUNDLE` grows 57 → 59, the floor row is updated
with the complete set, and every OWNER-role member is re-materialised through
`save_role_permissions(… 'reset' …)`. **MANAGER and STAFF do not move** — whether a manager should
connect the books or manage devices is a ruling David has not made, and **V5** asserts the
non-movement.

## WHAT I AM NOT SURE OF

1. **`business_inventory_ledger_owner_all` is repointed at `inventory_ledger:read`, which is the
   resource's ONLY verb — so a read string now gates writes on that table.** It changes nothing
   today: the sibling `business_inventory_ledger_member_all` is `is_active_member` `FOR ALL`, so any
   member already has everything, and the ledger's append-only trigger rejects UPDATE regardless.
   But it is a read string in a write position and I would rather name it than let it read as
   considered.
2. **`bpc_owner_insert` means a tenant with no `business_pricing_config` row can only get one from
   the account holder.** LAWNS has a row; a future tenant created some other way might not. That is
   tech-debt **#231**'s shape and I did not widen it here.
3. **`businesses_owner_select` is very nearly redundant** and I kept it with a comment rather than
   dropping it, per the instruction. Dropping it is a one-line decision whenever David wants it.
4. **DELETE on `business_pricing_config` is now reachable by nobody.** Nothing deletes a pricing
   config, so this is almost certainly correct — but it is a capability that existed this morning
   and does not exist tonight, and that deserves to be written down rather than discovered.
