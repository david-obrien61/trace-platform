# The industry's own grow ladder — a literature recon

**PURPOSE** — Supply a *published default* container ladder, and its per-rung figures, for a nursery
onboarding Cultivar OS self-service on day one. LAWNS's own ladder is Terry's forty years; a new
tenant has nothing, and needs something sensible before it has anything of its own.
**DEPENDENCIES** — None. This is a literature search, not a code recon. Nothing in the repo was read
to produce it and nothing in the repo is changed by it.
**OUTPUTS** — A default ladder marked as published, per-rung figures where they exist, and an
explicit inventory of the figures that **do not exist in the published record** — which is the half
that tells David what only Terry can supply.

**Filed** 2026-09-15 · ledger **#330** · research recon, **report only, nothing built**.

---

## ⚠️ THE FRAME — READ THIS BEFORE USING ANY NUMBER BELOW

**Every figure in this document is a STARTING DEFAULT marked as published. None of them is a truth
about LAWNS, and none of them is a truth about any tenant.**

A published survival rate is the average of somebody else's nursery, in somebody else's soil, under
somebody else's irrigation, in a year that already happened. **Terry's losses are Terry's.** The
first real up-pot run replaces every number here with his own measurement, and the platform should
be built expecting that replacement rather than treating these as a baseline to defend.

This is the same provenance discipline as the operations config and the LAWNS discovery doc
(`docs/discovery/2026-08-27-29-lawns-discovery.md` → PART 1 → ruling **R-26**): *a written
declaration nobody checked against reality, steering a decision*, is the defect the marks exist to
prevent.

**Provenance marks used below** — mapped onto the discovery doc's convention:

| Mark | Means | Discovery-doc equivalent |
|---|---|---|
| `[PUBLISHED]` | Read directly out of the cited source's own text by this session | `[MEASURED]`, but of a *document*, not of our data |
| `[DERIVED]` | Computed here from published figures; arithmetic shown so it can be rechecked | — |
| `[ABSENT]` | Searched for and **not found** in the published record. A finding, not a blank | — |

🔴 **`[ABSENT]` is the most important mark in this document.** Section ③ is mostly `[ABSENT]`, and
that absence is the answer to the question David asked.

---

## ① ANSI — and the first correction: the standard is no longer Z60.1

🔴 **`[PUBLISHED]` THE CURRENT STANDARD IS `ANSI Z60.2-2025`, APPROVED 17 APRIL 2025 — NOT Z60.1.**
The prompt asked for Z60.1, which was the correct designation through the 2014 edition. The
document now carries a **new base number**, published by AmericanHort (the American Horticulture
Industry Association) as an ANSI-accredited SDO. Anything in our corpus that cites "ANSI Z60.1" is
citing a superseded designation.

Two editions were read in full for this recon: **Z60.1-2004** (129 pp.) and **Z60.2-2025** (116 pp.).
The 2014 edition is behind a 403 on AmericanHort's CDN and was **not** read — see §⑦.

### The container class table

`[PUBLISHED]` **Z60.2-2025 Table 1 — "Container class volume ranges."** The 2004 values are shown
beside it; **a cell is only filled where the two editions differ.**

| Class | 2025 cubic inches | 2025 cm³ | 2004 cubic inches (only if changed) | Box equivalent |
|---|---|---|---|---|
| #SP1 | 0.1 – 9 | 0.1 – 163 | **6.5 – 8.0** | |
| #SP2 | 10 – 15 | 164 – 261 | **13.0 – 15.0** | |
| #SP3 | 16 – 30 | 262 – 507 | **20.0 – 30.0** | |
| #SP4 | 31 – 63 | 508 – 1,048 | **51 – 63** | |
| #SP5 | 64 – 136 | 1,049 – 2,229 | **93 – 136** | |
| #1 | 152 – 251 | 2,492 – 4,115 | *unchanged* | |
| #2 | 320 – 474 | 5,246 – 7,770 | *unchanged* | |
| #3 | 628 – 742 | 10,285 – 12,164 | *unchanged* | |
| #5 | 785 – 1,242 | 12,860 – 20,360 | *unchanged* | |
| #7 | 1,337 – 1,790 | 21,913 – 29,343 | *unchanged* | |
| #10 | 2,080 – 2,646 | 34,090 – 43,376 | *unchanged* | |
| #15 | 2,768 – 3,696 | 45,376 – 60,589 | *unchanged* | |
| #20 | 4,520 – 5,152 | 74,096 – 84,457 | *unchanged* | 20-inch box |
| #25 | 5,775 – 6,861 | 94,669 – 112,472 | *unchanged* | 24-inch box |
| #45 | 9,356 – 11,434 | 153,317 – 187,377 | *unchanged* | 36-inch box |
| #65 | 13,514 – 16,517 | 221,456 – 246,051 | *unchanged* | 42-inch box |
| #95/100 | 20,790 – 25,410 | 340,686 – 416,394 | *unchanged* | 48-inch box |

🔴 **`[DERIVED]` THE ONLY THING THAT CHANGED IN TWENTY-ONE YEARS IS THE BOTTOM OF THE LADDER — AND
IT CHANGED IN A WAY THAT MATTERS TO US.** Every class from #1 up is **byte-identical** between 2004
and 2025. Every **SP** class was rewritten, and the rewrite made them **contiguous**: 2004 ran
`6.5–8 · 13–15 · 20–30 · 51–63 · 93–136` with **four gaps between them**; 2025 runs
`0.1–9 · 10–15 · 16–30 · 31–63 · 64–136` with **none**. A 40-cubic-inch pot was *unclassifiable*
in 2004 and is a **#SP4** today. **The small end of the ladder is exactly where a propagating
nursery lives**, so if the platform ships an SP vocabulary it must ship the 2025 one.

### Does #1/#2/#3/#5/#7/#15/#25 map onto LAWNS's gallon vocabulary?

**Partly — and the disagreements are the useful part.**

`[PUBLISHED]` **The standard explicitly refuses the gallon vocabulary.** Z60.2-2025 §1.1.3.4:
*"Nursery stock specifications that reference only an imperial volume measurement, such as 'quarts'
or 'gallons,' are not in accordance with the Standard."* A class is a **volume range**, not a
gallon count — §1.1.3.4 again: *"Each container class includes a range of acceptable container
volumes and is not limited to a single container volume (e.g., a certain number of 'gallons')."*

`[DERIVED]` **So a "#5" is not five gallons.** At 231 in³/gal, the #5 range of 785–1,242 in³ is
**3.40 – 5.38 gallons**. Every class's range does contain its own nominal gallon volume, but the
ranges are wide, and the low end is where a cheap pot sits:

| Class | Range in gallons | True nominal (gal × 231) | Nominal inside range? |
|---|---|---|---|
| #1 | 0.66 – 1.09 | 231 in³ | yes |
| #2 | 1.39 – 2.05 | 462 in³ | yes |
| #3 | 2.72 – 3.21 | 693 in³ | yes |
| #5 | 3.40 – 5.38 | 1,155 in³ | yes |
| #7 | 5.79 – 7.75 | 1,617 in³ | yes |
| #10 | 9.00 – 11.45 | 2,310 in³ | yes |
| #15 | 11.98 – 16.00 | 3,465 in³ | yes |
| #20 | 19.57 – 22.30 | 4,620 in³ | yes |
| #25 | 25.00 – 29.70 | 5,775 in³ | yes (at the exact floor) |
| #45 | 40.50 – 49.50 | 10,395 in³ | yes |
| #65 | 58.50 – 71.50 | 15,015 in³ | yes |
| #95/100 | 90.00 – 110.00 | 21,945 in³ | yes |

`[PUBLISHED]` **NEW IN 2025 — the "true to size" designation, which exists precisely because of the
above.** §1.1.3.4: *"If the specifier requires that containers precisely match the gallon equivalent
of the container class number, the specifier must explicitly state that the containers need to be
'true to size.' Such containers should be labeled with a 'True' or 'T' designation after the '#'
classification (e.g., #5True or #5T)."* The conversion is given in the standard itself:
**gallons × 231 = cubic inches**, **gallons × 3,785 = cubic centimetres**.

> **Platform note.** If the ladder config stores a gallon number, it is storing something the
> standard says is not a specification. Storing the **class** plus an optional **`true_to_size`
> flag** is the shape the 2025 standard actually defines.

### 🔴 Where LAWNS and the standard disagree — two rungs have no class at all

`[DERIVED]` **The classes are NOT contiguous above #SP5.** Between every adjacent pair there is a
band of volumes with no class:

| Between | Unclassified band (in³) | In gallons |
|---|---|---|
| #SP5 → #1 | 137 – 151 | 0.59 – 0.65 |
| #1 → #2 | 252 – 319 | 1.09 – 1.38 |
| #2 → #3 | 475 – 627 | 2.06 – 2.71 |
| #3 → #5 | 743 – 784 | 3.22 – 3.39 |
| #5 → #7 | 1,243 – 1,336 | 5.38 – 5.78 |
| #7 → #10 | 1,791 – 2,079 | 7.75 – 9.00 |
| #10 → #15 | 2,647 – 2,767 | 11.46 – 11.98 |
| #15 → #20 | 3,697 – 4,519 | 16.00 – 19.56 |
| #20 → #25 | 5,153 – 5,774 | 22.31 – 25.00 |
| **#25 → #45** | **6,862 – 9,355** | **29.71 – 40.50** |
| #45 → #65 | 11,435 – 13,513 | 49.50 – 58.50 |
| #65 → #95/100 | 16,518 – 20,789 | 71.51 – 90.00 |
| above #95/100 | > 25,410 | > 110.00 — **no class exists** |

🔴 **`[DERIVED]` LAWNS'S `30` AND `200` RUNGS HAVE NO ANSI CLASS, AND IT IS NOT A NAMING PROBLEM —
THEY LAND IN GAPS.**
- A true **30-gallon** = 30 × 231 = **6,930 in³**, which is **69 in³ above #25's ceiling** of 6,861
  and 2,426 below #45's floor. It sits in the widest gap in the whole table.
- A true **200-gallon** = **46,200 in³**, which is **1.8×** the top of the largest class the
  standard defines. **There is no class above #95/100 at all.**
- Searched both editions directly: **`#30` appears zero times and `#200` appears zero times.**
  `#100` appears only as the upper bound of the phrase *"container classes #1 through #100."*

**This is not LAWNS being wrong.** The standard's own §1.1.3.3 provides for it: *"Parties to a
transaction may agree that nursery stock will be in an 'unclassified' container, which is a
container with a volume not included within the recommended container class volume ranges."*
And a **30-gallon** final container is used as the worked example in a land-grant economics
bulletin (§③), so it is ordinary trade practice — just trade practice the standard does not name.

> **Platform note — the load-bearing one.** A ladder config that assumes *every rung maps to an
> ANSI class* will fail on two of LAWNS's eleven rungs on day one. The rung must carry its own
> identity, with the ANSI class as an **optional, nullable attribute**, plus an `unclassified`
> state that is honest rather than blank (D-9 / A9: *absent is not empty*).

### LAWNS's ladder against the standard

| LAWNS rung | ANSI Z60.2-2025 | Note |
|---|---|---|
| seed | — | Not nursery stock until it is a plant. §⑥ |
| seedling | — | Graded by caliper/height, not container. §⑥ |
| slip | — | 🔴 **The word `slip` appears ZERO times in either edition.** §⑥ |
| 4" | **#SP4** | §1.1.3.1 names it: *"containers commonly referenced in the industry as 'four-inch' or 'quart' containers are #SP4"* |
| 3 gal / 5 gal | **#3** / **#5** | Clean map |
| 15 | **#15** | Clean map |
| **30** | 🔴 **NONE** | Falls in the #25→#45 gap (29.71–40.50 gal) |
| 45 | **#45** | Clean map |
| 65 | **#65** | Clean map |
| 95/100 | **#95/100** | Clean map — one class, two names, as LAWNS already writes it |
| **200** | 🔴 **NONE** | Above the top of the standard entirely |

---

## ② Per rung — caliper, height, spread, root ball, and the planting hole

### Caliper and height by container class — trees

`[PUBLISHED]` **Z60.1-2004 Table 8, "Container class guidelines – shade and flowering trees."**
Read the table's own instruction first, because it inverts the intuition: **the plant size is the
specification and the container is secondary.** *"All specifications shall include plant size
designation. The container class is a secondary specification that should be determined after the
desired plant size is determined."*

| Container class | Types 1 & 2 shade trees (min – max) | Types 3 & 4 small trees (min – max) | Shrub-form / multi-stem (height) |
|---|---|---|---|
| #1 | 12 in. – 4 ft. | 12 in. – 3 ft. | — |
| #2 | 2 ft. – 6 ft. | 18 in. – 4 ft. | — |
| #3 | 3 ft. – 6 ft. | 2½ ft. – 6 ft./1 in. | 2 – 5 ft. |
| #5 | 4 ft. – 7 ft. | 4 ft. – 7 ft./1¼ in. | 3 – 6 ft. |
| #7 | 5 ft. – 8 ft./1¼ in. | 5 ft. – 1½ in. | 4 – 7 ft. |
| #10 | 6 ft. – 1½ in. | 6 ft./¾ in. – 1¾ in. | 5 – 8 ft. |
| #15 | 8 ft./¾ in. – 2 in. | 1 in. – 2 in. | 6 – 10 ft. |
| #20 | 1 in. – 2½ in. | 1¼ in. – 2½ in. | 7 – 12 ft. |
| #25 | 1¼ in. – 3 in. | 1½ in. – 3 in. | 8 – 14 ft. |
| #45 | 1¾ in. – 3½ in. | 2 in. – 3½ in. | 10 – 16 ft. |
| #65 | 2 in. – 4 in. | 2½ in. – 4 in. | 12 – 18 ft. |
| #95/100 | 2½ in. – 5 in. | 3 in. – 5 in. | 14 – 20 ft. |

⚠️ `[PUBLISHED]` **The ranges OVERLAP heavily and the standard says to use that deliberately.** Its
worked example: *"a 2" caliper tree is included as the maximum plant size for a #15 container and
would NOT be appropriate. A 2" caliper tree is included as the minimum plant size for a #65
container and would NOT be appropriate. The appropriate container class would be either a #20, #25,
or #45."* **The rule is: pick a class where your plant sits in the MIDDLE of the range, not at
either end.** Fast growers go toward the max, slow/dwarf toward the min.

> **Platform note.** A validation rule of the form *"a #15 holds a 2-inch caliper tree"* would be
> **wrong in the standard's own terms** — 2 inches is #15's *maximum*, which the standard names as
> the inappropriate case. Any caliper-to-container check must encode min/max **and** the
> middle-of-range rule, or it should not be built at all.

`[PUBLISHED]` **Caliper is measured six inches above ground** for nursery stock generally, **at the
root collar** for fruit trees, small fruits, understock and seedling trees (Z60.2-2025 Annex C).

### Canopy / spread

⚠️ `[ABSENT]` **The standard does not publish a spread figure per container class for shade trees.**
Spread is the *measurement basis* for other plant types rather than an attribute of a tree rung —
Table 14 (deciduous shrubs, Types 0/1) is keyed on *"greater of height or spread"*, and Tables 21
and 27 (evergreens, Types 1/2) are keyed on **spread** directly. So for shrubs and spreading
evergreens the spread figures in §⑤ *are* the rung sizes; for shade trees there is no published
canopy number tied to the pot.

### Root ball

`[PUBLISHED]` **Z60.1-2004 Table 6, "Root ball diameters – field grown trees."**

| Caliper (Types 1 & 2 shade trees) | Min. root ball diameter |
|---|---|
| ½ in. | 12 in. |
| ¾ in. | 14 in. |
| 1 in. | 16 in. |
| 1¼ in. | 18 in. |
| 1½ in. | 20 in. |
| 1¾ in. | 22 in. |
| 2 in. | 24 in. |
| 2½ in. | 28 in. |
| 3 in. | 32 in. |
| 3½ in. | 38 in. |
| 4 in. | 42 in. |
| 4½ in. | 48 in. |
| 5 in. | 54 in. |
| 5½ in. | 57 in. |
| 6 in. | 60 in. |
| 7 in. | 70 in. |
| 8 in. | 80 in. |

`[PUBLISHED]` **Root ball DEPTH is a ratio, not a table** (Z60.1-2004 §1.6.3): *"Balls with diameters
less than 20 inches — depth not less than 65% of the diameter of the ball. Balls with diameters of
20 inches and up — depth not less than 60% of the diameter of the ball."* Depth is measured **from
the root flare**, and soil above the flare *"shall not be included in ball depth measurement, and
should be removed."*

⚠️ `[PUBLISHED]` **Two cases require a LARGER ball than the table** — both by the same rule, *"equal
to those specified in Table 6 for the next larger size nursery grown stock"*: **collected** plants
(§1.6.6, from unmanaged land) and **plantation grown** plants (§1.6.7, minimal aftercare).

### 🔴 The planting hole — NOT in the standard

🔴 `[ABSENT]` **Neither edition contains the phrase "planting hole" or "backfill". Zero occurrences
in 129 pages (2004) and 116 pages (2025).** ANSI Z60 is a **trade sizing and description standard**;
it tells a buyer and a seller what they are transacting, and it is silent on what happens after the
plant leaves. Its own Annex B says the book *"does not provide buyers with any assurance of the
health or quality of the nursery stock"* — it is a communication tool, not an agronomic one.

**The hole recommendation comes from extension, and for LAWNS's climate the right source is Texas
A&M:**

`[PUBLISHED]` **Texas A&M AgriLife, Earth-Kind Landscaping, "Planting a Tree":**
- Width: *"Dig the hole twice as wide as the root ball (container)"*
- Depth: *"no deeper than the height of the root ball"*
- Backfill: *"The soil that you dig out of the hole is what you use to backfill around the root ball."*
- Amendment: *"No soil amendments are recommended when planting a tree; Therefore, no compost, peat
  moss, or shredded pine bark should be added to the backfill."*

`[PUBLISHED]` **Texas A&M Forest Service** (Community Forestry Grants, Appendix A — standards and
specifications) states the wider form: **dig the hole 2 to 3 times the width of the root ball**,
*"as this loose soil promotes rapid root growth and quick establishment."*

⚠️ **The two Texas A&M sources say 2× and 2–3×.** That is not a contradiction to resolve in code —
it is the normal spread of extension guidance, and a default should carry the range with its source
rather than pick one and look authoritative.

`[DERIVED]` **So hole size is computable from the rung, but only via the root ball, and only for
field/B&B stock**, where ANSI gives a ball diameter per caliper. For **container** stock the "root
ball" is simply the container, so hole width = 2–3 × the container diameter — and **ANSI publishes
container VOLUME, never container DIAMETER.** A ladder that wants to print a hole size for a
container rung needs a diameter the standard does not supply. See §⑦.

---

## ③ 🔴 SURVIVAL BETWEEN RUNGS — THE QUESTION THE LITERATURE DOES NOT ANSWER

**This was the hardest question asked and it has the shortest honest answer: the published record
does not contain a per-graduation survival rate.** What it contains is (a) a name for the quantity,
(b) an aggregate whole-business rate, and (c) exactly one land-grant source with per-step numbers.

### What is `[ABSENT]`

🔴 **ANSI, both editions — zero occurrences of `survival`, `mortality`, `shrinkage`, `cull`, or
`loss rate`.** Searched directly. The standard is a sizing vocabulary and carries no production
economics whatever.

🔴 **UGA B1144 *Commercial Production of Vegetable Transplants*** — a commercial production bulletin
— **publishes a production-time table and no germination, usable-transplant, or cull percentage at
all.**

🔴 **UGA C944 *Crape Myrtle Culture*** — the species bulletin for LAWNS's signature crop — carries
**no rooting percentage, no container schedule, no cull figure.** Its entire propagation content is
one sentence: *"cuttings should root in three to four weeks."*

**The pattern across sources is consistent and it is the finding: TIMING gets published; LOSSES do
not.** Losses are a competitive number and a nursery-specific one, so they stay inside the business.

### What DOES exist — the terms, first

`[PUBLISHED]` **The industry has two names for this quantity, and knowing them is worth more than
any single figure**, because they are what to search and what to ask Terry:

1. **"Seed use efficiency"** — *"the ratio of seeds sown to seedlings harvested … a function of both
   seed quality and seedling losses during the growing season"* (USDA Forest Service, *Woody Plant
   Seed Manual*, Agriculture Handbook 727, Ch. 7, citing Thompson 1984).
