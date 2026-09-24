/**
 * ── mixPlanning — is there enough mix for Saturday? (ledger #370) ──
 *
 * 🔴 TWO JOBS, TWO RULES, AND THESE PROBES KEEP THEM APART.
 * INSTALL is [[R-155]] — *"INSTALL mix is TWICE the container volume (30 gal tree → 60 gal of mix)…
 * Err large."* — with NO shrink on top. UPPOT is David, 2026-09-23 — *"for UPPOTTING, mix per pot =
 * the pot's gallons, and it will settle."* Neither revises the other.
 *
 * The fixture is Saturday 3 October 2026 as LAWNS's schedule holds it, read live 2026-09-23.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/costing/mixPlanning.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { mixRequirement, onHandFigure, mixItemQuestion, humanDay, isCounted, provenanceWords, type PlannedLine } from './mixPlanning';
import { readFileSync } from 'node:fs';
import { GALLONS_PER_CUBIC_YARD, OPERATIONS_DEFAULTS, OPERATIONS_BASIS } from '../production/productionConfig';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const OPS = { uppotMixPerPotVolume: 1, installMixContainerVolumesPerTree: 2, mixShrinkPct: 0,
  mixLeadTimeDays: 2, trueGallonsPerCubicYard: GALLONS_PER_CUBIC_YARD };

/** Saturday 3 Oct: 9 trees, plus two lines that take no mix at all. */
const OCT3: PlannedLine[] = [
  { label: 'Live Oak 45 gal',           consumesMix: true,  potGallons: 45,   quantity: 4 },
  { label: 'Cedar Elm 30 gal',          consumesMix: true,  potGallons: 30,   quantity: 3 },
  { label: 'Shumard Red Oak 95 gal',    consumesMix: true,  potGallons: 95,   quantity: 2 },
  { label: 'Tree Bubbler',              consumesMix: false, potGallons: null, quantity: 1 },
  { label: 'Trunk Protection',          consumesMix: false, potGallons: null, quantity: 2 },
];
// 🔴 FIXTURE, NOT LIVE. Nobody has counted LAWNS's mix; this 1 yard "counted 2026-09-20" exists
// so the counted branch can be exercised at all, and it is the figure I twice presented to David
// as live. The uncounted fixtures below are the shape the real tenant is actually in.
const HAND = { yards: 1, itemId: '174', itemName: 'Prepared Enriched Planting Mix by the yard', countedAt: '2026-09-20', provenanceNote: null };

// ⚠️ THE WORDS ARE READ OUT OF THE LIVE SOURCE, NEVER RETYPED HERE. A second copy of the wording
// in this file would pass forever while the checkout picker's own words changed underneath it —
// which is precisely the drift `provenanceNote` exists to stop.
const SEEDED_NOTE_LIVE = (() => {
  const src = readFileSync('packages/cultivar-os/src/lib/inventoryStates.ts', 'utf8');
  const m = /export const SEEDED_NOTE = '([^']+)'/.exec(src);
  return m ? m[1] : null;
})();

// ══ §0 THE SHIPPED DEFAULTS ARE DAVID'S FIGURES ══════════════════════════════════════════════
// ⚠️ This section exists because two mutants survived: every other probe passes `OPS` explicitly,
// so changing the DEFAULTS broke nothing — the fixture supplied the very values he specified.
{
  ok(OPERATIONS_DEFAULTS.mixLeadTimeDays === 2,
    `🔴 0A: lead time 2 days — David 2026-09-23 (got ${OPERATIONS_DEFAULTS.mixLeadTimeDays})`);
  ok(OPERATIONS_DEFAULTS.uppotMixPerPotVolume === 1,
    `🔴 0B: an UPPOT takes the pot's own gallons — 1.0 (got ${OPERATIONS_DEFAULTS.uppotMixPerPotVolume})`);
  ok(OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree === 2,
    `🔴 0C: R-155's INSTALL figure is UNCHANGED at 2.0 — "err large" (got ${OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree})`);
  ok(OPERATIONS_BASIS.uppotMixPerPotVolume.basis === 'guess',
    '0D: the uppot figure is an ESTIMATE (basis `guess`)');
  ok(/UPPOT/.test(OPERATIONS_BASIS.uppotMixPerPotVolume.because)
     && /R-155|install/i.test(OPERATIONS_BASIS.uppotMixPerPotVolume.because),
    '🔴 0E: …and its provenance says it is for UPPOTS and that installs are a different question — the error Lightning made, written down so it is not made again');
}

