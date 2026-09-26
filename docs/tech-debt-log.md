# Tech Debt Log — TRACE Platform

Intentional workarounds that violate architectural intent for a real-world reason.
Each entry documents the workaround, the correct architecture, and the trigger for repair.
Maintained per the Honest Friction principle (see PLATFORM_STRATEGY.md Design Principles).

---

## TRANSCRIBED 2026-09-11 — NINE IDS CITED IN `CLAUDE.md` THAT HAD NO ENTRY HERE (#195's CLASS, SECOND INSTANCE)

🔴 **THIS IS NOT NINE NEW FINDINGS. It is nine existing ones that lived ONLY in CLAUDE.md's quick-reference
line and nowhere in this log** — the exact defect **#195** filed on 2026-09-06 about **#186–#191**, in a
range nobody then re-checked. **#186–#191 and #192–#195 were transcribed; 58, 59, 85, 86, 87, 88, 89, 90 and
178 were not.** Measured 2026-09-11: every id from 1 to 277 cross-checked against this file, both the `##`
headings and the legacy table.

⚠️ **THE OTHER 22 GAPS ARE NOT GAPS, AND SAYING SO IS THE POINT.** Ids **160–177** and **5, 6, 158, 161,
164–172** also have no entry here, and they need none: every CLAUDE.md citation of them reads **"ledger #NNN"**
— `docs/CLOSE-OUT-LEDGER.md` entries, a different numbering space. Reporting them as missing tech debt would
have been a confident wrong answer of exactly the kind #178 below describes.

**Prose below is CLAUDE.md's own, verbatim** — transcribed, not rewritten, so the two records cannot drift
into two different accounts of one item. Statuses are as CLAUDE.md carries them.

---

### #58 — 🟡 THE DB-LEVEL GUARD FOR THE `(variant_group, size)` PAIR (NEW 2026-07-16 · transcribed 2026-09-11)

the durable form of ledger #135's defect 2: a partial unique index `(business_id, variant_group, size) WHERE
variant_group IS NOT NULL AND size IS NOT NULL`. This is **ledger #74's deferred option C**. It is a MIGRATION
and **it would REJECT the live Acoma dup, so it cannot land until the data is clean** (i.e. after the
regenerated remediation). The code guard `findSizeTwin` is proportionate at a single-owner nursery's volume.
**Sibling of #54** — the `qb_customer_id` partial unique index, named-not-taken on the same reasoning.

---

### #59 — 🟡 `TRACE-SESSION-BOOTSTRAP.md`'s HEADER HAS THE DUPLICATE-HEADER DISEASE AND IS LOADED EVERY SESSION (NEW 2026-07-16 · transcribed 2026-09-11)

`TRACE-SESSION-BOOTSTRAP.md`'s header carries the **STD-011 duplicate-header disease AND IS LOADED EVERY
SESSION** — §10's Session Starter opens it FIRST, so its `Last updated:` prose block is a per-session token tax
exactly like CLAUDE.md line 3 was. **OP-13's own triage put it with the ledger/DECISIONS-INDEX as "not loaded
every session" — that was WRONG for this one**; the triage stands for the other two. The header-is-a-POINTER
clause should extend to it — **David's call.** Ledger #135.

⚠️ **STILL TRUE 2026-09-11:** the file's line 3 reads `> **Last updated:** 2026-09-11 — **#301** one stop,
three screens — schedule, route and order render the s…` — a summary, not a pointer. **It is also an OPEN
question in `docs/RULINGS.md` § OWED.**

---

### #85 / #86 — ✅ RESOLVED 2026-07-31 (transcribed 2026-09-11)

two legacy-string client gates that admitted NOBODY (`view_costs` → `costs:read`, `import_pricing` →
`inventory:import_price`). → **ledger #174**.

---

### #87 — 🟡 `navPermission()` FALLS BACK TO A RETIRED STRING (NEW 2026-07-31 · transcribed 2026-09-11)

`navPermission()` falls back to **`view_dashboard`**, retired into the `member` sentinel. **UNREACHABLE TODAY
(0 of 26 nav nodes)** — a landmine, not a live defect: the next node added without a `tileKey` or its own
permission goes invisible to everyone including the owner. DECLARED in `authority-grants-baseline.json`, prints
RED every capA run. **Fall back to `member`, or delete the fallback and make the field required?** Ledger #174.

---

### #88 — ⚠️ THE CITATION ITSELF IS DAMAGED — DAVID'S CALL WHAT THIS ITEM WAS (2026-07-31 · transcribed 2026-09-11)

🔴 **TRANSCRIBED WITH ITS DEFECT NAMED RATHER THAN REPAIRED.** CLAUDE.md's line for this id reads, in full:

> `**#88  by MINTING \`reports:read\` as the NEW \`planned\` status — the string was gating a tile without existing in ANY manifest. Ledger #175)**`

The opening clause is **missing** — there is no status marker, no date, and no subject for *"by MINTING"*.
Comparing it to its neighbours, the lost words were almost certainly a resolution marker (`✅ resolved
2026-07-31 — …`), but **almost certainly is not a record.** Inventing the clause would be the one thing this
log exists to prevent: a confident sentence nobody wrote.

**WHAT IS OWED:** David confirms what #88 was, or it is struck. `docs/CLOSE-OUT-LEDGER.md` **#175** is the
place the answer most likely survives.

---

### #89 — ✅ RESOLVED 2026-07-31 (transcribed 2026-09-11)

`useModules` filtered `can()` before reading `status`; `<BeingBuilt>` mounted. → **ledger #176**.

---

### #90 — 🟡 PARTIAL — REMOVE `team:update` / `team:delete` RATHER THAN LEAVE THEM MIS-DESCRIBED (NEW 2026-07-31 · PARTIAL 2026-08-28 · transcribed 2026-09-11)

**PARTIAL 2026-08-28: the BLOCKER is gone and the scope SHRANK to two verbs.** Originally: REMOVE
`team:create/update/delete` rather than leave them mis-described, since team changes go through the funnel —
owner-only by design, enforced by a trigger — which is *"never"*, not *"unbuilt"*. 🔴 **`team:create` IS NO
LONGER ONE OF THEM: R-22 wired it**, and it is enforced by `create_invitation` plus two `invitations` member
policies (#228). **`team:update`/`team:delete` remain the original item.** 🔴 **AND THE BLOCKER RESOLVED ITSELF
BY BEING HIT FROM THE OTHER SIDE:** the obstacle was capQ's retained `migration ⊆ manifest` direction failing
when a string leaves BOTH manifest sets while `20260727_rbac_resource_action_flip.sql` cannot be edited
(§6 r1). #228 hit exactly that with three strings and fixed it properly — a **self-pruning declaration**
(`r-b2-wired-since-declarations.json`) that fails the build if an entry goes stale or was meaningless to begin
with. **Removing a verb is now a declaration away, not blocked.** Ledger #175 · #228.

---

### #178 — 🟡 `supabase/types.ts` DECLARES THREE TABLES THAT DO NOT EXIST (NEW 2026-09-02 · transcribed 2026-09-11)

**`packages/shared/src/supabase/types.ts` DECLARES THREE TABLES THAT DO NOT EXIST.** `GrowthGoal`,
`NotificationLog`, `AIUsageLog` — probed live against a NEGATIVE CONTROL (a name that cannot exist) plus
`receipts` as a positive one: all three **ABSENT**. All carry `tenant_id`, the pre-`business_id` naming; none is
imported anywhere. The fourth, `Vendor`, was removed by #259 — **only it, because deleting types unrelated to
vendors inside a vendor build is the scope creep that makes a diff unreviewable.** ⚠️ **The file's own header
still calls these *"tables that exist in every vertical's schema"***, which is the claim that needs correcting
deliberately. **The cost is not clutter — it is a CONFIDENT WRONG ANSWER**: anyone reading this file to settle
*"do we have X?"* gets YES. Same class as the inventory doc that said a function slot was free at 12/12.

---

## #199 — 🔴 LAWNS'S PRICING CONFIG IS A ONE-KEY STUB, AND THE SEEDER THAT EXISTS TO PREVENT THIS CANNOT REPAIR IT (NEW 2026-09-06)

**MEASURED live, both tenants, service key, `.select()` only.**

```
LAWNS      business_pricing_config.config = {"taxRate": 0.0825}          ← one key
Test Dave's                              = version · unitLabel · denominators · margin{baseline,tiers}
                                           · priceReference · locations[{labor{rate,hours,period,confidence},
                                             recurring,overheadPerUnit}] · pricingTiers[retail,contractor,
                                             wholesale] · discountTypes[Contractor t1/t2, Landscaper t1/t2]
                                           · aiBiEnabled
```

🔴 **THAT ROW IS WHAT CHECKOUT PRICES FROM.** David: *"Lauren rings up a contractor sale on Tuesday and there
is no contractor tier."* The LAWNS row was created **2026-08-25 by a Settings tax-rate save**, not by the
seeder — `mergePricingConfig` writes only the key its screen owns, so the row came into existence holding
exactly one key and has held exactly one key since.

🔴 **AND `seedPricingConfig` IS STRUCTURALLY INCAPABLE OF FIXING IT.** Its upsert carries
`ignoreDuplicates: true`, deliberately — *"a re-run must never CLOBBER a configured tenant. Seeding is a
create-if-absent act."* LAWNS **has** a row. The seeder is a permanent no-op against the one tenant that
needs it. **This is that file's own stated defect — a tenant behaving "as though the business had never been
configured, silently" — arriving from the direction it did not guard.**

**CORRECT ARCHITECTURE (ruled R-103, NOT BUILT):** a fill-absent merge — `{...defaults, ...current}`, the
operand order of `mergePricingConfig` reversed, so a set key always wins and only genuinely-absent keys are
filled. Scoped to one `business_id`, run by David, never wired into a path something can trip.

**TRIGGER FOR REPAIR:** 🔴 **AHEAD OF THE CATALOGUE IMPORT — David's explicit priority call, 2026-09-06.**

⚠️ **THE CLASS IS OPEN AND UNMEASURED: no cap can see a config key that is ABSENT rather than WRONG.** Every
check we own reads code or migrations; this is a jsonb blob whose shape is asserted nowhere. Sibling of
**#178** (a types file confidently declaring tables that do not exist) — a confident wrong answer, not clutter.

---

## #198 — 🟡 THE DISCOVERY REVEAL SHOWS SIX PROPOSALS AND NEVER SAYS SIX OF WHAT (NEW 2026-09-06)

`DiscoveryGlimpse` renders `profile.suggestedOfferings.slice(0, 2)`; `DiscoveryInspect` renders all of them.
**Neither states the population.** Measured against LAWNS this session: the same analysis pass produced
**16 real services in `servicesFound`** and **6 proposals**, and the owner sees the 6 with nothing telling
them a list of 16 was read and discarded, nor that their books carry ~20.

🔴 **This is R-24 / `ui-control-standards.md` W3 exactly** — *"EACH COMPLETED STEP NARRATES ITS REAL RESULT,
WITH ITS COUNT — 'read 685 products & services — that is all of them' — and STATES THAT THE STEP IS WHOLE."*
David: *"A list that cannot prove it is the whole list is a failure, and six proposals presented against a
real service list of twenty is exactly that shape."*

**CORRECT ARCHITECTURE:** the reveal states what was read and what is being proposed as two different
numbers, and says which one it is showing. It lands with **R-102** — the field change makes the count
honest and the copy has to say so.

**TRIGGER FOR REPAIR:** the R-102 build.

---

## #197 — 🔴 FIVE $0 SERVICES ARE ACTIVE AND PRE-TICKED AT CHECKOUT, AND NOTHING RECORDS WHO TURNED THEM ON (NEW 2026-09-06)

**MEASURED on Test Dave's (`f7ec5d67`):** five `service_offerings` rows carry `price: 0`, `is_active: true`,
`pre_selected: true`, **and a `service_note` that still reads *"Suggested by discovery — price not set;
confirm before activating."*** Warranty Check-In · Tree Selection Consultation · Seasonal Fertilization ·
Wholesale Account · Deer and Trunk Protection Bundle.

**They are attached to every cart.** `useCart.ts` initialises `selected: o.pre_selected`, and `AddOns.tsx`
picks the default transport branch from `transportOfferings.find(o => o.pre_selected)`.

**WHAT PUT THEM THERE — two different mechanisms, and only one is a mistake:**
- ✅ **`pre_selected: true` is the COLUMN DEFAULT** — `20260529_businesses_f_service_offerings.sql:49`,
  `pre_selected boolean NOT NULL DEFAULT true`. The seeder never names the column, so every discovery-seeded
  row is born pre-ticked. **The seeder's honesty contract has a hole it does not know about.**
- 🔴 **`is_active: true` was NOT the seeder.** Verified against the tree as it stood at the seed timestamp
  (`04425a2`, 2026-06-21, five days before the 2026-06-26T17:31:05 batch): `is_active: false` was already
  explicit, with the reason in the header — *"so 0 can never read as a real 'free' price or be sold."*
  Something flipped five rows afterwards.

🔴 **AND IT CANNOT BE ATTRIBUTED, WHICH IS THE REAL FINDING.** The only writer that can flip it is
`toggleOffering` in `Settings.tsx` (one row per click, `.update({ is_active: !current })`). But
**`service_offerings` has NO `updated_at` column**, and **`audit_log` carries ZERO `service_offerings`
actions** — all 66 rows on this tenant are role, permission, module and inventory events. *The 8 rows that
grep-match "service_offering" are permission STRINGS inside role arrays, not service writes.* **So a control
that changes what a customer is charged writes no audit row and leaves no timestamp.**

**CORRECT ARCHITECTURE:** (a) the seeder names `pre_selected: false` explicitly rather than inheriting a
default that contradicts its own contract; (b) `service_offerings` gains `updated_at` and an audit row on
activate/deactivate/price-change — it is a money surface and it is the only one of its class with neither.

**TRIGGER FOR REPAIR:** (a) is a two-line fix in the R-102 build. (b) is a migration; it is **#54/#58's
shape** — schema, David applies.

---

## #196 — 🔴 AN UNAUTHENTICATED POST WRITES `service_offerings` INTO ANY TENANT WHOSE UUID YOU KNOW (NEW 2026-09-06)

`api/discovery/ingest.ts` checks `req.method !== 'POST'` and **nothing else** on the analysis path. It then
reads `businessId` straight from the request body and fires the seed on its presence alone:

```
let seeded = 0;
if (businessId) { … const r = await seedServiceOfferings(profile, businessId, db); seeded = r.seeded; }
```

The write uses `SUPABASE_SERVICE_KEY`, so **RLS is not in the path** — `business_id` is whatever the caller
typed. One `curl` adds rows to the checkout screen of any tenant.

🔴 **THE ASYMMETRY IS THE TELL, NOT THE ABSENCE.** The same file gates `cost-apply` properly
(`callerHoldsPermission` / `VIEW_COSTS`, described in its own header as the *"MB_D-015 write-wall"*), and
`populate` carries a written justification for being ungated — *"it touches only namespaced sandbox/DISC-
rows (never real inventory) and sets unit_cost=null."* **`seedServiceOfferings` has neither a gate nor a
justification, and that argument does not transfer: it writes un-namespaced rows into the sellable-services
table.** It was not decided to be open; it was never asked.

⚠️ **NOT EXPLOITED, AND THE BLAST RADIUS IS BOUNDED IN ONE DIRECTION:** the seeder is name-idempotent and
inserts at `is_active: false`, so it cannot overwrite or reprice an existing service. **But #197 above proves
the `is_active: false` half does not hold in practice on this table, and `pre_selected` defaults to `true`.**

**CORRECT ARCHITECTURE:** the same `callerHoldsPermission` gate the neighbouring branch already uses, on
`service_offerings:create`, which exists in the manifest today.

**TRIGGER FOR REPAIR:** before public self-serve signup — the same trigger as the auth/SMTP launch gate.
Reported not fixed 2026-09-06, per David: *"File it."*

⚠️ **IDS START AT 196 DELIBERATELY.** #192–#195 are cited in CLAUDE.md §3 and **still do not exist in this
file** — the log runs 155 → 157, 186 → 191. That is tech-debt **#195**'s own finding, unresolved and now one
session wider. Starting at 196 leaves those four ids claimable by the session that owns them rather than
overwriting them.

---

## #191 — 🟡 THE UI-DIVERGENCE CAP COUNTS A SETTINGS FORM AS A RECORD LIST (NEW 2026-09-05)

`isRecordList()` in `verify-ui-standard-divergence.mjs` matches a file that reads rows **AND** maps
over anything: `/\.from\(['"`]/ && /\.select\(/ && /\.map\(/`. `OperationsSettings.tsx` reads
**one** config row and maps over a **static array of field groups**, so it is counted as a bespoke
record-list surface while being a form over a single record. It has no table, no columns and no rows.

**Not a false green** — the cap over-reports rather than under-reports, and the surface was declared
honestly rather than argued away, *because a surface that trips a cap and is then exempted by
reasoning nobody wrote down is how a cap stops being read.* But it inflates the bespoke population
with files that have nothing to converge onto, which makes the baseline number mean less each time.

**Fix:** require evidence of REPEATED ROWS FROM THE READ — that the mapped collection is the query
result — rather than the co-occurrence of a read and any `.map`. Sibling of **#187** (the cap's
`SCAN_ROOT` misses `shared`) and **#181** (it absolves any file importing `sheetStyles`); all three
are about the cap's POPULATION rather than its assertions.

---

## #190 — 🟡 THE UNIT-PROJECTION CAP CANNOT TELL A READER FROM A WRITER (NEW 2026-09-05)

`verify-unit-projection.mjs` fails any file outside a six-entry allow-list that NAMES a `unit_*`
column, on the stated reasoning that such a file is *"either a second derive or an editable surface
— the two failure modes."*

🔴 **THERE IS A THIRD MODE AND IT IS THE COMMON ONE: A PURE READER.** R-27 built the projection so
that code could READ a trustworthy unit instead of re-parsing `size`. The uppot planner does exactly
that — it groups rungs on `unit_value` **because** it is derived — and tripped the cap on five files
(the field list, the read, its probe, the mutant harness and the seed script's console output).

**Declared, not fixed**, with each file's relationship to the columns stated in the allow-list.
Rewriting a cap to assert the WRITE inside a planning build is the scope creep the gate exists to
catch — the #73 lesson. **But every future reader of the projection will land on this list**, and an
allow-list that grows with legitimate readers is the shape `OWNER_ONLY_PENDING` had before it became
unread noise. **Fix:** assert the WRITE (an assignment or an insert/update payload naming a unit
column) rather than the NAME.



**Routing rule:** TECH DEBT = built WRONG (shortcut/hardcode/compromise that works but isn't right).
NAMED GAP = honest shell intended to fill on a stated horizon. Don't conflate them.

| # | Workaround | Introduced | Correct Architecture | Trigger for Repair |
|---|---|---|---|---|
| 362 | 🔴 **THE IMPORT TYPED ~466 REAL PEOPLE AS ORGANIZATIONS, AND NOTHING LETS LAUREN CORRECT THEM IN BULK.** Measured live 2026-09-22 on LAWNS: **522 customers are `customer_type = 'organization'` and only 56 of them carry any business marker**; a random twenty reads *Tony Matson · John Kraft · Laura McFadden · Brian Finch · Barb & Mark Gleinser* — people, every one. **None of the 522 has a `last_name`**: the whole name sits in `organization_name`, so both structured name fields are empty for ~466 human beings. 🔴 **THE ONE THAT MATTERS: David's own filing example, "Jim & Virginia Patskowski", is one of these rows** — typed `organization`, `first_name` NULL, `last_name` NULL. The A–Z roster (#378) files it under P correctly, but only via the **last-word heuristic and `BUSINESS_NAME_MARKERS`**, because the record itself does not say it is a person. ⚠️ **THE ROSTER IS THE SYMPTOM, NOT THE DEFECT.** A wrong `customer_type` is not a sorting inconvenience: it decides whether a record reads as a company or a person on **every** surface — checkout, the order screen, the delivery stop, the invoice — and a mistyped row also means the surname is unavailable to search, to matching (#53's family) and to any future "same person?" question. ✏️ **RENUMBERED 361 → 362 UNDER [[R-148]] CLAUSE 4.** hold-list reserved 361 by pushing it to `main` (`2f6aea1`); mine was only ever on a branch, and under David's 2026-09-22 ruling an id is reserved ON MAIN — so the later-landing claim moves, and it is mine. Caught by merging `origin/main` before merging TO it, not by a cap. **FILED NOT BUILT, on David's instruction 2026-09-22: *"Propose how Lauren could correct them in bulk (a review list with the suggested type, she confirms) — surface, don't decide."*** **THE PROPOSAL, AS OPTIONS, NOT A DECISION:** **(A) A REVIEW LIST SHE CONFIRMS — the shape David described.** One screen listing every row whose stored type disagrees with what its name suggests, each with the SUGGESTED type, the suggested first/last split, and a tick. She confirms a page at a time; nothing is written until she does. The suggestion engine already exists and is proven — `customerFilingName`'s rules plus `BUSINESS_NAME_MARKERS` (personName.ts, 29 probes) — so this is a surface over a rule that is already tested, not new logic. **Est. 1 screen + 1 writer + its path test under §6 r21.** **(B) THE SAME LIST, BUT IT ALSO SPLITS THE NAME.** Confirming "person" on *"Barb & Mark Gleinser"* writes `first_name = 'Barb & Mark'`, `last_name = 'Gleinser'` and clears `organization_name`. Strictly better for search, matching and the roster — and strictly riskier, because it EDITS a name a human typed. Needs its own undo. **(C) DO NOTHING AND LET THE HEURISTIC CARRY IT.** Honest and free: the roster already files these rows correctly today. The cost is that every future surface inherits a type column that lies, and the heuristic has to be right forever. **WHAT I WOULD FLAG BEFORE EITHER (A) OR (B) IS BUILT, because they decide the shape:** ① **is a couple ("Jim & Virginia Patskowski", "Barb & Mark Gleinser" — a real population, not an edge case) ONE person record or two?** The contact model (#345) can hold two people; the roster cannot show one row for two without a rule. ② **does confirming a type write an `audit_log` row per record or per batch** — she may confirm hundreds in one sitting. ③ **is `customer_type` even the right column to fix, or is the real answer that a record with a `last_name` IS a person and the column is derived?** That would retire the disagreement instead of correcting it row by row. **None of these is Thunder's to answer.** ✏️ **ADDENDUM 2026-09-22, David's observation on `03bb38d` — A SECOND WAY THE NAME COLUMNS ARE WRONG, AND THE RENDER IS NOT AT FAULT.** *"Mark & Vanessa Ashcraft"* renders with the bold spanning BOTH names, because the row stores `first_name = 'mark'` and **`last_name = '& vanessa Ashcraft'`** — the partner's whole name is inside the surname field. The filing rule reads `last_name` and bolds it, which is correct behaviour on incorrect data. **MEASURED LIVE, same day:** of **1,444** LAWNS customers that have a surname at all, **33 carry a MULTI-WORD `last_name`** and **4 have a `last_name` that contains their own `first_name`** (2 rows are both). Samples: `Andrea` + `& Angel Navarrette` · `David` + `& Ivy` · `Leroy` + `& Lila Ludemann` · `John` + `Anastasia Johnson` · `Linda` + `Bill Dubelbeis`. **So the couple problem has TWO shapes, not one:** the ~466 rows with NO structured name at all (the original item), and these 33 where the structure exists and is wrong. Option (B) — the confirm-list that also splits the name — would have to handle both, and it is the reason question ① (*is a couple one record or two?*) has to be answered before either is built. **FILED, NOT FIXED.** | 2026-09-22 (#378's measurement) | `customer_type` agrees with the record, or is derived from it; the structured name fields hold the name for a person, so the filing rule needs no heuristic | **David picks A, B, C or the derived-column question.** Not blocking the A–Z roster, which ships correct either way — this is about every OTHER surface that reads the type |
| 361 | 🔴 **A MIGRATION THAT IS APPLIED LIVE CARRIES `⚠️ NOT APPLIED` ON `main` — `20260921_recipes_made_items`.** **Measured live 2026-09-22** as `supabase_read_only_user`: its recipe table, `business_inventory.item_type`, `record_build_run` and `recipe_link_must_survive_a_wipe` are all present. **The file on `main` (line 36) still reads** *"⚠️ NOT APPLIED. Written, V-blocks run by Thunder against PGlite. David applies."* A reader answering *"can I rely on `record_build_run`?"* from the repo gets NO, and the database says yes. [[R-111]]: a migration label is not evidence. | Filed 2026-09-22, ledger #379, while adopting §6 r22 | The applied-state record is corrected the same day the migration is applied — the second half of §6 r22. Not edited here: §6 r1 forbids editing an applied migration, so the correction is **David's or the #370 session's**, either in the file's header by its owner or in the register. | Before anyone reasons about `undo_import_run`, `record_build_run` or the recipe tables from the repo. |
| 358 | 🔴 **THE TRIP-CHARGE ZONE HAS NO DATA: THERE IS NO ZIP → CHARGE TABLE ANYWHERE.** Measured 2026-09-21, live and in the corpus: no `delivery_zones`, no zip-to-zone table, and every zip column is a plain address field. The only zip→zone rule in the whole platform is **USDA hardiness zone** (`DECISIONS.md:941`) — what will GROW, not what a delivery costs — which is almost certainly the collision behind the recollection that a zip table already existed. | 2026-09-21, ledger #369. David's analysis of 2026-09-10 measured it but never stored it: 519 TC lines, 502 with a usable zip, 80 distinct zips, each zip's MODAL charge (78641 agreeing 99/103, 78642 73/78). Del Valle $400 against Salado $250 proves the charge tracks DRIVE TIME, not distance — which is why the $3.50-per-loaded-mile formula is rejected (it prices the Hutto trip at ~$113 against the $250 actually charged). | A per-business **zip → charge settings table, editable by Lauren**, SEEDED from the tenant's own invoice history: modal TC charge per ship-to zip, **with n and agreement shown so it reads as measured rather than typed**. Outliers shown, never hidden. A zip with no row surfaces *"we can't place this — is it correct?"*, is **NOT priced**, and gets no guessed zone and no fallback. Surface, don't decide: show the charge and where it came from, and let her override. | **After the address check ①–⑤**, and derived from LIVE rows once the invoice history is loaded — not from the 2026-09-10 analysis, which is a number in a chat rather than a measurement anyone can re-run. |
| 356 | 🟡 **THE "NOT STOCK" SETTING HAS A TABLE, A RULE AND NO SCREEN.** `business_not_stock_items` is read by the opening-stock seed and written by nobody: there is no surface where Lauren can say *"this one is not stock"*. It ships EMPTY (`20260922b`) because the alternative — a migration seeding one tenant's four rows — is platform code carrying tenant data, and two of those four ids were wrong on their first and only run. So the capability exists and cannot be used. | 2026-09-21, ledger #365. David: *"a screen where the manager adds an item to 'not stock' herself, recorded as her decision."* **File, do not build.** | A row in the inventory grid (or the seed screen's skipped list) offering **"this is not stock"**, writing `business_not_stock_items` under `settings:update` with a REQUIRED reason and the actor's id, so the record says WHO decided and WHY. It must show the catalogue name beside the id it is writing — the missing check that let a hand-typed list name the wrong items. The row is retired with `active = false`, never deleted, so the reason survives the fix. | **When an owner needs a row held back that her books call stock.** Not urgent for LAWNS today: the four affected rows take a starting number in test data, which David ruled acceptable, and the durable repair is a retype in QuickBooks — they are on Lauren's list. |
| 352 | 🔴 **THE STARTING-NUMBER SEED GIVES STOCK TO THINGS THAT ARE NOT PRODUCTS — TWICE IN A ROW.** Run `bffc7713` (2026-09-17): the seed set `qty = 10` on all 631 imported rows, of which **41 are fees, labour, discounts or bookkeeping lines** — Trip Charge, Tailgate Delivery, Labor Hours, Gift Certificate, six discounts. A trip charge reading *"10 in stock"* confuses the person at the counter, and Lauren sells from this catalogue. The previous run needed the same repair, so this is a recurrence, not an incident. | 2026-09-20, ledger #357. The seed's exclusions (`planOpeningStockSeed`) are *already holds stock*, *has ledger history* and, in test mode, *was not created by the import* — **none of which asks what KIND of thing it is.** | Use the rule the Services review already applies (`classifyDestination`): **income account first, type second** — anything that rule does not send to `product` is not given a starting number. One rule, two screens, no name list (§6 r8). 🔴 **BLOCKED on storing `qb_item_type` and `qb_income_account`**, which the import reads and discards today; that is one migration plus one adapter change (~half a day), and it is the same migration that would store `qb_item_name` / `qb_item_fqn`. | **Before the next reload.** Until then each run needs a hand-written repair like `20260920_zero_seeded_qty_on_non_product_rows.sql`, which is exactly the recurring cost this entry is about. ⚠️ Name-matching is NOT the fix: QuickBooks' own `Type` is wrong on 91 of LAWNS's 134 Service-typed rows, so the account must lead. |
| 353 | 🟡 **THE IMPORT PREVIEW'S FIELD MAP IS A HAND-MAINTAINED DECLARATION, AND IT NOW CONTRADICTS THE IMPORTER.** `importFieldAudit.ts` lists four address paths, all `BillAddr.*`, each mapped to a flat `customers` column. It knows nothing about `customer_addresses`, so it reports **`ShipAddr.Line1` (777 values) as "mapped to nothing"** — while the importer has been writing ship-to addresses since #335 (measured live 2026-09-19: 15 Shipping rows, `source: quickbooks:ShipAddr`, and 715 folded to `kind: both` because the ship-to is the same place). The file leaves those four paths undeclared **on purpose**, to surface a finding — *"223 customers carry a routable ship-to that has never come across"* — that #335 fixed and nobody retired. **The alarm still rings over a repaired fault.** | 2026-09-20, ledger #357. Cost paid twice already: the same morning, one session said ShipAddr *"is mapped to nothing"* and another said *"#335 imports it as a Shipping address"*, and settling it took a live measurement. | **Derive the map from the contact-record rule itself** (`buildContactRecord`'s `blocks` table already names `BillAddr` → billing and `ShipAddr` → shipping), so the audit cannot say one thing while the importer does another. A declaration nobody re-derives is **tech-debt #73's and #185's class**, and this is its third instance. The cheap alternative — declaring the four paths by hand — leaves the same defect in place for the next field. | **Before the next import preview is shown to Lauren**, because it is her screen that carries the false line. ✏️ **Filed as #351 at 14:05:19 and renumbered to #353.** Another session claimed #351 at 14:05:20 — **one second later** — but that claim had already merged to `main`. R-148 clause (4) ranks by time and says nothing about a later claim that shipped, and the cap refuses to rule on it. Moved deliberately, on #335's precedent: unpicking a merged row costs more than moving an unmerged reservation. |
| 343 | 🟡 **A STAFF MEMBER CAN ADD A PHONE OR AN EMAIL, BUT NOT AN ADDRESS.** [[R-162]] (David, 2026-09-17, restated 2026-09-18: *"a phone or email"*) opened the two INSERT policies for phones and emails only; `customer_addresses_member_insert` still needs `customers:create`. So a counter staff member taking a walk-in's **delivery address** cannot save it — the Addresses list offers them no Add. Correct per the ruling's wording; filed because the gap is real the day a counter hire takes a delivery. | 2026-09-18, ledger #349 — `20260917d` (APPLIED) left addresses out deliberately. | Decide whether a delivery address is *adding a way to reach them* (like a phone) or a destination that needs `customers:create`. If staff may add one: the same one-policy change as `20260917d` on `customer_addresses_member_insert`, the Add control unlocked in `ContactListsPanel` (`mayAddAddress`), CARD 30 rewritten, and a staff-add path test in `contacts.paths.mts`. Either way Edit / Make main / Remove stay on `customers:update`. | **When LAWNS hires staff.** Measured 2026-09-18: LAWNS has **no STAFF member** (one manager, two owners); the only staff on the platform are two test logins on Test Dave's. **File, do not build** — David's instruction. ✏️ First filed as #342 at 10:02; #342 had been reserved at 09:47 by ledger #353, so this later claim renumbered (R-148 clause 4). |
| 342 | 🔴 **GO-LIVE (after Saturday 2026-09-19): QUICKBOOKS-INGESTED INSTALLS ARE TYPED AS DELIVERY, AND NOBODY CAN CHANGE A STOP'S TYPE ON SCREEN — [[R-164]].** Measured live 2026-09-18: all 16 QuickBooks-ingested LAWNS orders with a TC line are `delivery`; all 15 person-chosen orders with a TC line are `install`. An install typed as delivery gets no water monitor kit (#352), no install line on the load list, and never starts a warranty (R-143, tech-debt #268). 🔴 **WHAT IT COST ON PAPER, SATURDAY 2026-09-19 (David's CARD 19 run on `f9f3b8a · prod`, re-measured live 2026-09-18):** the sheet printed **23 water monitor kits where the day needs 29**. Two orders are recorded as delivery, so they got none: **Sappal, 5 × Eagleston Holly 45 gal (Install & Warranty)**, and **Kossa, 1 × Cedar Elm 30 gal (Install & Warranty)**. Both came in through the QuickBooks ingest (`qbo-shipdate`). ⚠️ **Part ① alone fixes only Sappal**, whose order carries a Trip Charge line: 23 → 28. **Kossa's order carries no TC line** (a *Flat fee* line instead; a warranty replacement), so the TC rule cannot see it, and only part ②, the on-screen toggle, brings the sheet to 29. 🔴 **SO PART ② IS THE LOAD-BEARING HALF, NOT THE CONVENIENCE HALF (David, 2026-09-18):** an inference can only see what the invoice says, and a warranty replacement's invoice does not say install. **Build ② with ①, never after it.** | Filed 2026-09-18, ledger #353 (David's ruling) | ONE item, three parts: ① the ingest sets `install` when a TC line is present (never `delivery` from its absence); ② a delivery ↔ install control on the stop, permission-gated server-side; ③ every change writes a history row (who, when, from → to) that can be reviewed later. The existing 16 need the same correction, through ③, not a bare UPDATE. | After the Saturday pilot; before the next QuickBooks ingest is trusted for installs. |
| 341 | 🟡 **ACORN FLATS HAVE NO INPUTS: cells per flat, mix per flat, sowing minutes and staking minutes are recorded nowhere.** Survival between rungs is already filed (ledger #330; `docs/open-questions.md` "six numbers only Terry can supply"); these four are not. The nearest hook is the per-size unit multiplier ("a flat = N plants"), named in `user_stories.md` and never built. | Filed 2026-09-18 from Lightning's hold list (validation pass, branch `docs/hold-list-validation`) | Operations figures beside the grow ladder, read by the uppot planner like the potting figures (R-89 setup + handling). | Before the first acorn sowing is planned in TRACE. |
| 340 | 🟡 **MOBILE: WHICH TILES A PHONE SHOWS, PER DEVICE AND PER ROLE, AND A BOTTOM NAV, ARE NOT FILED.** The delivery, orders and zone-walk passes are in the story *"Lauren does the job twice, every delivery day"* (`user_stories.md`); breakpoint pass ① is ledger #305. §6 r7 says the desktop grid is a separate decision David is taking up later. | Filed 2026-09-18 from Lightning's hold list | One tile set chosen per breakpoint and per role from the shared breakpoint vocabulary (#305), plus a bottom nav for the phone — **David's design call**. | Before the delivery pass of the mobile build. |
| 339 | 🟡 **NO SIZE-DISPLAY STANDARD: `formatSize` DOES NOT EXIST.** `packages/shared/src/utils/sizeLabel.ts` exports `normalizeSize`, which is for COMPARING sizes (tech-debt #56); nothing renders one size spelling on screen, so `15`, `15 gal` and `15 Gallon` each display as written. | Filed 2026-09-18 from Lightning's hold list (measured: zero `formatSize` in `packages/`) | One shared display function that reads the ladder rung (R-157), used by every screen and print view that shows a size. | Next build that touches a size on screen. |
| 338 | 🟡 **`mixShrinkPct` IS ONE NUMBER FOR TWO LOSSES** — mix lost making the batch, and mix that settles after the pot is filled (`packages/shared/src/production/productionConfig.ts:85`, default 0; `productionMath.ts:248`). | Filed 2026-09-18 from Lightning's hold list | Two operations figures, batch shrink and fill settle, each applied where its loss happens. | With #336 (batch yield). |
| 337 | 🟡 **SPECIAL MIX IS NEVER TAKEN OUT OF STOCK AUTOMATICALLY** — not when an install is finished and not when an uppot is completed. The install half waits on tech-debt #319 (finishing a stop does not fulfil its order); the uppot half is recorded nowhere else. | Filed 2026-09-18 from Lightning's hold list | Completion writes a `consume` ledger row for the mix (R-118's build-run kinds), sized from R-155 for installs and from the plan for uppots. | After #319; before mix is counted as stock. |
| 336 | 🟡 **NO DERIVED BATCH YIELD, SO NO COST PER YARD OR GALLON OF MIX, SO NO COST PER CONTAINER SIZE.** R-118 sets the formula (landed component cost + build minutes × labour rate) and R-155's costing half is PARTIAL; the batch-to-yield-to-per-size chain has no row. | Filed 2026-09-18 from Lightning's hold list | Recipe → batch yield → cost per unit of mix → per-rung cost from the ladder volumes (R-157). | The recipe-builder build (R-118). |
| 335 | 🟡 **INGREDIENT COST FROM RECEIPTS IS NOT PROPOSED FOR CONFIRMATION.** R-122 says receipt capture exists for cost to produce; R-118 forbids DERIVING a recipe from receipts. Proposing a component's landed cost from its receipt lines for the owner to confirm is neither, and is recorded nowhere. | Filed 2026-09-18 from Lightning's hold list | Receipt line → proposed component cost → owner confirms. Never written without the confirm; freight spread per R-118's R-64 gap. | The recipe-builder build (R-118). |
| 334 | 🟡 **LOW STOCK IS NOT WARNED ANYWHERE.** The only record is the placeholder story *"Reorder threshold / low-stock alert (GAP)"* (`user_stories.md`, `reorder_point` stub). The ask is wider: every consumable (mix, T-posts, rope, bubblers, kits), warned at checkout, on the dashboard and on the load sheet. | Filed 2026-09-18 from Lightning's hold list | One per-item threshold, one check in `shared`, read by all three surfaces. | Once consumables are stocked rows with counts. |
| 333 | 🟡 **STAGED COUNTS HAVE NO REMATCH AFTER A WIPE AND RELOAD.** Staging is not built yet (#67/#68), but once it is, a count staged against a lot that the undo removes and the import recreates would point at nothing. Sibling of tech-debt #322 (orders do not re-attach), on a different table; discovery SQL is on the unmerged branch `recon/rematch-keys`. | Filed 2026-09-18 from Lightning's hold list | Re-key staged counts on `qb_item_id` + size after reload, the same key #322 needs. | With staging (#67/#68); before any count is staged in test mode. |
| 332 | 🟡 **STAGED COUNTS DO NOT BECOME OPENING BALANCES AT SWITCH-ON.** Tech-debt #308 covers the opening line for a seeded starting number; a count taken in test mode is a different source and nothing turns it into the opening balance when QuickBooks writes go on. | Filed 2026-09-18 from Lightning's hold list | The switch-on step writes one opening ledger row per lot from its latest staged count, else from the seed (#308). | With #308. |
| 331 | 🟡 **RECONCILE WRITES THE LEDGER IN TEST MODE; IT SHOULD SHOW A PREVIEW.** Reconcile is one of the six non-order writers ledger #342 §1g reports as still writing in test mode (`docs/open-questions.md`). | Filed 2026-09-18 from Lightning's hold list | In test mode reconcile shows what it would write and writes nothing (R-158 ②). | Before counting starts on LAWNS in test mode. |
| 330 | 🟡 **THE STARTING NUMBERS PANEL'S COUNT LINE DOES NOT SAY WHAT IT LEFT OUT.** `OpeningStockSeed.tsx` ① reads *"N of your M products have no count against them"*; the three exclusions (holds stock · counted or sold · not created by the import, test mode) are named only after the run (`:296–299`). Lightning: it names two of the three. | Filed 2026-09-18 from Lightning's hold list | The line before the button names all three, with counts. | Next touch of the panel. |
| 329 | 🟡 **CREW ACCESS PAST THE PILOT LINK IS UNDECIDED: crew logins or an app, and who may tap Done on site.** Today anyone holding the day's link can tap Done (ledger #347, R-161). Which crew roles may see and work a stop is tech-debt #275, unmeasured. | Filed 2026-09-18 from Lightning's hold list | **David's call:** keep the link, or give crew logins with a permission for Done. | After the Saturday 2026-09-19 pilot. |
| 328 | 🟡 **HELD REVIEW ASKS ARE NEVER RELEASED AND NEVER COUNTED.** Both doors write `deliveries.review_ask_held_at` (R-161). Nothing reads it; `ReviewAskSheet.tsx` is kept and unmounted, and no screen shows how many asks are waiting. The follow-up module also cannot be turned on (tech-debt #270). | Filed 2026-09-18 from Lightning's hold list (measured: no reader of `review_ask_held_at` in `packages/`) | A held-ask list with an exact count ("N waiting"), from which the owner releases each ask. | After #270 is decided. |
| 327 | ✅ **RESOLVED 2026-09-21 (ledger #368) — THE IMPORT MATCHES ON `(business_id, qb_item_id)` AND UPDATES.** An existing row takes a narrow UPDATE of the columns the import owns; `import_run_id`, `qty`, `status` and every retirement column are absent from the payload, asserted on the STATEMENT and not just the result — stamping the run id is the data-loss bug, because the undo deletes by run id. A row she deleted is reported and never revived. **The retire step had to change with it:** *"everything whose run id is not this run"* would have hidden the very rows the import just refreshed, so the stale set is computed and retired BY ID. **239 assertions; §Q proven RED against the old code, where it fails with the real symptom — `duplicate key value violates unique constraint`.** ✏️ **AND THE FILED SYMPTOM WAS WRONG:** this row and the reload checklist both said a second press *"adds a second copy of every product"*. It never could — the unique index refused it, so the second press died on row 0 and imported nothing. WAS: 🔴 **GO-LIVE: THE PRODUCT IMPORT INSERTS, SO IMPORT IS ONLY SAFE WITH AN UNDO FIRST.** The reload checklist says it in red: *"Never press Import twice without an Undo in between."* The fix was filed 2026-09-16 on ⚡ ACTIVE STATUS with no id: match on `(business_id, qb_item_id)` and UPDATE; skip inactive items (already true, ledger #341); REPORT a row deleted in test mode, never revive it. About a day. ✏️ **THE KEY ALREADY EXISTS, MEASURED 2026-09-20 (ledger #357, David's instruction to record it): `business_inventory` carries a UNIQUE INDEX `business_inventory_business_qb_item_uidx` on `(business_id, qb_item_id)`.** Found by a harness probe that tried to insert a duplicate and was refused, so match-and-update has its key and an `ON CONFLICT (business_id, qb_item_id) DO UPDATE` is available today — **do not re-derive this.** | Filed 2026-09-18 from Lightning's hold list (the go-live item that had no id) | The customer import's shape: an existing row gets a narrow UPDATE that never carries the run id. | Before the next product import on LAWNS. |
| 307 | 🔴 **`business_inventory` CANNOT TELL A PLANT FROM A MATERIAL — AND THREE CONSUMERS GUESS FROM TEXT.** No column, category or flag says what a row IS (33 live columns read from `information_schema`; `attributes->'QB type'` survives on the 447 retired rows only and on **0 of 647 live**). **Measured at LAWNS 2026-09-16:** the uppot plan refuses 178 rows — **87 plants, 89 not plants, 2 unclear** — and the 89 include fees, services, deposits, discounts, hours and a gift certificate. 🔴 **AND THE OTHER DIRECTION IS WORSE:** three empty pots (`Containers` 15 and 30 gallon, `Container` "45-gallon empty used bucket") are PLANNABLE, and `resolveLoadItem` classifies all three as `tree` — the one kind that earns stakes, mix and a bubbler on the yard sheet (run through the real function, not inferred). **The seed is the third consumer:** the 2026-09-09 opening stock, scoped to the import run, put qty 10 on **92 non-plant rows**, which is why fees now surface as size problems instead of being refused as empty. **Same shape as [[R-118]]'s `item_type`**, ruled and never built — but that column is ORIGIN (purchased/grown/manufactured) and this is a different axis: a bought tree is a plant, a made bubbler is not. Recon: `docs/recon/2026-09-16-plant-versus-material.md` (incl. a scoped reversal of the 92, WRITTEN, NOT RUN). Ledger #340. | 2026-06-12 (`business_inventory` created with no kind), made visible 2026-09-09 by the seed | One nullable column saying what a row is, read by the uppot plan, the load list and the seed; null renders *not stated*, never defaults to plant (A9). Whether fees belong in this table at all is the larger question ([[R-144]] · #139) | David rules the axis and its vocabulary. **Filed, not built** — upstream of the uppot plan, the load list and the seed |
| 303 | 🟡 **A HEADING AND A TABLE ROW CARRYING THE SAME TECH-DEBT ID STILL PASS EVERY CAP — THE DUPLICATE CHECK READS ONE OF THE LOG'S TWO ROW FORMATS.** `verify-id-citations` clause A matches `## #N` headings (`ROW_RE`); the log ALSO holds ~163 legacy TABLE rows (`| 139 | 🟡 **…**`), which correction ③ established in 2026-09-11 are real filings and which `filedIds` has counted for clause B ever since. **Clause A was never widened**, and its comment says so deliberately: *"Clause A stays on headings: the two formats were never meant to be unique across each other."* 🔴 **THAT SENTENCE WAS A DESIGN NOTE AND HAS BECOME A HOLE, AND IT HAS ALREADY BEEN PAID FOR ONCE.** tech-debt **#290**, **#291** and **#292** were claimed TWICE on 2026-09-12 — as table rows on `feat/delivery-day-load-list` and as headings on `main` — **and every id cap was green on both sides**, because no cap compares the two formats. The renumber to #299/#300/#301 cost a session (ledger #329). ✅ **TWO SIBLING HALVES ARE FIXED, WHICH IS WHY THIS ROW IS THE LEFTOVER RATHER THAN THE WHOLE DEFECT.** **(i) `verify-id-sweep`'s tech-debt matcher was headings-only too**, and it did the same damage one layer out: it printed **`NEXT FREE: #299` while this very tree held `| 299 |`…`| 303 |`**, and reported *"this tree claims none beyond main"* **with four COLLIDING rows in the file**. 🔴 **That blindness is why #290/#291/#292 had to be renumbered TWICE in one session** — the second hop only because a rival branch's four table rows were invisible to the sweep. Both formats now read, 4 probes both directions, **proven RED against the headings-only matcher.** ⚠️ **THE MATCHER IS NOW WRITTEN OUT IN BOTH CAPS** — deliberate and named: they share no module, and extracting one is its own build. **That duplication belongs to this row.** **(ii) the next-free arithmetic in `verify-id-citations`:** the NEXT-FREE arithmetic had the same blindness and was **actively handing out taken ids** — it printed *"max #294 → NEXT FREE #299"* with `| 295 |`…`| 298 |` four rows deep in the same file. Corrected in ledger #329 to read `filedIds`; **rows counted 107 → 270 and the "unused ids" list fell 187 → 28**, i.e. 159 filed items had been reported as gaps. **Probe F, both directions plus a negative control, proven RED against the old arithmetic.** | 2026-09-14 (ledger #329, measured while renumbering the three ids this defect let collide) | **Clause A unions both formats, exactly as `filedIds` already does** — one line, and the probe is the pair `## #7` + `| 7 |` in one document, which must FAIL. 🔴 **BUT IT IS A DECISION BEFORE IT IS AN EDIT, AND THAT IS WHY IT IS FILED RATHER THAN DONE:** widening clause A asserts that the two formats share ONE id space. **They do in practice — the #290 collision is the proof — but the cap's own comment records the opposite intent**, and a cap that goes red on arrival against 270 historical rows is one people switch off (#73). **Measure the live duplicate count FIRST**, then either widen and clear the hits, or declare them. | 🟡 **The next id claimed as a table row.** Not urgent while the next-free number is correct — a session that follows it will not collide — but the guard is absent and the last collision was found by hand. |
| 302 | 🟡 **TEN COPIES OF A FIVE-LINE COMMENT-STRIPPER, EACH ONE THE REACH CONTROL FOR A DIFFERENT CAP — AND THE ELEVENTH WAS ADDED KNOWINGLY.** Every negative source-assertion in this repo (*"this string must NOT appear"*) has to read the file with comments removed, or it matches the prose EXPLAINING the rule instead of the code BREAKING it. That stripper is written out longhand in **five test files** (`loadListPage.test.ts` · `historyOrder.test.ts` · `testMode.test.ts` · `customerFieldCoverage.test.ts` · `vendorEdit.test.ts`) and **five `scripts/` caps** (`verify-field-lists` · `verify-universals` · `verify-zero-row-writes` · `verify-ui-standard-divergence` · `measure-registry-contradictions`), measured 2026-09-14. 🔴 **THE COST IS NOT THE DUPLICATION, IT IS THAT EACH COPY CAN SILENTLY STOP REACHING AND ONLY TWO OF THE TEN HAVE A CONTROL PROBE.** `loadListPage.test.ts` has `C8b`; `loadList.test.ts` now has `A1d`. **The other eight assert over a stripper nobody has proven is doing anything** — and a stripper that quietly stops working turns every negative probe downstream of it GREEN on a file that has the forbidden shape back in it. **That is tech-debt #182 exactly** (*a harness that cannot reach its target reports the same as one that passed*), ten times, in the tooling that exists to catch #182. ✏️ **FILED BY ITS OWN VICTIM, WITHIN THE HOUR:** the [[R-155]] probes `A1b`/`A1c` went RED against CORRECT code because the ruling's own explanation names the strings it forbids. **Documenting a defect is a reliable way to commit it** — third self-inflicted instance this week. | 2026-09-14 (ledger #329, measured while applying [[R-155]] — an eleventh copy added deliberately rather than an eleventh SHAPE invented, and named rather than left for the next reader to count) | **ONE shared helper** exporting the stripper **and the control assertion together**, so adopting it is what gives a cap its reach proof — `stripComments(src)` returning the code plus a `provenReaching(src, code, probe)` the caller must satisfy. 🔴 **The consolidation is the cheap half; the CONTROL is the point** (§6 r8 gets one operation into one place, [[R-33]] is what makes it worth doing). Split by consumer: the five test files can import from `packages/shared`, the five `scripts/` caps are plain `.mjs` and cannot — so it is **two homes, not one**, and that is worth knowing before anyone starts. | 🟡 **The next cap that adds a negative source-assertion** — it will write an eleventh copy, and it may not think to prove it reaches. Not urgent: no copy is known broken today, and eight are unproven rather than wrong. |
| 301 | 🟡 **A CONTAINER SIZE STATED BEFORE AN UNBRACKETED TRAILING REMARK IS NOT READ — 9 REAL TREES, MEASURED.** 🔴 **RED-FIRST CASE FILED 2026-09-17 (ledger #343), NOT FIXED:** `packages/shared/src/quickbooks/__redfirst__/nineTrees301.redfirst.ts` runs the nine live lines verbatim with the size a person reads in each — **9 failed today, exit 1** — plus a negative control (a number inside a fertiliser name is still not a size). It is not a `.test.ts`, so it does not fail the build; `qboItemAdapter.test.ts` §P301 PINS today's behaviour, so a fix cannot land unnoticed. Re-measured 2026-09-16: the ladder build changes nothing for these nine — the reader stops at the remark before the ladder is ever asked.  `readProductFromDescription` scans BACKWARD from the end of the description and stops at the first size-shaped token, and it strips a trailing **parenthetical** first. So *"Live Oak - 200 gallon (Install & Warranty)"* reads correctly and **"Cedar Elm - 30 gallon Install & Warranty" does not** — the remark is not bracketed, so the scan never reaches the size and reports `not_stated`. 🔴 **MEASURED 2026-09-12 over all 130 LAWNS `order_items` rows: 51 resolve to a container size, and NINE are real trees whose text plainly states a gallon size we cannot reach.** The shape is one: `… - 45 Gallon (Bogo) Install & Warranty` · `… - 30 gallon Install & Warranty` · `… - 15 gallon (Buy Get One Half Off) Install & Warranty`. A tenth, *"Eagleston Holly (Tree Form) - 30 Gallon 15% Off (Install & Warranty)"*, reaches `could_not_read` on the fragment `15% Off` — honest, and still not the size. ⚠️ **NOT A FALSE GREEN — the load list prints every one of them** under *no container size* or *could not work out*, and declares its totals a FLOOR. It is incomplete and it says so. 🔴 **AND THE OBVIOUS FIX IS THE WRONG ONE: DO NOT MAKE THE SCAN LOOK HARDER.** The file's own header states why — *"continuing would find a size somewhere in the middle of a fertiliser name and present it as this product's container. Looking harder is how a scan manufactures a confident wrong answer."* ⚠️ **AND DO NOT REACH FOR THE SKU.** The tree codes look like they carry a size (`MS45`, `CHO95`) and then **`TSK2` is a T-POST COUNT** and `MT10002` is a 1 lb ant killer — a digit-scrape turns it into a 10,002-gallon container. **Distinct from #193**, which is a size at the FRONT of a description (`50lb Bag: …`); this one is a size in the MIDDLE, behind a remark. Same file, different position, and #193's blocker is a data-model QUESTION while this one is positional. ⚠️ **RENUMBERED 2026-09-14 (ledger #329): THIS ROW WAS FILED AS #292 AND COLLIDED WITH A DIFFERENT #292 ALREADY ON `main`.** Both were filed 2026-09-12; `main`'s is merged and this branch is not, so under [[R-148]] clause (4) **this one moves.** The collision was invisible while the branch sat unmerged — `verify-id-sweep` reads rival branches, and a row that collides with `main` inside the SAME FILE is a shape it does not check. 🔴 **AND IT MOVED TWICE: the first renumber landed on #295–#298, which `origin/fix/price-unit-ac1-and-four-findings` had reserved 71 SECONDS EARLIER** (17:36:49 against 17:38:00), so clause (4) applied again and these rows are now #299–#303. ⚠️ **Neither hop was caught by the sweep, and the reason is the same one filed as #303: these are TABLE rows, and the sweep — like the next-free arithmetic — reads `## #N` headings.** The sweep's own output said *"this tree claims none beyond main"* for tech-debt while four colliding rows sat in the file. | 2026-09-12 (ledger #315 — measured while building the load list, filed not fixed: re-shaping a shared size resolver inside a print-view build is the scope creep that makes a diff unreviewable) | The remark-stripper becomes **positional and unbracketed-aware** — strip a trailing marketing/fulfilment remark (`Install & Warranty`, `Bogo`, `15% Off`, `Buy One Get One …`) the way `TRAILING_PARENTHETICAL` already strips a bracketed one, **in `qboItemAdapter.ts` where the positional logic lives, and with NO unit vocabulary added** (R-27). 🔴 **It is a vocabulary of REMARKS, not of sizes, and that distinction is what keeps it safe** — the candidate it exposes still goes to `parseUnitOfMeasure` and that function alone says yes or no. Probe both directions against all 130 real rows, and include the negative control that a size in the middle of a fertiliser NAME is still refused. | 🔴 **Before the load list is relied on for a day carrying one of the nine** — it is honest today and incomplete, and the cost is a yard person hand-reading an invoice line the platform should have read. Also the day anyone counts trees-by-size from `order_items` for anything other than this sheet, because the undercount is silent there. |
| 299 | 🔴 **BUILD THE INSTALL COST MODEL IN THE REPO — IT HAS NEVER EXISTED HERE, AND THE THING IT WOULD HAVE BEEN COPIED FROM IS PART FABRICATION.** ✏️ **RE-SCOPED 2026-09-15 ON DAVID'S CORRECTION. THIS ROW PREVIOUSLY READ *"the mulch line is REMOVED from the install cost model"* AND THAT WAS WRONG IN ITS PREMISE** — it described EDITING an artefact, and there is no artefact to edit. 🔴 **WHAT ACTUALLY EXISTS: a Python script David ran IN A CHAT on 2026-09-11, whose output was `install-cost-model.json`.** Never in the repo (whole-tree and whole-history search: no `install-cost-model*` file, no commit that ever added or removed one, `MULCH_YD`/`BARK_YD` appear nowhere). 🔴 **AND THREE OF ITS NUMBERS ARE LIGHTNING'S INVENTIONS, NOT LAWNS'S FACTS — WHICH IS WHY COPYING IT FORWARD WOULD BE THE WORST OUTCOME:** **(i) the MULCH LINE** ($7.49 at 15G to $43.12 at 95G) — Lauren states mulch is not used, only the ingredients in the special mix; **(ii) the RING as a FIVE-ROW LOOKUP** — the exact shape [[R-156]] ruled against, arrived at independently, which is the strongest evidence that ruling was needed; **(iii) `MULCH_YD = BARK_YD`, carrying its own `"TO CONFIRM"`** — a placeholder equality nobody ever confirmed, load-bearing on a cost. ⚠️ **SO THE DEFECT IS NOT A WRONG NUMBER IN A LIVE MODEL. NOTHING A CUSTOMER IS CHARGED DEPENDS ON THIS, BECAUSE IT DOES NOT EXIST** — and that is the reason to build it deliberately rather than transcribe it. ✏️ **THIS ALSO RETIRES THE "CORRECT THEM TOGETHER" PAIRING WITH #300.** The two were filed as opposite-direction errors in one model whose net was uncomputed. **There is no net: #300 was a RATIO settled by ruling, and this is a BUILD.** | 2026-09-12 (ledger #315, from David's dictated bill of materials) · 🔴 **RE-SCOPED 2026-09-15 (ledger #329) on David's correction — the original framing assumed an artefact in the repo, and the artefact was a chat script carrying three fabricated inputs.** | **BUILD it in `packages/`, reading `business_operations_config`** — the operations store [[R-85]] already split for exactly this (volumes, times, crew, rates; **the mix recipe cost is MANAGER-VISIBLE by David's explicit exception**, so the plan's right-hand column is not blank for Joel). **THREE CONSTRUCTION RULES, EACH ALREADY SETTLED — this build makes no new decisions:** **(1) NO MULCH LINE**, because Lauren states none is used; **(2) THE RING IS [[R-156]]'s TOTAL FUNCTION** (`ringDiameterFeet`), never a table — the chat script's five-row lookup is the defect, not the source; **(3) THE MIX IS [[R-155]]'s single 1.0 ratio**, for costing as for loading. ⚠️ **NO NUMBER CARRIED OVER WITHOUT PROVENANCE** — `basis.ts` already types every operations default as `fact` / `suggestion` / `guess`, and **`MULCH_YD = BARK_YD ("TO CONFIRM")` is precisely what that type system exists to refuse.** A value nobody confirmed enters as a `guess` and SHOWS as one, or it does not enter. ✅ **UNBLOCKED 2026-09-15 — tech-debt #253 IS RESOLVED: David ran Settings → Operations live on `c99a4c5` and his changes persisted across a reload, so `business_operations_config` EXISTS and is writable.** The blocker below said the table was absent on every tenant; **that was false**, and it gated this row for four days. **This build can now read the table it needs.** | 🔴 **Before the next pricing or margin conversation** — and the trigger is now *"before anyone reasons from a number this model would produce"*, not *"before a wrong figure spreads"*, because no figure is in circulation. ✅ **NO LONGER BLOCKED ON #253** — the config table exists (2026-09-15, David's live run). |
| 300 | ✅ **RESOLVED 2026-09-14 BY RULING, NOT BY RECONCILIATION — [[R-155]], ledger #329.** 🔴 **DAVID CLOSED THE ROW ON THE RULE AND EXPLICITLY DECLINED TO RECONCILE THE ARITHMETIC:** *"#291's arithmetic stops mattering: 23.55 and 31.5 were both answers to 'what fraction of the container.' At 1.0 it is 45. Close the row on the ruling rather than reconciling it."* **THE RULING: 1 gal of mix per 1 gal of container. ONE ratio, not two — for loading AND for costing.** His reasoning is physical rather than a tolerance, which is what makes it a single number: *"fill it to the top, it settles on the drive, water it and it compacts. The container volume is not an overestimate, it is roughly what goes in."* 🔴 **AND THE RULING REMOVES A KEY RATHER THAN ADDING ONE.** The live proposal was to SPLIT this into `mixRatioCosting` and `mixRatioLoading`; David: *"So there is no mixRatioCosting and no mixRatioLoading. Drop both from the config. One key or none."* Guarded: probe **A1b** refuses either name in `loadList.ts`, mutant **A1b** re-splits the key and is caught. 🔴 **THE OTHER 0.7 IS UNTOUCHED AND THE RULING SAYS SO:** `OPERATIONS_DEFAULTS.tradeGallonFactor = 0.7` is trade gallons vs true gallons — *"a DIFFERENT fact … about the pot. Leave it alone; the BOM does not touch it."* **The two numbers being equal is a coincidence that had already cost one reconciliation**, so probe **A1c** and mutant **A1c** now refuse any read of it from the BOM. ⚠️ **WHAT IS NOT CLOSED:** the ruling fixes the RATIO; **an install cost model that applies it has never existed in this repo and must be BUILT** (#299, re-scoped 2026-09-15). ✏️ **CORRECTING THIS ROW'S OWN EARLIER WORDING — *"the half that costs money"* OVERSTATED IT:** nothing a customer is charged depends on a model that does not exist. `BOM_RULES` was already at 1.0, so **nothing a customer is charged moved today.** WAS: 🔴 **THE INSTALL COST MODEL'S SPECIAL-MIX RATIO IS 0.7 CONTAINER VOLUMES; DAVID SAYS ~1.0, SO IT UNDERSTATES BY ~30%.** The model computes **23.55 gal at 45G** (a 0.7 ratio). David, 2026-09-12: **approximately ONE container volume per tree — a 45 gallon tree takes ~45 gallons of mix — and *err large, do not skimp*.** ⚠️ **THIS PULLS THE OPPOSITE WAY FROM #290 AND THAT IS THE WHOLE POINT OF FILING THEM TOGETHER:** the mulch line makes install cost too HIGH, the mix ratio makes it too LOW, and **nobody has computed the net.** Correcting either one alone moves every install figure in a direction that may be wrong. 🔴 **And the derived rule is the exposure, not the line item:** the **thirds rule was derived off these numbers**, as was the price card. ✏️ **The load list (#315) uses 1.0 and is NOT the fix** — it is a materials sheet for a yard person, computed per container at every size; it has no opinion about cost. ✏️ **THE "SIBLING" PAIRING IS RETIRED, 2026-09-15 (David's correction).** #299 (was #290) is still open but it is **NOT the other half of a net**: the two were filed as opposite-direction errors in one model whose combined effect was uncomputed, and **there is no model** — the artefact was a Python script run in a chat, and #299 is now a BUILD. **This row was a RATIO and it was settled by ruling; that stands on its own.** ⚠️ **RENUMBERED 2026-09-14 (ledger #329): THIS ROW WAS FILED AS #291 AND COLLIDED WITH A DIFFERENT #291 ALREADY ON `main`.** Both were filed 2026-09-12; `main`'s is merged and this branch is not, so under [[R-148]] clause (4) **this one moves.** The collision was invisible while the branch sat unmerged — `verify-id-sweep` reads rival branches, and a row that collides with `main` inside the SAME FILE is a shape it does not check. 🔴 **AND IT MOVED TWICE: the first renumber landed on #295–#298, which `origin/fix/price-unit-ac1-and-four-findings` had reserved 71 SECONDS EARLIER** (17:36:49 against 17:38:00), so clause (4) applied again and these rows are now #299–#303. ⚠️ **Neither hop was caught by the sweep, and the reason is the same one filed as #303: these are TABLE rows, and the sweep — like the next-free arithmetic — reads `## #N` headings.** The sweep's own output said *"this tree claims none beyond main"* for tech-debt while four colliding rows sat in the file. | 2026-09-12 (ledger #315, from David's dictated bill of materials) | The install cost model reads **one container volume per tree** at every size, and the two corrections land **in one pass with the net effect stated** — not one at a time. ✅ **THAT QUESTION WAS ASKED AND ANSWERED, AND THE ANSWER IS THE RULING.** This cell used to read *"whether 1.0 is a costing ratio or a loading ratio is worth one question to David … err-large is a deliberately WRONG number for a cost."* **It is neither and both: David ruled 1.0 is not an err-large allowance at all, it is the physical fact** — the mix settles and compacts to about the container volume — **so the same number is correct for the trailer and for the books.** The premise that a loading figure must be padded, and therefore unusable as a cost, was the thing that was wrong. | 🔴 **Same trigger as #290, and with it** — before the next pricing or margin conversation. They are one correction with two halves. |
| 183 | 🟡 **RE-INVITING A PERSON MINTS A SECOND `business_members` ROW AND NOTHING STOPS IT — OWED, WITH ITS BLOCKER.** `create_invitation` (`20260828_owner_role_carries_authority.sql:383-387`) INSERTs with **no prior SELECT, no `ON CONFLICT`, no `WHERE NOT EXISTS`**; the table has **no unique index of any kind** (whole-corpus grep for `unique\|constraint\|index` against `business_members`: ONE hit, `fk_business_members_invite_id`, a foreign key, `20260602:117`). Accept resolves by `invite_id` (`acceptInvitation.ts:74`) so ONE row activates and the other becomes a permanent orphan — MANAGER, `active=false`, `user_id` NULL — and `removeMember` deletes by `id` (`members.ts:30-37`), so removing the person through the UI clears one and leaves the other on the roster. **It grants nothing today** (`is_active_member` requires `active = true`), which is precisely why nobody would notice. **Durable fix:** a partial unique index. **Blocker (#54/#58's shape):** it cannot land until the live rows are known clean, and the session that filed this **could not read them** — the service key would not load and every network call returned HTTP 000. Named in the `20260904b` migration header, in `resetInvitationExpiry`'s own comment, and on the owner-test board's not-covered list, because that is where the next person reaching for a second invite is standing. *(ledger #274)* |
| 184 | 🟡 **A DEAD CLEANUP FUNCTION WOULD SILENTLY UNDO THE RESET PATH.** `expireInvitations` (`invitations.ts`) flips every expired invitation to `used = true`. `used = true` is exactly what `reset_invitation_expiry` refuses — so running it once would **tombstone every invitation the Reset invite button exists to rescue**, and drop the row out of `getPendingInvitations` again, restoring the silent disappearance ledger #274 was built to remove. **ZERO callers, and it has never had any** — grepped across `packages/`, `api/` and `scripts/`; the only reference is its own export in `index.ts`. 🔴 **The hazard is not that it runs, it is that it READS LIKE HOUSEKEEPING** — its comment said *"Run this as a cleanup task."* A red DO-NOT-WIRE warning now stands on it. **The open decision is David's and is unmade: does sweeping expired invitations have any place at all now that expiry is a DISPLAYED STATE rather than a thing to tidy away?** *(ledger #274)* |
| 196 | 🔴 **A FIELD'S VALUE MEANS SOMETHING OTHER THAN ITS NEIGHBOUR'S, AND NOTHING WE OWN CAN SEE IT — FILED AS A CLASS ON DAVID'S INSTRUCTION ("file the pattern, not just this instance").** SIXTH instance in a fortnight: freight-quantity-is-miles · fuel-quantity-is-a-rate · pack_size-is-a-breaking-strength · notes-is-provenance · `Sku`-is-really-a-name (R-98) · and now **`DefaultTaxCodeRef.value = "3"` on ALL 1,946 LAWNS customers *including every taxable one*, while `TaxExemptionReasonId = "3"` on three cities — same literal, two fields, opposite meanings.** Reading the first as the second is what produced *"17 more carry a bare 3"* in the recon prompt. 🔴 **AND THE SIBLING FAILURE IS REACHABILITY, WHICH IS WORSE BECAUSE IT IS SILENT:** the customer-side field is `TaxExemptionReasonId`, the invoice-side is `TaxExemptionRef`. Keying the customer name against invoices returned **0 of 1,481 — indistinguishable from a true zero.** Filtering the *object* (present, empty, on all 1,481) returned **1,100 customers**. Only filtering `.value` reproduced the real **90 and 21**. **Three answers from one file, two of them confidently wrong, none of them an error.** ⚠️ **THE CLASS IS NOT "A WRONG UNIT" — it is that a scalar carries no statement of what it measures, so every reader supplies one and no check can disagree.** [[R-33]] and #182 in the DATA rather than in the harness: tsc, eslint, knip and every probe are blind to it, because the value is well-typed and present. | 2026-09-06 (ledger #278, filed as a CLASS at David's instruction after the sixth instance) | **A DECLARED MEANING PER FIELD THAT A PROBE ASSERTS AGAINST A REAL CAPTURE, BOTH DIRECTIONS** — the shape #179's fix took (the migration's column list became the SOURCE and the select DERIVED, with the probe failing either way). For an external feed the equivalent is a field manifest naming, per entity, what each value MEANS and what it must NOT be read as, checked against a stored capture fixture. 🔴 **The cheap half costs nothing and is available today: when a scanner reports a COUNT, it states the EXPECTED count beside it** — `0 of 1,481` next to an expectation of 90 is a red flag; `0 of 1,481` alone reads as an answer. | 🔴 **DAVID RULES — no instance count is complete and this row exists to carry a NUMBER rather than a recollection.** Six instances is a measured class, not an anecdote (#174). **Trigger: the next build that joins two entities from one external system** — on the current rate, the next one. |
| 197 | ✅ **RESOLVED 2026-09-06, SAME DAY, BY DAVID ANSWERING THE FK QUERY — `orders_customer_id_fkey` is `confdeltype 'r'`, ON DELETE RESTRICT.** A customer carrying orders cannot be deleted; the database refuses outright — no cascade, no orphan, no silent damage, which is R2/A3's condition satisfied in its strongest form. The undo is **wired** (`_route=customers-undo`), RESTRICT-aware, and reports what it could not remove **by name with an order count**. **No `customers:delete` verb was minted** — it remains one of the five unmintable deletes, and the route is gated on OWNER + `customers:create` + `customers:update`, able to touch only rows carrying its own run id. ~~ORIGINAL:~~ **THE CUSTOMER IMPORT HAS NO UNDO, AND THE REASON IS A STANDING RULING RATHER THAN AN OVERSIGHT.** `undoCustomerImport` is written, refuses while QuickBooks writes are on (R-95), is scoped to its own `import_run_id`, and is held by mutants W5/W6/W7/W11/W12 — **but it is wired to NO route.** `customers:delete` is one of the FIVE UNMINTABLE DELETES (`permissionManifest.ts` R2/A3: *"must be UNFINDABLE by grep in this file"*), and the manifest conditions any future one on **first answering the FK-cascade query.** 🔴 **THAT QUERY CANNOT BE ANSWERED FROM THE REPO.** A corpus grep for FKs referencing `customers` returns **exactly one** — `deliveries.customer_id ON DELETE SET NULL` (`20260620_deliveries.sql:28`) — while `orders.customer_id` is live (66 orders) and its `ON DELETE` rule is **in no migration at all**, because `orders`/`customers` are live-only schema (tech-debt **#39**). ⚠️ **AND #277 ALREADY SHIPPED A CUSTOMER DELETE:** `undoItemImport` deletes `customers WHERE import_run_id = <run>` — safe only because nothing wrote that column. **This build is the thing that makes those rows exist.** The two undos cannot collide (different run ids), but the platform now has one wired customer-delete path and one deliberately unwired. | 2026-09-06 (ledger #278 — surfaced, not built) | Answer the FK-cascade query against the **live catalog** (`pg_constraint` — a source grep provably cannot see it, which is #39's own blind spot and exactly what blocked `20260727d`), then either wire the undo under the owner gate with the answer recorded, or rule that a customer import is one-way and say so on the board. | 🔴 **DAVID RULES.** Until then the standing instruction is on the owner-test board, CARD 17: **import onto Test Dave's, not LAWNS** — on LAWNS there is no supported way to take 1,927 rows back out. |
| 204 | 🟡 **`customers` HAS NO `CREATE TABLE` IN THE CORPUS, SO ITS COLUMN CHECK RESTS ON A COMMITTED SNAPSHOT RATHER THAN ON THE MIGRATIONS.** #203's fix for `business_inventory` parses the table's own `CREATE TABLE` plus every `ADD COLUMN` and asserts the insert list is a subset. 🔴 **THAT MECHANISM DOES NOT PORT TO `customers`: measured 2026-09-07, the corpus yields 23 columns from `ALTER TABLE … ADD COLUMN` and NO `CREATE TABLE` AT ALL, so 10 of the customer import's 23 insert columns — `qb_customer_id`, `source`, `first_name`, `last_name`, `email`, `phone`, `address_line1`, `city`, `state`, `zip` — appear in NO migration and would be reported as unknown.** That is tech-debt **#39** (live-only schema) presenting a bill. **The gap is filled with `docs/schema-snapshots/customers-columns.json`** (37 columns, taken from the live PostgREST projection, refreshed by `scripts/snapshot-customers-columns.mjs`), and §M asserts the insert AND reconcile lists are subsets of it. ⚠️ **A SNAPSHOT IS A DECLARATION AND #73 IS ABOUT DECLARATIONS NOBODY RE-DERIVES**, so §M also holds the snapshot to the corpus in the one direction the corpus CAN answer: **every `ALTER TABLE customers ADD COLUMN` must be in the snapshot, so a migration landing without a refresh FAILS THE BUILD.** §M further asserts `CREATE TABLE customers` is still absent — the day one lands, the snapshot stops being the only answer and §M should be rewritten the catalogue import's way. | 2026-09-07 (ledger #278, while checking #203 against this writer) | **CAPTURE `customers` IN A MIGRATION** — the real fix, and it closes #39 for this table rather than working around it. Until then the snapshot is a one-table down payment on the schema-snapshot checker owed since **#92**. | **When `customers` gains a `CREATE TABLE`** (§M will tell you — it asserts the absence), or when the next table with live-only schema needs the same check and the snapshot mechanism should be generalised rather than copied. |
| 200 | 🟡 **THE UNDO GATE IS NOW WRITTEN TWICE — `undoIsOpen` IN `itemImportWriter.ts` AND THE SAME FOUR STATEMENTS INLINE IN `customerImportWriter.ts`.** Both read `businesses.qbo_writes_enabled`, AND it with the operator's env hold through the shared `pushPermitted`, and close on a failed read. 🔴 **THE DECIDING HALF IS SHARED AND CANNOT DRIFT — `pushPermitted` is one function, imported by both** — but the *db read plus the failure wording* is duplicated, which is §6 r8's rule-of-three at two. ⚠️ **IT WAS DUPLICATED DELIBERATELY AND THE REASON IS RECORDED:** `undoIsOpen` is module-private to `itemImportWriter.ts`, and that file was being actively edited by another session at the moment this landed (`e04a697` was committed mid-build); exporting from a file someone else is mid-fix in is how two sessions produce one conflict. **The customer undo was written from #277's CORRECTION rather than from its own failure**, which is the good direction — but the second copy is real. | 2026-09-06 (ledger #278, stated at the moment of duplication rather than found later) | **ONE EXPORTED `undoIsOpen`**, homed where both imports are natural — `business-logic/testMode.ts` already owns `pushPermitted` but is deliberately pure (no db), so the honest home is a small `quickbooks/undoGate.ts` that both writers import. The failure SENTENCE moves with it: *"we could not check"* must stay worded differently from *"you are live"* in one place, not two. | **The next time either undo is touched** — whichever session gets there first, with the other file free. Cheap now, and it stays cheap only while the two copies still agree. |
| 199 | 🔴 **NOTHING COMPARES THE TWO QUICKBOOKS-WRITE SWITCHES, SO A BUILD CAN GATE ON EITHER AND STAY GREEN.** There are two: `QBO_PUSH_HOLD` (env, the OPERATOR's deploy-wide hold) and `businesses.qbo_writes_enabled` (column, `20260902…:65`, the OWNER's own decision). `business-logic/testMode.ts` holds the ONE correct predicate — `pushPermitted({ writesEnabled, platformHeld })`, whose header says *"Either one saying no means no"* — and **five call sites reach for `isPushHeld` directly instead** (`api/qbo/invoice/cultivar.ts:728`, `router.ts:365`, and until 2026-09-06 both of `itemImportWriter.ts`'s gates plus `customerImportWriter.ts:425`). 🔴 **THE INSTANCE COST A DAY:** ledger #277's undo gated on the env var alone, so at LAWNS — owner's switch off, env unset — it computed `undoable: false` and **refused in exactly the state it exists to serve**. Found by **David asking which switch it read**, not by any check. ⚠️ **`customerImportWriter.ts:425` STILL HAS THE SAME DEFECT** — it is #278's file, not mine to edit (R-62, one writer per branch), and its undo has no route today so the defect is unreachable; it becomes live the day `customers:delete` is ruled. | 2026-09-06 (ledger #277, found by David's question) | A cap asserting that any file naming `isPushHeld` **either** also calls `pushPermitted` **or** is declared with a reason — the shape `retiredFilter.test.ts` already uses for the retired filter, both directions, so a declaration for a site that has since converged fails too. The two legitimate direct users are `testMode.ts` itself and the status endpoint's raw `push_held` field. | Before the next surface gates on "are writes on" — and **before `customers:delete` is ruled**, because that is the moment #278's copy of this defect becomes reachable. |
| 198 | 🟡 **THE UNDO GATE READS CURRENT STATE, NOT HISTORY — A BUSINESS THAT WENT LIVE AND CAME BACK RE-OPENS AN UNDO OVER ROWS BEHIND REAL INVOICES.** `undoIsOpen` asks *"can a push happen right now?"*, which is the right question for *may I write* and the wrong one for *may I delete*. Flip `qbo_writes_enabled` on, complete one checkout that pushes an invoice against an imported item, flip it back off, and the catalogue undo is open again — it will delete the row that invoice points at. **Not reachable at LAWNS today** (`qbo_writes_enabled = false` since the column was created, and the invoice push has never run against their books) and **not a defect in the current design so much as a question the design never asked**: nothing records *"has this business ever pushed"*. | 2026-09-06 (ledger #277, named while correcting the gate) | The honest fix is a fact, not a predicate: a `businesses.qbo_first_push_at` timestamp written by the push path on its first success, and the undo closes permanently once it is set. That is a migration plus one write, and it makes the undo's own history-independence explicit rather than incidental. **Do NOT solve it by widening the current-state predicate** — "writes are off right now" and "nothing has ever left" are different claims and collapsing them is what produced this row. | Before any business goes live and comes back — realistically, before the second customer, since the first go-live is a one-way door David is standing at. |
| 201 | 🟡 **THE FILE DOOR EXISTS ONLY FOR THE READ, SO THERE IS NO WAY TO REHEARSE AN IMPORT AT SCALE WITHOUT A SECOND QUICKBOOKS COMPANY.** R-60 ruled *"the test harness is a FILE, not a connection"*, and that half shipped for the READ path (`captureReplay.ts` / `captureProjection.ts`, in the browser). **`/api/qbo/items/preview` and `/ingest` have no file input at all** — they read the tenant's own realm — so a rehearsal on Test Dave's exercises Test Dave's realm (**1 item**), never LAWNS's (**685**). 🔴 **THE COST, MEASURED: ledger #277's CARD 5 asserted an ingest on Test Dave's *"creates 647 and retires 130"* — 647 from one realm, 130 from another business_id, in one sentence.** Unrunnable, and it was the card protecting every later card. **#180's shape:** a deferral to a surface that does not do what the sentence says. **Card rewritten 2026-09-07 to prove the MECHANISM rather than the scale** (David's ruling), which is honest and is not the same thing. | 2026-09-07 (ledger #277, found by David reading CARD 5) | A capture-body door on `items-preview` / `items-ingest`: accept a POSTed capture body in place of the live walk, gated exactly as hard as the live path (R-69: *"a file replaces a CONNECTION, not a CODE PATH"* — the same screens in the same order, or the rehearsal previews something other than what she gets). **David: *"the right end state and is its own build. Not now."*** | Before the next import build claims a rehearsal proves anything about scale — and before any import is rehearsed against a realm that is not the one it will run on. |
| 200 | 🟡 **EVERY OWNER-TEST SNIPPET THAT NEEDED A TOKEN WAS UNRUNNABLE: `window.supabase` DOES NOT EXIST.** The Supabase client is module-scoped — `packages/shared/src/supabase/client.ts` exports it and **nothing anywhere assigns it to `window`** (grepped: zero hits) — so `await window.supabase.auth.getSession()` throws `TypeError`. It appeared **3× on the catalogue-import board and 1× on the customer-import board**, written by two different sessions on two different days, neither of whom ran it. **Found by David, who got a token out of localStorage himself rather than reporting it as broken.** 🔴 **THE CLASS, WHICH IS THE PART WORTH KEEPING: an owner-test card is CODE THAT NOBODY COMPILES.** Prose in these boards is reviewed; a snippet is copied. Nothing in `npm run verify` reads a `.md` fence, so a card can be confidently wrong for as long as nobody stands at a screen with it — which is exactly the window an owner-test board is supposed to close. **Both boards fixed 2026-09-07** to read the session from localStorage under supabase-js's default `sb-<ref>-auth-token` key, without hardcoding the ref. | 2026-09-07 (ledger #277, found by David) | Two candidates, and the cheap one is probably right: **(a)** a cap that extracts every ```js fence from `docs/owner-tests/*.md` and asserts each identifier it references against a small allow-list of things that actually exist in a browser on that origin (`localStorage`, `fetch`, `document`) plus names the fence itself defines — it would have caught `window.supabase` on the day it was written; **(b)** a single `docs/owner-tests/_console-preamble.md` that every board INCLUDES by pointer rather than by copy, so one fix reaches every board (STD-011 — the copy is what drifted here, twice). | Before the next board ships a snippet. This one cost David time on the morning of a customer rehearsal. |
| 203 | 🔴 **NOTHING COMPARES A WRITER'S COLUMN SET AGAINST THE TABLE IT WRITES — `#179`'S CLASS FROM THE OTHER DIRECTION.** #179 was a declarative list SHORTER than its migration (four address columns with no reader). This is the same list LONGER than its table: `itemImportWriter.ts` named **`source`**, a column `business_inventory` has never had, so **the first insert of the first real run was rejected by PostgREST** — *"Could not find the 'source' column of 'business_inventory' in the schema cache"*. 🔴 **IT PASSED EVERYTHING:** `npm run verify` exit 0, **40 of 40 mutants caught**, `build:cultivar` clean. tsc cannot see it (the row is a `Record<string, unknown>`), eslint and knip cannot, and **every probe asserted the row against the DECLARATION rather than against the table** — including one probe that positively required the bad field, so it was green on code that could not insert a single row. **Found by David running CARD 5 STEP 3.** ✅ **CLOSED FOR THIS ONE WRITER 2026-09-07** — `itemImportWriter.test.ts` §A2 parses `business_inventory`'s columns out of the migration corpus (CREATE TABLE + every `ADD COLUMN`) and asserts the declared insert list is a subset, with anchors so a broken regex fails loudly and a negative control (`source` genuinely absent) so the check is shown to refuse something real. Mutant **W27** restores the field. ⚠️ **THE CLASS IS OPEN: every other `*_INSERT_COLUMNS` / inline insert payload in the repo is unchecked**, and the probe reads the REPO, not the catalog — a column added through the dashboard is invisible to it (§6 r17's class). | 2026-09-07 (ledger #277, found by David on CARD 5 STEP 3) | Generalise §A2 into a cap: for every file with a declared insert-column constant, derive its table's columns from the migration corpus and assert the subset both ways — undeclared column in the payload FAILS, and a declaration naming a column no migration creates FAILS. The catalog half stays owed for the same reason the schema-snapshot checker is (`verify-universals` reads `.sql`, not `pg_catalog`). | Before the next writer is built against a table it did not author. This one cost a live rehearsal step on the morning of a customer demo. |
| 202 | 🔴 **`ok: true` SAT BESIDE `created: 0` AND A POPULATED `error` — THE A8/R-12 DEFECT INSIDE THE CODE BUILT TO GUARD AGAINST IT.** `ImportRunReport extends ImportPlanReport`, and the run report was built with `{ ...plan, … }` — so `ok` was spread from the **PREVIEW**, which had genuinely succeeded. A run that failed on its first insert therefore returned `ok: true`, `created: 0`, `stoppedAt: 'create'` and an error message together. **A caller reading `ok` alone saw success on a run that wrote nothing.** 🔴 **THE POINT IS NOT THE FIELD, IT IS THAT INHERITANCE CARRIED A CLAIM ACROSS A BOUNDARY WHERE IT STOPPED BEING TRUE** — `ok` means "the plan is sound" on one type and "the run succeeded" on the other, and TypeScript is happy to let the first satisfy the second. **Found by David reading the response body on CARD 5 STEP 3**, not by any probe. ✅ **FIXED 2026-09-07** — `ok` is redeclared on `ImportRunReport` with what it means, forced `false` on the base, and set `true` in exactly one place. §D2 asserts the property David asked for — *a stopped run is distinguishable from a completed one by `ok` alone* — across five outcomes plus the negative control, and as an invariant (`ok === (committed && !stoppedAt && !error)`) rather than case by case. Mutants **W28**, **W29**. ⚠️ **UNSWEPT: every other type in the repo that `extends` a report type and inherits an `ok`/`success` field.** `customerImportWriter.ts`'s reports are the first place to look, and they are #278's to check. | 2026-09-07 (ledger #277, found by David on CARD 5 STEP 3) | Sweep for `interface X extends Y` where `Y` carries an outcome field, and either redeclare it with its narrower meaning or rename one of the two. A field whose meaning changes between a supertype and a subtype is a lie the compiler enforces. | Before the next report type is built by extension — and #278's should be read now, since its undo has the same preview/commit split. |
| 204 | 🔴 **A NUMBER IN AN OWNER-TEST CARD IS A MEASUREMENT NOTHING RE-TAKES, AND A STALE ONE MAKES A CORRECT SYSTEM LOOK BROKEN.** CARD 2 asserted **24 colliding items / 7 price differences**. The true figures are **22 / 6** — measured before the trailing-parenthetical strip landed (the fix for `SRO300`'s `48" Box`, tech-debt mutant A10) and **never re-measured after it**. 🔴 **THE COST WAS NOT A WRONG NUMBER, IT WAS A FALSE ACCUSATION AGAINST WORKING CODE:** David read 22/6 off a live LAWNS run against a board asserting 24/7, spotted a genuinely colliding Brodie Juniper pair on the Inventory screen, and concluded *"the collision detector is not reading the projection… 22 is a floor, not a count."* **The detector was right — the pair is collision group #1, flagged price-differing ($1,400 vs $1,250) — and the board was wrong.** It cost a rehearsal step and an investigation on a customer-demo morning. ⚠️ **A SECOND, SEPARATE CAUSE MADE IT UNFALSIFIABLE BY HAND: the `reason` sentence never named the product**, so searching the collision list for "Brodie" found nothing even though the group was there. Fixed the same pass (mutant A15). 🔴 **THE CLASS: probes use SYNTHETIC fixtures, cards quote REAL measurements, and nothing connects the two.** A code change can move a real-corpus figure and every probe stays green while every card silently goes stale. This is R-26 inside our own test boards, and it is the second instance in three days (the first: CARD 5's 647-vs-130 realm conflation, #201). | 2026-09-07 (ledger #277, found by David mid-rehearsal) | Put a compact fixture derived from the real capture under `docs/owner-tests/fixtures/` — id, name, type, description, unitPrice, sku for all 685 — and have `qboItemAdapter.test.ts` assert **the exact numbers the cards quote** against it. Then a code change that moves a figure FAILS THE BUILD instead of silently invalidating a board. The cards then cite the probe rather than a remembered measurement. ⚠️ Not built mid-rehearsal: the numbers were corrected by re-measuring and the eleven groups written out in full so nothing has to be inferred from a count. | Before the next card quotes a number measured from real data — which is most of them. |
| 205 | 🔴 **THE IMPORT WRITES NO `variant_group`, SO 416 OF LAWNS'S 647 IMPORTED ROWS ARE SIZE-SIBLINGS THAT THE PLATFORM CANNOT SEE AS FAMILIES — AND THE SIZE PICKER CANNOT FIRE ON ANY OF THEM.** David's finding, filed separately from the collision fix at his instruction: *"Not a narrow rule — an unreached one. Whatever writes variant_group, the import does not, and that is worth knowing beyond this build."* 🔴 **MEASURED LIVE 2026-09-07 on the run-`d32213ab` catalogue:** 647 live imported rows · **`variant_group` NULL on 647 of 647** · 355 distinct variety names · **124 names carry MORE THAN ONE SIZE, involving 416 rows (64% of the catalogue)** — Natchez Crape Myrtle has **9** sizes, Lacey Oak 8, Live Oak 8, Shumard Red Oak 8. 🔴 **THE CONSEQUENCE IS NOT COSMETIC, AND IT IS VERIFIED AT THE LINE: `detectSizeCollision` (`stockLineResolver.ts`) RETURNS `false` IMMEDIATELY WHEN THE GROUP IS NULL** — *"`if (group == null || group.trim() === '') return false; // group must be set…`"*. So a scan of "Live Oak" returns eight token-equal rows and **the size picker cannot fire**, which is exactly the state `countPromote.ts:12-18` declares its D-49 invariant to forbid: *"ANY path that mints a size-sibling must leave the family in a state where the size-picker fires BY CONSTRUCTION — a non-blank variant_group on EVERY row of the family… A mint that leaves the family half-grouped or size-less does not merely look untidy: the next scan of that variety returns >1 token-equal rows, detectSizeCollision correctly REFUSES to guess."* **The catalogue import is a path that mints size-siblings and it violates that invariant on 124 families.** ⚠️ **WHAT I HAVE NOT OBSERVED, STATED SO IT IS NOT ASSUMED: the phone behaviour.** The picker not firing is proven from the code; what a counter actually sees in the lot is an owner-test, not a claim I have made. ⚠️ **SECOND HALF, ALSO DAVID'S:** the **447 hand-made rows have carried six collisions this whole time, visible on the grid, that nobody acted on** — so the flag being unreached on imports is not the only reason these go unfixed. ✏️ **DISTINCT FROM #204** (a stale number in a card) **and from R-101** (the collision surface): those are about DISPLAY. This is about a column the import does not write and the machinery that depends on it. | 2026-09-07 (ledger #277, found by David after CARD 6) | Decide what the import should write, and it is a real decision rather than a one-liner: `variantGroupSlug(name)` would group every same-named row — correct for Live Oak's eight sizes, and it would also merge the two Lacey Oak 45 Gallon rows that R-101 exists to keep VISIBLY APART. The interaction with the collision flag has to be settled in the same pass, not after. Then backfill the 447 hand-made rows or leave them, deliberately. ⚠️ **Do NOT bolt it onto the import as an afterthought** — `countPromote.ts`'s invariant is about the state a mint LEAVES BEHIND, and half-grouping 647 rows is the failure it names. | Before the count walk is used against an imported catalogue — i.e. before Lauren counts anything after go-live. **Not before the rehearsal**: nothing in CARD 5-23 exercises the size picker. |
| 207 | 🔴 **THE CONTRACT FOR ONE BUTTON OVER BOTH IMPORTS — WRITTEN HERE BECAUSE #278 OWNS HALF OF IT AND NEITHER SESSION MAY DECIDE IT ALONE.** David, 2026-09-07: *"ONE BUTTON, ONE RUN ID, COVERING CUSTOMERS AND ITEMS TOGETHER. Not a preference — it is what the undo needs. Two run ids means Lauren undoes twice in the right order, and the failure case is worse than the inconvenience: items wipe cleanly, customers hit a RESTRICT because she rang up an order, and she is left with half a catalogue and a full customer list."* 🔴 **THE FIVE TERMS:** ① **ONE run id spans both halves** — minted once, server-side, stamped on `customers.import_run_id` and `business_inventory.import_run_id` alike. ② **ORDER IS CUSTOMERS FIRST, ITEMS SECOND** — David's reason: *"an order rung against an imported item needs a customer to point at"*; and the failure asymmetry agrees, since customers-without-a-catalogue is re-runnable while a catalogue whose orders cannot attach to anyone is not. ③ **NO AUTO-ROLLBACK** (ruled 2026-09-07 after this session recommended it): a stop **reports exactly what landed and OFFERS the undo as a button** — an automatic rollback that itself partly fails leaves a state nobody chose, and the customer half genuinely can fail halfway because a customer with an order cannot be deleted. Same shape as `leftovers`. ④ **ONE SURFACE**, `QboCatalogueImport.tsx` in Settings → Accounting; the customer half joins that panel rather than adding a second. ⑤ **SERVICES ARE NOT ON IT** — *"they are not ingested, they are PROPOSED… a review screen, not an import"*, sequenced behind the pre-ticked/$0 leak. ✅ **THE MACHINERY MOSTLY EXISTS ALREADY: `undoItemImport` deletes BOTH `customers` and `business_inventory` by run id**, so one id over both means one undo call cleans both halves. **What it lacks is #278's row-by-row FK retry** (`customerImportWriter.ts` — a chunk refused on a foreign key is retried per row so one undeletable customer does not take 1,925 others down with it). That retry has to move into the shared undo, and it is #278's code. ⚠️ **NOT DONE UNILATERALLY, DELIBERATELY (R-62).** This session built the items surface and stopped at the boundary. 16 peer sessions were listed and **none was identifiable as #278**, so no message was sent rather than guessing at four of them — David's instruction: *"Do not guess at sessions."* | 2026-09-07 (ledger #277, David's ruling) | #278's session reads this row and the matching block on `qb-customer-import-full-surface-test.md`, then the two halves are merged behind one preview/import/undo trio on the existing panel. The open design question — **where the shared run id is minted, and which writer owns the combined undo** — is the first thing to settle, not the last. | Before Lauren runs either import live. She is promised one loop, and two buttons with two run ids is two loops wearing one sentence. |
| 206 | 🟡 **A FAMILY WHOSE SIBLING HAS NO SIZE GETS NO PICKER AND NO FLAG — IT WILL READ AS A BROKEN PICKER TO WHOEVER HITS IT.** David asked for this filed separately, and he is right that neither rule catches it. `detectSizeCollision` requires **every** row in a family to carry a size (`stockLineResolver.ts` — *"every row needs a size"*), so one sizeless sibling silently disables the picker for the whole variety. The collision flag does not fire either: a sizeless row and a sized row are different shapes, so they are not a collision. **The row is fine, the family is fine, and the scan just does not offer a choice.** 🔴 **MEASURED over LAWNS's 685, with `variant_group` now written: 5 of the 123 multi-row families carry a sizeless sibling — 17 rows.** Two of the five (`military-discount-5`, `tree-replacement`) are *already* flagged, because BOTH their members are sizeless and therefore share a raw key — so they collide and get a mark. **The three that go entirely unflagged are the ones David named: `blue-point-juniper` (6 rows: 1 · 15 · 30 · 45 · 7 gallon + one with none), `red-rocket-crape-myrtle` (3), `tuscarora-crape-myrtle` (4).** ⚠️ **DISTINCT FROM #205** (which was `variant_group` never being written at all, disabling the picker on 124 families) **and from R-101** (same name, same parsed size). This is the third and narrowest cause of a dead picker, and it is the only one with no visible symptom. | 2026-09-07 (ledger #277, David reading the measurement) | Extend the "Needs a look" mark to a THIRD reason — *this variety has a size missing, so the scanner cannot offer you a choice* — keyed on: the row's `variant_group` family has >1 member AND at least one member has no size. It is derivable from the same rows the grid already holds, so it costs no column and no migration, exactly like the collision flag. ⚠️ **Do NOT fold it into the collision rule** — it is a different fact with a different fix (fill in a size, versus reconcile two prices), and one mark meaning two things is what made the last three findings hard to tell apart. | Before the count walk is used against an imported catalogue. It is the same trigger as #205 and should ship with it, since a person who fixes #205 and still finds three dead varieties will reasonably conclude #205 did not work. |
| 208 | 🔴 **THIRD INSTANCE IN ONE BUILD: A HAND-WRITTEN INTERFACE OF OPTIONAL FIELDS IS A CLAIM TYPESCRIPT CANNOT CHECK, AND ALL THREE SHIPPED.** The combined import panel declared its own `customers?: { created?: number; reconciled?: number }` — a GUESS at #278's shape. `previewCustomerImport` returns **`toCreate` / `toReconcile`**; only `commitCustomerImport` returns `created` / `reconciled`. So the panel read `undefined ?? 0` and told David **"Customers: 0 new"** and **"Import 0 customers and 647 products"** against **1,946 records in QuickBooks and 30 held locally**. 🔴 **THE WALK WAS RUNNING PERFECTLY AND THE NUMBER WAS MINE** — he was right that zero is not a possible answer, and right to stop before pressing Import, because 647 products and no customers is precisely the split state the customers-first ordering exists to prevent. **THE CLASS, AND WHY IT IS THE SAME DEFECT THREE TIMES:** ① **`source`** — a column `business_inventory` has never had, in a declared insert list (#203); ② **`ok`** — a field inherited from a preview onto a run, where its meaning changed (#202); ③ **this** — a field name invented on another module's exported shape. **Every one is a declaration that did not match its source, and in every one the response was `as`-cast so the compiler was never asked.** ✅ **FIXED BY IMPORTING THE REAL TYPES** (`CustomerPlanReport` / `CustomerRunReport` / `CustomerUndoReport`) and splitting the panel's single `Report` into **one shape per step** — a single interface spanning plan, run and undo is what let a run-report field be read off a plan report without complaint. 🔴 **AND THE COMPILER IMMEDIATELY FOUND A SECOND, UNRELATED BUG THE MOMENT IT COULD SEE:** the panel tested `run.stoppedAt === 'create'`, but the RUN stops at `'customers'`/`'items'` and only the ITEMS half knows `'create'`/`'retire'` — a comparison that **could never be true**, so the copy for a stopped create/retire was dead. Two levels conflated, invisible for as long as the shape was hand-written. ✏️ **AND THE COORDINATION WORKED IN THE OTHER DIRECTION:** #278 read tech-debt #202 and applied it before being asked — `CustomerRunReport` redeclares `ok` and its comment says *"found in the catalogue import's twin of this type and checked here before it was ever exercised."* | 2026-09-07 (ledger #277, found by David on the live preview) | A cap over `packages/*/src/**/*.tsx`: a `fetch(...).json()` result cast to a hand-declared interface whose fields are ALL optional is the smell — either import the producing module's exported type, or declare the shape once beside the producer and import it from both ends. ⚠️ The general form is hard (a response type genuinely cannot always be imported, e.g. across a real network boundary to a third party). **The narrow form is easy and covers all three instances: our OWN api routes return our OWN exported types, so the client should import them.** | Before the next panel is built against another module's report. Three instances in one build is a rate, not a coincidence. |
| 209 | 🔴 **A CAP CAN BE WRONG IN THE ONE DIRECTION ITS OWN ASSERTION CANNOT LOOK — FILED AS A CLASS AT DAVID'S INSTRUCTION, SEPARATELY FROM THE BUILD THAT FOUND IT.** His words: *"A subset check never fails on extra names, so the regex absorbing REFERENCES business_inventory(id) from other tables' definitions was invisible until you ran the comparison the other way."* **THE INSTANCE:** `itemImportWriter.test.ts` §A2 derived `business_inventory`'s columns from the migration corpus with `/CREATE\s+TABLE[^;]*?\bbusiness_inventory\s*\(/` — which also matches a FOREIGN KEY, e.g. `CREATE TABLE inventory_counts ( … inventory_id uuid REFERENCES business_inventory(id) … )`. The derived set had been quietly absorbing **other tables' columns** since the day it was written. **The cap's assertion was `declared ⊆ derived`, and a subset check is structurally blind to a derived set that is too LARGE** — extra names never fail anything. It surfaced only when the NOT NULL widening ran the comparison the other way and demanded `counted_qty`, `delta`, `kind` and `item_label` from an inventory insert. 🔴 **THE GENERALISATION, WHICH IS WHY THIS IS A CLASS AND NOT A BUG:** every cap in this repo asserts in ONE direction, and each is blind to the failure that its direction cannot express. `verify-write-paths` asserts no NEW path (blind to a declaration for a path that no longer exists — the shape #185 already is). `verify-field-lists` asserts no NEW list. `verify-select-policies` closed its own version of this deliberately (*"a declaration for a table that no longer exists, or that has since gained a policy, is STALE and FAILS THE BUILD"*) — **so the platform has already solved this once and did not generalise the lesson.** ⚠️ **AND IT IS [[R-33]]'s SIBLING, NOT [[R-33]] ITSELF:** R-33 is *a check that cannot disagree*. This is a check that CAN disagree, does disagree correctly, and is nonetheless blind along an axis it never looks down. A green one-directional cap is evidence about one direction only. | 2026-09-07 (ledger #277, found by widening the cap David asked for) | Audit every `scripts/verify-*.mjs` and every corpus-reading probe for the direction it does NOT assert, then add the reverse where it is cheap — `verify-select-policies.mjs` is the worked example to copy, since it already fails on a stale declaration in both directions. **The cheapest general form: any cap that DERIVES a set should assert the set's own shape** (it contains what it must, and nothing it must not) before asserting anything against it. §A2 now does exactly that with a named negative control. | Before the next cap is trusted as evidence that something is clean. Three caps in this build reported green over a real defect, each for a different reason. |
| 195 | 🔴 **TECH-DEBT #186 THROUGH #191 ARE CITED IN CLAUDE.md AND DO NOT EXIST IN THIS LOG.** CLAUDE.md's Tech Debt Log line describes all six at length (#186 the test runner reporting 72 of 74 files · #187 the UI divergence cap's `SCAN_ROOT` · #188 `positionStore.ts`'s false STAFF comment · #189 the authority cap's spelling dependence · #190 the unit-projection cap flagging pure readers · #191), three §3 handoff entries close with *"tech-debt #186–#191"*, and **`docs/tech-debt-log.md` stops at 185.** Found 2026-09-06 while claiming an id: the max row here is 185, the max claimed in CLAUDE.md is 191. **This is R-26's shape inside our own ledger** — a written declaration nobody checked against the artefact it names — and it means #275's and #276's close-outs were incomplete on this gate. ⚠️ **It is NOT a numbering collision:** the six are described well enough to transcribe verbatim. New ids start at 192 so nothing is overwritten. **NOT fixed in the pass that found it** — transcribing six other sessions' findings inside a catalogue-import build is the drift the gate exists to catch, and #190 in particular has a live second instance below that would have to be merged rather than appended. | 2026-09-06 (found while claiming an id, ledger #277) | Transcribe #186–#191 from CLAUDE.md into this log verbatim, then make the close-out protocol's tech-debt step assert the two are in step — the same both-directions shape `verify-handoff-retention.mjs` already uses for §3. | Before the next id is claimed, or the next builder repeats exactly this. |
| 194 | 🟡 **`api/orders/submit.ts` READS A LOT BY ID WITHOUT THE RETIRED FILTER, DECLARED AND OWED.** Every other `business_inventory` read now hides retired rows through `onlyLiveInventory` (ledger #277); these two do not. **It is not reachable today and the reason is structural:** a retired lot cannot be PICKED — `stockLineResolver` hides it from every scan, search and catalogue read — so this by-id read is only ever reached with an id the picker already handed out. **Why it was not fixed in the pass that built the filter:** the second site uses `.single()`, which **ERRORS** rather than returning null when a filter excludes the row, and re-shaping checkout's error path inside a catalogue-import build is scope that build declined. Declared in place in `retiredFilter.test.ts`'s `EXEMPT` map with this reasoning, so it is visible on every run rather than forgotten. | 2026-09-06 (ledger #277) | Add `.is('retired_at', null)` to both sites and give the `.single()` site an explicit refusal path — *"that product has been replaced and can no longer be sold"* — rather than a 500. It is a small change to a surface where a wrong error message costs a sale. | Before a retired lot can reach checkout by any route other than the picker — e.g. a saved cart, a re-order, or a deep link. |
| 193 | 🟡 **A SIZE STATED AT THE FRONT OF A DESCRIPTION IS NOT READ — ~30 ITEMS, ALL FERTILISER, COMPOST AND BAGS.** `readProductFromDescription` scans the END of a QuickBooks description, because that is where 536 of LAWNS's 647 sizes are (`"Afgan Black Pine, 45 Gallon"`). A front-loaded one — `"50lb Bag: Micromax Granular Micronutrients"`, `"1/2 Yard Scoop: Fertile Compost Mix"`, `"15gal Bucket: Regular Compost Mix"` — reports **`not_stated`**, which is honest and incomplete. **NOT a silent failure:** the state is one of three and the report carries it, so nobody is told a size does not exist when we simply did not look there. 🔴 **THE BLOCKER IS A QUESTION, NOT A PARSER:** is `50lb` the SIZE of a bag of Micromax, or is the size `each` and 50lb a property of the bag? `parseUnitOfMeasure` would read `50lb` as weight and `1/2 Yard Scoop` as volume, both correctly — but recording a bag as *a weight* changes what the uppot ladder and every count screen do with it. **David's answer decides whether this is a twenty-line change or a data model question**, and this build did not pick one. Boarded as `qb-catalogue-import` CARD 21, `needs-test` with the reason. | 2026-09-06 (ledger #277) | Ask David the question above. If front-loaded sizes ARE sizes: extend the scan to the LEADING token run under the same anchor rule, and keep the trailing scan first so nothing already working moves. If they are not: leave `not_stated`, and record that as the answer rather than as a gap. | Before the fertiliser and compost lines need a unit — i.e. before they enter a count walk or a cost-per-unit calculation. Not before Lauren's first import: they arrive named and priced either way. |
| 192 | 🟡 **`soft_delete_inventory` WRITES `status='deleted'`, WHICH IS NOT IN `ALL_STATUS_VALUES` — SO A TOMBSTONED LOT CANNOT BE FILTERED FOR ON THE GRID.** `20260720_inventory_movement_ledger.sql:744` and `:875` both `SET status = 'deleted'`; `inventoryStates.ts:154,161` define the vocabulary as `available · depleted · damaged · returned · archived`. **Measured live 2026-09-06: 5 rows carry `status='deleted'`.** The status filter offers five values over data that holds six, so the one state a person would most want to isolate — *"what did we tombstone?"* — is the one they cannot select. **Not a false green and not a data defect:** the RPC is correct, the rows are correct, and the filter list is a floor rather than a lie. It is the STD-011 shape — one vocabulary, two authors — with the DB as the author the code list never learned from. ✏️ **AND IT CORRECTS A PREMISE:** the build prompt for #277 stated *"`soft_delete_inventory` sets `status='archived'`, not `'deleted'`"* and asked for docs saying otherwise to be corrected. **The opposite is true in both the corpus and the live data.** `__harness_replay_lot` IS `archived` — but at qty 0 and by some other path, not by this RPC. The half that was right: `deleted` is genuinely missing from `ALL_STATUS_VALUES`. 🔴 **DAVID'S SENTENCE, KEPT VERBATIM BECAUSE IT NAMES THE CLASS AND NOT THE INSTANCE:** *"a scalar carries no statement of what it measures, so every reader supplies one and no check can disagree."* `status` is exactly that — a bare `text` column with **no CHECK constraint** (deliberately, per AC-4) and therefore no declared domain anywhere in the database. The only statement of what it can hold is `ALL_STATUS_VALUES` in client TypeScript, which the RPC has never read and cannot be made to. **So the vocabulary is asserted in one place and written from another, and nothing compares them** — which is why this was found by a person reading live rows rather than by any of the eleven caps. | 2026-09-06 (ledger #277, while checking a prompt premise) | Add `'deleted'` to a TOMBSTONE_STATUSES constant beside `DERIVED_STATUSES`/`MANUAL_CONDITION_STATUSES` and fold it into `ALL_STATUS_VALUES` — which is documented as *"what the data contains (including derived values), not what the editor may set"*, so it already claims to be the superset it is not. **Do NOT add it to `MANUAL_CONDITION_STATUSES`** — that list feeds the editor's dropdown, and offering "deleted" as a manual status would let someone tombstone a lot without the ledger row and audit row the RPC writes. | Before anyone is asked *"which lots did we delete?"* from the grid, or before a filter list is used to argue a status does not occur. |
| 185 | 🟡 **A RATCHET BASELINE DECLARES A WRITER THAT WRITES NOTHING.** `write-paths-baseline.json` (stamped 2026-08-28) lists `packages/shared/src/auth/invitations.ts` under `tables.audit_log`, and that file contains **zero occurrences of `audit_log`** (grepped). Permissive slack rather than a false green — the cap still passes on its real assertion — but the consequence is that **an audit write added to that file would land without the cap noticing**, which is convenient today and is the opposite of what the cap is for. Same class as **#73**: a declaration nobody re-derives. Found because a probe about `expires_at` matched this file for an unrelated reason. *(ledger #274)* |
| 182 | 🔴 **A HARNESS THAT CANNOT REACH ITS TARGET REPORTS THE SAME AS ONE THAT PASSED — FOUR INSTANCES IN ONE WEEK, FILED AS ONE CLASS ON DAVID'S INSTRUCTION.** [[R-33]] already says *a check that cannot disagree is not a check*. **This is its sharper sibling and it is not the same shape:** there the check was capable of running and structurally unable to fail; here the check **never reached the thing it was written about**, and a green from an unreached target is indistinguishable from a green from a passing one. **The four, in the order they were found:** ① **#146** — three source probes matched their own file's PROSE, so `historyOrder.test.ts` §I *"would have PASSED on a DELETED guard"* so long as a comment still mentioned it. ② **#138** — a test double more forgiving than the real system stamped an `onConflict` Postgres rejected on all 19 live rows. ③ **ledger #269** — a probe's key regex `[a-z]+` could not match a column keyed `receipt_id`, so that column was **skipped by the loop entirely** and its missing `sortVal` passed silently. ④ **2026-09-04 (#273)** — the probe written to catch tech-debt #179 used `[a-z_0-9]`-less `[a-z_]+` and **could not match `address_line1`, THE VERY COLUMN THE DEFECT WAS ABOUT**; it reported *13 of 14* and was caught only because the failure was read rather than the total. 🔴 **THE COMMON MECHANISM IS A SCANNER WITH A NARROWER DOMAIN THAN ITS POPULATION**, and in three of four the narrowing was invisible in the assertion — you must read the SCANNER, not the assertion, to see it. ⚠️ **The tell is a probe that reports a COUNT it never states an expectation for.** #273's §A only survived because A1 asserts *"the migration declares 14"* as its own assertion; had it merely iterated whatever it found, it would have passed over 13 columns forever. | 2026-09-04 (the class named by David after the fourth instance; the instances span 2026-09-02 → 2026-09-04) | **A cheap discipline before a cap:** every scanning probe asserts the SIZE of what it scanned, not only the property of what it found — *"I examined N things"* where N is independently known (a migration's column count, a config's key count, a directory listing). A scanner that cannot say how much it saw cannot be trusted to have seen it all. 🔴 **The mechanical form is a mutation the other way round:** instead of mutating the CODE and requiring red, mutate the POPULATION (add a row/column/file the scanner should catch) and require red. None of our mutants do this today — all 13 in `measure-vendor-record-mutants.mjs` mutate the subject, none mutates the corpus. | 🔴 **Before the next scanning probe is written.** #174's advice applies: the cheap first step is a **COUNT** — how many probes iterate a corpus (regex over a file, `readdirSync`, `matchAll`) without asserting how many items they found? ⚠️ **Do NOT retrofit inside an unrelated build** — rewriting the probe layer in a pass that is not about probes is the drift these caps exist to catch (#73's and #146's own reasoning). |
| 181 | 🟡 **THE DIVERGENCE CAP CLASSIFIES ANY FILE THAT IMPORTS FROM `datasheet/DataSheet` AS A GRID CONSUMER — INCLUDING A MODAL THAT ONLY BORROWS ITS STYLE TOKENS.** `verify-ui-standard-divergence.mjs:130` defines `usesSharedGrid` as *an import from `…datasheet/DataSheet`, or a `<DataSheet` element*. `sheetStyles` — the shared MODAL chrome — is exported from that same file (`DataSheet.tsx:577`), so **every form that centres itself correctly (M1) is counted as using the shared GRID.** Measured 2026-09-04 when `VendorEditor.tsx` entered the population: record-list surfaces went 29 → 30 while `bespoke` stayed 24 and `undeclared` stayed 23 — the new file was silently absolved. 🔴 **THE LIVE RISK IS THE SELF-PRUNING CHECK C1, NOT THE COUNT.** C1 fails a declared surface that *"NOW USES THE SHARED CONTROL"* and orders its declaration deleted. Add a `sheetStyles` import to `Vendors.tsx` — a bespoke card list that will never be a grid — and C1 would demand deleting a declaration that is still entirely true, on the strength of a style import. ⚠️ **It is NOT a false green today**: `VendorEditor` is a modal form, genuinely not a record list, so nothing is being missed. The defect is that it is right by accident. | 2026-09-04 (measured while landing #273; the classifier dates from 2026-09-03) | Split the predicate: `usesSharedGrid` should match the GRID (`<DataSheet` element, or an import of the `DataSheet` **binding** specifically), while an import of `sheetStyles` counts as using the shared MODAL and answers section 2, not section 1. Both live in one file today, which is the root cause — `sheetStyles` arguably belongs in its own module beside the grid rather than inside it. | 🔴 **NOT inside an unrelated build** — changing the classifier re-measures `undeclared_bespoke_surfaces` into an unknown, which is exactly the re-baselining David declined to bundle into #272. Take it with the `ui-standards.html` board build that already owes F4/S1/R1/R2, or the next time `sheetStyles` moves. |
| 180 | 🟡 **A CODE COMMENT DEFERRED A FIELD TO A SURFACE THAT CANNOT EDIT IT, AND A DEFERRAL TO A SURFACE THAT WAS NEVER BUILT READS EXACTLY LIKE A DEFERRAL TO ONE THAT WAS.** `ReceiptKeeper.tsx` explained why the invoice number was absent from the confirm form: *"Correcting a misread number belongs to the record's ONE edit surface, /receipts/:id (E1)."* **`/receipts/:id` does not edit `receipt_number`.** Grepped 2026-09-04: the string occurs in `ReceiptsList.tsx`, `receiptsList.ts`, `ReceiptKeeper.tsx`, `systemManagedFields.ts`, `historyOrder.ts` and `20260903c` — and in **neither `ReceiptDetail.tsx` nor `receiptDetail.ts`**. That page writes line items (`edit_receipt_line_items`) and the vendor billing preference; nothing else. So the field was editable **nowhere** while a comment asserted it was editable somewhere, and the comment cited **E1** — a real clause — to justify it, which is what made it persuasive. ✅ **The instance is fixed** (the field is on the confirm form; the comment now records the false deferral). 🔴 **The CLASS is not.** Nothing distinguishes *"deferred to X"* where X exists from where X does not. **Third instance this week:** tech-debt #61 (`countPromote.ts:24` asserted a capability "never built" that existed and was wired), #145 (a row and a file header both said `/receipts/:id` did not exist while it was shipped, boarded and navigated to), and this. 🔴 **All three are [[R-26]] inside our own corpus — a written declaration nobody checked against reality, steering a decision.** | 2026-09-04 (measured while landing #273; the comment dates from 2026-09-03, ledger #270) | A probe class that reads a deferral and checks it: where a comment names a route or a file as the place a capability lives, assert that the named place actually contains it. Cheap for the `/route` and `File.tsx` shapes, which is most of them. ⚠️ **Nearest prior art is tech-debt #146's finding** that source probes read prose — the same tooling, aimed the other way: there the comment made a probe pass, here the comment made a human stop looking. | Before the next build that defers work to another surface in a comment. **The cheap first step is a COUNT** (#174's advice): how many comments name a route or component as the home of something? |
| 179 | 🟡 **A DECLARATIVE FIELD LIST THAT DID NOT MATCH WHAT ITS MIGRATION CREATED — AND NOTHING WE OWN COULD HAVE SEEN IT.** `VENDORS_SELECT` (`vendorIdentity.ts:52`) named **10 columns**; `20260902_vendor_identity_and_preference.sql:126-148` declares **14** non-timestamp columns. The four missing were the ADDRESS — `address_line1`, `address_city`, `address_state`, `address_zip`. 🔴 **The failure mode is not a wrong value, it is an address typed into a form and read back NULL forever with no error anywhere.** The file's own comment two lines above said *"ONE LIST, TWO READERS, AND THAT IS THE WHOLE POINT"* — **true about its intent and false about its effect**, which is the same shape as #180 directly above. ⚠️ **A column with no reader and no writer is invisible to every tool in the repo**: tsc sees a type that agrees with the list, eslint sees nothing unused, knip sees nothing dead, and no probe covers a field nobody references. **The only thing that finds it is a build that needs the fourth column** — which is how it was found. ✅ **RESOLVED IN THE SAME BUILD (#273):** the list is now the SOURCE (`VENDOR_KEY_FIELDS` / `VENDOR_EDITABLE_FIELDS` / `VENDOR_OWNER_ONLY_FIELDS`) and `VENDORS_SELECT` is DERIVED by `.join(', ')`; `vendorEdit.test.ts` §A parses the columns **out of the migration** and fails if the select falls short in either direction; mutant **M1** restores the old literal and is caught. ⚠️ **Filed as the INSTANCE rather than only fixed, on David's instruction** — the class is *a declarative list that does not match what the migration creates*, and `vendors` is one table of many. 🔴 **A consequence worth knowing: a DERIVED select is a plain `string`, so supabase-js can no longer infer the row shape from a literal** — both call sites now state it with `.returns<VendorRow[]>()`. Deriving the list costs the inference; that is the trade, and it is cheaper than the defect. | 2026-09-02 (the select shipped with the table); measured and fixed 2026-09-04 | **Done for `vendors`.** The class fix is a cap that, for every `*_SELECT` constant, parses its table's `CREATE TABLE` out of the migration corpus and asserts the two agree both directions — the §A probe generalised. ⚠️ It must handle tables with no migration (tech-debt #39's live-only schema) by DECLARING them rather than skipping silently. | 🔴 **The next `*_SELECT` that gains a column, or the next table whose form grows a field.** Not urgent for `vendors` (fixed and probed) — urgent for the ones nobody has looked at. **Cheap first step is a COUNT:** how many `*_SELECT` constants exist, and how many of their tables have a migration to check against? |
| 154 | 🟡 **THE LINE-ITEM SEARCH WILL BE CORRECT AT 37 ROWS AND WRONG ABOVE 100 — SHIPPED DELIBERATELY, LABELLED, BY DAVID'S RULING.** `<DataSheet>`'s G6 filters CLIENT-SIDE over already-loaded rows (`DataSheet.tsx:149` — `out.filter(r => searchText(r).toLowerCase().includes(q))`), and `RECEIPTS_PAGE_LIMIT = 100` (`packages/cultivar-os/src/lib/receiptsList.ts:78`). At LAWNS's 37 receipts the page already holds every row, so the search is exact and adding `line_items` to `RECEIPTS_SELECT` costs ~20–25 KB (171 line objects / 36 receipts). 🔴 **Above the cap the failure is a WRONG ANSWER, NOT A SLOW ONE:** *"when did I last buy Osmocote and what did I pay"* would be answered from the newest 100 receipts and report nothing found for a receipt that exists. **Mitigated at ship, not fixed:** a capped page says *"searched the newest 100 receipts"* and never a bare *"nothing found."* | 2026-09-03 (measured during the receipts recon; the cap dates from `ab617b2`) | Move the search SERVER-SIDE — a `jsonb` GIN index over `line_items`, or a generated text column holding the concatenated descriptions and SKUs, queried with `ilike`/`websearch_to_tsquery` so the filter runs across ALL rows rather than the loaded page. **A migration.** | When receipts pass a few hundred rows, or when the QB history import lands more documents than a page holds — whichever first. **David's ruling 2026-09-03: filed OWED with the reasoning, not built now.** *"§6 R1's shape applied to search: a partial answer that names its limit, never a confident absence."* |
| 153 | 🟡 **THE INVOICE NUMBER IS READ ON EVERY CAPTURE AND HAS NOWHERE TO LAND.** `api/receipts/ocr.ts:66` (receipt shape) and `:100` (invoice shape) both request `"receipt_number": "string or null — receipt, invoice, or transaction number if printed"`, so the reader **is** asked and does return it — bwi's is `19837964`, Sudderth's is `9727`. **`receipts` has no column for it and the INSERT does not name it**, so it survives only inside `ocr_raw`. 🔴 **It is the dedup key we now check first** (tech-debt #143 — two duplicate pairs live, one of them a $1,283.88 revenue overstatement, both sharing a document number), so the field that would make the check cheap is the field nobody stored. ⚠️ **Header-level, so a jsonb key on `line_items` cannot hold it — this is a MIGRATION**, unlike the UOM gap below, which is a prompt change. Sibling in shape to #149 (subtotal and tax recovered by parsing the provider envelope because no column exists). | 2026-09-03 (measured; the absence dates from `20260612_receipts.sql`) | `receipt_number text` on `receipts`, populated at capture from the parsed reply — the same place `vendor`, `date` and `amount` already come from. Backfillable from `ocr_raw` by a script that reports its own population. Then the duplicate-capture guard (#143) keys on it instead of inferring from `(vendor, date, amount)`. | The purchase/sale capture split, which is already opening `ReceiptKeeper`'s confirm path — the same build that should add `uom` to the OCR prompt. Adding a column there costs nothing; adding it alone costs a migration and a deploy. |
| 152 | 🔴 **`audit_log` CAN BE WRITTEN BY A MEMBER AND READ ONLY BY `businesses.owner_id` — SO LAUREN CAN RECORD A DECISION SHE CANNOT READ BACK.** `20260623_audit_log_spine.sql` ships two policies and they do not use the same test. **`audit_insert`** admits *owner **OR** `is_active_member(business_id)`* (with the actor-id pin). **`audit_owner_read`** is `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())` — **`owner_id` only, no member clause, no role check.** 🔴 **THE CONSEQUENCE IS NOT HYPOTHETICAL AND IT IS THE ONE PERSON THE PRODUCT IS FOR.** Lauren holds **`role = OWNER` in `business_members` at LAWNS with a `user_id` that is NOT `businesses.owner_id`** — the only such row in the database, and exactly what David's 2026-08-28 ruling gave her. So under R-71 she is asked how a size should read, her answer is written to `audit_log` **attributed to her**, and **she cannot open it.** The trail records her and excludes her. ⚠️ **THE SPINE CALLED THIS OUT AS A DEFERRED PRODUCT DECISION, NOT AN OVERSIGHT** — its own comment says *"owner-only read for now (STATED)… Whether active members may read their tenant's trail is deferred (TBD)"*. **What has changed since is that `role = OWNER` now exists and is not the same set as `owner_id`**, so the policy no longer means what it was written to mean. ✏️ **This is the SAME `owner_id`-vs-`role=OWNER` shape the vendor session measured**, where a first draft would have refused Lauren on her own tenant. ✅ **NOT INHERITED BY THE NEW TABLE:** `20260903b_display_standards.sql` deliberately ships an owner policy **AND** an active-member policy, and owner-test **CARD 22 stops the board** if only one is present. **The in-scope fix is done; this row is the out-of-scope half.** | 2026-06-23 (the policy); the consequence dates from the 2026-08-28 owner-role ruling — measured and filed 2026-09-03 (ledger #262) | **One additional permissive SELECT policy — additive, nothing dropped.** The spine's own note says widening later is exactly that. The open question is WHICH set: `is_active_member` (any active member reads the tenant trail) or a role/permission test (`audit_log:read` is already manifest-declared **owner-only** — see `permissionManifest.ts`), which would admit Lauren without admitting staff. 🔴 **The manifest and the policy must end up agreeing** — today one says *owner-only sensitivity* and the other says *`owner_id` row*, and those are different statements. **David's call, because it is a product decision about who sees a governance trail, not a bug fix.** | 🔴 **BEFORE the normalisation SCREEN ships (CARD 23's owed work).** The moment that screen records Lauren's answer, the defect becomes visible to the one person using it — *"it saved"* and then nothing to look at. ⚠️ **Also re-check it against the live catalog first** (`SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='audit_log';`) — this is measured from the migration corpus, and repo ≠ catalog is the limit that produced instances #2/#3/#9 of that pattern (#124's own warning). |
| 147 | 🟡 **`api/dashboard.ts` HAS NO CALLER, AND HAS NOT HAD ONE FOR AS LONG AS THE ENDPOINT HAS EXISTED.** Measured 2026-09-02: a grep of every `fetch('/api/…')` in the repo returns ten endpoints and **`/api/dashboard` is not among them.** `Dashboard.tsx` reads Supabase directly and mentions the endpoint only in a comment (*"plant_count … is provided by api/dashboard.ts"*), which describes a call that does not happen. ⚠️ **THIS CHANGES THE FRAMING OF THE §2 DEFECT RATHER THAN CANCELLING IT.** The prompt described `leakage_count` as *"computed over all orders on the server and over checkout-only orders on the client"* — true, and the server half had **no consumer**, so the divergence was LATENT rather than live. Latent is precisely the state in which a defect survives to meet its first consumer. **It was fixed anyway** (ledger #255): the endpoint is deployed, reachable, authority-gated, and occupies **one of twelve** Vercel function slots on a Hobby plan that has zero headroom (§6 r11 / tech-debt #41). 🔴 **The real question is not the defect, it is the slot.** | 2026-09-02 (measured; the endpoint predates it) | Either a consumer (the client dashboard reads the endpoint instead of hand-rolling five Supabase queries, which would also END the two-implementations problem at its root rather than keeping them in step) **or deletion**, which returns a function slot to a budget that has none. Keeping an uncalled endpoint in step with a client that ignores it is the most expensive of the three. | **The next time api/ needs a thirteenth function** — that is a STOP-and-surface event today (§6 r11), and this slot is the cheapest one on the list to recover. Or the next dashboard build, whichever comes first. |
| 146 | 🟡 **A SOURCE PROBE THAT SEARCHES A FILE'S TEXT IS READING PROSE, AND THREE OF THEM WERE — INCLUDING ONE THAT HAD BEEN GREEN FOR WEEKS ON A GUARD WHOSE FAILURE IS UNRECOVERABLE.** Found 2026-09-02, three times in one build: (i) a new ordering probe went red because the guard's own COMMENT names `findOrCreateQBCustomer`; (ii) **`historyOrder.test.ts` §I went red for the identical reason** — a probe that had passed since it was written, meaning it had been readable-as-prose the whole time; (iii) a *"does not use a service key"* probe matched the words **inside a paragraph explaining why the component deliberately does not.** 🔴 **THE REDS ARE THE HARMLESS DIRECTION AND ARE NOT WHY THIS IS FILED.** A comment moves an index EITHER way: §I would have **PASSED on a DELETED guard** so long as some comment still mentioned `findOrCreateQBCustomer` or `qbPost` — a green asserting an ordering that no longer exists, on the one guard that writes into a real company's accounting. **That is [[R-33]] exactly** (the thing asserting was incapable of disagreeing) and it was live in the repo. ✅ **Fixed in the three files that hit it** — a shared `stripComments` in `testMode.test.ts`, a local one in `historyOrder.test.ts` — and **proven**: mutants M5/M6 delete each guard's CODE while leaving its COMMENT and are both CAUGHT. 🔴 **THE CLASS IS NOT FIXED.** Nothing surveys the other source probes, and this repo leans on them heavily because they are the only way to assert an ORDERING. ⚠️ **The nearest prior art is tech-debt #119, "the comment-stripper" — the same tool, needed for a different reason, filed and not generalised then either.** | 2026-09-02 (measured; §I dates from 2026-08-27) | **A shared `stripComments` helper the probes import**, rather than three copies with three different limits — and a sweep of every `.test.ts` that does `readFileSync` + `indexOf`/regex over a source file, since each is a candidate for the false-GREEN direction. Per #174's advice the cheap first step is a **COUNT**: how many probes read source at all? | Before the next source probe is written, or the next time a guard's placement is asserted. ⚠️ **Do NOT fix it inside an unrelated build** — rewriting the probe layer in a pass that is not about probes is the drift these caps exist to catch (#73's and #119's own reasoning). |
| 151 | 🟡 **TWO STORES ANSWER ONE QUESTION ABOUT A VENDOR, AND DAVID HAS RULED THEY BECOME ONE — `vendors`.** `20260902_receipt_line_edit_and_vendor_preference.sql` creates **`vendor_preferences`** (keyed `business_id, vendor_key, preference_kind`, holding the billing-unit answer); `thunder/vendor-identity`'s `20260902_vendor_identity_and_preference.sql` creates **`vendors` + `vendor_aliases`**, already carrying `preferred` and `preference_note`. ⚠️ **CORRECTED 2026-09-03: ONE OF THE TWO IS NOW APPLIED.** `20260902_receipt_line_edit_and_vendor_preference.sql` was applied by David 2026-09-03 (catalog-verified), so **`vendor_preferences` is LIVE**; `thunder/vendor-identity`'s `vendors` migration is still unapplied. 🔴 **THE CHEAP WINDOW IS NARROWING, NOT CLOSED** — it closes when `vendors` is applied too. ✏️ *Original: "Neither migration is applied, so this is cheap now and a data migration later."* — true when written 2026-09-02. 🔴 **AND THE TWO DO NOT FOLD THE SAME WAY, WHICH IS THE PART THAT LOSES ROWS IF NOBODY LOOKS:** `vendorKey()` (cultivar-os) lower-cases AND strips punctuation and corporate suffixes, so *"Sudderth Brothers Contracting, Inc."* and *"Sudderth Brothers"* are ONE key; `vendors_business_name_uidx` keys on `lower(btrim(name))`, so they are TWO rows. A backfill joining on the fold silently drops or doubles whichever side disagrees. ⚠️ **`vendors` also has no home for the billing-unit answer** — `preferred`/`preference_note` are a different question. | 2026-09-02 (both migrations written the same day, in two sessions) | **`vendors` is the single store ([[R-65]]).** It gains the billing-unit answer (a column, or a child table keyed on `vendor_id`); `ReceiptDetail` resolves the receipt's vendor string through `vendor_aliases`/the resolver and reads and writes there; `vendor_preferences` is dropped. If David has not yet applied `20260902`, the cheapest correct path is that it is **never created** and the page points at `vendors` from the start. | When `thunder/vendor-identity` merges. 🔴 **Before either migration is applied, if that is still true** — after application this stops being a re-point and becomes a data migration across two disagreeing folds. |
| 150 | 🟡 **A REFUSED EDIT IS NOT RECORDED ANYWHERE, AND THE FIRST DRAFT OF THE CODE CLAIMED IT WAS.** `edit_receipt_line_items` originally INSERTed `action='receipt.line_edit_denied', outcome='denied'` into `audit_log` and then `RAISE`d. It could never work: with no enclosing `EXCEPTION` block the raise aborts the transaction and rolls the INSERT back, so **the row is never committed**. 🔴 **The probe guarding it (`U6`) asserted the STRING `receipt.line_edit_denied` appeared in the file** — which it did, doing nothing — and a rolled-back statement is textually identical to a committed one, so the check was structurally incapable of disagreeing. **R-33 / §6 r19 exactly, one layer out from the seven mutants this same build had already caught for the same reason.** The doomed INSERT is REMOVED (a statement claiming to record a refusal it cannot record is worse than an honest silence) and the owner-test card now proves the gap is where we say it is. **The REFUSAL itself is unaffected and hard** — the RPC raises, and the trigger refuses the same write on every other path. | 2026-09-02 (found in review of #257, before the migration was applied) | A sink outside the aborting transaction. Two shapes, neither chosen: **(a)** the RPC returns a refusal instead of raising, the caller inspects it, and the audit row commits — but a returned refusal is easier to ignore than a raised one, and CARD 8 currently proves the hard error; **(b)** an out-of-transaction writer (a trigger on a separate connection, an edge function, or a denials table written by a path that does not raise). ⚠️ **Whichever is taken applies to every raising guard we have, not just this one** — the trigger has the same property. | The next build that needs denied attempts to be COUNTABLE — the abuse-guard work, or the first paying customer, whichever comes first. Not urgent while David is the only human with access. |
| 149 | 🟡 **SUBTOTAL AND TAX HAVE NO COLUMNS, AND THE DETAIL VIEW RECOVERS THEM BY PARSING THE AI PROVIDER'S RESPONSE ENVELOPE.** `receipts` has 21 columns and neither `subtotal` nor `tax` (measured 2026-09-02). The OCR parses both — non-null on **30 of 35** rows whose reply is recoverable — and the capture path stores the TAX by synthesising a `{description:'Tax'}` line item, while **the SUBTOTAL is stored in no field at all.** So `/receipts/:id` reads them back out of `ocr_raw.candidates[0].content.parts[].text` — the model's raw reply, nested as an escaped string inside a Gemini-shaped envelope. ⚠️ **It already fails for 1 of 36 rows**, which carries an Anthropic-shaped envelope (`model\|stop_reason\|usage`) with no recoverable inner JSON; that row honestly reports *"not recorded"* rather than `$0.00`, so the defect is contained and visible rather than silent. 🔴 **But the containment is the mitigation, not the fix: this is application logic reading a VENDOR'S wire format.** A provider change, a model that stops fencing its JSON, or a second provider in the mix and the figures vanish across the board — and the only signal would be every receipt suddenly saying the subtotal was not recorded. | 2026-09-02 (measured; the absence dates from `20260612_receipts.sql`) | `subtotal numeric(10,2)` and `tax numeric(10,2)` on `receipts`, populated at capture from the parsed reply — the same place `amount` already comes from. Additive, no backfill required for correctness (existing rows keep recovering from `ocr_raw`, or are backfilled once from it by a script that reports its own population). ⚠️ **The synthesised `Tax` LINE should stay** — it is what makes the lines reconcile against the total, and removing it would break `reconcile_delta` on 30 rows; the column is an addition, not a replacement. | The purchase/sale capture split (R-50 / the *one pipeline, two doors* build), which is already opening `ReceiptKeeper`'s confirm path and already writes this row. Adding two columns there costs nothing; adding them alone costs a migration and a deploy. |
| 148 | 🟡 **`accept_vs_edit` MEASURES THE PLATFORM'S OWN FORMATTING, NOT THE OWNER'S INTENT — AND THIS BUILD FIXED THE SENTENCE, NOT THE FLAG.** It reads `edited` on **35 of 36** rows. Measured field by field against the reader's own parsed output (population 35): **vendor differs 0 · amount 3 · category 2 · date 29 · lines 30.** Both large counts are self-inflicted: `detectAcceptVsEdit` compares `fields.date` — already run through `toISODate`, so `06/22/2026` has become `2026-06-22` — against the RAW `p.date` and calls the conversion an edit; and `countEditedLineItems` compares the tax-INJECTED array against the un-injected snapshot, counting the line the platform itself pushed as a line the owner added. `header_amount_edited` is **false on 36 of 36**. 🔴 **The user-visible harm is fixed** (the list said *"Owner changed something before saving"* on nearly every row Lauren ever captured — an accusation the data does not support) **and the WRITE PATH is unchanged**, so every new capture still banks the same misleading flag. | 2026-09-02 (measured; the defect dates from `20260614_receipts_reconciliation.sql`'s consumer) | Compare like with like at the point of capture: normalise BOTH sides of the date before comparing, and diff the line items against the array the owner was actually shown (tax line included) rather than against the pre-injection snapshot. Two small changes in `detectAcceptVsEdit` / `countEditedLineItems`. | 🔴 **DELIBERATELY NOT DONE IN THIS BUILD, AND THE REASON IS THE DATA, NOT THE EFFORT.** Fixing the writer gives the column **two meanings either side of an unrecorded date** — 36 rows meaning *"our formatting moved"* and every later row meaning *"the owner changed something"* — with nothing on the row to say which. That boundary has to be recorded (a migration stamping the existing rows, or a new column and this one retired), and choosing between those is David's, not a side effect of a view build. Take it with the capture-path work that R-50 already opens. |
| 145 | 🟡 **THERE IS NO PER-RECEIPT VIEW, AND A REAL CALLER HAS BEEN DEGRADING INTO ITS ABSENCE SINCE BEFORE THE LIST EXISTED.** `ProjectCostDrillIn.tsx` wants `/receipts/:id`, does not have it, and navigates to `/receipts` with a comment saying so. **The list landing changes the SHAPE of the degradation rather than fixing it:** the drill-in now arrives at a page that CAN show the receipt it means and cannot be told which one, so a reader is handed seventeen rows and left to find it. Deliberately out of scope this build — it was named as option D. | 2026-09-01 (the degradation predates it; logged when the list made it visible) | A `/receipts/:id` route rendering the one row. The model is already built and pure (`receiptRowModel`), so the ROUTE is the work, not the content; deep-link or scroll-and-highlight both satisfy the caller. | The next time anything needs a SPECIFIC receipt open rather than the list — i.e. the cost-assignment build, where a receipt sits beside the cost node it substantiates. |
| 144 | 🔴 **THE COUNT-ONCE DEDUP SEAM WAS DESIGNED ON 12 JUNE AND HAS NEVER BEEN WRITTEN BY ANYTHING. MEASURED 2026-09-01: `cost_objects.receipt_id` populated 0 of 5; `business_inventory.receipt_id` populated 0 of 447.** Three tables carry a `receipt_id` FK for exactly this purpose (`business_inventory` — `20260612_business_assets_inventory_cost_confidence.sql:56`; `cost_objects` — `20260615_cost_objects_substantiation_d5.sql:50`; `business_service_log` — `20260612_business_assets_inventory_pmi_service.sql:234`), and **the migration comments describe it as the join that PREVENTS DOUBLE-COUNT in the cost accumulator.** A seam nothing populates prevents nothing: `sameCost()` container rules run with that signal permanently NULL, which is harmless today only because 5 cost objects is a number a human can hold in their head. **Not a backfill this build may perform — live customer data.** | 2026-09-01 (measured; the columns date from 2026-06-12/15) | The WRITER, not the column: whatever creates a `cost_object` or a `business_inventory` row from a captured document stamps the `receipt_id` it came from. Sibling in shape to the `order_id` seam `20260827_history_orders.sql` added for deliveries — which IS written, and IS populated 30/30. | The cost-assignment build (R-46/R-47 destinations). It cannot be built correctly without this: the destination of a purchased line is meaningless if the line cannot be traced back to its document. |
| 143 | 🟡 **NOTHING STOPS THE SAME DOCUMENT BEING CAPTURED TWICE, AND TWO PAIRS ARE LIVE.** Measured 2026-09-01: **bwi 2026-07-29 $1,283.88 captured twice** (`e301ece1`, `83dc023d`) — and each copy produced its OWN order, **both carrying document number 19837964**, both with a delivery whose `delivery_date` is NULL — and **Bailey Bark Materials 2026-07-07 $2,316.03 captured twice** (`e509fb65`, `fb27da2d`), neither of which produced an order. There is no content-key check at capture and no uniqueness in the schema: across all three of its migrations `receipts` carries **no unique index other than its primary key**. ⚠️ **The two orders are the sharp end** — one vendor invoice appearing as two sales is a revenue overstatement of $1,283.88 sitting in live data. **SURFACED by the receipts view, deliberately NOT REPAIRED:** repairing live customer data is David’s call, not a step inside a view build. | 2026-09-01 (measured; the captures date from 1 September) | A **partial unique index** on a content key — `(business_id, vendor, date, amount)` — plus a capture-time warning that NAMES the existing row rather than a hard refusal, because a genuine second invoice for the same amount on the same day from the same vendor is possible and a refusal would be wrong. 🔴 **The index cannot land until the live data is clean** — it would reject both existing pairs. **Exactly the shape of #58 and #54:** a code-level guard is proportionate now, the DB constraint is the durable form, and the data must be remediated first. | David rules on the four live rows (merge / delete / keep). The guard lands with the capture-side one-pipeline-two-doors build (R-50), which is already touching this surface. |
| 142 | ✅ **RESOLVED 2026-09-01 (ledger #249) — THE §3 RETENTION DEFECT HAS A MECHANISM, AND THE ROOT CAUSE WAS STRUCTURAL RATHER THAN CARELESS.** Three occurrences (2026-08-30 (6)/(7), 2026-08-31 (6), 2026-09-01), each one two concurrent branches archiving the SAME overflow entry so the archive held it twice and §3 kept four. 🔴 **WHY IT KEPT RECURRING AFTER BEING NAMED: each branch verifies `entries-in == entries-out` against the main it BRANCHED FROM. That check is TRUE on both branches and FALSE at the merge, and nothing had ever verified it post-merge.** The #244 close-out already called it *"a pattern rather than an accident"* — a pattern that recurs after being named is waiting for a mechanism, not another note. **FIX: `scripts/verify-handoff-retention.mjs`, wired into `npm run verify`** — §3 ≤ 3 · no entry in BOTH §3 and the archive (**this is the clause that catches the merge bug, and it is invisible to any per-branch count**) · no entry twice within the archive · neither file emptied. ✅ **RED ON THE REAL TREE THREE TIMES BEFORE PASSING, and it corrected ITSELF twice:** it first cried wolf on two DIFFERENT 2026-06-09 sessions that legitimately share a title (→ compare full entry TEXT, never headings), then MISSED the real duplicate because the merge had wedged the archive's own preamble into one copy (→ strip HTML comments, `>` blockquotes and `---` rules first). Both corrections are recorded at the code as the reasons they exist — a check that cries wolf gets deleted, which is how the thing it guards starts failing again. | 2026-09-01 | Built and wired. | — |
| 124 | 🔴 **EIGHTEEN WRITE-CAPABLE POLICIES GATE ON `is_active_member` ALONE, WITH NO PERMISSION STRING — ANY ACTIVE MEMBER INCLUDING STAFF CAN WRITE.** 🔴 **`business_inventory` IS THE ONE TO LOOK AT FIRST:** `business_inventory_member_all`, no `FOR` clause (Postgres defaults to ALL), so a STAFF session can insert, update and delete inventory rows with no permission gate whatsoever. **THE FULL SET, from the migration corpus:** `business_inventory` · `business_inventory_ledger` · `business_pmi_schedule` · `business_service_log` · `business_modules` · `business_discovery_profiles` · `cost_objects` · `cost_object_edges` · `cost_object_assignments` · `labor_resources` · `deliveries` · `receipts` · `inventory_counts` · `inventory_count_sessions` · `audit_log` (INSERT) · `storage.objects` (INSERT). ⚠️ **THREE PROBABLE FALSE POSITIVES, named rather than silently filtered:** `md_self` on `member_devices` is self-scoped (`user_id = auth.uid()`), `cultivar_plants_owner_all` is the fused owner-OR-member shape, and `audit_log`'s INSERT is very likely deliberate — an audit row must be writable by whoever is being audited. **Confirm each before treating it as a finding.** 🔴 **WHY THIS IS A CLASS AND NOT A LIST: it is the exact mirror of what Pass 2 (#228) just spent a build fixing.** That pass widened three surfaces that were too NARROW — an OWNER-role member refused by policies fencing on `owner_id`. This is eighteen tables that are too WIDE, in the same schema, at the same time. **We were measuring one direction of a two-directional problem**, and the query that found this was owed since the 2026-08-29 permissions audit precisely because the audit's third query filtered on `has_permission` and therefore could not see a policy that never mentions it. ⚠️ **tech-debt #123 (`business_pmi_schedule`, the last un-flipped DUAL_TABLES row) IS ONE ROW OF THIS CLASS** — and is itself cited by number in several places while NOT EXISTING in this log (see the #122/#123 drift note below). | 2026-08-29 (LAWNS discovery) | Every write-capable policy either names a permission string via `has_permission`, or is a DECLARED exception carrying its reason — the shape `select-policy-declarations.json` already uses for deny-all tables. The mechanisable form is the Part-1 fix named in the discovery doc: **a check that the three authority sources agree** — manifest status, live policy, and declared exception. | 🔴 **BEFORE ANY FIX OR ANY CANCELLATION: CONFIRM AGAINST THE LIVE CATALOG.** This was measured from the MIGRATION CORPUS, and repo ≠ catalog is the limit that produced instances #2, #3 and #9 of the same pattern. `SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename;` — David runs it. **Not to be fixed in the pass that found it** (David's instruction: file as a class, do not fix). |
| 123 | 🔴 **AN ACTIVE STAFF MEMBER CAN WRITE THE PMI SCHEDULE, AND IT IS A HOLE RATHER THAN A CONVENIENCE.** `business_pmi_schedule_member_all` is a **`FOR ALL` policy keyed on `is_active_member(business_id)` with NO permission string** ([`20260622_is_active_member_canonical_rls.sql:141-144`](../supabase/migrations/20260622_is_active_member_canonical_rls.sql#L141-L144)). It is the **last un-flipped row in `verify-universals.mjs`'s `DUAL_TABLES`** — the 2026-07-27 RBAC flip verb-split every neighbouring table (`cost_objects`, `deliveries`, `business_inventory`, `receipts`, `business_service_log` …) and this one was left as it was. So a STAFF member who holds **none** of `pmi:read` / `pmi:update` can nonetheless SELECT, INSERT, UPDATE and DELETE maintenance schedules — including deleting the cadence that says a machine is due. ⚠️ **The permission strings exist and are held correctly** (MANAGER has both, STAFF has neither): the manifest and the policy simply disagree, and `verify-authority-checks` already reports it as known-gap **P5** — *"resource 'pmi': no policy on business_pmi_schedule checks any string that resolves to pmi:\*"*. **The gap has been visible in every verify run and nothing acted on it.** ⚠️ **NOT FIXED HERE, on instruction**: surfaced by the operations-calendar Stage 0 recon (whose G2 premise was that this table was owner-only — it is the opposite), and a policy change belongs to the permissions pass, not a calendar build. ⚠️ **REPO-CORPUS EVIDENCE, NOT CATALOG:** `SUPABASE_PAT` was absent that session, so this is what the migrations say, not what the live catalog was observed to hold. Confirm against `pg_policies` before writing the fix. | 2026-06-22 (found 2026-08-28, ledger #233) | The verb-split every sibling already has: `business_pmi_schedule_member_select` on `pmi:read`, and insert/update/delete on `pmi:update`. `20260828_business_operating_days.sql` deliberately ships in that shape rather than copying this one. Closing it also closes capP's P5. | **The next permissions pass** — it is a live authority hole, not a latent one, and R-23's *"Juan logs his own PMI"* build will touch these exact policies. Do not close it inside an unrelated build. |
| 122 | 🟡 **`orders.delivery_date` AND `deliveries.delivery_date` ARE TWO RECORDS OF ONE FACT, AND THE ASYMMETRY BETWEEN TENANTS IS NOW MEASURED.** This is **[[#108]]'s no-natural-key problem carrying a second consumer**, filed with evidence rather than restated. Measured live 2026-08-28: **LAWNS — 9 orders with a `delivery_date`, 9 `deliveries` rows, all 9 linked by `order_id`** (the 2026-08-27 history-order backfill set them). **Test Dave's — 18 orders with a `delivery_date`, 15 `deliveries` rows, and `order_id` populated on ZERO of them.** So on Test Dave's the two tables describe overlapping-but-unjoinable work: 2026-09-04 carries 2 delivery rows and 3 dated orders, and nothing can say whether that is 3 stops or 5. **The operations calendar reads `deliveries` ONLY and says so on the screen** — a deliberate, named absence rather than a dedupe rule invented inside a calendar build, which is how the calendar would have become where the duplicate-delivery bug lives. | 2026-08-25 (checkout delivery path); measured + filed 2026-08-28 (ledger #233) | ONE record of a scheduled stop. Either the checkout path always creates a `deliveries` row carrying its `order_id` (and `orders.delivery_date` becomes derived or retired), or a real key joins them. **The backfill for existing rows is the hard half** — Test Dave's 15 unlinked rows have no field that identifies which order made them. | Before ANY consumer unions the two — a booking/slot screen, a capacity readout, or a driver manifest. The calendar is the first consumer to want to and the first to refuse. |
| 121 | 🟡 ✏️ **CORRECTED 2026-09-09 BY DAVID — THIS ROW SAID MORE WAS MISSING THAN IS. THE START/DONE TAPS ARE BUILT AND LIVE:** `/delivery-schedule` renders **Start this stop** on every row and **Mark done** on one, and **`started_at` IS SET on delivery `57c31e32`** (Paul Christ, 2026-09-04 21:50) — so the migration is applied and the control writes. 🔴 **WHAT REMAINS TRUE, AND ONLY THIS: `completed_at` is NULL on all 56 rows and `status` is `scheduled` on all 56.** Nothing has been carried through to done. ⚠️ **The reschedule half is unchanged and now has its own entry — a move is not logged at all (#229).** *(Prior wording, kept because it was true when written:)* **PARTIAL 2026-08-31 (ledger #247) — THE CONTROL EXISTS; THE ROW STAYS OPEN UNTIL THE MIGRATION IS APPLIED AND DAVID HAS TAPPED IT.** A crew member marks a stop done from `/delivery-schedule` on a phone: `status='fulfilled'` plus `started_at`/`completed_at`, written as a plain RLS UPDATE under their own session (`deliveries:update`, held by all three bundles). ✅ **The prediction in this row's own FIX column held exactly** — `historyOrder.ts`'s `DELIVERY_COMPLETE` already accepted `fulfilled`, so the order status follows with no second rule, and a test now reads that list out of the real source file so the two cannot drift apart silently. 🔴 **STILL OPEN, and these are why:** `20260831d` is **GATED and UNAPPLIED** (four nullable columns — until David runs it the screen honestly says the control is unavailable rather than showing buttons that cannot write); **nothing has been owner-proven**; and **Lauren Frazier's 2026-08-26 install, and Saturday 2026-08-29's six real stops, are still unmarked** — that is David's to run, not a builder's. ⚠️ **And the half that is not built at all: a RESCHEDULE still cannot say where it went or why** — the `why` vocabulary is owed by David, so a day still cannot be read back as *"six completed · one moved to the 5th"*. | 2026-08-27 (ledger #224) | A **mark-delivered** control on the delivery surfaces, writing a complete-state value. `historyOrder.ts`'s `DELIVERY_COMPLETE` list already accepts `complete`/`completed`/`delivered`/`fulfilled`/`done`, so the order status follows automatically the day one lands — no second rule to rediscover. | Before any owner asks *"which of this week's installs are done?"* — i.e. the first Monday after a real delivery Saturday. **2026-08-31 is the natural trigger**, the Monday after the five 08-29 stops. |
| 120 | 🟡 `receipts` has no field registry. `customers` is the only entity with a declarative one (`customerFieldRegistry.ts`); every other entity restates its column set by hand at each read site. This build added one more — `customers/create.ts` selects `id, business_id, date, amount, ocr_raw, line_items_original` from `receipts` to build a history order — and had to be **DECLARED** in `verify-field-lists.mjs` rather than derived. Filed rather than fixed because minting a registry inside an unrelated build is exactly the drift these caps exist to catch (same call as #73's `OWNER_ONLY_PENDING` and #119's comment-stripper). | 2026-08-27 (ledger #223) | A `receiptFieldRegistry.ts` on the `customerFieldRegistry` pattern, with the select derived from it and a coverage check asserting in BOTH directions. R-19's shape: a field list that claims to cover a record must cover it, and a check must say so. | ⚠️ **`cost_objects` outranks this one and should go first** — `verify-field-lists.mjs`'s own header already counts it as read through FOUR hand-written select strings in four files; `receipts` is at two. Take them as one pass when the next build touches either surface. |
| 1 | 🟢 Cultivar OS dashboard tiles — handleNavigate() was an empty stub. Fixed 2026-05-29: qr_checkout → /orders, qb_invoicing → scroll to #qb-section, social_media → /social/setup, delivery → /deliveries. All active tiles now navigate correctly. | Resolved 2026-05-29 | n/a | — |
| 2 | QB integration is hardcoded with `IGNITION_OS_DATA` reference | Pre-2026-05-23 (per Session 1a audit findings) | AccountingAdapter interface per PLATFORM_STRATEGY.md target architecture; vertical-agnostic | When second vertical (KINNA-OS Phase 1) needs QB or alternative accounting connector |
| 3 | Social module lives in cultivar-os/api/, not packages/shared/ | Pre-2026-05-23 (per audit findings, Cultivar-only by accident) | Per PLATFORM_STRATEGY.md target: extract to packages/shared/src/social/ | Before Conduit OS or KINNA-OS need social composer |
| 4 | Hardcoded nursery footer in PlantProfile.tsx line 108 — `LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336` — bypasses the nurseries table row that contains the same data | Pre-2026-05-27 (surfaced by Session K subsystem audit) | Component should read from the nursery object loaded via existing hooks; eliminate the literal string | Before next nursery customer onboarding (would display LAWNS data for the wrong nursery) |
| 7 | orders table had no SELECT RLS policy from May 17 (table creation) until May 27. Dashboard read path uses anon key (subject to RLS); write path uses service key (bypasses RLS). Result: orders saved successfully but were invisible to the dashboard's Today's Sales, Installs, and Leakage metric tiles. Same root cause as modules/nursery_modules bug fixed May 22. | 2026-05-17 (orders table creation) through 2026-05-27 (fix) | Every Supabase table read from the frontend needs at least one SELECT policy for the authenticated role. Currently loose (USING true); will be tightened to owner_id join post-demo per existing pattern. Migration: 20260527_orders_authenticated_select_policy.sql. | Resolved 2026-05-27 (policy applied manually for demo Supabase project; migration committed for future projects). |
| 8 | 🟡 nurseries, plants, plant_events, addons — RLS policies exist on these tables (migrations were run) but authenticated SELECT has never been explicitly confirmed via a frontend read in the bgobkjcopcxusjsetfob project. They work in practice for the demo flow, but "it worked once" is not VERIFIED. Same root cause pattern as #7 has struck three times already. | Pre-2026-05-22 (tables predate project separation; RLS migrations ported but not spot-checked post-move) | Each table needs a confirmed authenticated SELECT verified by watching the frontend read succeed after login — not just a migration in the log. Owner: David. | Before next vertical ships OR on next RLS-related change, whichever comes first. Resolve to 🟢 (spot-check passes) or promote to 🔴 (document the gap and add SELECT policies). |
| 9 | 🟢 `packages/shared/src/ai/AIEngine.ts` EXISTS and is fully implemented. 3 modules in packages/ignition-os/ already import from `@trace/shared/ai/AIEngine` (IgnitionAudit, IgnitionCipher, PredictiveKey). AIEngine.call() fails gracefully — returns `{ ok: false }` on network error, never throws. AI features are non-blocking. | Resolved 2026-05-28 | AI features go live when Vercel serverless functions replace ai_router.py. No Railway dependency. | See Tech Debt #13. |
| 10 | 🟡 `packages/ignition-os/modules/SavingsReport.jsx` is MISSING from the monorepo. The module ID `savings_report` is fully implemented in `AIEngine.ts` → `ai_router.py` (calls Claude Sonnet, analyzes shop job/margin data, returns flagged jobs + recoverable revenue). The React component that displays the output was not migrated from CAI. `IgnitionOmniDashboard.jsx` renders `<SavingsReport />` in the SAVINGS tab — that tab is broken until this component exists. | 2026-05-28 (discovered during web build attempt) | Build `packages/ignition-os/modules/SavingsReport.jsx` — React component that calls `AIEngine.savingsReport(shopId, tier)` and renders the result. The API contract is defined. This is display work, not AI work. | Before next Ignition OS demo or dry run. |
| 11 | 🟢 Ignition OS web build COMPLETE. `packages/ignition-os/` is confirmed canonical source (diff with CAI/ was zero for all business logic). Build infrastructure added: `package.json`, `vite.config.js`, `index.html`, `main.jsx`, `stubs/` (5 files), `IgnitionVIN.jsx` web stub, `PriceField.js` re-export fix. Build verified: 1825 modules, zero errors. `CAI/` is now archive. Vercel project setup instructions documented in CLAUDE.md §2. | Resolved 2026-05-28 | n/a | — |
| 12 | 🟡 `CAI/ai_router.py` (Railway FastAPI) was built to keep AI provider keys out of the React Native bundle. Now that Ignition OS is a Vercel web app, this is unnecessary — Vercel serverless functions hold keys server-side, same pattern cultivar-os uses for Claude calls today. Railway is still running but is legacy for the web build. AIEngine.ts currently points to `VITE_API_URL` which is unset in the ignition-os Vercel project — **EVERY AIENGINE CALL IN IGNITION VERCEL PRODUCTION RETURNS `{ ok: false }`. Ignition AI is DARK in production (Audit 2, 2026-06-06).** Railway receives zero web-build traffic → safe to kill clean. **Agreed kill path (v7 §15):** retire orphaned tasks (`invoice_scan`, `vin_decode`) — do NOT port them; port real tasks (`dtc_decode`, `estimate_draft` first — text-only, highest value); evaluate `voice_transcribe` (4.5MB Vercel limit) before deciding port vs. retire. Kill Railway after confirmed tasks are live. Receipt Keeper is Vercel-native from birth — adds zero Railway debt. | 2026-05-28 (decision made); DARK-in-prod finding confirmed Audit 2, 2026-06-06 | Port real ai_router.py endpoints to TypeScript Vercel functions under `packages/ignition-os/api/`. Retire orphaned tasks. Decommission Railway. | Before activating AI features in ignition-os web. |
| 13 | 🟡 Vite build aliases for `react-native`, expo packages, and `lucide-react-native` exist in both `CAI/vite.config.js` AND `packages/ignition-os/vite.config.js` — duplicated. The stubs in `CAI/stubs/` and `packages/ignition-os/stubs/` are identical files in two places. | 2026-05-28 | Extract stubs to `packages/shared/stubs/` and reference from both vite configs. Low priority — only matters if stubs need to change. | If stubs ever need updating, deduplicate first. |
| 14 | 🟢 **RESOLVED 2026-06-10 (THUNDER · Tailwind pass).** ~~Tailwind CSS via CDN in `packages/ignition-os/index.html`. 34 files with 2,474 className= lines.~~ **Fix applied:** All 34 files converted to inline `style={{}}` + `ign-*` custom CSS classes. `ignition-theme.css` handles all pseudo-states (hover/focus/active/disabled) and animations. CDN script tag removed from `index.html`. One commit per file. Both builds verified: ignition 1838 ✅ · cultivar 2176 ✅. Non-1:1 report in `docs/tailwind-conversion-progress.md`. `STYLE_DEBUG = false` STD-003 guard added to every converted file. **Policy remains: NO new Tailwind anywhere.** Inline styles via `style={{ ... }}` are canonical. Shared design token file: `packages/shared/src/design-system/tokens.ts`. | 2026-05-29 (identified) → 2026-05-31 (deprecated) → 2026-06-10 (RESOLVED) | ✅ RESOLVED 2026-06-10 | `docs/tailwind-conversion-progress.md` |
| 15 | 🟢 **RESOLVED 2026-06-08 (commit `444fbb1`).** ~~HONEST-DEBT: `businesses.accounting_needs_reconnect` reads `false` while the QB token is expired. The flag only flipped on a 401 during an active invoice call — meaning a dead connection stayed silent until something failed mid-use.~~ **Fix applied:** (1) `qbo/status.ts` — on every dashboard load, fetches `accounting_token_expires_at`; if token is missing or expired, calls `refreshQBToken()`; if refresh succeeds → `needsReconnect: false` (silent, no banner); if refresh fails → `needsReconnect: true` (DB updated, banner fires). (2) `Dashboard.tsx loadMetrics()` — also selects `accounting_token_expires_at`; client-side derives early estimate (`expiresMs < Date.now()`) so banner appears immediately without waiting for status check. (3) `checkQbStatus()` — always applies the server's authoritative `needsReconnect` result, clearing banner if silent refresh succeeded. STD-007 added to STANDARDS.md as the class-of-bug record. | Audit 6, 2026-06-06 | ✅ RESOLVED 2026-06-08 | — |
| 16 | 🟡 **B barrel swap DONE 2026-06-11.** ~~TECH-DEBT: `packages/shared/src/business-logic/marginEngine.ts` is a ~17-line stub that silently underdelivers.~~ **Canonical engine built 2026-06-10 (THUNDER · Build 1):** `packages/shared/src/business-logic/MarginEngine.ts`. 4-slab + tier discounts + `overheadPerUnit`. All 5 old implementations marked 🔴 DEPRECATED. **B barrel swap done 2026-06-11:** `packages/shared/src/pricing/marginEngine.ts` (broken stub, broken rounding) DELETED. `shared/src/index.ts` now exports canonical engine. Migration checklist: `docs/audits/margin-engine-migration-checklist-2026-06-10.md`. **Engine remains ORPHANED** — STD-001 investigation confirmed Cultivar has ZERO pricing/margin callers (B2C retail model: prices stored as final values in DB; no cost-to-retail engine in use). **Remaining work:** A callers (Ignition import-path swaps, no price change). Cost-to-Produce tile = first Cultivar caller (needs `plants.cost_price` DB column). C/D callers (after accepted price change). | Stub introduced pre-2026-05-29; overhead orphaned confirmed Audit 4, 2026-06-06; engine built 2026-06-10; B swap 2026-06-11 | A callers next (Ignition). Cost-to-Produce tile = first Cultivar caller. Overhead wire: IgnitionProt → DataBridge `margin_config.overheadPerUnit`. | A callers unblock after Ignition next-session. Cost-to-Produce tile unblocks after `plants.cost_price` schema added. |
| 17 | 🟡 **STD-008 SWEEP — `20260523_qb_token_expires_at.sql` (DEAD MIGRATION):** Adds `qb_token_expires_at` and `qb_needs_reconnect` to the OLD `nurseries` table, which was superseded by the `businesses` table (May-29 migration). Zero code reads these columns in any current file. The equivalent columns on `businesses` (`accounting_token_expires_at`, `accounting_needs_reconnect`) were added by the May-29 migration and are in use. The nurseries-table additions are dead code in the DB. STD-008 sweep finding 2026-06-08. | STD-008 sweep 2026-06-08 | No code fix needed — nurseries columns are dead. If the nurseries table is ever retired, drop them in that cleanup migration. | When the nurseries table is formally retired (post-demo cleanup pass). |
| 18 | 🟡 **STD-008 SWEEP — `20260603_business_members_add_pin_hash.sql` (UNVERIFIED LIVE APPLICATION):** The migration adds `pin_hash text` to `business_members` in bgobkjcopcxusjsetfob. `OwnerSignup.tsx:301` inserts `pin_hash` on every signup. The June-3 handoff required David to apply this migration manually; `test-member-login.mjs` passed (29/29) the same session, suggesting it was applied. However, the application was never confirmed via an `information_schema.columns` query (STD-008 did not exist at the time). If `pin_hash` is missing from the live DB, new signups silently fail to store the PIN hash. STD-008 sweep finding 2026-06-08. | STD-008 sweep 2026-06-08 | Verify: run `SELECT column_name FROM information_schema.columns WHERE table_name = 'business_members'` in Supabase SQL editor — confirm `pin_hash` is present. Mark 🟢 if confirmed. | Next signup-flow session or before onboarding Erin. |
| 19 | 🟡 **STD-009 SWEEP — `packages/shared/src/campaigns/generate.ts:129` HARDCODED CHANNEL FALLBACK:** The PostDraft mapping has `channel: p.channel ?? p.platform ?? enabledChannels[0]?.name ?? 'instagram'`. The `?? 'instagram'` final fallback hardcodes a channel name into the output-assembly path. If the AI returns a post without a `channel` field AND `p.platform` is also absent, the post is silently assigned to 'instagram' regardless of which channels were requested. STD-009 sweep finding 2026-06-08. | STD-009 sweep 2026-06-08 | Fix: replace `?? 'instagram'` with `?? enabledChannels[0]?.name ?? null` — derive from the enabled channels list, not a hardcoded name. | Before a business with Instagram disabled runs campaigns. |
| 20 | 🟡 **STD-009 SWEEP — `packages/shared/src/campaigns/types.ts:18` INCOMPLETE PLATFORM UNION:** `CampaignPost.platform` is typed as `'instagram' \| 'facebook' \| 'sms' \| 'email'` — missing `'tiktok'` and `'twitter'`. The campaign generator now produces posts for those channels. Downstream TypeScript consumers that switch on `platform` will have exhaustive-check gaps for tiktok and twitter. STD-009 sweep finding 2026-06-08. | STD-009 sweep 2026-06-08 | Widen to `string` (preferred — AC-1) or add `\| 'tiktok' \| 'twitter'`. 'string' is cleaner since advert_channels is open-ended. | Before next TypeScript strict mode pass or when tiktok/twitter channels go live. |
| 21 | 🟡 **STD-009 SWEEP — `packages/cultivar-os/api/campaigns/publish-post.ts` ORPHANED FILE:** Superseded when campaigns API consolidated into `packages/cultivar-os/api/campaigns.ts`. Contains dead code — no caller routes to it. Not a Vercel function. Safe to delete. Also: `packages/cultivar-os/api/campaigns/generate.ts` (same consolidation). STD-009 sweep finding 2026-06-08. | STD-009 sweep 2026-06-08 | Delete both orphaned files. Remove `api/campaigns/` subdirectory. | Next cleanup pass (low priority — dead code, no execution risk). |
| 22 | ✅ **RESOLVED 2026-08-22 — IT WAS APPLIED AND NOBODY WROTE IT DOWN, WHICH IS ITS OWN CLASS.** David's live probe returns `CHECK (platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'tiktok'::text, 'twitter'::text, 'sms'::text]))` — **byte-for-byte what [`20260609_social_drafts_platform_check.sql:33`](../supabase/migrations/20260609_social_drafts_platform_check.sql#L33) was written to produce, `sms` included.** The migration was applied; the row was never flipped, so it has read *"David must apply"* for **74 days** while the thing it asks for was already done. 🔴 **RECORD THIS AS THE STD-008 INVERSE'S THIRD FORM.** The two known forms are **live-object-in-no-migration** (this row's original finding) and **migration-written-not-applied** (the gated-migration backlog). The third is **MIGRATION-APPLIED-BUT-RECORDED-AS-PENDING** — and it is the most dangerous of the three, because the other two make the platform *look* broken while this one makes it look like there is work outstanding that isn't, and a backlog with false entries is a backlog people stop reading. **Same shape as ledger #187's missing row and the 19-days-late OWED flip (#188): the DEFECT was fixed and the RECORD was not, twice in one month.** ✏️ **AND THE FIX NEVER TRAVELLED — see #91.** The atomic-batch reasoning in `20260609`'s own header (*"the insert is atomic, one sms row rolls back all rows"*) was diagnosed here, fixed here, and never carried to `campaign_posts`, which has had the narrower constraint the entire time. **One table was fixed; its sibling was not, and the sibling is the one that broke on 2026-08-22.** — ORIGINAL ENTRY: 🟡 **STD-008 INVERSE SWEEP — `social_drafts_platform_check` (PENDING DAVID VERIFICATION):** Hand-applied CHECK constraint existed in live DB with no committed migration. Allowed list was `(instagram, facebook, tiktok, twitter)` — no 'sms'. When SMS enabled in advert_channels, `generate-posts.ts` batch-inserted all channels atomically; the sms row triggered the constraint violation; PostgREST rolled back ALL rows. Zero rows written per generation run. Confirmed 2026-06-09 via live probe. Fix: `supabase/migrations/20260609_social_drafts_platform_check.sql` — drops hand-applied constraint, recreates including 'sms'. ⚠️ David must apply migration and run VERIFICATION QUERY. | STD-008 inverse sweep 2026-06-09 | Migration written — David applies to bgobkjcopcxusjsetfob + runs verification query. Mark 🟢 after constraint shows 5 values in pg_get_constraintdef result. | Apply before next social-posts generation attempt with SMS enabled. |
| 23 | 🔴 **ESCALATED 2026-08-22 — STILL OWED AFTER 74 DAYS, AND THE EVENING THAT ESCALATED IT PRODUCED TWO INSTANCES ON ADJACENT TABLES.** #22 (`social_drafts`, applied-but-recorded-as-pending) and #91 (`campaign_posts`, two CHECKs that disagree) were both found by hand, both in one evening, both on tables that sit beside each other in one feature. 🔴 **Per David's #174 ruling, two found by accident is an UNMEASURED CLASS, not a small one** — the fix for two is two edits, the fix for thirty is a derivation, and **nobody has the number.** This row is the reason: the sweep that would produce it was written 2026-06-09 and has never been run. ✏️ **AND 2026-08-22 CHANGED WHAT THE SWEEP MUST DO, which is the useful part of escalating rather than just re-flagging.** The commissioned finding — *"`campaign_posts_platform_check` is in none of the 105 migrations"* — **was FALSE, and the reason generalises to the whole sweep:** the constraint is declared **INLINE** on its `CREATE TABLE`, so Postgres auto-names it and **the name never appears in the repo.** The corpus holds **~129 inline `CHECK (` declarations** with that same property. 🔴 **A sweep keyed on `conname` would therefore report ~129 FALSE POSITIVES on its first run and be discarded wholesale — which is exactly how a correct check dies (#78's ruling: a ratchet that cries wolf teaches reflexive re-baselining).** **The sweep must match on the constraint DEFINITION (`pg_get_constraintdef`) against parsed migration text, never on the name** — and it must run **BOTH directions**, because #22 proves the reverse case is real: a migration that WAS applied while its record still says pending is invisible to a live→repo scan and is the third form of this class. **NAMED, NOT DONE — it is explicitly not the 2026-08-22 recon's task**, and it is filed here rather than left as a memory so it carries a number instead of a recollection. — ORIGINAL ENTRY: 🟡 **STD-008 INVERSE SWEEP — FULL SWEEP PENDING:** Sweep SQL written at `docs/audits/std008-inverse-sweep-2026-06-09.sql`. Must be run manually in Supabase SQL editor (4 queries: CHECK constraints, triggers, RLS policies, non-pkey indexes). Pre-migration-era tables (nurseries, plants, plant_events, addons, losses, social_drafts) may have additional hand-applied objects. STD-008 inverse sweep finding 2026-06-09. | STD-008 inverse sweep 2026-06-09 | David runs sweep SQL; audits results against `grep -r <name> supabase/migrations/`; logs undocumented findings to new Tech Debt entries. Mark 🟢 when sweep complete and all findings logged. | Before next migration session touching a pre-migration-era table. |
| 24 | 🟡 **STD-010 NAMING DEBT — IGNITION MODULE NAMES (13 candidates):** 13 opaque identifiers. Full decode: `FLUX`=RO Queue · `CIPHER` (IgnitionCipher.jsx)=DTC Decoder · `CODE` (CoreApp label)=DTC Decoder · `STOK`=Parts Inventory · `PROT`=Margin Config · `PROC`=Vendor Directory · `HUB`=Fleet Dispatch · `PORT`=Customer Estimate Portal · `KOSK`=Tech Floor Station · `OMNI`=Shop Command Dashboard · `PRED`=AI PMI Scheduler · `AUDIT`=AI Invoice Leakage · **WORST COLLISION:** `hooks/useIgnitionCipher.js` = Legacy PIN Auth Hook (same name as IgnitionCipher.jsx DTC decoder, completely different function). STD-010 audit 2026-06-09. | STD-010 audit 2026-06-09 | Rename files and update CoreApp routing labels. Coordinate with Tailwind conversion sessions (post-August). Do NOT rename during active demo period. WORST COLLISION (`useIgnitionCipher`) — orphaned, so rename is low-risk, do first. | Before onboarding a second Ignition developer. |
| 25 | 🟡 **IGNITION DARK INVENTORY — 6 AI FEATURES DEAD IN PRODUCTION:** Root cause: `VITE_API_URL` not set in ignition-os Vercel project → every `AIEngine.call()` returns `{ ok: false }` silently. Railway still running, zero Vercel traffic. Features dead: (1) AI estimate skeleton · (2) Auto-PO generation · (3) DTC AI decode (only 3 hardcoded codes work) · (4) Invoice leakage scan (entire module unusable) · (5) PMI AI scheduling · (6) QB OAuth (no api/qbo/* Vercel functions in Ignition). Kill path: retire invoice_scan/vin_decode; port dtc_decode + estimate_draft first; kill Railway after. STD-010 audit 2026-06-09. **AIEngine lifecycle status of record (BACKEND-DEAD / MODULE-STRANDED — REMOVAL BLOCKED, deprecated in place) lives in `docs/built-inventory.md` → "AI Engine" entry; this debt (#25 + #12) is its removal blocker — porting the 9 Ignition tasks + tier-gating to Vercel unblocks deletion.** | STD-010 audit 2026-06-09 | Port `dtc_decode` + `estimate_draft` to Vercel functions under `packages/ignition-os/api/`. | Before next Ignition OS demo or before claiming any AI feature works in Ignition. |
| 26 | 🟡 **IGNITION ORPHANED DATABRIDGE KEYS:** 4 orphaned keys. (1) `inventory_items` (orphaned read — IgnitionOmni reads it; IgnitionStok writes Supabase `inventory` table, not DataBridge; inventory tile always $0). (2) `fleet_units` (orphaned read — Hub shows empty GPS grid). (3) `labor_guide` (always returns hardcoded defaults; nobody ever wrote a real value). (4) `margin_change_log` (orphaned write — silently accumulates, never displayed). Also `pending_users` — written by legacy flow; only orphaned `EnrollmentCatch` reads it. STD-010 audit 2026-06-09. | STD-010 audit 2026-06-09 | (1) Fix `inventory_items`: sync from IgnitionStok to DataBridge OR point IgnitionOmni to Supabase `inventory`. (2) `fleet_units`/`labor_guide`: remove reads or build real writers. (3) `margin_change_log`: build a display in IgnitionProt settings panel. | Before next Ignition telemetry/stats session. |
| 27 | 🟡 **IGNITION STD-008 INVERSE GAP — 10 TABLES, NO COMMITTED MIGRATIONS:** 10 Supabase tables referenced in production code with zero committed migration files in `packages/ignition-os/supabase/migrations/`. Tables: `dtc_codes`, `eval_photos`, `tools`, `tool_signout_log`, `repair_logs`, `customer_authorizations`, `concept_aliases`, `purchase_orders`, `pmi_schedules`, `ai_usage`, `feature_events`, `error_events`. Also 3 DROPPED with no recreate migration: `pin_resets` (ForgotPinFlow), `shop_invites` (JoinFlow), `member_devices` (Devices tab, DataBridge.autoEnrollDevice) — these COMPILE AND ROUTE but fail at runtime (table not found). STD-008 applies to both Supabase projects. STD-010 audit 2026-06-09. | STD-010 audit 2026-06-09 | (1) Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;` in ufsgqckbxdtwviqjjtos to discover which tables exist. (2) Write `CREATE TABLE IF NOT EXISTS` migrations for existing-but-undocumented tables. (3) Write recreate migrations or remove dead code for the 3 dropped tables. | Before next Ignition build session that adds a new table or modifies schema. |
| 28 | 🟡 **SECURITY DEBT — IGNITION pilot_all RLS: ALL TABLES WIDE OPEN.** `supabase_rls_pilot.sql` sets `USING(true) WITH CHECK(true)` on 7 original tables. `supabase_job_lifecycle_migration.sql` adds `pilot_all_*` policies to 12+ workflow tables. 19+ tables with zero row-level isolation. Only exception: `shop_members` (recreated 2026-06-03 with scoped model). Permission enforcement is CLIENT-SIDE ONLY. ALSO: TWO incompatible role namespaces (TECH/SERVICE/ADMIN vs capability strings like "view_hub","scan_parts") — incompatible in `userCapabilities` expansion path. Shared fix built: `packages/shared/src/auth/permissions.ts` — `can()`, `hasRole()`, `canAccessModule()`, `expandRoles()`, `deriveAllowed()`. Callers NOT migrated yet. THUNDER · BUILD 2 discovery, 2026-06-10. | THUNDER · BUILD 2 discovery, 2026-06-10 | (1) Replace pilot_all policies with shop_id-scoped policies. (2) Unify role/permission format — adopt capability-string format everywhere. (3) Migrate CoreApp.jsx checks to shared `can()` / `canAccessModule()`. | Before multi-shop Ignition launch or any customer other than the pilot shop. |
| 30 | 🟡 **RLS SCOPE INCONSISTENCY — `business_voice_samples` owner-scoped vs `business_modules` membership-scoped:** `business_voice_samples` RLS uses `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())` — owner-only. `business_modules` RLS uses membership lookup via `business_members` — all members of the business. Decision needed: should non-owner members (e.g., Lauren) be able to read/write voice samples? If yes, `business_voice_samples` policy needs to be widened to membership-scoped to match `business_modules`. If no, the current owner-only scope is correct and intentional. Logged 2026-06-13. | 2026-06-13 (surfaced during voice-samples verification close-out) | Decide: owner-only OR membership-scoped for voice samples. If membership-scoped: update policy to match `business_modules` pattern. | Before KINNA-OS or any multi-member workflow that needs voice samples from non-owner staff. |
| 31 | 🟡 **PROCESS DEBT — PostgREST blocks `information_schema`/`pg_catalog` on bgobkjcopcxusjsetfob (406):** Thunder cannot re-run catalog SQL directly. Per Schema Verification Gate doctrine (CLAUDE.md §9 + docs/end-of-session-protocol.md): Thunder runs JS-client checks (table queryable, RLS active, old table absent); David runs catalog SQL (C1–C6) in Supabase SQL editor. Both halves required for VERIFIED status. Proof must be persisted to `docs/verification/<migration-name>_verification.md` before PLATFORM_STATE is updated. "David ran it in chat" is not sufficient — the verification record must exist in the repo. Pattern confirmed: business_voice_samples (2026-06-13) is the first execution of this two-half protocol. Logged 2026-06-13 per the STAGE B close-out mandate. | 2026-06-13 (doctrine gap identified during validation-then-close prompt) | Enforce: every schema-changing session that closes out must produce a `docs/verification/<migration>_verification.md` file with C1–C6 results before PLATFORM_STATE is updated. Thunder's role = JS checks + write the doc. David's role = run catalog SQL + paste results into the doc (or confirm via chat so Thunder can transcribe). | Permanent process requirement — not a code fix. Flag if any future PLATFORM_STATE update to VERIFIED is made without a verification file. |
| 32 | 🟡 **RLS SCOPE — `cultivar_plants.anon_select_plants` is `USING(true)` = all plant identity public-readable:** The QR scan page is unauthenticated, so an anon SELECT policy is required to resolve a scanned tag. The current policy grants anon read of EVERY `cultivar_plants` row (plant identity: tag_id, species, common_name, container, zone, warranty), not just the one scanned. Acceptable today because (a) plant identity is non-sensitive and (b) the real scan→checkout flow is server-mediated (QBO credentials never reach the anon browser), so blanket public read is not load-bearing for checkout. Logged 2026-06-13 during the cultivar_plants policy cleanup. **Do not act — David's call.** | 2026-06-13 (surfaced during cultivar_plants policy cleanup) | If tighter scoping is wanted: replace `USING(true)` with a per-tag scoped read (e.g. a SECURITY DEFINER RPC that returns a single row by tag_id, or a policy keyed on a scan token). Separate change — current state is intentional and documented. | Before exposing anything sensitive on `cultivar_plants`, or if per-tag read scoping becomes a requirement. |
| 33 | 🟡 **HEADER BACKFILL DEBT — existing widgets lack the PURPOSE/DEPENDENCIES/OUTPUTS header (widget-header standard now binding):** The widget-header standard (partnership doc §15, gated at end-of-session-protocol.md Step 10 + Step 17, BUILT-INVENTORY structure note) is binding going forward, but artifacts built before 2026-06-14 have no in-code header. Top 3 header-less load-bearing widgets, confirmed by reading file heads 2026-06-14 (all start straight into imports): (1) `packages/shared/src/campaigns/generate.ts` — David's referenced "campaign widget"; (2) `packages/cultivar-os/src/pages/Campaigns.tsx` — customer-facing campaign widget; (3) `packages/shared/src/discovery/engine.ts` — discovery engine. NOT backfilling all now — flagged per verify-before-build/capture-don't-admire. | 2026-06-14 (widget-header standard encoded) | Add a header block (PURPOSE · DEPENDENCIES · OUTPUTS) to the top of each artifact. Backfill the named 3 first, then on-touch for the rest. A full header audit across all widgets is a separate scheduled pass, not piecemeal. | On next touch of each file; named 3 are priority. Full audit before onboarding a second developer. |
| 29 | 🟡 **NAMING DEBT — `receipts` table violates `business_` naming convention:** The live table `receipts` (project bgobkjcopcxusjsetfob, DEPLOYED, WORKS as of 2026-06-11) predates the locked general-layer naming convention. Per convention it should be `business_receipts` (`business_` prefix = general/core layer, `business_id`-scoped). Named before the convention was set. **Cost is rising:** `business_service_log.receipt_id` (migration `20260612_business_assets_inventory_pmi_service.sql`) is the first FK referencing `receipts`; every future FK raises rename cost — a full rename must update all referencing FKs + receipts module `from('receipts')` calls + any RLS policy names embedding the table name + PLATFORM_STATE.md references. **Decision (David, 2026-06-12):** IDENTIFY NOW, CLEAN UP LATER. Do not rename mid-build. The rename is a coordinated change to be scheduled deliberately, not done piecemeal. | `receipts` table created pre-2026-06-11 (before naming convention locked); first FK dependency added 2026-06-12 (`business_service_log.receipt_id`) | `business_receipts` per AC-1 general-layer naming convention. Coordinated rename: `receipts` → `business_receipts`; update all FKs (check for additions beyond `business_service_log` at cleanup time); update receipts module queries (`from('receipts')` → `from('business_receipts')`); update any RLS policy names embedding the table name; update PLATFORM_STATE.md references. | Scheduled deliberately post-build. Do NOT rename piecemeal. Perform a fresh FK scan at cleanup time — additional referencing tables may exist by then. |
| 34 | 🟢 **RESOLVED 2026-06-19 (root cause CONFIRMED + fixed, commit `14a9a82`).** The `/api/qbo/status` (and `/api/qbo/auth-url`) 500s were `FUNCTION_INVOCATION_FAILED` at module load: `packages/cultivar-os/api/qbo/router.ts:15` imported `refreshQBToken` from `../../../../shared/...` (FOUR `../`), which resolves to nonexistent `<repo-root>/shared/...`. router.ts sits at `api/qbo/` (one folder under `api/`) so the correct depth is THREE `../` (`../../../shared/...`) — proven by the same-depth sibling `api/discovery/ingest.ts:2`. The 4× path was copied from `api/qbo/invoice/cultivar.ts:2`, which is one folder DEEPER and legitimately needs 4×. **Confirmed WITHOUT Vercel logs** via esbuild: bundling the real entry `api/qbo-connector.ts` with the old 4× path fails (`Could not resolve "../../../../shared/src/quickbooks/refresh"`); with the 3× path it bundles clean (8.5kb). This sharpens the prior #34 hypothesis — it was not a generic "`.ts` cross-package bundling" failure (other endpoints import `.ts` from shared fine); it was the wrong number of `../`. The unresolved import crashed the function at load → 500 on ALL qbo routes (auth-url/callback/status) regardless of token state, which is why auth-url (needs no token) also 500'd. The Dashboard consecutive-failure circuit-breaker (`qbStatusFailRef`, limit 5) added 2026-06-15 stays in place as defense-in-depth. Original diagnosis below.<br>—<br>**LOOP-GUARDED 2026-06-15 (root cause still unconfirmed — needs Vercel logs). `/api/qbo/status` returns 500, polled in a loop.** **2026-06-15 partial fix:** the Connect poll at `Dashboard.tsx` now has a consecutive-failure circuit-breaker (`qbStatusFailRef` + `QB_STATUS_FAIL_LIMIT=5`): `checkQbStatus()` increments a counter on non-ok/network failure and resets to 0 on any healthy `res.ok`; after 5 consecutive failures the poll stops, clears the interval, resets `connecting`, and surfaces `qbError` pointing at Vercel logs — so a persistent 500 no longer hammers every 2s indefinitely. **Root cause NOT fixed:** the cross-package `.ts` import at `router.ts:15` could not be confirmed as the cause from this environment (no Vercel function-log access; `handleStatus` is fully try/caught so the 500 is invocation-level). **[NEEDS DAVID]:** pull the Vercel function log for `/api/qbo-connector?_route=status` (look for `FUNCTION_INVOCATION_FAILED` / module-resolution error on `refreshQBToken`); if confirmed, make the import resolvable at runtime (inline/built-path). Original diagnosis below.<br>—<br>**DIAGNOSIS (2026-06-14):** `/api/qbo/status` returns 500, polled in a loop.** PRE-EXISTING, not from Cost-to-Produce (last handler touch is `fcdfa97` AC-5 QBO router consolidation; Cost-to-Produce `931c8e2` only added a tile to the Dashboard that already polls QB). Callers: `Dashboard.tsx:385` (once on mount) and `Dashboard.tsx:320` (a 2s `setInterval` started by Connect that clears only on `connected===true` or popup-closed — when status 500s, `connected` never flips true, so it polls every 2s = the LOOP). Root cause: `handleStatus()` in `packages/cultivar-os/api/qbo/router.ts:163-201` is fully try/catch-wrapped and returns HTTP 200 `{connected:false}` on ANY internal error — so the handler CANNOT itself emit a 500. A 500 therefore means the serverless function fails at the invocation/module level. Prime suspect: the deep cross-package import of a `.ts` SOURCE file — `router.ts:15` `import { refreshQBToken } from '../../../../shared/src/quickbooks/refresh'` — failing to resolve/bundle in the Vercel Node runtime (FUNCTION_INVOCATION_FAILED), which would 500 every qbo route; `status` is the visible one because the dashboard polls it. **CONFIRM via the Vercel function log before fixing.** Proposed fix (for approval): (a) make `refreshQBToken` resolvable at runtime (bundle/inline or import a built path); (b) cap the Connect poll at `Dashboard.tsx:320` with a max-attempts/timeout so a persistent 500 surfaces an error instead of looping. Does NOT block the Cost-to-Produce tile. Logged 2026-06-14. | 2026-06-14 (punch-list FIX 3 diagnosis) | (a) Confirm in Vercel function logs; (b) fix import resolution; (c) bound the connect poll. | Before next QuickBooks connect attempt or QBO-touching session. |
| 36 | 🟡 **NAV-DEAD — `/assets` (BusinessAssets) + `/pmi` (PMI) are route-live but unreachable from the UI.** Both routes are defined in `packages/cultivar-os/src/router.tsx` (`/pmi` line 72, `/assets` line 75) behind PrivateRoute and work under RLS — owner-proven via direct URL (data path proven on `cost_objects`). But NO tile, Link, or `navigate()` target points at either string — confirmed 2026-06-15: the only occurrences of `/assets` and `/pmi` in the codebase are the two `<Route>` definitions themselves. Discovery path is missing: Lauren cannot reach these screens through the app. Logged 2026-06-15. | 2026-06-15 (surfaced during PMI Suggest Schedule instrumentation) | Wire both behind a tile — likely the Inventory tile or a new Assets tile on the dashboard tile grid — using the existing `handleNavigate()` pattern. Alternatively, if assets/PMI are deemed internal-only, leave URL-only and mark as accepted internal-only debt with that rationale recorded. | Before Lauren (or any non-developer owner) needs to use asset registry / PMI, OR next dashboard tile-grid session. |
| 37 | 🟡 **PMI UI POLISH PASS NEEDED — `/pmi` works end-to-end but needs visual tuning.** PMI is functionally complete and owner-proven on `cost_objects` under RLS: load asset, Suggest Schedule (AI), Log Service, persist — all proven. Captured for a later polish pass, non-blocking. **[DAVID: attach the `/pmi` screenshots — Log Service modal, COST field, service-history card, date field — so specific polish items aren't lost here.]** Full service log completed; this is cosmetic/UX tuning only, no functional gap. Logged 2026-06-15. | 2026-06-15 (captured during PMI Suggest Schedule instrumentation) | Visual/UX polish of the PMI detail + Log Service surfaces per David's screenshot annotations (Log Service modal, COST field, service-history card, date field). Not architectural — a tuning pass. | Pre-LAWNS-demo polish window, or whenever David provides the annotated screenshots. |
| 38 | 🟡 **NEXT MAJOR BUILD (after Core-2b) — FRICTIONLESS MULTI-CHANNEL COST CAPTURE.** Capture cost signals at the moment cost occurs, from where they already live, so the owner never reconciles a pile at a desk (anti-Nelson; see D-5 founding evidence — David's workspace). **CHANNELS (ordered by friction removed):** (1) **Card/bank feed** (Plaid-style, read-only) — the universal net, catches every swipe whether or not the owner acts; thin signal (amount/merchant/date), strong TRIGGER / weak CLASSIFIER. (2) **Email forwarding rule** (`receipts@domain`) — rich signal (line items, PDF) for the digital subset; set-once, runs forever, low friction; enriches the card line for the same event. (3) **SMS/text forward** — long-tail small costs (car wash); higher friction, lower priority; usually enrichment of a card line already caught. (4) **Receipt Keeper photo** (already built, Gemini OCR ~$0.0001/read) — cash/paper-only fallback; the only channel that catches a CASH purchase no card/inbox saw. **ARCHITECTURE INSIGHT: capture ≠ classification.** Cheap channels capture-all / classify-poorly → AI proposes (business/asset/category, capex vs recurring), owner CONFIRMS only the uncertain ones (OP-7). The labor flip: owner never ENTERS a cost, occasionally CONFIRMS one. Pile → short confirm-queue. **STRETCH:** card feed as DISCOVERY engine — surface costs the owner never thought to count ("6 car washes, $90, untracked — track it?"). That IS the hidden-cost thesis. **HARD DEPENDENCY:** multi-channel capture GUARANTEES duplicate signals (card line + email receipt + text for ONE purchase). Building capture before the count-once seam + full multi-signal `sameCost()` (Core-2b) = a double-counting machine (3 channels × $340 Home Depot = $1,020 phantom). **OPEN ADOPTION QUESTIONS (David's call, affect channel priority):** (a) Will owner-operators (Lauren/Terry) cross the read-only-bank-access trust wall? If not, the "universal net" is unavailable and email+photo become primary. (b) Confirm-queue tolerance: if AI under-classifies, the queue becomes a new digital desk — lives or dies on auto-classification being good enough that confirm-queue stays SHORT. **TRUST MODEL — DO NOT HOLD FINANCIAL DATA; store INSIGHTS, not INPUTS (SUPERSEDES the prior "load-it-then-purge-it" framing, 2026-06-15):** the platform must produce hidden-cost insight WITHOUT becoming custodian of the owner's raw financial data — **eliminate the liability rather than manage it.** This RETIRES the purge-button + provenance-for-purge machinery from the earlier #38 note: nothing held = nothing to purge; provenance reduces to "insight derived from an upload on `<date>`," NOT the upload itself. **ARCHITECTURE OPTIONS (David's call, per channel):** (1) **Ephemeral / in-memory** — process the upload in memory, extract insight, NEVER persist raw transactions; persist only derived insight ("recurring uncounted cost: car wash ~$15 ×6"). Must be **PROVABLY non-retaining** — no rows in logs, temp files, traces, caches, or analytics (surface-honesty applied to the privacy claim). (2) **Client-side** — parse + analyze the CSV in the owner's browser; only insights (not transactions) ever reach the server, or nothing does. Strongest posture: "your data never leaves your machine." Fuzzy AI classification, if needed, runs on **anonymized aggregates, not raw rows.** (3) **Read-through connector** (if bank feeds come later) — read, compute, persist insight only, never store transaction history. A LENS, not a vault. **PRODUCT FORK (open, David's call):** one-shot diagnostic ("upload → here's what we found → done" — clean, liability-light, free-scan wedge) vs ongoing monitor (sticky, but wants persistence → re-introduces custody). Likely answer: one-shot diagnostic as the entry wedge; ongoing monitor as an OPT-IN upgrade where the owner consciously chooses persistence. Ephemeral/client-side options fit the one-shot version best. **First test channel = CSV upload** (David's stated path). Logged 2026-06-15. | 2026-06-15 (cost-capture design brainstorm) | Multi-channel capture (CSV upload first; then card feed + email rule + SMS forward + Receipt Keeper photo) feeding a capture layer that is SEPARATE from classification; AI proposes classification, owner confirms only uncertain items (OP-7). **DO NOT HOLD raw financial data — store INSIGHTS, not INPUTS** (ephemeral/in-memory · client-side · read-through-connector — David picks per channel; one-shot diagnostic as wedge, ongoing monitor as opt-in persistence). All channels dedup through the count-once seam + full `sameCost()` before any rollup. | **SEQUENCE (hard): Core-2a seam (DONE) → Core-2b full `sameCost` + rollup → THEN #38 capture.** Do NOT start capture until `sameCost` can dedup fuzzy real-world events. |
| 35 | 🟢 **RESOLVED 2026-06-15.** `Settings.tsx:43` `.single()` → `.maybeSingle()` — a nursery with no `nursery_profiles` row (the normal first-run case, before the OnboardingWizard upsert runs) now returns `{ data: null }` instead of HTTP 406 (PGRST116); the existing `data?.default_install_price != null` guard already handles null cleanly, and the `upsert` at line 56 was already correct. `npm run build:cultivar` passes. (The AC-1 noun rename `nursery_profiles → business_profiles` remains SEPARATE open Noun-Purge work — flagged, not done this session.) Original diagnosis below.<br>—<br>**DIAGNOSIS (2026-06-14):** `nursery_profiles?select=...` returns 406.** PRE-EXISTING (NurserySection install-price code predates Cost-to-Produce; seen now because `CostToProduceSettings` mounts in the same Settings page). **Corrects the prompt's hypothesis: `nursery_profiles` is NOT the legacy/dropped table.** The DROP-pending table is `nursery_modules` (registry → migrated to `business_modules` 2026-06-04). `nursery_profiles` is a SEPARATE, still-LIVE table holding `default_install_price`, read at `Settings.tsx:38-48` and written (upsert) at `OnboardingWizard.tsx:517`. It IS an AC-1 noun leak (Noun-Purge backlog `nursery_profiles → business_profiles`, still open) but it exists. Root cause of the 406: `Settings.tsx:43` uses `.single()`, which PostgREST answers with HTTP 406 (PGRST116) when ZERO rows match — and no `nursery_profiles` row exists for the active business (a row is only created by the OnboardingWizard upsert; if that step never ran for this business, none exists). NOT a dropped table (that would be PGRST205/404) and not necessarily RLS — it's `.single()` on zero rows. Proposed fix (for approval): `Settings.tsx:43` `.single()` → `.maybeSingle()` (returns null, no 406, no console noise); the `upsert` at line 56 is already correct. (The AC-1 rename to `business_profiles` is separate Noun-Purge work.) Does NOT block the Cost-to-Produce tile. Logged 2026-06-14. | 2026-06-14 (punch-list FIX 3 diagnosis) | Change `.single()` → `.maybeSingle()` in `Settings.tsx` NurserySection. Separately: AC-1 rename `nursery_profiles → business_profiles`. | Next Settings-page or Noun-Purge session. |
| 39 | 🟡 **LIVE SCHEMA NOT IN VERSION CONTROL — a migration-rebuilt env would not match production.** The demo-spine tables `orders`, `customers`, `order_items` (and `order_service_selections`) exist LIVE on bgobkjcopcxusjsetfob but have NO `CREATE TABLE` in `supabase/migrations/` (43 files, none define them — grep-confirmed 2026-06-19). Likewise these columns exist live-only with no migration: `orders.qb_invoice_id`, `orders.qb_invoice_url`, `orders.leakage_flag`, `orders.netting_declined`, `orders.status`, `orders.transport_note`, `customers.qb_customer_id`. They were created ad-hoc in the Supabase SQL editor early in the build, before the append-only migration discipline (STD-008) was enforced. **🟡 RE-SCOPED 2026-07-28 (ledger #162):** two of this class — `losses` and `nurseries`, the pre-`businesses` generation — leave it by **DELETION, not capture** (GATED `supabase/migrations/20260727d_drop_losses_and_nurseries.sql`). That is a legitimate way off the list but a DISTINCT one, recorded so a future reader does not score it as a capture. **It also cost something first:** with no migration, a source grep was blind to `losses_nursery_id_fkey` by construction, so the DROP's dependency check had to be `pg_constraint`-based — and it BLOCKED the original single-table 27d. This entry's consequence is not only 'a rebuilt env would be missing tables'; it is 'a static audit cannot see what depends on what'. Consequence: a fresh environment rebuilt from `supabase/migrations/` alone would be MISSING the entire order/customer/checkout spine — the demo could not be reconstituted from version control. Verified runtime-real 2026-06-19 (`scripts/verify-spine-runtime.mjs`, 11/11 pass) — production works; the gap is reproducibility, not function. | 2026-06-19 (WAVE 0 spine verification) | Write idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` capture migrations that reflect the live `orders`/`customers`/`order_items`/`order_service_selections` schema, so version control matches production. Pull live column definitions from `information_schema` first. Same class as Ignition tech-debt #27 (STD-008 inverse gap) but for the cultivar-os project. | Before any disaster-recovery rebuild, before standing up a staging/clone environment, or before the next session that adds a column to any of these tables. |
| 40 | 🟡 **BUILT-INVENTORY PACKAGE-FLAG CORRECTION — 5.1 inventory / 5.2 PMI are RESOLVED gaps, not ⚪.** The onboarding capability-package ground-truth (CAPABILITY-PACKAGE-GROUNDTRUTH.md) flags capabilities 5.1 (inventory) and 5.2 (PMI) as unbuilt (⚪). Both are in fact LIVE and runtime-real: `business_inventory` (5.1) and `business_pmi_schedule` (5.2) exist on bgobkjcopcxusjsetfob, are selectable, and their pages (`BusinessInventory.tsx`, PMI route) are owner-proven under RLS (per PLATFORM_STATE / tech-debt #36 which confirms `/pmi` works end-to-end). The ⚪ flag is stale. NOTE: `business_inventory` currently has 0 rows for the demo tenant `a1b2c3d4-…-001`, so the inventory surface renders empty for the demo — a DATA-population gap (addressed by the Wave-1 sandbox seeder), not a code gap. | 2026-06-19 (WAVE 0 spine verification) | Update the 5.1/5.2 flags in CAPABILITY-PACKAGE-GROUNDTRUTH.md (and any ⚪ in built-inventory.md for inventory/PMI) from ⚪ unbuilt to ✅ built/owner-proven, with a pointer to the PLATFORM_STATE evidence. Populate the demo tenant's `business_inventory` via the sandbox seeder so 5.1 is non-empty on arrival. | Next built-inventory / ground-truth reconciliation pass. |
| 41 | 🟡 **VERCEL HOBBY 12-SERVERLESS-FUNCTION CEILING — `api/` is at the limit; every new function risks a SILENT failed deploy.** On the Hobby plan a deployment may contain at most 12 Serverless Functions; exceeding it FAILS the build, and Vercel keeps serving the last-good deployment while the dashboard still shows the new commit — so it looks deployed but prod is frozen. **This already bit us:** the delivery loop (`253cf49`, added `api/deliveries/create.ts` as the 13th function) + service_type (`634b990`) + docs (`64902b5`) ALL failed to deploy silently — `cultivar-os.vercel.app` kept serving the pre-`253cf49` bundle (proven by fetching the live `index-*.js` and grepping: old "delivery date on this invoice" copy present, new "ship-to address"/`service_type`/`Scheduled Deliveries` absent). The owner saw "Schedule delivery — coming" + Add-customer working = exactly the 12-function (Wave-2, `6ae67a6`) deploy. Note `qbo-connector.ts` already multiplexes 3 QB routes into 1 function via `?_route=` rewrites — evidence the budget was already being actively managed. **Mitigated 2026-06-20** by folding `api/deliveries/create` into `api/customers/create` (one "resolve customer + optional delivery" call) → back to 12 functions → deploy succeeds. | 2026-06-20 (delivery-loop deploy diagnosis) | DURABLE FIX: upgrade to Vercel Pro (raises the limit) BEFORE the next module wave — Online Shop + Follow-Up Engine will each add functions and re-hit the ceiling. INTERIM: keep `api/` ≤12 by multiplexing (the `?_route=` pattern) or folding related endpoints; treat "add a new api/*.ts" as a deploy-risk that needs a function-count check + a post-deploy live-bundle grep, never a dashboard glance. | Before Online Shop / Follow-Up Engine, or any session that adds a new serverless function. |
| 42 | 🟢 **RESOLVED 2026-06-21.** D-9 silent-coercion in `packages/shared/src/discovery/seed.ts` (`seedServiceOfferings`) — flagged by the capability-1.3 recon. The old `toCategory()` mapped any unrecognized category to `'addon'` (a quiet LIE: asserted an unknown thing was an add-on; `service_offerings.category` has NO CHECK, so the coercion was pure code, not a constraint), and every seeded row took `price: 0` (reads as "free"). **Fix:** new `classifyCategory()` keeps the 5 valid categories and maps unknown → `'uncategorized'` + a flag in `service_note` (never silent `'addon'`); price 0 is now an explicit NON-NULL placeholder (column is NOT NULL) flagged "price not set — confirm before activating" with `is_active=false`, so 0 can never read as a real price or be sold. Returns `{seeded, flagged}` (caller reads `.seeded`, backward-compatible). **RESIDUAL (logged, not closed by this fix):** a fully-null price + a `price_confidence` column is the clean representation but needs an `ALTER` on `service_offerings`, deferred to honor capability-1.3's byte-identical migration discipline. | 2026-06-21 (capability 1.3 recon flag, fixed same cycle) | Make `service_offerings.price` nullable + add `price_confidence` (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN) so an unknown price is null, not a 0 placeholder. | When `service_offerings` next gets a migration (bundle with the nullable-price change). |
| 43 | 🟡 **STAFF RLS-BLOCKED FROM OWNER-ONLY OPERATIONAL TABLES (cross-pointer to STD-011).** Owner-only operational tables — `orders`, `customers`, `cultivar_plants`, `order_items`, `addons`, `plant_events`, `social_drafts`, `nursery_profiles`, and the other pre-2026-06 operational tables — have NO member RLS policy (owner-only `…_owner_select`/`owner_all`). Once member resolution lands (the `businesses` member-read fix), a Staff member RESOLVES into their business but is still RLS-blocked from reading orders/customers despite holding `view_orders`/`qr_checkout` permissions. Fails CLOSED (a functional cliff, not a leak). Surfaced by the membership-active RLS consistency sweep (`data/grower-scan/member-rls-consistency-audit.md`) and recorded as the open item under the new **STD-011** (One Canonical Representation Per Fact). | 2026-06-22 (member-rls consistency sweep) | A PRODUCT decision, NOT a mechanical refactor: decide what Staff sees on each operational table, scoped how (own-business membership), and the PII posture (e.g. customer contact fields), then apply Staff-appropriate member RLS — ideally referencing the canonical `is_active_member()` helper per STD-011. | NEXT hardening item after `businesses` member-read resolves; before Staff/multi-role accounts go live for a paying customer. |
| 44 | 🟡 **DROP `businesses.accounting_token` + `businesses.accounting_refresh_token`.** The QB bearer-secret relocation (`20260622_oauth_secrets_relocation_and_cost_wall.sql` Part 1) copied the live tokens into owner-only `business_accounting_secrets` and NULLed these two `businesses` columns. They are kept (NULL) only for the deploy-window fallback in `secrets.ts`. They are dead weight once Part A + QB reconnect are OWNER-PROVEN and the fallback window is closed. | 2026-06-22 (Gate 3 close-out) | `ALTER TABLE businesses DROP COLUMN accounting_token, DROP COLUMN accounting_refresh_token` — bundle with TD #45 (remove the `secrets.ts` fallback in the same change so the SELECT/UPDATE on these columns can't error). | Gated on Phase 3 Part A + QB reconnect OWNER-PROVEN (fallback window closed). |
| 45 | 🟡 **REMOVE the `secrets.ts` deploy-window fallback.** `packages/shared/src/quickbooks/secrets.ts` `readQBSecrets`/`writeQBSecrets` fall back to the legacy `businesses.accounting_token`/`accounting_refresh_token` columns when the secrets table is absent — this is the ONLY code path still able to write a bearer token to `businesses`. Correct once the relocation is owner-proven and the columns are dropped (TD #44). | 2026-06-22 (Gate 3 close-out) | Delete the businesses-column fallback branches in `readQBSecrets`/`writeQBSecrets`; secrets table becomes the sole store. Bundle with TD #44 (drop the columns in the same change). | Same gate as TD #44 — Part A + QB reconnect OWNER-PROVEN. |
| 47 | 🟡 **OFFERINGS EDITOR LOST ITS ADMIN DESTINATION (surfacing loss in the nav split — NOT a removal).** The `service_offerings` CRUD editor (transport / add-ons incl. the netting companion / other services) is LIVE but renders only on the full-page Settings body (`packages/shared/src/pages/Settings.tsx:470`, gated `full = !section`). Since the Admin/Settings nav split (`2ee2853` "separate Admin (business) from Settings (user)" + `e4fc913` "Admin/Settings landing indexes"), `/settings` lands on `SettingsIndex` (Your Profile / Business administration / All business settings) and the editor is reachable ONLY via `/settings/all` (nav node `nav_all_settings`, section `sec_settings`) — NOT from `/admin` (`AdminIndex` lists Add Business / Business Profile / Accounting / Roles / Cost-to-Produce; no Services). The dedicated `services` tile is `status:'planned'`/`placement:'TBD'` (`tileRegistry.ts:188`), so no dashboard/admin card surfaces it either → from the "Admin" mental model the offerings editor is invisible. Confirmed live: demo business `f7ec5d67` has 6 discovery-seeded offerings but 0 self-trigger netting addons, so the checkout netting prompt is empty too. | 2026-07-03 (OP-11 suggestion-arc reconcile) | Place the `services` tile (choose a placement) + add a first-class Admin/Settings **Services** IA node routing to a section-isolated `/settings/services` (mirror the `/settings/business` pattern) so the offerings editor is a named destination again, not buried in `/settings/all`. | Next build (offerings-editor resurface); pair with a netting-offering seed/owner-config for `f7ec5d67` (B3 — resurface ALONE won't restore the flow; rows are absent). |
| 48 | 🟡 **ORPHANED DEAD PATH — old `addons` offering stack (cleanup candidate, NOT this pass).** The pre-`service_offerings` offering path is fully superseded but still in-tree with zero importers: the `addons` table (globally 0 rows — confirmed live 2026-07-03), `packages/cultivar-os/src/hooks/useAddons.ts` (no importers), and `packages/cultivar-os/src/components/checkout/NettingPrompt.tsx` (no importers — checkout uses `useServices` + `CompliancePrompt` instead). Replaced by `service_offerings` (`1056b31` / `49c0c40`). The emptiness of `addons` is EXPECTED (dead path), not the bug. | 2026-07-03 (OP-11 suggestion-arc reconcile) | Delete `useAddons.ts` + `NettingPrompt.tsx` (and `AddonCard` if it becomes unused — it is still imported by `AddOns.tsx`) after confirming knip agrees; drop the `addons` table in a future migration once no historical read remains. | Orphaned-cleanup pass / next knip-scope sweep. |
| 49 | 🟡 **DASHBOARD TILE ENABLE-LABEL BUG — "ENABLE" renders on already-active, clickable tiles (Orders/Delivery/Social/Mobile-Intake).** ENABLE is a MARKETPLACE action (activate a lapsed/add-on tile), not a dashboard decoration. Root cause: `useModules.ts` computes `state='available'` (→ the `[Enable]` button in shared `Tile.tsx`) whenever a tile has a `module_key` but its `business_modules` row isn't `enabled && configured` — yet NO code path ever flips `qr_checkout`/`delivery_routing`/`inventory_intake` to enabled+configured, so they sit at the migration default forever showing "ENABLE" while `openTile` navigates on both `onEnable` and `onNavigate` (identical) → the button promises an activation step that doesn't exist. Part of the tile-entitlement thread: `business_modules` + tileRegistry has no billable/add-on/lapse field to distinguish "coming soon (planned)" from "add-on you can activate on the market page." Cross-ref user_stories "The market tile" + built-inventory "Tile Marketplace + activation authority (money axis) — PLANNED". | 2026-07-06 (dashboard-tile-state recon) | Honest dashboard tile states — ACTIVE (clickable, no button) vs LOCKED (greyed → path to the market page) — with NO stray ENABLE on the dashboard; relocate ENABLE (activate/subscribe) to the market page, keyed off a REAL entitlement fact (add-on not purchased / trial lapsed), which needs the undermodeled entitlement axis (a registry billable/add-on flag + where a lapse timer lives). Agnostic per D-31. | **Bank with the market-tile / entitlement work — fix once, not in isolation.** Interim safe win: drop the dead `'available'`/Enable path on the dashboard (both handlers already navigate, so a visible live tile is simply ACTIVE). |
| 50 | 🟢 **RESOLVED + OWNER-PROVEN 2026-07-06 — route-entry permission enforcement closes the CLASS (nav-only gating gap).** Root cause confirmed: gating lived on nav-render only (`useModules` `can()`-filters the tile grid; `AppNav` hides nav links) but the ROUTE had no guard, so any second door — the loose dashboard **Campaign Scheduler card** (unconditional, navigated to `/campaigns` for everyone), a deep link, or a typed URL — bypassed it. **FIX (not one-tile whack-a-mole):** every permission-gated route is now wrapped in the shared `PermissionRoute` keyed on its registry `required_permission` — `/campaigns` + `/campaigns/:id` + `/social/setup` (manage_campaigns), `/deliveries` + `/delivery-schedule` (manage_deliveries), `/receipts` (view_costs), `/add-business` (owner-only), `/settings/:section` (manage_settings), `/orders` (qr_checkout) — joining the already-guarded view_costs / owner-only / manage_settings groups. An unauthorized session is redirected to `/dashboard` + `[TRACE:PERMGATE]` regardless of entry door. The guard was RELOCATED to `packages/shared/src/auth/PermissionRoute.tsx` (AGNOSTIC per D-31 — reads only the shared `can()` chokepoint, zero vertical nouns; Ignition's PIN/DataBridge model simply never mounts it). The loose dashboard card was DELETED → also closes the campaigns `status:'planned'`-but-rendered-active drift (the registry grid tile already renders `locked`/greyed; the card was the only active-render). | 2026-07-06 (member-console owner-prove) | DONE — `PermissionRoute` relocated to shared + every gated route wrapped + dashboard card removed. capR green (39 paths). | 🟢 **RESOLVED — OWNER-PROVEN 2026-07-06** (David, live RLS, commit `0c9e68d`): as Staff the Campaign Scheduler card is gone; typing `/campaigns` + `/settings` (and other gated routes Staff lacks) → redirected, `[TRACE:PERMGATE]` fires — proven mobile + desktop. Route-entry enforcement closes the CLASS (not one-tile whack-a-mole). |
| 46 | 🟢 **WRITE-WALL — scope CORRECTED by recon + the one real hole CLOSED (Gate-3b, 2026-06-22).** Recon (`data/grower-scan/role-machine-and-signing-recon.md`) corrected the premise: the **data-layer write wall ALREADY HOLDS** — cost/wage member policies are `FOR ALL` with `has_permission` in `USING`+`WITH CHECK` (`20260622_…cost_wall.sql:141-212`), so a member lacking the permission is RLS-refused INSERT/UPDATE/DELETE, not just SELECT. So the operating-cost "+cost" save was NOT a data-layer breach — it is render-layer LEAKAGE (button shown to staff; the write is RLS-refused). The ONE genuine hole was the costDiscovery `cost-apply` service-key endpoint (`api/discovery/ingest.ts`, banked `219e264`) which bypassed RLS with no caller check. **#46.1 DONE:** `cost-apply` now permission-gates the caller (`has_permission(business_id,'view_costs')` resolved from the auth context, never the body) before the service-key write; write-tamper proof `scripts/verify-write-wall.ts`; verify-universals assertion (h) live. | 2026-06-22 (Gate 3 close-out → Gate-3b) | **#46.1 — DONE** (gate cost-apply service-key endpoint). **#46.2 — OPEN (defense-in-depth, NOT security-critical — RLS already refuses the write):** render-layer hide of write buttons (e.g. operating-cost "+cost", asset/labor/pricing saves) from roles lacking the permission via `can(VIEW_COSTS)`, so a no-permission user never sees a control RLS will reject. | #46.2 = next render/UX pass or Role-Machine role-config UI; not blocking. |
| 51 | 🟡 **DISCOVERY ASSERTS INSTEAD OF ASKS (gap-vs-decision) + `nursery.ts` pain-points roadmap-derived not grounded.** Recon 2026-07-07 (`data/grower-scan/discovery-engine-vs-design-recon.md`): the engine surfaces absent services as ASSERTIONS ("you could add X" — `engine.ts:117,130`; `DiscoveryGlimpse.tsx:457-476` labels gaps "Opportunities") rather than QUESTIONS ("deliberate, or opportunity?"), violating the banked D-32/D-33 principle — misfires on the LAWNS fertilizer-bundled-into-install example. Separately, `nursery.ts commonPainPoints` are roadmap-derived (committed 2026-05-29, before the grower-scan research existed 2026-06-21), not empirically grounded; the grower-scan research measures catalog-scrapability (a different dimension) and grounds the catalog-populate path, not this config. NAMED GAP (honest — the labeling that IS built is honest per `types.ts`/`seed.ts` D-9; the missing piece is the ask-don't-assert loop). | Recon 2026-07-07 | **Option A (D-33):** reframe gaps/suggestions prompt as QUESTIONS; relabel UI away from assertion; add record-as-business-decision / stop-re-surfacing loop by reusing the identity-conflict-resolution mechanic (`compare.ts` + `DiscoveryGlimpse.tsx:180,386-434`), extended to gaps + rule "improve the chosen model." Needs a persistence home (gated `business_discovery_profiles`). Grounding `nursery.ts` = separate; grower-scan grounds the catalog-populate path. | Post-demo (NOT Aug-4-critical); build after LOOK-first recon confirms the prompt + UI touch points. |
| 52 | 🟡 **DB CHECK CONSTRAINT DUPLICATING A CODE VOCABULARY (latent drift, same class as the dropped `orders_status_check`).** `orders_transport_method_check CHECK (transport_method = ANY (ARRAY['self','delivery','install']))` duplicates the `deriveTransportMethod` code vocabulary (`submit.ts`). It is the SAME anti-pattern as `orders_status_check` (dropped in `20260715_orders_status_drop_check.sql`, ledger #129), which enumerated a stale payment lifecycle and 500'd two of four status transitions once the code vocabulary moved and the CHECK didn't follow. `transport_method` is NOT currently breaking — the code's three values match the constraint exactly — so it was left in place, not dropped speculatively. But it is a live tripwire: the next time the transport vocabulary changes in code (e.g. a new fulfillment mode), the CHECK rejects the write and 500s, undetected until that value is first exercised (exactly how #129 hid). Per AC-1 (transport_method is a string VALUE — variation lives in data, not schema) + STD-011 (the code vocabulary is the ONE canonical representation; a DB CHECK is a drifted duplicate). | 2026-07-15 (orders_status_check drop, ledger #129) | DROP `orders_transport_method_check` (new gated migration; the `deriveTransportMethod`/code path is the canonical guard, same as `ORDER_STATUSES`). Do it when transport values next change OR in a consolidation pass that sweeps DB-CHECK-vs-code-enum duplicates platform-wide. ZERO data migration (all live rows use self/delivery/install). | Next time transport vocabulary changes, OR a DB-CHECK-vs-code-vocabulary consolidation sweep — whichever first. |
| 53 | 🟢 **RESOLVED 2026-07-16 (D-47 — three-way rule; BUILDER-COMPLETE, owner-proof owed).** ~~QBO CUSTOMER FIND-OR-CREATE MATCHES ON EMAIL ALONE — no name verification, no collision guard (cross-identity billing bug, PROVEN live).~~ **FIX:** the matcher now queries QBO by email **AND** by `DisplayName` (the field QBO guarantees unique — email it permits to collide) and resolves through ONE shared rule (`resolveQboCustomerMatch`, `packages/shared/src/quickbooks/customerIdentity.ts`): email+name concur → LINK; email-YES/name-NO → **CREATE** (the Terrence case, never link); name-YES/email-no → **SURFACE** (409, owner resolves); neither → CREATE. A stored `qb_customer_id` is now **VERIFIED against the live QBO record before billing** (name drift → refuse + flag) — a stored link is a cache, not a fact; that check is what would have caught this on invoice #1 instead of #9. Collision guard added (two TRACE customers may never carry one `qb_customer_id`, business_id-scoped). The silent email-as-DisplayName create fallback is RETIRED — an exact-name collision (QBO 6240) SURFACES. Name comparison uses a NEW `personNamesMatch` (`packages/shared/src/utils/personName.ts`) because the #61 `nameTokenSet` **splits on apostrophes** (`O'Brien`→`{brien}` ≠ `OBrien`→`{obrien}`) — a reasoned divergence, documented in D-47. Blast radius was **ZERO** (live probe 2026-07-16: 0 customers carried a `qb_customer_id`; Terrence already cleared by David). 22 tests green incl. the live Terrence/Andrew case. ORIGINAL: `findOrCreateQBCustomer` in `packages/cultivar-os/api/qbo/invoice/cultivar.ts` resolves a TRACE customer → a QBO customer via `select * from Customer where PrimaryEmailAddr = '<email>'` then takes `Customer[0]` (first hit) and writes its `Id` to `customers.qb_customer_id` — with **ZERO** comparison of `DisplayName`/name and **ZERO** guard against two TRACE customers adopting the same `qb_customer_id`. QBO does NOT enforce unique customer email, so (a) a TRACE customer can bind to a DIFFERENT person's QBO record that happens to share the email, and (b) the `MAXRESULTS 1 / [0]` "first-hit" is arbitrary when multiple QBO customers share an email. Once written, the caller SKIPS find-or-create on later pushes and bills the stored (possibly wrong) `qb_customer_id` forever with no re-verification. **PROVEN 2026-07-15:** TRACE "TERRENCE OBRIEN" / david_obrien2016@outlook.com bound to QBO customer 81 = "Andrew O'Brien" (email matched, name mismatch ignored; `customers.updated_at 2026-07-15 22:47` = written by that push). `[TRACE:QBO]` accountability logging ADDED this pass (resolve → query/predicate → full candidate set → selected+rule → created-vs-reused → id written back, + a ⚠ NAME MISMATCH line) — instrumentation only, behavior unchanged; the FIX is a separate decision. | 2026-07-15 (QBO customer-mismatch diagnosis) · **RESOLVED 2026-07-16 (D-47)** | ✅ Built: `docs/decisions/2026-07-16-qbo-customer-identity-resolution-D47.md`. Remediation = **zero rows** (blast radius probed live: no customer carries a `qb_customer_id`). **Owner-proof owed** (D-47 § OWNER-PROVE): push for TERRENCE → `[TRACE:QBO]` shows "email-YES/name-NO → CREATE", a NEW QBO "TERRENCE OBRIEN" is created, invoice bills Terrence not Andrew. **David's own bookkeeping (NOT a platform action):** nine real QBO invoices are billed to Andrew O'Brien for sales that never happened — his call to void. **Follow-up flagged:** race-proof collision guard = partial unique index `(business_id, qb_customer_id)` — a migration, deliberately not taken at zero blast radius. | ✅ Closed by D-47 (owner-proof owed before the push is relied on for real billing). |
| 54 | 🟡 **`qb_customer_id` COLLISION GUARD IS CODE-LEVEL, NOT RACE-PROOF — the durable form is a partial unique index (a MIGRATION).** D-47 added `assertNoLinkCollision` (`packages/cultivar-os/api/qbo/invoice/cultivar.ts`) so two TRACE customers can never carry the same `qb_customer_id` — one QBO customer billed for two different people. It is a **read-then-write check** (SELECT for a conflicting row, then UPDATE), so it is **TOCTOU-racy**: two concurrent pushes resolving to the same QBO customer can both pass the check and both write the link. The race-proof form is a DB constraint the database enforces atomically: `CREATE UNIQUE INDEX … ON customers (business_id, qb_customer_id) WHERE qb_customer_id IS NOT NULL` (partial — many customers legitimately have NULL). A losing writer would then get a clean constraint violation instead of a silent double-link. **Theoretical today: ZERO customers carry a `qb_customer_id`** (probed live 2026-07-16) and a single-owner nursery does not push invoices concurrently — so the code guard is proportionate NOW and the index was deliberately NOT taken (D-47 was scoped migration-free at zero blast radius). It becomes real at multi-user or automated-push volume. | 2026-07-16 (D-47 build — flagged, deliberately not taken) | Add the partial unique index as an additive migration (`CREATE UNIQUE INDEX … WHERE qb_customer_id IS NOT NULL`), keep the code guard for the friendly error message, and let the constraint be the authority. **This is a MIGRATION** → gated, David applies as postgres + catalog-verify per STD-008. Cheap and additive; the only cost is that a genuine race now surfaces as a 409 instead of silent corruption — which is the correct direction. | Before real billing volume: multi-user pushes, an automated/batch push path, or the first paying customer. Not urgent at zero links + single-owner use. |
| 55 | ✅ **RESOLVED 2026-07-16 (SHA `d99e829`, ledger #132) — the elide-don't-split fix shipped.** `nameTokenSet` now ELIDES apostrophes (U+0027 · U+2019 · U+02BC · U+0060 · U+00B4) **BEFORE** the boundary split — order of operations IS the fix (split first and `A'fire` → `a`+`fire` → the 1-char filter eats the `a` → `{fire}`). RED-first per STD-002: the four live-broken varieties were added as failing assertions (**21 passed / 4 failed, exit 1**), then fixed, then the same four GREEN (**34 passed / 0 failed** — +13 incl. codepoint + no-regression guards; no existing assertion was adjusted to pass). The 1-char filter STAYS (its hybrid-`x` reason holds; eliding merely stops feeding it orphans). §6 r16 deviation stated: Lucene STRIPS the possessive, we ELIDE it, because the comparison target is a WordPress `sanitize_title` slug (`bashams-party-pink`) — stripping would still miss. `personName.ts` untouched, still a separate fn (two facts, two rules — D-47's reasoning; surfaced under §6 r10, NOT merged). **Blast radius probed LIVE read-only before the fix (116 rows, not 111): exactly 4 token sets change · L4 pairwise 0 un-grouped / 0 re-grouped · populate.ts import 4 FIXED / 0 BROKEN · 0 bad merges** — no existing grouping moved. `[TRACE:RESOLVE]` extended to log the token set on the L4 hit AND the MISS (a false-UNKNOWN was previously invisible). OWNER-PROOF OWED — see ledger #132. *(Original entry retained below for the scar.)* — 🔴 **`canonicalName` APOSTROPHE DEFECT — possessive varieties FALSE-UNKNOWN on scan; 4 of 6 apostrophe varieties BROKEN in live data (D-45 defect).** `nameTokenSet` (`packages/shared/src/utils/canonicalName.ts`, the #61 L4 resolver) treats every non-alphanumeric as a token **BOUNDARY** and then drops 1-char tokens (a filter that exists to kill the botanical hybrid marker `x`). On a **possessive** that splits the word and then eats the `s`: `Basham's` → `{basham}` while the QR slug `bashams-party-pink-crape-myrtle` → `{bashams}` → **NO MATCH → false UNKNOWN at scan**. This is precisely the class `canonicalName` was built to fix (the LAWNS false-UNKNOWN). **Wrapping quotes survive** (`'Sierra'` → `{sierra}`, because the quotes sit at word boundaries either way) — which is why the defect hid: the cultivar-quote case, the one anybody eyeballs, works. **Possessives don't. LIVE DATA CONFIRMS 4 of 6 apostrophe varieties BROKEN — Basham's Party Pink Crape Myrtle · Evey's Pride Mimosa · Summer's Tower Redbud · Hearts A'fire Redbud (all `variant_group` NULL, never counted).** The fix is the same **elide-don't-split** rule `personName.ts` just proved in D-47 (`.replace(/['’`´]/g, '')` BEFORE the boundary pass): `Basham's` → `bashams`, `O'Brien` → `obrien`, `'Sierra'` → `sierra` (unchanged). D-47 deliberately did NOT touch `nameTokenSet` — the plant resolver is D-45/D-46 **owner-proven** territory and re-keying it changes live scan behavior, so it needs its own provable build, not a drive-by. | 2026-07-16 (found during the D-47 recon — the #61 resolver could not be reused for person names; the same blind spot was then traced to the plant path and confirmed against live data) | Apply the elide-don't-split rule to `nameTokenSet` (mirroring `personName.ts`, STD-011 — one convention across both keys); extend `canonicalName.test.ts` with the four live broken varieties as red-tests FIRST (STD-002: prove the false-UNKNOWN, then fix, then prove the same check passes); re-owner-prove the D-45 scan→count path. Consider whether the 1-char filter should keep dropping `s` at all once apostrophes are elided. Note the four broken rows carry `variant_group` NULL and were never counted — they may also need the D-45 backfill after the resolver is fixed. | Next D-45 pass / before the scan→count flow is demoed on a nursery whose catalog carries possessive cultivar names (LAWNS' does — 4 confirmed). 🔴 because it silently breaks real scans on real live data TODAY. |
| 56 | 🟡 **SIZE VOCABULARY IS NOT NORMALIZED ON THE COUNT PATH — the same physical size in two spellings mints a third row (the next defect in the D-49 family).** `sameSizeLabel` (`packages/shared/src/inventory/countPromote.ts`, extracted from `InventoryCount`'s local `sameSize`) is **exact string equality** after trim + case-fold. The live catalog **already carries mixed size vocabulary** — `'Sierra' Mexican Red Oak` is live with sizes `["15", "30 gal"]` and `Arizona Cypress Blue Ice` with `["15", "30"]`. So counting `"15 gal"` against the `"15"` row does NOT match → the promote mints a THIRD row → the size-picker offers **two spellings of one physical size**, and the on-hand for that size is split across two rows. **D-45 built resolve-before-create so varied NAME spellings converge (token-set equality); nobody did the equivalent for SIZES.** A `normalizeSize` already exists — in the scrape parser (`extractSizeVariants`' dedupe key), not on the count path (the same shape as D-49's own root: a convention that exists on one path and not the other). Deliberately NOT fixed in the D-49 pass: it is its own defect with its own blast radius (it can MERGE two currently-distinct rows, which the D-49 fix explicitly cannot) and needs its own RED test. | 2026-07-16 (surfaced by David while ruling on the D-49 recon — spotted in the live `'Sierra'` size data) | ONE shared `normalizeSize` (the same STD-011 shape as `variantGroupSlug`/`deriveSiblingSku`), reused by the count path AND the scrape parser AND the manual editor, so one physical size has ONE canonical label; `sameSizeLabel` compares normalized forms. RED-first: assert `"15 gal"` resolves to the live `"15"` row BEFORE the fix. Probe the blast radius read-only first — unlike D-49 this change can merge existing rows, so prove which live pairs collapse before writing. | Before the walk-and-count loop is demoed on a catalog with mixed size vocabulary (LAWNS' already is — `'Sierra'` and `Arizona Cypress` both confirmed live). 🟡 not 🔴: it splits stock across two rows and clutters the picker, but unlike #57 it does not make the variety UNSCANNABLE — both rows still resolve. |
| 57 | ✅ **RESOLVED 2026-07-16 (D-49, ledger #133) — the stub-fill + auto-group invariant shipped.** 🔴 **COUNTING A VARIETY MADE IT PERMANENTLY UNSCANNABLE — self-inflicting, once per variety, on the walk-and-count loop itself.** `InventoryCount.commitCount` matched on `(variety × size)` and treated a size-**less** parent as "a different size": the scan RESOLVED to the scraped parent at L4 and then **CREATED a second row beside it** (`[TRACE:INVENTORY] promote — created`, inventory **114 → 118** on four scans). The re-scan of the same slug then returned **UNKNOWN** — two token-equal rows, one grouped + one not, one sized + one not → `detectSizeCollision` correctly refuses to guess. **Root:** `populate.ts` mints the scraped catalog as size-less `qty: 0` stubs under the D-9 honesty contract (scrape-reads-variations was never built) — **103 of 112 scraped rows, measured live**; D-45's match predicate never anticipated a size-less parent because, before #55, nothing could resolve to one. **#55 made this branch reachable for the first time — a fix that unblocks a path exposes that path's first real test.** Hidden because the decision lived inline in a React async handler (untestable) and the grid's own dup detector (`findDuplicateSizeGroups`) is **blind to this class** (it skips blank-size rows — the parent's size is blank). **FIX (D-49):** the decision extracted PURE to `packages/shared/src/inventory/countPromote.ts` (D-47's shape) under ONE invariant — *any path that mints a sibling leaves the family picker-ready by construction*: (1) a counted STUB is FILLED in place, never sibling'd (D-34: a row with no size and no stock is not a lot); (2) an UNGROUPED NON-STUB creates a real sibling AND auto-groups the parent in the same pass (D-46's rule #126, applied to the path that skipped it — `commitCount` backfilled `variant_group` on the MATCH branch only). SKU lineage repointed onto the shared `deriveSiblingSku`. RED-first per STD-002: **24 passed / 16 failed (exit 1)** → **40 / 0**, every fixture real live data, the re-scan assertions running the REAL `detectSizeCollision`. `detectSizeCollision` NOT touched — refusing to guess is correct; the fix stops manufacturing the ambiguous pair. Four already-broken rows repaired by the gated fold `docs/decisions/2026-07-16-d49-stub-fold-remediation.sql`. OWNER-PROOF OWED — see ledger #133. | 2026-07-16 (found by David owner-proving #55 live — the fix that made the four possessive varieties scannable is what exposed this) | Shipped: D-49 (`docs/decisions/2026-07-16-count-fills-the-stub-D49.md`). Durable follow-ons NAMED not built: scrape-reads-variations so `populate.ts` stops minting size-less stubs at all; widen `findDuplicateSizeGroups` to the mixed-group/missing-size class so a landmine is visible on the grid BEFORE it blows. | ✅ Resolved. The 103 remaining stubs + 5 ungrouped rows need NO remediation — the code fix makes their first count correct. |
| 141 | 🟡 **`orders.qb_invoice_id` IS AN IDEMPOTENCY KEY THAT ~40 EXISTING ORDERS DO NOT CARRY, AND THE GUARD THAT COVERS FOR IT IS A MATCHER, NOT A KEY.** The nine LAWNS history orders were transcribed from photographs and every ordinary checkout order that was never pushed to QuickBooks is in the same position: no Intuit id, therefore invisible to `ON CONFLICT (business_id, qb_invoice_id)`. 🔴 **The 2026-09-01 build closes the DUPLICATION hole properly** — a prior-order guard keyed on the customer's own `source_document_number` with customer/date/amount as corroboration, which records the id where the match is an identity and REPORTS everything else — **but a matcher is a weaker thing than a key, and it will stay load-bearing for as long as orders exist without ids.** Its bar is deliberately low (two of three fields stops the run), so it will also produce false stops as the order table grows. | 2026-09-01 (surfaced by David: *"the key is blind to them and the import would create a second order for each"*) | The durable fix is **backfilling `qb_invoice_id` onto every order that has a QuickBooks counterpart**, so the key covers the whole table and the matcher becomes a safety net rather than the mechanism. That is a one-time reconciliation over ~40 rows and it is **not** this build: it needs the same evidence bar (their own document number, corroborated) applied deliberately and reviewed, not applied as a side effect of an ingest. ⚠️ **The guard already does exactly this for the invoices it touches** — so the residual shrinks each time it runs, which is the right direction but not a plan. | Before the order table is large enough that a two-of-three match produces routine false stops, or before any second tenant connects QuickBooks — whichever is first. |
| 139 | 🟡 **THE DAY SHEET STILL CANNOT TELL A TREE FROM A TRIP CHARGE, AND THIS BUILD DELIBERATELY DID NOT TEACH IT.** Every line of every ingested invoice is now on the order — including `TC` Trip Charge (14 lines across the 18 future-dated invoices in the 2026-08-29 capture), `Late fee` (2), `Tailgate Delivery` (1) and `TP` Trunk Protection (1). They are on the order **because the sale would misstate itself without them**: they carry money and the invoice's subtotal depends on them. But **a day sheet that lists "Trip Charge" as something to load is worse than one that does not**, and nothing in the schema distinguishes a physical good from a fee. 🔴 **AND THE OBVIOUS SHORTCUT IS THE WRONG ANSWER, MEASURED:** the tree items all carry a `Category:CODE` shape (`Oak:MO95`) and the fees do not — but **`Tailgate Delivery` and `Late fee` are bare names too, and so is `BPJ30REP`, which IS a tree.** Inferring the distinction from the SKU's punctuation would put a replacement juniper in the fee bucket. | 2026-08-31 (the load pass — named at the moment the lines landed, not discovered later) | The customer's own item catalogue answers this and we have already read it: `Item.Type` (`Inventory` \| `Service` \| `NonInventory`) and the income-account mapping are both in the 2026-08-29 item capture (685 items, 557 sub-items, 38 categories, five income accounts). **Answer it from THEIR books, not by picking a rule** ([[R-25]]). A `qbo_item_id` → item-type map is the durable form; the day sheet reads it. **Explicitly NOT a column on `order_items`** — the line records what was sold, and what a screen shows is a different question. | The day-sheet build. It is the FIRST thing that build must decide, and it is blocked on nothing but the decision. ✏️ **2026-09-11 (ledger #301, [[R-144]]) — DECIDED FOR NOW: SHOW ALL, LABELLED.** The day-sheet build measured that NOTHING stored classifies a line: `order_items` carries `sku` + `description` text only, `business_inventory` holds `qb_item_id` but no type, and no line references either. David chose to show every line under *"On this order"* with an amber note on invoice-copied lines, over building the lookup in the same pass. 🔴 **HIS CORRECTION, AND IT RE-SCOPES THIS ROW:** *the classification is not missing* — the 2026-09-09 census split the 685 QuickBooks items **564 · 73 · 8 · 2 · 38** by income account. **What is missing is the LINK from an `order_items` row to its QuickBooks item.** `invoiceOrderLines.ts` already reads `ItemRef.value` (as `itemId`) and drops it before the write, keeping only the name in `sku`. ⚠️ The 19 photographed-invoice orders have no QuickBooks item id at all, so the filter will leave those labelled. **Still 🟡 — the label shipped, the filter did not.** |
| 140 | 🟡 **`service_type` IS STILL NULL ON ALL 19 INGESTED STOPS, AND THE SIGNAL IS WEAKER THAN IT WAS DESCRIBED.** The build spec said *"624 of their invoices bake '(Install & Warranty)' into the plant's own line description"* and offered it as a possible derivation. 🔴 **MEASURED AGAINST THE RAW CAPTURE, THAT NUMBER IS THREE DIFFERENT FACTS AND THE ONE IT NAMES IS 164, NOT 624:** 1,469 invoices carry **164** with the parenthesised `(Install & Warranty)`, **259** with the phrase in any form, and **624** merely containing the word *"install"* anywhere in any line. On the eighteen future-dated invoices in that capture: **4 parenthesised · 7 in any form · 1 naming an explicit `Tailgate Delivery` (a DELIVERY-ONLY signal, and the stronger of the two) · 10 with no signal at all.** So the parenthesised reading would set 4 of 18 and mis-read 3; the loose reading would set 7 and still leave 10 unset. **A guessed crew is worse than an unset field** ([[R-30]]'s shape: work the software cannot represent is still part of the job). | 2026-08-31 (the load pass — the 624 figure was checked before it was used, which is the only reason this row is right) | David rules. The honest options are (a) leave it NULL and let Lauren set it per stop on the schedule — **what ships today**; (b) set it where the description says so and leave the rest NULL, which is a partial derivation and must be labelled as one on screen; (c) ask their books — the item catalogue distinguishes install services from goods and is a stronger source than a description substring ([[R-25]]). **Do not pick (b) silently.** | Before the day-type conflict flag on the operations calendar reads `service_type`, or before any crew is dispatched off it — whichever is first. |
| 60 | 🟡 **[RULE RATIFIED 2026-07-17 → OP-15; mechanical SHA-STAMP still OPEN] DEPLOY-VERIFICATION GAP — nothing between `git push` and owner-test confirms the Vercel build SUCCEEDED, and Vercel deploys the TREE not the COMMIT.** `313de44` (ledger #135, the four-defect inventory fix) **never deployed** — its Vercel build FAILED at 18:59:45 2026-07-17 (*"Build Failed — an unexpected error … may be a transient issue"*, dying AFTER clone and BEFORE install: Vercel infrastructure, not our code). #135 went live **~20 hours later only as a side effect** of pushing the ledger #137 recon MARKDOWN: the most-recent GREEN deploy is `77ffd8e`, and since git is cumulative its tree CONTAINS `313de44` (`git merge-base --is-ancestor 313de44 77ffd8e` → CONFIRMED). It explains the 09:34 mystery — the banner read "2 size collisions" over 8 clean oaks because that was CORRECT for the code actually deployed (#135 was not live). **One layer deeper than #128/#129:** that scar taught "committed ≠ live" → *hard-refresh, check the bundle hash* (a browser problem). This is **"the bundle cannot be stale if it was never built."** DEPLOYED is a bar nobody measures — Thunder's last act is push, David's first is test, nothing in between checks the build. And *you can ship code by writing a document, and fail to ship code by pushing it.* | 2026-07-17 (surfaced owner-proving #135 — the fix was live only by accident) | **✅ RATIFIED 2026-07-17 as OP-15 (David).** owner-prove **STEP ZERO** = "confirm the deploy for THIS SHA is READY" — before the hard-refresh, before the bundle-hash check; if the SHA isn't live, every observation is fiction. Per row-19B's lesson a §1.6 checklist item alone ROTS — so it is homed where the ACTOR stands: **PRIMARY** = a GATE 0 block at the TOP of every `docs/owner-tests/*-full-surface-test.md` (David reads that mid-test); **SECONDARY** = CLAUDE.md §9 STANDING INSTRUCTION + DEPLOYED-bar (Thunder carries it); binding statement = `docs/DECISIONS.md` OP-15 + `end-of-session-protocol.md` → GATE — DEPLOYED / OWNER-PROVE STEP ZERO. **The rule is a discipline rule and still rots-risk** — the durable form is the SHA STAMP (see trigger). | **RULE done (OP-15).** **SHA-STAMP still OPEN (David's call after the recon):** inject `VERCEL_GIT_COMMIT_SHA` at build (`packages/cultivar-os/vite.config.ts:5` has no `define`) and render it on the existing `DebugPanel` (`?debug=1`, `DebugPanel.tsx:110` footer) → GATE 0 becomes "does the app say the SHA?", one glance, no dashboard. **Zero new api-fn; ~30 min, demo-week-safe.** Collapses the stale-bundle (#128/#129) and failed-deploy (#60) scars into one tell (the artifact carrying its own provenance). Until the stamp ships, every owner-prove manually confirms Vercel READY for the SHA first (OP-15). **→ SHA-STAMP SHIPPED 2026-07-20 (ledger #141), BUILDER-COMPLETE — David ruled placement (a) DebugPanel footer.** `vite.config.ts` `define` → `__COMMIT_SHA__` (7 chars; `'dev'` off-Vercel — honest, never a fake SHA) → rendered in the panel footer; global declared in `src/vite-env.d.ts`; `verify` exit 0, tsc 5/5 zero net-new; truncation proven at the bundle (full SHA does not leak). **STILL 🟡 — NOT RESOLVED: the mechanical form is BUILT but NOT OWNER-PROVEN.** A stamp nobody has read on the real phone is a claim, and a WRONG stamp would silently un-verify every future GATE 0 — precisely the failure class this row exists for. **Closes to 🟢 only on David's live match** (footer SHA == pushed commit). **The OP-15 discipline rule REMAINS the fallback and is NOT retired by the stamp** — the panel proves what the BROWSER holds; a hard-refresh is still required, and a dashboard check remains the answer if the panel is unreachable. **→ STRENGTHENED 2026-07-20 (ledger #142): the stamp is now ALWAYS-VISIBLE** (`built <date> · <sha>`, bottom of every screen, every user, outside every auth gate) **and was REMOVED from the DebugPanel** (STD-011 — one home). **This closes a hole #141 had opened without noticing:** #141 put the tell inside a panel reached by `?debug=1`, and #142 owner-gates that panel — so had the stamp stayed there, **a deploy broken enough to break the menu would have hidden its own tell**, which is the precise failure #60 exists to catch. The stamp is ungated for exactly that reason. **STILL 🟡 — closes on David's live match** (stamp SHA == pushed commit, on the phone). |
| 61 | 🟡 **FALSE COMMENT — `packages/shared/src/inventory/countPromote.ts:24` asserts scrape-reads-variations "was never built."** It is FALSE: `fetchProductVariants` (added `9f1063e`, 2026-06-28) and `extractSizeVariants` (`fe9360b`, 2026-06-30) EXIST and are wired into `populateCatalog`. The comment predates or ignores the enrichment. **A comment contradicting its own repo fed two days of wrong reasoning** — Lightning repeated "scrape-reads-variations was never built" as ground truth in the D-49 prompt, and it shaped the stub-vs-scrape framing across #133/#135. Same class as tech-debt #34's wrong-`../`-depth: a stale local claim that reads as authoritative. | 2026-07-17 (surfaced by the #137 recon reading the actual functions) | Correct the comment to describe what the repo does: variant scraping IS built (`fetchProductVariants`/`extractSizeVariants`), the 103 live size-less stubs are STALE data predating the enrichment (the scrape has not re-run since 2026-06-26 17:32), NOT a missing feature. Comment-only fix — no behavior change. | Next touch of `countPromote.ts`, or the catalog-cleanup ruling (whichever first). |
| 62 | 🟡 **DATASHEET VIEWPORT STANDARD DRIFTED (one item, both halves) — the grid outgrew its layout the first time the data got real.** (Half 1) The horizontal scrollbar is anchored to the BOTTOM OF TABLE CONTENT, not to a fixed-height scroll viewport: filtered to 4 rows it is on-screen; at 123 rows it is 123 rows down — you scroll to the last row to reach it, then scroll back. **David's point: this was a SET convention (§6 r14 — bounded scroll box, sticky header, frozen column) that DRIFTED, not a missing pixel.** (Half 2, worse) SELL PRICE and CONF sit past the RIGHT fold — NAME/ACTIONS/SKU/QTY/SIZE/VARIANT GRP/UNIT COST all outrank them. **The column that decides whether a row can be SOLD is cut off on the surface whose own header calls it "board 5.1 reconcile surface,"** on the day the finding was that Bur Oak looks finished and isn't (column priority, not scroll). Inventory is the first DataSheet consumer long enough for both to surface. | 2026-07-17 (surfaced owner-proving #135 at 123 rows) | (Half 1) Restore the fixed-height bounded scroll viewport so the h-scrollbar is reachable without scrolling past every row — RECON FIRST: does the viewport live in the shared `DataSheet.tsx` engine or in each page, and do assets/customers pin while inventory doesn't? (page-level regression) or does nobody pin? (the convention only ever held because every other table was short). (Half 2) Reorder columns / freeze so sell-price + conf are reachable on the reconcile surface without a full-right scroll. Fix in the SHARED control so consumers inherit (§6 r14/r15). | Before the reconcile grid (board 5.1) is demoed or Lauren uses it to decide what's sellable; pair Half 2 with the reconcile-to-sellable build (ledger #137). |
| 63 | 🟡 **THE CAPTURE INDEX HAS NO GATE — the retrieval structure that makes every other canonical surface findable is maintained by a REMINDER, and a reminder rots (row 19B).** Every other canonical surface has a binding gate (BUILT-INVENTORY reconciliation · §3 RETENTION · close-out ledger · ⚡ ACTIVE STATUS · owner-test coverage). The 📚 CAPTURE INDEX — the single retrieval point "so nothing is re-derived or re-captured" — is maintained only by step 6 of `end-of-session-protocol.md`, a reminder, not a gate. **The proof it rots, and it is the finding of 2026-07-17:** at 08:00 David asked Lightning what its humor style was; Lightning answered *"not encoded anywhere — not in CLAUDE.md, not in my corpus,"* and offered to make it an AC-4 candidate. **It was OP-2, dated 2026-06-03, Status Active/canonical — it names Scott Morrison, the dry edge, by name.** Lightning did not reconstruct it wrong; it reported it **ABSENT** — because OP-2 is `[POINTER]`, its content lives in the partnership doc, and **it had no CAPTURE INDEX row.** The index answered "nothing here" with the same confidence it answers correctly — and a retrieval table with holes is worse than no table. **THROUGH-LINE (record it — it is worth more than any single fix): the artifact does not carry its own provenance** — `business_inventory` rows cannot say who changed them (no actor column) · a deployed bundle cannot say what it is (#60, the SHA stamp) · **and a doctrine corpus cannot say what is in it.** Same disease, three layers. **Sweep 2026-07-17 (ledger #139):** 59 canonical decisions (15 OP + 37 DECISIONS.md D-headings + 7 `docs/decisions/`-homed D-42…D-49); **21 had no index row** (3 OP: OP-2/3/14 · 11 D-headings: D-27…36,D-40 · 7 D-file-homed: D-42/43/45/46/47/48/49); **0 stale** (all referenced paths resolve). All 21 filled this pass. | 2026-07-17 (surfaced by the humor-style question; sweep in ledger #139) | A GATE for the CAPTURE INDEX, matching the sibling reconciliation gates: every close-out reconciles the index against its sources (every `### OP-N`/`### D-N` heading + every `docs/decisions/` D-homed decision has a row; report present/missing/stale). **Deliberately NOT proposed as an OP this pass** — David has ratified two OPs in two days; a third now is ceremony. Named, numbered, left to EARN a gate when the pattern recurs. **Companion cleanup:** the 7 D-42…D-49 decisions live in `docs/decisions/` not DECISIONS.md — a fold-into-DECISIONS.md pass would make the OP/D mirror single-homed. | When the index drifts again (a new decision with no row surfaces via "where is X" returning nothing), OR the DECISIONS.md fold pass — whichever earns the gate first. |
| 64 | 🟡 **A SECOND, UNDECLARED ORDER STATUS WRITER BYPASSES THE STATE MACHINE — `qbo/invoice/cultivar.ts:658` writes `status: 'invoiced'`, a value `ORDER_STATUSES` does not contain.** The canonical set is `pending \| confirmed \| fulfilled \| cancelled` (`lib/orderStatus.ts:13`) and `handleStatus` validates against it — so the SAME value the QB path writes directly would be **rejected with `BAD_STATUS`** if a human tried to set it through the UI. Two writers, two vocabularies, one column: the validator guards the front door while the QB path walks in the side. **Found by the D-50 Layer 2A-2 grep** ("no bare `orders.status` update without an event") — the ledger work made the second writer visible because it had to enumerate every status writer to wire events to them. **Consequence now that order events exist: an order can reach a state that emits NO lifecycle event**, so its ledger stream will show `order_created` and then silence through invoicing — a gap that reads like nothing happened. **Same class as #61 and #39:** a local claim (here, an enum asserting it is the whole set) contradicted by the repo. | 2026-07-20 (surfaced by the D-50 Layer 2A-2 status-writer grep) | **David ruled 2026-07-20: FLAG ONLY, do not touch this build** — folding a QuickBooks file into the ledger build widens scope past the order path, and `'invoiced'` cannot be added to `ORDER_STATUSES` without ratifying **R-STATUS**, which is an open decision reserved for David (`orderStatus.ts:7-8`). Durable fix, when R-STATUS is settled: either (a) add `invoiced` to the canonical set and route the QB write through `handleStatus` so it emits `order_invoiced` like every other transition, or (b) stop writing `status` from the QB path entirely and let invoicing be a non-status fact (it already has `qb_invoice_id`/`qb_invoice_url` columns — arguably `status` was never the right home for it). **(b) is the cleaner read:** "has an invoice" is a property, not a lifecycle stage. | R-STATUS ratification, or the next time an order's event stream is read and the invoicing gap is mistaken for a missing event. |
| 65 | 🟡 **THE QUALITY GATE CANNOT SEE THE DEPLOYED BACKEND — `npm run verify` never typechecks `api/`.** `packages/cultivar-os/tsconfig.json` sets `include: ["src"]`, so every file under `packages/cultivar-os/api/` is outside the program: `tsc --listFiles | grep -c submit` → **0**. The gate's green tsc line therefore says **nothing** about `submit.ts`, `dashboard.ts`, or any other serverless handler — i.e. it is blind to precisely the code that runs the checkout, the money math, and the inventory writes. Flagged during D-50 Layer 2A-2 (ledger #143) and hit again in D-52 (#144), where both edited api files had to be typechecked **by hand** under `--strict` for the build to have any type evidence at all. **The risk is not today's bug, it is the false signal:** a build can report "verify exit 0, zero net-new" while shipping a type error in the backend, and the report reads exactly like a build that was actually checked. | 2026-07-20 (flagged, #143) · re-hit 2026-07-21 (#144) | Bring `api/` into the checked program: either add it to the cultivar `tsconfig.json` `include`, or add a second project/`tsconfig.api.json` and a `verify` step that runs it. **Expect a baseline jump on first inclusion** — years of unchecked handlers land at once — so re-baseline deliberately per §6 r9 rather than absorbing it silently. Until then, any build touching `api/` must typecheck those files directly and SAY SO in the write-back (both #143 and #144 did). | Next build that touches `api/` non-trivially, or the next time a backend type error reaches deploy — whichever first. |
| 66 | 🟡 **RE-SCOPED AGAIN 2026-07-24 (ledger #153): the MANAGER half is now FIXED; only the ANON half remains open.** The permission funnel (#152) exposed that this was not anon-only; the manager-visibility build (#153, STD-020) then FIXED the manager half — additive `orders_member_select` / `order_items_member` (+ the whole order-read family) member SELECT policies gated on `has_permission('view_orders')`, so a manager holding `view_orders` now READS the orders they took and the committed derivation reads 132 as COMMITTED, not available. **What remains 🟡 is ONLY the anonymous-visitor half** (below), which the member policies do NOT touch (an anon session holds no membership). — *Prior (2026-07-23 #152) framing, kept for provenance:* NOT anon-only — a MANAGER holds `view_orders`, passed the route gate, and got `[TRACE:ROSTER] roster loaded {count: 0}` because `order_items`/`orders` RLS filtered every row — created `CLV-20260723-3077` and **could not see it**; same session read `{lotsCommitted: 0}` where the owner read `{4, 132}` so 132 committed units showed as AVAILABLE. That ORDER-surface permission/RLS coverage gap is the half now closed. **ORIGINAL (anon half, still true):** THE ANONYMOUS QR PLANT PAGE SHOWS ON-HAND WHERE IT SAYS "AVAILABLE" — and it structurally cannot show the truth.** After D-52 (#144), available = on-hand − committed, and committed is derived by reading `order_items` for open orders. `order_items`' only SELECT policy is `authenticated_select_order_items` (`20260709_order_items_business_rls.sql`) — **correctly** authenticated-and-tenant-scoped, since a customer must never read other customers' orders. So `usePlant.ts` (and `PlantProfile`'s *"N of this variety available"* + `QtySelector max`, plus `ScanOrder`'s picker subtitles) keep showing the raw physical count to an anonymous visitor. **Scope: it is a UX gap, NOT an oversell hole** — the server's pre-flight refuses against real available (BUILD 3), so the sale is protected; the customer can simply be offered a quantity that is then honestly refused at checkout. But a surface saying "available" while showing on-hand is exactly the D-9 violation D-52 set out to end, so it should not sit unnamed. | 2026-07-21 (surfaced building D-52's BUILD 4; RLS confirmed by reading the policy, not assumed) | Needs a SERVER-side read, because the client genuinely cannot have one. Cheapest honest fix: return a derived `available` from an existing endpoint the plant page already calls, rather than minting api-fn #13 (**12/12 — §6 r11 STOP-and-surface**). Alternative: leave it and soften the copy to "in stock" so the word stops over-claiming. **David's call — the second option is nearly free and removes the lie without new surface area.** | Before the QR page is put in front of real customers with delivery orders outstanding (i.e. once committed is routinely non-zero). |
| 67 | 🟡 **THE PHONE COUNT ALREADY APPLIES ITSELF, SO A DESK RECONCILE OF THAT WALK ALWAYS READS ZERO — "blind capture" is the missing half, and it is one of the story's own two OPEN build inputs.** `InventoryCount.tsx:438-450` calls `count_reconcile_inventory` **at capture time**, so the moment Lauren saves a count on the phone, `business_inventory.qty` **becomes** the counted number. By the time the owner opens `/inventory/reconcile`, book == counted and the residual is **0 by construction** — there is nothing left to reconcile *about that walk*. The new screen's DELTA mode is therefore meaningful only for movements that land **after** a count (sales, receives, adjustments), which is real and provable, but it is **not** the count-then-review loop the D-50 story describes ("Lauren walks the lot and counts… the owner reviews the walk as a unit"). The missing piece is `blind_capture_mode` — named in the story's own `PIECES:` list and left as **BUILD INPUT (2), explicitly owed to David**: the phone records to `inventory_counts` WITHOUT moving qty, and the DESK reconcile becomes the applier. That is a change to the CAPTURE path's write behavior and a per-session mode flag, not a reconcile-screen change — so it was deliberately NOT taken in this build. **David rules: does blind capture ship, and is it default-blind?** Until then, session-scoped reconcile (below) has nothing to reconcile. Ledger #145. |
| 68 | 🟡 **RECONCILE IS NOT SESSION-SCOPED — the build spec asked for it and it is honestly not built.** The spec said reconcile is scoped to an `inventory_count_sessions` row, the owner reviews the walk as a unit, and "accepting closes the session reconciled." The screen instead works **per lot**, across the whole catalog. Two reasons, both deliberate: (a) it is **blocked by #67** — with capture applying itself, a session's rows all read residual 0, so a session view would render a screen of "agrees — done" that proves nothing; (b) `inventory_count_sessions.status` is **owned by `InventoryCount.tsx`**, and a second writer of one lifecycle field is the STD-011 drift this codebase keeps paying for. The per-lot surface is the useful, correct subset that works **today**; the session view lands with blind capture, as one build, with one owner of the session lifecycle. Ledger #145. |
| 69 | 🟡 **A MULTI-STEP ACCEPT CAN PARTIALLY LAND, AND THE APPEND-ONLY LOG MEANS IT CANNOT BE ROLLED BACK.** An attributed reconcile issues 2-4 sequential RPC calls (`adjust_inventory_manual` per cause, then the closing `count_reconcile_inventory`). Each is individually atomic — qty write + ledger INSERT in one transaction — but **the sequence is not**. If step 2 fails (network, a concurrent lock, a refusal), step 1's ledger row is already permanent and **cannot be deleted**; on-hand sits at an intermediate value. **Mitigated, not fixed:** the UI states exactly which step it stopped at and that earlier steps are already on the ledger — the owner is told where they stand rather than left guessing, and the closing step always lands **absolutely** on the counted number so a *successful* run is self-correcting against concurrent sales. The durable fix is **one RPC that takes the whole plan** (a `jsonb` array of attributions) and applies it in a single plpgsql transaction — a MIGRATION, so out of scope for a no-schema build. Sibling in shape to #54/#58: a code-level guard whose durable form is a DB-level one. Proportionate at a single-owner nursery's volume; needed before multiple staff reconcile concurrently. Ledger #145. |
| 70 | 🟡 **THE GENESIS `opening_balance` ROWS CARRY A SYNTHETIC `occurred_at` — any future time-windowed replay is exposed to the same trap.** `20260720_inventory_movement_ledger.sql:360` backfills every lot's opening position with `occurred_at = now()` — **migration-apply time (2026-07-20), not the lot's origin.** That is defensible for the backfill's own purpose (replay-from-genesis == on-hand, which V3(b) proves) but it means the ledger contains ~126 rows whose timestamp **describes when we adopted the ledger, not when anything happened.** It produced the 2026-07-22 reconcile defect: for any lot last counted before 2026-07-20, the genesis row fell INSIDE the since-that-count window and was replayed as if 60 units had just arrived (prior 60 + genesis 60 = 120 against a book of 60 — an apparent *exact doubling* produced by ONE read, because genesis `delta = qty` happens to equal `prior.counted_qty` on an untouched lot). **FIXED at the consumer** (`isMovement()` in `reconcileMath.ts` excludes position-assertions from window replay — correct in every case, not a date patch), **but the hazard is in the DATA and the next time-windowed reader will meet it too.** Options, none taken: (a) leave it and rely on `isMovement` (current — cheap, and the exclusion is independently correct); (b) a doc note on the ledger table naming genesis rows as non-temporal; (c) re-date them to the lot's `created_at` — **rejected outright: that is an UPDATE on an append-only table whose trigger rejects it even for `postgres`**, which is the guarantee we deliberately will not break. (a) is almost certainly right; recorded so the next reader does not rediscover it live. Ledger #146. |
| 71 | 🟡 **ONE `status` COLUMN, TWO AUTHORS — the D-42 qty-derived status OVERWRITES the D-52 tombstone marker, and tombstoned lots still render as deletable.** Found during the 2026-07-22 owner-prove of the D-52 order loop. `business_inventory.status` carries **two incompatible meanings written by two independent authors**: D-42's rule that status **derives from qty** (`available` / `depleted`, recomputed on every qty write) and D-52/D-50's use of the same column as a **lifecycle marker** (the tombstone that survives a soft delete, plus the manual conditions `damaged`/`returned`/`archived`). **Consequence, both directions:** a soft-deleted lot's tombstone is **recomputed away** on the next qty write and the row reads as `depleted` — indistinguishable from a live lot that merely sold out; and a manually-set `archived` is silently reverted by the same derive. **Secondarily:** the grid still offers **Delete** on an already-tombstoned lot, and a second delete surfaces the raw RPC string **`already_deleted`** to the owner instead of an honest sentence (§1.6 item 5 — a control that looks actionable and isn't). **This is the same class as #56 and the D-49 family — one fact with two spellings — but at the SCHEMA level rather than in a vocabulary.** The durable fix is **lifecycle state in its own field** (`lifecycle` / `deleted_at`), leaving `status` to mean exactly one thing; that is a MIGRATION, and it must not land while the derive-guard still overwrites. **Sibling in shape to #54 and #58** (both deferred partial-unique-index migrations). **LOGGED, DELIBERATELY NOT FIXED 2026-07-22** — David's instruction at close-out was to record it, not fix it. Ledger #148. |
| 72 | 🟡 **THE `sale` LEDGER ROW'S `reason` IS NULL — the row cannot explain itself without a join.** Observed live 2026-07-22 on the owner-proven D-52 order loop: the `sale` events (delta **−6** on delivery order `897be269`, delta **−2** on the walk-in) carry a correct `source_id`, actor and timestamp, but `reason` is **NULL**. Every other movement kind writes a human-readable reason (`'baseline'`, `'walk-in sale decrement (commit+fulfill collapsed)'`, the reconcile attributions), so a reader scanning the ledger sees a bare signed number where every neighbouring row explains itself. **Why it matters more than it looks:** D-50's whole premise is that *a quantity cannot move without a durable row explaining it* — and the single most common movement is the one that explains itself least. It is not a correctness defect (the `source_id` join recovers the order), it is a **legibility** one, and the reconcile evidence strip is the surface that pays for it. **Fix:** carry the order number/id into `reason` at the sale-emit sites in `api/orders/submit.ts`. **Small — take it the next time the order path is touched**, per David 2026-07-22. Ledger #148. |
| 73 | 🟡 **`verify-universals.mjs` REPORTS SIX ALREADY-CLOSED GAPS AS STILL OPEN — the KNOWN-GAP list is a HARDCODED ARRAY that nothing makes shrink.** `OWNER_ONLY_PENDING` (`scripts/verify-universals.mjs:251-255`) is a literal list of nine tables reported as "owner-only (member-read pending — documented product decision, fail-closed)". **Six of the nine now carry member policies in repo migrations** — `orders`, `order_items`, `order_service_selections`, `order_compliance_records` (`20260724_manager_visibility_gaps`), `customers` (same), `social_drafts` (`20260727g`) — verified 2026-07-28 by `CREATE POLICY <table>_member*` counts. Only `plant_events`, `addons`, `nursery_profiles` are still genuinely owner-only. **⚠️ THE DIRECTION MATTERS AND IS THE MILDER ONE:** this produces STALE NOISE, **not a false green** — the cap still PASSES on its real assertion (`DUAL_TABLES` dual-RLS), and the gaps are advisory sub-findings. Nothing was mis-certified. **But a gap list that only ever grows stops being read**, and this one is printed on every `npm run verify` — so the six closed rows train the eye to skip the three real ones. That is the same failure as tech-debt #63: **the artifact does not carry its own provenance**, so nothing forces it to reconcile when the thing it describes changes. | 2026-07-28 (found while running the gate for ledger #162; the list itself predates the 20260724 and 20260727c/g member-policy work that obsoleted its rows) | The array should be **DERIVED, not declared** — the checker already parses every migration's policies (`effectivePolicy` / `tableHasOwnerPolicy` are right there), so "tables with an owner policy and no member policy" is computable from the same SQL it already concatenates. A declared list is a second representation of a fact the catalog/migrations already hold (**STD-011**), and it is the representation nobody updates. Cheapest correct form: replace the literal with a derivation over the parsed policy set, and let the three genuine gaps fall out of it. | **Next time `verify-universals.mjs` is touched**, or sooner if a member-policy build adds a seventh stale row. **NOT fixed in #162** — that pass was a table DROP with zero app code, and silently rewriting a verification script inside it would be exactly the unrelated-change drift the gate exists to catch. Surfaced rather than fixed, deliberately (§6 r10). |
| 74 | ✅ **RESOLVED 2026-07-28 — migration `20260728c_funnel_no_op_short_circuit.sql` APPLIED AND VERIFIED (David, at postgres). V1 no-op → `applied=false, reason='no-op', outcome='no_change'`, 40 → 40 · 🔴 V3 REORDER (same 40 elements, reversed) → `applied=false, reason='no-op'` — SET COMPARISON CONFIRMED, and this is the only probe that distinguishes it from an array build · V4 label-change → `applied=true`, member_id populated, rolled back · `prosrc` contains the short-circuit.** **THE AUDIT LOG IS NOW ITS OWN BEFORE/AFTER OF THE FIX** — `18:13:29 rbac-cleanup:assets-retired · success · 40 → 40` (the defect) → `18:45:08 v1-noop-probe · no_change · 40 → 40` (fixed) → `18:45:25 v3-reorder-probe · no_change · 40 → 40` (fixed, and order-insensitive). **🔴 DO NOT PRUNE THE PROBE ROWS — they are better evidence than any comment**, and they are the only artifact that demonstrates the set-vs-array property at the data layer. **Screen half still owed: owner-test card 8** (the RPC path is proven; pressing Save on `/team → Roles` is not). Prior status: **RULED + BUILT 2026-07-28 — migration GATED, owner-test card 8 owed.** David's ruling: **short-circuit the write, KEEP the audit row, `outcome='no_change'`** — a Save that changed nothing is an operator act on a permissions surface and is worth keeping; what is unacceptable is `outcome='success'` on `action='role.permissions_changed'` when nothing changed, **because the action name asserts an event that did not occur.** `no_change` rows are ignorable by anything counting changes and present for anything reconstructing who touched what; silence loses the second and gains nothing on the first. **🔴 COMPARED AS SETS, NOT ARRAYS** (David's correction — jsonb array ordering is not stable across a re-materialization, so raw-array inequality reports a change on a pure REORDERING, a false positive that reintroduces the defect from the other side); implemented as two-way jsonb containment, proven by V3. **FOUR NON-NO-OP CASES are explicit in the migration:** no tenant row yet (**saving the floor's own set MINTS the override — the one-way door, and short-circuiting it would make the most consequential write the most silent one**) · a label/description edit · **a drifted member array** (the save repairs it, so something changed — *this case is an INTERPRETATION, flagged: the ruling addressed desired-vs-resolved and not a drifted member; resolved in the direction that keeps `no_change` truthful*) · `p_op <> 'save'`. The general form went to **STD-023**. Original entry: **`save_role_permissions` ACCEPTS A NO-OP AND WRITES AN AUDIT ROW FOR IT — the funnel records changes that did not happen, and the /team Roles tab is the live exposure.** Found 2026-07-28 (ledger #163) when the CALL 5 cleanup runbook was re-run 88 seconds after the real work: the tenant held zero `assets:*`, the call executed anyway, and the audit trail now carries `rbac-cleanup:assets-retired · MANAGER · 40 → 40 · outcome success`. **From source: there is no `IS DISTINCT FROM` check anywhere in the function** (`supabase/migrations/20260723_permission_funnel.sql`) — it resolves the role, re-materializes every active member's array, and appends the `audit_log` row **unconditionally**. The runbook half is FIXED (the premise is now the driving subquery, plus an explicit `BEGIN…COMMIT` so the halt gate can actually abort the call), but **that only protects that one file. Every caller has this property, and the important one is the UI: pressing Save on `/team → Roles` with nothing changed writes a `role.permissions_changed` row asserting an event nobody caused.** Same class as a green check on a moved surface — the record stops being evidence. **Durable fix (David rules, MIGRATION):** short-circuit before the write when the resolved permissions are `IS NOT DISTINCT FROM` the current template AND every active member's array already equals it — return the existing `applied=false, reason='no-op'` shape (the function already returns `applied boolean, reason text`, and the non-owner path already precedents "return a verdict without doing the work") and write **no** audit row. Open question inside the ruling: whether a no-op should be *silent* or should write a distinct low-noise row (`outcome='no_change'`) — silence loses the fact that someone pressed Save, a row keeps it without claiming a change. **The 40 → 40 row is deliberately NOT deleted** — it is the evidence the gate needed fixing (#163). | **Before the /team Roles tab is owner-proven** (team-permissions card set), or with the next funnel migration — whichever is first. A migration touching all 13 write sites' shared entry point; not folded into a docs pass. |
| 75 | 🟡 **A DEVICE CHECK THAT DISABLES ITSELF ON ERROR — `[TRACE:DEVICE] device read failed` FAILS OPEN.** Observed live 2026-07-28 in the MANAGER session on `11c2e48` (recorded by David alongside the nav defect; unrelated to it). The device read errored and the surface continued as though the check had passed rather than as though it had failed. **A security-shaped check whose error path is "allow" is not a check — it is a check-shaped comment**, and it is the inverse of the fail-closed posture every other gate in this platform takes (`has_permission` returns false on absence; `PermissionRoute` refuses on a missing string; the funnel RAISEs rather than proceeding). The specific hazard is that the failure is INVISIBLE: a `console.log` in a trace stream is not a surfaced error, so a permanently-broken device check reads identically to a passing one on every screen (**the #158 class — a guard that cannot fail is indistinguishable from one that works**). **NOT investigated, logged as observed** — what is owed first is the read: which call fails, why, and whether the surface it guards is one where fail-open is a deliberate, recorded choice (a device *convenience* check reasonably fails open; a device *authorisation* check must not). **If it is authorisation, this is a security defect, not a polish item.** | **Next time `member_devices` / the device-handoff path is touched**, or sooner if the device check turns out to gate authority rather than convenience. Read before ruling. |
| 76 | 🟡 **THE WRITE-PATH CAP CANNOT SEE THROUGH AN RPC — every count it reports is a FLOOR, not a total.** `scripts/verify-write-paths.mjs` reads SOURCE; which table a `SECURITY DEFINER` function writes lives in the DATABASE. So **11 RPC writers** (`adjust_inventory_manual`, `adjust_inventory_qty`, `count_reconcile_inventory`, `count_promote_create_inventory`, `soft_delete_inventory`, `import_write_price`, `record_order_event`, `save_role_permissions`, `assign_member_role`, `discovery_rescan_clear`, `set_business_profile`) and **12 unresolved dynamic table names** (incl. `syncEngine.ts`'s `op.table`, a generic writer that can target anything, and `configureAuth.tsx`'s `config.tenantTable`) are REPORTED and never judged. Counting the RPCs, `business_inventory` is nearer **nine** paths than the three the cap asserts. **This is a stated limitation, not a false green** — the cap prints the advisory on every run and the ledger row says FLOOR — but a cap whose blind spot is bigger than its coverage will eventually be trusted past its evidence. **This is the CAP's own next build, not a table fix** (David, 2026-07-29). | 2026-07-29 (shipped with the cap, ledger #167) | Build the rpc→table map: parse `supabase/migrations/*.sql` for `CREATE [OR REPLACE] FUNCTION` bodies, extract the tables each writes (`INSERT INTO` / `UPDATE` / `DELETE FROM`), and fold each RPC caller into its target table's path count. Migrations are the right source — they are in version control and the cap already has no DB access. **Known incompleteness to state when built:** a function created outside the migration path is invisible (CLAUDE.md §6 r17's class), and dynamic SQL inside a function body cannot be resolved. Both are honest gaps to print, not reasons to skip the map. | Before the write-path counts are used to decide that a table is CLEAN — a table can pass the cap today on one source path while three RPCs also write it. Not urgent for the 17 known failures (those already fail); urgent the first time a PASS is treated as proof. |
| 77 | 🟡 **`api/` HAS NO TYPE CHECK — the deployed backend is in no tsconfig.** All three tsconfigs are `include: ["src"]` and **no tsconfig in the repo names `api/`**, so the quality gate's `tsc -p` never sees the twelve deployed serverless functions. The PARSE class is now closed (`verify:api-parses`, A10, chained) — **this entry is the TYPE half only, and it is filed separately on purpose: parse-only needed no baseline and landed the same day, while type-checking `api/` almost certainly surfaces a pile of pre-existing errors wanting a ratchet.** Bundling them would have delayed the check that catches the class that actually shipped. **What is at risk is narrower than it sounds but not nothing:** a parse-valid file can still call a function with the wrong arity, read a property off `undefined`, or — the live shape — pass the wrong argument order to `callerCan(authHeader, businessId, permission)`, which would gate on the wrong thing while parsing perfectly. | 2026-07-29 (found by the router.ts SyntaxError reaching production, ledger #170) | Add an `api` tsconfig (or extend cultivar-os's `include` to `["src", "api"]` — **decide deliberately: `api/` is Node/serverless, `src/` is DOM, so they may want different `lib`**), run `tsc --noEmit` over it, and RATCHET the result into `quality-baseline.json` the way eslint/knip already are. Do NOT gate on zero errors on day one. | Before the next `api/` handler is written or an existing one is materially edited — a wrong-argument-order gate is the failure mode that looks like working code. Not demo-blocking: the parse cap closes the class that took production down. |
| 78 | ✅ **RESOLVED 2026-08-01 — re-keyed on `file::binding#table.verb`, the shape `authority-grants-baseline.json` already used and which survived every edit of 2026-07-31.** 🔴 **DAVID'S RULING NAMES THE REAL COST, and it is not the minutes: *a ratchet that cries wolf teaches reflexive re-baselining, and a reflexive re-baseline is how a real violation gets absorbed.* Three times on 2026-07-31 the correct response was "re-lock it"; the fourth time there may be something in it, and it would be re-locked the same way.** NEW shared `scripts/lib/siteKey.mjs` (one implementation, both caps) — `binding` is the nearest preceding named declaration, `table` from the nearest `.from('x')`, `verb`, plus an `@n` ordinal only within an identical triple. **MEASURED BEFORE CHOOSING: all 167 candidate sites resolve a binding, zero failures**, so there is NO line-number fallback anywhere. **The stated fallback is `?` for a table out of window — exactly 1 site of 120 today.** **COUNTS PROVEN IDENTICAL BEFORE RE-LOCKING** via a new permanent `--dump` mode (`key<TAB>tag`): zero-row **85 → 85**, field-lists **35 → 35**, distinct keys 85 and 35 (no collision silently merging two sites), and the old line-tags reproduce the previous baselines exactly — **0 unmatched in either direction**. *A re-key that quietly loses a site is the absorption this fix exists to prevent, arriving through the fix.* **PROBES BOTH DIRECTIONS (STD-022):** a comment above a tracked site is NOT new (Z15/F13) · imports and blank lines are NOT new (Z16/F14) · **a genuinely new site still FAILS (Z17/F15)** · a second write on the same table in the same function is a distinct `@2` site (Z18) · **renaming the enclosing function DOES re-key it — a change of identity, stated not hidden (Z19)**. **LIVE PROOF:** three comment lines inserted at the top of `Dashboard.tsx` — the exact edit that produced two false NEWs twice yesterday — both caps report RATCHET CLEAN. **🔴 A SELF-CAUGHT DEFECT IN THE FIX:** the first run keyed **38 of 120 sites as `::if#` or `::for#`** — the bare-method pattern matched control-flow keywords, so the key named the wrong thing and hid the enclosing function. Stable, but *a key a human cannot read is a key that gets re-baselined without being read*, which is the habit this fixes. Keywords are skipped; counts re-proven after. **A SECOND ONE:** field-lists matches ON `.from('x')`, so a backward window from `m.index` sits before the table name and resolved `?` every time — caught by probes F13-F15 going 0-for-3, fixed with `m.index + m[0].length`, and the asymmetry with the write cap is commented at the site. Ledger #177. — ORIGINAL ENTRY: 🟡 **THE CAPS' BASELINES ARE KEYED ON `path:line`, SO ANY EDIT TO A BASELINED FILE READS AS A NEW VIOLATION.** Bit a THIRD time on 2026-07-30 (nine inserted COMMENT lines in `CostToProduce.tsx` moved an untouched `cost_objects` select 107 → 115, reported as *"1 entity gained a NEW hand-written field list"* — the select was byte-identical and I had never touched it). Bit TWICE on 2026-07-29: once when the citation fix changed how block comments are stripped (all lines moved), and again when a 4-line comment was added above `handleAuthUrl` — `zero-row-writes` reported 2 new sites and `field-lists` reported `businesses: router.ts:306`, **all four of them the same sites at new line numbers.** Both times the counts were IDENTICAL (81 bad, 6 failing entities) so nothing was mis-certified — **it is a FALSE ALARM, not a false green** — but that is the more corrosive failure: **a ratchet that cries wolf on every legitimate edit teaches the reader to re-baseline reflexively, and a reflexive re-baseline is exactly how a real new violation gets absorbed.** Same family as the wrong-citation defect: both teach distrust of the output, which costs more than a miss. Affects `verify-zero-row-writes` and `verify-field-lists` (`verify-write-paths` is keyed on FILE, not line, and is immune — which is the shape to copy). | 2026-07-29 (ledger #170) | Re-key both baselines from `path:line` to a **per-file COUNT** (`{path: n}`) the way `verify-write-paths` keys on file: a new site in a file raises its count and FAILS; a line shift changes nothing; a fix lowers it and is reported as a win. **State the hole this accepts:** a fix and a new violation in the SAME file net to zero and pass — a smaller window than today's false alarms cost, and the per-site list is still printed. Add a probe for it both directions. **NOT done at the tail of a long session on purpose** — redesigning a cap's keying at low context is precisely how the citation bug was introduced. | Before the next session that edits a baselined file — which is nearly any session. Each occurrence costs a re-baseline and one chance to absorb something real. |
| 79 | 🔴 **THE REFERENCE ENVIRONMENT CANNOT BE TORN DOWN — a tenant with inventory history is UNDELETABLE, which blocks OP-12.** Stated as what it is: "a lot cannot be hard-deleted" reads as an edge case; **"a business with ledger rows cannot be removed" is a blocker for the DEPLOY-TO-LIVE bar (§9), whose entire premise is a DISPOSABLE duplicate you break freely and discard.** Found 2026-07-30 by `scripts/rls/inventory-ledger-replay.rls.mjs` (I10) — the first thing that ever exercised it. **THE MECHANISM, proven not inferred:** `trg_inventory_ledger_immutable` is `BEFORE UPDATE OR DELETE … RAISE EXCEPTION` with no exemption, and **a referential-integrity cascade fires row triggers like any other write.** ① Deleting a LOT: `business_inventory_ledger.inventory_id` is `ON DELETE SET NULL`, and SET NULL is an UPDATE → refused. **OBSERVED LIVE**: `DELETE FROM business_inventory` returned *"business_inventory_ledger is append-only: UPDATE is not permitted"* — which is also the proof that the trigger fires on cascade-initiated operations, the load-bearing step for ②. ② Deleting a BUSINESS: `business_inventory_ledger.business_id` is `NOT NULL REFERENCES businesses(id) ON DELETE CASCADE` (`20260720…:131`), so the cascade issues a **DELETE** on ledger rows → the same trigger → refused. **DERIVED from ①'s proven mechanism + the FK rule in source; the literal `DELETE FROM businesses` was NOT run, deliberately — if it fails as predicted it strands a permanent, undeletable test tenant days before the demo. That one test is David's call.** `service_role` is separately powerless here: `UPDATE`/`DELETE`/`TRUNCATE` are all REVOKEd from it (probed 2026-07-30 — both refused, row intact). **CORPUS for the FK sweep (STD-021):** `supabase/migrations/*.sql`. Four tables carry `inventory_id … ON DELETE SET NULL` → `business_inventory` (`cultivar_plants`, `order_items`, `inventory_counts`, the ledger); **only the ledger has the trigger, so only it blocks.** Nothing references `business_inventory_ledger`. Blind spot: a table created outside the migration path is invisible to this sweep (§6 r17's class; `customers`/`orders` have no migrations at all — #39). **NOT a defect in day-to-day operation** — §7e rules that a lot is TOMBSTONED, never hard-deleted, and `soft_delete_inventory` works correctly. **The false artifact is the SCHEMA COMMENT**, which called SET NULL *"the belt for the rare true removal (e.g. a business_id cascade elsewhere) — the movement fact survives even when its lot does not."* **That belt has never worked, and the example it cites is precisely the case that fails.** #164's class: an artifact confidently naming a mechanism that is not there. **CORRECTED IN THE MIGRATION 2026-07-30** (same pass, per David's ruling). **Two individually-correct mechanisms — an immutable ledger and a cascading FK — that were never exercised together.** | 2026-07-30 (found by I10) | Decide which is true and make the artifact match: **(a)** ACCEPT — tombstone is the only removal; the comment is already corrected, and OP-12 teardown becomes "drop the Supabase project", not "delete the tenant row" (cheapest, matches §7e, and is probably right — **but it must be WRITTEN DOWN as the teardown procedure, or the first person to try it discovers this at the worst moment**); **(b)** EXEMPT THE CASCADE — narrow the trigger with `WHEN (pg_trigger_depth() = 1)` or an explicit `WHEN` clause so a cascade passes while a direct edit still RAISEs (restores the belt, widens the immutability hole, needs its own planted-bad probe per STD-022); **(c)** DROP the FK clause and keep `inventory_id` as a soft reference. **Run the literal `DELETE FROM businesses` on a throwaway tenant before choosing** — it is the one unobserved step, and it decides between (a) and (b). | **Before any reference environment is stood up (OP-12 / DEPLOY-TO-LIVE), not "next time the ledger is touched."** The bar is DORMANT only until the first paying customer; this is the kind of thing that is discovered while trying to use it. Not demo-blocking — nothing in the demo deletes a lot or a tenant. |
| 80 | 🟡 **`seed-owner-labor.mjs` WOULD RE-OPEN THE FINANCIAL WALL IT PREDATES — a fifth instance of the retired-writer class, found during the 2026-07-30 sweep and NOT neutered because David named four files, not five.** It writes `base_wage` / `cost_rate` **onto `labor_resources`** — the MEMBER-READABLE table. Phase 2 (`20260621_financial_wall_phase2.sql`) MOVED pay off that table for exactly that reason, leaving its wage columns "vestigial", and the GATE 2 proof asserts `labor_resources base wages → NULL (value moved off member-readable table)`. **Re-running this script would repopulate those columns and put wages back where any member can read them** — a real leak, not a vocabulary problem, and it would flip the wall proof red while looking like a seeding step. It also targets TRACE Enterprises (`45830ba7`), which is NOT one of the three live businesses, so it is less likely to be reached by habit than the four that were neutered — but "less likely" is the same argument that left the other four loaded. **Distinct from #79 and from the four retired scripts: those wrote RETIRED VOCABULARY; this one writes REAL DATA TO THE WRONG TABLE.** | 2026-07-30 (found sweeping for the retired-writer class) | Apply the same guard — `refuseRetired()` from `scripts/lib/retiredScript.mjs`, naming `20260621_financial_wall_phase2.sql` as the superseder and stating that its target columns are now walled. **Then decide the larger question it exposes:** the vestigial wage columns on `labor_resources` are still writable and still readable by members — Phase 2 deferred dropping them to "a later gated step" that has not happened, so the wall depends on nothing ever writing them again. A DROP would make the wall structural instead of conventional. | Before any labour/cost-model seeding is attempted, and before the vestigial-column DROP is scheduled. Not demo-blocking — nothing in the demo runs it. |
| 81 | 🔴 **THE INVENTORY READ SPLIT IS DECORATION — `unit_cost` is readable by any member holding `inventory:read`.** PROVEN 2026-07-30 by `scripts/rls/inventory-read-model.rls.mjs` under a real anon session: a MANAGER with `inventory:read` and NOT `costs:read` ran `select unit_cost from business_inventory` and got **14 costs back** (e.g. Alley Cat Redbud Espalier, unit_cost 6). **Card N-7 predicted this in its own FAIL text** — *"it does — the split is decoration, because RLS is row-level and the base table still grants SELECT"* — and named the stakes: *"N-6 without N-7 proves nothing."* **THE CAUSE: RLS is ROW-level.** `business_inventory_member_select` gates the whole ROW on `inventory:read` (`20260727…flip.sql:68`); hiding a COLUMN requires either a column-level `GRANT SELECT (…)` or a narrowed view, and a sweep of `supabase/migrations/*.sql` finds **NEITHER** for this table. So the confidential/operational split that spec §4 describes, that the manifest declares (`costs:read` is `sensitivity: confidential`), and that the grid honours visually, **does not exist at the data layer.** Any member who opens devtools or writes one supabase-js call reads the owner's cost basis — which is the margin. **This is the `capQ` shape one layer out: a wall asserted at the surface that the data layer never enforced.** | 2026-07-30 (found by the I16/I17 RLS test) | A MIGRATION, and there are two shapes: **(a)** column-level privileges — `REVOKE SELECT ON business_inventory FROM authenticated; GRANT SELECT (id, name, sku, qty, size, sell_price, …) TO authenticated;` plus a `costs:read`-gated view or RPC for the cost columns (true field-level enforcement; **note PostgREST returns a 403 for the whole query when an ungranted column is requested, so every existing `select('*')` and every `CORE_COLS` string that names `unit_cost` must be audited first — `BusinessInventory.tsx:93` names it today**); or **(b)** move the cost columns to a side table gated on `costs:read`, exactly as `labor_resource_wages` did for `view_wages` in Phase 2 — **the precedent is ours, it is proven, and its GATE 2 test passes 6/0.** (b) is the shape that already works here. | **Before any non-owner uses the platform on real data.** Not demo-blocking (David demos as owner), but this is the confidentiality claim the whole RBAC programme was built to make, and it is currently untrue. Sequence AFTER the demo, ahead of the first real member. |
| 82 | 🟡 **D-52 §R3's ONE-TIME RECONCILIATION WAS SCOPED "IN THE BUILD" AND NEVER RAN — 16 legacy order lines double-count, and one lot reads as oversold.** Surfaced 2026-07-30 by the I14 assertion. `Shoal Creek Vitex` reads **on-hand 29 / committed 61** across **16 open order lines, EVERY ONE created before 2026-07-21** — D-52's ruling date, and a count that matches the decision doc's own heading exactly (*"The 16 existing pending orders (recon R3)"*). Those orders decremented on-hand at checkout under **D-42**, and under **D-52** they still hold commitment, so the same units are subtracted twice. D-52 named it and deferred it: *"Under D-52 their stock should be on-hand-committed, not gone. Remediation is a one-time reconciliation of those orders at build time — **scoped in the build, not this decision**."* **THE FORWARD PATH IS HEALTHY — checked, not assumed:** a SIBLING `Shoal Creek Vitex` lot whose commitments are all post-D-52 reads **on-hand 38 / committed 8**, and the oversell guard is live at `api/orders/submit.ts:371-375`. **So the RULE works and the BACKLOG does not — a data condition, not a broken invariant**, which is why it is 🟡 and #81 is 🔴. Visible consequence today: `availableFrom` floors at 0, so that lot shows **0 available with 29 physically present** — it is unsellable on every surface that respects available. | 2026-07-30 (found by the I14 RLS test) | The reconciliation D-52 scoped: for each pre-2026-07-21 open order, decide whether its units were already removed from on-hand (D-42 decrement) and, if so, either **fulfil/cancel the order** (releasing the commitment, which is what most of these probably are — 2026-07-07..16 pending orders on a demo tenant are almost certainly test traffic) or **emit a compensating `receive` ledger row** restoring on-hand to on-hand-committed. **Ledger rows make this auditable and it must be done as NEW ROWS, never an edit (D-50).** Decide per-order, not in bulk — some may be real. | Before the I14 assertion can be green, and before any owner-facing "available" number is trusted on a lot with pre-D-52 orders. Not demo-blocking IF the demo lot is chosen deliberately — but **a demo on Shoal Creek Vitex would show 0 available**, so check the demo path first. |
| 83 | 🔴 **#81 OPTION (b) — MOVE `unit_cost` TO A `costs:read`-GATED SIDE TABLE. RULED BY DAVID 2026-07-30; FIRST BUILD AFTER LAWNS.** The cost wall does not exist at the data layer (#81): RLS is ROW-level, `business_inventory_member_select` gates the whole row on `inventory:read`, and no column GRANT or view narrows it — a MANAGER without `costs:read` read 14 unit costs in one query. **THE SHAPE IS ALREADY OURS AND ALREADY PROVEN:** `labor_resource_wages` did exactly this for `view_wages` in Phase 2 (`20260621_financial_wall_phase2.sql`), and its GATE 2 proof passes **6/0** as of 2026-07-30. Row-level RLS is the mechanism the whole platform uses, so the wall stays visible where everyone already looks for policies. **(a) column GRANTs** was rejected as having no precedent here and being invisible on every screen we own — the next person adding a column to a select gets a 403 with no clue why. **(c) narrowed view + `security_invoker`** was rejected on Thunder's reasoning, recorded: *a view is bypassed by querying the base table, so it only works if you ALSO revoke on the base table — at which point it is (a) with an extra representation of what an inventory row is*, and #159's lesson (a guard must live where the actor is, not in a layer that can be routed around) applies. **SCOPE:** a migration with a data move (`unit_cost`, `cost_confidence` → `business_inventory_costs`, PK `inventory_id`, RLS on `costs:read`, mirroring `lrw_*` policies) · **4 client readers** (3 already fixed to request the columns conditionally — see below — and they become joins) · **2 service-key readers** (`api/orders/submit.ts` ×2, `api/dashboard.ts`) need a join, and are UNAFFECTED by permissions since the service key bypasses RLS · the `margin:read` manifest note becomes TRUE and must be re-corrected (it currently records that it is false) · its own owner-test card, and the I16/I17 RLS assertions flip GREEN — **`scripts/rls/inventory-read-model.rls.mjs` is the acceptance test and it exists already, currently RED.** | 2026-07-30 (ruled) | Build it. The precedent migration, its RLS proof, and the failing acceptance test are all in the repo. | 🔴 **HARD GATE, DAVID'S WORDS: NO NON-OWNER MEMBER ACCOUNT ON A REAL TENANT UNTIL (b) IS LIVE.** David demos as OWNER, so nothing leaks at LAWNS — the exposure is real the moment Lauren has a MANAGER account, which is **days after they sign, not weeks**. This is the first build after the demo. |
| 84 | ✅ **RESOLVED 2026-07-31 BY RULING, NOT BY BUILD — and the reasoning is recorded HERE so nobody adds a server gate later on the theory that its absence was an oversight.** David ruled: **"may create an order" IMPLIES "may set its fields".** `orders:create` grants creating an order; a delivery date is A FIELD ON THAT ORDER, not a separate capability. The alternative is a string per column and a model nobody can use. **So the CLIENT gate was the defect, not the missing server gate** — and the client string moved again, `orders:update` → **`orders:create`**: the first correction was right for the wrong reason (it happened to include Lauren), when the correct rule is that anyone who may perform the act may set the act's data. **STAFF holds `orders:create` and takes orders, so STAFF gets the field too** — gating on `orders:update` would have handed it to the manager and withheld it from the person standing in the lot, the same defect with a different victim. `submit.ts` needs NOTHING: it gates the discount, the tax exemption, an order EDIT and an order DELETE — four distinct capabilities — and `delivery_date` on the create path is not a fifth. **General form recorded in RULINGS.md: A PERMISSION GATES A CAPABILITY, NOT A FIELD.** The genuine counter-examples are `order_discount:apply` and `tax_exempt:apply`, separate because they are MONEY and TAX acts, not because they are fields. Ledger #173. — ORIGINAL ENTRY: 🟡 **`orders.delivery_date` HAS NO SERVER GATE — the client invented a wall the server never had, which is the INVERSE of Phase 2.** `api/orders/submit.ts` proves caller authority for the discount (`:246`), the tax exemption (`:313`), an order edit (`:1068`) and an order delete (`:1286`) — **and nothing at all for `delivery_date`**, written unguarded at `:702-713`. So the ONLY thing deciding who may set a delivery date on the checkout path is `CustomerCapture.tsx:139`, a CLIENT gate. Phase 2's whole principle was *where client and server disagreed, the server won*; here the server has no opinion and the client is enforcing one by itself. **An unenforced client gate is a fake pill by another name** — the exact shape #153/#166 kept producing, arriving from the opposite direction. Note the asymmetry that makes it visible: the OTHER writer of delivery data, `api/customers/create.ts:67`, DOES check (`deliveries:create`) before its `deliveries` INSERT — one endpoint gates, its sibling does not. Found 2026-07-31 while ruling on the field's permission string (ledger #172). | 2026-07-31 | `submit.ts` proves `orders:update` before writing `delivery_date`, matching the client gate — the same `callerCanManageOrders` call the edit path already makes at `:1068`. **The narrower question is whether the CREATE path wants a per-field check at all**, or whether "may create an order" already implies "may set its fields"; if the latter, the CLIENT gate is the thing that should go, not the server that should grow one. Both readings are defensible and that is why it is a ruling, not a build. | **DEFERRED BY DAVID 2026-07-31 — not now.** The demo is days away and `submit.ts` is the money path; the exposure requires a member who can already create orders setting a date they were not meant to set, which is not a leak and not a tenant crossing. **Trigger: the first work that opens `submit.ts` for another reason, or the first non-owner-non-manager session that reaches checkout.** Recorded rather than left silent — see RULINGS.md OWED. |
| 91 | 🔴 **THE TWO PLATFORM CHECK CONSTRAINTS DISAGREE AND ARE NOT A SUBSET IN EITHER DIRECTION — AND THE GREP THAT LOOKED FOR THE SECOND ONE COULD NEVER HAVE FOUND IT.** ⚠️ **FIRST, A PREMISE CORRECTION, because this row was commissioned as *"`campaign_posts_platform_check` is live and in none of the 105 migrations"* and THAT IS NOT TRUE.** It is at [`20260529_campaigns.sql:26-27`](../supabase/migrations/20260529_campaigns.sql#L26-L27), declared **INLINE on the `CREATE TABLE`** — `platform text NOT NULL CHECK (platform IN ('instagram','facebook','sms','email'))`. Postgres then auto-generates the name `<table>_<column>_check`, so **the string `campaign_posts_platform_check` is never typed anywhere in the repo** and a grep for the constraint NAME returns nothing on a constraint that has been committed since 2026-05-29. **This is therefore NOT a live-object-in-no-migration instance and is deliberately NOT filed as one** — filing it as the class it is not is exactly the error #22's own history warns about. 🔴 **THE REAL DEFECT, which is worse than the one that was suspected: `social_drafts` accepts `(instagram, facebook, tiktok, twitter, sms)` ([`20260609:33`](../supabase/migrations/20260609_social_drafts_platform_check.sql#L33)) and `campaign_posts` accepts `(instagram, facebook, sms, email)` ([`20260529:27`](../supabase/migrations/20260529_campaigns.sql#L27)). NEITHER SET CONTAINS THE OTHER.** `campaign_posts` reserves `email`, **which no channel list, no setup checkbox and no generator prompt anywhere in the platform can produce**; and it rejects `tiktok`/`twitter`, **which the only channel-configuration UI that exists offers as ticked checkboxes** ([`SocialSetup.tsx:12-17`](../packages/cultivar-os/src/pages/SocialSetup.tsx#L12-L17)). **So the campaign path can be configured, through its own supported UI, into a state its own table refuses.** The blast radius is total rather than partial because [`api/campaigns.ts:129`](../packages/cultivar-os/api/campaigns.ts#L129) is a **single multi-row `.insert(postRows)`** — atomic — so ONE rejected channel rolls back EVERY post, and since [`:103-116`](../packages/cultivar-os/api/campaigns.ts#L103-L116) already committed the `campaigns` row in a prior statement with no transaction spanning them, the result is a **committed campaign with zero posts**. Two exist today (`6b0b131a`, `2e365901`, both "arbor day", both `status:'active'`). ✏️ **THE FIX WAS WRITTEN 74 DAYS AGO FOR THE OTHER TABLE AND NEVER TRAVELLED:** [`20260609:10`](../supabase/migrations/20260609_social_drafts_platform_check.sql#L10) states the mechanism in its own header — *"the insert is atomic, one sms row rolls back all rows"* — diagnosed for `social_drafts`, fixed for `social_drafts`, never carried to its sibling. **#22 and #91 are one defect on two tables; only one was repaired.** 🔴 **AND THE METHOD FINDING IS THE DURABLE HALF, sized because it decides whether #23 is buildable: the corpus holds ~129 inline `CHECK (` declarations, EVERY ONE of which is invisible to a name-based grep and EVERY ONE of which would read as "live object in no migration" to a sweep keyed on `conname`.** A sweep that reports ~129 false positives on its first run is a sweep that gets discarded wholesale — which is how a correct check dies. **#23 must match on the constraint DEFINITION (`pg_get_constraintdef`) against parsed migration text, never on the name.** ✏️ **AMENDED 2026-08-22 (2) — THE PATTERN IS NOW TWO, NOT ONE, AND IT RUNS IN BOTH DIRECTIONS.** The same evening produced a SECOND migration recorded as pending while applied: **`20260802c`**, which `CLOSE-OUT-LEDGER.md:22` called *"GATED AND UNAPPLIED"* and which `pg_catalog` shows live as the seven-argument `set_business_module_state(…, integer)`. 🔴 **A recon published a platform-wide-write-outage headline on that doc sentence, and the catalog disproved it in one query.** So the record diverges from the database **in both directions at once**: a repo object the catalog does not name the way the repo does (~129 inline CHECKs, invisible to a `conname` grep) **and** a catalog object the repo says is not there yet (#22, `20260802c`). **Both directions were found by querying `pg_catalog`; neither was findable by reading a document.** The general form has its own row — **#92**. |  2026-08-22 (found reconciling David's live-constraint probe against the migration corpus; recon `docs/audits/social-campaign-path-recon-2026-08-22.md`) | **Two decisions, and they are genuinely separate.** **(a) THE VOCABULARY:** one derived channel vocabulary feeding both CHECKs, both generators, the setup page and all six display maps, with a cap asserting both directions — the shape `verify-tile-fields` already proves. Q1 of the recon counts **nine literal enumerations across three incompatible sets**; this is tech-debt #20 "platform union", now measured rather than named. Widening `campaign_posts` alone stores the wrong value in a wider column and fixes nothing structural. **(b) THE SEQUENCE:** `campaigns` + `campaign_posts` as ONE transactional act — an RPC taking the plan as `jsonb` — which is #69's named durable form, or at minimum a `catch` that deletes the row it just created. ⚠️ **A widening of `campaign_posts_platform_check` IS A MIGRATION AND IS DAVID'S TO APPLY** — deliberately not written here. | 🔴 **THE CAMPAIGN PATH IS UNUSABLE END TO END TODAY** — every generation with a default-configured tenant produces an orphan. Ahead of any campaign use at LAWNS. **The vocabulary derivation (a) is post-demo; the sequence fix or the widening is not**, because the failure is silent to the owner (the list renders "No campaigns yet" over the orphans it cannot read — recon Q7). |
| 92 | 🔴 **THE REPO'S RECORD OF THE DATABASE IS UNRELIABLE IN BOTH DIRECTIONS, AND THE CHECKER THAT WOULD CLOSE IT HAS BEEN OWED SINCE THE `businesses` RECON — THREE INSTANCES NOW, ALL FOUND BY QUERYING `pg_catalog` RATHER THAN BY READING A DOC.** **(1) #22 — `20260609_social_drafts_platform_check.sql`**: recorded *"David must apply"* for 74 days while the live constraint already matched it byte-for-byte. **(2) `20260802c_enable_starts_the_clock.sql`**: recorded **GATED AND UNAPPLIED** in `CLOSE-OUT-LEDGER.md:22` while `pg_catalog` shows the seven-argument signature live and `moduleState.ts:113` logs `applied:true` in the browser — 🔴 **and a recon published a 🔴 platform-wide-write-outage headline resting on that one doc sentence, which the catalog disproved in a single query.** **(3) ~129 INLINE `CHECK (` declarations** whose auto-generated names appear nowhere in the repo, so a name-based reconciliation reports every one of them as a live object with no migration (#91). 🔴 **THE TWO DIRECTIONS ARE DIFFERENT FAILURES AND BOTH ARE REAL: the repo claims work is OUTSTANDING that is DONE (1, 2), and the catalog holds objects the repo cannot MATCH (3).** ⚠️ **THE COST IS NOT BOOKKEEPING — IT IS THAT EVERY DOC-SOURCED CLAIM ABOUT THE DATABASE IS NOW SUSPECT, INCLUDING THE CORRECT ONES.** #189 and #190 both recorded *"apply state is a DOC read, not a fact"* as a named blind spot and both proceeded anyway; **naming a limit does not discharge it**, and 2026-08-22 is what that costs — a wrong 🔴 headline, committed and pushed, on a premise nobody could check from where they were standing. **The honest artifact where there is no catalog access is THE QUERY AND ITS BRANCH TABLE, never a headline.** | 2026-08-22 (2) (third instance; owed since the `businesses` write-path recon, ledger #189/#190, where it was first named and not built) | **THE SCHEMA-SNAPSHOT CHECKER.** A committed snapshot of the live catalog — functions with `proargnames` and full signatures, constraints via `pg_get_constraintdef`, policies, triggers, indexes — reconciled **BOTH DIRECTIONS** against the parsed migration corpus. 🔴 **It CANNOT live in `npm run verify`** — every cap there reads repo `.sql` as text, and the 2026-08-02 ruling already settled that a gate needing a live database *"must stay offline and deterministic… a gate that fails for reasons unrelated to the change gets worked around, which is worse than no gate."* Its home is **`verify:rls`** (which already takes a live connection) plus a **refresh step whose output is COMMITTED**, so the snapshot is reviewable in a diff and a drifting record shows up in code review rather than in a recon's headline. **Match on DEFINITION, never on name (#91's lesson); report BOTH directions separately, because repo-says-pending-but-applied and catalog-has-no-migration are different defects with different fixes.** | 🔴 **DAVID RULES — DELIBERATELY NOT BUILT.** Three instances is a measured class, not an anecdote (#174), so this row exists to carry a NUMBER rather than a recollection. **Trigger: the next recon or build whose conclusion depends on whether a migration is applied** — which, on the current rate, is the next one. Until it exists, the standing discipline is the cheap half and it costs nothing: **a claim about the database is sourced from the catalog or it is not made.** |
| 93 | 🔴 **THE COUNT CONFLICT SHEET'S "first count" LABEL GOES FALSE AFTER THE FIRST RECOUNT — IN THE EXACT SHEET LAUREN HITS TWICE ON WEDNESDAY.** `prevQty` reads `sessionCounts[key]` (`InventoryCount.tsx:387`) and `commitCount` **OVERWRITES that key on every save** (`:564`), so the sheet always compares against the *most recent* count while calling it the *first*. On Lauren's third pass it reads **"first count 6"** — 6 was the SECOND count, and the real first count (3) **is not on the screen at all**. Two sites: the caption `:833` and the button `:849`. **This is §6 r18's class exactly** — a label asserting something the state contradicts — and it lands in the one sheet whose entire job is to help a human choose between two numbers. ⚠️ **The same sheet's "Keep the first count" is NOT an undo**; it abandons the new entry. | 2026-08-23 (found by recon #198 as F1; filed as a named defect row 2026-08-23 (14) so it rides with the multi-pass build) | The label names what it actually holds — *previous count* — or the sheet keeps the true first value separately from the running one. 🔴 **NOT a rename in isolation: the multi-pass DESIGN CALL (`user_stories.md`, Billy Bob story) adds a third option **ADD** to this same sheet, which changes what the two numbers MEAN.** | **RIDES WITH THE MULTI-PASS COUNT BUILD (D-50 / R-A MINIMUM) — deliberately not fixed alone.** Piece 3 of that build rewrites this sheet's job, and renaming a label in a sheet about to be re-specified is churn. **If the build slips past Wednesday, fix the label alone** — a false label in front of Lauren is worse than an inconsistent one. |
| 94 | 🔴 **TWO DEAD GENERATIONS OF LIVE CAPABILITIES ARE STILL STANDING IN THE PRODUCTION DATABASE, WITH ZERO RUNTIME READERS — AND LATER MIGRATIONS KEEP TREATING THEM AS CURRENT, WHICH IS WHY NOBODY NOTICED.** Found while enumerating what Wednesday's real tenant would be sharing a database with (recon #208). **(1) `pmi_assets` / `pmi_service_logs`** (`20260529_pmi_shared.sql`) — **zero `.from()` reads across `packages/{cultivar-os,shared,trace-app}/src` and `api/`**; the live pair is `business_pmi_schedule` / `business_service_log` (`20260612_business_assets_inventory_pmi_service.sql`). 🔴 **They are not merely stale — `20260622_is_active_member_canonical_rls.sql` and `20260623_audit_log_spine.sql` BOTH edit them**, so two later builds spent effort maintaining RLS on tables nothing reads. **(2) `campaign_tone_samples`** (`20260529_campaigns.sql`) — zero readers; the live table is `business_voice_samples` (`20260613_business_voice_samples.sql`), which is what `packages/cultivar-os/api/campaigns.ts:81,171` actually uses. ⚠️ **THIS IS A SOURCE-DERIVED CLAIM, NOT A CATALOG ONE** (2026-08-22 ruling) — the tables' EXISTENCE in the live project is not asserted here; the **zero-reader** half is proven from source and is the half that matters. | 2026-08-24 (recon #208, Q6 — surfaced while answering *what else is in that database*) | Confirm with the query in `docs/audits/ignition-consultation-recon-2026-08-24.md` §Q6, then a **GATED** DROP migration on the `20260727d` pattern. 🔴 **Sibling of #39's class but the INVERSE of it: #39 is a live table with no migration; this is a migration-born table with no life.** Nothing in `npm run verify` can see it — `verify-select-policies` asserts a policy EXISTS, never that a reader does. | 🟡 **OPEN — surfaced, not fixed, deliberately.** A table DROP days before a demo is the wrong risk, and per §6 r1 the earlier migrations cannot be edited. ⚠️ **The cheap harm is real and recurring: the next RLS or audit sweep will maintain them again**, exactly as two already have. |
| 95 | 🔴 **RECONNECT DOES NOT SELF-HEAL — A COUNT QUEUED OFFLINE DRAINS ONLY AFTER A MANUAL PAGE REFRESH.** ✅ **MEASURED, NOT SUSPECTED: David, 2026-08-24, on SHA `1c60964`, iPhone Safari, normal tab, airplane mode ON with wifi manually OFF.** With a count sitting in the queue and the pending banner showing, turning airplane mode OFF and wifi back ON does **not** drain the queue — the banner stays. A manual page refresh drains it. 🔴 **WHY IT MATTERS, IN THE WALK'S TERMS RATHER THAN THE CODE'S: the person walking the rows has no reason to know that a reload is what clears it.** She comes back into signal, sees a pending banner that does not move, and reaches one of two conclusions — *it is broken*, or *I should stand here until it finishes*. **Both are wrong, and both cost her the end of the trip**; the second is worse, because waiting looks like diligence and produces nothing. ⚠️ **AND IT FAILS THE CARD WRITTEN TO PROVE THIS SURFACE, ON THE CARD'S OWN WORDS:** owner-test card 1 says *"Airplane mode **OFF**. **EXPECT** the counter to fall to 0 **without pressing anything**."* That clause is exactly what this measurement contradicts, which is why the card cannot be read as a clean pass. | Measured 2026-08-24 · `1c60964` · iPhone Safari, normal tab, airplane mode + wifi off | — 🔴 **DELIBERATELY EMPTY, AND THAT IS THE ENTRY'S DISCIPLINE: THIS IS A CAPTURE, NOT A SCOPING.** No fix is proposed, no mechanism is named and no size is estimated here, on purpose — naming one would pre-answer a scoping pass that has not happened, and the last three sessions' worth of value came from separating the two. What is recorded is the measurement and what it costs the person. | Before any offline surface is read as OWNER-PROVEN — **card 1 cannot pass as written while this stands**, so this blocks the card, not the demo. Scope it in its own pass. |
| 96 | 🔴 **THE OFFLINE QUEUE IS PER-ORIGIN — AND `cultivar-os.app` AND `cultivar-os.vercel.app` ARE DIFFERENT ORIGINS. NOTHING CROSSES BETWEEN THEM.** ✅ **VERIFIED FROM SOURCE BEFORE FILING, and the description survived contact with the code exactly as given.** The queue is ONE `localStorage` key per (business, domain) — `trace:sync:<businessId>:<domain>:queue` — assembled at `store.ts:118` (`ROOT = 'trace:sync'`), `:124` (the namespace), `:128` (`k()`), with `offlineQueue.ts:21` supplying `QUEUE_KEY = 'queue'` and `syncEngine.ts:68` constructing the pair; the adapter is `localStorage` whenever the DOM has it (`store.ts:65-71`), an in-memory map otherwise. The asset store is the deliberate IndexedDB one — `assetBlobStore.ts:29-30`, database `trace-assets`, object store `pending`. **Both `localStorage` and IndexedDB are origin-scoped by the web platform, so neither crosses hosts.** ✏️ **TWO PRECISIONS THE SOURCE ADDS, neither of which changes the claim:** the namespace falls back to the literal `no-business` when `businessId` is null (`store.ts:124`), so a pre-business session has its own bucket; and the SESSION half is a **library default rather than a line in this repo** — `supabase/client.ts:10` calls `createClient` with no storage option, so supabase-js keeps the session in browser `localStorage`, origin-scoped like the rest. 🔴 **CONSEQUENCE ONE — AN UN-DRAINED WALK QUEUED ON ONE ORIGIN IS INVISIBLE ON THE OTHER. NOT LOST — STRANDED**, and unreachable from the surface the person is standing in front of, which is indistinguishable from gone to everyone except someone who knows to go back to the other host. 🔴 **CONSEQUENCE TWO (OP-14) — EVERY OFFLINE RESULT PROVEN ON ONE ORIGIN PROVES NOTHING ABOUT THE OTHER.** A card run on `cultivar-os.vercel.app` is not evidence about `cultivar-os.app`, and **no offline card names an origin today**, so the record cannot currently say which host any result was measured on. | Filed 2026-08-24 (property of the store since it was written; the two-origin exposure is what is new) | — **CAPTURE ONLY; no fix proposed and no mechanism named.** Per-origin isolation is a property of the web platform, not a defect in the store — what is owed is a decision about which origin is THE app and what the tests say they ran against, and that is a scoping pass. | Before any offline card is run again or read as evidence — **the origin a test ran on is part of its result**, and today no card records it. Also before `cultivar-os.app` is put in front of anyone, per the apex-domain finding in ledger #206 (f). |
| 97 | ⚠️ **THE RECOGNIZE SHEET SAYS *"Scanned:"* EVEN WHEN THE CODE WAS TYPED BY HAND — a small copy nit, FILED RATHER THAN FIXED, at David's direction.** `InventoryCount.tsx:936` renders `Scanned: <code>{unknownTag}</code>` on the *"Didn't recognize this"* sheet, and that sheet is reached from **two** paths: a camera decode (`QrScanner.tsx:23` → `onScan`) and a **hand-typed** entry into the manual field (`QrScanner.tsx:105-114`, `submitManual` → `onScan` when no `onLookup` is wired). **Only the first was scanned.** Card 9's expected copy quotes the same word (`docs/owner-tests/inventory-full-surface-test.md:584`), so a fix touches the card too. ⚠️ **LOW PRIORITY AND NOT A CORRECTNESS DEFECT — the value echoed back is right, only the verb naming how it arrived is wrong.** It is logged because it is §6 r18's family (*a label is a claim, and it must hold for every row the surface can contain*) in its smallest form, and because the honest fix is one word, not a rewrite — e.g. `Entered:`, or a conditional the component already has the information to make. **Found during the 2026-08-24 variety-lookup recon; not in that recon's scope.** |
| 98 | 🔴 **A SHORTER NAME IS NOT A "DIFFERENT SPELLING", AND THE COUNT SHEET'S OWN PROMISE READS AS THOUGH IT COVERS ONE — SO TYPING A VARIETY'S SHARED WORD AND SAVING MINTS A DUPLICATE.** ⚠️ **FILED, NOT FIXED — the 2026-08-24 recon was LOOK-ONLY and David rules on its five options.** `InventoryCount.tsx:951` tells the operator: *"We'll match this to an existing variety if we can, so different spellings don't split into separate items."* The guard behind it is **resolve-before-create** (`:668`), which runs the shared ladder on the typed NAME — and L4's predicate is **token-set EQUALITY**, `tokenSetsEqual` (`canonicalName.ts:81-85`), whose first line is `if (a.size !== b.size) return false`. **So a strict SUBSET is a non-match by construction:** `{vitex}` vs *Shoal Creek Vitex* `{shoal, creek, vitex}` is 1 ≠ 3. The miss falls through to the *genuine NEW variety* branch and mints `groupKey: slugify(name)` (`:701`) — **a third `business_inventory` row named "Vitex" beside the two real ones, with on-hand split across it.** 🔴 **This is the D-49 / #135 duplicate-variety family arriving through a SHORT NAME rather than a spelling.** ✅ **The code already names the gap three lines above the call** (`:665-667`: *"extra words + plural stemming … are the deferred L5-subset/L6-stemming layers and still mint a distinct variety"*) — **so the boundary is documented and the COPY over-reaches on it**, resting all its weight on the word *spellings*. ⚠️ **Two separate facts, both true: WHEN it fires (on Save, `:668` — never on entry, there is no typeahead anywhere in the tree) and WHAT it covers (case / word order / punctuation / apostrophes — not a subset).** Recon + five options (copy-only → live typeahead), all client-side, **zero migrations, zero new `api/` functions**: `docs/decisions/2026-08-24-variety-lookup-exact-match-recon.md`. |
| 99 | ⚠️ **`store.ts:163-166` ASSERTS A SAFARI-PRIVATE BEHAVIOUR THAT A MEASUREMENT DID NOT REPRODUCE — AND OWNER-TEST CARD 5's PASS CONDITION RESTS ON THE SAME PREMISE.** The comment justifying the probe's read-back says *"A Safari Private tab … can ACCEPT `setItem` without throwing and still not persist — a write-only probe would pass and the store would still be a hole."* 🔴 **MEASURED 2026-08-24 by David — SHA `ebdb186`, iPhone Safari, PRIVATE tab, `cultivar-os.vercel.app`, ONLINE: the probe ran (`InventoryCount.tsx:214`, on page mount, ungated) and returned `ok`** — proven by the absence of the banner, which has no other condition (`:815` idle, `:788-792` counting). **The Private tab accepted the write AND read it back.** ✅ **The read-back is still worth keeping** — a browser with site data hard-blocked is a real configuration and is exactly what it catches. ⚠️ **What is wrong is the SCOPE of the claim, and the cost is downstream: card 5 says *"If that warning is ABSENT, STOP and report — the probe did not fire"* (`inventory-full-surface-test.md:525`), which sent a correct run to a wrong conclusion.** 🔴 **The real limit, and the sentence the comment should carry instead: the probe writes, reads back and cleans up ALL INSIDE ONE PAGE SESSION (`store.ts:171-174`) — it measures *can this store hold a value now*, never *will it still hold it after the tab closes*, and a Private tab passes the first and fails the second.** Fix is a comment plus a card expectation; **neither was touched — recon was LOOK-ONLY.** `docs/decisions/2026-08-24-storage-probe-private-tab-recon.md`. |
| 100 | 🔴 **THE OFF SWITCH SHIPPED AND THE FUZZ DID NOT — SO TURNING A MODULE OFF CHANGES THE STORED STATE AND ALMOST NOTHING ELSE.** The enable/disable round trip landed 2026-08-24 (ledger #212): the owner can now switch a non-core module off, the write proves it wrote, and the data survives. 🔴 **WHAT DOES NOT EXIST IS THE THING THE OWNER IS SUPPOSED TO SEE AFTERWARDS.** R-2 rules that a disabled tile stays VISIBLE showing **fuzzy data**, and that the fuzz is a **SERVER-SIDE AGGREGATE** — one number, the detail never reaching the browser. **A repo-wide search for `fuzz` returns TWELVE hits and every one is prose** (`Tile.tsx:218`, `trialClock.ts:21`, `tileRegistry.ts:446,456`, `Subscription.tsx`, two migrations, three test/comment mentions) — **there is no fuzz component, no fuzz endpoint, no aggregate RPC, zero lines of implementation.** So `useModules.ts:122` still maps a DISABLED row to `'available'`, the same state as never-enabled **and** the same state as a missing row: **three distinct facts, one pixel.** ⚠️ **THE DISPLAY HALF WAS DELIBERATELY NOT FIXED, AND THE REASON IS THAT THE ONLY RULED DESTINATION IS THE FUZZ.** R-2 answers M-C in its own words — *"not absent, **not a fifth flat state** — the fuzz"* — so minting a `TileState` of `'disabled'` would be answering a ruling with a constant, in the one direction the ruling explicitly closed. 🔴 **AND A CSS BLUR IS REFUSED BY NAME, NOT BY TASTE: R-2 calls it *"#81 with a filter on it"*** — the confidential payload would still be in the response and one devtools line reads it, so the cheap version is a security defect wearing the fix's clothes. **The honest state today: the marketplace reflects the change (the row moves Active → Available, or the Included glyph flips), and the dashboard does not.** | 2026-08-24 (ledger #212 — created BY the off switch; before it, nothing could be disabled, so the gap was unreachable) | Build the server-side fuzz aggregate, then have `useModules` render the disabled row as the fuzzy state per R-2 and the route render it per R-3 (see #101). **The aggregate is the prerequisite and it is the expensive half** — it is the same shape #81 wants, and R-2 notes a fuzz implemented as CSS *"would pass every cap we own today — capA reads gates, not selects."* | Before the off switch is put in front of a customer as a feature rather than a mechanism. ⚠️ **Not demo-blocking**: the switch is reachable only from `/admin/subscription`, which is owner-only. |
| 101 | 🔴 **A DISABLED MODULE'S ROUTE STILL WORKS, IN FULL — AND AS OF 2026-08-24 THAT IS REACHABLE FOR THE FIRST TIME.** `router.tsx` declares 48 routes and a grep for `business_modules\|module_key\|useModules\|enabled` across it returns **ZERO**. `/delivery-schedule` is gated at `router.tsx:149` on **`deliveries:read`** — a PERMISSION — so with Delivery Routing switched OFF the page renders and every function on it works. **`/deliveries` (`:152`, `deliveries.route:read`) is the same shape.** ⚠️ **THIS IS NOT NEW CODE AND IT IS NOT A REGRESSION** — it has been true since the router was written. What changed is that **before the off switch there was no way to reach the state**, so the defect was latent; it is now one owner click away. Filed rather than fixed, per the build's own scope bar. 🔴 **THE FIX IS NOT A GUARD, AND GETTING THAT BACKWARDS IS THE TRAP: R-3 rules that the route RENDERS THE FUZZ AND DOES NOT BLOCK** — *"it does not 404 and it does not redirect"* — which is `PermissionRoute`'s six-state ruling extended one axis from PERMISSION to ENABLEMENT. **So this is blocked on #100** (there is nothing to render until the fuzz exists), and R-3 names the structural obstacle that sizes it: **`useModules` fetches the enablement overlay and `router.tsx` has no access to it.** That is an enablement-context change, not a one-line gate — which is exactly why M-D was filed COHERENT rather than trivial. ⚠️ **Only ONE module has any functional gate on `enabled` today, platform-wide: `api/social/generate-posts.ts:52` refuses when `!mod.enabled \|\| !mod.configured`.** Every other module's capability keeps working when its row says off — so for ten of eleven catalog entries, "off" currently means "off on the marketplace page." | 2026-08-24 (latent since the router was written; made REACHABLE by the off switch, ledger #212) | Give the router access to the enablement overlay (a context/provider — `useModules` already fetches it), then render the R-2 fuzz on a disabled module's route rather than refusing it. **Do not add a redirect or a 404** — that contradicts R-3 and the six-state ruling it extends. | With #100 — they are one build, and doing this one first would ship the refusal R-3 forbids. |
| 102 | 🔴 **THE RECEIPT OCR ASKS FOR THE QUANTITY, GETS IT, AND THE SAVE THROWS IT AWAY — SO "HOW MANY HAPPY HOSES DID WE BUY" IS UNANSWERABLE FROM DATA WE ALREADY PAID TO EXTRACT.** ✅ **NOT A SUSPICION — TRACED END TO END, 2026-08-24 recon.** The prompt asks for `{"description","sku","quantity","unit_price","amount"}` and says *"include sku, quantity, unit_price only if printed"* (`api/receipts/ocr.ts:64,94,108`); `ReceiptKeeper.tsx:93` types all five correctly. 🔴 **The loss is ONE assignment: `ReceiptKeeper.tsx:259` declares the editable state as `Array<{ description: string; amount: number }>`, and `sku`/`quantity`/`unit_price` are dropped there** — `finalLineItems` (`:422-425`) then rebuilds the same two fields and `:449` writes that pair to `receipts.line_items`. ⚠️ **THE PART THAT CHANGES WHAT A FIX COSTS: the data is MISFILED, not destroyed.** The same insert writes **`line_items_original`** (`:450`, column `20260614_receipts_reconciliation.sql:31`) = the raw pre-edit OCR array, which **does carry quantity/sku/unit_price when the receipt printed them**, plus `ocr_raw` (`:443`). **So the numbers are most likely already in the database, in a column whose stated job is a before/after audit snapshot, that nothing queries as data.** **This is UPSTREAM of any purchase-line build and independent of it** — a purchase table built on a quantity-less capture would be an empty table. Recon: `docs/decisions/2026-08-24-sellable-things-and-line-items-recon.md` §B6. |
| 103 | 🔴 **A PER-PLANT SERVICE CHARGES ITSELF AGAINST EVERY CART LINE, INCLUDING ONES THAT ARE NOT PLANTS — A LIVE MONEY DEFECT THE MOMENT A NON-PLANT GOOD IS SOLD.** `submit.ts:218` computes `itemCount` as the sum of **ALL** cart-line quantities, and every `price_type:'per_unit'` / `price_unit:'plant'` offering multiplies by it (`qtyFor` → `nettedQuantity`, `:490-494`). **1 tree + 2 tarps on self-transport bills netting ×3 = $30; "Delivery + planting" bills planting ×3 = $675.** ⚠️ **MITIGATED, NOT SILENT, AND THAT IS THE ONLY REASON THIS IS AMBER-SHAPED RATHER THAN RED-NOW: `qtyFor` honors an owner-confirmed `serviceQuantities` override FIRST** — the register can correct it, **if the seller notices**, and nothing prompts them to. 🔴 **NOT REACHABLE TODAY AND THAT IS THE WHOLE POINT OF FILING IT: it is latent only because no non-plant good has been catalogued yet** — and A1 proves `business_inventory` will accept one with nothing added (`name` + `qty` + `sell_price` is a complete sellable row). **It goes live the day someone adds a tarp, not the day someone writes code.** Depends on a product-kind handle existing at all (none does — no `type`/`category`/`kind` column anywhere on the table). Recon: same doc, §A3. |
| 104 | 🟡 **PARTIALLY RESOLVED 2026-08-24 (ledger #215) — THE INVOICE HALF IS CLOSED; THE RECEIPT HALF IS OPEN AND SCOPED OUT ON PURPOSE.** ✅ **`cultivar.ts` no longer interpolates `override_reason` into the QB line description** — the adjusted line reads `<Service> — price adjusted`, the concession stays fully visible as a NAMED, SIGNED amount (the negative-adjustment shape untouched), and **the reason is NOT lost: it stays on the row, on the internal order screen, and in the `[TRACE:QBO]` emit** (R-7 attribution is internal by design). **Proven by PAYLOAD, not by a status code:** `qboInvoiceLines.test.ts`, **27 probes**, fixture = invoice 436 reconstructed from the rendered document; **RED-FIRST — the old interpolation planted back into the real source fails exactly A1/A2/A3, and the file was restored `diff`-identical.** 🟡 **STILL OPEN — THE REGISTER RECEIPT: `OrderTotals.tsx:97` renders the same string on the Confirmation screen, through a component SHARED with the internal order-detail screen. One component, two audiences, and it does not know which it is rendering for** — David scoped it out of this pass; **owner-test CARD 3 records it as `needs-test` WITH ITS REASON so it is not refiled as a bug by the person testing.** ⚠️ **Nothing un-sends invoice 436.** ORIGINAL ENTRY BELOW. 🔴 **CUSTOMER-FACING · ALREADY SENT — AN UNVALIDATED FREE-TEXT OVERRIDE REASON IS PRINTED ON THE CUSTOMER'S INVOICE AND ON THE REGISTER RECEIPT.** ✅ **EVIDENCE, MEASURED: QB invoice `txnId=436`, Cultivar order `2661dbe4-e26d-486f-b65f-50e0f56716c3`, dated 07/16/2026, QB status "Opened" — SENT AND VIEWED.** The line reads *"Placement Service — price adjusted (reason: must be filled if discount applied cannot be EMPTY)"*. Composed at **`cultivar.ts:500-503`**, the reason entering at **`:481`** (`(sel.override_reason ?? '').trim()`). 🔴 **IT REACHES A SECOND CUSTOMER SURFACE THROUGH A SHARED COMPONENT: `OrderTotals.tsx:97` renders the same string on the Confirmation receipt (`Confirmation.tsx:94-101,237`) AND on the internal order screen (`OrderDetail.tsx:278,382`) — ONE component, TWO audiences, and it has no idea which it is rendering for**, which is what makes any internal/customer split cost more than one line. ⚠️ **AND THE PREMISE CORRECTION THAT IS THE REAL FINDING: that sentence is NOT a string this repo emits** — grep for `"cannot be empty"` / `"must be filled"` / `"if discount applied"` across `packages/` and `api/` returns **ZERO**; our message is *"A reason is required to change this price — it goes on the invoice and the record"* (`CartReview.tsx:850`). **A human hit the required-reason gate and typed a description of the rule into the box, and because CONTENT is never checked (#105), the note about the requirement satisfied the requirement and QuickBooks emailed it to the customer.** **FOUR OPTIONS COSTED, DELIBERATELY NOT COLLAPSED — DAVID DECIDES** (A stop sending it, 1 line · B split internal/customer, ~4 files + 1 migration + a shared signature · C a discount TYPE — **NOT reachable today, see #107** · D make the input say the customer reads it, ~2 lines — **and it already half-says so, but only inside the error state `:848`**). ⚠️ **NO OPTION MAY BREAK THE NEGATIVE-ADJUSTMENT SHAPE** — it preserves both the original price and the concession, it is what R-7 wants, and it is the scar of QBO error 6070 (`cultivar.ts:481-486`). Recon: `docs/decisions/2026-08-24-quickbooks-invoice-push-recon.md` §Q1. |
| 105 | 🔴 **THE OVERRIDE REASON IS REQUIRED AT THREE INDEPENDENT GATES AND ITS CONTENT IS CHECKED AT NONE — AND TWO PATHS LOSE THE ATTRIBUTION ALTOGETHER, WHICH IS THE ONE THING R-7 CANNOT SURVIVE.** **Presence-only validation:** `CartReview.tsx:768-771` (`if (!reason) setReasonErr`), `tierPricing.ts:404-406` (`overrideApplies = … && reason !== ''` — reasonless ⇒ refused, baseline charged, money-safe), `submit.ts:575-578` (the insert). **`trim() !== ''` is the entire test at every layer** — hence #104's invoice. 🔴 **LOSS PATH 1 — THE DEPLOY-WINDOW STRIP: `submit.ts:851-857` drops all five `OVERRIDE_KEYS` (`:840`) on a `42703`/`PGRST204` and retries. The concession STILL LANDS because it is already baked into `subtotal` (`:833`) — the flag, original price, leakage, actor and reason are all gone.** R-7's cost-benefit rests on *"a lost-money report surfaces a discount of $XX, Lauren investigates"*; **this path charges the give-away and leaves nothing for any report to find.** 🔴 **LOSS PATH 2 — THE EDIT PATH: `submit.ts:1249` updates `quantity` and `subtotal` ONLY and never touches the five override columns, so `original_price`/`price_leakage`/`override_reason` go on describing a price that no longer exists** — while the D-43 GOODS breakdown immediately beside it IS refreshed (`:1230-1242`, STD-016). **The service half of the same edit did not get the same treatment.** ⚠️ **A NULL `override_reason` on a NON-overridden line is CORRECT and expected** (`overrideCols` writes `{is_manual_override:false}` with no reason key) — **not every null is a defeated validation, and which case any given live row is cannot be asserted from this machine** (no catalog access, 2026-08-22 ruling). Recon: same doc §Q4. |
| 106 | 🟢 **RESOLVED 2026-08-30 (ledger #237) — THE TWELVE LITERALS ARE GONE, AND THE FIX WAS NOT THE ONE THIS ENTRY EXPECTED.** This entry said *"hand back the id and the exact name, then it is a one-seam change"* — **it was never one id, and a single id would have been the same defect at a different address.** The read settled it: item `1` EXISTS, is named **"Sales"** (not "Services" — this entry's own premise, from invoice 436, was wrong), and books to the generic income account, so the push would have **SUCCEEDED and silently misfiled** rather than failed. ✅ **WHAT SHIPPED INSTEAD IS ONE RULE:** a $0 line is a `DescriptionOnly` NOTE carrying no ItemRef; a line carrying money is REVENUE and must resolve an Intuit **Id** off its backing row **or the push REFUSES** (422 `QBO_ITEM_UNMAPPED`) — there is no fallback branch (`shared/quickbooks/invoiceLineShapes.ts`). Two of the twelve were the wrong SHAPE, not the wrong id: the discount is now native `DiscountLineDetail` and SALES TAX left the line list for `TxnTaxDetail`, because booking tax as revenue INFLATED the business's income by the tax amount. ⚠️ **THE MULTI-TENANT HAZARD THIS ENTRY FOUND IS ALSO CLOSED, AND BY CONSTRUCTION**: a per-tenant fact can no longer sit in shared code, because the id now comes from a tenant's own row or does not come at all. 🔴 **RESIDUAL, AND IT IS A DEPENDENCY NOT A DEFECT: no table carries `qbo_item_id` yet**, so every revenue line refuses TODAY. That is pass ② — spec at `docs/decisions/2026-08-30-qbo-item-mapping-spec.md`; it is three tables, not one, and it stores the **Id**, never the Sku. Probes D1/D1b, which pinned this defect and said they must fail the day it was fixed, were **inverted deliberately**. ORIGINAL ENTRY BELOW. 🔴 **UNCHANGED — FIX 2 STOPPED AT ITS GATE 2026-08-24 (ledger #215), AND THE GATE IS THE FINDING: `'1'` IS THE ONLY QUICKBOOKS ITEM ID THIS PLATFORM HOLDS ANYWHERE.** Measured, not assumed: **(a)** truly hardcoded — twelve inline literals, **no config, no env var, no column, no constant, no lookup** (`docs/inventory-env.md` has no item var; the only `qb_*` identifiers we persist are `qb_customer_id`, `qb_invoice_id`, `qb_invoice_number`, `qb_invoice_url`, `qb_realm_id` plus token flags); **(b)** the generic GET transport exists (`qbGet`, `cultivar.ts:29`) but **the ONLY query builder is `qbQueryCustomers` (`:68-76`), hardcoded to `select * from Customer` — nothing anywhere queries `Item`, and there is no cached list**; **(c)** no product/inventory item id is stored in code, config or database. **So the build STOPPED rather than invent one: a push that fails is worse than a push that mis-categorizes, and David demos in under 40 hours.** ⚠️ **A SECOND HAZARD FOUND AT THE GATE AND WORTH MORE THAN THE FIX: `'1'` IS A PER-TENANT FACT HARDCODED INTO SHARED PLATFORM CODE.** It resolves in LAWNS' company file (invoice 436 proves item 1 exists there and is named "Services"); **a second tenant's QuickBooks has no obligation to have an item 1, or to have it mean anything similar** — so this is a multi-tenant landmine, not only a mis-categorisation. **WHAT UNBLOCKS IT (David, a READ in QuickBooks, not a build): Sales → Products and services → find/create a PRODUCT item for nursery stock → read its id from the URL → hand back the id and the exact name.** Then it is a one-seam change — **the payload already separates goods from services** (asserted by `qboInvoiceLines.test.ts` D2/D2b/D2c), so only the id is missing. **Pinned by test probe D1/D1b as KNOWN DEBT, deliberately labelled as such** — the day it is fixed the probe FAILS and must be updated on purpose, so the defect can be neither quietly resolved nor quietly re-introduced. ORIGINAL ENTRY BELOW. 🔴 **EVERY QUICKBOOKS LINE BOOKS TO ONE HARDCODED ITEM — SO A NURSERY'S BOOKS SHOW 100% SERVICE REVENUE, ZERO PRODUCT SALES, AND NO COGS AGAINST INVENTORY.** `ItemRef: { value: '1', name: 'Services' }` appears **TWELVE times in `cultivar.ts` and all twelve are that identical inline literal** (`:318, 442, 488, 496, 515, 527, 544, 554, 575, 583, 600, 613`). **It is (i) a single hardcoded item — NOT (ii) a mapping that collapses to one value (there is no mapping, no lookup, no config, no column) and NOT (iii) un-set QB-side configuration: we hardcode the reference ourselves.** 🔴 **AND THE DISTINCTION SURVIVES ALL THE WAY TO THE PUSH — IT IS KNOWN AND DISCARDED, NOT LOST.** The two tables are read separately (`:381-384` `order_items` · `:386-389` `order_service_selections`) and looped in separate blocks (`:424` goods · `:455` services), and the service branch even reads `offering.category` (`:459-460`). **At the moment the ItemRef is written the code knows with certainty whether it holds a plant or a service, and writes `'Services'` either way.** **CONSEQUENCE, STATED PLAINLY: every tree and container lands on one service item; the goods lines never touch an inventory-tracked QB item, so COGS has nothing to post against and product gross margin cannot be computed inside QuickBooks at all — a P&L built from this says LAWNS is a service company that sells no plants.** ⚠️ **A SWEEP, NOT A ONE-LINER: twelve sites in ONE file** (or one shared helper the twelve call — the §6 r8 shape). ⚠️ **The dead donor `packages/shared/src/quickbooks/invoice.ts:90` hardcodes `value: '1'` too — the same defect, dormant, zero callers.** Recon: same doc §Q2/§Q5. |
| 107 | ⚠️ **THE DISCOUNT *TYPE* CANNOT REACH THE INVOICE — THE TIER'S NAME IS NEVER PERSISTED ON THE ORDER, SO THE PUSH HAS A PERCENTAGE AND NOTHING ELSE.** This is #104 option C's blocker and it is missing in **TWO independent ways.** **(1) The vocabulary exists but is scoped to CUSTOMER TIERS, not to a per-line service override:** `DiscountType { name, tiers }` / `DiscountTier { name, basis, discountPercent, accessTerms }` (`packages/shared/src/business-logic/tierPricing.ts:120-132`), configured on the Discounts page — **and R-6 itself records that the VALUES are not there either** (*"'military' is not a configured type today"*; R-6 is **OPEN, ruled, nothing built**). **(2) `orderBase` (`submit.ts:685-698`) writes no tier column and `order_items` stores only `discount_pct`/`discount_amt`** (`20260713_order_items_line_breakdown.sql:63-65`) — **which is exactly why the tier line can only print `Discount (10% off)` (`cultivar.ts:451`) while an override prints free text: the two concession types are pushed on completely different terms.** ✅ **THE PRESENTER HALF IS ALREADY BUILT AND ALREADY IMPORTED BY THIS FILE, so a fix follows a pattern rather than inventing one (CORE MANDATE r1):** `packages/shared/src/business-logic/taxExemption.ts` stores a reason CODE and renders it through `taxExemptionLabel()` (`:27-44`) with `'other'` as the free-text escape — **and `cultivar.ts:596` already calls it for the tax-exempt line.** The QB push is importing this pattern for one reason field and not the other. ✅ **What closing it buys: the R-7 control working as ruled** (*"a seller picking from that list can only give away a number she already sanctioned"*) **and a lost-money report that can GROUP** — the report R-7 says is OWED and does not exist. Recon: same doc §Q1(c). |
| 108 | 🟡 **A CHECKOUT-CREATED DELIVERY HAS NO NATURAL KEY, SO THE SAME LOAD CAN BECOME TWO STOPS — AND AN EDITED ORDER'S STOP GOES STALE.** Shipped knowingly with ledger #216, on David's explicit instruction (*"KNOWN AND ACCEPTED, DO NOT SOLVE… Do NOT add a column to prevent it"*). `deliveries` has **no `order_id` column** and this build added none (zero migrations), so nothing anywhere ties a stop to the order that produced it except `deliveries.notes`, which carries the invoice number as a **human breadcrumb, not a key**. 🔴 **THREE CONSEQUENCES, and they are different sizes.** **(a) DUPLICATE:** re-submitting a cart mints a second stop for one truck-load; nothing dedups, nothing can. **(b) STALE — the quieter one:** `handleUpdate` changes `orders.delivery_date` and **cannot reach the delivery row**, so a customer moved from Thursday to the following Tuesday keeps a stop on Thursday and Lauren plans a truck around it. **(c) ORPHAN:** `handleDelete` releases the inventory and leaves the stop standing. ✅ **NOT a money defect and not silent at the source** — `[TRACE:DELIVERY] checkout delivery SCHEDULED` names every row it writes, and owner-test CARD 5 counts stops before and after precisely so a `+2` is recorded rather than refiled. | 2026-08-25 (ledger #216, by decision) | **`deliveries.order_id uuid REFERENCES orders(id) ON DELETE SET NULL`, plus a partial unique index on it** — the FK makes the link real and the index makes the duplicate UNREACHABLE rather than merely unlikely. Then `handleUpdate` re-dates the stop and `handleDelete` cancels it, both through the ONE writer. **Sibling in shape to #54 and #58** — a code-level guard whose durable form is a partial unique index, named-not-taken on the same reasoning. ⚠️ **It is a MIGRATION, which is exactly why it was excluded**; and it should land WITH the write-path merge below, as one build. | Before a real delivery week runs on checkout-sourced stops — i.e. the first time Lauren plans a route from orders rather than from photographed invoices. Sooner if a duplicate is observed live (owner-test CARD 5 is what would surface it). ✏️ **MEASURED 2026-09-11 (ledger #299): the order's date and the stop's date already disagree on 10 of 36 linked pairs, all LAWNS** (3 `ocr-invoice` planting stops +1 to +21 days; 7 `qbo-shipdate` stops −7 to +9). An order edit writes only `orders.delivery_date` (`submit.ts:1492-1496`); moving a stop writes only `deliveries.delivery_date` (`DeliverySchedule.tsx:~368`). Against the 2026-09-10 capture the QuickBooks `ShipDate` matches the stop on 18 of 19 and the order on 13 of 19, so the order is the stale copy. ⚠️ This row's *"`deliveries` has no `order_id` column"* is no longer true: 39 stops carry one. |
| 109 | 🟡 **`deliveries` NOW HAS A THIRD WRITE PATH, AND THE COLUMN MAPPING IS A NEAR-TWIN OF THE OCR DOOR'S — THE FORK §6 r8 EXISTS TO PREVENT.** `api/orders/submit.ts::scheduleCheckoutDelivery` and `api/customers/create.ts:103-114` build **the same eleven-column row** by two separate pieces of code. Unlike the DECLARED multi-path tables (`businesses`, `business_modules`, `business_accounting_secrets`), whose declarations rest on **zero column overlap**, here the overlap is **total** — which is why this is BASELINED (*"known today"*) and deliberately **NOT** declared in `ALLOWED_DIVERGENCE` (*"correct forever"*). `write-paths-baseline.json` `deliveries` went **2 → 3** in one explicit line, and the table still prints **GOAL:FAIL** so the debt stays visible. 🔴 **THE COST IS DRIFT, AND IT IS THE ORDINARY KIND:** the next change to what a stop carries — a new column, a normalisation, a default — lands in one door and not the other, and the two surfaces disagree with nobody being told. The OCR door already carries a `service_type` strip-and-retry that the checkout door deliberately does not; that divergence is reasoned at both sites, and it is also the first instance of exactly this drift. | 2026-08-25 (ledger #216) | **ONE shared writer both doors call** — e.g. `packages/shared/src/business-logic/scheduleDelivery.ts` owning the column mapping, the D-41 canonical/legacy address read, and the R-12 count check; `customers/create.ts` and `submit.ts` each pass their own arguments and nothing else. `deliveries` then returns to **TWO** app write paths (the shared writer + `DeliverySchedule.tsx`'s date edit, which is an UPDATE of a different concern) and the baseline SHRINKS rather than growing. | **David lifting the scope bar.** This build was explicitly instructed *"Do NOT touch the OCR capture path"*, so the refactor could not be taken in the pass that created the second copy. Flagged rather than taken silently (§6 r10). Best landed WITH #108's migration as one build — the shared writer is where `order_id` wants to live. |
| 110 | 🟡 **`customers.lifetime_value` IS A COLUMN NOTHING WRITES — 0.00 ON ALL 17 ROWS WHILE THE PROFILE PAGE CORRECTLY SHOWS $699.40. NOT A DEFECT IN THE VALUE SHOWN; A VESTIGE IN THE TABLE.** Surfaced by B4's recon (ledger #217), **reported not fixed on David's explicit instruction.** The screen is RIGHT and it is right BY DESIGN: `CustomerDetail.tsx:10` records the ruling in its own file header — *"Computed LIVE from this customer's own orders (no stored lifetime_value — David's call; one light indexed query over their rows)"* — and `:128-130` sums `orders.total_amount` across non-cancelled orders at render. **So there is no writer because a writer was deliberately not built.** The residual is that the COLUMN still exists and still reads `0.00`, and `types/customer.ts:15` types it as a non-optional `number`, so any future consumer that trusts the table gets a confident zero. **This is the D-9 class pointed at our own schema: a stored 0 that is not a measurement.** ⚠️ **Distinct from #111 and from the email defect (#217) — see that ledger row's (b): three surfaces, three causes, one shared PROPERTY (the column is not the authority), and only one was a bug.** | 2026-08-25 (observed; the ruling itself is older) | EITHER drop the column (a MIGRATION — excluded from #217's scope) OR give it a writer and make the page read it. **Do not do both.** Until then the honest form is to type it optional/nullable so a consumer must decide. | Next migration pass on `customers`; or the first consumer that wants lifetime value WITHOUT loading the order list (a roster column, a segment filter, an export). |
| 111 | 🟡 **`order_service_selections.original_price` HOLDS A LINE TOTAL WHILE `unit_price_at_time` BESIDE IT HOLDS A PER-UNIT PRICE — THE VALUE IS CORRECT, THE NAME IS NOT.** Surfaced by B4's recon (ledger #217), **reported not fixed on David's explicit instruction.** 🔴 **The writer and the reader AGREE, which is why this is a naming hazard and not a data defect:** `submit.ts:724` stores `res.original`, which is `applyOverride(id, lineSubtotal(offering, qty))` — and `lineSubtotal` is `Number(o.price) * quantity` (`netting.ts:42-44`), i.e. **price × qty**. `OrderDetail.tsx:272-276` reads it as a line baseline and says so at the line: *"original_price is the baseline captured at charge; fall back to unit_price × qty (they agree)."* **The fallback is the proof — the two are interchangeable, so the stored value is unambiguously a LINE TOTAL.** The hazard is the next reader: a column named `original_price` sitting next to `unit_price_at_time` invites a per-unit reading, and multiplying it by quantity would silently square the quantity on any line with qty > 1. | 2026-08-25 (observed; the column is older) | RENAME to `original_line_subtotal` (or `original_subtotal`) so the unit of measure is in the name — a MIGRATION plus the two consumers, excluded from #217's zero-migration scope. Cheaper interim: a comment at both sites naming the unit. | The next migration touching `order_service_selections`; or before any NEW consumer reads the column (a report, an export, a QB line, a margin calc) — that is the moment the wrong reading becomes a wrong number. |
| 112 | 🟡 **`customers.email` AND `people.email` CAN NOW DISAGREE — A DIVERGENCE INTRODUCED BY #217 AND FILED RATHER THAN HIDDEN.** Before #217 a checkout could not change a stored customer email at all, so the two could not drift on this path. Now an email edited at the register **replaces `customers.email`** — and if the person spine matched that human **BY PHONE** rather than by email, `people.email` keeps the OLD value. **`personUpsert.ts:87-99` only ever READS by email (`.eq('email', email)` among auth-less people); it has no backfill branch** — a person resolved by phone is returned as-is, unamended. **Consequence, and it is the one that bites: the spine is the DEDUP KEY.** The next checkout typing the NEW email finds no auth-less person with it, falls through to the phone match, and still resolves correctly — **so this is latent while a phone is present, and becomes a duplicate-person risk for a phone-less customer whose email changed.** ⚠️ **NOT FIXED BY DECISION, NOT BY OVERSIGHT: #217's prompt scoped the OCR path and ALL matching/dedup logic OUT, and the spine is exactly that.** | 2026-08-25 (introduced by ledger #217) | ONE resolution act that owns both rows: `findOrCreatePerson` gains a fill/replace branch for the contact fields on the person it resolved, with the SAME supplied-wins-vs-fill rule the customer writer now states — so the two cannot express different rules for one fact (§6 r8). Needs its own decision on whether the PERSON's email is supplied-wins (the customer's now is) or fill-only. | The next build that is allowed to touch the person spine; or the first observed duplicate person / a customer whose email edit does not survive the next checkout. |
| 113 | 🟢 **RESOLVED 2026-08-25 (ledger #218) — the list is now DERIVED: `CUSTOMER_SEARCH_FIELDS` + `customerSearchHaystack()` in `customerFieldRegistry.ts`, read by `Customers.tsx` via `searchText={customerSearchHaystack}`.** `organization_name` and `display_name` are searchable; all eight original fields kept (over-searching was never the defect). ⚠️ **The fork is HALF closed and says so: `CustomerSearch.tsx` was NOT repointed (scoped out) — and it structurally cannot share the IMPLEMENTATION anyway (a server-side PostgREST `.or()` string vs a client-side haystack); only the FIELD SET can be shared, and that is what moved.** ⚠️ **`billing_*` deliberately NOT added** — the roster renders no address and the D-41 mirror makes legacy `city` equivalent today, but not on a diverged row (see #115). Proven by `customerSearchFields.test.ts` (31 probes; red-first ×6). **ORIGINAL ENTRY:** 🔴 **THE CUSTOMER ROSTER SEARCHES A NARROWER FIELD SET THAN IT DISPLAYS — SO A ROW CAN RENDER ITS OWN NAME AND BE UNREACHABLE BY TYPING IT.** `Customers.tsx:263` builds `searchText` from `[first_name, last_name, phone, email, address_line1, city, state, zip]`. The Name column renders `displayName()` (`:204-207`), which for `customer_type === 'organization'` returns **`organization_name`** — a column `searchText` never reads, as is **`display_name`**. So a customer whose identity lives in either field is visible in the list and invisible to the search box directly above it. ✅ **Corroborated from a second direction: the CHECKOUT search does it correctly** — `CustomerSearch.tsx:96-97` includes `organization_name.ilike` and `display_name.ilike`. Two searches over one table, two field sets — §6 r8's drift. ⚠️ **Second omission, same line, same shape:** `searchText` also omits `billing_line1/city/state/zip` while the placeholder promises *"Search name, phone, email, city…"* (`:264`), so a customer whose address lives only in the canonical columns the party editor writes cannot be found by city. ✅ **NOT a silent-shrink (that is #111):** `DataSheet.tsx:296` renders `"{view.length} of {rows.length} shown"`, so the roster states both numbers honestly. **The row is not hidden — it is not matched.** | 2026-08-25 (recon, LOOK ONLY) | `searchText` DERIVED from the same registry the display and the checkout search read (`customerFieldRegistry.ts`), so a field added to the record joins the search with no second edit — the #179 property. A hand-maintained list beside a derived one is the enumeration E6 was written to end, and this is the sixth list that file set out to kill. | **The next customer whose name lives in `organization_name`** — i.e. every organization customer, which is the whole point of the party record. ⚠️ **NOT fixed in this recon: which field David's second Diane Foster uses is a DATA fact and this machine has no catalog access** (2026-08-22 ruling); the settling query is in the recon doc. |
| 114 | 🔴 **ELEVEN OF TWELVE NARROWING LIST READS HIDE ROWS WITHOUT SAYING THEY HID THEM — AND THE PLATFORM ALREADY OWNS THE ONE-LINE CONTROL THAT FIXES IT.** Swept `packages/cultivar-os/src` + `packages/shared/src`: `DeliverySchedule.tsx:126` · `DeliveryRoute.tsx:398` (+`limit(50)`) · `DeliveryRoute.tsx:437` (+`limit(30)`) · **`DeliveryRoute.tsx:436` `.eq('transport_method','delivery')` — every `install` order is absent from the route list although `submit.ts:221` maps `install → 'planting'`, i.e. the truck goes out for it** · `Orders.tsx:60` `.limit(50)` · `Dashboard.tsx:188` (feeds TODAY'S REVENUE) · `Dashboard.tsx:250` · `InventoryReconcile.tsx:125` · `PMI.tsx:182` · `ScanOrder.tsx:187` `.limit(10)` · `CustomerSearch.tsx:108` `.limit(25)`. 🔴 **The headline instance: `/delivery-schedule` renders `"13 scheduled deliveries"` — a claim about the BUSINESS, not about the filter — over a table holding 16, and a day header reads `"1 stop"` on a day holding three rows.** This is the six-state ruling's *withheld data ANNOUNCES its redaction* and §6 r18's *a section header is a claim*, on screens neither was applied to. ✅ **The pattern exists and is free: `DataSheet.tsx:296` renders `"{view.length} of {rows.length} shown"` in ONE line, and every consumer inherits it. Every silent row above is a hand-rolled list that is not a DataSheet.** ⚠️ **A shape this repo cannot settle: `orders` and `social_drafts` have NO `CREATE TABLE` in version control (#39 / #27), so whether `.neq` on those tables ALSO drops NULL-status rows — `NULL <> 'x'` is NULL, not TRUE — is unanswerable from the repo.** `deliveries.status` IS sourced: `20260620_deliveries.sql:34` `NOT NULL DEFAULT 'scheduled'`. 🔴 **And nothing in the app ever writes `deliveries.status` after insert** (both inserts set `'scheduled'`; the only UPDATE, `DeliverySchedule.tsx:151`, writes `delivery_date` alone) — so the filter excludes on a value the product cannot produce. | 2026-08-25 (recon, LOOK ONLY) | A narrowing read STATES what it narrowed — the `DataSheet` count-pill contract, applied to the hand-rolled lists, or those lists moved onto `DataSheet`. A cap is buildable and is **named, not taken**: a `.limit(`/`.neq(`/`.not(` on a displayed list with no rendered count is mechanically detectable. | **Any of them.** Prioritised by damage: `DeliveryRoute.tsx:436` (an install job never reaches the route list) and `Dashboard.tsx:188` (today's revenue) are the two where being wrong costs money rather than confusion. ⚠️ **Deciding what a duplicate customer IS, and whether collapsing is wanted at all, is David's ruling — untouched here.** |
| 115 | 🟢 **RESOLVED 2026-08-25 (ledger #220, R-19's first instance).** The two-rule address is gone: `ScanOrder`'s hand-written `customerToInput` was replaced by the shared `customerOrderInput`, which applies **billing-first-with-legacy-fallback to ALL FOUR fields** — the same rule `submit.ts:264-274` uses to write the delivery stop and `qbo/invoice/cultivar.ts:101-106` uses to push the invoice. `CustomerCapture` fills from the same function, so the FORM, the INVOICE and the TRUCK now read one address. Proven by `customerFieldCoverage.test.ts` F1/F9/F11 (billing-first on all four; a blank canonical falls through to legacy) and **H1, which reads `submit.ts` as SOURCE** so the claim "the same rule" fails the build if submit ever changes. Red-first: RED 6 (legacy-first) fails F1/F11; RED 13 (submit flipped) fails H1. ⚠️ **What this does NOT close: rows whose two column sets have genuinely DIVERGED still hold two different addresses in the database.** Reading them consistently is fixed; RECONCILING them is a data question and is not a code fix. **ORIGINAL ENTRY:** 🔴 **ONE ADDRESS COMPOSED FROM TWO ADDRESSES: `ScanOrder.tsx:93` TAKES THE STREET FROM `billing_line1` WHILE `:94-96` TAKE CITY, STATE AND ZIP FROM THE LEGACY COLUMNS.** Not a fallback that mixed — an unconditional split across four sibling fields. Checkout Review renders it verbatim (`CartReview.tsx:577-580`, which makes no field choice of its own), producing an address present in NEITHER column set: measured live as **`100 Main St, Georgetown TX 78628`** on Diane Foster `0ee368fe`. 🔴 **The data was already in hand and three fields ignored it:** `CustomerHit` declares all four canonical columns (`:62`), the select fetches all four (`:191`), and the comment immediately above that select states the rule for all four (`:190` — *"D-41: canonical billing_* first, legacy as fallback"*). 🔴 **THE CONSEQUENCE IS A DIVERGENCE, NOT A COMPOSITE, AND IT IS THE WORSE OF THE TWO: `submit.ts:271-274` writes the `deliveries` row from a FRESH SERVICE-KEY READ of the customer (`:442-443`) with `pick(billing, legacy)` on ALL FOUR fields — so the stop is written `100 Main St, Leander TX 78641` while the cashier confirmed `Georgetown 78628`.** Two towns ~15 miles apart, from one click, and neither screen mentions the other. A composite is visibly wrong to anyone who knows the customer; **a divergence is invisible to everyone**, because each screen is internally plausible and nobody sees both. ⚠️ **`submit.ts`'s `pick()` is PER-FIELD, so the delivery row can still be a composite** when the canonical columns are only partly populated. ✅ **No data-corruption path: the attach branch (`submit.ts:409-416`) resolves the id and does not upsert, and `customerUpsert`'s rule (b) FILL-NEVER-CLOBBER lands a supplied value only where the stored one is blank.** 🔴 **AND THE FINDING THAT CAME OUT OF THE SWEEP RATHER THAN THE QUESTION: every app writer keeps the two column sets IN SYNC** (`customerEdit.ts:163,170-172` · `customerUpsert.ts` HEAD `:120-135`, rule (c) CANONICAL + MIRROR), **so Diane's divergent row could not have been produced by any door in this product** — it came from a direct database edit or from pre-mirror data. **This is a latent defect that fires only on rows the application cannot create: invisible in UI-created data, live on migrated/seeded/SQL-edited data.** ⚠️ **Sibling on the same axis: `CustomerDetail.tsx:148` reads legacy `city` with NO canonical fallback — the only such site — so the profile HEADER and the profile's own EDIT FORM (`CustomerPartyEditor.tsx:250-267`, `billing_*` only) show different cities for one customer, one click apart.** | 2026-08-25 (recon, LOOK ONLY) | 🔴 **Not a per-site patch: ONE shared address reader** (canonical-first, legacy-fallback, all four fields, absent stays NULL) that all eight composition sites call — the same consolidation #109 wants for the delivery WRITER. Today the rule lives only in repeated comments (`ScanOrder.tsx:190`, `DeliveryRoute.tsx:33-38`, `submit.ts:258-261`) and as a claim in a recon (`2026-08-24…:335`) that is **true of six sites and false of two** — and no cap reads a comment. | **Before any tenant with pre-mirror or migrated customer rows**, and before the checkout Review is trusted as a read-back to a customer. ⚠️ **Do NOT change how `billing_*` and `address_*` relate — that split is correct and deliberate (D-41); this is about READ order at eight sites, not about the schema.** ✅ **B4: the ship-to MODEL is declared** — `2026-07-13-customer-party-record.md:35-41` (*"a customer does not 'have a shipping address'; an ORDER does… snapshotted onto the `deliveries` row"*); the OCR door implements it, checkout substitutes billing because there is no ship-to field, and `user_stories.md:228` already carries that as an owed question. |
| 116 | 🟢 **RESOLVED 2026-08-25 (ledger #220).** `ScanOrder`'s attach sheet now MOUNTS `<CustomerSearch>` — the same component `/checkout/customer` mounts — so the two-field search, its 14-column select literal, its own row type and its own sanitiser are all deleted rather than repointed. **The field set went 2 → 10 and the consolidation is 3 of 3.** ⚠️ **The prediction in this row's own last sentence came true and is worth recording: `customerPickerSearch.test.ts` F2/F3 asserted the OLD state and went RED the moment the door was repointed, forcing this row and the registry note to be corrected in the same pass.** That is the self-clearing property doing its job — a note nothing reads is a note that rots; this one failed the build instead. Red-first: RED 8 (re-inlined `.ilike`) fails D8/D15/F2; RED 8b (unmounted) fails D7/F3. **ORIGINAL ENTRY:** 🔴 **A THIRD CUSTOMER SEARCH EXISTS AND IT IS THE NARROWEST OF THE THREE — `ScanOrder.tsx:185` MATCHES ON `first_name` AND `last_name` ONLY.** Found by the B3 sweep during ledger #219, named rather than fixed (David scoped the fix to the checkout picker). The customer-attach strip on the scan-loop front door composes its own `.or()` from a two-field template literal (`first_name.ilike` / `last_name.ilike`) — **two fields against the registry's ten** — so an organization customer cannot be attached to an order by its own name, and neither can anyone found by phone, email or address. ⚠️ **It is a SECOND defect on the same lines, not one: the select string beside it (`ScanOrder.tsx:191`, a 14-column hand-written literal) is an A4/E6 violation the field registry exists to end** — the same file therefore owes both a `CUSTOMER_SEARCH_FIELDS` repoint and a `CUSTOMER_SEARCH_COLS` repoint, and they want one pass. ✅ **One thing it does BETTER than the picker and the reason it is worth reading before copying: its sanitiser strips `[,%()]`, i.e. it also removes PARENTHESES** — see #117. 🔴 **It is not a note that can rot: `customerPickerSearch.test.ts` F2/F3 assert the CURRENT state from source, so the day anyone repoints it those probes go RED and force this row and the registry's note to be corrected** (the self-clearing property #73 taught). Sized at well under one prompt; the reason it was not taken is scope, not difficulty. |
| 117 | 🟢 **RESOLVED 2026-08-25 (ledger #220) — AND RESOLVED IN THE SAFER DIRECTION, WHICH WAS THE WHOLE QUESTION.** Unifying the two searches meant one regex had to win, and it is the FOUR-character one: `CustomerSearch` now strips `[,%()]`. **So a pasted `(512) 555-0101` no longer breaks the `.or()` parse.** 🔴 **And stripping the parens was NOT sufficient on its own, which this row did not anticipate:** the sanitised ` 512  555-0101` still does not `ilike`-match the stored `(512) 555-0101`, because the separators differ. A phone-shaped query therefore adds ONE derived term whose separators are WILDCARDS — `phone.ilike.%512%555%0101%` — which matches every format the same number can be stored in. **That closes the cross-format gap the component's own header had been recording as a stated limitation since it was written.** Proven by `customerPickerSearch.test.ts` §G (12 probes incl. five stored formats, two negative controls, and G7 proving a NON-phone query adds no term). ⚠️ **One inherited limit is PINNED not fixed (G8a/G8b): a number typed WITH an extension shifts `phoneMatchKey`'s last-10 window and will not match** — the shared normalizer's rule, not a new one. **ORIGINAL ENTRY:** 🟡 **THE THREE CUSTOMER SEARCHES SANITISE THEIR QUERY DIFFERENTLY, AND THE CHECKOUT PICKER IS THE ONE THAT LETS PARENTHESES THROUGH.** `CustomerSearch.tsx:102` strips `[%,]`; `ScanOrder.tsx:177` strips `[,%()]`. A PostgREST `or=(…)` filter is delimited by commas AND parentheses, so a query containing `(` or `)` reaches the server inside a filter value on the checkout path — and **`(512) 555-0101` is exactly what a cashier pastes from a phone screen.** ⚠️ **SEVERITY IS DELIBERATELY 🟡 AND THE REASON IS THE FAILURE MODE, WHICH WAS CHECKED RATHER THAN ASSUMED: this fails LOUDLY, not silently.** A malformed group is a PostgREST parse error, which the component already routes to its own honest `error` state (*"Customer search is unavailable right now"*) — it does not return a wrong or narrower set. **A comma or a `%` cannot inject a term or a wildcard** — proven both directions by `customerPickerSearch.test.ts` B1–B4. 🔴 **PINNED, NOT FIXED, and the pin is the point: probe B5 asserts the CURRENT behaviour**, so widening that regex becomes a deliberate act with a red test in front of it rather than a silent behaviour change inside an unrelated build. Lands with #116 as one pass — the fix is one character class, and the file that already has it right is the file #116 repoints. |

| 118 | 🟡 **THE REGISTRY THAT CALLS ITSELF "THE ONE DECLARATIVE FIELD LIST FOR THE `customers` RECORD" DOES NOT LIST FOUR COLUMNS THE MIGRATION CORPUS ADDS.** Found by R-19's coverage check on its first run (ledger #220): `business_id`, `person_id`, `updated_at` and `tax_exempt_cert_doc_url` are added by real migrations and appear in NO registry-derived list, so `CUSTOMER_SELECT_FULL` does not read them. A FIFTH — `marketing_opt_in` — was in the same state and **was added in this build, because the checkout form HOLDS it**: selecting a customer who had opted OUT left the box CHECKED, an absent consent rendered as a granted one (A9 on the field where it costs most). ⚠️ **The other four were deliberately NOT added: each widens the FULL select that the `/customers` roster and `DeliverySchedule` read, which is a read-behaviour change on surfaces this build was not scoped to touch.** 🔴 **They are DECLARED, not merely noted — `customerFieldCoverage.test.ts` §G asserts each is still ABSENT, so the day one is added its probe goes RED and forces the declaration to be corrected (#73's self-clearing property).** ⚠️ **AND THE HONEST CEILING: this is a floor, not a total.** There is no `CREATE TABLE customers` in version control (#39) and this machine has no catalog access, so a column that exists in Postgres and in no migration is invisible to every check here — per the 2026-08-22 ruling, that claim is not made. | 2026-08-25 (ledger #220) | Add the four to the registry in a build scoped to the roster + DeliverySchedule reads, OR record a permanent reason for each. **The settling query is a catalog read of `information_schema.columns` for `customers`** — one query, and it converts a floor into a total. | The next person who trusts "one declarative field list" to be complete. |
| 119 | 🟡 **`scripts/verify-field-lists.mjs`'s `stripComments` REMOVES BLOCK COMMENTS BEFORE LINE COMMENTS, AND A LINE COMMENT CAN LEGALLY CONTAIN `/*`.** Found while hardening R-19's own check (ledger #220), in the cap's own code rather than in the app: `CustomerSearch.tsx:3` reads *"the customer step of /checkout/* opens on a SEARCH"*, and a block-comment regex run FIRST reads that `/*` as an opener and swallows everything up to the next `*/` — **in my copy of that logic it silently deleted the import statements.** 🔴 **The consequence for the cap is UNDER-REPORTING, i.e. a false GREEN: any column-list literal sitting between such a line comment and the next `*/` is invisible to it**, so its counts are a floor by an unmeasured amount. ⚠️ **NOT FIXED HERE, and the reason is the gate's own lesson: rewriting a checker inside an unrelated build is exactly the drift the gate exists to catch (#73's precedent).** The fix is a two-line reorder — strip `//` lines first, then blocks — plus a probe carrying a `/checkout/*`-shaped line. ⚠️ **A second, subtler half found the same way and worth carrying into that fix: a naive "drop lines starting with `*`" rule is NOT equivalent** — it deletes a JSDoc's CLOSING ` */` line, leaving the opener dangling and eating the code below. Measured on one file: 13 openers, 8 closers. | 2026-08-25 (ledger #220) | Reorder the two passes in `verify-field-lists.mjs` + 2 probes both directions, then re-measure the baseline — the count may legitimately RISE, and that rise is debt that was always there rather than debt this build created. | Every `verify:field-lists` run since the cap was written. |
| 125 | 🔴 **ESCALATED 2026-08-30 (ledger #236) — DEFECTS (1) AND (2) ARE NOT THEORETICAL: THEY ARE LIVE ON FOUR NAMED LAWNS ROWS RIGHT NOW.** The backfill read all 447 rows and the ranges are real inventory: **`"10/15 gallon"` × 2 — Mexican Buckeye**, which `normalizeSize` reports as **`"15 Gallon"`**; and **`"3/5 Gallon"` × 2 — Native Pecan and Cedar Elm**, which it reports as **`"5 Gallon"`**. So a 3-or-5 gallon pot is being compared as a 5-gallon pot, and a 10-or-15 as a 15, **in the live catalogue of a paying customer, today**, by the one function the count promote, the import matcher and the L5 size-picker all share. The new `unit_value`/`unit_value_max` columns hold both ends correctly for the same four rows, so **the platform now holds the right answer and the wrong one side by side** — which is uncomfortable and is exactly why this row is escalated rather than closed. ⚠️ **Still NOT fixed and still not a drive-by** (12 decider sites; see the Trigger cell), but the blast-radius probe it was waiting on has now been RUN — see #126. Original entry: 🟡 **`normalizeSize` HAS FOUR MEASURED DEFECTS ON LAWNS'S REAL CORPUS, AND TWO OF THEM DISCARD DATA SILENTLY.** Measured 2026-08-30 by running the real `packages/shared/src/utils/sizeLabel.ts` and `packages/shared/src/inventory/variantGroup.ts` against the 30 strings in David's build prompt — not reasoned about, executed. **(1) A RANGE COLLAPSES AND THE OTHER END IS GONE WITH NO TRACE:** `"10/15 gallon"` → `"15 Gallon"`. **(2) SAME CLASS, OTHER DIRECTION:** `"#3/5"` → `"3 Gallon"` — a #3-or-#5 range becomes a 3. Both are unanchored-regex accidents: the gallon matcher searches anywhere in the string, so it finds one end of the range and reports it as the whole answer. 🔴 **These two are the expensive ones, because the output is entirely plausible** — nothing anywhere says a range was seen, so a "15 Gallon" that was really "10 or 15" reads as a fact. **(3) THE SAME TRADE CONVENTION GETS TWO ANSWERS:** `"#30"` → `"30 Gallon"` but `"15#"` → `"15#"` unchanged, so `"#15"` and `"15#"` do NOT compare equal — and `sameSizeLabel` is the platform's ONE size-equality test, used by the count promote, the import matcher and the L5 size-picker. **(4) `skuSizeSuffix` READS A DIAMETER AS A CONTAINER:** `'5/8" flat Rope by the roll'` → `"8IN"`. The 5/8 is the rope's gauge; the sale unit is a roll. ⚠️ **DELIBERATELY NOT FIXED in the pass that found them (David's instruction, 2026-08-30), and the reason is the useful half: the NEW parser must not REPRODUCE them.** A laundered defect in a fresh column is worse than a known one in an old column — the old one at least has this row. `unitOfMeasure.ts` therefore keeps ranges as ranges (`unit_value` + `unit_value_max`), reads both `#N` and `N#`, and refuses the rope rather than mining its diameter; `unitOfMeasure.test.ts` carries a negative control for each of the four, so a future "simplification" that folds the new parser back into the old behaviour fails the build. | 2026-08-30 (ledger #234, units-of-measure Stage 0) | A range is a range or it is a refusal — never one end reported as the whole. `#N` and `N#` fold to one value. A SKU suffix is derived from the sale unit, never from an incidental measurement in the label. The durable form is for `normalizeSize` to delegate to `parseUnitOfMeasure` and format its result, which would leave ONE parse rule in the platform instead of three (`normalizeSize` · `skuSizeSuffix` · `parseUnitOfMeasure`). | 🔴 **BLAST RADIUS FIRST — this is NOT a safe drive-by.** `normalizeSize` has 12 decider call sites (Stage 0 recon 2026-08-30); fixing (1)/(2) makes `"10/15 gallon"` stop equalling `"15 gallon"`, and fixing (3) makes `"15#"` START equalling `"#15"` — so live rows that do not collide today WOULD begin to, which is tech-debt #56's merge hazard again. Needs a read-only probe of the live catalog before a line is changed. Do it WITH the `sizeGroupKey`/`detectSizeCollision` re-key, not before it. |
| 126 | 🔴 **SIX OF LAWNS'S 198 VARIETY FAMILIES CANNOT BE SCANNED, AND THE SURFACE BUILT TO SURFACE THAT DAMAGE IS BLIND TO ONE OF THEM.** Measured 2026-08-30 against live data by running the real `detectSizeCollision` and `findDuplicateSizeGroups` over all 447 LAWNS rows — executed, not reasoned. **`detectSizeCollision` returns false for 6 multi-row families, so the L5 size-picker never fires and a scan of those varieties falls through to typed entry:** `natchez-crape-myrtle` (9 rows) · `lacey-oak` (8) · `chinese-pistache` (6) · **`skyward-holly` (5)** · `japanese-black-pine` (2) · `mexican-buckeye` (2). **Five of the six are genuine duplicates** — two rows at the same physical size — and the amber dup-size flag DOES see those five; they are the six `dup-size` flags already on the board. 🔴 **`skyward-holly` IS THE SIXTH AND NOTHING SHOWS IT.** Its five rows read `"3 gallon"`, `"5 gallon"`, `"7 gallon"`, **`"5G"`**, `"30 gallons"` — and `"5 gallon"` and `"5G"` are the same pot. `detectSizeCollision` folds through `normalizeSize` and correctly refuses (5 rows, 4 distinct sizes); `sizeGroupKey` compares the RAW lowercased string, so `"5 gallon"` ≠ `"5g"` and **`findDuplicateSizeGroups` does not flag it.** The two size-equality rules disagree, which was recorded as a known limit in `dupSize.ts` (tech-debt #56's residual) — **this is that limit with a variety name attached.** ✏️ **THE WIDER MEASUREMENT, and it is the reason this is a class rather than one bad row: LAWNS spells 15 PHYSICAL SIZES 46 DIFFERENT WAYS.** `"3 gallon"` alone has seven spellings (`3gallon` · `3 gallon` · `3 gal` · `3 Gallon` · `3 Gallons` · `3G` · `3gal`); 30-gallon and 15-gallon have six each. Only one family has so far been bitten; the sprawl is what makes the next one arbitrary. ⚠️ **This is ALSO the Stage 0 G4 question answered with data:** *would a unit key change what collides?* **Yes — it would make `skyward-holly` visible**, because the projection knows `"5G"` and `"5 gallon"` are one size and the raw key does not. | 2026-08-30 (ledger #236, the units backfill) | The two size-equality rules become ONE: re-key `sizeGroupKey` (and with it `findSizeTwin` and the grid's dup flag) onto the unit projection — `(variant_group, unit_kind, unit_value, unit_value_max, unit_name)` — so the pre-hoc guard, the post-hoc flag and the picker all agree about what "the same size" means. That is the deferred second half of ledger #234, and it is what the unit columns were recorded FOR. | 🔴 **NOT a drive-by, and now with a number: re-keying makes rows that do not collide today START colliding** (`"5 gallon"` vs `"5G"` is one new flag on LAWNS; the 46-spelling sprawl says there will be more as the catalogue grows). That is tech-debt #56's MERGE hazard, so it needs David's call on what happens to a newly-flagged pair — merge, or surface and let a human choose. **Do it WITH #125's `normalizeSize` fix, never before it.** ⚠️ Note the user-visible half is live TODAY: six varieties at LAWNS cannot be counted by scan, and Lauren has no way to know which. |
| 127 | 🔴 **EVERY WRITE IN THE APP THAT GOES THROUGH `SyncEngine.update` IS INVISIBLE TO THE ZERO-ROW CAP, AND SILENTLY REPORTS SUCCESS ON AN RLS REFUSAL.** `syncEngine.ts:258-259` is `const { error } = await this.supabase.from(op.table).update(p.set).match(p.match); if (!error) return 'applied';` — success decided from `error` ALONE, no `.select()`, no row count. A PostgREST update RLS refuses matches **zero rows and returns no error**, so the engine answers `'applied'` to a write that did nothing. 🔴 **THIS IS NOT ONE SITE, IT IS A FUNNEL.** `verify-zero-row-writes` carries `packages/shared/src/sync/syncEngine.ts::p#?.update` as ONE baseline entry, and every caller inherits the blindness invisibly — the cap sees the wrapper, never the callers, so a page that writes ten tables through the engine shows zero mutation sites. It is the reason #238's defect survived: `InventoryCount.tsx` looked clean to every cap we own. **MEASURED, not reasoned:** #238's own RLS proof asserts the zero-rows-plus-no-error pair on `business_inventory` directly. ⚠️ **The `rpc` branch four lines above it is ALREADY CORRECT** — it reads `applied === false` + `reason` and reports a domain refusal (`syncEngine.ts:250-253`). So the shape of the fix is already in the file; `update` was simply never given the same treatment. **NOT FIXED IN #238 and the reason is scope, stated rather than implied:** `SyncEngine` is shared, the change makes previously-'successful' writes start failing, and the blast radius is every offline-capable surface — that is its own build with its own owner-prove, not a rider on a count-screen fix. | 2026-08-30 (ledger #238 — found while fixing one caller of it) | `update` returns the affected rows and treats zero as a failure, exactly as `rpc` already treats `applied:false`. Then re-baseline the cap so the wrapper stops being a single opaque entry and the callers become visible. | 🔴 **BLAST RADIUS FIRST.** Every `engine.update` caller currently believes its writes land. Turning that honest will surface real refusals across offline surfaces — which is the POINT, but it must be a deliberate pass with the owner-tests to match. Do it BEFORE the next permission narrowing, because each narrowing adds callers that will fail silently. |
| 138 | 🔴 **THE CLASS: A CHECK THAT CANNOT DISAGREE. THREE MECHANISMS IN A FORTNIGHT, FILED ONCE ([[R-33]] · CLAUDE.md §6 r19).** David's instruction on filing it, and it is the whole point of the row: *"File it as the class, not as three instances."* **The shape is that THE THING ASSERTING WAS INCAPABLE OF DISAGREEING, and its green was read as evidence.** **① A CHECK THAT COULD NOT FAIL** — `verify-universals`' `OWNER_ONLY_PENDING`, a HARDCODED gap list printing on every `npm run verify` while asserting nothing (tech-debt **#73**, 🟡 open). **② A SEAM TESTS COULD NOT REACH** — the positions starting-point chooser shipped **25 assertions and 9/9 mutants**, and not one put it on a screen, because the render guard and the JSX lived where the esbuild→node runner cannot go (ledger **#242**, tech-debt **#134**, 🟡 open). **③ A DOUBLE THAT COULD NOT REFUSE** — the delivery-ingest stub accepted ANY `onConflict` string, so it was strictly more forgiving than Postgres and **87 green assertions could not have caught the partial-index defect that failed all 19 live rows** (✅ FIXED 2026-08-31). ✅ **③ IS CLOSED AND PROVEN BOTH WAYS:** the stub now carries the index as data and refuses as Postgres does; `§K` reproduces the live failure by flipping one flag and carries a **negative control** proving the dropped predicate is the fix; `§L` reads the REAL migration corpus from disk and fails if the predicate returns — **verified to bite by putting it back**. 🟡 **① AND ② REMAIN OPEN on their own rows.** ⚠️ **DELIBERATELY NOT TAKEN: a cap for the class.** A checker that detects un-failable checks would itself be a check nobody has watched fail — the exact defect. **Per #174 the cheap next step is a COUNT** (how many test doubles model no constraint at all; how many render guards are unassertable), because an unmeasured class stays unmeasured. |
| 136 | ✅ **RESOLVED 2026-08-31 BY RULING — AND THE RULING RETIRED THE BUILD RATHER THAN SCHEDULING IT ([[R-32]]).** 🔴 **THE WRITE-BACK IS NOT OWED, AND THE REASON IS NOT OURS: THE INDUSTRY DOES NOT DO IT.** Jobber's QuickBooks integration syncs clients, products and services, timesheets, invoices, payments, refunds, tips and payouts — **ONE WAY, and the SCHEDULE is not in the list at all** (*"Jobber is the source of truth… any edits should be made in Jobber to avoid overwriting them in QuickBooks"*). So **Cultivar owns the schedule and never writes it back**, and a `ShipDate` on an old invoice is a **historical record of what the invoice said at the time, not a stale value needing repair**. ✏️ **MY REASONING WAS SOUND AND MY CONCLUSION WAS WRONG, WHICH IS THE MORE USEFUL SHAPE TO RECORD:** I treated a DIVERGENCE as a DEFECT. The invoice records what was billed; the app records what is scheduled; they answer different questions and were never required to agree. Lauren was only using `ShipDate` as a calendar because she had none. 🔴 **CONSEQUENCE: the 2026-08-31 ingest was the LAST time we read a schedule out of QuickBooks — it was a one-time seed and it is spent.** Original entry below, kept because a retired build is worth reading as history. ⟨ORIGINAL⟩ **THE WRITE-BACK IS NOW OWED BY LAUREN'S OWN MODEL, AND IT NEEDS A RULING BEFORE A LINE OF IT IS WRITTEN.** Filed 2026-08-31 with the ShipDate delivery ingest. Her ruling — *Cultivar owns the delivery date, QuickBooks owns the money* — is settled and correct, **and its necessary consequence is that their QuickBooks invoices go stale every time she moves a stop.** Ariel Thiry is already an instance on day one: app says 19 Sep, invoice 3648.622 says 2 Sep, and nothing will ever reconcile them. ⚠️ **THE FIX IS A WRITE TO THE CUSTOMER'S OWN BOOKS — D-37 territory — so it is NAMED AND NOT BUILT.** The ingest deliberately contains no re-sync and does not read `ShipDate` again after the seed. **What is owed is DAVID'S RULING, not a build:** does moving a stop in Cultivar push a `ShipDate` update to Intuit, and if so under what authority and with what refusal (R-28's shape — a push that cannot resolve its target refuses rather than guessing). Do not answer this by picking a default in code. |
| 137 | 🟡 **`deliveries` HAS NO FIELD REGISTRY, AND IT IS THE SECOND ENTITY TO NEED ONE.** Filed 2026-08-31. `verify-field-lists` now carries a DECLARED 4-column projection for `deliveries` (`id, customer_id, delivery_date, qb_invoice_id` — read solely to decide NOT to write). The declaration is honest and the projection is correct, but the declaration exists because **`customers` is still the only entity with a real registry** (`customerFieldRegistry.ts`). This is **tech-debt #120's class arriving on a second table**, which by #174's rule makes it a measured class rather than an instance. Minting a registry inside a delivery-ingest build is exactly the drift these caps exist to catch, so it was filed rather than done. |
| 128 | 🟡 **THE LEGACY `order_addons` INVOICE LINE IS DEAD BY DATA, NOT BY CODE — WHICH IS THE WEAKER GUARANTEE, AND THAT IS WHY IT WAS LEFT STANDING.** Filed 2026-08-30 (ledger #238) as the deliberate NOT-TAKEN half of the install-line removal. `buildQboInvoiceLines`'s legacy branch (`cultivar.ts`, the `for (const oa of orderAddons \|\| [])` loop) still builds a revenue line from an `order_addons` row. **Measured, both directions:** (a) **nothing in the repo WRITES `order_addons`** — the only references are the 2026-05-28/07-09 RLS migrations, ONE read in `cultivar.ts`, and one test; `20260529_businesses_f_service_offerings.sql:65` says so in as many words: *"Replaces order_addons for new orders. order_addons is kept for historical data."* (b) **the table holds ZERO rows platform-wide** (live count, all three tenants, 2026-08-30). So the guard IS enterable — the four Test Dave's orders in #129 enter the legacy branch — but the loop body iterates **zero times**. 🔴 **THE DISTINCTION FROM THE INSTALL LINE IS THE WHOLE ENTRY.** The install line was removed because it was unreachable **by construction** (a mutual exclusion in `submit.ts` that no data change can undo) AND had never fired in 1,469 invoices. This one is unreachable only **while the table stays empty** — one INSERT, from a script or a restore or a hand-written backfill, and it is live again. A code proof survives the data changing; a data proof does not. **REPAIR:** remove the loop when `order_addons` is FORMALLY RETIRED (a `DROP TABLE` migration, alongside `losses`/`nurseries` — see #39), not before. Removing the reader first would leave a table nothing reads and nothing writes, which is a worse kind of orphan than a guarded dead branch. **TRIGGER:** the `order_addons` DROP migration. **DO NOT** silently delete it in an unrelated pass — its E6 test assertion is the thing that would notice. |
| 129 | 🟡 **FOUR APP-CREATED ORDERS CARRY A PRICED `addons_amount` WITH ZERO `order_service_selections` ROWS — THE SERVICES WERE CHARGED AND THE ROWS THAT EXPLAIN THEM ARE MISSING.** Found 2026-08-30 (ledger #238) while measuring the install line's reachability; **filed, not chased — it is a different defect from the one that pass was authorised to fix.** The rows: `476873a3` · `eaf55f96` · `ede875c4` · `ba2402bf`, all on **Test Dave's Tree Nest** (`f7ec5d67`, confirmed from live `businesses`), all `order_kind = NULL`, `status = pending`, created **2026-07-13** within ~3 minutes of each other (three are near-identical — a repeated checkout test). Each has real `order_items`, a real `CLV-` invoice number, `subtotal` 2147.40/2940.20, and **`addons_amount` 1125 / 1925** — so services WERE priced into the total — yet **not one `order_service_selections` row.** 🔴 **THE CODE SAYS THIS SHOULD BE IMPOSSIBLE.** `transport_note` reads `"Staff transport"`, and `buildTransportNote` only returns that when `transportMode !== 'self'`, which per `submit.ts:636` means **`selectedTransport` was non-null** — and a non-null `selectedTransport` unconditionally pushes a selection row at `submit.ts:937`, whose insert **throws** on error (`:1005`). So either the rows were written and later removed by something that is not `handleDelete` (which deletes the order too), or a code path that no longer exists produced them. **WHY IT MATTERS BEYOND FOUR TEST ROWS:** `addons_amount` and the selection rows are two representations of one fact (STD-011), and this is them disagreeing on a *live-written* order — the customer-facing total says one thing and the itemisation says nothing at all. An invoice built from these four omits ~$1,125 of charged service while still billing the total. **REPAIR:** determine the mechanism BEFORE writing a guard — an invariant check that cannot name its own defect is a guess. Read `audit_log`/`order_events` for those four order ids first. **NOT** to be fixed by deleting the rows (David, 2026-08-30: *deleting data to make code unreachable is the wrong order of operations*). |
| 130 | 🟡 **REPLACING A POSITION'S TICKS IS TWO STATEMENTS AND THE SEQUENCE IS NOT ATOMIC — A PARTIAL LAND EMPTIES A POSITION INSTEAD OF CHANGING IT.** Filed 2026-08-31 (ledger #240) as the deliberate NOT-TAKEN half of the position build. `setPositionResponsibilities` (`packages/shared/src/positions/positionStore.ts`) does DELETE-then-INSERT against `business_position_responsibilities`: **each statement is atomic, the sequence is not.** If the delete lands and the insert is refused, the position is left with nothing ticked and the owner is told the earlier step is already permanent. 🔴 **THIS IS #69's CLASS EXACTLY** — a multi-step accept where an intermediate state is durable — and it is mitigated the same way rather than fixed: the delete is scoped to ONE position, the refusal names the step it stopped at **and says the previous selections were cleared so a re-save restores them**, and the whole operation is IDEMPOTENT, so re-running with the same picks converges. ✅ **What the pass DID fix, because the cap caught it and it was a real defect rather than a cap complaint:** the first version destructured only `{ error }` from the delete, and `verify-zero-row-writes` classified it **UNCHECKABLE**. A DELETE refused by RLS matches zero rows and returns **no error** — and zero rows is ALSO the legitimate answer for a position with nothing ticked, so the two are indistinguishable from inside the function. **A staff member unticking everything would have been told "Saved." while the rows sat untouched** — #238's silent degradation arriving through a different door. The caller now passes `expectedExisting` (the count it loaded) and the delete asserts exactly that number, which also detects a concurrent edit. **REPAIR:** ONE `SECURITY DEFINER` RPC taking the whole pick set as `jsonb` and doing both statements in one plpgsql transaction — the shape `count_group_variant_sizes` (`20260830c`) already uses, membership-gated, reporting the rows it wrote. **It is a MIGRATION**, which is why it is not a rider on a UI pass. **Sibling in shape to #54, #58 and #69.** **TRIGGER:** the next migration that touches the position tables, or the first report of a half-saved position. |
| 131 | 🟡 **`business_position_responsibilities.responsibility_id` HAS NO FOREIGN KEY, BECAUSE ITS PARENT IS A TYPESCRIPT CONSTANT — AND THE ORPHAN IT PERMITS IS ABSORBED AT THE CONSUMER RATHER THAN PREVENTED.** Filed 2026-08-31 (ledger #240) as a stated cost of the catalogue-in-code decision, not as an omission. `RESPONSIBILITY_CATALOGUE` (93 rows) lives in `packages/shared/src/positions/responsibilityCatalogue.ts` for the reason `tileRegistry.ts:17-27` gives and the role floor proves (`20260623…:201` seeded a floor that **never landed — 0 rows, verified**), so there is no table for Postgres to reference. **The consequence, named where it is paid:** deleting or renaming a catalogue row leaves every tenant's stored pick pointing at nothing, and the database cannot refuse it. **Mitigated in two places:** `buildPositionDocument` DROPS an unresolvable pick rather than printing a blank line (a shorter list beats a document with an empty bullet), and `positions.test.ts` **A3 pins the id FORMAT** (`AREA-NN`) so a rename is a visible, deliberate act rather than a typo. ⚠️ **WHAT IS NOT GUARDED, stated rather than implied: nothing detects a pick whose row is gone.** A tenant could carry orphaned picks for months and the only symptom is a description that is quietly shorter than the owner ticked. **REPAIR OPTIONS, none chosen:** (a) a startup/verify probe that reads live pick ids and fails on any not in the catalogue — cheap, but it needs DB access so it belongs in `verify:rls`, not `verify`; (b) a tombstone list of retired ids the catalogue carries, so a drop is declared and the document can say *"this responsibility was retired"* instead of falling silent; (c) accept it. **TRIGGER:** the first catalogue row anybody deletes — do not delete one before deciding. |
| 132 | 🟡 **capA HAS PRINTED SIX AMBER `new` LINES FOR THE POSITIONS PAGES SINCE #240, AND NOTHING HAS RECORDED THEM — A GAP LIST THAT ONLY GROWS STOPS BEING READ.** Measured 2026-08-31 (ledger #241): `verify-authority-checks` reports `PositionBuilder.tsx::mayEdit`, `PositionBuilder.tsx::render:settings:read`, `PositionDescription.tsx::render:settings:read`, `Positions.tsx::mayEdit`, `Positions.tsx::render:settings:read` and `Positions.tsx::route:settings:read` as **`new` (new site, re-baseline to record it)** → all six resolve to **OWNER+MANAGER**, which is correct and is what `settings:update` / `settings:read` should grant. ✅ **PROVEN PRE-EXISTING, NOT INTRODUCED BY #241:** `git stash`-ed the working tree and re-ran the cap — the same six lines, unchanged. capA is in **WARN MODE**, so the build passes and these are noise rather than a failure. 🔴 **NOT TAKEN DELIBERATELY, AND THE REASON IS THE SAME ONE THAT STOPS THUNDER MARKING AN OWNER-TEST CARD `covered`: baselining is the act of BLESSING a grant set.** Running `npm run authority:baseline` from a different session would record a blessing nobody gave — the grant sets should be recorded once David has owner-proven the surface they guard, which is CARD 7 and is still `owed`. **Fix = one command (`npm run authority:baseline`), AFTER CARD 7 passes**, and then a future widening of any of the six goes red instead of blending into six lines everyone has learned to scroll past. This is tech-debt **#73**'s disease (a stale advisory list rotting into unread noise) caught at four days old instead of at four months. |
| 133 | ✅ **RESOLVED 2026-08-31 BY RECONCILIATION (ledger #243) — David supplied the workbook and the sets are now ITS membership, not mine. 🔴 THE DIFFERENCES WERE WORTH FAR MORE THAN THE AGREEMENT: 75 of 88 rows agreed, and ALL FOUR of my worst errors were AUTHORITY I INVENTED THAT THE BUSINESS DOES NOT GRANT** — `SEL-05`/`SEL-15` to the sales manager, `SEL-03`/`SEL-04` to the external rep. *That is the over-granting this entire capability exists to prevent, reproduced inside the fix for it.* **What the workbook added was the opposite shape — real work with no software glamour:** `PPL-09` train new staff (which I had in NO set), `SEL-13` ask for a review given to the CREW, `INV-03` record a loss given to the driver, `PUR-07` allocate freight. **A derivation over-grants; observation notices unglamorous work.** ⚠️ The workbook calls itself *a draft from watching one business, not a measurement*, and that caveat now travels with the data. **Original entry follows.** 🟡 ~~**THE PER-ROLE RESPONSIBILITY SETS ARE A DERIVATION WEARING A MEASUREMENT'S CLOTHES, AND THE MATCHING COUNTS MAKE IT WORSE RATHER THAN BETTER.** Filed 2026-08-31 (ledger #241) by the build that created it. `positionStartingPoints.ts` carries five explicit sets whose **counts are David's measurement from the source workbook (34 / 27 / 9 / 8 / 10)** and whose **membership is not**: the workbook is not in this repository — nothing under `docs/discovery/`, `docs/user-stories/` or anywhere else holds a per-role responsibility list — so the rows were derived from the catalogue and **tuned until each set hit its stated count**. 🔴 **THEREFORE FIVE SETS LANDING EXACTLY ON FIVE STATED NUMBERS IS NOT CORROBORATION: the numbers were the target, so the agreement was constructed rather than observed.** Writing *"measured, not invented"* over that would have been R-26 instance fourteen, so the file header says what actually happened instead. ⚠️ **The exposure is bounded and that is why it shipped:** a starting point grants nothing, shows the owner every row it ticked, and is adjustable in one click — unlike a permission, being wrong here costs a tick. **Clears when the workbook is checked in and the sets are reconciled against it**, or when Lauren's corrections arrive and become the specification (the same input the whole capability is waiting on). `positions.test.ts` F11 pins the counts so they cannot drift silently, and its own comment says it is not evidence of membership.~~ ✅ **AND F11 EARNED ITS KEEP WITHIN MINUTES OF THE WORKBOOK LANDING:** transcribing it I dropped `SEL-03` from the sales manager and wrote a comment asserting the workbook excluded it — **a declaration false at the moment it was written, R-26's exact shape, by the author of the entry counting them** — and F11 went red on the count in seconds. A pinned count is a cheap check that cannot be talked out of noticing. |
| 134 | 🔴 **A CONDITION THAT LIVES INSIDE A `.tsx` COMPONENT CANNOT BE ASSERTED BY ANYTHING IN THIS REPOSITORY, AND #241 IS THE PROOF IT COSTS REAL DEFECTS.** Filed 2026-08-31 (ledger #242) by the build that paid for it. `scripts/run-tests.mjs` bundles `*.test.ts` with esbuild and runs it in **node** — deliberately, per §6 r10 (no vitest/jest by design). That is right for pure functions and it means **any logic reachable only through a component that needs React context, a Supabase client or a router is outside every check we have.** #241 shipped **25 assertions about starting points and 9 of 9 mutants caught**, while the render guard (`mayEdit && picks.size === 0 && !blankChosen`) and the JSX that maps sets to buttons were both untested — and the path the whole feature exists for was never once exercised. ✅ **#242 fixed THIS instance the only way that works: it moved the decision into a pure function and extracted the chooser into a context-free component, then rendered it with `react-dom/server` inside the existing runner — 20 assertions, 10/10 mutants, NO new dependency.** 🔴 **THE CLASS IS NOT FIXED AND THAT IS THE ENTRY.** Every other page in `packages/cultivar-os/src/pages/` still carries render conditions nobody can assert, and **nothing tells you which** — there is no cap, no count, and no list. The measured cost so far is one shipped feature that could not be reached. **The cheap next step is a COUNT, not a framework:** how many `&&`-guarded render blocks exist in `pages/`, so the exposure stops being anecdotal (#174's rule — an unmeasured class stays unmeasured). Then decide, by value (§6 r10), between (a) extracting guards to pure functions where they carry real logic — what #242 did, no new dependency, and the pattern is now proven — or (b) adding a DOM test runner, which is a standard we have twice declined for good reasons and which this single instance does not by itself justify. ⚠️ **Do NOT read this entry as "add jsdom".** The `react-dom/server` route needs no dependency at all and covers everything that is not effect-driven; what it cannot reach is `useEffect`, which is where the remaining `chooser.offer &&` in `PositionBuilder.tsx` still sits, provable only by owner-test CARD 9. |
| 135 | 🟡 **THE SELECTED DAY'S DATE IS PRINTED TWICE, EIGHTY PIXELS APART, AND THE SECOND COPY IS THE ONE THAT IS PROVEN.** With the day section moved directly under the grid (#244), the day-type control strip's label — `Saturday Aug 29` — now sits immediately above the drill-in's own green header, `Saturday, Aug 29, 2026 · 7 stops on this day`. **One fact, two representations, adjacent** — STD-011's shape, arriving in copy, and §6 r18's clause that a per-row glyph must not restate what the header already said. ⚠️ **NOT FIXED, AND THE REASON IS THAT THE OBVIOUS FIX IS THE WRONG ONE:** the drill-in's header is **CARD 9's proven text**, it is the heading that reads as the subject of the page (which is what defect ① was about), and rewriting it would break a standing card and edit the drill-in in a pass whose scope bar forbids touching it. The strip's label is the cheaper thing to change — but a control strip sitting between a grid and a green bar with **no subject at all** is worse than a repeated date, which is why it was not simply deleted either. | 2026-08-31 (ledger #244) | ONE of the two carries the day. Most likely: the strip absorbs the day-type control **into** the drill-in's header block (they are one section on screen already), so the day is named once, by the element that also carries the stop count. That is a change to `DeliverySchedule`'s header, which is why it is not this pass. | **The next build allowed to touch `DeliverySchedule`** — and it should take CARD 9 with it, because the card asserts the exact string. Do not fix it inside an unrelated pass; the value here is small and the card is load-bearing. |

### #155 — A CAPABILITY EXISTING IS NOT THE SAME AS IT BEING REACHABLE FROM WHERE YOU ARE STANDING (2026-09-03) 🟡

**The claim, made twice, by two different authors, about the same widget.** `<DataSheet>` carries
`renderExpand` — *"Optional per-row detail drawer"* — since 2026-07-01 (`e3e6796`). Twice now that
availability has been asserted **without checking the caller**:

1. **Lightning**, in the receipts build prompt: cited `renderExpand` as available to `ReceiptsList`
   while the component's own header said a fixed-column grid could not render the chain. The
   capability was real and the header was stale — recorded at ledger #266.
2. **Thunder**, in the #267 recon: reported *"what the display reuses — DataSheet has renderExpand"*
   for the QuickBooks books-read surface. 🔴 **`QboBooksReader` lives in `packages/shared`, which
   never imports `packages/cultivar-os`** (verified: zero import edges in that direction). The grid
   engine is not reachable from that file at all. David: *"Right about the widget, wrong about the
   reach."*

**THE SHAPE:** *"does this capability exist"* and *"can this caller use it"* are different
questions, and answering the first is routinely reported as answering the second. The first is a
grep; the second needs the **dependency direction** between the caller's package and the
capability's.

**WHY IT IS FILED RATHER THAN FIXED:** the fix in each instance was local (a plain bounded table
for the books read; the grid conversion for receipts). What is unfixed is the **habit** — and it has
now produced the error twice in one week, from both an analysis pass and a recon pass.

**A CHEAP MECHANICAL HALF EXISTS AND IS NOT BUILT:** the import direction `shared → cultivar-os` is
empty today and could be asserted, which would at least make *"is it reachable"* answerable by a
check rather than by memory. Named, not taken — it guards one direction of one boundary, and the
class is wider than that. → **now filed in its own right as #156**, because the deeper finding is
not that the check is missing but that **nothing enforces the boundary at all.**

⚠️ **UPDATED 2026-09-03 (#272) — INSTANCE 2 IS RESOLVED IN FACT, AND THE WAY IT RESOLVED IS THE
LESSON.** `DataSheet.tsx` was PROMOTED to `packages/shared/src/components/datasheet/`, so
`QboBooksReader` can now reach the grid engine and the reported reach is real. 🔴 **But note what
the correct answer turned out to be: the reach question was answered accurately and the CONCLUSION
drawn from it was still wrong.** *"Shared cannot import the app, therefore this surface gets a plain
table"* treats a package placement as a fixed constraint — and when David asked why the platform's
one grid engine lived inside a single vertical, the measured answer was that **nothing had ever held
it there**: the entire transitive closure is `react`, `lucide-react` and two zero-import siblings.
✏️ **So the class widens rather than closes.** *"Can this caller use it"* has a third form nobody
asked: **"and should the capability be where it is?"** A dependency direction is a fact; treating it
as immovable is a choice. ⚠️ **The books-read surface is still a plain table** — converting it is a
separate build against G1–G7 with its own owner-test cards, deliberately not ridden along on a move
whose whole virtue was that `verify` proved it changed no behaviour.



### #156 — THE `shared → cultivar-os` BOUNDARY IS ENFORCED BY NOTHING. IT IS A CONVENTION, NOT A CONSTRAINT (2026-09-03) 🔴

**Filed by David's instruction 2026-09-03 (#272), on the measurement that produced the DataSheet
promotion.** The one-way rule *"`packages/shared` never imports a vertical"* is real, correct, load-
bearing — and **held up by nothing but habit.** A file in `packages/shared` could add
`import { X } from '../../cultivar-os/src/…'` today and **every check in `npm run verify` would
pass.** Measured, mechanism by mechanism:

| Mechanism | What it actually does | Enforces? |
|---|---|---|
| `packages/shared/tsconfig.json` | `"include": ["src"]`, `paths` maps only `@trace/shared`. TypeScript **follows a relative import out of `include`** and type-checks it happily. No `references`, no project boundary. | ❌ No |
| `eslint.config.mjs` | Plugins: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`. **No `no-restricted-imports`, no `eslint-plugin-boundaries`, no `import/no-restricted-paths`** — zero matches for `restricted` or `boundaries` in the file. | ❌ No |
| `packages/shared/package.json` | Does not list `cultivar-os` — but until 2026-09-03 it did not list `react` or `lucide-react` either, which shared uses in 20+ files. **A manifest already silent about real dependencies cannot enforce anything.** | ❌ No |
| `knip.json` | Per-workspace `entry`/`project` globs. Knip reports **dead code**; it has no cross-workspace boundary assertion. | ❌ No |
| `vite.config.ts` (both apps) | Aliases `@trace/shared` → `../shared/src`. Bundles whatever it is handed. | ❌ No |

🔴 **WHY THIS IS THE ENTRY AND NOT A FOOTNOTE — DAVID'S REASONING, RECORDED IN HIS WORDS:** *"it is
the reason this decision was ever available to get wrong, and the next person will assume a rule
exists."* An unenforced rule is not a weak rule; it is a rule that **reads as settled while being
re-decidable by anyone**, which is how a grid engine ended up inside one vertical and stayed there
through eight consumers and two stale placement comments.

⚠️ **THE BOUNDARY IS ALREADY CROSSED IN ONE NON-IMPORT WAY, AND IT IS DELIBERATE.** Five test files
in shared `readFileSync` cultivar-os source as string assertions — `rosterAuthority.test.ts:145`,
`testMode.test.ts:99` and `:242`, `historyOrder.test.ts:211` and `:257`. **Not runtime coupling, and
it must not be broken by a naive rule**: any check written here has to assert *import edges*, not
*the string `cultivar-os`*, or it fails five legitimate probes on day one.

➕ **MEASURED AGAIN 2026-09-14 (recon #327, filed here on David's instruction) — TWO THINGS, AND
THE SECOND ONE CHANGES WHAT THE CAP MUST DO.**

✅ **① THE RULE HAS NEVER BEEN BROKEN.** A fresh sweep in both directions found **ZERO runtime
`shared → cultivar-os` imports** — checked for `@trace/cultivar-os`-style specifiers and for relative
`../../cultivar` paths across all of `packages/shared/src`. Meanwhile `cultivar-os` imports from
`shared` heavily (48× `context`, 32× `business-logic`, 19× `auth`, 11× `inventory`). **So the
convention has held for eleven months, by habit alone** — which is the strongest argument that the
cap is worth building cheaply, and that the risk it guards is not currently live.

🔴 **② AND THE BOUNDARY IS ALREADY CROSSED A SECOND NON-IMPORT WAY — ONE THE PROPOSED CAP WOULD NOT
SEE. TWO SHARED FILES CITE A VERTICAL FILE BY `file:line` AS AUTHORITY:**

| citing file | lines | cites |
|---|---|---|
| `packages/shared/src/auth/permissionManifest.ts` | `:99` `:379` `:613` `:633` `:826` `:1019` | `tileRegistry.ts` — six times |
| `packages/shared/src/positions/responsibilityCatalogue.ts` | `:17` | *"`tileRegistry.ts:17-27` **already ruled the pattern** for a platform-authored catalogue"* |

**Seven citations, no import edge.** `packages/cultivar-os/src/registry/tileRegistry.ts` is the file
that calls itself *"THE SINGLE TILE REGISTRY … one declared source for every tile/surface in
**TRACE**"* and declares `TileVertical = 'general'|'cultivar'|'ignition'|'conduit'|'kinna'` — **a
platform registry living inside a vertical**, which four platform verify scripts also hardcode the
path to (`verify-universals.mjs:496`, `verify-tile-fields.mjs:39`, `verify-authority-checks.mjs:499`,
`measure-registry-contradictions.mjs:56`).

⚠️ **SO THE ENTRY'S OWN REPAIR PARAGRAPH IS NOW KNOWN TO BE INCOMPLETE, AND THAT IS WHY THIS WAS
FILED RATHER THAN NOTED.** It says a check *"has to assert **import edges**, not the string
`cultivar-os`"* — correct for the five test files, and **it would catch none of these seven.** Move
or renumber `tileRegistry.ts` and all seven rot silently: a shared file reasoning about a vertical
file that no longer says what it claims. **[[R-26]]'s shape inside our own permission model**, which
is the one place a stale premise is least affordable.

⚠️ **IT IS NOT A SECOND DEFECT TO FIX SEPARATELY** — the durable answer to both halves is the same:
**`tileRegistry.ts` belongs in `shared`** (recon #327 Finding 2; the move is one `git mv`, ~10 import
updates and four one-line path edits, and `npm run verify` goes red loudly if it is wrong). Filed
here so that whoever builds the import-edge cap knows it does **not** close this entry on its own.
🔴 **DO NOT mark #156 resolved on the strength of an import-edge cap alone.**

**REPAIR (not chosen — the direction is one line, the scope is the question):** the narrow form is a
cap asserting **zero ES import/export edges from `packages/shared/src` into any sibling package**,
derived from the source rather than a hardcoded list, proven RED by planting one edge before it is
trusted ([[R-33]] / §6 r19). The wide form is `eslint-plugin-boundaries` with a declared layer graph,
which enforces **every** direction rather than the one we happened to think of — and is a new
dependency and a standard-by-value call (§6 r10). ⚠️ **Either way it must be proven against a planted
violation**, because a boundary cap that has never refused anything is exactly the false green §6 r19
exists to name.

**TRIGGER:** before the next vertical acquires a real surface — that is when the direction starts
getting tested by ordinary work rather than by a recon.

---

### #157 — THE PER-VERTICAL PALETTE EXISTS, IS CORRECT, AND HAS ZERO IMPORTERS — WHILE 42 HARDCODED CULTIVAR LITERALS SIT IN `shared` (2026-09-03) 🟡

**Filed by David's instruction 2026-09-03 (#272), explicitly AGAINST `packages/shared` and NOT
against `DataSheet` — his words: *"the 35 literals were there first."*** `packages/shared/src/design-
system/tokens.ts:210` exports a complete per-vertical palette (`cultivar` with `bg.page '#EAF3DE'`,
`green.primary '#27500A'`, `green.hover`, `green.light`, `red.netting`…, alongside an `ignition`
palette and shared `spacing`/`radius`/`font`). Its own header names the intended usage:
`import { ignition, cultivar, spacing, radius, font } from '@trace/shared/design-system/tokens'`.

🔴 **NOTHING IMPORTS IT. Population, not a sample:** a repo-wide grep for `design-system/tokens`
returns only the file itself. **The mechanism for the colour debt was built and never wired**, and
meanwhile the debt it was built to fix kept growing by hand.

**MEASURED 2026-09-03:** `#27500A` appears **35 times across 20 files in `packages/shared/src`**
before the DataSheet promotion — including `Button.tsx`, `Badge.tsx`, `AppHeader.tsx`, `Tile.tsx`,
`ProgressBar.tsx`, `LockedOverlay.tsx`, `OwnerSignup.tsx`, `BusinessProvider.tsx`. The promotion
carried in **7 more** (plus 1 × `#EAF3DE`) inside `DataSheet.tsx`'s `sheetStyles`, for **42**.

⚠️ **THIS IS CLAUDE.md §1.5's KNOWN AC-4 VIOLATION, WITH A NUMBER ATTACHED FOR THE FIRST TIME.**
§1.5 says *"Cultivar green `#27500A` default in shared UI primitives (post-August 2026)"* — true, and
unquantified, which is why it has been easy to keep paying. **42 occurrences, 21 files.**

🔴 **WHY IT MUST NOT BE FIXED INSIDE A COMPONENT:** fixing `DataSheet`'s 7 alone produces a clean
component in a package that is not clean, at the cost of a one-off theming mechanism that the other
35 do not share — i.e. a **second** way to express a colour, which is STD-011's shape and the drift
that makes the next fix harder rather than easier. The unit of repair is `shared`, not a file.

**REPAIR (not chosen):** wire `tokens.ts` as the single source and replace the literals package-wide
— which requires first answering **how a shared component learns which vertical it is rendering in**
(a `ThemeProvider`/context, a prop, or a build-time token swap). That question is unanswered and is
the actual blocker; the literals are a symptom of never having answered it. AC-4's own wording
— *structure shared, only tokens and vocabulary vary per vertical* — presumes a token channel exists.

**TRIGGER:** the first vertical that is not cultivar acquiring a real UI surface. Until then every
literal is accidentally correct, which is precisely why the count grows unnoticed.

### #186 — THE TEST RUNNER'S FILE DISCOVERY IS NON-DETERMINISTIC ON A SHARED TREE, AND A SHORT RUN STILL SAYS "ALL TEST FILES PASS" (2026-09-04) 🔴

**Observed, not theorised.** Two consecutive `node scripts/run-tests.mjs` runs, minutes apart, on the
same working tree:

```
── UNIT TESTS — 74 file(s) ──   → 74/74 files pass · 3838 assertions
── UNIT TESTS — 72 file(s) ──   → 72/72 files pass · 3775 assertions
```

The 72-file run **omitted two real, passing test files** — `invoiceGrid.test.ts` (35 assertions) and
another session's `invitationExpiry.test.ts` — and finished with **`All test files pass.`** Both
files existed on disk throughout; running either alone passed immediately.

🔴 **THE DEFECT IS NOT THE MISS, IT IS THAT THE MISS IS INDISTINGUISHABLE FROM SUCCESS.** The runner
walks the filesystem with `readdirSync` while up to four sessions write into one tree, so a file
being created mid-walk can be skipped. **It then reports a confident green over a corpus 63
assertions smaller than the one it believes it ran.** Nothing compares the discovered count to
anything; `74` and `72` are both printed with equal confidence, and the only reason this was caught
is that a human happened to read two totals in sequence.

**This is [[R-33]]'s shape in our own tooling:** the check cannot disagree with itself about what it
checked. A green from a partial corpus is exactly the false green the ruling is about, and it is
worse than a normal one because it appears at the moment the tree is busiest — which is the moment
several people are relying on it.

⚠️ **AND IT DEGRADES THE RATCHET AND EVERY MUTATION HARNESS THAT SHELLS OUT TO IT**, since a mutant
whose only probe file went undiscovered is reported CAUGHT-or-SURVIVED against a suite that never
ran it.

**The fix is a floor, not a rewrite:** record the discovered file count in `quality-baseline.json`
and **fail when it drops**, the same ratchet the lint counts already use. A file legitimately
deleted re-baselines deliberately; a file that vanished because someone else was typing fails loudly.
**Surfaced, not fixed** — changing the runner inside a surface build is the drift the gate exists to
catch, and this needs its own red-first proof.

---

### #187 — THE UI DIVERGENCE CAP CANNOT SEE `packages/shared`, SO A SURFACE THAT LIVES THERE IS UNMEASURED IN BOTH DIRECTIONS (2026-09-04) 🟡

`scripts/verify-ui-standard-divergence.mjs` sets `const SCAN_ROOT = 'packages/cultivar-os/src'`.
`QboBooksReader.tsx` — the accounting read, one of the surfaces an owner and their accountant
actually look at — is in `packages/shared/src/components`.

**So for the whole of its life the cap has said nothing about it, in either direction:**
- while it rendered a hand-written table it was **never counted as a bespoke surface**;
- now that it uses the shared grid it is **not credited as converged** either.

🔴 **THE ASYMMETRY IS THE PART THAT MATTERS.** A gap the cap can see is debt; a gap it cannot see is
invisible, and the board reports `undeclared_bespoke_surfaces: 23` as though that were the population.
It is the population **of one directory**. Nobody reading the number is told which directory.

⚠️ **WIDENING `SCAN_ROOT` IS NOT A ONE-LINE FIX AND MUST NOT BE DONE CASUALLY** — it re-baselines
that count into an unknown, and *"more unaudited surfaces, not fewer"* is a decision David has
already declined to bundle into a build once (#272). It is also **not the same as tech-debt #156**,
which is about import edges between the packages; this one is about the cap's field of view.

**What is true meanwhile, and is why #275's cards are written the way they are:** nothing mechanical
guards the books-read surface. Its probes, its mutants and its owner-test board are the entire guard,
and the board says so on its face rather than assuming a cap is watching.

---

### #188 — A COMMENT SAYS STAFF HOLDS `settings:read`. STAFF DOES NOT (2026-09-04) 🟡

`packages/shared/src/positions/positionStore.ts:16` reads: *"a STAFF member holds `settings:read`
and NOT `settings:update`, so every mutation in here…"*

**Measured against the manifest:** `settings:read` appears in `MANAGER_DEFAULT_BUNDLE` and in
`OWNER_DEFAULT_BUNDLE`. `STAFF_DEFAULT_BUNDLE` holds exactly nine strings —
`orders:create`, `orders:read`, `order_items:read`, `order_service_selections:read`,
`order_compliance_records:read`, `customers:read`, `inventory:read`, `deliveries:read`,
`deliveries:update` — **and no `settings:*` at all.**

**The cost is not the wrong word; it is that this comment is load-bearing for the reasoning around
it.** It is the stated justification for why the mutations in that file are shaped as they are, and
anyone reading it to answer *"who can reach positions?"* gets a confidently wrong answer that widens
the audience by a whole role.

⚠️ **THIS IS THE FOURTH COMMENT-CONTRADICTS-ITS-OWN-REPO FINDING IN A FORTNIGHT** — after #61
(`countPromote.ts` asserting a capability that existed), `DataSheet.tsx`'s placement trigger, and
`QboDeliveryIngest`'s claim that a manager could still preview (the branch returned first). **The
class is worth a name more than any one instance is worth a fix:** a reason written once and never
re-read becomes a fact nobody checks, and it is cheapest to catch when someone is already in the file.

**Comment-only fix. Surfaced not fixed** — `positionStore.ts` is nowhere near this build, and editing
a file to correct a sentence is how a reviewable diff stops being one.

---

### #189 — THE AUTHORITY CAP SEES ONE SHAPE OF AN OWNER GATE AND NOT THE OTHER (2026-09-04) 🟡

`scripts/verify-authority-checks.mjs` correctly flagged `{isOwner && (` in `QboBooksReader.tsx` as
*"guards a rendered control"* and demanded a declared reason. **In the same commit,
`if (!isOwner) return null;` was added to `QboDeliveryIngest.tsx` and `QboOrderIngest.tsx` and the
cap said nothing about either.**

Both express one decision. The early-return form is if anything the *stronger* gate — it removes the
entire panel rather than one control — and it is the form a builder reaches for naturally when
hiding a whole tool.

⚠️ **NOT A FALSE GREEN, AND THE DISTINCTION MATTERS:** the cap passes on its real assertion, and
these two panels are correct. But a cap whose coverage depends on which of two equivalent
spellings the author chose teaches the wrong lesson to anyone who notices — the way past it is to
write the gate differently, which nobody would intend and everybody would eventually do by accident.

**The fix is a pattern, not a policy change:** recognise `if (!<identity>) return` / `return null`
alongside the JSX-guard form. **Surfaced, not fixed** — extending an authority cap inside a surface
build needs its own red-first proof, and a cap changed without one is the thing [[R-33]] is about.

---

## #208 — 🔴 ONE PRESS OF SAVE ON THE COST PANEL DELETES LAWNS'S SALES-TAX RATE (NEW 2026-09-07)

> 🔴 **RE-CHECKED 2026-09-09 AT DAVID'S INSTRUCTION — *"check #208 rather than assuming."* IT IS
> STILL ARMED, AND POPULATING THE CONFIG MADE IT MORE DANGEROUS, NOT LESS.**
>
> **What changed:** `business_pricing_config` is now populated on LAWNS (`updated_at`
> 2026-09-08 21:12 — `discountTypes` Military/CD10%/CD15%, `margin`, `locations`, `denominators`).
> **`locations` is present**, so step 1 of the chain above — `parseConfig` returning `null` — no
> longer fires.
>
> 🔴 **BUT STEP 1 WAS NEVER THE MECHANISM. THE PRESERVE LIST IS, AND IT IS UNCHANGED — READ TODAY AT
> `packages/shared/src/components/CostToProduceSettings.tsx:438`:**
> ```ts
> for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled'] as const) {
> ```
> **Three names. `taxRate` is still not one of them.** `parseConfig` drops unknown keys, so `taxRate`
> is absent from `baseConfig`; it is absent from `preserved`; and `writePricingConfig`
> (`financialDataAccess.ts:230`) is `.upsert({ business_id, config })` — **a whole-column replace,
> not a merge.** `taxRate` does not exist anywhere in the cost-config shape
> (`business-logic/CostToProduce.ts`: zero occurrences). **One press of Save still deletes it.**
>
> 🔴 **AND THIS IS THE PART TO SIT WITH: THE FIX MADE IT LOOK SAFE.** Before, the panel refused to
> parse and showed platform defaults — a visible oddity that might have made someone stop. Now it
> loads LAWNS's real numbers and **looks entirely trustworthy**, and the Save still wipes the tax
> rate. **The warning sign was removed and the defect was not.**
>
> ⚠️ **`discountTypes` IS in the preserve list, so the new discount config survives a cost-panel
> Save. It is `taxRate` alone that does not.** REPORTED, NOT CHANGED, per instruction.


**FILED, NOT FIXED — David's instruction: *"it wants its own ledger row and its own fix."***

`CostToProduceSettings.tsx:435-444` re-reads the latest config before saving and PRESERVES the keys
other screens own — **by name, and the list is three long:**

```ts
for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled'] as const) {
  if (lc[k] !== undefined) preserved[k] = lc[k];
}
const configToWrite = { ...baseConfig, ...preserved };
```

**`taxRate` is not one of them.** The chain at LAWNS, each link verified against the live row:

1. `parseConfig` requires `Array.isArray(config.locations)`. LAWNS's `{"taxRate": 0.0825}` has no
   `locations`, so it returns `null` and the panel loads `EMPTY_COST_CONFIG` — **which has no
   `taxRate` key** — while showing platform defaults as though they were LAWNS's numbers.
2. On Save, `preserved` is `{}` (LAWNS has none of the three keys).
3. `writePricingConfig` upserts the whole `config` column. **The 8.25% is gone.**
4. `resolveTaxRate` → `null` → `taxStatus: 'not_identified'` → **every invoice after it charges $0
   tax under a redline.**

🔴 **AND BOTH CONTROLS ARE ON THE SAME PAGE.** `packages/cultivar-os/src/pages/Settings.tsx:788`
renders `<CostToProduceSettings />` inside the same `/settings` page that carries the tax-rate field.
Pressing the wrong Save is not a contrived path.

⚠️ **THIS IS THE FAILURE THE PRESERVE-LIST WAS WRITTEN TO PREVENT, ONE KEY OVER.** Its own comment
says *"A stale cost-panel load can never wipe what /discounts saved"* — which is exactly
`pricingRecipeFields.ts:53-60`'s argument about enumerative lists: *"a protected list alone is
ENUMERATIVE… the next field added is unprotected BY DEFAULT."* An allow-list of three names is
silent about the fourth.

**THE FIX IS NOT ADDING `taxRate` TO THE LIST** — that repeats the mistake with a longer list. It is
the same inversion `discountReview.buildAcceptancePatch` uses: write only the keys this panel OWNS,
and let everything else survive by never being mentioned. `PRICING_RECIPE_PROTECTED_PATHS` +
`PRICING_RECIPE_NOT_CONFIDENTIAL` between them already enumerate the config exhaustively and would
derive that list rather than hand-keeping it.

⚠️ **#279 SHRINKS THE BLAST RADIUS AND DOES NOT CLOSE IT.** Once the review has written `locations`,
`parseConfig` succeeds and the panel loads the real config — so a Save round-trips `taxRate` through
`baseConfig` and it survives. **The hazard remains for any tenant whose config lacks `locations`,
which is every un-reviewed tenant**, and it remains structurally for the next key nobody lists.

**NOT FIXED HERE:** re-pointing a shared panel's write inside a review build is the scope creep the
pre-flight gate exists to catch, and it needs its own red-first proof.

---

## #209 — 🟡 THE DISCOUNT REVIEW READS THE BOOKS ON ITS OWN, AND CANNOT REPLAY A SAVED CAPTURE (NEW 2026-09-07)

`DiscountReview.tsx` fetches `/api/qbo/invoices` and `/api/qbo/items` directly. `QboBooksReader`
fetches the same two routes. **Two CALLERS of one read — which is not what §6 r8 forbids (that is two
implementations of one OPERATION)** — but there is no shared "give me an invoice breakdown for this
business" seam, so the parse-and-summarise step exists in two places and could drift.

Not consolidated deliberately: `QboBooksReader`'s read is entity-generic across three entities and
its whole point is **saving the verbatim capture to the operator's download folder** (R-23). The
review wants one entity and no file. Folding them needs a decision about which of those two jobs the
shared function has, and that is a refactor of a live operator surface.

🔴 **THE PART THAT WILL BE FELT FIRST IS THE REPLAY, NOT THE DUPLICATION.** `QboBooksReader` can load
a saved `qbo-Invoice-*.json` and render from it (`readCaptureFile` + `projectCapture`), so the books
can be re-read without querying a customer's books again. **The review cannot** — it has only the
live path. So it cannot be demonstrated, debugged, or shown to anyone without a working QuickBooks
connection and a several-second round trip against a real company's accounting system.

**The fix is small and the seam already exists:** `projectCapture` already returns a
`breakdown: InvoiceBreakdown`, which is exactly what `buildDiscountReview` takes. A file input on the
review, or a shared "capture source" both screens read through, closes both halves at once.

---

## #210 — 🟢 THE TEST RUNNER REPORTED ✅ ON A FILE THAT WOULD NOT COMPILE (NEW + FIXED 2026-09-07)

**FOUND BY TRIPPING OVER IT, NOT BY LOOKING FOR IT** — a syntax error I had just written was
reported as `✅ packages/shared/src/quickbooks/invoiceList.test.ts (no summary line)`, and the run
ended *"All test files pass."*

**THE MECHANISM.** `run-tests.mjs` executes `esbuild … | node` through bash. Bash returns the exit
status of the **last** command in a pipeline. When esbuild fails it writes its diagnostics to
**stderr** and **nothing to stdout** — so `node` receives an EMPTY program, runs it successfully,
and exits 0. The pipeline succeeds; the runner records a pass.

🔴 **THE FILE'S OWN HEADER PROMISED THE OPPOSITE** — *"A file is FAILING if it exits non-zero — that
includes a bundle/compile error, which is itself a real failure (a test that cannot build is not a
test that passes)."* The intent was right and the pipeline silently defeated it. **This is the check
that certifies every other check**: `npm run verify` could go green with a test file that does not
compile, and tech-debt **#186** (the runner reporting 72 of 74 files and still saying *All test
files pass*) is the same family — the runner cannot tell a short run from a full one.

**FIXED, RED-FIRST:**
- `set -o pipefail` on the bash invocation, so the first non-zero status wins.
- **`(no summary line)` is now a FAILURE, not a footnote.** A file that exits cleanly but prints no
  `N passed, N failed` either died before the summary or asserts nothing at all — and a suite with
  zero assertions cannot disagree with anything, which is the one thing a test must be able to do.
  It used to render as a green tick over a file that proved nothing ([[R-33]]).

**PROVEN BY BREAKING SOMETHING ON PURPOSE:** `sizeLabel.test.ts` was given a deliberate syntax error
and went **❌ RED**; restored, it went **✅ GREEN (30 passed)**. A check nobody has watched refuse is
a claim.

⚠️ **#186 IS NOT CLOSED BY THIS.** Its defect is a DISCOVERED-FILE COUNT with nothing to compare it
against; the fix there is a floor in `quality-baseline.json`. This entry closes the compile half only.

---

## #211 — 🔴 A DECLARATIVE COMMENT ABOUT SOMEONE ELSE'S DATA, BELIEVED AND BUILT ON (NEW 2026-09-07)

`invoiceList.ts` carried, in two places, the sentence *"a discount line's `Qty` is the DOLLAR BASE
the percentage was taken from, not a count of anything."*

**MEASURED against LAWNS's 1,481-invoice export: `Qty` is 1 on all 21 discount item lines.** Never a
base. The consequences, all shipped:
- the review screen rendered **`$182.50` as `18250%`** — `|amount| ÷ 1 × 100`;
- **"0 we're sure about"** was an artifact: the "rates" only disagreed because they were not rates;
- `verdicts.belowSubtotal` reported **19 of 21 lines** as discounted on part of the invoice, which
  fed a books finding told to an owner — it was comparing $1.00 to an invoice subtotal;
- `excludedFromBase` was **empty on every row**, and that emptiness was the tell nobody read.

🔴 **THE CLASS, NOT THE INSTANCE.** [[R-26]] — a written declaration nobody checked against reality,
steering a decision — **inside our own corpus, and I quoted the comment as my justification while
writing the code that depended on it.** The probes then encoded the same premise: every fixture
passed the base *as Qty*, so code and test agreed perfectly and 96 assertions went green over the
defect. **A fixture that shares the code's assumption is not a test of it.**

**FIXED HERE:** both comments corrected in place with the measurement; the base is now derived from
the other charged lines; fixtures put the base where it really lives; a 100×-difference probe exists
(`discountReview.test.ts` §A) and mutant **T1** reproduces the exact defect and is caught.

⚠️ **THE CLASS IS OPEN.** No cap can read prose. The sweep this wants is: **every comment in the
corpus that asserts a fact about a customer's DATA** — a field's meaning, a value's range, a
population's size — **checked against a capture.** Comments about our own code are verifiable by
reading it; comments about someone else's system are not, and those are the ones that steer builds.
Related: #61, #145, #180 — the same family, all about our own repo rather than a customer's books.

---

## #212 — 🟢 `Committed` STOPS RE-COUNTING ON AN INLINE EDIT (NEW 2026-09-07 · **ACCEPTED BY DAVID THE SAME DAY**)

`/inventory` used to refetch the whole list after every cell edit, and one thing rode along that the
edit itself did not need: `fetchCommittedByLot` re-derived **`Committed`** — the units on open order
lines — for every row.

R-109 removed the refetch (the flash), so that re-derivation is gone with it.

**WHY IT IS CORRECT FOR THE EDIT:** no cell on this grid moves an order line, so `Committed` cannot
change as a result of anything typed here. `Available` recomputes correctly from the patched `qty`
against the `Committed` already in hand — the arithmetic is unaffected.

**WHAT IS ACTUALLY LOST, AND IT IS NOT NOTHING:** the refetch also picked up **someone else's**
order as a side effect of an unrelated edit. A member ringing up a sale while Lauren edits a price
will not move that row's `Committed` until she reloads. That was never this function's job and it
was never advertised — but it was real, and a reader finding stale numbers deserves to find this
row rather than reason it out.

✅ **RULED 2026-09-07, DAVID, ON BEING SHOWN IT:** *"Committed not recounting on an unrelated cell
edit is the right trade against the flash."* **This row is CLOSED as a decision, not as a fix** — the
behaviour stands as described and is no longer owed. It stays in the log because the next reader
finding a stale `Committed` needs to find a ruling here, not reason it out and "fix" it back.

**The fix, if the question ever changes:** re-derive `Committed` on an interval or on window focus —
never on an unrelated write. **Deliberately not built.** *How fresh should another person's orders be
on my screen* is its own question, and it was not answered by accepting this trade.

⚠️ **On the owner-test card as a thing to LOOK AT and agree with**, not buried here alone —
`inventory-full-surface-test.md` → *"An inline edit changes ONE row"*.


---

## #213 — 🔴 THE UNDO REPORT SAID 0 CUSTOMERS OVER A RUN THAT REMOVED 1,934 — MECHANISM NOT REPRODUCED (NEW 2026-09-07)

⚠️ **NUMBERING, STATED BECAUSE IT MATTERS:** the build prompt assigned this **#211**, correcting an
earlier note that called it #210. **Both are taken** — #210 is the test-runner pipefail bug and
**#211 is #280's "a declarative comment about someone else's data"**, filed hours earlier the same
day. Claimed as **#213**, the next genuinely free id. This is **#195's exact shape** (ids cited
that do not exist / collide) and it is why the max id is read before one is claimed.

**MEASURED 2026-09-07 2:05p on LAWNS.** `QboCatalogueImport` printed *"Undone. 647 imported
products and 0 imported customers removed, 447 of your own rows brought back."* It had deleted
**1,934**. The data was right — customers back to 30, zero rows carrying an `import_run_id`,
fingerprint identical. Only the sentence was wrong.

🔴 **THE STATED DIAGNOSIS DOES NOT HOLD, AND THE CORRECTION IS THE FINDING.** The prompt said *"the
endpoint returns `deleted` for customers; the surface reads another key."* **It does not.**
`QboCatalogueImport.tsx:402` read `undone.customers?.deleted ?? 0` — the right field, off the real
imported `CustomerUndoReport` type. Every link was then verified against the tree David actually
ran (the 12:12 commit, and he ran at 14:05):

- `undoCustomerImport` returns `deleted` counted from a real `.delete()…select('id')` — not from a
  bare delete, which would return zero rows. ✅
- `handleBooksUndo` puts it on the envelope under `customers`, and mints **ONE run id** across both
  halves. ✅
- `/api/qbo/books/undo` rewrites to `_route=books-undo`; `api/` holds no file that shadows it. ✅
- `countStamped`'s `head:true` + `count:'exact'` returns a true count against a live table (probed:
  30 over LAWNS, 0 for a run id matching nothing). ✅
- The unit probes covering the undo (`customerImport.test.ts` §J2–§J4) assert `deleted === 2` and
  `deleted === 1` and they pass. ✅

**So the mechanism is UNEXPLAINED and is NOT claimed fixed.** The one non-refusal path that returns
`deleted: 0` is `mine.length === 0` — nothing carries the run id — which would ALSO make David's
after-check ("zero rows still carrying an import_run_id") trivially true, but leaves open what
deleted the 1,934. Reporting that honestly rather than inventing a cause is the point of this batch.

**WHAT WAS FIXED (ledger #282):** the surface can no longer print a number the response did not
contain. `?? 0` is gone — an absent customer report now says *"an unreported number of imported
customers"* in red and tells the reader to re-run Preview. And `remainingWithThisRun` — the
**post-delete re-read**, which is the authoritative proof — is now on the screen beside the tally,
so a wrong count is contradicted in the next sentence instead of believed.

**OWED:** reproduce it. The cheapest route is David's own loop with the browser console open —
`[TRACE:CUSTIMPORT] undo` logs `deleted`, `blocked`, `remaining` server-side, and `[TRACE:QBITEMS] ui`
logs the response envelope. One run answers whether `customers` arrived null or `deleted` arrived 0,
and those are different bugs.

---

## #214 — 🟡 THE CUSTOMER-IMPORT TEST DOUBLE'S `range()` IS A NO-OP, SO NOTHING TESTS PAGING (NEW 2026-09-07)

`customerImport.test.ts`'s `makeDb` builder defines `range() { return b; }` — it **ignores offset
and limit entirely** and returns every matching row. So `undoCustomerImport`'s paging loop

```js
for (let from = 0; ; from += 1000) { … .range(from, from + 999); if (rows.length < 1000) break; }
```

is never exercised: every fixture is under 1,000 rows, so the loop breaks on its first pass and the
double's blindness never shows. At real scale the double would return the same 1,934 rows forever.

🔴 **WHY IT MATTERS BEYOND TIDINESS: paging is exactly the mechanism behind ledger #282 ④**, one
table over. A 1,000-row PostgREST cap silently truncated the customers roster and the header
asserted the cap as the total. The undo reads `customers` the same way, at the same scale, and
**nothing in the suite could tell a correct paging loop from a broken one.**

Same family as **#138** (a double more forgiving than the real system) and **#182** (a harness that
cannot reach its target reports the same as one that passed). Fix = make `range()` slice, and add a
fixture above 1,000 rows. **Surfaced, not fixed** — rewriting another suite's double inside a
five-defect fix is the drift the pre-flight gate exists to catch.

---

## #215 — 🟡 THE UI-DIVERGENCE CAP COUNTS A CHECKOUT PAGE AS A "RECORD LIST" (NEW 2026-09-07)

`verify-ui-standard-divergence.mjs`'s `isRecordList` is `(reads rows && maps) || <table`. Adding a
**single by-id customer read** to `CartReview.tsx` — a cart, not a list — pushed it into the bespoke
population and **failed the build at 24 against a baseline of 23.**

🔴 **THE THIRD TIME A CAP HAS PUNISHED A FIX** (see #281's binding-aware rewrite of
`verify-zero-row-writes`, and R-11's `!== 1`). It was NOT silenced with a declaration: declaring
CartReview as a record-list surface diverging from the grid standards would be **filing a false
statement to quiet a check**. The read was factored into `fetchAttachedCustomerTier` in
`financialDataAccess.ts` instead — beside `fetchTaxRate`, which exists for the same reason — which
is better architecture on its own terms and removes the false positive honestly.

⚠️ **The heuristic is still over-broad**: any page that reads one row and maps anything qualifies.
A record LIST renders many rows *of the thing it read*. Distinct from **#181** (a file absolved for
importing `sheetStyles`) and **#187** (the cap cannot see `packages/shared`) — same cap, three
different ways of being approximately right.

---

## #216 — 🟡 A SUPABASE `head: true` PROBE CANNOT DISAGREE — IT RETURNS 204 / `error: null` ON A TABLE THAT DOES NOT EXIST (NEW 2026-09-07)

Measured directly, 2026-09-07:

```
db.from('a_table_that_cannot_exist').select('*', {head:true, count:'exact'})
   → status 204 · error null · count null        ← reads as SUCCESS
db.from('a_table_that_cannot_exist').select('*').limit(1)
   → status 404 · error PGRST205                 ← reads as the refusal it is
```

🔴 **CAUGHT BY A NEGATIVE CONTROL PASSING**, in the first draft of
`scripts/measure-migrations-applied.mjs`: every 2026-09 migration reported **APPLIED**, including
`20260905_production_planning.sql`, whose three tables are absent. A whole migration census was
wrong in the reassuring direction, and the only thing that caught it was a control asserting that a
name which cannot exist must fail.

**The trap is general:** `head: true` is correct for COUNTING (`countStamped` uses it legitimately
and returns true counts) and is **never** valid for testing EXISTENCE. Any probe or guard using it
that way is [[R-33]] by construction. **OWED:** a sweep for `head: true` used as an existence check
across `scripts/` and `packages/`. Not swept this pass — named, with the measurement, so the next
probe author does not rediscover it the same way.

---

## #217 — 🔴 `seedServiceOfferings` WRITES A CATEGORY THE DATABASE REFUSES, AND THE CALLER SWALLOWS IT (NEW 2026-09-08)

`packages/shared/src/discovery/seed.ts:20` — `classifyCategory` returns `'uncategorized'` for any
category it does not recognise. Its own comment explains why, and the reasoning is right:

> *"The previous `toCategory()` mapped any unrecognized category to `'addon'` — a quiet LIE… D-9:
> surface uncertainty, never coerce it into a confident-looking value."*

🔴 **`service_offerings.category` CARRIES A CHECK OVER FIVE VALUES AND `uncategorized` IS NOT ONE
OF THEM.** `20260529_businesses_f_service_offerings.sql:17-18` —
`CHECK (category IN ('transport','addon','maintenance','inspection','subscription'))` — and
**grepped across the whole migration corpus, that constraint has never been altered.** So the
INSERT is rejected outright by Postgres, and the sole caller (`api/discovery/ingest.ts:191`)
catches it as `seed (non-fatal)` and continues:

```ts
} catch (seedErr: any) {
  console.error('[discovery/ingest] seed (non-fatal):', seedErr.message);
}
```

**A D-9 fix the schema refuses is not a fix — it is a silent drop**, and it drops the whole batch,
not just the unrecognised row, because `seedServiceOfferings` inserts the rows as one array. One
unclassifiable offering discards every offering discovery found for that business.

⚠️ **The same function also writes `price: 0` deliberately** (`is_active: false`, flagged in
`service_note`), which is the pattern `buildServiceRows` refuses outright — see #220.

**FIX:** either add `'uncategorized'` to the CHECK (a migration, David applies), or have
`classifyCategory` return `null` and `seedServiceOfferings` **hold the row back and report it**
rather than sending a value the database will not take. The second needs no SQL. **Found while
measuring destinations for the services review; not fixed in that pass** — repairing a discovery
seed path inside a review build is the scope creep the pre-flight gate exists to catch.
`buildServiceRows` refuses the value before it reaches the database and mutant **W5** guards it, so
the NEW writer cannot join this defect.

✅ **RESOLVED 2026-09-11 (ledger #293) — the second fix, no SQL.** `seedServiceOfferings` now HOLDS
BACK any row whose category is flagged and REPORTS it in `held`, with its reason; `classifyCategory`
keeps its contract (its `catalog.test.ts` probes are unchanged). Landed because R-120 produced a
sibling of this exact failure: a transport suggestion carries no mode, and the constraint written the
same day would refuse the whole batch the same way. **Both shapes are held back and both are guarded**
— `serviceOfferingShape.test.ts` §F, against a double that REFUSES what Postgres refuses and is watched
refusing first; mutants **D1** and **D2**.

---

## #218 — 🟡 `service_offerings` NOW HAS A THIRD WRITE FILE; ONE MODULE SHOULD OWN ALL OF THEM (NEW 2026-09-08)

Declared in `verify-write-paths.mjs` `ALLOWED_DIVERGENCE` with its reason, so the ratchet is clean
and the debt is visible rather than silent.

The three files that write `service_offerings` today:

| File | Verbs | Why it exists |
|---|---|---|
| `pages/Settings.tsx` | INSERT · UPDATE · DELETE | the owner's own editor — add, correct, toggle |
| `discovery/seed.ts` | INSERT | the website-discovery seed (and see #217) |
| `components/services/ServicesReview.tsx` | INSERT | **NEW** — the books review's accept |

🔴 **THE DECLARED REASON IS TRUE AND IT IS ALSO NOT THE END STATE.** The review may only ever
INSERT — David's ruling is *"correction, not undo"*, and a shared writer would hand it an UPDATE
capability it is deliberately built without, leaving the ruling resting on a caller remembering not
to call something. Its write is also **all-or-nothing across a batch**, which is not the single-row
semantic the editor needs. Both true.

**But the drift is the ordinary kind and it will happen:** the next column `service_offerings`
gains, or the next default it needs, lands in one file and not the others, and the three surfaces
disagree with nobody being told. This is #109's exact shape one table over.

**FIX:** one module — `serviceOfferingWrites.ts` — owning insert, update and delete as three named
functions with their own semantics, with `Settings.tsx` and this review each calling the one they
are allowed to. The table then returns to **two** app write paths and the baseline SHRINKS.
**Not taken here:** it means rewriting three live write sites on an owner-proven editor inside a
build that adds a read-and-review surface.

**TRIGGER:** the next change to what a `service_offerings` row carries — a column, a default, a
normalisation. Best landed with #217, which is a fourth caller of the same table.

🟡 **PARTIAL 2026-09-11 (ledger #293) — THE TRIGGER FIRED, AND THE HALF THAT HAD ALREADY CAUSED A
DEFECT IS LANDED.** A new rule for what a row carries arrived (R-120: a transport row must say who
transports), and it had drifted exactly as this entry predicted — the books review never wrote
`transport_mode`, and the editor's copy of the rule could never fire. **The category-scoped columns now
have ONE home, `business-logic/serviceOfferingShape.ts`, asked by all three writers**, and
`serviceOfferingShape.test.ts` §E **derives the writer population from the corpus and fails on a
fourth** (mutant **Z1** turns a reader into a writer and is caught). ⚠️ **Still open:** the three
`.from('service_offerings')` call sites were NOT moved into `serviceOfferingWrites.ts`. The shape rule
stops the columns drifting; it does not stop a fourth writer inserting — only the §E count does, and
only because it is a test.

---

## #219 — 🔴 ONE QUICKBOOKS ITEM CAN BECOME A SERVICE **AND** A PRODUCT, AND NOTHING DETECTS IT (NEW 2026-09-08)

Accept `Tree Bubbler` on the services review → one `service_offerings` row at $65. Run the
catalogue import → item `185` also lands in `business_inventory` as a **product priced $65 with a
scannable SKU**. Two live records for one QuickBooks item, **each unaware of the other**, and the
same $65 reachable on an order by two different mechanisms.

🔴 **NOTHING PREVENTS IT AND NOTHING CAN, BECAUSE THE LINK DOES NOT EXIST.**
`business_inventory` carries `qb_item_id` and `20260906c_qb_identity_unique_indexes.sql:77` puts a
unique index on `(business_id, qb_item_id)` — but that index is **scoped to one table**.
**`service_offerings` carries no QuickBooks reference of any kind**; measured against the migration
corpus, its columns are `business_id · name · description · category · timing · price_type ·
price_unit · price · transport_mode · trigger_transport_mode · recurrence_days · requires_address ·
pre_selected · is_active · sort_order · created_at` plus `compliance_title · compliance_body ·
service_note`. No `qb_item_id`, and the column set has not changed since 2026-05-29.

⚠️ **IT IS NOT RARE.** Of the 73 items the review classifies as services on LAWNS's capture,
**35 sit on `Sales of Product Income`** — precisely the ones the catalogue import is most confident
about. The tree bubbler is the clearest case: her books call it a product, the review offers it as
a service, and **both readings are defensible**, which is exactly why both will happen.

**FIX (a migration — David applies all SQL):**
1. `ALTER TABLE service_offerings ADD COLUMN qb_item_id text;`
2. A partial unique index `(business_id, qb_item_id) WHERE qb_item_id IS NOT NULL`.
   ⚠️ **#54/#58's blocker applies — it cannot land until the live rows are known clean**, and this
   session could not read them (`SUPABASE_SERVICE_KEY` empty, #183's blocker recurring).
3. The review writes `qb_item_id` on accept — it already holds Intuit's id on every row.
4. `adaptQboItems` excludes ids already present in `service_offerings` and **reports the exclusion**
   rather than dropping it silently.

**TRIGGER:** before the catalogue import is run again on a tenant that has accepted any service.

---

## #220 — 🟡 THE PLACEMENT LADDER IS MEASURED AND HAS NOWHERE TO LIVE — `service_offerings.price` IS ONE COLUMN (NEW 2026-09-08)

MEASURED from LAWNS's 1,481-invoice capture, by comparing the same plant sold planted against sold
bare — **193 plants have been sold both ways** across **909 planted lines**, and a planted tree
costs a median of **2.00×** a collected one:

| Pot | What planting adds | Evidence |
|---|---:|---|
| 7 Gallon | $101 | 5 lines, 3 plants |
| 15 Gallon | $214 | 137 lines, 48 plants |
| 30 Gallon | $418 | 259 lines, 48 plants |
| 45 Gallon | $529 | 208 lines, 37 plants |
| 65 Gallon | $650 | 55 lines, 11 plants |
| 95 Gallon | $906 | 69 lines, 11 plants |

`service_offerings.price` is a single `numeric(10,2)`. **Six prices for one service have no home.**
The review therefore REPORTS the ladder and writes none of it, and says so on the screen.

**THE THREE SHAPES, none chosen — this is David's call:**
**(a)** six rows, one per pot size — zero migration, ships today, and nothing joins them so
checkout has to pick by the plant's size with no declared relationship.
**(b)** a `price_by_size jsonb` column — one additive `ALTER`, but a second pricing vocabulary
beside `price` and two writers of one number.
**(c)** a `service_offering_prices` child table keyed `(offering_id, size)` — a migration and a
join on every checkout read, and the only one that survives *"per size AND per tier AND per season"*.

⚠️ **The money makes it urgent rather than tidy.** If LAWNS's placement is configured at $125 a
plant (STATED, not measured — the service key would not load), that is roughly **$300 a plant under
on anything 30 gallon and up.**

---

## #221 — 🟡 A `Type: 'Service'` ITEM IS NOT A SERVICE — 99 OF LAWNS'S 147 ARE PLANTS OR GOODS (NEW 2026-09-08)

Reported, not fixed, per the build's own instruction. `qboItemAdapter.ts:272` filters
`Type: 'Category'` and nothing else, so the import writes all 647 non-folder items to
`business_inventory` and the button says **647 products**.

🔴 **BUT THE ANSWER IS NOT 500 EITHER**, which is the finding. MEASURED across the 147
`Type: 'Service'` items by their `IncomeAccountRef.name`:

```
64 → Sales of Nursery Stock         TREES: Lacey Oak 45G, Shumard Red Oak 45, Mexican Sycamore 65g…
35 → Sales of Product Income        compost, fertiliser, containers — AND the bubbler and staking kits
22 → Landscaping/Installation       the real services
 8 → Discounts given                the /discounts population
 6 → Delivery Income                trip charge, tailgate, DIW, FDIW — and NZCM30, a crape myrtle
 7 → Income                         Backyard Delivery ($125), a bundle, four catch-alls
 5 → Refund · Late Fee · Warranty COGS · Services · Add-On
```

**Filtering on `Type` alone would move 99 real products OUT of the catalogue.** The classification
that works is the income account — HER word for what the money is, matched by NAME and never by id.
It is implemented, exported and mutation-tested as `classifyDestination`, and on the same capture
it splits **564 products · 73 services · 8 discounts · 2 bookkeeping · 38 folders = 685**.

**FIX:** `AdaptedItem` gains `incomeAccountName` (already parsed, currently dropped);
`adaptQboItems` calls `classifyDestination` and keeps only `destination === 'product'`;
`AdaptedItemList.counts` gains the other four so the screen prints the census, not one number.
**Not made:** the import is a WRITE path that has already run twice against LAWNS, and the 64
misfiled trees are exactly the rows R-70's retire-and-replace is about — a data question, not a
filter. Full working: `docs/decisions/2026-09-08-services-review-four-reports.md` §①.

---

## #222 — 🔴 ON `/discounts`, THE **FIRST** ACCEPT SILENTLY RETIRES EVERY LEGACY `pricingTiers` TIER (NEW 2026-09-08)

Found while answering *"does /discounts have the same re-run exposure?"* for the services review.
**The second pass is safe. The FIRST one is not, on a business carrying legacy tiers.**

`business-logic/discountReview.ts` → `buildAcceptancePatch`:

```ts
const existing: DiscountType[] = config.discountTypes === undefined ? [] : normalizeDiscountTypes(config);
```

and `tierPricing.ts:182-193` → `normalizeDiscountTypes` forward-migrates a legacy flat `pricingTiers`
**only while `discountTypes` is absent.**

🔴 **SO ON A BUSINESS WITH `pricingTiers` AND NO `discountTypes`:** `existing` is `[]`, the first
accept writes `discountTypes` holding **only the newly accepted tier**, and from that moment
`normalizeDiscountTypes` never looks at `pricingTiers` again. **Every legacy tier leaves checkout
in one press**, and the customers tagged with them silently resolve to the retail floor.

🔴 **AND THE REVIEW SCREEN CANNOT SHOW HER THAT IT HAPPENED.** `buildDiscountReview` reads the same
`normalizeDiscountTypes`, so those legacy tiers count as **`alreadyConfigured`** and are excluded
from the offering. They are neither offered nor written — they simply stop existing, with nothing
on any surface saying so.

✅ **LAWNS IS NOT EXPOSED.** Its `business_pricing_config.config` is `{"taxRate": 0.0825}` and
nothing else (R-103, measured 2026-09-06) — neither key is present, so `seeded` is true and the
first accept writes onto an empty record. ⚠️ **Test Dave's has not been checked** —
`SUPABASE_SERVICE_KEY` is empty in both env files and no live read was possible this session
(#183's blocker recurring).

**FIX:** `buildAcceptancePatch` should read `existing` through `normalizeDiscountTypes` whenever
**either** key is present — i.e. the same condition `buildDiscountReview` already calls `seeded` —
so a legacy business's tiers are carried forward into `discountTypes` by the first write instead of
being stranded. Roughly one line, plus a probe with a `pricingTiers`-only fixture asserting the
legacy tier survives the accept. **Not taken here:** it is a change to the money path of a
DIFFERENT screen, made from inside a services build, and it deserves its own owner-test card.

**TRIGGER:** before `/discounts` is run on any tenant whose config carries `pricingTiers`. Check
first: `select config ? 'pricingTiers', config ? 'discountTypes' from business_pricing_config;`

---

## #226 — 🔴 THE OPTIMISER SILENTLY ROUTES THROUGH A PHANTOM WHEN AN ADDRESS DOES NOT RESOLVE (NEW 2026-09-09)

**MEASURED live on LAWNS, build `f5f40e3`, David.** With **`104 Long Wedge Lane`** in place — a
string Google cannot resolve — Cultivar reported, without hesitation or warning:

```
Route ready — 8 stops · 104.5 miles · 2h 31m · optimized order
```

With the same stop corrected to **`104 Longwedge Ln`**: **97.5 miles · 2h 21m**, and **the stop
order materially reshuffled** — Rajendran moved **8 → 2**, Pelleg moved **5 → 8**.

🔴 **SO `DirectionsService` RESOLVED THE BAD STRING TO SOMEWHERE ELSE AND OPTIMISED THE WHOLE DAY
AROUND IT.** Not a dropped stop, not an error — a **phantom location** that silently reordered seven
other people's deliveries and added seven miles. The driver would have been sent on it. **Nothing on
the screen said anything was wrong**, and the summary read `optimized order` exactly as it does on a
good day.

🔴 **THIS UPGRADES OPEN DEFECT #11, AND MOVES IT.** The check does not belong beside the link button —
by then the damage is in the route. **It belongs UPSTREAM OF THE ROUTE BUILD:** an address that does
not resolve must stop the build and name itself, because a route built on a phantom is worse than no
route.

**TRIGGER:** before Lauren builds another route she does not personally verify. ⚠️ **NOT FIXED IN
THIS PASS, BY INSTRUCTION — filed and stopped.** Recon first; see #227, which constrains the fix.

---

## #227 — 🔴 THE TWO GOOGLE SURFACES DISAGREE ON THE SAME STRING, AND THE PERMISSIVE ONE IS OURS (NEW 2026-09-09)

**MEASURED live 2026-09-09, David, on the same two addresses.** `DirectionsService` — **the call
Cultivar makes** — **accepted both bad addresses.** The consumer Maps URL — **the artefact the
driver receives** — **refused both by name**: *"Google Maps can't find 321 Logan Randy Rd…"*.

🔴 **THE PERMISSIVE SURFACE IS THE ONE WE BUILD THE ROUTE WITH, AND THE STRICT ONE IS THE ONE THE
CUSTOMER-FACING ARTEFACT USES.** That is the wrong way round: we optimise confidently on a string the
thing we hand over will reject.

🔴 **THE COROLLARY IS THE EXPENSIVE PART, AND IT IS WHY THIS IS ITS OWN ENTRY: A VALIDITY CHECK
CANNOT RIDE THE EXISTING `DirectionsService` CALL.** It cannot — that call is precisely the one that
says yes. Closing #226 needs **Geocoding or Address Validation: a different request, a different
quota, and a cost per call.** Anyone estimating #226 as "add a guard to the existing call" is
estimating something that cannot work.

**TRIGGER:** with #226. ⚠️ **NOT FIXED IN THIS PASS, BY INSTRUCTION.**

---

## #228 — 🔴 THE STOP CARD IS DATED A DAY EARLY, AND R-25 ALREADY FIXED THIS SHAPE ONCE (NEW 2026-09-09)

**Observed live 2026-09-09, LAWNS.** On one card, three renderings of one day disagree:

| where | reads |
|---|---|
| the stop card summary | **`No items · Sep 11`** |
| the date field on that same card | `Sep 12, 2026` |
| the day header above it | `Saturday, Sep 12, 2026` |

🔴 **UTC-PARSE CLASS.** `new Date('2026-09-12')` parses as **midnight UTC** and renders as the
**previous day** everywhere west of Greenwich — which is everywhere LAWNS operates.

✏️ **AND WE HAVE ALREADY RULED ON IT: R-25 fixed this exact shape on the QuickBooks invoice read by
slicing the day out of the STRING rather than constructing a `Date`. The fix never reached this
card.** A ruling that lives in one reader and not in the others is [[R-26]]'s shape inside our own
corpus — the third instance this fortnight.

⚠️ **IT IS COSMETIC ONLY UNTIL SOMEBODY ACTS ON IT**, and this is a card a crew member reads to
decide which day they are driving. **TRIGGER:** the next touch of the delivery-schedule card.
**NOT FIXED IN THIS PASS.**

---

## #229 — 🔴 A DELIVERY DATE CAN BE MOVED AND NOTHING RECORDS WHO MOVED IT, WHEN, OR FROM WHAT (NEW 2026-09-09)

**Normal working, not a defect in itself:** Lauren uses the inline date editor to move stops from the
imported **ShipDate** to the **actual install date**. That is the job.

🔴 **NOTHING LOGS IT.** No actor, no timestamp, no previous value. And **`notes` still asserts the
original ship date**, so after an edit **the row contradicts itself** — one field says the stop moved,
another still says it did not.

🔴 **THE LOG IS NOT AUDIT THEATRE — IT IS WHAT PROTECTS HER EDITS FROM THE NEXT RE-INGEST.** On a
re-ingest a **deliberately moved row is indistinguishable from one that came in wrong**, so a
correction she made on purpose gets silently reverted to QuickBooks' ShipDate. The absence of the log
is what makes the re-ingest unsafe.

**LIKELY SEAM: `audit_log`** — members may INSERT. 🔴 **DO NOT force it into
`business_inventory_ledger`: a reschedule is not inventory movement**, and that table is append-only
with a trigger that rejects even `postgres`. **RECON BEFORE BUILDING. NOT BUILT IN THIS PASS, BY
INSTRUCTION.**

---

## #230 — 🟡 THE STOP PICKER AND THE ROUTE PUT DIFFERENT ORDERS BEHIND THE SAME NUMBERED BADGE (NEW 2026-09-09)

**Observed live 2026-09-09.** The picker numbers stops **1–8 in query order**; the route **renumbers
them into the optimised order**. Same badge, same visual language, two different meanings on two
screens a person moves between in one task.

🔴 **ANYONE READING THE PICKER'S NUMBERS AS THE DRIVING SEQUENCE IS WRONG**, and nothing on either
screen says which is which. This is §6 r18's class — a control asserting one thing while the state
means another — in a numeral rather than a header.

**FIX:** either the picker stops numbering (a checkbox does not need an ordinal), or the badge says
what it counts. **TRIGGER:** next touch of `/deliveries`. **NOT FIXED IN THIS PASS.**

---

## #224 — 🔴 THE COLLISION DETECTOR DOES NOT KEY ON THE PARSED SIZE, SO "22 COLLIDING ITEMS" IS A FLOOR AND A PASSING CARD SAYS OTHERWISE (NEW 2026-09-09)

**David's finding, reconciling the catalogue-import run.** The import's collision detector compares
the **raw size TEXT**. It does not key on the parsed-size projection — `unit_kind` / `unit_value` /
`unit_name` — so two rows with the **same name and the same parsed size but different size text**
(`15 gal` against `15 Gallon`) are **not detected as colliding**.

🔴 **THE COST IS NOT THE MISS, IT IS THAT A CARD REPORTS GREEN OVER IT.** `qb-catalogue-import`
**CARD 2** asserts *"22 colliding items, 6 with a price difference"* and the screen agrees with it.
**Both numbers are a FLOOR, not a count.** Lauren's review list is short by an unknown number, and
the card that exists to prove *nothing was silently dropped* would pass while something was. **A
passing card over a wrong number is worse than a failing one** — which is why CARD 2 now carries a
blocking DO-NOT-TICK note rather than a `failed` flip: its procedure is sound, its expected values
are not yet knowable.

✏️ **THIS IS TECH-DEBT #56'S FAMILY AT A NEW ADDRESS.** Six spellings of three sizes are already
known to be live in this catalogue, and the one shared `normalizeSize` was imported into the services
review for exactly this reason on 2026-09-08. The detector never got it.

**CORRECT ARCHITECTURE:** key the comparison on **R-27's projection**, which exists to close exactly
this and is already computed. Then **re-measure both numbers** and rewrite CARD 2's expected values.

**TRIGGER:** before Lauren reviews a collision list she is expected to act on. **NOT FIXED IN THIS
PASS, BY INSTRUCTION** — filed and stopped.

---

## #225 — 🟡 THE ROLES PAGE RENDERS 39 PILLS AGAINST A MEMBER-ROW ARRAY OF 40 (NEW 2026-09-09)

**Checked live at Lauren's desk 2026-09-08 on `6b2f881`.** STAFF renders **10**, which matches.
**MANAGER renders 39 against an array of 40 — one string is held and not rendered.**

✅ **THE LARGER HALF WENT THE RIGHT WAY AND SHOULD BE SAID:** the legacy pills are gone and the
**un-removable class went 29 → 1.** That is the bulk of `6b2f881`'s purpose and it landed.

🔴 **IT IS REDUCED, NOT CLOSED, AND IT MUST NOT BE FILED AS A PASS** (David's instruction).
`team-permissions` **card 5** asserts precisely *"after any save, the count on screen equals the
member row's array length"* — which is currently **false**. It is left `owed` rather than flipped to
`failed`, because the observation was made while checking the perms module and did **not** walk that
card's own steps (save a role, then compare). **Re-running card 5 as written is what settles which it
is.** `rbac` **N-3** is likewise partial: a card asserting *"no `declared-unwired` string renders"*
cannot be ticked while one does.

**WHICH STRING IS HELD IS NOT YET KNOWN** — that is the first question, and it decides whether this is
a render bug or a manifest classification that is doing its job.

---

## #223 — 🔴 THE MAPS URL FORM WE EMIT MAY SILENTLY TRUNCATE A LONG DAY, AND NOBODY KNOWS AT WHAT COUNT (NEW 2026-09-08)

**WHERE:** `packages/cultivar-os/src/lib/routeHandoff.ts` → `buildMapsUrl` — the path form
`https://www.google.com/maps/dir/<addr>/<addr>/…/`.

**WHAT.** Google's **documented** Maps URLs API caps waypoints at **9**, or **3 on a mobile
browser**, and states that excess waypoints *"will be ignored"* — silently, with no error and no
mark on the map. **We do not emit the documented form.** We emit an undocumented path form that
appears nowhere in Google's URL documentation, so its cap is **unknown to us**. Community reports
put it near 10 total stops; that is **[STATED]**, has no primary source, and must not be treated as
a finding.

🔴 **THE EXPOSURE IS MEASURED EVEN THOUGH THE CAP IS NOT.** From LAWNS's own invoice export over the
ShipDate year (Lightning, 2026-09-08): stops per delivery day run **1–14, mean 3.6** — **69 of 167
days (41%) exceed 3** and **7 of 167 (4%) exceed 9**. Busiest day **14**. **Lauren texts this link
to a driver's phone**, which is the platform carrying the lowest documented ceiling.

**WHY IT IS WORSE THAN THE DEFECT IT WAS FOUND BESIDE.** #286 fixed a route arriving in the wrong
ORDER — loud once someone looked. Truncation is quiet in a way the wrong order is not: Google draws
a normal-looking route, the missing stops are the LAST ones (end of day, nobody comparing), and the
driver has no list to check against because **the full stop count exists only on Lauren's screen**.
✏️ **One thing does now contradict it:** post-#286 the SMS honestly reports the number of stops in
the link we built, so the message would say *"(12 stops)"* while the phone shows four. The
disagreement is at least visible — **if someone counts.**

**WHY IT IS NOT FIXED HERE.** David's ruling, 2026-09-08: *"DO NOT FOLD IT INTO THE BUILD — it is
truncation, not mis-sorting, and it needs its own decision."* Folding a URL-form change into an
ordering fix would put two defects in one diff on the one capability the customer uses daily, and
would mean the ordering fix could not be owner-proven on its own.

⚠️ **NO THRESHOLD IS HARDCODED ANYWHERE IN THE SHIPPED CODE, DELIBERATELY.** A cap written from a
forum post is a hardcoded literal sourced from a guess, and the next reader would take it as
measured. `routeHandoff.ts` names the risk in its header and holds no number.

**FIX — MEASURE BEFORE CHOOSING.** The cap is a property of Google's servers and the handset, not of
our code, so no amount of reading settles it. Run **CARD 8** of
`docs/owner-tests/delivery-route-handoff-full-surface-test.md`: build a 12-stop route, text it, open
it on a phone, count what arrives. Then choose among **warn above the cap** · **split a long day
into two links** · **move to the documented `?api=1` form together with the split** (never alone —
it trades an unknown cap for a known LOWER one). Full options with costs:
`docs/decisions/2026-09-08-maps-url-waypoint-cap-report.md`.

**TRIGGER:** the next delivery day with more than 3 stops — i.e. **41% of days**, so effectively now.
Story piece `waypoint_cap_decision` on *What the driver receives is what the manager saw*.

---

## #231 — 🔴 THE COST PANEL RENDERS FABRICATED DEFAULTS TO ANYONE WHO CANNOT READ THE CONFIG (NEW 2026-09-09)

**Measured live 2026-09-09 under real RLS** (`scripts/rls/pricing-config-clobber.rls.mjs` §A,
assertions A1–A3), not inferred.

`packages/cultivar-os/src/pages/Settings.tsx:788` renders `<CostToProduceSettings />` with **no
permission gate at all**. Its sibling one line above gets
`<OperationsSettings … canReadMoney={can('pricing_recipe:read')} />`. The cost panel gets nothing.

A manager holds no `pricing_recipe:*` — LAWNS's live manager permission array was read the same day
and contains neither `pricing_recipe:read` nor `pricing_recipe:update`. So `readPricingConfig`
returns **no row and no error** (an RLS filter is not an error), `parseConfig(undefined)` returns
null, and the panel falls back to `EMPTY_COST_CONFIG` — **rendering built-in defaults as though they
were the business's configuration**: a 40% margin baseline, an N-list of `1, 5, 20, 100`, a location
named "Primary".

🔴 **PROVEN, NOT ARGUED: on a tenant whose stored `unitLabel` is `'tree'`, the manager's panel
renders `unit`.** Pressing Save then fails with a raw
`new row violates row-level security policy for table "business_pricing_config"` — the panel offers
a control that cannot work and explains nothing (§1.6 item 5, dead affordance).

**THE ARCHITECTURE:** D-9 Surface Honesty, in the form the 2026-07-30 six-surface-states ruling
generalised — *withheld data ANNOUNCES its redaction; never an empty list, never a zero*, and never
a plausible default. The same class as `1000 of 1000` (#282) and as `api/dashboard.ts:72-73`, which
returns `null` rather than `0` for a caller without `costs:read` *"because a redaction must not read
as a real figure (D-9)."*

**THE FIX** is small and known: pass `canReadRecipe={can('pricing_recipe:read')}` the way the
sibling already does, and render a locked card naming what is withheld and why (§6 r13's
locked-with-explanation, applied to a whole panel).

**TRIGGER / WHY NOT FIXED HERE:** it changes what Lauren sees on a live customer tenant in the week
of a demo, and that is David's call rather than a builder's. Surfaced from inside the tax-rate
clobber fix (ledger #287), which deliberately did not touch what renders. Owner-test card:
`docs/owner-tests/pricing-config-integrity-full-surface-test.md` CARD 6, `needs-test` **with this
reason**.

---

## #232 — 🟡 `pricing_recipe:update` GRANTS NOTHING: EVERY WRITER OF THAT COLUMN UPSERTS, AND MEMBERS HAVE NO INSERT POLICY (NEW 2026-09-09)

**Measured live 2026-09-09** (`pricing-config-clobber.rls.mjs` §B3), found while proving the
clobber fix.

`writePricingConfig` and therefore `mergePricingConfig` — the write path behind the Cost-to-Produce
panel, `/discounts`, and the discount review — issue a PostgREST **`.upsert()`**, which is
`INSERT … ON CONFLICT DO UPDATE`. Postgres requires the **INSERT** policy's `WITH CHECK` to pass on
that statement. `20260727_rbac_flip_corrections.sql:85` **DROPPED `bpc_member_insert`** deliberately,
on the reasoning that *"a pricing-config row is created ONCE, at onboarding, by the owner… a manager
editing a recipe never needs to create one."*

🔴 **THE REASONING IS SOUND AND THE CONSEQUENCE WAS NOT FORESEEN:** because the writer upserts
rather than updates, a member holding `pricing_recipe:update` **cannot write the column at all**.
Proven: a session granted `pricing_recipe:read` + `pricing_recipe:update` got
`new row violates row-level security policy`. Only `businesses.owner_id` can save, via
`bpc_owner_all`.

So `pricing_recipe:update` is a permission that currently admits nobody through the app — **#85/#86's
class** (a client gate that admitted nobody), one layer down, in the policy rather than the client.
And `permissionManifest.ts:867` states *"The /discounts surface is why `pricing_recipe:update` is in
this split"* — a surface that, for a member, cannot save.

**THE ARCHITECTURE:** the write should be an `UPDATE` when the row exists (it always does after
`seedPricingConfig`) with the INSERT reserved to onboarding — i.e. `writePricingConfig` reads,
then updates or inserts, rather than upserting. Alternatively restore a member INSERT policy, which
the correction migration argues against.

**TRIGGER:** the first time a manager is expected to edit discounts or the cost recipe — or the
first grant of `pricing_recipe:update` to a real person. ⚠️ **Not fixed in the clobber pass:
re-shaping the write verb for four surfaces inside a fix for one is the scope creep that makes a
diff unreviewable.** ⚠️ **It is also the reason the reported "one Save deletes their tax rate"
could not have been Lauren's** — see ledger #287.

---

## #233 — 🟡 TWO AUTHORISATION FUNCTIONS, TWO SEMANTICS. `has_permission` IS LITERAL; `has_permission_for` STILL EXPANDS ALIASES (NEW 2026-09-10)

`20260910_permission_literal_merge.sql` rewrites the **2-arg** `has_permission` to a literal
`permissions ? p_perm` and drops `has_permission_exact`. The **3-arg** `has_permission_for(business,
user, perm)` — used by `create_invitation`, `import_write_price`, `set_business_tax_rate`,
`set_business_profile`, `set_business_module_state`, `seed_business_modules`, `start_module_trial`
and `reset_invitation_expiry` — was **deliberately not touched**: changing it was not part of
David's ruling, and a permission function is the wrong place to take unauthorised scope.

⚠️ **NOT A LIVE DIVERGENCE TODAY, and that is measured rather than assumed.** The catalog check on
2026-09-10 found **zero legacy strings held by any member row in any tenant** (57 distinct strings,
all `resource:verb`), zero in `role_definitions`, and zero legacy literals in any policy or function
body. So the alias join in `has_permission_for` resolves nothing, and the two functions agree on
every live input.

🔴 **BUT THE SHAPE IS THE 2026-07-30 DEFECT'S EXACT CLASS** — that ruling's own words: *"Two
authorisation functions disagreeing about the same person is not a design."* The moment anyone
writes a legacy string into an array, the RPC layer and the policy layer answer differently, and
nothing would say so. **Filed so it is a decision on a board rather than a difference nobody wrote
down.** Fix: the same one-line body change, or delete the alias join from both. **Trigger:** the
next permissions pass, or any migration that seeds a non-`resource:verb` string.

---

## #234 — 🔴 EIGHTEEN POLICIES EXIST IN THE REPO AND NOT IN THE DATABASE — TWO MIGRATIONS ARE UNAPPLIED (NEW 2026-09-10)

**MEASURED against `pg_policies` with the PAT, 2026-09-10.** The live catalog holds **142** public
policies; the migration corpus derives **162**. Reconciled by name, the split is:

| Cause | Count | What |
|---|---|---|
| **UNAPPLIED MIGRATION** | **18** | `20260905_production_planning.sql` (12 — `production_plans`, `production_plan_lines`, `business_operations_config`, none of whose tables exist live) · `20260727c_campaigns_member_and_plant_events_scope.sql` (6 — `campaigns` ×3, `campaign_posts` ×3; **the tables DO exist, the member policies do not**) |
| Table no longer exists | 8 | `plants` ×2, `business_assets` ×2, `pmi_assets`, `pmi_service_logs`, `nursery_modules`, `campaign_tone_samples` |
| My own drop-tracking | 4 | 3 × `storage.objects` (live, but in schema `storage` — the parser assumed `public`) · `bpc_member_insert` (the filename-sort ordering error, already corrected) |

🔴 **THE CAMPAIGNS SIX ARE THE DANGEROUS HALF.** Those tables are live and carry only their
`_owner` policy, so **campaign reads and writes are owner-only in the database while the manifest
says `campaigns:read` / `campaigns:update` are `enforced` and MANAGER holds both.** A manager who
opens campaigns gets zero rows, not an error. **This is the `assets:read` defect (#153) at a new
address.**

⚠️ **DAVID APPLIES ALL SQL — neither was applied by this pass.** `20260905` would ALSO create three
tables; `20260727c` is policy-only. **Applying `20260727c` changes the policy count and grants a
manager access she is supposed to have.** Both are listed with their effects in
`docs/decisions/2026-09-10-policy-reconciliation.md`.

---

## #235 — 🟡 TEN LIVE POLICIES EXIST IN NO MIGRATION, AND `Tree Tarp` CARRIES A CONTRADICTORY PRICE PAIR (NEW 2026-09-10)

**(a) Undocumented change history — 10 policies.** Live in `public` and created by nothing in the
corpus: `addons_select_public` · `business_voice_samples_owner` · `cost_objects_owner_all` ·
`cultivar_plants.anon_select_plants` · `losses_all_owner` · `modules readable by authenticated
users` (note the spaces — a dashboard-created name) · `nurseries_select_public` ·
`nurseries_update_owner` · `plant_events.anon_select_plant_events` · `plant_events_select_public`.
They are legacy/pre-migration or hand-applied. **Five of them are `USING(true)`**, which is why the
live open count is **8** and not the 3 the corpus reports. Each needs a decision: capture in a
migration, or drop.

**(b) `Tree Tarp` is `price_type: 'per_unit'` with `price_unit: 'order'`** — a contradictory pair on
a live LAWNS row. `nettedQuantity` keys on `price_type` alone, so the tarp scales per plant, which
is what David says is correct — but the row *says* it is priced per order. Nothing reads
`price_unit` for money today, so this is a label that will mislead the next reader rather than a
money defect. **Surfaced during #288's trip-charge fix and deliberately not changed** — it is
customer data on a read-only tenant, and altering a price field to fix a label is the wrong trade.

---

## #236 — ✅ RESOLVED 2026-09-10 by `20260910b` — THE INSTALL-PRICE SAVE WAS B.1's DEFECT AT A SECOND ADDRESS (NEW+CLOSED same day)

✅ **CLOSED THE SAME DAY IT WAS FILED, AND THE CLOSE WAS MEASURED FROM BOTH SIDES.**
`20260910b_owner_id_policies_become_permissions.sql` repointed `nursery_profiles_owner` at
`settings:update` and added `nursery_profiles_member_select` on `settings:read`. Verified live
19:10: **2 policies, both permission-keyed, no raw `owner_id`.** Behavioural re-run on Test Dave's
with an ephemeral OWNER-ROLE principal that is NOT `businesses.owner_id`: **holding
`settings:update` → upsert SUCCEEDS (1 row); holding neither settings string → REFUSED 42501.**
⚠️ **The filing evidence and the close evidence are two hours apart on one afternoon, and the
board's Card 8 briefly carried the defect's `42501` against a database where it was already
fixed** — caught by David asking which side of the apply the run fell on. A defect proof carries
the time it was taken, or it outlives its subject.

`Settings.tsx:67` reads `nursery_profiles` and `:83` **upserts** it (the default install price).
`nursery_profiles` has **exactly one policy** — `nursery_profiles_owner`, keyed on the raw
`owner_id` column, **not** the widened `is_business_owner()`. So for an OWNER-ROLE member who is not
the account holder — **Lauren, measured 2026-09-10** — three things happen and all three are wrong:

1. **The read returns zero rows** through `.maybeSingle()`, so the field renders **blank**, which is
   indistinguishable from *"no install price is set"*. A false empty, not a refusal (D-9 / A9 —
   *absent is not empty*).
2. **The save is refused**, and `:34` surfaces `'Error: ' + error.message` — the **raw RLS string**,
   the same sentence that started the 2026-09-10 thread.
3. **The section is not permission-gated at all.** No `can()` anywhere near it. It renders for her,
   then fails.

⚠️ **NOT FIXED in #288, deliberately:** that prompt scoped B.1 to the profile save, and fixing a
second surface inside it is the scope creep that makes a diff unreviewable. **The fix is the same
shape** — the upsert becomes an UPDATE that proves it wrote, and the policy is re-pointed at
`settings:update` (triage bucket ③, `docs/decisions/2026-09-10-owner-id-policy-triage.md` row 36).

✅ **PROVABLE WITHOUT LAUREN AND WITHOUT A SITE VISIT** — CARD 8 on
`profile-save-and-permission-literal-full-surface-test.md` mints an ephemeral OWNER-role member via
`withMemberSession` and attempts the save. **Trigger:** the permissions pass that acts on the triage,
or sooner if the install price is needed on a customer tenant.

---

### ✅ CLAUSES 1 AND 2 ARE FIXED IN THE DATABASE — APPLIED 2026-09-10 (#289). CLAUSE 3 IS STILL OPEN.

**`supabase/migrations/20260910b_owner_id_policies_become_permissions.sql` WAS APPLIED by David on
2026-09-10**, and the result was re-measured against the catalog independently of the report:
`lauren_refusals 3 → 0`, `dead_permission_policies 31 → 0`, `surviving_dropped 10 → 0`, with
`joel_refusals` **held at 12**. ⚠️ **The row stays 🟡 because clause 3 is untouched and because
CARD 9 — Lauren editing the field in the actual UI — has not been run.** A database that agrees with
itself is not a person saving a price.

· `nursery_profiles_owner` is re-pointed at `settings:update` (clause 2), **and a NEW
  `nursery_profiles_member_select` is added on `settings:read`** — because clause 1 is not fixed by
  the re-point alone: a read gated on the WRITE string is a different lie, not the absence of one.
· Clause 3 (the section is not permission-gated in the UI) is **NOT fixed** — that is a client
  change on a customer tenant in demo week, and it is #231's sibling. **Still owed.**

🔴 **CLAUSE 1 WAS PROVEN BEHAVIOURALLY BEFORE THE FIX, WHICH IT HAD NOT BEEN.** CARD 12 in
`scripts/rls/permission-literal-and-owner-id-cards.rls.mjs` seeds a row with the service key, then
reads it back under an ephemeral OWNER-role session holding `settings:read`/`settings:update`:
**service key sees 1 row, the member sees 0, and there is NO ERROR.** The row is seeded first
precisely so a zero-row result cannot be confused with an empty table (#182 — a probe that cannot
reach its target reports the same as one that passed). ✏️ **And LAWNS has a `nursery_profiles` row —
measured 2026-09-10** — so Lauren's blank field today is a live false empty, not a missing record.


## #237 — 🟡 `get_my_permissions` CARRIES THE POSTGRES DEFAULT ACL, SO `anon` HOLDS EXECUTE (NEW 2026-09-10)

David applied `get_my_permissions(uuid)` **by hand** on 2026-09-10; `20260910c` captures it into
version control byte-identical to `pg_get_functiondef`. It gets the conventions right where its
predecessor did not — `SET search_path = ''` is pinned, SECURITY DEFINER, STABLE, owner `postgres`
(**verified against `pg_proc`, not assumed**). ✏️ *`has_permission_exact`, applied by hand one day
earlier, is the one that dropped `search_path`.*

**What it does not have is the REVOKE/GRANT pair every other SECURITY DEFINER function here
carries.** Its ACL is `=X/postgres` — the postgres default — which means **PUBLIC, and therefore
`anon`, holds EXECUTE.**

🔴 **IT IS A CONVENTION GAP, NOT A HOLE, AND THE DIFFERENCE IS WHY IT IS FILED RATHER THAN FIXED.**
The body filters on `bm.user_id = auth.uid()`, and `auth.uid()` is NULL for an anon caller.
**MEASURED 2026-09-10:** with no claims set it returns `('[]'::jsonb, false)` — it cannot name a
member, a business, or a string. ✅ **And AC-3 holds under a real principal:** Lauren asking about a
tenant she is not in gets the same `[]`/false a stranger gets, not an error and not another tenant's
array.

⚠️ **NOT FIXED HERE BECAUSE TIGHTENING A LIVE GRANT IS A BEHAVIOURAL CHANGE and the instruction was
to MATCH.** The two lines are written out, COMMENTED, at the foot of `20260910c`. **David's one-line
decision.** ✏️ *Incidentally it is what made the verification possible at all: the read-only PAT role
can call `get_my_permissions` and is refused `has_permission`, which 20260910 correctly locked down.*

**Trigger:** the pass that WIRES this RPC into the client — at which point an anon-callable
authority function stops being merely unconventional.

## #238 — 🟡 THE CLIENT COMPUTES AN OWNER'S AUTHORITY AND THE SERVER NEVER GAVE IT ONE OF THE STRINGS (NEW 2026-09-10)

`[TRACE:PERM]` reports `source: 'OWNER_LOCKED_SET (computed from the manifest)'` with **58** entries.
Measured against the catalog the same night: **Lauren 57 · David 57 · Joel 25.** The 58th is the
`owner-only` SENTINEL — **a string that exists in no array, is checked by 0 policies and 0
functions**, appended to the computed set in the browser.

🔴 **SO THE CLIENT CAN RENDER A SURFACE THE NOW-LITERAL `has_permission` REFUSES.** Client and server
derive authority from two different places, which is the 2026-07-30 defect's exact class. Nothing is
broken *today* — `owner-only` gates two routes (`/costs`, `/add-business`) that no policy tests — but
it is a divergence held together by the fact that nobody has looked.

⚠️ **AND THIS BUILD WIDENS IT BY TWO BEFORE NARROWING IT.** `OWNER_LOCKED_SET` is derived, so
minting `accounting:connect` and `devices:manage` takes it 58 → **60** at the next page load, with no
migration involved. Until `20260910b` is applied the stored arrays stay at 57. **No surface changes**
— nothing client-side gates on either string, checked — but the gap is 1 today and 3 between deploy
and apply.

**THE FIX IS `get_my_permissions` (#237, `20260910c`), AND IT IS DELIBERATELY UNWIRED.** When wired:
`can(x)` becomes `array.includes(x)`, `OWNER_LOCKED_SET` is **deleted**, and the `owner-only`
sentinel becomes the `is_account_holder` boolean that call already returns.

🔴 **ONE RULING BLOCKS IT AND IT IS DAVID'S: CAN AN OWNER REMOVE A PERMISSION FROM THEMSELVES?** It
is the reason the locked set exists. If the stored array is the only truth and an owner drops their
own `settings:update`, **they cannot grant it back.** Lightning's read is NO — the grant surface
refuses to remove a string from the account holder's own row *(⚠️ scope settled by R-121, 2026-09-11: every OWNER-role member's own row, not only the account holder's)*, and a new business seeds the owner's
array complete — which puts the guard at the **WRITE**, not a computed set at the **READ**. Wiring
before that ruling trades a client that over-claims for an owner who can lock themselves out, and
only the second is unrecoverable from the UI.

**Trigger:** David's ruling on self-removal. Not before. ✅ **FIRED 2026-09-11 — R-121: no owner may remove their own permissions, and the rule covers EVERY OWNER-ROLE MEMBER.** The lockout guard therefore keys on the OWNER role, never `businesses.owner_id`, and wiring `get_my_permissions` is no longer blocked on a ruling. ⚠️ Where the guard sits — at the write, or at the read — is still not ruled.

## #239 — 🟡 EIGHT OF THE TEN UNDOCUMENTED POLICIES ARE STILL UNCAPTURED (NEW 2026-09-10)

`docs/decisions/2026-09-10-policy-reconciliation.md` found ten live policies created by nothing in
the corpus. **#289 captured two of them** — `business_voice_samples_owner` and
`cost_objects_owner_all`, transcribed verbatim into `20260910b` §1 before they were touched, one of
them immediately dropped (so without the capture its definition would have left the database having
never been written down anywhere).

**The other eight are untouched and uncaptured:** `addons_select_public` ·
`cultivar_plants.anon_select_plants` · `losses_all_owner` · `modules readable by authenticated
users` · `nurseries_select_public` · `nurseries_update_owner` · `plant_events.anon_select_plant_events`
· `plant_events_select_public`.

⚠️ **Five of those are the open `USING(true)` public-QR grants and several are DUPLICATES of each
other** (`anon_select_plant_events` *and* `plant_events_select_public`; `addons_select_public` *and*
`anon_select_addons`; two on `modules`). Two spellings of one grant, and the redundant copy is the
one that drifts. ✏️ *`modules readable by authenticated users` contains SPACES — the Supabase
dashboard's default naming, i.e. it was typed into the UI by hand.*

**Deliberately out of scope of #289** (David: the open policies are their own decision).
**Trigger:** the open-policy pass.

## #240 — 🟡 THE V-BLOCK IMPERSONATION FORM THIS REPO KEEPS WRITING HAS NEVER BEEN RUN (NEW 2026-09-10)

`SET LOCAL role authenticated;` appears in three V-blocks (`20260828` V7/V8/V9) as the way to prove a
policy under a real principal. **It failed on first use, 2026-09-10:** `ERROR: 42501: permission
denied to set role "authenticated"`.

**Setting the CLAIMS GUC ALONE is sufficient** for anything reading `auth.uid()` — no role
membership required — and it is proven, not reasoned: three different real answers came out of
`get_my_permissions` under three different `sub` values. The role switch is needed **only** to make
RLS actually filter rows, which is a different test.

🔴 **THE CLASS IS [[R-33]]'s: a check nobody has ever run is indistinguishable from one that passes.**
`owner-role-authority` is a 16-card board at **0 covered**, and three of its cards carry a SQL block
that may simply refuse. Whether it refuses in the *dashboard* editor specifically is **UNKNOWN** —
the Management API PAT runs as `supabase_read_only_user` (measured), which is not a member of
`authenticated`; the dashboard runs as `postgres`, which probably is. **I could not test the
surface David actually uses, and I am not going to assert it either way.**

**Fixed forward in #289's own V-blocks and board** (claims-only, with an escape hatch on the one
check that genuinely needs the role). **Trigger:** the next time an older board's SQL card is run —
if it errors, this row is the explanation and the three cards need the same rewrite.

## #241 — 🟡 THE DUAL-RLS CAP ENCODES THE MODEL THE `owner_id` TRIAGE RETIRES, AND IT KEEPS PASSING ANYWAY (NEW 2026-09-10)

`verify-universals` capability **#3** asserts *"dual RLS (owner + `is_active_member`) on every tenant
table"* — an owner policy **and** a member policy. That was the right shape when every table had
both. **The 2026-09-10 ENTITY-vs-WORK triage replaces the owner half with a permission on 28
policies and DROPS it outright on 10**, so on those tables "dual" is no longer the target.

🔴 **THE PART TO DISTRUST IS THAT IT STILL PASSES.** `tableHasOwnerPolicy` (`verify-universals.mjs:105`)
is a plain corpus grep — `CREATE POLICY … ON <table> … owner_id = auth.uid()` — with **no
drop-tracking**. So after `20260910b` it will keep reporting an owner policy for `receipts`,
`business_inventory`, `cost_objects`, `labor_resources` and the rest, off `CREATE` statements the
same migration removes. **A stale pass, not a caught defect** — #73's class, in the cap that is
supposed to be catching that class. ✏️ *Its sibling `effectivePolicy` (`:90`) DOES track drops, which
is the only reason anything surfaced at all: the pinned `cultivar_plants_owner_all` went null and
failed the build.*

⚠️ **AND THE PIN BROKE FOR THE THIRD TIME.** `DUAL_TABLES` names a policy BY HAND, and this entry's
own comment already predicted it: *"a legitimate rename reports the policy as MISSING — a FALSE
FAILURE, not a caught defect."* It happened to `business_modules` on 2026-08-01 and to
`cultivar_plants` here. **Repointed to `cultivar_plants_owner_select`, not re-derived** — rewriting a
checker inside a migration pass is the drift the gate exists to catch, which is the reason its own
note gives for not doing it.

**THE FIX IS ONE QUESTION, NOT ONE FUNCTION: what does this cap assert AFTER the triage?** Most
likely *"every tenant table is reachable by a permission or a membership predicate, and by nothing
that compares `owner_id` unless it is one of the eight declared ENTITY/authority-store policies"* —
which is a different check with a different declaration, self-pruning the way
`r-b2-wired-since-declarations.json` is. **Trigger:** ✅ **FIRED — `20260910b` was applied 2026-09-10.** The cap is now measurably describing a
database that no longer matches its model: **raw-`owner_id` policies went 49 → 12** (the 8 declared
ENTITY/authority-store ones, `bpc_owner_insert`, and 3 on tables pending DROP), and capability #3
still reports dual RLS for `receipts`, `business_inventory`, `cost_objects` and `labor_resources`
**off `CREATE` statements the applied migration removed.** It is passing on history. Next pass.

---

## #242 — 🟡 THE AUDIT SPINE'S MIGRATION HEADER STATES AN AUTHOR MODEL THE PERMISSION MANIFEST RETIRED (NEW 2026-09-10)

⚠️ **RENUMBERED ON ARRIVAL, AND THAT IS THIS ROW'S SIBLING FINDING.** `docs/decisions/2026-09-10-audit-redirect-close-recon.md` claimed **#237–#241** for these five findings by arithmetic off the log's tail. **All five were already taken** by a parallel #289 session filed hours earlier (`get_my_permissions` ACL · client-computed authority · uncaptured policies · the unrun V-block · the dual-RLS cap). Claimed as **#242–#246**, read off `scripts/verify-id-citations.mjs` rather than counted. **#195's exact shape, fourth occurrence on one day** — see **#246**, which is the cap built to end it.

`supabase/migrations/20260623_audit_log_spine.sql:36-42` states, as a ratified decision:
*"AUTHOR MODEL: client-side INSERT (accountability-grade) — The owner/member appends audit rows from their own authenticated session (rides the existing call sites — no Vercel-fn round-trip per event)."*

`packages/shared/src/auth/permissionManifest.ts:204-206` states the opposite, and it is the one that matches reality:
*"`audit_log:create` takes NO ENTRY (spec §3): audit rows are written ONLY inside the funnel/RPCs as a side effect of an audited action. No member ever holds it. It is a SYSTEM WRITER."*

**The manifest is right.** All 11 live writers are `SECURITY DEFINER` plpgsql RPCs, and a repo-wide grep for `.from('audit_log').insert(` in application code returns **zero hits**. The author model changed by practice between June and July and **the migration header was never corrected**, so the document a reader opens first to learn how the spine works describes a model the platform abandoned. Nothing is broken today; the hazard is that the next writer built from that header is built client-side, which the permission model then refuses.

**Fix:** a comment-only correction to the migration header — **append a superseding note, never edit the applied migration's body** (§6 r1). Not taken in the recon pass: it is a documentation change inside a measurement prompt.

---

## #243 — 🔴 `audit_log` HAS NO READER, AND THE ONE NON-DAVID HOLDER OF `audit_log:read` WOULD BE REFUSED BY THE POLICY (NEW 2026-09-10)

**Two halves, both measured, and together they mean the accountability record is unreadable by design rather than by oversight.**

**① There is no reader at all.** `grep "from('audit_log')"` across `packages/` and `api/` returns **no application code** — only `scripts/measure-vendor-chain-applied.mjs:88` and a comment in `scripts/verify-write-paths.mjs:162`. **No page, no route, no tile, no endpoint.** 98 rows, 12 action types, written since 2026-07-20, and nothing in the product can display one.

**② The permission and the policy disagree.** Measured off `business_members`: **four members hold `audit_log:read`** — `David OBrian`, `David OBrien`, `TD OBrien`, and **`Lauren Bishop`**. The RLS policy is `audit_owner_read`:
```
business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
```
`businesses.owner_id` only. Per **#288**'s correction, **Lauren is an OWNER-ROLE member and is NOT `businesses.owner_id`** — David is. So the one non-David person holding the permission **would be refused by the policy if a surface existed.** That is **#232**'s class one table over: a permission that admits nobody.

🔴 **AND IT IS NOT A COSMETIC GAP. An accountability record nobody can read is not accountability** — every other item in the audit-redirect plan is theatre without this one. 29 of the 98 rows are attributed to LAWNS Tree Farm, a tenant about to go live, and no one there can see any of them.

**Fix:** an owner-gated `/audit` page reading the trail, plus widening the policy to `owner_id = auth.uid() OR has_permission(business_id,'audit_log:read')`. Costed at ~1 day and placed **above the line** in the before-go-live plan — the one item in that plan I would refuse to cut. Evidence: `docs/decisions/2026-09-10-audit-redirect-close-recon.md` §1.

---

## #244 — 🟡 THE RATIFIED `action` VOCABULARY DRIFTED: 8 OF 12 LIVE NAMES ARE ABSENT FROM IT, AND TWO SPELLINGS OF ONE SUBJECT ARE LIVE (NEW 2026-09-10)

`audit_log.action` is plain `text`. Live constraints on the table are exactly two — `audit_log_pkey` and `audit_log_business_id_fkey`. **No CHECK, no enum, no lookup.** That was a *stated, reasoned* choice (`20260623_audit_log_spine.sql:78-93`): *"a documented convention + an index, NOT a CHECK constraint. A CHECK would force a migration every time a new action type is added."* The vocabulary was homed in a `COMMENT ON COLUMN`.

**Seventy-eight days later, measured against the live table: 8 of the 12 action names in use are not in that comment.**

| live action | rows | in the ratified vocabulary? |
|---|---|---|
| `module_trial.started` | 28 | ✗ |
| `role.permissions_changed` | 19 | ✓ |
| `business_module.state_changed` | 16 | ✗ — the comment says `tile.activated` / `tile.revoked` |
| `role.factory_reset` | 9 | ✓ |
| `settings.profile_changed` | 9 | ✗ |
| `inventory.delete` | 7 | ✗ |
| `business_modules.seeded` | 4 | ✗ |
| `permission.self_elevation_denied` | 2 | ✓ |
| `receipt.deleted_by_db_owner` | 1 | ✗ |
| `business_modules.trial_access_corrected` | 1 | ✗ |
| `business_modules.classification_corrected` | 1 | ✗ |
| `member.role_changed` | 1 | ✓ |

⚠️ **And it is not merely off-list, it is internally inconsistent:** `business_module.state_changed` (singular) sits beside `business_modules.seeded` (plural) — **two spellings of one subject**, and the redundant spelling is the one that drifts (STD-011).

✏️ **`outcome` drifted identically and that one WAS caught**, which is the proof the mechanism is reachable: the column comment said `success | denied`, STD-023 (**#74**) added `no_change`, **26 rows carry it**, and `20260728c`'s footer corrected the comment with the right reason — *"a comment that undercounts the domain is the same class of artifact this whole week has been about."* **The `action` comment has never had such a correction.**

**Fix (keeps the original decision, adds teeth):** an `audit_action_types(action text PRIMARY KEY, description text)` lookup + an FK from `audit_log.action`. A new verb stays **one INSERT — data, no migration**, which is exactly what the no-CHECK ruling was protecting; a typo raises at write time. ~20 new call sites are about to be added, which is why this is filed now rather than after.

---

## #245 — 🔴 `removeMember` HARD-DELETES A MEMBERSHIP AND HAS NEVER WRITTEN AN AUDIT ROW — ITEM 3 ON THE 2026-06-24 REDIRECT LIST, HALF-CLOSED AND RECORDED AS CLOSED (NEW 2026-09-10)

The 2026-06-24 redirect inventory (`data/grower-scan/audit-spine-recon.md:76-86`) listed as item 3: *"`updateMemberRole` / `removeMember` → `member.role_changed` / `member.removed`."*

**Only the first half landed.** `updateMemberRole` was retired 2026-07-23 into `assign_member_role`, which audits — 1 live `member.role_changed` row. **`removeMember` was never touched**, and the live count of `member.removed` is **0, ever**.

Two unaudited authority acts, both client-direct, both in `packages/shared/src/auth/members.ts`:
- **`removeMember` (`:30-40`)** — a **hard `DELETE`** of a `business_members` row. No RPC, no trigger, no audit row.
- **`setMemberActive(false)` (`:56-69`)** — **revokes a person's access.** Same.

Five further direct `business_members` UPDATEs carry no audit row either: `Profile.tsx:544`, `acceptInvitation.ts:149`, `pinReset.ts:52`, `pinReset.ts:107`, and the first-owner INSERT at `OnboardingWizard.tsx:560` — **so the creation of a tenant and its first owner is unaudited too.**

🔴 **This is the case that decides the redirect's architecture, which is why it is filed as its own row.** Route A (an RPC per write path) needs **three to five new RPCs** to cover this one table, and a `DELETE` is the write A is worst at — there is no returning row to hang a contract on. Route B (one trigger on `business_members`) covers **all eight sites at once**, including the hard delete and including a hand-run SQL edit. See `docs/decisions/2026-09-10-audit-redirect-close-recon.md` §4.

**Fix:** `business_members` is one of the ten tables in item **B3** of the before-go-live plan.

---

## #246 — 🟡 NOTHING COUNTED CLIENT WRITE PATHS AGAINST AUDIT COVERAGE, AND NOTHING CHECKED THAT A CITED ID EXISTS — THE SECOND HALF IS NOW BUILT (NEW 2026-09-10)

**Two gaps with one shape: a declaration nobody re-derives (#73's class).**

**① Audit coverage is uncounted — STILL OPEN.** `scripts/verify-write-paths.mjs` tracks 33 tables' worth of write paths and says **nothing about whether any of them is audited.** Measured this session: **34 distinct tables, ~123 write sites** across `packages/cultivar-os/src` + `packages/shared/src`. A 35th table gaining a client write path with no audit trigger would pass every check in `npm run verify`. ⚠️ **This is why the 2026-06-24 redirect list rotted: it was complete against its own scope and nothing watched the scope grow.** Fix = item **B6** of the before-go-live plan, and without it this recon gets written again in November.

**② Cited-but-unfiled ids — ✅ BUILT 2026-09-10, `scripts/verify-id-citations.mjs`, wired into `npm run verify`.**
Four occurrences in a single day forced it: **#195 → #213 → #288(e) → #242–#246's own renumbering.** Two assertions: **(A)** no duplicate `## #N` row — *hard fail*; **(B)** no **net-new** tech-debt id cited in a watched doc with no row — *ratchet against `id-citations-baseline.json`*. Every run prints **the next genuinely free id**, so nobody has to do arithmetic again.

🔴 **THREE THINGS THE CAP MEASURED THAT NOBODY KNEW, ALL REPORTED NOT HIDDEN:**
- **The backlog is 182**, not four: 182 tech-debt ids are cited across `CLAUDE.md`, `CLOSE-OUT-LEDGER.md`, `built-inventory.md` and `RULINGS.md` with **no row in the log**. CLAUDE.md has said a version of this three times (*"the log stops at 185"*, *"stopped at 209"*) and nobody had counted it. **Baselined and printed on every run — it shrinks, never grows.**
- **It is a RATCHET for exactly that reason.** A hard gate over a 182-item backlog gets commented out inside a day, which `verify-write-paths.mjs`'s own header already learned out loud: *"a gate that blocks every build gets worked around, and a worked-around gate is worse than none."*
- ⚠️ **The cap made the very error it exists to catch, and it is recorded in its own source.** Version ① matched only `## #N` → 47 rows read as 40, inflating the dangling count. Version ② widened to `**#N` and produced a **FALSE DUPLICATE on #211** — both `**#N` line-starts in the log are bolded prose mid-sentence, never rows. **Found by running it, not by reading it.** The real discriminator is the em-dash after the id; a negative control for the #211 line is now a permanent probe. **The ledger shares this number space** (build #242 and tech-debt #242 both exist), so clause B matches only an explicit `tech-debt #N` marker and ignores bare `#N` — an earlier draft reported twelve ledger build ids as dangling citations.

---

## #247 — 🟡 AN EXPIRED QUICKBOOKS CONNECTION MAY REPORT ITSELF AS A REJECTED INVOICE, AND NOBODY HAS PRODUCED THE STATE (NEW 2026-09-10)

**Found while correcting the 503 copy in #291, and deliberately NOT chased inside that fix.**

`pushQboInvoice` returns **503 for two different states**: a missing `accounting_company_id` (never
connected) and `qb_token_expired` (`cultivar.ts` — `refreshQBToken` returned nothing). The
confirmation copy now names both, which is the honest description of the branch **as written**.

🔴 **WHAT IS NOT KNOWN IS WHETHER THE SECOND ONE EVER ACTUALLY ARRIVES THERE.** If an owner
disconnects the app from inside QuickBooks (Intuit → Apps → Disconnect), the tokens die while our
row keeps its `accounting_company_id`. Whether the next checkout lands on **503 `qb_token_expired`**
or sails past the refresh on a still-unexpired access token and **401s at the invoice POST** —
surfacing as `failed`, *"QuickBooks rejected the invoice"* — **has never been observed.** If it is
the latter, an expired connection is being reported as a rejected invoice: the D-48 defect in a new
place, the fix is at the seam rather than in the copy, and the owner is sent to debug an invoice
instead of to re-authorise.

**WHY IT WAS NOT SETTLED IN #291:** producing it requires disconnecting a real QuickBooks company
from Intuit's side, which is an owner action on Test Dave's, not something a probe can reach. Any
claim either way from a desk would be [[R-26]] — a written description standing in for a
measurement. **Recorded as OWED with the exact run that settles it: `qb-test-mode-full-surface-test.md`
CARD 25 (`needs-test`, reason stated).**

⚠️ **RELATED, AND NOT THE SAME:** #291's fix guarantees every state in the union has a badge. It
does **not** guarantee the server routes each real-world failure to the RIGHT state. The first is a
completeness property a cap can assert from source; the second is a fact about Intuit's behaviour
that only a live run can establish.

---

## #248 — 🟡 `20260529_pmi_shared.sql` NEVER RAN, AND NOTHING SAYS WHETHER IT EVER WILL (NEW 2026-09-11)

✅ **RESOLVED 2026-09-11 — RETIRED IN PLACE ([[R-139]], ledger #297).** The file keeps its path and its text: a header records why it is retired and what replaced each piece, and every statement is commented out, so it executes nothing and `--catalog` no longer lists it NOT_APPLIED. ✏️ **Corrected premise carried with it:** the asset table it would have created exists as `cost_objects` (renamed from `business_assets`), so nothing was taken from it. ⚠️ **Still unexplained:** the June document's claim that `pmi_service_logs` existed (below).

Measured by `node scripts/verify-migration-apply-state.mjs --catalog`, read-only: **`pmi_assets` and `pmi_service_logs` do not exist**, and no migration drops them. So the file was never applied. Its purpose was taken over by the `business_*` tables in `20260612_business_assets_inventory_pmi_service.sql` — so it was most likely **abandoned, not forgotten**.

🔴 **The cost is not the missing tables, it is the permanent false "owed".** Every apply-state run will report this file NOT_APPLIED forever, beside the two that genuinely await David (`20260727d` gated, `20260905` production planning). A list where one of three "not applied" entries is really "abandoned" teaches its reader to stop trusting the list.

⚠️ **And a June document contradicts the database.** `data/grower-scan/audit-spine-recon.md` (2026-06-24) names `pmi_service_logs` as one of *"the two 'log' tables"* that exist. It does not exist today, and no migration removed it — so either it never existed in this project or it was dropped by hand. Recorded, not investigated.

**Fix (David's call):** declare it abandoned in the tool (a small `abandoned` list read by `--catalog`, reported apart from NOT_APPLIED), or move the file out of `supabase/migrations/`. It has never run, so moving it breaks nothing applied — but other documents cite it, so the choice is David's.

---

## #249 — 🟡 `customers.shop_id` IS GONE AND NO MIGRATION REMOVES IT (NEW 2026-09-11)

`20260521_make_shop_id_nullable.sql` does `ALTER TABLE customers ALTER COLUMN shop_id DROP NOT NULL`. Measured 2026-09-11: **the column does not exist**, and nothing in the migration corpus drops it. Either it was dropped by hand in the dashboard, or it never existed in this project — the file predates the 2026-05-21 project separation, when `shop_id` was the Ignition-era tenant key.

Harmless today: nothing reads the column. Filed because **a change to live schema that no migration records is tech-debt #39's class** — the repo can no longer rebuild the database it describes. `nursery_modules` is the second instance found by the same run (dropped by hand; CLAUDE.md and PLATFORM_STATE.md said "pending DROP" until corrected 2026-09-11).

---

## #250 — 🟡 THE TRACE BUSINESS `45830ba7` IS GONE, AND TWO MIGRATIONS THAT WROTE TO IT ARE NOW UNVERIFIABLE (NEW 2026-09-11)

`20260614_cost_to_produce_trace_seed.sql` and `20260614_cost_to_produce_restore_truncated_lines.sql` write TRACE's own cost-to-produce config onto business `45830ba7-9961-403f-b048-77f022fb48dc` (the seed selects `business_type = 'general'` first). Measured 2026-09-11: **that business does not exist, and no `business_type = 'general'` business exists at all.** Whatever those migrations wrote went with it, so their apply-state cannot be checked.

⚠️ **Not investigated, deliberately:** who deleted the business and when. Other records still describe it as live — the 2026-06-23 handoff cites *"live values `general` [TRACE 45830ba7]"*. Recorded in `migration-data-checks.json` as `unverifiable`, with a query proving the reason still holds; the check turns **STALE_DECLARATION** the moment a `general` business reappears.

---

## #251 — ✅ **RESOLVED IN CODE, AND THIS ROW DESCRIBED A DEFECT THAT NO LONGER EXISTED** (corrected 2026-09-25)

🔴 **THE HEADLINE BELOW IS FALSE AS OF TODAY, AND IT WAS FALSE WHEN I CITED IT THIS MORNING.**
MEASURED 2026-09-25, `packages/cultivar-os/src/lib/transport.ts`:

```
:95  const self  = transportOfferings.find(o => o.transport_mode === 'self') ?? null;
:96  const staff = transportOfferings.filter(o => o.transport_mode === 'staff');
:99  // #251: filter, not find. The array order is the caller's (useServices sorts by sort_order).
:100 const deliveries = staff.filter(o => o.price_type === 'flat');     // per-order
```

`find` is used for **self** — correctly, there is one — and `filter` for **staff**. `deliveries` is
an ARRAY. **Checkout offers several staff options; Test Dave's renders two** (David, measured
2026-09-10). The repair even cites this item by number on line 99, so the fix knew about the row
and the row never learned about the fix.

⚠️ **AND I REPEATED IT.** On 2026-09-25 I told David that rings "would hide one" of his three $50
transport rows, citing #251 — from this entry, without reading the code it describes. That is
[[R-26]] exactly: a written declaration nobody re-derived, steering a decision. David caught it.
**Cite the code, not the row; and when a row and the code disagree, the code wins and the row gets
corrected** — which is what this edit is.

✏️ The original text is kept below so the history is legible, not deleted. Read it as *"what was
true on 2026-09-11"*, not as a live defect.

---

### ORIGINAL (2026-09-11) — NO LONGER TRUE, kept for the record
## #251 — 🔴 CHECKOUT OFFERS ONE STAFF DELIVERY PER SHAPE, AND A SECOND IS NEVER OFFERED — WHICH BLOCKS LAWNS'S OWN SERVICE LIST (NEW 2026-09-11)

`resolveTransportRoles` (`packages/cultivar-os/src/lib/transport.ts`) takes
`delivery = staff.find(price_type === 'flat')` and `planting = staff.find(price_type === 'per_unit')` —
**the FIRST of each, by `sort_order`** (`useServices` orders ascending). A second staff/flat row fills
no role, is named in no flag, and is not in `unbound` (it HAS a mode). **It is simply never offered, and
nothing says so.**

🔴 **WHY IT IS NOT HYPOTHETICAL.** LAWNS's invoices carry three fulfilment modes (David, 2026-09-11):
**TC trip charge** (533 lines, $40,760 — staff), **Tailgate Delivery** (127 lines, $18,990 — staff, but a
*different* service: a curb drop rather than carried in) and **self-collect** (no invoice line; nothing is
charged). Trip charge and tailgate are both staff and both charged once per order, so **modelling LAWNS's
real list correctly hides one of them at checkout.** The three-branch radio
(`delivery_planting · delivery_only · self`) has no slot for two staff deliveries.

**Pinned, not fixed:** `transport.test.ts` §D asserts the second row is silent, and says it is expected to
flip when this is fixed.

**FIX — a decision first:** does checkout offer N staff transport services as N choices (the radio becomes
a list derived from rows), or does a business carry ONE per shape and Settings refuses a second? The first
changes `SPEC-transport-netting-decline-workflow-2026-07-08.md` and `submit.ts`'s `deriveTransportMethod`;
the second is a Settings refusal. **David's call.**

**TRIGGER:** before LAWNS's three service rows are written (the pending data task, ledger #293) — or the data
task will look done and one service will be invisible.

---

## #252 — 🟡 `price_type` AND `price_unit` ARE TWO REPRESENTATIONS OF ONE FACT, AND THE TWO WRITERS DISAGREE ABOUT IT (NEW 2026-09-11)

R-120's recon question 2 — *"one mapping or two?"* — for the three fields it named:

| Field | Books review (`buildServiceRows`) | Settings add / edit |
|---|---|---|
| category + `transport_mode` | never wrote the mode | wrote it, from state that could never be empty |
| `price_type` | **DERIVED** — `order` → `flat`, else `per_unit` | **chosen independently** of `price_unit` |
| `sort_order` | `100 + index` | `offerings.length + 10` |

✅ **The first row is ONE mapping now** (`serviceOfferingShape.ts`, ledger #293).

🔴 **`price_type` is the operative one, and the editor lets it disagree with `price_unit`.** Checkout
multiplies on `price_type` alone (`netting.ts` — per_unit ×N, flat ×1) and `resolveTransportRoles` sorts on
it; `price_unit` is a label. So `flat` + `plant` charges once while reading *per plant*, and `per_unit` +
`order` multiplies a per-order fee by the tree count. The review cannot produce either; the editor can
produce both. `serviceOfferingEnums.ts` records the un-conflation as deliberate (2026-07-08), so this is a
recorded decision in tension with a later writer, not an accident.

⚠️ **`sort_order` is not cosmetic here:** with two rows of one shape it decides which one checkout offers (#251).

**COST TO MAKE IT ONE:** derive `price_type` from `price_unit` beside `categoryScopedFields` and drop the
editor's Price-type select — about twenty lines, **plus a live read first**, because any row where the two
disagree today would change what it charges. Not taken: no PAT this session, and it reverses a recorded
decision — David's.

**TRIGGER:** the first live row found where the two disagree, or #251's build (it touches the same resolver).

---

## #253 — ✅ RESOLVED 2026-09-15 — THE TABLES EXIST AND SETTINGS → OPERATIONS SAVES (filed 2026-09-11; the original claim is preserved below, unedited)

> ✅ **RESOLVED 2026-09-15 — DAVID RAN IT LIVE ON `c99a4c5`: he changed values in Settings → Operations and they PERSISTED ACROSS A RELOAD.** A value that survives a reload was written to, and read back from, `business_operations_config` under real RLS — so the table exists, is writable, and the save path works. 🔴 **THE ORIGINAL CLAIM WAS FALSE IN ITS LOAD-BEARING HALF** (*"three tables that do not exist"* · *"Settings → Operations cannot save … on every tenant"*) and it sat on `main` for four days as the **#1 item on the blocking short list**, gating tech-debt **#299**. ⚠️ **PRECISELY WHAT IS PROVEN, AND WHAT IS NOT:** David's run proves `business_operations_config`. 🔴 **AND THE OTHER TWO TABLES WERE ALREADY PROVEN ON `main` ITSELF, THREE DAYS BEFORE THIS CORRECTION.** `docs/recon/2026-09-12-one-fact-many-homes.md` — **committed to `main` on 2026-09-12** — carries a catalog read: `business_operations_config rls=true policies=4 cols=4` · `production_plans rls=true policies=4 cols=12` · `production_plan_lines rls=true policies=4 cols=19`, and states in its own words *"All three exist"* and *"it is describing yesterday."* **So `main` has carried the refutation and the false claim side by side for three days** — which is that recon's own thesis (one fact, many homes) demonstrated on itself. **Nobody has driven an Uppot plan COMMIT end to end**, so that surface is UNPROVEN rather than broken; it gets its own card, not a blocking row. ✏️ **[[R-111]]'s own lesson, one turn later:** its text already said *"a migration label is not evidence"* and named this very file as the one genuinely outstanding — **derived from a label, not from the database.**
>
> ⚠️ **THE TEXT BELOW IS THE ORIGINAL FILING AND IS LEFT UNEDITED** — it was believed when written and the record of what was believed is worth keeping. **It is wrong.** Read this block, not the one under it.

`20260905_production_planning.sql` creates `business_operations_config`, `production_plans` and `production_plan_lines`. **It is not applied** (measured 2026-09-11, `verify-migration-apply-state.mjs --catalog`). The code that depends on it **is shipped**:
- `packages/cultivar-os/src/components/settings/OperationsSettings.tsx` — rendered by the Settings page; reads and upserts `business_operations_config`. Its own trace logs *"operations settings write landed NOTHING"* and shows a notice.
- `packages/cultivar-os/src/lib/uppotPlanWrite.ts` — imported by `UppotPlan.tsx`; writes `production_plans` and `production_plan_lines`.
- `packages/shared/src/production/productionHold.ts` — reads `production_plan_lines` (logs the error rather than throwing).

🔴 **So Settings → Operations cannot save and the Uppot plan page cannot commit, on every tenant, today.** Nothing in `npm run verify` can see it: tsc, eslint and every probe read code, and the code is correct — the database it was written for does not exist. The migration is additive and its dependencies (`is_active_member`, `has_permission`, `set_updated_at`) are live. **Apply-or-retire is David's call** (RULINGS OWED); it is a MIGRATION question, not a code defect.

---

## #254 — 🟡 THE QUICKBOOKS IMPORTER DOES NOT READ `BillAddr.Line2` (NEW 2026-09-11, transcribed from the 2026-09-10 handoff)

> ✏️ **UPDATED 2026-09-14 (ledger #322) — SURFACED, NOT FIXED, AND THE SCOPE GREW BY MEASURING IT.**
> The import preview now **counts and names this defect on screen** before anything is written:
> check ① reports *"`BillAddr.Line2` has N values and is mapped to nothing — mostly street
> addresses"*, and check ② reports *"N of 1,946 values going into `address_line1` look like phone
> numbers, not street addresses."* **The importer still does not read `Line2`. This row stays OPEN.**
>
> 🔴 **AND THE FIX IS NOT "READ LINE2" — THAT IS THE PART THIS ROW DID NOT SAY.** `address_line1 =
> Line2` would give the **1,473 whose Line1 is already a real street** their suite number, and the
> **28 who have a phone in Line1 and no Line2 at all** a NULL. **486 broken addresses would become
> 1,473.** The repair has to be **per-record and shape-driven**, and that is a ruling David has not
> made — filed in `docs/open-questions.md` under #322.
>
> ⚠️ **THE 28 ARE THE ones NO REMAP CAN REACH** — asserted at `importFieldAudit.test.ts` §D8, which
> states what neither check says alone: 486 broken street columns minus 458 streets recoverable
> from Line2 leaves 28 records with no street anywhere in the capture.
>
> ⚠️ **THIS ROW'S OWN FIGURE WAS `456 values`.** The live number is whatever the check now reports;
> `qb-catalogue-import-full-surface-test.md` CARD 35 asks David to write it down.

`qboCustomerAdapter.ts` `billingOf()` returns `address_line1`, `city`, `state`, `zip` — **no second line**, deliberately: *"Line2 is deliberately NOT folded into line1 — `customers` has `billing_line2` and the party editor owns it; concatenating here would make this writer disagree with that one."* The reason is sound; the consequence is not handled. The handoff reports **451 routable addresses landing as phone numbers** because LAWNS staff put the real address on the second line — **that count is the handoff's, not re-measured here.**

**Fix the reader before any address cleanup** (handoff §6): write `Line2` to `billing_line2` rather than dropping it. Otherwise a clean-up of the address lines is undone by the next import.

---

## #255 — 🟡 A HARNESS MEMBER ROW IS LEFT ON TEST DAVE'S TREE NEST (NEW 2026-09-11)

`business_members` holds **`Harness STAFF (ledger)`**, one permission, on Test Dave's Tree Nest — measured 2026-09-11. `memberSession.mjs` deletes its principals in a `finally` and reports residue loudly; this row predates or escaped that. It grants almost nothing, and it is on a test tenant. Filed because a leftover principal changes every count of "members on this tenant" that anyone takes, and a harness that leaves residue corrupts the next run (tech-debt #79's lesson). **Delete it once its origin is identified** — it is not this session's to delete unasked.

---

## #256 — 🟡 FOURTEEN POLICIES ADMIT ANY ACTIVE MEMBER, WITH NO PERMISSION STRING (NEW 2026-09-11)

Measured 2026-09-11: **14 live policies** test `is_active_member(...)` and never `has_permission(...)`. Anyone signed in to the tenant can do what those policies allow. The 2026-09-10 handoff counted **23**; #289's triage reduced it. **Tolerable at LAWNS (three trusted logins); not at customer two.** Each needs the ENTITY-vs-WORK test (R-119) — most are WORK and want a string; some may be the membership read an app needs to function at all.

⚠️ **ONE OF THEM, NAMED (2026-09-11, ledger #297): `business_pmi_schedule_member_all`** — `FOR ALL` to `{public}`, `is_active_member(business_id)` only. Postgres ORs permissive policies together, so **it makes `business_pmi_schedule_owner_all`'s `pmi:update` gate decorative**: any active member can write any schedule in their business. `business_service_log` does not have this problem — all four of its policies carry a string.

---

## #257 — 🟡 NOTHING PROVES A PERMISSION MARKED `enforced` IS CHECKED BY ANY LIVE POLICY (NEW 2026-09-11, transcribed from the 2026-09-10 handoff)

`permissionManifest.ts` marks strings `enforced`, and no check compares that label to the live catalog. **`pricing_recipe:update` was marked enforced and admitted nobody for weeks** (#232). [[R-31]] already rules that an unenforced string may not be cited as evidence of coverage; nothing enforces R-31. A cap would read the manifest's `enforced` set and require each string to appear in at least one live policy or RPC body — through the read-only PAT, the same way `verify-migration-apply-state.mjs --catalog` reads the catalog.

---

## #258 — 🟡 SEVEN MOVEMENT RPCs CHECK WHO THE ACTOR IS BUT NOT WHAT THEY MAY DO (NEW 2026-09-11)

Measured 2026-09-11: **17 functions call `assert_movement_actor`; 9 contain no permission check.** Two of those nine (`save_role_permissions`, `assign_member_role`) check `owner_id` inline, so **seven are genuinely unchecked**: `adjust_inventory_manual` · `adjust_inventory_qty` · `count_group_variant_sizes` · `count_promote_create_inventory` · `count_reconcile_inventory` · `soft_delete_inventory` · **`record_order_event`** (the handoff's list named the inventory six and missed this one). `assert_movement_actor` proves membership and no forgery, not authority — so any member can adjust or delete stock through these. One permission argument fronts the inventory six. ⚠️ **Depends on the count/reconcile split** (`inventory:reconcile` is ruled minted per the 2026-09-10 handoff §3, and the string comes LAST; ⚠️ **no numbered ruling for it exists** — drafted as item (4) in RULINGS.md's OWED table): mint the string before blind capture exists and counting stops working for staff.

---

## #259 — 🟡 NOBODY HAS TRACED WHETHER THE OFFLINE QUEUE HANDLES A CONFLICT ON A STAGED INSERT (NEW 2026-09-11, transcribed from the 2026-09-10 handoff)

The offline queue's `rpc` op-kind queues an **apply**. Blind capture (#67) will queue a **staged insert** instead, and nobody has traced whether conflict handling behaves the same for it. **Counting is the one flow that genuinely happens in a dead zone**, so this is the path most likely to meet a conflict and least likely to be watched. Owed before blind capture ships, not after.

---

## #260 — 🟡 RULINGS.md HAS ONE NUMBER USED FOR TWO RULINGS, AND TWO ROWS THAT BREAK THE TABLE (NEW 2026-09-11)

Found while filing R-122…R-138, and **present in the committed file before this session touched it** (checked against `git show HEAD:docs/RULINGS.md`):

- 🔴 **R-101 is two different rulings.** 2026-09-07: *"THE COLLISIONS ARE HER FIRST EDITS, SO THEY LIVE ON THE GRID"*. 2026-09-06: *"DO NOT RUN THE ONBOARDING WIZARD AGAINST LAWNS. EVER, IN ITS CURRENT SHAPE."* Every citation of R-101 elsewhere is now ambiguous. The drafted numbering rule (RULINGS OWED, *"who owns an id"*, clause 4) says **the later claim renumbers** — but renumbering without first reading every citation would silently repoint the ones that meant the earlier ruling. **Not renumbered here, deliberately.**
- 🟡 **R-26 appears twice only because its row absorbed later "instance" notes** — the 2026-08-29 row opens with *"INSTANCE 14…"* and carries R-26's own text part-way through. One ruling, filed in a way that reads as two.
- 🟡 **Two dated rows have the wrong number of columns** (R-64 on 2026-09-02, and the 2026-08-23 *"READ HONESTY IS A TYPE"* row), from a literal `|` inside a cell. A markdown renderer splits them into extra columns.

**Nothing checks RULINGS.md's structure.** `verify-id-citations.mjs` checks tech-debt ids only, so a duplicate `R-` number passes every gate — which is how R-101 happened. The backlog's proposed Clause B (every cited `R-\d+` has exactly one row) would catch both the dangling and the duplicate case.

---

## #261 — 🔴 `/api/pmi/suggest` AUTHENTICATES NOBODY, AND EVERY CALL IS BILLED (NEW 2026-09-11)

Read 2026-09-11, `packages/cultivar-os/api/pmi/suggest.ts` (109 lines): the handler checks the method, requires `businessId` and `name` to be non-empty, and calls Anthropic. **It reads no `Authorization` header, resolves no session, and checks no membership or permission.** `businessId` appears only in log lines. Anyone who knows the URL can make the platform pay for a Sonnet call, as often as they like, naming any business. `max_tokens: 512` bounds each call; nothing bounds how many.

Nothing suggests it has been abused. It is still a billable endpoint on the public internet with no door. **Fix, not built here (#297 was docs and a migration):** require the caller's bearer token, resolve the member for `businessId`, and refuse without `pmi:update` — the same string the accept write already needs. ⚠️ **The other AI endpoints were not audited in this pass.** A keyword count proves nothing either way, so no claim is made about them.

---

## #262 — ✅ **PERMISSION BLOCKER RESOLVED-IN-FACT 2026-09-26 (Joel holds `costs:read`); THE SCREEN ITSELF IS UNPROVEN** — WAS: 🔴 THE PMI SCREEN IS INERT FOR ANYONE HOLDING `pmi:*` WITHOUT `costs:read` — AND LAWNS'S MANAGER IS THAT PERSON TODAY (NEW 2026-09-11)

🔴 **RULED 2026-09-22 (David, ledger #381) — LEAVE IT. JOEL DOES NOT GET `costs:read`, AND THAT IS A DECISION, NOT AN OVERSIGHT.**
Re-measured live that day while checking whether anyone at LAWNS was wrongly blocked: **Lauren and David hold 59
permissions each; Joel holds 25** — `inventory:read` yes, `costs:read` no, `inventory:import_price` no. So `/assets`
and `/pmi` are both closed to him, and **David's ruling is that they stay closed**: his **2026-07-23 ruling stands —
quantities yes, prices no**. A manager imports and counts stock; he does not see what it cost.

⚠️ **THEREFORE THE DECISION RECORD IS THE THING THAT IS NOW STALE, NOT THE GRANT.**
`scripts/verify-financial-permissions.mjs` still encodes `MANAGER: { view_costs, view_margin }` as its expectation —
written under the pre-2026-07-23 model, and in the RETIRED vocabulary (`view_costs`, which since
`20260910_permission_literal_merge.sql` made `has_permission` literal, **grants nothing to anyone**: measured
2026-09-22, 0 of 3 LAWNS members hold it and 0 live RLS policies reference it). **Two records disagree about the
manager's cost authority and the ruling is the one that is current.** Anyone reading that script to answer *"should
Joel see costs?"* gets a confident wrong answer — **#178's shape, in our own tooling.**

**WHAT IS STILL OWED HERE, AND IT IS NOW A COPY PROBLEM, NOT A PERMISSION ONE.** The original finding stands on its
own terms: the PMI screen **returns before reading a single asset**, so Joel sees an empty screen rather than one that
says *why* it is empty. Under the six-surface-states ruling, withheld data must ANNOUNCE its redaction — *"maintenance
costs are hidden; cost access required"* — never render as nothing. **That is the fix: the honest empty state, not the
grant.** Same for `/assets`.


Measured live 2026-09-11, read-only: **LAWNS's active MANAGER holds `pmi:read` and `pmi:update` and not `costs:read`**, and so does the platform MANAGER floor. `pages/PMI.tsx` passes `canSeeCosts={can('costs:read')}`, and `PMI.tsx:176` returns before reading a single asset. With no row to open there is no **Log Service**, no **✦ Suggest Schedule** and no schedule to read: the member holds maintenance authority over nothing.

Two things on that screen are false today:
- 🔴 **The redaction says** *"Your maintenance schedule and service history above are complete and unaffected."* **Nothing is above it.** The schedule and history render only inside an asset's detail view, which is reached only from the hidden list. §6 r18's class: a claim no state of the screen makes true.
- 🟡 **`+ Add` is shown**, and the insert into `cost_objects` needs `costs:create`, which that member does not hold — a control that looks usable and cannot save.

**Why the answer is not a new table:** the equipment IS recorded, in `cost_objects`. The obstacle is that one table holds both what a machine is and what it cost. `20260727b` already names the shape of the answer as the condition for `assets:*` to return — *"when 3b's projection makes an operational/financial split inside cost_objects real"* — and the choice is David's (RULINGS.md OWED: *who may see the equipment list without seeing what it cost?*). ⚠️ **The proposed yard-worker permission set inherits this exactly.**

---

✅ **RESOLVED-IN-FACT, MEASURED 2026-09-26 (YARD-PRODUCTION, ledger #416) — JOEL HOLDS `costs:read` NOW.**
Read live from `business_members` on the LAWNS tenant:

| member | role | `pmi:read` | `pmi:update` | `costs:read` | perms |
|---|---|---|---|---|---|
| joel joiner | MANAGER | ✅ | ✅ | **✅** | 27 |
| David OBrien | OWNER | ✅ | ✅ | ✅ | 59 |
| Lauren Bishop | OWNER | ✅ | ✅ | ✅ | 59 |

**So the premise of this entry — *"LAWNS's manager is that person today"* — is no longer true.**
`20260922e_manager_holds_costs_read.sql` was applied, and the screen is no longer inert for him.

⚠️ **WHAT IS NOT PROVEN BY THIS, stated so the closure is not read as wider than it is: nobody has driven
`/pmi` as Joel since.** This is an RLS/permission measurement, not an owner-prove — the screen could still be
empty for a different reason. **The permission blocker named in this entry is gone; the screen itself is
unproven.**

🔴 **AND A SEPARATE FINDING FROM THE SAME MEASUREMENT, NOT FIXED: `business_pmi_schedule` carries a
MEMBERSHIP-ONLY `ALL` policy beside its `pmi:update` one** — so **any active member has full write to the PMI
schedule regardless of permission**, which is wider than intended. Tech-debt #73's family (a membership-only
policy where a permission was meant). **Left alone deliberately: narrowing it takes access away from
somebody, and that is David's call, not a side effect of a measurement.** It is decision D in
`~/Desktop/MORNING-2026-09-26/YARD-PRODUCTION.md`.

## #263 — 🟡 THE GENERATOR SUGGESTS INTERVALS ITS OWN CONVERTER CANNOT READ (NEW 2026-09-11)

`api/pmi/suggest.ts:11` tells the model to use *"daily", "weekly", "monthly", "quarterly", "semi-annually", "annually", "every 2 years"* or a usage form. `pmiInterval.ts` `INTERVAL_DAYS` knows five words: `daily · weekly · monthly · quarterly · annually`. **So two intervals the prompt itself offers are unreadable by construction**, and the model also returns forms the prompt never listed. Measured live: **2 of the 27 saved tasks** — *"Flush and replace engine coolant — every 2 years"* (Mahindra 4025) and *"Change compressor pump oil — every 3 months"* (Craftsman compressor) — are calendar intervals the preview labels *"non-standard interval — no automatic due date."* The label is honest; the gap is that `every 3 months` IS `quarterly`. Low stakes while [[R-141]] is unbuilt, since only the soonest task drives a due date. ⚠️ Also: the prompt asks for 3–8 tasks, the Mahindra list has 11, and nothing enforces the range.

---

## #264 — 🔴 USAGE-BASED RECURRENCE HAS NOWHERE TO LIVE, AND THE HOURS ARE ALREADY A PRICED ITEM (NEW 2026-09-11)

[[R-140]] rules it required. Measured live 2026-09-11: **10 of the 27 tasks** on the three live schedules are hour intervals — *every 50 · 100 · 200 · 400 hours* — five on each tractor, none on the compressor. No table or column holds a meter reading, and no task exists for taking one. `deriveIntervalDays` excludes them rather than inventing a cadence, which is correct: the Ignition donor fabricated 30 days.

🔴 **The same number already exists on the sell side.** LAWNS's catalogue carries **`Kubota Hours` at $45** (`business_inventory`, measured), and LAWNS's asset list holds **one Kubota tractor (L4802HST) and a Kubota BH70 backhoe attachment**. Nothing links the priced item to either asset or to maintenance: hours sold to a customer never bring a service due.
- ⚠️ **[STATED], not measured: that LAWNS bills it on invoices.** 0 of LAWNS's 130 `order_items` reference it, so any invoice history for it is not in this database.
- ⚠️ **[INFERRED], not checked: that `Kubota Hours` counts the L4802HST's engine.** It could be the backhoe, or machine time not read off any meter.

Out of scope for #297 by David's instruction: the task object, the meter reading and the link are one later build.

---

## #265 — 🟡 ONE `interval_days` FOR TASKS FROM DAILY TO EVERY TWO YEARS — TWO OF THREE LIVE VALUES ARE UNRECORDED OVERRIDES, AND EVERY SCHEDULED ASSET SAYS "NO SCHEDULE" (NEW 2026-09-11)

[[R-141]] rules the interval belongs on the task. Measured live 2026-09-11: all three schedules have a **daily** task, so the derivation gives **1** on each, and the stored values are **30 · 1 · 30**. Two were typed over in the preview, and **nothing records that a stored cadence is an override rather than a derivation.** LAWNS's 30 matches none of its eight tasks.

And a contradiction on one card: `last_service_at` is NULL on all three schedules and `business_service_log` is empty, so `pmiStatusFrom` returns `NONE` and the chip reads **NO SCHEDULE** — directly beside *"8 tasks scheduled."* A schedule exists; what is missing is a first logged service. The operations calendar's PMI source already says so honestly (`operationsCalendar.ts`, state `no-data`). §6 r18's class.

---

## #266 — 🟡 THE ZONE WALK EXPORTS FOR A DESTINATION THAT DOES NOT EXIST (NEW 2026-09-11)

`packages/cultivar-os/public/tools/zone-walk.html` (ledger #298) says its JSON is *"for import into business_inventory.zone and the irrigation zone records."* **Measured live 2026-09-11 as `supabase_read_only_user`: neither exists.** `business_inventory` has no `zone` column (control: `size` and `attributes` returned); no public table matches `%zone%` or `%irrigat%`; the only zone-shaped column is `cultivar_plants.location_zone`, on a table holding **0 rows**. No importer exists either.

So a walker can capture all 88 zones and the result has no home. The work is not lost — the exported file is the record — but a header naming a column that is not there is [[R-26]]'s shape, and the next session asked to *"import the zone walk"* will go looking for it.

- ⚠️ **The shape is a decision, not a column.** A lot (`business_inventory` row) can sit in more than one zone and a zone holds many lots, so one `zone` text column on the lot records one of them. An irrigation zone also carries facts of its own — panel, run minutes, emitters, whether the valve exists — that belong to the zone, not to what grows in it.
- ⚠️ **Do not reach for `cultivar_plants.location_zone`.** It is a per-plant place name on an empty table; a valve id does not belong there.
- **Trigger:** before anyone imports an export. David's call on the shape.
- ✏️ **EXTENDED 2026-09-11 BY LEDGER #299 — ONE PLACE COLUMN WAS MISSED, AND IT IS THE ONE ON INVENTORY.** `business_inventory.location` exists: `text`, nullable, no constraint, no index, in the base `CREATE` (`20260612_business_assets_inventory_pmi_service.sql:106`). It is editable in two places (`InventoryEditor.tsx`, the inventory grid), read by the uppot plan, and holds **0 of 1,225 rows** on every tenant. A sweep for `%zone%` cannot see a column named `location` — #297's `cost_objects` lesson again. 🔴 **The fact that decides the shape is an INDEX:** `business_inventory_business_qb_item_uidx ON (business_id, qb_item_id)` makes inventory **one row per QuickBooks item** (0 duplicates), so any column on that row names ONE zone. Options and a recommendation (build the zone record, retire `location`, let the walk data decide column vs join): `docs/decisions/2026-09-11-install-date-and-inventory-location-recon.md` Part B.

---

## #267 — 🟡 `orders.install_date` IS A LIVE COLUMN THAT NOTHING HAS EVER WRITTEN OR READ (NEW 2026-09-11)

Measured live 2026-09-11 as `supabase_read_only_user`: `date`, nullable, no default, **0 of 76 orders** on every tenant. No constraint, index, function, view or policy references it. In the repo it appears once, `packages/cultivar-os/src/types/order.ts:32`, on an `Order` interface **nothing imports**. `git log -S install_date` shows it born in the original brief's DDL (2026-05-18) and never written by any commit. No migration creates it — `orders` has none, tech-debt #39's class.

It is the empty-column sweep's exact case: it looks built and never was. 🔴 **The cost is a confident wrong answer** — anyone asking *"where does the install date go?"* finds a column. Checkout's one date field is labelled *"Delivery date"* and serves install orders too (`CustomerCapture.tsx:458`).

- **Retire or wire is David's call, and it waits on where the warranty clock reads from** ([[R-143]]). The recon recommends retiring it: the planting stop's `deliveries.completed_at` already records the act, and a third date store would join two that already disagree (tech-debt #108).
- **Trigger:** the warranty-window build, or the next migration that touches `orders`.

---

## #268 — 🔴 A QUICKBOOKS-INGESTED STOP CAN NEVER BE A PLANTING STOP, SO SEVEN REAL INSTALLS WOULD NEVER START A WARRANTY (NEW 2026-09-11)

> ✏️ **RULED 2026-09-18 — [[R-164]], built as tech-debt #342.** The ingest infers install from the TC line and Lauren can change a stop's type on screen. Re-measured the same day: **16** QuickBooks-ingested orders with a TC line are typed `delivery` (this entry's 7 was a narrower count of stops).

All 19 LAWNS `source='qbo-shipdate'` stops carry `service_type` NULL, and their orders carry `transport_method='delivery'`. Matched by `qb_invoice_id` against the 2026-09-10 invoice capture (1,496 of 1,496), **7 of those 19 invoices carry install wording** and 15 carry a `TC` trip-charge line. Measured.

Not inferring is a recorded choice — `historyOrderWriter.ts:324`: *"NOT INFERRED, AND THAT IS DAVID'S CALL RATHER THAN A GAP"*; `deliveryIngestWriter.ts:340` gives the reason. **What was not recorded is the consequence.** Under [[R-143]] (*placement ⇒ warranty, delivery alone ⇒ none*), a stop that is not `planting` never starts a clock. So the ingest classifies seven installs as warranty-free, silently, and will do the same for every future QuickBooks-sourced install.

- The signal exists: install wording sits in the line description (*"(Install & Warranty)"*), and 0 of 124 tailgate invoices carry it (`2026-09-08-what-is-planted-in-a-customers-ground-recon.md:381`).
- **Trigger:** before any warranty window reads `deliveries`. David's call: infer `planting` from the lines, or let Lauren mark it.

---

## #269 — 🟡 `cultivar_plants.warranty_months` DEFAULTS EVERY PLANT TO 12 MONTHS; LAWNS WARRANT SIX (NEW 2026-09-11)

Measured live: `integer NOT NULL DEFAULT 12`. [[R-37]]: *"LAWNS warrant six months from planting."* A schema default that states a warranty length for every tenant is a tenant fact written as a platform constant (AC-1's shape, §1.6 item 2), and `PlantHero.tsx:79` renders it as *"12 months"*. **The table holds 0 rows**, so nothing is wrong today.

- **Trigger:** the first write to `cultivar_plants` or the warranty build, whichever comes first. The length belongs to the business, not to the column default.

---

## #270 — 🔴 THE REVIEW ASK SHIPPED 2026-08-31 AND COULD NOT RUN ON ANY TENANT — ITS MODULE HAS NO WAY TO BE TURNED ON (NEW 2026-09-11)

The ask (ledger #247) hangs off `followup_engine`: `reviewAskDecision` returns `module_off` unless that row is `enabled`, and every tenant was seeded `enabled:false`. **The only screen that enables a module is `/subscription`, and it cannot enable this one:** `Subscription.tsx:183-198` files any priced module whose tile is not `status:'live'` under **COMING**, which has no Turn on button, and `tileRegistry.ts:261` declares the Follow-Up tile `status:'planned'`. So the fulfilled tap, the prompt, the on-device QR and the ask record were all built and wired, and nobody could reach any of them through the product.

🔴 **And a test card said otherwise.** `delivery-fulfilment-full-surface-test.md` CARD 6 read *"Do CARD 8 first (turn the tile on, save a review link)"* — a step naming a control that does not exist. Nobody ran it, so nobody found out: [[R-26]]'s shape, a written instruction never checked against the product. The link half was a second barrier of the same kind: the field existed, four cards down `/settings/all`, and David — holding LAWNS's link — could not find it.

**The link half is fixed by ledger #300** (the field is on Business Profile). **The other half is a decision, not a code change, and it is David's:**
- **(a) The catalog offer** — make the tile `live` so `/subscription` shows Turn on, which starts the 30-day clock the catalog declares ($19/mo). ⚠️ A `live` tile needs a destination to open; this one has none.
- **(b) By hand, for one tenant, no clock** — one SQL statement David runs (`delivery-fulfilment` board CARD 16 does it for Test Dave's). For a PAYING tenant this contradicts ruling 2026-08-02 (8): *enabling and trialling are one act.*
- **(c) Make the ask core** — the story says it is deliberately a tile; this reverses that.
- **Trigger:** before the ask is expected to fire on LAWNS. Until then a saved link is shown to nobody, and the Business Profile hint says so in words.

## #271 — 🟡 A STOP HAS NO PHONE OF ITS OWN, AND THE STOPS WITHOUT ONE HAVE NOWHERE TO GET IT (NEW 2026-09-11)

Filed, not fixed, on David's instruction (ledger #301). The stop card shows `customers.phone` — the only phone there is: `deliveries` has **no phone column** (measured live, 19 columns). The customers whose stops show no phone hold none on their record either. So a crew at a gate with a question has no number to ring, and there is no place to record the site contact a ship-to change usually comes with (*"call Maria at the job site"*). **Decide with the address book** ([[D-41]] L2): a per-site contact belongs with the saved site, not on the billing customer. **Trigger:** the first time a crew reports a stop they could not reach.

## #272 — 🟡 A STOP MARKED DONE CANNOT BE REOPENED FROM ANY SCREEN (NEW 2026-09-11)

Filed, not fixed, on David's instruction (ledger #301). `crewStopModel` returns `action: null` once a stop is `fulfilled`, and no control writes it back to `scheduled`. A mistaken tap — and a phone in a garden makes those — is permanent except by SQL, and it stamps `completed_at` into the one dataset built to measure minutes-per-gallon honestly. The tap now exists on THREE screens (the schedule, the route, the order), so a wrong tap is three times as reachable as it was. **The shape is a decision, not a button:** who may reopen (the crew who tapped, or only `deliveries:update` holders?), and whether reopening clears `completed_at` or records the reversal beside it. **Trigger:** the first mistaken tap on a real tenant.

## #273 — 🟡 NOTHING EVER WRITES `cancelled`, WHILE EVERY STOP READ FILTERS IT OUT (NEW 2026-09-11)

Filed, not fixed, on David's instruction (ledger #301). `readStops` (and the operations calendar) exclude `.neq('status', 'cancelled')`, and `deliveryFulfilment.ts` gives the word a label and a colour — but **no writer in the repository sets it.** A called-off delivery can only be moved to another date or left `scheduled`, where it sits on the day sheet as a truck that should not go. The filter guards a state nothing can reach, which reads exactly like a working cancel. **Trigger:** the first called-off LAWNS delivery.

## #274 — 🟡 A COMMENT SAYS `deliveries` HAS NO `order_id`, BESIDE THE CODE THAT NOW WRITES IT (NEW 2026-09-11)

Filed, not fixed, on David's instruction (ledger #301). `packages/cultivar-os/api/orders/submit.ts:206` — *"`deliveries` has no `order_id`"* — sits above `scheduleCheckoutDelivery`, which as of #301 writes `order_id: args.orderId`. The column is added by `20260827_history_orders.sql:107-108` and 38 LAWNS stops carry it. **The second stale claim is gone:** DeliverySchedule.tsx's *"Live-only (tech-debt #39 — no migration adds it)"* left with that page's rewrite. The same comment's CONCLUSION still holds and must survive the fix — there is still no natural key, and nothing stops the same load becoming two stops (#108). Comment-only.

## #275 — 🟡 WHICH CREW ROLES CAN SEE AND WORK A STOP IS UNMEASURED — AND A CHECKOUT LINE'S NAME NEEDS `inventory:read` (NEW 2026-09-11)

Filed, not fixed, on David's instruction (ledger #301). The stop card reads through four permissions and each has a named degraded state: `deliveries:read` (the stop), `order_items:read` (the lines — withheld, never "no items"), `customers:read` (withheld), and **`inventory:read`, which nothing announces**: a checkout line carries a lot and no description, so its name comes through the `business_inventory ( name, size )` embed, and under RLS a viewer without `inventory:read` gets `null` there — the line then reads *"No catalog match"* on a crew phone. History lines are unaffected (they carry their own words). Which LAWNS roles hold which of the four has not been read for this build. **Trigger:** before a crew member uses the stop card on a checkout-born stop.

## #276 — 🟡 A SHIP-TO CHANGE AND ITS HISTORY ROW ARE TWO CALLS, NOT ONE (NEW 2026-09-11)

Filed with ledger #301. `stopWrites.saveShipTo` updates the stop, then inserts the `delivery.ship_to_changed` audit row. There is no transaction across two PostgREST calls, so the order is chosen on what a half-landed save leaves: the address first, the row second — the failure can only be *"saved, not recorded"*, which the card says in words, and never a history row for a change that did not happen (the log is append-only and could not be corrected). It is also a second client-side writer of `audit_log`, declared in `verify-write-paths.mjs` against a reason that otherwise prefers the row inside the audited action. **The durable form is one RPC** that updates the stop and writes the row in one transaction — a migration, not taken in a composition build. **Trigger:** the address-book question ([[D-41]] L2) is asked of these rows, and a missing one would bias the answer.

## #277 — 🟡 `/deliveries` WITHOUT A DATE STILL LISTS CART ORDERS, NOT STOPS (NEW 2026-09-11)

Found building ledger #301. The route page's date mode now renders the ONE stop; its **legacy mode** (`/deliveries`, reached from *"Route delivery orders from checkout →"*) still lists `orders` with `transport_method='delivery'`, shows the first line only, reads the CUSTOMER's billing address rather than a ship-to, and offers a local-only address box that is never saved. Since 2026-08-25 checkout writes a stop, and since #301 that stop carries its order — so for every new order this mode is a second, thinner view of a stop the date mode already shows. **Measured: Test Dave's has 27 delivery/install orders with no stop** (all predating the checkout stop writer); LAWNS has none. **Retire it, or convert it to a window of stops** — David's call; converting would drop those 27 pre-stop orders from the route. **Trigger:** the next change to the route page.

## #278 — 🟡 A BOARD'S SELF-REPORTED DENOMINATOR IS A SECOND COPY OF A DERIVED NUMBER (NEW 2026-09-11, FILED NOT BUILT)

Every owner-test board carries a header claim — `**Board: 0 of 17 covered** (15 owed · 2 needs-test)` —
and **`owner-tests.html` already derives exactly those numbers by parsing the cards.** Two
representations of one fact, and the hand-written one is the copy that goes stale (**STD-011**).

**MEASURED 2026-09-11 across all 36 boards:** 21 state a count, 15 state none, and **two of the 21
were wrong** — `authority-model` claimed *0 of 33* against **36** actual cards (the module OFF-switch
surface added CARDS 34–36 under ledger #212 and the claim was not bumped), and `operations-calendar`
claimed *0 of 15* against **16**. ⚠️ **`authority-model`'s breakdown was stale in the same sentence**:
it named cards 22 and 30 as the `needs-test` pair when 13 and 36 are also `needs-test`.

🔴 **NEITHER WAS A FALSE PROOF — both claimed 0 covered and both HAD 0 covered.** The numerator, the
one that would lie about work David has done, was right in both. It is the DENOMINATOR that drifted,
which is the benign direction and is exactly why nobody noticed for weeks.

**THE DURABLE FIX IS DELETION, NOT MAINTENANCE.** Remove the hand-written `Board: X of Y` claims and
let the renderer print the count it already computes. A number maintained in two places is a number
that will disagree again; the header's job is to say what the board is FOR.

⚠️ **FILED, DELIBERATELY NOT BUILT (David, 2026-09-11).** The two stale headers were bumped in place
that day — mechanical, no card, status or `LAST-PROVEN` touched — and the class was left standing.
**Both halves need deciding together:** where the derived count renders for a reader who opens the
`.md` rather than the page, and whether the 15 boards that state no count should gain one or the
other 21 should lose theirs. That is a call about the boards' shape, not a repair.

✏️ **SAME CLASS AS #73 AND #185** — a hand-maintained declaration nobody re-derives. It differs from
both in being *checkable*: the cards are right there beside the claim, which is how this was caught.


---

## #279 — 🟡 `customer_addresses.line2` IS A LIVE COLUMN NO SURFACE WRITES, BY DECISION (NEW 2026-09-11, ledger #303)

`20260911b_customer_addresses.sql` creates `line2` on David's explicit instruction — *"🔴 present
from day one"* — because the QuickBooks importer does not read `BillAddr.Line2` (**tech-debt #254**),
where **456 values sit and 453 are real streets**. When that fix lands the book needs somewhere to
put them.

🔴 **AND NOTHING CAN PUT A VALUE IN IT TODAY, WHICH IS ALSO BY DECISION.** `deliveries` has
`address_line1 / city / state / zip` and **no `address_line2`** (`20260620_deliveries.sql:30`). So a
`line2` typed into the book could not be snapshotted onto a stop — it would vanish silently between
the picker and the truck. Rather than ship a field that loses what you type, **no surface offers it**:
`SITE_ADDRESS_FIELDS` names four parts, `planSaveSite` writes `line2: null` unconditionally, and
`customerAddresses.test.ts` A9 plus `shipToSurfaces.test.ts` B6 hold both ends.

⚠️ **THIS IS #267's SHAPE AND IT IS FILED RATHER THAN HIDDEN.** `orders.install_date` is a live
column nothing has ever written or read, and that is the class this joins. **The one difference that
matters:** #267 was declared with no plan and no owner, while this column is declared BECAUSE a named,
filed defect will fill it. If #254 is closed or abandoned without this being revisited, `line2`
becomes #267 exactly — same column, same silence — so this entry exists to make that visible.

**THE FIX, WHEN IT COMES, IS TWO DECISIONS AND NEITHER IS THIS BUILD'S:**
① does `deliveries` gain an `address_line2`? That migrates the four-field ship-to surface #301 landed
the same day — `SHIP_TO_FIELDS`, `<StopCard>`, the route's Maps link, the `delivery.ship_to_changed`
audit row — and it would put a write against an unapplied column on a surface that works today.
② or does the importer fold Line2 into Line1 on the way in, so the book never holds a fifth part?

**Adding a fifth address column to `deliveries` inside a build about a new table is the scope creep
that makes a diff unreviewable** — which is the reason it was not taken, stated rather than assumed.

---

## #280 — 🔴 THE CLOSE-OUT GATES ACCEPT "PUSHED" AS SHIPPED: NEITHER ANCESTRY OF `origin/main` NOR A **PRODUCTION** DEPLOYMENT IS ASSERTED ANYWHERE (NEW 2026-09-12, ledger #303)

✏️ **PARTIAL 2026-09-14 (ledger #321) — ② IS NOW OBSERVABLE. IT IS STILL NOT ASSERTED, AND THE DIFFERENCE IS THE WHOLE POINT OF THIS NOTE.**

**What changed.** The deployed bundle now carries its **deployment target**, not only its SHA. `vite.config.ts` bakes `VERCEL_ENV` and `VERCEL_GIT_COMMIT_REF` into `__DEPLOY_ENV__` / `__DEPLOY_REF__`; `src/lib/deployStamp.ts` turns them into a label; `<VersionStamp>` renders it on every screen for every user. The stamp reads **`built <time> · <sha> · prod`** on production and shouts an amber **`PREVIEW <branch>`** otherwise. **GATE 0 on all 40 owner-test boards now says the last token must read `prod`.**

🔴 **THIS ROW SAID ② WAS *"not checkable from the repo — nothing we own reads Vercel"*, AND THAT REMAINS TRUE.** Nothing we own reads Vercel *now either*. What changed is that **nothing has to**: Vercel sets those variables at BUILD time, so the answer is **baked into the artefact** and read off the screen — which is where David is standing when GATE 0 fires. **That is a different fix from the one this row imagined, and it is deliberately the weaker one:** a human at a screen can now SEE the target; **no cap ASSERTS it**, and the close-out gates still accept "pushed". ⚠️ **So the DEPLOYED bar is still not mechanically guarded. Do not read this as closed.**

✅ **① RESOLVED 2026-09-14 (ledger #323) — `scripts/verify-main-ancestry.mjs`, IN `npm run verify`.** **Clause A: local `main` must not be ahead of `origin/main`** — every commit on local main must be an ancestor of it. That is the incident below, and it is the mechanical form of **CORE MANDATE rule 9** (*commit → push are ONE action*) for the shared trunk. **Clause B: a close-out row claiming "MERGED TO `main`" must cite at least ONE commit that IS an ancestor of `origin/main`** — #303's shape. 🔴 **PROVEN RED AGAINST A REAL COMMIT, NOT A FAKE** (David's instruction): an empty commit was made on local `main`, the check refused by name — *"local `main` is AHEAD of `origin/main` by 1 commit(s) — they exist only on this machine"*, exit 1 — and `main` was then restored. **11 probes both directions**, P1 the real defect verbatim, P9 *cannot-look ≠ nothing-wrong*, P10/P11 a population negative control. ⚠️ **CLAUSE B IS "AT LEAST ONE", NOT "ALL", AND THAT WAS MEASURED BEFORE IT SHIPPED:** requiring every cited SHA to be an ancestor reports **8 failures across 27 SHAs** on today's corpus and **none is a defect** — `13d64aa` is a pre-rebase SHA the breakpoint board keeps DELIBERATELY (*"a proof records what was RUN"*), and rows cite base commits legitimately. **A cap arriving red with 8 rebase artefacts is a cap people switch off** (#73). Measured at "at least one": **0 failures**. ⚠️ **SCOPE, STATED: clause A asserts `main` ONLY.** An unpushed feature branch is often correct mid-build (R-149 pushes reservations early); an unpushed `main` is invisible to everyone else. 🔴 **AND CLAUSE B FIRED ON ITS OWN AUTHOR WITHIN THE HOUR — #146's CLASS, AND THE FIX WAS MEASURED TWICE.** The first matcher was `/MERGED TO \`main\`/i`, and the very next row written — **#323's, which DESCRIBES the clause** (*a row claiming "MERGED TO `main`" must cite…*) — was reported as a false violation. **A checker matching prose that EXPLAINS the thing rather than IS it.** ⚠️ **The obvious fix, "require the claim to be BOLD", was measured and was WORSE: it cleared the false positive and silently dropped TWO REAL CLAIMS** — #312 (*"`ac6d0ce`, merged to `main`, 11:59 CDT"*) and #249 — both lowercase and unbolded. **Trading one false POSITIVE for two false NEGATIVES is the wrong direction for a gate: a noisy cap gets argued with, a blind one gets believed.** ✅ **The discriminator is the QUOTE** — a row MAKING the claim states it, a row EXPLAINING it quotes it. Measured: **8 real claims matched, the describing row excluded.** **P12** (the false positive) and **P14** (an unbolded real claim) hold both ends, permanently. ✏️ **Third self-inflicted finding this week, and the pattern is worth naming: describing a defect is a reliable way to commit it** — the unescaped `\|` written inside the sentence about unescaped pipes (#294a), the self-test asserting an escape JS had already eaten, and this. 🔴 **② IS UNCHANGED AND THIS ROW STAYS 🟡 PARTIAL — nothing here reads Vercel.**

🔴 **① IS STILL OWED, STILL CHEAP, AND ON 2026-09-14 IT DREW BLOOD — MINE (David's instruction to record it here).**

**The incident, in full, because it is the argument.** This session merged ledger **#320** into `main` and **reported it merged**. The merge commit `a0c957b` existed; `git merge` printed its diffstat; the working tree was correct. **`origin/main` was still at `ba7edcf`.** The merge had gone into **local** `main` and was never pushed — and the session then branched off local `main`, so the merge lived on **in that branch's ancestry**, where every subsequent command saw it and agreed it was there. **It was found ~40 minutes later, by running `merge-base --is-ancestor` by hand during a final check, and only because that check happened to be run.**

🔴 **NOTE WHAT DID NOT CATCH IT.** Not `git status` (clean). Not the test suite (green). Not `npm run verify` (exit 0). Not `verify-handoff-retention`, **including the check built THIS SESSION to assert that every ledger row has a §3 entry** — the row and the entry were both present, both correct, and both unpushed. **Every gate we own passed on a merge that had not happened anywhere but this machine.** That is this row's sentence — *the close-out gates accept "pushed" as shipped* — with *"pushed"* itself turning out to be the optimistic reading.

✏️ **AND IT IS THE THIRD TIME THIS FAMILY HAS BEEN RECORDED IN THIS REPO: #60** (a build that never deployed, live ~20h later as a side effect of an unrelated push), **#282** (a push that named the ref it meant and published a branch containing none of the work), and now a merge that named the branch it meant and published nothing. **Three different mechanisms, one shape: the command succeeded, said so, and the state did not change where it matters.**

**The fix has not changed and is three lines.** At close-out, for the SHA the row claims: `git merge-base --is-ancestor <sha> origin/main` — **after** a `git fetch`, because the whole failure mode is a stale local view of `origin`. ⚠️ **It must read `origin/main`, never local `main`** — local `main` is exactly what was wrong here, and a check that consults it would have passed too. **It is free, it is mechanical, it needs no network beyond the fetch, and nothing about it was hard.** The only reason it does not exist is that nobody has written it.

**② remains the genuinely hard half** and is unchanged: no cap can assert a production deployment without reading Vercel. ✅ **What ledger #321 did is make ② *observable* — see the PARTIAL note above — and it does not touch ①.**

**① is satisfied for one row, not asserted either.** Ledger **#320** was merged to `main` 2026-09-14, so `git merge-base --is-ancestor` passes for it — **by someone running the command, not by a gate.** Asserting ① is cheap and is still owed; asserting ② needs something that reads Vercel, and that has not changed.

**Why the weaker fix was taken anyway.** The incident in this row is *#303 recorded complete with only Preview deploys* — a preview and a production deploy of the SAME COMMIT were **indistinguishable in the app**. The SHA matched, GATE 0 passed, and the screen was not evidence. **That specific confusion is now impossible to have silently**, which is the part that was costing observations. ✏️ **The campaign-lifecycle board had already written the instruction by hand** — *"Confirm the SHA you are looking at is a PRODUCTION deploy of the code you mean, not a Preview of a branch"* — **with no way for anyone to carry it out.** That is [[R-26]]'s shape, and it is why the stamp was built rather than another note.


**The instance, measured 2026-09-12.** `fc94309` (ledger **#303**, the ship-to address book) and
`d48000c` (ledger **#261**) sit on `fix/pmi-suggest-auth`. `origin/main` is `ea9a047` and **has not
moved since the branch diverged** — the merge-base IS `origin/main`, so a merge would be a pure
fast-forward and **not one of those commits is an ancestor of `main`.** Production is still
`ea9a047`; every Vercel deployment for that branch is a **Preview**. The ledger row for #303 carries
`fc94309` and the bar **BUILDER-COMPLETE**, and every word of that is literally true. It reads as
shipped. It is not shipped.

🔴 **AND THE GATES ARE NOT BROKEN — THEY WERE NEVER WRITTEN TO ASK.** Quoted, not paraphrased:

- CLAUDE.md §9 → *"**BUILDER-COMPLETE (Thunder):** code works, builds pass, `npm run verify` exit 0
  zero net-new, **committed**."*
- CLAUDE.md §9 → *"**DEPLOYED (Thunder):** **pushed to origin** AND **Vercel-deployed** AND the
  new-code signal is visible in-app."*
- CLAUDE.md §1 rule 9 → *"Every `git commit` is IMMEDIATELY followed by `git push` to origin — never
  leave a commit sitting unpushed."*

**Not one of those three names a BRANCH, and not one names an ENVIRONMENT.** A push to *any* branch
satisfies "pushed to origin." Vercel builds a Preview for *every* branch, so "Vercel-deployed" is
satisfied by a deployment **no customer can reach**. The `[TRACE:*]` signal is visible in-app — on
the preview URL. Every clause passes, honestly, on work that never left a feature branch.

✅ **WHAT CAUGHT IT WAS THE OWNER-TEST BOARD'S GATE 0, AND IT IS THE ONLY CLAUSE IN THE CORPUS THAT
NAMES `origin/main`:** *"Match it to `git log --oneline origin/main -1` — **not to a SHA written in
this file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
stamp."* 🔴 **That clause fires at OWNER-PROVE time — after close-out, on David, at a screen.** The
gate that is supposed to stop an unshipped build from being recorded as finished let it through, and
the check that caught it runs on the human, hours later, and only because he happened to run it.

**THE FIX IS TWO ASSERTIONS, AND THEY ARE DIFFERENT IN KIND:**

① **`git merge-base --is-ancestor <sha> origin/main`** — exit 0, or the row is not DEPLOYED. This is
mechanical, free, needs no credential, and could run inside `npm run verify` or a close-out script
today. It is also the assertion that would have caught this exact instance **at close-out**.

② **a deployment of that SHA serving PRODUCTION, not Preview.**

✏️ **CORRECTED 2026-09-12, SAME DAY, BY MEASUREMENT — THIS CLAUSE FIRST READ *"NOT checkable from the
repo — nothing we own reads Vercel"* AND THAT WAS WRONG TWICE.** It was written without checking, inside
an entry about gates that fail to check — **[[R-26]]'s shape in this very filing**, which is why it is
corrected in place rather than quietly. What is actually true:

- **`/usr/local/bin/vercel` v54.1.0 IS installed** and `.vercel/project.json` links this repo to project
  **`cultivar-os`** (`prj_gQmtNobRXSzZ42ax8mVbhMXNreG8`). ⚠️ Unauthenticated in a headless session —
  `vercel whoami` hangs with no prompt available — so the deployment **`target`** field was still never read.
- 🔴 **AND THE USEFUL CHECK NEEDS NO CREDENTIAL AT ALL.** `curl https://cultivar-os.app/`, follow the
  `/assets/index-*.js`, grep for the SHA. Measured on `fe24e68` minutes after the merge: the bundle carries
  **`built 2026-09-12T15:08:39.580Z · fe24e68`**, and the five predecessor SHAs return **zero** occurrences.
  That is **GATE 0 run mechanically, from a script, in one command** — the check this entry said did not exist.

⚠️ **THE RESIDUAL IS REAL AND SMALLER THAN THE ORIGINAL CLAIM: reading the apex proves THE PRODUCTION ALIAS
SERVES THAT SHA. It does not read Vercel's `target` field.** Those are two sentences and only the first is
measured. For the defect this entry is about — *work recorded as shipped that no customer can reach* — the
first sentence is the one that matters, and it is now cheap. **Assuming ① implies ② is still the next
version of this defect; ② is just no longer unbuildable.

⚠️ **THE SHA STAMP DOES NOT CLOSE THIS *BY ITSELF*, AND THE DISTINCTION IS THE WHOLE VALUE — IT IS
**WHERE YOU READ THE STAMP**, NOT THE STAMP.** OP-15's mechanical form (`built <time> · <sha>` in the footer) proves *what the bundle you are
looking at was built from* — and a **Preview URL carries the stamp too**. A matching SHA read on a
preview deployment proves the build succeeded and proves nothing about production. The stamp answers
*"am I testing the code I think I am?"*; **read on the PRODUCTION APEX it also answers *"is this code
shipped?"***, which is what makes ② mechanical. GATE 0's `origin/main` clause is what bridges the two —
and it lives on one board per capability rather than in the gate, which is the placement defect this
entry is really about.

**CLASS.** This is **tech-debt #60**'s family one layer further out. #60: *Vercel deploys the TREE,
not the COMMIT, and a failed build is silent* — the commit was on `main` and the build died. Here
the build **succeeded** and the commit was **never on `main`**. Both present identically: a green
close-out, a working preview, and an app in production that is not what the record says it is.

**BLAST RADIUS — MEASURED, AND IT IS ONE ROW.** Every SHA cited in `docs/CLOSE-OUT-LEDGER.md` was
checked for `origin/main` ancestry on 2026-09-12. Three came back off-main and **only `fc94309` is a
real instance**: `5fc41e4` is `origin/assets` (Andrew's branch, deliberately unmerged and recorded as
such), and `4f8c5bb` is #281's **pre-amend** SHA cited in its own footnote — the amended `4cc26e7`
IS on `main`. So this is a gap that has been open the whole time and has been hit once. It is filed
now, while it is one row, rather than after it is a pattern.

**NOT FIXED IN THIS PASS, AND THE REASON IS STATED:** ① is a change to the close-out gate text in
three files (CLAUDE.md §9, `docs/operating-doctrine/end-of-session-protocol.md`, and whatever script
hosts it) plus a new check; ② is a decision about whether we take a Vercel credential into the repo
at all. **Both are David's calls, and the merge of `fix/pmi-suggest-auth` is a separate decision he
has explicitly reserved.**

---

## #281 — 🟡 FOUR LEDGERS ON ONE BRANCH, NAMED FOR THE SECOND OF THEM — AND NOTHING ANYWHERE ASKS WHAT BRANCH WORK BELONGS ON (NEW 2026-09-12, ledgers #302 · #261 · #303)

**The instance, measured.** `fix/pmi-suggest-auth`, six commits, **four** bodies of work:

| Order | SHA | Ledger |
|---|---|---|
| 1 | `db299ff` | **#302** — docs, the ledger row that id never had |
| 2 | `91b8ef1` | **#261** — `/api/pmi/suggest` auth |
| 3 | `fc94309` | **#303** — `customer_addresses`, code + migration |
| 4 | `4d0fb68` | **#303** — fill the close-out SHA |
| 5 | `d48000c` | **#261** — the gate's proof |
| 6 | `fe24e68` | **tech-debt #280** |

🔴 **THE BRANCH IS NOT NAMED FOR ITS FIRST COMMIT, ITS LARGEST COMMIT, OR ITS LAST.** `git reflog show
fix/pmi-suggest-auth` ends `ea9a047 …@{5}: branch: Created from HEAD` — an unnamed working branch whose
**first** commit was #302 and which was named, mid-stream, after its **second** body of work. #261's two
commits then sit either side of #303's two. **Nobody could tell from the name, and the undercount proves
it:** the ask that surfaced this said *"two unrelated bodies of work appear to be sharing one branch" —
and there were three.*

**THE RULE WANTED: one branch per ledger, named for it. THE FINDING: nothing asks.** Quoted, not
paraphrased, across every gate that fires around a build:

- **§10 SESSION STARTER** — ten numbered confirmations (*story · shared modules · PLATFORM_STATE level ·
  built-inventory date · inventory-doc dates · verify-before-build · STD-003 · story reconciliation ·
  LAWNS discovery · RULINGS*), closing *"Do not start until you confirm all ten."* **Not one names a branch.**
- **§1.6 BUILD-SPEC PRE-FLIGHT GATE** — eleven items reconciled before a spec fires. **Not one names a branch.**
- **§9 close sequence** — step 3 is *"`git add CLAUDE.md && git commit && git push`"*. No branch.
- **§2 SESSION HEALTH CHECK** — the one place it appears: *"`git branch --show-current` # 2. Confirm branch
  (main or feature branch **as appropriate**)"*. 🔴 **"As appropriate" IS the rule, and it has no referent.**
  It asks you to *look at* the branch. It never asks *what belongs on it*, so every answer is correct.

**WHAT IT COST — TWO THINGS, ONE OF THEM LUCK.**
① **#302 and #303 cannot be separated.** They overlap on four files — `TRACE-SESSION-BOOTSTRAP.md`,
`CLOSE-OUT-LEDGER.md`, `built-inventory.md`, `tech-debt-log.md` — so a merge decision that should have been
three independent calls collapsed into one all-or-nothing. ② **#261 *was* cleanly separable** (zero file
overlap with #303's commits) — **and that was luck, not design**: an auth fix and an address book happened
not to touch the same files. The next pair will not be so obliging.
⚠️ **A third, quieter one:** `CLOSE-OUT-LEDGER.md`'s SHA column assumes **one commit per row**. #303 is two
(`fc94309` + `4d0fb68`) and the row cites one — so the record of what a ledger *is* was already lossy before
any branch question arose.

**THE FIX — THREE LENSES, NEED → WANT (OP-8). None taken; all three are David's gate text.**
- **NEED (prose only, no code).** Give §2's *"as appropriate"* a referent: **a branch carries ONE ledger and
  is named for it.** Turns an unfalsifiable instruction into a checkable claim. Costs nothing and would have
  made this branch visibly wrong at commit 2.
- **MIDDLE (mechanical, free).** A close-out assertion: every commit since the merge-base cites the same
  ledger id. `git log --format=%s origin/main.. | grep -oE '#[0-9]+' | sort -u` must yield exactly one.
  🔴 **It would have flagged this branch at the FIRST off-ledger commit**, not after the sixth.
- **WANT (the question answered before it can be got wrong).** STEP 0 mints the branch: a build claiming
  ledger #NNN starts on a branch named for #NNN. Nothing to audit afterwards, because the name is issued
  with the id.

⚠️ **RELATIONSHIP TO #280, STATED SO NEITHER SWALLOWS THE OTHER.** **#280 is *"the close-out gate cannot
tell PUSHED from SHIPPED"*** — a question about `main` and about *production*, fixed by two assertions **at
close**. **This is *"nothing says what a branch is FOR"*** — a question about **build start**, fixed at
**STEP 0**. They met in one incident and they **close independently**, which is why this is its own id and
not a clause under #280. The MIDDLE option above and #280's ① want the same host — a close-out check script
that **does not exist yet** — so filing both against one future build is the likely shape, and that is
David's call, not this entry's.

---

## #282 — ✅ **RESOLVED 2026-09-14 (ledger #324, [[R-154]], CLAUDE.md §6 r20) — DAVID ADOPTED THE RULE AND ANSWERED THE OBJECTION THAT HAD HELD IT A PROPOSAL.** WAS: 🔴 TWO SESSIONS, ONE WORKING TREE: THE BRANCH CAN CHANGE UNDER A SESSION BETWEEN THE COMMIT IT PLANNED AND THE COMMIT IT MAKES (NEW 2026-09-12, ledger #304)

**THE RULE AS ADOPTED, verbatim:** *a session that will commit works in its own git worktree, never
the shared checkout. The shared checkout is DAVID'S — his uncommitted work, kept on `main`, pulled
after every merge. No session commits from it.*

🔴 **THE OBJECTION THIS ENTRY RECORDED IS THE ONE THAT KEPT THE RULE A PROPOSAL, AND IT IS ANSWERED BY
THE SECOND SENTENCE RATHER THAN WORKED AROUND.** Below, this entry asks what happens to David's own
uncommitted edits in the shared tree. **The answer: they stay, and they are the only thing there.**
One tree, one writer. The collision is **REMOVED, not relocated**, because the two populations are
separated instead of interleaved — his uncommitted work in the shared checkout, every session's
committed work in its own worktree.

⚠️ **THE COST IS CARRIED IN THE RULE'S OWN TEXT, not left for the session that discovers it: a session
CANNOT READ DAVID'S UNCOMMITTED WORK.** A worktree is a different directory and his in-flight edits are
not reachable from it. **He commits them or he hands them over — there is no third option**, and a
session that needs them ASKS rather than reaches. **The property that stops a session's commit landing
in his tree is the same property that stops it reading his tree.** Paid deliberately.

⚠️ **STILL UNGUARDED — this entry's *"nothing would enforce it"* is CORRECT and survives adoption.**
No cap reads which directory a session is in; one asserting the cause would have to know which
checkout is the shared one, and that is per-machine state (`.claude/` is gitignored for exactly that
reason). The nearest mechanical check remains this entry's own — `git branch --show-current` at the
commit instant — and it catches the SYMPTOM. **The rule says so out loud rather than implying a guard
it does not have.**

✅ **THE PRACTICE HAD ALREADY RUN AHEAD OF THE RULE, which is why adopting it costs nothing:**
`git worktree list` on 2026-09-14 shows **17 worktrees**, nearly all in session scratchpads —
including the two this entry names. **What was missing was the sentence, not the behaviour.** Ledger
**#311** is the same lesson inverted: an accidental `git add -A` in a shared checkout three sessions
were using staged a **27MB registered worktree**, caught before any push.

⚠️ **THE FAMILY IS NOT CLOSED — this resolves the COMMIT INSTANT only.** **#281** (build start —
*what is this branch for?*) and **#280** (close-out — *did it reach `main` and production?*) remain
open. The rule helps both, since one worktree per branch makes *one ledger id per branch* the natural
shape — **but neither is asserted by it, and neither should be marked resolved on its strength.**

**The original entry is preserved below, unedited.**

---


**The occurrence, measured.** While ledger **#304** was being built, another session switched the
shared checkout from `fix/stop-site-offer-unmount` to `feat/breakpoint-vocabulary`. The #304 commit
(`9fd1d15`) landed on **that** branch. The push then named the ref it *meant* —
`git push origin fix/stop-site-offer-unmount` — which was still sitting at `fe24e68`, so it
**published a branch containing none of the work.**

🔴 **AND THE TELL WAS INVERTED: EVERYTHING REPORTED SUCCESS.** The push exited 0. Git printed
`* [new branch] fix/stop-site-offer-unmount -> fix/stop-site-offer-unmount`. The verification block
printed `fe24e68` on both sides — *and that is the shape of a correct fast-forward*. Only reading the
two SHAs against the commit that was supposed to be there showed it. **A push that succeeds is not a
push that shipped** — **#280**'s sentence, one layer further in: there the commit was on a branch and
not on `main`; here it was not even on the branch its own push named.

⚠️ **THE REPAIR WAS CLEAN BY LUCK, NOT BY DESIGN, AND THE LUCK SHOULD BE NAMED.**
`feat/breakpoint-vocabulary` was **local-only, unpushed, and sitting at the same `fe24e68` with zero
commits of its own** — so restoring it was `git branch -f` and nothing was lost. Had it carried a
single commit, un-picking one session's commit from another's branch would have been a merge
decision taken under time pressure, on a tree both sessions were still writing to.

**WHY #281's MIDDLE CHECK DOES NOT CATCH THIS.** That check reads: *every commit since the merge-base
cites the same ledger id* — `git log --format=%s origin/main.. | grep -oE '#[0-9]+' | sort -u` must
yield exactly one. 🔴 **A commit landing ALONE on a branch has nothing to disagree with.** One
commit, one id, the check passes, and the branch is still the wrong one. It was in fact run against
the #304 branch and returned `#304` — correct, and blind to the defect.

**THE CHECK THAT WOULD: CONFIRM THE CURRENT BRANCH IMMEDIATELY BEFORE COMMITTING** —
`git branch --show-current`, compared against the branch the session *intended*, at the moment of the
commit rather than at the start of the session. The failure here was a session trusting a branch it
had set an hour earlier, in a tree it does not own alone.

⚠️ **A SECOND SYMPTOM OF THE SAME CAUSE — THE GATE MEASURES THE TREE, NOT YOUR DIFF.** `npm run
verify` in the shared checkout ran across another session's in-flight edits to `OperationsCalendar.tsx`,
`ReceiptKeeper.tsx`, `TileGrid.tsx`, `design-system/tokens.ts` and an untracked `packages/shared/src/hooks/`.
So **"exit 0, zero net-new" was a statement about a tree nobody owns**, and neither session could
attribute it to their own work. That is real and it is structural.

✏️ **CORRECTION TO THE INSTANCE CITED WHEN THIS WAS FILED, AND IT MATTERS BECAUSE THE ENTRY WOULD
OTHERWISE CARRY A FALSE EXAMPLE.** The `tsc 5→6` / `eslint 244→245` movement observed during #304 was
**measured to THIS session's own file, both times** — `stopOfferMount.test.ts(33,23): error TS7016:
Could not find a declaration file for module 'jsdom'` and `stopOfferMount.test.ts 181:1
@typescript-eslint/no-floating-promises`. Both name the file by path. After `@types/jsdom` was
installed and the IIFE was voided, the gate read **5/5 and 244/244 with every other session's file
still present in the tree.** So that particular movement was **not** cross-session contamination —
the mechanism above is real, and this is not its example. If a *different* run showed the same
numbers move, those numbers need re-measuring before they are cited, rather than inheriting this one's
explanation ([[R-26]]).

**THE PROPOSED RULE — RECORDED AS A PROPOSAL, DELIBERATELY NOT BUILT (David, 2026-09-12).** ✅ **ADOPTED 2026-09-14 — see the resolution above; it is now CLAUDE.md §6 r20 and [[R-154]].**
> *A session that will commit works in its own worktree, not the shared checkout.*

**Precedent, measured today rather than asserted:** `git worktree list` shows two worktrees created by
one session on 2026-09-12 — `wt-camp` (`feat/campaign-lifecycle`) and `wt-recon`
(`recon/campaigns-2026-09-12`) — taken by that session's **own judgement**, before any rule existed,
and both clean. ⚠️ **Ledger #305 has no row in `docs/CLOSE-OUT-LEDGER.md` yet** (grepped 2026-09-12),
so that close-out is still in flight; the evidence above is from the worktree list, not from the ledger.

**WHAT THE RULE DOES NOT YET ANSWER, so that adopting it is a decision and not a reflex:** it is a
workflow constraint, not code, and **nothing would enforce it** — which is the same shape as §2's
*"Confirm branch (main or feature branch as appropriate)"*, a rule with no referent (#281). A worktree
costs a full checkout (~1,200 files here). And 🔴 **the shared tree is also where DAVID works** — his
own uncommitted edits were sitting in it during this incident — so *"own worktree"* has to say what
happens to those, or it moves the collision rather than removing it. ✅ **ANSWERED 2026-09-14: the shared tree is DAVID'S ALONE — his uncommitted work stays, nothing else lives there, so nothing collides. The cost (a session cannot read that work) is now stated in the rule itself.**

**CLASS — THREE MOMENTS, ONE MISSING ASSERTION.** #281 is **build start** (*what is this branch
for?*). This is the **commit instant** (*which branch am I on right now?*). #280 is **close-out**
(*did it reach main and production?*). They are one family: **nothing in the corpus asserts where the
work is, at any of the three moments** — and each was found by a different failure within one day.

---

---

## #283 — ✅ **RESOLVED 2026-09-12 (ledger #307) — DAVID RULED, AND THE ANSWER WAS NEITHER OF THE TWO OPTIONS OFFERED.** §6 RULE 7 IS A BINDING CODING RULE AND THE COMPONENT IT DESCRIBES HAS NEVER BEHAVED THAT WAY (was NEW 2026-09-12, ledger #305; RENUMBERED #281 → #283 on 2026-09-12 — see the note at the foot)

**CLAUDE.md §6 r7, verbatim and in full:** *"Tile grid: desktop/tablet only (768px+)."*

**`TileGrid.tsx`, measured 2026-09-12 — the rule is wrong in BOTH of its two claims:**

1. **The number.** The grid has no 768 anywhere. It breaks at **640** and **1024** (Tailwind's `sm`
   and `lg`), and the file's history shows no 768 at any point.
2. **"desktop/tablet only."** The grid renders at **every** width — below 640 it is a **4-column**
   layout, which is the phone layout. It is not gated, hidden or suppressed on a narrow screen;
   the base rule outside any media query IS `repeat(4, 1fr)`.

🔴 **WHY THIS IS DEBT AND NOT A TYPO: A BINDING RULE WAS CITED AS EVIDENCE AND STEERED A DECISION.**
`OperationsCalendar.useIsNarrow` pinned itself at **767px** and justified the number in its own
comment as *"768px is the platform's existing desktop/tablet line (§6 r7, the tile grid)"* — a
citation of this rule, for a number the tile grid does not contain. That boundary then contradicted
the intent stated three lines above the control it governed (*"Arrows are the whole interface on a
phone **or the tablet in the yard**"*), so a portrait tablet at 768–834px got the dropdown the
comment says it should not have. **The rule did not merely sit there being wrong; it was read,
believed and built on.** This is [[R-26]]'s shape — a written declaration nobody checked against
reality, steering a decision — and it is the FIFTH comment-contradicts-its-own-repo finding in the
log's recent run (#61, #145, #180, #188, this).

**FIXED IN THIS PASS:** the false citation and the 767 boundary are gone (ledger #305); the calendar
now binds on the shared `wide` token, and `deviceDetector.test.ts` §E fails the build if any raw px
width appears in an `@media` again.

🔴 **NOT FIXED, AND DELIBERATELY NOT: THE RULE ITSELF.** §6 r7 is one of nineteen binding rules in
**David's** doc. Rewriting a rule in CLAUDE.md inside a hook refactor is exactly the drift the
close-out gates exist to catch, and the correction is not purely mechanical — **it needs David to
say which of two things he meant**, because they are different products:

- **(a) The rule is stale prose and the code is right** — the tile grid is responsive from 4 columns
  up, has always been, and r7 should read *"Tile grid: 4 / 6 / 8 columns at `compact` / `medium` /
  `wide` (`design-system/tokens`)"* — which also stops the number being retyped.
- **(b) The rule is INTENT and the code never met it** — tiles were meant to be a desk-and-tablet
  surface, and the 4-column phone layout is an unimplemented decision, not a feature. **On a mobile
  build this matters**: it decides whether the dashboard gets a phone treatment or a redirect.

⚠️ **This is live for the next pass, not academic.** The mobile work now queued reads §6 r7 to learn
what the dashboard does on a phone, and today the rule answers that question **wrongly and
confidently** — the same failure mode as the inventory doc that reported a function slot free at
12/12 (#178's class).


---

✅ **RESOLVED 2026-09-12 (ledger #307). DAVID'S RULING, AND IT CORRECTS THE QUESTION THIS ENTRY ASKED.**
The entry offered two readings — **(a)** stale prose, or **(b)** an intent the code never implemented.
**David: neither.** In his words: *"the tile grid was designed phone-first and carried over to
desktop; the 768px claim dates from the phone design and was never revisited when it moved."*

🔴 **THAT IS A THIRD SHAPE, AND IT IS THE MORE DANGEROUS ONE.** Under (a) the rule would have been
wrong from birth; under (b) the code would have been in debt to the rule. Under what actually
happened, **the rule was TRUE WHEN WRITTEN and was invalidated by a change that never came back to
it** — so there was no moment at which anyone was wrong, and nothing in the repo marked the text as
belonging to a superseded design. **A rule that was once true reads exactly like a rule that is
true**, which is why it was cited as evidence for a live boundary (ledger #305) rather than
questioned.

**FIXED:** §6 r7 now DESCRIBES the grid — 4 columns on a phone, 6 from 640, 8 from 1024, rendering
at every width — and **records the phone-first origin**, so the next reader learns why 768 was ever
there instead of rediscovering it. The `OperationsCalendar` comment that quoted the old text now
says the rule has been corrected, so it cannot be read as a live citation.

⚠️ **BEHAVIOUR UNCHANGED, DELIBERATELY, ON DAVID'S INSTRUCTION** — *"Describe, do not change
behaviour. The desktop grid layout is a separate decision David is taking up later."* Not a single
pixel of `TileGrid` moved in this pass, and r7 now says in its own text that it describes rather
than decides, so the 4/6/8 ladder cannot be mistaken for a ruling that the desktop layout is settled.

---

---

---

## #287 — 🔴 NOTHING ASSERTS THAT A BUILD'S RUNNABLE ARTIFACTS ARE IN THE TREE THE PERSON RUNNING THEM LOOKS AT (NEW 2026-09-12, ledger #310)

**David's words, and they are the general rule rather than a complaint about one file:** *"the rule is
not 'put migrations in the folder' — it is that anything I am expected to RUN lives at a path I can
find without being told."*

**The occurrence, measured.** `20260912_channels_one_vocabulary.sql` was written to
`supabase/migrations/` — **the correct path** — inside a scratchpad worktree, and committed to an
unmerged branch. David's checkout is detached at a commit that predates the branch, so in **his** tree
the file did not exist. The close-out said *"Migration in supabase/migrations as a file"* and was
**true of a tree he was not in.** 🔴 **THE PATH WAS RIGHT AND THE TREE WAS WRONG, and every report
said the path.**

🔴 **THIRD INSTANCE OF ONE SHAPE IN ONE AFTERNOON, WHICH IS WHY IT IS A CLASS AND NOT A SLIP:**

| | What was asserted | Where it was true | Where David was |
|---|---|---|---|
| the owner-test board | *"12 cards, rendered by `owner-tests.html`"* | `origin/main` | a checkout 7 commits behind — the page was blank |
| `verify-owner-test-boards` | **`✅ every board on disk is reachable`** · 37/37 | his stale tree, internally consistent | the same tree — the cap **cannot see** staleness, so it went green while the page was blank |
| this migration | *"in `supabase/migrations` as a file"* | a scratchpad worktree + an unmerged branch | his tree, where the folder had no such file |

**The common form: a claim about a PATH, made without asserting the TREE.** All three reported success,
because each was measured where the work was rather than where the person is.

**WHAT THE EXISTING CAPS DO AND DO NOT DO.** #309's `verify-id-sweep` and the board cap's new
`[branch @ sha]` stamp fixed the *reporting* half — output now says which tree it describes.
**Neither asserts that a runnable artifact has REACHED the reader's tree**, and nothing can from inside
a worktree: the builder's tree is the only one it can see.

**THE SHAPE OF A FIX, NOT A FIX (filed, not built).** Three candidates, none costed:
  **(a)** a close-out gate listing every runnable artifact a build produced (migration, rollback,
      script) and asserting each is an **ancestor of `origin/main`** rather than merely committed
      somewhere — **#280's clause ① applied to files instead of to the build**;
  **(b)** the inverse, and cheaper: a build that produces a runnable artifact **states the ref** the
      reader must be on, so *"it is in `supabase/migrations`"* is never said without *"on `<ref>`"*;
  **(c)** hand the artifact over by CONTENT rather than by path — a close-out that pastes the SQL
      cannot be wrong about where the file is.
✅ **THE BOUNDARY IS RULED — [[R-153]], 2026-09-12, and it closes the half this entry called owed.**
*If David runs it, it is a file at a path in HIS tree and the handover names the ref. If Thunder runs it,
or it is a few lines pasted into the SQL editor, it comes inline.* In his words: *"A migration is a file
I apply as a file. A three-line discovery SELECT is text I paste. The rollback is a file I would run
under pressure — so it is a file."* CARD 5 and CARD 6 pointed at *"the verification queries at the foot
of the migration file"* and are fixed to paste; CARD 4 legitimately points at a file and now names the
ref.

🔴 **WHAT REMAINS OPEN IS THE MECHANICAL HALF, AND IT IS R-153's SECOND CLAUSE: *never state a path
without the ref.*** *"'It is in supabase/migrations' is not a location. Every report that misled me
today had a true path and a missing ref."* **Nothing asserts that.** A close-out can still name a path
with no ref and every cap will pass — which is exactly how all three of today's instances reported
success. That is this entry's remaining scope.

**Blast radius: every build that has ever handed over a file to run.** Not measured. The three
instances above are one afternoon's worth, and **all three were found by David, not by anything we
own.**

## #284 — ✅ **RESOLVED 2026-09-12 (ledger #309) — MINTED AS R-148 + R-149, AND BOTH PROPOSALS BUILT.** THE ID-CLAIM RULE EXISTED, WAS UNNUMBERED, DISQUALIFIED ITSELF IN ITS OWN TEXT, AND LIVED IN THE ONE FILE THAT IS NO LONGER READ IN FULL (was NEW 2026-09-12, ledger #307)

**SIX COLLISIONS IN 24 HOURS, ALL ONE MECHANISM: THE CLAIM IS MADE WHERE THE NEXT SESSION DOES NOT LOOK.**
Every one of them was made by a session doing the right thing.

| # | id | Who | Measured |
|---|---|---|---|
| 1 | `#302` | a session later overwritten and restored | the id survived in `open-questions.md` while the rows backing it did not — **half-claimed: visible to the next reader, backed by nothing** |
| 2 | `#302` | — | the ledger row it never had; filed late as its own `⏳` row |
| 3 | `#304` | `fix/stop-site-offer-unmount` | `9fd1d15`, **12:52:10** — claimed in a **commit subject**, no ledger row |
| 4 | `#304` | `recon/campaigns-2026-09-12` | `161e7a6`, **12:56:45** — **4m35s later**, and this one holds the only `#304` ledger ROW |
| 5 | `#305` | `feat/breakpoint-vocabulary` | found TAKEN by the `feat/campaign-lifecycle` sweep, which moved to `#306` — **a collision AVOIDED, and only because that session swept all branches** |
| 6 | `#281` | `docs/tech-debt-281-branch-hygiene` vs `feat/breakpoint-vocabulary` | `9cb27ca` **10:13** vs `13d64aa` **13:00** — **2h47m apart, both live**; found by this session's sweep and renumbered to `#283` under clause (4) |

🔴 **#3 AND #4 PRODUCED A LANDED CONTRADICTION, WHICH IS THE SHARPEST EVIDENCE HERE.** The commit
that reached `origin/main` (`eb4aad6`, the save-a-site fix) claims `#304`, and **`main` holds no
`#304` ledger row at all** — the only one in existence is on `recon/campaigns-2026-09-12` and
describes *a campaign recon at LAWNS for Texas Arbor Day*. So the history says `#304` is one thing
and the ledger says it is another, **and neither record is wrong on its own terms.**

### ① THE RULE EXISTS AND HAS NEVER BEEN MINTED

`docs/RULINGS.md:272`, plus the OWED row *"A LEDGER ID CANNOT BE CLAIMED ATOMICALLY"*. Both sit in
the **"DRAFTED FOR DAVID, NOT FILED"** block, unnumbered since **2026-09-02**. The rule is complete
— claim at file time verified against `main` · **NEVER LEAVE A GAP** (an abandoned id filed
*withdrawn, with its reason*) · **the LATER claim renumbers at merge** · a prompt naming an id is a
DESCRIPTION · an `OWED` row carries no number.

🔴 **AND IT DISQUALIFIES ITSELF IN ITS OWN TEXT.** The block says it is *"deliberately NOT written
into the table above as a ruling in his voice… held here until he numbers them."* **A reader who
reaches it is told it is a proposal.** Nothing in any close-out gate says to follow it, so the
correct behaviour for a session that FINDS it is to note it and move on — which is what has
happened for ten days.

### ② ITS ONLY HOME IS NOW READ BY KEYWORD

`CLAUDE.md` §10 step 10 says `RULINGS.md` is read **IN FULL, every session** because *"it is
deliberately short enough that reading it is free."* That stopped being true: the 2026-09-04
drafted row (ledger #274) records David's own instruction — *"330KB read every session is OP-13's
tax in the file OP-13 pointed at. Grep for what you need."*

🔴 **SO THE RULE'S ONE HOME IS A FILE NOW SEARCHED BY KEYWORD, AND YOU ONLY GREP FOR AN
ID-CLAIMING RULE IF YOU ALREADY KNOW ONE EXISTS.** That is the trap: not unread doctrine, but
doctrine in a file whose reading protocol changed out from under it. Measured today:
`RULINGS.md` is **342 lines / 425KB** — it has grown ~95KB since that row measured it at 330KB.

### ③ NO SCRIPT CHECKS LEDGER-ROW IDS FOR DUPLICATES

`scripts/verify-id-citations.mjs` is wired into `npm run verify` and is the **only** mechanical id
check in the repo. Its own constants bound it:
- `LOG = 'docs/tech-debt-log.md'` — clause A (no duplicate `## #N` headings) runs against **that
  file alone**.
- `WATCHED = ['CLAUDE.md', 'docs/CLOSE-OUT-LEDGER.md', 'docs/built-inventory.md', 'docs/RULINGS.md']`
  — these are opened **only** to find *tech-debt* citations that dangle (clause B, a ratchet).

**So it reads the close-out ledger and never checks the ledger's own ids.** It is a cap over a
different id-space. It also cannot see, by construction: a claim in a **commit subject** (#3 above),
a claim on an **unmerged branch** (#5, #6), or a **ruling** id.

⚠️ **AND `#281` PROVES A SECOND HAZARD THE CAP CANNOT ADDRESS: THE ID-SPACES OVERLAP.** `#281` is
simultaneously a live **ledger** id (the G11 grid standard, 2026-09-07) and a live **tech-debt** id.
A bare `#281` in prose is ambiguous, and renumbering this session's item required hand-checking
**23 occurrences** across nine files to separate the two senses — a blind replace would have
corrupted real references.

### 🔴 PROPOSED — NOT BUILT. TWO MECHANISMS, AND THEY ARE COMPLEMENTARY, NOT ALTERNATIVES.

**(A) THE ALL-BRANCHES RESERVATION SWEEP, AS A CLOSE-OUT GATE.** Today's sweep is what worked
twice: `feat/campaign-lifecycle` ran one and avoided colliding with `#305`; this session ran one and
caught `#281`. Neither is required by anything. The gate would read: *before an id is written into
any file, sweep **every remote branch** — ledger rows, tech-debt rows AND commit subjects — take the
next free id, and push a `⏳ RESERVED` row naming the branch the real row will arrive on.*
- ✅ **The mechanism already exists and is proven**: the `⏳ RESERVED — CLAIMED, NOT LOST` row
  invented for `#255`, honoured by the 2026-09-03 merge; and `75e9e04` (`#306`) and `eee5491`
  (`#307`) today. No new artefact, no new tooling.
- ⚠️ **`origin/main` is NOT sufficient and today proves it** — main holds none of `#304`'s row,
  `#305` or `#306`. A main-only check would have collided three times over.
- ⚠️ **COST, stated:** the reservation is pushed to a **branch**, not `main`, because **`main`
  auto-deploys to Vercel** and a bookkeeping push there ships a production deploy (#60/#280's
  class). A branch reservation is therefore discoverable **only by an all-branches sweep** — which
  is circular unless the sweep is mandatory. **That circularity is the argument for the gate, not
  an objection to it.**
- ⚠️ It does not close the race, it shrinks it to the seconds between sweep and push. `#304`'s two
  claims were 4m35s apart; both sessions would have swept clean.

**(B) A LEDGER-ID DUPLICATE CLAUSE IN `verify-id-citations.mjs`.** Extend clause A from one file to
two id-spaces: no two `| **#N**` rows in `docs/CLOSE-OUT-LEDGER.md`, exactly as `## #N` is already
asserted for tech-debt.
- ✅ **Cheap and in the idiom** — the parser, the self-test probes and the false-duplicate negative
  controls all exist; this is a second `rowIds()` pattern and a second call.
- 🔴 **BUT IT CATCHES ONLY WHAT HAS ALREADY LANDED IN ONE TREE.** It would NOT have caught any of
  the six above, because every one of them was two claims in **two different trees**. It is a
  backstop for the merge, not a defence at claim time. **(A) is the prevention; (B) is the net.**
- ⚠️ A third clause is worth considering with it: **an id cited in a commit subject with no row in
  either log** — that is exactly `#304` on `main`, and it is dangling there right now.

**NOT BUILT, and the reason is David's own instruction** — *"PROPOSE, do not build."* Both changes
are edits to a binding gate and to a cap every build runs; choosing one in code is the kind of
default the OWED register exists to stop. **The unnumbered rule at `RULINGS.md:272` is still
David's to mint, and neither proposal above should be read as minting it.**


---

✅ **RESOLVED 2026-09-12 (ledger #309). DAVID MINTED THE RULE AND ORDERED BOTH MECHANISMS BUILT.**

**① THE TWO ROWS ARE NOW RULINGS.** `R-148` (who owns an id, and when it is claimed — five clauses)
and `R-149` (a ledger id cannot be claimed atomically; **RESERVE VISIBLY**, option (a), in its (a′)
form) sit in `RULINGS.md`'s table proper. **The prose was NOT rewritten, on instruction** — only the
*"DRAFTED FOR DAVID, NOT FILED"* framing was removed and the numbers added. ⚠️ R-148's own text says
*five clauses* and lists **six**; left exactly as written and noted in the row rather than silently
corrected.

**② (A) THE ALL-BRANCHES SWEEP IS A GATE** — `scripts/verify-id-sweep.mjs`, in `npm run verify`.
Every id this branch claims beyond `origin/main` is swept against every **rival** branch's ledger
rows, tech-debt rows, ruling ids **and commit subjects**; a collision fails and names the branch.
🔴 **SAME-LINEAGE IS EXCLUDED, and getting that wrong would have made the cap useless:** the first
run reported four "collisions" against the branches this one is built on — the same claim
*inherited*, not two sessions competing. **A cap that fires every time you branch off your own work
is a cap people turn off.** Live: 40 branches, **9 rivals**, clean.

**③ (B) CLAUSES C AND D** in `verify-id-citations.mjs`. **C** — no two `| **#N**` close-out rows;
**a RESERVED row is deliberately NOT a duplicate**, because counting one would make a correct
reservation look like a collision and teach sessions to stop reserving, which is the exact behaviour
R-149 exists to produce. **D** — an id claimed in a **commit subject** with no row in either log,
scoped to the conventional-commit scope so a bare `#N` in prose stays a reference; routed by the
marker inside the scope, because **the id-spaces overlap** (`#281` is simultaneously a live ledger id
and a live tech-debt id).

🔴 **AND D DID NOT SEE ITS OWN TEST CASE AT FIRST, WHICH IS THE FINDING INSIDE THE FIX.** `#304` is
claimed by `eb4aad6 fix(#304)` on `main`, which carries no `#304` row. This branch forked *before*
that commit, so reading `HEAD` alone reported **clean while the defect sat on `main`** — every
branch's answer depending on where it forked, which is the one-tree blindness this whole pass is
about. The clause now reads **HEAD ∪ `origin/main`**, and `#304` appears. **The backlog is NAMED, not
counted** — 35 claims printed in full every run, because a backlog nobody can see is a backlog nobody
shrinks.

**④ §10 STEP 10 NOW MATCHES THE PRACTICE.** It said *"read IN FULL, every session"* and *"short
enough that reading it is free"*; the file is **342 lines / 425KB** and is grepped. The obligation
**moved rather than shrank**: a targeted read is honest only if the report **names the terms**.
⚠️ **How the file is FOUND rather than searched is a separate decision David reserved, and none was
designed here.**

🔴 **WHAT IS STILL NOT GUARDED, STATED PLAINLY.** R-148 clauses **(1)**, **(3)** and **(5)** are
convention — no cap reads a prompt or an author's intent — and **(6)** is guarded only by the shape of
`RULINGS.md` itself. **And neither mechanism closes the race**, which the ruling's own text predicted:
between the sweep and the push, another session can still take the id. **The answer remains
reserve-and-push-first, and both caps say so in their output rather than implying otherwise.**

---

## #285 — 🟡 FIVE DIALOGS CARRY A DRIFTED COPY OF THE SHARED SHEET, AND THE V4 FIX MAKES THEM DIVERGE VISIBLY (NEW 2026-09-12, ledger #308, §6 r8)

**This is a CONSOLIDATION item with a measured population, not a tidy-up.** The 2026-09-12 modal
survey (11 dialogs, both packages) found the same literal shape in six separate style objects:

```
{ …, maxHeight: '85vh', overflowY: 'auto' }
```

One of them is the shared `sheetStyles.sheet`. **The other five are hand-rolled copies** that no
longer track it:

| Surface | Where | What it is |
|---|---|---|
| `ProjectsManager.tsx` | `:183` `S.sheet` | project admin, `Done` |
| `InventoryCount.tsx` | `:1056` `S.sheet` | the count walk's sheets (+ a nested `maxHeight:'40vh'` list) |
| `OperatingCosts.tsx` | `:113` `S.sheet` | cost editor, submit at `:544` |
| `ScanOrder.tsx` | `:658` `S.sheet` | scan flow sheets |
| `ProjectCostDrillIn.tsx` | `:360` `card` | read-only drill-in, `Done` only |

🔴 **AND THE STATE THIS ENTRY IS FILED IN IS DELIBERATE, NOT AN OVERSIGHT.** Ledger #308 rewrote
`sheetStyles.sheet` into a bounded flex column with a pinned action row (**§8 V4**) and converted its
**six** consumers plus `ConflictDialog` and `ReviewAskSheet`. **These five were NOT converted**, on
David's scope call — folding five more files into a pass whose ledger is about feedback placement is
the scope creep §1.6 exists to catch.

⚠️ **SO THE FIVE NOW DIVERGE FROM THE SHARED SHEET VISIBLY, AND THAT IS INTENDED.** Until they are
folded back, their action rows scroll with their bodies while every shared-sheet dialog's does not —
two behaviours for one control class, on one platform. **Recorded here so the next reader finds a
decision rather than inconsistency**, and so nobody "fixes" the divergence by reverting the shared
style. The fix direction is one-way: point each at `sheetStyles.sheet` / `sheetBody` / `sheetActions`
and delete the local copy.

**WHY IT IS §6 r8 AND NOT COSMETIC.** *"The same OPERATION exists in exactly one place"* — this is one
operation (bound a dialog, scroll its body, pin its actions) in six. It has already cost once: the V4
defect had to be found and fixed **seven times** rather than once, and five instances are still open.

⚠️ **ONE OF THE FIVE IS NOT LIKE THE OTHERS:** `ProjectCostDrillIn` is a read-only drill-in whose only
button is `Done`. It carries no commit control, so V4's *consequence* is mild there — but it still
holds a copy of the shape, which is why it is on the consolidation list and not on a V4 list.

**TRIGGER:** the next build that touches any of the five (consolidate-when-touched, AC-5's discipline
applied to a style), or a dedicated pass. **Not blocked on anything** — the shared parts exist and are
proven by `stopOfferMount.test.ts` A6/A7.

---

---

## #286 — ✅ **RESOLVED 2026-09-12 (ledger #314) — TWO POPULATIONS, AND INHERITANCE MOVED FROM THE BRANCH TO THE ID.** THE ALL-BRANCHES SWEEP EXCLUDED EVERY BRANCH CUT FROM `main`, SO RUN FROM `main` IT REPORTED A TAKEN ID AS FREE (was NEW 2026-09-12, ledger #312)

**The instance, measured today.** `node scripts/verify-id-sweep.mjs` run from `main` printed:

```
verify-id-sweep — 38 remote branches, 6 rivals (same-lineage and main excluded) swept from main
  close-out highest anywhere: #309  →  NEXT FREE: #310   (this tree claims none beyond main)
✅ verify-id-sweep — no id claimed by this branch is claimed anywhere else.
```

🔴 **`#310` AND `#311` ARE BOTH ALREADY CLAIMED ON `origin`.** `2584197 reserve(#310)` on
`origin/feat/channel-vocabulary`, and `b8e5bbd reserve(#311)` + `cb60f62 fix(#311)` + `c6898df docs(#311)`
on `origin/fix/zone-walk-safari-blob-revoke` — the last of which carries a **filed `#311` ledger row**,
not merely a subject. The true highest, derived by hand over `git log --all` subjects ∪ every remote
branch's `CLOSE-OUT-LEDGER.md` rows, is **#311**. The sweep was two ids behind and said so in green.

**THE MECHANISM, AND IT IS FOUR LINES.** `scripts/verify-id-sweep.mjs:139-141`:

```js
const sameLineage = (ref) => {
  const anc = (a, b) => { try { git('merge-base', '--is-ancestor', a, b); return true; } catch { return false; } };
  return anc(ref, 'HEAD') || anc('HEAD', ref);
};
```

The second disjunct — `anc('HEAD', ref)`, *"HEAD is an ancestor of it"* — excludes every branch
**downstream** of HEAD. **Run from `main`, that is every branch cut from current `main`**, which is
where every fresh reservation lives: **38 remote branches collapsed to 6 rivals.** Confirmed directly:
`git merge-base --is-ancestor origin/main origin/fix/zone-walk-safari-blob-revoke` and the same for
`origin/feat/channel-vocabulary` both return true.

⚠️ **THE EXCLUSION IS NOT THE BUG, AND DELETING IT WOULD BREAK THE CAP.** Its comment is right, and
it was written against a real first-run failure: *"The first run flagged four 'collisions' against
`feat/tile-grid-r7-describe` and `feat/breakpoint-vocabulary` — which this branch is BUILT ON. Those
ids are the same claim, INHERITED … A cap that fires every time you branch off your own work is a cap
people turn off."* **That reasoning holds for the COLLISION half and fails for the NEXT-FREE half**,
because the two halves need opposite populations:

| Half | Question it answers | Population it needs |
|---|---|---|
| **COLLISION** | *is an id I claim also claimed by a session competing with me?* | rivals only — lineage correctly excluded |
| **NEXT FREE** | *what is the highest id claimed ANYWHERE?* | **every ref, lineage included** |

`max` is computed over `local ∪ localRes ∪ onMain ∪ elsewhere(RIVALS)` (`:174`), so a downstream
branch's claim can never enter it. **From `main`, NEXT FREE is therefore always `main`'s max + 1 — a
number computed without consulting a single unmerged branch.**

🔴 **AND THIS IS THE EXACT CLASS THE SWEEP WAS BUILT TO CLOSE, ARRIVING IN THE SWEEP.** Ledger #309
built it after *"six collisions in 24 hours, every one by a session doing the right thing"*, and the
defect it was built for is **a claim that is invisible to the session reading the file**. A session that
does the newly-correct thing — run the gate, reserve, push — is handed `#310` and collides with a
reservation that has been on `origin` for hours. **The honest form of the finding: the gate turns a
careful session into a colliding one.** §6 r19 / [[R-33]] — *a check that cannot disagree is not a
check* — in its #182 variant: **the scanner reports a count and never states an expectation for it**,
and *"✅ no id claimed by this branch is claimed anywhere else"* is TRUE as written. It answers the
collision question correctly and the one the reader is actually asking incorrectly, in the same breath.

**THE FIX IS SMALL AND IT IS NOT TAKEN HERE, BY THE SAME REASONING THE SWEEP'S OWN AUTHOR USED:**
split the populations — keep `RIVALS` for COLLISION, add an unfiltered `ALL_REFS` for the NEXT-FREE
max, and have the sweep **name the ref holding the highest id** rather than only the number (`#311 —
origin/fix/zone-walk-safari-blob-revoke`), so a wrong answer is visible rather than merely wrong.
⚠️ **Rewriting a checker inside a card-flip pass is the drift the gate exists to catch**, so it is
SURFACED, not repaired. **What this pass did instead, and what it proves:** derived the true highest by
hand, took **#312**, and recorded the derivation in the reservation commit — i.e. the workaround is a
human doing the sweep's job, which is where this platform was before #309.

⚠️ **SCOPE — WHAT IS AND IS NOT AFFECTED.** Run from a **feature branch** whose HEAD is not an ancestor
of the other live branches, the exclusion drops far fewer refs and the NEXT-FREE figure is much closer
to true — which is why #309's own run was clean and why this went unnoticed for a day. 🔴 **The worst
case is `main`, which is where a session that has just merged, or one starting fresh, is standing** —
the single most likely place for the gate to be run, and the only place where it degrades to
`main`'s-max + 1. **Clauses C and D (`verify-id-citations.mjs`) are unaffected**: they read `HEAD ∪ origin/main`
by design and make no free-id claim.

---

### ✅ HOW IT WAS FIXED (2026-09-12, ledger #314) — and the fix is NOT "delete the filter"

🔴 **THE PROPOSED FIX IN THIS ROW WAS INCOMPLETE, AND SAYING SO IS THE POINT OF RE-READING IT.** It
said *"keep `RIVALS` for COLLISION, add an unfiltered `ALL_REFS` for the NEXT-FREE max."* That repairs
the maximum and **leaves the collision half blind from `main`** — which is where David's instruction
pointed: *"run it from main against a known-taken id and watch it refuse."* A sweep that prints the
right NEXT FREE and still passes a taken claim is the same false green, one layer over.

**THE REAL DISCRIMINATOR: INHERITANCE IS A PROPERTY OF AN ID, NOT OF A BRANCH.** An id I claim is the
SAME claim as another ref's **iff it was already claimed in our shared history — at
`merge-base(HEAD, ref)`.** Exact in all four directions, and the fourth is the one that was missed:

| Relationship | merge-base | Verdict |
|---|---|---|
| ref is an ANCESTOR of HEAD | = ref | every id it claims is inherited ✓ |
| ref is DOWNSTREAM of HEAD | = HEAD | ids I claim are inherited — **no false positive, which is what the old filter was protecting** ✓ |
| a SIBLING cut from `main` | = main | main does not claim my id → **COLLISION** ✓ |
| **I am on `main`, ref downstream** | = main | a claim in my TREE is not at main → **COLLISION** — *the case that was missed* ✓ |

So **the lineage filter is GONE, not loosened**, and every ref is swept for both questions.
`selectPopulations()` takes **no lineage predicate at all** — the absence IS the fix, and probe **P1**
fails the build if one reappears.

**PROVEN BY MAKING IT FAIL, not by reasoning (§6 r19 · [[R-33]]).** One tree standing on `main`, one
injected claim of **`#310`** — an id held by `origin/feat/channel-vocabulary` — and the two scripts run
against it back to back, same tree, same id:

```
OLD (origin/main)  41 remote branches, 5 rivals …   NEXT FREE: #311
                   ✅ no id claimed by this branch is claimed anywhere else.            exit 0
NEW                41 refs for NEXT FREE, 40 for collisions …  NEXT FREE: #315
                   held by: origin/fix/id-sweep-next-free-population (reserved)
                   🔴 COLLISION — close-out #310 is claimed by THIS branch (HEAD)
                      and by origin/feat/channel-vocabulary                             exit 1
```

⚠️ **THE OLD RUN WAS WRONG IN FOUR PLACES AT ONCE, NOT ONE.** It missed the collision, and it reported
`#311`, tech-debt `#285` and `R-150` as free when the true answers were **#315**, **#290** and
**R-154**. **A green line and four wrong numbers** — `origin/feat/channel-vocabulary`,
`origin/docs/four-recovered-stories` and `origin/feat/action-feedback-visibility` are the three refs it
could not see.

🔴 **AND THE NEGATIVE CONTROL CAUGHT A REAL BUG IN THE FIX, WHICH IS EXACTLY WHY IT EXISTS.** Run from
`8a76dde` — a commit that RESERVES `#312` — against `origin/docs/card-flips-and-leak-clause-split`,
which is downstream of it and also claims `#312`, the first draft reported a **false COLLISION**: the
merge-base read used the FILED-ROW matcher alone, so an inherited **RESERVATION** was invisible while
the rival side counted it. **An asymmetry between two reads of one question** — and it reintroduced
precisely the false positive the deleted filter existed to prevent. Both sides now go through **one**
`fileClaims()`, so the asymmetry cannot be re-created by editing one of them; probe **P5** is that line.
The control now reports *"1 overlapping claim(s) INHERITED at the merge-base, not collisions"*, exit 0.
**It was found by running the probe, not by thinking about it.**

**ALSO SHIPPED:** the highest id now **NAMES ITS HOLDER** (`held by: origin/feat/action-feedback-visibility`)
— *a number with no holder gives a reader nothing to disagree with*, which is half of why this survived
a day — and each ref's commit subjects are read **once** rather than twice per space (the old loop
called `subjectsOf` for ledger and again for tech-debt).

**PROBES: P1–P5, five of them POPULATION probes — #182's own prescription** (*"the mechanical fix is a
mutant that changes the POPULATION, not the subject — none of our 13 do"*). **7/7 deliberate mutants
caught:** a reintroduced lineage filter · a dropped `main` · an over-filtered rival set · `fileClaims`
losing reservations · `collisionsOf` ignoring inheritance · `highestClaim` dropping the holder ·
`highestClaim` returning the first instead of the max.

⚠️ **WHAT IS STILL TRUE AND IS NOT A DEFECT:** the cap compares CLAIMS, never commit TIMES. R-148
clause (4) needs a human to read two timestamps and decide; the cap **names the other holder so that
comparison is possible, and deliberately does not perform it. Nothing in it moves an id.**

---

## #288 — 🟡 A RULING REACHED THE FILE AS A **FORECAST** AND NEVER REACHED THE STORY IT FORECAST, SO THE BOARD REPORTED A DECIDED QUESTION AS OWED FROM INSIDE THE FILE THAT HELD THE DECISION (NEW 2026-09-12, ledger #313 · minted as [[R-151]])

**THE INSTANCE, MEASURED.** On **2026-08-31** David ruled the Spanish-language interface. The ruling
reached `user_stories.md` **that day** — but as a **FORECAST**, at `:730`, inside a *different* story
(*the on-site maintenance position*):

> 🔴 **DO NOT ASSUME ONE LANGUAGE PER TENANT, and Cuto is the counter-example INSIDE one business.**
> Two stories are being filed against this by David — **a Spanish-language interface where the choice
> is made BY THE PERSON, on the invitation screen** — and the on-site maintenance position itself.

**The story it forecast already existed**, 470 lines below at `:1199` (*Give it to me in my language*,
filed 2026-08-23, ledger #194). Its `NEEDS` line read:

> David to rule scope — crew-facing surfaces only, or the whole app — and whether locale is a
> **per-user setting or a per-device one**.

🔴 **THE FORECAST ANSWERS THAT QUESTION IN ITS OWN SENTENCE — *"the choice is made BY THE PERSON"* —
AND THE TWO LINES SAT IN ONE FILE, UNCONNECTED, FOR TWELVE DAYS.** Anyone opening the board was told
a question was owed to David by a file that, 470 lines earlier, recorded him answering it. **Nobody
was wrong at any point**: the forecast was accurate, the story was honest about what it lacked, and
neither knew about the other.

**THE MECHANISM: NOTHING LINKS A FORECAST TO THE THING FORECAST.** A sentence that says *"a story is
being filed"* creates no obligation, names no owner, carries no id, and is not swept by anything. It
reads as a record of a decision **because it is one** — which is exactly why it does not read as an
outstanding task. The `NEEDS` field is the board's only owed-marker, and a forecast written anywhere
but in that field is invisible to it.

🔴 **FOURTH SHAPE TODAY, AND THE FAMILY IS THE POINT — DAVID'S FRAMING.** Same family as **ledger
#193's `MAPS-TO: —`**, which was set *deliberately* so the social gap would **stay visible**, and
stayed visible for **twenty days** without ever being assigned. Both are **a true statement, correctly
recorded, in a place that generates no obligation.** The other two of the four:

| | The record | Why nothing acted on it |
|---|---|---|
| **#284** ([[R-148]]/[[R-149]]) | The id-claim rule, complete and correct since 2026-09-02 | It **disqualified itself in its own text** (*"deliberately NOT written into the table above as a ruling in his voice"*), and lived in a file now grepped rather than read |
| **#283** (§6 r7) | *"Tile grid: desktop/tablet only (768px+)"* | **True when written**, invalidated by a change that never came back to it — a rule that was once true reads exactly like a rule that is true |
| **#193** (`MAPS-TO: —`) | The social surface has no story | Set deliberately to keep the hole **visible**. Twenty days. **A visible gap is not an assigned one** |
| **#288** (this) | *"two stories are being filed against this by David"* | A **forecast** — accurate, dated, in the right file, attached to nothing. Twelve days |

**⚠️ WHAT THIS IS NOT.** It is not a call to stop writing forecasts — the `:730` line is genuinely
useful and it is the reason the ruling survived at all. It is not [[R-26]] either: R-26 is *a written
declaration nobody checked against reality*, and every one of these declarations was **true**. **The
defect is that being true and being acted upon are unrelated properties of a written line**, and only
one of them has a mechanism.

🔴 **NOT FIXED, AND THE FIX IS NOT OBVIOUS — WHICH IS WHY THIS IS FILED RATHER THAN BUILT.** The cheap
mechanical form is a cap that greps for forecast phrasing (*"is being filed"*, *"a story will be
written"*, *"David will rule"*) and fails when it cannot find a matching owed-marker — but that is
**matching on spelling**, which is tech-debt **#189**'s named weakness, and it would not have caught
`:730`'s wording. The durable form is that **a forecast carries the id of the thing it forecasts**,
which makes it sweepable — but nothing today gives an unwritten story an id, and R-148 clause (6)
says an unminted thing **carries no id at all**. **That tension is real and is David's to resolve, not
Thunder's to pick a default for.**

**BLAST RADIUS: NOT MEASURED.** This entry documents **one** instance found while filing four stories.
Whether other forecasts sit unconnected in `user_stories.md`, `RULINGS.md`'s OWED queue, or §3 prose
that has since rotated out at N=3 **has not been swept** — and §3's N=3 rotation is precisely where a
forecast would go to die unnoticed.
---

## #289 — ✅ **RESOLVED 2026-09-12 BY DELETION (ledger #316, David's ruling — option (a)).** WAS: 🔴 A "NEXT FREE ID" DECLARATION CACHED IN A FILE GOES STALE THE MOMENT A BRANCH CONSUMES THE ID, AND NOTHING CAN SEE IT (NEW 2026-09-12, ledger #308)

✅ **THE RESOLUTION, IN DAVID'S WORDS:** ***"A number that is usually right is worse than no number, because it gets trusted."*** The cached next-free numbers are **GONE** from `TRACE-SESSION-BOOTSTRAP.md`. What replaces them is the instruction that was always beside them: **run `npm run verify:id-sweep`, FROM A BRANCH not from `main`, then reserve and push.** 🔴 **Option (a) of the three this entry named — chosen over (b) derive-at-read-time and (c) teach-the-sweep-to-assert-the-line, because the sweep ALREADY derives the answer at read time and the line was a second representation of it (STD-011). The convenient copy is the one that drifts, and it is the one that gets read.**

✅ **AND TWO CAVEATS WENT IN WITH THE INSTRUCTION, BECAUSE AN INSTRUCTION WITH A SILENT FAILURE MODE IS THE NEXT VERSION OF THIS ENTRY:** ① **run it FROM A BRANCH** — from `main` the sweep excludes every branch cut from current `main` (`sameLineage()`; ⚠️ its own tech-debt row sits on an unmerged branch, so it is described not cited), which is exactly where a session that has just merged stands; ② **it cannot see an id claimed in an uncommitted working file, and that is the FLOOR, not a bug** — it reads refs, and reserve-and-push is what lifts a claim over that floor.

⚠️ **WHAT THIS DOES NOT CLOSE, SAID PLAINLY:** the RACE is untouched — between the sweep and the push another session can still take the id ([[R-149]] says so and the sweep prints it). This entry was never about the race; it was about a cached ANSWER being trusted over a live one. **That is closed. The race is R-149's.**

**THE EVIDENCE THAT DECIDED IT — three mechanisms in one day, every correction wrong within the hour:**

**The line, on `main`, in the file every session opens first:**

> `TRACE-SESSION-BOOTSTRAP.md` — *"🔴 **BEFORE CLAIMING ANY ID: `npm run verify:id-sweep`** — next free is
> **#310** / tech-debt **#286** / **R-150**."*

It was **TRUE when written**. Ledger **#308** was in flight on a branch at that moment, holding **R-150**
and **tech-debt #285**, and the line became **FALSE the instant that branch merged** — while reading
exactly as authoritative as before.

🔴 **THE DEFECT IS THE FORM, NOT THE NUMBER. IT IS AN ANSWER, NOT A CLAIM.**
- **Nothing derives it at read time.** A session reads `R-150` and believes it, because there is no
  moment at which the file recomputes.
- **The sweep cannot catch it.** `verify:id-sweep` scans branches for ids that ARE claimed. This line
  asserts an id that is *not* claimed — a **negative**, about the future, and the sweep has no
  expectation to compare it against. A check that scans for what exists cannot see a promise about
  what doesn't.
- **It cannot be repaired by being more careful.** The writer was correct; the world moved.

⚠️ **AND THE INSTRUCTION IMMEDIATELY BEFORE IT IS THE MITIGATION THAT WAS ALREADY THERE:** *"BEFORE
CLAIMING ANY ID: `npm run verify:id-sweep`."* **A session that runs the command is safe; a session that
reads the cached numbers beside it is not.** So the line actively competes with its own advice — the
convenient half is the wrong half, and it is the half that will be read.

**THIRD INSTANCE OF [[R-149]]'s CLASS TODAY, FROM A NEW DIRECTION.** Same day, same subject, three shapes:
| | What happened |
|---|---|
| **1. The race** | #308 and #309 both reserved visibly, **six minutes apart**, and claimed the same `R-148`. Option (a) has no read step (filed on R-149's row). |
| **2. The half-claim** | tech-debt **#282** — a commit landed on another session's branch; `main` never saw it. |
| **3. This** | Nobody raced anybody. **A correct declaration was made false by a merge**, with no session present to notice. |

**FIXED HERE, FOR THIS INSTANCE ONLY:** the merge of #308 corrected the line to `#310` / `#287` /
`R-151`, **because the merge is what made it false** (David's instruction). 🔴 **THAT IS A PATCH, NOT A
FIX** — the next branch carrying an id will do it again, and the correction depends on a human noticing
at merge time, which is the thing that failed.

**THE DIRECTIONS A REAL FIX COULD TAKE — none chosen, all David's:**
- **(a) Delete the cached numbers, keep the command.** The line becomes *"run `npm run verify:id-sweep`"*
  and nothing else. Cheapest, loses the glanceability that is presumably why the numbers are there.
- **(b) Derive it at read time.** The bootstrap stops asserting and the sweep PRINTS the next free ids,
  so the answer cannot be older than the moment it is read.
- **(c) Make the sweep assert the line.** Teach `verify:id-sweep` to parse this sentence and fail the
  build when a declared next-free id is already taken on any branch. Turns the answer back into a
  **claim**, which is the only form a cap can check.

⚠️ **(c) IS THE ONE THAT GENERALISES AND IT IS ALSO THE ONE THAT WILL ROT** unless the sweep derives the
sentence's location rather than hardcoding it — #73's lesson, in a file that is loaded every session.

🔴 **AND THE PATCH FAILED WITHIN THIRTY MINUTES, WHICH IS THE ENTRY'S OWN ARGUMENT ARRIVING AS EVIDENCE.**
The merge of #308 rewrote the line to `#310` / `#287` / `R-151`. **Every one of those three numbers was
already wrong when written**, because they came from a MANUAL survey of remote docs — and
`npm run verify:id-sweep`, run minutes later, reported the truth: **close-out highest anywhere #314,
tech-debt #288, ruling R-153** across *41 remote branches*. The manual survey could not see them; the
sweep could. ⚠️ **The same run caught a live collision the survey had also missed** — this very entry
was filed as **#286**, already claimed 29 minutes earlier by `origin/docs/card-flips-and-leak-clause-split`,
and renumbered to **#289** under R-148 clause (4) (later claim moves).

**So the cached line has now been wrong twice in one hour, by two different mechanisms** — stale by
merge, then stale by a survey that could not see far enough. 🔴 **This is the argument for (a) or (b)
over (c) and over patching: the numbers are only ever correct at the instant of a full sweep, so the
only honest forms are DERIVE THEM AT READ TIME or DO NOT CACHE THEM AT ALL.** The current line is
correct as of this commit and carries the same defect it describes; it was left as numbers rather
than deleted because removing them is David's call, not a builder's.

✏️ **THIRD CORRECTION THE SAME DAY, AND NOBODY DID ANYTHING WRONG THIS TIME.** Between the second
correction and the merge of ledger #310 — about an hour — other sessions took more ids, and the sweep
moved from `#314 / #288 / R-153` to `#315 / #291 / R-153`. The line was rewritten to `#316` / `#292` /
`R-154`. **No merge falsified it and no survey was too shallow: it simply aged.** That is the third
distinct mechanism in one day — stale by merge, stale by a survey that could not see far enough, and
now stale by the passage of time on a busy tree — and it is the clearest argument yet that the
quantity is not cacheable at all. 🔴 **Each correction has itself been wrong within the hour.**

**TRIGGER:** the next branch that consumes an id and merges — i.e. immediately, and repeatedly.

---

## #290 — 🟡 THE ZONE WALK'S PLANT PICKER IS A `<datalist>`, AND iOS SAFARI IS THE ONE PLATFORM IT IS USED ON (NEW 2026-09-12, ledger #311)

**Where.** `packages/cultivar-os/public/tools/zone-walk.html` — the plant field is an `<input list=…>`
backed by `<datalist id="plantlist">`, populated from `PLANTS` at load:

```js
document.getElementById('plantlist').innerHTML =
  PLANTS.map(p=>`<option value="${p.label.replace(/"/g,'&quot;')}">${p.sku}</option>`).join('');
```

🔴 **THE PLATFORM MISMATCH IS THE WHOLE ENTRY.** `<datalist>` is the weakest-supported form control
in Safari: iOS renders it as a thin suggestion strip above the keyboard rather than a picker, it does
not filter the way it does on desktop Chrome, and the `<option>`'s **label/value split is not
honoured** — the SKU that is meant to show as the description is not reliably shown at all. **This
tool is used standing in a lot, on a phone, by someone reading a plant tag** — the picker IS the
interface, and desktop is the platform it will never be used on.

**Named by David 2026-09-12 and deliberately NOT fixed in `#311`**, which committed the Safari
blob-revoke fix only. ⚠️ **Not measured on a device by Thunder** — this entry records the defect as
REPORTED, with the mechanism explained; the live behaviour on David's iPhone is the proof and it has
not been taken. **Filed as a register row rather than left in a ledger row, because ledger rows
scroll and this is the register** (David's instruction, same session).

---

---

## #291 — ✅ **RESOLVED 2026-09-12 (ledger #311) — ONE TRIM, ON THE WAY OUT, WHILE IT WAS STILL FREE.** EXPORTED LABELS CARRIED A TRAILING SPACE, AND AN EXACT JOIN IS WHAT WILL READ THEM (was NEW 2026-09-12)

**Where.** `packages/cultivar-os/public/tools/zone-walk.html` — the label written into the export
retains a trailing space, so a row exports as `"Live Oak 30gal "` rather than `"Live Oak 30gal"`.

🔴 **WHY A SINGLE SPACE IS A DATA DEFECT AND NOT A COSMETIC ONE.** Whatever eventually imports this
file has to JOIN each exported label back to a stored one, and **every join this platform performs on
a text label is an EXACT comparison** — `canonicalName` and `normalizeSize` exist precisely because
inexact spellings had already cost us real rows (#55, #56, ledger #135). A trailing space is
invisible in every surface a human would check it in: the JSON viewer, the spreadsheet, the console,
the tag itself. **It will not look wrong; it will simply fail to match**, and the failure mode is a
silent no-match that reads as *"this plant isn't in the catalogue"* rather than as a formatting bug.

⚠️ **THE FIX IS A `.trim()` ON THE WAY OUT, NOT ON THE WAY IN.** Trimming at capture would edit what
the walker typed; trimming at export normalises only the value being handed to a machine. Which side
it lands on is a small decision, and it is not taken here.

🔴 **AND THE REASON THIS IS 🟡 RATHER THAN 🔴: NOTHING CONSUMES THE EXPORT YET.** The tool exports for
`business_inventory.zone` and *"the irrigation zone records"*, and **both were measured ABSENT**
(tech-debt **#266**). So there is no importer to mis-join today — which makes this the cheapest
possible moment to fix it, and **the last moment at which fixing it is free**: once a file with
trailing spaces has been imported once, the same space has to be tolerated forever on the read side
or the stored rows need repairing. **The window is open because the importer does not exist.**

**Named by David 2026-09-12; not fixed in `#311`, which committed the Safari blob-revoke fix only.**


---

✅ **RESOLVED 2026-09-12 (ledger #311). David: *"Fix #291 now — `.trim()` on the way out. Nothing
consumes the export yet, so this is the last moment it is free. One line."***

**The fix, in `zone-walk.html`'s export map:** `const label = x.label.trim();` — and the two
references below it now read `label` rather than `x.label`. Three functional lines; the rest of the
diff is the reason, written where the next person will meet it.

🔴 **AND IT WAS BREAKING MORE THAN THE EXPORTED STRING — FOUND BY READING THE EXPORT PATH BEFORE
EDITING IT, NOT BY THE ORIGINAL REPORT.** The label is also the join key **inside the file**:

```js
const hit = PLANTS.find(pl => pl.label === x.label);   // ← ran on the UNTRIMMED value
```

So a plant typed with a trailing space exported as **`matched:false` with null `item_id` and null
`sku`** — the in-file catalogue match silently failed, and the row carried *"we don't know what this
is"* into a file that was otherwise correct. **One trim at the read point fixes the lookup and the
exported string together.** Verified: `'Live Oak 30gal '` now resolves to `matched:true` with a real
`item_id`, where before it returned nulls.

⚠️ **TRIMMED ON THE WAY OUT, NOT AT CAPTURE, AND THAT WAS THE DECISION IN THE ORIGINAL ROW.** What the
walker typed stays as typed in local state; only the value handed to a machine is normalised.

⚠️ **NOT WIDENED, AND SAID RATHER THAN LEFT QUIET:** the `filter(x=>x.label)` above it is unchanged, so
a whitespace-only entry still passes the filter and now exports as `label:""` instead of `label:"   "`.
Both are junk; neither is a join hazard. **Changing the filter is a behaviour change to capture and
was not in scope.**

✅ **The window closed as it opened: free.** Nothing consumes the export (**#266** — `business_inventory.zone`
and the irrigation zone records both measured absent), so no stored row needed repairing and no read
side had to learn to tolerate the space.

---

## #292 — 🟡 NOTHING ASSERTS THAT AN EXEC'D SHELL PIPELINE CARRIES `set -o pipefail`; NINETEEN WERE FIXED BY HAND AND THE TWENTIETH IS FREE TO REGRESS (NEW 2026-09-14, ledger #318)

**Where.** All of `scripts/*.mjs` and the `scripts` block of `package.json`. As of ledger #318 every
exec'd pipeline in the repo carries `set -o pipefail` — 26 places: the 7 that already had it,
`run-tests.mjs`, and the 19 added today. **Nothing keeps it that way.**

🔴 **THE DEFECT IS SILENT, AND IT MAKES A CHECK REPORT SUCCESS.** Without the option, bash returns
only the LAST command's status. `esbuild` writes its diagnostics to stderr and nothing to stdout, so
`node` reads an EMPTY program, exits 0, and the pipeline succeeds. **A file that will not compile is
indistinguishable from one whose suite passed** — `run-tests.mjs:62` records the day that happened
(2026-09-07: a test file printed ✅ with `(no summary line)` beside it). In a mutation harness the
consequence is sharper: the harness scores the mutant **SURVIVED** — *the suite stayed green while
the module was wrong* — when the suite never ran at all.

**Why it is filed rather than fixed.** The mechanical fix is a cap that parses every `execSync` /
`spawnSync` template and every `package.json` script, flags any containing an unquoted `|` without
the option, and fails the build. It needs one thing this pass did not build: **a declaration file for
the legitimate exceptions** — a single-command exec has no pipeline and must not be flagged, and a
pipeline whose first stage genuinely may fail (a `grep` used as a filter) is a real case. Without
that the cap is noise on its first run, and a noisy cap is one people learn to skip (#73's lesson).
**Writing a new cap inside a nineteen-file mechanical fix is also the scope drift the gate exists to
catch.**

⚠️ **AND THE SHAPE IS ALREADY FAMILIAR: THIS IS A DECLARATION NOBODY RE-DERIVES.** #318 derived the
population by hand (`grep -rln '| node'`, then per-file `pipefail` counts) and got 19. **That number
is a measurement, not a guarantee** — it is #73's class and #185's class, one layer out into the
tooling. The same grep is the cap; it is three lines plus the declaration.

**Trigger.** The next session that adds an exec'd pipeline to `scripts/` or `package.json`, or any
session with the appetite for a small cap. **Until then the invariant holds by nobody having broken
it.**

---

## #293 — 🟡 WITH `pipefail` ON, A MUTANT THAT DOES NOT BUILD NOW SCORES `CAUGHT`, AND 16 OF 18 HARNESSES SWALLOW THE REASON WITH `2>/dev/null` (NEW 2026-09-14, ledger #318)

**Where.** The 18 mutation harnesses fixed by ledger #318 — `scripts/measure-*.mjs` +
`scripts/mutants-vendor-identity.mjs`. Sixteen of them run the pipeline as
`${ESB} ${SUITE} … 2>/dev/null | node`.

**What it is.** CA-1 was the right fix and this is its honest residual. `suiteIsGreen()` returns a
BOOLEAN, so after the fix there are two distinct events collapsed into one verdict:

| what happened | verdict | is that right? |
|---|---|---|
| the mutated module compiled and the suite went red | `CAUGHT` | yes — the suite noticed |
| the mutated module DID NOT COMPILE, so nothing ran | `CAUGHT` | **defensible, but it is not the same claim** |

Both are honestly "not survived" — a mutant the compiler rejects is a change the codebase refuses,
and scoring it `SURVIVED` (the pre-fix behaviour) was flatly wrong. **But a harness that reports
`CAUGHT` for a mutant no test ever executed is telling the reader something it did not measure**, and
`2>/dev/null` means esbuild's message — the one sentence that would distinguish the two — is
discarded before anyone could see it.

🔴 **IT IS NOT REACHABLE TODAY, AND THAT IS PRECISELY WHY IT SHOULD BE WRITTEN DOWN NOW.** Measured
in the #318 pass with an esbuild shim: **483 builds across the 18 harnesses, ZERO failed.** Every one
of the 395 current mutants is a semantically-valid edit that compiles, so the branch is dead code.
**The next mutant that touches a type, a signature or a brace makes it live**, and it will arrive as
a satisfying green.

**The fix.** Have the pipeline report its two stages separately — build to a temp file, check that
exit, then run — and give the harness a third verdict (`NO-BUILD`, printed distinctly, counted
separately, not folded into `caught`). Stop discarding esbuild's stderr on the failing path.
Cheapest honest version: keep the boolean, but on a red result re-run the build alone and print
`(did not build)` beside the mutant. **~15 lines in one shared helper — and the 18 harnesses should
share that helper rather than each grow a copy, which is §6 r8 and is the larger reason to do it
once.**

**Trigger.** The first harness that reports a mutant it cannot explain, or the next session touching
this family. Related: [[R-33]] · CLAUDE.md §6 r19 · #182 (*a harness that cannot reach its target
reports the same as one that passed*) · #186 (the runner that reported 72 of 74 and said all pass).

---

## #294 — 🟡 THE CLOSE-OUT LEDGER'S TABLE ROWS DO NOT MATCH ITS OWN HEADER — 29 OF 70, AND FOUR OF THEM LOSE CONTENT ON RENDER (NEW 2026-09-14, ledger #320)

**Where.** `docs/CLOSE-OUT-LEDGER.md` — the close-out table. Header: `| # | Work item | Deliverable (one line) | Commit / SHA | Bar | Owner-proof owed (exact live test) | Blocker |` — **seven columns.**

**What it is. Two distinct shapes, and only the first is harmless.**

**① 25 of 70 close-out rows carry SIX cells** — `Work item` and `Deliverable` merged into one. `#318` is the instance David named; it is one of twenty-five: **#246 · #248 · #252 · #253 · #270 · #272 · #273 · #274 · #275 · #276 · #277 · #278 · #280 · #281 · #282 · #290 · #291 · #292 · #294 · #295 · #296 · #297 · #298 · #300 · #318.** GFM pads a short row with empty cells, so these **render, and lose nothing.** Cosmetic.

**② 🔴 4 of 70 carry EIGHT, AND GFM SILENTLY DISCARDS THE EXCESS — `#279 · #299 · #311 · #317`.** The GFM spec is explicit: a row with *more* cells than the header has the excess **ignored**. So content that is in the file is **not on the screen**, and what is being dropped is the **Blocker** column — the most consequential cell in the row:

- **`#317`** drops *"🔴 **FIVE OPEN QUESTIONS ARE WRITTEN INTO THE DOC RATHER THAN ASKED** (unattended run): ① is #253 closed…"*
- **`#299`** drops *"David: retire or wire `install_date` (waits on R-143) · zone shape (O2′ or O3, by the walk data) · infer `planting` on QuickBooks stops (#268)"*
- **`#279`** drops *"⚠️ **Needs a live QuickBooks connection to demonstrate — the review cannot replay a saved capture** (tech-debt #209). ⚠️ **Story gate OPEN**…"*
- **`#311`** drops *"✅ **#291 IS NOW FIXED IN THIS SAME LEDGER — David, same session…"*

**Cause, identified.** An **unescaped `|` inside inline code**. Markdown does *not* protect pipes inside backticks in a table — they must be written `\|`. The three isolated instances are all ordinary prose: `` `find api -name '*.ts' | wc -l` `` (#317), `` `| 108 |` `` quoting a table row (#299), and `` `|amount| ÷ base` `` as absolute-value notation (#279). ✏️ **Two rows carry BOTH shapes at once** — six columns *and* stray pipes — which is why #299's two stray pipes land it at eight rather than nine.

**Why it matters, and why it is this ledger specifically.** #320 has just made the ledger row the **permanent home for every close-out's proof narrative**, moved out of CLAUDE.md §3 precisely because the row is the copy nothing has to cut. **A row that silently drops its last cell is a poor home for that**, and the four affected rows are dropping exactly the class of content §3b's register exists to surface: **open questions waiting on David.** This is the repo's own recurring shape — *a true record, correctly written, in a place that does not surface it* — the same family as ledger #193's `MAPS-TO: —` and tech-debt **#283**/**#284**.

⚠️ **NOT A SILENT FALSE GREEN IN A CAP** — nothing mechanical reads these columns today; `verify-id-citations` parses the row's **id**, not its cells. The loss is to a **human reader**, on the rendered page.

**Correction recorded.** The #320 close-out reported *"row #318 is malformed — 6 columns where the header declares 7"* and implied it was **the** instance. It is **one of 25**, and it is **the harmless shape**. The damaging shape — four rows dropping a cell — was found only when the whole table was measured on **unescaped** pipes; a first pass that counted raw `|` reported 34 rows and was wrong, because `\|` is legitimately escaped in `#304` and `#313`.

**Not repaired in this pass, on David's instruction** — *"file it, do not repair it."* Repairing means editing 29 historical rows, which is exactly the diff-unreviewable drift the pre-flight gate exists to catch.

**The fix, when it is taken.** ① Escape the four stray pipes as `\|` (four one-character edits, and they are the half that actually loses content). ② Decide whether the 25 six-cell rows are normalised or the header is relaxed — **a decision, not a cleanup**, because merging Work item and Deliverable may be what those sessions meant. ③ **A cap is cheap and belongs with the id checks:** assert every close-out row's unescaped-pipe count against the header's, both directions. Without it this recurs the next time somebody writes a shell pipeline into a row.

**Trigger.** The next session to touch a listed row, or the first time a reader asks why a ledger row's Blocker column is empty. Related: **#320** (which made the row load-bearing) · **#283**/**#284** (a true record that generates no obligation) · CLAUDE.md §6 r19.

---

### #294a — 🔴 A SHELL PIPE INSIDE INLINE CODE SPLITS A LEDGER ROW, AND GFM DISCARDS THE OVERFLOW SILENTLY (SEPARATED OUT 2026-09-14 on David's instruction, ledger #321)

**Separated from #294 because it is not the same kind of item.** #294's first shape — 25 rows with six cells — is a **historical tidiness question**: it renders, it loses nothing, and normalising it is a decision about what those sessions meant. **This one is a live, recurring, silent data-loss defect**, and bundling the two would let the harmless half set the priority for the damaging half.

**The mechanism, stated once and precisely.** A markdown table row is split on `|`. **Backticks do not protect a pipe** — GFM's table extension splits the row into cells *before* inline parsing runs, so `` `a | b` `` is two cells, not one code span. A row that ends up with **more cells than the header** has the excess **ignored** by the spec. So: you write a perfectly ordinary shell pipeline into a close-out row, the row silently gains a cell, and **the last cell — `Blocker` — stops being rendered.** No error, no warning, no visual tell. The content is in the file forever and on the screen never.

**🔴 IT RECURS BY CONSTRUCTION, AND THAT IS THE WHOLE ARGUMENT.** Ledger **#320** made the close-out ledger row **the permanent home for every close-out's proof narrative**, moved out of CLAUDE.md §3 precisely *because the row is the copy nothing has to cut*. **Close-out narrative is exactly the prose that contains shell pipelines** — `find api -name '*.ts' | wc -l`, `git log --oneline | head`, `grep -c foo | wc -l`. **So #320 did not merely fail to fix this; #320 increased its rate.** The four live instances are `#279 · #299 · #311 · #317`, and #317's is `` `find api -name '*.ts' | wc -l` `` — a command this repo runs constantly, written into a row by a session doing everything right.

**What it costs, measured.** The dropped cells are not filler. **#317** loses *"🔴 FIVE OPEN QUESTIONS ARE WRITTEN INTO THE DOC RATHER THAN ASKED"* · **#299** loses *"David: retire or wire `install_date` (waits on R-143) · zone shape (O2′ or O3) · infer `planting` on QuickBooks stops"* · **#279** loses *"Needs a live QuickBooks connection to demonstrate"* · **#311** loses a note that a sibling item was fixed in the same ledger. **Every one is a question or a blocker waiting on David** — the precise class `docs/open-questions.md` exists to surface, arriving at the register through a row that does not render it.

🔴 **AND IT RECURRED INSIDE THE SESSION THAT FILED IT — TWO HOURS LATER, IN THE ROW FOR #320 ITSELF. THIS IS THE STRONGEST EVIDENCE FOR THE PROPOSED CHECK AND IT IS NOT A HYPOTHETICAL.**

Writing #320's `Blocker` cell, this session typed the sentence *"Cause: an unescaped `\|` inside inline code."* — **with the pipe unescaped.** The sentence explaining the defect **committed the defect**, split row **#320** into eight cells, and **discarded the cell containing its own conclusion** — *"Filed as tech-debt #294, deliberately NOT repaired"* and the note that it bears directly on that row. **It was pushed to `main` in that state**, and found only by measuring the table again afterwards. Now escaped; the row is back to seven cells and the sentence records what happened to it.

✏️ **What this proves, precisely: knowing about the defect is not protection against it.** The author had filed the item, written the counting rule, and specified the check — **within the same hour** — and still produced the defect the first time the topic came up in prose. **That is the definition of a thing that needs a mechanism rather than care**, and it is the same argument OP-13, #73 and #289 each arrived at from their own direction. Fifth live instance: **#279 · #299 · #311 · #317 · #320 (repaired)**.

**⚠️ It is invisible to every cap we own.** `verify-id-citations` parses a row's **id**, not its cells. Nothing reads the columns. The loss is to a human, on the rendered page, and a human reading a row with an empty Blocker column has no reason to suspect the file says otherwise.

---

#### ✅ BUILT 2026-09-14 (ledger #323) — `verify-id-citations` CLAUSE E, exactly as proposed below.

**Shipped as the fifth clause**, not a new script: it already parses this file. Counts on **unescaped** pipes (`(?<!\\)\|`), derives the width from the header rather than writing `7`, refuses **`cells > header` only**, and prints **the text GFM is discarding** plus the likely culprit pipe. **8 probes, both directions**, P1 the real defect verbatim and P7 a population negative control.

🔴 **RED-FIRST ON THE REAL CORPUS, AND IT NAMED EXACTLY THE FOUR THE PROPOSAL PREDICTED** — `#279 · #299 · #311 · #317`, exit 1. **The prediction and the result matching is the evidence the check reaches its target** (#182: a harness that cannot reach its target reports the same as one that passed).

✅ **THEN REPAIRED, and the sequence was the proposal's own.** Three (`#279 · #299 · #317`) were stray pipes inside inline code and were escaped mechanically. 🔴 **`#311` WAS NOT — and it is the case probe P8 exists for: a genuine EXTRA COLUMN, no stray pipe at all.** Its cells were therefore also **MISALIGNED**: the renumber note sat in the `Bar` column, everything shifted right, and the `Blocker` fell off the end. Repaired by merging the renumber note back into the SHA cell, which restored **both** the discarded text and the column alignment. **All 77 rows now fit.**

✏️ **THE SELF-TEST CAUGHT A BUG IN ITS OWN CLEAN CASE ON FIRST RUN:** the probe asserting an *escaped* pipe is accepted was written `'\|'` in JS source, where the language drops the backslash — so the checker saw a bare pipe and the probe reported a false positive. **The both-directions requirement is what surfaced it**; a violation-only probe would have passed.

<details><summary>The original proposal, kept verbatim — what was specified against what was built</summary>


**Name.** `verify-ledger-table-shape`, or a fifth clause on `verify-id-citations` — **it already parses this file**, so the second is cheaper and adds no new script to the verify chain (§6 r8: one operation, one place).

**The assertion, in one sentence.** *In every markdown table in `docs/CLOSE-OUT-LEDGER.md`, no row may have MORE cells than its header row.*

**How to count a cell — this is the part that must be right, and getting it wrong is how the first measurement of #294 reported 34 rows instead of 29.** Split on pipes **not preceded by a backslash**: `re.split(r'(?<!\\)\|', line)`. `\|` is the legitimate escape and rows **#304** and **#313** use it correctly — a naive `line.count('|')` condemns them and teaches the next reader that the cap cries wolf.

**Direction — and it is ONE direction, deliberately.** **Refuse `cells > header`. Do NOT refuse `cells < header`.** A short row is padded by the spec and loses nothing; **25 rows are short today**, and failing on them would make the cap red on arrival, which is the state a cap does not survive (#73: a gap list that only grows stops being read). The short rows are #294's separate, human decision.

**What it must print.** The row id, the count it found against the header's, **and the text of the cell that is being discarded** — because *"row #317 has 8 cells"* tells a reader nothing, while *"row #317 drops: 🔴 FIVE OPEN QUESTIONS…"* tells them exactly what the reader of that row is not seeing. **And it should name the likely culprit**: the first unescaped `|` that appears between backticks on the line.

**Probes it needs, both directions (STD-022), the first being the real defect verbatim (STD-024):**
- **P1** — 🔴 a row containing `` `find api -name '*.ts' | wc -l` `` → **REFUSES**, and names the dropped cell. *(#317, verbatim.)*
- **P2** — the same row with the pipe escaped `` `find api -name '*.ts' \| wc -l` `` → **PASSES**. Without this, P1 could be a check that refuses every row.
- **P3** — a row using `\|` legitimately in prose (#304/#313's shape) → **PASSES**. This is the one a naive implementation fails.
- **P4** — a six-cell row → **PASSES**. Short is padded, and 25 exist.
- **P5** — the header row itself → never evaluated against itself.
- **P6** — a `⏳ RESERVED` row with a stray pipe → **REFUSES**. It is still a table row; reserving does not exempt the shape.
- **P7** — 🔴 **NEGATIVE CONTROL that changes the POPULATION, not the subject** (#182's own unmet prescription): run it against a file with **no table at all** and against a table whose header is longer than every row — it must report **clean**, not silently pass because it found nothing to parse. *A check that cannot tell "no violations" from "I never looked" is the shape this repo keeps filing.*
- **P8** — an unescaped pipe **outside** backticks (someone typed a real extra column) → **REFUSES**. The defect is the cell count, not the backticks; the backticks are only the commonest cause.

**Scope, and a deliberate limit.** Assert **`CLOSE-OUT-LEDGER.md` only** to begin with. Every `.md` in the repo is the tempting scope and is how a cap arrives with a backlog nobody clears. ⚠️ **`docs/tech-debt-log.md` has tables too and this very entry contains pipes inside backticks** — if the scope widens, it must be widened *with* its own first run cleaned, not before.

**Red-first, before it is trusted (§6 r19 · [[R-33]]).** Run it against `main` as it stands: it must **exit 1 and name exactly `#279 · #299 · #311 · #317`**. If it names more, the escape handling is wrong; if it names fewer, it is not reaching them. **Only then** escape the four pipes and watch it go green — and the four escapes are the repair, which #294 records as owed and which David has deliberately deferred.

**Cost.** Roughly forty lines and one regex, inside a script that already reads the file. **The four repairs are four one-character edits.**

**Trigger.** ~~The next close-out that writes a shell pipeline into a ledger row~~ — **now asserted on every build.**

</details>

## #295 — 🟡 A GROWER'S CHART-OF-ACCOUNTS NAMES DECIDE WHAT COUNTS AS A PRODUCT LINE, INSIDE `shared` (NEW 2026-09-14, ledger #328, recon #327)

**Where.** `packages/shared/src/business-logic/serviceReview.ts:156`

```ts
const ACCOUNT_STOCK = /nursery\s+stock|plant\s+sales/i;
```

and its consumers at `:434` (`const LINE_IS_PLANT = ACCOUNT_STOCK;`) and `:469`.

**What it is.** The books review decides whether an invoice line is a PRODUCT or a SERVICE by
matching the QuickBooks **account name** against a regex naming two grower accounts. A business
whose product account is called *"Merchandise"*, *"Food Distribution"* or *"Parts"* matches
nothing, so **every one of its product lines is classified as something else** — silently, with no
row reported as unclassifiable.

🔴 **This is not a label, it is a CLASSIFIER, and it is in `shared`.** AC-1 says vertical identity
is a value, never an identifier — here a vertical's own account names are compiled into platform
logic. The name `LINE_IS_PLANT` is the tell: the platform concept is *"this line is stock we
sell"*, and it has been given a grower's name because a grower is the only tenant so far.

⚠️ **NOT a live defect today — and that is exactly why it is being filed rather than fixed.** LAWNS
is the only tenant, LAWNS's accounts do match, so the classifier is right on every row it has ever
seen. It fails the first time a non-grower runs the books review, and it fails **quietly**.

**Fix.** The account-name → line-kind mapping is per-business configuration (or at minimum a
per-vertical list beside `discovery/verticals/`), not a constant. ⚠️ **It needs a ruling first:**
a business's chart of accounts is theirs, so *"which accounts are product?"* is a question only the
owner can answer — which makes this an onboarding surface, not a code change.

**Blast radius.** One tenant today. **Every non-grower tenant at the moment there is one.**

**Trigger.** The second vertical, or any LAWNS account rename.

---

## #296 — 🟡 TWO GROWER MAGIC VALUES IN `shared`'S PRICING ANALYSIS: A `"N Gallon"` SIZE FORMAT AND A 0.6 PLANT-SHARE (NEW 2026-09-14, ledger #328, recon #327)

**Where.** `packages/shared/src/business-logic/serviceReview.ts`

| line | literal | what it assumes |
|---|---|---|
| `:407` | `if (!/^\d+(?:\.\d+)? Gallon$/.test(folded)) continue;` | a size is written *"30 Gallon"* — a container volume, with that exact spacing and capital G |
| `:78` | `export const UNIT_PLANT_SHARE = 0.6;` | 60% is the share above which a line is "mostly the thing itself" rather than a service |

**What it is.** Two separate assumptions, filed together because they are the same class in the same
file: **a grower's units written as constants in a shared module.**

🔴 **`:407` is stricter than it looks and it is a `continue`** — a row that does not match is
skipped, not reported. So a business whose sizes read `"5 lb"`, `"case of 12"` or `"30 gal"`
(**lowercase — a spelling LAWNS itself uses; `productionMath.ts`'s header records 46 distinct
spellings of 13 sizes**) drops out of the ladder silently, and the analysis is computed over a
subset nobody is told about. **#182's shape: a scan that states no expected population.**

⚠️ **`UNIT_PLANT_SHARE = 0.6` is a different kind of problem — the NUMBER may well be universal
and only the NAME is grower.** The threshold *"is this line mostly product or mostly service?"* is
a real platform question. **Do not rename it and call it fixed**: whether 0.6 holds for a business
with different margins is unmeasured, and nobody has asked.

**Fix.** `:407` — reuse the existing shared `parseUnitOfMeasure` / `normalizeSize` rather than a
bespoke regex (§6 r8; `unitOfMeasure.test.ts` already carries 166 assertions about this). `:78` —
rename to `UNIT_SELF_SHARE` **and** record what the 0.6 was derived from, or that nobody knows.

**Blast radius.** Silent under-counting for any tenant whose sizes are not `"<n> Gallon"`.

**Trigger.** The second vertical, or any size-vocabulary work.

---

## #297 — 🟡 GROWER UNITS ARE KEYS ON AN EXPORTED `shared` INTERFACE, THE FILE'S OWN AC-1 CLAIM IS 80% TRUE, AND ONE OF THE KEYS NOW HAS A SECOND HOME AT A DIFFERENT PRECISION (NEW 2026-09-14, ledger #328, recon #327)

**Where.** `packages/shared/src/production/productionConfig.ts:56,58` (the interface) and `:112,113`
(the defaults).

```ts
export interface OperationsConfig {
  tradeGallonFactor: number;        // :56
  trueGallonsPerCubicYard: number;  // :58
```

**What it is.** `OperationsConfig` is the shared production-planning config type. Two of its keys are
**grower units**: a food bank's operations config has no gallon factor and no cubic yards.

✏️ **AND IT CORRECTS THE FILE'S OWN CLAIM.** `productionConfig.ts:43` asserts:

> *"AC-1: **generic throughout. No vertical noun in any key, type or identifier.** 'Uppot' is a
> cultivar-vertical LABEL and appears only in the cultivar surface."*

✅ **The `uppot` half is TRUE and was verified** — `uppotNow` is an internal field name only, the
label lives in the cultivar surface, and the precedent it cites (`responsibilityCatalogue.ts`)
holds. 🔴 **The "no vertical noun in any key" half is FALSE**, on the same page. **This is the
fifth comment-contradicts-its-own-repo instance logged in a fortnight** (cf. #188, #61, #180, and
`serviceOfferingEnums.ts`'s header, corrected in ledger #328) — **and it is the dangerous kind,
because being 80% right is why nobody checked the other 20%.**

✅ **THE TABLE UNDER IT IS CORRECT, AND THAT MATTERS MORE THAN THE TYPE.**
`20260905_production_planning.sql:57-62` stores this as a `jsonb config` blob — **variation in
DATA, not schema.** So the storage is AC-1-clean and only the TypeScript narrows it.

🔴 **THE FIX IS FREE RIGHT NOW AND WILL NOT STAY FREE.** tech-debt **#253**: that migration is
**NOT APPLIED** — all three tables are absent live — so `shared/src/production/` (1,731 LOC) and
the whole `UppotPlan` surface read and write tables that do not exist. **There is no live row to
migrate. Rename the keys before it is applied, or pay for it afterwards.**

➕ **FOLDED IN 2026-09-14 (David's instruction) — `trueGallonsPerCubicYard` NOW HAS TWO HOMES AND
TWO PRECISIONS. This is NOT a separate defect and must not be filed as one: it is a second copy of
a key already queued for renaming here, and splitting them means two sessions touching one line.**

| home | value | as written |
|---|---|---|
| `packages/shared/src/production/productionConfig.ts:126` | `201.974` | a rounded literal, 6 s.f. |
| `packages/cultivar-os/src/lib/loadList.ts:42` | `201.97402597…` | `GALLONS_PER_CUBIC_YARD = 46656 / 231` — derived (231 in³/gal, 46,656 in³/yd³) |

**One physical constant, two definitions** (§6 r8). ⚠️ **The arithmetic gap is negligible — ~1.3e-7
relative, far below any material-ordering tolerance — so this is a DRIFT risk, not a wrong number
today.** Recorded because the two are no longer the same expression: one is a literal somebody must
remember to update, the other is derived and cannot go stale.

🔴 **WHOEVER FIXES #297 MUST FOLD THIS, NOT LEAVE A SECOND COPY BEHIND.** Renaming the shared key
while `loadList.ts` keeps its own derived constant would resolve the AC-1 half and **leave the
duplication — which is the state that produced [[R-152]]'s three-month outage.** The derived form
is the better one to keep.

✅ **AND `loadList.ts` IS NOT AT FAULT — STATED SO NOBODY "FIXES" IT BY MOVING IT INTO `shared`.**
Ledger #315's load list is AC-1-CORRECT: it touches nothing in `shared`, keeps its grower vocabulary
in the vertical deliberately, and imports the generic operations rather than forking them. Its own
header says so — *"this file lives in `cultivar-os`, NOT in `shared`, and deliberately … the two
things that ARE general (reading a size out of a sentence, naming a unit) are imported FROM shared
rather than re-implemented here (R-27)."* **The duplication is a consequence of the shared key being
grower-named in the first place**, which is this entry.

**Fix.** Move the grower keys into a nested `vertical: {}` sub-object, or rename to the platform
concept (a unit-conversion factor and a bulk-material density). Correct `:43`'s claim either way.
**And resolve the two homes above in the same pass** — one definition, derived, read by both.

**Blast radius.** No live rows (the table does not exist). ~6 call sites in `productionMath.ts`, **plus the second home in `loadList.ts` that must be folded, not left standing.**

**Trigger.** 🔴 **Before `20260905_production_planning.sql` is applied.**

---

## #298 — 🟡 THE SHARED SERVICE PICKER STILL OFFERS "per plant" TO EVERY VERTICAL — THE REFUSAL IS FIXED, THE AFFORDANCE IS NOT (NEW 2026-09-14, ledger #328)

**Where.** `packages/shared/src/business-logic/serviceOfferingEnums.ts` (`PRICE_UNIT_OPTIONS`) and
`packages/shared/src/business-logic/serviceReview.ts:105` (`PRICE_UNITS`), rendered by
`packages/shared/src/pages/Settings.tsx:1075` and
`packages/shared/src/components/services/ServicesReview.tsx:569`.

**What it is.** Ledger #328 removed every *refusal* of a non-grower price unit — the CHECK
constraint, the seed's silent coercion, the books-review gate, two closed TypeScript unions and the
AI prompt. **It did not change what the dropdown OFFERS.** A food bank owner opening Settings →
Services still sees a `<select>` containing **"per plant"**, and does not see "per household",
because the list is four hardcoded values in a shared module.

⚠️ **SO THE COLUMN IS OPEN AND THE ONLY UI THAT WRITES TO IT IS NOT.** A vertical can supply its
own unit through `discovery/verticals/` (which is what #328 unblocked, and it works), but an OWNER
cannot type one. **That is a real remaining hole and it is filed rather than implied.**

🔴 **DELIBERATELY OUT OF SCOPE FOR #328, ON DAVID'S INSTRUCTION** — *"NOT NOW: the surface move…
the trigger is a commissioned vertical, not a tidy-up."* Changing a shared `<select>` into a
per-vertical or free-text control is a UI decision with owner-test consequences, not a constraint fix.

**Fix — and it needs a decision, not just code.** Three shapes, cheapest first:
1. **Free text with the four as suggestions** (`<input list=…>`). Cheapest; loses the guarantee that
   two businesses spell the same concept the same way.
2. **Per-vertical option lists**, beside `discovery/verticals/`. Consistent with the seed pattern
   #328 leaned on, and AC-1-correct.
3. **The R-152 shape — a lookup table** both the constraint and the picker read. David ruled exactly
   this for channel names: *"one list… Adding a channel becomes a row, and drift becomes
   structurally impossible rather than a discipline."* Fullest, and the only one that also restores
   a curation guarantee.

⚠️ **`isUsablePriceUnit` already guards whatever the picker produces**, so none of the three can
write a value the column rejects.

**Blast radius.** Cosmetic for cultivar (its units ARE these). **Blocking for the first vertical
whose owner needs to name their own unit.**

**Trigger.** A commissioned second vertical.
---

## #304 — 🟡 **PARTIAL 2026-09-15 (ledger #337): THE HALF-WIPE IS FIXED, THE MEANING IS STILL DAVID'S — AND THE PREMISE WAS WRONG IN THE DIRECTION THAT MATTERS.**

✏️ **CORRECTED 2026-09-16 (ledger #342) — "FIXED" WAS TRUE ON A BRANCH, NOT ON `main`.** Ledger #337's GATE 2
(`a9968e8`) sat on `origin/fix/undo-refuses-before-deleting` and **was never merged**; this entry reached `main`
through #333's docs (`2a96bc4`), so `main` carried *"the half-wipe is fixed"* over code that still half-ran.
[[R-26]]'s shape, one more time. **#342 carries #337's GATE 2 code verbatim (`f67d30d`) and replaces the write
half with ONE plpgsql transaction** (`undo_import_run`, `20260916c`, NOT APPLIED) that refuses on any live record
and removes the run's practice orders with it — so the half-run is closed **once 20260916c is applied**, and
until then the undo refuses outright rather than falling back. **#337's DOCS (owner-role CARD 17, catalogue CARD
12b) are still only on its branch.**

🔴 **IT DID NOT NEED THE SEED. IT WAS ALREADY LIVE ON LAWNS, AND THIS ROW SAID THE OPPOSITE.**
The row below reads *"WHY IT HAS NOT BITTEN YET — the imported rows have no ledger history at all
… The seed is the first thing that gives them any."* **Measured 2026-09-15: order
`6a60a0ca-dedf-4c1d-a58c-804bf1e64c79` — LAWNS, 2026-09-09, `order_kind = test`, `status =
fulfilled`, **$1,875**, self-transport — moved stock against an imported lot.** One test order
against one imported lot was enough. **The seed would do it 647 times; the seed is not what made
it live**, and this item was filed as a cost the seed *would* impose when it had already been
imposed six days earlier. ✏️ **[[R-26]]'s shape inside the row that was filed about [[R-26]]'s
shape** — a written claim about the world, not checked against it.

✅ **WHAT IS FIXED — GATE 2, and it is the ordering rather than the refusal.** `undoItemImport`
now reads the run's lots inner-joined to `business_inventory_ledger` **before any write** and
refuses the **whole** run with a sentence naming the held products. `handleBooksUndo` already
short-circuits on `items.refused`, so the customer half never runs either — the existing seam,
reused rather than forked.

🔴 **AND THE DEFECT WAS WORSE THAN THIS ROW'S "BLAST RADIUS" PARAGRAPH SAID, WHICH IS THE OTHER
CORRECTION.** That paragraph is right that the undo *"would delete the customers, then throw"*
and calls it *"not silent, but not what the button says either."* **It is worse than that: the
catch returns `{ ...empty }`, so the report says `customersDeleted: 0` for rows that were already
gone.** The error was honest and **every number beside it was wrong** — which reads as *nothing
happened*, and that is the state an owner would act on.

✏️ **THE MEASUREMENT THIS ROW ASKED FOR IS ANSWERED, AND NOT BY CARD 13.** It asked which of two
things happens — a visible refusal, or a reported success with the rows still present. **It was
always the VISIBLE REFUSAL:** `inv.error` is checked and thrown, and the leftover re-read is a
second, independent net. **The thing nobody had named was the customer delete that landed FIRST.**
CARD 13 on the opening-stock board is still worth running, but it is no longer the open question.

🔴 **WHAT IS STILL OPEN — AND IT IS THE WHOLE OF THE ORIGINAL ITEM: WHAT SHOULD THE UNDO *MEAN*?**
The three options below are untouched and none was taken. Making the refusal honest is not the
same as deciding whether *"import, look, wipe and reload"* survives a first sale — **and on LAWNS
it already has not.** Board `CARD 10` (*THE WIPE*) can no longer pass there.

---

### ORIGINAL ROW, PRESERVED VERBATIM BELOW

<!-- Deliberately NOT a `## #NNN —` heading: verify-id-citations clause C parses those as ROWS, and
     a second row for one id is a duplicate. It happens to pass today because the parenthetical sits
     between the id and the em-dash — which is an accident of a regex, not a decision, and the kind
     of thing that breaks on the next widening. The id appears in the preserved TEXT instead, so the
     log holds exactly one #304 row: the corrected one above. -->

🔴 **SEEDING A CATALOGUE MAKES ITS ROWS UNDELETABLE, SO THE IMPORT'S UNDO CAN NO LONGER DO WHAT IT SAYS** (NEW 2026-09-15, ledger #333)

**THE DEFECT, IN ONE SENTENCE.** The catalogue import promises Lauren she can *"import, look, wipe
and reload as many times as it takes"* (R-93). The opening stock seed writes a permanent ledger
row against every product it touches. **A lot with ledger history cannot be deleted** — so after a
seed, `undoImportRun`'s `DELETE FROM business_inventory WHERE import_run_id = <run>` **refuses**,
and the undo cannot complete.

**THE MECHANISM, MEASURED FROM THE CORPUS RATHER THAN ASSUMED.**
`business_inventory_ledger.inventory_id` is declared `ON DELETE SET NULL`. **SET NULL is an
UPDATE**, and §2 of the same migration installs
`BEFORE UPDATE OR DELETE … FOR EACH ROW … RAISE EXCEPTION` **with no exemption** — a referential
cascade fires row triggers like any other write. Its own header records this, and records that it
was **observed live**:

> `20260720_inventory_movement_ledger.sql:136-151` — *"⚠️ CORRECTED 2026-07-30 — THE `ON DELETE
> SET NULL` CLAUSE BELOW IS INERT. DO NOT RELY ON IT. … DELETE on business_inventory → SET NULL
> here → REFUSED (observed live: "business_inventory_ledger is append-only: UPDATE is not
> permitted"). **A lot with history is UNDELETABLE.**"*

🔴 **AND THE IMPORT WRITER'S OWN COMMENT SAYS THE OPPOSITE, WHICH IS THE PART WORTH FILING.**
`itemImportWriter.ts:485-490`, immediately above the DELETE:

> *"Every FK pointing at `business_inventory` in the migration corpus is `ON DELETE SET NULL`
> (cultivar_plants.inventory_id, order_items.business_inventory_id, inventory_counts.inventory_id,
> **business_inventory_ledger.inventory_id**) — **so those rows survive with a null anchor and
> nothing cascades.**"*

**That is true of three of the four and false of the fourth**, and the migration had recorded the
correction **forty-eight days earlier**. It is [[R-26]]'s shape inside our own corpus — a written
declaration nobody checked against reality, steering a decision — and it is load-bearing, because
it is precisely the sentence a builder reads before deciding the undo is safe.

**WHY IT HAS NOT BITTEN YET.** The imported rows have **no ledger history at all** — that is R-93's
whole point, and it is why the undo works today. The seed is the first thing that gives them any.

**BLAST RADIUS, AND IT IS NOT THE WHOLE UNDO.** `undoImportRun` deletes `customers` **first**, then
`business_inventory`. So a seeded run's undo would **delete the customers, then throw** — a partial
undo, stopped in the middle, with the error surfaced (the code throws rather than swallowing, and
the panel reports what landed). Not silent, but not what the button says either.

**THE THREE OPTIONS, NONE OF THEM TAKEN IN THIS PASS.**
- **(a) "The seed ends the rehearsal" — no code, a sentence.** The seed panel already says so in
  its closing line (*"Once a product has a starting number it has a history, and re-importing your
  product list will no longer clear it. Do your import first and press this last."*). Cheapest,
  honest, and possibly just correct: the ledger beginning IS the end of the rehearsal, which is
  R-93's own *"THE LEDGER BEGINS WHEN WRITES GO ON."*
- **(b) The undo TOMBSTONES instead of deleting.** `soft_delete_inventory` already exists and is
  the R-133 shape. It changes the import's contract from *"gone"* to *"retired"*, and the
  fingerprint checks that prove a clean undo would all need re-pointing.
- **(c) Exempt the referential cascade from the append-only trigger.** A migration, and it is
  **tech-debt #79's open question** — the same clause blocks deleting a whole tenant, which blocks
  the OP-12 reference-environment teardown. Deciding it here would settle it there too.

🔴 **WHAT IS OWED FIRST IS A MEASUREMENT, NOT A RULING: owner-test CARD 13 on the opening-stock
board.** It presses Undo after a seed on Test Dave's and records which of two things happens — a
visible refusal, or a reported success with the rows still present. **The second would be far
worse** (every later count reconciling against a catalogue somebody believes was removed), and
nothing in the repository settles which one it is, because the path has never been run.

**NOT FIXED IN THIS PASS, DELIBERATELY.** Re-shaping the import's undo inside a build that adds a
starting number is the scope creep that makes a diff unreviewable — and every option above is a
decision about what the undo MEANS, which is David's.


## #305 — 🟡 THE LEGACY-ADDRESS GUARD IS BLIND TO A DISAGREEING PAIR: BOTH COLUMNS POPULATED, DIFFERENT VALUES, AND THE DROP DISCARDS ONE SILENTLY (NEW 2026-09-16, ledger #335)

**The defect.** `20260915b` §1 refuses to drop `customers.address_line1/city/state/zip` while any row
holds a legacy value that `billing_*` does not. Its predicate — and owner-test CARD 1, which is the
same predicate as a list — is *legacy non-empty **AND** billing **EMPTY***. A row where **both**
columns hold a value and they **disagree** passes the guard, is not listed by CARD 1, and loses its
legacy value when the column is dropped. Nothing names it, nothing counts it, nothing refuses.

**Why billing wins, and why that is not the whole answer.** D-41 made `billing_*` canonical and the
legacy four a mirror, so keeping billing is the ruled outcome. But the guard's stated purpose is
*"refuse if dropping the column would destroy a value"* — and in a disagreeing pair it does destroy
one. **The guard asserts less than its own sentence claims.**

**Measured 2026-09-15 (David): ONE such row, on Test Dave's, both addresses fabricated. Ruled: nothing
to fix.** So this is not a live data loss — it is a guard that would have let one through without a
word, and the next destructive migration written from it inherits the blind spot.

**Surfaced, not guarded.** `20260915_backfill_legacy_customer_address.sql` §3 now COUNTS disagreeing
pairs in a NOTICE and its V3 lists them; CARD 1 names the blind spot in words. Neither refuses.

**Fix (not taken — the guard's shape is David's).** A second clause in `20260915b` §1 that either
refuses on a disagreeing pair or requires each one to be DECLARED (id + which side wins). ⚠️ A refusal
would have blocked on the one ruled-harmless Test Dave's row, which is the argument for a declaration
over a bare refusal (#73: a check that is red on arrival gets switched off).


## #306 — 🔴 THE CONTACT WRITER'S `ignoreDuplicates` TARGETS THE PRIMARY KEY, SO A COLLISION ON `value_norm` OR ON THE ONE-PRIMARY INDEX ERRORS INSTEAD OF BEING SKIPPED — AND THE SEED MOVES THAT FROM THE SECOND IMPORT RUN TO THE FIRST (NEW 2026-09-16, ledger #335)

**The claim in the code.** `contactWriter.ts` says the import is *"IDEMPOTENT BY CONSTRUCTION"*: it
calls `.upsert(rows, { ignoreDuplicates: true })` and relies on the partial unique indexes on
`(business_id, customer_id, value_norm)` to turn a re-imported number into a silent no-op.

**What the two systems document.** PostgREST (`docs.postgrest.org`, tables & views → upsert): *"By
default, upsert operates based on the primary key columns."* No `onConflict` is passed, so the
conflict target is `id`. Postgres (`INSERT` → `ON CONFLICT`): with a conflict target, the inferred
**arbiter** indexes are the ones handled; only when the target is **omitted** does `DO NOTHING` cover
*"all usable constraints (and unique indexes)."* The rows carry no `id`, so they never collide on the
arbiter — and a collision on `customer_phones_one_per_value` or `customer_phones_one_primary` is
**raised (23505)**, not absorbed. `writeContactRecord` then returns `ok: false`.

⚠️ **PROVENANCE: INFERRED FROM THE TWO DOCUMENTS, NOT MEASURED.** No live PostgREST request was made.
The proof is owner-test CARD 12 (a second import run) — which the board now says not to run yet.

**Why the suite is green.** `contactWriter.test.ts`'s double returns *"SUCCESS WITH ZERO ROWS AND NO
ERROR"* for ANY collision in `dup` mode and calls it *"the real PostgREST behaviour"* — it never asks
WHICH index collided or what conflict target was requested. **Tech-debt #138's class exactly: a double
more forgiving than the real system** (§6 r19 (a)).

**Why it matters NOW (ledger #335, 2026-09-16).** `20260915` §5b seeds every customer's existing phone
and email as an active PRIMARY row. The import then plans a primary for the same customer:
  · same number → collides on `one_per_value`;
  · different number → collides on `one_primary`.
**Either way the FIRST import run errors for most customers.** Without the seed the same defect waited
for the SECOND run (CARD 12). The seed is still right — without it the first list write blanks every
customer's address, phone and email — but it makes this blocking.

**Blocks:** owner-test CARDS 7, 8 and 12, and the LAWNS import (CARD 14).

**Options (David's call — none taken):**
1. **An RPC** doing `INSERT … ON CONFLICT DO NOTHING` with the target OMITTED — covers every unique
   index. Costs a migration and moves the write into SQL; the 12-function ceiling is unaffected (an RPC
   is not an `api/` file).
2. **Pass `onConflict: 'business_id,customer_id,value_norm'`** — ⚠️ PostgREST cannot express the
   partial index's `WHERE` predicate, so Postgres will not infer a PARTIAL index from it; this likely
   fails outright unless the index is made non-partial. Does nothing for `one_primary`.
3. **Plan `is_primary` from what exists**: read the customer's current rows first, never plan a second
   primary. ⚠️ A read-then-write — tech-debt #54's race — acceptable only because the import is a
   single-operator run.
**Whatever is chosen, the double must learn to refuse:** model the arbiter, and make a non-arbiter
collision return 23505.

🟡 **FIXED ON `feat/contact-record`, 2026-09-16 — NOT YET MERGED. Option 3 taken; options 1 and 2 were MEASURED, not inferred.**
**The measurement (PGlite — a real Postgres engine — run in a scratch directory, not the repo):**
  · the old write (`upsert`, `ignoreDuplicates`, conflict target = primary key) on a re-import →
    **23505 `customer_phones_one_primary`** — this entry's claim, now measured;
  · **option 2** (`onConflict: 'business_id,customer_id,value_norm'`) → **42P10, on EVERY call** —
    Postgres infers a partial index only when its predicate is restated, and PostgREST cannot send one.
    **It would have broken the FIRST import, not just the second;**
  · option 1's shape (`ON CONFLICT DO NOTHING`, target omitted) → absorbs a genuinely new primary
    number **silently — data loss**, so it would have needed option 3's primary logic anyway.
**The fix.** `reconcileContactRows` (pure) plans against what the customer already holds, and the writer
**INSERTs** only what is new: a held value is counted `held`; a new number is added non-primary if a
primary exists. **Addresses:** an identical one is held; a billing row that disagrees with a
**`migrated:` seed** retires the seed (`active = false`, R-133) and takes the default; any other clash
leaves hand-entered and earlier-import rows untouched (a taken default → the import lands non-default;
a taken label → reported in `notTaken`). The indexes stay the backstop, so a lost race is a loud 23505.
🔴 **WHY THE SEED RULE WAS NEEDED — MEASURED LIVE: 464 LAWNS customers have their PHONE as their billing
street** (the old importer never read `BillAddr.Line2`, #254). The seed copies that into a default
"Billing" row, and every one of them would have collided with the import's real street.
**The double now refuses what Postgres refuses** — every unique index from `20260911b` + `20260915`,
with predicates, derived-and-compared against the migrations (§I) — and its negative controls
reproduce both measured errors (F8, F9). **Red-first: 28 failures on the old writer, all #306's error.
64/64 after. 7 mutants, 7 caught.**
⚠️ **NOT PROVEN LIVE, AND IT CANNOT BE YET: `writeContactRecord` HAS NO CALLER** — no import screen
reaches it (measured 2026-09-16). CARDS 7, 8, 9, 12 wait on that wiring, not on this fix.

## #308 — 🟡 A TEST-MODE STARTING NUMBER HAS NO OPENING LEDGER LINE, AND NOTHING WRITES ONE AFTER THE SWITCH (NEW 2026-09-16, ledger #342)

✏️ **2026-09-21 — THE SAME DISCARD, SEEN FROM THE OTHER END, AND NOW RULED (ledger #370).** #308 says the opening line is missing in test mode; the measurement that day says every LATER test-mode movement is missing too. Of the nine functions that move `business_inventory.qty`, **only `undo_import_run` reads the write switch** — a count, an adjustment, the seed, a soft delete and a build run all move the number while `discard_ledger_row_in_test_mode` throws the ledger row away *"silently"*. Live on LAWNS: **512 rows carrying stock, 470 ledger rows, newest 16 September.** 🔴 **DAVID'S RULING: the banner was wrong, not the counts** — practice is what test mode is for, so the sentence now says counts change and that reloading the import resets them ([[R-63]] as amended). **What is still owed here and is NOT fixed:** on-hand and the ledger replay disagree for the whole of test mode, and only a reload puts them back. The ORDER path is unaffected — it still moves no stock.

**What.** David's ruling ② (2026-09-16): in test mode the opening-stock seed sets qty **only** on rows the
QuickBooks import created and writes **no** ledger row — *"the opening ledger entry is written once, after the
switch."* #342 built the first half (`openingStockTestWrite.ts`). **The second half does not exist.** After
QuickBooks writes are switched on, a test-seeded lot holds `qty = N` with `SUM(delta) = 0`, and the LIVE seed
skips it as *"already holds stock"*.

**Why it is not a one-liner.** No RPC can write it. `adjust_inventory_manual` takes an ABSOLUTE qty and writes
the difference — `N → N` is a no-op that writes nothing, and `N → 0 → N` writes two rows summing to zero, which
leaves the book and the ledger exactly as far apart as before. The row that is owed is a single
`+N opening_stock_seed` with **no qty change**, and only `emit_inventory_movement` (service_role only) can write
that. So the fix is a new SECURITY DEFINER function — *write an opening line for a lot that holds stock and has
no ledger history* — called once, at switch-on, by `QboWriteSwitch` or the switch's own server path. **A
migration, and a switch-on flow — neither is this build's.**

**Blast radius, stated rather than guessed.** Until it is built, the reconcile screen reads a test-seeded lot in
`baseline` mode (no prior count, no seed row — `reconcileMath.ts`), so the book is treated as correct and the
first count stamps the whole difference as one `count_reconcile`. Visible and correctable, not silent. And
`scripts/rls/inventory-ledger-replay.rls.mjs` (NOT in `npm run verify`) asserts `SUM(delta) = qty` for every
lot — it will name every one of these rows.

**Blocks:** switch-on for any tenant that seeded in test mode (LAWNS: 554 seeded rows, per the prompt of
2026-09-16). **Owner:** David — the shape of the switch-on moment.

## #311 — 🟡 NOTHING TELLS THE OWNER THAT QUICKBOOKS WRITES ARE STILL OFF — AND SIX CHECKOUT/PLANT SCREENS SHOW NO TEST-MODE BANNER (NEW 2026-09-16, ledger #335)

**What.** Risk check asked by David (his 2026-09-04 ask): *is there anything that alerts the owner that
writes are still off?* **No.** The only signal is the amber `TestModeBanner`, mounted once in
`AppLayout.tsx:62`. Nothing reminds, nags, emails or counts days in test mode.

**And the banner is not on every screen that changes stock.** Routes outside `AppLayout`
(`router.tsx:99–105`) render no banner: `/plant/:tagId`, `/plant/:tagId/addons`, `/checkout/addons`,
`/checkout/customer`, `/checkout/review`, `/checkout/confirm`. Checkout decrements stock
(`api/orders/submit.ts`); the confirmation screen carries its own test-mode sentence
(`Confirmation.tsx`), the steps before it do not.

**Also, stated:** the banner says *"your tree counts do not change"*. Under ledger #344 the COUNT on a
desk edit, count or delete DOES change (only the permanent history line is not written), so the
sentence is now inaccurate for those. Not reworded here.

**Fix (not built, on instruction):** a reminder for the owner while writes are off (wording and
cadence are David's), the banner on the checkout routes, and a corrected banner sentence.
**Owner:** David.

## #312 — 🟡 A MEMBER WHO CAN UPDATE CUSTOMERS BUT NOT CREATE THEM CANNOT ADD A PHONE, EMAIL OR ADDRESS (NEW 2026-09-16, ledger #335)

**What.** The contact lists' INSERT policies require `customers:create`
(`20260915_contact_record.sql` §3, and `20260911b` for addresses). Changing a customer's phone in the
editor is an UPDATE of the customer, but it becomes an INSERT into `customer_phones`. A role holding
`customers:update` without `customers:create` is refused — loudly; nothing is lost.

**Measured 2026-09-16:** no LAWNS member is in that position (MANAGER and both OWNERs hold both).

**Fix:** the list INSERT policies accept `customers:create OR customers:update`, or the editor's contact
writes go through a SECURITY DEFINER path gated on `customers:update`. A permission-model decision —
David's. **Not a go-live item** (David, 2026-09-16).

## #313 — ✅ RESOLVED 2026-09-17 (ledger #345) — WAS: 🟡 A PAGE LEFT OPEN ACROSS A DEPLOY KEEPS RUNNING THE OLD CODE, AND NOTHING TELLS THE PERSON (NEW 2026-09-17, ledger #335)

**✅ BUILT (ledger #345):** the build writes `/version.json` (a static file — 12/12 held); `NewVersionPrompt`
checks it on every navigation and when the window regains focus, and when production is newer shows
**"A new version is ready — reload"**, reloading on tap. A local build or an unreadable file never prompts.
`newVersion.test.ts` §A–§C. Prompt, not force — the person taps.

**What.** The app has no new-build check. The build id is only DISPLAYED (`VersionStamp.tsx:92`);
nothing compares it with the deployed one, prompts, or reloads. Measured 2026-09-17: David's phone kept
serving `2a2f862` after production flipped to `6bdcf15` at 14:15 UTC, until he reloaded by hand.

**Why it matters now.** Before ledger #335, a stale page's customer save silently succeeded. Since
`20260915_contact_record`'s guard, an OLD page that writes `customers.phone` / `email` / `billing_*`
directly (the old customer editor) is REFUSED — the save fails with "Not saved…" instead. That is the
safe direction, but the person sees a failure they cannot explain. Checked live: between 14:00 and
14:40 UTC no app write was refused on any tenant (the two refusals in the log were David's SQL-editor
checks). Also a lazy-loaded screen whose chunk was replaced by the deploy fails to open on an old page.

**Fix (not built):** on focus / navigation, fetch the deployed build id (e.g. a tiny `/version.json`
emitted at build — a static file, not an api function, so 12/12 holds) and, when it differs, show
"A new version is ready — reload" (or reload on the next navigation). **Owner:** David — prompt or
force.

## #314 — 🔴 A CAPTURE FOR A CUSTOMER WITH NO PERSON LINK CREATES A DUPLICATE CUSTOMER (NEW 2026-09-17, ledger #345)

**What.** `findOrCreateCustomer` dedups a PERSON by `person_id` after resolving the person by email/phone.
A customer with no `person_id` — **every QuickBooks-imported customer**, and 5 of 14 on Test Dave's
(measured live) — is never matched, so invoice capture (and any server-side match) makes a SECOND
customer and puts the typed details on it. Found by the writer-registry path test `ocr.existing-customer`
(first written against an imported-shape customer; it failed that way).

**LIGHTNING'S LEAN (2026-09-17, recorded — David decides):** match a person-less customer on **phone**, or on
**street + ZIP**, then ASK — *"Is this <name> at <address>?"* — before linking. **Never on email alone** (#53).

**Fixed for checkout** (ledger #345): the checkout pick now attaches, so the server does not re-match.
**Not changed for capture:** matching an existing customer by email alone is the rule that cross-billed
nine invoices (#53, D-47). **Fix = a ruling:** link a person-less customer by email/phone when exactly one
matches in the business, or surface it for a choice. **Owner:** David.

## #315 — ✅ RESOLVED IN THE BUILD THAT FOUND IT — A MANAGER'S SHIP-TO CHANGE WAS "SAVED, NOT RECORDED" (NEW 2026-09-17, ledger #345)

**What.** `stopWrites.saveShipTo` inserted its history row with `.select('id')`. Returning the row needs a
SELECT policy on `audit_log` — `audit_log:read` — and **no MANAGER holds it** (measured live 2026-09-17,
both tenants). Postgres refuses the whole INSERT, so every ship-to change Lauren made was reported
"saved, not recorded" and left no history. Found while building the contact change log, which failed the
same way in the path tests. **Fix:** both inserts prove themselves by count (`{ count: 'exact' }`), not by
reading the row back. `stopWrites.test.ts` C0 — red on the old code, green now; the fake now refuses
`.select()` the way RLS does (§6 r19).

## #316 — 🟡 THE ROUTE PLANNER'S STOP-ADDRESS BOX IS TYPED AND NEVER SAVED (NEW 2026-09-17, ledger #345)

**What.** `DeliveryRoute.tsx` lets a person edit a stop's address to build the map link; the value is
kept in page state only. Under §6 r21 *"a value entered and not saved is a defect"* — unless it is meant
to be scratch. **Declared** in `writer-registry.json` as not-a-capture, with this reason, so the check
names it every run. **Owner:** David — keep it as scratch, or save it to the stop (the ship-to editor
already does that properly).

**LIGHTNING'S LEAN (2026-09-17, recorded — David decides):** save it as a ship-to through `contactWriter`
(a typed value not saved is a defect under §6 r21); at minimum, label the box **"not saved"**.

## #317 — ✅ RULED 2026-09-17 BY DAVID ([[R-162]]) — STAFF MAY ADD, NEVER EDIT / MAKE MAIN / REMOVE (NEW 2026-09-17, ledger #345)

**✅ DAVID'S RULING (2026-09-17):** *"STAFF MAY ADD a phone or email — never Edit, Make main or Remove.
Adding cannot destroy anything, and refusing it means a counter staff member cannot write down a new
mobile at all."* **Built on `fix/contact-list-edit-add` (ledger #349):** `20260917d` (WRITTEN, not
applied) opens the phone and email INSERT policies to any member who may READ the customer; the address
list stays `customers:create`; every UPDATE policy is untouched. The customer page offers Add to a
reader and withholds Edit / Make main / Remove. Path test `customer-page.add`, red-first without the
migration. ⚠️ **Checkout is a separate surface and is NOT changed by this:** typing over a picked
customer's phone there still needs `customers:update` and is reported NOT SAVED otherwise, because at
checkout the typed value REPLACES what is shown rather than adding a row. Say if that should follow
the same rule.

**WAS:**

**What.** Ledger #345 saves typed contact details for a picked customer only when the caller holds
`customers:update` (or is the owner). A STAFF member who types a new number gets **NOT SAVED** in red; the
order goes through. That rule was Thunder's choice, stated in the #345 report.

**LIGHTNING'S LEAN (recorded — David decides):** staff may **ADD** an additional phone or email (it never
changes which one is main, and nothing is removed); only `customers:update` may **Make main** or **Remove**.
Note the list INSERT policies ask for `customers:create`, which STAFF does not hold either (#312's shape), so
the lean needs a server-side path, not only a changed check in `submit.ts`.

## #318 — 🟡 THE QUICKBOOKS IMPORT IGNORES A CHANGED PHONE, EMAIL OR ADDRESS ON AN EXISTING CUSTOMER (NEW 2026-09-17, ledger #345 — confirm or change)

**What.** On an existing customer, the import updates the three tax-exemption columns and nothing else.
✏️ **CORRECTION TO THE #345 REPORT:** it called this *"your earlier ruling"*. **It is not a ruling of
David's.** It is a BUILD decision from ledger #278 (2026-09-06), written in
`customerImportWriter.ts`'s header:

> *"WHAT AN EXISTING ROW ACTUALLY RECEIVES: THE EXEMPTION, AND NOTHING ELSE."* …
> *"NAME, EMAIL, PHONE AND ADDRESS ARE NOT TOUCHED ON AN EXISTING ROW. Those may have been curated locally —
> corrected by Lauren, filled from a delivery, fixed after a bounced email — and QuickBooks is not
> automatically the better copy. Overwriting them would be the clobber `findOrCreateCustomer` was rewritten
> in August to stop doing."*

It leans on the fill-never-clobber rule `customerUpsert.ts` records as *"the machine-writer ruling (David,
2026-07-29)"* — that ruling is about a counter checkout blanking a curated value, and it is **not** in
`docs/RULINGS.md`. **Under the contact lists the clobber no longer applies:** a QuickBooks number that differs
can be ADDED (kept as additional) without touching the main one, as checkout now does. **Owner:** David —
confirm "existing rows keep their contact details as they are", or change it to "add what QuickBooks has
that we don't".

**PROVENANCE, CORRECTED BY LIGHTNING (2026-09-17):** the fill-never-clobber rule IS a ruling — it was given in
a Lightning prompt (*"MACHINE WRITERS NEVER OVERWRITE CURATED FIELDS … fill-if-blank, never clobber"*) and
lives in chat history, **not in `docs/RULINGS.md`**.

**LIGHTNING'S LEAN (recorded — David confirms):** under the contact-card model (2026-09-15), keep the rule
for the **MAIN** value only: the QuickBooks import never replaces a customer's main phone, email or billing
address. A new or different value from QuickBooks is **ADDED** as an additional list entry through
`contactWriter`, like checkout (CARD 15). Nothing overwritten, nothing dropped.
**On David's confirmation:** file it in `RULINGS.md` with its date, and build it as a registered path in
`writer-registry.json` with its end-to-end test.

## #319 — ✅ RESOLVED 2026-09-21 FOR THE OFFICE DOOR (ledger #369) — WAS: 🔴 GO-LIVE: FINISHING A DELIVERY STOP DOES NOT FULFIL ITS ORDER (NEW 2026-09-17, ledger #345 Part C)

**Resolved.** David, 2026-09-21: *"lift it for the office door now; the crew door keeps holding until teams land."* Finishing a stop from the schedule now fulfils its order through `/api/orders/submit` — the one endpoint that owns the stock move — and **Undo done reverses it**, restoring the status the stop remembered (`20260923`, a single nullable column, because the transition log is discarded in test mode and LAWNS's stop-bearing orders sit at three different statuses, so there is nothing to derive and nothing safe to guess). A member who can finish stops but not change orders gets the stop **and a red line naming what did not happen**. The crew door is untouched. 21 assertions; both of David's flags proven red first.


**What.** `useStopActions.tsx:130` sets the stop to fulfilled and nothing else: the order's status stays
where it was, and `handleStatus` in `api/orders/submit.ts` — which moves stock for a fulfilled order — is
never called. So a truck run completed in the app leaves every order open.

**Why it is a go-live item.** It sits on the bar *"take an order, get it on a truck, bill it correctly"*.
**Automatic SPM consumption depends on it**: stock (and the per-order consumption it will record) moves on
ORDER fulfilment, so while a finished stop does not fulfil its order, nothing is consumed.
Found in the #345 Part C census; the delivery-stops domain is second in the writer-registry proposal.

## #320 — ✅ RESOLVED 2026-09-18 (ledger #351, [[R-163]]) — WAS: 🟡 NO ROUTE ORDER IS SAVED, SO THE CREW LINK LISTS STOPS IN SCHEDULE ORDER

**RESOLVED — and David corrected the priority of this item the same day it was filed.** It was filed as 🟡 and accepted as such; David, 2026-09-17: *"Your flag (b) / #320 undersold it … Lauren's ROUTE THIS DAY optimisation is a feature she values and uses every delivery day."* Fixed by `20260917e` + `saveRouteOrder`: the optimised order is saved on Route this day and the phone, the schedule and the printed sheet read it through one `readStops`. The original text follows.


**What.** The route screen (`DeliveryRoute.tsx`) works out the stop sequence on screen each time and keeps it
nowhere — no column, no table. So the crew day link (`crew_day_stops`, migration `20260917c`) lists a day's
stops in the schedule's order (date, then when each stop was made) and SAYS so on the page: *"in the order they
were scheduled, not a planned route"*. The driver still picks the order, as today.

**The fix.** Store the chosen sequence when Lauren routes a day (a `route_position` on the stop, or a small
day-route row), and have `crew_day_stops` order by it. Not built in #347: the Saturday pilot is about capture,
and the route screen's own save path is its own change.

## #321 — ✅ RESOLVED 2026-09-17 IN THE BUILD THAT FILED IT (ledger #347, [[R-161]]) — WAS: 🟡 TWO WAYS TO MARK A STOP DONE, ONLY ONE REGISTERED

**What.** The crew link's Done (`crew_stop_act`) is registered in `writer-registry.json` → `stop-progress`,
records the typed name, HOLDS the review ask, and can be undone the same day. The in-app **Mark done**
(`useStopActions` → `fulfilmentPatch`) writes the same `status` / `started_at` / `completed_at` columns through
RLS, records no name beyond the session, shows the review prompt at once, and cannot be undone. One fact, two
writers (§6 r8), and the second is outside the registry.

**FIXED, and the decision it was waiting on was made rather than assumed.** David ruled the same day
([[R-161]]): *"the office's Mark done must behave like the crew's Done — HOLD the review ask (never spend it)
and be undoable — so both doors do the same thing. One completion writer, registered with its path tests."*
So `stop_progress_apply` (20260917c §4b) is now the one writer; `crew_stop_act` (token) and the new `stop_act`
(a logged-in member with `deliveries:update`) are its two doors. Same columns, same event row, same audit row,
one undo rule. `useStopActions.markStop` no longer writes `deliveries` at all — it calls `stopAct`, and the
review prompt no longer opens there.

**Registered:** `office.start` · `office.done` · `office.undo-done`, each with an end-to-end test, plus the
guard `crew.both-doors-agree` (the two doors' rows compared, with a negative control that they are genuinely
different callers). Five new mutants: spending the ask, undoing after an ask, day-scoping the office door,
dropping the permission check, recording nobody — all caught.

⚠️ **RESIDUAL, NAMED:** `stopWrites.ts` still writes the same ROW for a different operation (the date move and
the ship-to edit). That is not a completion write and is not part of this domain yet; the `delivery-stops`
domain in `writer-registry.json` → `proposed` is where it lands.
## #309 — ✅ RESOLVED 2026-09-17, LIVE (ledger #343 — migration applied, merged `56107ee`) — WAS: 🟡 A STAFF LOGIN PRINTS THE LOAD LIST WITH THE STANDARD FIGURES, NOT THE NURSERY'S — BECAUSE IT CANNOT READ THEM (NEW 2026-09-16, ledger #343)

✅ **RULED AND BUILT 2026-09-17.** David: *"staff may READ the four planting figures (read-only)."* Option (a)'s intent, in a narrower form than a second table policy: a READ-ONLY function `get_planting_materials(business_id)` (§3 of the migration) returns ONLY the planting keys — plus the gallons-per-cubic-yard figure the same page converts with — to any ACTIVE member, NULL to anyone else, and nothing else from the row. anon cannot execute it. The load list reads it for every login; a refusal (NULL) and "nothing saved" ({}) print different sentences. **Executed on PGlite** (`scripts/sql-harness/ladder-install-posts-343.pglite.mjs` P7–P10, mutant M1 caught).

**AS FILED:**

🔴 **THE FOUR PLANTING FIGURES LIVE IN `business_operations_config`, AND THAT TABLE IS GATED `settings:read`.**
Ledger #343 moved the load list's per-tree figures — mix per gallon of container (2.0), rope per
T-post, bubblers per tree, deer-fence posts — out of a code constant and into Operations config,
which is what David ruled (*"it must be available as configuration"*). The table's read policy is
`settings:read` (`20260905_production_planning.sql`), and **STAFF hold no `settings:*` string at
all** (tech-debt #188). The yard person who carries the load list to the trailer is exactly the
person who cannot read the numbers it multiplies by.

**Under RLS a refused read returns NO ROW — the same answer as "nothing saved".** Left alone, the page
would silently print the platform defaults for staff while the owner's stored figures say something
else. **What #343 does about it, and it is a mitigation, not a fix:** the page asks the permission
rather than inferring from an empty row (`readLoadListSettings(businessId, can('settings:read'))`),
and a viewer without it gets the defaults AND a printed flag: *"These are the standard figures — this
login cannot read the nursery's own settings. Ask the owner to confirm them."* Every figure used is
printed on the page, so a wrong one is at least visible.

**Measured blast radius today: zero wrong figures** (read-only, 2026-09-16): `business_operations_config`
holds ONE row — Test Dave's, saved 2026-09-15 — and it carries none of the four keys; **LAWNS has no
row at all.** So the defaults ARE the figures for everyone right now. It becomes live the first time
an owner saves one.

**The decision is David's and it is a policy question, which is why it is not taken inside a print
view:** (a) a SECOND read policy on `business_operations_config` for `deliveries:read` holders —
the table holds no money (R-85 put money in `business_pricing_config`), so widening the READ leaks
no wage; (b) move the four keys somewhere staff already read; (c) accept the flag. **(a) is the
smallest and is one migration.**

## #310 — 🟡 THE LAST HARDCODED SIZE LIST: `LARGE_CONTAINERS` IN CHECKOUT, AND IT IS WRONG FOR LAWNS (NEW 2026-09-16, ledger #343)

🟡 **PREPARED 2026-09-17, NOT SWITCHED — option (b), on David's instruction.** The same migration adds `container_ladder.is_large` (+ `is_large_because`), LAWNS defaulted to **30 gal and above = large** (*"LAWNS default: 30 gal and above = large"*). **Nothing reads it:** `submit.ts` keeps `LARGE_CONTAINERS` until David confirms the switch. ⚠️ **The two disagree today and that is expected:** the list counts **15 gal** as large and misses **65** and **200**; the column says 15 is not large and 65 and 200 are. Switching changes which orders raise the leakage flag.

**AS FILED:**

🔴 **`packages/cultivar-os/api/orders/submit.ts:13` — `['15 gal', '30 gal', '45 gal', '60 gal', '100 gal']`.**
David ruled 2026-09-16: *"No second list of sizes, no size thresholds."* Ledger #343 removed every
other list (two dead copies in `lib/constants.ts`, the load list's threshold) and left this one,
because it is the one live list and replacing it needs a decision that is not the builder's.

**It is wrong on LAWNS's own ladder, three ways, measured against the live ladder 2026-09-16:**
- it has **no `65 gal` and no `200 gal`** — both LAWNS rungs — so an order of only those sizes never
  counts as "large";
- it names **`60 gal`**, a size LAWNS does not sell;
- it matches **exact strings** (`LARGE_CONTAINERS.includes(container)`), so a lot sized
  `45 Gallon` or `30` never matches `45 gal`/`30 gal` — and those spellings are live.

**What it drives: only the leakage flag** (`leakageFlag = anyLargeContainer && (nettingTotal +
otherTotal) === 0` at the submit path, and the same test on the edit path). **Nothing is charged
from it.** It is a dashboard alert that under-fires.

**Why it is not fixed in #343:** the ladder has no column that says "large". The obvious proxy —
*a rung with install T-posts is a tree that gets planted* (15–200 at LAWNS) — is an INFERENCE, and
choosing it inside a checkout handler would answer a question David has not been asked. Options:
(a) that proxy (`installTPostsPerTree > 0`); (b) a boolean column on the rung; (c) a threshold
volume in Operations config — which the 2026-09-16 ruling forbids. **The server path would also
need its own ladder read, and a failed read must never block an order (§6 r6).**
## #322 — 🔴 GO-LIVE: AFTER A RELOAD, CAPTURED ORDERS DO NOT RE-ATTACH TO THE RE-IMPORTED CUSTOMER (NEW 2026-09-17, ledger #348)

**What.** A reload deletes the imported customers and imports them again, and they come back with NEW
ids. A captured order (`order_kind = 'history'`, from an OCR invoice or the QuickBooks history ingest)
points at the OLD id, so after a reload it either blocks the undo or is left pointing at a customer
that is gone. David, 2026-09-16: **captured records are never removed — they must RE-ATTACH by
`qb_customer_id` after a reload.**

**Why it is a go-live item.** It is what stands between "test freely, reload whenever" and "the reload
refuses once training starts" — the undo refuses today while any captured order sits on an imported
customer (measured live 2026-09-17: 0, which is why tonight's reload is clear). After Friday's training
there will be some.

**Shape of the fix (not built).** The import already matches on `qb_customer_id`. Either (a) the undo
detaches a captured order's `customer_id` (keeping the QuickBooks id on the order) and the import
re-attaches it, or (b) orders carry `qb_customer_id` and the link is derived rather than stored. Both
need a ruling on what a captured order shows while it is detached. **Owner:** David.

## #323 — 🔴 AN ADDRESS IS SAVED WITH NO CHECK AT ALL, AND NOTHING KNOWS WHERE IT IS (FILED 2026-09-17, ledger #349 — NOT BUILT, David's direction)

**What.** Nothing validates an address anywhere: `505 new street, leander` saved silently on
2026-09-17 (David's own CARD 15 run). Customer addresses, ship-to sites and delivery stops all accept
whatever is typed, and **no coordinate is stored anywhere** — proven: zero `lat`/`lng`/`geocode`/
`geometry` columns in the whole migration corpus (the census recon measured this).

**What David asked for (2026-09-17, to be built after Saturday).** On every address save — customer
address, ship-to, stop — geocode it:
- **found** → store the coordinates (where they are stored is undecided — no id) and show which **delivery ring** it
  falls in (the ring map / $3.50 loaded mile, David 2026-09-12);
- **not found** → say *"we can't find this address"*, **ALLOW the save**, and mark it **unverified** —
  a new street may genuinely not be mapped yet. Surface it; do not decide for the person;
- **unverified addresses carry a marker** on the delivery schedule and the day sheet.

**What the two recons concluded** (David's own, 2026-09-15, in his checkout — read for this filing;
both are RECON ONLY, uncommitted, nothing shipped):

`docs/recon/census-geocode-2026-09-15/` — **the free federal geocoder, run against LAWNS's real 1,959
QuickBooks customers.**
- **84.9% of resolvable addresses matched** (1,217 of 1,433); 62.1% of all 1,959 got a coordinate.
  The August 60-address sample said 85.0% — it held at 24× the volume, 0.1 points apart.
- **The misses are geography, not data quality: 61% are new-construction streets** TIGER has not
  absorbed — Liberty Hill misses **35.3%**, Austin **2.0%**. No cleaning recovers them.
- **17 misses are ours**: 9 phone-in-street rows (a tighter rule catches all 9 — this build's contact
  lists already move those to the phone list), 5 with no house number, 3 PO boxes.
- **Free, no key, no quota, one batch:** all 1,433 in ONE multipart POST in **6.13 seconds**; the
  documented ceiling is 10,000 per file. ⚠️ It returns rows in a different order — join on the id.
- `Tie` returns no coordinate (8 rows) and `Non_Exact` (207) is a weaker match that must not be shown
  as an exact one (D-9).

`docs/recon/two-stage-geocode-2026-09-15/` — **"Google normalises, Census geocodes" — the verdict is
that it does not pay.**
- **The ceiling is +3.3 points.** 168 of 216 misses (78%) are TIGER coverage gaps no normaliser can
  touch: a *perfect* stage ① takes 84.9% → 88.3%.
- **Licensing is one unresolved clause,** Google Maps Service Specific Terms §6.3.2: caching is allowed
  only where it is *"not used as a replacement for making an additional call"* — a stored spine is
  exactly that. A lawyer's question, not cleared.
- **Cost: the initial run is free** (10,000 free calls per SKU per month, then $5/1,000 — 1,433 calls
  is 14.3% of the free tier). 🔴 **But Google has no batch endpoint** (1,433 separate calls, ~1–2
  minutes at 25 QPS), and under §6.3.1 coordinates must be **deleted and re-fetched every 30 days** —
  ~165 addresses (11.5% of the book) on a permanent monthly refresh job that exists nowhere today.
- It also found stage ① can **destroy a good address** (a normaliser "correcting" a real new street).

**Size (not built).** ~1½–2 days: a `geocode` seam + the census batch call (half a day, the recon's
resolver is written), 6 columns + a status on `customer_addresses` and `deliveries` with a migration
and a cap (half a day — the recon notes `customerAddresses.test.ts` §G is pinned to one migration file
and must be repointed), the unverified marker on the two screens and the save copy (half a day), the
ring lookup (half a day, and it needs the ring map as data — not yet anywhere).

🔴 **LIBERTY HILL IS THE REQUIREMENT, NOT AN OBJECTION (David, 2026-09-17).** The census geocoder misses
**35.3% of Liberty Hill** — Lauren's own town, because its streets are new. So *"we can't find this
address — saved anyway, marked unverified"* **is the behaviour to build**, not a reason to wait for a
better geocoder: a third of her home town's addresses will take that path on day one and must still save.

⚠️ **THE TRIP-CHARGE HALF WAITS ON DATA THAT DOES NOT EXIST.** The ring map (the $3.50 loaded mile,
David 2026-09-12) is not in the database, in a migration, or in any file — so "which ring is it in"
cannot be built until the rings exist as data. The geocode-and-mark half does not wait on it.

**Open, David's:** the geocoding service (Google vs self-hosted) and where the coordinates live.
✏️ **Corrected 2026-09-18:** this entry first cited those two as "the geocoding-service question (no id yet)" and "the coordinate-storage question".
No such items exist in the repo — the ids came from a prompt — and #327 has since been minted for
an unrelated item (the product import inserts). Neither question has an id yet. The recons' recommendation is Census first — free, batched, 85% — with
the misses shown as unverified rather than guessed at. **Nothing is built and nothing is chosen here.**

## #324 — 🟡 CLAUDE.md IS OVER ITS OWN BUDGET, AND THREE INVENTORY DOCS ARE THREE MONTHS STALE (NEW 2026-09-17, ledger #347 — David: file for after Saturday)

**What.** `CLAUDE.md` is **678 lines** against its own ~600-line budget (§CONTEXT BUDGET CHECK), and it
is loaded every session, so the excess is a tax paid before any work begins. Separately,
`docs/inventory-functions.md`, `docs/inventory-env.md` and `docs/inventory-ai.md` all still read
`Last updated: 2026-06-13` — three months behind the code they index, and §10 step 5 says to FLAG
them as stale before answering "what functions / vars / AI routes do we have?" from them.

**Why it is filed rather than fixed.** David, 2026-09-17: after Saturday. The trim is the still-open
§4 item *"Lean CLAUDE.md to rules + state + pointers only"* (the structural residual OP-13 left: §2's
infra tables ~155 lines, §6's coding rules, §9's standing instructions). Doing it inside a pilot build
is the drift the gates exist to catch, and a half-trim that loses a rule is worse than the tax.
⚠️ The OP-13 amendment is still open too: the budget counts LINES, and line 3 was once ONE line and
~1,400 tokens — so a character budget (`wc -c`) is the honest metric. David rules.

## #325 — 🟡 THE CREW PAGE IS ENGLISH ONLY, AND ITS READERS ARE THE PEOPLE R-151 IS ABOUT (NEW 2026-09-17, ledger #347)

**What.** `CrewDay.tsx` ships the first crew-facing surface built since [[R-151]] (*the person chooses
their own language, and they choose it on the invitation; translate the interface, never the data*),
and every string in it is inline English. David accepted English **for the pilot** and asked that
Spanish be filed as the next step against R-151. The wording was cut to a few words per control
(`Maps` · `Call` · `Start` · `Done` · `Undo` · `Note` · `OK`) so a translation layer has little to
carry and a non-reader has icons beside each one.

**Why it matters here and not in the abstract.** The crew are exactly R-151's population: David,
2026-08-31 — *"Cuto lives on site at LAWNS and does the maintenance. He does not speak English. The
install crews' English is not reliable either."* A link with no login is the first screen they will
ever hold, and it has no language control of any kind.

**The next step (not this build).** R-151's own clause: the choice belongs to the PERSON and is made
on the invitation. A crew link has no invitation and no person record — so the honest smallest form is
a two-word switch on the page itself (`English · Español`, both always visible, never a flag or a
globe), remembered per device beside the name. That is a decision for David, because it is the first
place the platform would store a language without a person to attach it to. ⚠️ R-151 also warns the
string layer must exist first or inline strings bypass it invisibly — so the layer, then this page.

## #326 — ✅ DISSOLVED 2026-09-18 BY RULING (ledger #352) — WAS: 🟡 NOTHING COMPARES A BILLED MATERIAL WITH WHAT THE SHEET SAYS TO LOAD (NEW 2026-09-17, ledger #350)

✅ **THE QUESTION STOPPED EXISTING RATHER THAN BEING ANSWERED.** This row asked how a BILLED bubbler should be reconciled with the COMPUTED one-per-tree count. David, 2026-09-18: *"the bubbler is manufactured and added with a cost so not on every tree, only those specified"* — **there is no computed count any more.** The billed line IS the number, it prints, and the exception that kept it off the sheet is gone. Nothing is left to compare.
⚠️ **WHAT REMAINS TRUE, AND IT IS SMALLER:** the line gives a COUNT, never WHICH trees. One live line carries that in free text (*"bubblers are for eaglestons and chinkapin oak only"*) and nothing structured holds it. If a crew ever needs to know which tree gets which bubbler, that is a capture question, not a reconciliation one.

**AS FILED:**

**Filed on David's instruction — "file, do not build".**

**What.** The load list computes the install materials from the trees: one bubbler per tree, T-posts off
each size, rope off the posts, mix off the container volume. The ORDER may also carry a BILLED line for
the same object — `Tree Bubbler` (`TB`) is the live case: **5 lines across LAWNS's book.** The sheet
prints the computed count and, since ledger #350, does **not** print the billed line, because printing
both would read as a demand for two bubblers where one is wanted.

🔴 **So nothing compares the two, and a disagreement is invisible in both directions.** A customer billed
for 4 bubblers on a 2-tree order gets 2 on the sheet; a 10-tree order with no bubbler line still says 10.
Neither is flagged. The same shape applies to any future billed material that is also computed.

⚠️ **This is a DELIBERATE exception inside a rule that says the opposite.** David, 2026-09-17: *"anything
physical that a customer bought is loaded on the truck, so it prints."* A billed bubbler IS physical. It
is the one physical thing kept off the sheet, and `loadList.ts` says so at the line (`NON_LOAD_LINES`),
with mutant **C15** holding the exception in place: delete it and the billed line prints again.

**Why it is not built here.** Reconciling billed-vs-computed is a RULE nobody has given: which one wins,
what a mismatch does to the printed sheet, and whether it belongs on this page at all or on the order.
Measured: it cannot be done from `service_offerings` either — LAWNS has four rows there and `Tree Bubbler`
is one of them, but nothing links an order line to a computed quantity.

**Owner:** David — the ruling. **Fix, when ruled:** compare the billed quantity for each computed material
against the computed total per stop, and surface a disagreement as a line in *"could not work out"* rather
than silently preferring either number.

## #344 — 🔴 A START CAN NEVER BE UNDONE, SO A TEST TAP IS PERMANENT ON THE REAL DAY'S RECORD (NEW 2026-09-18, ledger #351)

**What.** `stop_progress_apply` (20260917c §4b) has an `undo_done` and no way back from a Start. An Undo
clears the Done and deliberately KEEPS a real start (CARD 0b proved that is right for a genuine mis-tap
of Done). But a Start tapped in error — or in practice, the day before — can then never be cleared from
any screen. Found live 2026-09-18: Lauren (Thu 15:55) and David (Fri 10:10 — testing in his own browser with Mauro's name typed in; Mauro has not used the link, recorded by `20260918b`) practised on LAWNS's real
Saturday stops through the crew link; Freehill and Sappal kept `started_at` from Thursday/Friday. On the
day, the crew page would show **STARTED 10:10 AM** (no date, so it reads as Saturday), offer **no Start
button**, and a Done would record ~23 and ~41 **hours** on site. Cleared once by hand
(`20260918a_clear_two_test_starts_lawns_saturday.sql`) — the defect stays until this is built.

**The fix (filed, not built).**
1. **An `undo_start` action**, both doors ([[R-161]] — one writer), allowed only while the stop is NOT
   done: clears `started_at`, appends an event. The crew page offers a small **Undo start** beside
   **Done** on a started stop; the office card the same.
2. **Widen the `delivery_stop_events.action` CHECK** to admit `undo_start` — a migration.
3. **`stopActivity` treats `undo_start` like `undo_done`**: the latest start is cancelled by a later
   undo_start.
4. ⚠️ **Worth deciding with it — a day-boundary rule:** a `started_at` from a day EARLIER than the
   stop's own date is not a start of that job. The crew page could show such a stop as NOT STARTED and
   let Start overwrite it. That would have made today's practice taps harmless by construction; it is a
   rule about what a timestamp MEANS, so it is David's call, not a default.

**OPTION B, FILED HERE BY DAVID'S INSTRUCTION (2026-09-18) — A CORRECTION LAUREN CAN SEE.** `20260918b`
recorded that the two taps typed "Mauro" at 10:10 were David testing — but it recorded it in `audit_log`,
and 🔴 **managers cannot read `audit_log` (tech-debt #315)**, so Lauren, who reads the SCHEDULE, can never
see it. The general fix is a small append-only corrections record her role CAN read (an event id, the
actor it should be attributed to, a reason, who corrected it, when); the schedule's box then shows the
corrected name with a marker — *"Started 10:10 · David test (typed as Mauro)"*. It needs a migration and
a client read. ⚠️ **It is only useful once #315 is settled or deliberately routed around** — a correction
that lives where Lauren's role cannot read it corrects nothing she sees. And ⚠️ **the undo-start above
prevents most of these cases arising at all**: a practice Start that can be undone on the spot never
reaches the record, so there is nothing to correct.
**What was built instead, for Saturday (option A, 2026-09-18, ledger #351):** the schedule's box now
FOLLOWS THE STOP — a Started line only while the stop is started, a Done line only while it is done — so a
tap whose effect was cleared (like the two test starts `20260918a` removed) is no longer restated beside a
stop that contradicts it. That removes the Saturday symptom; it does not relabel a tap that still stands.

**THE CONCRETE COST, MEASURED (David, 2026-09-18).** On Test Dave's, the LEANDER stop was started on
**Thursday 14:34** (CARD 0b, office) and marked Done from the phone on **Friday 11:12** — so the schedule reads
**"1238 min on site"**. Not a fault in the arithmetic: it is exactly what a start that nothing could clear does to
the minutes figure. On a real day that number is a lie about how long a job took, and it is the number the
capacity model (one minute per gallon, never measured) was supposed to be corrected by. The box-follows-stop
fix (2026-09-18) does NOT touch this — it hides cleared taps; this start was never cleared. Undo-start, or the
day-boundary rule above, is what would have made it right.

**What it changes for the event history.** Nothing is erased: `delivery_stop_events` stays append-only.
The log would read *"started 10:10 — start undone 10:11"*, which is the truth; today it
can only read *"started 10:10"* forever, which is not. Every derived value — `started_at`, the grey box,
minutes on site — reads the NET state, exactly as `undo_done` already works for a Done. The audit row
per action (as for every other tap) records who undid it.

## #345 — 🔴 THERE ARE NO TEAMS: LAWNS RUNS TEAM 1, 2 AND 3 AND NOTHING CAN SEE OR SPLIT THEM (NEW 2026-09-18 — FILED, NOT BUILT, David's direction; no ledger row)

**What.** LAWNS runs its installs and deliveries as Team 1, Team 2 and Team 3 (discovery §8.4: *"Team One is Mauro, Team Two is the in-house crew … a team can be a contractor vendor"*). The platform has no concept of a crew as named people with a truck. The "crew" work so far is a PERMISSION role, and `business_positions` is a job title that grants nothing (LAWNS has one: "Production Manager").

✏️ **CORRECTS A PREMISE: `deliveries.team` DOES NOT EXIST.** The prompt that asked for this filing said it existed as free text with no picker and no reader. Measured live 2026-09-18, three ways: the live `deliveries` table has 24 columns and none is a team; no column anywhere in `public` has team, crew, driver or installer in its name; and no migration creates one and no code reads one. David accepted the correction.

**What it costs Lauren on Saturday 2026-09-19, measured live 2026-09-18:**
- **No stop carries a team**, because there is nowhere to store one. Which truck takes which of the 8 stops is decided by hand.
- **One crew link shows all 8 stops to whoever opens it.** `crew_day_links_one_live_per_day` allows one live link per business per day, and making a new one kills the old one. Both drivers open the same link.
- **Either driver can tap Done on any stop.** The name he typed is what the schedule shows.
- **The load sheet totals the day, not the truck.** Each stop's own trees, mix and posts print, so the crews can split the load line by line, but the totals at the top are for the whole day.
- **The saved route is one path through all 8 stops** (`deliveries.route_position` is one sequence per business per day), not one route per truck.

✅ **BUILD STARTED 2026-09-21 (ledger #362), in David's order: 1 → 2 (route per team AND persist the optimiser's miles/minutes) → 2.5 THE ESTIMATE (David's rule of 2026-09-21, replacing the fixed 8-hour rule: show drive time, distance and planting time as a day is scheduled; suggest one team until the estimate exceeds a PER-BUSINESS X, 7 h at LAWNS; planting minutes per tree is a per-business setting defaulted to 30; every estimate shows its working and Lauren can override) → 3, 4, 5.** Ground truth for 2.5, measured: `docs/fixtures/2026-09-19-lawns-saturday-capacity.md`.

**The six pieces, in the order David set (the first two first; everything else reads them):**

| # | Piece | What it takes | Size |
|---|---|---|---|
| 1 | **A team list per business**, editable by Lauren: name, who is on it, active | New tables for teams and members, with access rules scoped to the business; a Settings screen; one writer registered in `writer-registry.json` with its end-to-end path tests (§6 r21). **Members are NAMES, not logins** (David: a 1099 crew comes and goes, which is why the crew link needs no login). **An optional vendor link from the start**, because a team can be a contractor (Mauro). **Do not build the pay side.** | ~1 day + a migration David applies |
| 2 | **A stop carries its team**, set on the schedule or when routing | A team column on `deliveries`; a picker on the schedule and on the route page; the stop writer (next in `writer-registry.json`'s `proposed` list) | ~½ day + a migration |
| 5 | **The load list prints a section per team**, because each truck loads separately | The load-list model groups by team, with totals per truck and for the day. ⚠️ Blocked by David's hold on load-list changes until he lifts it | ~½ day |
| 4 | **The crew day link is per team**, so a driver sees only his own stops | The one-live-link-per-day index becomes per team per day; `crew_day_read` and `crew_stop_act` filter by team; the saved route order becomes per team. It rewrites functions proven by 30 of 30 caught mutants, so the harness is re-aimed with it | ~1 day + a migration |
| 6 | **Lauren's schedule shows the day split by team** | Grouping on the schedule only | ~½ day |
| 3 | **The 8-hour capacity rule applies per team, not per day** | 🔴 **BLOCKER: the rule has no wording.** `docs/RULINGS.md` holds it as owed — *"THE 8-HOUR RULE — WHAT EXACTLY WAS RULED? … A ruling cannot be numbered without its words."* It stays blocked until David rules its words. Not estimated. The input it will need is already being collected: `started_at` and `completed_at` are stamped on each stop | blocked, not sized |

**Ranked against go-live (Lauren running more than one truck a day):** 1 and 2 are the foundation. Then 5 and 4, because each truck loads and drives on its own. Then 6, which is display only. 3 waits on the ruling.

## #346 — ✅ BUILT 2026-09-18 BY LEDGER #355 (branch `feat/load-list-bulk-first`, not merged — David's call) — WAS: 🟡 THE LOAD SHEET SHOULD READ THE WAY THE TRAILER IS LOADED: BULK FIRST, THEN THE STOPS (NEW 2026-09-18 — ON HOLD, NOT BUILT; no ledger row)

**Held until Lauren has seen the current sheet** (David, 2026-09-18). The current layout was proven on paper the same day: CARD 6 and CARD 19 passed on `f9f3b8a · prod`.

**Today.** Section 1 is the special mix; section 2 is a species roll-up of every tree across all stops (*"2 · Trees — 29 in total"*); section 3 is the hardware. The roll-up pushes the hardware onto page 2, so mix and posts are two pages apart. Then "Per stop", "Also on the truck", and the figures page at the back.

**David's layout, decided 2026-09-18:**
1. **Page 1 is one bulk block:** special mix in yards, T-posts, **rope and bubblers with the posts**, water monitor kits, trunk protection, and deer-fence posts when a stop records a fence. The floor warning and the could-not-work-out line stay on page 1, because they qualify those totals.
2. **Then the stops**, each customer with their trees and quantities (today's "Per stop").
3. **The species roll-up becomes one line, "29 trees across 8 stops"**, and any not-set-up-size warning stays under it. ⚠️ **Unless Lauren says they pull from the yard by variety**, in which case the roll-up is a pick list and moves to the back beside the figures page instead. David is asking her.

**What it costs.** Only the page layout changes (`LoadList.tsx`); `buildLoadList` is untouched, so every figure is unchanged and there is no migration. ~1–2 hours. It also needs:
- the page-test assertion that names *"3 · Hardware"* rewritten;
- the page mutants in `measure-load-list-mutants.mjs` re-aimed;
- the steps of CARDS 1, 6 and 19 rewritten where they name *"Section 1 / 2 / 3"*.

**CARDS 6 and 19 go back to `owed` when the page changes** (accepted by David, 2026-09-18).

## #347 — 🔴 A PUSH TO `main` CAN SIT UNBUILT FOR MINUTES OR HOURS, VERCEL REPORTS HEALTHY THROUGHOUT, AND NOTHING WE OWN NOTICES (NEW 2026-09-18, ledger #351 — the gap in #280, measured twice in two days)

🔴 **RULE ADDED 2026-09-22 (David, ledger #383): READ THE STAMP TWICE, AT LEAST 60 SECONDS APART, BEFORE
CALLING A STALL.** A single read of `/version.json` is NOT evidence of a stalled deploy, and this row's own
subject is what makes that trap live: when you already believe a push can sit unbuilt, one stale read reads as
confirmation.

**MEASURED, on myself, the day the rule was made.** Production had genuinely served `9b2b30b` for 92 minutes
while `main` ran 20 commits ahead — including the #383 hotfix that made `/orders/:id` render at all — so the
premise was real and the escalation was reasonable. The sequence:

| time (CDT) | event |
|---|---|
| 13:40:32 | pushed an empty commit `03bb38d5` to `main` |
| 13:40:44 | **Vercel finished building it** — twelve seconds later (`builtAt` 18:40:44Z) |
| 13:41:00 | read `/version.json` on both hosts → **still `9b2b30b`** |
| 13:41:43 | concluded the hook had ignored the empty commit; pushed `7055ddcd`, touching `main.tsx` |
| 13:44:21 | read again → **`03bb38d`**, built 13:40:44 |

🔴 **THE BUILD HAD ALREADY SUCCEEDED SIXTEEN SECONDS BEFORE THE READ THAT I TREATED AS PROOF IT HAD NOT
STARTED.** The gap is CDN propagation, not the build hook. The empty commit worked; the second push, the
"empty commits are being ignored" diagnosis, and a four-line comment added to the app's ENTRY POINT to force a
bundle change were all built on one sample taken too early. The comment was reverted the same hour; the wrong
conclusion had already been written into a report and sent.

⚠️ **AND IT WAS WRONG IN THE OTHER DIRECTION TOO, WHICH IS THE PART WORTH KEEPING:** a prior session had
pushed its own trigger commit (`dffa6265`) minutes earlier. Seeing two trigger commits and a stale stamp, I
reported *"empty commits have now been pushed twice with no build"* — an inference about someone else's push
from the same single sample. **One read produced two confident wrong claims.**

**THE RULE, stated so it is executable:** before reporting a stall, read `/version.json` **twice, ≥60s apart**,
and report both reads with their timestamps. A stamp that has not moved across two spaced reads is a stall; one
that has not moved across a single read is a stamp you read too early. ⚠️ This does not change
[[feedback-dont-poll-production]] — two spaced reads is not a polling loop, and scripted loops still trip
Vercel's bot protection.

**What was seen, 2026-09-18 (times CT, from git and the app's own `/version.json`).** Production was built at
**10:36** as `0bcb467`. Then four pushes to `main`: **10:42** `fb4f30e` · **10:45** `a9ec67f` (another window) ·
**10:57** `429223b` (the box-follows-stop fix) · **11:13** `3cd3ac9`. **The first three produced no production
build.** Production stayed on `0bcb467` for ~37 minutes and then deployed **`3cd3ac9` at 11:13 — by itself**, on
the fourth push. **David checked the Vercel dashboard afterwards: all green — no queued, failed or paused
builds, Git integration connected.** The stall left no trace anywhere a person would look.

**It is the second instance in two days, same shape.** 2026-09-17 20:00Z → 2026-09-18 13:28Z: **~17 hours**, three
pushes, no build, then a build on a later push (recorded on ledger #350's row). Both times the code built
locally; both times the deploy resumed without anyone changing anything.

**Why it matters — #280's gap, now measured, not hypothetical.** #280 says the close-out gates accept *pushed*
as *shipped* and that **nothing we own reads Vercel**. This is what that costs: a fix can be merged, verified,
green on `main`, and **not serving** — while the dashboard says healthy — and the only signal is someone reading
the footer stamp and comparing it with `main` by hand. On 2026-09-18 the unserved fix was the one keeping
*"Started 10:10 AM · Mauro"* off Lauren's schedule on the eve of the pilot.

**🔴 AND THE OBVIOUS WATCHER IS A TRAP — learned the same morning.** Checking `/version.json` every 30 s from a
script for ~40 minutes tripped **Vercel's bot protection**: every scripted request from the Mac then got a **403
"Vercel Security Checkpoint"** page (`/version.json` and `/api/crew/day` alike), and the watcher read that page
as a deploy because it only tested *"is it still the old SHA?"*. So any fix must (a) read rarely, (b) match the
EXPECTED sha positively, and (c) stop on a non-200.

**The fix (filed, not built).** A single check, run after a push, that answers the one question — *is production
serving `origin/main`'s head, and if not, for how long has it been behind?* — without polling:
1. Read `/version.json` **once**, a few minutes after the push; compare its `sha` with `origin/main`; report
   *"production is N commits behind main; the oldest unserved push is M minutes old"*. **Positive match only;
   a non-200 is reported as "could not read", never as a deploy.**
2. Home it where the actor stands (#280 / OP-15): the owner-test GATE 0 already asks David to read the stamp;
   this makes the comparison mechanical. A GitHub Action on push, or Vercel's deploy webhook, could run it
   without anyone's machine polling — the webhook would also say *why* a build did not start, which nothing
   we own can see today.
3. ⚠️ The CAUSE is not known and is Vercel's to explain; the check does not fix it, it makes it visible.

## #348 — 🔴 ONE ADDRESS GOOGLE CANNOT FIND KILLS THE DRIVER'S WHOLE ROUTE LINK, AND NOTHING SAYS WHICH (NEW 2026-09-18, ledger #351 — the top crew-link item, above cards D–G, by David)

**Seen live, 2026-09-18 ~13:18–13:29, LAWNS Saturday 2026-09-19.** Testing a two-crew workaround, four stops were
deselected and the other four routed for Team 1 (Freehill · Sappal · Thiry · Garzon). The route page showed a map and
saved the order; **the texted Google Maps link would not open a route** — Google offered "open in Google Maps" and
then could not find one address, and the WHOLE route failed, not just that stop.

**Why — two resolvers that disagree (read from the code, not guessed).**
- **The app's map** (`DeliveryRoute.tsx` → `RouteMap`) geocodes each address with the JS Geocoder and takes
  `results[0]` **whatever its quality** — an approximate or partial match is accepted as a place. A stop that returns
  nothing is dropped from the map silently (a console trace only, no line on screen).
- **The driver's link** (`routeHandoff.buildMapsUrl`) is `https://www.google.com/maps/dir/<a>/<b>/<c>/…` built from
  the **address TEXT**, not from what the app found. Google Maps re-searches every segment; **if any one fails, Google
  fails the entire route.** So the app can route a stop the link then cannot.
- **Evidence the app placed all four:** the save recorded **4** stops at 13:18:27. A stop the app cannot place is
  dropped BEFORE the save (the saver takes only the optimiser's located stops), so a miss in the app would have saved 3.
- **Which address:** our data cannot say — all eight are well-formed (street · city · TX · ZIP). **Most likely 153 Twin
  Creek View Lane, Georgetown TX 78626 (Angela Garzon)** — captured by OCR at 09:56 the same morning, a street Google's
  search may not know, or knows under a slightly different spelling, while the Geocoder returns an approximate place.
  Confirm by typing that exact line into Google Maps on the phone. (Not checked against any outside geocoder from here:
  that would send a customer's address to a third party.)

**The fix (filed, not built) — "surface, don't decide":**
1. **Build the driver's link from the positions the app already found** (lat,lng), not from text, so the driver gets
   the route the app computed and saved.
2. **A stop the app could not place is left out of the link and NAMED on the route page** — *"Not in this route: Angela
   Garzon — 153 Twin Creek View Lane could not be found. Check the address or call the customer."* — never a dead link
   with no explanation.
3. **An approximate match is treated as not placed precisely** (the Geocoder's `partial_match` / location type), and
   named the same way — otherwise the app routes to a ZIP centroid and says nothing.
4. Tests: a fixture where one address geocodes and one does not; the link carries the located ones and the page names
   the other.

**What it cost besides the dead link — the two-crew workaround overwrote the day's plan.** The save model is ONE
route per day: routing Team 1's four REPLACED Lauren's eight-stop plan (the other four lost their positions), and there
is no way to save a Team 2 route. Lauren's plan is recoverable exactly — the audit log holds every saved order (her
09:57:52 save: Freehill → Sappal → Thiry → Garzon → Dubec → Gustafson → Kossa → Raja). Two crews need teams on the
stop; that is tech-debt #345's territory, not this item's.

## #349 — 🔴 TRUNK PROTECTION IS THREE PRODUCTS, AND THE SHEET CANNOT SAY WHICH ONE TO LOAD (NEW 2026-09-18 — FILED, NOT BUILT; measured with ledger #356)

**What David said (from the physical stock, 2026-09-18).** Three products, each a flat tube, one per tree, no cutting, **chosen by the tree's caliper**: **Plantra bark protector 3"** (part TBCSOW-36) $13 · **Plantra tree guard 4"** $15 · **green mesh tube, over 4"** $20. The page-1 line prints *"2 trunk protection"* without saying which, so the yard can load the wrong sleeve.

**Measured live 2026-09-18.**
- **The catalogue holds ONE item: "Trunk Protection"** (QuickBooks item 191, $10, no size). No Plantra 3", no tree guard 4", no mesh item, and **TBCSOW-36 appears nowhere** — not in the catalogue, not on any line.
- **The whole LAWNS book holds two trunk-protection lines,** and the product is only in their free text and price: **Saturday 2026-09-19, Chris Freehill — "Trunk Protection - Green Mesh" × 2 at $20** · **2026-10-03 — "Trunk Protection" × 1 at $13** (the Plantra 3" price).
- On Saturday's sheet the stop block prints Freehill's line as written, so **"Green Mesh" IS on the paper — on page 2, not on the page-1 total.**
- 🔴 **A CONTRADICTION FOR LAUREN, NOT DECIDED HERE:** Freehill's two trees are **30 gal** (Monterrey Oak, Chinese Pistache), which the caliper ladder (ledger #356) puts at **1.5–2.5 in** — and the order bills **green mesh, the over-4" sleeve.** Either mesh is used on smaller trees for another reason (deer? sun?), or the caliper rule is not the whole rule.

**What it takes, NEED → WANT.**
1. **Cheapest (~1 h, no data change):** the page-1 line groups trunk protection by its line text — *"2 trunk protection — Green Mesh"* — and a bare "Trunk Protection" prints *"size not stated on the order"*. Honest, but it depends on free text.
2. **Right (needs Lauren in QuickBooks):** three items, one per product (e.g. TP3 · TP4 · TPM), so the ORDER says which; the load list then prints one line per product. Depends on the code join (order line → catalogue row) or on recognising three names.
3. **Checked (after ledger #356 is applied):** the sheet compares the billed sleeve with the tree's rung caliper and flags a mismatch (a 3" sleeve billed for a 65 gal tree). It needs the three sleeves' sizes as configuration and **the Freehill question answered first.**

**Blocker:** the Freehill contradiction; and Lauren creating the three items if option 2 is chosen.

## #350 — 🔴 THE ONBOARDING DISCOVERY QUESTION SET IS FILED, AND FOUR OF ITS EIGHT ANSWERS HAVE NOWHERE TO GO (NEW 2026-09-18 — FILED, NOT BUILT, David's instruction)

**What.** [docs/onboarding/discovery-question-set.md](onboarding/discovery-question-set.md) — the eight questions a new business is asked during analysis, each taken from a LAWNS surprise of the same week. David: *"these must be asked during analysis, not discovered months in."* **PLATFORM, not LAWNS-specific.**

**Where it runs.** Today: the analysis conversation before a catalogue import, by hand. Next: `customer-onboarding-capability_v1.md` §1.4 (which has described the asking since June and never held the questions — a pointer is now there), then the discovery module (`DISCOVERY_MODULE_BRIEF.md`, `api/discovery/ingest.ts`), then the onboarding wizard. 🔴 **No user story exists for it**; one is written before any screen (§9's story gate).

**🔴 THE FOUR ANSWERS WITH NOWHERE TO GO — this is the item, not the document:**
1. **Delivery rings** — no ring table, no stored coordinates (tech-debt #323).
2. **One sellable thing REQUIRING another** (LAWNS: install requires TC) — there is no "requires" edge between two rows, and its absence is why the TC line has to be *inferred* as an install signal ([[R-164]], tech-debt #342).
3. **Kits and their parts** — the recipe builder is parked; `docs/recipes/water-monitor-kit.md` is read by nothing.
4. **An item that is BOTH fitted and sold over the counter** — measured live 2026-09-18: trunk protection appears on an order with no trip charge (3648.606). An item is a product row or a service row, never both.

**Blocker:** none for the document. Each of the four gaps is its own build and needs David's shape first.

## #351 — 🟡 ROOT BALL SIZE: A LARGE-TREE RULE OF THUMB, NOT THE STANDARD'S RULE (NEW 2026-09-18 — FILED, NOT BUILT, David's instruction)

**The rule of thumb.** ~**10–12 inches of root ball diameter per inch of caliper**, which the install BOM could read for hole size once anything reads caliper at all.

🔴 **IT IS NOT WHAT ANSI Z60.2-2025 SAYS, AND THE DIFFERENCE MATTERS ON SMALL TREES.** The standard gives **tables** of minimum root ball diameter per caliper/height specification (§1.5.1 and the per-type tables), not a ratio. Read out of the document's own Type 1 shade-tree table: **½ in caliper → 12 in ball (≈24× per inch of caliper)** · ¾ in → 13 in · 1 in → 16 in · **1¼ in → 18 in (≈14×)** · **1½ in → 20 in (≈13×)**. The ratio falls as the tree grows and only approaches 10–12 on big stock. **So the rule of thumb is a LARGE-TREE approximation and is recorded here as one** (David, 2026-09-18: *"your reading of the tables is the one on record"*).

**What it would take to use it.** The hole size belongs to the install BOM, beside the mix and the posts: a figure per rung (or the standard's table), read at print time by the load list. It needs (a) David's ruling on whether LAWNS digs to the rule of thumb or to the table, and (b) a home — today the install figures are per-tree ratios in `business_operations_config` and per-size figures on `container_ladder`; a ball diameter is per size, so the rung is its natural home, exactly like caliper.

**Blocker:** David's ruling. Nothing reads caliper yet (ledger #356), and the hole size is a step past it.

## #355 — 🟡 THE ESTIMATE CANNOT LEARN YET: NO TAPS EXIST TO COMPARE IT WITH (NEW 2026-09-21, ledger #362 — David's loop, step 3, filed until there is data)

**David's rule, 2026-09-21:** settings plus a formula do not learn, so the loop is (1) snapshot the estimate when a
day is scheduled or routed, (2) keep the actual minutes the Start/Done taps give, **by tree size**, (3) SURFACE a
comparison — *"the last N installs at 45 gal averaged M minutes; your setting is 30 — change it?"* — which Lauren
accepts or declines, **nothing changing silently**, and (4) **X — the one-team/two-team threshold — is a POLICY: it
never learns and is never suggested.** Only planting time does.

**Steps 1 and 2 are built with piece 2.5. THIS ITEM IS STEP 3**, and it is filed rather than built for one measured
reason: **there is nothing to compare.** Saturday 2026-09-19 produced **zero** Start/Done taps (the crew link was
last opened the day before), so the platform holds no actual minutes for any tree size. A comparison card built now
would have an empty population and would either say nothing or invent confidence.

**What it takes when the taps exist.** A read over completed stops — actual minutes (`completed_at − started_at`)
against that stop's trees and sizes — grouped by size, with a minimum count before anything is offered; a card in
Settings → Operations that shows the average, the count and the current setting, and writes the setting only on
Lauren's accept, through the existing settings writer, with an audit row. ⚠️ **A stop with several sizes cannot be
attributed to one size**; the first cut counts only single-size stops and says so, rather than apportioning by a
rule nobody has ruled. ⚠️ And a start that was never tapped, or one left from a previous day (tech-debt #344),
poisons the average — #344 should land first or the comparison must exclude stops whose start and done are on
different days.
---

## #354 — 🟡 AFTER A BULK HISTORY IMPORT THE ORDERS ROSTER SHOWS THE 50 MOST RECENTLY *WRITTEN* ROWS, WHICH WOULD ALL BE 2024–2025 INVOICES (NEW 2026-09-20, ledger #359 — filed in place of a defect that did not exist)

**✏️ THIS ROW REPLACES A CLAIM I MADE AND GOT WRONG, AND THE CORRECTION IS THE REASON IT IS FILED.** The
2026-09-20 build report stated that `/orders` had *"no read limit — `.order('created_at')` with no `.limit()`"*,
and called it ledger #251's defect class on a second screen. **That is false.** `Orders.tsx` carries
`.limit(ROSTER_PAGE_LIMIT)` with `ROSTER_PAGE_LIMIT = 50`, added **2026-08-28** by ledger #225, and
`orderRosterFilter.ts:23` states the reasoning in its own words: *"a total that is silently a cap is a number
that lies."* The roster also renders `rosterCountLabel(...)` — *"showing 3 of 50+"* — and logs `atPageCap`. **The
screen is bounded and it says so.** The claim came from a grep for `\.limit\([0-9]+\)`, which cannot match
`.limit(ROSTER_PAGE_LIMIT)`; absence of a match was read as absence of a limit. **That is the exact defect the
report was about — [[R-26]], and #182's shape: a probe that could not reach its target reporting the same as one
that passed.**

**WHAT IS ACTUALLY TRUE, AND IT IS SMALLER.** The roster reads `.order('created_at', { ascending: false })`.
Every row a bulk import writes carries the same `created_at` — the moment of the import — so after the
1,510-invoice history import the newest 50 by `created_at` would be **1,510 imported historical invoices**,
and this week's real orders would fall off the first page. The count sentence stays honest (*"of 50+"*), so
**this is not a silent lie; it is the wrong fifty.** `orders.sale_date` is populated on every history order
(the whole population today: 44 of 45) and is the honest sort for a roster of sales.

**Blast radius, measured 2026-09-20.** `/orders` only. `CustomerDetail.tsx` has no limit and does not need one:
the busiest QuickBooks customer holds **18 invoices**, the top three are 18 · 18 · 17, and **no customer has
more than 50** — so the per-customer read cannot reach PostgREST's 1,000-row default.

**Fix (filed, not built).** Sort the roster by `COALESCE(sale_date, created_at::date)` rather than `created_at`,
or offer the sort. It is small, and it is **not urgent before the import** — the screen degrades legibly rather
than lying. Bundle it with the import build, where the 1,510 rows arrive.

**Blocker:** none. It waits on the import being scoped.

✏️ **FILED AS #353 AT 14:41 AND RENUMBERED TO #354.** `origin/fix/seeded-fee-rows` claims #353 too (the import preview's field map). **By commit time mine is earlier — 14:41:00 against 14:47:51 — so R-148 clause (4) would move theirs.** I moved MINE anyway, deliberately: their row was first filed as #351 at **14:05:19** and was renumbered into #353 by a collision of its own, so its real claim predates mine by half an hour; and mine is one day old, cited by nothing but its own ledger row, while theirs carries a live measurement another session already depends on. **Cheapest thing to move, on #335's precedent.** `verify-id-sweep` never moves an id and did not move this one.

---

## #357 — 🔴 THE PGLITE HARNESSES HAND-ROLL THEIR SCHEMA, SO A DOUBLE CAN BE MORE FORGIVING THAN LIVE — AND ONE WAS (NEW 2026-09-21, ledger #363)

**What happened, in one line.** `history-undo-363.pglite.mjs` declared `orders.customer_id` and
`orders.transport_method` NULLABLE. **Live requires both.** So **19 probes passed** against a schema
that cannot reject what Postgres rejects, and the same probe SQL, pasted into the SQL editor by
David, died on **`23502 null value in column "transport_method" … violates not-null constraint`**
— *before reaching the undo at all.* **V5, V6 and V7 never ran, so the R-160 protections were
UNPROVEN on the live database while a green harness said otherwise.**

🔴 **THIS IS [[R-33]]'s NAMED CLASS — *"a fake more forgiving than the real thing is a rubber
stamp"* — COMMITTED INSIDE A BUILD WHOSE OWN MIGRATION QUOTES R-33.** It is the third mechanism in
that ruling (tech-debt #138: a double that could not refuse), arriving in a harness written to
prove a different ruling. Knowing the rule is not protection against it.

**The repo already had the answer and this harness did not use it.** §6 r21 says path tests run on
**`scripts/sql-harness/fixtures/live-schema-public.sql`** — a real dump. Every PGlite harness in
that folder hand-rolls a minimal schema instead, because the dump is large and Supabase-specific.
That trade was never written down, so each harness re-makes it silently.

**MEASURED DRIFT, 2026-09-21 — the tables this harness declares, against the fixture:**

| table | live cols | harness cols | live NOT NULLs the harness did not enforce |
|---|---|---|---|
| `orders` | 29 | 15 | ✅ none, after this fix (was `customer_id`, `transport_method`) |
| `order_items` | 16 | 9 | ✅ none, after this fix (was `is_manual_override`) |
| `customers` | 31 | 11 | `marketing_opt_in` · `source` · `created_at` · `price_tier` · `customer_type` · `tax_exempt` · `status` · `updated_at` |
| `business_inventory` | 33 | 9 | `name` · `qty` · `status` · `created_at` · `updated_at` |
| `deliveries` | 18 | 4 | `status` · `created_at` |

⚠️ **The three still-drifted tables did not bite here** — live inserts into `customers` succeeded in
David's run, so those columns carry defaults. **That is luck, not design**, and it is the same luck
`orders` had until it ran out.

**Fixed in this pass, narrowly:** `orders` and `order_items` now carry the live NOT NULL set,
copied from the fixture rather than invented, with the reason at the code. 19/19 still pass —
against a schema that can now refuse.

**Fix (filed, not built).** Load the fixture instead of hand-rolling, in ALL of the harnesses in
`scripts/sql-harness/`, or extract one shared `freshLiveSchema()` they share (§6 r8 — this is one
operation in eight places). If the dump cannot load into PGlite, that reason gets written down
once, where the next harness author will read it.

✏️ **2026-09-21 — WHY EVERY HARNESS HAND-ROLLS IS NOW MEASURED, NOT GUESSED AT. THE FIXTURE DOES
NOT LOAD INTO PGLITE.** The "fix" this row proposed — *load the fixture instead of hand-rolling* —
was attempted and **refused twice, for two different reasons**, on
`fixtures/live-schema-public.sql` (**254,532 characters · 4,948 lines**):

1. 🔴 **`function extensions.gen_random_bytes(integer) does not exist`.** The dump calls Supabase's
   own extension functions. They can be stubbed (`extensions.gen_random_bytes`, `auth.uid`,
   `auth.jwt`, `auth.role` were), but **a stub is a double again** — the very thing this row is
   about — so stubbing the way to a "live schema" earns less than it looks like it earns.
2. 🔴 **`stack_depth.c` — PGlite exceeds its stack depth** applying the dump, even fed
   statement-by-statement. Not a syntax problem and not fixable by stubbing: the WASM build has a
   smaller stack than a server Postgres.

**So the trade every harness in that folder made silently was the right one, and what was missing
was the REASON.** It is written here now so the next author does not spend the afternoon
rediscovering it.

🔴 **AND THE ANSWER TAKEN INSTEAD IS BETTER THAN THE ONE PROPOSED, because it cannot drift.**
`history-undo-363.pglite.mjs` §H **DERIVES live's NOT NULL set from the fixture by parsing it** and
FAILS if the harness does not enforce every column. Nothing is written down twice, so the harness
cannot silently fall behind live again — which is exactly how this row was born.
⚠️ **It guards only the tables that harness WRITES TO** (`orders`, `order_items`). `customers`,
`business_inventory` and `deliveries` are still short, and §H **prints the count on every run**
rather than passing over them. **The open half of this row is extending §H's shape to the other
seven harnesses**, not loading the dump.

✏️ **§H caught its own flaw before it caught anything real:** the first matcher used `[^,]*`, which
stops at the comma **inside `numeric(10,2)`** and reported four sound columns as gaps. A check that
reports a defect that is not there is the mirror of one that misses a defect that is — both were
live in this file within one hour.

**Blocker:** none, but it is bigger than one harness — eight files. Not for the night before
go-live.


---

## #359 — 🟡 THE CUSTOMER GRID PUTS ALL 2,005 ROWS IN THE DOM; AND SCREEN-TO-SCREEN TIME IS INVISIBLE TO CORE WEB VITALS (NEW 2026-09-21, ledger #370 — FILED, NOT BUILT, David's call)

**① NO VIRTUALISATION.** `DataSheet.tsx` has zero windowing — measured by grep: no `react-window`,
no `react-virtual`, no row slice. Every one of LAWNS's **2,005** customer rows is a live DOM node.
The server read is now ~0.9 s (ledger #370); what is left of the wait is parse and layout, and that
is where it goes. **Not tonight, on David's instruction** — it changes the shared grid every screen
uses, the night before a pilot.

**② THE THING LAUREN FEELS IS NOT A PAGE LOAD, AND THE INDUSTRY-STANDARD TOOL CANNOT SEE IT.**
Vercel **Speed Insights** (free on Hobby, $10/mo per project on Pro) reports LCP, CLS, INP, TTFB and
FCP from real users, by route and device. 🔴 **Core Web Vitals are measured on DOCUMENT LOAD.**
Going from `/customers/:id` back to `/customers` in a React SPA is a client-side route change — no
new document, so **no new LCP**. The 7 seconds David reported is invisible to it.
**What is owed is a soft-navigation timer of our own:** mark on route change, measure to the list's
first paint, log it with the row count and whether the roster was served from the held copy.
**~half a day.** Speed Insights is still worth turning on for real page loads; it just does not
answer this question, and adopting it as though it did is the [[R-26]] shape — a written claim
standing in for a measurement.

✏️ **2026-09-21, LATER — A THIRD ITEM, AND IT IS THE ONE THAT SHOULD HAVE EXISTED FIRST: A RENDER
TEST.** Ledger #377 fixed a paging defect that presented as a broken search and a broken sort on
`/customers` and cost most of an evening, including a revert of an innocent change (#371). **What
would have caught it in seconds is a test that renders the grid with 2,005 rows, types `highland`,
and asserts the rendered set is EXACTLY the matching rows with no repeated row key.** No such test
exists, and none can today: **this repo has no React render harness at all** — no jsdom, no
Testing Library, and every one of its 132 test files is a pure-logic script run by `tsx`.

🔴 **THE MEASURED LESSON, WORTH MORE THAN THE FIX: I MEASURED THE READ AND NEVER ASSERTED THE
RENDER.** #371 shipped with before/after timings on the live query, five mutants, and `verify` at
exit 0 — and a screen that showed the wrong rows. Every probe I wrote was about the data going in.
**The paging cap (`verify-stable-paging`) now guards the CAUSE, which is the durable half; a render
test would guard the SYMPTOM, which is what a person actually sees.** Both are worth having, and
the cause is the one that generalises.

**What it needs:** jsdom + a render library as dev dependencies — **a new dependency, so David's
call** (§6 r10: a standard is adopted on value for our scope, never because it is the standard).
The value here is concrete rather than hypothetical: one evening lost, one good change reverted.

**Blocker:** David's call on the dependency. ① is a shared-grid change and wants its own build; ②
is half a day.

---

## #360 — 🟡 318 ESTIMATES ARE IN LAWNS'S BOOKS AND NOTHING IN TRACE READS THEM (NEW 2026-09-21, ledger #370 — filed for Lauren's estimate workflow)

**Measured on the 2026-09-16 capture (`complete: true`): 318 estimates across 251 customers.**
**127 of the 871 customers showing no order appear ONLY on an estimate** — they were quoted and
never bought. Their empty history is CORRECT today, and it is also the most interesting list in the
business: a quote that never closed.

🔴 **AN ESTIMATE IS NOT A SALE AND MUST NEVER BECOME AN ORDER.** `order_kind = 'history'` means a
sale that happened; an estimate is a sale that did not. Importing them as orders would put
$1,907,816 of quotes into revenue. **If they are imported at all it is as their own object with
their own screen** — Lauren's follow-up list, not her order history.

**What it would need:** `Estimate` is already in `QBO_ENTITIES` and already walked by the router
(#341), so the READ exists. What does not exist is a table, a screen, or a ruling on what a quote
does in this product.

**Blocker:** David's ruling on whether estimates are part of the product at all.

## #77 — 🔴 `api/` IS IN NO TSCONFIG, SO NOBODY WHO CAN FAIL A BUILD TYPE-CHECKS IT — AND THE TWO CHECKERS THAT DO LOOK DISAGREE BECAUSE OF ONE FLAG (ENTRY WRITTEN 2026-09-22; the id was cited in three places and had no entry — #195's class)

⚠️ **THIS ID WAS CITED BEFORE IT WAS WRITTEN.** `docs/built-inventory.md:1044`, `docs/CLOSE-OUT-LEDGER.md` (#341)
and `docs/handoff-archive.md:1405` all cite *"tech-debt #77"* for exactly this gap; **no entry existed in this
file.** That is the defect **#195** filed about #186–#191, in a range nobody re-checked. Entry written now, with
the measurement it never had.

**What — and it is simpler and worse than "a config difference."** `npm run verify` type-checks **two**
projects (`scripts/quality-gate.mjs:37`): `packages/cultivar-os/tsconfig.json` and
`packages/trace-app/tsconfig.json`. The first declares `"include": ["src"]`. **There is no `tsconfig.json` at
the repo root at all.** So the repo-root `api/` shims and `packages/cultivar-os/api/**` — every serverless
handler we deploy — are in **no TypeScript project**, and `npm run verify` has never type-checked one of them.
Vercel compiles them on every deploy, finds no root tsconfig, and therefore falls back to **TypeScript's
defaults, which means `strict: false`.**

**The exact difference, MEASURED 2026-09-22** (same file set, same TypeScript, one flag changed):

| `strict` | total errors | discriminated-union narrowing | `await res.json()` → `unknown` |
|---|---|---|---|
| `false` — what Vercel uses | **32** | **16** | 16 |
| `true` — what this repo uses everywhere else | **16** | **0** | 16 |

🔴 **ALL SIXTEEN UNION ERRORS ARE AN ARTIFACT OF THE FLAG, NOT DEFECTS.** Narrowing a **boolean-literal
discriminant** needs `strictNullChecks`; without it `if (!resolved.ok)` stops narrowing and every access to the
other arm is reported. The code is correct and correctly narrowed — `QboItemRefResult` really is
`{ok:true; itemRef} | {ok:false; unmapped}` (`invoiceLineShapes.ts:115`) and the call site really does check
`ok` first. This is the whole of the list David read off the Vercel build log: `unmapped` ×5 · `customerUpsert`
`error` · `acceptInvitation` `email` on `never` · `campaigns/generate` `value` · `containerLadder` `reason` ×3 ·
`customerImportWriter` `error` ×3 · `shipmentIngest` `reason`/`lines`. **Giving Vercel a `strict: true` tsconfig
deletes all sixteen at a stroke, changing no application code.**

**The other 16 are one class and are NOT runtime bugs either:** `await fetchRes.json()` returns `unknown` in
this lib version, then properties are read off it (`qbo/invoice/cultivar.ts` ×5, `qbo/router.ts` ×5,
`receipts/ocr.ts` ×2, `shared/src/quickbooks/refresh.ts` ×4). At run time the parsed body does carry those keys
and most reads are already `?.`/`??`-guarded. They error under **both** settings — they are a genuine typing
gap, and the honest thing to say about them is that they are **the class that HIDES bugs**, because an
unchecked external response gets no compiler help at all.

🔴 **WHY THIS IS RED RATHER THAN AMBER — IT HAS NOW COST US A PRODUCTION 500.** On 2026-09-22
`api/discovery/ingest.ts` shipped `export { callerHoldsPermission } from '...'` — a bare re-export, which
creates **no local binding** — while the `cost-apply` write-wall gate called that name directly. Every
`cost-apply` request threw `ReferenceError: callerHoldsPermission is not defined`. **A tsc over `api/` reports
it instantly, under EITHER setting: `ingest.ts(107,27): error TS2304: Cannot find name
'callerHoldsPermission'` — measured, by re-breaking the file and re-running both configs.** Nothing in
`npm run verify` could see it, because the file is in no project. The two checks that *were* aimed at that gate
both passed on it: `scripts/verify-write-wall.ts:15` imports the symbol **from ingest.ts**, and a re-export
does satisfy importers, so it proved the helper through a door that was never broken; `verify-universals.mjs`
cap7 greps the literal string `callerHoldsPermission(req`, which an undefined identifier matches exactly as
well as a defined one. **[[R-33]]: neither could have disagreed.**

⚠️ **AND VERCEL'S OWN OUTPUT IS NOT A BACKSTOP: the 2026-09-22 build printed its TypeScript errors and
SUCCEEDED anyway** (`716eed9`, 16:38). A checker whose findings cannot fail a build is a log, not a gate — and
32 standing errors is exactly the noise a real one hides in.

✅ **BUILT 2026-09-22 AS A RATCHET — David's call, same day.** `tsconfig.api.json` (`include: ["api"]`,
`strict: true` to match `packages/cultivar-os/tsconfig.json`) + `scripts/verify-api-types.mjs`, wired into
`npm run verify` immediately after `verify:api-parses`. **Baselined at 16, so it lands GREEN; any NET-NEW
error fails the build.**

🔴 **IT KEYS ON ERROR IDENTITY, NOT ON A COUNT.** A count-only ratchet passes when one error is fixed and
another introduced in the same commit — 16 in, 16 out, green, on a tree that regressed. The key is
`path::TScode::message`, with **line and column deliberately excluded** so editing above an error is not a
false regression (#78 re-keyed the quality ratchets on identity for the same reason). **PROVEN RED on the
exact defect it exists to catch:** re-breaking `ingest.ts:34` back to a bare re-export produced
`❌ 1 NET-NEW … TS2304: Cannot find name 'callerHoldsPermission'`, exit 1. **10 self-test probes, both
directions**, including P7 (the fixed-one/new-one swap a count would miss) and P8 (the same error on a
different line is the same key). Re-baselining UPWARD is refused outright — a baseline is debt and shrinks
only (§6 r9).

**THE 16 ARE ONE CLASS AND HERE ARE THE SITES — `await res.json()` returns `unknown`, then properties are
read off it.** Fix over time; each fix shrinks the baseline via `node scripts/verify-api-types.mjs --update`.

| File | Errors | `await res.json()` calls | What it parses |
|---|---|---|---|
| `packages/cultivar-os/api/qbo/router.ts` | 5 | 2 | Intuit token exchange (`access_token`, `refresh_token`, `expires_in`) + `CompanyInfo` |
| `packages/cultivar-os/api/qbo/invoice/cultivar.ts` | 5 | 4 | Intuit `QueryResponse`, `Customer` ×3, `Invoice` |
| `packages/shared/src/quickbooks/refresh.ts` | 4 | 1 | the token refresh body |
| `packages/cultivar-os/api/receipts/ocr.ts` | 2 | 1 | Gemini `usageMetadata` / `candidates` |

⚠️ **NONE OF THE 16 IS A RUNTIME BUG** — the parsed body does carry those keys and most reads are already
`?.`/`??`-guarded. **But this is the class that HIDES bugs**: an unchecked external response gets no compiler
help at all, which is exactly the condition under which a typo in a token field fails silently at 3am. The
durable fix is a narrow response type (or a parse helper) per call, not a cast.

⚠️ **ONE THING I COULD NOT SETTLE WITHOUT THE RAW BUILD LOG:** whether Vercel's output also carried the
`ingest.ts` TS2304. David's read of it listed the other ~15 and not this one. If it *was* there, the signal
existed and was lost in the noise, which strengthens the case rather than weakening it — but I am not asserting
it either way.

**Owner:** David — whether `npm run verify` gains a step that starts red. **Blocks:** nothing today; it is the
blind spot every future `api/` edit ships through.

---

## #363 — 🟡 LAUREN'S PRICE SHEET IS FIVE HARDCODED NUMBERS IN THE CONTAINER-SIZES EDITOR (NEW 2026-09-23, ledger #386 — filed by the build that created it, with its exit condition named)

**What it is.** `SHEET_PRICE` in `packages/cultivar-os/src/components/settings/ContainerSizesSettings.tsx`:

```ts
const SHEET_PRICE: Record<string, number> = {
  '15 gal': 150, '30 gal': 300, '45 gal': 450, '65 gal': 600, '95/100': 900,
};
```

One tenant's install price list, in code that every tenant's Settings screen runs.

**Why it exists.** David's ruling (b), 2026-09-23 ([[R-171]]): *"SEED FROM WHAT THEY ACTUALLY BILL …
with Lauren's sheet shown BESIDE each rung and the gap named, for her to confirm or change."* The
seeded prices come from LAWNS's own billed medians; her sheet is the thing they are compared
against. Showing the gap is the deliverable, and the gap needs both numbers.

🔴 **IT IS A COMPARISON, NEVER A PRICE — and that is what makes it LOW and not HIGH.** Nothing reads
it to charge anybody: no checkout path, no migration, no seed, no export. It renders text beside an
input. If it were deleted tomorrow the only loss would be the comparison.

⚠️ **THE REAL DEFECT IS THE KEY, NOT THE VALUES.** It is keyed by **rung LABEL**, so it will render
for any tenant whose ladder happens to use the strings `15 gal`, `30 gal`, `45 gal`, `65 gal` or
`95/100` — which are not unusual labels. That is a coincidence waiting to happen: another grower
would be shown *"Lauren's 2026-09-23 sheet says $300 for this size"* about their own business. **No
other tenant has those labels today** (measured 2026-09-23: only LAWNS has a `container_ladder`),
so it is latent rather than live.

**The exit condition, and it is near.** It comes out the moment Lauren has confirmed or changed each
of the five rungs, because the comparison has then done its job and **a stale sheet is worse than
none**. If David wants the comparison to survive that, the durable form is a per-tenant
`reference_price` column on the rung — a value, not a map in code (AC-1).

**Registered:** `docs/decisions/HARDCODED-REGISTER.md` → *container sizes / Settings*, item **C1**,
🟡 OPEN. **It caps the container-sizes capability at amber** (§6 r12), which costs nothing today —
that board is already amber with 14 cards owed.

**Trigger for repair:** Lauren's first pass over the five rungs, OR a second tenant gaining a
`container_ladder` — whichever comes first. The second is the one that turns it from untidy to wrong.

---

## #364 — ✅ **RESOLVED 2026-09-26 (ledger #416), AND DAVID RULED IT FIRST** — THE LOAD LIST COMPUTED PLANTING MIX, T-POSTS AND ROPE FOR **DELIVERY-ONLY** STOPS, AND 26 OF LAWNS'S 63 STOPS ARE DELIVERIES (NEW 2026-09-25, ledger #411 — FOUND BY AN EQUIVALENCE PROBE, FILED NOT FIXED)

**`installs` gates exactly ONE quantity in `loadList.ts` — `waterMonitors` (`:605`).** Special mix,
T-posts, rope, ring circumference and deer-fence posts are computed for **every** stop on the day,
whether or not LAWNS is planting the trees.

🔴 **MEASURED LIVE 2026-09-25, which is what makes this worth reading rather than a hypothesis:**

| `orders.transport_method` | stops | orders |
|---|---|---|
| `install` | **37** | 37 |
| `delivery` | **26** | 26 |

**26 of 63 stops — 41% — are deliveries**, where the customer plants the trees themselves. On a day
mixing the two, the consolidated headline at the top of the sheet (*"load 270 gallons of mix, 14
T-posts"*) includes trees nobody at LAWNS is planting.

**HOW IT WAS FOUND, and it is the reason the equivalence probe exists at all.** `installKitEquivalence.test.ts`
§B drove a **delivery-only** stop through `buildLoadList` and through the new `evaluateKit`, expecting
them to agree. **They disagreed, and the kit was the one that abstained** — the kit consumes nothing on
a delivery (David, 2026-09-25: *"A Delivery-only stop issues nothing"*) while the load list printed
mix for it. The probe was written to catch the kit drifting from the sheet; it caught the sheet
instead.

⚠️ **AND IT IS A QUESTION, NOT A CONFIRMED DEFECT — WHICH IS WHY IT IS FILED RATHER THAN FIXED.**
Two readings are both plausible and only Lauren's practice decides:
- **Over-count (likely):** the yard loads mix and posts that will not be used. The waste is real and
  the sheet is the thing the yard trusts.
- **Deliberate superset:** the sheet may be showing *what these trees would need* so nothing is
  forgotten when a delivery turns into an install on the day — and LAWNS **does** sell mix by the
  scoop and the bucket, so a delivery can legitimately carry mix. But that mix would be a **sold
  line on the order**, not the install kit's 2-gal-per-container-gallon rule, so it would be
  double-counted rather than correctly counted.

🔴 **NOT FIXED IN #411 DELIBERATELY: it changes what the printed sheet says for the crew that loads a
trailer tomorrow.** Gating mix on `installs` is a four-character change and a two-line probe — and it
is exactly the kind of change that must be David's, not a side effect of a build about something else.
**The load list was also under a freeze for crew-link's merge when this was found.**

**EXIT CONDITION:** David says whether a delivery-only stop should carry planting mix and staking. If
not, `installs` gates the mix/post/rope sums the way it already gates `waterMonitors`, and
`installKitEquivalence.test.ts` §B flips from *"these two deliberately disagree"* to *"these two agree"* —
the probe is already written and would go green on the fix without being edited.

✅ **RESOLVED 2026-09-26 — ledger #416.** David ruled (2026-09-25/26): *"install materials (mix, T-posts,
rope, water monitors) go ONLY on install stops (marked install, a trip-charge line, or warranty
replacements); delivery-only carries trees only."* `buildLoadList` now gates the per-stop figures **and a
separate day tally** on `s.installs`.

✏️ **HALF THE RULING WAS ALREADY MERGED AND HALF WAS NOT — recorded because the instruction to fix this said
it was all merged.** Ledger **#415** built the PREDICATE (`stopChecks(...).basis`, reading the mark, a trip
charge and a warranty replacement — exactly the ruling) and wired it to **`waterMonitors` alone**. The
equivalence probe re-run on CURRENT `main` still showed mix, posts and rope summed for every stop, so this
was not a stale measurement against a pre-merge sheet.

🔴 **AND IT WAS NOT THE "four-character change" ANYONE EXPECTED, MYSELF INCLUDED: the day total is
RECOMPUTED OVER EVERY ITEM, not summed from the stops**, so gating the per-stop figures alone would have
left a delivery stop's mix in the headline the yard loads from. It needed its own tally over install stops
only (`installMaterials`).

🔴 **27 EXISTING ASSERTIONS WENT RED, AND THAT IS THE REAL FINDING: every fixture in `loadList.test.ts`
omitted `installs`, so the suite had been proving the mix/post/rope arithmetic ON ACCIDENTAL DELIVERY
STOPS.** The helper now defaults to an install (documented in place), keeping all 27 meaning what their
authors meant, and **§DO adds 10 probes for the rule itself** including the mixed-day headline.
⚠️ Two sibling suites were edited honestly rather than silenced: `installKitEquivalence` §B3 **asserted the
disagreement that found this entry and now asserts agreement**, and `loadListSubset` U2/U3 asserted
`day > crew` on the strength of a delivery stop's materials (U7 still proves the subset property whole).

## #365 — 🔴 `build_runs` AND `build_run_components` HAVE **NO WRITER AT ALL**, SO "0 BUILD RUNS" WAS NEVER EVIDENCE THAT NO BATCH HAD BEEN MADE (NEW 2026-09-25, ledger #413 — RESOLVED FOR ONE PATH IN THE SAME BUILD, CLASS STILL OPEN)

**`record_build_run` does not touch `build_runs`.** Verified against the **LIVE function body** —
`pg_get_functiondef` does not contain the string `build_runs` **at all**. And nothing else writes it
either:
- **no migration** inserts into it (the only `INSERT INTO public.build_runs` in the corpus is inside a
  commented V-block in `20260922d`),
- **no line of app code** references it (`packages/` grepped, zero non-test hits),
- the table carries an **INSERT policy gated on `inventory:update`**, so a CLIENT was meant to write it,
  **and no client was ever built.**

🔴 **THE COST IS NOT THE EMPTY TABLE — IT IS THAT THE EMPTINESS READ AS A MEASUREMENT.** Ledger #410
reported, correctly and from a live read, *"0 `build_runs` rows, 0 `build` ledger rows, all tenants"* and
drew the conclusion that **no build has ever been recorded**. That conclusion happens to be true, but
**the first half of the evidence could never have shown otherwise**: `build_runs` would read 0 after a
thousand batches. The `build` **ledger** rows are the half that carries the information, and they were
0 for the different, real reason that `record_build_run` has no caller. **A count of a table nothing
writes is not a measurement of anything** — [[R-33]]'s shape in a figure rather than in a check.

✅ **ONE PATH IS FIXED IN THE BUILD THAT FOUND IT.** `work_order_apply` (`20260925i`) now INSERTs the
`build_runs` row itself — business, recipe, batches, the yield that went on the books, `started_at`,
`finished_at`, `built_by` — with `cost_incomplete = true` and a reason, because the cost engine is
client-side (`recipeCost.ts`: landed cost, receipt matching) and a server function cannot compute it.
**A 0 in `total_cost` would read as "this batch was free" (D-9), so the column stays NULL and says why.**

⚠️ **FOUND BY A PROBE, NOT BY REVIEW, AND MY FIRST VERSION WAS WRONG IN THE SILENT DIRECTION.**
`work_order_apply` originally did `UPDATE build_runs SET started_at = …, finished_at = … WHERE id =
(v_res->>'run_id')`, assuming the RPC had created the row. **That UPDATE matched ZERO rows and reported
nothing** — the work order would have completed, the stock would have moved, and the batch time would
have been silently unrecordable for ever. Probe **D3** in `work-orders-413.pglite.mjs` caught it by
reading the row back instead of trusting the update.

🔴 **THE CLASS IS STILL OPEN, AND IT IS THE REASON THIS IS FILED RATHER THAN CLOSED.**
① **`build_run_components` still has no writer** — `record_build_run` reports what it consumed in its
return value and in the inventory ledger, but nothing lands a per-component row, so the frozen
component costs `20260922d` created columns for are unreachable.
② **A build recorded any way OTHER than through a work order still writes no `build_runs` row** — and
that is the path `feat/recipe-surfaces`' MADE IT tap would take.
③ **The cost columns are never filled by anything**, so `20260922d`'s whole purpose — *a run's cost is
FROZEN and does not move when the recipe is corrected afterwards* — is proven by its harness and
reachable by nobody.

**EXIT CONDITION:** either the MADE IT tap writes `build_runs` (with its client-computed cost) the way
the work order now does, or `record_build_run` is given that job server-side and the cost is passed in.
**Until one of them happens, `build_runs` remains a table with one writer and three unused purposes.**

---

## #366 — 🔴 A MIGRATION'S HEADER CITED A HARNESS THAT WAS NEVER WRITTEN, SO ITS V-BLOCKS WERE EXECUTED BY NOTHING — AND THE ONE DEFECT IN THEM REACHED DAVID (NEW 2026-09-25, ledger #419)

`20260925h_install_kit_components.sql` carried, in its own header:

```
-- HARNESS:      scripts/sql-harness/install-kit-411.pglite.mjs
```

🔴 **That file was never written.** Its three sibling migrations of the same set (`f`, `g`, `i`) each had a
harness that executed their V-blocks verbatim; this one had a **citation instead of a harness**. So
`20260925h`'s V1–V4 were run by nothing, and **David found the defect in V3 by pasting it against the live
database**: `rung_ok=t rung_with_factor_refused=t mix_ok=t mix_without_factor_refused=`**`f`**.

**THE DEFECT ITSELF** was SQL three-valued logic, fixed by `20260925m`: `CHECK ((rule='per_rung' AND factor
IS NULL) OR (rule<>'per_rung' AND factor > 0))` evaluates to **NULL** for a NULL factor on any other rule —
`null > 0` is NULL — **and a CHECK is satisfied by NULL; only FALSE rejects.** The constraint was
structurally incapable of refusing a missing factor. `factor IS NOT NULL` is never NULL, so the branch can
be FALSE, which is what makes a refusal possible.

🔴 **THE CLASS IS WORSE THAN THE INSTANCE, AND IT IS WHY THIS IS FILED SEPARATELY FROM THE FIX.** A forgiving
test double gives a false green (tech-debt #138, #357). **A harness that does not exist gives a false green
AND a citation vouching for it** — the header reads as evidence to the next person, and nothing in
`npm run verify` checks that a cited harness is a real file. ⚠️ **It is [[R-26]] inside our own artefacts:
a written declaration nobody checked against reality, steering a decision.**

✅ **GUARDED FOR THIS FILE ONLY, NOT FOR THE CLASS.** `install-kit-factor-419.pglite.mjs` probe **0b** asserts
that `install-kit-411.pglite.mjs` **still does not exist**, so the record cannot quietly become true by
someone creating an empty file with that name. **That protects one citation.**

🔬 **THE CLASS CAP, PROPOSED AND NOT BUILT (David's scope):** every `-- HARNESS:` line in
`supabase/migrations/*.sql` names a path that must EXIST. ~20 lines, derived from the corpus rather than a
list (#73's lesson), and it must be **red-first against this very file's old text**. ⚠️ **It cannot assert
that the harness RUNS the migration** — that is the deeper question and a path-existence check would give
false comfort about it, so the cap should say what it does and does not prove.

✅ **NO LONGER UNMEASURED — SWEPT 2026-09-25, AND IT FOUND A SECOND INSTANCE THAT IS NOT MINE.**
Every `scripts/…` path cited anywhere in `supabase/migrations/*.sql`:

| | |
|---|---|
| migrations citing a `scripts/` path | **27** |
| distinct citations | **31** |
| 🔴 citations to a file that does not exist | **3 — of which ONE is real** |

🔴 **THE REAL ONE: `20260830_inventory_unit_of_measure.sql` cites `scripts/backfill-inventory-units.mjs`
TWICE — at `:58` and at `:219` — and the file is `scripts/backfill-inventory-units.ts`.** Line 219 is an
instruction: *"after `node scripts/backfill-inventory-units.mjs` has been run…"*. **Anybody following it
gets `Cannot find module` and has no way to tell whether the backfill exists at all.** Smaller than the
`install-kit-411` case (the script is real, the extension is wrong) but the same class: **a migration
telling a person to run a path that is not there.** ⚠️ **NOT FIXED HERE — it is another session's applied
migration, and a one-word comment correction to someone else's file is a deliberate act, not a side effect
of a sweep. David's call; it is one character.**

⚠️ **THE OTHER TWO "MISSING" HITS ARE FALSE POSITIVES, AND THEY ARE A DESIGN LESSON FOR THE PROPOSED CAP:**
they are `20260925h` and `20260925m` mentioning `install-kit-411.pglite.mjs` **in prose that explains the
phantom**. A naive path-existence grep flags a file's own explanation — **exactly tech-debt #146's class**
(*probes matching their own file's PROSE; one would have passed on a DELETED guard*). **So the cap must read
only the `-- HARNESS:` line, not the whole file** — measured that way, the corpus is **4 citations across 4
migrations, 0 missing**, and `20260830`'s two are ordinary prose rather than a HARNESS line, so a
HARNESS-only cap would MISS the real instance. 🔴 **Both populations are wrong in opposite directions, and
that is the finding: the cap needs to read HARNESS lines AND run-me instructions, and exclude a file's own
account of a known absence.** Written down because it is the difference between a cap that works and one
that gets disabled on its first run (#73).

---

## #339 — 🟡 NO SIZE-DISPLAY STANDARD: SEVEN DIFFERENT FALLBACKS FOR A MISSING SIZE, AND NINE SURFACES PRINT BLANK (TRANSCRIBED AND MEASURED 2026-09-26, ledger #420 — ✅ the STANDARD is built, the NINE SURFACES are NOT converted)

✏️ **THIS ID WAS CITED IN `~/Desktop/BACKLOG-NIGHT-PLAN.md` (item Y12) AND HAD NO ENTRY IN THIS LOG** —
#195's class, filed on transcription rather than left as a dangling reference.

**`normalizeSize` exists to COMPARE two spellings; `foldLabel` and `resolveRung` place a size on the
ladder. Nothing decided what a SCREEN prints** — so each screen decided for itself. Measured 2026-09-26
across `packages/cultivar-os/src/**/*.tsx`:

| fallback | surfaces |
|---|---|
| `size ?? ''` | **9** |
| `size ?? null` | 2 |
| `size ?? container` *(borrows a different field)* | 2 |
| `size ?? '—'` | 2 |
| `size ?? 'this size'` | 1 |
| `size ?? 'no size recorded'` | 1 |
| `size ?? '(no size…'` | 1 |

🔴 **NINE SURFACES PRINT BLANK, AND BLANK IS THE ONE ANSWER THAT LIES.** David, 2026-09-12, about the
load list: *"Blank is indistinguishable from zero, and a yard person cannot tell the difference between
'no T-posts needed' and 'we could not work it out.'"* A blank size cell reads as *"this lot has no
size"* when it means *"nobody recorded one"* — **and both states genuinely exist**, because two of
LAWNS's nine rungs (`slip`, `4 in`) have no volume. D-9 / A9 in one cell.

✅ **THE STANDARD IS BUILT (ledger #420):** `packages/shared/src/utils/sizeLabel.ts` — `formatSize`,
`sizeIsRecorded`, `SIZE_ABSENT`. **It never returns an empty string**, and the absence type offers only
`dash` or `sentence`, **so a screen cannot choose blank.** It does **not** normalise a spelling (D-23 —
`normalizeSize` compares, it does not rewrite what a person typed). 35 probes, both directions,
including the whitespace trap (`!!' '` is TRUE, which is how a spaces-only value passes every check and
then renders blank) and `'0 gal'`, which must not fall through to the absence text.

🔴 **THE NINE SURFACES ARE NOT CONVERTED, AND THIS ROW STAYS OPEN FOR THAT REASON.** The standard
existing changes nothing a person sees. **Converting them is a separate pass of ~15 call sites across
cultivar-os, and every surface it changes needs its owner-test card touched (OP-14)** — which is why it
was not folded into a night-safe S item. ⚠️ **Do not read "the standard is built" as "the blanks are
fixed".**


---

## #367 — 🔴 A `general` BUSINESS GETS THE NURSERY DASHBOARD, INCLUDING A READOUT LABELLED **PLANTS** — THE VERTICAL FILTER IS WIRED AND FILTERS ALMOST NOTHING (NEW 2026-09-26, ledger #422)

**THE MECHANISM IS REAL AND CORRECT. THE REGISTRY IT READS IS NOT POPULATED.** `verticalsForBusinessType()`
(`packages/cultivar-os/src/registry/tileRegistry.ts:639`) maps `general: ['general']`, and it **is genuinely wired** —
`hooks/useModules.ts:88` and `pages/PositionBuilder.tsx:112` both call it, so this is **not** tech-debt #157's shape
(a correct mechanism with zero importers). The defect is one layer in: **the registry has exactly ONE non-`general`
tile.**

🔴 **MEASURED 2026-09-26 (LIVE code read):** a whole-registry grep for `vertical: 'cultivar'|'ignition'|'conduit'|'kinna'`
returns **1 hit** — `seasonal_module` (`:239`), which is `status: 'planned'` **and** `placement: 'settings'`, so it is
**not even a dashboard tile.** Every one of the 20 `placement: 'dashboard'` tiles is `general`. **So a `general`
business's dashboard is identical to a nursery's**, and it includes:

- `qr_checkout` — the nursery counter flow
- `inventory_intake` / `inventory_manual` — nursery stock intake
- 🔴 **`metric_plants` — a readout whose label is literally *Plants*, on a consultancy's dashboard**

⚠️ **THIS IS NOT A FALSE GREEN AND NOTHING IS BROKEN — which is exactly why it will be read as intentional.**
The tiles work; they are simply the wrong vocabulary for the tenant. The **first person to see it is Andrew, on
Monday**, on David's own `Built with CAI` tenant (ledger #422).

**WHY IT IS FILED RATHER THAN FIXED:** the repair is **tagging tiles with their vertical in the registry** — a
judgement call per tile about what a generalist business legitimately needs (receipts, customers, operating costs and
assets plausibly YES; QR checkout and plant counts plausibly NO), and **every tile whose scope changes moves a
surface, which flips its owner-test card `covered` → `owed` (OP-14)**. That is a build with a decision in the middle of
it, not a side effect of standing a tenant up. **David rules on the per-tile list.**

✏️ **AND IT CORRECTS A CLAIM MADE EARLIER IN ITS OWN SESSION.** This session first reported that `general` →
`['general']` gives *"core tiles only, already built"* — **true about the mechanism, false about the effect**, and
caught only by counting the registry's non-general tiles. **A mapping that is correctly written and correctly wired can
still be a no-op**, and reading the map without counting its population is how that goes unnoticed. [[R-26]]'s shape,
found in this session's own reasoning rather than in a document.

---

## #368 — 🟡 A BUSINESS'S ADDRESS CAN BE SET ONLY AT SIGNUP AND NEVER EDITED — THE COLUMN HAS NO EDIT SURFACE ANYWHERE (NEW 2026-09-26, ledger #422)

**MEASURED, BOTH DIRECTIONS.** `businesses.address` is written in exactly two places, both at CREATE time:
`OwnerSignup.tsx:282` (`if (collectAddress && address.trim())` — non-blank only) and the legacy
`OnboardingWizard.tsx:534`. A whole-repo grep for `from('businesses')` + `update` returns **three** hits and **none of
them touches `address`**: `DiscoveryGlimpse.tsx:183` (website), `quickbooks/refresh.ts:63` (tokens),
`QboWriteSwitch.tsx:86` (`qbo_writes_enabled`). **`Settings.tsx` contains no `businesses` read or write at all.**

⚠️ **TODAY THIS CUTS THE RIGHT WAY AND THAT IS WHY IT IS AMBER, NOT RED.** For `Built with CAI` it is a *guarantee*:
the stand-up requires the address to stay empty (David's personal address must never appear in tenant data), and
because nothing can write it, **blank stays blank permanently** — no vigilance required. It is filed because the same
property means **an owner who mistypes their address at signup, or who moves, has no way to correct it**, and the
next person to need that will look in Settings and find nothing.

🔴 **AND IT INVALIDATES A CARD AS WRITTEN.** The 2026-09-26 stand-up's card 1 said *"confirm the address shows
`not set`"* — **there is no surface on which to confirm that.** The nearest thing is the PUBLIC plant profile
(`PlantProfile.tsx:196-199`), which joins `[name, address, phone].filter(Boolean)` and therefore **omits** an absent
address rather than announcing it. That is honest (nothing wrong is shown) but it is **not** the D-9 *"announce the
absence"* form, and it is a public page rather than an owner one. **The card was rewritten to check what is
actually observable.** Tech-debt **#180**'s shape — a field deferred to a surface that cannot edit it.

---
