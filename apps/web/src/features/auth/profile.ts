import type { User } from 'firebase/auth';
import { firebase } from '../../lib/firebase';
import type { UserProfile } from './types';

function safeDisplayName(user: User): string {
  const explicitName = user.displayName?.trim();
  if (explicitName) return explicitName;

  const emailPrefix = user.email?.split('@')[0]?.trim();
  return emailPrefix || 'Usuário';
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
    lastLoginAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
  });

  const updatedSnapshot = await firestoreModule.getDoc(reference);
  if (!updatedSnapshot.exists()) {
    throw new Error('Não foi possível criar o perfil do usuário.');
  }

  return updatedSnapshot.data() as UserProfile;
}

export type EditableProfileFields = Pick<UserProfile, 'displayName' | 'bio' | 'lattesUrl' | 'institution' | 'educationLevel' | 'country' | 'state' | 'city' | 'contactEmail'>;

export async function updateUserProfile(fields: EditableProfileFields, avatar?: Blob): Promise<void> {
  if (!firebase.app) throw new Error('O Firebase não está configurado para este ambiente.');
  const user = firebase.auth?.currentUser;
  if (!user) throw new Error('É necessário estar autenticado para editar o perfil.');
  const [{ getFirestore, doc, updateDoc, serverTimestamp }, { getStorage, ref, uploadBytes, getDownloadURL }] = await Promise.all([
    import('firebase/firestore'),
    import('firebase/storage'),
  ]);
  const db = getFirestore(firebase.app, firebase.databaseId);
  let photoURL = user.photoURL;
  if (avatar) {
    const storage = getStorage(firebase.app);
    const avatarRef = ref(storage, `avatars/${user.uid}/profile-${Date.now()}.jpg`);
    await uploadBytes(avatarRef, avatar, { contentType: 'image/jpeg', cacheControl: 'public,max-age=3600' });
    photoURL = await getDownloadURL(avatarRef);
  }
  await updateDoc(doc(db, 'users', user.uid), {
    ...fields,
    photoURL,
    updatedAt: serverTimestamp(),
  });
  const { updateProfile } = await import('firebase/auth');
  await updateProfile(user, { displayName: fields.displayName || user.displayName, photoURL });
}
