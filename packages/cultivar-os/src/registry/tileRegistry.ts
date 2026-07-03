/**
 * tileRegistry.ts — THE SINGLE TILE REGISTRY (MB_D-012).
 *
 * PURPOSE:      One declared source for every tile/surface in TRACE. Dashboard, Settings, Admin,
 *               the (future) role-config UI, and the (future) marketplace ALL read this — no
 *               surface keeps its own hardcoded tile list. Replaces the three drifting lists that
 *               used to define the dashboard grid:
 *                 - MODULE_META  (useModules.ts) — icon/color/label
 *                 - MODULE_ORDER (useModules.ts) — order
 *                 - Dashboard handleEnable/handleNavigate switch statements — routing
 * DEPENDENCIES: lucide-react icons (render metadata lives in code — see "Why code, not a DB
 *               table" below); the financial permission constants (financialPermissions.ts).
 * OUTPUTS:      TILE_REGISTRY (the catalog) + pure selectors (tilesForPlacement, tileByKey,
 *               registryPermissions, dashboardTiles, dashboardTilesForVerticals,
 *               verticalsForBusinessType). NO React, NO data fetching.
 *
 * ── Why this is CODE, not a DB table (registry-home decision, 2026-06-23) ──
 * The registry must carry, per entry, an ICON (a React component) and a ROUTE/handler — neither
 * can live in a Postgres row. If the catalog lived in the `modules` table, a parallel code map
 * for icon+route would be UNAVOIDABLE → the exact three-list drift we are killing would return,
 * split across DB + code. Holding metadata + icon + route + permission in ONE code file is the
 * only home where "one source" is literally true. It is also version-controlled (no live-only
 * schema drift — tech-debt #39's class) and keeps `required_permission` OUT of casually-editable
 * DB rows (a wrong financial permission = a moat leak). Per-tenant ENABLEMENT state stays where it
 * belongs — the `business_modules` table (enabled/configured/config) — and is overlaid onto the
 * registry at read time (useModules). Catalog = registry; tenant state = business_modules.
 *
 * ── One registry, many verticals (2026-06-23) ──
 * `vertical` (scope) lets ONE shared registry serve a generalist, a nursery, and an auto shop from
 * the SAME code — a business's live dashboard = its vertical's tiles + all `general` tiles, by
 * DATA not forks. It is also the bridge to Ignition reconnection: an Ignition-derived tile (VIN,
 * DTC, compliance-waiver) lives in this one registry tagged `ignition` and simply does NOT surface
 * for a nursery — tag → enable, not rebuild.
 *
 * ── Adjustability contract ──
 * label · group · kind · placement · nav_eligible · status · vertical are intended to be ADJUSTED
 * in-flight — edit the field, done, every surface follows. The EXCEPTION is `required_permission`:
 * it is the security gate, LOCKED to the ratified values. A wrong financial permission silently
 * leaks the cost/revenue moat — do NOT casual-adjust it.
 */
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  QrCode, Truck, Calculator, HandCoins, Boxes, Camera, Receipt, Wrench, Share2,
  AlertTriangle, BarChart2, DollarSign, Sprout, TrendingUp,
  BookOpen, Building2, Percent, Calculator as CostCalc, Hammer, Users,
  ShoppingBag, Leaf, Plus, BadgeCheck, MessageCircle, CalendarClock,
} from 'lucide-react';

// ── kinds & axes ──────────────────────────────────────────────────────────────
// kind: how the surface behaves —
//   action  = tap-and-done
//   readout = a number that LEAKS data by rendering (gate on what it exposes)
//   context = a workspace you enter and operate inside (takes the screen)
export type TileKind = 'action' | 'readout' | 'context';
// placement DEFAULTS to settings/admin; `dashboard` is the earned exception. 'TBD' = undecided.
export type TilePlacement = 'dashboard' | 'settings' | 'admin' | 'TBD';
export type TileStatus = 'live' | 'planned';

