# STAGE 0 RECON — SPLIT THE CAPTURE: PURCHASES TO `receipts`, SALES TO `orders`

**Filed:** 2026-09-02 · **Ledger:** #254 · **Bar:** RECON ONLY — zero diff under `packages/`, `api/`, `supabase/` SQL.
**Tree:** `main` at `08fd5a1` · **Tenant:** LAWNS `ed2e5933-45dc-4b9b-a331-ddfd125e7a74`
**Ruling being reconned:** David, 2026-09-01 — *an INCOMING document is a purchase and belongs in `receipts`; an OUTGOING document is a sale and belongs in `orders`. Both tables are correctly named. The capture writes to the wrong one.*

> **METHOD.** Every claim below names what was opened to produce it ([[R-26]]). Every count states its
> population. Two read-only measurements were run: `scripts/measure-receipts-view.mjs` (existing, sanctioned,
> `.select()` only) and one throwaway probe, deleted after use. **Nothing was written to the database.**

---

## 🔴 PART 0 — THE FOUR PROMPT PREMISES THAT DID NOT SURVIVE CONTACT

*Filed first and deliberately. A recon that corrected its own spec is worth more than one that confirmed it,
and the next session should be able to see which premises broke without re-deriving them.*

### C1 · "`origin/main = 84cc695`; `thunder/receipts-view` is BUILDER-COMPLETE and NOT MERGED"

**FALSE, and it inverted the sequencing clause.** Measured: `origin/main = 08fd5a1`; `0c066c8` is an ancestor
of `main`; the merge is `11f9401` (*"Merge thunder/receipts-view into main (#252)"*). `docnumber-matcher`,
`deliveries-window`, `fulfilled-tap` and `history-order-lines` merged alongside it. **Two worktrees are live,
not ten** (`git worktree list`).

🔴 **THE PREMISE HAD A SOURCE AND THE SOURCE WAS OURS.** `TRACE-SESSION-BOOTSTRAP.md:86-87` — the file every
session opens FIRST, by CLAUDE.md §10 — still read *"BUILDER-COMPLETE on `thunder/receipts-view`, NOT MERGED"*
a full day after the merge. The "ten worktrees" figure came from `CLAUDE.md:269`, a §3 narrative line that was
**true when written on 2026-09-01**. Neither was invented; neither was re-measured. **Corrected 2026-09-02** —
see the ledger row for the full sweep.

**Consequence for the build:** the fork risk is gone (merged). The clause's *other* half stands — the branch is
**not owner-proven**, 11 cards, 0 covered. Stage 1 blocks on the proof, not on a merge.

### C2 · "the launcher pinning `shape:'invoice'`"

**The launcher never pinned the shape.** `CaptureInvoiceLauncher.tsx:21` pins `state:{from:'route'}`.
`OCR_SHAPE` is a **module-level constant** hard-pinned `'invoice'` at `ReceiptKeeper.tsx:36`, identical for
both doors, and has been since Wave 2 — `TRACE-SESSION-BOOTSTRAP.md:247` already carried this as a standing 🟡
(*"shape HARD-PINNED 'invoice' … nothing auto-routes the extraction"*). **The shape never varied by door, so
there is no per-door signal to recover — there is one to introduce.**

### C3 · "R-52"

**Taken.** `R-52` is *"SEEING COST IS NOT ASSIGNING DESTINATION"*, filed 2026-09-01, OPEN. Next free id is
**R-54**. Checked against all 53 rulings before drafting.

### C4 · "find out what else that [12-June] design assumed before adding to it"

**It assumed the opposite of what the prompt feared, and this is the strongest argument for the ruling that the
recon found.** `CountOnceSeam.ts:32-38` and **D-5** both state it outright:

> *"EVENT, NOT RECEIPT, IS THE UNIT OF TRUTH … `receipt_id` is **demoted from key to one high-confidence /
> substantiating signal**."*

