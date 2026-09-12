-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- ONE SHARED CHANNEL VOCABULARY — the `channels` lookup table
-- Ledger #310 · R-150 · tech-debt #91's actual complaint, not a per-table patch
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- WHAT THIS FIXES, AND WHY IT IS NOT A CONSTRAINT EDIT.
--
-- A channel name was written down in FOUR places. On 8 June 2026 (`35913b2`) tiktok and twitter
-- were added to the channel router and TWO of the four were updated. The other two were not:
--
--   1. `campaign_posts_platform_check`  ('instagram','facebook','sms','email')        ← NOT updated
--   2. `social_drafts_platform_check`   ('instagram','facebook','tiktok','twitter','sms')  ← updated
--   3. `SOCIAL_CHANNELS` in SocialSetup.tsx (the config UI's list)                   ← updated
--   4. `CampaignPost.platform` TS union in shared/src/campaigns/types.ts             ← NOT updated
--
-- So the only UI that can enable a channel offers tiktok and twitter, and the table that stores
-- the generated post forbids them. The insert is ONE atomic multi-row statement
-- (`api/campaigns.ts:167`), so a single tiktok row rejects the WHOLE batch — and the campaign row
-- is inserted first and separately, and commits. That is why `campaign_posts` is EMPTY on every
-- tenant and why three zero-post campaigns exist: no post has ever been written successfully.
--
-- 🔴 THE ASYMMETRY IS WORSE THAN "NOBODY COULD GREP". `social_drafts_platform_check` is declared
-- with an explicit name in `20260609_social_drafts_platform_check.sql` — findable. The
-- `campaign_posts` one is declared INLINE at `20260529_campaigns.sql:27`, so Postgres auto-named
-- it and the name appears nowhere a person would type. The update landed on the findable one.
-- This is STD-011 in the database: two representations of one fact, and the invisible copy drifts.
--
-- ─── WHAT THIS MIGRATION DOES ──────────────────────────────────────────────────────────────────
--   A. CREATE `channels` — one row per channel, the single vocabulary.
--   B. SEED six rows: instagram, facebook, tiktok, twitter, sms, email.
--   C. REPLACE both CHECK constraints with FOREIGN KEYS to `channels(name)`.
--   D. ADD `campaign_posts.subject` — nullable. Email is a subject and a body (R-150 ①).
--   E. ADD a TRIGGER validating `business_modules.config->'advert_channels'` names.
--
-- ─── ⚠️ THE NAMING SPLIT, FLAGGED DELIBERATELY (David's instruction) ───────────────────────────
-- The TABLE is `channels` and the COLUMNS stay `platform`. That is not an oversight.
-- `SocialSetup.tsx:10` carries the LEXICON rule: *"'platform' is reserved for the top-level TRACE
-- substrate. Channels, not platforms, are what the owner enables here."* And `platform_config`
-- already occupies the platform namespace (operator key/value config, unrelated). So the new table
-- takes the correct word. Renaming `campaign_posts.platform` and `social_drafts.platform` is a
-- two-column rename across every reader and is NOT in this pass. The split is recorded here so the
-- next reader knows it was decided rather than missed.
--
-- ─── 🔴 THE JSONB BOUNDARY — A KNOWN LIMIT, NOT AN OVERSIGHT (David's instruction) ─────────────
-- `advert_channels` is a jsonb ARRAY inside `business_modules.config`. It is enforced by TRIGGER
-- and not by a foreign key **because Postgres cannot declare a foreign key into a jsonb value, and
-- a CHECK constraint cannot contain a subquery.** Neither mechanism can reach it. The trigger is
-- the strongest available enforcement at that site, and it runs on every INSERT and UPDATE.
-- ⚠️ SOMEONE WILL READ THIS IN SIX MONTHS AND ASSUME THE FK WAS FORGOTTEN. It was not. Moving
-- `advert_channels` out of jsonb into its own table would permit a real FK, and that is a DIFFERENT
-- migration — four readers and live config on two tenants (David's ruling, 2026-09-12: do not).
--
-- ─── SAFETY ────────────────────────────────────────────────────────────────────────────────────
--   · `campaign_posts` is EMPTY on every tenant (0 rows, measured 2026-09-12) → FK validates free.
--   · `social_drafts` holds 7 rows: instagram 2 · sms 2 · tiktok 1 · twitter 1 · facebook 1.
--     ALL FIVE are in the seed, so the FK validates WITHOUT touching data. No backfill, no repair.
--   · `advert_channels` is live on BOTH tenants (LAWNS + Test Dave's), 5 names each, all seeded —
--     so the trigger accepts every row that exists today. PRE-FLIGHT 0 proves it before enforcing.
--   · Additive only. No column dropped, no row rewritten, no value coerced.
--
-- APPLY IN THE SQL EDITOR, NOT THE TABLE EDITOR (§6 r17 — the table editor grants anon
-- TRUNCATE/REFERENCES through a default ACL we cannot alter).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════


-- ─── PRE-FLIGHT 0 — REFUSES IF ANY LIVE VALUE WOULD NOT SURVIVE ───────────────────────────────
-- Runs BEFORE anything is created. If a platform value or a configured channel name is not in the
-- seed below, this RAISES and nothing is applied — rather than a foreign key failing halfway with
-- a constraint-violation message that names no row.
DO $$
DECLARE
  seeded text[] := ARRAY['instagram','facebook','tiktok','twitter','sms','email'];
  stray  text;
BEGIN
  SELECT string_agg(DISTINCT platform, ', ') INTO stray
    FROM campaign_posts WHERE platform <> ALL (seeded);
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT 0 FAILED — campaign_posts holds platform value(s) not in the seed: %', stray;
  END IF;

  SELECT string_agg(DISTINCT platform, ', ') INTO stray
    FROM social_drafts WHERE platform <> ALL (seeded);
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT 0 FAILED — social_drafts holds platform value(s) not in the seed: %', stray;
  END IF;

  SELECT string_agg(DISTINCT n, ', ') INTO stray
    FROM (
      SELECT jsonb_array_elements(config->'advert_channels')->>'name' AS n
        FROM business_modules
       WHERE module_key = 'social_media' AND config ? 'advert_channels'
    ) q
   WHERE n <> ALL (seeded);
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT 0 FAILED — live advert_channels config holds name(s) not in the seed: %', stray;
  END IF;

  RAISE NOTICE 'PRE-FLIGHT 0 PASSED — every live platform value and configured channel name is in the seed.';
END $$;


-- ─── A · THE TABLE ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channels (
  name       text PRIMARY KEY,
  -- 'social' or 'sms' or 'email'. Drives per-channel post counts in the generator
  -- (`postsPerChannel` gives an sms/email ONE post where a social channel gets several).
  kind       text NOT NULL,
  label      text NOT NULL,
  -- The prompt guidance that was hardcoded in `CHANNEL_GUIDANCE`. Held here so a new channel is a
  -- ROW and not a code change; the code keeps a DEFAULT for a channel whose guidance is null.
  guidance   text,
  -- A channel can be retired without deleting it — a historical post must keep resolving its FK.
  -- R-133: soft delete only. There is no DELETE policy and retiring is an UPDATE of `active`.
  active     boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.channels IS
  'The ONE channel vocabulary (ledger #310, R-150). campaign_posts.platform and '
  'social_drafts.platform are FOREIGN KEYS to this table; business_modules.config->''advert_channels'' '
  'is validated against it by trigger, because Postgres cannot FK into jsonb. Adding a channel is a '
  'row. NOT tenant data — global reference.';


-- ─── B · THE SEED ──────────────────────────────────────────────────────────────────────────────
-- Six rows. The five the config UI already offers, plus EMAIL.
-- 🔴 EMAIL IS NOT "COMING SOON" AND NO SURFACE MAY SAY SO (R-150 ①). It works exactly as every
-- other channel works and always has: TRACE drafts, the owner copies, the owner sends.
-- `api/campaigns.ts:180` already records that model in as many words — *"Mark as reviewed — owner
-- copied it, NOT auto-published."* An email is a subject line and a body instead of a caption; that
-- is the only difference, and it is why `subject` is added in section D. It needs no outbound
-- capability and no consent model, because the owner is the one sending.
INSERT INTO public.channels (name, kind, label, guidance, sort_order) VALUES
  ('instagram', 'social', 'Instagram',
   '(Instagram) Visual and upbeat. Under 220 characters. 3–5 relevant hashtags at end.', 10),
  ('facebook',  'social', 'Facebook',
   '(Facebook) 50–120 words. Warm and conversational. 2–3 hashtags max. More storytelling.', 20),
  ('tiktok',    'social', 'TikTok',
   '(TikTok) Under 150 characters. Punchy and energetic. 3–5 hashtags.', 30),
  ('twitter',   'social', 'Twitter / X',
   '(Twitter/X) Under 260 characters. Brief and direct. 2–3 hashtags.', 40),
  ('sms',       'sms',    'SMS',
   '(SMS) Under 160 characters. Direct, one clear call to action. Include the business name. No hashtags.', 50),
  ('email',     'email',  'Email',
   '(Email) A subject line and a body. Subject under 60 characters, concrete, no all-caps and no '
   'exclamation marks. Body 80–150 words, warm, signed off as the owner. The owner sends it themselves.', 60)
ON CONFLICT (name) DO NOTHING;


-- ─── RLS ───────────────────────────────────────────────────────────────────────────────────────
-- 🔴 THIS TABLE IS GLOBAL REFERENCE DATA, NOT TENANT DATA — it carries no `business_id`, so the
-- AC-2 default (scope to business_id membership) cannot apply and a DEVIATION IS RECORDED rather
-- than assumed. Every authenticated member of any tenant may READ it: the config UI builds its
-- channel list from this table, which is the whole point of the pass (the list stops being copied
-- into client code). NOBODY may write it from a client — adding a channel is a migration.
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY channels_authenticated_select ON public.channels
  FOR SELECT TO authenticated
  USING (true);

-- No INSERT / UPDATE / DELETE policy of any kind. Fail-closed by design: the service key (used by
-- migrations) bypasses RLS, and a client has no write path at all. Deliberate, not an omission.


-- ─── C · THE TWO CHECKS BECOME FOREIGN KEYS ────────────────────────────────────────────────────
-- campaign_posts: 0 rows on every tenant (measured 2026-09-12), so this validates against nothing.
ALTER TABLE public.campaign_posts
  DROP CONSTRAINT IF EXISTS campaign_posts_platform_check;

ALTER TABLE public.campaign_posts
  ADD CONSTRAINT campaign_posts_platform_fkey
  FOREIGN KEY (platform) REFERENCES public.channels(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- social_drafts: 7 rows, every value seeded, so this validates WITHOUT touching data.
ALTER TABLE public.social_drafts
  DROP CONSTRAINT IF EXISTS social_drafts_platform_check;

ALTER TABLE public.social_drafts
  ADD CONSTRAINT social_drafts_platform_fkey
  FOREIGN KEY (platform) REFERENCES public.channels(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ⚠️ `ON DELETE RESTRICT` is the load-bearing half: a channel that any post references CANNOT be
-- deleted, so history never loses the name it was published under. Retirement is `active=false`.


-- ─── D · EMAIL NEEDS A SUBJECT (R-150 ①) ───────────────────────────────────────────────────────
-- Additive and nullable. NULLABLE is correct and not laziness: a caption has no subject, so a
-- NOT NULL column would force every Instagram row to carry an empty string — which is exactly the
-- "absent rendered as present" failure A9 forbids. A reader distinguishes "no subject because this
-- is a caption" from "an empty subject" only if NULL is available.
--
-- 🔴 DAVID RULED AGAINST THE CONVENTION: subject-as-first-line-of-copy_text was considered and
-- refused, in his words — *"Convention is not enforcement, and a subject-as-first-line rule is the
-- same class of thing this whole pass exists to remove."*
ALTER TABLE public.campaign_posts
  ADD COLUMN IF NOT EXISTS subject text;

COMMENT ON COLUMN public.campaign_posts.subject IS
  'Email subject line. NULL for every channel whose post is a caption (A9: absent must not render '
  'as present). The owner copies subject + body and sends it themselves — there is no outbound '
  'send path and no surface may imply one is coming (R-150).';


-- ─── E · THE TRIGGER — advert_channels, enforced at write time ──────────────────────────────────
-- The jsonb boundary, handled. See the header: no FK and no CHECK can reach inside a jsonb array,
-- so this is the enforcement, and it is not weaker in practice — it runs on INSERT and UPDATE and
-- rejects the write with a message naming the offending value.
CREATE OR REPLACE FUNCTION public.channels_validate_advert_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  stray text;
BEGIN
  IF NEW.config IS NULL OR NOT (NEW.config ? 'advert_channels') THEN
    RETURN NEW;
  END IF;

  -- A malformed shape is refused by name rather than silently skipped: a non-array here would make
  -- every check below vacuously pass, which is the "check that cannot disagree" shape (§6 r19).
  IF jsonb_typeof(NEW.config->'advert_channels') <> 'array' THEN
    RAISE EXCEPTION 'advert_channels must be a JSON array, got %', jsonb_typeof(NEW.config->'advert_channels');
  END IF;

  SELECT string_agg(DISTINCT q.n, ', ') INTO stray
    FROM (SELECT jsonb_array_elements(NEW.config->'advert_channels')->>'name' AS n) q
   WHERE q.n IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.name = q.n);

  IF stray IS NOT NULL THEN
    RAISE EXCEPTION
      'unknown channel name(s) in advert_channels: %. Add a row to public.channels in a migration first.', stray;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS business_modules_advert_channels_known ON public.business_modules;

CREATE TRIGGER business_modules_advert_channels_known
  BEFORE INSERT OR UPDATE OF config ON public.business_modules
  FOR EACH ROW EXECUTE FUNCTION public.channels_validate_advert_channels();


-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying. Paste the result into the close-out.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ① the vocabulary is one list, six rows:
-- SELECT name, kind, label, active, sort_order FROM public.channels ORDER BY sort_order;
--
-- ② both CHECKs are GONE and both FKs exist (expect 0 check rows, 2 fk rows):
-- SELECT conrelid::regclass AS tbl, conname, contype,
--        pg_get_constraintdef(oid) AS def
--   FROM pg_constraint
--  WHERE conrelid IN ('public.campaign_posts'::regclass, 'public.social_drafts'::regclass)
--    AND (conname LIKE '%platform%')
--  ORDER BY 1, 2;
--
-- ③ the subject column exists and is NULLABLE:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name='campaign_posts' AND column_name='subject';
--
-- ④ RLS on, exactly one policy, SELECT only:
-- SELECT relrowsecurity FROM pg_class WHERE oid='public.channels'::regclass;
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='channels';
--
-- ⑤ the trigger exists and fires on INSERT and UPDATE:
-- SELECT tgname, tgtype, pg_get_triggerdef(oid) FROM pg_trigger
--  WHERE tgrelid='public.business_modules'::regclass AND NOT tgisinternal;
--
-- ⑥ 🔴 THE TRIGGER ACTUALLY REFUSES — the one check that proves it is a check (§6 r19).
--    Run inside a transaction and ROLL BACK. Expect an ERROR naming 'myspace':
-- BEGIN;
--   UPDATE business_modules
--      SET config = jsonb_set(config, '{advert_channels}',
--            (config->'advert_channels') || '[{"type":"social","name":"myspace","enabled":true}]'::jsonb)
--    WHERE module_key = 'social_media'
--      AND business_id = (SELECT id FROM businesses WHERE name = 'Test Dave''s Tree Nest');
-- ROLLBACK;
--
-- ⑦ and it still ACCEPTS a legitimate write (the negative control — a trigger that refuses
--    everything would pass ⑥ and be useless). Expect UPDATE 1, then roll back:
-- BEGIN;
--   UPDATE business_modules SET config = config
--    WHERE module_key = 'social_media'
--      AND business_id = (SELECT id FROM businesses WHERE name = 'Test Dave''s Tree Nest');
-- ROLLBACK;
