-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727 — CORRECTIONS TO THE FLIP (found on David's V1–V9 read of the applied migration)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres. A SEPARATE FILE because 20260727_rbac_resource_action_flip.sql is now
-- APPLIED — §6 r1, never edit an applied migration.
-- BLOCKS: the funnel calls. Both items below are reachable by a string in MANAGER's 43.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — settings:update HAD NO WRITE HALF, AND THE OBVIOUS FIX WOULD HAVE BEEN WORSE
-- ════════════════════════════════════════════════════════════════════════════════
-- V3 showed `businesses` carries businesses_member_select and NO member UPDATE. So granting
-- `settings:update` would have handed Lauren the /settings route and a Save that RLS refuses — a
-- dead affordance on a promise.
--
-- 🔴 BUT THE ONE-LINE FIX IS A PRIVILEGE-ESCALATION HOLE. `businesses` holds `owner_id` and the
-- accounting columns alongside the profile. Postgres RLS has NO COLUMN-LEVEL restriction, so a
-- blanket member UPDATE policy would let any member holding settings:update run
-- `UPDATE businesses SET owner_id = <self>` and TAKE THE BUSINESS. That is strictly worse than
-- the gap it closes.
--
-- The surface only ever writes FIVE profile columns (shared/pages/Settings.tsx:248 — name, phone,
-- address, email, website; tax_rate moved to config under D-40). So the write half is a NARROW
-- SECURITY DEFINER RPC — the same shape as set_business_tax_rate, for the same reason: when a
-- capability needs some columns and not others, the function IS the column-level policy.
CREATE OR REPLACE FUNCTION public.set_business_profile(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_name          text,
  p_phone         text,
  p_address       text,
  p_email         text,
  p_website       text
) RETURNS TABLE(applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'settings:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'settings.update_denied', 'business', p_business_id::text,
            jsonb_build_object('attempted', 'business_profile'), 'denied');
    RETURN QUERY SELECT false, 'settings:update permission required'::text;
    RETURN;
  END IF;

  -- D-9: a blank name is not a name. Everything else may legitimately be cleared to NULL.
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN QUERY SELECT false, 'business name is required'::text;
    RETURN;
  END IF;

  -- ⚠️ THE COLUMN LIST IS THE SECURITY BOUNDARY. owner_id, accounting_*, business_type and
  -- everything else on this table are UNREACHABLE from here BY CONSTRUCTION. Adding a column to
  -- this SET is granting a new capability — do it deliberately or not at all.
  UPDATE public.businesses
     SET name    = btrim(p_name),
         phone   = p_phone,
         address = p_address,
         email   = p_email,
         website = p_website
   WHERE id = p_business_id;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'settings.profile_changed', 'business', p_business_id::text,
          jsonb_build_object('name', btrim(p_name)), 'success');

  RETURN QUERY SELECT true, NULL::text;
END;
$$;
REVOKE ALL ON FUNCTION public.set_business_profile(uuid, uuid, text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_business_profile(uuid, uuid, text, text, text, text, text) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — bpc_member_insert: AN INSERT GATED BY A STRING NAMED `update`
-- ════════════════════════════════════════════════════════════════════════════════
-- Spec §3 gives `pricing_recipe` READ + UPDATE only — no create verb is mintable. The flip's
-- §1.7 nevertheless created an INSERT policy gated on `pricing_recipe:update`, which is capP
-- assertion 5 exactly: a permission named `update` granting a create.
--
-- DROPPED rather than minting `pricing_recipe:create`. A pricing-config row is created ONCE, at
-- onboarding, by the owner (businesses_owner / bpc_owner_all still cover that). A manager editing
-- a recipe never needs to create one, so the verb the spec declines to mint is a verb nothing
-- needs. INSERT for members is now owner-only, which is what the spec's verb list already said.
DROP POLICY IF EXISTS bpc_member_insert ON public.business_pricing_config;

-- ── V10 — NEGATIVE: no member INSERT policy survives on the pricing config. EXPECT 0 rows.
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_pricing_config' AND cmd='INSERT' AND policyname ~ 'member';

-- ── V11 — the narrow profile writer exists, is SECURITY DEFINER and search_path-pinned.
-- EXPECT 1 row: prosecdef=true, proconfig={search_path=}
-- SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'set_business_profile';

-- ── V12 — NEGATIVE: the profile writer cannot reach owner_id. Read the source and confirm the
-- SET list is exactly name/phone/address/email/website. EXPECT no owner_id, no accounting_*.
-- SELECT prosrc FROM pg_proc WHERE proname = 'set_business_profile';

-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — V7-POSITIVE: the tax writer must be proven to WRITE, not only to REFUSE
-- ════════════════════════════════════════════════════════════════════════════════
-- V7 proved set_business_tax_rate REFUSES a bad rate. Catalog verification is EXISTENCE, not
-- FUNCTION — nothing yet proves it writes a VALID one, or that the recipe is untouched after.
-- Run this as postgres, with the business id in place, and DIFF the two config reads.
--
-- BEGIN;
--   -- (a) BEFORE — capture the whole config
--   SELECT config FROM public.business_pricing_config
--    WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
--
--   -- (b) WRITE a valid rate through the narrow writer
--   SELECT * FROM public.set_business_tax_rate(
--     'f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 0.0625,
--     '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382');
--   -- EXPECT applied=true, rate_before=0.0825, rate_after=0.0625
--
--   -- (c) READ IT BACK, and prove the RECIPE IS UNTOUCHED. EXPECT taxrate_now = 0.0625 and
--   --     every other key byte-identical to (a) — this is the assertion, not the rate itself.
--   -- 🔧 CORRECTED 2026-07-27. The first draft flagged `config ? 'baselineMargin'`,
--   -- `'pricingTiers'` and `'markup'` — NONE OF WHICH EXIST. Those checks returned false whether
--   -- or not the recipe had been damaged: a guard that cannot fail is not a guard. Real paths
--   -- read from CostToProduceConfig and a live row; the ONE list is
--   -- packages/shared/src/business-logic/pricingRecipeFields.ts.
--   SELECT config->>'taxRate'                 AS taxrate_now,
--          config - 'taxRate'                 AS recipe_without_tax,  -- diff THIS against (a) minus taxRate
--          config#>>'{margin,baseline}'       AS margin_baseline,     -- was 'baselineMargin' (nested, not top-level)
--          jsonb_array_length(config#>'{margin,tiers}') AS margin_tier_count,
--          config->>'priceReference'          AS price_reference,     -- was 'referencePrice' (reversed)
--          config ? 'discountTypes'           AS has_discount_types,  -- the only original that was right
--          jsonb_array_length(config->'denominators')   AS denominator_count,
--          jsonb_array_length(config->'locations')      AS location_count
--     FROM public.business_pricing_config
--    WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
-- ROLLBACK;   -- ⚠️ restores 0.0825 without a second write. If you COMMIT instead, set it back.