// ══ §A INSTALL: R-155's 2.0, AND NO SHRINK ON TOP ═════════════════════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: HAND });
  // 4×45 + 3×30 + 2×95 = 460 gallons of container; × 2.0 = 920 gal = 4.6 yd
  ok(p.multiple === 2 && p.neededYards === 4.6,
    `🔴 A1: 460 gallons of container × 2.0 = 4.6 yards (got ×${p.multiple} → ${p.neededYards})`);
  ok(p.shrinkApplied === false, 'A2: no shrink is applied to an install — 2.0 already errs large');

  const withShrink = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: { ...OPS, mixShrinkPct: 0.1 }, onHand: HAND });
  ok(withShrink.neededYards === 4.6,
    `🔴 A3: a 10% shrink setting does NOT change an install — grossing up R-155's figure would double-count the same caution (got ${withShrink.neededYards})`);

  ok(!('neededYardsOtherRule' in (p as unknown as Record<string, unknown>)),
    '🔴 A4: an install plan reports ONE figure. The side-by-side output is GONE — the two rules answer different questions and neither is a pricing event.');
}

// ══ §B UPPOT: THE POT'S OWN GALLONS, GROSSED UP FOR SETTLE ════════════════════════════════════
{
  const u = mixRequirement({ day: '2026-10-03', job: 'uppot', lines: OCT3, ops: OPS, onHand: HAND });
  ok(u.multiple === 1 && u.neededYards === 2.3,
    `🔴 B1: an uppot takes the pot's own 460 gallons = 2.3 yards (got ×${u.multiple} → ${u.neededYards})`);
  const s2 = mixRequirement({ day: '2026-10-03', job: 'uppot', lines: OCT3, ops: { ...OPS, mixShrinkPct: 0.1 }, onHand: HAND });
  ok(s2.neededYards === 2.5 && s2.shrinkApplied,
    `🔴 B3: a 10% settle allowance needs MORE loose mix — 2.5 yards, not 2.1 (got ${s2.neededYards})`);
  ok(s2.neededYards! > u.neededYards!,
    'B4: …the DIRECTION is the check — a settle that reduced the requirement is the same key read backwards');
}

// ══ §C NON-CONSUMING LINES ARE NOT FAILURES ═══════════════════════════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: HAND });
  ok(p.unsizedTrees.length === 0,
    `🔴 C1: Tree Bubbler and Trunk Protection are NOT "could not be sized" — they take no mix (got ${JSON.stringify(p.unsizedTrees)})`);
  ok(p.nonConsumingCount === 2,
    `C2: …they are COUNTED as non-consuming, so a reader can see they were considered and set aside (got ${p.nonConsumingCount})`);
  ok(!/could not be sized/.test(p.sentence),
    `🔴 C3: and the warning does not fire at all on this day — crying wolf every install day teaches a person to ignore it (got "${p.sentence.slice(0,90)}")`);

  // a REAL unsized tree: the 26 Sep line that carries no size
  const withUnsized = mixRequirement({ day: '2026-09-26', job: 'install', onHand: HAND, ops: OPS, lines: [
    { label: 'Live Oak 45 gal', consumesMix: true, potGallons: 45, quantity: 1 },
    { label: 'Blue Point Juniper (Replacement)', consumesMix: true, potGallons: null, quantity: 1 },
    { label: 'Tree Bubbler', consumesMix: false, potGallons: null, quantity: 1 },
  ]});
  ok(withUnsized.unsizedTrees.length === 1 && withUnsized.unsizedTrees[0] === 'Blue Point Juniper (Replacement)',
    `🔴 C4: a TREE with no size DOES fire the warning, and only it (got ${JSON.stringify(withUnsized.unsizedTrees)})`);
  ok(/1 tree line could not be sized/.test(withUnsized.sentence),
    'C5: …in the sentence, saying it is not in the total');
}

// ══ §D ON HAND CARRIES THE ITEM IT CAME FROM ══════════════════════════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: HAND });
  ok(/item 174/.test(p.sentence) && /Prepared Enriched Planting Mix/.test(p.sentence),
    `🔴 D1: the sentence NAMES the item the on-hand came from — a figure with no provenance is not an answer (got "${p.sentence.slice(0,120)}")`);
  ok(/counted 2026-09-20/.test(p.sentence), 'D2: …and when it was counted');

  const never = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS,
    onHand: { yards: 10, itemId: '174', itemName: 'Prepared Enriched Planting Mix by the yard', countedAt: null, provenanceNote: SEEDED_NOTE_LIVE } });
  ok(SEEDED_NOTE_LIVE !== null && never.sentence.includes(SEEDED_NOTE_LIVE),
    `🔴 D3: an uncounted figure wears the platform's own placeholder words beside it — "${SEEDED_NOTE_LIVE}" — David's honest limit, on screen (got "${never.sentence}")`);
  ok(!/ 10 from /.test(never.sentence) && !/ 10 yards /.test(never.sentence),
    'D3b: NEGATIVE CONTROL — the 10 never appears unqualified');

  const unknown = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: null });
  ok(unknown.shortfallYards === null && /Nobody has said/.test(unknown.sentence),
    '🔴 D4: no on-hand at all is NOT zero — it refuses a shortfall it cannot know');
}

