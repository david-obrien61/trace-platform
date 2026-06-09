/**
 * FILE: IgnitionHandover.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Job Handover Protocol modal for suspending work orders with detailed status notes and safety flags.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { AlertOctagon, Wrench, XCircle } from 'lucide-react';

const STYLE_DEBUG = false;

// Non-1:1 mappings:
// (1) hover:text-white on cancel button → ign-icon-btn CSS class
// (2) hover:bg-blue-500 on submit button → ign-btn-primary CSS class
// (3) animate-pulse on "Do Not Move" btn → ign-pulse CSS class
// (4) sm:text-xs responsive → dropped (fixed text-[10px]); flagged
// (5) backdrop-blur-md → backdropFilter inline (1:1 preserved)
// [TRACE:STYLE] IgnitionHandover converted, 16 classNames → inline, 4 non-1:1:
//   (1) hover:text-white → ign-icon-btn
//   (2) hover:bg-blue-500 → ign-btn-primary
//   (3) animate-pulse → ign-pulse
//   (4) sm:text-xs responsive → dropped/fixed

const IgnitionHandover = ({ activeJob, onSubmit, onCancel }) => {
  const [note, setNote] = useState('');
  const [isOperable, setIsOperable] = useState(true);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionHandover converted, 16 classNames → inline, 4 non-1:1');

  const handleSubmit = () => {
    if (!note.trim()) {
      alert('A status note is strictly required for hand-off.');
      return;
    }
    onSubmit({ note, isOperable });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{
        backgroundColor: '#020617',
        width: '100%',
        maxWidth: 512,
        border: '4px solid #1e293b',
        borderRadius: 40,
        padding: 32,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        position: 'relative',
      }}>
        <button
          className="ign-icon-btn"
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            color: '#64748b',
          }}
        >
          <XCircle size={32} />
        </button>

        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>
          Job Handover Protocol
        </h2>
        <p style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 32 }}>
          Formal Suspension Log For WO #{activeJob?.id}
        </p>

        <div style={{ marginBottom: 32 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
            Detailed Status Note (Required)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="ign-input"
            style={{
              width: '100%',
              height: 128,
              backgroundColor: '#0f172a',
              border: '2px solid #334155',
              borderRadius: 16,
              padding: 16,
              color: '#ffffff',
              fontFamily: 'monospace',
              fontSize: 14,
              outline: 'none',
              resize: 'none',
            }}
            placeholder="e.g. Turbo removed, waiting on gaskets. Bolts are in the magnetic tray on the cart."
          />
        </div>

        <div style={{ marginBottom: 40 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: '#64748b', marginBottom: 16 }}>
            Safety Flag: Asset Operability
          </label>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => setIsOperable(true)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 16,
                borderRadius: 16,
                border: isOperable ? '4px solid #10b981' : '4px solid #1e293b',
                backgroundColor: isOperable ? 'rgba(5,150,105,0.1)' : '#0f172a',
                color: isOperable ? '#34d399' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Wrench size={24} />
              <span style={{ fontWeight: 900, fontSize: 10, textTransform: 'uppercase' }}>Safe to Move</span>
            </button>
            <button
              onClick={() => setIsOperable(false)}
              className={!isOperable ? 'ign-pulse' : ''}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 16,
                borderRadius: 16,
                border: !isOperable ? '4px solid #f97316' : '4px solid #1e293b',
                backgroundColor: !isOperable ? 'rgba(249,115,22,0.1)' : '#0f172a',
                color: !isOperable ? '#fb923c' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <AlertOctagon size={24} />
              <span style={{ fontWeight: 900, fontSize: 10, textTransform: 'uppercase', textAlign: 'center' }}>Do Not Move</span>
            </button>
          </div>
        </div>

        <button
          className={note.trim() ? 'ign-btn-primary' : ''}
          onClick={handleSubmit}
          style={{
            width: '100%',
            paddingTop: 24,
            paddingBottom: 24,
            borderRadius: 24,
            fontWeight: 900,
            fontSize: 18,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            border: 'none',
            cursor: note.trim() ? 'pointer' : 'not-allowed',
            backgroundColor: note.trim() ? '#2563eb' : '#1e293b',
            color: note.trim() ? '#ffffff' : '#64748b',
            boxShadow: note.trim() ? '0 0 20px rgba(37,99,235,0.4)' : 'none',
            transition: 'color 0.15s, background-color 0.15s',
          }}
        >
          Confirm Suspension
        </button>
      </div>
    </div>
  );
};

export default IgnitionHandover;
