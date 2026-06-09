import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './components/layout/PrivateRoute';
import { Login }     from './pages/Login';
import { Dashboard } from './pages/Dashboard';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
