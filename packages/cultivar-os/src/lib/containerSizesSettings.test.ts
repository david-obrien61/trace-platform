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
import type { Ladder, Rung } from '@trace/shared/inventory';
import {
  OPERATIONS_DEFAULTS, PLANTING_MATERIAL_KEYS, PLANTING_MATERIAL_LABELS, plantingMaterialProblems,
} from '@trace/shared/production';
import {
  COPIED_POSTS_NOTE, draftForNewRung, draftFromRung, draftToRow, nextSortOrder, rungDraftProblems,
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
  handlingBecause: 'not timed', installTPostsPerTree: posts, installTPostsBecause: 'LAWNS, David 2026-09-12',
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

console.log(`\ncontainerSizesSettings: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
