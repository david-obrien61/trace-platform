# SQL Drift Correction — business_members INSERT Schema
**Date:** 2026-06-02  
**Type:** Documentation correction  
**Trigger:** David hit a runtime error running manual SQL from a runbook

---

## What was wrong

Two runbooks both contained SQL to insert David's OWNER row into `business_members` for LAWNS. They disagreed on schema:

| Field | member-path-fix runbook (WRONG) | cultivar-integration runbook (CORRECT) |
|---|---|---|
| Column list | `(business_id, user_id, role, permissions, active)` | `(business_id, user_id, name, email, role, permissions, active)` |
| `name` | **omitted** | `'David O''Brien'` |
| `email` | **omitted** | `'david_obrien2016@outlook.com'` |
| `permissions` type | `ARRAY[...]` | `'[...]'::jsonb` |

The `member-path-fix` runbook was written in Prompt 4. The `cultivar-integration` runbook was written in Prompt 3 when the table was first designed. The Prompt 4 runbook was drafted without re-checking the canonical schema in the migration file.

---

## Actual schema (from migration)

File: `supabase/migrations/20260602_shared_members_a_create_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS business_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text        NOT NULL,   -- ← NOT NULL, must always be provided
  email         text,                   -- ← nullable (null for SMS-only invites)
  phone         text,
  role          text        NOT NULL,
  permissions   jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- ← jsonb, not text[]
  active        boolean     NOT NULL DEFAULT false,
  ...
);
```

**Three rules that caused this failure:**
1. `name` is NOT NULL — omitting it from the column list causes a null constraint violation
2. `permissions` is `jsonb` — `ARRAY[...]` produces `text[]`, which Postgres rejects on assignment to a jsonb column
3. Apostrophes in string literals need SQL escaping: `O''Brien` not `O'Brien`

---

## What was fixed

**File:** `docs/runbooks/multi-tenant-extraction-member-path-fix-2026-06-02.md`  
**Section:** "David's OWNER row in business_members"

Added a schema requirements note above the SQL block. Replaced the incorrect SQL with:

```sql
INSERT INTO business_members (business_id, user_id, name, email, role, permissions, active)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  (SELECT id FROM auth.users WHERE email = 'david_obrien2016@outlook.com'),
  'David O''Brien',
  'david_obrien2016@outlook.com',
  'OWNER',
  '["manage_settings","manage_team","view_dashboard","qr_checkout","view_orders","manage_deliveries","manage_campaigns","manage_customers","view_reports"]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
```

Note: uses `(SELECT id FROM auth.users WHERE ...)` rather than `auth.uid()` — the subquery is more reliable in the Supabase SQL editor where you're typically running as the service role and `auth.uid()` returns null.

---

## No other files affected

`grep -rn "INSERT INTO business_members"` returned exactly two hits (the two runbooks above). No migrations, scripts, or application code contained manual INSERT examples.

---

## Prevention

When writing runbook SQL that references a table created in the same session:
1. Look up the actual `CREATE TABLE` statement — don't rely on memory of the column list
2. Check NOT NULL constraints explicitly; they are invisible in the error unless you count columns
3. Check jsonb columns — `ARRAY[...]` is a common mistake; correct form is `'[...]'::jsonb`

*Correction per CLAUDE.md Part 9, Step 11 (factual correction capture).*
