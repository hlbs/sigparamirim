import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { authPersistenceReady, firebase } from '../../lib/firebase';

function requireAuth() {
  if (!firebase.auth) {
    throw new Error('O Firebase Authentication não está configurado para este ambiente.');
  }
  return firebase.auth;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  await authPersistenceReady;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(requireAuth(), provider);
}

export async function signOutUser(): Promise<void> {
  await signOut(requireAuth());
}