D-5's own reasoning names the failure mode as *"forgotten, doubled, or fed twice from a vendor channel under a
different id for the same purchase"* — **which is the two duplicate pairs sitting in the live data today.**
The dedup seam never assumed `receipt_id` was an identity and never assumed `receipts` held sales. **Narrowing
`receipts` to purchases moves the design toward its stated intent.** Written eleven weeks before the ruling.

---

## PART 1 — THE SEVEN QUESTIONS

### 1 · Every writer of `receipts` — exhaustive

**ONE.** `ReceiptKeeper.tsx:438`. No API route, no RPC, no migration, no script writes this table. The other
`.from('receipts')` calls are three reads (`customers/create.ts:184`, `ReceiptsList.tsx:163`, the measure
script) plus `ReceiptKeeper.tsx:402`, which is the **storage bucket** of the same name, not the table.

**What set `vendor` to `LAWNS Tree Farm, LLC.` on the nine — and it is not a bug.**
`fields.vendor` ← `data.parsed?.vendor` ← `ocr.ts:84`:

> `"vendor": "string — the business that ISSUED the invoice (the seller), as printed"`

reinforced at `ocr.ts:106` — *"Distinguish the VENDOR (seller, usually top/letterhead) from the CUSTOMER."*
**On LAWNS's own outgoing invoice the issuer IS LAWNS. The OCR read the document correctly, the field is
populated correctly, and the answer is still nonsense — because the row has no field the answer belongs in.**
David's tell is confirmed at the schema layer, not the extraction layer.

`category` on those nine (population: 17 LAWNS receipts): **`other=5 · supplies=4`**. The vocabulary is
`ReceiptKeeper.tsx:81` — `fuel, supplies, meals, parts, equipment, maintenance, office, other`, an **expense**
vocabulary — and `ocr.ts:99` instructs the model to pick a *"best fit"* from it. Asked to classify a sale with
only expense categories, the model complied. **Nothing defaulted; all nine values were actively produced.**

🔴 **UNEXPECTED, AND IT CHANGES PART 3: `ocr_raw` IS THE RAW PROVIDER ENVELOPE, NOT A PARSED DOCUMENT.**
Keys on all 17 rows: `candidates, responseId, modelVersion, usageMetadata`. `ocr_raw.vendor` is **null on 17
of 17**. The parsed document survives only as the five owner-confirmed columns plus `line_items_original`.
**After the confirm screen closes, the parse exists nowhere.**

### 2 · The capture flow, and where the outgoing branch diverges

**It diverges — and every divergence happens too late and is thrown away.**

| Stage | What happens | Where |
|---|---|---|
| Launch | `navigate('/receipts', {state:{from:'route'}})` from the delivery doors; **nothing from the tile** | `CaptureInvoiceLauncher.tsx:21`, `DeliverySchedule.tsx:471` |
| Read | `enteredFrom` | `ReceiptKeeper.tsx:144` |
| Used | **`console.log` only** — sole consumer is the `[TRACE:ROUTER]` emit at `:177` and its own dep array at `:178` | — |
| OCR | `shape: OCR_SHAPE`, module constant `'invoice'` | `ReceiptKeeper.tsx:36` |
| Classify | `docType: 'invoice-customer' \| 'receipt'` = `hasCustomer ? …` | `ReceiptKeeper.tsx:305-306` |
| Used | **one copy line at `:988`.** Never persisted, never branches the write | — |
| Write | `insert` into `receipts` — **unconditional, before any fork** | `ReceiptKeeper.tsx:438` |
| Fork | `if (needCustomer && …)` → `/api/customers/create` | `ReceiptKeeper.tsx:483` |

🔴 **A two-way document classifier already exists, already runs at capture, and is discarded.** The build does
not need to invent classification. It needs to (a) source it from the launch point instead of from *"did the
OCR find a customer name"*, and (b) let it reach the write — which today runs **before** the fork, so **every
capture writes a purchase row and an order is a downstream side-effect of a checkbox.**

