import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
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
    const app = initializeApp(firebaseConfig);
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
    return authInstance;
  }
  authInstance = getAuth(getApps()[0] as FirebaseApp);
  return authInstance;
}
