/**
 * FILE: IgnitionCompliance.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: 24-point DOT Safety Inspection audit form enforcing strict defect documentation and sign-offs.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { Camera, ShieldAlert, CheckCircle2, AlertTriangle, FileCheck } from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (31 classNames converted):
// (1) sm:p-8, sm:flex-row, sm:w-28, sm:text-xs, sm:text-5xl responsive → fixed/dropped; flagged
// (2) hover:bg-slate-100, hover:bg-orange-50, hover:bg-emerald-500 → ign-btn-* classes
// (3) animate-pulse on sidebar accent → ign-pulse class
// (4) animate-in / slide-in-from-top-4 (Tailwind v3 animate) → dropped; flagged (non-standard)
// (5) focus:ring-4 / focus:ring-orange-500/20 → ign-input CSS class handles focus
// (6) shadow-inner → kept inline where supported; flagged where not
// Note: IgnitionCompliance uses LIGHT theme (white/orange). Not dark navy.
// [TRACE:STYLE] IgnitionCompliance converted, 31 classNames → inline, 5 categories non-1:1

const dotItems = [
  "Service Brakes", "Parking System", "Brake Drums/Rotors", "Brake Hoses/Tubing",
  "Low Air Warning", "Tractor Protection", "Air Compressor", "Coupling Devices",
  "Exhaust System", "Fuel System", "Lighting Devices", "Safe Loading",
  "Steering Mechanism", "Suspension System", "Frame Integrity", "Tires",
  "Wheels & Rims", "Windshield Glazing", "Windshield Wipers", "Mirrors",
  "Horn Operation", "Speedometer", "Seat Belts", "Emergency Equipment"
];

const IgnitionCompliance = ({ onComplete }) => {
  const [results, setResults] = useState({});
  const shopInfo = DataBridge.load('shop_info') || {};

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionCompliance converted, 31 classNames → inline, 5 non-1:1 categories');

  const handleStatus = (index, status) => setResults(prev => ({ ...prev, [index]: { ...prev[index], status } }));
  const handleNotes  = (index, note)   => setResults(prev => ({ ...prev, [index]: { ...prev[index], notes: note } }));
  const handlePhoto  = (index) => {
    setResults(prev => ({ ...prev, [index]: { ...prev[index], photo: 'mock_photo_data_b64' } }));
    alert('Hardware Interface: Native Camera API Triggered.\n(Mock photo attached for prototype)');
  };

  const checkCompletionStatus = () => {
    for (let i = 0; i < dotItems.length; i++) {
      const item = results[i];
      if (!item || !item.status) return false;
      if (item.status === 'FAIL' && !item.photo && (!item.notes || item.notes.trim() === '')) return false;
    }
    return true;
  };

  const submitAudit = () => {
    if (!checkCompletionStatus()) {
      alert('CRITICAL HARD-STOP: You must complete all 24 points and adequately document any failure points before signing off.');
      return;
    }
    const payload = {
      timestamp: new Date().toISOString(),
      results,
      inspector: DataBridge.load('current_user')?.id || 'UNKNOWN_TECH',
    };
    DataBridge.smartSync('SUBMIT_PMI', payload);
    if (onComplete) onComplete(payload);
  };

  const isFullyComplete = checkCompletionStatus();

  // Item row border/bg based on status
  const itemStyle = (data) => {
    const isFail = data.status === 'FAIL';
    if (isFail)            return { backgroundColor: 'rgba(255,247,237,0.8)', borderLeftColor: '#ea580c' };
    if (data.status === 'PASS') return { backgroundColor: '#f8fafc', borderLeftColor: '#1e293b' };
    if (data.status === 'N/A')  return { backgroundColor: '#f1f5f9', borderLeftColor: '#94a3b8' };
    return { backgroundColor: '#ffffff', borderLeftColor: '#e2e8f0' };
  };

  const btnStyle = (active, activeColor, activeText) => ({
    flex: 1,
    padding: '16px 16px',
    fontWeight: 900,
    fontSize: 14,
    textTransform: 'uppercase',
    transition: 'background-color 0.15s',
    cursor: 'pointer',
    backgroundColor: active ? activeColor : '#ffffff',
    color: active ? activeText : '#94a3b8',
    border: 'none',
  });

  return (
    <div style={{
      backgroundColor: '#ffffff',
      minHeight: '100%',
      color: '#0f172a',
      padding: 16,
      fontFamily: 'sans-serif',
      borderTop: '8px solid #ea580c',
      position: 'relative',
      paddingBottom: 128,
    }}>
      <header style={{
        marginBottom: 40,
        textAlign: 'center',
        borderBottom: '4px solid #0f172a',
        paddingBottom: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <ShieldAlert size={64} style={{ color: '#ea580c', marginBottom: 16 }} />
        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
          DOT Safety Inspection
        </h1>
        <p style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#9a3412',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          backgroundColor: '#fed7aa',
          padding: '8px 24px',
          marginTop: 16,
          borderRadius: 9999,
          border: '2px solid #fdba74',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          Mandatory 24-Point Compliance Audit
        </p>
      </header>

      <div style={{ maxWidth: 896, margin: '0 auto' }}>
        {dotItems.map((item, i) => {
          const data = results[i] || {};
          const isFail = data.status === 'FAIL';
          return (
            <div key={i} style={{
              padding: 20,
              borderLeft: '8px solid',
              borderRadius: 16,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              marginBottom: 20,
              transition: 'all 0.3s',
              ...itemStyle(data),
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#cbd5e1', width: 40 }}>{i + 1}.</span>
                  <h3 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', letterSpacing: '-0.025em' }}>{item}</h3>
                </div>
                <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 12, border: '2px solid #1e293b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <button onClick={() => handleStatus(i, 'PASS')} style={{ ...btnStyle(data.status === 'PASS', '#1e293b', '#ffffff'), borderRight: '2px solid #1e293b' }}>PASS</button>
                  <button onClick={() => handleStatus(i, 'FAIL')} style={{ ...btnStyle(data.status === 'FAIL', '#ea580c', '#ffffff'), borderRight: '2px solid #1e293b' }}>FAIL</button>
                  <button onClick={() => handleStatus(i, 'N/A')}  style={btnStyle(data.status === 'N/A', '#94a3b8', '#ffffff')}>N/A</button>
                </div>
              </div>

              {isFail && (
                <div style={{
                  marginTop: 24,
                  padding: 24,
                  backgroundColor: '#ffedd5',
                  borderRadius: 16,
                  border: '2px solid #fdba74',
                }}>
                  <p style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#9a3412', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} /> Defect Documentation Required
                  </p>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <textarea
                      className="ign-input-orange"
                      style={{
                        flex: 1,
                        backgroundColor: '#ffffff',
                        border: '2px solid #fdba74',
                        borderRadius: 12,
                        padding: 16,
                        fontSize: 16,
                        fontWeight: 500,
                        outline: 'none',
                        resize: 'none',
                      }}
                      placeholder="Describe the critical defect to avoid DOT liability..."
                      value={data.notes || ''}
                      onChange={(e) => handleNotes(i, e.target.value)}
                      rows={3}
                    />
                    <button
                      onClick={() => handlePhoto(i)}
                      className="ign-btn-secondary"
                      style={{
                        width: 160,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        borderRadius: 12,
                        border: data.photo ? '4px solid #10b981' : '4px dashed #fb923c',
                        padding: 16,
                        backgroundColor: data.photo ? '#d1fae5' : '#ffffff',
                        color: data.photo ? '#047857' : '#ea580c',
                        cursor: 'pointer',
                      }}
                    >
                      {data.photo ? <CheckCircle2 size={32} /> : <Camera size={32} />}
                      <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 900, textAlign: 'center' }}>
                        {data.photo ? 'Photo Attached' : 'Attach Photo Evidence'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        maxWidth: 896,
        margin: '64px auto 0',
        backgroundColor: '#0f172a',
        borderRadius: 32,
        padding: 32,
        color: '#ffffff',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 32,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {isFullyComplete && (
          <div className="ign-pulse" style={{ position: 'absolute', top: 0, left: 0, width: 8, height: '100%', backgroundColor: '#f97316' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ padding: 16, borderRadius: 9999, backgroundColor: isFullyComplete ? 'rgba(249,115,22,0.2)' : '#1e293b', color: isFullyComplete ? '#f97316' : '#475569' }}>
            <FileCheck size={48} />
          </div>
          <div>
            <h3 style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em' }}>Sign &amp; Certify</h3>
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>By submitting, you legally certify this form.</p>
          </div>
        </div>
        <button
          onClick={submitAudit}
          disabled={!isFullyComplete}
          className={isFullyComplete ? 'ign-btn-orange' : ''}
          style={{
            padding: '24px 48px',
            borderRadius: 16,
            fontWeight: 900,
            fontSize: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            border: isFullyComplete ? 'none' : '3px solid #334155',
            flexShrink: 0,
            cursor: isFullyComplete ? 'pointer' : 'not-allowed',
            backgroundColor: isFullyComplete ? '#ea580c' : '#1e293b',
            color: isFullyComplete ? '#ffffff' : '#475569',
            boxShadow: isFullyComplete ? '0 20px 25px -5px rgba(120,53,15,0.5)' : 'none',
          }}
        >
          {isFullyComplete ? 'Complete PMI' : 'Audit Incomplete'}
        </button>
      </div>

      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0f172a',
        borderTop: '4px solid #ea580c',
        padding: 20,
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#94a3b8',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
        letterSpacing: '0.1em',
        zIndex: 50,
      }}>
        <div style={{ fontWeight: 900, color: '#ffffff' }}>{shopInfo.name || 'UNREGISTERED SHOP'}</div>
        <div>USDOT: <span style={{ fontWeight: 900, color: '#ffffff' }}>{shopInfo.global_contact?.usdot || 'PENDING'}</span></div>
      </footer>
    </div>
  );
};

export default IgnitionCompliance;
