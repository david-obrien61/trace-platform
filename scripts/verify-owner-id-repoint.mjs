#!/usr/bin/env node
/**
 * capR2 — THE 49 owner_id POLICIES: THE PLAN AND THE MIGRATION MUST AGREE, BOTH DIRECTIONS.
 *
 * PURPOSE:      `docs/decisions/2026-09-10-owner-id-repoint-plan.md` states a disposition for every
 *               one of the 49 live policies that compare `businesses.owner_id` raw.
 *               `supabase/migrations/20260910b_owner_id_policies_become_permissions.sql` is supposed
 *               to be that plan, executed. This asserts they are the same document.
 * DEPENDENCIES: none (zero-dependency node, like every other cap here). Reads two files.
 * OUTPUTS:      exit 0 / exit 1 + a named failure per row.
 *
 * ════ WHY IT EXISTS — #179, AND IT IS THE ONLY MECHANISM THAT COULD HAVE CAUGHT IT ════
 * `VENDORS_SELECT` named TEN columns while its migration created FOURTEEN, and the four missing
 * were the address. Nothing we own could see it: a declarative list that disagrees with what it
 * describes is invisible to tsc, eslint, knip and every probe, because BOTH halves parse. The cure
 * is not more care — it is to PARSE THE LIST and compare it to the thing, in BOTH directions:
 *   · a plan row with no matching statement  → the migration forgot it
 *   · a statement naming a policy the plan does not → the migration did something nobody decided
 *
 * ════ §6 r19 — A CHECK THAT CANNOT DISAGREE IS NOT A CHECK ════
 * `--self-test` plants eight engineered-bad inputs and requires every one to be REJECTED. If a
 * detector stops detecting, this fails BEFORE it reports on the real files, so a green here can
 * never mean "the checker quietly broke".
 *
 * ════ THE M10 LESSON, PAID FOR BY capA ════
 * SQL comments are STRIPPED before anything is matched. This migration's header discusses
 * `bpc_member_insert`, `cost_objects_owner_all` and every other policy name IN PROSE. A cap that
 * reads prose reports fiction — capA's assertion 3 reported "sql 0" off a header that merely
 * MENTIONED its own marker.
 */
