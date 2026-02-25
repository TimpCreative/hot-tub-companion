import * as admin from 'firebase-admin';
import { env } from './environment';

let initialized = false;

export function initFirebase(): admin.app.App {
  if (initialized) {
    return admin.app();
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });

  initialized = true;
  return admin.app();
}

export function getFirebaseAuth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}
