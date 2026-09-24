/**
 * ── AN ON-HAND NUMBER NEVER APPEARS BARE ──────────────────────────────────────────────────────
 *
 * WHAT THIS GUARDS. Live 2026-09-23: **512 of LAWNS's 632 lots sit at exactly qty 10, 120 at 0,
 * and not one lot at any other value** — a flat import default from a single run on 2026-09-21.
 * The purchases-minus-sales derivation has never run and has no inputs. **Two lots have ever been
 * counted.** Until #388 that number was only in the database; #388's item-entry screen put it in
 * front of Lauren at the till, where it looked exactly like a measured figure.
 *
 * 🔴 §D IS THE FILE'S REASON FOR EXISTING. It sweeps every combination of quantity, basis and date
 * and asserts the rendered text ALWAYS carries a basis word. A mutant that renders a bare number
 * must fail, and §D is what fails.
 *
 * Run: node scripts/run-tests.mjs onHandProvenance
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeOnHand } from './onHandProvenance';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg); console.error('   ✗ ' + msg);
}

// ── §A — THE THREE REAL BASES, IN THE WORDS DAVID ASKED FOR ──────────────────────────────────
{
  ok(describeOnHand({ qty: 10, qty_basis: 'placeholder' }).text === '10 · placeholder',
    '§A "10 · placeholder" — the 512-lot case, verbatim from the ruling');
  ok(describeOnHand({ qty: 14, qty_basis: 'derived' }).text === '14 · derived',
    '§A "14 · derived" — purchases minus sales, both sides real');
  ok(describeOnHand({ qty: 12, qty_basis: 'counted', qty_basis_at: '2026-09-20T09:00:00Z' }).text === '12 · counted 20 Sep',
    `§A "12 · counted 20 Sep" — got "${describeOnHand({ qty: 12, qty_basis: 'counted', qty_basis_at: '2026-09-20T09:00:00Z' }).text}"`);
}

// ── §B — 🔴 ABSENT IS NOT EMPTY (A9). Unknown ≠ placeholder. ─────────────────────────────────
{
  const u = describeOnHand({ qty: 10 });
  ok(u.basis === 'unknown' && u.text === '10 · basis unknown',
    '§B 🔴 a row with NO basis reads "basis unknown", NOT "placeholder" — a bundle reading pre-migration rows has not been TOLD, which is a different fact from being told it is unverified');
  ok(describeOnHand({ qty: 10, qty_basis: 'guessed' }).basis === 'unknown',
    '§B a value outside the three is unknown, not silently trusted');
  ok(describeOnHand({ qty: 10, qty_basis: '   ' }).basis === 'unknown', '§B whitespace is not a basis');
  ok(describeOnHand({ qty: 5, qty_basis: 'counted' }).text === '5 · counted',
    '§B 🔴 a count with NO DATE still reads "counted" — without inventing a day for it');
}

// ── §C — TRUST, AND WHAT IT IS NOT ───────────────────────────────────────────────────────────
{
  ok(describeOnHand({ qty: 9, qty_basis: 'counted' }).trusted, '§C counted is trusted');
  ok(describeOnHand({ qty: 9, qty_basis: 'derived' }).trusted, '§C derived is trusted');
  ok(!describeOnHand({ qty: 9, qty_basis: 'placeholder' }).trusted, '§C a placeholder is not');
  ok(!describeOnHand({ qty: 9 }).trusted, '§C and an unknown basis is not');
  ok(describeOnHand({ qty: 10, qty_basis: 'placeholder' }).qty === 10,
    '🔴 §C THE QUANTITY IS RETURNED UNCHANGED. David: "Do not raise it, do not hide it" — the block at sale is the reconcile trigger, and this module must not soften it');
}

// ── §D — 🔴 NO INPUT PRODUCES A BARE NUMBER. The sweep. ──────────────────────────────────────
{
  const qtys = [0, 1, 10, 512, -3, 0.5];
  const bases = [undefined, null, '', 'placeholder', 'counted', 'derived', 'guessed', 'COUNTED'];
  const dates = [undefined, null, '', '2026-09-20T09:00:00Z', 'not-a-date'];
  let bare = 0, checked = 0;
  for (const q of qtys) for (const b of bases) for (const d of dates) {
    const t = describeOnHand({ qty: q, qty_basis: b as string | null, qty_basis_at: d as string | null }).text;
    checked++;
    // A bare figure is one with no ' · ' and no basis word after it.
    if (!/ · (placeholder|derived|counted|basis unknown)/.test(t)) { bare++; if (bare < 3) console.error(`      bare: qty=${q} basis=${String(b)} date=${String(d)} → "${t}"`); }
  }
  ok(checked === qtys.length * bases.length * dates.length && checked === 240,
    `§D the sweep really ran over every combination — ${checked} of 240`);
  ok(bare === 0,
    `🔴 §D NOT ONE of ${checked} combinations renders a bare number — got ${bare}. THIS is the assertion a mutant that prints the figure alone must fail`);
  ok(/not-a-date/.test('x') === false && describeOnHand({ qty: 1, qty_basis: 'counted', qty_basis_at: 'not-a-date' }).text === '1 · counted',
    '§D 🔴 an UNPARSEABLE date degrades to "counted" rather than printing "Invalid Date" at a till');
}

// ── §E — 🔴 THE COMPONENT ITSELF. §D guards the FUNCTION; this guards the SCREEN. ────────────
// A mutant can leave `describeOnHand` perfect and render `{Number(c.row.qty)}` beside it — which
// is exactly what the component did before this build and exactly what the ruling forbids. §D
// could not see that. This reads `ItemLineEntry.tsx` and asserts the on-hand figure reaches the
// screen ONLY through `describeOnHand`.
{
  const src = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/components/checkout/ItemLineEntry.tsx'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');

  ok(/describeOnHand\(/.test(code),
    '§E the till calls describeOnHand (if this fails the probe has lost its target)');

  // 🔴 THE ASSERTION. Any JSX that interpolates the raw qty is a bare number on a till row.
  const bareQty = code.match(/\{\s*(Number\()?[\w.]*\brow\.qty\b\)?\s*\}/g) ?? [];
  ok(bareQty.length === 0,
    `§E 🔴 NO RAW row.qty IS RENDERED — every on-hand figure goes through describeOnHand. Found: ${JSON.stringify(bareQty).slice(0, 120)}`);

  // …and the columns it needs are actually fetched. A field shown without being selected reads
  // "basis unknown" on every row — true, and uselessly so (R-170's other half, #384's family).
  ok(/'qty_basis'/.test(code) && /'qty_basis_at'/.test(code),
    '§E 🔴 the SELECT asks for qty_basis and qty_basis_at — a basis that is never fetched makes every row read "basis unknown"');

  // A placeholder must be SHOWN, never filtered. David: "Do NOT hide placeholders."
  // 🔴 BOTH FILES ARE READ, AND THE SECOND ONE IS THE POINT. A first draft checked only the
  // component — and mutant M5, which planted the hide in the RANKING module where the filtering
  // actually happens, walked straight past it. The guarantee belongs wherever a row can be
  // dropped, not only where it is drawn (tech-debt #182's class).
  const ranking = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/lib/itemLineEntry.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');
  for (const [where, text] of [['the till component', code], ['the ranking module', ranking]] as const) {
    ok(!/qty_basis\s*[!=]==?\s*'placeholder'|filter\([^)]*placeholder/.test(text),
      `🔴 §E NOTHING IN ${where} FILTERS ON THE BASIS — a placeholder is marked, never hidden. Running out is what triggers a count, and hiding the row removes the trigger`);
  }
}

console.log(`\n  onHandProvenance: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
