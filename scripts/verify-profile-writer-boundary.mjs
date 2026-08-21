#!/usr/bin/env node
// ============================================================
// verify-profile-writer-boundary — THE NARROW PROFILE WRITER CANNOT REACH THE AUTHORITY COLUMNS
//
// PURPOSE:      `set_business_profile` is the ONLY gated writer of the `businesses` identity
//               columns, and its migration says at the line what it is:
//                 "⚠️ THE COLUMN LIST IS THE SECURITY BOUNDARY. owner_id, accounting_*,
//                  business_type and everything else on this table are UNREACHABLE from here BY
//                  CONSTRUCTION. Adding a column to this SET is granting a new capability."
//               That sentence is a COMMENT. Nothing enforced it. This cap enforces it.
//
// 🔴 WHY THESE TWO COLUMNS AND NOT THE WHOLE LIST — the recon's most durable finding
//               (docs/audits/businesses-write-paths-recon-2026-08-21.md, Q8):
//               **`business_type` is protected by nothing but the absence of code that writes it.**
//               Postgres RLS has NO column-level restriction, so `businesses_owner_update` — which
//               the owner passes — would permit changing it, and `business_type` drives
//               `verticalsForBusinessType`, i.e. WHICH TILES A TENANT SEES. `owner_id` is safe, but
//               only IMPLICITLY: `businesses_owner_update` specifies `USING` with no `WITH CHECK`,
//               and Postgres applies USING as the check on UPDATE when WITH CHECK is omitted. A
//               reassignment of `owner_id` is someone TAKING THE BUSINESS. When a capability needs
//               some columns and not others, THE FUNCTION IS THE COLUMN-LEVEL POLICY — so the
//               function's SET list is the last thing standing between a `settings:update` grant
//               and those two columns.
//
// THE RULE:     The SET list of every `UPDATE ... businesses` inside `set_business_profile` must
//               contain NEITHER `owner_id` NOR `business_type`.
//
// 🔴 THE COLUMN LIST IS DERIVED FROM THE FUNCTION SOURCE, NEVER TYPED HERE.
//               No list of five columns appears anywhere in this file. The cap parses the SET list
//               out of the newest migration that defines the function and asks ONE question of it.
//               That is deliberate and it is STD-025: **a test asserts a CAPABILITY, never a
//               CONFIGURATION.** Pinning "the list is exactly name/phone/address/email/website"
//               would turn David's next legitimate column into a red build. Adding `logo_url` here
//               passes, as it should. Adding `business_type` fails, as it must.
//               ⚠️ Consequence, INTENDED: if David ever rules that `business_type` MAY be edited
//               through this writer, this cap goes red with no code change. That is the cap doing
//               its job — the ruling then deletes the entry here, deliberately, in the open.
//
// 🔴 THE FORBIDDEN PAIR IS NAMED, NOT DERIVED, AND THAT IS THE HONEST ANSWER.
//               There is no mechanical source for "these are the authority columns" — no schema
//               annotation, no catalog flag. Deriving it would mean inventing a heuristic and
//               calling it a derivation. Each entry below carries its own reason instead.
//
// COMMENTS ARE STRIPPED BEFORE DETECTION — with an HONEST note about what that buys TODAY.
//               The migration's own warning comment CONTAINS BOTH FORBIDDEN WORDS, two lines above
//               the SET list it describes — capA's M10/M11 shape (it read its marker inside its own
//               prose). ✏️ BUT MEASURED, NOT ASSUMED: disabling the stripper and re-running against
//               the real corpus still PASSES, because that comment sits ABOVE the `UPDATE` and the
//               SET-list window opens at `UPDATE ... SET`. So stripping is NOT what saves this cap
//               today, and saying otherwise would be a claim the corpus does not support (STD-021).
//               What it genuinely guards is two reachable classes, both probed: a comment INSIDE a
//               SET list (B4/B5), and — the one that would actually bite here, given this repo's
//               habit of parking verification SQL in comments — a COMMENTED-OUT later definition of
//               the function being read as the newest live one (B15).
//
// SCOPE / STATED LIMITS (a cap that overreaches is worse than one that says what it cannot see):
//               · Reads the REPO migration corpus, NOT the live catalog (no psql on this machine).
//                 A function replaced by hand in the dashboard is invisible here — §6 r17's class,
//                 and the schema-snapshot checker that would see it is OWED and does not exist.
//               · NEWEST DEFINITION WINS, by file sort order, matching the 2026-08-01 ruling: assert
//                 against the CURRENT materialisation, never a dated file. Probes B9/B10 prove it
//                 in both directions.
//               · It checks WHICH COLUMNS the writer can reach. It does not check WHO may call it —
//                 that is capA/capP's job, and the gate (`settings:update` + the denial audit row)
//                 is already there.
//               · A function that cannot be found, or whose body contains no UPDATE on `businesses`,
//                 is a HARD FAILURE, never a silent pass. A cap that finds nothing and reports
//                 green is the 2026-08-01 zero-row false-green.
// DEPENDENCIES: none (node stdlib only).
// OUTPUTS:      exit 0 = the boundary holds · 1 = a forbidden column is reachable, or the writer
//               could not be located · 2 = the cap's own probes failed (it refuses to report).
// USAGE:        npm run verify:profile-boundary · runs inside `npm run verify`.
// ============================================================
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = 'supabase/migrations';
const FN = 'set_business_profile';
const TABLE = 'businesses';

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m';