// vertical (scope): which kind of business a tile belongs to.
//   general  — every business gets it (the shared platform spine: costs, assets, receipts, PMI,
//              inventory, delivery, social, QB, settings, identity). DEFAULT home — verticalize
//              ONLY what is genuinely vertical-specific.
//   cultivar — nursery-specific (plant profile, QR-plant-checkout, addons) — registered when those
//              surfaces enter the registry.
//   ignition — auto/diesel-specific (VIN/DTC decode, compliance/legal waiver, tooling/custody,
//              estimate-gen, vendor/procurement, AI invoice audit) — RESERVED for reconnection.
//   conduit/kinna — future verticals (HVAC/electrical, nonprofit).
export type TileVertical = 'general' | 'cultivar' | 'ignition' | 'conduit' | 'kinna';
/** Every vertical the registry knows about (single set; verify-universals asserts membership). */
export const KNOWN_VERTICALS: TileVertical[] = ['general', 'cultivar', 'ignition', 'conduit', 'kinna'];

export interface TileEntry {
  key: string;
  label: string;
  group: string;
  /** Scope — which business kind this tile belongs to. `general` = every business. */
  vertical: TileVertical;
  kind: TileKind;
  placement: TilePlacement;
  /** Can be pinned to the optional per-business nav bar (the nav surface itself is PLANNED). */
  nav_eligible: boolean;
  /**
   * THE security gate — LOCKED to the ratified values. A permission string the role must hold,
   * OR the literal 'owner-only' (owner-exclusive). placement & permission are INDEPENDENT: a
   * dashboard tile renders only if placement==dashboard AND the role holds required_permission.
   */
  required_permission: string;
  status: TileStatus;
  /** Another tile key this one depends on (capability ordering), or null. */
  depends_on: string | null;

  // ── render + wiring (code-only — the reason the registry is code, not a DB row) ──
  icon: ComponentType<LucideProps>;
  color: string;
  bg: string;
  /** Navigation target for a live action/context surface. */
  route?: string;
  /** business_modules.module_key for the per-tenant enablement overlay (active/available state). */
  module_key?: string;
  /** Provisional notes (e.g. an undecided permission on a planned entry, or a known UNDECIDED). */
  note?: string;
}

const DASH_BG = '#1e293b'; // dashboard tile icon-box background (dark slate, established look)

