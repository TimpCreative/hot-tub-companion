'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';

type SubRow = {
  id: string;
  user_id: string;
  user_email?: string;
  status: string;
  stripe_subscription_id: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  bundle_title?: string | null;
  created_at?: string;
};

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const er = (e as { error?: { message?: string } }).error;
    if (er?.message) return er.message;
  }
  return 'Request failed';
}

export default function ActiveSubscriptionsPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = (await api.get('/admin/subscriptions/customers')) as {
        data?: { subscriptions?: SubRow[] };
      };
      setRows(Array.isArray(res?.data?.subscriptions) ? res.data!.subscriptions! : []);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-gray-600">Loading…</p>;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Active subscriptions</h1>
        <p className="mt-1 text-sm text-gray-600">Mirror of Stripe subscription state for your tenant (from webhooks).</p>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Bundle</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Period end</th>
              <th className="px-4 py-2 font-medium">Stripe sub</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2">
                  <div className="text-gray-900">{r.user_email || r.user_id}</div>
                </td>
                <td className="px-4 py-2">{r.bundle_title || '—'}</td>
                <td className="px-4 py-2">
                  {r.status}
                  {r.cancel_at_period_end ? <span className="text-amber-700"> (cancel at period end)</span> : null}
                </td>
                <td className="px-4 py-2 text-gray-700">
                  {r.current_period_end ? format(new Date(r.current_period_end), 'PP') : '—'}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.stripe_subscription_id}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No subscriptions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
