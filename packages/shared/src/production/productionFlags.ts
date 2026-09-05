// ============================================================
// productionFlags — THE SEVEN-DAY FLAG. ACCOUNTABILITY, NOT A GUESS AT A CAUSE.
//
// PURPOSE:      David, 2026-09-05 (R-88b): *"this is a flag to the owner, a task did not get
//               completed or marked complete… if the production quits or gets fired maybe the
//               button didn't get pressed until it gets figured out. just the flag if date
//               scheduled and date complete is longer than 7 days."*
//
// 🔴 TWO FLAGS, ONE THRESHOLD, OPPOSITE USES.
//   · OPEN_OVERDUE      — an open batch past its scheduled date by more than 7 days. ACTIONABLE
//                         NOW. Somebody has to go and look.
//   · COMPLETED_LATE    — a finished batch whose completion beat its schedule by more than 7 days.
//                         HISTORICAL. It feeds the estimate; nobody needs to act on it.
//
// 🔴 THE FLAG MUST NOT GUESS WHICH CAUSE IT IS, AND THIS IS THE LOAD-BEARING CLAUSE.
//   "The work ran late" and "the work was done and nobody pressed the button" look IDENTICAL from
//   the data and have OPPOSITE consequences. The second means the inventory is WRONG RIGHT NOW —
//   forty trees are physically in 45-gallon pots while the system says 30-gallon, and the pot
//   cascade is counting on pots that were freed weeks ago. So `PossibleCause` is a list the screen
//   RENDERS, never a value the code PICKS, and there is no field on `ProductionFlag` that names one
//   cause. A human says why. This is D-9 turned on our own inference: a confident wrong cause is
//   worse than an honest open question, and the two causes are equally likely from here.
//
// 🔴 WHERE THE OPEN FLAG IS SHOWN — AND WHY IT IS NOT GATED ON `isOwner`.
//   David asked for it *"on the OWNER's surface, not the production manager's"*, and the reason is
//   that the production manager may be the person who has gone. Two filed constraints bound the
//   implementation, and together they leave exactly one honest door:
//     · capA assertion 1: *"NO `isOwner` IN AN AUTHORITY POSITION. `isOwner` may be READ for
//       display… It may NOT decide what someone is allowed to do."*
//     · the build spec: no new permission string.
//   Measured live at LAWNS on 2026-09-05 (3 member rows), the strings the OWNER holds and the
//   MANAGER does not are 32, and exactly one of them DESCRIBES this capability rather than merely
//   excluding the right people: **`audit_log:read`**. A batch that was finished and never marked is
//   an accountability record, which is what an audit log is. So the open flag renders behind
//   `audit_log:read` — an existing string, honestly named for what it gates (A9: a permission gates
//   a capability), and no identity check anywhere.
//   ⚠️ AND THE HONEST LIMIT, STATED RATHER THAN LEFT TO BE DISCOVERED: this is a PRESENTATION gate,
//   not a protection. A manager can read the plan lines and could compute these flags himself. It
//   decides whose attention the flag is placed in front of, and nothing more. Claiming otherwise
//   would be a false claim about a protection, which R-82 names as worse than a missing one.
//
// 🔴 COMPLETING LATE ALLOWS BACKDATING, WITH A REASON AND AN AUTHOR. Stamping today when the work
//   finished three weeks ago makes the sellable date — and every forecast resting on it — three
//   weeks wrong. `validateCompletion` refuses a backdated completion that carries no reason.
//
// DEPENDENCIES: none. Pure; the caller passes `today` rather than this module reading a clock, so a
//               test can stand at any date and the browser and the test agree.
// OUTPUTS:      FLAG_THRESHOLD_DAYS · ProductionFlagKind · ProductionFlag · POSSIBLE_CAUSES ·
//               flagsFor · validateCompletion · CompletionInput · CompletionVerdict.
// AC-1:         generic. Nothing here knows what kind of work was scheduled.
// ============================================================

/** David's threshold, in calendar days. Both flags use it; there is one number, not two. */
export const FLAG_THRESHOLD_DAYS = 7;

export type ProductionFlagKind = 'open_overdue' | 'completed_late';

export interface ProductionFlag {
  kind: ProductionFlagKind;
  lineId: string;
  label: string;
  scheduledDate: string;
  /** Set only on `completed_late`. */
  completedDate: string | null;
  daysOver: number;
  /** The sentence shown to the reader. Names the gap; never names a cause. */
  detail: string;
}

