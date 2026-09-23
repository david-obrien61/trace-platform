// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the two nav defects David hit on 03bb38d are fixed, and stay fixed —
//   ① filter the customer list, open a customer, press Back, and the FILTERED list returns;
//   ② the back control on an order opened from a customer names THAT CUSTOMER, not "Orders".
// DEPENDENCIES: listViewState · backTarget (both pure) · the two page sources, read as text
//   (a hardcoded label inside a .tsx is unreachable to this harness — tech-debt #134).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseViewState, viewStateToSearch, viewStateIsDefault, listHref, DEFAULT_VIEW_STATE } from './listViewState';
import { backTarget, journeyTo, backLabel } from './backTarget';

const ORDER = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/OrderDetail.tsx'), 'utf8');
const CUST = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/CustomerDetail.tsx'), 'utf8');
const LIST = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/Customers.tsx'), 'utf8');

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

// ── §A · 🔴 DAVID'S CASE ①: the filtered list survives Back ──────────────────────────────────
{
  const filtered = { ...DEFAULT_VIEW_STATE, q: 'dubec' };
  const href = listHref('/customers', filtered);
  ok(href === '/customers?q=dubec', `A1 🔴 THE LIST'S VIEW IS IN THE URL — filtering to "dubec" gives ${href}, so Back, a refresh and a pasted link all restore the same screen`);
  ok(parseViewState('q=dubec').q === 'dubec', 'A2 …and it reads back out again');
  const round = parseViewState(viewStateToSearch(filtered));
  ok(JSON.stringify(round) === JSON.stringify(filtered), 'A3 🔴 a view survives a full round trip through the URL unchanged — otherwise Back restores something subtly different and nobody can say what');
}
{
  const full = { q: 'dubec', sort: 'first_name', dir: 'desc' as const, status: 'qr-scan', extra: 'all' };
  const round = parseViewState(viewStateToSearch(full));
  ok(round.sort === 'first_name' && round.dir === 'desc' && round.status === 'qr-scan',
     'A4 the sort column, its direction and a quick-filter all survive too — not just the search box');
}

// ── §B · the URL stays clean when nothing is filtered ────────────────────────────────────────
ok(viewStateIsDefault(DEFAULT_VIEW_STATE), 'B1 the opening view is the default');
ok(viewStateToSearch(DEFAULT_VIEW_STATE) === '', '🔴 B2 A DEFAULT VIEW WRITES NO PARAMETERS — /customers stays /customers, so every link anybody copies is not full of ?q=&sort=&dir=asc noise');
ok(listHref('/customers', DEFAULT_VIEW_STATE) === '/customers', 'B3 …and the href is the bare path');
ok(viewStateToSearch({ ...DEFAULT_VIEW_STATE, q: '   ' }) === '', 'B4 a search box holding only spaces is not a filter');
ok(viewStateToSearch({ ...DEFAULT_VIEW_STATE, q: '  dubec  ' }) === 'q=dubec', 'B5 …and a real search is trimmed at the ends, so "dubec" and " dubec " are one link');

// ── §C · a hand-edited or stale URL must never produce a broken screen ───────────────────────
ok(parseViewState('').q === '' && parseViewState('').dir === 'asc', 'C1 an empty query string is the default view');
ok(parseViewState('dir=sideways').dir === 'asc', '🔴 C2 AN UNREADABLE DIRECTION FALLS BACK TO asc — a person editing a link by hand must not be able to produce an error page (D-9)');
ok(parseViewState('q=%20%20').q.trim() === '', 'C3 an encoded blank search is blank');
ok(parseViewState('sort=first_name&nonsense=1').sort === 'first_name', 'C4 unknown parameters are ignored, not fatal');

// ── §D · 🔴 DAVID'S CASE ②: the back control names where he came FROM ────────────────────────
{
  const j = journeyTo("Regina & David O'Brien", '/customers/abc?q=dubec');
  const t = backTarget(j, { label: 'Orders', href: '/orders' });
  ok(t.label === "Regina & David O'Brien", `D1 🔴 COMING FROM A CUSTOMER, BACK NAMES THE CUSTOMER — "${t.label}", not "Orders"`);
  ok(backLabel(t) === "Back to Regina & David O'Brien", 'D2 …and the control reads "Back to Regina & David O\'Brien"');
  ok(t.href === '/customers/abc?q=dubec', '🔴 D3 …AND IT CARRIES THE LIST\'S QUERY, so going back lands on the filtered list he was working through, not the whole roster');
}
ok(backTarget(undefined, { label: 'Orders', href: '/orders' }).label === 'Orders',
   '🔴 D4 A PAGE OPENED FROM A LINK, A BOOKMARK OR A HARD REFRESH HAS NO JOURNEY — it falls back to the list the record belongs to, which is exactly today\'s behaviour. The fallback is the floor, not a failure');
ok(backTarget({ from: { label: 'X' } }, { label: 'Orders', href: '/orders' }).label === 'Orders',
   '🔴 D5 HALF A JOURNEY IS TREATED AS NONE — a label with no destination is a button that lies about where it goes, and the missing half would be filled by the default so the two disagree');
ok(backTarget({ from: { href: '/customers/abc' } }, { label: 'Orders', href: '/orders' }).label === 'Orders', 'D6 …and a destination with no label is the unnamed control this removes');
ok(backTarget({ from: { label: 'Elsewhere', href: 'https://example.com' } }, { label: 'Orders', href: '/orders' }).href === '/orders',
   '🔴 D7 AN ABSOLUTE URL IS REFUSED — history state is untrusted, and a back control is not an exit from the app');
ok(backTarget({ from: { label: 'x', href: '//evil.test' } }, { label: 'Orders', href: '/orders' }).href === '/orders', 'D8 …including a protocol-relative one');
ok(journeyTo('', '/x') === undefined && journeyTo('Name', '') === undefined, 'D9 an origin with half a journey sends nothing rather than something broken');

// ── §E · the pages actually use it — a hardcoded label is what this build removes ────────────
ok(!/navigate\('\/orders'\)/.test(ORDER), "🔴 E1 THE ORDER PAGE NO LONGER HARDCODES navigate('/orders') — that line, with the word \"Orders\" typed beside it, IS the defect");
ok(/backTarget\(/.test(ORDER), 'E2 …it derives the target from the journey instead');
ok(/backTarget\(/.test(CUST), 'E3 the customer page does too');
ok(/journeyTo\(/.test(CUST), '🔴 E4 AND THE CUSTOMER PAGE SETS THE JOURNEY when it opens one of that customer\'s orders — without an origin that states where it came from, the destination has nothing to read');
ok(/journeyTo\(/.test(LIST), 'E5 the customer LIST sets it too, so opening a customer from a filtered list carries that filter home');

console.log(`\nnavState — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
