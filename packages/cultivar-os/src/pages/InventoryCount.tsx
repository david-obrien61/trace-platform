// ============================================================
// InventoryCount — the walk-and-count loop (scan → resolve → SIZE + qty → save → next → complete).
// PURPOSE:  Lauren walks the lot, scans a plant tag QR (PER-VARIETY — all sizes share
//           one QR), the app strips the URL and resolves the VARIETY, she picks/enters
//           WHICH SIZE she's counting and the qty, Save→Next reopens the camera; Complete
//           ends the session. One item at a time, full focus (D-21).
//           CAPTURE→PERSIST→READ (D-45): the count now PROMOTES size + qty into a
//           variant_group-keyed business_inventory row (create-or-update) — closing the
//           broken seam where counted size/qty stranded in inventory_counts and never
//           reached the grid or the order picker. Both stores are written: business_inventory
//           (canonical on-hand, STD-011) AND inventory_counts (append-only count history).
//           SOMETIMES-CONNECTED: every write routes through the shared SyncEngine —
//           write-through when online, queue when offline (back-acre dead zones, ledger #54),
//           drain on reconnect. A Save never fails in a dead zone.
// DEPENDENCIES: QrScanner (jsQR camera), business_inventory (name/size/variant_group/qty —
//           the promote target), cultivar_plants (tag→identity→lot, the vertical L1 lane),
//           inventory_count_sessions + inventory_counts (durable record, gated migration
//           20260626 — degrades gracefully if not yet applied), @trace/shared/sync SyncEngine
//           (offline durability + reconnect drain), @trace/shared/inventory resolveStockLine
//           (the SHARED business_inventory ladder — SKU→name-token-equality→size-collision;
//           ONE core, also used by usePlant's purchase fallback, CLAUDE.md §6 rule 8; reused
//           here for RESOLVE-BEFORE-CREATE on the typed no-QR path so varied spellings of ONE
//           variety don't orphan into separate groups).
// RESOLVE:  most-specific → least (grower-resolve design 2026-06-26):
//           L1 cultivar_plants.tag_id exact (VERTICAL, stays here) → then the SHARED resolver:
//           L2 business_inventory.sku exact → L4 NAME token-set EQUALITY (order-insensitive) →
//           L5 SIZE-COLLISION (>1 same-variety rows, one variant_group, distinct sizes).
//           Every resolve builds a VARIETY CONTEXT (name + variant_group key + existing
//           size→row siblings); the review sheet then captures the size + qty and PROMOTES.
// PROMOTE:  variant_group KEY = an existing sibling's shared group, else the scanned QR slug,
//           else slugify(typed name) (the same product-slug convention populate uses, so
//           scrape-created and count-created rows converge). The DECISION is the SHARED pure fn
//           resolveCountTarget (@trace/shared/inventory countPromote.ts) — this screen performs
//           only the IO it returns (D-47's shape: the decision is testable without a DB).
//           update  → exact (variety × size): SET qty (a count sets on-hand) + confirm the group.
//           fill    → D-49: the resolved row is a scraped VARIETY PLACEHOLDER (qty 0, no size, no
//                     group). The first count FILLS it in place — it does NOT sibling it.
//           create  → a genuine size-sibling, and the family is left picker-ready BY CONSTRUCTION:
//                     every blank-group row is regrouped onto the key + the SKU derives from the
//                     family's base (deriveSiblingSku). sell_price omitted → null = needs-price
//                     (the cart refuses rather than selling at $0 — D-9 omit-not-fake).
// SIZE:     REQUIRED on BOTH sheets — the review/picker sheet AND the typed UNKNOWN sheet (ledger
//           #135). The sheet asks the SAME resolveCountTarget the write uses, so the two gates are
//           ONE rule and cannot drift; a refusal red-borders the size field and says why (the FIX 5
//           pattern, shared errBorder/FieldError — never a greyed button with no reason).
//           WHY the UNKNOWN sheet too, on recon and not by symmetry: it runs resolve-before-create,
//           so a typed name can land INSIDE an existing family, and on a new variety it always sets
//           groupKey = slugify(name) — every row it mints is in a family by construction. A blank
//           size there is the same landmine, born in a different room. Only "Skip & flag"
//           (record-only, no promote) needs no size — nothing is written for a size to describe.
// D-49:     THE INVARIANT — any path that mints a sibling must leave the family in a state where
//           the size-picker fires by construction. Violating it is not cosmetic: the next scan
//           sees >1 token-equal rows, detectSizeCollision correctly refuses to guess, and the
//           variety resolves UNKNOWN — counting it made it uncountable (tech-debt #57, live).
//           The invariant's "non-empty size" half is the ledger-#135 fix: D-49 enforced "distinct"
//           and left "non-empty" to this sheet, where the field was optional and the save button did
//           not argue — so a blank-size count minted `created {size: null}` beside 15/30/45 and the
//           re-scan went UNKNOWN. Same destination as the Basham's scar, different road.
//           HOOK (documented, NOT built): size is a FREE LABEL spanning single-plant (4", 30 gal)
//           AND multi-unit (flat, tray). qty is stored VERBATIM (unit-agnostic) — we do NOT
//           assume qty = plant count. A future per-size unit-multiplier (a "flat" = N plants)
//           attaches at the create/read boundary without reshaping this loop.
// OUTPUTS:  business_inventory (create-or-update the variety×size row) + inventory_counts
//           (append-only). [TRACE:INVENTORY] on every promote (variety, group, size, qty,
//           created|updated|record-only); [TRACE:COUNT]/[TRACE:RESOLVE] on the loop; [TRACE:SYNC]
//           on the queue. STD-003 ON until OWNER-PROVEN.
// SCOPE:    count loop ONLY. Reconciliation (counted vs expected) is DEFERRED.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, X, ScanLine, CloudOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { SyncEngine } from '@trace/shared/sync';
import {
  resolveStockLine, variantGroupSlug, resolveCountTarget, sameSizeLabel, SIZE_REQUIRED_MESSAGE,
  type StockLineResolution, type CountSibling,
} from '@trace/shared/inventory';
import { errBorder, FieldError } from '@trace/shared/components/FieldError';
import { canonicalNameKey, nameTokenSet } from '@trace/shared/utils/canonicalName';
import { QrScanner } from '../components/inventory/QrScanner';
import { extractTag } from '../lib/scanTag';

