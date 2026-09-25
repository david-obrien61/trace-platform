/**
 * ── BULK GEOCODE — the address check ⓒ · ledger #386 ────────────────────────────────────────
 *
 * PURPOSE   Give the addresses LAWNS already has a coordinate, so the ring map has distances
 *           and the delivery screens can say where a stop is. One pass over
 *           `customer_addresses`, through the SAME verdict the app uses.
 *
 * DEPENDENCIES  `packages/shared/src/business-logic/geocodeResult` (the verdict — imported, never
 *           re-implemented: a second copy of the location_type table is the drift §6 r8 forbids,
 *           and it would be the copy that goes stale) · Supabase service key · the Google key,
 *           both read from an env file at RUN time and never printed.
 *
 * OUTPUTS   `--plan` (default) counts and spends NOTHING · `--apply` writes · a review list at
 *           `supabase/local-data/geocode-review-<date>.csv` (gitignored — 🔴 NO PERSONAL DATA IN GIT).
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 WHAT THIS WRITES, AND WHAT IT REFUSES TO WRITE
 * ═════════════════════════════════════════════════════════════════════════════
 * · ROOFTOP → the coordinate is stored, `geocode_status='found'`, `geocoded_at=now`.
 * · RANGE_INTERPOLATED, partial_match, GEOMETRIC_CENTER, APPROXIMATE → 🔴 NOTHING IS STORED.
 *   The row goes on the review list for a person. David's ruling 2026-09-24: a tap is cheap, a
 *   wrong pin sends a truck to the wrong place — and a bulk run has nobody to ask, so it must
 *   not answer on their behalf.
 * · ZERO_RESULTS / INVALID_REQUEST → `geocode_status='not_found'`. Saved, unverified, NEVER
 *   priced. Liberty Hill is 35% new streets; that path is the requirement, not a failure.
 *
 * 🔴 GOOGLE'S CORRECTED ADDRESS TEXT IS NEVER STORED. Only the coordinate and the clock. What
 * is written in the address line is what a person typed, and it stays theirs.
 *
 * ── RESUMABLE, BECAUSE IT WILL BE INTERRUPTED ───────────────────────────────────────────────
 * The only rows selected are those with `geocode_status IS NULL`. Every write sets it, so a
 * re-run after a crash, a rate limit or a closed laptop picks up exactly where it stopped and
 * re-spends nothing. There is no cursor file to go stale — the database IS the cursor.
 *
 * ── COST, MEASURED BEFORE IT RUNS ───────────────────────────────────────────────────────────
 * 1,516 addresses carry no verdict — COUNTED LIVE 2026-09-24, not carried from a note. Against
 * the 10,000/month free cap that is **$0.00**, about two minutes at 25 QPS.
 * ⚠️ A working note said 1,486 and was wrong; the number moves as rows are imported, which is
 * exactly why `--plan` is the DEFAULT — it re-counts against today's data before anything is
 * spent, instead of trusting the figure written in this comment.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
// 🔴 THE SAME DECISION AND THE SAME WRITER THE SCREEN USES. Not a parallel implementation:
// `applyOneResult` is what Settings → Delivery calls, and `setAddressGeocode` is the ONE writer
// for a customer's contact lists (§6 r21). verify:writer-registry caught this file writing
// `customer_addresses` directly and it was right to — a second writer is how the terminal door
// and the screen door come to disagree about what a geocode means.
import { applyOneResult } from '../packages/shared/src/business-logic/geocodeRun';
import { setAddressGeocode } from '../packages/shared/src/business-logic/contactWriter';

const APPLY = process.argv.includes('--apply');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) ?? '').split('=')[1] || 0);

/**
 * Read the env WITHOUT ever printing a value, resolving from cwd and WALKING UP.
 *
 * 🔴 NOT FROM `import.meta.url`, AND THE REASON IS A DEFECT THIS REPO ALREADY PAID FOR.
 * `scripts/backfill-inventory-units.ts` records it at its own line 68: esbuild bundles these
 * scripts into `node_modules/.cache/`, so an `import.meta.url`-relative path resolved to
 * `node_modules/packages/cultivar-os/.env.local` and the script reported NO CREDENTIAL while a
 * perfectly good service key sat on disk. **A path that depends on where the bundler happened to
 * put the output is not a path.** My first draft of this file had exactly that bug.
 *
 * 🔴 AND THE FIRST FILE THAT CARRIES A KEY WINS — an EMPTY `SUPABASE_URL=` at the repo root must
 * not shadow the real one inside the package. Measured live 2026-09-24: the root .env.local does
 * carry an empty assignment, and a first-wins read finds the key PRESENT and the value blank, so
 * the error that follows names a bad URL rather than a missing file. That is a long way to debug.
 * `backfill-inventory-units.ts` hit the same thing and says so in its own comment.
 *
 * ⚠️ §6 r8 — THIS IS THE THIRD COPY OF THIS LOADER (with `backfill-inventory-units.ts` and
 * `backfill-customer-types.mjs`), WHICH IS THE RULE-OF-THREE TRIGGER. It is written out here
 * rather than extracted because the three live in two module systems (.ts bundled to cjs, .mjs
 * native) and picking the shared home is a decision, not a cleanup. FLAGGED, not silently forked.
 */
