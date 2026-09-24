/**
 * ── liveDb — the LIVE schema on PGlite, and a PostgREST-shaped client over it (ledger #345) ──────
 *
 * PURPOSE:      The writer-registry path tests enter a value through the REAL entry point (the API
 *               handler, or the function a form's Save calls) and read it back from the database and
 *               from the read path a person looks at. This file is the database they run against:
 *               `scripts/sql-harness/fixtures/live-schema-public.sql` (the live `public` schema,
 *               structure only — tables, triggers, functions, RLS policies) on PGlite, plus the few
 *               Supabase pieces it needs (roles, `auth.uid()`, `auth.users`, the `extensions` schema).
 *
 *               `restClient(db, { uid })` answers the subset of supabase-js the writers use. With a
 *               `uid` every request runs as `authenticated` with that user's JWT claims, so RLS and
 *               `has_permission` decide exactly as they do live; without one it is the service key.
 *               Each request is its own transaction, as PostgREST's are.
 *
 * DEPENDENCIES: @electric-sql/pglite (dev dependency) · the schema fixture.
 * OUTPUTS:      openLiveDb() · restClient(db, opts) · installSupabaseShim(db)
 *
 * ⚠️ WHAT IS NOT MODELLED, SAID RATHER THAN IMPLIED: table GRANTs are Supabase's defaults (all
 *    privileges to anon/authenticated/service_role; RLS does the filtering), not read from the live
 *    ACLs; PostgREST's embedded-resource syntax is supported one FK deep per level; no `storage`.
 */
import { PGlite, types } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

// Resolved from the repo root: this module is bundled into each path test, so its own URL moves.
const FIXTURE_DIR = `${process.env.PATH_TEST_ROOT ?? process.cwd()}/scripts/sql-harness/fixtures`;
const FIXTURE = `${FIXTURE_DIR}/live-schema-public.sql`;

const STUBS = `
  CREATE SCHEMA IF NOT EXISTS extensions;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
  CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now());
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
    $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
  SET search_path = public, extensions;
`;

const GRANTS = `
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  -- Sequences too, or a serial column refuses every insert with permission denied for sequence.
  -- MEASURED live 2026-09-24: anon and authenticated both hold USAGE on the one sequence in
  -- public, so this blanket grant matches the database rather than assuming.
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  -- NO BLANKET GRANT EXECUTE ON ALL FUNCTIONS ANY MORE (2026-09-24, ledger #391).
  -- It ran AFTER the dump, so it silently undid every REVOKE the dump carries and made EVERY
  -- function callable by anon -- including crew_day_read, which live revokes from both anon and
  -- authenticated (MEASURED). The fixture was LESS RESTRICTIVE THAN LIVE, and the guard whose whole
  -- job is "only the endpoint may call this" could not pass against it.
  -- Postgres already gives a new function EXECUTE to PUBLIC, so the default case needs no grant;
  -- the dump now emits REVOKE/GRANT only where live DIFFERS from that default (40 functions).
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  GRANT SELECT ON auth.users TO authenticated, service_role;
`;

const cachedDumps = new Map();

/**
 * A fresh database holding the live schema. ~1–2 s the first time; later calls restore a dump.
 * `fixture` names another snapshot in the fixtures folder — the notes harness (ledger #346) uses
 * the 2026-09-17 PRE-DROP snapshot, because what it proves is what `20260915b` did to that schema.
 */
export async function openLiveDb({ fixture, migrations = [] } = {}) {
  const file = fixture ? `${FIXTURE_DIR}/${fixture}` : FIXTURE;
  // `migrations` are repo migrations APPLIED ON TOP of the snapshot — what a test needs when the
  // behaviour it drives is not live yet (ledger #349: 20260917d's INSERT policy). The cache key
  // carries them, so a run with and without them cannot share a dump.
  const key = [file, ...migrations].join('|');
  const cachedDump = cachedDumps.get(key) ?? null;
  const parsers = {
    [types.NUMERIC]: v => Number(v), [types.INT8]: v => Number(v),
    [types.TIMESTAMPTZ]: v => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString(),
    [types.TIMESTAMP]: v => v, [types.DATE]: v => v,
  };
  if (cachedDump) {
    const db = new PGlite({ extensions: { uuid_ossp, pgcrypto }, parsers, loadDataDir: cachedDump });
    await db.waitReady;
    return db;
  }
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto }, parsers });
  await db.exec(STUBS);
  const statements = readFileSync(file, 'utf8').split('\n-- @@\n');
  for (const s of statements) {
    try { await db.exec(s); }
    catch (e) { throw new Error(`live schema fixture: ${e.message}\n  in: ${s.slice(0, 160)}`); }
  }
  for (const m of migrations) {
    try { await db.exec(readFileSync(`${process.env.PATH_TEST_ROOT ?? process.cwd()}/supabase/migrations/${m}`, 'utf8')); }
    catch (e) { throw new Error(`migration ${m} on the snapshot: ${e.message}`); }
  }
  await db.exec(GRANTS);
  await db.exec(`ALTER DATABASE postgres SET search_path = public, extensions;`);
  cachedDumps.set(key, await db.dumpDataDir('none'));
  return db;
}

