import axios, { AxiosHeaders, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/** Only wipe the stored ID token when Firebase actually rejected it — not on every 401. */
function shouldClearStoredIdTokenOn401(apiBody: unknown): boolean {
  if (!apiBody || typeof apiBody !== 'object') return false;
  const err = (apiBody as { error?: { message?: string } }).error;
  const msg = typeof err?.message === 'string' ? err.message : '';
  return msg === 'Invalid or expired token';
}

const extra = Constants.expoConfig?.extra as {
  apiUrl?: string;
  tenantApiKey?: string;
} | undefined;

const baseURL = (extra?.apiUrl || 'https://api.hottubcompanion.com') + '/api/v1';
const tenantApiKey = extra?.tenantApiKey || '';

if (!tenantApiKey) {
  // Fail fast in development if tenant context is missing.
  // This prevents silently calling APIs without tenant scoping.
  console.warn('[api] Missing tenant API key. Requests may be rejected.');
}

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-key': tenantApiKey,
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('firebase_token');
  if (token) {
    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      const data = error.response.data;
      if (shouldClearStoredIdTokenOn401(data)) {
        await SecureStore.deleteItemAsync('firebase_token');
      }
    }
    if (isAxiosError(error) && error.response?.data !== undefined) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
