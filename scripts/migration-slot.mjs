#!/usr/bin/env node
// ============================================================
// migration-slot — WHICH MIGRATION SLOTS FOR A DATE ARE TAKEN, AND WHERE THE HOLDER IS
//
// PURPOSE      Answer "what do I call my migration file?" from EVERY place a slot can be held —
//              remote branches, local branches, and every registered worktree's working directory —
//              before a name is chosen. `npm run migration:slot [YYYYMMDD]`.
// DEPENDENCIES git remote-tracking + local refs · every worktree's `supabase/migrations/` on disk ·
//              scripts/lib/migrationSlots.mjs (shared with verify-id-sweep).
// OUTPUTS      the slot table for the date, the next free slot, and the holders of the taken ones.
//              Exit 0 always for a query; exit 1 only on `--strict` with no free slot, or a failing
//              `--self-test`.
//
// WHY THIS EXISTS (2026-09-23, ledger #391)
//   🔴 IT WAS CITED IN FOUR LIVE PROMPTS AS `npm run migration:slot` AND IT DID NOT EXIST — the
//   instruction "list the migration slot before minting" named a command that has never been in
//   `package.json`. A session following the rule got `npm error Missing script`, and the honest
//   responses to that are to skip the step or to hand-roll a one-off — which is how two files land
//   on one slot.
//
//   🔴 AND `verify:id-sweep` CANNOT ANSWER THIS, BY ITS OWN ADMISSION. Its header: *"A claim that
//   exists only in an unpushed local branch of another worktree is invisible to everyone, including
//   this."* For ledger ids that is a stated limit. For MIGRATION FILES it is the normal case: a
//   migration is written, held for David to apply, and sits UNTRACKED for hours or days. Measured
//   on the day this was written: the shared checkout alone held EIGHT `20260923*` files and FIVE of
//   them were untracked — invisible to every ref-based check, and every one of them a taken slot.
//
// ⚠️ WHAT THIS CANNOT DO, so nobody reads more into a green than is there:
//   ① It cannot see another MACHINE. Slots are claimed by writing a file; a file on a laptop that
//      has never pushed is unknowable here, exactly as R-149 says of ids. Push, or tell people.
//   ② It reads remote-tracking refs, which are as fresh as your last fetch. `--fetch` refreshes.
//   ③ It does not close the race. Between this and your commit another session can take the slot.
//      The mitigation is the same as R-149's: pick, write the file, and say so early.
// ============================================================
import { execFileSync } from 'node:child_process';
import {
  migrationsAtRef, migrationsInDir, worktreePaths, slotsForDate, nextFreeSlot, slotOf,
} from './lib/migrationSlots.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const DATE = argv.find((a) => /^\d{8}$/.test(a)) ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');

