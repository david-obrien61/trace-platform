// ============================================================
// InventoryCount — the walk-and-count loop (scan → resolve → qty → save → next → complete).
// PURPOSE:  Lauren walks the lot, scans a plant tag QR, the app strips the URL and
//           resolves the item, she enters the counted qty, Save→Next reopens the
//           camera; Complete ends the session. One item at a time, full focus (D-21).
//           SOMETIMES-CONNECTED: every write routes through the shared SyncEngine —
//           write-through when online, queue when offline (back-acre dead zones,
//           ledger #54), drain on reconnect. A Save never fails in a dead zone.
// DEPENDENCIES: QrScanner (jsQR camera), business_inventory (on-hand qty), cultivar_plants
//           (tag→identity→lot), inventory_count_sessions + inventory_counts (durable record,
//           gated migration 20260626 — degrades gracefully if not yet applied),
//           @trace/shared/sync SyncEngine (offline durability + reconnect drain),
//           @trace/shared/utils/canonicalName (the token-set canonical key — L4 resolve).
// RESOLVE:  layered, most-specific → least (grower-resolve design 2026-06-26):
//           L1 cultivar_plants.tag_id exact → L2 business_inventory.sku exact →
//           L3 stored product-slug exact (DEFERRED, no column yet) →
//           L4 NAME token-set EQUALITY (scan slug tokens == catalog name tokens, order-
//           insensitive — fixes the discovery-catalog false-UNKNOWN, e.g. vitex-shoal-creek
//           ↔ "Shoal Creek Vitex") → L5 SIZE-PICKER (NEED_CLARIFICATION): when L4 returns
//           >1 row that are the SAME variety in different sizes (one non-null variant_group,
//           each a distinct size), surface a size choice instead of collapsing to UNKNOWN —
//           the count then routes to the chosen per-size row. A genuinely ambiguous >1
//           (mixed/empty variant_group) still falls to UNKNOWN. Stemming (L6) deferred.
//           [TRACE:RESOLVE] shows the layer hit; [TRACE:COUNT] shows the size collision + pick.
// OUTPUTS:  SETS business_inventory.qty for the resolved lot; records each count in
//           inventory_counts under a session, identity-stamped (who + when via the
//           envelope userId + session.counted_by). Surfaces a same-lot-twice-in-session
//           recount as a conflict (sale / miscount / moved) — never silent overwrite.
//           [TRACE:COUNT] on every step; [TRACE:SYNC] on the queue.
// SCOPE:    count loop ONLY. Reconciliation (counted vs expected) is DEFERRED.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, X, ScanLine, CloudOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { SyncEngine } from '@trace/shared/sync';
import { nameTokenSet, tokenSetsEqual } from '@trace/shared/utils/canonicalName';
import { QrScanner } from '../components/inventory/QrScanner';

const TRACE_COUNT = true; // [TRACE:COUNT] STD-003 — on until OWNER-PROVEN
const TRACE_RESOLVE = true; // [TRACE:RESOLVE] STD-003 — which resolver layer hit; on until OWNER-PROVEN

type Phase = 'idle' | 'scanning' | 'reviewing' | 'unknown' | 'picker' | 'conflict' | 'done';

interface Resolved {
  inventoryId: string | null;   // the business_inventory lot to set qty on (null = no linked lot)
  plantTagId:  string | null;   // the scanned cultivar_plants.tag_id, if resolved via a plant tag
  label:       string;          // "Shoal Creek Vitex, 30 gal"
  currentQty:  number | null;   // current on-hand (prefilled into the qty input)
  rawScan:     string;          // the raw decoded string, for the count record
}

// A single business_inventory candidate row (the L4 token-set match shape).
interface InvRow {
  id: string; name: string; sku: string | null; qty: number | null;
  size: string | null; variant_group: string | null;
}

// A sibling size offered by the L5 picker — the chosen one resolves to its row.
interface SizeCandidate { size: string; resolved: Resolved; }

interface CountedItem { label: string; qty: number; unknown: boolean; }

// A same-lot-twice-in-session recount — surfaced, never silently overwritten.
interface Conflict { key: string; label: string; prevQty: number; newQty: number; }

