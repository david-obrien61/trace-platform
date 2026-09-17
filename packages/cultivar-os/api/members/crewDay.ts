/**
 * ── crewDay — the crew day link's endpoint (ledger #347) ─────────────────────────────────────────
 *
 * PURPOSE:      The install crew have no logins. Lauren makes a link for ONE day; the driver opens it
 *               and sees that day's stops, and taps Start / Done / Note. This handler is the only way
 *               in: it hashes the caller's IP into a rate-limit key and passes the token to two
 *               database functions (`crew_day_read`, `crew_stop_act`, migration 20260917c) that check
 *               the token, the business and the day themselves. The handler cannot widen what a token
 *               sees — it has no query of its own.
 *               Rides `api/members/invite.ts` (the other no-login token endpoint): no new function,
 *               12/12 held (§6 r11). Reached as `/api/crew/day` (vercel.json rewrite).
 * DEPENDENCIES: a service-key Supabase client (EXECUTE on the two functions is granted to
 *               service_role only).
 * OUTPUTS:      GET  ?_route=crew-day  (token in the `x-crew-token` header)  → the day
 *               POST ?_route=crew-day  { action: start|done|undo_done|note, stopId, name, deviceId, note }
 *               Status: 200 ok · 400 bad input · 404 unknown token / stop not on this day ·
 *               410 expired or revoked · 429 rate limited. `Cache-Control: no-store` always.
 *
 * The token travels in a HEADER, never the URL: the page keeps it in the URL fragment, which the
 * browser never sends, so it stays out of server logs and Referer headers.
 */
import { createHash } from 'node:crypto';

const TRACE_CREW = true; // [TRACE:CREW] STD-003 — ON until David owner-proves

type Rpc = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const STATUS_FOR: Record<string, number> = {
  invalid: 404, not_on_this_day: 404,
  revoked: 410, expired: 410,
  rate_limited: 429,
  bad_action: 400, name_required: 400, device_required: 400, note_required: 400, not_undoable: 409,
};

const ACTIONS = new Set(['start', 'done', 'undo_done', 'note']);

function header(req: any, name: string): string {
  const v = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
}

/** The caller's rate-limit key: a hash of the first forwarded IP. The IP itself is never stored. */
export function clientKey(req: any): string {
  const ip = header(req, 'x-forwarded-for').split(',')[0].trim() || header(req, 'x-real-ip').trim()
    || String(req.socket?.remoteAddress ?? '');
  return createHash('sha256').update(`crew:${ip || 'unknown'}`).digest('hex').slice(0, 32);
}

export async function handleCrewDay(req: any, res: any, db: Rpc) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const token = header(req, 'x-crew-token').trim();
  const key = clientKey(req);

  let out: { data: unknown; error: { message: string } | null };
  if (req.method === 'GET') {
    out = await db.rpc('crew_day_read', { p_token: token, p_client_key: key });
  } else if (req.method === 'POST') {
    const b = req.body ?? {};
    if (!ACTIONS.has(b.action) || typeof b.stopId !== 'string') {
      return res.status(400).json({ ok: false, code: 'bad_action' });
    }
    out = await db.rpc('crew_stop_act', {
      p_token: token, p_client_key: key, p_stop_id: b.stopId, p_action: b.action,
      p_actor_name: typeof b.name === 'string' ? b.name : null,
      p_device_id: typeof b.deviceId === 'string' ? b.deviceId : null,
      p_note: typeof b.note === 'string' ? b.note : null,
    });
  } else {
    return res.status(405).end();
  }

  if (out.error) {
    // A malformed stop id arrives here as a cast error; it is the same answer as a stop on no day.
    const invalidInput = /invalid input syntax/i.test(out.error.message);
    if (TRACE_CREW) console.log('[TRACE:CREW] rpc error', { method: req.method, message: out.error.message });
    return invalidInput
      ? res.status(404).json({ ok: false, code: 'not_on_this_day' })
      : res.status(500).json({ ok: false, code: 'server_error' });
  }
  const body = (out.data ?? { ok: false, code: 'server_error' }) as { ok: boolean; code?: string; stops?: unknown[]; changed?: boolean };
  if (TRACE_CREW) console.log('[TRACE:CREW]', req.method, req.body?.action ?? 'read', body.ok ? 'ok' : body.code,
    body.stops ? `${body.stops.length} stops` : '', body.changed === false ? '(no change)' : '');
  if (!body.ok) {
    const status = STATUS_FOR[body.code ?? ''] ?? 500;
    if (status === 429) res.setHeader('Retry-After', '60');
    return res.status(status).json(body);
  }
  return res.status(200).json(body);
}
