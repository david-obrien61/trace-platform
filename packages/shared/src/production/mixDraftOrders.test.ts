/**
 * ── mixDraftOrders — a planned batch becomes a draft somebody confirms · 2026-09-26 (#416) ──────
 *
 * PROBES BOTH DIRECTIONS (STD-022). The negative half is the whole value: a planner that runs on every
 * screen open must not duplicate its own suggestions, must not tread on a decision a person made, must
 * not resurrect one they deleted, and must not touch a row when nothing changed.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/production/mixDraftOrders.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { planDraftWorkOrders, draftNote, type ExistingDraft } from './mixDraftOrders';
import type { PlannedBatch } from '../costing/mixSchedule';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const batch = (dueOn: string, neededFor: string, batches: number, late = false): PlannedBatch =>
  ({ dueOn, neededFor, batches, yards: batches * 2.5, alreadyLate: late });
const row = (o: Partial<ExistingDraft> & Pick<ExistingDraft, 'id' | 'scheduledFor'>): ExistingDraft =>
  ({ status: 'draft', origin: 'suggested', batches: 1, ...o });

// ── A · THE FIRST RUN CREATES ─────────────────────────────────────────────────────────────────
{
  const p = planDraftWorkOrders({ planned: [batch('2026-10-01', '2026-10-03', 2)], existing: [] });
  ok(p.actions.length === 1 && p.actions[0].kind === 'create', 'A1 nothing there yet → one create');
  const a = p.actions[0] as Extract<typeof p.actions[0], { kind: 'create' }>;
  ok(a.batches === 2 && a.dueOn === '2026-10-01' && a.neededFor === '2026-10-03',
    'A2 it carries the batch count, the due day and the day it is FOR');
  ok(/Confirm it, move it, or delete it\.$/.test(a.note),
    'A3 and the stored note ends by telling the reader it is theirs to confirm, move or delete');
  ok(/stock would fall below the minimum on 2026-10-03/.test(a.note), 'A4 the note says WHY it appeared');
  ok(/that date has already passed/.test(draftNote(batch('2026-09-20', '2026-09-22', 1, true))),
    'A5 a late batch says so in the note rather than printing an impossible date flatly');
}

// ── B · RUNNING AGAIN DOES NOT DUPLICATE, AND DOES NOT TOUCH AN UNCHANGED ROW ──────────────────
{
  const planned = [batch('2026-10-01', '2026-10-03', 2)];
  const same = planDraftWorkOrders({ planned, existing: [row({ id: 'w1', scheduledFor: '2026-10-01', batches: 2 })] });
  ok(same.actions.length === 1 && same.actions[0].kind === 'leave',
    '🔴 B1 an identical draft is LEFT — the planner runs on every screen open and must not duplicate itself');
  ok((same.actions[0] as { why: string }).why.includes('unchanged'),
    '🔴 B2 and NO WRITE at all, so opening a screen twice does not move `updated_at` and the history stays honest');

  const moved = planDraftWorkOrders({ planned: [batch('2026-10-01', '2026-10-03', 3)],
    existing: [row({ id: 'w1', scheduledFor: '2026-10-01', batches: 2 })] });
  ok(moved.actions[0].kind === 'update' && (moved.actions[0] as { batches: number; from: number }).batches === 3
     && (moved.actions[0] as { from: number }).from === 2,
    'B3 a CHANGED batch count updates in place (2 → 3) and records what it was');
}

// ── C · A PERSON'S DECISION OUTRANKS THE PLANNER ──────────────────────────────────────────────
{
  for (const status of ['planned', 'in_progress', 'done']) {
    const p = planDraftWorkOrders({ planned: [batch('2026-10-01', '2026-10-03', 3)],
      existing: [row({ id: 'w1', scheduledFor: '2026-10-01', status, batches: 1 })] });
    ok(p.actions.length === 1 && p.actions[0].kind === 'leave',
      `🔴 C1-${status} a job somebody has taken on (${status}) is LEFT ALONE — re-suggesting over it would undo their decision`);
    ok(p.notices.some(n => /Left alone/.test(n) && /3 are needed/.test(n)),
      `C2-${status} but the shortfall is SAID OUT LOUD: they took 1 batch and 3 are needed`);
  }
  const cancelled = planDraftWorkOrders({ planned: [batch('2026-10-01', '2026-10-03', 2)],
    existing: [row({ id: 'w1', scheduledFor: '2026-10-01', status: 'cancelled', batches: 2 })] });
  ok(cancelled.actions[0].kind === 'create',
    'C3 NEGATIVE CONTROL: a CANCELLED order does not block a new suggestion — cancelled is not a decision to do it');
}

// ── D · A DELETED SUGGESTION STAYS DELETED ────────────────────────────────────────────────────
{
  const p = planDraftWorkOrders({ planned: [batch('2026-10-01', '2026-10-03', 2)], existing: [],
    suppressedDays: ['2026-10-01'] });
  ok(p.actions.length === 0,
    '🔴 D1 a day somebody deleted the suggestion for gets NOTHING back — a planner that cannot be told "no" is one people turn off');
  ok(p.notices.some(n => /somebody deleted it/.test(n) && /still falls short/.test(n)),
    '🔴 D2 but the shortfall is still reported — suppressing the SUGGESTION must not suppress the FACT');
}

// ── E · A DRAFT THE PLANNER NO LONGER WANTS IS REPORTED, NOT DELETED ──────────────────────────
{
  const p = planDraftWorkOrders({ planned: [], existing: [row({ id: 'w1', scheduledFor: '2026-10-01' })] });
  ok(p.actions.length === 0, 'E1 no planned batches → no writes');
  ok(p.notices.some(n => /no longer needed/.test(n) && /left for you to delete, not removed automatically/.test(n)),
    '🔴 E2 a stale draft is REPORTED, not silently removed — a planner that deletes its own suggestions gives nobody a way to see it changed its mind');

  const kept = planDraftWorkOrders({ planned: [],
    existing: [row({ id: 'w1', scheduledFor: '2026-10-01', origin: 'person' })] });
  ok(kept.notices.length === 0,
    '🔴 E3 NEGATIVE CONTROL: a draft a PERSON created is not commented on at all — the planner has no opinion about work it did not suggest');
}

// ── F · SEVERAL DAYS AT ONCE ──────────────────────────────────────────────────────────────────
{
  const p = planDraftWorkOrders({
    planned: [batch('2026-10-01', '2026-10-03', 2), batch('2026-10-08', '2026-10-10', 1)],
    existing: [row({ id: 'w1', scheduledFor: '2026-10-01', batches: 2 })] });
  ok(p.actions.length === 2, 'F1 two planned days → two actions');
  ok(p.actions.filter(a => a.kind === 'leave').length === 1 && p.actions.filter(a => a.kind === 'create').length === 1,
    'F2 the day already drafted is left; the new day is created — each day decided on its own');
}

console.log(`\nmixDraftOrders: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
