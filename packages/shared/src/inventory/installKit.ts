// ============================================================
// installKit — WHAT ONE INSTALL CONSUMES, AS CONFIGURATION RATHER THAN CODE.
//
// PURPOSE:      The component list an install draws on — special mix, T-posts, rope, a water monitor
//               kit, a bubbler, deer fence, trunk protection — is hard-coded today, so adding one or
//               changing which product it comes out of is a build. This evaluates a per-business KIT
//               instead: each component is an inventory item plus one of six quantity rules.
//
// 🔴 IT DOES NOT COMPUTE THE INSTALL ARITHMETIC, AND MUST NEVER START. `loadList.ts` already derives
//    every figure here — mix per container gallon, T-posts per rung, rope per T-post, bubblers, water
//    monitors, deer-fence posts — from the container ladder plus five Operations keys, under [[R-155]]
//    and ledger #343, and its header says *"this file holds NO numbers of its own."* This module takes
//    those ALREADY-COMPUTED facts as its input (`StopKitFacts`) and answers a different question:
//    **which product does each one come out of, and how much of it.** One evaluator, one multiplier,
//    no second home for a ratio (§6 r8, STD-011).
//
// 🔴 AN UNLINKED COMPONENT IS REPORTED, NEVER SKIPPED. A component with no `qbItemId` is declared but
//    not yet pointed at a product. Dropping it quietly is how an install comes to appear to cost
//    nothing — which is exactly what `recipe_components` does today, with 7 of LAWNS's 7 unlinked and
//    a build consequently consuming nothing. D-9 / A9: absent is not empty.
//
// DEPENDENCIES: none. PURE — no db, no clock, no DOM, no env, and no numbers of its own.
// OUTPUTS:      KitRule · KitComponent · StopKitFacts · KitLine · KitEvaluation ·
//               KIT_RULES · evaluateKit · kitProblem · KIT_COLUMNS · KIT_SELECT.
//
// AC-1: no vertical noun. The rules are stated as geometry and counting — per tree, per container
//       gallon, per T-post, per rung, only if ordered, only if marked. A component's NAME is the
//       tenant's ("Special planting mix"); the vocabulary is the platform's.
// STORY: user_stories.md → *What goes on the trailer for one delivery day*
// ============================================================

/** The six rules, in David's own words (2026-09-25). The database CHECK carries the same six. */
export const KIT_RULES = [
  'per_tree',              // one per tree installed        — a water monitor kit
  'per_container_gallon',  // × the tree's container gallons — special mix, 2 gal per container gallon
  'per_t_post',            // × the number of T-posts        — rope, ~4 ft per post, and it STAYS
  'per_rung',              // the RUNG supplies the count    — T-posts, 2 up to 65 gal, 4 at 95+
  'only_if_ordered',       // only where the order has it    — a bubbler
  'only_if_marked',        // only where the stop says so    — deer fence, trunk protection
] as const;
export type KitRule = (typeof KIT_RULES)[number];

/** The columns the table owns, in one place so the select cannot drift from the migration (#179). */
export const KIT_COLUMNS = ['component_key', 'label', 'qb_item_id', 'rule', 'factor', 'unit', 'because', 'active'] as const;
export const KIT_SELECT = KIT_COLUMNS.join(', ');

export interface KitComponent {
  componentKey: string;
  label: string;
  /** The product it comes out of. NULL = declared, not linked — and that is REPORTED. */
  qbItemId: string | null;
  rule: KitRule;
  /** The multiplier. NULL only for `per_rung`, whose count lives on the rung. */
  factor: number | null;
  unit: string;
  because: string;
  active: boolean;
}

/**
 * The facts about one stop, AS THE LOAD LIST ALREADY COMPUTES THEM.
 *
 * 🔴 EVERY FIELD HERE IS AN OUTPUT OF `buildLoadList`, NOT A RE-DERIVATION. `trees[].gallons` and
 * `trees[].tPosts` come off the container ladder rung; `bubblers`, `waterMonitors`, `trunkProtection`
 * and `deerFencePosts` are the load list's own tallies. If a figure is missing there it is missing
 * here, and this module says so rather than inventing one.
 */
