# THE CONTAINER LADDER — RECON (ledger #326, 2026-09-14)

**Bar:** RECON. **Nothing was built.** The prompt says: *"BUILD to your own answers — unless an answer
contradicts something stated in this prompt, in which case stop and report instead of proceeding on a
guess."* **An answer contradicts the prompt. This is that report.**

Everything below marked **[MEASURED]** was run against the live database
(`bgobkjcopcxusjsetfob`) on 2026-09-14. **[READ]** was read out of the repo at `c99a4c5`.

---

## 0. THE HEADLINE — THE THREE SYMPTOMS ARE NOT ONE ROOT, AND THE BIGGEST ONE IS NOT A LADDER PROBLEM

The prompt states: *"One root: container sizes are treated as a number, and they are a LADDER."*
**Measured, that is true of two of the three symptoms and false of the first and largest.**

| Symptom in the prompt | Measured | Does a ladder fix it? |
|---|---|---|
| The uppot plan cannot plan **99 of 130** lots | **[MEASURED]** Test Dave's Tree Nest: 130 live lots, 31 plannable, **99 with `size IS NULL`** — `unit_parsed_from` is NULL on all 99, so **the parser never ran, because there is nothing to parse** | 🔴 **NO.** Not a vocabulary problem. No alias, no rung, no resolver change makes a NULL size resolvable |
| The target-size control steps by 1 and can land on 47 | **[READ]** `UppotPlan.tsx:239` is a bare `<input type="number">` — no `min`, no `step`, no `list` | ✅ **YES.** Squarely |
| The load list cannot read the size on **9 real trees** | **[MEASURED]** **Exactly 9 trees at LAWNS** carry a size that is not a single container rung | ✅ **YES**, for 5 of the 9 (see §7) |

### 🔴 The 99 are empty, not unreadable

```
Test Dave's Tree Nest — 130 live lots, unit_kind IS NULL on 99
  size_state      rows   parse_attempted
  (null)           99          0
```

`productionMath.ts:107` renders this as `"" has not been read as a unit yet.` — and the empty quotes in
that sentence are the finding. **The string it is quoting is empty because the size is empty.** The
same shape at LAWNS: 111 unparsed rows, **111 of them blank**, 0 parse attempts.

**[MEASURED] Across all three tenants, not one single non-blank size refuses the parser today.**
The resolver is not failing to read the ladder. It is being handed nothing to read.

⚠️ **This does not make the ladder unnecessary — it makes the 99 the wrong argument for it.** The
ladder's real, measured beneficiary is the 9 trees in §7 and the 47-gallon control in §5. If the
ladder ships expecting the plan to go from 31/130 to ~130/130, **it will ship and the number will not
move**, and the next session will conclude the ladder failed.

**What actually moves the 99 is a size on 99 rows** — an import that carries one, or someone typing
them. That is a different build and it is David's call whether it comes first.

---

## 1. Q1 — HOW MANY COPIES OF THE SIZE LIST EXIST?

**Four enumerated copies, and five more places that encode the vocabulary procedurally.** The
enumerated ones first, because those are the four-copies problem the prompt names:

| # | Where | State | **[READ]** |
|---|---|---|---|
| 1 | `packages/cultivar-os/src/lib/constants.ts:7` `LARGE_CONTAINERS` | 🔴 **ZERO importers — dead** | `['15 gal','30 gal','45 gal','60 gal','100 gal']` |
| 2 | `packages/cultivar-os/src/lib/constants.ts:9` `CONTAINER_SIZES` | 🔴 **ZERO importers — dead, AND WRONG** | lists `1/3/5/10/60 gal`, which are not rungs; **omits slip, 4", 65, 200**; splits 3 and 5 into two rungs |
| 3 | `packages/cultivar-os/api/orders/submit.ts:13` `LARGE_CONTAINERS` | 🔴 **A HAND COPY OF #1, AND IT IS THE LIVE ONE** — used at `:667` and `:1386` | identical five strings |
| 4 | `packages/shared/src/discovery/verticals/nursery.ts:9` | prose inside a discovery prompt | `'container sizes referenced (1 gal, 5 gal, 15 gal, 30 gal, 45 gal, 100 gal)'` |

🔴 **The prompt said the two `constants.ts` lists have zero importers. Confirmed — and the finding is
what that means: the only surviving user of the list is a SEPARATE hand copy in `api/orders/submit.ts`.
The list was already forked before anyone proposed one home.** Verified by grep: the sole import from
`lib/constants` anywhere in `cultivar-os/src` is `TransportOption` in `types/order.ts:3`.

⚠️ **Copy #3 decides whether an order gets a large-container flag.** It is live code, and it does not
know about 65 or 200 — **[MEASURED]** LAWNS has 44 rows at 65 gal and 7 at 200 gal, none of which that
list would flag.