// ════════════════════════════════════════════════════════════════════════════════
// THE REGISTRY — ratified seed (2026-06-23). placement/kind/nav/label/status/vertical are
// adjustable fields; required_permission is the locked security gate. Every current entry is
// `general` (the shared spine) — Cultivar/Ignition tag the thin vertical-specific layer on top.
// ════════════════════════════════════════════════════════════════════════════════
export const TILE_REGISTRY: TileEntry[] = [
  // ── Dashboard — actions & contexts (live) ──────────────────────────────────────
  // Label 'Orders' (was 'QR Checkout') — QR is the capture METHOD, not the surface's name (Nav C2).
  { key: 'qr_checkout',      vertical: 'general', label: 'Orders',                   group: 'checkout',  kind: 'action',  placement: 'dashboard', nav_eligible: true,  required_permission: 'qr_checkout',        status: 'live',    depends_on: null,
    icon: QrCode,      color: '#34d399', bg: DASH_BG, route: '/orders',            module_key: 'qr_checkout' },
  // Delivery = ONE evolving context entry. Live capability inside it = delivery_routing.
  // `opportunities` (Regina surfacing) is a PLANNED capability inside this same context.
  // Driver-handoff mechanism = UNDECIDED (do NOT build — see note).
  { key: 'delivery',         vertical: 'general', label: 'Delivery',                  group: 'fulfilment', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_deliveries',  status: 'live',    depends_on: null,
    icon: Truck,       color: '#22d3ee', bg: DASH_BG, route: '/delivery-schedule', module_key: 'delivery_routing', note: 'driver-handoff mechanism UNDECIDED' },
  { key: 'operating_costs',  vertical: 'general', label: 'Operating Costs',           group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: HandCoins,   color: '#fbbf24', bg: DASH_BG, route: '/operating-costs' },
  { key: 'assets',           vertical: 'general', label: 'Assets',                    group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Building2,   color: '#a78bfa', bg: DASH_BG, route: '/assets' },
  // Inventory is TWO siblings sharing the inventory data model — NOT a collapse.
  { key: 'inventory_manual', vertical: 'general', label: 'Inventory (manual)',        group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Boxes,       color: '#f472b6', bg: DASH_BG, route: '/inventory' },
  { key: 'inventory_intake', vertical: 'general', label: 'Inventory Intake (mobile)', group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Camera,      color: '#fb7185', bg: DASH_BG, route: '/inventory',         module_key: 'inventory_intake' },
  { key: 'receipt_keeper',   vertical: 'general', label: 'Receipts',                  group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Receipt,     color: '#38bdf8', bg: DASH_BG, route: '/receipts' },
  { key: 'pmi',              vertical: 'general', label: 'PMI',                       group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Wrench,      color: '#94a3b8', bg: DASH_BG, route: '/pmi' },
  { key: 'social_media',     vertical: 'general', label: 'Social',                    group: 'growth',    kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_campaigns',   status: 'live',    depends_on: null,
    icon: Share2,      color: '#f472b6', bg: DASH_BG, route: '/social/setup',      module_key: 'social_media' },
  // Customers ROSTER (3rd DataSheet consumer). OWNER-ONLY — matches customers_business_owner RLS
  // (owner-only, FOR ALL) so the nav never opens onto an empty RLS wall for staff (Gate-3 lesson).
  { key: 'customers',        vertical: 'general', label: 'Customers',                 group: 'crm',       kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'owner-only',         status: 'live',    depends_on: null,
    icon: Users,       color: '#818cf8', bg: DASH_BG, route: '/customers' },

  // ── Dashboard — readouts (live). A readout LEAKS data by rendering → gate on what it exposes.
  { key: 'leakage_alert',          vertical: 'general', label: 'Leakage alert',     group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_orders',    status: 'live', depends_on: null,
    icon: AlertTriangle, color: '#f59e0b', bg: DASH_BG },
  { key: 'metric_plants',          vertical: 'general', label: 'Plants tracked',    group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_dashboard', status: 'live', depends_on: null,
    icon: Sprout,        color: '#4ade80', bg: DASH_BG },
  { key: 'metric_inventory_value', vertical: 'general', label: 'Inventory value',   group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_costs',     status: 'live', depends_on: null,
    icon: DollarSign,    color: '#2dd4bf', bg: DASH_BG },
  // GATED (was ungated) — revenue is moat-class; locked to view_costs.
  { key: 'metric_today_sales',     vertical: 'general', label: "Today's sales",     group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_costs',     status: 'live', depends_on: null,
    icon: TrendingUp,    color: '#34d399', bg: DASH_BG },
  { key: 'metric_installs',        vertical: 'general', label: 'Installs this week', group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_dashboard', status: 'live', depends_on: null,
    icon: BarChart2,     color: '#818cf8', bg: DASH_BG },
  { key: 'qb_status',              vertical: 'general', label: 'QuickBooks status', group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'manage_settings', status: 'live', depends_on: null,
    icon: BadgeCheck,    color: '#60a5fa', bg: DASH_BG },

  // ── Settings (config) ───────────────────────────────────────────────────────────
  { key: 'qb_invoicing',     vertical: 'general', label: 'QuickBooks',                group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: BookOpen,    color: '#60a5fa', bg: DASH_BG, route: '/settings', module_key: 'qb_invoicing' },
  { key: 'business_profile', vertical: 'general', label: 'Business Profile',          group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Building2,   color: '#94a3b8', bg: DASH_BG, route: '/settings' },
  { key: 'tax_rate',         vertical: 'general', label: 'Tax Rate',                  group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Percent,     color: '#fbbf24', bg: DASH_BG, route: '/settings' },
  { key: 'cost_config',      vertical: 'general', label: 'Cost-to-Produce Settings',  group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'view_costs',      status: 'live',    depends_on: null,
    icon: CostCalc,    color: '#2dd4bf', bg: DASH_BG, route: '/settings' },
  { key: 'install_price',    vertical: 'general', label: 'Install Price',             group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Hammer,      color: '#fb923c', bg: DASH_BG, route: '/settings' },
  { key: 'team_management',  vertical: 'general', label: 'Team',                      group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Users,       color: '#818cf8', bg: DASH_BG, route: '/settings' },
  { key: 'online_shop',      vertical: 'general', label: 'Online Shop',               group: 'settings', kind: 'context', placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'planned', depends_on: null,
    icon: ShoppingBag, color: '#c084fc', bg: DASH_BG },
  { key: 'contractor_tiers', vertical: 'general', label: 'Contractors',               group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'planned', depends_on: null,
    icon: Users,       color: '#fb923c', bg: DASH_BG },
  { key: 'seasonal_module',  vertical: 'general', label: 'Seasonal',                  group: 'settings', kind: 'context', placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'planned', depends_on: null,
    icon: Leaf,        color: '#4ade80', bg: DASH_BG },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  { key: 'add_business',     vertical: 'general', label: 'Add Business',              group: 'admin',    kind: 'action',  placement: 'admin',    nav_eligible: false, required_permission: 'owner-only',       status: 'live',    depends_on: null,
    icon: Plus,        color: '#34d399', bg: DASH_BG, route: '/add-business' },
  // Cost-to-Produce — MOVED Dashboard→Admin + view_costs→owner-only (Nav C2 access change, ratified
  // 2026-06-24). Owner-default + delegable is a future Role-Machine concern; today the gate is
  // owner-only, so a Staff/Manager session sees it nowhere (nav AND route, see router.tsx /costs).
  { key: 'cost_to_produce',  vertical: 'general', label: 'Cost-to-Produce',           group: 'admin',    kind: 'context', placement: 'admin',    nav_eligible: false, required_permission: 'owner-only',       status: 'live',    depends_on: null,
    icon: Calculator,  color: '#2dd4bf', bg: DASH_BG, route: '/costs',             module_key: 'cost_to_produce' },

  // ── Planned (greyed) — forward declarations. Permissions marked PROVISIONAL where the
  //    seed did not pin one (adjustable); the seed-pinned ones are locked like all others.
  { key: 'services',         vertical: 'general', label: 'Services',                  group: 'planned',  kind: 'context', placement: 'TBD',       nav_eligible: false, required_permission: 'view_dashboard',   status: 'planned', depends_on: null,
    icon: Wrench,      color: '#94a3b8', bg: DASH_BG, note: 'EDITOR ALREADY LIVE — the service_offerings CRUD (transport / add-ons incl. netting companion / other services) renders in Settings.tsx:470, reachable only via /settings/all, NOT /admin. status:planned/placement:TBD refer to a first-class Services TILE/destination (not yet placed — next build), NOT to the editor. permission PROVISIONAL. See tech-debt #47.' },
  { key: 'opportunities',    vertical: 'general', label: 'Opportunities',             group: 'planned',  kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_orders',     status: 'planned', depends_on: 'services',
    icon: TrendingUp,  color: '#22d3ee', bg: DASH_BG, note: 'Regina surfacing; permission PROVISIONAL' },
  { key: 'followup_engine',  vertical: 'general', label: 'Follow-Up',                 group: 'planned',  kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_customers', status: 'planned', depends_on: null,
    icon: MessageCircle, color: '#fbbf24', bg: DASH_BG },
  { key: 'business_insights', vertical: 'general', label: 'Insights',                 group: 'planned',  kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_reports',    status: 'planned', depends_on: null,
    icon: BarChart2,   color: '#818cf8', bg: DASH_BG },
  { key: 'campaigns',        vertical: 'general', label: 'Campaign Scheduler',        group: 'planned',  kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_campaigns', status: 'planned', depends_on: 'social_media',
    icon: CalendarClock, color: '#f472b6', bg: DASH_BG, route: '/campaigns' },
];