function loadEnv(): { env: Record<string, string>; from: string } {
  const candidates: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(join(dir, 'packages/cultivar-os/.env.local'), join(dir, '.env.local'));
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  // 🔴 MERGED KEY BY KEY, NOT ONE FILE WHOLESALE — and this is a CORRECTION to the pattern this
  // function was copied from. `backfill-inventory-units.ts` picks the first file carrying a
  // service key and stops, which is right for a script needing only Supabase. THIS script needs
  // TWO credentials that live in TWO DIFFERENT FILES: measured 2026-09-24, SUPABASE_SERVICE_KEY
  // is in packages/cultivar-os/.env.local and GOOGLE_GEOCODING_API_KEY is in the repo root's.
  // Taking one file wholesale found the first and reported the second missing — a correct-looking
  // refusal caused by the reader, not by the configuration, which is the worst kind to debug.
  // First NON-EMPTY value per key wins, so an empty `SUPABASE_URL=` at the root cannot shadow the
  // real one inside the package.
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
    } catch { /* try the next candidate */ }
  }
  return { env, from: read.length ? read.join(' + ') : '(none found)' };
}

const { env, from: envPath } = loadEnv();
// R-26: a claim names what was opened to produce it, so 'MISSING' can never mean 'I looked elsewhere'.
console.log(`env read from: ${envPath}`);
// The repo root is the directory that held the env file — the review list lands beside it, in the
// GITIGNORED supabase/local-data/. 🔴 NO PERSONAL DATA IN GIT: this file is real customer addresses.
const repoRoot = (() => {
  if (envPath === '(none found)') return process.cwd();
  const dir = dirname(envPath);                       // .../ or .../packages/cultivar-os
  return dir.endsWith(join('packages', 'cultivar-os')) ? dirname(dirname(dir)) : dir;
})();
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
const GOOGLE_KEY = env.GOOGLE_GEOCODING_API_KEY;

// 🔴 SAY WHICH KEY IS MISSING, NEVER ITS VALUE. A run that dies on a blank error teaches nothing.
for (const [name, v] of [['SUPABASE_URL', SUPABASE_URL], ['SUPABASE_SERVICE_KEY', SERVICE_KEY], ['GOOGLE_GEOCODING_API_KEY', GOOGLE_KEY]] as const) {
  if (!v) { console.error(`🔴 ${name} is not in .env.local — nothing has been read or written.`); process.exit(2); }
}

const sb = createClient(SUPABASE_URL as string, SERVICE_KEY as string);

// 🔴 THE COLUMN IS `line1`, NOT `address_line1`. `address_line1` is the DELIVERIES column; on
// `customer_addresses` the street is `line1` (see CUSTOMER_ADDRESS_COLUMNS). The first draft used
// the wrong one and PostgREST refused the whole read — loudly, which is the good case. The same
// mistake in a WRITE payload is #179's defect, where a column nobody reads is invisible.
interface Row {
  id: string; business_id: string;
  line1: string | null; city: string | null; state: string | null; zip: string | null;
}

function oneLine(r: Row): string {
  return [r.line1, r.city, r.state, r.zip].map(p => (p ?? '').trim()).filter(Boolean).join(', ');
}

