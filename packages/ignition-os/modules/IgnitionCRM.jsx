/**
 * MODULE: CRM (Client Directory)
 * VERSION: v1.0.0
 * DESC: Manages Fleet Contracts, Friends & Family, and standard retail profiles.
 */
import React, { useState } from 'react';
import { Users, Plus, Building2, MapPin, Phone, Mail, ArrowLeft, Star, Car, User, Search } from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = true;

// Non-1:1 mappings (52 classNames converted):
// (1) md:grid-cols-2 lg:grid-cols-3 on customer grid → flex-wrap fixed (flagged: no breakpoint equivalent)
// (2) grid grid-cols-2 on form rows → flex-wrap fixed (flagged: no breakpoint equivalent)
// (3) hover:bg-indigo-500 on buttons → ign-btn-primary CSS class (blue approximation; flagged: no ign-btn-indigo)
// (4) active:scale-95 on buttons → ign-card-hover CSS class
// (5) focus:border-indigo-500 on inputs → ign-input CSS class (blue approximation; flagged)
// (6) hover:border-indigo-500/50 on cards → dropped (cosmetic)
// (7) hover:text-white on back button → dropped (cosmetic)
// (8) hover:text-slate-300 on inactive tabs → dropped (cosmetic)
// [TRACE:STYLE] IgnitionCRM converted, 52 classNames → inline, 8 non-1:1 categories

const labelStyle = {
  fontSize: 10,
  fontWeight: 900,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 8,
  display: 'block',
};

const inputStyle = {
  width: '100%',
  backgroundColor: '#000000',
  border: '1px solid #1e293b',
  borderRadius: 12,
  padding: 16,
  color: '#ffffff',
  fontWeight: 700,
  outline: 'none',
  transition: 'border-color 0.15s',
};

const getTierStyle = (tier) => {
  if (tier === 'FLEET') return { backgroundColor: 'rgba(249,115,22,0.20)', color: '#fb923c' };
  if (tier === 'FF')   return { backgroundColor: 'rgba(16,185,129,0.20)', color: '#34d399' };
  return { backgroundColor: '#1e293b', color: '#94a3b8' };
};

const getTypeIconStyle = (type) => {
  if (type === 'CONTRACT') return { backgroundColor: 'rgba(249,115,22,0.10)', color: '#f97316' };
  return { backgroundColor: 'rgba(59,130,246,0.10)', color: '#3b82f6' };
};

