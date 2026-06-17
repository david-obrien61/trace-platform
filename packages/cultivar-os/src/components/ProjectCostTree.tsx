/**
 * ── PROJECT COST TREE (Cultivar OS) · THUNDER D-10 · 2026-06-16 ──────────────────
 *
 * PURPOSE
 *   The "By project" lens on /costs (DECISION-project-lens-ui-design.md). Re-cuts the SAME
 *   honest captured cost data BY PROJECT as a collapsible tree:
 *     • visual ROOT = the tenant's business NAME (from context, NOT a stored node — §2);
 *     • parent_id-null costs under it as "Platform overhead" (company-level);
 *     • each PROJECT node with its rollup total (capex one-time vs /mo honestly separated,
 *       unknowns surfaced never $0);
 *     • collapse/expand per group (default collapsed) so 50+ costs stay scannable.
 *   The flat company top-line stays ABOVE this section on /costs (D-10: flat = company-total
 *   cut retained; project cut ADDED, not substituted).
 *
 *   GROUPING is computed by the shared buildProjectLens adapter (PATH A): it synthesizes
 *   containment edges from cost_objects.parent_id and rolls each group up THROUGH
 *   CostRollup + the count-once seam — so reassignment recomputes via an honest re-derive,
 *   never a local +/− shortcut (§5). The honesty engine (D-9) is untouched.
 *
 * ROW CONTROLS (§4 — ALL THREE fields click-to-edit inline; 2026-06-17 + column headers):
 *   • confidence badge → dropdown (writes cost_confidence).
 *   • parent badge → dropdown of PROJECTs + "Company-level" (writes parent_id; a MOVE, §3).
 *   • amount → inline number input. Reads recurring_amount for recurring shapes (shown with a
 *     cadence suffix $/mo·$/yr) or acquisition_cost for capex (one-time). "unknown" appears ONLY
 *     when there is genuinely no amount — never on a CONFIRMED/DERIVED/ESTIMATED row (the third
 *     column used to default to "unknown" because it read acquisition_cost for every row).
 *   CONFIDENCE↔AMOUNT COHERENCE (D-9 at input — the CONFIRMED-but-unknown state is unreachable):
 *     UNKNOWN ⟺ no amount. → UNKNOWN clears the amount; → any other grade with no amount opens
 *     the amount editor to collect the number first; setting an amount on an UNKNOWN row bumps it
 *     to ESTIMATED. (Display only surfaces a pre-existing incoherent row; it never fabricates.)
 *   Cadence is DISPLAYED beside the amount; cadence EDITING stays in Settings (step 7).
 *
 * DEPENDENCIES
 *   - ../lib/supabase (cost_objects read + parent_id/cost_confidence updates, RLS-scoped)
 *   - @trace/shared/business-logic buildProjectLens (the pure grouping + rollup adapter)
 *   - ./ProjectsManager (the entry-side PROJECT-bucket CRUD modal)
 *
 * OUTPUTS
 *   - Read-only tree display + two writes: reassign (parent_id) and re-grade (cost_confidence).
 *     Every write reloads → rebuilds the lens → recomputes both affected totals through the seam.
 *
 * TENANT ISOLATION (AC-3): reads businessId from context; all queries are business_id-scoped.
 *   In a tenant with no captured costs the tree is the "right kind of empty" — that absence is
 *   the hand-test that RLS holds (David's two-tenant owner-proof).
 *
 * INSTRUMENTATION (STD-003): emits `[TRACE:PROJECTLENS]` on load / reassign / re-grade. ON BY
 *   DEFAULT until David owner-proves the lens through the UI under RLS; comment out then, do
 *   not delete.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, FolderTree, AlertTriangle, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildProjectLens, OVERHEAD_GROUP_ID } from '@trace/shared/business-logic';
import type { ProjectLensRow, ProjectLensView } from '@trace/shared/business-logic';
import { ProjectsManager, type ManagedProject } from './ProjectsManager';

const GREEN = '#27500A';
const GRAY = '#6b7280';
const DARK = '#111827';
const AMBER = '#b45309';

const CONFIDENCE_OPTIONS = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'] as const;
const COMPANY_LEVEL = '__company__'; // <select> sentinel for parent_id = null

const money = (n: number) => `$${n.toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

// Cadence → short suffix shown beside a recurring amount ($110/mo, $200/yr).
const CADENCE_SUFFIX: Record<string, string> = { MONTHLY: '/mo', ANNUAL: '/yr', WEEKLY: '/wk', QUARTERLY: '/qtr' };
const isRecurringShape = (s: string | null | undefined) => s === 'RECURRING_FIXED' || s === 'PER_OCCASION';
/** Which $ column a row's amount lives in: recurring → recurring_amount, else → acquisition_cost. */
const amountFieldOf = (r: ProjectLensRow) => (isRecurringShape(r.cost_shape) ? 'recurring_amount' : 'acquisition_cost');
const amountOf = (r: ProjectLensRow) => (isRecurringShape(r.cost_shape) ? (r.recurring_amount ?? null) : (r.acquisition_cost ?? null));

