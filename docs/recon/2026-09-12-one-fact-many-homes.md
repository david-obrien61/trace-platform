# RECON — WHERE DOES ONE FACT LIVE IN MORE THAN ONE PLACE?

**Ledger:** #317 · **Branch:** `recon/one-fact-many-homes` · **Date:** 2026-09-12 (unattended run)
**Type:** RECON. **Report only — nothing built, nothing fixed, nothing merged.**

> **SCOPE — BY CONSEQUENCE, NOT COMPLETENESS.** This is not an inventory of duplicated strings.
> It is the set of copies where **one going stale breaks something silently** — the shape that let
> `campaign_posts` reject `tiktok` for three months while three campaigns committed with zero posts
> and nothing complained.
>
> **PROVENANCE MARKS ARE LOAD-BEARING** (R-26): `[MEASURED]` was read from the live catalog or the
> files this session; `[STATED]` is quoted from a document; `[INFERRED]` has not been checked and
> **must not be promoted to fact.**
>
> ⚠️ **NO TECH-DEBT OR RULING ID IS CLAIMED BY THIS PASS.** Findings are numbered **F1…Fn** so that
> nothing dangles on an unattended tree (`verify-id-citations` clause B would be right to flag a
> cited id with no row). David converts the ones he wants into rows.

---

## HOW THE LIVE READ WAS DONE

