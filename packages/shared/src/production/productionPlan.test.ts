/**
 * ── production planning — the split, the labour, the cascade, the hold, the flags ──
 *    2026-09-05 · ledger #276 · R-84…R-92
 *
 * RED-FIRST. Every §-block below was written and run against the un-built module BEFORE the module
 * existed, and every one of them failed. The failures that mattered are recorded at their
 * assertions with a 🔴 so a later reader can tell an assertion that has ever been red from one that
 * merely passes.
 *
 * 🔴 THE DISCIPLINE THIS FILE IS UNDER (R-33): *"A CHECK THAT CANNOT DISAGREE IS NOT A CHECK."*
 * So the negative assertions here are as load-bearing as the positive ones, and several of them
 * exist specifically because an earlier draft of the probe would have passed against a broken
 * module. Those are marked ⚠️ SELF-CATCH.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/production/productionPlan.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { fact, suggestion, guess, basisSentence, weakest, compareToActual } from './basis';
import {
  OPERATIONS_DEFAULTS, resolveConfig, coverMonthsFor, isWithheld,
  MONEY_WALLED_KEYS, type OperationsConfig,
} from './productionConfig';
import {
  rungKey, classifyLot, splitLot, planLots, mixCubicYardsPerPot, runMinutes, minutesPerPot,
  crewHours, splitPenalty, potCascade, sequenceRuns, arithmeticCheck, addMonths, addWorkingDays,
  workingDaysBetween, ARITHMETIC_TOLERANCE, type LotInput,
} from './productionMath';
import { holdsStock, availableFrom3, availabilityLabel3, PLAN_STATUSES } from './productionHold';
import { flagsFor, validateCompletion, FLAG_THRESHOLD_DAYS, POSSIBLE_CAUSES } from './productionFlags';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const OPS = OPERATIONS_DEFAULTS;

const lot = (over: Partial<LotInput> = {}): LotInput => ({
  id: 'L1', name: 'Joan Lionetti Texas Live Oak', size: '30 gallon',
  unitValue: 30, unitValueMax: null, unitKind: 'container', unitName: 'gallon',
  qty: 220, committed: 0, location: 'Block A',
  salesPerMonth: 9, coverMonths: null, cushionPct: null, growMonths: null, ...over,
});

// ════════════════════════════════════════════════════════════════════════════════
// §A — THE ARITHMETIC REPRODUCES THE OWNER'S OWN FIGURES
// Population: the two fills David named. Tenant: none — pure arithmetic over the ruled config.
// ════════════════════════════════════════════════════════════════════════════════
const cfg = resolveConfig(null, { blendedMixCostPerCubicYard: 151 }, true);
const fill = (g: number) => mixCubicYardsPerPot(0, g, OPS) * 151;

ok(near(Math.round(fill(15) * 100) / 100, 7.85), '🔴 §A a 15-gallon fill is $7.85 — the owner had this number before we existed');
ok(near(Math.round(fill(30) * 100) / 100, 15.70), '🔴 §A a 30-gallon fill computes to $15.70');

// 🔴 THE CENT. David's spec says the 30-gallon check "reads $15.71". It does not — $151/yd³
// reproduces 15.70004. The cent is in the owner's own original arithmetic, and a zero-tolerance
// check would have shipped RED on day one against the exact config he ruled.
const checks = arithmeticCheck(cfg);
ok(checks.length === 2, '§A the self-check renders two rows');
ok(checks[0].passes && checks[0].difference === 0, '§A the 15-gallon check is exact');
ok(checks[1].passes, '🔴 §A the 30-gallon check PASSES within one cent — a false red here would teach the owner to ignore the indicator');
ok(Math.abs(checks[1].difference) === 0.01, '🔴 §A …and it still REPORTS the cent rather than absorbing it');
ok(ARITHMETIC_TOLERANCE === 0.01, '§A the tolerance is one cent, declared');

// ⚠️ SELF-CATCH: an earlier draft asserted only `passes`, which would have gone green against a
// tolerance of $5. Asserting the DIFFERENCE is what makes the tolerance itself checkable.
ok(!arithmeticCheck(resolveConfig(null, { blendedMixCostPerCubicYard: 160 }, true))[0].passes,
  '🔴 §A a WRONG mix cost ($160) FAILS the 15-gallon check — the indicator can go red, so its green means something');
ok(arithmeticCheck(resolveConfig(null, null, true)).length === 0,
  '§A with the mix cost absent the check renders NOTHING — a check nobody can evaluate must not read as a failing one');

// the 30→45 delta happens to equal the 15-gallon FILL; the labels must not be interchangeable
ok(near(mixCubicYardsPerPot(30, 45, OPS), mixCubicYardsPerPot(0, 15, OPS)),
  '§A a 30→45 delta is the same volume as a 15-gallon fill — which is exactly why the check labels say "fill"');
ok(mixCubicYardsPerPot(45, 30, OPS) === 0, '§A moving DOWN a size yields zero mix, never a negative volume');

// ════════════════════════════════════════════════════════════════════════════════
// §B — LABOUR IS SETUP PLUS HANDLING (R-86). David's four figures, reproduced.
// Population: the four batch sizes he named.
// ════════════════════════════════════════════════════════════════════════════════
ok(near(minutesPerPot(10, OPS)!, 9.0), '🔴 §B 10 pots → 9.0 min/pot');
ok(near(minutesPerPot(20, OPS)!, 6.0), '🔴 §B 20 pots → 6.0 min/pot — this is the "2 hours for 20 pots" figure');
ok(near(minutesPerPot(60, OPS)!, 4.0), '🔴 §B 60 pots → 4.0 min/pot');
ok(near(minutesPerPot(120, OPS)!, 3.5), '🔴 §B 120 pots → 3.5 min/pot');
ok(minutesPerPot(0, OPS) === null, '§B zero pots has no per-pot rate — null, not Infinity and not 0');
ok(runMinutes(0, OPS) === 0, '§B nobody sets up for nothing');

// 🔴 THE HEADLINE: the same plan is 187 crew-hours or 73, purely from batch size.
ok(near(Math.round(crewHours(1245, 10, OPS) * 100) / 100, 187.25), '🔴 §B 1,245 pots at batches of 10 → 187.25 crew-hours');
ok(near(Math.round(crewHours(1245, 120, OPS) * 100) / 100, 73.25), '🔴 §B …and at batches of 120 → 73.25. Batch size is the lever, not crew.');

// ⚠️ SELF-CATCH: a flat 3-min-a-pot model gives 62.25 hours at BOTH batch sizes. This assertion is
// the one that would fail if setup were ever dropped back out of the model.
ok(crewHours(1245, 10, OPS) !== crewHours(1245, 120, OPS),
  '🔴 §B batch size CHANGES the hours — a flat per-pot rate would make these identical and the lever invisible');

// every split is one extra setup, whatever the batch size
ok(near(crewHours(40, 40, OPS), 3.0), '🔴 §B 40 pots in ONE run is 3.0 crew-hours');
ok(near(crewHours(40, 20, OPS), 4.0), '🔴 §B 40 pots as 20 + 20 is 4.0 — setup is paid twice');
ok(splitPenalty(2, OPS).extraMinutes === 60, '§B one split costs one setup, 60 minutes');
ok(splitPenalty(1, OPS).extraRuns === 0, '§B an unsplit run has no penalty');
ok(splitPenalty(4, OPS).extraMinutes === 180, '§B three splits cost three setups — independent of batch size');

// ════════════════════════════════════════════════════════════════════════════════
// §C — THE FOUR-WAY SPLIT, AND THE TWO WORKBOOK DEFECTS IT FIXES
// Population: the workbook's own first row (220 on hand, 9 a month). Tenant: the workbook.
// ════════════════════════════════════════════════════════════════════════════════
const wb = splitLot(lot(), { ...OPS, coverMonthsOverride: 6 }, null);
ok(wb.mustKeepSellable === 54, '§C must-keep = 9 a month × 6 months = 54 — the workbook row reproduces');
ok(wb.cushion === 22, '§C cushion = 10% of 220 = 22');
ok(wb.delta === 144, '§C delta = 220 − 54 − 22 = 144');
ok(wb.uppotNow === 144, '§C a manager who types nothing takes the whole delta');

// 🔴 DEFECT 1 — cover months now TIES to grow months. The workbook holds 6 against a 7-month grow.
const tied = splitLot(lot(), OPS, null);
ok(tied.coverMonthsUsed === 7, '🔴 §C cover months defaults to GROW months (7), not to its own number');
ok(tied.mustKeepSellable === 63, '🔴 §C …so must-keep is 63, not 54 — the workbook held back one month too little');
ok(tied.delta === 135, '🔴 §C …and the delta is 135, nine trees smaller than the workbook says');
ok(coverMonthsFor(OPS, 4, 7) === 4, '§C a per-variety cover still wins over the tie');
ok(coverMonthsFor({ ...OPS, coverMonthsOverride: 5 }, null, 7) === 5, '§C a business-wide override wins over the tie');
ok(coverMonthsFor(OPS, null, null) === 7, '§C with no grow months either, the business default carries');

// 🔴 DEFECT 2 — still-sellable subtracts COMMITTED. The workbook omits it.
const withOrders = splitLot(lot({ committed: 40 }), { ...OPS, coverMonthsOverride: 6 }, null);
ok(withOrders.stillSellable === 36, '🔴 §C still-sellable = 220 − 40 committed − 144 held = 36');
ok(wb.stillSellable === 76, '§C …and with nothing committed it is 76, which is where the workbook agrees by accident');
// ⚠️ SELF-CATCH: the workbook's formula (onHand − uppotNow) gives 76 in BOTH cases. If this
// assertion is ever removed, the defect returns silently and every number on screen stays plausible.
ok(withOrders.stillSellable !== 76, '🔴 §C the workbook formula would say 76 here and be wrong by 40 trees');

// the manager's number is clamped and the clamp is REPORTED, not silent
const over = splitLot(lot(), { ...OPS, coverMonthsOverride: 6 }, 200);
ok(over.uppotNow === 144 && over.clamped, '§C asking for more than the delta clamps AND says it clamped');
ok(!splitLot(lot(), { ...OPS, coverMonthsOverride: 6 }, 100).clamped, '§C asking for less does not report a clamp');
ok(splitLot(lot({ qty: 10 }), OPS, null).delta === 0, '§C a lot smaller than its cover has nothing to give');
ok(splitLot(lot({ qty: 10 }), OPS, null).stillSellable === 10, '§C …and all of it stays sellable');

// ════════════════════════════════════════════════════════════════════════════════
// §D — GROUP ON THE PROJECTION, NEVER ON `size` (R-27)
// Population: the six live spellings of thirty measured at LAWNS on 2026-09-04 (90 rows).
// ════════════════════════════════════════════════════════════════════════════════
const SPELLINGS = ['30 gallon', '30 Gallon', '30g', '30 Gallons', '30 gallons', '30Gallon'];
const keys = new Set(SPELLINGS.map((s) => rungKey(lot({ size: s }))));
ok(keys.size === 1, '🔴 §D all six LIVE spellings of thirty fold to ONE rung key — this is the 90 rows at LAWNS');
ok([...keys][0] === 'joan lionetti texas live oak|30', '§D …and the key is the projection, not the string');

// ⚠️ SELF-CATCH: this probe would pass trivially if rungKey ignored size entirely. Two DIFFERENT
// rungs must produce two different keys, or the fold above proves nothing.
ok(rungKey(lot({ unitValue: 45 })) !== rungKey(lot({ unitValue: 30 })),
  '🔴 §D two different sizes are two different rungs — without this the fold above would pass on a constant');
ok(rungKey(lot({ name: 'Lacey Oak' })) !== rungKey(lot()), '§D two different varieties are two different rungs');

// a RANGE is refused, never assigned an end. Four such rows are live at LAWNS.
const range = lot({ size: '10/15 gallon', unitValue: 10, unitValueMax: 15 });
ok(rungKey(range) === null, '🔴 §D a range has NO rung key');
const rr = classifyLot(range);
ok(!rr.ok && rr.reason === 'range', '🔴 §D …and it is REFUSED with the reason named');
ok(!rr.ok && rr.detail.includes('10') && rr.detail.includes('15'), '🔴 §D …naming BOTH ends, so nobody has to guess which was dropped');

// the three read states are distinguishable (ui-control-standards §6/R1)
const nc = classifyLot(lot({ qty: null }));
ok(!nc.ok && nc.reason === 'never_counted', '🔴 §D a never-counted lot is REFUSED, not planned as zero');
ok(!nc.ok && nc.detail.includes('not a count of zero'), '🔴 §D …and it says so — 445 of LAWNS\'s 447 rows are this case');
ok(classifyLot(lot({ qty: 0 })).ok, '§D a lot counted AT zero is a real answer and is planned');
ok(!classifyLot(lot({ unitKind: null })).ok, '§D an unparsed size is refused');
ok(!classifyLot(lot({ unitKind: 'weight', size: '40 lb' })).ok, '§D a weight is not a container rung');

// ════════════════════════════════════════════════════════════════════════════════
// §E — THE POT CASCADE (R-87). The named witness: Lauren has run out of pots mid-uppotting.
// Population: the workbook's ten varieties, 1,328 pots.
// ════════════════════════════════════════════════════════════════════════════════
const MOVES = [
  { fromUnitValue: 30, toUnitValue: 45, qty: 144 }, { fromUnitValue: 30, toUnitValue: 45, qty: 90 },
  { fromUnitValue: 15, toUnitValue: 30, qty: 195 }, { fromUnitValue: 15, toUnitValue: 30, qty: 172 },
  { fromUnitValue: 30, toUnitValue: 45, qty: 61 },  { fromUnitValue: 3,  toUnitValue: 15, qty: 324 },
  { fromUnitValue: 15, toUnitValue: 30, qty: 120 }, { fromUnitValue: 5,  toUnitValue: 15, qty: 78 },
  { fromUnitValue: 15, toUnitValue: 30, qty: 99 },  { fromUnitValue: 30, toUnitValue: 45, qty: 45 },
];
const casc = potCascade(MOVES, OPS);
ok(casc.rungs[0].unitValue === 45, '🔴 §E the cascade works DOWN the ladder — biggest rung first');
ok(casc.rungs.map((r) => r.unitValue).join(',') === '45,30,15,5,3', '§E …all five rungs, descending');
ok(casc.rungs[0].needed === 340 && casc.rungs[0].buy === 340, '🔴 §E you always BUY at the top — nothing above it is being emptied');
ok(casc.rungs[1].needed === 586 && casc.rungs[1].freed === 340, '§E the 30s need 586 and 340 are freed by the trees going to 45');
ok(casc.rungs[1].reusable === 306, '§E …306 reusable at 90% recovery');
ok(casc.rungs[1].buy === 280, '§E …so 280 to buy, not 586');
ok(casc.rungs[2].buy === 0, '🔴 §E the 15s buy NOTHING — 586 pots were freed by the trees that went to 30');
ok(casc.totalBuyDownTheLadder === 620, '🔴 §E 620 pots down the ladder');
ok(casc.totalBuyWorstOrder === 1328, '🔴 §E …against 1,328 in the worst order — the whole plan bought new');
ok(casc.potsSavedBySequence === 708, '🔴 §E 708 pots saved by SEQUENCE ALONE. Same work, same trees, same window.');

// ⚠️ SELF-CATCH: if recovery were ignored the 30s would buy 246, not 280. The rate must bite.
ok(potCascade(MOVES, { ...OPS, potRecoveryRate: 1 }).rungs[1].buy === 246,
  '🔴 §E at 100% recovery the 30s buy 246 — so the recovery rate is genuinely applied, not decorative');
ok(potCascade(MOVES, { ...OPS, potRecoveryRate: 0 }).totalBuyDownTheLadder === 1328,
  '§E at 0% recovery the cascade saves nothing and equals the worst order');
ok(potCascade([], OPS).totalBuyDownTheLadder === 0, '§E an empty plan buys no pots');

// down the ladder, and WITHIN a rung by block — with revisits NAMED rather than silently chosen
const seq = sequenceRuns([
  { fromUnitValue: 15, toUnitValue: 30, qty: 40, location: 'Block A' },
  { fromUnitValue: 30, toUnitValue: 45, qty: 30, location: 'Block A' },
  { fromUnitValue: 30, toUnitValue: 45, qty: 20, location: 'Block B' },
]);
ok(seq.order[0].toUnitValue === 45, '🔴 §E the ladder wins the primary sort — the 45s go first');
ok(seq.order[0].location === 'Block A' && seq.order[1].location === 'Block B', '§E …and block breaks the tie within a rung');
ok(seq.revisits.length === 1 && seq.revisits[0].location === 'Block A', '🔴 §E Block A is REVISITED and the surface is told which block');
ok(seq.revisits[0].extraRuns === 1, '🔴 §E …at the cost of one extra setup, priced rather than hidden');
ok(sequenceRuns([{ fromUnitValue: 15, toUnitValue: 30, qty: 5, location: null }]).blocksUnknown === 1,
  '§E a lot with no block is COUNTED as unknown rather than bucketed into one');

// ════════════════════════════════════════════════════════════════════════════════
// §F — THE HOLD IS DERIVED, AND `draft` HOLDS
// ════════════════════════════════════════════════════════════════════════════════
ok(holdsStock('draft') && holdsStock('open'), '§F draft and open both hold stock');
ok(!holdsStock('completed'), '🔴 §F a completed batch releases — the trees moved, so holding them again subtracts twice');
ok(!holdsStock('cancelled'), '§F a cancelled plan releases');
ok(holdsStock('paused'), '🔴 §F an UNKNOWN status holds by default — exclusion, so a new state fails toward not overselling');
ok(PLAN_STATUSES.filter(holdsStock).length === 2, '§F exactly two of the four statuses hold');

ok(availableFrom3(220, 40, 144) === 36, '🔴 §F available = on-hand − committed − held');
ok(availableFrom3(220, 0, 0) === 220, '§F with no claims, available is on-hand');
ok(availableFrom3(10, 5, 20) === 0, '🔴 §F over-claimed stock floors at 0 — never a negative shown to a customer');
ok(availabilityLabel3(220, 40, 144).includes('held for uppotting'), '🔴 §F the sentence NAMES the hold — nobody would guess production took it');
ok(availabilityLabel3(220, 0, 0) === '220 available', '§F with no claims the sentence stays short');
ok(!availabilityLabel3(220, 0, 144).includes('committed'), '§F a zero claim is not named');
ok(availabilityLabel3(null, 0, 0) === '', '§F an uncounted lot has no availability sentence at all');

// ════════════════════════════════════════════════════════════════════════════════
// §G — THE SEVEN-DAY FLAGS (R-88b), AND THE REFUSAL TO GUESS A CAUSE
// ════════════════════════════════════════════════════════════════════════════════
const LINES = [
  { id: 'a', label: 'Lacey Oak 30→45', scheduledDate: '2026-11-20', completedDate: null, status: 'open' },
  { id: 'b', label: 'Brodie 3→15', scheduledDate: '2026-11-20', completedDate: '2026-12-05', status: 'completed' },
  { id: 'c', label: 'On time', scheduledDate: '2026-11-20', completedDate: '2026-11-22', status: 'completed' },
  { id: 'd', label: 'Not yet due', scheduledDate: '2026-12-20', completedDate: null, status: 'open' },
  { id: 'e', label: 'Cancelled', scheduledDate: '2026-01-01', completedDate: null, status: 'cancelled' },
  { id: 'f', label: 'Never scheduled', scheduledDate: null, completedDate: null, status: 'open' },
];
const flags = flagsFor(LINES, '2026-12-01');
ok(FLAG_THRESHOLD_DAYS === 7, '§G one threshold, seven days');
ok(flags.length === 2, '§G exactly two of the six lines flag');
ok(flags.some((f) => f.kind === 'open_overdue' && f.lineId === 'a'), '🔴 §G an open batch 11 days past schedule flags as ACTIONABLE');
ok(flags.some((f) => f.kind === 'completed_late' && f.lineId === 'b'), '🔴 §G a batch finished 15 days late flags as HISTORICAL');
ok(!flags.some((f) => f.lineId === 'c'), '§G two days late is not late');
ok(!flags.some((f) => f.lineId === 'd'), '§G a batch not yet due does not flag');
ok(!flags.some((f) => f.lineId === 'e'), '🔴 §G a CANCELLED batch never flags, however old');
ok(!flags.some((f) => f.lineId === 'f'), '🔴 §G a batch with no scheduled date has nothing to be late against');
ok(flagsFor(LINES, '2026-11-27').filter((f) => f.kind === 'open_overdue').length === 0,
  '🔴 §G exactly at seven days it does NOT flag — the threshold is "more than", and an off-by-one here would cry wolf on every batch');

// ⚠️ SELF-CATCH — FOUND BY MUTANT P20, NOT BY REVIEW. The boundary above exercises only the OPEN
// branch. The COMPLETED branch carries its own copy of the same comparison, and no line in LINES
// finishes at exactly seven days, so flipping THAT `>` to `>=` changed nothing any assertion could
// see. Two branches, one rule, and only one of them was being watched.
const BOUNDARY = [
  { id: 'g', label: 'Finished at exactly seven', scheduledDate: '2026-11-20', completedDate: '2026-11-27', status: 'completed' },
  { id: 'h', label: 'Finished at eight', scheduledDate: '2026-11-20', completedDate: '2026-11-28', status: 'completed' },
];
ok(flagsFor(BOUNDARY, '2026-12-01').length === 1, '🔴 §G the COMPLETED branch has the same boundary — seven days is not late, eight is');
ok(flagsFor(BOUNDARY, '2026-12-01')[0].lineId === 'h', '🔴 §G …and it is the eight-day line that flags, not the seven');

// 🔴 THE CLAUSE: the flag must not guess which cause it is.
ok(POSSIBLE_CAUSES.length === 3, '§G three causes are offered');
ok(POSSIBLE_CAUSES.some((c) => c.includes('stock counts are wrong right now')),
  '🔴 §G the second cause names the DATA consequence — trees physically moved while the system says otherwise');
const openFlag = flags.find((f) => f.kind === 'open_overdue')!;
ok(!/because|probably|likely|forgot/i.test(openFlag.detail),
  '🔴 §G the flag text names NO cause — "ran late" and "was done and never marked" are indistinguishable from here');
ok(openFlag.detail.includes('cannot tell them apart'), '🔴 §G …and it says so out loud');

// backdating carries a reason and an author
const noReason = validateCompletion({ scheduledDate: '2026-11-20', completedDate: '2026-11-25', today: '2026-12-01', qtyPlanned: 40, qtyCompleted: 40, reason: null });
ok(!noReason.ok && noReason.problem === 'needs_reason', '🔴 §G a backdated completion with no reason is REFUSED');
const withReason = validateCompletion({ scheduledDate: '2026-11-20', completedDate: '2026-11-25', today: '2026-12-01', qtyPlanned: 40, qtyCompleted: 40, reason: 'finished before the button was pressed' });
ok(withReason.ok && withReason.backdated, '§G …and accepted with one');
ok(validateCompletion({ scheduledDate: null, completedDate: '2026-12-01', today: '2026-12-01', qtyPlanned: 40, qtyCompleted: 40, reason: null }).ok,
  '🔴 §G completing TODAY needs no reason — the friction is on the backdate alone');
const future = validateCompletion({ scheduledDate: null, completedDate: '2026-12-09', today: '2026-12-01', qtyPlanned: 40, qtyCompleted: 40, reason: 'x' });
ok(!future.ok && future.problem === 'future_date', '§G a completion in the future is refused');
const partial = validateCompletion({ scheduledDate: null, completedDate: '2026-12-01', today: '2026-12-01', qtyPlanned: 40, qtyCompleted: 25, reason: null });
ok(partial.ok && partial.partial && partial.remainder === 15, '🔴 §G a PARTIAL completion is accepted with the remainder named');
ok(partial.ok && partial.notice.includes('not a failure'), '🔴 §G …and the copy says it is not a failure');
const tooMany = validateCompletion({ scheduledDate: null, completedDate: '2026-12-01', today: '2026-12-01', qtyPlanned: 40, qtyCompleted: 41, reason: null });
ok(!tooMany.ok && tooMany.problem === 'over_planned', '§G completing more than was planned is refused');

// ════════════════════════════════════════════════════════════════════════════════
// §H — BASIS: every suggested number shows its working (R-89)
// ════════════════════════════════════════════════════════════════════════════════
ok(fact(1120, '1,120 pots counted').basis === 'fact', '§H a measured number is a fact');
ok(suggestion(62, '1,245 pots', '3 minutes a pot').assumption === '3 minutes a pot', '§H a suggestion CARRIES its assumption');
ok(guess(6, 'productive hours a day').assumption === undefined, '§H a guess has no assumption to carry');
ok(basisSentence(suggestion(62, '1,245 pots', '3 min a pot, which nobody has timed')).includes('nobody has timed'),
  '🔴 §H the assumption is in the SAME BREATH as the number, not in a tooltip');
ok(basisSentence(guess(6, 'productive hours')).includes('nobody has measured'), '§H a guess announces itself');
ok(weakest(['fact', 'fact', 'guess']) === 'guess', '🔴 §H a total is only as good as its WORST input');
ok(weakest(['fact', 'suggestion']) === 'suggestion', '§H …and a suggestion degrades a fact');
ok(weakest([]) === 'guess', '🔴 §H an EMPTY basis list is a guess, not a fact — defaulting to the strongest class on no evidence is the same defect inverted');

// the gap is the instrument; nothing adopts the actual
const gap = compareToActual(62, 80);
ok(gap.delta === 18 && !gap.withinPlan, '§H the gap reports over-run');
ok(compareToActual(62, 50).withinPlan, '§H …and under-run');
ok(compareToActual(0, 5).ratio === null, '🔴 §H a ratio against a zero plan is null, not Infinity');

// ════════════════════════════════════════════════════════════════════════════════
// §I — THE MONEY WALL: withheld is null and SAYS SO, never zero (D-9)
// ════════════════════════════════════════════════════════════════════════════════
const walled = resolveConfig(null, { labourRateInSeason: 20, labourRateWinter: 22.5, blendedMixCostPerCubicYard: 151, potCostByUnitValue: { '45': 9.5 } }, false);
ok(walled.money.labourRateInSeason === null, '🔴 §I a reader without cost access gets NULL for the labour rate');
ok(walled.money.labourRateInSeason !== 0, '🔴 §I …and NOT zero — a redaction rendered as $0.00 makes every cost on the screen wrong and confident');
ok(Object.keys(walled.money.potCostByUnitValue).length === 0, '§I pot prices are withheld too');
ok(walled.money.blendedMixCostPerCubicYard === 151,
  '🔴 §I …but the MIX COST SURVIVES the wall — David\'s explicit exception, because the production manager is who would notice bark going up');
ok(!walled.moneyVisible, '§I the surface is told the wall is up so it can say so');
ok(isWithheld(walled.money.labourRateWinter), '§I isWithheld recognises the redaction');
ok(MONEY_WALLED_KEYS.length === 3 && !(MONEY_WALLED_KEYS as readonly string[]).includes('blendedMixCostPerCubicYard'),
  '🔴 §I the mix cost is NOT in the walled set — asserted, so a later tidy-up cannot quietly sweep it in');
const open = resolveConfig(null, { labourRateInSeason: 20 }, true);
ok(open.money.labourRateInSeason === 20, '§I a reader WITH cost access gets the real rate');
// ⚠️ SELF-CATCH: redaction happens in resolveConfig, not at the surface, so the walled value never
// reaches the client that may not see it. This asserts the value is gone from the OBJECT.
ok(JSON.stringify(walled.money).indexOf('22.5') === -1,
  '🔴 §I the withheld number is ABSENT FROM THE OBJECT, not merely unrendered — it never reaches the client');

// ════════════════════════════════════════════════════════════════════════════════
// §J — DATES: pure, and the batch dates on the FINISHING day
// ════════════════════════════════════════════════════════════════════════════════
ok(addMonths('2026-11-16', 7) === '2027-06-16', '§J seven months from 16 November is 16 June');
ok(addMonths('2026-01-31', 1) === '2026-02-28', '🔴 §J month-end clamps rather than overflowing into March');
ok(addWorkingDays('2026-11-20', 1) === '2026-11-23', '🔴 §J Friday + 1 working day is Monday');
ok(addWorkingDays('2026-11-16', 0) === '2026-11-16', '§J zero working days is the same day');
ok(addWorkingDays('2026-11-16', 5) === '2026-11-23', '§J five working days spans the weekend');
ok(workingDaysBetween('2026-11-16', '2026-11-23') === 5, '§J …and the inverse agrees');
ok(workingDaysBetween('2026-11-23', '2026-11-16') === -5, '§J a backwards span is negative');

// ════════════════════════════════════════════════════════════════════════════════
// §K — THE WHOLE PLAN, END TO END
// ════════════════════════════════════════════════════════════════════════════════
const OPS_WINDOW: OperationsConfig = {
  ...OPS, windowStart: '2026-11-16', windowEnd: '2027-02-12',
  seasonalStaffLastDay: '2026-11-26', coverMonthsOverride: 6,
};
const planCfg = resolveConfig(OPS_WINDOW, { blendedMixCostPerCubicYard: 151 }, true);
const lots: LotInput[] = [
  lot({ id: 'L1', name: 'Joan Lionetti', qty: 220, salesPerMonth: 9 }),
  lot({ id: 'L2', name: 'Lacey Oak', qty: 140, salesPerMonth: 6 }),
  lot({ id: 'L3', name: 'Range', size: '10/15 gallon', unitValue: 10, unitValueMax: 15, qty: 50 }),
  lot({ id: 'L4', name: 'Uncounted', qty: null }),
];
const out = planLots(lots, planCfg, {
  managerNumbers: {}, targets: { L1: 45, L2: 45, L3: 30, L4: 45 }, batchSize: 40, startDate: '2026-11-16',
});
ok(out.batches.length === 2, '§K two lots plan; the range and the uncounted one do not');
ok(out.refused.length === 2, '🔴 §K …and BOTH are refused explicitly rather than dropped silently');
ok(out.refused.some((r) => !r.refusal.ok && r.refusal.reason === 'range'), '§K the range is refused as a range');
ok(out.refused.some((r) => !r.refusal.ok && r.refusal.reason === 'never_counted'), '§K the uncounted lot is refused as uncounted');
ok(out.batches[0].split.uppotNow === 144, '§K the first batch takes its whole delta');
ok(out.batches[0].completesOn !== null && out.batches[0].completesOn! >= out.batches[0].startsOn!, '§K a batch completes on or after it starts');
ok(out.batches[0].firstSellable === addMonths(out.batches[0].completesOn!, 7),
  '🔴 §K first-sellable keys off the FINISHING date, never the start — later rather than earlier');

// ⚠️ SELF-CATCH — FOUND BY MUTANT P38, NOT BY REVIEW. The assertion above cannot fail: batch 0 is
// 144 pots, which fits in ONE working day, so `startsOn === completesOn` and start-dating gives the
// identical answer. A probe that cannot tell the two apart has proven nothing about which one is
// used (R-33). This batch spans FOUR days, so the two dates genuinely differ.
const long = planLots([lot({ id: 'LX', name: 'Big block', qty: 900, salesPerMonth: 0 })], planCfg, {
  managerNumbers: {}, targets: { LX: 45 }, batchSize: 40, startDate: '2026-11-16',
});
const lb = long.batches[0];
ok(lb.workingDays > 1, '§K the long batch genuinely spans more than one day');
ok(lb.completesOn !== lb.startsOn, '🔴 §K …so its start and finish dates DIFFER — which is what makes the next assertion able to fail');
ok(lb.firstSellable === addMonths(lb.completesOn!, 7), '🔴 §K first-sellable is seven months from the FINISH');
ok(lb.firstSellable !== addMonths(lb.startsOn!, 7), '🔴 §K …and demonstrably NOT seven months from the start');
ok(out.totals.pots === 234, '§K 144 + 90 pots');
ok(out.totals.crewHours.basis === 'guess',
  '🔴 §K the hours are a GUESS — the pot count is a fact but productive-hours-a-day is not, and the total takes the worst');
ok(out.totals.crewHours.because.includes('234'), '§K …and it says which fact it rests on');
ok(out.totals.mixCost !== null && out.totals.mixCost.basis === 'suggestion', '§K the mix cost is a suggestion — the $151 is derived, not quoted');
ok(out.totals.crewUsed === 2, '🔴 §K the window runs on TWO people — the seasonal staff leave before it opens');
ok(out.totals.crewReason.includes('seasonal'), '§K …and the screen is told why');
ok(!out.totals.overrunsWindow, '§K this plan fits its window');

// 🔴 the overrun is said BEFORE the plan is committed
// The window closes on the 16th; the second batch cannot finish before the 17th.
// ⚠️ An earlier fixture set the end to the 18th, which the plan comfortably MET — so the assertion
// passed for the wrong reason and would have gone green against a module that never checked at all.
const tight = planLots(lots, resolveConfig({ ...OPS_WINDOW, windowEnd: '2026-11-16' }, { blendedMixCostPerCubicYard: 151 }, true), {
  managerNumbers: {}, targets: { L1: 45, L2: 45 }, batchSize: 40, startDate: '2026-11-16',
});
ok(tight.totals.overrunsWindow, '🔴 §K a plan running past its window SAYS SO — before anything is committed');

// a manager typing a smaller number shrinks the plan and the pots together
const typed = planLots(lots, planCfg, {
  managerNumbers: { L1: 50 }, targets: { L1: 45, L2: 45 }, batchSize: 40, startDate: '2026-11-16',
});
ok(typed.totals.pots === 140, '§K typing 50 for the first lot gives 50 + 90');
ok(typed.totals.cascade.rungs[0].needed === 140, '🔴 §K …and the pot cascade follows the manager\'s number, not the delta');
ok(planLots([], planCfg, { managerNumbers: {}, targets: {}, batchSize: 40, startDate: '2026-11-16' }).totals.pots === 0,
  '§K an empty plan is zero pots, not a crash');
ok(planLots(lots, planCfg, { managerNumbers: {}, targets: { L1: 15 }, batchSize: 40, startDate: '2026-11-16' }).batches.length === 0,
  '🔴 §K a target SMALLER than the current size is not a plan line — a rung must go up');

console.log(`\n── production planning: ${passed} passed, ${failed} failed ──`);
if (failed > 0) { console.error(failures.map((f) => '  ✗ ' + f).join('\n')); process.exit(1); }
