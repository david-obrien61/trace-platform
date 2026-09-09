#!/usr/bin/env node
/**
 * ── pricing-config-clobber.rls.mjs — CAN A SAVE ON THE COST PANEL DESTROY THE TAX RATE? ──────
 *
 * PURPOSE:      The Cost-to-Produce panel writes `business_pricing_config.config` as a
 *               WHOLE-COLUMN REPLACE and rescues other screens' keys from an ENUMERATED preserve
 *               list. `taxRate` was never on that list. This proves, under REAL RLS with a real
 *               signed-in session, what a Save actually does to a config that carries keys the
 *               panel does not own — for the two principals that matter:
 *                 · a MANAGER holding LAWNS's live manager permission set (no pricing_recipe:*)
 *                 · the OWNER, who holds both pricing_recipe:read and :update
 * DEPENDENCIES: scripts/lib/memberSession.mjs · packages/cultivar-os/.env.local. No app code is
 *               imported: the panel's save is REPRODUCED here from its own source shape so the
 *               probe measures the WRITE, not our re-reading of it.
 * OUTPUTS:      exit 0 = every assertion held. Run: node scripts/rls/pricing-config-clobber.rls.mjs
 *
 * 🔴 IT NEVER TOUCHES A REAL TENANT. LAWNS and Test Dave's are READ-ONLY here; the probe mints its
 * own throwaway business, writes a full config onto it, and deletes both in a `finally`. Editing a
 * real tenant's pricing recipe and restoring it is exactly the capture-and-restore this repo's
 * harness doctrine refuses (memberSession.mjs) — and a config is money.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { adminClient, loadEnv, withMemberSession, makeHarness } from '../lib/memberSession.mjs';

// Lauren's EXACT live permission array on LAWNS, read from business_members 2026-09-09.
const LAUREN_MANAGER_PERMS = [
  'orders:read','orders:create','orders:update','order_items:read','order_service_selections:read',
  'order_compliance_records:read','customers:read','customers:create','customers:update',
  'service_offerings:read','inventory:read','inventory:create','inventory:update',
  'inventory_ledger:read','deliveries:read','deliveries:update','deliveries.route:read',
  'pmi:read','pmi:update','tax_rate:read','tax_rate:update','settings:read','settings:update',
  'campaigns:read','campaigns:update',
];

const OWNER_PERMS = [...LAUREN_MANAGER_PERMS, 'pricing_recipe:read', 'pricing_recipe:update',
  'costs:read','costs:update','margin:read','wages:read'];

/** The stored config the throwaway tenant starts with — LAWNS's real SHAPE, not its values. */
const STORED = {
  version: 1,
  unitLabel: 'tree',
  denominators: [1, 5, 20, 100],
  margin: { baseline: 0.4, tiers: [{ name: 'standard', marginOverride: 0.4, isDefault: true }] },
  priceReference: null,
  locations: [{ id: 'default', name: 'Primary', kind: 'base', recurring: [],
                labor: { rate: null, hours: null, period: 'monthly', confidence: 'ESTIMATED' },
                overheadPerUnit: 0 }],
  taxRate: 0.0825,                 // ← the key under test
  discountTypes: [{ name: 'CD10%', percent: 10 }],
  production: { potPrice: 3.25 },  // ← a second unowned key, on NOBODY's preserve list
};

/** EMPTY_COST_CONFIG, verbatim from packages/shared/src/business-logic/CostToProduce.ts:110. */
const EMPTY_COST_CONFIG = {
  version: 1, unitLabel: 'unit', denominators: [1, 5, 20, 100],
  margin: { baseline: 0.40, tiers: [{ name: 'standard', marginOverride: 0.40, isDefault: true }] },
  priceReference: null,
  locations: [{ id: 'default', name: 'Primary', kind: 'base', recurring: [],
                labor: { rate: null, hours: null, period: 'monthly', confidence: 'ESTIMATED' },
                overheadPerUnit: 0 }],
};

/** The PRE-FIX save, reproduced: read latest, rescue three named keys, whole-column replace. */
async function preFixSave(client, businessId, inMemoryConfig) {
  const latest = await client.from('business_pricing_config').select('config')
    .eq('business_id', businessId).maybeSingle();
  const lc = (latest.data?.config && typeof latest.data.config === 'object') ? latest.data.config : {};
  const preserved = {};
  for (const k of ['discountTypes', 'pricingTiers', 'aiBiEnabled']) {
    if (lc[k] !== undefined) preserved[k] = lc[k];
  }
  const configToWrite = { ...inMemoryConfig, ...preserved };
  const res = await client.from('business_pricing_config')
    .upsert({ business_id: businessId, config: configToWrite }, { onConflict: 'business_id' });
  return { error: res.error, wrote: configToWrite };
}

