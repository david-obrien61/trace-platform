/**
 * ── loadListPage — the PRINTED page, asserted as source ────────────────────────────
 *
 * 🔴 WHY THIS FILE EXISTS: `loadList.test.ts` probes the MODEL and cannot see the page. Mutant P1
 * in `measure-load-list-mutants.mjs` proves it — deleting the entire unresolved block from
 * `LoadList.tsx` leaves all 71 model assertions green. That is tech-debt #182's shape ("a harness
 * that cannot reach its target reports the same as one that passed"), and the answer is a probe
 * that reads the .tsx.
 *
 * These are SOURCE assertions, not a render. A render condition inside a .tsx cannot be asserted
 * without a DOM (tech-debt #134), and the claims that matter here are structural: does the page
 * render each bucket, does the print stylesheet hide the chrome, is `window.print()` reachable.
 * Stated plainly so nobody reads them as proof the page LOOKS right — that is CARD 1's job.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/loadListPage.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(process.cwd(), 'packages/cultivar-os/src/pages/LoadList.tsx');
const ROUTER = join(process.cwd(), 'packages/cultivar-os/src/router.tsx');
const src = readFileSync(PAGE, 'utf8');
const router = readFileSync(ROUTER, 'utf8');

/**
 * 🔴 THE PAGE WITH ITS COMMENTS REMOVED — for NEGATIVE assertions only.
 *
 * The first draft of C8 asserted `!/document\.write/.test(src)` and went RED against correct code,
 * because this page's own header explains WHY it does not use `document.write`. A probe that reads
 * its subject's prose as its subject is **tech-debt #146**, whose worst instance *"would have
 * passed on a DELETED guard"* — here it failed on a present one, which is the same defect wearing
 * the other face. Every "this must NOT appear" check runs against CODE.
 *
 * ⚠️ Deliberately crude: it strips block and line comments and nothing else. It is not a parser and
 * must not be used for a POSITIVE assertion, where a false negative would silently pass.
 */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ══ §A EVERY BUCKET THE MODEL PRODUCES IS RENDERED ════════════════════════════════
// The model can refuse perfectly and the page can still drop the refusal on the floor.
{
  ok(/export function LoadList/.test(src), 'A0: the page was READ and is the file it claims to be');

  for (const bucket of ['model.unresolved', 'model.noSizeStated', 'model.otherGoods', 'model.stops', 'model.trees']) {
    ok(src.includes(`${bucket}.map(`),
      `🔴 A: the page RENDERS ${bucket} — a bucket the model fills and the page ignores is the same omission, one layer out`);
  }
  ok(/model\.unresolved\.length > 0 \?/.test(src),
    'A6: the unresolved block is rendered when there is anything in it (P1 mutates exactly this)');
  ok(/model\.unreadStops > 0 \?/.test(src),
    '🔴 A7: a day containing a withheld or unreadable stop warns at the TOP that the list may be short');
  ok(/model\.totalsAreFloors \?/.test(src),
    '🔴 A8: the FLOOR warning is rendered — otherwise a partial T-post total prints as a complete one');
  ok(/deerFenceGap/.test(src) && /deerFence95Open/.test(src),
    '🔴 A9: the deer-fence gap AND the open 95 gallon question are both on the page');
}

