// ============================================================
// pages/AssetCapture — the two-door asset capture surface (/assets/capture).
// PURPOSE:  Snap or import photo(s) of physical assets → one shared pipeline
//           (compress → Vision → real cost_objects ASSET row at ESTIMATED value)
//           → manage on the datasheet. Door 1 = in-app camera; Door 2 = MULTI-select
//           device import (the majority "photographed it the old way" path). Both
//           feed captureAsset(); everything below the fork is identical. No signal →
//           held in the shared IndexedDB store + auto-drained on reconnect. Owner
//           edits a value inline here → CONFIRMED (the datasheet is the other edit
//           surface). Zero new Vercel functions (rides /api/receipts/ocr shape:'asset').
// DEPENDENCIES: useBusinessContext (businessId → RLS scope), supabase.auth (userId),
//           @trace/shared/sync SyncEngine, @trace/shared/assets (held count),
//           utils/assetCapture (captureAsset · promoteAssetValue · drainPendingAssets),
//           @trace/shared/business-logic CATEGORY_OPTS (the category VOCAB, passed as
//           a value — AC-1: no vertical noun in the shared seam).
// OUTPUTS:  cost_objects ASSET rows (node_type='ASSET'); nav back to /assets.
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Images, CloudOff, CheckCircle2, Loader2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { SyncEngine } from '@trace/shared/sync';
import { countPendingAssets } from '@trace/shared/assets';
import { CATEGORY_OPTS } from '@trace/shared/business-logic';
import {
  captureAsset, promoteAssetValue, drainPendingAssets,
  type CaptureCtx, type CaptureOutcome,
} from '../utils/assetCapture';

type Confidence = 'ESTIMATED' | 'CONFIRMED' | 'UNKNOWN' | 'HELD';
interface Row extends CaptureOutcome { confidence: Confidence; }

// The category vocabulary is Cultivar's, passed as a value into the vertical-agnostic
// OCR seam (AC-1). A different vertical would pass its own list here.
const CATEGORY_HINT = CATEGORY_OPTS.join(', ');

