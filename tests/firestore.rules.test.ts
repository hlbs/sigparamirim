import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-sig-paramirim',
    firestore: {
      host: '127.0.0.1',
      port: 8180,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      db.doc('users/alice').set({ role: 'user', accountStatus: 'pending', displayName: 'Alice' }),
      db.doc('users/active-user').set({ role: 'user', accountStatus: 'active', displayName: 'Usuário ativo' }),
      db.doc('users/other-user').set({ role: 'user', accountStatus: 'active', displayName: 'Outro usuário' }),
      db.doc('users/admin-a').set({ role: 'admin', accountStatus: 'active', displayName: 'Administradora' }),
      db.doc('users/editor-a').set({ role: 'editor', accountStatus: 'active' }),
      db.doc('layers/public-layer').set({ status: 'published' }),
      db.doc('layers/draft-layer').set({ status: 'draft' }),
      db.doc('changeRequests/own-request').set({ requestedBy: 'editor-a', status: 'pending' }),
      db.doc('changeRequests/other-request').set({ requestedBy: 'editor-b', status: 'pending' }),
      db.doc('auditLogs/event-1').set({ type: 'test' }),
      db.doc('tickets/ticket-own').set({ ownerUid: 'active-user', status: 'open' }),
      db.doc('tickets/ticket-other').set({ ownerUid: 'other-user', status: 'open' }),
      db.doc('tickets/ticket-own/messages/message-1').set({ body: 'Solicitação inicial' }),
      db.doc('tickets/ticket-own/events/event-1').set({ action: 'created' }),
      db.doc('users/active-user/notifications/notice-own').set({ title: 'Atualização do atendimento', readAt: null }),
      db.doc('users/other-user/notifications/notice-other').set({ title: 'Aviso privado', readAt: null }),
    ]);
  });
});

