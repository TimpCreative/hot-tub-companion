import * as admin from 'firebase-admin';
import { env } from './environment';

let initialized = false;
let initError: Error | null = null;

function parsePrivateKey(key: string | undefined): string {
  if (!key) {
    throw new Error('FIREBASE_PRIVATE_KEY is not set');
  }

  let parsed = key;

  // Debug: log key characteristics (safe, no sensitive data)
  console.log('Firebase key parsing debug:', {
    originalLength: key.length,
    startsWithQuote: key.startsWith('"') || key.startsWith("'"),
    endsWithQuote: key.endsWith('"') || key.endsWith("'"),
    hasDoubleEscapedNewlines: key.includes('\\\\n'),
    hasSingleEscapedNewlines: key.includes('\\n'),
    hasLiteralNewlines: key.includes('\n'),
    first50Chars: key.substring(0, 50).replace(/[A-Za-z0-9+/=]/g, 'X'),
    last30Chars: key.substring(key.length - 30).replace(/[A-Za-z0-9+/=]/g, 'X'),
  });

  // Remove surrounding quotes if present
  if ((parsed.startsWith('"') && parsed.endsWith('"')) || 
      (parsed.startsWith("'") && parsed.endsWith("'"))) {
    parsed = parsed.slice(1, -1);
    console.log('Removed surrounding quotes');
  }

  // Handle various newline escape formats
  // First try double-escaped (\\n -> \n -> actual newline)
  if (parsed.includes('\\\\n')) {
    parsed = parsed.replace(/\\\\n/g, '\n');
    console.log('Replaced double-escaped newlines');
  }
  // Then single-escaped (\n -> actual newline)  
  if (parsed.includes('\\n')) {
    parsed = parsed.replace(/\\n/g, '\n');
    console.log('Replaced single-escaped newlines');
  }

  // Log the result (safe info only)
  const lines = parsed.split('\n');
  console.log('After parsing:', {
    parsedLength: parsed.length,
    lineCount: lines.length,
    firstLine: lines[0]?.substring(0, 30),
    lastLine: lines[lines.length - 1]?.substring(0, 30),
  });

  // Validate key format
  if (!parsed.includes('-----BEGIN') || !parsed.includes('PRIVATE KEY-----')) {
    throw new Error(
      `FIREBASE_PRIVATE_KEY appears malformed. First line: "${lines[0]?.substring(0, 40)}...". ` +
      'It should start with "-----BEGIN PRIVATE KEY-----". Check Railway env var format.'
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

export function getFirebaseKeyDebugInfo(): Record<string, unknown> {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) {
    return { error: 'FIREBASE_PRIVATE_KEY not set' };
  }
  
  return {
    length: key.length,
    startsWithQuote: key.startsWith('"') || key.startsWith("'"),
    endsWithQuote: key.endsWith('"') || key.endsWith("'"),
    hasDoubleEscapedNewlines: key.includes('\\\\n'),
    hasSingleEscapedNewlines: key.includes('\\n'),
    hasLiteralNewlines: key.includes('\n'),
    startsWithBegin: key.includes('-----BEGIN'),
    endsWithEnd: key.includes('-----END'),
    first40: key.substring(0, 40).replace(/[A-Za-z0-9+/=]/g, '*'),
  };
}
