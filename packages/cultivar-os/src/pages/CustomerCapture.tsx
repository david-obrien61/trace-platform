import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import type { CustomerInput } from '../types/customer';

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
  const { setCustomer, customer: saved, item } = useCart();

  const [firstName, setFirstName] = useState(saved?.first_name ?? '');
  const [lastName,  setLastName]  = useState(saved?.last_name ?? '');
  const [email,     setEmail]     = useState(saved?.email ?? '');
  const [phone,     setPhone]     = useState(saved?.phone ?? '');
  const [address,   setAddress]   = useState(saved?.address_line1 ?? '');
  const [city,      setCity]      = useState(saved?.city ?? '');
  const [state,     setState]     = useState(saved?.state ?? 'TX');
  const [zip,       setZip]       = useState(saved?.zip ?? '');
  const [optIn,     setOptIn]     = useState(saved?.marketing_opt_in ?? true);
  const [touched,   setTouched]   = useState(false);

  const emailError   = touched && !email.trim() ? 'Email is required'
                     : touched && !isValidEmail(email) ? 'Enter a valid email address'
                     : '';
  const firstError   = touched && !firstName.trim() ? 'First name is required' : '';
  const lastError    = touched && !lastName.trim() ? 'Last name is required' : '';
  const hasErrors    = !firstName.trim() || !lastName.trim() || !isValidEmail(email);

  function handleSubmit() {
    setTouched(true);
    if (hasErrors) return;

    const c: CustomerInput = {
      first_name:      firstName.trim(),
      last_name:       lastName.trim(),
      email:           email.trim().toLowerCase(),
      phone:           phone.replace(/\D/g, '').length === 10 ? phone : undefined,
      address_line1:   address.trim() || undefined,
      city:            city.trim() || undefined,
      state:           state.trim() || 'TX',
      zip:             zip.trim() || undefined,
      marketing_opt_in: optIn,
    };

    setCustomer(c);
    navigate('/checkout/review');
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        {item && (
          <button
            onClick={() => navigate(`/plant/${item.plant.tag_id}/addons`)}
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

        <Field label="Phone (optional)">
          <input
            style={inputStyle}
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(512) 555-0100"
            autoComplete="tel"
          />
        </Field>

        <Field label="Address (optional)">
          <input
            style={inputStyle}
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
              placeholder="Leander"
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
              placeholder="78641"
              autoComplete="postal-code"
            />
          </Field>
        </div>

        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', lineHeight: 1.5, marginBottom: 20 }}>
          We'll send your invoice here. You can pay now or when you get home.
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
            Send me seasonal planting tips and special offers from LAWNS Tree Farm
          </span>
        </label>
      </div>

      {/* Submit */}
      <div className="section">
        <button
          className="btn btn-primary"
          style={{ minHeight: 56 }}
          onClick={handleSubmit}
        >
          Review my order
        </button>
      </div>
    </div>
  );
}
