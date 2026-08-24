# RECON — THE VARIETY FIELD MATCHES ON EXACT NAME ONLY

**Date:** 2026-08-24 · **SHA under test:** `ebdb186` · **Type:** RECON — LOOK ONLY.
**No app code, no schema, no migration, no policy, no permission string, no cap. Nothing under `packages/`, `api/` or `supabase/` changes.**

**Measured today** — iPhone Safari, `cultivar-os.vercel.app`, **online**, on the count screen's manual entry field:

- typing **`Live Oak`** RESOLVES — size picker (`30 gal · 75`), *"On-hand now: 75"*
- typing **`VITEX`** does NOT resolve — falls to the *"Didn't recognize this"* sheet
- the reason: the two vitex varieties are named **Shoal Creek** and **Flip Side**. Nothing is literally named *"Vitex"*.

**David's words, quoted rather than paraphrased:**

> *"i typed live oak both words i only typed vitex thinking i would get a choice between the vitex's which are 2 varieties shoal creek and flip side, should the inventory be smart and get part of the list so you could match the variety?"*

**Story:** [[user_stories.md]] **`### Operator scan — one shape, two endings (count or sale)`** (`user_stories.md:329-337`, `STATUS: written`, `MAPS-TO: 2.3, 2.1`, `PIECES: operator_scan, scan_resolve_ladder, size_pick, qty_entry, tag_printing`) — it owns the resolve ladder, cites [[D-53]], and is the story this field belongs to. Secondary: **`### Count promotes size + qty into inventory`** (`:349-357`, `PIECES: … resolve_before_create`) owns A3, and **`### Count the lot without paper`** (`:339-347`) states the loop-must-never-dead-end requirement. **No story was invented.**

---

## 🔴 THE HEADLINE, ABOVE THE ANALYSIS: THE CAPABILITY DAVID IS ASKING FOR IS ALREADY BUILT, ALREADY TESTED, AND WIRED TO A DIFFERENT SCREEN

`searchStockLines` (`packages/shared/src/inventory/stockLineResolver.ts:278-311`) does exactly what the question asks — substring **and token-subset** matching, returning a LIST. **Its own docblock names this case, in these words** (`:270-271`):

> *"this powers the manual "Look up" field where a human types **"vitex"** / "shoal" / "SCV" and expects the matching lot(s) back, not a dead-end "not recognized"."*

It has **exactly one caller: `ScanOrder.tsx:329` — CHECKOUT.** The count screen never calls it.

**And the omission is DECLARED, not accidental.** `QrScanner.tsx:24-27`, on the `onLookup` prop:

> *"Optional: when provided, the manual "Look up" field routes here instead of onScan, so a human can SEARCH by a partial id / name token (searchStockLines) rather than needing an exact tag. **Callers that want the count-style exact match (e.g. InventoryCount) omit this.**"*

`git log -S onLookup` returns **one commit — `a1ad0d1` *"feat(cultivar): checkout fix-pass — search lookup, centered modal, conditional required, delivery date (#99)"***. The search field was built **for checkout**, in a checkout fix-pass, and the count screen was never revisited. **So this is not a missing capability. It is a capability with one consumer and a second surface that was declared out of scope in a comment.**

---

## A1 · WHAT THE LOOKUP ACTUALLY DOES

### ⚠️ FIRST — THE DESCRIPTION DID NOT SURVIVE CONTACT WITH THE SOURCE

The field was described (from screenshots, not from code) as taking **"variety names, not tag codes."** **That is wrong, and it is wrong in both directions.**

**It is DECLARED as a TAG field.** One component renders it in two modes (`QrScanner.tsx:129-139`), switched on whether `onLookup` was passed:

| | count screen (no `onLookup`) | checkout (`onLookup` passed) |
|---|---|---|
| placeholder (`:134`) | **`Or type the tag (e.g. SCV-0031)`** | `Search by name or tag (e.g. vitex)` |
| button (`:138`) | **`Look up`** | `Search` |
| `autoCapitalize` (`:135`) | **`characters`** | `none` |
| routes to (`:112-113`) | `onScan(v)` → exact ladder | `onLookup(v)` → `searchStockLines` |

