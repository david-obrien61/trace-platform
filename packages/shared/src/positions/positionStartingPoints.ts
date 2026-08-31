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
// ── ⚠️ THE PROVENANCE OF THESE SETS, AND WHAT IT IS NOT ────────────────────────────────────
// 🔴 THE MEMBERSHIP IS THE 2026-08-29 RESPONSIBILITY WORKBOOK'S, RECONCILED 2026-08-31.
// It is NOT a derivation any more, and it is NOT a measurement either. The workbook says so in
// its own words: *"hand-marked by Lightning from three days of observation at LAWNS. It is a
// DRAFT drawn from watching one business, not a measurement. Reconcile against it; do not treat
// agreement with it as proof."* That sentence travels WITH the data, because a draft that loses
// its own caveat becomes a fact somewhere down the line — which is R-26's whole family.
//
// ✅ Counts: 34 / 27 / 9 / 8 / 10 / all. The workbook's arrays hit its own stated counts exactly,
// checked rather than assumed.
//
// ── 🔴 WHAT THE RECONCILIATION FOUND, BECAUSE IT IS WORTH MORE THAN THE AGREEMENT ───────────
// 75 of 88 rows agreed. **13 differed in each direction, and they are not randomly distributed.**
//
// **EVERY ONE OF MY FOUR WORST ERRORS WAS AUTHORITY I INVENTED AND THE BUSINESS DOES NOT GRANT.**
// I gave the SALES MANAGER `SEL-05` (set the discount tiers) and `SEL-15` (decide what the
// business sells and at what price); I gave the EXTERNAL REP `SEL-03` (quote outside the price
// list) and `SEL-04` (apply a discount). ✏️ That is *"configuring permissions asks a harder
// question than the one they could not answer"* — the failure this entire capability exists to
// prevent — **reproduced inside the fix for it, by reasoning about what a job title OUGHT to
// carry.** A derivation over-grants, because a plausible-sounding title absorbs whatever sounds
// adjacent.
//
// 🔴 AND THE LINE THE WORKBOOK ACTUALLY DRAWS IS SHARPER THAN "LESS AUTHORITY", which I only saw
// after a transcription slip of my own was caught by the count check (below). The sales manager
// KEEPS `SEL-03` and `SEL-04` — they quote off-list and discount within the tiers — and is denied
// `SEL-05` and `SEL-15`. **They OPERATE the pricing policy; they do not SET it.** The external
// rep is denied `SEL-03` and `SEL-04` too, so they carry no price discretion at all. Three tiers
// of pricing trust, observed rather than reasoned, and none of it derivable from a job title.
//
// ✅ **THE COUNT CHECK EARNED ITS KEEP IMMEDIATELY.** Transcribing the workbook I dropped `SEL-03`
// from the sales manager and wrote a comment asserting the workbook excluded it — **a declaration
// false at the moment it was written, R-26's exact shape, by the person who has been counting
// them.** `F11` went red on the count within seconds. A pinned count is a cheap check that cannot
// be talked out of noticing.
//
// **WHAT THE WORKBOOK ADDED WAS THE OPPOSITE SHAPE: real work with no software glamour.**
// `PPL-09` train new staff (`not_software`, and I had it in NO set at all — R-30's own headline
// example, missed by the person who wrote R-30 into this file) · `SEL-13` ask a customer for a
// review, given to the CREW because the person standing in front of the customer after the
// install is the one who asks · `INV-03` record a loss, given to the driver who sees the damage ·
// `PUR-07` allocate freight, given to whoever receives the load. **None of those are derivable
// from a title. You only get them by watching.**
//
// ✅ TWO DIFFERENCES WERE FLAGGED TO DAVID AND BOTH CAME BACK ANSWERED (2026-08-31, ledger #245),
// and the answers are recorded here because each turned a question about the CODE into a fact
// about the BUSINESS that the code had no way to reach on its own.
//
// 🔴 **`INV-01` STAYS OUT OF THE CREW, AND THE REASON REFRAMES THE WHOLE QUESTION.** I read the
// workbook withholding *walk the lot and count stock* from the crew as odd beside the
// staff-count-walk work of #238/#67 — a yard hand counting stock is precisely what that build
// exists for. David: **the crew set is DRIVERS; walking the lot to count is a YARD job.** So the
// two facts never conflicted. ✏️ **THE GAP IS A MISSING POSITION, NOT A MISSING ROW** — the
// yard-hand set is a sixth starting point and nobody has written it. Adding `INV-01` to the
// drivers would have papered over a missing position with a wrong one, which is worse than the
// blank, and it is exactly the shape a count-based check cannot see: every set would still have
// held its stated number. Filed in `MISSING_STARTING_POINTS` below.
//
// 🔴 **`MON-10` GOES INTO THE BOOKKEEPER — AND THE WORKBOOK CONFLATED TWO DOCUMENTS.** I reported
// that it landed in no set at all; David's ruling is that *no set at all* cannot be true, because
// **somebody pays vendors in every business.** The workbook was doing two jobs at once: a position
// TEMPLATE (what this job is, anywhere) and a LAWNS SNAPSHOT (who actually does it here, where the
// answer is *only the owner*). ✏️ **The row is added to the template AND the observation survives
// it** — it is on the workbook's own "Only the owner" tab with the consequence beside it, and
// nothing here erases that. A starting point is a suggestion about the JOB (R-30); who currently
// holds it at one nursery is a different fact and does not get to delete the row.
//
// ── 🔴 AN UNDELEGABLE ROW IN A NON-OWNER SET IS DECLARED, NOT BANNED ────────────────────────
// The first draft of this file BANNED it outright: eleven rows are undelegable (`marksFor().
// delegable === false`, because they cite an `owner-only` string that `CATALOG_PERMISSIONS`
// filters out of the grantable catalog entirely), and I reasoned that *a suggestion the platform
// makes must not propose work the platform will then refuse.*
//
// 🔴 THE WORKBOOK DISAGREED ON EXACTLY ONE ROW, AND THE WORKBOOK IS RIGHT. It puts `MON-07`
// (connect or manage the accounting system) in the BOOKKEEPER's set, because at LAWNS the
// bookkeeper does that job. **Both facts are true at once** — they do it, and the platform will
// not grant it to them — and [[R-30]] already decided which one the document describes: *the
// description says what the JOB is, not what the app covers.* ✏️ **Suppressing the row would
// hide a real mismatch between how the business runs and what the software permits, on the one
// screen built to surface exactly that.** And nothing is concealed by including it: the picker
// marks it **"Cannot be delegated"** with the reason, at the moment of ticking.
//
// So the rule became narrower and better founded: an undelegable row may be suggested, but it
// must be **DECLARED with a reason** — the pattern this repo already uses for
// `select-policy-declarations.json` and `r-b2-wired-since-declarations.json`. A future edit
// dropping `team:update` into "Sales manager" still fails the build; `MON-07` in "Bookkeeper"
// passes because someone wrote down why. **And the declaration asserts itself in both directions:
// a declaration for a row that has since left the set, or that is no longer undelegable, is STALE
// and FAILS** — so it cannot rot into the unread noise `OWNER_ONLY_PENDING` became (#73).
export interface UndelegableSuggestion {
  readonly setKey: string;
  readonly responsibilityId: string;
  readonly reason: string;
}

