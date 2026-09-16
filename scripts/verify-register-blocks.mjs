#!/usr/bin/env node
// ============================================================
// verify-register-blocks — EVERY FLAGGED CLOSE-OUT HAS A LINE IN THE REGISTER
// PURPOSE:  Asserts CLAUDE.md §3b's own clause, which nothing asserted:
//             "A close-out that adds a FLAGGED FOR DAVID item adds a line to the
//              register too — that is what survives the N=3 rotation."
//           THE RULE: every close-out ledger row whose §3 entry (live OR archived)
//           carries `FLAGGED FOR DAVID` owes a block in docs/open-questions.md —
//           a `**#N — …**` heading — or a declaration, with its reason, in
//           register-block-declarations.json.
//
// 🔴 WHY IT MATTERS — THE REGISTER IS THE ONLY SURFACE THAT SURVIVES.
//   §3 rotates at N=3, and docs/handoff-archive.md is NOT loaded at session open.
//   So a question written only into a §3 entry is on screen for three close-outs and
//   then, for every practical purpose, gone. docs/open-questions.md exists precisely
//   to outlive that rotation — it is the one place David's queue is counted.
//   On 2026-09-15 two register blocks — #331's and #333's — VANISHED in a merge
//   conflict resolution, FOUR days after the register was built (ece2d1a, 2026-09-11),
//   and nothing said a word. Both sessions had FLAGGED FOR DAVID items. Their
//   questions reached neither surface. The register failed in exactly the way it was
//   built to prevent, and the failure was silent because the clause that required the
//   block was a sentence, not a check. Ledger #339.
//
// ⚠️ WHY IT IS NOT IN THE PRE-COMMIT HOOK. #325's header forbids a second check there,
//   correctly: the hook's value is that it is fast enough never to be disabled.
//
// THE DECLARATION LIST PRUNES ITSELF (tech-debt #73). A declaration is STALE, and fails,
//   if its id has no ledger row, if the row owes nothing (no flagged entry), or if the
//   register has since gained a block for it. A gap list that only grows stops being read.
//
// ⚠️ DECLARED ROWS ABOVE #302 ARE PRINTED ON EVERY RUN. #302 is the row that BUILT the
//   register. A declaration below it records history the register never covered; one
//   above it records a question that was LOST after the register existed, and that must
//   not become quiet just because it is written down.
//
// DEPENDENCIES: node; scripts/lib/handoffEntries.mjs (the same entry/claim parsing
//               verify-handoff-retention uses — the two caps must agree on what an
//               entry claims).
// OUTPUTS:      exit 0 / exit 1 with each owed row named. `--self-test` runs the probes.
// ============================================================
import { readFileSync } from 'node:fs';
import { section3, entries, ledgerCloseOutIds, claimedIds } from './lib/handoffEntries.mjs';

const CLAUDE = 'CLAUDE.md';
const ARCHIVE = 'docs/handoff-archive.md';
const LEDGER = 'docs/CLOSE-OUT-LEDGER.md';
const REGISTER = 'docs/open-questions.md';
const DECLARATIONS = 'register-block-declarations.json';
const REGISTER_BUILT_BY = 302;
const FLAG = 'FLAGGED FOR DAVID';
const SELF_TEST = process.argv.includes('--self-test');

/**
 * Ledger ids a register block covers — every `#N` BEFORE the ` — ` of a block heading.
 * `**#294a / #280 ① — …**` covers both; `**#336 — the missing `#332` row …**` covers
 * #336 ONLY. A mention in the title is not coverage (the same rule check 5 applies to
 * §3 headlines: a mention is not a claim).
 */
