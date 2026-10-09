import type { Unsubscribe } from 'firebase/firestore';
import { firebase } from '../../lib/firebase';

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  ticketId?: string;
  createdAt?: unknown;
  readAt?: unknown;
};

export async function watchNotifications(
  uid: string,
  onNotifications: (notifications: NotificationRecord[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  if (!firebase.app) throw new Error('Notificações indisponíveis sem uma sessão Firebase.');
  const { collection, getFirestore, limit, onSnapshot, orderBy, query } = await import('firebase/firestore');
  const db = getFirestore(firebase.app, firebase.databaseId);
  const notificationsQuery = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(notificationsQuery, (snapshot) => {
    onNotifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as NotificationRecord));
  }, onError);
}

export async function markNotificationRead(uid: string, notificationId: string) {
  if (!firebase.app) throw new Error('Notificações indisponíveis sem uma sessão Firebase.');
  const { doc, getFirestore, serverTimestamp, updateDoc } = await import('firebase/firestore');
  const db = getFirestore(firebase.app, firebase.databaseId);
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { readAt: serverTimestamp() });
}
