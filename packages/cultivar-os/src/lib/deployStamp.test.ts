/**
 * ── deployStamp — WHERE is this bundle deployed? (tech-debt #280 ②, OP-15 GATE 0) ──
 *
 * 🔴 §A IS THE ONE THAT MATTERS, AND IT IS #280's OWN INCIDENT VERBATIM (STD-024):
 *   ledger #303 was recorded complete "with only Preview deploys". A preview and a
 *   production deploy of the SAME COMMIT must not read the same. If A1 ever passes
 *   by accident, GATE 0 goes back to being a claim.
 *
 * Both directions throughout (STD-022): every "must shout" has a "must stay quiet"
 * beside it, or the check could be a function that shouts at everything.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/deployStamp.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { deployStamp, readDeployTarget, EXPECTED_PRODUCTION_REF } from './deployStamp';

let passed = 0, failed = 0; const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const SHA = 'e430f3c';   // any real build sha
const LOCAL = 'dev';     // what vite.config.ts bakes when VERCEL_GIT_COMMIT_SHA is absent

// ══ §A 🔴 THE REAL DEFECT — A PREVIEW MUST NOT READ LIKE PRODUCTION ════════
{
  const prod = deployStamp('production', 'main', SHA);
  const prev = deployStamp('preview', 'fix/pmi-suggest-auth', SHA);

  ok(prod.label !== prev.label,
     'A1 🔴 THE DEFECT: the same SHA on production and on a preview must not produce the same stamp — #303 was recorded complete on preview-only deploys');
  ok(prev.loud === true && prod.loud === false,
     'A2 🔴 and the PREVIEW is the loud one — the risk is mistaking a preview for production, never the reverse');
  ok(prev.label.includes('PREVIEW'),
     'A3 the word PREVIEW appears literally — a reader standing in a lot should not have to decode a colour');
  ok(prev.label.includes('fix/pmi-suggest-auth'),
     'A4 the branch is named, so you can see WHICH preview you are on');
  ok(/do not record an owner-proof/i.test(prev.reason),
     'A5 the reason says what NOT to do with the screen, not merely what it is');
}

// ══ §B PRODUCTION — THE POSITIVE ASSERTION GATE 0 NEEDS ════════════════════
{
  const p = deployStamp('production', 'main', SHA);
  ok(p.label === 'prod',
     'B1 🔴 production is STAMPED POSITIVELY, not left blank — a blank production is indistinguishable from a bundle built before this feature (A9: absent is not empty)');
  ok(p.loud === false, 'B2 and it is quiet — the expected state must not cry wolf');
  ok(deployStamp('production', '', SHA).label === 'prod',
     'B3 a production build with no branch reported is still production — the ref is corroboration, not the claim');
  ok(EXPECTED_PRODUCTION_REF === 'main', 'B4 the expected ref is main, and it is named once rather than typed twice');
}

// ══ §C PRODUCTION BUILT FROM A BRANCH — LEGAL, AND WORTH SEEING ════════════
{
  const promoted = deployStamp('production', 'fix/handoff-entry-gate-and-trim', SHA);
  ok(promoted.loud === true,
     'C1 🔴 a production deploy built from a NON-main branch shouts — someone promoted a branch, which is legal and is exactly the thing you want to notice');
  ok(promoted.label.includes('fix/handoff-entry-gate-and-trim'),
     'C2 and it names the branch it was actually built from');
  ok(promoted.label !== deployStamp('production', 'main', SHA).label,
     'C3 and it does NOT read the same as a main-built production deploy');
}

// ══ §D LOCAL — QUIET, BECAUSE A WARNING THAT ALWAYS FIRES IS WALLPAPER ═════
{
  ok(deployStamp(undefined, undefined, LOCAL).loud === false,
     'D1 a local build (sha "dev", no VERCEL_ENV) is quiet — if every local session shouted, the shout would stop being read');
  ok(deployStamp(undefined, undefined, LOCAL).label === 'local', 'D2 and it says so plainly');
  ok(deployStamp('development', 'main', SHA).label === 'local',
     'D3 Vercel’s own `development` target is also local — `vercel dev`, not a deployment');
}

// ══ §E 🔴 UNKNOWN MUST NEVER READ AS PRODUCTION ════════════════════════════
{
  for (const bogus of ['', '   ', 'prod', 'PRODUCTION_', 'staging', 'live', undefined]) {
    const r = deployStamp(bogus, 'main', SHA);
    if (bogus === undefined || String(bogus).trim() === '' || String(bogus).trim().toLowerCase() !== 'production') {
      ok(r.label !== 'prod',
         `E1 🔴 an unrecognised VERCEL_ENV (${JSON.stringify(bogus)}) must NOT be coerced to production — a stamp that guesses "prod" is the silent false green this exists to prevent`);
      ok(r.loud === true, `E2 and it is LOUD (${JSON.stringify(bogus)}) — an unknown that renders quietly reads as fine`);
    }
  }
  ok(deployStamp('PRODUCTION', 'main', SHA).label === 'prod',
     'E3 but the real value is matched case-insensitively — refusing "PRODUCTION" would be a different lie');
  ok(deployStamp('  production  ', 'main', SHA).label === 'prod',
     'E4 and surrounding whitespace does not defeat it');
}

// ══ §F THE NORMALISER, BOTH DIRECTIONS ═════════════════════════════════════
{
  ok(readDeployTarget('production') === 'production', 'F1 production');
  ok(readDeployTarget('preview') === 'preview', 'F2 preview');
  ok(readDeployTarget('development') === 'development', 'F3 development');
  ok(readDeployTarget('') === 'unknown', 'F4 empty is unknown, never a default');
  ok(readDeployTarget(undefined) === 'unknown', 'F5 undefined is unknown');
  ok(readDeployTarget('productionish') === 'unknown',
     'F6 🔴 NEGATIVE CONTROL — a near-miss is unknown, not production. A prefix/substring match here would pass every probe above while being wrong');
}

// ══ §G EVERY BRANCH RETURNS A USABLE STAMP (no undefined labels) ═══════════
{
  const cases: Array<[string | undefined, string | undefined, string]> = [
    ['production', 'main', SHA], ['preview', 'x', SHA], ['development', 'main', SHA],
    [undefined, undefined, LOCAL], ['nonsense', '', SHA], ['preview', '', SHA],
  ];
  for (const [e, r, s] of cases) {
    const v = deployStamp(e, r, s);
    ok(typeof v.label === 'string' && v.label.length > 0, `G1 label is non-empty for ${JSON.stringify([e, r, s])}`);
    ok(typeof v.reason === 'string' && v.reason.length > 0, `G2 reason is non-empty for ${JSON.stringify([e, r, s])}`);
    ok(typeof v.loud === 'boolean', `G3 loud is a boolean for ${JSON.stringify([e, r, s])}`);
  }
}

console.log(`\ndeployStamp.test.ts — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
