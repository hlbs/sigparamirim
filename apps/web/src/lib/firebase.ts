import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isConfigured = Object.entries(config)
  .filter(([key]) => key !== 'measurementId')
  .every(([, value]) => Boolean(value));

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isConfigured) {
  app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, {}, import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'sigparamirimdb');
  storage = getStorage(app);
}

export const firebase = { app, auth, db, storage, isConfigured };

