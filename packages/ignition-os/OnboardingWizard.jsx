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

const STYLE_DEBUG = false; // [TRACE:STYLE] STD-003

// Dynamic color values for path-chooser and import sub-path buttons
const CHOICE_COLORS = {
  emerald: { iconBg:'rgba(5,150,105,0.1)', iconBorder:'rgba(16,185,129,0.2)', text:'#34d399', badgeBg:'rgba(5,150,105,0.2)', activeBorder:'#10b981' },
  blue:    { iconBg:'rgba(37,99,235,0.1)',  iconBorder:'rgba(59,130,246,0.2)',  text:'#60a5fa', badgeBg:'rgba(37,99,235,0.2)',  activeBorder:'#3b82f6' },
  purple:  { iconBg:'rgba(126,34,206,0.1)', iconBorder:'rgba(168,85,247,0.2)', text:'#c084fc', badgeBg:'rgba(126,34,206,0.2)', activeBorder:'#a855f7' },
  green:   { iconBg:'rgba(22,163,74,0.1)',  iconBorder:'rgba(34,197,94,0.2)',  text:'#4ade80', badgeBg:'rgba(22,163,74,0.2)',  activeBorder:'#22c55e' },
};

// Maps ResultCard color prop (formerly Tailwind class strings) to hex values
const RESULT_COLOR_MAP = {
  'text-white':       '#fff',
  'text-emerald-400': '#34d399',
  'text-slate-300':   '#cbd5e1',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const Input = ({ label, value, onChange, placeholder, type = 'text', prefix }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
    <label style={{ fontSize:10, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</label>
    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
      {prefix && <span style={{ position:'absolute', left:16, color:'#64748b', fontWeight:900 }}>{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="ign-input"
        style={{
          width:'100%', backgroundColor:'#000', border:'1px solid #1e293b', borderRadius:12,
          padding:16, color:'#fff', fontWeight:700, fontSize:14,
          paddingLeft: prefix ? 32 : 16,
        }}
      />
    </div>
  </div>
);

const ProgressBar = ({ steps, current }) => (
  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:40 }}>
    {steps.map((s, i) => (
      <React.Fragment key={s}>
        <div style={{ height:4, flex:1, borderRadius:999, backgroundColor: i <= current ? '#3b82f6' : '#1e293b' }} />
      </React.Fragment>
    ))}
  </div>
);

const ResultCard = ({ label, value, sub, color = 'text-white' }) => (
  <div style={{ backgroundColor:'#000', border:'1px solid #1e293b', borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:4 }}>
    <p style={{ fontSize:9, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</p>
    <p style={{ fontSize:30, fontWeight:900, fontStyle:'italic', letterSpacing:'-0.05em', color: RESULT_COLOR_MAP[color] || '#fff' }}>{value}</p>
    {sub && <p style={{ fontSize:10, color:'#64748b' }}>{sub}</p>}
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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', maxWidth:512, margin:'0 auto', paddingTop:32 }}>
      <div style={{ width:96, height:96, background:'linear-gradient(135deg, #2563eb, #1e3a8a)', borderRadius:32, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:32, boxShadow:'0 25px 50px rgba(30,58,138,0.4)' }}>
        <Zap size={48} color="#fff" fill="#fff" />
      </div>

      <h1 style={{ fontSize:36, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:12 }}>
        Welcome to<br />Ignition OS
      </h1>
      <p style={{ color:'#94a3b8', fontSize:14, marginBottom:40, lineHeight:1.6 }}>
        Built for diesel and mechanical shops that are done leaving money on the table.
        In the next <span style={{ color:'#60a5fa', fontWeight:900 }}>30 minutes</span>, we'll show you
        exactly what it can do for your business.
      </p>

      <div style={{ width:'100%', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:40 }}>
        {[
          { icon: DollarSign, label: 'Find your margin leaks', color: '#34d399' },
          { icon: Wrench, label: 'Diagnose & estimate faster', color: '#60a5fa' },
          { icon: Database, label: 'Migrate your shop data', color: '#c084fc' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} style={{ backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:16, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <Icon size={24} color={color} />
            <p style={{ fontSize:9, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'-0.02em', textAlign:'center', lineHeight:1.2 }}>{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={next}
        className="ign-btn-primary"
        style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'20px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:'none', boxShadow:'0 20px 30px rgba(30,58,138,0.4)' }}
      >
        Let's Go <ArrowRight size={18} />
      </button>
      <p style={{ fontSize:9, color:'#334155', marginTop:16, textTransform:'uppercase', letterSpacing:'0.05em' }}>No credit card required · Cancel any time</p>
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
      <div style={{ maxWidth:448, margin:'0 auto', width:'100%' }}>
        <div style={{ marginBottom:32 }}>
          <h2 style={{ fontSize:24, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:4 }}>Your Shop</h2>
          <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>Takes 2 minutes · You can update this later</p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:24 }}>
          <Input label="Shop Name *" value={shopInfo.name} onChange={v => setShopInfo(s => ({ ...s, name: v }))} placeholder="Lone Star Diesel Repair" />
          <Input label="Your Name *" value={ownerName} onChange={setOwnerName} placeholder="John Smith" />
          <Input label="Your Owner PIN (4 digits) *" value={ownerPin} onChange={v => setOwnerPin(v.replace(/\D/g, '').slice(0, 4))} placeholder="••••" type="password" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Input label="Phone" value={shopInfo.phone} onChange={v => setShopInfo(s => ({ ...s, phone: v }))} placeholder="512-555-0100" />
            <Input label="USDOT #" value={shopInfo.usdot} onChange={v => setShopInfo(s => ({ ...s, usdot: v }))} placeholder="12345678" />
          </div>
          <Input label="Address" value={shopInfo.address} onChange={v => setShopInfo(s => ({ ...s, address: v }))} placeholder="123 Fleet Way, Austin, TX" />
        </div>

        {shopInfoError && (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#f87171', backgroundColor:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:12, padding:12, marginBottom:16 }}>
            <AlertCircle size={14} color="#f87171" />
            <p style={{ fontSize:10, fontWeight:700 }}>{shopInfoError}</p>
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <button
            onClick={back}
            className="ign-btn-secondary"
            style={{ padding:'16px 24px', backgroundColor:'#0f172a', border:'1px solid #1e293b', color:'#94a3b8', borderRadius:16, fontWeight:900, fontSize:10, textTransform:'uppercase', display:'flex', alignItems:'center', gap:8 }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={validate}
            disabled={!canContinue}
            className="ign-btn-primary"
            style={{ flex:1, backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            Continue <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  // ── STEP: CHOOSE PATH ──────────────────────────────────────────────────────

  const renderChoosePath = () => (
    <div style={{ maxWidth:512, margin:'0 auto', width:'100%' }}>
      <div style={{ marginBottom:32, textAlign:'center' }}>
        <h2 style={{ fontSize:24, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:8 }}>
          What's Your Biggest Headache?
        </h2>
        <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>Choose one — we'll show you the fix in real time</p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
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
            className="ign-card-hover"
            style={{
              width:'100%', backgroundColor:'#0f172a',
              border:`1px solid ${path === id ? CHOICE_COLORS[color].activeBorder : '#1e293b'}`,
              borderRadius:24, padding:24, display:'flex', alignItems:'center', gap:20,
              textAlign:'left',
            }}
          >
            <div style={{ width:56, height:56, borderRadius:16, backgroundColor:CHOICE_COLORS[color].iconBg, border:`1px solid ${CHOICE_COLORS[color].iconBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon size={24} color={CHOICE_COLORS[color].text} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <p style={{ fontSize:14, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em' }}>{title}</p>
                <span style={{ fontSize:8, fontWeight:900, padding:'2px 8px', borderRadius:999, backgroundColor:CHOICE_COLORS[color].badgeBg, color:CHOICE_COLORS[color].text, textTransform:'uppercase' }}>{badge}</span>
              </div>
              <p style={{ fontSize:10, color:'#64748b' }}>{sub}</p>
            </div>
            <ChevronRight size={18} color="#475569" style={{ flexShrink:0 }} />
          </button>
        ))}
      </div>

      <button
        onClick={back}
        className="ign-btn-ghost"
        style={{ marginTop:24, width:'100%', fontSize:10, fontWeight:900, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 0' }}
      >
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
      <div style={{ maxWidth:448, margin:'0 auto', width:'100%' }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:20, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:4 }}>Margin Check</h2>
          <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>Tell us about a part you recently sold</p>
        </div>

        {!showResult ? (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:24 }}>
              <Input label="Part Name" value={partName} onChange={setPartName} placeholder="e.g. Turbocharger, Oil Filter, DPF..." />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Input label="What you paid vendor ($)" value={costPaid} onChange={setCostPaid} placeholder="0.00" type="number" prefix="$" />
                <Input label="What you charged customer ($)" value={priceCharged} onChange={setPriceCharged} placeholder="0.00" type="number" prefix="$" />
              </div>
            </div>

            <button
              onClick={() => canAnalyze && setShowResult(true)}
              disabled={!canAnalyze}
              className="ign-btn-emerald"
              style={{ width:'100%', backgroundColor:'#059669', color:'#fff', fontWeight:900, padding:'20px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', boxShadow:'0 10px 15px rgba(6,78,59,0.3)' }}
            >
              Analyze My Pricing
            </button>
          </>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
              <ResultCard label="You Charged" value={`$${charged.toFixed(2)}`} sub="Actual sale price" color="text-white" />
              <ResultCard
                label="Suggested Price"
                value={`$${suggested.toFixed(2)}`}
                sub="Based on your margin rules"
                color={suggested > charged ? 'text-emerald-400' : 'text-slate-300'}
              />
            </div>

            {leakagePerPart > 0 ? (
              <div style={{ backgroundColor:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:24, padding:24, marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
                  <TrendingDown size={20} color="#f87171" style={{ flexShrink:0, marginTop:2 }} />
                  <div>
                    <p style={{ fontSize:14, fontWeight:900, color:'#f87171', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em' }}>Margin Leak Detected</p>
                    <p style={{ fontSize:10, color:'#64748b', marginTop:4 }}>
                      On this part alone, you undercharged by <span style={{ color:'#f87171', fontWeight:900 }}>${leakagePerPart.toFixed(2)}</span>.
                    </p>
                  </div>
                </div>

                <div style={{ borderTop:'1px solid #1e293b', paddingTop:16 }}>
                  <p style={{ fontSize:10, fontWeight:900, color:'#64748b', textTransform:'uppercase', marginBottom:8 }}>
                    How many parts like this per week?
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <input
                      type="range" min="1" max="50" value={weeklyParts}
                      onChange={e => setWeeklyParts(parseInt(e.target.value))}
                      style={{ flex:1, height:4, backgroundColor:'#1e293b', borderRadius:999, accentColor:'#ef4444', appearance:'none', WebkitAppearance:'none' }}
                    />
                    <span style={{ color:'#fff', fontWeight:900, fontSize:14, width:32 }}>{weeklyParts}</span>
                  </div>
                  <div style={{ marginTop:16, backgroundColor:'#000', border:'1px solid rgba(239,68,68,0.2)', borderRadius:16, padding:16 }}>
                    <p style={{ fontSize:9, color:'#64748b', textTransform:'uppercase' }}>Annual revenue left on the table</p>
                    <p style={{ fontSize:30, fontWeight:900, color:'#f87171', fontStyle:'italic', letterSpacing:'-0.05em' }}>${annualLeakage.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor:'rgba(5,150,105,0.05)', border:'1px solid rgba(5,150,105,0.2)', borderRadius:24, padding:24, marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
                <TrendingUp size={20} color="#34d399" />
                <p style={{ fontSize:10, color:'#34d399', fontWeight:900, textTransform:'uppercase' }}>Your pricing on this part is solid. Ignition OS will protect that margin automatically.</p>
              </div>
            )}

            <button
              onClick={() => finalize({ first_margin_check: { partName, costPaid: cost, priceCharged: charged, suggested, leakagePerPart, annualLeakage } })}
              className="ign-btn-primary"
              style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'20px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', boxShadow:'0 20px 30px rgba(30,58,138,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              Set Up My Pricing Rules <ArrowRight size={14} />
            </button>
          </>
        )}

        <button
          onClick={back}
          className="ign-btn-ghost"
          style={{ marginTop:16, width:'100%', fontSize:10, fontWeight:900, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 0' }}
        >
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
      <div style={{ maxWidth:448, margin:'0 auto', width:'100%' }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:20, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:4 }}>Live Diagnosis</h2>
          <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>Enter a fault code — get a full estimate instantly</p>
        </div>

        {!estimate ? (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <Input label="Year" value={vehicle.year} onChange={v => setVehicle(s => ({ ...s, year: v }))} placeholder="2019" />
                <Input label="Make" value={vehicle.make} onChange={v => setVehicle(s => ({ ...s, make: v }))} placeholder="Peterbilt" />
                <Input label="Model" value={vehicle.model} onChange={v => setVehicle(s => ({ ...s, model: v }))} placeholder="389" />
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Fault Code</label>
                <input
                  value={faultCode}
                  onChange={e => setFaultCode(e.target.value)}
                  placeholder="Type a code (e.g. 3251) or pick below"
                  className="ign-input"
                  style={{ width:'100%', backgroundColor:'#000', border:'1px solid #1e293b', borderRadius:12, padding:16, color:'#fff', fontWeight:700, fontSize:14 }}
                />
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <p style={{ fontSize:9, fontWeight:900, color:'#334155', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Common Codes</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {commonCodes.map(({ code, name }) => (
                  <button
                    key={code}
                    onClick={() => setFaultCode(code)}
                    className="ign-badge-toggle"
                    style={{
                      fontSize:9, fontWeight:900, padding:'6px 12px', borderRadius:999,
                      border:`1px solid ${faultCode === code ? '#60a5fa' : '#1e293b'}`,
                      backgroundColor: faultCode === code ? '#2563eb' : '#0f172a',
                      color: faultCode === code ? '#fff' : '#64748b',
                      textTransform:'uppercase',
                    }}
                  >
                    {code} — {name.split(' ').slice(0, 2).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runDiagnosis}
              disabled={!faultCode.trim()}
              className="ign-btn-primary"
              style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'20px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none' }}
            >
              Generate Estimate
            </button>
          </>
        ) : (
          <>
            <div style={{ backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:24, padding:24, marginBottom:16 }}>
              <p style={{ fontSize:9, fontWeight:900, color:'#64748b', textTransform:'uppercase', marginBottom:16, letterSpacing:'0.1em' }}>
                {vehicle.year} {vehicle.make} {vehicle.model} — Code {faultCode}
              </p>
              <p style={{ fontSize:18, fontWeight:900, color:'#60a5fa', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:16 }}>{estimate.name}</p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <ResultCard label="Parts Cost" value={`$${estimate.partsCost.toFixed(2)}`} sub="Your cost" />
                <ResultCard label="Labor" value={`${estimate.laborHours}h × $${estimate.rateUsed}`} sub={`= $${estimate.laborCost.toFixed(2)}`} />
              </div>

              <div style={{ borderTop:'1px solid #1e293b', paddingTop:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                  <div>
                    <p style={{ fontSize:9, fontWeight:900, color:'#64748b', textTransform:'uppercase' }}>Customer Quote</p>
                    <p style={{ fontSize:36, fontWeight:900, color:'#34d399', fontStyle:'italic', letterSpacing:'-0.05em' }}>${estimate.retail.toFixed(2)}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:9, fontWeight:900, color:'#64748b', textTransform:'uppercase' }}>Your Gross Margin</p>
                    <p style={{ fontSize:20, fontWeight:900, color:'#fff' }}>
                      {(((estimate.retail - estimate.totalCost) / estimate.retail) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:12, marginBottom:16 }}>
              {!savedJob ? (
                <button
                  onClick={saveAsJob}
                  className="ign-btn-secondary"
                  style={{ flex:1, backgroundColor:'#0f172a', border:'1px solid #1e293b', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:9 }}
                >
                  Save as First Work Order
                </button>
              ) : (
                <div style={{ flex:1, backgroundColor:'rgba(5,150,105,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:16, padding:'16px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <CheckCircle size={14} color="#34d399" />
                  <span style={{ color:'#34d399', fontWeight:900, fontSize:9, textTransform:'uppercase' }}>Work Order Saved</span>
                </div>
              )}
            </div>

            <button
              onClick={() => finalize()}
              className="ign-btn-primary"
              style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'20px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', boxShadow:'0 20px 30px rgba(30,58,138,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              Open My Dashboard <ArrowRight size={14} />
            </button>
          </>
        )}

        <button
          onClick={back}
          className="ign-btn-ghost"
          style={{ marginTop:16, width:'100%', fontSize:10, fontWeight:900, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 0' }}
        >
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
      <div style={{ maxWidth:448, margin:'0 auto', width:'100%' }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:20, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:4 }}>Import Your Shop Data</h2>
          <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em' }}>Start with what you already have</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[
            { id: 'QB', icon: Database, color: 'green', title: 'Connect QuickBooks', sub: 'One click pulls all your customers and recent invoices' },
            { id: 'CSV', icon: Upload, color: 'blue', title: 'Import a Spreadsheet', sub: 'Drag in any CSV from Excel, Google Sheets, or another system' },
            { id: 'MANUAL', icon: User, color: 'purple', title: 'Enter a Few Customers by Hand', sub: 'Just get started — add more later' },
          ].map(({ id, icon: Icon, color, title, sub }) => (
            <button
              key={id}
              onClick={() => setSubPath(id)}
              className="ign-card-hover"
              style={{ width:'100%', backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:24, padding:20, display:'flex', alignItems:'center', gap:16, textAlign:'left' }}
            >
              <div style={{ width:48, height:48, borderRadius:12, backgroundColor:CHOICE_COLORS[color].iconBg, border:`1px solid ${CHOICE_COLORS[color].iconBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={20} color={CHOICE_COLORS[color].text} />
              </div>
              <div>
                <p style={{ fontSize:14, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em' }}>{title}</p>
                <p style={{ fontSize:9, color:'#64748b', marginTop:2 }}>{sub}</p>
              </div>
              <ChevronRight size={16} color="#475569" style={{ marginLeft:'auto' }} />
            </button>
          ))}
        </div>
        <button
          onClick={back}
          className="ign-btn-ghost"
          style={{ marginTop:24, width:'100%', fontSize:10, fontWeight:900, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 0' }}
        >
          <ArrowLeft size={12} /> Change Path
        </button>
      </div>
    );

    return (
      <div style={{ maxWidth:448, margin:'0 auto', width:'100%' }}>
        <button
          onClick={() => { setSubPath(null); setImportResult(null); setQbStatus('idle'); setCsvParsed(null); }}
          className="ign-btn-ghost"
          style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, fontWeight:900, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:24 }}
        >
          <ArrowLeft size={12} /> Choose Different Method
        </button>

        {/* QB sub-path */}
        {subPath === 'QB' && (
          <div>
            <h3 style={{ fontSize:18, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:24 }}>QuickBooks Connection</h3>
            {!importResult ? (
              <div style={{ backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:24, padding:32, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
                <Database size={40} color="#34d399" style={{ marginBottom:16 }} />
                <p style={{ fontSize:14, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', marginBottom:8 }}>One-Click Customer Import</p>
                <p style={{ fontSize:10, color:'#64748b', marginBottom:32 }}>Pulls all active customers and their contact info. No data entry required.</p>
                {qbMessage && (
                  <p style={{ fontSize:10, fontWeight:700, marginBottom:16, color: qbStatus === 'error' ? '#f87171' : '#60a5fa' }}>{qbMessage}</p>
                )}
                <button
                  onClick={connectQuickBooks}
                  disabled={qbStatus === 'connecting'}
                  className="ign-btn-emerald"
                  style={{ width:'100%', backgroundColor:'#16a34a', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none' }}
                >
                  {qbStatus === 'connecting' ? 'Connecting...' : 'Connect QuickBooks'}
                </button>
                <p style={{ fontSize:8, color:'#334155', marginTop:12 }}>You'll be redirected to QuickBooks to authorize. Returns here automatically.</p>
              </div>
            ) : (
              <div style={{ backgroundColor:'rgba(5,150,105,0.05)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:24, padding:32, textAlign:'center' }}>
                <CheckCircle size={40} color="#34d399" style={{ margin:'0 auto 12px' }} />
                <p style={{ fontSize:20, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:4 }}>{importResult.imported} Customers Imported</p>
                <p style={{ fontSize:10, color:'#64748b', marginBottom:24 }}>Your QuickBooks customer list is now in Ignition OS.</p>
                <button
                  onClick={() => finalize()}
                  className="ign-btn-primary"
                  style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                >
                  Open My Dashboard <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* CSV sub-path */}
        {subPath === 'CSV' && (
          <div>
            <h3 style={{ fontSize:18, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:24 }}>Spreadsheet Import</h3>
            {!importResult ? (
              <>
                <div
                  style={{ border:'2px dashed #1e293b', borderRadius:24, padding:40, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', cursor:'pointer', marginBottom:16 }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleCsvFile(e.dataTransfer.files[0]); }}
                >
                  <Upload size={32} color="#475569" style={{ marginBottom:12 }} />
                  <p style={{ fontSize:14, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', fontStyle:'italic' }}>Drop CSV here or tap to browse</p>
                  <p style={{ fontSize:9, color:'#334155', marginTop:4 }}>Works with Excel exports, Google Sheets, and any shop software CSV</p>
                  <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={e => handleCsvFile(e.target.files[0])} />
                </div>

                {csvParsed && !csvParsed.error && (
                  <div style={{ backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:16, marginBottom:16 }}>
                    <p style={{ fontSize:10, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', marginBottom:8 }}>{csvFile?.name}</p>
                    <p style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{csvParsed.totalRows} rows detected</p>
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                      {csvParsed.headers.slice(0, 8).map(h => (
                        <span key={h} style={{ fontSize:8, backgroundColor:'#1e293b', color:'#94a3b8', padding:'4px 8px', borderRadius:4, fontFamily:'monospace' }}>{h}</span>
                      ))}
                    </div>
                  </div>
                )}

                {csvParsed?.error && (
                  <p style={{ color:'#f87171', fontSize:10, fontWeight:700, marginBottom:16 }}>{csvParsed.error}</p>
                )}

                <button
                  onClick={importCsv}
                  disabled={!csvParsed || !!csvParsed.error || csvImporting}
                  className="ign-btn-primary"
                  style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none' }}
                >
                  {csvImporting ? 'Importing...' : `Import ${csvParsed?.totalRows || ''} Customers`}
                </button>
              </>
            ) : (
              <div style={{ backgroundColor:'rgba(5,150,105,0.05)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:24, padding:32, textAlign:'center' }}>
                <CheckCircle size={40} color="#34d399" style={{ margin:'0 auto 12px' }} />
                <p style={{ fontSize:20, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:4 }}>{importResult.imported} Imported · {importResult.skipped} Skipped</p>
                <p style={{ fontSize:10, color:'#64748b', marginBottom:24 }}>Duplicates were automatically skipped.</p>
                <button
                  onClick={() => finalize()}
                  className="ign-btn-primary"
                  style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                >
                  Open My Dashboard <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* MANUAL sub-path */}
        {subPath === 'MANUAL' && (
          <div>
            <h3 style={{ fontSize:18, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:24 }}>Quick Customer Entry</h3>
            {!importResult ? (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:24 }}>
                  {manualCustomers.map((c, i) => (
                    <div key={i} style={{ backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                      <p style={{ fontSize:9, fontWeight:900, color:'#334155', textTransform:'uppercase' }}>Customer {i + 1}</p>
                      <Input label="Name" value={c.name} onChange={v => setManualCustomers(mc => mc.map((x, j) => j === i ? { ...x, name: v } : x))} placeholder="Mike Johnson" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <Input label="Phone" value={c.phone} onChange={v => setManualCustomers(mc => mc.map((x, j) => j === i ? { ...x, phone: v } : x))} placeholder="512-555-0100" />
                        <Input label="Vehicle / Unit" value={c.vehicle} onChange={v => setManualCustomers(mc => mc.map((x, j) => j === i ? { ...x, vehicle: v } : x))} placeholder="2018 Freightliner" />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setManualCustomers(mc => [...mc, { name: '', phone: '', vehicle: '' }])}
                    className="ign-btn-ghost"
                    style={{ width:'100%', fontSize:9, fontWeight:900, color:'#475569', textTransform:'uppercase', padding:'8px 0' }}
                  >
                    + Add Another
                  </button>
                </div>
                <button
                  onClick={importManual}
                  disabled={!manualCustomers.some(c => c.name.trim())}
                  className="ign-btn-primary"
                  style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none' }}
                >
                  Save Customers
                </button>
              </>
            ) : (
              <div style={{ backgroundColor:'rgba(5,150,105,0.05)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:24, padding:32, textAlign:'center' }}>
                <CheckCircle size={40} color="#34d399" style={{ margin:'0 auto 12px' }} />
                <p style={{ fontSize:20, fontWeight:900, color:'#fff', textTransform:'uppercase', fontStyle:'italic', letterSpacing:'-0.05em', marginBottom:4 }}>{importResult.imported} Customers Added</p>
                <button
                  onClick={() => finalize()}
                  className="ign-btn-primary"
                  style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'16px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:10, border:'none', marginTop:24, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                >
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
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', maxWidth:448, margin:'0 auto', paddingTop:16 }}>
        <div style={{ width:64, height:64, background:'linear-gradient(135deg, #059669, #14532d)', borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24, boxShadow:'0 25px 50px rgba(5,150,105,0.4)' }}>
          <CheckCircle size={32} color="#fff" />
        </div>

        <h2 style={{ fontSize:30, fontWeight:900, fontStyle:'italic', color:'#fff', textTransform:'uppercase', letterSpacing:'-0.05em', marginBottom:4 }}>Shop Is Live</h2>
        <p style={{ color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:32 }}>Add your team — they scan once and they're in</p>

        {/* QR Code */}
        <div style={{ backgroundColor:'#fff', padding:20, borderRadius:24, marginBottom:24, boxShadow:'0 25px 50px rgba(0,0,0,0.5)' }}>
          <QRCodeSVG value={joinUrl} size={200} bgColor="#ffffff" fgColor="#000000" level="M" />
        </div>

        <div style={{ width:'100%', backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:16, marginBottom:32, textAlign:'left' }}>
          <p style={{ fontSize:9, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>How it works</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { role: 'Tech', color: '#60a5fa', desc: 'Scans QR → picks Tech → sets PIN → goes to intake' },
              { role: 'Front Office', color: '#c084fc', desc: 'Scans QR → picks Front Office → sets PIN → sees queue' },
            ].map(({ role, color, desc }) => (
              <div key={role} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <span style={{ fontSize:9, fontWeight:900, textTransform:'uppercase', color, width:80, flexShrink:0, paddingTop:2 }}>{role}</span>
                <span style={{ fontSize:9, color:'#64748b' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width:'100%', display:'flex', gap:12, marginBottom:16 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl);
              setCopiedJoinUrl(true);
              setTimeout(() => setCopiedJoinUrl(false), 2000);
            }}
            className="ign-btn-secondary"
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#0f172a', border:'1px solid #334155', color:'#cbd5e1', fontWeight:900, padding:'12px 0', borderRadius:16, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em' }}
          >
            <Copy size={13} /> {copiedJoinUrl ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => window.open(`sms:?body=${encodeURIComponent('Join our shop on Ignition OS: ' + joinUrl)}`)}
            className="ign-btn-secondary"
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'rgba(37,99,235,0.2)', border:'1px solid rgba(59,130,246,0.3)', color:'#60a5fa', fontWeight:900, padding:'12px 0', borderRadius:16, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em' }}
          >
            <Send size={13} /> Send to Phone
          </button>
        </div>

        <button
          onClick={launch}
          className="ign-btn-primary"
          style={{ width:'100%', backgroundColor:'#2563eb', color:'#fff', fontWeight:900, padding:'20px 0', borderRadius:16, textTransform:'uppercase', letterSpacing:'0.1em', fontSize:14, border:'none', boxShadow:'0 20px 30px rgba(30,58,138,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
        >
          Open My Dashboard <ArrowRight size={18} />
        </button>
        <p style={{ fontSize:9, color:'#334155', marginTop:16, textTransform:'uppercase', letterSpacing:'0.05em' }}>Team members can also join later from Admin → Team</p>
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
    <div style={{ minHeight:'100vh', backgroundColor:'#000', color:'#e2e8f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Grid background */}
      <div style={{ position:'fixed', top:0, right:0, bottom:0, left:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(30,41,59,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.2) 1px, transparent 1px)', backgroundSize:'40px 40px' }} />

      <div style={{ position:'relative', zIndex:10, flex:1, display:'flex', flexDirection:'column', padding:24, maxWidth:672, margin:'0 auto', width:'100%' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32, paddingTop:8 }}>
          <span style={{ fontSize:10, fontFamily:'monospace', color:'#3b82f6', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em' }}>Ignition OS // Setup</span>
          <span style={{ fontSize:9, fontWeight:900, color:'#475569', textTransform:'uppercase' }}>Step {stepIndex + 1} of {STEPS.length}</span>
        </div>

        {/* Progress */}
        <ProgressBar steps={STEPS} current={stepIndex} />

        {/* Step content */}
        <div style={{ flex:1 }}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
