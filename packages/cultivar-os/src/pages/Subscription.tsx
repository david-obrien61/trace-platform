/**
 * Subscription — THE MODULE MARKETPLACE (/admin/subscription).
 *
 * PURPOSE:      One page answering "what am I paying for, what could I add, and what is coming."
 *               FOUR SECTIONS IN ONE SCROLL (David's ruling 2026-08-02 (6) #1): Included · Active ·
 *               Available · Coming. **Deliberately not tabs** — a tab hides the very comparison the
 *               page exists to make, and Terry seeing what he ALREADY GETS sitting directly above
 *               what he could add is the pitch.
 * DEPENDENCIES: MODULE_CATALOG (the catalog is the source — NOT the tile registry) · tileByKey for
 *               display labels · business_modules rows (read) · trialDaysRemaining (the ONE reader
 *               of the stored trial pair) · setBusinessModuleState (the ONE WRITER of the table) ·
 *               useBusinessContext.can().
 * OUTPUTS:      A rendered marketplace. The ENABLE action writes `enabled:true` through the RPC.
 * INSTRUMENTATION (STD-003): [TRACE:SUBSCRIPTION] — ON by default (standing owner instruction).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IT READS THE CATALOG, NOT THE REGISTRY, AND THAT IS THE WHOLE REASON THIS SURFACE EXISTS.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Five of the eleven `module_key`s sit on tiles NO RENDERER DRAWS — `placement:'settings'`,
 * `placement:'admin'`, or `kind:'readout'` (`tilesForPlacement()` and `dashboardReadouts()` both
 * have zero callers). On the dashboard grid those modules are invisible whatever their row says,
 * which is exactly how `cost_to_produce` ran a live 30-day trial with no badge and nothing said so.
 * **A customer buys QuickBooks sync whether or not it has a square on the grid** (David's ruling
 * 2026-08-02 (6) #5), so this page lists all eleven from `MODULE_CATALOG` and never asks whether a
 * tile happens to render. It is the first surface in the platform that renders what the SEEDER
 * decided rather than the seeder's side effects.
 *
 * ⚠️ THE THREE MASTER_BRIEF CORE ITEMS WITH NO CATALOG ENTRY are display-only COPY in Included —
 * owner dashboard, basic inventory/asset tracking, customer records. **Not `ModuleEntry` rows**
 * (ruling 2026-08-01: a `module_key` on the owner dashboard would make the shell every tile renders
 * into a purchasable row). They are listed because the brief promises them, and a page built to
 * show Terry what he is getting that omits three of the five would undersell the product.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 WHAT ENABLING DOES **NOT** DO — NO PAYMENT, NO STRIPE, NO INVOICE (ruling #6, stated here
 *    because it is the claim this page could most easily make falsely).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * `[ENABLE]` sets `enabled:true` through `set_business_module_state` and **nothing bills.** There is
 * no payment rail in the platform. The copy on every Available card says so, because *"the business
 * is now paying $29/mo"* is a claim TRACE cannot make yet, and a button that implies it would be the
 * fake-affordance class one layer up from the one this page was built to remove.
 *
 * 🔴 AND IT DOES NOT START A TRIAL EITHER — RULING OWED (2026-08-02 (7)). `Enable` calls
 * `setBusinessModuleState({enabled:true})`; the clock's only writer is `start_module_trial`, a
 * separate RPC this page never calls. **So enabling a priced add-on here produces a BILLABLE MODULE
 * THAT IS LIVE WITH NOTHING THAT EVER ENDS IT** — invariant B6's defect, and B6 asserts over the
 * SEED PROJECTION only, so it structurally cannot see a row this button creates. The copy says what
 * actually happens; whether the button should ALSO start the clock is David's, and it is filed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Circle, Clock, Mail, Plus } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { supabase } from '@trace/shared/supabase/client';
import { setBusinessModuleState, BUSINESS_MODULE_COLUMNS } from '@trace/shared/business-logic/moduleState';
import { seedBusinessModules, warnOnShortModuleSeed } from '@trace/shared/business-logic/seedBusinessModules';
import type { BusinessModuleRow } from '@trace/shared/business-logic/moduleState';
import { trialDaysRemaining } from '@trace/shared/business-logic/trialClock';
import { MODULE_CATALOG, TILE_REGISTRY, catalogSeedRows } from '../registry/tileRegistry';
import type { ModuleEntry } from '../registry/tileRegistry';

const GREEN = '#27500A';
const AMBER = '#b45309';

/** Where a "tell us you want this" tap goes today (ruling #3). */
const HOOK_EMAIL = 'david@trace-enterprises.com';

