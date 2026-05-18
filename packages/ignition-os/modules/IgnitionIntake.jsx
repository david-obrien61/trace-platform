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

// ─── helpers ─────────────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-3 my-6">
    <div className="flex-1 h-px bg-slate-800" />
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{children}</span>
    <div className="flex-1 h-px bg-slate-800" />
  </div>
);

const Field = ({ label, children, hint }) => (
  <div className="mb-4">
    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</label>
    {children}
    {hint && <p className="text-[9px] text-slate-700 mt-1.5 font-bold">{hint}</p>}
  </div>
);

const TextInput = ({ icon: Icon, ...props }) => (
  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 focus-within:border-blue-500 transition-colors">
    {Icon && <Icon size={16} className="text-slate-500 mr-3 flex-shrink-0" />}
    <input
      className="flex-1 bg-transparent py-4 text-white text-sm font-semibold outline-none placeholder-slate-600"
      {...props}
    />
  </div>
);

const Textarea = ({ icon: Icon, ...props }) => (
  <div className="flex items-start bg-slate-900 border border-slate-800 rounded-xl px-4 pt-4 focus-within:border-blue-500 transition-colors">
    {Icon && <Icon size={16} className="text-slate-500 mr-3 mt-0.5 flex-shrink-0" />}
    <textarea
      className="flex-1 bg-transparent pb-4 text-white text-sm font-semibold outline-none placeholder-slate-600 resize-none"
      rows={3}
      {...props}
    />
  </div>
);

