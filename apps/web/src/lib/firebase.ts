import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value !== 'undefined';

const isConfigured = Object.entries(config)
  .filter(([key]) => key !== 'measurementId')
  .every(([, value]) => isPresent(value));

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isConfigured) {
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);
}

export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
      console.error('Não foi possível habilitar a persistência local da sessão.', error);
    })
  : Promise.resolve();

export const firebase = {
  app,
  auth,
  isConfigured,
  databaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'sigparamirimdb',
};
