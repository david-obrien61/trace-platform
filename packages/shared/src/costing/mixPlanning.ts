// ============================================================
// mixPlanning — IS THERE ENOUGH MIX FOR SATURDAY? (ledger #370)
//
// PURPOSE:      The answer Lauren currently walks out to the yard to get. David, 2026-09-23: the yard
//               crew and the production manager are not keeping up with the mix, so she looks. The
//               platform already knows the demand; this puts it against what is on hand and names
//               the shortfall in words.
//
// 🔴 THIS IS MRP — MATERIAL REQUIREMENTS PLANNING — IMPLEMENTED AS THE STANDARD, NOT INVENTED. Of
//   the three replenishment methods, the one that fits a known schedule exploded through a bill of
//   materials is MRP; reorder-point is statistical and suits independent demand; kanban needs a
//   consumption signal at the point of use, which a pile in a yard does not give.
//     NET REQUIREMENT = GROSS REQUIREMENT − ON HAND − SCHEDULED RECEIPTS
//   Scheduled receipts is ZERO here and that is a modelling choice worth stating: a build run lands
//   in stock immediately, so nothing is ever "on order". The term is kept in the shape so it has a
//   home when batches gain a made-by date.
//
// 🔴 TWO JOBS, TWO RULES, AND THEY ARE NOT RIVALS.
//   · INSTALL — backfilling a hole. [[R-155]], live and unchanged: *"INSTALL mix is TWICE the
//     container volume (30 gal tree → 60 gal of mix)… Err large."* **No shrink on top**: the 2.0
//     already errs large, and grossing it up again would double-count the same caution.
//   · UPPOT — filling a pot. David, 2026-09-23: *"for UPPOTTING, mix per pot = the pot's gallons,
//     and it will settle."* So 1.0 × pot volume, grossed up by `mixShrinkPct`.
//   ⚠️ **NEITHER IS A REVISION OF THE OTHER AND THERE IS NO PRICING EVENT.** An earlier version of
//   this module printed both figures side by side for an install, on a prompt that said the 1.0
//   applied to "an install or uppot". That was wrong. Install plans now report ONE figure — R-155's.
//
// 🔴 SURFACE, DON'T DECIDE. Nothing here schedules, orders or writes.
//
// DEPENDENCIES: ../production/productionConfig — pure.
// OUTPUTS:      mixRequirement · MixPlan · MixJob · PlannedLine · OnHand.
// AC-1:         generic. A schedule, a bill of materials, a stock figure.
// ============================================================
import { GALLONS_PER_CUBIC_YARD, type OperationsConfig } from '../production/productionConfig';

/** Which job the mix is for. They use different rules and answer different questions. */
export type MixJob = 'install' | 'uppot';

/**
 * One line on the day's schedule.
 * 🔴 `consumesMix` IS THE LOAD-BEARING FIELD. A Tree Bubbler and a Trunk Protection line are not
 * trees that failed to be sized — they are lines that take no mix at all. Counting them as
 * "could not be sized" cries wolf on every install day and teaches a person to ignore the warning.
 * The warning is for a TREE whose container size could not be read, and nothing else.
 */
export interface PlannedLine {
  label: string;
  quantity: number;
  /** True for a tree. False for a bubbler, trunk protection, a fee, a delivery charge. */
  consumesMix: boolean;
  /** The container's volume in gallons. Null on a tree whose size could not be read. */
  potGallons: number | null;
}

/** Where an on-hand figure came from. A number with no provenance is not an answer. */
export interface OnHand {
  yards: number | null;
  /** The catalogue item it was read from — its QuickBooks id and name. */
  itemId: string;
  itemName: string;
  /** When it was last counted. Null = never, and the sentence must say so. */
  countedAt: string | null;
}

export interface CostedLine {
  label: string;
  quantity: number;
  potGallons: number | null;
  gallons: number | null;
  /** Why a TREE line has no figure. Null on a tree that was sized, and null on a non-tree. */
  refusal: string | null;
  consumesMix: boolean;
}

