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
  /**
   * The words this figure wears when it is NOT a count.
   *
   * 🔴 THE WORDS ARE NOT SPELLED HERE, AND THAT IS THE POINT. They come from the ONE place they
   * already live — `inventoryStates.SEEDED_NOTE`, which the checkout picker has rendered beside
   * an uncounted lot since 2026-07-22 — passed in by the caller, because `shared` must not import
   * a vertical (tech-debt #156). A second copy of one wording is the copy that drifts (STD-011).
   *
   * 🔴 REQUIRED, NEVER OPTIONAL. Optional would let a caller omit it and render a placeholder as
   * though it were a count — the exact lie this field exists to prevent — and no probe reads a
   * caller nobody wrote yet. tsc refuses instead. Null means, and may ONLY mean, that
   * `countedAt` holds a real count.
   */
  provenanceNote: string | null;
}

/** One live row that COULD be the made mix. Nothing here ranks them. */
export interface MixItemCandidate {
  itemId: string;
  itemName: string;
  /** When this row was last counted. Null = never. */
  countedAt: string | null;
  /** Same provenance words as everywhere else, from the same one place. */
  provenanceNote: string | null;
}

/**
 * Which catalogue item IS the planting mix.
 *
 * 🔴 `chosenItemId` IS TENANT CONFIG AND IT IS NULL UNTIL LAUREN NAMES ONE. It is not defaulted,
 * not inferred from the busiest candidate, and not inferred from item 174 — David has said in
 * terms that he does not know 174. A default here would be a choice made by whoever wrote this
 * line, wearing the appearance of a fact she confirmed.
 */