// ════════════════════════════════════════════════════════════════════════════════
// VERTICAL SCOPE — a business's live dashboard = its vertical's tiles + all `general` tiles.
// ════════════════════════════════════════════════════════════════════════════════

/**
 * The business's vertical(s) → which registry verticals it enables. A business ALWAYS gets
 * `general` (the shared spine) plus its own vertical layer. The business's vertical is read from
 * `businesses.business_type` (the column that already exists — TRACE='general', LAWNS='nursery';
 * see verticalsForBusinessType). Unknown/absent business_type fails SAFE to `general` only —
 * never hides the shared spine, never surfaces a wrong vertical's tiles (AC-3).
 */
const BUSINESS_TYPE_VERTICALS: Record<string, TileVertical[]> = {
  general: ['general'],
  nursery: ['general', 'cultivar'],
  // forward (reconnection): an auto/diesel shop → general + ignition
  diesel:  ['general', 'ignition'],
  auto:    ['general', 'ignition'],
};

/**
 * Map a `businesses.business_type` value to the registry verticals it enables. DEFAULT-SAFE:
 * any unrecognized/null type → `['general']` (the shared spine only).
 */
export function verticalsForBusinessType(businessType: string | null | undefined): TileVertical[] {
  if (!businessType) return ['general'];
  return BUSINESS_TYPE_VERTICALS[businessType] ?? ['general'];
}

