#!/usr/bin/env node
// ============================================================
// verify-field-lists — ONE DERIVED FIELD DECLARATION PER ENTITY (A4)
// PURPOSE:      A field added to the form but missed in a hand-written column list reads back null
//               forever, and nothing in the codebase can notice. `customers` carried SIX parallel
//               enumerations; `cost_objects` is read through FOUR different hand-written select
//               strings in four files. This cap counts them.
// THE RULE:     An entity has ONE field declaration and everything derives from it. More than one
//               HAND-WRITTEN enumeration FAILS unless declared.
// WHAT COUNTS AS AN ENUMERATION (and why this is the honest bound):
//               A multi-column column-list STRING LITERAL (>= 3 columns) reaching `.select()` —
//               either inline, or via a `const X = 'a,b,c'` resolved within the same file.
//               A select built from a DERIVED constant (an import, e.g. `CUSTOMER_SELECT_FULL`) is
//               NOT an enumeration — that is the registry doing its job, which is how phase-A work
//               earns credit rather than being asserted.
// 🔴 NOT DETECTED, stated every run rather than absorbed:
//               (1) TypeScript interfaces / type unions listing DB columns;
//               (2) payload OBJECT LITERALS built field-by-field for an insert/update;
//               (3) `select('*')`, which has no list to count.
//               So every count here is a FLOOR — `customers` really had six lists; this cap can see
//               the subset that is a column string.
// TWO VERDICTS: GOAL (one enumeration per entity — informational, keeps the debt visible) and
//               RATCHET (build-failing: no NEW enumeration vs `field-lists-baseline.json`).
// DEPENDENCIES: none (node stdlib only).
// OUTPUTS:      exit 0 = no new enumeration · 1 = a new one (named) · 2 = own probes failed.
// USAGE:        npm run verify:field-lists · npm run field-lists:baseline
// ============================================================
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE_FILE = join(ROOT, 'field-lists-baseline.json');
const UPDATE = process.argv.includes('--update');

const SCAN_ROOTS = [
  'packages/cultivar-os/src', 'packages/cultivar-os/api',
  'packages/shared/src', 'packages/trace-app/src', 'api', 'scripts',
];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'fixtures']);
const EXCLUDE_FILE = /(\.(test|spec)\.[tj]sx?|verify-field-lists\.mjs)$/;
const SOURCE_EXT   = /\.(ts|tsx|js|jsx|mjs)$/;
const isTooling = p => p.startsWith('scripts/');

const MIN_COLUMNS = 3;                       // 'id,name' is a lookup; three is a list someone maintains
const COLUMN_LIST = /^[a-z_][a-z0-9_]*(\s*,\s*[a-z_][a-z0-9_]*){2,}$/i;

// An entity deliberately carrying more than one enumeration, WITH ITS REASON. Same discipline as the
// other caps: a decision on the record, never a convenience the builder grants itself.
const ALLOWED_DIVERGENCE = {
  // APPROVED 2026-07-29 (David). THE DISTINCTION IS THE POINT OF THE ENTRY, so the next reader does
  // not "fix" it: these are 3-column lookup PROJECTIONS, not record shapes. A4 exists to stop a
  // RECORD's field set being restated in many places; a projection selecting three columns to answer
  // ONE question is a different thing, and forcing a derivation would make the code worse to satisfy
  // a rule aimed elsewhere. `customers`' record shape IS derived — customerFieldRegistry.ts.
  customers: {
    reason: '3-column lookup PROJECTIONS, not record shapes: the QBO invoice reads the billing '
          + 'address it is about to push, and customerUpsert reads the org dedup key '
          + '(name + billing address). A4 targets a restated RECORD field set; the record shape '
          + 'is derived in customerFieldRegistry.ts.',
    paths: ['packages/cultivar-os/api/qbo/invoice/cultivar.ts',
            'packages/shared/src/business-logic/customerUpsert.ts'],
  },
};

