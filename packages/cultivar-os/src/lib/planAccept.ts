// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Turn an accepted crew plan into crew assignments — the one write PLAN THE DAY does.
// DEPENDENCIES: lib/teams (assignStopsTeam — the existing writer, which enforces
//               `deliveries:update` server-side). Nothing else; no routing, no pricing.
// OUTPUTS:      acceptPlan()
//
// 🔴 IT IS A MODULE AND NOT INLINE IN THE PANEL BECAUSE `verify:writer-registry` SAID SO, AND IT
// WAS RIGHT. The panel called `assignStopsTeam` directly, which makes it a capture path — a new
// place a person changes data — and the registry refuses one without an end-to-end test. A test
// cannot reach logic that lives inside a React component's click handler, so the logic came out.
// The rule bought a real thing here: the partial-failure behaviour below is now provable.
//
// 🔴 EACH CALL IS ATOMIC; THE SEQUENCE IS NOT. `assign_stops_team` is all-or-nothing for the set
// it is given, but two crews are two calls. A failure on the second leaves the first ASSIGNED, so
// this reports exactly what landed. "Not saved" would be false and "saved" would be worse — and
// the person then has half a plan they cannot see, which is the shape #69 records for the
// reconcile path.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import { assignStopsTeam } from './teams';

export interface CrewAssignment {
  /** 1-based, for the message a person reads. */
  crew: number;
  teamId: string | null;
  stopIds: string[];
}

export interface AcceptOutcome {
  ok: boolean;
  /** What actually landed, crew by crew, in order. */
  assigned: { crew: number; stops: number; teamName: string }[];
  /** The sentence for the screen. Always present. */
  message: string;
}

export async function acceptPlan(
  db: SupabaseClient, businessId: string, crews: readonly CrewAssignment[],
): Promise<AcceptOutcome> {
  // 🔴 EVERY CREW IS CHECKED BEFORE ANY WRITE. Refusing halfway through because the SECOND column
  // has no crew would leave the first assigned for a plan the person never completed — a
  // pre-flight is the only way to make "nothing happened" true when something is missing.
  for (const c of crews) {
    if (c.stopIds.length === 0) continue;
    if (!c.teamId) {
      return { ok: false, assigned: [], message: `Pick a crew for column ${c.crew} first — a plan has to say WHO goes out. Nothing was assigned.` };
    }
  }

  const assigned: { crew: number; stops: number; teamName: string }[] = [];
  for (const c of crews) {
    if (c.stopIds.length === 0 || !c.teamId) continue;
    const out = await assignStopsTeam(db, businessId, c.stopIds, c.teamId);
    if (!out.ok) {
      const sofar = assigned.length
        ? ` ${assigned.map(a => `${a.stops} stop${a.stops === 1 ? '' : 's'} → ${a.teamName}`).join('; ')} — those ARE already assigned.`
        : ' Nothing was assigned.';
      return { ok: false, assigned, message: `Stopped at column ${c.crew}: ${out.message}.${sofar}` };
    }
      // `teamName` is nullable on the writer result (a team can be assigned by id alone).
      // Falling back to the id keeps the message TRUE rather than printing "null" at a person.
      assigned.push({ crew: c.crew, stops: out.value.assigned, teamName: out.value.teamName ?? c.teamId });
  }

  if (assigned.length === 0) return { ok: true, assigned, message: 'Nothing to assign.' };
  return {
    ok: true, assigned,
    message: `Saved. ${assigned.map(a => `${a.stops} stop${a.stops === 1 ? '' : 's'} → ${a.teamName}`).join('; ')}. Route each crew from the schedule when you are ready.`,
  };
}