const IgnitionCRM = () => {
  const { isExpired } = DataBridge.checkTrialStatus('CRM');
  const [viewMode, setViewMode] = useState('DIRECTORY');
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

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionCRM converted, 52 classNames → inline, 8 non-1:1 categories');

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
    <div style={{ padding: 24, backgroundColor: '#020617', color: '#e2e8f0', minHeight: '100vh', position: 'relative', paddingBottom: 96 }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
          CRM // Clients
        </h2>
        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Fleet & Retail Profiles
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
            <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  {/* focus:border-indigo-500 → ign-input CSS class (blue approximation; flagged) */}
                  <input
                    type="text"
                    placeholder="Search by Name or Phone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="ign-input"
                    style={{
                      width: '100%',
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: 16,
                      paddingLeft: 48,
                      paddingRight: 16,
                      paddingTop: 16,
                      paddingBottom: 16,
                      color: '#ffffff',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                  />
                </div>
              </div>
              {/* hover:bg-indigo-500 → ign-btn-primary (blue approx; flagged); active:scale-95 → ign-card-hover */}
              <button
                onClick={() => setViewMode('ONBOARDING')}
                className="ign-btn-primary ign-card-hover"
                style={{
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontWeight: 900,
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingTop: 16,
                  paddingBottom: 16,
                  borderRadius: 16,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s',
                  boxShadow: '0 10px 15px -3px rgba(79,70,229,0.20)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> New Client
              </button>
            </div>

            {/* md:grid-cols-2 lg:grid-cols-3 → flex-wrap; flagged: no breakpoint equivalent */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {filteredCustomers.map(c => (
                /* hover:border-indigo-500/50 → dropped (cosmetic) */
                <div key={c.id} style={{
                  flex: '1 1 calc(33% - 18px)',
                  minWidth: 240,
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  padding: 24,
                  borderRadius: 32,
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 12, ...getTypeIconStyle(c.type) }}>
                        {c.type === 'CONTRACT' ? <Building2 size={20} /> : <User size={20} />}
                      </div>
                      <div>
                        <h4 style={{ color: '#ffffff', fontWeight: 900, fontSize: 18, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em' }}>{c.name}</h4>
                        <p style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{c.id}</p>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 900,
                      paddingLeft: 8,
                      paddingRight: 8,
                      paddingTop: 4,
                      paddingBottom: 4,
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      ...getTierStyle(c.tier),
                    }}>
                      {c.tier} TIER
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
                      <Phone size={14} style={{ color: '#64748b' }} /> {c.phone}
                    </p>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
                      <Mail size={14} style={{ color: '#64748b' }} /> {c.email || 'N/A'}
                    </p>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
                      <MapPin size={14} style={{ color: '#64748b' }} /> {c.address || 'N/A'}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Car size={12} /> Registered Assets
                    </p>
                    {c.vehicles?.map((v, i) => (
                      <div key={i} style={{
                        backgroundColor: '#020617',
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 8,
                        paddingBottom: 8,
                        borderRadius: 8,
                        border: '1px solid #1e293b',
                        marginBottom: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700 }}>{v.year} {v.make} {v.model}</span>
                        <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>{v.vin.slice(-6)}</span>
                      </div>
                    ))}
                    {(!c.vehicles || c.vehicles.length === 0) && (
                      <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>No assets registered yet.</p>
                    )}
                  </div>
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
            borderRadius: 40,
            padding: 32,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            {/* hover:text-white on back button → dropped (cosmetic) */}
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
              <ArrowLeft size={12} /> Back to Directory
            </button>

            <h3 style={{
              fontSize: 24,
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
              <Users size={28} style={{ color: '#6366f1' }} /> Client Onboarding
            </h3>

            {/* Tab bar */}
            <div style={{
              display: 'flex',
              backgroundColor: '#020617',
              padding: 4,
              borderRadius: 12,
              marginBottom: 32,
              border: '1px solid #1e293b',
            }}>
              {/* hover:text-slate-300 on inactive tabs → dropped (cosmetic) */}
              <button
                onClick={() => setFormData({...formData, type: 'PERSONAL', tier: 'STANDARD'})}
                style={{
                  flex: 1,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  borderRadius: 8,
                  transition: 'all 0.15s',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: formData.type === 'PERSONAL' ? '#1e293b' : 'transparent',
                  color: formData.type === 'PERSONAL' ? '#ffffff' : '#64748b',
                  boxShadow: formData.type === 'PERSONAL' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                Personal / Retail
              </button>
              <button
                onClick={() => setFormData({...formData, type: 'CONTRACT', tier: 'FLEET'})}
                style={{
                  flex: 1,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  borderRadius: 8,
                  transition: 'all 0.15s',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: formData.type === 'CONTRACT' ? '#ea580c' : 'transparent',
                  color: formData.type === 'CONTRACT' ? '#ffffff' : '#64748b',
                  boxShadow: formData.type === 'CONTRACT' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                Fleet / Contract
              </button>
            </div>

            {/* Form fields — grid grid-cols-2 → flex-wrap; flagged: no breakpoint equivalent */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
              <div>
                <label style={labelStyle}>Full Name / Company Name</label>
                {/* focus:border-indigo-500 → ign-input (blue approximation; flagged) */}
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="ign-input" style={inputStyle} placeholder="e.g. Texas Star Logistics" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: 160 }}>
                  <label style={labelStyle}>Primary Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="ign-input" style={inputStyle} placeholder="555-0199" />
                </div>
                <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: 160 }}>
                  <label style={labelStyle}>Billing Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    className="ign-input" style={inputStyle} placeholder="billing@domain.com" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Billing Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                  className="ign-input" style={inputStyle} placeholder="123 Fleet Way, Austin, TX" />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: 160 }}>
                  <label style={labelStyle}>Pricing Tier</label>
                  <select value={formData.tier} onChange={e => setFormData({...formData, tier: e.target.value})}
                    className="ign-input" style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="STANDARD">Standard Retail</option>
                    <option value="FF">Friends & Family (Custom Flat Rate)</option>
                    <option value="FLEET">Fleet Net (-$10/hr)</option>
                  </select>
                </div>
                {formData.type === 'CONTRACT' && (
                  <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: 160 }}>
                    <label style={labelStyle}>Contract Number</label>
                    {/* focus:border-orange-500 → ign-input-orange */}
                    <input type="text" value={formData.contractNum} onChange={e => setFormData({...formData, contractNum: e.target.value})}
                      className="ign-input-orange" style={{ ...inputStyle, color: '#fb923c', fontFamily: 'monospace', fontSize: 14 }} placeholder="TX-FLT-000" />
                  </div>
                )}
              </div>
            </div>

            {/* hover:bg-indigo-500 → ign-btn-primary (blue approx; flagged); active:scale-95 → ign-card-hover */}
            <button
              onClick={handleOnboardCustomer}
              className="ign-btn-primary ign-card-hover"
              style={{
                width: '100%',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                fontWeight: 900,
                paddingTop: 20,
                paddingBottom: 20,
                borderRadius: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: 10,
                boxShadow: '0 10px 15px -3px rgba(79,70,229,0.40)',
                transition: 'all 0.15s',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Star size={16} /> Finalize Client Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IgnitionCRM;
