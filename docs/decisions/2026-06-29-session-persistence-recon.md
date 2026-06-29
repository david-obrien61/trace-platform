# Session-Persistence / Offline-Logout Recon (READ-ONLY)

**Date:** 2026-06-29
**Author:** Thunder
**Type:** RECON ONLY — no auth change, no schema, no migration, no code change beyond this doc.
**Surface:** AUTH / SESSION (highest-risk surface) → verify-before-build, **HARD STOP before any auth change**.
**Status:** Cause CONFIRMED. Minimal fix RECOMMENDED. **Awaiting David's approval before any build.**

---

## The problem (field-proven, 2026-06-28)

David ran a multi-stop errand run with the rhythm logger active. Mid-trip, on a network
hiccup (low/no-signal stretches between Liberty Hill and Leander), **the app logged him out
and forced a re-login**, wiping the in-progress session (~2 hours of capture lost). This is
NOT the foreground/screen-lock limit (auto-lock was off). It is a **session-persistence
failure**: the app drops the authenticated session when connectivity flickers.

Why it matters: a FIELD tool's core use happens exactly where signal is worst — walking a
property, a low-signal greenhouse, driving a route. If a network flicker logs the user out,
the tool is unusable for its purpose, and it threatens the Lauren demo (a count in a
low-signal greenhouse could boot her mid-count). Persistent, offline-tolerant login is
**foundational**, not nice-to-have.

---

## CONFIRMED CAUSE (the suspect is correct, with a sharper trigger)

The suspect — `BusinessProvider.tsx:237` `getUser()` — **is the cause.** Quoting the path:

