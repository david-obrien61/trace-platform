# THE 49 RAW `owner_id` POLICIES — TRIAGE
**2026-09-10 · Thunder · READ ONLY. No migration. [MEASURED] from `pg_policies` via the PAT.**

The 49 are every live `public` policy whose body references `owner_id` and **does not** call
`is_business_owner()`. That function was widened by `20260828` and its own comment names her —
*"an OWNER-ROLE member who is not the account holder (Lauren's case)"*. **These 49 bypass it and
compare the raw column**, so they are the set where an OWNER-role member who is not the account
holder is refused.

## THE TEST APPLIED (David's, 2026-09-10 — replacing the earlier one)

> **Is this about the BUSINESS ENTITY, or about the WORK?**
> **ENTITY** — who owns it, who is billed, can it be deleted, who it transfers to. Nobody delegates
> these in any business, ever. → keep raw `owner_id`, **with a comment saying why**.
> **WORK** — pricing, inventory, orders, customers, settings, invitations. Every one is delegable by
> **some** business. → `has_permission(business_id,'<string>')`, and **name the string**.

✏️ **The earlier question — *"could you imagine delegating this to a manager?"* — was replaced by
David and he is right that it was the wrong question.** It asks about a business's PREFERENCE, which
varies per customer, so answering it means guessing at Terry's. The entity/work test is a property
of the operation and is answerable without knowing the customer. **Every verdict below is the new
test; none is carried over.**

---

## ① ENTITY — KEEP RAW `owner_id` (2 of 49)

| # | Policy | Cmd | Why it is ENTITY |
|---|---|---|---|
| 1 | `businesses.businesses_owner_insert` | INSERT | Creating a business **is** becoming its owner. `owner_id = auth.uid()` on insert is the statement "you may create businesses you will own", which is the entity's origin, not work inside one. |
| 2 | `businesses.businesses_owner_select` | SELECT | The account holder's own read of the entity row. ⚠️ **Nearly redundant** — `businesses_member_select` already admits every active member incl. Lauren, so this grants nothing she lacks. Keep with a comment, or drop as duplicate; either is defensible, and that is David's call. |

**Both need a comment saying why.** Neither has one today.

## ② `is_business_owner()` — **EMPTY. 0 of 49.**

🔴 **David predicted this list would be short or empty, and it is empty — but the reason is worth
stating, because "empty" could mean I did not look.**

An OWNER-role member holds a full permission array (Lauren holds all 57), so **`has_permission`
already admits her for every string**. That makes `is_business_owner()` a *role* check standing in
for a *capability* check — and for every one of the 47 below, a permission string either exists or
is nameable. **There is no policy where I can argue the OWNER ROLE, as a role, is the right gate
and a permission string is not.**

