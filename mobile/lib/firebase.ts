import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth } from '@firebase/auth';
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import Constants from 'expo-constants';
import { firebaseAuthSecureStorage } from './firebaseSecurePersistence';

const extra = Constants.expoConfig?.extra as {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
} | undefined;

const firebaseConfig = {
  apiKey: extra?.firebaseApiKey || '',
  authDomain: extra?.firebaseAuthDomain || '',
  projectId: extra?.firebaseProjectId || '',
};

let cachedAuth: Auth | undefined;

/**
 * Use @firebase/auth (React Native entry) so session persistence works.
 * The firebase/auth subpath resolves to the browser bundle under Metro.
 */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }

  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(firebaseAuthSecureStorage),
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'auth/already-initialized') {
      cachedAuth = getAuth(app);
    } else {
      throw e;
    }
  }

  return cachedAuth;
}
