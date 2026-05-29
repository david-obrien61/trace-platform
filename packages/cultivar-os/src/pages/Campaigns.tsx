import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import type { Campaign } from '@trace/shared/campaigns/types';

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

const TYPE_ICONS: Record<string, string> = {
  seasonal: '🌿', holiday: '🌷', clearance: '🏷️', product_launch: '✨', custom: '📋',
};
const TYPE_LABELS: Record<string, string> = {
  seasonal: 'Seasonal', holiday: 'Holiday', clearance: 'Clearance',
  product_launch: 'Product Launch', custom: 'Custom',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem',
  outline: 'none', fontFamily: 'inherit', color: DARK, background: '#fff',
};

interface CampaignWithCount extends Campaign { draft_count: number; }

export function Campaigns() {
  const navigate                     = useNavigate();
  const { businessId }               = useBusinessContext();
  const [campaigns, setCampaigns]    = useState<CampaignWithCount[]>([]);
  const [loading, setLoading]        = useState(true);
  const [showForm, setShowForm]      = useState(false);
  const [generating, setGenerating]  = useState(false);
  const [genError, setGenError]      = useState('');

  const [form, setForm] = useState({
    name: '', campaign_type: 'seasonal', start_date: '', end_date: '',
    target_category: '', description: '',
  });

  useEffect(() => {
    if (!businessId) return;
    loadCampaigns();
  }, [businessId]);

  async function loadCampaigns() {
    setLoading(true);
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('business_id', businessId)
      .order('start_date', { ascending: true, nullsFirst: false });

    if (!data) { setLoading(false); return; }

    // Count draft posts per campaign
    const counts = await Promise.all(
      data.map(async c => {
        const { count } = await supabase
          .from('campaign_posts')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', c.id)
          .eq('status', 'draft');
        return { ...c, draft_count: count ?? 0 } as CampaignWithCount;
      }),
    );
    setCampaigns(counts);
    setLoading(false);
  }

  async function handleGenerate() {
    if (!form.name.trim() || !businessId) return;
    setGenerating(true);
    setGenError('');
    try {
      const resp = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, campaign: { ...form } }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Generation failed');
      navigate(`/campaigns/${data.campaignId}`);
    } catch (e: any) {
      setGenError(e.message);
      setGenerating(false);
    }
  }

  function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return 'No dates set';
    const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `Starts ${fmt(start)}`;
    return `Ends ${fmt(end!)}`;
  }

  function statusColor(status: string) {
    if (status === 'active')    return { bg: '#dcfce7', color: '#166534' };
    if (status === 'completed') return { bg: '#f3f4f6', color: GRAY };
    if (status === 'cancelled') return { bg: '#fee2e2', color: '#991b1b' };
    return { bg: '#fef9c3', color: '#854d0e' };
  }

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 60 }}>

      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: '#a8c890', fontSize: '0.8125rem', cursor: 'pointer', padding: 0, marginBottom: 6 }}
        >
          ← Dashboard
        </button>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Campaign Scheduler</h1>
        <p style={{ fontSize: '0.8125rem', color: '#c8e6b0', margin: '4px 0 0' }}>
          Plan, draft, and publish seasonal content
        </p>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 680, margin: '0 auto' }}>

        {/* New campaign form */}
        {showForm ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '18px 16px', border: `2px solid ${GREEN}`, marginBottom: 16 }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, margin: '0 0 14px' }}>
              New campaign
            </p>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>Campaign name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mother's Day 2026" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.campaign_type} onChange={e => setForm(f => ({ ...f, campaign_type: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="seasonal">Seasonal</option>
                  <option value="holiday">Holiday</option>
                  <option value="clearance">Clearance</option>
                  <option value="product_launch">Product Launch</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>Product focus (optional)</label>
                <input value={form.target_category} onChange={e => setForm(f => ({ ...f, target_category: e.target.value }))}
                  placeholder="e.g. flowering, fruit trees" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>Start date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>End date</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>
                Context for the AI <span style={{ fontWeight: 400 }}>(optional — shapes the posts)</span>
              </label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. We're running 20% off all large containers. Great time to move the B-grade stock."
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {genError && <p style={{ fontSize: '0.8125rem', color: '#b91c1c', marginBottom: 10 }}>{genError}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerate}
                disabled={generating || !form.name.trim()}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 9, border: 'none',
                  background: (!form.name.trim() || generating) ? '#e5e7eb' : GREEN,
                  color: (!form.name.trim() || generating) ? GRAY : '#fff',
                  fontWeight: 700, fontSize: '0.9375rem',
                  cursor: (!form.name.trim() || generating) ? 'default' : 'pointer',
                }}
              >
                {generating ? 'Generating posts…' : '✦ Generate Posts'}
              </button>
              <button
                onClick={() => { setShowForm(false); setGenError(''); }}
                style={{ padding: '12px 16px', borderRadius: 9, border: '1.5px solid #d1d5db', background: '#fff', color: GRAY, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            {generating && (
              <p style={{ fontSize: '0.75rem', color: GRAY, textAlign: 'center', marginTop: 10 }}>
                Writing your posts… usually takes 15–25 seconds
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 10, border: `1.5px dashed ${GREEN}`,
              background: 'transparent', color: GREEN, fontWeight: 700, fontSize: '0.9375rem',
              cursor: 'pointer', marginBottom: 16,
            }}
          >
            + New Campaign
          </button>
        )}

        {/* Campaign list */}
        {loading ? (
          <p style={{ textAlign: 'center', color: GRAY, fontSize: '0.875rem', marginTop: 40 }}>Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px 20px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: DARK, marginBottom: 6 }}>No campaigns yet</p>
            <p style={{ fontSize: '0.875rem', color: GRAY }}>Create your first campaign and TRACE will draft all the posts.</p>
          </div>
        ) : (
          campaigns.map(c => {
            const sc = statusColor(c.status);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/campaigns/${c.id}`)}
                style={{
                  background: '#fff', borderRadius: 14, padding: '16px',
                  border: '1px solid #e5e7eb', marginBottom: 10, cursor: 'pointer',
                  borderLeft: c.draft_count > 0 ? `4px solid ${GREEN}` : '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.125rem' }}>{TYPE_ICONS[c.campaign_type] ?? '📋'}</span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: DARK }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 10, background: sc.bg, color: sc.color }}>
                    {c.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 8px' }}>
                  {TYPE_LABELS[c.campaign_type]} · {formatDateRange(c.start_date, c.end_date)}
                </p>

                {c.draft_count > 0 ? (
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: GREEN, margin: 0 }}>
                    {c.draft_count} post{c.draft_count !== 1 ? 's' : ''} ready to review →
                  </p>
                ) : c.status === 'draft' ? (
                  <p style={{ fontSize: '0.8125rem', color: GRAY, margin: 0 }}>
                    No posts yet — open to generate
                  </p>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>All posts published ✓</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