interface RawRow {
  id: string;
  name: string | null;
  node_type: 'ASSET' | 'PROJECT' | 'PRODUCT' | 'COST';
  parent_id: string | null;
  acquisition_cost: number | null;
  cost_confidence: ProjectLensRow['cost_confidence'] | null;
  cost_shape: string | null;
  cadence: string | null;
  recurring_amount: number | null;
}

export function ProjectCostTree({ businessId, businessName }: { businessId: string; businessName?: string }) {
  const [rows, setRows] = useState<ProjectLensRow[]>([]);
  const [view, setView] = useState<ProjectLensView | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false); // cost_objects relation absent (defensive)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 'amount' joins confidence + parent as a third inline-editable field. pendingConfidence is
  // set when a confidence→non-UNKNOWN change opened the amount editor to collect the number
  // (David's HP ProDesk flow): committing the amount also writes that confidence.
  const [editing, setEditing] = useState<{ rowId: string; field: 'confidence' | 'parent' | 'amount'; pendingConfidence?: string } | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('cost_objects')
      .select('id,name,node_type,parent_id,acquisition_cost,cost_confidence,cost_shape,cadence,recurring_amount')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (error) {
      // DEFENSIVE: if the cost_objects relation is somehow absent, degrade quietly — the flat
      // top-line above still works. (Schema is live in TRACE; this is belt-and-suspenders.)
      console.warn('[TRACE:PROJECTLENS] cost_objects unavailable', error.code, error.message);
      setUnavailable(true);
      setLoading(false);
      return;
    }
    const mapped: ProjectLensRow[] = ((data ?? []) as RawRow[]).map((r) => ({
      id: r.id,
      label: r.name ?? 'Unnamed',
      node_type: r.node_type ?? 'ASSET',
      parent_id: r.parent_id ?? null,
      acquisition_cost: r.acquisition_cost ?? null,
      cost_confidence: r.cost_confidence ?? 'UNKNOWN',
      // Feed the shape fields so the (already shape-aware) fromCostObject/CostRollup engine
      // buckets recurring COST rows into the monthly pool — fixing both the per-row amount
      // display and the group rollup totals. NO engine change; the tree just wasn't passing these.
      cost_shape: (r.cost_shape as ProjectLensRow['cost_shape']) ?? undefined,
      cadence: (r.cadence as ProjectLensRow['cadence']) ?? undefined,
      recurring_amount: r.recurring_amount ?? null,
    }));
    const v = buildProjectLens(mapped, businessName || 'My business', today());
    console.log('[TRACE:PROJECTLENS] load', {
      businessId,
      rows: mapped.length,
      projects: v.groups.filter((g) => g.id !== OVERHEAD_GROUP_ID).length,
      flatCapex: v.flatCompanyTotal.capexKnown,
      dangling: v.danglingCount,
      flags: v.flags.length,
    });
    setRows(mapped);
    setView(v);
    setUnavailable(false);
    setLoading(false);
  }, [businessId, businessName]);

  useEffect(() => { load(); }, [load]);

  async function reassign(rowId: string, parentSel: string) {
    const parent_id = parentSel === COMPANY_LEVEL ? null : parentSel;
    setEditing(null);
    console.log('[TRACE:PROJECTLENS] reassign (MOVE)', { rowId, parent_id });
    const { error } = await supabase.from('cost_objects').update({ parent_id }).eq('id', rowId).eq('business_id', businessId);
    if (error) { console.error('[TRACE:PROJECTLENS] reassign error', error.message); return; }
    await load(); // reload → rebuild lens → recompute BOTH affected totals through the seam
  }

  async function writeRow(rowId: string, patch: Record<string, unknown>): Promise<boolean> {
    const { error } = await supabase.from('cost_objects').update(patch).eq('id', rowId).eq('business_id', businessId);
    if (error) { console.error('[TRACE:PROJECTLENS] write error', error.message); return false; }
    return true;
  }

  // CONFIDENCE↔AMOUNT COHERENCE (D-9 enforced at input — the CONFIRMED-but-unknown state is unreachable):
  //   • → UNKNOWN          : clear the amount (UNKNOWN ⟺ no amount).
  //   • → non-UNKNOWN, no $ : open the amount editor to collect the number first (don't persist yet).
  //   • → non-UNKNOWN, has $: just write the confidence.
  async function commitConfidence(row: ProjectLensRow, newConf: string) {
    setEditing(null);
    if (newConf === row.cost_confidence) return;
    const field = amountFieldOf(row);
    if (newConf === 'UNKNOWN') {
      console.log('[TRACE:PROJECTLENS] regrade → UNKNOWN (clear amount, coherence)', { rowId: row.id });
      if (await writeRow(row.id, { cost_confidence: 'UNKNOWN', [field]: null })) await load();
      return;
    }
    if (amountOf(row) == null) {
      console.log('[TRACE:PROJECTLENS] regrade needs amount → open amount editor', { rowId: row.id, pendingConfidence: newConf });
      setEditing({ rowId: row.id, field: 'amount', pendingConfidence: newConf });
      return;
    }
    console.log('[TRACE:PROJECTLENS] regrade', { rowId: row.id, confidence: newConf });
    if (await writeRow(row.id, { cost_confidence: newConf })) await load();
  }

  // Amount commit (the inline amount editor). value=null means "cleared".
  //   • cleared, no pending change : amount→null + confidence→UNKNOWN (no $ ⟺ UNKNOWN).
  //   • cleared, pending non-UNKNOWN: user declined to supply a number → revert (persist nothing).
  //   • real number               : write it; if the row was UNKNOWN (or a pending grade was set),
  //                                  set confidence to that grade / bump UNKNOWN→ESTIMATED.
  async function commitAmount(row: ProjectLensRow, value: number | null, pendingConfidence?: string) {
    setEditing(null);
    const field = amountFieldOf(row);
    if (value == null) {
      if (pendingConfidence) { console.log('[TRACE:PROJECTLENS] amount entry cancelled — confidence change reverted', { rowId: row.id }); return; }
      console.log('[TRACE:PROJECTLENS] amount cleared → UNKNOWN (coherence)', { rowId: row.id });
      if (await writeRow(row.id, { [field]: null, cost_confidence: 'UNKNOWN' })) await load();
      return;
    }
    const conf = pendingConfidence ?? (row.cost_confidence === 'UNKNOWN' ? 'ESTIMATED' : row.cost_confidence);
    console.log('[TRACE:PROJECTLENS] set amount', { rowId: row.id, field, value, confidence: conf });
    if (await writeRow(row.id, { [field]: value, cost_confidence: conf })) await load();
  }

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const projectChoices = rows.filter((r) => r.node_type === 'PROJECT').map((p) => ({ id: p.id, label: p.label }));
  const managedProjects: ManagedProject[] = projectChoices.map((p) => ({
    ...p,
    childCount: rows.filter((r) => r.parent_id === p.id && r.node_type !== 'PROJECT').length,
  }));
  const parentLabel = (parentId: string | null) =>
    parentId == null ? 'Company-level' : (projectChoices.find((p) => p.id === parentId)?.label ?? 'Company-level');

  return (
    <div style={S.card}>
      <div style={S.sectionHead}>
        <p style={S.sectionTitle}><FolderTree size={14} /> By project</p>
        <button style={S.manageBtn} onClick={() => setManagerOpen(true)}>Manage projects</button>
      </div>

      {loading && <p style={S.muted}>Loading…</p>}

      {!loading && unavailable && (
        <p style={S.muted}>Cost capture isn't available yet — the company total above still applies.</p>
      )}

      {!loading && !unavailable && view && (
        rows.length === 0 ? (
          <div style={S.empty}>
            <Layers size={28} color="#d1d5db" style={{ marginBottom: 6 }} />
            <p style={{ margin: 0, fontWeight: 600, color: DARK }}>No captured costs yet</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: GRAY }}>
              Add assets and costs, then group them by project here.
            </p>
          </div>
        ) : (
          <>
            {/* ROOT — the tenant business NAME (rendered, not stored). Captured total = count-once. */}
            <div style={S.rootRow}>
              <span style={{ fontWeight: 800, color: GREEN, fontSize: '0.95rem' }}>{view.rootLabel}</span>
              <span style={{ fontSize: '0.75rem', color: GRAY }}>
                Captured: <b style={{ color: DARK }}>{money(view.flatCompanyTotal.capexKnown)}</b> one-time
                {view.flatCompanyTotal.poolKnownMonthly > 0 && <> · <b style={{ color: DARK }}>{money(view.flatCompanyTotal.poolKnownMonthly)}</b>/mo</>}
                {view.flatCompanyTotal.unknownLines.length > 0 && <> · <span style={{ color: AMBER }}>{view.flatCompanyTotal.unknownLines.length} unknown</span></>}
              </span>
            </div>

            {/* GROUPS — overhead first, then projects. */}
            {view.groups.map((g) => {
              const isOpen = expanded.has(g.id);
              const unknowns = g.rollup.seam.unknownLines.length;
              return (
                <div key={g.id} style={S.group}>
                  <button style={S.groupHead} onClick={() => toggle(g.id)}>
                    {isOpen ? <ChevronDown size={16} color={GRAY} /> : <ChevronRight size={16} color={GRAY} />}
                    <span style={{ fontWeight: 700, color: g.isOverhead ? GRAY : DARK, flex: 1, textAlign: 'left' }}>
                      {g.label}
                    </span>
                    <span style={S.groupTotals}>
                      {g.rollup.capexKnown > 0 && <span>{money(g.rollup.capexKnown)} <span style={S.dim}>one-time</span></span>}
                      {g.rollup.poolKnownMonthly > 0 && <span>{money(g.rollup.poolKnownMonthly)}<span style={S.dim}>/mo</span></span>}
                      {g.rollup.capexKnown === 0 && g.rollup.poolKnownMonthly === 0 && <span style={S.dim}>—</span>}
                      {unknowns > 0 && <span style={S.unknownPill}><AlertTriangle size={11} /> {unknowns}</span>}
                    </span>
                  </button>

                  {isOpen && (
                    <div style={S.children}>
                      {g.children.length === 0 && <p style={{ ...S.muted, padding: '6px 0 6px 24px' }}>No costs assigned here yet.</p>}
                      {/* COLUMN HEADERS — so the table explains itself (fix A). */}
                      {g.children.length > 0 && (
                        <div style={S.childHeader}>
                          <span style={{ flex: 1 }}>Cost</span>
                          <span style={S.colConf}>Confidence</span>
                          <span style={S.colProj}>Project</span>
                          <span style={S.colAmt}>Amount</span>
                        </div>
                      )}
                      {g.children.map((c) => {
                        const conf = (c.cost_confidence ?? 'UNKNOWN');
                        const amt = amountOf(c);              // recurring_amount OR acquisition_cost
                        const unknown = amt == null;          // "unknown" ONLY when truly no amount
                        const recurring = isRecurringShape(c.cost_shape);
                        const suffix = recurring ? (CADENCE_SUFFIX[c.cadence ?? 'MONTHLY'] ?? '') : '';
                        return (
                          <div key={c.id} style={S.childRow}>
                            <span style={{ flex: 1, color: DARK, fontSize: '0.875rem' }}>{c.label}</span>

                            {/* confidence badge → dropdown on click (coherence-enforced) */}
                            {editing?.rowId === c.id && editing.field === 'confidence' ? (
                              <select autoFocus style={{ ...S.select, ...S.colConf }} defaultValue={conf}
                                onChange={(e) => commitConfidence(c, e.target.value)} onBlur={() => setEditing(null)}>
                                {CONFIDENCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <button style={{ ...S.badge(conf), ...S.colConf }} onClick={() => setEditing({ rowId: c.id, field: 'confidence' })} title="Click to change confidence">
                                {conf}
                              </button>
                            )}

                            {/* parent badge → dropdown on click (the reassignment control) */}
                            {editing?.rowId === c.id && editing.field === 'parent' ? (
                              <select autoFocus style={{ ...S.select, ...S.colProj }} defaultValue={c.parent_id ?? COMPANY_LEVEL}
                                onChange={(e) => reassign(c.id, e.target.value)} onBlur={() => setEditing(null)}>
                                <option value={COMPANY_LEVEL}>Company-level</option>
                                {projectChoices.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                              </select>
                            ) : (
                              <button style={{ ...S.parentBadge, ...S.colProj }} onClick={() => setEditing({ rowId: c.id, field: 'parent' })} title="Click to move to another project">
                                {parentLabel(c.parent_id)} ▾
                              </button>
                            )}

                            {/* amount → inline input on click (third inline-editable field, fix B+C) */}
                            {editing?.rowId === c.id && editing.field === 'amount' ? (
                              <AmountInput
                                initial={amt}
                                suffix={recurring ? suffix : 'one-time'}
                                onCommit={(v) => commitAmount(c, v, editing?.pendingConfidence)}
                                onCancel={() => setEditing(null)}
                              />
                            ) : (
                              <button
                                style={{ ...S.amountBtn, color: unknown ? AMBER : DARK }}
                                onClick={() => setEditing({ rowId: c.id, field: 'amount' })}
                                title="Click to edit amount"
                              >
                                {unknown ? 'unknown' : `${money(amt as number)}${suffix}`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {/* honest flags from this group's rollup (open period / multi-path / cycle) */}
                      {g.rollup.flags.length > 0 && (
                        <p style={S.flagNote}>{g.rollup.flags.join(' · ')}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {view.danglingCount > 0 && (
              <p style={S.flagNote}>
                <AlertTriangle size={12} /> {view.danglingCount} cost{view.danglingCount === 1 ? '' : 's'} pointed at a removed project — shown under Platform overhead, still counted.
              </p>
            )}

            <p style={S.footNote}>
              One-time capital is shown separately and never divides into your monthly per-customer cost.
              Unknown costs are surfaced, never counted as $0. Moving a cost recomputes both totals honestly.
            </p>
          </>
        )
      )}

      {managerOpen && (
        <ProjectsManager
          businessId={businessId}
          projects={managedProjects}
          onChanged={load}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
}

// ── styles (matches the /costs page idiom) ──
const S = {
  card: { background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' } as React.CSSProperties,
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 } as React.CSSProperties,
  sectionTitle: { fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  manageBtn: { background: '#fff', border: `1.5px solid ${GREEN}`, color: GREEN, borderRadius: 8, padding: '5px 11px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  muted: { color: GRAY, fontSize: '0.8125rem', margin: 0 } as React.CSSProperties,
  empty: { textAlign: 'center', padding: '20px 0' } as React.CSSProperties,
  rootRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 4px 12px', borderBottom: '1px solid #f0f0f0', marginBottom: 6, gap: 8, flexWrap: 'wrap' } as React.CSSProperties,
  group: { borderBottom: '1px solid #f6f6f6' } as React.CSSProperties,
  groupHead: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px' } as React.CSSProperties,
  groupTotals: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem', fontWeight: 700, color: DARK } as React.CSSProperties,
  dim: { fontSize: '0.6875rem', fontWeight: 500, color: GRAY } as React.CSSProperties,
  unknownPill: { display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fff7ed', color: AMBER, borderRadius: 10, padding: '1px 7px', fontSize: '0.6875rem', fontWeight: 700 } as React.CSSProperties,
  children: { paddingLeft: 24, paddingBottom: 8 } as React.CSSProperties,
  childRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderTop: '1px solid #f8f8f8' } as React.CSSProperties,
  badge: (conf: string): React.CSSProperties => {
    const weak = conf === 'UNKNOWN' || conf === 'ESTIMATED';
    return { fontSize: '0.625rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12, cursor: 'pointer', border: 'none', background: weak ? '#fee2e2' : '#dcfce7', color: weak ? '#991b1b' : '#166534' };
  },
  parentBadge: { fontSize: '0.6875rem', fontWeight: 600, padding: '3px 8px', borderRadius: 8, cursor: 'pointer', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', whiteSpace: 'nowrap' } as React.CSSProperties,
  select: { fontSize: '0.75rem', padding: '3px 6px', borderRadius: 8, border: `1.5px solid ${GREEN}`, background: '#fff', color: DARK, cursor: 'pointer' } as React.CSSProperties,
  flagNote: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: AMBER, margin: '8px 0 0', lineHeight: 1.5 } as React.CSSProperties,
  footNote: { fontSize: '0.6875rem', color: GRAY, lineHeight: 1.5, margin: '14px 0 0' } as React.CSSProperties,
  // Column headers (fix A) + per-column widths so labels sit over their controls.
  childHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 5px', fontSize: '0.5625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f0f0f0' } as React.CSSProperties,
  colConf: { width: 84, textAlign: 'center', flex: 'none' } as React.CSSProperties,
  colProj: { width: 116, textAlign: 'center', flex: 'none' } as React.CSSProperties,
  colAmt:  { width: 84, textAlign: 'right', flex: 'none' } as React.CSSProperties,
  amountBtn: { width: 84, textAlign: 'right', fontWeight: 600, fontSize: '0.8125rem', background: 'none', border: 'none', borderBottom: '1px dashed #d1d5db', cursor: 'pointer', padding: '2px 0', whiteSpace: 'nowrap' } as React.CSSProperties,
};

/**
 * Inline amount editor (fix B+C). Commits on blur/Enter, cancels on Escape. Empty input commits
 * null (→ the coherence rule routes it to UNKNOWN, or reverts a pending confidence change).
 */
function AmountInput({ initial, suffix, onCommit, onCancel }: {
  initial: number | null; suffix: string; onCommit: (v: number | null) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(initial == null ? '' : String(initial));
  const done = useRef(false);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const raw = text.replace(/[^0-9.]/g, '');
    const n = parseFloat(raw);
    onCommit(raw === '' || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, width: 84, flex: 'none' }}>
      <input
        autoFocus inputMode="decimal" value={text} placeholder="amount"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === 'Escape') { done.current = true; onCancel(); }
        }}
        onBlur={commit}
        style={{ ...S.select, width: 52 }}
      />
      <span style={{ fontSize: '0.5625rem', color: GRAY }}>{suffix}</span>
    </span>
  );
}