**The five procedural encodings** — these do not hold a list, but each must learn a new rung:

| Where | What it encodes | **[READ]** |
|---|---|---|
| `packages/shared/src/inventory/unitOfMeasure.ts` | 🔴 **THE canonical resolver.** 10 ordered regex rungs | header: *"FIRST MATCH WINS, and the LADDER ORDER IS THE SPECIFICATION"* |
| `packages/shared/src/utils/sizeLabel.ts` | `normalizeSize` — known-buggy | collapses `#3/5`→`3 Gallon`, discards the other end (tech-debt #125) |
| `packages/shared/src/inventory/variantGroup.ts:52` | SKU suffix | `"45 gal"→"45G"`, gallons zero-padded to 2 digits |
| `packages/shared/src/production/productionMath.ts:88,108` | `rungKey` / `classifyLot` — grouping + refusal | groups on `unit_value`, refuses non-container and ranges |
| `packages/shared/src/quickbooks/qboItemAdapter.ts` | pulls a size out of a QuickBooks description | 2–4 trailing words |

---

## 2. Q2 — WHERE THE LADDER LIVES: `packages/shared`. CONFIDENT, AND THE ARGUMENT IS MECHANICAL

**`packages/shared/src/inventory/containerLadder.ts`, beside `unitOfMeasure.ts`.**

This is not a taste call and it does not need David:

1. 🔴 **The two modules that MUST read the ladder are already in `shared`.** The resolver
   (`shared/src/inventory/unitOfMeasure.ts`) and the planner (`shared/src/production/productionMath.ts`)
   both live there today. **A ladder in `cultivar-os` would mean `shared` importing from a vertical.**
   Tech-debt **#156** records that nothing enforces that boundary — *"a shared file could import from a
   vertical today and every check in `npm run verify` would pass"* — which makes it easier to get
   wrong, not safer.
2. **`productionMath.ts`'s own header already claims the generic ground** **[READ]**:
   `AC-1: generic. No vertical noun. A "lot" is a stock line; a "rung" is a unit size.` The word
   **rung** is already in shared, already meaning this.
3. **"Container" is not a vertical noun under AC-1.** AC-1 forbids `nursery_*`/`cultivar_*` — a
   business-type identity. A container is a physical object that a nursery, a brewery and a paint shop
   all stock. R-99 already put `unit_kind='container'` in the shared taxonomy and nobody flagged it.

⚠️ **Where I would NOT go further:** the prompt floats a generic *"unit ladder"* covering weight and
length too. **I would not build that.** R-99 settled that weight and container are different
dimensions and that `unit_kind` is what separates them; a ladder spanning both re-opens a closed
ruling. **Container rungs only.**

---

## 3. Q3 — WHAT THE RESOLVER DOES TODAY, AND WHAT READING THE LADDER COSTS IT

**[READ]** `parseUnitOfMeasure(raw)` → `{kind, value, valueMax, unit}` or `null`. Ten ordered rungs of
regex; order is documented as load-bearing. It is a **zero-dep pure leaf by deliberate design** — its
header: *"a client grid, a node backfill script and the verify cap all import it, and none of them may
drag a transitive dep in."*

🔴 **THEREFORE THE LADDER CANNOT BE READ FROM INSIDE IT.** A DB read in `parseUnitOfMeasure` breaks
the property three consumers depend on. **The ladder must be passed IN as data** — exactly the shape
`productionMath` already uses for `OperationsConfig`. That is the whole design constraint, and it
falls out of the existing header rather than being invented.

### 🔴 THE PARSER RUN AGAINST DAVID'S LADDER — **[EXECUTED]**, not read

Every rung in the prompt, fed to the real `parseUnitOfMeasure` (`node --experimental-strip-types`):

```
LABEL          | kind       | value | max  | unit
slip           | 🔴REFUSED  | -     | -    | -
Slip           | 🔴REFUSED  | -     | -    | -
4"             | length     | 4     | -    | inch
4 in           | length     | 4     | -    | inch
3/5 gal        | container  | 3     | 5    | gallon      ← a RANGE, not one rung
#3/5           | container  | 3     | 5    | gallon      ← a RANGE
95/100         | container  | 95    | 100  | gallon      ← a RANGE
15 / 30 / 45 / 65 / 95 / 100 / 200 / 7 gal  → container, gallon   ✅ all fine
20 inch box    | length     | 20    | -    | inch        ← 🔴 the word "inch" flips it
24 box         | container  | 24    | -    | box         ← the SAME pot, read correctly
```

🔴 **Three of David's nine rungs do not reach the ladder at all**, and the `20 inch box` / `24 box`
pair is the sharpest evidence in this recon: **the same physical container, one word apart, lands in
two different unit KINDS.** `rungKey` requires `unitKind === 'container'`, so `20 inch box` can never
be planned while `24 box` can.

⚠️ **And the alias form the prompt names is itself a range: `95/100` parses as 95→100**, so writing
the alias the way a grower would say it produces a refusal, not a rung.

**What reading a ladder would add (a step AFTER the parse, not a replacement):**

| Need | Today | Cost |
|---|---|---|
| Map a parsed number to a declared rung | nothing — 47 is as valid as 45 | a lookup + a "not a declared rung" outcome |
| **`slip`** — no number at all | 🔴 **REFUSES** at rung 10 | a non-numeric rung match, which the regex ladder has no form for |
| **`4"`** — inches, but a container | 🔴 **[MEASURED]** reads as `length`, so `rungKey` returns null | the ladder must own the unit, not the parse |
| **`3/5`** = ONE rung | **[MEASURED]** read as a RANGE 3→5, refused by `classifyLot` | an alias resolving to one rung |
| **`95`/`100`** = one pot | **[MEASURED]** two separate rungs (26 rows + 1 row) | an alias |
| **`20/24/36 inch box`** | 🔴 **[MEASURED]** read as `length` — **rung 5 (inch) fires before rung 7 (box)** | a genuine ordering defect, 3 live rows |

---

## 4. 🔴 THE RUNGS THAT ARE ACTUALLY IN THE DATA — AND THE 7-GALLON CASE IS ALREADY REAL

**[MEASURED]** LAWNS live container rows, by parsed value:

```
  1 gal  24 |   2 gal   7 |   3 gal  53 |  3/5 gal   2 |   5 gal  34
  7 gal  21 |  10 gal   2 | 10/15 gal  2 |  15 gal 116 |  30 gal 105
 45 gal  81 |  65 gal  44 |  95 gal  26 | 100 gal   1  | 200 gal   7 | 300 gal 1
```

- ✅ **David's ladder is confirmed in the data**: 15 · 30 · 45 · 65 · 95/100 · 200 all present and
  populous. **95 and 100 both live (26 + 1)** — the two-names-one-pot case is real, not hypothetical.
- 🔴 **THE 7-GALLON HYPOTHETICAL HAS ALREADY HAPPENED. [MEASURED] 21 rows at 7 gallon.** The prompt
  asks *"if Terry starts running 7 gallon"* — he already is, and **none of the four enumerated lists in
  §1 contains it.** The strongest single argument for a row-backed ladder is already sitting in the
  data.
- ⚠️ **1, 2, 3, 5, 10, 300 gal are also live and are NOT on David's stated ladder** (24+7+53+34+2+1 =
  121 rows). 🔴 **RETIRE-NEVER-DELETE is therefore not a future concern — it is load-bearing on day one.**
  **This needs David's answer** (§9 Q1).

