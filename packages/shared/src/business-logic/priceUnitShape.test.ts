/**
 * ── price_unit is a SHAPE, not a closed list (AC-1 · ledger #328 · recon #327) ──────────────
 *
 * 🔴 WHAT THIS GUARDS. `service_offerings.price_unit` was `CHECK (… IN ('order','plant',
 * 'vehicle','visit')) DEFAULT 'plant'` — a grower's noun frozen into a platform constraint, and
 * the DEFAULT for every business in every vertical. The mechanism to vary already existed and was
 * correct (`discovery/verticals/nursery.ts` supplies the unit as a VALUE in a per-vertical seed
 * file); the database refused it. A `verticals/foodbank.ts` writing `price_unit: 'household'`
 * would have been rejected — by the CHECK, by a TypeScript union, and SILENTLY by
 * `toPriceUnit`, which rewrote anything it did not recognise to 'order'.
 *
 * WHAT EACH § GUARDS
 *   §A THE REFUSAL FIRST — the predicate is watched REFUSING before it is trusted (§6 r19). A
 *     widening that accepts everything is not a fix, it is the removal of a guard.
 *   §B the point of the whole pass: a unit no vertical here has ever used is ACCEPTED.
 *   §C 🔴 THE TWO REPRESENTATIONS CANNOT DRIFT — the regex and the max length are parsed OUT OF
 *     THE MIGRATION and compared to the TypeScript. STD-011's mitigation, made mechanical: the
 *     duplication is deliberate, so the test is what keeps it honest.
 *   §D the closed vocabulary is GONE from every gate — asserted against the corpus, in both
 *     directions, so a fifth home reintroducing it fails this file (#182: state the expectation).
 *   §E the seed HOLDS BACK rather than coercing — the D-9 half, and the one that was silent.
 *   §F the DEFAULT is gone from the migration AND from the shared Settings page.
 *   §G every value the OLD constraint permitted still satisfies the NEW one — the migration
 *     cannot reject a live row, proven by construction rather than by a live read.
 *
 * Run: node scripts/run-tests.mjs priceUnitShape
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  isUsablePriceUnit, normalisePriceUnit, PRICE_UNIT_SHAPE, PRICE_UNIT_MAX_LENGTH, PRICE_UNIT_OPTIONS,
} from './serviceOfferingEnums';
import { classifyPriceUnit } from '../discovery/seed';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/** Comments removed, so a probe grades CODE and never its own file's prose (#146). */
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const MIGRATION = 'supabase/migrations/20260914_price_unit_shape_not_enum.sql';

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §A — THE REFUSAL, FIRST. A widening that refuses nothing has removed the guard, not fixed it.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // STRUCTURALLY unusable — BOTH the gate and the repairer refuse these. No repair is possible.
  const unrepairable: Array<[unknown, string]> = [
    ['',            'empty'],
    ['   ',         'whitespace only'],
    ['per plant',   'a space — this is a label, not an identifier'],
    ['per-plant',   'a hyphen'],
    ['1plant',      'leading digit — an identifier starts with a letter'],
    ['_plant',      'leading underscore'],
    ['plant!',      'punctuation'],
    ['plänt',       'non-ASCII'],
    [null,          'null'],
    [undefined,     'undefined'],
    [42,            'a number'],
    [{},            'an object'],
    [['plant'],     'an array'],
    ['x'.repeat(41), '41 chars — one past the limit'],
  ];
  for (const [bad, why] of unrepairable) {
    ok(isUsablePriceUnit(bad) === false, `🔴 §A GATE refuses: ${JSON.stringify(bad)} (${why})`);
    ok(normalisePriceUnit(bad) === null, `🔴 §A REPAIRER returns null, never a fallback: ${JSON.stringify(bad)} (${why})`);
  }

  // 🔴 CASE-ONLY — THE GATE REFUSES AND THE REPAIRER FIXES, AND THE SPLIT IS DELIBERATE.
  // ✏️ THIS TEST FOUND THAT ASYMMETRY ON ITS FIRST RUN, when §A assumed one wrapped the other.
  // They do not: `isUsablePriceUnit` asks *would the column take this AS IT STANDS* (the books
  // review, where a value is already chosen); `normalisePriceUnit` asks *what should be STORED*
  // (the seed, where free text arrives and case is not the author's fault). The code was right;
  // the assertion was wrong — so the fix was to state the distinction, not to loosen the check.
  for (const [raw, fixed] of [['Household', 'household'], ['PLANT', 'plant'], ['  Visit  ', 'visit']] as const) {
    ok(isUsablePriceUnit(raw) === false,
      `🔴 §A GATE refuses ${JSON.stringify(raw)} — the column stores one case, so as-given it is not acceptable`);
    ok(normalisePriceUnit(raw) === fixed,
      `🔴 §A REPAIRER fixes ${JSON.stringify(raw)} → '${fixed}' — case is not the author's fault`);
    ok(isUsablePriceUnit(normalisePriceUnit(raw)) === true,
      `🔴 §A repair-then-gate ALWAYS passes for ${JSON.stringify(raw)} — the documented call order`);
  }
  ok(/ASYMMETRY IS/.test(read('packages/shared/src/business-logic/serviceOfferingEnums.ts')),
    '🔴 §A the gate/repairer split is stated IN THE SOURCE — a reader will otherwise assume one wraps the other');

  // 🔴 THE ONE THAT MATTERS MOST — the old function's actual behaviour, now impossible.
  ok(normalisePriceUnit('Per Plant') !== 'order',
    "🔴 §A an unusable unit does NOT become 'order' — that silent rewrite is the defect being removed (D-9)");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §B — THE POINT OF THE PASS. A unit this codebase has never heard of is ACCEPTED.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // A food bank, a roaster, an HVAC contractor, a printer, a hotel.
  for (const unit of ['household', 'box', 'bag', 'room', 'unit', 'pallet', 'case', 'crate', 'sq_ft', 'linear_foot', 'head', 'hour']) {
    ok(isUsablePriceUnit(unit) === true, `§B ACCEPTED: '${unit}' — a vertical supplies its own unit, no migration`);
    ok(normalisePriceUnit(unit) === unit, `§B '${unit}' passes through unchanged`);
  }
  ok(normalisePriceUnit('  Household  ') === 'household',
    '§B trimmed and lowercased — one case, so values stay comparable as strings');
  ok(isUsablePriceUnit('x'.repeat(PRICE_UNIT_MAX_LENGTH)) === true,
    `§B exactly ${PRICE_UNIT_MAX_LENGTH} chars is accepted — the boundary, from the constant, not a literal`);
  // The four that already existed must not have been broken on the way through.
  for (const unit of ['order', 'plant', 'vehicle', 'visit']) {
    ok(isUsablePriceUnit(unit) === true, `§B the original '${unit}' still accepted — nothing was traded away`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §C — 🔴 THE TS RULE AND THE DB RULE ARE PARSED AND COMPARED. They cannot drift silently.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(existsSync(join(ROOT, MIGRATION)), `🔴 §C the migration exists at ${MIGRATION}`);
  const sql = existsSync(join(ROOT, MIGRATION)) ? read(MIGRATION) : '';

  const reMatch = sql.match(/price_unit\s*~\s*'(\^[^']+\$)'/);
  ok(reMatch !== null, '🔴 §C the migration states a regex for price_unit');
  if (reMatch) {
    ok(reMatch[1] === PRICE_UNIT_SHAPE.source,
      `🔴 §C THE REGEX IS THE SAME IN BOTH PLACES — migration ${JSON.stringify(reMatch[1])} vs TS ${JSON.stringify(PRICE_UNIT_SHAPE.source)}`);
  }

  const lenMatch = sql.match(/length\(price_unit\)\s*<=\s*(\d+)/);
  ok(lenMatch !== null, '🔴 §C the migration states a max length for price_unit');
  if (lenMatch) {
    ok(Number(lenMatch[1]) === PRICE_UNIT_MAX_LENGTH,
      `🔴 §C THE MAX LENGTH IS THE SAME IN BOTH PLACES — migration ${lenMatch[1]} vs TS ${PRICE_UNIT_MAX_LENGTH}`);
  }

  // The constraint is NAMED, unlike the one it replaces — so the next person can grep for it.
  ok(/ADD CONSTRAINT\s+service_offerings_price_unit_shape/i.test(sql),
    '§C the new constraint is explicitly named (the old one was inline and auto-named — tech-debt #91)');

  // 🔴 AND IT FINDS THE OLD ONE BY DEFINITION, NOT BY A GUESSED NAME.
  ok(/pg_get_constraintdef/.test(sql),
    '🔴 §C the drop locates the old constraint by DEFINITION — a guessed name with IF EXISTS cannot fail (R-33)');
  ok(/RAISE EXCEPTION/.test(sql),
    '🔴 §C and it RAISES when it finds none — a migration that silently drops nothing reports success while the column stays closed');
  ok(!/DROP CONSTRAINT IF EXISTS\s+service_offerings_price_unit_check/i.test(sql),
    '🔴 §C it does NOT use `DROP CONSTRAINT IF EXISTS <guessed name>` — refused deliberately, see the migration header');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §D — THE CLOSED VOCABULARY IS GONE FROM EVERY GATE. Both directions, population stated.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // The gates that used to hold a hardcoded four.
  const seed   = strip(read('packages/shared/src/discovery/seed.ts'));
  const review = strip(read('packages/shared/src/business-logic/serviceReview.ts'));

  ok(!/VALID_PRICE_UNITS/.test(seed),
    "🔴 §D the seed's hardcoded price-unit Set is GONE");
  ok(!/toPriceUnit/.test(seed),
    "🔴 §D the seed's silent coercion `toPriceUnit` is GONE");
  ok(/classifyPriceUnit/.test(seed),
    '§D the seed asks the honest classifier instead');
  ok(/normalisePriceUnit|isUsablePriceUnit/.test(seed),
    '§D …and the classifier delegates to the ONE shared predicate (§6 r8)');

  ok(!/\(PRICE_UNITS as readonly string\[\]\)\.includes/.test(review),
    '🔴 §D the books review no longer gates a WRITE on the dropdown list');
  ok(/isUsablePriceUnit\(a\.priceUnit\)/.test(review),
    '§D …it asks the shared predicate');

  // PRICE_UNITS survives ON PURPOSE — it populates a <select>. Assert it is not a gate again.
  ok(/export const PRICE_UNITS/.test(review),
    '§D PRICE_UNITS still exists — it is the picker suggestions, deliberately kept');
  ok(PRICE_UNIT_OPTIONS.every(o => isUsablePriceUnit(o.value)),
    '🔴 §D every offered suggestion is a value the column will actually accept — the picker cannot offer a rejected one');

  // The type unions that would have blocked a foodbank.ts at COMPILE time.
  const dtypes = strip(read('packages/shared/src/discovery/types.ts'));
  ok(!/price_unit:\s*'order'\s*\|/.test(dtypes),
    "🔴 §D `SuggestedOffering`'s closed union is GONE — it was a compile error before it was a DB one");
  const ptypes = strip(read('packages/cultivar-os/src/types/plant.ts'));
  ok(!/price_unit:\s*'order'\s*\|/.test(ptypes),
    "§D cultivar's closed union is GONE — a type must not narrow a value it reads from a column it does not control");

  // The AI prompt that told the model only four units exist.
  const engine = read('packages/shared/src/discovery/engine.ts');
  ok(!/"price_unit":\s*"order \| plant \| vehicle \| visit"/.test(engine),
    '§D the discovery prompt no longer tells the model the four are all there is');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E — THE SEED HOLDS BACK RATHER THAN COERCING. The D-9 half, and the half that was silent.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const good = classifyPriceUnit('household');
  ok(good.priceUnit === 'household' && good.flagged === false && good.reason === null,
    "🔴 §E a vertical's own unit is WRITTEN, unflagged — that is the whole point (AC-1)");

  const norm = classifyPriceUnit('  Visit ');
  ok(norm.priceUnit === 'visit' && norm.flagged === false,
    '§E a well-shaped unit is normalised, not refused');

  for (const bad of ['', '   ', 'per plant', null, undefined]) {
    const r = classifyPriceUnit(bad as string | null | undefined);
    ok(r.priceUnit === null && r.flagged === true,
      `🔴 §E ${JSON.stringify(bad)} is HELD BACK, not coerced`);
    ok(typeof r.reason === 'string' && r.reason.length > 0,
      `§E …and it carries a reason a person can act on: ${JSON.stringify(bad)}`);
  }
  const r = classifyPriceUnit('per plant');
  ok(r.reason !== null && /lowercase/.test(r.reason) && /household|order|visit/.test(r.reason),
    '§E the reason says what a usable unit LOOKS like and gives an example — not a bare "invalid"');
  ok(classifyPriceUnit('nonsense unit').priceUnit !== 'order',
    "🔴 §E nothing becomes 'order' by accident — the exact behaviour removed from toPriceUnit");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §F — THE DEFAULT IS GONE. BOTH OF THEM.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const sql = existsSync(join(ROOT, MIGRATION)) ? read(MIGRATION) : '';
  ok(/ALTER COLUMN price_unit DROP DEFAULT/i.test(sql),
    '🔴 §F the column default is DROPPED (not repointed) — an omitted unit now fails loudly');
  ok(!/SET DEFAULT/i.test(sql),
    '§F …and nothing sets a new one');

  // 🔴 THE SECOND DEFAULT — the one an owner actually meets.
  const settings = strip(read('packages/shared/src/pages/Settings.tsx'));
  ok(!/useState\('plant'\)/.test(settings),
    "🔴 §F the SHARED settings page no longer pre-selects 'plant' for every vertical");
  ok(!/setNewPriceUnit\('plant'\)/.test(settings),
    "🔴 §F …and its reset no longer returns to 'plant'");
  ok(/useState\('order'\)/.test(settings),
    "§F it starts at 'order' — the one unit every business certainly has");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §G — THE MIGRATION CANNOT REJECT A LIVE ROW, AND IT IS PROVEN RATHER THAN ASSUMED.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // The OLD constraint is the proof: it permitted exactly these four, so these four are the only
  // values any live row can hold. No live query is needed — the constraint bounds its own data.
  const OLD_PERMITTED = ['order', 'plant', 'vehicle', 'visit'];
  const creation = read('supabase/migrations/20260529_businesses_f_service_offerings.sql');
  const m = creation.match(/CHECK \(price_unit IN \(([^)]+)\)\)/);
  ok(m !== null, '🔴 §G the ORIGINAL permitted set is read from 20260529, not typed from memory');
  if (m) {
    const parsed = m[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''));
    ok(JSON.stringify(parsed) === JSON.stringify(OLD_PERMITTED),
      `🔴 §G the original set is exactly ${JSON.stringify(OLD_PERMITTED)} — if this fails, the safety argument below is void`);
    for (const v of parsed) {
      ok(isUsablePriceUnit(v) === true,
        `🔴 §G every value the OLD constraint permitted satisfies the NEW one — '${v}' — so no live row can be rejected`);
    }
  }
  // And the original CHECK was enforced from creation (inline, not NOT VALID), which is what makes
  // "the old constraint bounds the data" true rather than merely likely.
  ok(!/NOT VALID/i.test(creation),
    '🔴 §G the original CHECK was never NOT VALID — so no row ever escaped it, which the argument depends on');
}

console.log(`\n── priceUnitShape: ${passed} passed, ${failed} failed ──`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
