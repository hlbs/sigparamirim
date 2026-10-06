export type UserRole = 'user' | 'editor' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended';

export type AuthProvider = 'google' | 'facebook' | 'microsoft';

export interface UserPreferences {
  language: 'pt-BR' | 'en' | 'es' | 'fr' | 'zh-CN' | 'de' | 'ar';
  theme: 'light' | 'dark' | 'system';
  notificationPreferences?: {
    email: boolean;
    inApp: boolean;
  };
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  providerIds: string[];
  language: UserPreferences['language'];
  theme: UserPreferences['theme'];
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export * from './editorial.js';