export interface StopKitFacts {
  /** One entry per consolidated tree row. `gallons` is null when the rung has no volume set. */
  trees: ReadonlyArray<{ quantity: number; gallons: number | null; tPosts: number; rungLabel: string }>;
  /** Bubblers SPECIFIED on this stop's order. 0 is a real answer. */
  bubblers: number;
  /** Water monitor kits the load list counted (one per installed tree, plus any billed). */
  waterMonitors: number;
  /** Trunk protection units marked on this stop. */
  trunkProtection: number;
  /** Extra posts the deer fence adds, and whether the stop is marked as fenced at all. */
  deerFencePosts: number;
  deerFence: 'yes' | 'no' | 'unknown';
  /** Feet of deer fence for the whole stop — the load list's ring circumference × trees. */
  deerFenceFeet: number | null;
  /** True when this stop's order is an INSTALL. A delivery-only stop consumes no kit at all. */
  isInstall: boolean;
}

export interface KitLine {
  componentKey: string;
  label: string;
  qbItemId: string | null;
  unit: string;
  /** How much this stop needs. NULL when it could not be worked out — never silently 0. */
  quantity: number | null;
  /** The arithmetic in words, so a person can check it without reading code. */
  because: string;
  /** True when the component has no product behind it, so nothing can be issued from stock. */
  unlinked: boolean;
  /** True when a figure the rule needs was missing (a rung with no volume, an unknown fence state). */
  incomplete: boolean;
}

export interface KitEvaluation {
  lines: KitLine[];
  /** Components that cannot be issued because they point at no product. Named, not dropped. */
  unlinked: KitLine[];
  /** Components whose quantity could not be worked out, with the reason on each. */
  incomplete: KitLine[];
  /** True when every active component produced a number and has a product behind it. */
  issuable: boolean;
  /** One sentence for a screen when it is not issuable. Null when it is. */
  problem: string | null;
}

/** Structural problems with a kit, before any stop is considered. Null when the kit is coherent. */
export function kitProblem(kit: readonly KitComponent[]): string | null {
  const seen = new Set<string>();
  for (const c of kit) {
    if (seen.has(c.componentKey)) return `Two components share the key "${c.componentKey}" — one of them will be ignored.`;
    seen.add(c.componentKey);
    if (c.rule === 'per_rung' && c.factor != null) {
      return `"${c.label}" uses per_rung but also carries a factor of ${c.factor}. The rung's own count is the only one — a factor here is a second copy of it, and the copy is what drifts.`;
    }
    if (c.rule !== 'per_rung' && !(c.factor != null && c.factor > 0)) {
      return `"${c.label}" uses ${c.rule}, which needs a factor above zero — it has ${JSON.stringify(c.factor)}.`;
    }
    if (!(KIT_RULES as readonly string[]).includes(c.rule)) {
      return `"${c.label}" has an unknown rule "${c.rule}".`;
    }
  }
  return null;
}

/**
 * What one stop's install consumes, per component.
 *
 * 🔴 A DELIVERY-ONLY STOP CONSUMES NOTHING, and that is the first thing checked. David, 2026-09-25:
 * *"A Delivery-only stop issues nothing."* It returns an empty evaluation that is `issuable`, because
 * "nothing to issue" is a complete answer, not a failure.
 */
