-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PASS 2 · STAGE 1 — ACCESS. THE OWNER ROLE CAN REACH WHAT THE OWNER ROLE HOLDS.
-- 2026-08-28 · David's ruling: "Lauren needs all perms and authority to act … the perms need
--              allow the role to assume the perms within that role."
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes. (CLAUDE.md §6 r1.)
--
-- ── WHAT THIS FIXES, MEASURED RATHER THAN DESCRIBED ─────────────────────────────────────────────
-- An OWNER-ROLE member who is NOT `businesses.owner_id` holds the full computed permission set on
-- the client and is refused by the database on three surfaces. Each has a different cause and each
-- is fixed by a different clause below:
--
--   · SERVICES  — `service_offerings_member` is FOR SELECT ONLY. She reads the sell-side menu and
--                 cannot write it. The only write policy is `service_offerings_owner`, a FOR ALL
--                 with `with_check` NULL, so its USING clause (`owner_id = auth.uid()`) governs
--                 writes too. §1.
--   · INVITES   — `invitations` has exactly ONE policy, `inv_owner_all`, owner_id-scoped. §2 + §4.
--   · ROSTER    — member access to `business_members` is `bm_self_select (user_id = auth.uid())`,
--                 so she sees HERSELF AND NOBODY ELSE. That is why the console reports
--                 `members: 1` and why an already-invited person is invisible to her. §3.
--
-- ── WHY A BACKFILL IS PART OF AN RLS MIGRATION (the load-bearing paragraph) ─────────────────────
-- 🔴 THERE ARE TWO MATERIALISATIONS OF THE OWNER'S AUTHORITY AND THEY MOVE BY DIFFERENT MEANS.
--   · CLIENT — `OWNER_LOCKED_SET`, COMPUTED from the manifest at page load (BusinessProvider:725).
--     Flip a status to `enforced` in TypeScript and every OWNER-role session holds the new string
--     on the next reload. No migration involved.
--   · SERVER — `has_permission()` reads `business_members.permissions`, a STORED jsonb array. SQL
--     cannot import a TS module (20260726_permission_alias_layer.sql:264-290).
-- So a status flip ALONE would grow the client's set, leave the server's array at 54, and produce
-- exactly the inversion that caused the "Tax: not identified" defect — the client offering controls
-- the database refuses. §5 is the other half of the flip, and without it this migration ships and
-- changes nothing.
--
-- ── WHY §5 GOES THROUGH THE FUNNEL AND NOT THROUGH AN UPDATE ────────────────────────────────────
-- `enforce_member_authority_immutability` permits a direct write when `auth.uid() IS NULL`
-- (20260723_permission_funnel.sql:144-147), which is true in the SQL editor. So a hand-written
-- UPDATE of `business_members.permissions` WOULD WORK, and would produce NO AUDIT ROW. The funnel
-- is the only way a role→permission fact changes (David's ruling 2026-07-23), including here.
-- §5 is the same mechanism 20260801b used to grow the set 52 → 54; this file is its successor.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────────────────────────
--   ADDITIVE POLICIES: 4 new (service_offerings ×2, invitations ×2, business_members ×1 = 5).
--   NEW FUNCTION:      public.create_invitation (SECURITY DEFINER — the invite funnel).
--   DATA:              the OWNER floor row grows 54 → 57, then every tenant re-materialises.
--   NOT TOUCHED:       every existing policy (none is dropped or replaced) · has_permission ·
--                      has_permission_for · save_role_permissions · assign_member_role ·
--                      the authority-immutability trigger · `businesses.owner_id` itself.
--   NO TABLE, COLUMN, CONSTRAINT, FK OR TRIGGER CHANGE.
--
-- 🔴 WRITES TO `business_members` STAY owner_id-ONLY, DELIBERATELY, AND THE REASON IS SHARPER THAN
--    "be careful": the authority trigger is `BEFORE UPDATE` ONLY (20260723:169 — "Trigger
--    definition itself is unchanged (still BEFORE UPDATE)"). INSERT IS NOT COVERED. A member INSERT
--    policy on `business_members` would therefore be a permission-granting side door with no funnel
--    and no audit row, taking its `permissions` array FROM THE BROWSER. That is the exact hole the
--    funnel exists to close. §4 is the answer: a SECURITY DEFINER RPC that resolves the array
--    SERVER-SIDE from the role floor and audits. Role ASSIGNMENT authority arrives in Stage 2,
--    through `assign_member_role`, which is already audited.
--
-- ── SERVICE_OFFERINGS HAS NO DELETE POLICY HERE, AND THAT IS A RULING ───────────────────────────
-- R2: "no delete verb — retire-by-flag is the likely eventual shape." Confirmed by David 2026-08-28
-- after this pass found that the hard delete was ALREADY BROKEN IN BOTH DIRECTIONS:
-- `order_service_selections.service_offering_id` is `NOT NULL REFERENCES service_offerings(id)`
-- with NO `ON DELETE` clause (20260529_businesses_f_service_offerings.sql:69), i.e. NO ACTION — so
-- deleting an offering that has ever been sold raises 23503, and deleting one that has not
-- permanently destroys it. The client-side hard delete is REMOVED in this same commit; the
-- existing `is_active` toggle IS the retire-by-flag path. No verb is minted and none is enforced.
--
-- ── RECURSION ───────────────────────────────────────────────────────────────────────────────────
-- §3 puts a policy ON `business_members` whose USING clause calls `is_active_member()` and
-- `has_permission()`, both of which READ `business_members`. This is NOT recursive: both are
-- SECURITY DEFINER owned by `postgres`, so they bypass RLS entirely. §0 ASSERTS that ownership
-- rather than trusting it — if either were ever re-created as INVOKER, this migration must refuse
-- to apply rather than deadlock the roster for everyone.
--
-- ── ROLLBACK REFERENCE ──────────────────────────────────────────────────────────────────────────
-- The pre-change definitions of every policy this file adds ALONGSIDE are:
--   service_offerings_owner  — 20260529_businesses_f_service_offerings.sql:57-60
--   service_offerings_member — 20260727_rbac_resource_action_flip.sql:185-187 (SELECT only)
--   inv_owner_all            — 20260602_shared_members_a_create_tables.sql:104-109
--   bm_owner_all             — 20260602_shared_members_a_create_tables.sql:48-53
--   bm_self_select           — 20260602_shared_members_a_create_tables.sql:56-57
--   bm_self_update           — 20260602_shared_members_a_create_tables.sql:60-61
-- and David's live `pg_policies` inventory of 2026-08-28 (45 owner_id policies across 41 tables;
-- member policies on 17) is the only record of what is ACTUALLY live. Nothing above is dropped, so
-- rollback is `DROP POLICY` on the five names created here plus `DROP FUNCTION create_invitation`,
-- followed by re-running 20260801b §2/§3 to return the OWNER floor to 54.
--
-- GATED: David applies this as `postgres`, then runs V1–V9 in the footer.
-- AC-1 (no vertical nouns) · AC-2 (membership-scoped) · AC-3 (tenant isolation absolute).
-- ════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §0 — PRE-FLIGHT. Loud at apply beats silent at first call.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_missing text;
  v_bad     text;
BEGIN
  -- (a) functions this migration CALLS must already exist. plpgsql does not resolve them until
  --     CALL time, so a missing prereq would apply cleanly and fail live.
  SELECT string_agg(p.fn, ', ') INTO v_missing
    FROM (VALUES ('is_active_member'), ('has_permission'), ('has_permission_for'),
                 ('assert_movement_actor'), ('save_role_permissions')) AS p(fn)
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = p.fn);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'owner-authority pre-flight FAILED — required function(s) absent: %.', v_missing;
  END IF;

  -- (b) 🔴 THE RECURSION GUARD. is_active_member / has_permission MUST be SECURITY DEFINER owned by
  --     postgres, or §3's policy on business_members re-enters RLS on business_members. Asserted,
  --     never assumed — this is the one property that makes the whole file safe.
  SELECT string_agg(p.proname || ' (' || CASE WHEN NOT p.prosecdef THEN 'not SECURITY DEFINER'
                                              ELSE 'owner=' || a.rolname END || ')', ', ')
    INTO v_bad
    FROM pg_proc p
    JOIN pg_roles a ON a.oid = p.proowner
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('is_active_member', 'has_permission')
     AND (NOT p.prosecdef OR a.rolname <> 'postgres');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'owner-authority pre-flight FAILED — RLS-bypass primitive is unsafe: %. '
                    'A policy ON business_members that calls a non-DEFINER predicate recurses.', v_bad;
  END IF;

  -- (c) tables + columns this file writes.
  SELECT string_agg(c.tbl || '.' || c.col, ', ') INTO v_missing
    FROM (VALUES
      ('service_offerings','business_id'), ('service_offerings','is_active'),
      ('invitations','business_id'), ('invitations','token'), ('invitations','role'),
      ('invitations','used'), ('invitations','expires_at'),
      ('business_members','business_id'), ('business_members','role'),
      ('business_members','permissions'), ('business_members','active'),
      ('business_members','invite_id'), ('business_members','name'),
      ('role_definitions','business_id'), ('role_definitions','role_key'),
      ('role_definitions','permissions'),
      ('audit_log','action'), ('audit_log','outcome'), ('audit_log','detail')
    ) AS c(tbl, col)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'owner-authority pre-flight FAILED — expected column(s) absent: %.', v_missing;
  END IF;

  -- (d) the OWNER floor row must exist — §5 UPDATEs it, and an UPDATE that matches zero rows is
  --     SILENT SUCCESS (the A8 shape, in a migration).
  IF NOT EXISTS (SELECT 1 FROM public.role_definitions
                  WHERE business_id IS NULL AND role_key = 'OWNER') THEN
    RAISE EXCEPTION 'owner-authority pre-flight FAILED — no OWNER floor row (business_id IS NULL). '
                    'Apply 20260730a / 20260801b first.';
  END IF;
