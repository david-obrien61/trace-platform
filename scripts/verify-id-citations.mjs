#!/usr/bin/env node
// ============================================================
// verify-id-citations — A TECH-DEBT ID CITED SOMEWHERE AND FILED NOWHERE FAILS THE BUILD
// PURPOSE:      Four times on 2026-09-10 a tech-debt number was claimed that was already taken, or
//               cited in prose and never filed: #195 → #213 → #288(e) → #242-246 (this session's
//               own recon cited 237-241, all five already owned by a parallel session). The cause is
//               always the same and it is NOT carelessness: an id is claimed by ARITHMETIC ("the log
//               ends at N, so mine is N+1") in a repo where several sessions run at once, and nothing
//               re-checks between the claim and the write.
// THE RULE:     TWO assertions, both directions.
//               A — NO DUPLICATE ROWS. Two `## #N` headings with the same id is a collision that has
//                   already happened; the later one silently overwrites the earlier in every reader's
//                   mind.
//               B — NO NET-NEW DANGLING CITATION. Every id cited as tech-debt in a WATCHED doc should
//                   have a row in docs/tech-debt-log.md. A number in a handoff with nothing behind it
//                   is the defect that sent David hunting for #223/#231/#232 and found nothing.
// 🔴 B IS A RATCHET, NOT A GATE, AND THE MEASUREMENT IS WHY. The first run of this cap reported
//               **~200 dangling citations** — the log holds 49 rows and the four watched docs cite
//               over two hundred ids. The backlog is real and it is not tonight's doing; CLAUDE.md has
//               said so three times ("the log stops at 185", "stopped at 209"). A cap that fails every
//               build on a 200-item backlog gets commented out within a day, and `verify-write-paths`
//               already learned this out loud: *"a gate that blocks every build gets worked around, and
//               a worked-around gate is worse than none."* So: the backlog is BASELINED and stays
//               VISIBLE in every run's output, and the build fails only on an id that is cited TODAY
//               and filed NOWHERE. That is the defect tonight produced four times.
// 🔴 THE HARD PART IS DISAMBIGUATION, AND IT IS WHY THIS IS NOT A ONE-LINE GREP:
//               the tech-debt log and docs/CLOSE-OUT-LEDGER.md share a NUMBER SPACE. Build #242 and
//               tech-debt #242 are different things that both exist. A naive `#242` grep reports the
//               ledger's build ids as dangling tech-debt citations — measured: it produced twelve
//               false positives the first time this was written. So clause B matches ONLY an id
//               carrying an explicit tech-debt marker ("tech-debt #N", "tech debt #N") and ignores
//               bare `#N`, which is ambiguous by construction. A cap that cries wolf gets disabled.
// DEPENDENCIES: none (node stdlib).
// OUTPUTS:      exit 0 clean · exit 1 a violation (named) · exit 2 the cap's own probes failed.
// USAGE:        npm run verify:id-citations        — assert
//               node scripts/verify-id-citations.mjs --self-test   — watch each check refuse
// ============================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LOG = 'docs/tech-debt-log.md';
const LEDGER = 'docs/CLOSE-OUT-LEDGER.md';
const BASELINE = 'id-citations-baseline.json';
const UPDATE = process.argv.includes('--update');
// Watched docs: where an id gets CITED. Deliberately narrow — the places a number is claimed.
const WATCHED = ['CLAUDE.md', 'docs/CLOSE-OUT-LEDGER.md', 'docs/built-inventory.md', 'docs/RULINGS.md'];
const SELF_TEST = process.argv.includes('--self-test');

// A row in the log. DERIVED from the formats the log actually uses, and it took TWO corrections to
// get right — recorded because each one is the cap's own subject:
//   ① first version matched only `## #N` → 40 rows in a file holding 49, missing the 7 `### #N`
//      rows, which inflated the dangling count.
//   ② widening to `**#N` then produced a FALSE DUPLICATE on #211 — both `**#N` line-starts in the
//      log are bolded PROSE mid-sentence (`**#211 is #280's …`), never rows. A cap that cries wolf
//      gets disabled, which this file's own header says. `**#` is NOT a row format; dropped.
// The discriminator both real formats share is the em-dash after the id. Matching it, not guessing.
const ROW_RE = /^#{2,3} #(\d+)\s+[—–-]/gm;
const rowIds = (src) => [...src.matchAll(ROW_RE)].map(m => +m[1]);