2. **"Shrinkage"** — the grower-economics term for *"the fact that we do not sell all products that
   are planted."*

`[PUBLISHED]` **And there is a published FORMULA with the loss term in it** (WPSM Ch. 7):

> Seed sowing rate = (desired seedbed density) ÷ (seed viability × **nursery factor** × seeds per weight)

**The "nursery factor" is the survival fraction, sitting in a standard formula, with no published
value** — because every nursery supplies its own. That is the literature agreeing with the frame at
the top of this document.

### The numbers that do exist

**🔴 The only per-step figures found, and they are from a land-grant source:**

`[PUBLISHED]` **Southern Cooperative Series Bulletin #402**, *The Economics of Producing Nursery
Crops Using the Pot-in-Pot Production System* (Hall — Univ. of Tennessee, now Texas A&M; Haydu —
Univ. of Florida; Tilt — Auburn; Nov 2002). **Live oak**, two phases:

| Phase | Step | Duration | **Loss rate** |
|---|---|---|---|
| 1 | 3-gal liner → **15-gallon** | 12 months (6 mo pot-to-pot Oct–Mar, 6 mo pot-in-pot Apr–Sep) | **4%** |
| 2 | 15-gallon → **30-gallon** | second year | **2%** |

Its own words: *"Both systems assume 4% loss rate"* (Phase 1) and *"Assumes 2% loss rate"* (Phase 2).
⚠️ **Note the word "assume" — these are budget assumptions, not a measured survey.** And note the
final container: **30-gallon**, the rung ANSI does not classify.

