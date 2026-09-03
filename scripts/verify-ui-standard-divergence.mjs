#!/usr/bin/env node
// ============================================================================================
// verify-ui-standard-divergence — a surface that diverges from the design system says so, in a
// declaration, clause by clause.
//
// PURPOSE:      CLAUDE.md §6 r16 says "name the standard, then decide", and until today nothing
//               checked that anyone had. `ReceiptsList` DID name it — a correct, reasoned
//               divergence in its own header — and it was still the defect this cap exists for,
//               for two reasons a human reviewer missed twice:
//
//                 ① THE DIVERGENCE RECORDED WAS NARROWER THAN THE DIVERGENCE TAKEN. The header
//                    explains dropping the GRID SHAPE and is silent on G4 (sortable columns),
//                    G5 (column show/hide) and G6 (search / filter). The surface has none of
//                    them. Nothing noticed, because nothing was reading.
//                 ② IT WAS FILED IN EXACTLY ONE PLACE — a component comment. Not the decision
//                    doc, not the ledger cell, not `ui-standards.html`, not the standard itself.
//                    A prompt-writer could not find it without opening the file, and did not:
//                    on 2026-09-03 a build prompt asked David to re-rule two display questions
//                    the corpus had already settled.
//
//               So the assertion is NOT "did you import DataSheet" — that is the weak version
//               and it would have passed ReceiptsList on day one. It is: **a bespoke record-list
//               surface carries a declaration, and that declaration ANSWERS EVERY CLAUSE of the
//               sections it diverges from.** An unanswered clause fails.
//
// 🔴 THE CLAUSE LIST IS DERIVED FROM `docs/standards/ui-control-standards.md`, NEVER HARDCODED
//    (tech-debt #73's lesson: a hardcoded gap list asserts nothing and rots into noise). The
//    consequence is the point of the whole cap: ADDING A STANDARD TO THE DOC AUTOMATICALLY
//    INVALIDATES EVERY DECLARATION until it is re-answered. That is the ①→②→③ order of
//    operations — doc first, widget once, surfaces inherit — made MECHANICAL instead of
//    remembered.
//
// 🔴 SELF-PRUNING IN BOTH DIRECTIONS (#228's `r-b2-wired-since-declarations.json` pattern, R-33).
//    A declaration for a file that no longer exists, or for a file that NOW imports the shared
//    control, FAILS as stale. Without this it becomes `OWNER_ONLY_PENDING` — a list that only
//    grows, that nobody reads, printed on every build.
//
// ⚠️ BASELINE-AND-RATCHET ON CHECK A AND CHECK D, DELIBERATELY, AND DAVID RULED IT. A day-one
//    hard fail would be seeded with ~20 rubber-stamp declarations, and a declaration file full
//    of rubber stamps is R-33's exact defect: a check incapable of disagreeing. New bespoke
//    surfaces fail immediately; the existing population is a number that may only shrink.
//    CHECK B and CHECK C are NOT baselined — declaring is opt-in, so a declaration can be held
//    to its full standard from the first one.
//
// WHAT IT CANNOT CATCH — stated here so nobody mistakes a green for more than it is:
//   · whether a REASON is a good one. It reads a string. It cannot tell "a grid would explode
//     one receipt into several rows" from "we didn't check."
//   · correct USE of DataSheet once imported (a missing frozenWidth, no identifier column).
//   · §5 SECTION HEADERS — copy claims. The standard itself rules that review-only: "one that
//     tried would be reading intent."
//   · detection is HEURISTIC. It over-reaches (a settings page rendering a list of toggles) and
//     under-reaches (rows rendered through a helper this regex cannot see).
//
// OUTPUTS:      exit 0 / exit 1, and a named finding per failure. Wired into `npm run verify`.
// ============================================================================================

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT       = process.cwd();
const STANDARD   = 'docs/standards/ui-control-standards.md';
const BOARD      = 'ui-standards.html';
const DECLS      = 'docs/decisions/ui-standard-divergences.json';
const SCAN_ROOT  = 'packages/cultivar-os/src';

const findings = [];
const fail = (id, msg) => findings.push(`🔴 ${id}: ${msg}`);
const read = p => readFileSync(join(ROOT, p), 'utf8');

