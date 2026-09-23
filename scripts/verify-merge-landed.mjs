#!/usr/bin/env node
/**
 * verify-merge-landed — DID THE MERGE ACTUALLY LAND? (CLAUDE.md §6 r23)
 *
 * PURPOSE:      Answer one question honestly: is the work on `origin/main`? It takes the
 *               BRANCH'S OWN HEAD SHA, captured BEFORE merging, and asserts that SHA is an
 *               ancestor of `origin/main`.
 *
 * 🔴 WHY THE PRE-MERGE BRANCH SHA AND NOT `HEAD`. `HEAD` is exactly what a FAILED merge leaves
 *    pointing at the thing you were merging INTO — so `merge-base --is-ancestor HEAD origin/main`
 *    is TRIVIALLY TRUE after a conflict. The check that exists to catch an unlanded merge reports
 *    green precisely when it should not. The pre-merge branch SHA is the only value that cannot be
 *    satisfied by doing nothing.
 *
 * THE INCIDENT IT ENCODES (2026-09-23, ledger #387). A merge was piped into `tail -2`, so the
 *    `&&` chain read the FILTER's exit code and continued past a conflict; the push pushed
 *    `origin/main` back to itself (exit 0); the ancestry check passed on `HEAD`. Thunder reported
 *    "✓ MERGED to origin/main: f07f198d" — **another session's commit**, with nothing of its own
 *    landed. Found by re-reading `git status`, not by any gate.
 *
 * 🔴 TECH-DEBT #280's FAMILY, AND #280's OWN FIX WAS PRESENT. The ancestry check is the right
 *    check; it was handed the wrong SHA. *A correct check on a wrong input is indistinguishable
 *    from a passing one* — [[R-33]] one level out: not only "could this fail?" but "could this
 *    fail ON THE VALUE IT IS ACTUALLY READING?"
 *
 * USAGE:   node scripts/verify-merge-landed.mjs <branch> <pre-merge-sha>
 *          node scripts/verify-merge-landed.mjs --self-test
 *
 * ⚠️ NOT IN `npm run verify`. It answers a question about ONE merge at ONE moment, and a build
 *    gate cannot know which merge you meant. It is run BY the session that merges, and §6 r23 is
 *    what makes running it obligatory.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 🔴 execFileSync, NOT a shell string — no pipeline, so nothing can mask an exit code. That is the
// very defect this file exists about, and reproducing it here would be its own joke.
function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}
/** True/false without throwing — `--is-ancestor` signals by exit code, which is the point. */
function isAncestor(a, b, cwd) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd, stdio: 'ignore' }); return true; }
  catch { return false; }
}

function check({ branch, preMergeSha, cwd = process.cwd(), quiet = false } = {}) {
  const problems = [];
  const say = (...m) => { if (!quiet) console.log(...m); };

  let resolved;
  try { resolved = git(['rev-parse', preMergeSha], { cwd }); }
  catch { problems.push(`the pre-merge SHA "${preMergeSha}" does not resolve in this repository`); return { ok: false, problems }; }

  // ① THE SHA MUST BE THE BRANCH'S, NOT SOMETHING ELSE THAT HAPPENS TO BE AN ANCESTOR.
  // Without this, passing `origin/main` as the "branch SHA" would pass trivially — the same
  // failure one argument over.
  let branchHead = null;
  try { branchHead = git(['rev-parse', branch], { cwd }); } catch { /* the branch may be gone post-merge */ }
  if (branchHead && !isAncestor(resolved, branchHead, cwd)) {
    problems.push(`"${preMergeSha}" (${resolved.slice(0, 8)}) is not an ancestor of ${branch} (${branchHead.slice(0, 8)}) — that SHA is not this branch's work`);
  }

  // ② THE ACTUAL QUESTION.
  const landed = isAncestor(resolved, 'origin/main', cwd);
  if (!landed) {
    const mainSha = (() => { try { return git(['rev-parse', 'origin/main'], { cwd }).slice(0, 8); } catch { return '(unknown)'; } })();
    problems.push(
      `${resolved.slice(0, 8)} is NOT an ancestor of origin/main (${mainSha}). The merge did NOT land.\n` +
      `     ⚠️ If a merge reported success, check for a CONFLICT: a piped \`git merge\` returns the\n` +
      `        filter's exit code, and a failed merge leaves HEAD at origin/main so a HEAD-based\n` +
      `        ancestry check passes trivially. That is the 2026-09-23 incident (§6 r23).`,
    );
  }

  if (problems.length === 0) say(`✅ merge-landed — ${branch} (${resolved.slice(0, 8)}) is an ancestor of origin/main.`);
  return { ok: problems.length === 0, problems, resolved };
}