---

## 5. Q4 — THE UPPOT CONTROL

**[READ]** `UppotPlan.tsx:239`:
```tsx
<input type="number" value={targets[lot.id] ?? ''} placeholder="—"
  onChange={(e) => setTargets((t) => ({ ...t, [lot.id]: Number(e.target.value) }))} />
```
No `min`, no `max`, no `step`, no `list`. Browser default step = 1 → **15 → 30 is fifteen presses**, and
**47 is accepted**. Both prompt claims confirmed.

**Cost of replacing it with a next-rung picker: small, and the math is untouched.** The cell writes a
NUMBER into `targets`, consumed at `productionMath.ts:455` as
`mixCubicYardsPerPot(lot.unitValue!, target, ops)`. **A `<select>` of the rungs above the lot's current
rung writes the same number into the same place.** One cell, plus a rung lookup. The model does not
change.

⚠️ **One real consequence:** `mixCubicYardsPerPot` is **pure gallon-difference arithmetic**
(`toGal - fromGal`). **A slip and a 4" pot have no gallon number**, so the rung's *volume for costing*
(which the prompt already names as a column) is not optional — it is what keeps this function working
at the bottom of the ladder.

⚠️ **`minutes per pot` is per-rung in the prompt and is ONE GLOBAL NUMBER today** — `runMinutes` uses
`ops.handlingMinutesPerPot` for every rung (R-89: ~60 setup + ~3/pot). Per-rung minutes is an
**extension of R-89, not an implementation of it**, and R-89 is IMPLEMENTED with mutants P1–P3
guarding it. Doable, but it touches a ruled-and-guarded model.

---

## 6. Q5 — WHO MAY EDIT THE LADDER: `settings:update` / `settings:read`. NO NEW STRING

**[READ]** Both exist in `permissionManifest.ts` (`:903-904`, `:1330`) and already gate the sibling
surface (the operations config the uppot plan reads). **Reuse them.**

⚠️ **Gate the READ on `settings:read`, not on the write string** — tech-debt **#236** is exactly that
defect at the install-price save: *"a read gated on the WRITE string is a different lie."*

---

