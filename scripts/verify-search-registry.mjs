#!/usr/bin/env node
/**
 * verify-search-registry — ONE ITEM-SEARCH MODULE, AND NOBODY QUIETLY WRITES A SECOND.
 *
 * PURPOSE:      David's ruling, 2026-09-23: *"inventory already has the filter type function, why
 *               not reuse that like we should."* This fails the build when a second implementation
 *               of the matching rule appears, when a consumer is undeclared, or when a
 *               declaration has gone stale.
 *
 * 🔴 THE DEFECT IT ENCODES. Checkout's `searchStockLines` matched on `sku` — **populated on 1 of
 *    632 live LAWNS rows** — while the code the grid displays lives in `qb_item_name` on **632 of
 *    632**. That is ledger #384's fix never reaching a second surface. Nothing failed; the two
 *    searches simply answered the same question differently, and only one of them was right.
 *
 * ⚠️ THE HEURISTIC IS DELIBERATELY NARROW AND ITS BLIND SPOT IS NAMED: it matches the shapes a new
 *    hand-rolled search is actually written in (`x.toLowerCase().includes(term|q)`), and it does
 *    NOT match `searchStockLines`' own form (`name.includes(t)` with `t` hoisted). Widening it to
 *    catch every `.includes(<short var>)` would flag ordinary string checks across the codebase and
 *    be switched off within a week — tech-debt #73's lesson, that a cap red on arrival does not
 *    survive. **So this catches the next copy, not every conceivable one, and says so.**
 *
 * ⚠️ IT IS A GREP, AND IT SAYS SO. It cannot prove semantic equivalence — it asserts that the
 *    places which FILTER INVENTORY-SHAPED ROWS route through the declared module, and that every
 *    exception is written down with a reason. Same shape as `verify:writer-registry`.
 *
 * ⚠️ THE DECLARATION LIST PRUNES ITSELF IN BOTH DIRECTIONS (tech-debt #73's lesson): a declared
 *    file that no longer exists, or an exception whose file no longer contains a matcher, FAILS.
 *
 * USAGE: node scripts/verify-search-registry.mjs [--self-test]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REG = JSON.parse(readFileSync('search-registry.json', 'utf8'));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !n.endsWith('.test.ts') && !n.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

/**
 * A "second matcher" is a file that filters rows on a text term by hand. The signature we refuse:
 * `.includes(` applied to something lowercased, in a file that also names inventory row fields.
 * Narrow on purpose — a broad rule would flag every string check in the codebase and be turned off
 * within a week (tech-debt #73: a cap that is red on arrival does not survive).
 */