/**
 * The three MASTER_BRIEF core items that have no `module_key` and correctly never will.
 * COPY, not data — they are here because the brief promises them (MASTER_BRIEF:295-300).
 */
const INCLUDED_COPY: { label: string; blurb: string }[] = [
  { label: 'Owner dashboard',              blurb: 'The shell every tile renders into. Core by structure, not by billing.' },
  { label: 'Basic inventory & asset tracking', blurb: 'Counting what you have and what it is worth.' },
  { label: 'Customer records',             blurb: 'Who bought what, and how to reach them.' },
];

/** Display label for a module — from its tile, falling back to the key. */
function labelFor(moduleKey: string): string {
  // ⚠️ `.filter(...)[0]`, not `.find(...)`: a module_key may sit on MORE THAN ONE tile (the
  // 2026-08-02 pairing put `cost_to_produce` on both `operating_costs` and `cost_to_produce`).
  // Prefer a tile that actually renders, so the label matches what the owner sees on his grid.
  const tiles = TILE_REGISTRY.filter((t) => t.module_key === moduleKey);
  const rendered = tiles.find((t) => t.placement === 'dashboard' && t.kind !== 'readout');
  return (rendered ?? tiles[0])?.label ?? moduleKey;
}

const price = (m: ModuleEntry) => (m.price_monthly == null ? '—' : `$${m.price_monthly}/mo`);

