/**
 * FILE: IgnitionProt.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Financial Settings UI for Margins, Labor Rates, and Operational Overhead.
 */

import React, { useState, useEffect } from 'react';
import { Save, TrendingUp, Settings, Trash2, Plus, ShieldCheck, Calculator } from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (49 classNames converted):
// (1) lg:grid-cols-2 main grid → flex-wrap (flagged: no breakpoint equivalent)
// (2) lg:col-span-2 on margin card → width:100% in flex context (flagged)
// (3) grid grid-cols-12 / col-span-5/2 inner layout → flex with flex:5/flex:2 proportions (flagged)
// (4) focus:border-blue-500/orange-500/teal-500 → ign-input/ign-input-orange CSS class (teal→blue approx; flagged)
// (5) hover:bg-teal-500/20 on Add Slab button → dropped (cosmetic)
// (6) hover:text-red-500 hover:bg-red-500/10 on remove button → dropped (cosmetic)
// (7) active:scale-95 on save button → ign-card-hover CSS class (when dirty)
// [TRACE:STYLE] IgnitionProt converted, 49 classNames → inline, 7 non-1:1 categories

const sectionCard = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#020617',
  padding: 16,
  borderRadius: 16,
  border: '1px solid #1e293b',
};

const dollarStyle = {
  position: 'absolute',
  left: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#64748b',
  fontWeight: 700,
};

const inputStyle = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  paddingLeft: 28,
  paddingRight: 12,
  paddingTop: 8,
  paddingBottom: 8,
  color: '#ffffff',
  fontWeight: 900,
  outline: 'none',
  transition: 'border-color 0.15s',
};

