/**
 * PositionBuilder — TICK WHAT THE JOB IS RESPONSIBLE FOR (/admin/positions/:positionId).
 *
 * PURPOSE:      The inversion, made into a screen. The owner is never asked which permissions a
 *               person should hold — a question LAWNS could not answer, which is how everyone
 *               there became an owner. They are asked what the person DOES, which every owner can
 *               answer. Responsibilities grouped by area, each with a frequency they can change.
 * DEPENDENCIES: RESPONSIBILITY_CATALOGUE + marksFor (the derived marks) · POSITION_STARTING_POINTS
 *               (the sets) · verticalsForBusinessType (the gating axis) · positionStore (the one
 *               writer) · useBusinessContext.
 * OUTPUTS:      Saved picks + the position's title and its "what doing this well looks like" note.
 * INSTRUMENTATION (STD-003): [TRACE:POSITIONS] — ON by default (standing owner instruction).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 NEVER SHOW A BLANK PAGE. THE FIRST RUN PROVED THE FLOW, NOT THE RENDERING, WAS WRONG.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * David created "Production Manager", met 93 rows with nothing pre-selected, ticked nothing, and
 * got a document reading *"Nothing has been ticked for this position yet · 0 responsibilities."*
 * The document was TRUTHFUL AND USELESS — and that is not a defect in the printing, it is the
 * flow making it easy to arrive there. **A list of 93 with nothing selected is a blank form, and
 * the whole feature exists because blank forms do not get filled in.** So:
 *   ① a starting point is OFFERED before the list, and pre-ticks its set;
 *   ② the ten areas are COLLAPSED with a per-area tick count, and only the areas the starting
 *      point touched are opened;
 *   ③ the running total is on screen at all times, beside Save.
 *
 * 🔴 THE CHOOSER SHOWS ONLY WHILE NOTHING IS TICKED, AND THAT IS A SAFETY PROPERTY. Applying a
 * set REPLACES the ticks; offering that beside 30 existing ticks would put an owner one tap from
 * discarding their work, and no confirm dialog makes a destructive default good. While the map is
 * empty there is nothing to destroy, which is exactly the blank-page moment the chooser is for.
 *
 * 🔴 COLLAPSED IS NOT FILTERED. Every unticked row stays reachable, because part of the value is
 * an owner reading a responsibility and realising NOBODY does it. Hiding the unticked ones would
 * turn a business's blind spot into a screen it never scrolls to.
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
import {
  ArrowLeft, Lock, Eye, Wrench, Printer, Trash2, AlertCircle, ChevronDown, ChevronRight, Sparkles,
} from 'lucide-react';
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
import {
  POSITION_STARTING_POINTS, startingPointIds, type PositionStartingPoint,
} from '@trace/shared/positions/positionStartingPoints';
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
  // Which of the ten areas are expanded. Collapsed by default; opened by a starting point, by the
  // ticks a saved position already has, or by the owner.
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());
  // "Start blank" is a CHOICE, and choosing it has to stick — otherwise the chooser reappears on
  // every render while the map is still empty, which is the flow nagging someone who answered it.
  const [blankChosen, setBlankChosen] = useState(false);
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
  const areaOf = useMemo(() => new Map(visible.map((r) => [r.id, r.area])), [visible]);

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
    // Open exactly the areas this position already touches — the same rule a starting point uses,
    // so returning to a saved position and applying a set land in the same place.
    setOpenAreas(new Set(mine.map((r) => areaOf.get(r.responsibility_id)).filter((a): a is string => !!a)));
    console.log('[TRACE:POSITIONS] builder-loaded', { positionId, found: !!p, visibleRows: visible.length, picks: mine.length });
    setLoading(false);
  }, [businessId, positionId, visible.length, areaOf]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    if (!mayEdit) return;
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, { frequency: null });
      return next;
    });
  }

  function toggleArea(area: string) {
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  }

  function setFrequency(id: string, freq: ResponsibilityFrequency, fallback: ResponsibilityFrequency) {
    // 🔴 Storing NULL when the owner picks the catalogue default is not a micro-optimisation: a
    // stored copy becomes a SECOND TRUTH the day the default is corrected (R-27). Only a genuine
    // override is kept.
    setPicks((prev) => new Map(prev).set(id, { frequency: freq === fallback ? null : freq }));
  }

  /**
   * 🔴 A STARTING POINT PRE-TICKS AND NOTHING ELSE. It does not save, it does not create a role,
   * and it does not touch a permission — the owner still reviews the list and still presses Save,
   * so every tick that survives is theirs. `startingPointIds` filters to what this business can
   * SEE, so a set never mints a phantom tick for a row the vertical hides.
   */
  function applyStartingPoint(sp: PositionStartingPoint) {
    if (!mayEdit) return;
    const ids = startingPointIds(sp, visible);
    setPicks(new Map(ids.map((id) => [id, { frequency: null }])));
    setOpenAreas(new Set(ids.map((id) => areaOf.get(id)).filter((a): a is string => !!a)));
    if (sp.kind === 'blank') setBlankChosen(true);
    setNotice(null);
    console.log('[TRACE:POSITIONS] starting-point', { positionId, key: sp.key, kind: sp.kind, ticked: ids.length });
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

  const showChooser = mayEdit && picks.size === 0 && !blankChosen;

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

            {/*
              ── ① START FROM A SET, NOT FROM NOTHING ──
              🔴 THE CHOICE IS OFFERED AND NEVER INFERRED FROM THE TITLE. "Production Manager",
              "Operations Manager", "Yard Manager" and "Nursery Manager" are the same job, and a
              string match would be right sometimes and WRONG SILENTLY. A wrong inference here
              writes a job description, which is worse than an extra tap. Nothing below reads
              `title`.
            */}
            {showChooser && (
              <div style={{ ...CARD, background: '#f7faf3', borderColor: '#dbe8cd' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px', color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={17} color={GREEN} /> Start from a set
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: '0 0 14px' }}>
                  Pick the job this is closest to and we will tick a starting set. Then change
                  whatever is wrong — every tick and untick from there is yours.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {POSITION_STARTING_POINTS.map((sp) => {
                    // ⚠️ The count is `.length` of what this business can SEE, never a number typed
                    // beside the label — a typed count is the copy that drifts (STD-011).
                    const n = startingPointIds(sp, visible).length;
                    return (
                      <button key={sp.key} onClick={() => applyStartingPoint(sp)}
                        style={{
                          display: 'flex', width: '100%', minHeight: 48, alignItems: 'center', gap: 12,
                          padding: '12px 14px', background: '#fff', cursor: 'pointer',
                          border: '1px solid #dbe8cd', borderRadius: 8, textAlign: 'left',
                        }}>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
                            {sp.label}
                            {sp.kind !== 'blank' && (
                              <span style={{ fontWeight: 500, color: '#4b5563' }}>{`, ${n} to start`}</span>
                            )}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280' }}>{sp.blurb}</span>
                        </span>
                        <ChevronRight size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '12px 0 0' }}>
                  A starting point is a suggestion, not a rule, and it is not saved until you press
                  Save. It creates no role and gives nobody access to anything.
                </p>
              </div>
            )}

            {/*
              ── ③ THE RUNNING TOTAL, ON SCREEN AT ALL TIMES ──
              Sticky because the list is ninety-three rows long: a Save that only exists at the
              bottom of a long form is a Save people do not reach, and a total you have to scroll
              to is a total nobody reads.
            */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12,
              flexWrap: 'wrap', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
              padding: '10px 14px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
                {picks.size === 0 ? 'Nothing ticked yet' : `${picks.size} ticked`}
              </span>
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>of {visible.length}</span>
              <span style={{ flex: 1 }} />
              {mayEdit && (
                <button onClick={() => void handleSave()} disabled={saving} style={{ ...BTN, minHeight: 44 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>

            {/*
              ── ② TEN HEADINGS, NOT NINETY-THREE LINES ──
              🔴 COLLAPSED, NEVER FILTERED. Every unticked row is still there and still reachable,
              because part of the value is reading a responsibility and realising nobody does it.
            */}
            {areas.map((area) => {
              const rows = visible.filter((r) => r.area === area);
              const chosen = rows.filter((r) => picks.has(r.id)).length;
              const open = openAreas.has(area);
              return (
                <div key={area} style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                  <button onClick={() => toggleArea(area)} aria-expanded={open}
                    style={{
                      display: 'flex', width: '100%', minHeight: 48, alignItems: 'center', gap: 10,
                      padding: '12px 16px', background: chosen > 0 ? '#f7faf3' : '#fff',
                      border: 'none', borderRadius: 0, cursor: 'pointer', textAlign: 'left',
                    }}>
                    {open ? <ChevronDown size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                          : <ChevronRight size={18} color="#6b7280" style={{ flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{area}</span>
                    <span style={{ fontSize: '0.8125rem', color: chosen > 0 ? GREEN : '#6b7280', fontWeight: chosen > 0 ? 600 : 400 }}>
                      {chosen === 0 ? `0 of ${rows.length}` : `${chosen} of ${rows.length} ticked`}
                    </span>
                  </button>

                  {open && (
                    <div style={{ padding: '0 16px 8px' }}>
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
                  )}
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
