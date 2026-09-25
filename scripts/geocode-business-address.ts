/**
 * ── LOCATE THE YARD — the address check ② · ledger #386 ──────────────────────────────────────
 *
 * PURPOSE   Give a tenant's BUSINESS-PROFILE address its coordinate. That address is the depot:
 *           the autocomplete bias centre and the ring-map centre both read it. David, 2026-09-24:
 *           *"do NOT create a separate depot setting — the yard IS the ADDRESS in Settings →
 *           Business profile."* So this locates THAT row and nothing else.
 *
 * DEPENDENCIES  packages/shared/src/business-logic/geocodeResult (the verdict — IMPORTED, never
 *           re-implemented) · 20260924g (the four columns) · the keys, read at RUN time from an
 *           env file and never printed.
 *
 * OUTPUTS   `--plan` (default) says what it WOULD store and spends nothing · `--apply` stores it.
 *           `--business=<uuid>` limits it to one tenant.
 *
 * 🔴 THE ADDRESS TEXT IS NEVER REWRITTEN. Google returns "400 Honey Comb Mesa" for LAWNS's
 * "400 Honeycomb Mesa"; ruling 2 (2026-09-23) says Google suggests and the PERSON confirms, so
 * only the coordinate is taken. The owner's wording stays the owner's.
 *
 * 🔴 ONLY A `found` VERDICT BECOMES A BIAS CENTRE. A `confirm` is a pin nobody agreed to and a
 * `not_found` has none — centring a map or a suggestion list on either would point every address
 * in the business at a place the owner never approved. Those record the verdict and no coordinate.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { classifyGeocodeResponse } from '../packages/shared/src/business-logic/geocodeResult';

const APPLY = process.argv.includes('--apply');
const ONE = (process.argv.find(a => a.startsWith('--business=')) ?? '').split('=')[1] || null;

/** Merged key by key across both env files — the two credentials live in different ones. */
function loadEnv(): { env: Record<string, string>; from: string } {
  const candidates: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(join(dir, 'packages/cultivar-os/.env.local'), join(dir, '.env.local'));
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const env: Record<string, string> = {};
  const read: string[] = [];
  for (const c of candidates) {
    try {
      const text = readFileSync(c, 'utf8');
      read.push(c);
      for (const line of text.split('\n')) {
        if (!line.includes('=') || line.trim().startsWith('#')) continue;
        const i = line.indexOf('=');
        const k = line.slice(0, i).trim();
        const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        if (v && !env[k]) env[k] = v;
      }
    } catch { /* next candidate */ }
  }
  return { env, from: read.length ? read.join(' + ') : '(none found)' };
}

const { env, from } = loadEnv();
console.log(`env read from: ${from}`);
const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
const GKEY = env.GOOGLE_GEOCODING_API_KEY;
for (const [n, v] of [['SUPABASE_URL', URL_], ['SUPABASE_SERVICE_KEY', KEY], ['GOOGLE_GEOCODING_API_KEY', GKEY]] as const) {
  if (!v) { console.error(`🔴 ${n} is not in .env.local — nothing read, nothing written.`); process.exit(2); }
}
const sb = createClient(URL_ as string, KEY as string);

async function main() {
  let q = sb.from('businesses').select('id, name, address, latitude, longitude, geocode_status, geocoded_at');
  if (ONE) q = q.eq('id', ONE);
  const { data, error } = await q;
  if (error) { console.error('🔴 could not read businesses:', error.message); process.exit(3); }
  const rows = (data ?? []) as Array<Record<string, any>>;

  for (const b of rows) {
    const text = String(b.address ?? '').trim();
    if (!text) { console.log(`\n${b.name}\n  no address on the profile — nothing to locate`); continue; }
    console.log(`\n${b.name}\n  address : ${text}`);
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${encodeURIComponent(GKEY as string)}`);
    const outcome = classifyGeocodeResponse(await r.json());
    console.log(`  verdict : ${outcome.verdict}  (${outcome.reason})`);
    if (outcome.suggestion && outcome.suggestion !== text) {
      console.log(`  google  : ${outcome.suggestion}   ← NOT stored; the owner's wording stays theirs (ruling 2)`);
    }
    console.log(`  pin     : ${outcome.latitude ?? '—'}, ${outcome.longitude ?? '—'}`);

    if (!APPLY) { console.log('  --plan: nothing written'); continue; }
    const patch = outcome.verdict === 'found'
      ? { latitude: outcome.latitude, longitude: outcome.longitude, geocoded_at: new Date().toISOString(), geocode_status: 'found' }
      : { latitude: null, longitude: null, geocoded_at: new Date().toISOString(), geocode_status: outcome.verdict };
    const { data: upd, error: ue } = await sb.from('businesses').update(patch).eq('id', b.id).select('id');
    // R-12: an update matching zero rows returns success with no error — the count is the signal.
    console.log(`  stored  : ${ue ? '🔴 ' + ue.message : `${(upd ?? []).length} row(s)`}`);
  }
  console.log('');
}
void main();
