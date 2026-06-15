/**
 * ── COST-TO-PRODUCE CONFIG PANEL (shared, general) · THUNDER BUILD · 2026-06-14 ──
 *
 * PURPOSE
 *   The TUNE surface for Cost-to-Produce. A SectionCard the owner uses to enter and
 *   adjust the inputs the engine prices from: recurring cost lines, labor, overhead,
 *   margin policy, and the denominator (target-customer) sensitivity set. Saving writes
 *   the whole config to business_modules.config so the dashboard tile recomputes live.
 *   This is the "see-it-work-and-tune-it" loop, config half.
 *
 *   General capability (TILE-CLASSIFICATION.md): lives in shared, mounted into the shared
 *   Settings page verticalSection slot by each vertical. No vertical nouns (AC-1).
 *
 * DEPENDENCIES
 *   - ../supabase/client (business_modules read/write — member-scoped RLS)
 *   - ../context/BusinessProvider (businessId)
 *   - ../business-logic/CostToProduce (config types + EMPTY_COST_CONFIG default)
 *
 * OUTPUTS
 *   - Upserts one business_modules row (module_key='cost_to_produce', enabled=true,
 *     configured=true, config=<CostToProduceConfig JSON>). Reversible; no schema change.
 *
 * MULTI-LOCATION: this build edits a single default location (locations[0]) but persists
 *   inside the locations[] array, so the structure does not preclude N locations later.
 * SURFACE HONESTY: every cost line carries a confidence grade; UNKNOWN lines hold no
 *   amount and are stored as UNKNOWN — never written as 0.
 * CURRENCY (2026-06-14 punch-list FIX 2): money fields (labor rate, cost-line amount,
 *   overhead, reference price) display as $X.XX on blur via the local MoneyInput; the raw
 *   numeric string shows while focused so typing isn't fought. Stored values stay numeric
 *   (cents-rounded on blur) — this is display formatting only, not a data change.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext } from '../context/BusinessProvider';
import { EMPTY_COST_CONFIG } from '../business-logic/CostToProduce';
import type {
  CostToProduceConfig, CostLine, CostConfidence, CostPeriod, CostLocation,
} from '../business-logic/CostToProduce';

const MODULE_KEY = 'cost_to_produce';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';

const CONFIDENCE_OPTS: CostConfidence[] = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'];
const CONFIDENCE_COLOR: Record<CostConfidence, { bg: string; fg: string }> = {
  CONFIRMED: { bg: '#dcfce7', fg: '#166534' },
  DERIVED:   { bg: '#dbeafe', fg: '#1d4ed8' },
  ESTIMATED: { bg: '#fef9c3', fg: '#854d0e' },
  UNKNOWN:   { bg: '#fee2e2', fg: '#991b1b' },
};

const cell: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
  color: DARK, background: '#fff',
};

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

export function CostToProduceSettings() {
  const { businessId } = useBusinessContext();
  const [config, setConfig]   = useState<CostToProduceConfig>(() => deepClone(EMPTY_COST_CONFIG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Single editable location for this build (multi-location persisted but UI edits locations[0])
  const loc: CostLocation = config.locations[0] ?? deepClone(EMPTY_COST_CONFIG.locations[0]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('business_modules')
        .select('config')
        .eq('business_id', businessId)
        .eq('module_key', MODULE_KEY)
        .maybeSingle();
      if (cancelled) return;
      const stored = data?.config as CostToProduceConfig | undefined;
      if (stored && Array.isArray(stored.locations) && stored.locations.length) {
        setConfig(stored);
      } else {
        setConfig(deepClone(EMPTY_COST_CONFIG));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  // ── Mutators (work on a clone, then setConfig) ──
  function patchLoc(mut: (l: CostLocation) => void) {
    setConfig(prev => {
      const next = deepClone(prev);
      if (!next.locations.length) next.locations.push(deepClone(EMPTY_COST_CONFIG.locations[0]));
      mut(next.locations[0]);
      return next;
    });
  }
  function patchConfig(mut: (c: CostToProduceConfig) => void) {
    setConfig(prev => { const next = deepClone(prev); mut(next); return next; });
  }

  function addLine() {
    patchLoc(l => l.recurring.push({ label: '', amount: 0, period: 'monthly', confidence: 'ESTIMATED' }));
  }
  function removeLine(i: number) { patchLoc(l => l.recurring.splice(i, 1)); }
  function editLine(i: number, patch: Partial<CostLine>) {
    patchLoc(l => { l.recurring[i] = { ...l.recurring[i], ...patch }; });
  }

  async function save() {
    if (!businessId) return;
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('business_modules').upsert(
      { business_id: businessId, module_key: MODULE_KEY, enabled: true, configured: true, config },
      { onConflict: 'business_id,module_key' },
    );
    setSaving(false);
    if (error) setSaveMsg('Error: ' + error.message);
    else { setSaveMsg('Saved'); setTimeout(() => setSaveMsg(''), 2000); }
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <Heading />
        <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <Heading />
      <p style={{ fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5, margin: '0 0 16px' }}>
        Enter your real monthly costs. Mark each one's confidence honestly — <b>UNKNOWN</b> stays
        unknown (never counted as $0). The dashboard tile divides the loaded monthly cost by your
        target customers (N) and suggests a price at your margin. Tune anything here and the tile
        recomputes.
      </p>

      {/* ── Recurring cost lines ── */}
      <SubLabel>Recurring &amp; one-off costs</SubLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {loc.recurring.map((line, i) => {
          const cc = CONFIDENCE_COLOR[line.confidence];
          const isUnknown = line.confidence === 'UNKNOWN';
          return (
            <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={line.label}
                  onChange={e => editLine(i, { label: e.target.value })}
                  placeholder="Cost name (e.g. Claude Pro)"
                  style={{ ...cell, flex: 2 }}
                />
                <MoneyInput
                  value={isUnknown ? null : line.amount}
                  onChange={v => editLine(i, { amount: v })}
                  placeholder={isUnknown ? 'unknown' : '$0.00'}
                  disabled={isUnknown}
                  style={{ ...cell, flex: 1, background: isUnknown ? '#f3f4f6' : '#fff', color: isUnknown ? '#9ca3af' : DARK }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select value={line.period} onChange={e => editLine(i, { period: e.target.value as CostPeriod })} style={{ ...cell, flex: 1 }}>
                  <option value="monthly">per month</option>
                  <option value="annual">per year</option>
                </select>
                <select
                  value={line.confidence}
                  onChange={e => {
                    const conf = e.target.value as CostConfidence;
                    // Selecting UNKNOWN clears the amount (Surface Honesty — no fake number)
                    editLine(i, conf === 'UNKNOWN' ? { confidence: conf, amount: null } : { confidence: conf, amount: line.amount ?? 0 });
                  }}
                  style={{ ...cell, flex: 1, background: cc.bg, color: cc.fg, fontWeight: 700 }}
                >
                  {CONFIDENCE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => removeLine(i)} style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '8px 11px', color: RED, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>✕</button>
              </div>
              {line.note && (
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#b45309' }}>⚠ {line.note}</p>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={addLine} style={dashedBtn}>+ Add cost line</button>

      {/* ── Labor ── */}
      <SubLabel>Labor</SubLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <MoneyInput
          value={loc.labor.rate}
          onChange={v => patchLoc(l => { l.labor.rate = v; })}
          placeholder="rate $/hr"
          style={{ ...cell, flex: 1 }}
        />
        <input
          type="number" step="0.5"
          value={loc.labor.hours == null ? '' : String(loc.labor.hours)}
          onChange={e => patchLoc(l => { l.labor.hours = e.target.value === '' ? null : parseFloat(e.target.value); })}
          placeholder="hours"
          style={{ ...cell, flex: 1 }}
        />
        <select value={loc.labor.period} onChange={e => patchLoc(l => { l.labor.period = e.target.value as CostPeriod; })} style={{ ...cell, flex: 1 }}>
          <option value="monthly">hr / month</option>
          <option value="annual">hr / year</option>
        </select>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 12px' }}>
        Owner/family time at an owner-set rate (design §4.3). TRACE does the arithmetic; the rate is yours.
      </p>

      {/* ── Overhead per unit ── */}
      <SubLabel>Overhead per unit (optional)</SubLabel>
      <MoneyInput
        value={loc.overheadPerUnit ?? 0}
        onChange={v => patchLoc(l => { l.overheadPerUnit = v ?? 0; })}
        placeholder="$0.00"
        style={{ ...cell, width: '100%', marginBottom: 4 }}
      />
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 12px' }}>
        Per-product absorption (e.g. greenhouse overhead per plant). Leave 0 for the per-customer-month model.
      </p>

      {/* ── Margin policy ── */}
      <SubLabel>Margin policy</SubLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.8125rem', color: GRAY }}>Baseline margin</span>
        <input
          type="number" step="0.01" min="0" max="0.99"
          value={String(config.margin.baseline)}
          onChange={e => patchConfig(c => { c.margin.baseline = parseFloat(e.target.value) || 0; })}
          style={{ ...cell, width: 90 }}
        />
        <span style={{ fontSize: '0.8125rem', color: GRAY }}>({(config.margin.baseline * 100).toFixed(0)}%)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
        {config.margin.tiers.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              value={t.name}
              onChange={e => patchConfig(c => { c.margin.tiers[i].name = e.target.value; })}
              placeholder="tier name"
              style={{ ...cell, flex: 2 }}
            />
            <input
              type="number" step="0.01" min="0" max="0.99"
              value={String(t.marginOverride)}
              onChange={e => patchConfig(c => { c.margin.tiers[i].marginOverride = parseFloat(e.target.value) || 0; })}
              style={{ ...cell, flex: 1 }}
            />
            <span style={{ fontSize: '0.75rem', color: GRAY, width: 70 }}>
              {t.isDefault ? 'default' : `${(t.marginOverride * 100).toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 12px' }}>
        Per-tier margins are stored as policy for later use. The tile prices at the default tier's margin.
      </p>

      {/* ── Denominators + reference price ── */}
      <SubLabel>Target customers (sensitivity set)</SubLabel>
      <input
        value={config.denominators.join(', ')}
        onChange={e => patchConfig(c => {
          c.denominators = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
        })}
        placeholder="1, 5, 20, 100"
        style={{ ...cell, width: '100%', marginBottom: 4 }}
      />
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 12px' }}>
        The tunable knob. The tile shows cost &amp; price at each N. Unit: <b>{config.unitLabel}</b>.
      </p>

      <SubLabel>Reference price (optional)</SubLabel>
      <MoneyInput
        value={config.priceReference ?? null}
        onChange={v => patchConfig(c => { c.priceReference = v; })}
        placeholder="$149.00"
        style={{ ...cell, width: '100%', marginBottom: 16 }}
      />

      <button
        onClick={save} disabled={saving}
        style={{ width: '100%', padding: '13px 20px', background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer' }}
      >
        {saving ? 'Saving…' : 'Save Cost-to-Produce config'}
      </button>
      {saveMsg && (
        <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? RED : GREEN, marginTop: 8, textAlign: 'center' }}>{saveMsg}</p>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' };
const dashedBtn: React.CSSProperties = { marginBottom: 16, width: '100%', padding: '10px', borderRadius: 9, border: '1.5px dashed #d1d5db', cursor: 'pointer', background: 'transparent', color: GREEN, fontWeight: 700, fontSize: '0.8125rem' };

function Heading() {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
      Cost-to-Produce
    </p>
  );
}
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 8px' }}>
      {children}
    </p>
  );
}

/**
 * Money input (FIX 2): displays $X.XX when blurred, the raw numeric string while focused.
 * Stored value stays a number (cents-rounded on blur) — null when empty. Display-only format.
 */
function MoneyInput({
  value, onChange, placeholder, disabled, style,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : (value == null ? '' : `$${value.toFixed(2)}`);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => { setFocused(true); setText(value == null ? '' : String(value)); }}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9.\-]/g, '');
        setText(raw);
        const n = parseFloat(raw);
        onChange(raw === '' || !Number.isFinite(n) ? null : n);
      }}
      onBlur={() => {
        setFocused(false);
        if (value != null) onChange(Math.round(value * 100) / 100); // cents-round, no value change for clean inputs
      }}
      style={style}
    />
  );
}
