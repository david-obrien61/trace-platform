// ============================================================
// assets/assetBlobStore — device-side hold for COMPRESSED asset-capture images.
// PURPOSE:  The dead-zone half of asset capture (recon #4, 2026-07-01). The #57
//           sync slice queues SMALL STRUCTURED ops over localStorage (string
//           values) — it cannot hold image bytes. This is the NET-NEW capability:
//           an async IndexedDB store that holds a compressed capture's bytes
//           (base64) + its envelope until the device reconnects, when the
//           orchestrator drains it (Vision → cost_objects insert → delete). Blobs
//           are small post-compression (~500KB) so holding several is cheap.
//           Kept SEPARATE from the #57 queue so that queue stays string-clean:
//           the queue never carries bytes, only the id reference on drain.
// DEPENDENCIES: IndexedDB when present; falls back to an in-memory Map
//           (SSR / Node / tests — process-lifetime only, does not survive reload;
//           the degenerate no-DOM case, mirroring NamespacedStore's philosophy).
// OUTPUTS:  putPendingAsset / listPendingAssets / deletePendingAsset /
//           countPendingAssets — all tenant-scoped by businessId (AC-3).
// ============================================================

export interface PendingAssetCapture {
  id:         string;        // client-generated uuid = the cost_objects row id on insert (idempotent)
  base64:     string;        // COMPRESSED image bytes, base64 (no data: prefix) — ready for the OCR POST
  mimeType:   string;        // 'image/jpeg' after compression (or original for PDF pass-through)
  sizeBytes:  number;        // compressed size, for the "N held" UI + telemetry
  businessId: string;        // tenant scope (AC-3) — never drained cross-tenant
  userId:     string | null; // WHO captured — identity stamp rides the record
  clientTs:   string;        // ISO time at capture — ordering + audit
}

const DB_NAME  = 'trace-assets';
const STORE    = 'pending';
const DB_VER   = 1;

// ── In-memory fallback (no IndexedDB: SSR / Node / test) ──────────────────────
const mem = new Map<string, PendingAssetCapture>();
function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('businessId', 'businessId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

// A single transaction wrapped in a promise. Every caller closes the db.
async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error ?? new Error('indexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

/** Hold a compressed capture until reconnect. Idempotent by id (a re-put overwrites the same row). */
export async function putPendingAsset(capture: PendingAssetCapture): Promise<void> {
  if (!hasIDB()) { mem.set(capture.id, capture); return; }
  await tx('readwrite', (s) => s.put(capture));
}

/** All held captures for ONE business (tenant-scoped, AC-3), oldest first. */
export async function listPendingAssets(businessId: string): Promise<PendingAssetCapture[]> {
  if (!hasIDB()) {
    return Array.from(mem.values())
      .filter((c) => c.businessId === businessId)
      .sort((a, b) => a.clientTs.localeCompare(b.clientTs));
  }
  const all = await tx<PendingAssetCapture[]>('readonly', (s) => s.getAll() as IDBRequest<PendingAssetCapture[]>);
  return all
    .filter((c) => c.businessId === businessId)
    .sort((a, b) => a.clientTs.localeCompare(b.clientTs));
}

/** Drop a capture once its cost_objects row is durably written. */
export async function deletePendingAsset(id: string): Promise<void> {
  if (!hasIDB()) { mem.delete(id); return; }
  await tx('readwrite', (s) => s.delete(id));
}

/** How many captures are held for a business (drives the "N held offline" chip). */
export async function countPendingAssets(businessId: string): Promise<number> {
  return (await listPendingAssets(businessId)).length;
}
