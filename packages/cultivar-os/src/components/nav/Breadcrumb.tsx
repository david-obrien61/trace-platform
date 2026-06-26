/**
 * Breadcrumb — the single breadcrumb component (Nav C2).
 *
 * PURPOSE:      Render the active surface's place in the ratified IA as an "up" trail
 *               (parent links, not browser history). Ancestors link; the current page does not.
 *               Mounted ONCE in AppLayout, so every authenticated page — including the ones that
 *               previously had NO back nav (PMI, /roles) — gets a consistent breadcrumb.
 * DEPENDENCIES: tileRegistry.breadcrumbForPath() — the ONE IA source (no per-page path literals);
 *               react-router useLocation/useNavigate.
 * OUTPUTS:      ONE breadcrumb trail, root → current. Ancestor segments are clickable links;
 *               the current page is plain (non-link) text. On narrow screens the single row
 *               scrolls horizontally rather than wrapping — there is no separate "mobile" DOM
 *               variant, which is what previously double-rendered (an inline display:flex on the
 *               desktop span defeated the responsive display:none, so the collapsed "‹ parent"
 *               span appeared ALONGSIDE the full trail → garbled "X / Y ‹ Z" strings + duplicate
 *               leaf segment). One render, one source → that whole bug class is gone.
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

  // ONE trail. Ancestors (route present) link; the current leaf is plain text. No second
  // "mobile" span — the row scrolls horizontally on narrow screens (CSS), so there is no way
  // for a collapsed variant to render at the same time as the full trail.
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="breadcrumb-item">
          {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
          {c.route && !c.current ? (
            <button className="breadcrumb-seg" onClick={() => navigate(c.route!)}>
              {c.label}
            </button>
          ) : (
            <span
              className={`breadcrumb-seg${c.current ? ' is-current' : ''}`}
              aria-current={c.current ? 'page' : undefined}
            >
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
