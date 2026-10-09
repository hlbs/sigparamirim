import { HttpsError, onCall } from 'firebase-functions/v2/https';

type TranslateRequest = {
  texts?: unknown;
  targetLanguage?: unknown;
};

type TranslateResponse = {
  translations?: Array<{ translatedText?: string }>;
  error?: { message?: string };
};

type MetadataTokenResponse = { access_token?: string; expires_in?: number };

const appCheckEnabled = process.env.ENFORCE_APP_CHECK === 'true';
const allowedLanguages = new Set(['en', 'es', 'fr', 'de', 'ar', 'zh-CN']);
const metadataTokenUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function requireAuthentication(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  if (auth.token.accountStatus !== 'active') throw new HttpsError('permission-denied', 'A conta não está autorizada a traduzir conteúdo.');
}

function normalizeTexts(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new HttpsError('invalid-argument', 'Envie entre 1 e 50 textos por lote.');
  }
  const texts = value.map((item) => {
    if (typeof item !== 'string') throw new HttpsError('invalid-argument', 'Todos os itens devem ser textos.');
    const text = item.trim();
    if (!text || text.length > 1000) throw new HttpsError('invalid-argument', 'Cada texto deve ter entre 1 e 1.000 caracteres.');
    return text;
  });
  if (texts.reduce((sum, text) => sum + text.length, 0) > 15000) {
    throw new HttpsError('invalid-argument', 'O lote excede o limite de 15.000 caracteres.');
  }
  return texts;
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(metadataTokenUrl, { headers: { 'Metadata-Flavor': 'Google' }, signal: controller.signal });
    const payload = await response.json() as MetadataTokenResponse;
    if (!response.ok || !payload.access_token) throw new HttpsError('failed-precondition', 'Credencial de serviço indisponível.');
    cachedAccessToken = {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max((payload.expires_in ?? 300) - 60, 60) * 1000,
    };
    return payload.access_token;
  } finally {
    clearTimeout(timeout);
  }
}

function getProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG ?? '{}') as { projectId?: unknown };
    return typeof config.projectId === 'string' ? config.projectId : null;
  } catch {
    return null;
  }
}

export const translateText = onCall({ region: 'us-central1', maxInstances: 4, enforceAppCheck: appCheckEnabled }, async (request) => {
  requireAuthentication(request.auth);
  const data = (request.data ?? {}) as TranslateRequest;
  const texts = normalizeTexts(data.texts);
  const targetLanguage = typeof data.targetLanguage === 'string' ? data.targetLanguage : '';
  if (!allowedLanguages.has(targetLanguage)) throw new HttpsError('invalid-argument', 'Idioma de destino não suportado.');

  const projectId = getProjectId();
  if (!projectId) throw new HttpsError('failed-precondition', 'Projeto Google Cloud indisponível.');
  const accessToken = await getAccessToken();
  const response = await fetch(`https://translation.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/locations/global:translateText`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: texts,
      mimeType: 'text/plain',
      targetLanguageCode: targetLanguage,
    }),
  });
  const payload = await response.json() as TranslateResponse;
  if (!response.ok) {
    // Keep provider diagnostics out of client responses; they can contain request details.
    throw new HttpsError('unavailable', 'O serviço de tradução do Google está indisponível ou não foi habilitado para este projeto.');
  }
  const translations = payload.translations?.map((item) => item.translatedText ?? '');
  if (!translations || translations.length !== texts.length || translations.some((text) => !text)) {
    throw new HttpsError('internal', 'O Google retornou uma resposta de tradução inválida.');
  }
  return { ok: true, translations };
});
