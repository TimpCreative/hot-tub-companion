'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns a fetch function that automatically adds the Firebase Bearer token
 * for super-admin API requests. Use for all /api/dashboard/super-admin/* calls.
 */
export function useSuperAdminFetch() {
  const { getIdToken } = useAuth();

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
    [getIdToken]
  );

  return fetchWithAuth;
}
