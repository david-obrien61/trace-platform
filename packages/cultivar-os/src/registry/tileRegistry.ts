/**
 * tileRegistry.ts — THE SINGLE TILE REGISTRY (MB_D-012).
 *
 * PURPOSE:      One declared source for every tile/surface in Cultivar OS. Dashboard,
 *               Settings, Admin, the (future) role-config UI, and the (future) marketplace
 *               ALL read this — no surface keeps its own hardcoded tile list. Replaces the
 *               three drifting lists that used to define the dashboard grid:
 *                 - MODULE_META  (useModules.ts) — icon/color/label
 *                 - MODULE_ORDER (useModules.ts) — order
 *                 - Dashboard handleEnable/handleNavigate switch statements — routing
 * DEPENDENCIES: lucide-react icons (render metadata lives in code — see "Why code, not a DB
 *               table" below); the financial permission constants (financialPermissions.ts).
 * OUTPUTS:      TILE_REGISTRY (the catalog) + pure selectors (tilesForPlacement, tileByKey,
 *               registryPermissions, dashboardTiles). NO React, NO data fetching.
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
 * ── Adjustability contract ──
 * label · group · kind · placement · nav_eligible · status are intended to be ADJUSTED in-flight
 * after seeing the registry run — edit the field, done, every surface follows. The EXCEPTION is
 * `required_permission`: it is the security gate, LOCKED to the ratified values. A wrong financial
 * permission silently leaks the cost/revenue moat — do NOT casual-adjust it.
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

export interface TileEntry {
  key: string;
  label: string;
  group: string;
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
// THE REGISTRY — ratified seed (2026-06-23). Build exactly this. placement/kind/nav/label/
// status are adjustable fields; required_permission is the locked security gate.
// ════════════════════════════════════════════════════════════════════════════════
export const TILE_REGISTRY: TileEntry[] = [
  // ── Dashboard — actions & contexts (live) ──────────────────────────────────────
  { key: 'qr_checkout',      label: 'QR Checkout',               group: 'checkout',  kind: 'action',  placement: 'dashboard', nav_eligible: true,  required_permission: 'qr_checkout',        status: 'live',    depends_on: null,
    icon: QrCode,      color: '#34d399', bg: DASH_BG, route: '/orders',            module_key: 'qr_checkout' },
  // Delivery = ONE evolving context entry. Live capability inside it = delivery_routing.
  // `opportunities` (Regina surfacing) is a PLANNED capability inside this same context.
  // Driver-handoff mechanism = UNDECIDED (do NOT build — see note).
  { key: 'delivery',         label: 'Delivery',                  group: 'fulfilment', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_deliveries',  status: 'live',    depends_on: null,
    icon: Truck,       color: '#22d3ee', bg: DASH_BG, route: '/delivery-schedule', module_key: 'delivery_routing', note: 'driver-handoff mechanism UNDECIDED' },
  { key: 'cost_to_produce',  label: 'Cost-to-Produce',           group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Calculator,  color: '#2dd4bf', bg: DASH_BG, route: '/costs',             module_key: 'cost_to_produce' },
  { key: 'operating_costs',  label: 'Operating Costs',           group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: HandCoins,   color: '#fbbf24', bg: DASH_BG, route: '/operating-costs' },
  { key: 'assets',           label: 'Assets',                    group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Building2,   color: '#a78bfa', bg: DASH_BG, route: '/assets' },
  // Inventory is TWO siblings sharing the inventory data model — NOT a collapse.
  { key: 'inventory_manual', label: 'Inventory (manual)',        group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Boxes,       color: '#f472b6', bg: DASH_BG, route: '/inventory' },
  { key: 'inventory_intake', label: 'Inventory Intake (mobile)', group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Camera,      color: '#fb7185', bg: DASH_BG, route: '/inventory',         module_key: 'inventory_intake' },
  { key: 'receipt_keeper',   label: 'Receipts',                  group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Receipt,     color: '#38bdf8', bg: DASH_BG, route: '/receipts' },
  { key: 'pmi',              label: 'PMI',                       group: 'financial', kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_costs',         status: 'live',    depends_on: null,
    icon: Wrench,      color: '#94a3b8', bg: DASH_BG, route: '/pmi' },
  { key: 'social_media',     label: 'Social',                    group: 'growth',    kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_campaigns',   status: 'live',    depends_on: null,
    icon: Share2,      color: '#f472b6', bg: DASH_BG, route: '/social/setup',      module_key: 'social_media' },

  // ── Dashboard — readouts (live). A readout LEAKS data by rendering → gate on what it exposes.
  { key: 'leakage_alert',          label: 'Leakage alert',     group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_orders',    status: 'live', depends_on: null,
    icon: AlertTriangle, color: '#f59e0b', bg: DASH_BG },
  { key: 'metric_plants',          label: 'Plants tracked',    group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_dashboard', status: 'live', depends_on: null,
    icon: Sprout,        color: '#4ade80', bg: DASH_BG },
  { key: 'metric_inventory_value', label: 'Inventory value',   group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_costs',     status: 'live', depends_on: null,
    icon: DollarSign,    color: '#2dd4bf', bg: DASH_BG },
  // GATED (was ungated) — revenue is moat-class; locked to view_costs.
  { key: 'metric_today_sales',     label: "Today's sales",     group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_costs',     status: 'live', depends_on: null,
    icon: TrendingUp,    color: '#34d399', bg: DASH_BG },
  { key: 'metric_installs',        label: 'Installs this week', group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_dashboard', status: 'live', depends_on: null,
    icon: BarChart2,     color: '#818cf8', bg: DASH_BG },
  { key: 'qb_status',              label: 'QuickBooks status', group: 'readout', kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'manage_settings', status: 'live', depends_on: null,
    icon: BadgeCheck,    color: '#60a5fa', bg: DASH_BG },

  // ── Settings (config) ───────────────────────────────────────────────────────────
  { key: 'qb_invoicing',     label: 'QuickBooks',                group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: BookOpen,    color: '#60a5fa', bg: DASH_BG, route: '/settings', module_key: 'qb_invoicing' },
  { key: 'business_profile', label: 'Business Profile',          group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Building2,   color: '#94a3b8', bg: DASH_BG, route: '/settings' },
  { key: 'tax_rate',         label: 'Tax Rate',                  group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Percent,     color: '#fbbf24', bg: DASH_BG, route: '/settings' },
  { key: 'cost_config',      label: 'Cost-to-Produce Settings',  group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'view_costs',      status: 'live',    depends_on: null,
    icon: CostCalc,    color: '#2dd4bf', bg: DASH_BG, route: '/settings' },
  { key: 'install_price',    label: 'Install Price',             group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Hammer,      color: '#fb923c', bg: DASH_BG, route: '/settings' },
  { key: 'team_management',  label: 'Team',                      group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'live',    depends_on: null,
    icon: Users,       color: '#818cf8', bg: DASH_BG, route: '/settings' },
  { key: 'online_shop',      label: 'Online Shop',               group: 'settings', kind: 'context', placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'planned', depends_on: null,
    icon: ShoppingBag, color: '#c084fc', bg: DASH_BG },
  { key: 'contractor_tiers', label: 'Contractors',               group: 'settings', kind: 'action',  placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'planned', depends_on: null,
    icon: Users,       color: '#fb923c', bg: DASH_BG },
  { key: 'seasonal_module',  label: 'Seasonal',                  group: 'settings', kind: 'context', placement: 'settings', nav_eligible: false, required_permission: 'manage_settings', status: 'planned', depends_on: null,
    icon: Leaf,        color: '#4ade80', bg: DASH_BG },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  { key: 'add_business',     label: 'Add Business',              group: 'admin',    kind: 'action',  placement: 'admin',    nav_eligible: false, required_permission: 'owner-only',       status: 'live',    depends_on: null,
    icon: Plus,        color: '#34d399', bg: DASH_BG, route: '/add-business' },

  // ── Planned (greyed) — forward declarations. Permissions marked PROVISIONAL where the
  //    seed did not pin one (adjustable); the seed-pinned ones are locked like all others.
  { key: 'services',         label: 'Services',                  group: 'planned',  kind: 'context', placement: 'TBD',       nav_eligible: false, required_permission: 'view_dashboard',   status: 'planned', depends_on: null,
    icon: Wrench,      color: '#94a3b8', bg: DASH_BG, note: 'placement TBD; permission PROVISIONAL' },
  { key: 'opportunities',    label: 'Opportunities',             group: 'planned',  kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'view_orders',     status: 'planned', depends_on: 'services',
    icon: TrendingUp,  color: '#22d3ee', bg: DASH_BG, note: 'Regina surfacing; permission PROVISIONAL' },
  { key: 'followup_engine',  label: 'Follow-Up',                 group: 'planned',  kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_customers', status: 'planned', depends_on: null,
    icon: MessageCircle, color: '#fbbf24', bg: DASH_BG },
  { key: 'business_insights', label: 'Insights',                 group: 'planned',  kind: 'readout', placement: 'dashboard', nav_eligible: false, required_permission: 'view_reports',    status: 'planned', depends_on: null,
    icon: BarChart2,   color: '#818cf8', bg: DASH_BG },
  { key: 'campaigns',        label: 'Campaign Scheduler',        group: 'planned',  kind: 'context', placement: 'dashboard', nav_eligible: true,  required_permission: 'manage_campaigns', status: 'planned', depends_on: 'social_media',
    icon: CalendarClock, color: '#f472b6', bg: DASH_BG, route: '/campaigns' },
];

// ════════════════════════════════════════════════════════════════════════════════
// SELECTORS — every surface (dashboard / settings / admin / role-config / marketplace)
// reads the registry through THESE. No surface re-declares the catalog.
// ════════════════════════════════════════════════════════════════════════════════

/** Every registered tile (role-config + marketplace read this — ALL entries). */
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
