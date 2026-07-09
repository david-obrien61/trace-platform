import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext } from '../context/BusinessProvider';
import { normalizePhone } from '../utils/normalizePhone';
import {
  CATEGORY_OPTIONS, TIMING_OPTIONS, PRICE_TYPE_OPTIONS, PRICE_UNIT_OPTIONS,
  TRANSPORT_MODE_OPTIONS, TIMING_LABEL,
} from '../business-logic/serviceOfferingEnums';

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px',
  border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: '0.9375rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

// ── Required-field validation (the REFERENCE implementation) ─────────────────
// The cross-cutting platform rule (user_stories.md ## NEEDED): a save with an empty required field
// BLOCKS, HIGHLIGHTS the offending field, and SAYS WHY — never fails silently. Other forms copy this
// shape: validate on save-attempt → if the map is non-empty, set it as error state and return.
// 0 is a VALID price (a free service) — only a blank/non-numeric price is rejected (D-9 honesty:
// blank ≠ free; the owner must state 0). Error red reuses the shared RED (the compliance/netting red).

function validateServiceForm(f: {
  name: string; price: string; category: string; transportMode?: string;
}): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = 'Name is required.';
  const price = f.price.trim();
  if (price === '') errs.price = 'Price is required — enter 0 for a free service.';
  else if (isNaN(parseFloat(price))) errs.price = 'Price must be a number — enter 0 for a free service.';
  if (!f.category) errs.category = 'Category is required.';
  // Category-scoped: a transport service must say who transports (self / staff).
  if (f.category === 'transport' && !f.transportMode) errs.transportMode = 'Transport mode is required for a transport service.';
  return errs;
}

// Red error border merged onto an input whose field failed validation.
function errBorder(hasErr: boolean): React.CSSProperties {
  return hasErr ? { borderColor: RED, boxShadow: `0 0 0 1px ${RED}` } : {};
}

// Inline red message under a field. Renders nothing when the field is valid.
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ margin: '3px 0 0', fontSize: '0.75rem', fontWeight: 600, color: RED }}>{msg}</p>;
}

// Small captioned wrapper for a form control — a tiny uppercase label over its input, so the
// un-conflated fields (Price type vs Per unit, Category, Transport mode) read clearly. flex:1 so
// two sit side-by-side.
function FieldLabel({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>
        {text}
      </p>
      {children}
    </div>
  );
}

// Collapsible card. Each card owns its OWN open state (RULE 2b, ledger #50): toggling one NEVER
// closes another — no shared accordion, multiple open at once, owner may expand everything (free
// expand/collapse, D-21). The collapse control is a CLEARLY VISIBLE, operable pill — not a faint
// decorative glyph (the prior ▾ was a 0.7rem gray char that read as static, so the page felt like
// an un-collapsible scroll wall). `defaultOpen` keeps the initial appearance for existing callers.
function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          marginBottom: open ? 14 : 0, textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700, color: GRAY,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {title}
        </span>
        {/* Visible, operable toggle — a bordered pill with a label + chevron, so it plainly reads
            as a clickable collapse control. */}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
            fontSize: '0.6875rem', fontWeight: 700, color: GREEN,
            border: `1px solid ${GREEN}`, borderRadius: 999, padding: '3px 9px',
            background: '#f0f7e8', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          {open ? 'Hide' : 'Show'}
          <span style={{ fontSize: '0.6rem' }}>{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && children}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
        onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
      />
    </div>
  );
}

interface ServiceOffering {
  id: string;
  name: string;
  description: string | null;
  category: string;
  timing: string;
  price_type: string;
  price_unit: string;
  price: number;
  transport_mode: string | null;
  trigger_transport_mode: string | null;
  requires_address: boolean;
  pre_selected: boolean;
  is_active: boolean;
  sort_order: number;
}

// Edit-form shape — extends the old name/price/compliance set with the attach-rule fields
// (category · price_type · price_unit · transport_mode · requires_address · trigger_transport_mode)
// so an owner can FIX a mis-shaped service (e.g. move a fused row's category), not just rename it.
interface EditForm {
  name: string;
  description: string;
  price: string;
  category: string;
  price_type: string;
  price_unit: string;
  transport_mode: string;
  requires_address: boolean;
  trigger_transport_mode: string;
  compliance_title: string;
  compliance_body: string;
  service_note: string;
}

// CATEGORY_LABEL / TIMING_LABEL now come from the shared serviceOfferingEnums module
// (imported above) — the ONE generic source for every service-editor surface (AC-1).

