/**
 * ── MIGRATION CORPUS PARSER — the offline half of apply-state derivation ──────────────
 *
 * PURPOSE:      Read every .sql in supabase/migrations/ and emit the EXPECTED OBJECT LIST —
 *               every CREATE TABLE / ADD COLUMN / CREATE POLICY / CREATE FUNCTION /
 *               CREATE INDEX / CREATE TRIGGER, each carrying the file that owns it — AND every
 *               statement that later REMOVES, RENAMES or RE-SHAPES one of those objects. This half
 *               needs no database and cannot rot: the corpus IS the input.
 * DEPENDENCIES: node:fs only. NO network, NO credentials, NO Supabase.
 * OUTPUTS:      { objects[], files[], empty[], dataOnly[], commentOnly[], unreadable[] } —
 *               objects are {kind, schema, table, name, file, pos, ...extra}.
 *
 * 🔴 WHY THE REMOVALS AND RENAMES ARE PARSED, AND IT IS THE WHOLE POINT OF THE 2026-09-11 REWRITE:
 *   the first version recorded CREATEs and only two kinds of DROP. So an object a later migration
 *   removed on purpose read EXACTLY like one that never ran. Measured against the live database on
 *   2026-09-11, the catalog step reported **10 files as FAIL and not one of them was missing**:
 *     · 155 `DROP POLICY` statements were invisible — every superseded policy read as NOT APPLIED
 *     · 3 table renames were invisible (`plants → cultivar_plants`, `business_assets → cost_objects`,
 *       `campaign_tone_samples → business_voice_samples`) — a policy that moved with its table read
 *       as missing from the table it was created on
 *     · `storage.objects` kept its schema inside the table string, so the catalog looked for three
 *       receipts policies in `public` and reported them absent
 *   A parser that silently drops what it cannot read manufactures a clean-looking FAILURE out of its
 *   own blind spot — the mirror image of R-33, and just as untrustworthy.
 *
 * ⚠️ WHAT THIS PARSER STILL CANNOT READ, stated rather than silently dropped:
 *   · Dynamic SQL — an object whose name is built by string concatenation inside plpgsql.
 *     Every such statement is reported in `unreadable`, never omitted.
 *   · DATA — an UPDATE / INSERT / DELETE backfill declares no object. Its apply-state lives in the
 *     ROWS, and no generic check can read intent off a row. Reported in `dataOnly`, by name.
 *   · A file with no executable SQL at all (comments only) is reported in `commentOnly` — there is
 *     nothing in it to apply, which is a different fact from "could not check".
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
const qident = String.raw`${ident}(?:\.${ident})?`;
const unq = (s) => (s || '').replace(/"/g, '');
/** Bare object name — the last dotted segment, lower-cased. */
const bare = (s) => { const p = unq(s).split('.'); return p[p.length - 1].toLowerCase(); };
/** The schema a qualified name lives in; an unqualified name is `public`. */
const schemaOf = (s) => { const p = unq(s).split('.'); return p.length > 1 ? p[0].toLowerCase() : 'public'; };
const ALL_TABLE_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
const privList = (s) => {
  const p = s.toUpperCase().replace(/\bPRIVILEGES\b/, '').split(',').map((x) => x.trim()).filter(Boolean);
  return p.includes('ALL') ? ALL_TABLE_PRIVS : p;
};
const roleList = (s) => s.split(',').map((x) => unq(x.trim()).toLowerCase()).filter(Boolean);
/** Objects that are not tables — a GRANT/REVOKE on these is not a table privilege. */
const NOT_A_TABLE = String.raw`(?!(?:FUNCTION|FUNCTIONS|ALL|SCHEMA|SEQUENCE|SEQUENCES|TABLES|TYPE|TYPES|DOMAIN|ROUTINE|ROUTINES|PROCEDURE|DATABASE|LANGUAGE)\b)`;

