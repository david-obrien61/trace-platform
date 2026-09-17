/**
 * supabaseShim — stands in for `@supabase/supabase-js` inside a path-test bundle (ledger #345).
 * The real handler calls `createClient(url, key, opts)`; this returns the PGlite-backed client
 * installed by `liveDb.installSupabaseShim`. A `Bearer test-uid:<uuid>` header acts as that user
 * (RLS applies); anything else is the service key. Nothing else in the handler is replaced.
 */
export function createClient(_url, _key, opts = {}) {
  const db = globalThis.__LIVE_DB__;
  const rest = globalThis.__LIVE_REST__;
  if (!db || !rest) throw new Error('supabaseShim: installSupabaseShim(db) was not called');
  const auth = opts?.global?.headers?.Authorization ?? opts?.global?.headers?.authorization ?? '';
  const m = /Bearer test-uid:([0-9a-f-]{36})/.exec(auth);
  return rest(db, { uid: m ? m[1] : null });
}
export default { createClient };