// Scanned QR holds a URL like https://…/plant/SCV-0031 — strip the URL, keep the tag.
function extractTag(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/\/plant\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  // Not a /plant/ URL — if it's any other URL, take the last path segment; else use as-is.
  try {
    const u = new URL(trimmed);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length) return decodeURIComponent(segs[segs.length - 1]);
  } catch { /* not a URL — a bare code */ }
  return trimmed;
}

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST204') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the table');
}

// The within-session dedup key for a counted lot. A count session is one device,
// one walk → "already counted this lot this session" lives in client state (no
// DB read, no schema change).
function lotKey(r: Resolved): string | null {
  if (r.inventoryId) return `inv:${r.inventoryId}`;
  if (r.plantTagId)  return `tag:${r.plantTagId}`;
  return null;
}

// L5 NEED_CLARIFICATION discriminator: are these >1 token-equal matches the SAME
// variety in different SIZES (→ size-picker), or a genuinely ambiguous collision
// (→ UNKNOWN)? Size collision ⟺ every match carries the SAME non-null variant_group
// AND each carries a DISTINCT non-empty size. Any mixed/missing variant_group, any
// missing/duplicate size → NOT a size collision (surface-don't-presume → UNKNOWN).
function detectSizeCollision(matches: InvRow[]): boolean {
  if (matches.length < 2) return false;
  const group = matches[0].variant_group;
  if (group == null || group.trim() === '') return false;       // group must be set…
  if (!matches.every(m => m.variant_group === group)) return false; // …and shared by all
  const sizes = matches.map(m => (m.size ?? '').trim());
  if (sizes.some(s => s === '')) return false;                  // every row needs a size
  return new Set(sizes).size === matches.length;                // all distinct
}