function stripComments(src) {
  // Replace a block comment with the SAME NUMBER OF NEWLINES, never with ''. Collapsing it shifted
  // every reported line number after it — DeliverySchedule's real site at :146 was reported as :121,
  // which sends a reader to a line that is not the defect. A cap whose citation is wrong is worse
  // than one that says nothing, because the reader concludes the cap is broken and stops reading it.
  return src.replace(/\/\*[\s\S]*?\*\//g, m => '\n'.repeat((m.match(/\n/g) ?? []).length))
    .split('\n')
    .map(l => { const t = l.trimStart(); return t.startsWith('//') || t.startsWith('*') ? '' : l; })
    .join('\n');
}

/** Pure: [{path, content}] → Map(entity → [{path, line, cols, via}]) */
export function analyze(files) {
  const byEntity = new Map();
  for (const { path, content } of files) {
    const src = stripComments(content);

    // `const BASE = 'id,name,sku'` → resolvable within this file.
    const consts = new Map();
    const cre = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`]+)\2/g;
    let c;
    while ((c = cre.exec(src)) !== null) {
      if (COLUMN_LIST.test(c[3].trim())) consts.set(c[1], c[3].trim());
    }

    const fromRe = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    let m;
    while ((m = fromRe.exec(src)) !== null) {
      const entity = m[2];
      const rest = src.slice(m.index);
      const semi = rest.indexOf(';');
      const win  = semi === -1 ? rest.slice(0, 600) : rest.slice(0, semi);

      const sel = win.match(/\.select\(\s*(?:(['"`])([^'"`]*)\1|([A-Za-z_$][\w$]*))/);
      if (!sel) continue;

      let cols = null, via = 'inline';
      if (sel[2] !== undefined) {
        cols = sel[2].trim();
      } else if (sel[3]) {
        // A locally-declared column string counts; an IMPORTED constant is a derivation, not a list.
        if (consts.has(sel[3])) { cols = consts.get(sel[3]); via = `const ${sel[3]}`; }
        else continue; // derived / opaque → the registry doing its job
      }
      if (!cols || !COLUMN_LIST.test(cols)) continue;      // '*', 'id', 'id,name' → not a maintained list
      if (cols.split(',').length < MIN_COLUMNS) continue;

      const line = src.slice(0, m.index).split('\n').length;
      if (!byEntity.has(entity)) byEntity.set(entity, []);
      byEntity.get(entity).push({ path, line, cols, via, tag: `${path}:${line}` });
    }
  }
  return byEntity;
}

export function judge(byEntity, { baseline = [], allowed = ALLOWED_DIVERGENCE } = {}) {
  const known = new Set(baseline);
  const rows = [];
  for (const [entity, listsAll] of byEntity) {
    const lists = listsAll.filter(l => !isTooling(l.path));
    if (!lists.length) continue;
    // Two enumerations with IDENTICAL columns are one list copied — still a violation, and worth
    // naming as a copy rather than as a divergence, because the fix differs.
    const distinct = new Set(lists.map(l => l.cols.split(',').map(s => s.trim()).sort().join(',')));
    const declared = allowed[entity];
    const goal = lists.length <= 1 ? 'PASS'
      : declared && lists.every(l => declared.paths.includes(l.path)) ? 'PASS' : 'FAIL';
    const fresh = lists.filter(l => !known.has(l.tag) && !(declared?.paths.includes(l.path)));
    rows.push({ entity, lists, distinct: distinct.size, goal, fresh, declared,
                tooling: listsAll.filter(l => isTooling(l.path)) });
  }
  rows.sort((a, b) => b.lists.length - a.lists.length || a.entity.localeCompare(b.entity));
  return rows;
}

