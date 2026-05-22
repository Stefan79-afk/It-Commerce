import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { loggedIn, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return loggedIn ? <Outlet /> : <Navigate to="/login" replace />;
}
