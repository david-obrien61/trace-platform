# CONCEPT / DECISION — Cost-to-Produce Primary Lens is BY PROJECT
**Captured:** 2026-06-16
**Status:** DECISION captured + NAMED GAP defined + verify-first DONE. Build NOT started.
**Committed by Thunder:** `docs/DECISIONS.md` (D-10, ARCHITECTURE-DECISION, [CAPTURED]) +
`docs/built-inventory.md` (named gap). This doc is the standalone narrative companion for David.
**Origin:** David, on first seeing the live `/costs` tile (owner-proof), said it wasn't how he
envisioned seeing cost-to-produce.

---

## The gap, in David's words

> "I had envisioned seeing company (TRACE) → project (CoolRunnings) → all cost associated to that
> project. Then next project (BuiltWithCAI) → all cost associated to that project (domains, Gemini,
> Anthropic etc) — with an ability to enter an item and choose which project it was associated to."

What the live tile shows instead: **one flat business-level cost pool** (every cost thrown into a
single TRACE-wide bucket, divided by N customers). Correct as a *company-total* view, but it is not
the lens David thinks in. He thinks in **projects.**

---

## The decision

**Cost-to-Produce primary lens is BY PROJECT, not a flat business pool.**
- Company (TRACE) → Project (CoolRunnings / BuiltWithCAI / each vertical) → all costs associated to
  that project.
- Cost entry can ASSIGN an item to a project (pick its parent).
- The flat ÷N pool **stays** as the company-total top-line. The project cut is **added, not
  substituted.** Both are valid views: "what does the whole company cost to run" (flat, exists) and
  "what does each project cost" (by-project, the new lens).

---

## Why this is SURFACING, not new architecture (the good news)

The bones already exist — they were built in Core-1 and Core-2b *for exactly this* and are simply
not wired to the entry side or the view:

- **`cost_objects.node_type` already includes `PROJECT`** (alongside ASSET, PRODUCT) — Core-1 / D-1.
- **`parent_id` self-FK already exists** (Core-1 / D-1) — a PROJECT node with cost children pointing
  at it via `parent_id` IS "a project with all its costs."
- **`CostRollup.ts` already traverses both edge tables** for per-node rollup — "CoolRunnings + all
  costs under it" already *computes*. It is the per-node surface, just not surfaced as a grouped view.
- **Core-2b deliberately kept business-level FLAT** (count-once feed) because rollup-sum
  double-counts parent+child at the business level. So: the flat feed = the company-total view
  (keep it); the rollup = the per-project view (surface it). This adds the project cut and leaves
  the OWNER-PROVEN honesty engine (D-9) untouched.

---

## Verify-first finding (Thunder, read-only — CONFIRMED FLAT)

David's Image-3 read was correct. Current state of the entry + read sides:
- The only `cost_objects` insert path is the asset form (`BusinessAssets.tsx:173-194`). It hardcodes
  `node_type:'ASSET'` and **never writes `parent_id`** → every UI row is a flat, parentless ASSET node.
- **No UI creates `PROJECT` nodes or sets `parent_id` anywhere.**
- `CostToProduce.tsx:96` reads `node_type` but selects no `parent_id` and does no grouping.

So the PROJECT node_type and parent_id self-FK exist in schema (Core-1) but are **entirely
unpopulated by the entry side.** The build is exactly: entry-side `parent_id`/PROJECT write + the
grouped read surface. The rollup engine that powers "CoolRunnings + all under it" already exists.

---

## NAMED GAP — project-grouped cost view + parent-picker on cost entry (UNBUILT)

Three-piece scope:
- **(a)** Cost entry lets you pick the PROJECT (`parent_id`) an item belongs to; a way to create
  PROJECT nodes (CoolRunnings, BuiltWithCAI, each vertical).
- **(b)** `/costs` gains a by-project grouping reading through the **existing** rollup
  (per-PROJECT-node), with the flat company total retained as the top-line.
- **(c)** The **DAG-diamond double-count seam gap** (already flagged in `CostRollup.ts`) must be
  honored when grouping — a node reachable by two paths must not be counted twice.

Distinct from the honesty engine, which is **OWNER-PROVEN correct as-is** (capex excluded from the
÷N pool, unknowns surfaced never zeroed, duplicate flagged + counted once — all confirmed live on
real seeded data, 2026-06-16).

---

## RELATED FINDING — the entry/management UI does not scale (David, 2026-06-16)

Looking at the live settings entry UI (`/settings`, Image 3), David flagged: each cost is a large
stacked card (name row → amount → full-width cadence dropdown → full-width confidence dropdown → X).
One line item eats ~⅓ of the screen. **At 50 line items this is unusable** — endless scrolling through
fat cards, no density, no scanning, no sort, no filter, no grouping. It is a form built for "a handful
of costs," not for managing the real cost structure of a multi-project business.

**This is the same problem as the project-lens, from the entry angle.** Part of why 50 flat items is
unmanageable is that they are one flat undifferentiated list. Grouping costs under PROJECT nodes (the
lens) is *also* the organizing structure that makes many items navigable — you see 3-4 projects and
expand the one you want, never a 50-row wall. So the lens is not only a reporting view; it is the
entry/management structure that solves density.

Two distinct improvements (related, both needed):
1. **Information architecture** — group entry by PROJECT (the lens above), so you are never in a flat
   50-item list.
2. **Row density + interaction** — compact one-line rows (not stacked cards), inline edit, search/
   filter, sort (by amount / confidence / cadence), consider bulk actions. Needed even *within* a
   project for a long list.

This rides along with the project-lens build (same surface, same fix) but is separately
articulable: **the cost entry/management UI must scale to many line items.** Tag the density work as
part of the lens build scope, not a separate afterthought.

## Sequencing

- This is **surfacing existing bones**, the cheapest end of the scope — not architecture.
- Verify-first is **banked** (done above), so a build session can go straight to the work.
- Build order when ready: create-PROJECT-node + parent-picker on entry → wire the grouped read
  through `CostRollup.ts` → honor the DAG-diamond caveat → owner-prove the by-project view.
- Not started at capture time (end of a ~1hr sprint that already earned the honesty-engine
  owner-proof; this is a clean fresh-session task done rested, not a tired late reach).
