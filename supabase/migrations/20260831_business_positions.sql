-- ════════════════════════════════════════════════════════════════════════════════
-- 20260831 — POSITIONS: A BUSINESS DESCRIBES A JOB BEFORE IT FILLS ONE
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, in the Supabase SQL EDITOR (§6 r17 — NEVER the table editor: its
-- `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, which RLS cannot filter.
-- The SQL editor is NOT the gap; that was proven by the V4 probe, not assumed).
--
-- 🔴 THIS MIGRATION CREATES NO ROLE AND GRANTS NOTHING. It adds three tables that describe WORK.
--    Nothing here writes `business_members`, `role_definitions` or any permissions array; nothing
--    calls `assign_member_role` or `save_role_permissions`; no policy anywhere else is touched.
--    That is the scope bar of the build and V5 below asserts it against the catalog.
--
-- WHY. LAWNS has no written position descriptions at all. Joel arrives as operations manager with
-- nothing to hand him. Asked who should be able to do what, every person became an owner — not
-- from laziness, but because CONFIGURING PERMISSIONS ASKS A HARDER QUESTION THAN THE ONE THEY
-- COULD NOT ANSWER. The inversion is to ask what a person DOES. Every owner can answer that.
--
-- ── THE SPLIT: CATALOGUE IN CODE, TENANT DATA HERE ──────────────────────────────────────────
-- The 93 responsibilities are a TypeScript constant (`packages/shared/src/positions/
-- responsibilityCatalogue.ts`) — the `TILE_REGISTRY` ↔ `business_modules` split, for the reason
-- `tileRegistry.ts:17-27` gives and the reason the role floor proves: `20260623…:201` seeded the
-- shared floor by migration and that INSERT NEVER LANDED on the live project (0 rows, verified —
-- `scripts/seed-role-floor.mjs:4-7`). A catalogue carrying permission strings does not go in
-- casually-editable rows. THESE tables hold only what the TENANT decides.
--
-- ⚠️ THEREFORE `business_position_responsibilities.responsibility_id` IS NOT A FOREIGN KEY, and
--    that is a decision rather than an omission: its parent is a code constant, so there is
--    nothing for Postgres to reference. The cost is stated where it is paid — a pick whose
--    catalogue row is later deleted becomes an orphan the database cannot refuse. The consumer
--    absorbs it (`buildPositionDocument` DROPS an unresolvable pick rather than printing a blank
--    line), and the catalogue's own test forbids renaming an id in place.
--
-- ── AUTHORITY: `settings:update`, AND THE STRING WAS DERIVED FROM THE ACT ────────────────────
-- 🔴 Per the 2026-07-31 ruling, the question is *what capability is being exercised*, never *who
-- needs to pass*. The act is: describing what a job in this business is responsible for. It
-- creates no role, grants no authority, and hands nobody a permission. `settings:update` is the
-- business-configuration write verb and it is what the catalogue's own SYS-04 row ("Configure the
-- business profile and settings") already cites.
--
-- ⚠️ `team:update` WAS CONSIDERED AND REJECTED ON THE STORY'S OWN LOGIC, recorded so it is a
--    decision: gating a job DESCRIPTION behind the authority to CHANGE WHO HOLDS POWER would say
--    you may only describe a job if you may also promote someone — which is precisely the
--    conflation this feature exists to break. It is also `sensitivity:'owner-only'`, so it would
--    make the surface unreachable for the manager the story is written about.
--
-- READ is `is_active_member` — a staff member may read their own position description, which is
-- the entire point of writing one. That is AC-2's default and it is DELIBERATE, not a widening:
-- these tables hold no money, no cost, no wage and no permission array.
--
-- 🔴 EVERY WRITE POLICY CARRIES A PERMISSION STRING. It would have been shorter to write
--    `FOR ALL USING (is_active_member(business_id))` and it is exactly what tech-debt #123/#124
--    are about — eighteen over-wide policies, `business_pmi_schedule_member_all` among them,
--    `FOR ALL` on membership with no string at all. Not adding a nineteenth.
-- ════════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- 1 — business_context: the three things the platform does NOT already know
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 THREE COLUMNS, NOT SEVEN, AND THE SUBTRACTION IS THE DESIGN. The story asked for five
-- context fields. Two of them the platform already holds and must never ask for again:
--   · DAYS CLOSED        → `business_operating_days` (20260828, applied and catalog-verified
--                          2026-08-30). Read it; do not ask.
--   · HOW MANY PEOPLE    → `business_members` (+ `labor_resources` for crew and contractors).
--                          Countable. ⚠️ `labor_resources` sits behind the financial wall —
--                          COUNT it, never read it for anything else.
-- Name, address, phone, website and email are on `businesses` and are likewise not re-asked.
--
-- ⚠️ WHY ITS OWN TABLE RATHER THAN THREE COLUMNS ON `businesses`: `businesses` is already
--    THREE DISJOINT ACTS on one row (2026-08-21 ruling — CREATION / IDENTITY / ACCOUNTING),
--    declared in `verify-write-paths`'s ALLOWED_DIVERGENCE with its reasons written out. Its
--    profile writer `set_business_profile` SETs all five identity columns UNCONDITIONALLY — it
--    is NOT a patch API, and routing a narrative save through it would send nulls into columns
--    it does not hold. A fourth act on that row means editing that declaration and widening a
--    boundary `verify-profile-writer-boundary.mjs` exists to hold. One new table, one writer.
CREATE TABLE IF NOT EXISTS public.business_context (
  business_id  uuid        PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  what_we_do   text,
  who_we_serve text,
  known_for    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_context IS
  'The three narrative facts about a business that NOTHING ELSE IN THE PLATFORM HOLDS, captured once and reused by every generated position description. Deliberately does NOT hold days-closed (business_operating_days) or headcount (business_members / labor_resources) or any identity field (businesses) — the generator must never ask for what the system already knows. business_id is the PRIMARY KEY: one row per business, so an upsert cannot mint a second. READ = is_active_member; WRITE = settings:update. Written by packages/shared/src/positions/positionStore.ts.';
COMMENT ON COLUMN public.business_context.what_we_do IS
  'One or two lines, the owner''s words, e.g. "grows and sells shade trees on 40 acres in Leander". Rendered after the business name, so a leading "We" is stripped by the assembler. NULL renders NO sentence at all — never a blank (A9: absent is not empty).';
COMMENT ON COLUMN public.business_context.who_we_serve IS
  'Who the business sells to, e.g. "landscapers, builders and homeowners". Rendered as "We sell to X." NULL omits the sentence.';
COMMENT ON COLUMN public.business_context.known_for IS
  'What the business is known for, in the owner''s words. Rendered as "What we are known for: X." NULL omits the sentence.';

-- ════════════════════════════════════════════════════════════════════════════════
-- 2 — business_positions: a job, its title, and the sentence only the owner can write
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_positions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  excellence_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One title per business. Two positions called "Operations Manager" is a duplicate, not a design.
CREATE UNIQUE INDEX IF NOT EXISTS business_positions_title_key
  ON public.business_positions (business_id, lower(title));

COMMENT ON TABLE public.business_positions IS
  'A JOB a business has defined, independent of whoever holds it. IT IS NOT A ROLE AND IT GRANTS NOTHING — there is no permissions column here, no FK to business_members and no FK to role_definitions, deliberately: a position describes work, a role carries authority, and the whole feature exists because those two questions are not the same question. READ = is_active_member; WRITE = settings:update.';
COMMENT ON COLUMN public.business_positions.title IS
  'What the business calls the job, e.g. "Operations Manager". Unique per business, case-insensitively (business_positions_title_key).';
COMMENT ON COLUMN public.business_positions.excellence_note IS
  '🔴 "WHAT DOING THIS WELL LOOKS LIKE HERE" — in the OWNER''S OWN WORDS, quoted verbatim on the printed description and never rewritten, summarised or generated. It is the one field on the whole surface that carries more weight than the rest: it is what makes the document read as this business''s rather than as a template with the blanks filled in. NULL is honest and prints nothing.';

-- ════════════════════════════════════════════════════════════════════════════════
-- 3 — business_position_responsibilities: the ticks, and the per-position cadence override
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_position_responsibilities (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id       uuid        NOT NULL REFERENCES public.business_positions(id) ON DELETE CASCADE,
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  responsibility_id text        NOT NULL,
  frequency         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, responsibility_id)
);

CREATE INDEX IF NOT EXISTS bpr_position_idx ON public.business_position_responsibilities (position_id);

COMMENT ON TABLE public.business_position_responsibilities IS
  'WHICH responsibilities a position carries. One row per tick. business_id is CARRIED HERE rather than reached through position_id so RLS is a single-table predicate with no join (AC-3: a cross-tenant read returns no rows, it never resolves a wrong-tenant record). UNIQUE (position_id, responsibility_id) makes a double-tick unrepresentable rather than merely unlikely (R-12).';
COMMENT ON COLUMN public.business_position_responsibilities.responsibility_id IS
  '🔴 A CATALOGUE ID (e.g. ''SEL-01'') AND DELIBERATELY NOT A FOREIGN KEY — its parent is a TypeScript constant, RESPONSIBILITY_CATALOGUE, so there is no table to reference. The cost is real and is absorbed at the consumer: a pick whose row no longer exists is DROPPED by buildPositionDocument rather than printed as a blank line, and the catalogue''s test forbids renaming an id in place. Storing the TEXT of the responsibility here instead was rejected — it would freeze a copy of the catalogue in every tenant''s rows and drift the day we fix a typo.';
COMMENT ON COLUMN public.business_position_responsibilities.frequency IS
  '🔴 NULL MEANS "THE CATALOGUE DEFAULT STANDS" — it is not a missing value and it must never be backfilled with a copy of the default. A stored copy is a SECOND TRUTH the moment the catalogue default changes (R-27: a projection is either correct or absent, never stale), and the whole point of a default is that it can be corrected for everyone at once. Only an owner''s deliberate override is stored. Values are RESPONSIBILITY_CATALOGUE''s ResponsibilityFrequency union; deliberately NO CHECK constraint, so widening the union is a code change and not a migration — the cost_source / business_discovery_profiles.status precedent.';

-- ════════════════════════════════════════════════════════════════════════════════
-- 4 — RLS. Read = membership. Write = settings:update. Nothing is FOR ALL on membership alone.
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.business_context                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_positions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_position_responsibilities   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_context_member_read ON public.business_context;
CREATE POLICY business_context_member_read ON public.business_context
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS business_context_settings_write ON public.business_context;
CREATE POLICY business_context_settings_write ON public.business_context
  FOR ALL TO authenticated
  USING       (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK  (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

DROP POLICY IF EXISTS business_positions_member_read ON public.business_positions;
CREATE POLICY business_positions_member_read ON public.business_positions
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS business_positions_settings_write ON public.business_positions;
CREATE POLICY business_positions_settings_write ON public.business_positions
  FOR ALL TO authenticated
  USING       (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK  (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

DROP POLICY IF EXISTS bpr_member_read ON public.business_position_responsibilities;
CREATE POLICY bpr_member_read ON public.business_position_responsibilities
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS bpr_settings_write ON public.business_position_responsibilities;
CREATE POLICY bpr_settings_write ON public.business_position_responsibilities
  FOR ALL TO authenticated
  USING       (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'))
  WITH CHECK  (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:update'));

-- updated_at — reuses set_updated_at_generic() (20260604_business_modules.sql). No new function.
DROP TRIGGER IF EXISTS business_context_updated_at ON public.business_context;
CREATE TRIGGER business_context_updated_at
  BEFORE UPDATE ON public.business_context
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS business_positions_updated_at ON public.business_positions;
CREATE TRIGGER business_positions_updated_at
  BEFORE UPDATE ON public.business_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying, against the LIVE CATALOG. Expected in [brackets].
-- These hit information_schema / pg_catalog, never the builder's memory (§9 schema gate).
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — all three tables exist with RLS ON:  [3 rows, all relrowsecurity = true]
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('business_context','business_positions','business_position_responsibilities')
--      AND relnamespace = 'public'::regnamespace ORDER BY relname;
--
-- V2 — every table has BOTH a SELECT policy and a write policy:  [6 rows, 2 per table]
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('business_context','business_positions','business_position_responsibilities')
--    ORDER BY tablename, policyname;
--
-- V3 🔴 — NO write policy is membership-only. Every one names settings:update:  [3 rows]
--   SELECT tablename, policyname FROM pg_policies
--    WHERE tablename IN ('business_context','business_positions','business_position_responsibilities')
--      AND cmd = 'ALL' AND qual LIKE '%settings:update%';
--   (If this returns fewer than 3, a write policy is over-wide — the #124 class. STOP.)
--
-- V4 🔴 — THE TABLE-EDITOR FINGERPRINT (§6 r17). Expect ZERO rows. A row here means a table was
--         created outside the migration path and carries TRUNCATE/REFERENCES for `anon`, which
--         RLS cannot filter. Reads pg_class.relacl via aclexplode — NEVER
--         information_schema.role_table_grants, which returns zero rows on a database full of
--         violations when the querying role is not a member of the grantee.
--   SELECT c.relname, a.grantee::regrole::text, a.privilege_type
--     FROM pg_class c, aclexplode(c.relacl) a
--    WHERE c.relname IN ('business_context','business_positions','business_position_responsibilities')
--      AND a.grantee::regrole::text = 'anon'
--      AND a.privilege_type IN ('TRUNCATE','REFERENCES');
--
-- V5 🔴 — THE SCOPE BAR, ASSERTED RATHER THAN CLAIMED. This migration must not have touched the
--         authority model. Expect the OWNER floor UNCHANGED at 57 and no new permission string.
--   SELECT role_key, jsonb_array_length(permissions) AS n
--     FROM public.role_definitions WHERE business_id IS NULL ORDER BY role_key;   [OWNER = 57]
--
-- V6 — the reused trigger function is present and neither table minted its own:  [1 row]
--   SELECT proname FROM pg_proc WHERE proname = 'set_updated_at_generic';
--
-- END OF MIGRATION
