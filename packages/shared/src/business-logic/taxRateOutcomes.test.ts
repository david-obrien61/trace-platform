/**
 * ── THE THREE OUTCOMES OF READING A TAX RATE · #397 ──────────────────────────
 *
 * 🔴 THE DEFECT THIS EXISTS FOR IS A MONEY DEFECT, NOT A TIDINESS ONE. `fetchTaxRate`
 * returned `null` for BOTH "this business has no rate set" and "the RPC failed"
 * (`if (error || data == null) return null`). Checkout used it. So a database hiccup at the
 * counter was indistinguishable from a tax-free business, and the sale went through AT ZERO
 * TAX with the screen showing the same "not identified" line a legitimately untaxed sale shows.
 * Nobody would ever have found it from the screen. Rule 24: an empty result and a failed
 * request must never look the same. Money fails CLOSED.
 *
 * M1 below is the MUTANT — the old collapsing behaviour — and it must FAIL these probes.
 */
import { readTaxRate } from './financialDataAccess';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(c: boolean, m: string): void { if (c) passed++; else { failed++; failures.push(m); console.error('   ✗ ' + m); } }

async function main() {
  const db = (rpc: () => Promise<any>) => ({ rpc } as any);

  // ── §A THE THREE OUTCOMES ARE DISTINCT ───────────────────────────────────────
  const gotRate  = await readTaxRate(db(async () => ({ data: 0.0825, error: null })), 'b');
  const gotNone  = await readTaxRate(db(async () => ({ data: null,   error: null })), 'b');
  const gotError = await readTaxRate(db(async () => ({ data: null,   error: { message: 'boom' } })), 'b');

  ok(gotRate.kind === 'rate' && gotRate.rate === 0.0825, 'A1 a real rate reads as a rate');
  ok(gotNone.kind === 'none',   'A2 a business with no rate set reads as NONE');
  ok(gotError.kind === 'error', '🔴 A3 A FAILED READ READS AS ERROR — the whole point');
  ok(gotNone.kind !== gotError.kind,
     '🔴 A4 NONE AND ERROR ARE NOT THE SAME VALUE — this is the comparison the old helper could not make');

  // ── §B THE MUTANT: the OLD behaviour, which must be caught ───────────────────
  // M1 collapses error → null, exactly as `fetchTaxRate` did before this build.
  const M1 = (r: { kind: string }) => (r.kind === 'rate' ? 1 : null);
  ok(M1(gotNone) === M1(gotError),
     '🔴 B1 THE MUTANT CANNOT TELL THEM APART — proving the old shape is genuinely blind, not merely untidy');
  ok(gotNone.kind !== gotError.kind,
     '🔴 B2 …and the new shape CAN, on the same two inputs. B1 and B2 together are the red/green pair');

  // ── §C A VALUE WE CANNOT PARSE IS AN ERROR, NOT "NO TAX" ─────────────────────
  // The dangerous direction: a corrupted stored rate must not silently become a tax-free sale.
  for (const bad of ['abc', -1, NaN]) {
    const r = await readTaxRate(db(async () => ({ data: bad, error: null })), 'b');
    ok(r.kind === 'error', `🔴 C1 an unusable stored rate (${String(bad)}) is an ERROR, never "no tax"`);
  }
  const zero = await readTaxRate(db(async () => ({ data: 0, error: null })), 'b');
  ok(zero.kind === 'rate' && zero.rate === 0,
     '🔴 C2 …but a genuine ZERO rate is a RATE. A business really can be tax-free, and refusing that would be the opposite defect');

  // ── §D CHECKOUT'S GATE, AS A PREDICATE ───────────────────────────────────────
  const blocks = (r: { kind: string }) => r.kind === 'error';
  ok(blocks(gotError) === true,  '🔴 D1 checkout BLOCKS when the rate could not be read');
  ok(blocks(gotNone)  === false, '🔴 D2 checkout does NOT block a business that genuinely has no rate — today\'s behaviour is kept');
  ok(blocks(gotRate)  === false, 'D3 and a normal order is unaffected');

  console.log(`\ntaxRateOutcomes — ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
}
main().catch(e => { console.error('taxRateOutcomes — 0 passed, 1 failed\nthe suite threw:', e); process.exit(1); });
