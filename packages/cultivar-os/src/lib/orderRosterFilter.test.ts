/**
 * ── orderRosterFilter — every row is reachable, and the count says what it is hiding ──
 *
 * THE DEFECT THIS SUITE EXISTS TO PREVENT, and it is a real one from the day before this
 * build: `user_stories.md` carried three stories tagged `needs-build`, a status absent from
 * the renderer's <select>. They matched none of the six filters, were reachable only under
 * "all", and — the part that mattered — could not appear in the WHAT'S OWED view that exists
 * to raise them. A card tagged with a value no view can filter is invisible while looking
 * filed. The orders roster must not repeat it, so the chip set is DERIVED from the
 * vocabulary UNIONED with the data, and §B asserts exactly that.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/orderRosterFilter.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  rosterStatusChips, filterOrdersByStatus, rosterCountLabel, ROSTER_PAGE_LIMIT,
} from './orderRosterFilter';
import { ORDER_STATUSES } from './orderStatus';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const row = (status: string | null, id = '') => ({ status, id });

// ══ §A THE VOCABULARY IS THE RATIFIED FOUR ══════════════════════════════════
{
  ok(ORDER_STATUSES.length === 4, 'exactly four statuses');
  ok((ORDER_STATUSES as readonly string[]).includes('invoiced'),
    '`invoiced` is IN the vocabulary — which is what admits it to the committed-stock derivation');
  ok(!(ORDER_STATUSES as readonly string[]).includes('confirmed'),
    '🔴 `confirmed` is RETIRED. A chip for it would offer a filter that can match nothing');
  ok(ORDER_STATUSES[0] === 'pending' && ORDER_STATUSES[1] === 'invoiced',
    'lifecycle order: pending → invoiced reads left to right on the chip row');
}

// ══ §B ZERO UNREACHABLE ROWS — THE ACCEPTANCE CRITERION ═════════════════════
{
  // The data holds a value the vocabulary does not. This is the exact shape of the
  // `needs-build` defect, and the roster must survive it.
  const rows = [row('pending'), row('invoiced'), row('confirmed'), row('weird-legacy-value')];
  const chips = rosterStatusChips(rows);

  for (const r of rows) {
    ok(chips.some(c => c.value === String(r.status)),
      `every live status has a chip — including the stray "${r.status}"`);
  }

  const selectable = new Set(chips.map(c => c.value));
  const reachable = rows.filter(r => filterOrdersByStatus(rows, new Set([String(r.status)])).length > 0);
  ok(reachable.length === rows.length,
    '🔴 ZERO ORDERS ARE UNREACHABLE THROUGH THE UI — every row is selected by some chip');
  ok(selectable.size === chips.length, 'no duplicate chips');

  const stray = chips.find(c => c.value === 'confirmed');
  ok(stray?.known === false,
    'a status the vocabulary does not know is marked UNKNOWN, not silently dressed as canonical');
  ok(stray?.label === 'confirmed',
    'and it renders under its own raw name — a value we cannot explain is a fact about the data (D-9)');
}

// ══ §C CANONICAL CHIPS RENDER AT ZERO ═══════════════════════════════════════
{
  const chips = rosterStatusChips([row('pending'), row('pending')]);
  const cancelled = chips.find(c => c.value === 'cancelled');
  ok(cancelled !== undefined && cancelled.count === 0,
    'a canonical status with no rows still gets a chip, showing 0 — the vocabulary is visible even when unused');
  ok(chips.find(c => c.value === 'pending')?.count === 2, 'counts are per-status');
  ok(chips.filter(c => c.known).length === 4, 'the four canonical chips are always present');
}

// ══ §D MULTI-SELECT, AND EMPTY MEANS ALL ════════════════════════════════════
{
  const rows = [row('pending', 'a'), row('invoiced', 'b'), row('fulfilled', 'c'), row('cancelled', 'd')];

  ok(filterOrdersByStatus(rows, new Set()).length === 4,
    '🔴 AN EMPTY SELECTION MEANS ALL, NOT NONE — clearing the last chip returns to the default view, it does not empty the screen');
  ok(filterOrdersByStatus(rows, new Set(['pending'])).length === 1, 'one chip selects one');
  ok(filterOrdersByStatus(rows, new Set(['pending', 'invoiced'])).length === 2,
    'MULTI-SELECT: two chips select the union, not the intersection');
  ok(filterOrdersByStatus(rows, new Set(['pending', 'invoiced', 'fulfilled', 'cancelled'])).length === 4,
    'all four selected is the same set as none selected');
  ok(filterOrdersByStatus(rows, new Set(['nothing-matches'])).length === 0,
    'a selection matching no row yields an EMPTY result — which the UI must render as "no orders match", never as an error');
}

// ══ §E A NULL STATUS IS A ROW TOO ═══════════════════════════════════════════
{
  const rows = [row(null), row('pending')];
  const chips = rosterStatusChips(rows);
  ok(chips.some(c => c.value === ''), 'a NULL/absent status gets its own chip rather than falling through every filter');
  ok(chips.find(c => c.value === '')?.label === 'No status',
    'and it is labelled "No status" — an absent value announced as absent, never rendered as a present one (A9)');
  ok(filterOrdersByStatus(rows, new Set([''])).length === 1, 'and it is selectable');
}

// ══ §F THE COUNT SENTENCE SAYS WHAT IT IS HIDING ════════════════════════════
{
  ok(rosterCountLabel(4, 4, false) === '4 orders', 'unfiltered: a plain count');
  ok(rosterCountLabel(1, 1, false) === '1 order', 'singular');
  ok(rosterCountLabel(2, 9, true) === 'showing 2 of 9',
    '🔴 A FILTERED VIEW STATES HOW MANY OF HOW MANY — the screen says what it is hiding');
  ok(rosterCountLabel(0, 9, true) === 'showing 0 of 9',
    'zero matches still reports the total, so an empty screen reads as a filter result and not as "you have no orders"');

  // The page cap. The roster loads .limit(50) and the old header said "N recent checkouts".
  ok(rosterCountLabel(50, ROSTER_PAGE_LIMIT, false).includes('most recent 50'),
    '🔴 AT THE CAP, THE UNFILTERED COUNT NAMES THE CAP — 50 loaded may not be 50 existing');
  ok(rosterCountLabel(3, ROSTER_PAGE_LIMIT, true) === 'showing 3 of 50+',
    'and a filtered total at the cap reads "50+", because reporting a bare 50 would assert a total nobody counted');
  ok(!rosterCountLabel(3, 9, true).includes('+'),
    'below the cap there is no "+" — the total is genuinely known');
}

console.log(`\n${failed === 0 ? '✅' : '❌'} orderRosterFilter — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
