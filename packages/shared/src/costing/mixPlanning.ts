// ============================================================
// mixPlanning — IS THERE ENOUGH MIX FOR SATURDAY? (ledger #370)
//
// PURPOSE:      The answer Lauren currently walks out to the yard to get. David, 2026-09-23: the
//               yard crew and the production manager are not keeping up with the mix, so she looks.
//               The platform already knows the demand; this puts it against what is on hand and
//               names the shortfall in words.
//
// 🔴 THIS IS MRP — MATERIAL REQUIREMENTS PLANNING — AND IT IS IMPLEMENTED AS THE STANDARD RATHER
//   THAN INVENTED. Of the three replenishment methods, the one that fits a known schedule exploded
//   through a bill of materials is MRP; reorder-point is statistical and suits independent demand,
//   and kanban needs a consumption signal at the point of use, which a pile in a yard does not give.
//     NET REQUIREMENT = GROSS REQUIREMENT − ON HAND − SCHEDULED RECEIPTS
//   · gross requirement  = the day's trees × their pot gallons × the mix rule
//   · on hand            = the mix row's quantity
//   · scheduled receipts = ZERO here, and that is a modelling choice worth stating: a build run
//                          lands in stock immediately, so nothing is ever "on order". The term is
//                          kept in the shape so that when batches gain a made-by date it has a home.
//   · planned order release = "mix N yards by <date>" — the LEAD TIME turns a quantity into a day.
//
// 🔴 SURFACE, DON'T DECIDE. Nothing here schedules, orders or writes. It returns what it knows,
//   names what it does not, and proposes a batch. Lauren and Joel decide.
//
// ⚠️⚠️ ONE NUMBER IS UNRESOLVED AND THIS MODULE REFUSES TO HIDE IT. See `MixRule` below: David's
//   2026-09-23 input reads as 1.0 × pot volume, and [[R-155]] — IMPLEMENTED and live — says 2.0 for
//   an install. Both are returned, side by side, exactly as R-155 itself requires of a change of
//   this kind. A caller that wants one number must say which rule it is using.
//
// DEPENDENCIES: ../production/productionConfig (GALLONS_PER_CUBIC_YARD, OperationsConfig) — pure.
// OUTPUTS:      mixRequirement · MixPlan · MixRule · shortfallSentence.
// AC-1:         generic. A schedule, a bill of materials and a stock figure.
// ============================================================
import { GALLONS_PER_CUBIC_YARD, type OperationsConfig } from '../production/productionConfig';

/** One tree on the day, as the schedule gives it. */
export interface PlannedTree {
  /** What the stop calls it, for naming what could not be sized. */
  label: string;
  /** The rung's volume in gallons. `null` when the rung has none, or the line had no size. */
  potGallons: number | null;
  quantity: number;
}

/**
 * 🔴 WHICH RULE DECIDES HOW MUCH MIX A POT CONSUMES — AND THE TWO DISAGREE.
 * `perPot`  — David, 2026-09-23: *"mix volume per pot = the pot's size in gallons, allowing for
 *             settle"* → `mixGallonsPerPotVolume` (1.0) ÷ (1 − mixShrinkPct).
 * `install` — [[R-155]], IMPLEMENTED: *"install mix is TWICE the container volume (30 gal → 60
 *             gal). The earlier 1.0 was Lightning's figure, not LAWNS's."*
 *             → `installMixContainerVolumesPerTree` (2.0).
 * A 30 gallon tree is 30 gallons under one and 60 under the other. **That is the difference between
 * needing a batch and not**, so it is David's ruling, not a default this module picks.
 */
export type MixRule = 'perPot' | 'install';

export interface MixLine {
  label: string;
  quantity: number;
  potGallons: number | null;
  /** Gallons of mix this line consumes under the chosen rule. Null when it could not be sized. */
  gallons: number | null;
  /** Why it could not be sized, in the reader's words. */
  refusal: string | null;
}

