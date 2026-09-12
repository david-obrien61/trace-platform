#!/usr/bin/env node
/**
 * verify-owner-test-boards.mjs
 *
 * PURPOSE     Assert that owner-tests.html actually reaches every owner-test board on disk.
 * DEPENDENCIES owner-tests.html (its parser is EXTRACTED, never re-implemented here) ·
 *              docs/owner-tests/*-full-surface-test.md
 * OUTPUTS     exit 0 + a per-board table, or exit 1 naming the board and the reason.
 *
 * WHY THIS EXISTS (2026-09-08)
 *   owner-tests.html claimed in its own header to parse `docs/owner-tests/*-full-surface-test.md`.
 *   It fetched ONE file, and its parser read only `## SURFACE:` bands — six boards carry those.
 *   Measured before the fix: 24 of 30 boards parsed to ZERO, inventory lost 13 of its 118 cards
 *   and authority-model 6 of 36. A board that renders no cards is indistinguishable from a board
 *   that has none, so the gap was invisible from the page itself.
 *
 *   The page now carries a BOARDS manifest. A static page cannot list a directory, so that list
 *   is the kind of hardcoded declaration this repo has been bitten by repeatedly (tech-debt #73's
 *   OWNER_ONLY_PENDING, #185's write-paths baseline). The answer is not a promise to maintain it —
 *   it is this check, and it FAILS BOTH DIRECTIONS.
 *
 * WHAT IT ASSERTS
 *   A  manifest ⇔ directory, both ways (a board on disk and not listed; listed and not on disk)
 *   B  no board parses to ZERO cards
 *   C  the parser's card count is re-derived independently and must agree, per board, on the
 *      count AND on the status multiset — so under-parsing and over-parsing both fail
 *   D  negative + positive controls, asserted EVERY RUN. The script refuses to run without them:
 *      a check nobody has watched refuse is a claim (§6 r19).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HTML = 'owner-tests.html';
const DIR  = 'docs/owner-tests';
const SUFFIX = '-full-surface-test.md';

const tally = a => a.reduce((o,v)=>(o[v]=(o[v]||0)+1,o),{});
const fail = [];
const note = m => console.log(m);
const bad  = m => { fail.push(m); console.log('  🔴 ' + m); };

/* ── extract the page's own parser. Re-implementing it here would prove nothing:
      two copies of one rule drift, and the copy under test would be the wrong one. ── */
const html = readFileSync(HTML, 'utf8');
const from = html.indexOf('const TAG = {');
const to   = html.indexOf('/* ───────────── render ───────────── */');
if (from < 0 || to < 0 || to < from) {
  console.log('🔴 could not locate the parser inside ' + HTML + ' — the anchors moved.');
  process.exit(1);
}
const { parseTests, parseClaim } = new Function(
  html.slice(from, to) + '; return { parseTests, parseClaim };')();

/* the manifest, read out of the page rather than retyped */
const mm = html.match(/const BOARDS = \[([\s\S]*?)\];/);
if (!mm) { console.log('🔴 could not find the BOARDS manifest in ' + HTML); process.exit(1); }
const MANIFEST = [...mm[1].matchAll(/"([a-z0-9-]+)"/g)].map(m => m[1]);

/* ── D · CONTROLS. Run FIRST. If the parser cannot refuse prose it cannot be trusted on a board. ── */
const CONTROLS = [
  // must find exactly one card — the four shapes that exist across the 30 boards
  ['shape A — bare tag line',      '# T\n## SURFACE: grid\n### A card\nSTATUS: owed\nbody\n', 1, 'owed'],
  ['shape B — bold tag line',      '# T\n## CARD 1 — a card\n**STATUS:** owed · **DEVICE:** desktop\nbody\n', 1, 'owed'],
  ['shape C — backticked tag line','# T\n### CARD 1 — a card\n`STATUS: covered` · `DEVICE: desktop`\nbody\n', 1, 'covered'],
  ['shape D — tags in the heading','# T\n## CARD 1 — a card · `STATUS: owed` · `DEVICE: desktop`\nbody\n', 1, 'owed'],
  // must find NOTHING — every one of these appears verbatim in a real board
  ['legend table row',             '# T\n## HOW TO READ A CARD\n| `STATUS: covered` | a test exists |\n', 0, null],
  ['bullet naming a status',       '# T\n## WHAT THIS DOES NOT COVER\n- **PMI** — `STATUS: needs-test`, and the reason is\n', 0, null],
  ['preamble board claim',         '# T\n**Board: 0 of 33.** Every card is `STATUS: owed` except 22.\n', 0, null],
  ['heading with no status',       '# T\n## GATE 0 — is it live?\nread the stamp\n', 0, null],
];
note('CONTROLS (the parser must accept these and refuse those)');
for (const [name, md, want, wantStatus] of CONTROLS) {
  const got = parseTests(md, 'ctl', 'ctl');
  if (got.length !== want) bad(`control "${name}": expected ${want} card(s), parser found ${got.length}`);
  else if (wantStatus && got[0].status !== wantStatus)
    bad(`control "${name}": expected status ${wantStatus}, got ${got[0].status}`);
  else note(`  ✓ ${name} → ${got.length}`);
}
// first-wins: a preserved "WAS" block must not overwrite the status the card holds today
{
  const md = '# T\n## CARD 1 — a card\n**STATUS:** owed\nWAS:\n**STATUS:** covered\n';
  const got = parseTests(md, 'ctl', 'ctl');
  if (got.length !== 1 || got[0].status !== 'owed')
    bad(`control "first tag wins": expected 1 card at owed, got ${got.length} at ${got[0] && got[0].status}`);
  else note('  ✓ first tag wins (a preserved WAS block cannot re-flip a card)');
}
/* The guard names the controls it requires. Counting them is not enough: renaming one to
   something harmless keeps the length and removes the assertion — caught by mutating this
   very line, which is why it reads by NAME. */
