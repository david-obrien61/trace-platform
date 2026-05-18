/**
 * MODULE: CRM (Client Directory)
 * VERSION: v1.0.0
 * DESC: Manages Fleet Contracts, Friends & Family, and standard retail profiles.
 */
import React, { useState } from 'react';
import { Users, Plus, Building2, MapPin, Phone, Mail, ArrowLeft, Star, Car, User, Search } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionCRM = () => {
  const { isExpired } = DataBridge.checkTrialStatus('CRM');
  const [viewMode, setViewMode] = useState('DIRECTORY'); // DIRECTORY, ONBOARDING
  const [customers, setCustomers] = useState(() => DataBridge.getCustomers());
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'PERSONAL',
    name: '',
    phone: '',
    email: '',
    address: '',
    tier: 'STANDARD',
    contractNum: ''
  });

  const handleOnboardCustomer = () => {
    if (!formData.name || !formData.phone) return alert("Name and Phone are strictly required for onboarding.");
    
    const newCustomer = { 
      ...formData, 
      id: `C-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicles: []
    };
    
    DataBridge.addCustomer(newCustomer);
    setCustomers(DataBridge.getCustomers());
    setViewMode('DIRECTORY');
    setFormData({ type: 'PERSONAL', name: '', phone: '', email: '', address: '', tier: 'STANDARD', contractNum: '' });
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen relative pb-32">
      <header className="mb-8 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-indigo-400">CRM // Clients</h2>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Fleet & Retail Profiles</p>
      </header>
      
      <div className={`${isExpired ? 'filter blur-md pointer-events-none opacity-30 relative' : 'relative'}`}>
        
        {viewMode === 'DIRECTORY' ? (
          <>
            <div className="flex gap-4 mb-8">
              <div className="flex-1">
                 <div className="relative">
                   <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                   <input 
                     type="text" 
                     placeholder="Search by Name or Phone..." 
                     value={searchTerm} 
                     onChange={e => setSearchTerm(e.target.value)}
                     className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-2xl pl-12 pr-4 py-4 text-white outline-none transition-colors"
                   />
                 </div>
              </div>
              <button 
                onClick={() => setViewMode('ONBOARDING')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-4 rounded-2xl uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
              >
                <Plus size={16} /> New Client
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl hover:border-indigo-500/50 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className={`p-3 rounded-xl ${c.type === 'CONTRACT' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                         {c.type === 'CONTRACT' ? <Building2 size={20} /> : <User size={20} />}
                       </div>
                       <div>
                         <h4 className="text-white font-black text-lg uppercase italic tracking-tighter">{c.name}</h4>
                         <p className="text-[10px] text-slate-500 font-mono tracking-widest">{c.id}</p>
                       </div>
                     </div>
                     <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                        c.tier === 'FLEET' ? 'bg-orange-500/20 text-orange-400' : 
                        c.tier === 'FF' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                     }`}>
                       {c.tier} TIER
                     </span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <p className="flex items-center gap-3 text-xs text-slate-300 font-medium"><Phone size={14} className="text-slate-500" /> {c.phone}</p>
                    <p className="flex items-center gap-3 text-xs text-slate-300 font-medium"><Mail size={14} className="text-slate-500" /> {c.email || 'N/A'}</p>
                    <p className="flex items-center gap-3 text-xs text-slate-300 font-medium"><MapPin size={14} className="text-slate-500" /> {c.address || 'N/A'}</p>
                  </div>

                  <div className="border-t border-slate-800 pt-4">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Car size={12}/> Registered Assets</p>
                     {c.vehicles?.map((v, i) => (
                        <div key={i} className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 mb-2 flex justify-between items-center">
                          <span className="text-xs text-slate-300 font-bold">{v.year} {v.make} {v.model}</span>
                          <span className="text-[9px] text-slate-600 font-mono">{v.vin.slice(-6)}</span>
                        </div>
                     ))}
                     {(!c.vehicles || c.vehicles.length === 0) && (
                       <p className="text-xs text-slate-600 italic">No assets registered yet.</p>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
            <button onClick={() => setViewMode('DIRECTORY')} className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1 mb-6 hover:text-white transition-colors">
               <ArrowLeft size={12} /> Back to Directory
            </button>

            <h3 className="text-2xl font-black uppercase text-white italic tracking-tighter mb-8 flex items-center gap-3">
               <Users size={28} className="text-indigo-500" /> Client Onboarding
            </h3>

            {/* Tabs for Type */}
            <div className="flex bg-slate-950 p-1 rounded-xl mb-8 border border-slate-800">
               <button onClick={() => setFormData({...formData, type: 'PERSONAL', tier: 'STANDARD'})} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${formData.type === 'PERSONAL' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Personal / Retail</button>
               <button onClick={() => setFormData({...formData, type: 'CONTRACT', tier: 'FLEET'})} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${formData.type === 'CONTRACT' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Fleet / Contract</button>
            </div>

            <div className="space-y-6 mb-8">
               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Full Name / Company Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Texas Star Logistics" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Primary Phone</label>
                    <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-colors" placeholder="555-0199" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Billing Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-colors" placeholder="billing@domain.com" />
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Billing Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-colors" placeholder="123 Fleet Way, Austin, TX" />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Pricing Tier</label>
                    <select value={formData.tier} onChange={e => setFormData({...formData, tier: e.target.value})} className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-colors appearance-none">
                      <option value="STANDARD">Standard Retail</option>
                      <option value="FF">Friends & Family (Custom Flat Rate)</option>
                      <option value="FLEET">Fleet Net (-$10/hr)</option>
                    </select>
                  </div>
                  {formData.type === 'CONTRACT' && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Contract Number</label>
                      <input type="text" value={formData.contractNum} onChange={e => setFormData({...formData, contractNum: e.target.value})} className="w-full bg-black border border-slate-800 rounded-xl p-4 text-orange-400 font-mono text-sm outline-none focus:border-orange-500 transition-colors" placeholder="TX-FLT-000" />
                    </div>
                  )}
               </div>
            </div>

            <button onClick={handleOnboardCustomer} className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-900/40 transition-all flex justify-center items-center gap-2">
               <Star size={16} /> Finalize Client Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IgnitionCRM;