interface SettingsProps {
  // Optional: the persistent breadcrumb (AppLayout) is the canonical "up" affordance now, so the
  // host may omit this. When omitted, no back button renders (Nav C2). Kept for any host that
  // still wants its own control.
  onBack?: () => void;
  verticalSection?: React.ReactNode;
  accountingConnectUrl?: string;
  // Preferred: the SAME connect action the Dashboard uses (useQboConnect — popup + poll).
  // When provided, the Accounting card triggers it via a button instead of a dead <a href>
  // (which navigated away with no OAuth poll → the broken Settings connect path). The plain
  // accountingConnectUrl link remains the fallback for hosts that don't pass an action.
  onConnectAccounting?: () => void;
  accountingConnecting?: boolean;
  accountingError?: string;
  // When set, render ONLY that section as a direct-access full-screen destination (RULE 2a,
  // ledger #50) — Business Profile, Accounting, or Services reached straight from the menu, no long
  // scroll. Services is the offerings editor as its OWN nav destination (was orphaned at
  // /settings/all — nav rewire 2026-07-07, tech-debt #47).
  // Undefined (default) → render the full page (UNCHANGED for every existing caller, incl. Ignition).
  section?: 'business' | 'accounting' | 'services';
  // When true, the Accounting card is NOT rendered on the full page — the host already exposes the
  // SAME connect action elsewhere (its own /settings/accounting destination + the Dashboard prompt),
  // so a third copy on the full page is redundant (Item 4). Default false → unchanged for any host
  // that doesn't have a dedicated accounting destination. The underlying logic is one hook either
  // way (onConnectAccounting / useQboConnect); this only drops the duplicate surface.
  accountingHasOwnDestination?: boolean;
  // Footer link to the full settings page (the leftover sections — Services / vertical). Shown
  // ONLY on a section-isolated view, so nothing on the full page is orphaned.
  onMoreSettings?: () => void;
}

