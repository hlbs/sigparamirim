import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
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
const layerChangeSchema = z.object({
  layer: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
    title: z.string().trim().min(1).max(200),
    group: z.string().trim().min(1).max(120),
    kind: z.enum(['raster', 'vector']),
    crs: z.string().trim().max(80).optional(),
    source: z.string().trim().max(500).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    statistics: z.object({ min: z.number().optional(), max: z.number().optional(), p2: z.number().optional(), p98: z.number().optional() }).optional(),
    noData: z.number().optional(),
    styleDefault: z.record(z.string(), z.unknown()).optional(),
    visibleByDefault: z.boolean().optional(),
  }).strict(),
  stagingPath: z.string().trim().min(1).max(1024).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  contentType: z.string().trim().min(1).max(160).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
}).strict().superRefine((value, context) => {
  const min = value.layer.statistics?.min;
  const max = value.layer.statistics?.max;
  if (min !== undefined && max !== undefined && min >= max) {
    context.addIssue({ code: 'custom', path: ['layer', 'statistics'], message: 'O valor mínimo deve ser menor que o máximo.' });
  }
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
  return { status: 'ok', version: '0.3.0-beta.60' };
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
  const requestRef = input.requestId
    ? db.collection('changeRequests').doc(input.requestId)
    : db.collection('changeRequests').doc();
  const { requestId: _requestId, ...requestData } = input;
  const directAdminPublish = actor.role === 'admin' && input.resourceType === 'layer';
  if (directAdminPublish) {
    await publishApprovedLayer({ ...input, requestedBy: actor.uid }, requestRef.id);
  }
  const admins = await db.collection('users').where('role', '==', 'admin')
    .where('accountStatus', '==', 'active').limit(100).get();
  const batch = db.batch();

  batch.create(requestRef, {
    ...requestData, status: directAdminPublish ? 'approved' : 'pending', requestedBy: actor.uid,
    requestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    ...(directAdminPublish ? { reviewedBy: actor.uid, reviewedAt: FieldValue.serverTimestamp(), reviewJustification: 'Publicado diretamente por administrador.' } : {}),
  });
  batch.create(requestRef.collection('events').doc(), {
    type: directAdminPublish ? 'approved' : 'submitted', actorUid: actor.uid,
    ...(directAdminPublish ? { justification: 'Publicado diretamente por administrador.' } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });
  if (!directAdminPublish) {
    admins.docs.forEach((admin) => {
      batch.create(admin.ref.collection('notifications').doc(), {
        type: 'change_request.pending', title: 'Nova alteração aguardando aprovação',
        body: input.summary, resourceId: requestRef.id,
        createdAt: FieldValue.serverTimestamp(), readAt: null,
      });
    });
  }

  await batch.commit();
  return { id: requestRef.id, status: directAdminPublish ? 'approved' : 'pending' };
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
    transaction.update(requestRef, { status: 'processing', updatedAt: FieldValue.serverTimestamp() });
  });

  try {
    const snapshot = await requestRef.get();
    const requestData = snapshot.data() ?? {};
    if (input.decision === 'approved' && requestData.resourceType === 'layer') {
      await publishApprovedLayer(requestData, input.requestId);
    }
    if (input.decision === 'rejected' && requestData.resourceType === 'layer') {
      const rejected = layerChangeSchema.safeParse(requestData.payload);
      const stagingPath = rejected.success ? rejected.data.stagingPath : undefined;
      const requestedBy = requestData.requestedBy;
      if (stagingPath && typeof requestedBy === 'string' && stagingPath.startsWith(`staging/${requestedBy}/`)) {
        await getStorage().bucket().file(stagingPath).delete({ ignoreNotFound: true });
      }
    }

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(requestRef);
      if (!current.exists || current.get('status') !== 'processing') {
        throw new HttpsError('failed-precondition', 'A solicitação deixou de estar em análise.');
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
  } catch (error) {
    await requestRef.update({ status: 'pending', updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    throw error;
  }

  return { id: input.requestId, status: input.decision };
});

export const migrateLegacyGeospatialToStorage = onCall({
  enforceAppCheck: appCheckEnabled,
  timeoutSeconds: 540,
  memory: '2GiB',
  maxInstances: 1,
}, async (request) => {
  const actor = await requireActiveRole(request.auth, ['admin']);
  const projectId = process.env.GCLOUD_PROJECT ?? 'ppgeol-tools';
  const hostingOrigin = (process.env.WEBGIS_HOSTING_ORIGIN ?? `https://${projectId}.web.app`).replace(/\/$/, '');
  const origin = new URL(hostingOrigin);
  if (origin.protocol !== 'https:') throw new HttpsError('failed-precondition', 'A origem do catálogo precisa usar HTTPS.');

  const lockRef = db.doc('appConfig/geospatialStorageMigration');
  const alreadyComplete = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(lockRef);
    if (current.get('status') === 'completed') return true;
    if (current.get('status') === 'running') {
      const startedAt = current.get('startedAt') as { toMillis?: () => number } | undefined;
      if (startedAt?.toMillis && Date.now() - startedAt.toMillis() < 10 * 60 * 1000) {
        throw new HttpsError('already-exists', 'A migração das camadas já está em andamento.');
      }
    }
    transaction.set(lockRef, { status: 'running', startedBy: actor.uid, startedAt: FieldValue.serverTimestamp() });
    return false;
  });
  if (alreadyComplete) return { status: 'completed', migrated: 0, skipped: 0 };

  try {
    const catalogResponse = await fetch(new URL('/geospatial/catalog.json', origin));
    if (!catalogResponse.ok) throw new HttpsError('unavailable', 'Não foi possível ler o catálogo publicado no Hosting.');
    const catalog = await catalogResponse.json() as { layers?: Array<Record<string, unknown>> };
    if (!Array.isArray(catalog.layers)) throw new HttpsError('data-loss', 'O catálogo publicado não tem uma lista de camadas.');
    const layers = catalog.layers.filter((layer) => layer.status === 'present' && typeof layer.url === 'string');
    if (layers.length > 100) throw new HttpsError('resource-exhausted', 'O catálogo excede o limite desta migração.');

    let migrated = 0;
    let skipped = 0;
    const bucket = getStorage().bucket();
    for (const item of layers) {
      const assetUrl = new URL(String(item.url), origin);
      if (assetUrl.origin !== origin.origin || !assetUrl.pathname.startsWith('/geospatial/layers/')) {
        throw new HttpsError('invalid-argument', 'O catálogo contém um caminho de camada inválido.');
      }
      const id = String(item.id ?? '');
      const kind = item.kind === 'raster' ? 'raster' : 'vector';
      if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(id)) throw new HttpsError('invalid-argument', 'O catálogo contém um identificador inválido.');
      const layerRef = db.collection('layers').doc(id);
      const existing = await layerRef.get();
      if (existing.get('status') === 'archived') { skipped += 1; continue; }
      const existingPath = existing.get('storagePath');
      if (typeof existingPath === 'string') {
        const [exists] = await bucket.file(existingPath).exists();
        if (exists) { skipped += 1; continue; }
      }

      const fileName = assetUrl.pathname.split('/').at(-1)?.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!fileName) throw new HttpsError('invalid-argument', 'O catálogo contém um nome de arquivo inválido.');
      const response = await fetch(assetUrl);
      if (!response.ok || !response.body) throw new HttpsError('unavailable', `Não foi possível ler o arquivo da camada ${id}.`);
      const storagePath = `webgis/${kind === 'raster' ? 'raster' : 'vetor'}/${id}/1/${fileName}`;
      const token = crypto.randomUUID();
      const contentType = kind === 'raster' ? 'image/tiff' : 'application/geo+json';
      const target = bucket.file(storagePath);
      const downloadStream = Readable.from((async function* () {
        const reader = response.body!.getReader();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            yield chunk.value;
          }
        } finally {
          reader.releaseLock();
        }
      })());
      await pipeline(downloadStream, target.createWriteStream({
        resumable: true,
        metadata: {
          contentType,
          cacheControl: 'public,max-age=3600,no-transform',
          metadata: { firebaseStorageDownloadTokens: token },
        },
      }));
      await layerRef.set({
        id,
        title: String(item.title ?? id),
        group: String(item.group ?? 'Sem grupo definido no catálogo'),
        kind,
        crs: typeof item.crs === 'string' ? item.crs : null,
        source: typeof item.source === 'string' ? item.source : null,
        sizeBytes: Number(item.sizeBytes ?? 0),
        featureCount: typeof item.featureCount === 'number' ? item.featureCount : null,
        geometryTypes: item.geometryTypes ?? null,
        width: typeof item.width === 'number' ? item.width : null,
        height: typeof item.height === 'number' ? item.height : null,
        statistics: item.statistics ?? null,
        noData: typeof item.noData === 'number' ? item.noData : null,
        styleDefault: item.styleDefault ?? {},
        visibleByDefault: item.visibleByDefault === true,
        storagePath,
        status: 'published',
        revision: 1,
        migratedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      migrated += 1;
    }

    await lockRef.set({ status: 'completed', migrated, skipped, completedBy: actor.uid, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('auditLogs').add({ type: 'webgis.storage.migrated', actorUid: actor.uid, migrated, skipped, createdAt: FieldValue.serverTimestamp() });
    return { status: 'completed', migrated, skipped };
  } catch (error) {
    await lockRef.set({ status: 'failed', failedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => undefined);
    throw error;
  }
});

async function publishApprovedLayer(changeRequest: Record<string, unknown>, _requestId: string): Promise<void> {
  const parsed = layerChangeSchema.safeParse(changeRequest.payload);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Os dados da camada são inválidos.');
  const { layer, stagingPath, fileName, contentType, sizeBytes } = parsed.data;
  if (changeRequest.resourceId !== layer.id) {
    throw new HttpsError('invalid-argument', 'O identificador da camada não corresponde ao pedido.');
  }

  const layerRef = db.collection('layers').doc(layer.id);
  const existing = await layerRef.get();
  if (existing.get('lastChangeRequestId') === _requestId) return;
  const operation = changeRequest.operation;
  if (operation === 'create' && existing.exists) throw new HttpsError('already-exists', 'A camada já existe.');
  if ((operation === 'update' || operation === 'archive') && !existing.exists) {
    throw new HttpsError('not-found', 'A camada que seria alterada não existe.');
  }
  const revision = Number(existing.get('revision') ?? 0) + 1;
  let storagePath = typeof existing.get('storagePath') === 'string' ? existing.get('storagePath') as string : undefined;
  let stagedSource: { delete(options: { ignoreNotFound: boolean }): Promise<unknown> } | undefined = undefined;

  if (operation === 'archive') {
    await layerRef.update({ status: 'archived', revision, lastChangeRequestId: _requestId, updatedAt: FieldValue.serverTimestamp() });
    return;
  }

  if (stagingPath) {
    const requestedBy = changeRequest.requestedBy;
    if (!fileName || !contentType || typeof requestedBy !== 'string'
      || !stagingPath.startsWith(`staging/${requestedBy}/`)
      || stagingPath.split('/').some((part) => part === '.' || part === '..')) {
      throw new HttpsError('invalid-argument', 'O arquivo temporário não corresponde ao autor do pedido.');
    }
    const normalizedFileName = fileName.split(/[\\/]/).at(-1)?.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!normalizedFileName) throw new HttpsError('invalid-argument', 'Nome de arquivo inválido.');
    const lowerFileName = normalizedFileName.toLowerCase();
    if (layer.kind === 'vector' && !lowerFileName.endsWith('.geojson') && !lowerFileName.endsWith('.json')) {
      throw new HttpsError('invalid-argument', 'Camadas vetoriais devem ser enviadas em GeoJSON.');
    }
    if (layer.kind === 'raster' && !lowerFileName.endsWith('.tif') && !lowerFileName.endsWith('.tiff')) {
      throw new HttpsError('invalid-argument', 'Camadas raster devem ser enviadas em GeoTIFF/COG.');
    }
    const validContentTypes = layer.kind === 'raster'
      ? ['image/tiff', 'application/octet-stream']
      : ['application/geo+json', 'application/json', 'application/octet-stream'];
    if (!validContentTypes.includes(contentType.toLowerCase())) {
      throw new HttpsError('invalid-argument', 'O tipo de conteúdo não corresponde ao formato da camada.');
    }
    const bucket = getStorage().bucket();
    const source = bucket.file(stagingPath);
    const [sourceExists] = await source.exists();
    if (!sourceExists) throw new HttpsError('not-found', 'O arquivo temporário não foi encontrado.');
    const [sourceMetadata] = await source.getMetadata();
    storagePath = `webgis/${layer.kind === 'raster' ? 'raster' : 'vetor'}/${layer.id}/${revision}/${normalizedFileName}`;
    const destination = bucket.file(storagePath);
    await source.copy(destination);
    await destination.setMetadata({
      contentType: contentType || sourceMetadata.contentType,
      cacheControl: 'public,max-age=3600',
    });
    stagedSource = source;
  } else if (!storagePath) {
    throw new HttpsError('invalid-argument', 'Uma nova camada precisa incluir seu arquivo.');
  }

  await layerRef.set({
    ...layer, ...(sizeBytes !== undefined ? { sizeBytes } : {}), storagePath, status: 'published', revision,
    lastChangeRequestId: _requestId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  if (stagedSource) await stagedSource.delete({ ignoreNotFound: true });
}

export { cancelTicket, createTicket, migrateLegacyTicketPriorities, replyToTicket, updateTicketPriority, updateTicketStatus } from './helpdesk.js';
