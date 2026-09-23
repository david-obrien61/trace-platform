/**
 * ── mixPlanning — is there enough mix for Saturday? (ledger #370) ──
 *
 * 🔴 THE FIXTURE IS A REAL UPCOMING LAWNS DAY, read live 2026-09-23: Saturday 3 October carries
 * 9 trees with a readable size, plus a Tree Bubbler and a Trunk Protection line that have none.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/costing/mixPlanning.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { mixRequirement, type PlannedTree } from './mixPlanning';
import { GALLONS_PER_CUBIC_YARD, OPERATIONS_DEFAULTS, OPERATIONS_BASIS } from '../production/productionConfig';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const OPS = { mixGallonsPerPotVolume: 1, installMixContainerVolumesPerTree: 2, mixShrinkPct: 0,
  mixLeadTimeDays: 2, trueGallonsPerCubicYard: GALLONS_PER_CUBIC_YARD };

/** Saturday 3 Oct as the schedule holds it. */
const OCT3: PlannedTree[] = [
  { label: 'Live Oak 45 gal', potGallons: 45, quantity: 4 },
  { label: 'Cedar Elm 30 gal', potGallons: 30, quantity: 3 },
  { label: 'Shumard Red Oak 95 gal', potGallons: 95, quantity: 2 },
  { label: 'Tree Bubbler', potGallons: null, quantity: 1 },
  { label: 'Trunk Protection', potGallons: null, quantity: 2 },
];

// ══ §0 THE SHIPPED DEFAULTS ARE DAVID'S FIGURES ══════════════════════════════════════════════
// ⚠️ THIS SECTION EXISTS BECAUSE TWO MUTANTS SURVIVED. Every other probe passes `OPS` explicitly,
// so changing the DEFAULTS in productionConfig.ts broke nothing — the fixture bypassed the very
// values David specified. A probe whose fixture supplies the thing under test measures nothing
// about it (tech-debt #182's family, fourth sighting on this branch).
{
  ok(OPERATIONS_DEFAULTS.mixLeadTimeDays === 2,
    `🔴 0A: the shipped lead time is 2 days — LAWNS, David 2026-09-23 (got ${OPERATIONS_DEFAULTS.mixLeadTimeDays})`);
  ok(OPERATIONS_DEFAULTS.mixGallonsPerPotVolume === 1,
    `🔴 0B: a pot consumes its OWN gallons — 1.0, David 2026-09-23 (got ${OPERATIONS_DEFAULTS.mixGallonsPerPotVolume})`);
  ok(OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree === 2,
    `🔴 0C: …and R-155's INSTALL figure is UNTOUCHED at 2.0 — the new key did not overwrite the live one (got ${OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree})`);
  ok(OPERATIONS_BASIS.mixGallonsPerPotVolume.basis === 'guess',
    '0D: the pot figure is labelled an ESTIMATE (basis `guess`), as David asked — not presented as measured');
  ok(OPERATIONS_BASIS.mixLeadTimeDays.basis === 'fact',
    '0E: …while the lead time IS a fact — he measured it at LAWNS');
  ok(/2026-09-23/.test(OPERATIONS_BASIS.mixLeadTimeDays.because),
    '0F: and both carry where they came from, like every other unmeasured number here');
}

// ══ §A THE LEAD TIME IS CONFIG, AND IT TURNS A QUANTITY INTO A DAY ════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 0 });
  ok(p.leadTimeDays === 2, `A1: the lead time comes from config — 2 at LAWNS (got ${p.leadTimeDays})`);
  ok(p.makeByDate === '2026-10-01',
    `🔴 A2: two days before Saturday 3 Oct is Thursday 1 Oct — MRP's planned order release (got ${p.makeByDate})`);
  const five = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: { ...OPS, mixLeadTimeDays: 5 }, onHandYards: 0 });
  ok(five.makeByDate === '2026-09-28',
    `🔴 A3: a tenant that sets 5 days gets 28 Sep — the figure is NOT hard-coded (got ${five.makeByDate})`);
  ok(/by 2026-10-01/.test(p.sentence), 'A4: …and the date is in the sentence a person reads, not only in a field');
}

