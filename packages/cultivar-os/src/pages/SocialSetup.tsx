import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessContext } from '@trace/shared/context';

const SM_DEBUG = false;

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram',   guidance: '3–5 posts/week + Stories. Weekday mornings tend to do well.' },
  { key: 'facebook',  label: 'Facebook',    guidance: '3–5/week. Organic reach is low in 2026 — best paired with occasional boosting.' },
  { key: 'tiktok',   label: 'TikTok',      guidance: '1–3/week for a small business. Short video format; text posts get less traction.' },
  { key: 'twitter',  label: 'Twitter / X',  guidance: 'High-frequency platform — probably not essential for most local businesses.' },
] as const;

type PlatformKey = typeof PLATFORMS[number]['key'];

const CADENCE_OPTIONS = [
  {
    key: 'weekly',
    label: 'Weekly',
    description: 'One good post, once a week — research says consistent‑and‑modest beats high‑volume.',
  },
  {
    key: 'few_times',
    label: 'A few times a week',
    description: '2–3 posts per week. Works well if you have active sales to talk about.',
  },
  {
    key: 'on_demand',
    label: "I'll decide each time",
    description: 'Generate whenever you\'re ready. No automatic cadence.',
  },
] as const;

type CadenceKey = typeof CADENCE_OPTIONS[number]['key'];

export function SocialSetup() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  useEffect(() => {
    if (SM_DEBUG) console.log('[SM-TRACE] SocialSetup MOUNTED — businessId:', businessId);
    return () => {
      if (SM_DEBUG) console.log('[SM-TRACE] SocialSetup UNMOUNTED');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (SM_DEBUG) console.log('[SM-TRACE] businessId updated →', businessId);
  }, [businessId]);

  const [platforms, setPlatforms] = useState<PlatformKey[]>(['instagram']);
  const [cadence, setCadence]     = useState<CadenceKey>('weekly');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  function togglePlatform(key: PlatformKey) {
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
        body: JSON.stringify({ business_id: businessId!, platforms, cadence }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }

      if (SM_DEBUG) console.log('[SM-TRACE] handleSave SUCCESS → /dashboard');
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
          onClick={() => {
            if (SM_DEBUG) console.log('[SM-TRACE] Back button clicked → /dashboard');
            navigate('/dashboard');
          }}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none', borderRadius: 8,
            padding: '6px 12px', color: '#fff',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <div>
          <p style={{ fontSize: '0.6875rem', color: '#a8c890', marginBottom: 2, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
            Social Media
          </p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Post Settings</h1>
        </div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* What this does — honest framing */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--gray-800)', marginBottom: 8 }}>
            Ready-to-post updates from your sales
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', lineHeight: 1.6, margin: 0 }}>
            TRACE writes social captions based on your real sales each week, formatted for each platform.
            You review and edit them to sound like you, then copy and post to your accounts.
          </p>
        </div>

        {/* Cadence */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            How often do you want to post?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CADENCE_OPTIONS.map(opt => (
              <label key={opt.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: '10px 12px', borderRadius: 8,
                border: `1.5px solid ${cadence === opt.key ? 'var(--green-primary)' : '#e5e7eb'}`,
                background: cadence === opt.key ? '#f0fdf4' : '#fff',
              }}>
                <input
                  type="radio"
                  name="cadence"
                  value={opt.key}
                  checked={cadence === opt.key}
                  onChange={() => setCadence(opt.key)}
                  style={{ marginTop: 2, accentColor: 'var(--green-primary)', cursor: 'pointer' }}
                />
                <div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-800)', margin: '0 0 2px' }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', margin: 0, lineHeight: 1.4 }}>
                    {opt.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Platform selection */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Which platforms do you post to?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PLATFORMS.map(({ key, label, guidance }) => (
              <div key={key}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: platforms.includes(key) ? 6 : 0 }}>
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
                {platforms.includes(key) && (
                  <p style={{
                    fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.4,
                    margin: '0 0 0 30px', paddingLeft: 0,
                  }}>
                    {guidance}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Framing band */}
          <p style={{
            fontSize: '0.75rem', color: 'var(--gray-400)', lineHeight: 1.5,
            marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6',
          }}>
            These are general guidelines — your audience may differ.
            Consistency matters more than volume.
          </p>
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
          {saving ? 'Saving…' : 'Save Settings'}
        </button>

      </div>
    </div>
  );
}
