// ============================================================
// migrationSlots — WHERE A MIGRATION FILENAME LIVES, AND WHICH SLOTS A DATE HAS LEFT
//
// PURPOSE      One home for "enumerate the migration filenames visible from a git ref or a
//              directory", and for the slot arithmetic over them. `verify-id-sweep` already had the
//              ref half inline (`migrationsAt`); `migration-slot` needs the same operation plus the
//              working-directory half, so it is extracted here rather than copied (§6 r8 — the same
//              OPERATION in two places becomes two behaviours).
// DEPENDENCIES git · node:fs. No database, no network beyond whatever the caller has fetched.
// OUTPUTS      migrationsAtRef · migrationsInDir · slotOf · slotsForDate · nextFreeSlot · SLOT_RE
//
// 🔴 THE SLOT VOCABULARY, AS THIS REPO ACTUALLY USES IT (measured, not assumed):
//    `20260923_name.sql` is the BARE slot for that date; `20260923a_name.sql` … `20260923z_name.sql`
//    are the lettered ones. Both shapes are live on `main` today, so a tool that understood only one
//    would report a free slot that is taken. The bare slot sorts FIRST.
// ============================================================
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

/** `20260923h_container_ladder_grow_and_hold.sql` → { date: '20260923', letter: 'h' }. */
export const SLOT_RE = /^(\d{8})([a-z]?)_/;

export function slotOf(filename) {
  const m = SLOT_RE.exec(filename);
  return m ? { date: m[1], letter: m[2] || '' } : null;
}

/** Every migration filename visible from a git ref. Returns [] for an unreadable ref, never throws. */
export function migrationsAtRef(ref, git = defaultGit) {
  try {
    return git('ls-tree', '--name-only', '-r', ref, 'supabase/migrations/')
      .split('\n').map((x) => x.trim()).filter(Boolean)
      .map((x) => x.replace(/^supabase\/migrations\//, ''))
      .filter((x) => x.endsWith('.sql'));
  } catch { return []; }
}

/**
 * Every migration filename on disk under a working tree.
 *
 * 🔴 THIS IS THE HALF `verify-id-sweep` CANNOT DO, AND IT IS WHERE THE COLLISIONS ARE.
 * That cap's own header says a claim in an unpushed local branch "is invisible to everyone,
 * including this". A migration file is worse than invisible: it is usually UNTRACKED — written,
 * not yet committed — so it is absent from every ref while absolutely being a taken slot. Measured
 * 2026-09-23: the shared checkout held EIGHT `20260923*` files, five of them untracked.
 */
export function migrationsInDir(dir) {
  try {
    return readdirSync(dir + '/supabase/migrations')
      .filter((x) => x.endsWith('.sql'));
  } catch { return []; }
}

/** Absolute paths of every registered worktree, including the main checkout. */
export function worktreePaths(git = defaultGit) {
  try {
    return git('worktree', 'list', '--porcelain')
      .split('\n').filter((l) => l.startsWith('worktree '))
      .map((l) => l.slice('worktree '.length).trim()).filter(Boolean);
  } catch { return []; }
}

/**
 * The full slot table for one date.
 *
 * `claims` is a Map of filename → Set of places it was seen. Returns the bare slot then a…z, each
 * with the filename that took it and everywhere it was seen, so a report can name the holder.
 */
export function slotsForDate(date, claims) {
  const byLetter = new Map();
  for (const [file, places] of claims) {
    const s = slotOf(file);
    if (!s || s.date !== date) continue;
    if (!byLetter.has(s.letter)) byLetter.set(s.letter, []);
    byLetter.get(s.letter).push({ file, places: [...places].sort() });
  }
  const letters = ['', ...'abcdefghijklmnopqrstuvwxyz'.split('')];
  return letters.map((letter) => ({
    letter,
    slot: `${date}${letter}`,
    taken: byLetter.has(letter),
    holders: byLetter.get(letter) ?? [],
  }));
}

/**
 * The first free slot for a date, or null when all 27 are gone.
 * ⚠️ THE BARE SLOT IS OFFERED ONLY WHEN THE DATE IS OTHERWISE UNTOUCHED. Once any lettered slot
 * exists, handing back the bare one would sort it BEFORE migrations already written for that day,
 * which reorders an apply sequence somebody has already reasoned about.
 */
export function nextFreeSlot(rows) {
  const anyTaken = rows.some((r) => r.taken);
  for (const r of rows) {
    if (r.taken) continue;
    if (r.letter === '' && anyTaken) continue;
    return r.slot;
  }
  return null;
}

const defaultGit = (...a) =>
  execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
