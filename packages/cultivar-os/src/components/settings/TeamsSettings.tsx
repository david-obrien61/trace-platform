// ============================================================
// TeamsSettings — Settings → Teams. Who goes out, and who is on each crew (ledger #362, piece 1).
//
// PURPOSE:      LAWNS runs Team 1, Team 2 and Team 3 and the platform could not see them; Saturday
//               2026-09-19 is the measured cost (tech-debt #345). This is the ONE place Lauren
//               edits that list. Every write goes through `saveTeam` → `save_team`, which checks
//               `deliveries:update` server-side (§6 r21 / R-159).
// DEPENDENCIES: ../../lib/teams · ../../lib/supabase.
// OUTPUTS:      the team list, an editor for one team, and Retire / Bring back.
//
// 🔴 THIS IS NOT THE "TEAM" SECTION ABOVE IT, AND THE COPY SAYS SO. The other one is LOGINS —
//    people with an account and a role. These are the crews who go out, recorded as NAMES, because
//    a 1099 crew comes and goes and needing a login for each is exactly why the crew link has none.
// 🔴 RETIRE, NEVER DELETE (R-133). A retired team leaves the pickers; the stops that already carry
//    it keep reading it, so last Saturday still says who did it.
// E2/E3: one team is the unit of work — the editor buffers and commits on ONE Save, because a team
//    with its name changed and its people half-written is the state that rule exists to prevent.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { readTeams, saveTeam, retireTeam, readVendorChoices, splitMemberNames, type Team, type VendorChoice } from '../../lib/teams';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';

interface Props { businessId: string; canWrite: boolean }

interface Draft { id: string | null; name: string; members: string; vendorId: string | null }
const BLANK: Draft = { id: null, name: '', members: '', vendorId: null };

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.9375rem', boxSizing: 'border-box',
};

