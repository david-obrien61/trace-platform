// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: THE ONE DEFINITION of "holds owner authority" for the QuickBooks
//   IMPORT CLASS — the reads and importers on /settings/accounting. It is
//   `owner_id = auth.uid()` OR `the member's role is OWNER`, and it exists so
//   the client gate and the server gate cannot drift into two answers.
//
// 🔴 THIS IS AN INTERIM. IT IS NOT THE PERMISSION MODEL AND MUST NOT BECOME IT.
//   The durable answer is R-22 Stage 2 (AUTHORITY), which is OPEN and not
//   started: retiring the ~45 policies that fence on `owner_id` and replacing
//   this check with a real permission string. Delete this module then.
//
// WHY A ROLE CHECK AND NOT A PERMISSION STRING (David, 2026-09-08):
//   Open defect ① — `has_permission`'s alias lookup runs backwards, and
//   `permission_aliases` collapses `settings:read` and `settings:update` onto
//   one legacy token. So a permission gate here does NOT loosen this to a
//   second owner; it opens it to STAFF. An explicit role check cannot be fooled
//   by the alias table. When ① is fixed, this becomes a permission and this
//   file goes away.
//
// WHY THE RULING CHANGED SHAPE (R-80 vs R-22, David's call 2026-09-08):
//   *"R-80's REASON survives, its MECHANISM does not."* R-80 chose `owner_id`
//   because a MANAGER holds `settings:update` and must not be able to pull a
//   customer's whole QuickBooks catalogue — that risk is real and STAYS
//   excluded, because MANAGER is not OWNER. But Lauren is not a manager; she is
//   a second OWNER, which is the case R-22 exists for: *"`owner_id` IS THE
//   ACCOUNT HOLDER OF LAST RESORT, NOT AN AUTHORITY MECHANISM."*
//
// ⚠️ WHAT THIS DELIBERATELY DOES **NOT** COVER: the QuickBooks WRITES SWITCH.
//   That stays `owner_id` only, by David's explicit exception. Turning writes on
//   is the point of no return — it closes the per-run undo permanently and is
//   the conversion moment, a business decision rather than an operational one.
//   Widening the readers and importers is safe precisely because everything they
//   do is undoable while test mode holds. Do NOT import this module into
//   `QboWriteSwitch`.
//
// DEPENDENCIES: none. Pure predicate over an already-resolved role string.
// OUTPUTS: `OWNER_ROLE` · `holdsOwnerAuthority(role)`.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The role string that carries owner authority. Compared case-insensitively at
 * every call site because the two layers store it differently: the client's
 * `BusinessProvider` hands back a display-ready UPPERCASE role, while
 * `business_members.role` holds whatever was written to the row.
 */
export const OWNER_ROLE = 'OWNER';

/**
 * CLIENT-SIDE: does this session hold owner authority for the active business?
 *
 * Takes the role from `useBusinessContext()`, which already resolves to `'OWNER'`
 * for BOTH the `owner_id` holder and a member whose row says OWNER
 * (`BusinessProvider` — `isOwnerActive ? 'OWNER' : role.toUpperCase()`). So this
 * is one comparison, and the two-owner case falls out of it rather than needing
 * a second branch.
 *
 * 🔴 THIS DECIDES WHETHER TO DRAW A CONTROL. IT IS NOT THE AUTHORITY.
 * The server runs `callerHoldsOwnerAuthority` on every route these controls
 * call, and that refusal is the thing that actually protects the data. A hidden
 * button has never stopped anybody.
 */
export function holdsOwnerAuthority(role: string | null | undefined): boolean {
  // 🔴 `trim()` ADDED BECAUSE THE PROBE CAUGHT ITS ABSENCE (P3), not because it was foreseen.
  // Without it a stored role of `' Owner '` denies the one person this whole build exists for, and
  // it denies her SILENTLY — the panels would simply not render again. Trimming cannot widen the
  // gate: whitespace never turns MANAGER or STAFF into OWNER, so this only removes a false denial.
  return (role ?? '').trim().toUpperCase() === OWNER_ROLE;
}
