#!/usr/bin/env node
// ============================================================
// verify-zero-row-writes — A WRITE THAT AFFECTS ZERO ROWS IS A FAILURE AND SAYS SO (A8)
// PURPOSE:      PostgREST returns NO ERROR when an UPDATE matches zero rows. Under RLS, "matched
//               zero rows" is exactly what a REFUSED write looks like — so a mutation that treats
//               "no error" as success tells the user their edit saved when nothing was written, and
//               the caller most likely to hit it is the one who was supposed to be refused.
//               LIVE, not theoretical: `customers_member_update` gates on `customers:update`; a
//               STAFF member holds `customers:read` and not `customers:update`.
// THE RULE:     A mutation reports success only on EVIDENCE IT LANDED. Mechanically a count check,
//               not a redesign: add `.select('id')` and treat an empty result as failure.
// TWO VERDICTS (same shape as the write-path cap, deliberately):
//               · GOAL   — every mutation is row-count-checked. Informational; the known debt stays
//                          VISIBLE rather than becoming invisible.
//               · RATCHET — build-failing: no NEW unchecked mutation vs `zero-row-writes-baseline.json`.
// CLASSIFICATION (a mutation chain is one of):
//               UNCHECKABLE  no `.select()` at all  → cannot check, silent success guaranteed
//               NEEDS_CHECK  `.select()` but no length/single check → selectable, not inspected
//               CHECKED      `.select()` + `.single()` (errors on 0 rows) or an explicit length check
// SCOPE:        `scripts/` is TOOLING — reported, never asserted (a seed that no-ops is not a lie to
//               a user). Stated rather than silently narrowed.
// DEPENDENCIES: none (node stdlib only).
// OUTPUTS:      exit 0 = no new unchecked mutation · 1 = a new one (named) · 2 = own probes failed.
// USAGE:        npm run verify:zero-row-writes · npm run zero-row-writes:baseline
// ============================================================
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE_FILE = join(ROOT, 'zero-row-writes-baseline.json');
const UPDATE = process.argv.includes('--update');

const SCAN_ROOTS = [
  'packages/cultivar-os/src', 'packages/cultivar-os/api',
  'packages/shared/src', 'packages/trace-app/src', 'api', 'scripts',
];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'fixtures']);
const EXCLUDE_FILE = /(\.(test|spec)\.[tj]sx?|verify-zero-row-writes\.mjs)$/;
const SOURCE_EXT   = /\.(ts|tsx|js|jsx|mjs)$/;
const isTooling = p => p.startsWith('scripts/');

