import React, { CSSProperties, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Leaf, QrCode, DollarSign,
  CheckCircle, BarChart2, Layers, AlertTriangle, ChevronRight, TrendingDown,
  Truck, Navigation, Send, Copy, X, Plus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_PERMISSIONS } from '../auth/roles';

// ─── Brand ───────────────────────────────────────────────────────────────────
const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const RED   = '#A32D2D';
const GRAY  = '#6b7280';
const DARK  = '#111827';

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputBase: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.9375rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}{required && <span style={{ color: RED }}> *</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputBase}
        onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
        onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
      />
    </div>
  );
}

function ProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 99,
          background: i <= current ? GREEN : '#d1d5db',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '15px 20px',
        background: disabled ? '#e5e7eb' : GREEN,
        color: disabled ? '#9ca3af' : '#fff',
        fontWeight: 700, fontSize: '0.9375rem', borderRadius: 12, border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {children}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: GRAY, fontSize: '0.8125rem', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 4, marginTop: 12,
      }}
    >
      <ArrowLeft size={14} /> Back
    </button>
  );
}

// ─── Path components ──────────────────────────────────────────────────────────

interface PathProps {
  onFinalize: () => void;
  finalizing: boolean;
  finalizeError: string;
  onBack: () => void;
}

function LeakagePath({ onFinalize, finalizing, finalizeError, onBack }: PathProps) {
  const [weeklyTrees, setWeeklyTrees] = useState(20);
  const [declineRate, setDeclineRate] = useState(40);
  const addonValue = 10;

  const weeklyLeakage = Math.round(weeklyTrees * (declineRate / 100) * addonValue);
  const annualLeakage = weeklyLeakage * 52;

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: GREEN }}>Leakage Calculator</h2>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: GRAY }}>See how much add-on revenue walks out the door every week.</p>

      <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: DARK }}>Trees sold per week</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: GREEN }}>{weeklyTrees}</span>
          </div>
          <input type="range" min={1} max={100} value={weeklyTrees}
            onChange={e => setWeeklyTrees(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: GREEN }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>
            <span>1</span><span>100</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: DARK }}>Customers who decline add-ons</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: DARK }}>{declineRate}%</span>
          </div>
          <input type="range" min={0} max={80} step={5} value={declineRate}
            onChange={e => setDeclineRate(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: RED }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>
            <span>0%</span><span>80%</span>
          </div>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', color: GRAY }}>Add-on value per tree (netting)</span>
          <span style={{ fontWeight: 700, color: DARK }}>$10.00</span>
        </div>
      </div>

      <div style={{
        background: annualLeakage > 0 ? '#fef2f2' : '#f0fdf4',
        border: `2px solid ${annualLeakage > 0 ? '#fca5a5' : '#86efac'}`,
        borderRadius: 16, padding: 20, marginBottom: 16,
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Annual revenue left on the table
        </p>
        <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, color: annualLeakage > 0 ? RED : GREEN, lineHeight: 1.1 }}>
          ${annualLeakage.toLocaleString('en-US')}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: GRAY }}>
          {weeklyLeakage > 0
            ? `That's $${weeklyLeakage}/week in missed add-on revenue.`
            : 'Great — your customers are taking add-ons. Cultivar OS will protect that.'}
        </p>
      </div>

      {annualLeakage > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: '0.8125rem', color: DARK, lineHeight: 1.5 }}>
            Cultivar OS flags every declined add-on <strong>the moment it happens</strong> — not at end of day when it's too late.
          </p>
        </div>
      )}

      <PrimaryBtn onClick={onFinalize} disabled={finalizing}>
        {finalizing ? 'Setting up…' : <><span>Set Up My Dashboard</span><ArrowRight size={16} /></>}
      </PrimaryBtn>
      {finalizeError && <p style={{ fontSize: '0.8125rem', color: RED, marginTop: 8, textAlign: 'center' }}>{finalizeError}</p>}
      <BackBtn onClick={onBack} />
    </div>
  );
}

