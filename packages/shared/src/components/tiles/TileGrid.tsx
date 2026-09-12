import React from 'react';
import { breakpoints } from '../../design-system/tokens';

export interface TileGridProps {
  children: React.ReactNode;
}

/**
 * PURPOSE      The dashboard tile grid — 4 / 6 / 8 columns as the viewport widens.
 * DEPENDENCIES `design-system/tokens` (`breakpoints`).
 * OUTPUTS      A `.trace-tile-grid` element plus the one stylesheet that sizes it.
 *
 * 🔴 THIS IS WHERE THE CSS AND THE JS MEET. The two column changes below are the platform's
 * ONLY width breakpoints in CSS, and they are INTERPOLATED from `breakpoints` — the same
 * constants `hooks/useDevice.ts` reads — so the stylesheet cannot drift from the hook. There
 * is no second copy of 640 or 1024 anywhere: delete the token and this file stops compiling.
 * `hooks/deviceDetector.test.ts` §E fails the build if a raw px width appears in any `@media`.
 *
 * ⚠️ The VALUES are unchanged by that move (640 and 1024, as before) — this is a re-sourcing,
 * not a re-design. The grid renders byte-identically at every width.
 */
export function TileGrid({ children }: TileGridProps) {
  return (
    <>
      <style>{`
        .trace-tile-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px 8px;
          justify-items: center;
        }
        @media (min-width: ${breakpoints.medium}px) {
          .trace-tile-grid { grid-template-columns: repeat(6, 1fr); }
        }
        @media (min-width: ${breakpoints.wide}px) {
          .trace-tile-grid { grid-template-columns: repeat(8, 1fr); }
        }
      `}</style>
      <div className="trace-tile-grid">{children}</div>
    </>
  );
}