export interface MixPlan {
  rule: MixRule;
  lines: MixLine[];
  /** Lines that could not be sized — named, never counted as zero. */
  unsized: string[];
  /** GROSS REQUIREMENT, in cubic yards. Null when nothing on the day could be sized. */
  neededYards: number | null;
  /** The same figure under the OTHER rule, always in hand (R-155: old and new side by side). */
  neededYardsOtherRule: number | null;
  /** ON HAND, in cubic yards, as given. Null when nobody has said. */
  onHandYards: number | null;
  /** When that figure was last counted. Null = never, and the screen must say so. */
  onHandCountedAt: string | null;
  /** NET REQUIREMENT. Positive = short by this many yards. Null when either side is unknown. */
  shortfallYards: number | null;
  /** PLANNED ORDER RELEASE — the day the mix must exist, from the lead time. */
  makeByDate: string | null;
  leadTimeDays: number;
  /** True when a par level, not the schedule, is what fired the prompt. */
  firedByPar: boolean;
  /** The sentence a person reads. Never empty. */
  sentence: string;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * What a day needs, against what is on hand.
 * ⚠️ `onHandYards` of `null` is NOT zero. Zero means "we counted and there is none"; null means
 * nobody has said, and the sentence must not imply a shortfall it cannot know about.
 */
export function mixRequirement(input: {
  /** The install day. ISO 'YYYY-MM-DD'. */
  day: string;
  trees: PlannedTree[];
  ops: Pick<OperationsConfig, 'mixGallonsPerPotVolume' | 'installMixContainerVolumesPerTree'
    | 'mixShrinkPct' | 'mixLeadTimeDays' | 'trueGallonsPerCubicYard'>;
  rule?: MixRule;
  onHandYards?: number | null;
  onHandCountedAt?: string | null;
  /** A per-business minimum — the second trigger, for a quiet week. */
  parYards?: number | null;
}): MixPlan {
  const rule = input.rule ?? 'perPot';
  const gpcy = input.ops.trueGallonsPerCubicYard || GALLONS_PER_CUBIC_YARD;
  const shrink = input.ops.mixShrinkPct ?? 0;

  // 🔴 SETTLE IS `mixShrinkPct`, NOT A SECOND KEY. David ruled on 2026-09-22 that shrink is ONE key
  // for one physical fact — loose mix settles. Filling a pot reads it in the GROSSING-UP direction:
  // to end with one settled pot-volume you must start with `volume ÷ (1 − shrink)` loose.
  const settleFactor = shrink > 0 && shrink < 1 ? 1 / (1 - shrink) : 1;
  const multiple = (r: MixRule): number =>
    r === 'perPot' ? (input.ops.mixGallonsPerPotVolume ?? 1) * settleFactor
                   : (input.ops.installMixContainerVolumesPerTree ?? 2);

  const build = (r: MixRule) => {
    let gal = 0; let any = false;
    const lines: MixLine[] = input.trees.map(t => {
      if (t.potGallons == null || !(t.potGallons > 0)) {
        return { label: t.label, quantity: t.quantity, potGallons: t.potGallons, gallons: null,
          refusal: `${t.label} has no pot size, so the mix it takes cannot be worked out.` };
      }
      const g = t.potGallons * t.quantity * multiple(r);
      gal += g; any = true;
      return { label: t.label, quantity: t.quantity, potGallons: t.potGallons, gallons: g, refusal: null };
    });
    return { lines, yards: any ? round1(gal / gpcy) : null };
  };

  const chosen = build(rule);
  const other = build(rule === 'perPot' ? 'install' : 'perPot');
  const unsized = chosen.lines.filter(l => l.gallons == null).map(l => l.label);

  const onHand = input.onHandYards ?? null;
  const par = input.parYards ?? null;
  const need = chosen.yards;

  // The schedule's shortfall, then the par level as a second trigger.
  let shortfall: number | null = null;
  let firedByPar = false;
  if (need != null && onHand != null) shortfall = round1(Math.max(0, need - onHand));
  if (par != null && onHand != null) {
    const parShort = round1(Math.max(0, par - onHand));
    if (shortfall == null || parShort > shortfall) { shortfall = parShort; firedByPar = shortfall > 0 && (need == null || parShort > round1(Math.max(0, need - onHand))); }
  }

  const lead = input.ops.mixLeadTimeDays ?? 2;
  const makeBy = (() => {
    const d = new Date(input.day + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - lead);
    return d.toISOString().slice(0, 10);
  })();

  const counted = input.onHandCountedAt
    ? `counted ${input.onHandCountedAt}`
    : 'never counted';

  let sentence: string;
  if (need == null && par == null) {
    sentence = unsized.length
      ? `Nothing on ${input.day} could be sized — ${unsized.length} line${unsized.length === 1 ? '' : 's'} have no pot size, so no mix figure can be worked out.`
      : `No trees scheduled for ${input.day}, so no mix is needed for it.`;
  } else if (onHand == null) {
    sentence = `${input.day} needs about ${need ?? par} yards. Nobody has said how much mix is on hand — count it and this will tell you whether you are short.`;
  } else if ((shortfall ?? 0) <= 0) {
    sentence = `${input.day} needs about ${need ?? 0} yards. You have ${onHand} (${counted}) — enough.`;
  } else {
    sentence = firedByPar
      ? `You have ${onHand} yards (${counted}), below your ${par}-yard minimum. Mix about ${shortfall} yards${makeBy ? ` by ${makeBy}` : ''}.`
      : `${input.day} needs about ${need} yards. You have ${onHand} (${counted}). Short ${shortfall} — mix it${makeBy ? ` by ${makeBy}` : ''}.`;
  }
  if (unsized.length && need != null) {
    sentence += ` ⚠️ ${unsized.length} line${unsized.length === 1 ? '' : 's'} could not be sized and ${unsized.length === 1 ? 'is' : 'are'} NOT in that figure: ${unsized.join(', ')}.`;
  }

  return { rule, lines: chosen.lines, unsized, neededYards: need, neededYardsOtherRule: other.yards,
    onHandYards: onHand, onHandCountedAt: input.onHandCountedAt ?? null, shortfallYards: shortfall,
    makeByDate: makeBy, leadTimeDays: lead, firedByPar, sentence };
}
