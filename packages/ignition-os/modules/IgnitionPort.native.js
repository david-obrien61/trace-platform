/**
 * FILE: IgnitionPort.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Customer portal view for presenting repair estimates and collecting digital signatures.
 * DEPENDENCIES: react, react-signature-canvas, lucide-react
 */

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check } from 'lucide-react';
import DataBridge from '../DataBridge'; // Note: Adjust import path for DataBridge if IgnitionPort is in modules/

const IgnitionPort = ({ estimateData }) => {
  const [isApproved, setIsApproved] = useState(false);
  const sigPad = useRef({});

  // Fallback data if none provided to prevent crashes
  const data = estimateData || {
    id: "WO-999",
    vehicle: "Unknown Asset",
    items: [
      { desc: "Diagnostic Fee", retail: 195.00 }
    ],
    total: 195.00
  };

  const handleFinalApproval = () => {
    if (sigPad.current.isEmpty()) {
      alert("Please provide a signature before authorizing.");
      return;
    }
    
    const signature = sigPad.current.toDataURL();
    
    // Save to the Work Order in the DataBridge
    DataBridge.smartSync('ESTIMATE_APPROVED', {
      wo_id: data.id,
      signature: signature,
      timestamp: new Date().toISOString(),
      status: 'AUTHORIZED'
    });

    setIsApproved(true);
  };

  if (isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/20">
          <Check size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic">Work Authorized</h2>
        <p className="text-slate-500 font-mono text-xs mt-2 uppercase">The shop has been notified. We're on it.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-20 overflow-y-auto">
      <header className="mb-8 pt-4">
        <h1 className="text-xl font-black text-white uppercase italic tracking-tighter">Repair Estimate</h1>
        <p className="text-[10px] font-mono text-blue-500 uppercase">WO #{data.id} // {data.vehicle}</p>
      </header>

      {/* ITEM SUMMARY */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden mb-6 shadow-2xl">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-800/50 text-slate-500 uppercase font-black italic">
            <tr>
              <th className="p-4">Description</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {data.items.map((item, i) => (
              <tr key={i} className="border-t border-slate-800/50">
                <td className="p-4 font-bold">{item.desc}</td>
                <td className="p-4 text-right font-mono">${item.retail ? item.retail.toFixed(2) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 bg-blue-600/10 border-t border-blue-500/20 flex justify-between items-center">
          <span className="text-xs font-black text-blue-400 uppercase italic">Grand Total</span>
          <span className="text-2xl font-black text-white font-mono">${data.total ? data.total.toFixed(2) : "0.00"}</span>
        </div>
      </div>

      {/* THE CLOSER: SIGNATURE BOX */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl">
        <p className="text-center text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Sign to Authorize Repair</p>
        <div className="border-2 border-dashed border-slate-300 rounded-2xl mb-6 bg-slate-50">
          <SignatureCanvas 
            ref={sigPad}
            canvasProps={{width: 320, height: 180, className: 'sigCanvas mx-auto'}} 
          />
        </div>
        <button 
          onClick={handleFinalApproval}
          className="w-full bg-emerald-600 hover:bg-emerald-500 p-6 rounded-[2rem] text-white font-black uppercase text-lg shadow-xl shadow-emerald-900/40 active:scale-95 transition-all"
        >
          Authorize Work
        </button>
      </div>
    </div>
  );
};

export default IgnitionPort;
