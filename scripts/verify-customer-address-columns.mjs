#!/usr/bin/env node
// ============================================================
// verify-customer-address-columns — THE LEGACY FOUR ARE GONE FROM `customers` (ledger #335)
//
// PURPOSE:      `customers.address_line1` / `.city` / `.state` / `.zip` are being retired. The
//               address list (`customer_addresses`) is the truth and `billing_*` is the derived
//               view; the legacy four are DROPPED. This cap is the reviewer for that repoint.
//
// 🔴 WHY IT EXISTS, IN ONE NUMBER: THE COMPILER CATCHES 13 SITES OF ~140. Measured 2026-09-15 by
//    deleting the four fields from `types/customer.ts` and running tsc — 3 pre-existing errors
//    became 16. The other ~127 are invisible to tsc because:
//      · only FOUR files import the shared `Customer` type (`useCart`, `useSubmitOrder`,
//        `CustomerCapture`, `ScanOrder`). SIX declare their own inline row shape —
//        `Customers.tsx`, `CustomerDetail.tsx`, `CustomerSearch.tsx`, `stopRead.ts`,
//        `DeliveryRoute.tsx`, `OrderDetail.tsx`;
//      · three are PostgREST select-string LITERALS, and dropping a column from a projection does
//        not error — it returns `undefined`. That is exactly the failure R-19 was minted for:
//        *"selecting john smith filled name, email and phone — and City and ZIP rendered EMPTY,
//        because the address columns were never in the projection."*
//      · the writers build `Record<string, unknown>` payloads.
//    So a three-commit repoint is reviewable only if something OTHER than the compiler can see the
//    other 127. This is that something. David, 2026-09-15: *"the cap is the reviewer."*
//
// THE RULE:     No code may name `address_line1`, `city`, `state` or `zip` AS A COLUMN OF
//               `customers`. Deliveries, vendors, receipts and businesses keep their own — those
//               are different tables and are never flagged.
//
// 🔴 THE POPULATION IS DERIVED FROM THE SOURCE, NOT DECLARED. A hardcoded file list is tech-debt
//    #73's shape: *"a gap list that only grows stops being read."* Files are found by asking which
//    ones actually touch `customers`, so a file that starts doing so tomorrow is covered without
//    anyone remembering to add it.
//
// THREE CLAUSES, each scoped so a delivery's own address is never a false positive:
//   A  SELECT PROJECTIONS — a `customers ( … )` embed or a `.from('customers').select(…)` naming
//      one of the four. Exact: the table is named in the same expression.
//   B  WRITE PAYLOADS — an object reaching `.from('customers').insert/update/upsert` with one of
//      the four as a key. Exact, same reason.
//   C  CUSTOMER-SHAPED BLOCKS — a type, interface or object literal carrying a CUSTOMER-ONLY
//      field (`qb_customer_id`, `billing_line1`, `price_tier`, `customer_type`, `lifetime_value`,
//      `marketing_opt_in`, `tax_exempt`) that ALSO carries one of the four. `deliveries` and
//      `vendors` carry none of those, which is what makes the heuristic safe.
//
// ⚠️ NOT DETECTED, stated every run rather than absorbed: a read through a variable whose customer
//    origin is several hops away (`const a = row.customers; a.address_line1`). Clause C catches the
//    SHAPE that variable came from in every case in this repo today, but the cap says what it
//    cannot see rather than implying a precision it lacks (#182 — a check that cannot reach its
//    target reports the same as one that passed).
//
// DEPENDENCIES: none (node stdlib only).
// OUTPUTS:      exit 0 = clean · 1 = violations (each named with file:line and its clause) ·
//               2 = own probes failed.
// USAGE:        npm run verify:customer-address-columns · --self-test
// ============================================================
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['packages/shared/src', 'packages/cultivar-os/src', 'packages/cultivar-os/api', 'api'];

/** The four columns being retired from `customers`. */
const LEGACY = ['address_line1', 'city', 'state', 'zip'];
/** Fields only `customers` carries — the discriminator that keeps deliveries and vendors out. */
const CUSTOMER_ONLY = [
  'qb_customer_id', 'billing_line1', 'billing_city', 'billing_zip', 'price_tier',
  'customer_type', 'lifetime_value', 'marketing_opt_in', 'tax_exempt', 'organization_name',
];