🔴 **`autoCapitalize="characters"` (`:135`) is why the typed input arrived as `VITEX` in capitals. The uppercase in the report is the code's own fingerprint — the field was auto-capitalising because it expects a tag code.**

**But it also matches names** — so *"variety names, not tag codes"* is backwards on the label and incomplete on the behaviour. It accepts **both**, with tag codes as the primary lanes.

### The path, in order

`QrScanner.submitManual` (`:105-114`) → `InventoryCount.tsx:828` `onScan` → `handleScan` (`InventoryCount.tsx:267`):

| Lane | Where | Query / predicate | Case |
|---|---|---|---|
| strip | `scanTag.ts:4-15` | `extractTag` — pulls the tag out of a `/plant/<tag>` URL, else last path segment, else the raw string | — |
| **L1** | `InventoryCount.tsx:273-278` | `cultivar_plants` **`.ilike('tag_id', tag)`** `.maybeSingle()` — **exact, no wildcards** | insensitive |
| **L2** | `stockLineResolver.ts:240-245` | `business_inventory` **`.ilike('sku', id)`** `.maybeSingle()` — **exact, no wildcards** | insensitive |
| **L4** | `stockLineResolver.ts:256-259` → `:195` | fetch the tenant's rows, then **`tokenSetsEqual(nameTokenSet(row.name), scannedKey)`** | insensitive |
| **L5** | `stockLineResolver.ts:200` | `detectSizeCollision` → size-picker, else `miss:'ambiguous'` | — |

**It searches THREE things: a specimen tag (`cultivar_plants.tag_id`), a lot SKU (`business_inventory.sku`), and the variety NAME (`business_inventory.name`).** It is **case-insensitive at every lane** — `.ilike` at L1/L2, `.toLowerCase()` inside `nameTokenSet` (`canonicalName.ts:57`).

### 🔴 THE MATCH PREDICATE IS SET **EQUALITY**, AND THAT ONE LINE IS THE WHOLE FINDING

`canonicalName.ts:81-85`:

```ts
export function tokenSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}
```

**`a.size !== b.size` is the line.** It makes a strict SUBSET a non-match, by construction:

| typed | `nameTokenSet` | catalog row | row's tokens | equal? |
|---|---|---|---|---|
| `Live Oak` | `{live, oak}` | *Live Oak* | `{live, oak}` | ✅ **sizes 2 == 2** → resolves |
| `VITEX` | `{vitex}` | *Shoal Creek Vitex* | `{shoal, creek, vitex}` | ❌ **1 ≠ 3** → no match |
| `VITEX` | `{vitex}` | *Flip Side Vitex* | `{flip, side, vitex}` | ❌ **1 ≠ 3** → no match |

→ `{kind:'miss', reason:'no_match'}` (`stockLineResolver.ts:216`) → `setPhase('unknown')` (`InventoryCount.tsx:373`).

**The measurement is the code behaving exactly as written.** `Live Oak` worked because the full name happens to be two words and David typed both — *"i typed live oak both words"*. **He identified the mechanism himself.** There is no defect here to fix; there is a capability that is absent on this surface and present on another.

---

## A2 · DOES A MATCH-LIST CAPABILITY ALREADY EXIST IN THE TREE?

**YES — in `packages/shared/`, exactly where CORE MANDATE rule 1 says to look first.**

### `searchStockLines` — `packages/shared/src/inventory/stockLineResolver.ts:278-311`

