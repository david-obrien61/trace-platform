# Schema Verification — business_voice_samples rename
# Migration: supabase/migrations/20260613_business_voice_samples.sql
# Project: bgobkjcopcxusjsetfob (cultivar-os Supabase)
# Catalog-verified in SQL editor 2026-06-13; results recorded by close-out.

## Context

Migration renamed `campaign_tone_samples` → `business_voice_samples` and added a `source text NOT NULL`
column. The JS-client-reachable checks were run by Thunder (via `scripts/verify-business-voice-samples.mjs`).
The catalog checks (C1–C6) require `information_schema`/`pg_catalog` — PostgREST on this project returns
406 for those schemas, so they were run by David in the Supabase SQL editor. Results below.

---

## JS-Client Checks (run by Thunder 2026-06-13)

| Check | Result |
|---|---|
| `business_voice_samples` queryable | ✅ PASS — 0 rows (table is new/empty post-rename) |
| `campaign_tone_samples` absent | ✅ PASS — PostgREST schema cache miss (table gone) |
| Anon/unauthenticated query returns 0 rows (RLS active) | ✅ PASS |

Source: `node scripts/verify-business-voice-samples.mjs` output, 2026-06-13.

---

## Catalog Checks C1–C6 (run by David in SQL editor 2026-06-13)

### C1 — Rename took; old table gone
**Query:** `SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('business_voice_samples', 'campaign_tone_samples') ORDER BY table_name;`

**Result:** Exactly 1 row — `business_voice_samples | public`. `campaign_tone_samples` absent.

**Verdict: PASS**

---

### C2 — RLS enabled
**Query:** `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'business_voice_samples' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');`

**Result:** `relrowsecurity = true`

**Verdict: PASS**

---

### C3 — Policy attached and owner-scoped (high-risk rename check)
**Query:** `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr FROM pg_policies WHERE tablename = 'business_voice_samples' AND schemaname = 'public';`

**Result:**
- `polname = 'business_voice_samples_owner'`
- `polcmd = 'ALL'`
- `using_expr = (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))`

Policy survived the rename (RENAME preserves pg_policies row). Owner-scoped. 1 policy row.

**Verdict: PASS**

---

### C4 — source column: type, NOT NULL, DEFAULT dropped, comment present
**Query:** `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_voice_samples' AND column_name = 'source';`

**Result:** `data_type = 'text'`, `is_nullable = 'NO'`, `column_default = NULL` (DEFAULT dropped post-backfill as designed).

Column comment present: `'capability key from shared/src/ai/capabilities.ts'`

**Verdict: PASS**

---

### C5 — FKs intact
**Query:** (full FK query via `information_schema.table_constraints` + `key_column_usage` + `constraint_column_usage`)

**Result:** `business_id → businesses.id` FK intact. Rename preserved FK constraints.

**Verdict: PASS**

---

### C6 — Full column list: 7 columns, source last
**Query:** `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_voice_samples' ORDER BY ordinal_position;`

**Result:** 7 columns in order: `id`, `business_id`, `platform`, `original_text`, `edited_text`, `created_at`, `source`. All original columns present. `source` added last as designed.

**Verdict: PASS**

---

## Summary

All 6 catalog checks CLEAN. All 3 JS-client checks PASS.

| Check | Verdict |
|---|---|
| C1: Rename took, old table gone | ✅ PASS |
| C2: RLS enabled | ✅ PASS |
| C3: Policy attached, owner-scoped | ✅ PASS |
| C4: source column, NOT NULL, no DEFAULT, comment | ✅ PASS |
| C5: FK business_id → businesses.id intact | ✅ PASS |
| C6: 7 columns, correct types, source last | ✅ PASS |

**Migration VERIFIED CLEAN. PLATFORM_STATE → WIRED (verified 2026-06-13).**
