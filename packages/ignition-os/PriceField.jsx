/**
 * FILE: PriceField.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Input field enforcing margin matrix pricing logic with admin override controls.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { MarginEngine } from './MarginEngine';
import DataBridge from './DataBridge';

const STYLE_DEBUG = true;

// Non-1:1 mappings:
// (1) hover:bg-slate-700 on lock toggle → ign-btn-secondary CSS class
// (2) animate-pulse on Override Active badge → ign-pulse CSS class
// (3) transition-all → style transition prop (1:1 preserved)
// [TRACE:STYLE] PriceField converted, 9 classNames → inline, 2 non-1:1:
//   (1) hover:bg-slate-700 → ign-btn-secondary CSS class
//   (2) animate-pulse → ign-pulse CSS class

const PriceField = ({ cost, initialPrice, onUpdate }) => {
  const [isLocked, setIsLocked] = useState(true);
  const [price, setPrice] = useState(initialPrice || 0);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] PriceField converted, 9 classNames → inline, 2 non-1:1');

  const currentUser = DataBridge.load('current_user');
  const isAdmin = currentUser?.permissions?.includes('ADMIN') || false;
  const suggestedPrice = MarginEngine.calculateRetail(cost);

  useEffect(() => {
    if (isLocked) setPrice(suggestedPrice);
  }, [cost, isLocked, suggestedPrice]);

  const handlePriceChange = (e) => {
    const newPrice = parseFloat(e.target.value);
    setPrice(newPrice);
    const isOverride = newPrice < suggestedPrice;
    if (onUpdate) {
      onUpdate({
        finalPrice: newPrice,
        isOverride,
        suggestedPrice,
        leakage: isOverride ? (suggestedPrice - newPrice) : 0,
      });
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 24,
      padding: 20,
      width: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Retail Price (USD)
        </label>

        {isAdmin && (
          isLocked ? (
            <button
              className="ign-btn-secondary"
              onClick={() => setIsLocked(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: 9999,
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                border: 'none',
              }}
            >
              <Lock size={12} /> Locked
            </button>
          ) : (
            <button
              className="ign-pulse"
              onClick={() => setIsLocked(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: 9999,
                backgroundColor: 'rgba(234,88,12,0.2)',
                color: '#f97316',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Unlock size={12} /> Override Active
            </button>
          )
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 24,
          fontWeight: 900,
          color: '#334155',
        }}>$</span>
        <input
          type="number"
          value={isNaN(price) ? '' : price}
          readOnly={isLocked}
          onChange={handlePriceChange}
          step="0.01"
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            paddingLeft: 24,
            fontSize: 30,
            fontWeight: 900,
            outline: 'none',
            border: 'none',
            transition: 'color 0.15s',
            color: isLocked ? '#ffffff' : '#f97316',
          }}
        />
      </div>

      {!isLocked && price < suggestedPrice && (
        <div style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'rgba(251,146,60,0.8)',
          backgroundColor: 'rgba(251,146,60,0.05)',
          padding: 8,
          borderRadius: 8,
          border: '1px solid rgba(251,146,60,0.1)',
        }}>
          <AlertCircle size={14} />
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
            Relationship Tax: -${(suggestedPrice - price).toFixed(2)} detected
          </p>
        </div>
      )}
    </div>
  );
};

export default PriceField;
