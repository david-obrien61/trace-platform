-- ════════════════════════════════════════════════════════════════════════════════
-- 20260830b — business_operating_days: NAME THE CLOSED SET, AND SAY WHAT THE COLUMNS MEAN
-- ════════════════════════════════════════════════════════════════════════════════
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-08-30 (verified via `date` — clock not drifted).  Ledger #235.
-- Follows: 20260828_business_operating_days.sql (applied 2026-08-30, catalog-verified).
--
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17:
-- the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS
-- cannot filter TRUNCATE). Nothing here creates a table, so this is belt-and-braces — but the rule
-- is stated where the actor stands.
--
-- ADDITIVE ONLY. One NAMED CHECK constraint and eleven COMMENTs. No column added, dropped or
-- retyped. No policy, trigger, index or grant touched. NOTHING IS DROPPED.
--
-- ── WHY (a): THE CHECK — David's call, 2026-08-30 ────────────────────────────────
-- `day_type` shipped as NOT NULL free text with no CHECK. A wrong string therefore INSERTS fine.
-- It does not fail silently — the reader renders `<value> · not checked` and the editor row says
-- `not recognised — not checked`, which is the honest behaviour and better than guessing — but it
-- never FLAGS, so a typo produces a calendar that quietly checks nothing on that day.
-- David: *"it IS a closed set of four, so it earns a constraint."*
--
-- ⚠️ THIS IS A DELIBERATE NARROWING OF THE ORIGINAL MIGRATION'S AC-4 POSITION, AND IT COSTS TWO
--    THINGS. Recorded here rather than discovered later:
--      1. The 20260828 header argued `day_type` free text so *"the value set grows without a
--         migration"* — a print shop with a `press_maintenance` day. That is now a MIGRATION,
--         not a data entry. The four are frozen until someone widens this constraint.
--      2. It makes the reader's unrecognised-value path UNREACHABLE FROM THE DATABASE:
--         `dayTypeMeta()`'s `?? null`, the `(custom)` <option>, and the `· not checked` render
--         become dead for any row this constraint admits. They are deliberately NOT deleted —
--         they remain the correct behaviour for a row that predates this constraint, and for the
--         day the set is widened. (§6 r10: divergence recorded, not silent.)
--
-- 🔴 NAMED, NOT INLINE — the #91 lesson. An inline CHECK is auto-named by Postgres, so its name is
--    never typed by anyone, and a name-grep can never find it. #91 is exactly that: two adjacent
--    platform CHECKs disagreeing about a value set, one of them declared inline in
--    20260529_campaigns.sql:26-27 and therefore invisible to every search that went looking.
--
-- ⚠️ PRE-FLIGHT — RUN THIS FIRST. The ADD CONSTRAINT below will FAIL LOUDLY if any stored row is
--    outside the four, which is correct: the failure names a real defect. This query names the
--    offending rows BEFORE you hit it, so a failure is diagnosed rather than mysterious.
--    Expected: ZERO ROWS.
--      SELECT d.id, b.name AS business, d.weekday, d.on_date, d.day_type
--        FROM business_operating_days d JOIN businesses b ON b.id = d.business_id
--       WHERE d.day_type NOT IN ('service','delivery_only','delivery_placement','closed');
--
-- ── WHY (b): THE COMMENTS ────────────────────────────────────────────────────────
-- The 20260828 migration carried none. That is why the weekday convention had to be ASKED FOR
-- rather than read off the table: 0=Sunday (JS getDay()) is stated in the migration's prose and in
-- `operationsCalendar.ts:33`, and in NEITHER place a `psql \d+` or a dashboard column view reaches.
-- A convention that lives only in prose is a convention the next reader guesses at, and guessing
-- 1=Monday (ISO) shifts the entire week by one day while every screen still looks plausible.
-- ════════════════════════════════════════════════════════════════════════════════


-- ── §1 — THE CLOSED SET, NAMED ───────────────────────────────────────────────────
ALTER TABLE business_operating_days
  DROP CONSTRAINT IF EXISTS business_operating_days_day_type_check;

ALTER TABLE business_operating_days
  ADD  CONSTRAINT business_operating_days_day_type_check
  CHECK (day_type IN ('service', 'delivery_only', 'delivery_placement', 'closed'));


-- ── §2 — WHAT THE TABLE AND ITS COLUMNS MEAN ─────────────────────────────────────
COMMENT ON TABLE business_operating_days IS
  'WHAT KIND OF DAY each day is, per business, so the operations calendar can flag work booked on the wrong kind of day. TWO ROW KINDS, EXACTLY ONE FIELD SET (enforced by business_operating_days_one_kind): weekday IS NOT NULL = the recurring weekly pattern; on_date IS NOT NULL = a date-level exception. THE EXCEPTION WINS over the pattern for its day. IT WARNS, IT NEVER BLOCKS — there is no trigger, no FK to an activity and no constraint here that can refuse a delivery on a maintenance Monday (2026-08-23 attribution-over-approval). READ = is_active_member; WRITE = settings:update. Read by packages/cultivar-os/src/lib/operationsCalendar.ts.';

