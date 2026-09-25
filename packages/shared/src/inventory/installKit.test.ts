/**
 * ── installKit — what one install consumes, as configuration · 2026-09-25 (ledger #411) ─────────
 *
 * PROBES BOTH DIRECTIONS (STD-022). The positive half proves each of the six rules multiplies what it
 * says it multiplies. The negative half is the half that matters, because every failure here is
 * silent: an unlinked component must be REPORTED rather than skipped (skipping is how an install
 * comes to appear to cost nothing — `recipe_components` does exactly that today with 7 of 7
 * unlinked), an unsized rung must not be counted as zero mix, and an UNKNOWN deer-fence state must
 * not become "no".
 *
 * 🔴 IT DOES NOT TEST THE INSTALL ARITHMETIC — that is `loadList.ts`'s and has its own suite. What is
 * tested here is the mapping from an already-computed fact to a product and a quantity. The proof
 * that the two AGREE is a separate file: `packages/cultivar-os/src/lib/installKitEquivalence.test.ts`.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/inventory/installKit.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { evaluateKit, kitProblem, KIT_RULES, KIT_COLUMNS, KIT_SELECT,
         type KitComponent, type StopKitFacts } from './installKit';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const c = (over: Partial<KitComponent> & Pick<KitComponent, 'componentKey' | 'rule'>): KitComponent => ({
  label: over.componentKey, qbItemId: '52', factor: 1, unit: 'each',
  because: 'a probe', active: true, ...over,
});

/** LAWNS's kit as David stated it, 2026-09-12/18/25. */
const LAWNS_KIT: KitComponent[] = [
  c({ componentKey: 'special_mix', label: 'Special planting mix', qbItemId: '52', rule: 'per_container_gallon', factor: 2, unit: 'gal', because: '2 gal per container gallon' }),
  c({ componentKey: 't_post', label: 'T-post', qbItemId: '200', rule: 'per_rung', factor: null, unit: 'each', because: 'the rung says how many' }),
  c({ componentKey: 'rope', label: 'Rope', qbItemId: '201', rule: 'per_t_post', factor: 4, unit: 'ft', because: 'about 4 ft per T-post, and it stays' }),
  c({ componentKey: 'water_monitor', label: 'Water monitor kit', qbItemId: '102', rule: 'only_if_ordered', factor: 1, unit: 'each', because: 'one per installed tree, prebuilt — count only' }),
  c({ componentKey: 'bubbler', label: 'Tree bubbler', qbItemId: '121', rule: 'only_if_ordered', factor: 1, unit: 'each', because: 'only where the order has a bubbler line' }),
  c({ componentKey: 'deer_fence', label: 'Deer fence', qbItemId: '300', rule: 'only_if_marked', factor: 1, unit: 'ft', because: 'only where the stop is marked' }),
  c({ componentKey: 'trunk_protection', label: 'Trunk protection', qbItemId: '301', rule: 'only_if_marked', factor: 1, unit: 'each', because: 'only where the stop is marked' }),
];

