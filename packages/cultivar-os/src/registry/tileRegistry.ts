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
 * label · group · kind · placement · status · vertical are intended to be ADJUSTED in-flight —
 * edit the field, done, every surface follows. The EXCEPTION is `required_permission`: it is the
 * security gate, LOCKED to the ratified values. A wrong financial permission silently leaks the
 * cost/revenue moat — do NOT casual-adjust it.
 *
 * ── Field validity is CAPPED (2026-08-01) ──
 * `scripts/verify-tile-fields.mjs` asserts that EVERY row declares EVERY required field with a
 * value from its legal set. It exists because `campaigns` carried `status:'planned'` for nine
 * weeks after the feature shipped, and nothing could see it: a declared field with no validity
 * check is a field that drifts silently the moment one build touches a row another build owns.
 * Add a field to TileEntry → add it to the cap's REQUIRED table in the same commit.
 *
 * ── `nav_eligible` DELETED 2026-08-01 (David's ruling) ──
 * It declared "this tile can be pinned to the optional per-business nav bar" — a nav surface that
 * was never built. `NAV_IA` shipped instead as a hand-authored list, so MEMBERSHIP IN `NAV_IA` IS
 * ALREADY THE FACT the flag claimed to hold. Two representations of one fact (STD-011), and they
 * had drifted on SEVEN of thirty-three rows in BOTH directions: `add_business`, `discounts` and
 * `cost_to_produce` declared `false` while sitting in `NAV_IA` by `tileKey`; `inventory_manual`,
 * `inventory_intake`, `opportunities` and `followup_engine` declared `true` with no node. Nothing
 * read it, so nothing corrected it. If a derived form is ever wanted, DERIVE it from NAV_IA —
 * never re-declare it by hand.
 */
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import type { ModuleSeedRow } from '@trace/shared/business-logic';
import {
  QrCode, Truck, Calculator, HandCoins, Boxes, Camera, Receipt, Wrench, Share2,
  AlertTriangle, BarChart2, DollarSign, Sprout, TrendingUp,
  BookOpen, Building2, Percent, Calculator as CostCalc, Hammer, Users,
  ShoppingBag, Leaf, Plus, BadgeCheck, MessageCircle, CalendarClock,
} from 'lucide-react';

// ── kinds & axes ──────────────────────────────────────────────────────────────
// kind: how the surface behaves —
//   destination = you TAP IT AND GO somewhere (the whole grid except the readouts)
//   readout     = a number that LEAKS data by rendering in place (gate on what it exposes)
//
// 🔴 `action` + `context` COLLAPSED → `destination` (2026-08-01, David's ruling). The pair was
// declared in the seed and then distinguished by NOTHING, anywhere: `dashboardTiles()` filters
// `kind !== 'readout'` and no other code has ever read the field. An unused binary does not stay
// correct — `qr_checkout` was `action` ("tap-and-done") when it was the QR scan, and Nav C2
// relabelled it to Orders pointing at a full `/orders` workspace WITHOUT touching `kind`. The
// label moved and the classification did not, exactly as `campaigns.status` did. The readout
// split is the one that is real and load-bearing, so it is the one that survives.
export type TileKind = 'destination' | 'readout';
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
  /** Navigation target for a live destination surface. */
  route?: string;
  /** business_modules.module_key for the per-tenant enablement overlay (active/available state). */
  module_key?: string;
  /** Provisional notes (e.g. an undecided permission on a planned entry, or a known UNDECIDED). */
  note?: string;
}

const DASH_BG = '#1e293b'; // dashboard tile icon-box background (dark slate, established look)

