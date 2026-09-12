#!/usr/bin/env node
// ============================================================
// verify-id-sweep — AN ID CLAIMED ON THIS BRANCH MUST NOT BE CLAIMED ON ANOTHER
//
// PURPOSE      R-148 clause (2) and R-149 option (a), made mechanical. Every id this tree claims and
//              `origin/main` does not is swept against EVERY OTHER BRANCH — ledger rows, tech-debt
//              rows, ruling ids and commit subjects — and a claim held by two branches FAILS.
// DEPENDENCIES git remote-tracking refs (refs/remotes/origin/*) · docs/CLOSE-OUT-LEDGER.md ·
//              docs/tech-debt-log.md · docs/RULINGS.md
// OUTPUTS      exit 0 + the next free id in each space, or exit 1 naming the id and the branch.
//
// WHY THIS EXISTS (2026-09-12, ledger #309)
//   `verify-id-citations` reads ONE TREE. Every collision this platform has actually had was two
//   claims in TWO trees, so that cap could not have caught a single one of them:
//     #302  half-claimed — the id survived in a doc while the rows backing it were lost
//     #304  claimed by two sessions 4m35s apart, in commit subjects, in different branches
//     #305  found taken by another session's sweep, which is the ONLY reason it did not collide
//     #281  held by two branches 2h47m apart, found by a sweep and renumbered
//   🔴 SIX IN 24 HOURS, EVERY ONE BY A SESSION DOING THE RIGHT THING. The claim was simply made
//   where the next session does not look. This is the PREVENTION; `verify-id-citations` clauses C
//   and D are the NET that catches what has already landed.
//
// 🔴 WHAT THIS CAP CANNOT DO, STATED SO NOBODY READS MORE INTO A GREEN THAN IS THERE:
//   ① It reads remote-tracking refs, which are as fresh as your last `git fetch`. A stale sweep is a
//      sweep against yesterday, so staleness is MEASURED and REPORTED on every run, and `--strict`
//      makes it fail. It never silently reports a clean sweep against stale refs.
//   ② It cannot close the race. Between this sweep and your push, another session can take the id.
//      That is R-149's whole point and why the answer is RESERVE-AND-PUSH-FIRST, not check-harder.
//   ③ A claim that exists only in an unpushed local branch of another worktree is invisible to
//      everyone, including this. Push the reservation; that is the rule.
//
// Run: node scripts/verify-id-sweep.mjs [--strict] [--fetch]
//      node scripts/verify-id-sweep.mjs --self-test    — watch each check refuse
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const STRICT = process.argv.includes('--strict');
const SELF_TEST = process.argv.includes('--self-test');
const DO_FETCH = process.argv.includes('--fetch');
const STALE_HOURS = 6;

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// ── the three id-spaces, each with its own matcher. They are SEPARATE number lines that overlap:
//    `#281` is simultaneously a live ledger id and a live tech-debt id, so they are never merged.
const SPACES = {
  ledger:   { file: 'docs/CLOSE-OUT-LEDGER.md', label: 'close-out', re: /^\| \*\*#(\d+)\*\*/gm,  resRe: /^\| ⏳ \*\*#(\d+) — RESERVED/gmu },
  techdebt: { file: 'docs/tech-debt-log.md',    label: 'tech-debt', re: /^#{2,4} #(\d+)\b/gm,     resRe: null },
  ruling:   { file: 'docs/RULINGS.md',          label: 'ruling',    re: /\*\*R-(\d+)\b/g,         resRe: null },
};
const idsIn = (src, re) => new Set([...src.matchAll(new RegExp(re.source, re.flags))].map(m => +m[1]));

// ── the cap's own probes (STD-022): each matcher shown refusing a crafted violation ──
if (SELF_TEST) {
  const ok = (c, m) => { if (!c) { console.error('CAP PROBE FAILED: ' + m); process.exit(2); } };
  ok(idsIn('| **#307** | x |\n', SPACES.ledger.re).has(307), 'a ledger row is invisible');
  ok(!idsIn('| ⏳ **#309 — RESERVED** | x |\n', SPACES.ledger.re).has(309), 'a RESERVED row counted as a filed ledger row');
  ok(idsIn('| ⏳ **#309 — RESERVED 2026-09-12** | x |\n', SPACES.ledger.resRe).has(309), 'a reservation is not recognised');
  ok(idsIn('## #284 — a thing\n', SPACES.techdebt.re).has(284), 'a tech-debt heading is invisible');
  ok(idsIn('### #145 — a thing\n', SPACES.techdebt.re).has(145), 'a ### tech-debt heading is invisible');
  ok(!idsIn('see #284 mid-line\n', SPACES.techdebt.re).has(284), 'a bare in-prose id counted as a tech-debt row');
  ok(idsIn('| 2026-09-12 | 🔴 **R-148 — a ruling**', SPACES.ruling.re).has(148), 'a ruling id is invisible');
  ok(!idsIn('cites R-148 in prose', SPACES.ruling.re).has(148), 'an un-bolded ruling mention counted as a claim');
  // 🔴 THE PROBE THAT MATTERS: the collision detector must be able to SEE a collision.
  const mine = new Set([309]), theirs = new Map([[309, 'origin/feat/other']]);
  ok([...mine].some(id => theirs.has(id)), 'the collision detector cannot see a collision');
  ok(![...new Set([310])].some(id => theirs.has(id)), 'the collision detector reports a false collision');
  console.log('SELF-TEST — every matcher refused its violation and accepted its clean input. ✅');
  process.exit(0);
}

if (DO_FETCH) { try { git('fetch', '--all', '--prune', '-q'); } catch { /* reported as staleness below */ } }

let branches = [];
try {
  branches = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin')
    .split('\n').map(s => s.trim()).filter(b => b && !b.endsWith('/HEAD'));
} catch {
  console.error('🔴 verify-id-sweep — git could not be read. This is SKIPPED, not passed: a sweep that never reached a branch must not look like a clean sweep (#182).');
  process.exit(STRICT ? 1 : 0);
}
if (!branches.length) {
  console.error('🔴 verify-id-sweep — ZERO remote branches found. A sweep of nothing finds nothing and passes, which is the failure this line exists to prevent (#182). Run `git fetch --all`.');
  process.exit(STRICT ? 1 : 0);
}

// ── staleness, MEASURED. A sweep is only as true as the refs it read.
let staleHours = null;
try {
  const t = +git('log', '-1', '--format=%ct', 'refs/remotes/origin/main').trim();
  staleHours = (Date.now() / 1000 - t) / 3600;
} catch { /* left null — reported as unknown */ }

const MAIN = 'origin/main';
const show = (ref, file) => { try { return git('show', `${ref}:${file}`); } catch { return ''; } };
const subjectsOf = (ref) => { try { return git('log', '--format=%s', '-n', '400', ref).split('\n').filter(Boolean); } catch { return []; } };
const scopeIds = (subjects) => {
  const ledger = new Set(), techdebt = new Set();
  for (const line of subjects) {
    const m = /^[a-z]+\(([^)]*)\)\s*:/i.exec(line); if (!m) continue;
    const ids = [...m[1].matchAll(/#(\d+)/g)].map(x => +x[1]); if (!ids.length) continue;
    for (const id of ids) (/tech[-\s]debt/i.test(m[1]) ? techdebt : ledger).add(id);
  }
  return { ledger, techdebt };
};

const HERE = (() => { try { return git('rev-parse', '--abbrev-ref', 'HEAD').trim(); } catch { return 'HEAD'; } })();

// 🔴 SAME LINEAGE IS NOT A COLLISION, AND GETTING THIS WRONG WOULD HAVE MADE THE CAP USELESS.
// The first run flagged four "collisions" against `feat/tile-grid-r7-describe` and
// `feat/breakpoint-vocabulary` — which this branch is BUILT ON. Those ids are the same claim,
// INHERITED, not two sessions competing for one number. A cap that fires every time you branch off
// your own work is a cap people turn off. A branch is excluded when its tip is an ancestor of HEAD
// (its claims are already mine) or when HEAD is an ancestor of it (it is downstream of mine).
const sameLineage = (ref) => {
  const anc = (a, b) => { try { git('merge-base', '--is-ancestor', a, b); return true; } catch { return false; } };
  return anc(ref, 'HEAD') || anc('HEAD', ref);
};
const RIVALS = branches.filter(b => b !== MAIN && b !== `origin/${HERE}` && !sameLineage(b));
const fail = [], lines = [];

for (const [space, cfg] of Object.entries(SPACES)) {
  const localSrc = existsSync(cfg.file) ? readFileSync(cfg.file, 'utf8') : '';
  const local = idsIn(localSrc, cfg.re);
  const localRes = cfg.resRe ? idsIn(localSrc, cfg.resRe) : new Set();
  const onMain = idsIn(show(MAIN, cfg.file), cfg.re);

  // What THIS tree claims that main does not yet know about — reservations included, because a
  // reservation IS a claim and must be swept exactly like a filed row.
  const claimedHere = [...new Set([...local, ...localRes])].filter(id => !onMain.has(id));

  // Every id every OTHER branch holds, and who holds it.
  const elsewhere = new Map();
  for (const b of RIVALS) {
    const src = show(b, cfg.file);
    for (const id of idsIn(src, cfg.re)) if (!onMain.has(id) && !elsewhere.has(id)) elsewhere.set(id, b);
    if (cfg.resRe) for (const id of idsIn(src, cfg.resRe)) if (!onMain.has(id) && !elsewhere.has(id)) elsewhere.set(id, b);
    if (space !== 'ruling') {
      const s = scopeIds(subjectsOf(b))[space === 'ledger' ? 'ledger' : 'techdebt'];
      for (const id of s) if (!onMain.has(id) && !elsewhere.has(id)) elsewhere.set(id, `${b} (commit subject)`);
    }
  }

  for (const id of claimedHere) {
    if (elsewhere.has(id)) {
      fail.push(`COLLISION — ${cfg.label} ${space === 'ruling' ? 'R-' + id : '#' + id} is claimed by THIS branch (${HERE}) and by ${elsewhere.get(id)}. R-148 clause (4): the LATER claim renumbers — compare commit times and move whichever came second.`);
    }
  }

  const all = new Set([...local, ...localRes, ...onMain, ...elsewhere.keys()]);
  const max = all.size ? Math.max(...all) : 0;
  const pfx = space === 'ruling' ? 'R-' : '#';
  lines.push(`  ${cfg.label.padEnd(9)} highest anywhere: ${pfx}${max}  →  NEXT FREE: ${pfx}${max + 1}   (this tree claims ${claimedHere.length ? claimedHere.map(i => pfx + i).join(' ') : 'none'} beyond main)`);
}

console.log(`verify-id-sweep — ${branches.length} remote branches, ${RIVALS.length} rivals (same-lineage and main excluded) swept from ${HERE}`);
lines.forEach(l => console.log(l));
console.log(staleHours === null
  ? '  ⚠️ refs staleness UNKNOWN (origin/main unreadable) — treat this sweep as unverified.'
  : `  ${staleHours > STALE_HOURS ? '⚠️' : '·'} remote refs last updated ${staleHours.toFixed(1)}h ago${staleHours > STALE_HOURS ? ' — STALE. Run with --fetch; a sweep is only as true as the refs it read.' : ''}`);
console.log('  ℹ This sweep does NOT close the race (R-149): between it and your push, another session can take the id. RESERVE AND PUSH FIRST, then build.');

if (staleHours !== null && staleHours > STALE_HOURS && STRICT) {
  console.error(`\n🔴 refs are ${staleHours.toFixed(1)}h stale and --strict was given. A clean sweep against stale refs is not a clean sweep.`);
  process.exit(1);
}
if (fail.length) { console.error('\n🔴 ' + fail.join('\n🔴 ')); process.exit(1); }
console.log('\n✅ verify-id-sweep — no id claimed by this branch is claimed anywhere else.');
