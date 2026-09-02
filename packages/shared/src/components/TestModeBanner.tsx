// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: state, on every authenticated screen, that this business is in TEST MODE and that
//   nothing is reaching QuickBooks. Mounted ONCE inside the app's sticky chrome so it is on
//   every route by construction rather than by somebody remembering to add it per page.
// DEPENDENCIES: ../business-logic/testMode (isTestMode + TEST_MODE_BANNER — the mode and the
//   sentence both come from the one module the SERVER also reads, so the banner cannot claim a
//   state the order writer disagrees with) · ../context (useBusinessContext).
// OUTPUTS: <TestModeBanner /> — renders nothing at all when the business is live.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 IT HAS NO CLOSE BUTTON, AND THAT IS THE FEATURE RATHER THAN AN OMISSION.
// ══════════════════════════════════════════════════════════════════════════════
//   The expensive failure in test mode is not fake data reaching real books — that is guarded
//   at `pushQboInvoice`, above both the invoice POST and the customer create. It is the
//   REVERSE: somebody works in test mode for a week believing they are live, none of their
//   real sales reaches QuickBooks, and two weeks later a bookkeeper finds a hole nobody can
//   reconstruct. A banner that can be dismissed is a banner that IS dismissed on day one, and
//   then the mode is invisible for the remaining six days.
//
//   ⚠️ THE COST IS REAL AND IT IS ACCEPTED, NOT UNNOTICED: this takes vertical space on every
//   screen, including the phone screens where space is scarcest. That is the trade — a mode
//   you cannot see is a mode you can be wrong about for a fortnight. Durable dismissal is
//   explicitly out of scope for this build.
//
// 🔴 IT SAYS WHAT *IS* HAPPENING, NOT ONLY WHAT IS NOT. "Test mode" alone leaves an owner
//   guessing whether their work is being kept at all. It is: the order is real, complete and
//   correct in this platform. Only the accounting write is withheld, and only from the figures.
//
// 🔴 IT RENDERS ON UNKNOWN, NOT ONLY ON A CONFIRMED FALSE. `isTestMode` treats an unread flag
//   as test mode, so a business row that failed to load shows the banner. Showing it wrongly
//   costs a moment's confusion that the settings screen resolves; hiding it wrongly is the
//   fortnight-long failure above. There is no symmetry between those two errors.
// ─────────────────────────────────────────────────────────────────────────────
import { useBusinessContext } from '../context';
import { isTestMode, TEST_MODE_BANNER } from '../business-logic/testMode';

export function TestModeBanner() {
  const { business, loading } = useBusinessContext();

  // ⚠️ THE ONE CASE THAT IS NOT "UNKNOWN MEANS TEST": the context has not finished its FIRST
  // load. Rendering during that window would flash the banner on every page load for a LIVE
  // business, and a warning that appears and vanishes on every navigation is a warning people
  // learn to ignore — which would cost exactly the visibility this component exists for.
  // After loading completes, an absent flag DOES mean test mode (see the file header).
  if (loading) return null;
  if (!isTestMode(business?.qbo_writes_enabled)) return null;

  return (
    <div
      role="status"
      data-testmode-banner="1"
      style={{
        background: '#FEF3C7', borderBottom: '1px solid #92400e', color: '#92400e',
        padding: '8px 14px', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.45,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.9375rem', lineHeight: 1.3 }}>⚠</span>
      <span>{TEST_MODE_BANNER}</span>
    </div>
  );
}
