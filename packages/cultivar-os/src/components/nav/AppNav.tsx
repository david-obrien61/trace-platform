/**
 * AppNav — the single navigation menu (hamburger → tree drawer), Nav C2.
 *
 * PURPOSE:      Surface the platform's REAL top-level structure so the owner lands oriented, not
 *               "lost on entry." Reads the ONE IA (NAV_IA in tileRegistry) and renders it as a
 *               hierarchical menu: Dashboard (home) + the dashboard branch's surfaces PROMOTED to
 *               top-level peers (Orders · Delivery · Operating Costs · PMI · Social) — because the
 *               owner thinks of those as primary destinations, not buried under one "Dashboard"
 *               link — each EXPANDED to its sub-pages (Delivery → Route; Operating Costs →
 *               Assets/Inventory/Receipts; Social → Campaigns), then Admin and Settings with their
 *               children. This replaces the old 3-item rail (Dashboard · Settings · Admin) that
 *               collapsed the entire dashboard branch out of sight, leaving Delivery's Route
 *               sub-page un-findable. The hamburger is ALWAYS visible (every width) in the sticky
 *               chrome bar — a 3-level structure reads as a vertical tree, so one drawer is the
 *               single nav surface on phone and desktop alike, and the structure is one tap away.
 * DEPENDENCIES: tileRegistry — navSections/navChildrenOf/navRoute/navPermission/navLabel/navNodeForPath
 *               (the ONE IA source; no parallel nav list) · useBusinessContext.can (the permission
 *               chokepoint — every node is gated) · react-router useNavigate/useLocation.
 * OUTPUTS:      A hamburger button + a drawer rendering the visible IA tree. A node renders only when
 *               the session can see it AND it links somewhere OR has ≥1 visible child (so a
 *               landing-less section like Admin never opens onto nothing for Staff/Manager). Help is
 *               omitted here — it lives in the header account menu (avoids re-creating duplicate nav).
 * INSTRUMENTATION (STD-003): [TRACE:NAV] menu — ON by default (standing owner instruction).
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useBusinessContext } from '@trace/shared/context';
import { requirementText } from '@trace/shared/components/SurfaceState';
import {
  navSections, navChildrenOf, navRoute, navPermission, navLabel, navNodeForPath,
  type NavNode,
} from '../../registry/tileRegistry';

// Help is reachable from the header account menu; keep it out of the structural nav so it doesn't
// duplicate a surface that already has a home (the duplicate-nav class we removed for Settings).
// nav_all_settings (the full business-settings page) is reached from the Settings index, not the
// drawer — declared in the IA only for its breadcrumb, excluded here to keep the menu lean.
const NAV_EXCLUDE = new Set(['nav_help', 'nav_all_settings']);

export function AppNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useBusinessContext();
  const [open, setOpen] = useState(false);

  const canSee = (n: NavNode) => can(navPermission(n));

  // 🔴 THE MENU SHOWS EVERY ITEM (ruling 2026-07-30 — "MENU shows every item at every width").
  // It used to FILTER OUT anything the session could not reach, which made the nav the first of
  // the silent refusals: the feature did not look forbidden, it looked NON-EXISTENT. Someone who
  // cannot see a menu item does not ask for access to it — they conclude the platform cannot do
  // the thing, and either work around it or ask for a role that carries everything.
  //
  // Now the item RENDERS, marked, and still navigates — landing on the route's own
  // PageWithoutAccess, which names the permission and who grants it. Nav and route tell ONE story.
  // The width half of the ruling was already satisfied: this nav has no breakpoint by design
  // (4c6308a), so it lands identically on phone and desktop.
  const isRefused = (n: NavNode) => !canSee(n);
  // A node's children that link somewhere. NO LONGER permission-filtered — refused ones render
  // marked rather than vanishing.
  const linkChildren = (n: NavNode): NavNode[] =>
    navChildrenOf(n.key).filter((c) => !NAV_EXCLUDE.has(c.key) && navRoute(c) !== null);
  // A node is shown when it links somewhere OR has ≥1 child that does. Permission no longer
  // decides EXISTENCE — only presentation.
  const isVisible = (n: NavNode): boolean =>
    !NAV_EXCLUDE.has(n.key) && (navRoute(n) !== null || linkChildren(n).length > 0);

  const sections = navSections();
  const dashboard = sections.find((s) => s.section === 'dashboard') ?? null;
  const settings  = sections.find((s) => s.section === 'settings')  ?? null;
  const admin     = sections.find((s) => s.section === 'admin')     ?? null;

  // Promote the dashboard branch's surfaces to top-level peers of the Dashboard home. Their own
  // children (Route, Assets/Inventory/Receipts, Campaigns) render as indented sub-links.
  const dashSurfaces = dashboard ? navChildrenOf(dashboard.key).filter(isVisible) : [];

  // A refused item still navigates — the destination explains itself. `title` carries the reason
  // for a pointer user; the lock glyph carries it for everyone else.
  const refusedProps = (n: NavNode) => (isRefused(n)
    ? { style: { opacity: 0.55 }, title: requirementText(navPermission(n)), 'data-surface-state': 'not-permitted' }
    : {});

  const activeNode = navNodeForPath(location.pathname);
  const activeKey = activeNode?.key ?? null;

  // Route-null section nodes (e.g. ADMIN) are rendered as NON-INTERACTIVE group-header labels, not
  // links — surfaced here so it's explicit which nodes are dividers vs navigable.
  const groupHeaders = [dashboard, ...dashSurfaces, admin, settings]
    .filter((n): n is NavNode => !!n && isVisible(n) && navRoute(n) === null)
    .map((n) => n.key);

  // [TRACE:NAV] the structure the active session can see (ON by default, STD-003).
  console.log('[TRACE:NAV] menu', {
    dashboardHome: dashboard && isVisible(dashboard) ? dashboard.key : null,
    surfaces: dashSurfaces.map((s) => ({ key: s.key, refused: isRefused(s), subs: linkChildren(s).map((c) => c.key) })),
    // NAMED so the trail shows what the session is being SHOWN-BUT-REFUSED, not only what it holds.
    refusedItems: [dashboard, ...dashSurfaces, admin, settings]
      .filter((n): n is NavNode => !!n && isVisible(n) && isRefused(n)).map((n) => n.key),
    admin: admin && isVisible(admin) ? linkChildren(admin).map((c) => c.key) : null,
    settings: settings && isVisible(settings)
      ? { key: settings.key, subs: linkChildren(settings).map((c) => c.key) }
      : null,
    groupHeaders, // rendered as labels (no onClick, no link wrapper), NOT dead links
    activeKey,
  });

  const go = (route: string | null) => {
    setOpen(false);
    if (route) navigate(route);
  };

  // A group: the node as a link (its own route) or a non-linking heading (route:null), then its
  // visible sub-pages as indented sub-links. `homeOnly` renders the node alone (Dashboard home —
  // its surfaces are promoted to siblings, not nested here).
  const renderGroup = (node: NavNode, homeOnly = false) => {
    const route = navRoute(node);
    const subs = homeOnly ? [] : linkChildren(node);
    return (
      <div key={node.key} className="appnav-group">
        {route !== null ? (
          <button
            className="appnav-link"
            aria-current={activeKey === node.key ? 'page' : undefined}
            onClick={() => go(route)}
            {...refusedProps(node)}
          >
            {isRefused(node) && <span aria-hidden style={{ marginRight: 6, opacity: 0.8 }}>🔒</span>}
            {navLabel(node)}
          </button>
        ) : (
          <span className="appnav-heading">{navLabel(node)}</span>
        )}
        {subs.map((c) => (
          <button
            key={c.key}
            className="appnav-link appnav-sublink"
            aria-current={activeKey === c.key ? 'page' : undefined}
            onClick={() => go(navRoute(c))}
            {...refusedProps(c)}
          >
            {isRefused(c) && <span aria-hidden style={{ marginRight: 6, opacity: 0.8 }}>🔒</span>}
            {navLabel(c)}
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Hamburger — always visible; opens the full nav tree. */}
      <button
        className="appnav-toggle"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Menu size={18} />
      </button>

      {open && (
        <>
          {/* click-out backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div className="appnav-drawer" role="menu">
            {/* Dashboard home — standalone (its surfaces are promoted below, not nested here). */}
            {dashboard && isVisible(dashboard) && renderGroup(dashboard, true)}
            {/* Promoted dashboard surfaces, each with its sub-pages. */}
            {dashSurfaces.map((s) => renderGroup(s))}
            {/* Admin — heading + owner-scoped children (renders only if ≥1 child visible). */}
            {admin && isVisible(admin) && renderGroup(admin)}
            {/* Settings + its children (Roles, Your Profile). */}
            {settings && isVisible(settings) && renderGroup(settings)}
          </div>
        </>
      )}
    </>
  );
}