const REQUIRED_CONTROLS = ['shape A','shape B','shape C','shape D',
                           'legend table row','bullet naming a status','preamble board claim',
                           'heading with no status'];
for (const need of REQUIRED_CONTROLS) {
  if (!CONTROLS.some(([n]) => n.startsWith(need))) {
    console.log(`🔴 control "${need}" is missing — refusing to run. A suite that cannot refuse proves nothing (§6 r19).`);
    process.exit(1);
  }
}

/* ── independent re-derivation of the card count. Same RULE, written separately: a heading is a
      card iff a status tag owns a line in its block, or sits in the heading itself. ── */
function reDerive(md) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, ' ').split(/\r?\n/);
  const out = [];
  let open = null;
  const TAGOWNS = /^(?:\*\*|`)?\s*STATUS[`*]*\s*:/i;
  const VALUE   = /STATUS[`*]*\s*:[`*]*\s*`?\s*([A-Za-z-]+)/i;
  const close = () => { if (open && open.status) out.push(open.status); open = null; };
  for (const raw of lines) {
    const t = raw.trim();
    if (/^#\s/.test(t)) { close(); continue; }
    if (/^#{2,4}\s/.test(t)) {
      close();
      open = { status: null };
      const inHead = t.match(VALUE);
      if (inHead) open.status = inHead[1].toLowerCase();
      continue;
    }
    if (!open) continue;
    if (t.startsWith('|')) continue;
    if (!open.status && TAGOWNS.test(t)) {
      const m = t.match(VALUE);
      if (m) open.status = m[1].toLowerCase();
    }
  }
  close();
  return out;
}

/* ── A · manifest ⇔ directory, BOTH directions ── */
const onDisk = readdirSync(DIR).filter(f => f.endsWith(SUFFIX)).map(f => f.slice(0, -SUFFIX.length)).sort();
note(`\nMANIFEST · ${MANIFEST.length} listed in ${HTML} · ${onDisk.length} on disk`);
for (const k of onDisk)   if (!MANIFEST.includes(k)) bad(`board on disk but NOT in the ${HTML} manifest: ${k}${SUFFIX} — it will not render`);
for (const k of MANIFEST) if (!onDisk.includes(k))   bad(`manifest lists a board that does not exist: ${k}${SUFFIX} — stale declaration`);
if (!fail.length) note('  ✓ manifest and directory agree, both directions');

/* ── B + C · every board parses, and the count is confirmed independently ── */
note('\nBOARDS');
let cards = 0, covered = 0;
for (const key of onDisk) {
  const md = readFileSync(`${DIR}/${key}${SUFFIX}`, 'utf8');
  const parsed  = parseTests(md, key, key);
  const derived = reDerive(md);
  const by = s => parsed.filter(c => c.status === s).length;
  cards += parsed.length; covered += by('covered');

  if (parsed.length === 0) { bad(`${key} parses to ZERO cards — the page would show it as empty`); continue; }
  /* ONE assertion, on the sorted STATUS multiset. Comparing counts first and statuses second
     leaves a stronger branch that today's corpus never reaches — an assertion nothing can make
     fail is the thing this file exists to prevent, so the two are collapsed into this. */
  const norm = a => a.slice().sort().join(',');
  if (norm(parsed.map(c => c.status)) !== norm(derived)) {
    bad(`${key}: parser read ${parsed.length} cards ${JSON.stringify(tally(parsed.map(c=>c.status)))}, ` +
        `independent re-derivation read ${derived.length} ${JSON.stringify(tally(derived))}`);
    continue;
  }
  const claim = parseClaim(md);
  const drift = claim && claim.total !== parsed.length
    ? `  ⚠ header claims ${claim.covered} of ${claim.total}` : '';
  note(`  ✓ ${String(parsed.length).padStart(4)} cards · ${String(by('covered')).padStart(2)} covered  ${key}${drift}`);
}

// 🔴 WHICH TREE THIS COUNT CAME FROM. A board count with no tree on it cannot be compared to
// another board count — and on 2026-09-12 six windows reported 35, 36 and 37 boards from four
// counting methods, with NOBODY WRONG: `origin/main` held 37 and a feature branch held 38, because
// a board lives on the branch that wrote it until that branch merges. The spread was never an
// arithmetic problem, it was an unlabelled-tree problem. Same class as the build's SHA stamp
// (OP-15): the number is not evidence until it says what it is a number OF.
// Degrades LOUDLY, never silently — `tree unknown` is an honest answer; omitting the stamp is not (#182).
const treeStamp = () => {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const sha = git('rev-parse', '--short', 'HEAD');
    let dirty = '';
    try { if (git('status', '--porcelain', '--', 'docs/owner-tests', 'owner-tests.html')) dirty = ' +uncommitted'; } catch { dirty = ' +unknown-worktree-state'; }
    return `${branch === 'HEAD' ? 'detached' : branch} @ ${sha}${dirty}`;
  } catch { return 'tree unknown — git could not be read'; }
};
note(`\nTOTAL · ${onDisk.length} boards · ${cards} cards · ${covered} covered   [${treeStamp()}]`);
if (fail.length) { console.log(`\n🔴 verify-owner-test-boards FAILED — ${fail.length} problem(s) above.`); process.exit(1); }
console.log('\n✅ verify-owner-test-boards — every board on disk is reachable by owner-tests.html.');