// ════════════════════════════════════════════════════════════════════════════════
// THE REGISTRY — ratified seed (2026-06-23). placement/kind/label/status/vertical are
// adjustable fields; required_permission is the locked security gate. Every current entry is
// `general` (the shared spine) — Cultivar/Ignition tag the thin vertical-specific layer on top.
// ════════════════════════════════════════════════════════════════════════════════
export const TILE_REGISTRY: TileEntry[] = [
  // ── Dashboard — destinations (live) ────────────────────────────────────────────
  // Label 'Orders' (was 'QR Checkout') — QR is the capture METHOD, not the surface's name (Nav C2).
  { key: 'qr_checkout',      vertical: 'general', label: 'Orders',                   group: 'checkout',  kind: 'destination',  placement: 'dashboard', required_permission: 'orders:create',        status: 'live',    depends_on: null,
    icon: QrCode,      color: '#34d399', bg: DASH_BG, route: '/orders',            module_key: 'qr_checkout' },
  // Delivery = ONE evolving context entry. Live capability inside it = delivery_routing.
  // `opportunities` (Regina surfacing) is a PLANNED capability inside this same context.
  // Driver-handoff mechanism = UNDECIDED (do NOT build — see note).
  { key: 'delivery',         vertical: 'general', label: 'Delivery',                  group: 'fulfilment', kind: 'destination', placement: 'dashboard', required_permission: 'deliveries:read',  status: 'live',    depends_on: null,
    icon: Truck,       color: '#22d3ee', bg: DASH_BG, route: '/delivery-schedule', module_key: 'delivery_routing', note: 'driver-handoff mechanism UNDECIDED' },
  // 🔴 `module_key: 'cost_to_produce'` PAIRED HERE 2026-08-02 (5) — David's ruling. THE TILE HAD NO
  // KEY, so it did not know the module existed: the $29 Cost-to-Produce module ran a live 30-day
  // trial with NO badge and no [ENABLE], because the only tile carrying the key is the one below at
  // `placement:'admin'`, which no renderer draws. **The pairing was never made — nothing was hidden,
  // and this is NOT the 2026-08-02 (1) class where the data lied.** Same name, same capability: the
  // D-14.6 SEVER split one product into a WRITER (`/operating-costs`, this tile) and a TUNER
  // (`/costs`, the admin tile) — both are Cost-to-Produce, which is what David priced at $29.
  // ⚠️ THE KEY IS ON BOTH TILES, DELIBERATELY (legal — probe C14, and now C27). The admin tile is
  // the module's own surface and keeps its pairing for the day a settings/admin renderer exists;
  // this one is where the owner actually sees it today.
  // ⚠️ AND THE CONSEQUENCE IS NOT ONLY A BADGE, stated so it is not discovered later: `useModules`
  // computes state as `enabled && configured ? 'active' : 'available'` for ANY tile with a key, but
  // as an unconditional `'active'` for a tile without one. So this tile's state now FOLLOWS THE
  // MODULE ROW. Today that reads `active` (the trial is live). When expiry ships, a lapsed
  // Cost-to-Produce turns this tile into `[ENABLE]` — which is the ruled behaviour for an unpaid
  // add-on, not a regression, but it is a real change to a surface that was previously always on.
  { key: 'operating_costs',  vertical: 'general', label: 'Operating Costs',           group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'costs:read',         status: 'live',    depends_on: null,
    icon: HandCoins,   color: '#fbbf24', bg: DASH_BG, route: '/operating-costs', module_key: 'cost_to_produce' },
  { key: 'assets',           vertical: 'general', label: 'Assets',                    group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'costs:read',         status: 'live',    depends_on: null,
    icon: Building2,   color: '#a78bfa', bg: DASH_BG, route: '/assets' },
  // Inventory is TWO siblings sharing the inventory data model — NOT a collapse.
  { key: 'inventory_manual', vertical: 'general', label: 'Inventory (manual)',        group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'inventory:read',         status: 'live',    depends_on: null,
    icon: Boxes,       color: '#f472b6', bg: DASH_BG, route: '/inventory' },
  { key: 'inventory_intake', vertical: 'general', label: 'Inventory Intake (mobile)', group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'inventory:read',         status: 'live',    depends_on: null,
    icon: Camera,      color: '#fb7185', bg: DASH_BG, route: '/inventory',         module_key: 'inventory_intake' },
  { key: 'receipt_keeper',   vertical: 'general', label: 'Receipts',                  group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'costs:read',         status: 'live',    depends_on: null,
    icon: Receipt,     color: '#38bdf8', bg: DASH_BG, route: '/receipts' },
  { key: 'pmi',              vertical: 'general', label: 'PMI',                       group: 'financial', kind: 'destination', placement: 'dashboard', required_permission: 'pmi:read',         status: 'live',    depends_on: null,
    icon: Wrench,      color: '#94a3b8', bg: DASH_BG, route: '/pmi' },
  { key: 'social_media',     vertical: 'general', label: 'Social',                    group: 'growth',    kind: 'destination', placement: 'dashboard', required_permission: 'campaigns:read',   status: 'live',    depends_on: null,
    icon: Share2,      color: '#f472b6', bg: DASH_BG, route: '/social/setup',      module_key: 'social_media' },
  // 🔴 `status:'planned'` WAS WRONG HERE FOR NINE WEEKS, AND THIS ROW IS WHY THE FIELD CAP EXISTS.
  // Campaign Scheduler SHIPPED 2026-05-29 (`60bd2fa`) — page, detail page, `api/campaigns.ts` (one
  // of the 12 function slots), `20260529_campaigns.sql`, member RLS in `20260727c`, AI drafting via
  // `generateCampaignPosts`. On 2026-06-23 the registry consolidation (`c36e562`) seeded EIGHT tiles
  // `planned` as a BATCH and swept this shipped feature in with seven unbuilt ones. For five weeks
  // it read as a grey square and nobody looked twice; on 2026-07-31 `planned` gained the amber SOON
  // badge and a mute wrong field started making a claim OUT LOUD — the dashboard tile said COMING
  // SOON while `nav_campaigns` (the SAME tile by `tileKey`, the SAME `/campaigns` route) opened the
  // working page. The nav could not have disagreed on purpose: `navPermission()` reads
  // `required_permission` and has NO notion of `status`. It was the only planned tile with a route
  // — because it was the only planned tile that was actually built.
  // MOVED here from the planned block and re-grouped 'planned' → 'growth': it is a marketing
  // surface and it belongs beside `social_media`, which is its own `depends_on`.
  { key: 'campaigns',        vertical: 'general', label: 'Campaign Scheduler',        group: 'growth',    kind: 'destination', placement: 'dashboard', required_permission: 'campaigns:read',   status: 'live',    depends_on: 'social_media',
    icon: CalendarClock, color: '#f472b6', bg: DASH_BG, route: '/campaigns' },
  // Customers ROSTER (3rd DataSheet consumer). OWNER-ONLY — matches customers_business_owner RLS
  // (owner-only, FOR ALL) so the nav never opens onto an empty RLS wall for staff (Gate-3 lesson).
  // 🔴 'owner-only' → 'customers:read' (2026-07-28, ledger #167). #153 re-gated the /customers
  // ROUTE and added the customers_member RLS policy on 2026-07-24, and NOBODY TOUCHED THE TILE —
  // so `nav_customers` (tileKey: 'customers') inherited `owner-only`, and a MANAGER holding
  // customers:read could reach /customers by URL while the menu never showed it. Route open,
  // table open, NAV shut: STD-020's third failure on this one capability, at the layer the
  // enforcement map had no column for. capR now asserts tile-gate == route-gate.
  { key: 'customers',        vertical: 'general', label: 'Customers',                 group: 'crm',       kind: 'destination', placement: 'dashboard', required_permission: 'customers:read',     status: 'live',    depends_on: null,
    icon: Users,       color: '#818cf8', bg: DASH_BG, route: '/customers' },

  // ── Dashboard — readouts (live). A readout LEAKS data by rendering → gate on what it exposes.
  { key: 'leakage_alert',          vertical: 'general', label: 'Leakage alert',     group: 'readout', kind: 'readout', placement: 'dashboard', required_permission: 'orders:read',    status: 'live', depends_on: null,
    icon: AlertTriangle, color: '#f59e0b', bg: DASH_BG },
  { key: 'metric_plants',          vertical: 'general', label: 'Plants tracked',    group: 'readout', kind: 'readout', placement: 'dashboard', required_permission: 'member', status: 'live', depends_on: null,
    icon: Sprout,        color: '#4ade80', bg: DASH_BG },
  { key: 'metric_inventory_value', vertical: 'general', label: 'Inventory value',   group: 'readout', kind: 'readout', placement: 'dashboard', required_permission: 'inventory:read',     status: 'live', depends_on: null,
    icon: DollarSign,    color: '#2dd4bf', bg: DASH_BG },
  // GATED (was ungated) — revenue is moat-class; locked to view_costs.
  { key: 'metric_today_sales',     vertical: 'general', label: "Today's sales",     group: 'readout', kind: 'readout', placement: 'dashboard', required_permission: 'costs:read',     status: 'live', depends_on: null,
    icon: TrendingUp,    color: '#34d399', bg: DASH_BG },
  { key: 'metric_installs',        vertical: 'general', label: 'Installs this week', group: 'readout', kind: 'readout', placement: 'dashboard', required_permission: 'member', status: 'live', depends_on: null,
    icon: BarChart2,     color: '#818cf8', bg: DASH_BG },
  { key: 'qb_status',              vertical: 'general', label: 'QuickBooks status', group: 'readout', kind: 'readout', placement: 'dashboard', required_permission: 'settings:read', status: 'live', depends_on: null,
    icon: BadgeCheck,    color: '#60a5fa', bg: DASH_BG },

  // ── Settings (config) ───────────────────────────────────────────────────────────
  { key: 'qb_invoicing',     vertical: 'general', label: 'QuickBooks',                group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'settings:read', status: 'live',    depends_on: null,
    icon: BookOpen,    color: '#60a5fa', bg: DASH_BG, route: '/settings', module_key: 'qb_invoicing' },
  { key: 'business_profile', vertical: 'general', label: 'Business Profile',          group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'settings:read', status: 'live',    depends_on: null,
    icon: Building2,   color: '#94a3b8', bg: DASH_BG, route: '/settings' },
  { key: 'tax_rate',         vertical: 'general', label: 'Tax Rate',                  group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'tax_rate:update', status: 'live',    depends_on: null,
    icon: Percent,     color: '#fbbf24', bg: DASH_BG, route: '/settings' },
  { key: 'cost_config',      vertical: 'general', label: 'Cost-to-Produce Settings',  group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'costs:read',      status: 'live',    depends_on: null,
    icon: CostCalc,    color: '#2dd4bf', bg: DASH_BG, route: '/settings' },
  { key: 'install_price',    vertical: 'general', label: 'Install Price',             group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'settings:read', status: 'live',    depends_on: null,
    icon: Hammer,      color: '#fb923c', bg: DASH_BG, route: '/settings' },
  { key: 'team_management',  vertical: 'general', label: 'Team',                      group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'team:read', status: 'live',    depends_on: null,
    icon: Users,       color: '#818cf8', bg: DASH_BG, route: '/settings' },
  { key: 'online_shop',      vertical: 'general', label: 'Online Shop',               group: 'settings', kind: 'destination', placement: 'settings', required_permission: 'settings:read', status: 'planned', depends_on: null,
    icon: ShoppingBag, color: '#c084fc', bg: DASH_BG, module_key: 'online_shop' },
  { key: 'contractor_tiers', vertical: 'general', label: 'Contractors',               group: 'settings', kind: 'destination',  placement: 'settings', required_permission: 'pricing_recipe:update', status: 'planned', depends_on: null,
    icon: Users,       color: '#fb923c', bg: DASH_BG, module_key: 'contractor_tiers' },
  // 🔴 vertical 'general' → 'cultivar' (2026-08-01). MASTER_BRIEF:313 lists "Seasonal Module |
  // $29/mo | Cultivar" — a nursery's seasonal perishable window is not a shared-spine capability,
  // and declaring it `general` would surface it on an auto shop's dashboard the day Ignition
  // reconnects. First non-`general` row in the registry; `verticalsForBusinessType` already routes
  // it (LAWNS is business_type 'nursery' → ['general','cultivar']).
  { key: 'seasonal_module',  vertical: 'cultivar', label: 'Seasonal',                 group: 'settings', kind: 'destination', placement: 'settings', required_permission: 'settings:read', status: 'planned', depends_on: null,
    icon: Leaf,        color: '#4ade80', bg: DASH_BG, module_key: 'seasonal_module' },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  { key: 'add_business',     vertical: 'general', label: 'Add Business',              group: 'admin',    kind: 'destination',  placement: 'admin', required_permission: 'owner-only',       status: 'live',    depends_on: null,
    icon: Plus,        color: '#34d399', bg: DASH_BG, route: '/add-business' },
  // Cost-to-Produce — MOVED Dashboard→Admin + view_costs→owner-only (Nav C2 access change, ratified
  // 2026-06-24). Owner-default + delegable is a future Role-Machine concern; today the gate is
  // owner-only, so a Staff/Manager session sees it nowhere (nav AND route, see router.tsx /costs).
  { key: 'cost_to_produce',  vertical: 'general', label: 'Cost-to-Produce',           group: 'admin',    kind: 'destination', placement: 'admin', required_permission: 'owner-only',       status: 'live',    depends_on: null,
    icon: Calculator,  color: '#2dd4bf', bg: DASH_BG, route: '/costs',             module_key: 'cost_to_produce' },
  // Discounts — customer discount types × tiers (relocated out of Cost-to-Produce Block 5, 2026-07-10).
  // manage_settings (pricing authority; owner in Cultivar today), matching the /discounts route gate.
  { key: 'discounts',        vertical: 'general', label: 'Discounts',                 group: 'admin',    kind: 'destination',  placement: 'admin', required_permission: 'pricing_recipe:update',  status: 'live',    depends_on: null,
    icon: Percent,     color: '#fbbf24', bg: DASH_BG, route: '/discounts' },

  // ── Planned (greyed) — forward declarations. Permissions marked PROVISIONAL where the
  //    seed did not pin one (adjustable); the seed-pinned ones are locked like all others.
  { key: 'services',         vertical: 'general', label: 'Services',                  group: 'planned',  kind: 'destination', placement: 'TBD', required_permission: 'member',   status: 'planned', depends_on: null,
    icon: Wrench,      color: '#94a3b8', bg: DASH_BG, note: 'EDITOR LIVE — the service_offerings CRUD (transport / add-ons incl. netting companion / other services) renders in shared Settings.tsx. NAV rewire 2026-07-07 (tech-debt #47): it now has a first-class section-isolated DESTINATION at /settings/services via the nav_services Admin IA node (peer of Business Profile / Accounting), no longer orphaned at /settings/all. This tile (status:planned/placement:TBD) refers to a future DASHBOARD tile, not the editor or its nav destination. permission PROVISIONAL.' },
  { key: 'opportunities',    vertical: 'general', label: 'Opportunities',             group: 'planned',  kind: 'destination', placement: 'dashboard', required_permission: 'orders:read',     status: 'planned', depends_on: 'services',
    icon: TrendingUp,  color: '#22d3ee', bg: DASH_BG, note: 'Regina surfacing; permission PROVISIONAL' },
  { key: 'followup_engine',  vertical: 'general', label: 'Follow-Up',                 group: 'planned',  kind: 'destination', placement: 'dashboard', required_permission: 'customers:update', status: 'planned', depends_on: null,
    icon: MessageCircle, color: '#fbbf24', bg: DASH_BG, module_key: 'followup_engine' },
  { key: 'business_insights', vertical: 'general', label: 'Insights',                 group: 'planned',  kind: 'readout', placement: 'dashboard', required_permission: 'reports:read',    status: 'planned', depends_on: null,
    icon: BarChart2,   color: '#818cf8', bg: DASH_BG, module_key: 'business_insights' },
];

