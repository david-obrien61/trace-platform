# RECON — THE OFFLINE STORY: WHERE STORE-AND-FORWARD LIVES, AND HOW FAR IT REACHES

**Date:** 2026-08-23 · **Branch:** `main` · **HEAD at STEP 0 and at write-up:** `5bcdbf4`
**Type:** RECON ONLY. No app code, no schema, no migration, no cap. Zero diff under `packages/` / `api/` / `supabase/`.
**Gate:** `npm run verify` exit 0, zero net-new (**5 / 247 / 10 / 12 / 15**) · 27/27 test files · 1050 assertions · api/ **12/12** · GATE 0 **NOT APPLICABLE** (nothing ships) · all `[TRACE:*]` ON.
**Read in full at STEP 0:** `CLAUDE.md` (592 lines) · `docs/RULINGS.md` (173 lines, incl. the entire OWED table).

---

## 🔴 DEFECT FOUND OUTSIDE THE TWELVE QUESTIONS — REPORTED, UNFIXED (STEP 5)

### A NETWORK FAILURE RENDERS AS A CONFIDENT, FALSE DOMAIN ANSWER: *"Didn't recognize this."*

`packages/shared/src/inventory/stockLineResolver.ts` discards the Supabase `error` at **all three**
of its reads and substitutes an empty result:

| Line | Statement | Offline consequence |
|---|---|---|
| `:223` | `const { data: lot } = await supabase…maybeSingle()` | `lot` is null → falls through |
| `:236` | `const { data: rows } = await supabase…` | `rows` is null → **`(rows ?? [])`** → an EMPTY catalog |
| `:266` | `const { data: rows } = await supabase…` (`searchStockLines`) | → **`[]`**, i.e. "0 matches" |

`resolveAgainstCatalog([], id)` then returns `{ kind: 'miss', reason: 'no_match' }` — **the identical
value it returns for a tag that genuinely is not in the catalog.** There is no third state.

**What Lauren sees** (`ScanOrder.tsx:302-304` → the `phase === 'unknown'` sheet, `:534-545`):

> **Didn't recognize this**
> Scanned `SCV-0031` — it didn't match a stock line. Check the tag, or keep scanning.

She scans a real tree, holding a real tag, and the app tells her — by name, in a modal, with an
instruction to go check the tag — **that the tree is not in inventory.** She will check the tag.
The tag is fine.

**This is §6/R1's class on the network axis, in its worst form.** A failure that renders as *success*
costs a lot. A failure that renders as *a different, false, actionable fact* costs more, because it
sends the person to do work that cannot help.

**It is also a live instance of a rule already sitting OWED in `docs/RULINGS.md`, written before the
code that would need it:**

> 🔴 **A READ WHOSE ERROR PATH RETURNS A VALUE MUST KEEP "FAILED" DISTINGUISHABLE FROM "EMPTY."**
> A9 says *absent is not empty*; this is A9 on the READ side… A read that fails and returns a
> fallback **has manufactured a fact**, and every consumer treats it as one.

That draft rule now has a named, reproducible instance on the busiest surface in the product.

**Blast radius — three surfaces, one function:**

| Caller | Line | Offline result |
|---|---|---|
| `ScanOrder.tsx` (checkout scan) | `:277` | "Didn't recognize this" — **false** |
| `ScanOrder.tsx` (manual lookup) | `:311` | "0 matches" → same sheet — **false** |
| `InventoryCount.tsx` (the walk) | `:290`, `:630` | miss → typed-entry → `create` branch → refused (honest, but the wrong reason) |
| `usePlant.ts` (QR profile) | `:146` | falls to `setError(plantErr?.message)` — see Q6 |

🔴 **And the second-order consequence, which is the one that matters most: it lands on the surface
the queue DOES cover.** The count path's WRITES are durable in a dead zone. The READ that must
precede every one of those writes is not. Offline, every scan misses, so the walk degrades to typed
entry, which resolves to `create`, which is correctly refused offline — **so the loop the queue was
built for cannot actually be driven from a scan in a dead zone.** The write half is real. The read
half in front of it is what stops.

**Unfixed, per STEP 5.** The fix is a third resolution state (`kind:'unavailable'`) or a thrown/
returned error the callers branch on — a change to a shared resolver and three call sites, which is
a build, not a recon.

---

## STEP 0 — GATE

**Session Starter confirms (three, as asked):**

1. **What was completed last session** — 2026-08-23 (12), ledger **#203**: seven of David's rulings
   filed as RULED rows R-1…R-7; the stale `#85/#86-original` debt row swept along with its whole
   class (45 → 38 segments, 23,266 → 14,530 chars, zero open rows lost); CLAUDE.md 713 → 592 lines,
   under its ~600 budget for the first time in four sessions. Docs only, zero app diff.
2. **Shared modules this session needs** — read-only: `@trace/shared/sync` (`SyncEngine`,
   `NamespacedStore`, `OfflineQueue`), `@trace/shared/assets/assetBlobStore`,
   `@trace/shared/inventory/stockLineResolver`, `@trace/shared/business-logic/tierPricing`.
   Nothing is imported, extended, or written.
3. **Those modules exist and are at WIRED level** — `packages/shared/src/sync/` (4 files, 418 lines)
   has two live consumers; `assetBlobStore.ts` has one. Verified by grep, not by doc.

**Gate results:** branch `main` · HEAD `5bcdbf4` (identical at STEP 0 and at write-up) · working tree
clean at both reads · `npm run verify` exit 0, `✓ GATE PASSED — zero net-new violations`
(tsc 5/5 · eslint 247/247 · knip 10/10, 12/12, 15/15) · `api/` **12 of 12 files**, enumerated.

---

## HAVE / NEED / WANT (OP-8)

### HAVE
A **real, working, correctly-built offline write queue** — `packages/shared/src/sync/` — with a
persisted FIFO, idempotent replay, a reconnect drain, an identity-stamped envelope, and
`[TRACE:SYNC]` on. It is wired into **exactly two surfaces**: the walk-and-count loop and asset
capture. Both of those carry a visible offline banner and (on count) a pending-item counter with a
manual **Sync now** button. **David's airplane-mode test was testing something real.** Everything
else in the product — checkout end to end, the QR profile, the delivery route, the desk reconcile —
has no queue at all, and the shared read path in front of the count loop reports a dead zone as
"not recognized."

### NEED (irreducible, no preference)
For a failed write on an **uncovered** surface to be **visible and retryable**: the person must know
it did not save, and be able to try again. Today checkout is visible-but-unintelligible (`Load
failed`) and the scan is actively misleading. Nothing here needs a service worker, a sync engine, or
a schema change.

### WANT (labelled as want)
One connectivity contract across the app: a single `offline` signal, a resolver with a third
`unavailable` state, checkout writes riding the same queue as counts, a cart that survives a reload,
and a drain whose failures reach a screen instead of a console.

