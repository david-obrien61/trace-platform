# DataBridge → shared promotion recon (sometimes-connected capture)

**Date:** 2026-06-26 · **Author:** Thunder · **Type:** VERIFY-FIRST RECON, READ-ONLY — no build, no schema, no migration, no code.
**Question:** What in `DataBridge` can/should be promoted to `packages/shared/` to give Cultivar's walk-and-count loop (and future verticals) *sometimes-connected* capture — capture works offline unconditionally, the DB write reconciles on sync, both local storage AND immediate connectivity, whichever is true right now.

**Driving case (D-h, decided 2026-06-05, reaffirmed 06-15 & 06-22):** LAWNS is 20 acres with wifi dead zones at the back. A count Save in a dead zone fails today (ledger #54 / `ea2ea14`). The settled decision is to PROMOTE DataBridge's local-first/sync capability from `packages/ignition-os` to `packages/shared` (extract-and-promote, NOT delete — the CLAUDE.md "monolith, too coupled" note means reshape its location/coupling). The count loop is its intended first Cultivar consumer.

**Guard honored:** DataBridge is flagged in CLAUDE.md as a too-coupled monolith — that is NOT "delete it." The capability survives; only its location/coupling change. Off-Limits (Part 7) does not forbid READING DataBridge — it forbids touching `oauth.ts`, `supabase/auth.ts` (PIN), the old project, and run migrations. This recon only read.

**Headline:** The local-first *persistence* half is real, solid, and cleanly promotable as a small slice. The *sync-on-reconnect* half is **aspirational — it does not actually exist**: there is an offline queue with **no consumer, no drain, no reconnect listener**. So this is **NOT a clean extraction of a working sync engine** — it is *extract the real persistence slice + BUILD the reconcile loop that was never finished.* Honest read: **moderate build, not a lift-and-shift.**

---

## 1. WHAT DATABRIDGE IS TODAY

**Location:** `packages/ignition-os/DataBridge.js` (1123 lines) + `packages/ignition-os/hooks/useDataBridge.js` (45 lines). A live copy also exists at `~/Desktop/CAI-archive/DataBridge.js` (historical original, donor-reference only).

**Public surface (≈70 methods on one `DataBridge` object).** The vertical-agnostic core is a handful; the rest is Ignition business logic. Real signatures:

*Storage core (promotable):*
- `save: (key, data, skipPush = false) => boolean` — `DataBridge.js:363`
- `load: (key) => any` — `:417`
- `hydrate: async () => void` — `:450` (mobile startup: AsyncStorage → memoryStore)
- `getShopId / setShopId / getShopName / setShopName` — `:177–202` (identity keys, Ignition-named)

*Sync/queue core (aspirational — see §4):*
- `syncQueue: []` — `:174`
- `smartSync: async (action, data) => {success}` — `:337` (**stub** — live call commented out)
- `queueAction: (action, data) => void` — `:352` (enqueue only)
- `pullCloudSync: async () => data` — `:207` (Supabase `jobs` → FastAPI fallback → local cache)
- `pushCloudSync: async (jobs) => void` — `:238` (Supabase upsert → FastAPI fallback)
- `db: { jobs, shop, users, purchaseOrders, tools, pmi, aiUsage }` — `:266` (async Supabase CRUD, all `shop_id`-scoped, Ignition table names)

*Everything else (`:475`–`:1123`):* Ignition business logic — margin/prot_matrix, PIN `authenticate`/`getProfiles`/`autoEnrollDevice`, PMI assets/schedules/logs, fleet units, customers/vendors, trial clock, transaction history, system roles/rates. **Ignition-coupled, not promotable.**

**Storage mechanism:** in-memory `memoryStore = {}` is the source of truth (`:18`); **localStorage** on web, **AsyncStorage** (`@react-native-async-storage/async-storage`, dynamically required) on mobile (`:21–28`). **No IndexedDB.** Everything persists under ONE JSON blob keyed `IGNITION_OS_DATA` (`storageKey`, `:38`); every logical key is nested inside that blob (`save` reads the whole blob, sets one key, writes the whole blob back — `:387–389`). The offline queue persists separately under `IGNITION_SYNC_QUEUE` (`:356`).

**Reconnect detection: NONE.** Grep for `addEventListener('online'…)` / `ononline` / `flushQueue` / `processQueue` / `drainQueue` / `replayQueue` across all source (excl. `dist`/`node_modules`) returns **zero hits**. The only `navigator.onLine` read is inside `smartSync` (`:338`) — a one-shot check at call time, not a listener. The only `addEventListener` calls in the package are idle-timer resets and global error handlers (`main.jsx`, `IgnitionCore.js`), unrelated to sync.

**Offline queue: write-only.** `queueAction` pushes `{action, data, timestamp}` onto `syncQueue` and mirrors it to `IGNITION_SYNC_QUEUE` (`:352–358`). **Nothing ever reads `IGNITION_SYNC_QUEUE` back or replays `syncQueue`.** Confirmed by grep: `IGNITION_SYNC_QUEUE` appears exactly twice — both writes, `:356`. The queue accumulates and never flushes. `smartSync` is the only caller of `queueAction`, and `smartSync` itself has 1 live call site (`CoreApp.jsx:496`, a manager-override telemetry ping) whose online branch is a commented-out stub (`:341–343`).

---

## 2. GENUINELY SHARED-CAPABLE vs IGNITION-COUPLED

**PROMOTABLE (vertical-agnostic capability bus):**
- The **local-first store interface** — `save`/`load`/`hydrate` shape (memory + platform-storage, web/mobile split). Solid, real, the valuable part. (`:363–469`)
- The **offline-queue data structure + persistence** — `syncQueue` + `IGNITION_SYNC_QUEUE` write (`:352–358`). The *shape* is promotable; the *drain* must be built (§4).
- The **write-through-then-fallback pattern** in `pushCloudSync` (`:238–260`) — a reusable template, but currently `jobs`-specific.

**IGNITION-COUPLED (reshape or leave behind), with evidence:**
- `storageKey = 'IGNITION_OS_DATA'` (`:38`) — single hardcoded blob key. Must become per-vertical/namespaced.
- `getShopId`/`setShopId` read `IGNITION_SHOP_ID`; `setShopName` reads `IGNITION_SHOP_NAME` (`:179, :186, :201`) — Ignition identity keys.
- `db.*` (`:266–331`) — every method is `shop_id`-scoped against Ignition tables (`jobs`, `shops`, `users`, `purchase_orders`, `tools`, `pmi_schedules`, `ai_usage`). Not reusable as-is.
- `pullCloudSync`/`pushCloudSync` hardwired to the `jobs` table + a FastAPI `API_URL` (Railway-era, `:31–33`). Cultivar has no FastAPI; that fallback is dead weight here.
- `SCHEMA` (`:44–172`) — Ignition object shapes (active_job_context, prot_matrix, shop_policy, Hardware…). Ignition-specific.
- All business methods `:475`–`:1123`.

**KNOWN LEAK — Tech Debt #2, CONFIRMED:** `packages/shared/src/quickbooks/oauth.ts:18` → `const STORAGE_KEY = 'IGNITION_OS_DATA';`. A vertical noun is already hardcoded inside a *shared* module. **In-scope to note; OUT of scope to touch** — `oauth.ts` is explicitly Off-Limits (Part 7). Flag for the eventual fix, do not fold into the promotion.

---

## 3. HOW THE COUNT LOOP WOULD CONSUME IT

**Count-loop write sites — all direct `supabase.from(...)` calls in `packages/cultivar-os/src/pages/InventoryCount.tsx`:**
- `:77–79` — `inventory_count_sessions.insert(...)` (start session)
- `:176–180` — `business_inventory.update({ qty }).eq('id', lot).eq('business_id', businessId)` — **the on-hand SET on Save** (the dead-zone failure: on `upErr` it sets "Couldn't update on-hand" and aborts, `:181`)
- `:240–242` — `inventory_counts.insert({ session_id, business_id, ...row })` (durable count record)
- `:249–252` — `inventory_count_sessions.update({ item_count })` (counter bump)
- `:259–262` — `inventory_count_sessions.update({ status:'completed', ... })` (complete)

**The seam:** every write is a bare Supabase call inside an `async` handler that aborts the UI flow on error. To go through a sometimes-connected layer, those 5 call sites route through a shared wrapper that **captures locally, returns success immediately, and reconciles on sync** instead of `await`-ing the network and failing.

**Is it a thin wrapper or a data-model change?** Mostly **thin wrapper at the write site** — BUT with two real shape considerations:
- The two **append-only inserts** (`inventory_counts`, the session row) are ideal for a queue: replay = re-insert, naturally idempotent if keyed by a client-generated UUID. Low-friction.
- The **on-hand SET** (`business_inventory.update({ qty })`) is last-writer-wins on a shared column. Queued offline + replayed later can clobber a newer value written by another device/desktop in the interim. Honest call: for a physical count "the count IS the truth" so last-writer-wins is *probably* acceptable, but it is a real conflict surface — note it, don't pretend it's free. A client-side `counted_at` timestamp on the queued op lets the reconcile loop resolve sanely.

So: **on-hand needs a client timestamp on the queued op; the count records need a client UUID for idempotent replay.** Neither is a schema change to existing tables — both are fields the wrapper attaches to the queued envelope. The DB model can stay as-is.

---

## 4. THE SHAPE OF "BOTH" (online AND offline gracefully)

**The requirement is BOTH: write-through immediately when connected (so Lauren watches it sync, the desktop stays current) AND queue-when-offline (so the back-acre Save never fails).**

**What DataBridge actually does today:**
- `save()` is **local-first, NOT write-through.** It writes memory + platform storage *always*, then pushes to cloud **only for the single hardcoded key `active_jobs`** (`:402–404`). No generic write-through; no per-write cloud mirror for anything else.
- The **queue-and-sync path does not exist as a working loop.** `queueAction` enqueues; nothing drains. `pushCloudSync`'s failure branch logs `"job queued for retry"` (`:258`) but **inserts nothing into any queue** — the comment is aspirational; there is no retry.

**Verdict:** DataBridge supports **neither** path completely. It is local-first-persistence-only: data lands locally and (for one key) opportunistically pushes; there is no offline durability for the cloud write and no reconnect replay. The "BOTH" behavior the requirement needs has to be **built** on top of the (good) persistence primitive:
1. on write → persist locally (have) + if online, push now (have, but only for one key — generalize) + if offline OR push fails, enqueue with a client UUID/timestamp (queue shape exists; enqueue-on-failure does not);
2. on reconnect (an `online` event listener — **does not exist**) → drain the queue in order, replay each op, drop on success (**does not exist**).

---

## 5. IDENTITY/ACCESS INTERTWINE (flag only — separate spec)

DataBridge **does carry identity/role/session state, not just data.** Evidence: `current_user` schema with `pin`/`permissions` (`:59–64`) round-tripped via `save`/`load`; `getShopId`/`setShopId` (`:177–191`); `authenticate(pin)` (`:775`), `getProfiles` (`:822`), `autoEnrollDevice(memberId, shopId)` (`:733`), `hashPin` (`:720`), `logout` (`:839`). This is the I&A intertwine D-h flagged: an offline device holds identity/role locally and would sync it on reconnect. **PIN auth + `supabase/auth.ts` are Off-Limits and a separate spec — do not solve here.** Just recorded: the promotable persistence slice can and should be carved **without** dragging identity along; identity-sync is a later, separate decision.

---

## 6. THE RECOMMENDATION

**Clean extraction, moderate refactor, or near-rewrite?** Honest read: **moderate.** The persistence primitive (`save`/`load`/`hydrate`, memory+localStorage/AsyncStorage) is a clean ~120-line lift once de-Ignition-keyed. But the headline capability the requirement actually wants — *sometimes-connected reconcile* — **was never finished in DataBridge** (write-only queue, no drain, no reconnect listener, stub `smartSync`). So promoting "DataBridge's sync" is really *extract the good persistence slice + build the reconcile loop.* Not a near-rewrite (the store, queue shape, and write-through-fallback template are real references), but not a lift-and-shift either.

**Minimum promotable slice to give the count loop offline capture + sync-on-reconnect (without boiling the ocean):**
1. A small shared module — provisionally `packages/shared/src/sync/` — holding: a **namespaced local store** (`save`/`load`/`hydrate`, de-keyed from `IGNITION_OS_DATA` to a per-business namespace), a **typed offline-op queue** (envelope = `{op, table, payload, clientId(uuid), clientTs, businessId}`, persisted), a **write-through-or-enqueue** function (online → Supabase now; offline/failure → enqueue), and a **reconnect drain** (`online` event listener + manual flush) that replays the queue in order and clears on success.
2. Route the 5 `InventoryCount.tsx` write sites through it (count records by UUID = idempotent replay; on-hand SET carries `clientTs` for sane reconcile).
That ships the count loop's offline half alone — it does not require the full multi-vertical bus, identity-sync, or any Ignition table.

**What should explicitly WAIT:**
- The **full multi-vertical capability bus** (`db.*` per vertical, generic table CRUD) — build per-consumer, not up front (AC: settle once a second consumer is real).
- The **Identity & Access intertwine** (offline identity/role/session sync, PIN) — separate spec, Off-Limits surfaces.
- The **`IGNITION_OS_DATA` leak in `oauth.ts`** (Tech Debt #2) — fix when `oauth.ts` comes off Off-Limits; do not couple it to this work.
- The dead **FastAPI/Railway fallback** in `pull/pushCloudSync` — leave behind, Cultivar has no FastAPI.

**Risk / landmines:**
- **Moving DataBridge would break Ignition — so DON'T move it.** 44 Ignition source files import it (relative `./DataBridge` / `../DataBridge`). The right move is **extract a NEW shared module**, leave `packages/ignition-os/DataBridge.js` in place as donor-reference (consistent with CLAUDE.md "Ignition is donor-reference-only"). Zero Ignition breakage.
- **Outside ignition-os, nothing live depends on DataBridge.** Cultivar imports it **nowhere**. Four `shared/` files mention it: `permissions.ts`, `supabase/auth.ts`, `MarginEngine.ts` reference it **only in comments/docstrings** (MarginEngine `:84` literally says "no DataBridge"); `SavingsReport.jsx:14` has a real `import DataBridge from '../DataBridge'` whose target `packages/shared/src/DataBridge` **does not exist** — a **dangling import** (Tech Debt #10, "SavingsReport missing"). So the field is clear: a new `shared/src/sync/` module collides with nothing.
- **`useDataBridge.js` is a red herring** — despite a docstring claiming "offline/sync logic," it is a self-contained `useState` shell with a hardcoded Ignition module registry and a test job. No persistence, no sync. Not promotable; ignore it.
- **On-hand last-writer-wins** (§3) is the one genuine data-correctness risk in routing the count loop offline — surfaced, mitigated by a client timestamp, not hidden.

**Recommend nothing built until David confirms scope.** The minimum slice above is the cheapest-meets-need; the full bus + I&A is the fuller-meets-want. David picks the boundary.
