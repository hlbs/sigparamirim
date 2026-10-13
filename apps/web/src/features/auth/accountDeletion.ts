import { firebase } from '../../lib/firebase';

export async function requestAccountDeletion() {
  if (!firebase.app) throw new Error('O Firebase não está configurado para este ambiente.');
  const functionsSdk = await import('firebase/functions');
  const functions = functionsSdk.getFunctions(firebase.app);
  return functionsSdk.httpsCallable<void, { deletionPurgeAt: string }>(functions, 'requestOwnAccountDeletion')();
}

export async function cancelAccountDeletion() {
  if (!firebase.app) throw new Error('O Firebase não está configurado para este ambiente.');
  const functionsSdk = await import('firebase/functions');
  const functions = functionsSdk.getFunctions(firebase.app);
  return functionsSdk.httpsCallable<void, { ok: true }>(functions, 'cancelOwnAccountDeletion')();
}