END
$preflight$;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1 — service_offerings: THE MEMBER MAY NOW WRITE THE SELL-SIDE MENU
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Shape copied from `service_offerings_member` (20260727:185-187), the read policy this pair
-- completes: `is_active_member(business_id) AND has_permission(business_id, '<string>')`.
--
-- 🔴 NOT the `cultivar_plants` shape (`owner_id = auth.uid() OR is_active_member(business_id)`).
--    That one grants EVERY active member including STAFF, and it is a fused owner+member FOR ALL —
--    the opposite of what a permission-gated write policy is for.
-- 🔴 NOT keyed on `role = 'OWNER'`. The grant decision lives in the MANIFEST, once; baking it into
--    a policy would duplicate it per-table and break the day a tenant renames the role.
--
-- Grants: the UPDATE policy is what the On/Off (is_active) toggle and the edit form both ride.
-- There is NO DELETE policy — see the header. `service_offerings_owner` (FOR ALL, owner_id) is
-- untouched and still covers the owner_id holder for every verb including delete.
DROP POLICY IF EXISTS service_offerings_member_insert ON public.service_offerings;
CREATE POLICY service_offerings_member_insert ON public.service_offerings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id)
              AND public.has_permission(business_id, 'service_offerings:create'));

DROP POLICY IF EXISTS service_offerings_member_update ON public.service_offerings;
CREATE POLICY service_offerings_member_update ON public.service_offerings
  FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id)
              AND public.has_permission(business_id, 'service_offerings:update'))
  WITH CHECK (public.is_active_member(business_id)
              AND public.has_permission(business_id, 'service_offerings:update'));