export function InventoryCount() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [phase, setPhase]         = useState<Phase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tablesAbsent, setTablesAbsent] = useState(false); // migration not yet applied — degrade
  const [resolved, setResolved]   = useState<Resolved | null>(null);
  const [qtyInput, setQtyInput]   = useState('');
  const [unknownRaw, setUnknownRaw] = useState('');
  const [unknownTag, setUnknownTag] = useState('');
  const [unknownLabel, setUnknownLabel] = useState('');
  const [pickerCandidates, setPickerCandidates] = useState<SizeCandidate[]>([]); // L5 size siblings
  const [pickerName, setPickerName] = useState('');                              // variety name for the picker header
  const [counted, setCounted]     = useState<CountedItem[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({}); // lotKey → last counted qty this session
  const [conflict, setConflict]   = useState<Conflict | null>(null);
  const [conflictReason, setConflictReason] = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Identity — WHO is counting. Resolved on mount; a count cannot START until known.
  const [userId, setUserId] = useState<string | null>(null);
  // Connectivity — reactive, for the start-guard + the offline indicator.
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0); // ops waiting to sync

  // ── SYNC ENGINE ───────────────────────────────────────────
  // One engine per (business). Its queue is persisted by (businessId, domain), so
  // it survives this re-creation when userId resolves and across a reload.
  const engine = useMemo(
    () => businessId
      ? new SyncEngine({ supabase, businessId, userId, domain: 'inventory-count', onChange: setPending })
      : null,
    [businessId, userId],
  );

  useEffect(() => {
    if (!engine) return;
    engine.start();                 // attach reconnect listener + drain any leftover queue
    setPending(engine.pendingCount());
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ── START ─────────────────────────────────────────────────
  async function startCount() {
    if (!businessId || !engine) return;
    // GUARD: a count may only be started authenticated + with signal (so identity
    // is real and the count tables can be probed). Offline counting is fine ONCE
    // started — the dead zone is for the walk, not the cold start.
    if (!userId) { setError('Confirming your sign-in — one moment.'); return; }
    if (!online) {
      setError("You're offline. Connect to start a count — once it's going you can keep counting in dead zones and it'll sync when you're back.");
      return;
    }
    setBusy(true); setError(null);

    const newSessionId = engine.newId();   // client-generated PK → children can reference it immediately
    const res = await engine.insert({
      table: 'inventory_count_sessions',
      row: { id: newSessionId, business_id: businessId, status: 'in_progress', counted_by: userId },
      clientId: newSessionId,
    });

    if (res.status === 'failed' && isMissingTable({ message: res.error })) {
      // Deploy window: migration 20260626 not applied yet. On-hand updates still work;
      // count records are skipped with a loud warning until David applies the migration.
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] session start — count tables ABSENT (apply migration 20260626); on-hand will update without an audit record');
      engine.forget(newSessionId);
      setTablesAbsent(true);
      setSessionId(null);
    } else if (res.status === 'failed') {
      setError(res.error ?? 'Could not start the count.'); setBusy(false); return;
    } else {
      setSessionId(newSessionId); // works whether applied now or queued (start is online-guarded, so normally applied)
      if (TRACE_COUNT) console.log('[TRACE:COUNT] session start —', newSessionId, 'by:', userId, 'status:', res.status);
    }
    setCounted([]);
    setSessionCounts({});
    setPhase('scanning');
    setBusy(false);
  }

  // ── RESOLVE (after a scan) ────────────────────────────────
  async function handleScan(raw: string) {
    if (!businessId) return;
    const tag = extractTag(raw);
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolve attempt — raw:', raw, 'tag:', tag);

    // (1) Plant tag → identity + linked lot.
    const { data: plant } = await supabase
      .from('cultivar_plants')
      .select('id, common_name, species, current_container, inventory_id, business_inventory ( id, name, sku, qty )')
      .eq('business_id', businessId)
      .ilike('tag_id', tag)
      .maybeSingle();

    if (plant) {
      const lot = (plant as any).business_inventory as { id: string; name: string; sku: string | null; qty: number } | null;
      const name = (plant as any).common_name || (plant as any).species || 'Plant';
      const size = (plant as any).current_container;
      const label = size ? `${name}, ${size}` : name;
      const r: Resolved = {
        inventoryId: lot?.id ?? (plant as any).inventory_id ?? null,
        plantTagId:  tag,
        label,
        currentQty:  lot?.qty ?? null,
        rawScan:     raw,
      };
      if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] L1 tag_id exact —', tag, '→', label);
      openReview(r);
      return;
    }

    // (L2) Fall back to an inventory SKU (some QRs encode a real SKU, not a plant tag).
    const { data: lot } = await supabase
      .from('business_inventory')
      .select('id, name, sku, qty')
      .eq('business_id', businessId)
      .ilike('sku', tag)
      .maybeSingle();

    if (lot) {
      if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] L2 sku exact —', tag, '→', (lot as any).name);
      openReview({
        inventoryId: (lot as any).id,
        plantTagId:  null,
        label:       (lot as any).name + ((lot as any).sku ? ` (SKU ${(lot as any).sku})` : ''),
        currentQty:  (lot as any).qty ?? null,
        rawScan:     raw,
      });
      return;
    }

    // (L3) stored product-slug exact — DEFERRED: no source_slug column exists today
    //      (grower-resolve design §6 — a new column behind a gated migration). Skipped
    //      cleanly; when that column lands, an exact norm(scan)==stored-slug check slots here.

    // (L4) NAME TOKEN-SET EQUALITY — the canonical-key resolve. Fixes the discovery-
    //      populated catalog case: a QR product-slug ("vitex-shoal-creek") and the
    //      catalog row that holds it ("Shoal Creek Vitex", synthetic DISC- sku, no
    //      cultivar_plants row) share only the WORDS of the name. Compare the scanned
    //      slug's token set against each candidate's name token set; match on EQUALITY
    //      (order-insensitive). EQUALITY ONLY this build — guarded subset/superset (L5,
    //      → NEED_CLARIFICATION) and stemming (L6) are the deferred fast-follow and
    //      slot in right here, after equality and before UNKNOWN.
    const scannedKey = nameTokenSet(tag);
    if (scannedKey.size > 0) {
      const { data: rows } = await supabase
        .from('business_inventory')
        .select('id, name, sku, qty, size, variant_group')
        .eq('business_id', businessId);
      const matches = ((rows ?? []) as InvRow[]).filter(row =>
        tokenSetsEqual(nameTokenSet(row.name), scannedKey));

      if (matches.length === 1) {
        const m = matches[0];
        if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] L4 name token-set equality —', tag, '→', m.name);
        openReview({
          inventoryId: m.id,
          plantTagId:  null,
          label:       m.name + (m.sku ? ` (SKU ${m.sku})` : ''),
          currentQty:  m.qty ?? null,
          rawScan:     raw,
        });
        return;
      }
      if (matches.length > 1) {
        // (L5 NEED_CLARIFICATION) >1 token-equal rows. If they are the SAME variety in
        // different SIZES, surface a size-picker (route the count to the chosen per-size
        // row) instead of collapsing to UNKNOWN — the #61-regression the size feature gates on.
        if (detectSizeCollision(matches)) {
          const candidates: SizeCandidate[] = matches
            .map(m => ({
              size: (m.size as string).trim(),
              resolved: {
                inventoryId: m.id,
                plantTagId:  null,
                label:       `${m.name}, ${(m.size as string).trim()}` + (m.sku ? ` (SKU ${m.sku})` : ''),
                currentQty:  m.qty ?? null,
                rawScan:     raw,
              },
            }))
            .sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }));
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] L5 NEED_CLARIFICATION (size) —', tag, '→ picker:', candidates.map(c => c.size).join(' / '));
          if (TRACE_COUNT) console.log('[TRACE:COUNT] size collision —', 'matchCount:', matches.length, 'name:', matches[0].name, 'variant_group:', matches[0].variant_group, 'sizes:', candidates.map(c => c.size).join(' / '));
          setPickerName(matches[0].name);
          setPickerCandidates(candidates);
          setError(null);
          setPhase('picker');
          return;
        }
        // EQUALITY guardrail (surface-don't-presume): a genuinely ambiguous collision
        // (mixed/empty variant_group, or no per-size split) — do NOT auto-pick. → UNKNOWN.
        if (TRACE_RESOLVE) console.warn('[TRACE:RESOLVE] L4 AMBIGUOUS —', matches.length, 'equal-token candidates for', tag, '→ UNKNOWN (not a size collision)');
      }
    }

    // (L5/UNKNOWN) Unknown — don't dead-end the loop.
    if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] UNKNOWN — no layer matched:', tag);
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolve UNKNOWN — tag:', tag);
    setUnknownRaw(raw);
    setUnknownTag(tag);
    setUnknownLabel('');
    setPhase('unknown');
  }

  function openReview(r: Resolved) {
    setResolved(r);
    setQtyInput(r.currentQty != null ? String(r.currentQty) : '');
    setError(null);
    setPhase('reviewing');
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolved —', r.label, 'lot:', r.inventoryId, 'currentQty:', r.currentQty);
  }

  // ── L5 SIZE-PICKER: the counter chose which size ──────────
  function pickSize(c: SizeCandidate) {
    if (TRACE_COUNT) console.log('[TRACE:COUNT] size chosen —', c.size, '→ row:', c.resolved.inventoryId);
    setPickerCandidates([]);
    setPickerName('');
    openReview(c.resolved);   // → reviewing → qty → save sets THIS per-size row's qty
  }

  // ── SAVE → NEXT (known item) ──────────────────────────────
  async function saveAndNext() {
    if (!resolved || !businessId) return;
    const qty = parseInt(qtyInput, 10);
    if (isNaN(qty) || qty < 0) { setError('Enter a count of 0 or more.'); return; }

    // Same lot already counted this session? That's a REAL discrepancy (a tree may
    // have sold during the gap) — surface it, let the counter decide. Never overwrite silently.
    const key = lotKey(resolved);
    if (key && sessionCounts[key] !== undefined) {
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] same-lot-twice this session —', resolved.label, sessionCounts[key], '→', qty);
      setConflict({ key, label: resolved.label, prevQty: sessionCounts[key], newQty: qty });
      setConflictReason('');
      setError(null);
      setPhase('conflict');
      return;
    }

    await commitCount(qty);
  }

  // The actual persistence for a counted lot — on-hand SET + durable record.
  // reason: optional note when this resolves a within-session recount.
  async function commitCount(qty: number, reason?: string) {
    if (!resolved || !businessId || !engine) return;
    setBusy(true); setError(null);

    // (i) SET the on-hand for the resolved lot (a physical count sets on-hand).
    //     Routed through sync: online → applied now; offline → queued (never fails).
    if (resolved.inventoryId) {
      const res = await engine.update({
        table: 'business_inventory',
        set:   { qty },
        match: { id: resolved.inventoryId, business_id: businessId },
      });
      if (res.status === 'failed') { setError(`Couldn't update on-hand: ${res.error}`); setBusy(false); return; }
    }

    // (ii) Record the durable count (skipped only in the pre-migration deploy window).
    const rawScan = reason ? `${resolved.rawScan} | recount-reason: ${reason}` : resolved.rawScan;
    await recordCount({
      inventory_id: resolved.inventoryId,
      plant_tag_id: resolved.plantTagId,
      item_label:   resolved.label,
      counted_qty:  qty,
      was_unknown:  false,
      raw_scan:     rawScan,
    });

    if (TRACE_COUNT) console.log('[TRACE:COUNT] save —', resolved.label, 'qty:', qty, 'lot:', resolved.inventoryId, reason ? `recount: ${reason}` : '');
    const key = lotKey(resolved);
    if (key) setSessionCounts(s => ({ ...s, [key]: qty }));
    setCounted(c => [...c, { label: resolved.label, qty, unknown: false }]);
    setResolved(null);
    setQtyInput('');
    setBusy(false);
    setPhase('scanning'); // → next
  }

  // ── CONFLICT: resolve a within-session recount ────────────
  async function resolveConflict(keep: 'first' | 'second') {
    if (!conflict) return;
    if (keep === 'first') {
      // The earlier count stands — discard this one, on-hand + prior record untouched.
      if (TRACE_COUNT) console.log('[TRACE:COUNT] recount resolved — KEEP FIRST', conflict.label, conflict.prevQty);
      setConflict(null); setConflictReason('');
      setResolved(null); setQtyInput('');
      setPhase('scanning');
      return;
    }
    // KEEP SECOND — the new count holds: SET on-hand to it + record it (both counts
    // remain as separate, honest historical rows). Optional reason rides the record.
    const reason = conflictReason.trim();
    if (TRACE_COUNT) console.log('[TRACE:COUNT] recount resolved — KEEP SECOND', conflict.label, conflict.newQty, 'reason:', reason || '(none)');
    setConflict(null);
    await commitCount(conflict.newQty, reason || undefined);
    setConflictReason('');
  }

  // ── UNKNOWN branch: enter quickly, or skip & flag ─────────
  async function saveUnknown(withLabel: boolean) {
    if (!businessId) return;
    setBusy(true); setError(null);
    let qty = 0;
    let label = `Unrecognized — flagged (${unknownTag})`;
    if (withLabel) {
      if (!unknownLabel.trim()) { setError('Enter a variety/size, or choose Skip & flag.'); setBusy(false); return; }
      qty = parseInt(qtyInput, 10);
      if (isNaN(qty) || qty < 0) { setError('Enter a count of 0 or more.'); setBusy(false); return; }
      label = unknownLabel.trim();
    }

    await recordCount({
      inventory_id: null,            // no lot — unknown items aren't auto-created (intake's job)
      plant_tag_id: unknownTag || null,
      item_label:   label,
      counted_qty:  qty,
      was_unknown:  true,
      raw_scan:     unknownRaw,
    });

    if (TRACE_COUNT) console.log('[TRACE:COUNT] save UNKNOWN —', label, 'qty:', qty, 'flaggedOnly:', !withLabel);
    setCounted(c => [...c, { label, qty, unknown: true }]);
    setUnknownLabel(''); setUnknownTag(''); setUnknownRaw(''); setQtyInput('');
    setBusy(false);
    setPhase('scanning'); // → next
  }

  // Shared insert into inventory_counts + session item_count bump (routed through
  // sync; graceful if the migration's tables are absent).
  async function recordCount(row: {
    inventory_id: string | null; plant_tag_id: string | null; item_label: string;
    counted_qty: number; was_unknown: boolean; raw_scan: string;
  }) {
    if (tablesAbsent || !sessionId || !engine) {
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] count record SKIPPED (tables absent / no session) — on-hand only:', row.item_label);
      return;
    }
    const res = await engine.insert({
      table: 'inventory_counts',
      row: { session_id: sessionId, business_id: businessId, ...row },
    });
    if (res.status === 'failed') {
      if (isMissingTable({ message: res.error })) { engine.forget(res.clientId); setTablesAbsent(true); return; }
      // A real failure to record is worth surfacing, but the on-hand already moved — log loudly.
      if (TRACE_COUNT) console.error('[TRACE:COUNT] count record FAILED —', res.error);
      return;
    }
    // Bump the denormalized counter (best-effort; absolute SET, idempotent on replay).
    await engine.update({
      table: 'inventory_count_sessions',
      set:   { item_count: counted.length + 1 },
      match: { id: sessionId },
    });
  }

  // ── COMPLETE ──────────────────────────────────────────────
  async function complete() {
    setBusy(true);
    if (sessionId && !tablesAbsent && engine) {
      await engine.update({
        table: 'inventory_count_sessions',
        set:   { status: 'completed', completed_at: new Date().toISOString(), item_count: counted.length },
        match: { id: sessionId },
      });
    }
    if (TRACE_COUNT) console.log('[TRACE:COUNT] complete —', counted.length, 'items, session:', sessionId, 'pending sync:', engine?.pendingCount() ?? 0);
    setBusy(false);
    setPhase('done');
  }

  function exit() { navigate('/inventory'); }

  const counting = phase === 'scanning' || phase === 'reviewing' || phase === 'unknown' || phase === 'picker' || phase === 'conflict';

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={exit} aria-label="Back to inventory"><ArrowLeft size={22} color="#1a2e0a" /></button>
        <h1 style={S.title}>Walk &amp; count</h1>
        <div style={{ flex: 1 }} />
        {counting && <span style={S.tally}>{counted.length} counted</span>}
      </div>

      {/* Connectivity + pending-sync strip (only while counting) */}
      {counting && !online && (
        <div style={S.offlineNote}>
          <CloudOff size={15} /> Offline — counts are saved on this phone and will sync when you're back in signal.
        </div>
      )}
      {counting && pending > 0 && (
        <button
          style={S.syncBtn}
          disabled={!online || busy}
          onClick={() => { if (engine) void engine.syncNow(); }}
        >
          <RefreshCw size={14} /> {online ? `Sync now (${pending} waiting)` : `${pending} waiting to sync`}
        </button>
      )}

      {tablesAbsent && counting && (
        <div style={S.warn}>Counting on-hand now. Audit history will record once the count tables are applied.</div>
      )}

      {/* IDLE — Start */}
      {phase === 'idle' && (
        <div style={S.card}>
          <ScanLine size={40} color="#27500A" style={{ marginBottom: 12 }} />
          <p style={S.lead}>Walk the lot and scan each plant tag. Enter how many you count, save, and move to the next. Hit Complete when you're done.</p>
          {!online && <div style={S.warn}>You're offline — connect to start. Once a count is going, dead zones are fine.</div>}
          {error && <div style={S.error}>{error}</div>}
          <button style={(busy || !online || !userId) ? S.btnDisabled : S.btnPrimary} disabled={busy || !online || !userId} onClick={() => void startCount()}>
            {busy ? 'Starting…' : !userId ? 'Confirming sign-in…' : 'Start count'}
          </button>
        </div>
      )}

      {/* SCANNING / REVIEWING / UNKNOWN / CONFLICT — camera stays mounted, sheets overlay */}
      {counting && (
        <>
          <div style={S.card}>
            <QrScanner active={phase === 'scanning'} onScan={raw => void handleScan(raw)} />
          </div>
          <button style={S.completeBtn} onClick={() => void complete()} disabled={busy}>
            <CheckCircle2 size={18} /> Complete count{counted.length ? ` (${counted.length})` : ''}
          </button>
        </>
      )}

      {/* REVIEW sheet — resolved item + qty */}
      {phase === 'reviewing' && resolved && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) { setPhase('scanning'); setResolved(null); } }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{resolved.label}</h2>
              <button style={S.iconBtn} onClick={() => { setPhase('scanning'); setResolved(null); }} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            {resolved.inventoryId == null && (
              <div style={S.note}>No stock lot is linked to this tag — your count is recorded, but there's no on-hand to update.</div>
            )}
            {resolved.currentQty != null && (
              <p style={S.subtle}>On-hand now: <strong>{resolved.currentQty}</strong></p>
            )}
            {error && <div style={S.error}>{error}</div>}
            <label style={S.label}>How many did you count?</label>
            <input
              style={S.qtyInput}
              type="number"
              inputMode="numeric"
              min="0"
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              autoFocus
            />
            <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void saveAndNext()}>
              {busy ? 'Saving…' : 'Save → Next'}
            </button>
          </div>
        </div>
      )}

      {/* SIZE-PICKER sheet — one variety, multiple sizes (L5 NEED_CLARIFICATION) */}
      {phase === 'picker' && pickerCandidates.length > 0 && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) { setPhase('scanning'); setPickerCandidates([]); setPickerName(''); } }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{pickerName} — which size?</h2>
              <button style={S.iconBtn} onClick={() => { setPhase('scanning'); setPickerCandidates([]); setPickerName(''); }} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>This variety is stocked in more than one size. Pick the one you're counting.</p>
            {pickerCandidates.map((c, i) => (
              <button key={i} style={S.pickBtn} onClick={() => pickSize(c)}>
                <span style={S.pickSize}>{c.size}</span>
                {c.resolved.currentQty != null && <span style={S.pickQty}>on-hand {c.resolved.currentQty}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONFLICT sheet — same lot counted twice this session */}
      {phase === 'conflict' && conflict && (
        <div style={S.modal}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Already counted this one</h2>
            </div>
            <p style={S.subtle}>
              You already counted <strong>{conflict.label}</strong> this session.
            </p>
            <div style={S.conflictRow}>
              <div style={S.conflictCol}><div style={S.conflictNum}>{conflict.prevQty}</div><div style={S.conflictCap}>first count</div></div>
              <div style={S.conflictArrow}>→</div>
              <div style={S.conflictCol}><div style={S.conflictNum}>{conflict.newQty}</div><div style={S.conflictCap}>now</div></div>
            </div>
            <p style={S.subtleSm}>
              {conflict.newQty === conflict.prevQty
                ? 'Same as before — looks consistent. Which count should hold?'
                : 'The difference could be a sale, a miscount, or a tree that moved. Which count holds?'}
            </p>
            <label style={S.label}>Why? (optional — recorded with the count)</label>
            <input
              style={S.input}
              value={conflictReason}
              onChange={e => setConflictReason(e.target.value)}
              placeholder="e.g. one sold at lunch"
            />
            {error && <div style={S.error}>{error}</div>}
            <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void resolveConflict('second')}>
              {busy ? 'Saving…' : `Use the new count (${conflict.newQty})`}
            </button>
            <button style={S.btnGhost} disabled={busy} onClick={() => void resolveConflict('first')}>
              Keep the first count ({conflict.prevQty})
            </button>
          </div>
        </div>
      )}

      {/* UNKNOWN sheet */}
      {phase === 'unknown' && (
        <div style={S.modal}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Didn't recognize this</h2>
              <button style={S.iconBtn} onClick={() => setPhase('scanning')} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>Scanned: <code style={S.code}>{unknownTag}</code></p>
            {error && <div style={S.error}>{error}</div>}
            <label style={S.label}>Enter variety &amp; size (optional)</label>
            <input
              style={S.input}
              value={unknownLabel}
              onChange={e => setUnknownLabel(e.target.value)}
              placeholder="e.g. Live Oak, 45 gal"
            />
            <label style={S.label}>Count</label>
            <input
              style={S.qtyInput}
              type="number"
              inputMode="numeric"
              min="0"
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
            />
            <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void saveUnknown(true)}>
              {busy ? 'Saving…' : 'Save → Next'}
            </button>
            <button style={S.btnGhost} disabled={busy} onClick={() => void saveUnknown(false)}>
              Skip &amp; flag for later
            </button>
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === 'done' && (
        <div style={S.card}>
          <CheckCircle2 size={40} color="#27500A" style={{ marginBottom: 12 }} />
          <h2 style={S.doneTitle}>Count complete</h2>
          <p style={S.lead}>{counted.length} {counted.length === 1 ? 'item' : 'items'} counted.</p>
          {pending > 0 && (
            <div style={S.warn}>{pending} {pending === 1 ? 'count is' : 'counts are'} still waiting to sync — they'll go up automatically when you're back in signal.</div>
          )}
          {counted.length > 0 && (
            <div style={S.summaryList}>
              {counted.map((c, i) => (
                <div key={i} style={S.summaryRow}>
                  <span style={c.unknown ? S.summaryLabelFlag : S.summaryLabel}>{c.label}</span>
                  <span style={S.summaryQty}>{c.qty}</span>
                </div>
              ))}
            </div>
          )}
          <button style={S.btnPrimary} onClick={exit}>Back to inventory</button>
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 } as React.CSSProperties,
  backBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  title:      { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  tally:      { background: '#27500A', color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: '0.82rem', fontWeight: 700 } as React.CSSProperties,
  offlineNote:{ display: 'flex', alignItems: 'center', gap: 8, background: '#e5e7eb', color: '#374151', borderRadius: 10, padding: '0.55rem 0.85rem', fontSize: '0.82rem', marginBottom: 10 } as React.CSSProperties,
  syncBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', minHeight: 40, background: '#fff', color: '#27500A', border: '1.5px solid #27500A', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', marginBottom: 10 } as React.CSSProperties,
  warn:       { background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '0.6rem 0.875rem', fontSize: '0.82rem', marginBottom: 12 } as React.CSSProperties,
  card:       { background: '#fff', borderRadius: 14, padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 } as React.CSSProperties,
  lead:       { color: '#374151', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.25rem' } as React.CSSProperties,
  btnPrimary: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  btnDisabled:{ width: '100%', minHeight: 48, background: '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'not-allowed' } as React.CSSProperties,
  btnGhost:   { width: '100%', minHeight: 44, background: 'none', color: '#6b7280', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', marginTop: 10 } as React.CSSProperties,
  completeBtn:{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 48, background: 'none', color: '#27500A', border: '2px solid #27500A', borderRadius: 10, fontSize: '0.98rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet:      { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 560 } as React.CSSProperties,
  sheetHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' } as React.CSSProperties,
  sheetTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4 } as React.CSSProperties,
  subtle:     { color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1rem' } as React.CSSProperties,
  subtleSm:   { color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem', lineHeight: 1.4 } as React.CSSProperties,
  note:       { background: '#eef2ff', color: '#3730a3', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: 12 } as React.CSSProperties,
  code:       { background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', fontSize: '0.82rem', color: '#374151' } as React.CSSProperties,
  label:      { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 } as React.CSSProperties,
  input:      { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.7rem 0.85rem', fontSize: '1rem', color: '#111827', boxSizing: 'border-box', marginBottom: 14 } as React.CSSProperties,
  qtyInput:   { width: '100%', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.8rem 0.85rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827', boxSizing: 'border-box', marginBottom: 16, textAlign: 'center' } as React.CSSProperties,
  error:      { color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.86rem', marginBottom: 12 } as React.CSSProperties,
  pickBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 52, background: '#fff', color: '#1a2e0a', border: '1.5px solid #27500A', borderRadius: 10, padding: '0 1rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: 10 } as React.CSSProperties,
  pickSize:   { fontSize: '1.05rem', fontWeight: 700, color: '#1a2e0a' } as React.CSSProperties,
  pickQty:    { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' } as React.CSSProperties,
  conflictRow:{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, margin: '0.25rem 0 1rem' } as React.CSSProperties,
  conflictCol:{ textAlign: 'center' } as React.CSSProperties,
  conflictNum:{ fontSize: '2rem', fontWeight: 800, color: '#1a2e0a', lineHeight: 1 } as React.CSSProperties,
  conflictCap:{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' } as React.CSSProperties,
  conflictArrow:{ fontSize: '1.5rem', color: '#d1d5db', fontWeight: 700 } as React.CSSProperties,
  doneTitle:  { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: '0 0 0.5rem' } as React.CSSProperties,
  summaryList:{ textAlign: 'left', margin: '0 0 1.25rem', maxHeight: '40vh', overflowY: 'auto' } as React.CSSProperties,
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  summaryLabel:    { color: '#111827', fontSize: '0.9rem' } as React.CSSProperties,
  summaryLabelFlag:{ color: '#92400e', fontSize: '0.9rem' } as React.CSSProperties,
  summaryQty: { fontWeight: 700, color: '#27500A', fontSize: '0.9rem' } as React.CSSProperties,
};