// ════════════════════════════════════════════════════════════════════════════════
// THE MODULE CATALOG — what a module COSTS. Keyed on `module_key`, joined to the tile.
// ════════════════════════════════════════════════════════════════════════════════
//
// 🔴 WHY THIS IS NOT FIELDS ON `TileEntry` (David's ruling 2026-08-01, reversing his own earlier
// one). The first shape put `price_monthly` + `trial_days` on the tile, required for the eleven
// rows carrying a `module_key` and meaningless for the other twenty-two. That is a CONDITIONALLY
// REQUIRED FIELD, and `verify-tile-fields` cannot express one: it derives requiredness by splitting
// on a single character (`field?:`), because a TypeScript interface declares FIELDS, not
// RELATIONSHIPS BETWEEN FIELDS. The options were a hardcoded conditional inside the cap (the #73
// shape the cap's own header cites), a discriminated union (expressible, and it complicates the
// parser), or this.
//
// **THE CONDITIONAL WAS THE MODEL TELLING US THE FIELD WAS ON THE WRONG OBJECT.** A price is a fact
// about a MODULE, not about a TILE — eleven things have one, thirty-three do not, and `module_key`
// was already the join. Moving it here makes both fields UNCONDITIONALLY REQUIRED, because the list
// contains only things that have them. The conditional does not get expressed; it disappears.
//
// `verify-tile-fields` assertion 2 reconciles the two lists in BOTH directions — a tile whose
// module_key has no catalog entry, and a catalog entry no tile references. Neither list can drift
// from the other in silence, which is the property the tile fields themselves lacked for nine weeks.
//
// PROVENANCE IS PER-ROW AND REQUIRED. `note` is not optional: every price cites where it came from,
// so the next reader can tell a ratified number from an assumed one. That is also why there is no
// conditional here either — a required `note` on all eleven beats "required only when unpriced".
// ════════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE FOURTH VALUE — `core_optional`, minted 2026-08-02 because `contractor_tiers` AT $0 COULD
//    NOT BE SAID. David's ruling, and his framing replaced mine: the defect was never the missing
//    value, it was THREE FIELDS DOING ONE JOB UNDER CONTRADICTORY RULES.
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The ruling is "price 0, no trial, SEEDS DISABLED — core-with-a-switch: it ships with the platform
// and a nursery that gives contractor discounts turns it on. Nothing expires because there is
// nothing to expire." **That sentence had no legal spelling in this file**, and the three ways to
// fake it each break something real:
//   · `core`     — `price_monthly: 0` is legal here and ONLY here, but `core` SEEDS THE MODULE ON.
//   · `add_on`   — seeds dark correctly, and `verify-tile-fields` rejects `price_monthly: 0` on it
//                  ("0 would read as free"). The cap is right; the module is not an add-on.
//   · `unpriced` — seeds dark correctly, and it ASSERTS THE PRICE IS UNKNOWN when it was just
//                  decided. That is D-9 pointed backwards: a fabricated *absence* in place of a
//                  real value, which is the same lie as a fabricated value in place of an absence.
//
// 🔴 SO ONE FIELD DECIDES, AND THE OTHERS STOP VOTING. `enabledByDefault()` below is derived from
// `billing` ALONE and is the module's BASELINE state; a running trial is an OVERRIDE on top of it,
// never a second opinion about it. That is what makes `core_optional` a value rather than a
// workaround: it is not "core with an exception", it is its own baseline — INCLUDED IN BASE, OFF
// UNTIL SWITCHED ON — and it needed a name because the model already contained the concept and had
// nowhere to put it.
export type ModuleBilling =
  | 'core'          // included in the base subscription, ON at seed — price 0 MEANS included
  | 'core_optional' // included in the base subscription, OFF at seed. $0, no trial, nothing expires.
                    // A capability the platform ships and the owner switches on if their business
                    // works that way. NOT a free add-on and NOT a lesser core: the money is
                    // identical to `core`, only the default differs.
  | 'add_on'        // separately billable, price > 0
  | 'unpriced';     // HONESTLY UNKNOWN (D-9). Not zero, not a guess — null, with the reason in `note`.
                    // ⚠️ ZERO MEMBERS as of 2026-08-02 (both were ruled). KEPT DELIBERATELY: it is
                    // the honest answer for the next module that arrives before its decision does,
                    // and deleting it would mean the next such module gets a guessed number instead.

