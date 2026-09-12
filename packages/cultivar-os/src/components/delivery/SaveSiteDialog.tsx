/**
 * ── SAVE THIS ADDRESS AS A DELIVERY SITE — the offer, as a dialog ────────────────────────────
 *
 * PURPOSE      D-41 L2 (ledger #303): after a ship-to edit lands, offer to keep that address in the
 *              customer's book under a name the owner chooses. Nothing auto-saves.
 * DEPENDENCIES @trace/shared/business-logic (SaveOutcome) · rendered from useStopActions' `overlays`
 * OUTPUTS      <SaveSiteDialog> — renders NOTHING when there is no offer.
 *
 * 🔴 WHY THIS IS A DIALOG AND NOT A PANEL ON THE CARD — §8 V1/V3 (R-148, David 2026-09-12).
 * It shipped inside <StopCard>, in a list of stops, and its screen position therefore depended on
 * how many stops sat above it and how tall they were. It landed below the fold twice on
 * /delivery-schedule on 2026-09-12 and read as a failure both times. David's sentence: *"a required
 * decision is not page content — page content can be scrolled past, a decision cannot."* Wrong by
 * construction, not by bad luck about where the fold landed.
 *
 * 🔴 AND THE OUTCOME IS REPORTED IN HERE, NOT AS A THIRD SURFACE. "Saved as Job site A" used to be a
 * grey line on the card — the same defect as the offer, one step later. The dialog that asked the
 * question answers it and then closes.
 *
 * ⚠️ THE CLOSE IS THE READER'S, NOT A TIMER. "Reports the outcome and closes" is implemented as
 * outcome + a Done button, deliberately: an outcome that dismisses itself after N seconds is the
 * original defect wearing a clock — feedback the reader may never see.
 */
import type { CSSProperties } from 'react';

const GREEN = '#27500A';
const DARK  = '#1f2937';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';

const BACKDROP: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, boxSizing: 'border-box',
};
// M1 centered · V4 bounded flex column, actions pinned — the shape at DataSheet.tsx:580.
const CARD: CSSProperties = {
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '85vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
};
const BODY:    CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 20px 0' };
const ACTIONS: CSSProperties = { flexShrink: 0, display: 'flex', gap: 8, padding: '16px 20px 20px' };
const INPUT:   CSSProperties = {
  width: '100%', minHeight: 48, border: '1.5px solid #d1d5db', borderRadius: 10,
  padding: '0 12px', fontSize: '1rem', color: DARK, boxSizing: 'border-box', background: '#fff',
};
const BTN_PRIMARY: CSSProperties = {
  flex: 1, minHeight: 48, background: GREEN, color: '#fff', border: 'none',
  borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
};
const BTN_GHOST: CSSProperties = {
  flex: 1, minHeight: 48, background: '#fff', color: DARK, border: '1px solid #d1d5db',
  borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer',
};

export interface SiteOffer { stopId: string; customerName: string; address: string; label: string }
/** `ok:false` is a refusal or a failure; both are said in words, neither is a silent close. */
export interface SiteResult { text: string; ok: boolean }

export function SaveSiteDialog({
  offer, result, busy, onLabelChange, onSave, onDismiss,
}: {
  offer: SiteOffer | null;
  result: SiteResult | null;
  busy: boolean;
  onLabelChange: (label: string) => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  // A null offer renders NOTHING — no greyed dialog, no empty backdrop.
  if (!offer) return null;

  return (
    <div style={BACKDROP} role="dialog" aria-modal="true" aria-label="Save this address as a delivery site">
      <div style={CARD}>
        <div style={BODY}>
          {result ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.0625rem', fontWeight: 800, color: result.ok ? DARK : RED }}>
                {result.ok ? 'Saved' : 'Not saved'}
              </h2>
              <p style={{ margin: '0 0 4px', fontSize: '0.875rem', color: result.ok ? GRAY : RED, lineHeight: 1.5 }}>
                {result.text}
              </p>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.0625rem', fontWeight: 800, color: DARK }}>
                Save this address as a delivery site?
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: GRAY, lineHeight: 1.5 }}>
                For <strong>{offer.customerName}</strong>. Give it a name and it will be offered next
                time you take their order.
              </p>
              <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: DARK, lineHeight: 1.45 }}>
                {offer.address}
              </p>
              {/* The name starts BLANK and nothing guesses one — a book full of one-off drops is
                  worse than no book at all (David's redline). */}
              <input
                value={offer.label}
                onChange={e => { onLabelChange(e.target.value); }}
                placeholder="Job site A"
                disabled={busy}
                autoComplete="off"
                autoFocus
                style={INPUT}
              />
            </>
          )}
        </div>

        {/* V4 — pinned. The decision is on screen whenever the dialog is. */}
        <div style={ACTIONS}>
          {result ? (
            <button onClick={onDismiss} style={BTN_PRIMARY}>Done</button>
          ) : (
            <>
              <button onClick={onSave} disabled={busy} style={{ ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Saving…' : 'Save as a site'}
              </button>
              <button onClick={onDismiss} disabled={busy} style={BTN_GHOST}>Not this one</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
