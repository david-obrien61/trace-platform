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
 *   - ../lib/supabase (business_modules + business_inventory reads)
 *   - @trace/shared/context (businessId)
 *   - @trace/shared/business-logic CostToProduce.analyze (period-pool + sensitivity)
 *
 * OUTPUTS
 *   - Read-only display: confidence mix (confirmed floor + estimated + UNKNOWN list),
 *     sensitivity table (one row per N), material-cost confidence panel. No DB writes.
 *
 * SURFACE HONESTY
 *   - UNKNOWN costs are listed, never folded into $0. If there is no solid floor, the
 *     page shows a LABELED "not enough confirmed cost to compute" state — never a fake price.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { analyze, EMPTY_COST_CONFIG } from '@trace/shared/business-logic';
import type { CostToProduceConfig, CostToProduceResult } from '@trace/shared/business-logic';

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

      setResult(analyze(cfg ?? EMPTY_COST_CONFIG, unknownInv));
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
