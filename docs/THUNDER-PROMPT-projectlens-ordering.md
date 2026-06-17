# THUNDER PROMPT — Project-Lens group ordering (overhead pinned top, projects alphabetical)

STEP 0 — GATE: Read CLAUDE.md, confirm the 3 Session Starter checks. DISPLAY-layer ordering fix to
the by-project tree (ProjectCostTree.tsx). Engine/math OWNER-PROVEN — do NOT touch computation, only
the ORDER groups render in.

CONTEXT: The inline-edit + headers + coherence fix is owner-proven and working (amounts real, HP
ProDesk resolved to ESTIMATED $500, rollups honest: overhead $123/mo, CoolRunnings $917.31 one-time,
BuiltWithCAI $156.67/mo, Farm $10k one-time). David's display-ordering request:

THE RULE:
1. PLATFORM / COMPANY-LEVEL OVERHEAD is PINNED TO TOP — always the first group, never sorted among
   the projects. Rationale: company-level costs (parent_id null) are the BASE layer (they serve the
   whole business), not a project. It's the "what it costs to just exist as a company" section, so it
   leads — projects (the specific buckets) come below it. Do NOT alphabetize overhead in among the
   projects (it is not competing as "P for Platform").
2. PROJECTS below overhead, sorted ALPHABETICALLY (alphanumeric A-Z) by name. Today: BuiltWithCAI,
   CoolRunnings, Farm.
3. OWNER-CONTROLLED ORDER via naming (no new UI): because the sort is alphanumeric, an owner who wants
   a custom order prefixes project names with 1./2./3. or A./B./C. — the prefix becomes the sort key.
   The owner who doesn't care gets sensible alphabetical; the owner who does gets control for free. No
   drag-to-reorder, no order column — it falls out of alphanumeric sort + naming freedom.

CONSTRAINTS:
- DISPLAY ORDER only. No change to rollup math, amounts, coherence, or the count-once engine.
- Applies to the by-project tree on /costs (and the capture mirror if it renders the same tree).
- [TRACE:PROJECTLENS] STAYS ON (David's standing decision — until Andrew's asset/inventory widget is
  online + tested; do NOT comment out).
- Two-bar: report BUILDER-COMPLETE + owner-proof steps.

OWNER-PROOF: open /costs → Platform overhead is first → projects below it alphabetically
(BuiltWithCAI, CoolRunnings, Farm) → rename a project with a "1." / "A." prefix → it re-sorts to the
position the prefix dictates. Display order only; all totals unchanged.

Report at BUILDER-COMPLETE with owner-proof steps.
