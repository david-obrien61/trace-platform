// ============================================================
// teamRouteGate — why a crew's day can or cannot be routed, as a sentence (ledger #405)
//
// PURPOSE:      David, 2026-09-24: pressing "Route this team" must either route that crew's stops
//               or SAY PLAINLY why it can't — never nothing. This is the "why not", extracted from
//               DeliveryRoute so it can be probed; the page renders what this returns.
//
// 🔴 THE DEFECT IT CLOSES. The page returned `null` whenever the selection was empty, so a crew
//    with nothing routable rendered a GREYED BUTTON AND NO WORDS. The screen answered "why can't I
//    route?" with silence — §6 r24's shape in the UI: an absence read as an answer. Lauren worked
//    around it by routing the whole day and unticking the other crew, two weekends running.
//
// 🔴 EVERY BRANCH NAMES SOMETHING — the crew, the count, or the customers. "Cannot route" on its
//    own is what we are replacing; a reason nobody can act on is barely better than silence.
// DEPENDENCIES: none — PURE. The caller supplies the stops and how it reads an address, so this
//               file cannot drift from the page's own routability test.
// OUTPUTS:      teamRouteProblem
// AC-1: no vertical noun. A stop is a stop; a team is a team.
// ============================================================

export interface GateStop {
  id: string;
  team_id?: string | null;
  /** The stop's address as ONE line, produced by the caller's own `shipToLine`. */
  address: string;
  /** What to call this stop's customer when naming it to Lauren. */
  who: string;
}

export interface GateInput {
  /** The team being routed. `null` = the whole day, which this gate never blocks. */
  teamId: string | null;
  /** What to call that team on screen — `teamLabel`'s answer, never a raw id. */
  teamName: string;
  /** Every stop on the day, as read. */
  stops: readonly GateStop[];
  /** The ids currently selected to route. */
  selected: ReadonlySet<string>;
}

/**
 * The sentence to show, or `null` when routing may proceed.
 *
 * ⚠️ ORDER MATTERS AND IS DELIBERATE: a teamless or mixed selection is reported BEFORE the empty
 * case, because those are things Lauren actively did and can undo. "Nothing is selected" is the
 * fallback, not the headline.
 */
export function teamRouteProblem(input: GateInput): string | null {
  const { teamId, teamName, stops, selected } = input;
  if (!teamId) return null;                       // the whole-day view is not gated here

  if (selected.size > 0) {
    const chosen = stops.filter(s => selected.has(s.id));
    const teamless = chosen.filter(s => !s.team_id).map(s => s.who);
    if (teamless.length) return `${teamless.join(', ')} has no team — assign it to a team first.`;
    const others = chosen.filter(s => s.team_id && s.team_id !== teamId);
    if (others.length) return `That set also contains stops for another team. Route one team at a time.`;
    return null;
  }

  // ── EMPTY. This is the branch that used to return null and say nothing. ──
  const mine = stops.filter(s => s.team_id === teamId);
  if (mine.length === 0) {
    return `No stops are assigned to ${teamName} on this day. Assign stops to ${teamName} on the schedule, then route it.`;
  }
  const noAddress = mine.filter(s => s.address.length === 0);
  if (noAddress.length === mine.length) {
    const who = noAddress.map(s => s.who).join(', ');
    return `${teamName} has ${mine.length} stop${mine.length === 1 ? '' : 's'}, but ${noAddress.length === 1 ? 'it has' : 'they have'} no address that can be placed: ${who}. Add a ship-to address on the stop, then route.`;
  }
  return `Nothing is selected for ${teamName}. Tick the stops to route, then press the button below.`;
}