// ══ §E LEAD TIME AND THE PAR BACKSTOP ═════════════════════════════════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: HAND });
  ok(p.leadTimeDays === 2 && p.makeByDate === '2026-10-01',
    `🔴 E1: two days before Saturday 3 Oct is Thursday 1 Oct (got ${p.makeByDate})`);
  ok(p.shortfallYards === 3.6, `E2: needs 4.6, has 1 → short 3.6 (got ${p.shortfallYards})`);
  ok(/Short 3\.6 — mix it by 1 October/.test(p.sentence), 'E3: …in David\'s own shape, the date in words');

  const five = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: { ...OPS, mixLeadTimeDays: 5 }, onHand: HAND });
  ok(five.makeByDate === '2026-09-28', `E4: a tenant setting 5 days gets 28 Sep — config, not a constant (got ${five.makeByDate})`);

  const quiet = mixRequirement({ day: '2026-10-05', job: 'install', lines: [], ops: OPS,
    onHand: { ...HAND, yards: 2 }, parYards: 5 });
  ok(quiet.shortfallYards === 3 && quiet.firedByPar && /below your 5-yard minimum/.test(quiet.sentence),
    `🔴 E5: with nothing scheduled, the 5-yard minimum still fires and says why (got ${quiet.shortfallYards})`);

  const busy = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: HAND, parYards: 2 });
  ok(busy.shortfallYards === 3.6 && !busy.firedByPar,
    'E6: when the schedule needs more than the minimum, the SCHEDULE governs');
}


// ══ §F  THE ON-HAND FIGURE WEARS ITS PROVENANCE, AND THE VERDICT DOES TOO ═════
// David, 2026-09-23: it renders "10 · placeholder, never counted", NEVER a bare number, and the
// verdict reads "enough only if that's right. Count it before 1 October."
{
  ok(SEEDED_NOTE_LIVE !== null,
    '🔴 F0: the live provenance words were READ out of inventoryStates.ts — if this fails the words moved and every sentence below is asserting a string nothing renders');
  ok(SEEDED_NOTE_LIVE !== 'placeholder, never counted',
    `F0b: RECORDED, NOT ASSUMED — the live words are "${SEEDED_NOTE_LIVE}", not David's illustrative "placeholder, never counted". One wording, his to change.`);

  const uncounted = { yards: 10, itemId: '174', itemName: 'Prepared Enriched Planting Mix by the yard', countedAt: null, provenanceNote: SEEDED_NOTE_LIVE };

  ok(onHandFigure(uncounted) === `10 · ${SEEDED_NOTE_LIVE}`,
    `🔴 F1: the figure is shown AND qualified — "10 · ${SEEDED_NOTE_LIVE}" (got "${onHandFigure(uncounted)}")`);
  ok(!/^\d+$/.test(onHandFigure(uncounted)),
    'F2: NEGATIVE CONTROL — it is never a bare number');
  ok(onHandFigure(HAND) === '10 · counted 2026-09-20'.replace('10', '1'),
    `F3: a genuinely counted figure says when, and wears no placeholder note (got "${onHandFigure(HAND)}")`);
  ok(onHandFigure({ ...uncounted, provenanceNote: null }) === '10 · never counted',
    'F4: a caller with no note and no count still cannot render bare — it says "never counted"');
  ok(onHandFigure({ ...uncounted, yards: null }) === 'not said',
    'F5: no figure at all reads "not said", never 0 — a redaction must not read as a real figure (D-9)');

  const plan = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: uncounted });
  ok(plan.onHandLine === `10 · ${SEEDED_NOTE_LIVE} from Prepared Enriched Planting Mix by the yard (item 174)`,
    `🔴 F6: the plan's own on-hand line carries figure + provenance + WHICH ITEM (got "${plan.onHandLine}")`);
  ok(/enough only if that's right\./.test(plan.sentence),
    `🔴 F7: 10 yd covers 4.6 — but the verdict refuses to say a flat "enough" over a number nobody counted (got "${plan.sentence}")`);
  ok(/Count it before 1 October\./.test(plan.sentence),
    '🔴 F8: …and it names the day the count must happen by — DERIVED from the 2-day lead time, not typed');
  ok(!/ — enough\./.test(plan.sentence),
    '🔴 F9: NEGATIVE CONTROL — the bare "enough" must NOT appear on an uncounted figure');

  const counted = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS,
    onHand: { ...uncounted, countedAt: '2026-10-01', provenanceNote: null } });
  ok(/ — enough\.$/.test(counted.sentence) && !/only if that's right/.test(counted.sentence),
    `🔴 F10: THE OTHER DIRECTION — once it IS counted, the caveat is GONE and the verdict is plain (got "${counted.sentence}")`);

  const short = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS,
    onHand: { ...uncounted, yards: 1 } });
  ok(/rests on a figure nobody has counted/.test(short.sentence),
    'F11: a SHORTFALL computed against a placeholder says so too — the caution is not only on the happy branch');

  // 🔴 F14 EXISTS BECAUSE A MUTANT SURVIVED. The caveat is written on TWO branches — the par
  // backstop and the scheduled shortfall — and F11 only ever reached the second, so deleting the
  // par one was invisible. Two identical lines, one probe: the classic half-covered pair.
  const parShort = mixRequirement({ day: '2026-10-05', job: 'install', lines: [], ops: OPS,
    onHand: { ...uncounted, yards: 2 }, parYards: 5 });
  ok(parShort.firedByPar && /below your 5-yard minimum/.test(parShort.sentence)
    && /rests on a figure nobody has counted/.test(parShort.sentence),
    `🔴 F14: the PAR backstop's shortfall carries the same caution — a minimum measured against a placeholder is not a measurement (got "${parShort.sentence}")`);

  ok(humanDay('2026-10-01') === '1 October' && humanDay('2026-09-28') === '28 September',
    'F12: the date is rendered by hand, so two laptops in two locales read the same plan');
  ok(humanDay('rubbish') === null && humanDay(null) === null,
    'F13: NEGATIVE CONTROL — an unparseable date yields null, never today');
}

