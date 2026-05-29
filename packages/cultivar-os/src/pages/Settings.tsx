import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SharedSettings } from '@trace/shared/pages/Settings';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '../lib/supabase';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const DARK  = '#111827';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px',
  border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: '0.9375rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

function NurserySection({ businessId }: { businessId: string }) {
  const [installPrice, setInstallPrice] = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  useEffect(() => {
    supabase
      .from('nursery_profiles')
      .select('default_install_price')
      .eq('business_id', businessId)
      .single()
      .then(({ data }) => {
        if (data?.default_install_price != null) {
          setInstallPrice(String(data.default_install_price));
        }
      });
  }, [businessId]);

  async function save() {
    setSaving(true);
    setSaveMsg('');
    const price = parseFloat(installPrice);
    const { error } = await supabase
      .from('nursery_profiles')
      .upsert(
        { business_id: businessId, default_install_price: isNaN(price) ? null : price },
        { onConflict: 'business_id' },
      );
    if (error) {
      setSaveMsg('Error: ' + error.message);
    } else {
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    }
    setSaving(false);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb' }}>
      <p style={{
        fontSize: '0.6875rem', fontWeight: 700, color: GRAY,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
      }}>
        Nursery Settings
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Default install price (per plant)
        </label>
        <input
          type="number"
          value={installPrice}
          onChange={e => setInstallPrice(e.target.value)}
          placeholder="225.00"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = GREEN)}
          onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
        />
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
          Used when staff selects "Install" at checkout. Override per plant on the plant profile.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          width: '100%', padding: '13px 20px',
          background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff',
          fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
          cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save Nursery Settings'}
      </button>
      {saveMsg && (
        <p style={{ fontSize: '0.875rem', color: saveMsg.startsWith('Error') ? '#A32D2D' : GREEN, marginTop: 8, textAlign: 'center' }}>
          {saveMsg}
        </p>
      )}
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const accountingConnectUrl = businessId
    ? `/api/qbo/auth-url?business_id=${businessId}`
    : undefined;

  return (
    <SharedSettings
      onBack={() => navigate('/dashboard')}
      accountingConnectUrl={accountingConnectUrl}
      verticalSection={businessId ? <NurserySection businessId={businessId} /> : undefined}
    />
  );
}
