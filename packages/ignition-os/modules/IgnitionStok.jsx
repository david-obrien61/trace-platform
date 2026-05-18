/**
 * MODULE: STOK (Relational Inventory Sync)
 * VERSION: v1.0.0
 * DESC: Inventory management synced to DTC fault codes and bin locations.
 */

import React, { useState } from 'react';
import { Box, Search, Package, MapPin, AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionStok = ({ initialSearchTerm = '' }) => {
  const { isExpired } = DataBridge.checkTrialStatus('STOK');
  
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const currentUser = DataBridge.load('current_user');
    const shopId = currentUser?.shop_id || DataBridge.load('shop_info')?.id;
    if (!shopId) {
      setLoading(false);
      return;
    }

    // Dynamic import to avoid breaking if not present at top level
    const { supabase } = await import('../supabase');
    const { data, error } = await supabase.from('inventory').select('*').eq('shop_id', shopId);
    
    if (!error && data) {
      const mapped = data.map(item => ({
        id: item.id,
        name: item.name,
        partNum: item.part_number || 'N/A',
        qty: item.qty || 0,
        bin: item.bin_location || 'UNASSIGNED',
        cost: item.unit_cost || 0,
        fits: item.fits_codes || []
      }));
      setInventory(mapped);
    }
    setLoading(false);
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.partNum.includes(searchTerm) ||
    item.fits.some(fit => fit.includes(searchTerm))
  );

  return (
    <div className="p-6 bg-slate-900 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-blue-500">STOK // Inventory Sync</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Leander Shop Stock // Relational Engine</p>
        </div>
        {isExpired && <span className="text-[9px] font-black text-red-500 border border-red-500/20 px-2 py-1 rounded uppercase">Locked</span>}
      </header>

      {/* SEARCH BAR (Supports Fault Code Search) */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-4 text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Search by Part Name, #, or Fault Code (e.g. 3216)" 
          className="w-full bg-slate-800 border border-slate-700 p-4 pl-12 rounded-2xl text-white outline-none focus:border-blue-500 transition-all font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* INVENTORY GRID */}
      <div className="grid gap-4">
        {filteredInventory.map(item => (
          <div key={item.id} className="bg-slate-800 p-5 rounded-3xl border border-slate-700 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-white italic uppercase tracking-tighter">{item.name}</h3>
                <p className="text-[10px] font-mono text-slate-500">{item.partNum}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase">Stock Level</p>
                <p className={`text-xl font-black ${item.qty > 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                  {item.qty} UNITS
                </p>
              </div>
            </div>

            {/* RELATIONAL DATA (Blurred if Expired) */}
            <div className={`mt-4 grid grid-cols-2 gap-3 transition-all ${isExpired ? 'filter blur-md opacity-30 select-none pointer-events-none' : ''}`}>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                <MapPin size={16} className="text-blue-500" />
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Bin Location</p>
                  <p className="text-xs font-bold text-white uppercase">{item.bin}</p>
                </div>
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                <Package size={16} className="text-emerald-500" />
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Wholesale Cost</p>
                  <p className="text-xs font-bold text-white">${item.cost}</p>
                </div>
              </div>
            </div>

            {/* PAYWALL OVERLAY */}
            {isExpired && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 text-center p-4">
                <Lock size={20} className="text-blue-500 mb-1" />
                <p className="text-[10px] font-black text-white uppercase italic">Subscription Required</p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-center p-10 text-slate-500 italic">Loading inventory...</div>
        )}
        {!loading && filteredInventory.length === 0 && (
          <div className="text-center p-10 text-slate-500 italic">
            No inventory found matching "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};

export default IgnitionStok;
