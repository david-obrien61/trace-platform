/**
 * ── BACKFILL THE UNIT PROJECTION · business_inventory.unit_* ───────────────────────────────────
 *
 * PURPOSE:      Derive the unit columns from `size` for every row that does not have them yet, in
 *               EVERY tenant, and REPORT — per tenant — how many parsed, how many the parser
 *               REFUSED, and exactly which strings it refused. It never guesses and it never
 *               touches `size`.
 *
 * RUN:
 *   npm run units:backfill                    # READ, then WRITE the projection where it is missing
 *   npm run units:backfill -- --verify        # READ ONLY — re-derives everything, writes NOTHING
 *   npm run units:backfill -- --business=<uuid>
 *
 * 🔴 THE npm SCRIPT BUILDS TO A FILE AND RUNS THE FILE — it does NOT pipe into `node`, and that is
 *    not a style choice. When node reads a script from STDIN, `process.argv` holds only `['node']`:
 *    every flag below would be silently invisible, and `-- --verify` lands on the node BINARY
 *    (`node: bad option: --verify`). Shipped that way on 2026-08-30 and caught the first time a flag
 *    was actually needed — a documented invocation that could never have worked. Do not "simplify"
 *    it back to a pipe.
 *
 *   (no flag)          READ, then WRITE the projection onto rows that need it. Idempotent.
 *   --verify           READ ONLY. Re-derives every row and reports any disagreement with what is
 *                      stored. WRITES NOTHING. This is the live half of the re-parse check.
 *   --business=<uuid>  Restrict to one tenant. Default: every tenant, reported separately.
 *
 * DEPENDENCIES: packages/cultivar-os/.env.local → SUPABASE_URL + SUPABASE_SERVICE_KEY.
 *               Migration `20260830_inventory_unit_of_measure.sql` must be APPLIED; if it is not,
 *               this script says so and stops rather than reporting a meaningless zero.
 *               The parse comes from `unitColumnsFor` and from nowhere else — this script holds NO
 *               parsing logic of its own, which is the point (one derive, §STD-011).
 *
 * ⚠️ RE-RUNNABLE BY DESIGN, AND IT NEEDS TO BE, FOR TWO SEPARATE REASONS:
 *   1. The count screen and the import CREATE path write `size` through SECURITY DEFINER RPCs that
 *      know nothing about units (out of scope for the build that added this — CLAUDE.md §7). Their
 *      rows land UNPARSED, the DB trigger guarantees they are never STALE, and this script closes
 *      them. `not_yet_parsed > 0` after a run is EXPECTED, not a defect.
 *   2. David is still weighing whether LAWNS's 447 existing rows are REPLACED by the QuickBooks
 *      catalogue rather than reconciled with it. This script assumes nothing about which rows
 *      survive; run it again after whatever happens.
 *
 * 🔴 TENANT ISOLATION: three tenants share `business_inventory`. Every read and every write below is
 *    keyed on `business_id` and every number reported is per tenant (AC-3). LAWNS is
 *    ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
 *
 * INSTRUMENTATION (STD-003): [TRACE:UNITS] on every phase, ON by default (standing owner instruction).
 *
 * STORY: user_stories.md → *A quantity that means something*. Ledger #234.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import {
  unitColumnsFor, summariseUnits, UNIT_COLUMNS,
  type UnitColumns,
} from '../packages/shared/src/inventory/unitOfMeasure';

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', O = '\x1b[0m', BLD = '\x1b[1m';

const flag = (k: string) => process.argv.includes(`--${k}`);
const arg  = (k: string) => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.slice(`--${k}=`.length) : null;
};
const VERIFY_ONLY = flag('verify');
const ONE_TENANT  = arg('business');

// ── credential ────────────────────────────────────────────────────────────────────────────────
// 🔴 RESOLVED FROM cwd, WALKING UP — NOT from `import.meta.url`, and the reason is a defect this
// script shipped with on 2026-08-30. esbuild bundles this to `node_modules/.cache/`, so an
// `import.meta.url`-relative path resolved to `node_modules/packages/cultivar-os/.env.local` and the
// script reported NO CREDENTIAL while a perfectly good service key sat on disk. **A path that
// depends on where the bundler happened to put the output is not a path.**
// It also PRINTS the file it read (R-26 — a claim names what was opened to produce it), so
// "MISSING" can never again mean "I looked somewhere you didn't."
let env: Record<string, string> = {};
let envPath = '(none found)';
{
  const candidates: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(join(dir, 'packages/cultivar-os/.env.local'), join(dir, '.env.local'));
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  for (const c of candidates) {
    try {
      const txt = readFileSync(c, 'utf8');
      const parsed = Object.fromEntries(
        txt.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
          .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
      ) as Record<string, string>;
      // the FIRST file that actually carries a service key wins — an empty .env.local at the repo
      // root must not shadow a populated one inside the package (it did, on the first attempt).
      if (parsed.SUPABASE_SERVICE_KEY) { env = parsed; envPath = c; break; }
      if (envPath === '(none found)') { env = parsed; envPath = c; }
    } catch { /* try the next candidate */ }
  }
}