COMMENT ON COLUMN business_operating_days.id IS
  'Surrogate key. System-managed.';

COMMENT ON COLUMN business_operating_days.business_id IS
  'Owning tenant. AC-3: tenant scope is never implied by a key that happens to be unique — every read and write carries this explicitly.';

COMMENT ON COLUMN business_operating_days.weekday IS
  '🔴 0 = SUNDAY, 1 = Monday … 6 = Saturday. This is JavaScript Date.getDay(), NOT ISO-8601 (which is 1=Monday…7=Sunday). The reader is operationsCalendar.ts:51 weekdayOf() = parseYmd(d).getDay(), and WEEKDAY_NAMES[0] is literally the string ''Sunday''. Reading this as ISO shifts the whole week by one day and every screen still looks plausible. NULL on an exception row; NOT NULL on a pattern row (see business_operating_days_one_kind).';

COMMENT ON COLUMN business_operating_days.on_date IS
  'The single calendar day this rule overrides, as a DATE (no time, no zone). Set on an exception row; NULL on a pattern row. An exception BEATS the weekly pattern for its day — that is the whole reason exceptions exist: a big delivery landing on a maintenance Monday is answered with a row here, never by editing the pattern and silently changing every other Monday. Parsed as LOCAL midnight by parseYmd(); never new Date(str), which is UTC and reads as the previous day west of Greenwich.';

COMMENT ON COLUMN business_operating_days.day_type IS
  'What the day is FOR. CLOSED SET OF FOUR, enforced by business_operating_days_day_type_check as of 20260830b: service (equipment/site work — flags any delivery) | delivery_only (drop-offs — flags deliveries whose service_type is planting) | delivery_placement (permissive; flags nothing) | closed (flags everything). The catalog that gives each its label and its exclusions is DAY_TYPE_CATALOG in operationsCalendar.ts:142. ⚠️ WIDENING THIS SET IS A MIGRATION, not data entry — see 20260830b''s header for the AC-4 cost that was accepted to get the constraint.';

COMMENT ON COLUMN business_operating_days.note IS
  'Free text, why this day is what it is ("Joel + Tyler on equipment"; "Terry travelling"). Never parsed, never matched on, never rendered as a rule.';

COMMENT ON COLUMN business_operating_days.created_at IS
  'System-managed (CLAUDE.md §6 r13 — displays locked-with-explanation, never silently greyed).';

COMMENT ON COLUMN business_operating_days.updated_at IS
  'System-managed; maintained by the business_operating_days_updated_at BEFORE UPDATE trigger via set_updated_at_generic(). Never written by the app.';

COMMENT ON CONSTRAINT business_operating_days_one_kind ON business_operating_days IS
  'EXACTLY ONE of weekday / on_date. A row with both is ambiguous; a row with neither is a rule that silently never matches. This constrains the SHAPE of a row, never the vocabulary of a value — it is not the AC-4 axis.';

COMMENT ON CONSTRAINT business_operating_days_day_type_check ON business_operating_days IS
  'The four day types the calendar can actually check. Added 20260830b, ledger #235: day_type shipped as free text and a wrong string inserted fine — it rendered honestly as "not recognised — not checked" but never FLAGGED, so a typo produced a day the calendar quietly stopped checking.';


-- ════════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- Verify after applying (catalog gate — §9; structure AND the constraint, both required):
--
--   -- ① the constraint exists, is NAMED, and holds the four:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'business_operating_days'::regclass AND contype = 'c'
--    ORDER BY conname;
--   -- Expected 3: ..._day_type_check · ..._one_kind · ..._weekday_range
--
--   -- ② the comments landed where a \d+ will find them:
--   SELECT a.attname, col_description(a.attrelid, a.attnum) AS comment
--     FROM pg_attribute a
--    WHERE a.attrelid = 'business_operating_days'::regclass AND a.attnum > 0 AND NOT a.attisdropped
--    ORDER BY a.attnum;
--   -- Expected: a non-null comment on all 8 columns; `weekday` must say 0 = SUNDAY.
--
--   SELECT obj_description('business_operating_days'::regclass, 'pg_class');
--   -- Expected: the table comment, non-null.
--
--   -- ③ the constraint actually refuses (run in a transaction and ROLL BACK):
--   BEGIN;
--     INSERT INTO business_operating_days (business_id, weekday, day_type)
--     SELECT id, 1, 'not_a_real_day_type' FROM businesses LIMIT 1;
--     -- Expected: ERROR  new row ... violates check constraint "business_operating_days_day_type_check"
--   ROLLBACK;
-- ════════════════════════════════════════════════════════════════════════════════
