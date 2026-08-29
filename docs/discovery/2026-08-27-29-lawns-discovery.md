# DISCOVERY SESSION — 27 to 29 August 2026
## Findings, rulings, owed actions, and the document-update register

> **FILED 2026-08-29 (ledger #232).** Authored by David from three days on site and in the data.
> Filed here, with a pointer in CLAUDE.md §10, so it loads **deliberately** rather than by accident.
> **Two corrections were applied at filing and are marked `⚠️ CORRECTED AT FILING` in place** — §4.1
> and §7.3. Nothing else was altered.

**Tenant under test:** LAWNS Tree Farm, LLC — `ed2e5933-45dc-4b9b-a331-ddfd125e7a74`
**Other tenants:** Test Dave's Tree Nest `f7ec5d67-a9ef-4cb0-b807-438d67687d1b` · Test David's new Business `06065fe7-95cd-4698-a969-d93769e70921`

**Purpose of this document.** Three days produced more findings than any prior week, most of them from live customer use rather than from code review. This is the single reference for what was learned, what was decided, what shipped, and what is still owed. It is written so Thunder can read it at session start and so no finding has to be rediscovered.

> ⚠️ **Provenance marking.** Statements are marked `[MEASURED]` where a query, a log or a file proved them; `[STATED]` where David, Lauren or Terry said them; `[INFERRED]` where it is a reading that has not been proven. Do not promote an `[INFERRED]` line to fact without checking it.

---

# PART 1 — THE RECURRING PATTERN

**Eleven instances in three days of the same defect: a written declaration that nobody checked against reality, steering a decision.**

| # | The declaration | The reality | Cost |
|---|---|---|---|
| 1 | `STATUS: needs-build` on three stories | absent from the documented vocabulary and from the filter | three stories unreachable on the owed view |
| 2 | Four-status order filter | twelve live `invoiced` rows | caught before shipping |
| 3 | `ALL_STATUS_VALUES` omits `deleted` | `soft_delete_inventory` writes it | a deleted row that can be neither filtered to nor away |
| 4 | Story: "owners unaffected (gated by owner_id)" | retired by the 2026-07-30 ruling | false on the board for eleven months |
| 5 | `verify-authority-checks` prints known-gap P5 every run | STAFF can write the PMI schedule | a warning nobody acted on |
| 6 | `TRACE-SESSION-BOOTSTRAP.md:54` "No per-branch previews" | two Ready preview builds existed | forced a merge-before-test sequence that was never necessary |
| 7 | Story `:623` "QB integration is create-ONLY … no read-back" | D-47 read-back shipped a month ago | nearly caused a second Intuit client to be written |
| 8 | Lightning: "there is no read path to Intuit" | `cultivar.ts:74` already runs a query GET | inference from a true statement about POSTs |
| 9 | `inventory-env.md:31` sole record of `QBO_ENVIRONMENT` | stamped 2026-06-13; David had the answer, the doc did not | a sandbox read would have returned a confident wrong answer |
| **10** | **§7.3 "`inventory_counts`/`inventory_count_sessions` are still OWNER-ONLY"** | **`20260626:54` and `:95` create `_member_all` on both** | **would have built a policy that already exists, and delayed the voice build behind a phantom blocker** |
| **11** | **"the QuickBooks push is a deliberate step you can decline"** | **`submit.ts:1190` calls `pushQboInvoice` INLINE and UNCONDITIONALLY** | 🔴 **the mitigation issued to Lauren described a choice the product did not offer — the only thing between twelve `ItemRef` literals and a real company's books was that she had not completed a checkout** |

⚠️ **Instances 10 and 11 were added at filing.** #10 is this document's own; #11 is David's, the same day, and it is the one that nearly reached a customer. **Four of the eleven are Thunder's, several are Lightning's, one is David's, the rest are the documents' own. A rule that only catches other people is not this rule.**

**The rule that falls out, and it is the same one in every case:**

> **A claim must name what was opened to produce it.** A green check over an empty set is a failure. A filter list maintained in parallel with the data will drift. A document stating an environment variable is not the environment variable.

✅ **RATIFIED 2026-08-29 as ruling [[R-26]]**, with these eleven instances as its evidence. Its `GUARD` column reads `—`, and that is the honest answer: no cap reads prose, and all three mechanisable fixes below are unbuilt.

**Mechanisable fixes, none of them built yet:**

1. **Derive filters from the data**, unioned with the declared enum — already done on the orders page; owed on the inventory status filter.
2. **A check that the three authority sources agree** — if a permission is `enforced` in the manifest there must be a live policy reading it; if a policy fences on `owner_id` that must be a declared exception with a reason. *(This is what would have caught instances #4, #5 and tech-debt #124.)*
3. **Staleness detection on declaration docs**, linked to the file or screen they describe. *(Instances #6 and #9.)*

---

# PART 2 — WHAT SHIPPED

| Commit | What | State |
|---|---|---|
| `393682a` | **Pass 1** — a refused service write can no longer render as a saved one | ✅ deployed |
| `78bf37f` | **Pass 2 Stage 1** — the OWNER role can reach what the OWNER role holds | ✅ deployed; **migration APPLIED 2026-08-29**, owner floor verified at 57 across all four OWNER-role members |
| `fb1d7eb` / `8658bb4` | **Four-week operations calendar** | ⚠️ built on `feat/operations-calendar`, **unmerged**; its migration written, **not applied** |
| `bb622ff` | **#229 — the QuickBooks item list reads** (read-only, stores nothing, raw body captured outside the repo) | ✅ committed |
| `66d0aaf` | **The push can be HELD** — server half | ✅ committed *(attribution: written in a concurrent worktree, committed by the pagination session)* |
| `24ae201` · `61d84af` | **#230 / #231 — the lists prove they are the whole list; customers join; invoice history reads** | ✅ committed |
| `848ede6` | **The client half of the hold** — a held push said FAILED | ✅ committed |

## Pass 1 — the app stops lying about saves

`Settings.tsx` now decides whether the write landed (`if (error || !hit?.length)` with `.select('id')` for evidence, following the `DeliverySchedule.tsx:150` pattern) and a helper decides what the owner is told — one sentence per action in the button's own words, always ending "Nothing changed". Local state moves only after the write is proven. Red-first proven: 32 failures against the pre-fix file, three mutants each caught. Zero-row-writes baseline 78 → 75.

**The sweep found 19 client write sites that discard the answer.** Someone is watching at:

- `CampaignDetail.tsx:88` — byte-for-byte the Settings defect
- `ProjectsManager.tsx:102` — re-parents children to null before deleting a project, never inspected; a refused re-parent then a successful delete **orphans rows**
- `OnboardingWizard.tsx:560` — membership insert discarded; a silently-refused membership is **an owner who cannot get back in**
- plus `cultivar-os/Settings.tsx:79`, `Profile.tsx:544`, `BusinessAssets.tsx:151`, `OperatingCosts.tsx:200/:254`, `Dashboard.tsx:365/:376`, `PMI.tsx:270/:313/:431/:437`

Background (nobody waiting): `member_devices` last-seen/insert, `refresh.ts:49/:63`.

**Recommended next pass takes the three that corrupt or lock out** — `invitations.ts:68`, `ProjectsManager:102`, `OnboardingWizard:560` — because retrying cannot recover an orphaned or lost row, while a misleading screen is recoverable.

## Pass 2 Stage 1 — applied and verified

**Five additive policies**, all on the `service_offerings_member` shape (`is_active_member AND has_permission`), never `cultivar_plants`'s fused owner-OR-member, never keyed on `role = 'OWNER'`. Plus `create_invitation` (SECURITY DEFINER, the invite funnel), plus the OWNER floor 54 → 57 and every tenant re-materialised through `save_role_permissions('reset')`.

`[MEASURED]` **Post-apply state confirmed:** all four OWNER-role members across all three tenants carry `service_offerings:create`, `service_offerings:update` and `team:create`. No non-OWNER row holds any of the three. STAFF still 10, harness STAFF still 1, `test.obrien` MANAGER still 40, Joel still 25 and inactive.

**Still owed on this pass:** V5–V9 (the policy shape checks and the impersonated role checks), and the 8 owner-test cards.

---

# PART 3 — PERMISSIONS AND AUTHORITY

## 3.1 The root cause, finally measured

`[MEASURED]` **45 live policies fence on `owner_id` across 41 tables. Member policies exist on 17.**

`[MEASURED]` **`has_permission()` reads `business_members.permissions`** — a stored jsonb array — while the client computes `OWNER_LOCKED_SET` from the TypeScript manifest. **Two materialisations of one authority.** SQL cannot import a TS module. A manifest flip alone grows the client set and leaves the server at its old value: the client offers controls the database refuses.

> ⚠️ **Lightning's policy inventory was incomplete.** The third query filtered on `has_permission`, so it **missed member policies gated on `is_active_member()` alone**. The "24 tables with no member policy" figure is an overcount, and the risk runs both ways — some of those tables let **any active member including STAFF write with no permission gate**. **A third query is owed:** policies whose qual or with_check mentions `is_active_member` but not `has_permission`.

✅ **THE THIRD QUERY WAS RUN 2026-08-29, over the migration corpus. The risk that runs the other way is real and it is EIGHTEEN write-capable policies, not one — filed as tech-debt #124.** `business_inventory` is the one to look at first: any active member including STAFF can insert, update and delete inventory rows with no permission gate. **It is the exact mirror of what Pass 2 spent a build fixing** — that pass widened three surfaces that were too narrow, while eighteen tables sat too wide in the same schema at the same time. 🔴 **Confirm against the live catalog before acting: repo corpus ≠ catalog, and that limit produced instances #2, #3 and #9.**

## 3.2 David's ruling, 2026-08-28

> "Currently I'm the owner. Lauren needs all perms and authority to act. So changing a role from manager to owner is a decision the owner makes, then the new 'owner' can administer the system and assign all roles. Once the 'owner' leaves a new 'owner' can be promoted. If the original owner_id departs someone has to take that place. So the perms need allow the role to assume the perms within that role."

**The OWNER role carries full authority including assigning all roles.** `owner_id` stops being an authority mechanism and becomes the account holder of last resort. *(Filed as [[R-22]].)*

## 3.3 The cost of the defect, measured

`[MEASURED]` **Lauren made eight add attempts and one edit across two days and created nothing.** Logged saves 17:15:25, 17:15:35, 17:15:48, 17:19:01, 17:52:00 on 08-28, then 14:03:49, 14:03:57, 14:04:28, 14:04:32 on 08-29 — **the last four while seven installs were running.** `service_offerings` held exactly one row, created 17:33:46 at a moment with no logged save in her session: David's, from his own owner_id session.

**Two lessons, both owed as work:**

- 🔴 **A refusal that does not say who CAN do it generates retries.** Her Friday attempts came *after* Pass 1 deployed, so she saw "That service was not added. Nothing changed" — and tried four more times the next day. The message needs the actor: *you don't have permission to add services — David does.*
- 🔴 **The trace still logs intent without outcome.** `[TRACE:SERVICE] save` records the attempt; nothing records what happened. The question that was unanswerable Thursday was still unanswerable Saturday and took a database query to settle. **Pass 1 fixed the screen; the log still cannot answer "did it work".**

> ✏️ **This lesson was applied the same day, in the hold.** `pushHoldReason()` names the actor — *"David can lift the pause"* — and its test asserts it (`/David/`), specifically because of the eight attempts above. A refusal without an actor generates retries.

## 3.4 Rulings and findings inside Pass 2

- **No delete verb for `service_offerings`.** R2 already ruled it and named retire-by-flag; `toggleOffering` already *is* that. The hard delete was **already broken in both directions** — `order_service_selections.service_offering_id` is `NOT NULL` FK with `NO ACTION`, so it raised 23503 on any offering ever sold and permanently destroyed one that had not. **Removed, not gated.** Stated cost: a mistyped service can no longer be deleted; it goes Off and stays.
- **The invite is two writes.** `createInvitation` inserted the invitation row *then* an inactive `business_members` row; `acceptInvitation` requires that row. A member INSERT policy would have been a permission-granting side door — **the funnel trigger is `BEFORE UPDATE` only, INSERT is not covered** — taking its permissions array **from the browser**. `create_invitation` closes a hole that existed already.
- **Joel's row is not an orphan.** `invite_id` populated, `active = false`, `user_id` null — that is the normal pre-acceptance state. Lauren's row has an invite_id too. The `invitations.ts:68` rollback concern is **theoretical**, not confirmed.
- **`bm_self_select (user_id = auth.uid())`** is why the console reports `members: 1` and why Lauren could not see that Joel was already invited.
- ⚠️ **tech-debt #123** — an active STAFF member can **write** `business_pmi_schedule` (`FOR ALL` on `is_active_member`, no permission string, the last un-flipped DUAL_TABLES row). ⚠️ **It is one row of tech-debt #124**, and **#123 itself is cited by number in several places while not existing in `docs/tech-debt-log.md`** — the same drift as rows #85–#90.

## 3.5 Still open

- **Stage 2 is not built.** An OWNER-role actor still cannot assign a role. Both funnel RPCs hard-require `owner_id = actor`.
- **The Stage 2 guard, Lightning's call, overrulable in a line:** no actor may change the role of the `owner_id` holder.
- **Two decisions David has not made:** may an OWNER-role holder remove or demote the `owner_id` holder? And **how does `owner_id` actually transfer** when the original departs — no path exists in the code.
- **Three roster buttons** (`removeMember`, `setMemberActive`, `setMemberPhone`) were gated in Pass 2 but `removeMember` and `setMemberActive` are **access control, not data edits** and belong in the funnel.

## 3.6 The ownership-transfer question

`[STATED]` David is considering handing `owner_id` to Lauren.

`[MEASURED]` He has a member row in LAWNS (`c18a1d66`, OWNER, active, user_id = owner_id), so a transfer would not orphan him.

⚠️ **It probably should not go to Lauren.** `owner_id` answers *whose account is this* — the account belongs to LAWNS Tree Farm LLC, which is **Terry's**, and it is also who gets billed. Lauren **runs** the business; Terry **owns** it. The shape that matches the model: owner_id → Terry, Lauren holds the OWNER role, David keeps an OWNER-role membership as vendor support access.

⚠️ **It is a one-way door.** `businesses_owner_update` is `owner_id = auth.uid()`, so only the current holder can change it.

---

# PART 4 — QUICKBOOKS

## 4.1 State of the connection

`[MEASURED]` `QBO_ENVIRONMENT` is **production** (confirmed by David from Vercel; there is no sandbox company at all). LAWNS realmId `accounting_company_id = 9341455222430707`. `accounting_needs_reconnect = false`, `accounting_token_expires_at = 2026-08-29 16:33 UTC`.

**The date on that expiry is the proof:** Terry connected 08-27 and Intuit access tokens last about an hour, so an expiry stamped today means `refreshQBToken` has been running unattended for two days.

`[MEASURED]` **Nothing has been pushed to LAWNS's QuickBooks.** No invoice has been created since Terry connected, because Lauren's write permissions blocked it. **Their books are clean.**

🔴 **Pass 2 armed the landmine.** Fixing her permissions moved it from "eventually" to **the next checkout she completes.**

> ⚠️ **CORRECTED AT FILING — 2026-08-29. This section originally read: *"Interim instruction to Lauren: create orders freely, do not send them to QuickBooks yet."* That instruction described a choice the product did not offer.**
>
> `[MEASURED]` **The push is INLINE and UNCONDITIONAL.** `api/orders/submit.ts:1190` calls `pushQboInvoice(orderId, businessId)` at the end of every checkout — no flag, no branch, no "send to QuickBooks" step. The 2026-07-27 comment there says why: the browser hop was *deleted*, not credentialed, because it was the last unauthenticated cross-tenant write. **So "do not send them" was not a thing Lauren could do; the only thing holding the line was that she had not completed a checkout.** This is instance **#11** of the PART 1 pattern and it is David's own.
>
> ✅ **THE MITIGATION IS THE SWITCH, AND IT IS BUILT.** `QBO_PUSH_HOLD` — an env var, unset/blank → no hold, `all` → every business, otherwise a comma-separated list of business ids. `isPushHeld()` guards **`pushQboInvoice` at the shared seam**, not the checkout call site, so **both doors close**: the inline push AND the manual re-push endpoint. A held push returns **409 `PUSH_HELD`**, deliberately not 503 — QuickBooks *is* connected, and telling an owner to reconnect it sends them to fix a thing that is not broken. The order completes and is correct; only the push is skipped. *(`66d0aaf` server half · `848ede6` client half — 30 probes, 5 mutants measured 4·1·2·1·1.)*
>
> ⚠️ **IT FAILS OPEN, STATED RATHER THAN HIDDEN.** An unset variable means no hold, because defaulting to hold-everything would silently stop pushes for every tenant on any deploy lacking the var. That is only honest because the hold is **VERIFIABLE**: `/api/qbo/status` returns `push_held`, read from the same variable through the same predicate in the same deployment. **Read it back after setting it — an env change needs a Vercel redeploy to take effect, and the only other way to confirm would be completing a real order against Terry's books.**
>
> 🔴 **THE INTERIM INSTRUCTION TO LAUREN IS NOW: nothing.** Set `QBO_PUSH_HOLD` to the LAWNS business id, confirm `push_held: true` on `/api/qbo/status`, and she can work normally. **Do not rely on a person remembering not to press a button that does not exist.**

## 4.2 The read path already exists

`[MEASURED]` Two files hold every Intuit call, **both server-side Vercel functions**: `router.ts` (OAuth) and `cultivar.ts` (push).

- **POSTs (2):** `cultivar.ts:229` customer create · `:737` invoice create
- **GETs (3):** `cultivar.ts:74` `select * from Customer` via `query?query=…&minorversion=65` · `:82` customer/{id} · `router.ts:244` companyinfo

**`SELECT * FROM Item` is line 74 with one word changed.** Helpers `qbGet`/`qbPost`. Nothing to build.

`[MEASURED]` Scope is `com.intuit.quickbooks.accounting` (`router.ts:21`, the only scope sent at `:98`) — read and write across accounting entities. **No new consent from Terry.**

`[MEASURED]` `bas_owner_all` **never runs on this path** — every handler builds its Supabase client from `SUPABASE_SERVICE_KEY`, which bypasses RLS. What gates it is `callerCan` from the Bearer token. `/api/qbo/status` uses `settings:read`, which Lauren now holds. **Not owner-only.**

## 4.3 🔴 The twelve literals — bigger and differently shaped than first described

All in `cultivar.ts`. **Only about five actually want an item id.**

**① Revenue lines that need a real Item id**

| Line | What |
|---|---|
| `:398` | 🔴 **The tree.** The goods line — the one that corrupts Sales of Nursery Stock vs Services |
| `:452` | service at retail baseline (price-override path) |
| `:494` | service line, subtotal > 0 |
| `:521` | legacy addon line |
| `:542` | legacy installation line |

**② $0 documentation lines — want `DetailType: 'DescriptionOnly'` and NO ItemRef at all**

`:444` netting declined · `:482` transport $0 · `:511` legacy netting declined · `:550` staff transport $0 · `:567` tax-exempt documentation. Mapping these to a revenue item makes a $0 note look like a service sale.

**③ Two that are the wrong SHAPE, not the wrong id**

- `:320` `discountLine()` — a negative SalesItemLine against a service item. QBO's construct is `DiscountLineDetail`.
- 🔴 `:580` **SALES TAX pushed as a SalesItemLine against item '1'.** QBO's construct is `TxnTaxDetail`. **This inflates revenue by the tax amount** and is arguably worse than the goods line — their P&L already carries $85,281 of sales tax.

**Dormant, named so a future grep does not rediscover them as live:** `shared/quickbooks/invoice.ts:90` (dead — calls an endpoint in neither `api/` nor `vercel.json`) · `packages/ignition-os/ExternalBridge.js:212` (frozen donor).

⚠️ **Line numbers are as of `78bf37f` and will drift.** Re-grep `ItemRef` before the mapping pass rather than trusting this table.

## 4.4 Approved and shipped

**Stage 1, option (a): items only.** One `case 'items':` in `router.ts` — `callerCan(settings:read)` → `readQBSecrets` → `refreshQBToken` → `qbGet('query?query=select * from Item&minorversion=65')` — plus one `vercel.json` rewrite. Zero schema, zero storage. Returns Id, Name, Type, IncomeAccountRef.name, Active.

⚠️ **Added:** write the raw response body to a file **outside the repo** and report the path. Customer accounting data — nowhere a commit can sweep it up, same class as the service_role JWT that sat in `.claude/settings.local.json`. A parsed view on screen is fine *on top of* the raw file, never instead. Keep the verbatim error body on failure too.

✅ **SHIPPED `bb622ff`, and ratified as [[R-23]].** Extended by `24ae201` / `61d84af` — pagination with a completeness claim, customers, and invoice history that says how far back it goes ([[R-24]], [[R-25]]).

## 4.5 Named, not fixed

- 🔴 **`router.ts:241-250` — the silent try/catch.** The connect callback's companyinfo verification is wrapped bare and falls back to the literal string `'QuickBooks'`. **A connection that cannot reach the company still renders "QuickBooks Connected!"** and the name is never stored, so there is no evidence in the database either. A Surface-Honesty defect in its own right. *(It is also the one remaining eslint `no-empty` in that file.)*
- ⚠️ `secrets.ts` still carries a pre-migration fallback read of the legacy `businesses.accounting_token` columns; its own header says remove once those are dropped.

## 4.6 The historical import

`[STATED]` Lauren is pulling historical invoices from QuickBooks. What David wants: a widget that passes line items into the correct columns and **captures the QBO id** so records cross-link; an FAQ that asks "is this your accounting system?"; a **view of the records after mapping and before accepting**; and however far back QuickBooks holds.

⚠️ **The QBO id is the idempotency key**, not just a cross-link — it is what makes a re-import safe and what the re-capture guard needs.

⚠️ **Which report matters.** The Invoice List gives headers — date, customer, total — which is the seasonality curve in *dollars*, not in trees. The export must be line-level with quantity and item: **Sales by Product/Service Detail** (confirm the name in their instance).

🔴 **Do not batch-download invoice PDFs and feed them through OCR.** It will be tempting because the OCR door works. It is lossy, slow, and it re-derives from images what QuickBooks already holds structured with its own id attached. **Never OCR your own accounting system.**

⚠️ **Preview-before-commit is now on its fourth caller:** contacts, inventory, vendor-term mapping, historical invoices.

---

# PART 5 — THE COST MODEL

## 5.1 The grow ladder — complete

`[STATED, Terry + Lauren]`

```
seed  →  SLIP (2×2 on a flat, a few weeks)
      →  #3/5 gal   (1 year, NOT FOR SALE)
      →  15 gal     (1 year)
      →  30 gal     (1 year)
      →  45 gal     → out the door
```

- **One year in each pot.** Roughly four to five years seed to 45 gallon; "two years" is seed to 15 gallon.
- 🔴 **The uppot window is SEASONAL, not a timer.** Fine in the container November through March, and the work must be done **before spring leaf-out** — everything is deciduous. **The schedule must offer a two-month window, not a date.**
- 🔴 **Uppotting takes a plant OFF the market for 6 to 12 months** until rooted. That is the `grow` field, and Terry's figure is a **range**.
- **What the seedling stage is for:** "to race it up to get a good straight trunk" — kept tight in the can, bamboo stake when they lean. A 5–6 ft sapling into a 15 gallon becomes a 6–8 ft tree with branching the next year.
- 🔴 **Lauren corrected Terry** on the slip step — he said they plant directly into 3/5. **Whoever enters the ladder needs Lauren on process detail and Terry on timings.**

**The two named exceptions, asked directly and answered:** all the **oaks** run within two or three months of each other, so one model covers them. **Mountain Laurel** is different. **Crape Myrtle** may need its own class. That is all — one default plus two exceptions, not 100 models.

**Crape myrtle is bought, not propagated** — "I don't root my own crape." 2–3 inch rooted cuttings, potted as late as June. So its ladder starts at an invoice date, which is the anchor the model needs.

## 5.2 The price ladder, end to end

| Rung | Cost | Source |
|---|---|---|
| Seed | ~$2 | Terry |
| 2" liner, unpatented | **$0.79** | Liner Source inv 495703, 4/21/25 |
| 2" liner, patented (royalty + tag) | **$1.95** | same |
| #3/5 gallon | **$45** | Terry |
| 15 gallon, installed | **$500** | Terry, and Lauren's own invoice line |

🔴 **The $0.79 mystery is solved.** Liner Source sold LAWNS 2-inch crape myrtle liners — Muskogee, Natchez, Tonto, Tuscarora, Twilight at **79 cents**; patented cultivars (Colorama Scarlet, Dynamite, Red Rocket) at **$1.95**. **The 79-cent Natchez in the catalog was never an error — it is the liner purchase price.** Those 77 "under production" rows are liner acquisition costs.

**Plant patents cost 2.5×** — same 2-inch liner, 79¢ unpatented against $1.95 patented.

**Full ladder in two documents:** Colorama Scarlet liner **$1.95** (April 2025) → sold as a 15-gallon at **$375** on Saturday's Garza order. ~6–8 weeks in the liner stage (invoice 4/21, potted by June), matching Lauren's "a few weeks".

## 5.3 🔴 The cost model already exists — as a spreadsheet

**Lauren's "Pricing Update / Inventory Spread Sheet"**, 215+ rows, one per purchase lot. Columns: Purchase Date · Product · Size · Vendor · Quantity · Price · Freight Per Tree · Total Freight · Total Cost Per Tree · Total · Retail Price · Install Price · "Price Tag?" · Contractor Price at 35/25/15/10%. Per-species tabs.

**The formulas, read off the sheet and confirmed across rows:**

- **Retail = total landed cost per tree × 3**
- **Price Tag = Retail × 2** (`=L202*2` in the formula bar)
- **Contractor price = Retail less 35 / 25 / 15 / 10 percent**
- 🔴 **Install Price = Retail + a flat fee by size: 15 gal +$150 · 30 gal +$300 · 45 gal +$450. That is $10 per gallon.**

**Placement is already priced separately in her spreadsheet** — it is only welded into the tree price when it reaches the invoice. Against contractor pay of $3.00–3.33 a gallon, **placement margin is roughly 3×**.

⚠️ "Price Tag?" carries a **question mark** in the header. Retail × 2 is a large markup and Lauren does not look settled on it. **Ask, don't encode.**

**This is not a model to design. It is a model to import.** It also names vendors no invoice has been seen for — **Better Trees** and **Nipp** — and contains at least one typo'd date, `6/3/0226`.

## 5.4 The P&L — Dec 2024 to Dec 2025, cash basis

| Line | |
|---|---|
| Income | **$1,698,889** |
| Sales of Nursery Stock | $1,521,592 |
| Delivery Income | **$99,509** |
| Landscaping/Installation Services | **$27,623** |
| Discounts given | −$18,558 |
| COGS — Contract Labor | **$229,163** |
| COGS — Trees & Plants | $366,086 |
| COGS — Production Costs | **$103,288** |
| COGS — Freight Contractor | $12,299 |
| Gross Profit | $988,053 (58%) |
| QuickBooks Payments Fees | **$36,735** (2.2%) |
| Net Income | **$411,798** (24%) |

**🔴 Installation revenue is buried in tree sales, and their own books prove it.** Landscaping/Installation books **$27,623** against Contract Labor COGS of **$229,163** — they pay contractors **eight times** what they book as installation revenue. That is only possible if the install is inside "Sales of Nursery Stock", exactly as the invoice line "(Install & Warranty)" showed. **Breaking placement out is correcting a misstatement in their own P&L.**

**Four confirmations of the same fact, from four directions:** the invoice item name · the P&L ratio · Lauren's spreadsheet pricing install separately · and Terry's own sales patter — *"$400 … what if I plant it myself? … $200 off."*

**Other reads:**

- **Delivery income is 6% of revenue** and nobody has costed it. Freight Contractor COGS is only $12,299 because that is *inbound* haulage; their own outbound cost is scattered through auto expense, fuel and wages.
- **QuickBooks Payments fees $36,735** makes Lauren's "different payment method if it were easier" a real business question — half a point is $8,500 a year.
- **The COGS split IS the cost-to-produce structure**, already in their books: Trees & Plants = originCost · Production Costs = material and hours per rung · Contract Labor = placement.
- **A "Production Costs" line of $103,288 only exists if they grow**, which is the strongest evidence for propagation.

## 5.5 Mortality and loss

🔴 **Mortality is a cost-model input, not a tax item. The survivors carry the dead ones' cost.** Buy 180 Natchez liners at 79¢ and sell 150 and each survivor cost 95¢, not 79¢. Across a two-to-four-year ladder a cumulative loss rate changes cost-to-produce at every rung. **Nothing in the model accounts for it.**

**On "does the cost transfer" — nothing transfers, the denominator changes.** The lot spent $X and yielded N sellable trees, so unit cost is X ÷ N. For pricing, absorption is mandatory.

🔴 **Which makes the LOT the costed object, not the tree.** Each lot carries its own purchase price, allocated freight, losses and therefore unit cost. **This makes the voice-walk finding load-bearing** — three Eagleston Holly 30-gallon stops are three lots with three different unit costs, and merging them destroys the number.

🔴 **Not every negative variance is a loss.** 30 → 20 could be ten died, ten sold and never recorded, an original count that was wrong, or ten moved to another lot. **The reconcile Accept needs a reason, and the reason routes the entry.** Treat every shortfall as a loss and you overstate mortality while understating sales.

**Why Terry cannot count trees as a loss** `[INFERRED, and a CPA question]`: the statement is cash basis and COGS Trees & Plants means the trees were expensed the year they were bought. When one dies there is nothing left to deduct. **You cannot write off what was never capitalised** — and the same fact means his **inventory carries zero book value**, which is what "I've been slapped in the face" over inventory value means.

## 5.6 Propagation and parent trees

**LAWNS propagates from seed**, which Terry says most growers cannot do. **Named parent trees:**

- **Lacey Oak** — acorns from trees in the parking lot of Brooklyn Heights Pizza, corner of Bristol Falls and Lake Line
- **Shumard Red Oak** — his daughter's front yard, two miles from the farm
- everything else from their own trees at the farm

⚠️ Both an asset worth recording (a parent-tree registry with species and location) and **a sales story he already uses** — *"if you want to see what this tree will look like in a few years, go look at those."*

**Free trial stock:** on two Greenleaf invoices, five patented cultivars ship 3 each at **$0.00 merchandise**, freight only — Crown Point, Grace, Monarch and My Lady Purple Holly, and Stellar Ruby Magnolia. Someone is evaluating new cultivars three at a time.

---

# PART 6 — PURCHASE INVOICES AND THE CAPTURE SPEC

**26 invoices in hand across ~15 vendors, roughly $229,000 of purchases Feb–June 2026**, plus a P&L and Lauren's pricing spreadsheet.

**Vendors:** Athens · Backbone Valley · CC Tree Farms · Cedar Creek (Austin Landscape) · Enchanted Trees · Greenleaf · Hand Tree Farm · Archer2 Transport · Just Trees · KBB · KBE Trucking · La Escondida · McGill · Mexia · Top Notch · Liner Source.

## What the capture must handle — every item from a real document

1. 🔴 **Handwriting.** Enchanted Trees and Hand Tree Farm are carbon-copy forms — cursive, checkmarks, margin arithmetic in green pen.
2. 🔴 **A struck-through line must not be captured.** Hand Tree Farm 2-16-2026 page 2 has "Sweet Bubba Desert Willow 30g, 30 @ 130 = 3,900" crossed out in red and the subtotal corrected 17,072.50 → 13,172.50. **Reading it overstates that purchase by $3,900.**
3. 🔴 **Handwriting on a PRINTED invoice may be the BUYER's own notes.** McGill invoice 0129 carries number triplets beside every line (250/180/155, 300/180/155) — LAWNS's own retail price ladders, not invoice content.
4. 🔴 **One shipment = multiple documents.** The Hand 2/20 delivery has an acknowledgment (2-16), a *received* ticket (#228851, quantities and checkmarks, no prices), **and a third-party freight invoice from Archer2 ($955)**.
5. 🔴 **Freight is sometimes a separate vendor, and can span vendors.** KBE Trucking 5107, $1,000, "Freight to Deliver Trees: from Athens **and** KBB Tree Farm".
6. **Ordered vs shipped vs received are three different numbers.** Enchanted's form has separate ORDERED and SHIPPED columns.
7. 🔴 **Duplicate files.** `CC_Tree_Farm_3_27` and `CC_Tree_Farms_3_25_26` are both invoice 501226. `Hand_Tree_Farm_3_4` and `..._Shipment_2` are both 2282.
8. 🔴 **Terry specified the re-capture guard himself, and his key is CONTENT not invoice number:** *"same date, same items, same count — we only want it once"*, and it must reject even if someone deliberately enters it twice. That rule catches both duplicate pairs and correctly does **not** false-positive on the two Greenleaf 135-cherry-laurel invoices, which carry different dates.
9. 🔴 **The vendor's name is not LAWNS's name.** CC sells "EASTERN RED CEDAR #30 'Brodie'"; the counted inventory row reads "Brodie Juniper 30 gallon". Same tree.
10. 🔴 **LAWNS appears under four names** at 400 Honeycomb Mesa — LAWNS Leander Nursery Supply · Lawns Tree Farm · Leander Area Wholesale Nursery Supply · Lawns Leander Wholesale Nursery Supply — plus punctuation variants (L.A.W.N.S., "Lawn Tree Farm"). **These are their own historical names and vendors still bill under them.** `[STATED]` L.A.W.N.S. is almost certainly the acronym of Leander Area Wholesale Nursery Supply.
    - **The capture must not identify the tenant by bill-to name.** On a purchase invoice the bill-to is *us*. The stable identifiers are the **address** (on every invoice) and the **per-vendor customer number** (Greenleaf 62171).
    - **Onboarding requirement:** a business needs an "also known as" list captured **at setup**.
11. 🔴 **Athens / KBB / KBE are one operation** — 9780 and 9782 CR 4530, and KBB's invoice carries `office@athenstreefarm.com`. The vendor-side mirror of the same problem.
12. **Six size vocabularies:** #30/#45/#15 · #3/5 and #25/30 as ranges · 24" box and 15# · "30 Gal" · gallon/3GP/10.0 Qt on tags · 1DP/2DP/3DP/2GP/3GP from Greenleaf.

## Money worth a second look

- ⚠️ **Hand Tree Farm 2282** totals $17,382.50, is annotated "5% disc", and the deduction taken is **$86.91**. Five percent is $869.13. The other Hand document does it correctly (42,075 × .95). **Looks like a decimal slip worth ~$780** — Terry's eye, not software.
- 🔴 **Same tree, two vendors, 61% apart:** 100-gallon Eagleston Holly Tree Form — KBB **$450** (April), Enchanted **$725** (June).
- **Inbound freight per mile:** Backbone $3.00 · McGill $3.50 · La Escondida $5.00. Flat: Mexia $800 · Top Notch $710 · Just Trees $500 · Greenleaf $1,015–1,725. LAWNS charges $3.50–4.50 outbound.

---

# PART 7 — INVENTORY AND CAPTURE

## 7.1 The gap, measured

`[MEASURED]` **447 rows. 443 depleted, 1 archived, 2 available.** A single voice walk counted **~275 trees across ~20 lots.**

`[INFERRED]` **Standing inventory is likely five figures.** COGS Trees & Plants $366,086 at a rough $50 average is ~7,000 units bought annually; one Liner Source invoice alone was 1,680 liners; unit sales are plausibly 5,000–8,000 a year. Across a 2–4 year ladder, **the voice walk covered perhaps 2–3% of the lot.**

⚠️ **That changes the tool.** Counting the farm is a multi-day job across hundreds of lots — so the reconcile screen must handle a count that **spans days**: resumable sessions, partial progress, knowing which rows have been walked. **That was not in the spec.**

## 7.2 Voice is the capture mode

`[MEASURED]` Lauren and David inventoried a large part of the lot **by talking** — no scanner, no tablet, no typing. **This sidesteps the tag problem entirely:** you cannot scan a QR that is not printed on the tag, but you can say the name.

🔴 **The transcription errors are exactly the fuzzy-match cases the resolver has to handle anyway:** "Eagle and Holly" → Eagleston · "Brody" → Brodie · "Nelly Stephens" → Nellie R Stevens · "little Jen" → Little Gem · "show Creek" → Shoal Creek · "blue eyes" → Blue Ice. **One resolver, three callers** — invoice OCR, vendor lines, voice.

**Five error modes from one real recording:**

1. They count aloud and only the **spoken total** matters
2. A lot is counted in **two halves** either side of an aisle and summed aloud
3. **Mid-count corrections** — "I'm sorry, we have one of those"
4. Size is often **carried over**, not restated
5. 🔴 **They confused two varieties of one species mid-count** — Carolina Sapphire and Blue Ice Arizona Cypress — and had to stop and ask which. **That is why the confirm step is not optional.**

## 7.3 What Thunder found (Stage 0, voice build)

- ⚠️ **Premise corrected:** the OCR path does **not** resolve names to catalog rows. `ocr.ts` extracts fields and stops. The real resolver is `stockLineResolver.ts:180`.
- 🔴 **It missed six of six spoken strings.** Not near-misses — eagle≠eagleston, brody≠brodie, jen≠gem are different tokens, so the doc's unbuilt subset and stemming layers would not save them. Needs phonetic/edit-distance, which exists nowhere.
- 🔴 **Recommendation (David's call outstanding): option (b)** — let the transcription model propose the catalog name with the catalog in the prompt, and use the resolver only to confirm the exact string. **Reason: blast radius.** A fuzzy layer inside the shared ladder changes matching for the **CSV importer** and the **scan path**, which currently fail closed and did not ask to start guessing. One rule: **propose a catalog name OR say unknown, never force.**
- ✅ **The handoff seam is a table:** `InventoryReconcile.tsx` reads counted numbers from `inventory_counts`. `inventory_id` is nullable with `item_label` NOT NULL plus `was_unknown` and `raw_scan`, so the "19 × 30 gallon, no variety spoken" row **has a legal home and already renders**. Rows are per-session and append-only with **no dedup** — three Eagleston Holly stops stay three rows.
- 🔴 **tech-debt #67:** `InventoryCount.tsx:438` calls `count_reconcile_inventory` **at capture**, so a phone count applies itself and reconcile's residual is 0 by construction. ~275 trees would hit the ledger before Lauren saw a screen. **The voice path can simply not call the apply RPC** — inserting `inventory_counts` rows and stopping is blind capture by construction.

> ⚠️ **CORRECTED AT FILING — 2026-08-29. This section originally read: *"BUT `inventory_counts` and `inventory_count_sessions` ARE STILL OWNER-ONLY. Pass 2 did not cover them. As things stand, Lauren walking the lot would record nothing. The voice build is blocked on that policy or needs its own definer RPC."***
>
> `[MEASURED, migration corpus]` **Both tables carry a member policy and have since 2026-06-26.** `20260626_inventory_count_sessions.sql:54` creates `inventory_count_sessions_member_all` and `:95` creates `inventory_counts_member_all` — both `USING` **and** `WITH CHECK` on `is_active_member(business_id)`, no `FOR` clause (so ALL), and **neither is dropped or altered anywhere else in the corpus.** Alongside the `_owner_all` policies, not instead of them.
>
> **So build #2 is very likely unnecessary and the voice build is very likely unblocked.** This is instance **#10** of the PART 1 pattern.
>
> 🔴 **BUT DO NOT CANCEL #2 ON THIS PARAGRAPH EITHER — repo corpus is not the live catalog, and that limit is what produced instances #2, #3 and #9. DAVID RUNS THIS, AND THE ANSWER GETS WRITTEN HERE:**
>
> ```sql
> SELECT tablename, policyname, cmd, qual, with_check
> FROM pg_policies
> WHERE schemaname='public'
>   AND tablename IN ('inventory_counts','inventory_count_sessions')
> ORDER BY tablename, policyname;
> ```
>
> **RESULT: _____________ (unrun as of filing).** If `_member_all` is live → build #2 is CANCELLED and the voice build is unblocked. If it is not → the original paragraph stands and #2 is real.
>
> ⚠️ **These two tables are also rows 13 and 14 of tech-debt #124** — `is_active_member` with no permission string means any active member including STAFF can write them. **For counting, that is the behaviour we want; it is listed there for completeness, not as a defect to fix here.**

- ✅ **Offline is settled:** two stores exist and the split is deliberate. The **audio blob goes in IndexedDB** on the `assetBlobStore` pattern — one recorded walk would blow the ~5 MB localStorage budget on its own.
- ⚠️ **Nothing in the repo transcribes audio.** Three near-misses: `RhythmLogger.tsx` (live, Web Speech API, a research instrument not a component) · `AIEngine.ts:55` declares `voice_transcribe` → whisper-1 but is **dark** (no `api/ai/*` route) · `~/whisper-local/` outside the repo.
- ⚠️ **A new api function is justified** rather than riding `receipts/ocr.ts`: that gates on an image/PDF allowlist, routes to Gemini-vision then Claude-vision, **Claude accepts no audio**, and its 10 MB ceiling is low for a long walk.

## 7.4 The status filter (Pass 3, not started)

🔴 `deleted` is absent from `ALL_STATUS_VALUES` (available · depleted · damaged · returned · archived), so a deleted row can be **neither filtered to nor away**. Lauren found her own workaround — she flipped the harness lot from `deleted` to `archived` at 18:12 on 08-28.

⚠️ **The `dup-size` flags may not be errors.** Six collisions are flagged (lacey-oak/45 Gallon, lacey-oak/30 Gallon, chinese-pistache/95, japanese-black-pine/45, natchez-crape-myrtle/30, mexican-buckeye/10-15) — but the voice walk counted **Eagleston Holly 30 gal in three separate places**. **In the data a duplicate and a second lot are indistinguishable.** Do not "fix" them.

**Fix shape:** derive filter options from the statuses actually present, unioned with the declared list — the pattern already shipped on the orders page. Deleted rows default **out** with a visible count of what is hidden.

## 7.5 Tags

`[MEASURED]` **LAWNS's own yellow price tags carry no QR and no barcode** — printed text only. Only the vendor's white tag has a barcode. So the on-lot QR plan requires either new tags or a reader that reads printed text.

---

# PART 8 — OPERATIONS, SCHEDULE AND THE CALENDAR

## 8.1 Lauren's day types — hers, not a proposal

| Day | Type |
|---|---|
| Monday | service / maintenance |
| Tuesday, Wednesday | delivery only |
| Thursday–Sunday | delivery / placement |

⚠️ Her Google Calendar shows **"Lauren Off" every Sunday and Monday**, recurring — which reconciles because **the day types describe what the CREWS do, not what Lauren does.**

**Recurring obligations already on her calendar and belonging on the four-week view:** payroll weekly Wednesday · "CHECK BWI BILLING!!!" weekly Wednesday · sales tax monthly · US holidays.

⚠️ Her calendar **mixes personal and business** (PTA meeting, birthdays, a "ZACH" calendar). **TRACE's calendar must be the operations calendar, not a replacement for Google Calendar.**

## 8.2 The calendar build (on branch, unmerged)

**Shipped on `feat/operations-calendar`:** four-week grid (current week first, Sunday-based, reusing `weekWindow`/`ymd`), exception-wins day-type resolution, and `conflictsFor` — the mismatch, naming the work: *"Monday is a service / maintenance day — 4 deliveries scheduled"*. `/delivery-schedule` becomes the calendar; the day-grouped list becomes its drill-in. Warns, never blocks.

**🔴 The finding worth more than the build:** the red-first harness passed 9 of 10 and **the miss was the honest one — every probe stood at noon**, where a `toISOString()`-derived "today" still lands on the right local date. **It stops landing there in the evening**, which is when someone checks tomorrow's schedule. Probes added at 21:00 and 01:00.

⚠️ **This is not confined to the calendar.** `dashboardWindows.ts` is shared, so the dashboard tiles and the delivery day view may carry the same defect. And `quality-baseline.json` **stamps UTC** — it wrote 2026-08-29 while David's clock read the 28th. **Third surface. It is in the test infrastructure too.**

**Stage 0 corrections:**

- 🔴 `business_pmi_schedule` is **not** owner-only — it carries `business_pmi_schedule_member_all`, `FOR ALL` on `is_active_member` with **no permission string**. The widening runs the other way (tech-debt #123, and one row of #124).
- 🔴 **PMI contributes nothing to the calendar, and for a DATA reason:** the table has **no date column** — the due date derives from `pmiStatusFrom(interval_days, last_service_at)` and **`last_service_at` is NULL on all three rows**. `business_service_log` has **zero rows platform-wide**.
- 🔴 **`orders.delivery_date` is a THIRD dated source**, 27 populated. **On Test Dave's it is the only record of 18 stops** — zero of their 15 `deliveries` rows carry an `order_id`. A union of `deliveries` alone hides them; a union of both double-counts. **No natural key exists to dedupe on** (tech-debt #108, #122).
- 🔴 **Joel has no auth user at all** — `active = false`, `user_id = NULL`. **The person this screen is built for renders zero rows on every surface in the platform.**
- ⚠️ **The conflict flag has nothing to fire on** — every tenant is conflict-free in the four-week window. The acceptance card must **create** a conflict on Test Dave's.

## 8.3 The spray and chemical compliance domain

`[STATED]` **Terry does almost nothing preventative** — "we just kinda see things and we react to it". Only fungicide.

- The horticulturist is pushing preventative: **systemic insecticide plus copper in March** heads off crape myrtle scale and aphids for the season.
- 🔴 **Chemical rotation is a hard requirement** — pests build tolerance. **The system must show what was applied two weeks ago so a different product is chosen.** A record with a purpose, not a log.
- 🔴 **Texas Department of Agriculture recordkeeping.** What product, when, by whom. **Terry was fined $800** last week. Chemicals are on a shelf and should be in a locker. A **spray licence** is needed; the horticulturist intends to get one.
- **Untreated right now:** the greenhouse crape myrtles, and the redbuds have aphids.
- ⚠️ Disease is **species-specific**, so a reference library of common diseases per species is generatable content with owner confirmation.
- `[STATED]` David's idea: contract spraying to a named vendor on a recurring service contract, so the licence and certification sit with that company.

## 8.4 Contractor teams and equipment

- 🔴 **How Lauren pays contractors today:** a paper list of sizes and codes, a total at the bottom, a check. She counts the trees off the routes herself.
- 🔴 **A team can be a contractor vendor.** Team One is Mauro, Team Two is the in-house crew. Assign trees, contractor pricing generates the amount, it lands as an expense — **closing the loop on the $229,163 Contract Labor line.**
- **What the contractor sees is deliberately narrow:** trees, route, pay. Printable, because that is how she hands it over now.
- 🔴 **Equipment is unknown to the system and to David.** Two trailers exist; nothing else is recorded. And **whose trailer the contractor uses changes what he is paid.**

## 8.5 🔴 The chain David drew, and it is the thesis

> no invoice → no record of trees planted → no peaks and valleys → **the operations manager cannot schedule preventive spraying against it**

**The number Terry wants is created every pay period and destroyed immediately.** Lauren counts the trees to size the check; the check clears; the count is gone. His words: *"how many trees did we plant last year… it's all skewed because we don't know how many were installed."*

**QuickBooks structurally cannot produce it** — a check to a vendor carries no unit dimension.

⚠️ The spray window is **biological and fixed** (March); the planting peak is **commercial**. **If March is also peak planting they collide for the same crew**, and nobody can see it because the curve does not exist.

⚠️ **This is the strongest argument for the QBO historical import:** invoice *lines* carry quantity and item, so the history yields the sales curve by week and variety **on day one**. *(The read shipped `61d84af`; the mapping/preview surface is still owed.)*

---

# PART 9 — JOB COMPLETION, REVIEWS AND THE AAR

## 9.1 "Fulfilled" is defined, and it is a keystone

`[STATED]` *"I've bought the plant, it's been delivered, it's been placed in the ground, and you come back and it's fulfilled — and the guy on site goes, he clicks the button and it's fulfilled."*

⚠️ **This turns tech-debt #121 — nothing can mark a delivery complete — from a gap into a keystone.** 🔴 **The fulfilled tap now feeds THREE things: the Google review request, the completion status, and the contractor's pay.** Three consumers of one action by the crew on site.

## 9.2 Reviews

**1,900 customers, almost no reviews.** On fulfilment, reach the customer **by phone** with a link straight to the review page. One tap.

🔴 **Someone in the room with real experience corrected the email plan and David agreed:** what works better is **a QR code presented in person at the end-of-job walk-through.** The customer is standing there, the work is in front of them, and they are politely on the spot. Emailed links performed worse.

✅ **Answered:** the tablets in that story were **another company's crews, not LAWNS's.** LAWNS crews have no tablets — the day sheet stays paper, and whatever runs in the field runs on a phone.

## 9.3 The after-action report

David's military model: what did you do · what were your problems · how did you overcome them · how can we solve it · what do we need next.

🔴 **Lesson IDENTIFIED vs lesson LEARNED.** At the Kelly job, what should have been on the truck was a generator and a jackhammer — that is a lesson *identified*. Tomorrow they are on the truck — now it is *learned*. **A lesson is only learned when it changes what happens next.**

⚠️ **The AAR is worthless as an archive and valuable as a prompt.** It has to come **back** — next job at a site like that one, the screen says "last time here you needed a jackhammer". Same shape as the chemical-rotation record.

**⚠️ One screen at the end of the job carries four outputs:** tap fulfilled · stamp the times · capture the AAR · present the review QR. Design them together, not as three builds.

## 9.4 On-lot self-service ("take a ribbon, scan the tag")

A sign at the front: want a tree? take a ribbon. The customer walks the lot, **ties a ribbon on each tree they want** and scans the tag, building a cart on their phone. Address entered → mileage → delivery/placement fee. The order lands at the front office **unpaid**; Lauren adjusts (military discount, volume deal) before payment.

🔴 **The pain it solves:** *"we found some trees" — "what kind?" — "I don't know"* — and staff hunt for trees the customer cannot locate, while two others wait.

**Rulings inside it:** the customer sees **price at the cart**, not per item as they scan. The order **pauses unpaid** for a human — the estimate flow arriving through a different door.

⚠️ **Blocker: LAWNS's tags have no QR** (see 7.5).

---

# PART 10 — COMMERCIAL

## 10.1 Where it stands

`[STATED]` Ten hours on site — training, inventory, discovery. David's working numbers: **install $3–4k, monthly $250**, both stated as guesses. He has said only "probably a couple hundred" and "I'd cut her a deal". He wants her feedback first and **does not want to surprise her with a bill**.

## 10.2 Market comparables (searched 2026-08-29)

| Product | Monthly |
|---|---|
| LMN | $297 Starter / $648 Professional, **plus a one-time onboarding fee** |
| SingleOps | $220 entry; most operators $385–550 |
| Aspire | quote-based, $1M+ companies; $300–500+ per user reported |
| Arborgold | $129–499 |
| Jobber | $39–199 |
| Nursery-specific | basic $50–100; comprehensive $200–500+ |
| **SMB implementation fees** | **$1,000–5,000** |

🔴 **The argument that holds: LAWNS would need TWO products today** — a landscape operations platform ($300–550) **and** a nursery production tool ($50–300) — because no green-industry platform tracks a grow ladder and no nursery tool runs crews, installs and deliveries. **$250 for both is roughly half the low end of one of them**, and 0.18% of their turnover.

## 10.3 Flags

- ⚠️ **Do not charge an install fee for the ten hours** — those were **discovery for the product**, not installation for her. Terry's lot walk, the invoices and the P&L are what make verticals two through fifty possible. **Name the fee as deliberately forgone**; that is worth more than the money.
- 🔴 **David has already anchored himself.** "A couple hundred" and "cut her a deal" are the only numbers in the room, and "cut a deal" implies a discount off a list price that does not exist.
- ⚠️ **$3–4k install plus $250/month makes year one $6,000–7,000 with more than half paid up front for software that is not finished.** Alternatives: a smaller install (~$1.5k) with a higher monthly (~$350, still under market); or the install credited against year one.
- ⚠️ **Whatever the figure, the install fee must buy a nameable deliverable** — the data migration and the on-site configuration — **not hours.**
- 🔴 **The decision not yet made, and it matters more than the number: when does the monthly START?** Tie it to a **capability**, not a date — *"when you can run inventory, orders and deliveries without calling me."*
- ⚠️ **Put it in writing.** Today the entire agreement is "a couple hundred and I'd cut you a deal", living in two memories, while a real business runs on the software. What she gets · what it costs · when it starts · what customer zero means. Data-loss exposure is a lawyer's question.
- 🔴 **The subscription timer is running.** Trial clocks start at seed. **Check LAWNS's trial state before the pricing conversation** — if a trial lapses and tiles go fuzzy mid-week, the conversation happens under duress.

---

# PART 11 — IMPORTS AND BUILDS STILL OWED

## 11.1 Imports needing build

| # | Import | Source in hand | Blocked on |
|---|---|---|---|
| 1 | **QBO historical invoices** | live connection, proven; **the read shipped `61d84af`** | a mapping/preview surface + the QBO id as idempotency key |
| 2 | **Vendor purchase invoices** | **26 invoices already delivered** | the capture spec — handwriting, struck lines, freight allocation, content-based dedupe |
| 3 | **Lauren's pricing spreadsheet** | 215+ rows, formulas known | nothing — this is the cost model, ready to import |
| 4 | **Voice inventory → reconcile** | one real walk recorded | the resolver decision **and** the `inventory_counts` catalog check (§7.3) |
| 5 | **The grow ladder** | Terry's timings, one default + two exceptions | a place to put it |
| 6 | **Parent-tree registry** | two named trees with locations | a place to put it |
| 7 | **Equipment register** | two trailers, unenumerated | a walk with Terry |
| 8 | **Chemical application records** | regulator named, rotation rule known | a compliance surface |

## 11.2 Builds owed, in recommended order

1. 🔴 **Disarm the ItemRef** — once the item list is read. **Before Lauren's first QuickBooks push.** Note only ~5 of 12 sites want an item id; five want `DescriptionOnly`; `:320` wants `DiscountLineDetail`; `:580` wants `TxnTaxDetail`. ⚠️ **The hold (`QBO_PUSH_HOLD`) buys the time to do this properly — it does not remove the need.**
2. 🔴 **`inventory_counts` / `inventory_count_sessions` RLS** — ⚠️ **VERY LIKELY ALREADY DONE, see §7.3.** Run the catalog query before building or cancelling.
3. **Pass 1 follow-up** — the three sites that corrupt or lock out (`invitations.ts:68`, `ProjectsManager:102`, `OnboardingWizard:560`), plus the refusal message naming the actor, plus outcome logging in the trace.
4. **Pass 2 Stage 2** — the two funnel RPCs accept an OWNER-role actor, with the guard that no actor may change the role of the `owner_id` holder.
5. **Merge the calendar**, apply its migration, run its cards.
6. **Pass 3** — the status filter, derived from the data; deleted rows default out.
7. **The UTC/local date sweep** — `dashboardWindows.ts` and every date-deriving surface, plus `quality-baseline.json`.
8. **The start/done taps** — `deliveries:update` is already held by all three bundles; migration is two nullable columns.
9. **The end-of-job screen** — fulfilled tap, times, AAR, review QR. One design.
10. **The four-week calendar's remaining sources** as their tiles land.
11. **tech-debt #124** — the eighteen write-capable `is_active_member`-only policies. Not urgent, but it is the mirror of Pass 2 and it should not sit unmeasured.

## 11.3 Decisions owed from David

> 🔴 **INCOMPLETE AT FILING.** The source document was truncated in transmission mid-row — the first entry read *"May an OWNER-role holder dem…"*. **The rows below are reconstructed from decisions named elsewhere in this document and are NOT the original list.** Do not treat this section as complete; David restores it.

| Decision | Where it blocks |
|---|---|
| Voice resolver: fuzzy layer in the shared ladder, or model-proposes-catalog-name | the voice build (§7.3) |
| May an OWNER-role holder remove or demote the `owner_id` holder? | Pass 2 Stage 2 (§3.5) |
| How does `owner_id` transfer when the original departs? No path exists in code | Stage 2, and the Terry/Lauren question (§3.6) |
| Does `owner_id` go to Terry, with Lauren holding the OWNER role? | §3.6 — and it is a one-way door |
| Is "Price Tag = Retail × 2" settled, or is the `?` in Lauren's header real? | the cost-model import (§5.3) |
| Pricing: the number, the install fee shape, and **when the monthly starts** | §10.3 |
| May TRACE persist a customer's chart of items? | the ItemRef mapping (R-23 left it unmade) |

---

# APPENDIX — DOCUMENT UPDATE REGISTER

| Artifact | Change | State |
|---|---|---|
| `docs/RULINGS.md` | **R-26** — a claim must name what was opened to produce it | ✅ filed 2026-08-29 |
| `docs/tech-debt-log.md` | **#124** — eighteen write-capable `is_active_member`-only policies | ✅ filed 2026-08-29 |
| `user_stories.md:623` | premise corrected — D-47 read-back shipped 2026-07-16 | ✅ done (`bb622ff`) |
| `docs/built-inventory.md` | #215 entry's *"no code path can read a QB item list"* corrected | ✅ done (`bb622ff`) |
| §4.1 of this document | the interim instruction replaced — the push is inline; the mitigation is the switch | ✅ corrected at filing |
| §7.3 of this document | `inventory_counts`/`_sessions` carry `_member_all` | ✅ corrected at filing, **catalog check owed** |
| `docs/tech-debt-log.md` | 🔴 **#122 and #123 are cited by number across several documents and DO NOT EXIST in the log** — the same drift as rows #85–#90 | ⚠️ open, David |
| `docs/inventory-functions.md` · `inventory-env.md` · `inventory-ai.md` | still stamped `2026-06-13`; `inventory-env.md` was instance #9 | ⚠️ open |
| `TRACE-SESSION-BOOTSTRAP.md:54` | "No per-branch previews" — instance #6, still uncorrected | ⚠️ open |
| `docs/reference/` | untracked in git since 2026-08-27 | ⚠️ open |
