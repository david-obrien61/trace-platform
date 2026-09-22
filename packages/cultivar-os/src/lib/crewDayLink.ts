// ============================================================
// crewDayLink — the crew day link, both ends (ledger #347)
//
// PURPOSE:      Lauren makes a no-login link for ONE day; the driver opens it on a phone and taps
//               Start / Done / Note per stop. This module is every client call either side makes:
//                 · Lauren (app session): createCrewDayLink · revokeCrewDayLink · readCrewDayLinks ·
//                   readStopEvents (the schedule's "who tapped what, when")
//                 · the crew page (no session): readCrewDay · crewStopAction — both through the ONE
//                   endpoint `/api/crew/day`, token in a header.
//               The rules themselves (token, business, day, expiry, rate limit, what may be shown)
//               live in the database functions of migration 20260917c; nothing here decides them.
// DEPENDENCIES: a Supabase client for Lauren's calls; `fetch` for the crew calls.
// OUTPUTS:      the functions above · crewLinkUrl · tokenFromHash · crewDeviceId ·
//               remembered crew name · stopActivity (what the schedule prints)
// AC-1: no vertical noun. A stop is a stop.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { isDeliveryFulfilled } from './deliveryFulfilment';

const TRACE_CREW = true; // [TRACE:CREW] STD-003 — ON until David owner-proves

const CREW_ENDPOINT = '/api/crew/day';
const CREW_PAGE_PATH = '/crew';

type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

// ── Lauren's side ─────────────────────────────────────────────────────────────────────────────

export interface CrewLinkRow {
  id: string;
  service_date: string;
  /** Which team this link is for (ledger #374). NULL = the whole day, which every link was before. */
  team_id: string | null;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

/** The link URL. The token rides in the FRAGMENT, which the browser never sends to a server. */
export function crewLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${CREW_PAGE_PATH}#${token}`;
}

/**
 * Make a link for one day — for ONE TEAM, or for the whole day when `teamId` is null.
 *
 * 🔴 A TEAM'S LINK SHOWS ONLY THAT TEAM'S STOPS, and the rule is the DATABASE's, not this file's
 *    (`crew_day_stops` filters, `crew_stop_act` REFUSES a stop off the team — 20260923c). Saturday
 *    2026-09-19 is the cost of not having it: one link showed all eight stops to whoever opened it.
 * ⚠️ Reissuing replaces only THIS team's live link. Another team's link keeps working — a crew does
 *    not lose its day because a second crew's link was remade.
 */
export async function createCrewDayLink(
  db: SupabaseClient, businessId: string, serviceDate: string, timeZone: string, teamId: string | null = null,
): Promise<Result<{ linkId: string; token: string; expiresAt: string; replaced: number }>> {
  const { data, error } = await db.rpc('create_crew_day_link', {
    p_business_id: businessId, p_service_date: serviceDate, p_time_zone: timeZone, p_team_id: teamId,
  });
  if (error) return { ok: false, code: 'error', message: error.message };
  const d = data as { ok: boolean; code?: string; message?: string; link_id?: string; token?: string; expires_at?: string; replaced?: number };
  if (TRACE_CREW) console.log('[TRACE:CREW] link create', { serviceDate, ok: d?.ok, code: d?.code, replaced: d?.replaced });
  if (!d?.ok || !d.token || !d.link_id || !d.expires_at) {
    return { ok: false, code: d?.code ?? 'error', message: d?.message ?? 'The link was not made.' };
  }
  return { ok: true, value: { linkId: d.link_id, token: d.token, expiresAt: d.expires_at, replaced: d.replaced ?? 0 } };
}

export async function revokeCrewDayLink(db: SupabaseClient, linkId: string): Promise<Result<{ already: boolean }>> {
  const { data, error } = await db.rpc('revoke_crew_day_link', { p_link_id: linkId });
  if (error) return { ok: false, code: 'error', message: error.message };
  const d = data as { ok: boolean; code?: string; message?: string; already?: boolean };
  if (TRACE_CREW) console.log('[TRACE:CREW] link revoke', { linkId, ok: d?.ok, code: d?.code });
  if (!d?.ok) return { ok: false, code: d?.code ?? 'error', message: d?.message ?? 'The link was not revoked.' };
  return { ok: true, value: { already: !!d.already } };
}

/** The live (not revoked) link for a day, if any. The token is never readable — only its metadata. */
/**
 * Every LIVE link for one day — one per team, plus at most one whole-day link.
 *
 * 🔴 A LIST, NOT `maybeSingle()` (ledger #374). Before teams a day had at most one live link, and
 *    this read used `.maybeSingle()`, which ERRORS (PGRST116) the moment a second row matches. Per-
 *    team links make two rows the NORMAL case, so leaving it would have turned the ordinary
 *    two-crew Saturday into a panel that refuses to load — the exact day this feature is for.
 * ⚠️ Whole-day first, then teams, so the list reads the way the panel renders it.
 */
