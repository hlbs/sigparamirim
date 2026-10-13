import type { Unsubscribe } from 'firebase/firestore';
import { firebase } from '../../lib/firebase';

export type EditorialChange = {
  id: string;
  resourceType: 'layer' | 'dashboard' | 'publication';
  resourceId: string;
  operation: 'create' | 'update' | 'archive';
  summary: string;
  payload: Record<string, unknown>;
  status: string;
  requestedBy: string;
  requestedAt?: unknown;
};

async function getFunctionsClient() {
  if (!firebase.app) throw new Error('O fluxo editorial requer uma sessão Firebase configurada.');
  const { getFunctions } = await import('firebase/functions');
  return getFunctions(firebase.app, 'us-central1');
}

async function getDatabase() {
  if (!firebase.app) throw new Error('O fluxo editorial requer uma sessão Firebase configurada.');
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(firebase.app, firebase.databaseId);
}

export async function uploadLayerDraft(uid: string, requestId: string, file: File) {
  if (!firebase.app) throw new Error('O fluxo editorial requer uma sessão Firebase configurada.');
  const { getStorage, ref, uploadBytesResumable } = await import('firebase/storage');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileId = `${crypto.randomUUID()}-${safeName}`;
  const path = `staging/${uid}/${requestId}/${fileId}`;
  const task = uploadBytesResumable(ref(getStorage(firebase.app), path), file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: 'private,max-age=0,no-transform',
  });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', undefined, reject, () => resolve());
  });
  return { stagingPath: path, fileName: safeName, contentType: file.type || 'application/octet-stream' };
}

export async function submitLayerChange(input: {
  requestId: string;
  resourceId: string;
  operation: 'create' | 'update' | 'archive';
  summary: string;
  payload: Record<string, unknown>;
}) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { id: string; status: 'pending' | 'approved' }>(functions, 'submitChangeRequest');
  return (await callable(input)).data;
}

export async function watchEditorialChanges(
  uid: string,
  isAdmin: boolean,
  onChanges: (changes: EditorialChange[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, orderBy, query, where }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  const base = collection(db, 'changeRequests');
  const changesQuery = isAdmin
    ? query(base, orderBy('requestedAt', 'desc'), limit(100))
    : query(base, where('requestedBy', '==', uid), limit(100));
  return onSnapshot(changesQuery, (snapshot) => {
    const changes = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as EditorialChange);
    changes.sort((left, right) => String(right.requestedAt ?? '').localeCompare(String(left.requestedAt ?? '')));
    onChanges(changes);
  }, onError);
}

export async function watchPublishedLayers(
  onLayers: (layers: Array<Record<string, unknown> & { id: string }>) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, onSnapshot, query, where }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  return onSnapshot(query(collection(db, 'layers'), where('status', 'in', ['published', 'archived'])), (snapshot) => {
    onLayers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  }, onError);
}

export async function reviewEditorialChange(input: { requestId: string; decision: 'approved' | 'rejected'; justification: string }) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { id: string; status: 'approved' | 'rejected' }>(functions, 'reviewChangeRequest');
  return (await callable(input)).data;
}

export async function migrateLegacyGeospatial() {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<void, { status: string; migrated: number; skipped: number }>(functions, 'migrateLegacyGeospatialToStorage', { timeout: 540_000 });
  return (await callable()).data;
}
