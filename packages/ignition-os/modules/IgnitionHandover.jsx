/**
 * FILE: IgnitionHandover.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Job Handover Protocol modal for suspending work orders with detailed status notes and safety flags.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { AlertOctagon, Wrench, XCircle } from 'lucide-react';

const IgnitionHandover = ({ activeJob, onSubmit, onCancel }) => {
  const [note, setNote] = useState('');
  const [isOperable, setIsOperable] = useState(true);

  const handleSubmit = () => {
    if (!note.trim()) {
      alert('A status note is strictly required for hand-off.');
      return;
    }
    onSubmit({ note, isOperable });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-950 w-full max-w-lg border-4 border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative">
        <button onClick={onCancel} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
          <XCircle size={32} />
        </button>

        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Job Handover Protocol</h2>
        <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-8">Formal Suspension Log For WO #{activeJob?.id}</p>

        <div className="mb-8">
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Detailed Status Note (Required)</label>
          <textarea 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-32 bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 text-white font-mono text-sm focus:border-blue-500 outline-none resize-none"
            placeholder="e.g. Turbo removed, waiting on gaskets. Bolts are in the magnetic tray on the cart."
          />
        </div>

        <div className="mb-10">
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-4">Safety Flag: Asset Operability</label>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsOperable(true)}
              className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-4 transition-all ${
                isOperable ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-900 text-slate-600'
              }`}
            >
              <Wrench size={24} />
              <span className="font-black text-[10px] sm:text-xs uppercase">Safe to Move</span>
            </button>
            <button 
              onClick={() => setIsOperable(false)}
              className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-4 transition-all ${
                !isOperable ? 'border-orange-500 bg-orange-500/10 text-orange-400 animate-pulse' : 'border-slate-800 bg-slate-900 text-slate-600'
              }`}
            >
              <AlertOctagon size={24} />
              <span className="font-black text-[10px] sm:text-xs uppercase text-center">Do Not Move</span>
            </button>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          className={`w-full py-6 rounded-3xl font-black text-lg uppercase tracking-widest transition-colors ${
             note.trim() ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          Confirm Suspension
        </button>
      </div>
    </div>
  );
};

export default IgnitionHandover;