const PhaseBar = ({ phase }) => {
  const steps = ['customer', 'vehicle', 'job'];
  const labels = ['Customer', 'Vehicle', 'Job Details'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex items-center gap-2 ${phase === s ? 'opacity-100' : steps.indexOf(phase) > i ? 'opacity-60' : 'opacity-20'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
              steps.indexOf(phase) > i ? 'bg-emerald-600 border-emerald-600 text-white' :
              phase === s ? 'bg-blue-600 border-blue-600 text-white' :
              'border-slate-700 text-slate-500'
            }`}>{steps.indexOf(phase) > i ? '✓' : i + 1}</div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{labels[i]}</span>
          </div>
          {i < 2 && <div className="flex-1 h-px bg-slate-800" />}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

export default function IgnitionIntake({ onJobCreated, onBack }) {
  const currentUser = DataBridge.load('current_user');
  const shopId = currentUser?.shop_id || DataBridge.load('shop_info')?.id;

  const [phase, setPhase] = useState('customer');

  // Customer
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ first_name: '', last_name: '', phone: '', email: '' });

  // Vehicle
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [newVeh, setNewVeh] = useState({ year: '', make: '', model: '', trim: '', vin: '', license_plate: '', color: '' });

  // Job
  const [complaint, setComplaint] = useState('');
  const [mileageIn, setMileageIn] = useState('');
  const [promisedAt, setPromisedAt] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [advisories, setAdvisories] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
      // 1. Upsert customer
      let customerId = selectedCustomer?.id;
      if (selectedCustomer?._isNew) {
        const { data: cust, error: e } = await supabase.from('customers').insert({
          shop_id: shopId,
          first_name: newCust.first_name.trim(),
          last_name:  newCust.last_name.trim() || null,
          phone:      newCust.phone.trim(),
          email:      newCust.email.trim() || null,
        }).select().single();
        if (e) throw e;
        customerId = cust.id;
      }

      // 2. Upsert vehicle
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
        // update mileage on existing vehicle
        await supabase.from('customer_vehicles').update({ mileage_last: mileageNum }).eq('id', vehicleId);
      }

      // 3. Create job
      const veh  = selectedVehicle;
      const cust = selectedCustomer;
      const woNum = `RO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: job, error: e } = await supabase.from('jobs').insert({
        shop_id:          shopId,
        wo_number:        woNum,
        status:           'intake',
        customer_id:      customerId,
        vehicle_id:       vehicleId,
        service_writer_id: currentUser?.member_id || null,
        complaint:        complaint.trim(),
        mileage_in:       mileageNum,
        promised_at:      promisedAt || null,
        waiting_status:   waiting,
        notes:            advisories.trim() || null,
        // jsonb snapshots keep old modules working
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
    <div className="min-h-screen bg-slate-950 p-6 pb-32">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">New Repair Order</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              {currentUser?.name ? `Service Advisor: ${currentUser.name}` : 'ZONE 1 // INTAKE'}
            </p>
          </div>
        </div>

        <PhaseBar phase={phase} />

        {error && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs font-bold">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-500"><X size={14} /></button>
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
                  <div className="relative">
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 focus-within:border-blue-500 transition-colors">
                      <Search size={16} className="text-slate-500 mr-3 flex-shrink-0" />
                      <input
                        className="flex-1 bg-transparent py-4 text-white text-sm font-semibold outline-none placeholder-slate-600"
                        placeholder="Mike Torres / (512) 555…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                      />
                      {searching && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                      {search && !searching && (
                        <button onClick={() => { setSearch(''); setSearchResults([]); }}>
                          <X size={14} className="text-slate-500" />
                        </button>
                      )}
                    </div>

                    {/* Results dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden z-20 shadow-2xl">
                        {searchResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-0 transition-colors"
                          >
                            <div className="text-left">
                              <p className="text-white text-sm font-bold">{c.first_name} {c.last_name}</p>
                              <p className="text-slate-500 text-xs">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-600" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[9px] text-slate-700 font-black uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                <button
                  onClick={() => { setIsNewCustomer(true); setError(''); }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 hover:border-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all active:scale-95"
                >
                  <Plus size={14} /> New Customer
                </button>
              </>
            ) : (
              /* New customer form */
              <>
                <div className="grid grid-cols-2 gap-4">
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

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { setIsNewCustomer(false); setError(''); }}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-400 font-black py-4 rounded-xl uppercase tracking-widest text-[10px] hover:border-slate-600 transition-all"
                  >
                    Back to Search
                  </button>
                  <button
                    onClick={confirmNewCustomer}
                    className="flex-2 min-w-[60%] bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
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
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                  <User size={16} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-black">
                    {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                  </p>
                  <p className="text-slate-500 text-xs">{selectedCustomer?.phone}</p>
                </div>
              </div>
              <button onClick={() => { setPhase('customer'); setSelectedCustomer(null); }} className="text-slate-600 hover:text-slate-400">
                <X size={16} />
              </button>
            </div>

            <SectionLabel>Select or Add Vehicle</SectionLabel>

            {/* Existing vehicles */}
            {vehicles.length > 0 && !isNewVehicle && (
              <div className="space-y-3 mb-6">
                {vehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => selectVehicle(v)}
                    className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-blue-500 px-4 py-4 rounded-xl transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <Car size={18} className="text-slate-500" />
                      <div>
                        <p className="text-white font-bold text-sm">{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}</p>
                        <p className="text-slate-500 text-xs">
                          {v.license_plate && `${v.license_plate} · `}
                          {v.vin ? `VIN …${v.vin.slice(-6)}` : 'No VIN'}
                          {v.mileage_last ? ` · ${v.mileage_last.toLocaleString()} mi` : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600" />
                  </button>
                ))}
              </div>
            )}

            {/* New vehicle form */}
            {isNewVehicle ? (
              <>
                <div className="grid grid-cols-3 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setIsNewVehicle(false); setError(''); }}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-400 font-black py-4 rounded-xl uppercase tracking-widest text-[10px] hover:border-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmNewVehicle}
                    className="flex-2 min-w-[60%] bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                  >
                    Continue <ChevronRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { setIsNewVehicle(true); setError(''); }}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 hover:border-blue-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 mt-2"
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-6 space-y-2">
              <div className="flex items-center gap-3">
                <User size={14} className="text-indigo-400" />
                <span className="text-white text-sm font-bold">
                  {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                </span>
                <span className="text-slate-600 text-xs">{selectedCustomer?.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Car size={14} className="text-blue-400" />
                <span className="text-white text-sm font-bold">
                  {selectedVehicle?.year} {selectedVehicle?.make} {selectedVehicle?.model}
                  {selectedVehicle?.trim ? ` ${selectedVehicle.trim}` : ''}
                </span>
                {selectedVehicle?.license_plate && (
                  <span className="text-slate-600 text-xs">{selectedVehicle.license_plate}</span>
                )}
              </div>
              <button
                onClick={() => setPhase('vehicle')}
                className="text-[9px] text-slate-600 hover:text-slate-400 font-black uppercase tracking-widest mt-1 transition-colors"
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

            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 mb-4">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-amber-400" />
                <div>
                  <p className="text-white text-sm font-bold">Customer Waiting</p>
                  <p className="text-slate-500 text-[10px]">Customer is waiting in the shop</p>
                </div>
              </div>
              <button
                onClick={() => setWaiting(w => !w)}
                className={`w-12 h-6 rounded-full transition-colors relative ${waiting ? 'bg-amber-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${waiting ? 'left-6' : 'left-0.5'}`} />
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
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/40"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Creating RO…</>
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
