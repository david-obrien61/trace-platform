// ============================================================
// rungDates — WHEN A LOT WENT INTO THE SIZE IT IS IN, AND WHAT THAT MAKES IT
//
// PURPOSE:      The ONE writer and the ONE reader for `production_rung_dates`, plus the readiness
//               arithmetic that hangs off it. David, 2026-09-23: the date is ENTERED, never derived;
//               each entry or edit ADDS A ROW; nothing is overwritten; current is the latest.
// DEPENDENCIES: a supabase-shaped client passed IN (this module holds no client of its own, so its
//               probes can reach it without a database handle — tech-debt #179's lesson).
// OUTPUTS:      RUNG_DATE_FIELDS · RUNG_DATE_SELECT · currentRungDate · readinessOf · Readiness ·
//               recordRungDate · RungDateRow.
// AC-1:         generic table, generic columns. "Potted" appears only in surface copy.
// ============================================================

/** Every column the surfaces read. The select is DERIVED from it, never typed beside it (#179). */
export const RUNG_DATE_FIELDS = [
  'id', 'inventory_id', 'entered_on', 'unit_value', 'note', 'recorded_by', 'recorded_at', 'seq',
] as const;

/** DERIVED, never typed twice. */
export const RUNG_DATE_SELECT = RUNG_DATE_FIELDS.join(', ');

export interface RungDateRow {
  id: string;
  inventory_id: string;
  entered_on: string;
  unit_value: number | string | null;
  note: string | null;
  recorded_by: string | null;
  recorded_at: string;
  seq: number | string;
}

/**
 * The CURRENT entry for a lot: the latest row.
 *
 * 🔴 `seq` IS THE TIEBREAK AND IT IS NOT OPTIONAL. `recorded_at` defaults to `now()`, which is
 * TRANSACTION time, so two corrections written in one statement carry an identical timestamp —
 * measured in the harness, ordering on the uuid instead picked the wrong row 7 times in 12.
 * Sorting here mirrors the index `(business_id, inventory_id, recorded_at DESC, seq DESC)`.
 */
export function currentRungDate(rows: readonly RungDateRow[]): RungDateRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const t = Date.parse(b.recorded_at) - Date.parse(a.recorded_at);
    if (t !== 0) return t;
    return Number(b.seq) - Number(a.seq);
  })[0];
}

/** History newest-first, for a surface that shows how a date came to be what it is. */
export function rungDateHistory(rows: readonly RungDateRow[]): RungDateRow[] {
  return [...rows].sort((a, b) => {
    const t = Date.parse(b.recorded_at) - Date.parse(a.recorded_at);
    return t !== 0 ? t : Number(b.seq) - Number(a.seq);
  });
}

export type Readiness =
  | { state: 'sellable'; since: string }
  | { state: 'growing'; sellableFrom: string }
  | { state: 'not-sold' }
  | { state: 'no-date' }
  | { state: 'no-grow'; rungLabel: string };

/**
 * When can this lot be sold?
 *
 * 🔴 FIVE ANSWERS AND THEY ARE GENUINELY DIFFERENT. A lot with no date is not a lot that is not
 * ready; a production-only rung is not a lot whose grow months are unmeasured. Collapsing any pair
 * of these into one is the defect the four-state Sellable-from column exists to avoid — and the
 * same discipline one surface over (D-9: a surface must not say one thing while the state says
 * another).
 *
 * `today` is passed IN rather than read from the clock, so the probe can put the lot either side of
 * its own sellable date without waiting.
 */
export function readinessOf(
  enteredOn: string | null,
  growMonths: number | null,
  sellability: 'sold' | 'rarely_sold' | 'never_sold',
  rungLabel: string,
  today: string,
): Readiness {
  // Checked FIRST, exactly as `growMonthsFor` does: a production size has no sellable date whether
  // or not anybody dated the block, and answering "no date" there would send somebody to type one
  // that changes nothing.
  if (sellability === 'never_sold') return { state: 'not-sold' };
  if (!enteredOn) return { state: 'no-date' };
  if (growMonths == null) return { state: 'no-grow', rungLabel };
  const from = addMonthsISO(enteredOn, growMonths);
  return from <= today ? { state: 'sellable', since: from } : { state: 'growing', sellableFrom: from };
}

/**
 * Add whole months to an ISO date, clamping to the end of a short month.
 *
 * ⚠️ NOT `new Date(y, m + n, d)`: that rolls 31 Aug + 6 months into 3 March, which would make a
 * block sellable two days into the wrong month and be invisible in every test that used the 1st.
 * `productionMath.addMonths` does the same job for batches; this is the same operation on a plain
 * date string, and the two agree by construction — same clamp, same rule.
 */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export interface RecordOutcome {
  ok: boolean;
  message: string;
}

/**
 * THE ONE WRITER. Every entry and every correction goes through here (§6 r21).
 *
 * 🔴 A WRITE THAT CHANGED NOTHING MUST NOT REPORT SUCCESS (E5 / R-12 / tech-debt #74). A PostgREST
 * INSERT refused by RLS returns NO error and an empty representation, so a staff member without
 * `inventory:update` would otherwise see "saved" and save nothing. The returned row is what is
 * checked, never the absence of an error.
 */
export async function recordRungDate(
  client: {
    from: (t: string) => {
      insert: (v: unknown) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
  },
  input: { businessId: string; inventoryId: string; enteredOn: string; unitValue: number | null; note: string | null },
): Promise<RecordOutcome> {
  const problems = rungDateProblems(input.enteredOn);
  if (problems.length) return { ok: false, message: problems.join(' ') };

  const { data, error } = await client
    .from('production_rung_dates')
    // 🔴 `recorded_by` IS DELIBERATELY ABSENT FROM THIS PAYLOAD. The column defaults to
    // `auth.uid()`, so the database stamps the real caller — and a key present with a null value
    // would OVERRIDE that default with null, which is the difference between "we know who" and
    // "nobody". Sending it would also let a client claim to be somebody else.
    .insert({
      business_id: input.businessId,
      inventory_id: input.inventoryId,
      entered_on: input.enteredOn,
      unit_value: input.unitValue,
      note: input.note?.trim() ? input.note.trim() : null,
    })
    .select('id');

  if (error) return { ok: false, message: `Not saved — ${error.message}. Nothing changed.` };
  if (!data || data.length === 0) {
    return { ok: false, message: 'Not saved: the write returned no row, which usually means permission was refused. Nothing changed.' };
  }
  return { ok: true, message: 'Recorded. The earlier entries are kept — this is the current one.' };
}

/**
 * What refuses a date before it is written.
 * ⚠️ A FUTURE DATE IS REFUSED and an ancient one is not. A block cannot have been potted tomorrow;
 * it certainly can have been potted in 2019, and LAWNS has stock older than that.
 */
export function rungDateProblems(enteredOn: string, today = new Date().toISOString().slice(0, 10)): string[] {
  const out: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(enteredOn ?? '')) { out.push('Enter the date it was potted.'); return out; }
  if (enteredOn > today) out.push('That date is in the future — a block cannot have been potted tomorrow.');
  return out;
}
