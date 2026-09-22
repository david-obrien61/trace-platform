#!/usr/bin/env node
/**
 * ── EMBED AMBIGUITY — a PostgREST embed across a DOUBLE foreign key must name it ──
 *
 * PURPOSE:      When two tables are joined by MORE THAN ONE foreign key, PostgREST cannot
 *               guess which one an embed means. It refuses the whole request with
 *               HTTP 300 / PGRST201 — so the SCREEN DOES NOT RENDER AT ALL. The embed must
 *               name the constraint: `customers!orders_customer_id_fkey ( … )`.
 * DEPENDENCIES: the migration corpus (FK topology is DERIVED from it, never hardcoded).
 * OUTPUTS:      exit 1 naming every un-disambiguated embed across an ambiguous pair.
 *
 * 🔴 THE INCIDENT THIS EXISTS FOR — 2026-09-22, ledger #383, ON A SCREEN LAUREN USES.
 * `20260921b_capture_relink.sql` added `orders.relinked_from_customer_id` REFERENCES
 * `customers(id)`. That gave `orders → customers` a SECOND foreign key, and every existing
 * embed of customers from orders became ambiguous the moment the migration was applied.
 * `/orders/:id` died with *"Could not embed because more than one relationship was found
 * for 'orders' and 'customers'"*. **Six embed sites broke at once, none of them edited.**
 *
 * ⚠️ THE PROPERTY THAT MAKES THIS WORTH A CAP RATHER THAN A FIX: the breakage is at a
 * DISTANCE. Adding a nullable column with a foreign key is one of the safest-looking
 * migrations there is — it changes no existing row and no existing query text — and it
 * silently invalidates every embed between those two tables, in files the migration's
 * author never opened. Nothing in the repo connected the two facts. This does.
 *
 * Run:  node scripts/verify-embed-ambiguity.mjs
 *       node scripts/verify-embed-ambiguity.mjs --self-test
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Count foreign keys per (child → parent) pair, DERIVED from the migration corpus. */
export function ambiguousPairs(sqlText) {
  const fks = new Map();                       // "child>parent" -> count
  // Track the table each statement is about: CREATE TABLE x / ALTER TABLE x
  let current = null;
  for (const raw of sqlText.split('\n')) {
    const line = raw.replace(/--.*$/, '');
    const t = line.match(/\b(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE(?:\s+IF\s+EXISTS)?)\s+(?:public\.)?["]?([a-z_]+)["]?/i);
    if (t) current = t[1].toLowerCase();
    if (!current) continue;
    const r = line.match(/\bREFERENCES\s+(?:public\.)?["]?([a-z_]+)["]?/i);
    if (!r) continue;
    const parent = r[1].toLowerCase();
    if (parent === 'auth') continue;           // auth.users lives in another schema
    // `REFERENCES` also appears in prose and in ON DELETE/ON UPDATE tails; a SQL keyword is
    // never a table name. Without this the corpus parse emitted `businesses>on`, which is the
    // kind of junk row that teaches a reader to skim the output (#73).
    if (['on', 'no', 'set', 'cascade', 'null', 'default', 'action', 'restrict'].includes(parent)) continue;
    const key = `${current}>${parent}`;
    fks.set(key, (fks.get(key) ?? 0) + 1);
  }
  return new Set([...fks.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

/**
 * Find embeds of `parent` in a select string whose base table is `child`.
 * An embed is disambiguated when the table token is followed by `!constraint`.
 */
export function findBareEmbeds(source, child, parent) {
  const hits = [];
  // the base table must appear as .from('child') somewhere in the file
  if (!new RegExp(`\\.from\\(\\s*['"\`]${child}['"\`]`).test(source)) return hits;
  const re = new RegExp(`(^|[^!\\w])${parent}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(source)) !== null) {
    const before = source.slice(Math.max(0, m.index - 120), m.index);
    // skip prose: a comment line, or a word-boundary use inside a sentence
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const line = source.slice(lineStart, source.indexOf('\n', m.index) === -1 ? source.length : source.indexOf('\n', m.index));
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (/`[^`]*$/.test(before) === false && !/['"`][^'"`]*$/.test(before) && !/,\s*$/.test(before) && !/\(\s*$/.test(before)) {
      // not obviously inside a select string or a template literal — still record, but only
      // when the line looks like a column list rather than English prose
      if (!/[,(]\s*$/.test(before) && !/^\s*[a-z_!]+\s*\(/.test(line)) continue;
    }
    if (source.slice(m.index, m.index + parent.length + 1).includes('!')) continue;
    const lineNo = source.slice(0, m.index).split('\n').length;
    hits.push({ line: lineNo, text: line.trim().slice(0, 110) });
  }
  return hits;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

if (process.argv.includes('--self-test')) {
  let passed = 0, failed = 0;
  const ok = (c, m) => { if (c) passed++; else { failed++; console.error('   ✗ ' + m); } };

  const SQL_ONE = `CREATE TABLE public.orders ( customer_id uuid REFERENCES public.customers(id) );`;
  const SQL_TWO = SQL_ONE + `\nALTER TABLE public.orders ADD COLUMN relinked_from_customer_id uuid REFERENCES public.customers(id);`;

  ok(ambiguousPairs(SQL_ONE).size === 0, 'P1 ONE foreign key between two tables is not ambiguous');
  ok(ambiguousPairs(SQL_TWO).has('orders>customers'),
     '🔴 P2 THE REAL DEFECT — a SECOND FK makes orders>customers ambiguous (20260921b)');
  ok(!ambiguousPairs(SQL_TWO).has('customers>orders'), 'P3 the pair is directional — the reverse is not implied');
  ok(ambiguousPairs(`CREATE TABLE x ( a uuid REFERENCES auth.users(id), b uuid REFERENCES auth.users(id) );`).size === 0,
     'P4 auth.users is another schema and is not counted');

  const BARE  = `const q = supabase.from('orders').select(\`id, customers ( first_name )\`);`;
  const NAMED = `const q = supabase.from('orders').select(\`id, customers!orders_customer_id_fkey ( first_name )\`);`;
  ok(findBareEmbeds(BARE, 'orders', 'customers').length === 1,
     '🔴 P5 the AMBIGUOUS form is caught — including with a space before the paren, which is how the live one was written');
  ok(findBareEmbeds(NAMED, 'orders', 'customers').length === 0, '🔴 P6 the NAMED form passes');
  ok(findBareEmbeds(`supabase.from('orders').select('id, customers(first_name)')`, 'orders', 'customers').length === 1,
     'P7 no-space form is caught too');
  ok(findBareEmbeds(`supabase.from('deliveries').select('id, customers ( first_name )')`, 'orders', 'customers').length === 0,
     '🔴 P8 NEGATIVE CONTROL — a deliveries-based embed of customers is NOT flagged; deliveries>customers has one FK');
  ok(findBareEmbeds(`// we join customers (the roster) here\nsupabase.from('orders').select('id')`, 'orders', 'customers').length === 0,
     'P9 a COMMENT mentioning "customers (" is not an embed');

  ok(!ambiguousPairs(`ALTER TABLE businesses ADD CONSTRAINT x FOREIGN KEY (a) REFERENCES on DELETE CASCADE;\nALTER TABLE businesses ADD CONSTRAINT y FOREIGN KEY (b) REFERENCES on DELETE CASCADE;`).has('businesses>on'),
     '🔴 P10 a SQL keyword is never a table — the first version emitted businesses>on as a real pair');

  console.log(`\nverify-embed-ambiguity --self-test — ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

const sql = readdirSync(join(ROOT, 'supabase/migrations'))
  .filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8')).join('\n');

// DECLARED ∪ DERIVED. The declaration carries the pairs a static read cannot see (see the
// `why_declared_and_not_derived` field in the JSON — orders>customers is live-only, tech-debt
// #39); the corpus parse catches any future double FK written as a migration with no edit here.
const decl = JSON.parse(readFileSync(join(ROOT, 'embed-ambiguity-pairs.json'), 'utf8'));
const declared = new Set(decl.pairs.map(p => `${p.child}>${p.parent}`));
const derived = ambiguousPairs(sql);
const pairs = new Set([...declared, ...derived]);

// 🔴 THE DECLARATION ASSERTS ITSELF. A declared pair naming fewer than two constraints is a
// typo or a stale entry, and a stale entry here reads as safety. Fail loudly (#73's lesson).
for (const p of decl.pairs) {
  if (!Array.isArray(p.constraints) || p.constraints.length < 2) {
    console.error(`\n❌ embed-ambiguity — declaration for ${p.child}>${p.parent} names ${p.constraints?.length ?? 0} constraint(s); a pair is ambiguous only with two or more.`);
    process.exit(1);
  }
}

const files = [join(ROOT, 'packages'), join(ROOT, 'api')].flatMap(d => { try { return walk(d); } catch { return []; } });
const problems = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const pair of pairs) {
    const [child, parent] = pair.split('>');
    for (const hit of findBareEmbeds(src, child, parent)) {
      problems.push({ file: relative(ROOT, f), line: hit.line, child, parent, text: hit.text });
    }
  }
}

console.log(`embed-ambiguity — ${pairs.size} ambiguous table pair(s) (${declared.size} declared, ${derived.size} derived from the migration corpus):`);
for (const p of pairs) console.log(`   · ${p.replace('>', ' → ')}`);

if (problems.length > 0) {
  console.error(`\n❌ embed-ambiguity FAILED — ${problems.length} embed(s) that PostgREST will refuse (HTTP 300 / PGRST201):\n`);
  for (const p of problems) {
    console.error(`   ${p.file}:${p.line}`);
    console.error(`      ${p.text}`);
    console.error(`      ${p.child} → ${p.parent} has more than one foreign key. Name it: ${p.parent}!<constraint>_fkey ( … )\n`);
  }
  console.error('   An ambiguous embed does not degrade — the whole request 300s and the screen renders nothing.\n');
  process.exit(1);
}
console.log(`✅ embed-ambiguity — ${files.length} files scanned, every embed across an ambiguous pair names its constraint.`);
