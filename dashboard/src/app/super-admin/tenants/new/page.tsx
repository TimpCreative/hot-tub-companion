'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { createApiClient } from '@/services/api';

export default function NewTenantPage() {
  const { getIdToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1B4D7A');
  const [secondaryColor, setSecondaryColor] = useState('#E8A832');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await getIdToken();
      const api = createApiClient({ getToken: async () => token });
      const res = await api.post('/super-admin/tenants', {
        name,
        slug,
        apiKey: apiKey || undefined,
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
      }) as { data?: { tenant?: { id: string } } };
      const tenant = res.data?.tenant;
      router.push(tenant ? `/super-admin/tenants/${tenant.id}` : '/super-admin/tenants');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to create tenant';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
  };

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

      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create Tenant</h2>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
            Slug (subdomain)
          </label>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="e.g. takeabreak"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
            API Key (optional; auto-generated if empty)
          </label>
          <input
            id="apiKey"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
            Primary Color
          </label>
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-full rounded border border-gray-300"
          />
        </div>
        <div>
          <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-1">
            Secondary Color
          </label>
          <input
            id="secondaryColor"
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-10 w-full rounded border border-gray-300"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="submit" loading={loading}>
            Create Tenant
          </Button>
          <Link href="/super-admin/tenants">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
