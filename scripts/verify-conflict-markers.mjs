#!/usr/bin/env node
/**
 * ── verify-conflict-markers — a merge that was never finished must not reach `main` ──────────
 *
 * PURPOSE:      HISTORY found `>>>>>>> origin/main` COMMITTED at `docs/built-inventory.md:7` on
 *               `main` (2026-09-21), and the whole of `npm run verify` had passed over it —
 *               128/128 files, zero net-new. Nothing in the chain looked for one. A human found
 *               it by reading, which is the definition of a gap a cap should close.
 *               ⚠️ It was MY marker: ledger #364's header rebuild kept the region below the
 *               header verbatim and the marker rode along. This is the check I owed that build.
 * DEPENDENCIES: git (for the tracked-file list). No network, no database.
 * OUTPUTS:      exit 0 when the tree is clean · exit 1 naming every file:line · `--self-test`.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 WHY `=======` IS NOT MATCHED ON ITS OWN, AND THAT IS THE WHOLE DESIGN
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * A bare row of equals signs is ORDINARY TEXT in this repo: `CLAUDE.md` and most migrations use
 * it as a rule under a heading, and Markdown uses it for a setext H1. A cap that flagged it would
 * be red on arrival across dozens of legitimate files — and a cap that is red on arrival gets
 * switched off (#73's lesson). Worse, a previous session's own filter DID mangle `CLAUDE.md` for
 * exactly this reason, which is the incident this file is careful about.
 *
 * So the third form is matched ONLY WHERE IT MEANS SOMETHING: a `=======` line that sits between
 * an opening `<<<<<<< ` and a closing `>>>>>>> `. Inside that region it is a marker; outside it
 * is a horizontal rule, and this check says nothing about it.
 *
 * The two unambiguous forms are matched by SHAPE, not by spelling: exactly seven `<` or `>` at
 * the start of a line, then a space, then a ref name. Seven is what git writes; six or eight is
 * somebody's ASCII art.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const OPEN  = /^<{7} \S/;
const CLOSE = /^>{7} \S/;
const MID   = /^={7}$/;

/** Every marker in one file's text, as {line, kind, text}. Pure — the self-test drives it. */
export function markersIn(text) {
  const out = [];
  const lines = text.split('\n');
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (OPEN.test(l))  { out.push({ line: i + 1, kind: 'open',  text: l }); open = i; continue; }
    if (CLOSE.test(l)) { out.push({ line: i + 1, kind: 'close', text: l }); open = -1; continue; }
    // Only a separator INSIDE an unclosed region. Everywhere else it is a horizontal rule.
    if (MID.test(l) && open >= 0) out.push({ line: i + 1, kind: 'separator', text: l });
  }
  return out;
}

/** The files this repo tracks, minus the ones that legitimately contain marker-shaped text. */
function trackedFiles() {
  const out = execSync('git ls-files -z', { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

// 🔴 THIS FILE AND ITS TEST DESCRIBE THE MARKERS, SO THEY WOULD FLAG THEMSELVES. Named, not
// pattern-matched: a broad "skip anything under scripts/" would hide a real marker in a script.
const SELF = new Set([
  'scripts/verify-conflict-markers.mjs',
  'scripts/verify-conflict-markers.test.mjs',
]);

function main() {
  const hits = [];
  for (const f of trackedFiles()) {
    if (SELF.has(f) || !existsSync(f)) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }   // binary or unreadable
    if (!text.includes('<<<<<<<') && !text.includes('>>>>>>>')) continue;   // cheap pre-filter
    for (const m of markersIn(text)) hits.push({ file: f, ...m });
  }
  if (hits.length === 0) {
    console.log('✅ conflict-markers — no unfinished merge is committed anywhere in the tree.');
    return 0;
  }
  console.log(`\n❌ conflict-markers FAILED — ${hits.length} marker(s) committed:\n`);
  for (const h of hits) console.log(`  · ${h.file}:${h.line}  [${h.kind}]  ${h.text.slice(0, 60)}`);
  console.log('\n  A committed marker is a merge nobody finished. Resolve it, then re-run.');
  console.log('  Found once on `main` by a human (2026-09-21) after the whole verify chain passed over it.');
  return 1;
}

function selfTest() {
  let pass = 0; const fails = [];
  const ok = (c, m) => { if (c) pass++; else fails.push(m); };
  const N = '\n';

  ok(markersIn(`a${N}<<<<<<< HEAD${N}b${N}`).length === 1, 'P1 an opening marker is found');
  ok(markersIn(`a${N}>>>>>>> origin/main${N}`).length === 1, 'P2 a closing marker is found');
  ok(markersIn(`<<<<<<< HEAD${N}a${N}=======${N}b${N}>>>>>>> x${N}`).length === 3,
     'P3 a whole conflict is found — all three forms');
  ok(markersIn(`<<<<<<< HEAD${N}a${N}=======${N}b${N}>>>>>>> x${N}`)[1].kind === 'separator',
     'P4 …and the middle one is reported as the separator');

  // 🔴 THE NEGATIVE CONTROLS ARE THE POINT OF THIS CAP.
  ok(markersIn(`Heading${N}=======${N}text`).length === 0,
     'P5 🔴 a setext H1 underline is NOT a marker');
  ok(markersIn(`-- ═══${N}=======${N}-- more`).length === 0,
     'P6 🔴 a rule under a comment heading is NOT a marker — CLAUDE.md and the migrations are full of them');
  ok(markersIn(`====== six${N}======== eight${N}`).length === 0, 'P7 🔴 six or eight equals signs are not git output');
  ok(markersIn(`<<<<<< HEAD${N}`).length === 0, 'P8 🔴 six angle brackets are not a marker');
  ok(markersIn(`<<<<<<<${N}`).length === 0, 'P9 🔴 seven brackets with NO ref is not what git writes');
  ok(markersIn(`  <<<<<<< HEAD${N}`).length === 0, 'P10 🔴 an indented line is prose about markers, not a marker');
  ok(markersIn(`a <<<<<<< HEAD${N}`).length === 0, 'P11 🔴 mid-line text is prose too');
  ok(markersIn(`=======${N}`).length === 0,
     'P12 🔴 A SEPARATOR OUTSIDE A REGION IS IGNORED — this is what keeps the cap off every heading rule in the repo');
  ok(markersIn('').length === 0 && markersIn('nothing here').length === 0, 'P13 clean text is clean');

  // The real corpus must be reachable, or this cap could pass while looking at nothing (#182).
  const files = trackedFiles();
  ok(files.length > 100, `P14 🔴 the tracked-file list is a real population (${files.length} files)`);
  ok(files.includes('CLAUDE.md'), 'P15 🔴 …and it includes CLAUDE.md, the file a naive grep would mangle');
  ok(markersIn(readFileSync('CLAUDE.md', 'utf8')).length === 0,
     'P16 🔴 CLAUDE.md is CLEAN under this rule, despite being full of ======= rules');

  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`conflict-markers self-test — ${pass} passed, ${fails.length} failed`);
  return fails.length === 0 ? 0 : 1;
}

process.exit(process.argv.includes('--self-test') ? selfTest() : main());