export function Settings({
  onBack, verticalSection, accountingConnectUrl,
  onConnectAccounting, accountingConnecting, accountingError,
  section, onMoreSettings, accountingHasOwnDestination = false,
}: SettingsProps) {
  // `full` = the unfiltered page (all sections + vertical). A section filter renders just one card.
  const full = !section;
  const { business, businessId, reload } = useBusinessContext();

  // ── Business profile ───────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', phone: '', address: '', email: '', website: '', tax_rate: '',
  });
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!business) return;
    setForm({
      name:     business.name,
      phone:    business.phone    ?? '',
      address:  business.address  ?? '',
      email:    business.email    ?? '',
      website:  business.website  ?? '',
      tax_rate: String(business.tax_rate),
    });
  }, [business]);

  async function saveProfile() {
    if (!businessId) return;
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('businesses').update({
      name:     form.name.trim(),
      phone:    normalizePhone(form.phone),   // ONE shared storage normalization (R1/R3/profile)
      address:  form.address.trim()  || null,
      email:    form.email.trim()    || null,
      website:  form.website.trim()  || null,
      tax_rate: parseFloat(form.tax_rate) || 0.0825,
    }).eq('id', businessId);

    setSaving(false);
    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Saved');
      reload();
      setTimeout(() => setSaveMsg(''), 2000);
    }
  }

  // ── Service offerings ──────────────────────────────────────────────────────
  const [offerings, setOfferings]         = useState<ServiceOffering[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editForm, setEditForm]           = useState<EditForm>({
    name: '', description: '', price: '',
    category: 'addon', price_type: 'per_unit', price_unit: 'plant',
    transport_mode: 'staff', requires_address: false, trigger_transport_mode: '',
    compliance_title: '', compliance_body: '', service_note: '',
  });
  const [savingOffering, setSavingOffering] = useState(false);
  const [editErrors, setEditErrors]         = useState<Record<string, string>>({});

  // Add-new form
  const [showAddForm, setShowAddForm]     = useState(false);
  const [newName, setNewName]             = useState('');
  const [newDesc, setNewDesc]             = useState('');
  const [newPrice, setNewPrice]           = useState('');
  const [newCategory, setNewCategory]     = useState('addon');
  const [newTiming, setNewTiming]         = useState('at_checkout');
  const [newPriceType, setNewPriceType]   = useState('per_unit');
  const [newPriceUnit, setNewPriceUnit]   = useState('plant');   // DISTINCT from price_type — no longer derived
  const [newTransportMode, setNewTransportMode]       = useState('staff'); // only when category=transport
  const [newRequiresAddress, setNewRequiresAddress]   = useState(false);   // only when category=transport
  const [newTriggerMode, setNewTriggerMode]           = useState('');      // '' = always show; only when category=addon
  const [addingOffering, setAddingOffering] = useState(false);
  const [addErrors, setAddErrors]           = useState<Record<string, string>>({});

  useEffect(() => {
    if (!businessId) return;
    loadOfferings();
  }, [businessId]);

  async function loadOfferings() {
    setOfferingsLoading(true);
    const { data } = await supabase
      .from('service_offerings')
      .select('*')
      .eq('business_id', businessId!)
      .order('sort_order', { ascending: true });
    setOfferings((data ?? []) as ServiceOffering[]);
    setOfferingsLoading(false);
  }

  async function toggleOffering(id: string, current: boolean) {
    // [TRACE:SERVICE] write scoped to the ACTIVE business_id (rows loaded .eq('business_id', businessId)
    // + RLS owner-fence). ON by default (STD-003) until owner-proven.
    console.log('[TRACE:SERVICE] save', { businessId, serviceId: id, action: current ? 'deactivate' : 'activate' });
    await supabase.from('service_offerings').update({ is_active: !current }).eq('id', id);
    setOfferings(prev => prev.map(o => o.id === id ? { ...o, is_active: !current } : o));
  }

  function startEdit(o: ServiceOffering) {
    setEditingId(o.id);
    setEditErrors({});
    setEditForm({
      name:              o.name,
      description:       o.description       ?? '',
      price:             String(o.price),
      category:          o.category,
      price_type:        o.price_type,
      price_unit:        o.price_unit,
      transport_mode:    o.transport_mode ?? 'staff',
      requires_address:  o.requires_address,
      trigger_transport_mode: o.trigger_transport_mode ?? '',
      compliance_title:  (o as any).compliance_title  ?? '',
      compliance_body:   (o as any).compliance_body   ?? '',
      service_note:      (o as any).service_note      ?? '',
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    // Validate BEFORE touching the DB — block + highlight + message, never a silent reject (FIX 5).
    const errs = validateServiceForm({
      name: editForm.name, price: editForm.price,
      category: editForm.category, transportMode: editForm.transport_mode,
    });
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      console.log('[TRACE:SERVICE] save blocked', { businessId, serviceId: editingId, action: 'edit', missing: Object.keys(errs) });
      return;
    }
    setEditErrors({});
    setSavingOffering(true);
    const price = parseFloat(editForm.price);
    const isTransport = editForm.category === 'transport';
    const isAddon     = editForm.category === 'addon';
    // Category-scoped rules: transport carries transport_mode + requires_address; an addon can be
    // gated by trigger_transport_mode. Clear the ones that don't apply so moving a service between
    // categories can't leave a stale rule behind.
    const transport_mode         = isTransport ? editForm.transport_mode : null;
    const requires_address       = isTransport ? editForm.requires_address : false;
    const trigger_transport_mode = isAddon && editForm.trigger_transport_mode ? editForm.trigger_transport_mode : null;
    // [TRACE:SERVICE] log the un-conflated rule being written.
    console.log('[TRACE:SERVICE] save', {
      businessId, serviceId: editingId, action: 'edit',
      category: editForm.category, price_type: editForm.price_type, price_unit: editForm.price_unit,
      transport_mode, trigger_transport_mode, requires_address,
    });
    await supabase.from('service_offerings').update({
      name:             editForm.name.trim(),
      description:      editForm.description.trim()      || null,
      price,
      category:         editForm.category,
      price_type:       editForm.price_type,
      price_unit:       editForm.price_unit,
      transport_mode,
      requires_address,
      trigger_transport_mode,
      compliance_title: editForm.compliance_title.trim() || null,
      compliance_body:  editForm.compliance_body.trim()  || null,
      service_note:     editForm.service_note.trim()     || null,
    }).eq('id', editingId);
    setOfferings(prev => prev.map(o =>
      o.id === editingId
        ? {
            ...o,
            name: editForm.name.trim(), description: editForm.description.trim() || null, price,
            category: editForm.category, price_type: editForm.price_type, price_unit: editForm.price_unit,
            transport_mode, requires_address, trigger_transport_mode,
          }
        : o
    ));
    setEditingId(null);
    setSavingOffering(false);
  }

  async function deleteOffering(id: string) {
    console.log('[TRACE:SERVICE] save', { businessId, serviceId: id, action: 'delete' });
    await supabase.from('service_offerings').delete().eq('id', id);
    setOfferings(prev => prev.filter(o => o.id !== id));
  }

  async function addOffering() {
    if (!businessId) return;
    // Validate BEFORE touching the DB — block + highlight + message, never a silent reject (FIX 5).
    const errs = validateServiceForm({
      name: newName, price: newPrice,
      category: newCategory, transportMode: newTransportMode,
    });
    if (Object.keys(errs).length > 0) {
      setAddErrors(errs);
      console.log('[TRACE:SERVICE] save blocked', { businessId, action: 'add', missing: Object.keys(errs) });
      return;
    }
    setAddErrors({});
    setAddingOffering(true);
    const price = parseFloat(newPrice);
    const isTransport = newCategory === 'transport';
    const isAddon     = newCategory === 'addon';
    // [TRACE:SERVICE] log the un-conflated rule being written (category · price_type · price_unit).
    console.log('[TRACE:SERVICE] save', {
      businessId, action: 'add',
      category: newCategory, price_type: newPriceType, price_unit: newPriceUnit,
      transport_mode: isTransport ? newTransportMode : null,
      trigger_transport_mode: isAddon && newTriggerMode ? newTriggerMode : null,
      requires_address: isTransport ? newRequiresAddress : false,
    });
    const { data, error } = await supabase.from('service_offerings').insert({
      business_id:  businessId,
      name:         newName.trim(),
      description:  newDesc.trim() || null,
      category:     newCategory,
      timing:       newTiming,
      price_type:   newPriceType,
      price_unit:   newPriceUnit,   // OWNER-SET, no longer derived from price_type
      price,
      // transport_mode is only meaningful for a transport service (self triggers netting).
      transport_mode:         isTransport ? newTransportMode : null,
      // trigger_transport_mode gates an addon to a chosen transport mode ('' = always show).
      trigger_transport_mode: isAddon && newTriggerMode ? newTriggerMode : null,
      // a delivery/install service needs a destination address.
      requires_address:       isTransport ? newRequiresAddress : false,
      is_active:    true,
      pre_selected: false,
      sort_order:   offerings.length + 10,
    }).select('*').single();

    if (!error && data) {
      setOfferings(prev => [...prev, data as ServiceOffering]);
      setNewName(''); setNewDesc(''); setNewPrice('');
      setNewCategory('addon'); setNewTiming('at_checkout');
      setNewPriceType('per_unit'); setNewPriceUnit('plant');
      setNewTransportMode('staff'); setNewRequiresAddress(false); setNewTriggerMode('');
      setShowAddForm(false);
    }
    setAddingOffering(false);
  }

  // ── Customer match (AI) ───────────────────────────────────────────────────
  interface MatchResult {
    customerId: string;
    customerName: string;
    fitScore: number;
    fitReason: string;
    suggestedMessage: string;
    email: string | null;
    phone: string | null;
  }
  const [matchOfferingId, setMatchOfferingId]         = useState<string | null>(null);
  const [matchOfferingName, setMatchOfferingName]     = useState('');
  const [matchResults, setMatchResults]               = useState<MatchResult[]>([]);
  const [matchLoading, setMatchLoading]               = useState(false);
  const [matchError, setMatchError]                   = useState('');
  const [copiedIdx, setCopiedIdx]                     = useState<number | null>(null);

  async function findCustomers(offering: ServiceOffering) {
    setMatchOfferingId(offering.id);
    setMatchOfferingName(offering.name);
    setMatchResults([]);
    setMatchError('');
    setMatchLoading(true);
    try {
      const resp = await fetch('/api/services/customer-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, offeringId: offering.id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Unknown error');
      setMatchResults(data.matches ?? []);
    } catch (err: any) {
      setMatchError(err.message ?? 'Failed to load matches');
    }
    setMatchLoading(false);
  }

  function copyMessage(text: string, idx: number) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  // Group offerings for display
  const transportOfferings = offerings.filter(o => o.category === 'transport');
  const addonOfferings     = offerings.filter(o => o.category === 'addon');
  const otherOfferings     = offerings.filter(o => o.category !== 'transport' && o.category !== 'addon');

  const accountingConnected = !!business?.accounting_company_id;

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ← Back
          </button>
        )}
        <div>
          <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
            {business?.name}
          </p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            {section === 'business' ? 'Business Profile' : section === 'accounting' ? 'Accounting' : section === 'services' ? 'Services' : 'Settings'}
          </h1>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Business Profile ── (full page OR the isolated /settings/business destination) */}
        {(full || section === 'business') && (
        <SectionCard title="Business Profile">
          <Field label="Business name"    value={form.name}     onChange={v => setForm(f => ({ ...f, name: v }))}     placeholder="LAWNS Tree Farm, LLC" />
          <Field label="Phone"            value={form.phone}    onChange={v => setForm(f => ({ ...f, phone: v }))}    placeholder="(512) 555-0100" type="tel" />
          <Field label="Address"          value={form.address}  onChange={v => setForm(f => ({ ...f, address: v }))}  placeholder="400 Honeycomb Mesa, Leander TX" />
          <Field label="Email"            value={form.email}    onChange={v => setForm(f => ({ ...f, email: v }))}    placeholder="info@yourbusiness.com" type="email" />
          <Field label="Website"          value={form.website}  onChange={v => setForm(f => ({ ...f, website: v }))}  placeholder="https://yourbusiness.com" />
          <Field label="Tax rate (e.g. 0.0825 = 8.25%)" value={form.tax_rate} onChange={v => setForm(f => ({ ...f, tax_rate: v }))} placeholder="0.0825" />
          <button
            onClick={saveProfile} disabled={saving}
            style={{
              width: '100%', padding: '13px 20px', marginTop: 8,
              background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff',
              fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saveMsg && (
            <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? RED : GREEN, marginTop: 8, textAlign: 'center' }}>
              {saveMsg}
            </p>
          )}
        </SectionCard>
        )}

        {/* ── Accounting ── (the isolated /settings/accounting destination always; on the full page
            only when the host has no dedicated accounting destination — Item 4: one connect action,
            no redundant third card). */}
        {(section === 'accounting' || (full && !accountingHasOwnDestination)) && (
        <SectionCard title="Accounting">
          {accountingConnected ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>✓</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534', margin: 0 }}>
                    {business?.accounting_type === 'quickbooks' ? 'QuickBooks' : business?.accounting_type ?? 'Accounting'} connected
                  </p>
                  {business?.accounting_needs_reconnect && (
                    <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '2px 0 0' }}>⚠ Reconnection needed</p>
                  )}
                </div>
              </div>
              {onConnectAccounting ? (
                <button
                  onClick={onConnectAccounting}
                  disabled={accountingConnecting}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.8125rem', color: GREEN, fontWeight: 600, cursor: accountingConnecting ? 'default' : 'pointer' }}
                >
                  {accountingConnecting ? 'Reconnecting…' : 'Reconnect'}
                </button>
              ) : accountingConnectUrl && (
                <a href={accountingConnectUrl} style={{ fontSize: '0.8125rem', color: GREEN, fontWeight: 600, textDecoration: 'none' }}>
                  Reconnect
                </a>
              )}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.875rem', color: GRAY, marginBottom: 12, lineHeight: 1.5 }}>
                Connect an accounting system to automatically create invoices after each sale.
              </p>
              {onConnectAccounting ? (
                <>
                  <button
                    onClick={onConnectAccounting}
                    disabled={accountingConnecting}
                    style={{ width: '100%', padding: '13px 20px', background: accountingConnecting ? '#e5e7eb' : GREEN, color: accountingConnecting ? GRAY : '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none', cursor: accountingConnecting ? 'default' : 'pointer' }}
                  >
                    {accountingConnecting ? 'Opening QuickBooks…' : 'Connect QuickBooks'}
                  </button>
                  {accountingError && (
                    <p style={{ fontSize: '0.8125rem', color: RED, marginTop: 10 }}>Error: {accountingError}</p>
                  )}
                </>
              ) : accountingConnectUrl ? (
                <a href={accountingConnectUrl} style={{ display: 'block', textAlign: 'center', padding: '13px 20px', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, textDecoration: 'none' }}>
                  Connect QuickBooks
                </a>
              ) : (
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Accounting connection available from the dashboard.</p>
              )}
            </div>
          )}
        </SectionCard>
        )}

        {/* ── Services ── (full page OR the isolated /settings/services destination — the offerings
            editor is now a discoverable nav destination, no longer orphaned at /settings/all). */}
        {(full || section === 'services') && (
        <SectionCard title="Services">
          <p style={{ fontSize: '0.8125rem', color: GRAY, marginBottom: 14, lineHeight: 1.5 }}>
            Everything you offer at checkout — transport options, add-ons, and future recurring services. Toggle off to hide from customers without deleting.
          </p>

          {offeringsLoading ? (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading…</p>
          ) : (
            <>
              {/* Transport group */}
              {transportOfferings.length > 0 && (
                <OfferingGroup
                  label="Transport"
                  offerings={transportOfferings}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  editErrors={editErrors}
                  savingOffering={savingOffering}
                  onToggle={toggleOffering}
                  onEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={null}
                  onFindCustomers={null}
                />
              )}

              {/* Add-on group */}
              {addonOfferings.length > 0 && (
                <OfferingGroup
                  label="Add-ons"
                  offerings={addonOfferings}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  editErrors={editErrors}
                  savingOffering={savingOffering}
                  onToggle={toggleOffering}
                  onEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={deleteOffering}
                  onFindCustomers={findCustomers}
                />
              )}

              {/* Other (maintenance, inspection, subscription) */}
              {otherOfferings.length > 0 && (
                <OfferingGroup
                  label="Other Services"
                  offerings={otherOfferings}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  editErrors={editErrors}
                  savingOffering={savingOffering}
                  onToggle={toggleOffering}
                  onEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={deleteOffering}
                  onFindCustomers={findCustomers}
                />
              )}

              {/* Add new */}
              {showAddForm ? (
                <div style={{ marginTop: 8, padding: '14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '0.875rem', color: DARK }}>New service</p>

                  <div style={{ display: 'flex', gap: 8, marginBottom: (addErrors.name || addErrors.price) ? 2 : 8 }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Monthly Fertilizer)" style={{ ...inputStyle, flex: 2, marginBottom: 0, ...errBorder(!!addErrors.name) }} />
                    <input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Price (0 = free)" type="number" step="0.01" style={{ ...inputStyle, flex: 1, marginBottom: 0, ...errBorder(!!addErrors.price) }} />
                  </div>
                  <FieldError msg={addErrors.name} />
                  <FieldError msg={addErrors.price} />
                  {(addErrors.name || addErrors.price) && <div style={{ height: 8 }} />}

                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ ...inputStyle, marginBottom: 8 }} />

                  {/* Category (full schema set, incl. Transport) + timing */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <FieldLabel text="Category">
                      <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                        {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </FieldLabel>
                    <FieldLabel text="Timing">
                      <select value={newTiming} onChange={e => setNewTiming(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                        {TIMING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </FieldLabel>
                  </div>
                  <FieldError msg={addErrors.category} />

                  {/* Price rule — price_type (how) and price_unit (what one unit is) are SEPARATE */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <FieldLabel text="Price type">
                      <select value={newPriceType} onChange={e => setNewPriceType(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                        {PRICE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </FieldLabel>
                    <FieldLabel text="Per unit">
                      <select value={newPriceUnit} onChange={e => setNewPriceUnit(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                        {PRICE_UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </FieldLabel>
                  </div>

                  {/* Transport-only rules: who transports + whether an address is needed */}
                  {newCategory === 'transport' && (
                    <div style={{ marginBottom: 8, padding: '10px 12px', background: '#fff', borderRadius: 9, border: '1px solid #e5e7eb' }}>
                      <FieldLabel text="Transport mode">
                        <select value={newTransportMode} onChange={e => setNewTransportMode(e.target.value)} style={{ ...inputStyle, marginBottom: 0, ...errBorder(!!addErrors.transportMode) }}>
                          {TRANSPORT_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <FieldError msg={addErrors.transportMode} />
                      </FieldLabel>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.8125rem', color: DARK, cursor: 'pointer' }}>
                        <input type="checkbox" checked={newRequiresAddress} onChange={e => setNewRequiresAddress(e.target.checked)} />
                        Requires a destination address (delivery / install)
                      </label>
                    </div>
                  )}

                  {/* Add-on-only rule: gate this add-on to a transport mode ('' = always show) */}
                  {newCategory === 'addon' && (
                    <div style={{ marginBottom: 8 }}>
                      <FieldLabel text="Show only when transport is">
                        <select value={newTriggerMode} onChange={e => setNewTriggerMode(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                          <option value="">Always show</option>
                          {TRANSPORT_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </FieldLabel>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={addOffering}
                      disabled={addingOffering}
                      style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.875rem', opacity: addingOffering ? 0.5 : 1 }}
                    >
                      {addingOffering ? 'Adding…' : 'Add Service'}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setAddErrors({}); setNewName(''); setNewDesc(''); setNewPrice(''); }}
                      style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: GRAY, fontWeight: 600, fontSize: '0.875rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{ marginTop: 8, width: '100%', padding: '11px', borderRadius: 9, border: `1.5px dashed #d1d5db`, cursor: 'pointer', background: 'transparent', color: GREEN, fontWeight: 700, fontSize: '0.875rem' }}
                >
                  + Add service
                </button>
              )}
            </>
          )}
        </SectionCard>
        )}

        {/* ── Find Customers (AI match results) ── (full page OR the Services destination — the
            "Find customers" action lives inside the Services card, so its panel must render there too) */}
        {(full || section === 'services') && matchOfferingId && (
          <SectionCard title={`Expand — ${matchOfferingName}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: '0.8125rem', color: GRAY, margin: 0, lineHeight: 1.5 }}>
                Customers from your order history who are the best candidates for this service.
              </p>
              <button
                onClick={() => { setMatchOfferingId(null); setMatchResults([]); setMatchError(''); }}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {matchLoading && (
              <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                Finding the best candidates…
              </p>
            )}

            {matchError && (
              <p style={{ fontSize: '0.875rem', color: RED }}>{matchError}</p>
            )}

            {!matchLoading && !matchError && matchResults.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>
                No customers found yet — place a few orders first.
              </p>
            )}

            {!matchLoading && matchResults.map((m, idx) => (
              <div key={m.customerId} style={{
                background: '#f9fafb', borderRadius: 10, padding: '12px 14px',
                border: '1px solid #e5e7eb', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: DARK }}>
                    {m.customerName}
                  </p>
                  <span style={{
                    background: m.fitScore >= 8 ? '#dcfce7' : m.fitScore >= 6 ? '#fef9c3' : '#f3f4f6',
                    color:      m.fitScore >= 8 ? '#166534' : m.fitScore >= 6 ? '#854d0e' : GRAY,
                    fontWeight: 700, fontSize: '0.75rem', borderRadius: 20, padding: '2px 10px',
                  }}>
                    {m.fitScore}/10
                  </span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5 }}>
                  {m.fitReason}
                </p>
                <div style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #e5e7eb', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: DARK, lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{m.suggestedMessage}"
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => copyMessage(m.suggestedMessage, idx)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', cursor: 'pointer', background: copiedIdx === idx ? '#f0fdf4' : '#fff', color: copiedIdx === idx ? '#166534' : DARK, fontWeight: 600, fontSize: '0.75rem' }}
                  >
                    {copiedIdx === idx ? 'Copied' : 'Copy'}
                  </button>
                  {m.phone && (
                    <a
                      href={`sms:${m.phone}?body=${encodeURIComponent(m.suggestedMessage)}`}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: GREEN, color: '#fff', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none', textAlign: 'center' }}
                    >
                      Text
                    </a>
                  )}
                  {m.email && !m.phone && (
                    <a
                      href={`mailto:${m.email}?subject=A service we think you'll love&body=${encodeURIComponent(m.suggestedMessage)}`}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: GREEN, color: '#fff', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none', textAlign: 'center' }}
                    >
                      Email
                    </a>
                  )}
                </div>
              </div>
            ))}
          </SectionCard>
        )}

        {/* ── Vertical-specific section ── (full page only) */}
        {full && verticalSection}

        {/* On a section-isolated view, a quiet link to the rest so nothing is orphaned (RULE 2a;
            the leftover sections — Services + vertical — still live on the full /settings page). */}
        {!full && onMoreSettings && (
          <button
            type="button"
            onClick={onMoreSettings}
            style={{
              background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
              color: GREEN, fontWeight: 600, fontSize: '0.8125rem', textAlign: 'left',
            }}
          >
            More business settings →
          </button>
        )}

      </div>
    </div>
  );
}

// ── OfferingGroup sub-component ───────────────────────────────────────────────

interface OfferingGroupProps {
  label: string;
  offerings: ServiceOffering[];
  editingId: string | null;
  editForm: EditForm;
  setEditForm: (f: EditForm) => void;
  editErrors: Record<string, string>;
  savingOffering: boolean;
  onToggle: (id: string, current: boolean) => void;
  onEdit: (o: ServiceOffering) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: ((id: string) => void) | null;
  onFindCustomers: ((o: ServiceOffering) => void) | null;
}

function OfferingGroup({
  label, offerings, editingId, editForm, setEditForm, editErrors, savingOffering,
  onToggle, onEdit, onSaveEdit, onCancelEdit, onDelete, onFindCustomers,
}: OfferingGroupProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {offerings.map(o => (
          <div key={o.id} style={{ background: o.is_active ? '#f9fafb' : '#f3f4f6', borderRadius: 10, padding: '10px 12px', opacity: o.is_active ? 1 : 0.6, border: '1px solid #e5e7eb' }}>

            {editingId === o.id ? (
              /* Edit mode */
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: (editErrors.name || editErrors.price) ? 2 : 6 }}>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ ...inputStyle, flex: 2, marginBottom: 0, padding: '8px 10px', ...errBorder(!!editErrors.name) }}
                    placeholder="Name"
                  />
                  <input
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0, padding: '8px 10px', ...errBorder(!!editErrors.price) }}
                    type="number" step="0.01" placeholder="Price (0 = free)"
                  />
                </div>
                <FieldError msg={editErrors.name} />
                <FieldError msg={editErrors.price} />
                {(editErrors.name || editErrors.price) && <div style={{ height: 6 }} />}
                <input
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 6, padding: '8px 10px' }}
                  placeholder="Description (optional)"
                />

                {/* Attach-rule (editable) — category can be CHANGED (move between groups), and
                    price_type / price_unit are two separate controls, no longer conflated. */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <FieldLabel text="Category">
                    <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px', ...errBorder(!!editErrors.category) }}>
                      {CATEGORY_OPTIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    <FieldError msg={editErrors.category} />
                  </FieldLabel>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <FieldLabel text="Price type">
                    <select value={editForm.price_type} onChange={e => setEditForm({ ...editForm, price_type: e.target.value })} style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px' }}>
                      {PRICE_TYPE_OPTIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </FieldLabel>
                  <FieldLabel text="Per unit">
                    <select value={editForm.price_unit} onChange={e => setEditForm({ ...editForm, price_unit: e.target.value })} style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px' }}>
                      {PRICE_UNIT_OPTIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </FieldLabel>
                </div>

                {/* Transport-only rules */}
                {editForm.category === 'transport' && (
                  <div style={{ marginBottom: 6, padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <FieldLabel text="Transport mode">
                      <select value={editForm.transport_mode} onChange={e => setEditForm({ ...editForm, transport_mode: e.target.value })} style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px', ...errBorder(!!editErrors.transportMode) }}>
                        {TRANSPORT_MODE_OPTIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      <FieldError msg={editErrors.transportMode} />
                    </FieldLabel>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.8125rem', color: DARK, cursor: 'pointer' }}>
                      <input type="checkbox" checked={editForm.requires_address} onChange={e => setEditForm({ ...editForm, requires_address: e.target.checked })} />
                      Requires a destination address (delivery / install)
                    </label>
                  </div>
                )}

                {/* Add-on-only rule: gate this add-on to a transport mode ('' = always show) */}
                {editForm.category === 'addon' && (
                  <div style={{ marginBottom: 6 }}>
                    <FieldLabel text="Show only when transport is">
                      <select value={editForm.trigger_transport_mode} onChange={e => setEditForm({ ...editForm, trigger_transport_mode: e.target.value })} style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px' }}>
                        <option value="">Always show</option>
                        {TRANSPORT_MODE_OPTIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                    </FieldLabel>
                  </div>
                )}

                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 4px' }}>
                  Compliance notice (optional)
                </p>
                <input
                  value={editForm.compliance_title}
                  onChange={e => setEditForm({ ...editForm, compliance_title: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 6, padding: '8px 10px' }}
                  placeholder="Title (e.g. Texas law requires securing your load)"
                />
                <textarea
                  value={editForm.compliance_body}
                  onChange={e => setEditForm({ ...editForm, compliance_body: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 6, padding: '8px 10px', resize: 'vertical', minHeight: 72 }}
                  placeholder="Full legal notice text shown to customer at checkout"
                />
                <input
                  value={editForm.service_note}
                  onChange={e => setEditForm({ ...editForm, service_note: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 8, padding: '8px 10px' }}
                  placeholder="Staff note (e.g. Applied by staff before you leave)"
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={onSaveEdit} disabled={savingOffering} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.8125rem' }}>
                    {savingOffering ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={onCancelEdit} style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: GRAY, fontWeight: 600, fontSize: '0.8125rem' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: DARK }}>{o.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: GRAY }}>
                      {o.price === 0 ? 'No charge' : o.price_type === 'per_unit' ? `$${Number(o.price).toFixed(2)}/${o.price_unit}` : `$${Number(o.price).toFixed(2)} flat`}
                      {' · '}{TIMING_LABEL[o.timing] ?? o.timing}
                      {o.trigger_transport_mode ? ` · when ${o.trigger_transport_mode}-transport` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => onToggle(o.id, o.is_active)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: o.is_active ? '#f0fdf4' : '#f3f4f6', color: o.is_active ? '#166534' : GRAY }}
                    >
                      {o.is_active ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => onEdit(o)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: DARK }}
                    >
                      Edit
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(o.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: '#fef2f2', color: RED }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {onFindCustomers && o.is_active && (
                  <button
                    onClick={() => onFindCustomers(o)}
                    style={{ marginTop: 8, width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid #d1fae5', cursor: 'pointer', background: '#f0fdf4', color: '#166534', fontWeight: 600, fontSize: '0.75rem', textAlign: 'left' }}
                  >
                    ✦ Find customers who might want this
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
