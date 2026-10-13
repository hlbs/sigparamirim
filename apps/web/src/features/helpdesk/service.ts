import type { Unsubscribe } from 'firebase/firestore';
import { firebase } from '../../lib/firebase';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed' | 'cancelled';
export type TicketPriority = 'normal' | 'high';
export type TicketCategory = 'access' | 'map' | 'data' | 'dashboard' | 'bug' | 'other';
export type TicketRecord = {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  messageCount: number;
  lastMessagePreview?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastMessageAt?: unknown;
};
export type TicketPriorityRecord = { id: string; priority: TicketPriority };
export type TicketAttachment = {
  storagePath: string;
  fileName: string;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/pdf';
  size: number;
  url?: string;
};
export type TicketMessage = {
  id: string;
  authorUid: string;
  authorName: string;
  authorRole: 'user' | 'editor' | 'admin';
  body: string;
  authorPhotoURL?: string | null;
  attachments?: TicketAttachment[];
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

export async function watchTicketPriorities(
  onPriorities: (priorities: TicketPriorityRecord[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, onSnapshot }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  return onSnapshot(collection(db, 'ticketManagement'), (snapshot) => {
    onPriorities(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as TicketPriorityRecord));
  }, onError);
}

export async function watchTicketMessages(
  ticketId: string,
  onMessages: (messages: TicketMessage[]) => void,
  onError: (error: Error) => void,
): Promise<Unsubscribe> {
  const [{ collection, limit, onSnapshot, orderBy, query }, db] = await Promise.all([import('firebase/firestore'), getDatabase()]);
  const messagesQuery = query(collection(db, 'tickets', ticketId, 'messages'), orderBy('createdAt', 'asc'), limit(500));
  let latestSnapshot = 0;
  return onSnapshot(messagesQuery, (snapshot) => {
    const snapshotNumber = ++latestSnapshot;
    void Promise.all(snapshot.docs.map(async (document) => {
      const message = { id: document.id, ...document.data() } as TicketMessage;
      if (!message.attachments?.length) return message;
      const { getDownloadURL, getStorage, ref } = await import('firebase/storage');
      const storage = getStorage(firebase.app!);
      const attachments = await Promise.all(message.attachments.map(async (attachment) => {
        try { return { ...attachment, url: await getDownloadURL(ref(storage, attachment.storagePath)) }; }
        catch { return attachment; }
      }));
      return { ...message, attachments };
    })).then((messages) => { if (snapshotNumber === latestSnapshot) onMessages(messages); }).catch(onError);
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

export const allowedTicketAttachmentTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'] as const;
export const maxTicketAttachments = 5;
export const maxTicketAttachmentBytes = 15 * 1024 * 1024;

type UploadedTicketAttachment = Omit<TicketAttachment, 'url'>;

async function uploadTicketAttachments(ownerUid: string, ticketId: string, messageId: string, files: File[]) {
  if (files.length > maxTicketAttachments) throw new Error(`É possível anexar até ${maxTicketAttachments} arquivos por mensagem.`);
  if (files.some((file) => !allowedTicketAttachmentTypes.includes(file.type as typeof allowedTicketAttachmentTypes[number]) || file.size > maxTicketAttachmentBytes || file.size === 0)) {
    throw new Error('Anexe imagens PNG, JPEG, WEBP ou GIF, ou arquivos PDF de até 15 MB cada.');
  }
  if (!files.length) return { attachments: [] as UploadedTicketAttachment[], cleanup: async () => undefined };
  if (!firebase.app) throw new Error('O Helpdesk requer uma sessão Firebase configurada.');
  const { deleteObject, getStorage, ref, uploadBytes } = await import('firebase/storage');
  const storage = getStorage(firebase.app);
  const uploaded: UploadedTicketAttachment[] = [];
  const cleanup = async () => Promise.all(uploaded.map(async (attachment) => {
    try { await deleteObject(ref(storage, attachment.storagePath)); } catch { /* best-effort cleanup when the message was not saved */ }
  }));
  try {
    for (const file of files) {
      const fileId = crypto.randomUUID();
      const storagePath = `tickets/${ownerUid}/${ticketId}/${messageId}/${fileId}`;
      await uploadBytes(ref(storage, storagePath), file, { contentType: file.type, customMetadata: { originalName: file.name.slice(0, 180) } });
      uploaded.push({ storagePath, fileName: file.name.slice(0, 180), contentType: file.type as typeof allowedTicketAttachmentTypes[number], size: file.size });
    }
    return { attachments: uploaded, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function createTicket(input: { subject: string; category: TicketCategory; message: string; ownerUid: string; files: File[] }) {
  const [{ collection, doc }, { httpsCallable }, db, functions] = await Promise.all([
    import('firebase/firestore'), import('firebase/functions'), getDatabase(), getFunctionsClient(),
  ]);
  const ticketId = doc(collection(db, 'tickets')).id;
  const messageId = doc(collection(db, 'tickets', ticketId, 'messages')).id;
  const upload = await uploadTicketAttachments(input.ownerUid, ticketId, messageId, input.files);
  const request = { ticketId, messageId, attachments: upload.attachments, subject: input.subject, category: input.category, message: input.message };
  const callable = httpsCallable<typeof request, { ticketId: string; status: TicketStatus }>(functions, 'createTicket');
  try { return (await callable(request)).data; }
  catch (error) { await upload.cleanup(); throw error; }
}

export async function updateTicketPriority(input: { ticketId: string; priority: TicketPriority }) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { ticketId: string; priority: TicketPriority }>(functions, 'updateTicketPriority');
  return (await callable(input)).data;
}

export async function migrateLegacyTicketPriorities() {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<void, { migrated: number }>(functions, 'migrateLegacyTicketPriorities', { timeout: 300_000 });
  return (await callable()).data;
}

export async function replyToTicket(input: { ticketId: string; ownerUid: string; message: string; files: File[] }) {
  const [{ collection, doc }, { httpsCallable }, db, functions] = await Promise.all([
    import('firebase/firestore'), import('firebase/functions'), getDatabase(), getFunctionsClient(),
  ]);
  const messageId = doc(collection(db, 'tickets', input.ticketId, 'messages')).id;
  const upload = await uploadTicketAttachments(input.ownerUid, input.ticketId, messageId, input.files);
  const request = { ticketId: input.ticketId, messageId, message: input.message, attachments: upload.attachments };
  const callable = httpsCallable<typeof request, { ticketId: string }>(functions, 'replyToTicket');
  try { return (await callable(request)).data; }
  catch (error) { await upload.cleanup(); throw error; }
}

export async function cancelTicket(ticketId: string) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<{ ticketId: string }, { ticketId: string; status: 'cancelled' }>(functions, 'cancelTicket');
  return (await callable({ ticketId })).data;
}

export async function updateTicketStatus(input: { ticketId: string; status: TicketStatus }) {
  const [{ httpsCallable }, functions] = await Promise.all([import('firebase/functions'), getFunctionsClient()]);
  const callable = httpsCallable<typeof input, { ticketId: string; status: TicketStatus }>(functions, 'updateTicketStatus');
  return (await callable(input)).data;
}
