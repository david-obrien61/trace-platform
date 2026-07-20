// ============================================================
// sync — sometimes-connected capture (offline-durable writes + reconnect drain).
// PURPOSE:  Barrel for the shared sync slice. First consumer = Cultivar's
//           walk-and-count loop (back-acre dead zones, ledger #54). Built NEW in
//           shared rather than moving DataBridge (44 Ignition imports — recon §6);
//           DataBridge stays put as donor-reference.
// DEPENDENCIES: see each module header.
// OUTPUTS:  SyncEngine + NamespacedStore + OfflineQueue + types.
// ============================================================

export { SyncEngine } from './syncEngine';
export type { SyncEngineOptions, InsertArgs, UpdateArgs, RpcArgs } from './syncEngine';
export { NamespacedStore } from './store';
export type { StorageAdapter } from './store';
export { OfflineQueue } from './offlineQueue';
export type { OfflineOp, OpKind, UpdatePayload, RpcPayload, WriteStatus, WriteResult, DrainResult } from './types';
