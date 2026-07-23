/**
 * ── resolveAgainstCatalog — the pure SKU→NAME→SIZE ladder · 2026-07-23 ──
 *
 * This logic was inline in resolveStockLine (DB-coupled, untested). Extracting it for the CSV
 * importer (STD-011 — one matcher, not a fork) is only safe if its behaviour is pinned. These
 * tests ARE that pin: single name match, size-collision → picker, ambiguous → miss, SKU exact,
 * no-match. The count + purchase paths flow through here, so a green run here guards them too.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/inventory/resolveAgainstCatalog.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { resolveAgainstCatalog, type StockLineRow } from './stockLineResolver';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const row = (p: Partial<StockLineRow> & { id: string; name: string }): StockLineRow => ({
  sku: null, qty: 0, size: null, variant_group: null, ...p,
});

// ── SKU exact wins first, case-insensitively ────────────────────────────────────
{
  const cat = [row({ id: 'a', name: 'Vitex', sku: 'DISC-1' }), row({ id: 'b', name: 'Oak', sku: 'DISC-2' })];
  const r = resolveAgainstCatalog(cat, 'disc-1');
  ok(r.kind === 'resolved' && r.via === 'sku' && r.row.id === 'a', 'SKU exact match (case-insensitive)');
}

// ── NAME token-set equality — order/punctuation-insensitive ─────────────────────
{
  const cat = [row({ id: 'a', name: 'Shoal Creek Vitex' })];
  const r = resolveAgainstCatalog(cat, 'vitex-shoal-creek');
  ok(r.kind === 'resolved' && r.via === 'name' && r.row.id === 'a', 'name token-set equality resolves a slug');
}

// ── SIZE collision → picker (same variety, distinct sizes, one shared group) ─────
{
  const cat = [
    row({ id: 's15', name: "'Sierra' Oak", size: '15 gal', variant_group: 'sierra-oak' }),
    row({ id: 's45', name: "'Sierra' Oak", size: '45 gal', variant_group: 'sierra-oak' }),
  ];
  const r = resolveAgainstCatalog(cat, "'Sierra' Oak");
  ok(r.kind === 'collision' && r.candidates.length === 2, 'clean multi-size family → size-picker collision');
  ok(r.kind === 'collision' && r.candidates[0].size === '15 gal', 'candidates sorted numeric-aware (15 before 45)');
}

// ── Genuinely ambiguous (mixed group) → miss:ambiguous, candidates carried ──────
{
  const cat = [
    row({ id: 'x', name: 'Alley Cat', size: '15 gal', variant_group: 'alley-cat' }),
    row({ id: 'y', name: 'Alley Cat', size: null, variant_group: 'alley-cat' }),   // missing size defeats picker
  ];
  const r = resolveAgainstCatalog(cat, 'Alley Cat');
  ok(r.kind === 'miss' && r.reason === 'ambiguous', 'a family with a size-less member is ambiguous, not a picker');
  ok(r.kind === 'miss' && (r.candidates?.length ?? 0) === 2, 'ambiguous miss carries the candidates for the caller to show');
}

// ── No match / empty identifier ─────────────────────────────────────────────────
{
  ok(resolveAgainstCatalog([row({ id: 'a', name: 'Oak' })], 'Maple').kind === 'miss', 'no token-equal row → miss:no_match');
  ok(resolveAgainstCatalog([], '   ').kind === 'miss', 'blank identifier → miss');
}

console.log(`\nresolveAgainstCatalog — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
