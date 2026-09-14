import { useState, useEffect } from 'react';
import { CHANNEL_COLUMNS, type Channel } from '@trace/shared/business-logic/channelVocabulary';
import { authHeaders } from '@trace/shared/auth';
import { useNavigate } from 'react-router-dom';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '../lib/supabase';

const SM_DEBUG = false;

// LEXICON: "platform" is reserved for the top-level TRACE substrate.
// Channels, not platforms, are what the owner enables here.

// 🔴 `SOCIAL_CHANNELS` WAS HERE AND IS DELETED (ledger #310, R-150).
//
// It was a hardcoded list of four channels plus a hardcoded `sms`, and it was the THIRD copy of one
// vocabulary — the one that was updated on 8 June when `campaign_posts`' CHECK was not, which is how
// this screen came to offer tiktok and twitter while the table that stores the generated post
// forbade them. Every post insert died on an atomic batch and `campaign_posts` stayed empty on every
// tenant for three months.
//
// The list now comes from `public.channels`. Adding a channel is a ROW, and this screen learns about
// it without being edited. It also means EMAIL appears here for the first time — it was in the
// database's vocabulary and in no UI, so nothing could ever produce it.

const CADENCE_OPTIONS = [
  { key: 'weekly',     label: 'Weekly',              description: 'One good post, once a week — research says consistent‑and‑modest beats high‑volume.' },
  { key: 'few_times',  label: 'A few times a week',  description: '2–3 posts per week. Works well if you have active sales to talk about.' },
  { key: 'on_demand',  label: "I'll decide each time", description: "Generate whenever you're ready. No automatic cadence." },
] as const;

type CadenceKey = typeof CADENCE_OPTIONS[number]['key'];

interface ChannelEntry {
  type:    string;   // 'social' | 'sms'
  name:    string;
  enabled: boolean;
}

/**
 * The starting state for a tenant that has never saved: every channel the table knows, all OFF
 * except instagram. Derived from the catalog, so a channel added by migration is offered here with
 * no code change — which is the whole point of the pass.
 */
function defaultChannels(catalog: Channel[]): ChannelEntry[] {
  return catalog.map(c => ({ type: c.kind, name: c.name, enabled: c.name === 'instagram' }));
}

/**
 * Reconcile what the tenant saved against what the table currently offers.
 *
 * BOTH directions matter and neither is hypothetical: a channel the table has gained is offered
 * (OFF — a new channel is never silently switched on for somebody), and a name the table no longer
 * has is DROPPED rather than rendered as a checkbox that the save trigger would then reject.
 */
function reconcile(catalog: Channel[], saved: ChannelEntry[]): ChannelEntry[] {
  return catalog.map(c => {
    const prior = saved.find(s => s.name === c.name);
    return { type: c.kind, name: c.name, enabled: prior?.enabled ?? false };
  });
}

