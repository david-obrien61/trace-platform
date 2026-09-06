/**
 * ── stockLineResolver — READ HONESTY: a dead zone is not an empty catalog · 2026-08-23 ────────
 *
 * PURPOSE:      RED-FIRST (STD-024) for the defect the offline recon found: all three reads in
 *               `stockLineResolver.ts` discarded the Supabase `error` and substituted an empty
 *               result, so a network failure returned `{kind:'miss', reason:'no_match'}` — the
 *               IDENTICAL value a genuinely absent tag returns. Lauren scanned a real tree and
 *               was told to check the tag.
 * DEPENDENCIES: ./stockLineResolver, ../utils/readResult. No DB — a stubbed Supabase client.
 * OUTPUTS:      exit 0 / exit 1 + a per-probe line.
 *
 * 🔴 PROBES BOTH DIRECTIONS. It is not enough that a failure now reports a failure: a fix that
 * turned every genuine miss into "network error" would be the SAME defect mirrored, and would
 * be just as wrong in the lot. So D1–D3 prove the old shape was ambiguous, R1–R6 prove the new
 * failure path, and H1–H5 prove every HONEST path is untouched. N1/N2 are negative controls.
 *
 * Run:  node scripts/run-tests.mjs stockLineRead
 */
import { resolveStockLine, searchStockLines, resolveAgainstCatalog, type StockLineRow } from './stockLineResolver';

let passed = 0, failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else      { failed++; console.log(`  FAIL ${label}`); }
}

const BIZ = 'biz-1';
const CATALOG: StockLineRow[] = [
  { id: 'a', name: 'Shoal Creek Vitex', sku: 'SCV-0031', qty: 12, size: '30 gal', variant_group: 'vitex-shoal-creek' },
  { id: 'b', name: 'Shoal Creek Vitex', sku: 'SCV-0045', qty: 4,  size: '45 gal', variant_group: 'vitex-shoal-creek' },
  { id: 'c', name: 'Live Oak',          sku: 'LO-0001',  qty: 9,  size: '15 gal', variant_group: 'live-oak' },
];

/** A Supabase stub. `mode` decides what every read returns — rows, a dead zone, or a refusal. */
type Mode = { rows: StockLineRow[] } | { err: { code?: string; message: string } };
function stub(mode: Mode) {
  const answer = 'err' in mode ? { data: null, error: mode.err } : { data: mode.rows, error: null };
  const single = (id: string) => {
    if ('err' in mode) return Promise.resolve({ data: null, error: mode.err });
    const hit = mode.rows.find(r => (r.sku ?? '').toLowerCase() === id.toLowerCase()) ?? null;
    return Promise.resolve({ data: hit, error: null });
  };
  // 🔴 `is` ADDED 2026-09-06 AND IT WAS A REAL RED, NOT A CHORE. The resolver now wraps every read
  // in `onlyLiveInventory` so a RETIRED lot cannot be scanned, searched or sold; this double had
  // no `.is`, so the whole suite threw the moment the guard landed. Recording it here because the
  // failure was the double being NARROWER than the client, which is the harmless direction — the
  // dangerous one is a double that is more FORGIVING than the real thing (tech-debt #138), and a
  // stub that silently accepted an unknown method would have hidden a missing filter instead.
  const builder: any = {
    eq: () => builder,
    is: () => builder,
    ilike: (_c: string, id: string) => ({ maybeSingle: () => single(id), is: () => ({ maybeSingle: () => single(id) }) }),
    then: (res: any, rej: any) => Promise.resolve(answer).then(res, rej),
  };
  return { from: () => ({ select: () => builder }) } as any;
}

const DEAD_ZONE  = { message: 'TypeError: Failed to fetch' };              // no code → connectivity
const RLS_REFUSAL = { code: '42501', message: 'permission denied for table business_inventory' };