// ── THE FORBIDDEN PAIR — named with the reason each one is authority, not identity ───────────
const FORBIDDEN = {
  owner_id:      'WHO OWNS THE BUSINESS. Reassigning it is taking the business. Its only other '
               + 'protection is implicit — businesses_owner_update has USING and no WITH CHECK, so '
               + 'Postgres applies USING as the UPDATE check by default.',
  business_type: 'WHICH VERTICAL THE TENANT IS, and therefore which tiles they see '
               + '(verticalsForBusinessType). RLS has no column-level restriction, so the owner\'s '
               + 'own UPDATE policy would permit changing it — today it is protected by nothing but '
               + 'the absence of code that writes it.',
};

// ── PURE ANALYZER ────────────────────────────────────────────────────────────────────────────

/** Strip SQL comments, preserving newline count so reported line numbers stay true. */
export function stripSqlComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
}

/** Bodies of every `CREATE [OR REPLACE] FUNCTION <name>` in this text, in source order. */
export function functionBodies(sql, name) {
  const out = [];
  const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${name}\\s*\\(`, 'gi');
  let m;
  while ((m = re.exec(sql)) !== null) {
    const open = sql.indexOf('$$', m.index);
    if (open === -1) continue;
    const close = sql.indexOf('$$', open + 2);
    if (close === -1) continue;
    out.push(sql.slice(open + 2, close));
  }
  return out;
}

/** SET-list column names from EVERY `UPDATE <table> SET ... WHERE` in a body. Union, not first-wins. */
export function setListColumns(body, table) {
  const cols = [];
  const re = new RegExp(`UPDATE\\s+(?:public\\.)?${table}\\s+SET\\s+`, 'gi');
  let m;
  while ((m = re.exec(body)) !== null) {
    const rest = body.slice(m.index + m[0].length);
    // Bound at the WHERE that closes THIS statement (depth 0 — a WHERE inside a subquery is not it).
    let depth = 0, end = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && /\s/.test(c) && /^where\b/i.test(rest.slice(i + 1))) { end = i + 1; break; }
      else if (depth === 0 && c === ';') { end = i; break; }
    }
    // Split the assignment list on depth-0 commas, then take each LHS identifier.
    const list = rest.slice(0, end);
    let seg = '', d = 0;
    const segs = [];
    for (const c of list) {
      if (c === '(') d++;
      else if (c === ')') d--;
      if (c === ',' && d === 0) { segs.push(seg); seg = ''; continue; }
      seg += c;
    }
    segs.push(seg);
    for (const s of segs) {
      const lhs = s.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (lhs) cols.push(lhs[1].toLowerCase());
    }
  }
  return [...new Set(cols)];
}

/**
 * Judge a whole corpus. `files` = [{ name, content }] SORTED — newest definition wins.
 * Returns { found, source, columns, violations }.
 */
export function judge(files, forbidden = FORBIDDEN) {
  let source = null, body = null;
  for (const f of files) {
    const bodies = functionBodies(stripSqlComments(f.content), FN);
    if (bodies.length) { source = f.name; body = bodies[bodies.length - 1]; }
  }
  if (body === null) return { found: false, why: `no definition of ${FN}() in the corpus`, source: null, columns: [], violations: [] };
  const columns = setListColumns(body, TABLE);
  if (columns.length === 0) return { found: false, why: `${FN}() defines no UPDATE on ${TABLE}`, source, columns: [], violations: [] };
  const violations = columns.filter((c) => Object.hasOwn(forbidden, c));
  return { found: true, why: null, source, columns, violations };
}

// ── PROBES — planted-bad, both directions (STD-022) ──────────────────────────────────────────
const HEAD = `CREATE OR REPLACE FUNCTION public.${FN}(p_business_id uuid, p_name text)\nRETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''\nAS $$\nBEGIN\n`;
const TAIL = `\n  RETURN;\nEND;\n$$;\n`;
const fn = (inner) => [{ name: 'probe.sql', content: HEAD + inner + TAIL }];
const CLEAN = `  UPDATE public.businesses SET name = btrim(p_name), phone = p_phone, address = p_address, email = p_email, website = p_website WHERE id = p_business_id;`;

function runProbes() {
  const R = [];
  const ck = (name, expect, got) => R.push({ name, expect: JSON.stringify(expect), got: JSON.stringify(got), ok: JSON.stringify(expect) === JSON.stringify(got) });

  ck('B1 owner_id in the SET list → violation', ['owner_id'],
    judge(fn(`  UPDATE public.businesses SET name = btrim(p_name), owner_id = p_actor WHERE id = p_business_id;`)).violations);
  ck('B2 business_type in the SET list → violation', ['business_type'],
    judge(fn(`  UPDATE public.businesses SET name = btrim(p_name), business_type = p_t WHERE id = p_business_id;`)).violations);
  ck('B3 🔴 NEGATIVE CONTROL — the clean five-column list → ZERO violations', [], judge(fn(CLEAN)).violations);
  ck('B4 🔴 the forbidden words in a BLOCK COMMENT above the SET are NOT the SET list', [],
    judge(fn(`  /* THE COLUMN LIST IS THE SECURITY BOUNDARY: owner_id and business_type are\n     UNREACHABLE from here BY CONSTRUCTION. */\n${CLEAN}`)).violations);
  ck('B5 the forbidden words in a -- LINE COMMENT are not the SET list', [],
    judge(fn(`  -- owner_id, business_type: unreachable\n${CLEAN}`)).violations);
  ck('B6 🔴 the function ABSENT is a HARD FAILURE, never a silent pass', false,
    judge([{ name: 'x.sql', content: 'SELECT 1;' }]).found);
  ck('B7 🔴 a function body with NO UPDATE on businesses is a HARD FAILURE', false,
    judge(fn(`  INSERT INTO public.audit_log (action) VALUES ('x');`)).found);
  ck('B8 🔴 a SECOND UPDATE in the body is UNIONED, not skipped after the first', ['owner_id'],
    judge(fn(`${CLEAN}\n  UPDATE public.businesses SET owner_id = p_actor WHERE id = p_business_id;`)).violations);
  ck('B9 🔴 NEWEST WINS — an older clean def then a NEWER dirty one → violation', ['business_type'],
    judge([{ name: '1.sql', content: HEAD + CLEAN + TAIL },
           { name: '2.sql', content: HEAD + `  UPDATE public.businesses SET business_type = p_t WHERE id = p_business_id;` + TAIL }]).violations);
  ck('B10 NEWEST WINS the other way — older dirty, newer clean → no violation', [],
    judge([{ name: '1.sql', content: HEAD + `  UPDATE public.businesses SET owner_id = p_a WHERE id = p_business_id;` + TAIL },
           { name: '2.sql', content: HEAD + CLEAN + TAIL }]).violations);
  ck('B11 🔴 STD-025 — a DIFFERENT legal column list still passes (capability, not configuration)', [],
    judge(fn(`  UPDATE public.businesses SET logo_url = p_logo, name = btrim(p_name) WHERE id = p_business_id;`)).violations);
  ck('B12 detection is case- and whitespace-insensitive', ['owner_id'],
    judge(fn(`  UPDATE PUBLIC.BUSINESSES\n     SET   OWNER_ID   =  p_actor\n   WHERE id = p_business_id;`)).violations);
  ck('B13 🔴 the columns are DERIVED — the clean list is read back verbatim from source',
    ['name', 'phone', 'address', 'email', 'website'], judge(fn(CLEAN)).columns);
  ck('B14 a column merely NAMED in the WHERE clause is not a SET target', [],
    judge(fn(`  UPDATE public.businesses SET name = btrim(p_name) WHERE id = p_business_id AND owner_id = p_actor;`)).violations);
  // 🔴 B15 — THE CLASS THE STRIPPER ACTUALLY GUARDS IN THIS REPO. Migrations here routinely park
  // verification SQL in comments. A commented-out LATER definition must NOT be read as the live one:
  // un-stripped it would win on newest-wins and report a violation that does not exist in the DB.
  ck('B15 🔴 a COMMENTED-OUT later definition does not win newest-wins', [],
    judge([{ name: '1.sql', content: HEAD + CLEAN + TAIL },
           { name: '2.sql', content: '-- ' + (HEAD + `  UPDATE public.businesses SET owner_id = p_a WHERE id = p_business_id;` + TAIL).split('\n').join('\n-- ') }]).violations);
  ck('B16 …and the same file UNCOMMENTED does win (B15 is not passing by accident)', ['owner_id'],
    judge([{ name: '1.sql', content: HEAD + CLEAN + TAIL },
           { name: '2.sql', content: HEAD + `  UPDATE public.businesses SET owner_id = p_a WHERE id = p_business_id;` + TAIL }]).violations);

  return R;
}

// ── RUN ──────────────────────────────────────────────────────────────────────────────────────
const probes = runProbes();
const probeFails = probes.filter((p) => !p.ok);
if (probeFails.length) {
  console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report.${O}`);
  for (const p of probeFails) console.error(`  ${RED}${p.name}${O}  expected ${p.expect}, got ${p.got}`);
  process.exit(2);
}