/** ALTER TABLE <t> … ; — sub-clauses expanded per rule. One regex, shared, so every rule reads the same statement boundary. */
const ALTER_TABLE = () => new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${qident})([\s\S]*?);`, 'gi');
const onAlter = (m, clause, build) => {
  const table = bare(m[1]); const schema = schemaOf(m[1]);
  return [...m[2].matchAll(new RegExp(clause, 'gi'))].map((a) => ({ schema, table, ...build(a) }));
};

const RULES = [
  // ── CREATE side ───────────────────────────────────────────────────────────────────────
  { kind: 'table',
    re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:UNLOGGED\s+|TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: bare(m[1]), name: bare(m[1]) }) },
  { kind: 'column', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(${ident})`, (a) => ({ name: bare(a[1]) })) },
  { kind: 'policy',
    re: new RegExp(String.raw`\bCREATE\s+POLICY\s+(${ident})\s+ON\s+(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]) }) },
  { kind: 'function',
    re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: null, name: bare(m[1]) }) },
  { kind: 'index',
    re: new RegExp(String.raw`\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(${ident})\s+ON\s+(?:ONLY\s+)?(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]) }) },
  { kind: 'trigger',
    re: new RegExp(String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(${ident})[\s\S]*?\bON\s+(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]) }) },
  { kind: 'constraint', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bADD\s+CONSTRAINT\s+(${ident})`, (a) => ({ name: bare(a[1]) })) },
  { kind: 'grant_table',
    re: new RegExp(String.raw`\bGRANT\s+([A-Za-z ,]+?)\s+ON\s+(?:TABLE\s+)?${NOT_A_TABLE}(${qident})\s+TO\s+([^;]+);`, 'gi'),
    expand: (m) => privList(m[1]).flatMap((priv) => roleList(m[3]).map((role) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: `${priv}:${role}`, priv, role }))) },
  // ── REMOVE side ───────────────────────────────────────────────────────────────────────
  { kind: 'drop_table',
    re: new RegExp(String.raw`\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: bare(m[1]), name: bare(m[1]) }) },
  { kind: 'drop_view',
    re: new RegExp(String.raw`\bDROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: bare(m[1]), name: bare(m[1]) }) },
  { kind: 'drop_column', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(${ident})`, (a) => ({ name: bare(a[1]) })) },
  { kind: 'drop_policy',
    re: new RegExp(String.raw`\bDROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(${ident})\s+ON\s+(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]) }) },
  { kind: 'drop_trigger',
    re: new RegExp(String.raw`\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?(${ident})\s+ON\s+(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]) }) },
  { kind: 'drop_index',
    re: new RegExp(String.raw`\bDROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: null, name: bare(m[1]) }) },
  { kind: 'drop_function',
    re: new RegExp(String.raw`\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(${qident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: null, name: bare(m[1]) }) },
  { kind: 'drop_constraint', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bDROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(${ident})`, (a) => ({ name: bare(a[1]) })) },
  { kind: 'revoke_table',
    re: new RegExp(String.raw`\bREVOKE\s+([A-Za-z ,]+?)\s+ON\s+(?:TABLE\s+)?${NOT_A_TABLE}(${qident})\s+FROM\s+([^;]+);`, 'gi'),
    expand: (m) => privList(m[1]).flatMap((priv) => roleList(m[3]).map((role) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: `${priv}:${role}`, priv, role }))) },
  { kind: 'revoke_all_tables',
    re: new RegExp(String.raw`\bREVOKE\s+([A-Za-z ,]+?)\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+(${ident})\s+FROM\s+([^;]+);`, 'gi'),
    expand: (m) => privList(m[1]).flatMap((priv) => roleList(m[3]).map((role) => ({ schema: bare(m[2]), table: null, name: `${priv}:${role}`, priv, role }))) },
  { kind: 'revoke_default',
    re: new RegExp(String.raw`\bALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+(${ident})\s+IN\s+SCHEMA\s+(${ident})\s+REVOKE\s+([A-Za-z ,]+?)\s+ON\s+TABLES\s+FROM\s+([^;]+);`, 'gi'),
    expand: (m) => privList(m[3]).flatMap((priv) => roleList(m[4]).map((role) => ({ schema: bare(m[2]), table: null, name: `${bare(m[1])}>${priv}:${role}`, owner: bare(m[1]), priv, role }))) },
  // ── RE-SHAPE side ─────────────────────────────────────────────────────────────────────
  { kind: 'rename_table',
    re: new RegExp(String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${qident})\s+RENAME\s+TO\s+(${ident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: bare(m[1]), name: bare(m[1]), to: bare(m[2]) }) },
  { kind: 'rename_policy',
    re: new RegExp(String.raw`\bALTER\s+POLICY\s+(${ident})\s+ON\s+(${qident})\s+RENAME\s+TO\s+(${ident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]), to: bare(m[3]) }) },
  { kind: 'rename_trigger',
    re: new RegExp(String.raw`\bALTER\s+TRIGGER\s+(${ident})\s+ON\s+(${qident})\s+RENAME\s+TO\s+(${ident})`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[2]), table: bare(m[2]), name: bare(m[1]), to: bare(m[3]) }) },
  { kind: 'rename_constraint', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bRENAME\s+CONSTRAINT\s+(${ident})\s+TO\s+(${ident})`, (a) => ({ name: bare(a[1]), to: bare(a[2]) })) },
  { kind: 'nullable', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bALTER\s+COLUMN\s+(${ident})\s+DROP\s+NOT\s+NULL`, (a) => ({ name: bare(a[1]) })) },
  { kind: 'not_null', re: ALTER_TABLE(),
    expand: (m) => onAlter(m, String.raw`\bALTER\s+COLUMN\s+(${ident})\s+SET\s+NOT\s+NULL`, (a) => ({ name: bare(a[1]) })) },
  { kind: 'comment_column',
    re: new RegExp(String.raw`\bCOMMENT\s+ON\s+COLUMN\s+((?:${ident}\.)?${ident})\.(${ident})\s+IS\b`, 'gi'),
    map: (m) => ({ schema: schemaOf(m[1]), table: bare(m[1]), name: bare(m[2]) }) },
];