export function evaluateKit(kit: readonly KitComponent[], facts: StopKitFacts): KitEvaluation {
  if (!facts.isInstall) {
    return { lines: [], unlinked: [], incomplete: [], issuable: true, problem: null };
  }

  const treeCount = facts.trees.reduce((n, t) => n + t.quantity, 0);
  const lines: KitLine[] = [];

  for (const c of kit) {
    if (!c.active) continue;
    const base = { componentKey: c.componentKey, label: c.label, qbItemId: c.qbItemId, unit: c.unit, unlinked: c.qbItemId == null };
    let quantity: number | null = null;
    let because = '';
    let incomplete = false;

    switch (c.rule) {
      case 'per_tree': {
        quantity = treeCount * (c.factor ?? 0);
        because = `${c.factor} ${c.unit} × ${treeCount} tree${treeCount === 1 ? '' : 's'}`;
        break;
      }
      case 'per_container_gallon': {
        // 🔴 A RUNG WITH NO VOLUME CANNOT BE MULTIPLIED, AND THE STOP IS NOT SHORT-COUNTED FOR IT.
        // Two of LAWNS's nine rungs (`slip`, `4 in`) have no volume. Treating those trees as 0
        // gallons of mix would print a number that is quietly too small — the load list's own rule.
        const sized = facts.trees.filter(t => t.gallons != null);
        const unsized = facts.trees.filter(t => t.gallons == null);
        const gallons = sized.reduce((n, t) => n + (t.gallons as number) * t.quantity, 0);
        quantity = gallons * (c.factor ?? 0);
        because = `${c.factor} ${c.unit} per container gallon × ${gallons} container gallon${gallons === 1 ? '' : 's'}`;
        if (unsized.length > 0) {
          incomplete = true;
          because += ` — and ${unsized.reduce((n, t) => n + t.quantity, 0)} tree(s) on ${unsized.map(t => t.rungLabel).join(', ')} have no volume set, so they are NOT counted`;
        }
        break;
      }
      case 'per_t_post': {
        const posts = facts.trees.reduce((n, t) => n + t.tPosts * t.quantity, 0) + facts.deerFencePosts;
        quantity = posts * (c.factor ?? 0);
        because = `${c.factor} ${c.unit} × ${posts} T-post${posts === 1 ? '' : 's'}`
          + (facts.deerFencePosts > 0 ? ` (including ${facts.deerFencePosts} for the deer fence)` : '');
        break;
      }
      case 'per_rung': {
        // The rung supplies the count; there is no factor here by construction.
        const posts = facts.trees.reduce((n, t) => n + t.tPosts * t.quantity, 0) + facts.deerFencePosts;
        quantity = posts;
        because = `${posts} from the rungs${facts.deerFencePosts > 0 ? ` plus ${facts.deerFencePosts} for the deer fence` : ''}`;
        break;
      }
      case 'only_if_ordered': {
        // The order is the only thing that can say. 0 is a real answer and is not an omission.
        const ordered = c.componentKey === 'water_monitor' ? facts.waterMonitors : facts.bubblers;
        quantity = ordered * (c.factor ?? 1);
        because = ordered === 0
          ? `none specified on this stop's order`
          : `${ordered} specified on the order × ${c.factor}`;
        break;
      }
      case 'only_if_marked': {
        if (c.componentKey === 'deer_fence') {
          if (facts.deerFence === 'unknown') {
            quantity = null; incomplete = true;
            because = `nothing stored says whether this stop is fenced — ask before loading`;
          } else if (facts.deerFence === 'no') {
            quantity = 0; because = `this stop is not marked as fenced`;
          } else if (facts.deerFenceFeet == null) {
            quantity = null; incomplete = true;
            because = `the stop is fenced, but the ring length could not be worked out (a rung with no volume)`;
          } else {
            quantity = facts.deerFenceFeet * (c.factor ?? 1);
            because = `${facts.deerFenceFeet} ft of ring × ${c.factor}`;
          }
        } else {
          quantity = facts.trunkProtection * (c.factor ?? 1);
          because = facts.trunkProtection === 0
            ? `not marked on this stop`
            : `${facts.trunkProtection} marked × ${c.factor}`;
        }
        break;
      }
    }

    lines.push({ ...base, quantity, because: `${because} — ${c.because}`, incomplete });
  }

  const unlinked = lines.filter(l => l.unlinked);
  const incomplete = lines.filter(l => l.incomplete || l.quantity == null);
  const issuable = unlinked.length === 0 && incomplete.length === 0;
  const problem = issuable ? null : [
    unlinked.length > 0
      ? `${unlinked.length} component${unlinked.length === 1 ? '' : 's'} (${unlinked.map(l => l.label).join(', ')}) ${unlinked.length === 1 ? 'is' : 'are'} not linked to a product, so nothing can come off stock for ${unlinked.length === 1 ? 'it' : 'them'}.`
      : null,
    incomplete.length > 0
      ? `${incomplete.length} component${incomplete.length === 1 ? '' : 's'} could not be worked out: ${incomplete.map(l => `${l.label} (${l.because})`).join('; ')}.`
      : null,
  ].filter(Boolean).join(' ');

  return { lines, unlinked, incomplete, issuable, problem };
}