export interface MixPlan {
  job: MixJob;
  /** The multiple applied, and whether shrink was grossed up — so a reader can check the working. */
  multiple: number;
  shrinkApplied: boolean;
  lines: CostedLine[];
  /** TREE lines whose container size could not be read. Non-consuming lines are NEVER in here. */
  unsizedTrees: string[];
  /** Lines that take no mix, counted so a reader can see they were considered and set aside. */
  nonConsumingCount: number;
  neededYards: number | null;
  onHand: OnHand | null;
  shortfallYards: number | null;
  makeByDate: string | null;
  leadTimeDays: number;
  firedByPar: boolean;
  sentence: string;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function mixRequirement(input: {
  day: string;
  job: MixJob;
  lines: PlannedLine[];
  ops: Pick<OperationsConfig, 'uppotMixPerPotVolume' | 'installMixContainerVolumesPerTree'
    | 'mixShrinkPct' | 'mixLeadTimeDays' | 'trueGallonsPerCubicYard'>;
  onHand?: OnHand | null;
  parYards?: number | null;
}): MixPlan {
  const { job } = input;
  const gpcy = input.ops.trueGallonsPerCubicYard || GALLONS_PER_CUBIC_YARD;
  const shrink = input.ops.mixShrinkPct ?? 0;

  // 🔴 SHRINK IS GROSSED UP FOR AN UPPOT AND NOT FOR AN INSTALL. Filling a pot must end with a full
  // settled pot, so you start with `volume ÷ (1 − shrink)`. R-155's 2.0 already errs large for a
  // hole; adding shrink would double-count the same caution.
  const settleFactor = job === 'uppot' && shrink > 0 && shrink < 1 ? 1 / (1 - shrink) : 1;
  const multiple = job === 'uppot'
    ? (input.ops.uppotMixPerPotVolume ?? 1) * settleFactor
    : (input.ops.installMixContainerVolumesPerTree ?? 2);

  let gal = 0; let anySized = false; let nonConsuming = 0;
  const lines: CostedLine[] = input.lines.map(l => {
    if (!l.consumesMix) {
      nonConsuming++;
      return { label: l.label, quantity: l.quantity, potGallons: null, gallons: null,
        refusal: null, consumesMix: false };
    }
    if (l.potGallons == null || !(l.potGallons > 0)) {
      return { label: l.label, quantity: l.quantity, potGallons: l.potGallons, gallons: null,
        refusal: `${l.label} is a tree with no container size, so the mix it takes cannot be worked out.`,
        consumesMix: true };
    }
    const g = l.potGallons * l.quantity * multiple;
    gal += g; anySized = true;
    return { label: l.label, quantity: l.quantity, potGallons: l.potGallons, gallons: g,
      refusal: null, consumesMix: true };
  });

  const unsizedTrees = lines.filter(l => l.consumesMix && l.gallons == null).map(l => l.label);
  const need = anySized ? round1(gal / gpcy) : null;
  const oh = input.onHand ?? null;
  const onHandYards = oh?.yards ?? null;
  const par = input.parYards ?? null;

  let shortfall: number | null = null;
  let firedByPar = false;
  if (need != null && onHandYards != null) shortfall = round1(Math.max(0, need - onHandYards));
  if (par != null && onHandYards != null) {
    const parShort = round1(Math.max(0, par - onHandYards));
    const schedShort = need != null ? round1(Math.max(0, need - onHandYards)) : 0;
    if (parShort > schedShort) { shortfall = parShort; firedByPar = parShort > 0; }
  }

  const lead = input.ops.mixLeadTimeDays ?? 2;
  const makeBy = (() => {
    const d = new Date(input.day + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - lead);
    return d.toISOString().slice(0, 10);
  })();

  const from = oh ? `${oh.itemName} (item ${oh.itemId})` : 'no item';
  const counted = oh ? (oh.countedAt ? `counted ${oh.countedAt}` : 'never counted') : '';
  const jobWord = job === 'uppot' ? 'uppotting' : 'the installs';

  let sentence: string;
  if (need == null && par == null) {
    sentence = unsizedTrees.length
      ? `No mix figure for ${input.day}: ${unsizedTrees.length} tree line${unsizedTrees.length === 1 ? '' : 's'} could not be sized.`
      : `No trees scheduled for ${input.day}, so ${jobWord} needs no mix.`;
  } else if (onHandYards == null) {
    sentence = `${input.day} needs about ${need ?? par} yards for ${jobWord}. Nobody has said how much mix is on hand — count it and this will tell you whether you are short.`;
  } else if ((shortfall ?? 0) <= 0) {
    sentence = `${input.day} needs about ${need ?? 0} yards for ${jobWord}. You have ${onHandYards} from ${from}, ${counted} — enough.`;
  } else if (firedByPar) {
    sentence = `You have ${onHandYards} yards from ${from}, ${counted} — below your ${par}-yard minimum. Mix about ${shortfall} yards${makeBy ? ` by ${makeBy}` : ''}.`;
  } else {
    sentence = `${input.day} needs about ${need} yards for ${jobWord}. You have ${onHandYards} from ${from}, ${counted}. Short ${shortfall} — mix it${makeBy ? ` by ${makeBy}` : ''}.`;
  }
  if (unsizedTrees.length && need != null) {
    sentence += ` ⚠️ ${unsizedTrees.length} tree line${unsizedTrees.length === 1 ? '' : 's'} could not be sized and ${unsizedTrees.length === 1 ? 'is' : 'are'} NOT in that figure: ${unsizedTrees.join(', ')}.`;
  }

  return { job, multiple, shrinkApplied: settleFactor !== 1, lines, unsizedTrees,
    nonConsumingCount: nonConsuming, neededYards: need, onHand: oh, shortfallYards: shortfall,
    makeByDate: makeBy, leadTimeDays: lead, firedByPar, sentence };
}