const TRACE_COUNT = true;   // [TRACE:COUNT] STD-003 — on until OWNER-PROVEN
const TRACE_RESOLVE = true; // [TRACE:RESOLVE] which resolver layer hit; on until OWNER-PROVEN
const TRACE_INV = true;     // [TRACE:INVENTORY] the promote to business_inventory; on until OWNER-PROVEN

type Phase = 'idle' | 'scanning' | 'reviewing' | 'unknown' | 'conflict' | 'done';

// A resolved VARIETY context (D-45): the variety identity + its group key + the existing
// (size→row) siblings — enough to promote a count into the right (variety × size)
// business_inventory row (create-or-update) WITHOUT a second read on the scan path.
interface Ctx {
  varietyName: string;
  groupKey:    string | null;   // variant_group to write; null = unlinked (plant w/ no lot) → record-only
  // The variety's existing rows, carrying the fields the shared promote decision reads:
  // variant_group (is this family whole? — the D-49 auto-group) and sku (the lineage base).
  siblings:    CountSibling[];
  defaultSize: string | null;   // prefill for the size field (resolved row's size / plant container)
  plantTagId:  string | null;
  label:       string;          // display header
  rawScan:     string;          // for the count record
}

interface CountedItem { label: string; qty: number; flagged: boolean; }

// A same-(variety×size)-twice-in-session recount — surfaced, never silently overwritten.
interface Conflict { key: string; label: string; prevQty: number; newQty: number; }

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST204') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the table');
}

// Size is a FREE LABEL — compare case/whitespace-insensitively. The local copy was RETIRED in
// favour of the shared sameSizeLabel (STD-011: the promote decision and this screen must agree
// on what "the same size" means, or the UI's size-chip match and the write's match can diverge).
const sameSize = sameSizeLabel;
// variant_group key for a NEW variety when there is no QR slug and no existing sibling to
// adopt — a product-slug from the name. SHARED with the manual "+ Add size" path
// (variantGroupSlug, @trace/shared/inventory) so a scan-promoted row and a hand-added size of
// the same variety land in the SAME group and the size-picker fires (STD-011 — one convention).
const slugify = variantGroupSlug;
function labelFor(varietyName: string, size: string | null): string {
  return size ? `${varietyName}, ${size}` : varietyName;
}

// Build a variety context from a shared-resolver result. groupKey: prefer the resolved
// row's/collision's existing non-null variant_group (adopt — don't fragment), else the
// scanned slug (or slugify(name) on the typed path). Returns null on a miss.
function ctxFromResolution(res: StockLineResolution, slug: string, rawScan: string): Ctx | null {
  if (res.kind === 'resolved') {
    const r = res.row;
    return {
      varietyName: r.name,
      groupKey:    (r.variant_group?.trim() || slug.toLowerCase()) || null,
      siblings:    [{ size: r.size, id: r.id, qty: r.qty ?? null, variant_group: r.variant_group, sku: r.sku }],
      defaultSize: r.size,
      plantTagId:  null,
      label:       r.name + (r.sku ? ` (SKU ${r.sku})` : ''),
      rawScan,
    };
  }
  if (res.kind === 'collision') {
    return {
      varietyName: res.variety,
      groupKey:    res.variantGroup,
      siblings:    res.candidates.map(c => ({ size: c.size, id: c.id, qty: c.qty ?? null, variant_group: c.variant_group, sku: c.sku })),
      defaultSize: null,
      plantTagId:  null,
      label:       res.variety,
      rawScan,
    };
  }
  return null; // miss (no_match | ambiguous)
}

