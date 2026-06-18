/**
 * ── PROJECT COST DRILL-IN (Cultivar OS) · THUNDER D-14 Phase 1 · 2026-06-18 ──────
 *
 * PURPOSE
 *   The per-project cost-to-produce drill-in (D-14 Phase 1, COST-ONLY). Select one project
 *   group in the By-project tree → see ITS cost in isolation: the monthly pool + one-time
 *   capital, the monthly pool broken down by category (Labor / Other recurring), capital
 *   shown separately, and the confidence mix for THIS project's rows. It is the company
 *   "What we know — honestly" view scoped to one project — same honest data, one cut.
 *
 *   ZERO SCHEMA, ZERO RECOMPUTE OF THE TOTALS. The two headline figures are taken VERBATIM
 *   from the group's existing rollup (group.rollup.poolKnownMonthly / .capexKnown) — the
 *   SAME NodeRollup the tree already shows — so the number CANNOT change between tree and
 *   drill-in (the reconciliation contract). The category split is a pure view-layer group-by
 *   over the project's child cost rows, normalized through the SAME shared fromCostObject the
 *   rollup uses.
 *
 * PHASE 1.1 (2026-06-18) — AGGREGATES EXPAND TO LINE ITEMS (read-only):
 *   Labor / Other recurring / Captured capital are click-to-expand; each shows its constituent
 *   rows (name · amount · confidence badge · cost_category · receipt link if receipt_id).
 *   HONESTY: "Other recurring" is a REAL positive group-by of the project's non-labor monthly
 *   rows — NOT pool-minus-labor. A row with null/blank cost_category surfaces as its OWN
 *   "Uncategorized" line item (visible, never absorbed into a remainder) — the whole point is
 *   that a mistagged cost becomes VISIBLE. Reconciliation holds two ways: Σ line items === the
 *   aggregate (by construction), and labor + other === poolKnownMonthly / capital === capexKnown
 *   (the tree totals). A penny-level divergence (seam-merged dup) is surfaced, never hidden.
 *   SCOPE FENCE: read-only — no inline edit, no reassign, no project-assignment (the banked
 *   /assets gap). Receipt deep-link (/receipts/:id) does not exist yet → 🟡 links to /receipts.
 *
 *   NO pricing / margin / N / sensitivity here (D-14: cost truth ≠ price strategy). Phase 2
 *   adds the pricing layer (settable N + margin + cross-branch carve-out). Per Surface
 *   Honesty there is NO dead pricing panel — it is OMITTED, not stubbed.
 *
 * DEPENDENCIES
 *   - @trace/shared/business-logic fromCostObject (per-row monthly/capex normalization —
 *     the SAME adapter the rollup feeds, so the split reconciles to the rollup totals)
 *   - @trace/shared/business-logic ProjectGroup / ProjectLensRow (the group + its child rows)
 *
 * OUTPUTS
 *   - Read-only modal. No DB writes. Reads group.rollup (authoritative totals) + group.children
 *     (cost_category carried at runtime) and renders the scoped cost picture.
 *
 * INSTRUMENTATION (STD-003): emits `[TRACE:PROJECTLENS] drill-in open` with projectId, the two
 *   headline figures, the category split, and the confidence mix. ON BY DEFAULT until David
 *   owner-proves it through the UI under RLS; comment out then — do not delete. A reconciliation
 *   flag (🟡 [TRACE:PROJECTLENS] reconcile-drift) fires if the confidence mix sum diverges from
 *   the authoritative pool (a possible seam-merged duplicate) — surfaced, never silently hidden.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calculator, AlertTriangle, ChevronRight, ChevronDown, Receipt } from 'lucide-react';
import { fromCostObject } from '@trace/shared/business-logic';
import type { ProjectGroup, ProjectLensRow } from '@trace/shared/business-logic';

const GREEN = '#27500A';
const GRAY = '#6b7280';
const DARK = '#111827';
const AMBER = '#b45309';

/** A lens child row carrying cost_category + receipt_id (real columns fetched by the tree). */
export type DrillChild = ProjectLensRow & { cost_category?: string | null; receipt_id?: string | null };