export interface MixItemChoice {
  chosenItemId: string | null;
  candidates: MixItemCandidate[];
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
  /** The on-hand figure AND what it is — never a bare number. Empty when nobody has said one. */
  onHandLine: string;
  /** The which-item question, unanswered until Lauren answers it. */
  mixItemLine: string;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * `2026-10-01` -> `1 October`. Parsed as UTC and formatted by hand: `toLocaleDateString` would
 * hand the answer to whatever locale the machine happens to carry, so the same plan would read
 * differently on two laptops.
 */
export function humanDay(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const mon = MONTHS[Number(m[2]) - 1];
  if (!mon) return null;
  return `${Number(m[3])} ${mon}`;
}

/**
 * Is this figure a COUNT? One predicate, read by the figure, the candidate list AND the verdict.
 *
 * 🔴 THE DEFAULT IS "NOT COUNTED", AND IT IS THE WHOLE POINT. An earlier draft of this file keyed
 * on the note alone, so a caller that passed no note — which is EVERY real caller, because
 * `fetchSeededLots` only marks a row that has an `opening_stock_seed` event and LAWNS's mix rows
 * have no ledger row of ANY kind — rendered "(all counted)" beside twelve rows nobody has ever
 * counted, and a flat "enough" over item 174's 10. Measured against the live database, not
 * reviewed: every fixture had supplied a note, so no probe was ever in the real caller's
 * population (tech-debt #182). A count is proven by a DATE, never by the absence of a note.
 */
export function isCounted(p: { countedAt: string | null; provenanceNote: string | null }): boolean {
  return !p.provenanceNote && !!p.countedAt;
}

/** The words a figure wears. Never 'counted' unless a date says so. */
export function provenanceWords(p: { countedAt: string | null; provenanceNote: string | null }): string {
  if (p.provenanceNote) return p.provenanceNote;
  return p.countedAt ? `counted ${p.countedAt}` : 'never counted';
}

/**
 * The on-hand figure and what it IS, in one place — `10 · never counted`.
 *
 * 🔴 IT IS A SUFFIX ON THE NUMBER, NOT A REPLACEMENT FOR IT, for the same reason the checkout
 * picker's label is: hiding the figure leaves Lauren walking out to look, which is the whole
 * problem; showing it bare asserts a count nobody performed. Shown AND qualified.
 */
export function onHandFigure(oh: OnHand): string {
  if (oh.yards == null) return 'not said';
  return `${oh.yards} · ${provenanceWords(oh)}`;
}

/**
 * The which-item question. It ASKS until it has been answered, and it never implies an answer.
 *
 * 🔴 THE CANDIDATE LIST IS NOT A RANKING AND CARRIES NO FIRST CHOICE. Each id wears its own
 * provenance, so a reader cannot mistake a placeholder for a count while choosing.
 */
export function mixItemQuestion(choice: MixItemChoice | null | undefined): string {
  const ask = 'Which item is your planting mix?';
  if (!choice) return `${ask} Not yet confirmed — and no candidates have been read.`;
  if (choice.chosenItemId) {
    const c = choice.candidates.find(x => x.itemId === choice.chosenItemId);
    return c
      ? `Your planting mix is ${c.itemName} (item ${c.itemId}), set in Settings.`
      : `Settings names item ${choice.chosenItemId} as your planting mix and no live row matches it — check it.`;
  }
  if (!choice.candidates.length) return `${ask} Not yet confirmed — and no candidates have been read.`;
  const notes = new Set(choice.candidates.map(provenanceWords));
  const list = notes.size === 1
    ? `${choice.candidates.map(c => c.itemId).join(', ')} (all ${[...notes][0]})`
    : choice.candidates.map(c => `${c.itemId} (${provenanceWords(c)})`).join(', ');
  return `${ask} Not yet confirmed — candidates: ${list}. Nothing here picks one.`;
}

export function mixRequirement(input: {
  day: string;
  job: MixJob;
  lines: PlannedLine[];
  ops: Pick<OperationsConfig, 'uppotMixPerPotVolume' | 'installMixContainerVolumesPerTree'
    | 'mixShrinkPct' | 'mixLeadTimeDays' | 'trueGallonsPerCubicYard'>;
  onHand?: OnHand | null;
  parYards?: number | null;
  mixItem?: MixItemChoice | null;
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
  const figure = oh ? onHandFigure(oh) : '';
  const byDay = humanDay(makeBy);
  const jobWord = job === 'uppot' ? 'uppotting' : 'the installs';

  // 🔴 A VERDICT RESTING ON AN UNCOUNTED FIGURE SAYS SO IN THE VERDICT, not in a footnote.
  // "enough" above a number nobody counted is §18's defect exactly: the line reads as settled
  // while the state underneath it is unknown, and Lauren acts on the line.
  const uncounted = !!oh && !isCounted(oh);
  const countIt = ` Count it${byDay ? ` before ${byDay}` : ''}.`;

  let sentence: string;
  if (need == null && par == null) {
    sentence = unsizedTrees.length
      ? `No mix figure for ${input.day}: ${unsizedTrees.length} tree line${unsizedTrees.length === 1 ? '' : 's'} could not be sized.`
      : `No trees scheduled for ${input.day}, so ${jobWord} needs no mix.`;
  } else if (onHandYards == null) {
    sentence = `${input.day} needs about ${need ?? par} yards for ${jobWord}. Nobody has said how much mix is on hand — count it and this will tell you whether you are short.`;
  } else if ((shortfall ?? 0) <= 0) {
    sentence = uncounted
      ? `${input.day} needs ${need ?? 0} yd for ${jobWord}. On hand: ${figure} from ${from} — enough only if that's right.${countIt}`
      : `${input.day} needs ${need ?? 0} yd for ${jobWord}. On hand: ${figure} from ${from} — enough.`;
  } else if (firedByPar) {
    sentence = `On hand: ${figure} from ${from} — below your ${par}-yard minimum. Mix about ${shortfall} yards${byDay ? ` by ${byDay}` : ''}.`;
    if (uncounted) sentence += ` That shortfall rests on a figure nobody has counted.${countIt}`;
  } else {
    sentence = `${input.day} needs ${need} yd for ${jobWord}. On hand: ${figure} from ${from}. Short ${shortfall} — mix it${byDay ? ` by ${byDay}` : ''}.`;
    if (uncounted) sentence += ` That shortfall rests on a figure nobody has counted.${countIt}`;
  }
  if (unsizedTrees.length && need != null) {
    sentence += ` ⚠️ ${unsizedTrees.length} tree line${unsizedTrees.length === 1 ? '' : 's'} could not be sized and ${unsizedTrees.length === 1 ? 'is' : 'are'} NOT in that figure: ${unsizedTrees.join(', ')}.`;
  }

  return { job, multiple, shrinkApplied: settleFactor !== 1, lines, unsizedTrees,
    nonConsumingCount: nonConsuming, neededYards: need, onHand: oh, shortfallYards: shortfall,
    makeByDate: makeBy, leadTimeDays: lead, firedByPar, sentence,
    onHandLine: oh ? `${figure} from ${from}` : '',
    mixItemLine: mixItemQuestion(input.mixItem) };
}
