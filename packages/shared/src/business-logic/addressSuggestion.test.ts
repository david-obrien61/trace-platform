// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the town guard — above all on `101 Crupp`, the real LAWNS delivery whose correct
//   address Places cannot offer and whose first suggestion is another town 34 miles away.
// DEPENDENCIES: addressSuggestion (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { parseSuggestion, townMismatch } from './addressSuggestion';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

// ── §A · reading a suggestion ────────────────────────────────────────────────────────────────
{
  const s = parseSuggestion('153 Twin Creekview Ln, Georgetown, TX, USA');
  ok(s.line1 === '153 Twin Creekview Ln', 'A1 the street is everything before the first comma');
  ok(s.city === 'Georgetown', 'A2 the town is read');
  ok(s.state === 'TX', '🔴 A3 THE STATE IS TX, NOT "USA" — dropping the country is what stops every comparison being a mismatch');
}
ok(parseSuggestion('101 Crupp Ct, Austin, TX, USA').city === 'Austin', 'A4 …on the real Crupp suggestion too');
ok(parseSuggestion('436 Palatino Bnd, Liberty Hill, TX 78642, USA').zip === '78642', 'A5 a ZIP is read when the text carries one');
ok(parseSuggestion('').city === '' && parseSuggestion('').line1 === '', 'A6 an empty line parses to empty parts, never undefined');
ok(parseSuggestion('Weed Man Lawn Care, Long Ferry Road, Salisbury, NC, USA').city === 'Salisbury',
   'A7 a BUSINESS result carries its name first and the town is still the piece before the state');

// ── §B · 🔴 THE 101 CRUPP CASE — the measurement this guard exists for ───────────────────────
{
  const m = townMismatch({ city: 'Liberty Hill', zip: '78642' }, '101 Crupp Ct, Austin, TX, USA');
  ok(m.differs,
     '🔴 B1 PICKING AUSTIN WHEN SHE TYPED LIBERTY HILL IS QUESTIONED. Measured 2026-09-24: the real 101 Crupp Avenue, Liberty Hill is NOT IN THE LIST — the first suggestion is a real, confident address 34 miles away, and a picked suggestion is stored as located with no second check. One tap would send a truck to Austin');
  ok(/Liberty Hill/.test(m.message) && /Austin/.test(m.message),
     'B2 …and the question names BOTH towns, because she is the one who knows which is right');
}
{
  const m = townMismatch({ city: 'Georgetown' }, '153 Twin Creekview Ln, Georgetown, TX, USA');
  ok(!m.differs,
     '🔴 B3 THE ORDINARY CASE ASKS NOTHING — same town, so taking the completion is silent. A guard that fired here would be switched off within a day (#73) and would not be watching Crupp either');
}
{
  const m = townMismatch({ city: '  liberty   hill ' }, '101 Crupp Ave, Liberty Hill, TX, USA');
  ok(!m.differs,
     'B4 the comparison is normalised — case and spacing are not a different town');
}

// ── §C · silent when the person said nothing (David, 2026-09-24) ────────────────────────────
ok(!townMismatch({ city: '', zip: '' }, '101 Crupp Ct, Austin, TX, USA').differs,
   '🔴 C1 NO TOWN TYPED, NO QUESTION. Someone who has not said where they mean has not been contradicted; asking would turn "type a street, take the completion" into an interrogation');
ok(!townMismatch({ city: null, zip: null }, '101 Crupp Ct, Austin, TX, USA').differs, 'C2 …null counts as nothing typed');
ok(!townMismatch({ city: 'Liberty Hill' }, '101 Crupp Ave').differs,
   '🔴 C3 A SUGGESTION THAT NAMES NO TOWN CANNOT CONTRADICT ONE. Silence is not disagreement — questioning it would fire on every short suggestion');

// ── §D · the ZIP half ────────────────────────────────────────────────────────────────────────
ok(townMismatch({ city: '', zip: '78642' }, '436 Palatino Bnd, Austin, TX 78701, USA').differs,
   'D1 a different ZIP is questioned even when no town was typed');
ok(!townMismatch({ city: '', zip: '78642' }, '436 Palatino Bnd, Liberty Hill, TX 78642, USA').differs,
   'D2 …and the same ZIP is not');
ok(!townMismatch({ city: '', zip: '78642' }, '436 Palatino Bnd, Liberty Hill, TX, USA').differs,
   'D3 a suggestion with no ZIP cannot contradict a typed one');

// ── §E · negative control — the verdict must depend on the TOWNS ────────────────────────────
{
  const same = townMismatch({ city: 'Austin' }, '101 Crupp Ct, Austin, TX, USA');
  const diff = townMismatch({ city: 'Liberty Hill' }, '101 Crupp Ct, Austin, TX, USA');
  ok(!same.differs && diff.differs,
     '🔴 E1 NEGATIVE CONTROL: the SAME suggestion, differing only in what was typed, gets opposite verdicts. An implementation that always asked — or never did — would pass half this file by accident');
}

console.log(`\naddressSuggestion — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
