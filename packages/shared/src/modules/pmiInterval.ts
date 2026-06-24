// ============================================================
// PMI interval conversion + status — pure, testable helpers (Cultivar + Ignition)
// PURPOSE:      Turn an AI-suggested task list (human interval STRINGS) into a
//               concrete `interval_days` cadence, and compute PMI status from
//               an interval + last-service date. The seam that makes an
//               AI-suggested schedule actually produce a due date.
// DEPENDENCIES: none (pure functions over plain data — safe anywhere).
// OUTPUTS:      INTERVAL_DAYS, taskIntervalToDays, isUsageBasedInterval,
//               deriveIntervalDays, pmiStatusFrom, daysUntilDueFrom.
//
// DONOR NOTE:   interval-conversion LOGIC ported from Ignition PredictiveKey.jsx
//               (INTERVAL_DAYS map + Math.min over task intervals). The donor
//               did `INTERVAL_DAYS[interval] || 30` — fabricating a 30-day cadence
//               for any interval it could not convert (usage-based "every N miles").
//               We deliberately do NOT fabricate: a non-convertible interval does
//               not contribute to interval_days and is surfaced as a flagged task
//               (confidence-honesty — don't invent a cadence we cannot derive).
// ============================================================

/** The five time-based intervals we can convert to a day cadence (Ignition donor map). */
export const INTERVAL_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

export interface ScheduleTask {
  name: string;
  interval: string;
}

export interface IntervalDerivation {
  /** Soonest convertible task cadence in days, or null if no task converts. */
  intervalDays: number | null;
  /** Tasks whose interval could not be converted to a day cadence (usage-based / non-standard). */
  unconvertible: ScheduleTask[];
}

export type PMIStatus = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NONE';

/**
 * Convert a single human interval string to days, or null when it has no
 * day-equivalent (usage-based "every 500 miles", or a non-standard phrase).
 * Never fabricates a fallback — null means "no automatic due date".
 */
export function taskIntervalToDays(interval: string | null | undefined): number | null {
  if (!interval) return null;
  const key = interval.trim().toLowerCase();
  return INTERVAL_DAYS[key] ?? null;
}

/**
 * Usage-based intervals are tied to miles/hours/km of use, not the calendar —
 * they cannot become a day cadence honestly. Used only to label the flag reason.
 */
export function isUsageBasedInterval(interval: string | null | undefined): boolean {
  if (!interval) return false;
  return /\b(mile|miles|mi|hour|hours|hr|hrs|km|kilometer|kilometers)\b/i.test(interval);
}

/**
 * Derive interval_days from a task list: the SOONEST convertible task drives the
 * cadence (Math.min). Tasks that cannot convert do NOT contribute and are returned
 * in `unconvertible` so the UI can flag them ("usage-based — no automatic due date").
 * Returns intervalDays = null when nothing converts (honest: no auto due date).
 */
export function deriveIntervalDays(tasks: ScheduleTask[]): IntervalDerivation {
  const convertible: number[] = [];
  const unconvertible: ScheduleTask[] = [];
  for (const t of tasks) {
    const d = taskIntervalToDays(t.interval);
    if (d == null) unconvertible.push(t);
    else convertible.push(d);
  }
  return {
    intervalDays: convertible.length > 0 ? Math.min(...convertible) : null,
    unconvertible,
  };
}

/**
 * Compute PMI status from a cadence + last-service date. Mirrors the original
 * getPMIStatus thresholds (overdue past the interval; due-soon within 7 days of it).
 * NONE when either input is missing — no cadence or never serviced = no due date.
 */
export function pmiStatusFrom(
  intervalDays: number | null | undefined,
  lastServiceAt: string | null | undefined,
  now: number = Date.now(),
): PMIStatus {
  if (!intervalDays || !lastServiceAt) return 'NONE';
  const daysSince = (now - new Date(lastServiceAt).getTime()) / 86_400_000;
  if (daysSince > intervalDays) return 'OVERDUE';
  if (daysSince > intervalDays - 7) return 'DUE_SOON';
  return 'OK';
}

/** Days until the next service is due (negative = overdue), or null when no cadence/date. */
export function daysUntilDueFrom(
  intervalDays: number | null | undefined,
  lastServiceAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!intervalDays || !lastServiceAt) return null;
  const daysSince = (now - new Date(lastServiceAt).getTime()) / 86_400_000;
  return Math.ceil(intervalDays - daysSince);
}
