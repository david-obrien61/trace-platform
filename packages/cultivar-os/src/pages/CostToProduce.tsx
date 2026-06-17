/**
 * ── COST-TO-PRODUCE DETAIL PAGE (/costs) · THUNDER BUILD · 2026-06-14 ────────────
 *
 * PURPOSE
 *   The SEE-IT surface for Cost-to-Produce. Reads the saved config
 *   (business_modules.config, module_key='cost_to_produce') plus material costs from
 *   business_inventory, runs the shared CostToProduce engine (MarginEngine-fed), and
 *   shows the loaded monthly cost ÷ N → per-unit cost → suggested price as a
 *   confidence-aware RANGE. Recomputes whenever the owner re-saves config in Settings.
 *
 * DEPENDENCIES
 *   - ../lib/supabase (business_modules + business_inventory + cost_objects reads)
 *   - @trace/shared/context (businessId)
 *   - @trace/shared/business-logic CostToProduce.analyze (period-pool + sensitivity)
 *   - @trace/shared/business-logic fromCostObject (real cost_objects rows → CostEvents)
 *
 * SUB-3 SEAM FEED (Core-2b, 2026-06-15): when the cost_objects table exists and has rows,
 *   this page feeds the captured objects' events into analyze() via { rollupEvents }, where
 *   the count-once seam reconciles them with the typed config — CAPEX excluded from the ÷N
 *   pool, cross-source duplicates counted once. DEFENSIVE: the cost_objects migration is
 *   gated/unapplied; a relation error or no rows → rollupEvents=[] → the proven config-only
 *   path (zero change to the live tile until the migration is applied + data captured).
 *
 * OUTPUTS
 *   - Read-only display: confidence mix (confirmed floor + estimated + UNKNOWN list),
 *     captured-capital (one-time, excluded) + flagged-duplicates panel when seam-fed,
 *     sensitivity table (one row per N), material-cost confidence panel. No DB writes.
 *
 * SURFACE HONESTY
 *   - UNKNOWN costs are listed, never folded into $0. If there is no solid floor, the
 *     page shows a LABELED "not enough confirmed cost to compute" state — never a fake price.
 *
 * INSTRUMENTATION (STD-003, added 2026-06-15): emits one `[TRACE:COST] tile load` line per
 *   view (config found? · inventory rows · unknown count); the shared engine emits the paired
 *   `[TRACE:COST] compute` line. ON BY DEFAULT — comment out only after David owner-proves
 *   the tile through the UI; do not delete.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { analyze, EMPTY_COST_CONFIG, fromCostObject } from '@trace/shared/business-logic';
import type { CostToProduceConfig, CostToProduceResult, CostObjectNodeRow, CostEvent } from '@trace/shared/business-logic';
import { ProjectCostTree } from '../components/ProjectCostTree';

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';
const AMBER = '#b45309';

const money = (n: number) => `$${n.toFixed(2)}`;

interface InventoryRow { name: string; unit_cost: number | null; cost_confidence: string | null; }

export function CostToProduce() {
  const navigate = useNavigate();
  const { businessId, business } = useBusinessContext();

  const [result, setResult]   = useState<CostToProduceResult | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [modRes, invRes] = await Promise.all([
        supabase.from('business_modules').select('config').eq('business_id', businessId).eq('module_key', 'cost_to_produce').maybeSingle(),
        supabase.from('business_inventory').select('name, unit_cost, cost_confidence').eq('business_id', businessId),
      ]);
      if (cancelled) return;

      const stored = modRes.data?.config as CostToProduceConfig | undefined;
      const cfg = stored && Array.isArray(stored.locations) && stored.locations.length ? stored : null;
      setHasConfig(!!cfg);

      const inv = (invRes.data ?? []) as InventoryRow[];
      setInventory(inv);
      // Fold inventory rows with UNKNOWN cost into the engine's unknown count (Surface Honesty)
      const unknownInv = inv.filter(r => (r.cost_confidence ?? '').toUpperCase() === 'UNKNOWN' || r.unit_cost == null).map(r => `Inventory: ${r.name}`);

      // SUB-3 — feed REAL captured cost_objects into the period-pool tile THROUGH the seam.
      // DEFENSIVE: the cost_objects migration (20260615) is gated/unapplied. If the table is
      // absent (relation error) or empty, rollupEvents = [] → analyze() falls back to the
      // proven config-only path (zero change to the live tile). When David applies the
      // migration + captures objects, this lights up automatically — no code change.
      // The DB column is `name` (not `label`) and there is no conversion_cost/vendor/receipt
      // column yet, so we map name→label and let fromCostObject default the rest.
      let rollupEvents: CostEvent[] = [];
      let hasMigratedRecurring = false;
      const objRes = await supabase
        .from('cost_objects')
        .select('id,name,node_type,domain,acquisition_cost,cost_confidence,status,cost_shape,cadence,recurring_amount')
        .eq('business_id', businessId);
      if (!cancelled && !objRes.error && Array.isArray(objRes.data) && objRes.data.length) {
        rollupEvents = (objRes.data as Array<Record<string, unknown>>)
          // FIX 2 (2026-06-17): PROJECT/PRODUCT rows are BUCKETS, not costs — a bucket with a
          // null amount used to surface here as a phantom "unquantified cost" (CoolRunnings,
          // Farm). Feed only actual cost nodes (ASSET/COST) so the unknown list matches the
          // one honest definition used by the by-project tree. No dollar figure changes — a
          // null-amount bucket contributed $0; this only stops it inflating the unknown count.
          .filter((r) => r.node_type === 'ASSET' || r.node_type === 'COST')
          .flatMap((r) =>
          fromCostObject({
            id: String(r.id),
            label: String(r.name ?? 'Unnamed cost object'),
            node_type: (r.node_type as CostObjectNodeRow['node_type']) ?? 'ASSET',
            domain: (r.domain as string | null) ?? null,
            acquisition_cost: (r.acquisition_cost as number | null) ?? null,
            cost_confidence: (r.cost_confidence as CostObjectNodeRow['cost_confidence']) ?? 'UNKNOWN',
            status: (r.status as string | null) ?? null,
            // STEP 6 FLIP (2026-06-17): the shape columns now drive bucketing — RECURRING_FIXED
            // COST rows feed the monthly pool via fromCostObject (the migrated recurring costs).
            cost_shape: (r.cost_shape as CostObjectNodeRow['cost_shape']) ?? null,
            cadence: (r.cadence as CostObjectNodeRow['cadence']) ?? null,
            recurring_amount: (r.recurring_amount as number | null) ?? null,
          }),
        );
        // Recurring costs now live as cost_objects (node_type='COST'). When ANY exist for this
        // business they are the source of truth for the monthly pool, so we STOP counting
        // config.recurring[] (no R2 double-count). SAFE FALLBACK (R1 guard): a tenant with NO
        // migrated COST rows keeps its config.recurring[] (legacy path, byte-identical) — the
        // flip never zeroes an un-migrated tenant.
        hasMigratedRecurring = (objRes.data as Array<Record<string, unknown>>).some((r) => r.node_type === 'COST');
      }

      // The config the engine prices from. Labor / margin / denominators STAY in config (R3).
      // Only recurring[] is dropped, and only once cost_objects supplies it — so the pool is
      // fed from exactly one source.
      const baseCfg = cfg ?? EMPTY_COST_CONFIG;
      const pricingCfg: CostToProduceConfig = hasMigratedRecurring
        ? { ...baseCfg, locations: baseCfg.locations.map((l) => ({ ...l, recurring: [] })) }
        : baseCfg;

      // [TRACE:COST] (STD-003) — tile load: what the SEE-IT surface read before computing.
      // The engine then emits its own `[TRACE:COST] compute` line from analyze().
      console.log('[TRACE:COST] tile load', {
        businessId,
        hasConfig: !!cfg,
        inventoryRows: inv.length,
        unknownInventory: unknownInv.length,
        costObjects: objRes.error ? `unavailable (${objRes.error.code ?? 'err'})` : (objRes.data?.length ?? 0),
        rollupEvents: rollupEvents.length,
        flippedToCostObjects: hasMigratedRecurring, // STEP 6: recurring sourced from cost_objects
        configRecurringCounted: !hasMigratedRecurring,
      });

      setResult(analyze(pricingCfg, unknownInv, { rollupEvents }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>{business?.name}</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={18} /> Cost to Produce
          </h1>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && <p style={{ color: GRAY }}>Loading…</p>}

        {!loading && !hasConfig && (
          <Card>
            <EmptyState
              title="Not configured yet"
              body="Add your recurring costs, labor, margin, and target customers in Settings → Cost-to-Produce. Once saved, this page computes your loaded cost and a suggested price."
              cta={() => navigate('/settings')}
            />
          </Card>
        )}

        {!loading && hasConfig && result && (
          <>
            {/* Confidence mix */}
            <Card>
              <SectionTitle>What we know — honestly</SectionTitle>
              <Row label="Confirmed + derived (floor)" value={`${money(result.confidence.floorMonthly)}/mo`} strong />
              {result.confidence.estimatedMonthly > 0 && (
                <Row label="Estimated (soft)" value={`+ ${money(result.confidence.estimatedMonthly)}/mo`} />
              )}
              <Row label="Known monthly cost" value={`${money(result.confidence.knownMonthly)}/mo`} strong />
              {result.confidence.hasUnknown && (
                <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: AMBER, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> {result.confidence.unknownCount} unquantified cost{result.confidence.unknownCount === 1 ? '' : 's'} — your real cost is higher
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: AMBER, lineHeight: 1.5 }}>
                    {result.confidence.unknownLabels.join(' · ')}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#9a6a2c' }}>
                    These are shown as unknown, never counted as $0.
                  </p>
                </div>
              )}
              {/* SUB-3 — captured cost_objects fed through the count-once seam. */}
              {result.confidence.fedFromRollup && (
                <div style={{ marginTop: 12, background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 12px' }}>
                  {(result.confidence.capexExcluded ?? 0) > 0 && (
                    <Row label="Captured capital (one-time)" value={`${money(result.confidence.capexExcluded ?? 0)}`} />
                  )}
                  <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#1e40af', lineHeight: 1.5 }}>
                    From your captured assets/receipts. One-time capital is excluded from the monthly cost above — it does not inflate your per-customer price.
                  </p>
                  {(result.confidence.possibleDuplicateCount ?? 0) > 0 && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#1e40af' }}>
                      {result.confidence.possibleDuplicateCount} possible duplicate{result.confidence.possibleDuplicateCount === 1 ? '' : 's'} flagged for review — counted once, never silently doubled.
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Sensitivity */}
            <Card>
              <SectionTitle>Cost &amp; price by target customers (N)</SectionTitle>
              {!result.confidence.computable ? (
                <p style={{ fontSize: '0.875rem', color: AMBER, lineHeight: 1.5 }}>
                  Not enough confirmed cost to compute a price yet. Add at least one CONFIRMED or DERIVED
                  cost line in Settings.
                </p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: GRAY }}>
                          <th style={th}>N</th>
                          <th style={th}>Cost / {result.unitLabel}</th>
                          <th style={th}>Suggested price</th>
                          <th style={th}>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.sensitivity.map(s => {
                          const showRange = s.costKnown !== s.costFloor;
                          return (
                            <tr key={s.n} style={{ borderTop: '1px solid #f0f0f0' }}>
                              <td style={{ ...td, fontWeight: 700, color: GREEN }}>{s.n}</td>
                              <td style={td}>{showRange ? `${money(s.costFloor)}–${money(s.costKnown)}` : money(s.costKnown)}</td>
                              <td style={{ ...td, fontWeight: 700, color: DARK }}>{showRange ? `${money(s.priceFloor)}–${money(s.priceKnown)}` : money(s.priceKnown)}</td>
                              <td style={{ ...td, color: GRAY }}>{s.marginPct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: GRAY, lineHeight: 1.5 }}>
                    Loaded monthly cost ÷ N, priced at your {Math.round(result.baselineMargin * 100)}% baseline margin
                    (via the shared MarginEngine).
                    {result.priceReference != null && (
                      <> Reference price: <b>{money(result.priceReference)}</b>.</>
                    )}
                  </p>
                </>
              )}
            </Card>

            {/* Material / inventory costs */}
            <Card>
              <SectionTitle>Material costs (inventory)</SectionTitle>
              {inventory.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No inventory rows recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {inventory.map((r, i) => {
                    const conf = (r.cost_confidence ?? 'UNKNOWN').toUpperCase();
                    const unknown = conf === 'UNKNOWN' || r.unit_cost == null;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', padding: '6px 0', borderTop: i ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ color: DARK }}>{r.name}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: unknown ? AMBER : DARK, fontWeight: 600 }}>{unknown ? 'unknown' : money(r.unit_cost as number)}</span>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: unknown ? '#fee2e2' : '#dcfce7', color: unknown ? '#991b1b' : '#166534' }}>{conf}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <button onClick={() => navigate('/settings')} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1.5px solid ${GREEN}`, background: '#fff', color: GREEN, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              Tune costs in Settings →
            </button>
          </>
        )}

        {/* D-10 — the "By project" lens. ADDED below the flat company top-line (not a
            substitute). Reads captured cost_objects directly, so it shows even before the
            cost-to-produce config is set. */}
        {!loading && businessId && (
          <ProjectCostTree businessId={businessId} businessName={business?.name} />
        )}
      </div>
    </div>
  );
}

// ── presentational helpers ──
const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '8px' };

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>{children}</p>;
}
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ fontSize: '0.875rem', color: strong ? DARK : GRAY, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: '0.9375rem', color: strong ? GREEN : DARK, fontWeight: strong ? 800 : 600 }}>{value}</span>
    </div>
  );
}
function EmptyState({ title, body, cta }: { title: string; body: string; cta: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <Calculator size={32} color={GRAY} style={{ marginBottom: 10 }} />
      <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: DARK }}>{title}</p>
      <p style={{ margin: '6px 0 14px', fontSize: '0.875rem', color: GRAY, lineHeight: 1.5 }}>{body}</p>
      <button onClick={cta} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
        Configure in Settings
      </button>
    </div>
  );
}
