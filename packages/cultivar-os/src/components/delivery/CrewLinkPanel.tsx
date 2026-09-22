/**
 * ── CrewLinkPanel — make, share and turn off a day's crew link (ledger #347) ──────────────────
 *
 * PURPOSE      On the delivery schedule, under a day's header: Lauren makes a no-login link for THAT
 *              day, copies or shares it into her text to the driver, and can turn it off or make a
 *              new one (which turns the old one off). The link is shown ONCE, right after it is
 *              made — only a hash is stored, so it cannot be shown again; "Make a new link" is the
 *              way to get another.
 *              Standard named (§6 r16): the "share link" pattern (Google Docs / Dropbox) — a
 *              revocable bearer link with Copy + native Share. Deviation: the link cannot be
 *              re-copied later, because the token is not stored.
 * DEPENDENCIES ../../lib/crewDayLink (createCrewDayLink · revokeCrewDayLink · readCrewDayLinks ·
 *              crewLinkUrl) · the app Supabase client. Rendered only for `deliveries:update`; the
 *              database functions check the same permission themselves (§1.6 item 4).
 * OUTPUTS      <CrewLinkPanel businessId date />
 */
import { useEffect, useState } from 'react';
import { Link2, Copy, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { readTeams, type Team } from '../../lib/teams';
import {
  createCrewDayLink, revokeCrewDayLink, readCrewDayLinks, crewLinkUrl, type CrewLinkRow,
} from '../../lib/crewDayLink';

const GREEN = '#27500A';
const GRAY = '#6b7280';
const RED = '#A32D2D';

const btn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48,
  padding: '10px 14px', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
} as const;
const primary = { ...btn, background: GREEN, color: '#fff', border: 'none' } as const;
const secondary = { ...btn, background: '#fff', color: GREEN, border: `1.5px solid ${GREEN}` } as const;

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });

function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
}

export function CrewLinkPanel({ businessId, date }: { businessId: string; date: string }) {
  // 🔴 MANY LINKS PER DAY NOW (ledger #374) — one per team, plus at most one whole-day link.
  const [links, setLinks] = useState<CrewLinkRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ url: string; replaced: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [absent, setAbsent] = useState(false);

  async function load() {
    setLoading(true);
    const r = await readCrewDayLinks(supabase, businessId, date);
    setLoading(false);
    if (!r.ok) {
      if (r.code === '42P01' || r.code === 'PGRST205') { setAbsent(true); return; }
      setError(r.message);
      return;
    }
    setLinks(r.value);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, date]);
  useEffect(() => {
    void readTeams(supabase, businessId).then(r => { if (r.ok) setTeams(r.teams); });
  }, [businessId]);

  // 🔴 ONE LINK PER TEAM (ledger #374, teams piece 3). `teamId` null = the whole day, which is what
  // every link was and what a nursery that does not split its days keeps getting.
  async function make(teamId: string | null = null) {
    setBusy(true); setError(null); setCopied(false);
    const r = await createCrewDayLink(supabase, businessId, date, deviceTimeZone(), teamId);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setFresh({ url: crewLinkUrl(window.location.origin, r.value.token), replaced: r.value.replaced });
    await load();
  }

  async function turnOff(linkId: string) {
    setBusy(true); setError(null);
    const r = await revokeCrewDayLink(supabase, linkId);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setFresh(null);
    await load();
  }

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setError('Copy did not work on this device — press and hold the link to copy it.'); }
  }
  async function share(url: string) {
    try { await navigator.share({ title: 'Stops for the day', text: 'Today’s stops:', url }); }
    catch { /* the person closed the share sheet */ }
  }

  if (absent) {
    return <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: GRAY }}>Crew links aren’t available yet — the database update (20260917c) hasn’t been applied.</p>;
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #cfe3b6', borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.875rem', color: GREEN }}>
        <Link2 size={16} /> Crew link for this day
      </div>
      <p style={{ margin: '4px 0 10px', fontSize: '0.75rem', color: GRAY, lineHeight: 1.45 }}>
        The driver opens it on their phone — no login. It shows this day’s stops, addresses and what’s on each order (no prices), and lets them tap Start, Done and add a note. It stops working at 6:00 AM the next day.
      </p>

      {loading && <p style={{ margin: 0, fontSize: '0.8125rem', color: GRAY }}>Loading…</p>}
      {error && <p role="alert" style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: RED }}>{error}</p>}

      {fresh && (
        <div style={{ background: '#EAF3DE', borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: GREEN, marginBottom: 4 }}>
            New link — copy it now; it can’t be shown again.{fresh.replaced > 0 ? ' The old link no longer works.' : ''}
          </div>
          <input readOnly value={fresh.url} onFocus={e => e.currentTarget.select()} aria-label="Crew link"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { void copy(fresh.url); }} style={primary}><Copy size={15} /> {copied ? 'Copied' : 'Copy link'}</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button onClick={() => { void share(fresh.url); }} style={secondary}><Share2 size={15} /> Share…</button>
            )}
          </div>
        </div>
      )}

      {/* 🔴 ONE ROW PER TEAM (ledger #374, teams piece 3 — David, 2026-09-21). Saturday 2026-09-19
          one link showed ALL EIGHT stops to whoever opened it. Each team now gets its own link
          showing only its own stops, and the DATABASE enforces that — `crew_day_stops` filters and
          `crew_stop_act` REFUSES a stop off the team (20260923c), so hiding is not the whole of it.
          ⚠️ A nursery with NO teams sees exactly one row, "The whole day", as it always did. */}
      {!loading && (
        <div style={{ display: 'grid', gap: 8 }}>
          {[{ id: null as string | null, name: 'The whole day' },
            ...teams.filter(t => t.active).map(t => ({ id: t.id as string | null, name: t.name }))]
            .map(row => {
              const link = links.find(l => (l.team_id ?? null) === row.id) ?? null;
              return (
                <div key={row.id ?? 'whole-day'} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: GREEN }}>{row.name}</div>
                  <div style={{ fontSize: '0.75rem', color: link ? '#111827' : GRAY, margin: '2px 0 8px' }}>
                    {link
                      ? <>Link is on · made {when(link.created_at)} · works until {when(link.expires_at)}
                          {link.last_used_at ? ` · last opened ${when(link.last_used_at)}` : ' · not opened yet'}</>
                      : 'No link yet.'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => { void make(row.id); }} disabled={busy}
                      style={{ ...(link ? secondary : primary), opacity: busy ? 0.6 : 1 }}>
                      {busy ? 'Working…' : link ? 'Make a new link' : 'Make link'}
                    </button>
                    {link && (
                      <button onClick={() => { void turnOff(link.id); }} disabled={busy}
                        style={{ ...btn, background: '#fff', color: RED, border: `1.5px solid ${RED}`, opacity: busy ? 0.6 : 1 }}>
                        Turn off
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          {/* A RETIRED team keeps any link it already holds ([[R-133]]) — it is simply not offered a new one. */}
          {links.some(l => l.team_id && !teams.some(t => t.id === l.team_id && t.active)) ? (
            <p style={{ margin: 0, fontSize: '0.75rem', color: GRAY }}>
              A link above belongs to a team that is retired or no longer listed. It keeps working until it expires — turn it off if that crew is not going out.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
