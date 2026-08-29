// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: decide whether a roster WRITE control may be offered, and if not, say WHY in words a
//   non-technical owner can act on. Three controls on the member roster — Remove, Deactivate /
//   Reactivate, and Set phone — are DIRECT client writes governed by `bm_owner_all`, i.e. by
//   `businesses.owner_id`. They are NOT covered by the permission funnel and were NOT widened by
//   the 2026-08-28 access pass, which widened only the roster READ.
//
//   Without this module, that pass would have shipped a fix that CREATED three visible failures:
//   an OWNER-ROLE member who is not the account holder would finally SEE the whole roster and then
//   be refused by three of its buttons — the dead-affordance class §1.6 item 5 forbids, arriving
//   in the same commit that fixed the read, and visible now that a refused write no longer renders
//   as a saved one.
//
//   The shape is §6 r13 applied to an ACTION rather than a field: locked WITH AN EXPLANATION,
//   never silently greyed and never a mystery refusal. The control renders, disabled, and names
//   what would let it work.
//
// 🔴 THIS IS A DISPLAY DECISION, NOT A SECURITY BOUNDARY. The database is the boundary
//   (`bm_owner_all`); this only decides whether to offer a control the database would refuse.
//   Never invert that: a UI that hides a control is not a UI that prevents an act.
//
// DEPENDENCIES: none — pure. That is deliberate: it is the seam that MOVES when these three acts
//   join the funnel, and a pure function is a thing a test can pin in both directions.
//
// OUTPUTS: ROSTER_WRITE_ACTIONS, rosterActionLock.
//
// ⚠️ NEXT MOVE, RECORDED SO IT IS NOT RE-DERIVED (David, 2026-08-28): `removeMember` and
//   `setMemberActive` are ACCESS CONTROL, not data edits — they belong in the funnel beside
//   `assign_member_role`, not as direct client writes. `setMemberPhone` is benign and can stay a
//   normal write. When that lands, `remove` and `set_active` stop being owner_id-gated here and
//   this module shrinks to one entry, or to none.
// ─────────────────────────────────────────────────────────────────────────────

/** The three roster writes still fenced on `businesses.owner_id`. */
export type RosterWriteAction = 'remove' | 'set_active' | 'set_phone';

export const ROSTER_WRITE_ACTIONS: RosterWriteAction[] = ['remove', 'set_active', 'set_phone'];

export interface RosterActorContext {
  /**
   * TRUE only when the signed-in person IS `businesses.owner_id` for the active business.
   * This is the FACT of account holding, not a permission — the distinction the 2026-07-30 ruling
   * turns on. `BusinessProvider` resolves it from the owner path and exposes it as `isOwner`.
   */
  isAccountHolder: boolean;
}

export interface RosterActionLock {
  /** May the control be offered as usable? */
  allowed: boolean;
  /**
   * Why not — a complete sentence, aimed at the person reading the screen, naming BOTH what is
   * withheld and what would grant it. `null` when allowed, so a caller cannot render a reason
   * beside a working control.
   */
  reason: string | null;
}

/**
 * What each locked control says. Written to be read by Lauren, not by a reviewer: it names the
 * one thing she cannot do, says who can, and — the part that stops it reading as a bug — makes
 * clear that the rest of the page IS hers. A lock with no explanation is the mystery-greying §6
 * r13 exists to forbid.
 */
const LOCKED_REASON: Record<RosterWriteAction, string> = {
  remove:
    'Only the account holder can remove someone from the team. Your owner role covers everything '
    + 'else on this page, including inviting people and setting what each role can do.',
  set_active:
    'Only the account holder can deactivate or reactivate a team member. Your owner role covers '
    + 'everything else on this page, including inviting people and setting what each role can do.',
  set_phone:
    'Only the account holder can change another member’s phone number. Each person can change '
    + 'their own from their profile.',
};

/**
 * May this roster write be offered, and if not, what does the screen say?
 *
 * PURE. No network, no session read — the caller passes the fact. That keeps the decision testable
 * and keeps the UI from re-deriving "am I the owner" in three places with three spellings.
 */
export function rosterActionLock(
  action: RosterWriteAction,
  ctx: RosterActorContext,
): RosterActionLock {
  if (ctx.isAccountHolder) return { allowed: true, reason: null };
  return { allowed: false, reason: LOCKED_REASON[action] };
}
