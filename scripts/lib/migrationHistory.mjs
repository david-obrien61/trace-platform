/**
 * ── MIGRATION HISTORY RESOLVER — what state the corpus says each object should end in ─────
 *
 * PURPOSE:      A migration's objects cannot be judged one file at a time. A policy created in May and
 *               dropped in July SHOULD be absent; a table renamed in June carries its policies to the
 *               new name. This resolver walks every create / remove / rename / re-shape statement in
 *               order and gives each object an EXPECTATION the live database can be checked against.
 * DEPENDENCIES: none — pure. Input is parseCorpus()'s `objects`.
 * OUTPUTS:      resolveHistory(objects) → { assessments[], identities: Map, tableFinal(schema,table) }
 *               each assessment: { obj, id, family, state, role: final|overridden|same_day, finalStates, by[] }
 *
 * 🔴 ORDER BETWEEN TWO FILES WRITTEN ON THE SAME DAY IS NOT KNOWABLE FROM THEIR NAMES, and treating it as
 *    knowable produced a false result on 2026-09-11: `bpc_member_insert` is CREATED in
 *    `20260727_rbac_resource_action_flip.sql` and DROPPED in `20260727_rbac_flip_corrections.sql`, and
 *    the correction sorts FIRST ('f' < 'r') though it was applied second. So files sharing a date prefix
 *    are UNORDERED relative to each other: if they disagree about an object's final state, BOTH outcomes
 *    are recorded as consistent, and the live database — not the filename — says which one ran last.
 *    Order WITHIN one file is certain (statement position), and that is how `DROP POLICY IF EXISTS x;
 *    CREATE POLICY x` in a single file correctly resolves to present.
 * ⚠️ ASSUMED, stated: a RENAME applies to objects created on an earlier date, or earlier in the same file.
 *    No rename in the corpus shares a date with the create it renames (checked 2026-09-11).
 */

export const dateKey = (file) => (/^(\d{8})/.exec(file) || [])[1] || file;

/** Which identity family a parsed kind belongs to, and the state that statement asserts. */
const EFFECT = {
  table: ['table', 'present'], drop_table: ['table', 'absent'],
  drop_view: ['view', 'absent'],
  column: ['column', 'present'], drop_column: ['column', 'absent'],
  policy: ['policy', 'present'], drop_policy: ['policy', 'absent'],
  trigger: ['trigger', 'present'], drop_trigger: ['trigger', 'absent'],
  index: ['index', 'present'], drop_index: ['index', 'absent'],
  function: ['function', 'present'], drop_function: ['function', 'absent'],
  constraint: ['constraint', 'present'], drop_constraint: ['constraint', 'absent'],
  nullable: ['nullability', 'nullable'], not_null: ['nullability', 'notnull'],
  comment_column: ['comment', 'present'],
  grant_table: ['tablepriv', 'granted'], revoke_table: ['tablepriv', 'revoked'],
  revoke_all_tables: ['alltablespriv', 'revoked'],
  revoke_default: ['defaultpriv', 'revoked'],
};
/** Families whose object lives ON a table, so a table rename moves them and a table drop removes them. */
export const ON_TABLE = new Set(['column', 'policy', 'trigger', 'constraint', 'nullability', 'comment', 'tablepriv', 'index']);
const RENAME_FAMILY = { rename_policy: 'policy', rename_trigger: 'trigger', rename_constraint: 'constraint' };

/** a strictly precedes b in time — false when the two are in different files on the same date. */
const before = (a, b) => (a.file === b.file ? a.pos < b.pos : dateKey(a.file) < dateKey(b.file));
/** a precedes-or-shares-a-date-with b, for rename application (see the ASSUMED note above). */
const notAfter = (a, b) => (a.file === b.file ? a.pos < b.pos : dateKey(a.file) <= dateKey(b.file));

