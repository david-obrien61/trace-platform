/**
 * FILE: IgnitionProcure.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Procurement UI for inputting parts, vendors, wholesale costs, and tracking mandatory core charges.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { PackageOpen, Save, RefreshCw, DollarSign } from 'lucide-react';
import { MarginEngine } from '../MarginEngine';
import DataBridge from '../DataBridge';

const IgnitionProcure = ({ activeJob, onPartAdded }) => {
  const [partNum, setPartNum] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  const [hasCore, setHasCore] = useState(false);
  const [coreValue, setCoreValue] = useState('');

  // Auto-calculated retail using the MarginEngine Slab Logic
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
      vendor: vendor,
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

    const updatedJob = {
      ...currentJob,
      inventory: updatedInventory
    };

    // Deep sync to the local edge-datastore
    DataBridge.save('active_job_context', updatedJob);
    
    if (onPartAdded) onPartAdded(updatedJob);

    alert(`Supply Chain Sync: Part ${partNum} committed to WO #${currentJob.id}`);
    
    // Clean slate for the next part
    setPartNum('');
    setVendor('');
    setCost('');
    setHasCore(false);
    setCoreValue('');
  };

  return (
    <div className="bg-slate-950 p-6 sm:p-10 rounded-[3rem] border-4 border-slate-900 shadow-2xl w-full max-w-3xl mx-auto text-slate-200">
      
      {/* HEADER */}
      <header className="mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-slate-800 pb-8">
        <div className="bg-blue-600/10 p-5 rounded-[1.5rem] border border-blue-500/20 shadow-lg">
          <PackageOpen size={36} className="text-blue-500" />
        </div>
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Parts Procurement</h2>
          <p className="text-[10px] font-mono tracking-[0.2em] text-blue-500 uppercase mt-1">Supply Chain // Asset Intake</p>
        </div>
      </header>

      <div className="space-y-8">
        
        {/* ROW 1: Sourcing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1">Part Number</label>
            <input 
              type="text" 
              value={partNum}
              onChange={(e) => setPartNum(e.target.value)}
              className="w-full bg-slate-900 border-2 border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-6 py-5 text-white font-black outline-none transition-all shadow-inner"
              placeholder="e.g. FL-1995"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1">Vendor Source</label>
            <input 
              type="text" 
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full bg-slate-900 border-2 border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-6 py-5 text-white font-black outline-none transition-all shadow-inner"
              placeholder="e.g. NAPA / FleetPride"
            />
          </div>
        </div>

        {/* ROW 2: Financials & Retail Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1">Wholesale Cost (USD)</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">$</span>
              <input 
                type="number" 
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full bg-slate-900 border-2 border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-12 pr-6 py-5 text-white font-black text-2xl outline-none transition-all shadow-inner"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="bg-slate-900 border-l-4 border-blue-500 rounded-2xl px-6 py-5 relative overflow-hidden shadow-lg">
             <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 pointer-events-none">
               <DollarSign size={64} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Calculated Retail Price</p>
             <p className="text-4xl font-black text-white tabular-nums tracking-tighter">
                <span className="text-blue-500 text-xl align-top mr-1">$</span>{retailPrice > 0 ? retailPrice.toFixed(2) : '0.00'}
             </p>
          </div>
        </div>

        {/* CORE CHARGE SECTION */}
        <div className="mt-10 border-t-2 border-dashed border-slate-800 pt-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
               <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-3 ${hasCore ? "text-white" : "text-slate-500"}`}>
                 <div className={`p-2 rounded-lg ${hasCore ? "bg-emerald-500/20" : "bg-slate-800"}`}>
                   <RefreshCw size={16} className={hasCore ? "text-emerald-500" : "text-slate-600"} />
                 </div>
                 Core Charge Tracking
               </h3>
               <p className="text-[10px] text-slate-600 font-mono mt-2 uppercase tracking-wider ml-[2.75rem]">Is this part exchangeable for credit?</p>
            </div>
            
            <button 
              onClick={() => setHasCore(!hasCore)}
              className={`relative inline-flex h-10 w-20 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors shadow-inner ${hasCore ? 'bg-emerald-600' : 'bg-slate-800'}`}
            >
              <span className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform ${hasCore ? 'translate-x-10' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {hasCore && (
             <div className="bg-slate-900 border-2 border-emerald-500/30 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500" />
                <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3 ml-2">Mandatory Core Value (USD)</label>
                <div className="relative max-w-sm">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">$</span>
                  <input 
                    type="number" 
                    value={coreValue}
                    onChange={(e) => setCoreValue(e.target.value)}
                    className="w-full bg-black border-2 border-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl pl-12 pr-6 py-5 text-emerald-400 font-black text-2xl outline-none transition-all placeholder:text-slate-700"
                    placeholder="250.00"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase px-3 py-2 rounded-xl w-fit">
                  <RefreshCw size={14} />
                  <span>Will be tagged as 'PENDING_CORE'</span>
                </div>
             </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <button 
           onClick={handleSave}
           className="w-full mt-10 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white p-6 sm:p-8 rounded-[2rem] font-black uppercase text-lg sm:text-xl tracking-widest flex items-center justify-center gap-4"
        >
           <Save size={28} />
           Commit Asset to Work Order
        </button>

      </div>
    </div>
  );
};

export default IgnitionProcure;
