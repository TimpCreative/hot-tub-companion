import axios, { type AxiosInstance } from 'axios';

const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com') + '/api/v1';

export function createApiClient(options?: {
  tenantApiKey?: string;
  getToken?: () => Promise<string | null>;
}): AxiosInstance {
  const client = axios.create({
    baseURL,
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
