/**
 * ── normalisationConsent — asking once, about their data, in their words ──────────────
 *
 * 🔴 THE FAILURE THIS IS MOST LIKELY TO BE BUILT AS is a fixed taxonomy: a hardcoded map that
 * works at one nursery and is wrong at the next. §A asserts the file contains no vocabulary at
 * all. The second failure is subtler and worse: offering a SUGGESTION on a question only the
 * owner can answer, which is us answering it and calling it a default.
 *
 * §A  it is a mechanism — no size vocabulary anywhere in the module
 * §B  only groups worth asking about are returned
 * §C  the suggestion is the commonest spelling, and the WHY is computed
 * §D  🔴 a MEANING question carries no suggestion
 * §E  🔴 an unrecognised label is a FINDING, returned even when it appears once
 * §F  raw labels are preserved verbatim
 * §G  the audit row records SUGGESTED and CHOSEN, and a blank as an answer
 * §H  determinism
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/inventory/normalisationConsent.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { groupSizeVariants, auditRowFor, NORMALISATION_AUDIT_ACTION } from './normalisationConsent';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}
const rows = (...sizes: (string | null)[]) => sizes.map(size => ({ size }));
const rep = (label: string, n: number) => Array.from({ length: n }, () => ({ size: label }));

// ── §A a mechanism, not a vocabulary ─────────────────────────────────────────
{
  // The module is read as TEXT. If it names a size, it is a taxonomy pretending to be a rule.
  // (Bundled source is inspected rather than the file, so this holds after any build step.)
  // Read from the repo root, which is where the test runner executes — `__dirname` is not
  // meaningful for a bundle piped through stdin.
  const src = readFileSync('packages/shared/src/inventory/normalisationConsent.ts', 'utf8');
  const code = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  const VOCAB = /'[^']*\b(gallon|gal|quart|qrt|yard|scoop|caliper|inch|lb|bag|box)\b[^']*'/i;
  ok(!VOCAB.test(code),
    '🔴 the module names NO size anywhere in its code — a hardcoded `30 Gallon → 30 gal` map works at one nursery and is wrong at the next');
}

// ── §B only groups worth asking about ────────────────────────────────────────
{
  // One meaning, one spelling, 500 rows. Nothing to choose.
  const g = groupSizeVariants(rep('15 gal', 500));
  ok(g.length === 0,
    '🔴 a size written exactly ONE way produces NO question — a tidy catalogue is asked nothing, and the number of questions is a function of how messy their data is');
}
{
  const g = groupSizeVariants([...rep('30 gal', 200), ...rep('30 Gallon', 14)]);
  ok(g.length === 1 && g[0].kind === 'spelling', 'two spellings of one meaning is one spelling question');
  ok(g[0].population === 214, 'and it names its population — 214 items');
  ok(g[0].variants.length === 2, 'carrying both spellings');
}

// ── §C the suggestion, and the computed WHY ──────────────────────────────────
{
  const g = groupSizeVariants([...rep('30 gal', 200), ...rep('30 Gallon', 14)])[0];
  ok(g.suggestion === '30 gal', 'the suggestion is the commonest spelling — the default is already theirs');
  ok(g.why !== null && g.why.includes('200') && g.why.includes('214'),
    '🔴 the WHY is computed from their own data and names both numbers — we report what they mostly do, we do not tell them what to do');
}
{
  // Flip the counts: the suggestion must follow the data, not a preference for shorter strings.
  const g = groupSizeVariants([...rep('30 gal', 14), ...rep('30 Gallon', 200)])[0];
  ok(g.suggestion === '30 Gallon',
    '🔴 flip which spelling is commonest and the suggestion flips — the negative control, without which the probe above passes on a hardcoded favourite');
}

// ── §D 🔴 a MEANING question carries no suggestion ───────────────────────────
{
  const g = groupSizeVariants(rep('#3/5', 40));
  ok(g.length === 1 && g[0].kind === 'meaning',
    'a size that parses to a RANGE is a MEANING question, not a spelling one');
  ok(g[0].suggestion === null && g[0].why === null,
    '🔴 and it carries NO suggestion — whether #3 and #5 are one product or two is a fact about his business, and offering a default is answering it for him');
  ok(/not about spelling|have not guessed/i.test(g[0].question),
    'the question says so out loud, so it does not read as a spelling question he can wave through');
}

// ── §E 🔴 unrecognised is a FINDING, not an error ────────────────────────────
{
  const g = groupSizeVariants(rows('2 qrt'));
  ok(g.length === 1 && g[0].kind === 'unrecognised',
    '🔴 an unrecognised label is returned even though it appears ONCE — the point is telling them we could not read it');
  ok(g[0].suggestion === null, 'with no suggestion');
  ok(/do not know|leave it/i.test(g[0].question),
    'and it invites them to leave it — a blank is an answer, not an unfinished task');
}
{
  const g = groupSizeVariants(rows(null, '', '   '));
  ok(g.length === 0, 'an ABSENT size is not a spelling question and produces nothing at all');
}

// ── §F raw labels preserved ──────────────────────────────────────────────────
{
  const g = groupSizeVariants([...rep('  30 Gallon  ', 3), ...rep('30 gal', 9)])[0];
  const labels = g.variants.map(v => v.label);
  ok(labels.includes('30 Gallon') && labels.includes('30 gal'),
    'labels come back as typed (trimmed of surrounding blanks only) — the raw value is the evidence and is never rewritten (R-50)');
  ok(!labels.some(l => l !== l.trim()), 'and surrounding whitespace is not carried into a display suggestion');
}

// ── §G the audit row ─────────────────────────────────────────────────────────
{
  const at = new Date('2026-09-03T10:00:00.000Z');
  const r = auditRowFor({ businessId: 'b1', actorUserId: 'u1', at,
    choice: { groupKey: 'u:container:30::gallon', suggested: '30 gal', chosen: '30 Gallon',
              population: 214, variants: ['30 gal', '30 Gallon'] } });
  ok(r.action === NORMALISATION_AUDIT_ACTION, 'the action is the controlled vocabulary string');
  ok(r.detail.suggested === '30 gal' && r.detail.chosen === '30 Gallon',
    '🔴 it records BOTH what was suggested and what was chosen — "owner chose X" is a setting; the pair is how the standard was arrived at');
  ok(r.detail.population === 214, 'and the population it was applied to');
  ok(r.detail.accepted === false,
    'a suggestion the owner OVERRODE is recorded as overridden, which is the most useful row in the log');
  ok(r.business_id === 'b1' && r.actor_user_id === 'u1' && r.outcome === 'success',
    'tenant-scoped and attributed to the actor');
  const json = JSON.stringify(r);
  ok(!/@|street|phone|address/i.test(json), '⚠️ no casual PII reaches `detail` — sizes and counts only');
}
{
  const at = new Date('2026-09-03T10:00:00.000Z');
  const r = auditRowFor({ businessId: 'b1', actorUserId: null, at,
    choice: { groupKey: 'k', suggested: '30 gal', chosen: null, population: 9, variants: ['30 gal','#30'] } });
  ok(r.detail.left_as_is === true && r.detail.accepted === false,
    '🔴 declining is recorded AS a decision — otherwise the next import cannot tell "they said leave it" from "nobody asked", and the question returns forever');
}

// ── §H determinism ───────────────────────────────────────────────────────────
{
  const input = [...rep('30 gal', 5), ...rep('#30', 5), ...rep('15 gal', 9), ...rep('15 Gallon', 1)];
  const a = groupSizeVariants(input).map(g => g.key).join('|');
  const b = groupSizeVariants([...input].reverse()).map(g => g.key).join('|');
  ok(a === b,
    '🔴 the same catalogue in a different order produces the same questions in the same order — otherwise which spelling gets suggested depends on row order');
  const tie = groupSizeVariants([...rep('30 gal', 5), ...rep('#30', 5)])[0];
  const tie2 = groupSizeVariants([...rep('#30', 5), ...rep('30 gal', 5)])[0];
  ok(tie.suggestion === tie2.suggestion, 'and an exact TIE resolves the same way both times, rather than by whichever was seen first');
}

console.log(`\n  normalisationConsent — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
