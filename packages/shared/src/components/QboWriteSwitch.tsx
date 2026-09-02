// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the OWNER's decision about their own books — whether orders rung up from now on are
//   written to QuickBooks as real invoices. Renders the current mode, what it means, and (for
//   an owner) the switch, behind a confirmation that STATES WHAT CHANGES before it happens.
// DEPENDENCIES: ../business-logic/testMode (isTestMode · testModeExplanation ·
//   writeSwitchConfirmation · LIVE_MODE_CONFIRMED) · ../context (useBusinessContext — for the
//   business row, `isOwner`, and `reload`) · a supabase client passed in by the vertical.
// OUTPUTS: <QboWriteSwitch businessId supabase /> — mounted in the Accounting card.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THE AUTHORITY IS THE DATABASE'S, NOT THIS COMPONENT'S — AND THAT IS THE WHOLE POINT.
// ══════════════════════════════════════════════════════════════════════════════
//   `businesses` carries exactly ONE update policy: `businesses_owner_update`, USING
//   (owner_id = auth.uid()), from 20260529. The only member-facing policy added since is
//   `businesses_member_select` — a READ (20260622). So a manager's UPDATE is refused by
//   Postgres whatever this file does, and this component's `isOwner` check only decides
//   whether to draw a control that would fail.
//
//   ⚠️ R-31 APPLIES AND IS OBEYED HERE: a permission string with no enforcement behind it may
//   not be cited as evidence that work is covered. No string is cited — the claim is about a
//   POLICY, and the migration that adds this column carries a VERIFY block that reads
//   `pg_policies` and fails the reader's expectations out loud if any second UPDATE policy
//   exists. Prove the gate; do not assert it.
//
// 🔴 A MEMBER IS TOLD WHO CAN, NOT SHOWN A DEAD CONTROL. A greyed switch with no explanation is
//   the mystery-locked field §6 r13 forbids: it reads as a broken button rather than as a
//   decision that belongs to someone else.
//
// 🔴 THE CONFIRMATION IS NOT "ARE YOU SURE?". It states, in the future tense, what will happen
//   from now on — and what will NOT (the week of test orders does not become real). Asking
//   someone to re-affirm a decision without telling them what it does is not consent.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { supabase } from '../supabase/client';
import { useBusinessContext } from '../context';
import {
  isTestMode, testModeExplanation, writeSwitchConfirmation, LIVE_MODE_CONFIRMED,
} from '../business-logic/testMode';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const AMBER = '#92400e';
const RED   = '#A32D2D';
const DARK  = '#111827';

/**
 * `supabase` is imported rather than injected, matching `Settings.tsx` itself (which imports
 * the same shared client at its own line 2). The sibling QBO panels reach the server over
 * `fetch('/api/...')` because they need the SERVICE KEY and a permission gate in a serverless
 * function; this one deliberately does not. The write runs under the signed-in owner's OWN
 * session so `businesses_owner_update` is the thing that decides — the authority is the
 * database's, and routing it through the service key would replace a real RLS gate with a
 * hand-written check in a function we would then have to keep correct. It also mints no api/
 * file, which matters at 12 of 12 (§6 r11).
 */