// ── § the clause list, DERIVED ──────────────────────────────────────────────────────────────
// Two forms in the doc: table rows (`| G4 | **Sortable columns** — …`) and bold prose clauses
// (`**S1 — A SECTION HEADER'S CLAIM…`). Both are parsed; a clause the doc adds in either form
// is picked up with no edit here.
function parseClauses(md) {
  const clauses = new Map(); // id -> { section, text }
  let section = null;
  for (const line of md.split('\n')) {
    const h = /^##\s+(\d+)\.\s+(.+)$/.exec(line);
    if (h) { section = { num: h[1], title: h[2].trim() }; continue; }
    if (!section) continue;

    const row = /^\|\s*([GMFE]\d+)\s*\|\s*(.+?)\s*\|/.exec(line);
    if (row) { clauses.set(row[1], { section: section.num, text: strip(row[2]) }); continue; }

    const prose = /^\*\*([SR]\d+)\s*[—-]\s*(.+?)\*\*/.exec(line);
    if (prose) clauses.set(prose[1], { section: section.num, text: strip(prose[2]) });
  }
  return clauses;
}
const strip = t => t.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

if (!existsSync(join(ROOT, STANDARD))) { fail('SETUP', `${STANDARD} not found — the clause list is derived from it and cannot be reconstructed`); report(); }
const md      = read(STANDARD);
const clauses = parseClauses(md);
if (clauses.size === 0) fail('SETUP', `no clauses parsed out of ${STANDARD} — the parser and the doc format have diverged, and a cap that parses nothing passes everything (R-33)`);

const bySection = new Map();
for (const [id, c] of clauses) {
  if (!bySection.has(c.section)) bySection.set(c.section, []);
  bySection.get(c.section).push(id);
}