describe('regras Storage do SIG Paramirim', () => {
  test('usuário ativo envia anexo apenas para o próprio ticket', async () => {
    const ownStorage = environment.authenticatedContext('alice', {
      role: 'user', accountStatus: 'active',
    }).storage();
    await assertSucceeds(ownStorage.ref('tickets/alice/ticket-1/message-1/screenshot.png')
      .putString('imagem', 'raw', { contentType: 'image/png' }));
    await assertFails(ownStorage.ref('tickets/bob/ticket-1/message-1/screenshot.png')
      .putString('imagem', 'raw', { contentType: 'image/png' }));
  });

  test('somente editor ativo envia arquivo para a própria área de staging', async () => {
    const userStorage = environment.authenticatedContext('alice', {
      role: 'user', accountStatus: 'active',
    }).storage();
    const editorStorage = environment.authenticatedContext('editor-a', {
      role: 'editor', accountStatus: 'active',
    }).storage();
    await assertFails(userStorage.ref('staging/alice/request-1/layer.geojson')
      .putString('{}', 'raw', { contentType: 'application/geo+json' }));
    await assertSucceeds(editorStorage.ref('staging/editor-a/request-1/layer.geojson')
      .putString('{}', 'raw', { contentType: 'application/geo+json' }));
  });

  test('nenhum cliente altera arquivos canônicos de camadas', async () => {
    const adminStorage = environment.authenticatedContext('admin-a', {
      role: 'admin', accountStatus: 'active',
    }).storage();
    await assertFails(adminStorage.ref('layers/layer-1/revision-1/data.geojson')
      .putString('{}', 'raw', { contentType: 'application/geo+json' }));
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe('regras Firestore do SIG Paramirim', () => {
  test('bloqueia conteúdo para anônimos e contas ainda não ativas', async () => {
    const anonymousDb = environment.unauthenticatedContext().firestore();
    const pendingDb = environment.authenticatedContext('alice', {
      role: 'user', accountStatus: 'pending',
    }).firestore();
    await assertFails(anonymousDb.doc('layers/public-layer').get());
    await assertFails(pendingDb.doc('layers/public-layer').get());
  });

  test('permite conteúdo publicado a contas ativas e reserva rascunhos a editores', async () => {
    const activeDb = environment.authenticatedContext('active-user', {
      role: 'user', accountStatus: 'active',
    }).firestore();
    const editorDb = environment.authenticatedContext('editor-a', {
      role: 'editor', accountStatus: 'active',
    }).firestore();
    await assertSucceeds(activeDb.doc('layers/public-layer').get());
    await assertFails(activeDb.doc('layers/draft-layer').get());
    await assertSucceeds(editorDb.doc('layers/draft-layer').get());
  });

  test('bloqueia criação de perfil diretamente pelo cliente', async () => {
    const db = environment.authenticatedContext('new-user').firestore();
    await assertFails(db.doc('users/new-user').set({
      role: 'user', accountStatus: 'pending', displayName: 'Novo usuário',
    }));
  });

  test('permite ao usuário pendente ler e editar somente campos seguros do próprio perfil', async () => {
    const db = environment.authenticatedContext('alice', {
      role: 'user', accountStatus: 'pending',
    }).firestore();
    await assertSucceeds(db.doc('users/alice').get());
    await assertSucceeds(db.doc('users/alice').update({ displayName: 'Alice Atualizada' }));
    await assertFails(db.doc('users/alice').update({ providerIds: ['password'] }));
    await assertFails(db.doc('users/alice').update({ role: 'admin' }));
  });

  test('editor ativo lê apenas as próprias solicitações', async () => {
    const db = environment.authenticatedContext('editor-a', {
      role: 'editor', accountStatus: 'active',
    }).firestore();
    await assertSucceeds(db.doc('changeRequests/own-request').get());
    await assertFails(db.doc('changeRequests/other-request').get());
  });

  test('somente administrador ativo lê auditoria', async () => {
    const editorDb = environment.authenticatedContext('editor-a', {
      role: 'editor', accountStatus: 'active',
    }).firestore();
    const adminDb = environment.authenticatedContext('admin-a', {
      role: 'admin', accountStatus: 'active',
    }).firestore();
    await assertFails(editorDb.doc('auditLogs/event-1').get());
    await assertSucceeds(adminDb.doc('auditLogs/event-1').get());
  });

  test('solicitante lê apenas os próprios chamados, mensagens e eventos; admin lê a fila', async () => {
    const ownerDb = environment.authenticatedContext('active-user', {
      role: 'user', accountStatus: 'active',
    }).firestore();
    const otherDb = environment.authenticatedContext('other-user', {
      role: 'user', accountStatus: 'active',
    }).firestore();
    const adminDb = environment.authenticatedContext('admin-a', {
      role: 'admin', accountStatus: 'active',
    }).firestore();

    await assertSucceeds(ownerDb.doc('tickets/ticket-own').get());
    await assertFails(ownerDb.doc('tickets/ticket-other').get());
    await assertSucceeds(ownerDb.doc('tickets/ticket-own/messages/message-1').get());
    await assertSucceeds(ownerDb.doc('tickets/ticket-own/events/event-1').get());
    await assertFails(otherDb.doc('tickets/ticket-own/messages/message-1').get());
    await assertFails(otherDb.doc('tickets/ticket-own/events/event-1').get());
    await assertSucceeds(adminDb.doc('tickets/ticket-other').get());
    await assertFails(ownerDb.doc('tickets/ticket-own').update({ status: 'closed' }));
    await assertFails(ownerDb.doc('tickets/ticket-own/messages/message-2').set({ body: 'Resposta direta' }));
  });

  test('notificações são privadas e o usuário pode marcar somente readAt', async () => {
    const ownerDb = environment.authenticatedContext('active-user', {
      role: 'user', accountStatus: 'active',
    }).firestore();
    const otherDb = environment.authenticatedContext('other-user', {
      role: 'user', accountStatus: 'active',
    }).firestore();

    await assertSucceeds(ownerDb.doc('users/active-user/notifications/notice-own').get());
    await assertFails(ownerDb.doc('users/other-user/notifications/notice-other').get());
    await assertSucceeds(ownerDb.doc('users/active-user/notifications/notice-own').update({ readAt: new Date() }));
    await assertFails(ownerDb.doc('users/active-user/notifications/notice-own').update({ title: 'Conteúdo alterado' }));
    await assertFails(otherDb.doc('users/active-user/notifications/fake').set({ title: 'Falso aviso' }));
  });
});