/** Two 45 gal trees (2 posts each) on an install stop. 90 container gallons, 4 posts. */
const TWO_45: StopKitFacts = {
  trees: [{ quantity: 2, gallons: 45, tPosts: 2, rungLabel: '45 gal' }],
  bubblers: 0, waterMonitors: 2, trunkProtection: 0,
  deerFencePosts: 0, deerFence: 'no', deerFenceFeet: null, isInstall: true,
};

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A · THE SIX RULES
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const e = evaluateKit(LAWNS_KIT, TWO_45);
  const line = (k: string) => e.lines.find(l => l.componentKey === k);

  ok(line('special_mix')?.quantity === 180,
    'A1 per_container_gallon: 2 gal × 90 container gallons = 180 gal of mix for two 45s');
  ok(line('t_post')?.quantity === 4,
    'A2 per_rung: 4 T-posts, taken from the rung and NOT from a factor here');
  ok(line('rope')?.quantity === 16,
    'A3 per_t_post: 4 ft × 4 posts = 16 ft of rope');
  ok(line('water_monitor')?.quantity === 2,
    'A4 only_if_ordered: 2 water monitor kits, one per installed tree, as the load list counted them');
  ok(line('bubbler')?.quantity === 0,
    'A5 only_if_ordered: 0 bubblers is a REAL answer, not an omission — none was on the order');
  ok(line('deer_fence')?.quantity === 0 && /not marked as fenced/.test(line('deer_fence')!.because),
    'A6 only_if_marked: an unfenced stop gets 0 ft and says why');
  ok(line('trunk_protection')?.quantity === 0,
    'A7 only_if_marked: trunk protection is 0 where nothing is marked');

  ok(e.issuable && e.problem === null,
    'A8 a fully linked kit on a complete stop is issuable, with no problem to report');
  ok(e.lines.every(l => l.because.trim().length > 0),
    'A9 every line carries its arithmetic in words, so a person can check it without reading code');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B · A DELIVERY-ONLY STOP CONSUMES NOTHING
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const e = evaluateKit(LAWNS_KIT, { ...TWO_45, isInstall: false });
  ok(e.lines.length === 0, 'B1 a delivery-only stop produces NO kit lines (David, 2026-09-25)');
  ok(e.issuable && e.problem === null,
    'B2 and it is ISSUABLE — "nothing to issue" is a complete answer, not a failure');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C · UNLINKED IS REPORTED, NEVER SKIPPED
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const kit = LAWNS_KIT.map(x => x.componentKey === 'rope' ? { ...x, qbItemId: null } : x);
  const e = evaluateKit(kit, TWO_45);
  ok(e.lines.length === LAWNS_KIT.length,
    'C1 the unlinked component is still a LINE — it is not dropped from the list');
  ok(e.unlinked.length === 1 && e.unlinked[0].componentKey === 'rope',
    'C2 it is reported in `unlinked` by name');
  ok(e.lines.find(l => l.componentKey === 'rope')?.quantity === 16,
    'C3 and its QUANTITY is still computed — you know how much rope you need, you just cannot issue it');
  ok(!e.issuable && /not linked to a product/.test(e.problem ?? ''),
    'C4 the kit is NOT issuable and the sentence says why and names it');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D · THE REFUSALS THAT STOP A SHORT COUNT LOOKING LIKE A REAL ONE
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // 🔴 TWO OF LAWNS'S NINE RUNGS HAVE NO VOLUME (`slip`, `4 in`). Counting those trees as 0 gallons
  //    of mix prints a number that is quietly too small, which is the load list's own rule.
  const withUnsized: StopKitFacts = {
    ...TWO_45,
    trees: [{ quantity: 2, gallons: 45, tPosts: 2, rungLabel: '45 gal' },
            { quantity: 3, gallons: null, tPosts: 0, rungLabel: 'slip' }],
  };
  const e = evaluateKit(LAWNS_KIT, withUnsized);
  const mix = e.lines.find(l => l.componentKey === 'special_mix')!;
  ok(mix.quantity === 180, 'D1 the sized trees still produce their 180 gal — the figure is not thrown away');
  ok(mix.incomplete && /3 tree\(s\) on slip have no volume set, so they are NOT counted/.test(mix.because),
    'D2 and the unsized trees are NAMED in the line, with their count and their rung');
  ok(!e.issuable && /could not be worked out/.test(e.problem ?? ''),
    'D3 the stop is not issuable, because issuing 180 gal as if it were the whole answer is the defect');

  // 🔴 UNKNOWN IS NOT "NO". Today `deerFence` is ALWAYS unknown on LAWNS — measured 2026-09-12.
  const unknownFence = evaluateKit(LAWNS_KIT, { ...TWO_45, deerFence: 'unknown' });
  const fence = unknownFence.lines.find(l => l.componentKey === 'deer_fence')!;
  ok(fence.quantity === null && fence.incomplete && /ask before loading/.test(fence.because),
    'D4 an UNKNOWN fence state gives null and says to ask — it does not quietly become 0 ft');
  ok(!unknownFence.issuable, 'D5 and that makes the stop not issuable, rather than issuing a guess');

  const fencedNoRing = evaluateKit(LAWNS_KIT, { ...TWO_45, deerFence: 'yes', deerFenceFeet: null });
  ok(fencedNoRing.lines.find(l => l.componentKey === 'deer_fence')?.quantity === null,
    'D6 a fenced stop whose ring length could not be worked out gives null, not 0');

  const fenced = evaluateKit(LAWNS_KIT, { ...TWO_45, deerFence: 'yes', deerFenceFeet: 38, deerFencePosts: 4 });
  ok(fenced.lines.find(l => l.componentKey === 'deer_fence')?.quantity === 38,
    'D7 a fenced stop with a ring length gets its feet');
  ok(fenced.lines.find(l => l.componentKey === 't_post')?.quantity === 8,
    'D8 the deer fence\'s extra posts are ADDED to the rung posts (4 + 4 = 8), not counted separately');
  ok(/including 4 for the deer fence/.test(fenced.lines.find(l => l.componentKey === 'rope')!.because),
    'D9 and the rope line says the fence posts are in its count');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// E · RETIRE, NEVER DELETE ([[R-133]])
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const kit = LAWNS_KIT.map(x => x.componentKey === 'bubbler' ? { ...x, active: false } : x);
  const e = evaluateKit(kit, TWO_45);
  ok(e.lines.find(l => l.componentKey === 'bubbler') === undefined,
    'E1 a retired component produces no line on a NEW install');
  ok(e.lines.length === LAWNS_KIT.length - 1, 'E2 and nothing else changes');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// F · THE KIT'S OWN COHERENCE — the checks the database also enforces
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(kitProblem(LAWNS_KIT) === null, 'F1 NEGATIVE CONTROL: LAWNS\'s real kit is coherent');

  const rungWithFactor = kitProblem([c({ componentKey: 't_post', rule: 'per_rung', factor: 2 })]);
  ok(rungWithFactor !== null && /second copy of it/.test(rungWithFactor),
    'F2 per_rung WITH a factor is refused, and the message says why: the rung\'s count is the only one');

  const missingFactor = kitProblem([c({ componentKey: 'mix', rule: 'per_container_gallon', factor: null })]);
  ok(missingFactor !== null && /needs a factor above zero/.test(missingFactor),
    'F3 a rule that needs a factor and has none is refused');

  ok(kitProblem([c({ componentKey: 'mix', rule: 'per_tree', factor: 0 })]) !== null,
    'F4 a factor of 0 is refused — a component worth nothing would silently consume nothing for ever');

  const dup = kitProblem([c({ componentKey: 'mix', rule: 'per_tree' }), c({ componentKey: 'mix', rule: 'per_tree' })]);
  ok(dup !== null && /share the key/.test(dup), 'F5 two components sharing a key are refused');

  ok(KIT_RULES.length === 6, 'F6 there are exactly six rules, matching the database CHECK');
  ok(KIT_SELECT === KIT_COLUMNS.join(', '), 'F7 the select is DERIVED from the column list (#179)');
}

console.log(`\ninstallKit: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