**Whole-business shrinkage, aggregate — NOT per rung:**

| Figure | Source | Provenance |
|---|---|---|
| **~8%** across all plant types | Fisher et al. 2014, cited by UF/IFAS **FE1119** | The nearest thing to a measured industry figure found |
| **10%** assumed | UF/IFAS **FE1119** (greenhouse perennials) | *"we assumed a 10% shrinkage rate"* — a conservative buffer on the 8% |
| **0 / 2.5 / 5 / 10 / 15%** | UGA, poinsettia budget simulation | Labelled best / optimal / **median** / pessimistic / worst |

⚠️ **UF FE1119 ran NO sensitivity analysis on shrinkage** — it applies one flat rate as
`Total Sales = Unit price × Number of plants × (1 – shrinkage rate)`. And the UGA article
**does not say where in the production cycle the shrinkage occurs.** So neither can be decomposed
into per-rung rates; they are one number for a whole business.

**The bottom rung — seed to plantable seedling — is the ONE place with a real measured range:**

`[PUBLISHED]` **Mexal & South, "Bareroot Seedling Culture," *Forest Regeneration Manual* Ch. 6.**
Seed efficiency = plantable seedlings ÷ pure live seed sown:

- **Range across Southern bareroot nurseries: 40 – 90%**
- **Average across all bareroot nurseries (1985 estimate): ~66%**
- **Achievable with good seed and good management: > 80%**
- A **single storm** can cause *"mortality of 4% or more"*; a soil-stabilising chemical raised
  seedling yield at one nursery by **15%**.
- Methyl bromide fumigation is cost-effective *"with only a 4% increase in seed efficiency"* where
  seed has a present net value of 3 cents or more.

🔴 **A 40–90% range is a 50-point spread on the single most consequential rung.** That is not a
number the platform can default to usefully — it is the strongest possible evidence for the frame:
**this figure must come from the grower.**

`[PUBLISHED]` **The four cull categories** (same source, §6.3.4) — useful because they are what a
count screen would have to offer as reasons: *"Seedlings that do not meet the minimum specifications
of an ideotype are 'culls'. Culls include seedlings with (1) disease, (2) mechanical injury,
(3) small root-collar diameter, or (4) excessive height."*
⚠️ Note that **two of the four are size failures, not deaths.** A "loss" between rungs is not
necessarily a dead plant — it may be a living plant that failed grade. **A data model with a single
`lost` event cannot express that**, and `cultivar_plants`/`plant_events` should be checked against
it before any survival figure is stored (see §⑧).

`[PUBLISHED]` **Culling is a physical sorting step, not a calculation** (WPSM Ch. 7): *"Graders
visually rate each seedling according to predetermined grading standards. Bundles of 'shippable'
seedlings are placed on a moving belt and 'culls' are discarded onto the floor and destroyed."*
Some nurseries use **three** outcomes, not two: *"shippable seedlings, transplants, and culls"* —
i.e. **a plant that fails the sale grade can be demoted back onto the ladder rather than destroyed.**

> **Platform note.** That three-way outcome is the ladder's real shape: at each graduation a plant
> is **promoted**, **held back**, or **culled** — and "held back" is invisible in any model that
> only counts survivors. Cost per surviving plant will be wrong if held-back plants are counted as
> losses, and wrong in the other direction if they are counted as graduates.

---

## ④ Time in each rung

`[PUBLISHED]` **The forestry stock-type notation is the industry's own encoding of time-in-rung**
(Minnesota DNR, *Seedling Stock Types*): *"Barerooted seedlings usually are described by age class,
using two numbers separated by a hyphen. The first number is the number of years the seedling has
been in the bed where the seed was sown … The second number is the number of years the seedling was
in a transplant bed."*

| Code | Reading | Total age |
|---|---|---|
| **1-0** | 1 yr seedbed, never transplanted | 1 yr |
| **2-0** | 2 yr seedbed | 2 yr |
| **3-0** | 3 yr seedbed | 3 yr |
| **1-1** | 1 yr seedbed + 1 yr transplant bed | 2 yr |
| **2-1** | 2 yr seedbed + 1 yr transplant bed | 3 yr |
| **2-2** | *"in the first bed for two years, then transplanted in to another bed where it remained for another two years"* | **4 yr** |
| **plug+1** | 1 yr container/greenhouse, extracted and root-pruned, then 1 yr in a nursery bed | 2 yr |

`[PUBLISHED]` **ANSI has its own, finer-grained version of the same idea** — the propagation and
cultural history codes (Z60.1-2004 §6.1.1.1), which record **both the propagation type and the time
in each stage**:

> Types: `C` cutting · `U` unrooted cutting · `G` grafted · `L` layered · `S` seedling ·
> `M` micropropagated/tissue cultured · `D` division · `Coll.` collected
> Cultural: `R` root pruned · `P` pot or container grown · `T` transplanted (one T per time) ·
> `B` bed grown · `O` not transplanted

