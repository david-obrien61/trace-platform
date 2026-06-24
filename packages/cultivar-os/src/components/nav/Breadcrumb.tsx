/**
 * Breadcrumb — the single breadcrumb component (Nav C2).
 *
 * PURPOSE:      Render the active surface's place in the ratified IA as an "up" trail
 *               (parent links, not browser history). Ancestors link; the current page does not.
 *               Mounted ONCE in AppLayout, so every authenticated page — including the ones that
 *               previously had NO back nav (PMI, /roles) — gets a consistent breadcrumb.
 * DEPENDENCIES: tileRegistry.breadcrumbForPath() — the ONE IA source (no per-page path literals);
 *               react-router useLocation/useNavigate.
 * OUTPUTS:      A breadcrumb trail. Full path on desktop; collapsed to a single "‹ parent" link on
 *               narrow screens (CSS-driven via .breadcrumb-full / .breadcrumb-mobile in globals.css).
 *               Renders nothing when no IA node matches (public/auth surfaces never mount this).
 * INSTRUMENTATION (STD-003): [TRACE:NAV] breadcrumb — ON by default (standing owner instruction).
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { breadcrumbForPath } from '../../registry/tileRegistry';

export function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = breadcrumbForPath(location.pathname);

  if (crumbs.length === 0) return null;

  // [TRACE:NAV] which IA trail resolved for the active surface (ON by default, STD-003).
  console.log('[TRACE:NAV] breadcrumb', {
    pathname: location.pathname,
    trail: crumbs.map((c) => c.label).join(' / '),
  });

  // Mobile collapse: the immediate ancestor (the "up" target). Absent for a section root.
  const parent = crumbs.length >= 2 ? crumbs[crumbs.length - 2] : null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {/* Desktop — full trail. Ancestors link; current is plain text. */}
      <span className="breadcrumb-full" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {i > 0 && <span className="breadcrumb-sep">/</span>}
            {c.route ? (
              <button
                className="breadcrumb-seg"
                onClick={() => navigate(c.route!)}
              >
                {c.label}
              </button>
            ) : (
              <span className={`breadcrumb-seg${c.current ? ' is-current' : ''}`} aria-current={c.current ? 'page' : undefined}>
                {c.label}
              </span>
            )}
          </span>
        ))}
      </span>

      {/* Mobile — collapse to "‹ parent" (the up target). Section roots show just the label. */}
      <span className="breadcrumb-mobile">
        {parent && parent.route ? (
          <button className="breadcrumb-seg" onClick={() => navigate(parent.route!)}>
            ‹ {parent.label}
          </button>
        ) : (
          <span className="breadcrumb-seg is-current">{crumbs[crumbs.length - 1].label}</span>
        )}
      </span>
    </nav>
  );
}
