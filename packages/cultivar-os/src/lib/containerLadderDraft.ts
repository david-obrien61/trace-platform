// ============================================================
// containerLadderDraft — what a person types into Settings → Container sizes, and what is wrong
// with it, as PURE values (ledger #343).
//
// PURPOSE:      The editor's form state and its refusals, split from the write so a probe can
//               assert them without a database handle (the `containerLadderFields` split, same
//               reason — tech-debt #179). Nothing here reads or writes.
//
// 🔴 A NEW RUNG'S T-POSTS ARE COPIED, AND THE COPY SAYS SO UNTIL SOMEBODY CONFIRMS IT. David,
//   2026-09-16: *"A NEW rung's T-posts pre-fill from the largest existing rung and show 'copied —
//   confirm' until saved."* A copied number that looks typed is a guess wearing a measurement's
//   clothes — the same thing `handling_because` exists to prevent — so the draft carries WHERE the
//   figure came from and the reason saved with it names the copy unless the person replaced it.
//
// 🔴 A RUNG IS NEVER DELETED (R-133 · David, 2026-09-15: *"Retire, never delete."*). There is no
//   delete here and no delete policy on the table. Retiring stops a size being OFFERED; it keeps
//   resolving for every old lot and order that names it.
//
// DEPENDENCIES: @trace/shared/inventory (Rung, Ladder, foldLabel, largestRung) — pure.
// OUTPUTS:      RungDraft · draftFromRung · draftForNewRung · rungDraftProblems · draftToRow ·
//               nextSortOrder · COPIED_POSTS_NOTE · CALIPER_NOT_SET.
// ============================================================
import { foldLabel, largestRung, type Ladder, type Rung } from '@trace/shared/inventory';

/** Shown beside a copied post count, and saved as its reason if nobody replaces the reason. */
export const COPIED_POSTS_NOTE = 'copied — confirm';

export interface RungDraft {
  label: string;
  /** Comma-separated, as typed. */
  aliases: string;
  /** As typed — '' means "no volume" (a slip), which is a real answer. */
  volumeGallons: string;
  handlingMinutes: string;
  handlingBecause: string;
  installTPostsPerTree: string;
  installTPostsBecause: string;
  /** The rung the post count was copied from, while nobody has touched it. Null once edited. */
  postsCopiedFrom: string | null;
  /** Caliper in inches, as typed (ledger #356). '' = not recorded. A blank max with a min = "and up". */
  caliperMinInches: string;
  caliperMaxInches: string;
  caliperBecause: string;
  /**
   * What ONE tree of this size costs to install, as typed (ledger #386). '' = NOT SET, which is a
   * real and common answer: the counter then types an amount per order, with a reason (R-171 (c)).
   * 🔴 It must never be saved as 0 to mean "unknown" — 0 is a free install, and the validation
   * below says so in those words rather than silently accepting it.
   */
  installPrice: string;
  installPriceBecause: string;
  /**
   * GROW — months from uppotting into this rung until a tree on it is SELLABLE (ledger #390).
   * '' = UNKNOWN, which is the honest and currently the COMMON answer: eight of LAWNS's nine rungs
   * have no figure and David is asking Terry for them. It must never be typed as 0 — a tree
   * sellable the instant it is potted has not been grown — and the validation says so.
   */
  growMonths: string;
  growBecause: string;
  /** HOLD — months it then stays on this rung before it must move up. '' = UNKNOWN. */
  holdMonths: string;
  holdBecause: string;
}

/** The reason a rung carries when nobody has set its install price — the migration's own wording. */
export const INSTALL_PRICE_NOT_SET = 'not set — the counter types an amount for this size';

/** The reason a rung carries when nobody has recorded its caliper — the database's own default. */
export const CALIPER_NOT_SET = 'not set — no caliper recorded for this size';

/** The reason a rung carries when nobody has stated how long it takes to grow on this size. */
export const GROW_NOT_SET = 'not set — nobody has said how long this size takes to become sellable';
/** The reason a rung carries when nobody has stated how long a tree holds on this size. */
export const HOLD_NOT_SET = 'not set — nobody has said how long a tree holds at this size';

const numText = (n: number | null): string => (n == null ? '' : String(n));

