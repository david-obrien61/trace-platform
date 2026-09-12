/**
 * ── channelVocabulary — ONE list, and the cap that makes the TS copy unable to drift ──────────
 *
 * WHY THIS FILE EXISTS (ledger #310 · R-152). A channel name was written in FOUR places. Two were
 * updated on 8 June 2026 and two were not, so the only UI that can enable a channel offered tiktok
 * and twitter while the table storing the generated post forbade them. The insert is one atomic
 * multi-row statement, so every batch died and `campaign_posts` was EMPTY on every tenant for three
 * months — a defect nobody saw because the campaign row committed separately and looked fine.
 *
 * §A IS THE LOAD-BEARING SECTION. TypeScript cannot read a database at compile time, so the TS list
 * is a COPY — and the only honest defence is a probe that fails in BOTH directions. §A parses the
 * migration's seed and asserts set equality. A name in one and not the other is red.
 *
 * PROBES BOTH DIRECTIONS (STD-022) and REACHES the shipped files with comments stripped
 * (tech-debt #182 — a probe that cannot reach its target reports the same as one that passed).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/channelVocabulary.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import {
  CHANNEL_NAMES, CHANNEL_COLUMNS, CHANNEL_SEED_MIGRATION, isChannelName,
} from './channelVocabulary';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}
const code = (s: string) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*|--)/.test(l)).join('\n');

const migration = readFileSync(CHANNEL_SEED_MIGRATION, 'utf8');

/** Parse the seeded names out of the INSERT. Comments stripped first so a name in prose cannot count. */
function seededNames(sql: string): string[] {
  const body = code(sql);
  // 🔴 THE BOUNDARY IS LOAD-BEARING. The first version of this regex was `public\.channels[\s\S]*?`
  // with no boundary, so it matched `INSERT INTO public.channels_renamed` as a PREFIX — mutant P1
  // renamed the table and the parse still succeeded, so the whole of §A passed on the wrong
  // statement. `\s*\(` pins it to this table's own INSERT. tech-debt #182's shape, in a regex.
  const m = body.match(/INSERT INTO public\.channels\s*\([\s\S]*?VALUES([\s\S]*?)ON CONFLICT/i);
  if (!m) return [];
  return [...m[1].matchAll(/\(\s*'([a-z0-9_]+)'\s*,/gi)].map(x => x[1]);
}

// ══ §A · THE BINDING — the TS list and the migration seed are the SAME SET ═══════════════════
console.log('\n§A — the TS list is bound to the migration seed');

const seeded = seededNames(migration);

// 🔴 REACHABILITY FIRST. If the parser returns nothing, every assertion below is vacuously true and
// the section becomes a rubber stamp — tech-debt #182's exact shape.
ok(seeded.length > 0, 'A0 the parser REACHED the seed (a zero-length parse makes §A meaningless)');
ok(seeded.length === 6, `A1 the migration seeds SIX channels (parsed ${seeded.length})`);

const inTs = new Set<string>(CHANNEL_NAMES as readonly string[]);
const inSql = new Set(seeded);

const missingFromTs = seeded.filter(n => !inTs.has(n));
const missingFromSql = [...inTs].filter(n => !inSql.has(n));

ok(missingFromTs.length === 0,
  `A2 🔴 every seeded channel is in CHANNEL_NAMES — missing: ${missingFromTs.join(', ')}`);
ok(missingFromSql.length === 0,
  `A3 🔴 every CHANNEL_NAMES entry is seeded — missing: ${missingFromSql.join(', ')}`);
ok(CHANNEL_NAMES.length === seeded.length, 'A4 the two lists are the same LENGTH (no duplicate hiding a gap)');
ok(new Set(CHANNEL_NAMES).size === CHANNEL_NAMES.length, 'A5 (negative) no duplicate in the TS list');
ok(new Set(seeded).size === seeded.length, 'A6 (negative) no duplicate in the seed');

// The four values the OLD stale union held, and the two it was missing — named explicitly, because
// these are the exact names the defect turned on.
ok(inTs.has('tiktok') && inSql.has('tiktok'),   'A7 tiktok is in BOTH — the value the old union rejected');
ok(inTs.has('twitter') && inSql.has('twitter'), 'A8 twitter is in BOTH — ditto');
ok(inTs.has('email') && inSql.has('email'),     'A9 email is in BOTH — it STAYS (R-152 ①)');

// ══ §B · THE RUNTIME GUARD ══════════════════════════════════════════════════════════════════
console.log('\n§B — isChannelName');

ok(isChannelName('instagram'), 'B1 a known name passes');
ok(isChannelName('email'),     'B2 email passes');
ok(isChannelName('tiktok'),    'B3 tiktok passes — it would have failed the old union');
ok(!isChannelName('myspace'),  'B4 (negative) an unknown name is refused');
ok(!isChannelName(''),         'B5 (negative) empty string is refused');
ok(!isChannelName(null),       'B6 (negative) null is refused, not coerced');
ok(!isChannelName(undefined),  'B7 (negative) undefined is refused');
ok(!isChannelName(42),         'B8 (negative) a non-string is refused');
ok(!isChannelName('INSTAGRAM'),'B9 (negative) it is case-SENSITIVE — the column stores lower case');

// ══ §C · THE MIGRATION ITSELF ═══════════════════════════════════════════════════════════════
console.log('\n§C — the migration does what the ruling says');

const msql = code(migration);
ok(/CREATE TABLE IF NOT EXISTS public\.channels/.test(msql), 'C1 creates public.channels');
ok(/REFERENCES public\.channels\(name\)/.test(msql), 'C2 at least one FK references it');
ok((msql.match(/REFERENCES public\.channels\(name\)/g) ?? []).length === 2,
  'C3 🔴 BOTH tables get the FK — campaign_posts and social_drafts');
ok(/DROP CONSTRAINT IF EXISTS campaign_posts_platform_check/.test(msql), 'C4 drops the auto-named CHECK');
ok(/DROP CONSTRAINT IF EXISTS social_drafts_platform_check/.test(msql),  'C5 drops the named CHECK');
ok(/ADD COLUMN IF NOT EXISTS subject text/.test(msql), 'C6 adds the subject column (R-152 ①)');
ok(!/subject text NOT NULL/.test(msql), 'C7 (negative) subject is NULLABLE — a caption has no subject (A9)');
ok(/CREATE TRIGGER business_modules_advert_channels_known/.test(msql), 'C8 the advert_channels trigger exists');
ok(/BEFORE INSERT OR UPDATE OF config/.test(msql), 'C9 it fires on INSERT and UPDATE, not just one');
ok(/ENABLE ROW LEVEL SECURITY/.test(msql), 'C10 RLS is on');
ok(/FOR SELECT TO authenticated/.test(msql), 'C11 authenticated may READ — the config UI depends on it');
ok(!/FOR (INSERT|UPDATE|DELETE)\s+TO/.test(msql), 'C12 (negative) NO client write policy — adding a channel is a migration');
// M7 escaped a bare match: there are TWO FKs and the mutant only changed one.
ok((msql.match(/ON DELETE RESTRICT/g) ?? []).length === 2,
  'C13 🔴 BOTH FKs are ON DELETE RESTRICT — a deleted channel must never erase the posts that used it');
ok(!/ON DELETE CASCADE/.test(msql), 'C13b (negative) no platform FK cascades a delete');
// M4 escaped a bare /RAISE EXCEPTION/: the PRE-FLIGHT block raises too, so removing the trigger's
// one left the pattern matching. Pin it to the trigger's own message.
ok(/RAISE EXCEPTION\s*\n?\s*'unknown channel name\(s\) in advert_channels/.test(msql),
  'C14 🔴 the TRIGGER itself RAISES on an unknown name — not a NOTICE, not a silent drop');
ok(/jsonb_typeof\(NEW\.config->'advert_channels'\) <> 'array'/.test(msql),
  'C15 a malformed shape is refused by name — otherwise the check passes vacuously (§6 r19)');
// M10 escaped a header-string match: 'PRE-FLIGHT 0' also appears inside the RAISE messages, so
// deleting the section header left the pattern matching. Assert the BLOCK and all three checks.
ok(/DO \$\$[\s\S]*?seeded text\[\][\s\S]*?END \$\$;/.test(msql),
  'C16 the pre-flight DO block exists');
ok((msql.match(/PRE-FLIGHT 0 FAILED/g) ?? []).length === 3,
  'C16b 🔴 it checks ALL THREE sites — campaign_posts, social_drafts, and live advert_channels');
// The header must say WHY advert_channels is a trigger and not an FK — David's instruction, so that
// a reader in six months does not file it as an oversight.
ok(/cannot declare a foreign key into a jsonb/i.test(migration),
  'C17 🔴 the jsonb limit is RECORDED as a known limit, not left to be mistaken for an oversight');
ok(/LEXICON|'platform' is reserved/i.test(migration),
  'C18 the channels-table / platform-column naming split is flagged in the header');

// ══ §D · THE SHIPPED CODE — the other three copies are GONE ═════════════════════════════════
console.log('\n§D — the four copies are one');

const types  = code(readFileSync('packages/shared/src/campaigns/types.ts', 'utf8'));
const setup  = code(readFileSync('packages/cultivar-os/src/pages/SocialSetup.tsx', 'utf8'));
const gen    = code(readFileSync('packages/shared/src/campaigns/generate.ts', 'utf8'));
const api    = code(readFileSync('packages/cultivar-os/api/campaigns.ts', 'utf8'));

ok(/platform: ChannelName;/.test(types), 'D1 🔴 COPY 4 GONE — types.ts uses the derived union');
ok(!/'instagram' \| 'facebook' \| 'sms' \| 'email'/.test(types), 'D2 the stale hand-typed union is gone');
ok(/subject: string \| null;/.test(types), 'D3 the post type carries a nullable subject');

ok(!/const SOCIAL_CHANNELS/.test(setup), 'D4 🔴 COPY 3 GONE — SocialSetup holds no channel list');
ok(/from\('channels'\)/.test(setup), 'D5 SocialSetup READS the table');
ok(/CHANNEL_COLUMNS/.test(setup), 'D6 it imports the column list rather than restating it (A4)');
ok(/reconcile\(/.test(setup), 'D7 a saved config is reconciled against the catalog, both directions');
// R-152's copy rule, asserted on the file rather than trusted.
ok(!/sending soon|coming soon|send it for you|auto-send/i.test(setup),
  'D8 🔴 NO surface copy implies direct send is coming (R-152)');
ok(/You send it; TRACE doesn/.test(setup), 'D9 it says plainly who sends');

ok(!/const CHANNEL_GUIDANCE/.test(gen), 'D10 🔴 the guidance map is GONE — it would have been a new copy');
ok(/ch\.guidance/.test(gen), 'D11 guidance comes off the channel');
// C6 escaped a name-only match: the mutant kept the constant and dropped 'email' from it.
ok(/ONE_PER_CAMPAIGN_KINDS: readonly string\[\] = \['sms', 'email'\]/.test(gen),
  'D12 🔴 sms AND EMAIL both get ONE message — email in a run of posts is the mutant');
ok(!/ch\.type === 'sms' \? 1/.test(gen), 'D13 (negative) the old sms-only test is gone');
ok(/"subject"/.test(gen), 'D14 the prompt asks for a subject');

ok(/from\('channels'\)/.test(api), 'D15 the endpoint reads the catalog');
// C7 escaped a bare identifier match: `isChannelName` also appears in the import and in the
// `unknown` log line, so removing the FILTER left it matching. Pin it to the filter.
ok(/\.filter\(c => isChannelName\(c\.name\)\)/.test(api),
  'D16 🔴 the configured list is FILTERED to known names before the atomic insert');
ok(/subject:\s+p\.subject/.test(api), 'D17 the insert writes the subject');

ok(CHANNEL_COLUMNS.includes('guidance'), 'D18 the column list carries guidance — the join needs it');

// ══ SUMMARY ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n${failed === 0 ? '✅' : '🔴'} channelVocabulary — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