/**
 * What an overdue batch COULD mean. The screen renders this list, in this order, as a question.
 *
 * 🔴 It is exported as data rather than folded into a sentence precisely so that no call site can
 * pick one. Rendering all of them is the honest act; rendering the "most likely" one is the defect.
 */
export const POSSIBLE_CAUSES: readonly string[] = [
  'The work ran late and has not finished.',
  'The work finished and nobody marked it complete — if so, the stock counts are wrong right now.',
  'The batch was abandoned and nobody cancelled it.',
];

interface LineForFlagging {
  id: string;
  label: string;
  scheduledDate: string | null;
  completedDate: string | null;
  status: string;
}

/** Whole calendar days from `a` to `b`. Negative when `b` precedes `a`. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Both flags for a set of lines, as at `today`.
 *
 * A line with no scheduled date produces NO flag — there is nothing to be late against, and
 * inventing a baseline would manufacture the very fact this module exists to keep honest.
 */
export function flagsFor(lines: readonly LineForFlagging[], today: string): ProductionFlag[] {
  const out: ProductionFlag[] = [];
  for (const line of lines) {
    if (!line.scheduledDate) continue;

    if (line.status === 'completed' && line.completedDate) {
      const over = daysBetween(line.scheduledDate, line.completedDate);
      if (over > FLAG_THRESHOLD_DAYS) {
        out.push({
          kind: 'completed_late', lineId: line.id, label: line.label,
          scheduledDate: line.scheduledDate, completedDate: line.completedDate, daysOver: over,
          detail: `Finished ${over} days after it was scheduled. Recorded for the estimate; nothing to do.`,
        });
      }
      continue;
    }

    if (line.status === 'completed' || line.status === 'cancelled') continue;

    const over = daysBetween(line.scheduledDate, today);
    if (over > FLAG_THRESHOLD_DAYS) {
      out.push({
        kind: 'open_overdue', lineId: line.id, label: line.label,
        scheduledDate: line.scheduledDate, completedDate: null, daysOver: over,
        detail: `Scheduled ${over} days ago and still open. This could be any of three things and the data cannot tell them apart.`,
      });
    }
  }
  return out;
}

export interface CompletionInput {
  scheduledDate: string | null;
  /** The date the work actually FINISHED. May be in the past — that is the whole point. */
  completedDate: string;
  today: string;
  qtyPlanned: number;
  qtyCompleted: number;
  reason: string | null;
}

export type CompletionVerdict =
  | { ok: true; backdated: boolean; partial: boolean; remainder: number; notice: string }
  | { ok: false; problem: 'future_date' | 'needs_reason' | 'over_planned'; detail: string };

/**
 * Can this completion be recorded, and what does it mean?
 *
 * ⚠️ A PARTIAL COMPLETION IS NOT A FAILURE. David: *"A partial day completes with the ACTUAL number;
 * the remainder rolls forward and is not a failure."* So a short count is `ok: true` with the
 * remainder named, and the copy says it rolls forward rather than implying something went wrong.
 */
export function validateCompletion(input: CompletionInput): CompletionVerdict {
  if (input.completedDate > input.today) {
    return { ok: false, problem: 'future_date', detail: 'A batch cannot be completed on a date that has not happened yet.' };
  }
  if (input.qtyCompleted > input.qtyPlanned) {
    return {
      ok: false, problem: 'over_planned',
      detail: `${input.qtyCompleted} is more than the ${input.qtyPlanned} this batch planned. Change the plan, or record the extra as its own batch.`,
    };
  }
  const backdated = input.completedDate < input.today;
  if (backdated && (input.reason == null || input.reason.trim() === '')) {
    return {
      ok: false, problem: 'needs_reason',
      detail: 'This completion is being dated in the past, which moves the sellable date and every forecast resting on it. Say why.',
    };
  }
  const remainder = input.qtyPlanned - input.qtyCompleted;
  const bits: string[] = [];
  if (backdated) bits.push(`Dated ${input.completedDate}, not today.`);
  if (remainder > 0) bits.push(`${remainder} of ${input.qtyPlanned} roll forward — this is not a failure.`);
  return {
    ok: true, backdated, partial: remainder > 0, remainder,
    notice: bits.join(' ') || `All ${input.qtyPlanned} completed.`,
  };
}
