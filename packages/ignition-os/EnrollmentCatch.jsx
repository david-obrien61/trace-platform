/**
 * FILE: EnrollmentCatch.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Security and liability onboarding agreement screen capturing digital signatures.
 * DEPENDENCIES: react, react-signature-canvas
 */

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import DataBridge from './DataBridge';

const STYLE_DEBUG = true;

// Non-1:1 mappings:
// (1) hover:bg-emerald-500 on accept button → ign-btn-emerald CSS class
// (2) animate-pulse on accept button → ign-pulse CSS class
// (3) overflow-y-scroll → overflowY: 'scroll' (1:1 preserved inline)
// [TRACE:STYLE] EnrollmentCatch converted, 12 classNames → inline, 2 non-1:1:
//   (1) hover:bg-emerald-500 → ign-btn-emerald CSS class
//   (2) animate-pulse → ign-pulse CSS class

const EnrollmentCatch = () => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const sigPad = useRef({});
  const user = DataBridge.load('current_user') || {};

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] EnrollmentCatch converted, 12 classNames → inline, 2 non-1:1');

  const handleAgreement = () => {
    if (sigPad.current.isEmpty()) {
      alert('Please provide a signature before accepting.');
      return;
    }
    const signatureImage = sigPad.current.toDataURL();
    const updatedUser = {
      ...user,
      status: 'ACTIVE',
      legal_signatures: { tool_policy: signatureImage, date: new Date().toISOString() },
    };
    DataBridge.save('current_user', updatedUser);
    window.location.reload();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#020617',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 448,
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 40,
        border: '1px solid #1e293b',
        padding: 32,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', textTransform: 'uppercase', marginBottom: 8 }}>
          Welcome to Ignition OS
        </h1>
        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
          Security &amp; Liability Onboarding
        </p>

        <div
          style={{
            height: 192,
            overflowY: 'scroll',
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 16,
            padding: 16,
            fontSize: 11,
            color: '#94a3b8',
            marginBottom: 24,
            border: '1px solid #1e293b',
          }}
          onScroll={(e) => {
            if (e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 1) setHasScrolled(true);
          }}
        >
          <p style={{ marginBottom: 16, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', fontSize: 9 }}>
            Section 1: Personal Tool Ownership
          </p>
          <p style={{ marginBottom: 16 }}>
            I acknowledge that I am solely responsible for the maintenance, security, and tracking of my personal toolset. The shop is not liable for loss or damage to personal assets.
          </p>
          <p style={{ marginBottom: 16, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', fontSize: 9 }}>
            Section 2: Shop Asset Custody
          </p>
          <p style={{ marginBottom: 16 }}>
            I agree that any shop-owned hardware (scanners, jacks, specialty tools) assigned to my bay or checked out via my ID is my responsibility. I will report missing items immediately via the Investigation Log.
          </p>
        </div>

        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
          Sign to Acknowledge
        </p>
        <div style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 8, marginBottom: 24 }}>
          <SignatureCanvas
            ref={sigPad}
            canvasProps={{ width: '100%', height: 150, className: 'sigCanvas' }}
          />
        </div>

        <button
          disabled={!hasScrolled}
          onClick={handleAgreement}
          className={hasScrolled ? 'ign-btn-emerald ign-pulse' : ''}
          style={{
            width: '100%',
            padding: 24,
            borderRadius: 32,
            fontWeight: 900,
            textTransform: 'uppercase',
            border: 'none',
            fontSize: 14,
            boxShadow: hasScrolled ? '0 20px 25px -5px rgba(0,0,0,0.1)' : 'none',
            backgroundColor: hasScrolled ? '#059669' : '#1e293b',
            color: hasScrolled ? '#ffffff' : '#475569',
            cursor: hasScrolled ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
          }}
        >
          {hasScrolled ? 'Accept & Enter Shop' : 'Scroll to Bottom to Accept'}
        </button>
      </div>
    </div>
  );
};

export default EnrollmentCatch;
