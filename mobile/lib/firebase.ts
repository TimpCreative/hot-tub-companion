import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import Constants from 'expo-constants';

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

let authInstance: Auth;

export function getFirebaseAuth(): Auth {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  authInstance = getAuth(getApps()[0] as FirebaseApp);
  return authInstance;
}
