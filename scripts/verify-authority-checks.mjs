#!/usr/bin/env node
// ============================================================
// capA — verify-authority-checks — AUTHORITY IS A PERMISSION STRING, NEVER AN IDENTITY
// PURPOSE:      Ruling 2026-07-30: "Permissions are ALWAYS checked. There is no exception path.
//               The OWNER role holds every enforced permission, LOCKED — computed from the
//               manifest. `owner_id` is a FACT ABOUT WHO OWNS THE BUSINESS; it is NOT an authority
//               mechanism." This cap is what keeps that true tomorrow.
//
// WHY IT EXISTS AT ALL, and the argument is empirical rather than theoretical: on 2026-07-29 four
// rule violations were self-caught within 24 hours, three of them by the AUTHOR OF THE RULE, in the
// commit implementing that rule. Knowing a rule does not make you apply it while writing the code
// the rule is about. **A rule with no mechanical check will be broken by someone who knows it.**
//
// THREE ASSERTIONS:
//   1. NO `isOwner` IN AN AUTHORITY POSITION. `isOwner` may be READ for display (a role pill, a
//      heading, which name to show). It may NOT decide what someone is allowed to do.
//   2. NO ROLE-STRING COMPARE IN AN AUTHORITY POSITION. `role === 'MANAGER'` is the same defect
//      wearing different clothes, and it is WORSE: it is invisible to the manifest, to the alias
//      layer, and to assertion 1. This is not hypothetical — `CustomerCapture.tsx:109` read
//      `isOwner || role === 'MANAGER'` and would have survived a cap that only looked for isOwner.
//      That near-miss is why there are two assertions and not one.
//   3. THE SQL COPY OF THE OWNER SET MATCHES THE MANIFEST. `20260730a` hardcodes 52 strings because
//      SQL cannot import TypeScript. A hand copy goes stale; this closes the loop from the other
//      side, the same shape as capQ over the R-B2 list.
//
// HOW "AUTHORITY POSITION" IS DECIDED — stated, because a fuzzy rule is an unenforceable one:
//   An identity token is in an authority position when it flows into a CAPABILITY DECISION:
//     (a) it is assigned to an authority-named binding — can*/may*/allow*/is*Allowed/*Permitted/
//         has*Access/*Gate/enabled* — e.g. `const canManage = isOwner || …`
//     (b) it is combined with a `can(...)` call in the same expression — `isOwner || can('x')`,
//         which is the exact shape of all ten sites this build removed
//     (c) it guards a render of a CONTROL (`isOwner && <button`, `isOwner ? <button`)
//   READS THAT ARE NOT AUTHORITY, and are allowed: destructuring, prop plumbing, a role BADGE, a
//   heading string, a `[TRACE:*]` payload, a type declaration, a comment.
//
// SCOPE: the CLIENT + api layers, where the ruling bites. SQL is asserted by 20260730c's V1.
// DEPENDENCIES: none (node stdlib). Reads permissionManifest.ts + the 20260730a literal as TEXT.
// OUTPUTS:      exit 0 = clean · 1 = a violation (named, with file:line) · 2 = own probes failed.
// USAGE:        npm run verify:authority · chained into `npm run verify`.
// ============================================================
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', B = '\x1b[1m', O = '\x1b[0m', DIM = '\x1b[2m';

const SCAN_ROOTS = [
  'packages/cultivar-os/src', 'packages/cultivar-os/api',
  'packages/shared/src', 'packages/trace-app/src', 'api',
];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'fixtures']);
const EXCLUDE_FILE = /(\.(test|spec)\.[tj]sx?|verify-authority-checks\.mjs)$/;
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;

// ── THE TWO PATTERNS ────────────────────────────────────────────────────────────────────────────
// An authority-named binding. Deliberately broad on the NAME and narrow on the VALUE: naming a
// variable `canX` is a declaration that it decides a capability, so we hold the author to it.
const AUTHORITY_BINDING =
  /\b(?:const|let|var)\s+(can[A-Z]\w*|may[A-Z]\w*|allow\w*|is\w*Allowed|\w*Permitted|has\w*Access|\w*Gate|enabled\w*)\s*(?::[^=]+)?=\s*(.+)$/;

// `isOwner` as a value, not as a property key / string / comment.
const IS_OWNER_TOKEN = /(?<![.\w'"`])isOwner\b(?!\s*[:?]\s*(?:boolean|string))/;

// A role-string compare: role === 'MANAGER', r.role !== "OWNER", (member.role ?? '').toUpperCase() === 'STAFF'
const ROLE_COMPARE =
  /\b\w*[Rr]ole\b[^;\n]{0,80}?(?:===|!==|==|!=)\s*['"`](OWNER|MANAGER|STAFF|ADMIN|owner|manager|staff|admin)['"`]/;
const ROLE_COMPARE_REVERSED =
  /['"`](OWNER|MANAGER|STAFF|ADMIN|owner|manager|staff|admin)['"`]\s*(?:===|!==|==|!=)[^;\n]{0,80}?\b\w*[Rr]ole\b/;

// A control render guarded by an identity token.
const CONTROL_RENDER = /(?:isOwner|\b\w*[Rr]ole\b\s*(?:===|!==)\s*['"`]\w+['"`])\s*&&\s*[(<]/;

// A `can()` call sharing the expression — the `isOwner || can('x')` shape.
const HAS_CAN_CALL = /\bcan\s*\(/;

// ── DECLARED EXEMPTIONS ─────────────────────────────────────────────────────────────────────────
// A declaration is a DECISION ON THE RECORD, not a convenience the builder grants themselves. Each
// carries the reason it is not authority. Keyed file:pattern so it cannot silently widen.
const EXEMPT = [
  {
    file: 'packages/shared/src/context/BusinessProvider.tsx',
    match: /activeRole|isOwnerActive\s*\?\s*'OWNER'|isOwner: isOwnerActive|role:/,
    why: 'DISPLAY + the resolution site itself. This file COMPUTES isOwner and the role label; the '
       + 'ruling keeps isOwner alive for display, and can() here reads only the resolved set.',
  },
  {
    file: 'packages/shared/src/components/team/MemberConsole.tsx',
    match: /isOwnerRole|isOwnerRow/,
    why: 'THE ROLES-PAGE OWNER ROW — named by the ruling as the second surviving use. These decide '
       + 'how the OWNER ROLE RENDERS (lit chips, no Save, no reassign), not what the viewer may do; '
       + 'the viewer was already gated by can(team:read) at the top of the console. The actual '
       + 'enforcement is 20260730c §2, which refuses the write server-side.',
  },
  {
    file: 'packages/shared/src/components/AppHeader.tsx',
    match: /roleBadge|role\b.*pill|ROLE_COLORS/,
    why: 'The role BADGE — pure display, the canonical allowed read.',
  },
  {
    file: 'packages/cultivar-os/src/pages/Settings.tsx',
    match: /m\.role !== 'OWNER'/,
    why: 'OWNER-AS-TARGET, not viewer-authority: it protects the owner\'s own row from a Remove '
       + 'button. Same class as MemberConsole\'s isOwnerRow. The VIEWER was already gated by '
       + 'can(settings:update) at the top of the page. '
       + '🔴 FOUND BY capA, NOT BY THE BUILD PLAN — this is a SECOND team-member list living '
       + 'beside MemberConsole (an A1 surface duplication). Flagged for David; NOT merged here, '
       + 'because folding two team surfaces together is its own build with its own owner-test.',
  },
  {
    file: 'packages/cultivar-os/src/pages/Profile.tsx',
    match: /isOwner/,
    why: 'DISPLAY-PATH BRANCH: which SOURCE a person\'s own name comes from (auth full_name vs the '
       + 'member row). Reads nothing gated and grants nothing. Profile writes name/phone only — '
       + 'never role or permissions, asserted by its own header.',
  },
];

const isExempt = (file, line) =>
  EXEMPT.find(e => file === e.file && e.match.test(line));

// ── SCAN ────────────────────────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE_EXT.test(name) && !EXCLUDE_FILE.test(name)) out.push(p);
  }
  return out;
}

// Strip line comments + string literals so a WORD IN PROSE is never a finding. Learned from the
// write-path cap, whose first extension matched `UPDATE` inside 'settings:update permission
// required' and invented a table called `permission`.
function decomment(line) {
  const noLine = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
  return noLine.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, m => "'" + ' '.repeat(Math.max(0, m.length - 2)) + "'");
}

function scanText(file, text) {
  const found = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = decomment(raw);
    if (!line.trim() || line.trim().startsWith('*')) continue;

    // For the role-compare rule we must look at the ORIGINAL (the literal is the signal).
    const rawNoComment = raw.replace(/\/\/.*$/, '');

    const bind = line.match(AUTHORITY_BINDING);
    const rhsRaw = bind ? rawNoComment.slice(rawNoComment.indexOf('=') + 1) : null;

    // (a) authority-named binding fed by an identity token
    if (bind && IS_OWNER_TOKEN.test(bind[2])) {
      found.push({ file, line: i + 1, rule: 'isOwner', how: `authority binding \`${bind[1]}\``, text: raw.trim() });
      continue;
    }
    if (bind && rhsRaw && (ROLE_COMPARE.test(rhsRaw) || ROLE_COMPARE_REVERSED.test(rhsRaw))) {
      found.push({ file, line: i + 1, rule: 'role-compare', how: `authority binding \`${bind[1]}\``, text: raw.trim() });
      continue;
    }
    // (b) identity token sharing an expression with can()
    if (IS_OWNER_TOKEN.test(line) && HAS_CAN_CALL.test(line)) {
      found.push({ file, line: i + 1, rule: 'isOwner', how: 'combined with can() in one expression', text: raw.trim() });
      continue;
    }
    // (c) identity token guarding a control render
    if (CONTROL_RENDER.test(rawNoComment) && (IS_OWNER_TOKEN.test(line) || ROLE_COMPARE.test(rawNoComment))) {
      found.push({ file, line: i + 1, rule: IS_OWNER_TOKEN.test(line) ? 'isOwner' : 'role-compare', how: 'guards a rendered control', text: raw.trim() });
    }
  }
  return found;
}

// ── PROBES (STD-022 — planted, BOTH directions, BEFORE the scan) ────────────────────────────────
function runProbes() {
  const p = [];
  const t = (name, text, expect) => {
    const got = scanText('probe.tsx', text).length > 0;
    p.push({ name, ok: got === expect, expect, got });
  };

  // BAD must be caught
  t('P1 the exact shape removed this build: isOwner || can(...)',
    "const canManage = isOwner || can('orders:update');", true);
  t('P2 authority binding fed by isOwner alone',
    'const canEdit = isOwner;', true);
  t('P3 🔴 the role-string compare capA exists to also catch (CustomerCapture:109)',
    "const canSetDeliveryDate = isOwner || role === 'MANAGER';", true);
  t('P4 role compare with NO isOwner — invisible to assertion 1',
    "const mayApprove = role === 'MANAGER';", true);
  t('P5 isOwner guarding a rendered control',
    '{isOwner && <button onClick={x}>Delete</button>}', true);
  t('P6 reversed role compare',
    "const canX = 'OWNER' === member.role;", true);
  t('P7 normalized role compare',
    "const canY = (member.role ?? '').toUpperCase() === 'MANAGER';", true);

  // GOOD must NOT be flagged — the direction that keeps the cap usable
  t('P8 the correct form: a permission string',
    "const canManage = can('orders:update');", false);
  t('P9 DISPLAY read of isOwner (allowed by the ruling)',
    "const label = isOwner ? 'Owner' : 'Member';", false);
  t('P10 destructuring is not a decision',
    'const { businessId, isOwner, can } = useBusinessContext();', false);
  t('P11 prop plumbing is not a decision',
    '<MemberConsole isOwner={isOwner} businessId={businessId} />', false);
  t('P12 a [TRACE:*] payload is an observation, not a gate',
    "console.log('[TRACE:PERM] x', { isOwner, role });", false);
  t('P13 a type declaration is not code',
    '  isOwner: boolean;', false);
  t('P14 🔴 the word in a COMMENT is not a finding (the write-path cap\'s own false positive)',
    "// isOwner || can('x') is what we removed", false);
  t('P15 🔴 the word inside a STRING LITERAL is not a finding',
    "const msg = \"you need isOwner || role === 'MANAGER'\";", false);
  t('P16 a role string in a non-authority binding',
    "const heading = role === 'OWNER' ? 'Owner Dashboard' : 'Dashboard';", false);

  return p;
}

// ── ASSERTION 3 — the SQL copy vs the manifest ──────────────────────────────────────────────────
function checkSqlCopy() {
  const mPath = 'packages/shared/src/auth/permissionManifest.ts';
  const sPath = 'supabase/migrations/20260730a_owner_holds_all_backfill.sql';
  if (!existsSync(mPath) || !existsSync(sPath)) return { skipped: true };

  const mSrc = readFileSync(mPath, 'utf8');
  const mMatch = mSrc.match(/export const OWNER_DEFAULT_BUNDLE: string\[\] = \[([\s\S]*?)\];/);
  if (!mMatch) return { error: 'OWNER_DEFAULT_BUNDLE not found in the manifest' };
  const manifest = [...mMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort();

  const sSrc = readFileSync(sPath, 'utf8');
  const sMatch = sSrc.match(/\$OWNER\$\[([\s\S]*?)\]\$OWNER\$/);
  if (!sMatch) return { error: 'the $OWNER$ literal was not found in 20260730a' };
  const sql = [...sMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]).sort();

  const missing = manifest.filter(x => !sql.includes(x));
  const extra = sql.filter(x => !manifest.includes(x));
  return { manifest: manifest.length, sql: sql.length, missing, extra };
}

// ── RUN ─────────────────────────────────────────────────────────────────────────────────────────
console.log(`${B}capA — authority is a permission string, never an identity${O}`);

const probes = runProbes();
console.log(`\n${B}PROBES (STD-022 — planted, both directions)${O}`);
for (const p of probes) {
  console.log(`  ${p.ok ? GRN + 'ok  ' + O : RED + 'BAD ' + O} ${p.name}${p.ok ? '' : `  ${RED}(expected ${p.expect}, got ${p.got})${O}`}`);
}
if (probes.some(p => !p.ok)) {
  console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report.${O}`);
  console.error(`${DIM}  A cap that cannot prove it catches the defect must not be trusted to say there isn't one.${O}\n`);
  process.exit(2);
}

const files = SCAN_ROOTS.flatMap(r => walk(join(ROOT, r)));
const violations = [];
const exempted = [];
for (const abs of files) {
  const rel = relative(ROOT, abs);
  for (const f of scanText(rel, readFileSync(abs, 'utf8'))) {
    const ex = isExempt(rel, f.text);
    if (ex) exempted.push({ ...f, why: ex.why });
    else violations.push(f);
  }
}

console.log(`\n${B}SCAN${O}  ${files.length} files · ${SCAN_ROOTS.length} roots`);

const sqlCheck = checkSqlCopy();
console.log(`\n${B}ASSERTION 3 — the SQL copy of the owner set${O}`);
if (sqlCheck.skipped) {
  console.log(`  ${YEL}skip${O} the backfill migration is not present`);
} else if (sqlCheck.error) {
  console.log(`  ${RED}BAD ${O} ${sqlCheck.error}`);
  violations.push({ file: 'supabase/migrations/20260730a_owner_holds_all_backfill.sql', line: 0, rule: 'sql-copy', how: sqlCheck.error, text: '' });
} else if (sqlCheck.missing.length || sqlCheck.extra.length) {
  console.log(`  ${RED}BAD ${O} manifest ${sqlCheck.manifest} · sql ${sqlCheck.sql}`);
  if (sqlCheck.missing.length) console.log(`        ${RED}in the manifest, MISSING from the SQL:${O} ${sqlCheck.missing.join(', ')}`);
  if (sqlCheck.extra.length) console.log(`        ${RED}in the SQL, NOT in the manifest:${O} ${sqlCheck.extra.join(', ')}`);
  violations.push({
    file: 'supabase/migrations/20260730a_owner_holds_all_backfill.sql', line: 0, rule: 'sql-copy',
    how: `the hand copy drifted from the manifest (missing ${sqlCheck.missing.length}, extra ${sqlCheck.extra.length})`, text: '',
  });
} else {
  console.log(`  ${GRN}ok  ${O} the SQL literal matches OWNER_DEFAULT_BUNDLE exactly (${sqlCheck.manifest} strings)`);
}

if (exempted.length) {
  console.log(`\n${B}DECLARED — identity reads that are NOT authority${O} ${DIM}(each with its reason on record)${O}`);
  for (const e of exempted) console.log(`  ${DIM}·${O} ${e.file}:${e.line}  ${DIM}${e.text.slice(0, 78)}${O}`);
}

if (violations.length === 0) {
  console.log(`\n${GRN}${B}✓ capA PASSED${O} — no identity token in an authority position; the SQL copy is current.\n`);
  process.exit(0);
}

console.log(`\n${RED}${B}✗ capA FAILED — ${violations.length} authority decision(s) keyed on identity${O}\n`);
for (const v of violations) {
  console.log(`  ${RED}${v.file}:${v.line}${O}  ${B}[${v.rule}]${O} ${v.how}`);
  if (v.text) console.log(`      ${DIM}${v.text.slice(0, 110)}${O}`);
}
console.log(`\n${B}THE RULE:${O} authority comes from a permission string the session HOLDS.`);
console.log(`  · replace \`isOwner || can('x')\` with \`can('x')\` — an OWNER-role session holds every`);
console.log(`    enforced string in its computed set (OWNER_LOCKED_SET), so it passes the same branch.`);
console.log(`  · replace \`role === 'MANAGER'\` with the permission that role is being asked to prove.`);
console.log(`  · a DISPLAY read of isOwner is fine — declare it in EXEMPT with its reason.\n`);
process.exit(1);