/** 25 QPS is Google's documented ceiling; 40ms between calls keeps us under it with room. */
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  // 🔴 PAGED, BECAUSE POSTGREST STOPS AT 1000 AND SAYS NOTHING.
  // The first run of this script reported "1000 address(es) have no verdict yet" against a live
  // population of 1,516 — no error, no warning, just the default page size. `--apply` would then
  // have processed 1000, printed a confident summary, and left 516 untouched; the resumable
  // design would have picked them up on a SECOND run, but the NUMBER REPORTED TO A PERSON would
  // have been wrong, and 1000 reads like a real answer rather than a truncation.
  // That is tech-debt #186's class — a short run indistinguishable from a full one — and the fix
  // is the same: compare what came back against a count nobody paged.
  const PAGE = 1000;
  const base = () => sb.from('customer_addresses')
    .select('id, business_id, line1, city, state, zip')
    .is('geocode_status', null)
    .not('line1', 'is', null)
    .neq('line1', '')
    .order('id', { ascending: true });      // a stable order, or paging can skip and repeat rows

  const { count: expected, error: ce } = await sb.from('customer_addresses')
    .select('*', { count: 'exact', head: true })
    .is('geocode_status', null).not('line1', 'is', null).neq('line1', '');
  if (ce) { console.error('🔴 could not count customer_addresses:', ce.message); process.exit(3); }

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await base().range(from, from + PAGE - 1);
    if (error) { console.error('🔴 could not read customer_addresses:', error.message); process.exit(3); }
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
    if (LIMIT > 0 && rows.length >= LIMIT) break;
  }
  if (LIMIT > 0) rows.length = Math.min(rows.length, LIMIT);

  // 🔴 THE FLOOR THAT MAKES A TRUNCATED READ LOUD. Without it the only symptom is a smaller
  // number, and a smaller number is exactly what a partly-done job looks like.
  if (LIMIT === 0 && expected !== null && rows.length !== expected) {
    console.error(`🔴 READ ${rows.length} ROWS BUT THE TABLE SAYS ${expected} — refusing to continue on a partial population.`);
    process.exit(4);
  }
  const todo = rows.filter(r => oneLine(r) !== '');
  console.log(`\n${todo.length} address(es) have no verdict yet.`);
  console.log(`At the 10,000/month free cap that is $0.00 and about ${Math.ceil(todo.length * 0.04 / 60)} minute(s).`);

  if (!APPLY) {
    console.log('\n--plan: nothing was called and nothing was written. Re-run with --apply.\n');
    return;
  }

  let found = 0, notFound = 0, review = 0, failed = 0;
  const reviewRows: string[] = ['id,typed,verdict,google_says,reason'];

  for (const [i, r] of todo.entries()) {
    const typed = oneLine(r);
    let raw: unknown;
    try {
      const url = 'https://maps.googleapis.com/maps/api/geocode/json'
        + `?address=${encodeURIComponent(typed)}&components=country:US&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      raw = await res.json();
    } catch (e) {
      // Rule 24 one layer out: a service failure leaves the row EXACTLY as it was, with no
      // verdict, so the next run retries it. Writing 'not_found' here would turn our outage
      // into the customer's permanently-unpriced address.
      failed++; await sleep(200); continue;
    }

    const res = applyOneResult(raw, new Date());
    if (res.patch) {
      // ✏️ ROUTING THIS THROUGH THE WRITER FIXED A SECOND BUG FOR FREE. The direct `not_found`
      // update here wrote NO `geocoded_at`, so an unplaceable address would have been re-checked
      // on every run for ever — the 30-day clock never started. The writer's patch type requires
      // the date, so the mistake is no longer expressible.
      const { count, error: e } = await setAddressGeocode(sb as any, {
        businessId: r.business_id, addressId: r.id, patch: res.patch,
      });
      // R-12: an update matching zero rows returns success with no error — count is the signal.
      if (e || count === 0) { failed++; }
      else if (res.patch.geocode_status === 'found') { found++; } else { notFound++; }
    } else if (res.review) {
      // 🔴 'confirm' — LEFT ALONE ON PURPOSE. Nothing is written, so this row is offered again
      // next run and, more importantly, to a PERSON. A bulk job must not answer a question that
      // was designed to be asked.
      review++;
      reviewRows.push([r.id, typed, res.outcome?.verdict ?? '', res.outcome?.suggestion ?? '', res.outcome?.reason ?? '']
        .map(f => `"${String(f).replace(/"/g, '""')}"`).join(','));
    } else {
      failed++;
    }

    if ((i + 1) % 100 === 0) console.log(`  … ${i + 1} of ${todo.length}`);
    await sleep(40);
  }

  // 🔴 THE REVIEW LIST IS REAL CUSTOMER ADDRESSES — gitignored local data, never the repo.
  // Same lesson as the env read: resolved from the REPO, found by walking up from cwd, never from
  // where the bundler put this file. `repoRoot` is the directory the .env.local came from.
  const dir = join(repoRoot, 'supabase', 'local-data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `geocode-review-${new Date().toISOString().slice(0, 10)}.csv`);
  if (review > 0) writeFileSync(out, reviewRows.join('\n'));

  console.log(`\n${found} located · ${review + notFound} need a look`);
  console.log(`   ${found} found (ROOFTOP — coordinate stored)`);
  console.log(`   ${review} need a person to confirm  ${review ? `→ ${out}` : ''}`);
  console.log(`   ${notFound} cannot be placed — saved, marked unverified, never priced`);
  if (failed) console.log(`   ${failed} could not be reached this run — left with NO verdict, so the next run retries them`);
  console.log('');
}

void main();
