'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  apiKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  createdAt: string;
}

export default function SuperAdminTenantsPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/tenants');
        const data = await res.json();
        if (data.success) {
          setTenants(data.data?.tenants || []);
        } else {
          setError(data.error?.message || 'Failed to load tenants');
        }
      } catch (err: unknown) {
        const e = err && typeof err === 'object' ? (err as Error) : {};
        const msg = e instanceof Error ? e.message : 'Failed to load tenants';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fetchWithAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Tenants</h2>
        <Link href="/super-admin/tenants/new">
          <Button>Create Tenant</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {tenant.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {tenant.slug}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {tenant.createdAt
                    ? format(new Date(tenant.createdAt), 'MMM d, yyyy')
                    : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/super-admin/tenants/${tenant.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">No tenants yet.</div>
        )}
      </div>
    </div>
  );
}
