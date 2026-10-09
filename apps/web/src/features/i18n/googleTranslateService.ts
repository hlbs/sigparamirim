import { firebase } from '../../lib/firebase';

export type TranslationLanguage = Exclude<import('../../stores/preferences').LanguageCode, 'PT'>;

const googleLanguageCodes: Record<TranslationLanguage, string> = {
  EN: 'en',
  ES: 'es',
  FR: 'fr',
  ZH: 'zh-CN',
  DE: 'de',
  AR: 'ar',
};

export async function translateTextsWithGoogle(texts: string[], targetLanguage: TranslationLanguage) {
  if (!firebase.app) throw new Error('O serviço de tradução requer uma sessão Firebase configurada.');
  const [{ getFunctions, httpsCallable }] = await Promise.all([import('firebase/functions')]);
  const callable = httpsCallable<{ texts: string[]; targetLanguage: string }, { ok: true; translations: string[] }>(
    getFunctions(firebase.app, 'us-central1'),
    'translateText',
  );
  const result = await callable({ texts, targetLanguage: googleLanguageCodes[targetLanguage] });
  return result.data.translations;
}
