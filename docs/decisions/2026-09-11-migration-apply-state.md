# Which migrations are in the database — derived, file by file

**Date:** 2026-09-11 · **Type:** TOOL FIX + MEASUREMENT (read-only against the database; nothing applied) · **Build:** #292
**Story:** `user_stories.md` → *David can't see what is still open, so one finished stage reads as a finished feature* — the "SQL to apply" half of *what is waiting on David*.
**Tech debt filed:** #248 · #249 · #250

---

## How to answer "has migration X been applied?"

Nothing records it. David applies migrations by hand in the SQL editor, so Supabase's own `supabase_migrations.schema_migrations` **does not exist on this project** (measured). The answer is derived:

```bash
set -a; . ./.env.local; set +a
node scripts/verify-migration-apply-state.mjs --catalog     # every file, every object kind
node scripts/verify-migration-apply-state.mjs --catalog --verbose   # also lists APPLIED files
```

It reads the system catalogs through the read-only PAT (`supabase_read_only_user`), runs eight red-first controls before trusting anything, and prints a verdict per file. `--self-test` (offline) is part of `npm run verify`.

---

## The result, 2026-09-11 — all 134 files

| Verdict | Files | Meaning |
|---|---|---|
| **APPLIED** | 108 | what it created is there (3 of these are data backfills with direct evidence) |
| **HOLDS** | 4 | a data cleanup whose enforced state is true today |
| **SUPERSEDED** | 5 | later migrations replaced everything it did, on purpose |
| **INCONCLUSIVE** | 10 | present, but every object it asserts is also asserted by another file |
| **NOT_APPLIED** | **3** | see below |
| **TABLE_GONE** | 1 | `20260521` — `customers.shop_id` is gone, no migration removes it (#249) |
| **COULD_NOT_CHECK** | 2 | the two `20260614` cost-to-produce files — their target business no longer exists (#250) |
| **NOTHING_TO_APPLY** | 1 | `20260730_d52_r3_legacy_commitment_reconcile` is comments only |

### Not applied — 3

- **`20260727d_drop_losses_and_nurseries`** — `losses` and `nurseries` still exist. **Known and gated** (ledger #162). Three objects it would remove are reported as *a later change not in effect*.
- **`20260905_production_planning`** — none of its three tables exist. Known (tech-debt #234).
- **`20260529_pmi_shared`** — `pmi_assets` / `pmi_service_logs` never created; its job went to the `business_*` tables in `20260612`. **Most likely abandoned, not owed** — David's call (#248). ✅ **RETIRED 2026-09-11 (R-139, ledger #297)** — every statement commented out in place; it now reads **NOTHING_TO_APPLY**, and the not-applied three are `20260727d`, `20260905` and `20260911`.

### Removed by hand, outside any migration — 4 objects

`nursery_modules` is gone, with its policy, index and `business_id` column. The repo's only `DROP TABLE nursery_modules` is a commented-out line. **CLAUDE.md §2 and PLATFORM_STATE.md said "pending DROP"; both corrected.**

---

## 🔴 Why the old output was wrong, and must not be trusted from memory

The previous version judged each file alone. Against the live database its catalog step reported **10 files as FAIL — and none of the 10 was missing.** Each cause now has a `--self-test` probe, and five mutants (one per fix) were each caught:

1. **155 `DROP POLICY` statements were not parsed**, so every policy removed on purpose read "not applied".
2. **Three table renames were not followed** — `plants → cultivar_plants`, `business_assets → cost_objects`, `campaign_tone_samples → business_voice_samples`.
3. **`storage.objects` policies were looked for in `public`.**
4. **Two migrations written the same day were ordered alphabetically.** `bpc_member_insert` is created in `20260727_rbac_resource_action_flip` and dropped in `20260727_rbac_flip_corrections`, which sorts *first*. Same-day files are now unordered: both outcomes are consistent, and the database says which ran last.
5. **A cleanup `DROP … IF EXISTS` before a `CREATE` in the same file was judged as the file's effect.** Only a file's last statement on an object counts.

⚠️ The old header also promised the run *"FAILS when the unresolved population exceeds its declared ceiling in `migration-apply-baseline.json`"*. **That file never existed and no code read it.** Removed.

⚠️ `docs/audits/migration-apply-state-stage3.sql` — a generated, dated snapshot of the old query — is **deleted**. `--catalog` runs the current query; `--sql` prints it.

---

## Data backfills — declared, not re-measured

Eleven migrations only UPDATE/INSERT/DELETE, so no catalog check sees them. Each now has a declared check in **`migration-data-checks.json`** (evidence · invariant · superseded · unverifiable), run by `--catalog`. `--self-test` fails if a data-only migration has no entry, an entry names a file that is not data-only, or a `superseded_by` file does not exist — so the list cannot rot the way the 2026-06-24 audit list did.

| File | Check | Result |
|---|---|---|
| `20260608_advert_channels_config` | evidence | ✅ both social rows carry `advert_channels` |
| `20260611_delete_debris_trace_enterprises_nursery` | invariant | ✅ debris row absent |
| `20260614_cost_to_produce_trace_seed` | unverifiable | target business gone (#250) |
| `20260614_cost_to_produce_restore_truncated_lines` | unverifiable | target business gone (#250) |
| `20260727_align_floor_to_bundles` | superseded | floor rewritten since |
| `20260727b_align_floor_assets_retired` | invariant | ✅ no alias or floor holds `assets:*` |
| `20260729_backfill_billing_from_legacy` | invariant | ✅ 0 of 1,990 customers unbackfilled |
| `20260730a_owner_holds_all_backfill` | superseded | OWNER floor rewritten by five later migrations |
| `20260730b_owner_member_row_invariant` | invariant | ✅ every owner has an active OWNER row |
| `20260802_trialling_modules_are_live` | evidence | ✅ its audit row exists |
| `20260802b_module_classification_corrections` | evidence | ✅ its audit row exists |

⚠️ An **invariant** that holds proves nothing is broken, not that the file ran — a table with nothing to clean passes too. Stated so a HOLDS is not read as an APPLIED.
⚠️ `20260802b` turned five planned modules off; `contractor_tiers` is on again for both tenants, each with an audited enable after 2026-08-02. That is later deliberate activity, not a failed migration.