const dir = join(ROOT, MIGRATIONS_DIR);
const files = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ name: f, content: readFileSync(join(dir, f), 'utf8') }))
  : [];
const res = judge(files);

console.log(`\n${B}PROFILE-WRITER BOUNDARY${O} ${DIM}— ${FN}() cannot reach the authority columns${O}`);
console.log(`${DIM}  ${MIGRATIONS_DIR} · ${files.length} migrations · ${probes.length} probes passed${O}`);

if (!res.found) {
  console.log(`\n  ${RED}${B}CANNOT LOCATE THE WRITER${O} — ${res.why}`);
  console.log(`${DIM}  A cap that finds nothing and reports green is a false green. This is a FAILURE.${O}\n`);
  process.exit(1);
}

console.log(`${DIM}  newest definition: ${res.source}${O}`);
console.log(`${DIM}  SET list DERIVED from source (${res.columns.length}): ${res.columns.join(', ')}${O}\n`);

if (res.violations.length) {
  for (const c of res.violations) {
    console.log(`  ${RED}${B}REACHABLE${O}  ${B}${c}${O} — ${FORBIDDEN[c]}`);
  }
  console.log(`\n${RED}${B}✗ FAIL${O} — ${res.violations.length} authority column(s) reachable from ${FN}().`);
  console.log(`${DIM}  The function's column list IS the column-level policy — Postgres RLS has none.${O}`);
  console.log(`${DIM}  Remove the column, or, if this is a deliberate ruling, delete its entry from${O}`);
  console.log(`${DIM}  FORBIDDEN in this file — in the open, with the reason, never by silencing the cap.${O}\n`);
  process.exit(1);
}

for (const c of Object.keys(FORBIDDEN)) console.log(`  ${GRN}ok  ${O} ${B}${c}${O} ${DIM}unreachable from the profile writer${O}`);
console.log(`\n${GRN}${B}✓ PASS${O} — the profile writer's SET list reaches no authority column. ${YEL}Repo corpus only${O}${DIM} — a function replaced in the dashboard is invisible here (§6 r17).${O}\n`);
process.exit(0);
