#!/usr/bin/env node
/**
 * list-migration-slot — WHICH MIGRATION FILENAMES FOR A DATE ARE ALREADY TAKEN, EVERYWHERE.
 *
 * PURPOSE:      Before minting `YYYYMMDD<letter>_*.sql`, list that date's slots across
 *               (1) this working tree, (2) EVERY remote branch, and (3) — when a live read is
 *               available — what is actually APPLIED. Then say the next free letter.
 *
 * 🔴 WHY IT EXISTS. David, 2026-09-23, after the FOURTH id collision of the week and the first
 *   that would have had him running the wrong file: *"BEFORE YOU PICK ANY ID from now on: list
 *   that slot across every remote branch AND David's applied set, as crew-link does."*
 *   THE INCIDENT: this session minted `20260923`, `20260923b` and `20260923c` from a worktree
 *   branched off `origin/main`, where those names were free. They were not free anywhere else —
 *   `20260923`, `20260923a` and `20260923b` were already on `main` and APPLIED, and `20260923c`
 *   and `20260923d` were being written by a live session in the shared checkout at that moment.
 *   Three of my three names collided. `20260923c` named two different migrations.
 *
 * 🔴 AND THE POINT THAT MAKES IT MORE THAN TIDINESS: a collision here is not a merge conflict —
 *   git is perfectly happy with two differently-named files. It is a HUMAN handing the wrong file
 *   to the SQL editor, because "apply 20260923c" named two things. `verify:id-sweep` cannot see
 *   this: it sweeps LEDGER, TECH-DEBT and RULING ids, which live in markdown. A migration slot is
 *   a FILENAME, and nothing swept filenames.
 *
 * ⚠️ IT IS A REPORT, NOT A GATE, AND DELIBERATELY SO. It cannot fail a build: the only way to know
 *   a slot is free is to look at the instant you take it, and a cap that ran at verify time would
 *   be answering a question already decided. Run it, read it, then mint.
 *
 * USAGE:   node scripts/list-migration-slot.mjs [YYYYMMDD]     (default: today)
 *          SUPABASE_PAT=… node scripts/list-migration-slot.mjs   ← also reports APPLIED
 */
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const DATE = process.argv[2] || new Date().toISOString().slice(0, 10).replace(/-/g, '');
if (!/^\d{8}$/.test(DATE)) { console.error(`Not a date: ${DATE}`); process.exit(2); }

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
const slotOf = (f) => (f.match(new RegExp(`^${DATE}([a-z]?)_`)) || [])[1];

// ── 1. THIS TREE ────────────────────────────────────────────────────────────────────────────
const local = new Map();
for (const f of readdirSync('supabase/migrations').filter((f) => f.startsWith(DATE))) {
  const s = slotOf(f); if (s !== undefined) local.set(f, s);
}

// ── 2. EVERY REMOTE BRANCH. 🔴 THE HALF THAT WOULD HAVE CAUGHT THIS ONE — a name free on
//      origin/main can be taken on a branch nobody has merged yet, and a slot taken anywhere is
//      taken, because both files end up in one directory the day they merge.
const remote = new Map();
for (const ref of sh('git for-each-ref --format="%(refname)" refs/remotes/').split('\n').filter(Boolean)) {
  if (ref.endsWith('/HEAD')) continue;
  for (const f of sh(`git ls-tree --name-only ${ref} supabase/migrations/`).split('\n').filter(Boolean)) {
    const base = f.split('/').pop();
    if (!base.startsWith(DATE)) continue;
    const s = slotOf(base); if (s === undefined) continue;
    if (!remote.has(base)) remote.set(base, []);
    remote.get(base).push(ref.replace('refs/remotes/', ''));
  }
}

// ── 3. UNCOMMITTED IN ANY SIBLING WORKTREE — where a LIVE session's file sits before it is
//      committed. This is exactly where 20260923c/d were when they collided with mine.
const trees = sh('git worktree list --porcelain').split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9));
const untracked = new Map();
for (const t of trees) {
  for (const f of sh(`git -C "${t}" ls-files --others --exclude-standard supabase/migrations/`).split('\n').filter(Boolean)) {
    const base = f.split('/').pop();
    if (!base.startsWith(DATE)) continue;
    const s = slotOf(base); if (s === undefined) continue;
    if (!untracked.has(base)) untracked.set(base, []);
    untracked.get(base).push(t.replace(process.env.HOME || '~', '~'));
  }
}

const taken = new Map();
const note = (f, where) => { if (!taken.has(f)) taken.set(f, []); taken.get(f).push(where); };
for (const [f] of local) note(f, 'this tree');
for (const [f, refs] of remote) note(f, refs.join(', '));
for (const [f, ts] of untracked) note(f, `UNCOMMITTED in ${ts.join(', ')}`);

console.log(`\nMIGRATION SLOTS FOR ${DATE} — every one that is taken anywhere\n`);
if (taken.size === 0) console.log('  (none — the whole date is free)');
for (const [f, where] of [...taken].sort()) {
  console.log(`  ${(slotOf(f) || '(bare)').padEnd(7)} ${f}`);
  console.log(`  ${''.padEnd(7)}   └─ ${[...new Set(where)].join(' · ')}`);
}

const used = new Set([...taken.keys()].map(slotOf));
const letters = ['', ...'abcdefghijklmnopqrstuvwxyz'];
const free = letters.filter((l) => !used.has(l)).slice(0, 4);
console.log(`\n  NEXT FREE SLOT${free.length > 1 ? 'S' : ''}: ${free.map((l) => `${DATE}${l}_`).join(' · ')}`);
console.log('  ⚠️ A slot is taken if it exists ANYWHERE above — merged, unmerged, or uncommitted in');
console.log('     a sibling worktree. Two files can share a prefix without git complaining; what');
console.log('     breaks is a person told to "apply 20260923c" when that names two files.');
console.log('  ℹ This does NOT close the race (R-149\'s shape, one artefact over): between reading');
console.log('     this and committing, another session can take the slot. Mint and push promptly.\n');