export function SocialSetup() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  useEffect(() => {
    if (SM_DEBUG) console.log('[SM-TRACE] SocialSetup MOUNTED — businessId:', businessId);
    return () => { if (SM_DEBUG) console.log('[SM-TRACE] SocialSetup UNMOUNTED'); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (SM_DEBUG) console.log('[SM-TRACE] businessId updated →', businessId); }, [businessId]);

  const [channels, setChannels] = useState<ChannelEntry[]>(defaultChannels());
  const [cadence, setCadence]   = useState<CadenceKey>('weekly');
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [catalog, setCatalog]   = useState<Channel[]>([]);
  const [error, setError]       = useState('');

  // Load the CATALOG and the tenant's config together. The catalog is the vocabulary; the config is
  // only which of those are on. A refused or empty catalog read leaves NOTHING to offer, and the
  // screen says so rather than falling back to a hardcoded list — falling back is how the stale copy
  // survived three months.
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    void (async () => {
      const [{ data: cat, error: catErr }, { data: mod }] = await Promise.all([
        supabase.from('channels').select(CHANNEL_COLUMNS).eq('active', true).order('sort_order'),
        supabase.from('business_modules').select('config')
          .eq('business_id', businessId).eq('module_key', 'social_media').maybeSingle(),
      ]);
      if (cancelled) return;

      if (catErr || !cat || cat.length === 0) {
        setError('Could not load the channel list. Nothing is shown rather than a guess — tell David.');
        setLoading(false);
        return;
      }
      const cl = cat as unknown as Channel[];
      setCatalog(cl);

      const saved = mod?.config?.advert_channels as ChannelEntry[] | undefined;
      setChannels(saved ? reconcile(cl, saved) : defaultChannels(cl));
      if (mod?.config?.cadence) setCadence(mod.config.cadence as CadenceKey);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  function toggleChannel(name: string) {
    setChannels(prev =>
      prev.map(c => c.name === name ? { ...c, enabled: !c.enabled } : c),
    );
  }

  // Grouped by the table's `kind`, not by a list in this file. A new kind gets its own section for
  // free; `direct` is every channel the owner sends to a person rather than posts to a feed.
  const socialCatalog = catalog.filter(c => c.kind === 'social');
  const directCatalog = catalog.filter(c => c.kind !== 'social');
  const enabledOf     = (name: string) => channels.find(c => c.name === name)?.enabled ?? false;

  async function handleSave() {
    const hasEnabled = channels.some(c => c.enabled);
    if (!hasEnabled) {
      setError('Enable at least one channel.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/social/enable', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body:    JSON.stringify({ business_id: businessId!, advert_channels: channels, cadence }),
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
        <div>
          <p style={{ fontSize: '0.6875rem', color: '#a8c890', marginBottom: 2, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
            Social Media
          </p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Post Settings</h1>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--gray-500)' }}>Loading…</div>
      ) : (
        <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* What this does */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--gray-800)', marginBottom: 8 }}>
              Ready-to-post updates from your sales
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', lineHeight: 1.6, margin: 0 }}>
              TRACE writes captions based on your real sales each week, formatted for each channel.
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

          {/* Social channels */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Social channels
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {socialCatalog.map(({ name, label, guidance }) => {
                const checked = enabledOf(name);
                return (
                  <div key={name}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: checked ? 6 : 0 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChannel(name)}
                        style={{ width: 18, height: 18, accentColor: 'var(--green-primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--gray-800)' }}>
                        {label}
                      </span>
                    </label>
                    {checked && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.4, margin: '0 0 0 30px' }}>
                        {guidance}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', lineHeight: 1.5, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              These are general guidelines — your audience may differ.
              Consistency matters more than volume.
            </p>
          </div>

          {/* ── DIRECT channels — SMS and EMAIL, both driven by the table ──────────────────────
              🔴 THE COPY HERE IS DELIBERATE AND MUST NOT SOFTEN (R-150). It says TRACE DRAFTS and the
              OWNER SENDS, in the present tense, because that is what happens and what will keep
              happening. It must never hint that TRACE will one day do the sending, nor promise any
              such feature as forthcoming. TRACE prepares; the owner decides. That is the design,
              not an unfinished version of one — and it is why email needs no consent model: the owner
              is the sender, from their own mail, to people they already write to. */}
          {directCatalog.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              You send these yourself
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {directCatalog.map(dc => (
              <label key={dc.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enabledOf(dc.name)}
                  onChange={() => toggleChannel(dc.name)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--green-primary)', cursor: 'pointer' }}
                />
                <div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--gray-800)', margin: '0 0 4px' }}>
                    {dc.kind === 'email' ? 'Email drafts' : `${dc.label} drafts`}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.4, margin: 0 }}>
                    {dc.kind === 'email'
                      ? 'TRACE writes a subject line and a body alongside your social posts, ready to copy into your own email and send. You send it; TRACE doesn\u2019t.'
                      : 'TRACE writes a short message alongside your social posts \u2014 ready to copy and send to your customer list. You send it; TRACE doesn\u2019t.'}
                  </p>
                </div>
              </label>
            ))}
            </div>
          </div>
          )}

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
      )}
    </div>
  );
}