export interface ModuleEntry {
  /** Joins to TileEntry.module_key AND to business_modules.module_key. */
  module_key: string;
  billing: ModuleBilling;
  /** USD per month. 0 iff `core`; > 0 iff `add_on`; **null iff `unpriced`** — a price we do not
   *  have must not render as $0, which is a real number claiming a real thing (D-9). */
  price_monthly: number | null;
  /** Free-trial length in days. 0 where a trial is meaningless (core, unpriced). */
  trial_days: number;
  /** REQUIRED — where this price came from, or why there isn't one. */
  note: string;
}

// ⚠️ `trial_days: 30` IS INHERITED, NOT RATIFIED. It is Ignition's precedent (AdminSubscription's
// `calculateDaysLeft` defaults to 30) carried across because a trial length was needed and inventing
// a different one would have been worse. MASTER_BRIEF names no trial length for TRACE's own modules;
// it notes competitors at 14 days (:736-737). **David's to rule — change the numbers here, nowhere else.**
// ════════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 RECONCILIATION — MASTER_BRIEF'S CORE LIST vs THE 11 module_keys (David asked, 2026-08-01)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// MASTER_BRIEF:295-300 names FIVE core items. **TWO map. THREE DO NOT, and they cannot** — no tile
// carries a `module_key` for any of them:
//
//   ✅ QR Checkout                     → `qr_checkout`
//   ✅ QuickBooks integration          → `qb_invoicing`
//   ❌ Owner dashboard                 → NO module_key, and it should not have one. The dashboard
//                                        is the SHELL every tile renders into; a row for it would
//                                        be a row that can be set `enabled:false`, which turns the
//                                        app off. Core by structure, not by billing.
//   ❌ Basic inventory / asset tracking → NO module_key. The `inventory_manual` / `assets` tiles
//                                        carry none. `inventory_intake` is a DIFFERENT product
//                                        (mobile photo intake) and is `unpriced` — its own note
//                                        already says the brief's word "basic" may not cover it.
//   ❌ Customer records                 → NO module_key on any customer tile.
//
// ✅ **RULED 2026-08-01 — RENDER "INCLUDED" FROM THIS CATALOG; DO NOT MINT NO-COST KEYS.**
// David's reasoning, and it settles the shape rather than just the case: **a `module_key` on the
// owner dashboard would make the shell every tile renders into a PURCHASABLE ROW** — a thing with an
// enablement flag someone could set false — and `verify-tile-fields` assertion 2 is RIGHT to reject
// a catalog entry no tile references. The rejected option was rejected by a cap that was correct.
//
// **`billing:'core'` ALREADY CARRIES THE FACT.** The marketplace reads THIS catalog and renders its
// core section from `billing === 'core'`, **whether or not a `business_modules` row exists for that
// module**. So: **two rows seeded, five shown** — and the gap between those numbers is a RENDERING
// concern, not a data one. A module needs a row to be BILLED and ENABLED; it does not need one to be
// LISTED as included.
//
// ⚠️ WHAT THAT LEAVES FOR ITEM 3, stated so it is not rediscovered: the three unmapped core items
// (Owner dashboard · Basic inventory/asset tracking · Customer records) have **no catalog entry at
// all**, so "render the core section from `billing:'core'`" yields two. The marketplace will need a
// display-only line for each — copy, not a `ModuleEntry` — sourced from MASTER_BRIEF:295-300. **That
// is a screen concern and it belongs in the screen**, which is exactly what this ruling decided.
//
// THE ADD-ON SIDE, restated because it is the same shape: MASTER_BRIEF lists FOURTEEN add-ons; this
// catalog prices SEVEN. Unmapped: Equipment Tracking · GPS Tracking · Water System · Greenhouse ·
// PMI · EPA 608 (Conduit) · DOT Compliance (Ignition). Four are other verticals; three are Cultivar
// products with a published price and no tile. That is the 7-of-14 finding from #179, unchanged.
export const MODULE_CATALOG: ModuleEntry[] = [
  // ── core: included in base (MASTER_BRIEF:294-299) ──
  { module_key: 'qr_checkout',       billing: 'core',    price_monthly: 0,    trial_days: 0,  note: 'MASTER_BRIEF:296 — named in the Core list, included in the base subscription.' },
  { module_key: 'qb_invoicing',      billing: 'core',    price_monthly: 0,    trial_days: 0,  note: 'MASTER_BRIEF:297 — "QuickBooks integration", Core list.' },

  // ── add-ons (MASTER_BRIEF:304-321) ──
  { module_key: 'social_media',      billing: 'add_on',  price_monthly: 19,   trial_days: 30, note: 'MASTER_BRIEF:306 — "Social Media + AI posts", $19/mo, all verticals.' },
  { module_key: 'followup_engine',   billing: 'add_on',  price_monthly: 19,   trial_days: 30, note: 'MASTER_BRIEF:307 — "Follow-Up Engine", $19/mo, all verticals.' },
  { module_key: 'online_shop',       billing: 'add_on',  price_monthly: 19,   trial_days: 30, note: 'MASTER_BRIEF:308 — "Online Shop", $19/mo, all verticals.' },
  { module_key: 'business_insights', billing: 'add_on',  price_monthly: 19,   trial_days: 30, note: 'MASTER_BRIEF:309 — "Business Insights", $19/mo, all verticals.' },
  { module_key: 'delivery_routing',  billing: 'add_on',  price_monthly: 29,   trial_days: 30, note: 'MASTER_BRIEF:311 — "Delivery Routing", $29/mo, all verticals.' },
  { module_key: 'seasonal_module',   billing: 'add_on',  price_monthly: 29,   trial_days: 30, note: 'MASTER_BRIEF:313 — "Seasonal Module", $29/mo, Cultivar. Matches the tile\'s vertical:cultivar.' },
  { module_key: 'cost_to_produce',   billing: 'add_on',  price_monthly: 29,   trial_days: 30, note: 'RULED 2026-08-02 (David) — priced at $29/mo, trialled like the rest. ⚠️ THE NUMBER IS A PLACEHOLDER AND SAYING SO IS THE POINT: David prices the verticals from what Cost-to-Produce tells him the platform actually costs to run, so this is one field to change when that data exists. Safe to change because the term is SNAPSHOTTED at seed — a catalog edit governs NEW trials only. NOT in MASTER_BRIEF (neither list); this row is the decision, not a citation.' },

  // ── core_optional: INCLUDED IN BASE, OFF UNTIL SWITCHED ON. $0, no clock, nothing expires. ──
  { module_key: 'contractor_tiers',  billing: 'core_optional', price_monthly: 0, trial_days: 0, note: 'RULED 2026-08-02 (David) — core-with-a-switch: it ships with the platform and a nursery that gives contractor discounts turns it on. Was add_on/$49/30d and ON A LIVE CLOCK — "a working capability that expires in a month is exactly what the fuzz would take away wrongly". ⚠️ MASTER_BRIEF:317 prices "Contractor Portal" at $49/mo and that line SURVIVES: the portal is a LOGIN surface that does not exist; this is the discount switch on the nursery side. Two products, and the tier itself belongs to the CUSTOMER (customers.price_tier), not to this list.' },

  // ── core (continued): ruled out of `unpriced` 2026-08-02 ──
  { module_key: 'inventory_intake',  billing: 'core',    price_monthly: 0,    trial_days: 0,  note: 'RULED 2026-08-02 (David) — CORE. "Ships on, always. It is how stock gets captured; there is nothing to buy." Was `unpriced`. NOT in MASTER_BRIEF: the Core list says "Basic inventory / asset tracking" (:298) and mobile photo intake is arguably beyond "basic" — the ruling settles it as core regardless of which brief line it maps to.' },
];

