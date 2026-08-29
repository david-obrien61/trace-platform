import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PrivateRoute }    from './components/layout/PrivateRoute';
import { AppLayout }       from './components/layout/AppLayout';
import { PermissionRoute } from '@trace/shared/auth';

import { PlantProfile }    from './pages/PlantProfile';
import { AddOns }          from './pages/AddOns';
import { ScanOrder }       from './pages/ScanOrder';
import { CustomerCapture } from './pages/CustomerCapture';
import { CartReview }      from './pages/CartReview';
import { Confirmation }    from './pages/Confirmation';
import { Login }           from './pages/Login';
import { SignUp }          from './pages/SignUp';
import { Dashboard }       from './pages/Dashboard';
import { DemoQBInvoice }   from './pages/DemoQBInvoice';
import { Privacy }         from './pages/Privacy';
import { Terms }           from './pages/Terms';
import { Help }            from './pages/Help';
import { SocialSetup }     from './pages/SocialSetup';
import { Orders }            from './pages/Orders';
import { OrderDetail }       from './pages/OrderDetail';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { DeliveryRoute }    from './pages/DeliveryRoute';
import { OperationsCalendar } from './pages/OperationsCalendar';
import { Settings }          from './pages/Settings';
import { Campaigns }         from './pages/Campaigns';
import { CampaignDetail }    from './pages/CampaignDetail';
import { AddBusiness }       from './pages/AddBusiness';
import { DiscoveryInspect }  from './pages/DiscoveryInspect';
import { ReceiptKeeper }     from './pages/ReceiptKeeper';
import { BusinessAssets }    from './pages/BusinessAssets';
import { AssetCapture }      from './pages/AssetCapture';
import { BusinessInventory } from './pages/BusinessInventory';
import { InventoryCount }    from './pages/InventoryCount';
import { InventoryReconcile } from './pages/InventoryReconcile';
import { InventoryImport }    from './pages/InventoryImport';
import { CostToProduce }     from './pages/CostToProduce';
import { OperatingCosts }    from './pages/OperatingCosts';
import { Customers }         from './pages/Customers';
import { CustomerDetail }    from './pages/CustomerDetail';
import { Discounts }         from './pages/Discounts';
import PMI                   from './pages/PMI';
import { TeamConsole }       from './pages/TeamConsole';
import { Profile }            from './pages/Profile';
import { AdminIndex }         from './pages/AdminIndex';
import { Subscription }       from './pages/Subscription';
import { SettingsIndex }      from './pages/SettingsIndex';
import { AcceptInvite, ResetPin, DeviceHandoff } from '@trace/shared/auth';
import { supabase }          from './lib/supabase';
import { auth }              from './lib/auth';

function AcceptInvitePage() {
  const navigate = useNavigate();
  return (
    <AcceptInvite
      apiBase=""
      onRedirectTo="/dashboard"
      supabaseSignIn={auth.signIn}
      navigate={navigate}
    />
  );
}

function DeviceHandoffPage() {
  const navigate = useNavigate();
  return (
    <DeviceHandoff
      supabase={supabase}
      apiBase=""
      onRedirectTo="/dashboard"
      navigate={navigate}
    />
  );
}

