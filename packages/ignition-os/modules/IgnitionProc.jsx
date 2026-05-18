/**
 * MODULE: PROC (Parts Procurement)
 * VERSION: v1.1.0
 * DESC: Manage external purchase orders, vendor directory, and partner onboarding.
 */
import React, { useState } from 'react';
import { Truck, Store, Plus, Building2, MapPin, Phone, Globe, Hash, ArrowLeft } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionProc = () => {
  const { isExpired } = DataBridge.checkTrialStatus('PROC');
  const [viewMode, setViewMode] = useState('DIRECTORY'); // DIRECTORY, ONBOARDING
  const [vendors, setVendors] = useState(() => DataBridge.getVendors());
  
  // Onboarding Form State
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', weblink: '', accountNum: '', priority: '' });

  const handleOnboardVendor = () => {
    if (!formData.name || !formData.accountNum) return alert("Vendor Name and Account Number are required.");
    const newVendor = { ...formData, id: `V-${Math.floor(Math.random() * 10000)}`, priority: parseInt(formData.priority) || 99 };
    DataBridge.addVendor(newVendor);
    setVendors(DataBridge.getVendors());
    setViewMode('DIRECTORY');
    setFormData({ name: '', address: '', phone: '', weblink: '', accountNum: '', priority: '' });
  };

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen relative">
      <header className="mb-8 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-emerald-500">PROC // Procurement</h2>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Vendor Routing & Directory</p>
      </header>
      
      <div className={`${isExpired ? 'filter blur-md pointer-events-none opacity-30 relative' : 'relative'}`}>
        
        {viewMode === 'DIRECTORY' ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 italic">
                <Store size={18} className="text-orange-500" /> Approved Vendors
              </h3>
              <button onClick={() => setViewMode('ONBOARDING')} className="bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                <Plus size={14} /> Onboard Vendor
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map(v => (
                <div key={v.id} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-orange-500/50 transition-colors">
                   <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-1">{v.name}</h4>
                   <div className="flex gap-4 mb-4">
                     <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest flex items-center gap-1"><Hash size={12}/> ACCT: {v.accountNum}</p>
                     <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest flex items-center gap-1">PRIORITY: {v.priority || 99}</p>
                   </div>
                   
                   <div className="space-y-3 text-xs font-medium text-slate-400">
                     <p className="flex items-start gap-3"><MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" /> {v.address}</p>
                     <p className="flex items-center gap-3"><Phone size={14} className="text-slate-500 shrink-0" /> {v.phone}</p>
                     <p className="flex items-center gap-3"><Globe size={14} className="text-slate-500 shrink-0" /> <a href={v.weblink} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{v.weblink.replace(/^https?:\/\//, '')}</a></p>
                   </div>

                   <button className="w-full mt-6 bg-slate-950 border border-slate-800 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white group-hover:bg-slate-800 transition-colors">
                     Initialize Purchase Order
                   </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
             <button onClick={() => setViewMode('DIRECTORY')} className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1 mb-6 hover:text-white transition-colors">
               <ArrowLeft size={12} /> Return to Directory
             </button>
             
             <h3 className="text-xl font-black uppercase text-white italic tracking-tighter mb-8 flex items-center gap-3">
               <Building2 size={24} className="text-orange-500" /> New Vendor Onboarding
             </h3>

             <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Vendor Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors" placeholder="e.g. Rush Truck Centers" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Account Number</label>
                    <input type="text" value={formData.accountNum} onChange={e => setFormData({...formData, accountNum: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors" placeholder="e.g. ACCT-1002" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Routing Priority (1=Highest)</label>
                    <input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors" placeholder="e.g. 1" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Support Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors" placeholder="512-555-0100" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Physical Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500 transition-colors" placeholder="123 Gear Blvd, Austin, TX" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">B2B Web Portal Link</label>
                  <input type="url" value={formData.weblink} onChange={e => setFormData({...formData, weblink: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-blue-400 font-mono text-sm outline-none focus:border-orange-500 transition-colors" placeholder="https://..." />
                </div>
             </div>

             <button onClick={handleOnboardVendor} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-orange-900/40 transition-colors">
               Authorize & Save Vendor
             </button>
          </div>
        )}

      </div>

      {isExpired && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-50 pointer-events-none">
          {/* Paywall Overlay Handled by CoreApp TrialGatekeeper */}
        </div>
      )}
    </div>
  );
};

export default IgnitionProc;