With the standard's own worked examples:
- **`C1T2`** — *"3-year plant: 1 year in the cutting bench, then transplanted once for 2 years"*
- **`S2T1T1`** — *"4-year plant: 2 years in the seedling bed, transplanted twice for one year each time"*
- **`G1R1`** — *"2-year graft, root pruned after first year"*
- **`M1T1`** — *"2-year plant: 1 year established ex vitro from micropropagation, then transplanted for 1 year"*

🔴 **This is the single most directly reusable thing in this whole document.** `C1T2` is a
**complete, compact, industry-standard serialisation of a plant's ladder history** — every rung, its
method, and its duration, in one string that growers already read. **If the platform needs a format
for "where has this plant been," the standard already defines one and it is four characters long.**
`[PUBLISHED]` Age is defined as *"the total of the number of years in the plant history code"* — so
age is **derived**, never stored separately.

### Published durations

| Step | Duration | Source | Provenance |
|---|---|---|---|
| Crape myrtle cutting → rooted | **3–4 weeks** | UGA C944 | `[PUBLISHED]` |
| 32-cell liner → finished #1 | **7–9 weeks** at 65–70 °F | trade press (Greenhouse Grower) | `[PUBLISHED]`, ⚠️ trade not extension |
| 3-gal liner → **15-gal** (live oak, PIP) | **12 months** | SCSB #402 | `[PUBLISHED]` |
| 15-gal → **30-gal** (live oak) | **second year** | SCSB #402 | `[PUBLISHED]` |
| Field/B&B planting → harvest | *"harvesting will begin **three to five years** after planting"* | Arkansas Ext. FSA-6056 | `[PUBLISHED]` |
| Shrub bump-up, bought small | *"grown and sold in **one growing season**"* | TN State container handout | `[PUBLISHED]` |
| Crape myrtle form training | grow 1 yr, **cut to the ground in spring of year 2**, select stems, grow on | UGA/trade | ⚠️ `[PUBLISHED]` but summarised, not read in full text |

⚠️ **Does it vary by species group? Yes — and the published record shows the variation without
quantifying it systematically.** There is no published table of "months in rung by species group"
for ornamental nursery stock. The closest thing to one is the vegetable table in §⑤, which exists
because vegetable transplant production is far more uniform.

---

## ⑤ The same ladder for shrubs, perennials and vegetables

**Short answer: shrubs share the tree ladder's CLASSES but have their own SIZE table; evergreens
have their own; perennials have a different ladder that stops at #2; vegetables are not in the
standard at all.**

### Shrubs — Table 14, keyed on height or spread, not caliper

`[PUBLISHED]` **Z60.1-2004 Table 14, "Container class guidelines – deciduous shrubs."** Type 0/1 is
measured by *"greater of height or spread"*; Types 2 and 3 by height.

| Container class | Type 0 & 1 (min – max) | Type 2 (min – max) | Type 3 (min – max) |
|---|---|---|---|
| #1 | 3 – 15 in. | 6 – 15 in. | 6 – 15 in. |
| #2 | 6 – 18 in. | 12 – 18 in. | 15 – 24 in. |
| #3 | 9 – 24 in. | 15 – 24 in. | 18 – 30 in. |
| #5 | 12 in. – 3 ft. | 18 in. – 3 ft. | 24 in. – 4 ft. |
| #7 | — | 24 in. – 4 ft. | 30 in. – 5 ft. |
| #10 | — | 3 – 6 ft. | 3 – 7 ft. |
| #15 | — | 4 – 8 ft. | 4 – 10 ft. |
| #25 | — | — | 5 – 12 ft. |
| #45 | — | — | 7 – 14 ft. |
| #65 | — | — | 10 – 14 ft. |

⚠️ **Note the ladder gets SHORTER for smaller forms** — a Type 0/1 shrub tops out at **#5**. The
rung set is **per plant type**, not global.

### Evergreens — juniper and cherry laurel

🔴 `[DERIVED]` **Tables 21 (coniferous evergreens) and 27 (broadleaf evergreens) are NUMERICALLY
IDENTICAL.** Checked row by row. **Juniper and cherry laurel run the same ladder** even though they
sit in different sections of the standard.

| Container class | Spreading types (spread) | Upright types (height) |
|---|---|---|
| #1 | 6 – 12 in. | 6 – 15 in. |
| #2 | 9 – 15 in. | 12 – 24 in. |
| #3 | 12 – 24 in. | 15 in. – 3 ft. |
| #5 | 15 – 30 in. | 18 in. – 4 ft. |
| #7 | 18 in. – 4 ft. | 24 in. – 6 ft. |
| #10 | 24 in. – 5 ft. | 30 in. – 7 ft. |
| #15 | 30 in. – 6 ft. | 4 – 8 ft. |
| #25 | 36 in. – 8 ft. | 5 – 10 ft. |
| #45 | 42 in. – 8 ft. | 6 – 12 ft. |
| #65 | 4 – 10 ft. | 7 – 16 ft. |
| #100 | 5 – 12 ft. | 8 – 20 ft. |

⚠️ `[PUBLISHED]` **Two modifiers that change the rung:** *"Sheared nursery stock should reference one
size larger than shown in the table"*; and for fast growers, *"Specifiers may designate a container
class that is one container class smaller than shown in this table for the maximum plant size
shown"* — the standard's own example being Leyland cypress.

### LAWNS's three named species

| Species | ANSI section | Ladder |
|---|---|---|
| **Crape myrtle** (*Lagerstroemia*) | Trees §1 (Types 3/4 small trees) **or** Shrubs §2, depending on form | 🔴 **Genuinely ambiguous — and it is a real decision, not a lookup.** Crape myrtle is grown both as a multi-stem shrub-form and as a single-stem tree-form, and Table 8 has a dedicated *"Shrub form and multi-stem trees"* column measured in **height**, while tree-form uses **caliper**. **The same species takes a different measurement basis depending on how it was trained.** |
| **Juniper** (*Juniperus*) | Coniferous evergreens §3 | Table 21. Spreading cultivars measured by **spread**, upright by **height** — ANSI's own Type-2 spreading example is *Juniperus horizontalis* 'Wiltonii' and its semi-spreading example is *J. chinensis* 'Pfitzerana'. |
| **Cherry laurel** (*Prunus laurocerasus*) | Broadleaf evergreens §4 | Table 27 — identical values to Table 21. ANSI's own medium-grower sizing example is *Prunus laurocerasus* 'Zabeliana'. |

### Perennials — a different ladder that stops at #2