export function AssetCapture() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [userId, setUserId]   = useState<string | null>(null);
  const [online, setOnline]   = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [held, setHeld]       = useState(0);                 // captures waiting to sync
  const [rows, setRows]       = useState<Row[]>([]);         // this session's captures
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const camRef  = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve WHO is capturing (identity stamp rides each row).
  useEffect(() => {
    let live = true;
    void supabase.auth.getUser().then(({ data }) => { if (live) setUserId(data.user?.id ?? null); });
    return () => { live = false; };
  }, []);

  // One engine per (business); queue persisted by (businessId, domain).
  const engine = useMemo(
    () => (businessId ? new SyncEngine({ supabase, businessId, userId, domain: 'asset-capture' }) : null),
    [businessId, userId],
  );

  const ctx = (): CaptureCtx | null =>
    engine && businessId ? { engine, businessId, userId, online } : null;

  // Drain held captures on mount + on reconnect; keep online + held count reactive.
  useEffect(() => {
    if (!businessId || !engine) return;
    const refreshHeld = async () => { setHeld(await countPendingAssets(businessId)); };
    const run = async () => {
      const c: CaptureCtx = { engine, businessId, userId, online: navigator.onLine !== false };
      await drainPendingAssets(c, CATEGORY_HINT);
      await refreshHeld();
    };
    void run();
    const onOnline  = () => { setOnline(true); void run(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [businessId, engine, userId]);

  async function handleFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    const c = ctx();
    if (!c) { setError('Still loading your business — try again in a moment.'); return; }
    setError(null);
    setProgress({ done: 0, total: files.length });
    for (const f of files) {
      try {
        const out = await captureAsset(f, { ...c, online: navigator.onLine !== false }, CATEGORY_HINT);
        const confidence: Confidence =
          out.status === 'held' ? 'HELD' : out.estimatedValue !== null ? 'ESTIMATED' : 'UNKNOWN';
        setRows(prev => [{ ...out, confidence }, ...prev]);
        if (out.error) setError(out.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Capture failed');
      }
      setProgress(p => (p ? { ...p, done: p.done + 1 } : null));
    }
    setProgress(null);
    setHeld(await countPendingAssets(businessId!));
  }

  // Owner edits a value inline → CONFIRMED (the explicit owner-edit action).
  async function commitValue(id: string, raw: string) {
    const v = parseFloat(raw);
    if (!isFinite(v) || v <= 0) return;
    const c = ctx();
    if (!c) return;
    const err = await promoteAssetValue(c, id, v);
    if (err) { setError(err); return; }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, estimatedValue: v, confidence: 'CONFIRMED' } : r)));
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/assets')} aria-label="Back to assets">
          <ArrowLeft size={22} color="#27500A" />
        </button>
        <h1 style={S.title}>Capture assets</h1>
        <div style={{ flex: 1 }} />
        {!online && <span style={S.offline}><CloudOff size={15} /> Offline</span>}
        {held > 0 && <span style={S.heldPill}><Clock size={13} /> {held} to sync</span>}
      </div>

      {/* Two doors → one pipeline */}
      <div style={S.doors}>
        <button style={S.door} onClick={() => camRef.current?.click()} disabled={!!progress}>
          <Camera size={26} color="#27500A" />
          <span style={S.doorLabel}>Take photo</span>
          <span style={S.doorSub}>Snap it now</span>
        </button>
        <button style={S.door} onClick={() => fileRef.current?.click()} disabled={!!progress}>
          <Images size={26} color="#27500A" />
          <span style={S.doorLabel}>Import photos</span>
          <span style={S.doorSub}>Pick from your phone</span>
        </button>
      </div>
      <input ref={camRef}  type="file" accept="image/*" capture="environment"
             style={{ display: 'none' }} onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/*" multiple
             style={{ display: 'none' }} onChange={e => { void handleFiles(e.target.files); e.target.value = ''; }} />

      {progress && (
        <div style={S.progress}>
          <Loader2 size={16} className="spin" /> Reading photo {progress.done + 1} of {progress.total}…
        </div>
      )}
      {error && <div style={S.error}>{error}</div>}

      {rows.length === 0 && !progress ? (
        <div style={S.empty}>
          Snap or import an asset photo — we’ll identify it and estimate its worth.
          You can fix the value here, then manage everything on the assets sheet.
        </div>
      ) : (
        <div style={S.list}>
          {rows.map(r => (
            <div key={r.id} style={S.item}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.itemName}>{r.name}</div>
                <div style={S.itemMeta}>
                  {r.category ?? 'uncategorized'}
                  {r.visionConfidence ? ` · vision: ${r.visionConfidence.toLowerCase()}` : ''}
                </div>
              </div>
              {r.confidence === 'HELD' ? (
                <span style={S.badgeHeld}><Clock size={12} /> held</span>
              ) : (
                <div style={S.valueBox}>
                  <span style={S.dollar}>$</span>
                  <input
                    style={S.valueInput}
                    type="number" inputMode="decimal" min="0" step="1"
                    defaultValue={r.estimatedValue ?? ''}
                    placeholder="value"
                    onBlur={e => { void commitValue(r.id, e.target.value); }}
                  />
                  <span style={r.confidence === 'CONFIRMED' ? S.badgeConfirmed : S.badgeEstimated}>
                    {r.confidence === 'CONFIRMED' ? <><CheckCircle2 size={12} /> confirmed</> : 'estimated'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <button style={S.doneBtn} onClick={() => navigate('/assets')}>Done — view assets</button>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const S = {
  page:   { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 } as React.CSSProperties,
  backBtn:{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  title:  { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  offline:{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#92400e', background: '#fef3c7', borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600 } as React.CSSProperties,
  heldPill:{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fff', background: '#27500A', borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700 } as React.CSSProperties,
  doors:  { display: 'flex', gap: 12, marginBottom: 14 } as React.CSSProperties,
  door:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: '#fff', border: '1.5px solid #27500A', borderRadius: 12, padding: '18px 10px', cursor: 'pointer' } as React.CSSProperties,
  doorLabel:{ fontSize: '0.95rem', fontWeight: 700, color: '#1a2e0a' } as React.CSSProperties,
  doorSub:{ fontSize: '0.75rem', color: '#6b7280' } as React.CSSProperties,
  progress:{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 12, color: '#1a2e0a', fontWeight: 600 } as React.CSSProperties,
  error:  { background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: '0.85rem' } as React.CSSProperties,
  empty:  { background: '#fff', borderRadius: 12, padding: '28px 20px', color: '#6b7280', textAlign: 'center', lineHeight: 1.5 } as React.CSSProperties,
  list:   { display: 'flex', flexDirection: 'column', gap: 8 } as React.CSSProperties,
  item:   { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '10px 12px' } as React.CSSProperties,
  itemName:{ fontSize: '0.95rem', fontWeight: 600, color: '#1a2e0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as React.CSSProperties,
  itemMeta:{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 } as React.CSSProperties,
  valueBox:{ display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties,
  dollar: { color: '#6b7280', fontSize: '0.9rem' } as React.CSSProperties,
  valueInput:{ width: 74, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', textAlign: 'right' } as React.CSSProperties,
  badgeEstimated:{ fontSize: '0.68rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 12, padding: '2px 8px' } as React.CSSProperties,
  badgeConfirmed:{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 12, padding: '2px 8px' } as React.CSSProperties,
  badgeHeld:{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', fontWeight: 700, color: '#374151', background: '#e5e7eb', borderRadius: 12, padding: '2px 8px' } as React.CSSProperties,
  doneBtn:{ width: '100%', minHeight: 48, marginTop: 16, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
};
