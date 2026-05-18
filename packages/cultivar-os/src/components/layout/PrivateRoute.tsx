import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function PrivateRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="skeleton" style={{ width: 120, height: 20, borderRadius: 4 }} />
      </div>
    );
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
