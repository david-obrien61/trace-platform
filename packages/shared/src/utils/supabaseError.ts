// ============================================================
// supabaseError — is a failed supabase-js call a DEAD ZONE, or a real answer from the server?
//
// PURPOSE:      One predicate, platform-wide, for the only question a caller can act on
//               differently: did the request fail to REACH the database (retry when you have
//               signal), or did the database ANSWER with a refusal (retrying will not help)?
// DEPENDENCIES: none. A leaf module by design — the base layer both `sync/` and `utils/
//               readResult` sit on, so neither has to import the other.
// OUTPUTS:      isConnectivityError.
//
// 🔴 MOVED HERE, NOT COPIED (CLAUDE.md §6 r8 — 2026-08-23). This function was written for and
// lived PRIVATE inside `sync/syncEngine.ts:35`, where the drain used it to decide retry-vs-reject.
// The stock-line resolver needs the identical judgement to tell a dead zone from an empty catalog,
// and a second copy of a regex predicate is precisely the drifted-equivalent class rule 8 exists
// to catch (the three phone writers, 2026-06-24). `syncEngine` now imports it from here; its
// behaviour is unchanged, byte for byte.
// ============================================================

/**
 * supabase-js surfaces connectivity failures as a thrown TypeError, or as an error object with
 * NO postgres/PostgREST code and a fetch/network-shaped message. A CODED error is a real DB
 * response — an RLS refusal, a constraint violation, a bad column — and must never be reported
 * to a person as "you're offline": retrying it in better signal produces the same refusal.
 */
export function isConnectivityError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code) return false; // a coded error is a real DB response, not a dead zone
  return /fetch|network|timeout|connection|offline|load failed/i.test(err.message ?? '');
}
