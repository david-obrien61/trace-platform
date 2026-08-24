import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { resolveStockLine, stockLineColumnsFor } from '@trace/shared/inventory';
import type { StockLineRow, ReadFailure } from '@trace/shared/inventory';
import { isConnectivityError } from '@trace/shared/utils/supabaseError';
import type { Plant, PlantEvent } from '../types/plant';
import { synthesizePlant } from '../lib/stockLinePlant';

const TRACE_RESOLVE = true; // [TRACE:RESOLVE] STD-003 — which lane resolved; on until OWNER-PROVEN

// A size the customer must choose between when a scanned variety resolves to >1 sized
// stock line (L5 NEED_CLARIFICATION). Choosing one synthesizes the plant for that row.
// Not exported — PlantProfile consumes it via usePlant's inferred return type.
interface PlantSizeChoice {
  inventoryId: string;
  size:        string;
  qty:         number | null;
}

interface UsePlantResult {
  plant:          Plant | null;
  events:         PlantEvent[];
  availableCount: number;
  loading:        boolean;
  error:          string | null;
  /** 🔴 R-11: NON-NULL WHEN THE LOOK-UP NEVER REACHED THE SERVER (or the server refused).
   *  It is NOT the same fact as `error` and must not be rendered with the same words: `error`
   *  answers "we looked, and this tag is not here"; this answers "we could not look."
   *  Before 2026-08-23 the second collapsed into the first and the profile told a customer the
   *  tag did not match any plant in the nursery — from a dead zone, having read nothing. */
  readFailure:    ReadFailure | null;
  // Non-null when the scan resolved to a multi-size stock line and the customer must pick
  // (the profile renders a size chooser instead of the plant). chooseSize resolves it.
  sizeChoices:    PlantSizeChoice[] | null;
  chooseSize:     (inventoryId: string) => void;
  // 'specimen' = a real cultivar_plants row; 'stock_line' = synthesized from business_inventory.
  resolvedVia:    'specimen' | 'stock_line' | null;
}