// ── SELF-TEST — pure, over synthetic claims. Proves the arithmetic, not the repo. ───────────────
if (has('--self-test')) {
  let p = 0, f = 0;
  const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); c ? p++ : f++; };
  const claims = (pairs) => new Map(pairs.map(([file, places]) => [file, new Set(places)]));

  const r1 = slotsForDate('20260923', claims([['20260923a_x.sql', ['origin/main']], ['20260923b_y.sql', ['wt-a']]]));
  ok(r1.find((r) => r.letter === 'a').taken && r1.find((r) => r.letter === 'b').taken, 'T1 a and b read taken');
  ok(!r1.find((r) => r.letter === 'c').taken, 'T2 c reads free');
  ok(nextFreeSlot(r1) === '20260923c', `T3 next free is c (got ${nextFreeSlot(r1)})`);
  ok(r1.find((r) => r.letter === '').taken === false, 'T4 the BARE slot is modelled and reads untaken');
  ok(nextFreeSlot(r1) !== '20260923', '🔴 T5 …but it is NOT OFFERED once a lettered slot exists — it would sort BEFORE files already written for that day');

  const r2 = slotsForDate('20260924', claims([['20260923a_x.sql', ['origin/main']]]));
  ok(nextFreeSlot(r2) === '20260924', 'T6 an untouched date offers its BARE slot first');

  const r3 = slotsForDate('20260923', claims([['20260923_bare.sql', ['origin/main']]]));
  ok(r3.find((r) => r.letter === '').taken && nextFreeSlot(r3) === '20260923a', 'T7 a taken bare slot pushes the answer to a');

  // 🔴 THE NEGATIVE CONTROL THAT MATTERS: a file for ANOTHER date must not consume this date's slot.
  const r4 = slotsForDate('20260923', claims([['20260922h_x.sql', ['origin/main']]]));
  ok(!r4.some((r) => r.taken), 'T8 🔴 another date\'s files take none of this date\'s slots');

  ok(slotOf('20260923h_a_b.sql')?.letter === 'h', 'T9 the letter parses out of a multi-underscore name');
  ok(slotOf('20260923_a.sql')?.letter === '', 'T10 a bare-slot filename parses to the empty letter');
  ok(slotOf('README.md') === null, 'T11 a non-migration filename is not a slot');
  ok(slotOf('2026092_x.sql') === null, 'T12 a 7-digit date is not a slot');

  const full = slotsForDate('20260923', claims(['', ...'abcdefghijklmnopqrstuvwxyz'.split('')]
    .map((l) => [`20260923${l}_x.sql`, ['origin/main']])));
  ok(nextFreeSlot(full) === null, 'T13 a date with all 27 slots gone returns null, not a wrong answer');

  console.log(`\nmigration-slot --self-test — ${p} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
}

if (has('--fetch')) { try { git('fetch', '--all', '--prune', '-q'); } catch { /* staleness reported below */ } }

// ── GATHER. Three populations, and the third is the one nothing else reads. ─────────────────────
const claims = new Map();
const note = (file, place) => {
  if (!slotOf(file)) return;
  if (!claims.has(file)) claims.set(file, new Set());
  claims.get(file).add(place);
};

const remoteRefs = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin').split('\n').map((x) => x.trim()).filter(Boolean);
const localRefs = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').map((x) => x.trim()).filter(Boolean);
for (const ref of [...remoteRefs, ...localRefs]) for (const f of migrationsAtRef(ref, git)) note(f, ref);

const trees = worktreePaths(git);
for (const dir of trees) {
  const label = `📁 ${dir.replace(process.env.HOME ?? '~', '~')}`;
  for (const f of migrationsInDir(dir)) note(f, label);
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────────────────
const rows = slotsForDate(DATE, claims);
const taken = rows.filter((r) => r.taken);
const free = nextFreeSlot(rows);

console.log(`migration-slot — slots for ${DATE}, across ${remoteRefs.length} remote refs, ${localRefs.length} local branches and ${trees.length} worktrees (working directories included, so UNTRACKED files count)`);
console.log('');
if (!taken.length) {
  console.log(`  every slot for ${DATE} is free.`);
} else {
  for (const r of rows) {
    if (!r.taken) continue;
    const h = r.holders[0];
    const onlyOnDisk = h.places.every((p) => p.startsWith('📁'));
    console.log(`  ${r.slot.padEnd(10)} TAKEN  ${h.file}`);
    console.log(`  ${''.padEnd(10)}        ${h.places.slice(0, 3).join(' · ')}${h.places.length > 3 ? ` · +${h.places.length - 3} more` : ''}`);
    if (onlyOnDisk) console.log(`  ${''.padEnd(10)}        ⚠️ ON DISK ONLY — in no ref. Invisible to verify:id-sweep; this is the case this command exists for.`);
    if (r.holders.length > 1) {
      console.log(`  ${''.padEnd(10)}        🔴 ${r.holders.length} DIFFERENT FILES CLAIM THIS SLOT: ${r.holders.map((x) => x.file).join(' · ')}`);
    }
  }
}
console.log('');
console.log(free
  ? `  ➡️  NEXT FREE: ${free}     (${taken.length} of 27 slots taken for ${DATE})`
  : `  🔴 NO FREE SLOT for ${DATE} — all 27 are taken. Use the next date.`);

const collisions = rows.filter((r) => r.holders.length > 1);
if (collisions.length) {
  console.log('');
  console.log(`  🔴 ${collisions.length} SLOT(S) CLAIMED BY MORE THAN ONE FILENAME — two migrations that would sort identically.`);
}
console.log('');
console.log('  ℹ Picking a slot does not reserve it. Write the file and say so; between this and your commit, another session can take it (R-149\'s race, one artefact over).');

if (has('--strict') && (!free || collisions.length)) process.exit(1);