// ── § the population, DERIVED ───────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir))) {
    const p = join(dir, e);
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}
// 🔴 COMMENTS ARE STRIPPED BEFORE ANY DETECTION, AND THIS IS NOT A TIDINESS CHOICE — THE FIRST
// RUN OF THIS CAP GOT ReceiptsList WRONG BECAUSE OF IT. Its header comment contains the words
// `<DataSheet>` while naming the standard it diverges FROM, so a raw text match read the file as
// a CONSUMER of the shared grid and excluded the one surface the cap was written for. A cap that
// reads prose as code will exonerate exactly the file whose prose is most careful. Detection now
// reads code only.
const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/** A RECORD-LIST SURFACE: it reads rows and renders them repeatedly, or it hand-rolls a table. */
function isRecordList(code) {
  const readsRows   = /\.from\(['"`]/.test(code) && /\.select\(/.test(code);
  const repeatsRows = /\.map\(/.test(code);
  const handTable   = /<table/.test(code);
  return (readsRows && repeatsRows) || handTable;
}
/** A CONSUMER of the shared grid: it IMPORTS it, or renders the element. Not: mentions it. */
const usesSharedGrid = code =>
  /import[\s\S]{0,200}?from\s+['"][^'"]*datasheet\/DataSheet['"]/.test(code) || /<DataSheet[\s/>]/.test(code);

// 🔴 THE SHARED CONTROLS THEMSELVES ARE NOT DIVERGENCES — THEY ARE THE DEFINITION. Parsed out of
// the standard's own "shared controls that carry these standards" list rather than hardcoded
// here, so a control renamed or added in the doc is honoured without editing this script.
const CARRIERS = [...md.matchAll(/^-\s+\*\*`([^`]+\.tsx?)`\*\*/gm)].map(m => m[1]);
if (CARRIERS.length === 0) fail('SETUP', `no shared controls parsed out of ${STANDARD}'s carrier list — the grid engine would then be measured as a divergence from itself.`);

const files = walk(SCAN_ROOT).map(p => ({ path: p.split('\\').join('/'), code: stripComments(read(p)) }));
const population = files.filter(f => isRecordList(f.code) && !CARRIERS.includes(f.path));
const bespoke    = population.filter(f => !usesSharedGrid(f.code)).map(f => f.path);

// ── § the declarations ──────────────────────────────────────────────────────────────────────
const decl = existsSync(join(ROOT, DECLS)) ? JSON.parse(read(DECLS)) : { baseline: {}, divergences: [] };
const declared = new Map((decl.divergences ?? []).map(d => [d.file, d]));

// ── CHECK C — SELF-PRUNING. Runs FIRST: a stale declaration would otherwise mask a real gap. ──
for (const [file, d] of declared) {
  if (!existsSync(join(ROOT, file))) {
    fail('C1', `declaration for \`${file}\` names a file that does not exist. A declaration outliving its subject is the rot that made OWNER_ONLY_PENDING unreadable — delete the entry.`);
    continue;
  }
  if (usesSharedGrid(stripComments(read(file)))) {
    fail('C1', `\`${file}\` NOW USES THE SHARED CONTROL and its divergence declaration is stale. This is the good outcome — the surface converged. Delete the entry so the file stops claiming a divergence it no longer takes.`);
  }
  if (!Array.isArray(d.sections) || d.sections.length === 0) {
    fail('C2', `declaration for \`${file}\` names no \`sections\`. A divergence that does not say WHAT it diverges from cannot be checked against anything.`);
  }
}

// ── CHECK B — CLAUSE COMPLETENESS. The clause this cap exists for. NOT baselined. ────────────
const VERDICTS = new Set(['met', 'dropped', 'owed']);
for (const [file, d] of declared) {
  if (!existsSync(join(ROOT, file))) continue;
  for (const sec of d.sections ?? []) {
    const ids = bySection.get(String(sec));
    if (!ids) { fail('B0', `declaration for \`${file}\` names section ${sec}, which ${STANDARD} does not define.`); continue; }
    for (const id of ids) {
      const answer = (d.clauses ?? {})[id];
      if (!answer) {
        fail('B1', `\`${file}\` diverges from section ${sec} and does NOT answer **${id}** — "${clauses.get(id).text}". Every clause of a section you diverge from gets an answer: met | dropped (with a reason) | owed. THIS IS THE CHECK: ReceiptsList's own header explained dropping the grid shape and said nothing about G4/G5/G6, and the surface has none of them.`);
        continue;
      }
      const verdict = typeof answer === 'string' ? answer : answer.verdict;
      if (!VERDICTS.has(verdict)) {
        fail('B2', `\`${file}\` answers ${id} with "${verdict}" — not one of met | dropped | owed.`);
      }
      if (verdict === 'dropped' && !(answer.reason ?? '').trim()) {
        fail('B3', `\`${file}\` drops **${id}** with no reason. "Dropped" without a sentence is the silent divergence this cap exists to stop (§6 r16: name the standard, THEN decide).`);
      }
    }
  }
  if (!(d.recorded_where ?? '').trim()) {
    fail('B4', `\`${file}\` declares a divergence but does not say WHERE it is recorded for a human. The 2026-09-03 finding was that a correct divergence filed only in a component comment is invisible to the person writing the next prompt — a declaration must be visible where a prompt-writer looks, not only where a compiler looks.`);
  }
}

// ── CHECK A — POPULATION. Baseline-and-ratchet. ─────────────────────────────────────────────
const undeclared = bespoke.filter(f => !declared.has(f));
const baseA = decl.baseline?.undeclared_bespoke_surfaces;
if (typeof baseA !== 'number') {
  fail('A0', `${DECLS} carries no numeric \`baseline.undeclared_bespoke_surfaces\`. Measured now: ${undeclared.length}.`);
} else if (undeclared.length > baseA) {
  const added = undeclared.slice(0, 6).join(', ');
  fail('A1', `${undeclared.length} bespoke record-list surfaces carry no divergence declaration; the baseline is ${baseA}. A NEW one was added. Either use the shared control, or declare the divergence clause by clause. (${added}${undeclared.length > 6 ? ', …' : ''})`);
}

// ── CHECK D — THE BOARD COVERS THE DOC. Baseline-and-ratchet. ───────────────────────────────
// The doc promises "remaining gaps are visible, not buried". Measured 2026-09-03: the board
// rendered 3 of 6 sections, so E1 — the clause that answers modal-vs-route — was not on the
// board a prompt-writer would check. That finding, made mechanical.
let unrendered = [];
if (existsSync(join(ROOT, BOARD))) {
  const board = read(BOARD);
  unrendered = [...clauses.keys()].filter(id => !new RegExp(`id\\s*:\\s*['"]${id}['"]`).test(board));
}
const baseD = decl.baseline?.clauses_absent_from_board;
if (typeof baseD !== 'number') {
  fail('D0', `${DECLS} carries no numeric \`baseline.clauses_absent_from_board\`. Measured now: ${unrendered.length} (${unrendered.join(', ')}).`);
} else if (unrendered.length > baseD) {
  fail('D1', `${unrendered.length} clauses are defined in ${STANDARD} and rendered nowhere on ${BOARD}; the baseline is ${baseD}. A standard nobody can see on the board is a standard the next prompt will not check. Absent: ${unrendered.join(', ')}`);
}

// ── report ──────────────────────────────────────────────────────────────────────────────────
function report() {
  const head = `[ui-standard-divergence] ${clauses.size} clauses derived from ${STANDARD} · ${population.length} record-list surfaces · ${bespoke.length} bespoke · ${declared.size} declared · ${undeclared?.length ?? '?'} undeclared (baseline ${baseA ?? '—'}) · ${unrendered?.length ?? '?'} clauses absent from the board (baseline ${baseD ?? '—'})`;
  if (findings.length === 0) { console.log(`✅ ${head}`); process.exit(0); }
  console.error(`❌ ${head}\n`);
  for (const f of findings) console.error('  ' + f + '\n');
  process.exit(1);
}
report();
