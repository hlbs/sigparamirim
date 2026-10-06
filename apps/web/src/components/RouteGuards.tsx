import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../features/auth';
import { AuthLoading } from './AuthLoading';

type AccessDecision = 'loading' | 'login' | 'account-status' | 'allow';

export function resolveAccessDecision({
  loading,
  hasUser,
  canAccessPlatform,
}: {
  loading: boolean;
  hasUser: boolean;
  canAccessPlatform: boolean;
}): AccessDecision {
  if (loading) return 'loading';
  if (!hasUser) return 'login';
  if (!canAccessPlatform) return 'account-status';
  return 'allow';
}

export function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, canAccessPlatform } = useAuth();
  const location = useLocation();
  const decision = resolveAccessDecision({ loading, hasUser: Boolean(user), canAccessPlatform });
  const destination = `${location.pathname}${location.search}${location.hash}`;

  if (decision === 'loading') return <AuthLoading />;
  if (decision === 'login') return <Navigate to="/entrar" replace state={{ from: destination }} />;
  if (decision === 'account-status') return <Navigate to="/status-conta" replace />;
  return children;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, canAccessPlatform } = useAuth();
  const location = useLocation();
  const decision = resolveAccessDecision({ loading, hasUser: Boolean(user), canAccessPlatform });
  const destination = `${location.pathname}${location.search}${location.hash}`;

  if (decision === 'loading') return <AuthLoading />;
  if (decision === 'login') return <Navigate to="/entrar" replace state={{ from: destination }} />;
  if (decision === 'account-status') return <Navigate to="/status-conta" replace />;
  return children;
}

export function RoleRoute({ children, allowed }: { children: React.ReactNode; allowed: UserRole[] }) {
  const { user, loading, canAccessPlatform } = useAuth();
  const location = useLocation();
  const decision = resolveAccessDecision({ loading, hasUser: Boolean(user), canAccessPlatform });
  const destination = `${location.pathname}${location.search}${location.hash}`;

  if (decision === 'loading') return <AuthLoading />;
  if (decision === 'login') return <Navigate to="/entrar" replace state={{ from: destination }} />;
  if (decision === 'account-status') return <Navigate to="/status-conta" replace />;
  if (!user) return null;
  if (!allowed.includes(user.role)) return <Navigate to="/acesso-restrito" replace />;
  return children;
}
