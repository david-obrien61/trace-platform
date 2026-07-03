# Spec — Ingredient Form, Conversion & Substitution Layer

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**For:** Andrew + Thunder. **Status:** Proposed; interactive example built (mocked) in
the Kitchen Loop tile (Recipes tab → "Ingredient form").
**Origin:** "How do you incorporate food into a recipe — cumin seed vs. powder?"

---

## 1. The problem in one line

A recipe says "1 tsp ground cumin." The shelf has a jar of cumin **seed** and a
handwritten jar labeled just "Cumin." Three questions follow, and they're distinct:

1. **Identity** — are seed and ground the same item? (For inventory: **no**, separate jars.)
2. **Measurement** — "1 tsp" vs. a jar that's "~⅕ full." How much does cooking deplete?
3. **Substitution** — can seed stand in for ground, and *when* is that a good idea?

## 2. Decisions

### 2a. Form is part of identity (strict on inventory)
Ground / seed / whole are **separate inventory items**, never silently merged. A recipe
line for *ground* cumin depletes the *ground* jar, not the seed jar. Merging them would
make stock lie (you saw both forms on your own shelf). Each item carries:
`{ ingredient: "cumin", form: "ground" | "seed" | "whole" }`.

### 2b. Conversion is DERIVED, from a density table
To move the fill bar correctly, bridge volume→weight per ingredient+form:
`1 tsp ground cumin ≈ 2.1 g`; a jar ≈ 45 g → one recipe line draws ~4.7% of the jar.
This per-ingredient gram weight is **database knowledge** (USDA FoodData Central carries
gram weights; commercial nutrition APIs too). Stamp it **DERIVED** — good, not gospel;
"a jar" isn't a standardized size, densities vary. The user can correct → CONFIRMED.

### 2c. Substitution is conditional on COOK STYLE (the real insight)
Form carries a **use-signal**, not just identity:
- **Seed** = long-cook / toast-and-bloom — you have time; fresher, more aromatic.
- **Ground** = instant flavor — quick dishes; no grinding mid-cook.

So substitution is offered *only when the dish fits*:

| Shelf | Want | Grinder | Cook style | Result |
|-------|------|---------|------------|--------|
| seed | ground | yes | long braise | **Grind it** — fine, even better (DERIVED, ~1.25× seed by volume) |
| seed | ground | yes | quick dish | **Buy ground** — grinding mid-cook is friction; keep powder for instant flavor |
| seed | ground | no | any | **Buy ground** — seed won't dissolve in time |
| ground | seed | — | any | **Use ground, caveat** — works for flavor, loses the toasted pop |
| none | ground | — | any | **Buy** — add to list |

This is what makes the feature smarter than a flat conversion ratio: it respects how the
ingredient is actually used in *this* dish.

## 3. Where the food DB fits (narrower than "look up food")

The DB is NOT for identifying jars — barcode/photo doors do that. The DB is the
**ontology + conversion layer between a recipe line and inventory**:
- knows ground cumin ≠ seed as items, but *related*, with a grind ratio;
- parses a messy line ("1 tsp cumin, ground") → `{ingredient, form, qty, unit}`;
- supplies the gram density so depletion is real.

### Confirmed backends (from Andrew; swappable via `platform_config`, D-009 lineage)
- **Spoonacular** — the recipe spine. Provides recipe-line **parsing** ("1 tsp ground
  cumin" → `{ingredient, form, qty, unit}`), the **ingredient ontology** (knows ground
  vs. seed are kin, supplies conversions — the form layer this spec is about), and
  "what's in your fridge" recipe discovery. This is the confirmed source for the
  parse + form/conversion work (resolves the prior "MyKitchen API, TBD" slot).
- **TheMealDB** — free, open recipe content (international cuisines, stable JSON). A
  cheap **seed/fallback** for recipe *content* only; it has NO parsing, NO ontology,
  NO conversions. Not a substitute for Spoonacular on the form question.
- **Open Food Facts** — free, barcode → ingredients/additives (feeds the health card).
- **USDA FoodData Central** — free, official gram weights + nutrition.

### Routing — choose the source by the QUESTION, not by favorite
- **"I have these ingredients — what can I make?"** (discovery from stock)
  → **Spoonacular** fridge-search primary; **TheMealDB** fallback to conserve quota.
- **"I'm making X and I have cumin — what do I do?"** (form / conversion / sub)
  → **Spoonacular ontology only** (or our own seeded table). MealDB can't answer this;
  no fallback.

### Cost / coupling caution (hold the platform discipline)
Spoonacular is **metered** (daily points quota) and its terms **forbid long-term
caching** of recipe data — call it live, don't copy its DB. So:
- Treat it as a **connector tile**, swappable; TheMealDB fallback = graceful degrade if
  Spoonacular gets expensive or changes terms. Never weld it in.
- The **form/conversion knowledge is small and stable** (1.25 tsp seed ≈ 1 tsp ground
  doesn't change). Pull it once and bake it into our **own conversion table** (AC-4,
  settle-once-encode-as-variable). That is NOT caching their recipe data — it's encoding
  a settled fact we learned. This keeps the everyday form lookups OFF the metered API.

**Remaining question for Andrew:** Spoonacular free-tier daily point budget, and whether
his course access is a personal key or something reusable for the build.

## 4. Confidence flows through (unchanged discipline)
- You made it / you set it → **CONFIRMED**.
- Spoonacular-parsed line, conversion, or substitution ratio → **DERIVED**.
- No data → **UNKNOWN**.
A recipe's depletion is only as honest as its weakest conversion; show the stamp.

## 5. Not now
- Don't auto-substitute silently — always surface the suggestion + reason; user decides.
- Don't merge forms to "simplify." Strict on identity, smart on suggestion.
- Conversion table starts small (the spices you actually use); settle once, encode as
  a variable (AC-4), expand from real use.