/** The panel's LOAD, reproduced: parseConfig is a CAST, and the fallback is the whole default. */
function loadPanelConfig(rawFromRead) {
  let c = rawFromRead;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = null; } }
  const stored = (c && typeof c === 'object' && Array.isArray(c.locations)) ? c : null;
  return (stored && stored.locations.length) ? stored : JSON.parse(JSON.stringify(EMPTY_COST_CONFIG));
}

/**
 * Load the REAL shipped merge, compiled from its TypeScript source. Re-implementing it here would
 * measure this file's idea of the fix rather than the fix (tech-debt #182).
 */
async function loadShippedMerge() {
  const repoRoot = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
  const dir = mkdtempSync(join(tmpdir(), 'pcm-'));
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, `export { mergeOwnedOverConfig, COST_PANEL_OWNED_KEYS } from `
    + `'${repoRoot}/packages/shared/src/business-logic/pricingConfigMerge';\n`);
  const out = join(dir, 'merge.mjs');
  execSync(`node_modules/.bin/esbuild "${entry}" --bundle --platform=node --format=esm --log-level=error --outfile="${out}"`,
    { cwd: repoRoot, stdio: 'pipe' });
  return import(out);
}

async function main() {
  const { ok, done } = makeHarness();
  const admin = adminClient();
  const stamp = Date.now();
  let bizId = null;
  let ownerUserId = null;

  try {
    // `businesses.owner_id` is NOT NULL, so the throwaway tenant needs a throwaway owner. It is
    // never signed in — every assertion below runs on a member session minted by the harness.
    const { data: ow, error: oErr } = await admin.auth.admin.createUser({
      email: `harness-owner-${stamp}@example.com`, password: `Harness!${stamp}`, email_confirm: true });
    if (oErr) throw new Error(`throwaway owner: ${oErr.message}`);
    ownerUserId = ow.user.id;

    const { data: biz, error: bErr } = await admin.from('businesses')
      .insert({ name: `Harness Pricing Clobber ${stamp}`, business_type: 'nursery', owner_id: ownerUserId })
      .select('id').single();
    if (bErr) throw new Error(`throwaway business insert: ${bErr.message}`);
    bizId = biz.id;

    const { error: cfgErr } = await admin.from('business_pricing_config')
      .insert({ business_id: bizId, config: STORED });
    if (cfgErr) throw new Error(`seed config: ${cfgErr.message}`);

    const readAsAdmin = async () => (await admin.from('business_pricing_config')
      .select('config').eq('business_id', bizId).maybeSingle()).data?.config ?? {};

    // ── §A — THE MANAGER (Lauren's exact permissions) ──────────────────────────────────────
    console.log('\n§A — MANAGER holding LAWNS\'s live manager permissions (no pricing_recipe:*)');
    await withMemberSession(
      { businessId: bizId, role: 'MANAGER', permissions: LAUREN_MANAGER_PERMS, label: 'Harness Manager' },
      async ({ client }) => {
        const read = await client.from('business_pricing_config').select('config')
          .eq('business_id', bizId).maybeSingle();
        ok(read.error === null, 'A1 the read returns NO ERROR (an RLS filter is not an error)',
           `error=${read.error?.message ?? 'null'}`);
        ok(read.data === null, 'A2 the read returns NO ROW — the wall filtered it',
           `data=${JSON.stringify(read.data)}`);

        const panelConfig = loadPanelConfig(read.data?.config);
        ok(panelConfig.taxRate === undefined && panelConfig.unitLabel === 'unit',
           'A3 🔴 the panel therefore renders EMPTY_COST_CONFIG — fabricated defaults, not her data',
           `unitLabel=${panelConfig.unitLabel} (stored is 'tree'), margin=${panelConfig.margin.baseline}`);

        const { error } = await preFixSave(client, bizId, panelConfig);
        const after = await readAsAdmin();
        ok(after.taxRate === 0.0825,
           'A4 THE VERDICT — after her Save the stored taxRate is STILL 0.0825',
           `taxRate=${JSON.stringify(after.taxRate)} · saveError=${error?.message ?? 'none'}`);
        ok(error !== null, 'A5 and the Save was REFUSED by RLS rather than silently doing nothing',
           `error=${error?.message ?? 'NO ERROR — a silent no-op'}`);
      });

    // ── §B — A MEMBER HOLDING pricing_recipe:update STILL CANNOT SAVE ─────────────────────
    // Not a side note: `writePricingConfig` UPSERTs, PostgREST issues INSERT … ON CONFLICT, and
    // `bpc_member_insert` was DROPPED on purpose (20260727_rbac_flip_corrections). So the panel's
    // Save is reachable ONLY by the row owner — the permission alone is not enough.
    console.log('\n§B — a member holding pricing_recipe:read + :update');
    await withMemberSession(
      { businessId: bizId, role: 'MANAGER', permissions: OWNER_PERMS, label: 'Harness Recipe Holder' },
      async ({ client }) => {
        const read = await client.from('business_pricing_config').select('config')
          .eq('business_id', bizId).maybeSingle();
        ok(read.data !== null, 'B1 the read SUCCEEDS — pricing_recipe:read passes the wall');

        const panelConfig = loadPanelConfig(read.data?.config);
        ok(panelConfig.taxRate === 0.0825,
           'B2 🔴 taxRate IS in the in-memory config — parseConfig is a CAST, it strips nothing',
           `taxRate=${JSON.stringify(panelConfig.taxRate)}`);

        const { error } = await preFixSave(client, bizId, panelConfig);
        ok(error !== null,
           'B3 🔴 …and the Save is REFUSED anyway — upsert needs an INSERT policy no member has',
           `error=${error?.message ?? 'NONE — a member CAN write; this probe\'s premise is wrong'}`);
      });

    // ── §C — THE OWNER: the only principal that can actually save this panel ───────────────
    console.log('\n§C — the OWNER (businesses.owner_id), via bpc_owner_all');
    {
      const { url, anonKey } = loadEnv();
      const owner = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: sErr } = await owner.auth.signInWithPassword({
        email: `harness-owner-${stamp}@example.com`, password: `Harness!${stamp}` });
      if (sErr) throw new Error(`owner sign-in: ${sErr.message}`);

      // C-i — the HAPPY path: a parseable config. taxRate survives, but only by accident.
      const r1 = await owner.from('business_pricing_config').select('config')
        .eq('business_id', bizId).maybeSingle();
      ok(r1.data !== null, 'C1 the owner reads the row');
      const cfg1 = loadPanelConfig(r1.data?.config);
      const s1 = await preFixSave(owner, bizId, cfg1);
      const a1 = await readAsAdmin();
      ok(s1.error === null, 'C2 the owner\'s Save is ACCEPTED', `error=${s1.error?.message ?? 'none'}`);
      ok(a1.taxRate === 0.0825,
         'C3 taxRate SURVIVES a normal Save — by unknown-key pass-through, not by design',
         `taxRate=${JSON.stringify(a1.taxRate)}`);
      ok(a1.production?.potPrice === 3.25,
         'C4 …and so does `production`, which is on no preserve list either',
         `production=${JSON.stringify(a1.production)}`);

      // C-ii — THE WIPE. A config the panel cannot parse ⇒ the EMPTY_COST_CONFIG fallback.
      await admin.from('business_pricing_config').update({
        config: { taxRate: 0.0825, discountTypes: STORED.discountTypes, production: { potPrice: 3.25 } },
      }).eq('business_id', bizId);

      const r2 = await owner.from('business_pricing_config').select('config')
        .eq('business_id', bizId).maybeSingle();
      const cfg2 = loadPanelConfig(r2.data?.config);
      ok(cfg2.taxRate === undefined,
         'C5 a config with no `locations` ⇒ the panel falls back to EMPTY_COST_CONFIG');
      const s2 = await preFixSave(owner, bizId, cfg2);
      const a2 = await readAsAdmin();
      ok(s2.error === null, 'C6 the Save is accepted', `error=${s2.error?.message ?? 'none'}`);
      ok(a2.taxRate === undefined,
         'C7 🔴 THE WIPE, REPRODUCED — taxRate is GONE from the stored config',
         `taxRate=${JSON.stringify(a2.taxRate)}`);
      ok(a2.production === undefined,
         'C8 🔴 …and so is `production`. Only the three enumerated keys were rescued',
         `discountTypes kept=${JSON.stringify(a2.discountTypes !== undefined)}`);
      await owner.auth.signOut();
    }

    // ── §D — THE FIX, ON THE SAME INPUT THAT WIPED ────────────────────────────────────────
    console.log('\n§D — the shipped fix, against the exact config that lost the rate in §C');
    {
      const { mergeOwnedOverConfig, COST_PANEL_OWNED_KEYS } = await loadShippedMerge();
      const { url, anonKey } = loadEnv();
      const owner = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: sErr } = await owner.auth.signInWithPassword({
        email: `harness-owner-${stamp}@example.com`, password: `Harness!${stamp}` });
      if (sErr) throw new Error(`owner sign-in: ${sErr.message}`);

      // Restore the full config, then the unparseable one §C wiped from.
      await admin.from('business_pricing_config').update({
        config: { taxRate: 0.0825, discountTypes: STORED.discountTypes, production: { potPrice: 3.25 },
                  aFutureKeyNobodyHasWrittenYet: { n: 7 } },
      }).eq('business_id', bizId);

      const r = await owner.from('business_pricing_config').select('config')
        .eq('business_id', bizId).maybeSingle();
      const before = r.data.config;
      const panelConfig = loadPanelConfig(before);          // ⇒ EMPTY_COST_CONFIG, as in §C5
      ok(panelConfig.taxRate === undefined, 'D1 the panel is on the SAME fallback path that wiped in §C');

      const payload = mergeOwnedOverConfig(before, panelConfig);
      const w = await owner.from('business_pricing_config')
        .upsert({ business_id: bizId, config: payload }, { onConflict: 'business_id' });
      ok(w.error === null, 'D2 the Save is accepted', `error=${w.error?.message ?? 'none'}`);

      const after = await readAsAdmin();
      ok(after.taxRate === 0.0825, '🔴 D3 THE FIX — taxRate SURVIVES the save that used to delete it',
         `taxRate=${JSON.stringify(after.taxRate)}`);
      ok(after.production?.potPrice === 3.25, 'D4 production survives');
      ok(after.aFutureKeyNobodyHasWrittenYet?.n === 7,
         '🔴 D5 …and so does a key this code has never heard of');
      const lost = Object.keys(before).filter((k) => !(k in after));
      ok(lost.length === 0, `D6 NO top-level key was lost (lost=${lost.join('|') || 'none'})`);
      ok(COST_PANEL_OWNED_KEYS.every((k) => k in after),
         'D7 …and every key the panel OWNS was written');
      await owner.auth.signOut();
    }

    // ── §E — READ-ONLY DRY RUN AGAINST THE TWO REAL TENANTS ───────────────────────────────
    // Nothing is written here. This answers the acceptance question about Test Dave's and LAWNS
    // by computing the payload their next Save would produce and comparing it to what is stored.
    console.log('\n§E — dry run on the REAL tenants (read-only, nothing is written)');
    {
      const { mergeOwnedOverConfig } = await loadShippedMerge();
      const { data: rows } = await admin.from('business_pricing_config').select('business_id,config');
      const { data: names } = await admin.from('businesses').select('id,name');
      for (const row of rows ?? []) {
        const label = names?.find((b) => b.id === row.business_id)?.name ?? row.business_id;
        const stored_ = row.config ?? {};
        const panelConfig = loadPanelConfig(stored_);
        const payload = mergeOwnedOverConfig(stored_, panelConfig);
        const lost = Object.keys(stored_).filter((k) => !(k in payload));
        ok(lost.length === 0, `E — ${label}: a Save would lose NO top-level key`,
           `keys=${Object.keys(stored_).length} lost=${lost.join('|') || 'none'} taxRate=${JSON.stringify(payload.taxRate)}`);
      }
    }

    return done('pricing-config-clobber');
  } finally {
    if (bizId) {
      // A8 ON TEARDOWN — an unchecked delete here leaves a config row that outlives the test and
      // corrupts the next run (memberSession.mjs's own finally, and tech-debt #79's lesson). We do
      // not throw from a `finally`; residue is reported LOUDLY instead.
      const { data: cfgGone, error: cfgDelErr } = await admin.from('business_pricing_config')
        .delete().eq('business_id', bizId).select('business_id');
      if (cfgDelErr || (cfgGone ?? []).length !== 1) {
        console.error(`⚠️  TEARDOWN INCOMPLETE — pricing config for ${bizId} NOT removed`
          + `${cfgDelErr ? `: ${cfgDelErr.message}` : ' (0 rows affected)'}.`);
      }
      const { data, error } = await admin.from('businesses').delete().eq('id', bizId).select('id');
      if (error || (data ?? []).length !== 1) {
        console.error(`⚠️  TEARDOWN INCOMPLETE — throwaway business ${bizId} NOT removed`
          + `${error ? `: ${error.message}` : ' (0 rows affected)'}.`);
      }
    }
    if (ownerUserId) {
      const { error } = await admin.auth.admin.deleteUser(ownerUserId);
      if (error) console.error(`⚠️  TEARDOWN INCOMPLETE — owner ${ownerUserId} NOT removed: ${error.message}`);
    }
  }
}

process.exit(await main());
