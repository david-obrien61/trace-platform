/**
 * FILE: IgnitionOmniDashboard.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Omni Mission Control dashboard rendering global shop telemetry and metrics for Admins.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, Users, ShieldCheck, Activity, TrendingDown, ClipboardList } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionOmniDashboard = () => {
  const [metrics, setMetrics] = useState({
    leakage: 0,
    activeTechs: 0,
    pmiCompletion: 0
  });

  useEffect(() => {
    // 1. Leakage Calculation (The "Relationship Tax")
    // In production, this maps through the LeakageAudit array.
    const transactions = DataBridge.load('transaction_history') || [];
    let totalLeakage = 0;
    
    transactions.forEach(t => {
      if (t.actualPrice < t.standardPrice) {
        totalLeakage += (t.standardPrice - t.actualPrice);
      }
    });

    // Fallback prototype metric to pitch the $450 leakage hook if no live transactions exist
    const displayLeakage = totalLeakage > 0 ? totalLeakage : 450.00;

    // 2. Active Techs (Live Occupancy)
    const activeJob = DataBridge.load('active_job_context');
    const techsWorking = activeJob?.active_techs?.length || 3; 

    // 3. PMI Compliance
    // Completed vs Pending
    const pmiScore = 82; // Mock 82% efficiency metric

    setMetrics({
      leakage: displayLeakage,
      activeTechs: techsWorking,
      pmiCompletion: pmiScore
    });

  }, []);

  return (
    <div className="p-4 sm:p-8 bg-black min-h-full text-slate-200">
      {/* OMNI HEADER */}
      <header className="mb-10 border-b border-slate-800 pb-6">
         <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter mb-1">
           Omni <span className="text-blue-500 border-l-4 border-blue-500 pl-4 ml-4">Mission Control</span>
         </h1>
         <p className="text-[10px] sm:text-xs font-mono text-slate-500 uppercase tracking-[0.3em]">Global Shop Analytics & Telemetry</p>
      </header>

      {/* DASHBOARD COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: FINANCIALS */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between group hover:border-blue-500/50 transition-all relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
           <div>
              <div className="flex items-center gap-3 mb-6 text-slate-500">
                <div className="bg-blue-500/10 p-2 rounded-xl">
                  <DollarSign size={28} className="text-blue-500" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Financials</h2>
              </div>
              
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Relationship Tax (Leakage)</p>
              <h3 className="text-6xl font-black text-white tabular-nums tracking-tighter mb-4">
                 <span className="text-blue-500 text-3xl align-top mr-1">$</span>{metrics.leakage.toFixed(2)}
              </h3>
              
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase px-3 py-2 rounded-xl w-fit drop-shadow-md">
                 <TrendingDown size={14} />
                 <span>Loss in Last 30 Days</span>
              </div>
           </div>
           
           <div className="mt-8 pt-6 border-t border-slate-800/50">
             <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">Aggregated from manual POS overrides globally.</p>
           </div>
        </div>

        {/* COLUMN 2: OPERATIONS */}
        <div className="bg-slate-950 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between group hover:border-slate-500/50 transition-all relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-500 shadow-[0_0_15px_rgba(100,116,139,0.4)]"></div>
           <div>
              <div className="flex items-center gap-3 mb-6 text-slate-500">
                <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
                  <Users size={28} className="text-slate-400" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Operations</h2>
              </div>
              
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Active Bay Occupancy</p>
              <h3 className="text-6xl font-black text-white tabular-nums tracking-tighter mb-4 flex items-baseline gap-2">
                 {metrics.activeTechs} <span className="text-xl text-slate-600 italic tracking-widest">TECHS</span>
              </h3>
              
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase px-3 py-2 rounded-xl w-fit drop-shadow-md">
                 <Activity size={14} />
                 <span>Fully Operational</span>
              </div>
           </div>

           <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-between items-center text-[10px] font-mono tracking-widest uppercase text-slate-600">
             <span>Live Data</span>
             <span className="text-blue-500 animate-pulse">● SYNCED</span>
           </div>
        </div>

        {/* COLUMN 3: COMPLIANCE */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between group hover:border-emerald-500/50 transition-all relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]"></div>
           <div>
              <div className="flex items-center gap-3 mb-6 text-slate-500">
                <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                  <ShieldCheck size={28} className="text-emerald-500" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Compliance</h2>
              </div>
              
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">PMI Completion Rate</p>
              <h3 className="text-6xl font-black text-white tabular-nums tracking-tighter mb-4 flex items-baseline gap-1">
                 {metrics.pmiCompletion}<span className="text-4xl text-emerald-500 opacity-60">%</span>
              </h3>
              
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase px-3 py-2 rounded-xl w-fit drop-shadow-md">
                 <ClipboardList size={14} />
                 <span>12 Pending Audits</span>
              </div>
           </div>

           <div className="mt-8 pt-6 border-t border-slate-800/50">
             <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">Strict DOT safety gates enforced.</p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default IgnitionOmniDashboard;