// ══ §G  WHICH ITEM IS THE MIX — ASKED, NEVER ASSUMED ═════════════════════════
// David: no implied choice of 174 until Lauren names the made mix in tenant config.
{
  const CANDIDATES = ['174', 'FCMB 40', 'FCMB 41', 'FCMB 42', 'FCMB 51', 'FCMB 52', '605']
    .map(itemId => ({ itemId, itemName: `row ${itemId}`, countedAt: null, provenanceNote: SEEDED_NOTE_LIVE }));

  const unchosen = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS,
    onHand: { yards: 10, itemId: '174', itemName: 'row 174', countedAt: null, provenanceNote: SEEDED_NOTE_LIVE },
    mixItem: { chosenItemId: null, candidates: CANDIDATES } });

  ok(/^Which item is your planting mix\? Not yet confirmed — candidates: /.test(unchosen.mixItemLine),
    `🔴 G1: it ASKS (got "${unchosen.mixItemLine}")`);
  ok(/174, FCMB 40, FCMB 41, FCMB 42, FCMB 51, FCMB 52, 605 \(all /.test(unchosen.mixItemLine),
    'G2: every candidate is listed, each of them, with the provenance they share');
  ok(unchosen.mixItemLine.includes(`(all ${SEEDED_NOTE_LIVE})`),
    'G3: and the shared provenance is the SAME words as the on-hand figure — one wording, one fact');
  ok(/Nothing here picks one\.$/.test(unchosen.mixItemLine),
    '🔴 G4: …and it says outright that it is not choosing');
  ok(!/Your planting mix is/.test(unchosen.mixItemLine),
    '🔴 G5: NEGATIVE CONTROL — no sentence anywhere asserts a mix item while chosenItemId is null');
  ok(!/\b174 is\b/.test(unchosen.mixItemLine) && unchosen.mixItemLine.indexOf('174') === unchosen.mixItemLine.indexOf('candidates: ') + 'candidates: '.length,
    '🔴 G6: 174 appears ONLY as the first of seven equals — its position is the list order, not a recommendation');

  const chosen = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS,
    mixItem: { chosenItemId: 'FCMB 45', candidates: [...CANDIDATES, { itemId: 'FCMB 45', itemName: 'Fine Compost Mix Bulk 45', countedAt: '2026-09-20', provenanceNote: null }] } });
  ok(chosen.mixItemLine === 'Your planting mix is Fine Compost Mix Bulk 45 (item FCMB 45), set in Settings.',
    `🔴 G7: THE OTHER DIRECTION — once she names one the question STOPS being asked (got "${chosen.mixItemLine}")`);

  const stale = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS,
    mixItem: { chosenItemId: '999', candidates: CANDIDATES } });
  ok(/no live row matches it — check it/.test(stale.mixItemLine),
    'G8: a setting pointing at a row that no longer exists is SURFACED, not silently ignored');

  ok(mixItemQuestion(null) === 'Which item is your planting mix? Not yet confirmed — and no candidates have been read.',
    'G9: no candidate list read is a different honest answer from an empty one');
  ok(mixItemQuestion({ chosenItemId: null, candidates: [] }).includes('no candidates have been read'),
    'G10: …and an empty list says the same rather than rendering "candidates: ."');

  const mixed = mixItemQuestion({ chosenItemId: null, candidates: [
    { itemId: '174', itemName: 'a', countedAt: null, provenanceNote: SEEDED_NOTE_LIVE },
    { itemId: '605', itemName: 'b', countedAt: '2026-09-20', provenanceNote: null }] });
  ok(mixed.includes(`174 (${SEEDED_NOTE_LIVE})`) && mixed.includes('605 (counted 2026-09-20)') && !mixed.includes('(all '),
    `G11: when the candidates DISAGREE about provenance, each carries its own — "all" would be a false claim about 605 (got "${mixed}")`);

  ok(mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS }).mixItemLine
    .includes('Not yet confirmed'),
    '🔴 G12: a caller that passes NO mixItem at all still gets the question, never silence');
}


