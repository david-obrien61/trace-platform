import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext, type Business } from '../context/BusinessProvider';

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px',
  border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: '0.9375rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <p style={{
        fontSize: '0.6875rem', fontWeight: 700, color: GRAY,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
      }}>
        {title}
      </p>
      {children}
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

interface OpportunityItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  sort_order: number;
}

interface SettingsProps {
  onBack: () => void;
  verticalSection?: React.ReactNode;
  accountingConnectUrl?: string;
}

export function Settings({ onBack, verticalSection, accountingConnectUrl }: SettingsProps) {
  const { business, businessId, reload } = useBusinessContext();

  const [form, setForm] = useState({
    name: '', phone: '', address: '', email: '', website: '', tax_rate: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    if (!business) return;
    setForm({
      name:     business.name,
      phone:    business.phone ?? '',
      address:  business.address ?? '',
      email:    business.email ?? '',
      website:  business.website ?? '',
      tax_rate: String(business.tax_rate),
    });
  }, [business]);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('opportunity_items')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as OpportunityItem[]);
        setItemsLoading(false);
      });
  }, [businessId]);

  async function saveProfile() {
    if (!businessId) return;
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('businesses').update({
      name:     form.name.trim(),
      phone:    form.phone.trim() || null,
      address:  form.address.trim() || null,
      email:    form.email.trim() || null,
      website:  form.website.trim() || null,
      tax_rate: parseFloat(form.tax_rate) || 0.0825,
    }).eq('id', businessId);

    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Saved');
      reload();
      setTimeout(() => setSaveMsg(''), 2000);
    }
    setSaving(false);
  }

  async function addItem() {
    if (!businessId || !newItemName.trim() || !newItemPrice) return;
    setAddingItem(true);
    const price = parseFloat(newItemPrice);
    if (isNaN(price)) { setAddingItem(false); return; }
    const { data, error } = await supabase.from('opportunity_items').insert({
      business_id: businessId,
      name: newItemName.trim(),
      price,
      sort_order: items.length,
    }).select('*').single();
    if (!error && data) {
      setItems(prev => [...prev, data as OpportunityItem]);
      setNewItemName('');
      setNewItemPrice('');
    }
    setAddingItem(false);
  }

  async function toggleItem(id: string, current: boolean) {
    await supabase.from('opportunity_items').update({ is_active: !current }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i));
  }

  async function deleteItem(id: string) {
    await supabase.from('opportunity_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const accountingType = business?.accounting_type;
  const accountingConnected = !!business?.accounting_company_id;

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Back
        </button>
        <div>
          <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
            {business?.name}
          </p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Settings</h1>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Business Profile ── */}
        <SectionCard title="Business Profile">
          <Field label="Business name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="LAWNS Tree Farm, LLC" />
          <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="(512) 555-0100" type="tel" />
          <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="400 Honeycomb Mesa, Leander TX" />
          <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="info@yourbusiness.com" type="email" />
          <Field label="Website" value={form.website} onChange={v => setForm(f => ({ ...f, website: v }))} placeholder="https://yourbusiness.com" />
          <Field label="Tax rate (decimal, e.g. 0.0825 for 8.25%)" value={form.tax_rate} onChange={v => setForm(f => ({ ...f, tax_rate: v }))} placeholder="0.0825" />

          <button
            onClick={saveProfile}
            disabled={saving}
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
            <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? '#A32D2D' : GREEN, marginTop: 8, textAlign: 'center' }}>
              {saveMsg}
            </p>
          )}
        </SectionCard>

        {/* ── Accounting ── */}
        <SectionCard title="Accounting">
          {accountingConnected ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', background: GREEN,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                }}>✓</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534', margin: 0 }}>
                    {accountingType === 'quickbooks' ? 'QuickBooks' : accountingType ?? 'Accounting'} connected
                  </p>
                  {business?.accounting_needs_reconnect && (
                    <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '2px 0 0' }}>⚠ Reconnection needed</p>
                  )}
                </div>
              </div>
              {accountingConnectUrl && (
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
              {accountingConnectUrl ? (
                <a
                  href={accountingConnectUrl}
                  style={{
                    display: 'block', textAlign: 'center', padding: '13px 20px',
                    background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
                    borderRadius: 10, textDecoration: 'none',
                  }}
                >
                  Connect QuickBooks
                </a>
              ) : (
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                  Accounting connection available from the dashboard.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Sales Prompts (opportunity_items) ── */}
        <SectionCard title="Sales Prompts">
          <p style={{ fontSize: '0.8125rem', color: GRAY, marginBottom: 14, lineHeight: 1.5 }}>
            Add items that your staff should offer at checkout. These appear as upsell prompts during every sale.
          </p>

          {itemsLoading ? (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {items.map(item => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#f9fafb', borderRadius: 9, padding: '10px 12px',
                  opacity: item.is_active ? 1 : 0.5,
                }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: DARK }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: GRAY }}>${Number(item.price).toFixed(2)}/unit</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => toggleItem(item.id, item.is_active)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: item.is_active ? '#f0fdf4' : '#f3f4f6',
                        color: item.is_active ? '#166534' : GRAY,
                      }}
                    >
                      {item.is_active ? 'Active' : 'Off'}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      style={{ padding: '5px 10px', borderRadius: 6, fontSize: '0.75rem', border: 'none', cursor: 'pointer', background: '#fef2f2', color: '#A32D2D', fontWeight: 600 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new item */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="Item name (e.g. Netting)"
              style={{ ...inputStyle, flex: 2, marginBottom: 0 }}
            />
            <input
              value={newItemPrice}
              onChange={e => setNewItemPrice(e.target.value)}
              placeholder="Price"
              type="number"
              style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
            />
            <button
              onClick={addItem}
              disabled={addingItem || !newItemName.trim() || !newItemPrice}
              style={{
                padding: '11px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
                opacity: (addingItem || !newItemName.trim() || !newItemPrice) ? 0.5 : 1,
              }}
            >
              Add
            </button>
          </div>
        </SectionCard>

        {/* ── Vertical-specific section (injected by the consuming vertical) ── */}
        {verticalSection}

      </div>
    </div>
  );
}