const CHECKOUT_SLIDES = [
  {
    icon: <QrCode size={32} color={GREEN} />,
    title: 'QR Tag on Every Tree',
    body: 'Each tree or container gets a printed QR tag. Attach it at planting time — no app download required.',
  },
  {
    icon: <Leaf size={32} color={GREEN} />,
    title: 'Customer Scans → Sees Plant Profile',
    body: 'Species, size, price, and growth timeline load instantly. Customers can scan before they even ask a question.',
  },
  {
    icon: <DollarSign size={32} color={RED} />,
    title: 'Add-Ons Prompted Automatically',
    body: 'Netting, installation, and other services appear with urgency copy — while the customer is still deciding.',
  },
  {
    icon: <CheckCircle size={32} color="#1d6a2b" />,
    title: 'QuickBooks Invoice Auto-Created',
    body: 'The moment checkout completes, a QuickBooks invoice is generated. No manual entry, no missed sales.',
  },
];

function CheckoutPath({ onFinalize, finalizing, finalizeError, onBack }: PathProps) {
  const [slide, setSlide] = useState(0);
  const s = CHECKOUT_SLIDES[slide];
  const isLast = slide === CHECKOUT_SLIDES.length - 1;

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: GREEN }}>How Checkout Works</h2>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: GRAY }}>Step {slide + 1} of {CHECKOUT_SLIDES.length}</p>

      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 24px', marginBottom: 16,
        textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 200,
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: SAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.icon}
        </div>
        <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: DARK }}>{s.title}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: GRAY, lineHeight: 1.6, maxWidth: 300 }}>{s.body}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
        {CHECKOUT_SLIDES.map((_, i) => (
          <div key={i} onClick={() => setSlide(i)} style={{
            width: i === slide ? 20 : 8, height: 8, borderRadius: 99,
            background: i === slide ? GREEN : '#d1d5db', cursor: 'pointer', transition: 'all 0.2s',
          }} />
        ))}
      </div>

      {isLast ? (
        <>
          <PrimaryBtn onClick={onFinalize} disabled={finalizing}>
            {finalizing ? 'Setting up…' : <><span>Open My Dashboard</span><ArrowRight size={16} /></>}
          </PrimaryBtn>
          {finalizeError && <p style={{ fontSize: '0.8125rem', color: RED, marginTop: 8, textAlign: 'center' }}>{finalizeError}</p>}
        </>
      ) : (
        <PrimaryBtn onClick={() => setSlide(i => i + 1)}>
          Next <ArrowRight size={16} />
        </PrimaryBtn>
      )}
      <BackBtn onClick={onBack} />
    </div>
  );
}

function SetupPath({ onFinalize, finalizing, finalizeError, onBack, nurseryInfo }: PathProps & {
  nurseryInfo: { name: string; address: string };
}) {
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: GREEN }}>You're Almost Ready</h2>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: GRAY }}>Review your details, then connect QuickBooks from your dashboard.</p>

      <div style={{ background: '#fff', borderRadius: 16, padding: '18px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <p style={{ margin: '0 0 12px', fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Nursery Profile
        </p>
        {([
          ['Name', nurseryInfo.name],
          ['Address', nurseryInfo.address || '—'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '0.8125rem', color: GRAY }}>{label}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: DARK, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <BarChart2 size={20} color="#1d6a2b" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '0.875rem', color: GREEN }}>QuickBooks Integration Ready</p>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: GRAY, lineHeight: 1.4 }}>
            Connect from the QuickBooks tile on your dashboard — invoices create automatically on every sale.
          </p>
        </div>
      </div>

      <PrimaryBtn onClick={onFinalize} disabled={finalizing}>
        {finalizing ? 'Setting up…' : <><span>Open My Dashboard</span><ArrowRight size={16} /></>}
      </PrimaryBtn>
      {finalizeError && <p style={{ fontSize: '0.8125rem', color: RED, marginTop: 8, textAlign: 'center' }}>{finalizeError}</p>}
      <BackBtn onClick={onBack} />
    </div>
  );
}

// ─── Delivery wizard path ────────────────────────────────────────────────────

