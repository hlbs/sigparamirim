import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

initializeApp();

const db = getFirestore('sigparamirimdb');
const appCheckEnabled = process.env.ENFORCE_APP_CHECK === 'true';

const roleSchema = z.enum(['user', 'editor', 'admin']);
const accountStatusSchema = z.enum(['pending', 'active', 'suspended']);
const accessUpdateSchema = z.object({
  uid: z.string().min(1).max(128),
  role: roleSchema,
  accountStatus: accountStatusSchema,
  justification: z.string().trim().min(10).max(500),
});
const changeRequestSchema = z.object({
  resourceType: z.enum(['layer', 'dashboard', 'publication']),
  resourceId: z.string().trim().min(1).max(160),
  operation: z.enum(['create', 'update', 'archive']),
  summary: z.string().trim().min(10).max(500),
  payload: z.record(z.string(), z.unknown()),
});
const reviewSchema = z.object({
  requestId: z.string().min(1).max(160),
  decision: z.enum(['approved', 'rejected']),
  justification: z.string().trim().min(10).max(1000),
});

function requireAuthentication(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  return auth;
}

async function requireActiveRole(
  auth: { uid: string; token: Record<string, unknown> } | undefined,
  roles: Array<'editor' | 'admin'>,
) {
  const session = requireAuthentication(auth);
  const profile = await db.collection('users').doc(session.uid).get();
  if (!profile.exists) {
    throw new HttpsError('permission-denied', 'Seu perfil não possui autorização para esta operação.');
  }
  const role = roleSchema.catch('user').parse(profile.get('role'));
  const accountStatus = accountStatusSchema.catch('pending').parse(profile.get('accountStatus'));
  if (accountStatus !== 'active' || !roles.includes(role as 'editor' | 'admin')) {
    throw new HttpsError('permission-denied', 'Seu perfil não possui autorização para esta operação.');
  }
  return { uid: session.uid, role };
}

function parseInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Os dados enviados são inválidos.', parsed.error.flatten());
  }
  return parsed.data;
}

export const healthcheck = onCall({ enforceAppCheck: appCheckEnabled }, (request) => {
  const auth = requireAuthentication(request.auth);
  logger.info('Verificação de integridade concluída.', { uid: auth.uid });
  return { status: 'ok', version: '0.3.0-beta.8' };
});

export const bootstrapProfile = onCall({ enforceAppCheck: appCheckEnabled }, async (request) => {
  const session = requireAuthentication(request.auth);
  const userRef = db.collection('users').doc(session.uid);
  const identity = await getAuth().getUser(session.uid);
  const providerIds = identity.providerData.map((provider) => provider.providerId);
  if (!providerIds.includes('google.com')) {
    throw new HttpsError('permission-denied', 'O acesso ao SIG Paramirim requer uma conta Google.');
  }

  const profile = {
    uid: session.uid,
    displayName: identity.displayName ?? '',
    email: identity.email ?? '',
    photoURL: identity.photoURL ?? null,
    providerIds,
    role: 'user' as const,
    accountStatus: 'active' as const,
    language: 'pt-BR',
    theme: 'system',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  };

  const access = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);
    if (existing.exists) {
      const data = existing.data() ?? {};
      const role = roleSchema.catch('user').parse(data.role);
      const existingStatus = accountStatusSchema.catch('pending').parse(data.accountStatus);
      const accountStatus = existingStatus === 'pending' ? 'active' as const : existingStatus;
      transaction.update(userRef, { providerIds, accountStatus, updatedAt: FieldValue.serverTimestamp() });
      return { created: false, role, accountStatus };
    }

    transaction.create(userRef, profile);
    return { created: true, role: profile.role, accountStatus: profile.accountStatus };
  });

  await getAuth().setCustomUserClaims(session.uid, {
    ...(identity.customClaims ?? {}),
    role: access.role,
    accountStatus: access.accountStatus,
  });

  logger.info(access.created ? 'Perfil inicial criado.' : 'Perfil existente sincronizado.', { uid: session.uid });
  return access;
});