export async function readCrewDayLinks(
  db: SupabaseClient, businessId: string, serviceDate: string,
): Promise<Result<CrewLinkRow[]>> {
  const { data, error } = await db.from('crew_day_links')
    .select('id, service_date, team_id, expires_at, created_at, revoked_at, last_used_at')
    .eq('business_id', businessId).eq('service_date', serviceDate).is('revoked_at', null)
    .order('team_id', { ascending: true, nullsFirst: true });
  if (error) return { ok: false, code: (error as { code?: string }).code ?? 'error', message: error.message };
  return { ok: true, value: (data as CrewLinkRow[] | null) ?? [] };
}

export interface StopEvent {
  delivery_id: string;
  action: 'start' | 'done' | 'undo_done' | 'note';
  actor_name: string;
  note: string | null;
  occurred_at: string;
}

/**
 * What the crew did at these stops. `absent` = the table is not there yet (20260917c not applied)
 * — said, not shown as "nothing happened".
 */
export async function readStopEvents(
  db: SupabaseClient, businessId: string, stopIds: string[],
): Promise<{ ok: true; byStop: Map<string, StopEvent[]> } | { ok: false; absent: boolean; message: string }> {
  const byStop = new Map<string, StopEvent[]>();
  if (stopIds.length === 0) return { ok: true, byStop };
  const { data, error } = await db.from('delivery_stop_events')
    .select('delivery_id, action, actor_name, note, occurred_at')
    .eq('business_id', businessId).in('delivery_id', stopIds)
    .order('occurred_at', { ascending: true });
  if (error) {
    const code = (error as { code?: string }).code;
    return { ok: false, absent: code === '42P01' || code === 'PGRST205', message: error.message };
  }
  for (const e of (data ?? []) as StopEvent[]) {
    const list = byStop.get(e.delivery_id);
    if (list) list.push(e); else byStop.set(e.delivery_id, [e]);
  }
  return { ok: true, byStop };
}

export interface StopActivity {
  started: { at: string; by: string } | null;
  done: { at: string; by: string } | null;
  notes: { at: string; by: string; note: string }[];
}

/**
 * The schedule's summary: the latest start, the Done still standing (an undo cancels it), every note.
 *
 * 🔴 THE BOX FOLLOWS THE STOP, NOT THE LOG (David, 2026-09-18). `stop` is REQUIRED so no caller can
 *    forget it. The tap log is append-only and keeps every tap forever — which is right — but a tap
 *    whose EFFECT has since been cleared must not be restated as if it stood. Found on LAWNS's real
 *    Saturday: `20260918a` cleared two TEST starts, and the box still read "Started 10:10 · Mauro"
 *    beside a stop that said not started. David: *"a stop reading 'not started' beside a box reading
 *    'Started 10:10 · Mauro' is what Lauren will see Saturday and stop trusting."*
 *    So a **Started** line shows only while the stop IS started, and a **Done** line only while it IS
 *    done. Notes always show — a note has no state to contradict. Relabelling a tap that still stands
 *    (a wrong typed name) is the other half and is filed, not built (tech-debt #344, option B).
 */
export function stopActivity(
  events: StopEvent[],
  stop: { started_at?: string | null; status?: string | null },
): StopActivity {
  let started: StopActivity['started'] = null;
  let done: StopActivity['done'] = null;
  const notes: StopActivity['notes'] = [];
  for (const e of events) {
    if (e.action === 'start') started = { at: e.occurred_at, by: e.actor_name };
    else if (e.action === 'done') done = { at: e.occurred_at, by: e.actor_name };
    else if (e.action === 'undo_done') done = null;
    else if (e.action === 'note' && e.note) notes.push({ at: e.occurred_at, by: e.actor_name, note: e.note });
  }
  if (!stop.started_at) started = null;
  if (!isDeliveryFulfilled(stop.status)) done = null;
  return { started, done, notes };
}

// ── the crew page ─────────────────────────────────────────────────────────────────────────────

