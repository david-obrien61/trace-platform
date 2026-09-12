/**
 * ── measure-channel-vocabulary-mutants — can the one-vocabulary suite go red? ──────────
 *
 * PURPOSE:      A green suite is a claim until something proves it can fail. One deliberate edit at a
 *               time, re-run, report CAUGHT or SURVIVED. R-33 / CLAUDE.md §6 r19.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates temp copies, restored in `finally`.
 * OUTPUTS:      One line per mutant + CAUGHT/TOTAL. Exit 1 if any survived OR never applied.
 *
 * 🔴 GREEN CONTROL FIRST · 🔴 EXIT CODE not a grep · 🔴 EVERY MUTANT VERIFIED TO HAVE APPLIED.
 * 🔴 THE DRIFT MUTANTS (D1–D4) ARE THE WHOLE POINT: they re-create the exact defect this pass fixes
 *    — one list changed and the other not — in both directions, on both sides.
 * 🔴 P-MUTANTS CHANGE THE POPULATION, not the subject (tech-debt #182): they prove §A's parser and
 *    §D's file probes REACH their targets rather than passing on an empty read.
 *
 * Run: node scripts/measure-channel-vocabulary-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT  = new URL('..', import.meta.url).pathname;
const VOCAB = ROOT + 'packages/shared/src/business-logic/channelVocabulary.ts';
const MIG   = ROOT + 'supabase/migrations/20260912_channels_one_vocabulary.sql';
const TYPES = ROOT + 'packages/shared/src/campaigns/types.ts';
const SETUP = ROOT + 'packages/cultivar-os/src/pages/SocialSetup.tsx';
const GEN   = ROOT + 'packages/shared/src/campaigns/generate.ts';
const API   = ROOT + 'packages/cultivar-os/api/campaigns.ts';
const SUITE = 'packages/shared/src/business-logic/channelVocabulary.test.ts';
const ESB   = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ── THE DRIFT, RE-CREATED — both directions, both sides ────────────────────────────────────
  { id: 'D1', file: VOCAB, why: '🔴 THE ORIGINAL DEFECT — the TS list loses tiktok while the table keeps it',
    from: "  'tiktok',\n", to: '' },
  { id: 'D2', file: VOCAB, why: '🔴 THE MIRROR — the TS list gains a channel the table does not seed',
    from: "  'email',\n] as const;", to: "  'email',\n  'myspace',\n] as const;" },
  { id: 'D3', file: MIG, why: '🔴 the MIGRATION loses email while TS keeps it (R-150 ① silently reversed)',
    from: "  ('email',     'email',  'Email',", to: "  ('no_email',  'email',  'Email'," },
  { id: 'D4', file: VOCAB, why: 'a duplicate in the TS list masks a missing name (counts still match)',
    from: "  'twitter',\n  'sms',", to: "  'twitter',\n  'twitter'," },

  // ── THE MIGRATION'S OWN PROMISES ───────────────────────────────────────────────────────────
  { id: 'M1', file: MIG, why: 'only ONE table gets the FK — the other keeps drifting',
    from: 'ALTER TABLE public.social_drafts\n  ADD CONSTRAINT social_drafts_platform_fkey\n  FOREIGN KEY (platform) REFERENCES public.channels(name)',
    to:   'ALTER TABLE public.social_drafts\n  ADD CONSTRAINT social_drafts_platform_fkey\n  CHECK (platform IS NOT NULL)' },
  { id: 'M2', file: MIG, why: 'subject ships NOT NULL — every caption forced to carry an empty string (A9)',
    from: '  ADD COLUMN IF NOT EXISTS subject text;', to: '  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT \'\';' },
  { id: 'M3', file: MIG, why: 'the trigger fires on INSERT only — an UPDATE can smuggle a bad name in',
    from: '  BEFORE INSERT OR UPDATE OF config ON public.business_modules', to: '  BEFORE INSERT ON public.business_modules' },
  { id: 'M4', file: MIG, why: 'the trigger logs instead of refusing — a check that cannot disagree',
    from: "    RAISE EXCEPTION\n      'unknown channel name(s) in advert_channels: %. Add a row to public.channels in a migration first.', stray;",
    to:   "    RAISE NOTICE 'unknown channel: %', stray;" },
  { id: 'M5', file: MIG, why: 'a malformed advert_channels passes VACUOUSLY instead of being refused',
    from: "  IF jsonb_typeof(NEW.config->'advert_channels') <> 'array' THEN", to: '  IF false THEN' },
  { id: 'M6', file: MIG, why: 'a client write policy appears — a channel could be added outside a migration',
    from: '-- No INSERT / UPDATE / DELETE policy of any kind.',
    to:   'CREATE POLICY channels_w ON public.channels FOR INSERT TO authenticated WITH CHECK (true);\n-- No INSERT / UPDATE / DELETE policy of any kind.' },
  { id: 'M7', file: MIG, why: 'ON DELETE CASCADE — deleting a channel would erase the posts that used it',
    from: '  FOREIGN KEY (platform) REFERENCES public.channels(name)\n  ON UPDATE CASCADE ON DELETE RESTRICT;\n\n-- social_drafts',
    to:   '  FOREIGN KEY (platform) REFERENCES public.channels(name)\n  ON UPDATE CASCADE ON DELETE CASCADE;\n\n-- social_drafts' },
  { id: 'M8', file: MIG, why: 'RLS left off — the catalog readable and writable by anyone',
    from: 'ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;', to: '-- rls skipped' },
  { id: 'M9', file: MIG, why: 'the jsonb limit stops being recorded — a reader files it as an oversight',
    from: 'cannot declare a foreign key into a jsonb value', to: 'does not have a foreign key here' },
  // ⚠️ M10's FIRST VERSION ONLY RENAMED A COMMENT HEADER and the suite stayed green — correctly, because
  // nothing had been removed. The MUTANT was weak, not the probe: it claimed "the pre-flight is
  // removed" and deleted a line of prose. A mutant whose description overstates what it does
  // manufactures a false SURVIVED and sends you to harden a probe that was already right.
  { id: 'M10', file: MIG, why: 'the pre-flight DO block is REALLY removed — a stray live value fails mid-migration instead',
    from: 'DO $$\nDECLARE\n  seeded text[]', to: 'DO $$\nDECLARE\n  unused text; -- seeded removed\n  seeded_disabled text[]' },

  // ── THE THREE COPIES STAYING GONE ──────────────────────────────────────────────────────────
  { id: 'C1', file: TYPES, why: '🔴 COPY 4 RETURNS — the stale hand-typed union comes back',
    from: '  platform: ChannelName;', to: "  platform: 'instagram' | 'facebook' | 'sms' | 'email';" },
  { id: 'C2', file: TYPES, why: 'the subject field is dropped from the post type',
    from: '  subject: string | null;', to: '' },
  { id: 'C3', file: SETUP, why: '🔴 COPY 3 RETURNS — SocialSetup hardcodes a channel list again',
    from: 'function defaultChannels(catalog: Channel[]): ChannelEntry[] {',
    to:   'const SOCIAL_CHANNELS = [{ name: 1 }];\nfunction defaultChannels(catalog: Channel[]): ChannelEntry[] {' },
  { id: 'C4', file: SETUP, why: '🔴 THE COPY RULE BROKEN — the screen promises direct send is coming',
    from: "? 'TRACE writes a subject line and a body alongside your social posts, ready to copy into your own email and send. You send it; TRACE doesn\\u2019t.'",
    to:   "? 'TRACE drafts your email now and direct sending is coming soon.'" },
  { id: 'C5', file: GEN, why: '🔴 the guidance MAP returns — one list replaced by a second copy',
    from: 'const DEFAULT_CHANNEL_GUIDANCE', to: "const CHANNEL_GUIDANCE = { instagram: 'x' };\nconst DEFAULT_CHANNEL_GUIDANCE" },
  { id: 'C6', file: GEN, why: 'email silently gets a run of posts instead of one message',
    from: "const ONE_PER_CAMPAIGN_KINDS: readonly string[] = ['sms', 'email'];",
    to:   "const ONE_PER_CAMPAIGN_KINDS: readonly string[] = ['sms'];" },
  { id: 'C7', file: API, why: 'an unknown configured name is passed through and kills the atomic batch',
    from: '        .filter(c => isChannelName(c.name))', to: '        .filter(() => true)' },
  { id: 'C8', file: API, why: 'the insert stops writing the subject — email loses its subject line',
    from: '        subject:        p.subject,', to: '' },

  // ── P · POPULATION — do the probes REACH anything? (tech-debt #182) ─────────────────────────
  { id: 'P1', file: MIG, why: 'POPULATION — the INSERT is renamed so §A parses NOTHING (must not pass)',
    from: 'INSERT INTO public.channels (name, kind, label, guidance, sort_order) VALUES',
    to:   'INSERT INTO public.channels_renamed (name, kind, label, guidance, sort_order) VALUES' },
  { id: 'P2', file: VOCAB, why: 'POPULATION — the migration path is wrong, so §A reads the wrong file',
    from: "export const CHANNEL_SEED_MIGRATION = 'supabase/migrations/20260912_channels_one_vocabulary.sql';",
    to:   "export const CHANNEL_SEED_MIGRATION = 'supabase/migrations/20260529_campaigns.sql';" },
  { id: 'P3', file: VOCAB, why: 'POPULATION — the column list drops guidance, so the join silently gets none',
    from: "export const CHANNEL_COLUMNS = 'name, kind, label, guidance, active, sort_order';",
    to:   "export const CHANNEL_COLUMNS = 'name, kind, label, active, sort_order';" },
];

const originals = new Map();
for (const f of [VOCAB, MIG, TYPES, SETUP, GEN, API]) originals.set(f, readFileSync(f, 'utf8'));

let caught = 0, survived = 0, errored = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) {
    console.log('RED — aborting. Every CAUGHT below would be meaningless.');
    process.exit(2);
  }
  console.log('GREEN ✓  every result below is measured against this.\n');

  for (const m of MUTANTS) {
    const src = originals.get(m.file);
    if (!src.includes(m.from)) {
      console.log(`  ${m.id}  ERROR    the from-string is not in the source — mutant never applied`);
      errored++;
      continue;
    }
    writeFileSync(m.file, src.replace(m.from, m.to));
    const green = suiteIsGreen();
    writeFileSync(m.file, src);
    if (green) { survived++; console.log(`  ${m.id}  SURVIVED 🔴  ${m.why}`); }
    else       { caught++;  console.log(`  ${m.id}  CAUGHT   ✓   ${m.why}`); }
  }
} finally {
  for (const [f, src] of originals) writeFileSync(f, src);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
