// ============================================================
// Discounts — the standalone admin surface for customer discount pricing (Cultivar OS)
// PURPOSE:      The owner's home for DISCOUNT TYPES × TIERS (relocated out of Cost-to-Produce
//               Block 5, THUNDER · 2026-07-10). An owner names a TYPE (e.g. "Contractor",
//               "Wholesale") and gives it N TIERS; each tier carries a pricing BASIS:
//                 • "% off retail" (retail_minus_percent) — a percent off the item's sell_price.
//                 • "At cost"      (at_cost)              — charge the item's unit_cost (margin 0).
//               Still FLAT + owner-managed (D-38): N tiers is structure, not auto-progression.
//               Optional access-terms text per tier is DESCRIPTIVE only (D-37 — never charged here).
// GATE:         WRITE (this screen) = manage_settings (owner in Cultivar today) — pricing authority.
//               The READ of the configured set is business-scoped, NOT owner-only, and lives in the
//               data layer (readPricingConfig + normalizeDiscountTypes) — relocating this SCREEN to
//               an admin route did NOT drag that read behind admin-only: the roster picker + checkout
//               still resolve tiers via the same unchanged data-layer call.
// STORAGE:      business_pricing_config.config.discountTypes (jsonb, additive — NO migration). Written
//               via mergePricingConfig (read-merge-write) so it can't clobber the cost keys or the AI
//               toggle that share the same blob. Legacy flat pricingTiers forward-migrate on read.
// INSTRUMENTATION (STD-003): `[TRACE:config]` on load + every type/tier add/edit/remove + basis set +
//               save + AI toggle. ON BY DEFAULT — standing owner instruction (do NOT comment out).
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Percent as PercentIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  readPricingConfig, mergePricingConfig, normalizeDiscountTypes, RETAIL_TIER_NAME,
  type DiscountType, type DiscountTier, type DiscountBasis,
} from '@trace/shared/business-logic';

const GREEN = '#27500A';
const DARK  = '#111827';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';

// FIX 5 pattern (Settings/BusinessInventory errBorder/FieldError) — a bad field BLOCKS the save,
// red-borders the input, and says why; never a silent greyed button.
function errBorder(hasErr: boolean): React.CSSProperties {
  return hasErr ? { borderColor: RED, boxShadow: `0 0 0 1px ${RED}` } : {};
}
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: RED }}>{msg}</p>;
}

// Suggestion palette — DATA keyed off business_type (the AC-1-sanctioned axis, NOT a code branch).
// Values are suggested TYPE names the owner can accept or ignore; "+ Custom" always adds any name.
// A new vertical adds a row here (data), never a code path.
const TYPE_SUGGESTIONS: Record<string, string[]> = {
  nursery:  ['Contractor', 'Wholesale', 'Landscaper', 'Municipality'],
  general:  ['Contractor', 'Wholesale', 'Reseller', 'Friends & Family'],
  diesel:   ['Fleet', 'Contractor', 'Wholesale'],
  auto:     ['Fleet', 'Contractor', 'Wholesale'],
};
const DEFAULT_PALETTE = ['Contractor', 'Wholesale', 'Reseller', 'Friends & Family'];

const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '9px 11px', border: '1.5px solid #d1d5db', borderRadius: 8,
  fontSize: '0.875rem', background: '#fff', color: DARK,
};
const chip: React.CSSProperties = {
  padding: '6px 12px', border: `1.5px solid ${GREEN}`, borderRadius: 999, background: '#fff',
  color: GREEN, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
};
const card: React.CSSProperties = {
  border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16, background: '#fafafa',
};