// ── PROBES (STD-022 — planted, both directions, BEFORE the scan) ─────────────
function runProbes() {
  const R = [], f = (path, content) => ({ path, content });
  const ck = (n, e, g) => R.push({ name: n, expect: e, got: g, ok: e === g });
  const goal = (files, entity, o) => judge(analyze(files), o).find(r => r.entity === entity)?.goal ?? 'ABSENT';
  const count = (files, entity) => judge(analyze(files), {}).find(r => r.entity === entity)?.lists.length ?? 0;

  ck('F1 two hand-written column strings for one entity → FAIL', 'FAIL', goal([
    f('packages/a.ts', `supabase.from('t').select('id,name,sku');`),
    f('packages/b.ts', `supabase.from('t').select('id,name,qty');`)], 't', {}));
  ck('F2 one column string → PASS', 'PASS',
    goal([f('packages/a.ts', `supabase.from('t').select('id,name,sku');`)], 't', {}));
  ck('F3 🔴 a select from an IMPORTED derived constant is NOT an enumeration', 'ABSENT',
    goal([f('packages/a.ts', `import { T_COLS } from './reg';\nsupabase.from('t').select(T_COLS);`)], 't', {}));
  ck('F4 a LOCAL const column string IS an enumeration (the ScanOrder shape)', '1', String(count([
    f('packages/a.ts', `const BASE = 'id,first_name,last_name,phone';\nsupabase.from('t').select(BASE);`)], 't')));
  ck("F5 select('*') has no list to count", 'ABSENT',
    goal([f('packages/a.ts', `supabase.from('t').select('*');`)], 't', {}));
  ck('F6 a two-column lookup is not a maintained list', 'ABSENT',
    goal([f('packages/a.ts', `supabase.from('t').select('id,name');`)], 't', {}));
  ck('F7 a comment describing a select is not a select', 'ABSENT',
    goal([f('packages/a.ts', `// supabase.from('t').select('id,name,sku');`)], 't', {}));
  ck('F8 identical columns in two files is a COPY — still a violation', 'FAIL', goal([
    f('packages/a.ts', `supabase.from('t').select('id,name,sku');`),
    f('packages/b.ts', `supabase.from('t').select('id,name,sku');`)], 't', {}));
  ck('F9 two DECLARED enumerations → PASS', 'PASS', goal([
    f('packages/a.ts', `supabase.from('t').select('id,name,sku');`),
    f('packages/b.ts', `supabase.from('t').select('id,name,qty');`)],
    't', { allowed: { t: { reason: 'probe', paths: ['packages/a.ts', 'packages/b.ts'] } } }));
  ck('F10 scripts/ tooling is reported, never asserted', 'ABSENT', goal([
    f('scripts/s.mjs', `supabase.from('t').select('id,name,sku');`),
    f('scripts/u.mjs', `supabase.from('t').select('id,name,qty');`)], 't', {}));
  // RATCHET
  const two = [f('packages/a.ts', `supabase.from('t').select('id,name,sku');`),
               f('packages/b.ts', `supabase.from('t').select('id,name,qty');`)];
  ck('F11 a NEW enumeration not in the baseline → fails', '1',
    String(judge(analyze(two), { baseline: ['packages/a.ts:1'] }).find(r => r.entity === 't').fresh.length));
  ck('F12 both in the baseline → passes (known debt)', '0',
    String(judge(analyze(two), { baseline: ['packages/a.ts:1', 'packages/b.ts:1'] }).find(r => r.entity === 't').fresh.length));
  return R;
}

function walk(dir, out = []) {
  let e; try { e = readdirSync(dir); } catch { return out; }
  for (const x of e) {
    if (EXCLUDE_DIRS.has(x)) continue;
    const full = join(dir, x);
    let s; try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(x) && !EXCLUDE_FILE.test(x)) out.push(full);
  }
  return out;
}

const B='\x1b[1m', D='\x1b[2m', RED='\x1b[31m', GRN='\x1b[32m', YEL='\x1b[33m', O='\x1b[0m';
console.log(`\n${B}FIELD-LIST CAP — one derived field declaration per entity (A4)${O}\n`);

