import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../features/auth';
import { AuthLoading } from './AuthLoading';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return children;
}

export function RoleRoute({ children, allowed }: { children: React.ReactNode; allowed: UserRole[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  if (!allowed.includes(user.role)) return <Navigate to="/acesso-restrito" replace />;
  return children;
}
