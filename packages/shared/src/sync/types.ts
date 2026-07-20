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

export type OpKind = 'insert' | 'update' | 'rpc';

// An update op's payload: the columns to set + the row(s) to match.
export interface UpdatePayload {
  set:   Record<string, unknown>;
  match: Record<string, unknown>;
}

// An rpc op's payload: the postgres function + its named args (D-50, ledger #143).
//
// WHY THIS KIND EXISTS: a movement RPC moves qty AND writes its ledger row in ONE
// transaction. Before this, a queued write was a bare table write, so an offline
// count could only ever be a naked SET — the exact thing D-50 exists to end. Queuing
// the RPC instead keeps the dead-zone promise AND the atomicity: the transaction runs
// whenever it drains, not at enqueue time.
//
// REPLAY SEMANTICS — deliberately different from insert/update, and safe for a COUNT:
// `count_reconcile_inventory` computes `delta = counted − current` at APPLY time under
// a FOR UPDATE lock. So a count queued in a dead zone reconciles against whatever the
// qty actually is when it lands (e.g. after a sale drained first) — which is the
// correct reading of "I physically counted 12", not a stale delta replayed blind.
//
// KNOWN, BOUNDED IMPERFECTION (stated, not hidden): an RPC has no natural idempotency
// key the way an insert has its PK. If a drain applies the call but the RESPONSE is
// lost, the retry re-applies it — qty lands on the same counted value (harmless, it is
// absolute), but a SECOND zero-delta ledger row is written. That is a duplicate FACT,
// not corruption: the replay says "counted, and it agreed." Tightening it needs a
// client-supplied movement key, which is a migration — not this build.
export interface RpcPayload {
  fn:   string;
  args: Record<string, unknown>;
}

// One durable, replayable write. `clientId` doubles as the row PK for inserts
// (supplied client-side instead of letting the DB default fire) so a replay of
// the same insert collides on the PK (23505) → treated as already-applied =
// idempotent, WITHOUT any schema change to the target table.
export interface OfflineOp {
  clientId:   string;                                  // idempotency key (= row id for inserts)
  kind:       OpKind;
  table:      string;
  payload:    Record<string, unknown> | UpdatePayload | RpcPayload; // insert row · {set,match} · {fn,args}
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
