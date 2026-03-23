/**
 * Firebase Auth persistence adapter backed by Expo SecureStore.
 * Avoids relying on @react-native-async-storage when the native module is missing,
 * and satisfies SecureStore key rules (alphanumeric, ., -, _).
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 2000;

function safeKey(key: string): string {
  return `fb_${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export const firebaseAuthSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safeKey(key);
    const meta = await SecureStore.getItemAsync(`${base}__n`);
    if (meta === null) return null;
    const n = parseInt(meta, 10);
    if (Number.isNaN(n) || n <= 0) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${base}__c${i}`);
      if (part) out += part;
    }
    return out;
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = safeKey(key);
    await this.removeItem(key);
    const len = value.length;
    const n = len === 0 ? 0 : Math.ceil(len / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${base}__n`, String(n));
    for (let i = 0; i < n; i++) {
      const part = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${base}__c${i}`, part);
    }
  },

  async removeItem(key: string): Promise<void> {
    const base = safeKey(key);
    const meta = await SecureStore.getItemAsync(`${base}__n`);
    await SecureStore.deleteItemAsync(`${base}__n`).catch(() => {});
    if (meta === null) return;
    const n = parseInt(meta, 10);
    if (Number.isNaN(n)) return;
    for (let i = 0; i < n; i++) {
      await SecureStore.deleteItemAsync(`${base}__c${i}`).catch(() => {});
    }
  },
};
