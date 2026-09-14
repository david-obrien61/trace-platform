#!/usr/bin/env node
// ============================================================================
// verify-handoff-retention — CLAUDE.md §3 holds THREE entries, and no entry is
// in two places at once.
//
// PURPOSE:  OP-13's retention rule (§3 N=3, overflow moved VERBATIM to
//           docs/handoff-archive.md) has failed THREE TIMES, always the same way,
//           and the root cause is structural rather than careless:
//
//             🔴 EACH BRANCH VERIFIES ITS ARITHMETIC AGAINST THE MAIN IT BRANCHED
//                FROM. "entries-in == entries-out" is TRUE on both branches and
//                FALSE at the merge. Nothing has ever verified it post-merge.
//
//           Two concurrent branches each archive the newest overflow entry — the
//           SAME entry — so the archive gets it twice and §3 keeps four. That is
//           2026-08-30 (6)/(7), 2026-08-31 (6), and this merge. The #244 close-out
//           already called it "a pattern rather than an accident"; a pattern that
//           recurs after being named is waiting for a mechanism, not another note.
//
//           This is that mechanism. It is deliberately cheap and deliberately
//           unable to be talked out of noticing — the same family as the pinned
//           count in positions.test.ts (which caught a false declaration "in
//           seconds") and select-policy-declarations.json.
//
// CHECKS:   (Entries are compared by their FULL TEXT, never by heading alone — two
//           different sessions on one date can legitimately share a title, and one
//           pair in the real archive does.)
//           1. §3 holds AT MOST 3 entries.
//           2. No entry heading appears in BOTH §3 and the archive.
//              🔴 THIS IS THE ONE THAT CATCHES THE MERGE BUG. An entry in both
//              places is the duplicate-archive defect by definition, and it is
//              invisible to any per-branch count.
//           3. No entry heading appears TWICE within the archive.
//           4. The archive is non-empty and §3 is non-empty (a wholesale
//              deletion is not a passing state).
//           5. 🔴 EVERY CLOSE-OUT LEDGER ROW HAS A §3 ENTRY — live or archived.
//              A ledger row with no entry is an INCOMPLETE CLOSE-OUT, and it is
//              SILENT in a way a lost entry is not: §3's retention clause says a
//              close-out that adds a FLAGGED FOR DAVID item adds a line to
//              docs/open-questions.md too, so a session that never writes a §3
//              entry never fires that clause either — its flagged items reach
//              NEITHER surface, and the absence looks exactly like a session that
//              had nothing to flag.
//
//              🔴 THIS IS #280'S SHAPE ONE SURFACE OVER. #280 is "the close-out
//              gates accept PUSHED as shipped" — a standing instruction in §9 that
//              nothing asserts. So is this one. Measured 2026-09-14: FIFTEEN rows
//              (#253 #255 #256 #264 #270 #271 #291 #302 #304 #308 #310 #311 #313
//              #316 #317) had no entry. They did not scroll out at N=3; they never
//              entered. The most pointed is #302 — the row that BUILT the
//              open-questions register, to catch the questions §3 drops at N=3,
//              is itself a row §3 never recorded.
//
//              Exceptions live in handoff-entry-declarations.json and the list
//              PRUNES ITSELF: a declaration for an id with no ledger row, or for
//              one that has since gained an entry, is STALE and FAILS (#73).
//
// SCOPE:    Reads two markdown files. No network, no database, no dependencies.
// OUTPUTS:  exit 0 clean · exit 1 with the offending headings NAMED.
// ============================================================================

import { readFileSync } from 'node:fs';

const CLAUDE = 'CLAUDE.md';
const ARCHIVE = 'docs/handoff-archive.md';
const MAX_SECTION3 = 3;
const SELF_TEST = process.argv.includes('--self-test');

