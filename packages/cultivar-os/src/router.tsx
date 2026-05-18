import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute }    from './components/layout/PrivateRoute';
import { PlantProfile }    from './pages/PlantProfile';
import { AddOns }          from './pages/AddOns';
import { CustomerCapture } from './pages/CustomerCapture';
import { CartReview }      from './pages/CartReview';
import { Confirmation }    from './pages/Confirmation';
import { Login }           from './pages/Login';
import { Dashboard }       from './pages/Dashboard';

export function AppRouter() {
  return (
    <Routes>
      {/* PUBLIC — no auth needed */}
      <Route path="/plant/:tagId"        element={<PlantProfile />} />
      <Route path="/plant/:tagId/addons" element={<AddOns />} />
      <Route path="/checkout/customer"   element={<CustomerCapture />} />
      <Route path="/checkout/review"     element={<CartReview />} />
      <Route path="/checkout/confirm"    element={<Confirmation />} />

      {/* PRIVATE — nursery owner/staff */}
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      {/* DEFAULT */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
