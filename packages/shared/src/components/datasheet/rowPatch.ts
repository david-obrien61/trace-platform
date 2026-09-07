// ============================================================
// rowPatch — MOVE LOCAL STATE ONLY AFTER THE WRITE IS PROVEN (PLATFORM — @trace/shared)
// PURPOSE:      The three editable grids all do the same thing after an inline cell edit, and until
//               2026-09-07 all three did it by REFETCHING THE WHOLE LIST — 447 rows re-read, every
//               row object replaced, every keyed cell remounted, to establish one fact: did that
//               one UPDATE land. The screen flashed and the row jumped, and the owner reported it
//               as "an inline edit reloads the page."
//
// 🔴 THE PROOF DID NOT NEED THE REFETCH, AND IT NEVER DID. `393682a` already established the
//               pattern: ask the write itself for evidence with `.select('id')`, because a
//               row-level RLS refusal comes back from PostgREST as **no error and zero rows** —
//               so `!error` is not success (A8 / R-12). With that evidence in hand the row can be
//               patched from the write's OWN response: no second read, no flash, and STRICTLY MORE
//               honesty than before, since a refused write used to repaint and then quietly snap
//               back on the reload.
//
// ⚠️ THE ORDER IS THE WHOLE POINT AND IT IS THE OPPOSITE MISTAKE FROM THE OBVIOUS ONE. Do NOT
//               "fix the flash" by moving local state first and writing afterwards — that is
//               precisely the defect `393682a` removed from four Settings write sites, where a
//               refused write read as a saved one until the next reload. Prove, then move.
//
// DEPENDENCIES: none. No supabase, no react — it takes a response shape and returns a decision.
// OUTPUTS:      `writeLanded()` — the A8 verdict. `applyRowPatch()` — the row swap, by id.
// ============================================================

/** The shape every PostgREST write returns once it is asked for evidence (`.select(...)`). */
export interface WriteEvidence {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface LandedVerdict {
  landed: boolean;
  /** The sentence to show the owner. Null when it landed. */
  message: string | null;
  /** Which of the two failure modes fired — useful in the trace, and it is NOT the same event. */
  cause: 'error' | 'refused' | null;
}

/**
 * Did this write land? Two failure modes, and they are deliberately distinguished:
 *   · `error`   — Postgres/PostgREST said no, out loud. Show its message.
 *   · `refused` — no error AND zero affected rows. RLS filtered the row out. THIS IS THE SILENT
 *                 ONE: nothing throws, nothing logs, and without the evidence check it reads as
 *                 success. It is why `.select('id')` is on the write and not decoration.
 *
 * @param refusedMessage what to tell the owner on a zero-row refusal. It must NOT say "error" —
 *        the honest sentence is that it was not saved and probably a permission, which is what
 *        the caller knows and this file does not.
 */
export function writeLanded(ev: WriteEvidence, refusedMessage: string): LandedVerdict {
  if (ev.error) return { landed: false, message: ev.error.message, cause: 'error' };
  if (!ev.data || ev.data.length === 0) return { landed: false, message: refusedMessage, cause: 'refused' };
  return { landed: true, message: null, cause: null };
}

/**
 * Replace ONE row in a list by id, merging the applied fields over it. Returns a NEW array (React
 * state) but reuses every untouched row OBJECT, which is the half that kills the flash: only the
 * edited row's identity changes, so only its cells re-render.
 *
 * ⚠️ Returns the SAME array reference when the id is not present — a patch for a row that is no
 * longer on screen (deleted in another tab, filtered by a concurrent import) must not manufacture
 * a re-render, and must certainly not append a phantom row.
 */
export function applyRowPatch<T extends { id: string }>(
  rows: T[], id: string, applied: Partial<T> | Record<string, unknown>,
): T[] {
  let hit = false;
  const out = rows.map(r => {
    if (r.id !== id) return r;
    hit = true;
    return { ...r, ...(applied as Partial<T>) };
  });
  return hit ? out : rows;
}

/**
 * The same merge across MANY rows in ONE pass — a group rename touches every size-sibling in a
 * single statement and each of them comes back with its OWN `updated_at`, so this takes a patch
 * per id rather than one patch for all of them. (Folding `applyRowPatch` N times would allocate a
 * new array per sibling; more to the point, a shared patch object would stamp one row's timestamp
 * onto its siblings — a fabricated value, which is the thing we do not do.)
 */
export function applyRowPatches<T extends { id: string }>(
  rows: T[], patches: readonly { id: string; applied: Record<string, unknown> }[],
): T[] {
  if (patches.length === 0) return rows;
  const byId = new Map(patches.map(p => [p.id, p.applied]));
  let hit = false;
  const out = rows.map(r => {
    const applied = byId.get(r.id);
    if (!applied) return r;
    hit = true;
    return { ...r, ...(applied as Partial<T>) };
  });
  return hit ? out : rows;
}
