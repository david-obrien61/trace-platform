/**
 * -- measure-vendor-strings -- READ-ONLY census of receipts.vendor --------------------
 *
 * PURPOSE:      Section 7 of the vendor-identity build: RE-MEASURE the live vendor strings
 *               before the resolver keys on them. The Stage 0 recon cited spellings from the
 *               discovery doc and the #252/#254 records and said plainly it had NOT queried
 *               the database. R-26 exempts nobody, including a recon that admits its own
 *               limits. This is the measurement that closes that gap.
 * DEPENDENCIES: SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local (root or cultivar-os);
 *               @supabase/supabase-js.
 * OUTPUTS:      A population/census table on stdout. WRITES NOTHING -- every call is
 *               .select(). No insert, no update, no delete, no rpc.
 *
 * Every count states the POPULATION it was taken over, not only the rows that matched:
 * a pass over an empty set is a failure, not a pass.
 *
 * Run: node scripts/measure-vendor-strings.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const CANDIDATES = [
  new URL('../.env.local', import.meta.url).pathname,
  new URL('../packages/cultivar-os/.env.local', import.meta.url).pathname,
  '/Users/terrenceobrien/Desktop/trace-platform/.env.local',
  '/Users/terrenceobrien/Desktop/trace-platform/packages/cultivar-os/.env.local',
];
for (const p of CANDIDATES) {
  let text = '';
  try { text = readFileSync(p, 'utf8'); } catch { continue; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    const v = m && m[2].replace(/^["']|["']$/g, '');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY -- cannot measure.'); process.exit(2); }
const db = createClient(url, key);

const die = (what, err) => { console.error(`READ FAILED -- ${what}: ${err.message}`); process.exit(1); };
const norm = (s) => (s ?? '').trim().toLowerCase();

console.log(`\n== receipts.vendor -- LIVE CENSUS, measured ${new Date().toISOString()} ==\n`);

// -- 1. every receipt, every tenant --------------------------------------------------
const { data: rows, error: e1 } = await db
  .from('receipts')
  .select('id, business_id, vendor, date, amount, created_at, ocr_raw');
if (e1) die('receipts', e1);

console.log(`POPULATION: ${rows.length} receipt rows across ${new Set(rows.map(r => r.business_id)).size} business_id(s)\n`);

// -- 2. the distinct vendor strings, EXACTLY as stored -------------------------------
const exact = new Map();
for (const r of rows) {
  const k = r.vendor === null ? ' NULL' : r.vendor;
  exact.set(k, (exact.get(k) ?? 0) + 1);
}
console.log(`-- DISTINCT vendor strings, verbatim (population: ${rows.length} rows) --`);
console.log(`   distinct values: ${exact.size}\n`);
for (const [v, n] of [...exact.entries()].sort((a, b) => b[1] - a[1])) {
  const shown = v === ' NULL' ? '(NULL)' : JSON.stringify(v);   // JSON.stringify exposes trailing spaces
  console.log(`   ${String(n).padStart(3)} x  ${shown}`);
}

// -- 2b. per-tenant -- the resolver is business_id-scoped (AC-3), so the census must be
//     too. A vendor string is only a duplicate of another WITHIN one tenant.
const byBiz = new Map();
for (const r of rows) {
  if (!byBiz.has(r.business_id)) byBiz.set(r.business_id, []);
  byBiz.get(r.business_id).push(r);
}
console.log(`\n-- PER TENANT (population: ${rows.length} rows, ${byBiz.size} tenants) --`);
for (const [b, rs] of [...byBiz.entries()].sort((a, b2) => b2[1].length - a[1].length)) {
  const vs = [...new Set(rs.map((r) => r.vendor))];
  console.log(`   ${b}  ${String(rs.length).padStart(3)} rows  ${vs.length} distinct vendor(s)`);
  for (const v of vs) console.log(`        ${v === null ? '(NULL)' : JSON.stringify(v)}`);
}

// -- 3. what norm() collapses -- the CountOnceSeam:201 function, applied --------------
const normed = new Map();
for (const [v, n] of exact.entries()) {
  if (v === ' NULL') continue;
  const k = norm(v);
  if (!normed.has(k)) normed.set(k, { spellings: new Set(), rows: 0 });
  const e = normed.get(k);
  e.spellings.add(v); e.rows += n;
}
const collapsed = [...normed.entries()].filter(([, e]) => e.spellings.size > 1);
console.log(`\n-- norm() COLLAPSE (trim+lowercase, CountOnceSeam.ts:201) --`);
console.log(`   population: ${exact.size - (exact.has(' NULL') ? 1 : 0)} non-null distinct strings`);
console.log(`   distinct after norm(): ${normed.size}`);
console.log(`   groups where norm() merges >1 spelling: ${collapsed.length}`);
for (const [k, e] of collapsed) console.log(`     "${k}" <- ${[...e.spellings].map(s => JSON.stringify(s)).join('  |  ')}`);

// -- 4. the pairs norm() does NOT collapse but a human would -- prefix containment ----
//    Reported as CANDIDATES for the owner to confirm. Never a merge, never a claim.
const keys = [...normed.keys()].sort();
const nearby = [];
for (let i = 0; i < keys.length; i++)
  for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j];
    if (a !== b && (b.startsWith(a) || a.startsWith(b))) nearby.push([a, b]);
  }
console.log(`\n-- PREFIX-CONTAINED PAIRS norm() does NOT merge --`);
console.log(`   population: ${keys.length} normalised strings, ${keys.length * (keys.length - 1) / 2} pairs compared`);
console.log(`   candidate pairs: ${nearby.length}`);
for (const [a, b] of nearby) console.log(`     "${a}"  <->  "${b}"`);

// -- 5. the ocr_raw key inventory -- what is ACTUALLY stored, not what we hope --------
const keyCount = new Map();
let withOcr = 0;
for (const r of rows) {
  if (!r.ocr_raw || typeof r.ocr_raw !== 'object') continue;
  withOcr++;
  for (const k of Object.keys(r.ocr_raw)) keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
}
console.log(`\n-- ocr_raw TOP-LEVEL KEYS (population: ${rows.length} rows) --`);
console.log(`   rows carrying a non-null ocr_raw: ${withOcr}`);
for (const [k, n] of [...keyCount.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`   ${String(n).padStart(3)} x  ${k}`);

// -- 6. IDENTITY SIGNALS -- the decisive measurement for the resolver ----------------
//    The build ranks email domain > account number > address > name. Section 5 shows
//    ocr_raw holds the RAW PROVIDER ENVELOPE, so a top-level key scan proves nothing.
//    Dig into the model's own text output, which is where a parsed field would live.
const emailRe = /[\w.+-]+@[\w-]+\.[\w.]+/g;
let textOk = 0, hasEmail = 0, hasAddr = 0, hasAcct = 0;
const emails = new Set();
const modelKeys = new Map();
for (const r of rows) {
  const raw = r.ocr_raw;
  if (!raw) continue;
  let text = '';
  if (Array.isArray(raw.candidates)) text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  else if (Array.isArray(raw.content)) text = raw.content?.[0]?.text ?? '';
  if (!text) continue;
  textOk++;
  const found = text.match(emailRe);
  if (found) { hasEmail++; found.forEach((e) => emails.add(e)); }
  if (/address|street|city|zip/i.test(text)) hasAddr++;
  if (/account|acct|customer\s*(no|number|#)/i.test(text)) hasAcct++;
  try {
    const j = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim());
    for (const k of Object.keys(j)) modelKeys.set(k, (modelKeys.get(k) ?? 0) + 1);
  } catch { /* not clean JSON -- counted by textOk, not by modelKeys */ }
}
console.log(`\n-- IDENTITY SIGNALS inside the model's own output (population: ${rows.length} rows) --`);
console.log(`   rows whose envelope yielded model text:  ${textOk}`);
console.log(`   ...containing an email:                  ${hasEmail}`);
console.log(`   ...mentioning address/street/city/zip:   ${hasAddr}`);
console.log(`   ...mentioning account/customer number:   ${hasAcct}`);
console.log(`   distinct emails seen: ${[...emails].join(', ') || '(none)'}`);

console.log(`\n-- FIELDS the OCR model emits (population: ${textOk} rows with model text) --`);
if (modelKeys.size === 0) console.log('   (no row parsed as clean JSON)');
for (const [k, n] of [...modelKeys.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`   ${String(n).padStart(3)} x  ${k}`);

console.log('\n-- END. Nothing was written. --\n');
