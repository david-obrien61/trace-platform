import { useState } from 'react';
import type { BusinessDiscoveryProfile, SilentPartnerAnalysis, SuggestedOffering } from '@trace/shared/discovery/types';

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: '0.9375rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

const VERTICALS = [
  { value: 'nursery',  label: 'Nursery / Garden Center' },
  { value: 'ignition', label: 'Auto / Diesel Shop' },
  { value: 'hvac',     label: 'HVAC / Plumbing / Electrical' },
  { value: 'kinna',    label: 'Nonprofit' },
];

export function DiscoveryInspect() {
  const [url, setUrl]             = useState('');
  const [vertical, setVertical]   = useState('nursery');
  const [painPoint, setPainPoint] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [profile, setProfile]     = useState<BusinessDiscoveryProfile | null>(null);
  const [analysis, setAnalysis]   = useState<SilentPartnerAnalysis | null>(null);
  const [copied, setCopied]       = useState(false);
  const [step, setStep]           = useState('');

  async function runInspection() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setProfile(null);
    setAnalysis(null);
    setStep('Fetching website…');

    try {
      const resp = await fetch('/api/discovery/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), vertical, painPoint: painPoint.trim() || undefined }),
      });

      setStep('Analyzing with AI…');
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error ?? 'Unknown error');

      setProfile(data.profile);
      setAnalysis(data.analysis);
      if (data.fetchError) {
        setError(`Note: ${data.fetchError} — analysis based on partial content`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed');
    }

    setLoading(false);
    setStep('');
  }

  function copyEmail() {
    if (!analysis) return;
    navigator.clipboard.writeText(`Subject: ${analysis.subject}\n\n${analysis.body}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: '0 0 2px', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          TRACE · Built with CAI
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Discovery Inspect</h1>
        <p style={{ fontSize: '0.8125rem', color: '#c8e6b0', margin: '4px 0 0' }}>
          Silent partner analysis — website inspection engine
        </p>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 680, margin: '0 auto' }}>

        {/* Input form */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Inspect a business
          </p>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
              Website URL
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://lawnstrees.com"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && !loading && runInspection()}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
                Vertical
              </label>
              <select value={vertical} onChange={e => setVertical(e.target.value)} style={{ ...inputStyle }}>
                {VERTICALS.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
              Stated pain point <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — shapes the analysis)</span>
            </label>
            <input
              value={painPoint}
              onChange={e => setPainPoint(e.target.value)}
              placeholder="e.g. We lose sales because we don't offer delivery"
              style={inputStyle}
            />
          </div>

          <button
            onClick={runInspection}
            disabled={loading || !url.trim()}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 10, border: 'none',
              background: (loading || !url.trim()) ? '#e5e7eb' : GREEN,
              color: (loading || !url.trim()) ? GRAY : '#fff',
              fontWeight: 700, fontSize: '0.9375rem', cursor: (loading || !url.trim()) ? 'default' : 'pointer',
            }}
          >
            {loading ? step || 'Analyzing…' : 'Run Inspection'}
          </button>

          {error && (
            <p style={{ fontSize: '0.8125rem', color: error.startsWith('Note') ? '#92400e' : RED, marginTop: 10 }}>
              {error}
            </p>
          )}
        </div>

        {/* Profile summary */}
        {profile && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              What we found — {profile.businessName ?? url}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 14, fontSize: '0.8125rem' }}>
              {[
                ['Location',    profile.location        ?? '—'],
                ['In business', profile.yearsInBusiness ? `${profile.yearsInBusiness} yrs` : '—'],
                ['Staff size',  profile.staffSize        ?? '—'],
                ['Site tone',   profile.tone             ?? '—'],
                ['Pricing',     profile.pricingVisible ? 'Visible on site' : 'Not shown'],
                ['Content',     profile.contentFreshness],
              ].map(([label, value]) => (
                <div key={label}>
                  <span style={{ color: GRAY, fontWeight: 600 }}>{label}: </span>
                  <span style={{ color: DARK }}>{value}</span>
                </div>
              ))}
            </div>

            {profile.strengths.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  Strengths observed
                </p>
                {profile.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '0.8125rem', color: DARK }}>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {profile.gaps.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  Gaps (not mentioned on site)
                </p>
                {profile.gaps.map((g, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#d97706', flexShrink: 0 }}>○</span>
                    <span style={{ fontSize: '0.8125rem', color: DARK }}>{g}</span>
                  </div>
                ))}
              </div>
            )}

            {profile.suggestedOfferings.length > 0 && (
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Suggested service offerings
                </p>
                {profile.suggestedOfferings.map((o: SuggestedOffering, i: number) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: DARK }}>{o.name}</p>
                      <span style={{ fontSize: '0.7rem', color: GRAY, background: '#f3f4f6', borderRadius: 10, padding: '2px 8px', flexShrink: 0, marginLeft: 8 }}>
                        {o.category}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: GRAY, lineHeight: 1.5 }}>
                      {o.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Silent partner analysis email */}
        {analysis && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: `2px solid ${GREEN}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Silent partner analysis — draft email
              </p>
              <button
                onClick={copyEmail}
                style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${GREEN}`, cursor: 'pointer', background: copied ? GREEN : '#fff', color: copied ? '#fff' : GREEN, fontWeight: 600, fontSize: '0.8125rem' }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px', border: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 700, color: DARK }}>
                Subject: {analysis.subject}
              </p>
              <div style={{ fontSize: '0.875rem', color: DARK, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                {analysis.body}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
