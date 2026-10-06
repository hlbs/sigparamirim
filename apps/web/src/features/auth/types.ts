import type {
  AccountStatus as DomainAccountStatus,
  AuthProvider as DomainAuthProvider,
  UserProfile as DomainUserProfile,
  UserRole as DomainUserRole,
} from '@sig-paramirim/domain';

export type UserRole = DomainUserRole;
export type AccountStatus = DomainAccountStatus;
export type AuthProvider = DomainAuthProvider;
export type UserProfile = DomainUserProfile;

export type AuthStateStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'unavailable'
  | 'error';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
}

export interface AuthState {
  status: AuthStateStatus;
  loading: boolean;
  user: AuthenticatedUser | null;
  profile: UserProfile | null;
  role: UserRole;
  accountStatus: AccountStatus;
  canAccessPlatform: boolean;
  error: string | null;
}
