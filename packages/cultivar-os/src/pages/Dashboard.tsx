import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@trace/shared/components/Card';
import { supabase } from '../lib/supabase';
import { auth } from '../lib/auth';
import { useBusinessContext } from '@trace/shared/context';
import { useModules } from '../hooks/useModules';
import { requiredPermissionFor } from '../registry/tileRegistry';
import { TileGrid } from '@trace/shared/components/tiles/TileGrid';
import { Tile } from '@trace/shared/components/tiles/Tile';

// Configurable — will move to verticalConfig post-demo
const LEAKAGE_AVG_VALUE = 28;

const SM_DEBUG           = false; // flip to true to re-enable [SM-TRACE] diagnostics
const SOCIALDRAFT_DEBUG  = false; // flip to true to re-enable [TRACE:socialdraft] diagnostics

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmt$(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Components ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="card" padding="none">
      <div style={{ padding: '18px 16px' }}>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
        }}>
          {label}
        </p>
        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.2 }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', marginTop: 4 }}>{sub}</p>
        )}
      </div>
    </Card>
  );
}

function SkeletonCard() {
  return <div className="skeleton" style={{ flex: 1, minWidth: 0, height: 88, borderRadius: 12 }} />;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  tiktok:    'TikTok',
  twitter:   'Twitter / X',
};