---

## STEP 2 — THE TWELVE QUESTIONS

### THE FOUNDATION

#### Q1. IS THERE A SERVICE WORKER? — **NO. NONE, ANYWHERE.**

Swept source **and** build config:

- `grep -rniE "serviceWorker|service-worker|workbox|vite-plugin-pwa|registerSW|sw\.js"` across
  `packages/`, `api/`, root `*.html`, `*.json`, `*.mjs` → **zero hits.**
- **No `public/` directory exists in the repo at all** (`find . -type d -name public` outside
  `node_modules` → empty), so nothing can be emitted from one.
- `packages/cultivar-os/vite.config.ts` — plugins are `[react()]` only. No PWA plugin.
- **No PWA/offline dependency in any `package.json`** — `pwa`, `workbox`, `idb`, `dexie`,
  `localforage`, `pouchdb`, `background-sync` → zero hits.

Since no plugin is installed, no plugin can emit one with no call site — the build-output concern the
question raises **cannot arise here**, and the reason is structural rather than observational.

**So, of the two situations named in the question, the SECOND is true:** the app shell cannot load
offline — a cold start or a hard refresh in a dead zone gets nothing — **and store-and-forward works
inside an already-open session.** That is exactly the shape of the behaviour David proved.

⚠️ The practical consequence is worth stating plainly: **the offline capability that exists survives
a dead zone but not a reload.** iOS Safari discards backgrounded tabs under memory pressure. A phone
in a pocket between rows is a phone that may come back to a blank reload.

#### Q2. MANIFEST / INSTALLABILITY? — **NO.**

`packages/cultivar-os/index.html` is 13 lines, quoted in full below:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#27500A" />
    <title>Cultivar OS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

No `<link rel="manifest">`, no `manifest.json` anywhere in the repo, no icons, no `display` mode.
`theme-color` is present but that is a browser-chrome tint, not installability.

**Relevance to the mobile-wrap question:** Cultivar today is a **browser tab**, with a browser tab's
lifecycle — it can be discarded, and in a Private tab its storage dies with it (Q3). An installed
PWA or a native wrap changes both. This is a real input to that decision and it is currently
unrecorded anywhere.

#### Q3. 🔴 WHICH STORE HOLDS THE QUEUE? — **`localStorage`. And there is a SECOND store, in IndexedDB, deliberately split.**

**The op queue:** `packages/shared/src/sync/store.ts:19-34` — `defaultAdapter()` returns a
`localStorage` adapter when `typeof localStorage !== 'undefined'`, else an in-memory `Map`
(process-lifetime only — SSR/Node/tests). Keys are
`trace:sync:<businessId>:<domain>:queue` (`:36`, `:44`, `:47`; `offlineQueue.ts:15`), holding a
JSON-stringified `OfflineOp[]`.

**The asset blobs:** `packages/shared/src/assets/assetBlobStore.ts` — a real **IndexedDB** store
(`trace-assets` / `pending`, `:31-33`), holding compressed image bytes.

**Is the choice deliberate or inherited? BOTH, and the split is the deliberate half.**
`assetBlobStore.ts:4-11` states it in its own header:

> the #57 sync slice queues SMALL STRUCTURED ops over localStorage (string values) — **it cannot
> hold image bytes.** … Kept SEPARATE from the #57 queue so that queue stays string-clean: the
> queue never carries bytes, only the id reference on drain.

So someone hit the localStorage limit for a real reason, reached for IndexedDB for that case, and
wrote down why. The localStorage base underneath is **inherited** — `store.ts:3-6` calls itself
*"the clean de-Ignition-keyed lift of DataBridge's save/load"*, replacing the single hardcoded
`IGNITION_OS_DATA` blob.

**How big can it get before it breaks?** Measured, not estimated — a representative envelope
serialized:

| Op | Bytes |
|---|---|
| `rpc` → `count_reconcile_inventory` | **580** |
| `insert` → `inventory_counts` | **512** |
| `update` → `inventory_count_sessions.item_count` | ~400 |

One counted item enqueues all three ≈ **1.5 KB**. Against a ~5 MB localStorage budget (~2.5 MB of
ASCII where the browser stores UTF-16), that is roughly **1,600–3,300 counted items** before quota.
**A day's walk at LAWNS is nowhere near it. Capacity is NOT the risk.**

**🔴 THE RISK IS THE ERROR PATH, AND IT IS SILENT.** `store.ts:55-58`:

```ts
save<T>(key: string, value: T): void {
  try { this.adapter.setItem(this.k(key), JSON.stringify(value)); }
  catch { /* quota exceeded / storage disabled — best-effort, never throw into a Save */ }
}
```

If `setItem` throws — quota exceeded, or storage disabled — **the write is swallowed and `enqueue`
returns normally.** `submit()` then reports `{ status: 'queued' }`, the UI says *"Offline — counts
are saved on this phone and will sync when you're back in signal"*, and **nothing was saved.** The
comment's intent is right (never throw into a Save); the consequence is that the failure has no
reader. The one weak signal is indirect: `pendingCount()` reads back the unchanged array, so the
*"N waiting to sync"* badge would not advance — a discrepancy nobody is watching for.

**🔴 AND THE PRIVATE-BROWSING CONNECTION DAVID IS SEPARATELY CHASING.** In a Safari Private tab,
`localStorage` is **scoped to that tab and cleared when it closes** (older WebKit threw on `setItem`
outright, which lands on the swallow above). **The store holding a day's counts is the same
mechanism suspected in the logout loop.** In a Private tab a completed walk can vanish with the tab,
with the app having said it was saved. **This is stated as an inference from the storage model, not
as an observed instance — nobody has tested the count loop in a Private tab.** It belongs on the
owner-test card, and it is there (card 5 below).

**Is the store safe for a day's work? Capacity — yes, comfortably. Durability — NO, with two named
holes:** a swallowed write that reports success, and a Private tab that discards the whole store.
IndexedDB is the correct home for an outbox for exactly these reasons; the codebase already knows
that, and already uses it 40 lines away for the blobs.

> ✅ **NOTE HONOURED:** Supabase Auth's own `localStorage` session was **not** counted as offline
> capability anywhere in this recon. The only stores counted are `trace:sync:*` and `trace-assets`.

---

### COVERAGE — the half that decides everything downstream

**The complete consumer list for `SyncEngine`, platform-wide** (grep for `SyncEngine|syncNow|pendingCount`, excluding `sync/` itself):

| Surface | Line | Domain | Covered? |
|---|---|---|---|
| `InventoryCount.tsx` | `:194` | `inventory-count` | ✅ writes queued |
| `AssetCapture.tsx` | `:62` | `asset-capture` | ✅ writes queued (+ IndexedDB blobs) |
| *everything else* | — | — | ❌ **no queue** |

