/**
 * ── orderKind — "which orders count", and whether the two answers can drift apart ──
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST, AND IT IS NOT THE PREDICATES. Three of them are one-line
 * `includes()` calls and nobody was ever going to get those wrong. The defect this module
 * exists to end is TWO REPRESENTATIONS OF ONE RULE — a JavaScript predicate and a PostgREST
 * filter string, each correct on its own and each capable of being edited without the other.
 * §D is therefore the file's centre of gravity: it EXECUTES the filter string against the same
 * rows the predicate judges and demands the same verdict, so a kind added to one list and
 * forgotten in the other fails the build.
 *
 * 🔴 AND §C IS THE ONE THAT WOULD HAVE CAUGHT THE REAL BUG. `.neq('order_kind','test')` reads
 * as "not a test order" and silently discards every NULL — which is every ordinary checkout
 * order this platform has ever written. A probe that only checked `isRealBusiness('test')`
 * would pass against a filter that excluded the entire business.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/orderKind.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  TEST_ORDER_KIND, HISTORY_ORDER_KIND,
  isRealBusiness, isAssessable, mayPushToQuickBooks,
  REAL_BUSINESS_PGRST, ASSESSABLE_PGRST, describeOrderKind,
} from './orderKind';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// Every kind the column can currently hold, plus the two that stand for "something nobody
// thought of". NULL is first because it is the majority of the live table.
const KINDS: (string | null | undefined)[] = [
  null, undefined, '', 'history', 'test', 'quote', 'subscription',
];

// ══ §A THE VOCABULARY ═══════════════════════════════════════════════════════
{
  ok(TEST_ORDER_KIND === 'test', 'the test discriminator is the literal `test`');
  ok(HISTORY_ORDER_KIND === 'history',
    'and history is re-exported from its own module, not re-spelled here (one definition)');
}

// ══ §B THE THREE QUESTIONS, AND THEY ARE GENUINELY DIFFERENT QUESTIONS ══════
{
  // 🔴 The headline: a test order counts NOWHERE, and a history order counts as MONEY but
  // not as an ASSESSMENT. If these two rows ever agree, one of the predicates has collapsed
  // into the other and a real sale has stopped being revenue (or an unassessed one has
  // started proving a clean bill of health).
  ok(isRealBusiness(null) === true,  'an ordinary checkout order (NULL) is real business');
  ok(isRealBusiness('history') === true,
    '🔴 a CAPTURED INVOICE IS REAL MONEY — it is a paid sale, dated by sale_date, and excluding it would under-report revenue');
  ok(isRealBusiness('test') === false, '🔴 a TEST ORDER IS NOT, and never becomes one');

  ok(isAssessable(null) === true,  'a checkout order was assessed for leakage at checkout');
  ok(isAssessable('history') === false,
    '🔴 a captured invoice was NEVER assessed — its leakage_flag is false meaning UNEVALUATED, not "clean"');
  ok(isAssessable('test') === false, 'and a test order is not assessed either');

  ok(mayPushToQuickBooks(null) === true, 'a checkout order may push to QuickBooks');
  ok(mayPushToQuickBooks('history') === false,
    'a captured invoice may not — it is already in those same books');
  ok(mayPushToQuickBooks('test') === false,
    '🔴 AND A TEST ORDER MAY NOT. This is the predicate behind the guard at pushQboInvoice');

  ok(isRealBusiness('history') !== isAssessable('history'),
    '🔴 THE TWO QUESTIONS DIVERGE ON history — if they ever stop diverging, one has swallowed the other');
}

// ══ §C UNKNOWN KINDS AND EMPTY VALUES — the deny-list default, asserted ═════
{
  ok(isRealBusiness('quote') === true && isAssessable('quote') === true,
    'an UNRECOGNISED kind counts by default — a deny-list, so a new order type cannot vanish from every report on the day it ships');
  ok(isRealBusiness(undefined) === true && isRealBusiness('') === true,
    'undefined and empty-string are treated as NULL is: an ordinary order');
  ok(mayPushToQuickBooks('quote') === true,
    'and the push question defaults the same way — it is the guard at the seam that is narrow, not this predicate');
}

// ══ §D 🔴 THE TWO REPRESENTATIONS MUST AGREE — EXECUTED, NOT EYEBALLED ═══════
// A tiny evaluator for the ONE PostgREST construct these filters use. It is deliberately
// strict: an operator it does not know THROWS rather than returning a default, because a
// silently-permissive evaluator is exactly the rubber-stamp double R-33 is about — it would
// bless a filter string that PostgREST would reject or, worse, interpret differently.
function evalOrFilter(filter: string, orderKind: string | null | undefined): boolean {
  const value = orderKind === undefined || orderKind === '' ? null : orderKind;
  return filter.split(/,(?![^(]*\))/).some(clause => {
    const m = /^order_kind\.(is\.null|not\.in\.\((.*)\)|neq\.(.*))$/.exec(clause.trim());
    if (!m) throw new Error(`the evaluator does not understand this clause: ${clause}`);
    if (m[1] === 'is.null') return value === null;
    if (m[2] !== undefined) {
      // 🔴 SQL THREE-VALUED LOGIC, MODELLED RATHER THAN WISHED AWAY. `NULL NOT IN (...)` is
      // NULL, which PostgREST passes through as "does not match". A double that returned
      // `true` here would report the filters as correct while the real database dropped the
      // whole business — the exact defect this section exists to catch.
      if (value === null) return false;
      return !m[2].split(',').map(s => s.trim()).includes(value);
    }
    if (value === null) return false;               // NULL <> 'x' is NULL, not true
    return value !== m[3];
  });
}

{
  // The double must be able to REFUSE. Proven here, before anything rests on it.
  let threw = false;
  try { evalOrFilter('order_kind.like.*test*', null); } catch { threw = true; }
  ok(threw, '🔴 THE EVALUATOR REFUSES AN OPERATOR IT DOES NOT MODEL — a double that cannot say no is a rubber stamp (R-33)');

  ok(evalOrFilter('order_kind.neq.test', null) === false,
    '🔴 THE NULL TRAP, MODELLED: a bare .neq excludes every NULL row — i.e. the entire real business');
  ok(evalOrFilter(REAL_BUSINESS_PGRST, null) === true,
    'and the filter this module actually exports keeps them');

  for (const kind of KINDS) {
    const k = kind ?? null;
    ok(evalOrFilter(REAL_BUSINESS_PGRST, kind) === isRealBusiness(kind),
      `real-business filter and predicate agree on ${JSON.stringify(k)}`);
    ok(evalOrFilter(ASSESSABLE_PGRST, kind) === isAssessable(kind),
      `assessable filter and predicate agree on ${JSON.stringify(k)}`);
  }
}

// ══ §E THE FILTERS ARE DERIVED, NOT TYPED — asserted against the strings ════
{
  ok(REAL_BUSINESS_PGRST.includes('order_kind.is.null'),
    '🔴 the real-business filter KEEPS NULLs explicitly — the disjunct is present in the string itself');
  ok(ASSESSABLE_PGRST.includes('order_kind.is.null'), 'and so does the assessable filter');
  ok(REAL_BUSINESS_PGRST.includes(TEST_ORDER_KIND) && !REAL_BUSINESS_PGRST.includes(HISTORY_ORDER_KIND),
    'real-business excludes test and NOT history — the strings prove the sets are different');
  ok(ASSESSABLE_PGRST.includes(TEST_ORDER_KIND) && ASSESSABLE_PGRST.includes(HISTORY_ORDER_KIND),
    'assessable excludes both');
}

// ══ §F THE OWNER-FACING NAMES ═══════════════════════════════════════════════
{
  ok(describeOrderKind(null) === 'Checkout order', 'NULL reads as a checkout order, never as blank');
  ok(describeOrderKind('history') === 'Captured invoice', 'history has an owner-facing name');
  ok(describeOrderKind('test') === 'Test order', 'and so does test');
  ok(describeOrderKind('quote') === 'quote',
    'an unknown kind renders under its OWN RAW NAME rather than being relabelled as something recognised (D-9)');
}

console.log(`\n  orderKind — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
