/**
 * FILE: PriceField.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Input field enforcing margin matrix pricing logic with admin override controls and leakage detection.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { MarginEngine } from './MarginEngine';
import DataBridge from './DataBridge';

const PriceField = ({ cost, initialPrice, onUpdate }) => {
  const [isLocked, setIsLocked] = useState(true);
  const [price, setPrice] = useState(initialPrice || 0);
  
  const currentUser = DataBridge.load('current_user');
  const isAdmin = currentUser?.permissions?.includes('ADMIN') || false;
  
  const suggestedPrice = MarginEngine.calculateRetail(cost);

  // Sync price if it's locked and cost changes
  useEffect(() => {
    if (isLocked) {
      setPrice(suggestedPrice);
    }
  }, [cost, isLocked, suggestedPrice]);

  const handlePriceChange = (e) => {
    const newPrice = parseFloat(e.target.value);
    setPrice(newPrice);
    
    // Relationship Tax MetaData
    const isOverride = newPrice < suggestedPrice;
    
    if (onUpdate) {
      onUpdate({
        finalPrice: newPrice,
        isOverride: isOverride,
        suggestedPrice: suggestedPrice,
        leakage: isOverride ? (suggestedPrice - newPrice) : 0
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-inner w-full">
      <div className="flex justify-between items-center mb-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Retail Price (USD)
        </label>
        
        {isAdmin && (
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-1 rounded-full transition-all ${
              isLocked ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-orange-600/20 text-orange-500 animate-pulse'
            }`}
          >
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            {isLocked ? 'Locked' : 'Override Active'}
          </button>
        )}
      </div>

      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-700">$</span>
        <input 
          type="number"
          value={isNaN(price) ? '' : price}
          readOnly={isLocked}
          onChange={handlePriceChange}
          step="0.01"
          className={`w-full bg-transparent pl-6 text-3xl font-black outline-none transition-colors ${
            isLocked ? 'text-white' : 'text-orange-500'
          }`}
        />
      </div>

      {!isLocked && price < suggestedPrice && (
        <div className="mt-3 flex items-center gap-2 text-orange-400/80 bg-orange-400/5 p-2 rounded-lg border border-orange-400/10">
          <AlertCircle size={14} />
          <p className="text-[9px] font-bold uppercase tracking-tighter">
            Relationship Tax: -${(suggestedPrice - price).toFixed(2)} detected
          </p>
        </div>
      )}
    </div>
  );
};

export default PriceField;
