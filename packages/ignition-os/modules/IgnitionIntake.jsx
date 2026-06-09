/**
 * MODULE: IgnitionIntake (Web)
 * VERSION: v1.0.0
 * DESC: Zone 1 intake form. Creates customer, vehicle, and job rows in Supabase.
 *       Three-phase flow: Customer → Vehicle → Job Details → Commit.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  User, Phone, Mail, Car, ChevronRight, AlertCircle, Gauge,
  Calendar, Plus, Search, X, CheckCircle2, ClipboardList,
  ArrowLeft, Loader2, Clock, ShieldCheck,
} from 'lucide-react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (90 classNames converted):
// (1) hover:border-blue-500 / hover:bg-slate-800 / hover:border-slate-600 / hover:text-* → dropped (cosmetic)
// (2) transition-colors / transition-all → dropped (no inline equivalent)
// (3) animate-spin on Loader2 → ign-spin CSS class
// (4) active:scale-95 on 4 buttons → ign-card-hover CSS class
// (5) active:scale-[0.98] on vehicle select buttons → ign-card-hover (approx)
// (6) focus-within:border-blue-500 on TextInput/Textarea wrappers → dropped (cosmetic; no inline focus-within)
// (7) placeholder-slate-600 → CSS-only; no inline equivalent
// (8) space-y-3 in vehicle list → gap on flex column
// (9) grid grid-cols-2/3 → display: grid + gridTemplateColumns
// (10) last:border-0 on search results → conditional JS borderBottom check
// (11) shadow-lg shadow-blue-900/30 → boxShadow inline
// (12) shadow-lg shadow-emerald-900/40 → boxShadow inline
// (13) shadow-2xl → boxShadow inline
// (14) relative/absolute positioning on search dropdown → position: absolute
// (15) flex-2 min-w-[60%] on continue buttons → flex: 2, minWidth: '60%'
// (16) bg-transparent on input/textarea → background: 'transparent'
// (TRACE:STYLE) IgnitionIntake converted, 90 classNames → inline, 16 non-1:1 categories

// ─── helpers ─────────────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
    <div style={{ flex: 1, height: 1, backgroundColor: '#1e293b' }} />
    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>{children}</span>
    <div style={{ flex: 1, height: 1, backgroundColor: '#1e293b' }} />
  </div>
);

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: 8 }}>{label}</label>
    {children}
    {hint && <p style={{ fontSize: 9, color: '#334155', marginTop: 6, fontWeight: 700 }}>{hint}</p>}
  </div>
);

const TextInput = ({ icon: Icon, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '0 16px' }}>
    {Icon && <Icon size={16} style={{ color: '#64748b', marginRight: 12, flexShrink: 0 }} />}
    <input
      style={{ flex: 1, background: 'transparent', padding: '16px 0', color: '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
      {...props}
    />
  </div>
);

const Textarea = ({ icon: Icon, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '16px 16px 0' }}>
    {Icon && <Icon size={16} style={{ color: '#64748b', marginRight: 12, marginTop: 2, flexShrink: 0 }} />}
    <textarea
      style={{ flex: 1, background: 'transparent', paddingBottom: 16, color: '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none', resize: 'none' }}
      rows={3}
      {...props}
    />
  </div>
);

const PhaseBar = ({ phase }) => {
  const steps  = ['customer', 'vehicle', 'job'];
  const labels = ['Customer', 'Vehicle', 'Job Details'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
      {steps.map((s, i) => {
        const phaseIdx  = steps.indexOf(phase);
        const isPast    = phaseIdx > i;
        const isCurrent = phase === s;
        const opacity   = isCurrent ? 1 : isPast ? 0.6 : 0.2;
        const circleBg  = isPast ? '#059669' : isCurrent ? '#2563eb' : 'transparent';
        const circleBd  = isPast ? '#059669' : isCurrent ? '#2563eb' : '#334155';
        const circleClr = isPast || isCurrent ? '#ffffff' : '#64748b';
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, border: `1px solid ${circleBd}`, backgroundColor: circleBg, color: circleClr }}>
                {isPast ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{labels[i]}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, backgroundColor: '#1e293b' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

export default function IgnitionIntake({ onJobCreated, onBack }) {
  const currentUser = DataBridge.load('current_user');
  const shopId = currentUser?.shop_id || DataBridge.load('shop_info')?.id;

  const [phase, setPhase] = useState('customer');

  // Customer
  const [search, setSearch]               = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCust, setNewCust]             = useState({ first_name: '', last_name: '', phone: '', email: '' });

  // Vehicle
  const [vehicles, setVehicles]           = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isNewVehicle, setIsNewVehicle]   = useState(false);
  const [newVeh, setNewVeh]               = useState({ year: '', make: '', model: '', trim: '', vin: '', license_plate: '', color: '' });

  // Job
  const [complaint, setComplaint]         = useState('');
  const [mileageIn, setMileageIn]         = useState('');
  const [promisedAt, setPromisedAt]       = useState('');
  const [waiting, setWaiting]             = useState(false);
  const [advisories, setAdvisories]       = useState('');

  // UI
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const debounce = useRef(null);

  // ── debounced Supabase customer search ──────────────────────────────────────
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from('customers').select('*')
        .eq('shop_id', shopId)
        .or(`phone.ilike.%${search}%,last_name.ilike.%${search}%,first_name.ilike.%${search}%`)
        .limit(6);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
  }, [search]);

  // ── phase transitions ───────────────────────────────────────────────────────

  const selectCustomer = async (c) => {
    setSelectedCustomer(c);
    setSearch('');
    setSearchResults([]);
    setIsNewCustomer(false);
    const { data } = await supabase.from('customer_vehicles').select('*')
      .eq('customer_id', c.id).order('created_at', { ascending: false });
    setVehicles(data || []);
    setPhase('vehicle');
  };

  const confirmNewCustomer = () => {
    if (!newCust.first_name.trim() || !newCust.phone.trim()) {
      setError('First name and phone are required.');
      return;
    }
    setError('');
    setSelectedCustomer({ ...newCust, _isNew: true });
    setVehicles([]);
    setIsNewCustomer(false);
    setPhase('vehicle');
  };

  const selectVehicle = (v) => {
    setSelectedVehicle(v);
    setIsNewVehicle(false);
    setPhase('job');
  };

  const confirmNewVehicle = () => {
    if (!newVeh.make.trim() || !newVeh.model.trim()) {
      setError('Make and model are required.');
      return;
    }
    setError('');
    setSelectedVehicle({ ...newVeh, _isNew: true });
    setIsNewVehicle(false);
    setPhase('job');
  };

  // ── final submit ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!complaint.trim()) { setError('Primary complaint is required.'); return; }
    setError('');
    setSaving(true);

    try {
      let customerId = selectedCustomer?.id;
      if (selectedCustomer?._isNew) {
        const { data: cust, error: e } = await supabase.from('customers').insert({
          shop_id:    shopId,
          first_name: newCust.first_name.trim(),
          last_name:  newCust.last_name.trim() || null,
          phone:      newCust.phone.trim(),
          email:      newCust.email.trim() || null,
        }).select().single();
        if (e) throw e;
        customerId = cust.id;
      }

      let vehicleId = selectedVehicle?.id;
      const mileageNum = parseInt(mileageIn.replace(/\D/g, '')) || null;
      if (selectedVehicle?._isNew) {
        const { data: veh, error: e } = await supabase.from('customer_vehicles').insert({
          shop_id:       shopId,
          customer_id:   customerId,
          year:          newVeh.year.trim()          || null,
          make:          newVeh.make.trim()          || null,
          model:         newVeh.model.trim()         || null,
          trim:          newVeh.trim.trim()          || null,
          vin:           newVeh.vin.trim()           || null,
          license_plate: newVeh.license_plate.trim() || null,
          color:         newVeh.color.trim()         || null,
          mileage_last:  mileageNum,
        }).select().single();
        if (e) throw e;
        vehicleId = veh.id;
      } else if (vehicleId && mileageNum) {
        await supabase.from('customer_vehicles').update({ mileage_last: mileageNum }).eq('id', vehicleId);
      }

      const veh  = selectedVehicle;
      const cust = selectedCustomer;
      const woNum = `RO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: job, error: e } = await supabase.from('jobs').insert({
        shop_id:           shopId,
        wo_number:         woNum,
        status:            'intake',
        customer_id:       customerId,
        vehicle_id:        vehicleId,
        service_writer_id: currentUser?.member_id || null,
        complaint:         complaint.trim(),
        mileage_in:        mileageNum,
        promised_at:       promisedAt || null,
        waiting_status:    waiting,
        notes:             advisories.trim() || null,
        customer: {
          name:  `${cust.first_name || ''} ${cust.last_name || ''}`.trim(),
          phone: cust.phone,
          email: cust.email || null,
        },
        vehicle: {
          year:         veh.year,
          make:         veh.make,
          model:        veh.model,
          vin:          veh.vin  || null,
          licensePlate: veh.license_plate || null,
        },
      }).select().single();
      if (e) throw e;

      onJobCreated?.(job);
    } catch (err) {
      setError(err.message || 'Failed to create RO. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', padding: '24px 24px 128px' }}>
      <div style={{ maxWidth: 576, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          {onBack && (
            <button onClick={onBack} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', margin: 0 }}>New Repair Order</h1>
            <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              {currentUser?.name ? `Service Advisor: ${currentUser.name}` : 'ZONE 1 // INTAKE'}
            </p>
          </div>
        </div>

        <PhaseBar phase={phase} />

        {error && (
          <div style={{ backgroundColor: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
            <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, margin: 0 }}>{error}</p>
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PHASE 1 — CUSTOMER
        ═══════════════════════════════════════════════════════ */}
        {phase === 'customer' && (
          <div>
            <SectionLabel>Find or Create Customer</SectionLabel>

            {!isNewCustomer ? (
              <>
                {/* Search */}
                <Field label="Search by name or phone">
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '0 16px' }}>
                      <Search size={16} style={{ color: '#64748b', marginRight: 12, flexShrink: 0 }} />
                      <input
                        style={{ flex: 1, background: 'transparent', padding: '16px 0', color: '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                        placeholder="Mike Torres / (512) 555…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                      />
                      {searching && <Loader2 size={14} className="ign-spin" style={{ color: '#60a5fa' }} />}
                      {search && !searching && (
                        <button onClick={() => { setSearch(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                          <X size={14} style={{ color: '#64748b' }} />
                        </button>
                      )}
                    </div>

                    {/* Results dropdown */}
                    {searchResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden', zIndex: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        {searchResults.map((c, idx) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: idx < searchResults.length - 1 ? '1px solid #1e293b' : 'none', background: 'none', cursor: 'pointer' }}
                          >
                            <div style={{ textAlign: 'left' }}>
                              <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, margin: 0 }}>{c.first_name} {c.last_name}</p>
                              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                            </div>
                            <ChevronRight size={16} style={{ color: '#475569' }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#1e293b' }} />
                  <span style={{ fontSize: 9, color: '#334155', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>or</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#1e293b' }} />
                </div>

                <button
                  onClick={() => { setIsNewCustomer(true); setError(''); }}
                  className="ign-card-hover"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#ffffff', fontWeight: 900, padding: '16px 0', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, cursor: 'pointer' }}
                >
                  <Plus size={14} /> New Customer
                </button>
              </>
            ) : (
              /* New customer form */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="First Name *">
                    <TextInput
                      icon={User}
                      placeholder="Mike"
                      value={newCust.first_name}
                      onChange={e => setNewCust(p => ({ ...p, first_name: e.target.value }))}
                      autoFocus
                    />
                  </Field>
                  <Field label="Last Name">
                    <TextInput
                      placeholder="Torres"
                      value={newCust.last_name}
                      onChange={e => setNewCust(p => ({ ...p, last_name: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Phone *">
                  <TextInput
                    icon={Phone}
                    type="tel"
                    placeholder="(512) 555-0199"
                    value={newCust.phone}
                    onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))}
                  />
                </Field>
                <Field label="Email (for estimates & invoices)">
                  <TextInput
                    icon={Mail}
                    type="email"
                    placeholder="mike@email.com"
                    value={newCust.email}
                    onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))}
                  />
                </Field>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    onClick={() => { setIsNewCustomer(false); setError(''); }}
                    style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8', fontWeight: 900, padding: '16px 0', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, cursor: 'pointer' }}
                  >
                    Back to Search
                  </button>
                  <button
                    onClick={confirmNewCustomer}
                    className="ign-card-hover"
                    style={{ flex: 2, minWidth: '60%', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, padding: '16px 0', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(30,58,138,0.3)' }}
                  >
                    Continue <ChevronRight size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PHASE 2 — VEHICLE
        ═══════════════════════════════════════════════════════ */}
        {phase === 'vehicle' && (
          <div>
            {/* Customer summary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} style={{ color: '#818cf8' }} />
                </div>
                <div>
                  <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 900, margin: 0 }}>
                    {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                  </p>
                  <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{selectedCustomer?.phone}</p>
                </div>
              </div>
              <button onClick={() => { setPhase('customer'); setSelectedCustomer(null); }} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            <SectionLabel>Select or Add Vehicle</SectionLabel>

            {/* Existing vehicles */}
            {vehicles.length > 0 && !isNewVehicle && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {vehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => selectVehicle(v)}
                    className="ign-card-hover"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: '16px', borderRadius: 12, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                      <Car size={18} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, margin: 0 }}>{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}</p>
                        <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                          {v.license_plate && `${v.license_plate} · `}
                          {v.vin ? `VIN …${v.vin.slice(-6)}` : 'No VIN'}
                          {v.mileage_last ? ` · ${v.mileage_last.toLocaleString()} mi` : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>
                ))}
              </div>
            )}

            {/* New vehicle form */}
            {isNewVehicle ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <Field label="Year">
                    <TextInput
                      placeholder="2019"
                      value={newVeh.year}
                      onChange={e => setNewVeh(p => ({ ...p, year: e.target.value }))}
                      maxLength={4}
                    />
                  </Field>
                  <Field label="Make *">
                    <TextInput
                      placeholder="Toyota"
                      value={newVeh.make}
                      onChange={e => setNewVeh(p => ({ ...p, make: e.target.value }))}
                      autoFocus
                    />
                  </Field>
                  <Field label="Model *">
                    <TextInput
                      placeholder="Camry"
                      value={newVeh.model}
                      onChange={e => setNewVeh(p => ({ ...p, model: e.target.value }))}
                    />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Trim / Sub-Model">
                    <TextInput
                      placeholder="LE / SE / XSE"
                      value={newVeh.trim}
                      onChange={e => setNewVeh(p => ({ ...p, trim: e.target.value }))}
                    />
                  </Field>
                  <Field label="Color">
                    <TextInput
                      placeholder="Silver"
                      value={newVeh.color}
                      onChange={e => setNewVeh(p => ({ ...p, color: e.target.value }))}
                    />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="License Plate">
                    <TextInput
                      placeholder="DL2Z482"
                      value={newVeh.license_plate}
                      onChange={e => setNewVeh(p => ({ ...p, license_plate: e.target.value.toUpperCase() }))}
                    />
                  </Field>
                  <Field label="VIN">
                    <TextInput
                      placeholder="1HGBH41…"
                      value={newVeh.vin}
                      onChange={e => setNewVeh(p => ({ ...p, vin: e.target.value.toUpperCase() }))}
                    />
                  </Field>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    onClick={() => { setIsNewVehicle(false); setError(''); }}
                    style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8', fontWeight: 900, padding: '16px 0', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmNewVehicle}
                    className="ign-card-hover"
                    style={{ flex: 2, minWidth: '60%', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, padding: '16px 0', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(30,58,138,0.3)' }}
                  >
                    Continue <ChevronRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { setIsNewVehicle(true); setError(''); }}
                className="ign-card-hover"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#ffffff', fontWeight: 900, padding: '16px 0', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, cursor: 'pointer', marginTop: 8 }}
              >
                <Plus size={14} /> {vehicles.length > 0 ? 'Different Vehicle' : 'Add Vehicle'}
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PHASE 3 — JOB DETAILS
        ═══════════════════════════════════════════════════════ */}
        {phase === 'job' && (
          <div>
            {/* Customer + Vehicle summary */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <User size={14} style={{ color: '#818cf8' }} />
                <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 700 }}>
                  {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                </span>
                <span style={{ color: '#475569', fontSize: 12 }}>{selectedCustomer?.phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Car size={14} style={{ color: '#60a5fa' }} />
                <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 700 }}>
                  {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
                  {selectedVehicle?.trim ? ` ${selectedVehicle.trim}` : ''}
                </span>
                {selectedVehicle?.license_plate && (
                  <span style={{ color: '#475569', fontSize: 12 }}>{selectedVehicle.license_plate}</span>
                )}
              </div>
              <button
                onClick={() => setPhase('vehicle')}
                style={{ fontSize: 9, color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                ← Change vehicle
              </button>
            </div>

            <SectionLabel>Job Details</SectionLabel>

            <Field label="Primary Complaint *" hint="Customer's reason for visit — verbatim is best">
              <Textarea
                icon={AlertCircle}
                placeholder="Engine light on, car hesitates on acceleration…"
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                autoFocus
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Mileage In">
                <TextInput
                  icon={Gauge}
                  type="text"
                  inputMode="numeric"
                  placeholder="112,095"
                  value={mileageIn}
                  onChange={e => setMileageIn(e.target.value)}
                />
              </Field>
              <Field label="Promised By">
                <TextInput
                  icon={Calendar}
                  type="datetime-local"
                  value={promisedAt}
                  onChange={e => setPromisedAt(e.target.value)}
                />
              </Field>
            </div>

            {/* Waiting toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock size={16} style={{ color: '#fbbf24' }} />
                <div>
                  <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, margin: 0 }}>Customer Waiting</p>
                  <p style={{ color: '#64748b', fontSize: 10, margin: 0 }}>Customer is waiting in the shop</p>
                </div>
              </div>
              <button
                onClick={() => setWaiting(w => !w)}
                style={{ width: 48, height: 24, borderRadius: 12, backgroundColor: waiting ? '#f59e0b' : '#334155', position: 'relative', border: 'none', cursor: 'pointer' }}
              >
                <span style={{ position: 'absolute', top: 2, left: waiting ? 24 : 2, width: 20, height: 20, backgroundColor: '#ffffff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            <Field
              label="Advisory Notes"
              hint="Pre-existing conditions / deferred items — noted but NOT authorized for this visit"
            >
              <Textarea
                icon={ClipboardList}
                placeholder="Oil pan gasket seeping, valve cover leaking, spark plugs due at 120k…"
                value={advisories}
                onChange={e => setAdvisories(e.target.value)}
              />
            </Field>

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="ign-card-hover"
              style={{
                width: '100%',
                marginTop: 24,
                backgroundColor: '#059669',
                color: '#ffffff',
                fontWeight: 900,
                padding: '20px 0',
                borderRadius: 16,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1,
                boxShadow: '0 10px 15px -3px rgba(6,78,59,0.4)',
              }}
            >
              {saving ? (
                <><Loader2 size={16} className="ign-spin" /> Creating RO…</>
              ) : (
                <><ShieldCheck size={16} /> Commit to Queue</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
