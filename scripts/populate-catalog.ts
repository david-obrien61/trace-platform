/**
 * ── CATALOG-POPULATE RUNNER (capability 1.3) ──────────────────────────────────────
 *
 * PURPOSE: Drive populateCatalog against a real tenant + a real live site. The
 *   onboarding "wow": read their site → extract their catalog → clear the sandbox →
 *   write their REAL varieties into business_inventory, D-9-flagged.
 *
 * DEPENDENCIES: packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY;
 *   optional ANTHROPIC_API_KEY). Shared: discovery/populate + catalog (exercised, not
 *   duplicated). Run via esbuild → node (the shared modules are TS):
 *     node_modules/.bin/esbuild scripts/populate-catalog.ts --bundle --platform=node \
 *       --format=cjs --external:@supabase/supabase-js --external:@anthropic-ai/sdk \
 *       | node - --business=<uuid> --url=lawnstrees.com [--verify|--clear]
 *
 *   With ANTHROPIC_API_KEY set → the real discovery_catalog model runs (production
 *   path). Without a key → a DETERMINISTIC extraction STAND-IN parses the same
 *   fetched page text the model would see (clearly labelled), so the live end-to-end
 *   (fetch→extract→clear→populate→clear) is provable on the service key alone. The
 *   AI path's correctness is proven separately by catalog.test.ts.
 *
 * Instrumentation: [TRACE:POPULATE] flows up from the shared modules. ON by default.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { populateCatalog, clearSandbox, clearDiscovery, catalogItemToInventoryRow } from '../packages/shared/src/discovery/populate';
import { executeCapability } from '../packages/shared/src/ai/execute';

// run from repo root: node_modules/.bin/esbuild scripts/populate-catalog.ts --bundle ... | node
const envText = readFileSync(`${process.cwd()}/packages/cultivar-os/.env.local`, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const arg  = (k: string) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : null; };
const flag = (k: string) => process.argv.includes(`--${k}`);
const BUSINESS = arg('business') || env.VITE_DEMO_BUSINESS_ID || 'a1b2c3d4-0000-0000-0000-000000000001';
const URL_ARG  = arg('url') || 'lawnstrees.com';

const ANTHROPIC = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || '';

// ── deterministic AI stand-in (used ONLY when no Anthropic key) ───────────────────
// Parses buildCatalogPrompt's text the same way the model would read it: per PAGE
// block, pull "Name (Botanical 'cultivar')" titles, category from the page's hint.
function standInExecute(_cap: string, opts: { user: string }): Promise<any> {
  const out: any[] = [];
  const blocks = opts.user.split('--- PAGE').slice(1);
  for (const b of blocks) {
    const catM = b.match(/Category[^:]*:\s*(.+)/);
    const hint = catM ? catM[1].trim() : '';
    const category = /unknown/i.test(hint) ? null : hint;
    // Title form: a 2+ word Capitalized common name followed by a (Botanical) parenthetical.
    const re = /([A-Z][A-Za-zàâ-ÿ'’.\-]+(?:\s+[A-Za-zàâ-ÿ'’.\-]+){1,5})\s*\(([A-Z][A-Za-zàâ-ÿ'’.×\-]+(?:\s+[^)]+)?)\)/g;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = re.exec(b)) !== null) {
      // strip WooCommerce chrome that abuts titles in stripped text ("Read more", "Select options", "Add to cart")
      const variety = m[1].trim().replace(/\s+/g, ' ')
        .replace(/^(read more|select options|add to cart|view product|sale!?)\s+/i, '').trim();
      const botanical = m[2].trim().replace(/\s+/g, ' ');
      // botanical must look botanical (Genus species OR a quoted cultivar) — drops phone/nav noise
      if (!/^[A-Z][a-zàâ-ÿ]+(\s|$)/.test(botanical) && !/['’]/.test(botanical)) continue;
      if (variety.length < 4 || /menu|address|hours|updated|shop|contact|reviews|gallery/i.test(variety)) continue;
      const key = variety.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ variety, botanical, category, confidence: 'high' });
    }
  }
  return Promise.resolve(out);
}

const useReal = ANTHROPIC.length > 0;
const execFn = useReal
  ? (cap: string, o: any) => executeCapability(cap, { ...o, apiKey: ANTHROPIC })
  : standInExecute;

async function countDisc(): Promise<number> {
  return (await sb.from('business_inventory').select('id', { count: 'exact', head: true })
    .eq('business_id', BUSINESS).like('sku', 'DISC-%')).count ?? 0;
}
async function countReal(): Promise<number> {
  // real LAWNS inventory = neither sandbox (SMPL-) nor discovery (DISC-)
  return (await sb.from('business_inventory').select('id', { count: 'exact', head: true })
    .eq('business_id', BUSINESS).not('sku', 'like', 'DISC-%').not('sku', 'like', 'SMPL-%')).count ?? 0;
}

async function run() {
  console.log(`\n=== CATALOG-POPULATE ===`);
  console.log(`business : ${BUSINESS}`);
  console.log(`url      : ${URL_ARG}`);
  console.log(`extractor: ${useReal ? 'REAL discovery_catalog model (Anthropic key present)' : 'DETERMINISTIC STAND-IN (no Anthropic key — AI path proven by catalog.test.ts)'}`);

  if (flag('clear')) {
    const s = await clearSandbox(BUSINESS, sb);
    const d = await clearDiscovery(BUSINESS, sb);
    console.log('cleared sandbox:', JSON.stringify(s), '· discovery rows:', d);
    return;
  }

  const opts = { apiKey: ANTHROPIC, _execute: execFn as any };

  if (flag('verify')) {
    const realBefore = await countReal();
    const r = await populateCatalog(BUSINESS, URL_ARG, sb, opts);
    const discAfter = await countDisc();
    const realMid   = await countReal();

    // flag-path DB round-trip: a flagged item must persist as status='review' + visible note, then clear.
    const flaggedRow = catalogItemToInventoryRow(
      { variety: '__FLAGPROOF__ Tree', botanical: null, category: null, confidence: 'low', flagged: true, flagReason: 'proof', sourceUrl: URL_ARG },
      BUSINESS, 99999);
    await sb.from('business_inventory').insert(flaggedRow);
    const { data: fr } = await sb.from('business_inventory').select('status,notes,unit_cost,cost_confidence').eq('business_id', BUSINESS).eq('sku', flaggedRow.sku).maybeSingle();
    const flagOk = fr?.status === 'review' && /FLAGGED/.test(fr?.notes ?? '') && fr?.unit_cost === null && fr?.cost_confidence === 'UNKNOWN';

    const d2 = await clearDiscovery(BUSINESS, sb);   // clears the real DISC rows AND the flagproof row
    const discFinal = await countDisc();
    const realAfter = await countReal();

    const extractedOk = r.extract.items.length > 0;
    const insertedOk  = discAfter === r.inserted && r.inserted > 0;
    const idempotentOk = discFinal === 0;
    const realUntouchedOk = realBefore === realMid && realMid === realAfter;

    console.log('\n=== VERIFY ===');
    console.log('extract  :', JSON.stringify({ pages: r.extract.pagesFetched, raw: r.extract.rawItemCount, deduped: r.extract.items.length, high: r.extract.highConfidence, flagged: r.extract.flaggedCount }), extractedOk ? '✓ catalog extracted' : '✗ nothing extracted');
    console.log('inserted :', r.inserted, '· DISC rows now', discAfter, insertedOk ? '✓ rows written' : '✗ mismatch');
    console.log('flag path:', JSON.stringify(fr), flagOk ? "✓ flagged → status 'review', price UNKNOWN, note visible" : '✗ flag path broken');
    console.log('idempotent:', `DISC rows after clear = ${discFinal} (cleared ${d2})`, idempotentOk ? '✓ no orphans' : '✗ residue');
    console.log('real data:', `before ${realBefore} → mid ${realMid} → after ${realAfter}`, realUntouchedOk ? '✓ LAWNS real rows untouched' : '✗ real data changed!');
    console.log('\nSAMPLE varieties:', r.extract.items.slice(0, 8).map(i => `${i.variety}${i.category ? ` [${i.category}]` : ''}${i.flagged ? ' ⚑' : ''}`).join(' · '));

    const pass = extractedOk && insertedOk && flagOk && idempotentOk && realUntouchedOk;
    process.exit(pass ? 0 : 1);
  }

  // plain populate (leaves the catalog in place for owner-prove on the dashboard)
  const r = await populateCatalog(BUSINESS, URL_ARG, sb, opts);
  console.log('\nstatus   :', r.status, r.error ? `(${r.error})` : '');
  console.log('extracted:', r.extract.items.length, 'varieties ·', r.extract.highConfidence, 'high-confidence ·', r.extract.flaggedCount, 'flagged');
  console.log('inserted :', r.inserted, 'rows (', r.flaggedInserted, 'flagged for review )');
  console.log('cleared  : sandbox', JSON.stringify(r.cleared.sandbox), '· prior discovery', r.cleared.discovery);
  console.log('\nSAMPLE   :', r.extract.items.slice(0, 12).map(i => `${i.variety}${i.category ? ` [${i.category}]` : ''}${i.flagged ? ' ⚑FLAGGED' : ''}`).join('\n           '));
}

run().catch(e => { console.error(e); process.exit(1); });
