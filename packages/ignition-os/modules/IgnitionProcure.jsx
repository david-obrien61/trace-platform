/**
 * FILE: IgnitionProcure.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Procurement UI for inputting parts, vendors, wholesale costs, and tracking mandatory core charges.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { PackageOpen, Save, RefreshCw, DollarSign } from 'lucide-react';
import { MarginEngine } from '../MarginEngine';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (38 classNames converted):
// (1) sm:flex-row sm:items-center sm:p-10 sm:text-xl md:grid-cols-2 → dropped (no breakpoint equivalent)
// (2) focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 on inputs → ign-input CSS class
// (3) focus:border-emerald-500 focus:ring-emerald-500/10 on core input → ign-input CSS class (blue approx; flagged)
// (4) shadow-inner → dropped (no inline equivalent)
// (5) hover:bg-blue-500 on submit button → ign-btn-primary CSS class
// (6) active:scale-[0.98] on submit button → ign-card-hover CSS class
// [TRACE:STYLE] IgnitionProcure converted, 38 classNames → inline, 6 non-1:1 categories

const labelStyle = {
  display: 'block',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#64748b',
  marginBottom: 12,
  marginLeft: 4,
};

const inputStyle = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '2px solid #1e293b',
  borderRadius: 16,
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 20,
  paddingBottom: 20,
  color: '#ffffff',
  fontWeight: 900,
  outline: 'none',
  transition: 'all 0.15s',
};

const IgnitionProcure = ({ activeJob, onPartAdded }) => {
  const [partNum, setPartNum] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [hasCore, setHasCore] = useState(false);
  const [coreValue, setCoreValue] = useState('');

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionProcure converted, 38 classNames → inline, 6 non-1:1 categories');

  const retailPrice = MarginEngine.calculateRetail(cost);

  const handleSave = () => {
    if (!partNum || !vendor || !cost) {
      alert("Safety Protocol: Part Number, Vendor, and Wholesale Cost are rigidly required.");
      return;
    }
    if (hasCore && !coreValue) {
      alert("Liability Check: Core Value is mandatory when a Core Charge is active.");
      return;
    }
    const newPart = {
      id: `PRT-${Math.floor(Math.random() * 10000)}`,
      part_num: partNum,
      vendor,
      cost: parseFloat(cost),
      retail: retailPrice,
      has_core: hasCore,
      core_value: hasCore ? parseFloat(coreValue) : 0,
      core_status: hasCore ? 'UNRETURNED' : 'N/A',
      tags: hasCore ? ['PENDING_CORE'] : []
    };
    const currentJob = DataBridge.load('active_job_context') || activeJob;
    if (!currentJob) {
      alert("No active Work Order located in the memory bank.");
      return;
    }
    const updatedInventory = currentJob.inventory ? {
      ...currentJob.inventory,
      specialized: [...(currentJob.inventory.specialized || []), newPart]
    } : { specialized: [newPart], baseConfirmed: true };
    const updatedJob = { ...currentJob, inventory: updatedInventory };
    DataBridge.save('active_job_context', updatedJob);
    if (onPartAdded) onPartAdded(updatedJob);
    alert(`Supply Chain Sync: Part ${partNum} committed to WO #${currentJob.id}`);
    setPartNum('');
    setVendor('');
    setCost('');
    setHasCore(false);
    setCoreValue('');
  };

  return (
    <div style={{
      backgroundColor: '#020617',
      padding: 24,
      borderRadius: 48,
      border: '4px solid #0f172a',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      width: '100%',
      maxWidth: 768,
      margin: '0 auto',
      color: '#e2e8f0',
    }}>

      {/* HEADER */}
      <header style={{
        marginBottom: 40,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 16,
        borderBottom: '1px solid #1e293b',
        paddingBottom: 32,
      }}>
        <div style={{
          backgroundColor: 'rgba(37,99,235,0.10)',
          padding: 20,
          borderRadius: 24,
          border: '1px solid rgba(59,130,246,0.20)',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        }}>
          <PackageOpen size={36} style={{ color: '#3b82f6' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', color: '#ffffff' }}>
            Parts Procurement
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em', color: '#3b82f6', textTransform: 'uppercase', marginTop: 4 }}>
            Supply Chain // Asset Intake
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ROW 1: Sourcing — md:grid-cols-2 → flex-wrap; flagged: no breakpoint */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: '1 1 calc(50% - 12px)', minWidth: 200 }}>
            <label style={labelStyle}>Part Number</label>
            {/* focus:border-blue-500 focus:ring → ign-input CSS class */}
            <input
              type="text"
              value={partNum}
              onChange={(e) => setPartNum(e.target.value)}
              className="ign-input"
              style={inputStyle}
              placeholder="e.g. FL-1995"
            />
          </div>
          <div style={{ flex: '1 1 calc(50% - 12px)', minWidth: 200 }}>
            <label style={labelStyle}>Vendor Source</label>
            {/* focus:border-blue-500 focus:ring → ign-input CSS class */}
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="ign-input"
              style={inputStyle}
              placeholder="e.g. NAPA / FleetPride"
            />
          </div>
        </div>

        {/* ROW 2: Financials — md:grid-cols-2 → flex-wrap; flagged: no breakpoint */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 calc(50% - 12px)', minWidth: 200 }}>
            <label style={labelStyle}>Wholesale Cost (USD)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 900, fontSize: 20 }}>$</span>
              {/* focus:border-blue-500 focus:ring → ign-input CSS class; shadow-inner → dropped */}
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="ign-input"
                style={{ ...inputStyle, paddingLeft: 48, fontSize: 24 }}
                placeholder="0.00"
              />
            </div>
          </div>

          <div style={{
            flex: '1 1 calc(50% - 12px)',
            minWidth: 200,
            backgroundColor: '#0f172a',
            borderLeft: '4px solid #3b82f6',
            borderRadius: 16,
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', opacity: 0.05, pointerEvents: 'none' }}>
              <DollarSign size={64} />
            </div>
            <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3b82f6', marginBottom: 8 }}>
              Calculated Retail Price
            </p>
            <p style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.05em' }}>
              <span style={{ color: '#3b82f6', fontSize: 20, verticalAlign: 'top', marginRight: 4 }}>$</span>
              {retailPrice > 0 ? retailPrice.toFixed(2) : '0.00'}
            </p>
          </div>
        </div>

        {/* CORE CHARGE SECTION */}
        <div style={{ marginTop: 40, borderTop: '2px dashed #1e293b', paddingTop: 32 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
            <div>
              <h3 style={{
                fontSize: 14,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: hasCore ? '#ffffff' : '#64748b',
              }}>
                <div style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: hasCore ? 'rgba(16,185,129,0.20)' : '#1e293b',
                }}>
                  <RefreshCw size={16} style={{ color: hasCore ? '#10b981' : '#475569' }} />
                </div>
                Core Charge Tracking
              </h3>
              <p style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 44 }}>
                Is this part exchangeable for credit?
              </p>
            </div>

            {/* Toggle — shadow-inner → dropped */}
            <button
              onClick={() => setHasCore(!hasCore)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: 40,
                width: 80,
                flexShrink: 0,
                alignItems: 'center',
                borderRadius: 9999,
                border: '2px solid transparent',
                transition: 'background-color 0.15s',
                backgroundColor: hasCore ? '#059669' : '#1e293b',
                cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'inline-block',
                height: 32,
                width: 32,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                transition: 'transform 0.15s',
                transform: hasCore ? 'translateX(40px)' : 'translateX(2px)',
              }} />
            </button>
          </div>

          {hasCore && (
            <div style={{
              backgroundColor: '#0f172a',
              border: '2px solid rgba(16,185,129,0.30)',
              padding: 32,
              borderRadius: 32,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: '100%', backgroundColor: '#10b981' }} />
              <label style={{ ...labelStyle, color: '#10b981', marginLeft: 8 }}>Mandatory Core Value (USD)</label>
              <div style={{ position: 'relative', maxWidth: 384 }}>
                <span style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 900, fontSize: 20 }}>$</span>
                {/* focus:border-emerald-500 → ign-input CSS class (blue approx; flagged non-1:1) */}
                <input
                  type="number"
                  value={coreValue}
                  onChange={(e) => setCoreValue(e.target.value)}
                  className="ign-input"
                  style={{ ...inputStyle, paddingLeft: 48, fontSize: 24, backgroundColor: '#000000', color: '#34d399' }}
                  placeholder="250.00"
                />
              </div>
              <div style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(16,185,129,0.10)',
                border: '1px solid rgba(16,185,129,0.20)',
                color: '#10b981',
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                padding: '8px 12px',
                borderRadius: 12,
                width: 'fit-content',
              }}>
                <RefreshCw size={14} />
                <span>Will be tagged as 'PENDING_CORE'</span>
              </div>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON — hover:bg-blue-500 → ign-btn-primary; active:scale-[0.98] → ign-card-hover */}
        <button
          onClick={handleSave}
          className="ign-btn-primary ign-card-hover"
          style={{
            width: '100%',
            marginTop: 40,
            backgroundColor: '#2563eb',
            boxShadow: '0 0 20px rgba(37,99,235,0.4)',
            color: '#ffffff',
            padding: '24px 32px',
            borderRadius: 32,
            fontWeight: 900,
            textTransform: 'uppercase',
            fontSize: 18,
            letterSpacing: '0.1em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Save size={28} />
          Commit Asset to Work Order
        </button>

      </div>
    </div>
  );
};

export default IgnitionProcure;
