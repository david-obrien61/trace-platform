-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260914 — `price_unit` IS A SHAPE, NOT A CLOSED LIST (AC-1 · ledger #328 · recon #327)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17).
--
-- WHY. `service_offerings.price_unit` has been `CHECK (price_unit IN ('order','plant','vehicle',
-- 'visit')) DEFAULT 'plant'` since 20260529. Three of those four values are universal. **`'plant'`
-- is a grower's noun frozen into a platform constraint, and it is also the DEFAULT** — so every
-- service offering any business creates is "per plant" until someone changes it.
--
-- 🔴 THE FINDING IS NOT THE NOUN. IT IS THAT THE MECHANISM TO VARY ALREADY EXISTS AND THE DATABASE
--    REFUSES IT. `packages/shared/src/discovery/verticals/nursery.ts` already supplies `price_unit`
--    as a VALUE in a per-vertical seed file — a `verticals/` directory, one file per vertical,
--    identity as data. That is textbook AC-1 and it is already running in `shared`. A sibling
--    `verticals/foodbank.ts` could be written tomorrow, and the moment it wrote
--    `price_unit: 'household'` **this constraint would reject the insert.**
--    David, 2026-09-14: *"the per-vertical seed already supplies the value — the architecture is
--    right and the database refuses it."*
--
-- WHAT REPLACES IT, AND WHY NOT A LONGER LIST. A longer enum fixes nothing: vertical #3 still needs
-- a migration. So the constraint stops enumerating MEANING and starts asserting SHAPE — a lowercase
-- identifier, 1–40 characters. A food bank writes 'household'; a roaster writes 'bag'; an HVAC
-- contractor writes 'unit'. None of them needs a migration, and the column still refuses '', '   ',
-- 'Plant' (case drift) and free prose.
--
-- ⚠️ THE CASE RULE IS DELIBERATE AND IT IS NOT TIDINESS. `business_inventory.size` carries 46
-- distinct spellings of 13 real sizes at LAWNS (productionMath.ts's own header, measured
-- 2026-09-04). A column whose values are compared as strings and whose case is unconstrained
-- becomes that. One case, enforced here, is the cheapest possible prevention.
--
-- 🔴 THE DEFAULT IS DROPPED OUTRIGHT, NOT REPOINTED. `price_unit` stays NOT NULL, so an INSERT that
--    omits it now FAILS LOUDLY instead of silently becoming 'plant'. That is D-9: a caller that did
--    not say what the price is per has not said it, and a default that answers for them is a
--    confident-looking guess. MEASURED before choosing: all three application INSERT paths supply
--    `price_unit` explicitly — `pages/Settings.tsx:697`, `components/services/ServicesReview.tsx:297`
--    (via `serviceReview.ts:795`) and `discovery/seed.ts:94` — as do all four seed INSERTs in
--    20260529 itself. **Nothing in the repo relies on this default.**
--
-- ✅ IT CANNOT REJECT AN EXISTING ROW, AND THAT IS PROVEN BY CONSTRUCTION RATHER THAN BY A LIVE READ.
--    The OLD constraint is the proof: it permitted exactly {'order','plant','vehicle','visit'}, so
--    every live row holds one of those four. All four are lowercase identifiers of 5–7 characters,
--    so all four satisfy the new constraint. **No live query is needed to know this migration
--    validates cleanly** — the constraint being replaced bounds the data it was guarding.
--    ⚠️ This argument holds ONLY because the old CHECK was enforced (not NOT VALID) from creation.
--    It was: 20260529 declares it inline at table-creation, so no row ever escaped it.
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   · It does NOT touch `category`, `price_type`, `timing` or `transport_mode`. Those enumerate
--     PLATFORM concepts (is this transport? is it flat?), not a vertical's vocabulary. `category`
--     has its own open question — tech-debt #217, 'uncategorized' is not a value it accepts.
--   · It does NOT make `price_unit` a lookup table. **That is R-152's shape and it is the fuller
--     form of this fix** — David ruled exactly this class for channel names: *"one list… Adding a
--     channel becomes a row, and drift becomes structurally impossible rather than a discipline."*
--     ⚠️ R-152's driver was DRIFT BETWEEN TWO CONSTRAINTS that disagreed; `price_unit` has one
--     constraint and no drift, so the lookup table buys curation, not correctness. **Named here so
--     the choice is visible and David can take the fuller form whenever he wants it.**
--   · It REPAIRS NO ROW. Every existing 'plant' stays 'plant' — LAWNS sells trees and 'plant' is
--     the right unit for them. This removes a refusal; it does not relabel anything.
--
-- SCOPE: one table, one column, one constraint, one default. No policy, no RLS, no new table,
--        no permission string, no index.
-- ════════════════════════════════════════════════════════════════════════════════════════════


-- ─── A · DROP THE CLOSED CHECK — BY DEFINITION, NEVER BY NAME ────────────────────────────────
-- 🔴 THE NAME IS NOT WRITTEN ANYWHERE AND MUST NOT BE GUESSED. 20260529 declares this CHECK
--    INLINE on the column, so Postgres auto-named it. tech-debt #91 is precisely this trap:
--    *"`campaign_posts_platform_check` IS in version control — declared INLINE, so Postgres
--    auto-names it and the NAME is never typed; a name-grep could never find it"* — and it notes
--    ~129 inline CHECKs in this corpus share the property.
--
-- ⚠️ SO `DROP CONSTRAINT IF EXISTS <guessed_name>` IS REFUSED HERE, DELIBERATELY, EVEN THOUGH THE
--    NEIGHBOURING MIGRATION 20260912 USES IT. `IF EXISTS` against a guessed name is a statement
--    that CANNOT FAIL: if the convention ever differed, it silently drops nothing, the new
--    constraint is added beside the old one, and **the column is still closed while the migration
--    reports success.** That is [[R-33]] / §6 r19 — *a check that cannot disagree is not a check*
--    — and #182's shape, where a step that never reached its target reads identically to one that
--    passed. This block finds the constraint by its DEFINITION and RAISES if it is not there.
DO $$
DECLARE
  hits text[];
  one  text;
BEGIN
  SELECT array_agg(conname ORDER BY conname) INTO hits
    FROM pg_constraint
   WHERE conrelid = 'public.service_offerings'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%price_unit%'
     AND pg_get_constraintdef(oid) ILIKE '%''plant''%';

  -- 🔴 ZERO AND MANY ARE BOTH REFUSED, AND FOR THE SAME REASON. A bare `SELECT ... INTO` would take
  --    an arbitrary row when several match and report nothing — the silent-pick defect this whole
  --    block exists to avoid. If the live schema has grown a second price_unit CHECK we have never
  --    seen, that is a thing to LOOK AT, not to half-drop.
  IF hits IS NULL OR array_length(hits, 1) = 0 THEN
    RAISE EXCEPTION
      'price_unit: no CHECK on service_offerings mentions both price_unit and ''plant''. Either this '
      'migration is already applied, or the live schema differs from 20260529. Inspect first: '
      'SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint '
      'WHERE conrelid = ''public.service_offerings''::regclass AND contype = ''c'';';
  END IF;

  IF array_length(hits, 1) > 1 THEN
    RAISE EXCEPTION
      'price_unit: expected ONE closed CHECK, found % (%). Nothing was dropped — inspect them and '
      'decide by hand which is which.', array_length(hits, 1), array_to_string(hits, ', ');
  END IF;

  one := hits[1];
  EXECUTE format('ALTER TABLE public.service_offerings DROP CONSTRAINT %I', one);
  RAISE NOTICE 'price_unit: dropped closed CHECK constraint %', one;
END $$;


-- ─── B · THE SHAPE CONSTRAINT, EXPLICITLY NAMED ─────────────────────────────────────────────
-- Named, unlike the one it replaces, so the next person to touch it can find it with a grep.
ALTER TABLE public.service_offerings
  ADD CONSTRAINT service_offerings_price_unit_shape
  CHECK (price_unit ~ '^[a-z][a-z0-9_]*$' AND length(price_unit) <= 40);

COMMENT ON COLUMN public.service_offerings.price_unit IS
  'WHAT one unit of this service is priced per, as a lowercase identifier: order, visit, plant, '
  'household, bag, vehicle… A SHAPE, not a closed list (AC-1): a vertical supplies its own units '
  'as DATA — see packages/shared/src/discovery/verticals/ — and needs no migration to do it. '
  'Paired with price_type (flat | per_unit), which says HOW the price is calculated. '
  'Lowercase is enforced so values stay comparable as strings.';


-- ─── C · DROP THE DEFAULT ───────────────────────────────────────────────────────────────────
-- Not repointed to 'order'. See the header: NOT NULL survives, so an omitted price_unit now fails
-- loudly rather than silently becoming a grower's unit. All known writers supply it.
ALTER TABLE public.service_offerings
  ALTER COLUMN price_unit DROP DEFAULT;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these AFTER applying and paste the output back (§9 SCHEMA VERIFICATION GATE).
-- They hit the live catalog, never anyone's memory.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- ① the closed CHECK is GONE and the shape CHECK is THERE (expect exactly one row, the shape one):
-- SELECT conname, pg_get_constraintdef(oid) AS def
--   FROM pg_constraint
--  WHERE conrelid = 'public.service_offerings'::regclass
--    AND contype = 'c'
--    AND pg_get_constraintdef(oid) ILIKE '%price_unit%'
--  ORDER BY conname;
--
-- ② the DEFAULT is gone and the column is still NOT NULL (expect column_default NULL, is_nullable NO):
-- SELECT column_name, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'service_offerings' AND column_name = 'price_unit';
--
-- ③ NO ROW WAS HARMED — every live value still present, with its count (expect the same
--    distribution as before applying; 'plant' rows are untouched and SHOULD still be there):
-- SELECT price_unit, count(*) FROM public.service_offerings GROUP BY 1 ORDER BY 2 DESC;
--
-- ④ THE POINT OF THE WHOLE MIGRATION — a non-grower unit is now accepted. This writes and rolls
--    back, so it leaves nothing behind. Expect it to SUCCEED where it previously raised
--    `violates check constraint`:
-- BEGIN;
--   INSERT INTO public.service_offerings (business_id, name, category, price_type, price_unit, price)
--   SELECT id, '__probe_household__', 'addon', 'per_unit', 'household', 1.00
--     FROM public.businesses LIMIT 1;
--   SELECT price_unit FROM public.service_offerings WHERE name = '__probe_household__';
-- ROLLBACK;
--
-- ⑤ AND THE GUARD STILL GUARDS — each of these must FAIL. A constraint that accepts everything is
--    not a constraint, so this half matters as much as ④ (§6 r19: prove it can still refuse):
-- BEGIN;
--   -- expect: violates check constraint "service_offerings_price_unit_shape"
--   INSERT INTO public.service_offerings (business_id, name, category, price_type, price_unit, price)
--   SELECT id, '__probe_bad_case__', 'addon', 'per_unit', 'Household', 1.00
--     FROM public.businesses LIMIT 1;
-- ROLLBACK;
-- BEGIN;
--   -- expect: violates check constraint "service_offerings_price_unit_shape"
--   INSERT INTO public.service_offerings (business_id, name, category, price_type, price_unit, price)
--   SELECT id, '__probe_empty__', 'addon', 'per_unit', '', 1.00
--     FROM public.businesses LIMIT 1;
-- ROLLBACK;
-- BEGIN;
--   -- expect: null value in column "price_unit" violates not-null constraint
--   -- (this is what dropping the DEFAULT buys: an omitted unit is now an ERROR, not a silent 'plant')
--   INSERT INTO public.service_offerings (business_id, name, category, price_type, price)
--   SELECT id, '__probe_omitted__', 'addon', 'per_unit', 1.00
--     FROM public.businesses LIMIT 1;
-- ROLLBACK;
