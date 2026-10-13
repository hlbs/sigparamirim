import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

const appCheckEnabled = process.env.ENFORCE_APP_CHECK === 'true';
const roleSchema = z.enum(['user', 'editor', 'admin']);
const accountStatusSchema = z.enum(['pending', 'active', 'suspended']);
const ticketStatusSchema = z.enum(['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'cancelled']);
const prioritySchema = z.enum(['normal', 'high']);
const categorySchema = z.enum(['access', 'map', 'data', 'dashboard', 'bug', 'other']);
const ticketIdSchema = z.string().regex(/^[A-Za-z0-9_-]{20}$/);
const messageIdSchema = z.string().regex(/^[A-Za-z0-9_-]{20}$/);
const attachmentSchema = z.object({
  storagePath: z.string().min(1).max(1024),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']),
  size: z.number().int().positive().max(15 * 1024 * 1024),
});
const createTicketSchema = z.object({
  ticketId: ticketIdSchema.optional(),
  messageId: messageIdSchema.optional(),
  attachments: z.array(attachmentSchema).max(5).default([]),
  subject: z.string().trim().min(5).max(140),
  category: categorySchema,
  message: z.string().trim().min(20).max(5_000),
});
const replySchema = z.object({ ticketId: ticketIdSchema, message: z.string().trim().min(2).max(5_000), messageId: messageIdSchema, attachments: z.array(attachmentSchema).max(5).default([]) });
const statusSchema = z.object({ ticketId: ticketIdSchema, status: ticketStatusSchema });
const priorityUpdateSchema = z.object({ ticketId: ticketIdSchema, priority: prioritySchema });
const cancelSchema = z.object({ ticketId: ticketIdSchema });

type Actor = { uid: string; role: z.infer<typeof roleSchema>; name: string; email: string; photoURL: string | null };
type TicketStatus = z.infer<typeof ticketStatusSchema>;
type NotificationInput = { type: string; title: string; body: string; ticketId: string };

function getDb() { return getFirestore('sigparamirimdb'); }

async function requireActiveActor(auth: { uid: string; token: Record<string, unknown> } | undefined): Promise<Actor> {
  if (!auth) throw new HttpsError('unauthenticated', 'Entre na plataforma para acessar o atendimento.');
  const profile = await getDb().collection('users').doc(auth.uid).get();
  if (!profile.exists || accountStatusSchema.catch('pending').parse(profile.get('accountStatus')) !== 'active') {
    throw new HttpsError('permission-denied', 'Sua conta não está autorizada a acessar o atendimento.');
  }
  const role = roleSchema.catch('user').parse(profile.get('role'));
  const tokenName = typeof auth.token.name === 'string' ? auth.token.name : '';
  const tokenEmail = typeof auth.token.email === 'string' ? auth.token.email : '';
  return {
    uid: auth.uid,
    role,
    name: String(profile.get('displayName') || tokenName || tokenEmail || 'Usuário SIG Paramirim').slice(0, 120),
    email: String(profile.get('email') || tokenEmail).slice(0, 254),
    photoURL: String(profile.get('photoURL') || auth.token.picture || '').slice(0, 2048) || null,
  };
}

function notify(batch: FirebaseFirestore.WriteBatch, db: FirebaseFirestore.Firestore, uid: string, notification: NotificationInput) {
  const ref = db.collection('users').doc(uid).collection('notifications').doc();
  batch.create(ref, {
    ...notification,
    resourceType: 'ticket',
    resourceId: notification.ticketId,
    createdAt: FieldValue.serverTimestamp(),
    readAt: null,
    archivedAt: null,
  });
}

async function getActiveAdmins(db: FirebaseFirestore.Firestore) {
  return db.collection('users').where('role', '==', 'admin').where('accountStatus', '==', 'active').limit(100).get();
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpsError('invalid-argument', 'Confira os campos do chamado e tente novamente.');
  return result.data;
}

async function validateTicketAttachments(ownerUid: string, ticketId: string, messageId: string | undefined, attachments: z.infer<typeof attachmentSchema>[]) {
  if (attachments.length && !messageId) throw new HttpsError('invalid-argument', 'Não foi possível vincular os anexos à mensagem. Tente novamente.');
  const expectedPrefix = `tickets/${ownerUid}/${ticketId}/${messageId ?? ''}/`;
  const bucket = getStorage().bucket();
  return Promise.all(attachments.map(async (attachment) => {
    const fileId = attachment.storagePath.startsWith(expectedPrefix) ? attachment.storagePath.slice(expectedPrefix.length) : '';
    if (!/^[A-Za-z0-9_-]{36}$/.test(fileId)) throw new HttpsError('invalid-argument', 'Um dos anexos não pertence a este chamado.');
    let metadata: { size?: string | number; contentType?: string };
    try {
      const [fileMetadata] = await bucket.file(attachment.storagePath).getMetadata();
      metadata = fileMetadata;
    } catch {
      throw new HttpsError('failed-precondition', 'Um dos anexos ainda não foi carregado. Tente novamente.');
    }
    if (Number(metadata.size) !== attachment.size || metadata.contentType !== attachment.contentType || attachment.size > 15 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'Os dados de um dos anexos não correspondem ao arquivo enviado.');
    }
    return attachment;
  }));
}

export const createTicket = onCall({ enforceAppCheck: appCheckEnabled, maxInstances: 6 }, async (request) => {
  const actor = await requireActiveActor(request.auth);
  const input = parse(createTicketSchema, request.data);
  const db = getDb();
  const ticketRef = input.ticketId ? db.collection('tickets').doc(input.ticketId) : db.collection('tickets').doc();
  const messageId = input.messageId ?? ticketRef.collection('messages').doc().id;
  const managementRef = db.collection('ticketManagement').doc(ticketRef.id);
  const messageRef = ticketRef.collection('messages').doc(messageId);
  const eventRef = ticketRef.collection('events').doc();
  const attachmentData = await validateTicketAttachments(actor.uid, ticketRef.id, messageId, input.attachments);
  const admins = await getActiveAdmins(db);
  const now = FieldValue.serverTimestamp();
  const ticketLabel = ticketRef.id.slice(0, 8).toUpperCase();
  const batch = db.batch();

  batch.create(ticketRef, {
    ownerUid: actor.uid,
    ownerName: actor.name,
    ownerEmail: actor.email,
    subject: input.subject,
    category: input.category,
    status: 'open',
    messageCount: 1,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  });
  batch.create(managementRef, {
    priority: 'normal',
    updatedAt: now,
    updatedByUid: actor.uid,
  });
  batch.create(messageRef, {
    authorUid: actor.uid,
    authorName: actor.name,
    authorRole: actor.role,
    body: input.message,
    authorPhotoURL: actor.photoURL,
    attachments: attachmentData,
    createdAt: now,
  });
  batch.create(eventRef, {
    action: 'created',
    from: null,
    to: 'open',
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    createdAt: now,
  });
  admins.docs.forEach((admin) => notify(batch, db, admin.id, {
    type: 'ticket_created',
    title: `Novo chamado #${ticketLabel}`,
    body: `${actor.name}: ${input.subject}`,
    ticketId: ticketRef.id,
  }));

  await batch.commit();
  logger.info('Chamado criado.', { ticketId: ticketRef.id, ownerUid: actor.uid, category: input.category });
  return { ticketId: ticketRef.id, status: 'open' as const };
});

export const updateTicketPriority = onCall({ enforceAppCheck: appCheckEnabled, maxInstances: 6 }, async (request) => {
  const actor = await requireActiveActor(request.auth);
  if (actor.role !== 'admin') throw new HttpsError('permission-denied', 'Somente gestores podem classificar a prioridade dos chamados.');
  const input = parse(priorityUpdateSchema, request.data);
  const db = getDb();
  const ticketRef = db.collection('tickets').doc(input.ticketId);
  const managementRef = db.collection('ticketManagement').doc(input.ticketId);
  const auditRef = db.collection('auditLogs').doc();

  await db.runTransaction(async (transaction) => {
    const [ticket, management] = await Promise.all([transaction.get(ticketRef), transaction.get(managementRef)]);
    if (!ticket.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
    const previousPriority = prioritySchema.catch('normal').parse(management.get('priority') ?? ticket.get('priority'));
    if (previousPriority === input.priority) return;
    transaction.set(managementRef, {
      priority: input.priority,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
    }, { merge: true });
    transaction.update(ticketRef, { priority: FieldValue.delete() });
    transaction.create(auditRef, {
      type: 'ticket.priority_changed',
      resourceType: 'ticket',
      resourceId: input.ticketId,
      actorUid: actor.uid,
      actorName: actor.name,
      previousPriority,
      priority: input.priority,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { ticketId: input.ticketId, priority: input.priority };
});

export const migrateLegacyTicketPriorities = onCall({ enforceAppCheck: appCheckEnabled, maxInstances: 2, timeoutSeconds: 300 }, async (request) => {
  const actor = await requireActiveActor(request.auth);
  if (actor.role !== 'admin') throw new HttpsError('permission-denied', 'Somente gestores podem executar a migração da triagem.');
  const db = getDb();
  let migrated = 0;
  let lastDocument: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db.collection('tickets')
      .where('priority', 'in', ['normal', 'high'])
      .orderBy(FieldPath.documentId())
      .limit(400);
    if (lastDocument) query = query.startAfter(lastDocument);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((ticket) => {
      batch.set(db.collection('ticketManagement').doc(ticket.id), {
        priority: prioritySchema.catch('normal').parse(ticket.get('priority')),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
      }, { merge: true });
      batch.update(ticket.ref, { priority: FieldValue.delete() });
    });
    await batch.commit();
    migrated += snapshot.size;
    lastDocument = snapshot.docs.at(-1);
    if (snapshot.size < 400) break;
  }
  logger.info('Triagem antiga de chamados migrada para área restrita.', { migrated, actorUid: actor.uid });
  return { migrated };
});

export const replyToTicket = onCall({ enforceAppCheck: appCheckEnabled, maxInstances: 6 }, async (request) => {
  const actor = await requireActiveActor(request.auth);
  const input = parse(replySchema, request.data);
  const db = getDb();
  const ticketRef = db.collection('tickets').doc(input.ticketId);
  const initial = await ticketRef.get();
  if (!initial.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
  const ownerUid = initial.get('ownerUid');
  const isAdmin = actor.role === 'admin';
  if (!isAdmin && ownerUid !== actor.uid) throw new HttpsError('permission-denied', 'Você não tem acesso a este chamado.');
  if (initial.get('status') === 'cancelled') throw new HttpsError('failed-precondition', 'Este chamado foi cancelado e não aceita novas mensagens.');
  const attachmentData = await validateTicketAttachments(String(ownerUid), input.ticketId, input.messageId, input.attachments);
  const admins = isAdmin ? null : await getActiveAdmins(db);
  const messageRef = ticketRef.collection('messages').doc(input.messageId);
  const eventRef = ticketRef.collection('events').doc();
  const notificationRefs = isAdmin
    ? [db.collection('users').doc(String(ownerUid)).collection('notifications').doc()]
    : (admins?.docs ?? []).map((admin) => admin.ref.collection('notifications').doc());

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ticketRef);
    if (!current.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
    if (!isAdmin && current.get('ownerUid') !== actor.uid) throw new HttpsError('permission-denied', 'Você não tem acesso a este chamado.');
    const previousStatus = ticketStatusSchema.catch('open').parse(current.get('status'));
    if (previousStatus === 'cancelled') throw new HttpsError('failed-precondition', 'Este chamado foi cancelado e não aceita novas mensagens.');
    if (isAdmin && previousStatus === 'closed') throw new HttpsError('failed-precondition', 'Reabra o chamado antes de responder.');
    const nextStatus: TicketStatus = isAdmin ? 'waiting_for_user' : 'open';
    const ticketLabel = input.ticketId.slice(0, 8).toUpperCase();
    transaction.create(messageRef, {
      authorUid: actor.uid,
      authorName: actor.name,
      authorRole: actor.role,
      body: input.message,
      authorPhotoURL: actor.photoURL,
      attachments: attachmentData,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(eventRef, {
      action: previousStatus === 'closed' ? 'reopened_by_requester' : 'reply',
      from: previousStatus,
      to: nextStatus,
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(ticketRef, {
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessagePreview: input.message.slice(0, 180),
      messageCount: Number(current.get('messageCount') ?? 0) + 1,
    });
    notificationRefs.forEach((ref) => transaction.create(ref, {
      type: isAdmin ? 'ticket_reply' : 'ticket_reply',
      title: isAdmin ? `Resposta no chamado #${ticketLabel}` : `Nova resposta no chamado #${ticketLabel}`,
      body: `${actor.name}: ${input.message.slice(0, 150)}`,
      resourceType: 'ticket',
      resourceId: input.ticketId,
      ticketId: input.ticketId,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
      archivedAt: null,
    }));
  });
  logger.info('Resposta adicionada ao chamado.', { ticketId: input.ticketId, actorUid: actor.uid });
  return { ticketId: input.ticketId };
});

export const cancelTicket = onCall({ enforceAppCheck: appCheckEnabled, maxInstances: 6 }, async (request) => {
  const actor = await requireActiveActor(request.auth);
  const input = parse(cancelSchema, request.data);
  const db = getDb();
  const ticketRef = db.collection('tickets').doc(input.ticketId);
  const initial = await ticketRef.get();
  if (!initial.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
  if (initial.get('ownerUid') !== actor.uid) throw new HttpsError('permission-denied', 'Somente quem abriu o chamado pode cancelá-lo.');
  const admins = await getActiveAdmins(db);
  const eventRef = ticketRef.collection('events').doc();
  const ticketLabel = input.ticketId.slice(0, 8).toUpperCase();
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ticketRef);
    if (!current.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
    if (current.get('ownerUid') !== actor.uid) throw new HttpsError('permission-denied', 'Somente quem abriu o chamado pode cancelá-lo.');
    const previousStatus = ticketStatusSchema.catch('open').parse(current.get('status'));
    if (previousStatus === 'closed' || previousStatus === 'cancelled') {
      throw new HttpsError('failed-precondition', 'Este chamado já foi encerrado e não pode ser cancelado.');
    }
    transaction.update(ticketRef, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
    transaction.create(eventRef, {
      action: 'cancelled_by_requester',
      from: previousStatus,
      to: 'cancelled',
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      createdAt: FieldValue.serverTimestamp(),
    });
    admins.docs.forEach((admin) => {
      const notificationRef = admin.ref.collection('notifications').doc();
      transaction.create(notificationRef, {
        type: 'ticket_status',
        title: `Chamado #${ticketLabel} cancelado`,
        body: `${actor.name} cancelou: ${String(current.get('subject') ?? '').slice(0, 120)}`,
        resourceType: 'ticket',
        resourceId: input.ticketId,
        ticketId: input.ticketId,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
    });
  });
  logger.info('Chamado cancelado pelo solicitante.', { ticketId: input.ticketId, actorUid: actor.uid });
  return { ticketId: input.ticketId, status: 'cancelled' as const };
});

const adminTransitions: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['open', 'waiting_for_user', 'resolved', 'closed'],
  waiting_for_user: ['open', 'in_progress', 'resolved', 'closed'],
  resolved: ['open', 'in_progress', 'closed'],
  closed: ['open'],
  cancelled: [],
};

export const updateTicketStatus = onCall({ enforceAppCheck: appCheckEnabled, maxInstances: 6 }, async (request) => {
  const actor = await requireActiveActor(request.auth);
  const input = parse(statusSchema, request.data);
  const db = getDb();
  const ticketRef = db.collection('tickets').doc(input.ticketId);
  const initial = await ticketRef.get();
  if (!initial.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
  const ownerUid = initial.get('ownerUid');
  const isAdmin = actor.role === 'admin';
  if (!isAdmin && ownerUid !== actor.uid) throw new HttpsError('permission-denied', 'Você não tem acesso a este chamado.');
  if (!isAdmin && !(initial.get('status') === 'resolved' && input.status === 'closed')) {
    throw new HttpsError('permission-denied', 'Somente a equipe de atendimento pode alterar o estado do chamado.');
  }
  const admins = isAdmin ? null : await getActiveAdmins(db);
  const eventRef = ticketRef.collection('events').doc();
  const notificationRefs = isAdmin
    ? [db.collection('users').doc(String(ownerUid)).collection('notifications').doc()]
    : (admins?.docs ?? []).map((admin) => admin.ref.collection('notifications').doc());

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ticketRef);
    if (!current.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
    const previousStatus = ticketStatusSchema.catch('open').parse(current.get('status'));
    if (isAdmin) {
      if (!adminTransitions[previousStatus].includes(input.status)) {
        throw new HttpsError('failed-precondition', 'Esta mudança de estado não é permitida.');
      }
    } else if (current.get('ownerUid') !== actor.uid || previousStatus !== 'resolved' || input.status !== 'closed') {
      throw new HttpsError('failed-precondition', 'O chamado só pode ser encerrado pelo solicitante após ser resolvido.');
    }
    transaction.update(ticketRef, { status: input.status, updatedAt: FieldValue.serverTimestamp() });
    transaction.create(eventRef, {
      action: 'status_changed',
      from: previousStatus,
      to: input.status,
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      createdAt: FieldValue.serverTimestamp(),
    });
    const ticketLabel = input.ticketId.slice(0, 8).toUpperCase();
    notificationRefs.forEach((ref) => transaction.create(ref, {
      type: 'ticket_status',
      title: isAdmin ? `Atualização do chamado #${ticketLabel}` : `Chamado #${ticketLabel} encerrado`,
      body: isAdmin ? `Estado atualizado para ${input.status.replaceAll('_', ' ')}.` : `${actor.name} encerrou o chamado.`,
      resourceType: 'ticket',
      resourceId: input.ticketId,
      ticketId: input.ticketId,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
    }));
  });
  return { ticketId: input.ticketId, status: input.status };
});
