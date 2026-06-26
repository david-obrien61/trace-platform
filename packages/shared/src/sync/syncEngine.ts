// ============================================================
// sync/syncEngine — write-through-WHEN-online OR enqueue-WHEN-offline + reconnect drain.
// PURPOSE:  The reconcile loop DataBridge never finished (recon §4). One write
//           path for BOTH connectivity states: a write is always durably queued,
//           then drained immediately if online (so Lauren watches it sync and the
//           desktop stays current) — or held in a dead zone and drained on the
//           `online` event / a manual syncNow(). Replay is FIFO and idempotent
//           (insert PK = clientId → a 23505 on replay is "already applied").
// DEPENDENCIES: a SupabaseClient (injected — vertical-agnostic, testable),
//           OfflineQueue + NamespacedStore (durability), browser online events.
// OUTPUTS:  SyncEngine { insert, update, syncNow, start, stop, pendingCount, forget, newId }.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { NamespacedStore } from './store';
import { OfflineQueue } from './offlineQueue';
import type { OfflineOp, UpdatePayload, WriteResult, DrainResult } from './types';

const TRACE_SYNC = true; // [TRACE:SYNC] STD-003 — on until OWNER-PROVEN

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Defensive fallback only where Web Crypto is absent (old runtimes).
  return 'oid-' + Array.from({ length: 16 }, (_, i) => i).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// A drain step outcome: applied (drop it), retry (connectivity — stop, keep order),
// or a hard reject (genuine error — surface it, keep the op for a deliberate retry).
type StepResult = 'applied' | 'retry' | { failed: true; error: string };

// supabase-js surfaces connectivity failures as a thrown TypeError or an error
// object with NO postgres/PostgREST code and a fetch/network-shaped message.
function isConnectivityError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code) return false; // a coded error is a real DB response, not a dead zone
  return /fetch|network|timeout|connection|offline|load failed/i.test(err.message ?? '');
}

export interface SyncEngineOptions {
  supabase:    SupabaseClient;
  businessId:  string | null;
  userId:      string | null;
  domain:      string;
  onChange?:   (pending: number) => void; // fired after enqueue/drain so the UI can show "N to sync"
}

export interface InsertArgs { table: string; row: Record<string, unknown>; clientId?: string; }
export interface UpdateArgs { table: string; set: Record<string, unknown>; match: Record<string, unknown>; }

export class SyncEngine {
  private supabase: SupabaseClient;
  private businessId: string | null;
  private userId: string | null;
  private domain: string;
  private onChange?: (pending: number) => void;
  private queue: OfflineQueue;
  private draining = false;
  private boundOnline = () => { void this.syncNow(); };

  constructor(opts: SyncEngineOptions) {
    this.supabase   = opts.supabase;
    this.businessId = opts.businessId;
    this.userId     = opts.userId;
    this.domain     = opts.domain;
    this.onChange   = opts.onChange;
    this.queue      = new OfflineQueue(new NamespacedStore(opts.businessId, opts.domain));
  }

  isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  }

  pendingCount(): number { return this.queue.size(); }

  // Client-generate an id so an insert's PK is known BEFORE the round-trip — the
  // session id can be referenced by its children while offline, and replay is
  // idempotent on that PK. Callers that chain ids (session → counts) use this.
  newId(): string { return newId(); }

  // Drop an op the caller has decided is permanently inapplicable (e.g. the
  // pre-migration deploy window — the target table genuinely doesn't exist yet),
  // so it can't poison the FIFO drain forever.
  forget(clientId: string): void {
    this.queue.remove(clientId);
    this.onChange?.(this.pendingCount());
  }

  // Attach/detach the reconnect listener. Calling start() also drains any queue
  // left from a previously-interrupted session.
  start(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundOnline);
      if (this.pendingCount() > 0) void this.syncNow();
    }
  }
  stop(): void {
    if (typeof window !== 'undefined') window.removeEventListener('online', this.boundOnline);
  }

  private envelope(kind: OfflineOp['kind'], table: string, payload: OfflineOp['payload'], clientId: string): OfflineOp {
    return {
      clientId, kind, table, payload,
      businessId: this.businessId,
      userId:     this.userId,
      clientTs:   new Date().toISOString(),
      domain:     this.domain,
    };
  }

  async insert(args: InsertArgs): Promise<WriteResult> {
    const clientId = args.clientId ?? (typeof args.row.id === 'string' ? args.row.id : newId());
    const row = { ...args.row, id: clientId }; // explicit PK = idempotent replay
    return this.submit(this.envelope('insert', args.table, row, clientId));
  }

  async update(args: UpdateArgs): Promise<WriteResult> {
    const payload: UpdatePayload = { set: args.set, match: args.match };
    return this.submit(this.envelope('update', args.table, payload, newId()));
  }

  // Always enqueue (durability + FIFO order), then drain now if online. Offline →
  // 'queued' (Save never fails in a dead zone). Online → 'applied' when it lands,
  // 'queued' if connectivity dropped mid-drain, 'failed' on a genuine reject.
  private async submit(op: OfflineOp): Promise<WriteResult> {
    this.queue.enqueue(op);
    this.onChange?.(this.pendingCount());
    if (TRACE_SYNC) console.log('[TRACE:SYNC] enqueue —', op.kind, op.table, 'clientId:', op.clientId, 'online:', this.isOnline(), 'by:', op.userId);

    if (!this.isOnline()) return { status: 'queued', clientId: op.clientId };

    const drain = await this.drain();
    const stillQueued = this.queue.list().some(o => o.clientId === op.clientId);
    if (!stillQueued) return { status: 'applied', clientId: op.clientId };
    if (drain.failed > 0) return { status: 'failed', clientId: op.clientId, error: drain.lastError };
    return { status: 'queued', clientId: op.clientId };
  }

  // Manual "sync now" + the reconnect handler both land here.
  async syncNow(): Promise<DrainResult> { return this.drain(); }

  private async drain(): Promise<DrainResult> {
    if (this.draining || !this.isOnline()) {
      return { applied: 0, remaining: this.pendingCount(), failed: 0 };
    }
    this.draining = true;
    let applied = 0, failed = 0;
    let lastError: string | undefined;
    try {
      // FIFO; stop at the first op that doesn't apply so ordering is preserved.
      for (const op of this.queue.list()) {
        const res = await this.execute(op);
        if (res === 'applied') {
          this.queue.remove(op.clientId);
          applied++;
          this.onChange?.(this.pendingCount());
        } else if (res === 'retry') {
          break; // dead zone — keep the rest, retry on reconnect
        } else {
          failed++;
          lastError = res.error;
          break; // genuine reject — surface, keep op for a deliberate retry/forget
        }
      }
    } finally {
      this.draining = false;
    }
    if (TRACE_SYNC) console.log('[TRACE:SYNC] drain —', { applied, failed, remaining: this.pendingCount() });
    return { applied, remaining: this.pendingCount(), failed, lastError };
  }

  private async execute(op: OfflineOp): Promise<StepResult> {
    try {
      if (op.kind === 'insert') {
        const { error } = await this.supabase.from(op.table).insert(op.payload as Record<string, unknown>);
        if (!error) return 'applied';
        if (error.code === '23505') return 'applied';            // already inserted → idempotent
        if (isConnectivityError(error)) return 'retry';
        return { failed: true, error: error.message };
      }
      const p = op.payload as UpdatePayload;
      const { error } = await this.supabase.from(op.table).update(p.set).match(p.match);
      if (!error) return 'applied';
      if (isConnectivityError(error)) return 'retry';
      return { failed: true, error: error.message };
    } catch (e) {
      // fetch threw (connectivity dropped mid-request) → retryable
      const msg = e instanceof Error ? e.message : String(e);
      if (TRACE_SYNC) console.warn('[TRACE:SYNC] execute threw (treating as connectivity) —', msg);
      return 'retry';
    }
  }
}