### 1. The network identity check that gets discarded into "logged out"
`packages/shared/src/context/BusinessProvider.tsx:237`
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  setResolvedBusinesses([]);   // :241  wipes the resolved businesses
  setBusinessError(null);      // :242  NOT 'no_business' — stays null
  setUserEmail(null); setAuthName(null);
  setLoading(false);           // :245  SETTLED with empty state
  return;
}
```
- `supabase.auth.getUser()` is a **NETWORK call** — it hits GoTrue `/auth/v1/user` to
  re-validate the token server-side.
- **Offline, it returns `{ data: { user: null }, error: AuthRetryableFetchError }`.** The
  code **destructures only `data.user` and discards `error`** (line 237) — so a transient
  network failure is indistinguishable from a genuinely signed-out user.
- `!user` → the provider **wipes `resolvedBusinesses` to `[]`, leaves `businessError` null,
  and sets `loading=false`** (a SETTLED empty state). The locally-persisted session is still
  perfectly valid — `getUser()` just couldn't reach the network to re-validate it.

### 2. The settled-empty state then boots to onboarding
`packages/cultivar-os/src/pages/Dashboard.tsx:359`
```ts
if (!businessLoading && (businessError || !businessId)) {
  navigate('/onboarding', { replace: true });   // :360
  return null;
}
```
- After the wipe: `businessLoading=false`, `businessId=null` → this guard fires →
  **redirect to `/onboarding`.** That is the "logged out / lost my session" symptom David
  saw — not `/login`, but `/onboarding`, which (per the 2026-06-24 bounce-loop history)
  discards in-progress state.

### 3. The trigger — why it re-runs mid-trip even without navigating
`BusinessProvider.tsx:230-460` `resolve()` re-runs whenever ANY of these fire:
- the provider **mounts/remounts** (navigating across a multi-stop errand run), OR
- `reload()` bumps `tick` (`:460` dep), OR
- **`onAuthStateChange` fires** (`:452-454`) — and this fires on **`TOKEN_REFRESHED`**,
  which supabase-js emits on every successful background token auto-refresh (default JWT
  TTL 3600s, plus visibility-regain recovery).

So even sitting on one screen, when the client auto-refreshes the token, `resolve()` re-runs
and its **first act is the network `getUser()`** — and if the network is down at that tick,
the good in-memory state is wiped and the app boots. Across a multi-stop run (navigation +
auth events) the odds of hitting an offline window are high. **The fragility is structural:
identity resolution requires the network, and a failed network identity check is treated as
logout.**

---

## getSession() vs getUser() — the key finding

| | `getUser()` | `getSession()` |
|---|---|---|
| What it does | **Network** call to GoTrue `/user`; re-validates token server-side | Reads the **locally persisted** session from storage (localStorage) |
| Offline | returns `user: null` + retryable error | returns the **stored session** (works offline) |
| Has `user.id` / `email` / `user_metadata`? | yes | **yes** — `session.user` is the same User object |

**The route guard already uses the offline-safe pattern.** `configureAuth.tsx` (email
strategy) reads the session via `getSession()` (local) + `onAuthStateChange`:
- `configureAuth.tsx:65` `supabase.auth.getSession().then(...)` — local, no network.
- `configureAuth.tsx:96` `return session ? <Outlet /> : <Navigate to="/login" />` — so the
  **PrivateRoute does NOT boot offline** (it reads the persisted session). Proof the correct
  pattern exists in-repo.

**`BusinessProvider` is the only auth-resolution path that uses `getUser()` (network) where
`getSession()` (local) would give it everything it consumes** — `session.user.id` (the only
field the owner/member queries need), `session.user.email`, and `session.user.user_metadata`
(the display-name source). None require a server round-trip; all live in the locally
persisted JWT/session.

**Client config confirms the session is persisted locally.** `supabase/client.ts:10` is a
bare `createClient(url, key)` — no overrides — so supabase-js v2 (`2.106.0` installed) applies
its defaults: `persistSession: true`, `autoRefreshToken: true`, `storage: localStorage`. The
session is in localStorage and survives reload/offline; nothing reads it on the resolution
path today.

---

## Every "no valid session → go to login/onboarding" decision point

| # | Location | Mechanism | Offline behavior | Implicated? |
|---|---|---|---|---|
| 1 | `configureAuth.tsx:96` PrivateRoute (email) | `getSession()` (local) + `onAuthStateChange` | **Safe** — reads persisted session | No |
| 2 | `configureAuth.tsx:70` `useSession` `onAuthStateChange` | sets session from event payload | Fires `SIGNED_OUT` only on explicit signOut or genuinely-invalid refresh token; a **network-failed refresh is retryable, NOT SIGNED_OUT** | Unlikely (note) |
| 3 | **`BusinessProvider.tsx:237-247`** | **`getUser()` (NETWORK)**, error discarded | **Offline → `user:null` → state WIPE** | **YES — primary** |
| 4 | `BusinessProvider.tsx:452-454` `onAuthStateChange` → `resolve()` | re-runs `resolve()` on every auth event incl. `TOKEN_REFRESHED` | re-invokes #3 offline → wipe | YES — the trigger |
| 5 | **`Dashboard.tsx:359-361`** | `if (!businessLoading && (businessError \|\| !businessId)) navigate('/onboarding')` | boots on the wiped state — **and on ANY `businessError`, incl. `'read_error'`** | YES — the symptom |
| 6 | `OnboardingWizard.tsx:499` | `getUser()` then `if (!user) navigate('/login')` | offline → boots; finalize path only | Secondary (same class) |
| 7 | `AppLayout.tsx:25-26` | explicit `auth.signOut()` + `navigate('/login')` | user-initiated | No — correct |

**Note on #2:** a transient network error during auto-refresh is an `AuthRetryableFetchError`
in supabase-js v2 — the client retries on a tick and does **not** emit `SIGNED_OUT`. So the
route guard is not the likely culprit; the `BusinessProvider` network `getUser()` is. (Worth
confirming with a `[TRACE:SESSION]` emit during owner-proof, but low-risk.)

**Note on #5 (second half of the bug):** even if `getUser()` is swapped to `getSession()`,
the owner/member **SELECTs are themselves network calls** (PostgREST) that fail offline. Today
that routes to `businessError='read_error'` (`BusinessProvider.tsx:390-401`), and `Dashboard.tsx:359`
boots to onboarding on ANY `businessError`. So a `resolve()` re-run while offline would STILL
boot via `read_error` unless the wipe-on-transient-read-error is also guarded. **The `getSession()`
swap is necessary but, depending on the trigger, not sufficient on its own.**

---

## Blast radius + security

**Touch points of the correct fix** (all in the auth-resolution path, NOT data/RLS):
- `BusinessProvider.tsx:237` — swap `getUser()` → `getSession()`, read `session.user`.
- `BusinessProvider.tsx` resolve error-handling — do not wipe good in-memory state on a
  transient (offline/network) read failure.
- `Dashboard.tsx:359` (optional, for completeness) — do not boot to onboarding on a
  transient/`read_error` state; only on a genuinely-settled `no_business`.

**Does the fix weaken auth / RLS / tenant isolation? NO — and here's the explicit reasoning:**
- `getSession()` returns a session the user **already legitimately holds** — a cryptographically
  valid JWT in local storage. We are not minting, extending, or relaxing validation of any token.
- Token expiry is unchanged. Auto-refresh is unchanged. The access token is still sent as the
  `Authorization: Bearer` on **every** PostgREST/RLS call, and **RLS still enforces tenant
  isolation server-side on every read/write regardless of this client change.** Removing a
  redundant client-side network re-validation (`getUser()`) does not remove the server-side gate.
- An expired/absent session still resolves to "no user" (and a genuinely-expired token is
  rejected server-side on the next data call). We only stop treating a **transient network
  failure** as a permanent logout.

**This is a session-persistence fix, not a security relaxation.** If any proposed variant did
weaken token validation or tenant isolation, that variant is rejected — flag and stop.

---

## Three-lens summary

**HAVE**
- `BusinessProvider.tsx:237` network `getUser()`, error discarded → offline = logout treatment (state wipe).
- `BusinessProvider.tsx:452` `onAuthStateChange` re-runs `resolve()` on every auth event (incl. `TOKEN_REFRESHED`).
- `Dashboard.tsx:359` boots to `/onboarding` on `businessError || !businessId` (incl. `read_error`).
- `configureAuth.tsx:65,96` route guard uses `getSession()` (local) — already offline-safe; the pattern exists.
- `client.ts:10` bare `createClient` → `persistSession`/`autoRefreshToken` defaults ON, localStorage. Session persisted.
- `InventoryCount.tsx:128-138` already offline-aware (online/offline listeners + queue/reconnect engine) **yet still `getUser()`-gates identity at :130** — corroborates that offline tolerance is design intent but identity resolution undercuts it.

**NEED** (irreducible minimum to stop the offline logout)
- Identity resolution must not require the network: read the session locally (`getSession()`),
  not re-validate it over the wire (`getUser()`). Stops the most common trigger — a `resolve()`
  re-run nuking the session because `getUser()` returned null offline.

**WANT** (a genuinely offline-tolerant field tool)
- A `resolve()` re-run while offline must never overwrite good in-memory state; a transient read
  failure keeps the last-known businesses + a soft "offline" indicator, never redirects.
- Skip redundant `resolve()` on `TOKEN_REFRESHED` when nothing changed; an offline banner;
  extend the queue-and-resume pattern (already in `InventoryCount`) to the rhythm/count writes.

---

## Options (NEED → WANT) — recommend, build nothing

- **Option A (cheapest-meets-need):** swap `getUser()` → `getSession()` at `BusinessProvider.tsx:237` only.
  Smallest diff; stops the identity-nuke. **Residual:** if `resolve()` re-runs offline (remount /
  `TOKEN_REFRESHED`), the owner/member SELECTs still error → `businessError='read_error'` →
  `Dashboard.tsx:359` still boots. Necessary, possibly not sufficient.
- **Option B (smallest CORRECT fix — recommended):** A **plus** guard the wipe — in `resolve()`,
  when a read fails with a transient/network error AND `resolvedBusinesses` is already populated,
  **keep the prior state** (don't wipe, don't set a booting error). Covers the remount-offline and
  `TOKEN_REFRESHED`-offline cases. Moderate.
- **Option C (fullest-meets-want):** B plus `Dashboard.tsx:359` distinguishes transient/offline from
  a genuinely-settled `no_business` (never boots on transient), an offline banner, skip redundant
  `TOKEN_REFRESHED` re-resolves, and extend the offline write-queue to rhythm/count writes. Largest.

**Recommendation: Option B** is the smallest change that is actually correct (A alone leaves the
`read_error` boot path open depending on the trigger). Present all three; David picks.

---

## Is any part trivial enough to show the diff? (per the prompt's allowance)

The **`getSession()` swap (the NEED half of Option B)** is genuinely trivial and touches no
security property — it is a drop-in: `session.user` is the same User object `getUser()` returns,
with `id` / `email` / `user_metadata` all present. The exact diff I *would* make at
`BusinessProvider.tsx:237` (NOT applied — awaiting David's go):

```ts
// BEFORE (:237)
const { data: { user } } = await supabase.auth.getUser();

