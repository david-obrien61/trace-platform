/**
 * -- vblocks-as-pasted-391.pglite -- THE V-BLOCKS, RUN EXACTLY AS DAVID WILL PASTE THEM ----------
 *
 * PURPOSE:      §6 r26 as sharpened 2026-09-24. Every V-block is EXTRACTED FROM ITS FILE by
 *               un-commenting it, and executed VERBATIM — no substitution, no ids supplied, no
 *               "equivalent" statement issued in its place.
 *
 * 🔴 WHY, AND IT IS MY OWN DEFECT. `20260924a` applied cleanly; its V4, V4b and V6 then FAILED TO
 *    RUN in the Supabase SQL editor — I had written them with psql placeholders (`:bid`, `:lot`)
 *    the editor cannot fill (42601, 22P02). `rung-dates-391.pglite.mjs` had "proved" those same
 *    behaviours by issuing ITS OWN SQL with real ids substituted in. It never executed the V-block
 *    TEXT, so it was structurally incapable of noticing the placeholders — tech-debt #182's shape
 *    (a probe that cannot reach the thing) inside the verification itself.
 *
 *    THE FIX IS THE POPULATION, NOT MORE ASSERTIONS: this harness's subject is the TEXT of the
 *    V-blocks. A1 is the negative control that keeps it honest — it plants a `:bid` back and
 *    requires the run to FAIL.
 *
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR · scripts/path-tests/lib/liveDb.mjs.
 * OUTPUTS:      PASS/FAIL per block; exit 1 on any failure, 2 if PGlite is unavailable.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/vblocks-as-pasted-391.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';
if (!process.env.PGLITE_DIR) { console.error('Set PGLITE_DIR.'); process.exit(2); }

const ROOT = process.cwd();
const REPLAY = ['20260916_container_ladder_install_t_posts.sql', '20260918c_container_ladder_caliper.sql',
                '20260923e_container_ladder_install_price.sql', '20260923h_container_ladder_grow_and_hold.sql',
                '20260924a_rung_entry_dates.sql', '20260924b_rung_sellability.sql',
                '20260924c_operations_config_history.sql'];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

/** Un-comment a `--   ` indented block back into the SQL a human pastes. */
const uncomment = (text) => text.split('\n')
  .filter((l) => /^--\s{2,}/.test(l))
  .map((l) => l.replace(/^--\s{2}/, ''))
  .join('\n');

/** Every `DO $tag$ … $tag$;` in a chunk of text, verbatim. */
function doBlocks(sql) {
  const out = [];
  const re = /DO\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi;
  let m; while ((m = re.exec(sql)) !== null) out.push(m[0]);
  return out;
}

