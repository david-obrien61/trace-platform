// ============================================================
// InventoryReconcile — the desk RECONCILE surface (/inventory/reconcile) — D-50's payoff
// PURPOSE:      Turn a physical count into STAMPED, AUDITED TRUTH. The owner sees what the book
//               says (on-hand · reserved · available — D-52's three numbers), enters what is
//               physically there, and Accepting writes an append-only ledger event with a real
//               actor and a real timestamp. Nothing is ever written without a human accepting.
//               This is the RECONCILE half of capture=mobile/reconcile=desktop: InventoryCount.tsx
//               is the phone capture tool; this is the desk.
// MODES:        Automatic, per lot. No prior count → BASELINE (the count IS the truth; no window
//               exists to explain it against, so no attribution is asked for and NO empty "sold"
//               column is shown). Prior count + movements since → DELTA (the ledger window is
//               replayed as EVIDENCE, and a nonzero residual demands a human account).
// DEPENDENCIES: reconcileMath (the pure decision — mode, residual, evidence, the write plan),
//               inventoryStates (D-52 committed/available — the ONE derivation), <DataSheet>,
//               supabase RPCs count_reconcile_inventory + adjust_inventory_manual (D-50 LAYER 1,
//               both GRANTed to `authenticated`, both member-checked server-side).
// OUTPUTS:      Ledger events ONLY — via the RPCs. This page performs no direct qty UPDATE; the
//               RPCs own the qty write and the ledger INSERT in one transaction.
// NO SCHEMA:    reads existing tables; zero migration; zero new api function (12/12 held — the
//               RPCs are postgres functions and the reads run under existing RLS).
// INSTRUMENTATION (STD-003): `[TRACE:RECONCILE]` on load, math, accept, and every RPC step.
//               ON BY DEFAULT (standing owner instruction).
// ============================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, AlertTriangle, Check, X, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { DataSheet, sheetStyles as SS, type DataSheetColumn } from '../components/datasheet/DataSheet';
import { fetchCommittedByLot, type CommittedByLot } from '../lib/inventoryStates';
import {
  reconcileRow, buildWritePlan, planNetDelta,
  type LedgerMovement, type PriorCount, type ReconcileResult, type Attribution, type AttributionKind,
} from '../lib/reconcileMath';

interface LotRow {
  id: string;
  name: string;
  sku: string | null;
  size: string | null;
  qty: number;
  status: string;
}

interface UnknownScan {
  id: string;
  item_label: string;
  counted_qty: number;
  raw_scan: string | null;
  counted_at: string;
  session_id: string;
}

const ATTRIBUTION_LABEL: Record<AttributionKind, string> = {
  dead: 'Dead',
  loss: 'Lost / shrink',
  found: 'Found',
};

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Human phrasing for one movement kind in the evidence strip. Unknown kinds fall through to the
 *  raw kind rather than a guess — the ledger's `kind` has NO CHECK constraint by design (AC-4), so
 *  a vocabulary this map has not seen yet is expected, not an error. */
function evidencePhrase(kind: string, net: number, events: number): string {
  const n = Math.abs(net);
  const plural = (w: string) => `${n} ${w}`;
  switch (kind) {
    case 'sale':          return `${plural('sold')} — ${events} order${events === 1 ? '' : 's'}`;
    case 'sale_reversal': return `${plural('returned')} — ${events} order change${events === 1 ? '' : 's'}`;
    case 'receive':       return plural('received');
    case 'dead':          return plural('recorded dead');
    case 'loss':          return plural('recorded lost');
    case 'found':         return plural('recorded found');
    case 'adjust':        return `${plural('adjusted')} by hand`;
    case 'count_reconcile': return `${plural('moved')} by an earlier count`;
    default:              return `${net >= 0 ? '+' : ''}${net} ${kind}`;
  }
}