export interface CrewLine { item: string; size: string | null; quantity: number | null }
export interface CrewStop {
  id: string;
  /** Place in the day's saved route, 1..N — null when the day was never routed (ledger #351). */
  route_position?: number | null;
  address_line1: string | null; city: string | null; state: string | null; zip: string | null;
  customer_name: string | null; customer_phone: string | null;
  instructions: string | null;
  service_type: string | null;
  status: string | null;
  started_at: string | null; completed_at: string | null; completed_by_name: string | null;
  has_order: boolean;
  lines: CrewLine[];
  notes: { note: string; by: string; at: string }[];
}
export interface CrewDay {
  business_name: string | null; service_date: string; expires_at: string;
  /** Whose day this link shows (ledger #374). `team_id` null = the whole day. A crew who
   *  opened the wrong link can tell from the name, rather than from a short list of stops. */
  team_id?: string | null; team_name?: string | null;
  /** When Lauren routed this day, or null if she has not. The page says which, in plain words. */
  routed_at?: string | null;
  stops: CrewStop[];
}
export type CrewAction = 'start' | 'done' | 'undo_done' | 'note';

/** The token from `location.hash` — `#<64 hex>`. Anything else is not a token. */
export function tokenFromHash(hash: string): string | null {
  const t = hash.replace(/^#/, '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(t) ? t : null;
}

const REFUSAL_TEXT: Record<string, string> = {
  invalid: 'This link does not work. Ask Lauren for today’s link.',
  revoked: 'This link has been turned off. Ask Lauren for today’s link.',
  expired: 'This link has expired. Ask Lauren for today’s link.',
  rate_limited: 'Too many taps in a minute. Wait a moment and try again.',
  not_on_this_day: 'That stop is not on this link’s day.',
  name_required: 'Enter your name first.',
  note_required: 'Type a note first.',
  not_undoable: 'This stop cannot be reopened here.',
  network: 'No connection. Check your signal and try again.',
};
/**
 * What to show for a refusal code. 🔴 THE SERVER'S OWN SENTENCE WINS when it sent one: the writer
 * knows WHICH rule refused ("a review was already asked for this stop" vs "completed before the
 * platform recorded who"), and a fixed client string in its place is a confident wrong answer —
 * exactly what this cost once already (the old `not_undoable` text said "the office marked this
 * stop done" whatever the real reason was). The table below is the fallback for codes the server
 * states as a code alone (an expired or revoked link says nothing else).
 */
export function crewRefusalText(code: string, serverMessage?: string): string {
  return serverMessage ?? REFUSAL_TEXT[code] ?? 'Something went wrong. Try again.';
}
/** Codes that mean the link itself is dead — the page stops and says "ask for a new link". */
export function isDeadLink(code: string): boolean {
  return code === 'invalid' || code === 'revoked' || code === 'expired';
}

async function call<T>(init: RequestInit, token: string): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(CREW_ENDPOINT, { ...init, headers: { ...(init.headers ?? {}), 'x-crew-token': token } });
  } catch {
    return { ok: false, code: 'network', message: crewRefusalText('network') };
  }
  const body = await res.json().catch(() => null) as ({ ok?: boolean; code?: string; message?: string } & T) | null;
  if (!res.ok || !body?.ok) {
    const code = body?.code ?? (res.status === 429 ? 'rate_limited' : 'error');
    return { ok: false, code, message: crewRefusalText(code, body?.message) };
  }
  return { ok: true, value: body as T };
}

export async function readCrewDay(token: string): Promise<Result<CrewDay>> {
  const r = await call<CrewDay>({ method: 'GET' }, token);
  if (TRACE_CREW) console.log('[TRACE:CREW] day read', r.ok ? `${r.value.stops.length} stops` : r.code);
  return r;
}

export async function crewStopAction(
  token: string,
  a: { stopId: string; action: CrewAction; name: string; deviceId: string; note?: string },
): Promise<Result<{ changed: boolean; stop: CrewStop | null }>> {
  const r = await call<{ changed: boolean; stop: CrewStop | null }>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  }, token);
  if (TRACE_CREW) console.log('[TRACE:CREW] action', a.action, a.stopId.slice(0, 8), r.ok ? (r.value.changed ? 'changed' : 'no change') : r.code);
  return r;
}

// ── this device ───────────────────────────────────────────────────────────────────────────────
const NAME_KEY = 'trace.crew.name';
const DEVICE_KEY = 'trace.crew.device';

function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export function rememberedCrewName(): string {
  try { return store()?.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
export function rememberCrewName(name: string): void {
  try { store()?.setItem(NAME_KEY, name.trim()); } catch { /* private window: asked again next time */ }
}
/** A random id for this device, made once and kept. Private windows get a fresh one per visit. */
export function crewDeviceId(): string {
  try {
    const s = store();
    const have = s?.getItem(DEVICE_KEY);
    if (have && have.length >= 8) return have;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    s?.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** A Maps search for the stop's address, or null when there is no address to search. */
export function mapsUrl(s: Pick<CrewStop, 'address_line1' | 'city' | 'state' | 'zip'>): string | null {
  const q = [s.address_line1, s.city, [s.state, s.zip].filter(Boolean).join(' ')].map(x => (x ?? '').trim()).filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