export function InventoryCount() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [phase, setPhase]         = useState<Phase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tablesAbsent, setTablesAbsent] = useState(false); // migration not yet applied — degrade
  const [resolved, setResolved]   = useState<Ctx | null>(null);
  const [sizeInput, setSizeInput] = useState('');   // WHICH size the counter is counting
  const [qtyInput, setQtyInput]   = useState('');
  const [unknownRaw, setUnknownRaw]   = useState('');
  const [unknownTag, setUnknownTag]   = useState('');
  const [unknownName, setUnknownName] = useState(''); // typed variety (no QR)
  const [unknownSize, setUnknownSize] = useState(''); // typed size (no QR)
  const [counted, setCounted]     = useState<CountedItem[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({}); // countKey → last counted qty this session
  const [conflict, setConflict]   = useState<Conflict | null>(null);
  const [conflictReason, setConflictReason] = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  // Per-field validation (the FIX 5 pattern, ledger #102 — shared errBorder/FieldError): a blocked
  // save red-borders the offending field and SAYS WHY, on the field. A greyed button that will not
  // say what is wrong is the anti-pattern this exists to kill.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Identity — WHO is counting. Resolved on mount; a count cannot START until known.
  const [userId, setUserId] = useState<string | null>(null);
  // Connectivity — reactive, for the start-guard + the offline indicator.
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0); // ops waiting to sync

  // ── SYNC ENGINE ───────────────────────────────────────────
  const engine = useMemo(
    () => businessId
      ? new SyncEngine({ supabase, businessId, userId, domain: 'inventory-count', onChange: setPending })
      : null,
    [businessId, userId],
  );

  useEffect(() => {
    if (!engine) return;
    engine.start();
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
    if (!userId) { setError('Confirming your sign-in — one moment.'); return; }
    if (!online) {
      setError("You're offline. Connect to start a count — once it's going you can keep counting in dead zones and it'll sync when you're back.");
      return;
    }
    setBusy(true); setError(null);

    const newSessionId = engine.newId();
    const res = await engine.insert({
      table: 'inventory_count_sessions',
      row: { id: newSessionId, business_id: businessId, status: 'in_progress', counted_by: userId },
      clientId: newSessionId,
    });

    if (res.status === 'failed' && isMissingTable({ message: res.error })) {
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] session start — count tables ABSENT (apply migration 20260626); on-hand will update without an audit record');
      engine.forget(newSessionId);
      setTablesAbsent(true);
      setSessionId(null);
    } else if (res.status === 'failed') {
      setError(res.error ?? 'Could not start the count.'); setBusy(false); return;
    } else {
      setSessionId(newSessionId);
      if (TRACE_COUNT) console.log('[TRACE:COUNT] session start —', newSessionId, 'by:', userId, 'status:', res.status);
    }
    setCounted([]);
    setSessionCounts({});
    setPhase('scanning');
    setBusy(false);
  }

  // ── RESOLVE (after a scan) → build a variety context → review ─
  async function handleScan(raw: string) {
    if (!businessId) return;
    const tag = extractTag(raw);
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolve attempt — raw:', raw, 'tag:', tag);

    // (L1) Plant tag → specimen identity + linked lot (VERTICAL lane, kept).
    const { data: plant } = await supabase
      .from('cultivar_plants')
      .select('id, common_name, species, current_container, inventory_id, business_inventory ( id, name, sku, qty, size, variant_group )')
      .eq('business_id', businessId)
      .ilike('tag_id', tag)
      .maybeSingle();

    if (plant) {
      const lot = (plant as any).business_inventory as { id: string; name: string; sku: string | null; qty: number; size: string | null; variant_group: string | null } | null;
      const name = (plant as any).common_name || (plant as any).species || 'Plant';
      const container = (plant as any).current_container ?? null;
      if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] L1 tag_id exact —', tag, '→', name, lot ? '(linked lot)' : '(no lot)');
      const ctx: Ctx = lot
        ? {
            varietyName: name,
            groupKey:    (lot.variant_group?.trim() || tag.toLowerCase()) || null,
            siblings:    [{ size: lot.size ?? container, id: lot.id, qty: lot.qty ?? null, variant_group: lot.variant_group, sku: lot.sku }],
            defaultSize: lot.size ?? container,
            plantTagId:  tag,
            label:       container ? `${name}, ${container}` : name,
            rawScan:     raw,
          }
        : {
            varietyName: name, groupKey: null, siblings: [], defaultSize: container,
            plantTagId: tag, label: container ? `${name}, ${container}` : name, rawScan: raw,
          };
      openReview(ctx);
      return;
    }

    // (L2→L5) SHARED business_inventory resolver — SKU → name token-set equality → size collision.
    const resolution = await resolveStockLine(supabase, businessId, tag);
    const ctx = ctxFromResolution(resolution, tag, raw);
    if (ctx) {
      if (TRACE_RESOLVE) {
        const layer = resolution.kind === 'collision' ? 'L5 size-collision' : (resolution.kind === 'resolved' && resolution.via === 'sku' ? 'L2 sku' : 'L4 name-token');
        // key: the normalized token set the L4 equality actually compared (tech-debt #55) —
        // the scanned key is logged on the HIT so a near-miss is diagnosable from the trail.
        console.log('[TRACE:RESOLVE]', layer, '—', tag, '→', ctx.varietyName, 'key:', canonicalNameKey(tag), 'group:', ctx.groupKey, 'sizes:', ctx.siblings.map(s => s.size ?? '—').join(' / '));
      }
      openReview(ctx);
      return;
    }

    // miss → typed entry (resolve-before-create runs on the typed NAME, not the failed slug).
    //
    // ONE EMIT PER MISS — and it must be true (STD-003: instrumentation is a preserved asset only
    // if it is honest; one that contradicts itself is worse than none). Two lies lived here:
    //   (1) the AMBIGUOUS warn and the MISS warn BOTH fired, one line apart — "N equal-token rows"
    //       immediately followed by "no name-token match". There WERE matches; the second was false.
    //   (2) the AMBIGUOUS line appended a hardcoded "(ungrouped siblings)" to every ambiguous miss.
    //       Alley Cat's four rows were ALL grouped — the cause was a blank size — so the emit named
    //       the wrong cause, confidently, and the real one had to be worked out by hand.
    // The fix for (2) is to SHOW the candidates rather than assert a cause: {group, size} per row
    // makes the blank size or the mixed group visible, without re-spelling detectSizeCollision's
    // predicate here (a second copy of that rule, written only to explain the first, is what drifts).
    if (TRACE_RESOLVE) {
      if (resolution.kind === 'miss' && resolution.reason === 'ambiguous') {
        console.warn('[TRACE:RESOLVE] L4 MISS — ambiguous:', resolution.ambiguousCount,
          'equal-token rows for', tag, '→ the size-picker refused (see candidates) → typed entry',
          '\n  candidates:', JSON.stringify((resolution.candidates ?? []).map(c => ({ size: c.size, group: c.variant_group, sku: c.sku }))));
      } else {
        // A false-UNKNOWN is the #55 class: the tag was RIGHT and the key silently disagreed with
        // the catalog row's key by one eaten character. Logging the normalized token set at the
        // MISS is what makes the next one visible in the trail instead of a shrug — this is the
        // exact diagnostic that was absent while four live varieties scanned UNKNOWN.
        console.warn('[TRACE:RESOLVE] L4 MISS — no name-token match for', tag, 'key:', canonicalNameKey(tag), '(tokens:', JSON.stringify([...nameTokenSet(tag)]) + ')');
      }
    }
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolve UNKNOWN — tag:', tag);
    setUnknownRaw(raw);
    setUnknownTag(tag);
    setUnknownName('');
    setUnknownSize('');
    setQtyInput('');
    setFieldErrors({});
    setPhase('unknown');
  }

  function openReview(ctx: Ctx) {
    setResolved(ctx);
    setSizeInput(ctx.defaultSize ?? '');
    const sib = ctx.siblings.find(s => sameSize(s.size, ctx.defaultSize));
    setQtyInput(sib?.qty != null ? String(sib.qty) : '');
    setError(null);
    setFieldErrors({});   // a refusal on the LAST tree must never red-border this one
    setPhase('reviewing');
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolved —', ctx.label, 'group:', ctx.groupKey, 'siblings:', ctx.siblings.length);
  }

  // Tap an existing size chip → fill the size + its current on-hand.
  function pickSizeChip(s: { size: string | null; id: string; qty: number | null }) {
    setSizeInput(s.size ?? '');
    setQtyInput(s.qty != null ? String(s.qty) : '');
  }

  // The within-session dedup key for a counted (variety × size).
  function countKey(ctx: Ctx, size: string | null): string | null {
    if (ctx.groupKey) return `grp:${ctx.groupKey}|${(size ?? '').trim().toLowerCase()}`;
    const sib = ctx.siblings.find(s => sameSize(s.size, size));
    return sib ? `inv:${sib.id}` : null;
  }

  // ── SAVE → NEXT (resolved item) ───────────────────────────
  async function saveAndNext() {
    if (!resolved || !businessId) return;
    const size = sizeInput.trim() || null;

    // SIZE REQUIRED — asked of the SAME shared decision that performs the write (resolveCountTarget),
    // not re-spelled here. That is what makes the sheet and the write agree BY CONSTRUCTION rather
    // than by two rules that look alike until one of them changes (D-48's shape; §1.6 item 3).
    // The live defect: this sheet let a blank size through, the write took it, and the variety was
    // permanently unscannable a second later.
    const check = resolveCountTarget({ siblings: resolved.siblings, groupKey: resolved.groupKey, size });
    if (check.action === 'refuse') {
      if (TRACE_INV) console.warn('[TRACE:INVENTORY] promote — REFUSED at the sheet:', check.reason, '— variety:', resolved.varietyName, 'group:', resolved.groupKey);
      setFieldErrors({ size: SIZE_REQUIRED_MESSAGE });
      setError(null);
      return;
    }

    const qty = parseInt(qtyInput, 10);
    if (isNaN(qty) || qty < 0) { setFieldErrors({ qty: 'Enter a count of 0 or more.' }); return; }
    setFieldErrors({});

    const key = countKey(resolved, size);
    if (key && sessionCounts[key] !== undefined) {
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] same item twice this session —', labelFor(resolved.varietyName, size), sessionCounts[key], '→', qty);
      setConflict({ key, label: labelFor(resolved.varietyName, size), prevQty: sessionCounts[key], newQty: qty });
      setConflictReason(''); setError(null); setPhase('conflict');
      return;
    }
    await commitCount(resolved, size, qty);
  }

  // The promote: create-or-update the (variety × size) business_inventory row, then record
  // the append-only count. Explicit args (no state read) so the typed/conflict callers can
  // invoke it without a setState race.
  async function commitCount(ctx: Ctx, size: string | null, qty: number, reason?: string) {
    if (!businessId || !engine) return;
    setBusy(true); setError(null);

    const key = ctx.groupKey;
    // The DECISION is the shared pure fn (D-49) — update | fill | create | record-only. This
    // screen only performs the IO it returns. The invariant it enforces: any path that mints a
    // sibling leaves the family picker-ready by construction (group on EVERY row, distinct
    // non-empty sizes, SKU lineage) — see countPromote.ts.
    const target = resolveCountTarget({ siblings: ctx.siblings, groupKey: key, size });

    // THE WRITE GATE (§1.6 item 3 — validated before the WRITE, never merely hidden in the UI).
    // Every caller lands here: the review sheet, the conflict re-save, and the typed UNKNOWN entry.
    // The sheet asks the same function first, so in practice this never fires from the review sheet
    // — which is the point: the two gates are the SAME rule, so they cannot disagree, and no future
    // caller can route around the UI's copy of it (there is no copy).
    if (target.action === 'refuse') {
      if (TRACE_INV) console.warn('[TRACE:INVENTORY] promote — REFUSED at the write:', target.reason, '— variety:', ctx.varietyName, 'group:', key, 'siblings:', ctx.siblings.length);
      setFieldErrors({ size: SIZE_REQUIRED_MESSAGE });
      setError(SIZE_REQUIRED_MESSAGE);
      setBusy(false);
      return;
    }

    let targetId: string | null = null;
    let outcome: 'updated' | 'filled' | 'created' | 'record-only' = 'record-only';

    if (target.action === 'update' || target.action === 'fill') {
      // D-50 LAYER 2A — THE COUNT IS NO LONGER A SET. Both branches reconcile through the
      // RPC, which computes delta = counted − current under a FOR UPDATE lock and writes the
      // count_reconcile ledger row in the SAME transaction. There is no longer a state where
      // qty moves without a record.
      //
      // WHY ONE CALL FOR TWO BRANCHES: the only difference was that 'fill' also wrote `size`,
      // and the RPC takes `p_size` with COALESCE(p_size, bi.size) — so 'update' passes null and
      // keeps the existing size, 'fill' passes the size and lands it. Two engine.update copies
      // collapse to one RPC call (§6 r8). The D-49 distinction is PRESERVED in `outcome` and in
      // the TRACE line, because 'created' on a stub count IS the defect that must stay visible.
      //
      // OFFLINE: queued as an rpc op (ledger #143) — the dead-zone promise is kept, and the
      // delta is computed when it DRAINS, which is the correct reading of a physical count.
      const res = await engine.rpc({
        table: 'business_inventory',
        fn: 'count_reconcile_inventory',
        args: {
          p_lot_id:        target.rowId,
          p_business_id:   businessId,
          p_counted_qty:   qty,
          p_actor_user_id: userId,
          p_size:          target.action === 'fill' ? target.size : null,
          p_reason:        reason || null,
          p_source_id:     sessionId,
        },
      });
      if (res.status === 'failed') { setError(`Couldn't update on-hand: ${res.error}`); setBusy(false); return; }

      // variant_group is IDENTITY, not quantity — it stays a plain update (the RPC is the
      // funnel for qty, and only qty). Backfilling it is what makes the size-picker fire next
      // time (D-45/D-46); without it the family goes UNKNOWN on the next scan.
      if (target.variantGroup) {
        const rg = await engine.update({
          table: 'business_inventory',
          set:   { variant_group: target.variantGroup },
          match: { id: target.rowId, business_id: businessId },
        });
        if (rg.status === 'failed') { setError(`Couldn't group this variety's sizes: ${rg.error}`); setBusy(false); return; }
      }
      targetId = target.rowId; outcome = target.action === 'fill' ? 'filled' : 'updated';

    } else if (target.action === 'create') {
      // A genuine size-sibling. THE INVARIANT, in two writes that must both land:
      //   (a) regroup — every blank-group row of the family adopts the key, so parent + sibling
      //       share ONE group (D-46's rule, #126, applied to the path that skipped it). Without
      //       it the next scan sees a mixed-group family and goes UNKNOWN.
      //   (b) SKU lineage — parent SKU + size suffix via the SHARED deriveSiblingSku (STD-011).
      for (const id of target.regroup) {
        const rg = await engine.update({
          table: 'business_inventory',
          set:   { variant_group: target.variantGroup },
          match: { id, business_id: businessId },
        });
        if (rg.status === 'failed') { setError(`Couldn't group this variety's sizes: ${rg.error}`); setBusy(false); return; }
        if (TRACE_INV) console.log('[TRACE:INVENTORY] promote — auto-grouped parent', { rowId: id, variant_group: target.variantGroup });
      }

      // SKU uniqueness — a derived SKU may never collide with an existing row (two rows sharing a
      // SKU are indistinguishable in QBO/stock lookups). On a collision we OMIT the SKU rather
      // than block the save: the SKU is a convenience, the count is the point, and refusing a
      // count in the middle of the lot walk is disproportionate. Blank + loud, never a silent
      // duplicate (D-9 omit-not-fake) — the owner can assign it in the editor.
      let sku = target.sku;
      if (sku) {
        const { data: clash } = await supabase
          .from('business_inventory').select('id')
          .eq('business_id', businessId).ilike('sku', sku).maybeSingle();
        if (clash) {
          if (TRACE_INV) console.warn('[TRACE:INVENTORY] promote — derived SKU COLLIDES, omitting:', sku, '(row', (clash as { id: string }).id + ')');
          sku = null;
        }
      }

      // D-50 LAYER 2A — the new lot is born WITH its genesis ledger row, one transaction
      // (count_promote_create_inventory). sell_price is OMITTED → null = needs-price (cart
      // refuses, never a $0 sale — D-9); cost_confidence UNKNOWN (a count doesn't know cost).
      //
      // ⚠️ THIS BRANCH IS ONLINE-ONLY, AND THAT IS A DELIBERATE, NARROW REDUCTION — say so
      // rather than fail silently. The RPC mints the lot id SERVER-side, but `recordCount`
      // needs that id NOW to link the count record. Offline we would have to write the count
      // with a null inventory_id and hope to backfill — an unlinked count record is exactly
      // the silent drift D-50 exists to end, so we refuse honestly instead (D-9).
      // Counting EXISTING lots still works in a dead zone; only minting a brand-new variety
      // needs a connection. Closing this needs a client-supplied p_lot_id — a migration.
      if (!engine.isOnline()) {
        if (TRACE_INV) console.warn('[TRACE:INVENTORY] promote — create REFUSED offline (new lot needs a server id):', ctx.varietyName, target.size);
        setError(`You're offline — "${ctx.varietyName}" (${target.size}) is a new size we haven't seen, and adding one needs a connection. Counting sizes you already have still works out here.`);
        setBusy(false);
        return;
      }

      const res = await engine.rpc({
        table: 'business_inventory',
        fn: 'count_promote_create_inventory',
        args: {
          p_business_id:   businessId,
          p_actor_user_id: userId,
          p_name:          ctx.varietyName,
          p_qty:           qty,
          p_size:          target.size,
          p_variant_group: target.variantGroup,
          p_sku:           sku,            // already collision-checked + nulled above
          p_reason:        reason || null,
          p_source_id:     sessionId,
        },
      });
      if (res.status === 'failed') { setError(`Couldn't add the item: ${res.error}`); setBusy(false); return; }

      // Read back the id the RPC minted — required to link the count record. Online-only
      // (guarded above), so `applied` is the expected status here.
      const { data: made } = await supabase
        .from('business_inventory').select('id')
        .eq('business_id', businessId).eq('name', ctx.varietyName).eq('size', target.size)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      targetId = (made as { id: string } | null)?.id ?? null;
      outcome = 'created';
    }
    // else record-only: no group key AND no sibling (plant tag with no lot) → nothing to write.

    // 'filled' vs 'created' is the DEPLOYED-bar signal for D-49 — the two branches must be
    // distinguishable in the trail, because "created" on a stub count IS the defect.
    if (TRACE_INV) console.log('[TRACE:INVENTORY] promote —', outcome, {
      variety: ctx.varietyName, variant_group: key, size, qty, rowId: targetId,
      sku: target.action === 'create' ? target.sku : undefined,
      regrouped: target.action === 'create' ? target.regroup.length : 0,
    });

    const rawScan = reason ? `${ctx.rawScan} | recount-reason: ${reason}` : ctx.rawScan;
    await recordCount({
      inventory_id: targetId,
      plant_tag_id: ctx.plantTagId,
      item_label:   labelFor(ctx.varietyName, size),
      counted_qty:  qty,
      was_unknown:  outcome === 'record-only',
      raw_scan:     rawScan,
    });

    if (TRACE_COUNT) console.log('[TRACE:COUNT] save —', labelFor(ctx.varietyName, size), 'qty:', qty, 'row:', targetId, reason ? `recount: ${reason}` : '');
    const ck = countKey(ctx, size);
    if (ck) setSessionCounts(s => ({ ...s, [ck]: qty }));
    setCounted(c => [...c, { label: labelFor(ctx.varietyName, size), qty, flagged: outcome === 'record-only' }]);
    setResolved(null); setSizeInput(''); setQtyInput('');
    setBusy(false);
    setPhase('scanning');
  }

  // ── CONFLICT: resolve a within-session recount ────────────
  async function resolveConflict(keep: 'first' | 'second') {
    if (!conflict || !resolved) return;
    if (keep === 'first') {
      if (TRACE_COUNT) console.log('[TRACE:COUNT] recount resolved — KEEP FIRST', conflict.label, conflict.prevQty);
      setConflict(null); setConflictReason('');
      setResolved(null); setSizeInput(''); setQtyInput('');
      setPhase('scanning');
      return;
    }
    const reason = conflictReason.trim();
    if (TRACE_COUNT) console.log('[TRACE:COUNT] recount resolved — KEEP SECOND', conflict.label, conflict.newQty, 'reason:', reason || '(none)');
    const ctx = resolved;
    const size = sizeInput.trim() || null;
    const newQty = conflict.newQty;
    setConflict(null);
    await commitCount(ctx, size, newQty, reason || undefined);
    setConflictReason('');
  }

  // ── UNKNOWN branch: typed variety+size (RESOLVE-BEFORE-CREATE), or skip & flag ──
  async function saveUnknown(withEntry: boolean) {
    if (!businessId) return;
    setBusy(true); setError(null);

    if (!withEntry) {
      // Skip & flag — record-only, no promote (truly unknown; intake's job to create).
      const label = `Unrecognized — flagged (${unknownTag})`;
      await recordCount({ inventory_id: null, plant_tag_id: unknownTag || null, item_label: label, counted_qty: 0, was_unknown: true, raw_scan: unknownRaw });
      if (TRACE_COUNT) console.log('[TRACE:COUNT] save UNKNOWN — skip & flag:', unknownTag);
      setCounted(c => [...c, { label, qty: 0, flagged: true }]);
      resetUnknown(); setBusy(false); setPhase('scanning');
      return;
    }

    const name = unknownName.trim();
    if (!name) { setFieldErrors({ unknownName: 'Enter a variety, or choose Skip & flag.' }); setBusy(false); return; }
    const qty = parseInt(qtyInput, 10);
    if (isNaN(qty) || qty < 0) { setFieldErrors({ qty: 'Enter a count of 0 or more.' }); setBusy(false); return; }
    const size = unknownSize.trim() || null;

    // SIZE REQUIRED HERE TOO — and this is a deliberate widening of the review-sheet rule, on recon
    // rather than by symmetry. This sheet is NOT "a different surface with no family to break":
    //   • it runs RESOLVE-BEFORE-CREATE (below), so a typed name can land INSIDE an existing
    //     family — the same family, the same blast radius;
    //   • and on a genuinely new variety it always sets groupKey = slugify(name), so EVERY row it
    //     mints is in a family by construction.
    // A size-less row born here is the landmine that detonates when its second size arrives — that
    // IS the Basham's shape. The write gate in commitCount would refuse it anyway; refusing at the
    // sheet is what makes the refusal legible instead of a late error.
    if (!size) { setFieldErrors({ unknownSize: SIZE_REQUIRED_MESSAGE }); setBusy(false); return; }
    setFieldErrors({});

    // RESOLVE-BEFORE-CREATE: match the typed NAME to an existing variety (token-set equality,
    // the #61 resolver reused via resolveStockLine) BEFORE minting a new group — so varied
    // spellings/formats of ONE variety resolve to it instead of orphaning into separate groups.
    // (Boundary, honest: EQUALITY handles case/word-order/punctuation/separator variance; extra
    // words + plural stemming — "Big Boy" vs "Big Boy Tomato" vs "tomatoes" — are the deferred
    // L5-subset/L6-stemming layers and still mint a distinct variety.)
    const resolution = await resolveStockLine(supabase, businessId, name);

    if (resolution.kind === 'miss' && resolution.reason === 'ambiguous') {
      // >1 ungrouped same-name rows — can't safely pick or create (would risk a 3rd orphan).
      // Surface-don't-presume: record-only + flag (the variant_group backfill SQL fixes the data).
      if (TRACE_INV) console.warn('[TRACE:INVENTORY] typed promote AMBIGUOUS —', name, '→ record-only (surface-don’t-presume)');
      const label = `${labelFor(name, size)} (ambiguous — flagged)`;
      await recordCount({ inventory_id: null, plant_tag_id: unknownTag || null, item_label: label, counted_qty: qty, was_unknown: true, raw_scan: unknownRaw });
      setCounted(c => [...c, { label, qty, flagged: true }]);
      resetUnknown(); setBusy(false); setPhase('scanning');
      return;
    }

    const ctx: Ctx = ctxFromResolution(resolution, slugify(name), unknownRaw) ?? {
      // genuine NEW variety
      varietyName: name, groupKey: slugify(name), siblings: [], defaultSize: null, plantTagId: unknownTag || null, label: name, rawScan: unknownRaw,
    };
    ctx.plantTagId = unknownTag || null;
    ctx.rawScan = unknownRaw;
    if (TRACE_INV) console.log('[TRACE:INVENTORY] typed resolve-before-create —', name, '→', ctx.varietyName, 'group:', ctx.groupKey, 'siblings:', ctx.siblings.length);

    await commitCount(ctx, size, qty);
    resetUnknown();
  }

  function resetUnknown() {
    setUnknownName(''); setUnknownSize(''); setUnknownTag(''); setUnknownRaw(''); setQtyInput('');
    setFieldErrors({});
  }

  // Shared insert into inventory_counts + session item_count bump (routed through sync;
  // graceful if the migration's tables are absent).
  async function recordCount(row: {
    inventory_id: string | null; plant_tag_id: string | null; item_label: string;
    counted_qty: number; was_unknown: boolean; raw_scan: string;
  }) {
    if (tablesAbsent || !sessionId || !engine) {
      // D-50 LAYER 2A — the OLD message here read "inventory already updated", which named a
      // real hole: qty had moved and NOTHING recorded it. That hole is CLOSED — the movement
      // and its ledger row are now one transaction inside the RPC, so the movement IS on the
      // record even when this count-session row can't be written.
      //
      // ⚠️ THE GUARD ITSELF STAYS, AND THE PROMPT ASKED FOR IT TO GO — flagged, not silently
      // kept. It cannot be deleted: `inventory_counts` is a DIFFERENT table from the ledger,
      // and with no session id / no engine / the table genuinely absent there is nothing to
      // insert INTO. Deleting the guard would not restore a record, it would just throw on a
      // missing table. What was wrong was the CLAIM, so the claim is what changed.
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] count-session record skipped (tables absent / no session) — the MOVEMENT is still on the ledger (D-50):', row.item_label);
      return;
    }
    const res = await engine.insert({
      table: 'inventory_counts',
      row: { session_id: sessionId, business_id: businessId, ...row },
    });
    if (res.status === 'failed') {
      if (isMissingTable({ message: res.error })) { engine.forget(res.clientId); setTablesAbsent(true); return; }
      if (TRACE_COUNT) console.error('[TRACE:COUNT] count record FAILED —', res.error);
      return;
    }
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

  const counting = phase === 'scanning' || phase === 'reviewing' || phase === 'unknown' || phase === 'conflict';
  const matchedSib = resolved ? resolved.siblings.find(s => sameSize(s.size, sizeInput.trim() || null)) : undefined;
  // Only siblings that actually HAVE a size are pickable — a blank-size row is not a size.
  const sizeChips = resolved ? resolved.siblings.filter(s => (s.size ?? '').trim() !== '') : [];

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={exit} aria-label="Back to inventory"><ArrowLeft size={22} color="#1a2e0a" /></button>
        <h1 style={S.title}>Walk &amp; count</h1>
        <div style={{ flex: 1 }} />
        {counting && <span style={S.tally}>{counted.length} counted</span>}
      </div>

      {counting && !online && (
        <div style={S.offlineNote}>
          <CloudOff size={15} /> Offline — counts are saved on this phone and will sync when you're back in signal.
        </div>
      )}
      {counting && pending > 0 && (
        <button style={S.syncBtn} disabled={!online || busy} onClick={() => { if (engine) void engine.syncNow(); }}>
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
          <p style={S.lead}>Walk the lot and scan each plant tag. Pick which size you're counting, enter how many, save, and move to the next. Hit Complete when you're done.</p>
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

      {/* REVIEW sheet — resolved variety → pick/enter SIZE + qty */}
      {phase === 'reviewing' && resolved && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) { setPhase('scanning'); setResolved(null); } }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{resolved.varietyName}</h2>
              <button style={S.iconBtn} onClick={() => { setPhase('scanning'); setResolved(null); }} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            {resolved.groupKey == null && resolved.siblings.length === 0 && (
              <div style={S.note}>No stock lot is linked to this tag — your count is recorded, but there's no on-hand row to update.</div>
            )}

            <label style={S.label}>Which size? *</label>
            {/* Only rows that HAVE a size get a chip. A "(no size)" chip was a dead affordance
                (§1.6 item 5): tapping it blanked the field and the save is now refused, so it was a
                control that could only ever lead to a wall. A size-less row is not a size you can
                count — it is the thing the first real count FILLS (D-49). */}
            {sizeChips.length > 0 && (
              <div style={S.chipRow}>
                {sizeChips.map((s, i) => (
                  <button key={i} type="button"
                    style={sameSize(s.size, sizeInput.trim() || null) ? S.chipActive : S.chip}
                    onClick={() => pickSizeChip(s)}>
                    {s.size}{s.qty != null ? ` · ${s.qty}` : ''}
                  </button>
                ))}
              </div>
            )}
            <input
              style={{ ...S.input, ...errBorder(!!fieldErrors.size) }}
              value={sizeInput}
              onChange={e => { setSizeInput(e.target.value); if (fieldErrors.size) setFieldErrors(f => ({ ...f, size: '' })); }}
              placeholder="e.g. 30 gal, 5 gal, flat, 4 in"
            />
            <FieldError msg={fieldErrors.size} />
            <p style={S.hint}>
              {sizeChips.length > 0
                ? 'Pick an existing size or type a new one — a new size becomes its own stock row under this variety.'
                : 'Type the size you\'re counting — it becomes this variety\'s first stock row.'}
            </p>

            {matchedSib?.qty != null && (
              <p style={S.subtle}>On-hand now: <strong>{matchedSib.qty}</strong></p>
            )}
            {error && <div style={S.error}>{error}</div>}
            <label style={S.label}>How many did you count?</label>
            <input style={{ ...S.qtyInput, ...errBorder(!!fieldErrors.qty) }} type="number" inputMode="numeric" min="0" value={qtyInput}
              onChange={e => { setQtyInput(e.target.value); if (fieldErrors.qty) setFieldErrors(f => ({ ...f, qty: '' })); }} autoFocus />
            <FieldError msg={fieldErrors.qty} />
            <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void saveAndNext()}>
              {busy ? 'Saving…' : 'Save → Next'}
            </button>
          </div>
        </div>
      )}

      {/* CONFLICT sheet — same (variety × size) counted twice this session */}
      {phase === 'conflict' && conflict && (
        <div style={S.modal}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Already counted this one</h2>
            </div>
            <p style={S.subtle}>You already counted <strong>{conflict.label}</strong> this session.</p>
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
            <input style={S.input} value={conflictReason} onChange={e => setConflictReason(e.target.value)} placeholder="e.g. one sold at lunch" />
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

      {/* UNKNOWN sheet — typed variety + size (resolve-before-create) or skip & flag */}
      {phase === 'unknown' && (
        <div style={S.modal}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Didn't recognize this</h2>
              <button style={S.iconBtn} onClick={() => setPhase('scanning')} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>Scanned: <code style={S.code}>{unknownTag}</code></p>
            {error && <div style={S.error}>{error}</div>}
            <label style={S.label}>Variety *</label>
            <input style={{ ...S.input, ...errBorder(!!fieldErrors.unknownName) }} value={unknownName}
              onChange={e => { setUnknownName(e.target.value); if (fieldErrors.unknownName) setFieldErrors(f => ({ ...f, unknownName: '' })); }}
              placeholder="e.g. Live Oak" />
            <FieldError msg={fieldErrors.unknownName} />
            {/* Was "Size (optional)". It is NOT optional: this sheet resolves-before-creates into
                existing families, and always groups what it mints — so a blank size here is the same
                landmine as on the review sheet, just born in a different room. */}
            <label style={S.label}>Size *</label>
            <input style={{ ...S.input, ...errBorder(!!fieldErrors.unknownSize) }} value={unknownSize}
              onChange={e => { setUnknownSize(e.target.value); if (fieldErrors.unknownSize) setFieldErrors(f => ({ ...f, unknownSize: '' })); }}
              placeholder="e.g. 45 gal, flat, 4 in" />
            <FieldError msg={fieldErrors.unknownSize} />
            <p style={S.hint}>We'll match this to an existing variety if we can, so different spellings don't split into separate items. Not sure of the size? Use <b>Skip &amp; flag</b> below — that records the count without guessing.</p>
            <label style={S.label}>Count</label>
            <input style={{ ...S.qtyInput, ...errBorder(!!fieldErrors.qty) }} type="number" inputMode="numeric" min="0" value={qtyInput}
              onChange={e => { setQtyInput(e.target.value); if (fieldErrors.qty) setFieldErrors(f => ({ ...f, qty: '' })); }} />
            <FieldError msg={fieldErrors.qty} />
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
                  <span style={c.flagged ? S.summaryLabelFlag : S.summaryLabel}>{c.label}</span>
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
  // CENTERED per the platform modal standard (docs/standards/ui-control-standards.md → MODAL).
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 100 } as React.CSSProperties,
  sheet:      { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' } as React.CSSProperties,
  sheetTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4 } as React.CSSProperties,
  subtle:     { color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1rem' } as React.CSSProperties,
  subtleSm:   { color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem', lineHeight: 1.4 } as React.CSSProperties,
  hint:       { color: '#6b7280', fontSize: '0.78rem', margin: '-6px 0 14px', lineHeight: 1.4 } as React.CSSProperties,
  note:       { background: '#eef2ff', color: '#3730a3', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: 12 } as React.CSSProperties,
  code:       { background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', fontSize: '0.82rem', color: '#374151' } as React.CSSProperties,
  label:      { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 } as React.CSSProperties,
  input:      { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.7rem 0.85rem', fontSize: '1rem', color: '#111827', boxSizing: 'border-box', marginBottom: 14 } as React.CSSProperties,
  qtyInput:   { width: '100%', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.8rem 0.85rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827', boxSizing: 'border-box', marginBottom: 16, textAlign: 'center' } as React.CSSProperties,
  chipRow:    { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 } as React.CSSProperties,
  chip:       { background: '#fff', color: '#27500A', border: '1.5px solid #27500A', borderRadius: 20, padding: '6px 14px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  chipActive: { background: '#27500A', color: '#fff', border: '1.5px solid #27500A', borderRadius: 20, padding: '6px 14px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  error:      { color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.86rem', marginBottom: 12 } as React.CSSProperties,
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
