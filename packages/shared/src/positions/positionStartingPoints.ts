// ============================================================
// positionStartingPoints — SIX WAYS TO NOT START FROM NOTHING
//
// PURPOSE:      A list of 93 with nothing pre-selected is a blank form, and the whole feature
//               exists because blank forms do not get filled in. David created "Production
//               Manager", was shown 93 rows, ticked nothing, and got a document reading
//               *"Nothing has been ticked for this position yet · 0 responsibilities."* — truthful
//               and useless. That is not a rendering defect; it is the flow making it easy to
//               arrive there. So the picker OFFERS a set, and every tick and untick from there is
//               the owner's.
// DEPENDENCIES: responsibilityCatalogue.ts (the rows) · responsibilityMarks.ts (only in the test,
//               which asserts the undelegable rule below). Pure data + one resolver. No React.
// OUTPUTS:      `POSITION_STARTING_POINTS`, `startingPointIds()`.
//
// ── 🔴 OFFER THE CHOICE; NEVER INFER IT FROM THE TYPED TITLE ────────────────────────────────
// "Production Manager", "Operations Manager", "Yard Manager" and "Nursery Manager" are the same
// job, and a string match would get it right sometimes and WRONG SILENTLY. A wrong inference here
// writes a job description — a document an owner hands to a person — which is worse than an extra
// click. Nothing in this file reads the position's title, and the picker never passes it one.
//
// ── ⚠️ THE PROVENANCE OF THESE SETS, STATED PLAINLY BECAUSE IT IS NOT WHAT IT LOOKS LIKE ────
// 🔴 THE COUNTS ARE DAVID'S MEASUREMENT (34 / 27 / 9 / 8 / 10 / all). **THE MEMBERSHIP IS NOT.**
// The workbook the catalogue came from is not in this repository — nothing under `docs/discovery/`
// or anywhere else carries a per-role responsibility list — so the rows below were DERIVED here
// from the catalogue itself and TUNED until each set hit the stated count.
//
// 🔴 THEREFORE THE MATCHING COUNTS ARE NOT EVIDENCE THAT THE MEMBERSHIP MATCHES THE WORKBOOK.
// Five sets landing exactly on five stated numbers looks like corroboration and is not: the
// numbers were the target, so agreement was constructed rather than observed. Saying so is the
// whole point — R-26's thirteen instances are declarations that were false when written, and
// *"measured, not invented"* written over a derivation would have been the fourteenth.
// **These sets are a PROPOSAL. Lauren's corrections are the specification** — the same status as
// the four hand-written descriptions #240 is still waiting on.
//
// The cost of being wrong here is ONE CLICK: a starting point is adjustable by construction, it
// grants nothing, and the owner sees every row it ticked. That is why this ships as a proposal
// rather than blocking on a spreadsheet.
//
// ── 🔴 A NON-OWNER SET NEVER PRE-TICKS AN UNDELEGABLE ROW, AND THAT IS DERIVED, NOT TYPED ───
// Eleven rows are undelegable — `marksFor().delegable === false`, because they cite an
// `owner-only` string that `CATALOG_PERMISSIONS` filters out of the grantable catalog entirely
// (MON-07, PHC-08, PPL-01..04, PPL-10, SYS-03, SYS-05..07). A starting point is a SUGGESTION THE
// PLATFORM MAKES, and suggesting work the platform itself refuses to delegate is the platform
// contradicting itself.
// ⚠️ This does NOT contradict R-30 — a `none`-capability row IS tickable and several are ticked
// below, because the description says what the JOB is, not what the app covers. The distinction:
// `capability: 'none'` means nobody is blocked, the software simply cannot help; UNDELEGABLE
// means the software will actively refuse THIS person. The owner may still tick one by hand and
// the mark explains why — nothing is hidden. Only the SUGGESTION is held to the stricter bar.
// `positions.test.ts` F-block asserts it over every set, so a future edit cannot quietly break it.
// ============================================================
import { RESPONSIBILITY_CATALOGUE, type Responsibility } from './responsibilityCatalogue';

/**
 * `set` carries an explicit id list. `all` is DERIVED from what the business can see and is
 * deliberately not enumerated — a hand-typed list of all 93 would be a second copy of the
 * catalogue and would go stale the day a row is added (STD-011). `blank` ticks nothing and exists
 * so "start from nothing" is a stated choice rather than the absence of one.
 */
export type StartingPointKind = 'set' | 'all' | 'blank';

export interface PositionStartingPoint {
  readonly key: string;
  /** What the owner reads on the button. A job title they recognise, never a role name. */
  readonly label: string;
  /** One line under it. Says what the job IS, so the choice can be made without opening it. */
  readonly blurb: string;
  readonly kind: StartingPointKind;
  /** Empty for `all` and `blank`. Order is irrelevant — the picker renders in catalogue order. */
  readonly responsibilityIds: readonly string[];
}

