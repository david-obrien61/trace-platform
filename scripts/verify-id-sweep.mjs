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
// 🔴 AND THEN THIS CAP CAUSED ONE (2026-09-12, tech-debt #286, fixed in ledger #314)
//   One day old, run from `main`, it printed `NEXT FREE: #310` in green — while `origin` held
//   `reserve(#310)`, `reserve(#311)` AND a filed `#311` row, and was also two ids behind on tech-debt
//   and one behind on rulings. ONE filtered population was answering TWO questions that need opposite
//   ones; see the block above `highestClaim`. The lesson is not "the filter was wrong" — it was right
//   about inheritance — it is that INHERITANCE IS A PROPERTY OF AN ID, NOT OF A BRANCH, and asking it
//   of a whole branch gave the right answer for collisions and the wrong one for the maximum.
//
// 🔴 WHAT THIS CAP CANNOT DO, STATED SO NOBODY READS MORE INTO A GREEN THAN IS THERE:
//   ① It reads remote-tracking refs, which are as fresh as your last `git fetch`. A stale sweep is a
//      sweep against yesterday, so staleness is MEASURED and REPORTED on every run, and `--strict`
//      makes it fail. It never silently reports a clean sweep against stale refs.
//   ② It cannot close the race. Between this sweep and your push, another session can take the id.
//      That is R-149's whole point and why the answer is RESERVE-AND-PUSH-FIRST, not check-harder.
//   ③ A claim that exists only in an unpushed local branch of another worktree is invisible to
//      everyone, including this. Push the reservation; that is the rule. ⚠️ MEASURED, not theoretical:
//      `#310` was claimed by three commits (`reserve`/`fix`/`docs`) that are reachable from NO ref at
//      all — that session renumbered itself to `#311` and left them orphaned. An orphaned claim is
//      invisible here by design and SHOULD be: it is withdrawn, not held.
//   ④ It compares CLAIMS, never commit TIMES. R-148 clause (4) — the later claim renumbers — needs a
//      human to read two timestamps and decide; this cap names the other holder so that comparison is
//      possible, and deliberately does not perform it. Nothing here moves an id.
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

// 🔴 maxBuffer IS NOT OPTIONAL HERE, AND THE DEFAULT SILENTLY BROKE THIS CAP ON ITS FIRST RUN
// AGAINST `main`. `docs/CLOSE-OUT-LEDGER.md` is 1,049,133 bytes — 25KB over Node's 1MB default —
// so `git show origin/main:<ledger>` threw ENOBUFS, the catch returned '', and an EMPTY READ IS
// INDISTINGUISHABLE FROM A FILE WITH NO ROWS. The cap then believed `main` claimed NOTHING and
// reported 60 ids as unclaimed-on-main while HEAD *was* main. That is #182's class — a check that
// could not reach its target reporting as though it had — inside the cap written to prevent it.
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });

// ── the three id-spaces, each with its own matcher. They are SEPARATE number lines that overlap:
//    `#281` is simultaneously a live ledger id and a live tech-debt id, so they are never merged.
const SPACES = {
  ledger:   { file: 'docs/CLOSE-OUT-LEDGER.md', label: 'close-out', re: /^\| \*\*#(\d+)\*\*/gm,  resRe: /^\| ⏳ \*\*#(\d+) — RESERVED/gmu },
  techdebt: { file: 'docs/tech-debt-log.md',    label: 'tech-debt', re: /^#{2,4} #(\d+)\b/gm,     resRe: null },
  ruling:   { file: 'docs/RULINGS.md',          label: 'ruling',    re: /\*\*R-(\d+)\b/g,         resRe: null },
};
const idsIn = (src, re) => new Set([...src.matchAll(new RegExp(re.source, re.flags))].map(m => +m[1]));

// ============================================================
// 🔴 TWO POPULATIONS, NOT ONE — tech-debt #286, the defect that made this cap hand out taken ids.
//
// Until 2026-09-12 ONE filtered list answered BOTH questions, and they need OPPOSITE populations:
//
//   COLLISION  "is an id I claim also claimed by a session competing with me?"  → rivals
//   NEXT FREE  "what is the highest id claimed ANYWHERE?"                       → EVERY REF
//
// The old `sameLineage()` excluded a ref when `HEAD` is an ancestor of it — i.e. every branch cut
// from current `main` — so RUN FROM `main` IT EXCLUDED EVERY LIVE FEATURE BRANCH: 38 refs collapsed
// to 6 rivals, and `max` was computed over main's rows alone. It printed `NEXT FREE: #310` in green
// while `origin` held `reserve(#310)`, `reserve(#311)` AND a filed `#311` row. `main` is exactly
// where a session that has just merged is standing, so the gate built to stop collisions caused one.
//
// 🔴 AND THE EXCLUSION WAS NOT SIMPLY WRONG, WHICH IS WHY IT CANNOT JUST BE DELETED. Its reason was
// real: a branch built ON my work carries MY claims, and flagging those is a false positive — "a cap
// that fires every time you branch off your own work is a cap people turn off." Deleting the filter
// fixes NEXT FREE and breaks COLLISION.
//
// ✅ THE FIX IS TO ASK THE QUESTION AT THE RIGHT GRAIN: inheritance is a property of an ID, not of a
// BRANCH. An id I claim is the SAME claim as a ref's iff it was already claimed in our SHARED
// HISTORY — at `merge-base(HEAD, ref)`. That is exact in all four directions:
//   · ref is an ANCESTOR of HEAD     → merge-base = ref     → every id it claims is inherited. ✓
//   · ref is DOWNSTREAM of HEAD      → merge-base = HEAD    → ids I claim are inherited, no false
//                                                             positive, which is what the old
//                                                             lineage filter was protecting. ✓
//   · a SIBLING cut from main        → merge-base = main    → main does not claim my id → COLLISION. ✓
//   · I am on `main`, ref downstream → merge-base = main    → a claim in my TREE is not at main
//                                                             → COLLISION, the case that was missed. ✓
// So every ref is swept for BOTH questions, and inheritance is decided per id, lazily, only when a
// claim actually overlaps. The lineage filter is GONE, not loosened.
// ============================================================

// PURE — what a ledger/log FILE claims: filed rows AND reservations, because a reservation is a
// claim. 🔴 THIS EXISTS AS ONE FUNCTION BECAUSE THE TWO SIDES DRIFTED APART ONCE, TODAY. The rival
// side read both matchers and the merge-base (inheritance) side read only filed rows, so an inherited
// RESERVATION read as a collision — a false positive against a branch built on its own reservation
// commit, i.e. exactly what the deleted lineage filter was protecting. Both callers now go through
// here, so the asymmetry cannot be reintroduced by editing one of them.
export const fileClaims = (src, cfg) => new Set([...idsIn(src, cfg.re), ...(cfg.resRe ? idsIn(src, cfg.resRe) : [])]);

// PURE — the two populations, with NO lineage predicate of any kind. The absence is the fix: every
// ref answers NEXT FREE. `rivals` drops only MAIN (ids on main are filtered from `claimedHere`
// upstream, so main can never collide) and this branch's own pushed tip.
export function selectPopulations(branches, { main, hereRemote }) {
  return {
    // `main` is passed as null by the caller now (it is already inside `branches` as `origin/main`,
    // and it is a RIVAL like any other ref — see the caller's note). The parameter is kept so the
    // probes can assert main is never dropped from the maximum.
    all:    [...new Set([...(main ? [main] : []), ...branches])],
    rivals: branches.filter(b => b !== main && b !== hereRemote),
  };
}

// PURE — the highest claim and WHO HOLDS IT. A number with no holder cannot be checked by a reader,
// which is half of why #286 survived a day: `NEXT FREE: #310` named nothing to disagree with.
export function highestClaim(claims) {
  let best = null;
  for (const c of claims) if (!best || c.id > best.id) best = c;
  return best;  // {id, holder} | null
}

// PURE — an id I claim collides when another ref claims it and the claim is NOT inherited.
// 🔴 EVERY holder is named, not the first one found. Learned live: the cap reported this very branch
// colliding with `origin/feat/action-feedback-visibility` and stayed SILENT about `origin/main`, which
// holds the same claim. Naming one arbitrary ref out of several sends the reader hunting for the rest,
// and it hid the single most load-bearing fact about a collision: whether one side has SHIPPED.
// ⚠️ The cap NAMES that and does not rule on it. R-148 clause (4) says the LATER claim renumbers and
// says nothing about the later claim having already reached `main` — which is a live case, not a
// hypothetical (tech-debt #286, 2026-09-12: the earlier claim by 30 minutes is the UNMERGED one).
// Resolving that is David's, so the output states both facts and stops.
export function collisionsOf(mine, held) {
  const out = [];
  for (const id of mine) {
    const refs = held.filter(h => h.id === id && !h.inherited).map(h => h.ref);
    if (refs.length) out.push({ id, refs: [...new Set(refs)] });
  }
  return out;
}

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
  ok(collisionsOf([309], [{ id: 309, ref: 'origin/feat/other', inherited: false }]).length === 1, 'the collision detector cannot see a collision');
  ok(collisionsOf([310], [{ id: 309, ref: 'origin/feat/other', inherited: false }]).length === 0, 'the collision detector reports a false collision');
  // EVERY holder is named. One arbitrary ref out of three sends the reader hunting for the rest, and
  // it hid `origin/main` — the holder that decides who must move — on this cap's own live collision.
  const multi = collisionsOf([286], [
    { id: 286, ref: 'origin/main', inherited: false },
    { id: 286, ref: 'origin/feat/other', inherited: false },
    { id: 286, ref: 'origin/main', inherited: false },
  ]);
  ok(multi.length === 1 && multi[0].refs.length === 2, `a collision named ${multi[0] ? multi[0].refs.length : 0} holder(s); both distinct refs must be named and duplicates folded`);
  ok(multi[0].refs.includes('origin/main'), 'origin/main was dropped from the holder list — the one holder that decides who moves');

  // ══ tech-debt #286's probes. The defect was never in a MATCHER — every matcher above was correct
  // while the cap handed out a taken id. It was in the POPULATION the matchers were run over, and
  // #182 is explicit about what that demands: "the mechanical fix is a mutant that changes the
  // POPULATION, not the subject — none of our 13 do." These four are those mutants. ══

  // P1 · NEXT FREE is derived from EVERY ref. The bug was a filter here; a reintroduced filter drops
  // the count and fails this line. Five branches in → five branches plus main out, always.
  const B = ['origin/main', 'origin/a', 'origin/b', 'origin/c', 'origin/d'];
  const pop = selectPopulations(B, { main: 'origin/main', hereRemote: 'origin/c' });
  ok(pop.all.length === 5, `NEXT FREE population was FILTERED — ${pop.all.length} of 5 refs. This is tech-debt #286 reintroduced: a filtered max is main's max, and the cap hands out a taken id.`);
  ok(pop.all.includes('origin/main'), 'main is missing from the NEXT FREE population — ids filed on main would read as free');
  // P2 · the rival population drops exactly two things and nothing else.
  ok(!pop.rivals.includes('origin/main') && !pop.rivals.includes('origin/c'), 'the rival population kept main or this branch own tip');
  ok(pop.rivals.length === 3, `the rival population dropped too much — ${pop.rivals.length} of an expected 3. A lineage filter here is what made a sweep from main see 6 of 38.`);

  // P3 · the holder is NAMED, not just counted. `NEXT FREE: #310` naming nobody is half of why #286
  // survived a day — a number with no holder gives a reader nothing to disagree with.
  const top = highestClaim([{ id: 7, holder: 'origin/a' }, { id: 311, holder: 'origin/zone' }, { id: 12, holder: 'origin/b' }]);
  ok(top && top.id === 311, 'highestClaim did not find the maximum');
  ok(top && top.holder === 'origin/zone', 'highestClaim lost the HOLDER — an unattributable number cannot be checked');
  ok(highestClaim([]) === null, 'highestClaim did not handle an empty population');

  // P4 · INHERITANCE, BOTH DIRECTIONS — the guard that makes an unfiltered population safe. Removing
  // the lineage filter is only correct because inheritance is decided per id; if this stops working,
  // the cap fires every time someone branches off their own work.
  ok(collisionsOf([312], [{ id: 312, ref: 'origin/downstream', inherited: true }]).length === 0, 'an INHERITED claim was reported as a collision — the false positive the lineage filter used to prevent');
  ok(collisionsOf([312], [{ id: 312, ref: 'origin/sibling', inherited: false }]).length === 1, 'a genuine rival claim was excused as inherited');

  // P5 · THE ASYMMETRY THAT ACTUALLY BIT, caught by running the inheritance probe live rather than
  // reasoning about it. A RESERVATION-only source must read as a claim, because the rival side counts
  // reservations; if one side counts them and the other does not, an inherited reservation reads as a
  // collision. Both sides call `fileClaims`, and this is the line that says so.
  const resOnly = '| ⏳ **#312 — RESERVED 2026-09-12, BUILD IN PROGRESS** | x |\n';
  ok(fileClaims(resOnly, SPACES.ledger).has(312), 'fileClaims misses a RESERVATION — the inheritance read and the rival read have drifted apart again');
  ok(fileClaims('| **#306** | x |\n', SPACES.ledger).has(306), 'fileClaims misses a filed row');
  ok(!fileClaims('see #306 in prose\n', SPACES.ledger).has(306), 'fileClaims counted a bare in-prose mention as a claim');

  console.log('SELF-TEST — every matcher refused its violation and accepted its clean input, and the');
  console.log('            POPULATION probes (P1-P5, tech-debt #286) refused a filtered sweep. ✅');
  process.exit(0);
}

if (DO_FETCH) { try { git('fetch', '--all', '--prune', '-q'); } catch { /* reported as staleness below */ } }

let branches = [];
try {
  branches = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin')
    .split('\n').map(s => s.trim()).filter(b => b && !b.endsWith('/HEAD'));
} catch {
  // FAILS, rather than skipping. An unreadable git in THIS repo is a broken tool, not a legitimate
  // environment — and the first instance was ENOBUFS on an oversized ledger, i.e. exactly the case
  // where passing quietly would hide a real defect. (A fresh clone with no fetched refs is handled
  // separately below and stays lenient.)
  console.error('🔴 verify-id-sweep — git could not be read. FAILING rather than skipping: a sweep that never reached a branch must not look like a clean sweep (#182).');
  process.exit(1);
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
// A read that FAILED must never look like a read that found nothing. A missing file at a ref is
// legitimate (the branch predates it) and returns ''; any OTHER failure is fatal and says so.
const show = (ref, file) => {
  // stderr is PIPED (not ignored) so the failure can be CLASSIFIED. Ignoring it would leave every
  // error looking alike, which is the very thing this helper exists to tell apart.
  try { return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 }); }
  catch (e) {
    const msg = String(e.stderr || e.message || '');
    if (/does not exist|exists on disk, but not in|unknown revision|bad object/i.test(msg)) return '';
    console.error(`🔴 verify-id-sweep — could not read ${ref}:${file} (${e.code || 'error'}). A sweep that cannot read a branch is NOT a clean sweep (#182).`);
    process.exit(2);
  }
};
// `%H %s` rather than `%s`: a subject claim's inheritance is decided by whether THAT COMMIT is
// reachable from HEAD, which needs the sha. Without it the only available test was the branch's
// lineage — the coarse question that produced #286.
const subjectsOf = (ref) => { try { return git('log', '--format=%H %s', '-n', '400', ref).split('\n').filter(Boolean); } catch { return []; } };
const scopeIds = (subjects) => {
  const ledger = new Map(), techdebt = new Map();   // id → sha of the commit that claimed it
  for (const row of subjects) {
    const sp = row.indexOf(' '); if (sp < 0) continue;
    const sha = row.slice(0, sp), line = row.slice(sp + 1);
    const m = /^[a-z]+\(([^)]*)\)\s*:/i.exec(line); if (!m) continue;
    const ids = [...m[1].matchAll(/#(\d+)/g)].map(x => +x[1]); if (!ids.length) continue;
    const bucket = /tech[-\s]debt/i.test(m[1]) ? techdebt : ledger;
    for (const id of ids) if (!bucket.has(id)) bucket.set(id, sha);
  }
  return { ledger, techdebt };
};

const HERE = (() => { try { return git('rev-parse', '--abbrev-ref', 'HEAD').trim(); } catch { return 'HEAD'; } })();

const anc = (a, b) => { try { git('merge-base', '--is-ancestor', a, b); return true; } catch { return false; } };

// ── THE TWO POPULATIONS (see the block above SPACES). NO LINEAGE FILTER ON EITHER. ──
// EVERY ref answers NEXT FREE, including main, including this branch's own lineage. An id claimed
// anywhere is taken, whatever its relationship to me — that is what "taken" means.
// Collisions sweep every ref too; inheritance is decided PER ID at the merge-base, below.
// 🔴 MAIN IS A RIVAL, AND THIS WAS THE SAME DEFECT ONE LAYER OVER — FOUND LIVE, 2026-09-12.
// The first fix still filtered this tree's claims with `!onMain.has(id)`: *anything on main now is
// already mine.* That is true only while your base IS main's tip. Measured the same hour: this branch
// filed tech-debt `#286`, then `main` MOVED and another session filed a DIFFERENT `#286` on it
// (*"a NEXT FREE ID declaration cached in a file goes stale"*, ledger #308). A real collision, two
// defects under one number — and the cap could not see it, because the id was "on main".
// `onMain-now` is a per-BRANCH proxy for a per-ID question, which is #286's own shape. So main joins
// the rival population and inheritance from it is decided at `merge-base(HEAD, main)` like every other
// ref: if main gained the id after you branched, it is a COLLISION, not an inheritance.
const { all: ALL_REFS, rivals: RIVAL_REFS } = selectPopulations(branches, { main: null, hereRemote: `origin/${HERE}` });

// Inheritance, cached by the merge-base commit rather than by the ref: nearly every branch here
// shares one merge-base (`main`), so 38 refs cost one read of a 1MB ledger, not 38.
const mbCache = new Map();
const mergeBaseOf = (ref) => {
  if (!mbCache.has(ref)) {
    let mb = null;
    try { mb = git('merge-base', 'HEAD', ref).trim() || null; } catch { mb = null; }  // unrelated histories → nothing shared
    mbCache.set(ref, mb);
  }
  return mbCache.get(ref);
};
const baseIdsCache = new Map();
// 🔴 BOTH MATCHERS, AND THE NEGATIVE CONTROL CAUGHT THIS. The first draft read the merge-base with
// `cfg.re` alone — FILED rows only — so an inherited RESERVATION was invisible and the cap reported a
// false COLLISION against a branch built on its own reservation commit. That is precisely the false
// positive the deleted lineage filter existed to prevent, reintroduced by a narrower read, and it was
// found by running the inheritance probe rather than by reasoning about it (§6 r19 / R-33: a check
// nobody has watched refuse is a claim). A reservation IS a claim on the rival side, so it must be a
// claim on the inheritance side too — asymmetry between the two reads IS the defect.
const idsAtBase = (mb, space, cfg) => {
  const k = `${mb}::${space}`;
  if (!baseIdsCache.has(k)) {
    baseIdsCache.set(k, fileClaims(mb ? show(mb, cfg.file) : '', cfg));
  }
  return baseIdsCache.get(k);
};

// Read each ref ONCE per space, and its subjects ONCE per ref — the old loop called `subjectsOf`
// twice for every rival (once for ledger, once for tech-debt) on a list it had already shrunk to six.
const subjCache = new Map();
const subjectIdsOf = (ref) => {
  if (!subjCache.has(ref)) subjCache.set(ref, scopeIds(subjectsOf(ref)));
  return subjCache.get(ref);
};

const fail = [], lines = [];

for (const [space, cfg] of Object.entries(SPACES)) {
  const localSrc = existsSync(cfg.file) ? readFileSync(cfg.file, 'utf8') : '';
  const local = idsIn(localSrc, cfg.re);
  const localRes = cfg.resRe ? idsIn(localSrc, cfg.resRe) : new Set();
  // What THIS tree claims that our SHARED HISTORY WITH MAIN does not already hold — reservations
  // included, because a reservation IS a claim and must be swept exactly like a filed row.
  // NOT `!onMain.has(id)`: see the note above `selectPopulations`'s call. An id main acquired AFTER
  // you branched is a rival's claim, not your inheritance.
  const sharedWithMain = idsAtBase(mergeBaseOf(MAIN), space, cfg);
  const claimedHere = [...new Set([...local, ...localRes])].filter(id => !sharedWithMain.has(id));

  // ── POPULATION 1 · NEXT FREE — every ref, nothing filtered, each claim carrying its holder.
  const allClaims = [];
  for (const id of local)    allClaims.push({ id, holder: `this tree (${HERE})` });
  for (const id of localRes) allClaims.push({ id, holder: `this tree (${HERE}, reserved)` });
  for (const ref of ALL_REFS) {
    const src = show(ref, cfg.file);
    for (const id of idsIn(src, cfg.re)) allClaims.push({ id, holder: ref });
    if (cfg.resRe) for (const id of idsIn(src, cfg.resRe)) allClaims.push({ id, holder: `${ref} (reserved)` });
    if (space !== 'ruling') {
      const m = subjectIdsOf(ref)[space === 'ledger' ? 'ledger' : 'techdebt'];
      for (const id of m.keys()) allClaims.push({ id, holder: `${ref} (commit subject)` });
    }
  }

  // ── POPULATION 2 · COLLISIONS — every rival ref, inheritance decided PER ID.
  const held = [];
  for (const ref of RIVAL_REFS) {
    const src = show(ref, cfg.file);
    const fileIds = fileClaims(src, cfg);
    const subjIds = space === 'ruling' ? new Map() : subjectIdsOf(ref)[space === 'ledger' ? 'ledger' : 'techdebt'];
    // Only ids I actually claim are worth the inheritance test — so the merge-base read happens
    // lazily, on overlap, and a clean sweep costs none of it.
    for (const id of claimedHere) {
      if (fileIds.has(id)) {
        // A FILE claim is inherited iff it was already in the file at our shared history.
        const inherited = idsAtBase(mergeBaseOf(ref), space, cfg).has(id);
        held.push({ id, ref, inherited, via: 'row' });
      } else if (subjIds.has(id)) {
        // A SUBJECT claim is inherited iff the claiming COMMIT is reachable from HEAD. Exact, and
        // it is the test the old lineage filter was approximating with a whole-branch guess.
        const inherited = anc(subjIds.get(id), 'HEAD');
        held.push({ id, ref: `${ref} (commit subject)`, inherited, via: 'subject' });
      }
    }
  }

  for (const c of collisionsOf(claimedHere, held)) {
    const onMainToo = c.refs.some(r => r.startsWith(MAIN));
    fail.push(`COLLISION — ${cfg.label} ${space === 'ruling' ? 'R-' + c.id : '#' + c.id} is claimed by THIS branch (${HERE}) and by: ${c.refs.join(' · ')}`
      + `\n         R-148 clause (4): the LATER claim renumbers — compare commit times with`
      + `\n           git log --all --reflog --pretty='%cI %h %s' | grep -- '#${c.id}' | sort`
      + (onMainToo ? `\n         🔴 ONE HOLDER IS ${MAIN} — that claim has SHIPPED. Clause (4) ranks by TIME and says nothing`
                   + `\n            about a later claim that already merged, so if yours is the EARLIER one this is a`
                   + `\n            question for David, not a mechanical renumber. The cap names it and does not rule on it.` : '')
      + `\n         This cap never moves an id.`);
  }

  const top = highestClaim(allClaims);
  const max = top ? top.id : 0;
  const pfx = space === 'ruling' ? 'R-' : '#';
  const inherited = held.filter(h => h.inherited).length;
  lines.push(`  ${cfg.label.padEnd(9)} highest anywhere: ${pfx}${max}  →  NEXT FREE: ${pfx}${max + 1}`);
  lines.push(`            held by: ${top ? top.holder : '(nothing claimed anywhere)'}`);
  lines.push(`            this tree claims ${claimedHere.length ? claimedHere.map(i => pfx + i).join(' ') : 'none'} beyond main${inherited ? ` · ${inherited} overlapping claim(s) INHERITED at the merge-base, not collisions` : ''}`);
}

console.log(`verify-id-sweep — ${branches.length} remote branches swept from ${HERE}: ${ALL_REFS.length} refs for NEXT FREE (nothing filtered), ${RIVAL_REFS.length} for collisions (inheritance decided per id at the merge-base — tech-debt #286)`);
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