**`customers/create.ts:184` is the only path from receipt to order.** The other order-INSERT paths are
`orders/submit.ts:865` (checkout) and `historyOrderWriter.ts` (QBO import); neither reads `receipts`.

### 3 · What the launcher passes, and where the shape is dropped

See **C2**. The shape is dropped **three times, three different ways**:

1. `enteredFrom` reaches the component and dies in a log line.
2. `docType` is derived and never persisted.
3. 🔴 `ocr.ts:341` **re-derives the shape a second time** — `req.body?.shape === 'asset' ? 'asset' : 'receipt'`
   — for the authority check, collapsing `'invoice'` into `'receipt'`. **One request field, two independent
   derivations, TWENTY lines apart in one function** (the first is `ocr.ts:320-321`, the second `:341`), and the second is the one that decides which permission
   an invoice capture needs. STD-011. **Carried into Stage 1 per §1.6 item 2 — a docs pass is not that build.**

### 4 · The breadcrumb

`Breadcrumb.tsx` calls `breadcrumbForPath(location.pathname)` — **a pure function of the pathname alone.**
`location.state` is never read. `breadcrumbForPath` (`tileRegistry.ts:880`) walks `parent` from `nav_receipts`
(`tileRegistry.ts:766`) → `nav_operating_costs` → `sec_dashboard`.

**Both doors land on `/receipts`, so both render `Dashboard / Operating Costs / Receipts` — identical by
construction.** It reads the destination component's route. **The launch context is sitting in `location.state`
two lines away and nothing consults it.**

### 5 · What `orders` needs to accept a captured sale

🔴 **Measured, and it reframes the question: `orders` at LAWNS is 30 rows and ALL 30 are `order_kind='history'`.**
Not one ordinary checkout order exists in the tenant. 19 arrived from the QBO import, 11 from receipt capture.

| Need | Column | Populated (population: 30 LAWNS orders) |
|---|---|---|
| discriminator | `order_kind` | 30/30 |
| the seller's own doc number | `source_document_number` | 30/30 |
| QB DocNumber | `qb_doc_number` | 19/30 |
| when the sale happened | `sale_date` | 30/30 |
| link to the evidence | `receipt_id` | 11/30 |
| lines | `order_items.description` + `.sku` | 37 of 39 lines carry a sku |

**What is missing is not a column on `orders` — it is the capture evidence**, which today reaches `orders` only
via a `receipts` row the ruling says should not exist for a sale. `orders` has no home for `image_url`,
`ocr_raw`, `line_items_original`, `amount_original`, `accept_vs_edit`, or the four reconcile columns.

⚠️ **The red-team's objection is measurably UNDERSTATED, not overstated.** It said *"83% of orders would carry
ten permanently-null capture columns."* At LAWNS today it would be **19 of 30 null and rising with every
checkout order** — and LAWNS has not made a checkout order yet.

✅ **The D-52 committed-stock landmine is clear, and it was measured rather than assumed:** **0 of 39** lines on
receipt-linked orders carry a `business_inventory_id`. Invariant (1) holds alone.

### 6 · RLS and capability — 🔴 the sharpest finding, and it needs a David ruling

**Capturing a SALE today requires four `costs:*` permissions and zero order permissions.**

| Gate | Requires | Where |
|---|---|---|
| route `/receipts` | `costs:read` | `router.tsx:229-230` |
| tile + nav node | `costs:read` | `tileRegistry.ts:170` |
| `POST /api/receipts/ocr` | `costs:read` | `ocr.ts:343-346` |
| `receipts` INSERT under RLS | **`costs:create`** | `20260727_rbac_resource_action_flip.sql:116` |
| `receipts` SELECT | `costs:read` | `20260727_rbac_resource_action_flip.sql:113` |

`permissionManifest.ts:455` labels that resource *"cost_objects, receipts — cost basis / unit cost.
**Confidential.**"*