async function base() {
  const db = await openLiveDb({ migrations: REPLAY });
  const B1 = '11111111-1111-1111-1111-111111111111', B2 = '22222222-2222-2222-2222-222222222222';
  const U1 = '33333333-3333-3333-3333-333333333333', OWNER = '44444444-4444-4444-4444-444444444444';
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}','o@e.test'), ('${U1}','m@e.test') ON CONFLICT DO NOTHING;
    INSERT INTO public.businesses (id, name, owner_id) VALUES
      ('${B1}','LAWNS Tree Farm, LLC','${OWNER}'), ('${B2}','Test Dave''s Tree Nest','${OWNER}');
    INSERT INTO public.business_members (business_id, user_id, active, role, name)
      VALUES ('${B1}','${U1}',true,'MANAGER','A Manager');
    INSERT INTO public.business_inventory (business_id, name, size, qty)
      VALUES ('${B1}','Mexican Sycamore','3/5 gal',140);
    INSERT INTO public.business_operations_config (business_id, config)
      VALUES ('${B1}','{"caliperMeasuredAtInches":12}'::jsonb);
  `);
  return db;
}

/** Run one DO block verbatim and read its RAISEd verdict. */
async function verdictOf(db, block) {
  try { await db.exec(block); return { raised: false, msg: '(the block completed WITHOUT raising — it reported nothing)' }; }
  catch (e) { return { raised: true, msg: String(e.message || e) }; }
}

const FILES = [
  ['20260924a — the standalone verify file', `${ROOT}/docs/decisions/2026-09-24-rung-dates-verify.sql`, false],
  ['20260924c — its V-blocks', `${ROOT}/supabase/migrations/20260924c_operations_config_history.sql`, true],
];

for (const [label, path, needsUncomment] of FILES) {
  const raw = readFileSync(path, 'utf8');
  const sql = needsUncomment ? uncomment(raw) : raw;

  const blocks = doBlocks(sql);

  // 🔴 THE CHECK THAT WOULD HAVE CAUGHT THE DEFECT: no psql placeholder may survive into the text
  // a human EXECUTES. ⚠️ THE POPULATION IS THE EXECUTABLE SQL, NOT THE WHOLE FILE — a first draft
  // scanned the file and went red on the PROSE that documents the defect (`:bid`, `:lot`). A cap
  // that condemns its own explanation is the false positive that gets caps disabled (#73), so the
  // subject is the extracted blocks plus any bare statement, with `--` lines stripped.
  // ⚠️ AND FOR A FILE WHOSE BLOCKS ARE COMMENTED INSIDE A MIGRATION, THE POPULATION IS THE BLOCKS
  // ALONE. `uncomment()` cannot tell a commented STATEMENT from commented PROSE, so it sweeps the
  // paragraph documenting this very defect into its output — which failed the scan on its own
  // explanation. What David pastes out of a migration is the DO blocks; that is the subject.
  const executable = needsUncomment
    ? blocks.join('\n')
    : blocks.join('\n') + '\n' + sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const ph = executable.match(/(?<![:\w]):[a-z_]{2,}\b|<[a-z][a-z _]+>/gi) ?? [];
  ok(ph.length === 0, `${label} — NO psql placeholder in the SQL a human EXECUTES${ph.length ? ` — found ${JSON.stringify([...new Set(ph)])}` : ''}`);
  ok(blocks.length > 0, `${label} — ${blocks.length} DO block(s) extracted`);

  for (const b of blocks) {
    const tag = (/\$([a-z0-9_]+)\$/i.exec(b) ?? [])[1];
    const db = await base();
    const v = await verdictOf(db, b);
    const pass = v.raised && /PASS ✅/.test(v.msg);
    const cannot = /CANNOT RUN|INCONCLUSIVE/.test(v.msg);
    ok(pass, `${label} · $${tag}$ — executed VERBATIM → ${pass ? v.msg.split(' — ')[0] : v.msg.slice(0, 160)}`);
    ok(!cannot, `${label} · $${tag}$ — reached its subject (not "CANNOT RUN"/"INCONCLUSIVE")`);
  }
}

// ── A1 — NEGATIVE CONTROL. Put a placeholder back; the run MUST fail. ─────────────────────────
{
  const raw = readFileSync(`${ROOT}/docs/decisions/2026-09-24-rung-dates-verify.sql`, 'utf8');
  const broken = raw.replace('FROM public.business_inventory bi ORDER BY bi.created_at, bi.id LIMIT 1;',
                             'FROM public.business_inventory bi WHERE bi.business_id = :bid LIMIT 1;');
  const block = doBlocks(broken)[0];
  const db = await base();
  const v = await verdictOf(db, block);
  ok(v.raised && !/PASS ✅/.test(v.msg),
    `A1 🔴 a re-planted \`:bid\` makes the block FAIL to execute — so this harness can disagree, which the old one could not (${v.msg.slice(0, 90)})`);
  const ph = broken.match(/(?<![:\w]):[a-z_]{2,}\b/gi) ?? [];
  ok(ph.length > 0, 'A1 …and the placeholder scan above would have caught it before David ever saw it');
}

console.log(fails === 0 ? '\n✅ vblocks-as-pasted-391 — every V-block runs verbatim, no placeholders' : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
