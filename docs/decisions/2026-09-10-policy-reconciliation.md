# THE POLICY RECONCILIATION — 142 LIVE vs 161 DERIVED, BY NAME AND BY CAUSE
**2026-09-10 · Thunder · [MEASURED] against `pg_policies` with the PAT. Not corpus.**

Everything here is read from the live catalog. This is the reconciliation the two prior recons
flagged and could not perform.

## THE ARITHMETIC CLOSES

```
162 derived from the corpus
− 30 derived but NOT live
+ 10 live but NOT derived
= 142 live  ✅  matches select count(*) from pg_policies where schemaname='public'
```

## THE 30 DERIVED-BUT-NOT-LIVE, BY CAUSE

### 🔴 UNAPPLIED MIGRATIONS — 18. *The repo lying about its own state.*

**`20260905_production_planning.sql` — 12 policies. Tables do not exist live.**
`production_plans` ×4 (`_owner_all`, `_member_insert`, `_member_select`, `_member_update`) ·
`production_plan_lines` ×4 (same shape) · `business_operations_config` ×4 (same shape).
**Applying it creates three tables and twelve policies.** It is the uppot-planning build (#276).

**`20260727c_campaigns_member_and_plant_events_scope.sql` — 6 policies. Tables DO exist.**
`campaigns_member_insert/select/update` · `campaign_posts_member_insert/select/update`.
🔴 **This is the one with a live consequence.** Both tables carry only their `_owner` policy, so
**campaigns are owner-only in the database** while `permissionManifest` declares `campaigns:read`
and `campaigns:update` as `enforced` and `MANAGER_DEFAULT_BUNDLE` grants both. A manager opening
campaigns reads **zero rows and gets no error** — #153's defect at a new address.
**Applying it grants a manager the access the model already says she has.** Policy-only, no DDL.

### Tables that no longer exist — 8. *Not a lie; the policy went with its table.*
`plants` ×2 (`plants_business_owner`, `anon_select_plants`) · `business_assets` ×2 ·
`pmi_assets` · `pmi_service_logs` · `nursery_modules_business_owner` · `campaign_tone_samples`.
`nursery_modules` was *"pending DROP"* in CLAUDE.md §2 — **it has been dropped.**

### 🔴 MY OWN DROP-TRACKING — 4. *Only the recon was wrong.*
- **3 × `storage.objects`** (`receipts_storage_insert/select/delete`) — **they are live**, in schema
  `storage`. My parser assumed every policy was in `public`. Not missing at all.
- **`bpc_member_insert`** — the filename-sort ordering error (`flip_corrections` sorts before
  `resource_action_flip`), already corrected on 2026-09-10 and now confirmed against the catalog.

## THE 10 LIVE-BUT-NOT-DERIVED — undocumented change history

Created by nothing in the corpus. Legacy/pre-migration or hand-applied:

`addons_select_public` · `business_voice_samples_owner` · `cost_objects_owner_all` ·
`cultivar_plants.anon_select_plants` · `losses_all_owner` · `modules readable by authenticated
users` · `nurseries_select_public` · `nurseries_update_owner` ·
`plant_events.anon_select_plant_events` · `plant_events_select_public`

⚠️ *"modules readable by authenticated users"* contains **spaces** — the Supabase dashboard's
default naming. That one was created by hand in the UI.

## 🔴 THE FOUR NUMBERS, RESTATED FROM THE CATALOG

The consolidation plan rests on these, and **three of the four moved**.

| | Corpus (2026-09-10 recon) | **LIVE CATALOG** | Δ |
|---|---|---|---|
| permission-gated | 74 | **59** | **−15** |
| `owner_id`-only | 59 | **48** | −11 |
| membership-only | 21 | **23** | +2 |
| **open `USING(true)`** | **3** | **🔴 8** | **+5** |
| self-scoped (`user_id = auth.uid()`) | — | 4 | — |
| | 161 (+3 storage) | **142** | |

**Two things a planner needs from this table.**

1. 🔴 **The open count is 8, not 3 — nearly triple**, and five of the extra are in the
   live-but-underived list above. They sit on the public-QR legacy tables (`nurseries`,
   `cultivar_plants`, `plant_events`, `addons`, `modules`), and several are **duplicates of each
   other** — `anon_select_plant_events` *and* `plant_events_select_public`; `addons_select_public`
   *and* `anon_select_addons`; two on `modules`. Two spellings of one grant, and the redundant copy
   is the one that drifts.
2. **Permission-gated is 59, not 74.** Fifteen of the policies the consolidation counts as "already
   the right shape" **are not in the database**, and 6 of those are the campaigns set above.

**32 distinct permission strings are enforced by a live policy. None is legacy.**
