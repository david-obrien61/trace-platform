/**
 * ── channelVocabularyPaths — the rollback is FINDABLE and is NOT a migration ──────────────────
 *
 * WHY THIS FILE EXISTS (R-153, ledger #310). David: *"The rollback is a file I would run under
 * pressure — so it is a file."* It lives in `supabase/migrations/rollbacks/` so it is findable one
 * level down from where he runs SQL. **That creates a new hazard the moment it exists: a rollback
 * sitting anywhere near the migration corpus must never be picked up AS a migration** — it DROPs the
 * table, the FKs and the trigger, so applying it by accident is the worst outcome on this path.
 *
 * Every corpus reader in the repo uses a non-recursive `readdirSync(dir).filter(f => f.endsWith('.sql'))`,
 * so a DIRECTORY entry is filtered out. That is true today and is exactly the kind of thing a future
 * `{ recursive: true }` would silently break, which is why it is asserted rather than trusted.
 *
 * PROBES BOTH DIRECTIONS (STD-022): the rollback must be PRESENT where David looks, and ABSENT from
 * what the caps read.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/channelVocabularyPaths.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const MIGDIR   = 'supabase/migrations';
const ROLLDIR  = join(MIGDIR, 'rollbacks');
const ROLLBACK = join(ROLLDIR, 'rollback-20260912_channels_one_vocabulary.sql');
const MIGRATION = join(MIGDIR, '20260912_channels_one_vocabulary.sql');

console.log('\n§A — it is WHERE DAVID LOOKS');
ok(existsSync(MIGDIR),    'A1 supabase/migrations exists');
ok(existsSync(ROLLDIR),   'A2 supabase/migrations/rollbacks exists — findable one level down (R-153)');
ok(existsSync(ROLLBACK),  'A3 the rollback is in it');
ok(existsSync(MIGRATION), 'A4 the migration is at the top level where it is applied from');
// The name must say what it is, so it cannot be mistaken for something to apply.
ok(/^rollback-/.test('rollback-20260912_channels_one_vocabulary.sql'),
  'A5 the filename begins "rollback-" — the name says what it is');

console.log('\n§B — it is NOT in the migration corpus (the hazard)');
// Reproduce the exact enumeration every cap uses. If this ever picks the rollback up, the caps would
// read DROP statements as part of the schema — and `apply-migrations` could apply them.
const topLevel = readdirSync(MIGDIR).filter(f => f.endsWith('.sql')).sort();
ok(topLevel.length > 0, 'B0 the enumeration REACHED the corpus (a zero-length read makes §B vacuous)');
ok(!topLevel.includes('rollbacks'), 'B1 the directory entry is filtered out — it does not end .sql');
ok(!topLevel.some(f => f.startsWith('rollback-')),
  'B2 🔴 no rollback file is in the top-level corpus');

const corpus = topLevel.map(f => readFileSync(join(MIGDIR, f), 'utf8')).join('\n');
// A string that exists ONLY in the rollback. If it appears in the corpus, the rollback got swept in.
ok(!corpus.includes('ROLLBACK for 20260912_channels_one_vocabulary.sql'),
  'B3 🔴 the rollback\'s own header is ABSENT from the concatenated corpus');
ok(!corpus.includes('DROP TABLE IF EXISTS public.channels'),
  'B4 🔴 the corpus contains no DROP of the table the migration creates');
// Positive control: the corpus DOES contain the migration, so B3/B4 are not passing on an empty read.
ok(corpus.includes('CREATE TABLE IF NOT EXISTS public.channels'),
  'B5 POSITIVE CONTROL — the corpus DOES contain the migration itself');

console.log('\n§C — the rollback still says what it must');
const roll = readFileSync(ROLLBACK, 'utf8');
ok(/DROP TRIGGER IF EXISTS business_modules_advert_channels_known/.test(roll), 'C1 drops the trigger');
ok(/ADD CONSTRAINT campaign_posts_platform_check/.test(roll), 'C2 restores campaign_posts\' CHECK');
ok(/ADD CONSTRAINT social_drafts_platform_check/.test(roll),  'C3 restores social_drafts\' CHECK');
ok(/DROP TABLE IF EXISTS public\.channels/.test(roll),        'C4 drops the lookup table');
// The destructive line must stay commented — it would discard every email subject written since.
ok(/^-- ALTER TABLE public\.campaign_posts DROP COLUMN IF EXISTS subject;/m.test(roll),
  'C5 🔴 DROP COLUMN subject stays COMMENTED OUT — a rollback must not silently destroy content');
ok(/run this \*before\* the data restore/i.test(roll) || /BEFORE THE DATA RESTORE/i.test(roll),
  'C6 it states the order — schema before rows, or the constraint passes over contradicting rows');

console.log(`\n${failed === 0 ? '✅' : '🔴'} channelVocabularyPaths — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