const IgnitionProt = () => {
  const currentUser = DataBridge.load('current_user');

  const [rates, setRates] = useState({ BASE: 165, DIAGNOSTIC: 195, MOBILE: 225 });
  const [matrix, setMatrix] = useState({ defaultMarkup: 1.25, slabs: [] });
  const [costs, setCosts] = useState({ rent: 0, electric: 0, fuel: 0, maintenance: 0 });
  const [isDirty, setIsDirty] = useState(false);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionProt converted, 49 classNames → inline, 7 non-1:1 categories');

  useEffect(() => {
    setRates(DataBridge.getSystemRates() || { BASE: 165, DIAGNOSTIC: 195, MOBILE: 225 });
    setMatrix(DataBridge.getMarginMatrix() || { defaultMarkup: 1.25, slabs: [] });
    setCosts(DataBridge.getOperationalCosts() || { rent: 0, electric: 0, fuel: 0, maintenance: 0 });
  }, []);

  const handleSave = () => {
    const adminId = currentUser?.id || 'SYSTEM';
    const sortedSlabs = [...(matrix.slabs || [])].sort((a, b) => parseFloat(a.maxCost) - parseFloat(b.maxCost));
    const finalMatrix = { ...matrix, slabs: sortedSlabs };
    DataBridge.setSystemRates(rates, adminId);
    DataBridge.setMarginMatrix(finalMatrix, adminId);
    DataBridge.setOperationalCosts(costs, adminId);
    setMatrix(finalMatrix);
    setIsDirty(false);
    alert("Financial configurations securely saved and audited!");
  };

  const updateRate = (key, val) => { setRates({ ...rates, [key]: parseFloat(val) || 0 }); setIsDirty(true); };
  const updateCost = (key, val) => { setCosts({ ...costs, [key]: parseFloat(val) || 0 }); setIsDirty(true); };
  const updateSlab = (index, field, val) => {
    const newSlabs = [...matrix.slabs];
    newSlabs[index][field] = parseFloat(val) || 0;
    setMatrix({ ...matrix, slabs: newSlabs });
    setIsDirty(true);
  };
  const removeSlab = (index) => {
    setMatrix({ ...matrix, slabs: matrix.slabs.filter((_, i) => i !== index) });
    setIsDirty(true);
  };
  const addSlab = () => {
    setMatrix({ ...matrix, slabs: [...(matrix.slabs || []), { maxCost: 0, markup: 1.0 }] });
    setIsDirty(true);
  };

  return (
    <div style={{ padding: 24, backgroundColor: '#020617', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 96 }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#14b8a6', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
            PROT // Margin Matrix
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Shop Economics & Pricing Configuration
          </p>
        </div>
        {/* active:scale-95 → ign-card-hover (when dirty) */}
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={isDirty ? 'ign-card-hover' : ''}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s',
            border: 'none',
            cursor: isDirty ? 'pointer' : 'not-allowed',
            backgroundColor: isDirty ? '#0d9488' : '#1e293b',
            color: isDirty ? '#ffffff' : '#64748b',
            boxShadow: isDirty ? '0 10px 15px -3px rgba(13,148,136,0.4)' : 'none',
          }}
        >
          <Save size={16} /> Save Config
        </button>
      </header>

      {/* lg:grid-cols-2 → flex-wrap; flagged: no breakpoint equivalent */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>

        {/* LABOR RATES */}
        <div style={{ ...sectionCard, flex: '1 1 calc(50% - 12px)', minWidth: 280 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} /> Base Labor Rates
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(rates).map(([key, value]) => (
              <div key={key} style={rowStyle}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>{key} RATE</span>
                <div style={{ position: 'relative', width: 128 }}>
                  <span style={dollarStyle}>$</span>
                  {/* focus:border-blue-500 → ign-input CSS class */}
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => updateRate(key, e.target.value)}
                    className="ign-input"
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OPERATIONAL COSTS */}
        <div style={{ ...sectionCard, flex: '1 1 calc(50% - 12px)', minWidth: 280 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} /> Monthly Overhead
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.keys(costs).map((key) => (
              <div key={key} style={rowStyle}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>{key}</span>
                <div style={{ position: 'relative', width: 128 }}>
                  <span style={dollarStyle}>$</span>
                  {/* focus:border-orange-500 → ign-input-orange CSS class */}
                  <input
                    type="number"
                    value={costs[key]}
                    onChange={(e) => updateCost(key, e.target.value)}
                    className="ign-input-orange"
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MARGIN MATRIX SLABS — lg:col-span-2 → width:100% in flex context */}
        <div style={{ ...sectionCard, width: '100%', flex: '1 1 100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#14b8a6', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator size={18} /> Parts Pricing Margin Slabs
            </h3>
            {/* hover:bg-teal-500/20 → dropped (cosmetic) */}
            <button
              onClick={addSlab}
              style={{
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: '#2dd4bf',
                backgroundColor: 'rgba(20,184,166,0.10)',
                padding: '6px 12px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'background-color 0.15s',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Add Slab
            </button>
          </div>

          {/* Column headers — grid grid-cols-12 col-span-5/2 → flex with flex:5/flex:2 proportions */}
          <div style={{ display: 'flex', gap: 16, fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: 16, marginBottom: 8 }}>
            <div style={{ flex: 5 }}>Cost Ceiling (Up To)</div>
            <div style={{ flex: 5 }}>Retail Markup Multiplier</div>
            <div style={{ flex: 2, textAlign: 'center' }}>Action</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {(matrix.slabs || []).map((slab, idx) => (
              /* grid grid-cols-12 col-span-5/2 → flex with flex:5/flex:2 */
              <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'center', backgroundColor: '#020617', padding: 12, borderRadius: 16, border: '1px solid #1e293b' }}>
                <div style={{ flex: 5, position: 'relative' }}>
                  <span style={dollarStyle}>$</span>
                  {/* focus:border-teal-500 → ign-input CSS class (blue approx; flagged) */}
                  <input
                    type="number"
                    value={slab.maxCost}
                    onChange={(e) => updateSlab(idx, 'maxCost', e.target.value)}
                    className="ign-input"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 5, position: 'relative' }}>
                  <span style={dollarStyle}>×</span>
                  <input
                    type="number"
                    step="0.1"
                    value={slab.markup}
                    onChange={(e) => updateSlab(idx, 'markup', e.target.value)}
                    className="ign-input"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                  {/* hover:text-red-500 hover:bg-red-500/10 → dropped (cosmetic) */}
                  <button
                    onClick={() => removeSlab(idx)}
                    style={{ padding: 8, color: '#64748b', backgroundColor: 'transparent', borderRadius: 8, transition: 'color 0.15s', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {(!matrix.slabs || matrix.slabs.length === 0) && (
              <div style={{ textAlign: 'center', padding: 24, border: '1px dashed #1e293b', borderRadius: 16, fontSize: 10, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                No margin slabs defined. Click "Add Slab" above.
              </div>
            )}

            {/* DEFAULT MARKUP (Catch-all) */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', backgroundColor: '#020617', padding: 12, borderRadius: 16, border: '1px solid #1e293b', opacity: 0.8, marginTop: 16 }}>
              <div style={{ flex: 5 }}>
                <div style={{ width: '100%', backgroundColor: 'rgba(15,23,42,0.50)', border: '1px solid rgba(51,65,85,0.50)', borderRadius: 12, padding: '8px 12px', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>ANY COST OVER CEILING</span>
                  <span>(Default)</span>
                </div>
              </div>
              <div style={{ flex: 5, position: 'relative' }}>
                <span style={dollarStyle}>×</span>
                <input
                  type="number"
                  step="0.1"
                  value={matrix.defaultMarkup}
                  onChange={(e) => { setMatrix({ ...matrix, defaultMarkup: parseFloat(e.target.value) || 1.0 }); setIsDirty(true); }}
                  className="ign-input"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                <ShieldCheck size={16} style={{ color: '#0f766e' }} />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default IgnitionProt;