/** True if a tile belongs to any of the business's active verticals. */
export function isTileInVerticals(tile: TileEntry, verticals: TileVertical[]): boolean {
  return verticals.includes(tile.vertical);
}

// ════════════════════════════════════════════════════════════════════════════════
// SELECTORS — every surface (dashboard / settings / admin / role-config / marketplace)
// reads the registry through THESE. No surface re-declares the catalog.
// ════════════════════════════════════════════════════════════════════════════════

/** Every registered tile (role-config + marketplace read this — ALL entries, all verticals). */
export function allTiles(): TileEntry[] {
  return TILE_REGISTRY;
}

/** Tiles for a placement, in registry (declared) order. */
export function tilesForPlacement(placement: TilePlacement): TileEntry[] {
  return TILE_REGISTRY.filter((t) => t.placement === placement);
}

/** The dashboard GRID tiles (tappable surfaces — action|context, not readouts). */
export function dashboardTiles(): TileEntry[] {
  return TILE_REGISTRY.filter((t) => t.placement === 'dashboard' && t.kind !== 'readout');
}

/**
 * The dashboard GRID tiles scoped to a business's verticals — its vertical layer + all `general`.
 * This is what makes ONE registry serve a generalist, a nursery, and an auto shop from one source.
 */
export function dashboardTilesForVerticals(verticals: TileVertical[]): TileEntry[] {
  return dashboardTiles().filter((t) => isTileInVerticals(t, verticals));
}

/** The dashboard READOUTS (numbers that leak data by rendering). */
export function dashboardReadouts(): TileEntry[] {
  return TILE_REGISTRY.filter((t) => t.placement === 'dashboard' && t.kind === 'readout');
}

/** A single tile by key. */
export function tileByKey(key: string): TileEntry | undefined {
  return TILE_REGISTRY.find((t) => t.key === key);
}

/** The required_permission for a tile key (used to gate readouts at the render layer). */
export function requiredPermissionFor(key: string): string | undefined {
  return tileByKey(key)?.required_permission;
}

/**
 * Every distinct required_permission declared across the registry. THIS is what makes a new
 * tile's permission selectable in the (future) role-builder with NO separate edit: the builder
 * enumerates registryPermissions() — registering a tile with a new permission surfaces it here
 * automatically. (verify-universals acceptance (e).)
 */
export function registryPermissions(): string[] {
  return [...new Set(TILE_REGISTRY.map((t) => t.required_permission))].sort();
}