const PLATFORM_URLS: Record<string, string> = {
  instagram: 'https://www.instagram.com/',
  facebook:  'https://www.facebook.com/',
  tiktok:    'https://www.tiktok.com/',
  twitter:   'https://x.com/',
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = auth.useSession();
  const navigate  = useNavigate();
  const { business, businessId, loading: businessLoading, businessError, userPermissions, isOwner, can } = useBusinessContext();
  const canManageSettings = isOwner || (userPermissions ?? []).includes('manage_settings');
  const canViewCosts = can('view_costs'); // gates the cost-derived inventory-value metric
  // Readout visibility is registry-driven (MB_D-012): a readout LEAKS data by rendering, so it
  // shows only if the session holds the registry's required_permission for that readout key.
  // (today_sales is now view_costs-gated — revenue is moat-class. Was ungated.)
  const canSeeReadout = (key: string) => can(requiredPermissionFor(key) ?? 'owner-only');

  const [businessName, setBusinessName]       = useState('');
  const [plantCount, setPlantCount]           = useState(0);
  const [inventoryValue, setInventoryValue]   = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [todayRevenue, setTodayRevenue]       = useState(0);
  const [installsThisWeek, setInstalls]       = useState(0);
  const [leakageCount, setLeakageCount]       = useState(0);
  const [loading, setLoading]                 = useState(true);

  interface SocialDraft {
    id: string;
    post_type: string | null;
    original_text: string | null;
    edited_text: string | null;
    platform: string;
    status: string;
    subject_type: string | null;
    subject_id: string | null;
    copied_at: string | null;
  }

  const [socialDrafts, setSocialDrafts]           = useState<SocialDraft[]>([]);
  const [campaignDraftCount, setCampaignDraftCount] = useState(0);
  const [draftEdits, setDraftEdits]               = useState<Record<string, string>>({});
  const [copiedId, setCopiedId]                   = useState<string | null>(null);
  const [generatingPosts, setGeneratingPosts]     = useState(false);
  const [comingSoonMsg, setComingSoonMsg]         = useState<string | null>(null);

  const [qbConnected, setQbConnected]         = useState(false);
  const [qbCompany, setQbCompany]             = useState('');
  const [connecting, setConnecting]           = useState(false);
  const [qbError, setQbError]                 = useState('');
  const [accountingNeedsReconnect, setAccountingNeedsReconnect] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Consecutive /api/qbo/status failures (non-ok / network). Circuit-breaker for the connect
  // poll so a persistently-erroring status endpoint (tech-debt #34) stops hammering every 2s
  // instead of looping until the popup closes. Reset to 0 on any healthy (res.ok) response.
  const qbStatusFailRef = useRef(0);
  const { modules } = useModules(businessId, can, business?.business_type ?? null);

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadMetrics() {
    setLoading(true);
    const today = todayStart();
    const week  = weekStart();

    const [businessRes, plantsRes, todayRes, installsRes, leakageRes] = await Promise.all([
      supabase
        .from('businesses')
        .select('name, phone, address, accounting_needs_reconnect, accounting_token_expires_at')
        .eq('id', businessId!)
        .single(),

      supabase
        .from('business_inventory')
        // view_costs gate: a member without it never receives unit_cost (cost absent from
        // the network response); qty is still read for the plant-count metric.
        .select(canViewCosts ? 'qty, unit_cost' : 'qty')
        .eq('business_id', businessId!)
        .eq('status', 'available'),

      supabase
        .from('orders')
        .select('id, total_amount')
        .eq('business_id', businessId!)
        .neq('status', 'cancelled')
        .gte('created_at', today),

      supabase
        .from('orders')
        .select('id')
        .eq('business_id', businessId!)
        .eq('transport_method', 'install')
        .gte('created_at', week),

      supabase
        .from('orders')
        .select('id')
        .eq('business_id', businessId!)
        .eq('leakage_flag', true)
        .gte('created_at', week),
    ]);

    if (businessRes.data) {
      setBusinessName(businessRes.data.name);
      // Belt-and-suspenders: derive reconnect state from token expiry immediately,
      // rather than trusting the cached DB flag alone. checkQbStatus() will
      // provide the authoritative result (including silent refresh attempt) shortly.
      const tokenExpiresAt = businessRes.data.accounting_token_expires_at;
      const expiresMs = tokenExpiresAt ? new Date(tokenExpiresAt).getTime() : 0;
      const tokenExpired = expiresMs > 0 && expiresMs < Date.now();
      setAccountingNeedsReconnect(businessRes.data.accounting_needs_reconnect || tokenExpired);
      setProfileIncomplete(!businessRes.data.phone || !businessRes.data.address);
    }

    const inventoryLots = plantsRes.data ?? [];
    // plant_count from cultivar_plants identity rows is provided by api/dashboard.ts;
    // this client path uses business_inventory lot count as a proxy until the API is called.
    setPlantCount(inventoryLots.reduce((sum: number, l: any) => sum + Number(l.qty), 0));
    // inventory value is cost-derived — only computed when the session holds view_costs
    setInventoryValue(canViewCosts ? inventoryLots.reduce((sum: number, l: any) => sum + (Number(l.qty) * Number(l.unit_cost ?? 0)), 0) : 0);

    const todayOrders = todayRes.data ?? [];
    setTodayOrderCount(todayOrders.length);
    setTodayRevenue(todayOrders.reduce((sum, o) => sum + ((o as any).total_amount ?? 0), 0));

    setInstalls((installsRes.data ?? []).length);
    setLeakageCount((leakageRes.data ?? []).length);

    setLoading(false);
  }

  // ── Social drafts ─────────────────────────────────────────────────────────

  async function loadCampaignDrafts() {
    const { count } = await supabase
      .from('campaign_posts')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId!)
      .eq('status', 'draft');
    setCampaignDraftCount(count ?? 0);
  }

  async function loadSocialDrafts() {
    if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] loadSocialDrafts — businessId:', businessId);
    const { data, error } = await supabase
      .from('social_drafts')
      .select('id, post_type, original_text, edited_text, platform, status, subject_type, subject_id, copied_at')
      .eq('business_id', businessId!)
      .not('status', 'eq', 'copied')
      .order('created_at', { ascending: true });
    if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] loadSocialDrafts result — rows:', data?.length, 'error:', error?.message);
    setSocialDrafts((data as SocialDraft[]) ?? []);
  }

  async function handleSaveEdit(draftId: string, text: string) {
    if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] handleSaveEdit — draftId:', draftId, 'textLen:', text.length);
    await supabase
      .from('social_drafts')
      .update({ edited_text: text, status: 'edited' })
      .eq('id', draftId);
  }

  async function handleCopyCaption(draftId: string, text: string) {
    if (SOCIALDRAFT_DEBUG) console.log('[TRACE:socialdraft] handleCopyCaption — draftId:', draftId);
    const doCopy = () => {
      setCopiedId(draftId);
      // status='copied' + copied_at — marks the review loop complete for this draft
      supabase
        .from('social_drafts')
        .update({ status: 'copied', copied_at: new Date().toISOString() })
        .eq('id', draftId)
        .then(({ error }) => {
          if (error) console.warn('[TRACE:socialdraft] copied status update failed:', error.message);
          else setSocialDrafts(prev => prev.filter(d => d.id !== draftId));
        });
      setTimeout(() => setCopiedId(prev => prev === draftId ? null : prev), 2000);
    };

    navigator.clipboard.writeText(text).then(doCopy).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      doCopy();
    });
  }

  async function handleGeneratePosts() {
    if (!businessId || generatingPosts) return;
    setGeneratingPosts(true);
    try {
      const res = await fetch('/api/social/generate-posts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ business_id: businessId }),
      });
      if (res.ok) await loadSocialDrafts();
    } catch { /* non-fatal */ }
    finally { setGeneratingPosts(false); }
  }

  // ── QB helpers ────────────────────────────────────────────────────────────

  async function checkQbStatus(): Promise<boolean> {
    try {
      const res = await fetch(`/api/qbo/status?business_id=${businessId!}`);
      if (res.ok) {
        qbStatusFailRef.current = 0; // endpoint healthy — reset the breaker
        const data = await res.json();
        if (data.connected) {
          setQbConnected(true);
          setQbCompany(data.companyName ?? '');
          // Authoritative result from server: overrides client-side expiry estimate.
          // If refresh succeeded silently, needsReconnect is false → banner clears.
          // If refresh failed, needsReconnect is true → banner persists.
          setAccountingNeedsReconnect(data.needsReconnect ?? false);
          return true;
        }
        return false; // healthy response, just not connected yet
      }
      // non-ok (e.g. 500 — tech-debt #35): count it so the poll can break the loop.
      qbStatusFailRef.current += 1;
    } catch {
      // network / function-invocation failure — also a breaker hit, non-fatal for one-shots.
      qbStatusFailRef.current += 1;
    }
    return false;
  }

  // After this many consecutive failed status checks, stop polling and surface the error
  // rather than hammering /api/qbo/status every 2s while the popup stays open.
  const QB_STATUS_FAIL_LIMIT = 5;

  async function handleConnect() {
    setConnecting(true);
    setQbError('');

    let popup: Window | null = null;
    let step = 'init';

    try {
      step = 'open-popup';
      popup = window.open('', 'qb-connect', 'width=720,height=640,left=200,top=100');

      step = 'fetch';
      const res = await fetch(`/api/qbo/auth-url?business_id=${businessId!}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`[step:${step}] ` + (body.error || `Server error ${res.status}`));
      }

      step = 'parse';
      const { url } = await res.json();

      step = 'validate-url';
      try { new URL(url); } catch {
        throw new Error(`[step:${step}] Malformed URL returned by server — check QBO env vars`);
      }

      step = 'navigate';
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        window.location.href = url;
        return;
      }

      step = 'poll';
      qbStatusFailRef.current = 0; // fresh poll session — reset the breaker
      pollingRef.current = setInterval(async () => {
        const connected = await checkQbStatus();
        if (connected) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConnecting(false);
          loadMetrics();
          return;
        }
        // Circuit-breaker: a persistently-erroring /api/qbo/status (tech-debt #34) must not
        // poll forever. Stop after N consecutive failures and surface what to check.
        if (qbStatusFailRef.current >= QB_STATUS_FAIL_LIMIT) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConnecting(false);
          setQbError('[step:poll] QuickBooks status check is failing repeatedly — the /api/qbo/status endpoint may be erroring (check Vercel function logs). Stopped polling.');
          return;
        }
        if (!popup || popup.closed) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConnecting(false);
        }
      }, 2000);
    } catch (err: any) {
      popup?.close();
      const msg = String(err?.message || err || 'Unknown error');
      setQbError(msg.startsWith('[step:') ? msg : `[step:${step}] ${msg}`);
      setConnecting(false);
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  function showComingSoon(label: string) {
    setComingSoonMsg(label);
  }

  // Single registry-driven open handler (replaces the old handleEnable/handleNavigate switch
  // statements — that routing now lives in tileRegistry.ts as each entry's `route`, MB_D-012).
  // Fires for both 'available' (onEnable) and 'active' (onNavigate) tiles; 'locked'/planned tiles
  // are non-interactive (no route) and show the coming-soon notice.
  function openTile(tile: { key: string; label: string; route?: string }) {
    if (SM_DEBUG && tile.key === 'social_media') console.log('[SM-TRACE] Dashboard openTile: social_media →', tile.route);
    if (tile.route) return navigate(tile.route);
    return showComingSoon(tile.label);
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!businessId) return;
    loadMetrics();
    checkQbStatus();
    loadSocialDrafts();
    loadCampaignDrafts();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [businessId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const missedRevenue = leakageCount * LEAKAGE_AVG_VALUE;

  // ── Render ────────────────────────────────────────────────────────────────

  if (businessLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--sage-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: 160, height: 20, borderRadius: 4 }} />
      </div>
    );
  }

  if (!businessLoading && (businessError || !businessId)) {
    navigate('/onboarding', { replace: true });
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'var(--green-primary)',
        padding: '20px 16px',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{
            fontSize: '0.6875rem', color: '#a8c890', marginBottom: 2,
            letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase',
          }}>
            {businessName}
          </p>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>{isOwner ? 'Owner Dashboard' : 'Dashboard'}</h1>
          {user?.email && (
            <p style={{ fontSize: '0.75rem', color: '#a8c890', marginTop: 4 }}>{user.email}</p>
          )}
        </div>
        {/* Account-action row removed — account actions (Help · + Business · Sign out) now live in
            the header avatar menu (AppHeader); Settings and Receipts are reachable via the nav rail
            / IA. This resolves the duplicate-nav (Settings-listed-twice) bug. */}
      </div>

      {comingSoonMsg && (
        <div
          onClick={() => setComingSoonMsg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: '32px 28px',
              maxWidth: 320, width: '90%', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <p style={{ fontSize: '2rem', marginBottom: 12 }}>🔧</p>
            <p style={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827', marginBottom: 8 }}>
              {comingSoonMsg}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 24, lineHeight: 1.5 }}>
              This module is in development. It will be available in a future release.
            </p>
            <button
              onClick={() => setComingSoonMsg(null)}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                background: '#27500A', color: '#fff', fontWeight: 700,
                fontSize: '0.9375rem', cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, margin: '0 auto' }}>

        {/* ── Profile completion banner ── */}
        {profileIncomplete && canManageSettings && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 12,
            padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e', margin: '0 0 2px' }}>
                Complete your nursery profile
              </p>
              <p style={{ fontSize: '0.8rem', color: '#b45309', margin: 0, lineHeight: 1.4 }}>
                Add your phone and address so customers and invoices have your contact info.
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              style={{
                background: '#f59e0b', border: 'none', borderRadius: 8,
                padding: '8px 14px', color: '#fff', fontWeight: 700,
                fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              Complete →
            </button>
          </div>
        )}

        {/* ── QB status banner (readout: qb_status → manage_settings) ── */}
        {canSeeReadout('qb_status') && (!qbConnected ? (
          <div id="qb-section" style={{ background: '#fff', border: '2px solid var(--green-primary)', borderRadius: 12, padding: '16px' }}>
            <p style={{
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--green-primary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
            }}>
              QuickBooks Online
            </p>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 4 }}>
              Connect to auto-create invoices
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: 14, lineHeight: 1.5 }}>
              Every checkout automatically creates an invoice — no typing required.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn btn-primary"
              style={{ opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? 'Opening QuickBooks…' : 'Connect QuickBooks'}
            </button>
            {qbError && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--red-border)', marginTop: 10 }}>
                Error: {qbError}
              </p>
            )}
          </div>
        ) : (
          <div id="qb-section" style={{
            background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12,
            padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--green-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
              }}>✓</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534', margin: 0 }}>
                  QuickBooks connected
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#16a34a', margin: '2px 0 0' }}>
                  {qbCompany || 'Sandbox company'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setQbConnected(false); setQbCompany(''); }}
              style={{ background: 'none', border: 'none', fontSize: '0.8125rem', color: 'var(--gray-600)', cursor: 'pointer', padding: '4px 8px' }}
            >
              Disconnect
            </button>
          </div>
        ))}

        {/* ── Metric cards 2×2 ── */}
        {loading ? (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              {canSeeReadout('metric_plants') && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MetricCard
                    label="Plants tracked"
                    value={String(plantCount)}
                    sub={`${plantCount} available`}
                  />
                </div>
              )}
              {canViewCosts && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MetricCard
                    label="Inventory value"
                    value={fmt$(inventoryValue)}
                    sub="at base price"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {/* Today's sales is a readout that exposes revenue → view_costs-gated (moat-class). */}
              {canSeeReadout('metric_today_sales') && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MetricCard
                    label="Today's sales"
                    value={String(todayOrderCount)}
                    sub={todayOrderCount > 0 ? `${fmt$(todayRevenue)} revenue` : 'No orders yet today'}
                  />
                </div>
              )}
              {canSeeReadout('metric_installs') && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MetricCard
                    label="Installs this week"
                    value={String(installsThisWeek)}
                    sub={installsThisWeek === 1 ? '1 scheduled' : `${installsThisWeek} scheduled`}
                  />
                </div>
              )}
            </div>

            {/* ── Leakage alert tile (readout: leakage_alert → view_orders) ── */}
            {canSeeReadout('leakage_alert') && (leakageCount > 0 ? (
              <div style={{
                background: 'var(--amber-bg)',
                border: '1.5px solid var(--amber-border)',
                borderRadius: 12,
                padding: '16px',
              }}>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#92400e', marginBottom: 6 }}>
                  ⚠ {leakageCount} sale{leakageCount !== 1 ? 's' : ''} with no add-ons this week
                </p>
                <p style={{ fontSize: '0.875rem', color: '#b45309', lineHeight: 1.5, marginBottom: 10 }}>
                  Large-container trees were sold without compost, fertilizer, or netting.
                  Each is a missed upsell at planting time.
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#92400e' }}>
                    {fmt$(missedRevenue)} estimated missed
                  </p>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4 }}>
                  $28 avg add-on value per tree
                </p>
              </div>
            ) : (
              <div style={{
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: 12,
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>✓</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#166534' }}>
                    No missed add-ons this week
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#16a34a', marginTop: 2 }}>
                    Every large-container sale included an add-on.
                  </p>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Accounting reconnect warning ── */}
        {accountingNeedsReconnect && (
          <div style={{
            background: 'var(--amber-bg)',
            border: '1.5px solid var(--amber-border)',
            borderRadius: 12,
            padding: '16px',
          }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#92400e', margin: '0 0 6px' }}>
              ⚠ QuickBooks needs reconnection
            </p>
            <p style={{ fontSize: '0.875rem', color: '#b45309', lineHeight: 1.5, margin: 0 }}>
              Invoices are paused. Reconnect from the QuickBooks tile above.
            </p>
          </div>
        )}

        {/* ── Modules ── */}
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'var(--gray-400, #9ca3af)',
            textTransform: 'uppercase',
            margin: '0 0 1.5rem',
          }}>
            Your Modules
          </h2>
          <TileGrid>
            {modules.map(mod => (
              <Tile
                key={mod.key}
                id={mod.key}
                label={mod.label}
                icon={mod.icon}
                color={mod.color}
                bg={mod.bg}
                state={mod.state}
                onEnable={() => openTile(mod)}
                onNavigate={() => openTile(mod)}
                count={mod.key === 'social_media' ? socialDrafts.length : undefined}
              />
            ))}
          </TileGrid>
        </section>

        {/* ── Social Drafts ── */}
        {(socialDrafts.length > 0 || modules.find(m => m.key === 'social_media')?.state === 'active') && (
          <section style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{
                fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em',
                color: 'var(--gray-400, #9ca3af)', textTransform: 'uppercase',
                margin: 0,
              }}>
                Social Media — Ready to Post
              </h2>
              <button
                onClick={handleGeneratePosts}
                disabled={generatingPosts}
                style={{
                  background: generatingPosts ? '#e5e7eb' : 'var(--green-primary)',
                  color: generatingPosts ? 'var(--gray-600)' : '#fff',
                  border: 'none', borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: '0.8125rem', fontWeight: 600,
                  cursor: generatingPosts ? 'not-allowed' : 'pointer',
                }}
              >
                {generatingPosts ? 'Generating…' : 'Generate this week\'s posts'}
              </button>
            </div>
            {socialDrafts.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-400)', textAlign: 'center', padding: '20px 0' }}>
                No drafts yet. Generate posts from your week's sales.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {socialDrafts.map(draft => {
                // edited_text = what owner saved (may be null); original_text = immutable AI proposal
                const displayText   = draftEdits[draft.id] ?? draft.edited_text ?? draft.original_text ?? '';
                const platformLabel = PLATFORM_LABELS[draft.platform] ?? draft.platform;
                const platformUrl   = PLATFORM_URLS[draft.platform];
                const isEdited      = draft.status === 'edited' || draft.status === 'approved';
                return (
                  <div key={draft.id} style={{
                    background: '#fff',
                    border: `1.5px solid ${isEdited ? 'var(--green-primary, #27500A)' : '#e5e7eb'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                  }}>
                    {/* Platform chip + status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-block',
                          background: 'var(--sage-bg, #EAF3DE)',
                          color: 'var(--green-primary, #27500A)',
                          fontSize: '0.6875rem', fontWeight: 700,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: 6,
                        }}>
                          {platformLabel}
                        </span>
                        {isEdited && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--green-primary, #27500A)', fontWeight: 600 }}>
                            ✓ Edited
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Editable caption — original_text is the immutable AI proposal */}
                    <p style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', marginBottom: 6 }}>
                      Here's our best shot at your voice — edit it to sound like you.
                    </p>
                    <textarea
                      value={displayText}
                      onChange={e => setDraftEdits(prev => ({ ...prev, [draft.id]: e.target.value }))}
                      onBlur={e => handleSaveEdit(draft.id, e.target.value)}
                      rows={5}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        fontSize: '0.875rem', color: 'var(--gray-800)',
                        lineHeight: 1.55, padding: '10px 12px',
                        border: '1px solid #d1d5db', borderRadius: 8,
                        resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />

                    {/* Action buttons: Copy (marks done + removes) · Download (future) · Open platform */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleCopyCaption(draft.id, displayText)}
                        style={{
                          flex: 1, minWidth: 120,
                          background: copiedId === draft.id ? '#f0fdf4' : 'var(--green-primary)',
                          color: copiedId === draft.id ? '#166534' : '#fff',
                          border: copiedId === draft.id ? '1.5px solid #86efac' : 'none',
                          borderRadius: 8, padding: '10px 0',
                          fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {copiedId === draft.id ? 'Copied!' : 'Copy caption'}
                      </button>
                      <button
                        disabled
                        title="Image generation coming soon"
                        style={{
                          flex: 1, minWidth: 100,
                          background: '#f3f4f6', border: '1px solid #e5e7eb',
                          borderRadius: 8, padding: '10px 0',
                          fontSize: '0.875rem', fontWeight: 600,
                          color: '#9ca3af', cursor: 'not-allowed',
                        }}
                      >
                        Download image
                      </button>
                      {platformUrl && (
                        <a
                          href={platformUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1, minWidth: 100,
                            background: '#f9fafb', border: '1px solid #e5e7eb',
                            borderRadius: 8, padding: '10px 0',
                            fontSize: '0.875rem', fontWeight: 600,
                            color: 'var(--gray-700)', cursor: 'pointer',
                            display: 'block', textAlign: 'center',
                            textDecoration: 'none',
                          }}
                        >
                          Open {platformLabel} →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Campaign Scheduler ── */}
        <section style={{ marginTop: '0.75rem' }}>
          <div
            onClick={() => navigate('/campaigns')}
            style={{
              background: '#fff', border: campaignDraftCount > 0 ? '1.5px solid #27500A' : '1px solid #e5e7eb',
              borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                📅 Campaign Scheduler
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                {campaignDraftCount > 0
                  ? `${campaignDraftCount} post${campaignDraftCount !== 1 ? 's' : ''} ready to review`
                  : 'Plan seasonal and holiday content'}
              </p>
            </div>
            <span style={{ fontSize: '0.875rem', color: '#27500A', fontWeight: 700 }}>→</span>
          </div>
        </section>

        {/* ── Refresh ── */}
        <button
          onClick={loadMetrics}
          style={{
            background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8,
            padding: '10px 16px', fontSize: '0.875rem', color: 'var(--gray-600)', cursor: 'pointer',
          }}
        >
          Refresh data
        </button>

      </div>
    </div>
  );
}
