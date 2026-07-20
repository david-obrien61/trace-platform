# RECON — TYPED / HIDDEN ACTIVATION SURFACES (cultivar-os)

**Date:** 2026-07-20 · **Type:** RECON ONLY — read-and-report, ZERO code written.
**Purpose:** enumerate the COMPLETE set of developer/debug/trace surfaces that today require
**TYPING** to reach (a query-string flag, a typed keyword, a hand-edited URL), so they can be moved
into the profile dropdown, role-gated. Finding them one-at-a-time is how one gets missed — this is
the master list.
**Scope:** `packages/cultivar-os` + the `packages/shared` surfaces it mounts. Ignition/trace-app not
swept (separate vite configs, separate entry points) — **named, not silently excluded.**

> **Three lenses (§9 gate 10).** **HAVE** = what is live today, `file:line`. **NEED** = the
> irreducible minimum to satisfy "nothing is reached by typing on a phone." **WANT** = the clean
> end-state. Options span NEED→WANT at the bottom. No pre-collapsed recommendation.

---

## THE HEADLINE — read this before the tables

Three things this sweep found that the framing ("move typed flags into a menu") did not anticipate:

1. **The two debug panels mount OUTSIDE the router's auth gate** ([App.tsx:15-17](packages/cultivar-os/src/App.tsx#L15-L17) — they are siblings of `<AppRouter/>`, not children). They therefore render on **every** route including **public, pre-login** ones: `/login`, `/signup`, and **`/plant/:tagId`, the customer-facing QR page**. `?debug=1` is not owner-only today; **it is not gated at all.** The panel's own footer states it "May contain tenant ids/emails."
2. **Vector 2 (typed keyword / key sequence / tap-count / long-press) is EMPTY.** Every `onKeyDown` in the package is an ordinary Enter/Escape form handler. **No konami code, no tap-counter, no long-press unlock exists.** That is a genuine negative finding, and it means the build's surface area is smaller than feared.
3. **⚠️ `/discovery/inspect` is an UNAUTHENTICATED internal tool whose backend has ungated cost-bearing and mail-sending branches.** This is adjacent to the typed-activation question, not the same question — but it is the most consequential thing here and it should not wait for the menu build. **Detail in the § below.**

---

## 1. QUERY-STRING FLAGS

### 1a. ACTIVATION flags — these are the build's actual targets

