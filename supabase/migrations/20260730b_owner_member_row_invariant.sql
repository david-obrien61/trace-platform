-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PHASE 2 PRE-FLIGHT — EVERY owner_id HOLDER HAS AN OWNER MEMBER ROW
-- 2026-07-30 · the data invariant that makes Phase 2's client change safe
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 APPLY THIS WITH 20260730a, BEFORE the Phase 2 client code reaches production.
--    Order: 20260730a (owner holds all) → 20260730b (this) → deploy Phase 2.
--
-- WHY IT EXISTS. Phase 2 deletes `BusinessProvider.tsx`'s `if (isOwnerActive) return true`. After
-- that, a session's authority comes from its ROLE and the permission set that role resolves to.
-- The owner path in BusinessProvider resolves businesses by `businesses.owner_id` and DEDUPES the
-- person out of the member loop — so if that person has no `business_members` row, they finish
-- resolution with role NULL and permissions NULL. Before the ruling that was harmless, because the
-- short-circuit answered first. After it, that owner is refused everywhere on their own platform.
--
-- WHY THE FIX IS IN THE DATA AND NOT IN THE CLIENT. The tempting client fix — "if no member row,
-- fall back to the owner set" — re-introduces `owner_id` as an authority mechanism through the
-- back door, which is precisely what the 2026-07-26 TWO OWNERS ruling removed. The client instead
-- reports the state loudly ([TRACE:PERM] OWNER WITHOUT A MEMBER ROW) and this migration makes the
-- state not exist. **Authority stays keyed on the role; the row is what carries the role.**
--
-- WHY `active = true` AND role `'OWNER'`: the member row IS the authority record now. A row that
-- is inactive, or that carries any other role, would leave the owner refused — the same lockout in
-- a different costume. The permissions array is seeded from the OWNER floor (set by 20260730a),
-- read live rather than re-listed here, so this file holds NO second copy of the 52 strings.
--
-- IDEMPOTENT: inserts only where no row exists for that (business_id, user_id). Re-running it after
-- 20260730a is a no-op that returns zero rows.
--
-- SCHEMA: no table, column, policy, constraint, FK or trigger is created or altered. Data only.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 — REPORT FIRST. Which businesses are about to be repaired, and who owns them. ────────────
-- RAISE NOTICE so the repair is visible in the SQL editor output rather than inferred from a count.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT b.id, b.name, b.owner_id
      FROM public.businesses b
     WHERE b.owner_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.business_members m
                        WHERE m.business_id = b.id AND m.user_id = b.owner_id)
     ORDER BY b.name
  LOOP
    n := n + 1;
    RAISE NOTICE 'OWNER WITHOUT MEMBER ROW → repairing · % (%) · owner %', r.name, r.id, r.owner_id;
  END LOOP;
  RAISE NOTICE 'total to repair: %', n;
END $$;

-- ── §2 — THE REPAIR ─────────────────────────────────────────────────────────────────────────────
-- Permissions come from the OWNER FLOOR as it stands right now (20260730a set it to the manifest's
-- 52). Reading it live is the point: this file must never become a second place the owner's set is
-- written down, because a second copy is what the whole ruling exists to eliminate.
INSERT INTO public.business_members (business_id, user_id, role, permissions, active, name)
SELECT b.id,
       b.owner_id,
       'OWNER',
       COALESCE((SELECT rd.permissions
                   FROM public.role_definitions rd
                  WHERE rd.business_id IS NULL AND rd.role_key = 'OWNER'), '[]'::jsonb),
       true,
       NULL
  FROM public.businesses b
 WHERE b.owner_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.business_members m
                    WHERE m.business_id = b.id AND m.user_id = b.owner_id);

-- ── §3 — A ROW THAT EXISTS BUT IS WRONG IS THE SAME LOCKOUT IN A DIFFERENT COSTUME ──────────────
-- An owner whose member row is INACTIVE, or carries a non-OWNER role, resolves to the wrong set.
-- Repaired to the invariant. NOT a silent elevation: this only ever touches the person who is
-- already `businesses.owner_id`, and §4's V2 reports every row it changed.
UPDATE public.business_members m
   SET role   = 'OWNER',
       active = true
  FROM public.businesses b
 WHERE m.business_id = b.id
   AND m.user_id     = b.owner_id
   AND (m.role IS DISTINCT FROM 'OWNER' OR m.active IS DISTINCT FROM true);

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-CHECKS — run AFTER applying. CORPUS stated on each. Paste OUTPUT into the ledger row.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── V1 — THE INVARIANT HOLDS. CORPUS: businesses with a non-NULL owner_id.
-- EXPECT: 0 rows. Any row is an owner who will be refused everywhere after Phase 2 deploys.
-- SELECT b.id, b.name, b.owner_id
--   FROM public.businesses b
--  WHERE b.owner_id IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM public.business_members m
--                     WHERE m.business_id = b.id AND m.user_id = b.owner_id
--                       AND m.role = 'OWNER' AND m.active = true);

-- ── V2 — WHAT EVERY OWNER NOW HOLDS. CORPUS: business_members joined to businesses on owner_id.
-- EXPECT: one row per owned business · role OWNER · active true · n = 52 · tax_rate:read true.
-- 🔴 THIS IS THE PHASE 2 GO/NO-GO. If n is not 52 for a row, do NOT deploy Phase 2 — run
--    20260730a's §2 DO block again for that business first.
-- SELECT b.name, m.role, m.active,
--        jsonb_array_length(m.permissions) AS n,
--        m.permissions ? 'tax_rate:read'   AS has_tax_rate_read
--   FROM public.businesses b
--   JOIN public.business_members m ON m.business_id = b.id AND m.user_id = b.owner_id
--  WHERE b.owner_id IS NOT NULL
--  ORDER BY b.name;

-- ── V3 — TWO OWNERS IS EXPRESSIBLE, AND THIS IS HOW YOU ADD THE SECOND ONE.
-- Not a check — the WORKED EXAMPLE the 2026-07-26 ruling asked for. A second owner is an ordinary
-- OWNER-role member row. `businesses.owner_id` is NOT touched, because it is a fact about the
-- single legal owner-of-record and was never the authority. Both people resolve to the same
-- computed set on the client and the same stored 52 on the server.
-- INSERT INTO public.business_members (business_id, user_id, role, permissions, active, name)
-- SELECT '<BUSINESS UUID>', '<THE SECOND OWNER auth.users.id>', 'OWNER',
--        (SELECT permissions FROM public.role_definitions
--          WHERE business_id IS NULL AND role_key = 'OWNER'),
--        true, '<display name>';