`InventoryReconcile.tsx:306`'s `pendingCount` is an unrelated local variable (lots with text typed
in), not the engine's — checked, so it is not miscounted as a third consumer.

**Corroborating this independently: only TWO files in the entire app contain any offline UI at all.**
A grep for `navigator.onLine|CloudOff|'offline'` across `packages/cultivar-os/src` and
`packages/shared/src` returns hits in `InventoryCount.tsx` and `AssetCapture.tsx` — **and nowhere
else.** The queue's reach and the UI's honesty about connectivity are the same two surfaces, which
is at least internally consistent.

#### Q4. 🔴 CHECKOUT, END TO END — **NOT COVERED. AND THE CART IS IN-MEMORY ONLY.**

| Step | Network call | On failure |
|---|---|---|
| `/checkout/scan` — mount | `readPricingConfig` (`ScanOrder:164`) | `{ data }` destructured, **error discarded** → discount types null → tier falls to retail fast-path |
| `/checkout/scan` — scan | `resolveStockLine` (`:277`) | 🔴 **"Didn't recognize this"** — false (see top) |
| `/checkout/scan` — manual lookup | `searchStockLines` (`:311`) | 🔴 **"0 matches"** → same sheet — false |
| `/checkout/scan` — availability | `fetchCommittedByLot` (`:289`, `:326`) | fires only when a picker is needed |
| `/checkout/scan` — customer search | `.from('customers')` (`:176`) | `error` captured at `:186-189` (a column-fallback retry) |
| `/checkout/review` — mount | `readPricingConfig` (`CartReview:47`) | error discarded → tax redline suppressed until `taxLoaded` |
| **every price change** | **NONE — see Q11** | n/a |
| `/checkout/review` — submit | `fetch('/api/orders/submit')` (`useSubmitOrder:108`) | ✅ **thrown, caught, surfaced** |

**Submit is the one honest link in the chain.** `useSubmitOrder:203-206` catches, sets `error`, and
`CartReview:628-632` renders it in a red bordered box. Offline that box reads **`Load failed`**
(WebKit) or **`Failed to fetch`** (Chromium) — the browser's internal string, shown to whoever is
standing there. **Visible: yes. Intelligible: no.** Nothing says "you're offline", nothing says
"try again when you have signal", and there is no retry affordance beyond pressing the button again.

**🔴 CAN A CART SURVIVE A RELOAD? NO. IT IS REACT/ZUSTAND STATE ONLY.**
`packages/cultivar-os/src/hooks/useCart.ts:1` — `import { create } from 'zustand'`, a bare store with
**no `persist` middleware**. A grep for `zustand/middleware` / `persist(` across all of `packages/`
returns hits **only** in `shared/src/devtools/devSurfaces.ts` (a dev-panel preference), never in the
cart. So: **a reload, a tab discard, or a crash loses the entire cart** — every scanned line, the
attached customer, the invoked tier, the transport choice, the netting decision.

Combined with Q1: the app shell cannot load offline, so a dead-zone reload gives a blank page **and**
an empty cart. That is a sale walked back to the office to re-ring.

#### Q5. THE WALK-AND-COUNT LOOP — **THE WRITES ARE COVERED. #67's PREMISE IS CONFIRMED, WITH ONE CORRECTION.**

**#67's claim, verified true:** `InventoryCount.tsx:438-448` calls `count_reconcile_inventory` at
capture. The phone applies each entry itself.

**The correction #67 does not carry, and it matters:** the call does **not** go to `supabase.rpc`.
It goes through **`engine.rpc({...})`** — the queue. So *"what happens to that RPC with no network?"*
has a precise answer: **it is QUEUED, not lost.** `syncEngine.ts:143-155` — `submit()` always
enqueues first, and returns `{ status: 'queued' }` when `!isOnline()`. The Save cannot fail in a
dead zone. `types.ts:28-32` documents why this is *correct* for a count rather than merely
convenient:

> `count_reconcile_inventory` computes `delta = counted − current` at APPLY time under a FOR UPDATE
> lock. So a count queued in a dead zone reconciles against whatever the qty actually is when it
> lands (e.g. after a sale drained first) — which is the correct reading of "I physically counted
> 12", not a stale delta replayed blind.

**What the user sees — and this surface is the only one in the app that does this properly:**

- `InventoryCount.tsx:728-732` — a persistent banner: *"⛅ Offline — counts are saved on this phone
  and will sync when you're back in signal."*
- `:733-737` — a live pending counter and a manual drain: *"Sync now (N waiting)"* when online,
  *"N waiting to sync"* when not.
- `:748` — the idle screen refuses honestly: *"You're offline — connect to start. Once a count is
  going, dead zones are fine."*

**Two deliberate, documented online-only reductions inside the covered surface** — both refuse with a
plain-English reason rather than failing silently:

1. **Starting a count** (`:222-226`) — a session must be minted online.
2. **Creating a brand-new size** (`:507-513`) — the `create` branch, because
   `count_promote_create_inventory` mints the lot id **server-side** and `recordCount` needs that id
   *now* to link the count record. The comment says so and names the cost:
   *"Counting EXISTING lots still works in a dead zone; only minting a brand-new variety needs a
   connection. Closing this needs a client-supplied `p_lot_id` — a migration."*

🔴 **And the finding from the top of this document lands exactly here.** Because
`resolveStockLine` (`:290`) reports a dead zone as a miss, an offline scan falls through to typed
entry, which resolves to `create`, which is the branch that is refused. **So in a genuine dead zone
the loop reduces to: scan → "no match" → type the name → "you're offline, adding a new size needs a
connection."** The write machinery is sound and the read in front of it defeats it. **Anyone
verifying this must resolve the item BEFORE going offline** — which is, in all likelihood, exactly
the sequence David's successful test followed.

#### Q6. THE QR SCAN → PLANT LOOKUP — **PARTIALLY COVERED, BY A READ CACHE NOBODY HAS WRITTEN DOWN.**

🔴 **`usePlant` has a `localStorage` read cache and it is not mentioned in `built-inventory.md`, the
owner-test board, or any handoff entry I read.**

`packages/cultivar-os/src/hooks/usePlant.ts:41-62`: key `plant_cache:<tagId>`, **24-hour TTL**
(`:40`), holding `{ plant, events, availableCount, cachedAt }`. It is seeded into initial state at
`:69` / `:77` / `:83` — i.e. **before any fetch**, so a cached tag renders instantly and offline.
It is written on both success lanes (`:125` specimen, `:151` stock-line). It self-invalidates on a
pre-`business_id` shape (`:50`).

**So: a tag scanned within the last 24 hours resolves offline. A tag never scanned on that device
does not.**

**The failure behaviour on a cache miss** (`:178-181`):

```ts
if (!plant) setError(plantErr?.message ?? 'Plant not found');
```