void (async () => {

  // ── D — THE DEFECT, REPRODUCED. `(rows ?? [])` is literally what the old lines evaluated. ──
  const oldShapeOnFailure = resolveAgainstCatalog([], 'SCV-0031');
  const genuineAbsence    = resolveAgainstCatalog(CATALOG, 'NOT-A-REAL-TAG');
  ok(oldShapeOnFailure.kind === 'miss' && oldShapeOnFailure.reason === 'no_match',
    'D1 the OLD failure path returned miss:no_match (an empty catalog matches nothing)');
  ok(genuineAbsence.kind === 'miss' && genuineAbsence.reason === 'no_match',
    'D2 a genuinely absent tag returns miss:no_match');
  ok(JSON.stringify(oldShapeOnFailure) === JSON.stringify(genuineAbsence),
    'D3 🔴 THE DEFECT: those two values are BYTE-IDENTICAL — there was no third state');

  // ── R — THE FAILURE PATH IS NOW REACHABLE AND CLASSIFIED ──────────────────────────────────
  const deadL2 = await resolveStockLine(stub({ err: DEAD_ZONE }), BIZ, 'SCV-0031');
  ok(deadL2.ok === false, 'R1 a dead zone on the L2 SKU read → ok:false, NOT a miss');
  ok(deadL2.ok === false && deadL2.error.kind === 'offline', 'R2 …classified offline (no error code)');

  const refused = await resolveStockLine(stub({ err: RLS_REFUSAL }), BIZ, 'SCV-0031');
  ok(refused.ok === false, 'R3 a CODED refusal is also a failed read, not a miss');
  ok(refused.ok === false && refused.error.kind === 'error',
    'R4 🔴 …but classified "error", NOT "offline" — telling someone to find signal for an RLS refusal is a second lie');

  const deadSearch = await searchStockLines(stub({ err: DEAD_ZONE }), BIZ, 'vitex');
  ok(deadSearch.ok === false, 'R5 searchStockLines on a dead zone → ok:false, NOT "0 matches"');
  ok(deadSearch.ok === false && deadSearch.error.kind === 'offline', 'R6 …classified offline');

  // ── H — EVERY HONEST PATH IS UNCHANGED (the mirrored-defect guard) ────────────────────────
  const hitSku = await resolveStockLine(stub({ rows: CATALOG }), BIZ, 'LO-0001');
  ok(hitSku.ok === true && hitSku.value.kind === 'resolved' && hitSku.value.via === 'sku',
    'H1 a real SKU hit still resolves via sku');

  const hitName = await resolveStockLine(stub({ rows: [CATALOG[2]] }), BIZ, 'live-oak');
  ok(hitName.ok === true && hitName.value.kind === 'resolved' && hitName.value.via === 'name',
    'H2 a real name hit still resolves via name');

  const realMiss = await resolveStockLine(stub({ rows: CATALOG }), BIZ, 'NOT-A-REAL-TAG');
  ok(realMiss.ok === true && realMiss.value.kind === 'miss' && realMiss.value.reason === 'no_match',
    'H3 🔴 a tag that genuinely is not in the catalog STILL reads as a miss — the fix did not turn every miss into a network error');

  const collision = await resolveStockLine(stub({ rows: CATALOG }), BIZ, 'shoal-creek-vitex');
  ok(collision.ok === true && collision.value.kind === 'collision' && collision.value.candidates.length === 2,
    'H4 the L5 size-picker still fires on a real multi-size variety');

  const emptyTerm = await searchStockLines(stub({ rows: CATALOG }), BIZ, '   ');
  ok(emptyTerm.ok === true && emptyTerm.value.length === 0,
    'H5 an EMPTY search term is an answered zero (ok:true, []), never a failure');

  const searchHit = await searchStockLines(stub({ rows: CATALOG }), BIZ, 'vitex');
  ok(searchHit.ok === true && searchHit.value.length === 2, 'H6 a real search still returns its matches');

  const emptyCatalogOnline = await resolveStockLine(stub({ rows: [] }), BIZ, 'SCV-0031');
  ok(emptyCatalogOnline.ok === true && emptyCatalogOnline.value.kind === 'miss',
    'H7 🔴 a genuinely EMPTY catalog read successfully is a MISS, not a failure — empty is a fact');

  // ── N — NEGATIVE CONTROLS (a probe that cannot fail proves nothing) ───────────────────────
  ok(!(deadL2.ok === true), 'N1 negative control — the dead-zone read must NOT report ok:true');
  ok(!(realMiss.ok === false), 'N2 negative control — a real miss must NOT report ok:false');

  console.log(`\nstockLineRead — ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
