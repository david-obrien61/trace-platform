import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { authHeaders } from '@trace/shared/auth';
import { useBusinessContext } from '@trace/shared/context';
import type { Campaign, CampaignPost } from '@trace/shared/campaigns/types';
import { REAL_BUSINESS_PGRST } from '@trace/shared/business-logic/orderKind';
import {
  campaignEditLock, campaignEditPlan, campaignCancelPlan,
} from '@trace/shared/business-logic/campaignLifecycle';
import { CAMPAIGN_EDIT_ECHO_COLUMNS } from '@trace/shared/business-logic/campaignFields';

const ADVERT_DEBUG = false;

const editInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem',
  outline: 'none', fontFamily: 'inherit', color: '#111827', background: '#fff',
  minHeight: 48,
};

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';

const CHANNEL_ICONS: Record<string, string> = {
  instagram: '📷', facebook: '👥', sms: '💬', email: '✉️', tiktok: '🎵', twitter: '🐦',
};
const CHANNEL_COLORS: Record<string, string> = {
  instagram: '#e1306c', facebook: '#1877f2', sms: '#16a34a', email: '#7c3aed',
  tiktok: '#010101', twitter: '#1da1f2',
};

// Open platform URLs — handoff: owner posts manually
const CHANNEL_OPEN_URL: Record<string, string> = {
  instagram: 'https://www.instagram.com/',
  facebook:  'https://www.facebook.com/',
  tiktok:    'https://www.tiktok.com/upload',
  twitter:   'https://twitter.com/compose/tweet',
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
  const [copyingId, setCopyingId]         = useState<string | null>(null);
  const [copiedId, setCopiedId]           = useState<string | null>(null);
  const [copyError, setCopyError]         = useState<Record<string, string>>({});
  const [generating, setGenerating]       = useState(false);
  const [genError, setGenError]           = useState('');
  const [editingCampaign, setEditing]     = useState(false);
  const [editForm, setEditForm]           = useState({ start_date: '', end_date: '', target_category: '' });
  const [editError, setEditError]         = useState('');
  const [savingCampaign, setSavingCamp]   = useState(false);
  const [cancelling, setCancelling]       = useState(false);
  const [cancelError, setCancelError]     = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

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

    if (camp?.start_date && camp?.end_date && businessId) {
      // A campaign's revenue is a CLAIM about what the campaign produced, so a test order
      // rung up during the window must not be in it. Excluded at the query through the one
      // shared primitive rather than a filter remembered here (§6 r8 / orderKind.ts).
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('business_id', businessId)
        .or(REAL_BUSINESS_PGRST)
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

  async function handleCopy(post: CampaignPost) {
    const displayText = post.edited_copy ?? post.copy_text;
    setCopyingId(post.id);
    setCopyError(prev => ({ ...prev, [post.id]: '' }));

    const doCopy = async () => {
      try {
        // Mark reviewed via API — saves tone sample if edited, updates status
        const resp = await fetch('/api/campaigns', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            action:     'copy-post',
            postId:     post.id,
            businessId,
            editedCopy: post.edited_copy ?? null,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? 'Copy failed');

        if (ADVERT_DEBUG) console.log('[TRACE:advert] copy-post done — channel:', post.platform);

        setCopiedId(post.id);
        setPosts(prev => prev.map(p => p.id === post.id
          ? { ...p, status: 'published', published_at: new Date().toISOString() }
          : p,
        ));
        setTimeout(() => setCopiedId(prev => prev === post.id ? null : prev), 2000);
      } catch (e: any) {
        setCopyError(prev => ({ ...prev, [post.id]: e.message }));
      }
      setCopyingId(null);
    };

    // Copy to clipboard first, then mark reviewed
    navigator.clipboard.writeText(displayText)
      .then(doCopy)
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = displayText;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        doCopy();
      });
  }

  // ── R-147 · APPEND ──────────────────────────────────────────────────────────────────────────
  // The button says "for this campaign", so it sends THIS campaign's id and nothing else. The old
  // version sent a full campaign payload with no id, which took the CREATE branch, minted a second
  // row and navigated onto it — David produced two identical "arbor day" rows three hours apart.
  //
  // Three things changed and each one was a separate half of the defect:
  //   1. `campaignId` is sent, so the server appends.
  //   2. There is NO navigate — the owner stays on the campaign they asked about.
  //   3. The catch no longer swallows. "with no error surface at all" was the story's own phrase.
  async function handleGenerateMore() {
    if (!campaign || !businessId || !id) return;
    setGenerating(true);
    setGenError('');
    try {
      const resp = await fetch('/api/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'generate', businessId, campaignId: id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Could not generate more posts.');

      // A server that appended must say so. If it reports CREATE against an id we sent, the defect
      // is back and the screen says it rather than quietly showing a campaign that moved.
      if (data.mode !== 'append' || data.campaignId !== id) {
        throw new Error('The server created a new campaign instead of adding to this one. Nothing was changed here — tell David.');
      }
      if (ADVERT_DEBUG) console.log('[TRACE:CAMPAIGN] appended', data.postCount, 'posts to', id);
      await load();
    } catch (e: any) {
      setGenError(e.message ?? 'Could not generate more posts.');
    }
    setGenerating(false);
  }

  // ── R-145 · EDIT SCOPE ──────────────────────────────────────────────────────────────────────
  function openCampaignEdit() {
    if (!campaign) return;
    setEditError('');
    setEditForm({
      start_date:      campaign.start_date      ?? '',
      end_date:        campaign.end_date        ?? '',
      target_category: campaign.target_category ?? '',
    });
    setEditing(true);
  }

  async function saveCampaignEdit() {
    if (!campaign || !id) return;
    const plan = campaignEditPlan({
      current:  campaign as unknown as Record<string, unknown>,
      proposed: editForm,
      posts,
    });
    if (!plan.allowed) { setEditError(plan.reason ?? 'Cannot save.'); return; }

    setSavingCamp(true);
    setEditError('');
    // R-12 / E5: a PostgREST update matching ZERO rows returns success with no error, so the write
    // proves itself by returning the row. No returned row = the write did not land, and the screen
    // says so instead of showing the new value over an unchanged record.
    // EXACT-COUNT, not maybeSingle. A PostgREST update matching ZERO rows returns SUCCESS with no
    // error, so the affected-row count IS the proof (R-12: "a write must prove it wrote — check the
    // count"). `=== 1` rather than `> 0`: a one-id update that touched two rows is also wrong, and
    // rounding that to "fine" is how a silent clobber survives.
    const { data: rows, error } = await supabase
      .from('campaigns')
      .update(plan.patch)
      .eq('id', id)
      .select(CAMPAIGN_EDIT_ECHO_COLUMNS);
    setSavingCamp(false);

    if (error) { setEditError(error.message); return; }
    if (rows?.length !== 1) {
      setEditError('That did not save — you may not have permission to change this campaign.');
      return;
    }

    console.log('[TRACE:CAMPAIGN] edit saved', { campaignId: id, fields: Object.keys(plan.patch) });
    setEditing(false);
    await load();
  }

  // ── R-146 · CANCEL ──────────────────────────────────────────────────────────────────────────
  async function cancelCampaign() {
    if (!campaign || !id) return;
    const plan = campaignCancelPlan(campaign);
    if (!plan.allowed) { setCancelError(plan.reason ?? 'Cannot cancel.'); return; }

    setCancelling(true);
    setCancelError('');
    // Same exact-count proof as the edit above. A cancel that silently matched no row would leave
    // the campaign active while the screen moved on — the precise shape R-12 was ruled against.
    const { data: rows, error } = await supabase
      .from('campaigns')
      .update({ status: plan.nextStatus })
      .eq('id', id)
      .select('id, status');
    setCancelling(false);

    if (error) { setCancelError(error.message); return; }
    if (rows?.length !== 1) {
      setCancelError('That did not save — you may not have permission to cancel this campaign.');
      return;
    }

    console.log('[TRACE:CAMPAIGN] cancelled', { campaignId: id, status: rows[0].status });
    setConfirmCancel(false);
    await load();
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function formatDateRange(start: string | null, end: string | null) {
    const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `Starts ${fmt(start)}`;
    if (end)   return `Ends ${fmt(end)}`;
    return '';
  }

  const draftCount     = posts.filter(p => p.status === 'draft').length;
  const publishedCount = posts.filter(p => p.status === 'published').length;
  // R-145: the lock, derived from the posts themselves. `published` means COPIED OUT OF TRACE — the
  // refusal copy inside campaignEditLock is careful about that and this page must not restate it
  // more confidently than the function does.
  const editLock       = campaignEditLock(posts);
  const cancelPlan     = campaignCancelPlan(campaign ?? { status: 'draft' });

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
            <p style={{ margin: 0, fontSize: '0.6875rem', color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Copied &amp; posted</p>
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

        {/* ── LIFECYCLE · R-145 edit · R-146 cancel ──────────────────────────────────────────
            Both live here rather than in a menu: the 2026-08-23 scoping found edit and cancel were
            blocked by NOTHING but a missing UI — the policy, the permission string and the status
            vocabulary all already existed. */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid #e5e7eb', marginBottom: 12 }}>

          {editingCampaign ? (
            <>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                Edit campaign
              </p>
              {/* The scope is NAMED on the surface, not just enforced behind it — a field that is
                  absent without explanation reads as a missing feature (D-9). */}
              <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 12px' }}>
                You can change the dates and the focus. The name stays, so last season's campaign is
                still findable by what you called it.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="camp-start" style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>Start date</label>
                  <input id="camp-start" type="date" value={editForm.start_date}
                    onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} style={editInput} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="camp-end" style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>End date</label>
                  <input id="camp-end" type="date" value={editForm.end_date}
                    onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} style={editInput} />
                </div>
              </div>

              <label htmlFor="camp-focus" style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY, display: 'block', marginBottom: 4 }}>Product focus</label>
              <input id="camp-focus" value={editForm.target_category}
                onChange={e => setEditForm(f => ({ ...f, target_category: e.target.value }))}
                placeholder="e.g. shade trees, fruit trees" style={{ ...editInput, marginBottom: 12 }} />

              {editError && (
                <p role="alert" style={{ fontSize: '0.8125rem', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', margin: '0 0 10px' }}>
                  {editError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void saveCampaignEdit()} disabled={savingCampaign}
                  style={{ flex: 1, minHeight: 48, borderRadius: 10, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: savingCampaign ? 'default' : 'pointer' }}>
                  {savingCampaign ? 'Saving…' : 'Save changes'}
                </button>
                <button onClick={() => { setEditing(false); setEditError(''); }} disabled={savingCampaign}
                  style={{ minHeight: 48, padding: '0 16px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#fff', color: GRAY, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 🔴 LOCKED — and the copy claims only what TRACE can actually know. It does not say
                  "published to your feed" or "your customers have seen this": a copied post's fate is
                  invisible to us (user_stories.md:1250-1252). It names the route out instead. */}
              {editLock.locked ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e', margin: '0 0 4px' }}>
                    The dates and focus are locked
                  </p>
                  <p data-lock-reason style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    {editLock.reason}
                  </p>
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!editLock.locked && (
                  <button onClick={openCampaignEdit}
                    style={{ flex: '1 1 auto', minHeight: 48, borderRadius: 10, border: `1.5px solid ${GREEN}`, background: '#fff', color: GREEN, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                    Edit dates &amp; focus
                  </button>
                )}

                {cancelPlan.allowed && !confirmCancel && (
                  <button onClick={() => { setConfirmCancel(true); setCancelError(''); }}
                    style={{ flex: '1 1 auto', minHeight: 48, borderRadius: 10, border: '1.5px solid #fca5a5', background: '#fff', color: '#991b1b', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                    Cancel campaign
                  </button>
                )}
              </div>

              {/* R-146: the confirm says what cancel DOES — it shelves, it does not delete. That is
                  the whole reason delete was scoped out, so the screen had better not imply it. */}
              {confirmCancel && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', marginTop: 10 }}>
                  <p style={{ fontSize: '0.8125rem', color: '#991b1b', margin: '0 0 10px', lineHeight: 1.5 }}>
                    Cancelling shelves this campaign. It <strong>stays on your list</strong>, marked cancelled,
                    with its posts — next September what you didn't run is as useful as what you did.
                  </p>
                  {cancelError && (
                    <p role="alert" style={{ fontSize: '0.8125rem', color: '#991b1b', fontWeight: 600, margin: '0 0 10px' }}>{cancelError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => void cancelCampaign()} disabled={cancelling}
                      style={{ flex: 1, minHeight: 48, borderRadius: 10, border: 'none', background: '#991b1b', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: cancelling ? 'default' : 'pointer' }}>
                      {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                    </button>
                    <button onClick={() => { setConfirmCancel(false); setCancelError(''); }} disabled={cancelling}
                      style={{ minHeight: 48, padding: '0 16px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#fff', color: GRAY, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                      Keep it
                    </button>
                  </div>
                </div>
              )}

              {/* A cancelled campaign says so here too, because the button is gone and a control that
                  vanished without a word is the six-state ruling's defect. */}
              {!cancelPlan.allowed && (
                <p style={{ fontSize: '0.8125rem', color: GRAY, margin: 0 }}>{cancelPlan.reason}</p>
              )}
            </>
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
            const isEditing    = editingId === post.id;
            const isSaving     = savingId === post.id;
            const isCopying    = copyingId === post.id;
            const isReviewed   = post.status === 'published';
            const displayText  = post.edited_copy ?? post.copy_text;
            const openUrl      = CHANNEL_OPEN_URL[post.platform];
            const isSms        = post.platform === 'sms';

            return (
              <div
                key={post.id}
                style={{
                  background: '#fff', borderRadius: 14, padding: '14px 16px',
                  border: isReviewed ? '1px solid #d1fae5' : '1px solid #e5e7eb',
                  marginBottom: 10,
                  opacity: isReviewed ? 0.75 : 1,
                }}
              >
                {/* Post header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '3px 9px', borderRadius: 10,
                      background: `${CHANNEL_COLORS[post.platform] ?? '#6b7280'}18`,
                      color: CHANNEL_COLORS[post.platform] ?? GRAY,
                    }}>
                      {CHANNEL_ICONS[post.platform] ?? '📣'} {post.platform}
                    </span>
                    {post.scheduled_date && (
                      <span style={{ fontSize: '0.75rem', color: GRAY }}>{formatDate(post.scheduled_date)}</span>
                    )}
                  </div>
                  {isReviewed && (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Copied</span>
                  )}
                  {post.edited_copy && !isReviewed && (
                    <span style={{ fontSize: '0.6875rem', color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                      Edited
                    </span>
                  )}
                </div>

                {/* Copy text */}
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

                {/* Image prompt (non-SMS only) */}
                {post.image_prompt && !isEditing && !isSms && (
                  <p style={{ fontSize: '0.75rem', color: GRAY, fontStyle: 'italic', marginBottom: 12, paddingLeft: 8, borderLeft: '2px solid #e5e7eb' }}>
                    📷 {post.image_prompt}
                  </p>
                )}

                {copyError[post.id] && (
                  <p style={{ fontSize: '0.8125rem', color: '#b91c1c', marginBottom: 8 }}>{copyError[post.id]}</p>
                )}

                {/* Actions — handoff model: Copy / Download / Open */}
                {!isReviewed && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

                        {/* Copy caption — primary action; marks as reviewed */}
                        <button
                          onClick={() => handleCopy(post)}
                          disabled={isCopying}
                          style={{
                            flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none',
                            background: isCopying ? '#e5e7eb' : GREEN,
                            color: isCopying ? GRAY : '#fff',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: isCopying ? 'default' : 'pointer',
                          }}
                        >
                          {copiedId === post.id ? '✓ Copied!' : isCopying ? 'Copying…' : isSms ? 'Copy text' : 'Copy caption'}
                        </button>

                        {/* Download image — stub, non-SMS only */}
                        {!isSms && (
                          <button
                            disabled
                            title="Image download coming soon"
                            style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#d1d5db', fontWeight: 600, fontSize: '0.8125rem', cursor: 'not-allowed' }}
                          >
                            ↓ Image
                          </button>
                        )}

                        {/* Open channel — social only (no URL for SMS) */}
                        {openUrl && !isSms && (
                          <a
                            href={openUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                              background: '#fff', color: GRAY, fontWeight: 600, fontSize: '0.8125rem',
                              cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                            }}
                          >
                            Open ↗
                          </a>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Generate more — R-147. The error surface is NOT optional: "with no error surface at all"
            is the story's description of what made the duplicate invisible. */}
        {genError && (
          <p role="alert" style={{ fontSize: '0.8125rem', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', margin: '0 0 10px' }}>
            {genError}
          </p>
        )}
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
