// ============================================================
// mixDraftOrders — TURNING A PLANNED BATCH INTO A DRAFT WORK ORDER SOMEBODY CONFIRMS.
//
// PURPOSE:      `planMixBatches` (costing/mixSchedule) says *"2 batches by 2026-10-01"*. This decides
//               what that becomes in the database: a **DRAFT** `production_work_orders` row with
//               `origin = 'suggested'`, which a person confirms, moves or deletes.
//               David, 2026-09-25: *"A draft is a suggestion: a person confirms, moves or deletes it."*
//
// 🔴 IT PLANS NOTHING AND COMPUTES NO QUANTITY. `mixSchedule` owns the arithmetic; this owns only the
//    question *"is there already a row for this, and if not what exactly do we write?"* (§6 r8).
//
// 🔴 THE HARD PART IS NOT WRITING A DRAFT — IT IS NOT WRITING THE SAME ONE TWICE, AND NOT TREADING ON
//    A PERSON. The planner runs every time a screen opens. So:
//      · an existing DRAFT for the same day is UPDATED in place, never duplicated;
//      · a draft a person has CONFIRMED (planned/in_progress/done) is LEFT ALONE — re-suggesting over
//        it would undo their decision;
//      · a draft a person DELETED stays deleted for that day: `suppressedDays` is how the caller says
//        so, because a planner that cannot be told "no" is a planner people turn off;
//      · a draft whose batch count is unchanged produces NO write at all, so opening a screen twice
//        does not touch `updated_at` and the history stays honest.
//
// DEPENDENCIES: ../costing/mixSchedule (PlannedBatch — the input). PURE: no db, no clock, no ids. It
//               returns a PLAN OF WRITES for a caller to execute, so it can be probed without a
//               database and the caller owns the one writer (§6 r21).
// OUTPUTS:      ExistingDraft · DraftAction · DraftPlan · planDraftWorkOrders · draftNote.
// AC-1: no vertical noun — a recipe, a batch, a day and a work order.
// STORY: user_stories.md → *Is there enough mix for Saturday?*
// ============================================================

import type { PlannedBatch } from '../costing/mixSchedule';

/** A `production_work_orders` row that already exists for this recipe, as much as this needs. */
export interface ExistingDraft {
  id: string;
  scheduledFor: string;
  /** `draft` · `planned` · `in_progress` · `done` · `cancelled`. */
  status: string;
  origin: string;
  /** Total batches across the order's lines — what a re-suggestion would be compared against. */
  batches: number;
}

export type DraftAction =
  | { kind: 'create'; dueOn: string; neededFor: string; batches: number; because: string; note: string }
  | { kind: 'update'; id: string; dueOn: string; batches: number; from: number; because: string; note: string }
  | { kind: 'leave'; id: string; dueOn: string; why: string };

export interface DraftPlan {
  actions: DraftAction[];
  /** One sentence per thing a person should know, for a screen. Never silent about a `leave`. */
  notices: string[];
}

/** The sentence stored on the row, so a person opening it knows why it appeared. */
export function draftNote(b: PlannedBatch): string {
  return `Suggested automatically: stock would fall below the minimum on ${b.neededFor}, so ${b.batches} `
    + `batch${b.batches === 1 ? '' : 'es'} ${b.batches === 1 ? 'is' : 'are'} needed by ${b.dueOn}`
    + (b.alreadyLate ? ' — and that date has already passed' : '')
    + '. Confirm it, move it, or delete it.';
}

/**
 * What to write for a set of planned batches, given what is already there.
 *
 * `suppressedDays` are days a person has deleted a suggestion for — nothing is re-created for them.
 * `existing` is every work order already on the recipe, whatever its status.
 */
export function planDraftWorkOrders(input: {
  planned: readonly PlannedBatch[];
  existing: readonly ExistingDraft[];
  suppressedDays?: readonly string[];
}): DraftPlan {
  const { planned, existing } = input;
  const suppressed = new Set(input.suppressedDays ?? []);
  const actions: DraftAction[] = [];
  const notices: string[] = [];

  for (const b of planned) {
    if (suppressed.has(b.dueOn)) {
      notices.push(`No suggestion for ${b.dueOn}: somebody deleted it. Stock still falls short on ${b.neededFor}.`);
      continue;
    }
    const onDay = existing.filter(e => e.scheduledFor === b.dueOn && e.status !== 'cancelled');

    // 🔴 A PERSON'S DECISION OUTRANKS THE PLANNER. Anything past `draft` was confirmed by somebody.
    const confirmed = onDay.find(e => e.status !== 'draft');
    if (confirmed) {
      actions.push({ kind: 'leave', id: confirmed.id, dueOn: b.dueOn,
        why: `already ${confirmed.status} — a person took this on, so the suggestion does not touch it` });
      if (confirmed.batches < b.batches) {
        notices.push(`${b.dueOn} is already ${confirmed.status} for ${confirmed.batches} batch(es), but `
          + `${b.batches} are needed for ${b.neededFor}. Left alone — add the difference by hand if you want it.`);
      }
      continue;
    }

    const draft = onDay.find(e => e.status === 'draft');
    if (!draft) {
      actions.push({ kind: 'create', dueOn: b.dueOn, neededFor: b.neededFor, batches: b.batches,
        because: `stock falls below the minimum on ${b.neededFor}`, note: draftNote(b) });
      continue;
    }
    // ⚠️ NO WRITE WHEN NOTHING CHANGED — otherwise opening a screen twice moves `updated_at` and the
    // history stops meaning anything.
    if (draft.batches === b.batches) {
      actions.push({ kind: 'leave', id: draft.id, dueOn: b.dueOn, why: 'unchanged — still the same batch count' });
      continue;
    }
    actions.push({ kind: 'update', id: draft.id, dueOn: b.dueOn, batches: b.batches, from: draft.batches,
      because: `the shortfall on ${b.neededFor} changed`, note: draftNote(b) });
  }

  // 🔴 A DRAFT THE PLANNER NO LONGER WANTS IS NOT DELETED HERE, AND THAT IS DELIBERATE. The plan may
  // have shrunk because somebody counted the pile, or because a delivery moved — and a planner that
  // silently removes its own suggestions gives a person no way to see that it changed its mind.
  const wantedDays = new Set(planned.map(p => p.dueOn));
  for (const e of existing) {
    if (e.status === 'draft' && e.origin === 'suggested' && !wantedDays.has(e.scheduledFor)) {
      notices.push(`The draft on ${e.scheduledFor} is no longer needed — the shortfall it was for has gone. `
        + `It is left for you to delete, not removed automatically.`);
    }
  }
  return { actions, notices };
}
