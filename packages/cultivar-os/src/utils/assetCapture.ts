// ============================================================
// utils/assetCapture — the asset capture→value→write orchestrator (Cultivar-side).
// PURPOSE:  Below the two-door fork, ONE pipeline: compress (reuse) → Vision via
//           the OCR `shape:'asset'` seam (zero new Vercel functions) → write a REAL
//           cost_objects ASSET row (estimated_value @ ESTIMATED — never notes-JSON).
//           Online → written now. No signal → the COMPRESSED blob is held in the
//           shared IndexedDB store + drained on reconnect (Vision + insert then).
//           Home = Cultivar (not shared) for dependency locality: compression,
//           the supabase client, and the OCR endpoint are all app-resident. The
//           reusable half (the blob hold) lives in @trace/shared/assets. AC-1: the
//           category VOCABULARY is passed in as a value (categoryHint) — no vertical
//           noun is baked into the shared seam.
// DEPENDENCIES: resizeAndCompressImage (compression), @trace/shared/sync SyncEngine
//           (idempotent, offline-durable insert), @trace/shared/assets blob store,
//           /api/receipts/ocr (shape:'asset').
// OUTPUTS:  captureAsset · promoteAssetValue · drainPendingAssets · CaptureOutcome.
// ============================================================

import type { SyncEngine } from '@trace/shared/sync';
import {
  putPendingAsset, listPendingAssets, deletePendingAsset,
  type PendingAssetCapture,
} from '@trace/shared/assets';
import { resizeAndCompressImage } from './imageCompression';

const TRACE_ASSET = true; // [TRACE:ASSET] STD-003 — ON until OWNER-PROVEN (standing hold)

const COST_OBJECTS = 'cost_objects';

export interface CaptureCtx {
  engine:     SyncEngine;     // shared idempotent/offline write path
  businessId: string;
  userId:     string | null;
  online:     boolean;
}

// Raw parsed shape returned by the OCR asset prompt.
interface AssetOcr {
  name?:            string | null;
  category?:        string | null;
  estimated_value?: number | null;
  confidence?:      string | null; // HIGH|MEDIUM|LOW (Vision's self-report — informational)
}

export interface CaptureOutcome {
  id:              string;
  status:          'captured' | 'held';   // written now, or held offline for reconnect
  name:            string;
  category:        string | null;
  estimatedValue:  number | null;         // never 0 — null = unknown worth (Surface Honesty)
  visionConfidence: string | null;
  error?:          string;
}

// NOT NULL name column — an honest placeholder when Vision can't identify the object.
// Owner renames it on the desktop datasheet. Never a fabricated brand/model.
const UNIDENTIFIED = 'Unidentified asset (from photo)';

// A "the estimated_value columns aren't applied yet" reject — deploy-window safe.
function isMissingValueColumn(err?: string): boolean {
  if (!err) return false;
  return /estimated_value/.test(err) && /(does not exist|schema cache|column)/i.test(err);
}

