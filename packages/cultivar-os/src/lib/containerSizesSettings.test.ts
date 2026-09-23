/**
 * ── Settings → Container sizes and Settings → Operations "Planting materials" (ledger #343) ──
 *
 * TWO HALVES. §A–§C probe the PURE draft logic (`containerLadderDraft.ts`) — what a new size
 * pre-fills, what is refused, what is written. §D–§G read the two SCREENS and the wiring as source:
 * a render condition cannot be asserted without a DOM (tech-debt #134), and the claims that matter
 * are structural — no delete path exists, the copied note is shown, the planting group uses plain
 * labels, the route and nav node exist. Stated so nobody reads §D–§G as proof the screen LOOKS
 * right; that is the owner-test cards' job.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/containerSizesSettings.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CALIPER_STANDARD, type Ladder, type Rung } from '@trace/shared/inventory';
import {
  OPERATIONS_DEFAULTS, OPERATIONS_BASIS, PLANTING_MATERIAL_KEYS, PLANTING_MATERIAL_LABELS, plantingMaterialProblems,
  resolveConfig,
} from '@trace/shared/production';
import {
  CALIPER_NOT_SET, COPIED_POSTS_NOTE, INSTALL_PRICE_NOT_SET, GROW_NOT_SET, HOLD_NOT_SET,
  SELLABILITY_NOT_SET, SELLABILITY_OPTIONS, draftForNewRung, draftFromRung, draftToRow, nextSortOrder, rungDraftProblems,
} from './containerLadderDraft';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

const rung = (label: string, sortOrder: number, posts: number, extra: Partial<Rung> = {}): Rung => ({
  label, aliases: [], sortOrder, volumeGallons: null, handlingMinutes: null,
  handlingBecause: 'not timed', installTPostsPerTree: posts, installTPostsBecause: 'LAWNS, David 2026-09-12', caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set',
  installPrice: null, installPriceBecause: 'not set',
  growMonths: null, growBecause: 'not set', holdMonths: null, holdBecause: 'not set',
  sellability: 'sold' as const, sellabilityBecause: 'not set',
  active: true, ...extra,
});
const LAWNS: Ladder = [
  rung('3/5 gal', 30, 0, { aliases: ['#3/5', '3/5 Gallon'], volumeGallons: 4 }),
  rung('15 gal', 40, 2, { volumeGallons: 15 }),
  rung('95/100', 80, 4, { aliases: ['95 gal', '100 gal'], volumeGallons: 95 }),
  rung('200 gal', 90, 4, { volumeGallons: 200 }),
];

// ══ §A A NEW SIZE COPIES ITS POSTS AND SAYS SO ═════════════════════════════════════
{
  const d = draftForNewRung(LAWNS);
  ok(d.installTPostsPerTree === '4' && d.postsCopiedFrom === '200 gal',
    '🔴 A1: a NEW size pre-fills its T-posts from the LARGEST existing size (200 gal → 4)');
  ok(d.installTPostsBecause.startsWith(COPIED_POSTS_NOTE) && COPIED_POSTS_NOTE === 'copied — confirm',
    '🔴 A2: …and says "copied — confirm" until it is saved');
  const retiredTop = draftForNewRung([...LAWNS, rung('300 gal', 95, 7, { active: false })]);
  ok(retiredTop.postsCopiedFrom === '200 gal' && retiredTop.installTPostsPerTree === '4',
    'A3: a RETIRED top size is not the copy source — only offered sizes are');
  const none = draftForNewRung([]);
  ok(none.installTPostsPerTree === '0' && none.postsCopiedFrom === null && !none.installTPostsBecause.startsWith(COPIED_POSTS_NOTE),
    'A4: with no sizes at all there is nothing to copy — 0, and it does not claim to be a copy');

  // A5 — 🔴 SAVING IS THE CONFIRMATION: the stored reason names the copy, not a pending question.
  const saved = draftToRow({ ...d, label: '300 gal', volumeGallons: '300' });
  ok(saved.install_t_posts_per_tree === 4 && saved.install_t_posts_because === 'copied from 200 gal when this size was added',
    `🔴 A5: the saved reason records WHAT happened, never "confirm" (got "${saved.install_t_posts_because}")`);
  ok(!/confirm/.test(saved.install_t_posts_because), 'A5b (negative): a saved row never still asks for confirmation');
  const retyped = draftToRow({ ...d, label: '300 gal', installTPostsPerTree: '6', installTPostsBecause: 'Terry, by phone', postsCopiedFrom: null });
  ok(retyped.install_t_posts_per_tree === 6 && retyped.install_t_posts_because === 'Terry, by phone',
    'A6: a person who replaced the figure and its reason is saved as they typed it');

  ok(nextSortOrder(LAWNS) === 100 && nextSortOrder([]) === 10, 'A7: a new size goes ten past the last, so one can later slot between');
}

// ══ §B WHAT IS REFUSED — before the write, in words ════════════════════════════════
{
  const good = { ...draftForNewRung(LAWNS), label: '7 gal', volumeGallons: '7', installTPostsPerTree: '2', installTPostsBecause: 'Terry', postsCopiedFrom: null };
  ok(rungDraftProblems(good, LAWNS, null).length === 0, 'B1 (negative control): a complete new size has no problems');
  ok(rungDraftProblems({ ...good, label: '  ' }, LAWNS, null).some(p => /needs a name/.test(p)), 'B2: a size needs a name');
  ok(rungDraftProblems({ ...good, label: '15 GAL' }, LAWNS, null).some(p => /already a size/.test(p)),
    '🔴 B3: a label that folds to an existing size is refused — and the sentence says sizes are never deleted');
  ok(rungDraftProblems(draftFromRung(LAWNS[1]), LAWNS, '15 gal').length === 0,
    'B3b: editing a size is not a clash with itself');
  ok(rungDraftProblems({ ...good, aliases: '100 gal' }, LAWNS, null).some(p => /already belongs to 95\/100/.test(p)),
    '🔴 B4: another name already used by a different size is refused — two sizes cannot claim one spelling');
  ok(rungDraftProblems({ ...good, volumeGallons: '0' }, LAWNS, null).some(p => /volume/.test(p)), 'B5: a 0 volume is refused ($0/null refusal)');
  ok(rungDraftProblems({ ...good, volumeGallons: '' }, LAWNS, null).length === 0, 'B5b: a BLANK volume is a real answer (a slip)');
  ok(rungDraftProblems({ ...good, installTPostsPerTree: '-1' }, LAWNS, null).some(p => /whole number/.test(p)), 'B6: negative posts are refused');
  ok(rungDraftProblems({ ...good, installTPostsPerTree: '2.5' }, LAWNS, null).some(p => /whole number/.test(p)), 'B6b: half a post is refused');
  ok(rungDraftProblems({ ...good, installTPostsPerTree: '' }, LAWNS, null).some(p => /whole number/.test(p)), 'B6c: an emptied posts box is refused, not saved as 0');
  ok(rungDraftProblems({ ...good, installTPostsBecause: ' ' }, LAWNS, null).some(p => /T-post figure came from/.test(p)),
    '🔴 B7: a post count with no source is refused — an unlabelled number cannot be saved');
  ok(rungDraftProblems({ ...good, handlingBecause: '' }, LAWNS, null).some(p => /handling time came from/.test(p)), 'B8: the handling reason is required too');
  ok(rungDraftProblems({ ...good, handlingMinutes: 'abc' }, LAWNS, null).some(p => /Handling minutes/.test(p)), 'B9: handling minutes must be a number');
  // B10 — the same alias typed twice (case and spacing aside) is written once. Different spellings
  // ("7gal", "7G") are kept: an alias list is for spellings the PARSER cannot fold, not a fold of its own.
  const row = draftToRow({ ...good, aliases: '7 gal, 7 GAL,  7  gal , 7G' });
  ok(row.aliases.length === 2 && row.aliases[0] === '7 gal' && row.aliases[1] === '7G',
    `B10: an alias repeated in another case or spacing is written once (got ${JSON.stringify(row.aliases)})`);
}

// ══ §C PLANTING MATERIALS — THE FOUR FIGURES ═══════════════════════════════════════
{
  ok(PLANTING_MATERIAL_KEYS.join(',') === 'installMixContainerVolumesPerTree,ropeFeetPerTPost,bubblersPerTree,deerFenceTPostsPerTree',
    'C1: the four planting keys, in display order');
  ok(plantingMaterialProblems(OPERATIONS_DEFAULTS).length === 0, 'C2 (negative control): the defaults are valid');
  ok(plantingMaterialProblems({ ...OPERATIONS_DEFAULTS, installMixContainerVolumesPerTree: 0 }).some(p => /more than 0/.test(p)),
    '🔴 C3: a ZERO mix ratio is refused — it would print "0 yards" on every load list');
  ok(plantingMaterialProblems({ ...OPERATIONS_DEFAULTS, bubblersPerTree: 0 }).length === 0, 'C4: 0 bubblers is a real answer');
  ok(plantingMaterialProblems({ ...OPERATIONS_DEFAULTS, ropeFeetPerTPost: -1 }).some(p => /negative/.test(p)), 'C5: negative rope is refused');
  ok(plantingMaterialProblems({ ...OPERATIONS_DEFAULTS, deerFenceTPostsPerTree: NaN }).some(p => /number/.test(p)), 'C6: a non-number is refused');
  ok(Object.values(PLANTING_MATERIAL_LABELS).every(l => !/[a-z][A-Z]/.test(l)),
    '🔴 C7: every planting label is plain words — no key name reaches the screen');
}

// ══ §D THE CONTAINER SIZES SCREEN ═════════════════════════════════════════════════
{
  const src = read('packages/cultivar-os/src/components/settings/ContainerSizesSettings.tsx');
  const w = read('packages/cultivar-os/src/lib/containerLadderWrite.ts');
  const code = strip(src) + strip(w);
  ok(/export default function ContainerSizesSettings/.test(src), 'D0: the screen was read');
  ok(!/\.delete\(/.test(code) && !/\bDELETE\b/.test(code), '🔴 D1 (negative): there is NO delete path anywhere on the screen or in its writes');
  ok(/setRungActive\(/.test(src) && /'Retire' : 'Bring back'/.test(src), '🔴 D2: retire and bring back are the only removal');
  ok(/moveRung\(businessId, ladder, r, -1\)/.test(src) && /moveRung\(businessId, ladder, r, 1\)/.test(src), 'D3: sizes can be moved up and down');
  ok(/addRung\(/.test(src) && /updateRung\(/.test(src), 'D4: sizes can be added and edited');
  ok(/COPIED_POSTS_NOTE/.test(src) && /draftForNewRung\(ladder\)/.test(src), '🔴 D5: a new size shows the copied-posts note');
  for (const f of ['draft.label', 'draft.aliases', 'draft.volumeGallons', 'draft.handlingMinutes', 'draft.handlingBecause', 'draft.installTPostsPerTree', 'draft.installTPostsBecause']) {
    ok(src.includes(f), `D6: the form edits ${f}`);
  }
  ok(/canWrite &&/.test(src) && /cannot change them|but not change them/.test(src), 'D7: a reader without the edit permission sees it read-only, told why');
  ok(/read\?\.phase === 'failed'/.test(src) && /No sizes are set up yet/.test(src) && /Loading the sizes/.test(src),
    'D8: loading, failed and empty states are all present');
  ok(/validateLadder\(/.test(src), 'D9: contradictory sizes are surfaced on the screen');
  ok(/minHeight: 48/.test(src), 'D10: touch targets are 48px');
  ok(/never an order, a plan or a cost already made/.test(src), '🔴 D11: the screen says nothing already written changes');
  ok(/\.select\('id'\)/.test(w) && /data\.length === 0/.test(w), '🔴 D12: every write counts what landed (E5)');
  ok(!/has_permission|permission:/.test(strip(w)) && !/'settings:update'/.test(strip(w)), 'D13 (negative): the write file mints and checks no permission — the policies decide');
  ok(/\[TRACE:LADDER\]/.test(w), 'D14: STD-003 instrumentation is on');
}

// ══ §E OPERATIONS → PLANTING MATERIALS ═════════════════════════════════════════════
{
  const src = read('packages/cultivar-os/src/components/settings/OperationsSettings.tsx');
  ok(/title: 'Planting materials'/.test(src) && /keys: \[\.\.\.PLANTING_MATERIAL_KEYS\]/.test(src),
    '🔴 E1: Settings → Operations has a "Planting materials" group holding the four keys');
  ok(/\.\.\.PLANTING_MATERIAL_LABELS/.test(src), 'E2: the group uses the plain labels');
  ok(/OPERATIONS_BASIS\[k\]/.test(src) && /b\.because/.test(src), 'E3: each figure shows its provenance line');
  ok(/plantingMaterialProblems\(ops\)/.test(src) && /REFUSED before write/.test(src), '🔴 E4: a bad figure is refused before the save, in words');
}

// ══ §F THE WIRING ═════════════════════════════════════════════════════════════════
{
  const settings = read('packages/cultivar-os/src/pages/Settings.tsx');
  ok(/sectionParam === 'container-sizes'/.test(settings) && /<ContainerSizesSettings/.test(settings), 'F1: /settings/container-sizes renders the screen');
  const reg = read('packages/cultivar-os/src/registry/tileRegistry.ts');
  ok(/key: 'nav_container_sizes'[^\n]*route: '\/settings\/container-sizes'[^\n]*required_permission: 'settings:read'/.test(reg),
    '🔴 F2: the Admin nav has a Container sizes node on the existing settings gate');
  ok(/nav_container_sizes/.test(read('packages/cultivar-os/src/pages/AdminIndex.tsx')), 'F3: the Admin index describes it');
  ok(/'nav_container_sizes'/.test(read('scripts/verify-universals.mjs')), 'F4: the nav cap requires it');
}

// ══ §G THE COUNT SCREEN READS THE LADDER ═══════════════════════════════════════════
{
  const src = read('packages/cultivar-os/src/pages/InventoryCount.tsx');
  ok(/loadContainerLadder\(businessId\)/.test(src), '🔴 G1: the count screen reads the ladder');
  ok((src.match(/resolveCountTarget\(\{[^}]*ladder \}\)/g) ?? []).length === 2, '🔴 G2: both count decisions are handed the ladder');
  ok(/sameSizeOnLadder\(ladder,/.test(src) && !/const sameSize = sameSizeLabel/.test(src), 'G3: the screen compares sizes on the ladder');
  ok(/activeRungs\(ladder\)/.test(src) && /rungChips/.test(src), '🔴 G4: the nursery\'s sizes are offered as chips');
  ok(/offLadderNote\(/.test(src) && /will be saved as typed/.test(src), '🔴 G5: an off-ladder size is warned about, never blocked');
}

// ══ §K CALIPER ON THE RUNG (ledger #356) ══════════════════════════════════════════
// David, 2026-09-18: caliper is the trade measure LAWNS buys and sells on. Min and max per size, and
// the height it is measured at is a per-business figure.
{
  const thirty = rung('30 gal', 50, 2, { caliperMinInches: 1.5, caliperMaxInches: 2.5, caliperBecause: 'LAWNS, David 2026-09-18' });
  const d = draftFromRung(thirty);
  ok(d.caliperMinInches === '1.5' && d.caliperMaxInches === '2.5' && d.caliperBecause === 'LAWNS, David 2026-09-18',
    'K1: an existing size opens with its caliper and its reason');
  const n = draftForNewRung([...LAWNS, thirty]);
  ok(n.caliperMinInches === '' && n.caliperMaxInches === '' && n.caliperBecause === CALIPER_NOT_SET,
    '🔴 K2: a NEW size does not copy a caliper — a new size\'s trees are not the biggest size\'s trees');
  const base = { ...draftForNewRung(LAWNS), label: '7 gal', installTPostsPerTree: '2', installTPostsBecause: 'Terry' };
  const probs = (min: string, max: string, because = 'LAWNS') => rungDraftProblems({ ...base, caliperMinInches: min, caliperMaxInches: max, caliperBecause: because }, LAWNS, null);
  ok(probs('', '').length === 0, 'K3: no caliper at all is allowed — "not recorded" is an answer');
  ok(probs('5', '').length === 0, 'K4: a min with no max is allowed — "5 in and up"');
  ok(probs('', '4').some(p => /smallest caliper too/.test(p)), '🔴 K5: a max with no min is refused, in words');
  ok(probs('3', '2').some(p => /below the smallest/.test(p)), '🔴 K6: a max below the min is refused, in words');
  ok(probs('0', '').some(p => /smallest caliper must be/.test(p)) && probs('abc', '').some(p => /smallest caliper must be/.test(p)),
    'K7: a zero or non-number min is refused');
  ok(probs('1', '2', ' ').some(p => /caliper figures came from/.test(p)), 'K8: the caliper reason may not be blank');
  const row = draftToRow({ ...base, caliperMinInches: '5', caliperMaxInches: '', caliperBecause: 'LAWNS' });
  ok(row.caliper_min_inches === 5 && row.caliper_max_inches === null && row.caliper_because === 'LAWNS',
    '🔴 K9: "and up" saves as a min with a NULL max — never a 0 that reads as a measurement');
  const none = draftToRow({ ...base, caliperMinInches: '', caliperMaxInches: '' });
  ok(none.caliper_min_inches === null && none.caliper_max_inches === null, 'K10: not recorded saves as NULL, not 0');

  ok(OPERATIONS_DEFAULTS.caliperMeasuredAtInches === 6 && OPERATIONS_BASIS.caliperMeasuredAtInches.basis === 'suggestion',
    '🔴 K11: the measuring height defaults to 6 in AND says it is a suggestion (ANSI), not a fact about this nursery');
  ok(resolveConfig({ caliperMeasuredAtInches: 12 }, null, false).ops.caliperMeasuredAtInches === 12,
    '🔴 K12: a nursery\'s own height is read — LAWNS measures at 12');
  const screen = strip(read('packages/cultivar-os/src/components/settings/ContainerSizesSettings.tsx'));
  ok(/put\('caliperMinInches'/.test(screen) && /put\('caliperMaxInches'/.test(screen) && /put\('caliperBecause'/.test(screen),
    'K13: the size editor has the three caliper inputs');
  ok(/caliperText\(r\)/.test(screen) && /caliper not recorded/.test(screen),
    '🔴 K14: the size list shows each caliper, and says "not recorded" rather than a blank');
  const opsScreen = strip(read('packages/cultivar-os/src/components/settings/OperationsSettings.tsx'));
  ok(/keys: \['caliperMeasuredAtInches'\]/.test(opsScreen), 'K15: Settings → Operations offers the measuring height');
}

// ══ §L THE STANDARD IS SHOWN, THE NURSERY'S OWN FIGURE IS USED (ledger #356, David 2026-09-18) ═══
{
  ok(OPERATIONS_BASIS.caliperMeasuredAtInches.because === CALIPER_STANDARD.sentence,
    '🔴 L1: the height field shows the STANDARD\'s sentence as its basis — one wording, not a second copy');
  ok(OPERATIONS_DEFAULTS.caliperMeasuredAtBecause === '',
    'L2: nobody has said why by default — an empty reason, never an invented one');
  ok(resolveConfig({ caliperMeasuredAtInches: 12, caliperMeasuredAtBecause: 'we measure everything at 12' }, null, false)
       .ops.caliperMeasuredAtBecause === 'we measure everything at 12',
    '🔴 L3: a nursery\'s own words are read back — the departure is RECORDED, not corrected');
  const sizes = strip(read('packages/cultivar-os/src/components/settings/ContainerSizesSettings.tsx'));
  ok(/standardCaliperHeightInches\(r\)/.test(sizes) && /would measure it at/.test(sizes),
    '🔴 L4: each size shows what the standard would measure it at, for reference');
  const opsScreen = strip(read('packages/cultivar-os/src/components/settings/OperationsSettings.tsx'));
  ok(/caliperMeasuredAtBecause/.test(opsScreen) && /CALIPER_STANDARD\.sentence/.test(opsScreen),
    '🔴 L5: Operations carries the height, the standard\'s sentence, and a box for the nursery\'s own words');
  const mig = read('supabase/migrations/20260918c_container_ladder_caliper.sql');
  ok(/caliperMeasuredAtBecause/.test(mig) && /not corrected/.test(mig),
    '🔴 L6: the migration records WHY LAWNS measures at 12, in their own words');
}

// ══ §F — THE INSTALL PRICE: BLANK IS AN ANSWER, $0 IS NOT (ledger #386, ruling (c)) ═══════════
// David, 2026-09-23: *"A RUNG WITH NO PRICE: offer install and REQUIRE A TYPED AMOUNT with a
// reason — never $0, never a guess, never refused."* The editor is the OTHER end of that ruling:
// if it let a 0 be saved, every screen downstream would faithfully charge nothing and every one of
// them would be right to. Refusing it here is what makes the null path mean "nobody has said yet".
{
  const good = { ...draftForNewRung(LAWNS), label: '300 gal', volumeGallons: '300' };

  ok(rungDraftProblems(good, LAWNS, null).length === 0,
    'F1 (negative control): a new size with NO install price is perfectly valid — blank is the honest answer');
  ok(draftToRow(good).install_price === null,
    'F2 🔴 and it stores NULL, not 0 — the difference the whole ruling rests on');
  ok(draftToRow(good).install_price_because === INSTALL_PRICE_NOT_SET,
    'F3 …with a reason that says nobody has set it, so the screen can say WHY it is asking');

  const zero = rungDraftProblems({ ...good, installPrice: '0' }, LAWNS, null);
  ok(zero.some(p => /charge nothing/.test(p)),
    'F4 🔴 a typed 0 is REFUSED, and the message says what it would do — "would charge nothing"');
  ok(zero.some(p => /Leave it blank/.test(p)),
    'F5 …and points at the honest alternative rather than just saying no');

  ok(rungDraftProblems({ ...good, installPrice: '-50' }, LAWNS, null).some(p => /above \$0/.test(p)),
    'F6 a negative price is refused too');
  ok(rungDraftProblems({ ...good, installPrice: 'lots' }, LAWNS, null).some(p => /above \$0/.test(p)),
    'F7 and so is a word');
  ok(rungDraftProblems({ ...good, installPrice: '450', installPriceBecause: '  ' }, LAWNS, null)
      .some(p => /where the install price came from/.test(p)),
    'F8 🔴 a price with no reason is refused — the same rule every other figure on the rung obeys');

  const priced = draftToRow({ ...good, installPrice: '450', installPriceBecause: "Lauren's sheet" });
  ok(priced.install_price === 450 && priced.install_price_because === "Lauren's sheet",
    'F9 a real price round-trips with its reason');

  // A rung read back out of the database and straight into the editor must not lose the price.
  const roundTrip = draftFromRung({ ...LAWNS[3], installPrice: 204, installPriceBecause: 'billed median' });
  ok(roundTrip.installPrice === '204' && draftToRow({ ...roundTrip, label: LAWNS[3].label }).install_price === 204,
    'F10 rung → draft → row keeps the price, so opening the editor and saving changes nothing');
  const blankTrip = draftFromRung({ ...LAWNS[3], installPrice: null, installPriceBecause: 'not priced' });
  ok(blankTrip.installPrice === '' && draftToRow({ ...blankTrip, label: LAWNS[3].label }).install_price === null,
    'F11 🔴 …and an UNPRICED rung round-trips as blank, never as 0 — the direction that would charge nothing');
}

// ══ §G GROW AND HOLD ON A RUNG (ledger #390) ═══════════════════════════════════════════════════
// David, 2026-09-23: *"The other eight rungs are UNKNOWN and render as UNKNOWN. Never 7 by
// default."* At the DRAFT layer that means three things: blank must survive a round-trip as NULL,
// a typed 0 must be refused, and a new size must NOT inherit a neighbour's interval.
{
  const base = { ...draftForNewRung(LAWNS), label: '7 gal', volumeGallons: '7', installTPostsPerTree: '2', installTPostsBecause: 'Terry', postsCopiedFrom: null };

  // 🔴 A NEW SIZE STARTS UNKNOWN AND SAYS SO. Contrast the T-posts, which ARE copied from the top
  // rung: a post count travels between neighbouring sizes, an interval does not.
  // 🔴 THE LADDER THIS RUNS AGAINST MUST HAVE INTERVALS ON ITS TOP RUNG, OR THE PROBE CANNOT FAIL.
  // The first draft used the plain LAWNS fixture, whose rungs all carry null grow — so "was it
  // copied?" had nothing to copy and MUTANT 5 (make `draftForNewRung` inherit the top rung's grow)
  // SURVIVED. That is tech-debt #182: a probe that could not reach the thing it was about. This
  // ladder's top rung carries 9 and 18, so an inheriting implementation is visibly wrong.
  const WITH_INTERVALS = LAWNS.map((r, i) =>
    i === LAWNS.length - 1 ? { ...r, growMonths: 9, growBecause: 'measured', holdMonths: 18, holdBecause: 'measured' } : r);
  const fresh = draftForNewRung(WITH_INTERVALS);
  ok(fresh.growMonths === '' && fresh.growBecause === GROW_NOT_SET,
    '🔴 G1 a new size starts with NO grow figure and the "not set" reason — never copied from another rung');
  ok(fresh.holdMonths === '' && fresh.holdBecause === HOLD_NOT_SET,
    'G1 …and the same for hold');
  ok(fresh.installTPostsPerTree !== '',
    '⚠️ G1 SELF-CATCH: the T-posts ARE still copied — this probe would pass trivially if nothing were ever copied');
  ok(WITH_INTERVALS[WITH_INTERVALS.length - 1].growMonths === 9,
    '⚠️ G1 SELF-CATCH: the top rung of the ladder under test genuinely HAS a grow figure to copy');

  ok(rungDraftProblems(base, LAWNS, null).length === 0,
    'G2 (negative control): a new size with BOTH intervals blank has no problems — unknown is a legal draft');

  ok(rungDraftProblems({ ...base, growMonths: '0' }, LAWNS, null).some(p => /sellable the day it is potted/.test(p)),
    '🔴 G3 a GROW of 0 is refused, and the sentence says why rather than "invalid"');
  ok(rungDraftProblems({ ...base, holdMonths: '0' }, LAWNS, null).some(p => /move up the day it becomes sellable/.test(p)),
    'G3 …and a HOLD of 0 likewise');
  ok(rungDraftProblems({ ...base, growMonths: '-2' }, LAWNS, null).some(p => /above 0/.test(p)),
    'G3 …and a negative is refused too');
  ok(rungDraftProblems({ ...base, growMonths: '6', growBecause: '   ' }, LAWNS, null).some(p => /where the grow figure came from/.test(p)),
    '🔴 G4 a figure with no provenance is refused — an unlabelled number cannot exist');

  // Round-trip, both directions. This is the pair that decides whether UNKNOWN survives a save.
  ok(draftToRow({ ...base, growMonths: '', holdMonths: '' }).grow_months === null,
    '🔴 G5 a BLANK grow is written as NULL, not 0 — the difference between "unknown" and "sellable immediately"');
  ok(draftToRow({ ...base, growMonths: '', holdMonths: '' }).hold_months === null, 'G5 …and blank hold likewise');
  ok(draftToRow({ ...base, growMonths: '6', growBecause: 'David 2026-09-18' }).grow_months === 6,
    'G5 …and a typed 6 is written as 6');
  const trip = draftFromRung({ ...LAWNS[1], growMonths: 6, growBecause: 'David 2026-09-18', holdMonths: null, holdBecause: 'not set' });
  ok(trip.growMonths === '6' && trip.holdMonths === '',
    '🔴 G6 rung → draft keeps a set grow as text and an unset hold as blank — opening the editor changes nothing');

  // ── SELLABILITY (ledger #391, R-178/R-179) ───────────────────────────────────────────────────
  ok(fresh.sellability === 'sold' && fresh.sellabilityBecause === SELLABILITY_NOT_SET,
    '🔴 G7 a new size is assumed SOLD, with a reason saying that is the platform\'s assumption and not the owner\'s word');
  ok(SELLABILITY_OPTIONS.length === 3 && SELLABILITY_OPTIONS.map((o) => o.value).join(',') === 'sold,rarely_sold,never_sold',
    'G7 exactly three values, in the order the picker offers them');

  // 🔴 SAYING "NEVER SOLD" TAKES THE SIZE OFF THE SELLABLE-FROM COLUMN ENTIRELY, so unlike the
  // default it may not be silent. This is the one sellability rule with teeth.
  ok(rungDraftProblems({ ...base, sellability: 'never_sold', sellabilityBecause: '  ' }, LAWNS, null)
      .some((p) => /never sold/.test(p)),
    '🔴 G8 marking a size NEVER SOLD with no reason is refused — it stops the plan ever dating that size');
  ok(rungDraftProblems({ ...base, sellability: 'never_sold', sellabilityBecause: 'production only' }, LAWNS, null).length === 0,
    'G8 …and with a reason it is accepted');
  ok(rungDraftProblems({ ...base, sellability: 'sold', sellabilityBecause: '  ' }, LAWNS, null).length === 0,
    '⚠️ G8 SELF-CATCH: a blank reason on the DEFAULT is fine — the rule bites only on the value that changes behaviour');
  ok(rungDraftProblems({ ...base, sellability: 'sometimes' }, LAWNS, null).some((p) => /sold, rarely sold, or never sold/.test(p)),
    'G9 a value outside the three is refused in the client too, not only by the database CHECK');
  ok(draftToRow({ ...base, sellability: 'never_sold', sellabilityBecause: ' production only ' }).sellability_because === 'production only',
    'G9 the reason is trimmed on the way to the row');
}

console.log(`\ncontainerSizesSettings: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
