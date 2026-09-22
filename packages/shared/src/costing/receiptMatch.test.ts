/**
 * ── receiptMatch — propose a purchase, let a person confirm it (ledger #370) ─────────
 *
 * 🔴 THE DUPLICATE IS REAL, NOT INVENTED: bwi's 29 July invoice ($1,283.88) is captured TWICE on
 * LAWNS — same vendor, same date, same amount, two and a half minutes apart, neither carrying a
 * receipt number (measured 2026-09-21). Bailey Bark's 7 July is in three times. These assert that
 * the matcher offers ONE purchase per document and SAYS how many captures it set aside — tech-debt
 * #143 named where it bites.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/costing/receiptMatch.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  documentKeyOf, lastPaid, oneCapturePerDocument, proposalSentence, proposeMatches,
  type CapturedReceipt,
} from './receiptMatch';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const BWI_LINES = [
  { description: 'Ferrous Iron Sulfate 20S - 50 lb', quantity: 2, amount: 54.74, unit_price: 27.37, pack_size: 50, pack_unit: 'lb' },
  { description: 'Osmocote Blend 21-4-8 (12-14M) - 50 lb', quantity: 4, amount: 272.96, unit_price: 68.24, pack_size: 50, pack_unit: 'lb' },
  { description: 'Gardenline Lawn & Garden 19-5-9 Fertilizer - 40 lb', quantity: 2, amount: 50.88, unit_price: 25.44, pack_size: 40, pack_unit: 'lb' },
  { description: 'Hi-Yield Iron Plus Soil Acidifier 11-0-0 - 20 lb', quantity: 12, amount: 252.6, unit_price: 21.05 },
  { description: 'FUEL Surcharge', amount: 16.61 },
  { description: 'Tax', amount: 0 },
];
const SEP: CapturedReceipt = { id: 'r-sep', vendor: 'bwi', date: '2026-09-02', amount: 647.79, createdAt: '2026-09-03T21:42:17Z', lineItems: BWI_LINES };
/** The real pair: one document, two captures, 2.5 minutes apart, neither numbered. */
const JUL_A: CapturedReceipt = { id: 'r-jul-a', vendor: 'bwi', date: '2026-07-29', amount: 1283.88, createdAt: '2026-09-01T15:49:17Z',
  lineItems: [{ description: 'Osmocote Blend 21-4-8 (12-14M) - 50 lb', quantity: 8, amount: 545.92, unit_price: 68.24, pack_size: 50, pack_unit: 'lb' },
              { description: 'FUEL Surcharge', amount: 33.22 },
              { description: 'Ferrous Iron Sulfate 20S - 50 lb', quantity: 26, amount: 704.74, unit_price: 27.11, pack_size: 50, pack_unit: 'lb' }] };
const JUL_B: CapturedReceipt = { ...JUL_A, id: 'r-jul-b', createdAt: '2026-09-01T15:51:49Z' };

// ══ §A ONE CAPTURE PER DOCUMENT ════════════════════════════════════════════════════════════════
{
  ok(documentKeyOf(JUL_A) === documentKeyOf(JUL_B),
    '🔴 A1: two photographs of one invoice share a document key — vendor, date and amount');
  ok(documentKeyOf(SEP) !== documentKeyOf(JUL_A), 'A2: a different invoice is a different document');
  ok(documentKeyOf({ ...JUL_A, vendor: 'BWI.' }) === documentKeyOf(JUL_A),
    'A2b: the key survives punctuation and case in the vendor name');

  const set = oneCapturePerDocument([SEP, JUL_B, JUL_A]);
  ok(set.kept.length === 2, `🔴 A3: three captures of two documents keep TWO (got ${set.kept.length})`);
  ok(set.kept.some(r => r.id === 'r-jul-a') && !set.kept.some(r => r.id === 'r-jul-b'),
    '🔴 A4: the EARLIEST capture is kept when neither carries a receipt number — the later one is the re-photograph');
  ok(set.collapsed.length === 1 && set.collapsed[0].captures === 2 && set.collapsed[0].keptId === 'r-jul-a',
    `🔴 A5: the collapse is REPORTED — one document, two captures, and which was kept (got ${JSON.stringify(set.collapsed)})`);

  const numbered = oneCapturePerDocument([{ ...JUL_B, receiptNumber: '687138' }, JUL_A]);
  ok(numbered.kept[0].id === 'r-jul-b',
    '🔴 A6: a capture carrying the receipt NUMBER off the page beats an earlier one without it');
}