// ════════════════════════════════════════════════════════════════════════════════
// NAVIGATION IA — Model C2 (ratified by David 2026-06-24).
//
// The navigation hierarchy is registry DATA living in THIS one module. The breadcrumb component
// AND the hamburger/nav-rail BOTH read it — there is NO parallel nav-config list that could drift
// (the exact three-list failure already killed for the tile grid). A nav node that IS a registry
// tile references it by `tileKey` and INHERITS the tile's label/route/required_permission, so the
// security gate cannot diverge from the tile catalog. The handful of nav surfaces that are NOT
// dashboard tiles — the three section roots (Dashboard/Settings/Admin), the /settings root, /roles,
// the /deliveries "Route a day" sub-view, and the /campaigns/:id detail — are declared inline here:
// the irreducible minimum the IA needs that the tile entries do not already carry. (Reported at
// build time: TileEntry alone cannot carry the full IA because several IA nodes are not tiles —
// hence this companion tree in the SAME source module, referencing tiles by key, not re-declaring.)
// ════════════════════════════════════════════════════════════════════════════════

export type NavSection = 'dashboard' | 'settings' | 'admin';

export interface NavNode {
  /** Unique nav key. */
  key: string;
  /** Top-level section this node lives under (drives the hamburger/nav-rail grouping). */
  section: NavSection;
  /** Parent nav key, or null for a section root. */
  parent: string | null;
  /** If this node IS a registry tile: its key — label/route/required_permission inherit from it. */
  tileKey?: string;
  /** Inline label (non-tile nodes); overrides the tile label when both are present. */
  label?: string;
  /** Inline route (non-tile nodes); `null` = a non-linking heading (e.g. the Admin section). */
  route?: string | null;
  /** Inline permission (non-tile nodes); falls back to the tile's permission, then 'view_dashboard'. */
  required_permission?: string;
  /** Concrete route PATTERN used to match the active pathname (handles params/aliases, e.g.
   *  '/campaigns/:id', '/deliveries'). Defaults to the resolved route. */
  matchRoute?: string;
  /** Explicit breadcrumb ANCESTOR keys (root → parent), used ONLY where the ratified path deviates
   *  from the parent walk — the /campaigns/:id collapse that drops "Social". Omit to walk `parent`. */
  breadcrumb?: string[];
}

