import type { DocumentData, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore';
import { firebase } from '../../lib/firebase';

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  ticketId?: string;
  category?: string;
  createdAt?: unknown;
  readAt?: unknown;
  archivedAt?: unknown;
};

export type NotificationHistoryPage = {
  items: NotificationRecord[];
  cursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
};

export async function watchNotifications(
  uid: string,
  onNotifications: (notifications: NotificationRecord[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  if (!firebase.app) throw new Error('Notificações indisponíveis sem uma sessão Firebase.');
  const { collection, getFirestore, limit, onSnapshot, orderBy, query } = await import('firebase/firestore');
  const db = getFirestore(firebase.app, firebase.databaseId);
  const notificationsQuery = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(notificationsQuery, (snapshot) => {
    onNotifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as NotificationRecord));
  }, onError);
}

export async function fetchNotificationHistory(
  uid: string,
  cursor?: QueryDocumentSnapshot<DocumentData>,
  pageSize = 40,
): Promise<NotificationHistoryPage> {
  if (!firebase.app) throw new Error('Notificações indisponíveis sem uma sessão Firebase.');
  const { collection, getDocs, getFirestore, limit, orderBy, query, startAfter } = await import('firebase/firestore');
  const db = getFirestore(firebase.app, firebase.databaseId);
  const base = collection(db, 'users', uid, 'notifications');
  const historyQuery = cursor
    ? query(base, orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(base, orderBy('createdAt', 'desc'), limit(pageSize));
  const snapshot = await getDocs(historyQuery);
  return {
    items: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as NotificationRecord),
    cursor: snapshot.docs.at(-1),
    hasMore: snapshot.size === pageSize,
  };
}

export async function archiveOwnNotifications() {
  if (!firebase.app) throw new Error('Notificações indisponíveis sem uma sessão Firebase.');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(firebase.app);
  const clear = httpsCallable<void, { archived: number }>(functions, 'clearOwnNotifications');
  return clear();
}

export async function markNotificationRead(uid: string, notificationId: string) {
  if (!firebase.app) throw new Error('Notificações indisponíveis sem uma sessão Firebase.');
  const { doc, getFirestore, serverTimestamp, updateDoc } = await import('firebase/firestore');
  const db = getFirestore(firebase.app, firebase.databaseId);
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { readAt: serverTimestamp() });
}
