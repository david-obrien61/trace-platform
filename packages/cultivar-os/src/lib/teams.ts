// ============================================================
// teams — the team list, and which team takes a stop (ledger #362, piece 1)
//
// PURPOSE:      LAWNS runs Team 1, Team 2 and Team 3 and nothing could see them; Saturday
//               2026-09-19 was the cost (tech-debt #345). This is every client call for teams:
//               Lauren edits the list in Settings, and stops are assigned to a team from the
//               schedule and the route page. The RULES live in the database functions of
//               20260921a — `save_team` and `assign_stops_team`, both checking `deliveries:update`
//               server-side — and nothing here decides them.
// DEPENDENCIES: a Supabase client (Lauren's own session).
// OUTPUTS:      readTeams · saveTeam · retireTeam · assignStopsTeam · teamLabel
//
// 🔴 MEMBERS ARE NAMES, NOT LOGINS (David's ruling). There is no invitation and no user id: a 1099
//    crew comes and goes, which is the same reason the crew link has no login.
// 🔴 RETIRE, NEVER DELETE ([[R-133]]). `active: false` takes a team out of the pickers; a stop that
//    already carries it keeps reading it, so history stays true.
// AC-1: no vertical noun. A team is a team; a stop is a stop.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';

const TRACE_TEAMS = true; // [TRACE:TEAMS] STD-003 — ON until David owner-proves

export interface TeamMember { id: string; name: string; sort_order: number }
export interface Team {
  id: string; name: string; active: boolean; sort_order: number;
  vendor_id: string | null;
  members: TeamMember[];
}
type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const TEAM_COLUMNS = 'id, name, active, sort_order, vendor_id, team_members ( id, name, sort_order )';

/**
 * Every team of the business, live ones first, each with its people in order.
 * `absent` = the tables are not there yet (20260921a not applied) — said, never shown as "no teams".
 */
export async function readTeams(
  db: SupabaseClient, businessId: string,
): Promise<{ ok: true; teams: Team[] } | { ok: false; absent: boolean; message: string }> {
  const { data, error } = await db.from('teams').select(TEAM_COLUMNS)
    .eq('business_id', businessId)
    .order('active', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) {
    const code = (error as { code?: string }).code;
    if (TRACE_TEAMS) console.log('[TRACE:TEAMS] read failed', { code, message: error.message });
    return { ok: false, absent: code === '42P01' || code === 'PGRST205', message: error.message };
  }
  const teams = (data ?? []).map((t: Record<string, unknown>) => ({
    id: String(t.id), name: String(t.name), active: !!t.active,
    sort_order: Number(t.sort_order ?? 0), vendor_id: (t.vendor_id as string | null) ?? null,
    members: ((t.team_members ?? []) as TeamMember[]).slice().sort((a, b) => a.sort_order - b.sort_order),
  }));
  if (TRACE_TEAMS) console.log('[TRACE:TEAMS] read', teams.length, 'teams');
  return { ok: true, teams };
}

/** Create or update a team AND its member list in one call — a half-saved team cannot exist. */
export async function saveTeam(
  db: SupabaseClient, businessId: string,
  team: { id?: string | null; name: string; active?: boolean; vendorId?: string | null; memberNames: string[] },
): Promise<Result<{ teamId: string; name: string; members: number }>> {
  const { data, error } = await db.rpc('save_team', {
    p_business_id: businessId, p_team_id: team.id ?? null, p_name: team.name,
    p_active: team.active ?? true, p_vendor_id: team.vendorId ?? null, p_member_names: team.memberNames,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (TRACE_TEAMS) console.log('[TRACE:TEAMS] save failed', { code, message: error.message });
    if (code === 'PGRST202') {
      return { ok: false, code: 'needs_migration', message: 'Teams need the database update (20260921a) — it has not been applied yet.' };
    }
    return { ok: false, code: 'error', message: error.message };
  }
  const d = data as { ok: boolean; code?: string; message?: string; team_id?: string; name?: string; members?: number };
  if (TRACE_TEAMS) console.log('[TRACE:TEAMS] save', { ok: d?.ok, code: d?.code, members: d?.members });
  if (!d?.ok || !d.team_id) return { ok: false, code: d?.code ?? 'error', message: d?.message ?? 'The team was not saved.' };
  return { ok: true, value: { teamId: d.team_id, name: d.name ?? team.name, members: d.members ?? 0 } };
}

/** Retire a team: the same writer with `active:false`. Its stops keep reading it (R-133). */
export function retireTeam(db: SupabaseClient, businessId: string, team: Team): Promise<Result<{ teamId: string; name: string; members: number }>> {
  return saveTeam(db, businessId, {
    id: team.id, name: team.name, active: false, vendorId: team.vendor_id,
    memberNames: team.members.map(m => m.name),
  });
}

/** Put a set of stops on a team — or on none (`teamId: null`), which is reversible. All or nothing. */
export async function assignStopsTeam(
  db: SupabaseClient, businessId: string, stopIds: string[], teamId: string | null,
): Promise<Result<{ assigned: number; teamName: string | null }>> {
  const { data, error } = await db.rpc('assign_stops_team', {
    p_business_id: businessId, p_stop_ids: stopIds, p_team_id: teamId,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (TRACE_TEAMS) console.log('[TRACE:TEAMS] assign failed', { code, message: error.message });
    if (code === 'PGRST202') {
      return { ok: false, code: 'needs_migration', message: 'Teams need the database update (20260921a) — it has not been applied yet.' };
    }
    return { ok: false, code: 'error', message: error.message };
  }
  const d = data as { ok: boolean; code?: string; message?: string; assigned?: number; team_name?: string | null };
  if (TRACE_TEAMS) console.log('[TRACE:TEAMS] assign', { stops: stopIds.length, teamId, ok: d?.ok, code: d?.code });
  if (!d?.ok) return { ok: false, code: d?.code ?? 'error', message: d?.message ?? 'The team was not set.' };
  return { ok: true, value: { assigned: d.assigned ?? 0, teamName: d.team_name ?? null } };
}

export interface VendorChoice { id: string; name: string }

/**
 * The vendors a team can be linked to, for the OPTIONAL contractor link. Names only.
 * 🔴 NO PAY SIDE (David's ruling): this records WHO the team is, never what they are owed.
 * A member who cannot read vendors gets an empty list, and the editor says so rather than
 * showing a picker with nothing in it.
 */
export async function readVendorChoices(db: SupabaseClient, businessId: string): Promise<VendorChoice[]> {
  const { data, error } = await db.from('vendors').select('id, name')
    .eq('business_id', businessId).order('name', { ascending: true });
  if (error) {
    if (TRACE_TEAMS) console.log('[TRACE:TEAMS] vendor choices unreadable', error.message);
    return [];
  }
  return (data ?? []).map((v: Record<string, unknown>) => ({ id: String(v.id), name: String(v.name ?? '') }));
}

/**
 * What Lauren typed in the members box, as a list of names.
 * One name per line is the documented form; commas are accepted because people type those too.
 * A space is NEVER a separator — "Mauro De La Cruz" is one person, not four.
 * Blanks are dropped here so a trailing Enter cannot send a nameless member; the DUPLICATE rule
 * is the writer's, not this function's, because refusing is a decision the database makes.
 */
export function splitMemberNames(text: string): string[] {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

/** What a stop's team is called on screen. A stop with no team says so, never a blank. */
export function teamLabel(teams: Team[], teamId: string | null | undefined): string {
  if (!teamId) return 'No team';
  const t = teams.find(x => x.id === teamId);
  if (!t) return 'A team that is no longer listed';
  return t.active ? t.name : `${t.name} (retired)`;
}
