#!/usr/bin/env node
/**
 * ── snapshot-live-schema — the live `public` schema as replayable SQL (STRUCTURE ONLY) ──────────
 *
 * PURPOSE:      The writer-registry path tests (ledger #345) run every capture path against a real
 *               database. A database built from `supabase/migrations/` alone is NOT the real one:
 *               `customers`, `orders` and `order_items` were never created by a migration
 *               (tech-debt #39), so the corpus cannot produce them. This script reads the LIVE
 *               catalog and writes the `public` schema — tables, defaults, constraints, indexes,
 *               functions, triggers, RLS policies, views — as one SQL file PGlite can replay.
 * DEPENDENCIES: SUPABASE_PAT in the environment (the read-only role); scripts/lib/pgQuery.mjs.
 * OUTPUTS:      scripts/sql-harness/fixtures/live-schema-public.sql. 🔴 NO ROWS ARE READ — the file
 *               holds structure only, so it carries no customer data and is safe to commit.
 *
 * Run after any migration is applied live, and commit the new file:
 *   SUPABASE_PAT=… node scripts/sql-harness/snapshot-live-schema.mjs
 */
import { writeFileSync } from 'node:fs';
import { sql } from '../lib/pgQuery.mjs';

const OUT = new URL('./fixtures/live-schema-public.sql', import.meta.url).pathname;
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

const tables = await sql(`
  select c.relname as t, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p') order by c.relname`);
const cols = await sql(`
  select c.relname as t, a.attname as col, format_type(a.atttypid, a.atttypmod) as type,
         a.attnotnull as notnull, pg_get_expr(d.adbin, d.adrelid) as def, a.attgenerated as gen
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped
   order by c.relname, a.attnum`);
const cons = await sql(`
  select c.relname as t, k.conname as name, k.contype as type, pg_get_constraintdef(k.oid) as def
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p')
   order by case k.contype when 'p' then 0 when 'u' then 1 when 'c' then 2 else 3 end, c.relname, k.conname`);
const idx = await sql(`
  select i.indexname as name, i.indexdef as def
    from pg_indexes i
   where i.schemaname = 'public'
     and not exists (select 1 from pg_constraint k join pg_class ic on ic.oid = k.conindid
                      join pg_namespace n on n.oid = ic.relnamespace
                     where n.nspname = 'public' and ic.relname = i.indexname)
   order by i.tablename, i.indexname`);
const fns = await sql(`
  select p.proname as name, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f','p') order by p.proname, p.oid`);
const trg = await sql(`
  select c.relname as t, t.tgname as name, pg_get_triggerdef(t.oid) as def, t.tgenabled as enabled
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal order by c.relname, t.tgname`);
const pol = await sql(`
  select tablename as t, policyname as name, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'public' order by tablename, policyname`);
const views = await sql(`
  select c.relname as name, pg_get_viewdef(c.oid, true) as def
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' order by c.relname`);

const out = [];
out.push(`-- LIVE public SCHEMA SNAPSHOT — structure only, no rows. Generated ${new Date().toISOString()}`);
out.push(`-- by scripts/sql-harness/snapshot-live-schema.mjs. Do not edit by hand; re-run the script.`);
out.push(`-- ${tables.length} tables · ${fns.length} functions · ${trg.length} triggers · ${pol.length} policies · ${views.length} views`);
out.push(`SET check_function_bodies = off;`);

// Statements are separated by a `-- @@` line so a loader can run them one at a time and name the
// one that fails; a blank line cannot be the separator, function bodies contain blank lines.
// 1. tables — columns with NOT NULL; defaults and generated columns come after the functions.
const byTable = new Map();
for (const c of cols) { if (!byTable.has(c.t)) byTable.set(c.t, []); byTable.get(c.t).push(c); }
for (const { t } of tables) {
  const lines = byTable.get(t).filter(c => !c.gen).map(c => `  ${q(c.col)} ${c.type}${c.notnull ? ' NOT NULL' : ''}`);
  out.push(`CREATE TABLE public.${q(t)} (\n${lines.join(',\n')}\n);`);
}
// 2. functions (bodies unchecked, so order among them does not matter)
for (const f of fns) out.push(`${f.def.trim()};`);
// 3. defaults and generated columns
for (const c of cols) {
  if (c.gen) out.push(`ALTER TABLE public.${q(c.t)} ADD COLUMN ${q(c.col)} ${c.type} GENERATED ALWAYS AS ${c.def.startsWith('(') ? c.def : `(${c.def})`} STORED;`);
  else if (c.def !== null) out.push(`ALTER TABLE public.${q(c.t)} ALTER COLUMN ${q(c.col)} SET DEFAULT ${c.def};`);
}
// 4. constraints — primary and unique before foreign keys (the ORDER BY above)
for (const k of cons) out.push(`ALTER TABLE public.${q(k.t)} ADD CONSTRAINT ${q(k.name)} ${k.def};`);
// 5. indexes
for (const i of idx) out.push(`${i.def};`);
// 6. views
for (const v of views) out.push(`CREATE VIEW public.${q(v.name)} AS ${v.def.trim().replace(/;$/, '')};`);
// 7. triggers (a disabled trigger stays disabled)
for (const t of trg) {
  out.push(`${t.def};`);
  if (t.enabled === 'D') out.push(`ALTER TABLE public.${q(t.t)} DISABLE TRIGGER ${q(t.name)};`);
}
// 8. row-level security
for (const { t, rls } of tables) if (rls) out.push(`ALTER TABLE public.${q(t)} ENABLE ROW LEVEL SECURITY;`);
for (const p of pol) {
  const roles = (Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, '').split(',')).map(r => r === 'public' ? 'public' : q(r)).join(', ');
  out.push(`CREATE POLICY ${q(p.name)} ON public.${q(p.t)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}`
    + (p.qual ? ` USING (${p.qual})` : '') + (p.with_check ? ` WITH CHECK (${p.with_check})` : '') + ';');
}
out.push(`RESET check_function_bodies;`);
writeFileSync(OUT, out.join('\n-- @@\n') + '\n');
console.log(`wrote ${OUT}: ${tables.length} tables, ${fns.length} functions, ${trg.length} triggers, ${pol.length} policies, ${views.length} views`);
