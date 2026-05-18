/**
 * FILE: EnrollmentCatch.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Security and liability onboarding agreement screen capturing digital signatures.
 * DEPENDENCIES: react, react-signature-canvas
 */

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import DataBridge from './DataBridge';

const EnrollmentCatch = () => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const sigPad = useRef({});
  const user = DataBridge.load('current_user') || {};

  const handleAgreement = () => {
    // If sigPad is empty, we might want to warn the user, but we'll stick to the blueprint
    if (sigPad.current.isEmpty()) {
      alert("Please provide a signature before accepting.");
      return;
    }
    
    const signatureImage = sigPad.current.toDataURL();
    
    // Update the user's "Source of Truth"
    const updatedUser = { 
      ...user, 
      status: 'ACTIVE', 
      legal_signatures: { tool_policy: signatureImage, date: new Date().toISOString() } 
    };
    
    DataBridge.save('current_user', updatedUser);
    window.location.reload(); // Refresh to trigger the Core Router to KOSK
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6">
      <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
        <h1 className="text-xl font-black text-white italic uppercase mb-2">Welcome to Ignition OS</h1>
        <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest mb-6">Security & Liability Onboarding</p>

        {/* THE AGREEMENT TEXT */}
        <div 
          className="h-48 overflow-y-scroll bg-black/50 rounded-2xl p-4 text-[11px] text-slate-400 mb-6 border border-slate-800"
          onScroll={(e) => {
            if (e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 1) setHasScrolled(true);
          }}
        >
          <p className="mb-4 font-bold text-slate-200 uppercase text-[9px]">Section 1: Personal Tool Ownership</p>
          <p className="mb-4">I acknowledge that I am solely responsible for the maintenance, security, and tracking of my personal toolset. The shop is not liable for loss or damage to personal assets.</p>
          
          <p className="mb-4 font-bold text-slate-200 uppercase text-[9px]">Section 2: Shop Asset Custody</p>
          <p className="mb-4">I agree that any shop-owned hardware (scanners, jacks, specialty tools) assigned to my bay or checked out via my ID is my responsibility. I will report missing items immediately via the Investigation Log.</p>
        </div>

        {/* THE SIGNATURE */}
        <p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-center">Sign to Acknowledge</p>
        <div className="bg-white rounded-3xl p-2 mb-6">
          <SignatureCanvas 
            ref={sigPad}
            canvasProps={{width: '100%', height: 150, className: 'sigCanvas'}} 
          />
        </div>

        <button 
          disabled={!hasScrolled}
          onClick={handleAgreement}
          className={`w-full p-6 rounded-[2rem] font-black uppercase transition-all shadow-xl ${
            hasScrolled ? 'bg-emerald-600 text-white hover:bg-emerald-500 animate-pulse' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          {hasScrolled ? 'Accept & Enter Shop' : 'Scroll to Bottom to Accept'}
        </button>
      </div>
    </div>
  );
};

export default EnrollmentCatch;