export function Discounts() {
  const { businessId, business } = useBusinessContext();

  const [types, setTypes] = useState<DiscountType[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  // Percent buffers keyed `${typeIdx}-${tierIdx}` — smooth typing, parsed + validated on save.
  const [pctText, setPctText] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  const palette = TYPE_SUGGESTIONS[business?.business_type ?? ''] ?? DEFAULT_PALETTE;

  const seedPctText = useCallback((ts: DiscountType[]) => {
    const m: Record<string, string> = {};
    ts.forEach((ty, i) => ty.tiers.forEach((ti, j) => { m[`${i}-${j}`] = String(ti.discountPercent); }));
    setPctText(m);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await readPricingConfig(supabase, businessId);
      if (cancelled) return;
      const cfg = (data?.config ?? {}) as Record<string, unknown>;
      const loaded = normalizeDiscountTypes(cfg);
      setTypes(loaded);
      seedPctText(loaded);
      setAiEnabled(cfg.aiBiEnabled === true);
      setErrors({});
      setLoading(false);
      console.log('[TRACE:config] discounts load', { businessId, typeCount: loaded.length, aiEnabled: cfg.aiBiEnabled === true });
    })();
    return () => { cancelled = true; };
  }, [businessId, seedPctText]);

  // ── structural mutations (local state until Save) ──
  function addType(name: string) {
    console.log('[TRACE:config] add discount type', { name });
    setTypes(ts => [...ts, { name, tiers: [{ name: `${name} tier 1`, basis: 'retail_minus_percent', discountPercent: 0 }] }]);
    setSaveMsg('');
  }
  function renameType(i: number, name: string) {
    setTypes(ts => ts.map((t, idx) => idx === i ? { ...t, name } : t));
  }
  function removeType(i: number) {
    const t = types[i];
    if (!window.confirm(`Remove the "${t.name}" discount type and its ${t.tiers.length} tier(s)? Customers on those tiers revert to retail (full price) at checkout.`)) return;
    console.log('[TRACE:config] remove discount type', { name: t.name });
    setTypes(ts => ts.filter((_, idx) => idx !== i));
    setSaveMsg('');
  }
  function addTier(i: number) {
    console.log('[TRACE:config] add tier', { type: types[i]?.name });
    setTypes(ts => ts.map((t, idx) => idx === i ? { ...t, tiers: [...t.tiers, { name: `${t.name} tier ${t.tiers.length + 1}`, basis: 'retail_minus_percent', discountPercent: 0 }] } : t));
    setSaveMsg('');
  }
  function editTier(i: number, j: number, patch: Partial<DiscountTier>) {
    if (patch.basis) console.log('[TRACE:config] set tier basis', { type: types[i]?.name, tier: types[i]?.tiers[j]?.name, basis: patch.basis });
    setTypes(ts => ts.map((t, idx) => idx !== i ? t : { ...t, tiers: t.tiers.map((ti, jdx) => jdx === j ? { ...ti, ...patch } : ti) }));
  }
  async function removeTier(i: number, j: number) {
    const tier = types[i].tiers[j];
    // WARN-BEFORE-REMOVE if the tier is assigned to any customer (an owner-RLS read on customers —
    // NOT a new endpoint). Removing the tier reverts those customers to retail at checkout.
    let assigned = 0;
    if (businessId) {
      const { count } = await supabase.from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('price_tier', tier.name);
      assigned = count ?? 0;
    }
    if (assigned > 0 && !window.confirm(`${assigned} customer(s) are assigned the "${tier.name}" tier. Removing it reverts them to retail (full price) at checkout. Remove anyway?`)) return;
    console.log('[TRACE:config] remove tier', { type: types[i]?.name, tier: tier.name, assigned });
    setTypes(ts => ts.map((t, idx) => idx !== i ? t : { ...t, tiers: t.tiers.filter((_, jdx) => jdx !== j) }));
    setSaveMsg('');
  }

  async function toggleAi(next: boolean) {
    if (!businessId) return;
    setAiEnabled(next); // optimistic
    console.log('[TRACE:config] AI advisory toggle', { aiEnabled: next });
    const { error } = await mergePricingConfig(supabase, businessId, { aiBiEnabled: next });
    if (error) { setAiEnabled(!next); setSaveMsg('Error saving AI setting: ' + error.message); }
  }

  // ── validate + save ──
  function validate(): { errs: Record<string, string>; clean: DiscountType[] } {
    const errs: Record<string, string> = {};
    const seen = new Map<string, string>(); // lower tier name → where first seen
    const clean: DiscountType[] = types.map((ty, i) => {
      if (!ty.name.trim()) errs[`type-${i}`] = 'Name this discount type.';
      const tiers: DiscountTier[] = ty.tiers.map((ti, j) => {
        const key = `${i}-${j}`;
        const nm = ti.name.trim();
        if (!nm) errs[`tier-${key}`] = 'Name this tier.';
        else if (nm.toLowerCase() === RETAIL_TIER_NAME) errs[`tier-${key}`] = '"retail" is reserved (it is the full-price floor).';
        else if (seen.has(nm.toLowerCase())) errs[`tier-${key}`] = 'Tier names must be unique across all types.';
        else seen.set(nm.toLowerCase(), key);
        let pct = 0;
        if (ti.basis === 'retail_minus_percent') {
          const raw = (pctText[key] ?? String(ti.discountPercent)).trim();
          if (raw === '') errs[`pct-${key}`] = 'Enter a percent — 0 for no discount.';
          else {
            const n = Number(raw);
            if (!Number.isFinite(n)) errs[`pct-${key}`] = 'Must be a number.';
            else if (n < 0 || n > 100) errs[`pct-${key}`] = 'Must be between 0 and 100.';
            else pct = n;
          }
        }
        const out: DiscountTier = { name: nm, basis: ti.basis, discountPercent: pct };
        if (ti.accessTerms && ti.accessTerms.trim()) out.accessTerms = ti.accessTerms.trim();
        return out;
      });
      return { name: ty.name.trim(), tiers };
    });
    return { errs, clean };
  }

  async function save() {
    if (!businessId) return;
    const { errs, clean } = validate();
    if (Object.keys(errs).length) { setErrors(errs); setSaveMsg('Fix the highlighted fields.'); return; }
    setErrors({});
    setSaving(true); setSaveMsg('');
    const { error } = await mergePricingConfig(supabase, businessId, { discountTypes: clean });
    setSaving(false);
    if (error) { setSaveMsg('Error: ' + error.message); return; }
    console.log('[TRACE:config] discounts save OK', { typeCount: clean.length, tierCount: clean.reduce((n, t) => n + t.tiers.length, 0) });
    setTypes(clean); seedPctText(clean);
    setSaveMsg('Saved');
  }

  if (loading) return <div style={{ maxWidth: 760, margin: '0 auto', padding: 24, color: GRAY }}>Loading discounts…</div>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <PercentIcon size={22} color={GREEN} />
        <h1 style={{ margin: 0, fontSize: '1.375rem', color: DARK }}>Discount types</h1>
      </div>
      <p style={{ margin: '0 0 20px', color: GRAY, fontSize: '0.875rem', lineHeight: 1.5 }}>
        Name a discount type and give it tiers. Each tier is either a <b>percent off retail</b> or priced <b>at cost</b>.
        Tag a customer's tier on the Customers page — the discount comes off automatically at checkout. You set every
        number; nothing is applied on its own.
      </p>

      {/* Retail floor — implicit, always available, never a discount. Shown for clarity (non-editable). */}
      <div style={{ ...card, background: '#f3f4f6' }}>
        <div style={{ fontWeight: 700, color: DARK }}>Retail — full price</div>
        <div style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 2 }}>
          The default for every customer. Always available, always full sell price — it can't be removed.
        </div>
      </div>

      {types.map((ty, i) => (
        <div key={i} style={card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Discount type</label>
              <input value={ty.name} onChange={e => renameType(i, e.target.value)} placeholder="e.g. Contractor"
                style={{ ...input, width: '100%', fontWeight: 700, ...errBorder(!!errors[`type-${i}`]) }} />
              <FieldError msg={errors[`type-${i}`]} />
            </div>
            <button onClick={() => removeType(i)} title="Remove type"
              style={{ marginTop: 22, background: '#fef2f2', border: 'none', borderRadius: 8, padding: '9px 10px', color: RED, cursor: 'pointer' }}>
              <Trash2 size={16} />
            </button>
          </div>

          {ty.tiers.map((ti, j) => {
            const key = `${i}-${j}`;
            return (
              <div key={j} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={lbl}>Tier name</label>
                    <input value={ti.name} onChange={e => editTier(i, j, { name: e.target.value })} placeholder="e.g. Tier 1"
                      style={{ ...input, width: '100%', ...errBorder(!!errors[`tier-${key}`]) }} />
                    <FieldError msg={errors[`tier-${key}`]} />
                  </div>
                  <div style={{ flex: '0 0 150px' }}>
                    <label style={lbl}>Pricing basis</label>
                    <select value={ti.basis} onChange={e => editTier(i, j, { basis: e.target.value as DiscountBasis })}
                      style={{ ...input, width: '100%' }}>
                      <option value="retail_minus_percent">% off retail</option>
                      <option value="at_cost">At cost</option>
                    </select>
                  </div>
                  {ti.basis === 'retail_minus_percent' && (
                    <div style={{ flex: '0 0 120px' }}>
                      <label style={lbl}>Percent off</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" step="1" min="0" max="100"
                          value={pctText[key] ?? String(ti.discountPercent)}
                          onChange={e => setPctText(m => ({ ...m, [key]: e.target.value }))}
                          style={{ ...input, width: 76, ...errBorder(!!errors[`pct-${key}`]) }} />
                        <span style={{ color: GRAY, fontSize: '0.8125rem' }}>%</span>
                      </div>
                      <FieldError msg={errors[`pct-${key}`]} />
                    </div>
                  )}
                  {ti.basis === 'at_cost' && (
                    <div style={{ flex: '0 0 auto', alignSelf: 'center', marginTop: 18, color: GRAY, fontSize: '0.8125rem', fontStyle: 'italic' }}>
                      charges the item's unit cost
                    </div>
                  )}
                  <button onClick={() => { void removeTier(i, j); }} title="Remove tier"
                    style={{ marginTop: 20, background: 'none', border: 'none', color: RED, cursor: 'pointer' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label style={lbl}>Access terms (optional)</label>
                  <input value={ti.accessTerms ?? ''} onChange={e => editTier(i, j, { accessTerms: e.target.value })}
                    placeholder="e.g. $25/yr membership — descriptive only, never charged here"
                    style={{ ...input, width: '100%' }} />
                </div>
              </div>
            );
          })}

          <button onClick={() => addTier(i)}
            style={{ marginTop: 12, background: '#fff', border: `1.5px dashed ${GREEN}`, color: GREEN, borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
            <Plus size={14} style={{ verticalAlign: -2 }} /> Add tier
          </button>
        </div>
      ))}

      {/* Add discount type — business_type-seeded suggestion chips + always a custom name. */}
      <div style={{ ...card, background: '#fff' }}>
        <div style={{ fontWeight: 700, color: DARK, marginBottom: 8 }}>Add a discount type</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {palette.filter(p => !types.some(t => t.name.toLowerCase() === p.toLowerCase())).map(p => (
            <button key={p} style={chip} onClick={() => addType(p)}><Plus size={13} style={{ verticalAlign: -2 }} /> {p}</button>
          ))}
          {!customOpen && <button style={{ ...chip, borderStyle: 'dashed' }} onClick={() => setCustomOpen(true)}>+ Custom</button>}
        </div>
        {customOpen && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="New type name"
              style={{ ...input, flex: 1 }} onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) { addType(customName.trim()); setCustomName(''); setCustomOpen(false); } }} />
            <button style={chip} disabled={!customName.trim()} onClick={() => { if (customName.trim()) { addType(customName.trim()); setCustomName(''); setCustomOpen(false); } }}>Add</button>
          </div>
        )}
      </div>

      <button onClick={() => { void save(); }} disabled={saving}
        style={{ width: '100%', padding: '13px 20px', background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer', marginTop: 4 }}>
        {saving ? 'Saving…' : 'Save discounts'}
      </button>
      {saveMsg && <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') || saveMsg.startsWith('Fix') ? RED : GREEN, marginTop: 8, textAlign: 'center' }}>{saveMsg}</p>}

      {/* AI advisory toggle — owner setting (rides config.aiBiEnabled, default OFF). When ON, a
          PLACEHOLDER spend-based suggestion surfaces on the Customers page for the owner to act on
          or ignore. It never assigns, promotes, or changes a price (D-38 advisory-only). */}
      <div style={{ ...card, marginTop: 24, background: '#fff' }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={aiEnabled} onChange={e => { void toggleAi(e.target.checked); }} style={{ marginTop: 3, width: 18, height: 18 }} />
          <span>
            <span style={{ fontWeight: 700, color: DARK }}>Spend-based tier suggestions (advisory)</span>
            <span style={{ display: 'block', fontSize: '0.8125rem', color: GRAY, marginTop: 2, lineHeight: 1.5 }}>
              When on, the Customers page may suggest that a customer's order history could fit a discount tier.
              It's only a suggestion for you to act on or ignore — it never assigns a tier or changes a price.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 };