// AFTER — read the locally-persisted session (offline-safe), same User object
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user ?? null;
```

I am **explicitly NOT** showing/encouraging applying the second half (the wipe-guard on
`read_error` + the `Dashboard.tsx:359` distinction) as a one-liner — it involves a small
state-preservation behavior decision (keep-last-known vs soft-offline flag) that David should
choose. The swap alone is necessary-but-not-sufficient; I'm flagging that honestly rather than
shipping a partial fix that looks complete.

---

## Owner-prove plan (after a fix is approved + built)

1. David signs in normally on the phone; dashboard resolves, businesses populate.
2. Put the phone in **airplane mode mid-session** (or walk into the low-signal greenhouse).
   - The app **STAYS logged in**; the dashboard / count / rhythm session survives.
   - A token auto-refresh or a navigation during the offline window does **not** boot to onboarding.
3. Connectivity returns → the app resumes cleanly (reads succeed, no re-login).
4. **Only** a real "Sign out" or a genuinely-expired/absent token forces re-login.
5. Confirm the `[TRACE:SESSION]` emit (added on the resolution/guard path per STD-003) shows the
   offline-tolerant decision (e.g. `session present, network read deferred — keeping last-known`)
   rather than a logout.

---

## HARD STOP

No auth code changed. No schema, no migration. This recon proposes; it does not build.
**Awaiting David's review (with Lightning) and explicit approval before any auth change.**
