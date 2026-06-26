// ============================================================
// sync/offlineQueue — the typed offline-op queue (FIFO, persisted, idempotent).
// PURPOSE:  Holds writes that couldn't reach the DB yet (dead zone) and survives
//           a reload. enqueue is idempotent by clientId so a double-submit can't
//           double-queue. This is the half DataBridge had as a SHAPE but never
//           drained (recon §4 — write-only queue, no consumer); the drain lives
//           in syncEngine.
// DEPENDENCIES: NamespacedStore (persistence), OfflineOp (envelope).
// OUTPUTS:  OfflineQueue { list, enqueue, remove, size }.
// ============================================================

import { NamespacedStore } from './store';
import type { OfflineOp } from './types';

const QUEUE_KEY = 'queue';

export class OfflineQueue {
  private store: NamespacedStore;
  constructor(store: NamespacedStore) { this.store = store; }

  list(): OfflineOp[] { return this.store.load<OfflineOp[]>(QUEUE_KEY, []); }

  private write(ops: OfflineOp[]): void { this.store.save(QUEUE_KEY, ops); }

  // Idempotent enqueue — a clientId already present is a no-op (re-submit guard).
  enqueue(op: OfflineOp): void {
    const ops = this.list();
    if (ops.some(o => o.clientId === op.clientId)) return;
    ops.push(op);
    this.write(ops);
  }

  remove(clientId: string): void {
    this.write(this.list().filter(o => o.clientId !== clientId));
  }

  size(): number { return this.list().length; }
}
