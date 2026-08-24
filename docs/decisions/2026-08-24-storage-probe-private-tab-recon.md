# RECON — THE STORAGE PROBE DID NOT WARN IN A PRIVATE TAB

**Date:** 2026-08-24 · **SHA under test:** `ebdb186` · **Type:** RECON — LOOK ONLY. Findings only, no options, no fix.
**No app code, no schema, no migration, no policy, no permission string, no cap.**

**Measured:** Safari **Private** tab, **ONLINE throughout**. The app loaded, **login worked and did not loop**, a count session opened, and a variety resolved with live on-hand data. **At no point did anything warn that storage was unavailable.** Owner-test **card 5**'s stated pass condition was a red warning before the walk; there was none.

**The question this recon answers is which of these is true — the probe is broken, or nothing ever needed to persist.**

## 🔴 THE ANSWER IS NEITHER. THE PROBE RAN, AND IT CORRECTLY ANSWERED *"THIS STORE IS USABLE."*

---

## B1 · WHERE THE PROBE LIVES, AND WHEN IT RUNS

**The probe itself:** `NamespacedStore.probe()` — `packages/shared/src/sync/store.ts:168-183`.

```
probe(): StoreWriteResult {
  const key = '__probe';                        // :169
  const token = `probe-${String(Date.now())}`;  // :170
  const wrote = this.save(key, token);          // :171   write
  if (!wrote.ok) return wrote;                  // :172
  const readBack = this.load<string | null>(key, null);  // :173   read back
  this.remove(key);                             // :174   clean up
  if (readBack !== token) { … reason:'unavailable' … }   // :175-181
  return { ok: true };                          // :182
}
```

**The chain up to the screen — three hops, no branches:**

| Hop | file:line |
|---|---|
| `OfflineQueue.probe()` → delegates straight to the store | `offlineQueue.ts:49-50` |
| `SyncEngine.storageStatus()` → delegates straight to the queue | `syncEngine.ts:85` |
| `InventoryCount` calls it | **`InventoryCount.tsx:214`** |

**WHEN it runs — `InventoryCount.tsx:208-218`:**

```
useEffect(() => {
  if (!engine) return;
  engine.start();                                   // :210
  setPending(engine.pendingCount());                // :211
  const st = engine.storageStatus();                // :214   ← the probe
  setStorageIssue(st.ok ? null : st);               // :215
  …
}, [engine]);                                       // :218
```

`engine` is a `useMemo` over `[businessId, userId]` (`:201-206`), non-null as soon as `businessId` resolves.

**So: the probe runs ON PAGE MOUNT — as soon as the count page has a `businessId`.**
**NOT on first write. NOT only when the queue is reached. NOT gated on `online`. NOT gated on having started a count.** It runs *before she walks*, which is its stated purpose (`store.ts:158-161`).

---

## B2 · WOULD IT HAVE RUN ON THE PATH DAVID WALKED? — **YES**

Path walked: Private tab → app loads → login → open a count → resolve a variety.

**Mounting `/inventory/count` is sufficient.** `businessId` was non-null (a variety resolved with live on-hand data — every resolver lane is `business_id`-scoped: `stockLineResolver.ts:243`, `:259`). Therefore the `engine` memo built, therefore the effect at `:208` ran, therefore **`:214` executed.** Opening a count session was not even required — but he did that too, which puts him past both render sites below.

### And it returned `ok: true`. Proven by the absence of the banner, which is sound because the banner has no other condition.

`storageIssue` renders **unconditionally on its own truthiness** at two places, and David passed through both:

| Where | Condition | Line |
|---|---|---|
| **IDLE card** — before *Start count* | `{storageIssue && <div style={S.error}>{storageWarning(storageIssue)}</div>}` — **no `online` guard, no `counting` guard** | `InventoryCount.tsx:815` |
| **Persistent banner** — once counting | `{counting && storageIssue && …}` — ranked ABOVE the offline note deliberately (`:785-787`) | `InventoryCount.tsx:788-792` |

**Neither drew. `storageIssue` was therefore `null`. `st.ok` was therefore `true`. The probe wrote a sentinel, read it back byte-identical, and removed it.**

### 🔴 WHY IT PASSED, AND WHAT THAT MEANS

**The probe tests *"can this store hold a value right now"*. It does not — and structurally cannot — test *"will this store still hold it after the tab closes."***

The write, the read-back and the cleanup all happen inside **one page session** (`store.ts:171-174`). A Safari Private tab provides a working `localStorage` for the **lifetime of that tab**. What a Private tab takes away is persistence **across tab close**. The probe never crosses that boundary, so it passes.

**The absence of a warning was CORRECT-AS-CODED. There is no defect in the probe.**

### ⚠️ AND THAT PUTS A COMMENT IN THE SOURCE IN TENSION WITH THE MEASUREMENT — NAMED, NOT FIXED

`store.ts:163-166` asserts, as the justification for reading back:

> *"🔴 IT WRITES *AND READS BACK*, DELIBERATELY. A Safari Private tab (and a browser with site data blocked) can ACCEPT `setItem` without throwing and still not persist — a write-only probe would pass and the store would still be a hole."*

