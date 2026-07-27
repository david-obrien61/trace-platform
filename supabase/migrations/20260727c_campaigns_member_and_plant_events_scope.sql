-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727c — N1 CAMPAIGNS MEMBER POLICIES · N6 plant_events LOSES anon
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres. AFTER 20260727b. BEFORE the funnel calls.

-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — N1: campaigns + campaign_posts GET MEMBER POLICIES
-- ════════════════════════════════════════════════════════════════════════════════
-- The aligned MANAGER floor holds `campaigns:read` and `campaigns:update`, and the tables carry
-- ONLY `campaigns_owner [ALL]` / `campaign_posts_owner [ALL]`. A bundle string with no policy is
-- a FAKE PILL: a manager holding campaigns:read reads zero campaign rows. Leaving both is the
-- disagreement STD-020 exists to end.
--
-- Verb-split, TO authenticated. NO DELETE — R2: `campaigns` has no tombstone (its `status` column
-- is lifecycle, draft/ended), and per the spec's own note a deleted campaign destroys its own
-- history. DELETE stays owner-only through the existing `*_owner` policies.
CREATE POLICY campaigns_member_select ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:read'));
CREATE POLICY campaigns_member_insert ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'));
CREATE POLICY campaigns_member_update ON public.campaigns FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'));

-- campaign_posts hangs off campaigns and takes the same authority. INSERT rides campaigns:update
-- because authoring a post IS authoring the campaign; `campaigns:create` is declared-unwired
-- (R-B2) and must not appear in a gate.
CREATE POLICY campaign_posts_member_select ON public.campaign_posts FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:read'));
CREATE POLICY campaign_posts_member_insert ON public.campaign_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'));
CREATE POLICY campaign_posts_member_update ON public.campaign_posts FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'));

-- ⚠️ social_drafts IS DELIBERATELY NOT TOUCHED — David has not ruled. The incoherence is real and
-- reported: `social/generate-posts` gates on campaigns:update and writes under the SERVICE KEY, so
-- a manager can GENERATE drafts they cannot READ, and the approval queue lives on /dashboard —
-- a surface every member already reaches. Ruling first, policy second.

-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — N6: plant_events LOSES anon
-- ════════════════════════════════════════════════════════════════════════════════
-- `anon_select_plant_events` was `USING (true)` TO anon — world-readable across every tenant.
-- The columns are INTERNAL OPERATIONAL HISTORY, not public provenance: `employee_id` (staff
-- attribution), `notes` (free text), `from_container`/`to_container` (movements). Staff names and
-- staff notes, for every tenant, to anyone with the URL.
--
-- 🔴 WHY IT LOSES anon RATHER THAN BEING "TENANT-SCOPED": an anon session HAS NO TENANT. There is
-- no identity to scope by, so tenant-scoping is not available at the row level — the only real
-- narrowing is to stop serving the raw table to anon at all.
--
-- COST, STATED: `usePlant.ts:104` reads this table and is mounted by `PlantProfile.tsx`, a PUBLIC
-- route (`/plant/:tagId`) — the GROWTH TIMELINE, US-002. **The table has ZERO ROWS, so nothing
-- renders today either way and nothing breaks now.** But when the first row is written the public
-- timeline will show nothing, SILENTLY.
--
-- ⚠️ THEREFORE A HARD TRIGGER, not a someday: BEFORE THE FIRST plant_events ROW IS WRITTEN, a
-- public PROVENANCE VIEW must exist (id, plant_id, occurred_at, event_type only — no employee_id,
-- no notes) with anon SELECT on the VIEW, and `usePlant` repointed to it. That is the same
-- projection pattern as 3b and the dashboard money redaction — the third instance this week — and
-- it is the correct shape here because RLS has no column-level control.
DROP POLICY IF EXISTS "anon_select_plant_events" ON public.plant_events;

-- ── V1 — campaigns/campaign_posts now carry member policies. EXPECT 6 rows, no DELETE among them.
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename IN ('campaigns','campaign_posts') AND policyname ~ 'member'
--  ORDER BY tablename, policyname;

-- ── V2 — NEGATIVE: no member DELETE policy on either. EXPECT 0 rows (R2, no tombstone).
-- SELECT policyname FROM pg_policies WHERE schemaname='public'
--   AND tablename IN ('campaigns','campaign_posts') AND cmd='DELETE' AND policyname ~ 'member';

-- ── V3 — NEGATIVE: anon can no longer read plant_events. EXPECT 0 rows.
-- SELECT policyname, roles::text FROM pg_policies
--  WHERE schemaname='public' AND tablename='plant_events' AND roles::text LIKE '%anon%';

-- ── V4 — the trigger for the follow-up: is the table still empty? While this returns 0 the
--    public timeline is unaffected. The FIRST row makes the provenance view due.
-- SELECT count(*) AS plant_event_rows FROM public.plant_events;
