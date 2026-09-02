// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: on the screen where an order is actually rung up, say what test mode is NOT
//   proving — that stock does not move, so this is not a test of whether the system tracks
//   the trees. Renders nothing at all when the business is live.
// DEPENDENCIES: ../business-logic/testMode (isTestMode + TEST_MODE_STOCK_CAVEAT — David's
//   wording, verbatim, from the one module the banner and the order writer also read) ·
//   ../context (useBusinessContext).
// OUTPUTS: <TestModeStockCaveat /> — mounted on the ring-up surface, beside the submit action.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THIS IS THE HALF THAT MATTERS, AND IT IS SEPARATE FROM THE BANNER ON PURPOSE.
// ══════════════════════════════════════════════════════════════════════════════
//   The global banner states the PROTECTION: nothing reaches QuickBooks, the counts do not
//   change. David's ruling is that the protection alone is not enough — *"a screen that only
//   says what it protects lets someone conclude they have tested something they have not."*
//
//   The failure is specific and it is the more expensive of the two. An owner rings up a week
//   of practice orders, watches the system behave correctly, and concludes it tracks her trees
//   — because nothing told her that the one capability she cares about most is the one
//   deliberately switched off. She finds out after go-live, on real stock.
//
// 🔴 WHY IT IS NOT SIMPLY APPENDED TO THE BANNER. Two reasons, and the second is the one that
//   would have cost something. **(1)** It is only TRUE of the ring-up act — nothing about
//   reading a dashboard is a test of stock tracking, so a global claim would be a claim in the
//   wrong place. **(2)** A standing banner carrying both sentences puts a paragraph on every
//   page, and a paragraph is how a standing notice becomes wallpaper — costing the FIRST
//   sentence the attention that makes the whole mechanism work.
//
// ⚠️ IT IS DELIBERATELY QUIETER THAN THE BANNER — smaller, no icon, no border. It is a caveat
//   at the point of action, not a second alarm. Two alarms on one screen train a reader to
//   dismiss both.
// ─────────────────────────────────────────────────────────────────────────────
import { useBusinessContext } from '../context';
import { isTestMode, TEST_MODE_STOCK_CAVEAT } from '../business-logic/testMode';

export function TestModeStockCaveat() {
  const { business, loading } = useBusinessContext();

  // Same first-load rule as the banner: silent until the context has answered once, because a
  // caveat that flashes on every navigation for a LIVE business is one people stop reading.
  // After that, an absent flag means test mode — the safe direction (see testMode.ts).
  if (loading) return null;
  if (!isTestMode(business?.qbo_writes_enabled)) return null;

  return (
    <p
      data-testmode-stock-caveat="1"
      style={{
        margin: '0 16px 10px', padding: '8px 11px',
        background: '#FFFBEB', borderRadius: 8,
        fontSize: '0.75rem', lineHeight: 1.5, color: '#92400e',
      }}
    >
      {TEST_MODE_STOCK_CAVEAT}
    </p>
  );
}
