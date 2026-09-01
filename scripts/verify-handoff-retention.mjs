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
//
// SCOPE:    Reads two markdown files. No network, no database, no dependencies.
// OUTPUTS:  exit 0 clean · exit 1 with the offending headings NAMED.
// ============================================================================

import { readFileSync } from 'node:fs';

const CLAUDE = 'CLAUDE.md';
const ARCHIVE = 'docs/handoff-archive.md';
const MAX_SECTION3 = 3;

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

// ── 4 — neither file emptied ───────────────────────────────────────────────
if (live.length === 0) problems.push('§3 holds NO entries — the handoff narrative is gone, which is not a passing state.');
if (archived.length === 0) problems.push(`${ARCHIVE} holds NO entries — the archive is append-and-preserve and must never be emptied.`);

if (problems.length) {
  console.error('\n❌ handoff-retention FAILED\n');
  for (const p of problems) console.error('  · ' + p + '\n');
  console.error(`  §3: ${live.length} entries · archive: ${archived.length} entries`);
  console.error('  Rule: CLAUDE.md §9 "§3 HANDOFF retention — N=3" / OP-13.\n');
  process.exit(1);
}

console.log(`✅ handoff-retention — §3 holds ${live.length}/${MAX_SECTION3}; archive holds ${archived.length}; no entry in two places.`);