// ══ §B THE PROPOSAL ════════════════════════════════════════════════════════════════════════════
{
  const { proposals, collapsed } = proposeMatches({ name: 'Osmocote 21-4-8' }, [SEP, JUL_A, JUL_B]);
  ok(collapsed.length === 1, 'B0: the duplicate document is collapsed before anything is ranked');
  const osmo = proposals.filter(p => /Osmocote/.test(p.description));
  ok(osmo.length === 2, `🔴 B1: Osmocote is offered ONCE PER DOCUMENT — two documents, two proposals, not three (got ${osmo.length})`);
  // ⚠️ NOT 'contains': the receipt says "Osmocote BLEND 21-4-8 (12-14M) - 50 lb", so the component's
  // own name is not a substring of it. This is the ordinary case — a vendor's wording is never the
  // grower's — and it is why the shared-words tier exists at all rather than being a fallback nobody hits.
  ok(osmo.every(p => p.tier === 'shared_words' && p.score <= 0.6),
    `B2: a vendor's longer wording matches on shared words, capped below a code match (got ${osmo.map(p => p.tier).join(',')})`);
  ok(/Both mention/.test(osmo[0].because) && /osmocote/.test(osmo[0].because),
    'B2b: …and the proposal names the words it matched on, so the person can judge it');
  ok(osmo[0].purchasedOn === '2026-09-02',
    `🔴 B3: equal scores fall back to the most RECENT purchase (got ${osmo[0].purchasedOn})`);
  ok(osmo[0].landedPackCostEqualPerItem === 69.28 && osmo[0].landedPackCostProRataByValue === 70.04,
    `🔴 B4: each proposal carries the LANDED figure both ways, not the line price (got ${osmo[0].landedPackCostEqualPerItem}/${osmo[0].landedPackCostProRataByValue})`);

  const sentence = proposalSentence(osmo[0]);
  ok(/^We found Osmocote Blend 21-4-8 \(12-14M\) - 50 lb, bwi, 50 lb @ \$68\.24, 2026-09-02 — correct\?$/.test(sentence),
    `🔴 B5: the question is David's shape — item, vendor, pack, price, date (got "${sentence}")`);

  const noPack = proposalSentence({ ...osmo[0], packSize: null, packUnit: null, lineUnitPrice: null, landedPackCostEqualPerItem: null });
  ok(/pack size not stated/.test(noPack) && /no price on the line/.test(noPack),
    '🔴 B6: a missing figure is NAMED inside the question — a blank in a question is answered wrongly');
}

// ══ §C THE TIERS — A CODE BEATS A SIMILARITY, ALWAYS ══════════════════════════════════════════
{
  const withCode: CapturedReceipt = { id: 'r-code', vendor: 'bwi', date: '2026-08-01', amount: 100, createdAt: '2026-08-02T00:00:00Z',
    lineItems: [{ description: 'Something else entirely', sku: 'OS98615', amount: 100, quantity: 1, pack_size: 50, pack_unit: 'lb' }] };
  const { proposals } = proposeMatches({ name: 'Osmocote 21-4-8', qbItemName: 'OS98615' }, [withCode, SEP]);
  ok(proposals[0].tier === 'code' && proposals[0].score === 1,
    `🔴 C1: the CODE match ranks first even though its description shares no words (got ${proposals[0].tier})`);
  ok(/same code as this component/.test(proposals[0].because), 'C2: …and says why, in the reader\'s words');
  ok(proposals.slice(1).every(p => p.score < 1), '🔴 C3: nothing below a code match may reach 1 — a score can never outrank a key');

  const { proposals: weak } = proposeMatches({ name: 'Ferrous Sulfate' }, [SEP]);
  ok(weak.length > 0 && weak[0].tier === 'shared_words' && weak[0].score <= 0.6,
    `🔴 C4: a weak match is still SHOWN, capped, with its reason — silence would leave the person wondering whether we looked (got ${weak[0]?.tier})`);
  ok(/Both mention/.test(weak[0].because), 'C5: …and the reason names the words that matched');

  const { proposals: none } = proposeMatches({ name: 'Bamboo stake' }, [SEP]);
  ok(none.length === 0, 'C6: a component nothing resembles gets NO proposals rather than a bad one');
}

// ══ §D WHAT DID WE LAST PAY — PER DOCUMENT ════════════════════════════════════════════════════
{
  const { proposals } = proposeMatches({ name: 'Osmocote 21-4-8' }, [SEP, JUL_A, JUL_B]);
  const last = lastPaid(proposals.filter(p => /Osmocote/.test(p.description)));
  ok(last.proposal?.purchasedOn === '2026-09-02' && last.documents === 2,
    `🔴 D1: "what did we last pay" reads the most recent DOCUMENT, and counts documents not captures (got ${last.documents})`);
  ok(last.proposal?.landedPackCostEqualPerItem === 69.28,
    'D2: …and the answer is the LANDED cost, which is the only one a recipe may use');
}

// ══ §E A RECEIPT THAT DOES NOT ADD UP ═════════════════════════════════════════════════════════
{
  const broken: CapturedReceipt = { ...SEP, id: 'r-broken', amount: 999 };
  const { proposals } = proposeMatches({ name: 'Osmocote 21-4-8' }, [broken]);
  ok(proposals.length === 1 && proposals[0].landedPackCostEqualPerItem === null,
    '🔴 E1: a receipt whose lines do not reconcile still SHOWS its line — but with no landed cost');
  ok(/do not add up/.test(proposals[0].landedRefusal ?? ''),
    '🔴 E2: …and carries the refusal, so the screen says why rather than showing a blank price');
}

console.log(`\nreceiptMatch: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
