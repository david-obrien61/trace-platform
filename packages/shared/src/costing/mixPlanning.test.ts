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
import { mixRequirement, type PlannedLine } from './mixPlanning';
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
const HAND = { yards: 1, itemId: '174', itemName: 'Prepared Enriched Planting Mix by the yard', countedAt: '2026-09-20' };

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
    onHand: { yards: 10, itemId: '174', itemName: 'Prepared Enriched Planting Mix by the yard', countedAt: null } });
  ok(/never counted/.test(never.sentence),
    '🔴 D3: an uncounted figure says NEVER COUNTED beside it — David\'s honest limit, on screen');

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
  ok(/Short 3\.6 — mix it by 2026-10-01/.test(p.sentence), 'E3: …in David\'s own shape');

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

console.log(`\nmixPlanning: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
