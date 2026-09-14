# RECON — HOW SHOULD BUSINESS CONFIG BE STORED?

**Ledger #319** · branch `recon/business-config-storage` · 2026-09-14 · **REPORT ONLY**
No app code, no migration, no schema, no policy, no permission string, no cap. `api/` untouched.

---

## 0. METHOD, AND WHAT THIS RECON COULD NOT MEASURE

**§10 step 10 — what I grepped for, stated so a reader can see what I could not have known.**
`docs/RULINGS.md`: `config|jsonb|key/value|key-value`. Across the corpus:
`CREATE TABLE`, `jsonb` column declarations, `business_pricing_config`, `advert_channels`,
`service_offerings`, `price_tier`, `platform_config`, `cost_confidence`, `OPERATIONS_BASIS`,
`writePricingConfig`, `mergeOwnedOverConfig`, `tPostsFor`, `mulch`, `thirds`, `7.49|43.12|23.55`,
`D-41`, `settings:`, `pricing_recipe`.
**I did not grep for:** vertical-config extraction (`VerticalConfig.ts` — §4 says it is unbuilt),
KINNA/Conduit config, or Ignition's local-first config. If a decision was recorded in one of those,
this recon did not see it.

🔴 **I COULD NOT READ THE LIVE DATABASE, AND EVERY CLAIM BELOW IS SOURCE-DERIVED UNLESS MARKED.**
`node scripts/verify-migration-apply-state.mjs --catalog` needs `SUPABASE_PAT`; loading `.env.local`
was **blocked by a deny rule** in this session. Per the 2026-08-22 catalog ruling I do not assert
live state from source. Where a number below came from an earlier **measured** read, it says so and
gives the date.

⚠️ **A SECOND SESSION IS WRITING INTO THE MAIN CHECKOUT RIGHT NOW.** At session open `git status`
showed one untracked file; minutes later five tracked docs were modified that I did not touch
(`CLAUDE.md`, `CLOSE-OUT-LEDGER.md`, `built-inventory.md`, `handoff-archive.md`, `tech-debt-log.md`).
That is **tech-debt #282** (*"TWO SESSIONS, ONE WORKING TREE"*) happening live, and its own proposed
fix — *"a session that will commit works in its own worktree"* — is what this recon did. Nothing
here touched their files.

---

## 1. PREMISE CHECKS

### ① `business_pricing_config` at LAWNS, and the tax-wipe hazard

**The hazard is DISARMED at the code layer, and has been since 2026-09-09.** Your premise is five
days out of date.

`27a19ba` — *"fix(#287): a Save may not delete a key it does not own — invert the enumeration"* —
**is an ancestor of `origin/main`** (verified by `git merge-base --is-ancestor`). It replaced the
three-name preserve list with `mergeOwnedOverConfig`, and the inversion is the point:

> *"The enumeration is inverted. A screen names the keys IT OWNS — a claim it is qualified to make —
> and every other top-level key is carried through untouched. A key nobody has heard of survives by
> default, which is the only default that is safe."*
> — `packages/shared/src/business-logic/pricingConfigMerge.ts:19-22`

`CostToProduceSettings.tsx:449` now calls it, and `:450` calls `describeCarry`, which reports
`dropped` — *"the one that must always be empty."* The owned key set is **derived** from
`EMPTY_COST_CONFIG` rather than typed out, explicitly citing #179's lesson.

It is also guarded by a **class cap**, not a file cap: `scripts/verify-pricing-config-writers.mjs`
derives the writer list from the corpus —

> *"A fourth writer added next year is caught because it is a writer, not because someone remembered
> to add it here."* — `:20-22`

🔴 **BUT THE GUARANTEE IS CODE-LAYER ONLY, AND THAT IS THE RESIDUAL WORTH KEEPING.** Nothing in
Postgres stops a writer upserting the whole column. `writePricingConfig` is
`.upsert({ business_id, config })` — a whole-column replace. The blob's key-level granularity is
enforced by **a script that reads the repo**; a table's row-level granularity is enforced by
**Postgres**. That asymmetry is real, it is permanent, and it is a better version of your
partial-update argument than the one you made. (§2, attack 5.)

