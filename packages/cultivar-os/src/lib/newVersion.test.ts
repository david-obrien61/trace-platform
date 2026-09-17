// newVersion.test — the reload rule (#313, ledger #345). Run by scripts/run-tests.mjs.
import { readFileSync } from 'node:fs';
import { fetchDeployedVersion, shouldOfferReload } from './newVersion';

let passed = 0, failed = 0;
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; console.log('FAIL', m); } };

// §A the rule
ok(shouldOfferReload('2a2f862', { sha: '6bdcf15' }), 'A1 a different deployed id offers a reload (the 2026-09-17 case)');
ok(!shouldOfferReload('6bdcf15', { sha: '6bdcf15' }), 'A2 the same id does not');
ok(!shouldOfferReload('dev', { sha: '6bdcf15' }), 'A3 a local build never prompts');
ok(!shouldOfferReload('6bdcf15', { sha: 'dev' }), 'A4 a deployed "dev" never prompts');
ok(!shouldOfferReload('6bdcf15', null), 'A5 an unreadable file never prompts');
ok(!shouldOfferReload('6bdcf15', { sha: '<html>' }), 'A6 a malformed id (the SPA fallback page) never prompts');

void (async () => {
// §B the fetch — never throws, never caches
const calls: { url: string; init?: RequestInit }[] = [];
const fake = (body: unknown, okStatus = true) => (async (url: string, init?: RequestInit) => {
  calls.push({ url, init });
  return { ok: okStatus, json: async () => body } as Response;
}) as unknown as typeof fetch;
const v = await fetchDeployedVersion(fake({ sha: 'abcdef1' }));
ok(v?.sha === 'abcdef1', 'B1 reads the id');
ok(calls[0].init?.cache === 'no-store' && /\/version\.json\?t=\d+/.test(calls[0].url), 'B2 asks past every cache');
ok(await fetchDeployedVersion(fake({}, false)) === null, 'B3 a 404 is null');
ok(await fetchDeployedVersion((async () => { throw new Error('offline'); }) as unknown as typeof fetch) === null, 'B4 offline is null');

// §C wiring — the build writes the file, the app mounts the prompt, and the prompt checks on focus + navigation
const vite = readFileSync('packages/cultivar-os/vite.config.ts', 'utf8');
ok(/fileName: 'version\.json'/.test(vite) && /plugins: \[react\(\), versionFile\]/.test(vite), 'C1 the build emits version.json');
const app = readFileSync('packages/cultivar-os/src/App.tsx', 'utf8');
ok(/<NewVersionPrompt \/>/.test(app), 'C2 App mounts the prompt');
const prompt = readFileSync('packages/cultivar-os/src/components/NewVersionPrompt.tsx', 'utf8');
ok(/location\.pathname/.test(prompt) && /'focus'/.test(prompt) && /A new version is ready — reload/.test(prompt) && /window\.location\.reload\(\)/.test(prompt),
  'C3 checks on navigation and focus, says the sentence, reloads on tap');

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
})();
