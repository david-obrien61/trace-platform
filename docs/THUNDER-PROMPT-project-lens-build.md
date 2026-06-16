# THUNDER PROMPT — Build the Project-Lens for Cost-to-Produce (D-10)

STEP 0 — GATE (you already passed this once; re-confirm against the FINAL design below):
Read CLAUDE.md in full. Confirm the 3 Session Starter checks. Re-read:
- DECISIONS.md → D-10 (Cost-to-Produce primary lens BY PROJECT) + linked bones (D-1 PROJECT
  node_type + parent_id; D-4 dual-edge rollup; D-9 honesty engine OWNER-PROVEN; D-7 count-once).
- DECISION-project-lens-ui-design.md (the full design this prompt carries — tree, tenant-root,
  single-parent, overhead, click-to-edit, reassignment). [David: commit this doc with the others.]
- The banked verify-first: BusinessAssets.tsx:173-194 hardcodes node_type:'ASSET', never writes
  parent_id; no UI creates PROJECT nodes or sets parent_id; CostToProduce.tsx:96 reads node_type,
  does no grouping. PROJECT node_type + parent_id exist in schema, unpopulated by entry.
Echo back your understanding of: the tenant-vs-project distinction (#2 below), single-parent +
overhead-at-root, and the reassignment recompute path. Then STOP — I confirm before you build.

WHY THIS MATTERS (the bar this clears):
The honesty engine is OWNER-PROVEN (math is honest). David cannot verify cost-to-produce serves its
PURPOSE until he sees cost broken out BY PROJECT. This build is the missing piece between "engine
works" and "tool is useful" — a SECOND owner-proof. It also fixes the entry UI that does not scale.

THIS BUILD = WIRING EXISTING BONES (not architecture, not schema change):
CostRollup.ts already computes per-PROJECT rollup. node_type PROJECT + parent_id exist. The live
tile seam-feed (CostToProduce.tsx) is dormant (rollupEvents=[]) by design — THIS build is the
deliberate wiring. Do NOT modify the honesty engine or schema.

CADENCE: propose the concrete UI (the tree, the Projects manager, the parent-picker, the row
controls) as a mockup/description BEFORE writing code. David wants one look at the design first.

=== THE DESIGN ===

1. TREE (view): "All projects" renders a collapsible/expandable TREE. The tree IS the lens; collapse
   solves density (no flat 50-row wall). Visual root = the tenant's business NAME (see #2).

2. TENANT vs PROJECT — two levels, do NOT conflate (the crux):
   - The COMPANY/LLC (TRACE) is the TENANT — business_id, RLS scope (AC-3). NOT a cost_objects row,
     NOT a parent_id. It is the scope the tree lives in (TRACE = business_id 45830ba7…).
   - PROJECTS (CoolRunnings, BuiltWithCAI, verticals) are cost_objects nodes WITHIN the tenant.
   - A NEW LLC = a NEW TENANT (new business_id, own RLS, own tree) — a SIBLING, not a child node.
     Existing proven multi-tenant model. Never reparent into another company.
   - DO NOT create a stored "TRACE" node / parent_id 001 — it would force a 2nd LLC into the same
     table and break tenant isolation.
   - UI: render the tenant's business NAME as the VISUAL ROOT (label from business_id → name), with
     parent_id-null costs as direct children labeled "Platform overhead." TRACE's tenant → root reads
     "TRACE"; LAWNS's tenant → "LAWNS". Named root DISPLAYED from tenant, NOT a stored row.

3. WHERE COSTS ATTACH — single parent, overhead at root:
   - parent_id = PROJECT node → project-specific cost.
   - parent_id null → company-level overhead, shown under the named root as "Platform overhead."
   - SINGLE PARENT ALWAYS — a cost's home is ONE project or the company, never two. Sidesteps
     DAG-diamond (single parent = no diamond).
   - Shared/overhead (laptop coding for all, tablet demoing across verticals) → COMPANY-LEVEL, NOT
     fractional split. Splitting X%/Y%/Z% = fake precision (violates D-9). "Platform overhead, serves
     everything" = true. Honest AND simpler.
   - DEFAULT: new cost is company-level by default; user pushes DOWN to a project if specific. No
     scary "unassigned" — "company-level until you say otherwise."

4. ROW CONTROLS — label-to-dropdown-on-click (David agreed):
   Confidence (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN) + cadence render as small LABELS/badges, become
   dropdowns ON CLICK. Keeps the tree scannable at 50+ items, still fully editable.

5. REASSIGNMENT — move + honest recompute:
   Each cost has a parent dropdown listing ALL projects + company-level. Changing it:
   - re-points parent_id to the new PROJECT (or null = company-level),
   - MOVES the cost under that node (one row, new parent — a MOVE, NEVER a copy; never under two),
   - RECOMPUTES both affected groups THROUGH CostRollup.ts + count-once seam (honest re-derive, NOT
     a local add/subtract shortcut). Spans levels (TRACE-overhead ↔ project, either direction).

6. ENTRY SIDE — create PROJECT nodes:
   A small "Projects" manager surface (nav-reachable, not URL-only) to create/name PROJECT nodes
   (cost_objects, node_type='PROJECT'): CoolRunnings, BuiltWithCAI, each vertical. PROJECT entity
   MINIMAL — name only for now (AC-4; add fields later only on real need). The parent-picker on cost
   entry then SELECTS from existing projects. Keep manage-projects (buckets) DISTINCT from
   assign-cost-to-project (contents) — do NOT create projects inline in the cost form. Picker shows
   real PROJECT nodes only (Surface Honesty).

7. DAG-DIAMOND caveat (CostRollup.ts:46-51, flags[] at :135): single-parent means this mostly won't
   bite for entered data. But honor the existing flag — if any grouped-sum vs flat-count-once
   divergence can occur, explain it on-surface, never hide it.

8. UNTOUCHED: honesty engine (D-9) stays exactly as owner-proven — capex excluded, unknowns
   surfaced never zeroed, duplicates flagged + counted once. Grouping re-cuts the SAME honest data.

=== CONSTRAINTS ===
- Read /mnt/skills/public/frontend-design/SKILL.md before UI work (density/design tokens).
- [TRACE:*] ON for new paths (STD-003) until owner-proven.
- Nav-reachable, not URL-only (tech-debt #36 — don't repeat assets/pmi nav-dead).
- Two-bar completion: report BUILDER-COMPLETE + owner-proof steps; no self-grading past that.

=== OWNER-PROOF (what David will check) ===
Create CoolRunnings + BuiltWithCAI as PROJECT nodes; the tree shows "TRACE" as the named root with a
"Platform overhead" group; assign seeded CoolRunnings hardware to CoolRunnings, AI/domain/overhead
costs at company-level; reassign one cost (e.g. a laptop) from overhead to a project and watch BOTH
totals recompute correctly; confirm nothing double-counted, collapse/expand works, click-to-edit
works, 50-item case stays scannable. That is the proof the tool does what David needs.

Build nothing past this scope. Propose the UI first, then on confirm build, then report at
BUILDER-COMPLETE for David's owner-proof.