// ══ §H  THE REAL CALLER SUPPLIES NO NOTE — AND IS STILL NOT ALLOWED TO LIE ════
// 🔴 THIS SECTION EXISTS BECAUSE THE BUILD WAS WRONG WHEN RUN ON THE LIVE DATABASE. Every §F/§G
// fixture passed provenanceNote explicitly, so all 56 probes sat OUTSIDE the population every
// real caller is in: `fetchSeededLots` marks only a row carrying an `opening_stock_seed` event,
// and LAWNS's twelve candidate mix rows have NO ledger row of any kind — so the note is null and
// countedAt is null. The first draft rendered "(all counted)" beside twelve never-counted rows
// and a flat "enough" over item 174. tech-debt #182: a probe measuring the wrong population.
{
  const REAL = { yards: 10, itemId: '174', itemName: 'Prepared Enriched Planting Mix by the yard',
    countedAt: null, provenanceNote: null };

  ok(isCounted(REAL) === false,
    '🔴 H1: no note AND no date is NOT counted — a count is proven by a date, never by the absence of a note');
  ok(isCounted({ countedAt: '2026-09-20', provenanceNote: null }) === true,
    'H2: a date with no note IS counted — the other direction');
  ok(isCounted({ countedAt: '2026-09-20', provenanceNote: SEEDED_NOTE_LIVE }) === false,
    '🔴 H3: a note BEATS a date — if the platform says placeholder, a stale date does not overrule it');
  ok(provenanceWords(REAL) === 'never counted',
    `H4: and the words say so (got "${provenanceWords(REAL)}")`);

  const plan = mixRequirement({ day: '2026-10-03', job: 'install', lines: OCT3, ops: OPS, onHand: REAL,
    mixItem: { chosenItemId: null, candidates: [
      { itemId: '174', itemName: 'a', countedAt: null, provenanceNote: null },
      { itemId: '605', itemName: 'b', countedAt: null, provenanceNote: null }] } });

  ok(/enough only if that's right\. Count it before 1 October\./.test(plan.sentence),
    `🔴 H5: THE LIVE SHAPE — 10 yd covers 2.7 and the verdict STILL refuses a flat "enough" (got "${plan.sentence}")`);
  ok(!/ — enough\./.test(plan.sentence),
    '🔴 H6: NEGATIVE CONTROL — this is the exact sentence the live run produced wrongly');
  ok(plan.mixItemLine.includes('(all never counted)') && !plan.mixItemLine.includes('(all counted)'),
    `🔴 H7: …and the candidate list says NEVER COUNTED, not "counted" (got "${plan.mixItemLine}")`);
  ok(plan.onHandLine === '10 · never counted from Prepared Enriched Planting Mix by the yard (item 174)',
    `H8: the on-hand line is the figure, its provenance and its item (got "${plan.onHandLine}")`);
}

console.log(`\nmixPlanning: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
