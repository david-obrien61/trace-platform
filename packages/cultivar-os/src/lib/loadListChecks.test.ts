/*
 * ── loadListChecks — installs follow the SERVICE, and what disagrees is an OUTPUT (ledger #407) ──
 * Run: npx esbuild … --bundle | node   (or through `npm test`)
 *
 * 🔴 THE SATURDAY 2026-09-26 CASES ARE PROBED BY NAME, because David named them: Stallings (a trip
 *    charge on an unmarked stop), Gillespie (replacements on a stop marked Delivery only, plus two
 *    trees with no install line of their own). A rule that is right in general and wrong on the day
 *    it ships for is not right.
 */
import {
  isTripChargeLine, isInstallServiceLine, isReplacementLine, replacementGallons, isNoteLine,
  stopChecks, type CheckLine,
} from './loadListChecks';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const line = (o: Partial<CheckLine> = {}): CheckLine => ({ quantity: 1, ...o });
const lot = (name: string, size: string | null = null, sku: string | null = null): CheckLine =>
  ({ quantity: 1, business_inventory: { name, size, sku } });

// ══ §A TRIP CHARGE ═══════════════════════════════════════════════════════════════
{
  ok(isTripChargeLine(line({ description: 'TC' })), 'A1: a bare "TC" is a trip charge');
  ok(isTripChargeLine(line({ description: 'TC - Leander' })), 'A2: "TC - Leander" is a trip charge');
  ok(isTripChargeLine(line({ description: 'Trip Charge' })), 'A3: the long form is a trip charge');
  // 🔴 THE SUBSTRING TRAP. A bare includes('tc') makes these trip charges, and a false install
  //    silently loads mix and posts for a drop-off.
  ok(!isTripChargeLine(lot('Dutch Elm', '30 gal')), '🔴 A4: "Dutch Elm" is NOT a trip charge — tc must be a whole token');
  ok(!isTripChargeLine(line({ sku: 'BOTCH30' })), '🔴 A5: SKU "BOTCH30" is NOT a trip charge');
  ok(!isTripChargeLine(lot('Catclaw Acacia', '15 gal')), '🔴 A6: "Catclaw" is NOT a trip charge');
}

// ══ §A2 THE INSTALL / PLANTING LINE ══════════════════════════════════════════════
{
  // eslint flagged this import as unused, which was a fair catch and the honest fix is probes, not
  // dropping the import: `isInstallServiceLine` is one of the four bases `stopChecks` reports and it
  // was going unprobed.
  ok(isInstallServiceLine(line({ description: 'Tree installation' })), 'A2a: "Tree installation" is an install line');
  ok(isInstallServiceLine(line({ description: 'Plant Your Tree' })), 'A2b: "Plant Your Tree" is an install line');
  ok(isInstallServiceLine(line({ description: 'Planting — 45 gal' })), 'A2c: "Planting" is an install line');
  // 🔴 A TREE IS NOT THE SERVICE THAT PLANTS IT. This is the rule's whole point: install materials
  //    follow the SERVICE, so a tree's own name must never be read as an install line.
  ok(!isInstallServiceLine(lot('Live Oak', '45 gal')), '🔴 A2d: a TREE is not an install line');
  ok(!isInstallServiceLine(line({ description: 'Tree installation WITHOUT warranty', sku: 'TIWW' })) === false,
    'A2e: "Tree installation without warranty" is still an install line — the warranty is a separate question');
}

// ══ §B REPLACEMENTS ══════════════════════════════════════════════════════════════
{
  ok(isReplacementLine(line({ sku: 'BPJ30REP' })), 'B1: a code ending REP is a replacement');
  ok(isReplacementLine(lot('Arizona Cypress Blue Ice (Replacement)')), 'B2: "(Replacement)" in the name is a replacement');
  // 🔴 REP MUST END THE CODE — calling an ordinary tree a warranty replacement puts the wrong words
  //    on a crew sheet and on a customer's link.
  ok(!isReplacementLine(line({ sku: 'REPOT15' })), '🔴 B3: "REPOT15" is NOT a replacement — REP must END the code');
  ok(!isReplacementLine(line({ sku: 'PREP45' })), '🔴 B4: "PREP45" is NOT a replacement');
  // sizes off the code
  ok(replacementGallons(line({ sku: 'BPJ30REP' })) === 30, 'B5: BPJ30REP reads 30 gal');
  ok(replacementGallons(line({ sku: 'AZBI45' })) === 45, 'B6: AZBI45 reads 45 gal');
  // 🔴 THE DIGITS BEFORE REP, NOT THE FIRST DIGITS ANYWHERE.
  ok(replacementGallons(line({ sku: '15GALBPJ30REP' })) === 30,
    '🔴 B7: "15GALBPJ30REP" is a 30, not a 15 — the size is the digits before REP');
  ok(replacementGallons(line({ sku: 'NOSIZEREP' })) === null,
    '🔴 B8: a code with no digits returns null — an unreadable size is never defaulted');
  ok(replacementGallons(line({ sku: 'PART1234' })) === null, 'B9: a 4-digit run is a part number, not gallons');
}