## 7. Q6 — HISTORY: ALREADY CORRECT BY CONSTRUCTION. THE JOB IS NOT TO BREAK IT

🔴 **[MEASURED]** `production_plan_lines` stores **`from_unit_value` and `to_unit_value` as `numeric`
— not a rung reference.** A past plan already keeps the numbers it was costed with. **D-41 is
satisfied today, and a rung FK would UNDO it**: re-point a rung and every past plan re-costs.

**So the rule for the build is: store the VALUE as a snapshot. A rung id may sit ALONGSIDE it, never
instead of it.**

✅ **[MEASURED] And this is the cheapest possible moment: `production_plans` 0 rows,
`production_plan_lines` 0 rows, `business_operations_config` 0 rows.** There is no history to migrate.

⚠️ **Named, not fixed: `order_items` carries NO size column at all** **[MEASURED]** — only
`unit_price`, `original_price`, `price_leakage`, `retail_unit`. An order's size resolves *through* the
inventory row it points at, so **editing a lot's size today already rewrites what a past order appears
to have sold.** That is a pre-existing history hazard, older and wider than this build, and out of its
scope.

### The 9 trees — what the ladder actually fixes **[MEASURED]**

| Tree | size | today | under the ladder |
|---|---|---|---|
| Cedar Elm | `3/5 Gallon` | refused as a range | ✅ **plannable** — one rung |
| Native Pecan | `3/5 Gallon` | refused as a range | ✅ **plannable** — one rung |
| Texas Mountain Laurel | `20 inch box` | `length` | ✅ **container** — parser ordering fix |
| Texas Mountain Laurel | `24 inch box` | `length` | ✅ **container** |
| Texas Mountain Laurel | `36 inch box` | `length` | ✅ **container** |
| Mexican Buckeye ×2 | `10/15 gallon` | refused as a range | ⚠️ **still refused** — 10/15 is not a declared rung |
| Bald Cypress | `2"` | `length` | ⚠️ **correctly not a container** — a caliper |
| Male Yaupon Holly | `10 ft tall` | `length` | ⚠️ **correctly not a container** — a height |

**5 of 9 fixed, 2 correctly left refused, 2 genuinely a different dimension.** Cedar Elm and Native
Pecan are precisely the `Elm:CE5` / `Pecan:NP5` rows the prompt cites.

---

## 8. THREE THINGS IN THE PROMPT THAT THE REPO CONTRADICTS

1. 🔴 **The 99 unplannable lots are blank sizes, not unreadable ones** (§0). The prompt's stated root
   cause does not reach them.
2. ⚠️ **"tech-debt #292" is not the load list.** **[READ]** #292 is *"nothing asserts that an exec'd
   shell pipeline carries `set -o pipefail`"*. **There is no load-list item in the log, and no
   `load list` surface anywhere in the code** (grepped `packages/`, `api/`). **The 9-tree number is
   exactly right** — only the citation is wrong. The surface that shows it is unbuilt or named
   something else.
3. ⚠️ **The ledger #310 precedent points the other way on the write path.** The prompt says *"adding a
   rung is adding a ROW… a migration to add a container size is the failure this exists to prevent"*
   and cites #310. **[READ]** But `20260912_channels_one_vocabulary.sql:152-165` says of `channels`:
   *"NOBODY may write it from a client — adding a channel is a migration"*, with **no INSERT/UPDATE/
   DELETE policy of any kind**, and **no `business_id`** (global reference data, AC-2 deviation
   recorded). **So #310's list is platform-wide and migration-only — the exact shape the prompt
   rejects.** The *"one list, drift structurally impossible"* half transfers; the write path does not.
   **This is Q2 of §9.**

---

## 9. WHAT NEEDS DAVID BEFORE A LINE IS WRITTEN

1. 🔴 **The 121 off-ladder rows.** 1 · 2 · 3 · 5 · 10 · 300 gallon are live at LAWNS and not on the
   stated ladder. Are they **retired rungs** (offered no longer, still resolving — R-133's shape), or
   **rungs that belong on the ladder** because LAWNS genuinely runs them? This decides the seed.
2. 🔴 **Per-tenant or platform-wide?** #310's `channels` is global and migration-only. The prompt wants
   a row a person adds. **Those are different tables.** My read: **per-tenant rows** (`business_id`,
   `settings:update` to write) **seeded from a platform default**, because "Terry starts running 7
   gallon" is a LAWNS fact, not a platform fact — but this reverses the precedent the prompt cites, so
   it is David's.
3. ⚠️ **Does the 99-blank-size problem get fixed first?** The ladder will not move that number.
4. ⚠️ **Per-rung minutes** extends R-89, which is IMPLEMENTED and mutant-guarded. Confirm it should move.

---

## 10. WHAT I DID NOT DO

**No code was written. No migration. No schema change. No permission string. `api/` untouched at
12/12.** One reservation commit and this document.
