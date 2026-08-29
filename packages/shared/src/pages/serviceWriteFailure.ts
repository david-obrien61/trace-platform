// ============================================================
// serviceWriteFailure — PUT A REFUSED SERVICE WRITE INTO WORDS A NURSERY MANAGER CAN ACT ON
// PURPOSE:      The four write sites on Settings → Services used to discard their result and
//               mutate local state optimistically, so A REFUSED WRITE RENDERED AS A SUCCESSFUL
//               ONE until reload. This module owns ONE half of the fix — the SENTENCE. All four
//               sites share it, so they cannot drift into four different apologies.
//
// 🔴 WHAT IS DELIBERATELY *NOT* HERE: the decision "did the write land?".
//               That predicate lives AT EACH WRITE SITE, as `if (error || !hit?.length)`, and it
//               stays there for two reasons that point the same way:
//                 · A READER checking whether a mutation is safe looks at the mutation. A row
//                   count handed to a callee is a check they have to go find.
//                 · `verify-zero-row-writes` reads a window around each statement and can only
//                   see a check written there (its own limitation 3). An earlier draft passed the
//                   count into this function; the cap correctly refused to call it CHECKED, and
//                   that was the cap being right rather than being awkward.
//               So: the SITE decides IF it failed, this module decides WHAT THE OWNER IS TOLD.
//
// THE TWO FAILURE SHAPES the sentence distinguishes:
//               · an ERROR came back    → the write blew up.
//               · ZERO ROWS, NO ERROR   → PostgREST returns NO error when an UPDATE/DELETE
//                                          matches nothing, and under RLS "matched nothing" is
//                                          exactly what a REFUSAL looks like (A8 / R-12, the
//                                          pattern at DeliverySchedule.tsx:150).
// NOT SHOWN:    the Postgres message. It goes to `[TRACE:SERVICE]` where a builder reads it —
//               never to the owner, who cannot act on `violates row-level security policy`.
// DEPENDENCIES: none — pure, no React, no supabase.
// OUTPUTS:      one sentence, always non-empty.
// ============================================================

// 'delete' RETIRED 2026-08-28 with its only caller. R2 stands (no delete verb for
// service_offerings; retire-by-flag is the shape), the hard delete it apologised for is removed,
// and a sentence for an act the platform cannot perform is a claim about a capability that does
// not exist — the same class as a fake pill, arriving in the copy layer.
export type ServiceWriteAction = 'activate' | 'deactivate' | 'edit' | 'add';

// The LEAD names what the owner just tried to do, in their words — "turned on", not "updated".
const LEAD: Record<ServiceWriteAction, string> = {
  activate:   'That service was not turned on',
  deactivate: 'That service was not turned off',
  edit:       'Your changes to that service were not saved',
  add:        'That service was not added',
};

// Both endings say NOTHING CHANGED, and that clause is the point. The defect being fixed was a
// screen showing a change that had not happened; an error that leaves the owner unsure whether it
// half-happened would replace one uncertainty with another. Lauren pressed Save three times in
// 23 seconds because the screen never told her either way.
const REFUSED = 'you may not have permission to change services, or it may have been removed by someone else. Nothing changed.';
const BROKE   = 'something went wrong saving it. Nothing changed — please try again.';

/**
 * Say what did not happen, and why, in the owner's words.
 *
 * Call this ONLY once the site has established the write failed (`error || !hit?.length`).
 *
 * @param action what the owner was trying to do
 * @param error  the PostgREST error, or null/undefined when the failure was a zero-row refusal
 * @returns      the sentence to display — never empty
 */
export function serviceWriteFailure(
  action: ServiceWriteAction,
  error?: { message?: string | null } | null,
): string {
  return `${LEAD[action]} — ${error ? BROKE : REFUSED}`;
}
