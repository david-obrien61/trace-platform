import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessContext } from '@trace/shared/context';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook',  label: 'Facebook' },
  { key: 'tiktok',   label: 'TikTok' },
  { key: 'twitter',  label: 'Twitter / X' },
] as const;

export function SocialSetup() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  // [SM-TRACE] Mount / unmount sentinel — reveals whether the component is ever fully mounted
  useEffect(() => {
    console.log('[SM-TRACE] SocialSetup MOUNTED — businessId:', businessId);
    return () => {
      console.log('[SM-TRACE] SocialSetup UNMOUNTED — if you see this without a button click, the redirect is coming from OUTSIDE SocialSetup');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [SM-TRACE] businessId change tracker — reveals late-resolving context
  useEffect(() => {
    console.log('[SM-TRACE] businessId updated →', businessId, '(null means BusinessProvider still loading or no business found)');
  }, [businessId]);

  const [platforms, setPlatforms] = useState<string[]>(['instagram']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function togglePlatform(key: string) {
    setPlatforms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (platforms.length === 0) {
      setError('Select at least one platform.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/social/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId!,
          platforms,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }

      console.log('[SM-TRACE] handleSave SUCCESS → navigating to /dashboard');
      navigate('/dashboard');
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ background: 'var(--sage-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        background: 'var(--green-primary)',
        padding: '20px 16px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => { console.log('[SM-TRACE] Back button clicked → navigating to /dashboard'); navigate('/dashboard'); }}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <div>
          <p style={{ fontSize: '0.6875rem', color: '#a8c890', marginBottom: 2, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
            Enable module
          </p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Social Media</h1>
        </div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* What this does */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--gray-800)', marginBottom: 8 }}>
            Auto-generate posts after every sale
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', lineHeight: 1.6, margin: 0 }}>
            After each order, TRACE generates 3 ready-to-publish social posts — an educational piece about the plant,
            a customer story, and a seasonal tip. You review and publish with one tap.
          </p>
        </div>

        {/* Platform selection */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
          <p style={{
            fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
          }}>
            Platforms
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLATFORMS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={platforms.includes(key)}
                  onChange={() => togglePlatform(key)}
                  style={{ width: 18, height: 18, accentColor: 'var(--green-primary)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--gray-800)' }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '0.875rem', color: 'var(--red-border)', padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Enable Social Media'}
        </button>

      </div>
    </div>
  );
}
