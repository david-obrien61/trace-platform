/**
 * ── canonicalName — token-set canonical-key tests · 2026-06-27 ──
 *
 * Proves the EQUALITY contract that fixes the LAWNS false-UNKNOWN: a scanned QR
 * slug and a catalog name that share only the WORDS of the name resolve as equal,
 * while genuinely-different plants do NOT. Each case is drawn from the grower-resolve
 * corpus (docs/decisions/2026-06-26-grower-resolve-design.md §3/§7).
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/utils/canonicalName.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { nameTokenSet, canonicalNameKey, tokenSetsEqual } from './canonicalName';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const eq = (slug: string, name: string) => tokenSetsEqual(nameTokenSet(slug), nameTokenSet(name));

// ── THE LAWNS FIX — word-order flip resolves by equality ──────────────────────
ok(eq('vitex-shoal-creek', 'Shoal Creek Vitex'), 'LAWNS: vitex-shoal-creek == Shoal Creek Vitex');
ok(eq('shoal-creek-vitex', 'Shoal Creek Vitex'), 'order-insensitive: same words any order');

// ── ATX (Wix, common-first) — trivial equality ───────────────────────────────
ok(eq('shumard-red-oak-tree', 'Shumard Red Oak Tree'), 'ATX: shumard-red-oak-tree exact tokens');

// ── Calloway's (common-first) ────────────────────────────────────────────────
ok(eq('african-violet', 'African Violet'), "Calloway's: african-violet == African Violet");

// ── Normalization steps ──────────────────────────────────────────────────────
ok(eq('summer-red-red-maple', "'Summer Red®' Red Maple"), 'strips ®, quotes; dedups to set');
ok(nameTokenSet('Air Plants (Tillandsia)').has('tillandsia'), 'parens become token boundary');
ok(eq('rise-amp-shine-redbud', 'Rise & Shine™ Redbud'), '& entity leak: amp dropped, & → space, ™ stripped');
ok(!nameTokenSet('Rise & Shine').has('amp'), "stray 'amp' entity token is dropped");
ok(!nameTokenSet('Acer x grandidentata').has('x'), 'hybrid 1-char x dropped');
ok(!nameTokenSet('Salvia var nemorosa').has('var'), 'botanical connector var dropped');
ok(nameTokenSet('Salvia var nemorosa').size === 2, 'connectors removed: {salvia,nemorosa}');

// ── THE POSSESSIVE-APOSTROPHE CLASS (tech-debt #55) — RED 2026-07-16 ──────────
// Four REAL rows in the live catalog, every one `variant_group` NULL and never counted.
// The apostrophe split the word at the non-alnum boundary step and the 1-char filter
// (which exists to kill the hybrid marker 'x') then ate the orphaned fragment:
//   "Basham's" → {basham}  vs slug {bashams}   → false-UNKNOWN at scan.
//   "Hearts A'fire" → {hearts,fire}            → the 'a' was eaten outright.
// This never surfaced because WRAPPING quotes survive ('Sierra' → {sierra}) — the quotes
// sit at word boundaries either way — and the whole D-45/D-46 arc was owner-proven on
// 'Sierra' Mexican Red Oak, which has no possessive.
ok(eq('bashams-party-pink-crape-myrtle', "Basham's Party Pink Crape Myrtle"),
   "#55: Basham's Party Pink Crape Myrtle == bashams-party-pink-crape-myrtle");
ok(eq('eveys-pride-mimosa', "Evey's Pride Mimosa"),
   "#55: Evey's Pride Mimosa == eveys-pride-mimosa");
ok(eq('summers-tower-redbud', "Summer's Tower Redbud"),
   "#55: Summer's Tower Redbud == summers-tower-redbud");
ok(eq('hearts-afire-redbud', "Hearts A'fire Redbud"),
   "#55: Hearts A'fire Redbud == hearts-afire-redbud");

// ORDER OF OPERATIONS is the fix: elide BEFORE the boundary split. Split first and
// A'fire → 'a' + 'fire' → the 1-char filter eats the 'a' → {fire}. This asserts the
// possessive 's' and the elided 'a' SURVIVE as part of their word.
ok(nameTokenSet("Basham's").has('bashams'), "elide precedes split: Basham's → bashams (not basham)");
ok(nameTokenSet("Hearts A'fire").has('afire'), "elide precedes split: A'fire → afire (not fire)");

// Every apostrophe codepoint real catalog data carries. Live data is U+0027 today, but the
// scrape source is WordPress, which emits U+2019 — a curly-apostrophe miss is the same bug
// wearing a different codepoint.
ok(eq('bashams-party-pink-crape-myrtle', 'Basham’s Party Pink Crape Myrtle'), 'U+2019 curly apostrophe elided');
ok(eq('bashams-party-pink-crape-myrtle', 'Bashamʼs Party Pink Crape Myrtle'), 'U+02BC modifier apostrophe elided');
ok(eq('bashams-party-pink-crape-myrtle', 'Basham`s Party Pink Crape Myrtle'), 'U+0060 backtick elided');

// NO REGRESSION — WRAPPING quotes must still resolve (this is the case that HID the bug:
// the whole D-45/D-46 size-variant arc was owner-proven on 'Sierra' Mexican Red Oak).
ok(eq('sierra-mexican-red-oak', "'Sierra' Mexican Red Oak"), "unregressed: 'Sierra' Mexican Red Oak (wrapping quotes)");
ok(nameTokenSet("'Sierra' Mexican Red Oak").has('sierra'), "unregressed: wrapping quotes still yield {sierra}");

// The 1-char filter STAYS (it kills the hybrid marker 'x') — eliding must not resurrect it.
ok(!nameTokenSet("Acer x 'Autumn Blaze'").has('x'), "elide does not resurrect the hybrid 'x'");

// Eliding must not FALSE-MERGE two genuinely different varieties.
ok(!eq("Basham's Party Pink Crape Myrtle", "Evey's Pride Mimosa"), 'possessive elide does not false-merge distinct varieties');

// ── Collision SAFETY — cultivar token is the discriminator (recon §3) ─────────
ok(!eq('cercis-canadensis-forest-pansy-redbud', "Cercis canadensis 'Rising Sun' Redbud"),
   'different cultivar (Forest Pansy vs Rising Sun) → NOT equal');
ok(!eq('vitex-shoal-creek', 'Live Oak'), 'unrelated plants → NOT equal');

// ── Subset is NOT equality (deferred L5, must fall through this build) ─────────
ok(!eq('acer-palmatum-coral-bark-japanese-maple', 'Coral Bark Japanese Maple'),
   'botanical-prefixed slug is a SUPERSET, not equal → UNKNOWN this build (L5 deferred)');

// ── canonicalNameKey stable form ─────────────────────────────────────────────
ok(canonicalNameKey('vitex-shoal-creek') === canonicalNameKey('Shoal Creek Vitex'),
   'canonicalNameKey: same stable string for the same token set');
ok(canonicalNameKey('Shoal Creek Vitex') === 'creek shoal vitex', 'canonicalNameKey is sorted tokens');

// ── Empty / degenerate guards ────────────────────────────────────────────────
ok(nameTokenSet('').size === 0, 'empty string → empty set');
ok(nameTokenSet(null).size === 0, 'null → empty set');
ok(nameTokenSet('   -- !! ').size === 0, 'punctuation-only → empty set');
ok(!tokenSetsEqual(new Set<string>(), new Set<string>(['x'])), 'empty set != non-empty');
ok(tokenSetsEqual(new Set(['a', 'b']), new Set(['b', 'a'])), 'equal sets, any order');

console.log(`\ncanonicalName: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error(failures.join('\n')); process.exit(1); }
