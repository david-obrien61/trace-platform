import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '../lib/supabase';
import type { CustomerInput } from '../types/customer';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — on until OWNER-PROVEN

// Today's date as an ISO 'YYYY-MM-DD' (local), the min for the delivery-date picker.
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  fontSize: '1rem',
  color: '#1f2937',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

function Field({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#A32D2D', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: '0.8125rem', color: '#A32D2D', marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}

export function CustomerCapture() {
  const navigate = useNavigate();
  const {
    setCustomer, customer: saved, items, selectedTransport,
    deliveryDate: savedDeliveryDate, setDeliveryDate,
  } = useCart();
  const { isOwner, role, business, businessId } = useBusinessContext();
  const firstItem = items[0] ?? null;

  const [firstName, setFirstName] = useState(saved?.first_name ?? '');
  const [lastName,  setLastName]  = useState(saved?.last_name ?? '');
  const [email,     setEmail]     = useState(saved?.email ?? '');
  const [phone,     setPhone]     = useState(saved?.phone ?? '');
  const [address,   setAddress]   = useState(saved?.address_line1 ?? '');
  const [city,      setCity]      = useState(saved?.city ?? '');
  const [state,     setState]     = useState(saved?.state ?? 'TX');
  const [zip,       setZip]       = useState(saved?.zip ?? '');
  const [optIn,     setOptIn]     = useState(saved?.marketing_opt_in ?? true);
  const [delivDate, setDelivDate] = useState(savedDeliveryDate ?? '');
  const [touched,   setTouched]   = useState(false);

  // FIX 3 — a delivery order needs a ship-to. Read the requirement FROM the chosen transport
  // service (requires_address, owner-set) or its shape (a staff/delivery branch), never hardcoded.
  const deliveryRequired = !!selectedTransport
    && (selectedTransport.requires_address || selectedTransport.transport_mode === 'staff');
  // FIX 4 — the delivery date is entered by owner/manager (the manual precursor to customer
  // self-scheduling). Shown only when a delivery branch is selected.
  const canSetDeliveryDate = isOwner || role === 'MANAGER';
  const showDeliveryDate   = deliveryRequired && canSetDeliveryDate;

  const phoneValid   = phone.replace(/\D/g, '').length === 10;

  const emailError   = touched && !email.trim() ? 'Email is required'
                     : touched && !isValidEmail(email) ? 'Enter a valid email address'
                     : '';
  const firstError   = touched && !firstName.trim() ? 'First name is required' : '';
  const lastError    = touched && !lastName.trim() ? 'Last name is required' : '';
  const addressError = touched && deliveryRequired && !address.trim() ? 'A delivery address is required' : '';
  const phoneError   = touched && deliveryRequired && !phoneValid ? 'A phone number is required for delivery' : '';
  const hasErrors    = !firstName.trim() || !lastName.trim() || !isValidEmail(email)
                     || (deliveryRequired && (!address.trim() || !phoneValid));

  async function handleSubmit() {
    setTouched(true);
    if (hasErrors) {
      if (TRACE_DELIVERY && deliveryRequired) {
        console.log('[TRACE:DELIVERY] delivery order — required fields enforced (submit blocked)', {
          transport: selectedTransport?.name, requiresAddress: selectedTransport?.requires_address,
          hasAddress: !!address.trim(), phoneValid,
        });
      }
      return;
    }

    const emailLower = email.trim().toLowerCase();

    // D-39: resolve the customer's STORED pricing tier the way submit does (authoritative
    // identity→tier), so the Review preview shows the SAME discount that will be charged — closing
    // the "customer entered here → Review shows no discount" gap. Prefer the tier already carried by
    // an attached customer (ScanOrder) when the email is unchanged; otherwise look it up by email
    // (business-scoped, mirrors submit's dedup). On the anon QR path (no customer read) this yields
    // no tier → retail; submit remains the final, tamper-defended authority for the charge.
    let priceTier: string | null =
      (saved?.email && saved.email.toLowerCase() === emailLower) ? (saved.price_tier ?? null) : null;
    try {
      if (businessId && emailLower) {
        const { data } = await supabase
          .from('customers')
          .select('price_tier')
          .eq('business_id', businessId)
          .eq('email', emailLower)
          .limit(1)
          .maybeSingle();
        if (data?.price_tier != null) priceTier = data.price_tier as string;
      }
    } catch {
      console.log('[TRACE:PRICE] CustomerCapture tier lookup skipped (no customer read / anon path)', { email: emailLower });
    }

    const c: CustomerInput = {
      first_name:      firstName.trim(),
      last_name:       lastName.trim(),
      email:           emailLower,
      phone:           phone.replace(/\D/g, '').length === 10 ? phone : undefined,
      address_line1:   address.trim() || undefined,
      city:            city.trim() || undefined,
      state:           state.trim() || 'TX',
      zip:             zip.trim() || undefined,
      marketing_opt_in: optIn,
      price_tier:      priceTier,
    };

    console.log('[TRACE:PRICE] customer finalized — stored tier resolved for Review preview', { email: emailLower, priceTier });
    setCustomer(c);
    setDeliveryDate(showDeliveryDate ? (delivDate || null) : null);
    navigate('/checkout/review');
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        {firstItem && (
          <button
            onClick={() => navigate(items.length === 1 ? `/plant/${firstItem.plant.tag_id}/addons` : '/checkout/addons')}
            style={{
              background: 'none',
              border: 'none',
              color: '#27500A',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Back
          </button>
        )}
      </div>
      <div style={{ padding: '12px 16px 4px' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.3 }}>
          Almost done — who are we sending this to?
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#6b7280', marginTop: 6 }}>
          Your invoice will be ready before you leave.
        </p>
      </div>

      {/* Form */}
      <div style={{ padding: '20px 16px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <div>
            <Field label="First name" required error={firstError}>
              <input
                style={{ ...inputStyle, borderColor: firstError ? '#A32D2D' : '#e5e7eb' }}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                autoComplete="given-name"
              />
            </Field>
          </div>
          <div>
            <Field label="Last name" required error={lastError}>
              <input
                style={{ ...inputStyle, borderColor: lastError ? '#A32D2D' : '#e5e7eb' }}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                autoComplete="family-name"
              />
            </Field>
          </div>
        </div>

        <Field label="Email address" required error={emailError}>
          <input
            style={{ ...inputStyle, borderColor: emailError ? '#A32D2D' : '#e5e7eb' }}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@email.com"
            autoComplete="email"
          />
        </Field>

        <Field label={deliveryRequired ? 'Phone' : 'Phone (optional)'} required={deliveryRequired} error={phoneError}>
          <input
            style={{ ...inputStyle, borderColor: phoneError ? '#A32D2D' : '#e5e7eb' }}
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(512) 555-0100"
            autoComplete="tel"
          />
        </Field>

        <Field label={deliveryRequired ? 'Delivery address' : 'Address (optional)'} required={deliveryRequired} error={addressError}>
          <input
            style={{ ...inputStyle, borderColor: addressError ? '#A32D2D' : '#e5e7eb' }}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Oak Creek Dr"
            autoComplete="street-address"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 10px' }}>
          <Field label="City">
            <input
              style={inputStyle}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              autoComplete="address-level2"
            />
          </Field>
          <Field label="State">
            <input
              style={inputStyle}
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="TX"
              autoComplete="address-level1"
            />
          </Field>
          <Field label="Zip">
            <input
              style={inputStyle}
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="ZIP"
              autoComplete="postal-code"
            />
          </Field>
        </div>

        {/* FIX 4 — delivery date (owner/manager, delivery order only). Manual precursor to the
            customer-facing scheduling calendar (flow spec §2). Optional at entry. */}
        {showDeliveryDate && (
          <Field label="Delivery date">
            <input
              style={inputStyle}
              type="date"
              min={todayISO()}
              value={delivDate}
              onChange={(e) => setDelivDate(e.target.value)}
            />
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
              When is this going out? You set the date now; customer self-scheduling comes later.
            </p>
          </Field>
        )}

        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', lineHeight: 1.5, marginBottom: 20 }}>
          We'll email your invoice here. No payment is taken now — pay in person at the office, or online from the invoice we send.
        </p>

        {/* Marketing opt-in */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: '#27500A', flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>
            Send me seasonal planting tips and special offers{business?.name ? ` from ${business.name}` : ''}
          </span>
        </label>
      </div>

      {/* Submit */}
      <div className="section">
        <button
          className="btn btn-primary"
          style={{ minHeight: 56 }}
          onClick={() => { void handleSubmit(); }}
        >
          Review my order
        </button>
      </div>
    </div>
  );
}