export function draftFromRung(r: Rung): RungDraft {
  return {
    label: r.label,
    aliases: r.aliases.join(', '),
    volumeGallons: numText(r.volumeGallons),
    handlingMinutes: numText(r.handlingMinutes),
    handlingBecause: r.handlingBecause,
    installTPostsPerTree: String(r.installTPostsPerTree),
    installTPostsBecause: r.installTPostsBecause,
    postsCopiedFrom: null,
    caliperMinInches: numText(r.caliperMinInches),
    caliperMaxInches: numText(r.caliperMaxInches),
    caliperBecause: r.caliperBecause,
    installPrice: numText(r.installPrice),
    installPriceBecause: r.installPriceBecause,
    growMonths: numText(r.growMonths),
    growBecause: r.growBecause,
    holdMonths: numText(r.holdMonths),
    holdBecause: r.holdBecause,
  };
}

/** A blank new size, its posts pre-filled from the TOP active rung (ladder order, never volume). */
export function draftForNewRung(ladder: Ladder): RungDraft {
  const top = largestRung(ladder);
  return {
    label: '', aliases: '', volumeGallons: '', handlingMinutes: '',
    handlingBecause: 'not timed — the yard-wide rate stands in',
    installTPostsPerTree: top ? String(top.installTPostsPerTree) : '0',
    installTPostsBecause: top ? `${COPIED_POSTS_NOTE} (from ${top.label})` : 'not set — no posts until somebody enters them',
    postsCopiedFrom: top ? top.label : null,
    // Caliper is NOT copied from the top rung: a new size's trees are not the biggest size's trees.
    caliperMinInches: '', caliperMaxInches: '', caliperBecause: CALIPER_NOT_SET,
    // 🔴 NOT COPIED FROM ANOTHER RUNG, UNLIKE THE T-POSTS. A post count is a physical fact that
    // travels between neighbouring sizes; a PRICE is not, and copying one would put a number on a
    // new size that nobody chose and that reads as though somebody did.
    installPrice: '', installPriceBecause: INSTALL_PRICE_NOT_SET,
    // 🔴 NOT COPIED FROM ANOTHER RUNG, for the install price's reason: how long a tree takes to
    // grow into a 30 is not evidence about a 45. A copied interval would put a schedule date on a
    // new size that nobody chose — and a date is exactly what people act on.
    growMonths: '', growBecause: GROW_NOT_SET,
    holdMonths: '', holdBecause: HOLD_NOT_SET,
  };
}

/** The next sort position: ten past the highest, so a size can later be slotted between two. */
export function nextSortOrder(ladder: Ladder): number {
  return ladder.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 10;
}

const parseAliases = (s: string): string[] => {
  const out: string[] = [];
  for (const a of s.split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!out.some((o) => foldLabel(o) === foldLabel(a))) out.push(a);
  }
  return out;
};

const optionalPositive = (s: string): number | null | 'bad' => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 'bad';
};

/**
 * Everything wrong with a draft, in words. Empty = it may be saved (§1.6 item 3). The database
 * refuses a duplicate label and a non-positive volume too; these say it BEFORE the write, in the
 * person's words, and they cover what the database cannot see (a copied figure left unconfirmed is
 * allowed, but a blank reason is not).
 */