// ══ §B MIX PER POT = THE POT'S GALLONS, AND SETTLE IS mixShrinkPct ════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 0 });
  // 4×45 + 3×30 + 2×95 = 180 + 90 + 190 = 460 gallons at 1.0
  ok(p.neededYards === 2.3,
    `🔴 B1: 460 gallons of pot volume is 2.3 yards at the pot's own gallons (got ${p.neededYards})`);
  ok(p.neededYardsOtherRule === 4.6,
    `🔴 B2: …and 4.6 yards under R-155's 2.0 — BOTH are returned, never one silently (got ${p.neededYardsOtherRule})`);

  // 🔴 SETTLE GROSSES UP: to end with 460 settled gallons at 10% settle you start with 511 loose.
  const settled = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: { ...OPS, mixShrinkPct: 0.1 }, onHandYards: 0 });
  ok(settled.neededYards === 2.5,
    `🔴 B3: a 10% settle allowance needs MORE loose mix, not less — 2.5 yards, not 2.1 (got ${settled.neededYards})`);
  ok(settled.neededYards! > p.neededYards!,
    'B4: …the direction is the check — a settle allowance that REDUCED the requirement would be the same key read backwards');

  const custom = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: { ...OPS, mixGallonsPerPotVolume: 1.5 }, onHandYards: 0 });
  ok(custom.neededYards === 3.4, `B5: a tenant that sets 1.5 gets 3.4 yards — config, not a constant (got ${custom.neededYards})`);
}

// ══ §C WHAT IT REFUSES TO GUESS ═══════════════════════════════════════════════════════════════
{
  const p = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 4 });
  ok(p.unsized.length === 2 && p.unsized.includes('Tree Bubbler'),
    `🔴 C1: the two lines with no pot size are NAMED, not counted as zero (got ${JSON.stringify(p.unsized)})`);
  ok(/could not be sized and are NOT in that figure/.test(p.sentence),
    'C2: …and the sentence says they are missing from the total — silent under-counting is the failure this prevents');

  const unknown = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: null });
  ok(unknown.shortfallYards === null && /Nobody has said how much mix is on hand/.test(unknown.sentence),
    '🔴 C3: on-hand of NULL is not zero — it reports that nobody has said, rather than claiming a shortfall it cannot know');

  const never = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 4, onHandCountedAt: null });
  ok(/never counted/.test(never.sentence),
    '🔴 C4: an uncounted figure says "never counted" BESIDE it — David\'s honest limit, on screen not in a comment');
  const counted = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 4, onHandCountedAt: '2026-09-20' });
  ok(/counted 2026-09-20/.test(counted.sentence), 'C4b: …and a counted one says when');

  const nothing = mixRequirement({ day: '2026-10-05', trees: [], ops: OPS, onHandYards: 4 });
  ok(nothing.neededYards === null && /No trees scheduled/.test(nothing.sentence),
    'C5: a day with no trees says so rather than reporting 0 yards needed');
  const allUnsized = mixRequirement({ day: '2026-10-05', trees: [{ label: 'Blue Point Juniper (Replacement)', potGallons: null, quantity: 1 }], ops: OPS, onHandYards: 4 });
  // ✏️ THE REGEX WAS WRONG, NOT THE MODEL. It expected "could not be sized"; the sentence reads
  // "Nothing on 2026-10-05 could be sized", which is better English and says the same thing. Fixed
  // the assertion to the real wording rather than bending the wording to the assertion.
  ok(allUnsized.neededYards === null && /Nothing on 2026-10-05 could be sized/.test(allUnsized.sentence),
    `🔴 C6: a day whose every line is unsized reports NOTHING KNOWN — not a confident zero. A real 26 Sep line. (got "${allUnsized.sentence.slice(0,70)}")`);
}

// ══ §D THE SHORTFALL, AND THE PAR LEVEL AS A SECOND TRIGGER ═══════════════════════════════════
{
  const short = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 1, onHandCountedAt: '2026-09-20' });
  ok(short.shortfallYards === 1.3, `🔴 D1: needs 2.3, has 1 → short 1.3 (got ${short.shortfallYards})`);
  ok(/Short 1\.3 — mix it by 2026-10-01/.test(short.sentence), `D2: …in David's own shape (got "${short.sentence.slice(0,80)}")`);

  const enough = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 9, onHandCountedAt: '2026-09-20' });
  ok(enough.shortfallYards === 0 && /enough/.test(enough.sentence),
    'D3: plenty on hand says ENOUGH — the prompt must disappear when the shortfall does');

  // par fires in a quiet week, when the schedule asks for nothing
  const quiet = mixRequirement({ day: '2026-10-05', trees: [], ops: OPS, onHandYards: 2, onHandCountedAt: '2026-09-20', parYards: 5 });
  ok(quiet.shortfallYards === 3 && quiet.firedByPar,
    `🔴 D4: with no trees scheduled, the 5-yard minimum still fires — 3 short (got ${quiet.shortfallYards})`);
  ok(/below your 5-yard minimum/.test(quiet.sentence), 'D5: …and says WHY it fired, so it is not mistaken for a scheduled need');

  const busy = mixRequirement({ day: '2026-10-03', trees: OCT3, ops: OPS, onHandYards: 1, parYards: 2 });
  ok(busy.shortfallYards === 1.3 && !busy.firedByPar,
    'D6: when the schedule asks for more than the par level, the SCHEDULE governs and par is not credited');
}

console.log(`\nmixPlanning: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
