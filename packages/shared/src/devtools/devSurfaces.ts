// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: THE ONE GATE for every developer/debug surface (§6 r8 — `?debug=1`
//   and `?rhythm=1` were the same mechanism written twice, with two sticky
//   localStorage keys and two `xEnabled()` readers that could drift). A surface
//   asks this module "am I on?" and NOTHING else decides it.
//
//   REPLACES (deliberately removed, do not reintroduce):
//     · `?debug=1` / `?rhythm=1` query-string activation — typing a flag on a
//       phone is not a control surface, and the flag worked PRE-LOGIN on the
//       customer-facing /plant/:tagId QR page (recon 2026-07-20).
//     · the naked `traceDebug` / `traceRhythm` localStorage keys — raw keys with
//       no session coupling SURVIVED logout and role change, so a device left in
//       debug stayed in debug for whoever signed in next.
//
// IDENTITY BINDING IS THE WHOLE POINT: state is keyed to (userKey + role). If
//   EITHER changes — sign out, sign in as someone else, a role downgrade — the
//   stored state no longer matches and every surface reads OFF, and the record is
//   purged. There is no "sticky" that outlives the person who set it.
//
// AUTHORITY: this module answers "did the owner turn it on?" It does NOT decide
//   who is ALLOWED to turn it on — that is the caller's gate (owner-only in the
//   menu) and, structurally, WHERE the surface is mounted (inside the
//   authenticated shell). Two independent gates, neither load-bearing alone.
//
// DEPENDENCIES: none (browser localStorage, guarded). No React import —
//   `useDevSurface` is a hook but useSyncExternalStore is imported from react.
// OUTPUTS: `useDevSurface(key)` → boolean · `toggleDevSurface(key)` ·
//   `bindDevSurfaceIdentity(userKey, role)` · `clearDevSurfaces()`.
// INSTRUMENTATION: [TRACE:DEVGATE] — ON by birth (STD-003 + standing owner rule).
// ───────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';

export type DevSurfaceKey = 'debug' | 'rhythm';

const STORAGE_KEY = 'traceDevSurfaces';

interface Bound {
  userKey: string | null;
  role: string | null;
}

interface Persisted {
  userKey: string;
  role: string;
  on: DevSurfaceKey[];
}

// Bound identity — null until the authenticated shell binds it. While null,
// EVERY surface reads OFF. That is the pre-login guarantee, by construction.
let bound: Bound = { userKey: null, role: null };

// Snapshot is a stable STRING so useSyncExternalStore can compare by identity
// without us re-allocating a Set/array on every read (which would loop forever).
let snapshot = '';

const listeners = new Set<() => void>();

function emit(next: string): void {
  if (next === snapshot) return; // no-op writes must not wake subscribers
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function readSnapshot(): string {
  return snapshot;
}

function persist(on: DevSurfaceKey[]): void {
  if (!bound.userKey || !bound.role) return;
  try {
    const record: Persisted = { userKey: bound.userKey, role: bound.role, on };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode / quota — the toggle still works for this session, it just
    // won't survive a reload. Degrading quietly is correct here; a dev toggle
    // is not worth surfacing a storage error to the owner.
  }
}

/**
 * Bind the gate to the signed-in identity. Call from the AUTHENTICATED shell on
 * every render — it is idempotent and cheap.
 *
 * If the stored record was written by a different user OR under a different
 * role, it is discarded and purged: a dev surface never carries across a person
 * or a permission level.
 */
export function bindDevSurfaceIdentity(userKey: string | null, role: string | null): void {
  const changed = bound.userKey !== userKey || bound.role !== role;
  if (!changed) return;

  bound = { userKey, role };

  if (!userKey || !role) {
    // Signed out (or identity not yet resolved) — everything off, nothing kept.
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* see persist() */ }
    console.log('[TRACE:DEVGATE] identity cleared — all dev surfaces OFF');
    emit('');
    return;
  }

  let restored: DevSurfaceKey[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const rec = JSON.parse(raw) as Partial<Persisted>;
      // The match is the security property: a record from another user or another
      // role is not "stale state to migrate", it is state that was never theirs.
      if (rec.userKey === userKey && rec.role === role && Array.isArray(rec.on)) {
        restored = rec.on.filter((k): k is DevSurfaceKey => k === 'debug' || k === 'rhythm');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    restored = [];
  }

  console.log('[TRACE:DEVGATE] identity bound', { role, restored });
  emit(restored.join(','));
}

/** Turn a dev surface on/off. Persists under the CURRENTLY bound identity only. */
export function toggleDevSurface(key: DevSurfaceKey): void {
  if (!bound.userKey) {
    // Nothing is bound → nobody is signed in → there is nothing to toggle.
    console.log('[TRACE:DEVGATE] toggle refused — no bound identity', { key });
    return;
  }
  const on = new Set(snapshot ? (snapshot.split(',') as DevSurfaceKey[]) : []);
  if (on.has(key)) on.delete(key);
  else on.add(key);

  const next = [...on];
  persist(next);
  console.log('[TRACE:DEVGATE] toggle', { key, on: next });
  emit(next.join(','));
}

/** Purge everything — wired to sign-out so the record never outlives the session. */
export function clearDevSurfaces(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* see persist() */ }
  bound = { userKey: null, role: null };
  console.log('[TRACE:DEVGATE] cleared (sign-out)');
  emit('');
}

/** Is this surface on for the currently bound identity? */
export function useDevSurface(key: DevSurfaceKey): boolean {
  const current = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  return current.split(',').includes(key);
}