// ── the PostgREST-shaped client ───────────────────────────────────────────────────────────────
const qi = (s) => `"${String(s).trim().replace(/"/g, '""')}"`;

async function meta(db) {
  if (db.__meta) return db.__meta;
  const cols = await db.query(`select table_name t, column_name c, data_type d from information_schema.columns where table_schema='public'`);
  const fks = await db.query(`
    select c.conrelid::regclass::text t, a.attname col, c.confrelid::regclass::text rt, ra.attname rcol, c.conname name
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace`);
  const fns = await db.query(`
    select p.proname n, p.proretset set, t.typtype tt, t.typname tn, pg_get_function_result(p.oid) r
      from pg_proc p join pg_type t on t.oid = p.prorettype
     where p.pronamespace = 'public'::regnamespace`);
  const types = new Map();
  for (const r of cols.rows) { if (!types.has(r.t)) types.set(r.t, new Map()); types.get(r.t).set(r.c, r.d); }
  const clean = (x) => x.replace(/^public\./, '').replace(/"/g, '');
  db.__meta = {
    types,
    fks: fks.rows.map(r => ({ t: clean(r.t), col: r.col, rt: clean(r.rt), rcol: r.rcol, name: r.name })),
    fns: new Map(fns.rows.map(r => [r.n, r])),
  };
  return db.__meta;
}

/** Split a select string at top-level commas. */
function splitTop(s) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/** SQL projecting `cols` of `table` aliased `alias`, as jsonb; embeds become sub-selects. */
function projection(m, table, alias, cols, depth, inners = null) {
  const parts = [];
  for (const raw of splitTop(cols.replace(/\s+/g, ' '))) {
    const emb = raw.match(/^(?:([\w]+):)?([\w]+)(?:!([\w]+))?\s*\((.*)\)$/s);
    if (!emb) {
      if (raw === '*') { parts.push(`to_jsonb(${alias})`); continue; }
      const [as, name] = raw.includes(':') && !raw.includes('::') ? raw.split(':') : [raw, raw];
      const col = name.replace(/::\w+$/, '').trim();
      parts.push(`jsonb_build_object(${`'${as.trim()}'`}, ${alias}.${qi(col)})`);
      continue;
    }
    const [, as, rel, rawHint, inner] = emb;
    const isInner = rawHint === 'inner';
    const hint = isInner ? undefined : rawHint;
    const sub = `e${depth}_${parts.length}`;
    const down = m.fks.find(f => f.t === table && f.rt === rel && (!hint || f.name === hint || f.col === hint));
    const up = m.fks.find(f => f.t === rel && f.rt === table && (!hint || f.name === hint || f.col === hint));
    const key = as ?? rel;
    // `!inner` — PostgREST keeps only parent rows that HAVE a matching child.
    if (isInner && inners && (down || up)) {
      inners.push(down
        ? `EXISTS (SELECT 1 FROM public.${qi(rel)} x WHERE x.${qi(down.rcol)} = ${alias}.${qi(down.col)})`
        : `EXISTS (SELECT 1 FROM public.${qi(rel)} x WHERE x.${qi(up.col)} = ${alias}.${qi(up.rcol)})`);
    }
    if (down) {
      parts.push(`jsonb_build_object('${key}', (select ${projection(m, rel, sub, inner, depth + 1)} from public.${qi(rel)} ${sub} where ${sub}.${qi(down.rcol)} = ${alias}.${qi(down.col)} limit 1))`);
    } else if (up) {
      parts.push(`jsonb_build_object('${key}', coalesce((select jsonb_agg(${projection(m, rel, sub, inner, depth + 1)}) from public.${qi(rel)} ${sub} where ${sub}.${qi(up.col)} = ${alias}.${qi(up.rcol)}), '[]'::jsonb))`);
    } else throw new Error(`liveDb adapter: no foreign key between ${table} and ${rel}`);
  }
  if (parts.length === 0) return `'{}'::jsonb`;
  return parts.join(' || ');
}

export function restClient(db, opts = {}) {
  const uid = opts.uid ?? null;

  async function run(fn) {
    return db.transaction(async (tx) => {
      if (uid) {
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true),
                               set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
        await tx.exec(`SET LOCAL ROLE authenticated`);
      }
      return fn(tx);
    });
  }

  class Query {
    constructor(table) {
      Object.assign(this, { table, verb: 'select', cols: '*', rows: [], patch: {}, where: [], params: [],
        orders: [], lim: null, off: null, countMode: null, head: false, returning: null, mode: 'many',
        onConflict: null, ignoreDuplicates: false });
    }
    p(v, col) {
      const type = col && db.__meta?.types.get(this.table)?.get(col);
      let val = v;
      if (v === undefined) val = null;
      else if (type === 'jsonb' || type === 'json') val = v === null ? null : JSON.stringify(v);
      else if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) val = JSON.stringify(v);
      this.params.push(val);
      return `$${this.params.length}`;
    }
    select(cols = '*', o = {}) {
      if (this.verb === 'select') { this.cols = cols; this.countMode = o.count ?? null; this.head = !!o.head; }
      else this.returning = cols;
      return this;
    }
    insert(r, o = {}) { this.verb = 'insert'; this.rows = Array.isArray(r) ? r : [r]; this.onConflict = o.onConflict ?? null; this.ignoreDuplicates = !!o.ignoreDuplicates; return this; }
    upsert(r, o = {}) { this.insert(r, o); this.verb = 'upsert'; return this; }
    update(p) { this.verb = 'update'; this.patch = p; return this; }
    delete(o = {}) { this.verb = 'delete'; this.countMode = o.count ?? null; return this; }
    w(c, op, v) { this.where.push({ c, op, v }); return this; }
    eq(c, v) { return this.w(c, '=', v); }
    neq(c, v) { return this.w(c, '<>', v); }
    gt(c, v) { return this.w(c, '>', v); }
    gte(c, v) { return this.w(c, '>=', v); }
    lt(c, v) { return this.w(c, '<', v); }
    lte(c, v) { return this.w(c, '<=', v); }
    like(c, v) { return this.w(c, 'like', v); }
    ilike(c, v) { return this.w(c, 'ilike', v); }
    in(c, vs) { return this.w(c, 'in', vs); }
    is(c, v) { return this.w(c, 'is', v); }
    not(c, op, v) { return this.w(c, `not ${op}`, v); }
    or(expr) { this.where.push({ or: expr }); return this; }
    filter(c, op, v) { return this.w(c, op, v); }
    match(obj) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
    order(c, o = {}) { this.orders.push(`${qi(c)} ${o.ascending === false ? 'DESC' : 'ASC'}${o.nullsFirst ? ' NULLS FIRST' : ''}`); return this; }
    limit(n) { this.lim = n; return this; }
    range(a, b) { this.off = a; this.lim = b - a + 1; return this; }
    single() { this.mode = 'one'; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    abortSignal() { return this; }
    returns() { return this; }
    then(res, rej) { return this.exec().then(res, rej); }

    cond(t, { c, op, v, or }) {
      if (or) {
        return '(' + splitTop(or).map(part => {
          const [col, o, ...rest] = part.split('.');
          const val = rest.join('.');
          return this.cond(t, { c: col, op: { eq: '=', neq: '<>', ilike: 'ilike', like: 'like', is: 'is', gt: '>', lt: '<' }[o] ?? o,
            v: o === 'is' ? (val === 'null' ? null : val === 'true') : val.replace(/\*/g, '%') });
        }).join(' OR ') + ')';
      }
      if (c.includes('.')) {
        // A filter on an embedded resource (`orders.status`). Applied as an EXISTS on the related
        // row — the `!inner` meaning, which is how every such filter in this codebase is used.
        const [rel, sub] = c.split('.');
        const m = db.__meta;
        const down = m.fks.find(f => f.t === this.table && f.rt === rel);
        const up = m.fks.find(f => f.t === rel && f.rt === this.table);
        const join = down ? `x.${qi(down.rcol)} = ${t}.${qi(down.col)}` : up ? `x.${qi(up.col)} = ${t}.${qi(up.rcol)}` : null;
        if (!join) throw new Error(`liveDb adapter: no foreign key between ${this.table} and ${rel}`);
        return `EXISTS (SELECT 1 FROM public.${qi(rel)} x WHERE ${join} AND ${this.cond('x', { c: sub, op, v })})`;
      }
      const col = `${t}.${qi(c)}`;
      if (op === 'is') return v === null ? `${col} IS NULL` : `${col} IS ${v ? 'TRUE' : 'FALSE'}`;
      if (op === 'not is') return v === null ? `${col} IS NOT NULL` : `${col} IS NOT ${v ? 'TRUE' : 'FALSE'}`;
      if (op === 'in') return `${col}::text = ANY(${this.p((v ?? []).map(String))}::text[])`;
      if (op === 'not in') {
        const list = Array.isArray(v) ? v : String(v).replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''));
        return `NOT (${col}::text = ANY(${this.p(list.map(String))}::text[]))`;
      }
      if (op === 'like' || op === 'ilike') return `${col}::text ${op.toUpperCase()} ${this.p(String(v))}`;
      if (op === 'not like' || op === 'not ilike') return `${col}::text NOT ${op.slice(4).toUpperCase()} ${this.p(String(v))}`;
      if (typeof v === 'number') return `${col} ${op} ${this.p(v)}`;
      if (typeof v === 'boolean') return `${col} ${op} ${this.p(v)}::boolean`;
      return `${col}::text ${op} ${this.p(v === null ? null : String(v))}::text`;
    }

    async exec() {
      try {
        const m = await meta(db);
        // 🔴 A MISSING TABLE REFUSES THE WAY POSTGREST REFUSES (§6 r19(a), ledger #362). Without
        // this the adapter fell through to projection and threw *"no foreign key between X and Y"*
        // — a RELATIONSHIP error for a table that does not exist. Any caller with a fallback for
        // "this migration is not applied here" (stopRead's ladder, readTeams' pre-rename rung) then
        // failed to recognise its own condition, so the rung never fired and the test that was
        // written to exercise it reported a defect that only the double had. PostgREST returns
        // PGRST205 with the table named; so does this now.
        if (!m.types.has(this.table)) {
          return { data: null, count: null, status: 404,
            error: { code: 'PGRST205', message: `Could not find the table 'public.${this.table}' in the schema cache`,
                     details: null, hint: null } };
        }
        const out = await run(async (tx) => {
          const t = 't0';
          const whereSql = () => (this.where.length ? ' WHERE ' + this.where.map(x => this.cond(t, x)).join(' AND ') : '');
          const ret = (cols, inners = null) => projection(m, this.table, t, cols ?? '*', 1, inners);
          let sql;
          if (this.verb === 'select') {
            const inners = [];
            const proj = ret(this.cols, inners);
            const conds = [...this.where.map(x => this.cond(t, x)), ...inners];
            const w = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
            if (this.head) sql = `SELECT count(*)::int AS n FROM public.${qi(this.table)} ${t}${w}`;
            else sql = `SELECT ${proj} AS r${this.countMode ? ', count(*) over ()::int AS n' : ''} FROM public.${qi(this.table)} ${t}${w}`
              + (this.orders.length ? ' ORDER BY ' + this.orders.map(o => `${t}.${o}`).join(', ') : '')
              + (this.lim !== null ? ` LIMIT ${this.lim}` : '') + (this.off !== null ? ` OFFSET ${this.off}` : '');
          } else if (this.verb === 'insert' || this.verb === 'upsert') {
            const keys = [...new Set(this.rows.flatMap(r => Object.keys(r)))];
            const values = this.rows.map(r => `(${keys.map(k => (k in r ? this.p(r[k], k) : 'DEFAULT')).join(', ')})`).join(', ');
            let conflict = '';
            if (this.verb === 'upsert') {
              const target = this.onConflict ? `(${this.onConflict.split(',').map(qi).join(', ')})` : '(id)';
              conflict = this.ignoreDuplicates ? ` ON CONFLICT ${target} DO NOTHING`
                : ` ON CONFLICT ${target} DO UPDATE SET ${keys.map(k => `${qi(k)} = EXCLUDED.${qi(k)}`).join(', ')}`;
            }
            sql = this.returning === null
              ? `INSERT INTO public.${qi(this.table)} (${keys.map(qi).join(', ')}) VALUES ${values}${conflict}`
              : `WITH ${t} AS (INSERT INTO public.${qi(this.table)} (${keys.map(qi).join(', ')}) VALUES ${values}${conflict} RETURNING *) SELECT ${ret(this.returning)} AS r FROM ${t}`;
          } else if (this.verb === 'update') {
            const set = Object.entries(this.patch).map(([k, v]) => `${qi(k)} = ${this.p(v, k)}`).join(', ');
            sql = this.returning === null
              ? `UPDATE public.${qi(this.table)} ${t} SET ${set}${whereSql()}`
              : `WITH ${t} AS (UPDATE public.${qi(this.table)} ${t} SET ${set}${whereSql()} RETURNING ${t}.*) SELECT ${ret(this.returning)} AS r FROM ${t}`;
          } else {
            sql = this.returning === null
              ? `DELETE FROM public.${qi(this.table)} ${t}${whereSql()}`
              : `WITH ${t} AS (DELETE FROM public.${qi(this.table)} ${t}${whereSql()} RETURNING ${t}.*) SELECT ${ret(this.returning)} AS r FROM ${t}`;
          }
          return tx.query(sql, this.params);
        });
        if (this.head) return { data: null, error: null, count: out.rows[0].n, status: 200 };
        if (this.verb !== 'select' && this.returning === null) {
          // return=minimal: no body; the count (when asked for) is the affected-row count.
          return { data: null, error: null, count: this.countMode ? (out.affectedRows ?? 0) : null, status: 201 };
        }
        const rows = out.rows.map(r => r.r);
        const count = this.countMode ? (out.rows[0]?.n ?? rows.length) : null;
        const noReturn = this.verb !== 'select' && this.returning === null;
        if (this.mode === 'one') {
          if (rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: `JSON object requested, multiple (or no) rows returned (${rows.length})` }, count };
          return { data: rows[0], error: null, count };
        }
        if (this.mode === 'maybe') {
          if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' }, count };
          return { data: rows[0] ?? null, error: null, count };
        }
        return { data: noReturn ? null : rows, error: null, count: this.verb === 'delete' && this.countMode ? rows.length : count, status: 200 };
      } catch (e) {
        return { data: null, error: { code: e.code ?? 'PGLITE', message: e.message, details: e.detail ?? null, hint: e.hint ?? null }, count: null };
      }
    }
  }

  async function rpc(name, args = {}) {
    try {
      const m = await meta(db);
      const fn = m.fns.get(name);
      if (!fn) return { data: null, error: { code: 'PGRST202', message: `function ${name} not found` } };
      const keys = Object.keys(args);
      const params = keys.map(k => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v; });
      const call = `public.${qi(name)}(${keys.map((k, i) => `${qi(k)} => $${i + 1}`).join(', ')})`;
      const tableLike = fn.set || fn.tt === 'c' || /^TABLE\(/.test(fn.r);
      const sql = tableLike ? `SELECT to_jsonb(x) AS r FROM ${call} x` : `SELECT to_jsonb(${call}) AS r`;
      const out = await run(tx => tx.query(sql, params));
      const rows = out.rows.map(r => r.r);
      if (fn.set || /^TABLE\(/.test(fn.r)) return { data: rows, error: null };
      return { data: rows[0] ?? null, error: null };
    } catch (e) {
      return { data: null, error: { code: e.code ?? 'PGLITE', message: e.message } };
    }
  }

  const user = uid ? { id: uid, email: `${uid.slice(0, 8)}@test.invalid` } : null;
  return {
    from: (t) => new Query(t),
    rpc,
    auth: {
      getUser: async () => ({ data: { user }, error: user ? null : { message: 'no user' } }),
      getSession: async () => ({ data: { session: user ? { user, access_token: `test-uid:${uid}` } : null }, error: null }),
    },
  };
}

/**
 * Point `@supabase/supabase-js` (aliased to ./supabaseShim.mjs in the path-test bundle) at `db`.
 * A client created with `Authorization: Bearer test-uid:<uuid>` acts as that user; any other client
 * is the service key.
 */
export function installSupabaseShim(db) {
  globalThis.__LIVE_DB__ = db;
  globalThis.__LIVE_REST__ = restClient;
}
