/**
 * ── MIGRATION CORPUS PARSER — the offline half of apply-state derivation ──────────────
 *
 * PURPOSE:      Read every .sql in supabase/migrations/ and emit the EXPECTED OBJECT LIST —
 *               every CREATE TABLE / ADD COLUMN / CREATE POLICY / CREATE FUNCTION /
 *               CREATE INDEX / CREATE TRIGGER, each carrying the file that owns it. This half
 *               needs no database and cannot rot: the corpus IS the input.
 * DEPENDENCIES: node:fs only. NO network, NO credentials, NO Supabase.
 * OUTPUTS:      { objects[], files[], unreadable[] } — objects are {kind, table, name, file}.
 *
 * ⚠️ WHAT THIS PARSER CANNOT READ, stated rather than silently dropped (R-33: a check that
 * cannot disagree is not a check — and a parser that silently drops what it cannot handle
 * manufactures a clean answer out of its own blind spot):
 *   · Dynamic SQL — an object whose name is built by string concatenation inside plpgsql.
 *     Every such statement is reported in `unreadable`, never omitted.
 *   · A migration that declares NO object is reported by name, so a data-only migration and
 *     a parse miss are told apart by a human rather than assumed equivalent.
 * IF-NOT-EXISTS and OR-REPLACE forms parse. Objects created inside DO $$ … $$ blocks parse,
 * because the block body is scanned as ordinary text after the dollar-quote is unwrapped.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Strip line and block comments without eating string or dollar-quoted literals. */
export function stripComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === '--') { const nl = sql.indexOf('\n', i); i = nl === -1 ? sql.length : nl; continue; }
    if (two === '/*') { const end = sql.indexOf('*/', i + 2); i = end === -1 ? sql.length : end + 2; out += ' '; continue; }
    if (sql[i] === "'") {
      const start = i; i++;
      while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") i += 2; else if (sql[i] === "'") { i++; break; } else i++; }
      out += sql.slice(start, i); continue;
    }
    const dq = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
    if (dq) {
      // Keep dollar-quoted bodies: plpgsql function and DO bodies create real objects.
      const tag = dq[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      out += sql.slice(i, stop); i = stop; continue;
    }
    out += sql[i]; i++;
  }
  return out;
}

const ident = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const clean = (s) => (s || '').replace(/"/g, '').replace(/^public\./i, '').toLowerCase();

const RULES = [
  { kind: 'table',
    re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:UNLOGGED\s+|TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: clean(m[1]), name: clean(m[1]) }) },
  { kind: 'column',
    re: new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${ident}(?:\.${ident})?)([\s\S]*?);`, 'gi'),
    expand: (m) => {
      const table = clean(m[1]);
      const adds = [...m[2].matchAll(new RegExp(String.raw`\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(${ident})`, 'gi'))];
      return adds.map((a) => ({ table, name: clean(a[1]) }));
    } },
  { kind: 'policy',
    re: new RegExp(String.raw`\bCREATE\s+POLICY\s+(${ident})\s+ON\s+(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: clean(m[2]), name: clean(m[1]) }) },
  { kind: 'function',
    re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: null, name: clean(m[1]) }) },
  { kind: 'index',
    re: new RegExp(String.raw`\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(${ident})\s+ON\s+(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: clean(m[2]), name: clean(m[1]) }) },
  { kind: 'trigger',
    re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(${ident})[\s\S]*?\bON\s+(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: clean(m[2]), name: clean(m[1]) }) },
  { kind: 'drop_table',
    re: new RegExp(String.raw`\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: clean(m[1]), name: clean(m[1]) }) },
  { kind: 'drop_view',
    re: new RegExp(String.raw`\bDROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?(${ident}(?:\.${ident})?)`, 'gi'),
    map: (m) => ({ table: clean(m[1]), name: clean(m[1]) }) },
  { kind: 'drop_column',
    re: new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${ident}(?:\.${ident})?)([\s\S]*?);`, 'gi'),
    expand: (m) => {
      const table = clean(m[1]);
      const drops = [...m[2].matchAll(new RegExp(String.raw`\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(${ident})`, 'gi'))];
      return drops.map((a) => ({ table, name: clean(a[1]) }));
    } },
  { kind: 'constraint',
    re: new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${ident}(?:\.${ident})?)([\s\S]*?);`, 'gi'),
    expand: (m) => {
      const table = clean(m[1]);
      const adds = [...m[2].matchAll(new RegExp(String.raw`\bADD\s+CONSTRAINT\s+(${ident})`, 'gi'))];
      return adds.map((a) => ({ table, name: clean(a[1]) }));
    } },
];

/** Statements whose object name is computed at runtime — reported, never dropped. */
const DYNAMIC = /\bEXECUTE\s+(?:format\s*\(|'[^']*\|\||[A-Za-z_]\w*\s*\|\|)/gi;

export function parseFile(sql, file) {
  const body = stripComments(sql);
  const objects = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(body)) !== null) {
      const rows = rule.expand ? rule.expand(m) : [rule.map(m)];
      for (const r of rows) if (r.name) objects.push({ kind: rule.kind, ...r, file });
    }
  }
  const dynamic = (body.match(DYNAMIC) || []).length;
  return { objects, dynamic };
}

export function parseCorpus(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const objects = [];
  const empty = [];
  const unreadable = [];
  for (const file of files) {
    const { objects: objs, dynamic } = parseFile(readFileSync(join(dir, file), 'utf8'), file);
    objects.push(...objs);
    if (objs.length === 0) empty.push(file);
    if (dynamic > 0) unreadable.push({ file, dynamic });
  }
  return { files, objects, empty, unreadable };
}
