/**
 * ── measure-campaign-lifecycle-mutants — can the R-145/146/147 suite go red? ──────────
 *
 * PURPOSE:      A green suite is a claim until something proves it can fail. One deliberate edit at
 *               a time, re-run, report CAUGHT or SURVIVED. R-33 / CLAUDE.md §6 r19.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of ONE file, restored in `finally`.
 * OUTPUTS:      One line per mutant + CAUGHT/TOTAL. Exit 1 if any survived OR never applied.
 *
 * 🔴 GREEN CONTROL FIRST — without it every CAUGHT could be an already-red suite.
 * 🔴 EXIT CODE, never a grep for "FAIL" — a crash before any output is red, and a grep reads green.
 * 🔴 EVERY MUTANT IS VERIFIED TO HAVE APPLIED — a stale from-string would run the UNMUTATED module
 *    and report a triumphant 0/0. Reported as ERROR, never skipped (tech-debt #182).
 * 🔴 TWO MUTANTS CHANGE THE POPULATION, NOT THE SUBJECT (P1/P2) — tech-debt #182's named gap: a
 *    harness whose mutants all edit the thing under test never proves the probes REACH anything.
 *
 * Run: node scripts/measure-campaign-lifecycle-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const MOD    = ROOT + 'packages/shared/src/business-logic/campaignLifecycle.ts';
const LIST   = ROOT + 'packages/cultivar-os/src/pages/Campaigns.tsx';
const DETAIL = ROOT + 'packages/cultivar-os/src/pages/CampaignDetail.tsx';
const API    = ROOT + 'packages/cultivar-os/api/campaigns.ts';
const SUITE  = 'packages/shared/src/business-logic/campaignLifecycle.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ── R-145 · the lock ──────────────────────────────────────────────────────────────────────
  { id: 'M1', file: MOD, why: 'a copied post no longer locks the campaign — edit silently reopens',
    from: "const copiedCount = posts.filter(p => p.status === 'published').length;",
    to:   'const copiedCount = 0;' },
  { id: 'M2', file: MOD, why: 'the lock fires only when EVERY post is copied (off-by-all)',
    from: "const copiedCount = posts.filter(p => p.status === 'published').length;",
    to:   "const copiedCount = posts.length > 0 && posts.every(p => p.status === 'published') ? posts.length : 0;" },
  { id: 'M3', file: MOD, why: 'THE OVERCLAIM — the refusal tells her customers have seen it',
    from: '`TRACE cannot see where a copied post went, or whether you changed it after pasting it — so it ` +',
    to:   '`Your customers have seen these and they are published to your feed. ` +' },
  { id: 'M4', file: MOD, why: 'the lock stops naming the route out — refusal with no way forward',
    from: "    route: 'cancel-and-restart',",
    to:   '' },
  { id: 'M5', file: MOD, why: 'a locked campaign refuses with no explanation at all (D-9)',
    from: '    reason:\n      `You have copied ${copiedCount} of these ${copiedCount === 1 ? \'posts\' : \'posts\'} out of TRACE. ` +',
    to:   '    reason: undefined && `` ||\n      `` +' },

  // ── R-145 · the scope ─────────────────────────────────────────────────────────────────────
  { id: 'M6', file: MOD, why: 'the name becomes editable — identity drifts, last season is unfindable',
    from: "export const CAMPAIGN_EDITABLE_FIELDS = ['start_date', 'end_date', 'target_category'] as const;",
    to:   "export const CAMPAIGN_EDITABLE_FIELDS = ['start_date', 'end_date', 'target_category', 'name'] as const;" },
  { id: 'M7', file: MOD, why: 'the ask-bearing description becomes editable in a pass told not to touch it',
    from: "export const CAMPAIGN_EDITABLE_FIELDS = ['start_date', 'end_date', 'target_category'] as const;",
    to:   "export const CAMPAIGN_EDITABLE_FIELDS = ['start_date', 'end_date', 'target_category', 'description'] as const;" },
  { id: 'M8', file: MOD, why: 'the lock is checked AFTER scope, so a locked campaign reports a scope error',
    from: '  const lock = campaignEditLock(args.posts);\n  if (lock.locked) return { allowed: false, patch: {}, reason: lock.reason };',
    to:   '  const lock = { locked: false, copiedCount: 0, reason: undefined as string | undefined };\n  if (lock.locked) return { allowed: false, patch: {}, reason: lock.reason };' },
  { id: 'M9', file: MOD, why: 'an unchanged Save reports success and writes an empty patch (STD-023)',
    from: "    return { allowed: false, patch: {}, reason: 'Nothing changed.' };",
    to:   '    return { allowed: true, patch: {} };' },
  { id: 'M10', file: MOD, why: 'crossed dates reach the database as a constraint violation',
    from: "    return { allowed: false, patch: {}, reason: 'The end date is before the start date.' };",
    to:   '    return { allowed: true, patch };' },
  { id: 'M11', file: MOD, why: 'a blanked focus writes an empty string instead of NULL',
    from: "  return s === '' ? null : s;",
    to:   '  return s;' },

  // ── R-146 · cancel ────────────────────────────────────────────────────────────────────────
  { id: 'M12', file: MOD, why: 'cancel writes a value that is NOT in the CHECK constraint',
    from: "export const CAMPAIGN_CANCELLED = 'cancelled';",
    to:   "export const CAMPAIGN_CANCELLED = 'canceled';" },
  { id: 'M13', file: MOD, why: 'a completed campaign can be cancelled — history rewritten',
    from: "  if (campaign.status === 'completed') {",
    to:   "  if (false && campaign.status === 'completed') {" },
  { id: 'M14', file: MOD, why: 'cancelling an already-cancelled campaign is allowed (double write)',
    from: '  if (campaign.status === CAMPAIGN_CANCELLED) {',
    to:   '  if (false && campaign.status === CAMPAIGN_CANCELLED) {' },

  // ── R-147 · append ────────────────────────────────────────────────────────────────────────
  { id: 'M15', file: MOD, why: 'THE ORIGINAL DEFECT — an id still takes the CREATE branch',
    from: "  return { mode: 'append', campaignId: id, navigate: false };",
    to:   "  return { mode: 'create', navigate: true };" },
  { id: 'M16', file: MOD, why: 'append gets the table right and STILL walks the owner onto a new page',
    from: "  return { mode: 'append', campaignId: id, navigate: false };",
    to:   "  return { mode: 'append', campaignId: id, navigate: true };" },
  { id: 'M17', file: MOD, why: 'a whitespace id appends to a campaign named "   "',
    from: "  const id = typeof campaignId === 'string' ? campaignId.trim() : '';",
    to:   "  const id = typeof campaignId === 'string' ? campaignId : '';" },

  // ── the claim ─────────────────────────────────────────────────────────────────────────────
  { id: 'M18', file: MOD, why: 'THE LIE ITSELF — zero posts falls through to the done claim',
    from: "  if (total <= 0) return { tone: 'empty', text: 'No posts yet — open to generate' };",
    to:   '' },
  { id: 'M19', file: MOD, why: 'the done claim fires when posts are merely not drafts',
    from: '  if (published >= total) {',
    to:   '  if (true) {' },
  { id: 'M20', file: MOD, why: 'a partial campaign is rounded UP to done',
    from: "  return { tone: 'partial', text: `${published} of ${total} posts published` };",
    to:   "  return { tone: 'done', text: `All ${total} posts published ✓` };" },
  { id: 'M21', file: MOD, why: 'the negative total crashes instead of reading empty',
    from: '  if (total <= 0) return',
    to:   '  if (total === 0) return' },

  // ── P · POPULATION MUTANTS — do §F's probes REACH the shipped files? (tech-debt #182) ──────
  { id: 'P1', file: LIST, why: 'POPULATION — the list stops asking the shared claim and hardcodes one',
    from: '                  const claim = campaignPostClaim({',
    to:   '                  const claim = { tone: \'done\' as const, text: \'All posts published ✓\' } ?? campaignPostClaim({' },
  { id: 'P2', file: DETAIL, why: 'POPULATION — generate-more stops sending the campaign id',
    from: "        body: JSON.stringify({ action: 'generate', businessId, campaignId: id }),",
    to:   "        body: JSON.stringify({ action: 'generate', businessId })," },
  { id: 'P3', file: API, why: 'POPULATION — the endpoint stops branching on the plan',
    from: "      if (plan.mode === 'append') {\n        targetId = plan.campaignId!;",
    to:   "      if (false) {\n        targetId = plan.campaignId!;" },
  { id: 'P4', file: DETAIL, why: 'POPULATION — the silent catch comes back',
    from: '    } catch (e: any) {\n      setGenError(e.message ?? \'Could not generate more posts.\');\n    }',
    to:   '    } catch { /* silent */ }' },
];

const originals = new Map();
for (const f of [MOD, LIST, DETAIL, API]) originals.set(f, readFileSync(f, 'utf8'));

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
