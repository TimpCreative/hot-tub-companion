'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createApiClient } from '@/services/api';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';

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

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getIdToken } = useAuth();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getIdToken();
        const api = createApiClient({ getToken: async () => token });
        const res = await api.get('/super-admin/tenants') as { data?: { tenants?: Tenant[] } };
        const found = res.data?.tenants?.find((t) => t.id === id);
        if (found) setTenant(found);
        else setError('Tenant not found');
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to load tenant';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, getIdToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div>
        <div className="mb-6">
          <Link
            href="/super-admin/tenants"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to Tenants
          </Link>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error || 'Tenant not found'}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/super-admin/tenants"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Tenants
        </Link>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-6">{tenant.name}</h2>

      <div className="bg-white shadow rounded-lg overflow-hidden max-w-2xl">
        <dl className="divide-y divide-gray-200">
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">ID</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{tenant.id}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Slug</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{tenant.slug}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                {tenant.status}
              </span>
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">API Key</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono break-all">
              {tenant.apiKey || '—'}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Primary Color</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2 flex items-center gap-2">
              {tenant.primaryColor && (
                <span
                  className="inline-block w-6 h-6 rounded border"
                  style={{ backgroundColor: tenant.primaryColor }}
                />
              )}
              {tenant.primaryColor || '—'}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Secondary Color</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2 flex items-center gap-2">
              {tenant.secondaryColor && (
                <span
                  className="inline-block w-6 h-6 rounded border"
                  style={{ backgroundColor: tenant.secondaryColor }}
                />
              )}
              {tenant.secondaryColor || '—'}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {tenant.createdAt ? format(new Date(tenant.createdAt), 'MMM d, yyyy HH:mm') : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