⚠️ **The one place `is_business_owner()` still earns its keep is the vendor-preference triggers**
(`enforce_vendor_preference_is_owner_only`, `link_vendor_preference`) — but those are **functions,
not policies**, so they are outside these 49, and they are arguably bucket ③ too
(`costs:update` is what their table's member policies already use).

## 🔴 TOO COARSE TO BUCKET — A SPLIT, NOT A RE-POINT (1, and it is the important one)

| Policy | Cmd | Why it cannot be bucketed |
|---|---|---|
| `businesses.businesses_owner_update` | UPDATE | **It gates UPDATE on the whole `businesses` table.** That single policy covers BOTH the profile fields Lauren was legitimately editing (`name`, `phone`, `address`, `email`, `website` — WORK, `settings:update`) AND the ownership fields (`owner_id`, `business_type` — ENTITY). RLS has **no column-level restriction**, so it cannot be re-pointed at a permission without also handing that permission `SET owner_id = <self>`. |

✏️ **AND THE REPO ALREADY SOLVED THIS ONCE, WHICH IS THE ARGUMENT FOR THE PATTERN.**
`Settings.tsx`'s comment says it outright: *"A direct UPDATE only ever worked for the OWNER … And
the one-line fix — a member UPDATE policy — would have been WORSE: RLS has no column-level
restriction, so it would also permit `SET owner_id = <self>`. The RPC's column list IS the
column-level policy."* `set_business_profile` is that RPC. **So the split already exists in one
direction:** the work half is done, and this policy is what remains guarding the entity half.
**The finding is that nothing says so** — it reads like an un-migrated owner policy rather than a
deliberate residue. It needs a comment, not a change.

## ③ WORK — RE-POINT AT A PERMISSION STRING (46 of 49)

**Bold = the string does not exist and would need minting. Everything else already exists.**

| # | Policy | Cmd | String |
|---|---|---|---|
| 3 | `addons.addons_business_owner` | ALL | `service_offerings:update` ⚠️ legacy table (pre-`service_offerings`) |
| 4 | `audit_log.audit_insert` | INSERT | system write — **`audit_log:write`** *(no string; today member+owner)* |
| 5 | `audit_log.audit_owner_read` | SELECT | `audit_log:read` ✅ exists, sensitivity `owner-only` |
| 6 | `business_accounting_secrets.bas_owner_all` | ALL | **`accounting:connect`** *(needs minting)* ⚠️ server-only today (`api/qbo/*`), so no client surface depends on it |
| 7 | `business_discovery_profiles…_owner_all` | ALL | `settings:update` |
| 8 | `business_display_standards…_owner_all` | ALL | `settings:update` |
| 9 | `business_inventory.business_inventory_owner_all` | ALL | `inventory:read/create/update/delete` ✅ all four member policies already exist |
| 10 | `business_inventory_ledger…_owner_all` | ALL | `inventory_ledger:read` |
| 11 | `business_members.bm_owner_all` | ALL | `team:read` / `team:update` ⚠️ **`team:update` is `declared-unwired`** — tech-debt #90 |
| 12 | `business_operating_days…_owner_all` | ALL | `settings:update` |
| 13 | `business_pmi_schedule…_owner_all` | ALL | `pmi:read` / `pmi:update` — **this IS tech-debt #123**, already filed |
| 14 | `business_pricing_config.bpc_owner_all` | ALL | `pricing_recipe:read` / `pricing_recipe:update` — ✅ **CONFIRMED, see below** |
| 15 | `business_service_log…_owner_all` | ALL | `pmi:read` / `pmi:update` |
| 16 | `business_voice_samples.business_voice_samples_owner` | ALL | `campaigns:update` |
| 17 | `campaign_posts.campaign_posts_owner` | ALL | `campaigns:read` / `campaigns:update` |
| 18 | `campaigns.campaigns_owner` | ALL | `campaigns:read` / `campaigns:update` |
| 19 | `cost_object_assignments…_owner_all` | ALL | `costs:*` |
| 20 | `cost_object_edges…_owner_all` | ALL | `costs:*` |
| 21 | `cost_objects.cost_objects_owner_all` | ALL | `costs:*` |
| 22 | `cultivar_plants.cultivar_plants_owner_all` | ALL | `inventory:update` |
| 23 | `cultivar_plants.cultivar_plants_owner_select` | SELECT | `inventory:read` |
| 24 | `customers.customers_business_owner` | ALL | `customers:*` |
| 25 | `deliveries.deliveries_owner_all` | ALL | `deliveries:*` |
| 26 | `inventory_count_sessions…_owner_all` | ALL | `inventory:update` — **or `inventory:reconcile` once minted** |
| 27 | `inventory_counts.inventory_counts_owner_all` | ALL | same as 26 |
| 28 | `invitations.inv_owner_all` | ALL | `team:create` |
| 29 | `labor_resource_wages.lrw_owner_all` | ALL | `wages:*` |
| 30 | `labor_resources…_owner_all` | ALL | `wages:*` |
| 31 | `losses.losses_all_owner` | ALL | ⚠️ table is EMPTY and pending DROP (`20260727d`) — **drop, do not re-point** |
| 32 | `member_device_handoffs.mdh_owner_all` | ALL | **`devices:manage`** *(needs minting)* |
| 33 | `member_devices.md_owner_all` | ALL | **`devices:manage`** *(needs minting)* |
| 34 | `nurseries.authenticated_select_nurseries` | SELECT | ⚠️ EMPTY, pending DROP — **drop** |
| 35 | `nurseries.nurseries_update_owner` | UPDATE | ⚠️ EMPTY, pending DROP — **drop** |
| 36 | `nursery_profiles.nursery_profiles_owner` | ALL | `settings:update` 🔴 **LIVE DEFECT — see below** |
| 37 | `opportunity_items.opportunity_items_owner` | ALL | `service_offerings:update` ⚠️ no client reader |
| 38 | `order_addons.order_addons_owner` | ALL | `order_items:*` ⚠️ no client reader (legacy) |
| 39 | `order_compliance_records.compliance_records_owner_select` | SELECT | `order_compliance_records:read` |
| 40 | `order_items.order_items_owner` | ALL | `order_items:*` |
| 41 | `order_service_selections.order_service_selections_owner` | ALL | `order_service_selections:*` |
| 42 | `orders.orders_business_owner` | SELECT | `orders:read` |
| 43 | `plant_events.plant_events_business_owner` | ALL | `inventory:update` ⚠️ legacy |
| 44 | `receipts.receipts_owner_all` | ALL | `costs:*` |
| 45 | `role_definitions.rd_owner_write` | ALL | `team:update` ⚠️ **`declared-unwired`** |
| 46 | `service_offerings.service_offerings_owner` | ALL | `service_offerings:*` |
| 47 | `social_drafts.social_drafts_business_owner` | ALL | `campaigns:update` |
| 48 | `vendor_preferences.vendor_preferences_owner_all` | ALL | `costs:read` / `costs:update` |
| 49 | `businesses.businesses_owner_update` | UPDATE | 🔴 **see TOO COARSE above — not re-pointable as-is** |

### ✅ `bpc_owner_all` IS BUCKET ③ — CONFIRMED, NOT ARGUED WITH

The pricing recipe is **work**: it is margin, tier overrides, reference price. It is not who owns
the business, who is billed, or who it transfers to. And the repo has already ruled on the verbs —
`pricing_recipe` is READ + UPDATE with **no create**, deliberately
(`20260727_rbac_flip_corrections.sql:85`). So the re-point is `pricing_recipe:read` for SELECT and
`pricing_recipe:update` for UPDATE, **and the member policies for exactly those already exist**
(`bpc_member_select`, `bpc_member_update`). `bpc_owner_all` adds nothing a permission cannot express.

⚠️ **One caveat, and it is why B.1 was fixed in the write path instead:** INSERT is deliberately
**not** covered — `bpc_member_insert` was dropped on purpose. Re-pointing `bpc_owner_all` at
`pricing_recipe:update` must **not** quietly restore a member INSERT, or it re-creates capP
assertion 5 (a permission named `update` granting a create).

---

## 🔴 THE LIVE-DEFECT SUBSET — WHAT ACTUALLY RENDERS FOR LAUREN TODAY

**This is separate from the tidy-up, and it is one policy, not 49.**

Most of the 46 are harmless today because the table **also** carries member policies for the same
verbs (`business_inventory` has 4, `receipts` 4, `costs` 4, `campaigns` 3 …) and Lauren holds every
string. The owner policy is then redundant, not blocking. Others are unreachable: `secrets.ts` is
imported only by `api/qbo/*` (service key), and `losses` / `nurseries` / `opportunity_items` /
`order_addons` / `business_voice_samples` have **no client reader at all**.

### 🔴 `nursery_profiles` — the one that bites, and it is B.1's defect at a second address

`Settings.tsx:67` **reads** `nursery_profiles` and `:83` **upserts** it (the default install price).
That table has **exactly one policy** — `nursery_profiles_owner`, raw `owner_id`. So for Lauren:

- **The read returns zero rows** via `.maybeSingle()`, so the install-price field renders **blank —
  indistinguishable from "not set"**. She sees a false empty, not a refusal (D-9).
- **The save is refused**, and `:34` surfaces `'Error: ' + error.message` — **the raw RLS string**,
  the same sentence that started this whole thread.
- **The section is not permission-gated at all** — no `can()` anywhere near it. It renders for her
  and then fails.

**Filed as tech-debt #236. NOT fixed this pass** — it is a second surface, and B.1's prompt scoped
the fix to the profile save. **CARD 8 on the owner-test board proves it against an ephemeral
principal**, so it needs neither Lauren nor a site visit to confirm.

### ⚠️ What I checked and found NOT to be live defects
- **Vendor preferences** — I expected this to bite and it does not: `is_business_owner()` is already
  widened, so Lauren passes. **The catalog killed the hypothesis before I reported it.**
- **Roster remove** — `Settings.tsx:314` locks it via `rosterActionLock('remove', { isAccountHolder: isOwner })`, and `isOwner` is `owner_id`-derived, so the control is already locked for her rather than rendered-and-refused.
- **Order writes** — `order_items` / `order_service_selections` / `order_compliance_records` member policies are SELECT-only, but every write goes through `api/orders/submit.ts` on the service key.

## WHAT I AM NOT SURE OF

1. **Whether the two ENTITY policies are the complete entity set.** Deletion and transfer of a
   business have **no policy at all** — there is no DELETE policy on `businesses` anywhere. That is
   either deliberate (nothing may delete a business) or a gap nobody has named. **I did not resolve it.**
2. **`audit_log.audit_insert`** — I bucketed it WORK, but an audit row arguably should be writable
   by no one and inserted only by `SECURITY DEFINER` functions. If that is the intent, it is neither
   bucket and belongs with `businesses_owner_update` as a shape question.
3. **The three "needs minting" strings** (`accounting:connect`, `devices:manage`, `audit_log:write`)
   are my names, not David's, and naming a permission is a ruling.
