import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PrivateRoute }    from './components/layout/PrivateRoute';
import { AppLayout }       from './components/layout/AppLayout';
import { VIEW_COSTS, PermissionRoute } from '@trace/shared/auth';
import { PERMISSIONS }     from './auth/roles';
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
import { DeliverySchedule } from './pages/DeliverySchedule';
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

          {/* Orders — qr_checkout (STAFF holds it; guarded for completeness so the class has no gap).
              /checkout/scan is the multi-item scan-loop front door (needs businessId + inventory RLS). */}
          <Route element={<PermissionRoute permission={PERMISSIONS.QR_CHECKOUT} />}>
            <Route path="/orders"       element={<Orders />} />
            <Route path="/orders/:id"   element={<OrderDetail />} />
            <Route path="/checkout/scan" element={<ScanOrder />} />
          </Route>

          {/* Delivery — manage_deliveries (STAFF lacks it → refused at entry, was URL-reachable). */}
          <Route element={<PermissionRoute permission={PERMISSIONS.MANAGE_DELIVERIES} />}>
            <Route path="/deliveries"        element={<DeliveryRoute />} />
            <Route path="/delivery-schedule" element={<DeliverySchedule />} />
          </Route>

          {/* Social + Campaigns — manage_campaigns. Campaign Scheduler is the reported bug: STAFF
              reached /campaigns via the dashboard card despite lacking this permission. Now every
              door (tile, deep link, typed URL) is refused at route entry. */}
          <Route element={<PermissionRoute permission={PERMISSIONS.MANAGE_CAMPAIGNS} />}>
            <Route path="/social/setup" element={<SocialSetup />} />
            <Route path="/campaigns"         element={<Campaigns />} />
            <Route path="/campaigns/:id"     element={<CampaignDetail />} />
          </Route>

          {/* Business administration — manage_settings (held by OWNER alone in Cultivar today).
              Section-isolated Settings destinations (RULE 2a) — /settings/business, /settings/
              accounting land on JUST that section; /settings/all renders the FULL business-settings
              page (Services/Team/cost config). AGNOSTIC member/device console (D-31): invite + roles
              (visibility axis) + devices. /roles REDIRECTS here (the old page is superseded). Admin
              landing index — each card additionally respects its own permission. */}
          <Route element={<PermissionRoute permission={PERMISSIONS.MANAGE_SETTINGS} />}>
            <Route path="/settings/:section" element={<Settings />} />
            <Route path="/team"            element={<TeamConsole />} />
            <Route path="/roles"           element={<Navigate to="/team" replace />} />
            {/* Discounts — customer discount types × tiers (pricing authority). WRITE gated here at
                manage_settings (owner in Cultivar today); the READ of the set stays business-scoped
                in the data layer (roster picker + checkout resolve it independently of this route). */}
            <Route path="/discounts"       element={<Discounts />} />
            <Route path="/admin"           element={<AdminIndex />} />
          </Route>

          {/* COST-ANALYSIS surfaces — require view_costs (decision 2026-06-21, Phase 3/4).
              A low-role member is redirected to /dashboard, so the cost SELECT never fires.
              /receipts joins this group (registry receipt_keeper tile → view_costs). */}
          <Route element={<PermissionRoute permission={VIEW_COSTS} />}>
            <Route path="/receipts"          element={<ReceiptKeeper />} />
            <Route path="/assets"            element={<BusinessAssets />} />
            <Route path="/assets/capture"    element={<AssetCapture />} />
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
            <Route path="/operating-costs"   element={<OperatingCosts />} />
            <Route path="/pmi"               element={<PMI />} />
          </Route>

          {/* OWNER-ONLY — the cost moat (D-009) + owner-scoped RLS surfaces. Even a Manager who
              holds view_costs must NOT reach /costs by URL. Matches the registry tiles
              (required_permission=owner-only) so nav AND route agree. Add Business is an account
              action; Customers matches customers_business_owner RLS (owner-only). */}
          <Route element={<PermissionRoute permission="owner-only" />}>
            <Route path="/costs"             element={<CostToProduce />} />
            <Route path="/customers"         element={<Customers />} />
            <Route path="/customers/:id"     element={<CustomerDetail />} />
            <Route path="/add-business"      element={<AddBusiness />} />
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
