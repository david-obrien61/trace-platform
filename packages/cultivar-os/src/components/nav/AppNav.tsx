/**
 * AppNav — the single hamburger / nav-rail (Nav C2).
 *
 * PURPOSE:      Render the TOP-LEVEL sections only — Dashboard · Settings · Admin — from the IA
 *               (NOT every tile; listing every tile would recreate the flat grid vertically).
 *               Desktop = an inline rail; narrow = a hamburger toggling a drawer (CSS-driven via
 *               .appnav-rail / .appnav-toggle / .appnav-drawer in globals.css).
 * DEPENDENCIES: tileRegistry — navSections/navRoute/navPermission/navChildrenOf/navNodeForPath
 *               (the ONE IA source) · useBusinessContext.can (the permission chokepoint) ·
 *               react-router useNavigate/useLocation.
 * OUTPUTS:      Visible top-level section links. The Admin section renders ONLY when the session can
 *               see ≥1 of its (owner-scoped) children — a Staff session never sees an Admin entry
 *               that opens onto nothing. Consistent with the Gate-3 permission wall.
 * INSTRUMENTATION (STD-003): [TRACE:NAV] rail — ON by default (standing owner instruction).
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import {
  navSections, navRoute, navPermission, navChildrenOf, navNodeForPath, navLabel,
  type NavNode,
} from '../../registry/tileRegistry';

export function AppNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useBusinessContext();
  const [open, setOpen] = useState(false);

  // A section is visible if its own gate passes AND it either has a landing route OR ≥1 visible
  // child. The Admin heading has no route + owner-only children, so this hides it from Staff/Manager
  // (it would otherwise open onto nothing).
  const childVisible = (section: NavNode) =>
    navChildrenOf(section.key).some((c) => can(navPermission(c)));
  const isVisible = (section: NavNode) =>
    can(navPermission(section)) && (navRoute(section) !== null || childVisible(section));

  // Where a section link goes: its own route, else the first visible child's route.
  const targetOf = (section: NavNode): string | null => {
    const own = navRoute(section);
    if (own) return own;
    const child = navChildrenOf(section.key).find((c) => can(navPermission(c)) && navRoute(c));
    return child ? navRoute(child) : null;
  };

  const sections = navSections().filter(isVisible);
  const activeSection = navNodeForPath(location.pathname)?.section ?? null;

  // [TRACE:NAV] which top-level sections the active session can see (ON by default, STD-003).
  console.log('[TRACE:NAV] rail', {
    visibleSections: sections.map((s) => s.key),
    activeSection,
  });

  const go = (section: NavNode) => {
    const t = targetOf(section);
    setOpen(false);
    if (t) navigate(t);
  };

  const renderLink = (section: NavNode) => (
    <button
      key={section.key}
      className="appnav-link"
      aria-current={section.section === activeSection ? 'page' : undefined}
      onClick={() => go(section)}
    >
      {navLabel(section)}
    </button>
  );

  return (
    <>
      {/* Hamburger (narrow screens) */}
      <button
        className="appnav-toggle"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Menu size={18} />
      </button>

      {/* Inline rail (wide screens) */}
      <div className="appnav-rail">
        {sections.map(renderLink)}
      </div>

      {/* Drawer (narrow screens — toggled by the hamburger) */}
      {open && (
        <div className="appnav-drawer" role="menu">
          {sections.map(renderLink)}
        </div>
      )}
    </>
  );
}