// A tech-debt CITATION. Requires the marker; a bare `#NNN` is ambiguous (see header) and is skipped.
// Tolerates the markdown this repo actually writes: `tech-debt **#195**`, `tech debt #58`, `tech-debt
// log #12`, and comma/en-dash runs like `tech-debt #143–#145` / `#237-#241`.
const citedIds = (src) => {
  const out = new Set();
  // 🔴 A BARE NUMBER MAY ONLY CONTINUE A RANGE (after – — - through to). After a LIST separator
  // (, · and) the next id must carry its own `#`. The first version accepted `#?` after any separator,
  // so `tech-debt **#253–#259** · 8 David actions` read the 8 as tech-debt #8 — a false NET-NEW that
  // failed `npm run verify` for every session on 2026-09-11, and was committed past because the
  // close-out printed the red and did not stop on it. Probe below.
  const re = /tech[-\s]debt(?:\s+log)?\s*((?:\*\*)?#\d+(?:\*\*)?(?:\s*(?:(?:–|—|-|through|to)\s*(?:\*\*)?#?\d+|(?:[,·]|and)\s*(?:\*\*)?#\d+)(?:\*\*)?)*)/gi;
  for (const m of src.matchAll(re)) for (const n of m[1].matchAll(/\d+/g)) out.add(+n[0]);
  return out;
};

// ── C's matcher — a REAL close-out row. `| **#307** | …` ────────────────────────────────────────
// ⏳ rows are EXCLUDED and the distinction is load-bearing: a `⏳ … RESERVED` row is a CLAIM that the
// real row is inbound on a branch (R-149), and a `⏳ #302 — WHY THIS ROW WAS LATE` commentary row is
// neither. Counting either as a filing would make a correctly-reserved id look like a duplicate of
// itself, which would teach sessions to stop reserving — the exact behaviour R-149 exists to produce.
const ledgerRowIds = (src) => [...src.matchAll(/^\| \*\*#(\d+)\*\*/gm)].map(m => +m[1]);
/* ──────────────────────────────────────────────────────────────────────────────
   CLAUSE E — A LEDGER ROW WHOSE CELL COUNT EXCEEDS THE HEADER (tech-debt #294a).

   🔴 BACKTICKS DO NOT PROTECT A PIPE. GFM's table extension splits a row into
   cells BEFORE inline parsing runs, so `a | b` is TWO cells, not one code span.
   A row with MORE cells than the header has the excess **ignored by the spec** —
   no error, no warning, no visual tell. The content is in the file forever and
   on the screen never, and what goes missing is the LAST cell: `Blocker`.

   🔴 IT RECURS BY CONSTRUCTION, WHICH IS THE ARGUMENT FOR A CAP RATHER THAN CARE.
   Ledger #320 made the close-out row the permanent home for every close-out's
   proof narrative — moved there precisely because the row is the copy nothing
   has to cut. Close-out narrative is exactly the prose that contains shell
   pipelines. #317's live instance is `find api -name '*.ts' | wc -l`, a command
   this repo runs constantly, written into a row by a session doing everything
   right.

   🔴 AND IT RECURRED INSIDE THE SESSION THAT FILED IT. Writing #320's Blocker
   cell, that session typed "Cause: an unescaped `|` inside inline code" WITH THE
   PIPE UNESCAPED — the sentence describing the defect committed it, split row
   #320, and discarded the cell holding its own conclusion. It was pushed to
   `main` in that state. The author had filed the item and specified this very
   check within the same hour. Knowing about it is not protection against it.

   ⚠️ ONE DIRECTION ONLY, DELIBERATELY. `cells > header` REFUSES; `cells < header`
   does not. A short row is padded by the spec and loses nothing, and 25 rows are
   short today — failing on those would make this cap RED ON ARRIVAL, which is the
   state a cap does not survive (tech-debt #73: a gap list that only grows stops
   being read). Normalising the short rows is #294's separate, human decision.

   ⚠️ COUNT ON UNESCAPED PIPES. `\|` is the legitimate escape and rows #304 and
   #313 use it correctly in prose. The first measurement of #294 counted raw `|`,
   reported 34 rows instead of 29, and condemned those two — a cap that cries wolf
   teaches people to ignore it.
   ────────────────────────────────────────────────────────────────────────────── */
const UNESCAPED_PIPE = /(?<!\\)\|/;
const cellCount = (line) => line.split(UNESCAPED_PIPE).length - 2;
/** The close-out table's header, so the width is DERIVED and never a written 7. */
const ledgerHeaderWidth = (src) => {
  const h = src.split('\n').find(l => /^\| # \| Work item \|/.test(l));
  return h ? cellCount(h) : null;
};
/** The first unescaped `|` sitting inside a single-backtick span — the usual culprit. */
const pipeInCode = (line) => {
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '`') inCode = !inCode;
    else if (c === '|' && inCode && line[i - 1] !== '\\') return line.slice(Math.max(0, i - 40), i + 40);
  }
  return null;
};
/** Rows the close-out table owns: a filed row, or an open reservation. Both are table rows. */
const LEDGER_ANY_ROW = /^\| (?:\*\*#(\d+)\*\*|⏳ \*\*#(\d+))/u;
const rowShapeViolations = (src) => {
  const width = ledgerHeaderWidth(src);
  if (width === null) return { width: null, violations: [] };
  const violations = [];
  for (const line of src.split('\n')) {
    const m = LEDGER_ANY_ROW.exec(line);
    if (!m) continue;
    const n = cellCount(line);
    if (n <= width) continue;
    const cells = line.split(UNESCAPED_PIPE);
    violations.push({
      id: m[1] ?? m[2],
      cells: n,
      // What GFM throws away: everything past the header's width.
      discarded: cells.slice(width + 1, -1).join(' | ').trim(),
      culprit: pipeInCode(line),
    });
  }
  return { width, violations };
};

const ledgerReservedIds = (src) => [...src.matchAll(/^\| ⏳ \*\*#(\d+) — RESERVED/gmu)].map(m => +m[1]);

// ── D's matcher — an id claimed in a COMMIT SUBJECT. `feat(#305): …` / `docs(tech-debt #280): …` ──
// This is the space NOTHING has ever watched, and it is where #304 was claimed twice (9fd1d15 at
// 12:52:10 and 161e7a6 at 12:56:45, 4m35s apart) while no file the next session reads showed either.
// The CLAIM SITE is the conventional-commit SCOPE — the `(...)` before the colon — and nothing else.
// A bare `#305` in the prose of a subject is a REFERENCE, not a claim. Which log a claim belongs to
// is decided by the marker INSIDE the scope, because the two id-spaces overlap: `#281` is
// simultaneously a live ledger id and a live tech-debt id.
const subjectIds = (subjects) => {
  const ledger = new Set(), techdebt = new Set();
  for (const line of subjects) {
    const scope = /^[a-z]+\(([^)]*)\)\s*:/i.exec(line);
    if (!scope) continue;
    const ids = [...scope[1].matchAll(/#(\d+)/g)].map(m => +m[1]);
    if (!ids.length) continue;
    const target = /tech[-\s]debt/i.test(scope[1]) ? techdebt : ledger;
    for (const id of ids) target.add(id);
  }
  return { ledger, techdebt };
};
/** Commit subjects reachable from HEAD **or from `origin/main`**. Returns null when git cannot
 *  answer — NEVER an empty list, because "no claims found" and "could not look" must not report the
 *  same (#182).
 *
 *  🔴 THE UNION IS THE POINT, AND IT WAS FOUND BY THIS CLAUSE FAILING TO SEE ITS OWN TEST CASE.
 *  `#304` is claimed by `eb4aad6 fix(#304)` on `main` with no `#304` row there — the live instance
 *  this clause was written for. On a branch that forked BEFORE that commit it is not reachable from
 *  HEAD, so the clause reported clean while the defect sat on `main`. Reading only HEAD would make
 *  every branch's answer depend on where it forked, which is the one-tree blindness this whole pass
 *  is about. `main` is where the claim ultimately has to be true, so `main` is always in scope. */
const headSubjects = () => {
  const run = (revs) => execFileSync('git', ['log', '--format=%s', '-n', '2000', ...revs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 }).split('\n').filter(Boolean);
  try {
    try { return run(['HEAD', 'origin/main']); }
    catch { return run(['HEAD']); }   // no origin/main here (a fresh clone, a detached CI checkout)
  } catch { return null; }
};

const fail = [];
const note = [];

// ── the cap's own probes (STD-022): each check is shown refusing a crafted violation ──
{
  const dupes = rowIds('## #7 — a\n## #7 — b\n');
  if (new Set(dupes).size === dupes.length) { console.error('CAP PROBE FAILED: duplicate detection cannot see a duplicate'); process.exit(2); }
  if (!citedIds('tech-debt #99').has(99)) { console.error('CAP PROBE FAILED: citation regex misses the plain form'); process.exit(2); }
  if (!citedIds('tech-debt **#143**–**#145**').has(145)) { console.error('CAP PROBE FAILED: citation regex misses a bold range'); process.exit(2); }
  // 🔴 THE NEGATIVE CONTROL THAT MATTERS — a bare id must NOT be read as a tech-debt citation, or
  // every CLOSE-OUT-LEDGER build number becomes a false violation.
  if (citedIds('| #242 | a build row').size !== 0) { console.error('CAP PROBE FAILED: a bare #N was read as a tech-debt citation — this is the false-positive that disables caps'); process.exit(2); }
  if (citedIds('see #195 above').size !== 0) { console.error('CAP PROBE FAILED: unmarked #N treated as a citation'); process.exit(2); }
  // 🔴 NEGATIVE CONTROL — the exact committed sentence that produced the false #8.
  { const got = [...citedIds('tech-debt **#253–#259** · 8 David actions on the story board.')].sort((a, b) => a - b);
    if (JSON.stringify(got) !== JSON.stringify([253, 259])) { console.error(`CAP PROBE FAILED: a bare number after a list separator was read as a citation (got ${JSON.stringify(got)})`); process.exit(2); } }
  // …and the forms that MUST still parse after the tightening.
  if (!citedIds('tech-debt #143–145').has(145)) { console.error('CAP PROBE FAILED: a bare number after a range dash no longer continues the range'); process.exit(2); }
  if (!citedIds('tech-debt #231, #232 and #233').has(233)) { console.error('CAP PROBE FAILED: a #-marked id after a list separator is no longer read'); process.exit(2); }
  if (rowIds('### #7 — a sub-heading row').length !== 1) { console.error('CAP PROBE FAILED: a ### row is not counted — correction ① above'); process.exit(2); }
  // 🔴 NEGATIVE CONTROL FOR CORRECTION ② — the exact line that produced the false #211 duplicate.
  if (rowIds('**#211 is #280\'s "a declarative comment" **, filed hours earlier').length !== 0) { console.error('CAP PROBE FAILED: bolded prose at line start read as a row — the false-positive this cap already made once'); process.exit(2); }
  if (rowIds('see ## #7 mid-sentence').length !== 0) { console.error('CAP PROBE FAILED: an id not at line start counted as a row'); process.exit(2); }
  if (rowIds('## #7 no dash here').length !== 0) { console.error('CAP PROBE FAILED: the em-dash discriminator is not being applied'); process.exit(2); }
  // ── CLAUSE E's probes (tech-debt #294a). P1 is the real defect verbatim (STD-024). ──
  {
    const HDR = '| # | Work item | Deliverable (one line) | Commit / SHA | Bar | Owner-proof owed (exact live test) | Blocker |\n';
    const shape = (row) => rowShapeViolations(HDR + row + '\n').violations;
    // P1 🔴 THE REAL DEFECT — #317's row, verbatim in shape: a shell pipe in inline code.
    const p1 = shape('| **#317** | a | b | c | d | run `find api -name \'*.ts\' | wc -l` here | FIVE OPEN QUESTIONS |');
    if (p1.length !== 1) { console.error('CAP PROBE FAILED (E/P1): a shell pipe inside inline code did not split the row — the real defect is invisible'); process.exit(2); }
    if (!p1[0].discarded.includes('FIVE OPEN QUESTIONS')) { console.error('CAP PROBE FAILED (E/P1): the DISCARDED cell is not reported — "row has 8 cells" tells a reader nothing'); process.exit(2); }
    if (!p1[0].culprit || !p1[0].culprit.includes('wc -l')) { console.error('CAP PROBE FAILED (E/P1): the culprit pipe inside backticks is not named'); process.exit(2); }
    // P2 — the SAME row with the pipe escaped must PASS. Without this, P1 could be a check that refuses everything.
    if (shape('| **#317** | a | b | c | d | run `find api -name \'*.ts\' \\| wc -l` here | FIVE OPEN QUESTIONS |').length !== 0) { console.error('CAP PROBE FAILED (E/P2): an ESCAPED pipe still counted — the fix would not clear the cap'); process.exit(2); }
    // P3 — 🔴 the false positive that disables caps: `\|` used legitimately in prose (#304/#313).
    if (shape('| **#304** | a | grep for `recipient\\|segment\\|mailing` | c | d | e | f |').length !== 0) { console.error('CAP PROBE FAILED (E/P3): a legitimately escaped pipe was condemned — this is the 34-vs-29 miscount that cries wolf'); process.exit(2); }
    // P4 — a SHORT row passes. 25 exist today; failing them makes the cap red on arrival (#73).
    if (shape('| **#318** | merged work and deliverable | c | d | e | f |').length !== 0) { console.error('CAP PROBE FAILED (E/P4): a six-cell row was refused — one direction only, or the cap arrives red'); process.exit(2); }
    // P5 — the header is never evaluated against itself.
    if (rowShapeViolations(HDR).violations.length !== 0) { console.error('CAP PROBE FAILED (E/P5): the header row was evaluated as a row'); process.exit(2); }
    // P6 — a ⏳ RESERVED row is still a table row; reserving does not exempt the shape.
    if (shape('| ⏳ **#323 — RESERVED** | a | b | c | d | run `a | b` | e |').length !== 1) { console.error('CAP PROBE FAILED (E/P6): a RESERVED row with a stray pipe was not checked'); process.exit(2); }
    // P7 🔴 NEGATIVE CONTROL — changes the POPULATION, not the subject (#182's own unmet prescription).
    //    No header at all must report width:null and examine nothing, NOT pass as though it had looked.
    if (rowShapeViolations('| **#1** | a | b | c | d | e | f | g | h |\n').width !== null) { console.error('CAP PROBE FAILED (E/P7): a file with no header was given a width — "I never looked" must not render as "clean"'); process.exit(2); }
    // P8 — an unescaped pipe OUTSIDE backticks is the same defect; backticks are only the commonest cause.
    if (shape('| **#9** | a | b | c | d | a bare | pipe | e |').length !== 1) { console.error('CAP PROBE FAILED (E/P8): an extra cell from a bare pipe was missed'); process.exit(2); }
  }
}

// ③ CORRECTION 2026-09-11 (ledger #301) — THE LOG'S OLDER ENTRIES ARE TABLE ROWS, AND ROW_RE COULD NOT SEE
//    ONE. `| 139 | 🟡 **THE DAY SHEET …** |` sits at docs/tech-debt-log.md:282, yet `tech-debt #139` read as
//    DANGLING — and #108 and #140 were baselined as "cited-but-unfiled" for the same reason. The cap was
//    reporting FILED rows as unfiled: a check that could not reach its target (R-33, tech-debt #182's class).
//    Table rows count as FILED for clause B only. Clause A stays on headings: the two formats were never
//    meant to be unique across each other. The discriminator is the status marker or bold that opens every
//    real row's second cell, so a numeric cell in some other table is not mistaken for a filing.
const TABLE_ROW_RE = /^\| (\d+) \| (?:🟡|🔴|🟢|✅|⚠️|\*\*|~~)/gmu;
const filedIds = (src) => new Set([...rowIds(src), ...[...src.matchAll(TABLE_ROW_RE)].map(m => +m[1])]);
if (!filedIds('| 139 | 🟡 **THE DAY SHEET** | x |').has(139)) { console.error('CAP PROBE FAILED: a legacy table row is not counted as filed — correction ③'); process.exit(2); }
if (filedIds('| 3 | 4 | a count in some other table |').has(3)) { console.error('CAP PROBE FAILED: a numeric table cell with no status marker was counted as a filing'); process.exit(2); }
if (filedIds('see | 139 | 🟡 mid-line').has(139)) { console.error('CAP PROBE FAILED: a table row not at line start was counted as a filing'); process.exit(2); }
if (rowIds('| 139 | 🟡 **x** |').length !== 0) { console.error('CAP PROBE FAILED: a table row leaked into clause A\'s duplicate check'); process.exit(2); }
// ⬆️ MOVED UP 2026-09-14 (ledger #329): `filedIds` is now read by the next-free arithmetic below,
//    which runs earlier than clause B did. Definition and probes travel together, unchanged.

// 🔴 CORRECTION 2026-09-14 (ledger #329) — THE NEXT-FREE NUMBER WAS COMPUTED OVER ONE OF THE LOG'S
//    TWO ROW FORMATS, SO IT HANDED OUT IDS THAT WERE ALREADY TAKEN.
//    `rowIds` reads `## #N` headings; correction ③ below already established that the log ALSO holds
//    legacy TABLE rows (`| 139 | 🟡 **…**`) and that those are real filings — `filedIds` unions both,
//    and clause B has counted them since 2026-09-11. **The next-free arithmetic never did.**
//    MEASURED THE DAY THIS WAS FIXED: the log held table rows `| 295 |`…`| 298 |` and this cap printed
//    *"max #294 → NEXT FREE: #299"*, i.e. it pointed the next session at an id four rows deep in the
//    same file. That is not hypothetical — it is how tech-debt **#290/#291/#292** came to be claimed
//    TWICE, once as table rows on `feat/delivery-day-load-list` and once as headings on `main`, both on
//    2026-09-12, with every id cap green on both sides. The renumber cost a session.
//    ⚠️ **SCOPE, STATED: only the REPORTED next-free number is corrected here.** Clause A's DUPLICATE
//    check still reads headings alone, and that is left deliberately — its own comment says *"the two
//    formats were never meant to be unique across each other"*, and changing it is a decision about the
//    log's shape rather than a defect fix. **So a heading and a table row sharing one id still passes.**
//    Filed as tech-debt **#303** with the measurement; David rules.
const nextFreeFor = (src) => { const v = [...filedIds(src)]; return (v.length ? Math.max(...v) : 0) + 1; };

if (SELF_TEST) {
  console.log('SELF-TEST — each check, shown refusing a crafted violation then accepting a clean input:\n');
  const a1 = rowIds('## #7 — a\n## #7 — b\n'); const a1dup = a1.length !== new Set(a1).size;
  console.log(`  A duplicate rows     — violation: ${a1dup ? '✅ caught' : '🔴 MISSED'} · clean: ${rowIds('## #7 — a\n## #8 — b\n').length === 2 ? '✅ accepted' : '🔴 rejected'}`);
  // ── C's probes — a duplicate ledger row is seen, and a reservation is NOT a duplicate ──
  if (new Set(ledgerRowIds('| **#7** | a |\n| **#7** | b |\n')).size === 2) { console.error('CAP PROBE FAILED: duplicate ledger rows not seen'); process.exit(2); }
  if (ledgerRowIds('| ⏳ **#7 — RESERVED 2026-09-12** | x |\n').length !== 0) { console.error('CAP PROBE FAILED: a RESERVED row was counted as a real ledger row — reserving would look like colliding'); process.exit(2); }
  if (ledgerRowIds('| ⏳ **#302 — WHY THIS ROW WAS LATE** | x |\n').length !== 0) { console.error('CAP PROBE FAILED: a ⏳ commentary row was counted as a real ledger row'); process.exit(2); }
  if (ledgerReservedIds('| ⏳ **#7 — RESERVED 2026-09-12** | x |\n')[0] !== 7) { console.error('CAP PROBE FAILED: a RESERVED row is not recognised as a reservation'); process.exit(2); }
  if (ledgerRowIds('see | **#7** | mid-line').length !== 0) { console.error('CAP PROBE FAILED: a ledger row not at line start was counted'); process.exit(2); }
  // ── D's probes — a commit-subject claim is seen, prose is not, and the two id-spaces are split ──
  if (!subjectIds(['feat(#305): the breakpoint vocabulary']).ledger.has(305)) { console.error('CAP PROBE FAILED: a commit-subject claim is invisible'); process.exit(2); }
  if (!subjectIds(['docs(tech-debt #280): pushed is not shipped']).techdebt.has(280)) { console.error('CAP PROBE FAILED: a tech-debt-marked scope is not routed to the tech-debt space'); process.exit(2); }
  if (subjectIds(['docs(tech-debt #280): x']).ledger.size !== 0) { console.error('CAP PROBE FAILED: a tech-debt claim leaked into the ledger space — the id-spaces overlap and must not be merged'); process.exit(2); }
  if (subjectIds(['fix: repair the #305 handling']).ledger.size !== 0) { console.error('CAP PROBE FAILED: a bare in-prose #N was read as a subject CLAIM — only the scope form is a claim'); process.exit(2); }
  if (headSubjects() === null) note.push('git could not be read — clause D will report SKIPPED rather than passing silently (#182)');
  const b1 = citedIds('tech-debt #9001').has(9001);
  console.log(`  B dangling citation  — violation: ${b1 ? '✅ caught' : '🔴 MISSED'} · clean: ${citedIds('| #9001 | build row').size === 0 ? '✅ accepted (bare id ignored)' : '🔴 false positive'}`);
  const c1 = new Set(ledgerRowIds('| **#7** | a |\n| **#7** | b |\n')).size === 1;
  const d1 = subjectIds(['feat(#9002): x']).ledger.has(9002);
  console.log(`  C duplicate ledger   — violation: ${c1 ? '✅ caught' : '🔴 MISSED'} · clean: ${ledgerRowIds('| ⏳ **#7 — RESERVED 2026-09-12** |').length === 0 ? '✅ accepted (a reservation is not a duplicate)' : '🔴 false positive'}`);
  console.log(`  D subject claim      — violation: ${d1 ? '✅ caught' : '🔴 MISSED'} · clean: ${subjectIds(['fix: touch the #9002 path']).ledger.size === 0 ? '✅ accepted (bare id ignored)' : '🔴 false positive'}`);
  const HDR_E = '| # | Work item | Deliverable (one line) | Commit / SHA | Bar | Owner-proof owed (exact live test) | Blocker |\n';
  const e1 = rowShapeViolations(HDR_E + '| **#317** | a | b | c | d | `x | y` | DROPPED |\n').violations.length === 1;
  // 🔴 THE BACKSLASH MUST SURVIVE INTO THE STRING. Written as '\|' in JS source the
  // escape is dropped by the language and the checker sees a bare pipe — which is
  // exactly what this line did on its first run, and the probe caught it.
  const e2 = rowShapeViolations(HDR_E + '| **#317** | a | b | c | d | `x \\| y` | KEPT |\n').violations.length === 0;
  console.log(`  E ledger row shape   — violation: ${e1 ? '✅ caught' : '🔴 MISSED'} · clean: ${e2 ? '✅ accepted (an escaped pipe is legitimate)' : '🔴 false positive'}`);

  // F — 🔴 THE NEXT-FREE NUMBER COUNTS BOTH ROW FORMATS (ledger #329).
  // This is REPORTED, never asserted, so no clause can fail on it — which is precisely why it went
  // wrong unnoticed and handed out an id four rows deep in its own file. The probe is the only thing
  // that can disagree with it. Both directions: a log whose highest row is a TABLE row must not
  // report that row as free, and a log whose highest row is a HEADING must still work.
  const fTable   = nextFreeFor('## #7 — a heading row\n| 9 | 🟡 **a table row** | x |\n') === 10;
  const fHeading = nextFreeFor('| 3 | 🟡 **a table row** | x |\n## #7 — a heading row\n')  === 8;
  // The negative control: a numeric cell in some ordinary table is NOT a filing and must not
  // inflate the number — the same discriminator correction ③ relies on.
  const fNoise   = nextFreeFor('## #7 — a heading row\n| 4 | 12 | a count in some other table |\n') === 8;
  console.log(`  F next-free id       — table row counted: ${fTable ? '✅' : '🔴 MISSED — hands out a taken id'} · heading still counted: ${fHeading ? '✅' : '🔴 MISSED'} · plain numeric cell ignored: ${fNoise ? '✅' : '🔴 false positive'}`);
  process.exit(0);
}

if (!existsSync(LOG)) { console.error(`MISSING ${LOG}`); process.exit(2); }
const log = readFileSync(LOG, 'utf8');
const ids = [...filedIds(log)].sort((a, b) => a - b);
const idSet = new Set(ids);

// ── A — no duplicate rows ────────────────────────────────────────────────────
const seen = new Set(), dup = new Set();
for (const id of ids) (seen.has(id) ? dup : seen).add(id);
for (const id of [...dup].sort((a, b) => a - b)) fail.push(`DUPLICATE ROW — tech-debt #${id} has more than one \`## #${id}\` heading in ${LOG}. The later one silently overwrites the earlier.`);

// ── B — no NET-NEW dangling citation (ratchet; see the header for why) ───────
const filed = filedIds(log);
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { _comment: '', stamped: null, dangling: {} };
const current = {};
const currentSubjects = { ledger: [], techdebt: [] };
for (const doc of WATCHED) {
  if (!existsSync(doc)) { note.push(`watched doc absent, skipped: ${doc}`); continue; }
  const cited = citedIds(readFileSync(doc, 'utf8'));
  current[doc] = [...cited].filter(id => !filed.has(id)).sort((a, b) => a - b);
}
let backlog = 0, netNew = 0;
for (const doc of WATCHED) {
  const cur = current[doc] ?? [];
  const known = new Set(base.dangling?.[doc] ?? []);
  backlog += cur.filter(id => known.has(id)).length;
  const fresh = cur.filter(id => !known.has(id));
  netNew += fresh.length;
  if (fresh.length) fail.push(`NET-NEW DANGLING CITATION — ${doc} cites tech-debt ${fresh.map(n => '#' + n).join(', ')} and ${LOG} has NO ROW for ${fresh.length === 1 ? 'it' : 'them'}. File the row, or cite an id that exists. (This is the #195 → #213 → #288(e) failure, and it happened four times on 2026-09-10 alone.)`);
}

// ── C — no duplicate CLOSE-OUT LEDGER rows (hard gate, A's sibling) ─────────────
// R-149's backstop. It catches a collision that has ALREADY landed in one tree; it cannot catch the
// shape that actually bites (two claims in two trees) — that is the all-branches sweep's job, and
// the two are deliberately complementary: the sweep PREVENTS, this one NETS.
let ledgerIds = [], ledgerReserved = [];
let shapeResult = null;   // clause E (#294a) — null means NOT CHECKED, never 'clean'
if (!existsSync(LEDGER)) { note.push(`ledger absent, clause C SKIPPED: ${LEDGER}`); }
else {
  const ledgerSrc = readFileSync(LEDGER, 'utf8');
  ledgerIds = ledgerRowIds(ledgerSrc);
  ledgerReserved = ledgerReservedIds(ledgerSrc);
  shapeResult = rowShapeViolations(ledgerSrc);
  const lseen = new Set(), ldup = new Set();
  for (const id of ledgerIds) (lseen.has(id) ? ldup : lseen).add(id);
  for (const id of [...ldup].sort((a, b) => a - b)) {
    fail.push(`DUPLICATE LEDGER ROW — close-out #${id} has more than one \`| **#${id}**\` row in ${LEDGER}. Two bodies of work under one number: the later row silently becomes the one everybody reads.`);
  }
  for (const id of ledgerReserved.filter(id => lseen.has(id))) note.push(`reservation #${id} has been CONSUMED — its real row is filed; the ⏳ row can be removed`);
}

// ── D — an id claimed in a COMMIT SUBJECT with no row in EITHER log (ratchet) ───
// The space nothing has ever watched. #304 is the live case: `eb4aad6 fix(#304)` is on `main` and
// main carries no #304 ledger row — the only one in existence is on `recon/campaigns-2026-09-12`
// and describes something else entirely. Ratcheted, not a hard gate, for the reason clause B is:
// a cap that fails every build on an inherited backlog gets worked around within a day.
const subjects = headSubjects();
let subjectNetNew = 0, subjectBacklog = 0;
if (subjects === null) {
  note.push('git could not be read — clause D SKIPPED. It reports SKIPPED rather than passing, because a check that cannot reach its target must not look like one that passed (#182).');
} else {
  const claimed = subjectIds(subjects);
  // 🔴 SCOPE MUST MATCH ON BOTH SIDES, AND THE FIRST VERSION OF THIS CLAUSE GOT IT WRONG.
  // Subjects are read over HEAD ∪ origin/main, so the FILED set must be too — otherwise a claim that
  // merged to `main` WITH its row reads as dangling on any branch that forked before the merge.
  // Caught live: `#306` merged with its ledger row while this branch was being built, and the clause
  // flagged it — comparing MAIN'S HISTORY against THIS TREE'S LEDGER. That is the same
  // two-trees-one-comparison mistake this whole pass exists to stop, made by the cap written to stop it.
  // maxBuffer: the close-out ledger passed 1MB on 2026-09-12 and Node's default made this read throw
  // ENOBUFS, which the catch turned into '' — a failed read wearing the face of an empty file (#182).
  const mainFile = (f) => { try { return execFileSync('git', ['show', `origin/main:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 }); } catch { return ''; } };
  const mainLedger = mainFile(LEDGER);
  const ledgerFiled = new Set([...ledgerIds, ...ledgerRowIds(mainLedger), ...ledgerReservedIds(mainLedger)]);
  const debtFiled = new Set([...filed, ...filedIds(mainFile(LOG))]);
  currentSubjects.ledger = [...claimed.ledger].filter(id => !ledgerFiled.has(id) && !ledgerReserved.includes(id)).sort((a, b) => a - b);
  currentSubjects.techdebt = [...claimed.techdebt].filter(id => !debtFiled.has(id)).sort((a, b) => a - b);
  const knownL = new Set(base.subjects?.ledger ?? []), knownD = new Set(base.subjects?.techdebt ?? []);
  const freshL = currentSubjects.ledger.filter(id => !knownL.has(id));
  const freshD = currentSubjects.techdebt.filter(id => !knownD.has(id));
  subjectBacklog = (currentSubjects.ledger.length - freshL.length) + (currentSubjects.techdebt.length - freshD.length);
  subjectNetNew = freshL.length + freshD.length;
  if (freshL.length) fail.push(`NET-NEW SUBJECT CLAIM WITH NO ROW — commit subject(s) claim close-out ${freshL.map(n => '#' + n).join(', ')} and ${LEDGER} has no row and no reservation for ${freshL.length === 1 ? 'it' : 'them'}. A number claimed ONLY in a commit message is invisible to every session that reads the files — this is exactly how #304 was taken twice, 4m35s apart.`);
  if (freshD.length) fail.push(`NET-NEW SUBJECT CLAIM WITH NO ROW — commit subject(s) claim tech-debt ${freshD.map(n => '#' + n).join(', ')} and ${LOG} has no row for ${freshD.length === 1 ? 'it' : 'them'}.`);
}

// 🔴 THE BASELINE IS WRITTEN HERE, AFTER CLAUSES C AND D HAVE RUN — NOT BEFORE THEM. The first
// version of this change wrote the baseline from the top of the file, so `currentSubjects` was still
// empty, the recorded backlog was `[]`, and the very next run failed on 32 "net-new" claims it had
// just been asked to remember. A baseline recorded before the thing it baselines is not a baseline.
if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({
    _comment: 'Tech-debt ids CITED in a watched doc with no row in docs/tech-debt-log.md. This is DEBT, '
      + 'not permission: it shrinks, never grows. The cap fails on NET-NEW only (verify-write-paths\'s shape). '
      + 'Re-record with `npm run id-citations:baseline` ONLY after filing rows, never to silence a new one.',
    stamped: new Date().toISOString().slice(0, 10),
    dangling: current,
    subjects: currentSubjects,
  }, null, 2) + '\n');
  console.log(`baseline re-recorded → ${BASELINE}`);
  process.exit(0);
}

// ── E — no CLOSE-OUT LEDGER row may have MORE cells than the header (tech-debt #294a) ──
if (shapeResult === null) {
  // The ledger is absent; clause C already noted the SKIP. Say so for E too rather
  // than letting an unreached check read as a clean one (#182).
  note.push('ledger absent, clause E (row shape) SKIPPED — not passed, SKIPPED');
} else if (shapeResult.width === null) {
  // 🔴 REFUSE, don't pass: without the header there is no width to compare against,
  // and "I could not look" must never render as "nothing wrong" (#182).
  fail.push(`LEDGER HEADER NOT FOUND in ${LEDGER} — clause E could not establish the table's width, so row shape was NOT checked.`);
} else {
  for (const v of shapeResult.violations) {
    fail.push(
      `LEDGER ROW SHAPE — close-out row #${v.id} has ${v.cells} cells against a ${shapeResult.width}-column header, ` +
      `so GFM DISCARDS the overflow and this text is in the file but NOT on the screen:\n` +
      `        "${v.discarded.slice(0, 220)}${v.discarded.length > 220 ? '…' : ''}"\n` +
      (v.culprit ? `     Likely culprit — an unescaped \`|\` inside inline code: …${v.culprit}…\n` : '') +
      `     Fix: write it \`\\|\`. Backticks do NOT protect a pipe in a table (tech-debt #294a).`,
    );
  }
}

// ── REPORTED, never asserted: the next free id, so nobody has to do arithmetic ──
const max = ids.length ? Math.max(...ids) : 0;
const gaps = [];
for (let i = 1; i < max; i++) if (!idSet.has(i)) gaps.push(i);

console.log(`verify-id-citations — ${LOG}: ${ids.length} rows, max #${max}`);
console.log(`  🔴 NEXT FREE TECH-DEBT ID: #${max + 1}   ← claim THIS, and re-run this cap immediately before you write it.`);
if (gaps.length) console.log(`  (unused ids below the max, NOT reservations and NOT free to reuse — a reader will look for the old one: ${gaps.length} of them, lowest ${gaps.slice(0, 6).map(n => '#' + n).join(' ')}…)`);
console.log(`  ⚠️ the ledger shares this number space — build #${max} and tech-debt #${max} are different things. Clause B ignores bare \`#N\` for exactly that reason.`);
note.forEach(n => console.log(`  note: ${n}`));

console.log(`  BACKLOG (baselined ${base.stamped ?? 'never'}, DEBT — shrinks, never grows): ${backlog} cited-but-unfiled ids across ${WATCHED.length} watched docs.`);
console.log(`  LEDGER: ${ledgerIds.length} close-out rows${ledgerReserved.length ? ` · ${ledgerReserved.length} open reservation(s): ${ledgerReserved.map(n => '#' + n).join(' ')}` : ''}`);
if (subjects === null) console.log('  clause D: SKIPPED (git unreadable) — not passed, SKIPPED.');
else {
  // 🔴 NAMED, not merely counted. Clause B prints a bare number and its baselined ids are invisible
  // in practice; a backlog nobody can see is a backlog nobody shrinks.
  const all = [...currentSubjects.ledger.map(n => 'close-out #' + n), ...currentSubjects.techdebt.map(n => 'tech-debt #' + n)];
  console.log(`  SUBJECT CLAIMS with no row (baselined ${base.stamped ?? 'never'}, DEBT — shrinks, never grows): ${all.length}`);
  if (all.length) console.log(`    ${all.join(' · ')}`);
  console.log('    ℹ a number claimed only in a commit message is invisible to every session that READS THE FILES (R-149).');
}

if (fail.length) { console.error('\n🔴 ' + fail.join('\n🔴 ')); process.exit(1); }
if (shapeResult?.width) console.log(`  LEDGER ROW SHAPE: all ${ledgerIds.length + ledgerReserved.length} row(s) fit the ${shapeResult.width}-column header — no cell is being silently discarded (#294a).`);
console.log(`\n✅ no duplicate rows (tech-debt AND ledger) · ${netNew + subjectNetNew} net-new dangling claims · ${backlog + subjectBacklog} baselined (visible, not forgotten) · ledger row shape clean.`);
