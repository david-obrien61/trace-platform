# RECON — WHAT IS IN CULTIVAR THAT BELONGS IN SHARED
# Filed 2026-09-14 · ledger #327 · branch `recon/cultivar-to-shared-boundary`
# REPORT ONLY. Nothing was built, nothing was moved, no migration was written.

> **THE RULE (David, 2026-09-14):** everything that CAN go in `packages/shared` SHOULD, and only the
> things specific to growers belong in `packages/cultivar-os`.
>
> **THE TEST, one question per candidate:** would a business that does not grow trees need this?
> **Yes → shared**, with the vertical supplying vocabulary and values. **No → cultivar.**
>
> **SCOPED BY CONSEQUENCE, NOT COMPLETENESS.** This is not an inventory of 170 files. It is the set
> where leaving them where they are means **the second vertical re-implements them**, or **we
> refactor under live code**. Ranked by that, hardest first.

**Provenance marks, as `docs/discovery/2026-08-27-29-lawns-discovery.md` uses them:**
`[MEASURED]` was run and the output read · `[STATED]` is quoted from a file that asserts it ·
`[INFERRED]` has not been checked and **must not be promoted to fact**.

---

## THE TWO NUMBERS THAT SETTLE THE SHAPE OF THIS REPORT

**[MEASURED]** `packages/cultivar-os/src/registry/tileRegistry.ts` — the platform's own declaration
of every surface it has — carries **33 tiles. 32 are `vertical: 'general'`. One is `'cultivar'`,
and that one is `seasonal_module`, `status: 'planned'` — it is not built.**

> **Every BUILT tile in the platform is `general`. The single vertical-scoped tile is unbuilt.**

**[MEASURED]** `packages/cultivar-os/src/router.tsx` imports **48 page components from its own
`./pages`** and **2 from `@trace/shared`**.

The platform has already decided, in writing, in its own registry, that ~97% of what it does is not
grower-specific. The code is arranged the other way round. **That gap is this report.**

