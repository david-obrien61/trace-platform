import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase/client';
import type { VerticalStepProps } from '../auth/OwnerSignup';
import type { BusinessDiscoveryProfile } from './types';
import type { Discrepancy } from './compare';

// Fields whose site value can be written straight back to the businesses row (owner RLS UPDATE).
// Other compare fields (location/services/hours/yearsInBusiness) have no businesses column, so we
// surface the question but never offer a write that would silently no-op.
const WRITABLE_COLUMN: Record<string, string> = {
  businessName: 'name',
  address:      'address',
  phone:        'phone',
  email:        'email',
};

type SeedStatus = 'idle' | 'running' | 'done' | 'error';

export interface DiscoveryGlimpseProps extends VerticalStepProps {
  discoveryEndpoint: string;   // e.g. '/api/discovery/ingest'
  vertical: string;
  primaryColor?: string;
  // Shown immediately while live analysis runs (vertical-specific seed data)
  seedInsights?: string[];
}

type Phase = 'loading_biz' | 'no_website' | 'analyzing' | 'done' | 'error';

const STAGES = [
  'Reading your website…',
  'Identifying your services…',
  'Spotting pricing signals…',
  'Mapping your service area…',
  'Finding upsell opportunities…',
  'Wrapping up your profile…',
];