// ══ §C A NOTE IS NOT A TREE ══════════════════════════════════════════════════════
{
  ok(isNoteLine(line({ description: 'Bring Birthday Cake for Vera!!!' })),
    'C1: David\'s own example is a NOTE — no code, no lot, no size');
  // 🔴 A CODE MEANS SOMEBODY MEANT IT AS A THING, however chatty it reads.
  ok(!isNoteLine(line({ description: 'Bring Birthday Cake for Vera!!!', sku: 'CAKE1' })),
    '🔴 C2: the same words WITH a code are not a note');
  ok(!isNoteLine(lot('Live Oak', '45 gal')), 'C3: a lot line is not a note');
  ok(!isNoteLine(line({ description: '   ' })), 'C4: blank text is not a note either');
  // 🔴 C5-C8 ADDED AFTER loadList.test.ts H9 WENT RED ON MY OWN CHANGE, and they are the probes
  //    this section should have had from the start. A DESCRIPTION-ONLY line with no SKU is how every
  //    history line describes itself — my first rule called such a line a note, which would have
  //    dropped real trees off the sheet as "nothing to load". My C1-C4 never reached that population
  //    because they only ever passed lot lines and coded lines (tech-debt #182's class).
  ok(!isNoteLine(line({ description: 'Live Oak - 200 Gallon' })),
    '🔴 C5: a description-only TREE is not a note — it states a size, and every history line looks like this');
  ok(!isNoteLine(line({ description: 'Cedar Elm #3/5' })), '🔴 C6: a "#3/5" size is a size');
  ok(!isNoteLine(line({ description: 'Micromax 50lb Bag' })), 'C7: goods stating a weight are not a note');
  // …and a number that is NOT a size leaves a note a note.
  ok(isNoteLine(line({ description: 'Call Vera at 512-456-3632 before you arrive' })),
    '🔴 C8: a phone number is not a size — this is still a note');
}

// ══ §D STALLINGS — TC ON AN UNMARKED STOP (Saturday 2026-09-26) ══════════════════
{
  const r = stopChecks({
    stopId: 's1', customerName: 'Stallings', serviceType: 'Delivery', markedInstall: false,
    lines: [lot('Live Oak', '45 gal'), line({ description: 'TC - Leander' })],
  });
  ok(r.basis === 'trip_charge', `🔴 D1: Stallings IS an install, on the trip charge (got ${r.basis})`);
  const inc = r.checks.filter(c => c.kind === 'inconsistency');
  ok(inc.some(c => /TRIP CHARGE/.test(c.why) && /not marked install/.test(c.why)),
    '🔴 D2: and page 4 says the TC is there while the stop is not marked install');
  ok(inc.every(c => c.customerName === 'Stallings'), 'D3: every check names the stop it belongs to');
  ok(inc.some(c => c.asWritten === 'TC - Leander'), 'D4: …and quotes the line AS WRITTEN');
}

// ══ §E GILLESPIE — REPLACEMENTS ON "DELIVERY ONLY", AND TWO BARE TREES ═══════════
{
  const r = stopChecks({
    stopId: 's2', customerName: 'Gillespie', serviceType: 'Delivery only', markedInstall: false,
    lines: [
      line({ description: 'Bur Oak (Replacement)', sku: 'BPJ30REP' }),
      line({ description: 'Arizona Cypress Blue Ice', sku: 'AZBI45REP' }),
      lot('Desert Willow', '15 gal'), lot('Miss Pryss Holly', '30 gal'),
    ],
  });
  ok(r.basis === 'replacement', `🔴 E1: Gillespie IS an install — replacements are planted (got ${r.basis})`);
  ok(r.checks.some(c => c.kind === 'inconsistency' && /Delivery only/.test(c.why)),
    '🔴 E2: page 4 says a replacement is on a stop marked "Delivery only"');
  ok(r.checks.some(c => c.kind === 'inconsistency' && /no install or trip line/.test(c.why)),
    '🔴 E3: page 4 asks "install or drop-off?" about the trees with no line of their own');
  ok(r.checks.some(c => /Desert Willow/.test(c.asWritten ?? '') && /Miss Pryss Holly/.test(c.asWritten ?? '')),
    '🔴 E4: …and names them — Desert Willow and Miss Pryss Holly');
  ok(r.checks.some(c => /spare T-post/.test(c.why)),
    'E5: and says they ARE counted as installs, so nobody "fixes" it by leaving them out');
}

// ══ §F A TRUE DELIVERY-ONLY STOP GETS NOTHING ════════════════════════════════════
{
  const r = stopChecks({
    stopId: 's3', customerName: 'Plain Delivery', serviceType: 'Delivery', markedInstall: false,
    lines: [lot('Live Oak', '45 gal'), lot('Cedar Elm', '30 gal')],
  });
  ok(r.basis === null, `🔴 F1: no TC, no mark, no replacement → NOT an install (got ${r.basis})`);
  ok(r.checks.length === 0, `🔴 F2: …and nothing goes on page 4 — a clean delivery is not an exception (got ${r.checks.length})`);
}

// ══ §G A MARKED STOP: the mark WINS, and is what gets reported ═══════════════════
{
  const r = stopChecks({
    stopId: 's4', customerName: 'Duy Le', serviceType: 'Planting', markedInstall: true,
    lines: [lot('Live Oak', '45 gal'), line({ description: 'Tree installation' })],
  });
  ok(r.basis === 'marked', `🔴 G1: a marked stop reports "marked", not an inferred basis (got ${r.basis})`);
  ok(!r.checks.some(c => c.kind === 'inconsistency'),
    'G2: a marked install stop with an install line has nothing to flag');
}

console.log(failed ? `\nloadListChecks: ${passed} passed, ${failed} failed` : `\nloadListChecks: ${passed} passed, 0 failed`);
if (failed) { console.log('\nFAILURES:'); for (const f of failures) console.log('  · ' + f); }
process.exit(failed ? 1 : 0);
