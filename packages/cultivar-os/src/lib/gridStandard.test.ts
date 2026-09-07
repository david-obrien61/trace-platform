/**
 * ── gridStandard — G11 holds on EVERY DataSheet consumer, not just the two we looked at ───────
 *
 * David, 2026-09-07:
 *   "🔴 THE INVENTORY GRID IS THE REFERENCE: ACTIONS · NAME · DATA. Customers conforms to it.
 *    Every DataSheet consumer conforms to it. File it as a clause — the G-clauses cover sort,
 *    filter and the read-only mark and say nothing about column order, which is why four grids
 *    have three different shapes."
 *
 * `columnOrder.test.ts` proves the ENGINE places the actions track correctly. This file proves the
 * CONSUMERS give it what it needs — because the engine's fallback is deliberately forgiving (a
 * grid with no declared identifier still renders, actions-first), so a missing declaration
 * produces a working screen and no complaint. That is the exact shape of a check that cannot
 * disagree, and the answer is to fail the FILE rather than wait for the screen to look wrong.
 *
 * 🔴 THE POPULATION IS DISCOVERED, NEVER LISTED (tech-debt #73's lesson: a hardcoded gap list
 * asserts nothing and rots into noise). Every file that renders `<DataSheet` is in scope the day
 * it is written, including one that does not exist yet.
 *
 * Run: node_modules/.bin/esbuild packages/cultivar-os/src/lib/gridStandard.test.ts \
 *        --bundle --platform=node --format=cjs | node
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const ROOT = process.cwd();
const SCAN = ['packages/cultivar-os/src', 'packages/shared/src'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** A CONSUMER is a file that RENDERS the shared grid. Importing `sheetStyles` from the same module
 *  does not make a file a grid — that is the #181 trap (a modal that borrows the chrome), and
 *  counting those would put six editors and an import wizard into a population they cannot satisfy. */
const consumers = SCAN.flatMap(d => walk(join(ROOT, d)))
  .filter(f => {
    const src = readFileSync(f, 'utf8');
    return /datasheet\/DataSheet'/.test(src) && /<DataSheet[\s<]/.test(src);
  })
  .map(f => f.slice(ROOT.length + 1))
  .sort();

ok(consumers.length >= 6,
   `§0 the consumer population is discovered from source, not listed — found ${consumers.length}: ${consumers.join(', ')}`);

/** Every column literal, in config order. Each one is `key: '<k>', header: …` — the two fields no
 *  column omits — which is also what keeps this from matching a JSX `key={…}` prop. */
interface Col { key: string; frozen: boolean; identifier: boolean; hasWidth: boolean }
function columnsOf(src: string): Col[] {
  const starts: { key: string; at: number }[] = [];
  const re = /key:\s*'([A-Za-z0-9_]+)'\s*,\s*header:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) starts.push({ key: m[1], at: m.index });
  return starts.map((s, i) => {
    const slice = src.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : Math.min(src.length, s.at + 1200));
    return {
      key: s.key,
      frozen: /\bfrozen:\s*true/.test(slice),
      identifier: /\bidentifier:\s*true/.test(slice),
      hasWidth: /\bfrozenWidth:\s*\d+/.test(slice),
    };
  });
}

for (const file of consumers) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const cols = columnsOf(src);
  const short = file.split('/').pop();

  ok(cols.length > 0, `§A ${short}: its column config was parsed at all (a grid this file cannot read is a grid it cannot check)`);

  // ── G11 ①: exactly one identifier ──
  const ids = cols.filter(c => c.identifier);
  ok(ids.length === 1,
     `🔴 §B ${short}: declares EXACTLY ONE \`identifier: true\` column (G11) — found ${ids.length}${ids.length ? ` (${ids.map(c => c.key).join(', ')})` : ''}. Without it the actions track falls back to leading, which still renders and still hides the mistake.`);

  // ── G11 ② + G3: the identifier is inside the LEADING CONTIGUOUS frozen run, or it does not pin ──
  let run = 0;
  while (run < cols.length && cols[run].frozen) run++;
  const idIdx = cols.findIndex(c => c.identifier);
  if (idIdx >= 0) {
    ok(idIdx < run,
       `🔴 §C ${short}: the identifier column \`${cols[idIdx].key}\` sits INSIDE the leading frozen run (index ${idIdx}, run ends at ${run}). This is the live defect the clause found: /inventory's Name carried \`frozen: true\` BEHIND a non-frozen column, so it was never pinned and only a horizontal scroll would have shown it.`);
  }

  // ── §6 r14: a frozen column reserves an ACTUAL width, or the offsets stop accumulating ──
  const widthless = cols.filter(c => c.frozen && !c.hasWidth).map(c => c.key);
  ok(widthless.length === 0,
     `§D ${short}: every frozen column declares \`frozenWidth\` (§6 r14) — missing on: ${widthless.join(', ') || 'none'}`);

  // ── G11 ③: no consumer hand-places an actions column. The engine owns that track. ──
  ok(!cols.some(c => /^(actions?|row_?actions)$/i.test(c.key)),
     `§E ${short}: does not hand-roll an "actions" COLUMN — the pinned actions track is the engine's (\`rowActions\`), which is what makes the order un-choosable`);
}

// ══ §F — THE ENGINE STILL DELEGATES ═════════════════════════════════════════
// The order is only un-choosable while DataSheet reads it from one place. If the arithmetic comes
// back inline, every assertion above still passes and the rule quietly stops being enforced.
{
  const engine = readFileSync(join(ROOT, 'packages/shared/src/components/datasheet/DataSheet.tsx'), 'utf8');
  ok(/from '\.\/columnOrder'/.test(engine) && /planTracks\(/.test(engine),
     '🔴 §F DataSheet.tsx still gets its pinned order from `columnOrder.ts` — the moment it recomputes offsets inline, the rule is back inside a .tsx where no probe can reach it (tech-debt #134)');
  ok(!/const\s+actionsPin\s*=/.test(engine),
     '§F …and the old "pin the actions AFTER the frozen run" local is gone, not merely bypassed');
}

console.log(`\ngridStandard: ${passed} passed, ${failed} failed  (${consumers.length} consumers)`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