export function registerBlockIds(registerMd) {
  const ids = new Set();
  for (const m of registerMd.matchAll(/^\*\*(#[^\n]*?) — /gm)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) ids.add(n[1]);
  }
  return ids;
}

/** Rows whose claiming entry — live or archived — carries FLAGGED FOR DAVID. */
export function flaggedRows(ledgerMd, allEntries) {
  const rows = new Set(ledgerCloseOutIds(ledgerMd));
  const out = new Set();
  for (const e of allEntries) {
    if (!e.text.includes(FLAG)) continue;
    for (const id of claimedIds(e.heading)) if (rows.has(id)) out.add(id);
  }
  return out;
}

export function checkRegisterBlocks(ledgerMd, allEntries, registerMd, declarationsRaw) {
  let declared;
  try {
    declared = JSON.parse(declarationsRaw).declarations ?? {};
  } catch (err) {
    return { problems: [`${DECLARATIONS} is not valid JSON (${err.message}). The exceptions list must parse or the check cannot run — and a check that cannot run is not a check (§6 r19).`], owed: [], flagged: 0, loudDeclared: [] };
  }
  const rows = new Set(ledgerCloseOutIds(ledgerMd));
  const flagged = flaggedRows(ledgerMd, allEntries);
  const blocks = registerBlockIds(registerMd);
  const byId = (a, b) => Number(a) - Number(b);
  const problems = [];

  // ── direction one — a flagged row with no block and no declaration ────────
  const owed = [...flagged].filter(id => !blocks.has(id) && !(id in declared)).sort(byId);
  if (owed.length) {
    problems.push(
      `${owed.length} close-out row(s) carry FLAGGED FOR DAVID and have NO block in ${REGISTER}: ${owed.map(i => '#' + i).join(' ')}\n` +
      `     §3 rotates at N=3 and the archive is not loaded at session open, so the register is the\n` +
      `     ONLY surface these questions survive on. Add a \`**#N — …**\` block — restored from the\n` +
      `     branch that wrote it if one existed — or declare it in ${DECLARATIONS} with the reason.`,
    );
  }

  // ── direction two — declarations that no longer describe a gap ────────────
  const stale = [];
  for (const id of Object.keys(declared).sort(byId)) {
    if (!rows.has(id)) stale.push(`#${id} — no such close-out row`);
    else if (!flagged.has(id)) stale.push(`#${id} — the row owes nothing (no entry carries FLAGGED FOR DAVID)`);
    else if (blocks.has(id)) stale.push(`#${id} — the register now HAS a block for it`);
  }
  if (stale.length) {
    problems.push(
      `${stale.length} declaration(s) in ${DECLARATIONS} are STALE:\n` +
      stale.map(s => `       · ${s}`).join('\n') +
      `\n     Remove them. A list of exceptions that cannot rot is the point (tech-debt #73).`,
    );
  }

  const loudDeclared = Object.keys(declared).filter(id => Number(id) > REGISTER_BUILT_BY).sort(byId);
  return { problems, owed, flagged: flagged.size, loudDeclared };
}

if (!SELF_TEST) {
  const claudeMd = readFileSync(CLAUDE, 'utf8');
  const s3 = section3(claudeMd);
  if (s3 === null) {
    console.error('❌ register-blocks: could not find "## 3. HANDOFF" in CLAUDE.md.');
    process.exit(1);
  }
  const all = [...entries(s3), ...entries(readFileSync(ARCHIVE, 'utf8'))];
  const registerMd = readFileSync(REGISTER, 'utf8');
  const r = checkRegisterBlocks(readFileSync(LEDGER, 'utf8'), all, registerMd, readFileSync(DECLARATIONS, 'utf8'));

  // A cap that finds nothing to check is not passing — it is not reaching (#182).
  if (!r.problems.length && r.flagged === 0) r.problems.push('no close-out row carries FLAGGED FOR DAVID — the entry parse is broken, not the corpus clean (#182).');
  if (!r.problems.length && registerBlockIds(registerMd).size === 0) r.problems.push(`${REGISTER} yields NO block headings — the block parse is broken (#182).`);

  if (r.problems.length) {
    console.error('\n❌ register-blocks FAILED\n');
    for (const p of r.problems) console.error('  · ' + p + '\n');
    console.error('  Rule: CLAUDE.md §3b — a close-out that adds a FLAGGED FOR DAVID item adds a line to the register.\n');
    process.exit(1);
  }
  const declaredCount = Object.keys(JSON.parse(readFileSync(DECLARATIONS, 'utf8')).declarations).length;
  console.log(`✅ register-blocks — ${r.flagged} flagged close-out rows; every one has a register block or one of ${declaredCount} declarations.`);
  if (r.loudDeclared.length) {
    console.log(`  🟡 declared AFTER the register existed (above #${REGISTER_BUILT_BY}) — questions that may be lost, not history: ${r.loudDeclared.map(i => '#' + i).join(' ')}`);
  }
}

// ============================================================================
// SELF-TEST (STD-022 both directions · STD-024 the first probe is the real defect)
// ============================================================================
if (SELF_TEST) {
  const entry = (h, flagged) => ({ heading: h, text: `### ${h}\n\n**Type:** x\n\n${flagged ? '**FLAGGED FOR DAVID:** (a) a question' : 'nothing flagged'}` });
  const decls = o => JSON.stringify({ declarations: o });
  const block = id => `**#${id} — some work**\n- 🔴 OPEN — a question\n`;
  const probes = [
    // R1 — 🔴 THE REAL DEFECT (STD-024): 2026-09-15, #331 and #333 flagged, register without them.
    { name: 'R1  the real defect: two flagged rows whose blocks vanished',
      ledger: '| **#333** | a |\n| **#331** | b |\n| **#330** | c |',
      entries: [entry('2026-09-15 — THUNDER **THE OPENING STOCK SEED. #333.**', true),
                entry('2026-09-15 — THUNDER **THE ADDRESS IMPORT FIX. #331.**', true),
                entry('2026-09-15 — THUNDER **RESEARCH RECON. #330.**', true)],
      register: block(330), decls: decls({}), expect: true, owed: ['331', '333'],
      why: 'must REFUSE and name exactly #331 and #333' },
    // R2 — the passing direction.
    { name: 'R2  every flagged row has a block',
      ledger: '| **#333** | a |\n| **#331** | b |',
      entries: [entry('2026-09-15 — THUNDER **A. #333.**', true), entry('2026-09-15 — THUNDER **B. #331.**', true)],
      register: block(333) + block(331), decls: decls({}), expect: false, why: 'must PASS' },
    // R3 — an entry with nothing flagged owes nothing.
    { name: 'R3  an entry with no FLAGGED FOR DAVID owes no block',
      ledger: '| **#340** | a |', entries: [entry('2026-09-16 — THUNDER **A. #340.**', false)],
      register: block(1), decls: decls({}), expect: false, why: 'must PASS — the clause fires on flagged items only' },
    // R4 — a MENTION in a block title is not coverage.
    { name: 'R4  an id mentioned in a block TITLE is not covered',
      ledger: '| **#332** | a |', entries: [entry('2026-09-15 — THUNDER **FILE #332. #332.**', true)],
      register: '**#336 — the missing `#332` row, filed**\n- x\n', decls: decls({}), expect: true,
      why: 'must REFUSE — #336’s block mentions #332, it does not cover it' },
    // R5 — a multi-id block heading covers every id before the dash.
    { name: 'R5  `**#294 / #280 ① — …**` covers both ids',
      ledger: '| **#294** | a |\n| **#280** | b |',
      entries: [entry('2026-09-14 — THUNDER **X. #294.**', true), entry('2026-09-12 — THUNDER **Y. #280.**', true)],
      register: '**#294a / #280 ① — two items**\n- x\n', decls: decls({}), expect: false, why: 'must PASS' },
    // R6 — an ARCHIVED entry counts exactly like a live one.
    { name: 'R6  a flagged entry that has rotated to the archive still owes its block',
      ledger: '| **#250** | a |', entries: [entry('2026-09-01 — THUNDER **OLD. #250.**', true)],
      register: block(1), decls: decls({}), expect: true, why: 'must REFUSE — rotation is exactly when the block matters' },
    // R7 — a declaration excuses the row.
    { name: 'R7  a declared gap passes',
      ledger: '| **#250** | a |', entries: [entry('2026-09-01 — THUNDER **OLD. #250.**', true)],
      register: block(1), decls: decls({ 250: 'predates the register' }), expect: false, why: 'must PASS' },
    // R8 — stale: no such row.
    { name: 'R8  a declaration for an id with no ledger row is stale',
      ledger: '| **#250** | a |', entries: [entry('2026-09-01 — THUNDER **OLD. #250.**', true)],
      register: block(250), decls: decls({ 999: 'x' }), expect: true, why: 'must REFUSE' },
    // R9 — stale: the block now exists.
    { name: 'R9  a declaration for a row that has since gained a block is stale',
      ledger: '| **#250** | a |', entries: [entry('2026-09-01 — THUNDER **OLD. #250.**', true)],
      register: block(250), decls: decls({ 250: 'x' }), expect: true, why: 'must REFUSE — the gap closed' },
    // R10 — stale: the row owes nothing.
    { name: 'R10 a declaration for a row that owes nothing is stale',
      ledger: '| **#250** | a |', entries: [entry('2026-09-01 — THUNDER **OLD. #250.**', false)],
      register: block(1), decls: decls({ 250: 'x' }), expect: true, why: 'must REFUSE' },
    // R11 — a RESERVED row is not a close-out.
    { name: 'R11 a ⏳ RESERVED row owes nothing',
      ledger: '| ⏳ **#341 — RESERVED** | r |', entries: [entry('2026-09-16 — THUNDER **A. #341.**', true)],
      register: block(1), decls: decls({}), expect: false, why: 'must PASS — reserving is not closing out' },
    // R12 — TECH-DEBT #N in a headline is not a ledger claim.
    { name: 'R12 TECH-DEBT #N in the headline does not make that row owe a block',
      ledger: '| **#270** | a |', entries: [entry('2026-09-11 — THUNDER **REVIEW ASK. #300. TECH-DEBT #270.**', true)],
      register: block(1), decls: decls({}), expect: false, why: 'must PASS — #270 there is a tech-debt id' },
    // R13 — 🔴 NEGATIVE CONTROL (#182): identical to R1 but the register holds the blocks.
    //        If the verdict did not track the REGISTER, R1 and R13 would agree.
    { name: 'R13 negative control — R1 with the blocks present passes',
      ledger: '| **#333** | a |\n| **#331** | b |',
      entries: [entry('2026-09-15 — THUNDER **A. #333.**', true), entry('2026-09-15 — THUNDER **B. #331.**', true)],
      register: block(331) + block(333) + block(330), decls: decls({}), expect: false,
      why: 'must PASS — proves the register is actually read' },
    // R14 — a check that cannot run is not a check.
    { name: 'R14 unparseable declarations fail loudly',
      ledger: '| **#250** | a |', entries: [], register: block(1), decls: '{ nope', expect: true, why: 'must REFUSE' },
  ];
  let failed = 0;
  for (const p of probes) {
    const r = checkRegisterBlocks(p.ledger, p.entries, p.register, p.decls);
    let ok = (r.problems.length > 0) === p.expect;
    if (ok && p.owed) ok = JSON.stringify(r.owed) === JSON.stringify(p.owed);
    if (!ok) failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${p.name} — ${p.why}${ok ? '' : `  [GOT ${r.problems.length ? 'refuse' : 'pass'} owed=${r.owed}]`}`);
  }
  if (failed) {
    console.error(`\n❌ register-blocks --self-test: ${failed}/${probes.length} probes FAILED.\n`);
    process.exit(1);
  }
  console.log(`\n✅ register-blocks --self-test — ${probes.length}/${probes.length} probes, both directions.`);
}
