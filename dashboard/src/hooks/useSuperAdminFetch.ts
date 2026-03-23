'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const DEBUG_LOG = (data: Record<string, unknown>) => {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '97b103' },
    body: JSON.stringify({ sessionId: '97b103', ...data, timestamp: Date.now() }),
  }).catch(() => {});
  // #endregion
};

/**
 * Returns a fetch function that automatically adds the Firebase Bearer token
 * for super-admin API requests. Use for all /api/dashboard/super-admin/* calls.
 */
export function useSuperAdminFetch() {
  const { getIdToken } = useAuth();

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getIdToken(true);
      DEBUG_LOG({
        hypothesisId: 'H4',
        location: 'useSuperAdminFetch:beforeFetch',
        message: 'Client about to fetch',
        data: { url, hasToken: !!token, tokenLen: token?.length ?? 0 },
      });
      if (!token) {
        throw new Error('Not authenticated');
      }
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers, credentials: 'same-origin' });
    },
    [getIdToken]
  );

  return fetchWithAuth;
}