`[PUBLISHED]` **Z60.1-2004 §12** covers herbaceous perennials, ornamental grasses, groundcovers and
vines. **It is not the tree ladder rescaled — it is a different grading basis entirely:** certain
perennials are graded by **eye divisions, fans or rhizomes**, *"due to certain rhizomatous, tuberous
or other growth habits."*

| Plant | Grade | Container |
|---|---|---|
| **Astilbe** / **Dicentra** | 1–2 eye division | #SP4 |
| | 2–3 eye | #SP5 |
| | 3–5 eye | #1 |
| | 5 eye and larger | #2 |
| **Hemerocallis** (daylily) | 1-fan division, blooming size | #SP4 |
| | 1–2 fan, heavy root system | #SP5 |
| **Hosta** | 1 eye, light grade | #SP4 |
| | 1 eye, heavy (well rooted) | #SP5 |
| | 1–2 eye, heavy | #1 |
| **Iris** (Japanese/Siberian) | 1–2 fan (≥1 blooming size) | #SP4 |
| | 2–3 fan heavy blooming | #1 |
| **Bearded iris** | small non-blooming rhizome | #SP4 |
| | large blooming rhizome | #SP5 |

🔴 **The whole perennial ladder is four rungs — #SP4, #SP5, #1, #2 — and the rung is determined by
a COUNT OF GROWING POINTS, not by a size.** A ladder model that assumes every rung is a
height/caliper threshold cannot express this.

⚠️ `[PUBLISHED]` **And §12 is the one place the standard relaxes its own rule:** most specifications
must carry both plant size and container class, but *"specifications for other container grown
plants in this section may include only container size."*

### 🔴 Vegetables — not in ANSI at all

🔴 `[ABSENT]` **The word "vegetable" appears exactly ONCE in each edition, and in both cases it is
part of a USDA organisational name in a citation** — *"Vegetable Programs, Agricultural Marketing
Service, U.S. Department of Agriculture."* **There is no vegetable content in the American Standard
for Nursery Stock.** Vegetable transplants are not nursery stock; they are a greenhouse crop with
their own literature.

`[PUBLISHED]` **UGA Extension B1144, *Commercial Production of Vegetable Transplants*, Table 6 —
estimated production time:**

| Crop | Weeks from seeding |
|---|---|
| Broccoli, cabbage, collards, eggplant, pepper, tomato | **5–7** |
| Cucumber, squash | **2–4** |
| Cantaloupe, watermelon | **3–5** |

`[PUBLISHED]` **Cell size by crop** (same source): *"Trays with 1 to 1½-inch cells are well suited"*
for cabbage, broccoli, cauliflower, collard, kale and lettuce; *"Use larger cell sizes, 1½ to 2½
inches, for production of tomato, pepper, watermelon, muskmelon, cucumber and squash transplants."*
Trays run **12 to 338 cells**; a 1½-inch cell tray is **128 cells**, a 2½-inch is **72**.

⚠️ `[PUBLISHED]` Other extension sources give **longer** figures than UGA's — Utah State: *"allow 6
to 8 weeks"* for tomato, *"pepper and eggplant need 8 to 10 weeks."* **Both are extension, and they
disagree by weeks.** The variable named in the sources is greenhouse temperature. A default should
carry the range, not one endpoint.

---

## ⑥ The bottom rungs — seed, seedling, slip, cutting, plug, liner

🔴 **This is the section where the published record is WEAKEST, and the reason is worth stating: the
bottom rungs are wholesale production vocabulary, and the standard is a RETAIL/TRADE TRANSACTION
standard.** The rungs before a plant is sellable are largely outside its scope by design.

### What the standard actually defines

⚠️ `[PUBLISHED]` **The glossary is Annex C, and Annex C is explicitly NOT part of the standard:**
*"The information contained in this Annex is not part of this American National Standard (ANS) and
has not been processed in accordance with ANSI's requirements for an ANS."* So even where a
definition exists, it is **non-normative**.

| Term | Defined in ANSI? | Definition / status |
|---|---|---|
| **PLUG** | ✅ Annex C (non-normative) | *"A cylinder of medium in which a plant is grown. The term is generally used to describe seedlings and rooted cuttings which have been removed from the container but with the medium held intact by the roots."* 🔴 **Note: a plug is defined by being OUT of its container.** |
| **WHIP** | ✅ Annex C (non-normative) | *"A young tree without branches. In some species and grades, the initial eruption of branches, called 'spurs,' may be present."* |
| **SEEDLING** | 🔴 **NOT defined** — not in the glossary at all | Used throughout as a propagation **type code** (`S`) and as the subject of §10, but never defined |
| **LINER** | 🔴 **NOT defined** | Used (*"For liner grades see Section 7"*, *"Liner grade typically has a single fan or stem"*) but never defined |
| **CUTTING** | 🔴 **NOT defined** | A type code (`C`, `U` unrooted) only |
| **SLIP** | 🔴 **ZERO OCCURRENCES in either edition** | LAWNS's word. Not industry-standard vocabulary. |

### The working definitions come from extension, and one of them is structurally important

`[PUBLISHED]` **Arkansas Extension FSA-6056, *Starting a Wholesale Nursery* Part II** — the clearest
published statement of the production vocabulary:

- **Direct stick** — *"a term used when an unrooted cutting is placed directly in a container
  skipping the rooting stage in propagation."*
- **Bump-up** — *"the term used when plants are moved from a smaller to a larger container size."*
- **Liner** — *"rooted plants used in production that can vary in size from 2" pots up to larger
  sized containers (e.g. #5) and are serving as the source for the next stage in production."*

🔴 **AND THERE IS THE FINDING THAT MATTERS MOST TO THE DATA MODEL, in the source's own example:**

> *"you may be growing #5 junipers for sale (finished stock), or those same plants may be used as a
> 'bump-up liner' for a #7 finished crop."*

**"Liner" is not a rung. It is a ROLE a plant occupies relative to an intended next step.** The same
physical #5 juniper is *finished stock* or *a liner* depending on what the grower means to do with
it — and nothing about the plant or the pot distinguishes them.

> **Platform note — the load-bearing one for the ladder model.** If `liner` is modelled as a **value
> of the rung enum**, the model is wrong, and it will be wrong in a way that shows up as a plant
> that is somehow in two rungs at once. Rung is a property of the **plant**; liner-ness is a
> property of the **intent**. This is the same shape as tech-debt **#252** (`price_type` and
> `price_unit` as two representations of one fact) — two things that look like one field and are
> not.

### The bottom rung has real published dimensions — in forestry

`[PUBLISHED]` **Minnesota DNR, *Seedling Stock Types*** — container ("styroblock") specifications
with finished seedling size, which is the only published table found that puts **numbers** on the
pre-sellable rungs:

| Container | Block model | Cavity volume (in³) | Finished height (in) | Min caliper (in) |
|---|---|---|---|---|
| Styroblock 448/17 | 207a | **1.1** | 2.5 – 5.0 | 1/16 |
| Jiffy J25 | 25/65 | 2.4 | 4.0 – 8.0 | 3/32 |
| Styroblock 209/40 | 310A | 2.4 | 4.0 – 8.0 | 3/32 |
| Styroblock 240/40 | 211A | 2.4 | 4.0 – 8.0 | 3/32 |
| Styroblock 198/50 | 312A | 2.9 | 4.0 – 8.0 | 3/32 |
| Styroblock 160/60 | 310B | 3.3 | 4.0 – 8.0 | 7/64 |
| Styroblock 160/65 | 313B | 4.0 | 4.0 – 8.0 | 7/64 |
| Styroblock 144/82 | 411 | 4.9 | 6.0 – 10.0 | 1/8 |
| Styroblock 112/80 | 410A | 4.9 | 6.0 – 10.0 | 1/8 |
| Styroblock 144/95 | 313D | 5.8 | 4.0 – 8.0 | 7/64 |

🔴 `[DERIVED]` **All ten of these are `#SP1` under Z60.2-2025 (0.1–9 in³), and ALL TEN WERE
UNCLASSIFIED UNDER Z60.1-2004.** Checked: 2004's smallest class, #SP1, ran 6.5–8.0 in³, and every
cavity in the table — 1.1 through 5.8 in³ — falls **below its floor**, while 2004's next class up
started at 13. **The entire forestry container range had no ANSI class until the 2025 rewrite.**
This is the concrete payoff of that rewrite, and the reason the platform should ship the 2025
vocabulary rather than the edition most people have bookmarked.

`[PUBLISHED]` **ANSI's plug-tray specification** (§6.6.1, 2004) is by **cell count and cell
dimensions**, not volume: *"A plug tray is a continuous sheet with plug cells that are
non-detachable. Specifications should include the number of plug cells per tray and cell size."*
Its examples: `72 – 1-9/10" x 2-3/16" cells`, `200 – 1" x 1-1/2" cells`, `648 – 7/16" x 1/2" cells`.

`[PUBLISHED]` **Micropropagation has its own named stages** (§6.1.4): **Stage II** *"an unrooted
shoot tip, often called a 'microcutting'"*; **Stage III** *"a rooted shoot tip with two or more
roots, often called a 'rooted plantlet.'"*

`[PUBLISHED]` **Seedling grading — Tables 38/39/40, Z60.1-2004 §10.** The pre-container rungs are
graded on **caliper, height and ROOT LENGTH** — a dimension that disappears from every later rung:

| Caliper | Min. height | Min. root length |
|---|---|---|
| 1/16 in. | 3 in. | 4 in. |
| 3/32 in. | 3 in. | 5 in. |
| 1/8 in. | 6 in. | 6 in. |
| 3/16 in. | 12 in. | 8 in. |
| ¼ in. | 18 in. | 10 in. |
| 3/8 in. | 24 in. | 12 in. |

⚠️ For coniferous evergreen seedlings **height governs** (Table 40): 6 in. → 1/16 in. caliper;
9 in. → 1/8 in.; 12 in. → 3/16 in.

---

## ⑦ 🔴 WHAT COULD NOT BE FOUND — reported explicitly, because a gap is a finding

| # | What was sought | Status | What this means |
|---|---|---|---|
| 1 | **A per-rung survival/graduation rate table** | 🔴 **DOES NOT EXIST in the published record** | The central question of the prompt. Only SCSB #402's 4%/2% (live oak, two steps, *assumed* not measured) comes close. **This is the number only Terry can supply.** |
| 2 | **Where shrinkage occurs in the cycle** | 🔴 **ABSENT** — UGA states rates but not their location; UF applies one flat rate to a whole crop | Aggregate shrinkage cannot be decomposed into rungs. Any per-rung default would be invented. |
| 3 | **Rooting percentages for crape myrtle, juniper, cherry laurel** | 🔴 **ABSENT** from the extension bulletins read | UGA C944 gives *"three to four weeks"* to root and no percentage. |
| 4 | **ANSI Z60.1-2014** | ⚠️ **NOT READ** — AmericanHort's CDN returns **HTTP 403** | The 2004→2025 comparison in §① therefore spans 21 years with the intermediate edition unexamined. **A change could have been introduced in 2014 and reverted, and this recon would not see it.** The #1–#95/100 values are identical at both ends, so this is low-risk — but it is unverified, not verified. |
| 5 | **Container DIAMETER per class** | 🔴 **ABSENT — ANSI publishes VOLUME only** | Blocks computing a planting-hole width for a **container** rung (§②). Would have to come from manufacturer specs, which the standard itself defers to: *"Standard users should refer to container manufacturers' volume specifications."* |
| 6 | **A months-in-rung table by species group** | 🔴 **DOES NOT EXIST** for ornamental nursery stock | §④'s durations are scattered single data points from six different sources, not a table. Vegetables are the exception and have one. |
| 7 | **Canopy/spread per container class for shade trees** | 🔴 **ABSENT** | Spread is a measurement *basis* for shrubs/evergreens, not an attribute of a tree rung. |
| 8 | **A value for the "nursery factor"** | 🔴 **ABSENT by design** | It sits in a published USDA formula with no published value, because it is nursery-specific. **The literature itself says this number belongs to the grower.** |
| 9 | **Whether `#30` / `#200` were ever classes** | ✅ **Answered NO** — zero occurrences in both editions | Not a gap; a confirmed absence. |

⚠️ **One methodological limit, stated rather than glossed:** this recon read the **2004 and 2025
editions in full text** and the primary extension sources directly. Three items — the crape myrtle
training sequence, the 32-cell-to-gallon timing, and the stock-type codes before they were verified
against the Minnesota DNR source — originated in **search-result summaries**. The stock-type codes
were then **verified against the primary document**; the other two are marked in §④ and remain
second-hand.

---

## ⑧ What this means for the platform — and what only Terry can supply

**The ladder the platform should ship as a day-one default:**

| Rung | Class | Basis | Confidence |
|---|---|---|---|
| plug / seedling | **#SP1** | caliper + height + **root length** | `[PUBLISHED]`, forestry |
| liner | **#SP4 / #SP5** | height or spread | `[PUBLISHED]` |
| #1 → #2 → #3 → #5 → #7 → #10 → #15 → #20 → #25 → #45 → #65 → #95/100 | as named | height/caliper per §② and §⑤, **by plant type** | `[PUBLISHED]`, ANSI |

with **per-plant-type rung sets** (trees, shrubs, coniferous evergreens, broadleaf evergreens,
perennials), because the standard does not use one ladder for all of them.

**Five things the literature forces the data model to handle, each with a live analogue in our own
corpus:**

1. **A rung may have no ANSI class.** LAWNS has two. `class` is nullable and `unclassified` is an
   honest state, not a blank (D-9 / A9 — *absent is not empty*).