export function Subscription() {
  const { businessId, can, userEmail, business } = useBusinessContext();
  const [rows, setRows]       = useState<Record<string, BusinessModuleRow>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice]   = useState<{ key: string; text: string; ok: boolean } | null>(null);

  const mayEnable = can('subscription:update');

  const read = useCallback(async (): Promise<Record<string, BusinessModuleRow>> => {
    const { data, error } = await supabase
      .from('business_modules')
      .select(BUSINESS_MODULE_COLUMNS)
      .eq('business_id', businessId as string);
    const byKey: Record<string, BusinessModuleRow> = {};
    for (const r of (data ?? []) as BusinessModuleRow[]) byKey[r.module_key] = r;
    if (error) console.warn('[TRACE:SUBSCRIPTION] read failed', error.message);
    return byKey;
  }, [businessId]);

  const load = useCallback(async () => {
    if (!businessId) return;
    let byKey = await read();

    // ════════════════════════════════════════════════════════════════════════════════════════════
    // 🔴 SEED-IF-ABSENT — THE THIRD HOME THE 2026-08-01 RULING NAMED, AND IT IS THIS SURFACE.
    // ════════════════════════════════════════════════════════════════════════════════════════════
    // An owner who abandons onboarding with both seed calls failing has NO module rows — and
    // `useModules` renders a MISSING row and a disabled row IDENTICALLY, so he is invisible on
    // every screen. **No row means no clock, which means a customer who is never billed.**
    //
    // 🔴 IT IS NO LONGER MERELY SILENT — IT NOW CONTRADICTS ITSELF IN PUBLIC. This page renders a
    // core module "Included ✓" from the CATALOG while the dashboard renders `[ENABLE]` from the
    // ABSENT ROW: two surfaces disagreeing about the same module on the same tenant. That visible
    // disagreement is what moved this from filed to built.
    //
    // ⚠️ WHY REPAIRING HERE IS SAFE: `seed_business_modules` is `ON CONFLICT DO NOTHING` and its
    // clock refuses to restart, so **the repair path IS the create path** — running it against a
    // healthy tenant creates nothing and re-terms nobody. It is gated on `subscription:update`,
    // which every visitor to this page necessarily holds (`subscription:read` is owner-only), so
    // the authority is not a new consideration.
    //
    // ⚠️ AND IT REPAIRS A SHORT SEED, NOT ONLY AN EMPTY ONE. `< MODULE_CATALOG.length` catches the
    // tenant missing three rows just as it catches the tenant missing eleven — a partial seed is
    // three modules with no clock, and it looks exactly like a healthy tenant on every screen.
    if (Object.keys(byKey).length < MODULE_CATALOG.length) {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await seedBusinessModules(supabase, businessId, user?.id ?? null, catalogSeedRows());
      console.log('[TRACE:SUBSCRIPTION] seed-if-absent', {
        businessId, had: Object.keys(byKey).length, catalog: MODULE_CATALOG.length, ...res,
      });
      warnOnShortModuleSeed('marketplace load', businessId, res);
      // Re-read regardless of the reported outcome: a partial success still changed the truth, and
      // rendering the pre-seed snapshot would show the owner a page that is already stale.
      byKey = await read();
    }

    console.log('[TRACE:SUBSCRIPTION] load', {
      businessId, rows: Object.keys(byKey).length, expected: MODULE_CATALOG.length,
    });
    setRows(byKey);
    setLoading(false);
  }, [businessId, read]);

  useEffect(() => { void load(); }, [load]);

  // ── THE FOUR SECTIONS ─────────────────────────────────────────────────────────────────────────
  // Derived from the CATALOG + the row, never from tile placement. A module is:
  //   · INCLUDED  — billing is core or core_optional ($0; nothing to buy)
  //   · ACTIVE    — the tenant has it on
  //   · COMING    — priced, but its tile is not live, so there is nothing to turn on yet
  //   · AVAILABLE — priced, buildable today, and off
  const sections = useMemo(() => {
    const isLiveSurface = (k: string) =>
      TILE_REGISTRY.some((t) => t.module_key === k && t.status === 'live');
    const included: ModuleEntry[] = [], active: ModuleEntry[] = [];
    const available: ModuleEntry[] = [], coming: ModuleEntry[] = [];
    for (const m of MODULE_CATALOG) {
      const on = rows[m.module_key]?.enabled === true;
      if (m.billing === 'core' || m.billing === 'core_optional') {
        // core_optional that is OFF is still an Included thing you switch on — not a purchase.
        included.push(m);
      } else if (on) {
        active.push(m);
      } else if (!isLiveSurface(m.module_key)) {
        coming.push(m);
      } else {
        available.push(m);
      }
    }
    return { included, active, available, coming };
  }, [rows]);

  async function enable(m: ModuleEntry) {
    if (!businessId) return;
    setBusyKey(m.module_key);
    setNotice(null);
    const { data: { user } } = await supabase.auth.getUser();
    // 🔴 THE TERM TRAVELS WITH THE ENABLE — ONE ACT (ruling 2026-08-02 (8)). The server starts the
    // clock inside the same transaction, so there is no window in which this module is live and
    // unclocked. **`m.trial_days` is 0 for `core` and `core_optional`, which is what keeps a free
    // module from acquiring a countdown** — the inverse defect, decided here because the database
    // has no catalog (AC-1).
    const res = await setBusinessModuleState(
      supabase, businessId, m.module_key,
      { enabled: true, trialDays: m.trial_days }, user?.id ?? null,
    );
    console.log('[TRACE:SUBSCRIPTION] enable', {
      module: m.module_key, applied: res.applied, reason: res.reason, error: res.error?.message ?? null,
    });
    if (res.applied) {
      // The notice says what ACTUALLY happened, including the clock — the whole point of this pass
      // being that the copy and the outcome must agree.
      setNotice({ key: m.module_key, ok: true, text: res.trialStarted
        ? `${labelFor(m.module_key)} is on and its ${m.trial_days}-day trial has started. Nothing has been billed.`
        : `${labelFor(m.module_key)} is on. Nothing has been billed.` });
      await load();
    } else {
      // 🔴 A REFUSAL IS SURFACED, NEVER SWALLOWED. `applied:false` with a reason is the server's
      // authority gate speaking — the same split V3d proved at the database, arriving in the UI.
      setNotice({ key: m.module_key, ok: false,
        text: res.reason ?? res.error?.message ?? 'The server refused and gave no reason.' });
    }
    setBusyKey(null);
  }

  function interestMailto(m: ModuleEntry): string {
    const name = labelFor(m.module_key);
    const subject = `TRACE — interested in ${name}`;
    const body = [
      `Module: ${name} (${m.module_key})`,
      `Price: ${price(m)}`,
      `Business: ${business?.name ?? '(unnamed)'}${businessId ? ` [${businessId}]` : ''}`,
      `From: ${userEmail ?? '(unknown)'}`,
      '',
      'What I would want it to do:',
      '',
    ].join('\n');
    return `mailto:${HOOK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>{children}</div>
  );

  const SectionHead = ({ title, blurb }: { title: string; blurb: string }) => (
    <div style={{ marginTop: 24, marginBottom: 10 }}>
      <h2 style={{
        fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: GREEN, margin: 0,
      }}>{title}</h2>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '4px 0 0' }}>{blurb}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sage-bg)' }}>
      <div style={{ background: GREEN, padding: '20px 16px', color: '#fff' }}>
        <p style={{ fontSize: '0.6875rem', color: '#a8c890', margin: 0, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          Business administration
        </p>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Subscription &amp; Modules</h1>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 620, margin: '0 auto' }}>
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>Loading…</p>
        ) : (
          <>
            {/* ── INCLUDED ─────────────────────────────────────────────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════════════════════════
                🔴 "INCLUDED" IS TWO STATES, NOT ONE — INCLUDED AND ON, and INCLUDED BUT NOT
                SWITCHED ON (David's finding, 2026-08-02 (7)).
                ═══════════════════════════════════════════════════════════════════════════════════
                The first version gave every row in this section a green CHECK. On Contractors that
                put a check — the same glyph Orders and QuickBooks carry, meaning *done, nothing to
                do* — on the one card with a [Turn on] button beside it. **The card asserted two
                contradictory states at once**, which is the six-state ruling's own class arriving
                inside the first surface built under it.

                THE CUT: **the SECTION HEADER already asserts the billing fact for every row in it,
                so the per-row glyph must not repeat it.** A glyph saying "included" is a second
                representation of what the header just said (STD-011) — and it was the copy that
                happened to be wrong. The glyph now carries the only other fact a row has: WHETHER
                IT IS ON. Check = on. Circle = off, and off is a legitimate resting state here, not
                a defect — so it is muted rather than alarming. */}
            <SectionHead
              title="Included"
              blurb={sections.included.some((m) => m.billing === 'core_optional' && rows[m.module_key]?.enabled !== true)
                // The second sentence is CONDITIONAL. With nothing to switch on it would tell the
                // owner to do something already done — a small lie, and the exact shape of the one
                // this section just had.
                ? 'Part of TRACE at no extra cost. A few are optional — switch them on if you need them.'
                : 'Part of TRACE. No extra cost, nothing to buy.'}
            />
            {sections.included.map((m) => {
              const row = rows[m.module_key];
              const on  = row?.enabled === true;
              const isSwitchable = m.billing === 'core_optional';
              const isOff = isSwitchable && !on;
              return (
                <div key={m.module_key} style={{ marginBottom: 8 }}>
                  <Card>
                    {isOff
                      ? <Circle size={18} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />
                      : <Check  size={18} color={GREEN}   style={{ flexShrink: 0, marginTop: 2 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{labelFor(m.module_key)}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                        {/* COPY LEADS WITH THE CHOICE, NOT THE INCLUSION. "Included at no charge —
                            turn it on…" opened on the fact the section header had already stated,
                            and buried the only fact the row adds. State what IS, then what to do.
                            ⚠️ AND IT IS PERMISSION-AWARE: telling a manager to turn something on
                            when `mayEnable` is false is the Available-header defect one card over. */}
                        {isSwitchable
                          ? (on
                              ? 'Turned on. No charge, and nothing expires.'
                              : mayEnable
                                ? 'Not turned on. Free to use — switch it on if you give contractor discounts, and nothing expires.'
                                : 'Not turned on. Free to use — the owner can switch it on. Nothing expires.')
                          : 'Included in your subscription.'}
                      </div>
                      {notice?.key === m.module_key && (
                        <div style={{ fontSize: '0.8125rem', marginTop: 6, color: notice.ok ? GREEN : '#b91c1c' }}>
                          {notice.text}
                        </div>
                      )}
                    </div>
                    {isSwitchable && !on && mayEnable && (
                      <button onClick={() => void enable(m)} disabled={busyKey === m.module_key}
                        style={{
                          flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 8,
                          border: `1px solid ${GREEN}`, background: '#fff', color: GREEN,
                          fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                        }}>
                        {busyKey === m.module_key ? 'Turning on…' : 'Turn on'}
                      </button>
                    )}
                  </Card>
                </div>
              );
            })}
            {INCLUDED_COPY.map((c) => (
              <div key={c.label} style={{ marginBottom: 8 }}>
                <Card>
                  <Check size={18} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{c.label}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{c.blurb}</div>
                  </div>
                </Card>
              </div>
            ))}

            {/* ── ACTIVE ───────────────────────────────────────────────────────────────────── */}
            {sections.active.length > 0 && (
              <>
                <SectionHead title="Active" blurb="Turned on for your business." />
                {sections.active.map((m) => {
                  const daysLeft = trialDaysRemaining(rows[m.module_key]?.config);
                  return (
                    <div key={m.module_key} style={{ marginBottom: 8 }}>
                      <Card>
                        <Check size={18} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{labelFor(m.module_key)}</span>
                            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{price(m)}</span>
                          </div>
                          {/* ═══════════════════════════════════════════════════════════════════
                              🔴 THE TRIAL LINE — AND IT NEVER CLAIMS AN EXPIRY THE PLATFORM DOES
                              NOT ENFORCE (David's ruling #4).
                              ═══════════════════════════════════════════════════════════════════
                              `trialDaysRemaining` returns null (no clock), a positive number, or 0
                              (lapsed) — three different answers that must stay three (D-9).
                              **NOTHING FLIPS A LAPSED MODULE OFF.** Expiry is the fuzz and it is
                              filed, not built, so at 0 this says "trial ended — still working" and
                              NOT "expired": the module genuinely still runs, and a page that says
                              expired while the thing works is the surface lying in the direction
                              nobody checks. */}
                          {daysLeft != null && daysLeft > 0 && (
                            <div style={{ fontSize: '0.8125rem', color: AMBER, fontWeight: 600, marginTop: 2 }}>
                              <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in trial
                              <span style={{ fontWeight: 400, color: '#6b7280' }}>
                                {' '}— nothing is billed automatically.
                              </span>
                            </div>
                          )}
                          {daysLeft === 0 && (
                            <div style={{ fontSize: '0.8125rem', color: AMBER, fontWeight: 600, marginTop: 2 }}>
                              <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                              Trial ended — still working.
                              <span style={{ fontWeight: 400, color: '#6b7280' }}>
                                {' '}Nothing switches it off yet, and nothing has been billed.
                              </span>
                            </div>
                          )}
                          {daysLeft == null && (
                            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                              On — not on a trial clock.
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── AVAILABLE ────────────────────────────────────────────────────────────────── */}
            {sections.available.length > 0 && (
              <>
                {/* ⚠️ THE HEADER IS PERMISSION-AWARE, same sweep as the Contractors card. "Turn one
                    on and it works immediately" told a MANAGER to perform an act whose control on
                    every row below reads `Owner only` — a header asserting an action the row
                    contradicts, which is the defect this whole pass is about. */}
                <SectionHead
                  title="Available"
                  blurb={mayEnable
                    ? 'Built and ready. Turn one on and it works immediately.'
                    : 'Built and ready. The owner can turn these on.'}
                />
                {sections.available.map((m) => (
                  <div key={m.module_key} style={{ marginBottom: 8 }}>
                    <Card>
                      <Plus size={18} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{labelFor(m.module_key)}</span>
                          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{price(m)}</span>
                        </div>
                        {/* 🔴 NO PAYMENT RAIL EXISTS. Enabling turns the module ON and bills nothing.
                            Saying otherwise would be the exact claim ruling #6 forbids. */}
                        {/* ═════════════════════════════════════════════════════════════════════
                            🔴 THE SENTENCE THAT WAS HERE WAS FALSE, AND I WROTE IT. It read
                            "A {trial_days}-day trial starts when it is enabled." **NOTHING STARTS
                            A TRIAL.** `Enable` calls `setBusinessModuleState({enabled:true})`; the
                            only writer of the clock is `start_module_trial`, a DIFFERENT RPC this
                            page never calls. The card described an outcome the button does not
                            produce — the exact class David's sweep was asking about, one card over
                            from the one that prompted it.
                            🔴 AND THE CONSEQUENCE IS NOT COSMETIC: enabling a priced add-on with no
                            clock creates a BILLABLE MODULE THAT IS LIVE WITH NOTHING THAT EVER ENDS
                            IT — free forever, no conversion date. That is invariant **B6**, and B6
                            asserts over the SEED PROJECTION only, so it structurally cannot see a
                            row this button creates. **Whether Enable should also start the clock is
                            a BEHAVIOUR ruling and is OWED — it is not a rendering fix, so it was
                            not silently taken here.** The copy now says what actually happens. */}
                        {/* ✅ RESTORED 2026-08-02 (8), NOW THAT THE BEHAVIOUR MATCHES IT. This
                            sentence was true, then false, and is true again — the difference is that
                            `Enable` now starts the clock in the SAME transaction as the enable, so
                            there is no state in which the card's promise and the row disagree. */}
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          Turning this on does not charge you — there is no payment set up yet.
                          {m.trial_days > 0 && ` A ${m.trial_days}-day trial starts when you enable it.`}
                        </div>
                        {notice?.key === m.module_key && (
                          <div style={{ fontSize: '0.8125rem', marginTop: 6, color: notice.ok ? GREEN : '#b91c1c' }}>
                            {notice.text}
                          </div>
                        )}
                      </div>
                      {mayEnable ? (
                        <button onClick={() => void enable(m)} disabled={busyKey === m.module_key}
                          style={{
                            flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 8,
                            border: 'none', background: GREEN, color: '#fff',
                            fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                          }}>
                          {busyKey === m.module_key ? 'Enabling…' : 'Enable'}
                        </button>
                      ) : (
                        // A manager holding subscription:read SEES the page and is refused the ACT,
                        // with the reason named (the six-state model, ruling #2). No hidden button.
                        <span style={{ flexShrink: 0, fontSize: '0.75rem', color: '#9ca3af', maxWidth: 120, textAlign: 'right' }}>
                          Owner only
                        </span>
                      )}
                    </Card>
                  </div>
                ))}
              </>
            )}

            {/* ── COMING ───────────────────────────────────────────────────────────────────── */}
            {sections.coming.length > 0 && (
              <>
                <SectionHead title="Coming" blurb="On the roadmap and not built yet. Tell us what you need and it shapes what gets built." />
                {sections.coming.map((m) => (
                  <div key={m.module_key} style={{ marginBottom: 8 }}>
                    <Card>
                      <Clock size={18} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{labelFor(m.module_key)}</span>
                          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{price(m)} when it ships</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          Not built yet — no charge and no trial running.
                        </div>
                      </div>
                      {/* 🔴 THE TAP IS A `mailto:`, AND IT IS DELIBERATE (David's ruling #3): "I just
                          need the hook, not a full dev solution." No table, no endpoint, no schema —
                          and critically NOT an inert card, because **an input surface that swallows
                          input is worse than no input surface.** A mailto: cannot silently lose a
                          requirement: the owner sees the draft, sends it, and has it in his own sent
                          folder. When it earns a real destination it gets one. */}
                      <a href={interestMailto(m)}
                        style={{
                          flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 8,
                          border: `1px solid ${GREEN}`, background: '#fff', color: GREEN,
                          fontWeight: 600, fontSize: '0.8125rem', textDecoration: 'none',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}>
                        <Mail size={14} /> I want this
                      </a>
                    </Card>
                  </div>
                ))}
              </>
            )}

            {/* 🔴 THE STANDING HONEST FOOTER. Every price on this page is a rate, not a charge. */}
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 28, lineHeight: 1.6 }}>
              TRACE does not bill automatically yet. Prices show what a module will cost; enabling one
              turns it on and charges nothing. Trials are informational — nothing switches a module off
              when one ends.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