export default function TeamsSettings({ businessId, canWrite }: Props) {
  const [teams, setTeams]     = useState<Team[] | null>(null);
  const [absent, setAbsent]   = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [draft, setDraft]     = useState<Draft | null>(null);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState('');
  const [msgBad, setMsgBad]   = useState(false);
  const [vendors, setVendors] = useState<VendorChoice[]>([]);

  const load = useCallback(async () => {
    const r = await readTeams(supabase, businessId);
    if (r.ok) { setTeams(r.teams); setAbsent(false); setLoadErr(''); }
    else { setTeams(null); setAbsent(r.absent); setLoadErr(r.message); }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);
  // The contractor link is OPTIONAL, so an unreadable or empty vendor list is not an error —
  // the form simply does not offer a link it cannot fill.
  useEffect(() => { void readVendorChoices(supabase, businessId).then(setVendors); }, [businessId]);

  function say(text: string, bad: boolean) { setMsg(text); setMsgBad(bad); }

  async function commit() {
    if (!draft) return;
    const names = splitMemberNames(draft.members);
    setBusy(true); say('', false);
    const r = await saveTeam(supabase, businessId, {
      id: draft.id, name: draft.name, active: true, vendorId: draft.vendorId, memberNames: names,
    });
    setBusy(false);
    if (!r.ok) { say(r.message, true); return; }
    setDraft(null);
    say(`${r.value.name} saved — ${r.value.members} ${r.value.members === 1 ? 'person' : 'people'}.`, false);
    await load();
  }

  async function setActive(team: Team, active: boolean) {
    setBusy(true); say('', false);
    const r = active
      ? await saveTeam(supabase, businessId, {
          id: team.id, name: team.name, active: true, vendorId: team.vendor_id,
          memberNames: team.members.map(m => m.name),
        })
      : await retireTeam(supabase, businessId, team);
    setBusy(false);
    if (!r.ok) { say(r.message, true); return; }
    say(active ? `${team.name} is back on the list.` : `${team.name} retired — the stops it already has keep it.`, false);
    await load();
  }

  const live    = (teams ?? []).filter(t => t.active);
  const retired = (teams ?? []).filter(t => !t.active);

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        Teams
      </p>
      <p style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 0, marginBottom: 14 }}>
        The crews who go out. Members are names — they do not need a login. This is not the same as
        the people with accounts above.
      </p>

      {/* ABSENT is not EMPTY (A9): the tables missing and the list being empty are different facts. */}
      {absent && (
        <p style={{ fontSize: '0.875rem', color: RED, margin: '0 0 12px' }}>
          Teams need the database update (20260921a). It has not been applied yet, so there is no list to show.
        </p>
      )}
      {!absent && loadErr && (
        <p style={{ fontSize: '0.875rem', color: RED, margin: '0 0 12px' }}>Could not read the teams: {loadErr}</p>
      )}
      {teams === null && !absent && !loadErr && (
        <p style={{ fontSize: '0.875rem', color: GRAY, margin: '0 0 12px' }}>Reading the teams…</p>
      )}
      {teams !== null && live.length === 0 && retired.length === 0 && (
        <p style={{ fontSize: '0.875rem', color: GRAY, margin: '0 0 12px' }}>
          No teams yet. Add the crews you send out — Team 1, Team 2, a contractor by name.
        </p>
      )}

      {live.map(team => (
        <div key={team.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 12px', marginBottom: 10 }}>
          {draft?.id === team.id ? (
            <TeamForm draft={draft} setDraft={setDraft} onSave={() => { void commit(); }} busy={busy} vendors={vendors} />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{team.name}</span>
                <span style={{ fontSize: '0.75rem', color: GRAY }}>
                  {team.members.length === 0 ? 'nobody on it yet' : `${team.members.length} ${team.members.length === 1 ? 'person' : 'people'}`}
                </span>
              </div>
              {team.members.length > 0 && (
                <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '4px 0 0' }}>
                  {team.members.map(m => m.name).join(' · ')}
                </p>
              )}
              {canWrite && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => setDraft({ id: team.id, name: team.name, members: team.members.map(m => m.name).join('\n'), vendorId: team.vendor_id })}
                    style={{ flex: 1, minHeight: 48, borderRadius: 8, border: `1px solid ${GREEN}`, background: '#fff', color: GREEN, fontWeight: 700, cursor: 'pointer' }}
                  >Edit</button>
                  <button
                    onClick={() => void setActive(team, false)}
                    disabled={busy}
                    style={{ minHeight: 48, padding: '0 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: GRAY, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
                  >Retire</button>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {canWrite && !absent && !draft && (
        <button
          onClick={() => setDraft({ ...BLANK })}
          style={{ width: '100%', minHeight: 48, borderRadius: 10, border: `1px dashed ${GREEN}`, background: '#fff', color: GREEN, fontWeight: 700, cursor: 'pointer' }}
        >Add a team</button>
      )}
      {draft && draft.id == null && (
        <div style={{ border: `1px solid ${GREEN}`, borderRadius: 10, padding: '12px 12px', marginTop: 4 }}>
          <TeamForm draft={draft} setDraft={setDraft} onSave={() => { void commit(); }} busy={busy} vendors={vendors} />
        </div>
      )}

      {retired.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Retired
          </p>
          {retired.map(team => (
            <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: '0.875rem', color: GRAY }}>
                {team.name}{team.members.length > 0 ? ` · ${team.members.map(m => m.name).join(' · ')}` : ''}
              </span>
              {canWrite && (
                <button
                  onClick={() => void setActive(team, true)}
                  disabled={busy}
                  style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: GREEN, fontWeight: 700, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                >Bring back</button>
              )}
            </div>
          ))}
          <p style={{ fontSize: '0.75rem', color: GRAY, marginTop: 6 }}>
            A retired team stays on the stops it already has, so last Saturday still says who did it.
          </p>
        </div>
      )}

      {msg && (
        <p style={{ fontSize: '0.875rem', color: msgBad ? RED : GREEN, marginTop: 10, textAlign: 'center' }}>{msg}</p>
      )}
    </div>
  );
}

function TeamForm({ draft, setDraft, onSave, busy, vendors }: {
  draft: Draft; setDraft: (d: Draft | null) => void; onSave: () => void; busy: boolean;
  vendors: VendorChoice[];
}) {
  const count = splitMemberNames(draft.members).length;
  return (
    <>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Team name
      </label>
      <input
        value={draft.name}
        onChange={e => setDraft({ ...draft, name: e.target.value })}
        placeholder="Team 1"
        style={{ ...inputStyle, marginTop: 4, marginBottom: 12 }}
      />
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Who is on it — one name per line
      </label>
      <textarea
        value={draft.members}
        onChange={e => setDraft({ ...draft, members: e.target.value })}
        placeholder={'Mauro\nJose'}
        rows={4}
        style={{ ...inputStyle, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <p style={{ fontSize: '0.75rem', color: GRAY, margin: '4px 0 12px' }}>
        Names, not logins — {count === 0 ? 'nobody yet' : `${count} ${count === 1 ? 'person' : 'people'}`}.
      </p>
      {vendors.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            A contractor? (optional)
          </label>
          <select
            value={draft.vendorId ?? ''}
            onChange={e => setDraft({ ...draft, vendorId: e.target.value || null })}
            style={{ ...inputStyle, marginTop: 4 }}
          >
            <option value="">In-house crew</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <p style={{ fontSize: '0.75rem', color: GRAY, margin: '4px 0 0' }}>
            Links the team to a vendor record so you know who they are. It does not touch pay.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={busy}
          style={{ flex: 1, minHeight: 48, borderRadius: 8, border: 'none', background: busy ? '#e5e7eb' : GREEN, color: busy ? GRAY : '#fff', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
        >{busy ? 'Saving…' : 'Save team'}</button>
        <button
          onClick={() => setDraft(null)}
          disabled={busy}
          style={{ minHeight: 48, padding: '0 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: GRAY, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
        >Cancel</button>
      </div>
    </>
  );
}
