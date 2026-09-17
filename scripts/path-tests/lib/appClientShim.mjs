/**
 * appClientShim — stands in for the app's browser client (`@trace/shared/supabase/client`) inside a
 * path-test bundle (ledger #345). Each access builds a PGlite-backed client acting as
 * `globalThis.__ACT_AS__` (a user id; null = no session), so a screen's Save function runs exactly
 * as it does in the browser — under that user's RLS.
 */
export const supabase = new Proxy({}, {
  get(_t, key) {
    const client = globalThis.__LIVE_REST__(globalThis.__LIVE_DB__, { uid: globalThis.__ACT_AS__ ?? null });
    const v = client[key];
    return typeof v === 'function' ? v.bind(client) : v;
  },
});