export function resolveHistory(objects) {
  const renames = objects.filter((o) => o.kind.startsWith('rename_'));
  const tableRenames = renames.filter((r) => r.kind === 'rename_table');

  /** Follow a table name forward through every rename that happens after `at`. */
  const finalTable = (schema, table, at) => {
    let t = table;
    for (let hop = 0; hop < 10; hop++) {
      const r = tableRenames.find((x) => x.schema === schema && x.table === t && notAfter(at, x));
      if (!r) break;
      t = r.to; at = r;
    }
    return t;
  };
  /** Follow a policy / trigger / constraint name forward through its own renames. */
  const finalName = (family, schema, table, name, at) => {
    let n = name;
    for (let hop = 0; hop < 10; hop++) {
      const r = renames.find((x) => RENAME_FAMILY[x.kind] === family && x.schema === schema
        && finalTable(x.schema, x.table, x) === table && x.name === n && notAfter(at, x));
      if (!r) break;
      n = r.to; at = r;
    }
    return n;
  };

  const identityOf = (o) => {
    const [family] = EFFECT[o.kind];
    const table = o.table ? finalTable(o.schema, o.table, o) : null;
    const name = RENAME_FAMILY[`rename_${family}`] ? finalName(family, o.schema, table, o.name, o) : o.name;
    if (family === 'table') { const t = finalTable(o.schema, o.name, o); return { family, table: t, key: `table|${o.schema}.${t}` }; }
    if (family === 'view' || family === 'function') return { family, table: null, key: `${family}|${o.schema}.${o.name}` };
    if (family === 'index') return { family, table, key: `index|${o.schema}.${o.name}` };
    if (family === 'alltablespriv') return { family, table: null, key: `alltablespriv|${o.schema}.${o.name}` };
    if (family === 'defaultpriv') return { family, table: null, key: `defaultpriv|${o.schema}.${o.name}` };
    return { family, table, key: `${family}|${o.schema}.${table}.${name}` };
  };

  // ── 1. every effect statement becomes an event on its identity ──────────────────────────
  const events = new Map();   // key -> [{obj, state}]
  const meta = new Map();     // key -> {family, schema, table, name, priv, role, owner}
  const push = (key, ev) => { if (!events.has(key)) events.set(key, []); events.get(key).push(ev); };
  const assessable = [];
  for (const o of objects) {
    if (!EFFECT[o.kind]) continue;
    const id = identityOf(o);
    const [, state] = EFFECT[o.kind];
    push(id.key, { obj: o, state });
    assessable.push({ obj: o, id, state });
    if (!meta.has(id.key) || state !== 'absent') {
      const nameOnly = id.key.split('.').pop();
      meta.set(id.key, { family: id.family, schema: o.schema, table: id.table, name: id.family === 'index' ? o.name : nameOnly,
        priv: o.priv, role: o.role, owner: o.owner, indexTable: id.family === 'index' ? (meta.get(id.key)?.indexTable || id.table) : undefined });
    }
  }

  // ── 2. a DROP TABLE removes everything on that table, at that moment ───────────────────
  for (const o of objects.filter((x) => x.kind === 'drop_table')) {
    const dropped = finalTable(o.schema, o.table, o);
    for (const [key, m] of meta) {
      const onTable = m.family === 'index' ? m.indexTable : m.table;
      if (ON_TABLE.has(m.family) && m.schema === o.schema && onTable === dropped) {
        const cascadeState = m.family === 'nullability' || m.family === 'tablepriv' ? null : 'absent';
        if (cascadeState) push(key, { obj: o, state: cascadeState, cascade: true });
      }
    }
  }

  // ── 3. each identity's FINAL state — the latest date's word, unordered across same-day files ──
  const finals = new Map();   // key -> { states:Set, byFiles:Set }
  for (const [key, evs] of events) {
    const latest = evs.reduce((d, e) => (dateKey(e.obj.file) > d ? dateKey(e.obj.file) : d), '');
    const group = evs.filter((e) => dateKey(e.obj.file) === latest);
    const lastPerFile = new Map();
    for (const e of group) { const cur = lastPerFile.get(e.obj.file); if (!cur || e.obj.pos >= cur.obj.pos) lastPerFile.set(e.obj.file, e); }
    const states = new Set([...lastPerFile.values()].map((e) => e.state));
    finals.set(key, { states, byFiles: new Set([...lastPerFile.values()].map((e) => e.obj.file)), latestEvents: [...lastPerFile.values()] });
  }

  // ── 4. each statement's ROLE against its identity's final state ──────────────────────────
  // 🔴 ONLY A FILE'S LAST WORD ON AN OBJECT IS ITS EFFECT. `DROP POLICY IF EXISTS x; CREATE POLICY x`
  // in one file is a preamble followed by the effect; judging the preamble as an effect produced a false
  // MIXED on 2026-09-11 — `20260528`'s preamble DROP of `authenticated_select_nurseries` happened to share
  // the state a July migration asserts, so it was scored as the file's own claim and read MISSING.
  const lastWord = new Map();   // `${id}|${file}` -> the latest statement in that file on that identity
  for (const x of assessable) {
    const k = `${x.id.key}|${x.obj.file}`;
    const cur = lastWord.get(k);
    if (!cur || x.obj.pos >= cur.obj.pos) lastWord.set(k, x);
  }
  const effects = assessable.filter((x) => lastWord.get(`${x.id.key}|${x.obj.file}`) === x);
  const assessments = effects.map(({ obj, id, state }) => {
    const f = finals.get(id.key);
    let role;
    // Two same-day files disagree: this statement is consistent if its state is one of the candidates.
    if (f.states.size > 1) role = f.states.has(state) ? 'same_day' : 'overridden';
    else role = f.states.has(state) ? 'final' : 'overridden';
    const by = role === 'overridden' ? [...f.byFiles].filter((x) => x !== obj.file) : [];
    return { obj, id: id.key, family: id.family, state, role, finalStates: [...f.states], by };
  });

  /** Does the corpus itself say this column should be gone? (nullability / comment sit on a column) */
  const columnFinal = (schema, table, column) => finals.get(`column|${schema}.${table}.${column}`)?.states;
  /** Does the corpus itself say this table should be gone? */
  const tableFinal = (schema, table) => finals.get(`table|${schema}.${table}`)?.states;
  return { assessments, identities: meta, finals, tableFinal, columnFinal };
}

/**
 * Turn one assessment + what the database was OBSERVED to hold into a verdict. Pure, so the
 * self-test can drive it with crafted observations — including the ones that must come back MISSING.
 *   observed: the identity's live state ('present'|'absent'|'nullable'|'notnull'|'granted'|'revoked'), or null
 *   tableExists: for an on-table family, whether its table is there (null when not checked)
 *   tableDroppedByCorpus: whether the corpus's own final word on that table is 'absent'
 */
export function verdictFor(a, observed, tableExists, tableDroppedByCorpus) {
  if (observed === null || observed === undefined) return 'COULD_NOT_CHECK';
  if (a.role === 'same_day') return a.finalStates.includes(observed) ? 'CONSISTENT' : 'MISSING';
  if (a.role === 'overridden') {
    if (a.finalStates.includes(observed)) return 'SUPERSEDED';
    if (observed === a.state) return 'LATER_CHANGE_NOT_APPLIED';
    return 'MISSING';
  }
  if (observed === a.state) return 'APPLIED';
  if (ON_TABLE.has(a.family) && tableExists === false && !tableDroppedByCorpus) return 'TABLE_GONE_OUTSIDE_MIGRATIONS';
  return 'MISSING';
}