⚠️ **This is a statement about SURFACES, not about the whole codebase.** The pure business logic has
largely gone the right way already — see [§9 WHAT IS ALREADY IN SHARED](#9-what-is-already-in-shared-and-whether-the-boundary-held).
The finding is specific: **logic moved to shared; screens did not.**

---

## URGENCY — READ THIS BEFORE THE FINDINGS

**[MEASURED] There is no live second vertical today.**

| package | files | what it is |
|---|---|---|
| `packages/coolrunnings` | **0** | empty directory |
| `packages/assessment-app` | **0** | empty directory |
| `packages/trace-app` | 11 | marketing shell, does not depend on `shared` |
| `packages/ignition-os` | 79 `.jsx` | **frozen donor-reference code** (CLAUDE.md §2) |
| `packages/cultivar-os` | 170 | the only live vertical |

**So nothing is broken right now, and nothing here blocks LAWNS.** The cost is entirely future and
entirely conditional on a second vertical existing. That is why this was filed as a background job
and why **the recommendation at the bottom is "do almost none of it now."**

🔴 **ONE EXCEPTION, AND IT IS THE REASON FINDING 1 IS RANKED FIRST: one finding is SCHEMA, carries
LIVE ROWS, and gets more expensive every day LAWNS runs on it.** Everything else in this report is
code, and code can be moved at any time for roughly the same price. A CHECK constraint on a table
with live rows cannot.

---

## THE RANKING, AND WHAT IT IS RANKED BY

| # | Finding | Why it ranks here | Cost of moving LATER vs NOW |
|---|---|---|---|
| **1** | `service_offerings.price_unit` admits `'plant'` **in the schema** | **Schema + live rows + load-bearing in cart math** | 🔴 **Rises with every row** |
| **2** | `tileRegistry.ts` — the platform registry — lives in the vertical | 4 platform caps hardcode its vertical path | 🟡 Flat, but it is the **entry point** for a second vertical |
| **3** | The receipts cluster, **4,245 LOC**, self-declared shared | Second vertical re-implements all of it | 🟡 Flat |
| **4** | The delivery/fulfilment cluster, **3,452 LOC** + coordinates discarded | Second vertical re-implements; a capability is being thrown away daily | 🟡 Flat, but the **data loss is now** |
| **5** | Two import field-check engines, **both already in shared** | §6 r8 — one operation, two implementations | 🟢 Flat |
| **6** | `production/` — shared already, grower units in the TYPE | Tables are **not applied**; nothing runs | 🟢 Flat |
| **7** | Grower vocabulary that has already leaked INTO shared | Small, contained, mostly known | 🟢 Flat |

---

# FINDING 1 🔴 — A GROWER'S NOUN IS A CHECK CONSTRAINT ON A PLATFORM TABLE

## THIS IS THE PROMPT'S OWN EXAMPLE, FOUND LIVE

David's framing: *"A ring table with a price column assumes every vertical prices by zone. A food
bank does not… Where a shared table bakes in a vertical's assumption, say so; that is the finding,
not the file location."*

### 1. Where it lives now

**[MEASURED]** `supabase/migrations/20260529_businesses_f_service_offerings.sql:29-30`

```sql
  price_unit             text        NOT NULL DEFAULT 'plant'
    CHECK (price_unit IN ('order', 'plant', 'vehicle', 'visit')),
```

Mirrored in shared TypeScript at
**`packages/shared/src/business-logic/serviceOfferingEnums.ts:54,57`**:

```ts
/** price_unit ∈ order | plant | vehicle | visit — WHAT one unit is (distinct from price_type). */
  { value: 'plant',   label: 'per plant' },
```

…and again in an **AI prompt string** at `packages/shared/src/discovery/engine.ts:124`, and again in
`packages/shared/src/discovery/types.ts:10`.

**[MEASURED] A whole-corpus sweep of every migration for a vertical noun inside a CHECK constraint or
a DEFAULT returns exactly two hits, and this is one of them.** The other is
`businesses.business_type text NOT NULL DEFAULT 'nursery'`
(`20260529_businesses_a_create_tables.sql:14`), which is a different and much milder thing — see
[§1.5](#15-the-second-hit-businessesbusiness_type-default-nursery). **There are zero table names and
one column name (`plant_tag_id`) carrying a vertical noun anywhere in the migration corpus.**

> So the schema is, with **one exception**, AC-1 clean. This is the exception.

### 2. What is genuinely grower-specific inside it

**`'plant'` — and only `'plant'`.** The other three values are already universal:

| value | universal? |
|---|---|
| `order` | ✅ every business has an order |
| `vehicle` | ✅ |
| `visit` | ✅ |
| **`plant`** | 🔴 **grower vocabulary, frozen into a platform constraint** |

The **concept** is universal and correct: *"what is the one thing this price multiplies by?"* A food
bank distributing school supplies prices per **household** or per **box**. A coffee roaster per
**bag**. An HVAC contractor per **unit**. Every one of them needs this column. **None of them can
write to it.**

### 3. 🔴 IT IS NOT COSMETIC — IT IS AN `if` IN THE CART MATH

This is what raises it above a naming complaint. **[MEASURED]** the value is a runtime branch:

- `packages/cultivar-os/src/lib/netting.ts:37` — `nettedQuantity(o, plantCount)`, the attach-rule
  arithmetic: `per_unit`/`plant` scales ×N, `flat`/`order` collapses to ×1.
- `packages/cultivar-os/src/lib/transport.ts:41,43` — the delivery-vs-planting role split is
  *defined* as `price_unit 'order'` vs `price_unit 'plant'`.
- `packages/cultivar-os/src/pages/AddOns.tsx:202,261` —
  `price_unit === 'plant' ? 'plant' : 'unit'`, on screen.

**[STATED]** `netting.ts:4-6` says it outright: *"service_offerings.price_type × price_unit already
encode the attach rule."*

> **The attach-rule engine is universal — "5 boxes = 1 delivery fee + 5 handling fees" is the same
> arithmetic — and it reads a grower's noun to decide.**

### 4. What moving it would cost, and what breaks

**The repair is small. The blast radius is what makes it urgent.**

| | |
|---|---|
| **The migration** | Drop the CHECK, or widen it. ~10 lines. |
| **Live rows** | 🔴 **[INFERRED — NOT MEASURED. I did not query the live database.]** LAWNS has service offerings live (CLAUDE.md §4 names four rows). Any row carrying `price_unit='plant'` stays valid under a widened CHECK — **widening never rejects existing rows**, which is why this is cheap *today*. |
| **The DEFAULT** | `DEFAULT 'plant'` must go or become `'order'`. A new tenant currently defaults to a grower's unit. |
| **What breaks** | Nothing, if widened. The three TS mirrors must stop being a closed union — `serviceOfferingEnums.ts:54`, `discovery/types.ts:10`, `engine.ts:124`. |
| **What does NOT break** | `netting.ts` / `transport.ts` still work — they branch on the *value*, and the value still exists. |

🔴 **AND THE HONEST HARD PART, WHICH IS NOT THE MIGRATION:** widening the constraint does not tell
`netting.ts` what to multiply by. Today `per_unit` means *"× the plant count"* and
`totalPlantCount()` (`netting.ts:23`) is the denominator. **For a second vertical the engine needs
"× the line-item count", with `plant` as one label for that count.** That is a rename plus a concept
correction, ~50 lines, and it is the part worth doing deliberately rather than in a hurry.

### 5. 🔴 AC-1 AFTER THE MOVE — AND THE SHARPEST VERSION OF THE FINDING

**AC-1 holds after widening. But the more interesting thing is what the code already got RIGHT.**

**[MEASURED]** `packages/shared/src/discovery/verticals/nursery.ts` — a **per-vertical seed file**
where the grower's units are **values in data rows**:

```ts
{ name: 'Delivery and installation', category: 'transport', price_type: 'per_unit', price_unit: 'plant' },
{ name: 'Travel netting',            category: 'addon',     price_type: 'per_unit', price_unit: 'plant' },
{ name: 'Warranty inspection',       category: 'inspection',price_type: 'flat',     price_unit: 'visit' },
```

**That is exactly AC-1 done correctly — a directory named `verticals/`, one file per vertical,
identity as a VALUE.** The mechanism to vary is built and it is in the right place.

> 🔴 **So the architecture is right and the database refuses it.** A `verticals/foodbank.ts` could be
> written tomorrow, and the moment it wrote `price_unit: 'household'` **Postgres would reject the
> insert.** The extension point exists, is correctly shaped, sits in shared — and is closed by a
> constraint written four months earlier.

⚠️ **AND THE PATTERN IS UNPROVEN, WHICH IS ITS OWN FINDING. [MEASURED] `discovery/verticals/` contains
ONE file.** A per-vertical mechanism with a population of one has never been shown to work — this is
**tech-debt #182's class applied to an architecture** rather than to a check: *a thing that has never
reached its target reports the same as one that passed.* Whatever the second vertical costs, part of
that cost is discovering what this directory cannot express. **Do not read "the mechanism exists" as
"the mechanism works."**

### 1.5 The second hit: `businesses.business_type DEFAULT 'nursery'`

**[MEASURED]** `20260529_businesses_a_create_tables.sql:14`. Milder and arguably correct: AC-1 says
*vertical identity is a VALUE*, and `business_type` is precisely the column whose job is to hold that
value. **The defect is only the DEFAULT** — a business created without specifying one silently
becomes a nursery. No CHECK constraint, so a second vertical is not blocked. **Flagged, not urgent.**

---

# FINDING 2 🔴 — THE PLATFORM'S TILE REGISTRY LIVES INSIDE THE VERTICAL

### 1. Where it lives now

**[MEASURED]** `packages/cultivar-os/src/registry/tileRegistry.ts` — **925 lines.**

**[STATED]** its own header, lines 1-5:

> *"tileRegistry.ts — **THE SINGLE TILE REGISTRY** (MB_D-012). PURPOSE: One declared source for every
> tile/surface in **TRACE**. Dashboard, Settings, Admin, the (future) role-config UI, and the
> (future) marketplace ALL read this — no surface keeps its own hardcoded tile list."*

**[STATED]** lines 28-30:

> *"── **One registry, many verticals** (2026-06-23) ── `vertical` (scope) lets **ONE shared registry
> serve a generalist, a nursery, and an auto shop from the SAME code** — a business's live dashboard
> = its vertical's tiles + all `general` tiles, by …"*

**[MEASURED]** it defines the platform's entire vertical vocabulary at line 94:

```ts
export type TileVertical = 'general' | 'cultivar' | 'ignition' | 'conduit' | 'kinna';
export const KNOWN_VERTICALS: TileVertical[] = ['general','cultivar','ignition','conduit','kinna'];
```

> **A file that names KINNA and CONDUIT, and describes itself as serving three business types from
> one codebase, is in `packages/cultivar-os/`.**

### 2. What is genuinely grower-specific inside it

**[MEASURED] Almost nothing. One tile of 33, and it is unbuilt:**

```
32 × vertical: 'general'
 1 × vertical: 'cultivar'   → seasonal_module, status: 'planned', no route
```

**[STATED]** lines 86-88 — the file's own rule, which it follows:

> *"`general` — every business gets it (the shared platform spine: costs, assets, receipts, PMI,
> inventory, delivery, social, QB, settings, identity). **DEFAULT home — verticalize ONLY what is
> genuinely vertical-specific.**"*

### 3. What moving it would cost, and what breaks — 🔴 THIS IS THE CONCRETE PART

**[MEASURED] Four platform-level verify scripts hardcode the vertical path:**

| script | line | how |
|---|---|---|
| `scripts/verify-universals.mjs` | `:496` | `read('packages/cultivar-os/src/registry/tileRegistry.ts')` |
| `scripts/verify-tile-fields.mjs` | `:39` | `const REGISTRY = 'packages/cultivar-os/src/registry/tileRegistry.ts'` |
| `scripts/verify-authority-checks.mjs` | `:499` | `const TILE_REGISTRY_PATH = '…/cultivar-os/…'` |
| `scripts/measure-registry-contradictions.mjs` | `:56` | `const REGISTRY = '…/cultivar-os/…'` |

**So the move is: one `git mv`, ~10 import updates, and four one-line path edits in the caps.**
Each cap parses the file **as TEXT** (`verify-tile-fields.mjs:9` — *"parsed as TEXT. No import, no
transpile"*), so none of them breaks structurally; they simply stop finding the file and must be
re-pointed. **[MEASURED]** `npm run verify` would go red immediately and loudly — **there is no
silent-failure path here**, which makes this the safest move in the report.

### 4. 🔴 A SUBTLER COUPLING THE OBVIOUS CAP WOULD NOT CATCH

**[MEASURED] Two files in `shared` cite this vertical file by `file:line` as AUTHORITY:**

- `packages/shared/src/positions/responsibilityCatalogue.ts:17` — *"`tileRegistry.ts:17-27` **already
  ruled the pattern** for a platform-authored catalogue"*
- `packages/shared/src/auth/permissionManifest.ts:99, 379, 613, 633, 826, 1019` — six citations,
  including *"`tileRegistry.ts:204` gates the …"*

✅ **These are COMMENTS, not imports. [MEASURED] I grepped both directions: there are ZERO runtime
imports from `shared` into `cultivar-os`.** The `shared → cultivar` boundary **has been held**
(see §9).

🔴 **But note what that means for tech-debt #156.** #156 proposes a cap that *"must assert IMPORT
EDGES, not the string `cultivar-os`."* **Such a cap would not catch this**, because there is no edge
— there is a shared file reasoning about a vertical file, citing it by line number. **If
`tileRegistry.ts` moves or is renumbered, seven citations across two shared files rot silently.**
That is [[R-26]]'s shape — a written declaration nobody re-checks, steering a decision — **inside the
file that defines our permission model.**

### 5. AC-1 after the move

✅ **AC-1 improves outright, and nothing about the rows changes.** `vertical` is already a FIELD
carrying a VALUE — the textbook AC-1 shape, and the exact precedent
`packages/shared/src/positions/responsibilityCatalogue.ts` cites for itself. Moving the file to
`packages/shared/src/registry/tileRegistry.ts` changes **where the declaration lives, not what it
says.**

⚠️ **One genuine question the move forces, and it should be answered deliberately rather than by
whoever does the move:** the registry imports **`lucide-react` icon components** directly
(`icon: Leaf`). That pulls a React icon library into shared's dependency surface. **[STATED]** the
file already defends this (*"render metadata lives in code — see 'Why code, not a DB table'"*), and
**[MEASURED]** `shared/components/` already depends on React throughout, so this is not new — but it
is the one thing that makes this more than a `git mv`.

---

# FINDING 3 🟡 — THE RECEIPTS CLUSTER: 4,245 LOC THAT SAYS IN ITS OWN SOURCE IT IS SHARED

### 1. Where it lives now

**[MEASURED] 4,245 non-test LOC across ten files, all in `packages/cultivar-os`:**

| file | LOC |
|---|---|
| `src/pages/ReceiptKeeper.tsx` | 1,536 |
| `src/lib/receiptsList.ts` | 696 |
| `src/lib/receiptDetail.ts` | 622 |
| `src/pages/ReceiptDetail.tsx` | 498 |
| `src/components/receipts/ReceiptsList.tsx` | 489 |
| `src/components/LineItemGrid.tsx` | 148 |
| `src/components/ConflictDialog.tsx` | 94 |
| `src/utils/receiptReconciliation.ts` | 84 |
| `src/utils/imageCompression.ts` | 43 |
| `src/utils/dateParse.ts` | 35 |

### 2. 🔴 THE FILE ALREADY KNOWS. IT SAYS SO AT LINE 29.

**[STATED]** `packages/cultivar-os/src/pages/ReceiptKeeper.tsx:29-32`:

> ```
> // VERTICALIZATION NOTE: this surface is shared across verticals. These strings are nursery
> // defaults until packages/shared/src/config/VerticalConfig.ts lands (CLAUDE.md Housekeeping →
> // Vertical Config Extraction). Pull title/subtitle/dropZone from that config per business_type
> // then. The old "Capture truck receipts" copy was an Ignition leak onto the nursery dashboard.
> ```

**That last sentence is evidence, not commentary: this surface has ALREADY been shared across two
verticals once, and the symptom of it was Ignition's copy appearing on the nursery's dashboard.**

**[MEASURED]** it is one of only **two** self-declared verticalization notes in the whole of
`cultivar-os`. The other is `Dashboard.tsx:18` (`LEAKAGE_AVG_VALUE = 28`, *"will move to
verticalConfig post-demo"*).

**[MEASURED]** `packages/shared/src/config/VerticalConfig.ts` **does not exist.** It is an open
CLAUDE.md §4 Housekeeping item. **So the deferral at line 29 points at a file that was never built —
[[R-26]]'s shape again, and the third instance of it in this report.**

### 3. What is genuinely grower-specific inside it

**[MEASURED] Three string constants and nothing else:**

```ts
const CAPTURE_COPY = {
  title:    'Snap a receipt or invoice',
  subtitle: 'Point, snap — AI reads it for you',
  dropZone: …
};
```

**That is the whole of it.** Everything else — OCR capture, device detection, image compression,
vendor resolution, the reconcile verdict, line-item editing, the conflict dialog, the six write-only
reconciliation columns — is *"a business captured a purchase document."* **A food bank receiving a
donated-goods invoice needs every line of it.**

Note the vendor half is **already in shared and already generic**: `ReceiptKeeper.tsx:18-22` imports
`resolveVendor`, `planVendorWrite`, `vendorContactFromCapture`, `VENDORS_SELECT` from
`@trace/shared/business-logic`. **The logic went to shared. The screen did not.**

### 4. What moving it would cost, and what breaks

| | |
|---|---|
| **Cost** | 🟡 **The largest single move in this report.** 4,245 LOC, ~10 files, one React page tree. |
| **Blocked on** | `VerticalConfig.ts`, which does not exist — the three copy strings need a home first. |
| **What breaks** | Routing (`router.tsx`), and the owner-test board for receipts. **[MEASURED]** `docs/owner-tests/receipt-detail-full-surface-test.md` exists with 12 cards; **under OP-14 clause (3), moving the surface flips every one of them `covered` → `owed`.** |
| 🔴 **The real cost** | **OP-14, not the code.** Twelve proven cards become unproven the moment the file moves, and only David's live run can flip them back. **That is the true price of this move and it is not visible in the LOC count.** |

### 5. AC-1 after the move

✅ **Holds, provided the three strings become config values and not a `business_type` switch.** The
correct precedent already exists in shared and is worth copying exactly:
**[MEASURED]** `packages/shared/src/notifications/templates/cultivar.ts` — a **grower-vocabulary
template file** (`plantName`, `container`, *"Your tree is wrapped and ready to load safely"*)
registered into a shared registry at `templates/index.ts:17` alongside `ignitionTemplates` and
`assessmentTemplates`. **Vocabulary as DATA, registered by the vertical, consumed generically.** That
is AC-1 done right and it is already running.

---

# FINDING 4 🟡 — DELIVERY / STOPS / ROUTES, AND A CAPABILITY BEING DISCARDED DAILY

### 1. Where it lives now

**[MEASURED] 3,452 non-test LOC in `packages/cultivar-os`:**

`pages/DeliveryRoute.tsx` (868) · `pages/DeliverySchedule.tsx` (233) ·
`lib/deliveryFulfilment.ts` (584) · `lib/stopRead.ts` (166) · `lib/stopWrites.ts` (172) ·
`lib/stopLoad.ts` (106) · `lib/routeHandoff.ts` (129) · `lib/deliveryWindow.ts` (70) ·
`lib/transport.ts` (133) · `components/delivery/` (1,267: `StopCard`, `SaveSiteDialog`,
`ReviewAskSheet`, `useStopActions`).

### 2. What is genuinely grower-specific inside it

**[MEASURED] Very little, and it is concentrated in one place.**

`deliveryFulfilment.ts` is **[STATED]** *"pure — no React, no Supabase, no DOM, no clock of its own
(every entry point takes `now`)"* and models *"the ONE fulfilment action"*. Its five declared
consumers — review request, completion status, contractor pay, material consumption, *"what actually
happened on a given day"* — are **universal to anything that goes out on a truck.**

The grower-specific residue:
- `lib/transport.ts:43` — the **"planting"** role, defined as `price_type 'per_unit' / price_unit
  'plant'`. **This is Finding 1 wearing a different hat** — the same noun, the same branch.
- `lib/netting.ts` (44 LOC) — `isNettingOffering()` is genuinely grower/compliance-specific (the
  Regina Rule, CLAUDE.md §8). **This one correctly stays behind.**

> **A food bank running a Back-to-School distribution has stops, routes, a load list, a driver
> handoff, and a "this stop is done" tap. It does not have netting.**

### 3. 🔴 THE GEOCODER DISCARDS ITS COORDINATES — AND THIS ONE IS LOSING VALUE NOW

**[MEASURED]** `packages/cultivar-os/src/pages/DeliveryRoute.tsx`:

- `:195-196` constructs a `Geocoder` and geocodes each stop address
- `:211` `const located = await Promise.all(points.map(async p => ({ ...p, loc: await geocode(p.address) })));`
- `:408, :417, :428` — **the only three Supabase calls in the file are READS.**

> **[MEASURED] Nothing writes `lat`/`lng` back. Every address is geocoded on every page load and
> thrown away when the component unmounts.**

This confirms the standing note in memory (*"Proximity opportunities — a geocoder EXISTS
(DeliveryRoute.tsx) but discards coordinates; the gap is persisting lat/lng, not an integration"*)
**is still true on 2026-09-14.**

🔴 **AND THERE ARE TWO UNCONNECTED DISTANCE SYSTEMS. [MEASURED]:**

| | where | used by |
|---|---|---|
| `haversineMeters(lat,lng,lat,lng)` | ✅ **`packages/shared/src/rhythm/rhythmBuffer.ts:50`** — already shared, already generic | `components/RhythmLogger.tsx:123` **only** |
| Google Geocoder + Directions | `pages/DeliveryRoute.tsx`, **inline in a page component** | delivery **only** |

**The platform already owns a pure, vertical-agnostic distance function in `shared`, and the delivery
route — the one surface that is actually about distance — does not use it, because it has no
coordinates to use it on.**

**This is the one finding where delay has a running cost that is not refactor risk:** every delivery
day that passes is a day of route geometry not captured. **[INFERRED — not measured]** persisting
`lat`/`lng` on `customer_addresses` is an additive, nullable column and would not disturb live rows;
**I did not read that table's schema and this must be checked before anyone acts on it.**

### 4. What moving it would cost, and what breaks

| | |
|---|---|
| **The pure lib files** | 🟢 **Cheap.** `deliveryFulfilment`, `stopRead/Writes/Load`, `routeHandoff`, `deliveryWindow` are pure and already tested (7 `.test.ts` files move with them). |
| **`DeliveryRoute.tsx`** | 🟡 **Not cheap, and I would not move it.** 868 lines welded to the Google Maps JS API. |
| 🔴 **What breaks** | **[MEASURED]** `routeHandoff.ts:73,88` builds **Google Directions URLs**. Moving the route page to shared moves a hard Google dependency into the platform — and **[MEASURED]** memory records an unresolved deferred question: *"Routing: Google vs self-hosted — move delivery routing off Google Maps (lock-in) onto self-hosted OSRM/Valhalla?"* **That question should be answered BEFORE this moves, not after.** Moving it first makes the lock-in platform-wide. |

### 5. AC-1 after the move

✅ **Holds for the pure libs** — they name no vertical table and take `now` as an argument.

🔴 **The AC-1 finding, and it is David's own example almost verbatim:** `service_offerings` couples
**transport** to **price**. A food bank's fulfilment has **no price at all** — the run still needs a
stop, a window, a load list, a driver, and a completion tap. **[MEASURED]**
`20260529_businesses_f_service_offerings.sql:32` makes `price numeric(10,2) NOT NULL DEFAULT 0`.

> A food bank's delivery would have to be modelled as a **service offering priced at zero** — which
> is not a redaction and not an absence, but **a real figure that happens to be nought.** That is
> precisely what D-9 and `api/dashboard.ts:72-73` forbid: *"a redaction must not read as a real
> figure."* **The table forces a lie of exactly the kind the platform has already ruled against.**
>
> ⚠️ **Do not fix this by making `price` nullable.** The finding is that **fulfilment and pricing are
> one table and should probably be two** — and that is a design question for David, not a migration.

⚠️ Related and already filed: **tech-debt #251** (checkout offers only ONE staff/flat transport row)
and **#252** (`price_type` and `price_unit` are two representations of one fact). **Finding 1 and
this finding are both downstream of the same table.**

---

# FINDING 5 🟢 — TWO IMPORT FIELD-CHECK ENGINES, BOTH ALREADY IN SHARED

**This is a §6 r8 consolidation, NOT a move. Both halves are already in the right package.**

### 1. Where they live now

**[MEASURED]**

| | file | what it answers |
|---|---|---|
| **A** | `packages/shared/src/quickbooks/importFieldAudit.ts` (475 LOC) | ① a source field carrying data that maps to nothing ② a destination column whose values are the wrong shape |
| **B** | `packages/shared/src/import/columnMap.ts` (166 LOC) | L4 unmapped → keep-as-attribute/ignore; L3 shape inferred from values |

### 2. ✅ THE ENGINE IS ALREADY GENERIC — THIS IS BETTER NEWS THAN THE PROMPT ASSUMED

**[MEASURED]** `importFieldAudit.ts:351-356`:

```ts
export function auditImportFields(input: AuditInput): ImportFieldAudit {
  const records  = input.records  ?? [];
  const map      = input.map      ?? CUSTOMER_FIELD_MAP;
  const ignored  = input.ignored  ?? CUSTOMER_IGNORED_SOURCE_FIELDS;
  const expected = input.expected ?? EXPECTED_COLUMN_SHAPE;
```

**The map, the ignore-list and the expected shapes are all PARAMETERS. The QuickBooks-customer
constants are merely the DEFAULTS.** The engine is source-agnostic and vertical-agnostic today.

**[STATED]** its header already makes the AC-1 argument for itself:

> *"The population is DERIVED FROM THE DATA; only the MAPPING is declared. Check ① does NOT compare
> against a hand-written list of every QuickBooks field — that list would rot the first time Intuit
> added one, and a field nobody declared would be INVISIBLE rather than flagged."*

**So "how much is QuickBooks and how much is nursery?"** — **[MEASURED]: none of it is nursery, and
only the three default constants are QuickBooks.** ⚠️ The *vocabulary* is US-address-shaped
(`'phone' | 'email' | 'postcode' | 'street' | 'wordlike'`, `STREET_WORDS` at `:224` is a US
abbreviation list) — which is a **locale** assumption, not a vertical one, and worth naming as such.

### 3. What is genuinely grower-specific

**[MEASURED] In A: nothing.** In B: the header claims the vertical —
**[STATED]** `columnMap.ts:2`: *"the FOUR-RUNG mapping ladder for **a grower's** CSV headers → the
catalog spine."* But its content is not: `SpineField = 'sku'|'name'|'size'|'qty'|'sell_price'` is a
generic catalogue spine. **The word "grower" in that header is the only grower thing in the file.**

### 4. 🔴 THE FINDING: ONE OPERATION, TWO IMPLEMENTATIONS, NEITHER AWARE OF THE OTHER

**[MEASURED]** `columnMap.ts` does not import `importFieldAudit`, and nothing outside
`quickbooks/` imports it either — the only consumers are
`qboCustomerAdapter.ts:63,367`, `customerImportWriter.ts:77`, `QboCatalogueImport.tsx:72`.

**Two answers to "what did we not map?" and two value-shape classifiers:**

| | A — `classifyValueShape` (`:234`) | B — L3 shape (`columnMap.ts:131-143`) |
|---|---|---|
| vocabulary | phone · email · postcode · street · wordlike | qty · sell_price (currency / small whole numbers) |
| on unmapped | reports it with a ratio + masked examples | offers keep-as-attribute or ignore |

**They are complementary, not duplicated — which is exactly what makes this worth filing rather than
urgent.** But the CSV path has **no equivalent of check ②** (type-shape mismatch per destination
column) and **no `mappedButAbsent`** — the check that catches a source renaming a field and the
import silently writing nulls.

> **The CSV importer cannot currently detect the defect that #322 was built to detect.**
> **[MEASURED]** #322's own headline case — 486 phone numbers written into `address_line1` — would
> have been **equally invisible** had it arrived by CSV.

### 5. AC-1 and the recommendation

✅ **AC-1 already holds.** The recommendation is **not a move** — it is:
1. **Re-home the generic half**: `shared/import/fieldAudit.ts`, with
   `shared/quickbooks/customerFieldMap.ts` keeping the three QBO default constants. ~1 hour.
2. **Point `columnMap`'s L4 at it**, so both import paths give one answer. ⚠️ This is the part with
   real design in it, not a mechanical move.
3. Delete the word *"grower's"* from `columnMap.ts:2`.

---

# FINDING 6 🟢 — `production/`: ALREADY SHARED, MOSTLY UNIVERSAL, GROWER UNITS IN THE TYPE

### 1. Where it lives now — ✅ ALREADY IN SHARED, AND THE SPLIT IS EXEMPLARY

**[MEASURED]** `packages/shared/src/production/` — 1,731 LOC across 7 files.

**[MEASURED] this is the model split, and it should be the template for Findings 3 and 4:**

| | |
|---|---|
| **THE MODEL → shared** | `productionMath.ts` (591), `productionConfig.ts` (249) |
| **THE SURFACE + IO → cultivar** | `pages/UppotPlan.tsx:54` imports `@trace/shared/production`; `lib/uppotPlanRead.ts:30`, `lib/uppotPlanWrite.ts:31` likewise |

**[STATED]** `UppotPlan.tsx:36`: *"DEPENDENCIES: `@trace/shared/production` (**the whole model**)"*.

### 2. What is genuinely grower-specific — and what is emphatically not

**[MEASURED] The universal majority:**

| function | why universal |
|---|---|
| `runMinutes(n) = setup + n × handling` (`:188`) | **[STATED]** *"A flat per-pot rate is wrong at every batch size except the one it was measured at."* **This is true of packing boxes, roasting bags, or servicing units.** |
| `splitPenalty` (`:216`) | every split costs one extra setup — universal |
| `crewHours` (`:202`), `sequenceRuns` (`:298`), `addWorkingDays` (`:342`) | universal scheduling |
| `mustKeepSellable = sales/month × cover months` | **textbook safety-stock / reorder math** |
| `arithmeticCheck` (`:577`) | universal |

**[MEASURED] The genuinely grower-specific:**
- `mixCubicYardsPerPot(fromGal, toGal, ops)` (`:178`) — **the one materials-consumption function**
- `potCascade` (`:255`) — the container ladder
- `OperationsConfig.tradeGallonFactor` (`productionConfig.ts:56`) and
  `.trueGallonsPerCubicYard` (`:58`) — **grower units in the TYPE**

### 3. 🔴 THE FILE CLAIMS AC-1 AND THE CLAIM IS HALF TRUE — MEASURED, NOT ASSUMED

**[STATED]** `productionConfig.ts:43-46`:

> *"AC-1: **generic throughout. No vertical noun in any key, type or identifier.** 'Uppot' is a
> cultivar-vertical LABEL and appears only in the cultivar surface."*

**✅ The "uppot" half is TRUE. [MEASURED]** `uppotNow` appears in `productionMath.ts:133,158,161,165`
as an internal field name only, and the *label* lives in the cultivar surface — exactly as claimed,
with the precedent it cites (`responsibilityCatalogue.ts`) holding up.

**🔴 The "no vertical noun in any key or type" half is NOT true.** `tradeGallonFactor` and
`trueGallonsPerCubicYard` are **keys on an exported interface in shared.** A gallon is a grower's
unit; a food bank's operations config has no gallon factor and no cubic yards.

> **✏️ This is a correction to a file's own AC-1 claim, and it is the fourth
> comment-contradicts-its-own-repo instance this report found** (cf. tech-debt #188, #61, #180).
> **The claim is 80% right, which is why nobody caught it.**

**✅ THE SCHEMA, HOWEVER, IS CORRECT — AND THIS IS THE IMPORTANT PART. [MEASURED]**
`20260905_production_planning.sql:57-62`:

```sql
CREATE TABLE IF NOT EXISTS public.business_operations_config (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
```

> **A `jsonb` blob. Variation in DATA, not schema. AC-1 holds where it matters most.** Contrast
> Finding 1, where the same platform put a vertical's noun in a CHECK constraint. **The newer
> migration got it right.**

### 4. What moving/fixing would cost, and what breaks — 🔴 IT IS ALL FREE RIGHT NOW

**[MEASURED] tech-debt #253 is confirmed still true: `20260905_production_planning.sql` is NOT
APPLIED. All three tables — `business_operations_config`, `production_plans`,
`production_plan_lines` — are absent from the live database.**

> 🔴 **So `packages/shared/src/production/` (1,731 LOC) and the whole `UppotPlan` surface are shipped
> code reading and writing three tables that do not exist, on every tenant.**
>
> ✅ **Which makes this the ONE finding where renaming the config keys costs NOTHING — there is no
> live row to migrate.** `tradeGallonFactor` → a generic `unitConversionFactor`, or move the
> grower-specific keys into a nested `vertical: {}` sub-object. **If it is ever going to be done, now
> is free and later is not.**

### 5. The made-item / recipe concept — **[MEASURED] IT DOES NOT EXIST**

The prompt asked *"the made-item / recipe concept, if any exists yet."* **There is none.**

**[MEASURED]** a corpus-wide sweep for `recipe|bill_of_materials|BOM|made_item|assembl|consumes|
ingredient|components_of` across `packages/` and `supabase/migrations/` returns **no such table and
no such module.** Every `recipe` hit is the **`pricing_recipe:read` permission string** — which is
confidential *pricing* config (`business-logic/pricingRecipeFields.ts`), **not a bill of materials.**
**[MEASURED]** no table in the migration corpus has rows that are components of another item.

> **The closest thing in the entire platform is `mixCubicYardsPerPot` — a single hardcoded
> consumption formula for one material in one vertical.**

**The recommendation is therefore the cheapest in this report, because it is a decision rather than
work: when a bill-of-materials is built, build it in `shared` on day one.** *What a job consumes* is
universal. **Container gallons and T-posts are rows in it, never columns of it.** The correct shape
is a generic `(made_item, component_item, quantity, unit)` edge table — **and `unit` must not repeat
Finding 1's mistake by enumerating a vertical's vocabulary in a CHECK constraint.**

---

# FINDING 7 🟢 — GROWER VOCABULARY THAT HAS ALREADY LEAKED INTO SHARED

**Direction reversed: this is not "move it to shared", it is "it is in shared and should not be."**
All small, all contained, most already known.

| # | where | what | status |
|---|---|---|---|
| a | `shared/src/business-logic/serviceReview.ts:156` | `const ACCOUNT_STOCK = /nursery\s+stock\|plant\s+sales/i` | 🔴 **NOT previously filed** |
| b | `shared/src/business-logic/serviceReview.ts:407` | `/^\d+(?:\.\d+)? Gallon$/` — a hardcoded grower size format | 🔴 **NOT previously filed** |
| c | `shared/src/business-logic/serviceReview.ts:78` | `export const UNIT_PLANT_SHARE = 0.6` | 🔴 **NOT previously filed** |
| d | `shared/src/qr/print.ts:5,24,46` | `nurseryName?: string`, `.nursery` CSS | 🟡 **known** — CLAUDE.md §4 Noun Purge, open |
| e | `shared/src/qr/generate.ts:15,19,20` | `plantId`, `generatePlantQR` | 🟡 **known** — same item |
| f | `shared/src/discovery/populate.ts:77-78` | `supabase.from('cultivar_plants')` — a vertical table name, a RUNTIME literal | 🟡 **known** — §1.5, tech-debt #272 |
| g | `shared/src/production/productionConfig.ts:56,58` | `tradeGallonFactor`, `trueGallonsPerCubicYard` | 🔴 **NEW — see Finding 6** |

### ✅ §1.5's claim about (f) was CHALLENGED and it HOLDS

**[MEASURED]** CLAUDE.md §1.5 asserts `populate.ts` is *"the ONLY one: population, not a sample."*
A full grep of `cultivar_plants` across `packages/shared/src` returns **four hits**:
`populate.ts:20` (comment) · `:31` (comment) · **`:77` (runtime literal)** · `:78` (the count key) ·
plus `quickbooks/itemImportWriter.ts:486` (comment) and `inventory/stockLineResolver.ts:11`
(comment). **Confirmed: exactly one runtime literal. The claim is accurate, four months on.**

### ✅ AND ONE THING THAT LOOKS LIKE A LEAK AND IS NOT — the model to copy

**[MEASURED]** `shared/src/notifications/templates/cultivar.ts` (14 grower-vocabulary hits:
`plantName`, `container`, *"Your tree is wrapped…"*) is **AC-1 CORRECT.** It is one vertical's
template file, registered alongside `ignitionTemplates` and `assessmentTemplates` at
`templates/index.ts:17`. **A vertical's vocabulary, as data, in a registry.** Same for
`discovery/verticals/nursery.ts`.

> **Do not "fix" either of these. They are the pattern the rest of the report is asking for.**

---

# 8. THE TWO EXEMPLARS — WHAT "DONE RIGHT" LOOKS LIKE HERE

Worth naming precisely, because the answer to *"how should the receipts cluster move?"* is **"like
these two, and they are already in the repo."**

**① `shared/src/inventory/stockLineResolver.ts`** — **[STATED]** lines 11-14:

> *"The most-specific vertical lane (a `cultivar_plants` tag_id) **stays in each caller** — this
> module is AGNOSTIC (AC-1): it names no vertical table, only the shared `business_`-prefixed
> catalog."*

**The generic resolution ladder is shared; the vertical lane stays in the vertical.** That single
sentence is the whole design rule this report is arguing for.

**② `shared/src/production/` + `cultivar-os/pages/UppotPlan.tsx`** — the whole pure model in shared,
the surface and both IO functions in the vertical (Finding 6). **[MEASURED]** `UppotPlan.tsx` imports
the model and owns the screen; `uppotPlanRead/Write.ts` own the Supabase calls.

---

# 9. WHAT IS ALREADY IN SHARED — AND WHETHER THE BOUNDARY HELD

**David asked this because it decides how urgent the rest is. The answer is: it held, and that is
why almost nothing here is urgent.**

### 9.1 The scale — ✅ shared is LARGER than the vertical

**[MEASURED]** `packages/shared/src`: **~66,000 LOC across 25 directories.**
`packages/cultivar-os/src`: **39,567 non-test LOC.**

The 25 directories: `ai · assets · auth (6,583) · business-logic (14,766) · campaigns · components
(9,110) · context · debug · design-system · devtools · discovery (3,585) · hooks · import ·
inventory (3,101) · modules · notifications · onboarding · pages · positions (2,333) · production
(1,731) · qr · quickbooks (15,701) · rhythm · social · supabase · sync · utils`.

🔴 **CLAUDE.md §5's warning is worth repeating because it is still the live hazard:** the old inline
listing named 9 directories when there are 25 — *"it answers 'does it already exist in shared?'
wrongly and confidently."* **Answer it with `ls packages/shared/src/`, never from a written list.**

### 9.2 ✅ THE BOUNDARY HAS HELD — MEASURED IN BOTH DIRECTIONS

**[MEASURED] `shared → cultivar-os` runtime imports: ZERO.** Grepped for both
`@trace/cultivar-os`-style and relative `../../../cultivar` forms across all of
`packages/shared/src`. **The only cross-references are comments** (Finding 2, §4).

**[MEASURED] `cultivar-os → shared` imports: heavy and healthy** — 48× `@trace/shared/context`,
32× `business-logic`, 19× `auth`, 14× `SurfaceState`, 11× `inventory`, 11× `personName`,
9× `DataSheet`, plus 4× `production`, 4× `sync`, 3× `qr/generate`.

> 🔴 **THIS MATTERS FOR TECH-DEBT #156.** #156 records that the boundary *"is enforced by NOTHING —
> tsconfig, eslint, package.json, knip and vite each checked and named: a shared file could import
> from a vertical today and every check in `npm run verify` would pass."*
>
> **That is still true. And it has still never been violated.** The boundary is held by convention
> and has been held well — which is the strongest possible argument that **the cap #156 proposes is
> worth building cheaply, and that the risk it guards is not currently live.**

### 9.3 ✅ EVERY CRITICAL FINDING OF THE 2026-05-28 AUDIT IS RESOLVED

The prior baseline is `docs/codebase-audit-shared-vs-vertical-2026-05-28.md` (429 lines).
**[MEASURED] all five of its "Read First" findings:**

| | 2026-05-28 finding | 2026-09-14 |
|---|---|---|
| F1 | `cultivar-os/src/lib/shared/` — 3 character-identical shadow copies | ✅ **directory GONE** |
| F2 | 3 dead Python FastAPI files in `cultivar-os/api/` | ✅ **0 `.py` files** |
| F3 | `shared/src/ai/ai_router.py` — Python in a TS package | ✅ **GONE** |
| F4 | `TechKeypad.jsx` — React Native in shared | ✅ **0 files** |
| F5 | `shared/src/pricing/marginEngine.ts` — a stub | ✅ **`pricing/` gone; `business-logic/MarginEngine.ts` is real** |

> **Five for five, in under four months. The boundary did not drift — it was actively repaired.**

### 9.4 ✏️ A FACTUAL CORRECTION THIS RECON OWES — tech-debt #16 is STALE

**[MEASURED]** CLAUDE.md's tech-debt line carries **#16 (MarginEngine orphaned — A callers +
plants.cost_price)**. It is no longer orphaned:

```
packages/shared/src/business-logic/CostToProduce.ts:41
  import { calculateRetail, getProfitMargin } from './MarginEngine';
```

**[STATED]** `CostToProduce.ts:12,17`: *"delegates the cost→price step to the canonical shared
MarginEngine"* / *"canonical price authority."* Consumers: `CostToProduce.ts`, `tierPricing.ts`,
`business-logic/index.ts`, `shared/index.ts`, and `cultivar-os/pages/CostToProduce.tsx`.

**A real import, not a mention.** ⚠️ **I did not verify the `plants.cost_price` half of #16** — that
clause may still stand. **The "orphaned" clause does not.**

---

# 10. RECOMMENDATION — AND IT IS MOSTLY "NOT YET"

**The honest summary: the boundary held, there is no second vertical, and moving 7,700 LOC of
working surfaces while LAWNS goes live would be the riskiest thing anyone could do with this report.**

### 🔴 Worth doing before a second vertical exists — because delay makes them cost more

| | what | why now | est. |
|---|---|---|---|
| **1** | **Widen `service_offerings.price_unit`'s CHECK; drop `DEFAULT 'plant'`** (F1) | **Schema + live rows. Widening never rejects an existing row — that is true today and stays true, but every new row makes the surrounding code more confident in the assumption.** | ~1h + David applies |
| **2** | **Persist `lat`/`lng` from the geocoder** (F4 §3) | **Route geometry is being discarded on every delivery day. This is the only finding with a running cost.** ⚠️ Needs a schema read first. | ~2h |
| **3** | **Rename `production/`'s gallon keys** (F6) | 🔴 **[MEASURED] the tables are NOT APPLIED — this is free today and not free once they are.** | ~30m |

### 🟡 Worth doing when a second vertical is actually commissioned — not before

4. **Move `tileRegistry.ts` to shared** + re-point the four caps (F2). **This is the natural FIRST
   task of a second-vertical build**, not a task before one.
5. **Consolidate the two import field-check engines** (F5) — re-home the generic half; point
   `columnMap`'s L4 at it.
6. **Move the pure delivery libs** (F4) — ⚠️ **answer the Google-vs-self-hosted routing question
   first.** Leave `DeliveryRoute.tsx` where it is.
7. **Move the receipts cluster** (F3) — ⚠️ **blocked on `VerticalConfig.ts`, and it flips 12
   owner-test cards `covered` → `owed`. That OP-14 cost is the real price, not the LOC.**

### 🟢 Decisions, not work — free, and they prevent the next instance

8. **When a bill-of-materials is built, build it in `shared`** (F6 §5). It does not exist yet, so
   this costs nothing today and cannot be retrofitted cheaply later.
9. **Fix `productionConfig.ts`'s AC-1 claim** (F6 §3) — it is 80% true and reads as 100%.
10. **Delete *"a grower's"* from `columnMap.ts:2`** — one word, and the file is otherwise generic.
11. **Clear the three `serviceReview.ts` grower regexes** (F7 a/b/c) — **not previously filed.**

### 🔴 What I recommend NOT doing

**Do not start a general "move surfaces to shared" campaign.** 32 of 33 tiles being `general` makes
that *look* like the obvious sweep. It would touch ~7,700 LOC of working, owner-proven surfaces,
flip an unknown number of owner-test cards to `owed`, and **buy nothing until a second vertical
exists.** The correct trigger is a commissioned second vertical, and the correct first move at that
point is item 4.

---

# 11. WHAT THIS RECON DID NOT DO — stated, not implied

- 🔴 **NO LIVE DATABASE WAS QUERIED.** Every schema claim is from the migration corpus in the repo.
  Row counts and live-state claims are marked `[INFERRED]` and **must be checked before acting** —
  notably Finding 1's live `price_unit` distribution and Finding 4's `customer_addresses` shape.
- 🔴 **`packages/ignition-os` (79 `.jsx`) was NOT audited.** It is frozen donor code (CLAUDE.md §2)
  and out of knip scope. **A real second-vertical assessment would have to read it**, because it is
  the only evidence we have of these surfaces serving a different business.
- ⚠️ **No owner-test card was added, changed or flipped** — this recon changes no surface. Under
  OP-14 a report-only pass has none to touch.
- ⚠️ **The story-reconciliation gate (§9) was not run against `user_stories.md`** — it fires on a
  BUILD SPEC, and this is a report. **Any build arising from this report owes that gate.**
- ⚠️ **`docs/RULINGS.md` was GREPPED, not read in full** (§10 step 10, as amended 2026-09-12).
  **Terms grepped: `shared`, `AC-1`, `extract`, `boundary`, `vertical`, `config`, `noun`, `palette`,
  `token`.** Result: **no IMPLEMENTED ruling governs the shared/vertical extraction boundary** beyond
  AC-1 itself and CLAUDE.md §4's Housekeeping items. R-154 (worktrees) and R-139 (`20260529_pmi_
  shared` retirement) matched the term `shared` but are unrelated. **If a ruling exists that those
  nine terms would not surface, this recon did not see it.**
