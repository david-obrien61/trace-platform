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