COMMENT ON POLICY service_offerings_member_insert ON public.service_offerings IS
  'A member holding service_offerings:create may add a service. Pairs with service_offerings_member '
  '(SELECT) and service_offerings_member_update. No DELETE policy exists by ruling (R2 — '
  'retire-by-flag via is_active).';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — invitations: READ AND WITHDRAW. CREATE IS §4's RPC, NOT A POLICY.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Gated on `team:create` rather than `team:read`, and that is a decision not an accident: seeing
-- your own pending invitations and withdrawing one are parts of the INVITE capability, not of
-- reading the roster. A MANAGER holds neither string today and is unaffected in both directions.
--
-- 🔴 THERE IS DELIBERATELY NO INSERT POLICY. `create_invitation` (§4) is SECURITY DEFINER and
--    bypasses RLS, so it needs none — and its absence is what makes the RPC the ONLY door. An
--    INSERT policy here would let a client mint an invitation row whose paired member row it then
--    could not create, which is worse than a refusal: a half-made invite.
--
-- The UPDATE covers `revokeInvitation` (sets used = true). WITH CHECK is stated explicitly rather
-- than inherited so a row can never be UPDATEd out of its own tenant (AC-3).
DROP POLICY IF EXISTS invitations_member_select ON public.invitations;
CREATE POLICY invitations_member_select ON public.invitations
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id)
         AND public.has_permission(business_id, 'team:create'));