export function rungDraftProblems(d: RungDraft, ladder: Ladder, editingLabel: string | null): string[] {
  const out: string[] = [];
  const label = d.label.trim();
  if (!label) out.push('A size needs a name.');
  else if (ladder.some((r) => r.label !== editingLabel && foldLabel(r.label) === foldLabel(label))) {
    out.push(`"${label}" is already a size here. Sizes are never deleted — if it is retired, bring it back instead.`);
  }
  for (const a of parseAliases(d.aliases)) {
    const clash = ladder.find((r) => r.label !== editingLabel
      && (foldLabel(r.label) === foldLabel(a) || r.aliases.some((x) => foldLabel(x) === foldLabel(a))));
    if (clash) out.push(`The other name "${a}" already belongs to ${clash.label}.`);
  }
  if (optionalPositive(d.volumeGallons) === 'bad') out.push('The container volume must be a number above 0, or left blank for a size with no volume (a slip).');
  const hm = optionalPositive(d.handlingMinutes);
  if (hm === 'bad') out.push('Handling minutes must be a number above 0, or left blank to use the yard-wide rate.');
  if (!d.handlingBecause.trim()) out.push('Say where the handling time came from — even "not timed".');
  const posts = Number(d.installTPostsPerTree);
  if (d.installTPostsPerTree.trim() === '' || !Number.isInteger(posts) || posts < 0) {
    out.push('T-posts per tree must be a whole number, 0 or more.');
  }
  if (!d.installTPostsBecause.trim()) out.push('Say where the T-post figure came from.');
  // Caliper (ledger #356) — both optional; a max needs a min and may not be below it.
  const cMin = optionalPositive(d.caliperMinInches);
  const cMax = optionalPositive(d.caliperMaxInches);
  if (cMin === 'bad') out.push('The smallest caliper must be a number of inches above 0, or left blank if it is not recorded.');
  if (cMax === 'bad') out.push('The largest caliper must be a number of inches above 0, or left blank for "and up".');
  if (cMax !== 'bad' && cMax != null && cMin == null) out.push('Enter the smallest caliper too — a largest with no smallest is not a size.');
  if (typeof cMin === 'number' && typeof cMax === 'number' && cMax < cMin) out.push('The largest caliper is below the smallest.');
  if (!d.caliperBecause.trim()) out.push('Say where the caliper figures came from — even "not set".');
  // Install price (ledger #386). Optional — blank is the honest "not set". But a typed 0 is not:
  // it is a free install, and nobody means that. `optionalPositive` refuses 0 and negatives alike.
  const ip = optionalPositive(d.installPrice);
  if (ip === 'bad') {
    out.push(d.installPrice.trim() === '0'
      ? 'An install price of $0 would charge nothing. Leave it blank if there is no price for this size — the counter is then asked for an amount.'
      : 'The install price must be an amount above $0, or left blank if there is no price for this size.');
  }
  if (!d.installPriceBecause.trim()) out.push('Say where the install price came from — even "not set".');
  // GROW and HOLD (ledger #390). Both optional — blank is the honest UNKNOWN and the schedule then
  // says UNKNOWN rather than borrowing the business-wide default. A typed 0 is refused for the same
  // reason a $0 install price is: it is not a short interval, it is a nonsensical one.
  const gm = optionalPositive(d.growMonths);
  if (gm === 'bad') {
    out.push(d.growMonths.trim() === '0'
      ? 'A grow of 0 months would make a tree sellable the day it is potted. Leave it blank if nobody has measured it — the schedule then says UNKNOWN.'
      : 'Months to grow must be a number above 0, or left blank if nobody has measured it.');
  }
  if (!d.growBecause.trim()) out.push('Say where the grow figure came from — even "not set".');
  const hom = optionalPositive(d.holdMonths);
  if (hom === 'bad') {
    out.push(d.holdMonths.trim() === '0'
      ? 'A hold of 0 months would mean a tree must move up the day it becomes sellable. Leave it blank if nobody has measured it.'
      : 'Months to hold must be a number above 0, or left blank if nobody has measured it.');
  }
  if (!d.holdBecause.trim()) out.push('Say where the hold figure came from — even "not set".');
  return out;
}

/**
 * The row to write. Call only on a draft with no problems.
 * 🔴 SAVING IS THE CONFIRMATION. The on-screen note says "copied — confirm" UNTIL the save; the
 * reason written is what happened — copied from the named size when this one was added — so the
 * stored row never keeps asking for a confirmation it has had.
 */
export function draftToRow(d: RungDraft) {
  const vol = optionalPositive(d.volumeGallons);
  const hm = optionalPositive(d.handlingMinutes);
  return {
    label: d.label.trim(),
    aliases: parseAliases(d.aliases),
    volume_gallons: vol === 'bad' ? null : vol,
    handling_minutes: hm === 'bad' ? null : hm,
    handling_because: d.handlingBecause.trim(),
    install_t_posts_per_tree: Number(d.installTPostsPerTree),
    install_t_posts_because: d.postsCopiedFrom && d.installTPostsBecause.startsWith(COPIED_POSTS_NOTE)
      ? `copied from ${d.postsCopiedFrom} when this size was added`
      : d.installTPostsBecause.trim(),
    caliper_min_inches: typeof optionalPositive(d.caliperMinInches) === 'number' ? Number(d.caliperMinInches) : null,
    caliper_max_inches: typeof optionalPositive(d.caliperMaxInches) === 'number' ? Number(d.caliperMaxInches) : null,
    caliper_because: d.caliperBecause.trim(),
    install_price: typeof optionalPositive(d.installPrice) === 'number' ? Number(d.installPrice) : null,
    install_price_because: d.installPriceBecause.trim(),
    grow_months: typeof optionalPositive(d.growMonths) === 'number' ? Number(d.growMonths) : null,
    grow_because: d.growBecause.trim(),
    hold_months: typeof optionalPositive(d.holdMonths) === 'number' ? Number(d.holdMonths) : null,
    hold_because: d.holdBecause.trim(),
  };
}
