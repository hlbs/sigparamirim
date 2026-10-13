import type { Unsubscribe } from 'firebase/firestore';
import { firebase } from '../../lib/firebase';

export type AdminUser = {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string | null;
  role: 'user' | 'editor' | 'admin';
  accountStatus: 'pending' | 'active' | 'suspended';
  institution?: string;
  updatedAt?: unknown;
};

export type AuditRecord = {
  id: string;
  type?: string;
  actorUid?: string;
  targetUid?: string;
  createdAt?: unknown;
  justification?: string;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
};

async function getDatabase() {
  if (!firebase.app) throw new Error('A administração requer uma sessão Firebase configurada.');
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(firebase.app, firebase.databaseId);
}

export async function watchAdminUsers(onUsers: (users: AdminUser[]) => void, onError: (error: Error) => void): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, query }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  return onSnapshot(query(collection(db, 'users'), limit(250)), (snapshot) => {
    const users = snapshot.docs.map((document) => ({ uid: document.id, ...document.data() }) as AdminUser);
    users.sort((left, right) => (left.displayName || left.email || '').localeCompare(right.displayName || right.email || '', 'pt-BR'));
    onUsers(users);
  }, onError);
}

export async function watchAuditRecords(onRecords: (records: AuditRecord[]) => void, onError: (error: Error) => void): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, orderBy, query }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  return onSnapshot(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
    onRecords(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as AuditRecord));
  }, onError);
}

export async function updateAdminUserAccess(input: {
  uid: string;
  role: AdminUser['role'];
  accountStatus: AdminUser['accountStatus'];
  justification: string;
}) {
  if (!firebase.app) throw new Error('A administração requer uma sessão Firebase configurada.');
  const [{ httpsCallable, getFunctions }] = await Promise.all([import('firebase/functions')]);
  const callable = httpsCallable<typeof input, { ok: boolean }>(getFunctions(firebase.app, 'us-central1'), 'adminUpdateUserAccess');
  return (await callable(input)).data;
}
