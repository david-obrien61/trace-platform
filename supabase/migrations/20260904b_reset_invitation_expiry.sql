-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- RESET INVITE — THE STATEMENT DAVID RAN IN THE EDITOR, PARAMETERISED AND MADE SAFE TO ISSUE
-- 2026-09-04 · ledger #274 · David's ruling: "AN RPC, not a client update. The body is my
--              statement, parameterised. Do not widen it."
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes. (CLAUDE.md §6 r1.)
-- Created through the MIGRATION path, not the dashboard table editor (§6 r17) — this creates a
-- FUNCTION, not a table, so the TRUNCATE/REFERENCES default-ACL hazard does not arise here at all.
--
-- ── WHAT THIS IS, IN ONE LINE ───────────────────────────────────────────────────────────────────
-- Joel Joiner was invited to LAWNS on 2026-08-27 13:32 as MANAGER. His token expired 2026-09-03
-- 13:32:43, unused. NOTHING in the product could reissue or extend it — a sweep of all 1,061
-- commits across every branch for `resendInvitation` / `regenerateInvitation` / `reissueInvitation`
-- / `extendInvitation` / `refreshInvitation` / `renewInvitation` / `rotateToken` / `Reissue`
-- returned ZERO commits. The only recovery was the SQL editor, and David ran it:
--
--     UPDATE invitations SET expires_at = now() + interval '7 days'
--      WHERE id = 'e734dd21-…' AND used = false;
--
-- It worked. Same token, same link, same QR, same `business_members` row — because the member row
-- links by `invite_id`, never by the token (acceptInvitation.ts:74), so extending in place cannot
-- break the linkage. This function is that statement and nothing more.
--
-- ── 🔴 WHY IT IS AN RPC AND NOT A CLIENT UPDATE — FOUR THINGS THE EDITOR GOT FOR FREE ───────────
-- In the SQL editor David is `postgres`: RLS is bypassed entirely, so neither the policy nor the
-- permission gate ever applied. Issued from a browser the SAME statement changes in four ways.
--
--   ① TENANT SCOPE. His statement keys on `id` ALONE. That is safe for a human naming a uuid he
--      just read; it is a CROSS-TENANT WRITE when the id arrives from a browser. A SECURITY
--      DEFINER function bypasses RLS too, so AC-3 has to be stated IN THE BODY — hence the
--      `business_id = p_business_id` predicate, which his statement does not have and does not
--      need. This is the one thing on the list that is genuinely NEW work rather than plumbing.
--
--   ② THE GATE, AND THE DOOR IT AVOIDS. `invitations_member_update` (20260828:219-226) is
--      `USING (is_active_member(business_id) AND has_permission(business_id,'team:create'))` —
--      and it is COLUMN-BLIND. There is no column-level GRANT on `invitations` anywhere in the
--      corpus, so the identical policy that would permit `SET expires_at = …` also permits
--      `SET role = 'OWNER'` on a pending invitation, whose role is then copied verbatim onto the
--      member row at accept time. A client UPDATE would put the extension and the escalation
--      behind the SAME door. A function can name the one column; a policy cannot.
--
--   ③ THE ZERO-ROW REFUSAL. A PostgREST UPDATE matching zero rows returns SUCCESS WITH NO ERROR
--      ("A WRITE MUST PROVE IT WROTE — E5's ANSWER IS `RETURNING` / THE RETURNED REPRESENTATION,
--      AND CHECK THE COUNT", ruling 2026-08-23). So a client update with no `.select()` would
--      print "reset" over an invitation it never touched — exactly the live `armPinReset` defect
--      fixed in this same commit. Here the UPDATE carries `RETURNING` and a NULL is a REFUSAL.
--
--   ④ THE AUDIT. David's editor run wrote NO `audit_log` row, and nothing would have written one
--      for it: `invitations` carries no trigger anywhere in the corpus (grepped, zero hits).
--      `create_invitation` audits BOTH outcomes — `invitation.created` and
--      `invitation.create_denied` — and this matches that vocabulary in both directions, because
--      a refusal nobody can see is the incident R-18 exists to capture.
--
-- ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────────────────────────
-- No new permission string. Resetting an invitation is the same capability as issuing and
-- withdrawing one, and 20260828:200-202 already ruled that shape: "seeing your own pending
-- invitations and withdrawing one are parts of the INVITE capability, not of reading the roster."
-- `team:create` it is. (David's ruling: "team:create, not owner-only.")
--
-- No new token. The member row carries `invite_id` and `acceptInvitation` resolves by it, so
-- extending in place preserves the linkage by construction — see the ORPHAN HAZARD below for what
-- a NEW invitation would do instead.
--
-- ── ⚠️ THE ORPHAN HAZARD — READ THIS BEFORE REACHING FOR "JUST INVITE THEM AGAIN" ───────────────
-- 🔴 EXTENDING IS SAFE. RE-INVITING IS NOT, AND NOTHING STOPS IT. `create_invitation`
-- (20260828:383-387) INSERTs into `business_members` with NO prior SELECT, NO `ON CONFLICT` and NO
-- `WHERE NOT EXISTS`, and the table carries NO unique index of any kind — a grep of the whole
-- migration corpus for `unique|constraint|index` against `business_members` returns exactly ONE
-- hit, the `fk_business_members_invite_id` foreign key (20260602:117).
--
-- So inviting Joel a second time mints a SECOND `business_members` row: MANAGER, `active=false`,
-- `user_id` NULL, a different `invite_id`. Accept resolves by `invite_id` (acceptInvitation.ts:74)
-- so ONE of them activates and the other becomes a PERMANENT ORPHAN — and `removeMember` deletes
-- by `id` (members.ts:30-37), so removing Joel through the UI clears one row and leaves the other
-- on the roster. It grants nothing today (`is_active_member` requires `active = true`), which is
-- precisely why nobody would notice.
--
-- The durable fix is a partial unique index on `business_members`. It is FILED AS OWED, not taken
-- here, and its blocker is #54/#58's shape: an index cannot land until the live rows are known
-- clean, and this session could not read them (see the ledger row). Named here because this is
-- where the next person reaching for a second invite is standing.
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.reset_invitation_expiry(uuid, uuid, uuid);
-- Nothing else is created, altered or dropped. No table, no column, no policy, no trigger, no
-- grant beyond this function's own.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1 — reset_invitation_expiry — THE RESET FUNNEL
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SHAPE: modelled on create_invitation / save_role_permissions / assign_member_role —
--   assert_movement_actor (impersonation RAISES) → authorise (denial RETURNS so its audit row
--   COMMITS) → write with RETURNING → audit → return.
--
-- RETURN CONTRACT (mirrors the funnel's (applied, reason) shape):
--   denial  → exactly one row: (false, reason, NULL)
--   success → exactly one row: (true, NULL, new_expires_at)
--
-- 🔴 THE OUT PARAMETERS ARE NAMED TO AVOID COLUMN COLLISIONS, and that is not cosmetic. In plpgsql
-- an OUT parameter SHADOWS a column of the same name inside the body, so an OUT param called
-- `expires_at` would make `RETURNING expires_at` raise "column reference is ambiguous" AT CALL
-- TIME — a runtime failure a migration applies cleanly over. `new_expires_at` avoids it, the same
-- way create_invitation uses `invite_token` / `new_member_id` and the funnel RPCs use
-- `perms_before` / `perms_after`.
CREATE OR REPLACE FUNCTION public.reset_invitation_expiry(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_invitation_id uuid
) RETURNS TABLE(applied boolean, reason text, new_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new   timestamptz;
  v_name  text;
  v_role  text;
BEGIN
  -- Impersonation is a hard RAISE, not a recoverable denial (same as the three funnel RPCs).
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- ── AUTHORISE ────────────────────────────────────────────────────────────────────────────────
  -- has_permission_for, not has_permission: the actor is PASSED. It has had NO OWNER BRANCH since
  -- 2026-07-30 (20260730c:41-57), so this is a pure "does this person hold the string" test and
  -- `businesses.owner_id` grants nothing here — deliberately, because reintroducing an owner
  -- fallback in a new function is how a retired branch comes back one exception at a time.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'team:create') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.expiry_reset_denied', 'invitation',
            p_invitation_id::text,
            jsonb_build_object('rule', 'team:create is required'), 'denied');
    RETURN QUERY SELECT false,
      'you do not have permission to reset invitations for this business'::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- ── THE WRITE — David's statement, parameterised, and not one column wider ────────────────────
  -- `now() + interval '7 days'`, NOT `expires_at + interval '7 days'`. Extending from the OLD
  -- expiry would hand a five-day window to an invitation that died two days ago, and a
  -- three-week-old one would come back already dead. The clock restarts; it does not resume.
  --
  -- ⚠️ THE INTERVAL IS A THIRD REPRESENTATION OF SEVEN DAYS and that is known, not overlooked:
  -- the column default (20260602:97), this body, and `INVITE_TTL_DAYS` in invitations.ts. SQL
  -- cannot import a TypeScript constant (20260726:264-290 records the same wall for permissions),
  -- and a `current_setting` lookup would be a configuration mechanism nobody asked for. If the TTL
  -- ever moves, all three move together — stated here so the next person finds the other two.
  UPDATE public.invitations
     SET expires_at = now() + interval '7 days'
   WHERE id          = p_invitation_id
     AND business_id = p_business_id   -- AC-3. The editor statement had no such predicate and did
                                       -- not need one; a browser-supplied id makes it mandatory.
     AND used        = false           -- an accepted or withdrawn invitation has nothing to reset
  RETURNING expires_at, name, role INTO v_new, v_name, v_role;

  -- ── THE REFUSAL — zero rows is not success (E5) ───────────────────────────────────────────────
  -- Reached by every real miss: wrong tenant, already accepted, already revoked, no such row. They
  -- are deliberately ONE message rather than four: distinguishing "already used" from "not yours"
  -- would let a caller probe another tenant's invitation ids for existence (AC-3).
  IF v_new IS NULL THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.expiry_reset_denied', 'invitation',
            p_invitation_id::text,
            jsonb_build_object('rule', 'no pending invitation with that id in this business'),
            'denied');
    RETURN QUERY SELECT false,
      'that invitation can no longer be reset — it may have been accepted or withdrawn'::text,
      NULL::timestamptz;
    RETURN;
  END IF;

  -- ── AUDIT — who reset it, when, whose invitation (David's fourth bullet) ──────────────────────
  -- created_at supplies the WHEN (audit_log's own default); actor_user_id the WHO; target_id and
  -- the detail the WHOSE. The invited person's NAME is carried because an id is not a person to
  -- the human reading the trail six weeks later.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.expiry_reset', 'invitation',
          p_invitation_id::text,
          jsonb_build_object('invitation_id', p_invitation_id,
                             'invited_name', v_name,
                             'invited_role', v_role,
                             'new_expires_at', v_new,
                             'ttl_days', 7,
                             'source', 'reset_invitation_expiry'),
          'success');

  RETURN QUERY SELECT true, NULL::text, v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_invitation_expiry(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_invitation_expiry(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.reset_invitation_expiry(uuid, uuid, uuid) IS
  'THE RESET FUNNEL. Extends a PENDING invitation''s expiry by seven days from now, keeping the '
  'SAME token, link, QR and business_members row. Authorises the actor on team:create (the same '
  'string that gates issuing and withdrawing), scopes the write to p_business_id (AC-3), touches '
  'exactly one column, refuses a zero-row write with a reason (E5), and audits both outcomes. '
  'Exists because an invitation that nobody opened in seven days was an invitation nobody could '
  'ever open, and the only recovery was the SQL editor. ⚠️ DO NOT "just invite them again" — '
  'create_invitation has no dedup and business_members has no unique index, so a second invite '
  'mints a second inactive member row that removeMember will not clear.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — paste each block and paste the OUTPUT back, not a sentence saying it passed.
-- V3–V6 are IMPERSONATED and each one ROLLS BACK. Nothing below leaves a row behind.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 V3–V6 MUST BE RUN IMPERSONATED. `has_permission_for` reads `business_members.permissions` for
-- the PASSED user, but `assert_movement_actor` reads `auth.uid()` — which is NULL under the SQL
-- editor's role, so run as `postgres` the actor pin never fires and V4/V5 would prove nothing
-- about the browser path. This is the 20260828 board's own V7/V8 lesson.
--
-- ── V1 — the function exists, is SECURITY DEFINER, is owned by postgres, pins search_path ───────
--   SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'reset_invitation_expiry';
--   EXPECT: 1 row · owner `postgres` · prosecdef `t` · proconfig `{search_path=}`
--
-- ── V2 — execute is granted deliberately, and not to anon ───────────────────────────────────────
--   SELECT grantee, privilege_type FROM information_schema.role_routine_grants
--    WHERE routine_name = 'reset_invitation_expiry' ORDER BY grantee;
--   EXPECT: `authenticated` and `service_role` (and `postgres` as owner). NO `anon`, NO `PUBLIC`.
--
-- ── V3 — a MANAGER is REFUSED, and the refusal is audited ───────────────────────────────────────
--   Test Dave's Tree Nest = 95c1b2e9-3b09-43dd-a9f8-ba0744ca4382 · MANAGER = df7723be-…
--   🔴 PROVE IT ON TEST DAVE'S FIRST. LAWNS is the wrong place to find a mistake (20260828 board).
--   BEGIN;
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<MANAGER user_id>","role":"authenticated"}';
--     SELECT applied, reason FROM public.reset_invitation_expiry(
--       '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382'::uuid, '<MANAGER user_id>'::uuid,
--       '<any pending invitation id>'::uuid);
--   EXPECT: applied `f` · reason `you do not have permission to reset invitations for this business`
--     SET LOCAL role postgres;
--     SELECT action, outcome FROM public.audit_log
--      WHERE action = 'invitation.expiry_reset_denied' ORDER BY created_at DESC LIMIT 1;
--   EXPECT: one row, outcome `denied`
--   ROLLBACK;
--
-- ── V4 — the OWNER-role holder SUCCEEDS, one column moves, and the token does NOT ───────────────
--   BEGIN;
--     SELECT id, token, expires_at, role, used FROM public.invitations
--      WHERE id = '<pending invitation id>'::uuid;                     -- BEFORE
--     SET LOCAL role authenticated;
--     SET LOCAL request.jwt.claims = '{"sub":"<OWNER-role user_id>","role":"authenticated"}';
--     SELECT applied, reason, new_expires_at FROM public.reset_invitation_expiry(
--       '<business_id>'::uuid, '<OWNER-role user_id>'::uuid, '<pending invitation id>'::uuid);
--     SET LOCAL role postgres;
--     SELECT id, token, expires_at, role, used FROM public.invitations
--      WHERE id = '<pending invitation id>'::uuid;                     -- AFTER
--   EXPECT: applied `t` · new_expires_at ≈ now()+7d · 🔴 token IDENTICAL · role IDENTICAL ·
--           used still `f` · ONLY expires_at moved
--   ROLLBACK;
--
-- ── V5 — the audit row says who, when, and whose ────────────────────────────────────────────────
--   (inside the same V4 transaction, before ROLLBACK)
--     SELECT actor_user_id, action, target_type, target_id, outcome, created_at,
--            detail->>'invited_name', detail->>'new_expires_at'
--       FROM public.audit_log WHERE action = 'invitation.expiry_reset'
--      ORDER BY created_at DESC LIMIT 1;
--   EXPECT: actor = the OWNER-role user · target_id = the invitation id · outcome `success`
--
-- ── V6 — THE NEGATIVE CONTROLS. A check that cannot refuse is not a check (§6 r19). ─────────────
--   Each must come back applied `f`, and each is a DIFFERENT real miss:
--     (a) an invitation with used = true            → 'can no longer be reset'
--     (b) a real invitation id + the WRONG business_id → 'can no longer be reset'  (AC-3)
--     (c) a random uuid that is no invitation at all   → 'can no longer be reset'
--   🔴 (b) IS THE ONE THAT MATTERS. It is the predicate David's editor statement does not have.
--   Run it with the ACTOR's own business_id and ANOTHER tenant's invitation id: a `t` here means
--   the AC-3 predicate was dropped and the function writes across tenants.
--   BEGIN; SET LOCAL role authenticated; SET LOCAL request.jwt.claims = '{"sub":"<OWNER-role user_id>","role":"authenticated"}';
--     SELECT 'a' AS c, applied FROM public.reset_invitation_expiry('<business_id>'::uuid,'<uid>'::uuid,'<a USED invitation id>'::uuid)
--     UNION ALL
--     SELECT 'b', applied FROM public.reset_invitation_expiry('<business_id>'::uuid,'<uid>'::uuid,'<another tenant''s pending invitation id>'::uuid)
--     UNION ALL
--     SELECT 'c', applied FROM public.reset_invitation_expiry('<business_id>'::uuid,'<uid>'::uuid,gen_random_uuid());
--   EXPECT: three rows, applied `f` on all three
--   ROLLBACK;
--
-- ── V7 — the corpus claim this migration's header rests on, re-run rather than trusted ──────────
--   SELECT conname, contype FROM pg_constraint
--    WHERE conrelid = 'public.business_members'::regclass AND contype IN ('u','p','x');
--   EXPECT: the PRIMARY KEY and NOTHING ELSE. A UNIQUE here means the ORPHAN HAZARD above has been
--   closed since this was written and the header needs correcting — which is the point of asking.