Meanwhile the order-creation path — `/api/customers/create` — gates on **`customers:create`** plus
`deliveries:create` when a delivery rides along (`customers/create.ts:66-73`). **It never checks
`orders:create`.** The order is then written under the service key, bypassing RLS; `orders` has **no member
INSERT policy at all**, only `orders_member_select` on `orders:read`
(`20260727_rbac_resource_action_flip.sql:192-194`), deliberately, because *"every order WRITE goes through the
service-key api layer."*

🔴 **So the authority model for a captured sale is exactly backwards: it demands the confidential cost-basis
capability and asks nothing about orders. A manager who may take orders and may not see cost basis cannot
capture a customer invoice today.** Not a Stage 1 nicety — it is why the split has a permission dimension.
**OPEN RULING (d).**

### 6b · 🔴 PROVEN — does `orders:create` ACTUALLY ENFORCE? (David's flag, 2026-09-02)

**The flag, verbatim:** *"gating a sale capture on `orders:create` may cite a string that enforces
nothing. That is R-31's exact scar. PROVE THE GATE ENFORCES BEFORE THE SPEC RELIES ON IT."*

**Method:** repo read + a **read-only** live probe against LAWNS (`ed2e5933-…`), run both
directions with negative controls, per [[R-33]] (*a check that cannot disagree is not a check*).
**Wrote nothing** — three `.select()`s and eleven `has_permission_for` RPC calls, no insert, no
update, no delete. Population stated: **all 3 `business_members` rows, none sampled.**

**ANSWER: THE STRING ENFORCES. It is not a fake pill.** Three legs:

**① The machinery is real and strict.** `has_permission` / `has_permission_for` are `SECURITY
DEFINER`, `STABLE`, `SET search_path = ''`, and require an **ACTIVE** membership row whose
`permissions` jsonb contains the string **or an alias of it**. **No owner branch** since
2026-07-30 — the owner passes by holding the string like everyone else.

**② Live, both directions, with negative controls:**

| Probe | Result |
|---|---|
| OWNER (×2, active, 57 perms) · `orders:create` | **true** |
| MANAGER (**`active=false`**, 25 perms, array *contains* `orders:create`) | **false** — the active clause is doing work |
| every member · `__not_a_real_permission__` | **false** — **the check can disagree** |
| non-member uid · `orders:create` | **false** |
| a real member · a **different** `business_id` | **false** |

**③ There is already a LIVE ENFORCING CALL SITE for this exact act.**
`api/qbo/router.ts:851` — the QB order ingest, an external document becoming a history order —
runs `callerCan(auth, businessId, 'orders:create')` and returns **403 `FORBIDDEN`** with a
`[TRACE:QBORDERS] ingest REFUSED` emit. Same act, same string, already refusing. **The spec copies
that shape rather than inventing one.**

---

#### 🔴 BUT — THREE QUALIFICATIONS THE SPEC MUST CARRY, AND THE THIRD IS THE ONE THAT BITES

**(i) The string enforces WHERE IT IS CALLED, and the sale-write path does not call it.** The
recon's claim stands, verified: `api/customers/create.ts` — the handler that INSERTs the order at
`:221` — gates on `customers:create` (`:67`) and `deliveries:create` (`:71`) and **never checks
`orders:create`**. So citing the string in the spec is safe **only if the spec ADDS the
`callerCan` call.** It inherits nothing.

**(ii) `submit.ts`'s silence is a RULING, not a gap — and the sale door is a DIFFERENT door.**
`api/orders/submit.ts:189-196` carries no order-creation gate **deliberately**: the anon QR
checkout path carries **no token at all**, so *"a permission gate here would not narrow the act —
it would delete it."* The OCR sale door is authenticated by construction (a member standing at a
screen), so gating it does **not** contradict that ruling. ⚠️ **Anyone reading submit.ts's comment
and concluding "orders need no gate" will have read a ruling about the ANON door as a ruling about
ALL doors.** Stated here so the spec does not have to re-derive it.

