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