export const NAV_IA: NavNode[] = [
  // ── Top-level sections (the hamburger / nav-rail) ──
  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'Dashboard', route: '/dashboard', required_permission: 'view_dashboard' },
  // SETTINGS = USER-level (what a person changes about THEMSELVES). NOW a real destination: clicking
  // it lands on a SHORT index (/settings → SettingsIndex), NOT the long business-settings wall
  // (direct-access over scroll, D-21). Shown to EVERY authenticated user (view_dashboard); its child
  // is Your Profile. Business administration lives in the Admin section (RULE 1, ledger #50).
  { key: 'sec_settings',  section: 'settings',  parent: null, label: 'Settings',  route: '/settings', required_permission: 'view_dashboard' },
  // ADMIN = BUSINESS-ENTITY administration (business-level config). NOW a clickable destination
  // (/admin → AdminIndex, a section index), gated to manage_settings so Staff never sees it (its
  // children are all owner/manage_settings-scoped anyway). Owner short-circuits manage_settings.
  { key: 'sec_admin',     section: 'admin',     parent: null, label: 'Admin',     route: '/admin', required_permission: 'manage_settings' },

  // ── Dashboard branch ──
  { key: 'nav_orders',          section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'qr_checkout' },
  { key: 'nav_delivery',        section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'delivery' },
  { key: 'nav_delivery_route',  section: 'dashboard', parent: 'nav_delivery',        label: 'Route', route: '/deliveries', matchRoute: '/deliveries', required_permission: 'manage_deliveries' },
  { key: 'nav_operating_costs', section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'operating_costs' },
  { key: 'nav_assets',          section: 'dashboard', parent: 'nav_operating_costs', tileKey: 'assets' },
  // /inventory is served by two tiles (manual + intake); the nav node owns the route once, label 'Inventory'.
  { key: 'nav_inventory',       section: 'dashboard', parent: 'nav_operating_costs', label: 'Inventory', route: '/inventory', required_permission: 'view_costs' },
  { key: 'nav_receipts',        section: 'dashboard', parent: 'nav_operating_costs', tileKey: 'receipt_keeper' },
  { key: 'nav_pmi',             section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'pmi' },
  { key: 'nav_social',          section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'social_media' },
  // Customers roster — standalone OWNER-ONLY nav node (inherits owner-only from the tile). Under the
  // Dashboard section (operational surface the owner works with), NOT Operating Costs (view_costs).
  { key: 'nav_customers',       section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'customers' },
  { key: 'nav_campaigns',       section: 'dashboard', parent: 'nav_social',          tileKey: 'campaigns', label: 'Campaigns', route: '/campaigns' },
  // Campaign detail — COLLAPSED breadcrumb (Dashboard / Campaigns / Campaign): drops "Social" so the
  // leaf stays 3-deep (ratified). parent stays nav_campaigns for section grouping; breadcrumb override
  // controls the displayed trail.
  { key: 'nav_campaign_detail', section: 'dashboard', parent: 'nav_campaigns',       label: 'Campaign', route: '/campaigns/:id', matchRoute: '/campaigns/:id', required_permission: 'manage_campaigns', breadcrumb: ['sec_dashboard', 'nav_campaigns'] },
  // Help — reached from the Dashboard header's Help button, so the IA parent is Dashboard
  // (breadcrumb: Dashboard / Help). view_dashboard = visible to every authenticated session. The
  // /help page is PUBLIC (prospects can read it) so it mounts the nav chrome itself rather than via
  // AppLayout — this node supplies its breadcrumb trail + active-section highlight either way.
  { key: 'nav_help',            section: 'dashboard', parent: 'sec_dashboard',        label: 'Help', route: '/help', required_permission: 'view_dashboard' },

  // ── Settings branch (USER-level only) ──
  // Your Profile — the personal identity surface (name/phone/email). PRIMARY entry is the header
  // avatar menu; this node is the secondary nav entry. view_dashboard = reachable by EVERY
  // authenticated role (incl. STAFF — every person can edit their own profile). Breadcrumb:
  // Settings / Your Profile. (Roles & Permissions MOVED to Admin — it is business-level, ledger #50.)
  { key: 'nav_profile',         section: 'settings',  parent: 'sec_settings',        label: 'Your Profile', route: '/profile', required_permission: 'view_dashboard' },
  // The full business-settings page (Services / Team / tax rate / install price / cost config) is no
  // longer the default Settings landing — it is a deliberate destination reached from the Settings
  // index. Declared here so it still gets a breadcrumb ("Settings / All settings"); EXCLUDED from the
  // nav drawer (NAV_EXCLUDE in AppNav) so it doesn't clutter the menu — same pattern as nav_help.
  { key: 'nav_all_settings',    section: 'settings',  parent: 'sec_settings',        label: 'All settings', route: '/settings/all', matchRoute: '/settings/all', required_permission: 'manage_settings' },

  // ── Admin branch (BUSINESS administration) — each a DIRECT menu destination (RULE 2a) ──
  // Business Profile + Accounting are section-isolated views of the /settings page (/settings/:section)
  // so the owner lands on JUST that section, no long scroll. Add Business + Cost-to-Produce stay
  // owner-only (account action / cost moat — D-009); the rest are manage_settings (owner-default,
  // delegable to a manager via /roles). Staff holds neither → sees no Admin item.
  { key: 'nav_add_business',     section: 'admin',     parent: 'sec_admin',           tileKey: 'add_business' },
  { key: 'nav_business_profile', section: 'admin',     parent: 'sec_admin',           label: 'Business Profile', route: '/settings/business',    matchRoute: '/settings/business',    required_permission: 'manage_settings' },
  { key: 'nav_accounting',       section: 'admin',     parent: 'sec_admin',           label: 'Accounting',       route: '/settings/accounting', matchRoute: '/settings/accounting', required_permission: 'manage_settings' },
  { key: 'nav_roles',            section: 'admin',     parent: 'sec_admin',           label: 'Roles & Permissions', route: '/roles', required_permission: 'manage_settings' },
  { key: 'nav_cost_to_produce',  section: 'admin',     parent: 'sec_admin',           tileKey: 'cost_to_produce' },
];