**(iii) A LEGACY ALIAS CAN SATISFY THE GATE — dormant here, not absent.** `permission_aliases`
carries `('qr_checkout','orders:create')` **bidirectionally**
(`20260726_permission_alias_layer.sql:149-150`), so a member holding only the legacy `qr_checkout`
string passes an `orders:create` check. **Measured: 0 of 3 LAWNS members hold `qr_checkout`** — so
it is dormant *on this tenant*, which is a fact and not a guarantee for the next one.

---

#### 🔴 AND THE STRUCTURAL FINDING THE FLAG UNCOVERED: A HANDLER GATE CANNOT DELIVER THE RULING

**"Selling does not require seeing cost" is not reachable by changing a handler gate, because the
binding constraint is an RLS policy on a CLIENT-SIDE insert.**

The sale door writes in two steps, and only the second is server-side:

1. **`ReceiptKeeper.tsx:438` — `supabase.from('receipts').insert(…)`, from the BROWSER, under
   RLS.** `receipts_member_insert` requires **`costs:create`**
   (`20260727_rbac_resource_action_flip.sql:116-117`). There is no handler here to add a gate to —
   **the enforcement IS the policy.**
2. `POST /api/customers/create` with the `receiptId` → service key (bypasses RLS) → `orders` +
   `order_items`.

🔴 **So a manager holding `orders:create` and not `costs:create` is refused at STEP 1, before any
handler is reached.** Adding `orders:create` to the handler is necessary and **not sufficient**;
on its own it would produce a gate that reads correct in the spec and still refuses the exact
person the ruling admits.

**Two ways out, NEED → WANT (OP-8) — David's call, not decided here:**

- **NEED (cheapest, no migration, available today):** the sale door's document write goes
  **server-side** through a service-key handler gated on `orders:create` — the shape the order
  write already uses. `receipts` RLS is untouched and keeps guarding the purchase door's client
  insert. **Rides an existing endpoint** (`customers/create` already takes the receipt id;
  `receipts/ocr.ts` already has a `shape` seam), so **no api/ function is minted** against a
  directory at **12 of 12** (§6 r11).
- **WANT (durable, a MIGRATION):** a document-kind column on `receipts` + kind-scoped INSERT
  policies — `costs:create` for a purchase, `orders:create` for a sale. This puts the rule **in
  the database rather than in a handler**, which is [[R-9]]'s own shape (*a confidential column is
  enforced in the database, not by a linter*). ✏️ **It converges with [[R-50]] anyway:** pinning
  the door at capture requires a kind column, and `receipts` has none — **21 columns, measured, no
  `origin`/`shape`/`source`/`doc_type`/`document_type`/`kind`.**

---

#### ⚠️ ONE LIVE FACT THE OWNER-TEST CARD MUST NOT TRIP OVER

**LAWNS's only MANAGER row is `active = false`.** So the ruling's own scenario — *a person who may
sell and may not see cost* — **cannot be owner-proven on this tenant today** without activating
that row or seeding a member. A card written against it would report a pass over an unreachable
state, which is the [[R-33]] defect wearing a checkmark. **The card says `needs-test` with that
reason, or the row is activated first.**

_Probe: read-only, run 2026-09-02, not retained as a script (it asserts nothing repeatable — its
value was the one-time answer). Re-derivable from `business_members` + `has_permission_for`._

### 7 · Blast radius

