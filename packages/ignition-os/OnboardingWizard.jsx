/**
 * FILE: OnboardingWizard.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: First-run experience. Three entry paths — each designed to demonstrate
 *          dollar-value to a skeptical shop owner within 30 minutes without requiring
 *          any prior data entry.
 */

import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowRight, ArrowLeft, CheckCircle, DollarSign, Wrench, Database,
  TrendingDown, TrendingUp, AlertCircle, ChevronRight, Zap, Building2,
  Phone, Mail, MapPin, FileText, Upload, User, Car, Lock, Users, QrCode,
  Copy, Send
} from 'lucide-react';
import DataBridge from './DataBridge';
import { supabase } from './supabase';
import { MarginEngine } from './MarginEngine';
import ExternalBridge from './ExternalBridge';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const Input = ({ label, value, onChange, placeholder, type = 'text', prefix }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-4 text-slate-500 font-black">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors ${prefix ? 'pl-8' : ''}`}
      />
    </div>
  </div>
);

const ProgressBar = ({ steps, current }) => (
  <div className="flex items-center gap-1 mb-10">
    {steps.map((s, i) => (
      <React.Fragment key={s}>
        <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= current ? 'bg-blue-500' : 'bg-slate-800'}`} />
      </React.Fragment>
    ))}
  </div>
);

const ResultCard = ({ label, value, sub, color = 'text-white' }) => (
  <div className="bg-black border border-slate-800 rounded-2xl p-5 flex flex-col gap-1">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <p className={`text-3xl font-black italic tracking-tighter ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

const FAULT_LIBRARY = {
  '3216': { name: 'Inlet NOx Sensor', parts: ['2871979-NX'], labor: 1.5, partsCost: 262.5 },
  '3251': { name: 'DPF Pressure High', parts: ['A0014903492', 'Clamps', 'Gaskets'], labor: 4.0, partsCost: 780 },
  '157':  { name: 'Fuel Rail Pressure Low', parts: ['Relief Valve'], labor: 2.5, partsCost: 215.5 },
  '102':  { name: 'Boost Pressure Low (Turbo)', parts: ['Turbo VGT Actuator', 'Gasket Kit'], labor: 5.5, partsCost: 1420 },
  '111':  { name: 'Oil Pressure Low', parts: ['Oil Pump', 'Gasket', 'Filter'], labor: 3.0, partsCost: 385 },
  '272':  { name: 'EGR Valve Fault', parts: ['EGR Valve', 'EGR Gasket'], labor: 2.0, partsCost: 540 },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

// quickMode: pre-fills shop/owner/PIN defaults and jumps directly to CHOOSE_PATH (step 3).
// Useful for demo runs where you don't want to walk through shop setup every time.
const OnboardingWizard = ({ onComplete, quickMode = false }) => {
  const STEPS = ['WELCOME', 'SHOP_SETUP', 'CHOOSE_PATH', 'PATH_EXPERIENCE', 'TEAM_QR'];
  const [stepIndex, setStepIndex]   = useState(quickMode ? 2 : 0); // CHOOSE_PATH index = 2
  const [path, setPath]             = useState(null); // 'MARGIN' | 'DIAGNOSE' | 'MIGRATE'
  const [shopInfo, setShopInfo]     = useState(
    quickMode
      ? { name: 'Demo Shop', phone: '', address: '', usdot: '' }
      : { name: '', phone: '', address: '', usdot: '' }
  );
  const [ownerPin, setOwnerPin]     = useState(quickMode ? '1234' : '');
  const [ownerName, setOwnerName]   = useState(quickMode ? 'Demo Owner' : '');
  const [shopInfoError, setShopInfoError] = useState('');
  const [finalShopId, setFinalShopId]     = useState(null);
  const [copiedJoinUrl, setCopiedJoinUrl] = useState(false);

  const step = STEPS[stepIndex];
  const next = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex(i => Math.max(i - 1, 0));

  const finalize = async (extraPolicy = {}) => {
    // 1. Generate a unique shop ID for this trial — ties all data together in Supabase
    const shopId = crypto.randomUUID();
    DataBridge.setShopId(shopId);

    const trialStartedAt = new Date().toISOString();
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Register shop in Supabase — one row per shop, forever
    await supabase.from('shops').upsert({
      id: shopId,
      name: shopInfo.name,
      phone: shopInfo.phone || null,
      address: shopInfo.address || null,
      usdot: shopInfo.usdot || null,
      tier: 'TRIAL',
      trial_started_at: trialStartedAt,
    }, { onConflict: 'id' });

    // 3. Save shop info to localStorage
    const existingPolicy = DataBridge.load('shop_policy') || {};
    DataBridge.save('shop_info', {
      id: shopId,
      name: shopInfo.name,
      is_multi_location: false,
      global_contact: { phone: shopInfo.phone, email: '', address: shopInfo.address, usdot: shopInfo.usdot },
      locations: [],
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
    });

    DataBridge.save('shop_policy', {
      ...existingPolicy,
      tier: 'TRIAL',
      shop_id: shopId,
      autoLockEnabled: true,
      enable_price_audit: true,
      enable_bay_custody: false,
      featureLevels: { hardware: 0, leaderboard: 0 },
      active_modules: ['CORE', 'KOSK', 'PORT'],
      onboarding_complete: true,
      onboarding_path: path,
      onboarding_completed_at: trialStartedAt,
      ...extraPolicy,
    });

    // 4. Create owner profile with chosen PIN
    const pin = ownerPin || '0000';
    const profiles = DataBridge.getProfiles();
    const updatedProfiles = {
      ...profiles,
      [pin]: {
        id: pin,
        name: ownerName || shopInfo.name + ' (Owner)',
        role: 'OWNER',
        allowed: ['intake','queue','vin','voice','estimates','parts','procure','tools','inv','admin','fleet','crm'],
        preferences: { pinnedSpecs: ['Model Year','Make','Model'] },
        hasSignedWaiver: true,
        permissions: ['ADMIN', 'TECH', 'PRICING_AUTHORITY'],
      }
    };
    DataBridge.save('user_profiles', updatedProfiles);
    DataBridge.save('current_user', updatedProfiles[pin]);

    setFinalShopId(shopId);
    setStepIndex(STEPS.indexOf('TEAM_QR'));
  };

  // ── STEP: WELCOME ──────────────────────────────────────────────────────────

  const renderWelcome = () => (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto pt-8">
      <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-900 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-900/40">
        <Zap size={48} className="text-white" fill="white" />
      </div>

      <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-3">
        Welcome to<br />Ignition OS
      </h1>
      <p className="text-slate-400 text-sm mb-10 leading-relaxed">
        Built for diesel and mechanical shops that are done leaving money on the table.
        In the next <span className="text-blue-400 font-black">30 minutes</span>, we'll show you
        exactly what it can do for your business.
      </p>

      <div className="w-full grid grid-cols-3 gap-4 mb-10">
        {[
          { icon: DollarSign, label: 'Find your margin leaks', color: 'text-emerald-400' },
          { icon: Wrench, label: 'Diagnose & estimate faster', color: 'text-blue-400' },
          { icon: Database, label: 'Migrate your shop data', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2">
            <Icon size={24} className={color} />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-center leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={next}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm transition-colors shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 active:scale-95"
      >
        Let's Go <ArrowRight size={18} />
      </button>
      <p className="text-[9px] text-slate-600 mt-4 uppercase tracking-wider">No credit card required · Cancel any time</p>
    </div>
  );

  // ── STEP: SHOP SETUP ───────────────────────────────────────────────────────

  const renderShopSetup = () => {
    const canContinue = shopInfo.name.trim().length > 1 && ownerName.trim().length > 1 && ownerPin.length === 4;

    const validate = () => {
      if (!shopInfo.name.trim()) return setShopInfoError('Shop name is required.');
      if (!ownerName.trim()) return setShopInfoError('Your name is required.');
      if (ownerPin.length !== 4 || !/^\d{4}$/.test(ownerPin)) return setShopInfoError('PIN must be exactly 4 digits.');
      setShopInfoError('');
      next();
    };

    return (
      <div className="max-w-md mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-1">Your Shop</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Takes 2 minutes · You can update this later</p>
        </div>

        <div className="space-y-4 mb-6">
          <Input label="Shop Name *" value={shopInfo.name} onChange={v => setShopInfo(s => ({ ...s, name: v }))} placeholder="Lone Star Diesel Repair" />
          <Input label="Your Name *" value={ownerName} onChange={setOwnerName} placeholder="John Smith" />
          <Input label="Your Owner PIN (4 digits) *" value={ownerPin} onChange={v => setOwnerPin(v.replace(/\D/g, '').slice(0, 4))} placeholder="••••" type="password" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={shopInfo.phone} onChange={v => setShopInfo(s => ({ ...s, phone: v }))} placeholder="512-555-0100" />
            <Input label="USDOT #" value={shopInfo.usdot} onChange={v => setShopInfo(s => ({ ...s, usdot: v }))} placeholder="12345678" />
          </div>
          <Input label="Address" value={shopInfo.address} onChange={v => setShopInfo(s => ({ ...s, address: v }))} placeholder="123 Fleet Way, Austin, TX" />
        </div>

        {shopInfoError && (
          <div className="flex items-center gap-2 text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl p-3 mb-4">
            <AlertCircle size={14} />
            <p className="text-[10px] font-bold">{shopInfoError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={back} className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-800 transition-colors flex items-center gap-2">
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={validate} disabled={!canContinue} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2 active:scale-95">
            Continue <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  // ── STEP: CHOOSE PATH ──────────────────────────────────────────────────────

  const renderChoosePath = () => (
    <div className="max-w-lg mx-auto w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">
          What's Your Biggest Headache?
        </h2>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Choose one — we'll show you the fix in real time</p>
      </div>

      <div className="space-y-4">
        {[
          {
            id: 'MARGIN',
            icon: DollarSign,
            color: 'emerald',
            title: 'Parts pricing eats my margin',
            sub: 'Show me how much I\'m leaving on the table right now',
            badge: 'Most common',
          },
          {
            id: 'DIAGNOSE',
            icon: Wrench,
            color: 'blue',
            title: 'Techs waste too much time on estimates',
            sub: 'Scan a fault code and watch a full estimate write itself',
            badge: 'Fastest demo',
          },
          {
            id: 'MIGRATE',
            icon: Database,
            color: 'purple',
            title: 'I need to get my shop organized',
            sub: 'Pull your customers from QuickBooks or a spreadsheet',
            badge: 'Setup path',
          },
        ].map(({ id, icon: Icon, color, title, sub, badge }) => (
          <button
            key={id}
            onClick={() => { setPath(id); next(); }}
            className={`w-full bg-slate-900 border rounded-3xl p-6 flex items-center gap-5 text-left transition-all active:scale-[0.98] hover:border-${color}-500/50 group ${path === id ? `border-${color}-500` : 'border-slate-800'}`}
          >
            <div className={`w-14 h-14 rounded-2xl bg-${color}-600/10 border border-${color}-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-${color}-600/20 transition-colors`}>
              <Icon size={24} className={`text-${color}-400`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-black text-white uppercase italic tracking-tighter">{title}</p>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full bg-${color}-600/20 text-${color}-400 uppercase`}>{badge}</span>
              </div>
              <p className="text-[10px] text-slate-500">{sub}</p>
            </div>
            <ChevronRight size={18} className="text-slate-600 group-hover:text-white transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>

      <button onClick={back} className="mt-6 w-full text-slate-600 text-[10px] font-black uppercase tracking-wider hover:text-slate-400 transition-colors flex items-center justify-center gap-2">
        <ArrowLeft size={12} /> Back
      </button>
    </div>
  );

  // ── PATH A: MARGIN ─────────────────────────────────────────────────────────

  const MarginPath = () => {
    const [partName, setPartName]       = useState('');
    const [costPaid, setCostPaid]       = useState('');
    const [priceCharged, setPriceCharged] = useState('');
    const [weeklyParts, setWeeklyParts] = useState(10);
    const [showResult, setShowResult]   = useState(false);

    const cost = parseFloat(costPaid) || 0;
    const charged = parseFloat(priceCharged) || 0;
    const suggested = cost > 0 ? MarginEngine.calculateRetail(cost) : 0;
    const leakagePerPart = charged > 0 && suggested > charged ? suggested - charged : 0;
    const annualLeakage = leakagePerPart * weeklyParts * 52;

    const canAnalyze = cost > 0 && charged > 0 && partName.trim().length > 0;

    return (
      <div className="max-w-md mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-1">Margin Check</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Tell us about a part you recently sold</p>
        </div>

        {!showResult ? (
          <>
            <div className="space-y-4 mb-6">
              <Input label="Part Name" value={partName} onChange={setPartName} placeholder="e.g. Turbocharger, Oil Filter, DPF..." />
              <div className="grid grid-cols-2 gap-4">
                <Input label="What you paid vendor ($)" value={costPaid} onChange={setCostPaid} placeholder="0.00" type="number" prefix="$" />
                <Input label="What you charged customer ($)" value={priceCharged} onChange={setPriceCharged} placeholder="0.00" type="number" prefix="$" />
              </div>
            </div>

            <button
              onClick={() => canAnalyze && setShowResult(true)}
              disabled={!canAnalyze}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              Analyze My Pricing
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <ResultCard label="You Charged" value={`$${charged.toFixed(2)}`} sub="Actual sale price" color="text-white" />
              <ResultCard
                label="Suggested Price"
                value={`$${suggested.toFixed(2)}`}
                sub="Based on your margin rules"
                color={suggested > charged ? 'text-emerald-400' : 'text-slate-300'}
              />
            </div>

            {leakagePerPart > 0 ? (
              <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <TrendingDown size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-red-400 uppercase italic tracking-tighter">Margin Leak Detected</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      On this part alone, you undercharged by <span className="text-red-400 font-black">${leakagePerPart.toFixed(2)}</span>.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2">
                    How many parts like this per week?
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min="1" max="50" value={weeklyParts}
                      onChange={e => setWeeklyParts(parseInt(e.target.value))}
                      className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none accent-red-500"
                    />
                    <span className="text-white font-black text-sm w-8">{weeklyParts}</span>
                  </div>
                  <div className="mt-4 bg-black border border-red-500/20 rounded-2xl p-4">
                    <p className="text-[9px] text-slate-500 uppercase">Annual revenue left on the table</p>
                    <p className="text-3xl font-black text-red-400 italic tracking-tighter">${annualLeakage.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 mb-6 flex items-center gap-3">
                <TrendingUp size={20} className="text-emerald-400" />
                <p className="text-[10px] text-emerald-400 font-black uppercase">Your pricing on this part is solid. Ignition OS will protect that margin automatically.</p>
              </div>
            )}

            <button
              onClick={() => finalize({ first_margin_check: { partName, costPaid: cost, priceCharged: charged, suggested, leakagePerPart, annualLeakage } })}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-2"
            >
              Set Up My Pricing Rules <ArrowRight size={14} />
            </button>
          </>
        )}

        <button onClick={back} className="mt-4 w-full text-slate-600 text-[10px] font-black uppercase tracking-wider hover:text-slate-400 transition-colors flex items-center justify-center gap-2">
          <ArrowLeft size={12} /> Change Path
        </button>
      </div>
    );
  };

  // ── PATH B: DIAGNOSE ───────────────────────────────────────────────────────

  const DiagnosePath = () => {
    const [vehicle, setVehicle]       = useState({ year: '', make: '', model: '' });
    const [faultCode, setFaultCode]   = useState('');
    const [estimate, setEstimate]     = useState(null);
    const [savedJob, setSavedJob]     = useState(false);

    const rates = DataBridge.getSystemRates();
    const commonCodes = Object.entries(FAULT_LIBRARY).map(([code, data]) => ({ code, name: data.name }));

    const runDiagnosis = () => {
      const base = FAULT_LIBRARY[faultCode.trim()];
      if (!base) return;
      const laborCost = base.labor * rates.BASE;
      const totalCost = laborCost + base.partsCost;
      const retail    = parseFloat(DataBridge.calculateRetail(totalCost, DataBridge.getActiveMargin('STANDARD')));
      setEstimate({ ...base, laborCost, totalCost, retail, laborHours: base.labor, rateUsed: rates.BASE });
    };

    const saveAsJob = () => {
      const job = {
        id: `JOB-${Date.now()}`,
        jobId: `JOB-${Date.now()}`,
        year: vehicle.year, make: vehicle.make, model: vehicle.model,
        status: 'READY',
        faultCode,
        estimate,
        createdAt: new Date().toISOString(),
        createdDuring: 'ONBOARDING',
      };
      const existing = DataBridge.load('active_jobs') || [];
      DataBridge.save('active_jobs', [...existing, job]);
      setSavedJob(true);
    };

    return (
      <div className="max-w-md mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-1">Live Diagnosis</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Enter a fault code — get a full estimate instantly</p>
        </div>

        {!estimate ? (
          <>
            <div className="space-y-4 mb-4">
              <div className="grid grid-cols-3 gap-3">
                <Input label="Year" value={vehicle.year} onChange={v => setVehicle(s => ({ ...s, year: v }))} placeholder="2019" />
                <Input label="Make" value={vehicle.make} onChange={v => setVehicle(s => ({ ...s, make: v }))} placeholder="Peterbilt" />
                <Input label="Model" value={vehicle.model} onChange={v => setVehicle(s => ({ ...s, model: v }))} placeholder="389" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Fault Code</label>
                <input
                  value={faultCode}
                  onChange={e => setFaultCode(e.target.value)}
                  placeholder="Type a code (e.g. 3251) or pick below"
                  className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Common Codes</p>
              <div className="flex flex-wrap gap-2">
                {commonCodes.map(({ code, name }) => (
                  <button
                    key={code}
                    onClick={() => setFaultCode(code)}
                    className={`text-[9px] font-black px-3 py-1.5 rounded-full border uppercase transition-all ${faultCode === code ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                  >
                    {code} — {name.split(' ').slice(0, 2).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runDiagnosis}
              disabled={!faultCode.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95"
            >
              Generate Estimate
            </button>
          </>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-4">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">
                {vehicle.year} {vehicle.make} {vehicle.model} — Code {faultCode}
              </p>
              <p className="text-lg font-black text-blue-400 uppercase italic tracking-tighter mb-4">{estimate.name}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <ResultCard label="Parts Cost" value={`$${estimate.partsCost.toFixed(2)}`} sub="Your cost" />
                <ResultCard label="Labor" value={`${estimate.laborHours}h × $${estimate.rateUsed}`} sub={`= $${estimate.laborCost.toFixed(2)}`} />
              </div>

              <div className="border-t border-slate-800 pt-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase">Customer Quote</p>
                    <p className="text-4xl font-black text-emerald-400 italic tracking-tighter">${estimate.retail.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Your Gross Margin</p>
                    <p className="text-xl font-black text-white">
                      {(((estimate.retail - estimate.totalCost) / estimate.retail) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              {!savedJob ? (
                <button onClick={saveAsJob} className="flex-1 bg-slate-900 border border-slate-800 hover:border-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[9px] transition-colors">
                  Save as First Work Order
                </button>
              ) : (
                <div className="flex-1 bg-emerald-600/10 border border-emerald-500/30 rounded-2xl py-4 flex items-center justify-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 font-black text-[9px] uppercase">Work Order Saved</span>
                </div>
              )}
            </div>

            <button
              onClick={() => finalize()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-2"
            >
              Open My Dashboard <ArrowRight size={14} />
            </button>
          </>
        )}

        <button onClick={back} className="mt-4 w-full text-slate-600 text-[10px] font-black uppercase tracking-wider hover:text-slate-400 transition-colors flex items-center justify-center gap-2">
          <ArrowLeft size={12} /> Change Path
        </button>
      </div>
    );
  };

  // ── PATH C: MIGRATE ────────────────────────────────────────────────────────

  const MigratePath = () => {
    const [subPath, setSubPath]             = useState(null); // 'QB' | 'CSV' | 'MANUAL'
    const [qbStatus, setQbStatus]           = useState('idle'); // 'idle'|'connecting'|'connected'|'error'
    const [qbMessage, setQbMessage]         = useState('');
    const [csvFile, setCsvFile]             = useState(null);
    const [csvParsed, setCsvParsed]         = useState(null);
    const [csvImporting, setCsvImporting]   = useState(false);
    const [importResult, setImportResult]   = useState(null);
    const [manualCustomers, setManualCustomers] = useState([
      { name: '', phone: '', vehicle: '' },
      { name: '', phone: '', vehicle: '' },
    ]);
    const fileRef = useRef();

    const connectQuickBooks = async () => {
      setQbStatus('connecting');
      setQbMessage('Opening QuickBooks authorization...');
      try {
        const status = await ExternalBridge.qbo.initiateOAuth();
        setQbStatus('connected');
        setQbMessage(`Connected to ${status.companyName || 'QuickBooks'}. Pulling your customers...`);
        const result = await ExternalBridge.qbo.pullCustomers();
        setImportResult({ type: 'QB', ...result });
        setQbMessage(`Done! Imported ${result.imported} customers from QuickBooks.`);
      } catch (e) {
        setQbStatus('error');
        setQbMessage(e.message);
      }
    };

    const handleCsvFile = async (file) => {
      if (!file) return;
      setCsvFile(file);
      try {
        const parsed = await ExternalBridge.csv.parse(file);
        setCsvParsed(parsed);
      } catch (e) {
        setCsvParsed({ error: e.message });
      }
    };

    const importCsv = async () => {
      if (!csvParsed || csvParsed.error) return;
      setCsvImporting(true);
      const customers = ExternalBridge.csv.mapToCustomers(csvParsed.rows, csvParsed.mapping);
      const result = ExternalBridge.csv.importCustomers(customers);
      setImportResult({ type: 'CSV', ...result });
      setCsvImporting(false);
    };

    const importManual = () => {
      const toImport = manualCustomers
        .filter(c => c.name.trim())
        .map((c, i) => ({
          id: `MAN-${Date.now()}-${i}`,
          name: c.name, phone: c.phone,
          email: '', address: '', type: 'PERSONAL', tier: 'STANDARD',
          source: 'MANUAL_ONBOARDING', vehicles: c.vehicle ? [{ make: c.vehicle }] : [],
        }));
      const existing = DataBridge.getCustomers();
      DataBridge.save('customers_directory', [...existing, ...toImport]);
      setImportResult({ type: 'MANUAL', imported: toImport.length });
    };

    if (!subPath) return (
      <div className="max-w-md mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-1">Import Your Shop Data</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Start with what you already have</p>
        </div>
        <div className="space-y-3">
          {[
            { id: 'QB', icon: Database, color: 'green', title: 'Connect QuickBooks', sub: 'One click pulls all your customers and recent invoices' },
            { id: 'CSV', icon: Upload, color: 'blue', title: 'Import a Spreadsheet', sub: 'Drag in any CSV from Excel, Google Sheets, or another system' },
            { id: 'MANUAL', icon: User, color: 'purple', title: 'Enter a Few Customers by Hand', sub: 'Just get started — add more later' },
          ].map(({ id, icon: Icon, color, title, sub }) => (
            <button key={id} onClick={() => setSubPath(id)} className="w-full bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-3xl p-5 flex items-center gap-4 text-left transition-all active:scale-[0.99]">
              <div className={`w-12 h-12 rounded-xl bg-${color}-600/10 border border-${color}-500/20 flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={`text-${color}-400`} />
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase italic tracking-tighter">{title}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{sub}</p>
              </div>
              <ChevronRight size={16} className="text-slate-600 ml-auto" />
            </button>
          ))}
        </div>
        <button onClick={back} className="mt-6 w-full text-slate-600 text-[10px] font-black uppercase tracking-wider hover:text-slate-400 transition-colors flex items-center justify-center gap-2">
          <ArrowLeft size={12} /> Change Path
        </button>
      </div>
    );

    return (
      <div className="max-w-md mx-auto w-full">
        <button onClick={() => { setSubPath(null); setImportResult(null); setQbStatus('idle'); setCsvParsed(null); }} className="flex items-center gap-1 text-slate-600 text-[9px] font-black uppercase tracking-wider hover:text-slate-400 transition-colors mb-6">
          <ArrowLeft size={12} /> Choose Different Method
        </button>

        {/* QB sub-path */}
        {subPath === 'QB' && (
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6">QuickBooks Connection</h3>
            {!importResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center">
                <Database size={40} className="text-emerald-400 mb-4" />
                <p className="text-sm font-black text-white uppercase italic mb-2">One-Click Customer Import</p>
                <p className="text-[10px] text-slate-500 mb-8">Pulls all active customers and their contact info. No data entry required.</p>
                {qbMessage && (
                  <p className={`text-[10px] font-bold mb-4 ${qbStatus === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{qbMessage}</p>
                )}
                <button
                  onClick={connectQuickBooks}
                  disabled={qbStatus === 'connecting'}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors"
                >
                  {qbStatus === 'connecting' ? 'Connecting...' : 'Connect QuickBooks'}
                </button>
                <p className="text-[8px] text-slate-600 mt-3">You'll be redirected to QuickBooks to authorize. Returns here automatically.</p>
              </div>
            ) : (
              <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-3xl p-8 text-center">
                <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-xl font-black text-white uppercase italic tracking-tighter mb-1">{importResult.imported} Customers Imported</p>
                <p className="text-[10px] text-slate-500 mb-6">Your QuickBooks customer list is now in Ignition OS.</p>
                <button onClick={() => finalize()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95 flex items-center justify-center gap-2">
                  Open My Dashboard <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* CSV sub-path */}
        {subPath === 'CSV' && (
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6">Spreadsheet Import</h3>
            {!importResult ? (
              <>
                <div
                  className="border-2 border-dashed border-slate-800 hover:border-blue-500 rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer transition-colors mb-4"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleCsvFile(e.dataTransfer.files[0]); }}
                >
                  <Upload size={32} className="text-slate-600 mb-3" />
                  <p className="text-sm font-black text-slate-400 uppercase italic">Drop CSV here or tap to browse</p>
                  <p className="text-[9px] text-slate-600 mt-1">Works with Excel exports, Google Sheets, and any shop software CSV</p>
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => handleCsvFile(e.target.files[0])} />
                </div>

                {csvParsed && !csvParsed.error && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{csvFile?.name}</p>
                    <p className="text-sm font-black text-white">{csvParsed.totalRows} rows detected</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {csvParsed.headers.slice(0, 8).map(h => (
                        <span key={h} className="text-[8px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">{h}</span>
                      ))}
                    </div>
                  </div>
                )}

                {csvParsed?.error && (
                  <p className="text-red-400 text-[10px] font-bold mb-4">{csvParsed.error}</p>
                )}

                <button
                  onClick={importCsv}
                  disabled={!csvParsed || !!csvParsed.error || csvImporting}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95"
                >
                  {csvImporting ? 'Importing...' : `Import ${csvParsed?.totalRows || ''} Customers`}
                </button>
              </>
            ) : (
              <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-3xl p-8 text-center">
                <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-xl font-black text-white uppercase italic tracking-tighter mb-1">{importResult.imported} Imported · {importResult.skipped} Skipped</p>
                <p className="text-[10px] text-slate-500 mb-6">Duplicates were automatically skipped.</p>
                <button onClick={() => finalize()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95 flex items-center justify-center gap-2">
                  Open My Dashboard <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* MANUAL sub-path */}
        {subPath === 'MANUAL' && (
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6">Quick Customer Entry</h3>
            {!importResult ? (
              <>
                <div className="space-y-4 mb-6">
                  {manualCustomers.map((c, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <p className="text-[9px] font-black text-slate-600 uppercase">Customer {i + 1}</p>
                      <Input label="Name" value={c.name} onChange={v => setManualCustomers(mc => mc.map((x, j) => j === i ? { ...x, name: v } : x))} placeholder="Mike Johnson" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Phone" value={c.phone} onChange={v => setManualCustomers(mc => mc.map((x, j) => j === i ? { ...x, phone: v } : x))} placeholder="512-555-0100" />
                        <Input label="Vehicle / Unit" value={c.vehicle} onChange={v => setManualCustomers(mc => mc.map((x, j) => j === i ? { ...x, vehicle: v } : x))} placeholder="2018 Freightliner" />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setManualCustomers(mc => [...mc, { name: '', phone: '', vehicle: '' }])} className="w-full text-[9px] font-black text-slate-600 uppercase hover:text-slate-400 transition-colors py-2">
                    + Add Another
                  </button>
                </div>
                <button
                  onClick={importManual}
                  disabled={!manualCustomers.some(c => c.name.trim())}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95"
                >
                  Save Customers
                </button>
              </>
            ) : (
              <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-3xl p-8 text-center">
                <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-xl font-black text-white uppercase italic tracking-tighter mb-1">{importResult.imported} Customers Added</p>
                <button onClick={() => finalize()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors mt-6 active:scale-95 flex items-center justify-center gap-2">
                  Open My Dashboard <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── STEP: TEAM QR ──────────────────────────────────────────────────────────

  const renderTeamQR = () => {
    const joinUrl = `${window.location.origin}/?join=${finalShopId}`;
    const launch = () => {
      if (onComplete) onComplete();
      else window.location.href = '/';
    };
    return (
      <div className="flex flex-col items-center text-center max-w-md mx-auto pt-4">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-emerald-900/40">
          <CheckCircle size={32} className="text-white" />
        </div>

        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-1">Shop Is Live</h2>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-8">Add your team — they scan once and they're in</p>

        {/* QR Code */}
        <div className="bg-white p-5 rounded-3xl mb-6 shadow-2xl">
          <QRCodeSVG value={joinUrl} size={200} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>

        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8 text-left">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">How it works</p>
          <div className="space-y-2">
            {[
              { role: 'Tech', color: 'text-blue-400', desc: 'Scans QR → picks Tech → sets PIN → goes to intake' },
              { role: 'Front Office', color: 'text-purple-400', desc: 'Scans QR → picks Front Office → sets PIN → sees queue' },
            ].map(({ role, color, desc }) => (
              <div key={role} className="flex items-start gap-3">
                <span className={`text-[9px] font-black uppercase ${color} w-20 flex-shrink-0 pt-0.5`}>{role}</span>
                <span className="text-[9px] text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full flex gap-3 mb-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl);
              setCopiedJoinUrl(true);
              setTimeout(() => setCopiedJoinUrl(false), 2000);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors"
          >
            <Copy size={13} /> {copiedJoinUrl ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => window.open(`sms:?body=${encodeURIComponent('Join our shop on Ignition OS: ' + joinUrl)}`)}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-600/30 transition-colors"
          >
            <Send size={13} /> Send to Phone
          </button>
        </div>

        <button
          onClick={launch}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm transition-colors shadow-xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-2"
        >
          Open My Dashboard <ArrowRight size={18} />
        </button>
        <p className="text-[9px] text-slate-600 mt-4 uppercase tracking-wider">Team members can also join later from Admin → Team</p>
      </div>
    );
  };

  // ── ROUTER ─────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 'WELCOME':        return renderWelcome();
      case 'SHOP_SETUP':     return renderShopSetup();
      case 'CHOOSE_PATH':    return renderChoosePath();
      case 'PATH_EXPERIENCE':
        if (path === 'MARGIN')   return <MarginPath />;
        if (path === 'DIAGNOSE') return <DiagnosePath />;
        if (path === 'MIGRATE')  return <MigratePath />;
        return null;
      case 'TEAM_QR':        return renderTeamQR();
      default:               return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 flex flex-col overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(30,41,59,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.2) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 flex-1 flex flex-col p-6 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pt-2">
          <span className="text-[10px] font-mono text-blue-500 font-black uppercase tracking-widest">Ignition OS // Setup</span>
          <span className="text-[9px] font-black text-slate-600 uppercase">Step {stepIndex + 1} of {STEPS.length}</span>
        </div>

        {/* Progress */}
        <ProgressBar steps={STEPS} current={stepIndex} />

        {/* Step content */}
        <div className="flex-1">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
