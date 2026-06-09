/**
 * MODULE: STOK (Relational Inventory Sync)
 * VERSION: v1.0.0
 * DESC: Inventory management synced to DTC fault codes and bin locations.
 */

import React, { useState, useEffect } from 'react';
import { Box, Search, Package, MapPin, AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (30 classNames converted):
// (1) focus:border-blue-500 on search input → ign-input CSS class handles focus
// grid-cols-2 → flex with 50% width children (1:1 functionally for 2-col)
// filter blur-md → filter: 'blur(12px)' inline (1:1)
// [TRACE:STYLE] IgnitionStok converted, 30 classNames → inline, 1 non-1:1 category

const IgnitionStok = ({ initialSearchTerm = '' }) => {
  const { isExpired } = DataBridge.checkTrialStatus('STOK');

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionStok converted, 30 classNames → inline, 1 non-1:1 category');

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
    <div style={{ padding: 24, backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100%' }}>
      <header style={{
        marginBottom: 32,
        borderBottom: '1px solid #1e293b',
        paddingBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
            STOK // Inventory Sync
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Leander Shop Stock // Relational Engine
          </p>
        </div>
        {isExpired && (
          <span style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.20)',
            padding: '4px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}>
            Locked
          </span>
        )}
      </header>

      {/* SEARCH BAR — focus:border-blue-500 → ign-input CSS class */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <Search style={{ position: 'absolute', left: 16, top: 16, color: '#64748b' }} size={20} />
        <input
          type="text"
          placeholder="Search by Part Name, #, or Fault Code (e.g. 3216)"
          className="ign-input"
          style={{
            width: '100%',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            padding: 16,
            paddingLeft: 48,
            borderRadius: 16,
            color: '#ffffff',
            outline: 'none',
            fontWeight: 700,
            transition: 'border-color 0.15s',
          }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* INVENTORY LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filteredInventory.map(item => (
          <div key={item.id} style={{
            backgroundColor: '#1e293b',
            padding: 20,
            borderRadius: 24,
            border: '1px solid #334155',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontWeight: 900, color: '#ffffff', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                  {item.name}
                </h3>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>{item.partNum}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Stock Level</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: item.qty > 0 ? '#34d399' : '#ef4444' }}>
                  {item.qty} UNITS
                </p>
              </div>
            </div>

            {/* RELATIONAL DATA — filter:blur-md is 1:1 inline */}
            <div style={{
              marginTop: 16,
              display: 'flex',
              gap: 12,
              transition: 'all 0.15s',
              filter: isExpired ? 'blur(12px)' : 'none',
              opacity: isExpired ? 0.3 : 1,
              userSelect: isExpired ? 'none' : undefined,
              pointerEvents: isExpired ? 'none' : undefined,
            }}>
              <div style={{
                flex: 1,
                backgroundColor: '#0f172a',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <MapPin size={16} style={{ color: '#3b82f6' }} />
                <div>
                  <p style={{ fontSize: 8, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', lineHeight: 1 }}>Bin Location</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>{item.bin}</p>
                </div>
              </div>
              <div style={{
                flex: 1,
                backgroundColor: '#0f172a',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <Package size={16} style={{ color: '#10b981' }} />
                <div>
                  <p style={{ fontSize: 8, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', lineHeight: 1 }}>Wholesale Cost</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>${item.cost}</p>
                </div>
              </div>
            </div>

            {/* PAYWALL OVERLAY */}
            {isExpired && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(15,23,42,0.40)',
                textAlign: 'center',
                padding: 16,
              }}>
                <Lock size={20} style={{ color: '#3b82f6', marginBottom: 4 }} />
                <p style={{ fontSize: 10, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic' }}>
                  Subscription Required
                </p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontStyle: 'italic' }}>
            Loading inventory...
          </div>
        )}
        {!loading && filteredInventory.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontStyle: 'italic' }}>
            No inventory found matching "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
};

export default IgnitionStok;
