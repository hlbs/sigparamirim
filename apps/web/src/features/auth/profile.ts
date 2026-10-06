import type { User } from 'firebase/auth';
import { firebase } from '../../lib/firebase';
import type { UserProfile } from './types';

function safeDisplayName(user: User): string {
  const explicitName = user.displayName?.trim();
  if (explicitName) return explicitName;

  const emailPrefix = user.email?.split('@')[0]?.trim();
  return emailPrefix || 'Usuário';
}

function providerIds(user: User): string[] {
  return [...new Set(user.providerData.map((provider) => provider.providerId).filter(Boolean))];
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  if (!firebase.app) {
    throw new Error('O Firebase não está configurado para este ambiente.');
  }

  const [firestoreModule, functionsModule] = await Promise.all([
    import('firebase/firestore'),
    import('firebase/functions'),
  ]);
  const db = firestoreModule.getFirestore(firebase.app, firebase.databaseId);
  const functions = functionsModule.getFunctions(firebase.app);
  const reference = firestoreModule.doc(db, 'users', user.uid);
  const bootstrapProfile = functionsModule.httpsCallable(functions, 'bootstrapProfile');
  await bootstrapProfile();
  await user.getIdToken(true);
  await firestoreModule.updateDoc(reference, {
    displayName: safeDisplayName(user),
    photoURL: user.photoURL,
    providerIds: providerIds(user),
    lastLoginAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
  });

  const updatedSnapshot = await firestoreModule.getDoc(reference);
  if (!updatedSnapshot.exists()) {
    throw new Error('Não foi possível criar o perfil do usuário.');
  }

  return updatedSnapshot.data() as UserProfile;
}