function looksLikeAnItemMatcher(src) {
  const code = strip(src);
  const handRolled = /\.toLowerCase\(\)\s*\.includes\(|includes\(\s*\w*[Tt]erm|includes\(\s*q\b/.test(code);
  const inventoryish = /\bqb_item_name\b|\bsku\b/.test(code) && /\bname\b/.test(code);
  return handRolled && inventoryish;
}

function check(root = process.cwd()) {
  const problems = [];
  const declared = new Set([
    REG.module.matcher,
    ...REG.consumers.flatMap(c => [c.fields, c.appliedBy]),
    ...REG.declaredExceptions.map(e => e.file),
  ]);

  // ① every declared path exists — a declaration naming a deleted file is stale, not harmless.
  for (const f of declared) {
    if (!existsSync(join(root, f))) problems.push(`declared file does not exist (STALE): ${f}`);
  }

  // ② the module really exports what it claims.
  if (existsSync(join(root, REG.module.matcher))) {
    const src = readFileSync(join(root, REG.module.matcher), 'utf8');
    for (const ex of REG.module.exports) {
      if (!new RegExp(`export (function|const) ${ex}\\b`).test(src)) {
        problems.push(`the module does not export "${ex}" — the registry describes a module that is not there`);
      }
    }
  }

  // ③ 🔴 NO SECOND MATCHER. Scan the app surface; anything that looks like one must be declared.
  const files = [...walk(join(root, 'packages/cultivar-os/src')), ...walk(join(root, 'packages/shared/src'))]
    .map(f => f.slice(root.length + 1));
  for (const f of files) {
    if (declared.has(f)) continue;
    if (looksLikeAnItemMatcher(readFileSync(join(root, f), 'utf8'))) {
      problems.push(
        `SECOND ITEM SEARCH: ${f} filters inventory-shaped rows with its own matcher.\n` +
        `     Route it through ${REG.module.matcher} (matchesHaystack / matchesSearch), or declare it\n` +
        `     in search-registry.json with a reason. Two searches means two behaviours from one promise.`,
      );
    }
  }

  // ④ AN EXCEPTION THAT NO LONGER DESCRIBES ANYTHING IS STALE — the other direction (#73's lesson).
  // 🔴 IT ASKS FOR THE DECLARED SYMBOL, NOT FOR THE HEURISTIC'S OPINION. A first draft asserted
  // that `looksLikeAnItemMatcher` still recognised the excused file, and it went red on the live
  // corpus: `searchStockLines` compares `name.includes(t)` where `t` is a hoisted const, which the
  // deliberately-narrow heuristic does not match. That conflated two different questions — "is this
  // file still a hand-rolled matcher by my grep's spelling?" and "is the thing I excused still
  // here?". Only the second is what staleness means.
  for (const e of REG.declaredExceptions) {
    const p = join(root, e.file);
    if (!existsSync(p)) continue;                        // ① already reported it
    if (e.symbol && !new RegExp(`\\b${e.symbol}\\b`).test(readFileSync(p, 'utf8'))) {
      problems.push(`STALE EXCEPTION: ${e.file} no longer contains "${e.symbol}" — remove its entry.`);
    }
  }
  return problems;
}

function selfTest() {
  let passed = 0, failed = 0;
  const ok = (c, m) => { if (c) passed++; else { failed++; console.error('   ✗ ' + m); } };
  // 🔴 PLANTED, NOT DESCRIBED — the exact shape of the defect this exists for.
  const planted = `
    const rows: Array<{ name: string; sku: string | null; qb_item_name: string | null }> = [];
    export function findItem(term: string) {
      const q = term.toLowerCase();
      return rows.filter(r => (r.name + (r.sku ?? '')).toLowerCase().includes(q));
    }`;
  ok(looksLikeAnItemMatcher(planted), 'A 🔴 a planted second matcher IS recognised — the check can refuse');
  ok(!looksLikeAnItemMatcher('export const x = "hello".includes("ell");'),
    'B 🔴 NEGATIVE CONTROL — an ordinary string check is NOT flagged; a cap that is red on arrival does not survive (#73)');
  ok(!looksLikeAnItemMatcher('const s = name.toLowerCase().includes(q);'),
    'C NEGATIVE CONTROL — lowercased includes WITHOUT inventory fields is not an item search');
  ok(looksLikeAnItemMatcher(`const r = { qb_item_name: '', name: '' }; x.filter(v => v.toLowerCase().includes(term));`),
    'D …and WITH them it is');
  const live = check();
  ok(live.length === 0, `E the live corpus passes — got ${live.length} problem(s): ${live.join(' | ').slice(0, 160)}`);
  console.log(`\nverify-search-registry --self-test — ${passed} passed, ${failed} failed`);
  return failed === 0;
}

if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
const problems = check();
if (problems.length) {
  console.error('\n❌ search-registry FAILED\n');
  for (const p of problems) console.error('  · ' + p);
  console.error('\n  Rule: CLAUDE.md — ONE item-search module (ledger #388, David 2026-09-23).\n');
  process.exit(1);
}
console.log(`✅ search-registry — one matcher (${REG.module.matcher}), ${REG.consumers.length} declared consumer(s), ${REG.declaredExceptions.length} declared exception(s).`);
