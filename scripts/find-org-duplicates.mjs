/**
 * READ-ONLY org-duplicate finder. Surfaces existing organization customers that the new
 * name+billing dedup would now collapse — so David can decide keep/delete BEFORE they
 * accrete more deliveries. Writes NOTHING. Mirrors the normalizeMatchKey used in
 * packages/shared/src/business-logic/customerUpsert.ts (keep in sync).
 *
 * Run: node scripts/find-org-duplicates.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Load env (SUPABASE_URL + SUPABASE_SERVICE_KEY) from either .env.local without a dep.
// Root first, then packages/cultivar-os — whichever carries the populated values.
for (const rel of ['../.env.local', '../packages/cultivar-os/.env.local']) {
  let text = '';
  try { text = readFileSync(new URL(rel, import.meta.url), 'utf8'); } catch { continue; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    const v = m && m[2].replace(/^["']|["']$/g, '');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v; // don't overwrite with an empty value
  }
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(url, key);

function normalizeMatchKey(s) {
  return (s ?? '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const { data, error } = await db
  .from('customers')
  .select('id, business_id, first_name, last_name, email, phone, address_line1, customer_type, created_at')
  .eq('customer_type', 'organization')
  .order('created_at', { ascending: true });

if (error) { console.error('Query failed:', error.message); process.exit(1); }
console.log(`Scanned ${data.length} organization customer(s).\n`);

// Group by business_id + normalized(name) + normalized(billing address_line1) — the new key.
const groups = new Map();
for (const r of data) {
  const nameKey = normalizeMatchKey(r.first_name);
  const billKey = normalizeMatchKey(r.address_line1);
  if (!nameKey || !billKey) continue; // no full key → not collapsible under the new rule
  const gk = `${r.business_id}|${nameKey}|${billKey}`;
  (groups.get(gk) ?? groups.set(gk, []).get(gk)).push(r);
}

let dupSets = 0;
for (const [gk, rows] of groups) {
  if (rows.length < 2) continue;
  dupSets++;
  const name = rows[0].first_name;
  console.log(`── DUPLICATE SET: "${name}" @ ${rows[0].address_line1} (business ${rows[0].business_id.slice(0, 8)}…) ──`);
  rows.forEach((r, i) => {
    console.log(`  [${i === 0 ? 'KEEP (oldest)' : 'DELETE?    '}] id=${r.id}  phone=${r.phone ?? '(none)'}  email=${r.email ?? '(none)'}  created=${r.created_at?.slice(0, 10)}`);
  });
  console.log(`  → Recommend: keep the oldest (id ${rows[0].id.slice(0, 8)}…), reassign any deliveries off the others, then delete the others. David approves before any delete.\n`);
}

if (dupSets === 0) console.log('No org duplicate sets under the name+billing key. (Nothing to clean up.)');
else console.log(`${dupSets} duplicate set(s) found. This script is READ-ONLY — no rows were changed.`);
