# OWNER TEST — OFFLINE: STORE-AND-FORWARD (the back-acre dead zones)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**.
> *(GATE 0 · OP-15.)*

**Capability:** ⚠️ **NONE — a fourth surface with no id on the capability board.** Nearest neighbours
are `2.3` (walk-and-count) and `5.1` (inventory), but the SyncEngine is a cross-cutting transport
under both and under checkout; tagging it either would make that capability read as storied when it
is not. Flagged, not minted.
**Story:** ⚠️ **`MAPS-TO: —`** — no story on `user_stories.md` covers offline transport. This is the
`IN CODE BUT NOT ON THE BOARD` case (§9 story-reconciliation gate); a story is owed.
**Source:** `packages/shared/src/sync/` · recon `docs/audits/offline-store-and-forward-recon-2026-08-23.md`
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**

> 🔴 **PROVENANCE — THESE SEVEN CARDS WERE WRITTEN 2026-08-23 AND LIVED INSIDE A FENCED CODE BLOCK
> IN AN AUDIT DOC UNTIL 2026-09-03.** They were never at `docs/owner-tests/`, so they were never
> rendered and never run — **cards nobody could reach.** Moved here VERBATIM (ledger #261); the
> audit doc keeps a pointer, and its original text is not deleted.
> ✏️ **The 2026-09-03 audit that found them reported TWO. There are SEVEN** — that sweep matched
> line-anchored markers inside a line range and stopped at the first hits. Corrected by counting
> `^### ` inside the extracted block. **A miscount found by re-measuring is the cheap kind.**

> ⚠️ **CARD 1 records a REAL PROOF THAT WAS NEVER WRITTEN DOWN.** The recon states David proved
> offline store-and-forward by airplane-mode test on 2026-08-23, and that it was **UNRECORDED —
> which is why it was re-questioned and cost a recon.** The card still reads `owed`: **Thunder may
> never set `covered`** (OP-14), and a proof recovered from prose is a claim until David re-runs it
> or confirms the date. **This is the whole reason the board exists.**

> ⚠️ **PROOF-CATEGORY TAGS ARE NOT YET ON THESE CARDS.** The 📄/🖱/🔧 declarations are part of the
> proposed reader-and-format build (§3–§5 of ledger #261's scope) and are **not** back-filled here,
> because a tag written under a standard David has not authorised would have to be rewritten. What
> IS true today and is stated on every card: all seven are `DEVICE: phone`, and cards 1–6 are
> explicitly provable **without a console** (card 7 says outright that it cannot be).

---

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