| Surface | Count | Detail |
|---|---|---|
| Code references to `receipts` | **101** across 48 files | `packages/`, `api/`, `scripts/` |
| Table writers | 1 | `ReceiptKeeper.tsx:438` |
| Table readers | 3 | `customers/create.ts`, `ReceiptsList.tsx`, measure script |
| **FKs → `receipts(id)`** | **4**, all `ON DELETE SET NULL` | `business_inventory` · `cost_objects` · `business_service_log` · `orders` |
| Storage bucket `'receipts'` | 3 policies, defined twice | `20260613_receipts_storage_rls.sql`; re-created `20260622_is_active_member_canonical_rls.sql:222` |
| Table RLS policies | 6 | 2 owner (`20260612`) + 4 member (`20260727:113-122`) |
| Route · tile · nav node | 1 each | `router.tsx:230` · `tileRegistry.ts:170` · `:766` |
| Permission manifest | route named in the `costs:*` bundle text | `permissionManifest.ts:898` |
| Caps needing update | 4 | `verify-field-lists.mjs` (declares the `receipts` projection, tech-debt #120) · `verify-write-paths.mjs` · `verify-cost-objects.mjs:154-164` (asserts the FK by name) · `verify-universals.mjs` |

🔴 **A rename is the expensive option and buys nothing David asked for.** Under the ruling the table is
*correctly named*: a purchase record called `receipts` is right, and the bucket holds photographs of purchase
documents. **Nothing needs renaming. The split is additive.**

---

## PART 2 — THREE LENSES (§17 / OP-8)

**HAVE** — one capture pipeline, one door-agnostic write, and a classifier that already runs and is discarded
(`ReceiptKeeper.tsx:305-306`). Launch context already travelling in `location.state.from`, already read at
`:144`, consumed only by a log. `orders` fully equipped for a captured sale, proven by 30 live rows, 11 from
this exact path. Ten capture-evidence columns, on `receipts` only. 17 receipts: 9 misfiled sales (all with
correct orders), 8 correct purchases (2 of which wrongly produced orders — the bwi pair). **Four empty seams:**
`cost_objects.receipt_id` 0/5, `business_inventory.receipt_id` 0/447 (tech-debt #144).

**NEED** *(irreducible minimum for the ruling)* —
1. The destination is **decided at launch**, not inferred from a photo, and reaches the write.
2. Outgoing ⇒ an order and **no** `receipts` row. Incoming ⇒ a `receipts` row and **no** order.
3. The sale's capture evidence is retained — because `accept_vs_edit` = `edited` on **17 of 17**, so the
   original read is load-bearing *today*.
4. A sale capture must not require `costs:*`.
5. Where no launch point exists, **ask** — [[R-50]].

**WANT** *(labelled — end-state, not requirement)* — a `captured_documents` row holding image + provider
envelope + parsed document + accept/edit + reconcile evidence, with `receipts` and `orders` both pointing at it;
`receipts` narrowed to a purchase record whose lines carry a destination ([[R-46]]–[[R-49]]); the launch point a
first-class `capture_intent` threaded door → row; breadcrumb and copy reading that intent; the count-once seam
finally wired to a `receipt_id` that means one thing.

---

## PART 3 — OPTIONS, NEED → WANT

**A · Thread the intent, split the write. No schema.** Launch context → a real `captureIntent` → `doSave`
branches. Sale evidence **not retained** — the contrarian's *"retain nothing"*. Satisfies NEED 1/2/4/5,
**fails NEED 3**, strands the nine legacy rows with no successor shape.

**B · Thread the intent + `captured_documents`. ✅ CONFIRMED BY DAVID 2026-09-02, subject to §5 below.**
A, plus one **additive** table (image, `ocr_raw`, parsed document, `line_items_original`, `amount_original`,
`accept_vs_edit`, the four reconcile columns) and nullable `captured_document_id` on both `receipts` and
`orders`. `receipts` keeps its ten columns untouched — nothing dropped, nothing rewritten, and the nine legacy
rows can be pointed at their evidence without being moved. Satisfies all five NEEDs.

**C · B, plus retire the ten columns from `receipts` and migrate the nine.** The clean end-state. Costs a data
migration on live rows, touches four caps and the `verify-field-lists` declaration, and **cannot land until the
four duplicate rows are settled** — the same block as tech-debt #143 and #58. **Not this build.**

**Why B, on a measurement rather than a preference:** `ocr_raw` holds only the raw provider envelope, so the
parsed document exists nowhere after the confirm screen closes. **B is the only option that satisfies the ruling
and stops that loss.** A stops the loss for sales by never capturing them.

🔴 **BINDING ADDITION TO B (David, 2026-09-02).** During the overlap the capture evidence exists in **two**
places — `receipts`' ten columns and `captured_documents`. **The Stage 1 spec must state WHICH IS AUTHORITATIVE
and route all new writes to one of them only.** Two homes for one fact is how the next session inherits a guess,
and it is the shape this session has already named twice (`ocr.ts:341`'s double derivation; the function-count
contradiction in Part 5).

---

## PART 4 — STAGE 1 SEQUENCING (scope only — NOT built, and HELD)

1. **Story first (§9 gate) — BLOCKING.** The upstream match is *"Snap a document, let TRACE route it"*
   (`user_stories.md` → `## ARC: ocr-doc-routing`). It is `STATUS: needs-input`, `MAPS-TO: —`, and its body says
   *"type-inference and fan-out routing are the gap."* That is this build, described as a placeholder awaiting
   David's prose, **and it does not contain the purchase/sale ruling.** Per the gate this is NO-MATCH-in-practice:
   **David dictates the prose before the build spec exists.**
2. `captured_documents` + the two nullable pointers. Additive, gated migration, authoritative-home stated.
3. `captureIntent` threaded door → component → write, replacing the discarded `enteredFrom` and `docType`.
   Where absent: **ask** ([[R-50]]).
4. Split `doSave` into two destinations; collapse `ocr.ts:341`'s second shape derivation while the file is open
   (§1.6 item 2).
5. The permission dimension — **blocked on ruling (d)**.
6. Breadcrumb reads the intent, not the pathname.
7. **The nine legacy rows — propose, do not execute.** Stable, orders correct and complete, no unique constraint
   objects. Proposal: point them at a `captured_documents` row and mark them superseded. **Do not delete, do not
   move** — mark-deleted only.

**Explicitly untouched:** the two bwi orders `dc943a79`/`eb3ab2b0`, their deliveries, both duplicate pairs.
⚠️ **Correction to the prompt's framing:** there are **two** pairs and only one carries the overstatement —
bwi 2026-07-29 $1,283.88 (**both produced orders** → tech-debt #143's $1,283.88) and Bailey Bark 2026-07-07
$2,316.03 (**neither produced an order** → no revenue effect). No cost destinations (#144). No dedup index (#143).

⚠️ **`1331` now has an address.** Receipt `b45ff79d`, 2026-08-25, $5,466.63 → order `432d30ae`,
`source_document_number = '1331'`. A self-vendor row, so a sale — but its number breaks the `3648.xxx` scheme
the other eight of the nine follow. **Named, not investigated.**

---

## PART 5 — THE FOUR OPEN RULINGS (Stage 1 is HELD on these)

| | Ruling owed | State |
|---|---|---|
| **(a)** | 🔴 **THE STORY.** `ocr-doc-routing` is `STATUS: needs-input`, `MAPS-TO: —`, and does not contain the purchase/sale ruling. The §9 gate blocks. **David dictates.** | **BINDING** |
| **(b)** | **Option B** | ✅ **CONFIRMED 2026-09-02**, subject to the authoritative-home clause |
| **(c)** | **R-54** (not R-52 — taken). Draft: *"TRACE SURFACES; IT DOES NOT ADJUDICATE."* | **WITH DAVID** to mint or discard |
| **(d)** | 🔴 **THE PERMISSION DIMENSION.** Lightning's read, for David to overrule: **a sale capture gates on customer and order authority; `costs:*` stays with purchases.** Not Thunder's to decide and not Lightning's. | **OPEN** |

> **UPDATE 2026-09-02, same day — (a) and (d) are CLOSED by David; (b) was already confirmed; only (c) remains.**
> **(a)** David dictated the story and it is filed verbatim as **`Snap a document, and it goes where it belongs`**
> (`user_stories.md`, `ARC: ocr-doc-routing`, `STATUS: written`); the `needs-input` placeholder it supersedes is
> preserved in `## ARCHIVED`. 🔴 **It reversed the placeholder's premise rather than filling it in** — the
> placeholder had TRACE *"infer[ring] what kind of document it is"*, the story rules that **the door decides and
> where there is no door it ASKS.** The §9 story gate is clear. **(d)** answered in David's own prose —
> *"Selling does not require seeing cost."* — which is this table's own Lightning read, so a sale capture gates on
> customer and order authority and `costs:*` stays with purchases. ⚠️ **It is not yet a numbered `R-` row:** the
> mint (R-55) is David's, and the live defect stands until a build lands it. **(c) R-54 is still WITH DAVID.**

### The R-54 draft, unfiled

Checked against all 53 rulings and `DECISIONS-INDEX.md`. **The principle exists in three narrow instances and
has no platform-level row:**

- **D-5** — *"we surface, not reconcile"*, scoped explicitly to **cost events** and accounting treatment.
- **2026-08-23** — *"TRACE NEVER INITIATES AN OUTBOUND ACTION … TRACE may be the mechanism; the human names the
  moment."* Platform-level, but about acts that **leave the business**.
- **[[R-47]] / [[R-50]]** — *"never force a guess at capture"*, *"where none exists, ASK"*. **Capture-side.**

None covers a read-only screen declining to interpret what it shows.

> **R-54 — TRACE SURFACES; IT DOES NOT ADJUDICATE.** A screen shows what is stored and states what is absent.
> It does not label an absence a defect, infer a category the data does not carry, or render a conclusion the
> record does not hold. Where a reading is required, it is the owner's — TRACE may be the mechanism; the human
> names the meaning. The counterpart to *TRACE never initiates an outbound action*, on the read side.
>
> *Instance:* the receipts list says *"No order recorded for this receipt."* and stops — six of seventeen read
> as vendor purchase invoices that correctly should not become orders, **but that is a reading and the screen
> does not hold it** (#252).

---

## APPENDIX — MEASURED POPULATIONS (2026-09-02, read-only)

| Measure | Value | Population |
|---|---|---|
| `receipts`, all tenants / LAWNS | 36 / **17** | 36 rows read |
| vendor distribution, LAWNS | `LAWNS Tree Farm, LLC.`=9 · `bwi`=4 · `Bailey Bark`=3 · `Sudderth Brothers`=1 | 17 |
| **produced an order** | LAWNS 9/9 · Bailey 0/3 · Sudderth 0/1 · bwi 2/4 | 17 — **the prompt's table confirmed exactly** |
| receipts with >1 order | **0** | 17 |
| `accept_vs_edit` = `edited` | **17** | 17 |
| `header_amount_edited` = true | **0** | 17 |
| `reconcile_status` = `match` | 17 | 17 |
| `receipts` live columns | 21; **no `origin`/`shape`/`source`/`doc_type`/`kind`** | 21 examined |
| `ocr_raw` top-level keys | `candidates, responseId, modelVersion, usageMetadata` — **raw provider envelope** | 17 |
| duplicate groups (vendor,date,amount) | **2** — bwi 07-29 $1,283.88 (both → orders); Bailey Bark 07-07 $2,316.03 (neither) | 17 bucketed |
| `orders`, LAWNS | 30 — **`order_kind='history'` on 30/30** | 30 |
| order status | `invoiced`=29 · `fulfilled`=1 | 30 |
| order source | `receipt_id`=11 · QBO import=19 | 30 |
| `order_items` on receipt-linked orders | 39 lines; **`business_inventory_id` NOT NULL on 0**; sku on 37 | 11 orders |
| `cost_objects.receipt_id` populated | **0** | 5 rows (all assets: tractor, backhoe, trailer, mixer, generator) |
| `business_inventory.receipt_id` populated | **0** | 447 rows |
| `api/` function files | **12 of 12 — ZERO headroom** | `find api -name '*.ts' -type f` |
| code references to `receipts` | 101 | 48 files |