/** Statements whose object name is computed at runtime — reported, never dropped. */
const DYNAMIC = /\bEXECUTE\s+(?:format\s*\(|'[^']*\|\||[A-Za-z_]\w*\s*\|\|)/gi;
const DATA = /\b(?:UPDATE\s+(?:ONLY\s+)?[\w."]+(?:\s+(?:AS\s+)?\w+)?\s+SET|INSERT\s+INTO|DELETE\s+FROM)\b/i;
/** A body with nothing left but transaction control has nothing to apply. */
const NOTHING_EXECUTABLE = (body) => body.replace(/\b(?:BEGIN|COMMIT|END)\s*;/gi, '').trim() === '';

export function parseFile(sql, file) {
  const body = stripComments(sql);
  const objects = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(body)) !== null) {
      const rows = rule.expand ? rule.expand(m) : [rule.map(m)];
      // `pos` is the statement's offset in the file. Order WITHIN one file is certain; order BETWEEN
      // two files is not (see migrationHistory.mjs), which is why position is kept per file.
      for (const r of rows) if (r.name) objects.push({ kind: rule.kind, ...r, file, pos: m.index });
    }
  }
  const dynamic = (body.match(DYNAMIC) || []).length;
  return { objects, dynamic, hasData: DATA.test(body), nothingExecutable: NOTHING_EXECUTABLE(body) };
}

export function parseCorpus(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const objects = [];
  const empty = [];
  const dataOnly = [];
  const commentOnly = [];
  const unreadable = [];
  for (const file of files) {
    const r = parseFile(readFileSync(join(dir, file), 'utf8'), file);
    objects.push(...r.objects);
    if (r.objects.length === 0) {
      empty.push(file);
      if (r.nothingExecutable) commentOnly.push(file);
      else if (r.hasData) dataOnly.push(file);
    }
    if (r.dynamic > 0) unreadable.push({ file, dynamic: r.dynamic });
  }
  return { files, objects, empty, dataOnly, commentOnly, unreadable };
}
