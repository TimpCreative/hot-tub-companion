import * as admin from 'firebase-admin';
import { env } from './environment';

let initialized = false;
let initError: Error | null = null;

function parsePrivateKey(key: string | undefined): string {
  if (!key) {
    throw new Error('FIREBASE_PRIVATE_KEY is not set');
  }

  let parsed = key;

  // Remove surrounding quotes if present
  if ((parsed.startsWith('"') && parsed.endsWith('"')) || 
      (parsed.startsWith("'") && parsed.endsWith("'"))) {
    parsed = parsed.slice(1, -1);
  }

  // Handle various newline escape formats
  // First try double-escaped (\\n -> \n -> actual newline)
  parsed = parsed.replace(/\\\\n/g, '\n');
  // Then single-escaped (\n -> actual newline)  
  parsed = parsed.replace(/\\n/g, '\n');

  // Validate key format
  if (!parsed.includes('-----BEGIN') || !parsed.includes('PRIVATE KEY-----')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY appears malformed. It should start with "-----BEGIN PRIVATE KEY-----" ' +
      'and end with "-----END PRIVATE KEY-----". Check Railway env var format.'
    );
  }

  return parsed;
}

export function initFirebase(): admin.app.App {
  if (initialized) {
    return admin.app();
  }

  if (initError) {
    throw initError;
  }

  try {
    const privateKey = parsePrivateKey(env.FIREBASE_PRIVATE_KEY);

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

    initialized = true;
    console.log('Firebase Admin SDK initialized successfully');
    return admin.app();
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    console.error('Firebase Admin SDK initialization failed:', initError.message);
    throw initError;
  }
}

export function getFirebaseAuth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}

export function isFirebaseInitialized(): boolean {
  return initialized;
}

export function getFirebaseInitError(): string | null {
  return initError?.message || null;
}
