/**
 * ── REVIEW ASK SHEET — two audiences, one device ────────────────────────────────
 *
 * PURPOSE      After a stop is marked done, offer the crew the chance to ask for a review, and —
 *              if they take it — render the customer-facing screen they turn the phone around to.
 *              This component renders NOTHING unless `offer` is non-null; the decision of whether
 *              there is anything to render is made by `reviewAskDecision()` in
 *              `lib/deliveryFulfilment.ts`, never here. A `.tsx` cannot be asserted (tech-debt
 *              #134), so this file holds no policy — only pixels.
 *
 * DEPENDENCIES `@trace/shared/qr/generate` (generateQR — the SAME helper Settings/Profile/
 *              MemberConsole already use for invite codes; three existing callers, one pattern) ·
 *              the offer model from deliveryFulfilment.
 *
 * OUTPUTS      <ReviewAskSheet> — the crew prompt, then the customer screen.
 *
 * 🔴 TWO AUDIENCES, ONE DEVICE, AND THEY ARE SEPARATELY LANGUAGED.
 *    The CREW copy (§CREW_COPY) and the CUSTOMER copy (which arrives already assembled on
 *    `offer.lines`) are deliberately kept apart. David's crews may not read or speak confident
 *    English — the man who lives on site speaks none — so:
 *      · there is NO spoken script and NO instruction to say anything. The crew taps and turns
 *        the phone around. The customer-facing screen carries the ask in full, by itself.
 *      · nothing here reads a business-level language setting. There is none, and one would be the
 *        wrong shape: Cuto and the office are one business and more than one language. The axis is
 *        per-PERSON and per-AUDIENCE, never per-tenant. Full translation is a later story; what
 *        this build owes it is not to write down an assumption that must later be undone.
 *
 * 🔴 THE QR IS RENDERED LOCALLY AND WORKS WITH NO SIGNAL. `generateQR` is the `qrcode` npm package
 *    producing a data: URL in the browser — no network call, no image host. On twenty acres and at
 *    customer sites that is the point, not a nicety.
 *
 * ⚠️ THIS DOES NOT COPY `shared/src/qr/print.ts`. That file interpolates unescaped values into
 *    `document.write` and carries `nurseryName` (an AC-1 leak on the §4 noun-purge list). It has
 *    ZERO callers and should not gain one. Real DOM only, as `Settings.tsx`/`Profile.tsx` do.
 */
import { useEffect, useState } from 'react';
import { generateQR } from '@trace/shared/qr/generate';
import type { ReviewAskOffer } from '../../lib/deliveryFulfilment';

const GREEN = '#27500A';
const DARK  = '#111827';
const GRAY  = '#6b7280';

// ── CREW COPY. Short, imperative, and about the DEVICE rather than about what to say. ──────────
// "Not this one" is one tap and asks nothing — no reason field, no confirmation, no are-you-sure.
// Some jobs end badly (a fence came down and went back imperfectly), and a crew that cannot skip
// cleanly will either ask at the wrong moment or stop tapping done altogether — and `fulfilled`
// feeds four other things. The skip is RECORDED, which is a different matter from being questioned.
const CREW_COPY = {
  title:  'Ask for a review?',
  show:   'Show the code',
  skip:   'Not this one',
  done:   'Done',
  hint:   'Turn the phone to the customer.',
};

const BACKDROP: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, boxSizing: 'border-box',
};

// CENTERED per the platform modal standard (docs/standards/ui-control-standards.md → MODAL, M1).
const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '22px 20px',
  width: '100%', maxWidth: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
};

// The customer screen is a FULL takeover, not a dialog: the phone is handed over, so the crew's
// surrounding interface must not be readable behind it. White, large type, nothing tappable that
// could navigate the customer into the business's own app.
const CUSTOMER_SCREEN: React.CSSProperties = {
  position: 'fixed', inset: 0, background: '#fff', zIndex: 130,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 24, boxSizing: 'border-box', textAlign: 'center',
};

const BTN_PRIMARY: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '13px 16px', background: GREEN, color: '#fff',
  border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
};

const BTN_GHOST: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '13px 16px', background: 'transparent', color: GRAY,
  border: '1px solid #d1d5db', borderRadius: 10, fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
};

function ReviewQr({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed]   = useState(false);
  useEffect(() => {
    let live = true;
    generateQR(url, { width: 260, margin: 1 })
      .then(u => { if (live) setDataUrl(u); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [url]);

  // A QR that could not be drawn says so and shows the address instead — it never renders an empty
  // box the customer is expected to scan (D-9: a broken affordance must not look like a working one).
  if (failed) {
    return (
      <div style={{ fontSize: '0.875rem', color: DARK, wordBreak: 'break-all', maxWidth: 320 }}>
        {url}
      </div>
    );
  }
  if (!dataUrl) return <div style={{ width: 260, height: 260 }} aria-hidden />;
  return <img src={dataUrl} alt="Scan to leave a review" width={260} height={260} />;
}

export function ReviewAskSheet({
  offer, onShown, onSkip, onClose,
}: {
  /** Null → this component renders NOTHING. The tile-off case never reaches a pixel. */
  offer: ReviewAskOffer | null;
  onShown: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [showing, setShowing] = useState(false);
  if (!offer) return null;

  if (showing) {
    return (
      <div style={CUSTOMER_SCREEN}>
        {/* The ask, in full, on the screen the customer reads. No spoken script is required of
            anyone. Each line comes from `offer.lines`, assembled in the pure module — the
            per-business guidance line among them. */}
        {offer.lines.map((line, i) => (
          <p key={i} style={{
            margin: i === 0 ? '0 0 8px' : '0 0 22px',
            fontSize: i === 0 ? '1.25rem' : '1rem',
            fontWeight: i === 0 ? 700 : 400,
            color: i === 0 ? DARK : GRAY,
            maxWidth: 340, lineHeight: 1.5,
          }}>
            {line}
          </p>
        ))}
        <ReviewQr url={offer.url} />
        <button onClick={onClose} style={{ ...BTN_GHOST, maxWidth: 260, marginTop: 28 }}>
          {CREW_COPY.done}
        </button>
      </div>
    );
  }

  return (
    <div style={BACKDROP}>
      <div style={CARD}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 800, color: DARK }}>
          {CREW_COPY.title}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: '0.8125rem', color: GRAY }}>{CREW_COPY.hint}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { setShowing(true); onShown(); }}
            style={BTN_PRIMARY}
          >
            {CREW_COPY.show}
          </button>
          {/* ONE TAP, NOTHING ASKED. */}
          <button onClick={onSkip} style={BTN_GHOST}>{CREW_COPY.skip}</button>
        </div>
      </div>
    </div>
  );
}
