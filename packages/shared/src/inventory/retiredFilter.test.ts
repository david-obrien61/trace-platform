/**
 * ── retiredFilter — is there a screen left that still shows a retired product? ─────────────
 *
 * 🔴 THIS IS A CORPUS PROBE, NOT A BEHAVIOURAL ONE, AND THAT IS DELIBERATE. `onlyLiveInventory`
 * is four lines and nothing about it can be wrong. What CAN be wrong — and what actually was,
 * for three days after `retired_at` shipped — is that a reader does not call it. That failure has
 * no error, no red, and no symptom except a hidden product sitting on a grid.
 *
 * ⚠️ IT ASSERTS BOTH DIRECTIONS, WHICH IS #73'S LESSON. A hardcoded list of "files that should
 * filter" rots into noise the moment somebody adds a reader. So: every `business_inventory` read
 * in the corpus must EITHER carry the filter OR be declared exempt WITH A REASON — and a
 * declaration for a site that no longer exists FAILS, so the list cannot quietly go stale either.
 *
 * §A  the function does what it says
 * §B  🔴 every business_inventory list-read is filtered or DECLARED exempt, both directions
 * §C  🔴 the exemptions are the ones we meant, each with its reason still true
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/inventory/retiredFilter.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { onlyLiveInventory, RETIRED_COLUMN, RETIRED_HIDDEN_NOTE } from './retiredFilter';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── §A the function ──────────────────────────────────────────────────────────
{
  const seen: [string, unknown][] = [];
  const fake = { is(c: string, v: null) { seen.push([c, v]); return 'FILTERED'; } };
  const out = onlyLiveInventory(fake as any);
  ok(out === 'FILTERED', '§A it returns the builder, so it composes into a chain');
  ok(seen.length === 1 && seen[0][0] === 'retired_at' && seen[0][1] === null,
     '§A it applies exactly `.is(\'retired_at\', null)` — one filter, the right column');
  ok(RETIRED_COLUMN === 'retired_at', '§A the column is named once');
  // ✏️ THIS PROBE WAS WRONG ON ITS FIRST RUN AND THE FIX IS IN THE PROBE. It asserted the word
  // "deleted" must be ABSENT; the sentence's whole job is to say *"hidden, not deleted"*, which is
  // the reassurance an owner needs when 447 products disappear off her screen. Banning the word
  // would have banned the reassurance.
  ok(RETIRED_HIDDEN_NOTE.toLowerCase().includes('hidden'), '§A the sentence says the rows are hidden');
  ok(/not deleted/i.test(RETIRED_HIDDEN_NOTE),
     '§A 🔴 and it says NOT DELETED — the reassurance is the point, not the absence of the word');
}

interface Site { index: number; kind: 'read' | 'write'; filtered: boolean; snippet: string; }

/**
 * Every `business_inventory` statement in a file, classified PER SITE.
 *
 * 🔴 FILE GRANULARITY WAS NOT ENOUGH, AND MUTANTS R1/R2/R3 PROVED IT TWICE. The first version of
 * this cap asked "does this FILE mention the filter anywhere?" — which was green after deleting
 * ONE of the catalogue grid's two reads, and green again after deleting one of the order picker's
 * three. **A file that filters four of its five reads is a file that shows retired products**, and
 * a cap answering at file level cannot see the fifth. (The first version was worse still: it
 * matched the IMPORT line, so it was green with every call site deleted — tech-debt #182's shape,
 * *"a harness that cannot reach its target reports the same as one that passed"*.)
 *
 * A WRITE is exempt by classification rather than by declaration: filtering an UPDATE on
 * `retired_at` would make it silently match zero rows instead of refusing — the A8 defect built on
 * purpose — and an INSERT has no rows to filter.
 */
/**
 * Blank every comment, PRESERVING LENGTH so every index still lines up with the original.
 *
 * 🔴 A `;` INSIDE A COMMENT ENDED A STATEMENT EARLY, AND THAT MADE A CORRECTLY FILTERED READ LOOK
 * BARE. `Dashboard.tsx` carries an explanatory comment containing *"…not merely hidden);"* between
 * `.from('business_inventory')` and its `.is('retired_at', null)` — so a scan that stopped at the
 * first semicolon never reached the filter and reported the inventory-value tile as unguarded.
 * The same shape hid the deliberate SKU-clash exemption in `InventoryCount.tsx`. Blanking rather
 * than deleting keeps the marker lookup below able to use the same indices against the original.
 */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
}

