/**
 * ── retiredScript — a hard refusal for scripts whose work is DONE ─────────────────────
 *
 * PURPOSE:      A one-shot migration/seed script is correct exactly once. Afterwards it is a
 *               loaded weapon pointed at a live tenant, because the vocabulary, schema or
 *               decision it encodes has moved on and nothing about the file says so. This
 *               refuses to run and explains what superseded it.
 * DEPENDENCIES: none.
 * OUTPUTS:      refuseRetired() — prints and exits 1. It never returns.
 *
 * WHY REFUSE RATHER THAN DELETE (David's ruling 2026-07-30): the file is the RECORD OF WHAT RAN.
 * Deleting it destroys the only artifact showing how the live data got into its current shape —
 * the same reasoning that keeps the `40 → 40` audit row (#163) and the pre/post probe rows for
 * #74. The record is the SOURCE; executability is not part of what we are preserving.
 *
 * WHY THERE IS NO OVERRIDE FLAG. An override is a thing a person in a hurry sets. If a NEW
 * project genuinely needs seeding, the correct act is a NEW script written against the CURRENT
 * vocabulary — not a resurrection of one whose strings the platform retired. A refusal with an
 * escape hatch is the STD-023 shape: a guard the caller can decline is advice, not a gate.
 *
 * THE HAZARD THIS CLOSES, concretely: `backfill-financial-permissions.mjs` and
 * `seed-role-floor.mjs` WRITE permission arrays to live `business_members` / `role_definitions`
 * rows using the pre-flip vocabulary (`view_costs`, `view_wages`, `override_maintenance`, …).
 * Re-running either would inject RETIRED strings into a live tenant — precisely the #163 phantom
 * -string defect, where three strings for a resource that no longer exists sat in a live member's
 * array with every check we own reporting green on them.
 */

export function refuseRetired({ script, retiredOn, supersededBy, wrote, why }) {
  const line = '═'.repeat(78);
  console.error(`\n${line}`);
  console.error(`⛔ REFUSING TO RUN — ${script} is RETIRED (${retiredOn}).`);
  console.error(line);
  if (why) console.error(`\nWHY IT IS RETIRED\n  ${why}`);
  console.error(`\nSUPERSEDED BY\n  ${supersededBy}`);
  if (wrote) console.error(`\nWHAT IT WOULD WRITE IF IT RAN\n  ${wrote}`);
  console.error(
    '\nTHIS FILE IS KEPT AS THE RECORD OF WHAT RAN, NOT AS A THING TO RUN.'
    + '\nIf a new project needs this work, write a NEW script against the CURRENT vocabulary.'
    + '\nThere is deliberately no override flag: a guard the caller can decline is advice,'
    + '\nnot a gate (STD-023).\n',
  );
  process.exit(1);
}
