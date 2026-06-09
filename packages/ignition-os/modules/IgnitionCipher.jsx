/**
 * MODULE: CODE (DTC Cipher)
 * VERSION: v1.1.0
 * DESC: Integrates with DataBridge to pull fault codes from FLUX/PRED.
 */

import React, { useState, useEffect } from 'react';
import { Search, Calculator, AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import DataBridge from '../DataBridge';
import AIEngine from '@trace/shared/ai/AIEngine';

const STYLE_DEBUG = false;

// Non-1:1 mappings (8 classNames converted):
// (1) hover:bg-blue-500 on DECODE button → ign-btn-primary CSS class
// (2) hover:text-blue-500 on auto-sync button → ign-btn-ghost CSS class
// (3) hover:bg-emerald-500 on check inventory button → ign-btn-emerald CSS class
// (4) filter blur-xl grayscale opacity-30 → inline filter: 'blur(1.25rem) grayscale(100%)' (1:1 preserved)
// (5) select-none → userSelect: 'none' inline (1:1 preserved)
// (6) pointer-events-none → pointerEvents: 'none' inline (1:1 preserved)
// (7) space-y-4 → display flex + gap (1:1 preserved)
// (8) transition-all duration-700 → transition: 'all 0.7s' inline (1:1 preserved)
// [TRACE:STYLE] IgnitionCipher converted, 31 classNames → inline, 3 non-1:1 categories

const IgnitionCipher = ({ activeJob, onUpdateJob, onNavigateToStok }) => {
  const [faultCode, setFaultCode] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionCipher converted, 31 classNames → inline, 3 non-1:1 categories');

  const { isExpired, daysRemaining } = DataBridge.checkTrialStatus('CODE');

  // Logic to simulate a "Live Scan" from Telematics
  const simulateLiveSync = () => {
    setFaultCode('3251'); // Example: DPF Soot Level
  };

  const faultLibrary = {
    "3216": { name: "Inlet NOx Sensor", parts: ["2871979-NX"], labor: 1.5, partsCost: 262.5 },
    "3251": { name: "DPF Pressure High", parts: ["A0014903492", "Clamps", "Gaskets"], labor: 4.0, partsCost: 780 },
    "157": { name: "Fuel Rail Pressure Low", parts: ["Relief Valve"], labor: 2.5, partsCost: 215.5 }
  };

  const handleTranslate = async () => {
    const code = faultCode.trim().toUpperCase();
    if (!code) return;

    const activeRate   = activeJob?.lockedLaborRate || DataBridge.getSystemRates().BASE;
    const activeMargin = activeJob?.lockedMargin || DataBridge.getActiveMargin('STANDARD');

    const base = faultLibrary[code];
    if (base) {
      const retail = DataBridge.calculateRetail(base.partsCost + base.labor * activeRate, activeMargin);
      setResult({ ...base, total: retail, rateApplied: activeRate, marginApplied: activeMargin, source: 'LOCAL' });
      if (!activeJob?.lockedLaborRate && onUpdateJob)
        onUpdateJob({ ...activeJob, lockedLaborRate: activeRate, lockedMargin: activeMargin });
      return;
    }

    // Unknown code — ask Claude
    setIsLoading(true);
    setResult(null);
    try {
      const vehicle = activeJob ? `${activeJob.year || ''} ${activeJob.make || ''} ${activeJob.model || ''}`.trim() : '';
      const aiRes = await AIEngine.decodeDTC([code], vehicle || undefined);
      if (aiRes?.codes?.[0]) {
        const c = aiRes.codes[0];
        setResult({
          name:          c.description || c.likely_cause || code,
          parts:         c.parts_likely_needed || [],
          labor:         c.labor_hours_estimate || 1.5,
          partsCost:     0,
          total:         (c.labor_hours_estimate || 1.5) * activeRate,
          rateApplied:   activeRate,
          marginApplied: activeMargin,
          severity:      c.severity,
          source:        'AI',
          raw:           c,
        });
      } else {
        setResult({ name: `Code ${code} — No data found`, parts: [], labor: 0, partsCost: 0, total: 0, source: 'AI' });
      }
    } catch (err) {
      setResult({ name: `Code ${code} — AI unavailable`, parts: [], labor: 0, partsCost: 0, total: 0, source: 'ERROR' });
    } finally {
      setIsLoading(false);
    }
  };

  const severityColor = (sev) => {
    if (sev === 'HIGH')   return '#f87171';
    if (sev === 'MEDIUM') return '#fb923c';
    return '#facc15';
  };

  return (
    <div style={{ padding: 24, backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100%' }}>
      <header style={{
        marginBottom: 32,
        borderBottom: '1px solid #1e293b',
        paddingBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
            CODE // DTC Cipher
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Diagnostic Translation Engine
          </p>
        </div>
        {isExpired && (
          <span style={{
            backgroundColor: 'rgba(239,68,68,0.10)',
            color: '#ef4444',
            fontSize: 9,
            fontWeight: 900,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid rgba(239,68,68,0.20)',
            textTransform: 'uppercase',
          }}>
            Trial Expired
          </span>
        )}
      </header>

      {/* SEARCH / SCAN INPUT */}
      <div style={{
        backgroundColor: '#1e293b',
        padding: 24,
        borderRadius: 24,
        border: '1px solid #334155',
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="ENTER SPN CODE"
            className="ign-input"
            style={{
              flex: 1,
              backgroundColor: '#000000',
              border: '1px solid #475569',
              padding: 16,
              borderRadius: 12,
              fontWeight: 900,
              color: '#ffffff',
              textAlign: 'center',
              letterSpacing: '0.1em',
              outline: 'none',
            }}
            value={faultCode}
            onChange={(e) => setFaultCode(e.target.value)}
          />
          {/* hover:bg-blue-500 → ign-btn-primary CSS class */}
          <button
            onClick={handleTranslate}
            disabled={isLoading}
            className={!isLoading ? 'ign-btn-primary' : ''}
            style={{
              paddingLeft: 32,
              paddingRight: 32,
              borderRadius: 12,
              fontWeight: 900,
              color: '#ffffff',
              border: 'none',
              cursor: isLoading ? 'wait' : 'pointer',
              backgroundColor: isLoading ? '#475569' : '#2563eb',
              transition: 'background-color 0.15s',
            }}
          >
            {isLoading ? '...' : 'DECODE'}
          </button>
        </div>
        {/* hover:text-blue-500 → ign-btn-ghost CSS class */}
        <button
          onClick={simulateLiveSync}
          className="ign-btn-ghost"
          style={{
            marginTop: 16,
            width: '100%',
            fontSize: 9,
            color: '#64748b',
            textTransform: 'uppercase',
            fontWeight: 900,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          • Auto-Sync from Telematics •
        </button>
      </div>

      {/* THE RESULT ENGINE */}
      {result && (
        <div style={{
          backgroundColor: '#1e293b',
          padding: 24,
          borderRadius: 24,
          border: '1px solid #334155',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Diagnosis</p>
              <h3 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: '#ffffff' }}>{result.name}</h3>
              {result.source === 'AI' && (
                <span style={{ fontSize: 9, fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  ⚡ AI-decoded by Claude
                </span>
              )}
              {result.severity && (
                <span style={{ marginLeft: 12, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: severityColor(result.severity) }}>
                  {result.severity} severity
                </span>
              )}
            </div>
            <AlertTriangle style={{ color: '#f97316' }} />
          </div>

          {/* THE BLIND SPOT Logic — filter/opacity/pointer-events are 1:1 inline */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            transition: 'all 0.7s',
            filter: isExpired ? 'blur(1.25rem) grayscale(100%)' : 'none',
            opacity: isExpired ? 0.3 : 1,
            userSelect: isExpired ? 'none' : undefined,
            pointerEvents: isExpired ? 'none' : undefined,
          }}>
            <div style={{ backgroundColor: '#020617', padding: 16, borderRadius: 12, border: '1px solid #334155' }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', marginBottom: 8 }}>Build List</p>
              {result.parts.map(p => (
                <div key={p} style={{ fontSize: 12, fontFamily: 'monospace' }}>• {p}</div>
              ))}
            </div>
            <div style={{
              backgroundColor: 'rgba(16,185,129,0.05)',
              padding: 16,
              borderRadius: 12,
              border: '1px solid rgba(16,185,129,0.20)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>Est. Repair Cost</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>${result.total}</p>
              </div>
              <p style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', fontStyle: 'italic' }}>{result.labor} Hours Labor</p>
            </div>
            {onNavigateToStok && (
              /* hover:bg-emerald-500 → ign-btn-emerald CSS class */
              <button
                onClick={() => onNavigateToStok(faultCode)}
                className="ign-btn-emerald"
                style={{
                  width: '100%',
                  marginTop: 16,
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 900,
                  paddingTop: 16,
                  paddingBottom: 16,
                  borderRadius: 12,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  textTransform: 'uppercase',
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  boxShadow: '0 10px 15px -3px rgba(6,46,26,0.4)',
                  border: 'none',
                  cursor: isExpired ? 'not-allowed' : 'pointer',
                }}
                disabled={isExpired}
              >
                Check Leander Inventory <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* PAYWALL OVERLAY */}
          {isExpired && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
              backgroundColor: 'rgba(15,23,42,0.40)',
            }}>
              <Lock size={32} style={{ color: '#3b82f6', marginBottom: 16 }} />
              <p style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic', marginBottom: 8, letterSpacing: '-0.05em' }}>
                Information Advantage Locked
              </p>
              <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 24, paddingLeft: 16, paddingRight: 16 }}>
                Your trial for CODE has expired. We found the solution, but access to part numbers and labor times requires a subscription.
              </p>
              <button style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 900,
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 32,
                paddingRight: 32,
                borderRadius: 12,
                fontSize: 12,
                textTransform: 'uppercase',
                boxShadow: '0 10px 15px -3px rgba(30,58,138,0.4)',
                border: 'none',
                cursor: 'pointer',
              }}>
                Unlock Module
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IgnitionCipher;
