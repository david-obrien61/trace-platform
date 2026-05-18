/**
 * FILE: IgnitionCompliance.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: 24-point DOT Safety Inspection audit form enforcing strict defect documentation and sign-offs.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { Camera, ShieldAlert, CheckCircle2, AlertTriangle, FileCheck } from 'lucide-react';
import DataBridge from '../DataBridge';

const dotItems = [
  "Service Brakes", "Parking System", "Brake Drums/Rotors", "Brake Hoses/Tubing",
  "Low Air Warning", "Tractor Protection", "Air Compressor", "Coupling Devices",
  "Exhaust System", "Fuel System", "Lighting Devices", "Safe Loading",
  "Steering Mechanism", "Suspension System", "Frame Integrity", "Tires",
  "Wheels & Rims", "Windshield Glazing", "Windshield Wipers", "Mirrors",
  "Horn Operation", "Speedometer", "Seat Belts", "Emergency Equipment"
];

const IgnitionCompliance = ({ onComplete }) => {
  const [results, setResults] = useState({});
  const shopInfo = DataBridge.load('shop_info') || {};

  const handleStatus = (index, status) => {
    setResults(prev => ({
      ...prev,
      [index]: { ...prev[index], status: status }
    }));
  };

  const handleNotes = (index, note) => {
    setResults(prev => ({
      ...prev,
      [index]: { ...prev[index], notes: note }
    }));
  };

  const handlePhoto = (index) => {
    const fakePhotoUrl = "mock_photo_data_b64";
    setResults(prev => ({
      ...prev,
      [index]: { ...prev[index], photo: fakePhotoUrl }
    }));
    alert("Hardware Interface: Native Camera API Triggered.\n(Mock photo attached for prototype)");
  };

  // HARD-STOP LOGIC
  const checkCompletionStatus = () => {
    for (let i = 0; i < dotItems.length; i++) {
        const item = results[i];
        if (!item || !item.status) return false;
        
        // Liability Engine: If failed, MUST have context.
        if (item.status === 'FAIL') {
            if (!item.photo && (!item.notes || item.notes.trim() === '')) {
                return false;
            }
        }
    }
    return true;
  };

  const submitAudit = () => {
    if (!checkCompletionStatus()) {
        alert("CRITICAL HARD-STOP: You must complete all 24 points and adequately document any failure points before signing off.");
        return;
    }
    
    const payload = {
       timestamp: new Date().toISOString(),
       results,
       inspector: DataBridge.load('current_user')?.id || 'UNKNOWN_TECH'
    };
    
    DataBridge.smartSync('SUBMIT_PMI', payload);
    
    if(onComplete) onComplete(payload);
  };

  const isFullyComplete = checkCompletionStatus();

  return (
    <div className="bg-white min-h-full text-slate-900 p-4 sm:p-8 font-sans border-t-8 border-orange-600 relative pb-32 shadow-inner">
      <header className="mb-10 text-center border-b-4 border-slate-900 pb-8 flex flex-col items-center">
         <ShieldAlert size={64} className="text-orange-600 mb-4 drop-shadow-md" />
         <h1 className="text-4xl sm:text-5xl font-black text-slate-900 uppercase tracking-tighter">DOT Safety Inspection</h1>
         <p className="text-sm font-bold text-orange-700 uppercase tracking-widest bg-orange-200 px-6 py-2 mt-4 rounded-full border-2 border-orange-300 shadow-sm">
            Mandatory 24-Point Compliance Audit
         </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-5">
         {dotItems.map((item, i) => {
            const data = results[i] || {};
            const isFail = data.status === 'FAIL';
            
            return (
              <div key={i} className={`p-5 sm:p-6 border-l-8 rounded-2xl shadow-xl transition-all duration-300 ${
                 isFail ? 'bg-orange-50/80 border-orange-600 shadow-orange-900/10' : 
                 data.status === 'PASS' ? 'bg-slate-50 border-slate-800' :
                 data.status === 'N/A' ? 'bg-slate-100 border-slate-400' :
                 'bg-white border-slate-200 hover:border-slate-400'
              }`}>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-black text-slate-300 w-10">{i + 1}.</span>
                      <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight">{item}</h3>
                    </div>
                    
                    <div className="flex w-full sm:w-auto overflow-hidden rounded-xl border-2 border-slate-800 shadow-sm">
                       <button onClick={() => handleStatus(i, 'PASS')} className={`flex-1 sm:w-28 px-4 py-4 font-black text-sm uppercase transition-colors ${data.status === 'PASS' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 hover:bg-slate-100'} border-r-2 border-slate-800`}>PASS</button>
                       <button onClick={() => handleStatus(i, 'FAIL')} className={`flex-1 sm:w-28 px-4 py-4 font-black text-sm uppercase transition-colors ${data.status === 'FAIL' ? 'bg-orange-600 text-white' : 'bg-white text-slate-400 hover:bg-orange-50'} border-r-2 border-slate-800`}>FAIL</button>
                       <button onClick={() => handleStatus(i, 'N/A')} className={`flex-1 sm:w-28 px-4 py-4 font-black text-sm uppercase transition-colors ${data.status === 'N/A' ? 'bg-slate-400 text-white' : 'bg-white text-slate-400 hover:bg-slate-100'}`}>N/A</button>
                    </div>
                 </div>

                 {isFail && (
                    <div className="mt-6 p-6 bg-orange-100 rounded-2xl border-2 border-orange-300 animate-in fade-in slide-in-from-top-4 shadow-inner">
                       <p className="text-xs font-black uppercase text-orange-800 tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={16}/> Defect Documentation Required</p>
                       <div className="flex flex-col sm:flex-row gap-4">
                          <textarea 
                            className="flex-1 bg-white border-2 border-orange-200 rounded-xl p-4 text-base font-medium focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none resize-none"
                            placeholder="Describe the critical defect to avoid DOT liability..."
                            value={data.notes || ''}
                            onChange={(e) => handleNotes(i, e.target.value)}
                            rows={3}
                          />
                          <button onClick={() => handlePhoto(i)} className={`sm:w-40 flex flex-col items-center justify-center gap-3 rounded-xl border-4 border-dashed transition-all p-4 active:scale-95 ${data.photo ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-white border-orange-400 text-orange-600 hover:bg-orange-50'}`}>
                             {data.photo ? <CheckCircle2 size={32} /> : <Camera size={32} />}
                             <span className="text-xs uppercase font-black text-center">{data.photo ? 'Photo Attached' : 'Attach Photo Evidence'}</span>
                          </button>
                       </div>
                    </div>
                 )}
              </div>
            );
         })}
      </div>

      <div className="max-w-4xl mx-auto mt-16 bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-8 relative overflow-hidden">
         {isFullyComplete && <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 animate-pulse"></div>}
         <div className="flex items-center gap-6">
            <div className={`p-4 rounded-full ${isFullyComplete ? "bg-orange-500/20 text-orange-500" : "bg-slate-800 text-slate-600"}`}>
               <FileCheck size={48} />
            </div>
            <div>
               <h3 className="text-2xl font-black uppercase italic tracking-tighter">Sign & Certify</h3>
               <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-1 uppercase">By submitting, you legally certify this form.</p>
            </div>
         </div>
         <button 
           onClick={submitAudit}
           disabled={!isFullyComplete}
           className={`w-full sm:w-auto px-12 py-6 rounded-2xl font-black text-xl uppercase tracking-widest transition-all shadow-xl flex-shrink-0 ${isFullyComplete ? 'bg-orange-600 text-white hover:bg-orange-500 active:scale-95 cursor-pointer shadow-orange-900/50' : 'bg-slate-800 border-[3px] border-slate-700 text-slate-600 cursor-not-allowed'}`}
         >
           {isFullyComplete ? 'Complete PMI' : 'Audit Incomplete'}
         </button>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t-4 border-orange-600 p-5 font-mono text-[10px] sm:text-xs text-slate-400 uppercase flex justify-between tracking-widest z-50">
         <div className="font-black text-white">{shopInfo.name || "UNREGISTERED SHOP"}</div>
         <div>USDOT: <span className="font-black text-white">{shopInfo.global_contact?.usdot || "PENDING"}</span></div>
      </footer>
    </div>
  );
};

export default IgnitionCompliance;
