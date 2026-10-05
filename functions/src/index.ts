import { initializeApp } from 'firebase-admin/app';
import { logger } from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();

export const healthcheck = onCall({ enforceAppCheck: true }, (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  logger.info('Verificação de integridade concluída.', { uid: request.auth.uid });
  return { status: 'ok', version: '0.1.0' };
});

