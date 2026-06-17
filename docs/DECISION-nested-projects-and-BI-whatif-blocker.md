# DECISION — Nested Projects (build now) + BI-Claude What-If / Blocker (the insight wedge, deferred)
**Captured:** 2026-06-17
**Status:** TWO builds, deliberately separated. Nesting = near-term (real structures need it).
BI-what-if = the insight-layer wedge, deferred until the spine is rich enough to reason over.
Extends D-10 (project lens), the small-business cost-accounting model, the three-layer mission frame.

---

## BUILD 1 (near-term) — Nested projects + rename

### Rename
"Platform overhead" → "Overhead" (or "Company overhead"). "Platform" was a Cultivar-flavored word that
wrongly implies everything under the company is part of "the platform." Farm isn't; RealEstate won't
be. Company-level overhead = costs serving the whole business (parent_id null), regardless of project.

### Nesting (real structures, not hypothetical)
Projects can contain sub-projects. Confirmed live cases:
- **TRACE → Farm → {meat birds, meat rabbits, egg birds}** — Farm is the parent project; the three are
  sub-projects with their own costs/COGS/revenue.
- **LAWNS → greenhouse (infrastructure) → inventory** — greenhouse is a sub-structure; inventory (plants)
  sits under it.
- (future) **RealEstate → individual properties → costs** — same shape.

### Single-parent HOLDS and makes nesting SAFE
A resource is assigned to exactly ONE parent_id, never shared across projects (reaffirmed by David).
Nesting is fully compatible: each cost has one parent; that parent may itself be a sub-project. The
chain is strict single-parent at every level (meat-birds-feed → meat birds → Farm → company root) — a
clean tree, NO diamonds. This is what makes multi-level rollup safe: each cost counted ONCE at its
leaf, summed up through its single chain. No double-count BECAUSE sharing is forbidden.

### What nesting needs built
- Schema: ALREADY supports it — parent_id is a self-FK on cost_objects; a PROJECT node's parent_id can
  point at another PROJECT node. No migration.
- Rollup: must RECURSE up multiple levels (sum leaf costs up through each single-parent chain; a
  parent project's total = sum of its sub-projects' totals; count each cost once at its leaf, never
  re-add at each tier).
- UI: by-project tree renders nested groups (RealEstate ▸ Property A ▸ costs); expand/collapse per level.
- Picker: assign a cost to a sub-project; make a project a child of another project.

---

## BUILD 2 (deferred — the insight wedge) — BI-Claude What-If / Blocker analysis

### The concept (David's articulation — this is the "intelligence" in business intelligence)
NOT deterministic scenario-calculation (user enters inputs, engine computes payback). Rather:
**BI-Claude reasons over everything it knows about the business + the owner's assumptions, and judges
the proposed scenario "productive" OR names the BLOCKER** — the specific removable condition standing
between this and being worth it. When the blocker is removed/changed, RE-RUN the what-if under the new
assumption for a new model.

David's words: "given everything I (BI-Claude) know about what you have given me and your assumptions,
this is either productive or this is a blocker, and when this blocker is removed, rerun this what-if
scenario for a new model assumption."

### Why this is the wedge (and pure mission)
A small-business owner CANNOT self-diagnose this — they don't know what they don't know. They'd model
"greenhouse costs $20k, sells $30k of plants → good" and MISS the constraint that kills it (water
capacity, labor already maxed, market won't absorb inventory at their price). BI-Claude's job is to
**surface the blocker they'd have missed** — e.g. "productive on your numbers, BUT your labor is
already at 160 hrs/mo, so this greenhouse needs labor you don't have — THAT's the blocker; when you add
capacity or automate, re-run." That's "surface the hidden costs that creep up" applied to FUTURE
decisions. It's the CFO/consultant judgment a small business can't afford.

### The "green flag" (LAWNS greenhouse example)
Model a PROPOSED (not-yet-built) structure — its CapEx, the inventory it would hold, the revenue it
could produce — run it through the payback/margin engine + BI reasoning → signal: productive (green)
or blocked (with the named blocker). Flag flips GREEN when the blocker is removed.

### Why it MUST come after the spine matures (David's key insight — you can't scope it blind)
"If you don't know the proposed scope, you can't identify the shortfalls/risks." BI can only find
blockers in DIMENSIONS THE SPINE CAPTURES. If the spine doesn't model labor-capacity-as-a-constraint,
BI can't flag "you're out of labor." So the what-if's capability is BOUNDED by what the model knows →
the spine must be rich enough to reason over FIRST. This is why BI-what-if is sequenced AFTER the
spine (cost model + nesting + nature/shape + capacity/constraints) accumulates the dimensions BI
reasons over. Building the what-if now would mean building analysis against an under-specified spine.

### Architecture placement
Three-layer frame: raw data → cost model (spine) → insight layer. BI-what-if is the insight layer,
specifically: BI-Claude reasons over (spine + owner assumptions) → judgment + named blocker. Builds ON
nesting + the payback engine + (eventually) capacity/constraint modeling. Connects to the deferred
variable-scales-with-N shape (scenario revenue/cost at projected scale).

### Open design questions (for when it's built, NOT now)
- What dimensions must the spine capture for BI to find real blockers? (labor capacity, water/utility
  capacity, market absorption, cash runway…) — these may themselves be spine additions.
- What's the threshold/logic that flips green vs blocked?
- How are "assumptions" entered and versioned (re-run under new assumption = new model)?
- How does BI explain the blocker honestly (D-9) without fabricating constraints it can't actually see?

---

## Sequencing
1. NOW: rename (Platform→Overhead) + nesting (rollup recurse, UI nested, picker sub-project assign).
2. LATER (spine must mature first): BI-Claude what-if/blocker analysis — the insight wedge.
3. The spine accumulating richer dimensions (capacity, constraints) is the PREREQUISITE that makes
   BUILD 2 designable — and may itself be incremental spine work between the two.
