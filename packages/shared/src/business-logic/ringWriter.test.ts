// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: rings are MONEY — prove a bad set is refused whole, a removed ring is retired not
//   deleted, and every change is logged with BOTH sides.
// DEPENDENCIES: ringWriter (planRingSave is pure; saveRings runs against a double that REFUSES
//   what the real table refuses — §6 r19).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { planRingSave, saveRings } from './ringWriter';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };
const B = 'b0000000-0000-4000-8000-00000000000b';
const existing = [
  { id: 'r1', outer_radius_miles: 7.1, charge: 50, active: true },
  { id: 'r2', outer_radius_miles: 14.3, charge: 100, active: true },
];

// ── §A · a bad set is refused WHOLE ─────────────────────────────────────────────────────────
{
  const r = planRingSave([{ outer_radius_miles: 0, charge: 50 }], []);
  ok(r.kind === 'refused', 'A1 a zero-mile ring is refused');
}
{
  const r = planRingSave([{ outer_radius_miles: 7, charge: -5 }], []);
  ok(r.kind === 'refused' && /negative/i.test(r.reason), 'A2 a negative charge is refused');
}
{
  const r = planRingSave([{ outer_radius_miles: 7, charge: 0 }], []);
  ok(r.kind === 'ok', '🔴 A3 ZERO IS ACCEPTED — a free local ring is a real thing an owner may want, and refusing it would make "free delivery nearby" impossible to express');
}
{
  const r = planRingSave([{ outer_radius_miles: 7.14, charge: 50 }, { outer_radius_miles: 7.11, charge: 80 }], []);
  ok(r.kind === 'refused' && /same distance/i.test(r.reason),
     '🔴 A4 TWO RINGS ENDING AT THE SAME DISTANCE ARE REFUSED IN WORDS, BEFORE ANYTHING IS WRITTEN. They round to the same 7.1; the database would refuse it too, but a unique-violation reaching a person as a Postgres string is not an answer');
}
{
  const r = planRingSave([{ outer_radius_miles: 7.1, charge: 50 }, { outer_radius_miles: 0, charge: 100 }], existing);
  ok(r.kind === 'refused',
     '🔴 A5 ONE BAD RING REFUSES THE WHOLE SET. Half-saved rings are worse than none: the gap would quietly price at the next ring up, and nobody would see a ring was missing rather than deliberately wide');
}

// ── §B · a removed ring is RETIRED, never deleted ([[R-133]]) ───────────────────────────────
{
  const r = planRingSave([{ id: 'r1', outer_radius_miles: 7.1, charge: 50 }], existing);
  ok(r.kind === 'ok' && r.retire.length === 1 && r.retire[0] === 'r2',
     '🔴 B1 THE RING LEFT OUT IS RETIRED, NOT DELETED — deleting would erase the fact that LAWNS once charged $100 out to 14.3 miles, which is exactly what someone wants when an old invoice is questioned');
  ok(r.kind === 'ok' && r.keep.length === 1, 'B2 …and the kept ring is kept');
}

// ── §C · the write, against a double that refuses what the real table refuses ───────────────
function fakeDb() {
  const audit: any[] = []; const rings: any[] = [...existing.map(e => ({ ...e }))];
  const api = (table: string) => ({
    insert: (rows: any) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      if (table === 'audit_log') { audit.push(...arr); return { select: () => ({ data: arr, error: null }), data: arr, error: null }; }
      for (const r of arr) {
        // 🔴 THE DOUBLE ENFORCES THE PARTIAL UNIQUE INDEX. A fake that accepts what Postgres
        // rejects is a rubber stamp (§6 r19 / tech-debt #138).
        if (rings.some(x => x.active !== false && Math.abs(x.outer_radius_miles - r.outer_radius_miles) < 0.001)) {
          return { select: () => ({ data: null, error: { message: 'duplicate key value violates unique constraint' } }) };
        }
        rings.push({ ...r, id: 'new' + rings.length });
      }
      return { select: () => ({ data: arr.map((_, i) => ({ id: 'new' + i })), error: null }) };
    },
    update: (patch: any) => ({
      eq: (_c: string, v: string) => ({
        eq: () => ({ select: () => { const row = rings.find(x => x.id === v); if (row) Object.assign(row, patch); return { data: row ? [{ id: v }] : [], error: null }; } }),
        select: () => { const row = rings.find(x => x.id === v); if (row) Object.assign(row, patch); return { data: row ? [{ id: v }] : [], error: null }; },
      }),
      in: (_c: string, ids: string[]) => ({
        eq: () => ({ select: () => { for (const id of ids) { const r = rings.find(x => x.id === id); if (r) Object.assign(r, patch); } return { data: ids.map(id => ({ id })), error: null }; } }),
      }),
    }),
  });
  return { from: api, _audit: audit, _rings: rings } as any;
}

