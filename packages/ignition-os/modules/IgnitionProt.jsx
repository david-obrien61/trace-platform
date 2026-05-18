/**
 * FILE: IgnitionProt.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Financial Settings UI for Margins, Labor Rates, and Operational Overhead.
 */

import React, { useState, useEffect } from 'react';
import { Save, TrendingUp, Settings, Trash2, Plus, ShieldCheck, Calculator } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionProt = () => {
  const currentUser = DataBridge.load('current_user');
  
  const [rates, setRates] = useState({ BASE: 165, DIAGNOSTIC: 195, MOBILE: 225 });
  const [matrix, setMatrix] = useState({ defaultMarkup: 1.25, slabs: [] });
  const [costs, setCosts] = useState({ rent: 0, electric: 0, fuel: 0, maintenance: 0 });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setRates(DataBridge.getSystemRates() || { BASE: 165, DIAGNOSTIC: 195, MOBILE: 225 });
    setMatrix(DataBridge.getMarginMatrix() || { defaultMarkup: 1.25, slabs: [] });
    setCosts(DataBridge.getOperationalCosts() || { rent: 0, electric: 0, fuel: 0, maintenance: 0 });
  }, []);

  const handleSave = () => {
    const adminId = currentUser?.id || 'SYSTEM';
    
    // Sort slabs by maxCost before saving to ensure the MarginEngine evaluates them correctly
    const sortedSlabs = [...(matrix.slabs || [])].sort((a, b) => parseFloat(a.maxCost) - parseFloat(b.maxCost));
    const finalMatrix = { ...matrix, slabs: sortedSlabs };

    DataBridge.setSystemRates(rates, adminId);
    DataBridge.setMarginMatrix(finalMatrix, adminId);
    DataBridge.setOperationalCosts(costs, adminId);
    
    setMatrix(finalMatrix);
    setIsDirty(false);
    
    alert("Financial configurations securely saved and audited!");
  };

  const updateRate = (key, val) => {
    setRates({ ...rates, [key]: parseFloat(val) || 0 });
    setIsDirty(true);
  };

  const updateCost = (key, val) => {
    setCosts({ ...costs, [key]: parseFloat(val) || 0 });
    setIsDirty(true);
  };

  const updateSlab = (index, field, val) => {
    const newSlabs = [...matrix.slabs];
    newSlabs[index][field] = parseFloat(val) || 0;
    setMatrix({ ...matrix, slabs: newSlabs });
    setIsDirty(true);
  };

  const removeSlab = (index) => {
    const newSlabs = matrix.slabs.filter((_, i) => i !== index);
    setMatrix({ ...matrix, slabs: newSlabs });
    setIsDirty(true);
  };

  const addSlab = () => {
    setMatrix({ ...matrix, slabs: [...(matrix.slabs || []), { maxCost: 0, markup: 1.0 }] });
    setIsDirty(true);
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-teal-500">PROT // Margin Matrix</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Shop Economics & Pricing Configuration</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={!isDirty}
          className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all ${isDirty ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/40 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
        >
          <Save size={16} /> Save Config
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LABOR RATES */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Settings size={18} /> Base Labor Rates
          </h3>
          <div className="space-y-4">
            {Object.entries(rates).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase">{key} RATE</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => updateRate(key, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-blue-500 transition-colors" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OPERATIONAL COSTS */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={18} /> Monthly Overhead
          </h3>
          <div className="space-y-4">
            {Object.keys(costs).map((key) => (
              <div key={key} className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase">{key}</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number" 
                    value={costs[key]} 
                    onChange={(e) => updateCost(key, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-orange-500 transition-colors" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MARGIN MATRIX SLABS */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-teal-500 uppercase tracking-widest flex items-center gap-2">
              <Calculator size={18} /> Parts Pricing Margin Slabs
            </h3>
            <button onClick={addSlab} className="text-[10px] font-black uppercase text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <Plus size={14} /> Add Slab
            </button>
          </div>
          
          <div className="grid grid-cols-12 gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2">
            <div className="col-span-5">Cost Ceiling (Up To)</div>
            <div className="col-span-5">Retail Markup Multiplier</div>
            <div className="col-span-2 text-center">Action</div>
          </div>

          <div className="space-y-3 mb-6">
            {(matrix.slabs || []).map((slab, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div className="col-span-5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number" 
                    value={slab.maxCost} 
                    onChange={(e) => updateSlab(idx, 'maxCost', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-teal-500 transition-colors" 
                  />
                </div>
                <div className="col-span-5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">×</span>
                  <input 
                    type="number" 
                    step="0.1"
                    value={slab.markup} 
                    onChange={(e) => updateSlab(idx, 'markup', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-teal-500 transition-colors" 
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <button onClick={() => removeSlab(idx)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            
            {(!matrix.slabs || matrix.slabs.length === 0) && (
               <div className="text-center p-6 border border-dashed border-slate-800 rounded-2xl text-[10px] text-slate-500 font-black uppercase tracking-widest">
                 No margin slabs defined. Click "Add Slab" above.
               </div>
            )}

            {/* DEFAULT MARKUP (Catch-all) */}
            <div className="grid grid-cols-12 gap-4 items-center bg-slate-950 p-3 rounded-2xl border border-slate-800 opacity-80 mt-4">
              <div className="col-span-5">
                <div className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-slate-400 font-black uppercase text-xs flex items-center justify-between">
                  <span>ANY COST OVER CEILING</span>
                  <span>(Default)</span>
                </div>
              </div>
              <div className="col-span-5 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">×</span>
                <input 
                  type="number" 
                  step="0.1"
                  value={matrix.defaultMarkup} 
                  onChange={(e) => {
                    setMatrix({...matrix, defaultMarkup: parseFloat(e.target.value) || 1.0});
                    setIsDirty(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-black outline-none focus:border-teal-500 transition-colors" 
                />
              </div>
              <div className="col-span-2 flex justify-center">
                <ShieldCheck size={16} className="text-teal-700" />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default IgnitionProt;