export const POSITION_STARTING_POINTS: readonly PositionStartingPoint[] = [
  {
    key: 'production_manager',
    label: 'Production manager',
    blurb: 'Runs the yard — grows it, protects it, counts it, and directs the crew.',
    kind: 'set',
    responsibilityIds: [
      // Growing, whole. This is the half of the job the software cannot represent yet, and it is
      // ticked anyway (R-30) — it is most of what the person actually does all week.
      'GRO-01', 'GRO-02', 'GRO-03', 'GRO-04', 'GRO-05', 'GRO-06', 'GRO-07', 'GRO-08',
      // Plant health. PHC-08 (respond to a regulator) is UNDELEGABLE and deliberately absent.
      'PHC-01', 'PHC-02', 'PHC-03', 'PHC-04', 'PHC-05', 'PHC-06', 'PHC-07',
      // Stock: counts, losses, what exists, what is committed, where it is. NOT its price —
      // INV-05/INV-06 are pricing authority and sit with sales.
      'INV-01', 'INV-02', 'INV-03', 'INV-04', 'INV-07', 'INV-08', 'INV-09', 'INV-10',
      'EQP-01', 'EQP-02', 'EQP-03', 'EQP-04', 'EQP-05', 'EQP-06',
      'PPL-07',            // Direct the yard crew day to day.
      'PUR-02',            // Receive a delivery and check it against the order.
      'DEL-03', 'DEL-04',  // Assign crews, load against the day sheet. Not routing, not driving.
      'SYS-02',            // Review the schedule and what is coming.
    ],
  },
  {
    key: 'sales_manager',
    label: 'Sales manager',
    blurb: 'Owns the selling motion end to end, including price and what we promise.',
    kind: 'set',
    responsibilityIds: [
      'SEL-01', 'SEL-02', 'SEL-03', 'SEL-04', 'SEL-05', 'SEL-06', 'SEL-07', 'SEL-08',
      'SEL-09', 'SEL-10', 'SEL-11', 'SEL-12', 'SEL-13', 'SEL-14', 'SEL-15',
      'MON-01', 'MON-02', 'MON-03', 'MON-04', 'MON-05',  // Order → invoice → paid → put right.
      'MON-11',            // Review margin. Marked SENSITIVE at tick time, and that is the point.
      'INV-08', 'INV-10',  // What is committed, and what is short before a customer finds out.
      'DEL-01', 'DEL-10',  // The delivery promise and what it costs.
      'SYS-01', 'SYS-02',
    ],
  },
  {
    key: 'external_sales',
    label: 'External sales',
    blurb: 'Sells away from the lot — site visits, estimates, and following them up.',
    kind: 'set',
    responsibilityIds: [
      'SEL-02', 'SEL-03', 'SEL-04', 'SEL-07', 'SEL-09', 'SEL-10', 'SEL-11', 'SEL-12',
      'MON-01',            // The motion has to end in an order or it is not a sales job.
    ],
  },
  {
    key: 'crew_driver',
    label: 'Crew member / driver',
    blurb: 'Does the work in the yard and on the road. Records what happened.',
    kind: 'set',
    responsibilityIds: [
      'DEL-04', 'DEL-05', 'DEL-06', 'DEL-07', 'DEL-08',
      'EQP-05',            // Report a fault or damage — the person holding it is the one who sees it.
      'INV-01',            // Walk the lot and count stock.
      'GRO-06',            // Water and irrigate.
    ],
  },
  {
    key: 'bookkeeper',
    label: 'Bookkeeper',
    blurb: 'Money in, money out, and the books agreeing with the business.',
    kind: 'set',
    responsibilityIds: [
      'MON-02', 'MON-03', 'MON-04', 'MON-05', 'MON-06', 'MON-08', 'MON-10',
      'PUR-03', 'PUR-04',
      'SEL-08',            // Merge or correct duplicate customer records — an AR job in practice.
      // ⚠️ MON-07 (connect or manage the accounting system) is the row a bookkeeper most obviously
      // does and it is UNDELEGABLE, so it is not suggested. MON-09 (approve and run payroll)
      // bundles approval, which is authority; tick it by hand if that is how this business runs.
    ],
  },
  {
    key: 'owner',
    label: 'Owner',
    blurb: 'Everything. The account holder answers for all of it.',
    kind: 'all',
    responsibilityIds: [],
  },
  {
    key: 'blank',
    label: 'Start blank',
    blurb: 'Tick it yourself from the ten areas below.',
    kind: 'blank',
    responsibilityIds: [],
  },
];

/**
 * The ids a starting point actually ticks FOR THIS BUSINESS.
 *
 * 🔴 `visible` is passed in rather than read here, because which rows a business can see is
 * decided by its VERTICAL (David's ruling ①, 2026-08-31) and that resolution lives with the
 * picker. A production manager at a nursery starts from 34 rows; the same set at a business with
 * no growing ladder starts from 19, and the button says so — the count is `.length` of THIS
 * result, never a number typed beside a label (STD-011: a typed count is the copy that drifts).
 */
export function startingPointIds(
  sp: PositionStartingPoint,
  visible: readonly Responsibility[],
): string[] {
  if (sp.kind === 'blank') return [];
  if (sp.kind === 'all') return visible.map((r) => r.id);
  const seen = new Set(visible.map((r) => r.id));
  // A set id that is not visible is DROPPED, never rendered as a phantom tick. An id that is not
  // in the catalogue at all is dropped by the same filter, and the test forbids one existing.
  return sp.responsibilityIds.filter((id) => seen.has(id));
}

/** Every id any `set` starting point names. Used by the test; also the honest answer to
 *  "what does the platform suggest at all?" without walking six arrays at the call site. */
export const SUGGESTED_RESPONSIBILITY_IDS: readonly string[] = [
  ...new Set(POSITION_STARTING_POINTS.filter((s) => s.kind === 'set').flatMap((s) => s.responsibilityIds)),
];

/** Guard for the test's "every named id exists" probe, kept beside the data it checks. */
export function unknownStartingPointIds(): string[] {
  const known = new Set(RESPONSIBILITY_CATALOGUE.map((r) => r.id));
  return SUGGESTED_RESPONSIBILITY_IDS.filter((id) => !known.has(id));
}