// THE SEEDER NEEDED ONE, SO IT IS WRITTEN NOW — exactly as the note above said it would be. The
// marketplace's own selector is still not written, for the same reason it was not written yesterday.

// ════════════════════════════════════════════════════════════════════════════════
// SEED PROJECTION — what a tenant's `business_modules` rows look like on day one.
// ════════════════════════════════════════════════════════════════════════════════
//
// 🔴 ROWS FOR EVERY MODULE, INCLUDING CORE (David's ruling 2026-08-01). His reason is the deciding
// one: **a module may MOVE to core as the platform builds out, and with a row for everything that
// is a field change HERE rather than a migration against live tenants.** A model where core has no
// row makes every promotion or demotion a data migration.
//
// ✏️ THE RULING ASKED FOR A NEW FIELD MARKING CORE VS PAID. **IT ALREADY EXISTS AND IT IS
// `billing`** — minted in this same file yesterday (#179), typed `'core' | 'add_on' | 'unpriced'`,
// with `verify-tile-fields` already asserting `billing ↔ price_monthly` agreement on every row.
// Adding a second field for the same fact is STD-011 — two representations of one thing, and the
// next reader would have to work out which one the seeder trusts. **The ruling's requirement is
// satisfied by the field that is here; what was actually missing is the MAPPING below.** Reported
// rather than quietly implemented either way.
//
// AND THE MAPPING NEEDS NO NEW FIELD AT ALL — every fact falls out of data that is already there:
//   · `enabled`     = core OR a running trial   — see THE REVERSAL below. Liveness follows the
//                                                 CLOCK, not the billing class.
//   · `configured`  = core OR a running trial   — same predicate AT SEED; a distinct field because
//                                                 they diverge the moment a trial expires (access
//                                                 goes, the owner's setup stays).
//   · `start_trial` = trial_days > 0            — which is 30 for the seven add-ons and 0 for core
//                                                 AND for 'unpriced', so the three-value `billing`
//                                                 collapses to one rule instead of a special case.
//   · `trial_days`  = the catalog's own number  — carried into the row and SNAPSHOTTED there.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE REVERSAL — A TRIALLING MODULE SEEDS **LIVE** (David's ruling 2026-08-02, correcting the
//    2026-08-01 spec that shipped one day earlier in this same file).
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The superseded rule was `enabled = billing === 'core'`, so all seven add-ons seeded DARK **with a
// thirty-day clock running over them.** That is not a trial. `enabled:false` is a functional gate,
// not a label — `api/social/generate-posts.ts:52` refuses outright on `!enabled || !configured` —
// so the clock counted down on something the member could not use, toward a conversion decision the
// owner had no basis to make.
//
// **DAVID'S MODEL, stated so nobody re-derives it: the site goes live, EVERYTHING WORKS, and at the
// end of the term the unpaid modules go behind the fuzz. The clock is what ENDS access; it is never
// what withholds it.** A trial is the grace period during which the module is fully live.
//
// ⚠️ `configured` FLIPS WITH IT, and that is not a rider — it is what makes the ruling reach a
// screen. `useModules.ts` renders `active` only on `enabled && configured`, so a trialling module
// seeded `configured:false` would still show `[ENABLE]`: the data would be corrected and the
// dashboard would look identical. The precedent for setting it true on a not-yet-personalised
// module is already ruled and already shipped one paragraph down — `qb_invoicing`.
//
// WHAT THIS DOES **NOT** BUILD: expiry. Nothing flips a lapsed trial back to `enabled:false` yet —
// that is the fuzz, and it is filed. Until it exists a trial that runs out keeps working, which is
// stated here rather than discovered later.
//
// 🔴 **A SEEDED CORE MODULE READS `active` ON DAY ONE (David's ruling 2026-08-01, reversing the
// `configured:false` draft).** `useModules.ts` renders `active` only on `enabled && configured`,
// so seeding `configured:false` put an **`[ENABLE]` button on a working, already-included feature**
// — the dead-affordance class, the same defect that kept `campaigns` off `module_key` entirely.
// **There is nothing to configure about being included.** Second reason, and it is not cosmetic:
// the draft made this whole build produce NO visible change, and *a build with no observable change
// reads as a failed deploy* — which is how a real deploy failure gets waved through (OP-15).
//
// 🔴 **`trial_days` TRAVELS INTO THE ROW — THE TERM IS SNAPSHOTTED, NOT READ LIVE (ruling
// 2026-08-01).** Expiry is computed from the stored `(trial_started_at, trial_days)` PAIR, never
// from this catalog. So editing the number below governs **NEW trials only** and cannot reach a
// tenant already mid-trial. That is what makes `trial_days: 30` safe to argue about: MASTER_BRIEF:243
// and BD-2 say 14, `Help.tsx:524` tells a customer 30, and 30 is what the donor code assumed —
// **a scheduling question, no longer a live hazard.** Full reasoning: `20260801c`'s header.
//
// 🔴 `unpriced` GETS A ROW, DISABLED, WITH NO CLOCK, and that is the honest answer rather than the
// tidy one. A trial is a countdown to a price decision; `cost_to_produce` and `inventory_intake`
// have no price (their `note` says RULING OWED, in both directions). Starting a thirty-day clock on
// them would create a deadline for a question nobody has answered — a real number claiming a real
// thing (D-9). `trial_days: 0` already encodes it, so the rule above needs no exception.
//
// ⚠️ **AND THE REVERSAL ABOVE SHARPENS THIS INTO A LIVE COST — RULING OWED, DAVID'S.** Under the new
// model liveness follows the clock, and these two have no clock, so they seed DARK: two BUILT AND
// WORKING modules rendering `[ENABLE]` forever, on a purchase nobody can make. That is the exact
// dead-affordance the `configured` ruling deleted, arriving through a different door. It was NOT
// silently fixed here — pricing them (or ruling them core) is David's call and the mapping needs no
// change either way: give them a `trial_days` and they go live like any other trial; mark them
// `core` and they go live permanently. **The row is disabled today because the question is open,
// not because the answer is no.**
//
// ⚠️ ONE CASE FLAGGED RATHER THAN QUIETLY SOFTENED: `qb_invoicing` genuinely HAS configuration (the
// QuickBooks OAuth link), so a green tile on day one says *"included"*, not *"connected"*. That is
// not a false claim — the module IS included, the tile routes to `/settings` where the link is made,
// and the CONNECTION indicator is a separate surface reading `business_accounting_secrets`. Recorded
// so the next reader knows it was considered.