const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const KEY  = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
if (!URL_ || !KEY) {
  // D-9: say what is missing and what it is for. Never proceed with a key that cannot read, and
  // never report "0 rows" when the truth is "I could not look".
  console.error(`\n${RED}✗ NO SERVICE CREDENTIAL — nothing was read and nothing was written.${O}`);
  console.error(`  SUPABASE_URL         ${URL_ ? GRN + 'present' + O : RED + 'MISSING' + O}`);
  console.error(`  SUPABASE_SERVICE_KEY ${KEY  ? GRN + 'present' + O : RED + 'MISSING' + O}`);
  console.error(`  ${DIM}read from: ${envPath}${O}`);
  console.error(`\n${DIM}  Set both in packages/cultivar-os/.env.local (or the environment) and re-run.`);
  console.error(`  The anon key cannot do this: RLS scopes it to the signed-in member, and this walks every tenant.${O}\n`);
  process.exit(2);
}
const sb = createClient(URL_, KEY);

// ── the row shape this script reads. `size` is READ ONLY — never written, never rewritten. ──────
interface Row extends UnitColumns {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  size: string | null;
  variant_group: string | null;
}
const SELECT = ['id', 'business_id', 'name', 'sku', 'size', 'variant_group', ...UNIT_COLUMNS].join(',');

const same = (a: UnitColumns, b: UnitColumns) => UNIT_COLUMNS.every(c => {
  const x = a[c] as unknown, y = b[c] as unknown;
  // numeric columns come back from PostgREST as strings on some driver versions; compare by value.
  if (x == null || y == null) return x == null && y == null;
  return String(x) === String(y);
});

