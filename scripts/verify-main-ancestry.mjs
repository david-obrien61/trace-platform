#!/usr/bin/env node
// ============================================================================
// verify-main-ancestry — DID YOUR MERGE ACTUALLY LAND, AND DOES A ROW THAT SAYS
// "MERGED" HAVE ANYTHING ON `origin/main` TO SHOW FOR IT?
//
// PURPOSE:  tech-debt #280 ①. The close-out bars name neither a BRANCH nor an
//           ENVIRONMENT: BUILDER-COMPLETE is "committed" and DEPLOYED is "pushed
//           to origin AND Vercel-deployed". #303 was recorded complete while
//           sitting on `fix/pmi-suggest-auth`, never an ancestor of origin/main.
//
// 🔴 THE INCIDENT THIS WAS BUILT FROM IS OUR OWN, AND IT IS THE TEST CASE.
//    2026-09-14: a session merged ledger #320 into `main`, REPORTED IT MERGED,
//    and `origin/main` had not moved. The merge went into LOCAL `main` and was
//    never pushed; the session then branched off local `main`, so every later
//    command agreed the merge was there. Found ~40 minutes later by running
//    `merge-base --is-ancestor` BY HAND during a final check.
//
//    🔴 NOTE WHAT DID NOT CATCH IT: not `git status` (clean), not the tests
//    (green), not `npm run verify` (exit 0), and not `verify-handoff-retention`
//    — INCLUDING the §3-entry clause built that same session, because the ledger
//    row and its §3 entry were both present, both correct, and both unpushed.
//    Every gate we own passed on a merge that existed only on one machine.
//    Third instance of the family: #60, #282, this.
//
// CHECKS:
//   A  LOCAL `main` IS NOT AHEAD OF `origin/main`. Every commit on local main
//      must be an ancestor of origin/main. This is the incident above, and it is
//      the mechanical form of CORE MANDATE rule 9 ("commit → push are ONE
//      action") for the shared trunk.
//   B  A CLOSE-OUT ROW CLAIMING "MERGED TO `main`" MUST HAVE AT LEAST ONE CITED
//      COMMIT THAT IS AN ANCESTOR of origin/main — the claim has to be
//      corroborated by something actually on the trunk.
//
// 🔴 WHY B IS "AT LEAST ONE" AND NOT "ALL", WHICH WAS THE FIRST DESIGN AND WAS
//    MEASURED BEFORE IT WAS SHIPPED: requiring EVERY cited SHA to be an ancestor
//    reports 8 failures across 27 SHAs on today's corpus, and they are NOT
//    defects. `13d64aa` is a pre-rebase SHA that the breakpoint board records
//    DELIBERATELY ("REBASED onto main the same day … the code it carries is
//    identical, and the SHA he actually read is kept here because a proof
//    records what was RUN"). Rows also cite base commits and other branches'
//    commits legitimately. A cap that arrives RED with 8 rebase artefacts is a
//    cap people switch off — tech-debt #73's lesson, and the same argument this
//    repo's own #294a proposal makes against a two-directional row-shape check.
//    "At least one" is weaker and it still catches the defect that matters: a row
//    that says MERGED with NOTHING on main behind it. Measured: 0 failures.
//
// SCOPE — A DELIBERATE LIMIT, STATED: check A asserts `main` ONLY. An unpushed
//    feature branch is your own business and is often correct mid-build (R-149
//    pushes reservations early for exactly this reason). An unpushed `main` is
//    invisible to everyone else, which is what makes it the dangerous one.
//
// ⚠️ IT DOES NOT AND CANNOT CLOSE #280 ②. Nothing here reads Vercel. ② is
//    OBSERVABLE from the app since ledger #321 (the production stamp) and is
//    still asserted by no cap.
//
// OUTPUTS: exit 0 with what it examined, or exit 1 naming the commits.
// Run: node scripts/verify-main-ancestry.mjs [--no-fetch] [--self-test]
// ============================================================================
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LEDGER = 'docs/CLOSE-OUT-LEDGER.md';
const SELF_TEST = process.argv.includes('--self-test');
const NO_FETCH = process.argv.includes('--no-fetch');