// ⚠️ `ModuleSeedRow` IS DEFINED IN SHARED AND IMPORTED HERE, NOT REDECLARED. The two ends of this
// payload must agree, and a second structurally-identical interface in the vertical would be a
// duplicate that TypeScript could never catch drifting (structural typing means both compile even
// after they disagree). The dependency direction is the only one AC-1 permits: the vertical may
// import shared; shared may never import the vertical.

/**
 * A module's BASELINE state — is it on when nothing else is true? DERIVED FROM `billing` ALONE, and
 * that is the whole point of the 2026-08-02 (2) ruling: **one field decides.**
 *
 * 🔴 THIS IS NOT A SECOND OPINION ABOUT LIVENESS, IT IS THE FLOOR IT STARTS FROM. A running trial is
 * an OVERRIDE on top of this (`enabled = enabledByDefault(billing) || start_trial`), which is the
 * 2026-08-02 (1) ruling unchanged — the clock still ENDS access rather than withholding it. What
 * changed is that "is it included and on" stopped being spelled inline as `billing === 'core'` in
 * the one place that happened to need it, where a fourth value could not be added without finding
 * every such spelling. There is exactly one now, and it is here.
 *
 * ⚠️ `core_optional` IS FALSE HERE AND THAT IS THE ENTIRE DIFFERENCE FROM `core`. Same price, same
 * inclusion, same absence of a clock — it simply is not on until the owner says so. Reading this
 * function is the only way to tell them apart, which is why nothing else may re-derive it.
 */
