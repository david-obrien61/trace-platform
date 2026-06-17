# NOTE — [TRACE:PROJECTLENS] instrumentation stays ON (deliberate, do not comment out yet)
**Captured:** 2026-06-17
**Decision by:** David

## The decision
[TRACE:PROJECTLENS] debug instrumentation stays ON — do NOT comment it out — until **Andrew's
asset/inventory add widget is online AND tested**.

## Why (so no one helpfully removes it)
The project lens (D-10) is OWNER-PROVEN in isolation (tree, reassignment, tenant isolation all
confirmed 2026-06-16). Normally that earns the [TRACE:*] comment-out per STD-003. BUT:

- Andrew's asset/inventory add widget WRITES into cost_objects — the same table the project lens
  reads, groups, and rolls up.
- So the lens and Andrew's widget are COUPLED: a newly-added asset must land in the tree under the
  right project, get the right nature/shape, hit the rollup, not double-count.
- [TRACE:PROJECTLENS] is the instrumentation that proves those writes land correctly in the lens.
- Commenting it out before Andrew's widget is tested would blind us during the exact integration
  where the trace is most valuable.

## The principle
OWNER-PROVEN for the lens-in-isolation ≠ proven for the INTEGRATED flow (lens + its input path).
STD-003's "debug on between builder-complete and owner-proven" applies to the INTEGRATED bar here:
instrumentation stays on through the Andrew-widget integration, comes off only when the integrated
write→lens path is owner-proven.

## Trigger to revisit
When Andrew's asset/inventory add widget is online and tested against the lens (a scanned/added asset
shows up correctly in the tree, right project, right nature, rollup recomputes, no double-count) —
THEN [TRACE:PROJECTLENS] may be commented out (not deleted), per the standard.
