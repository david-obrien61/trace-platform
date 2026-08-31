/**
 * Positions — THE POSITION LIST AND THE BUSINESS CONTEXT (/admin/positions).
 *
 * PURPOSE:      Where an owner starts. Three things on one scroll: the handful of facts about the
 *               business that every description reuses, the positions they have defined, and the
 *               way to add one. **It creates no role and grants nothing** — a position describes
 *               WORK, and that separation is the entire point of the feature.
 * DEPENDENCIES: positionStore (the ONE reader/writer of the three tables) · useBusinessContext
 *               (`can`, `business`) · RESPONSIBILITY_CATALOGUE for the per-position count.
 * OUTPUTS:      A gated page. Context saves through `savePositionContext`; a new position through
 *               `createPosition`. Every write asserts the row count it wrote (R-12).
 * INSTRUMENTATION (STD-003): [TRACE:POSITIONS] — ON by default (standing owner instruction).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE CONTEXT FORM ASKS FOR THREE THINGS AND THE SUBTRACTION IS THE FEATURE.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * The story named five context fields. Two of them the platform already holds, so asking would be
 * asking an owner to retype what they already told us — which is the exact labour inversion TRACE
 * exists to end, aimed at TRACE:
 *   · DAYS CLOSED     → `business_operating_days` (applied and catalog-verified 2026-08-30). It is
 *                       READ and printed on every description. There is no field for it.
 *   · HOW MANY PEOPLE → counted from `business_members`. Shown back, never asked.
 * Name, address, phone and website are on `businesses` and are likewise not re-asked. What is left
 * is genuinely only ours to ask, and it is three boxes.
 *
 * 🔴 AND THOSE THREE BOXES ARE NOT BLANK EITHER. Where we have read the business's own site, each
 * empty box carries a PROPOSAL with its source shown beside it — and a proposal is never written:
 * "Use this" fills the box, the owner still presses Save, and until then `business_context` holds
 * nothing. So there is no stored guess that could later be mistaken for the owner's own sentence.
 * ⚠️ The proposal is offered only while the field is EMPTY. Once there is a value, the proposal
 * has been used or rejected, and continuing to show it would be arguing with them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, CalendarDays, FileText, AlertCircle, Globe } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '@trace/shared/supabase/client';
import { NotPermitted } from '@trace/shared/components/SurfaceState';
import {
  readPositionWorkspace, savePositionContext, createPosition,
  type PositionWorkspace,
} from '@trace/shared/positions/positionStore';
import { describeOperatingDays } from '@trace/shared/positions/positionDescription';
import { proposedContextFor, type ProposedField } from '@trace/shared/positions/contextProposals';
import { readFailureMessage } from '@trace/shared/utils/readResult';
import { dayTypeMeta } from '../lib/operationsCalendar';

const GREEN = '#27500A';
const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 12,
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6,
};
const INPUT: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '10px 12px', fontSize: '0.9375rem',
  border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box',
};
const BTN: React.CSSProperties = {
  minHeight: 48, padding: '0 18px', background: GREEN, color: '#fff', border: 'none',
  borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
};

/**
 * One proposed value, offered beside an EMPTY field.
 *
 * 🔴 PROPOSED UNTIL CONFIRMED, AND THE PROVENANCE IS SHOWN BESIDE THE VALUE — never underneath a
 * heading somewhere else, never implied. A fact we found is not a fact they have agreed to, and
 * an owner handing this document to a person has to be able to see which sentences they wrote.
 * It renders ONLY while the field is empty: once there is a value in the box the proposal has
 * either been used or been rejected, and continuing to show it would be arguing with them.
 */