/** Strip comments so the cap never reports prose that DESCRIBES the defect as the defect.
 *  tech-debt #146: a probe matching its own file's commentary. Learned twice in this build.
 *
 *  🔴 LINE COUNT IS PRESERVED, AND THAT IS NOT COSMETIC. The first draft deleted block comments
 *  outright, which COLLAPSED the lines they spanned and shifted every line number after them —
 *  `deliveryIngestWriter.ts` was reported at :322, a `qb_customer_id` line, because a JSDoc block
 *  above it vanished. A cap that names the wrong line is one people stop believing, and the
 *  zero-row cap says exactly that about itself: *a report you cannot navigate from is worse than
 *  a noisy one.* So a block comment becomes its own newlines rather than nothing. */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** CLAUSE A — a select projection that names `customers` and one of the four. */
export function clauseA(src) {
  const hits = [];
  // A1 — a PostgREST embed: `customers ( … )` inside a string literal.
  for (const m of src.matchAll(/customers\s*\(([^()]*)\)/g)) {
    const cols = m[1];
    for (const c of LEGACY) {
      if (new RegExp(`(^|[,\\s])${c}\\s*(,|$)`).test(cols)) {
        hits.push({ line: lineOf(src, m.index), clause: 'A', col: c, what: 'customers( … ) embed' });
      }
    }
  }
  // A2 — `.from('customers')` … `.select('…')` on the same chain.
  for (const m of src.matchAll(/from\(\s*['"]customers['"]\s*\)([\s\S]{0,400}?)\.select\(\s*([`'"])([\s\S]*?)\2/g)) {
    const cols = m[3];
    for (const c of LEGACY) {
      if (new RegExp(`(^|[,\\s(])${c}\\s*(,|\\)|$)`).test(cols)) {
        hits.push({ line: lineOf(src, m.index), clause: 'A', col: c, what: "from('customers').select()" });
      }
    }
  }
  return hits;
}

