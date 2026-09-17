// ============================================================
// containerLadderFields — the field list for a rung on the ladder read (ledger #326).
//
// ✏️ MOVED 2026-09-16 (ledger #343): the list itself now lives in
// `@trace/shared/inventory/containerLadder` (`LADDER_FIELDS`), because the server's QuickBooks import
// preview became a SECOND reader of `container_ladder` and two lists for one table is the copy that
// drifts (tech-debt #179). This file re-exports it so `containerLadderFields.test.ts` — which replays
// every migration against the list — keeps asserting the one list that exists.
//
// 🔴 STILL A ZERO-DEP LEAF, for the reason it was split out in the first place: a probe of the FIELD
// LIST must run without a database handle. `containerLadder.ts` imports nothing that opens one.
// ============================================================
export { LADDER_FIELDS, LADDER_SELECT } from '@trace/shared/inventory/containerLadder';