const probes = runProbes();
console.log(`${B}PROBES (STD-022 — planted, both directions)${O}`);
for (const p of probes) console.log(`  ${p.ok ? GRN+'ok  '+O : RED+'BAD '+O} ${p.name}${p.ok ? '' : `  ${RED}(expected ${p.expect}, got ${p.got})${O}`}`);
if (probes.some(p => !p.ok)) { console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report.${O}\n`); process.exit(2); }

const files = SCAN_ROOTS.flatMap(r => walk(join(ROOT, r))).map(f => ({ path: relative(ROOT, f), content: readFileSync(f, 'utf8') }));
const byEntity = analyze(files);
const baselineDoc = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : null;
const rows = judge(byEntity, { baseline: baselineDoc?.enumerations ?? [] });

if (UPDATE) {
  const out = { _comment: 'Hand-written column enumerations per entity as of the stamp. RATCHET baseline — the build fails on any NEW one, not on these. Shrink it; never grow it casually. Regenerate: npm run field-lists:baseline', stamped: new Date().toISOString().slice(0, 10), enumerations: rows.flatMap(r => r.lists.map(l => l.tag)).sort() };
  writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n${GRN}${B}✓ baseline written${O} — ${out.enumerations.length} enumerations → field-lists-baseline.json\n`);
  process.exit(0);
}

const fails = rows.filter(r => r.goal === 'FAIL');
const fresh = rows.filter(r => r.fresh.length);
console.log(`\n${B}SCANNED${O} ${files.length} files · ${D}corpus: ${SCAN_ROOTS.join(' · ')}${O}`);
console.log(`${B}BASELINE${O} ${baselineDoc ? `${baselineDoc.enumerations.length} known, stamped ${baselineDoc.stamped}` : `${YEL}none — run npm run field-lists:baseline${O}`}\n`);

console.log(`${B}HAND-WRITTEN COLUMN ENUMERATIONS BY ENTITY${O}`);
for (const r of rows) {
  const tag = r.goal === 'FAIL' ? `${RED}FAIL${O}` : `${GRN}PASS${O}`;
  console.log(`\n  ${tag}  ${B}${r.entity}${O} — ${r.lists.length} enumeration${r.lists.length === 1 ? '' : 's'}${r.distinct < r.lists.length ? ` ${D}(${r.lists.length - r.distinct} a verbatim COPY)${O}` : ''}${r.declared ? ` ${D}(declared: ${r.declared.reason})${O}` : ''}`);
  for (const l of r.lists) {
    const isNew = r.fresh.includes(l);
    console.log(`         ${isNew ? RED+'+NEW'+O : D+'   ·'+O} ${l.tag} ${D}[${l.via}] ${l.cols.split(',').length} cols${O}`);
  }
  if (r.tooling.length) console.log(`         ${D}+ ${r.tooling.length} tooling${O}`);
}

console.log(`\n${B}${YEL}NOT DETECTED — every count above is a FLOOR${O}`);
console.log(`  ${D}(1) TypeScript interfaces / unions listing DB columns${O}`);
console.log(`  ${D}(2) payload OBJECT LITERALS built field-by-field for an insert/update${O}`);
console.log(`  ${D}(3) select('*') — no list to count${O}`);
console.log(`  ${D}customers really had SIX lists; this cap sees only the ones that are column strings.${O}`);

console.log(`\n${B}SUMMARY${O}  goal: ${fails.length} entit${fails.length === 1 ? 'y' : 'ies'} with more than one hand-written field list`);
if (fresh.length) {
  console.error(`\n${RED}${B}✗ RATCHET — ${fresh.length} entit${fresh.length === 1 ? 'y' : 'ies'} gained a NEW hand-written field list:${O}`);
  for (const r of fresh) for (const l of r.fresh) console.error(`   ${RED}${r.entity}${O}: ${l.tag}`);
  console.error(`${D}Derive it from the entity's field registry, or declare it with its reason.${O}\n`);
  process.exit(1);
}
console.log(`${GRN}${B}✓ RATCHET CLEAN — no entity gained a field list.${O}\n`);
