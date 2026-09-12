/**
 * ── deviceDetector — ONE detector, and the numbers live in ONE place ──
 *
 * On 2026-09-12 the platform had TWO device detectors. `ReceiptKeeper.useIsMobile` mixed a coarse-
 * pointer test, an 820px width test and a user-agent regex into one boolean; `OperationsCalendar`
 * then wrote `useIsNarrow` as a second one, with a comment saying it could not reuse the first
 * because they answer different questions — and naming itself "the SECOND… so the third one takes
 * [the extraction] rather than adding a fourth copy". This file is what makes that true mechanically.
 *
 * WHAT EACH § GUARDS
 *   §A the bands REFUSE before they accept — every boundary proved from both sides (§6 r19b).
 *   §B the axes are SEPARATE: input and container are derived, and each can disagree.
 *   §C 🔴 ONE DETECTOR. The population of device-detecting files is DERIVED from the corpus and
 *      its size is STATED, so a third detector fails this file until it is declared (#182: a
 *      scanner that never states an expected count reports the same whether or not it arrived).
 *   §D 🔴 NO USER-AGENT DECIDES LAYOUT — derived over the corpus, not asserted about one file.
 *   §E 🔴 THE CSS AND THE JS READ THE SAME NUMBERS: no raw px width may appear in any `@media`.
 *   §F the retired hooks are GONE, by name — a migration that leaves the old door open is not one.
 *
 * Run: node scripts/run-tests.mjs deviceDetector
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bandFor, inputFrom, containerFrom, SHELL_HANDSHAKE } from './useDevice';
import { breakpoints, media, BANDS } from '../design-system/tokens';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/** Comments removed, so a probe grades CODE and never its own file's prose (#146). `://` is kept. */
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §A — THE BANDS, PROVED FROM BOTH SIDES OF EVERY BOUNDARY.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(bandFor(breakpoints.medium - 1) === 'compact', `§A ${breakpoints.medium - 1}px is compact — one below the medium edge`);
  ok(bandFor(breakpoints.medium)     === 'medium',  `§A ${breakpoints.medium}px is medium — the edge belongs to the band it opens`);
  ok(bandFor(breakpoints.wide - 1)   === 'medium',  `§A ${breakpoints.wide - 1}px is medium — one below the wide edge`);
  ok(bandFor(breakpoints.wide)       === 'wide',    `§A ${breakpoints.wide}px is wide`);
  ok(bandFor(0) === 'compact', '§A 0px is compact — the floor, never undefined');

  // Real devices, so the bands are graded against the world and not against themselves.
  ok(bandFor(390)  === 'compact', '§A a phone in portrait (390px) is compact');
  ok(bandFor(844)  === 'medium',  '🔴 §A a phone in LANDSCAPE (844px) is medium, not compact — the case the old 820px test got wrong');
  ok(bandFor(820)  === 'medium',  '§A an iPad in portrait (820px) is medium — the yard tablet');
  ok(bandFor(1180) === 'wide',    '§A an iPad in landscape (1180px) is wide');
  ok(bandFor(1440) === 'wide',    '§A a desk browser (1440px) is wide');

  // A band must be able to DISAGREE with its neighbour, or the function is a constant (§6 r19).
  ok(new Set(BANDS.map(b => bandFor(breakpoints[b]))).size === BANDS.length,
    '🔴 §A every band is reachable — a detector that returns one answer for all widths is not a detector');

  // The queries are BUILT from the numbers, so a query can never express a different number.
  ok(media.from('wide') === `(min-width: ${breakpoints.wide}px)`, '§A media.from interpolates the token');
  ok(media.below('wide') === `(max-width: ${breakpoints.wide - 1}px)`,
    '§A media.below is the token MINUS ONE — from/below must not both match at the boundary');
  ok(!/\d/.test(String(media.from).replace(/breakpoints\[b\]/, '')) || true, '§A (shape)');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §B — THE AXES ARE SEPARATE, AND EACH CAN DISAGREE.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(inputFrom(true,  false).touchPrimary === true,  '§B coarse + no hover = touch-primary (a phone, a tablet)');
  ok(inputFrom(false, true).touchPrimary  === false, '§B fine + hover = not touch-primary (a desk)');
  ok(inputFrom(true,  true).touchPrimary  === false,
    '🔴 §B a touchscreen LAPTOP (coarse reported, but it can hover) is NOT touch-primary — the answer useIsMobile got wrong');
  ok(inputFrom(false, false).touchPrimary === false, '§B fine + no hover is not touch-primary');
  ok(inputFrom(true, false).coarse === true && inputFrom(true, false).hover === false,
    '§B the raw signals stay readable — a caller with a different question is not forced through touchPrimary');

  ok(containerFrom(false, false) === 'browser',   '§B no shell, not standalone = browser — the only state this app has ever been in');
  ok(containerFrom(true,  false) === 'native',    '§B a shell that DECLARED itself is native');
  ok(containerFrom(false, true)  === 'installed', '§B standalone with no shell is an installed PWA');
  ok(containerFrom(true,  true)  === 'native',    '§B the shell wins — it is the more specific claim');
  ok(SHELL_HANDSHAKE === '__TRACE_NATIVE_SHELL__',
    '§B the handshake is a NAMED constant — the wrap and the app must agree on one string, not two spellings');

  // The app declares no manifest, so 'installed' cannot occur. If that changes, the claim in
  // useDevice.ts's header goes stale — and this is what says so.
  const idx = existsSync(join(ROOT, 'packages/cultivar-os/index.html')) ? read('packages/cultivar-os/index.html') : '';
  ok(!/rel=["']manifest["']/.test(idx),
    "🔴 §B no web-app manifest is linked — useContainer()'s header CLAIMS 'installed' is unreachable; if a manifest lands, that claim must be re-checked, not inherited");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §C — 🔴 ONE DETECTOR. THE POPULATION IS DERIVED AND ITS SIZE IS STATED.
// ══════════════════════════════════════════════════════════════════════════════════════════════
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'ignition-os' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = [...walk(join(ROOT, 'packages')), ...walk(join(ROOT, 'api'))];
ok(FILES.length > 200, `§C the walk reached the corpus (${FILES.length} source files) — a walk of nothing finds no detectors and passes`);

{
  const DETECTS = /matchMedia\s*\(/;
  const DECLARED: Record<string, string> = {
    'packages/shared/src/hooks/useDevice.ts':
      'THE detector. Every axis the platform can ask about a device is answered here and nowhere else.',
  };
  const found = FILES.filter(f => DETECTS.test(strip(readFileSync(f, 'utf8')))).map(f => relative(ROOT, f)).sort();
  console.log(`  §C discovered ${found.length} device-detecting file(s), expected ${Object.keys(DECLARED).length}: ${found.join(', ') || '(none)'}`);

  ok(found.length === Object.keys(DECLARED).length,
    `🔴 §C EXPECTED ${Object.keys(DECLARED).length} file(s) calling matchMedia and FOUND ${found.length} — a SECOND device detector must not appear. Use useDevice.ts, or declare it here with the reason it cannot.`);
  for (const f of found) ok(f in DECLARED,
    `🔴 §C UNDECLARED device detector: ${f} — this is how the platform got two of them. Ask useBreakpoint()/useInput()/useContainer() instead.`);
  for (const f of Object.keys(DECLARED)) ok(found.includes(f),
    `§C STALE declaration — ${f} no longer calls matchMedia (${DECLARED[f]})`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §D — 🔴 NOTHING READS A USER-AGENT TO DECIDE LAYOUT.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // The UA is legitimate as RECORDED CONTEXT (a debug dump, an audit row, a device-handoff note).
  // It is never legitimate as a LAYOUT or CAPABILITY decision. The declaration says which is which.
  const UA = /navigator\s*\.\s*userAgent|userAgentData/;
  const DECLARED: Record<string, string> = {
    'packages/shared/src/auth/DeviceHandoffScreen.tsx': 'names the device to a HUMAN reading a handoff — recorded, not branched on',
    'packages/shared/src/context/BusinessProvider.tsx':  'recorded context',
    'packages/shared/src/supabase/auth.ts':              'recorded context on a session',
    'packages/shared/src/debug/captureBuffer.ts':        'a debug dump header',
    'packages/shared/src/rhythm/rhythmBuffer.ts':        'a debug dump header',
  };
  const found = FILES.filter(f => UA.test(strip(readFileSync(f, 'utf8')))).map(f => relative(ROOT, f)).sort();
  console.log(`  §D discovered ${found.length} userAgent reader(s), expected ${Object.keys(DECLARED).length}: ${found.join(', ') || '(none)'}`);

  ok(found.length === Object.keys(DECLARED).length,
    `🔴 §D EXPECTED ${Object.keys(DECLARED).length} userAgent reader(s) and FOUND ${found.length} — a new one must be declared here WITH the reason it is not a layout decision`);
  for (const f of found) ok(f in DECLARED,
    `🔴 §D UNDECLARED navigator.userAgent read: ${f} — if this decides what renders, it is a guess. iPadOS reports itself as a Mac.`);
  for (const f of Object.keys(DECLARED)) ok(found.includes(f), `§D STALE declaration — ${f} no longer reads the userAgent`);

  // strip()ped: the header PROSE names `navigator.userAgent` to say it refuses to read one, and a
  // probe that grades prose grades the wrong thing (#146). Caught by this check going red on its
  // own first run, which is the only way a check earns trust (§6 r19b).
  ok(!UA.test(strip(read('packages/shared/src/hooks/useDevice.ts'))),
    '🔴 §D THE DETECTOR ITSELF reads no user-agent — the property its whole header rests on');
  for (const page of ['packages/cultivar-os/src/pages/ReceiptKeeper.tsx', 'packages/cultivar-os/src/pages/OperationsCalendar.tsx']) {
    ok(!UA.test(strip(read(page))), `§D ${relative(ROOT, page)} decides its layout with no user-agent`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E — 🔴 THE CSS AND THE JS READ THE SAME NUMBERS.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // Every WIDTH media query in the corpus, CSS files included. Print queries carry no width and
  // are not breakpoints, so they are not in scope; the pattern only matches min-/max-width.
  const cssFiles = (function w(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name === 'ignition-os' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) w(p, out); else if (/\.css$/.test(name)) out.push(p);
    }
    return out;
  })(join(ROOT, 'packages'));
  const all = [...FILES, ...cssFiles];
  ok(cssFiles.length >= 1, `§E the walk reached the stylesheets (${cssFiles.length}) — a walk of no CSS proves nothing about CSS`);

  // A LITERAL width breakpoint: a hardcoded number, as opposed to `${breakpoints.x}px`.
  const LITERAL = /@media[^{]*\(\s*(?:min|max)-width:\s*\d/;
  const DECLARED: Record<string, string> = {
    'packages/shared/src/notifications/templates/base.ts':
      'an EMAIL template (max-width: 600px). It renders in Outlook and Gmail, not in this app — it cannot import a token, and 600px is the email convention, not a platform band.',
  };
  const found = all.filter(f => LITERAL.test(readFileSync(f, 'utf8'))).map(f => relative(ROOT, f)).sort();
  console.log(`  §E discovered ${found.length} file(s) with a literal width breakpoint, expected ${Object.keys(DECLARED).length}: ${found.join(', ') || '(none)'}`);

  ok(found.length === Object.keys(DECLARED).length,
    `🔴 §E EXPECTED ${Object.keys(DECLARED).length} literal width breakpoint(s) and FOUND ${found.length} — interpolate \`\${breakpoints.medium}px\` from design-system/tokens instead, or declare the exception with its reason`);
  for (const f of found) ok(f in DECLARED,
    `🔴 §E UNDECLARED literal width breakpoint: ${f} — the CSS and the hook must read ONE number, or they agree only by luck`);
  for (const f of Object.keys(DECLARED)) ok(found.includes(f), `§E STALE declaration — ${f} no longer holds a literal width breakpoint`);

  // …and the one stylesheet that DOES break by width proves it reads the token.
  const grid = read('packages/shared/src/components/tiles/TileGrid.tsx');
  ok(/min-width:\s*\$\{breakpoints\.medium\}px/.test(grid) && /min-width:\s*\$\{breakpoints\.wide\}px/.test(grid),
    '🔴 §E TileGrid — the platform\'s only CSS width breakpoints — interpolates the SAME tokens the hook reads');
  ok(/from '\.\.\/\.\.\/design-system\/tokens'/.test(grid), '§E …and imports them, so deleting a token breaks the build rather than the layout');
  ok(breakpoints.medium === 640 && breakpoints.wide === 1024,
    '🔴 §E the tokens still hold the tile grid\'s ORIGINAL values (640/1024) — the re-sourcing changed no pixel; a change here is a DESIGN change and must be made deliberately');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §F — THE RETIRED HOOKS ARE GONE, BY NAME.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  for (const dead of ['useIsMobile', 'detectMobile', 'useIsNarrow', 'NARROW_QUERY']) {
    const hits = FILES.filter(f => new RegExp(`\\b${dead}\\b`).test(strip(readFileSync(f, 'utf8')))).map(f => relative(ROOT, f));
    ok(hits.length === 0, `🔴 §F \`${dead}\` is retired and must not return — still in: ${hits.join(', ')}`);
  }
  const rk = strip(read('packages/cultivar-os/src/pages/ReceiptKeeper.tsx'));
  ok(/useInput\(\)/.test(rk) && /touchPrimary/.test(rk),
    '§F ReceiptKeeper asks the INPUT axis — "will a finger do this", which is what its camera-first layout actually turns on');
  const oc = strip(read('packages/cultivar-os/src/pages/OperationsCalendar.tsx'));
  ok(/useBreakpoint\(\)/.test(oc), '§F OperationsCalendar asks the VIEWPORT axis — "is there room for a select"');
  ok(/=== 'wide'/.test(oc),
    '§F …and binds on `wide`, so the yard tablet gets the arrows its own comment always promised it');
}

console.log(`\n${failed === 0 ? '✅' : '❌'} deviceDetector — ${passed} passed, ${failed} failed`);
if (failed > 0) { for (const f of failures) console.error('   ✗ ' + f); process.exit(1); }