// ── SELF-TEST — the conflict case is PLANTED, not described ───────────────────────────────────
// 🔴 A check nobody has watched refuse is a claim (§6 r19). This builds a throwaway repository,
// reproduces the 2026-09-23 shape exactly — a conflicting merge that leaves HEAD at main and the
// branch unlanded — and asserts the check REFUSES. The positive control is what stops it passing
// by always refusing.
function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'merge-landed-'));
  let passed = 0, failed = 0;
  const ok = (c, m) => { if (c) passed++; else { failed++; console.error('   ✗ ' + m); } };
  const G = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });

  try {
    G('init', '-q', '-b', 'main');
    G('config', 'user.email', 't@t'); G('config', 'user.name', 't');
    writeFileSync(join(dir, 'f.txt'), 'base\n'); G('add', '.'); G('commit', '-qm', 'base');
    // A fake `origin/main` ref, so the check has the name it reads.
    G('update-ref', 'refs/remotes/origin/main', 'HEAD');

    // A branch that CONFLICTS with a later main.
    G('checkout', '-q', '-b', 'feat/x');
    writeFileSync(join(dir, 'f.txt'), 'branch side\n'); G('add', '.'); G('commit', '-qm', 'branch');
    const branchSha = execFileSync('git', ['rev-parse', 'feat/x'], { cwd: dir, encoding: 'utf8' }).trim();

    G('checkout', '-q', 'main');
    writeFileSync(join(dir, 'f.txt'), 'main side\n'); G('add', '.'); G('commit', '-qm', 'main moved');
    G('update-ref', 'refs/remotes/origin/main', 'HEAD');

    // THE INCIDENT: attempt the merge, let it conflict, leave the tree exactly as it was left.
    let conflicted = false;
    try { execFileSync('git', ['merge', '--no-ff', 'feat/x'], { cwd: dir, stdio: 'ignore' }); }
    catch { conflicted = true; }
    ok(conflicted, 'A the planted merge really did conflict (if not, the probe has lost its target)');

    // 🔴 THE FALSE GREEN, REPRODUCED: the old HEAD-based check passes right now.
    ok(isAncestor('HEAD', 'refs/remotes/origin/main', dir),
      'B 🔴 the OLD check (HEAD-based) PASSES after a conflict — the false green, reproduced');

    // …and the new check refuses.
    const bad = check({ branch: 'feat/x', preMergeSha: branchSha, cwd: dir, quiet: true });
    ok(!bad.ok, 'C 🔴 the NEW check REFUSES on the same tree — the branch SHA is not an ancestor');
    ok(bad.problems.some(p => /did NOT land/.test(p)), 'D …and says the merge did not land, in those words');

    // POSITIVE CONTROL — it must not simply always refuse.
    G('merge', '--abort');
    G('checkout', '-q', 'main');
    execFileSync('git', ['merge', '-q', '--no-ff', '-X', 'ours', 'feat/x', '-m', 'merged'], { cwd: dir, stdio: 'ignore' });
    G('update-ref', 'refs/remotes/origin/main', 'HEAD');
    const good = check({ branch: 'feat/x', preMergeSha: branchSha, cwd: dir, quiet: true });
    ok(good.ok, 'E 🔴 POSITIVE CONTROL — after a real merge it PASSES, so it is not a check that always refuses');

    // NEGATIVE CONTROL on argument ①: main's own SHA is an ancestor of main, and must still be refused.
    const mainSha = execFileSync('git', ['rev-parse', 'refs/remotes/origin/main'], { cwd: dir, encoding: 'utf8' }).trim();
    const wrongArg = check({ branch: 'feat/x', preMergeSha: mainSha, cwd: dir, quiet: true });
    ok(!wrongArg.ok, 'F 🔴 passing origin/main AS the branch SHA is REFUSED — otherwise the same failure moves one argument over');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\nverify-merge-landed --self-test — ${passed} passed, ${failed} failed`);
  return failed === 0;
}

const args = process.argv.slice(2);
if (args[0] === '--self-test') process.exit(selfTest() ? 0 : 1);
if (args.length < 2) {
  console.error('usage: node scripts/verify-merge-landed.mjs <branch> <pre-merge-sha>   |   --self-test');
  process.exit(2);
}
const r = check({ branch: args[0], preMergeSha: args[1] });
if (!r.ok) { console.error('\n❌ merge-landed FAILED\n'); for (const p of r.problems) console.error('  · ' + p); console.error(''); process.exit(1); }