`plantErr` is the L1 `cultivar_plants` error, which supabase-js populates on a wire failure — so
this shows **`TypeError: Failed to fetch`** rather than "Plant not found". Better than the scan
sheet (it is at least network-shaped), but it is a raw browser string on a **customer-facing public
QR page**. And the `[TRACE:RESOLVE] usePlant — UNRESOLVED (no specimen, no stock line)` emit at
`:179` asserts a catalog fact that was never established — the same manufactured fact as the top
finding, in the trail this time.

**On the cache-hit path there is no error at all** — `plant` is already non-null from the cache, so
the `if (!plant)` guard correctly suppresses it and the cached profile just stays on screen. That is
genuinely good stale-while-offline behaviour. **It is also completely silent about being stale** —
nothing tells the reader the qty and price they are looking at are up to 24 hours old.

**The app's own help text is already honest about this and is now slightly wrong in the safe
direction** — `Help.tsx:691-692`: *"The scan itself works offline — opening the plant profile page
requires internet."* True for a first-time tag; understated for a cached one.

#### Q7. THE DELIVERY ROUTE — **NOT COVERED. HOLDS ITS STOPS ONCE LOADED; RE-FETCHES ONLY ON A REAL CHANGE.**

`DeliveryRoute.tsx:370-373` — one `useEffect` keyed `[businessId, dateParam]`. **It does not re-fetch
on every render**; once `load()` resolves, stops live in React state for the life of the mount. So a
route already open before signal drops keeps working as a list.

Failure handling is **better than checkout's and worse than count's**:

- `:390-402` (`deliveries`) and `:428-441` (`orders`) — `error` **captured and surfaced**
  (`setError(err.message)` → `:558` renders it in red). Raw supabase message again.
- `:381-382` (`businesses.address`, the route anchor) — **`{ data: bizRow }`, error discarded.**
  Offline the origin/destination is silently absent.
- The Google Maps overlay (`:141-142`, `:301-305`) **degrades deliberately and says so**:
  *"Map unavailable — use the link below."* — with a URL-handoff card that still works. That is the
  most graceful failure path in the codebase and it was clearly designed.

**The write on the delivery side** is `DeliverySchedule.tsx:142-160` (`editDate`) — not queued, but
honest: a pre-emptive permission check, an A8 `.select('id')` to prove the row actually moved, an
error surfaced, and a distinct message when zero rows come back. **A reschedule attempted in a dead
zone fails visibly and is retryable by re-entering the date.** Of the uncovered write paths this is
the best-behaved.

**A reload while driving** re-enters `load()` with no cache and no queue → red raw error, empty
route.

---

### THE FAILURE BEHAVIOUR

#### Q8. 🔴 WHAT A DROPPED CONNECTION LOOKS LIKE ON AN UNCOVERED SURFACE

**All three shapes the question names are present, on different surfaces. There is no single
behaviour — which is itself the finding.**

| Surface | Shape | What is on screen |
|---|---|---|
| **Checkout scan / lookup** | 🔴 **A CONFIDENT FALSE ANSWER** | *"Didn't recognize this. Scanned SCV-0031 — it didn't match a stock line. Check the tag."* |
| **QR plant profile** (cache miss) | ⚠️ **RAW BROWSER STRING** | `TypeError: Failed to fetch` |
| **QR plant profile** (cache hit) | ⚠️ **SILENTLY STALE** | The plant renders normally. Up to 24h old. Nothing says so. |
| **Checkout submit** | ⚠️ **RAW BROWSER STRING, red box** | `Load failed` |
| **Delivery route load** | ⚠️ **RAW SUPABASE MESSAGE, red text** | e.g. `TypeError: Load failed` |
| **Delivery reschedule** | ✅ **NAMED, RETRYABLE** | error surfaced, or *"That delivery date was not saved…"* |
| **Pricing config reads** | 🔴 **SILENT** | Discount types stay null; retail is shown as though authoritative |
| **Route anchor address** | 🔴 **SILENT** | Origin absent, no note |

**A spinner that never resolves is NOT among them** — every `await` here settles, because
supabase-js and `fetch` both reject rather than hang. **Nothing hangs. Some things lie.**

🔴 **The ordering the question predicts is right, and worse than "she meets it first": the two
surfaces Lauren touches most are the two that lie.** She scans (false "not recognized"); if she gets
past that, she reaches Review and sees retail with no indication the tier config never loaded; then
submit says `Load failed`. Three failures, three different vocabularies, one of them factually
wrong.

**AND ON THE SURFACES THE QUEUE *DOES* COVER — IS PENDING WORK VISIBLE? YES, ON BOTH, AND IT IS
GOOD:**

- **Count** — the offline banner (`:728-732`) **plus a live count of unsent items and a manual Sync
  now button** (`:733-737`), both `phone`-provable with no console.
- **Asset capture** — an `Offline` chip (`AssetCapture.tsx:128`) and a live *held* count
  (`countPendingAssets`, `:73`).

**It does not sync invisibly. The two covered surfaces tell the truth about connectivity, and no
other surface in the app mentions it at all.**

🔴 **One real gap inside the covered surfaces, though: the DRAIN's failures are console-only.**
Every one of the three `syncNow()` invocations discards its `DrainResult` —
`syncEngine.ts:62` (`boundOnline`), `:97` (`start()`), and `InventoryCount.tsx:734` (the button, via
`void engine.syncNow()`). So when the drain fails on reconnect, the badge keeps reading *"N waiting
to sync"*, the button keeps doing nothing visible, and the only evidence is
`[TRACE:SYNC] drain — { applied: 0, failed: 1, … }` **in a console that, per OP-14's own
`DEVICE: phone` rule, is not available in the lot.**

#### Q9. THE REPLAY — **THREE TRIGGERS, NO POLL. IDEMPOTENT, WITH ONE DOCUMENTED IMPERFECTION.**

**What triggers it:**

1. `window.addEventListener('online', …)` — `syncEngine.ts:96`, attached by `start()`.
2. **`start()` itself** drains a queue left from an interrupted session — `:97`
   (`if (this.pendingCount() > 0) void this.syncNow()`). This is the one that recovers a reload.
3. **Every `submit()` when online** — `:150` drains before returning, so an online write also
   flushes anything stale ahead of it.
4. The manual **Sync now** button — `InventoryCount.tsx:734`.

**There is no polling** — `grep setInterval` across `sync/`, `InventoryCount.tsx`, `AssetCapture.tsx`
→ zero hits. So a device that regains a *usable* connection without the browser firing an `online`
event (captive portal, flaky cell handover — `navigator.onLine` is famously optimistic) sits idle
until the user presses the button or re-enters the page. **The button is the safety net, and it is
only on the count screen.**

**If the replay itself fails** — `drain()` `:167-185`:
- `'retry'` (connectivity) → **`break`**, queue intact, order preserved.
- a genuine reject → `failed++`, **`break`**, and **the op is KEPT** for a deliberate retry.
- `execute()` catching a thrown fetch (`:223-228`) → treated as `'retry'`.

