import { onAuthStateChanged } from 'firebase/auth';
import { useSyncExternalStore } from 'react';
import { firebase } from '../../lib/firebase';
import { resolveEffectiveAccess } from './claims';
import { ensureUserProfile } from './profile';
import type { AuthState } from './types';

const baseState: AuthState = {
  status: firebase.isConfigured ? 'loading' : 'unavailable',
  loading: firebase.isConfigured,
  user: null,
  profile: null,
  role: 'user',
  accountStatus: 'pending',
  canAccessPlatform: false,
  error: firebase.isConfigured ? null : 'Firebase não configurado neste ambiente.',
};

let state = baseState;
let started = false;
let revision = 0;
const listeners = new Set<() => void>();

function publish(nextState: AuthState) {
  state = nextState;
  listeners.forEach((listener) => listener());
}

function startSessionObserver() {
  if (started) return;
  started = true;

  if (!firebase.auth) return;

  onAuthStateChanged(firebase.auth, async (user) => {
    const currentRevision = ++revision;

    if (!user) {
      publish({ ...baseState, status: 'unauthenticated', loading: false, error: null });
      return;
    }

    publish({ ...baseState, status: 'loading', loading: true, error: null });

    try {
      const profile = await ensureUserProfile(user);
      const token = await user.getIdTokenResult(true);
      if (currentRevision !== revision) return;

      const access = resolveEffectiveAccess(token.claims);
      publish({
        status: 'authenticated',
        loading: false,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: access.canAccessPlatform ? access.role : 'user',
          accountStatus: access.accountStatus,
        },
        profile,
        ...access,
        error: null,
      });
    } catch (error) {
      if (currentRevision !== revision) return;
      publish({
        ...baseState,
        status: 'error',
        loading: false,
        user: null,
        error: error instanceof Error ? error.message : 'Falha ao carregar a sessão.',
      });
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startSessionObserver();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  startSessionObserver();
  return state;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
