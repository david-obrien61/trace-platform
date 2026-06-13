# Schema Verification — cultivar_plants untangle + policy cleanup
# Migrations:
#   supabase/migrations/20260613_cultivar_plants_untangle.sql        (RUN, catalog-confirmed)
#   supabase/migrations/20260613_cultivar_plants_policy_cleanup.sql  (WRITTEN — pending David apply)
# Project: bgobkjcopcxusjsetfob (cultivar-os Supabase)
# Two-half protocol per Tech Debt #31: Thunder writes the doc + JS checks; David runs catalog SQL.

## Context

The untangle migration renamed `plants` → `cultivar_plants` (identity-only join table), dropped
stock-fact columns + `nursery_id`, added `inventory_id` FK → `business_inventory`, and updated the
SELECT policy. It was RUN. Catalog checks C1/C2/C4/C5 came back CLEAN. C3 (policy list) surfaced
FOUR policies — two of them redundant/over-broad leftovers from the old `plants` table.

The cleanup migration (`20260613_cultivar_plants_policy_cleanup.sql`) drops the redundant
public-read policy and replaces the public/ALL owner policy with an authenticated-scoped ALL
policy (so owners keep write access without the public write-hole shape). It is WRITTEN but
NOT YET APPLIED — V1–V3 below are PENDING David's run.

PostgREST on this project returns 406 for `information_schema`/`pg_catalog`, so the catalog
checks (C1–C6, V1–V3) are run by David in the Supabase SQL editor. Results recorded below.

---

## PART A — Untangle catalog checks (RUN, confirmed this session)

| Check | Result |
|---|---|
| C1 — `cultivar_plants` exists, `plants` gone | ✅ PASS — 1 row, `cultivar_plants` only |
| C2 — RLS enabled (`rowsecurity = true`) | ✅ PASS |
| C3 — Policies on `cultivar_plants` | ⚠️ FOUR policies found (see below) — drove the cleanup migration |
| C4 — `inventory_id` FK present; `nursery_id` + stock-fact cols absent; identity cols intact | ✅ PASS |
| C5 — `inventory_id` FK constraint → `business_inventory(id)` | ✅ PASS |

**C3 detail (the chaff):**
| Policy | Role | Cmd | Qual | Disposition |
|---|---|---|---|---|
| `anon_select_plants` | anon | SELECT | `USING(true)` | KEEP — QR scan resolves a tag |
| `cultivar_plants_owner_select` | authenticated | SELECT | owner-or-member scoped | KEEP |
| `plants_business_owner` | public | ALL | `business_id IN (owner's businesses)` | REPLACE — only WRITE grant |
| `plants_select_public` | public | SELECT | `USING(true)` | DROP — redundant w/ anon_select |

---

## PART B — Cleanup catalog checks (PENDING — David runs after applying the cleanup migration)

### V1 — Exactly THREE policies remain, leftovers gone
**Query:** (embedded as comment in `20260613_cultivar_plants_policy_cleanup.sql`)
**Expected — exactly 3 rows:**
- `anon_select_plants` — SELECT — anon
- `cultivar_plants_owner_all` — ALL — authenticated
- `cultivar_plants_owner_select` — SELECT — authenticated
- ABSENT: `plants_business_owner`, `plants_select_public`

**Result:** _PENDING — David to run V1 in SQL editor and paste result here._

**Verdict: PENDING**

---

### V2 — No public/ALL policy remains (write-hole shape eliminated)
**Query:** count of policies with `polcmd = '*'` AND `polroles = '{0}'` (public).
**Expected:** `0`

**Result:** _PENDING — David to run V2 and paste result here._

**Verdict: PENDING**

---

### V3 — RLS still enabled
**Query:** `relrowsecurity` on `cultivar_plants`.
**Expected:** `true`

**Result:** _PENDING — David to run V3 and paste result here._

**Verdict: PENDING**

---

## Summary

| Check | Verdict |
|---|---|
| C1: rename took, old table gone | ✅ PASS |
| C2: RLS enabled | ✅ PASS |
| C3: policy list (drove cleanup) | ⚠️ 4 policies — addressed by cleanup migration |
| C4: identity-only cols + inventory_id FK | ✅ PASS |
| C5: inventory_id FK → business_inventory | ✅ PASS |
| V1: exactly 3 policies post-cleanup | ⏳ PENDING David |
| V2: no public/ALL policy | ⏳ PENDING David |
| V3: RLS still enabled | ⏳ PENDING David |

**Status:** Untangle VERIFIED CLEAN (catalog-confirmed). Policy cleanup migration WRITTEN —
flips to VERIFIED once David runs the cleanup migration and pastes V1–V3 results above.
PLATFORM_STATE reflects this split: `cultivar_plants` = WIRED (untangle catalog-confirmed;
policy cleanup pending David apply + V1–V3).