export const UNDELEGABLE_SUGGESTIONS: readonly UndelegableSuggestion[] = [
  {
    setKey: 'bookkeeper',
    responsibilityId: 'MON-07',
    reason:
      'The 2026-08-29 workbook puts it here from observation: at LAWNS the bookkeeper manages the ' +
      'QuickBooks connection. The platform reserves the permission to the account holder, so BOTH ' +
      'are true — and R-30 says the description states the job, not the app. Ticking it surfaces ' +
      'the mismatch (the owner still has to press the button); hiding it would conceal the gap on ' +
      'the one screen built to show it. The "Cannot be delegated" mark explains it at tick time.',
  },
];

// ── 🔴 THE SETS ARE A SAMPLE, AND THIS IS THE FIRST MEASUREMENT OF WHAT THE SAMPLE MISSED ───
//
// The header already says these five sets are a draft drawn from watching ONE business. What it
// could not say — until 2026-08-31 — is *which* people that sample contained. **It contained the
// people David met.** Three positions at LAWNS were not among them, and all three surfaced within
// hours of each other, which is evidence about the SETS rather than a defect in them:
//
//   · **the yard hand** — walks the lot and counts stock (`INV-01`), waters and irrigates. Found
//     by asking why the crew set withheld a row the staff-count-walk build (#238/#67) is built
//     for. The answer was that the crew are DRIVERS and this is a different job.
//   · **on-site maintenance — CUTO.** He lives on site, does the maintenance and the handy work,
//     **and does not speak English.** He is not crew and he is not the production manager, and
//     there is no set that describes him.
//   · **customer two's positions, whatever they turn out to be.** Named as unknown rather than
//     guessed at: a second business is the only thing that can distinguish *this is how nurseries
//     work* from *this is how LAWNS works*, and until one exists that distinction is unmeasured.
//
// ✏️ **A count-based check could never have found any of these.** Every set still held its stated
// number; nothing drifted; F11 was green throughout. **A missing POSITION is invisible to a probe
// that asks whether the positions we have are right** — which is the same blind spot as a gap list
// that only grows, in a different costume.
//
// ⚠️ **AND A CONSTRAINT THE NEXT BUILD MUST NOT BREAK, recorded here because here is where it
// would be broken: DO NOT ASSUME ONE LANGUAGE PER TENANT.** Cuto is the proof — one business, and
// the person reading the document does not read the language the person writing it writes. Two
// stories are being filed against this (a Spanish-language interface with the choice made **by the
// person**, on the invitation screen; and the on-site maintenance position). ✅ **Measured today,
// so the next reader does not have to: nothing in this repo assumes it.** There is no language or
// locale column on any business table, and the ONLY hardcoded locale in the positions feature is
// `positionDescription.ts`'s `toLocaleDateString('en-US', …)` — which sits at the DOCUMENT layer,
// i.e. exactly where a per-person choice will need to reach it. A tenant-level language setting
// would be the wrong shape and would have to be undone.
//
// 🔴 **THIS DECLARATION SELF-PRUNES, in the pattern `UNDELEGABLE_SUGGESTIONS` already uses.** An
// entry whose `key` has since been BUILT as a real starting point is STALE and FAILS the build
// (probe F13) — so it cannot rot into the unread noise `OWNER_ONLY_PENDING` became (#73), and
// building the yard-hand set forces whoever builds it to come back here and strike the line.
export interface MissingStartingPoint {
  /** The `key` it will take in POSITION_STARTING_POINTS when it is built. */
  readonly key: string;
  readonly label: string;
  /** What is known about the job, and how we came to know it. Never a guess dressed as a fact. */
  readonly evidence: string;
}