DROP POLICY IF EXISTS invitations_member_update ON public.invitations;
CREATE POLICY invitations_member_update ON public.invitations
  FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id)
              AND public.has_permission(business_id, 'team:create'))
  WITH CHECK (public.is_active_member(business_id)
              AND public.has_permission(business_id, 'team:create'));


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §3 — business_members: THE ROSTER BECOMES VISIBLE. READ ONLY.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `bm_self_select` STAYS. It is not redundant: every session — including a STAFF member holding no
-- team string at all — must be able to read its OWN row, because BusinessProvider resolves the
-- session's role and permissions from it (BusinessProvider.tsx:487). Removing it would black out
-- the whole app for everyone below OWNER.
--
-- This policy is ADDITIVE and permissive, so a member sees their own row via bm_self_select and
-- the whole roster via this one. `team:read` is already held by OWNER and by nobody else
-- (MANAGER_DEFAULT_BUNDLE does not contain it — verified), so MANAGER and STAFF do not move.
--
-- ⚠️ THIS MAKES `team:read` TABLE-ENFORCED FOR THE FIRST TIME. It was route-enforced, and the
--    manifest's `team` entry SAYS SO — `routeEnforced: true` plus a note reading "team:read is
--    enforced at the /team route". Both are corrected in the same commit as this policy. A declared
--    field going stale is the same defect class as the two-materialisations problem this whole pass
--    is about, and leaving it would be that defect committed knowingly.
--
-- 🔴 WRITES ARE NOT WIDENED. No INSERT, UPDATE or DELETE policy is added here. See the header for
--    why (BEFORE UPDATE ≠ INSERT), and Stage 2 for where the authority actually arrives.
DROP POLICY IF EXISTS bm_member_select ON public.business_members;
CREATE POLICY bm_member_select ON public.business_members
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id)
         AND public.has_permission(business_id, 'team:read'));

COMMENT ON POLICY bm_member_select ON public.business_members IS
  'A member holding team:read sees the whole roster for their business. ADDITIVE to bm_self_select, '
  'which stays because every session resolves its own role/permissions from its own row. READ ONLY '
  '— member writes to this table remain owner_id-scoped (bm_owner_all) because the authority '
  'trigger is BEFORE UPDATE only and would not cover an INSERT.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §4 — create_invitation — THE INVITE FUNNEL
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THIS CLOSES A HOLE THAT EXISTS TODAY, it does not merely avoid opening a new one. Until now
--    `createInvitation` (packages/shared/src/auth/invitations.ts) INSERTed the member row FROM THE
--    BROWSER with a `permissions` array TAKEN FROM THE REQUEST BODY. The owner's own client
--    resolved it honestly; nothing required it to. Server-resolving that array is the point of
--    this function, and it is why the client's `permissions` parameter is DELETED rather than
--    passed through — a parameter that is ignored is a parameter someone will believe in.
--
-- SHAPE: modelled on save_role_permissions / assign_member_role —
--   assert_movement_actor (impersonation RAISES) → authorise (denial RETURNS so its audit row
--   COMMITS) → resolve server-side → write → audit → return.
--
-- BOTH ROWS IN ONE TRANSACTION. A plpgsql function body is one transaction, so the invitation row
-- and its paired inactive member row land together or not at all. The two-step client version
-- could half-land and compensated with a rollback UPDATE; this cannot get there.
--
-- 🔴 THE OWNER ROLE CANNOT BE INVITED BY A NON-owner_id ACTOR IN THIS STAGE, AND THIS IS
--    LIGHTNING'S CALL, NOT DAVID'S — flagged so it can be overruled in a line. Inviting somebody
--    as OWNER is a PROMOTION, and David's ruling puts promotion in the OWNER role's hands. But
--    Stage 1 is ACCESS and Stage 2 is AUTHORITY: letting Stage 1 mint a second OWNER through the
--    invite door would deliver role-assignment authority ahead of, and outside of, the single
--    audited place Stage 2 is going to put it. Stage 2 relaxes this to "the actor holds the OWNER
--    role", in the same commit that relaxes assign_member_role, so both promotion paths change
--    together or neither does.
--
-- RETURN CONTRACT (mirrors the funnel's (applied, reason) shape):
--   denial  → exactly one row: (false, reason, NULL, NULL, NULL, NULL)
--   success → exactly one row: (true, NULL, invitation_id, token, member_id, permissions)
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_name          text,
  p_role_key      text,
  p_email         text DEFAULT NULL,
  p_phone         text DEFAULT NULL
) RETURNS TABLE(applied boolean, reason text, invitation_id uuid, invite_token text,
                new_member_id uuid, resolved_permissions jsonb)