/** A row asserting it reached the trunk. Narrow on purpose: it must name `main`. */
const MERGED_CLAIM = /MERGED TO `main`/i;
const ROW = /^\| \*\*#(\d+)\*\* \|/;
/** Backticked 7–40 hex. Migration filenames (`20260831d`) match too — the commit
 *  probe filters them, which is why resolution is a separate step from matching. */
const SHA_IN_PROSE = /`([0-9a-f]{7,40})`/g;

/**
 * THE WHOLE CHECK, AS A PURE FUNCTION over an injected git. The real git is
 * passed in by main(); the self-test passes a fake that CAN REFUSE — a double
 * that always agrees would make every probe below decoration (§6 r19a).
 *
 * @param {string} ledgerMd
 * @param {{ aheadOfOrigin: () => string[],       // commits on local main, not on origin/main
 *           isCommit: (s: string) => boolean,
 *           isAncestorOfOriginMain: (s: string) => boolean,
 *           originMainExists: () => boolean }} git
 */
export function checkAncestry(ledgerMd, git) {
  const problems = [];

  // 🔴 A CHECK THAT CANNOT SEE ITS REFERENCE MUST REFUSE, NOT PASS. Without this
  // a fresh clone, a renamed remote or a fetch failure would report "clean" —
  // "I never looked" rendering identically to "no violations" (#182).
  if (!git.originMainExists()) {
    return [
      '`origin/main` cannot be resolved, so ancestry was NOT checked.\n' +
      '     This check refuses rather than passes: "I could not look" must never render as "nothing wrong".\n' +
      '     Run `git fetch origin main`, or check the remote is named `origin`.',
    ];
  }

  // ── A — the incident. Local main must not hold commits origin/main lacks. ──
  const ahead = git.aheadOfOrigin();
  if (ahead.length) {
    problems.push(
      `local \`main\` is AHEAD of \`origin/main\` by ${ahead.length} commit(s) — they exist only on this machine:\n` +
      ahead.map(c => `       · ${c}`).join('\n') + '\n' +
      '     🔴 THIS IS THE DEFECT: a merge or commit that succeeded locally, reported as done, and published nowhere.\n' +
      '     `git status` is clean, the tests pass and `npm run verify` exits 0 in exactly this state.\n' +
      '     Fix: `git push origin main` — then VERIFY `origin/main` moved, rather than trusting the push.\n' +
      '     (CORE MANDATE rule 9: commit → push are ONE action. tech-debt #280 ①.)',
    );
  }

  // ── B — a row that says MERGED must have something on the trunk to show. ──
  let rowsClaiming = 0;
  for (const line of ledgerMd.split('\n')) {
    const m = ROW.exec(line);
    if (!m || !MERGED_CLAIM.test(line)) continue;
    rowsClaiming++;
    const cited = [...new Set([...line.matchAll(SHA_IN_PROSE)].map(x => x[1]))].filter(git.isCommit);
    if (cited.length && cited.some(git.isAncestorOfOriginMain)) continue;
    problems.push(
      `close-out row #${m[1]} claims "MERGED TO \`main\`" and cites ${cited.length === 0
        ? 'NO resolvable commit at all'
        : `${cited.length} commit(s), NONE of which is an ancestor of \`origin/main\``}` +
      `${cited.length ? ':\n' + cited.map(c => `       · ${c}`).join('\n') : ''}\n` +
      '     Either the merge has not been pushed, or the row claims a trunk it never reached (#303\'s shape).',
    );
  }

  return { problems, rowsClaiming, aheadCount: ahead.length };
}

/** The real git. Every call is read-only except the fetch, which is opt-out. */
function realGit() {
  const g = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const ok = (...a) => { try { execFileSync('git', a, { stdio: 'ignore' }); return true; } catch { return false; } };
  return {
    originMainExists: () => ok('rev-parse', '--verify', '--quiet', 'origin/main'),
    // ⚠️ `origin/main`, NEVER local `main`. Local main is precisely what was wrong
    // in the incident: a check that consulted it would have passed too.
    aheadOfOrigin: () => {
      if (!ok('rev-parse', '--verify', '--quiet', 'refs/heads/main')) return []; // no local main (e.g. a worktree) — nothing to assert
      const out = g('log', '--oneline', '--no-decorate', 'origin/main..main');
      return out ? out.split('\n') : [];
    },
    isCommit: s => ok('cat-file', '-e', `${s}^{commit}`),
    isAncestorOfOriginMain: s => ok('merge-base', '--is-ancestor', s, 'origin/main'),
  };
}

if (!SELF_TEST) {
  // 🔴 FETCH FIRST — the failure mode IS a stale view of origin. A failed fetch
  // degrades LOUDLY rather than silently: staleness biases this check toward
  // REFUSING (origin looks behind), which is the safe direction, but the reader
  // is told either way.
  let fetched = true;
  if (!NO_FETCH) {
    try { execFileSync('git', ['fetch', '--quiet', 'origin', 'main'], { stdio: 'ignore', timeout: 30_000 }); }
    catch { fetched = false; }
  }

  const res = checkAncestry(readFileSync(LEDGER, 'utf8'), realGit());
  const problems = Array.isArray(res) ? res : res.problems;

  if (problems.length) {
    console.error('\n❌ verify-main-ancestry FAILED\n');
    for (const p of problems) console.error('  · ' + p + '\n');
    if (!fetched) console.error('  ⚠️ `git fetch` did not run — `origin/main` may be stale, which biases this check toward refusing.');
    console.error('  Rule: tech-debt #280 ① · CORE MANDATE rule 9.\n');
    process.exit(1);
  }
  const s = `local \`main\` is not ahead of \`origin/main\`; ${res.rowsClaiming} row(s) claiming "MERGED TO \`main\`" are corroborated on the trunk`;
  console.log(`✅ verify-main-ancestry — ${s}.${fetched ? '' : ' ⚠️ (fetch did not run — refs may be stale)'}`);
}

// ============================================================================
// SELF-TEST — STD-022 both directions; STD-024 the first probe is the real
// defect. The fake git CAN REFUSE: a double that always agrees would make every
// probe here decoration (§6 r19a — "a test double must be able to refuse what
// the real thing refuses").
// ============================================================================
if (SELF_TEST) {
  const git = ({ ahead = [], commits = [], ancestors = [], originMain = true }) => ({
    originMainExists: () => originMain,
    aheadOfOrigin: () => ahead,
    isCommit: s => commits.includes(s),
    isAncestorOfOriginMain: s => ancestors.includes(s),
  });
  const row = (id, text) => `| **#${id}** | ${text} | x | y | z | w |`;
  const probes = [
    // ── P1 — 🔴 THE REAL DEFECT, VERBATIM (STD-024). #320's merge, 2026-09-14:
    //    on local main, on no remote, with everything else green.
    { name: 'P1  the real defect: a commit on local main and NOT on origin',
      md: '', g: { ahead: ['a0c957b merge(#320): the §3 entry gate'] },
      expect: true, why: 'must REFUSE — this is the merge that was reported done and published nowhere' },

    // ── P2 — the passing direction. Without it, P1 could be a check that always fails.
    { name: 'P2  local main level with origin/main',
      md: '', g: {}, expect: false, why: 'must PASS — nothing unpushed' },

    // ── P3 — behind is fine. Only AHEAD is the defect.
    { name: 'P3  local main BEHIND origin/main is not a defect',
      md: '', g: { ahead: [] }, expect: false, why: 'must PASS — you simply have not pulled; nothing of yours is unpublished' },

    // ── P4 — #303's shape: a row claiming the trunk with nothing on it.
    { name: 'P4  a row claiming MERGED with no commit on origin/main',
      md: row(303, 'x ✅ **MERGED TO `main`** `fc94309`'),
      g: { commits: ['fc94309'], ancestors: [] },
      expect: true, why: "must REFUSE — #303's shape: recorded complete while never on the trunk" },

    { name: 'P5  a row claiming MERGED with a commit that IS on origin/main',
      md: row(321, 'x ✅ **MERGED TO `main`** `15fe4f2`'),
      g: { commits: ['15fe4f2'], ancestors: ['15fe4f2'] },
      expect: false, why: 'must PASS — the claim is corroborated' },

    // ── P6 — honest rows are exempt. The repo deliberately ships "PUSHED, NOT
    //    MERGED" rows on David's own instruction; failing them would be wrong.
    { name: 'P6  a row NOT claiming merged is exempt',
      md: row(318, 'x **Branch `fix/pipefail`, PUSHED, NOT MERGED** `a4dd93c`'),
      g: { commits: ['a4dd93c'], ancestors: [] },
      expect: false, why: 'must PASS — "pushed, not merged" is an honest claim, not a defect' },

    // ── P7 — 🔴 THE NOISE CASE, MEASURED ON THE REAL CORPUS BEFORE THE DESIGN
    //    WAS FIXED. A rebase orphans the SHA a proof was run against, and the
    //    boards keep it deliberately. "All must be ancestors" reports 8 of these.
    { name: 'P7  a rebase artefact alongside a real ancestor still passes',
      md: row(307, 'x ✅ **MERGED TO `main`** `13d64aa` (pre-rebase) · `11dd23d`'),
      g: { commits: ['13d64aa', '11dd23d'], ancestors: ['11dd23d'] },
      expect: false, why: 'must PASS — "at least one" is why this cap is not red on arrival (#73)' },

    // ── P8 — migration filenames look like hex and are not commits.
    { name: 'P8  `20260831d` is not mistaken for a commit',
      md: row(249, 'x ✅ **MERGED TO `main`** `44f204f` `20260831d`'),
      g: { commits: ['44f204f'], ancestors: ['44f204f'] },
      expect: false, why: 'must PASS — resolution is a separate step from matching, so filenames drop out' },

    // ── P9 — 🔴 CANNOT LOOK ≠ NOTHING WRONG (#182).
    { name: 'P9  origin/main unresolvable REFUSES rather than passing',
      md: '', g: { originMain: false, ahead: [] },
      expect: true, why: 'must REFUSE — "I never looked" must not render as "clean"' },

    // ── P10 — 🔴 NEGATIVE CONTROL that changes the POPULATION, not the subject
    //    (#182's own unmet prescription). An empty ledger must not be read as
    //    proof; it must pass having examined ZERO rows, and say so.
    { name: 'P10 negative control — an empty ledger examines 0 rows and says so',
      md: '', g: {}, expect: false, why: 'must PASS with rowsClaiming === 0, proving the count tracks the input',
      extra: r => r.rowsClaiming === 0 },

    { name: 'P11 and a ledger WITH rows reports a non-zero count',
      md: row(321, 'x ✅ **MERGED TO `main`** `15fe4f2`'),
      g: { commits: ['15fe4f2'], ancestors: ['15fe4f2'] },
      expect: false, why: 'must PASS with rowsClaiming === 1 — the pair with P10 is what proves it reads the file',
      extra: r => r.rowsClaiming === 1 },
  ];

  let failed = 0;
  for (const p of probes) {
    const res = checkAncestry(p.md, git(p.g));
    const problems = Array.isArray(res) ? res : res.problems;
    let ok = (problems.length > 0) === p.expect;
    if (ok && p.extra) ok = !Array.isArray(res) && p.extra(res);
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${p.name} — ${p.why}`);
  }
  if (failed) { console.error(`\n❌ verify-main-ancestry --self-test: ${failed}/${probes.length} probes FAILED.\n`); process.exit(1); }
  console.log(`\n✅ verify-main-ancestry --self-test — ${probes.length}/${probes.length} probes, both directions.`);
}