async function runAssetOcr(
  base64: string, mimeType: string, businessId: string, userId: string | null, categoryHint?: string,
): Promise<AssetOcr | null> {
  try {
    const res = await fetch('/api/receipts/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, userId, imageBase64: base64, mimeType, shape: 'asset', categoryHint }),
    });
    if (!res.ok) {
      if (TRACE_ASSET) console.log('[TRACE:ASSET] vision — non-ok', res.status);
      return null;
    }
    const json = await res.json();
    if (TRACE_ASSET) console.log('[TRACE:ASSET] vision — parsed', {
      name: json?.parsed?.name, category: json?.parsed?.category,
      estimated_value: json?.parsed?.estimated_value, confidence: json?.parsed?.confidence,
      provider: json?.provider,
    });
    return (json?.parsed ?? null) as AssetOcr | null;
  } catch (e) {
    // fetch threw → treat as no signal (the caller will hold the blob).
    if (TRACE_ASSET) console.log('[TRACE:ASSET] vision — threw (offline?)', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Map a Vision result onto a real cost_objects ASSET row. estimated_value lands at
// ESTIMATED (owner promotes → CONFIRMED); acquisition_cost stays UNKNOWN (we captured
// worth, not what-was-paid). Value is NEVER coerced to 0 — null stays null (UNKNOWN).
function buildAssetRow(id: string, businessId: string, ocr: AssetOcr | null, withValueCols: boolean) {
  const value = typeof ocr?.estimated_value === 'number' && isFinite(ocr.estimated_value) && ocr.estimated_value > 0
    ? ocr.estimated_value : null;
  const row: Record<string, unknown> = {
    id,
    business_id:       businessId,
    node_type:         'ASSET',
    name:              (ocr?.name && ocr.name.trim()) ? ocr.name.trim() : UNIDENTIFIED,
    cost_category:     (ocr?.category && ocr.category.trim()) ? ocr.category.trim() : null,
    acquisition_cost:  null,                 // not captured here — what-it's-worth, not what-paid
    cost_confidence:   'UNKNOWN',
    cost_source:       'AI_VISION',          // provenance (cost_source is NO-CHECK, grows freely)
    substantiation:    'OWNER_ASSERTED',
    status:            'ACTIVE',
  };
  if (withValueCols) {
    row.estimated_value            = value;
    row.estimated_value_confidence = value === null ? 'UNKNOWN' : 'ESTIMATED';
  }
  return row;
}

// Insert with the estimated_value columns; on the pre-migration deploy window
// (columns absent) forget the poison op and retry WITHOUT them so capture never
// hard-fails before the migration lands (mirrors the deliveries service_type path).
async function insertAssetRow(ctx: CaptureCtx, id: string, ocr: AssetOcr | null): Promise<string | undefined> {
  const first = await ctx.engine.insert({ table: COST_OBJECTS, clientId: id, row: buildAssetRow(id, ctx.businessId, ocr, true) });
  if (first.status !== 'failed') return undefined;
  if (isMissingValueColumn(first.error)) {
    if (TRACE_ASSET) console.warn('[TRACE:ASSET] estimated_value columns absent — inserting without (apply 20260701 migration)');
    ctx.engine.forget(id);
    const retry = await ctx.engine.insert({ table: COST_OBJECTS, clientId: id, row: buildAssetRow(id, ctx.businessId, ocr, false) });
    return retry.status === 'failed' ? retry.error : undefined;
  }
  return first.error;
}

/**
 * One file through the whole pipeline. Compress ALWAYS (so an imported full-res
 * photo compresses too, not just live-captured). Online → Vision + write now.
 * No signal (offline OR Vision unreachable) → hold the compressed blob for drain.
 */
export async function captureAsset(file: File, ctx: CaptureCtx, categoryHint?: string): Promise<CaptureOutcome> {
  const id = ctx.engine.newId();
  const { base64, sizeBytes, mimeType } = await resizeAndCompressImage(file);
  if (TRACE_ASSET) console.log('[TRACE:ASSET] capture — compressed', { id, sizeBytes, mimeType, online: ctx.online });

  const ocr = ctx.online ? await runAssetOcr(base64, mimeType, ctx.businessId, ctx.userId, categoryHint) : null;

  // No Vision result while "online" means the request failed on the wire → treat as
  // no-signal and HOLD (don't write a nameless row). Genuinely offline → HOLD.
  if (!ctx.online || ocr === null) {
    const pending: PendingAssetCapture = {
      id, base64, mimeType, sizeBytes,
      businessId: ctx.businessId, userId: ctx.userId, clientTs: new Date().toISOString(),
    };
    await putPendingAsset(pending);
    if (TRACE_ASSET) console.log('[TRACE:ASSET] capture — HELD (no signal / vision unreachable)', { id });
    return { id, status: 'held', name: 'Pending photo', category: null, estimatedValue: null, visionConfidence: null };
  }

  const err = await insertAssetRow(ctx, id, ocr);
  const value = typeof ocr.estimated_value === 'number' && ocr.estimated_value > 0 ? ocr.estimated_value : null;
  if (TRACE_ASSET) console.log('[TRACE:ASSET] capture — WROTE cost_objects ASSET', { id, name: ocr.name, value, err });
  return {
    id, status: 'captured',
    name: (ocr.name && ocr.name.trim()) ? ocr.name.trim() : UNIDENTIFIED,
    category: (ocr.category && ocr.category.trim()) ? ocr.category.trim() : null,
    estimatedValue: value,
    visionConfidence: ocr.confidence ?? null,
    error: err,
  };
}

/**
 * Owner edited the value at capture (or refines it) → promote to CONFIRMED. The
 * single explicit owner-edit→CONFIRMED action. Scoped to the row + business_id (AC-3).
 */
export async function promoteAssetValue(ctx: CaptureCtx, id: string, value: number): Promise<string | undefined> {
  const res = await ctx.engine.update({
    table: COST_OBJECTS,
    set:   { estimated_value: value, estimated_value_confidence: 'CONFIRMED' },
    match: { id, business_id: ctx.businessId },
  });
  if (TRACE_ASSET) console.log('[TRACE:ASSET] promote value → CONFIRMED', { id, value, status: res.status });
  return res.status === 'failed' ? res.error : undefined;
}

/**
 * Drain every held capture for this business on reconnect: Vision → write → delete.
 * Auto-lands ESTIMATED (batch/offline captures are refined on the desktop datasheet).
 * Returns how many were drained. Stops early if a Vision call fails (still no signal).
 */
export async function drainPendingAssets(ctx: CaptureCtx, categoryHint?: string): Promise<number> {
  if (!ctx.online) return 0;
  const held = await listPendingAssets(ctx.businessId);
  if (held.length === 0) return 0;
  if (TRACE_ASSET) console.log('[TRACE:ASSET] drain — start', { count: held.length });
  let drained = 0;
  for (const cap of held) {
    const ocr = await runAssetOcr(cap.base64, cap.mimeType, cap.businessId, cap.userId, categoryHint);
    if (ocr === null) {
      if (TRACE_ASSET) console.log('[TRACE:ASSET] drain — vision still unreachable, stopping', { id: cap.id });
      break; // still no signal — keep the rest for the next reconnect
    }
    const err = await insertAssetRow({ ...ctx }, cap.id, ocr);
    if (err) {
      if (TRACE_ASSET) console.warn('[TRACE:ASSET] drain — insert failed, keeping blob', { id: cap.id, err });
      break; // genuine reject — keep the blob for a deliberate retry, don't lose the photo
    }
    await deletePendingAsset(cap.id);
    drained++;
    if (TRACE_ASSET) console.log('[TRACE:ASSET] drain — wrote + cleared', { id: cap.id, name: ocr.name });
  }
  if (TRACE_ASSET) console.log('[TRACE:ASSET] drain — done', { drained, remaining: held.length - drained });
  return drained;
}