**"Nearly empty" is also stale.** Last **measured** readings on record:
- 2026-09-06 (tech-debt #199): `{"taxRate": 0.0825}` — one key.
- 2026-09-08 21:12 (tech-debt #208 re-check): `discountTypes` (Military/CD10%/CD15%), `margin`,
  `locations`, `denominators`, plus `taxRate`.

⚠️ **AND THE RE-CHECK RECORDED SOMETHING YOU SHOULD CARRY REGARDLESS OF STORAGE:** populating the
config made the old hazard *more* dangerous, not less —

> *"Before, the panel refused to parse and showed platform defaults — a visible oddity that might
> have made someone stop. Now it loads LAWNS's real numbers and looks entirely trustworthy... **The
> warning sign was removed and the defect was not.**"* — `docs/tech-debt-log.md:723-726`

⚠️ **The tech-debt row is STALE IN THE OTHER DIRECTION.** `#208`'s body still reads *"FILED, NOT
FIXED"* and quotes the deleted preserve list as current, five days after `27a19ba` merged. Flagged,
not edited — this is report-only. It is the same class as #145 (a row asserting a route did not
exist while the route was shipped).

### ② How did the `advert_channels` jsonb trigger actually work out?

**It held, it is the right mechanism for that site, and it does not scale to forty — and the
migration says so itself, at your instruction.**

> *"`advert_channels` is a jsonb ARRAY inside `business_modules.config`. It is enforced by TRIGGER
> and not by a foreign key **because Postgres cannot declare a foreign key into a jsonb value, and a
> CHECK constraint cannot contain a subquery.** Neither mechanism can reach it... ⚠️ SOMEONE WILL
> READ THIS IN SIX MONTHS AND ASSUME THE FK WAS FORGOTTEN. It was not."*
> — `20260912_channels_one_vocabulary.sql:52-59`

**What it cost, counted:** one `CREATE FUNCTION` + one `CREATE TRIGGER` + a malformed-shape refusal
+ two verification probes (⑥ it refuses `myspace`, ⑦ it still accepts a legitimate write — the
negative control). **~40 lines of plpgsql for ONE jsonb field.** The function is well built: it
refuses a non-array by name rather than skipping it, citing §6 r19 — *"a non-array here would make
every check below vacuously pass, which is the 'check that cannot disagree' shape."*

🔴 **DOES IT SCALE TO FORTY? NO — AND NOT FOR THE REASON YOU'D EXPECT.** Forty triggers is tedious
but tractable. The reason it does not scale is that **each trigger is a hand-written restatement of
a rule that already exists declaratively somewhere else**, and the repo has already named that
failure mode:

> *"tech-debt #218 says the next writer is coming, and **every writer so far has restated the
> table's rules its own way**."* — `20260911_service_offerings_transport_requires_mode.sql:10-11`

One jsonb trigger is a considered exception with its limits written down. Forty is a second schema
language, maintained by hand, invisible to every tool that reads the first one.

⚠️ **AND IT IS A ONE-OFF THAT BARELY DID ITS JOB, BY ITS OWN ACCOUNT.** The defect it was written
for — one channel name in four places, two updated on 8 June 2026 and two not — left
`campaign_posts` **EMPTY on every tenant for three months** behind three committed zero-post
campaigns. The mechanism that caught it was not a check; it was a person reading four files.

⚠️ **APPLY STATE UNKNOWN TO ME.** I could not read the catalog. If `20260912` has not been applied,
the trigger does not exist and the two FKs do not either — tech-debt #253's shape (shipped code
reading three tables that do not exist). **One query settles it:**
```sql
SELECT tgname FROM pg_trigger
 WHERE tgrelid = 'public.business_modules'::regclass AND NOT tgisinternal;
SELECT count(*) FROM public.channels;
```

### ③ Every config home — and yes, there is a fourth pattern, and a fifth

**Five homes, not three. The two you have not heard of are the interesting ones.**

| # | Home | Shape | Example | Who can change it |
|---|---|---|---|---|
| 1 | **Blob, per tenant** | `jsonb` column | `business_pricing_config.config` · `business_operations_config.config` · `business_modules.config` · `business_pmi_schedule.tasks`/`.overrides` | a screen, where one exists |
| 2 | **Row-shaped, per tenant** | real table | `service_offerings` · `business_operating_days` · `business_positions` · `business_position_responsibilities` · `labor_resources` · `vendor_preferences` · `business_context` | a screen, where one exists |
| 3 | **Global reference** | real table | `channels` (6 rows) · `role_definitions` (floor rows, `business_id IS NULL`) · `permission_aliases` | 🔴 **a migration only** |
| 4 | **Operator key/value** | `key text PK, value text, description` | `platform_config` — OCR model names, feature flags | 🔴 **SQL only — RLS on, zero policies** |
| 5 | **Code constants** | TS `const` | `OPERATIONS_DEFAULTS` (18 keys) · `BOM_RULES` (7 keys, unmerged branch) · `MarginEngine` defaults · `constants.ts` | 🔴 **a deploy only** |

**Home 4 is the fourth pattern you asked about, and it is the one closest to what you want.**
`platform_config` (2026-06-11, 39 lines — the cheapest config migration in the corpus) already
proves the shape works:

> *"To swap the primary model without a code deploy: `UPDATE platform_config SET value='...' WHERE
> key='ocr_primary_model';` **That row-edit is the ONLY change needed.** ocr.ts reads this on every
> request."* — `20260611_platform_config.sql:23-24`

It is operator-scoped, not tenant-scoped, and it has **no policies at all** — so it is not a
counter-example to your key/value dismissal so much as an existence proof that the shape is already
trusted here for exactly the job in question.

**Home 5 is where your three instances live**, and it is worth being precise about which is which:
`OPERATIONS_DEFAULTS` — 18 keys, **all scalars, zero lists**. `BOM_RULES` — 6 keys, **all scalars,
zero lists**. `tPostsFor` — **a function, not data at all**. (This matters in §2.)

**The overlooked sixth thing: a config value's provenance already has two different homes**, and
they disagree about what they are for. `cost_confidence` is a **stored column**
(`CONFIRMED|DERIVED|ESTIMATED|UNKNOWN`, CHECK-constrained, 2026-06-12). `basis` is a **code-time
type** (`fact|suggestion|guess`, 2026-09-05) whose own header disqualifies it for stored values:

> *"NOT THIS MODULE: confidence in a STORED value (that is `cost_confidence`, a different axis — it
> grades a number we hold; this grades a number we DERIVED and are about to show)."*
> — `packages/shared/src/production/basis.ts:36-38`

This turns out to decide the whole question. See §4.

### ④ What does a settings SCREEN cost under each design?

**Measured from the repo, which already contains one of each.**

| Design | Live example | Screen cost | Marginal cost of the NEXT domain |
|---|---|---|---|
| **Blob of scalars** | `OperationsSettings.tsx` — 14 editable scalars | **234 lines** | a new screen (~200 lines) |
| **Table of rows** | `Settings.tsx` service-offerings block `:459-736` + `OfferingGroup` `:1251-1451` + `serviceOfferingShape.ts` | **~600 lines for ONE list** | a migration (**136–352 lines**, measured across six config-table migrations) **+ a new screen** |
| **Declared-schema, generated** | `DataSheet.tsx` — 702 lines, **7 consumers**, each a column declaration | **~700 lines ONCE** | **a declaration** |

🔴 **THE FINDING THAT DECIDES PREMISE 4: A TABLE DOES NOT MAKE A VALUE CONFIGURABLE.** `channels` is
the cleanest table in the corpus and it is **less** configurable than the code it replaced:

> *"No INSERT / UPDATE / DELETE policy of any kind. Fail-closed by design... a client has no write
> path at all."* · *"**Adding a channel is a migration.**"*
> — `20260912_channels_one_vocabulary.sql:154-156, 137`

Against your stated requirement — *a number or a list that belongs to the business should not live
in code that only he can change* — moving it from TypeScript to a policy-less table is a **lateral
move**. Before: Thunder deploys. After: David pastes SQL. Lauren still cannot touch it.
**What makes a value configurable is a WRITE POLICY and a SCREEN. Storage is downstream of both.**

**Also measured, and it removes a cost you may be assuming:** a settings screen needs **no `api/`
function**. `Settings.tsx` calls `supabase.from('service_offerings')` directly under RLS, and the
gated writes are **Postgres** functions (`set_business_tax_rate`), not Vercel ones. The 12/12 ceiling
is not a constraint on any option here.

---

## 2. THE ATTACK ON YOUR POSITION

### Attack 1 — "every one of these configs is a LIST OF ROWS" is false, and counted

Live per-tenant config keys, by shape:

| Surface | Scalars | Lists |
|---|---|---|
| `OperationsConfig` | **18** | 0 |
| `MoneyConfig` | 3 | 1 (`mixComponents`) + 1 keyed map (`potCostByUnitValue`) |
| `BOM_RULES` (unmerged) | **7** | 0 |
| cost recipe (`EMPTY_COST_CONFIG`) | several | `locations`, `pricingTiers`, `discountTypes` |

The lists are real. They are also **a minority of live config keys**, and — decisively — they are a
**different kind of thing**: they have identity, and other rows point at them. Your argument
generalises a property of the minority to the whole population.

### Attack 2 — your own third instance had the table form, and the table form WAS the defect

This is the one I would sit with. `tPostsFor` is not an example of a list waiting to become rows. It
is an example of **a list that was already rows and had to be destroyed**:

> *"🔴 **THIS WAS A TABLE OF FIVE ROWS (15·30·45·65·95) AND THAT IS WHY THE 200 GALLON LIVE OAK ON
> SATURDAY 2026-08-29 FELL OFF THE END.** A lookup answers only for the sizes somebody thought to
> type, and every size nobody typed became a hand-work case on a printed page. David's correction,
> 2026-09-12: *'the ladder does not stop at 95 gal … There is no upper bound and no hand-work case.
> **The rule is the container, not a lookup in a table of five sizes.**'*"*
> — `loadList.ts:265-270` (on `origin/feat/delivery-day-load-list`)

And it goes further, naming the trap of putting it back:

> *"⚠️ **DO NOT REACH FOR `lib/constants.ts`'s `CONTAINER_SIZES` / `LARGE_CONTAINERS`.** They exist,
> they look like the vocabulary this needs, and they are demo-era lists with ZERO importers... Wiring
> them here would reintroduce **a lookup table that is both a table AND wrong**."* — `:278-282`

A table of rows is **partial by construction**. `gallons <= 65 ? 2 : 4` is **total**. Your own
correction, twelve days ago, was to move from the first to the second.

### Attack 3 — "no CHECK constraint" cuts both ways, and the flagship table has the scar

`service_offerings` is the repo's best "config as rows" and it carries **five CHECK constraints** and
**four open tech-debt items**, three of them *about* those constraints:

- `category IN ('transport','addon','maintenance','inspection','subscription')` — and **all four
  LAWNS service rows read `category='addon'` today**, which CLAUDE.md §4 calls *"Lightning's
  2026-09-09 workaround, a symptom, not a choice."* A CHECK over a vocabulary nobody understood yet
  is a constraint that **makes the business lie to the database**.
- `price_type` / `price_unit` — tech-debt #252: *"two representations of one fact... the Settings
  editor lets the two disagree."* Two CHECKed columns, and the CHECKs cannot see the contradiction.
- **Five columns are conditionally meaningful** (`transport_mode`, `trigger_transport_mode`,
  `recurrence_days`, `requires_address`, `pre_selected` — *"Only meaningful when category = ..."*).
  A table whose columns are conditionally meaningful is **a blob with a schema**, and it needed
  `categoryScopedFields` in application code to make sense of itself anyway.

And the constraint that would genuinely have helped — *a transport service must say who transports* —
**is written and cannot be applied**: `20260911` REFUSES to run while any half-bound row exists,
by design. That is the #54/#58 shape, and it is structural: **the durable constraint arrives after
the data is dirty, and then it cannot land.**

### Attack 4 — the partial-update argument is out of date (see §1①)

It was fixed on 2026-09-09 and is guarded by a class cap. It survives only in the weaker,
truer form: the guarantee is enforced by a script, not by Postgres.

### Attack 5 — the key/value dismissal is the one that is simply wrong

> *"Against a key/value table: that is a blob with extra steps and no constraints either."*

A key/value **table** has, per value, things a blob has per *column*:
- a `CHECK` on `confidence` — the exact four-value constraint `cost_confidence` already uses;
- `set_by` / `set_at` as real columns, so provenance moves when the value moves;
- **row-level RLS**, so one key can be gated differently from its neighbour;
- an `audit_log` row per change, and a superseded-row history.

A blob has **none** of those per key. What key/value lacks is a **per-key TYPE and RANGE** constraint
— you cannot CHECK that `mixShrinkPct ∈ [0,1]` and `windowStart` is a date in one `value` column.
That is the real cost, it is payable (a `kind` column + a declared schema validated on write, which
`serviceOfferingShape.ts` already demonstrates at 117 lines), and it is **not** "no constraints
either."

---

## 3. WHERE YOU ARE RIGHT — AND THE BETTER ARGUMENT THAN THE ONE YOU MADE

**Your conclusion is correct for lists. Your reason — CHECK constraints — is the weak one. The
strong one is the FOREIGN KEY, and there is a live money defect at LAWNS that proves it.**

`customers.price_tier` is `text NOT NULL DEFAULT 'retail'` (`20260625_person_spine.sql:106`). It
points at a `name` inside a **jsonb array** — `business_pricing_config.config.pricingTiers[].name`.
Postgres cannot FK into a jsonb value. So the pointer is matched in TypeScript, exactly and
case-sensitively:

> **CARD 17 — 🔴 THE TRAP. PROVE IT DELIBERATELY, ONCE.**
> *"Tag a test customer with the tier name **in the wrong case** — `cd10%` where the tier is `CD10%`.
> Ring up a tree. **PASS (i.e. the trap is real): they are charged full price, with no warning
> anywhere.**"* — `docs/owner-tests/discount-config-full-surface-test.md:217-221`

That is the missing-FK defect, **live, on money, at the demo customer**, and no amount of code
discipline fixes it. A foreign key makes it impossible to express. **This is the strongest argument
in this recon for tables and you did not make it.**

The same reasoning is already load-bearing elsewhere, and it is about history rather than typos:
`order_service_selections.service_offering_id` is `NOT NULL REFERENCES service_offerings(id)` **with
no `ON DELETE`**, which is why a sold offering can never be destroyed —

> *"deleting one that has NOT been sold destroys its definition permanently, with no tombstone, no
> ledger row and no audit row... A service is turned Off; it is not destroyed."*
> — `Settings.tsx:647-659`

⚠️ **And one gap in that, since it bears on your D-41 invariant:** that row snapshots
`unit_price_at_time` (*"snapshot: price won't change historical records"*) but **not the service
NAME**. Rename "Trip Charge" to "Delivery Fee" and every past invoice re-labels. The price is
protected; the label is not.

**The second place you are right:** the permission boundary. See §5.

---

## 4. 🔴 THE ADDITION CHANGES THE ANSWER — AND IT CHANGES IT TOWARD YOU, BY A ROUTE YOU DID NOT TAKE

### ① UNVERIFIED VALUES MUST DECLARE THEMSELVES

**Can the `cost_confidence` discipline carry here? YES. Can `basis`? NO — and the gap is exactly one
missing class.**

`cost_confidence` (`20260612_business_assets_inventory_cost_confidence.sql:25-30`) is four values,
stored, CHECK-constrained:

> *"CONFIRMED = receipt-linked actual. **DERIVED = AI-appraised...; TRACE label. Must never read as
> CONFIRMED — Surface Honesty: the label is the signal.** ESTIMATED = manual owner estimate ('I paid
> around $X'). UNKNOWN = no basis at all. Surface Honesty: silence is worse than flagging."*

It maps onto config with nothing left over:

| Value | Config meaning | Your examples |
|---|---|---|
| **CONFIRMED** | the business measured it | trade gallon factor (Terry's own figure, 1 Sept); the window |
| **DERIVED** | **TRACE computed it from their data or their statements** | **mix ratio 1.0** · **the 66–94 gallon T-post band** · `setupMinutesPerRun` (decomposed from Terry's 2 hours for 20 pots) |
| **ESTIMATED** | the owner's rule of thumb — said, never measured | 🔴 **Terry's thirds rule.** Mauro's rates. The 3 minutes a pot |
| **UNKNOWN** | platform default nobody has checked | `mixShrinkPct` · `productiveHoursPerDay` · `survivalRate` · the mulch line |

🔴 **`basis` CANNOT CARRY IT, AND THE MISSING CLASS IS THE ONE YOUR NUMBERS LIVE IN.** `basis` is
`fact | suggestion | guess`. There is **no slot for "TRACE derived this"**. The mix ratio 1.0 and the
66–94 gallon inference would have to be filed as `suggestion` or `guess` — the first implies an
owner said it, the second implies nobody thought about it. Both misdescribe, and the `DERIVED` line
above says exactly why that matters: *"must never read as CONFIRMED — the label is the signal."*

🔴 **AND HERE IS A DEFECT THAT IS SHIPPED TODAY, ON THE ONE CONFIG SCREEN THAT ALREADY TRIES THIS.**

`OperationsSettings.tsx:157` — `const b = OPERATIONS_BASIS[k];`

`OPERATIONS_BASIS` is a **code-time const keyed by config key**
(`productionConfig.ts:136` — `Record<keyof OperationsConfig, {basis, because}>`). It labels **the
default**, not the stored value, and the screen renders it beside an editable input. So:

> Lauren measures shrink, types her real number, presses Save.
> The screen still reads **`GUESS — shrink and spill`**, and `basisSentence` appends
> *"— nobody has measured this."*

**The provenance model, as built, cannot survive its value becoming editable.** It will tell the
owner that her own measurement is a guess. That is the precise failure requirement ① exists to
prevent, already live on the only screen that attempts it.

🔴 **AND THAT IS A STORAGE ARGUMENT — THE DECISIVE ONE.** Provenance must be **stored beside the
value**, because only the write knows what the new provenance is. Provenance-per-value is
*itself a row of columns*: `value · confidence · because · set_by · set_at`.

- **In a blob:** every key becomes an object `{value, confidence, because, setBy, setAt}` and every
  reader changes. 🔴 **The sharp problem is not the merge — it is that `set_by` and `set_at` are
  SYSTEM-MANAGED (§6 r13) and a blob cannot default them.** `mergeOwnedOverConfig` replaces an owned
  key **wholesale** — deliberately, so the panel can remove something it owns — so the screen would
  write `setBy` **out of its own memory**, which is precisely the field the platform must set and the
  user must never supply. And **no CHECK can constrain `confidence`** inside jsonb.
- **In a row:** five columns; `set_by uuid NOT NULL DEFAULT auth.uid()` and
  `set_at timestamptz NOT NULL DEFAULT now()` are enforced by **Postgres, not by the screen**; one
  CHECK on `confidence`; free audit; per-row RLS. And `systemManagedFields.ts` — the canonical
  registry §6 r13 already requires — locks and explains both fields in every grid that renders them,
  for free.

**The repo already does exactly this, once.** `business_display_standards`
(`20260903b_display_standards.sql:42-64`) stores the decision *and* its provenance *and* who made it
as columns — `chosen_label`, `suggested_label`, `population`, `decided_by`, `decided_at` — with the
distinction requirement ① needs most:

> *"`chosen_label` — **NULL = asked and declined.** See the header: **absent row and NULL row are
> different facts.**"*

That is "Lauren was shown the number and disagreed" versus "nobody has asked her" — the two states a
plain number cannot hold and a blob cannot easily either.

**Verdict on ①: the four-value `cost_confidence` model carries, unchanged, and needs no new
vocabulary. What it needs is a HOME PER VALUE, which is the storage question.**

### ② SHE NEEDS THE CONSEQUENCE, NOT THE CONFIG

**It already exists. Once. It cost about twelve lines. And what made it cheap was not the screen and
not the storage.**

`OperationsSettings.tsx:145-156` — inside the Time group, above the inputs:

> *"At these numbers a pot costs **9.0 min** in runs of 10 · **6.0** in 20 · **4.0** in 60 · **3.5**
> in 120. **Batch size is the lever, not crew size.**"*

It is computed from `ops` — the **in-memory, unsaved, as-she-types** config — so the consequence
moves while she edits. Its comment says the thing your addition says:

> *"🔴 **THE DECOMPOSITION MADE LEGIBLE.** Two numbers in two boxes do not show what they do
> together; this line does."* — `:142-143`

🔴 **THE ENABLING CONDITION IS THE MODEL, NOT THE STORE.**

> *"productionMath — **THE WHOLE MODEL, PURE. NO I/O, NO CLOCK, NO DATABASE.**"*
> — `productionMath.ts:1-2`

`minutesPerPot(n, ops)` takes the config **as an argument**. A what-if readout over a pure model is a
function call. Over an impure one it is a rebuild.

**So requirement ② does NOT discriminate between the storage options.** Blob, table-per-domain and
key/value all hand you a plain object after one `resolveConfig`. Anyone costing ② as a storage
question is costing the wrong thing. **It is a purity question.**

🔴 **AND FOR THE INSTALL CASE SPECIFICALLY, THE COST IS NOT A SCREEN — THE MODEL IS NOT IN THE REPO.**

I grepped the entire tree (excluding `node_modules`/`dist`) for `7.49`, `43.12` and `23.55` — the
mulch line and the 45-gallon mix figure that tech-debt #290/#291 quote. **One hit:**
`docs/residence-product/prototypes/KitchenLoop.jsx`, unrelated. `mulch` appears in four files, none
of them a cost model. **`thirds` / `thirds rule` appears nowhere in the repo at all** — not in code,
not in `docs/`, not in the LAWNS discovery file.

tech-debt #290 and #291 (on `origin/feat/delivery-day-load-list`) describe *"the install cost model"*
without a path, and both say the same thing about the exposure:

> *"🔴 **And the derived rule is the exposure, not the line item: the thirds rule was derived off
> these numbers**, as was the price card."* — #291
> *"the mulch line makes install cost too HIGH, the mix ratio makes it too LOW, and **nobody has
> computed the net**. Correcting either one alone moves every install figure in a direction that may
> be wrong."*

**So Lauren is right, the repo already knows she is right, and it knows it in two directions at once
— and the artifact she would have to disagree with does not exist anywhere a person can open it.**

⚠️ **ONE PREMISE I CANNOT RECONCILE, AND IT NEEDS A SENTENCE FROM YOU.** Your addition calls the
thirds rule *"the overall cost breakdown"* — ⅓ materials, ⅓ labour, ⅓ something. The only thirds-
shaped rule the repo has measured is a **markup**, read off Lauren's own spreadsheet:

> *"**Retail = total landed cost per tree × 3**" · "Price Tag = Retail × 2" · "🔴 **Install Price =
> Retail + a flat fee by size: 15 gal +$150 · 30 gal +$300 · 45 gal +$450. That is $10 per
> gallon.**"* — `docs/discovery/2026-08-27-29-lawns-discovery.md:306-311`

A ×3 markup and a ⅓/⅓/⅓ cost breakdown are different claims, and **which one Lauren is disagreeing
with changes what she needs to see.** If it is the markup, the consequence readout is a price; if it
is the breakdown, it is a stacked bar. I did not guess.

⚠️ **I also could not reproduce 2.3× materials / 6× labour**, for the same reason. What the repo
*does* give: `BOM_RULES` yields a materials basket **linear in gallons except one step at 65**
(T-posts 2→4), so 30→95 gal is mix ×3.17 and T-posts ×2.0 — directionally consistent with ~2.3× for
a mix-dominated basket, **not reproducible**. The 6× labour figure has no source in the repo at all.

🔴 **THE REQUIREMENT ② FINDING THAT MATTERS MOST — AND IT IS A THIRD STORAGE ARGUMENT.** *"with the
old answer still visible"* is not a UI note. The repo has already ruled on it, in `basis.ts`:

> *"This function deliberately has no write path and no 'adopt' argument. David's ruling: *'**NEVER
> let the measured actual silently become the plan — a human moves the plan. The GAP between them is
> the instrument; collapse the two and you lose it.**'* An auto-adopting version of this would
> re-plan every batch to whatever the last one cost, **which reads as learning and is actually the
> loss of the only record that says the estimate was ever wrong.**"* — `compareToActual`, `:115-121`

To prove the model wrong over a season, Lauren needs the **superseded value retained** — what it was,
what she changed it to, when, and what each produced. **A blob has no history.** A row-per-value
table gets it from `audit_log` or a `superseded_at` column. That is the same conclusion as ①,
reached independently.

---

## 5. THE RULED CONSTRAINTS, CHECKED AGAINST THE REPO

**"A config change must NEVER re-price history."** ✅ Already implemented as a pattern, and
**storage-agnostic** — so it does not decide this question:

> *"🔴 **IT CARRIES THE ADDRESS, NOT A `customer_addresses.id`.** That is the invariant in the type
> itself: the delivery row keeps its own snapshot, so what travels to the server is TEXT. **A pointer
> would let a later edit of 'Job site A' silently rewrite where a past order went**, which is
> precisely what D-41 forbids. `siteId` rides along as **PROVENANCE only** — it records which saved
> site was picked, and **nothing resolves it at read time**."*
> — `customerAddresses.ts:58-63`

⚠️ **The one live gap:** `order_service_selections` snapshots the price and **not the name** (§3).
Under any storage choice, the rule is *snapshot the value, keep the id as provenance only* — which is
a rule about the ORDER, not about the config store.

**"One string, not one per domain — name the existing one, do not mint."**
🔴 **The existing one is `settings:read` / `settings:update` — and as stated the ruling cannot be
implemented without moving the money wall.** Config is **already** split across three permission
levels, and the split is by **MONEY**, not by domain:

- `settings:*` — *"business profile — name, address, hours"*, route-enforced; gates
  `business_operations_config`.
- `tax_rate:*` — **one key inside a blob**, gated by an RPC pair because RLS cannot reach a key.
- `pricing_recipe:*` — *"the PRICING RECIPE — the baseline margin, the tier overrides... They can
  see, and change, how every price on the platform is decided."* `sensitivity: 'confidential'`.

**Measured live at LAWNS, 2026-09-05:** *"MANAGER holds `settings:read` and `settings:update` and
holds NO `pricing_recipe:read`, `costs:*` or `wages:*`."* So naming `settings:update` as THE config
string hands Joel the margin recipe.

🔴 **AND THIS IS THE STRUCTURAL FACT UNDERNEATH THE WHOLE RECON: THE PERMISSION BOUNDARY IS THE TABLE
BOUNDARY.** RLS is row-level; a blob is one row. **Every permission distinction inside a blob costs
either a new table or a SECURITY DEFINER RPC** — and the repo has paid both, visibly:

- `business_operations_config` **exists as a separate table for no other reason.** Its own module
  says so: *"Put everything in `business_pricing_config`... and the production manager — the person
  who RUNS this plan — sees a blank right-hand column. Put everything in an operations table and the
  LABOUR RATE moves back outside the wall."* — `productionConfig.ts:13-18`
- `tax_rate` cost `get_business_tax_rate` + `set_business_tax_rate` to expose **one key**.

A row-per-value table makes that free: the permission is a predicate on the row.

---

## 6. THREE LENSES (§9 gate 10)

**HAVE** — five storage homes (§1③); one blob screen (234 lines, 14 scalars); one row screen
(~600 lines, one list); a declared-schema precedent (`DataSheet`, 702 lines, 7 consumers); a
four-value stored provenance model used on cost; a three-value code-time one used on production
defaults **that breaks the moment its value is edited**; a consequence readout that already works,
once; and a permission model whose boundary is the table.

**NEED** (irreducible, to satisfy the stated requirement + ① + ②) — for each configurable value:
(a) a home **outside code** with a **write policy** and a **screen**; (b) **stored provenance**
beside the value, on the `CONFIRMED|DERIVED|ESTIMATED|UNKNOWN` axis; (c) **who set it and when**;
(d) the **previous value retained**; (e) **a real FK wherever another row points at it**; (f) the
model that consumes it to be a **pure function**, so the consequence is a function call.

**WANT** — a new config domain costs a *declaration*, not a migration and not a screen; a config
value cannot be pointed at by a typo; provenance is impossible to omit because the type demands it
(`basis.ts`'s own argument: *"a rule enforced by the type system cannot be forgotten by a tired
author; a rule enforced by discipline can"*); and the settings screen and the cost readout are one
surface.

---

## 7. OPTIONS, NEED → WANT

**Option 1 — BLOB, unchanged, plus a provenance sub-object.** *Cheapest.* Nests
`{value, confidence, because, setBy, setAt}` per key. **Breaks `mergeOwnedOverConfig`'s top-level
granularity**, changes every reader, no CHECK on `confidence`, no history, no per-key permission,
and no FK for `price_tier`. **Meets (a) and part of (b). Fails (c)(d)(e).**

**Option 2 — TABLE PER DOMAIN (your position).** A migration + a screen per domain. Gets (e) for
lists, and (b)(c)(d) as columns. **Fails the stated requirement at the margin**: an unanticipated
domain costs 136–352 lines of SQL you must paste plus ~200–600 lines of screen. *"We do not know who
needs to change what, when"* is the case this option is weakest on.

**Option 3 — SPLIT BY WHAT THE VALUE IS (my recommendation, §8).** Lists → their own table with real
FKs. Scalars → one declared-schema config-value table. Rules → parameterised pure functions whose
parameters are scalars.

**Option 4 — Option 3 plus the unified screen.** One `ConfigSheet` component (~400–500 lines once,
on the `DataSheet` precedent) that renders value + provenance + consequence from a declaration, so
the settings screen and the cost readout are the same surface. **Marginal domain cost: a
declaration.** This is the only option that meets **(f)** as a standing property rather than
per-screen.

---

## 8. WHAT I WOULD CHOOSE, AND WHERE YOU ARE WRONG

**Option 3, growing into Option 4. Which means: you are right for one of the three kinds of thing you
named, and the generalisation is what I would reject.**

**(A) LISTS WITH IDENTITY → their own table.** Service offerings, channels, discount tiers, operating
days, BOM material lines. **You are right, and the decisive reason is the FOREIGN KEY, not the CHECK
constraint.** `customers.price_tier` charging full price on a lowercase tag is the argument.

**(B) NAMED SCALARS → ONE declared-schema table**, `(business_id, key, value, kind, confidence,
because, set_by, set_at, superseded_at)`. Not a blob. **Not a table per domain.** This is the
key/value shape you dismissed, and requirement ① is precisely what makes it beat both: provenance
per value is a row of columns, and a blob cannot CHECK it while a table-per-domain cannot be created
for a domain nobody has anticipated.

**(C) RULES → parameterised pure functions in code; their PARAMETERS are (B) scalars.** `tPostsFor`
stays a threshold function; `tPostsSmallThresholdGallons`, `tPostsAtOrBelowThreshold` and
`tPostsAboveThreshold` become three editable scalars with provenance. Lauren can move the threshold.
**She cannot make the rule partial again**, which is the defect of 2026-08-29.

### Where you are wrong, specifically

1. **"Every one of these configs is a list of rows."** Counted: 18 scalars and 0 lists in the largest
   live config surface; 7 and 0 in the BOM. The lists are the minority and a different kind.
2. **The T-post case argues against you.** It *was* five rows and the rows were the bug.
3. **"Extensibility comes from adding a ROW."** Only if someone can add the row. `channels` has no
   write policy — adding a channel is a migration. **A table is not a configurability mechanism.**
4. **"No CHECK constraint" as the case for tables.** The flagship table's CHECKs are what forced
   LAWNS to file four services as `addon`, and the CHECK that would help cannot be applied.
5. **"A partial update rewrites the whole object."** Fixed 2026-09-09, class-capped. What survives is
   the better point: the guarantee is a script, not Postgres.
6. **"A key/value table is a blob with extra steps and no constraints either."** It has a CHECK on
   confidence, per-row RLS, per-value audit and history. It lacks a per-key *type* constraint, which
   is payable. **This is the dismissal I would ask you to withdraw** — the addition makes it the
   winning shape.

### What would have to be true for the other answer to win

**For the BLOB:** drop requirement ①. Without stored per-value provenance, and with one permission
for all config, the blob is strictly cheaper — `mergeOwnedOverConfig` already makes it safe and
`resolveConfig` already hands the what-if screen its object. **Requirement ① is the whole reason it
loses.**

**For TABLE-PER-DOMAIN over key/value on scalars:** if each domain's scalars needed **per-key type
and range constraints enforced in the database**, and the set of domains were few and known in
advance. The second condition is the one your own requirement denies.

**For doing nothing yet:** if the install cost model's absence (§4②) means the first real config
surface cannot be built anyway — which is arguable, and is why the sequencing question in §9 is a
real one.

---

## 9. FLAGGED FOR DAVID

**(a)** 🔴 **THE INSTALL COST MODEL IS NOT IN THE REPO.** Grepped for `7.49` / `43.12` / `23.55` /
`mulch` / `thirds` across the whole tree: nothing. The artifact Lauren needs to disagree with cannot
be opened by anyone here. **Whatever is decided about storage, the first build is the model**, and
until it exists requirement ② has nothing to render.

**(b)** 🔴 **ONE SENTENCE NEEDED: is the thirds rule a ×3 MARKUP or a ⅓/⅓/⅓ COST BREAKDOWN?** The
discovery file measured *"Retail = total landed cost per tree × 3"* off Lauren's spreadsheet; your
addition describes a cost breakdown. Different claims, different screen.

**(c)** 🔴 **A LIVE DEFECT FOUND WHILE ANSWERING ①, NOT FIXED:** `OperationsSettings.tsx:157` reads
provenance from the **code-time** `OPERATIONS_BASIS` map, so the label is pinned to the default and
does not move when the tenant edits the value. **Lauren's own measured number will render as
`GUESS — nobody has measured this`.** Shipped, on the only config screen that attempts provenance.
Report-only; not filed as tech-debt because this pass claims no tech-debt id.

**(d)** 🔴 **A LIVE TECH-DEBT ID COLLISION.** `#290` and `#291` name **two different pairs of
defects**: on `origin/feat/delivery-day-load-list` they are the install cost model's mulch line and
mix ratio; on `main` they are the zone-walk `<datalist>` and the trailing-space labels. Both filed
2026-09-12. R-148 clause (4) applies, and **neither is mine to move.** ⚠️ **`verify-id-sweep` cannot
see it** — it checks ids claimed by *this* branch against rivals, so a collision between two *other*
branches is structurally invisible. Same family as #286.