function Proposed({ field, onUse, disabled }: {
  field: ProposedField; onUse: (value: string) => void; disabled: boolean;
}) {
  return (
    <div style={{
      marginTop: 8, padding: '10px 12px', background: '#fffdf5',
      border: '1px dashed #e0cfa0', borderRadius: 8,
    }}>
      <p style={{ margin: 0, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a6d1f' }}>
        Proposed — not saved
      </p>
      <p style={{ margin: '6px 0', fontSize: '0.875rem', color: '#374151' }}>{field.value}</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.75rem', color: '#6b7280', flex: 1 }}>
          <Globe size={12} style={{ flexShrink: 0 }} /> Read from {field.source}
        </span>
        {!disabled && (
          <button onClick={() => onUse(field.value)}
            style={{
              minHeight: 40, padding: '0 14px', background: '#fff', color: GREEN,
              border: `1px solid ${GREEN}`, borderRadius: 8, fontSize: '0.8125rem',
              fontWeight: 600, cursor: 'pointer',
            }}>
            Use this
          </button>
        )}
      </div>
    </div>
  );
}

export function Positions() {
  const navigate = useNavigate();
  const { businessId, business, can } = useBusinessContext();
  const mayEdit = can('settings:update');

  const [ws, setWs] = useState<PositionWorkspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ctx, setCtx] = useState({ whatWeDo: '', whoWeServe: '', knownFor: '' });
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const res = await readPositionWorkspace(supabase, businessId);
    // 🔴 R-11: FAILED and EMPTY are different screens. A business with no positions yet must
    // never render identically to one whose read was refused.
    if (!res.ok) { setLoadError(readFailureMessage(res.error)); setWs(null); setLoading(false); return; }
    setLoadError(null);
    setWs(res.value);
    setCtx({
      whatWeDo:   res.value.context?.what_we_do   ?? '',
      whoWeServe: res.value.context?.who_we_serve ?? '',
      knownFor:   res.value.context?.known_for    ?? '',
    });
    console.log('[TRACE:POSITIONS] loaded', {
      positions: res.value.positions.length,
      picks: res.value.responsibilities.length,
      operatingDays: res.value.operatingDays.length,
      members: res.value.memberCount,
      hasContext: res.value.context !== null,
      proposalOffered: proposedContextFor(business?.website) !== null,
    });
    setLoading(false);
  }, [businessId, business?.website]);

  useEffect(() => { void load(); }, [load]);

  // The operating rhythm, read not asked. Labels come from DAY_TYPE_CATALOG — the one place the
  // day types are named — so this page never re-spells them (STD-011).
  const operatingLine = useMemo(() => {
    if (!ws) return null;
    return describeOperatingDays(
      ws.operatingDays
        .map((d) => ({ weekday: d.weekday, dayTypeLabel: dayTypeMeta(d.day_type)?.label ?? d.day_type }))
    );
  }, [ws]);

  // ── ③ "About the business" should not be a blank page either. ──
  // 🔴 A PROPOSAL IS NOT A VALUE. Nothing below is written anywhere until the owner reads it,
  // presses "Use this", and then presses Save — so `business_context` holds nothing at all until
  // they have agreed, and there is no stored guess that could be mistaken for their own words.
  const proposal = useMemo(() => proposedContextFor(business?.website), [business?.website]);

  const pickCount = useCallback(
    (positionId: string) => (ws?.responsibilities ?? []).filter((r) => r.position_id === positionId).length,
    [ws],
  );

  async function handleSaveContext() {
    if (!businessId) return;
    setSaving(true); setNotice(null);
    const trimmed = (s: string) => (s.trim() ? s.trim() : null);
    const out = await savePositionContext(supabase, businessId, {
      whatWeDo: trimmed(ctx.whatWeDo), whoWeServe: trimmed(ctx.whoWeServe), knownFor: trimmed(ctx.knownFor),
    });
    console.log('[TRACE:POSITIONS] save-context', out);
    // 🔴 The refusal is SURFACED, never swallowed. A PostgREST write matching zero rows returns
    // success with no error, so "it looked fine" is exactly the failure mode (R-12).
    setNotice(out.applied ? 'Saved.' : out.reason);
    setSaving(false);
    if (out.applied) await load();
  }

  async function handleCreate() {
    if (!businessId || !newTitle.trim()) return;
    setSaving(true); setNotice(null);
    const { outcome, position } = await createPosition(supabase, businessId, newTitle);
    console.log('[TRACE:POSITIONS] create', { title: newTitle, ...outcome });
    setSaving(false);
    if (!outcome.applied) { setNotice(outcome.reason); return; }
    setNewTitle('');
    if (position) navigate(`/admin/positions/${position.id}`);
  }

  if (!can('settings:read')) {
    return <NotPermitted permission="settings:read" what="position descriptions" />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          Business administration
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Positions</h1>
        <p style={{ fontSize: '0.875rem', color: '#d7e8c8', margin: '6px 0 0' }}>
          Describe what a job is responsible for, then hand the description to the person doing it.
        </p>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
        {notice && (
          <div style={{ ...CARD, background: notice === 'Saved.' ? '#f0f9f0' : '#fef2f2', borderColor: notice === 'Saved.' ? '#bbe0bb' : '#fecaca', display: 'flex', gap: 10 }}>
            {notice !== 'Saved.' && <AlertCircle size={18} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />}
            <span style={{ fontSize: '0.875rem', color: notice === 'Saved.' ? '#166534' : '#991b1b' }}>{notice}</span>
          </div>
        )}

        {loading && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p>}

        {/* A failed read says so. It does not render as an empty list (R-11 / six surface states). */}
        {loadError && (
          <div style={{ ...CARD, background: '#fef2f2', borderColor: '#fecaca' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b' }}>{loadError}</p>
            <button onClick={() => void load()} style={{ ...BTN, marginTop: 12, background: '#991b1b' }}>Try again</button>
          </div>
        )}

        {ws && !loading && (
          <>
            {/* ── What the platform already knows. Shown back, never asked for. ── */}
            <div style={{ ...CARD, background: '#f7faf3', borderColor: '#dbe8cd' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GREEN }}>
                Already on file — you will not be asked for these
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <CalendarDays size={16} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                  {operatingLine ?? 'No weekly pattern recorded yet — set your day types and every description will carry them.'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Users size={16} color={GREEN} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                  {ws.memberCount === 1 ? '1 active person on the team' : `${ws.memberCount} active people on the team`}
                </span>
              </div>
            </div>

            {/* ── The three things only you can tell us. ── */}
            <div style={CARD}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>About the business</h2>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 14px' }}>
                Asked once. Every position description reuses it.
                {proposal && ` We read ${proposal.sourceLabel} and have proposed some of it below — check it, change it, and it is yours.`}
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={LABEL} htmlFor="what-we-do">What the business does</label>
                <textarea id="what-we-do" rows={2} style={INPUT} disabled={!mayEdit}
                  placeholder="grows and sells shade trees on forty acres in Leander"
                  value={ctx.whatWeDo} onChange={(e) => setCtx({ ...ctx, whatWeDo: e.target.value })} />
                {proposal?.whatWeDo && !ctx.whatWeDo.trim() && (
                  <Proposed field={proposal.whatWeDo} disabled={!mayEdit}
                    onUse={(v) => setCtx({ ...ctx, whatWeDo: v })} />
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={LABEL} htmlFor="who-we-serve">Who it sells to</label>
                <input id="who-we-serve" style={INPUT} disabled={!mayEdit}
                  placeholder="landscapers, builders and homeowners"
                  value={ctx.whoWeServe} onChange={(e) => setCtx({ ...ctx, whoWeServe: e.target.value })} />
                {proposal?.whoWeServe && !ctx.whoWeServe.trim() && (
                  <Proposed field={proposal.whoWeServe} disabled={!mayEdit}
                    onUse={(v) => setCtx({ ...ctx, whoWeServe: v })} />
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={LABEL} htmlFor="known-for">What it is known for</label>
                <input id="known-for" style={INPUT} disabled={!mayEdit}
                  placeholder="big trees, dug and delivered the same week"
                  value={ctx.knownFor} onChange={(e) => setCtx({ ...ctx, knownFor: e.target.value })} />
                {proposal?.knownFor && !ctx.knownFor.trim() && (
                  <Proposed field={proposal.knownFor} disabled={!mayEdit}
                    onUse={(v) => setCtx({ ...ctx, knownFor: v })} />
                )}
              </div>
              {mayEdit
                ? <button onClick={() => void handleSaveContext()} disabled={saving} style={BTN}>{saving ? 'Saving…' : 'Save'}</button>
                : <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                    You can read this. Changing it needs the settings permission — ask the account holder.
                  </p>}
            </div>

            {/* ── The positions. ── */}
            <div style={CARD}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px', color: '#111827' }}>
                {ws.positions.length === 0 ? 'No positions yet' : `Positions (${ws.positions.length})`}
              </h2>

              {ws.positions.length === 0 && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 14px' }}>
                  Start with a job you are about to fill. Give it a title, tick what it is responsible
                  for, and you have something to hand over.
                </p>
              )}

              {ws.positions.map((p) => (
                <button key={p.id} onClick={() => navigate(`/admin/positions/${p.id}`)}
                  style={{
                    display: 'flex', width: '100%', minHeight: 48, alignItems: 'center', gap: 12,
                    padding: '12px 14px', marginBottom: 8, background: '#fff', cursor: 'pointer',
                    border: '1px solid #e5e7eb', borderRadius: 8, textAlign: 'left',
                  }}>
                  <FileText size={18} color={GREEN} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{p.title}</span>
                    <span style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280' }}>
                      {pickCount(p.id) === 0
                        ? 'Nothing ticked yet'
                        : `${pickCount(p.id)} ${pickCount(p.id) === 1 ? 'responsibility' : 'responsibilities'}`}
                      {p.excellence_note ? '' : ' · no note on what doing it well looks like'}
                    </span>
                  </span>
                </button>
              ))}

              {mayEdit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <input style={{ ...INPUT, flex: 1 }} placeholder="Operations Manager"
                    value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }} />
                  <button onClick={() => void handleCreate()} disabled={saving || !newTitle.trim()}
                    style={{ ...BTN, opacity: newTitle.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