/** §3 runs from the HANDOFF heading to the next top-level `## ` heading. */
function section3(md) {
  const start = md.search(/^## 3\. HANDOFF/m);
  if (start === -1) return null;
  const rest = md.slice(start + 1);
  const nextTop = rest.search(/^## \d+\./m);
  return nextTop === -1 ? rest : rest.slice(0, nextTop);
}

/**
 * Entries as {heading, body}. An entry is moved VERBATIM, so a merge artefact is a
 * byte-identical COPY — heading AND body.
 *
 * 🔴 COMPARE THE WHOLE ENTRY, NOT THE HEADING. The first version of this check
 * compared headings alone and immediately reported a false positive it could not
 * have distinguished: two DIFFERENT 2026-06-09 sessions share the title
 * "THUNDER: Ignition OS Reality Audit → STD-010 + built-inventory update" —
 * 161 lines and 97 lines, different work, legitimately both in the archive.
 * A same-day second session reusing a title is ordinary; a byte-identical copy is
 * the defect. Keying on the heading would have made this check cry wolf on real
 * history, and a check that cries wolf gets deleted — which is how the thing it
 * guards starts failing again.
 */
function entries(block) {
  const out = [];
  const re = /^### (.+)$/gm;
  const marks = [...block.matchAll(re)];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : block.length;
    out.push({ heading: marks[i][1].trim(), text: block.slice(start, end) });
  }
  return out;
}
/**
 * Normalise an entry for comparison.
 *
 * 🔴 FILE FURNITURE IS STRIPPED FIRST, AND THIS CLAUSE WAS WRITTEN BECAUSE THE CHECK
 * MISSED THE VERY DUPLICATE IT WAS BUILT FOR. On the 2026-09-01 merge both branches
 * archived the 2026-08-31 (5) calendar entry. Git kept both insertions — and because
 * the archive's own `>` preamble sat BETWEEN them, the first copy ABSORBED it. The two
 * bodies then differed by four lines of boilerplate, and a whole-text comparison
 * declared them distinct. A duplicate that swallows intervening furniture is still a
 * duplicate; the furniture is not part of the entry.
 *
 * Removed: HTML provenance comments, `>` blockquote lines, and `---` rules. Those are
 * the file's structure, and every one of them is exactly what a merge can wedge into
 * the middle of a copied block.
 */
const norm = t => t
  .replace(/<!--[\s\S]*?-->/g, '')
  .split('\n').filter(l => !/^\s*>/.test(l) && !/^\s*---\s*$/.test(l)).join('\n')
  .replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const claudeMd = readFileSync(CLAUDE, 'utf8');
const archiveMd = readFileSync(ARCHIVE, 'utf8');

const s3 = section3(claudeMd);
if (s3 === null) {
  console.error('❌ handoff-retention: could not find "## 3. HANDOFF" in CLAUDE.md.');
  process.exit(1);
}

const live = entries(s3);
const archived = entries(archiveMd);
const problems = [];

// ── 1 — the retention bound ────────────────────────────────────────────────
if (live.length > MAX_SECTION3) {
  problems.push(
    `§3 holds ${live.length} entries; the rule is ${MAX_SECTION3} (OP-13).\n` +
    `     Move the oldest ${live.length - MAX_SECTION3} VERBATIM to ${ARCHIVE}, newest-first,\n` +
    `     under a dated provenance comment. Oldest in §3 right now:\n` +
    live.slice(MAX_SECTION3).map(e => `       · ${e.heading.slice(0, 110)}`).join('\n'),
  );
}

// ── 2 — 🔴 THE MERGE BUG. In both places = archived while still live. ──────
const archivedSet = new Map(archived.map(e => [norm(e.text), e]));
const inBoth = live.filter(e => archivedSet.has(norm(e.text)));
if (inBoth.length) {
  problems.push(
    `${inBoth.length} entr${inBoth.length === 1 ? 'y is' : 'ies are'} in BOTH §3 and the archive.\n` +
    `     This is the concurrent-merge defect: two branches each archived the same\n` +
    `     overflow entry, and each was arithmetically correct on its own branch.\n` +
    `     Remove it from whichever place it does not belong (§3 keeps the newest 3):\n` +
    inBoth.map(e => `       · ${e.heading.slice(0, 110)}`).join('\n'),
  );
}

// ── 3 — the archive holding one entry twice ────────────────────────────────
const seen = new Map();
const dupes = [];
for (const e of archived) {
  const k = norm(e.text);
  if (seen.has(k)) dupes.push(e); else seen.set(k, e);
}
if (dupes.length) {
  problems.push(
    `${dupes.length} entr${dupes.length === 1 ? 'y appears' : 'ies appear'} TWICE in ${ARCHIVE}:\n` +
    dupes.map(e => `       · ${e.heading.slice(0, 110)}`).join('\n') +
    `\n     The archive is append-and-preserve; a duplicate is a merge artefact, not history.`,
  );
}

// ── 5 — 🔴 EVERY LEDGER ROW HAS A §3 ENTRY ────────────────────────────────
//
// 🔴 HOW AN ENTRY'S OWN LEDGER ID IS READ, AND WHY IT IS NOT "ANY #NNN IN THE TEXT".
// An entry heading is one long paragraph that routinely MENTIONS other ids —
// #310 and #311 appear inside #314's and #312's entries, which is exactly what
// makes a missing entry read as present. So the id is taken ONLY from the
// heading's FIRST BOLD RUN (the headline proper, `**...**`), and `TECH-DEBT #NNN`
// is excluded there because a tech-debt id is not a ledger id. Combined entries
// ("#250 + #251", "#267 (recon) + #268 (build)") claim BOTH, which is correct and
// is why the extraction is not "the first id".
//
// Direction: LEDGER ROW → ENTRY, one way only. An entry with no ledger row is NOT
// an error — §3 predates the ledger table, and 187 archived headings have no bold
// run at all.
const LEDGER = 'docs/CLOSE-OUT-LEDGER.md';
const DECLARATIONS = 'handoff-entry-declarations.json';

/** Close-out rows only. A `⏳ RESERVED` row is a claim, not a close-out, and owes no entry. */
function ledgerCloseOutIds(md) {
  return [...md.matchAll(/^\| \*\*#(\d+)\*\* \|/gm)].map(m => m[1]);
}

/** Ledger ids an entry CLAIMS — from its headline's first bold run, TECH-DEBT excluded. */
function claimedIds(heading) {
  const bold = heading.match(/\*\*([\s\S]*?)\*\*/);
  if (!bold) return [];
  return [...bold[1].matchAll(/(TECH-DEBT\s+)?#(\d+)\b/gi)].filter(m => !m[1]).map(m => m[2]);
}

function checkEveryRowHasAnEntry(ledgerMd, declarationsRaw, allEntries) {
  const found = [];
  const rows = ledgerCloseOutIds(ledgerMd);
  const claimed = new Set(allEntries.flatMap(e => claimedIds(e.heading)));
  let declared;
  try {
    declared = JSON.parse(declarationsRaw).declarations ?? {};
  } catch (err) {
    return [`${DECLARATIONS} is not valid JSON (${err.message}). The exceptions list must parse or the check cannot run — and a check that cannot run is not a check (§6 r19).`];
  }

  const undeclaredGaps = rows.filter(id => !claimed.has(id) && !(id in declared));
  if (undeclaredGaps.length) {
    found.push(
      `${undeclaredGaps.length} close-out ledger row(s) have NO §3 entry, live or archived: ${undeclaredGaps.map(i => '#' + i).join(' ')}\n` +
      `     A ledger row without a §3 entry is an INCOMPLETE CLOSE-OUT. Write the entry in\n` +
      `     CLAUDE.md §3 (and archive the overflow — the N=3 rule applies to it), or, if the\n` +
      `     row genuinely owes none, add it to ${DECLARATIONS} with the reason.\n` +
      `     ⚠️ And check docs/open-questions.md: a close-out with FLAGGED FOR DAVID items adds a\n` +
      `     line there too, and a session with no §3 entry never fired that clause either.`,
    );
  }

  // 🔴 THE LIST PRUNES ITSELF — both directions, or it rots into unread noise (#73).
  const rowSet = new Set(rows);
  const noSuchRow = Object.keys(declared).filter(id => !rowSet.has(id));
  if (noSuchRow.length) {
    found.push(
      `${noSuchRow.length} declaration(s) in ${DECLARATIONS} name an id with NO close-out ledger row: ${noSuchRow.map(i => '#' + i).join(' ')}\n` +
      `     A declaration excusing a row that does not exist excuses nothing. Remove it.`,
    );
  }
  const nowCovered = Object.keys(declared).filter(id => rowSet.has(id) && claimed.has(id));
  if (nowCovered.length) {
    found.push(
      `${nowCovered.length} declaration(s) in ${DECLARATIONS} are STALE — the row now HAS a §3 entry: ${nowCovered.map(i => '#' + i).join(' ')}\n` +
      `     The gap closed. Remove the declaration so the list keeps meaning what it says.`,
    );
  }
  return found;
}

if (!SELF_TEST) {
  problems.push(...checkEveryRowHasAnEntry(
    readFileSync(LEDGER, 'utf8'),
    readFileSync(DECLARATIONS, 'utf8'),
    [...live, ...archived],
  ));
}

// ── 4 — neither file emptied ───────────────────────────────────────────────
if (live.length === 0) problems.push('§3 holds NO entries — the handoff narrative is gone, which is not a passing state.');
if (archived.length === 0) problems.push(`${ARCHIVE} holds NO entries — the archive is append-and-preserve and must never be emptied.`);

// 🔴 THE SELF-TEST MUST RUN ON A BROKEN TREE TOO. If the real checks exited first,
// `--self-test` would be unrunnable exactly when someone most needs to ask whether
// the checker itself still works — which is the failure mode §6 r19 is about.
if (problems.length && !SELF_TEST) {
  console.error('\n❌ handoff-retention FAILED\n');
  for (const p of problems) console.error('  · ' + p + '\n');
  console.error(`  §3: ${live.length} entries · archive: ${archived.length} entries`);
  console.error('  Rule: CLAUDE.md §9 "§3 HANDOFF retention — N=3" / OP-13.\n');
  process.exit(1);
}

if (!SELF_TEST) {
  const rowCount = ledgerCloseOutIds(readFileSync(LEDGER, 'utf8')).length;
  console.log(`✅ handoff-retention — §3 holds ${live.length}/${MAX_SECTION3}; archive holds ${archived.length}; no entry in two places; all ${rowCount} close-out ledger rows have an entry or a declaration.`);
}

// ============================================================================
// SELF-TEST (STD-022 — probes BOTH directions; STD-024 — the first probe is the
// real defect verbatim).
//
// 🔴 A CHECK NOBODY HAS SEEN REFUSE IS A CLAIM (§6 r19 · [[R-33]]). Every probe
// below states the verdict it expects, and P9 is a NEGATIVE CONTROL that fails if
// the checker ignores its inputs — which is #182's prescription: a mutant that
// changes the POPULATION, not the subject.
// ============================================================================
if (SELF_TEST) {
  const entry = h => ({ heading: h, text: '### ' + h });
  const decls = o => JSON.stringify({ declarations: o });
  const probes = [
    // ── P1 — 🔴 THE REAL DEFECT, VERBATIM (STD-024). #302 built the open-questions
    //    register to catch what §3 drops at N=3, and §3 never recorded #302 itself.
    { name: 'P1  the real defect: a ledger row with no entry and no declaration',
      ledger: '| **#302** | the open-questions register |',
      decls: decls({}),
      entries: [entry("2026-09-11 — THUNDER **SOMETHING ELSE ENTIRELY. #300.**")],
      expect: true, why: 'must REFUSE — #302 has a row, no entry, no declaration' },

    // ── P2 — the passing direction. Without this, P1 could be a check that always fails.
    { name: 'P2  a ledger row WITH a matching entry',
      ledger: '| **#302** | the open-questions register |',
      decls: decls({}),
      entries: [entry("2026-09-11 — THUNDER **THE OPEN-QUESTIONS REGISTER. #302.** 🔴 body")],
      expect: false, why: 'must PASS — the entry claims #302 in its headline' },

    // ── P3 — 🔴 THE MISCOUNT THE PROMPT WARNED ABOUT. #310 and #311 appear as
    //    MENTIONS inside #314's and #312's entries. A mention is not an entry.
    { name: 'P3  an id MENTIONED outside the headline is NOT a claim',
      ledger: '| **#310** | one shared channel vocabulary |',
      decls: decls({}),
      entries: [entry("2026-09-12 — THUNDER **THE SWEEP'S OWN BLIND SPOT. #314.** 🔴 body text discussing #310 at length")],
      expect: true, why: 'must REFUSE — #310 is mentioned in #314’s body, never claimed' },

    // ── P4 — a tech-debt id in the headline is not a ledger claim.
    { name: 'P4  TECH-DEBT #NNN in the headline is not a ledger claim',
      ledger: '| **#270** | the unit printed twice |',
      decls: decls({}),
      entries: [entry('2026-09-11 — THUNDER **THE GOOGLE REVIEW ASK. #300. TECH-DEBT #270.**')],
      expect: true, why: 'must REFUSE — #270 there is a tech-debt id, not this entry’s ledger id' },

    // ── P5 — a combined entry claims BOTH ids. This is why the extraction is not
    //    "the first id in the heading": #251 and #268 are real, covered rows.
    { name: 'P5  a combined entry claims both ids',
      ledger: '| **#250** | a |\n| **#251** | b |',
      decls: decls({}),
      entries: [entry('2026-09-01 — THUNDER **THE DEPENDENCY WAS UNMET. #250 + #251. R-36.**')],
      expect: false, why: 'must PASS — one entry legitimately closes two rows' },

    // ── P6 — the list prunes itself, direction one.
    { name: 'P6  a declaration for an id with NO ledger row is stale',
      ledger: '| **#302** | x |',
      decls: decls({ 302: 'declared', 999: 'no such row' }),
      entries: [], expect: true, why: 'must REFUSE — #999 excuses a row that does not exist' },

    // ── P7 — the list prunes itself, direction two. This is the #73 lesson: a gap
    //    list that only grows stops being read.
    { name: 'P7  a declaration for a row that now HAS an entry is stale',
      ledger: '| **#302** | x |',
      decls: decls({ 302: 'declared' }),
      entries: [entry('2026-09-11 — THUNDER **THE REGISTER. #302.**')],
      expect: true, why: 'must REFUSE — the gap closed; the declaration must go' },

    // ── P8 — a RESERVED row is a claim, not a close-out, and owes no entry.
    { name: 'P8  a ⏳ RESERVED row owes no entry',
      ledger: '| ⏳ **#320 — RESERVED 2026-09-14, BUILD IN PROGRESS** | reservation |',
      decls: decls({}), entries: [], expect: false, why: 'must PASS — reserving is not closing out' },

    // ── P9 — 🔴 NEGATIVE CONTROL. Same declaration, EMPTY ledger. If the checker
    //    ignored its input this would agree with P6/P7 for the wrong reason.
    { name: 'P9  negative control — the verdict tracks the LEDGER, not a constant',
      ledger: '', decls: decls({ 302: 'declared' }), entries: [],
      expect: true, why: 'must REFUSE as STALE (no row), proving the ledger is actually read' },

    // ── P10 — a check that cannot run is not a check (§6 r19).
    { name: 'P10 unparseable declarations file fails loudly, never silently',
      ledger: '| **#302** | x |', decls: '{ not json',
      entries: [entry('2026-09-11 — THUNDER **THE REGISTER. #302.**')],
      expect: true, why: 'must REFUSE — a gate whose exceptions list will not parse must not pass' },
  ];

  let failed = 0;
  for (const p of probes) {
    const got = checkEveryRowHasAnEntry(p.ledger, p.decls, p.entries).length > 0;
    const ok = got === p.expect;
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${p.name} — ${p.why}${ok ? '' : `  [GOT ${got ? 'refuse' : 'pass'}]`}`);
  }
  if (failed) {
    console.error(`\n❌ handoff-retention --self-test: ${failed}/${probes.length} probes FAILED.\n`);
    process.exit(1);
  }
  console.log(`\n✅ handoff-retention --self-test — ${probes.length}/${probes.length} probes, both directions.`);
  process.exit(0);
}