**(e)** ⚠️ **TECH-DEBT #208 IS STALE IN THE SAFE DIRECTION.** Its body still says *"FILED, NOT
FIXED"* and quotes the three-name preserve list as current, five days after `27a19ba` merged to
`main`. #145's shape. Not edited — report only.

**(f)** ⚠️ **`20260912_channels_one_vocabulary.sql` APPLY STATE IS UNKNOWN TO ME** — I could not read
the catalog (`.env.local` load blocked). The two verification queries are in §1②. If it is not
applied, the trigger and both FKs do not exist.

**(g)** ⚠️ **THE "ONE STRING" RULING CANNOT BE IMPLEMENTED AS STATED** (§5). `settings:update` is in
`MANAGER_DEFAULT_BUNDLE`; naming it as THE config permission hands Joel the pricing recipe. The
cheapest resolution: keep `settings:*` as the config string and rule that **money config is not
"config" under this rule** — it stays behind `pricing_recipe:*`. Your call.

**(h)** ⚠️ **TECH-DEBT #282 HAPPENED DURING THIS RECON** — a second session modified five tracked
docs in the shared checkout mid-session. This pass ran in its own worktree, which is #282's own
proposed fix. Nothing here touched their files.

**(i)** ⚠️ **CLAUDE.md is 675 lines**, over its own ~600 budget — flagged, not trimmed.

**(j)** ⚠️ **NO LIVE READ ANYWHERE IN THIS DOCUMENT.** Every claim is source-derived or cites an
earlier dated measurement. The 2026-08-22 catalog ruling applies: nothing here asserts live state.
