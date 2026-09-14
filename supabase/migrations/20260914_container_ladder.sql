-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260914_container_ladder — A CONTAINER SIZE IS A RUNG ON A LADDER, AND A RUNG IS A ROW
-- Ledger #326 · David's ruling 2026-09-14 · module: packages/shared/src/inventory/containerLadder.ts
--
-- WHY THIS TABLE EXISTS. David: *"If Terry starts running 7 gallon it must appear EVERYWHERE
-- immediately — the uppot picker offers it, the SIZE RESOLVER RECOGNISES IT, the BOM can attach to
-- it, the count screen and load list read it. A migration to add a container size is the failure
-- this exists to prevent."*
--
-- 🔴 IT WAS NOT HYPOTHETICAL WHEN IT WAS WRITTEN. Measured 2026-09-14: **21 live LAWNS rows already
-- carry `7 gal`**, and NONE of the four hardcoded size lists in the repo contains it —
-- `cultivar-os/src/lib/constants.ts` (two lists, BOTH with zero importers), a separate HAND COPY in
-- `api/orders/submit.ts:13` which is the only live one, and a prose list in `discovery/verticals`.
-- The list was forked before anybody proposed one home.
--
-- 🔴 PER TENANT, AND THIS DIVERGES FROM ITS OWN PRECEDENT ON PURPOSE. David: *"The ladder is PER
-- TENANT. Different growers run different sizes."* The channel vocabulary (R-152, ledger #310) is a
-- single GLOBAL list with no `business_id` and NO write policy at all — *"adding a channel is a
-- migration."* The one-list half carries over; the write path does not, because "Terry runs 7
-- gallon" is a fact about LAWNS and not about the platform.
--
-- 🔴 RETIRE, NEVER DELETE (R-133). `active = false` stops a rung being OFFERED. It never stops it
-- RESOLVING — past lots and past orders point at it. There is deliberately NO DELETE POLICY AT ALL,
-- so the soft delete is structural rather than a convention a future writer can forget (the shape
-- `customer_addresses` was born with, ledger #303).
--
-- 🔴 A RUNG CHANGE MUST NOT RE-COST HISTORY (D-41). Nothing references a rung by FOREIGN KEY.
-- `production_plan_lines` keeps `from_unit_value`/`to_unit_value` as NUMERICS — verified live
-- 2026-09-14 — so a past plan holds the numbers it was costed with. An FK here would re-cost every
-- past plan the day somebody corrected a volume, which is exactly what D-41 forbids.
--
-- ⚠️ NOT APPLIED. Written, not run. David applies it; the verification queries are at the foot.
-- ══════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.container_ladder (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- What a person sees, and what the grower calls it. Displayed, never re-spelled (D-23 / R-50).
  label             text NOT NULL,

  -- Extra spellings the PARSER cannot fold to this rung's numbers. "slip" needs one; "15" does not
  -- — `parseUnitOfMeasure` already folds 15 / 15 gal / #15 / 15G to 15 and the rung claims 15.
  -- A declared list of every spelling is the copy that drifts (tech-debt #73's lesson).
  aliases           text[] NOT NULL DEFAULT '{}',

  -- Position on the ladder. Ascending = bigger. THE ONLY ORDERING — never sort by volume, because
  -- a slip and a 4" pot have no comparable volume and the ladder still has an order.
  sort_order        integer NOT NULL,

  -- Trade gallons, for costing. NULL is legal and meaningful: a SLIP is a rooted cutting whose
  -- volume rounds to nothing, and a 0 there would read like a measurement (A9 — absent is not empty).
  volume_gallons    numeric CHECK (volume_gallons IS NULL OR volume_gallons > 0),

  -- ⚠️ MINUTES ARE ESTIMATES AND THE COLUMN SAYS SO. David: they have never timed this, and Terry's
  -- figure is a forty-year grower's estimate of his own speed. NULL = fall back to the yard-wide
  -- rate, which is what keeps R-89's four reproduced figures intact.
  -- ✅ THIS DOES NOT MOVE R-89. R-89 kills the FLAT CONFLATED per-pot rate (mutant P1 restores it).
  -- `setup + n × handling` is untouched: setup stays per RUN, handling becomes per RUNG.
  handling_minutes  numeric CHECK (handling_minutes IS NULL OR handling_minutes > 0),
  handling_because  text NOT NULL DEFAULT 'not timed — the yard-wide rate stands in',

  active            boolean NOT NULL DEFAULT true,
  retired_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 🔴 ONE LABEL PER TENANT, CASE-INSENSITIVELY. This CAN land as a hard unique index because the
-- table is NEW AND EMPTY — which is the difference between this and tech-debt #54/#58, where the
-- same durable fix is blocked until live rows are cleaned. Taking it now is the cheap moment.
CREATE UNIQUE INDEX IF NOT EXISTS container_ladder_business_label_key
  ON public.container_ladder (business_id, lower(btrim(label)));

-- Two rungs at one sort position make "the next rung up" undefined between them.
CREATE UNIQUE INDEX IF NOT EXISTS container_ladder_business_sort_key
  ON public.container_ladder (business_id, sort_order);

CREATE INDEX IF NOT EXISTS container_ladder_business_active_idx
  ON public.container_ladder (business_id, active, sort_order);

COMMENT ON TABLE public.container_ladder IS
  'The per-tenant container size ladder (ledger #326). Adding a size is adding a ROW, never a migration. '
  'Retire by setting active=false: a retired rung still RESOLVES for history and is simply never OFFERED (R-133). '
  'Nothing FKs to a rung — a plan snapshots the values it costed with, so correcting a rung never re-costs history (D-41).';

-- ─── RLS ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.container_ladder ENABLE ROW LEVEL SECURITY;

-- 🔴 READ IS MEMBERSHIP, NOT `settings:read`, AND THE REASON IS MEASURED. `STAFF_DEFAULT_BUNDLE`
-- holds nine strings and NO `settings:*` at all (tech-debt #188). Gating the read on a settings
-- string would blind the uppot picker and every count screen for exactly the people standing in the
-- yard using them. The ladder is reference data for anyone who can read inventory.
CREATE POLICY container_ladder_member_select ON public.container_ladder
  FOR SELECT TO authenticated
  USING (public.is_active_member(container_ladder.business_id));

-- WRITE is `settings:update` — the same string that already gates the operations config this sits
-- beside. ⚠️ Deliberately a SEPARATE policy from the read: a read gated on the WRITE string is a
-- different lie, which is tech-debt #236's defect at the install-price save.
CREATE POLICY container_ladder_settings_insert ON public.container_ladder
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(container_ladder.business_id)
              AND public.has_permission(container_ladder.business_id, 'settings:update'));

CREATE POLICY container_ladder_settings_update ON public.container_ladder
  FOR UPDATE TO authenticated
  USING (public.is_active_member(container_ladder.business_id)
         AND public.has_permission(container_ladder.business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(container_ladder.business_id)
              AND public.has_permission(container_ladder.business_id, 'settings:update'));

-- 🔴 NO DELETE POLICY OF ANY KIND. Retiring is an UPDATE. This is structural, not a convention:
-- a client has no delete path to forget about (R-133 · ledger #303's shape).

CREATE TRIGGER container_ladder_set_updated_at
  BEFORE UPDATE ON public.container_ladder
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── SEED — LAWNS'S LADDER, DICTATED BY DAVID 2026-09-14 ───────────────────────────────────────
-- slip · 4" · 3/5 gal · 15 · 30 · 45 · 65 · 95/100 · 200
--
-- ⚠️ THE 121 LIVE OFF-LADDER ROWS ARE DELIBERATELY *NOT* SEEDED AS RUNGS. Measured 2026-09-14 at
-- LAWNS: 1 gal (24 rows) · 2 gal (7) · 3 gal (53) · 5 gal (34) · 10 gal (2) · 300 gal (1). David
-- ruled they are a real population that needs the UNRESOLVED LIST, not silent promotion to rungs.
-- Seeding them would answer his open question by writing it into the database.
-- ⚠️ `3 gal` and `5 gal` are NOT in that 121 — they fold onto the `3/5 gal` rung by derived key.
--
-- Idempotent, and scoped BY NAME so it cannot land on the wrong tenant.
INSERT INTO public.container_ladder (business_id, label, aliases, sort_order, volume_gallons, handling_because)
SELECT b.id, v.label, v.aliases, v.sort_order, v.volume_gallons,
       'not timed — the yard-wide rate stands in'
FROM public.businesses b
CROSS JOIN (VALUES
  ('slip',    ARRAY['slips','cutting','cuttings'], 10,  NULL::numeric),
  ('4 in',    ARRAY['4"','4 inch','4in'],          20,  NULL::numeric),
  ('3/5 gal', ARRAY['#3/5','3/5 Gallon'],          30,  4::numeric),
  ('15 gal',  ARRAY[]::text[],                     40,  15::numeric),
  ('30 gal',  ARRAY[]::text[],                     50,  30::numeric),
  ('45 gal',  ARRAY[]::text[],                     60,  45::numeric),
  ('65 gal',  ARRAY[]::text[],                     70,  65::numeric),
  ('95/100',  ARRAY['95 gal','100 gal','95 gallon','100 gallon'], 80, 95::numeric),
  ('200 gal', ARRAY[]::text[],                     90,  200::numeric)
) AS v(label, aliases, sort_order, volume_gallons)
WHERE b.name = 'LAWNS Tree Farm, LLC'
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the table, its columns and their nullability
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='container_ladder' ORDER BY ordinal_position;
--
-- V2 · RLS ON, and exactly three policies — select/insert/update, and NO delete
--   SELECT c.relrowsecurity, p.polname, p.polcmd
--     FROM pg_class c LEFT JOIN pg_policy p ON p.polrelid=c.oid
--    WHERE c.relname='container_ladder';
--   -- EXPECT relrowsecurity = true; polcmd values r, a, w; NO 'd' row.
--
-- V3 · the nine rungs landed, in order
--   SELECT label, aliases, sort_order, volume_gallons, active FROM public.container_ladder cl
--     JOIN public.businesses b ON b.id=cl.business_id
--    WHERE b.name='LAWNS Tree Farm, LLC' ORDER BY sort_order;
--   -- EXPECT 9 rows: slip, 4 in, 3/5 gal, 15 gal, 30 gal, 45 gal, 65 gal, 95/100, 200 gal
--
-- V4 · the unique index REFUSES a second rung with the same label (run inside a rolled-back tx)
--   BEGIN;
--   INSERT INTO public.container_ladder (business_id, label, sort_order)
--     SELECT id, '15 GAL', 999 FROM public.businesses WHERE name='LAWNS Tree Farm, LLC';
--   -- EXPECT: duplicate key value violates unique constraint "container_ladder_business_label_key"
--   ROLLBACK;
--
-- V5 · 🔴 HOW MANY LIVE ROWS LAND ON A RUNG, AND HOW MANY DO NOT. This is the number that says
--      whether the ladder is right for this tenant — the off-ladder rows are a FINDING, not an error.
--   SELECT i.size, count(*) AS rows
--     FROM public.business_inventory i
--    WHERE i.business_id=(SELECT id FROM public.businesses WHERE name='LAWNS Tree Farm, LLC')
--      AND i.retired_at IS NULL AND i.size IS NOT NULL AND btrim(i.size)<>''
--      AND NOT EXISTS (SELECT 1 FROM public.container_ladder cl
--                       WHERE cl.business_id=i.business_id
--                         AND (lower(btrim(cl.label))=lower(btrim(i.size))
--                              OR lower(btrim(i.size)) = ANY (SELECT lower(btrim(a)) FROM unnest(cl.aliases) a)))
--    GROUP BY 1 ORDER BY 2 DESC;
--   -- ⚠️ THIS QUERY IS THE CRUDE FORM — it matches label/alias TEXT only, so it will over-report
--   --    (it cannot do the DERIVED numeric-key match that `resolveRung` does; "15" and "#15" will
--   --    appear here even though the app resolves them). The authoritative unresolved list is the
--   --    app's, which runs the real resolver. Included anyway because a rough catalog-side number
--   --    is worth having before the screen exists.