export function InventoryReconcile() {
  const { businessId } = useBusinessContext();
  const navigate = useNavigate();

  const [lots, setLots] = useState<LotRow[]>([]);
  const [committedByLot, setCommittedByLot] = useState<CommittedByLot>(new Map());
  const [priorByLot, setPriorByLot] = useState<Map<string, PriorCount>>(new Map());
  const [movementsByLot, setMovementsByLot] = useState<Map<string, LedgerMovement[]>>(new Map());
  const [unknowns, setUnknowns] = useState<UnknownScan[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  /** lotId → the counted number the owner typed, as raw text (so "" is distinguishable from 0). */
  const [countedText, setCountedText] = useState<Record<string, string>>({});
  /** The lot whose Accept sheet is open. */
  const [accepting, setAccepting] = useState<LotRow | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!businessId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function load() {
    setLoading(true);
    setError(null);

    // 1 — the lots. Archived rows are excluded: a tombstoned lot is not something you walk out
    //     and count, and offering to reconcile it would invite writing stock back onto a lot the
    //     owner deliberately retired.
    const { data: lotData, error: lotErr } = await supabase
      .from('business_inventory')
      .select('id,name,sku,size,qty,status')
      .eq('business_id', businessId)
      .neq('status', 'archived')
      .order('name', { ascending: true });
    if (lotErr) {
      console.error('[TRACE:RECONCILE] lot load FAILED', lotErr.message);
      setError(lotErr.message); setLoading(false); return;
    }
    const rows = (lotData ?? []) as LotRow[];
    setLots(rows);

    // 2 — committed, through the ONE D-52 derivation. The grid and the checkout oversell guard
    //     read committed the same way or they will eventually disagree (§6 r8).
    setCommittedByLot(await fetchCommittedByLot(supabase, businessId!));

    // 3 — the PRIOR count per lot, and the unresolved scans. One query serves both.
    const { data: countData, error: countErr } = await supabase
      .from('inventory_counts')
      .select('id,inventory_id,counted_qty,counted_at,was_unknown,item_label,raw_scan,session_id')
      .eq('business_id', businessId)
      .order('counted_at', { ascending: false });

    const priors = new Map<string, PriorCount>();
    if (countErr) {
      // The count tables are a GATED migration (20260626). Their absence must not blank the page:
      // with no prior counts every lot is BASELINE, which is exactly the correct reading of
      // "nobody has ever counted here" — and it is the demo path. Degraded, and SAID so.
      console.warn('[TRACE:RECONCILE] inventory_counts unreadable — every lot falls back to BASELINE (honest: no prior count is known)', countErr.message);
      setUnknowns([]);
    } else {
      const unknownRows: UnknownScan[] = [];
      for (const c of (countData ?? []) as Array<Record<string, unknown>>) {
        if (c.was_unknown) {
          unknownRows.push({
            id: String(c.id), item_label: String(c.item_label ?? 'Unrecognized scan'),
            counted_qty: Number(c.counted_qty ?? 0), raw_scan: (c.raw_scan as string) ?? null,
            counted_at: String(c.counted_at), session_id: String(c.session_id),
          });
          continue;
        }
        const lotId = c.inventory_id as string | null;
        // Ordered counted_at DESC, so the FIRST row seen for a lot is its most recent count.
        if (lotId && !priors.has(lotId)) {
          priors.set(lotId, { counted_qty: Number(c.counted_qty ?? 0), counted_at: String(c.counted_at) });
        }
      }
      setUnknowns(unknownRows);
    }
    setPriorByLot(priors);

    // 4 — the ledger window. ONE query bounded by the EARLIEST prior count, then split per lot by
    //     that lot's own count time (each lot has its own window). Reads BASE columns only —
    //     aggregate_type/event_type live in the still-GATED 20260720_ledger_event_store migration,
    //     and selecting a column that may not exist live would break the page on a deploy the
    //     owner has not applied. `kind` is the same fact and has been live since LAYER 1.
    const windows = [...priors.values()].map(p => p.counted_at).sort();
    const byLot = new Map<string, LedgerMovement[]>();
    if (windows.length > 0) {
      const { data: ledgerData, error: ledgerErr } = await supabase
        .from('business_inventory_ledger')
        .select('id,inventory_id,kind,delta,reason,source_type,source_id,actor_user_id,occurred_at')
        .eq('business_id', businessId)
        .gte('occurred_at', windows[0])
        .order('occurred_at', { ascending: true });
      if (ledgerErr) {
        console.error('[TRACE:RECONCILE] ledger window read FAILED — DELTA rows will show no evidence', ledgerErr.message);
        setError(`Couldn't read the movement ledger: ${ledgerErr.message}`);
      } else {
        for (const m of (ledgerData ?? []) as Array<Record<string, unknown>>) {
          const lotId = m.inventory_id as string | null;
          if (!lotId) continue;
          const prior = priors.get(lotId);
          if (!prior) continue;
          // STRICTLY AFTER the count: the count's OWN count_reconcile event is dated at the count
          // and must not be replayed as a movement since it, or every counted lot would show its
          // own reconciliation as unexplained drift.
          if (String(m.occurred_at) <= prior.counted_at) continue;
          const list = byLot.get(lotId) ?? [];
          list.push({
            id: String(m.id), kind: String(m.kind), delta: Number(m.delta ?? 0),
            occurred_at: String(m.occurred_at), reason: (m.reason as string) ?? null,
            source_type: (m.source_type as string) ?? null, source_id: (m.source_id as string) ?? null,
            actor_user_id: (m.actor_user_id as string) ?? null,
          });
          byLot.set(lotId, list);
        }
      }
    }
    setMovementsByLot(byLot);

    console.log('[TRACE:RECONCILE] load ok', {
      businessId, lots: rows.length,
      baseline: rows.filter(r => !priors.has(r.id)).length,
      delta: rows.filter(r => priors.has(r.id)).length,
      unresolvedScans: unknowns.length, lotsWithMovements: byLot.size,
    });
    setLoading(false);
  }

  /** The pure decision for one lot. Memoised per render pass over the whole set. */
  const resultFor = useCallback((lot: LotRow): ReconcileResult => {
    const raw = countedText[lot.id];
    const counted = raw === undefined || raw.trim() === '' ? null : Number(raw);
    return reconcileRow({
      bookOnHand: Number(lot.qty ?? 0),
      committed: committedByLot.get(lot.id) ?? 0,
      prior: priorByLot.get(lot.id) ?? null,
      movementsSincePrior: movementsByLot.get(lot.id) ?? [],
      counted: counted === null || !Number.isFinite(counted) ? null : counted,
    });
  }, [countedText, committedByLot, priorByLot, movementsByLot]);

  /** True when ANY lot in the set is in DELTA mode — drives whether the evidence column exists at
   *  all. On a fresh tenant every lot is BASELINE, so the column is ABSENT rather than empty: an
   *  empty "sold" column on the demo screen reads as a broken feature, not as a clean slate. */
  const anyDelta = useMemo(() => lots.some(l => priorByLot.has(l.id)), [lots, priorByLot]);

  const columns: DataSheetColumn<LotRow>[] = useMemo(() => {
    const cols: DataSheetColumn<LotRow>[] = [
      {
        key: 'name', header: 'Item', sortable: true, hideable: false, frozen: true, frozenWidth: 240,
        sortVal: r => r.name.toLowerCase(),
        render: r => (
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={SS.skuText}>{[r.size, r.sku].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        ),
      },
      {
        key: 'book', header: 'Book on-hand', sortable: true, sortVal: r => Number(r.qty ?? 0),
        render: r => <span style={{ fontWeight: 700 }}>{Number(r.qty ?? 0)}</span>,
      },
      {
        key: 'reserved', header: 'Reserved', sortable: true,
        sortVal: r => committedByLot.get(r.id) ?? 0,
        render: r => {
          const c = committedByLot.get(r.id) ?? 0;
          return <span style={{ ...SS.muted, fontWeight: c > 0 ? 700 : 400 }}>{c}</span>;
        },
      },
      {
        key: 'available', header: 'Available', sortable: true,
        sortVal: r => resultFor(r).available,
        render: r => <span style={SS.muted}>{resultFor(r).available}</span>,
      },
      {
        key: 'counted', header: 'Counted', hideable: false,
        render: r => (
          <input
            type="number" min={0} step={1} inputMode="numeric"
            value={countedText[r.id] ?? ''}
            placeholder="—"
            onChange={e => setCountedText(s => ({ ...s, [r.id]: e.target.value }))}
            style={{ ...ST.numInput, borderColor: countedText[r.id] ? '#27500A' : '#e5e7eb' }}
            aria-label={`Counted quantity for ${r.name}`}
          />
        ),
      },
      {
        key: 'math', header: 'The math', hideable: false,
        render: r => <MathCell lot={r} res={resultFor(r)} />,
      },
    ];

    if (anyDelta) {
      cols.splice(4, 0, {
        key: 'evidence', header: 'Since last count',
        render: r => {
          const res = resultFor(r);
          if (res.mode === 'baseline') return <span style={SS.muted}>—</span>;
          if (res.evidence.length === 0) return <span style={SS.muted}>no movement</span>;
          return (
            <span style={{ fontSize: '0.78rem', color: '#374151' }}>
              {res.evidence.map(e => evidencePhrase(e.kind, e.net, e.events)).join(' · ')}
            </span>
          );
        },
      });
    }
    return cols;
  }, [countedText, committedByLot, resultFor, anyDelta]);

  const pendingCount = lots.filter(l => (countedText[l.id] ?? '').trim() !== '').length;

  return (
    <div style={ST.page}>
      {flash && <div style={SS.success}>{flash}</div>}

      {unknowns.length > 0 && (
        <div style={ST.unknownCard}>
          <div style={ST.unknownHead}>
            <HelpCircle size={16} />
            <strong>{unknowns.length} unrecognized scan{unknowns.length === 1 ? '' : 's'} — resolve</strong>
          </div>
          <p style={ST.unknownBody}>
            These were counted in the lot but did not resolve to a known item, so no stock moved for them.
            They are shown here because nothing else reads them — but resolving one into a lot is not built
            yet, so there is deliberately no button that would appear to do it.
          </p>
          <ul style={ST.unknownList}>
            {unknowns.slice(0, 12).map(u => (
              <li key={u.id}>
                <strong>{u.item_label}</strong> — counted {u.counted_qty} · {fmtDateTime(u.counted_at)}
                {u.raw_scan && <span style={SS.muted}> · scanned “{u.raw_scan}”</span>}
              </li>
            ))}
          </ul>
          {unknowns.length > 12 && <div style={SS.muted}>…and {unknowns.length - 12} more.</div>}
        </div>
      )}

      <DataSheet<LotRow>
        title="Reconcile count"
        rows={lots}
        loading={loading}
        error={error}
        getRowId={r => r.id}
        columns={columns}
        searchText={r => [r.name, r.sku, r.size].filter(Boolean).join(' ')}
        searchPlaceholder="Search the lot you counted…"
        defaultSortKey="name"
        statusFilter={{ label: 'Status', options: ['available', 'reserved', 'depleted', 'damaged', 'returned'], get: r => r.status }}
        rowFlag={r => resultFor(r).varianceFlag || !resultFor(r).bookAgreesWithReplay}
        flagBanner={(inView, elsewhere) => (
          <span>
            <AlertTriangle size={14} style={{ verticalAlign: -2 }} />{' '}
            {inView > 0 && <>{inView} row{inView === 1 ? '' : 's'} here {inView === 1 ? 'has' : 'have'} a large gap between counted and book. </>}
            {elsewhere > 0 && <>{elsewhere} more {elsewhere === 1 ? 'is' : 'are'} outside this filter. </>}
            Nothing is written until you Accept.
          </span>
        )}
        rowActions={r => {
          const res = resultFor(r);
          const ready = res.residual !== null;
          return (
            <button
              onClick={() => setAccepting(r)}
              disabled={!ready}
              style={ready ? ST.acceptBtn : ST.acceptBtnDisabled}
              title={ready ? 'Review and stamp this count' : 'Enter a count first'}
            >
              <Check size={14} /> Accept
            </button>
          );
        }}
        rowActionsWidth={116}
        actions={
          <>
            <span style={SS.muted}>
              {pendingCount > 0 ? `${pendingCount} counted, not yet accepted` : 'Nothing entered yet'}
            </span>
            <button style={SS.addBtn} onClick={() => navigate('/inventory/count')}>
              <ScanLine size={16} /> Walk &amp; count
            </button>
          </>
        }
        emptyText="No inventory to reconcile yet."
        itemNoun="lots"
      />

      {accepting && (
        <AcceptSheet
          lot={accepting}
          res={resultFor(accepting)}
          committed={committedByLot.get(accepting.id) ?? 0}
          counted={Number(countedText[accepting.id])}
          businessId={businessId!}
          userId={userId}
          onClose={() => setAccepting(null)}
          onDone={(msg) => {
            setAccepting(null);
            setCountedText(s => { const n = { ...s }; delete n[accepting.id]; return n; });
            setFlash(msg);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ── The per-row math cell ───────────────────────────────────────────────────────────────────
function MathCell({ lot, res }: { lot: LotRow; res: ReconcileResult }) {
  if (res.residual === null) {
    return <span style={SS.muted}>{res.mode === 'baseline' ? 'first count' : 'counted before'}</span>;
  }
  const book = Number(lot.qty ?? 0);

  if (res.mode === 'baseline') {
    // Informational ONLY. There is no history to explain a first count against, so this states
    // the difference and asks for nothing (correction: the spec's own "no attribution required").
    return (
      <span style={{ fontSize: '0.8rem' }}>
        book was <strong>{book}</strong>, you counted <strong>{res.residual === 0 ? book : Number(book + res.residual)}</strong>
        {res.residual !== 0 && <span style={SS.muted}> ({res.residual > 0 ? '+' : ''}{res.residual})</span>}
      </span>
    );
  }

  return (
    <span style={{ fontSize: '0.8rem' }}>
      {res.residual === 0 ? (
        <span style={{ color: '#166534', fontWeight: 700 }}>agrees — done</span>
      ) : (
        <span style={{ color: res.varianceFlag ? '#b91c1c' : '#92400e', fontWeight: 700 }}>
          {res.residual > 0 ? '+' : ''}{res.residual} vs book
          {res.varianceFlag && <> ⚠</>}
        </span>
      )}
      {!res.bookAgreesWithReplay && (
        <div style={{ color: '#b91c1c', fontSize: '0.72rem' }}>
          ledger replay says {res.replayExpected} — book says {res.expected}
        </div>
      )}
    </span>
  );
}

// ── The Accept sheet: the ONLY thing that writes ────────────────────────────────────────────
function AcceptSheet(props: {
  lot: LotRow; res: ReconcileResult; committed: number; counted: number;
  businessId: string; userId: string | null;
  onClose: () => void; onDone: (msg: string) => void;
}) {
  const { lot, res, committed, counted, businessId, userId, onClose, onDone } = props;
  const [attr, setAttr] = useState<Record<AttributionKind, string>>({ dead: '', loss: '', found: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const attributions: Attribution[] = useMemo(
    () => (Object.entries(attr) as Array<[AttributionKind, string]>)
      .filter(([, v]) => v.trim() !== '')
      .map(([kind, v]) => ({ kind, qty: Number(v) })),
    [attr],
  );

  const plan = useMemo(
    () => buildWritePlan({ bookOnHand: Number(lot.qty ?? 0), counted, attributions, mode: res.mode, note: note.trim() || null }),
    [lot.qty, counted, attributions, res.mode, note],
  );

  const attributed = attributions.reduce((s, a) => s + (a.kind === 'found' ? a.qty : -a.qty), 0);
  const unexplained = (res.residual ?? 0) - attributed;

  async function accept() {
    if (!plan.ok) { setErr(plan.error); return; }
    if (!userId) { setErr('Confirming your sign-in — one moment, then try again.'); return; }
    setBusy(true); setErr(null);

    console.log('[TRACE:RECONCILE] accept — plan', {
      lot: lot.id, name: lot.name, mode: res.mode, book: lot.qty, counted,
      steps: plan.steps.map(s => `${s.kind} → ${s.newQty} (${s.delta >= 0 ? '+' : ''}${s.delta})`),
      netDelta: planNetDelta(plan.steps), actor: userId,
    });

    for (const step of plan.steps) {
      const { data, error } = step.rpc === 'adjust_inventory_manual'
        ? await supabase.rpc('adjust_inventory_manual', {
            p_lot_id: lot.id, p_business_id: businessId, p_new_qty: step.newQty,
            p_actor_user_id: userId, p_reason: step.reason, p_kind: step.kind,
          })
        : await supabase.rpc('count_reconcile_inventory', {
            p_lot_id: lot.id, p_business_id: businessId, p_counted_qty: step.newQty,
            p_actor_user_id: userId, p_size: null, p_reason: step.reason, p_source_id: null,
          });

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.applied) {
        // PARTIAL WRITE IS POSSIBLE and is stated plainly rather than hidden: earlier steps in this
        // plan already landed as permanent ledger rows and CANNOT be rolled back (that is the point
        // of an append-only log). The owner is told exactly where it stopped so the next accept
        // starts from a known place — a silent "failed" here would leave them guessing.
        const why = error?.message ?? row?.reason ?? 'refused';
        console.error('[TRACE:RECONCILE] accept — step FAILED', { lot: lot.id, step: step.kind, why });
        setErr(
          `Stopped at the "${step.kind}" step: ${why}. ` +
          `Any earlier step in this accept is already on the ledger and cannot be undone — ` +
          `re-open this lot to see where its on-hand now stands before counting again.`,
        );
        setBusy(false);
        return;
      }
      console.log('[TRACE:RECONCILE] accept — step ok', {
        lot: lot.id, kind: step.kind, newQty: row.new_qty, delta: row.delta, ledgerId: row.ledger_id,
      });
    }

    onDone(`${lot.name} stamped — on-hand is now ${counted}, recorded on the ledger.`);
  }

  const book = Number(lot.qty ?? 0);

  return (
    <div style={SS.modal} onClick={onClose}>
      <div style={SS.sheet} onClick={e => e.stopPropagation()}>
        <div style={SS.sheetHeader}>
          <h3 style={SS.sectionTitle}>
            {res.mode === 'baseline' ? 'Stamp first count' : 'Reconcile count'} — {lot.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {err && <div style={SS.error}>{err}</div>}

        <div style={ST.numbers}>
          <Num label="Book on-hand" value={book} />
          <Num label="Reserved" value={committed} muted />
          <Num label="Available" value={res.available} muted />
          <Num label="You counted" value={counted} strong />
        </div>

        {res.mode === 'delta' && (
          <div style={ST.evidenceBox}>
            <div style={ST.evidenceHead}>Since the last count</div>
            {res.evidence.length === 0
              ? <div style={SS.muted}>No recorded movement in this window.</div>
              : <ul style={ST.evidenceList}>
                  {res.evidence.map(e => <li key={e.kind}>{evidencePhrase(e.kind, e.net, e.events)}</li>)}
                </ul>}
            {!res.bookAgreesWithReplay && (
              <div style={{ ...SS.error, marginTop: 8 }}>
                The ledger replays to {res.replayExpected} but the book says {res.expected}. That gap is
                not something this count caused — surfacing it rather than absorbing it.
              </div>
            )}
          </div>
        )}

        {res.mode === 'baseline' ? (
          <p style={ST.explain}>
            Nothing has been counted here before, so there is no history to explain this against.
            The number you counted <strong>becomes</strong> on-hand, stamped with your name and the time.
          </p>
        ) : res.residual === 0 ? (
          <p style={ST.explain}>
            Counted and book agree. Accepting records that you checked — which is what closes the window.
          </p>
        ) : (
          <>
            <p style={ST.explain}>
              Counted is <strong>{res.residual! > 0 ? '+' : ''}{res.residual}</strong> against the book.
              Account for it where you can; whatever is left is recorded honestly as unexplained.
            </p>
            <div style={SS.row3}>
              {(['dead', 'loss', 'found'] as AttributionKind[]).map(k => (
                <div key={k} style={SS.field}>
                  <label style={SS.label} htmlFor={`attr-${k}`}>{ATTRIBUTION_LABEL[k]}</label>
                  <input
                    id={`attr-${k}`} type="number" min={1} step={1} inputMode="numeric"
                    value={attr[k]} placeholder="—"
                    onChange={e => setAttr(s => ({ ...s, [k]: e.target.value }))}
                    style={SS.input}
                  />
                </div>
              ))}
            </div>
            <div style={ST.remainder}>
              {unexplained === 0
                ? <span style={{ color: '#166534', fontWeight: 700 }}>Fully accounted for.</span>
                : <>Unexplained: <strong>{unexplained > 0 ? '+' : ''}{unexplained}</strong> — recorded as an unattributed count.</>}
            </div>
          </>
        )}

        <div style={SS.field}>
          <label style={SS.label} htmlFor="reconcile-note">Note (optional)</label>
          <input
            id="reconcile-note" style={SS.input} value={note} maxLength={200}
            onChange={e => setNote(e.target.value)}
            placeholder="What you saw — kept on the ledger permanently"
          />
        </div>

        {plan.ok && (
          <div style={ST.planBox}>
            <div style={ST.evidenceHead}>What Accept writes — permanently</div>
            <ul style={ST.evidenceList}>
              {plan.steps.map((s, i) => (
                <li key={i}>
                  <strong>{s.kind}</strong> — on-hand → {s.newQty} ({s.delta >= 0 ? '+' : ''}{s.delta})
                </li>
              ))}
            </ul>
            <div style={SS.muted}>These lines cannot be edited or deleted once written.</div>
          </div>
        )}
        {!plan.ok && <div style={SS.error}>{plan.error}</div>}

        <button
          onClick={() => void accept()}
          disabled={busy || !plan.ok}
          style={busy || !plan.ok ? SS.submitBtnDisabled : SS.submitBtn}
        >
          {busy ? 'Stamping…' : res.mode === 'baseline' ? 'Accept — stamp as on-hand' : 'Accept — record on the ledger'}
        </button>
      </div>
    </div>
  );
}

function Num({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return (
    <div style={ST.numCell}>
      <div style={ST.numLabel}>{label}</div>
      <div style={{ fontSize: strong ? '1.5rem' : '1.25rem', fontWeight: 700, color: muted ? '#6b7280' : '#1a2e0a' }}>{value}</div>
    </div>
  );
}

const ST = {
  page: { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  numInput: { width: 68, border: '2px solid #e5e7eb', borderRadius: 6, padding: '5px 7px', fontSize: '0.9rem', fontWeight: 700, color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  acceptBtn: { display: 'flex', alignItems: 'center', gap: 4, background: '#27500A', border: 'none', borderRadius: 6, padding: '0.35rem 0.6rem', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  acceptBtnDisabled: { display: 'flex', alignItems: 'center', gap: 4, background: '#e5e7eb', border: 'none', borderRadius: 6, padding: '0.35rem 0.6rem', color: '#9ca3af', fontSize: '0.78rem', fontWeight: 700, cursor: 'not-allowed' } as React.CSSProperties,
  unknownCard: { background: '#fff', border: '1px solid #fcd34d', borderLeft: '4px solid #f59e0b', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 16 } as React.CSSProperties,
  unknownHead: { display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontSize: '0.92rem', marginBottom: 6 } as React.CSSProperties,
  unknownBody: { margin: '0 0 8px', fontSize: '0.83rem', color: '#4b5563', lineHeight: 1.5 } as React.CSSProperties,
  unknownList: { margin: 0, paddingLeft: '1.1rem', fontSize: '0.83rem', color: '#374151', lineHeight: 1.7 } as React.CSSProperties,
  numbers: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 } as React.CSSProperties,
  numCell: { background: '#f9fafb', borderRadius: 10, padding: '0.6rem 0.75rem' } as React.CSSProperties,
  numLabel: { fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: 2 } as React.CSSProperties,
  evidenceBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: 14 } as React.CSSProperties,
  evidenceHead: { fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, marginBottom: 6 } as React.CSSProperties,
  evidenceList: { margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#374151', lineHeight: 1.7 } as React.CSSProperties,
  explain: { fontSize: '0.88rem', color: '#374151', lineHeight: 1.55, margin: '0 0 14px' } as React.CSSProperties,
  remainder: { fontSize: '0.85rem', color: '#374151', marginBottom: 14 } as React.CSSProperties,
  planBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: 14 } as React.CSSProperties,
};
