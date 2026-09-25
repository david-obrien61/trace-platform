/**
 * -- install-kit-factor-419.pglite -- THE HARNESS 20260925h CITED AND NOBODY WROTE ----------------
 *
 * PURPOSE:      `20260925h_install_kit_components.sql` names
 *               `scripts/sql-harness/install-kit-411.pglite.mjs` in its own header as its harness.
 *               🔴 **THAT FILE WAS NEVER WRITTEN.** So the migration asserted a proof that did not
 *               exist, its four V-blocks were executed by nothing, and David found the defect in V3
 *               by pasting it against the live database:
 *
 *                 20260925h V3 FAIL — rung_ok=t rung_with_factor_refused=t mix_ok=t
 *                                     mix_without_factor_refused=**f**
 *
 *               This file is that harness, written late, and it does the one thing that would have
 *               caught it: **it runs 20260925h's OWN V-BLOCKS VERBATIM, red-first against the shipped
 *               constraint** — V3 must FAIL there, reproducing David's exact line — then applies
 *               `20260925m` and requires the same V3 TEXT to PASS.
 *
 * 🔴 WHY IT FAILED, and it is not a typo: `CHECK ((rule='per_rung' AND factor IS NULL) OR
 *    (rule<>'per_rung' AND factor > 0))` with a NULL factor on any other rule evaluates
 *    FALSE OR (TRUE AND NULL) = **NULL** — and **a CHECK is satisfied by NULL; only FALSE rejects.**
 *    The constraint was structurally incapable of refusing a missing factor. `factor IS NOT NULL` is
 *    never NULL, so the branch can be FALSE, which is what makes a refusal possible at all.
 *
 * ⚠️ AND THE ANSWER TO "was the fixture more forgiving than live?" IS **NO — THERE WAS NO FIXTURE.**
 *    Worth stating because it is the more dangerous of the two: a forgiving double gives a false
 *    green, but a harness that does not exist gives a false green *and* a citation vouching for it.
 *
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs. 20260925h is applied on the snapshot as the
 *               PRE state; 20260925m is applied on top as the FIX.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 without PGlite.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/install-kit-factor-419.pglite.mjs
 */
import { readFileSync } from 'node:fs';
if (!process.env.PGLITE_DIR) { console.error('Set PGLITE_DIR.'); process.exit(2); }
const { openLiveDb, closeLiveDbs } = await import(process.cwd() + '/scripts/path-tests/lib/liveDb.mjs');

const MIG = process.cwd() + '/supabase/migrations/';
const H = readFileSync(MIG + '20260925h_install_kit_components.sql', 'utf8');
const M = readFileSync(MIG + '20260925m_install_kit_factor_check_rejects_null.sql', 'utf8');
const body = (s) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const uncomment = (t) => t.split('\n').filter((l) => /^--\s{2,}/.test(l)).map((l) => l.replace(/^--\s{2}/, '')).join('\n');
const doBlocks = (s) => { const o = []; const re = /DO\s+\$([a-z0-9_]+)\$[\s\S]*?\$\1\$\s*;/gi; let m; while ((m = re.exec(s)) !== null) o.push(m[0]); return o; };
const verdict = async (db, blk) => { try { await db.exec(blk); return '(completed WITHOUT raising)'; } catch (e) { return String(e.message || e); } };

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const one = async (db, q) => (await db.query(q)).rows[0];
const refuses = async (db, sql) => { try { await db.exec(sql); return false; } catch { return true; } };

/** 20260925h's own V-blocks, in file order. V3 is the one David watched fail. */
const H_BLOCKS = doBlocks(uncomment(H));
const H_V3 = H_BLOCKS.find(b => /\$v3\$/.test(b));

async function tenant(db, tag) {
  const b = crypto.randomUUID(), u = crypto.randomUUID();
  await db.exec(`INSERT INTO auth.users (id) VALUES ('${u}');
    INSERT INTO public.businesses (id,name,owner_id) VALUES ('${b}','${tag}','${u}');`);
  return b;
}
const put = (b, key, rule, factor, unit = 'gal') =>
  `INSERT INTO public.install_kit_components (business_id,component_key,label,qb_item_id,rule,factor,unit,because)
     VALUES ('${b}','${key}','${key}','52','${rule}',${factor === null ? 'NULL' : factor},'${unit}','probe');`;

// ── 0 · THE CITATION ITSELF ───────────────────────────────────────────────────────────────────
{
  ok(/install-kit-411\.pglite\.mjs/.test(H),
    "0a — 20260925h's header names `install-kit-411.pglite.mjs` as its harness (the citation that vouched for nothing)");
  const { existsSync } = await import('node:fs');
  ok(!existsSync(process.cwd() + '/scripts/sql-harness/install-kit-411.pglite.mjs'),
    '0b 🔴 — and that file DOES NOT EXIST. This probe exists so the record cannot quietly become true later without someone noticing the swap');
  ok(H_BLOCKS.length === 4 && H_V3 !== undefined, `0c — 4 V-blocks extracted from 20260925h, including V3 (${H_BLOCKS.length})`);
}

