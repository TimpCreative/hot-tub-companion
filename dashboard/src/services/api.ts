import axios, { type AxiosInstance } from 'axios';

const externalApiBase =
  (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com') + '/api/v1';

/**
 * For super admin: calls /api/dashboard/super-admin proxy (server-side, no CORS).
 * Forwards Firebase token to the API.
 */
export function createSuperAdminApiClient(getToken?: () => Promise<string | null>): AxiosInstance {
  const client = axios.create({
    baseURL: '/api/dashboard/super-admin',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  if (getToken) {
    client.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  client.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error.response?.data || error)
  );

  return client;
}

/**
 * For direct API calls (legacy / non-super-admin).
 */
export function createApiClient(options?: {
  tenantApiKey?: string;
  getToken?: () => Promise<string | null>;
}): AxiosInstance {
  const client = axios.create({
    baseURL: externalApiBase,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.tenantApiKey ? { 'x-tenant-key': options.tenantApiKey } : {}),
    },
  });

  if (options?.getToken) {
    client.interceptors.request.use(async (config) => {
      const token = await options.getToken!();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  client.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error.response?.data || error)
  );

  return client;
}

/**
 * For retailer admin: calls /api/dashboard/proxy which resolves
 * tenant API key from DB by slug (never exposes key to client).
 */
export function createTenantApiClient(getToken?: () => Promise<string | null>): AxiosInstance {
  const client = axios.create({
    baseURL: '/api/dashboard/proxy',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  if (getToken) {
    client.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  client.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error.response?.data || error)
  );

  return client;
}
