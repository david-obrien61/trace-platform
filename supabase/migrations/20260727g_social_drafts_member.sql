-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727g — social_drafts MEMBER POLICIES (David's ruling)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres. AFTER 20260727c.
--
-- RULED: read + update for `campaigns:update` holders. NO DELETE — `original_text` is IMMUTABLE
-- PROVENANCE (what the model actually wrote), `edited_text` is the human layer on top, and a
-- discarded draft takes a STATUS VALUE rather than vanishing. Deleting the row would destroy the
-- record of what was proposed, which is the only thing that makes the edit meaningful.
--
-- THE INCOHERENCE THIS ENDS, confirmed end to end:
--   · `api/social/generate-posts` gates on `campaigns:update` and writes under the SERVICE KEY —
--     so a manager holding it CAN GENERATE drafts.
--   · `social_drafts` carried ONE policy, `social_drafts_business_owner [ALL]`, owner-only — so
--     that same manager COULD NOT READ WHAT THEY JUST GENERATED.
--   · `Dashboard.tsx:221` `loadSocialDrafts()` is UNCONDITIONAL — no isOwner gate. It runs for
--     every member, RLS returns zero rows, and the social tile's count badge (`:673`) reads 0
--     while the drafts section (`:680`) never renders. **A SILENT EMPTY APPROVAL QUEUE**: the
--     manager fills it and the screen tells them nothing happened.
-- Read and write authority now agree with the surface that renders them.
--
-- Both verbs take `campaigns:update`, not a read/write split: approving copy IS authoring it, and
-- `edited_text` is the approval act. A separate `campaigns:read` for the queue would let someone
-- watch drafts they cannot action, which is a worse surface than not seeing them.
CREATE POLICY social_drafts_member_select ON public.social_drafts FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'));
CREATE POLICY social_drafts_member_update ON public.social_drafts FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'campaigns:update'));

-- No member INSERT: drafts are MACHINE-authored through the service key, never hand-written by a
-- member. No member DELETE: see above — provenance is the point.

-- ── V1 — EXPECT 2 rows, SELECT and UPDATE, neither INSERT nor DELETE.
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='social_drafts' AND policyname ~ 'member' ORDER BY cmd;

-- ── V2 — NEGATIVE: a member WITHOUT campaigns:update still reads nothing. Impersonate a STAFF
--    user (STAFF's 10 has no campaigns string). EXPECT 0 rows.
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<STAFF user_id>"}';
--   SELECT count(*) FROM public.social_drafts;
-- ROLLBACK;

-- ── V3 — NEGATIVE: no member can DELETE a draft. EXPECT 0 rows.
-- SELECT policyname FROM pg_policies WHERE schemaname='public'
--   AND tablename='social_drafts' AND cmd='DELETE' AND policyname ~ 'member';
