import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  type AuthProvider as FirebaseAuthProvider,
  type UserCredential,
} from 'firebase/auth';
import { authPersistenceReady, firebase } from '../../lib/firebase';
import type { AuthProvider } from './types';

function requireAuth() {
  if (!firebase.auth) {
    throw new Error('O Firebase Authentication não está configurado para este ambiente.');
  }
  return firebase.auth;
}

function createProvider(provider: AuthProvider): FirebaseAuthProvider {
  switch (provider) {
    case 'google': {
      const google = new GoogleAuthProvider();
      google.setCustomParameters({ prompt: 'select_account' });
      return google;
    }
    case 'facebook': {
      const facebook = new FacebookAuthProvider();
      facebook.addScope('email');
      return facebook;
    }
    case 'microsoft': {
      const microsoft = new OAuthProvider('microsoft.com');
      microsoft.addScope('openid');
      microsoft.addScope('email');
      microsoft.addScope('profile');
      microsoft.setCustomParameters({ prompt: 'select_account' });
      return microsoft;
    }
    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Provedor de autenticação inválido: ${String(exhaustiveCheck)}`);
    }
  }
}

export async function signInWithProvider(provider: AuthProvider): Promise<UserCredential> {
  await authPersistenceReady;
  return signInWithPopup(requireAuth(), createProvider(provider));
}

export async function signOutUser(): Promise<void> {
  await signOut(requireAuth());
}