Every catalog figure below came from `scripts/lib/pgQuery.mjs` against project `bgobkjcopcxusjsetfob`
with the read-only PAT — **not from the migration corpus**, which is the whole point: an inline
`CHECK` is auto-named by Postgres and the name is never typed, so it is unfindable by grep. That is
exactly why `campaign_posts_platform_check` survived while its named sibling on `social_drafts` was
updated (ledger #310).

Queries used, verbatim, so any figure here can be re-derived:

```sql
-- every enumerating CHECK in public
select rel.relname, con.conname, pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where con.contype = 'c' and ns.nspname = 'public'
  and pg_get_constraintdef(con.oid) ~* '= ANY|IN \(';

-- every live policy body (for the permission-string diff)
select tablename, policyname, cmd, coalesce(qual,'') || ' ' || coalesce(with_check,'')
from pg_policies where schemaname = 'public';
```

**[MEASURED] 41 enumerating CHECK constraints live in `public`. 156 live policies.**

---

## ✅ FIRST, THE ONE THAT CLOSED — AND THE RECORD THAT HAS NOT CAUGHT UP

🔴 **`docs/CLOSE-OUT-LEDGER.md` #310 says the channel-vocabulary migration is *"WRITTEN, NOT
APPLIED."* [STATED]. IT IS APPLIED. [MEASURED, 2026-09-12 ~22:05 CDT]**

```
campaign_posts_platform_fkey  FOREIGN KEY (platform) REFERENCES channels(name) ON UPDATE CASCADE ON DELETE RESTRICT
social_drafts_platform_fkey   FOREIGN KEY (platform) REFERENCES channels(name) ON UPDATE CASCADE ON DELETE RESTRICT
channels: email · facebook · instagram · sms · tiktok · twitter   (6 rows, all active)
```

Both `*_platform_check` CHECK constraints are **gone**, replaced by FKs into a six-row `channels`
table. So the exemplar duplication in this whole recon — **one channel name in four homes** — is
structurally closed, and closed the right way: a value in a table, not a string in four files.

**The finding is not that it shipped. It is that three records still say otherwise**, and they are
the records a session reads to decide whether to trust the column:

| Where | What it says | Truth |
|---|---|---|
| `docs/CLOSE-OUT-LEDGER.md` #310 | *"MIGRATION … WRITTEN, NOT APPLIED"* | applied |
| ⚡ ACTIVE STATUS / `built-inventory.md` | see F7 below — not re-checked at read time | — |
| `packages/shared/src/campaigns/types.ts` | still carries a hand-written `platform` union | see **F2** |

This is the same class as ledger #312's finding that `customer_addresses` was recorded WRITTEN-NOT-
APPLIED while being live — **two occurrences in one day of an apply-state claim in prose going stale**,
and `verify-migration-apply-state.mjs --catalog` derives the answer in seconds. The doc is the copy.

⚠️ **[INFERRED] I did not confirm who applied it or when** — no `supabase_migrations.schema_migrations`
exists on this project (recorded in `verify-migration-apply-state.mjs`'s header), so the database
cannot say. Only the shape can be observed, and it is there.

---
## THE RANKING

**Tier 1 — SILENT AND LOAD-BEARING.** A copy goes stale, something real stops working, and no screen,
log, test or cap says so. **F1 · F2 · F3 · F4.**
**Tier 2 — LOUD AND LOAD-BEARING.** A copy goes stale and it breaks, but it breaks visibly. **F5 · F6.**
**Tier 3 — COSMETIC.** Wrong, cheap to fix, nothing depends on it. **F7 · F8 · F9.**

**Would NOT fix** is stated per finding and collected at the end.

---

# TIER 1 — SILENT AND LOAD-BEARING

## F1 — 🔴 FOUR ACTIVE SERVICE OFFERINGS ARE FETCHED AND THROWN AWAY, ON A LIVE TENANT, RIGHT NOW

**The fact:** the vocabulary of `service_offerings.category`.
**The enforcer:** `service_offerings_category_check` — `transport · addon · maintenance · inspection ·
subscription` (5 values) [MEASURED].

**SEVEN homes. All seven agree today. That is not reassurance — it is the `campaign_posts` starting
position, which also agreed for eight months.**

| # | Home | Shape | What it does when wrong |
|---|---|---|---|
| 1 | `service_offerings_category_check` (live) | DB CHECK | **rejects the write** — the only enforcer |
| 2 | `packages/shared/src/discovery/seed.ts:6` | `VALID_CATEGORIES` Set | holds the row back, honestly (see below) |
| 3 | `packages/shared/src/discovery/types.ts:8` | TS union | compile error |
| 4 | `packages/shared/src/discovery/engine.ts:121` | **a string inside the AI prompt** | the model proposes the old list |
| 5 | `packages/shared/src/business-logic/serviceReview.ts:93` | `SERVICE_CATEGORIES` | runtime refusal at `:773` |
| 6 | `packages/cultivar-os/src/types/plant.ts:74` | TS union | compile error |
| 7 | `packages/shared/src/business-logic/serviceOfferingShape.test.ts:180` | `CATEGORY_CHECK` — **a test double's copy** | **the double refuses what the real DB accepts, or accepts what it refuses** |

🔴 **AND THE CONSUMER SIDE ONLY HAS TWO BUCKETS.** `packages/cultivar-os/src/hooks/useServices.ts:40-41`
— the hook that feeds checkout — queries `is_active = true AND timing = 'at_checkout'`, then:

```ts
setTransportOfferings(all.filter(o => o.category === 'transport'));
setAddonOfferings(all.filter(o => o.category === 'addon'));
```

**There is no third bucket and no complement.** Three of the five legal categories fall through the
floor: fetched over the wire, held in `all`, assigned to nothing, rendered nowhere, logged never.

🔴 **THIS IS NOT HYPOTHETICAL. [MEASURED, live, 2026-09-12]** — `Test Dave's Tree Nest` has **four**
rows that are `is_active = true`, `timing = 'at_checkout'`, and invisible:

```
inspection   | Post-Installation Warranty Check-In Visit          | $0.00 | visit
inspection   | Tree Selection Consultation (On-Farm or Virtual)   | $0.00 | visit
subscription | Landscaper and Contractor Wholesale Account        | $0.00 | order
subscription | Seasonal Fertilization Program                     | $0.00 | visit
```

**4 of that tenant's 11 active at-checkout offerings never reach the screen.** And the tell is in the
same list: a row literally named **"Tree inspection"** *does* appear — because it is miscategorised
as `addon`. So the surface shows a fake inspection and hides two real ones.

✅ **`packages/shared/src/pages/Settings.tsx` GETS THIS RIGHT AND IS THE MODEL FOR THE FIX** — it
takes two buckets and then a **complement**, so nothing can fall through:

```ts
const otherOfferings = offerings.filter(o => o.category !== 'transport' && o.category !== 'addon');
```

One file partitions exhaustively, the other does not, and **the two were written against the same
five-value vocabulary.** That is what a duplicated enumeration costs: not disagreement about the
values, but disagreement about whether you have handled them all.

**Who is authoritative:** the DB CHECK. Everything else is a copy.
**What breaks when they disagree:** an owner configures a service, sees it saved and active in
Settings, and it never appears at checkout. **No error anywhere.** For a `$0.00` consultation the
revenue impact is nil; for a priced one it is an uncharged service.
**Would anything catch it?** **No.** `verify-field-lists` explicitly scopes itself to *column* lists
and states in its own header that type unions are **not detected**. No cap reads a CHECK constraint.
**WOULD FIX** — and the cheap half is the consumer, not the vocabulary: one complement bucket in
`useServices.ts` turns a silent drop into a visible row.

---

## F2 — 🔴 THE SILENT COERCION WAS REMOVED FROM ONE TWIN AND LEFT IN THE OTHER, IN THE SAME FILE, TWENTY LINES APART

`packages/shared/src/discovery/seed.ts`. The category path was deliberately fixed, and the comment
explaining the fix is still there:

```
 * classifyCategory — D-9 honesty (replaces the old silent unknown→'addon' coercion).
 * The previous toCategory() mapped any unrecognized category to 'addon' — a quiet
 * LIE: it asserted a thing was an add-on when we had no idea what it was.
```

Twenty-five lines below, `:30`:

```ts
function toPriceUnit(raw: string): string {
  return VALID_PRICE_UNITS.has(raw) ? raw : 'order';
}
```

🔴 **Same file · same seeder · same AI-proposed input · same class of value · and the unknown value is
still silently coerced into a confident-looking one.** `price_unit` is not decoration: with
`price_type = 'per_unit'` it decides whether a service multiplies **per plant**, **per visit**, **per
vehicle**, or once **per order**. A suggestion that meant *per visit* and arrives with an unrecognised
unit is written as **per order** — priced once instead of per visit — with no flag, no `HeldOffering`
entry, and no owner review.

**Who is authoritative:** `service_offerings_price_unit_check` (`order · plant · vehicle · visit`).
**What breaks:** a mispriced service row that looks deliberate.
**Blast radius:** [INFERRED — not measured]. It fires only when the AI returns a unit outside the four,
and I cannot reconstruct past AI responses. All 23 live rows carry a legal unit, so **nothing is
visibly wrong today** — which is the point: the coercion leaves no trace of having fired.
**Would anything catch it?** **No.** The function has a `HeldOffering` reporting path available
(`classifyCategory` uses it) and does not use it.
**WOULD FIX** — it is four lines, and the file already contains the pattern to copy.

---

## F3 — 🔴 THE 12-FUNCTION CEILING IS THE MOST LOAD-BEARING NUMBER IN THE REPO, LIVES IN ~170 PLACES, AND IS DERIVED BY NOTHING

`find api -name '*.ts' | wc -l` → **12** [MEASURED, 2026-09-12]. The prose is **correct today.**

That is the problem. Crossing it does not error — per CLAUDE.md §6 r11, **the whole Vercel deploy
fails silently and the last-good bundle keeps serving**, which already cost a day on 2026-06-20.

**Where the number lives:**

| Home | Form |
|---|---|
| `CLAUDE.md` §6 r11 · §1.6 item 7 · tech-debt #41 | prose, 9 occurrences of the figure |
| `docs/CLOSE-OUT-LEDGER.md` | **167 occurrences of the literal string `12/12`** — one per build row |
| `docs/inventory-functions.md` | a `## COUNT:` heading |
| `docs/decisions/2026-06-20-vercel-function-ceiling-mitigation.md` | the slot inventory |
| `scripts/verify-api-parses.mjs:34` | a **comment** |
| the filesystem | **the only home that cannot be wrong** |

🔴 **IT HAS ALREADY GONE STALE ONCE, IN THE DANGEROUS DIRECTION.** `docs/inventory-functions.md:19`
records it in its own voice:

> *"THIS BLOCK SAID `11 of 12 — ✅ 1 SLOT HEADROOM` AND IT WAS WRONG IN THE DANGEROUS DIRECTION."*

A session reading that doc would have believed it had a free slot **at 12 of 12** and minted #13. The
repair was a hand-correction plus a staleness banner — **another copy, not a derivation.**

🔴 **AND `verify-api-parses.mjs` ALREADY WALKS `api/`.** It reads every file in that directory on
every `npm run verify` and never counts them. The check is `readdirSync(...).length <= 12`.

**Who is authoritative:** the filesystem.
**What breaks:** a silent deploy failure — the single failure mode this platform has already proven it
cannot see (#60: `313de44` sat dead ~20 hours).
**Would anything catch it?** **No.** `npm run verify` has 18 steps and none counts `api/`.
**WOULD FIX.** Of everything in this document this is the best value: one line, in a script that is
already open at the right directory, guarding a failure mode that is invisible by construction.

---
## F4 — 🔴 A TEST THAT WILL NOT COMPILE REPORTS **GREEN** IN 18 OF 24 MUTANT HARNESSES — AND THE REPO ALREADY KNOWS WHY

**The fact:** *how you run a bundled test file and can still tell that it ran.*
**Its 25 homes:** one hand-written `esbuild … | node` shell string per harness, plus `run-tests.mjs`,
plus `package.json`.

`scripts/run-tests.mjs:62` records the defect in its own voice, dated **2026-09-07**:

> 🔴 *"`set -o pipefail` IS LOAD-BEARING, NOT HYGIENE — ADDED 2026-09-07 AFTER THIS RUNNER REPORTED ✅
> ON A FILE THAT WOULD NOT COMPILE. Without it, bash returns only the LAST command's status: esbuild
> writes its error to STDERR and nothing to stdout, so `node` reads an EMPTY program, exits 0, and the
> pipeline succeeds. … [[R-33]] in the runner that certifies every other check."*

🔴 **THE KNOWLEDGE WAS WRITTEN DOWN. THE FIX WAS NOT PROPAGATED. [MEASURED]**

```
24 scripts pipe esbuild into node
 6 carry `set -o pipefail`   (customer-addresses · grid-standard · pricing-config-clobber ·
                              service-review · transport-binding · route-handoff)
18 do NOT
```

The six are the harnesses written *after* 2026-09-07. **The fix propagated forward in time and never
backward.** `package.json:15` — `verify:write-wall` — carries the defective form too.

✅ **PROVEN BY MAKING IT FAIL (§6 r19 · [[R-33]]).** Three files in a scratch directory: one that
passes, one whose assertion fails, one that is not valid TypeScript. The `suiteIsGreen()` body copied
verbatim out of `measure-channel-vocabulary-mutants.mjs:30`:

```
passing.ts     suiteIsGreen() = true      ← correct
failing.ts     suiteIsGreen() = false     ← correct
broken.ts      suiteIsGreen() = true      ← 🔴 does not compile, reports GREEN
```

and the same broken file through both pipelines:

```
WITHOUT pipefail (18 harnesses):   true
WITH    pipefail (run-tests.mjs):  false
```

⚠️ **AND THE POLARITY IS THE OPPOSITE OF WHAT I EXPECTED WHEN I STARTED THIS GREP, WHICH IS WHY IT
WAS WORTH RUNNING RATHER THAN REASONING ABOUT.** I went in expecting `catch { return false; }` to
mean *an unreachable harness scores its mutant CAUGHT*. It is the reverse: the `catch` is never
reached, because the pipeline **succeeds**. So:

- **A mutant that breaks compilation is scored `SURVIVED 🔴`** — a false alarm that sends the author
  to harden a probe that was already correct. **This has already happened and is on the record:**
  ledger #310 — *"M10 claimed to remove the pre-flight and only renamed a comment, manufacturing a
  false SURVIVED and sending me to harden a probe that was already right."*
- 🔴 **Worse, and the reason this is Tier 1: the BASELINE guard cannot see it either.** Every harness
  opens with `if (!suiteIsGreen()) { console.log('RED — aborting…'); }` at `:119`. That guard exists
  to prove the harness can reach its target before any CAUGHT is believed. **On a tree where the test
  file does not compile, it returns `true` and the run proceeds.** The one check written to prevent
  #182 is defeated by the same pipeline it is checking through.

**Who is authoritative:** `run-tests.mjs:70` — the one call site that is right, and says why.
**What breaks when they disagree:** a mutation score. Which is the evidence every `npm run verify`
close-out cites (*"9/9 mutants caught"*, *"25/25 mutants caught, 0 survived"*) to claim a probe is
real. **A number produced by a harness that cannot distinguish "did not build" from a verdict.**
**Would anything catch it?** **No — and note what that means for #182.** Tech-debt #182 asks for *"a
mutant that changes the POPULATION, not the subject"*. This is the population defect one level below
the population: not *which files were scanned*, but *whether the scan ran at all*.
**WOULD FIX.** It is `set -o pipefail; ` prepended in 19 places, and the correct string with its
reason is already in the repo to copy. ⚠️ **Expect the mutation scores to move when it lands** — some
mutants currently scored SURVIVED will become CAUGHT and vice versa. That is the fix working, and a
close-out that re-quotes an old score afterwards would be quoting a number from the broken harness.

---
# TIER 2 — LOUD, OR LOAD-BEARING BUT VISIBLE

## F5 — 🔴 "IS THIS MIGRATION APPLIED?" IS ANSWERED BY HAND IN THREE DOCS AND HAS BEEN WRONG THREE TIMES IN THREE DAYS — WHILE THE DERIVATION SITS IN THE REPO, UNPOINTED AT THE DATABASE

**The fact:** whether a migration is in the database.
**The authority:** the catalog. **The copies:** `docs/CLOSE-OUT-LEDGER.md`, `docs/tech-debt-log.md`,
`docs/built-inventory.md`, ⚡ ACTIVE STATUS — each carrying a hand-written verdict per migration.

**[MEASURED 2026-09-12, `verify-migration-apply-state.mjs --catalog`, exit 0, 137 files:]**

```
NOT_APPLIED 1 · VIOLATED 0 · STALE_DECLARATION 0 · MIXED 0 · TABLE_GONE 1 · DATA 0 ·
NOTHING_TO_APPLY 2 · COULD_NOT_CHECK 2 · INCONCLUSIVE 10 · SUPERSEDED 6 · HOLDS 4 · APPLIED 111
```

**Exactly one file is NOT_APPLIED — `20260727d_drop_losses_and_nurseries.sql`, the GATED drop that
waits on David by design.** Everything else has run. Against that, three written records:

| Record | Says | Truth [MEASURED] |
|---|---|---|
| `CLOSE-OUT-LEDGER.md` #310 | `20260912_channels_one_vocabulary.sql` **"WRITTEN, NOT APPLIED"** | applied — 2 FKs + 6-row `channels` |
| `CLOSE-OUT-LEDGER.md` #312 | `customer_addresses` **"WRITTEN, NOT APPLIED"** (corrected in-pass) | applied — RLS on, 3 policies, 14 cols |
| `tech-debt-log.md` **#253** | 🔴 **"SHIPPED CODE READS AND WRITES THREE TABLES THAT DO NOT EXIST"** | **all three live** |

#253 in full: *"`20260905_production_planning.sql` creates `business_operations_config`,
`production_plans` and `production_plan_lines`. **It is not applied** (measured 2026-09-11) … **So
Settings → Operations cannot save and the Uppot plan page cannot commit, on every tenant, today.**"*

**[MEASURED 2026-09-12]:**

```
business_operations_config   rls=true  policies=4  cols=4
production_plans             rls=true  policies=4  cols=12
production_plan_lines        rls=true  policies=4  cols=19
```

**All three exist, with RLS and four policies each.** #253's measurement was true when taken and the
row has not moved since. It is the highest-severity open row in the log, it names two surfaces as
broken on every tenant, and **it is describing yesterday.**

🔴 **AND HERE IS THE PART THAT MAKES THIS A DUPLICATION FINDING RATHER THAN A STALE-ROW FINDING.**
The derivation exists, is excellent, takes about a minute, and **the gate never points it at the
database.** `package.json:45`:

```json
"verify:migration-apply-state": "node scripts/verify-migration-apply-state.mjs --self-test"
```

`--self-test` is the **offline** probe — crafted histories, proving the classifier works. `--catalog`
is the mode that reads the live database, and **nothing in `npm run verify` runs it.** So on every
build the repo proves it *could* answer the question and does not ask it.

**Who is authoritative:** the catalog, via `--catalog`.
**What breaks when they disagree:** work is done twice, or not done. A session reading #253 would
schedule an apply that already happened; a session reading #310 would not trust a column that is live.
**Both cost a session, and #253 additionally mis-states the platform's state to anyone auditing it.**
**Would anything catch it?** **Only if someone runs `--catalog` by hand.** No gate does.
**Tier 2 rather than Tier 1** because the failure is a wasted session, not a wrong number in front of
a customer — and because a session that *acts* on the stale claim hits a live table and finds out.
**WOULD FIX** — but as a **report, not a gate**: this run took ~60s of network and needs the PAT, so
folding it into `npm run verify` would make every build need a credential and a minute. The honest
shape is a separate `npm run verify:applied` that a close-out runs before it writes an apply-state
claim into a doc. ⚠️ **I did not re-measure #253's two named surfaces** — that the tables exist does
not prove `OperationsSettings.tsx` now saves. [INFERRED] That still wants one live check.

---

## F6 — 🟡 `verify-universals` READS THE MIGRATION CORPUS TO ASSERT THINGS ABOUT POLICIES, AND THE CORPUS AND THE CATALOG DISAGREE ON FIFTY

Tech-debt **#241** already names this for one function — *"`tableHasOwnerPolicy` is a plain corpus
grep with no drop-tracking: it reads `CREATE` statements the applied migration removed. **Passing on
history.**"* What was not measured is **how big the gap between the two copies is.**

**[MEASURED 2026-09-12]** — every `CREATE POLICY` name in `supabase/migrations/` against `pg_policies`:

```
corpus CREATE POLICY names : 196
corpus DROP POLICY names   : 109
live policies              : 156

live policy with NO create anywhere in the corpus :  5
corpus-created, not live                          : 45   (40 explained by a corpus DROP, 5 not)
```

The five live-but-uncreated are all on the pre-`businesses` generation — `addons_select_public`,
`losses_all_owner`, `modules readable by authenticated users`, `nurseries_select_public`,
`nurseries_update_owner` — i.e. **tech-debt #39's class, already filed**, on tables pending DROP.

The five corpus-created-but-absent-with-no-DROP are `tone_samples_owner`, `pmi_assets_owner`,
`pmi_service_logs_owner` (from `20260529_pmi_shared.sql`, which never ran — tech-debt #248, retired in
place) and `business_assets_owner_all` / `business_assets_member_all` (the table was **renamed** to
`cost_objects`, ledger #297).

**So every individual item is explained, and that is exactly the finding.** Each of the 50 has a good
reason; none of them is visible to a checker that greps `CREATE POLICY` out of `.sql` files. The
corpus is a **second representation of the live policy set**, it is wrong about 50 of them for
defensible reasons, and `verify-universals` treats it as the truth.

**Who is authoritative:** `pg_policies`.
**What breaks:** a policy assertion that passes on a policy that no longer exists — #241's exact
words, now with a population attached.
**Would anything catch it?** **No.** `verify-universals.mjs` reads repo `.sql` and cannot read the
catalog; its own header says so.
**WOULD NOT FIX AS A REWRITE.** Rewriting `verify-universals` to read the catalog would make the
whole gate need a PAT and a network, which is the cost F5 already argues against. The proportionate
move is the same one: a separate catalog-mode report, run at close-out. #241 stays open and correct;
this is its blast radius, measured.

---
## F7 — 🔴 THE FORECAST SHAPE: "FIX IT NEXT TIME THE ORDER PATH IS TOUCHED." THE ORDER PATH HAS BEEN TOUCHED TEN TIMES.

This is the shape the prompt asked for specifically — **a line saying work is coming, with nothing
linking it to the work** — and it has a clean, measurable instance.

**Tech-debt #72, filed 2026-07-22**, cited verbatim in CLAUDE.md:233, `docs/tech-debt-log.md:404`
and `docs/handoff-archive.md:1941` — **three copies of one deferral**:

> *"the `sale` ledger row's `reason` is NULL while every neighbouring kind explains itself; **carry the
> order number at the emit sites next time the order path is touched.**"*

**[MEASURED] The trigger has fired TEN times.** `git log --since=2026-07-22 -- …/api/orders/submit.ts`
→ **10 commits**, including `#303` (the ship-to address book) and `#301` (one stop, three screens),
both this week.

**[MEASURED] The defect is untouched, and still being written.** `business_inventory_ledger`, by kind:

```
kind               rows   reason NULL   newest row
adjust               19        0        2026-09-07
order_cancelled       2        0        2026-09-03
order_committed      15        0        2026-09-09
order_created        15        0        2026-09-09
order_deleted         2        0        2026-09-08
order_fulfilled      12        0        2026-09-09
opening_balance     571        0        2026-08-25
sale                  9        9        2026-09-09      🔴
count_reconcile      11        7        2026-08-26      ⚠️ not named by #72
```

**`sale` is the only kind where every single row is unexplained**, and the newest one is dated
**2026-09-09** — three days ago, inside the window in which the order path was being rewritten twice.
Five sibling `order_*` kinds sitting beside it in the same table all explain themselves, 0 NULL out of
47 rows. **So the fix is not hard and the shape to copy is adjacent; nothing has ever told anyone
standing in that file that the deferral existed.**

⚠️ **AND THE SWEEP FOUND A SECOND INSTANCE #72 DOES NOT NAME:** `count_reconcile` is **7 of 11 NULL**.
Its newest row is 2026-08-26, so it may already be fixed at the emit site with the old rows left
behind — [INFERRED, not checked]. Either way it is not in the row that would have caught it.

**Who is authoritative:** the emit site. **The copies:** three documents describing an intention.
**What breaks when the forecast is never claimed:** an inventory ledger where nine sales cannot be
attributed to an order. Small today; permanent, because the table is append-only and its trigger
refuses `UPDATE` even to `postgres` (tech-debt #70's finding).
**Would anything catch it?** **No, and this is the structural half of the finding.** *"Next time X is
touched"* names no file, no branch and no gate. Nothing reads the tech-debt log at the moment X is
touched. The same phrasing appears in **four more places** — CLAUDE.md:597, tech-debt #294, #405, #411
(*"Next time `verify-universals.mjs` is touched"*, *"next time the ledger is touched"*, *"next time
either undo is touched"*) — plus AC-5's **"consolidate-when-touched"** in CLAUDE.md:101. **Six standing
deferrals conditioned on an event nothing observes.**
**WOULD FIX THE MECHANISM, NOT THE INSTANCES.** The instances are each small. The mechanism is one
line in a tech-debt row — a `TOUCHES:` field naming the file — and a cap that prints any open row whose
named file is in the current diff. That converts six invisible deferrals into six things a builder sees
at the moment they are standing in the right file, which is the only moment they are cheap.

---
## F8 — 🔴 **THE 12-FUNCTION COUNT IS STILL WRONG, IN THE DANGEROUS DIRECTION, IN THE DOC SESSIONS ARE TOLD TO READ FIRST.** (F3's fourth home — promoted out of Tier 3 when I found it)

`PLATFORM_STATE.md:96` [MEASURED, unchanged today]:

> `| **Vercel functions (11 of 12)** | WIRED | api/*.ts + subdirs | **11 live functions (1 slot
> headroom):** …`

**The true count is 12. There is no headroom.** This is the identical error that
`docs/inventory-functions.md` corrected on **2026-09-02**, in its own words —

> *"THIS BLOCK SAID `11 of 12 — ✅ 1 SLOT HEADROOM` AND IT WAS WRONG IN THE DANGEROUS DIRECTION."*

— and **the correction was applied to that doc and not to this one.** Ten days later the wrong value
is still sitting in `PLATFORM_STATE.md`, which is the file CLAUDE.md's Scope & Hierarchy names as
*"verified current state of every platform item (LEVEL + LOCATION + EVIDENCE) — read this first every
session before writing any code."*

🔴 **This is the exact failure mode §6 r11 exists to prevent, one layer up.** A session that reads
PLATFORM_STATE first — as instructed — learns it has a free slot, and mints `api/` file #13. The deploy
then fails silently and Vercel serves the last-good bundle.

⚠️ **Two more dead pointers on the same file, same class, lower stakes:** rows 77 and 102 both give
`api/qbo/status.ts` as a LOCATION / EVIDENCE. **That file does not exist** — it was folded into
`qbo-connector.ts` behind `?_route=status` (§6 r11's own consolidation list). A LOCATION column whose
value is a deleted path is the doc's single job, failing.

⚠️ **And its own stamp says how old it is:** `<!-- Last verified: 2026-06-13 -->` — **91 days.**

**Who is authoritative:** `find api -name '*.ts' | wc -l`.
**Would anything catch it?** **No.** Nothing counts `api/`; nothing checks a LOCATION resolves.
**WOULD FIX — this is the one item in this document I would fix tonight if I were fixing anything.**
It is a wrong number, in the dangerous direction, in the first doc a session reads, guarding a silent
failure. The fix is to delete the number and point at the command.

---

# TIER 3 — COSMETIC

## F9 — 🟡 CLAUDE.md STILL LISTS SEVEN COMPLETED EXTRACTIONS UNDER "DO NEXT AVAILABLE SESSION"

`CLAUDE.md` → **Shared Extraction Roadmap** → *"Immediate (LOW complexity, do next available
session)"*, dated 2026-05-29. **[MEASURED] all seven exist and all seven have at least one importer
outside their own definition:**

```
MarginEngine.ts     EXISTS   5 importing files      ProgressBar.tsx   EXISTS   2
statusColors.ts     EXISTS   1                      dateHelpers.ts    EXISTS   1
FormField.tsx       EXISTS   1                      formatCurrency.ts EXISTS   1
Skeleton.tsx        EXISTS   2
```

The **"Before KINNA-OS Phase 1"** block below it is the opposite and is correct — all five of those
(`useTrialStatus`, `TrialProvider`, `LeakageDetector`, `useModuleState`, `OnboardingShell`) are
genuinely absent, as is `config/VerticalConfig.ts`. So the section is **half true, with no marker
separating the halves**, which is worse than being wholly stale: a reader who spot-checks one line
and finds it accurate will trust the rest.

**What breaks:** a session rebuilds something that exists. **Mitigated by CORE MANDATE rule 1**
(*"Before writing ANY new module, check `packages/shared/src/` first"*), which is why this is Tier 3
rather than Tier 1 — the platform's own first rule catches it.
**Would anything catch it?** No, but the cost is one `ls`.
**WOULD FIX** — strike the seven done lines. It is a deletion, and it shortens a file that is 675 lines
against its own ~600 budget.

---

## F10 — 🟢 BOARD HEADER COUNTS ARE HAND-MAINTAINED AND CURRENTLY **ALL CORRECT** — REPORTED BECAUSE THE NEGATIVE RESULT IS THE USEFUL PART

The prompt named *"board headers claiming 0 of N"* as a suspected instance. **It is not one today.**

**[MEASURED]** — every board's prose header claim against `verify-owner-test-boards.mjs`'s derived count:

```
40 boards · 703 cards · 53 covered
header claims a count : 28   →  28 agree, 0 disagree
header claims none    : 12   →  the safe option
```

**Zero drift.** Two boards carry an in-file record of having drifted before and been repaired by hand
— `authority-model` (*"Denominator corrected 2026-09-11 (33 → 36): the module OFF-switch surface added
CARDS 34–36 and this claim was not bumped with them"*) and `operations-calendar` (*"15 → 16"*) — so the
class is real, has fired twice, and is currently clean because someone swept it.

🔴 **The residual is that the checker already computes every one of these numbers and never compares
them to the header it is printing beside.** `verify-owner-test-boards.mjs` prints
`✓ 12 cards · 3 covered campaign-lifecycle` while `campaign-lifecycle-full-surface-test.md:69` says
`**Board: 3 of 12 covered**`, and nothing asserts the two agree.

**WOULD FIX, cheaply, and it is the best cost/benefit in Tier 3** — the cap is already holding both
numbers. But it is genuinely cosmetic today: 28 of 28 correct.

---

## F11 — 🟡 TWO ENUM DRIFTS THAT ARE REAL, LATENT, AND NOT WORTH FIXING YET

Found by the same catalog sweep as F1, reported for completeness and **explicitly not recommended**:

| Fact | DB CHECK | The code copy | Live rows affected |
|---|---|---|---|
| `cost_objects.status` | `ACTIVE · IN_REPAIR · OFFLINE · RETIRED · IDLE · UNASSIGNED` | `STATUS_OPTIONS` in `BusinessAssets.tsx` has **4** — no `IDLE`, no `UNASSIGNED` | **0** — all 11 rows are `ACTIVE` |
| `cost_objects.cadence` | `ONE_OFF · WEEKLY · MONTHLY · QUARTERLY · ANNUAL` | `CADENCE_OPTS` in `OperatingCosts.tsx` and `CostToProduceSettings.tsx` have **4** — no `ONE_OFF`; `CountOnceSeam.ts`'s `Cadence` union has all 5 | **0** — all 11 rows are NULL |

So the database can hold a value the editor cannot display or re-select, in two places. **Nothing is
broken today because nothing has ever written those values.** ⚠️ Note the shape though: `Cadence` is
declared **three times under the same name** in three files, and **one of the three disagrees with the
other two** — which is how you get a function that accepts a value its caller's type says is
impossible.

**WOULD NOT FIX.** Zero affected rows, and the right time is when `cost_objects` first gets a
non-`ACTIVE` row — at which point it is visible immediately (a dropdown with no matching option is a
loud defect, not a silent one). Filing it now buys a row on a board and nothing else.

---
# METHOD — INCLUDING THE TWO PLACES MY OWN PROBES COULD NOT SEE WHAT THEY WERE ABOUT

⚠️ **RECORDED BECAUSE TECH-DEBT #182 IS EXACTLY THIS AND BOTH HAPPENED INSIDE ONE SESSION.**
*"A harness that cannot reach its target reports the same as one that passed."*

**① THE `.ts` / `.tsx` ALTERNATION.** Checking whether the ratchet baselines reference files that
still exist, my pattern ended `\.(?:ts|tsx|mjs|sql|md|json)`. Regex alternation is **first-match, not
longest-match**, so `Dashboard.tsx` matched as `Dashboard.ts` and the check reported **58 dead
references across four baseline files.** Every one was a phantom. With the alternation reordered
`(?:tsx|ts|…)`:

```
authority-grants-baseline.json   paths=18   MISSING=0
field-lists-baseline.json        paths=22   MISSING=0
write-paths-baseline.json        paths=47   MISSING=0
zero-row-writes-baseline.json    paths=30   MISSING=0
--- total dead references: 0
```

🔴 **The near-miss is the finding: the wrong version produced a LOUD, CONFIDENT, WRONG result that
looked exactly like a major discovery.** It would have been filed. #182's prescription — *a mutant
that changes the POPULATION* — is what catches this, and the negative control that saved me was
trivial: *does this file I can see with my own eyes appear in the "missing" list?*

**② THE WRITE-PATHS CHECK COULD NOT SEE RPCs, AND SO IT CANNOT SETTLE #185.** I then checked whether
each declared `(table, file)` pair in `write-paths-baseline.json` still holds — does the file still
mention the table? **10 of 84 pairs came back stale**, including the one tech-debt **#185** names
(`invitations.ts` declared an `audit_log` writer with zero occurrences of `audit_log`).

**That result is not usable, and `verify-write-paths.mjs`'s own header says why** — `:22`:

> *"FLOOR, NOT TOTAL: this cap reads SOURCE. An RPC's target table lives in the DATABASE, so ~11 RPC
> writes are invisible to it… **the rpc→table map is the cap's own next build — it is owed.**"*

Checked directly: `invitations.ts` calls `create_invitation` and `reset_invitation_expiry`;
`moduleState.ts` calls `set_business_module_state`. **These are RPC-mediated writes recorded
correctly by a baseline that deliberately records them.** So the declaration is right and the string
is absent, both at once.

🔴 **WHICH MEANS #185 IS UNRESOLVED IN BOTH DIRECTIONS AND SHOULD SAY SO.** Its observation is
factually true (the string is absent) and its conclusion — *"an audit write from that file lands
without the cap noticing"* — may be **the cap working as designed**. Settling it needs the rpc→table
map the cap's own header calls owed. **[INFERRED — I did not settle it, and neither a grep nor a read
of the source can.]** That map is itself this recon's subject: *which tables an RPC writes* is a fact
that lives in the database and is copied into a JSON file by hand.

---

# WHAT I WOULD **NOT** FIX

| | Why not |
|---|---|
| **F11** — `cost_objects.status` / `cadence` enum drift | Zero affected rows. A dropdown with no matching option is a **loud** defect the day it appears. Filing it buys a board row and nothing else. |
| **F6 as a rewrite** — making `verify-universals` read the catalog | It would put a PAT and a network round-trip in front of every `npm run verify`. The 50-policy gap is real and its blast radius is now measured; the proportionate answer is F5's catalog-mode **report**, not a rewrite. |
| **The `service_offerings` vocabulary itself (F1's seven homes)** | 🔴 **Do NOT chase this into a `channels`-style lookup table right now.** The DB CHECK already enforces it, all seven copies agree, and **the live damage is entirely on the consumer side** — one missing complement bucket in `useServices.ts`. Fix the bucket; leave the seven copies. Consolidating them is a good idea *later* and it is not what is broken. |
| **The 167 `12/12` strings in `CLOSE-OUT-LEDGER.md`** | They are historical build records — each one was true when written. Rewriting history to fix a count is worse than the count. **Fix `PLATFORM_STATE.md` (F8) and leave the ledger alone.** |
| **Dead markdown links in `docs/RULINGS.md`** (9 links written as `](2026-09-10-….md)` that resolve only from `docs/decisions/`) | Cosmetic. A reader finds the file in one grep. Not worth a commit of its own; fix them the next time that file is edited — ⚠️ *and yes, that is precisely the "next time X is touched" deferral **F7** is about, which is the honest reason it is listed here rather than as a finding.* |

---

# SUMMARY

| | Finding | Homes | Authoritative | Caught by | Fix |
|---|---|---|---|---|---|
| **F1** | 🔴 4 active service offerings fetched and dropped on a live tenant | 7 + 2 consumer buckets | DB CHECK | **nothing** | one complement bucket |
| **F2** | 🔴 unknown `price_unit` silently coerced to `order`; the identical coercion was removed for `category` 25 lines above | 2 twins, 1 fixed | DB CHECK | **nothing** | 4 lines, pattern in-file |
| **F3** | 🔴 the 12-function ceiling derived by nothing; already stale once, dangerously | ~170 | the filesystem | **nothing** | `readdirSync().length <= 12` |
| **F4** | 🔴 a non-compiling test reports **green** in 18 of 24 mutant harnesses | 25 | `run-tests.mjs:70` | **nothing** — incl. their own baseline guard | `set -o pipefail; ` ×19 |
| **F5** | 🔴 apply-state hand-written in 3 docs, wrong 3× in 3 days; **tech-debt #253's three "missing" tables are live** | 4 | the catalog | `--catalog`, which no gate runs | a close-out report |
| **F6** | 🟡 corpus vs catalog disagree on 50 policies | 2 | `pg_policies` | **nothing** | see F5 |
| **F7** | 🔴 *"fix it next time the order path is touched"* — touched 10×; `sale` is 9-of-9 NULL, newest 2026-09-09 | 3 + 6 like it | the emit site | **nothing** | a `TOUCHES:` field |
| **F8** | 🔴 **`PLATFORM_STATE.md` still says 11 of 12, 1 slot headroom** — in the doc read first every session | F3's 4th home | the filesystem | **nothing** | delete the number |
| **F9** | 🟡 7 completed extractions listed as "do next available session" | 1 | `ls` | CORE MANDATE r1 | delete 7 lines |
| **F10** | 🟢 board header counts — **28 of 28 correct**, hand-maintained, drifted twice before | 2 | the cap's own output | **nothing compares them** | one comparison |
| **F11** | 🟡 two latent enum drifts, 0 rows | 3 | DB CHECK | **nothing** | — |

**If only one thing is done: F8.** A wrong number, in the dangerous direction, in the first document
a session reads, guarding the one failure mode this platform has proven it cannot see.
**If two: F8 and F4.** F4 is what decides whether every *"N/N mutants caught"* in the ledger means
anything.

---

# OPEN QUESTIONS — WRITTEN DOWN RATHER THAN ASKED, PER THE RUN'S OWN RULE

1. 🔴 **Is tech-debt #253 closed?** Its three tables are live with RLS and four policies each. What I
   did **not** check is whether `OperationsSettings.tsx` now saves and `UppotPlan.tsx` now commits —
   that needs a live click, not a catalog read. **The row should not simply be marked resolved on my
   measurement alone.**
2. 🔴 **Should `useServices.ts` render `maintenance` / `inspection` / `subscription` at checkout, or
   filter them out deliberately?** F1 proves they are dropped *silently*; it does not prove they
   *should* appear. Two different fixes: a third bucket, or an explicit `.in('category', [...])` on
   the query so the exclusion is stated. **The second is honest and smaller; the first may be what
   the discovery seeder intended when it wrote those rows.** Your call.
3. 🟡 **Does `#185` stand?** See Method ②. It needs the rpc→table map, which its own cap calls owed.
4. 🟡 **`count_reconcile` is 7-of-11 NULL `reason`** and no row names it. Is that a second instance of
   #72, or already fixed at the emit site with old rows left behind? Its newest row is 2026-08-26.
5. 🟡 **`PLATFORM_STATE.md` is stamped `Last verified: 2026-06-13` — 91 days.** F8 is one wrong row in
   it. **I did not audit the other rows.** Given what one row turned out to be, that audit is worth
   scheduling on its own.

---

*Recon #317 · `recon/one-fact-many-homes` · report only — nothing built, nothing fixed, nothing merged.*
