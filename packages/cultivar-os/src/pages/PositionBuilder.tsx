/**
 * PositionBuilder — TICK WHAT THE JOB IS RESPONSIBLE FOR (/admin/positions/:positionId).
 *
 * PURPOSE:      The inversion, made into a screen. The owner is never asked which permissions a
 *               person should hold — a question LAWNS could not answer, which is how everyone
 *               there became an owner. They are asked what the person DOES, which every owner can
 *               answer. Responsibilities grouped by area, each with a frequency they can change.
 * DEPENDENCIES: RESPONSIBILITY_CATALOGUE + marksFor (the derived marks) · verticalsForBusinessType
 *               (the gating axis) · positionStore (the one writer) · useBusinessContext.
 * OUTPUTS:      Saved picks + the position's title and its "what doing this well looks like" note.
 * INSTRUMENTATION (STD-003): [TRACE:POSITIONS] — ON by default (standing owner instruction).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE THREE MARKS ARE IN CONSEQUENCES AND NEVER IN PERMISSION STRINGS.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "This lets them see what people are paid" — not `wages:read`. That is the story's requirement
 * and it is the whole reason the feature works: the moment a permission string appears on this
 * screen it has become the harder question again. `responsibilityMarks.ts` derives all three from
 * `permissionManifest.ts` (so there is no second list to drift), and `positions.test.ts` C8
 * asserts over EVERY row that no mark text contains a `resource:verb` shape.
 *
 * 🔴 A "NO CAPABILITY YET" ROW IS TICKABLE, AND THAT IS DELIBERATE. The description says what the
 * JOB is, not what the app covers. Eighteen rows are in that state today and it is expected —
 * refusing the tick would make the document describe the software instead of the work.
 *
 * ⚠️ GATING IS BY VERTICAL, NOT BY MODULE (David's ruling ①, 2026-08-31). A tenant that is not a
 * nursery never sees "uppot a lot". It is NOT gated on a paid module: there is no `grow_ladder`
 * module_key to point at, and a nursery should see the growing work whether or not they have
 * bought the tile — the job exists whether or not the software covers it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, Wrench, Printer, Trash2, AlertCircle } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '@trace/shared/supabase/client';
import { NotPermitted } from '@trace/shared/components/SurfaceState';
import {
  readPositionWorkspace, updatePosition, deletePosition, setPositionResponsibilities,
  type PositionRow,
} from '@trace/shared/positions/positionStore';
import {
  RESPONSIBILITY_CATALOGUE, FREQUENCY_ORDER, FREQUENCY_LABEL,
  type ResponsibilityFrequency,
} from '@trace/shared/positions/responsibilityCatalogue';
import { marksFor } from '@trace/shared/positions/responsibilityMarks';
import { readFailureMessage } from '@trace/shared/utils/readResult';
import { verticalsForBusinessType } from '../registry/tileRegistry';

const GREEN = '#27500A';
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 12 };
const BTN: React.CSSProperties = { minHeight: 48, padding: '0 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' };
const INPUT: React.CSSProperties = { width: '100%', minHeight: 48, padding: '10px 12px', fontSize: '0.9375rem', border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' };

interface Pick { frequency: ResponsibilityFrequency | null }

export function PositionBuilder() {
  const { positionId } = useParams<{ positionId: string }>();
  const navigate = useNavigate();
  const { businessId, business, can } = useBusinessContext();
  const mayEdit = can('settings:update');

  const [position, setPosition] = useState<PositionRow | null>(null);
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [title, setTitle] = useState('');
  const [excellence, setExcellence] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // How many pick rows this screen LOADED. The clear-and-reinsert asserts exactly this count, so
  // an RLS-refused delete cannot report success (see setPositionResponsibilities).
  const [loadedPickCount, setLoadedPickCount] = useState(0);

  // The rows this business can even see. `verticalsForBusinessType` is the axis that already
  // exists — one resolution, reused, rather than a second notion of "which vertical is this".
  const visible = useMemo(() => {
    const verticals = verticalsForBusinessType(business?.business_type ?? null);
    return RESPONSIBILITY_CATALOGUE.filter((r) => r.vertical === null || verticals.includes(r.vertical as never));
  }, [business?.business_type]);

  const areas = useMemo(() => [...new Set(visible.map((r) => r.area))], [visible]);

  const load = useCallback(async () => {
    if (!businessId || !positionId) return;
    setLoading(true);
    const res = await readPositionWorkspace(supabase, businessId);
    if (!res.ok) { setLoadError(readFailureMessage(res.error)); setLoading(false); return; }
    const p = res.value.positions.find((x) => x.id === positionId) ?? null;
    setLoadError(p ? null : 'That position no longer exists.');
    setPosition(p);
    setTitle(p?.title ?? '');
    setExcellence(p?.excellence_note ?? '');
    const mine = res.value.responsibilities.filter((r) => r.position_id === positionId);
    setLoadedPickCount(mine.length);
    setPicks(new Map(
      mine.map((r) => [r.responsibility_id, { frequency: (r.frequency as ResponsibilityFrequency | null) ?? null }]),
    ));
    console.log('[TRACE:POSITIONS] builder-loaded', { positionId, found: !!p, visibleRows: visible.length });
    setLoading(false);
  }, [businessId, positionId, visible.length]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    if (!mayEdit) return;
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, { frequency: null });
      return next;
    });
  }

  function setFrequency(id: string, freq: ResponsibilityFrequency, fallback: ResponsibilityFrequency) {
    // 🔴 Storing NULL when the owner picks the catalogue default is not a micro-optimisation: a
    // stored copy becomes a SECOND TRUTH the day the default is corrected (R-27). Only a genuine
    // override is kept.
    setPicks((prev) => new Map(prev).set(id, { frequency: freq === fallback ? null : freq }));
  }

  async function handleSave() {
    if (!businessId || !positionId) return;
    setSaving(true); setNotice(null);

    const meta = await updatePosition(supabase, positionId, {
      title, excellenceNote: excellence.trim() ? excellence.trim() : null,
    });
    if (!meta.applied) { setNotice(meta.reason); setSaving(false); console.log('[TRACE:POSITIONS] save-refused', meta); return; }

    const out = await setPositionResponsibilities(supabase, businessId, positionId,
      [...picks.entries()].map(([responsibilityId, p]) => ({ responsibilityId, frequency: p.frequency })),
      loadedPickCount);
    console.log('[TRACE:POSITIONS] save', { positionId, picks: picks.size, ...out });
    setNotice(out.applied ? 'Saved.' : out.reason);
    setSaving(false);
    if (out.applied) await load();
  }

  async function handleDelete() {
    if (!positionId || !window.confirm('Delete this position and everything ticked on it?')) return;
    const out = await deletePosition(supabase, positionId);
    console.log('[TRACE:POSITIONS] delete', out);
    if (out.applied) navigate('/admin/positions'); else setNotice(out.reason);
  }

  if (!can('settings:read')) return <NotPermitted permission="settings:read" what="position descriptions" />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <button onClick={() => navigate('/admin/positions')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#d7e8c8', fontSize: '0.8125rem', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
          <ArrowLeft size={14} /> Positions
        </button>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>{position?.title ?? 'Position'}</h1>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 760, margin: '0 auto' }}>
        {notice && (
          <div style={{ ...CARD, background: notice === 'Saved.' ? '#f0f9f0' : '#fef2f2', borderColor: notice === 'Saved.' ? '#bbe0bb' : '#fecaca', display: 'flex', gap: 10 }}>
            {notice !== 'Saved.' && <AlertCircle size={18} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />}
            <span style={{ fontSize: '0.875rem', color: notice === 'Saved.' ? '#166534' : '#991b1b' }}>{notice}</span>
          </div>
        )}
        {loading && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p>}
        {loadError && <div style={{ ...CARD, background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b' }}>{loadError}</p></div>}

        {position && !loading && (
          <>
            <div style={CARD}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }} htmlFor="pos-title">Title</label>
              <input id="pos-title" style={INPUT} value={title} disabled={!mayEdit} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {/* ── The ticks. ── */}
            {areas.map((area) => {
              const rows = visible.filter((r) => r.area === area);
              const chosen = rows.filter((r) => picks.has(r.id)).length;
              return (
                <div key={area} style={CARD}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px', color: '#111827' }}>{area}</h2>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 12px' }}>
                    {chosen === 0 ? 'Nothing ticked' : `${chosen} of ${rows.length} ticked`}
                  </p>
                  {rows.map((r) => {
                    const on = picks.has(r.id);
                    const marks = marksFor(r);
                    const current = picks.get(r.id)?.frequency ?? r.defaultFrequency;
                    return (
                      <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid #f3f4f6' }}>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: mayEdit ? 'pointer' : 'default', minHeight: 48 }}>
                          <input type="checkbox" checked={on} disabled={!mayEdit} onChange={() => toggle(r.id)}
                            style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: GREEN }} />
                          <span style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: '0.9375rem', color: '#111827' }}>{r.text}</span>

                            {/* 🔴 The three marks. Consequences, never permission strings. */}
                            {marks.sensitive && (
                              <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 5, fontSize: '0.8125rem', color: '#92400e' }}>
                                <Eye size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span><strong>Sensitive.</strong> {marks.sensitive}</span>
                              </span>
                            )}
                            {!marks.delegable && (
                              <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 5, fontSize: '0.8125rem', color: '#991b1b' }}>
                                <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span><strong>Cannot be delegated.</strong> {marks.delegableReason}</span>
                              </span>
                            )}
                            {marks.capabilityNote && (
                              <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 5, fontSize: '0.8125rem', color: '#6b7280' }}>
                                <Wrench size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{marks.capabilityNote} Tick it anyway — the description says what the job is.</span>
                              </span>
                            )}

                            {on && (
                              <span style={{ display: 'block', marginTop: 8 }}>
                                <select value={current} disabled={!mayEdit}
                                  onChange={(e) => setFrequency(r.id, e.target.value as ResponsibilityFrequency, r.defaultFrequency)}
                                  style={{ minHeight: 40, padding: '6px 10px', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
                                  {FREQUENCY_ORDER.map((f) => (
                                    <option key={f} value={f}>
                                      {FREQUENCY_LABEL[f]}{f === r.defaultFrequency ? ' (usual)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </span>
                            )}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── The one field that carries more weight than the rest. ── */}
            <div style={{ ...CARD, borderColor: '#dbe8cd', background: '#f7faf3' }}>
              <label style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: 4 }} htmlFor="pos-note">
                What doing this well looks like here
              </label>
              <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: '0 0 10px' }}>
                In your words. It is printed on the description exactly as you write it, and it is
                the part that makes the page sound like your business rather than a form.
              </p>
              <textarea id="pos-note" rows={3} style={INPUT} disabled={!mayEdit}
                placeholder="Nothing leaves the yard he has not looked at himself."
                value={excellence} onChange={(e) => setExcellence(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
              {mayEdit && <button onClick={() => void handleSave()} disabled={saving} style={BTN}>{saving ? 'Saving…' : 'Save'}</button>}
              <button onClick={() => navigate(`/admin/positions/${positionId}/description`)}
                style={{ ...BTN, background: '#fff', color: GREEN, border: `1px solid ${GREEN}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Printer size={16} /> View the description
              </button>
              {mayEdit && (
                <button onClick={() => void handleDelete()}
                  style={{ ...BTN, background: '#fff', color: '#991b1b', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