export const MISSING_STARTING_POINTS: readonly MissingStartingPoint[] = [
  {
    key: 'yard_hand',
    label: 'Yard hand',
    evidence:
      'RULED 2026-08-31 (ledger #245). The crew set is DRIVERS; walking the lot to count stock ' +
      '(INV-01) and watering (GRO-06) are YARD work. The workbook withheld INV-01 from the crew ' +
      'and the withholding was correct — the gap is this missing position, not a missing row. ' +
      'It is the position the staff-count-walk build (#238 / tech-debt #67) exists to serve.',
  },
  {
    key: 'onsite_maintenance',
    label: 'On-site maintenance',
    evidence:
      'REPORTED 2026-08-31 by David (ledger #245): Cuto lives on site at LAWNS, does the ' +
      'maintenance and the handy work, and does not speak English. Not crew, not the production ' +
      'manager. Two stories are being filed against this — the position itself, and a ' +
      'Spanish-language interface whose choice is made BY THE PERSON on the invitation screen. ' +
      'DO NOT assume one language per tenant; he is the counter-example, inside one business.',
  },
  {
    key: 'customer_two',
    label: 'Whatever customer two turns out to have',
    evidence:
      'NAMED AS UNKNOWN, not guessed at (2026-08-31). These five sets came from the people David ' +
      'met at one nursery. A second business is the only thing that can separate "this is how ' +
      'nurseries work" from "this is how LAWNS works", and until one exists that is unmeasured. ' +
      'Strike this entry only when a real second-business set replaces it — never by inventing one.',
  },
];

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
      // Growing and plant health, whole — most of what the person actually does all week, and
      // the half the software cannot represent yet. Ticked anyway (R-30).
      'GRO-01', 'GRO-02', 'GRO-03', 'GRO-04', 'GRO-05', 'GRO-06', 'GRO-07', 'GRO-08',
      'PHC-01', 'PHC-02', 'PHC-03', 'PHC-04', 'PHC-05', 'PHC-07',
      // ⚠️ NOT PHC-06 (hold the applicator licence) — I had put it here by derivation; the
      // workbook does not. A licence is a person's credential, not a post's duty.
      'INV-01', 'INV-02', 'INV-03', 'INV-04', 'INV-07', 'INV-09', 'INV-10',
      // ⚠️ NOT INV-08 (reserve or commit stock) — the workbook treats committing stock as a
      // SALES act, against an order, and gives it to sales and to the external rep instead.
      'PUR-02', 'PUR-07',     // Receive the load, and allocate its freight. PUR-07 I had missed.
      'EQP-01', 'EQP-02', 'EQP-03', 'EQP-04', 'EQP-05', 'EQP-06',
      'DEL-03', 'DEL-04',     // Assign crews, load against the day sheet. Not routing, not driving.
      'PPL-07',               // Direct the yard crew day to day.
      'PPL-09',               // 🔴 Train new staff — `not_software`, and I had it in NO set at all.
      'SYS-02',
    ],
  },
  {
    key: 'sales_manager',
    label: 'Sales manager',
    blurb: 'Owns the selling motion end to end, including price and what we promise.',
    kind: 'set',
    responsibilityIds: [
      'SEL-01', 'SEL-02', 'SEL-03', 'SEL-04', 'SEL-06', 'SEL-07', 'SEL-08', 'SEL-09',
      'SEL-10', 'SEL-12', 'SEL-13', 'SEL-14',
      // 🔴 NOT SEL-05 (set the discount tiers) and NOT SEL-15 (decide what the business sells and
      // at what price). The line the workbook draws is sharp and I had smudged it: the sales
      // manager OPERATES the pricing policy — quotes off-list (SEL-03), discounts within the
      // tiers (SEL-04) — and does not SET it. Authority over the policy stays with the owner.
      // ⚠️ NOT SEL-11 (visit a site and scope a job) — the workbook gives that to external sales.
      'MON-01', 'MON-02', 'MON-03', 'MON-04', 'MON-05', 'MON-06',
      'MON-11',               // Review margin. Marked SENSITIVE at tick time, and that is the point.
      'INV-08', 'INV-10',     // What is committed, and what is short before a customer finds out.
      'DEL-01', 'DEL-02', 'DEL-03', 'DEL-10',   // The promise, the route, the crew, and the price.
      'SYS-01', 'SYS-02',
    ],
  },
  {
    key: 'external_sales',
    label: 'External sales',
    blurb: 'Sells away from the lot — site visits, estimates, and following them up.',
    kind: 'set',
    responsibilityIds: [
      'SEL-02', 'SEL-07', 'SEL-09', 'SEL-10', 'SEL-11', 'SEL-12',
      // 🔴 NOT SEL-03 / SEL-04 — the workbook gives the rep NO discretion over price: no
      // quoting off-list and no applying a discount. I had given them both.
      // ⚠️ NOT MON-01 — order creation stays with the office; the rep estimates and follows up.
      'INV-08',               // They commit the stock they sell.
      'DEL-10',               // They quote the delivery.
      'SYS-01',               // They review their own numbers.
    ],
  },
  {
    key: 'crew_driver',
    label: 'Crew member / driver',
    blurb: 'Does the work in the yard and on the road. Records what happened.',
    kind: 'set',
    responsibilityIds: [
      'DEL-04', 'DEL-05', 'DEL-06', 'DEL-07', 'DEL-08',
      'EQP-05',               // Report a fault — the person holding it is the one who sees it.
      'INV-03',               // Record a loss. The driver sees the damage.
      'SEL-13',               // 🔴 Ask a customer for a review. The person standing in front of
                              //    them after the install is the one who asks — not the office.
                              //    Nobody derives this from a job title.
      // 🔴 NOT INV-01 (walk the lot and count stock) and NOT GRO-06 (water and irrigate) — I had
      // both here; the workbook keeps them with the production manager. ✅ RULED 2026-08-31:
      // **this set is DRIVERS, and walking the lot to count is a YARD job.** The staff-count-walk
      // of #238/#67 belongs to a position that does not exist here yet — see the `yard_hand` entry
      // in MISSING_STARTING_POINTS. Do not "fix" this by adding INV-01 to the drivers.
    ],
  },
  {
    key: 'bookkeeper',
    label: 'Bookkeeper',
    blurb: 'Money in, money out, and the books agreeing with the business.',
    kind: 'set',
    responsibilityIds: [
      'MON-02', 'MON-04', 'MON-05', 'MON-06', 'MON-08',
      'MON-07',               // 🔴 UNDELEGABLE, and DECLARED in UNDELEGABLE_SUGGESTIONS above.
                              //    At LAWNS the bookkeeper manages the accounting connection;
                              //    the platform reserves the permission to the account holder.
                              //    Both true — R-30 says the document states the JOB.
      'MON-09',               // Approve and run payroll. I excluded it reasoning "approval is
                              //    authority"; the workbook watched them do it.
      'MON-11',               // Review margin. Shared with the sales manager.
      'MON-10',               // 🔴 Pay a contractor or vendor. ADDED 2026-08-31 on David's ruling
                              //    (ledger #245) after the workbook left it in NO set: *no set at
                              //    all cannot be true — somebody pays vendors in every business.*
                              //    The workbook conflated a position TEMPLATE with a LAWNS
                              //    SNAPSHOT; at LAWNS only the owner does it, and that observation
                              //    lives on the workbook's "Only the owner" tab with its
                              //    consequence and is NOT erased by this row. R-30: the document
                              //    states the JOB, not who currently holds it.
      'PUR-03', 'PUR-04',
      // ⚠️ NOT MON-03 (take a payment — the counter does) and NOT SEL-08 (merge duplicate
      // customers — the workbook gives it to sales).
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

// ── 🔴 THE DECISION TO OFFER IS A PURE FUNCTION, AND IT IS PURE *BECAUSE OF WHAT SHIPPED* ───
// #241 shipped 25 assertions about starting points and **not one of them asked whether the
// chooser reaches the screen.** Every probe tested `startingPointIds` — the SETS — and the sets
// were never the risk. The render decision lived as an inline boolean inside a .tsx component,
// and this repository has no way to assert an inline boolean: the runner bundles `*.test.ts`
// with esbuild and runs it in node, so anything that only exists inside JSX is unreachable by a
// check. **A condition that cannot be asserted is a condition that will not be.**
//
// So the decision moves HERE, where a test can hold it, and the component calls it. The `reason`
// is not decoration: a guard returning the right answer for the wrong reason is the next defect,
// and it also gives `[TRACE:POSITIONS]` something to say when an owner reports "I never saw it".
export interface ChooserState {
  /** `can('settings:update')` — a reader who cannot save is never offered an edit affordance. */
  readonly mayEdit: boolean;
  /** The workspace read is still in flight. */
  readonly loading: boolean;
  /** The position row resolved. False = the id is gone, and the screen says so instead. */
  readonly positionLoaded: boolean;
  /** How many responsibilities are ticked RIGHT NOW — not how many were saved. */
  readonly tickCount: number;
  /** The owner chose "start blank". A choice, once made, has to stick. */
  readonly blankChosen: boolean;
}

/**
 * Offer the starting points?
 *
 * 🔴 THE ONLY POSITIVE CASE IS "NOTHING IS TICKED", AND THAT DELIBERATELY COVERS TWO PATHS THE
 * FIRST BUILD TREATED AS ONE: a position created seconds ago, AND **a saved position someone
 * abandoned at zero**. The second is the one that most needs the offer — it is where every
 * abandoned position lands — and nothing in #241 asserted it.
 *
 * ⚠️ It is withheld once anything is ticked because applying a set REPLACES the ticks, and
 * offering that beside real work is one tap from destroying it. That is a safety property, not a
 * tidiness preference, and `reason` names it so nobody "fixes" it back.
 */
export function shouldOfferStartingPoints(s: ChooserState): { offer: boolean; reason: string } {
  if (s.loading)         return { offer: false, reason: 'loading' };
  if (!s.positionLoaded) return { offer: false, reason: 'no-position' };
  if (!s.mayEdit)        return { offer: false, reason: 'read-only' };
  if (s.blankChosen)     return { offer: false, reason: 'blank-chosen' };
  if (s.tickCount > 0)   return { offer: false, reason: 'already-ticked' };
  return { offer: true, reason: 'nothing-ticked' };
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
