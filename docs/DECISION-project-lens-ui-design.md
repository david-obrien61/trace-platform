# DECISION — Project-Lens UI Design (Tree, Tenant-Root, Single-Parent, Overhead)
**Captured:** 2026-06-16
**Status:** DESIGN locked through conversation. Extends D-10 (Cost-to-Produce primary lens BY PROJECT).
Build NOT started — this is the design Thunder mocks up against before writing code.
**Companion:** `THUNDER-PROMPT-project-lens-build.md` (the build prompt carrying this design).

---

## What this settles

D-10 decided the cost lens is BY PROJECT. This doc settles the **UI/interaction design and the
data model** for how projects, company-level overhead, and the company itself relate — worked out
with David, including the tenant-vs-project distinction that resolves "how does a new LLC fit."

---

## 1. The tree (the view)

"All projects" renders a **collapsible/expandable TREE**. The tree IS the project-lens. Collapse
solves density — you never face a flat 50-row wall; you see a few projects and expand the one you
want.

```
TRACE  (visual root — the business NAME, sourced from the tenant; NOT a stored node)
├── Platform overhead        (parent_id null = company-level costs: laptop, domains, Claude Pro…)
├── CoolRunnings (PROJECT)
│     HP ProDesk, NSPanel, meross…
├── BuiltWithCAI (PROJECT)
│     its costs
└── Cultivar / Ignition / Farm / RealEstate (PROJECTs)
      their costs
```

## 2. Tenant vs Project — two levels, do NOT conflate (the crux)

This resolves David's "TRACE as parent_id 001" question and the "new LLC as parent" question.

- The **COMPANY / LLC** (TRACE, LAWNS, a future purchased LLC) is the **TENANT** — `business_id`,
  RLS scope (AC-3, tenant isolation absolute). It is **NOT** a `cost_objects` row and **NOT** a
  `parent_id`. It already exists as the scope the whole tree lives in (TRACE = business_id
  45830ba7…).
- **PROJECTS** (CoolRunnings, BuiltWithCAI, verticals) are `cost_objects` nodes **within** a tenant,
  scoped to that `business_id`.
- A **NEW LLC = a NEW TENANT** (new `business_id`, own RLS scope, own separate cost tree) — a
  **SIBLING**, not a child node under TRACE. This is the existing, proven multi-tenant model
  (cross-tenant isolation already verified). You never reparent into another company; you spin up an
  isolated tenant.

**Why NOT a stored "TRACE" node (`parent_id 001`):** putting the company in the shared `cost_objects`
tree would force a 2nd LLC to be `parent_id 002` in the SAME table → two businesses' costs in one
tree → breaks tenant isolation, RLS can't cleanly separate them. Keeping company = tenant keeps them
properly walled off. **David's goal (clean multi-business future) is ACHIEVED by company=tenant, and
would be BROKEN by company=node.**

**UI honors the "see TRACE at the top" instinct:** render the tenant's business NAME as the **visual
root** of the tree (label, sourced from `business_id` → business name), with `parent_id`-null costs
as its direct children labeled **"Platform overhead."** In TRACE's tenant the root reads "TRACE"; in
LAWNS's tenant it reads "LAWNS." The named root is DISPLAYED from the tenant, NOT stored as a
`parent_id` row.

## 3. Where costs attach — single parent, overhead at root

- `parent_id` = a PROJECT node → **project-specific** cost (HP ProDesk → CoolRunnings).
- `parent_id` null → **company-level overhead**, shown under the named root as "Platform overhead."
- **Single parent always.** A cost's home is either ONE project or the company — never two. This
  sidesteps the DAG-diamond double-count entirely (single parent = no diamond).

**Shared/overhead costs go to company-level, NOT fractional splits.** A laptop used to code for all
projects, a tablet demoing across verticals — these are **TRACE overhead**, attached at company
level. Reason this beats fractional splitting: splitting a laptop X%/Y%/Z% is **fake precision**
(invented percentages, violates D-9 honesty). "This is platform overhead, serves everything" is
**true** — it's how the cost actually behaves. Honest AND simpler.

**Default:** a new cost is **company-level by default**; the user pushes it DOWN to a project if
project-specific. No scary "unassigned" state — "company-level until you say otherwise."

## 4. Row controls — label that becomes a dropdown on click (David agreed)

Confidence (CONFIRMED / DERIVED / ESTIMATED / UNKNOWN) and cadence render as small **LABELS / badges**
(e.g. a "CONFIRMED" badge), and become **dropdowns on click** to edit. This keeps the tree scannable
at 50+ items (tidy badges, not a wall of always-open dropdown widgets) while staying fully editable.

## 5. Reassignment — move + honest recompute

Each cost has a **parent dropdown listing ALL projects** (plus company-level). Changing it:
- **re-points `parent_id`** to the new PROJECT (or to null = company-level),
- **MOVES** the cost under that node in the tree (one row, new parent — a MOVE, **never a copy**; a
  cost is never under two places at once),
- **RECOMPUTES** both affected groups' totals **THROUGH `CostRollup.ts` + the count-once seam**
  (honest re-derive, NOT a local add/subtract shortcut — so the number stays honest after a move,
  even if the cost touched a flag/duplicate).

Reassignment spans levels: a laptop can move TRACE-overhead → CoolRunnings if you decide it's mostly
that; a project cost can move UP to TRACE if it turns out to be overhead.

## 6. Deferred (deliberate, AC-4)

- A cost genuinely shared between **two specific projects** (not company-wide) via **fractional
  edges** (`cost_object_edges`). May never be needed — most "shared" things are company overhead,
  handled at the root level above. **Do NOT build fractional-share UI now.**
- PROJECT entity stays **minimal** — name is enough for now; add description/type later only if a
  real need appears.

## 7. Untouched

The honesty engine (D-9) is OWNER-PROVEN and stays exactly as-is: capex excluded from the ÷N pool,
unknowns surfaced never zeroed, duplicates flagged + counted once. The tree/grouping just **re-cuts
the same honest data**; it does not change how any number is computed.