-- 🔴 THE OUT PARAMETERS ARE NAMED TO AVOID COLUMN COLLISIONS, AND THAT IS NOT COSMETIC. In plpgsql
-- an OUT parameter SHADOWS a column of the same name inside the body, so an OUT param called
-- `permissions` would make `SELECT permissions FROM role_definitions` raise "column reference is
-- ambiguous" AT CALL TIME — a runtime failure a migration applies cleanly over. The existing funnel
-- RPCs avoid it the same way (`perms_before` / `perms_after`), and `member_id` is avoided because
-- member_devices carries that column name.
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resolved   jsonb;
  v_role       text := upper(coalesce(p_role_key, ''));
  v_name       text := nullif(btrim(coalesce(p_name, '')), '');
  v_inv_id     uuid;
  v_token      text;
  v_member_id  uuid;
  v_is_holder  boolean;
BEGIN
  -- Impersonation is a hard RAISE, not a recoverable denial (same as the two funnel RPCs).
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- ── AUTHORISE ────────────────────────────────────────────────────────────────────────────────
  -- has_permission_for, not has_permission: the actor is PASSED, and it has had no owner branch
  -- since 2026-07-30, so this is a pure "does this person hold the string" test.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'team:create') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.create_denied', 'invitation', NULL,
            jsonb_build_object('attempted_role', v_role, 'rule', 'team:create is required'), 'denied');
    RETURN QUERY SELECT false, 'you do not have permission to invite people to this business'::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── VALIDATE (§1.6 item 3 — refuse, never fabricate) ─────────────────────────────────────────
  IF v_name IS NULL THEN
    RETURN QUERY SELECT false, 'a name is required'::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── THE OWNER-PROMOTION GUARD (Stage 1 only — see the header) ────────────────────────────────
  SELECT EXISTS (SELECT 1 FROM public.businesses
                  WHERE id = p_business_id AND owner_id = p_actor_user_id)
    INTO v_is_holder;
  IF v_role = 'OWNER' AND NOT v_is_holder THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, 'OWNER', 'invitation.create_denied', 'invitation', NULL,
            jsonb_build_object('attempted_role', v_role,
                               'rule', 'inviting an OWNER is a promotion; Stage 1 keeps it with the account holder'),
            'denied');
    RETURN QUERY SELECT false,
      'only the account holder can invite someone as an owner'::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── RESOLVE THE ROLE, SERVER-SIDE. THE CLIENT NEVER SUPPLIES A PERMISSION ARRAY. ─────────────
  -- Identical resolution to assign_member_role: tenant override wins over the floor. Mints read
  -- the resolved floor (David's ruling 2026-07-23) — so an invite seeds from the SAME source the
  -- Roles tab renders and the funnel writes, and there is no fourth copy to drift (STD-011).
  SELECT permissions INTO v_resolved
    FROM public.role_definitions
   WHERE role_key = v_role AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC
   LIMIT 1;

  IF v_resolved IS NULL THEN
    RETURN QUERY SELECT false, ('role ' || v_role || ' is not defined for this business')::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── WRITE — both rows, one transaction ───────────────────────────────────────────────────────
  INSERT INTO public.invitations (business_id, name, email, phone, role)
  VALUES (p_business_id, v_name, nullif(btrim(coalesce(p_email, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''), v_role)
  RETURNING id, token INTO v_inv_id, v_token;

  -- The paired INACTIVE member row acceptInvitation looks for by invite_id (acceptInvitation.ts:71).
  -- `active = false` and `user_id` NULL until the person accepts. The authority trigger is BEFORE
  -- UPDATE and does not fire on this INSERT; the array is safe because it came from the line above,
  -- not from a caller.
  INSERT INTO public.business_members
    (business_id, name, email, phone, role, permissions, active, invite_id)
  VALUES (p_business_id, v_name, nullif(btrim(coalesce(p_email, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''), v_role, v_resolved, false, v_inv_id)
  RETURNING id INTO v_member_id;

  -- ── AUDIT — the accountability record (D-51 / the two-log split) ─────────────────────────────
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', 'invitation.created', 'invitation',
          v_inv_id::text,
          jsonb_build_object('name', v_name, 'role', v_role,
                             'member_id', v_member_id,
                             'permission_count', jsonb_array_length(v_resolved),
                             'permissions', v_resolved,
                             'has_email', (nullif(btrim(coalesce(p_email, '')), '') IS NOT NULL),
                             'source', 'create_invitation'),
          'success');

  RETURN QUERY SELECT true, NULL::text, v_inv_id, v_token, v_member_id, v_resolved;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invitation(uuid, uuid, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, uuid, text, text, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_invitation(uuid, uuid, text, text, text, text) IS
  'THE INVITE FUNNEL. Authorises the actor on team:create, RESOLVES the permission array '
  'server-side from the role floor (never from the caller), writes the invitation row and its '
  'paired inactive business_members row in ONE transaction, and audits. Replaces the two-step '
  'client INSERT that took its permissions array from the browser. Stage 1 refuses an OWNER-role '
  'invite from anyone but the account holder; Stage 2 relaxes that with assign_member_role.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §5 — THE OWNER FLOOR GROWS 54 → 57, CARRYING THE COMPLETE SET
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE COMPLETE SET, NEVER A DELTA. capA assertion 3 finds the NEWEST migration carrying an
-- `$OWNER$[…]$OWNER$` literal BY CONTENT (not by a dated path) and compares it to
-- OWNER_DEFAULT_BUNDLE by FULL EQUALITY. This file is now that newest carrier. A delta-shaped
-- literal would fail the build with 54 strings missing — the contract working, not the cap being
-- awkward.
--
-- 20260801b IS NOT EDITED. It stays exactly as applied; capA prints it `superseded`. That is the
-- whole reason the pin came out on 2026-08-01: the model must be able to grow without editing
-- history (§6 r1).
--
-- THE THREE NEW STRINGS, and what each buys:
--   service_offerings:create → §1's INSERT policy  → "Add a service" works for an OWNER-role member
--   service_offerings:update → §1's UPDATE policy  → editing and the On/Off toggle work
--   team:create              → §2 + §4            → invite, list pending invites, revoke one
UPDATE public.role_definitions
   SET permissions = $OWNER$[
  "audit_log:read", "campaigns:read", "campaigns:update", "costs:create", "costs:delete",
  "costs:read", "costs:update", "customers:create", "customers:read", "customers:update",
  "deliveries.route:read", "deliveries:create", "deliveries:read", "deliveries:update",
  "inventory:create", "inventory:delete", "inventory:import_price", "inventory:read",
  "inventory:update", "inventory_ledger:read", "margin:read", "order_compliance_records:create",
  "order_compliance_records:read", "order_compliance_records:update", "order_discount:apply",
  "order_items:create", "order_items:delete", "order_items:read", "order_items:update",
  "order_service_selections:create", "order_service_selections:delete",
  "order_service_selections:read", "order_service_selections:update", "orders:create",
  "orders:delete", "orders:read", "orders:update", "pmi:read", "pmi:update", "pricing_recipe:read",
  "pricing_recipe:update", "service_offerings:create", "service_offerings:read",
  "service_offerings:update", "settings:read", "settings:update", "subscription:read",
  "subscription:update", "tax_exempt:apply", "tax_rate:read", "tax_rate:update", "team:create",
  "team:read", "wages:create", "wages:delete", "wages:read", "wages:update"
]$OWNER$::jsonb,
       description = 'Holds every enforced permission in the manifest. LOCKED — computed from the '
                  || 'model, not curated. A new enforced permission is inherited automatically; no '
                  || 'permission can be removed, including by the owner (ruling 2026-07-30). '
                  || 'Grown to 57 on 2026-08-28: the OWNER role carries full authority, so it '
                  || 'reaches services and invitations (ruling 2026-08-28).',
       updated_at  = now()
 WHERE business_id IS NULL
   AND role_key    = 'OWNER';

-- ── §6 — EVERY BUSINESS RESETS ITS OWNER ROLE ONTO THE NEW FLOOR, THROUGH THE FUNNEL ───────────
-- Identical mechanism to 20260730a §2 and 20260801b §3, for identical reasons: the funnel is the
-- only way a role→permission fact changes, and going through it produces the audit row that makes
-- this visible afterwards. The actor is the REAL owner — `auth.uid()` is NULL in the SQL editor, so
-- a NULL actor would fail the membership check and name a system ghost in the log.
--
-- David verified 2026-08-28 that all three live tenants carry a non-null owner_id, so the
-- `WHERE owner_id IS NOT NULL` filter skips nothing today. It stays anyway: it is what keeps this
-- block from raising on a future tenant that has none, and V4 REPORTS any it skipped rather than
-- burying them.
DO $$
DECLARE
  b record;
  v_rows int;
  v_skipped int := 0;
BEGIN
  SELECT count(*) INTO v_skipped FROM public.businesses WHERE owner_id IS NULL;
  IF v_skipped > 0 THEN
    RAISE WARNING 'owner-authority: % business(es) have owner_id IS NULL and were SKIPPED — their '
                  'OWNER-role members do NOT receive the three new strings. Run V4.', v_skipped;
  END IF;

  FOR b IN
    SELECT id, name, owner_id FROM public.businesses WHERE owner_id IS NOT NULL ORDER BY name
  LOOP
    SELECT count(*) INTO v_rows
      FROM public.save_role_permissions(
             b.id, b.owner_id, 'OWNER', 'reset', NULL, NULL,
             '[]'::jsonb,                       -- ignored by `reset`; the floor is the source
             'owner-role-carries-authority'     -- p_reason — the audit says WHY
           );
    RAISE NOTICE 'OWNER reset · % (%) · members re-materialised=%', b.name, b.id, v_rows;
  END LOOP;
END $$;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — RUN EVERY ONE AFTER APPLYING. Thunder CANNOT run these (no catalog access this
-- session); they are David's, per the §9 schema-verification gate. Paste the OUTPUT, not a
-- sentence saying it passed. Anything not matching its stated expectation is a STOP, not a note.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ PROVE ON TEST DAVE'S TREE NEST FIRST — 95c1b2e9-3b09-43dd-a9f8-ba0744ca4382.
--    It has real role variety (a MANAGER df7723be, two STAFF 39691f0b / 877e0dfa). LAWNS
--    (98f4e56b-cd27-4099-a9d8-5c8cbb63d00f) has seven installs tomorrow.
--
-- ── V1 — THE FLOOR IS 57, AND ALL THREE NEW STRINGS ARE IN IT. CORPUS: role_definitions floor.
-- EXPECT: n = 57, and three t's.
-- SELECT jsonb_array_length(permissions) AS n,
--        permissions ? 'service_offerings:create' AS has_so_create,
--        permissions ? 'service_offerings:update' AS has_so_update,
--        permissions ? 'team:create'              AS has_team_create
--   FROM public.role_definitions WHERE business_id IS NULL AND role_key = 'OWNER';
--
-- ── V2 — EVERY OWNER-ROLE MEMBER CARRIES 57. CORPUS: business_members, role OWNER, active.
-- EXPECT: one row per OWNER-role member, EVERY n = 57. An n = 54 is a tenant the reset missed.
-- SELECT b.name AS business, m.name AS member, jsonb_array_length(m.permissions) AS n
--   FROM public.business_members m JOIN public.businesses b ON b.id = m.business_id
--  WHERE m.role = 'OWNER' AND m.active = true ORDER BY b.name, m.name;
--
-- ── V3 — 🔴 NOBODY ELSE MOVED. CORPUS: every active non-OWNER member, all tenants.
-- EXPECT: MANAGER = 25, STAFF = 10, and ZERO rows holding any of the three new strings.
-- SELECT b.name AS business, m.role, m.name AS member, jsonb_array_length(m.permissions) AS n,
--        (m.permissions ?| ARRAY['service_offerings:create','service_offerings:update','team:create'])
--          AS holds_a_new_string
--   FROM public.business_members m JOIN public.businesses b ON b.id = m.business_id
--  WHERE m.role <> 'OWNER' AND m.active = true ORDER BY b.name, m.role, m.name;
--
-- ── V4 — WAS ANY TENANT SKIPPED? CORPUS: businesses.
-- EXPECT: 0 rows. A row is a tenant whose OWNER-role members did NOT get the new strings.
-- SELECT id, name FROM public.businesses WHERE owner_id IS NULL;
--
-- ── V5 — THE FIVE POLICIES EXIST AND SAY WHAT THEY SHOULD. CORPUS: pg_policies.
-- EXPECT: 5 rows. Read each qual/with_check — every one must contain BOTH is_active_member AND
-- has_permission, and NONE may contain owner_id or a literal 'OWNER'.
-- SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--  WHERE schemaname = 'public'
--    AND policyname IN ('service_offerings_member_insert','service_offerings_member_update',
--                       'invitations_member_select','invitations_member_update','bm_member_select')
--  ORDER BY tablename, policyname;
--
-- ── V6 — 🔴 NO DELETE POLICY WAS ADDED TO service_offerings. CORPUS: pg_policies.
-- EXPECT: exactly ONE row — service_offerings_owner (FOR ALL, owner_id). If a member DELETE policy
-- appears, R2 was violated.
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE schemaname='public' AND tablename='service_offerings' AND cmd IN ('DELETE','ALL')
--  ORDER BY policyname;
--
-- ── V7 — 🔴 THE ROSTER, AS THE OWNER-ROLE MEMBER WHO IS NOT owner_id. THE HEADLINE CHECK.
-- Must run IMPERSONATED — has_permission reads auth.uid(), which is NULL under the SQL editor's
-- role, so run as postgres it returns false for everyone and proves nothing.
-- EXPECT: roster_rows = the FULL member count for that business (not 1), and can_invite = true.
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<THE OWNER-ROLE MEMBER''S auth.users.id>"}';
--   SELECT count(*) AS roster_rows FROM public.business_members
--    WHERE business_id = '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382';
--   SELECT public.has_permission('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382','team:create')              AS can_invite,
--          public.has_permission('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382','service_offerings:update') AS can_edit_service,
--          public.has_permission('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382','service_offerings:create') AS can_add_service;
-- ROLLBACK;
--
-- ── V8 — 🔴 THE MANAGER DID NOT MOVE. Same shape, impersonating df7723be.
-- EXPECT: every value FALSE, and roster_rows = 1 (their own row, via bm_self_select).
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<MANAGER df7723be''s auth.users.id>"}';
--   SELECT count(*) AS roster_rows FROM public.business_members
--    WHERE business_id = '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382';
--   SELECT public.has_permission('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382','team:read')                AS can_read_team,
--          public.has_permission('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382','team:create')              AS can_invite,
--          public.has_permission('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382','service_offerings:update') AS can_edit_service;
-- ROLLBACK;
--
-- ── V9 — THE INVITE FUNNEL REFUSES A NON-HOLDER, AND AUDITS THE REFUSAL. CORPUS: create_invitation.
-- EXPECT: applied = false, reason = 'you do not have permission…', plus ONE audit row
-- action='invitation.create_denied' outcome='denied'. Rolled back, so it changes nothing.
-- BEGIN;
--   SELECT applied, reason FROM public.create_invitation(
--     '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382', '<MANAGER df7723be''s auth.users.id>',
--     'V9 probe', 'STAFF');
--   SELECT action, outcome, detail->>'rule' FROM public.audit_log
--    WHERE action = 'invitation.create_denied' ORDER BY created_at DESC LIMIT 1;
-- ROLLBACK;