import { readFileSync, existsSync } from 'node:fs';

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', B = '\x1b[1m', O = '\x1b[0m', DIM = '\x1b[2m';
const PLAN = 'docs/decisions/2026-09-10-owner-id-repoint-plan.md';
const MIG  = 'supabase/migrations/20260910b_owner_id_policies_become_permissions.sql';
const MANIFEST = 'packages/shared/src/auth/permissionManifest.ts';
const ACCEPT = 'docs/decisions/2026-09-10-owner-id-repoint-acceptance.sql';
const BOARD  = 'docs/owner-tests/owner-id-policy-repoint-full-surface-test.md';
const MINTED = ['accounting:connect', 'devices:manage'];

/** Strip `--` line comments. PURE — probed. */
export const stripSql = (t) => t.replace(/--[^\n]*/g, '');

/**
 * The disposition table. PURE — probed.
 * Rows look like: | 7 | `business_inventory` | `business_inventory_owner_all` | ALL | **DROP** | — | why |
 */
export function parsePlan(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*\*\*(\w+)\*\*\s*\|\s*(?:`([^`]+)`|—)\s*\|/);
    if (!m) continue;
    const row = { table: m[1], policy: m[2], cmd: m[3], disposition: m[4], perm: m[5] ?? null, split: null };
    // A per-verb split states its verbs IN the string cell: `INSERT=res:create · DELETE=res:update`.
    // Parsed rather than inferred, so the doc stays the source and the migration stays the copy.
    if (row.perm && row.perm.includes('=')) {
      row.split = Object.fromEntries(row.perm.split('·').map((x) => x.trim().split('=')));
      row.perm = null;
    }
    rows.push(row);
  }
  return rows;
}

/** Every executable CREATE/DROP POLICY in the migration, comments removed. PURE — probed. */
export function parseMigration(sqlText) {
  const sql = stripSql(sqlText);
  const creates = [...sql.matchAll(/CREATE\s+POLICY\s+(\w+)\s+ON\s+public\.(\w+)([\s\S]*?);/gi)]
    .map((m) => ({ policy: m[1], table: m[2], body: m[3] }));
  const drops = [...sql.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(\w+)\s+ON\s+public\.(\w+)/gi)]
    .map((m) => ({ policy: m[1], table: m[2] }));
  const comments = [...sql.matchAll(/COMMENT\s+ON\s+POLICY\s+(\w+)\s+ON\s+public\.(\w+)/gi)]
    .map((m) => ({ policy: m[1], table: m[2] }));
  return { creates, drops, comments, sql };
}

/**
 * THE COMPARISON, both directions. PURE — probed.
 * @returns string[] of failures; empty means agree.
 */
export function reconcile(plan, mig) {
  const fail = [];
  const byName = (arr, p, t) => arr.filter((x) => x.policy === p && x.table === t);
  const seen = new Set();

  for (const r of plan) {
    const key = `${r.table}.${r.policy}`;
    const created = byName(mig.creates, r.policy, r.table);
    const dropped = byName(mig.drops, r.policy, r.table);
    const commented = byName(mig.comments, r.policy, r.table);
    seen.add(key);

    if (r.disposition === 'REPOINT' || r.disposition === 'REPOINT_PLUS_SELECT') {
      if (created.length !== 1) { fail.push(`${key}: plan says ${r.disposition} but the migration CREATEs it ${created.length} time(s)`); continue; }
      if (dropped.length !== 1) fail.push(`${key}: repointed without a DROP POLICY IF EXISTS first — CREATE would fail on an existing name`);
      const body = created[0].body;
      if (!body.includes(`has_permission(`)) fail.push(`${key}: repointed policy does not call has_permission`);
      if (!r.perm || !body.includes(`'${r.perm}'`)) fail.push(`${key}: plan names '${r.perm}' and the policy body does not contain it`);
      if (/owner_id/.test(body)) fail.push(`${key}: repointed policy STILL compares owner_id`);
      if (!body.includes('is_active_member(')) fail.push(`${key}: repointed policy omits is_active_member`);
      if (r.disposition === 'REPOINT_PLUS_SELECT') {
        const sel = byName(mig.creates, `${r.table}_member_select`, r.table);
        if (sel.length !== 1) fail.push(`${key}: REPOINT_PLUS_SELECT but no ${r.table}_member_select is created`);
        else {
          if (/owner_id/.test(sel[0].body)) fail.push(`${key}: the added read policy compares owner_id`);
          if (sel[0].body.includes(`'${r.perm}'`)) fail.push(`${key}: the added read policy tests the WRITE string '${r.perm}' — a read gated on a write string is the defect, not the fix`);
        }
        seen.add(`${r.table}.${r.table}_member_select`);
      }
    } else if (r.disposition === 'REPOINT_SPLIT') {
      // 🔴 THE POINT OF THIS DISPOSITION: the old FOR ALL policy is GONE, and each verb it spanned
      // is gated on its OWN string. A cap that only checked "some policy exists" would pass a
      // migration that quietly recreated the FOR ALL, which is the thing being avoided.
      if (dropped.length !== 1) fail.push(`${key}: REPOINT_SPLIT and the migration does not DROP the FOR ALL policy`);
      if (created.length !== 0) fail.push(`${key}: REPOINT_SPLIT must NOT recreate the FOR ALL policy — that is the widening the split exists to prevent`);
      if (!r.split || Object.keys(r.split).length === 0) { fail.push(`${key}: REPOINT_SPLIT names no verbs in the plan table`); continue; }
      for (const [cmd, perm] of Object.entries(r.split)) {
        const name = `${r.table}_member_${cmd.toLowerCase()}`;
        const made = byName(mig.creates, name, r.table);
        seen.add(`${r.table}.${name}`);
        if (made.length !== 1) { fail.push(`${key}: the plan splits ${cmd} onto ${name} and the migration creates it ${made.length} time(s)`); continue; }
        const body = made[0].body;
        if (!new RegExp(`FOR\\s+${cmd}\\b`, 'i').test(body)) fail.push(`${r.table}.${name}: is not FOR ${cmd}`);
        if (!body.includes(`'${perm}'`)) fail.push(`${r.table}.${name}: plan names '${perm}' and the policy body does not contain it`);
        if (/owner_id/.test(body)) fail.push(`${r.table}.${name}: still compares owner_id`);
        if (!body.includes('is_active_member(')) fail.push(`${r.table}.${name}: omits is_active_member`);
        if (/FOR\s+ALL/i.test(body)) fail.push(`${r.table}.${name}: a split policy must never be FOR ALL`);
      }
    } else if (r.disposition === 'SPLIT_INSERT_ONLY') {
      if (dropped.length !== 1) fail.push(`${key}: plan says SPLIT_INSERT_ONLY and the migration does not DROP it`);
      if (created.length !== 0) fail.push(`${key}: SPLIT_INSERT_ONLY must NOT recreate the FOR ALL policy under its old name`);
      const ins = mig.creates.filter((c) => c.policy === 'bpc_owner_insert');
      if (ins.length !== 1) fail.push(`${key}: bpc_owner_insert is not created`);
      else {
        if (!/FOR\s+INSERT/i.test(ins[0].body)) fail.push(`${key}: bpc_owner_insert is not FOR INSERT`);
        if (!/owner_id/.test(ins[0].body)) fail.push(`${key}: bpc_owner_insert must stay on raw owner_id`);
        if (/has_permission/.test(ins[0].body)) fail.push(`${key}: bpc_owner_insert must NOT be repointed at a permission`);
      }
      if (/\bbpc_member_insert\b/.test(mig.sql)) fail.push(`${key}: the migration creates or references bpc_member_insert in EXECUTABLE SQL — the one thing the instruction forbids (capP assertion 5)`);
      seen.add('business_pricing_config.bpc_owner_insert');
    } else if (r.disposition === 'DROP') {
      if (dropped.length !== 1) fail.push(`${key}: plan says DROP and the migration does not drop it`);
      if (created.length !== 0) fail.push(`${key}: plan says DROP and the migration re-creates it`);
    } else if (r.disposition.startsWith('KEEP')) {
      if (dropped.length !== 0 || created.length !== 0) fail.push(`${key}: plan says ${r.disposition} — the migration must not DROP or CREATE it`);
      if (commented.length !== 1) fail.push(`${key}: kept raw owner_id WITHOUT the comment saying why — the comment IS the change (§6 r18: a residue that reads as a leftover gets tidied away)`);
    } else if (r.disposition === 'UNTOUCHED') {
      if (dropped.length !== 0 || created.length !== 0 || commented.length !== 0) fail.push(`${key}: plan says UNTOUCHED (table pending DROP) and the migration touches it`);
    } else {
      fail.push(`${key}: unknown disposition '${r.disposition}'`);
    }
  }

  // ── THE OTHER DIRECTION: nothing the migration touches may be absent from the plan ──
  for (const s of [...mig.creates, ...mig.drops, ...mig.comments]) {
    if (!seen.has(`${s.table}.${s.policy}`)) {
      fail.push(`${s.table}.${s.policy}: the migration touches a policy the plan does not account for`);
    }
  }
  return fail;
}

/** The $OWNER$ literal carried by this migration. PURE — probed. */
export function ownerLiteral(sqlText) {
  const m = stripSql(sqlText).match(/\$OWNER\$\[([\s\S]*?)\]\$OWNER\$/);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
}

/**
 * The runnable SQL out of the acceptance file (everything from the first `WITH plan(`). PURE — probed.
 */
export const runnableSql = (accText) => {
  const i = accText.indexOf('WITH plan(');
  return i < 0 ? null : accText.slice(i).trim();
};

/**
 * The ```sql fence belonging to CARD 1 — ANCHORED, not positional. PURE — probed.
 *
 * ⚠️ THE FIRST DRAFT TOOK "the first ```sql fence in the file" AND THAT WAS WRONG IN A WAY ITS OWN
 * MUTANT EXPOSED BY ACCIDENT. The board carries SIX sql fences; a mutation that removed the `sql`
 * tag from CARD 1's fence did not report "no fence", it silently compared CARD 3's block instead
 * and failed for the wrong reason. It happened to fail — but a check that lands on a DIFFERENT
 * block than the one it names is #182's class, and the next edit that adds a query above CARD 1
 * would have made it compare the wrong thing and pass. Anchored to the heading it is about.
 */
export const firstSqlFence = (mdText) => {
  const i = mdText.indexOf('### CARD 1 —');
  if (i < 0) return null;
  const end = mdText.indexOf('\n### ', i + 1);
  const card = mdText.slice(i, end < 0 ? undefined : end);
  const m = card.match(/```sql\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
};

/**
 * 🔴 THE BOARD'S INLINE COPY MUST BE THE ACCEPTANCE FILE, CHARACTER FOR CHARACTER. PURE — probed.
 *
 * WHY THIS ASSERTION EXISTS AND WHY IT IS NOT PARANOIA (2026-09-10). The card used to say "paste
 * `docs/decisions/…-acceptance.sql`", and David does not hunt for files — he works in the Supabase
 * SQL editor and the app. A card he cannot act on is a card that never runs, which is the same
 * class as the terminal cards corrected the day before. So the SQL now lives IN the card.
 *
 * That creates a second representation of one fact (STD-011), and the redundant copy is always the
 * one that drifts — a card that pastes cleanly and quietly asks the WRONG question is worse than a
 * file hunt, because it reports a number nobody can trace. This makes the two halves one document:
 * edit either and the build fails until they agree.
 */
export function boardMatchesAcceptance(accText, mdText) {
  const want = runnableSql(accText);
  const got = firstSqlFence(mdText);
  if (!want) return 'the acceptance file contains no `WITH plan(` — nothing to compare';
  if (!got) return 'CARD 1 carries no ```sql fence — the query is not inline any more, so the card is a file hunt again';
  if (want !== got) return 'the board\'s inline SQL and the acceptance file have DRIFTED — the card would paste cleanly and ask a different question than the file everyone else reads';
  return null;
}

/** A minted string must state its status LITERALLY, never lean on buildManifest's default. PURE — probed. */
export function mintedStatesStatus(manifestSrc, perm) {
  const i = manifestSrc.indexOf(`'${perm}': {`);
  if (i < 0) return false;
  const block = manifestSrc.slice(i, manifestSrc.indexOf('\n  },', i));
  return /^\s*status: '(?:enforced|declared-unwired|derived|planned)',\s*$/m.test(block);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — eight planted-bad inputs. Every one MUST be rejected (§6 r19b).
// ════════════════════════════════════════════════════════════════════════════════════════════════
const GOOD_PLAN = `
| 1 | \`t1\` | \`p1\` | ALL | **REPOINT** | \`res:update\` |  |
| 2 | \`t2\` | \`p2\` | ALL | **DROP** | — | redundant |
| 3 | \`t3\` | \`p3\` | ALL | **KEEP** | — | entity |
`;
const SPLIT_PLAN = `
| 4 | \`t4\` | \`p4\` | ALL | **REPOINT_SPLIT** | \`INSERT=res:create · DELETE=res:update\` | widening |
`;
const SPLIT_MIG = `
DROP POLICY IF EXISTS p4 ON public.t4;
DROP POLICY IF EXISTS t4_member_insert ON public.t4;
CREATE POLICY t4_member_insert ON public.t4 FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(t4.business_id) AND public.has_permission(t4.business_id, 'res:create'));
DROP POLICY IF EXISTS t4_member_delete ON public.t4;
CREATE POLICY t4_member_delete ON public.t4 FOR DELETE TO authenticated
  USING (public.is_active_member(t4.business_id) AND public.has_permission(t4.business_id, 'res:delete_x'));
`.replace('res:delete_x', 'res:update');
const GOOD_MIG = `
-- prose mentioning p2 and p9 and 'res:update' must not count
DROP POLICY IF EXISTS p1 ON public.t1;
CREATE POLICY p1 ON public.t1 FOR ALL TO authenticated
  USING (public.is_active_member(t1.business_id) AND public.has_permission(t1.business_id, 'res:update'))
  WITH CHECK (public.is_active_member(t1.business_id) AND public.has_permission(t1.business_id, 'res:update'));
DROP POLICY IF EXISTS p2 ON public.t2;
COMMENT ON POLICY p3 ON public.t3 IS 'entity';
`;
function selfTest() {
  const run = (plan, mig) => reconcile(parsePlan(plan), parseMigration(mig));
  const cases = [
    ['S1 clean input is ACCEPTED', () => run(GOOD_PLAN, GOOD_MIG).length === 0],
    ['S2 a REPOINT row with no CREATE is rejected',
      () => run(GOOD_PLAN, GOOD_MIG.replace(/CREATE POLICY p1[\s\S]*?;\n/, '')).length > 0],
    ['S3 a repoint that still compares owner_id is rejected',
      () => run(GOOD_PLAN, GOOD_MIG.replace("public.has_permission(t1.business_id, 'res:update')", 'b.owner_id = auth.uid()')).length > 0],
    ['S4 a repoint testing the WRONG string is rejected',
      () => run(GOOD_PLAN, GOOD_MIG.replace(/'res:update'/g, "'res:read'")).length > 0],
    ['S5 a DROP row the migration re-creates is rejected',
      () => run(GOOD_PLAN, GOOD_MIG + '\nCREATE POLICY p2 ON public.t2 FOR ALL USING (true);').length > 0],
    ['S6 a KEEP row with no COMMENT is rejected',
      () => run(GOOD_PLAN, GOOD_MIG.replace(/COMMENT ON POLICY p3[^\n]*\n/, '')).length > 0],
    ['S7 a policy the migration touches but the plan does not name is rejected',
      () => run(GOOD_PLAN, GOOD_MIG + '\nDROP POLICY IF EXISTS p9 ON public.t9;').length > 0],
    ['S9 REPOINT_SPLIT: a missing per-verb policy is rejected',
      () => run(SPLIT_PLAN, SPLIT_MIG.replace(/CREATE POLICY t4_member_delete[\s\S]*?;\n/, '')).length > 0],
    ['S10 REPOINT_SPLIT: recreating the FOR ALL policy is rejected',
      () => run(SPLIT_PLAN, SPLIT_MIG + '\nCREATE POLICY p4 ON public.t4 FOR ALL TO authenticated USING (public.is_active_member(t4.business_id) AND public.has_permission(t4.business_id, \'res:update\'));').length > 0],
    ['S11 REPOINT_SPLIT: a clean split is ACCEPTED', () => run(SPLIT_PLAN, SPLIT_MIG).length === 0],
    ['S12 board/acceptance: identical text is ACCEPTED',
      () => boardMatchesAcceptance('-- hi\nWITH plan(a) AS (VALUES (1)) SELECT 1;', '### CARD 1 — x\n```sql\nWITH plan(a) AS (VALUES (1)) SELECT 1;\n```\n') === null],
    ['S13 board/acceptance: ONE CHANGED CHARACTER is rejected',
      () => boardMatchesAcceptance('WITH plan(a) AS (VALUES (1)) SELECT 1;', '### CARD 1 — x\n```sql\nWITH plan(a) AS (VALUES (2)) SELECT 1;\n```\n') !== null],
    ['S14 board/acceptance: a board with NO sql fence is rejected (the file hunt is back)',
      () => boardMatchesAcceptance('WITH plan(a) AS (VALUES (1)) SELECT 1;', 'no fence here') !== null],
    ['S15 board/acceptance: the fence is read from CARD 1, not from whichever card comes first',
      () => boardMatchesAcceptance('WITH plan(a) AS (VALUES (1)) SELECT 1;',
        '### CARD 9 — decoy\n```sql\nWITH plan(a) AS (VALUES (1)) SELECT 1;\n```\n### CARD 1 — real\n```sql\nWITH plan(a) AS (VALUES (99)) SELECT 1;\n```\n') !== null],
    ['S16 board/acceptance: CARD 1 present but carrying NO fence is rejected',
      () => boardMatchesAcceptance('WITH plan(a) AS (VALUES (1)) SELECT 1;',
        '### CARD 1 — real\nno sql here\n### CARD 2 — x\n```sql\nWITH plan(a) AS (VALUES (1)) SELECT 1;\n```\n') !== null],
    ['S8 PROSE ONLY does not satisfy a row — comments are stripped',
      () => run(GOOD_PLAN, GOOD_MIG.replace(/^DROP POLICY IF EXISTS p2 ON public\.t2;$/m, '-- DROP POLICY IF EXISTS p2 ON public.t2;')).length > 0],
  ];
  const dead = cases.filter(([, f]) => { try { return !f(); } catch { return true; } }).map(([n]) => n);
  return dead;
}

// ── RUN ─────────────────────────────────────────────────────────────────────────────────────────
console.log(`${B}capR2 — the owner_id repoint plan and its migration are one document${O}`);

const dead = selfTest();
if (dead.length) {
  console.error(`${RED}${B}✗ capR2 SELF-TEST FAILED${O} — ${dead.length} detector(s) did not reject planted bad input:`);
  for (const d of dead) console.error(`  ${RED}·${O} ${d}`);
  console.error(`${DIM}  A checker that cannot refuse is not a checker (§6 r19). Refusing to report on the real files.${O}`);
  process.exit(1);
}
console.log(`  ${GRN}ok  ${O} self-test — 16 planted inputs, 16 rejected/accepted as specified`);

if (process.argv.includes('--self-test')) process.exit(0);

if (!existsSync(PLAN) || !existsSync(MIG)) {
  console.error(`${RED}✗ capR2${O} — ${PLAN} or ${MIG} is missing. This cap is the only thing asserting they agree.`);
  process.exit(1);
}

const plan = parsePlan(readFileSync(PLAN, 'utf8'));
const mig = parseMigration(readFileSync(MIG, 'utf8'));
const failures = reconcile(plan, mig);

// ── the population check: #182's class. A cap that never states an expectation for its own count
//    cannot tell "reached nothing" from "everything passed".
if (plan.length !== 49) {
  failures.push(`the plan table parsed ${plan.length} rows and the triage found 49 raw owner_id policies — the population moved, or the table shape changed and the parser is reading past it`);
}

const owner = ownerLiteral(readFileSync(MIG, 'utf8'));
if (!owner) failures.push('the migration carries no $OWNER$ literal — the two minted strings reach no permission array and ship INERT');
else {
  if (owner.length !== 59) failures.push(`the $OWNER$ literal carries ${owner.length} strings, expected 59 (57 + the two minted)`);
  for (const p of MINTED) if (!owner.includes(p)) failures.push(`minted string '${p}' is not in the $OWNER$ literal — it would ship inert, and the policies gating on it would admit NOBODY`);
}

const manifestSrc = readFileSync(MANIFEST, 'utf8');
for (const p of MINTED) {
  if (!manifestSrc.includes(`'${p}': {`)) failures.push(`minted string '${p}' is not in the manifest`);
  else if (!mintedStatesStatus(manifestSrc, p)) failures.push(`minted string '${p}' does not STATE its status — buildManifest defaults an unspecified verb to 'enforced' (:722-725), and that default is how a false claim became invisible on pricing_recipe:update`);
}

// ── THE CARD MUST CARRY THE QUERY, AND IT MUST BE THE SAME QUERY ────────────────────────────────
if (!existsSync(ACCEPT)) failures.push(`${ACCEPT} is missing — the acceptance query is the deliverable`);
else if (!existsSync(BOARD)) failures.push(`${BOARD} is missing`);
else {
  const drift = boardMatchesAcceptance(readFileSync(ACCEPT, 'utf8'), readFileSync(BOARD, 'utf8'));
  if (drift) failures.push(drift);
}

const d = plan.reduce((a, r) => ((a[r.disposition] = (a[r.disposition] ?? 0) + 1), a), {});
console.log(`  ${DIM}plan: ${plan.length} policies · ${Object.entries(d).map(([k, v]) => `${k} ${v}`).join(' · ')}${O}`);
console.log(`  ${DIM}migration: ${mig.creates.length} CREATE · ${mig.drops.length} DROP · ${mig.comments.length} COMMENT (comments stripped before matching)${O}`);

if (failures.length) {
  console.error(`\n${RED}${B}✗ capR2 FAILED${O} — ${failures.length} disagreement(s):`);
  for (const f of failures) console.error(`  ${RED}·${O} ${f}`);
  process.exit(1);
}
console.log(`  ${GRN}ok  ${O} every one of the ${plan.length} planned dispositions is executed, and nothing is executed that was not planned`);
console.log(`${GRN}${B}✓ capR2 PASSED${O}`);
