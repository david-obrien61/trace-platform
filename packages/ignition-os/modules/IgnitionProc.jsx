/**
 * MODULE: PROC (Parts Procurement)
 * VERSION: v1.1.0
 * DESC: Manage external purchase orders, vendor directory, and partner onboarding.
 */
import React, { useState } from 'react';
import { Truck, Store, Plus, Building2, MapPin, Phone, Globe, Hash, ArrowLeft } from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (40 classNames converted):
// (1) hover:bg-orange-500 on primary buttons → ign-btn-orange CSS class
// (2) hover:border-orange-500/50 on vendor cards → dropped (cosmetic)
// (3) group-hover:text-white group-hover:bg-slate-800 on PO button → dropped (group hover)
// (4) hover:text-white on back button → dropped (cosmetic)
// (5) hover:underline on vendor link → dropped (cosmetic)
// (6) focus:border-orange-500 on all inputs → ign-input-orange CSS class
// (7) md:grid-cols-2 lg:grid-cols-3 → flex-wrap fixed; flagged (no breakpoint equivalent)
// [TRACE:STYLE] IgnitionProc converted, 40 classNames → inline, 7 non-1:1 categories

const inputStyle = {
  width: '100%',
  backgroundColor: '#020617',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: 16,
  color: '#ffffff',
  fontWeight: 700,
  outline: 'none',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 900,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 8,
  display: 'block',
};

const IgnitionProc = () => {
  const { isExpired } = DataBridge.checkTrialStatus('PROC');
  const [viewMode, setViewMode] = useState('DIRECTORY');
  const [vendors, setVendors] = useState(() => DataBridge.getVendors());

  const [formData, setFormData] = useState({ name: '', address: '', phone: '', weblink: '', accountNum: '', priority: '' });

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionProc converted, 40 classNames → inline, 7 non-1:1 categories');

  const handleOnboardVendor = () => {
    if (!formData.name || !formData.accountNum) return alert("Vendor Name and Account Number are required.");
    const newVendor = { ...formData, id: `V-${Math.floor(Math.random() * 10000)}`, priority: parseInt(formData.priority) || 99 };
    DataBridge.addVendor(newVendor);
    setVendors(DataBridge.getVendors());
    setViewMode('DIRECTORY');
    setFormData({ name: '', address: '', phone: '', weblink: '', accountNum: '', priority: '' });
  };

  return (
    <div style={{ padding: 24, backgroundColor: '#020617', color: '#e2e8f0', minHeight: '100%', position: 'relative' }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#10b981', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
          PROC // Procurement
        </h2>
        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Vendor Routing & Directory
        </p>
      </header>

      <div style={{
        position: 'relative',
        filter: isExpired ? 'blur(12px)' : 'none',
        pointerEvents: isExpired ? 'none' : undefined,
        opacity: isExpired ? 0.3 : 1,
      }}>

        {viewMode === 'DIRECTORY' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, fontStyle: 'italic' }}>
                <Store size={18} style={{ color: '#f97316' }} /> Approved Vendors
              </h3>
              {/* hover:bg-orange-500 → ign-btn-orange CSS class */}
              <button
                onClick={() => setViewMode('ONBOARDING')}
                className="ign-btn-orange"
                style={{
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  padding: '8px 16px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                <Plus size={14} /> Onboard Vendor
              </button>
            </div>

            {/* md:grid-cols-2 lg:grid-cols-3 → flex-wrap; flagged: no breakpoint */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {vendors.map(v => (
                <div key={v.id} style={{
                  flex: '1 1 calc(33% - 18px)',
                  minWidth: 240,
                  backgroundColor: '#0f172a',
                  padding: 24,
                  borderRadius: 24,
                  border: '1px solid #1e293b',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                  transition: 'border-color 0.15s',
                }}>
                  <h4 style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>
                    {v.name}
                  </h4>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 10, color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Hash size={12} /> ACCT: {v.accountNum}
                    </p>
                    <p style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      PRIORITY: {v.priority || 99}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
                    <p style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <MapPin size={14} style={{ color: '#64748b', flexShrink: 0, marginTop: 2 }} /> {v.address}
                    </p>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Phone size={14} style={{ color: '#64748b', flexShrink: 0 }} /> {v.phone}
                    </p>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Globe size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                      <a href={v.weblink} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                        {v.weblink.replace(/^https?:\/\//, '')}
                      </a>
                    </p>
                  </div>

                  {/* group-hover effects on PO button → dropped */}
                  <button style={{
                    width: '100%',
                    marginTop: 24,
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    padding: '12px 0',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                    Initialize Purchase Order
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{
            maxWidth: 672,
            margin: '0 auto',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            {/* hover:text-white on back button → dropped */}
            <button
              onClick={() => setViewMode('DIRECTORY')}
              style={{
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 24,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              <ArrowLeft size={12} /> Return to Directory
            </button>

            <h3 style={{
              fontSize: 20,
              fontWeight: 900,
              textTransform: 'uppercase',
              color: '#ffffff',
              fontStyle: 'italic',
              letterSpacing: '-0.05em',
              marginBottom: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <Building2 size={24} style={{ color: '#f97316' }} /> New Vendor Onboarding
            </h3>

            {/* focus:border-orange-500 → ign-input-orange CSS class on all inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              <div>
                <label style={labelStyle}>Vendor Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="ign-input-orange" style={inputStyle} placeholder="e.g. Rush Truck Centers" />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Account Number</label>
                  <input type="text" value={formData.accountNum} onChange={e => setFormData({...formData, accountNum: e.target.value})}
                    className="ign-input-orange" style={inputStyle} placeholder="e.g. ACCT-1002" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Routing Priority (1=Highest)</label>
                  <input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}
                    className="ign-input-orange" style={inputStyle} placeholder="e.g. 1" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Support Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="ign-input-orange" style={inputStyle} placeholder="512-555-0100" />
              </div>
              <div>
                <label style={labelStyle}>Physical Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                  className="ign-input-orange" style={inputStyle} placeholder="123 Gear Blvd, Austin, TX" />
              </div>
              <div>
                <label style={labelStyle}>B2B Web Portal Link</label>
                <input type="url" value={formData.weblink} onChange={e => setFormData({...formData, weblink: e.target.value})}
                  className="ign-input-orange" style={{ ...inputStyle, color: '#60a5fa', fontFamily: 'monospace', fontSize: 14 }} placeholder="https://..." />
              </div>
            </div>

            {/* hover:bg-orange-500 → ign-btn-orange CSS class */}
            <button
              onClick={handleOnboardVendor}
              className="ign-btn-orange"
              style={{
                width: '100%',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                fontWeight: 900,
                paddingTop: 20,
                paddingBottom: 20,
                borderRadius: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: 10,
                boxShadow: '0 10px 15px -3px rgba(154,52,18,0.4)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              Authorize & Save Vendor
            </button>
          </div>
        )}

      </div>

      {isExpired && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          {/* Paywall Overlay Handled by CoreApp TrialGatekeeper */}
        </div>
      )}
    </div>
  );
};

export default IgnitionProc;
