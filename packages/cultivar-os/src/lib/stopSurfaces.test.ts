/**
 * ── ONE STOP, THREE SCREENS — the composition is asserted, not remembered ─────────────────────
 *
 * WHY THIS EXISTS (ledger #301, 2026-09-11). STD-017 — "a fix is complete only when true on every
 * surface the capability touches" — was a written standard, and three screens still composed three
 * different stops: the schedule read `orders(id, status)` and never the lines, the route read a name
 * and an address, and the order screen showed no stop at all. Nobody broke the standard on purpose;
 * nothing checked it. So the composition is a test:
 *
 *   S · each of the three pages reads through `readStops`, renders `<StopCard>`, takes its actions from
 *       `useStopActions`, and composes no `.from('deliveries')` of its own;
 *   R · the stop card and the ingest preview render lines through the ONE `OrderLineList`;
 *   W · the ship-to write names `deliveries` and `audit_log`, and never `customers` (D-41 L1);
 *   K · the checkout stop carries its order id.
 *
 * Every probe has a MUTANT beside it that must fail (§6 r19 — a check nobody has watched refuse is a
 * claim). This reads SOURCE, so it is a floor: a page could still route around the card through a
 * helper this cannot see. It cannot pass on a page that plainly composes its own stop.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/stopSurfaces.test.ts --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// Repo-root-relative: esbuild bundles this file elsewhere, so only process.cwd() is the repo root.
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
// Strip comments so a sentence ABOUT `.from('deliveries')` cannot satisfy or fail a probe.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const PAGES: Record<string, string> = {
  schedule: 'packages/cultivar-os/src/pages/DeliverySchedule.tsx',
  route:    'packages/cultivar-os/src/pages/DeliveryRoute.tsx',
  order:    'packages/cultivar-os/src/pages/OrderDetail.tsx',
};

function surfaceProblems(raw: string): string[] {
  const c = code(raw);
  const p: string[] = [];
  if (!/import\s*\{[^}]*\bStopCard\b[^}]*\}\s*from\s*['"]\.\.\/components\/delivery\/StopCard['"]/.test(c)) p.push('does not import StopCard');
  if (!/<StopCard\b/.test(c)) p.push('never renders a StopCard');
  if (!/\breadStops\s*\(/.test(c)) p.push('does not read through readStops');
  if (!/\buseStopActions\s*\(/.test(c)) p.push('does not take its actions from useStopActions');
  if (/\.from\(\s*['"]deliveries['"]\s*\)/.test(c)) p.push("composes its own .from('deliveries')");
  return p;
}

// ══ S. THE THREE PAGES ═══════════════════════════════════════════════════════════════════════
for (const [name, path] of Object.entries(PAGES)) {
  const problems = surfaceProblems(src(path));
  ok(problems.length === 0, `S:${name} renders the ONE stop — ${problems.join('; ') || 'ok'}`);
}
// Mutants — each must be refused.
ok(surfaceProblems(src(PAGES.schedule).replace(/readStops\s*\(/g, 'readSomethingElse(')).length > 0,
  'SM1 a page that stops reading through readStops is refused');
ok(surfaceProblems(src(PAGES.route) + "\nconst x = supabase.from('deliveries').select('id');").some(x => x.includes('composes')),
  'SM2 a page that composes its own deliveries read is refused');
ok(surfaceProblems(src(PAGES.order).replace(/<StopCard\b/g, '<SomeOtherCard')).length > 0,
  'SM3 a page that renders its own card is refused');
ok(surfaceProblems("// supabase.from('deliveries')\n" + src(PAGES.schedule)).length === 0,
  'SM4 a COMMENT naming the table is not mistaken for a read');

// ══ R. THE ONE LINE RENDERER ═════════════════════════════════════════════════════════════════
const ingest = code(src('packages/shared/src/components/QboOrderIngest.tsx'));
const card   = code(src('packages/cultivar-os/src/components/delivery/StopCard.tsx'));
ok(/<OrderLineList\b/.test(ingest), 'R1 the ingest preview renders lines through OrderLineList');
ok(/<OrderLineList\b/.test(card), 'R2 the stop card renders lines through OrderLineList');
const secondRenderer = (s: string) => /\.lines\.map\(\s*\(\s*l\s*,\s*i\s*\)/.test(s);
ok(!secondRenderer(ingest), 'R3 the ingest preview holds no second line renderer');
ok(secondRenderer(ingest + '\n{p.lines.map((l, i) => null)}'), 'RM1 the R3 probe can see a second renderer');

// ══ W. THE SHIP-TO WRITE ═════════════════════════════════════════════════════════════════════
const writes = code(src('packages/cultivar-os/src/lib/stopWrites.ts'));
const tables = [...writes.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)].map(m => m[1]);
ok([...new Set(tables)].sort().join(',') === 'audit_log,deliveries',
  `W1 stopWrites writes deliveries and audit_log and nothing else (got ${[...new Set(tables)].join(',')})`);
ok(!tables.includes('customers'), 'W2 🔴 the ship-to write cannot reach customers');

// ══ K. THE CHECKOUT STOP CARRIES ITS ORDER ═══════════════════════════════════════════════════
const submit = code(src('packages/cultivar-os/api/orders/submit.ts'));
ok(/order_id:\s*args\.orderId/.test(submit), 'K1 scheduleCheckoutDelivery writes order_id');
ok(/scheduleCheckoutDelivery\(db,\s*\{[\s\S]{0,400}?\borderId\b/.test(submit), 'K2 the call site passes the order id');
ok(!/order_id:\s*args\.orderId/.test(submit.replace(/order_id:\s*args\.orderId/, 'order_id: null')), 'KM1 K1 can refuse');

console.log(`\nstopSurfaces: ${passed} passed, ${failed} failed`);
if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
