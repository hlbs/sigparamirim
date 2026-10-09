import type { Unsubscribe } from 'firebase/firestore';
import { firebase } from '../../lib/firebase';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
export type TicketPriority = 'normal' | 'high';
export type TicketCategory = 'access' | 'map' | 'data' | 'dashboard' | 'bug' | 'other';
export type TicketRecord = {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  messageCount: number;
  lastMessagePreview?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastMessageAt?: unknown;
};
export type TicketMessage = {
  id: string;
  authorUid: string;
  authorName: string;
  authorRole: 'user' | 'editor' | 'admin';
  body: string;
  createdAt?: unknown;
};
export type TicketEvent = {
  id: string;
  action: string;
  from: TicketStatus | null;
  to: TicketStatus;
  actorUid: string;
  actorName: string;
  actorRole: 'user' | 'editor' | 'admin';
  createdAt?: unknown;
};

async function getDatabase() {
  if (!firebase.app) throw new Error('O Helpdesk requer uma sessão Firebase configurada.');
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(firebase.app, firebase.databaseId);
}

async function getFunctionsClient() {
  if (!firebase.app) throw new Error('O Helpdesk requer uma sessão Firebase configurada.');
  const { getFunctions } = await import('firebase/functions');
  return getFunctions(firebase.app, 'us-central1');
}

export async function watchTickets(
  ownerUid: string,
  isAdmin: boolean,
  onTickets: (tickets: TicketRecord[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, orderBy, query, where }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  const base = collection(db, 'tickets');
  const ticketsQuery = isAdmin
    ? query(base, orderBy('updatedAt', 'desc'), limit(150))
    : query(base, where('ownerUid', '==', ownerUid), orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(ticketsQuery, (snapshot) => {
    onTickets(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as TicketRecord));
  }, (error) => onError(error));
}

export async function watchTicketMessages(
  ticketId: string,
  onMessages: (messages: TicketMessage[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, orderBy, query }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  const messagesQuery = query(collection(db, 'tickets', ticketId, 'messages'), orderBy('createdAt', 'asc'), limit(500));
  return onSnapshot(messagesQuery, (snapshot) => {
    onMessages(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as TicketMessage));
  }, onError);
}

export async function watchTicketEvents(
  ticketId: string,
  onEvents: (events: TicketEvent[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, orderBy, query }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  const eventsQuery = query(collection(db, 'tickets', ticketId, 'events'), orderBy('createdAt', 'asc'), limit(500));
  return onSnapshot(eventsQuery, (snapshot) => {
    onEvents(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as TicketEvent));
  }, onError);
}

export async function createTicket(input: { subject: string; category: TicketCategory; priority: TicketPriority; message: string }) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { ticketId: string; status: TicketStatus }>(functions, 'createTicket');
  return (await callable(input)).data;
}

export async function replyToTicket(input: { ticketId: string; message: string }) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { ticketId: string }>(functions, 'replyToTicket');
  return (await callable(input)).data;
}

export async function updateTicketStatus(input: { ticketId: string; status: TicketStatus }) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { ticketId: string; status: TicketStatus }>(functions, 'updateTicketStatus');
  return (await callable(input)).data;
}
