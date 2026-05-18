/**
 * MODULE: CODE (DTC Cipher)
 * VERSION: v1.1.0
 * DESC: Integrates with DataBridge to pull fault codes from FLUX/PRED.
 */

import React, { useState, useEffect } from 'react';
import { Search, Calculator, AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import DataBridge from '../DataBridge';
import AIEngine from '../AIEngine';

const IgnitionCipher = ({ activeJob, onUpdateJob, onNavigateToStok }) => {
  const [faultCode, setFaultCode] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="p-6 bg-slate-900 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">CODE // DTC Cipher</h2>
          <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">Diagnostic Translation Engine</p>
        </div>
        {isExpired && (
          <span className="bg-red-500/10 text-red-500 text-[9px] font-black px-2 py-1 rounded border border-red-500/20 uppercase">
            Trial Expired
          </span>
        )}
      </header>

      {/* SEARCH / SCAN INPUT */}
      <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 mb-8">
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="ENTER SPN CODE" 
            className="flex-1 bg-black border border-slate-600 p-4 rounded-xl font-black text-white text-center tracking-widest"
            value={faultCode}
            onChange={(e) => setFaultCode(e.target.value)}
          />
          <button onClick={handleTranslate} disabled={isLoading} className={`px-8 rounded-xl font-black text-white transition-colors ${isLoading ? 'bg-slate-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {isLoading ? '...' : 'DECODE'}
          </button>
        </div>
        <button onClick={simulateLiveSync} className="mt-4 w-full text-[9px] text-slate-500 uppercase font-black hover:text-blue-500 transition-colors">
          • Auto-Sync from Telematics •
        </button>
      </div>

      {/* THE RESULT ENGINE */}
      {result && (
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 relative overflow-hidden">
          <div className="flex justify-between mb-6">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Diagnosis</p>
              <h3 className="text-xl font-black italic text-white">{result.name}</h3>
              {result.source === 'AI' && (
                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">⚡ AI-decoded by Claude</span>
              )}
              {result.severity && (
                <span className={`ml-3 text-[9px] font-black uppercase tracking-widest ${result.severity === 'HIGH' ? 'text-red-400' : result.severity === 'MEDIUM' ? 'text-orange-400' : 'text-yellow-400'}`}>
                  {result.severity} severity
                </span>
              )}
            </div>
            <AlertTriangle className="text-orange-500" />
          </div>

          {/* THE BLIND SPOT Logic */}
          <div className={`space-y-4 transition-all duration-700 ${isExpired ? 'filter blur-xl grayscale opacity-30 select-none pointer-events-none' : ''}`}>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-700">
              <p className="text-[10px] font-black text-blue-500 uppercase mb-2">Build List</p>
              {result.parts.map(p => <div key={p} className="text-xs font-mono">• {p}</div>)}
            </div>
            <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-emerald-500 uppercase">Est. Repair Cost</p>
                <p className="text-2xl font-black text-white">${result.total}</p>
              </div>
              <p className="text-[9px] text-slate-500 font-mono italic">{result.labor} Hours Labor</p>
            </div>
            {onNavigateToStok && (
              <button 
                onClick={() => onNavigateToStok(faultCode)}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl flex justify-center items-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-emerald-900/40 transition-colors"
                disabled={isExpired}
              >
                Check Leander Inventory <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* PAYWALL OVERLAY */}
          {isExpired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/40">
              <Lock size={32} className="text-blue-500 mb-4" />
              <p className="text-sm font-black text-white uppercase italic mb-2 tracking-tighter">Information Advantage Locked</p>
              <p className="text-[10px] text-slate-400 mb-6 px-4">Your trial for CODE has expired. We found the solution, but access to part numbers and labor times requires a subscription.</p>
              <button className="bg-blue-600 text-white font-black py-3 px-8 rounded-xl text-xs uppercase shadow-lg shadow-blue-900/40">
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