// ══ §B THE PER-STOP BREAKDOWN CARRIES THE PROBLEM SENTENCE ════════════════════════
{
  ok(/s\.problem \?/.test(src),
    '🔴 B1: a stop that could not be read prints WHY, rather than as an ordinary stop with no items');
  ok(/s\.items\.map\(/.test(src),
    'B2: every stop prints its own lines — the per-stop breakdown is what you need when a stop gets dropped');
  ok(/s\.unresolvedCount > 0/.test(src),
    'B3: a stop carrying a line nobody could read says so on its OWN row, not only in the day total');
  // B3b (negative) — the out-of-ladder concept is GONE from the page too, not just from the model.
  // A page still rendering "no T-post rule" over a model that always has one would be a printed
  // sentence contradicting the number beside it.
  ok(!/no T-post rule|work out by hand|tPostsUnknownTrees/.test(src),
    '🔴 B3b (negative): no "work it out by hand" text survives anywhere — every readable size is computed');
  ok(/No address recorded/.test(src),
    'B4: a stop with no address says so rather than printing an empty line (D-9)');
}

// ══ §C THE PRINT RULES — this is a piece of paper, not a screen ═══════════════════
{
  ok(/@media print/.test(src), 'C1: there is a print stylesheet');
  ok(/\.no-print\s*\{\s*display:\s*none/.test(src),
    '🔴 C2: the chrome (date picker, Print button) is hidden on paper');
  ok(/className="no-print"/.test(src),
    'C3: and the control bar actually carries that class');
  ok(/page-break-inside:\s*avoid/.test(src),
    '🔴 C4: a stop is never split across a page boundary — half a stop on a page is a misread load');
  ok(/page-break-after:\s*always/.test(src),
    '🔴 C5: the consolidated headline gets its own page — "one page per day" starts with the page the yard person carries');
  ok(/@page\s*\{[^}]*margin/.test(src), 'C6: the page has print margins');
  ok(/window\.print\(\)/.test(src), 'C7: the page prints itself — no PDF dependency, no generated window');

  // C8 — 🔴 print is a stylesheet on a real route, NOT `document.write` of an interpolated string.
  // `shared/qr/print.ts` interpolates UNESCAPED; this page renders customer names and typed
  // addresses, so React's escaping is the security property, not a convenience.
  ok(!/document\.write|window\.open/.test(code),
    '🔴 C8 (negative): the page NEVER builds HTML by string interpolation — every value is escaped by React');
  // C8b — and the stripper must actually be doing something, or C8 is asserting over the raw file
  // again without anyone noticing (tech-debt #182: a check that cannot reach its target).
  ok(/document\.write/.test(src) && !/document\.write/.test(code),
    '🔴 C8b: the comment stripper is REACHING — the phrase is in the header prose and NOT in the code');
}

// ══ §D THE READ — one stop read, and honest about what it may not see ═════════════
{
  ok(/readStops\(/.test(src) && /from '\.\.\/lib\/stopRead'/.test(src),
    "🔴 D1: the day is read through the ONE shared stop read, never a fourth composition of its own (§6 r8 / STD-017)");
  ok(/can\('order_items:read'\)/.test(src),
    'D2: line reading is asked for explicitly, so a viewer without it gets "withheld" rather than an empty order');
  ok(/buildLoadList\(/.test(src),
    'D3: every number on the page comes from the pure model — the page computes no bill of materials of its own');

  // D4 (negative) — no arithmetic in the .tsx. A number computed in a render cannot be asserted.
  ok(!/tPostsByGallons|mixContainerVolumesPerTree|ringByGallons/.test(src),
    '🔴 D4 (negative): the bill-of-materials rules are NEVER re-derived in the page');
}

// ══ §E INSTRUMENTATION + ROUTE ════════════════════════════════════════════════════
{
  ok(/\[TRACE:LOADLIST\]/.test(src), 'E1: STD-003 — the build ships instrumentation');
  ok(/const TRACE_LOADLIST = true/.test(src),
    '🔴 E2: it is ON by default, not flagged off (standing owner instruction — ON until David owner-proves)');

  ok(/path="\/load-list"/.test(router), 'E3: the route is wired');
  // E4 — the gate. Sliced between the two real `<PermissionRoute permission="…">` ATTRIBUTES, not
  // between bare permission strings: the first draft sliced on `router.indexOf('deliveries.route:read')`,
  // which hit a COMMENT thirteen lines ABOVE the block it meant, producing an empty slice and a red
  // probe against a correctly wired route. Same class as C8 — tech-debt #146, prose read as code.
  const OPEN = 'permission="deliveries:read"';
  const NEXT = 'permission="deliveries.route:read"';
  const from = router.indexOf(OPEN), to = router.indexOf(NEXT);
  ok(from !== -1 && to !== -1 && to > from,
    '🔴 E4a: the two permission blocks were located in order — an empty slice would make E4b vacuous');
  ok(router.slice(from, to).includes('path="/load-list"'),
    '🔴 E4b: the load list is gated on `deliveries:read` — the same day, read the same way, as the schedule');
  // E4c (negative) — and it is NOT behind the route-handoff permission, which gates a different act.
  ok(!router.slice(to).split('</Route>')[0].includes('path="/load-list"'),
    'E4c (negative): it is not inside the `deliveries.route:read` block');
}

console.log(`\nloadListPage: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
