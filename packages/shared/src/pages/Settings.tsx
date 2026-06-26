import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext } from '../context/BusinessProvider';
import { normalizePhone } from '../utils/normalizePhone';

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

// Collapsible card. Each card owns its OWN open state (RULE 2b, ledger #50): toggling one NEVER
// closes another — no shared accordion, multiple open at once, owner may expand everything. Default
// open, so the initial appearance is unchanged for every existing caller.
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
        <span style={{ color: '#9ca3af', fontSize: '0.7rem', flexShrink: 0 }} aria-hidden="true">{open ? '▾' : '▸'}</span>
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

const CATEGORY_LABEL: Record<string, string> = {
  transport:    'Transport',
  addon:        'Add-on',
  maintenance:  'Maintenance',
  inspection:   'Inspection',
  subscription: 'Subscription',
};

const TIMING_LABEL: Record<string, string> = {
  at_checkout:   'At checkout',
  post_purchase: 'After sale',
  recurring:     'Recurring',
};

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
  // ledger #50) — Business Profile or Accounting reached straight from the menu, no long scroll.
  // Undefined (default) → render the full page (UNCHANGED for every existing caller, incl. Ignition).
  section?: 'business' | 'accounting';
  // Footer link to the full settings page (the leftover sections — Services / vertical). Shown
  // ONLY on a section-isolated view, so nothing on the full page is orphaned.
  onMoreSettings?: () => void;
}

export function Settings({
  onBack, verticalSection, accountingConnectUrl,
  onConnectAccounting, accountingConnecting, accountingError,
  section, onMoreSettings,
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
  const [editForm, setEditForm]           = useState({ name: '', description: '', price: '', compliance_title: '', compliance_body: '', service_note: '' });
  const [savingOffering, setSavingOffering] = useState(false);

  // Add-new form
  const [showAddForm, setShowAddForm]     = useState(false);
  const [newName, setNewName]             = useState('');
  const [newDesc, setNewDesc]             = useState('');
  const [newPrice, setNewPrice]           = useState('');
  const [newCategory, setNewCategory]     = useState('addon');
  const [newTiming, setNewTiming]         = useState('at_checkout');
  const [newPriceType, setNewPriceType]   = useState('per_unit');
  const [addingOffering, setAddingOffering] = useState(false);

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
    await supabase.from('service_offerings').update({ is_active: !current }).eq('id', id);
    setOfferings(prev => prev.map(o => o.id === id ? { ...o, is_active: !current } : o));
  }

  function startEdit(o: ServiceOffering) {
    setEditingId(o.id);
    setEditForm({
      name:              o.name,
      description:       o.description       ?? '',
      price:             String(o.price),
      compliance_title:  (o as any).compliance_title  ?? '',
      compliance_body:   (o as any).compliance_body   ?? '',
      service_note:      (o as any).service_note      ?? '',
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSavingOffering(true);
    const price = parseFloat(editForm.price);
    if (isNaN(price)) { setSavingOffering(false); return; }
    await supabase.from('service_offerings').update({
      name:             editForm.name.trim(),
      description:      editForm.description.trim()      || null,
      price,
      compliance_title: editForm.compliance_title.trim() || null,
      compliance_body:  editForm.compliance_body.trim()  || null,
      service_note:     editForm.service_note.trim()     || null,
    }).eq('id', editingId);
    setOfferings(prev => prev.map(o =>
      o.id === editingId
        ? { ...o, name: editForm.name.trim(), description: editForm.description.trim() || null, price }
        : o
    ));
    setEditingId(null);
    setSavingOffering(false);
  }

  async function deleteOffering(id: string) {
    await supabase.from('service_offerings').delete().eq('id', id);
    setOfferings(prev => prev.filter(o => o.id !== id));
  }

  async function addOffering() {
    if (!businessId || !newName.trim() || !newPrice) return;
    setAddingOffering(true);
    const price = parseFloat(newPrice);
    if (isNaN(price)) { setAddingOffering(false); return; }
    const { data, error } = await supabase.from('service_offerings').insert({
      business_id:  businessId,
      name:         newName.trim(),
      description:  newDesc.trim() || null,
      category:     newCategory,
      timing:       newTiming,
      price_type:   newPriceType,
      price_unit:   newPriceType === 'per_unit' ? 'plant' : 'order',
      price,
      is_active:    true,
      pre_selected: false,
      sort_order:   offerings.length + 10,
    }).select('*').single();

    if (!error && data) {
      setOfferings(prev => [...prev, data as ServiceOffering]);
      setNewName(''); setNewDesc(''); setNewPrice('');
      setNewCategory('addon'); setNewTiming('at_checkout'); setNewPriceType('per_unit');
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
            {section === 'business' ? 'Business Profile' : section === 'accounting' ? 'Accounting' : 'Settings'}
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

        {/* ── Accounting ── (full page OR the isolated /settings/accounting destination) */}
        {(full || section === 'accounting') && (
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

        {/* ── Services ── (full page only; not a named direct destination this pass) */}
        {full && (
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

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Monthly Fertilizer)" style={{ ...inputStyle, flex: 2, marginBottom: 0 }} />
                    <input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Price" type="number" step="0.01" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                  </div>

                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ ...inputStyle, marginBottom: 8 }} />

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                      <option value="addon">Add-on</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inspection">Inspection</option>
                      <option value="subscription">Subscription</option>
                    </select>
                    <select value={newTiming} onChange={e => setNewTiming(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                      <option value="at_checkout">At checkout</option>
                      <option value="post_purchase">After sale</option>
                      <option value="recurring">Recurring</option>
                    </select>
                    <select value={newPriceType} onChange={e => setNewPriceType(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                      <option value="per_unit">Per unit</option>
                      <option value="flat">Flat fee</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={addOffering}
                      disabled={addingOffering || !newName.trim() || !newPrice}
                      style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.875rem', opacity: (addingOffering || !newName.trim() || !newPrice) ? 0.5 : 1 }}
                    >
                      {addingOffering ? 'Adding…' : 'Add Service'}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setNewName(''); setNewDesc(''); setNewPrice(''); }}
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

        {/* ── Find Customers (AI match results) ── */}
        {full && matchOfferingId && (
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
  editForm: { name: string; description: string; price: string; compliance_title: string; compliance_body: string; service_note: string };
  setEditForm: (f: { name: string; description: string; price: string; compliance_title: string; compliance_body: string; service_note: string }) => void;
  savingOffering: boolean;
  onToggle: (id: string, current: boolean) => void;
  onEdit: (o: ServiceOffering) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: ((id: string) => void) | null;
  onFindCustomers: ((o: ServiceOffering) => void) | null;
}

function OfferingGroup({
  label, offerings, editingId, editForm, setEditForm, savingOffering,
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ ...inputStyle, flex: 2, marginBottom: 0, padding: '8px 10px' }}
                    placeholder="Name"
                  />
                  <input
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0, padding: '8px 10px' }}
                    type="number" step="0.01" placeholder="Price"
                  />
                </div>
                <input
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 6, padding: '8px 10px' }}
                  placeholder="Description (optional)"
                />
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
