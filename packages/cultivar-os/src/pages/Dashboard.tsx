import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@trace/shared/components/Card';
import { supabase } from '../lib/supabase';
import { auth } from '../lib/auth';
import { DEMO_NURSERY_ID } from '../lib/constants';
import { useModules } from '../hooks/useModules';
import { TileGrid } from '@trace/shared/components/tiles/TileGrid';
import { Tile } from '@trace/shared/components/tiles/Tile';

// Configurable — will move to verticalConfig post-demo
const LEAKAGE_AVG_VALUE = 28;

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

const POST_TYPE_LABELS: Record<string, string> = {
  educational:    'Educational',
  customer_story: 'Customer Story',
  seasonal:       'Seasonal',
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = auth.useSession();
  const navigate  = useNavigate();

  const [nurseryName, setNurseryName]         = useState('LAWNS Tree Farm');
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
    content: string | null;
    platform: string;
  }

  const [socialDrafts, setSocialDrafts]       = useState<SocialDraft[]>([]);
  const [publishingId, setPublishingId]       = useState<string | null>(null);
  const [publishedIds, setPublishedIds]       = useState<Set<string>>(new Set());

  const [qbConnected, setQbConnected] = useState(false);
  const [qbCompany, setQbCompany]     = useState('');
  const [connecting, setConnecting]   = useState(false);
  const [qbError, setQbError]         = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { modules } = useModules(DEMO_NURSERY_ID);

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadMetrics() {
    setLoading(true);
    const today = todayStart();
    const week  = weekStart();

    const [nurseryRes, plantsRes, todayRes, installsRes, leakageRes] = await Promise.all([
      supabase
        .from('nurseries')
        .select('name')
        .eq('id', DEMO_NURSERY_ID)
        .single(),

      supabase
        .from('plants')
        .select('id, base_price')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .eq('status', 'available'),

      supabase
        .from('orders')
        .select('id, total_amount')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .neq('status', 'cancelled')
        .gte('created_at', today),

      supabase
        .from('orders')
        .select('id')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .eq('transport_method', 'install')
        .gte('created_at', week),

      supabase
        .from('orders')
        .select('id')
        .eq('nursery_id', DEMO_NURSERY_ID)
        .eq('leakage_flag', true)
        .gte('created_at', week),
    ]);

    if (nurseryRes.data) setNurseryName(nurseryRes.data.name);

    const plants = plantsRes.data ?? [];
    setPlantCount(plants.length);
    setInventoryValue(plants.reduce((sum, p) => sum + (p.base_price ?? 0), 0));

    const todayOrders = todayRes.data ?? [];
    setTodayOrderCount(todayOrders.length);
    setTodayRevenue(todayOrders.reduce((sum, o) => sum + ((o as any).total_amount ?? 0), 0));

    setInstalls((installsRes.data ?? []).length);
    setLeakageCount((leakageRes.data ?? []).length);

    setLoading(false);
  }

  // ── Social drafts ─────────────────────────────────────────────────────────

  async function loadSocialDrafts() {
    const { data } = await supabase
      .from('social_drafts')
      .select('id, post_type, content, platform')
      .eq('nursery_id', DEMO_NURSERY_ID)
      .eq('status', 'draft')
      .order('created_at', { ascending: true });
    setSocialDrafts((data as SocialDraft[]) ?? []);
  }

  async function handlePublish(draftId: string) {
    setPublishingId(draftId);
    try {
      const res = await fetch('/api/social/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ draft_id: draftId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPublishedIds(prev => new Set([...prev, draftId]));
        setSocialDrafts(prev => prev.filter(d => d.id !== draftId));
      } else {
        console.warn('[publish] failed:', data.reason);
      }
    } catch (err) {
      console.warn('[publish] fetch error:', err);
    } finally {
      setPublishingId(null);
    }
  }

  // ── QB helpers ────────────────────────────────────────────────────────────

  async function checkQbStatus(): Promise<boolean> {
    try {
      const res = await fetch(`/api/qbo/status?nursery_id=${DEMO_NURSERY_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setQbConnected(true);
          setQbCompany(data.companyName ?? '');
          return true;
        }
      }
    } catch { /* QB unavailable — non-fatal */ }
    return false;
  }

  async function handleConnect() {
    setConnecting(true);
    setQbError('');

    let popup: Window | null = null;
    let step = 'init';

    try {
      // Step 1 — open popup synchronously before any await (browser requires user-gesture chain)
      step = 'open-popup';
      popup = window.open('', 'qb-connect', 'width=720,height=640,left=200,top=100');

      // Step 2 — fetch OAuth URL from Vercel function
      step = 'fetch';
      const res = await fetch(`/api/qbo/auth-url?nursery_id=${DEMO_NURSERY_ID}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`[step:${step}] ` + (body.error || `Server error ${res.status}`));
      }

      // Step 3 — parse response
      step = 'parse';
      const { url } = await res.json();

      // Step 4 — validate URL is parseable before handing to browser
      step = 'validate-url';
      try { new URL(url); } catch {
        throw new Error(`[step:${step}] Malformed URL returned by server — check QBO env vars`);
      }

      // Step 5 — navigate popup (or fall back to same-tab)
      step = 'navigate';
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        window.location.href = url;
        return;
      }

      // Step 6 — poll until popup closes or QB confirms connected
      step = 'poll';
      pollingRef.current = setInterval(async () => {
        const connected = await checkQbStatus();
        if (connected) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConnecting(false);
          loadMetrics();
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
      // Prefix with step if not already tagged
      setQbError(msg.startsWith('[step:') ? msg : `[step:${step}] ${msg}`);
      setConnecting(false);
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await auth.signOut();
    navigate('/login');
  }

  function handleEnable(key: string) {
    if (key === 'social_media') {
      navigate('/social/setup');
    }
  }

  function handleNavigate(_key: string) {
    // post-demo: route to module-specific pages
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadMetrics();
    checkQbStatus();
    loadSocialDrafts();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const missedRevenue = leakageCount * LEAKAGE_AVG_VALUE;

  // ── Render ────────────────────────────────────────────────────────────────

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
            {nurseryName}
          </p>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Owner Dashboard</h1>
          {user?.email && (
            <p style={{ fontSize: '0.75rem', color: '#a8c890', marginTop: 4 }}>{user.email}</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
            padding: '8px 12px', color: '#fff', fontSize: '0.8125rem',
            fontWeight: 600, cursor: 'pointer', marginTop: 2,
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, margin: '0 auto' }}>

        {/* ── QB status banner ── */}
        {!qbConnected ? (
          <div style={{ background: '#fff', border: '2px solid var(--green-primary)', borderRadius: 12, padding: '16px' }}>
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
          <div style={{
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
        )}

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
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Plants tracked"
                  value={String(plantCount)}
                  sub={`${plantCount} available`}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Inventory value"
                  value={fmt$(inventoryValue)}
                  sub="at base price"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Today's sales"
                  value={String(todayOrderCount)}
                  sub={todayOrderCount > 0 ? `${fmt$(todayRevenue)} revenue` : 'No orders yet today'}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MetricCard
                  label="Installs this week"
                  value={String(installsThisWeek)}
                  sub={installsThisWeek === 1 ? '1 scheduled' : `${installsThisWeek} scheduled`}
                />
              </div>
            </div>

            {/* ── US-012: Leakage alert tile ── */}
            {leakageCount > 0 ? (
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
            )}
          </>
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
                label={mod.name}
                icon={mod.icon}
                color={mod.color}
                bg={mod.bg}
                state={mod.state}
                onEnable={() => handleEnable(mod.key)}
                onNavigate={() => handleNavigate(mod.key)}
                tierRequired={mod.tier_required ?? undefined}
                count={mod.key === 'social_media' ? socialDrafts.length : undefined}
              />
            ))}
          </TileGrid>
        </section>

        {/* ── Social Drafts ── */}
        {socialDrafts.length > 0 && (
          <section style={{ marginTop: '0.5rem' }}>
            <h2 style={{
              fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em',
              color: 'var(--gray-400, #9ca3af)', textTransform: 'uppercase',
              margin: '0 0 1rem',
            }}>
              Social Media — Ready to Publish
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {socialDrafts.map(draft => (
                <div key={draft.id} style={{
                  background: '#fff',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'inline-block',
                        background: 'var(--sage-bg, #EAF3DE)',
                        color: 'var(--green-primary, #27500A)',
                        fontSize: '0.6875rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: 6,
                        marginBottom: 8,
                      }}>
                        {POST_TYPE_LABELS[draft.post_type ?? ''] ?? draft.post_type ?? 'Post'}
                      </span>
                      <p style={{
                        fontSize: '0.875rem', color: 'var(--gray-800, #1f2937)',
                        lineHeight: 1.5, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {draft.content}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePublish(draft.id)}
                      disabled={publishingId === draft.id}
                      style={{
                        flexShrink: 0,
                        background: publishingId === draft.id ? '#e5e7eb' : 'var(--green-primary, #27500A)',
                        color: publishingId === draft.id ? 'var(--gray-600)' : '#fff',
                        border: 'none', borderRadius: 8,
                        padding: '10px 16px',
                        fontSize: '0.875rem', fontWeight: 600,
                        cursor: publishingId === draft.id ? 'not-allowed' : 'pointer',
                        minWidth: 90,
                      }}
                    >
                      {publishingId === draft.id ? 'Posting…' : 'Publish'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