async function main() {
  console.log(`\n${BLD}UNIT PROJECTION — ${VERIFY_ONLY ? 'VERIFY (read-only)' : 'BACKFILL'}${O} ${DIM}${new Date().toISOString()}${O}`);
  console.log(`[TRACE:UNITS] start`, JSON.stringify({ mode: VERIFY_ONLY ? 'verify' : 'backfill', tenant: ONE_TENANT ?? 'ALL', env: envPath }));

  // ── page the whole table; PostgREST caps a response, and a silent truncation here would produce
  //    a confident wrong number — R-24: a list that cannot prove it is the whole list is a failure.
  const PAGE = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('business_inventory').select(SELECT).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (ONE_TENANT) q = q.eq('business_id', ONE_TENANT);
    const { data, error } = await q;
    if (error) {
      const missing = /unit_kind|unit_parsed_from|column .* does not exist/i.test(error.message);
      console.error(`\n${RED}✗ READ FAILED — ${error.message}${O}`);
      if (missing) console.error(`${YEL}  → migration 20260830_inventory_unit_of_measure.sql is NOT APPLIED. Apply it in the SQL editor (§6 r17), then re-run.${O}\n`);
      process.exit(1);
    }
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  console.log(`[TRACE:UNITS] read ${rows.length} row(s) across ${new Set(rows.map(r => r.business_id)).size} tenant(s)`);

  // ── group per tenant. Every number below is business_id-scoped (AC-3). ───────────────────────
  const tenants = new Map<string, Row[]>();
  for (const r of rows) tenants.set(r.business_id, [...(tenants.get(r.business_id) ?? []), r]);

  let totalWrites = 0, totalMismatch = 0;

  for (const [businessId, list] of [...tenants.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const isLawns = businessId === 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
    console.log(`\n${BLD}── tenant ${businessId}${isLawns ? '  (LAWNS)' : ''}${O}  ${list.length} row(s)`);

    // 🔴 THE NUMBERS COME FROM `summariseUnits`, NOT FROM A SECOND COUNT IN THIS SCRIPT. That
    // function is pure and is asserted over a fixture in `unitOfMeasure.test.ts`, so this report is
    // proven in `npm run verify` rather than trusted the first time someone with a service key runs
    // it. A script that recomputed the same tallies inline would be the semantic duplicate §6 r8
    // forbids — and the copy that drifts is always the one nobody can test.
    const sum = summariseUnits(list);

    const needsWrite: Array<{ row: Row; want: UnitColumns }> = [];
    const mismatched: Array<{ row: Row; want: UnitColumns }> = [];

    for (const row of list) {
      const want = unitColumnsFor(row.size);
      const have: UnitColumns = {
        unit_kind: row.unit_kind, unit_value: row.unit_value, unit_value_max: row.unit_value_max,
        unit_name: row.unit_name, unit_parsed_from: row.unit_parsed_from,
      };
      if (same(have, want)) continue;
      // A row whose STORED projection disagrees with a fresh derive is either (a) not yet parsed —
      // normal, the RPC paths mint these — or (b) genuinely wrong, which the DB trigger should make
      // unreachable. Both need a write; only (b) is alarming, and only (b) is called out below.
      if (row.unit_parsed_from != null) mismatched.push({ row, want });
      needsWrite.push({ row, want });
    }

    console.log(`   parsed ${GRN}${sum.parsed}${O} · parser refused ${sum.refused ? YEL : DIM}${sum.refused}${O} · no size ${DIM}${sum.noSize}${O} · needing a write ${needsWrite.length}`);

    // 🔴 THE REFUSALS ARE LISTED, NOT COUNTED. A number alone would let an unreadable vocabulary
    //    hide inside a percentage; the acceptance bar is "refused AND listed" (§1.6 item 3).
    if (sum.refusedValues.length) {
      console.log(`   ${YEL}unparsed size values (${sum.refusedValues.length} distinct) — nothing was guessed:${O}`);
      for (const { value, count } of sum.refusedValues)
        console.log(`     ${YEL}·${O} ${JSON.stringify(value)}${count > 1 ? DIM + ` ×${count}` + O : ''}`);
    }

    // 🔴 THE MULTI-UNIT FAMILY FLAG — one variant_group carrying more than one unit KIND. This is
    //    the Fertile Compost Mix case: buckets and yard scoops under one product. REPORTED ONLY:
    //    never merged, never converted, no picker. Whether compost is STOCKED in yards or in
    //    buckets is Lauren's answer and it is a later pass.
    if (sum.families.length) {
      console.log(`   ${YEL}⚑ MULTI-UNIT FAMILIES (${sum.families.length}) — one product, more than one kind of unit:${O}`);
      for (const f of sum.families) {
        console.log(`     ${YEL}·${O} ${f.variantGroup} — ${f.kinds.join(' + ')} across ${f.rowCount} row(s)`);
        for (const n of f.names) console.log(`         ${DIM}${n}${O}`);
      }
      console.log(`     ${DIM}Reported, not reconciled. Conversion needs a fact nobody has yet.${O}`);
    }

    if (mismatched.length) {
      totalMismatch += mismatched.length;
      console.log(`   ${RED}🔴 ${mismatched.length} row(s) carry a projection that DISAGREES with a fresh parse of their size.${O}`);
      console.log(`   ${DIM}The BEFORE-write trigger should make this unreachable — if it appears, 20260830 §4 is not applied.${O}`);
      for (const m of mismatched.slice(0, 20))
        console.log(`     ${RED}·${O} ${m.row.id} ${JSON.stringify(m.row.size)} stored parsed_from=${JSON.stringify(m.row.unit_parsed_from)}`);
      if (mismatched.length > 20) console.log(`     ${DIM}… and ${mismatched.length - 20} more${O}`);
    }

    if (VERIFY_ONLY) { console.log(`   ${DIM}--verify: nothing written.${O}`); continue; }

    // ── WRITE. One UPDATE per row, business_id-scoped. `size` is not in the patch and never is. ──
    let wrote = 0, failed = 0;
    for (const { row, want } of needsWrite) {
      const { error } = await sb.from('business_inventory').update(want).eq('id', row.id).eq('business_id', businessId);
      if (error) { failed++; if (failed <= 5) console.error(`     ${RED}write failed${O} ${row.id} — ${error.message}`); }
      else wrote++;
    }
    totalWrites += wrote;
    console.log(`   ${wrote ? GRN : DIM}wrote ${wrote}${O}${failed ? `  ${RED}failed ${failed}${O}` : ''}`);
    console.log(`[TRACE:UNITS] tenant`, JSON.stringify({ businessId, rows: sum.rows, parsed: sum.parsed, refused: sum.refused, notYetParsed: sum.notYetParsed, disagreements: sum.disagreements, wrote, failed }));
  }

  console.log(`\n${BLD}── total${O}  ${VERIFY_ONLY ? 'read-only' : `${totalWrites} row(s) written`} · ${totalMismatch ? RED + totalMismatch + ' disagreement(s)' + O : GRN + 'no disagreements' + O}`);
  console.log(`${DIM}\`size\` was not read for anything but parsing, and not one stored value was changed (D-23).${O}\n`);
  process.exit(totalMismatch > 0 ? 1 : 0);
}

main().catch((e) => { console.error(`${RED}✗ ${e instanceof Error ? e.message : String(e)}${O}`); process.exit(1); });
