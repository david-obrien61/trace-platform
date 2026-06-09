import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PrivateRoute }    from './components/layout/PrivateRoute';
import { PlantProfile }    from './pages/PlantProfile';
import { AddOns }          from './pages/AddOns';
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
import { OnboardingWizard } from './pages/OnboardingWizard';
import { DeliveryRoute }    from './pages/DeliveryRoute';
import { Settings }          from './pages/Settings';
import { Campaigns }         from './pages/Campaigns';
import { CampaignDetail }    from './pages/CampaignDetail';
import { AddBusiness }       from './pages/AddBusiness';
import { DiscoveryInspect }  from './pages/DiscoveryInspect';
import PMI                   from './pages/PMI';
import { AcceptInvite }      from '@trace/shared/auth';
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

export function AppRouter() {
  return (
    <Routes>
      {/* PUBLIC — no auth needed */}
      <Route path="/plant/:tagId"        element={<PlantProfile />} />
      <Route path="/plant/:tagId/addons" element={<AddOns />} />
      <Route path="/checkout/customer"   element={<CustomerCapture />} />
      <Route path="/checkout/review"     element={<CartReview />} />
      <Route path="/checkout/confirm"    element={<Confirmation />} />

      {/* AUTH */}
      <Route path="/login"   element={<Login />} />
      <Route path="/signup"  element={<SignUp />} />
      <Route path="/join"    element={<AcceptInvitePage />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms"   element={<Terms />} />
      <Route path="/help"    element={<Help />} />

      {/* PRIVATE — nursery owner/staff */}
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/orders"       element={<Orders />} />
        <Route path="/deliveries"   element={<DeliveryRoute />} />
        <Route path="/social/setup" element={<SocialSetup />} />
        <Route path="/settings"          element={<Settings />} />
        <Route path="/onboarding"        element={<OnboardingWizard />} />
        <Route path="/campaigns"         element={<Campaigns />} />
        <Route path="/campaigns/:id"     element={<CampaignDetail />} />
        <Route path="/pmi"               element={<PMI />} />
        <Route path="/add-business"      element={<AddBusiness />} />
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