**IS IT IDEMPOTENT? Per kind:**

| Kind | Mechanism | Verdict |
|---|---|---|
| `insert` | `clientId` **is** the row PK (`:116`, `types.ts:45-48`); `23505` on replay → `'applied'` (`:195`) | ✅ Idempotent with **no schema change** |
| `update` | `{set, match}` — an absolute SET | ✅ Idempotent by nature |
| `rpc` | absolute reconcile under `FOR UPDATE` | ✅ for qty; ⚠️ see below |

**🔴 COULD A REPLAYED COUNT APPLY TWICE — i.e. #57's 114 → 118 accumulation? NO, AND THE REASON IS
STRUCTURAL.** `count_reconcile_inventory` computes `delta = counted − current` at apply time. It
lands **absolutely** on the counted number. Replaying "counted 12" ten times still yields 12.
**#57's class cannot recur through this queue** — that defect was accumulation, and this RPC asserts
rather than accumulates. `reconcileMath.test.ts:157` pins exactly that (*"it lands absolutely on the
counted number"*).

**The one imperfection, documented at `types.ts:34-39` rather than discovered here:** an RPC has no
natural idempotency key. If the call APPLIES but the RESPONSE is lost, the retry re-applies —
qty is unaffected (absolute), **but a second zero-delta ledger row is written.** The header calls
this *"a duplicate FACT, not corruption: the replay says 'counted, and it agreed'"*, and names the
fix as a client-supplied movement key, i.e. a migration. **Bounded, honest, and already written
down.**

#### Q10. 🔴 ORDERING AND CONFLICT — **NO. A FAILURE AT POSITION 2 STOPS POSITION 3 PERMANENTLY.**

**The direct answer to the question as posed: if three writes queue and the second fails on replay,
the first lands and the third DOES NOT.** `drain()` `break`s on **both** outcomes —
`syncEngine.ts:176` (retry) and `:180` (hard reject) — deliberately, to preserve FIFO order. For a
transient failure that is correct. For a **permanent** one it is head-of-line blocking: the poisoned
op is kept, and every op behind it is stuck behind it forever.

**The only escape is `forget()`, and it has two call sites, both for one narrow case** —
`InventoryCount.tsx:237` and `:685`, each guarded by `isMissingTable(...)` (the pre-migration deploy
window). **There is no UI anywhere that lets a person dismiss a stuck op.** So an RLS refusal, a
constraint violation, or a domain-level RPC refusal (`applied: false`, handled at `:212-214`) parks
the queue indefinitely, with the badge reading *"N waiting to sync"* and no explanation reachable
without a console (Q8).

⚠️ Worth contrasting: **the asset drain does not have this problem.** `assetCapture.ts:192-194`
logs the failure, **keeps that blob, and `continue`s** to the next one. Two drains, two different
resilience models, in the same codebase. Neither is documented as a choice.

**DOES ANYTHING RECONCILE A QUEUED WRITE AGAINST A CHANGE MADE ELSEWHERE? — PARTLY, AND ONLY BY
LUCK OF THE RPC's SHAPE.**

- **For counts: yes, and correctly.** Because the delta is computed at apply time under a lock, a
  sale that drained while the phone was offline is already reflected; the count still lands on the
  physical number. This is genuine conflict resolution and `types.ts:28-32` argues for it explicitly.
- **For `update` ops: no.** They are last-writer-wins with no comparison.
- 🔴 **`clientTs` — the field put on the envelope FOR this — IS NEVER READ.** `types.ts:56` describes
  it as *"reconcile ordering for SETs"* and `syncEngine.ts:109` writes it, but a
  platform-wide grep for `clientTs` finds **no reader anywhere in `sync/`**. (It *is* read in
  `assetBlobStore.ts:80,85` for ordering — a different store.) So the envelope carries a
  reconciliation input that no reconciler consumes. Harmless today; it is a field that reads as a
  capability and is not one.

---

### THE DECISION INPUTS

#### Q11. 🔴 HOW MANY ROUND TRIPS WOULD R-5 ADD — **FOURTEEN CONTROLS, AND TODAY EVERY ONE OF THEM COSTS ZERO.**

**The baseline, and it is the number that decides this question: `computeOrderPricing` is called in
CartReview's RENDER BODY** — `CartReview.tsx:200`, a synchronous, pure, in-memory call over
already-loaded state. It is not in a `useEffect`, it makes no request, and it re-runs on every
keystroke of state change for free. **The config it needs is fetched ONCE on mount** (`:43-47`
`readPricingConfig`). **So the number of network round trips caused by price-affecting interactions
in checkout today is ZERO.**

**The price-affecting controls, enumerated from source:**

| # | Control | Site | Network today |
|---|---|---|---|
| 1 | Line qty stepper | `CartReview:379` | none |
| 2 | Remove line | `CartReview:384` | none |
| 3 | Add planting | `CartReview:457` | none |
| 4 | Remove planting | `CartReview:449` | none |
| 5 | Decline netting | `CartReview:476` | none |
| 6 | Re-add netting | `CartReview:485` | none |
| 7 | Toggle add-on off | `CartReview:509` | none |
| 8 | Toggle add-on on | `CartReview:517` | none |
| 9 | Service qty change | `CartReview:226` | none |
| 10 | Service price override (owner leakage) | `CartReview:88`, `:434` | none |
| 11 | Apply tax exemption | `CartReview:612` | none |
| 12 | Reset tax exemption | `CartReview:613` | none |
| 13 | Transport branch radio | `AddOns:177` | none |
| 14 | Attach customer / invoke tier | `ScanOrder:176`, `:206` | ⚠️ **already a round trip** |
| — | Add a line by scanning | `ScanOrder:277` | already a round trip (the resolve) |

**THE ANSWER: 14 price-affecting controls. 13 become GENUINELY NEW round trips under R-5. Exactly
ONE (#14, customer attach) already makes a request that R-5's call could ride.**

**In practice, per sale.** A four-item order with a qty adjustment on each, a transport choice, a
netting decision and one add-on = **4 scans + 4 qty + 1 transport + 1 netting + 1 add-on ≈ 11 round
trips**, at the far end of a lot, on a phone, on the surface with the worst signal in the business.
Today that same order makes 4 requests (the scans) and prices itself locally.

#### 🔴 **AND THE ONE THAT MATTERS: CAN THE QUEUE ABSORB R-5's CALLS? — NO. THREE INDEPENDENT REASONS, ON EVIDENCE.**

1. **Checkout is not a queue consumer at all.** `SyncEngine` has exactly two consumers (Q4 table),
   neither in the checkout path. Nothing in `ScanOrder`, `CartReview`, `AddOns`, `CustomerCapture`
   or `useSubmitOrder` imports it.
2. **The queue holds WRITES; a price resolution is a READ.** `OpKind` is
   `'insert' | 'update' | 'rpc'` (`types.ts:12`) and `drain()` discards every result — the `rpc`
   branch (`:202-215`) reads `data` only to detect a domain refusal, then returns `'applied'` and
   **removes the op**. There is no mechanism by which a queued call returns a value to a component.
   **Queuing a price question returns no price.**
3. **The FIFO would be the wrong shape even if it did.** A price question is *latest-wins*; the
   queue is *ordered, keep-everything, head-of-line-blocking* (Q10). Nine qty taps would queue nine
   questions and answer the first.

**So the objection is NOT weakened by the queue, and I will not report that it is.**

⚠️ **But the honest UI the question describes is still buildable — just not from the queue.** The
client already holds `sell_price` on every cart line (`ScanOrder` → `synthesizePlant` →
`CartItem.plant.business_inventory.sell_price`), and **retail is not confidential** (D-35 / R-5's own
carve-out — R-5 removes *cost* from the client, not *price*). So Review can render the retail figure
as *"estimated — confirming"* and settle to the server's resolved number when it arrives.
**That is an optimistic-display mechanism over data the client already has, and it is a different
build from the outbox.** Recording it here so the option is on the table rather than being
discovered later as a surprise.

⚠️ **One more input R-5's cost-benefit should carry: the failure mode is not merely "slow", it is
"a price that will not render."** With no local computation, a checkout in a dead zone cannot show a
total at all — and per Q4 a reload loses the cart. Under R-5 the LAWNS worst case is a sale that
cannot be priced *or* recovered. That is a stronger argument for the estimate-and-confirm shape than
for round-trip count.

#### Q12. THE VERCEL CEILING — **✅ NO NEW FUNCTION NEEDED. THE SEAM ALREADY EXISTS AND IS ALREADY DOCUMENTED AS ONE.**

`api/` is confirmed **12 of 12** (enumerated in STEP 0). **R-5 is NOT blocked by the ceiling**, and
the candidate is not a guess — `packages/cultivar-os/api/orders/submit.ts:180-192` is already an
action dispatcher, and its own comment cites the rule:

```ts
// One endpoint, multiple actions (12-fn ceiling — CLAUDE.md §6 rule 11). action absent/'create'
…
const action = req.body?.action ?? 'create';
if (action === 'create') return handleCreate(req, res);
if (action === 'update') return handleUpdate(req, res);
if (action === 'delete') return handleDelete(req, res);
if (action === 'status') return handleStatus(req, res);
return res.status(400).json({ error: `Unknown action: ${action}` });
```

**`action: 'price'` (or `'quote'`) → `handlePrice` is a fifth branch on an existing file.** And it is
the *correct* home rather than merely an available one: **this file already imports and runs the
exact machinery R-5 requires** — `normalizeDiscountTypes, resolveTier, computeOrderPricing,
resolveTaxRate, RETAIL_FLOOR` (`:7`), executed server-authoritatively at `:605`. A price branch
would call the same function with the same inputs the charge path uses, which is precisely what
makes R-5 dissolve C-A rather than relocate it.

**Conclusion: R-5 is shippable before any plan upgrade. §6 r11's STOP-and-surface does not fire.**

---

## STEP 3 — THE TWO CONNECTIONS

### 3a. 🔴 IS THE OFFLINE QUEUE THE SAME MECHANISM AS BLIND CAPTURE? — **NO. ADJACENT, AND ON THE DECISIVE AXIS IT IS THE OPPOSITE.**

**First, the fact under it, verified:** `blind_capture_mode` has **zero hits** across every `.ts`,
`.tsx` and `.sql` in `packages/`, `supabase/` and `api/`. Nothing is built. (This confirms RULINGS
row **R-B** independently.)

**Where they genuinely overlap — and it is not nothing:**
- Both are *record now, apply later*.
- The queue **already proves durable, idempotent deferral works on this exact table, through this
  exact RPC**, which is the risky part of any deferral design.
- `OfflineOp` already carries `clientId`, `userId`, `clientTs`, `domain` — **the envelope a
  blind-capture record would need**, already designed and already tested.

**Where they part, and it is the whole point of #67:**

| | Offline queue | Blind capture (#67) |
|---|---|---|
| What is deferred | **WHEN** the write lands | **WHETHER the phone applies at all** |
| Who applies | **Nobody — `drain()` fires on the `online` event** | **A HUMAN, at the desk** |
| Human in the loop | **None** | **The entire point** |
| Residual at the desk | **0 by construction, just later** | the actual variance, for review |

🔴 **The decisive finding: the queue does not partly build blind capture — it REPRODUCES #67's
defect on a delay.** #67's complaint is that the phone applies at capture, so *"by the time the desk
reconcile screen opens, book == counted and the residual is 0 by construction."* With the queue,
the phone applies **at drain** — automatically, on reconnect, with no human anywhere in the path. So
Lauren walks back into signal, `boundOnline` fires, everything applies, and she opens the desk screen
to *"agrees — done"*. **Same screen, same emptiness, a few minutes later.**

**VERDICT: ADJACENT — sharing a durability substrate, opposed on the decision axis.**

**And therefore the scoping recommendation the question asks for, which points the *other* way from
the one it anticipates:** the count-session work and the offline work should **not** be scoped as one
build *because they are the same thing* — they should be scoped together **because blind capture is a
change to what `engine.rpc` at `InventoryCount.tsx:438` is allowed to do**, and #68/**R-C** hangs off
the same line. Specifically:

- Blind mode = **replace** the queued `count_reconcile_inventory` with a queued **insert into
  `inventory_counts` only** — a kind the queue already supports, whose idempotency is already the
  strongest of the three (PK = `clientId`).
- The desk applier then issues the RPC — and `InventoryReconcile.tsx:486` **already calls that RPC
  directly** (not through the engine), so the desk half of the machinery exists.
- 🔴 **The hazard R-C names would be CREATED by this build, not inherited:** `inventory_count_sessions`
  today has exactly **one writer** — three sites, all in `InventoryCount.tsx` (`:230` insert,
  `:689` `item_count`, `:701-703` `completed`) — and `InventoryReconcile.tsx` never touches it.
  Verified by grep. A desk applier writing `status` makes it two.

**One point strongly in favour of doing them together: the queue makes blind capture CHEAPER, not
harder.** The offline path already has to hold an unapplied intent; blind mode is that same intent
held for a *reviewer* instead of for a *reconnect*. The mechanism is built; what is missing is the
decision about who releases it — which is exactly **R-B**, sitting OWED.

### 3b. WHAT IS *NOT* COVERED THAT SHOULD BE — in the order a LAWNS person hits it

**No fix designed, per the instruction. Ordered by encounter, not by severity.**

1. **The scan resolve, on BOTH the checkout and count paths.** First touch of the day, both loops,
   and it reports a dead zone as *"didn't recognize this."* It is uncovered **and** actively wrong,
   and it sits in front of the one write path that *is* covered. **First in encounter order and
   first in cost.**
2. **The cart's survival.** In-memory only. A backgrounded tab, a reload, or a crash loses a
   part-built order with no trace. Hit second because it is hit whenever step 1 was survived.
3. **The checkout submit.** The end of the sale, and it is where money stops. Visible but
   unintelligible (`Load failed`), no queue, no retry affordance, and the cart it depends on is #2.
4. **The pricing-config read (`ScanOrder:164`, `CartReview:47`).** Silent. A tier customer can be
   shown retail with nothing indicating the config never loaded — the quietest of the set, and the
   only one that is about money rather than about workflow.
5. **The drain's own failures.** Inside the covered surface, invisible without a console —
   which the `DEVICE: phone` rule says is not available where this happens.
6. **The QR profile's staleness.** Covered up to 24h by the undocumented cache, then a raw
   `TypeError` — on a page a *customer* may be holding.
7. **The delivery route.** Holds once loaded; a reload in the field gives a raw error and an empty
   list. Last only because it is hit least often.

---

## STEP 4 — THE ESTIMATE

**Sized to the honest floor the instruction sets: not a service worker, not a sync engine — just
*the person knows it did not save, and can try again*.** Something IS missing, so this step is not
skipped.

**Floor A — make the network failure stop lying (items 1 and 4 above).**
A third resolution state on the shared resolver (`kind: 'unavailable'`) instead of collapsing a
wire failure into `miss`, plus the three call sites branching on it, plus the two `readPricingConfig`
call sites reading their discarded `error`.
**≈ 1 prompt unit · 0 migrations · 0 rulings.**
This is a read-path change with no schema and no new permission. It closes the top defect and the
quietest one in the same pass, and it is the only item here that removes a *false statement* rather
than adding a *message*.

**Floor B — make the uncovered WRITE failures intelligible and retryable (items 3 and 5).**
Map connectivity-shaped errors to one honest sentence at the two places a write can fail without a
queue (`useSubmitOrder`, `DeliverySchedule.editDate`), and surface the discarded `DrainResult` from
`syncNow()` so a stuck queue can say so on the count screen.
**≈ 1 prompt unit · 0 migrations · 0 rulings.**
`isConnectivityError` (`syncEngine.ts:35-39`) **already exists and already encodes the predicate** —
it is currently private to the engine. Reusing it is §6 r8; writing a second copy is the drift the
rule exists to catch.

**Floor A + B together ≈ 2 prompt units, 0 migrations, 0 rulings, no new `api/` function, no cap.**

**Explicitly NOT in the floor, and named so the floor is not mistaken for the whole:** cart
persistence (a real design decision — where, and what expires), the poisoned-op escape hatch (needs
a ruling on who may discard a refused write, and it is the same shape as **T-E**/`campaigns:delete`
— *what gates a destructive act with no string*), moving the outbox off `localStorage` to IndexedDB,
and any part of R-5.

---

## CLOSING SUMMARY (STEP 6 order)

**· WHICH SURFACES THE QUEUE COVERS, AND WHICH IT DOES NOT**
**Covered (2):** the walk-and-count loop (`InventoryCount.tsx:194`, domain `inventory-count`) and
asset capture (`AssetCapture.tsx:62`, domain `asset-capture`). Both queue their writes, both show an
offline banner, both show a pending count.
**Not covered (everything else):** checkout scan → picker → Review → submit, the QR plant profile,
the delivery route and schedule, the desk reconcile, and every other write in the app. Corroborated
independently: only those same two files contain any `navigator.onLine` / offline UI at all.
🔴 **And the qualification that changes the shape of the answer: on the covered count surface the
WRITES are queued but the READ in front of them is not — so a dead-zone scan cannot resolve, and the
covered loop cannot be driven from a scan without signal.**

**· WHICH STORE HOLDS IT, AND IS IT SAFE FOR A DAY'S WORK**
**`localStorage`**, keyed `trace:sync:<businessId>:<domain>:queue` (`store.ts:36-47`). A second store,
**IndexedDB** (`trace-assets`), holds asset image bytes — a deliberate, documented split
(`assetBlobStore.ts:4-11`), while the localStorage base itself is inherited from DataBridge.
**Capacity: safe** — ~1.5 KB per counted item, ~1,600–3,300 items before quota, far beyond a day.
**Durability: NOT safe, two named holes** — `store.ts:57` **swallows a quota/disabled-storage failure
silently** while the UI says the count was saved, and in a **Private tab** the store is cleared with
the tab. IndexedDB is the correct home for an outbox and the codebase already knows it.

**· WHAT A DROPPED CONNECTION LOOKS LIKE ON AN UNCOVERED SURFACE**
🔴 **On the surface Lauren touches first, a confident false answer:** *"Didn't recognize this —
Scanned SCV-0031 — it didn't match a stock line. Check the tag."* Elsewhere: raw browser strings
(`Load failed`), one silently-stale cached page, two silent no-ops (pricing config, route anchor),
and one genuinely good honest failure (the delivery reschedule). **Nothing hangs; some things lie.**

**· THE Q11 ROUND-TRIP COUNT, AND WHETHER THE QUEUE ABSORBS R-5**
**14 price-affecting controls. 13 genuinely new round trips; 1 rides an existing call. Today the
count is ZERO** — `computeOrderPricing` runs synchronously in CartReview's render body (`:200`) over
a config fetched once on mount. A realistic four-item order goes from 4 requests to ~11.
🔴 **The queue does NOT absorb them:** checkout is not a consumer, the queue holds writes and a price
resolution is a read whose value never returns to a component, and FIFO is the wrong shape for a
latest-wins question. ⚠️ The *"estimated, confirming"* UI is still buildable — from the retail
`sell_price` the client already holds and which R-5 does not remove — but that is an optimistic-
display build, not the outbox.

**· THE Q12 FUNCTION-CEILING ANSWER**
✅ **No new function. `submit.ts:180-192` is already an action dispatcher citing §6 r11 by name**, and
already imports and runs `computeOrderPricing` / `resolveTier` / `resolveTaxRate` server-side at
`:605`. `action: 'price'` is a fifth branch. **R-5 is shippable at 12/12 with no plan upgrade.**

**· THE 3a VERDICT**
**ADJACENT, not the same — and opposed where it counts.** Shared: durable, idempotent deferral,
proven on this table and RPC, with an envelope that already carries what blind capture needs.
Opposed: the queue's drain has **no human in it**, so it reproduces #67's *residual is 0 by
construction* a few minutes later rather than fixing it. Scope them as one build anyway — blind mode
is a change to what `InventoryCount.tsx:438` queues, and #68/**R-C** hangs off the same line.
🔴 R-C's hazard would be **created** by that build: `inventory_count_sessions` has exactly one writer
today (three sites, all in `InventoryCount.tsx`), verified.

---

## OWNER-TEST CARDS — AS WRITTEN, PER SURFACE, UNMARKED

**Per OP-14: Thunder never sets `covered`. Every card below is `owed` or `needs-test`, and only
David's live airplane-mode run flips one.** These replace the single `needs-test` stub currently at
`docs/owner-tests/inventory-full-surface-test.md:448-457`.

> ⚠️ **On ledger #136's claim, which the prompt asked me to classify:** #136 said four of eight
> inventory surfaces ship no test *"incl. the order-picker READ and OFFLINE SYNC."*
> **It is a statement about TEST COVERAGE, and it is ACCURATE** — the board carries exactly one
> offline card, `STATUS: needs-test`, `LAST-PROVEN: never`, body reading *"NO TEST WRITTEN."*
> **It says nothing about whether the mechanism exists, and the mechanism does exist.** The two facts
> are independent and were being read as one; that conflation is what cost tonight's re-establishment.

```
## SURFACE: offline — store-and-forward
_The SyncEngine (`packages/shared/src/sync/`) — back-acre dead zones (ledger #54, #143).
PROVEN BY DAVID 2026-08-23 by airplane-mode test; UNRECORDED until now, which is why it was
re-questioned and cost a recon. These cards exist so it is never re-established from memory again._

### 1. A count taken offline survives and syncs on reconnect  (COVERED SURFACE)
STATUS: owed
DEVICE: phone
COVERS: #54 · #143 · recon 2026-08-23
LAST-PROVEN: never
- Start a count ONLINE (it refuses to start offline, by design — InventoryCount.tsx:222).
  Resolve ONE item and leave the review sheet OPEN. Airplane mode ON.
- EXPECT the banner: "Offline — counts are saved on this phone and will sync when you're back
  in signal." Save the qty.
- EXPECT "N waiting to sync" to APPEAR and the number to be RIGHT. Save two more.
- Airplane mode OFF. EXPECT the counter to fall to 0 WITHOUT pressing anything.
- Open /inventory. EXPECT every counted qty to be there.
- FAIL: the Save errors · the counter does not appear · the counter does not fall on reconnect ·
  a qty is missing or wrong.
- NO CONSOLE. Every check above is on-screen.

### 2. 🔴 SCANNING offline says the tag is not recognized  (THE RECON'S HEADLINE — EXPECTED TO FAIL)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · stockLineResolver.ts:223,236,266
LAST-PROVEN: never
- Airplane mode ON. On /checkout/scan, scan a tag you KNOW is in inventory.
- EXPECTED TODAY (the defect): "Didn't recognize this — Scanned <TAG> — it didn't match a stock
  line. Check the tag." THE TAG IS FINE. A dead zone is being reported as a missing item.
- Repeat on the count screen: EXPECT the scan to miss and drop to typed entry, then EXPECT
  "You're offline — <name> is a new size…" — an honest refusal for the WRONG reason.
- THIS CARD IS EXPECTED TO FAIL until the resolver gains a third 'unavailable' state.
  It is written so the failure is RECORDED rather than rediscovered.

### 3. Submitting an order offline  (UNCOVERED SURFACE)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · useSubmitOrder.ts:108 · CartReview.tsx:628
LAST-PROVEN: never
- Build a cart ONLINE. Airplane mode ON. Press "I'll pay at the office".
- EXPECTED TODAY: a red box reading "Load failed" (or "Failed to fetch") — the browser's own
  string. Nothing says offline; nothing offers a retry.
- Airplane mode OFF, press again: EXPECT it to go through, cart intact.
- FAIL (worse than expected): the order submits twice · nothing appears at all · the cart empties.

### 4. 🔴 The cart does NOT survive a reload  (UNCOVERED — EXPECTED TO FAIL)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · useCart.ts (zustand, no persist)
LAST-PROVEN: never
- Scan 3 items into a cart. Pull-to-refresh (or background the tab long enough for iOS to
  discard it) and return.
- EXPECTED TODAY: the cart is EMPTY. Lines, customer, tier, transport — all gone, no warning.
- Record how long backgrounding takes to lose it on the actual demo phone. That number is the
  real input to whether cart persistence is worth building.

### 5. 🔴 A day's counts in a PRIVATE tab  (THE STORE'S DURABILITY — ties to the logout-loop hunt)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · store.ts:55-58
LAST-PROVEN: never
- Open the app in a Safari PRIVATE tab. Start a count online, airplane mode, save 3 items.
- EXPECT "3 waiting to sync". If it says 0 or does not appear, the store write was SWALLOWED
  and the app is claiming a save it did not make — STOP and report.
- CLOSE the private tab. Reopen private, return to /inventory.
- EXPECT (the hazard): the three counts are GONE. Private-tab localStorage dies with the tab.
- Run this on the SAME device/browser as the logout-loop repro — same storage, likely same cause.

### 6. Photos captured offline  (COVERED SURFACE — the second consumer)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · AssetCapture.tsx:62 · assetBlobStore.ts
LAST-PROVEN: never
- Airplane mode ON. On /asset-capture, take 2 photos.
- EXPECT the "Offline" chip and a HELD count of 2. Reload the page STILL OFFLINE.
- EXPECT the held count to be 2 STILL — these live in IndexedDB, so unlike a cart they survive.
- Airplane mode OFF. EXPECT them to drain and appear as assets.
- FAIL: the held count is wrong · a photo is lost on reload · they never drain.

### 7. A stuck queue says nothing  (THE DRAIN'S OWN FAILURE — hard to stage, recorded anyway)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · syncEngine.ts:176,180 · forget() has 2 call sites
LAST-PROVEN: never
- If an op is ever REFUSED on drain (RLS, constraint, an RPC returning applied:false), the FIFO
  stops at it and everything behind it is stuck — permanently, with no UI to clear it.
- EXPECTED TODAY: "N waiting to sync" stays put; Sync now appears to do nothing; the only
  evidence is a console line, which this DEVICE: phone card cannot use.
- Staging this needs a deliberate refusal, so it is recorded as a KNOWN HOLE rather than a
  runnable check. Do NOT mark this covered by inference from card 1 passing.
```

---

## SCOPE COMPLIANCE (STEP 5)

| Constraint | Result |
|---|---|
| No service worker added | ✅ none added; none exists |
| Queue / store unchanged | ✅ zero edits under `packages/shared/src/sync/` |
| Error handling unchanged | ✅ zero edits; the top defect is reported UNFIXED |
| R-5 not started | ✅ no pricing code touched |
| #201/#202 conditional narrowing untouched | ✅ `stockLineColumnsFor` read only |
| Live defect outside scope → TOP, marked 🔴, unfixed | ✅ the resolver's swallowed error |
| One recon document | ✅ this file |
| Zero diff under `packages/`, `api/`, `supabase/` | ✅ `git diff --stat` empty at write-up |