| Flag | Where read | What it does | Sticky? | Who should see it | Role-gated today? |
|---|---|---|---|---|---|
| `?debug=1` / `?debug=0` | [DebugPanel.tsx:27-36](packages/cultivar-os/src/components/DebugPanel.tsx#L27-L36) | Reveals the floating 🐞 panel (bottom-**right**): live `[TRACE:*]` tail, Copy / Share / Download / Clear, **and now the OP-15 SHA stamp** (ledger #141). | **YES** — sets `localStorage.traceDebug='1'`; persists until `?debug=0` | **dev / owner only.** Contains tenant ids + emails by its own admission. **GATE 0 of every owner-test runs through it**, so David needs it reachable in the lot. | ❌ **NONE.** No auth check, no role check, renders pre-login |
| `?rhythm=1` / `?rhythm=0` | [RhythmLogger.tsx:36-45](packages/cultivar-os/src/components/RhythmLogger.tsx#L36-L45) | Reveals the floating 🟢 panel (bottom-**left**): geolocation logging, voice/text notes, shape/thread tags, Share/Download/Clear. A **customer-zero research instrument**, not a product feature. | **YES** — sets `localStorage.traceRhythm='1'`; persists until `?rhythm=0` | **David only.** It logs his physical location and voice notes. Not owner-generic — this is not a feature Lauren should ever see. | ❌ **NONE.** Same as above |

**Both are the same mechanism, written twice** (§6 r8 semantic-dup: two near-identical `xEnabled()` readers, two sticky keys, two floating buttons deliberately placed on opposite corners to avoid collision). **A menu build should extract ONE gate, not wire two.**

### 1b. DATA params — NOT activation surfaces; listed so the build does not sweep them in

| Param | Where | Why it is NOT in scope |
|---|---|---|
| `?biz=` | [OnboardingWizard.tsx:450](packages/cultivar-os/src/pages/OnboardingWizard.tsx#L450) | Carries a business id into onboarding. Data, not a reveal. |
| `?date=` | [DeliveryRoute.tsx:335](packages/cultivar-os/src/pages/DeliveryRoute.tsx#L335) | Ordinary route-date filter. |
| `?orderId=` `?total=` `?invoiceNumber=` | [DemoQBInvoice.tsx:39-41](packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L39-L41) | Invoice preview inputs — but see §3, the PAGE is unauthenticated. |
| `?email=` | [AcceptInvite.tsx:48](packages/shared/src/auth/AcceptInvite.tsx#L48) | Invite prefill from an emailed link. |
| `?m=` | [ResetPin.tsx:36](packages/shared/src/components/auth/ResetPin.tsx#L36) | Member id from a reset link. |
| `?_route=` | `api/qbo-connector.ts` | **Server-side** consolidation seam (§6 r11), never a UI reveal. |

---

## 2. TYPED-KEYWORD / GESTURE TRIGGERS

**NONE EXIST.** Swept for `onKeyDown`, `keydown`, `onTouchStart`, `longPress`, `tapCount`,
`clickCount`, `konami`, `keySequence`, `onDoubleClick`, timed-press patterns.

Every hit is a standard form interaction — Enter-to-commit / Escape-to-cancel in
`ProjectsManager`, `DataSheet`, `Discounts`, `ScanOrder`, `Profile`, `DiscoveryInspect`,
`OperatingCosts`, `ProjectCostTree`. **No hidden panel is unlocked by a gesture or a typed code.**

**Why this matters to the build:** the entire hidden-surface problem is **query-string flags +
URL-only routes**. There is no gesture layer to migrate or to keep in sync.

---

## 3. URL-ONLY ROUTES (in the router, absent from the nav/tile registry)

Method: every `<Route>` in [router.tsx](packages/cultivar-os/src/router.tsx) diffed against the
routes declared in `registry/tileRegistry.ts` + `components/nav/AppNav.tsx`, then each candidate
grepped for an in-app `navigate(...)` / `<Link to>` / `href`.

| Route | File:line | Auth / role gate | Reachable in-app? | Verdict |
|---|---|---|---|---|
| **`/discovery/inspect`** | [router.tsx:200](packages/cultivar-os/src/router.tsx#L200) | ❌ **NO AUTH AT ALL** — sits *outside* `<PrivateRoute>`. The code comment says so plainly: *"no auth — David-only, **URL is the gate**"* | **NO link anywhere** | 🔴 **URL-only internal tool. The top candidate for the menu — and see §3b.** |
| **`/demo/quickbooks-invoice`** | [router.tsx:197](packages/cultivar-os/src/router.tsx#L197) | ❌ **NO AUTH** — outside `<PrivateRoute>`. Reads orders + customers client-side, relying on **RLS alone** to refuse | **NO link anywhere** | 🔴 **URL-only demo surface.** Gated only by Supabase RLS + not knowing an `orderId`. |
| `/device-handoff` | [router.tsx:101](packages/cultivar-os/src/router.tsx#L101) | Public by design (pre-auth flow) | No in-app link found | 🟡 Reached out-of-band (handoff link/QR). **Verify before touching** — legitimately public. |
| `/reset-pin` · `/join` | [router.tsx:100-102](packages/cultivar-os/src/router.tsx#L100-L102) | Public by design | Via emailed links | 🟢 Correct as-is. Not dev surfaces. |
| `/roles` | [router.tsx:162](packages/cultivar-os/src/router.tsx#L162) | `MANAGE_SETTINGS` | Redirect → `/team` | 🟢 Legacy alias, harmless. |
| `/onboarding` | [router.tsx:117](packages/cultivar-os/src/router.tsx#L117) | Authed | [Dashboard.tsx:349](packages/cultivar-os/src/pages/Dashboard.tsx#L349) | 🟢 Button-reachable. Not URL-only. |
| `/inventory/count` | [router.tsx:178](packages/cultivar-os/src/router.tsx#L178) | `VIEW_COSTS` | [BusinessInventory.tsx:376](packages/cultivar-os/src/pages/BusinessInventory.tsx#L376) | 🟢 Button-reachable. |
| `/assets/capture` | [router.tsx:176](packages/cultivar-os/src/router.tsx#L176) | `VIEW_COSTS` | [BusinessAssets.tsx:302](packages/cultivar-os/src/pages/BusinessAssets.tsx#L302) | 🟢 Button-reachable. |
| `/checkout/*` · `/plant/:tagId/*` | [router.tsx:89-95](packages/cultivar-os/src/router.tsx#L89-L95) | Public (QR flow) | Flow-internal buttons | 🟢 Product surface, in scope for nothing here. |
| `/privacy` · `/terms` | [router.tsx:103-104](packages/cultivar-os/src/router.tsx#L103-L104) | Public | Footer links in Terms/Privacy/Help | 🟢 Correct. |

**Everything else in the router IS in the nav registry** — `/admin`, `/team`, `/costs`,
`/customers`, `/receipts`, `/assets`, `/inventory`, `/operating-costs`, `/pmi`, `/orders`,
`/deliveries`, `/delivery-schedule`, `/campaigns`, `/social/setup`, `/discounts`, `/settings/*`,
`/add-business`, `/profile`, `/help`, `/dashboard`. The nav-integrity assertion (`verify-universals`
check `#r`) is doing its job — **the registry is clean; the leaks are the two routes deliberately
left out of it.**

### 3b. ⚠️ `/discovery/inspect` — the finding that outranks the menu build

The page is unauthenticated and posts to `/api/discovery/ingest`
([DiscoveryInspect.tsx:84,115](packages/cultivar-os/src/pages/DiscoveryInspect.tsx#L84)).
That endpoint's branches are gated **unevenly**:

| `action` | Line | Caller gate | Consequence if reached anonymously |
|---|---|---|---|
| *(default — identity/analysis)* | [ingest.ts:153](packages/cultivar-os/api/discovery/ingest.ts#L153) | ❌ none | Runs the **~45-second Claude analysis on an arbitrary URL**. Burns AI spend per request. |
| `send` | [ingest.ts:96-118](packages/cultivar-os/api/discovery/ingest.ts#L96-L118) | ❌ none | **Sends email to an attacker-supplied `recipientEmail` with attacker-supplied `subject` + `body` + `html`.** This is the shape of an open mail relay, sending **from our domain/reputation**. |
| `populate` | [ingest.ts:128](packages/cultivar-os/api/discovery/ingest.ts#L128) | ❌ none | **Ungated BY DESIGN with a written reason** ([ingest.ts:124-127](packages/cultivar-os/api/discovery/ingest.ts#L124-L127)): touches only namespaced sandbox/`DISC-` rows, sets `unit_cost=null`, never crosses the cost-wall. **Documented-with-reason, not a surprise.** |
| `cost-discovery` | [ingest.ts:50](packages/cultivar-os/api/discovery/ingest.ts#L50) | ❌ none | AI spend on a cost line. |
| `cost-apply` | [ingest.ts:68-81](packages/cultivar-os/api/discovery/ingest.ts#L68-L81) | ✅ **`callerHoldsPermission(..., VIEW_COSTS)`** | **Correctly gated** — the WRITE-WALL (MB_D-015) holds. |

**Read this precisely, because the distinction matters:** the cost-wall — the thing the platform
built deliberate machinery to defend — **is intact**. `cost-apply` checks the caller's real auth
header before any service-key write. What is open is the **spend** and the **outbound mail**, on a
page whose own comment names the URL as its only gate. *"URL is the gate"* is the same class of
claim as *"the bundle can't be stale"* (#60): **it is a hope about what nobody will type**, and it
is not enforced anywhere.

**No exploit was attempted.** This is a static read of our own repo; nothing was called.

---

## 4. localStorage / STICKY FLAGS

| Key | Set by | Mechanism | Cleared by |
|---|---|---|---|
| `traceDebug` | [DebugPanel.tsx:29](packages/cultivar-os/src/components/DebugPanel.tsx#L29) | Visiting `?debug=1` writes `'1'`. Thereafter the panel renders on **every page load, forever**, with no query string | `?debug=0` only |
| `traceRhythm` | [RhythmLogger.tsx:38](packages/cultivar-os/src/components/RhythmLogger.tsx#L38) | Identical | `?rhythm=0` only |

**Three properties of "sticky" the build must decide about, because they are not obvious:**
- **It survives logout.** The flag is a raw localStorage key with no session coupling — signing out does not clear it. A device left in debug stays in debug for the next person who signs in.
- **It survives a role change.** Nothing re-evaluates the flag against who is now logged in.
- **It is per-browser, not per-user.** So the exposure is bounded — a panel shows only what *that*
  browser captured — but on a **shared demo phone** (the realistic case: David hands Lauren a device,
  or a demo tablet at the nursery) the buffer holds the prior user's trail, tenant ids and emails included.

**Not in scope** (data/cache keys, correctly excluded): `plant_cache:*`, `device_fingerprint`,
`activeBusinessKey`, QBO/auth token stores, `rhythmBuffer`/`captureBuffer` payload keys, sync store.

---

## THE THREE LENSES

**HAVE.** Two activation flags (`?debug=1`, `?rhythm=1`), each sticky via its own localStorage key,
each revealing a floating panel mounted **outside the auth boundary** and therefore rendering on
public routes with **zero role gating**. Two URL-only internal routes, one of which
(`/discovery/inspect`) is unauthenticated and fronts ungated spend + mail branches. **Zero**
gesture/keyword unlocks. The nav registry itself is clean.

**NEED** (irreducible minimum for *"nothing is reached by typing on a phone"*):
1. One shared dev-surface gate that reads **role**, not a query string — replacing the two duplicated `xEnabled()` readers.
2. Profile-menu entries that flip it, so `?debug=1` never needs typing on a phone.
3. The panels moved **inside** the authenticated tree (or the gate made role-aware) so they cannot render pre-login.
4. Keep a non-typed escape hatch for the case the menu itself is broken — **see the open question.**

**WANT** (clean end-state): a single `DevSurfaces` registry — one entry per dev surface (debug
capture, rhythm logger, discovery inspect, QB invoice preview), each declaring
`requiredRole` + `label` + `render`, consumed by the profile menu the way `tileRegistry` feeds the
nav. New dev tool = one registry entry, zero menu edits — the AC-4 "variation in one declarative
place" pattern the platform already uses for nav. The query flags become a **dev-only fallback**,
not the primary path.

---

## OPTIONS (NEED → WANT) — David rules; no recommendation collapsed in

| # | Option | Covers | Cost | Leaves open |
|---|---|---|---|---|
| **A** | Profile-menu toggles for debug + rhythm; keep flags working as-is | The typing problem, only | Smallest | Still ungated pre-login; still two duplicated gates; the two URL-only routes untouched |
| **B** | A + one shared role-aware gate, panels moved inside the auth tree | Typing + the pre-login exposure + the §6 r8 duplication | Moderate | The two URL-only routes untouched |
| **C** | B + `/discovery/inspect` and `/demo/quickbooks-invoice` pulled behind auth and into the menu | Everything in this document's scope | Larger | — |
| **D** | C + the `DevSurfaces` registry (the WANT) | Everything, and the next dev tool costs one entry | Largest | — |

**Independent of A–D:** the `send`-branch gate on `/api/discovery/ingest` (§3b) is a **backend**
fix. Option C hides the *page*; it does not close the *endpoint*, which is callable directly
regardless of what the UI does. **These are two different fixes and should not be conflated.**

---

## OPEN QUESTIONS FOR DAVID

1. **Does the SHA stamp need to survive the gate?** GATE 0 (OP-15, ledger #141) is now read off the DebugPanel footer. If debug becomes role-gated and the menu is what enables it, then **a broken deploy could hide the very stamp that tells you the deploy is broken.** Options: keep a minimal always-visible SHA line independent of the panel (this is placement **(b)** from the #141 recon, which you deferred — this recon is a second, independent argument for it), or accept the coupling.
2. **Should `?debug=1` keep working at all for a signed-in owner?** Cheapest transition is "menu is primary, flag still works." The counter-argument is that a flag that still works is a gate that still leaks.
3. **`rhythm` is David-only, not owner-generic.** Owner-role gating would expose it to Lauren. Does it need a narrower gate than `debug` — and is there a "platform-dev" role, or is it your user id?
4. **Is `/demo/quickbooks-invoice` still needed?** It is an unauthenticated demo fallback with no in-app link. If the demo no longer uses it, **deleting it is cheaper than gating it.**

---

## PROVENANCE

Read-only sweep, 2026-07-20, at `8f99750`. Method: repo-wide grep over
`packages/cultivar-os/src` + `packages/shared/src` for search-param reads, localStorage gates,
gesture/key listeners, and `<Route>` declarations; router diffed against `tileRegistry` + `AppNav`;
each candidate route grepped for an in-app link before being called URL-only. **Nothing was
executed, no endpoint was called, no code was changed.** Claims about auth gating were read from
the route tree and the endpoint source, not inferred from comments — where a comment and the code
agreed (`"no auth — URL is the gate"`), both are cited.