export function enabledByDefault(billing: ModuleBilling): boolean {
  return billing === 'core';
}

/**
 * 🔴 A TRIAL STARTS WHEN THE THING BEING TRIALLED CAN BE USED (David's ruling 2026-08-02 (3)).
 *
 * The catalog's own rule is that a trial is a COUNTDOWN TO A PRICE DECISION. A module whose tile is
 * `planned` has nothing to decide: the owner cannot use it, cannot evaluate it, and at day thirty is
 * asked to pay for something he has never seen. **That is the same defect as a clock over a module
 * the server refuses (2026-08-02 (1)) and a clock over a price nobody has set (`unpriced`) — three
 * doors into one room**, and this is the rule that shuts the third.
 *
 * A module's SURFACE is live when its tile says `status: 'live'`. Every catalog key has exactly one
 * tile — `verify-tile-fields` assertion 2 guarantees the join in both directions — so this lookup is
 * total, and a key with no tile is a build failure long before it reaches here.
 *
 * ⚠️ DERIVED, NOT DECLARED, AND THAT IS THE POINT. Hand-setting `trial_days: 0` on the four planned
 * add-ons would have been four edits that someone must remember to undo, one per tile, on the day it
 * ships — and the whole finding behind this ruling is that nobody was watching the seeder's output
 * at all. Reading `status` means the catalog keeps its OFFER (`trial_days: 30`, what the trial is
 * worth) while the seed simply does not grant one yet.
 */
function moduleSurfaceIsLive(moduleKey: string): boolean {
  return TILE_REGISTRY.some((t) => t.module_key === moduleKey && t.status === 'live');
}

/**
 * One module's day-one row state. Exported so the mapping itself is tested, not just its output.
 *
 * `surfaceIsLive` is REQUIRED rather than defaulted: a default would be a decision about the most
 * dangerous input made silently, at every call site that forgot to think about it.
 */
export function moduleSeedRow(entry: ModuleEntry, surfaceIsLive: boolean): ModuleSeedRow {
  const baseline   = enabledByDefault(entry.billing);
  // 🔴 BOTH HALVES OF THE CLOCK ARE GATED ON THE SURFACE, not just the flag. If `start_trial` were
  // suppressed and `trial_days` still travelled, the row would carry A TERM WITH NO TRIAL — which
  // the marketplace reads as a trial that never started (B8), a third state nobody meant to create.
  const startTrial = entry.trial_days > 0 && surfaceIsLive;
  // 🔴 LIVENESS FOLLOWS THE CLOCK, NOT THE BILLING CLASS (David's ruling 2026-08-02). A module is on
  // at seed because it is INCLUDED-AND-ON by baseline, or because it is INSIDE A RUNNING TRIAL.
  // There is no third way, and `add_on` by itself is not one — an add-on with `trial_days: 0` seeds
  // dark. `core_optional` seeds dark on BOTH counts, which is the ruling it was minted for.
  const isLive     = baseline || startTrial;
  return {
    module_key:  entry.module_key,
    enabled:     isLive,
    configured:  isLive,
    start_trial: startTrial,
    // The TERM travels only with a trial that is actually being granted. `entry.trial_days` is the
    // OFFER and stays in the catalog untouched; this is the TERM GRANTED, and there is none yet.
    trial_days:  startTrial ? entry.trial_days : 0,
  };
}

/**
 * The whole catalog as a seed payload — the argument `seed_business_modules(…, p_modules)` takes.
 * EVERY module, no filtering: a tenant gets a row for each, which is the ruling.
 *
 * VERTICAL IS DELIBERATELY NOT APPLIED. A `seasonal_module` row on a non-nursery tenant costs one
 * row and nothing else — the tile never reaches that business's grid because `dashboardTilesForVerticals`
 * filters the REGISTRY, not this table. Filtering here instead would mean a business that later
 * changes `business_type` silently has no row (and so no trial) for its new vertical's modules,
 * which is the missing-row defect this whole build exists to close, reintroduced by an optimisation
 * that saves four rows.
 */