// A mutation that is DELIBERATELY unchecked, with its reason. Same discipline as the write-path cap:
// declaring is a decision on the record, not a convenience the builder grants itself.
const ALLOWED_UNCHECKED = {
  // (empty — the 84 known sites are held by the BASELINE, which says "known today", not by
  //  declarations, which would say "correct forever". Different claims.)
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

/** Pure: [{path, content}] → { sites: [{tag, path, verb, status}] } */
export function analyze(files) {
  const sites = [];
  for (const { path, content } of files) {
    const src = stripComments(content);
    const re = /\.(update|delete|upsert)\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      // Must be a supabase query chain — a `.from(` within the preceding window.
      const back = src.slice(Math.max(0, m.index - 300), m.index);
      if (!/\.from\(/.test(back)) continue;

      const rest = src.slice(m.index);
      const semi = rest.indexOf(';');
      const win  = semi === -1 ? rest.slice(0, 500) : rest.slice(0, semi);
      // The statement's assignment target, to look for a length/null check just after it.
      const stmtEnd = semi === -1 ? rest.length : semi;
      const after = rest.slice(stmtEnd, stmtEnd + 400);

      let status;
      if (!/\.select\(/.test(win)) {
        status = 'UNCHECKABLE';                       // no select → the row count never comes back
      } else if (/\.single\(\)/.test(win)) {
        status = 'CHECKED';                           // single() errors (PGRST116) on zero rows
      } else if (/\.length\s*===\s*0|\.length\s*<\s*1|!\s*\w+\?\.\s*length|!\w+\.length|\.length\s*>\s*0|length\s*===\s*0/.test(after)) {
        status = 'CHECKED';                           // explicit affected-row inspection
      } else {
        status = 'NEEDS_CHECK';                       // selectable, not inspected
      }
      const line = src.slice(0, m.index).split('\n').length;
      sites.push({ tag: `${path}:${line}`, path, verb: m[1], status });
    }
  }
  return { sites };
}

export function judge(sites, { baseline = [], allowed = ALLOWED_UNCHECKED } = {}) {
  const known = new Set(baseline);
  const app = sites.filter(s => !isTooling(s.path));
  const bad = app.filter(s => s.status !== 'CHECKED' && !allowed[s.tag]);
  const fresh = bad.filter(s => !known.has(s.tag));
  const fixed = [...known].filter(k => !bad.some(b => b.tag === k));
  return { app, bad, fresh, fixed, tooling: sites.filter(s => isTooling(s.path)) };
}

// ── PROBES (STD-022 — planted, both directions, BEFORE the scan) ─────────────
function runProbes() {
  const R = [];
  const f = (path, content) => ({ path, content });
  const st = (files, i = 0) => analyze(files).sites[i]?.status ?? 'ABSENT';
  const ck = (n, e, g) => R.push({ name: n, expect: e, got: g, ok: e === g });

  ck('Z1 no .select() → UNCHECKABLE (silent success guaranteed)', 'UNCHECKABLE',
    st([f('a.ts', `const { error } = await supabase.from('t').update(p).eq('id', id);`)]));
  ck('Z2 .select().single() → CHECKED (errors on zero rows)', 'CHECKED',
    st([f('a.ts', `const { data } = await supabase.from('t').update(p).eq('id', id).select('id').single();`)]));
  ck('Z3 .select() with a length check after → CHECKED', 'CHECKED',
    st([f('a.ts', `const { data } = await supabase.from('t').update(p).eq('id', id).select('id');\nif (!data?.length) return fail();`)]));
  ck('Z4 🔴 .select() with NO length check → NEEDS_CHECK (selectable, not inspected)', 'NEEDS_CHECK',
    st([f('a.ts', `const { data } = await supabase.from('t').update(p).eq('id', id).select('id');\nreturn ok();`)]));
  ck('Z5 a plain .delete() with no select → UNCHECKABLE', 'UNCHECKABLE',
    st([f('a.ts', `await supabase.from('t').delete().eq('id', id);`)]));
  ck('Z6 a non-supabase .update( is NOT a mutation site', 'ABSENT',
    st([f('a.ts', `myMap.update({ a: 1 });`)]));
  ck('Z7 a comment describing a write is not a write', 'ABSENT',
    st([f('a.ts', `// await supabase.from('t').update(p);`)]));

  // RATCHET, both directions
  const mk = s => analyze([{ path: 'packages/x/a.ts', content: s }]).sites;
  const one = mk(`const { error } = await supabase.from('t').update(p).eq('id', id);`);
  ck('Z8 an unchecked site NOT in the baseline → fails', '1',
    String(judge(one, { baseline: [] }).fresh.length));
  ck('Z9 the SAME site IN the baseline → passes (known debt)', '0',
    String(judge(one, { baseline: ['packages/x/a.ts:1'] }).fresh.length));
  ck('Z10 a baselined site that got FIXED is reported as a win', '1',
    String(judge(mk(`const { data } = await supabase.from('t').update(p).select('id').single();`),
      { baseline: ['packages/x/a.ts:1'] }).fixed.length));
  ck('Z11 scripts/ tooling is reported, never asserted', '0',
    String(judge(analyze([{ path: 'scripts/seed.mjs', content: `await supabase.from('t').update(p);` }]).sites,
      { baseline: [] }).fresh.length));
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
console.log(`\n${B}ZERO-ROW-WRITE CAP — a write that affects zero rows is a failure and says so (A8)${O}\n`);

const probes = runProbes();
console.log(`${B}PROBES (STD-022 — planted, both directions)${O}`);
for (const p of probes) console.log(`  ${p.ok ? GRN+'ok  '+O : RED+'BAD '+O} ${p.name}${p.ok ? '' : `  ${RED}(expected ${p.expect}, got ${p.got})${O}`}`);
if (probes.some(p => !p.ok)) { console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report.${O}\n`); process.exit(2); }

const files = SCAN_ROOTS.flatMap(r => walk(join(ROOT, r))).map(f => ({ path: relative(ROOT, f), content: readFileSync(f, 'utf8') }));
const { sites } = analyze(files);
const baselineDoc = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : null;
const v = judge(sites, { baseline: baselineDoc?.unchecked ?? [] });

if (UPDATE) {
  const out = { _comment: 'Mutation sites that do NOT check affected rows, as of the stamp. RATCHET baseline — the build fails on any NEW one, not on these. Shrink it; never grow it casually. Regenerate: npm run zero-row-writes:baseline', stamped: new Date().toISOString().slice(0, 10), unchecked: v.bad.map(s => s.tag).sort() };
  writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n${GRN}${B}✓ baseline written${O} — ${out.unchecked.length} unchecked app sites → zero-row-writes-baseline.json\n`);
  process.exit(0);
}

const checked = v.app.filter(s => s.status === 'CHECKED');
console.log(`\n${B}SCANNED${O} ${files.length} files · ${D}corpus: ${SCAN_ROOTS.join(' · ')} — ignition-os excluded (frozen donor)${O}`);
console.log(`${B}APP MUTATION SITES${O}  ${GRN}CHECKED ${checked.length}${O} · ${RED}UNCHECKABLE ${v.app.filter(s=>s.status==='UNCHECKABLE').length}${O} · ${YEL}NEEDS_CHECK ${v.app.filter(s=>s.status==='NEEDS_CHECK').length}${O} · ${D}tooling (not asserted) ${v.tooling.length}${O}`);
console.log(`${B}BASELINE${O} ${baselineDoc ? `${baselineDoc.unchecked.length} known, stamped ${baselineDoc.stamped}` : `${YEL}none — run npm run zero-row-writes:baseline${O}`}`);

console.log(`\n${B}${YEL}WHAT THIS CAP CANNOT SEE — printed every run, not discovered later${O}`);
console.log(`  ${D}(1) IT READS PER STATEMENT. A guard covering TWO branches (a write plus its retry)${O}`);
console.log(`  ${D}      reads as unchecked on the second — customerUpsert's retry is the live example.${O}`);
console.log(`  ${D}(2) A check further than ~400 chars after the statement is not seen.${O}`);
console.log(`  ${D}(3) A row-count check performed by a CALLER, not at the write site, is invisible.${O}`);
console.log(`  ${D}So NEEDS_CHECK means "this cap cannot prove it is checked", not "it is unchecked".${O}`);

if (checked.length) {
  console.log(`\n${B}${GRN}CHECKED — these prove the pattern${O}`);
  for (const s of checked) console.log(`  ${s.tag} ${D}[${s.verb}]${O}`);
}
if (v.fixed.length) {
  console.log(`\n${B}${GRN}FIXED SINCE THE BASELINE${O} ${D}— run npm run zero-row-writes:baseline to lock the win${O}`);
  for (const t of v.fixed) console.log(`  ${GRN}−${O} ${t}`);
}
console.log('');
if (v.fresh.length) {
  console.error(`${RED}${B}✗ ${v.fresh.length} NEW mutation site(s) that cannot report a refused write:${O}`);
  for (const s of v.fresh) console.error(`   ${RED}${s.tag}${O} ${D}[${s.verb} · ${s.status}]${O}`);
  console.error(`${D}Add .select('id') and treat an empty result as failure (A8), or declare it with its reason.${O}\n`);
  process.exit(1);
}
console.log(`${GRN}${B}✓ RATCHET CLEAN — no new unchecked mutation.${O} ${D}(${v.bad.length} known, held by the baseline)${O}\n`);
