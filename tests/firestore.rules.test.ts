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
      db.doc('users/editor-a').set({ role: 'editor', accountStatus: 'active' }),
      db.doc('layers/public-layer').set({ status: 'published' }),
      db.doc('layers/draft-layer').set({ status: 'draft' }),
      db.doc('changeRequests/own-request').set({ requestedBy: 'editor-a', status: 'pending' }),
      db.doc('changeRequests/other-request').set({ requestedBy: 'editor-b', status: 'pending' }),
      db.doc('auditLogs/event-1').set({ type: 'test' }),
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
  test('permite leitura pública somente de camada publicada', async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertSucceeds(db.doc('layers/public-layer').get());
    await assertFails(db.doc('layers/draft-layer').get());
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
});
