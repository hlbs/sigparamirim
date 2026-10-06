import type { AccountStatus, UserRole } from './types';

const roles: ReadonlySet<string> = new Set(['user', 'editor', 'admin']);
const accountStatuses: ReadonlySet<string> = new Set(['pending', 'active', 'suspended']);

export interface EffectiveAccess {
  role: UserRole;
  accountStatus: AccountStatus;
  canAccessPlatform: boolean;
}

export function resolveEffectiveAccess(claims: Readonly<Record<string, unknown>>): EffectiveAccess {
  const role = typeof claims.role === 'string' && roles.has(claims.role)
    ? claims.role as UserRole
    : 'user';
  const accountStatus = typeof claims.accountStatus === 'string' && accountStatuses.has(claims.accountStatus)
    ? claims.accountStatus as AccountStatus
    : 'pending';

  return {
    role,
    accountStatus,
    canAccessPlatform: accountStatus === 'active',
  };
}