// ── THE 24-HOUR READ CACHE — DECLARED 2026-08-23, NOT INTRODUCED ─────────────────────────────
// 🔴 THIS EXISTED, UNDOCUMENTED, SINCE THE PROFILE WAS BUILT. It was in no inventory doc, on no
// board, in no handoff entry, and the offline recon (2026-08-23) found it by reading the file.
// It is written down HERE, at the site, because that is the only place it cannot go stale.
//
// WHAT IT IS: every successful plant resolution is mirrored into `localStorage` under
// `plant_cache:<tagId>` and seeded into initial state BEFORE any network call (`usePlant`'s
// first two lines). So a tag scanned in the last 24 hours RENDERS OFFLINE, with no queue, no
// service worker and no network — which is genuinely useful on a customer-facing page held in
// a dead zone at the back of the lot.
//
// WHY IT IS KEPT: it is the ONLY offline capability the QR profile has, and removing it would
// make a page a CUSTOMER may be holding fail where it currently works.
//
// ⚠️ ITS HONEST COST, STATED RATHER THAN DISCOVERED AGAIN: on a cache HIT the page renders
// SILENTLY STALE — up to 24h old qty, price and status, with nothing on screen saying so.
// That is a Surface-Honesty (D-9) gap and it is NOT closed by this build. What closing it needs
// is a served-from-cache signal the page can render: `usePlant` would have to report WHICH
// state came from the cache and whether the network read that should have replaced it failed.
// The hook now carries `readFailure` (below), which is HALF of that — a caller can tell that
// the refresh failed. The other half — a per-field "this figure is from <time>" — is a
// PlantProfile render change with a real design question in it (a customer-facing staleness
// banner is a different decision from an operator-facing one), and is NAMED, NOT MADE here.
//
// It is invalidated three ways: TTL, a pre-`business_id` shape, and any parse failure.
interface PlantCache {
  plant:          Plant;
  events:         PlantEvent[];
  availableCount: number;
  cachedAt:       number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readCache(tagId: string): PlantCache | null {
  try {
    const raw = localStorage.getItem(`plant_cache:${tagId}`);
    if (!raw) return null;
    const entry: PlantCache = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    // Invalidate caches written before the business_id migration
    if (!entry.plant?.business_id) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(tagId: string, data: Omit<PlantCache, 'cachedAt'>): void {
  try {
    localStorage.setItem(`plant_cache:${tagId}`, JSON.stringify({ ...data, cachedAt: Date.now() }));
  } catch {
    /* non-fatal — storage full or private browsing */
  }
}

// synthesizePlant (D-34) is shared with the multi-item scan-loop — one definition in
// ../lib/stockLinePlant (CLAUDE.md §6 rule 8, no drifted copy).

export function usePlant(tagId: string | undefined): UsePlantResult {
  const cached = tagId ? readCache(tagId) : null;
  const { businessId, can } = useBusinessContext();
  // #81 (2026-07-30): the embedded business_inventory select named unit_cost unconditionally, so
  // a plant profile handed the owner's cost basis to any member who could open a plant. Does NOT
  // close the leak (RLS is row-level; the base table still grants the column) — it removes it
  // from this payload and is prerequisite work for #81 option (b).
  const canViewCosts = can('costs:read');

  const [plant,          setPlant]          = useState<Plant | null>(cached?.plant ?? null);
  const [events,         setEvents]         = useState<PlantEvent[]>(cached?.events ?? []);
  const [availableCount, setAvailableCount] = useState(cached?.availableCount ?? 1);
  const [loading,        setLoading]        = useState(!cached);
  const [error,          setError]          = useState<string | null>(null);
  const [readFailure,    setReadFailure]    = useState<ReadFailure | null>(null);
  const [sizeChoices,    setSizeChoices]    = useState<PlantSizeChoice[] | null>(null);
  const [resolvedVia,    setResolvedVia]    = useState<'specimen' | 'stock_line' | null>(cached ? 'specimen' : null);
  // Candidate rows held so a size pick synthesizes without a re-query.
  const [candidates,     setCandidates]     = useState<StockLineRow[]>([]);

  useEffect(() => {
    if (!tagId) return;

    let cancelled = false;

    async function fetchFromNetwork() {
      if (!readCache(tagId!)) setLoading(true);
      setError(null);
      setReadFailure(null);
      setSizeChoices(null);
      setCandidates([]);

      // (L1 — specimen) Join business_inventory via inventory_id FK. A real cultivar_plants
      // row WINS if present (the vertical identity lane); the stock-line fallback is only for
      // a lot that has no specimen row (the discovery-seeded catalog, D-34).
      const { data: plantData, error: plantErr } = await supabase
        .from('cultivar_plants')
        .select(canViewCosts
          ? '*, business_inventory ( id, qty, unit_cost, sell_price, status, received_at )'
          : '*, business_inventory ( id, qty, sell_price, status, received_at )')
        .ilike('tag_id', tagId!)
        .maybeSingle();

      if (plantData && !plantErr) {
        const { data: eventData } = await supabase
          .from('plant_events')
          .select('*')
          .eq('plant_id', plantData.id)
          .order('occurred_at', { ascending: true });

        // availableCount comes from the lot's qty field.
        const resolvedCount = (plantData.business_inventory as any)?.qty ?? 1;

        if (!cancelled) {
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — cultivar_plants HIT (specimen):', tagId);
          const resolvedEvents = (eventData ?? []) as PlantEvent[];
          setPlant(plantData as Plant);
          setEvents(resolvedEvents);
          setAvailableCount(resolvedCount);
          setResolvedVia('specimen');
          setLoading(false);
          writeCache(tagId!, { plant: plantData as Plant, events: resolvedEvents, availableCount: resolvedCount });
        }
        return;
      }

      // (L2→L5 — stock-line FALLBACK) No specimen row. Resolve the scanned tag against
      // business_inventory generically (SKU → name token-equality → size-picker) and
      // synthesize a plant from the lot. business_id-scoped (AC-3); needs a business
      // session (business_inventory has owner/member RLS, no anon read) — an anon scan
      // with no session simply falls through to "not found", as before.
      if (businessId) {
        // #81 (2026-08-23): the SIBLING of the gated specimen read 33 lines above. That read was
        // narrowed on 2026-07-30 and THIS ONE WAS NOT — and this is the D-34 lane every
        // discovery-seeded and CSV-imported lot takes, i.e. LAWNS's actual catalog. So the fix
        // that closed the specimen path left the path most rows actually use wide open.
        // The column shape follows the SESSION, exactly as :102-105 does — same predicate, same
        // hook, no second rule.
        const columns = stockLineColumnsFor(canViewCosts);
        if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — stock-line columns:', canViewCosts ? 'cost-bearing (costs:read)' : 'NO-COST (unit_cost withheld)');
        const read = await resolveStockLine(supabase, businessId, tagId!, { columns });

        // 🔴 THE FAILURE BRANCH, FIRST — and `tsc` will not let it be skipped (R-11). A dead zone
        // used to arrive here as `miss` and fall through to "Plant not found", i.e. a confident
        // statement about a catalog nobody read.
        if (!read.ok) {
          if (cancelled) return;
          if (TRACE_RESOLVE) console.warn('[TRACE:RESOLVE] usePlant — stock-line read FAILED (' + read.error.kind + '):', read.error.message);
          setReadFailure(read.error);
          setError(null);           // NOT a not-found; the profile renders the unreachable state
          setLoading(false);
          return;
        }
        const resolution = read.value;

        if (resolution.kind === 'resolved') {
          if (cancelled) return;
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — cultivar_plants MISS → business_inventory', resolution.via, '(stock line):', resolution.row.name);
          const synth = synthesizePlant(resolution.row, businessId, tagId!);
          setPlant(synth);
          setEvents([]);                              // a stock line has no per-specimen timeline
          setAvailableCount(resolution.row.qty ?? 1);
          setResolvedVia('stock_line');
          setLoading(false);
          writeCache(tagId!, { plant: synth, events: [], availableCount: resolution.row.qty ?? 1 });
          return;
        }

        if (resolution.kind === 'collision') {
          if (cancelled) return;
          if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — stock-line size collision → picker:', resolution.candidates.map(c => (c.size ?? '').trim()).join(' / '));
          setCandidates(resolution.candidates);
          setSizeChoices(resolution.candidates.map(c => ({
            inventoryId: c.id,
            size:        (c.size ?? '').trim(),
            qty:         c.qty ?? null,
          })));
          setPlant(null);
          setResolvedVia('stock_line');
          setLoading(false);
          return;
        }
      }

      // Nothing matched, in any lane.
      //
      // ⚠️ ONE LINE BEYOND THE THREE RESOLVER READS, AND THE REASON IS ON THIS SCREEN: when there
      // is NO business session (an anonymous customer scanning a tag in the lot), the stock-line
      // lane above never runs, so its ReadResult never exists and a dead zone would still land
      // here and say "Plant not found". The L1 specimen read's error is already captured — it
      // just was not being CLASSIFIED. Running it through the SAME shared predicate (§6 r8, never
      // a second regex) closes the identical lie on the identical modal for the one visitor who
      // has no session, and it adds no read.
      if (!cancelled) {
        if (isConnectivityError(plantErr)) {
          if (TRACE_RESOLVE) console.warn('[TRACE:RESOLVE] usePlant — specimen read FAILED (offline):', plantErr?.message);
          setReadFailure({ kind: 'offline', message: plantErr?.message ?? 'unknown read failure' });
          setLoading(false);
          return;
        }
        if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — UNRESOLVED (no specimen, no stock line):', tagId);
        if (!plant) setError(plantErr?.message ?? 'Plant not found');
        setLoading(false);
      }
    }

    fetchFromNetwork();
    return () => { cancelled = true; };
  }, [tagId, businessId, canViewCosts]);   // canViewCosts: #81 — the select's column list depends on it, so a
                                          // permission resolving AFTER first render must re-fetch, not serve a stale shape.

  // The customer chose a size from the collision picker → synthesize that stock line.
  function chooseSize(inventoryId: string) {
    const row = candidates.find(c => c.id === inventoryId);
    if (!row || !businessId || !tagId) return;
    if (TRACE_RESOLVE) console.log('[TRACE:RESOLVE] usePlant — size chosen (stock line):', (row.size ?? '').trim(), '→ row:', row.id);
    const synth = synthesizePlant(row, businessId, tagId);
    setPlant(synth);
    setEvents([]);
    setAvailableCount(row.qty ?? 1);
    setSizeChoices(null);
    setError(null);
    setReadFailure(null);
    writeCache(tagId, { plant: synth, events: [], availableCount: row.qty ?? 1 });
  }

  return { plant, events, availableCount, loading, error, readFailure, sizeChoices, chooseSize, resolvedVia };
}
