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

const LOG = 'docs/tech-debt-log.md';
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
  const re = /tech[-\s]debt(?:\s+log)?\s*((?:\*\*)?#\d+(?:\*\*)?(?:\s*(?:[,·]|–|—|-|through|to|and)\s*(?:\*\*)?#?\d+(?:\*\*)?)*)/gi;
  for (const m of src.matchAll(re)) for (const n of m[1].matchAll(/\d+/g)) out.add(+n[0]);
  return out;
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
  if (rowIds('### #7 — a sub-heading row').length !== 1) { console.error('CAP PROBE FAILED: a ### row is not counted — correction ① above'); process.exit(2); }
  // 🔴 NEGATIVE CONTROL FOR CORRECTION ② — the exact line that produced the false #211 duplicate.
  if (rowIds('**#211 is #280\'s "a declarative comment" **, filed hours earlier').length !== 0) { console.error('CAP PROBE FAILED: bolded prose at line start read as a row — the false-positive this cap already made once'); process.exit(2); }
  if (rowIds('see ## #7 mid-sentence').length !== 0) { console.error('CAP PROBE FAILED: an id not at line start counted as a row'); process.exit(2); }
  if (rowIds('## #7 no dash here').length !== 0) { console.error('CAP PROBE FAILED: the em-dash discriminator is not being applied'); process.exit(2); }
}

if (SELF_TEST) {
  console.log('SELF-TEST — each check, shown refusing a crafted violation then accepting a clean input:\n');
  const a1 = rowIds('## #7 — a\n## #7 — b\n'); const a1dup = a1.length !== new Set(a1).size;
  console.log(`  A duplicate rows     — violation: ${a1dup ? '✅ caught' : '🔴 MISSED'} · clean: ${rowIds('## #7 — a\n## #8 — b\n').length === 2 ? '✅ accepted' : '🔴 rejected'}`);
  const b1 = citedIds('tech-debt #9001').has(9001);
  console.log(`  B dangling citation  — violation: ${b1 ? '✅ caught' : '🔴 MISSED'} · clean: ${citedIds('| #9001 | build row').size === 0 ? '✅ accepted (bare id ignored)' : '🔴 false positive'}`);
  process.exit(0);
}

if (!existsSync(LOG)) { console.error(`MISSING ${LOG}`); process.exit(2); }
const log = readFileSync(LOG, 'utf8');
const ids = rowIds(log);
const idSet = new Set(ids);

// ── A — no duplicate rows ────────────────────────────────────────────────────
const seen = new Set(), dup = new Set();
for (const id of ids) (seen.has(id) ? dup : seen).add(id);
for (const id of [...dup].sort((a, b) => a - b)) fail.push(`DUPLICATE ROW — tech-debt #${id} has more than one \`## #${id}\` heading in ${LOG}. The later one silently overwrites the earlier.`);

// ── B — no NET-NEW dangling citation (ratchet; see the header for why) ───────
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { _comment: '', stamped: null, dangling: {} };
const current = {};
for (const doc of WATCHED) {
  if (!existsSync(doc)) { note.push(`watched doc absent, skipped: ${doc}`); continue; }
  const cited = citedIds(readFileSync(doc, 'utf8'));
  current[doc] = [...cited].filter(id => !idSet.has(id)).sort((a, b) => a - b);
}
if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({
    _comment: 'Tech-debt ids CITED in a watched doc with no row in docs/tech-debt-log.md. This is DEBT, '
      + 'not permission: it shrinks, never grows. The cap fails on NET-NEW only (verify-write-paths\'s shape). '
      + 'Re-record with `npm run id-citations:baseline` ONLY after filing rows, never to silence a new one.',
    stamped: new Date().toISOString().slice(0, 10),
    dangling: current,
  }, null, 2) + '\n');
  console.log(`baseline re-recorded → ${BASELINE}`);
  process.exit(0);
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

if (fail.length) { console.error('\n🔴 ' + fail.join('\n🔴 ')); process.exit(1); }
console.log(`\n✅ no duplicate rows · ${netNew} net-new dangling citations · ${backlog} baselined (visible, not forgotten).`);
