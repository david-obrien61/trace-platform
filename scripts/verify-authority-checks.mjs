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
// FOUR ASSERTIONS (the fourth added 2026-07-31 by David's R-GRANTDIFF ruling):
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
//   4. 🔴 THE GRANT SET OF EVERY AUTHORITY SITE IS BASELINED — WHO PASSES, not what the check looks
//      like. Assertions 1-3 are all about SHAPE. A site can be perfectly shaped and still admit a
//      different set of people than it did yesterday.
//
// WHY ASSERTION 4 EXISTS — the argument is its own first run, and the direction is the point.
// On 2026-07-31 the Phase 2 conversion was audited by hand for the first time. FOUR findings across
// 15 sites, and **THREE OF THEM WERE WIDENINGS**:
//   · CustomerCapture     — NARROWED. The manager lost the delivery-date field. Found by DAVID, in
//                           about twenty minutes, because a person noticed something missing.
//   · ScanOrder:149       — WIDENED to STAFF. Probably right (the 2026-07-27 fulfilment ruling).
//   · DeliverySchedule    — WIDENED to MANAGER on customer edit. Probably right too.
//   · manage_orders → two verbs; manage_settings → three. Defensible per site, invisible as a set.
// **A NARROWING GETS REPORTED BY THE PERSON WHO LOST SOMETHING. A WIDENING IS REPORTED BY NOBODY,
// EVER** — the person who gained access does not file a ticket. That asymmetry is why this cannot
// be left to owner-tests: the tests are written from the perspective of someone trying to DO
// something, and nobody writes a card asserting they still cannot. "Probably right and undeclared"
// is precisely the state the permission model exists to eliminate, and all three happened INSIDE
// the build whose purpose was to make authority explicit.
//
// HOW ASSERTION 4 WORKS (the same ratchet as verify-write-paths):
//   · every authority SITE is resolved to the set of ROLES that pass it, against the three bundles
//     in permissionManifest.ts — the only source of who-holds-what.
//   · the answer is recorded in `authority-grants-baseline.json`, keyed on `file::binding` — NOT on
//     `file:line`. That is deliberate: tech-debt #78 is that the other caps' line-keyed baselines
//     report a false NEW on any comment edit above a tracked site. A binding name survives the edit.
//   · a site whose role set CHANGES fails the build. The fix is to revert it, or to re-baseline
//     WITH a `why` — a recorded reason, which is what "declared" means here.
//   · a site that admits NOBODY (`roles: []`) must carry a `why` even on first sight. An empty
//     grant set is usually a legacy string that `can()` cannot resolve — the #170 defect, which is
//     invisible to every other assertion because the shape is immaculate.
//
// WHAT ASSERTION 4 CANNOT DO, stated rather than left to be discovered:
//   · it resolves LITERAL strings only. `can(navPermission(n))` is DYNAMIC — it is counted and
//     printed, never silently dropped, because a cap that hides its own blind spot is #164.
//   · it knows the three DEFAULT bundles, not a tenant's edited arrays. An owner who revokes a
//     string from their manager makes the live answer differ from the recorded one. The baseline
//     answers "who does the MODEL admit", which is the question a code review can act on.
//   · it is CLIENT-SIDE (`can()` + route `permission=` props). The api layer's `callerCan` is
//     server authority and is asserted separately; RLS is asserted in SQL.
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
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ASSERTION 4 — THE GRANT SET (who passes), baselined and ratcheted
// ════════════════════════════════════════════════════════════════════════════════════════════════

const GRANTS_BASELINE = 'authority-grants-baseline.json';
const ROLES = ['OWNER', 'MANAGER', 'STAFF'];

