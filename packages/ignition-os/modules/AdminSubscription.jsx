/**
 * MODULE: Admin Subscription Manager
 * VERSION: v0.4.0
 * DESC: Master marketplace for Ignition OS. Manages the $X Umbrella fee, 
 * individual module trials, and automated data ingestion (VIN/Telematics).
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Zap, FileSpreadsheet, Camera, 
  ShieldCheck, Crown, Clock, DollarSign, Settings 
} from 'lucide-react';
import DataBridge from '../DataBridge';

const AdminSubscription = () => {
  // 1. Platform Pricing State ($X Umbrella)
  const [umbrellaPrice, setUmbrellaPrice] = useState(299);
  
  // 2. Module Marketplace & Trial State
  const [subscriptions, setSubscriptions] = useState(
    DataBridge.load('system_subscriptions') || {
      FLUX: { active: true, tier: 'BASIC', trialActive: false },
      PREDICTIVE: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      ESTIMATOR: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      CODE: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      STOK: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      PROT: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      HUB: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null },
      PROC: { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }
    }
  );

  // Sync pricing/subs to DataBridge when changed
  useEffect(() => {
    // Hotfix: Inject CODE/STOK into localStorage if missing for backward compatibility
    const currentSubs = DataBridge.load('system_subscriptions');
    if (currentSubs) {
      let merged = { ...currentSubs };
      let changed = false;
      if (!currentSubs.CODE) { merged.CODE = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.STOK) { merged.STOK = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.PROT) { merged.PROT = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.HUB) { merged.HUB = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (!currentSubs.PROC) { merged.PROC = { active: false, tier: 'NONE', trialActive: false, trialStartedAt: null }; changed = true; }
      if (changed) {
        setSubscriptions(merged);
        DataBridge.save('system_subscriptions', merged);
      }
    }
  }, []);

  const persistChanges = (newSubs) => {
    setSubscriptions(newSubs);
    DataBridge.save('system_subscriptions', newSubs);
  };

  const startTrial = (modId) => {
    const updated = {
      ...subscriptions,
      [modId]: { 
        ...subscriptions[modId], 
        active: true, 
        tier: 'PRO', // Trials unlock PRO to show the "Magic Moment"
        trialActive: true,
        trialStartedAt: new Date().toISOString()
      }
    };
    persistChanges(updated);
  };

  const calculateDaysLeft = (startDate) => {
    if (!startDate) return 30;
    const start = new Date(startDate);
    const today = new Date();
    const diff = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diff); // Your 30-day "Deep Integration" window
  };

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen font-sans">
      <header className="mb-10 border-b border-slate-800 pb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white">IGNITION MARKETPLACE</h2>
          <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">Platform Administration // v0.4.0</p>
        </div>
        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 text-right">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Current Umbrella Fee</p>
          <p className="text-xl font-black text-white">${umbrellaPrice}<span className="text-xs text-slate-500">/mo</span></p>
        </div>
      </header>

      {/* SECTION 1: DATA INGESTION (THE "NO MANUAL ENTRY" HOOK) */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Zap size={18} className="text-blue-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">Fast-Track Onboarding</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-2xl hover:bg-blue-600/10 transition-all text-center group">
            <Zap size={28} className="mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-white text-sm uppercase">Telematics Sync</p>
            <p className="text-[9px] text-slate-500 mt-2 italic">Connect Samsara / Geotab / Motive</p>
          </button>
          <button className="p-6 bg-emerald-600/5 border border-emerald-500/20 rounded-2xl hover:bg-emerald-600/10 transition-all text-center group">
            <FileSpreadsheet size={28} className="mx-auto mb-3 text-emerald-500 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-white text-sm uppercase">Legacy Importer</p>
            <p className="text-[9px] text-slate-500 mt-2 italic">Drag & Drop Fleet Spreadsheets</p>
          </button>
          <button className="p-6 bg-purple-600/5 border border-purple-500/20 rounded-2xl hover:bg-purple-600/10 transition-all text-center group">
            <Camera size={28} className="mx-auto mb-3 text-purple-500 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-white text-sm uppercase">VIN Sniper OCR</p>
            <p className="text-[9px] text-slate-500 mt-2 italic">Mobile Barcode & Plate Scanning</p>
          </button>
        </div>
      </section>

      {/* SECTION 2: MODULE SUBSCRIPTIONS */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <ShoppingBag size={18} className="text-blue-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">Active Subscriptions</h3>
        </div>
        <div className="grid gap-4">
          {Object.keys(subscriptions).map(key => {
            const mod = subscriptions[key];
            const daysLeft = calculateDaysLeft(mod.trialStartedAt);

            return (
              <div key={key} className={`p-6 rounded-3xl border transition-all ${
                mod.active ? 'bg-slate-900 border-blue-500/30 shadow-lg shadow-blue-900/10' : 'bg-slate-900/40 border-slate-800'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl italic ${
                      mod.active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'
                    }`}>
                      {key[0]}
                    </div>
                    <div>
                      <h4 className="font-black text-white italic tracking-tighter uppercase">{key} MODULE</h4>
                      {mod.trialActive ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Clock size={12} className="text-orange-400" />
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-tighter">
                            Trial: {daysLeft} Days Remaining
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{mod.tier} TIER</span>
                      )}
                    </div>
                  </div>
                  {!mod.active ? (
                     <button onClick={() => startTrial(key)} className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 text-xs font-bold rounded-lg border border-blue-500/30 transition-colors uppercase">
                       Start Free Trial
                     </button>
                  ) : (
                     <span className="px-4 py-2 bg-emerald-900/40 text-emerald-500 text-xs font-bold rounded-lg border border-emerald-500/20 uppercase flex items-center gap-2">
                       <ShieldCheck size={14}/> Active
                     </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminSubscription;