const DEMO_STOPS = [
  { id: '1', name: 'Johnson Family', address: '400 Honeycomb Mesa, Leander, TX 78641' },
  { id: '2', name: 'Martinez Residence', address: '1234 Oak Tree Ln, Cedar Park, TX 78613' },
  { id: '3', name: 'Williams Property', address: '567 Elm Creek Dr, Round Rock, TX 78664' },
];

function DeliveryWizardPath({ onFinalize, finalizing, finalizeError, onBack }: PathProps) {
  const [stops, setStops]   = useState(DEMO_STOPS);
  const [routeUrl, setRouteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function buildRoute() {
    const addresses = stops.filter(s => s.address.trim()).map(s => encodeURIComponent(s.address));
    setRouteUrl(`https://www.google.com/maps/dir/${addresses.join('/')}/`);
  }

  function textDriver() {
    if (!routeUrl) return;
    const body = `Today's nursery delivery route (${stops.length} stops):\n${routeUrl}`;
    window.open(`sms:?body=${encodeURIComponent(body)}`);
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: GREEN }}>Delivery Route Builder</h2>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: GRAY }}>
        Add your stops for today — we'll build the optimized route and send it to your driver.
      </p>

      {!routeUrl ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {stops.map((stop, i) => (
              <div key={stop.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: GREEN, color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    value={stop.name}
                    onChange={e => setStops(ss => ss.map(s => s.id === stop.id ? { ...s, name: e.target.value } : s))}
                    placeholder="Customer name"
                    style={{ border: 'none', outline: 'none', fontWeight: 600, fontSize: '0.875rem', color: DARK, background: 'transparent', padding: 0 }}
                  />
                  <input
                    value={stop.address}
                    onChange={e => { setStops(ss => ss.map(s => s.id === stop.id ? { ...s, address: e.target.value } : s)); setRouteUrl(null); }}
                    placeholder="Delivery address"
                    style={{ border: 'none', borderTop: '1px solid #f3f4f6', outline: 'none', fontSize: '0.8125rem', color: GRAY, background: 'transparent', padding: '4px 0 0', width: '100%' }}
                  />
                </div>
                <button onClick={() => setStops(ss => ss.filter(s => s.id !== stop.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#d1d5db' }}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStops(ss => [...ss, { id: Date.now().toString(), name: '', address: '' }])}
            style={{ width: '100%', background: 'none', border: '1.5px dashed #d1d5db', borderRadius: 12, padding: '12px', color: GRAY, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}
          >
            <Plus size={15} /> Add Stop
          </button>

          <PrimaryBtn onClick={buildRoute} disabled={stops.filter(s => s.address.trim()).length === 0}>
            <Navigation size={16} /> Build Route · {stops.length} Stop{stops.length !== 1 ? 's' : ''}
          </PrimaryBtn>
        </>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Navigation size={18} color={GREEN} />
            <span style={{ fontWeight: 700, color: GREEN }}>Route ready — {stops.length} stops</span>
          </div>
          {stops.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: GREEN, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: DARK }}>{s.name}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: GRAY }}>{s.address}</p>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <a href={routeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 20px', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 12, textDecoration: 'none' }}>
              <Navigation size={16} /> Open in Google Maps
            </a>
            <button onClick={textDriver} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 20px', background: '#eff6ff', border: '1.5px solid #93c5fd', color: '#1d4ed8', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 12, cursor: 'pointer' }}>
              <Send size={16} /> Text Route to Driver
            </button>
            <button onClick={() => { navigator.clipboard.writeText(routeUrl!); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', background: '#f9fafb', border: '1.5px solid #e5e7eb', color: DARK, fontWeight: 600, fontSize: '0.875rem', borderRadius: 12, cursor: 'pointer' }}>
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy Route Link'}
            </button>
          </div>
        </div>
      )}

      <PrimaryBtn onClick={onFinalize} disabled={finalizing}>
        {finalizing ? 'Setting up…' : <><span>Open My Dashboard</span><ArrowRight size={16} /></>}
      </PrimaryBtn>
      {finalizeError && <p style={{ fontSize: '0.8125rem', color: RED, marginTop: 8, textAlign: 'center' }}>{finalizeError}</p>}
      <BackBtn onClick={onBack} />
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

type Path = 'LEAKAGE' | 'CHECKOUT' | 'SETUP' | 'DELIVERY';

const STEPS = ['WELCOME', 'NURSERY_SETUP', 'CHOOSE_PATH', 'PATH_EXPERIENCE', 'DONE'] as const;

export function OnboardingWizard() {
  const navigate = useNavigate();

  const [stepIndex, setStepIndex]   = useState(0);
  const [path, setPath]             = useState<Path | null>(null);
  const [nurseryInfo, setNurseryInfo] = useState({ name: '', address: '' });
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  // When truthy, a businesses row already exists (OwnerSignup created it). Skip NURSERY_SETUP.
  const [existingBusinessId, setExistingBusinessId] = useState<string | null>(null);

  useEffect(() => {
    async function checkExisting() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Prefer the businessId passed by OwnerSignup.onSuccess via ?biz= query param.
      // This avoids maybeSingle() failing when the user owns multiple nursery businesses.
      const bizIdFromUrl = new URLSearchParams(window.location.search).get('biz');

      if (bizIdFromUrl) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id, name')
          .eq('id', bizIdFromUrl)
          .eq('owner_id', user.id)
          .maybeSingle();
        if (biz) {
          setExistingBusinessId(biz.id);
          setNurseryInfo(n => ({ ...n, name: biz.name ?? '' }));
          setStepIndex(STEPS.indexOf('CHOOSE_PATH'));
          return;
        }
      }

      // Fallback: most recently created nursery business for this user.
      // Uses order + limit(1) to avoid maybeSingle() error on multiple rows.
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('owner_id', user.id)
        .eq('business_type', 'nursery')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (biz) {
        setExistingBusinessId(biz.id);
        setNurseryInfo(n => ({ ...n, name: biz.name ?? '' }));
        setStepIndex(STEPS.indexOf('CHOOSE_PATH'));
      }
    }
    checkExisting();
  }, []);

  const step = STEPS[stepIndex];
  const next = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex(i => Math.max(i - 1, 0));

  async function finalize() {
    setFinalizing(true);
    setFinalizeError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      let businessId = existingBusinessId;

      if (!businessId) {
        // DUPLICATE-CREATE GUARD: the mount-time checkExisting() can miss a just-created business
        // under the write-then-read race (the row isn't visible yet → existingBusinessId stayed
        // null). A blind INSERT here would create a SECOND businesses row. Re-resolve authoritatively
        // at finalize time — the race window is long closed by now — and reuse the row if it exists.
        // Only a genuinely business-less user (manual /onboarding nav, the real legacy path) falls
        // through to create. finalize can therefore NEVER insert a duplicate businesses row.
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .eq('business_type', 'nursery')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          businessId = existing.id as string;
          console.log('[TRACE:BUSINESS] onboarding finalize: recovered existing business (duplicate-create guard)', { businessId });
        } else {
        // Legacy path: wizard reached directly without OwnerSignup (e.g. manual /onboarding nav),
        // user genuinely has no business → create it. Phone is NOT collected here anymore (set at
        // signup R1, edited in Settings R3, personal phone on /profile).
        const newBusinessId = crypto.randomUUID();
        const { error } = await supabase.from('businesses').insert({
          id: newBusinessId,
          owner_id: user.id,
          name: nurseryInfo.name.trim(),
          address: nurseryInfo.address.trim() || null,
          business_type: 'nursery',
          trial_started_at: new Date().toISOString(),
        });
        if (error) {
          setFinalizeError(error.message);
          setFinalizing(false);
          return;
        }
        businessId = newBusinessId;

        // business_members row only needed on the legacy path; OwnerSignup already creates it.
        // PERSON NAME source of truth = auth.user_metadata.full_name. Prefer it; if this legacy
        // user has none yet, seed it so the person displays (bootstrap→person bridge, name-layer).
        const meta = (user.user_metadata as { full_name?: string; name?: string } | null) ?? {};
        const personName = meta.full_name ?? meta.name ?? nurseryInfo.name;
        if (!meta.full_name || !meta.full_name.trim()) {
          await supabase.auth.updateUser({ data: { full_name: personName } });
        }
        await supabase.from('business_members').insert({
          business_id: businessId,
          user_id: user.id,
          name: personName,           // display-fallback copy on the membership row
          email: user.email ?? null,
          phone: null,
          role: 'OWNER',
          permissions: DEFAULT_PERMISSIONS.OWNER,
          active: true,
          invite_id: null,
        });
        }
      }

      // nursery_profiles row — upsert so it's safe whether or not it already exists.
      // Check { error }: a failed write must NOT show the "is live" screen over it
      // (was swallowed — the upsert 400s when business_id has no unique constraint
      // for ON CONFLICT to target; see Fix 2 migration). nursery_profiles is not
      // critical to business existence, so block-with-message rather than fake success.
      const { error: profileError } = await supabase
        .from('nursery_profiles')
        .upsert({ business_id: businessId }, { onConflict: 'business_id' });
      if (profileError) {
        console.log('[TRACE:BUSINESS] onboarding finalize: nursery_profiles upsert ERROR', {
          businessId,
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
        });
        setFinalizeError('Could not finish setup: ' + profileError.message);
        setFinalizing(false);
        return;
      }
      setStepIndex(STEPS.indexOf('DONE'));
    } catch {
      setFinalizeError('Something went wrong. Please try again.');
      setFinalizing(false);
    }
  }

  // ── WELCOME ─────────────────────────────────────────────────────────────────
  const renderWelcome = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 8 }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24, background: GREEN,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 22, boxShadow: '0 8px 24px rgba(39,80,10,0.3)',
      }}>
        <Leaf size={40} color="#fff" />
      </div>

      <h1 style={{ margin: '0 0 10px', fontSize: '1.75rem', fontWeight: 800, color: GREEN, lineHeight: 1.2 }}>
        Welcome to<br />Cultivar OS
      </h1>
      <p style={{ color: GRAY, fontSize: '0.9375rem', marginBottom: 28, lineHeight: 1.6, maxWidth: 320 }}>
        Built for nurseries that are done losing revenue to manual processes.
        In a few minutes we'll show you exactly what it can do for your business.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%', marginBottom: 28 }}>
        {[
          { icon: <TrendingDown size={20} color={RED} />, label: 'Track leakage\nautomatically' },
          { icon: <QrCode size={20} color={GREEN} />, label: 'QR checkout\nin 60 seconds' },
          { icon: <DollarSign size={20} color="#1d6a2b" />, label: 'QuickBooks\ninvoicing' },
        ].map(({ icon, label }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 12, padding: '14px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}>
            {icon}
            <p style={{ margin: 0, fontSize: '0.6875rem', fontWeight: 600, color: DARK, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <PrimaryBtn onClick={next}>
        Get Started <ArrowRight size={16} />
      </PrimaryBtn>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 12 }}>Takes about 3 minutes · No credit card required</p>
    </div>
  );

  // ── NURSERY SETUP ────────────────────────────────────────────────────────────
  const renderNurserySetup = () => {
    const canContinue = nurseryInfo.name.trim().length > 1;
    return (
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: GREEN }}>Your Nursery</h2>
        <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: GRAY }}>You can update this any time from your dashboard.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <Field label="Nursery Name" required value={nurseryInfo.name}
            onChange={v => setNurseryInfo(n => ({ ...n, name: v }))} placeholder="Green Thumb Nursery" />
          <Field label="Address" value={nurseryInfo.address}
            onChange={v => setNurseryInfo(n => ({ ...n, address: v }))} placeholder="123 Garden Rd, Austin, TX" />
        </div>

        <PrimaryBtn onClick={next} disabled={!canContinue}>
          Continue <ArrowRight size={16} />
        </PrimaryBtn>
        <BackBtn onClick={back} />
      </div>
    );
  };

  // ── CHOOSE PATH ──────────────────────────────────────────────────────────────
  const renderChoosePath = () => (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: GREEN }}>What would you like to see first?</h2>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: GRAY }}>Choose one — we'll show you the value in real time.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {([
          {
            id: 'LEAKAGE' as Path,
            icon: <TrendingDown size={22} color={RED} />,
            bg: '#fef2f2', border: '#fca5a5', badgeColor: RED,
            title: "Show me what I'm losing",
            sub: 'Calculate the add-on revenue leaving with every declined netting or install',
            badge: 'Most impactful',
          },
          {
            id: 'CHECKOUT' as Path,
            icon: <QrCode size={22} color={GREEN} />,
            bg: '#f0f7e8', border: '#86efac', badgeColor: GREEN,
            title: 'Show me how checkout works',
            sub: 'Walk through QR scan → add-ons → QuickBooks invoice in under a minute',
            badge: 'Fastest demo',
          },
          {
            id: 'SETUP' as Path,
            icon: <Layers size={22} color="#2563eb" />,
            bg: '#eff6ff', border: '#93c5fd', badgeColor: '#2563eb',
            title: 'Set up my nursery',
            sub: 'Connect QuickBooks, review your inventory, and get ready for the first scan',
            badge: 'Full setup',
          },
          {
            id: 'DELIVERY' as Path,
            icon: <Truck size={22} color="#d97706" />,
            bg: '#fffbeb', border: '#fcd34d', badgeColor: '#d97706',
            title: 'Route my deliveries',
            sub: 'Enter stops, build an optimized route, and text it to your driver in one tap',
            badge: 'New',
          },
        ] as const).map(({ id, icon, bg, border, badgeColor, title, sub, badge }) => (
          <button
            key={id}
            onClick={() => { setPath(id); next(); }}
            style={{
              background: '#fff', border: `1.5px solid ${path === id ? border : '#e5e7eb'}`,
              borderRadius: 14, padding: '16px 14px',
              display: 'flex', alignItems: 'center', gap: 14,
              textAlign: 'left', cursor: 'pointer', width: '100%',
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: DARK }}>{title}</span>
                <span style={{
                  fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                  background: `${badgeColor}18`, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {badge}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: GRAY, lineHeight: 1.4 }}>{sub}</p>
            </div>
            <ChevronRight size={16} color="#d1d5db" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <BackBtn onClick={back} />
    </div>
  );

  // ── DONE ─────────────────────────────────────────────────────────────────────
  const renderDone = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22, background: '#dcfce7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, boxShadow: '0 6px 18px rgba(39,80,10,0.2)',
      }}>
        <CheckCircle size={36} color={GREEN} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.625rem', fontWeight: 800, color: GREEN }}>
        {nurseryInfo.name} is live
      </h2>
      <p style={{ color: GRAY, fontSize: '0.9375rem', marginBottom: 32, lineHeight: 1.6, maxWidth: 320 }}>
        Your nursery is set up. Print a QR tag, scan it, and run your first checkout in the next 5 minutes.
      </p>
      <PrimaryBtn onClick={() => navigate('/dashboard')}>
        Open My Dashboard <ArrowRight size={16} />
      </PrimaryBtn>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  const pathProps: PathProps = {
    onFinalize: finalize,
    finalizing,
    finalizeError,
    onBack: back,
  };

  const renderStep = () => {
    switch (step) {
      case 'WELCOME':       return renderWelcome();
      case 'NURSERY_SETUP': return renderNurserySetup();
      case 'CHOOSE_PATH':   return renderChoosePath();
      case 'PATH_EXPERIENCE':
        if (path === 'LEAKAGE')  return <LeakagePath {...pathProps} />;
        if (path === 'CHECKOUT') return <CheckoutPath {...pathProps} />;
        if (path === 'SETUP')    return <SetupPath {...pathProps} nurseryInfo={nurseryInfo} />;
        if (path === 'DELIVERY') return <DeliveryWizardPath {...pathProps} />;
        return null;
      case 'DONE':          return renderDone();
      default:              return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: SAGE }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: GREEN, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Cultivar OS · Setup
          </span>
          <span style={{ fontSize: '0.75rem', color: GRAY }}>
            Step {stepIndex + 1} of {STEPS.length}
          </span>
        </div>

        <ProgressBar total={STEPS.length} current={stepIndex} />

        {renderStep()}
      </div>
    </div>
  );
}
