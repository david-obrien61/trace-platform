import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import type { Campaign, CampaignPost } from '@trace/shared/campaigns/types';

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📷', facebook: '👥', sms: '💬', email: '✉️',
};
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#e1306c', facebook: '#1877f2', sms: '#16a34a', email: '#7c3aed',
};

export function CampaignDetail() {
  const { id }                            = useParams<{ id: string }>();
  const navigate                          = useNavigate();
  const { businessId }                    = useBusinessContext();
  const [campaign, setCampaign]           = useState<Campaign | null>(null);
  const [posts, setPosts]                 = useState<CampaignPost[]>([]);
  const [revenue, setRevenue]             = useState<{ orders: number; total: number } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editText, setEditText]           = useState('');
  const [savingId, setSavingId]           = useState<string | null>(null);
  const [publishingId, setPublishingId]   = useState<string | null>(null);
  const [publishError, setPublishError]   = useState<Record<string, string>>({});
  const [generating, setGenerating]       = useState(false);

  useEffect(() => {
    if (!id || !businessId) return;
    load();
  }, [id, businessId]);

  async function load() {
    setLoading(true);

    const [{ data: camp }, { data: postRows }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).single(),
      supabase.from('campaign_posts').select('*').eq('campaign_id', id).order('scheduled_date', { ascending: true }),
    ]);

    setCampaign(camp ?? null);
    setPosts(postRows ?? []);

    // Revenue during the campaign window
    if (camp?.start_date && camp?.end_date && businessId) {
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('business_id', businessId)
        .gte('created_at', camp.start_date)
        .lte('created_at', camp.end_date + 'T23:59:59');
      if (orders) {
        setRevenue({
          orders: orders.length,
          total:  orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
        });
      }
    }

    setLoading(false);
  }

  function startEdit(post: CampaignPost) {
    setEditingId(post.id);
    setEditText(post.edited_copy ?? post.copy_text);
  }

  async function saveEdit(post: CampaignPost) {
    setSavingId(post.id);
    await supabase.from('campaign_posts').update({ edited_copy: editText.trim() }).eq('id', post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, edited_copy: editText.trim() } : p));
    setEditingId(null);
    setSavingId(null);
  }

  async function handlePublish(post: CampaignPost) {
    setPublishingId(post.id);
    setPublishError(prev => ({ ...prev, [post.id]: '' }));
    try {
      const resp = await fetch('/api/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'publish-post',
          postId:      post.id,
          businessId,
          editedCopy:  post.edited_copy ?? null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Publish failed');
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, status: 'published', published_at: new Date().toISOString() }
        : p,
      ));
    } catch (e: any) {
      setPublishError(prev => ({ ...prev, [post.id]: e.message }));
    }
    setPublishingId(null);
  }

  async function handleGenerateMore() {
    if (!campaign || !businessId) return;
    setGenerating(true);
    try {
      const resp = await fetch('/api/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          businessId,
          campaign: {
            name:            campaign.name,
            campaign_type:   campaign.campaign_type,
            start_date:      campaign.start_date,
            end_date:        campaign.end_date,
            target_category: campaign.target_category,
            description:     campaign.description,
          },
        }),
      });
      // Generate creates a NEW campaign — navigate there so posts are separate
      const data = await resp.json();
      if (resp.ok) navigate(`/campaigns/${data.campaignId}`);
    } catch { /* silent */ }
    setGenerating(false);
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return '';
    const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `Starts ${fmt(start)}`;
    return `Ends ${fmt(end!)}`;
  }

  const draftCount     = posts.filter(p => p.status === 'draft').length;
  const publishedCount = posts.filter(p => p.status === 'published').length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: SAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: GRAY }}>Loading campaign…</p>
      </div>
    );
  }
  if (!campaign) {
    return (
      <div style={{ minHeight: '100vh', background: SAGE, padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ color: DARK }}>Campaign not found.</p>
        <button onClick={() => navigate('/campaigns')} style={{ color: GREEN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>← Back to campaigns</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: SAGE, paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <button
          onClick={() => navigate('/campaigns')}
          style={{ background: 'none', border: 'none', color: '#a8c890', fontSize: '0.8125rem', cursor: 'pointer', padding: 0, marginBottom: 6 }}
        >
          ← Campaigns
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{campaign.name}</h1>
        {campaign.start_date && (
          <p style={{ fontSize: '0.8125rem', color: '#c8e6b0', margin: '3px 0 0' }}>
            {formatDateRange(campaign.start_date, campaign.end_date)}
          </p>
        )}
      </div>

      <div style={{ padding: '16px', maxWidth: 680, margin: '0 auto' }}>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: draftCount > 0 ? GREEN : GRAY }}>{draftCount}</p>
            <p style={{ margin: 0, fontSize: '0.6875rem', color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To review</p>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: publishedCount > 0 ? '#166534' : GRAY }}>{publishedCount}</p>
            <p style={{ margin: 0, fontSize: '0.6875rem', color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Published</p>
          </div>
          {revenue !== null && (
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: revenue.total > 0 ? GREEN : GRAY }}>
                {revenue.total > 0 ? `$${revenue.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
              </p>
              <p style={{ margin: 0, fontSize: '0.6875rem', color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {revenue.orders > 0 ? `${revenue.orders} orders` : 'No orders yet'}
              </p>
            </div>
          )}
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 16px', border: '1px solid #e5e7eb', textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontWeight: 700, color: DARK, marginBottom: 6 }}>No posts yet</p>
            <p style={{ fontSize: '0.875rem', color: GRAY }}>Generate posts to fill this campaign.</p>
          </div>
        ) : (
          posts.map(post => {
            const isEditing   = editingId === post.id;
            const isSaving    = savingId === post.id;
            const isPublishing = publishingId === post.id;
            const isPublished = post.status === 'published';
            const displayText = post.edited_copy ?? post.copy_text;

            return (
              <div
                key={post.id}
                style={{
                  background: '#fff', borderRadius: 14, padding: '14px 16px',
                  border: isPublished ? '1px solid #d1fae5' : '1px solid #e5e7eb',
                  marginBottom: 10,
                  opacity: isPublished ? 0.75 : 1,
                }}
              >
                {/* Post header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '3px 9px', borderRadius: 10,
                      background: `${PLATFORM_COLORS[post.platform]}18`,
                      color: PLATFORM_COLORS[post.platform],
                    }}>
                      {PLATFORM_ICONS[post.platform]} {post.platform}
                    </span>
                    {post.scheduled_date && (
                      <span style={{ fontSize: '0.75rem', color: GRAY }}>{formatDate(post.scheduled_date)}</span>
                    )}
                  </div>
                  {isPublished && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Published</span>
                  )}
                  {post.edited_copy && !isPublished && (
                    <span style={{ fontSize: '0.6875rem', color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                      Edited
                    </span>
                  )}
                </div>

                {/* Copy text — editable or display */}
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={8}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                      border: `1.5px solid ${GREEN}`, borderRadius: 8, fontSize: '0.875rem',
                      fontFamily: 'inherit', color: DARK, background: '#f9fafb',
                      resize: 'vertical', outline: 'none', marginBottom: 10,
                    }}
                  />
                ) : (
                  <p style={{
                    fontSize: '0.875rem', color: DARK, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', marginBottom: post.image_prompt ? 8 : 12,
                  }}>
                    {displayText}
                  </p>
                )}

                {/* Image prompt */}
                {post.image_prompt && !isEditing && (
                  <p style={{ fontSize: '0.75rem', color: GRAY, fontStyle: 'italic', marginBottom: 12, paddingLeft: 8, borderLeft: '2px solid #e5e7eb' }}>
                    📷 {post.image_prompt}
                  </p>
                )}

                {publishError[post.id] && (
                  <p style={{ fontSize: '0.8125rem', color: '#b91c1c', marginBottom: 8 }}>{publishError[post.id]}</p>
                )}

                {/* Actions */}
                {!isPublished && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(post)}
                          disabled={isSaving}
                          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                        >
                          {isSaving ? 'Saving…' : 'Save edits'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: GRAY, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(post)}
                          style={{ padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${GREEN}`, background: '#fff', color: GREEN, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePublish(post)}
                          disabled={isPublishing}
                          style={{
                            flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none',
                            background: isPublishing ? '#e5e7eb' : GREEN,
                            color: isPublishing ? GRAY : '#fff',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: isPublishing ? 'default' : 'pointer',
                          }}
                        >
                          {isPublishing ? 'Publishing…' : post.platform === 'sms' ? 'Mark sent' : 'Publish'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Generate more */}
        <button
          onClick={handleGenerateMore}
          disabled={generating}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            border: `1.5px dashed ${GREEN}`, background: 'transparent',
            color: generating ? GRAY : GREEN, fontWeight: 700, fontSize: '0.875rem',
            cursor: generating ? 'default' : 'pointer',
          }}
        >
          {generating ? 'Generating…' : '✦ Generate more posts for this campaign'}
        </button>

      </div>
    </div>
  );
}
