#!/usr/bin/env node
/**
 * ── A QUERY THAT FEEDS customerDisplayName() MUST SELECT display_name ─────────
 *
 * PURPOSE:      `customerDisplayName()` resolves display_name → organization_name → first+last
 *               → email. It is correct. The defect was never the helper — it was that EVERY
 *               surface query selected only `first_name, last_name`, so the helper was handed
 *               `{first_name: null, last_name: null}` for an organisation and returned its
 *               fallback. 519 of 2,021 LAWNS customers rendered "Unknown customer" or "—"
 *               while `display_name` and `organization_name` sat populated in the row.
 * OUTPUTS:      exit 1 naming each file that feeds the helper from an incomplete select.
 *
 * 🔴 WHY A CAP AND NOT A FIX. The fix is five `select` strings. The RECURRENCE is the problem:
 * the next surface someone writes will select `first_name, last_name` because that is what a
 * customer "obviously" has, hand it to the shared helper, and print the fallback — and it will
 * look like a data problem, not a query one. That is exactly how this lasted until a delivery
 * showed "Unknown customer". A helper cannot defend itself against its own callers.
 *
 * ⚠️ TWO CLAUSES: (1) a file calling customerDisplayName() must select display_name somewhere;
 * (2) no NEW ad-hoc `first_name + last_name` concatenation — use the helper.
 *
 * Run:  node scripts/verify-customer-name-fields.mjs
 *       node scripts/verify-customer-name-fields.mjs --self-test
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Does this source call the helper, and if so does it also select display_name? */
export function nameFieldGap(src) {
  const calls = /customerDisplayName\s*\(/.test(src);
  if (!calls) return null;
  // the select may live in this file or be imported; we can only judge what is here
  // Only judge a file that spells its column list out HERE. A select built from an imported
  // constant (CUSTOMER_SELECT_CORE and friends) is judged where that constant is DEFINED —
  // flagging the caller would report `useStopActions` as broken when the registry it imports
  // already lists display_name. A cap that cannot follow an import must not pretend it can.
  const literalNameSelect = /(?:customers\s*!?[a-z_]*\s*\(|select\(\s*['"`][^'"`]*)\bfirst_name\b/.test(src);
  if (!literalNameSelect) return null;
  return /display_name/.test(src) ? null : 'selects customers with a LITERAL column list that omits display_name, then calls customerDisplayName()';
}

/** An ad-hoc first+last concatenation, which should be the shared helper instead. */
export function adHocConcat(src) {
  const hits = [];
  // 🔴 STRIP COMMENTS FIRST. The first run of this cap flagged `personName.ts` itself — the
  // helper's own doc comment explains the defect by QUOTING the bad pattern, and a check that
  // cannot tell code from prose reports the fix as the fault. Same class as the migration
  // parser that counted commented-out REFERENCES lines (#383).
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  const re = /`\$\{[^}]*first_name[^}]*\}\s*\$\{[^}]*last_name[^}]*\}`|first_name\s*\+\s*['"` ]+\s*\+\s*[a-z.]*last_name/g;
  let m; while ((m = re.exec(src)) !== null) hits.push(m[0].slice(0, 60));
  return hits;
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !n.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

if (process.argv.includes('--self-test')) {
  let passed = 0, failed = 0;
  const ok = (c, m) => { if (c) passed++; else { failed++; console.error('   ✗ ' + m); } };
  const BAD  = `const q = db.from('orders').select('customers ( first_name, last_name )'); customerDisplayName(o.customers, '—');`;
  const GOOD = `const q = db.from('orders').select('customers ( first_name, last_name, display_name )'); customerDisplayName(o.customers, '—');`;
  ok(nameFieldGap(BAD) !== null,  '🔴 P1 THE REAL DEFECT — helper fed from a select without display_name is REFUSED');
  ok(nameFieldGap(GOOD) === null, '🔴 P2 the same file WITH display_name passes');
  ok(nameFieldGap(`customerDisplayName(c, '—')`) === null,
     'P3 a render-only file (no customers query) is not judged — its select lives elsewhere');
  ok(nameFieldGap(`const q = db.from('customers').select(CUSTOMER_SELECT_CORE); customerDisplayName(c, '—');`) === null,
     '🔴 P3b A SELECT FROM AN IMPORTED CONSTANT IS NOT JUDGED HERE — it is judged where the constant is defined. The cap flagged useStopActions, whose registry already lists display_name');
  ok(nameFieldGap(`db.from('orders').select('id, total')`) === null,
     'P4 NEGATIVE CONTROL — a file that never calls the helper is not judged');
  ok(adHocConcat("const n = `${c.first_name} ${c.last_name}`;").length === 1,
     '🔴 P5 an ad-hoc template concatenation is caught');
  ok(adHocConcat("customerDisplayName(c, '—')").length === 0, 'P6 the helper itself is not a concatenation');
  ok(adHocConcat("// first_name and last_name are nullable").length === 0, 'P7 prose mentioning both fields is not a concatenation');
  ok(adHocConcat(" * 🔴 WHY THIS EXISTS: `${first_name} ${last_name}` renders \"null\" when").length === 0,
     '🔴 P8 A DOC COMMENT QUOTING THE BAD PATTERN IS NOT THE BAD PATTERN — the cap flagged the helper that fixes it');
  ok(adHocConcat("/* `${a.first_name} ${a.last_name}` */").length === 0, 'P9 block comments too');
  console.log(`\nverify-customer-name-fields --self-test — ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

const files = [join(ROOT, 'packages'), join(ROOT, 'api')].flatMap(d => { try { return walk(d); } catch { return []; } });
const problems = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const gap = nameFieldGap(src);
  if (gap) problems.push({ file: relative(ROOT, f), why: gap });
  for (const h of adHocConcat(src)) problems.push({ file: relative(ROOT, f), why: `ad-hoc first+last concatenation: ${h}` });
}
if (problems.length) {
  console.error(`\n❌ customer-name-fields FAILED — ${problems.length} surface(s) will render a fallback where a real name exists:\n`);
  for (const p of problems) console.error(`   ${p.file}\n      ${p.why}\n`);
  console.error('   customerDisplayName() resolves display_name → organization_name → first+last → email.');
  console.error('   A select without display_name hands it nulls for every organisation.\n');
  process.exit(1);
}
console.log(`✅ customer-name-fields — ${files.length} files scanned; every customerDisplayName() caller selects display_name.`);