export function catalogSeedRows(): ModuleSeedRow[] {
  // ⚠️ NOT `.map(moduleSeedRow)`. `Array.map` passes the INDEX as the second argument, so a
  // point-free call here would have handed `0` (falsy) to `surfaceIsLive` for the first module and a
  // truthy number to every other — a per-position bug that reads as a typo-free line. TypeScript
  // rejects it because the parameter is `boolean` and required, which is the second reason it is
  // both of those things.
  return MODULE_CATALOG.map((entry) => moduleSeedRow(entry, moduleSurfaceIsLive(entry.module_key)));
}

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
  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'Dashboard', route: '/dashboard', required_permission: 'member' },
  // SETTINGS = USER-level (what a person changes about THEMSELVES). NOW a real destination: clicking
  // it lands on a SHORT index (/settings → SettingsIndex), NOT the long business-settings wall
  // (direct-access over scroll, D-21). Shown to EVERY authenticated user (view_dashboard); its child
  // is Your Profile. Business administration lives in the Admin section (RULE 1, ledger #50).
  { key: 'sec_settings',  section: 'settings',  parent: null, label: 'Settings',  route: '/settings', required_permission: 'member' },
  // ADMIN = BUSINESS-ENTITY administration (business-level config). NOW a clickable destination
  // (/admin → AdminIndex, a section index), gated to manage_settings so Staff never sees it (its
  // children are all owner/manage_settings-scoped anyway). Owner short-circuits manage_settings.
  { key: 'sec_admin',     section: 'admin',     parent: null, label: 'Admin',     route: '/admin', required_permission: 'settings:read' },

  // ── Dashboard branch ──
  { key: 'nav_orders',          section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'qr_checkout' },
  { key: 'nav_customers',       section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'customers' },
  { key: 'nav_delivery',        section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'delivery' },
  { key: 'nav_delivery_route',  section: 'dashboard', parent: 'nav_delivery',        label: 'Route', route: '/deliveries', matchRoute: '/deliveries', required_permission: 'deliveries.route:read' },
  { key: 'nav_operating_costs', section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'operating_costs' },
  { key: 'nav_assets',          section: 'dashboard', parent: 'nav_operating_costs', tileKey: 'assets' },
  // /inventory is served by two tiles (manual + intake); the nav node owns the route once, label 'Inventory'.
  { key: 'nav_inventory',       section: 'dashboard', parent: 'nav_operating_costs', label: 'Inventory', route: '/inventory', required_permission: 'inventory:read' },
  // Reconcile is a REAL destination, not a sub-flow: the owner goes to the desk deliberately to turn
  // a walk into stamped truth. /inventory/count is an EXCEPTION in the nav-integrity check because it
  // is entered from the grid mid-task; this one earns its own node so it is discoverable without
  // knowing the URL. Same view_costs gate as its route (nav and route agree, by construction).
  { key: 'nav_inventory_reconcile', section: 'dashboard', parent: 'nav_inventory', label: 'Reconcile count', route: '/inventory/reconcile', required_permission: 'inventory:read' },
  { key: 'nav_receipts',        section: 'dashboard', parent: 'nav_operating_costs', tileKey: 'receipt_keeper' },
  { key: 'nav_pmi',             section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'pmi' },
  { key: 'nav_social',          section: 'dashboard', parent: 'sec_dashboard',       tileKey: 'social_media' },
  // Customers roster — standalone OWNER-ONLY nav node (inherits owner-only from the tile). Under the
  // Dashboard section (operational surface the owner works with), NOT Operating Costs (view_costs).
  { key: 'nav_campaigns',       section: 'dashboard', parent: 'nav_social',          tileKey: 'campaigns', label: 'Campaigns', route: '/campaigns' },
  // Campaign detail — COLLAPSED breadcrumb (Dashboard / Campaigns / Campaign): drops "Social" so the
  // leaf stays 3-deep (ratified). parent stays nav_campaigns for section grouping; breadcrumb override
  // controls the displayed trail.
  { key: 'nav_campaign_detail', section: 'dashboard', parent: 'nav_campaigns',       label: 'Campaign', route: '/campaigns/:id', matchRoute: '/campaigns/:id', required_permission: 'campaigns:read', breadcrumb: ['sec_dashboard', 'nav_campaigns'] },
  // Help — reached from the Dashboard header's Help button, so the IA parent is Dashboard
  // (breadcrumb: Dashboard / Help). view_dashboard = visible to every authenticated session. The
  // /help page is PUBLIC (prospects can read it) so it mounts the nav chrome itself rather than via
  // AppLayout — this node supplies its breadcrumb trail + active-section highlight either way.
  { key: 'nav_help',            section: 'dashboard', parent: 'sec_dashboard',        label: 'Help', route: '/help', required_permission: 'member' },

  // ── Settings branch (USER-level only) ──
  // Your Profile — the personal identity surface (name/phone/email). PRIMARY entry is the header
  // avatar menu; this node is the secondary nav entry. view_dashboard = reachable by EVERY
  // authenticated role (incl. STAFF — every person can edit their own profile). Breadcrumb:
  // Settings / Your Profile. (Roles & Permissions MOVED to Admin — it is business-level, ledger #50.)
  { key: 'nav_profile',         section: 'settings',  parent: 'sec_settings',        label: 'Your Profile', route: '/profile', required_permission: 'member' },
  // The full business-settings page (Services / Team / tax rate / install price / cost config) is no
  // longer the default Settings landing — it is a deliberate destination reached from the Settings
  // index. Declared here so it still gets a breadcrumb ("Settings / All settings"); EXCLUDED from the
  // nav drawer (NAV_EXCLUDE in AppNav) so it doesn't clutter the menu — same pattern as nav_help.
  { key: 'nav_all_settings',    section: 'settings',  parent: 'sec_settings',        label: 'All settings', route: '/settings/all', matchRoute: '/settings/all', required_permission: 'settings:read' },

  // ── Admin branch (BUSINESS administration) — each a DIRECT menu destination (RULE 2a) ──
  // Business Profile + Accounting are section-isolated views of the /settings page (/settings/:section)
  // so the owner lands on JUST that section, no long scroll. Add Business + Cost-to-Produce stay
  // owner-only (account action / cost moat — D-009); the rest are manage_settings (owner-default,
  // delegable to a manager via /roles). Staff holds neither → sees no Admin item.
  { key: 'nav_add_business',     section: 'admin',     parent: 'sec_admin',           tileKey: 'add_business' },
  { key: 'nav_business_profile', section: 'admin',     parent: 'sec_admin',           label: 'Business Profile', route: '/settings/business',    matchRoute: '/settings/business',    required_permission: 'settings:read' },
  { key: 'nav_accounting',       section: 'admin',     parent: 'sec_admin',           label: 'Accounting',       route: '/settings/accounting', matchRoute: '/settings/accounting', required_permission: 'settings:read' },
  // Services — the service_offerings editor (transport / add-ons incl. netting companion / other
  // services + "+ Add service" + On/Off) as a FIRST-CLASS section-isolated destination (RULE 2a).
  // Was orphaned: reachable only via /settings/all → scroll (tech-debt #47). Now a discoverable
  // Admin nav item at /settings/services, peer of Business Profile / Accounting. manage_settings-
  // gated (owner-default, delegable). Served by the /settings/:section route (no router change).
  { key: 'nav_services',         section: 'admin',     parent: 'sec_admin',           label: 'Services',         route: '/settings/services',   matchRoute: '/settings/services',   required_permission: 'settings:read' },
  // Team & Roles — the agnostic member/device console (D-31): invite, roles (visibility axis),
  // devices. Supersedes the old /roles page (which now redirects here). manage_settings-gated
  // (owner-default, delegable) so Staff never sees it.
  { key: 'nav_team',             section: 'admin',     parent: 'sec_admin',           label: 'Team & Roles', route: '/team', required_permission: 'team:read' },
  // 🔴 ADMIN, NOT SETTINGS (David's ruling 2026-08-02 (6) #2). The section is chosen by what the
  // thing IS and the gate follows — not the other way round: deciding what the business pays TRACE
  // is an owner act, and it belongs beside Team & Roles and Cost-to-Produce. `subscription:read` is
  // owner-only, so a MANAGER sees this item and lands on a page that SAYS what it needs — it does
  // not vanish and it does not redirect (the six-state ruling, and this is its first new surface).
  { key: 'nav_subscription',     section: 'admin',     parent: 'sec_admin',           label: 'Subscription & Modules', route: '/admin/subscription', matchRoute: '/admin/subscription', required_permission: 'subscription:read' },
  { key: 'nav_discounts',        section: 'admin',     parent: 'sec_admin',           tileKey: 'discounts' },
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
