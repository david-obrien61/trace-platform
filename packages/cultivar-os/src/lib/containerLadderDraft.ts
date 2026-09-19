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
}

/** The reason a rung carries when nobody has recorded its caliper — the database's own default. */
export const CALIPER_NOT_SET = 'not set — no caliper recorded for this size';

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
  };
}