// ── 1 · RED: the shipped constraint cannot refuse a NULL factor ────────────────────────────────
{
  const db = await openLiveDb({ migrations: ['20260925h_install_kit_components.sql'] });
  const b = await tenant(db, 'RED');
  const accepted = !(await refuses(db, put(b, 'mix_bad', 'per_container_gallon', null)));
  ok(accepted,
    '🔴 R1 RED — as SHIPPED, a `per_container_gallon` component with NO factor is ACCEPTED. This is David\'s live finding, reproduced');

  const truth = await one(db, `select (null::numeric > 0) is null as b_is_null,
    ((false) or (true and (null::numeric > 0))) is null as whole_is_null`);
  ok(truth.b_is_null === true && truth.whole_is_null === true,
    '🔴 R2 RED — and WHY: `null > 0` is NULL, so the whole expression is NULL — and a CHECK is satisfied by NULL. Only FALSE rejects');

  const v3 = await verdict(db, H_V3);
  ok(/V3 FAIL/.test(v3) && /mix_without_factor_refused=f/.test(v3),
    `🔴 R3 RED — 20260925h's OWN V3, run VERBATIM against the shipped constraint, FAILS exactly as David saw: ${v3.slice(0, 130)}`);

  ok(await refuses(db, put(b, 'rung_bad', 'per_rung', 2, 'each')),
    'R4 — the per_rung half was already right, before and after (a factor on per_rung is refused)');
}

// ── 2 · GREEN: with 20260925m applied, the same V3 text passes ─────────────────────────────────
{
  const db = await openLiveDb({ migrations: ['20260925h_install_kit_components.sql'] });
  await db.exec(body(M));
  const b = await tenant(db, 'GREEN');

  ok(await refuses(db, put(b, 'mix_bad', 'per_container_gallon', null)),
    '✅ G1 — a `per_container_gallon` component with NO factor is now REFUSED');
  for (const rule of ['per_tree', 'per_t_post', 'only_if_ordered', 'only_if_marked']) {
    ok(await refuses(db, put(b, `bad_${rule}`, rule, null)),
      `G1-${rule} — and so is every other non-per_rung rule with a NULL factor (the defect was not specific to the mix)`);
  }
  await db.exec(put(b, 't_post', 'per_rung', null, 'each'));
  ok(true, 'G2 — per_rung with NO factor is still ACCEPTED (the half that was right is not broken)');
  ok(await refuses(db, put(b, 'rung_bad', 'per_rung', 2, 'each')),
    'G3 — per_rung WITH a factor is still REFUSED');
  await db.exec(put(b, 'special_mix', 'per_container_gallon', 2));
  ok(true, 'G4 — a proper component is still accepted');
  ok(await refuses(db, put(b, 'zero', 'per_tree', 0, 'each')),
    'G5 — a factor of 0 is still refused (the `> 0` half still bites)');
  ok(await refuses(db, put(b, 'neg', 'per_tree', -2, 'each')),
    'G6 — and a negative one');

  const v3 = await verdict(db, H_V3);
  ok(/V3 PASS/.test(v3),
    `✅ G7 — 🔴 THE POINT OF THIS FILE: 20260925h's OWN V3, the same text, now PASSES: ${v3.slice(0, 140)}`);

  // Every other V-block of 20260925h, verbatim — none of them had ever been run.
  const db2 = await openLiveDb({ migrations: ['20260925h_install_kit_components.sql'] });
  await db2.exec(body(M));
  for (const blk of H_BLOCKS) {
    const tag = blk.match(/\$([a-z0-9_]+)\$/)[1];
    const msg = await verdict(db2, blk);
    ok(/PASS/.test(msg), `G8 · 20260925h $${tag}$ verbatim → ${msg.slice(0, 120)}`);
  }
}

// ── 3 · THE FIX FILE'S OWN V-BLOCKS, VERBATIM, AND ITS IDEMPOTENCE ─────────────────────────────
{
  const db = await openLiveDb({ migrations: ['20260925h_install_kit_components.sql'] });
  await db.exec(body(M));
  const blocks = doBlocks(uncomment(M));
  ok(blocks.length === 3, `V — ${blocks.length} DO block(s) extracted from 20260925m (expected 3)`);
  const ph = blocks.join('\n').match(/(?<![:\w]):[a-z_]{2,}\b|<[a-z][a-z _]+>/gi) ?? [];
  ok(ph.length === 0, `V — NO placeholder in the SQL David pastes${ph.length ? ` — ${JSON.stringify([...new Set(ph)])}` : ''}`);
  for (const blk of blocks) {
    const tag = blk.match(/\$([a-z0-9_]+)\$/)[1];
    const msg = await verdict(db, blk);
    ok(/PASS/.test(msg), `V · 20260925m $${tag}$ verbatim → ${msg.slice(0, 135)}`);
  }
  let twice = true; try { await db.exec(body(M)); } catch { twice = false; }
  ok(twice, 'I1 — 20260925m runs a SECOND time with no error (DROP … IF EXISTS then ADD)');
  const c = await one(db, `select count(*)::int n from pg_constraint
    where conrelid='public.install_kit_components'::regclass and conname='install_kit_factor_matches_rule'`);
  ok(c.n === 1, `I2 — and exactly ONE constraint by that name afterwards (${c.n})`);
}

// ── 4 · MUTANT: the fix reduced to the shipped form must go red again ──────────────────────────
{
  const db = await openLiveDb({ migrations: ['20260925h_install_kit_components.sql'] });
  const mutated = body(M).replace('rule <> \'per_rung\' AND factor IS NOT NULL AND factor > 0',
                                  'rule <> \'per_rung\' AND factor > 0');
  ok(mutated !== body(M), 'M1 — the mutant text differs (the IS NOT NULL is removed)');
  await db.exec(mutated);
  const b = await tenant(db, 'MU');
  const accepted = !(await refuses(db, put(b, 'mix_bad', 'per_container_gallon', null)));
  ok(accepted, 'M1 — CAUGHT: without `IS NOT NULL` the NULL factor is accepted again, so this harness can fail');
  const v3 = await verdict(db, H_V3);
  ok(/V3 FAIL/.test(v3), 'M1b — and 20260925h\'s V3 goes back to FAILING, which is the signal David reported');
}

const closed = await closeLiveDbs();
console.log(fails === 0 ? `\n✅ install-kit-factor-419 — every probe passed; ${closed} PGlite instance(s) closed`
                        : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
