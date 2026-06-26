// ============================================================
// sync/types — sometimes-connected offline-op envelope.
// PURPOSE:  The typed shape of a queued write. Every op carries its own
//           idempotency key (clientId), the identity that enqueued it (userId),
//           and a client timestamp (clientTs) so a last-writer SET can reconcile
//           sanely on replay. de-keyed from Ignition's single IGNITION_OS_DATA
//           blob → per-(business,domain) namespace (recon §2, §6).
// DEPENDENCIES: none.
// OUTPUTS:  OfflineOp (the queue envelope) + result types.
// ============================================================

export type OpKind = 'insert' | 'update';

// An update op's payload: the columns to set + the row(s) to match.
export interface UpdatePayload {
  set:   Record<string, unknown>;
  match: Record<string, unknown>;
}

// One durable, replayable write. `clientId` doubles as the row PK for inserts
// (supplied client-side instead of letting the DB default fire) so a replay of
// the same insert collides on the PK (23505) → treated as already-applied =
// idempotent, WITHOUT any schema change to the target table.
export interface OfflineOp {
  clientId:   string;                                  // idempotency key (= row id for inserts)
  kind:       OpKind;
  table:      string;
  payload:    Record<string, unknown> | UpdatePayload; // insert row, or {set,match}
  businessId: string | null;                           // tenant scope (AC-3)
  userId:     string | null;                           // WHO enqueued — identity stamp rides the envelope
  clientTs:   string;                                  // ISO time at enqueue — reconcile ordering for SETs
  domain:     string;                                  // logical stream, e.g. 'inventory-count'
}

export type WriteStatus = 'applied' | 'queued' | 'failed';

export interface WriteResult {
  status:   WriteStatus;
  clientId: string;
  error?:   string;       // present on 'failed' — the genuine reject (RLS/constraint/missing-table)
}

export interface DrainResult {
  applied:   number;
  remaining: number;
  failed:    number;
  lastError?: string;
}
