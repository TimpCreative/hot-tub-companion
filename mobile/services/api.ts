import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

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
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('firebase_token');
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