/** A single nav node by key. */
export function navByKey(key: string): NavNode | undefined {
  return NAV_IA.find((n) => n.key === key);
}

/** Display label for a nav node (inline label wins, else the referenced tile's, else the key). */
export function navLabel(node: NavNode): string {
  if (node.label) return node.label;
  if (node.tileKey) return tileByKey(node.tileKey)?.label ?? node.key;
  return node.key;
}

/** Resolved route for a nav node, or null when it is a non-linking heading. */
export function navRoute(node: NavNode): string | null {
  if (node.route !== undefined) return node.route;          // inline route (may be null)
  if (node.tileKey) return tileByKey(node.tileKey)?.route ?? null;
  return null;
}

/** Permission required to SEE a nav node (inline wins, else the tile's, else view_dashboard). */
export function navPermission(node: NavNode): string {
  if (node.required_permission) return node.required_permission;
  if (node.tileKey) return tileByKey(node.tileKey)?.required_permission ?? 'view_dashboard';
  return 'view_dashboard';
}

/** Match a route PATTERN ('/campaigns/:id') against a concrete pathname. */
function routeMatches(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  const pp = pattern.split('/');
  const xp = pathname.split('/');
  if (pp.length !== xp.length) return false;
  return pp.every((seg, i) => seg.startsWith(':') || seg === xp[i]);
}

/** The nav node whose route matches a pathname — most-specific (longest) pattern wins. */
export function navNodeForPath(pathname: string): NavNode | null {
  const candidates = NAV_IA
    .map((n) => ({ n, pat: n.matchRoute ?? navRoute(n) ?? '' }))
    .filter((c) => c.pat !== '' && routeMatches(c.pat, pathname))
    .sort((a, b) => b.pat.split('/').length - a.pat.split('/').length);
  return candidates[0]?.n ?? null;
}

/** One breadcrumb segment. The current page has route=null (never links). */
export interface Crumb { label: string; route: string | null; current: boolean; }

/**
 * The breadcrumb trail for a pathname, root → current. Ancestors come from the explicit
 * `breadcrumb` override when present (the campaign-detail collapse), otherwise from walking
 * `parent`. The current node is appended as a non-linking leaf. Empty when no node matches.
 */
export function breadcrumbForPath(pathname: string): Crumb[] {
  const node = navNodeForPath(pathname);
  if (!node) return [];
  let ancestorKeys: string[];
  if (node.breadcrumb) {
    ancestorKeys = node.breadcrumb;
  } else {
    ancestorKeys = [];
    let p = node.parent;
    while (p) {
      ancestorKeys.unshift(p);
      p = navByKey(p)?.parent ?? null;
    }
  }
  const crumbs: Crumb[] = ancestorKeys
    .map((k) => navByKey(k))
    .filter((n): n is NavNode => !!n)
    .map((n) => ({ label: navLabel(n), route: navRoute(n), current: false }));
  crumbs.push({ label: navLabel(node), route: null, current: true });
  return crumbs;
}

/** The top-level nav sections (Dashboard · Settings · Admin), in declared order. */
export function navSections(): NavNode[] {
  return NAV_IA.filter((n) => n.parent === null);
}

/** Direct children of a nav node (used to gate the Admin heading on "can see ≥1 child"). */
export function navChildrenOf(navKey: string): NavNode[] {
  return NAV_IA.filter((n) => n.parent === navKey);
}