async function main() {
{
  const db = fakeDb();
  const out: any = await saveRings(db, { businessId: B, actorUserId: 'u1', edits: [{ id: 'r1', outer_radius_miles: 9, charge: 60 }], existing });
  ok(out.saved === 1 && out.retired === 1, `C1 one ring updated, one retired (got saved=${out.saved} retired=${out.retired})`);
  ok(db._rings.find((r: any) => r.id === 'r2')?.active === false, 'C2 …and r2 is retired in the table, not gone');
  const upd = db._audit.find((a: any) => a.action === 'delivery_ring.update');
  ok(!!upd && upd.detail.from.miles === 7.1 && upd.detail.to.miles === 9,
     '🔴 C3 THE LOG CARRIES BOTH SIDES — "ring 3 changed" is not a fact anyone can act on; "7.1 → 9 miles, $50 → $60" is');
  ok(db._audit.some((a: any) => a.action === 'delivery_ring.retire'), 'C4 the retirement is logged too');
  ok(out.logged === true, 'C5 and the save reports that the log landed');
}
{
  // 🔴 A LOG FAILURE MUST NOT UNDO THE SAVE — but must not be silent either.
  const db = fakeDb();
  const orig = db.from;
  db.from = (t: string) => t === 'audit_log' ? { insert: () => { throw new Error('no audit_log:write'); } } : orig(t);
  const out: any = await saveRings(db, { businessId: B, actorUserId: 'u1', edits: [{ id: 'r1', outer_radius_miles: 9, charge: 60 }], existing });
  ok(out.saved === 1 && out.error === null,
     '🔴 C6 A CHANGE LOG THAT CANNOT BE WRITTEN DOES NOT UNDO THE CHANGE IT DESCRIBES — the contactWriter lesson');
  ok(out.logged === false,
     '🔴 C7 …BUT IT IS NOT SILENT EITHER. A save reported complete while its history vanished is the quiet half of the same defect, so the screen is told');
}
}

// ── §D · 🔴 A REFUSED WRITE MUST NOT REPORT "SAVED" (A8 / R-12) ─────────────────────────────
// verify:zero-row-writes caught this in code that CITED R-12 in a comment while not honouring it:
// the write selected the id, counted the rows, and never compared the count to what it asked for.
async function refusals() {
  {
    // RLS refuses the retire: empty result, NO error — exactly what PostgREST returns.
    const db: any = fakeDb();
    const orig = db.from;
    db.from = (tb: string) => tb !== 'business_delivery_rings' ? orig(tb) : {
      ...orig(tb),
      update: () => ({ in: () => ({ eq: () => ({ select: () => ({ data: [], error: null }) }) }),
                       eq: () => ({ eq: () => ({ select: () => ({ data: [{ id: 'r1' }], error: null }) }),
                                    select: () => ({ data: [{ id: 'r1' }], error: null }) }) }),
    };
    const out: any = await saveRings(db, { businessId: B, edits: [{ id: 'r1', outer_radius_miles: 9, charge: 60 }], existing });
    ok(out.error !== null && /still charging/.test(out.error),
       '🔴 D1 A REFUSED RETIRE IS REPORTED, NOT SWALLOWED. An empty result with no error is what RLS returns; the old code called that success, so rings the owner DELETED would still be pricing deliveries while the screen said "Saved". Nobody goes back to check that a removal removed anything');
    ok(out.retired === 0, 'D2 …and it does not claim to have retired anything');
  }
  {
    // The update itself matches nothing — the ring was removed by someone else mid-edit.
    const db: any = fakeDb();
    const orig = db.from;
    db.from = (tb: string) => tb !== 'business_delivery_rings' ? orig(tb) : {
      ...orig(tb),
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ data: [], error: null }) }),
                                    select: () => ({ data: [], error: null }) }),
                       in: () => ({ eq: () => ({ select: () => ({ data: [], error: null }) }) }) }),
    };
    const out: any = await saveRings(db, { businessId: B, edits: [{ id: 'r1', outer_radius_miles: 9, charge: 60 }], existing: [existing[0]] });
    ok(out.error !== null && /could not be changed/.test(out.error),
       '🔴 D3 AN UPDATE THAT MATCHED NO ROW IS A FAILURE, IN WORDS — not a silent zero. It happens when the ring was removed by someone else mid-edit, or permission is missing, and both are things a person can act on once told');
    ok(out.saved === 0, 'D4 …and nothing is claimed as saved');
  }
}

// 🔴 NO TOP-LEVEL AWAIT. The repo's runner bundles every test with `--format=cjs`
// (run-tests.mjs:70), where a top-level await is a syntax error — so this file PASSED under my
// own esbuild ESM invocation and FAILED in `npm test`, reported only as "169/170 files pass".
// ⚠️ That is tech-debt #186's shape: the short run and the full one look alike. Run tests the way
// the runner runs them, or a green proves something about a build nobody ships.
void (async () => {
  await main();
  await refusals();
  console.log(`\nringWriter — ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
})();