function ResetPinPage() {
  const navigate = useNavigate();
  return (
    <ResetPin
      supabase={supabase}
      signIn={auth.signIn}
      navigate={navigate}
      redirectTo="/login"
    />
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* PUBLIC — no auth needed */}
      <Route path="/plant/:tagId"        element={<PlantProfile />} />
      <Route path="/plant/:tagId/addons" element={<AddOns />} />
      {/* Multi-item scan-loop tail entry (no plant tag — cart already built by scanning). */}
      <Route path="/checkout/addons"     element={<AddOns />} />
      <Route path="/checkout/customer"   element={<CustomerCapture />} />
      <Route path="/checkout/review"     element={<CartReview />} />
      <Route path="/checkout/confirm"    element={<Confirmation />} />

      {/* AUTH */}
      <Route path="/login"   element={<Login />} />
      <Route path="/signup"  element={<SignUp />} />
      <Route path="/join"    element={<AcceptInvitePage />} />
      <Route path="/device-handoff" element={<DeviceHandoffPage />} />
      <Route path="/reset-pin" element={<ResetPinPage />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms"   element={<Terms />} />
      <Route path="/help"    element={<Help />} />

      {/* PRIVATE — nursery owner/staff. AppLayout mounts the persistent identity header ONCE
          around every authenticated route (one mount, not per-page). */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          {/* ── OPEN to every authenticated session (view_dashboard, held by all roles) ──
              Landing + self-service surfaces. /dashboard is the redirect target; /profile and the
              /settings index are per-person, not gated capabilities. Left ungated deliberately. */}
          <Route path="/dashboard"    element={<Dashboard />} />
          {/* Settings lands on a SHORT index (user-level), NOT the business-settings wall (D-21). */}
          <Route path="/settings"          element={<SettingsIndex />} />
          <Route path="/onboarding"        element={<OnboardingWizard />} />
          <Route path="/profile"           element={<Profile />} />

          {/* ════════════════════════════════════════════════════════════════════════════════
              ROUTE-ENTRY PERMISSION ENFORCEMENT (security class fix, 2026-07-06).
              Gating must live on the ROUTE, not only on nav-link visibility — otherwise any second
              door (dashboard tile, deep link, typed URL) bypasses it (the Campaign Scheduler bug).
              Every gated capability's route is wrapped in <PermissionRoute permission=…> keyed on
              its registry/nav required_permission, so an unauthorized session is refused (redirect
              to /dashboard + [TRACE:PERMGATE]) regardless of HOW it arrived. Groups mirror the
              tileRegistry required_permission values exactly — nav AND route agree.
              ════════════════════════════════════════════════════════════════════════════════ */}

          {/* Orders — `orders:create` (STAFF holds it; guarded for completeness so the class has no gap).
              PURE RENAME of the recorded ALLOWED_DIVERGENCE (Note A, permanent under R1): the route
              checks create while the table checks orders:read. Deliberate, not an oversight.
              /checkout/scan is the multi-item scan-loop front door (needs businessId + inventory RLS). */}
          <Route element={<PermissionRoute permission="orders:create" />}>
            <Route path="/orders"       element={<Orders />} />
            <Route path="/orders/:id"   element={<OrderDetail />} />
            <Route path="/checkout/scan" element={<ScanOrder />} />
          </Route>

          {/* SPLIT 2026-07-27 — two surfaces, two strings. `manage_deliveries` gated both; the
              schedule (the list of deliveries) and the route (the day's stops → Maps handoff) are
              separately registered surfaces (tileRegistry `nav_delivery` vs `nav_delivery_route`)
              and now gate separately. THIS is what makes `deliveries.route:read` ENFORCED rather
              than declared-unwired: route + tile are real enforcement layers under STD-020. Its
              sibling `deliveries.route:update` stays declared-unwired — nothing persists a route. */}
          <Route element={<PermissionRoute permission="deliveries:read" />}>
            {/* REPLACED 2026-08-28 — the four-week operations calendar IS this route now, and the
                day-grouped list it used to render is its drill-in for a selected day. One route,
                one tile, one delivery list (David's ONE DELIVERY LIST ruling); the permission
                gate is unchanged, so nobody gains or loses access in the swap. */}
            <Route path="/delivery-schedule" element={<OperationsCalendar />} />
          </Route>
          <Route element={<PermissionRoute permission="deliveries.route:read" />}>
            <Route path="/deliveries"        element={<DeliveryRoute />} />
          </Route>

          {/* Social + Campaigns — `campaigns:read`. Campaign Scheduler is the reported bug: STAFF
              reached /campaigns via the dashboard card despite lacking this permission. Now every
              door (tile, deep link, typed URL) is refused at route entry. */}
          <Route element={<PermissionRoute permission="campaigns:read" />}>
            <Route path="/social/setup" element={<SocialSetup />} />
            <Route path="/campaigns"         element={<Campaigns />} />
            <Route path="/campaigns/:id"     element={<CampaignDetail />} />
          </Route>

          {/* Business administration — was ONE `manage_settings` gate; now split per destination below.
              Section-isolated Settings destinations (RULE 2a) — /settings/business, /settings/
              accounting land on JUST that section; /settings/all renders the FULL business-settings
              page (Services/Team/cost config). AGNOSTIC member/device console (D-31): invite + roles
              (visibility axis) + devices. /roles REDIRECTS here (the old page is superseded). Admin
              landing index — each card additionally respects its own permission. */}
          {/* `manage_settings` was ONE string over five destinations; it decomposes 5 ways and each
              door now names the authority it actually needs. /team + /roles are TEAM authority, not
              settings authority — a manager who may edit business settings is not thereby a manager
              of people. /discounts is PRICING authority (it writes the recipe). */}
          <Route element={<PermissionRoute permission="settings:read" />}>
            <Route path="/settings/:section" element={<Settings />} />
          </Route>
          <Route element={<PermissionRoute permission="team:read" />}>
            <Route path="/team"            element={<TeamConsole />} />
            <Route path="/roles"           element={<Navigate to="/team" replace />} />
          </Route>
          {/* Discounts — customer discount types × tiers. Re-gated from `manage_settings` to
              `pricing_recipe:update`, the string that names what this door actually does: it WRITES
              the pricing recipe. The READ of the set stays business-scoped in the data layer (roster
              picker + checkout resolve it independently of this route). */}
          <Route element={<PermissionRoute permission="pricing_recipe:update" />}>
            <Route path="/discounts"       element={<Discounts />} />
          </Route>
          <Route element={<PermissionRoute permission="settings:read" />}>
            <Route path="/admin"           element={<AdminIndex />} />
          </Route>

          {/* 🔴 THE MARKETPLACE — `subscription:read`, OWNER-ONLY (ruling 2026-08-02 (6) #2).
              It is the FIRST route gated on `subscription:*`, the resource minted precisely because
              nothing in the model had ever been about what the business PAYS. `settings:update` was
              disqualified on evidence: it is in MANAGER_DEFAULT_BUNDLE, so a manager could change
              what the business pays TRACE from the string that lets her fix the business hours.
              A manager therefore lands on PermissionRoute's NOT PERMITTED surface, which NAMES what
              is required — it does not vanish from the nav and it does not redirect. */}
          <Route element={<PermissionRoute permission="subscription:read" />}>
            <Route path="/admin/subscription" element={<Subscription />} />
          </Route>

          {/* `view_costs` was ONE string over NINE doors across four resources. Each door now
              names the resource it opens — this is the split that makes a cost-blind inventory
              viewer expressible for the first time. */}
          <Route element={<PermissionRoute permission="costs:read" />}>
            <Route path="/receipts"          element={<ReceiptKeeper />} />
            <Route path="/operating-costs"   element={<OperatingCosts />} />
          </Route>
          {/* /assets reads `cost_objects` (BusinessAssets.tsx:122) — the SAME table /receipts and
              /operating-costs read, gated `costs:read`. It briefly gated on `assets:read`, which
              MANAGER held and `costs:read` which they did not: door open, vault locked. `assets:*`
              RETIRED 2026-07-27 — the resource was minted from `business_assets`, renamed to
              `cost_objects` six weeks earlier. */}
          <Route element={<PermissionRoute permission="costs:read" />}>
            <Route path="/assets"            element={<BusinessAssets />} />
            <Route path="/assets/capture"    element={<AssetCapture />} />
          </Route>
          <Route element={<PermissionRoute permission="pmi:read" />}>
            <Route path="/pmi"               element={<PMI />} />
          </Route>
          <Route element={<PermissionRoute permission="inventory:read" />}>
            <Route path="/inventory"         element={<BusinessInventory />} />
            <Route path="/inventory/count"   element={<InventoryCount />} />
            {/* The desk RECONCILE surface — same VIEW_COSTS gate as /inventory and /inventory/count,
                deliberately: it reads and writes the same stock, so a second, looser door onto the
                same numbers would be the gap route-entry enforcement exists to close. The RPCs it
                calls are additionally member-checked server-side (assert_movement_actor), so the
                route gate is defence-in-depth, not the only lock. */}
            <Route path="/inventory/reconcile" element={<InventoryReconcile />} />
            {/* CSV catalog import — VIEW_COSTS gate (same as /inventory), NOT owner-only (David's
                ruling 2026-07-23): a manager with inventory access imports QUANTITIES. BULK PRICE
                import is the separate authority `import_pricing` — defaults owner-only, grantable on
                /team, enforced SERVER-SIDE by the import_write_price RPC. Routing this owner-only
                would block the manager's quantity import the ruling explicitly allows. */}
            <Route path="/inventory/import"  element={<InventoryImport />} />
          </Route>

          {/* OWNER-ONLY — the cost moat (D-009) + owner-scoped account surfaces. Even a Manager who
              holds view_costs must NOT reach /costs by URL. Add Business is an account action. */}
          <Route element={<PermissionRoute permission="owner-only" />}>
            <Route path="/costs"             element={<CostToProduce />} />
            <Route path="/add-business"      element={<AddBusiness />} />
          </Route>

          {/* CUSTOMERS — `customers:read` (STD-020 · David's ruling 2026-07-24). The ROUTE checks
              the SAME permission the TABLE checks (customers_member RLS gates SELECT on
              is_active_member AND has_permission('view_customers'), 20260710) — the principle
              applied: route and data agree. The old literal "owner-only" gate was UNHOLDABLE by any
              member, so /customers was unreachable at ANY permission WHILE the table already granted
              managers SELECT — locked at the door, vault standing open. Owner passes (can() short-
              circuits). A member without view_customers is refused at entry AND filtered by RLS. */}
          <Route element={<PermissionRoute permission="customers:read" />}>
            <Route path="/customers"         element={<Customers />} />
            <Route path="/customers/:id"     element={<CustomerDetail />} />
          </Route>
        </Route>
      </Route>

      {/* DEMO — QB invoice preview (no auth, for demo fallback) */}
      <Route path="/demo/quickbooks-invoice" element={<DemoQBInvoice />} />

      {/* INTERNAL — discovery inspect tool (no auth — David-only, URL is the gate) */}
      <Route path="/discovery/inspect" element={<DiscoveryInspect />} />

      {/* DEFAULT */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