export function DiscoveryGlimpse({
  businessId,
  onNext,
  discoveryEndpoint,
  vertical,
  primaryColor = '#27500A',
  seedInsights = [],
}: DiscoveryGlimpseProps) {
  const [phase, setPhase]         = useState<Phase>('loading_biz');
  const [website, setWebsite]     = useState('');
  const [websiteInput, setWebsiteInput] = useState('');
  const [stageIdx, setStageIdx]   = useState(0);
  const [profile, setProfile]     = useState<BusinessDiscoveryProfile | null>(null);
  const [errMsg, setErrMsg]       = useState('');
  // Entered-vs-site conflicts surfaced by the reveal (capability 1.1). resolved holds the fields
  // the owner has already addressed (kept-mine or used-site) so each conflict shows once.
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [resolved, setResolved]   = useState<Record<string, 'kept' | 'updated'>>({});
  // Catalog seed (capability 1.3) — fired in the foreground once the reveal lands.
  const [seedStatus, setSeedStatus]   = useState<SeedStatus>('idle');
  const [seedInserted, setSeedInserted] = useState(0);
  const [seedFlagged, setSeedFlagged] = useState(0);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisStarted = useRef(false);
  const seedStarted = useRef(false);

  // Step 1: load business.website
  useEffect(() => {
    async function loadWebsite() {
      const { data } = await supabase
        .from('businesses')
        .select('website')
        .eq('id', businessId)
        .maybeSingle();
      const url = data?.website?.trim() ?? '';
      if (url) {
        setWebsite(url);
        startAnalysis(url);
      } else {
        setPhase('no_website');
      }
    }
    loadWebsite();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  function startAnalysis(url: string) {
    if (analysisStarted.current) return;
    analysisStarted.current = true;
    setPhase('analyzing');
    console.info('[TRACE:DISCOVERY] run', { businessId, url, vertical });

    stageTimer.current = setInterval(() => {
      setStageIdx(i => {
        if (i >= STAGES.length - 1) {
          if (stageTimer.current) clearInterval(stageTimer.current);
          return i;
        }
        return i + 1;
      });
    }, 5000);

    // Pass businessId so the endpoint persists the result (seedServiceOfferings,
    // ingest.ts:171). Without it the analysis ran but nothing was saved.
    fetch(discoveryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, vertical, businessId }),
    })
      .then(async r => ({ ok: r.ok, data: await r.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (stageTimer.current) clearInterval(stageTimer.current);
        // FAIL LOUD: only a real profile counts as success. A non-2xx response,
        // an {error} body, or a missing profile is surfaced honestly as 'error'
        // — never canned seedInsights dressed up as "what we found".
        if (ok && data?.profile) {
          setProfile(data.profile);
          const found: Discrepancy[] = Array.isArray(data.discrepancies) ? data.discrepancies : [];
          setDiscrepancies(found);
          setPhase('done');
          console.info('[TRACE:DISCOVERY] success', {
            businessId, seeded: data.seeded ?? 0,
            strengths: data.profile?.strengths?.length ?? 0,
            conflicts: found.length,
          });
          if (found.length) {
            console.info('[TRACE:DISCOVERY] conflict', { businessId, fields: found.map(d => d.field) });
          }
          // Seed the catalog from the live site in the foreground (capability 1.3).
          startSeed(url);
        } else {
          const msg = data?.error || 'We couldn’t read your website automatically.';
          setErrMsg(msg);
          setPhase('error');
          console.warn('[TRACE:DISCOVERY] failure', { businessId, ok, error: msg });
        }
      })
      .catch(err => {
        if (stageTimer.current) clearInterval(stageTimer.current);
        setErrMsg('We couldn’t reach the analysis service.');
        setPhase('error');
        console.warn('[TRACE:DISCOVERY] failure (network)', { businessId, error: String(err?.message ?? err) });
      });
  }

  useEffect(() => () => { if (stageTimer.current) clearInterval(stageTimer.current); }, []);

  // Seed the new business's catalog FROM their live site (capability 1.3). Foreground, in-session
  // (NOT the deferred scrape-while-away path) — fires once the reveal lands so the dashboard is
  // alive on arrival. Routed through the existing discovery endpoint (action=populate). Non-fatal:
  // a failure just leaves the empty dashboard, surfaced honestly, never blocks "Open my dashboard".
  function startSeed(url: string) {
    if (seedStarted.current || !url) return;
    seedStarted.current = true;
    setSeedStatus('running');
    console.info('[TRACE:ONBOARD] seed fired', { businessId, url });
    fetch(discoveryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'populate', businessId, url }),
    })
      .then(async r => ({ ok: r.ok, data: await r.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (ok && data?.ok) {
          setSeedInserted(data.inserted ?? 0);
          setSeedFlagged(data.flaggedInserted ?? 0);
          setSeedStatus('done');
          console.info('[TRACE:ONBOARD] seed done', { businessId, inserted: data.inserted ?? 0, flagged: data.flaggedInserted ?? 0 });
        } else {
          setSeedStatus('error');
          console.warn('[TRACE:ONBOARD] seed failed', { businessId, error: data?.error ?? 'unknown' });
        }
      })
      .catch(err => {
        setSeedStatus('error');
        console.warn('[TRACE:ONBOARD] seed failed (network)', { businessId, error: String(err?.message ?? err) });
      });
  }

  // Resolve one entered-vs-site conflict. 'updated' writes the site value back to the businesses
  // row (owner RLS UPDATE — NOT the signUp/insert path); 'kept' simply dismisses (entered wins).
  // Only WRITABLE_COLUMN fields offer the update; the owner always chooses — we never auto-correct.
  async function resolveConflict(d: Discrepancy, useSite: boolean) {
    const col = WRITABLE_COLUMN[d.field];
    if (useSite && col && d.site) {
      const { error } = await supabase.from('businesses').update({ [col]: d.site }).eq('id', businessId);
      if (error) {
        console.warn('[TRACE:DISCOVERY] conflict update ERROR', { businessId, field: d.field, error: error.message });
        return;
      }
    }
    setResolved(r => ({ ...r, [d.field]: useSite ? 'updated' : 'kept' }));
    console.info('[TRACE:DISCOVERY] conflict resolved', { businessId, field: d.field, choice: useSite ? 'updated' : 'kept' });
  }

  const green = primaryColor;
  const openConflicts = discrepancies.filter(d => !resolved[d.field]);

  // ── Render phases ────────────────────────────────────────────────────────────

  if (phase === 'loading_biz') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '0.9rem' }}>
        Loading…
      </div>
    );
  }

  if (phase === 'no_website') {
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 800, color: green }}>
          Analyze your website
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: '#555', lineHeight: 1.5 }}>
          Enter your business website and we'll show you a quick analysis — services found,
          pricing signals, and where Cultivar OS can help most.
        </p>
        <input
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px',
            border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '1rem',
            fontFamily: 'inherit', outline: 'none', marginBottom: 12,
          }}
          type="url"
          placeholder="https://yoursite.com"
          value={websiteInput}
          onChange={e => setWebsiteInput(e.target.value)}
        />
        {errMsg && <p style={{ color: '#A32D2D', fontSize: '0.8rem', marginBottom: 8 }}>{errMsg}</p>}
        <button
          onClick={() => {
            const url = websiteInput.trim();
            if (!url || !url.startsWith('http')) {
              setErrMsg('Enter a full URL starting with https://');
              return;
            }
            setErrMsg('');
            setWebsite(url);
            startAnalysis(url);
          }}
          style={{
            width: '100%', padding: '13px 0', background: green, color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem',
            cursor: 'pointer', marginBottom: 8,
          }}
        >
          Analyze my site →
        </button>
        <button
          onClick={onNext}
          style={{
            width: '100%', padding: '10px 0', background: 'none', border: 'none',
            color: '#888', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          Skip for now →
        </button>
      </div>
    );
  }

  // Honest failure: never show canned seedInsights as findings. Offer manual entry.
  if (phase === 'error') {
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 800, color: green }}>
          We couldn’t analyze your site
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#555', lineHeight: 1.5 }}>
          {errMsg || 'We couldn’t read your website automatically.'} You can try a different
          URL, or skip and add your details in the dashboard — nothing is lost.
        </p>
        <input
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px',
            border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '1rem',
            fontFamily: 'inherit', outline: 'none', marginBottom: 12,
          }}
          type="url"
          placeholder="https://yoursite.com"
          value={websiteInput}
          onChange={e => setWebsiteInput(e.target.value)}
        />
        <button
          onClick={() => {
            const url = websiteInput.trim();
            if (!url || !url.startsWith('http')) { setErrMsg('Enter a full URL starting with https://'); return; }
            setErrMsg('');
            analysisStarted.current = false; // allow a retry
            setStageIdx(0);
            setWebsite(url);
            startAnalysis(url);
          }}
          style={{
            width: '100%', padding: '13px 0', background: green, color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem',
            cursor: 'pointer', marginBottom: 8,
          }}
        >
          Try again →
        </button>
        <button
          onClick={onNext}
          style={{
            width: '100%', padding: '10px 0', background: 'none', border: 'none',
            color: '#888', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          Skip — I’ll add details later →
        </button>
      </div>
    );
  }

  if (phase === 'analyzing') {
    const insights = seedInsights.length > 0 ? seedInsights : [
      'Reading your services and pricing signals…',
      'Mapping your market position…',
      'Finding revenue opportunities…',
    ];
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 800, color: green }}>
          Analyzing your business
        </h2>
        <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#888' }}>{website}</p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: '#f0f7e8', borderRadius: 10, marginBottom: 20,
        }}>
          <Spinner color={green} />
          <span style={{ fontSize: '0.875rem', color: '#555', fontStyle: 'italic' }}>
            {STAGES[stageIdx]}
          </span>
        </div>

        <p style={{
          margin: '0 0 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#777',
        }}>
          What we look for
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {insights.map((insight, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 10, padding: '12px 14px',
              border: '1px solid #e5e7eb', fontSize: '0.875rem', color: '#333',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ color: green, fontSize: '1rem', flexShrink: 0 }}>◉</span>
              {insight}
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.75rem', color: '#aaa', textAlign: 'center', marginBottom: 12 }}>
          Live analysis in progress — this takes about 30 seconds.
        </p>
        <button
          onClick={onNext}
          style={{
            width: '100%', padding: '10px 0', background: 'none', border: 'none',
            color: '#888', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          Continue to dashboard →
        </button>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  // Real analysis only. We reach 'done' solely when a real profile came back, so
  // there is no canned fallback here — a failed analysis lands on 'error' instead.
  const strengths = profile?.strengths ?? [];
  const gaps      = profile?.gaps      ?? [];

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800, color: green }}>
        Here's what we found
      </h2>
      {website && (
        <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#888' }}>{website}</p>
      )}

      {/* Entered-vs-site conflicts (capability 1.1). Silent-partner tone — we ask, we never
          assert which value is right. The owner picks; "Use site value" writes it back. */}
      {openConflicts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{
            margin: '0 0 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#b45309',
          }}>
            A couple of things to confirm
          </p>
          {openConflicts.map((d) => (
            <div key={d.field} style={{
              background: '#fff7ed', border: '1px solid #fcd34d', borderRadius: 10,
              padding: '12px 14px', marginBottom: 10,
            }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.875rem', color: '#7c2d12', lineHeight: 1.45 }}>
                {d.message}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, fontSize: '0.8125rem', color: '#555' }}>
                <span>You entered: <strong style={{ color: '#333' }}>{d.entered ?? '—'}</strong></span>
                <span>Your site lists: <strong style={{ color: '#333' }}>{d.site ?? '—'}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {WRITABLE_COLUMN[d.field] && d.site && (
                  <button
                    onClick={() => resolveConflict(d, true)}
                    style={{
                      flex: 1, padding: '9px 0', background: green, color: '#fff', border: 'none',
                      borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                    }}
                  >
                    Use site value
                  </button>
                )}
                <button
                  onClick={() => resolveConflict(d, false)}
                  style={{
                    flex: 1, padding: '9px 0', background: '#fff', color: '#555',
                    border: '1.5px solid #e5e7eb', borderRadius: 8, fontWeight: 600,
                    fontSize: '0.8125rem', cursor: 'pointer',
                  }}
                >
                  Keep mine
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {strengths.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{
            margin: '0 0 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#777',
          }}>
            Strengths
          </p>
          {strengths.map((s, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 12px', marginBottom: 6,
              background: '#f0f7e8', borderRadius: 8,
              fontSize: '0.875rem', color: '#333', lineHeight: 1.4,
            }}>
              <span style={{ color: green, flexShrink: 0 }}>✓</span>{s}
            </div>
          ))}
        </div>
      )}

      {gaps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{
            margin: '0 0 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#777',
          }}>
            Opportunities
          </p>
          {gaps.slice(0, 3).map((g, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 12px', marginBottom: 6,
              background: '#fff7ed', borderRadius: 8,
              fontSize: '0.875rem', color: '#333', lineHeight: 1.4,
            }}>
              <span style={{ color: '#d97706', flexShrink: 0 }}>→</span>{g}
            </div>
          ))}
        </div>
      )}

      {profile?.suggestedOfferings && profile.suggestedOfferings.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 10, padding: '12px 14px',
          border: `1.5px solid ${green}30`, marginBottom: 20,
        }}>
          <p style={{
            margin: '0 0 8px', fontSize: '0.7rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: green,
          }}>
            Suggested in Cultivar OS
          </p>
          {profile.suggestedOfferings.slice(0, 2).map((o, i) => (
            <p key={i} style={{ margin: '0 0 4px', fontSize: '0.875rem', color: '#333', lineHeight: 1.4 }}>
              <strong>{o.name}</strong> — {o.description}
            </p>
          ))}
        </div>
      )}

      {/* Catalog seed status (capability 1.3) — honest about what was stocked; never blocks. */}
      {seedStatus !== 'idle' && (
        <p style={{
          fontSize: '0.8125rem', textAlign: 'center', marginBottom: 12, lineHeight: 1.5,
          color: seedStatus === 'error' ? '#b45309' : '#555',
        }}>
          {seedStatus === 'running' && 'Stocking your dashboard from your site…'}
          {seedStatus === 'done' && (seedInserted > 0
            ? `Added ${seedInserted} item${seedInserted !== 1 ? 's' : ''} to your inventory${seedFlagged > 0 ? ` · ${seedFlagged} flagged for review` : ''}.`
            : 'Your dashboard is ready — add inventory any time.')}
          {seedStatus === 'error' && 'We couldn’t auto-stock your catalog — add inventory from the dashboard any time.'}
        </p>
      )}

      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '14px 0', background: green, color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem',
          cursor: 'pointer',
        }}
      >
        Open my dashboard →
      </button>
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