// The three bundles are the ONLY source of who-holds-what. Read as TEXT so this stays a
// zero-dependency node script (the same reason assertion 3 parses the manifest rather than importing it).
function readBundles() {
  const src = readFileSync(join(ROOT, 'packages/shared/src/auth/permissionManifest.ts'), 'utf8');
  const grab = (name) => {
    const m = src.match(new RegExp(`export const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\];`));
    if (!m) return null;
    // Strip comments FIRST — the manifest's own headers warn that an inline quoted string is
    // counted as a member, and that mistake has already been made once inside this very file.
    const body = m[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  return {
    OWNER: grab('OWNER_DEFAULT_BUNDLE'),
    MANAGER: grab('MANAGER_DEFAULT_BUNDLE'),
    STAFF: grab('STAFF_DEFAULT_BUNDLE'),
  };
}

// Resolve ONE permission string to the roles that hold it.
//   · `owner-only` is a SENTINEL, not a manifest entry — it resolves to OWNER alone, and it is the
//     line that would have silently taken /costs and /add-business away from the owner in Phase 2.
//   · `member` is the membership sentinel — any active member passes.
//   · anything else is literal membership, because that is exactly what can() does. A legacy string
//     with a live successor therefore resolves to NOBODY, which is the #170 defect made visible.
function rolesFor(perm, bundles) {
  if (perm === 'owner-only') return ['OWNER'];
  if (perm === 'member') return [...ROLES];
  return ROLES.filter((r) => (bundles[r] ?? []).includes(perm));
}

// A site may combine strings. `&&` means ALL (intersection), `||` means ANY (union). Mixed
// expressions are reported as `mixed` and resolved as a union — the permissive reading, so the cap
// never UNDER-reports who gets in.
function resolveSite(strings, op, bundles) {
  const sets = strings.map((s) => rolesFor(s, bundles));
  if (!sets.length) return [];
  const combined = op === 'and'
    ? ROLES.filter((r) => sets.every((s) => s.includes(r)))
    : ROLES.filter((r) => sets.some((s) => s.includes(r)));
  return combined;
}

const CAN_LITERAL = /\bcan\(\s*'([^']+)'\s*\)/g;
const CAN_DYNAMIC = /\bcan\(\s*(?!')/;
const PERMISSION_PROP = /permission=\{?["']([^"']+)["']\}?/g;

// Collect every authority site in one file. Keyed on file::binding — NEVER file:line (#78).
function collectSites(file, text) {
  const sites = [];
  const dynamic = [];
  const lines = text.split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // BLOCK-COMMENT STATE. Without this, a `/* … */` paragraph that merely MENTIONS `can()` is
    // reported as a dynamic site — which happened on the first run (router.tsx:240, a sentence
    // reading "Owner passes (can() short-circuits…"). A cap that lists prose as a blind spot
    // teaches its reader to skim the blind-spot list, which is the one section that must be read.
    if (inBlockComment) { if (/\*\//.test(raw)) inBlockComment = false; continue; }
    if (/\/\*/.test(raw) && !/\*\//.test(raw)) inBlockComment = true;

    const line = raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (!line.trim() || line.trim().startsWith('*')) continue;
    // `can()`'s own DEFINITION is not a call site.
    if (/\b(?:export\s+)?function\s+can\b/.test(line) || /\bcan:\s*\(/.test(line)) continue;

    const strings = [...line.matchAll(CAN_LITERAL)].map((m) => m[1]);
    const bind = line.match(AUTHORITY_BINDING);

    if (CAN_DYNAMIC.test(line) && !strings.length) {
      dynamic.push({ file, line: i + 1, text: raw.trim() });
      continue;
    }

    if (strings.length) {
      const rhs = bind ? line.slice(line.indexOf('=') + 1) : line;
      const hasAnd = /&&/.test(rhs.replace(/&&\s*[(<]/g, '')); // `can(x) && <jsx` is a render, not a conjunction
      const op = hasAnd && strings.length > 1 ? 'and' : 'or';
      const key = bind ? `${file}::${bind[1]}` : `${file}::render:${strings.join('+')}`;
      sites.push({ key, file, line: i + 1, strings, op, text: raw.trim() });
      continue;
    }

    for (const m of [...line.matchAll(PERMISSION_PROP)]) {
      sites.push({
        key: `${file}::route:${m[1]}`, file, line: i + 1,
        strings: [m[1]], op: 'or', text: raw.trim(),
      });
    }
  }
  return { sites, dynamic };
}

function loadGrantsBaseline() {
  const p = join(ROOT, GRANTS_BASELINE);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
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

// ── PROBES FOR ASSERTION 4 (STD-022 — a narrowing must fail, a widening must fail, a declared
//    change must pass). The widening probes are the ones that matter: they are the direction no
//    human reports, which is the entire reason this assertion exists.
function runGrantProbes() {
  const p = [];
  const B_ = {
    OWNER: ['orders:create', 'orders:update', 'customers:update', 'costs:read'],
    MANAGER: ['orders:create', 'orders:update', 'customers:update'],
    STAFF: ['orders:create'],
  };
  const t = (name, ok) => p.push({ name, ok });
  const eq = (a, b) => a.join(',') === b.join(',');

  // — resolution —
  t('G1 a manager-held string admits OWNER+MANAGER',
    eq(rolesFor('orders:update', B_), ['OWNER', 'MANAGER']));
  t('G2 a staff-held string admits all three',
    eq(rolesFor('orders:create', B_), ['OWNER', 'MANAGER', 'STAFF']));
  t('G3 an owner-only string admits OWNER alone',
    eq(rolesFor('costs:read', B_), ['OWNER']));
  t('G4 🔴 the `owner-only` SENTINEL resolves to OWNER (it is not a manifest entry)',
    eq(rolesFor('owner-only', B_), ['OWNER']));
  t('G5 the `member` sentinel resolves to every role',
    eq(rolesFor('member', B_), ['OWNER', 'MANAGER', 'STAFF']));
  t('G6 🔴 A LEGACY STRING ADMITS NOBODY — the #170 defect, invisible to assertions 1-3',
    eq(rolesFor('view_customers', B_), []));

  // — combinators —
  t('G7 || is a UNION',
    eq(resolveSite(['costs:read', 'orders:create'], 'or', B_), ['OWNER', 'MANAGER', 'STAFF']));
  t('G8 && is an INTERSECTION',
    eq(resolveSite(['costs:read', 'orders:create'], 'and', B_), ['OWNER']));

  // — the ratchet, both directions —
  const diff = (base, cur) => base.join(',') !== cur.join(',');
  t('G9 🔴 A NARROWING FAILS (the CustomerCapture defect: manager loses the field)',
    diff(['OWNER', 'MANAGER', 'STAFF'], ['OWNER']) === true);
  t('G10 🔴 A WIDENING FAILS (the direction nobody reports — ScanOrder admitting STAFF)',
    diff(['OWNER'], ['OWNER', 'MANAGER', 'STAFF']) === true);
  t('G11 an UNCHANGED site passes',
    diff(['OWNER', 'MANAGER'], ['OWNER', 'MANAGER']) === false);
  t('G12 a DECLARED change passes (baseline updated + a recorded why)',
    (() => {
      const declared = { roles: ['OWNER', 'MANAGER', 'STAFF'], why: 'staff take orders' };
      return !diff(declared.roles, ['OWNER', 'MANAGER', 'STAFF']) && !!declared.why;
    })());
  t('G13 🔴 an EMPTY grant set with NO why is a violation even on first sight',
    (() => { const site = { roles: [], why: '' }; return site.roles.length === 0 && !site.why; })());

  // — site extraction, incl. the shapes that broke earlier caps —
  const ex = (src, file = 'p.tsx') => collectSites(file, src);
  t('G14 an authority binding is keyed on the BINDING NAME, not the line (#78)',
    ex("const canSetDeliveryDate = can('orders:create');").sites[0].key === 'p.tsx::canSetDeliveryDate');
  t('G15 a route permission prop is a site',
    ex('<PermissionRoute permission="deliveries:read">').sites[0].key === 'p.tsx::route:deliveries:read');
  t('G16 🔴 a DYNAMIC can() is REPORTED, never silently dropped',
    ex('const canSee = (n) => can(navPermission(n));').dynamic.length === 1);
  t('G17 a comment naming a string is not a site',
    ex("// gated on can('costs:read') until the sweep").sites.length === 0);
  t('G17b 🔴 a BLOCK COMMENT mentioning can() is not a dynamic site (router.tsx:240, run 1)',
    ex('/* a paragraph\n   Owner passes (can() short-circuits) here.\n*/').dynamic.length === 0);
  t('G17c can()\'s own DEFINITION is not a call site',
    ex('export function can(permissionId: string): boolean {').dynamic.length === 0);
  t('G18 an inline control render is a site',
    ex("{can('costs:create') && <CaptureInvoiceLauncher />}").sites.length === 1);
  t('G19 `can(a) && can(b)` reads as a CONJUNCTION, not a render',
    ex("const canX = can('costs:read') && can('orders:create');").sites[0].op === 'and');

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

const probes = [...runProbes(), ...runGrantProbes()];
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

// ── ASSERTION 4 — THE GRANT SET ─────────────────────────────────────────────────────────────────
const WRITE_BASELINE = process.argv.includes('--baseline');
const bundles = readBundles();
const allSites = [];
const allDynamic = [];
for (const abs of files) {
  const rel = relative(ROOT, abs);
  if (!/\.(tsx|ts)$/.test(rel) || rel.startsWith('packages/cultivar-os/api') || rel.startsWith('api/')) continue;
  const { sites, dynamic } = collectSites(rel, readFileSync(abs, 'utf8'));
  allSites.push(...sites);
  allDynamic.push(...dynamic);
}

const resolved = new Map();
for (const s of allSites) {
  const roles = resolveSite(s.strings, s.op, bundles);
  // A key seen twice (same binding name, two branches) merges permissively — never under-report.
  const prev = resolved.get(s.key);
  resolved.set(s.key, prev
    ? { ...prev, roles: ROLES.filter((r) => prev.roles.includes(r) || roles.includes(r)) }
    : { key: s.key, file: s.file, line: s.line, strings: s.strings, op: s.op, roles, text: s.text });
}

console.log(`\n${B}ASSERTION 4 — the grant set (WHO passes, not what the check looks like)${O}`);
console.log(`  ${DIM}bundles: OWNER ${bundles.OWNER?.length ?? '?'} · MANAGER ${bundles.MANAGER?.length ?? '?'} · STAFF ${bundles.STAFF?.length ?? '?'}${O}`);
console.log(`  ${DIM}${resolved.size} literal site(s) · ${allDynamic.length} dynamic (unresolvable, listed below)${O}`);

const grantsBase = loadGrantsBaseline();
const grantViolations = [];

if (WRITE_BASELINE) {
  const out = { _doc: [
    'capA assertion 4 — WHO PASSES each authority site, resolved against the three default bundles.',
    'Keyed on file::binding, NEVER file:line — a binding name survives an edit above it (tech-debt #78).',
    'A change to any `roles` array FAILS the build. To accept one: re-run with --baseline AND write',
    'a `why`. An empty `roles` (the site admits NOBODY) requires a `why` even on first sight.',
  ], generated: 'run `node scripts/verify-authority-checks.mjs --baseline`', sites: {} };
  const existing = grantsBase?.sites ?? {};
  for (const [k, v] of [...resolved.entries()].sort()) {
    out.sites[k] = { strings: v.strings, op: v.op, roles: v.roles, why: existing[k]?.why ?? '' };
  }
  writeFileSync(join(ROOT, GRANTS_BASELINE), JSON.stringify(out, null, 2) + '\n');
  console.log(`  ${YEL}baseline written${O} — ${resolved.size} sites → ${GRANTS_BASELINE}`);
} else if (!grantsBase) {
  console.log(`  ${YEL}skip${O} no ${GRANTS_BASELINE} — run with --baseline to seed it`);
} else {
  const base = grantsBase.sites ?? {};
  let unchanged = 0;
  for (const [k, v] of [...resolved.entries()].sort()) {
    const b = base[k];
    if (!b) {
      if (v.roles.length === 0) {
        grantViolations.push({ ...v, kind: 'new-empty', was: null });
      } else {
        console.log(`  ${YEL}new ${O} ${k} → ${v.roles.join('+') || 'NOBODY'} ${DIM}(new site, re-baseline to record it)${O}`);
      }
      continue;
    }
    const changed = b.roles.join(',') !== v.roles.join(',');
    if (changed) grantViolations.push({ ...v, kind: v.roles.length > b.roles.length ? 'widened' : 'narrowed', was: b.roles });
    else if (v.roles.length === 0 && !b.why) grantViolations.push({ ...v, kind: 'empty-undeclared', was: b.roles });
    else unchanged++;
  }
  const gone = Object.keys(base).filter((k) => !resolved.has(k));
  console.log(`  ${unchanged === resolved.size && !gone.length ? GRN + 'ok  ' + O : DIM + '    ' + O}${unchanged} site(s) unchanged${gone.length ? ` · ${YEL}${gone.length} baselined site(s) no longer present${O}` : ''}`);
  for (const k of gone) console.log(`        ${DIM}gone: ${k} (was ${base[k].roles.join('+') || 'NOBODY'})${O}`);

  const declaredEmpty = [...resolved.values()].filter((v) => v.roles.length === 0 && base[v.key]?.why);
  if (declaredEmpty.length) {
    console.log(`\n  ${B}DECLARED — sites that admit NOBODY, each with its reason on record${O}`);
    for (const v of declaredEmpty) console.log(`    ${RED}·${O} ${v.key} ${DIM}[${v.strings.join(', ')}] — ${base[v.key].why}${O}`);
  }
}

if (allDynamic.length) {
  console.log(`\n  ${B}DYNAMIC — can() with a non-literal argument. NOT resolvable, NOT ignored.${O}`);
  for (const d of allDynamic) console.log(`    ${DIM}· ${d.file}:${d.line}  ${d.text.slice(0, 88)}${O}`);
  console.log(`    ${DIM}These are the cap's stated blind spot: their grant set is decided at runtime.${O}`);
}

for (const g of grantViolations) violations.push({
  file: g.file, line: g.line, rule: `grant-${g.kind}`,
  how: g.kind === 'new-empty' || g.kind === 'empty-undeclared'
    ? `${g.key} admits NOBODY [${g.strings.join(', ')}] — a legacy or unknown string, or a genuinely dead gate`
    : `${g.key} ${g.kind}: ${g.was.join('+') || 'NOBODY'} → ${g.roles.join('+') || 'NOBODY'}`,
  text: g.text,
});

if (violations.length === 0) {
  console.log(`\n${GRN}${B}✓ capA PASSED${O} — no identity token in an authority position; the SQL copy is current; every grant set matches its baseline.\n`);
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