/** Existing money standard: Intl USD, right-aligned at the call site. */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (n: number) => usd.format(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

const isLaborCat = (c?: string | null) => c === 'labor' || c === 'contract-labor';
const FLOOR_GRADES = new Set(['CONFIRMED', 'DERIVED']);
const UNCATEGORIZED = 'Uncategorized';
/** A blank/null/whitespace cost_category is honestly Uncategorized — never hidden. */
const categoryLabel = (c?: string | null) => (c && c.trim() ? c : UNCATEGORIZED);

/** One constituent cost row under an aggregate (read-only line item). */
export interface LineItem {
  id: string;
  name: string;
  amount: number;                       // monthly (recurring) or one-time (capital)
  confidence: string;                   // CONFIRMED / DERIVED / ESTIMATED / UNKNOWN
  category: string;                     // real category, or "Uncategorized" (blank surfaced)
  isUncategorized: boolean;
  receiptId: string | null;
}

interface DrillSummary {
  poolKnownMonthly: number;     // authoritative — from group.rollup (the tree total)
  capexKnown: number;           // authoritative — from group.rollup (the tree total)
  laborItems: LineItem[];
  otherItems: LineItem[];       // REAL non-labor monthly rows (incl. Uncategorized) — NOT a remainder
  capitalItems: LineItem[];
  laborMonthly: number;         // Σ laborItems
  otherRecurringMonthly: number;// Σ otherItems (real positive group-by)
  capitalOneTime: number;       // Σ capitalItems
  floorMonthly: number;         // CONFIRMED+DERIVED monthly pool (of which)
  estimatedMonthly: number;     // ESTIMATED monthly pool (of which)
  unknownLabels: string[];      // rows with no amount — surfaced, never $0
  anyUncategorized: boolean;    // any non-labor monthly row with a blank category
  poolDrift: number;            // |labor+other − poolKnownMonthly|, >0.02 ⇒ seam-merged dup
  capexDrift: number;           // |Σ capital − capexKnown|, >0.02 ⇒ seam-merged dup
}

/**
 * Pure: derive the scoped cost picture from the group's authoritative rollup + its child rows.
 * Headline totals come straight from the rollup (reconciliation guarantee). The aggregates are
 * REAL group-bys of the rows (Σ line items), normalized through the SAME fromCostObject the
 * rollup uses — so Σ items === aggregate, and labor+other === pool / Σ capital === capex.
 */
export function summarizeGroup(group: ProjectGroup, children: DrillChild[]): DrillSummary {
  const poolKnownMonthly = round2(group.rollup.poolKnownMonthly);
  const capexKnown = round2(group.rollup.capexKnown);

  const laborItems: LineItem[] = [];
  const otherItems: LineItem[] = [];
  const capitalItems: LineItem[] = [];
  let laborMonthly = 0, otherRecurringMonthly = 0, capitalOneTime = 0;
  let floorMonthly = 0, estimatedMonthly = 0;
  const unknownLabels: string[] = [];

  for (const c of children) {
    const cat = categoryLabel(c.cost_category);
    const uncat = cat === UNCATEGORIZED;
    for (const e of fromCostObject(c)) {
      if (e.amount == null) { unknownLabels.push(c.label); continue; } // no amount → unknown list, not a sum
      const item: LineItem = {
        id: c.id, name: c.label, amount: e.amount, confidence: e.amountConfidence,
        category: cat, isUncategorized: uncat && e.bucket === 'MONTHLY_POOL' && !isLaborCat(c.cost_category),
        receiptId: c.receipt_id ?? null,
      };
      if (e.bucket === 'MONTHLY_POOL') {
        if (isLaborCat(c.cost_category)) { laborItems.push(item); laborMonthly += e.amount; }
        else { otherItems.push(item); otherRecurringMonthly += e.amount; }
        if (FLOOR_GRADES.has(e.amountConfidence)) floorMonthly += e.amount;
        else if (e.amountConfidence === 'ESTIMATED') estimatedMonthly += e.amount;
      } else { // CAPEX (one-time capital)
        capitalItems.push(item); capitalOneTime += e.amount;
      }
    }
  }

  laborMonthly = round2(laborMonthly);
  otherRecurringMonthly = round2(otherRecurringMonthly);
  capitalOneTime = round2(capitalOneTime);
  const anyUncategorized = otherItems.some((i) => i.isUncategorized);
  // Reconcile the REAL aggregates against the authoritative tree totals (honest, two-sided).
  const poolDrift = round2(Math.abs(round2(laborMonthly + otherRecurringMonthly) - poolKnownMonthly));
  const capexDrift = round2(Math.abs(capitalOneTime - capexKnown));

  return {
    poolKnownMonthly, capexKnown, laborItems, otherItems, capitalItems,
    laborMonthly, otherRecurringMonthly, capitalOneTime,
    floorMonthly: round2(floorMonthly), estimatedMonthly: round2(estimatedMonthly),
    unknownLabels, anyUncategorized, poolDrift, capexDrift,
  };
}

export function ProjectCostDrillIn({
  group, businessName, onClose,
}: {
  group: ProjectGroup;
  businessName?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const children = group.children as DrillChild[]; // runtime carries cost_category + receipt_id (tree fetched them)
  const s = summarizeGroup(group, children);
  // Which aggregate rows are expanded (read-only line-item reveal). All collapsed by default.
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    // [TRACE:PROJECTLENS] (STD-003, on by default until OWNER-PROVEN).
    console.log('[TRACE:PROJECTLENS] drill-in open', {
      projectId: group.id,
      label: group.label,
      poolKnownMonthly: s.poolKnownMonthly,
      capexKnown: s.capexKnown,
      categorySplit: { labor: s.laborMonthly, otherRecurring: s.otherRecurringMonthly, capital: s.capitalOneTime },
      lineItemCounts: { labor: s.laborItems.length, other: s.otherItems.length, capital: s.capitalItems.length },
      anyUncategorized: s.anyUncategorized,
      confidenceMix: { floorMonthly: s.floorMonthly, estimatedMonthly: s.estimatedMonthly, unknownCount: s.unknownLabels.length },
      childRows: children.length,
    });
    if (s.poolDrift > 0.02 || s.capexDrift > 0.02) {
      // 🟡 Honest Debt: a real aggregate diverges from the authoritative tree total — likely a
      // seam-merged duplicate within this project. Surfaced, not hidden. (grep: reconcile-drift)
      console.warn('[TRACE:PROJECTLENS] reconcile-drift', { projectId: group.id, poolDrift: s.poolDrift, capexDrift: s.capexDrift });
    }
  }, [group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string, count: number) => {
    const willOpen = !open.has(key);
    if (willOpen) console.log('[TRACE:PROJECTLENS] drill-in expand', { projectId: group.id, aggregate: key, lineItemCount: count, anyUncategorized: s.anyUncategorized });
    setOpen((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };
  const openReceipt = () => { onClose(); navigate('/receipts'); }; // 🟡 no /receipts/:id deep-link yet

  const hasMonthly = s.poolKnownMonthly > 0 || s.laborItems.length > 0 || s.otherItems.length > 0;
  const hasCapital = s.capitalItems.length > 0;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            {businessName && <p style={S.tenant}>{businessName}</p>}
            <p style={S.title}><Calculator size={16} color={GREEN} /> {group.label} — cost to produce</p>
          </div>
          <button style={S.close} onClick={onClose} title="Close"><X size={18} color={GRAY} /></button>
        </div>

        {/* Two headline figures — VERBATIM from the rollup the tree shows (reconciliation contract). */}
        <div style={S.figRow}>
          <Figure label="Monthly pool" value={money(s.poolKnownMonthly)} accent />
          <Figure label="One-time capital" value={money(s.capexKnown)} />
        </div>

        {/* Monthly pool by category — each aggregate EXPANDS to its constituent line items. */}
        <Section title="Monthly pool — by category">
          {hasMonthly ? (
            <>
              <Aggregate label="Labor" value={money(s.laborMonthly)} items={s.laborItems} suffix="/mo"
                isOpen={open.has('labor')} onToggle={() => toggle('labor', s.laborItems.length)} onReceipt={openReceipt} />
              <Aggregate label="Other recurring" value={money(s.otherRecurringMonthly)} items={s.otherItems} suffix="/mo"
                isOpen={open.has('other')} onToggle={() => toggle('other', s.otherItems.length)} onReceipt={openReceipt} />
              <LineRow label="Monthly pool (total)" value={money(s.poolKnownMonthly)} strong />
            </>
          ) : (
            <p style={S.muted}>No recurring monthly cost assigned to this project yet.</p>
          )}
        </Section>

        {/* Capital is one-time — shown separately; never divides into the monthly pool. */}
        <Section title="Capital (one-time)">
          {hasCapital ? (
            <Aggregate label="Captured capital" value={money(s.capexKnown)} items={s.capitalItems} suffix=""
              isOpen={open.has('capital')} onToggle={() => toggle('capital', s.capitalItems.length)} onReceipt={openReceipt} strong />
          ) : (
            <p style={S.muted}>No one-time capital assigned to this project yet.</p>
          )}
          <p style={S.note}>One-time capital is shown separately and never divides into the monthly cost.</p>
        </Section>

        {/* Confidence mix for THIS project — mirrors the company "What we know — honestly" card. */}
        <Section title="What we know — honestly">
          <LineRow label="Confirmed + derived (floor)" value={`${money(s.floorMonthly)}/mo`} strong />
          {s.estimatedMonthly > 0 && <LineRow label="Estimated (soft)" value={`+ ${money(s.estimatedMonthly)}/mo`} />}
          {s.unknownLabels.length > 0 && (
            <div style={S.unknownBlock}>
              <span style={S.unknownHead}>
                <AlertTriangle size={13} /> {s.unknownLabels.length} unquantified cost{s.unknownLabels.length === 1 ? '' : 's'} — this project's real cost is higher
              </span>
              <span style={S.unknownBody}>{s.unknownLabels.join(' · ')}</span>
              <span style={S.unknownFoot}>Shown as unknown, never counted as $0.</span>
            </div>
          )}
        </Section>

        <p style={S.footNote}>
          This is {group.label}'s cost in isolation. Pricing — fair-share platform cost, margin, and per-customer
          spread — comes next (D-14 Phase 2); it is intentionally not shown here.
        </p>
      </div>
    </div>
  );
}

// ── presentational helpers ──
function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={S.fig}>
      <p style={S.figLabel}>{label}</p>
      <p style={{ ...S.figValue, color: accent ? GREEN : DARK }}>{value}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>{title}</p>
      {children}
    </div>
  );
}
function LineRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={S.lineRow}>
      <span style={{ fontSize: '0.875rem', color: strong ? DARK : GRAY, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: '0.9375rem', color: strong ? GREEN : DARK, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/**
 * An expandable aggregate row: the category total, click-to-reveal its constituent line items.
 * Read-only — no edit/reassign here (scope fence). Empty aggregate is not clickable.
 */
function Aggregate({ label, value, suffix, items, isOpen, onToggle, onReceipt, strong }: {
  label: string; value: string; suffix: string; items: LineItem[];
  isOpen: boolean; onToggle: () => void; onReceipt: () => void; strong?: boolean;
}) {
  const expandable = items.length > 0;
  return (
    <div>
      <button style={S.aggRow} onClick={expandable ? onToggle : undefined} disabled={!expandable}
        title={expandable ? `Show the ${items.length} cost${items.length === 1 ? '' : 's'} that make this up` : 'No line items'}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {expandable
            ? (isOpen ? <ChevronDown size={14} color={GRAY} /> : <ChevronRight size={14} color={GRAY} />)
            : <span style={{ width: 14 }} />}
          <span style={{ fontSize: '0.875rem', color: strong ? DARK : GRAY, fontWeight: strong ? 700 : 500 }}>{label}</span>
          {expandable && <span style={S.count}>{items.length}</span>}
        </span>
        <span style={{ fontSize: '0.9375rem', color: strong ? GREEN : DARK, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
      </button>
      {isOpen && (
        <div style={S.items}>
          {items.map((it) => <LineItemRow key={it.id} it={it} suffix={suffix} onReceipt={onReceipt} />)}
        </div>
      )}
    </div>
  );
}

/** One constituent cost row: name · category · confidence badge · amount · receipt link. Read-only. */
function LineItemRow({ it, suffix, onReceipt }: { it: LineItem; suffix: string; onReceipt: () => void }) {
  const weak = it.confidence === 'UNKNOWN' || it.confidence === 'ESTIMATED';
  return (
    <div style={S.itemRow}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={S.itemName}>{it.name}</span>
        <span style={{ ...S.cat, ...(it.isUncategorized ? S.catUncat : {}) }}>{it.category}</span>
      </span>
      <span style={{ ...S.badge, background: weak ? '#fee2e2' : '#dcfce7', color: weak ? '#991b1b' : '#166534' }}>{it.confidence}</span>
      {it.receiptId
        ? <button style={S.receipt} onClick={onReceipt} title="View in Receipt Keeper (no per-receipt link yet)"><Receipt size={12} /> Receipt</button>
        : <span style={S.noReceipt}>—</span>}
      <span style={S.itemAmt}>{money(it.amount)}{suffix}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 },
  card: { background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  tenant: { fontSize: '0.625rem', color: GRAY, margin: 0, letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' },
  title: { fontSize: '1.0625rem', fontWeight: 800, color: DARK, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 7 },
  close: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  figRow: { display: 'flex', gap: 10, marginBottom: 6 },
  fig: { flex: 1, background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 12, padding: '12px 14px' },
  figLabel: { fontSize: '0.625rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 },
  figValue: { fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0', textAlign: 'right' },
  section: { borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 12 },
  sectionTitle: { fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' },
  lineRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' },
  aggRow: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '5px 0', cursor: 'pointer', textAlign: 'left' },
  count: { fontSize: '0.625rem', fontWeight: 700, color: GRAY, background: '#f3f4f6', borderRadius: 10, padding: '1px 7px' },
  items: { paddingLeft: 19, borderLeft: '2px solid #f0f0f0', margin: '2px 0 8px 6px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid #f8f8f8' },
  itemName: { fontSize: '0.8125rem', color: DARK, marginRight: 7 },
  cat: { fontSize: '0.5625rem', fontWeight: 700, color: '#374151', background: '#eef2f7', borderRadius: 6, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' },
  catUncat: { background: '#fff7ed', color: AMBER } as React.CSSProperties,
  badge: { fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, flex: 'none' },
  receipt: { display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: GREEN, fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', padding: 0, flex: 'none' },
  noReceipt: { fontSize: '0.625rem', color: '#cbd5e1', flex: 'none', width: 50, textAlign: 'center' },
  itemAmt: { fontSize: '0.8125rem', fontWeight: 600, color: DARK, textAlign: 'right', flex: 'none', minWidth: 72 },
  muted: { color: GRAY, fontSize: '0.8125rem', margin: 0 },
  note: { fontSize: '0.6875rem', color: GRAY, lineHeight: 1.5, margin: '8px 0 0' },
  footNote: { fontSize: '0.6875rem', color: GRAY, lineHeight: 1.5, margin: '16px 0 0', fontStyle: 'italic' },
  unknownBlock: { display: 'flex', flexDirection: 'column', gap: 4, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginTop: 10 },
  unknownHead: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 700, color: AMBER },
  unknownBody: { fontSize: '0.75rem', color: '#9a6a2c', lineHeight: 1.6 },
  unknownFoot: { fontSize: '0.6875rem', color: '#9a6a2c' },
};