Exported at `packages/shared/src/inventory/index.ts:3`. Returns `ReadResult<StockLineRow[]>` (R-11's union — a failed search cannot be mistaken for *"0 matches"*, `:293-295`).

**Match rule (`:298-306`) — any one hits:**
- the trimmed term is a **case-insensitive substring of `name`** (`:301`)
- or a **case-insensitive substring of `sku`** (`:301`)
- or **every token of the term appears in the row's name token set** — a **SUBSET**, not equality (`:302-305`)

Sorted by name, numeric-aware (`:308-310`); `limit` defaults to **25** (`:285`); an empty term returns `[]` as an answered result, not a failure (`:287`).

**`vitex` hits Shoal Creek Vitex and Flip Side Vitex on the substring rule alone.**

**It is under test:** `stockLineRead.test.ts:76` (dead-zone → `ok:false`, not "0 matches"), `:97` (blank term), **`:101` — a literal `'vitex'` search probe**.

### The consumer that has it — `ScanOrder.handleLookup` (`ScanOrder.tsx:327-367`)

| result | behaviour | line |
|---|---|---|
| read failed | `phase='unreachable'`, names the server | `:333-339` |
| 0 matches | `phase='unknown'` | `:343-346` |
| **1 match** | resolve straight through to review | `:348-353` |
| **>1 matches** | **`openPicker("<term>" — pick an item, "N matches. Pick the one you're looking at.", choices)`** — each row titled `name · size`, sub-line `sku · committed · $price` | `:355-366` |

**`openPicker(title, hint, choices)` (`ScanOrder.tsx:369-374`) is generic** — it is the same control the size-collision path uses (`:315`). It is not coupled to checkout semantics.

### What does NOT exist

- **No typeahead / autocomplete anywhere.** No debounce, no on-type query, no suggestion list. Every match in the tree fires on **submit** or on **save**. The count sheet's Variety input (`InventoryCount.tsx:939-941`) has an `onChange` that sets state and clears a field error — **nothing else**.
- **No fuzzy / edit-distance matcher.** No Levenshtein, no trigram, no `pg_trgm`. The only "smart" layers are token-set normalisation (`canonicalName.ts:54-71`) and size-vocabulary folding (`normalizeSize`, used at `stockLineResolver.ts:159`).
- **No prefix matcher.** `.ilike` is called without `%` at both `:244` and `InventoryCount.tsx:277`, so both are exact-case-insensitive, not prefix.
- **No name picker on the count screen.** The count screen's picker is a **size-chip** control (`InventoryCount.tsx:388-391`), which picks a size *within an already-resolved variety*. It cannot present a choice **between varieties**.

---

## A3 · WHAT GUARDS THE CREATE-NEW PATH?

`saveUnknown(withEntry)` — `InventoryCount.tsx:630-709`.

### The guards that exist

| # | Guard | Line |
|---|---|---|
| 1 | Variety name required | `:645` |
| 2 | Count must parse and be ≥ 0 | `:646-647` |
| 3 | **Size required** — deliberately widened here, with its reasoning at `:650-658` | `:659` |
| 4 | 🔴 **RESOLVE-BEFORE-CREATE — `resolveStockLine(supabase, businessId, name)` on the TYPED NAME** | `:668` |
| 5 | A **failed** resolve REFUSES rather than falling through to create (added 2026-08-23, ledger #206) | `:679-685` |
| 6 | An **ambiguous** resolve records-only and flags, rather than guessing | `:688-697` |
| 7 | A resolved / collision result joins the **existing** family | `:699` |
| 8 | Otherwise → **mints a new group**, `groupKey: slugify(name)` | `:701` |

Normalisation in play: token-set folding (`canonicalName.ts:54-71` — case, apostrophes, punctuation, word order, 1-char tokens, botanical connectors) and `normalizeSize` inside `detectSizeCollision` (`stockLineResolver.ts:159`).

**So the create path IS guarded, and the guard is real.** It is the same ladder, run a second time on the typed name.

### 🔴 DOES THE CODE KEEP THE DIALOG'S PROMISE?

The dialog says (`InventoryCount.tsx:951`):

> *"We'll match this to an existing variety if we can, so different spellings don't split into separate items."*

**PARTLY — and the code's own comment already names the gap, three lines above the call it describes** (`:665-667`):

> *"(Boundary, honest: EQUALITY handles case/word-order/punctuation/separator variance; **extra words + plural stemming — "Big Boy" vs "Big Boy Tomato" vs "tomatoes" — are the deferred L5-subset/L6-stemming layers and still mint a distinct variety**.)"*

**Two facts about the promise, stated separately because they are different problems:**

**① WHEN IT FIRES: on SAVE (`:668`), never on entry.** There is no on-type matching. A person typing `Vitex` gets no signal at all until they press *Save → Next*.

**② WHAT IT COVERS: spellings of the SAME token set — not a SHORTER name.** `Vitex` vs `Shoal Creek Vitex` is not a different *spelling*, it is a **subset**, and subset is exactly the case the boundary comment says is deferred. So:

🔴 **Typing `Vitex` + a size into this sheet and pressing Save MINTS A THIRD VARIETY — a `business_inventory` row named "Vitex", `groupKey: 'vitex'` (`:701`) — standing beside Shoal Creek Vitex and Flip Side Vitex, with the on-hand split across it.** That is the D-49 / #135 duplicate-variety family arriving through a **short name** instead of a spelling.

⚠️ **The sentence is not false — it is load-bearing on the word *"spellings"*, and a reader will not notice that word is doing the work.** The promise reads as *"we'll figure out what you meant"*; the code delivers *"we'll fold punctuation and word order"*. **This is the copy-only option in A5, and it is a real option precisely because the sentence over-reaches on its own.**

---

## A4 · BLAST RADIUS — WHICH SURFACES SHARE THIS LOOKUP

**Not count-only. Six call sites across four surfaces plus the importer.**

| Surface | file:line | Function | Mode |
|---|---|---|---|
| **Count** — scan / typed tag | `InventoryCount.tsx:304` | `resolveStockLine` | **exact** |
| **Count** — resolve-before-create on the typed name | `InventoryCount.tsx:668` | `resolveStockLine` | **exact** |
| **Checkout** — camera scan | `ScanOrder.tsx:283` | `resolveStockLine` | **exact** |
| **Checkout** — manual *Search* field | `ScanOrder.tsx:329` | **`searchStockLines`** | 🟢 **partial** |
| **QR plant profile** (customer-facing) | `usePlant.ts:180` | `resolveStockLine` | **exact** |
| **CSV importer** | `importPlan.ts:197` (imports at `:31`) | `detectSizeCollision` + the `nameTokenSet` / `tokenSetsEqual` primitives, per row, in-memory | **exact** |

**Four surfaces run the exact ladder. Exactly one has the partial matcher, and it is the one David was not on.**

### 🔴 A STORY-GATE FINDING, SURFACED NOT ACTED ON

`user_stories.md:337` asserts, in the story that owns this ladder:

> *"Lauren stands in the lot with her phone… She scans a tag, picks a size, sets a quantity. **That is the whole shape, and it is the SAME shape whether the walk ends in a count or a sale** — because it IS the order path."* … *"**STATUS: BUILT. This is the flow that works, and the one the demo shows.**"*

**Since `a1ad0d1` the two endings do NOT share the same shape on this control.** The sale ending got a partial-match Search field with a picker; the count ending kept the exact *Look up*. The story is `STATUS: written` and declares the flow BUILT, so this is a **written story that has quietly drifted from the code** — the §9 story-reconciliation gate's *IN CODE BUT NOT ON THE BOARD* case, pointed the other way. **Flagged for David; no story was edited and no build is proposed here.**

---

## A5 · OPTIONS — NEED → WANT

**Not collapsed to a recommendation.** Five, spanning the range. **Every one is client-side: ZERO migrations, ZERO new `api/` functions — the 12/12 Vercel ceiling (§6 r11) is untouched by all five.** Prompt counts are estimates over files I have opened and cited.

### Option 0 — COPY ONLY. Change the promise to match the code. Build nothing.
- **What:** rewrite `InventoryCount.tsx:951` so it stops implying subset matching — e.g. *"Type the variety's full name — we'll match it even if the spelling or word order differs."* Optionally change the field placeholder at `QrScanner.tsx:134` so *"Or type the tag"* stops being the only hint on a field that also takes full names.
- **Prompts:** <1. **Migrations:** 0. **Functions:** 0 (12/12 untouched).
- **Does NOT solve:** David still cannot find Vitex by typing `vitex`. A typed short name **still mints a duplicate variety** (A3 ②). This makes the platform honest, not capable.

### Option 1 — NEED, CHEAPEST. Pass `onLookup` on the count screen; reuse what checkout has.
- **What:** `InventoryCount.tsx:828` gains `onLookup={term => void handleLookup(term)}`; a count-side `handleLookup` calls the existing `searchStockLines` and renders a **choice of varieties**. The field flips to *"Search by name or tag (e.g. vitex)"* / *"Search"* / `autoCapitalize="none"` **for free** — `QrScanner.tsx:134-138` already switches on the prop.
- 🔴 **The real cost, and it is the reason this is not a one-liner: the count screen has NO name picker.** Its picker is size-chips within one resolved variety (`InventoryCount.tsx:388-391`). `ScanOrder`'s `openPicker` (`:369-374`) is generic in shape but lives in `ScanOrder.tsx` — so this is either a lift into `packages/shared/` (§6 r8, the right form) or a second copy (the drift §6 r8 exists to stop).
- **Prompts:** ~1–2. **Migrations:** 0. **Functions:** 0.
- **Does NOT solve:** the *"Didn't recognize this"* sheet's own Variety field still has no matching, so the duplicate-minting path in A3 ② is untouched. Still submit-triggered, not live.

### Option 2 — Option 1 + close the duplicate-minting hole.
- **What:** Option 1, plus in `saveUnknown` (`InventoryCount.tsx:668`) run `searchStockLines` on the typed name when the exact resolve misses, and if it returns candidates, **SURFACE them — *"Did you mean Shoal Creek Vitex / Flip Side Vitex?"* — instead of minting.** Surface-don't-presume, the same discipline `:688-697` already applies to the ambiguous case.
- **Prompts:** ~2–3. **Migrations:** 0. **Functions:** 0.
- **Does NOT solve:** still no live typeahead — the person types the whole name and finds out at Save. Adds a step to the genuinely-new-variety path, which is a real cost on a walk.

### Option 3 — WANT. Live typeahead on both fields.
- **What:** a debounced `searchStockLines` under the manual entry field **and** under the unknown sheet's Variety input (`:939-941`), rendering matching lots with size and on-hand, tap-to-select. The duplicate hole closes as a side effect: the candidates are on screen before Save is reachable.
- **Prompts:** ~3–4. **Migrations:** 0. **Functions:** 0.
- **Costs, stated:** a new shared component; a real design question about a result list on a phone held one-handed mid-walk (capture=mobile, per memory); **and it changes a surface that is on the demo path days before LAWNS.** `searchStockLines` fetches the tenant's whole catalog per call (`:289-292`) — on-type debouncing makes that repeat, which is fine at LAWNS's volume and is worth naming before it is assumed.
- **Does NOT solve:** nothing outstanding on this question — this is the fullest form.

### Option 4 — ADJACENT, AND FLAGGED RATHER THAN RECOMMENDED. Deepen the ladder itself.
- **What:** make **L4** fall back to token-**SUBSET** when equality misses and exactly one row matches — the deferred *"L5-subset"* layer the code names at `stockLineResolver.ts:666`.
- **Prompts:** ~1. **Migrations:** 0. **Functions:** 0.
- 🔴 **Smallest diff, WIDEST blast radius — this is why it is flagged, not recommended.** `resolveAgainstCatalog` is shared by **all six call sites in A4**, including the **customer-facing QR plant profile** (`usePlant.ts:180`) and the **CSV importer** (`importPlan.ts:197`). A subset fallback changes what a scanned tag resolves to on a page a customer may be holding, and what an import row matches against. **It also does not help the reported case**: `vitex` subset-matches **two** rows, so "exactly one match" fails and it still misses — to help here it would have to return a LIST, which is Option 1.

---

## WHAT THIS RECON DID NOT DO

- **Nothing was fixed.** No code, no schema, no migration, no policy, no permission string, no cap.
- **The dialog copy was NOT changed** — Option 0 is an option, not an action taken.
- **No option is recommended.** The five span NEED → WANT and the call is David's.
- **No story was created or edited.** The A4 story drift is flagged for David.
- **Nothing was estimated that was not opened.** Every claim above carries a `file:line`.