2. **A gallon number is not a specification.** Store the class; carry `true_to_size` as the flag the
   2025 standard defines. Storing only gallons stores something ANSI explicitly rejects.
3. **"Liner" is a role, not a rung** (§⑥). Modelling it as a rung value repeats tech-debt **#252**'s
   shape — two representations of one fact, which the editor then lets disagree.
4. **A graduation has THREE outcomes, not two** — promoted, **held back**, culled — and two of the
   four published cull reasons are *size failures on a living plant*, not deaths. A single `lost`
   event cannot express that, and cost-per-surviving-plant is wrong under either mis-mapping.
   ⚠️ **`plant_events['lost']` is the successor shape named in CLAUDE.md §2 for the retired `losses`
   table; it should be checked against this before any survival figure is stored.**
5. **`C1T2` already exists.** ANSI's propagation/cultural history code is a compact, industry-read
   serialisation of the full ladder history with durations, and **age is derived from it rather than
   stored** (§④). Before designing a bespoke history format, read §6.1.1.1.

### 🔴 The numbers only Terry can supply

Every one of these was searched for and is `[ABSENT]` from the published record:

1. **Survival at each graduation** — seed→seedling, seedling→slip, slip→4", 4"→3/5 gal, and every
   step up to 200. **This is the number that decides cost per surviving plant, and it does not
   exist in print.** The literature gives a 40–90% range on the bottom rung alone.
2. **Where in the cycle his losses actually fall** — no published source decomposes shrinkage.
3. **His time in each rung for HIS species in HIS climate** — Leander, TX, not Tennessee live oak
   and not Minnesota red pine.
4. **His rooting percentages** for crape myrtle, juniper and cherry laurel.
5. **What his `30` and `200` containers actually hold in cubic inches** — because neither has a
   class, only a measurement can place them.
6. **His held-back rate** — the three-way outcome in §③ that no published source quantifies at all.

**The first real up-pot run replaces items 1, 2, 3 and 6 with measurements. Items 4 and 5 are a
conversation and a tape measure.** Until then every figure in this document is what it says on the
tin: **published, and therefore somebody else's.**

---

## Sources

**Standards (read in full text)**
- [ANSI Z60.2-2025, *American Standard for Nursery Stock*](https://americanhort.org/wp-content/uploads/2026/02/nursery-stock-standards.pdf) — AmericanHort, approved 17 April 2025. 116 pp. **The current standard.**
- [ANSI Z60.1-2004, *American Standard for Nursery Stock*](https://www.in.gov/dnr/forestry/files/fo-ANSI_Z60_1_04.pdf) — hosted by Indiana DNR Forestry. 129 pp.
- [American Standard for Nursery Stock — FAQ](https://americanhort.org/wp-content/uploads/2026/02/nurery_stock_faqs-stock-standards.pdf) — AmericanHort.
- ⚠️ [ANSI Z60.1-2014](https://cdn.ymaws.com/americanhort.site-ym.com/resource/collection/38ED7535-9C88-45E5-AF44-01C26838AD0C/ANSI_Nursery_Stock_Standards_AmericanHort_2014.pdf) — **HTTP 403, NOT READ.** See §⑦ item 4.

**USDA / Forest Service**
- [*Woody Plant Seed Manual*, Agriculture Handbook 727, Ch. 7 "Nursery Practices"](https://www.fs.usda.gov/nsl/Wpsm%202008/Chapter%207.pdf) — USDA Forest Service.
- [Mexal, J.G. & South, D.B., "Bareroot Seedling Culture," *Forest Regeneration Manual* Ch. 6](https://rngr.net/publications/forest-regeneration-manual/chapter-6-bareroot-seedling-culture/at_download/file) — RNGR.
- [*Forest Nursery Manual — Bareroot*](https://rngr.net/Publications/fnm) · [Nursery Manuals index](https://rngr.net/publications/nursery-manuals) — RNGR.

**Land-grant extension**
- [Hall, Haydu & Tilt, *The Economics of Producing Nursery Crops Using the Pot-in-Pot Production System*, Southern Cooperative Series Bulletin #402](https://plantsciences.tennessee.edu/wp-content/uploads/sites/25/2021/11/The-economics-of-producing-nursery-crops-using-the-pot-in-pot-production-systems-Southern-Cooperative-Bulletin-Series-402.pdf) — Univ. of Tennessee / Univ. of Florida / Auburn, Nov 2002. **The only per-step loss rates found.**
- [Texas A&M AgriLife, Earth-Kind Landscaping — "Planting a Tree"](https://aggie-horticulture.tamu.edu/earthkind/landscape/planting-a-tree/)
- [Texas A&M Forest Service — Community Forestry Grants, Appendix A: Standards and Specifications](https://tfsweb.tamu.edu/wp-content/uploads/2025/01/2024CommunityForestryGrantsAppendixA.pdf)
- [Texas A&M AgriLife — Texas Tree Planting Guide](https://agrilifeextension.tamu.edu/asset-local/texas-tree-planting-guide/)
- [Univ. of Arkansas Extension FSA-6056, *Starting a Wholesale Nursery* Part II](https://www.uaex.uada.edu/publications/pdf/FSA-6056.pdf)
- [UGA Extension B1144, *Commercial Production of Vegetable Transplants*](https://fieldreport.caes.uga.edu/publications/B1144/)
- [UGA Extension C944, *Crape Myrtle Culture*](https://fieldreport.caes.uga.edu/publications/C944/crape-myrtle-culture/)
- [UGA — "Shrinkage can sneak profits out of green industry greenhouses"](https://fieldreport.caes.uga.edu/news/shrinkage-can-sneak-profits-out-of-green-industry-greenhouses/)
- [UF/IFAS FE1119, *Production Costs and Profitability for Selected Greenhouse-Grown Perennial Plants*](https://ask.ifas.ufl.edu/publication/FE1119)
- [Utah State Univ. Extension — Transplant Production](https://extension.usu.edu/vegetableguide/tomato-pepper-eggplant/transplant-production)
- [Tennessee State Univ. — *Conventional Container Production*](https://www.tnstate.edu/faculty/ablalock/documents/Container_Production_Handout_rev_%208-10.pdf)

**State agency**
- [Minnesota DNR, *Seedling Stock Types*](https://files.dnr.state.mn.us/forestry/ecssilviculture/siteprep/seedlingstocktypes.pdf) — stock-type notation and styroblock specifications.

**Trade press — lower confidence, marked as such where used**
- [Greenhouse Grower — production scheduling](https://www.greenhousegrower.com/crops/varieties/problem-free-production-scheduling-for-panicum/)
- [Nursery Management — "Liner size makes a difference"](https://www.nurserymag.com/news/liner-size-makes-a-difference/)
