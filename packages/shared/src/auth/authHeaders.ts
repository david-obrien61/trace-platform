// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Attach the signed-in caller's Bearer token to a fetch of one of our own
//               service-key api handlers. Those handlers bypass RLS, so they prove the CALLER
//               themselves (MB_D-015 / `callerCan`) — and they can only do that if the browser
//               actually sends the token. This is the CLIENT half of that contract.
// DEPENDENCIES: the shared supabase client (session read only).
// OUTPUTS:      authHeaders() → { Authorization: 'Bearer …' } when a session exists, else {}.
//
// WHY IT IS SHARED (§6 r8 — one OPERATION, one place): the 2026-07-27 sweep found EIGHT
// endpoints writing under the service key with no caller check. Fixing them means touching
// eleven-plus call sites, and eleven hand-written token attachments is eleven chances to forget
// one — which reads, from the server, as an anonymous caller and returns 403. One helper.
//
// ⚠️ RETURNING {} WHEN THERE IS NO SESSION IS DELIBERATE, NOT A FALLBACK. The anonymous QR
// checkout has no session by design; it must still be able to call the endpoints that serve it.
// A missing token is an HONEST "I am nobody" — the server decides what nobody may do. Never
// invent a token, and never let a caller assert its own identity in the body.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase/client';

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
