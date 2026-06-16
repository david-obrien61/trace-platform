# DECISION — Unified Cost Model (Option 2): recurring costs become first-class cost_objects
**Captured:** 2026-06-16
**Status:** DECISION LOCKED (David chose Option 2). Build NOT started — scoped here for a fresh
session. Extends D-10 (project lens) and D-8 (cost shapes RECURRING-FIXED vs PER-OCCASION).

> **SUPERSEDED FRAMING — read alongside:** [`DECISION-small-business-cost-accounting-model.md`](DECISION-small-business-cost-accounting-model.md)
> reshapes this decision. Option 2's unification is still correct, but the model gains a cost-NATURE
> dimension (CapEx / COGS / OpEx → payback & margin views). That doc is the spec the unified-cost-model
> build executes against; this file remains the record of why Option 2 over Option 1.

---

## The decision

Recurring / non-capex costs become **first-class `cost_objects` rows**, not a separate
`business_modules.config` representation. This unifies all costs into one model so they ALL get:
- `parent_id` → projectable in the lens for free (closes the recurring-not-projectable gap),
- a **cost-shape** dimension → a clean home for prepaid-amortize, variable, and recurring-fixed,
- `cost_confidence` + `substantiation` (the D-5 axes) like every other cost.

**Why Option 2 over Option 1 (bolt a project field onto config lines):** Option 1 is cheaper but
leaves nowhere clean to model prepaid-multi-year or variable costs — David would hit the wall again.
Option 2 is "one cost engine, settle once, encode as variable" (D-10 spirit). More work now, no redo
later. David: "the more robust and true solution."

---

## Cost shapes the unified model MUST hold (the real requirement)

Surfaced from David's actual costs. The model needs a cost-shape field that covers:

| Shape | Example (David's real costs) | How it behaves | Status today |
|---|---|---|---|
| One-time / capex | Hardware (NSPanel, ProDesk, tractor) | spent once; EXCLUDED from /mo pool, shown as captured capital | ✅ modeled (cost_objects ASSET) |
| Recurring fixed | Claude Pro $100/mo; Supabase/Vercel when paid | flat $X every month | ✅ modeled (config) — MIGRATE to cost_objects |
| Prepaid multi-year | Domains: ~$200 covers 3 yrs | paid once, covers N months → amortize (~$5.55/mo over 36) OR treat as capex | ❌ NOT cleanly modeled — NEW shape |
| Prepaid consumable / credit | Gemini API: $20 prepaid credit, burns down with usage | paid once ($20 CONFIRMED, spent/gone — behaves like capex); covers a fixed AMOUNT of usage (not time); burn rate UNKNOWN until release (no basis = no estimate) | ❌ NOT cleanly modeled — NEW shape |
| Incremental prepaid (auto-refill) | Gemini API (clarified): $20 increments, rebuy as consumed | buy fixed $20 chunk → consume → rebuy; monthly = (increments/mo) × $20; $20 CONFIRMED+SUBSTANTIATED (receipt) + run-rate ESTIMATED; revises in $20 steps as usage grows | ❌ NOT cleanly modeled — NEW shape (this is the accurate Gemini shape; supersedes the spent-once reading above) |
| Variable (usage) | Claude API, Gemini API; Resend, Twilio | scales with usage; best entered as ESTIMATED/DERIVED, not CONFIRMED-as-fixed | ❌ NOT cleanly modeled — NEW shape |
| Variable scaling with N | (future) API cost rising with customer count | rises as customers grow → changes per-customer math at scale | ❌ NOT modeled — FUTURE, design for but don't build |
| Absent categories | Rent, electric, utilities | real company-level recurring; NOT entered yet | ⚠️ engine honestly flags "real cost is higher" / incomplete |

**Honesty notes (D-9) that ride along:**
- API costs currently entered as CONFIRMED-fixed should be ESTIMATED/DERIVED (they're variable guesses).
- Rent/electric/utilities absent = real cost understated, but engine honestly says so. Entering them
  is data-entry, not a build — but the model must have a home for them (company-level recurring).
- Prepaid amortize must not silently fabricate a monthly number — show the basis (paid X over N months).

---

## AI costs — canonical fixed-vs-variable example (David's real costs, 2026-06-16)

The clearest illustration of why the cost-shape + confidence dimensions matter:

| Cost | Amount | Shape | Confidence | Level | Notes |
|---|---|---|---|---|---|
| Claude Pro (subscription) | $100/mo | recurring-fixed | CONFIRMED | company | known flat subscription |
| Gemini Advanced (subscription) | $20/mo | recurring-fixed | CONFIRMED | company | known flat subscription |
| Claude/Anthropic API | est. monthly | variable (scales with N) | ESTIMATED (if basis) / UNKNOWN (if none) | company | usage-based; enter ESTIMATED-monthly IF there's a basis (even rough current-usage), revise when real; honest only if NOT CONFIRMED |
| Gemini Pro API | $20 receipt; ~$20/mo run-rate | incremental-prepaid (buy fixed $20 chunks, consume, rebuy) | $20 CONFIRMED+SUBSTANTIATED (receipt); run-rate ESTIMATED | company | $20 minimum increment, receipt in hand; ~$20/mo = ~1 increment/mo (the BASIS); revises in $20 steps as usage grows ($40 = 2 increments, etc.) |

**Incremental-prepaid pattern (Gemini API, clarified 2026-06-16):** David has a RECEIPT for $20 (the
minimum purchasable increment), unused so far. As usage consumes it, he's billed another $20; monthly
cost = (increments consumed/mo) × $20. Two honest facts together: (1) $20 CONFIRMED+SUBSTANTIATED —
real, documented, spent (D-5 substantiation, like the NSPanel receipt); (2) ~$20/mo ESTIMATED
run-rate — basis = "one increment/month until usage proves otherwise," revises UP in $20 steps. The
increment size IS the estimate's basis (resolves the earlier "no basis" question — there is one now).
Honest current-UI entry: $20/mo ESTIMATED. This is a common real-world shape (prepaid credit that
auto-tops-up in fixed chunks) — distinct from prepaid-consumable-spent-once; it recurs by refill.

**ESTIMATED vs UNKNOWN — the test:** ESTIMATED = the number rests on SOMETHING (a bill, rough
current usage, a comparable, an increment size) and is marked soft (lands in "Estimated (soft)" line,
not the floor). UNKNOWN = no basis at all (surfaced, never $0, no number).

**SCALES-WITH-N caveat (why the estimate needs care at scale):** API usage GROWS with customer count
(variable-scaling-with-N shape). A flat monthly estimate is fine at today's dev/demo scale, but at
N=100 a flat figure divided across customers understates real per-customer API cost (which would have
grown with those customers). The model eventually needs "this cost scales with N" so the N=100 row
stays honest. DESIGN for it; don't build the scaling behavior yet.

**Honesty rule (D-9) for variable costs:** a variable cost gets UNKNOWN until there's a basis
(a bill, usage data, a comparable), then ESTIMATED/DERIVED — NEVER CONFIRMED-fixed-at-a-guessed-number.
The prior "Claude API usage $100 CONFIRMED" was fake precision (inflated known cost by a number not
actually known); corrected 2026-06-16. Subscriptions (Pro, Advanced) are CONFIRMED because the number
is genuinely known and flat.

**CURRENT-UI LIMITATION (found 2026-06-16, motivates the build):** the existing recurring Settings
form offers only confidence flags + a per-month/per-year cadence. It has **no "one-time / spent"
option and no cost-shape selector** — so the Gemini $20 prepaid-consumable CANNOT be entered honestly
today: any cadence picked (per-month/per-year) falsely implies it recurs. INTERIM CALL: do NOT force
it into a wrong shape — leave it out of the recurring list (or UNKNOWN) until Option 2 ships the
prepaid-consumable shape. A $20 carrying a fake monthly cadence harms the number's honesty more than a
temporarily-absent $20. This confirms WHY the build needs a cost-shape selector: the current UI forces
non-recurring costs into recurring shapes.

## Where each of David's costs lands (worked example)

- Claude Pro → company-level (parent_id null / Platform overhead), recurring-fixed $100/mo.
- Domains → company-level, prepaid-multi-year (amortize ~$5.55/mo over 36, OR capex — decide in build).
- Supabase / Vercel → company-level, recurring-fixed (currently $0 free-tier; flip when paid).
- Claude/Gemini API → could be company-level OR project-tagged; variable shape; ESTIMATED.
- Resend / Twilio → company-level, variable; currently UNKNOWN (honest) until a number is known.
- Rent / electric / utilities → company-level, recurring-fixed (rent) / variable (utilities) — to enter.
- Anything genuinely project-specific (e.g. a domain only for BuiltWithCAI) → tagged to that PROJECT.

---

## VERIFY-FIRST for Thunder (before any build — read-only, report)

1. Exact current schema of `business_modules.config` recurring lines: every field a recurring cost
   carries today (name, amount, cadence, confidence, etc.). This is what migrates.
2. Every read path that consumes config recurring lines — especially the flat /costs tile
   (CostToProduce.tsx) and the seam feed. The migration MUST keep the flat top-line
   ($12,239.67/mo) honest and unbroken during/after.
3. cost_objects current columns vs what the unified model needs (a cost-shape enum? amortize
   basis/term columns? a cadence column? is node_type='PRODUCT' the right home for recurring, or a
   new shape field independent of node_type?). Propose the minimal schema delta.
4. How the Settings entry UI writes config today (Image 2/3) — it must be re-pointed to write
   cost_objects, and gain the cost-shape selector + project picker.
Report all four, propose the schema delta + migration plan, BUILD NOTHING until David confirms.

---

## Sequencing & guardrails

- Decision locked; the BUILD is a fresh-session task (meaty migration — don't start tired).
- Honesty engine (D-9) and the flat top-line stay correct/unbroken throughout (it's the per-customer
  price basis). Trust-but-verify after the migration: flat total must match pre-migration.
- Migration of existing config lines must be lossless (every current recurring cost survives, same
  amount/confidence). Catalog-prove after.
- cost-shape "variable scaling with N" — DESIGN the field to allow it, do NOT build that behavior now.
- [TRACE:*] ON for new/changed paths until owner-proven. Two-bar completion.
- Closes alongside: the deferred cadence-edit (becomes real once cadence is a cost_objects column).
- Unrelated still-open: QBO /api/qbo/status 500 (tech-debt #34).