export const adminUpdateUserAccess = onCall({ enforceAppCheck: appCheckEnabled }, async (request) => {
  const actor = await requireActiveRole(request.auth, ['admin']);
  const input = parseInput(accessUpdateSchema, request.data);
  if (actor.uid === input.uid) {
    throw new HttpsError('failed-precondition', 'O administrador não pode alterar o próprio acesso.');
  }

  const targetRef = db.collection('users').doc(input.uid);
  const auditRef = db.collection('auditLogs').doc();
  const target = await targetRef.get();
  if (!target.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');

  await db.runTransaction(async (transaction) => {
    transaction.update(targetRef, {
      role: input.role,
      accountStatus: input.accountStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      type: 'user.access.updated', actorUid: actor.uid, targetUid: input.uid,
      previous: { role: target.get('role') ?? null, accountStatus: target.get('accountStatus') ?? null },
      next: { role: input.role, accountStatus: input.accountStatus },
      justification: input.justification, createdAt: FieldValue.serverTimestamp(),
    });
  });

  const identity = await getAuth().getUser(input.uid);
  await getAuth().setCustomUserClaims(input.uid, {
    ...(identity.customClaims ?? {}), role: input.role, accountStatus: input.accountStatus,
  });
  if (input.accountStatus === 'suspended') {
    await getAuth().revokeRefreshTokens(input.uid);
  }
  return { ok: true };
});

export const submitChangeRequest = onCall({ enforceAppCheck: appCheckEnabled }, async (request) => {
  const actor = await requireActiveRole(request.auth, ['editor', 'admin']);
  const input = parseInput(changeRequestSchema, request.data);
  const requestRef = db.collection('changeRequests').doc();
  const admins = await db.collection('users').where('role', '==', 'admin')
    .where('accountStatus', '==', 'active').limit(100).get();
  const batch = db.batch();

  batch.create(requestRef, {
    ...input, status: 'pending', requestedBy: actor.uid,
    requestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(requestRef.collection('events').doc(), {
    type: 'submitted', actorUid: actor.uid, createdAt: FieldValue.serverTimestamp(),
  });
  admins.docs.forEach((admin) => {
    batch.create(admin.ref.collection('notifications').doc(), {
      type: 'change_request.pending', title: 'Nova alteração aguardando aprovação',
      body: input.summary, resourceId: requestRef.id,
      createdAt: FieldValue.serverTimestamp(), readAt: null,
    });
  });

  await batch.commit();
  return { id: requestRef.id, status: 'pending' };
});

export const reviewChangeRequest = onCall({ enforceAppCheck: appCheckEnabled }, async (request) => {
  const actor = await requireActiveRole(request.auth, ['admin']);
  const input = parseInput(reviewSchema, request.data);
  const requestRef = db.collection('changeRequests').doc(input.requestId);

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(requestRef);
    if (!current.exists) throw new HttpsError('not-found', 'Solicitação não encontrada.');
    if (current.get('status') !== 'pending') {
      throw new HttpsError('failed-precondition', 'Esta solicitação já foi analisada.');
    }
    const requestedBy = current.get('requestedBy');
    if (typeof requestedBy !== 'string') throw new HttpsError('data-loss', 'Solicitação sem autor válido.');

    transaction.update(requestRef, {
      status: input.decision, reviewedBy: actor.uid, reviewedAt: FieldValue.serverTimestamp(),
      reviewJustification: input.justification, updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(requestRef.collection('events').doc(), {
      type: input.decision, actorUid: actor.uid, justification: input.justification,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(db.collection('users').doc(requestedBy).collection('notifications').doc(), {
      type: `change_request.${input.decision}`,
      title: input.decision === 'approved' ? 'Alteração aprovada' : 'Alteração recusada',
      body: input.justification, resourceId: requestRef.id,
      createdAt: FieldValue.serverTimestamp(), readAt: null,
    });
  });

  return { id: input.requestId, status: input.decision };
});