/** The marker a site uses to opt out, IN PLACE, with its reason beside the code it is about. */
const EXEMPT_MARKER = 'RETIRED-FILTER-EXEMPT:';

function sitesIn(src: string): Site[] {
  const code = blankComments(src);
  const sites: Site[] = [];
  const needle = /from\(\s*['"]business_inventory['"]\s*\)/g;
  // A file-level client-side filter (`rows.filter(r => r.retired_at == null)`) covers the reads in
  // that file: uppotPlanRead selects the column deliberately so it can REPORT how many it hid.
  const clientSideFilter = /retired_at\s*==?=?\s*null/.test(code);
  let m: RegExpExecArray | null;
  while ((m = needle.exec(code)) !== null) {
    const i = m.index;
    const before = code.slice(Math.max(0, i - 400), i);
    const rest = code.slice(i);
    const stop = rest.indexOf(';');
    const after = rest.slice(0, stop === -1 ? 700 : stop);
    const kind: 'read' | 'write' = /\.(insert|update|delete)\s*\(/.test(after) ? 'write' : 'read';
    // The marker is read from the ORIGINAL (it lives in a comment), at the same indices.
    const declared = src.slice(Math.max(0, i - 700), i).includes(EXEMPT_MARKER);
    const filtered =
      declared
      || /\.is\(\s*['"]retired_at['"]\s*,\s*null\s*\)/.test(after)
      || /onlyLiveInventory\s*\([^;]*$/.test(before)
      || clientSideFilter;
    sites.push({ index: i, kind, filtered, snippet: after.replace(/\s+/g, ' ').slice(0, 70) });
  }
  return sites;
}

/** A file is filtered when EVERY read site in it is. */
function isFiltered(src: string): boolean {
  const reads = sitesIn(src).filter(s => s.kind === 'read');
  return reads.length > 0 && reads.every(s => s.filtered);
}

/** The read sites that are NOT filtered, for a message that names them. */
function unfilteredReads(src: string): string[] {
  return sitesIn(src).filter(s => s.kind === 'read' && !s.filtered).map(s => s.snippet);
}


/**
 * Sites that read `business_inventory` and DELIBERATELY do not hide retired rows.
 *
 * 🔴 EACH ONE CARRIES ITS REASON, AND EACH REASON IS A CLAIM SOMEBODY CAN CHECK. "Declared" is
 * only better than "forgotten" if the declaration says something.
 */
// ── §A2 the DETECTOR can say no ──────────────────────────────────────────────
{
  // 🔴 A CAP NOBODY HAS WATCHED REFUSE IS A CLAIM (§6 r19b). These are the exact shapes mutants
  // R1–R3 produce, asserted directly so the detector's own blind spot cannot come back.
  ok(!isFiltered("import { onlyLiveInventory } from './retiredFilter';\nconst q = supabase.from('business_inventory').select('*');"),
     '§A2 🔴 an IMPORT of onlyLiveInventory with no CALL is NOT filtered — the defect R1/R2/R3 exposed');
  ok(isFiltered("import { onlyLiveInventory } from './x';\nconst q = await onlyLiveInventory(supabase.from('business_inventory'));"),
     '§A2 an actual call IS filtered');
  ok(isFiltered("const q = supabase.from('business_inventory').select('*').is('retired_at', null);"),
     '§A2 the PostgREST spelling is filtered');
  ok(isFiltered("const q = await supabase.from('business_inventory').select('*');\nconst live = rows.filter((r) => r.retired_at == null);"),
     '§A2 the client-side spelling is filtered — uppotPlanRead needs the count of what it hid');
  ok(!isFiltered("const q = supabase.from('business_inventory').select('retired_at');"),
     '§A2 🔴 merely SELECTING the column is not filtering on it');

  // 🔴 THE PER-SITE CASE — mutants R1/R2/R3 in miniature. One filtered read and one bare one in
  // the same file is NOT a filtered file, and the file-level version of this cap said it was.
  const oneOfTwo =
    "const a = await onlyLiveInventory(supabase.from('business_inventory').select('*'));\n" +
    "const b = await supabase.from('business_inventory').select('*');";
  ok(!isFiltered(oneOfTwo),
     '§A2 🔴 ONE filtered read and ONE bare read in a file is NOT a filtered file — the defect R1/R2/R3 exposed twice');
  ok(unfilteredReads(oneOfTwo).length === 1, '§A2 and the cap can name WHICH read is bare');

  // A WRITE needs no filter, and saying so by classification is what keeps the exemption list
  // short enough to read.
  ok(sitesIn("await supabase.from('business_inventory').update({ x: 1 }).eq('id', i).select('id');")[0].kind === 'write',
     '§A2 an UPDATE is classified as a write, not an unfiltered read');
  ok(sitesIn("await supabase.from('business_inventory').insert(rows).select('id');")[0].kind === 'write',
     '§A2 so is an INSERT');
  ok(sitesIn("await supabase.from('business_inventory').delete().eq('id', i).select('id');")[0].kind === 'write',
     '§A2 and a DELETE');
  ok(sitesIn("await supabase.from('business_inventory').select('id').eq('business_id', b);")[0].kind === 'read',
     '§A2 🔴 and a bare SELECT is a READ — the classifier is not calling everything a write');

  // 🔴 A SEMICOLON INSIDE A COMMENT MUST NOT END THE STATEMENT. This is Dashboard.tsx's real
  // shape, reduced — it made a correctly filtered read report as bare.
  const commented =
    "await supabase\n  .from('business_inventory')\n" +
    "  // the cost is absent from the response, not merely hidden);\n" +
    "  .select('qty')\n  .is('retired_at', null);";
  ok(isFiltered(commented), '§A2 🔴 a `;` inside a COMMENT does not end the statement — Dashboard.tsx reported bare because of one');
  ok(unfilteredReads(commented).length === 0, '§A2 and the site is clean');

  // The in-place exemption marker.
  const marked = "// RETIRED-FILTER-EXEMPT: uniqueness is about what the table HOLDS\n" +
                 "await supabase.from('business_inventory').select('id').ilike('sku', s);";
  ok(isFiltered(marked), '§A2 an in-place RETIRED-FILTER-EXEMPT marker declares a site');
  ok(!isFiltered("await supabase.from('business_inventory').select('id').ilike('sku', s);"),
     '§A2 🔴 and WITHOUT the marker the same site is bare — the marker is doing the work, not the shape');
}

// ── the corpus ───────────────────────────────────────────────────────────────
// The suite is bundled to CJS and run from the repo root (`scripts/run-tests.mjs`), so `cwd` IS
// the root. Asserted below rather than assumed — a scan rooted at the wrong directory would find
// zero readers and report a clean sweep over nothing, which is the false green this file exists
// to prevent in the code it scans.
const ROOT = process.cwd();
const SCAN_ROOTS = ['packages/shared/src', 'packages/cultivar-os/src', 'packages/cultivar-os/api'];

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ((n.endsWith('.ts') || n.endsWith('.tsx')) && !n.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/**
 * Does this file hide retired rows, in ANY of the three legitimate spellings?
 *
 * 🔴 THE THIRD FORM WAS A REAL MISS ON THIS PROBE'S FIRST RUN. `uppotPlanRead.ts` selects
 * `retired_at` and drops the rows IN JAVASCRIPT — `rows.filter(r => r.retired_at == null)` —
 * because it needs the count of what it hid in order to report it. A detector that knew only the
 * PostgREST spellings called the one reader that had been filtering since before the column had a
 * writer "unfiltered". A cap that cannot recognise a correct implementation is a cap that teaches
 * people to route around it.
 */
const EXEMPT: Record<string, string> = {
  'packages/shared/src/discovery/populate.ts':
    'The discovery SEED. It deletes and re-inserts its own SMPL-% sample rows; a retired sample is still a sample it owns, and hiding one would leave an orphan it can never clean up.',
  'packages/shared/src/quickbooks/historyOrderWriter.ts':
    '🔴 `availabilityFingerprint` — a BEFORE/AFTER proof that the order ingest did not move availability. It must read EVERY lot: filtering here would make the fingerprint change because a RETIRE happened, and the proof would report a movement that never occurred.',
  'packages/shared/src/discovery/costDiscovery.ts':
    'An UPDATE addressed by a single row id, not a list read. The id came from a caller that already chose the row.',
  'packages/cultivar-os/api/orders/submit.ts':
    '🔴 OWED, NOT INTENDED. A retired lot cannot be PICKED — stockLineResolver hides it from every scan, search and catalogue read — so this by-id read is only reached with an id the picker handed out. The stronger guard belongs here too, but the second site uses `.single()`, which ERRORS rather than returning null when a filter excludes the row, and re-shaping checkout\'s error path inside a catalogue-import build is scope this build declined.',
  'packages/cultivar-os/src/components/inventory/inventoryEdit.ts':
    '🔴 THE WRITE PATH, NOT A READ. Every statement here is an UPDATE/INSERT/DELETE addressed by a row id (or by variant_group for a group rename) that the caller already chose off a filtered grid. Filtering an UPDATE by retired_at would silently no-op an edit instead of refusing it — the A8 defect manufactured on purpose — and the group rename must still rename a retired sibling or the family splits in two.',
};

// ── §B both directions ───────────────────────────────────────────────────────
{
  const files = SCAN_ROOTS.flatMap(r => walk(join(ROOT, r)));
  ok(files.length > 100, `§B the scan reached the corpus (${files.length} files across ${SCAN_ROOTS.length} roots)`);

  const readers: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!/from\(['"]business_inventory['"]\)/.test(src)) continue;
    readers.push(relative(ROOT, f));
  }
  ok(readers.length > 0, `§B found ${readers.length} files touching business_inventory`);

  const unfiltered: string[] = [];
  for (const rel of readers) {
    if (rel in EXEMPT) continue;
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const bare = unfilteredReads(src);
    if (bare.length > 0) unfiltered.push(`${rel} [${bare.join(' | ')}]`);
  }
  ok(unfiltered.length === 0,
     `§B 🔴 EVERY business_inventory reader hides retired rows or is DECLARED exempt. Unfiltered and undeclared: ${unfiltered.join(', ') || '(none)'}`);

  // 🔴 THE OTHER DIRECTION. A declaration for a file that no longer reads the table — or that has
  // since gained the filter — is STALE and fails here, so the list cannot rot into unread noise.
  const stale: string[] = [];
  for (const rel of Object.keys(EXEMPT)) {
    if (!readers.includes(rel)) { stale.push(`${rel} (no longer reads business_inventory)`); continue; }
    const src = readFileSync(join(ROOT, rel), 'utf8');
    if (src.includes('onlyLiveInventory')) stale.push(`${rel} (now filters — the exemption is obsolete)`);
  }
  ok(stale.length === 0, `§B 🔴 no exemption is STALE: ${stale.join(' · ') || '(none)'}`);
  ok(Object.values(EXEMPT).every(r => r.length > 40), '§B every exemption carries a real reason, not a shrug');
}

// ── §C the surfaces that MUST filter, named ─────────────────────────────────
{
  // These are the screens a person looks at and the paths a person sells through. Naming them
  // individually means a regression says WHICH surface came back, not just that one did.
  const MUST_FILTER: [string, string][] = [
    ['packages/cultivar-os/src/pages/BusinessInventory.tsx', 'the catalogue grid — the surface the ruling was about'],
    ['packages/shared/src/inventory/stockLineResolver.ts',   '🔴 the order picker and the count walk — a hit here is a product about to be SOLD'],
    ['packages/cultivar-os/src/pages/InventoryReconcile.tsx','the reconcile grid'],
    ['packages/cultivar-os/src/pages/InventoryImport.tsx',   'the CSV import matcher — a match would REVIVE a replaced product'],
    ['packages/cultivar-os/src/pages/InventoryCount.tsx',    'the count walk read-back'],
    ['packages/cultivar-os/src/pages/Dashboard.tsx',         'the inventory value tile'],
    ['packages/cultivar-os/api/dashboard.ts',                'the server-side inventory value'],
    ['packages/cultivar-os/src/pages/CostToProduce.tsx',     'the cost surface'],
    ['packages/cultivar-os/src/lib/uppotPlanRead.ts',        'the uppot plan — filtered since 2026-09-05, before anything wrote the column'],
  ];
  for (const [rel, why] of MUST_FILTER) {
    let src = '';
    try { src = readFileSync(join(ROOT, rel), 'utf8'); } catch { /* reported below */ }
    ok(src !== '', `§C ${rel} exists`);
    ok(isFiltered(src), `§C 🔴 ${rel} hides retired rows — ${why}`);
  }
}

console.log(`\nretiredFilter — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
