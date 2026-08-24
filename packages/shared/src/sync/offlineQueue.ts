// ============================================================
// sync/offlineQueue — the typed offline-op queue (FIFO, persisted, idempotent).
// PURPOSE:  Holds writes that couldn't reach the DB yet (dead zone) and survives
//           a reload. enqueue is idempotent by clientId so a double-submit can't
//           double-queue. This is the half DataBridge had as a SHAPE but never
//           drained (recon §4 — write-only queue, no consumer); the drain lives
//           in syncEngine.
// DEPENDENCIES: NamespacedStore (persistence), OfflineOp (envelope).
// OUTPUTS:  OfflineQueue { list, enqueue, remove, size, probe }.
//
// 🔴 ENQUEUE RETURNS WHETHER IT PERSISTED (2026-08-24). The queue's whole promise is DURABILITY
// — an op survives a reload — and that promise is only kept if the underlying write landed. When
// `store.save()` swallowed its failure, `enqueue()` returned normally over a queue that had not
// grown, and every caller above it reported success. The outcome now travels up.
// ============================================================

import { NamespacedStore } from './store';
import type { StoreWriteResult } from './store';
import type { OfflineOp } from './types';

const QUEUE_KEY = 'queue';

export class OfflineQueue {
  private store: NamespacedStore;
  constructor(store: NamespacedStore) { this.store = store; }

  list(): OfflineOp[] { return this.store.load<OfflineOp[]>(QUEUE_KEY, []); }

  private write(ops: OfflineOp[]): StoreWriteResult { return this.store.save(QUEUE_KEY, ops); }

  /**
   * Idempotent enqueue — a clientId already present is a no-op (re-submit guard).
   * Returns whether the queue actually PERSISTED; an already-present op is `ok` because the
   * durable state the caller wanted is already on disk.
   */
  enqueue(op: OfflineOp): StoreWriteResult {
    const ops = this.list();
    if (ops.some(o => o.clientId === op.clientId)) return { ok: true };
    ops.push(op);
    return this.write(ops);
  }

  remove(clientId: string): StoreWriteResult {
    return this.write(this.list().filter(o => o.clientId !== clientId));
  }

  size(): number { return this.list().length; }

  /** Is the backing store usable at all? Delegates to the one probe (§6 r8, no second copy). */
  probe(): StoreWriteResult { return this.store.probe(); }
}