export function QboWriteSwitch({ businessId }: { businessId: string | null | undefined }) {
  const { business, isOwner, reload } = useBusinessContext();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justWentLive, setJustWentLive] = useState(false);

  const testMode = isTestMode(business?.qbo_writes_enabled);

  async function setWrites(enabled: boolean) {
    if (!businessId || saving) return;
    setSaving(true); setError(null);
    try {
      // 🔴 R-12 — A WRITE MUST PROVE IT WROTE. `.select('id')` and a row-count check, because
      // a Postgres UPDATE that matches ZERO rows is a SUCCESS with `error: null`. Under
      // `businesses_owner_update` that is exactly what a manager's attempt looks like — and
      // reporting it as done would tell someone their books are now live when nothing changed,
      // which is the fortnight-long failure this whole feature is shaped around.
      const { data, error: err } = await supabase
        .from('businesses').update({ qbo_writes_enabled: enabled }).eq('id', businessId).select('id');
      if (err) throw new Error(err.message);
      if (!data || data.length !== 1) {
        throw new Error(
          'The change was not saved — the database did not accept it. Only the account owner can turn QuickBooks writing on or off.',
        );
      }
      console.log('[TRACE:TESTMODE] write switch CHANGED', { businessId, qbo_writes_enabled: enabled, rows: data.length });
      setJustWentLive(enabled);
      setConfirming(false);
      reload();
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      console.log('[TRACE:TESTMODE] write switch REFUSED or FAILED', { businessId, enabled, message });
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const box: React.CSSProperties = {
    marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb',
  };

  return (
    <div style={box}>
      <p style={{ fontSize: '0.875rem', color: DARK, fontWeight: 700, margin: '0 0 4px' }}>
        Sending invoices to QuickBooks
      </p>

      {/* THE STATE, NAMED, BEFORE ANY CONTROL. A switch whose position you have to infer from
          the label on its button is a switch people read wrongly. */}
      <div style={{
        padding: '10px 12px', borderRadius: 9, marginBottom: 10,
        background: testMode ? '#FEF3C7' : '#f0fdf4',
        border: `1px solid ${testMode ? AMBER : GREEN}`,
      }}>
        <p style={{ fontSize: '0.8125rem', margin: 0, fontWeight: 700, color: testMode ? AMBER : GREEN }}>
          {testMode ? 'Test mode — nothing is being sent to QuickBooks.' : 'Live — new orders are sent to QuickBooks as invoices.'}
        </p>
        {testMode && (
          <p style={{ fontSize: '0.8125rem', color: AMBER, margin: '6px 0 0', lineHeight: 1.5 }}>
            {testModeExplanation()}
          </p>
        )}
      </div>

      {justWentLive && !testMode && (
        <p style={{ fontSize: '0.8125rem', color: GREEN, margin: '0 0 10px', fontWeight: 600 }}>✓ {LIVE_MODE_CONFIRMED}</p>
      )}

      {!isOwner ? (
        // NOT a greyed control. A member is told whose decision this is and why they cannot
        // see a button — an explained absence, never a mystery-locked affordance (§6 r13).
        <p style={{ fontSize: '0.8125rem', color: GRAY, margin: 0, lineHeight: 1.5 }}>
          Only the account owner can change this. It decides whether real invoices are created in
          this business&apos;s QuickBooks, so it is not delegated.
        </p>
      ) : confirming ? (
        <div style={{ padding: 12, background: '#fffbeb', border: `1px solid ${AMBER}`, borderRadius: 9 }}>
          <p style={{ fontSize: '0.8125rem', color: AMBER, margin: '0 0 10px', lineHeight: 1.55, fontWeight: 600 }}>
            {writeSwitchConfirmation(business?.name)}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => void setWrites(true)} disabled={saving}
              style={{ minHeight: 48, padding: '13px 18px', background: saving ? '#e5e7eb' : GREEN, color: saving ? GRAY : '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem', cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Turning on…' : 'Yes — start sending invoices to QuickBooks'}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(null); }} disabled={saving}
              style={{ minHeight: 48, padding: '13px 18px', background: '#fff', color: DARK, border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer' }}
            >
              Not yet
            </button>
          </div>
        </div>
      ) : testMode ? (
        <button
          onClick={() => { setConfirming(true); setError(null); }}
          style={{ minHeight: 48, padding: '13px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }}
        >
          Turn on sending to QuickBooks…
        </button>
      ) : (
        <button
          onClick={() => void setWrites(false)} disabled={saving}
          style={{ minHeight: 48, padding: '13px 18px', background: '#fff', color: DARK, border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: saving ? 'default' : 'pointer' }}
        >
          {saving ? 'Turning off…' : 'Go back to test mode'}
        </button>
      )}

      {error && (
        <p style={{ fontSize: '0.8125rem', color: RED, margin: '10px 0 0', lineHeight: 1.5 }}>⚠ {error}</p>
      )}
    </div>
  );
}