**On David's device that did not happen: the Private tab accepted the write AND read it back, so the read-back passed.** The read-back is still worth having — it catches the genuinely-ephemeral case the comment describes, and a browser with site data hard-blocked is a real configuration. **But the comment states as fact about *a Safari Private tab* something this measurement did not reproduce**, and the same premise is what owner-test card 5's pass condition rests on.

🔴 **So what the measurement falsifies is CARD 5's EXPECTATION, not the code.** Recorded here; **no comment, copy or card expectation was rewritten** — this is a LOOK-ONLY recon and the correction is David's to direct.

⚠️ **This recon's own honesty limit, stated rather than glossed:** this machine cannot verify iOS Safari's Private-tab `localStorage` semantics. What is **measured** is: the probe ran, the banner did not draw, and the banner is unconditional on `storageIssue` — so *the probe returned ok* is a sound inference. *Therefore Safari Private provides a working same-session `localStorage`* is the most likely explanation and is **one step further than the measurement**, and is stated as an inference, not a fact.

---

## B3 · IF IT RETURNS "STORAGE UNAVAILABLE", WHAT SURFACES IT, AND WHERE?

| Screen | What renders | Style | Line |
|---|---|---|---|
| Count **IDLE** (before Start) | `storageWarning(storageIssue)` in the red error box on the start card | `S.error` | `InventoryCount.tsx:815` |
| Count **while counting** | `storageWarning(storageIssue)` in a persistent red banner with a `CloudOff` icon, **ranked above the offline note on purpose** | `S.storageWarn` (`:998`) | `InventoryCount.tsx:788-792` |
| Count, **offline note** | the offline text itself CHANGES: *"Offline — and this phone can't store anything, so counts CANNOT be saved right now."* instead of the normal *"counts are saved on this phone…"* | `S.offlineNote` | `InventoryCount.tsx:795-798` |
| A save that actually failed | `storageError(...)` — a different, past-tense sentence | — | `store.ts:90-94`, `syncEngine.ts:173`, `:184` |

**The copy** comes from `storageWarning()` — `store.ts:112-116` — with two diagnoses, `quota` vs `unavailable`:

> *"This phone isn't letting the app store anything — that usually means a Private browsing tab, or site data turned off. Counts will go straight to the server while you have signal, but NOTHING can be held on the phone: lose signal and that count is gone. Open the app in a normal tab before you walk the lot."*

**Which screens does it NOT reach?** Only the count screen consumes `storageStatus()` — `grep` finds `InventoryCount.tsx:214` as the sole caller. **Checkout (`ScanOrder.tsx`), the QR plant profile and the asset-capture path surface nothing about storage**, even though `AssetCapture` is the queue's other consumer (`assetCapture.ts:119`, `:170` return `res.error` on `failed`, but nothing probes ahead of the work). **Named as an observation, not filed as debt** — this recon was not scoped to sweep it.

---

## B4 · WHAT HAS NOT BEEN TESTED

🔴 **PRIVATE-TAB-WHILE-OFFLINE IS UNPROVEN. Nothing measured on 2026-08-24 bears on it.**

David was **online throughout**, so every write went straight to the server and **nothing ever had to survive in the store**. The one thing card 5 exists to prove — that a day's counts held on a phone survive — was never exercised. The session proved the *healthy* path in a Private tab, which is a different claim.

**The exact tap sequence that would prove it:**

1. Safari → **Private** tab → **`cultivar-os.vercel.app`** — *name the origin in the result*; the queue is per-origin (tech-debt **#96**) and `cultivar-os.app` is a different store.
2. **GATE 0 (OP-15) first:** `?debug=1`, confirm the SHA stamp in the DebugPanel footer matches the SHA under test. If it does not, stop — every observation after that point is fiction.
3. Sign in. Open `/inventory/count`.
4. **Record whether a red warning appears on the Start card.** (2026-08-24: it did not.)
5. **Start the count ONLINE** — it refuses to start offline by design (`InventoryCount.tsx:236-239`). Resolve one item, save a qty, confirm the tally increments.
6. **Airplane mode ON, and turn wifi OFF manually** — airplane mode alone does not always drop wifi on iOS.
7. Scan or type a second tag you know is in inventory. Save a qty.
8. 🔴 **Read the counter: does *"N waiting to sync"* appear and go UP?** (`InventoryCount.tsx:800-803`) — this is *can the store hold a value now*.
9. 🔴 **THE DECISIVE STEP, AND THE ONE THE PROBE CANNOT COVER: close the Private tab completely, open a NEW Private tab, sign in, return to `/inventory/count`.**
10. **Does the pending count survive?** — this is *does the store still hold it later*. Expect **NO**: a new Private tab is a new ephemeral store, and that is the loss card 5 was written to catch.
11. Airplane mode OFF. Note whether anything drains on its own — tech-debt **#95** says a manual page refresh is required regardless, so a stuck banner here is #95, not a new finding.

**Steps 8 and 10 are the two halves the probe collapses into one question.** Step 8 is what `probe()` measures and what passed today. **Step 10 is what a Private tab actually costs, and it has never been run.**

---

## WHAT THIS RECON DID NOT DO

- **Nothing was fixed.** No code, no schema, no migration, no policy, no permission string, no cap.
- **The probe was NOT changed**, and neither was `store.ts:163-166`'s comment or card 5's expectation — both are named as owed corrections for David to direct.
- **No options and no estimate** — this was scoped as findings only.
- **No owner-test card was marked `covered`** (OP-14).