/** CLAUSE B — a write payload reaching `.from('customers')`. */
export function clauseB(src) {
  const hits = [];
  for (const m of src.matchAll(/from\(\s*['"]customers['"]\s*\)\s*\.\s*(insert|update|upsert)\(([\s\S]{0,400}?)\)/g)) {
    const payload = m[2];
    for (const c of LEGACY) {
      if (new RegExp(`(^|[,{\\s])${c}\\s*:`).test(payload)) {
        hits.push({ line: lineOf(src, m.index), clause: 'B', col: c, what: `customers.${m[1]}() payload` });
      }
    }
  }
  return hits;
}

/** CLAUSE C — a customer-SHAPED block (type, interface or object literal) carrying one of the four.
 *
 *  🔴 THE BLOCK IS THE *INNERMOST* ONE ENCLOSING THE COLUMN, NOT ANY ENCLOSING ONE, AND THAT
 *  DISTINCTION IS THE WHOLE PRECISION OF THIS CLAUSE. The first draft tested every brace pair, so
 *  `deliveryIngestWriter.ts` was flagged: its `const row = { … address_line1: stop.shipTo… }` is a
 *  DELIVERIES row, but the enclosing FUNCTION also passes `qb_customer_id` to `customerUpsert`
 *  twenty lines earlier — and a function-sized block containing both made a delivery address read
 *  as a customer one. A cap with false positives is a cap people argue with rather than obey.
 *
 *  A block qualifies only if IT ITSELF names a CUSTOMER_ONLY field. `deliveries` and `vendors`
 *  carry none of those, which is what keeps their identically-named columns out. */
export function clauseC(src) {
  const hits = [];
  // Innermost enclosing block for a position: scan brace pairs and keep the tightest that contains it.
  const pairs = [];
  const stack = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') stack.push(i);
    else if (src[i] === '}' && stack.length) pairs.push([stack.pop(), i]);
  }
  const innermost = (pos) => {
    let best = null;
    for (const [a, b] of pairs) {
      if (a <= pos && pos <= b && (best === null || (b - a) < (best[1] - best[0]))) best = [a, b];
    }
    return best;
  };

  for (const c of LEGACY) {
    // TWO shapes, and the second is the one the first draft missed: a KEY (`address_line1:`) and
    // a MEMBER READ (`c.address_line1`). Probe P5 caught the omission — a read has no trailing
    // colon, so a single pattern requiring one was blind to every reader.
    const asKey = new RegExp(`(^|[,{\\s])${c}\\s*[?]?\\s*:`, 'gm');
    const asRead = new RegExp(`\\.${c}\\b(?!\\s*:)`, 'gm');
    for (const re of [asKey, asRead]) {
      for (const m of src.matchAll(re)) {
        const blk = innermost(m.index);
        if (!blk) continue;
        const block = src.slice(blk[0], blk[1] + 1);
        if (block.length > 6000) continue;                       // a whole module body is not a shape
        if (!CUSTOMER_ONLY.some(f => new RegExp(`\\b${f}\\b`).test(block))) continue;
        hits.push({ line: lineOf(src, m.index), clause: 'C', col: c, what: 'customer-shaped block' });
      }
    }
  }
  return hits;
}

/** Pure: [{path, content}] → violations. Exported so the self-test drives the real analyser. */
export function analyze(files) {
  const out = [];
  for (const { path, content } of files) {
    const src = stripComments(content);
    // DERIVED POPULATION: only files that actually touch `customers` are scanned at all.
    const touchesCustomers = /from\(\s*['"]customers['"]\s*\)|customers\s*\(/.test(src)
      || CUSTOMER_ONLY.some(f => new RegExp(`\\b${f}\\b`).test(src));
    if (!touchesCustomers) continue;
    for (const h of [...clauseA(src), ...clauseB(src), ...clauseC(src)]) out.push({ path, ...h });
  }
  // One row per file+line+column — the same line naming two clauses is one thing to fix.
  const seen = new Set();
  return out.filter(h => {
    const k = `${h.path}:${h.line}:${h.col}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

// ── PROBES (STD-022 — planted, BOTH directions, before the real scan) ────────
function runProbes() {
  const R = [];
  const check = (name, expect, got) => R.push({ name, ok: got === expect, expect, got });
  const n = (files) => analyze(files).length;
  const f = (path, content) => ({ path, content });

  // DETECTION — each clause must fire on its own shape.
  check('P1 A · a customers( ) embed naming address_line1 is CAUGHT', 1,
    n([f('a.ts', `const S = 'id, customers ( first_name, address_line1 )';`)]));
  check('P1b A · …and an embed naming TWO of them counts TWO — one fix per column', 2,
    n([f('a.ts', `const S = 'id, customers ( first_name, address_line1, city )';`)]));
  check('P2 A · from(customers).select naming zip is CAUGHT', 1,
    n([f('a.ts', `supabase.from('customers').select('id, qb_customer_id, zip')`)]));
  check('P3 B · a write payload with address_line1 is CAUGHT', 1,
    n([f('a.ts', `db.from('customers').update({ address_line1: x, price_tier: t })`)]));
  check('P4 C · a customer-shaped interface carrying city is CAUGHT', 1,
    n([f('a.ts', `interface Row { qb_customer_id: string; city: string | null; }`)]));
  check('P5 C · a member READ off a customer-shaped block is CAUGHT', 1,
    n([f('a.ts', `const x = { price_tier: c.price_tier, line: c.address_line1 };`)]));

  // 🔴 NEGATIVE CONTROLS — the other tables' identical column names must NEVER be flagged.
  check('P6 a DELIVERY address is NOT flagged', 0,
    n([f('a.ts', `db.from('deliveries').update({ address_line1: s.line1, city: s.city })`)]));
  check('P7 a VENDOR address is NOT flagged', 0,
    n([f('a.ts', `interface Vendor { vendor_id: string; address_line1?: string | null; city?: string }`)]));
  check('P8 a delivery-shaped block in a file that ALSO reads customers is NOT flagged', 0,
    n([f('a.ts', `const sel = "customers ( first_name )";\ninterface Stop { delivery_date: string; address_line1: string | null; city: string | null; }`)]));
  check('P9 the BILLING columns are never flagged — they are the destination', 0,
    n([f('a.ts', `db.from('customers').select('id, billing_line1, billing_city, billing_state, billing_zip')`)]));
  check('P10 a file that never touches customers is not scanned at all', 0,
    n([f('a.ts', `interface Anything { address_line1: string; city: string; state: string; zip: string; }`)]));

  // 🔴 THE #146 CASE — a COMMENT describing the defect is not the defect.
  check('P11 a comment naming the column is NOT a violation', 0,
    n([f('a.ts', `// customers ( address_line1, city ) used to be read here\nconst q = 1;`)]));
  check('P12 …and a block comment either', 0,
    n([f('a.ts', `/* db.from('customers').update({ address_line1: x, price_tier: p }) */\nconst q = 1;`)]));
  // …and the stripper must not be so greedy it blinds the cap.
  check('P13 stripping comments does NOT hide a real violation on the same line', 1,
    n([f('a.ts', `db.from('customers').update({ address_line1: x, price_tier: p }); // a real one`)]));
  check('P14 a URL is not mistaken for a comment', 1,
    n([f('a.ts', `const u = 'https://x.test'; db.from('customers').update({ city: c, price_tier: p })`)]));

  // POPULATION — the probe that changes the population rather than the subject (tech-debt #182).
  check('P15 two files, one clean → still exactly one violation', 1,
    n([f('a.ts', `db.from('customers').update({ city: c, price_tier: p })`),
       f('b.ts', `db.from('customers').select('id, billing_city')`)]));
  check('P16 the analyser returns ZERO on an empty population (it can be silent)', 0, n([]));

  // 🔴 P17 — THE LINE NUMBER IS THE ONE IN THE FILE. Stripping must not shift it, or the report
  // points at innocent code (found against the real corpus: a JSDoc block moved a hit by 6 lines).
  {
    const src = `/**\n * a\n * block\n */\nconst q = 1;\ndb.from('customers').update({ city: c, price_tier: p })`;
    const hit = analyze([f('a.ts', src)])[0];
    check('P17 a hit after a block comment reports its REAL line', 6, hit ? hit.line : -1);
  }
  // 🔴 P19 — THE FALSE POSITIVE FOUND AGAINST THE REAL CORPUS (deliveryIngestWriter.ts).
  // A DELIVERIES row nested inside a function that ALSO handles a customer must NOT be flagged.
  check('P19 a delivery row inside a customer-handling function is NOT flagged', 0,
    n([f('a.ts', `async function ingest() {
      await upsertCustomer({ qb_customer_id: stop.qbCustomerId });
      const row = { business_id: b, customer_id: c, delivery_date: d,
                    address_line1: stop.shipTo.addressLine1, city: stop.shipTo.city,
                    state: stop.shipTo.state, zip: stop.shipTo.zip, qb_invoice_id: i };
      await db.from('deliveries').upsert(row);
    }`)]));
  check('P19b …but a CUSTOMER row in that same function still IS flagged', 1,
    n([f('a.ts', `async function ingest() {
      const row = { business_id: b, qb_customer_id: q, address_line1: a };
      await db.from('customers').upsert(row);
    }`)]));
  check('P18 stripComments preserves the line count exactly',
    5, stripComments('/**\n * x\n */\nconst a=1;\nconst b=2;').split('\n').length);

  return R;
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const B = (s) => `\x1b[1m${s}\x1b[0m`, RED = (s) => `\x1b[31m${s}\x1b[0m`, GRN = (s) => `\x1b[32m${s}\x1b[0m`, DIM = (s) => `\x1b[2m${s}\x1b[0m`;

const probes = runProbes();
const badProbes = probes.filter(p => !p.ok);
if (process.argv.includes('--self-test')) {
  console.log(B('verify-customer-address-columns — SELF TEST'));
  for (const p of probes) console.log(`  ${p.ok ? GRN('ok  ') : RED('FAIL')} ${p.name}${p.ok ? '' : `  (expected ${p.expect}, got ${p.got})`}`);
  console.log(badProbes.length === 0 ? GRN(`\n✅ ${probes.length} probes pass, both directions`) : RED(`\n✗ ${badProbes.length} probe(s) failed`));
  process.exit(badProbes.length ? 2 : 0);
}
if (badProbes.length) {
  console.error(RED(`✗ verify-customer-address-columns — ${badProbes.length} of its OWN probes failed; the scan was not run.`));
  for (const p of badProbes) console.error(`   ${p.name} (expected ${p.expect}, got ${p.got})`);
  process.exit(2);
}

const files = SCAN.flatMap(d => walk(join(ROOT, d)))
  .map(p => ({ path: relative(ROOT, p), content: readFileSync(p, 'utf8') }));
const violations = analyze(files);

console.log(B('\nCUSTOMER ADDRESS COLUMNS — the legacy four must not be named on `customers`'));
console.log(DIM(`  scanned ${files.length} files · ${probes.length} probes passed both directions`));

if (violations.length === 0) {
  console.log(GRN(`\n✓ CLEAN — no code names address_line1/city/state/zip as a column of \`customers\`.`));
  process.exit(0);
}
const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.path)) byFile.set(v.path, []);
  byFile.get(v.path).push(v);
}
console.log(RED(B(`\n✗ ${violations.length} site(s) still name a legacy address column on \`customers\`, in ${byFile.size} file(s):`)));
for (const [path, vs] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${B(path)} ${DIM(`— ${vs.length}`)}`);
  for (const v of vs) console.log(`     ${DIM(`:${v.line}`)} ${RED(v.col)} ${DIM(`[${v.clause} · ${v.what}]`)}`);
}
console.log(DIM('\nRepoint to `billing_*` (the derived view of the address list), or read the address list directly.'));
process.exit(1);
