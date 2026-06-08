-- business_modules: migrate social_media config from { platforms, cadence }
-- to { advert_channels: [{type, name, enabled}], cadence }
-- 2026-06-08
--
-- LEXICON RULE (enforced here): "platform" is RESERVED for the top-level TRACE
-- substrate (builtwithCAI). Nothing inside the platform may be named "platform" —
-- no config field, table, or identifier. Channels, tiles, capabilities, verticals —
-- never "platforms". A platform-within-the-platform is a thing-within-the-thing
-- violation. This migration renames config.platforms → config.advert_channels.
--
-- advert_channels shape: [{ type: 'social'|'sms', name: string, enabled: boolean }]
-- type 'social' names: instagram, facebook, tiktok, twitter
-- type 'sms'    names: sms
--
-- enabled reflects the owner's prior selection in /social/setup.
-- SMS defaults to false — no prior setup path existed for SMS.
--
-- David: paste into Supabase SQL editor (bgobkjcopcxusjsetfob), run, then verify.

-- ─── MAIN: Convert each social_media row ────────────────────────────────────

UPDATE business_modules
SET config = jsonb_build_object(
  'cadence', COALESCE(config->>'cadence', 'weekly'),
  'advert_channels', (
    SELECT jsonb_agg(ch ORDER BY ord)
    FROM (
      SELECT 1 AS ord,
        jsonb_build_object(
          'type', 'social', 'name', 'instagram',
          'enabled', COALESCE(config->'platforms', '[]'::jsonb) @> '"instagram"'
        ) AS ch
      UNION ALL SELECT 2,
        jsonb_build_object(
          'type', 'social', 'name', 'facebook',
          'enabled', COALESCE(config->'platforms', '[]'::jsonb) @> '"facebook"'
        )
      UNION ALL SELECT 3,
        jsonb_build_object(
          'type', 'social', 'name', 'tiktok',
          'enabled', COALESCE(config->'platforms', '[]'::jsonb) @> '"tiktok"'
        )
      UNION ALL SELECT 4,
        jsonb_build_object(
          'type', 'social', 'name', 'twitter',
          'enabled', COALESCE(config->'platforms', '[]'::jsonb) @> '"twitter"'
        )
      UNION ALL SELECT 5,
        jsonb_build_object(
          'type', 'sms', 'name', 'sms',
          'enabled', false
        )
    ) sub
  )
)
WHERE module_key = 'social_media';

-- ─── VERIFICATION (run after applying) ──────────────────────────────────────
-- SELECT business_id, config->>'cadence' AS cadence, config->'advert_channels' AS advert_channels
--   FROM business_modules
--  WHERE module_key = 'social_media';
--
-- Expected: each row has advert_channels array with 5 entries (instagram/facebook/tiktok/twitter/sms).
-- Prior enabled channels (from platforms array) should appear with enabled=true.
-- 'platforms' key should be gone (replaced by advert_channels).
-- No 'blotato_account_id' key in any row.
